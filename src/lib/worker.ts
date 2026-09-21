/**
 * Worker base — how a job gets registered, executed, audited, and retried (NWB-P1-001, ADR-028).
 *
 * Two rules the plan puts on every worker, enforced **here** rather than in each handler:
 *
 * - **ground rule 3, "every mutating service call writes an audit event"** — a worker is a mutation
 *   with nobody in front of a request. Both outcomes are written: the successful run (so a run that
 *   did nothing is still evidence the loop turned) and the failed run (so an operator can see the
 *   purge has been dying nightly without reading pg_stat).
 * - **ground rule 4, "every worker is idempotent"** — cannot be granted by a wrapper, so this file
 *   does the two things that make it checkable: at-least-once execution is never amplified (a batch
 *   is one job at a time, `batchSize: 1`, and a handler runs in its own attempt slot), and each job
 *   is a thin adapter over a service function whose own re-run is a no-op — pinned per job in
 *   `src/tests/queue/jobs.test.ts`. The plan's "running twice must produce the same result" is a
 *   property of the handler, and the review bar for adding one is that property, not this wrapper.
 *
 * **What this file is not:** a registry of business jobs — that is `src/jobs/` — and not an audit
 * implementation. The audit sink is injected (`WorkerDeps.audit`) so `src/lib/` keeps no runtime
 * edge into `src/services/`; only the parameter *type* is imported from there.
 */
import type { AuditActionName, AuditCategory, WriteAuditLogEntryParams } from "../services/audit";
import { getConfig } from "./config";
import type { Db } from "./db";
import { describeError } from "./errors";
import {
  QUEUE_JOB_NAMES,
  QUEUE_POLICY_DEFAULTS,
  type QueueClient,
  type QueueJobName,
  type QueuePolicy,
  startQueue,
  stopQueue,
} from "./queue";
import { applySchedules, type JobSchedule, resolveSchedules } from "./scheduler";

/**
 * What a handler reports back; recorded verbatim as the audit event's `after_state`.
 *
 * A handler that returns nothing is not reporting nothing: the wrapper writes `{ ok: true }`, so a
 * quiet success is still a distinguishable row from a failure. `undefined` rather than `void` in
 * the union because `void` inside a union is the confusing kind (biome `noConfusingVoidType`), and
 * a handler's `return;` produces `undefined` at runtime anyway.
 */
export type JobOutcome = Record<string, unknown>;

/** The attempt the handler is running inside, narrowed to what a handler may legitimately need. */
export interface JobAttempt {
  /** pg-boss's job id — the join key into its own tables, and the audit row's `metadata.jobId`. */
  readonly id: string;
  /** 1 for the first attempt, 2 for the first retry, and so on. */
  readonly attempt: number;
  /** Retries already spent. Absent on a run not started by pg-boss (a manual `queue:run`). */
  readonly retryCount?: number | undefined;
  /** The queue's retry budget, from its policy. Absent for the same reason as `retryCount`. */
  readonly retryLimit?: number | undefined;
}

/** Everything a handler gets. `db` is the app's handle, so audit and job writes share transaction semantics. */
export interface JobContext {
  readonly db: Db;
  readonly job: JobAttempt;
}

/**
 * A unit of scheduled work: the queue it owns, the audit event its runs produce, and the handler.
 *
 * `audit.action` follows the `unified_audit_log` convention (`<resource>.<verb>`, see
 * `db/shared/audit.ts`) and describes the *work*, not the mechanism: `rate-limits.reclaimed`,
 * never `queue.job.completed`. The queue name belongs in `metadata`, which is how you query for
 * "every account purge that failed this month" without the audit vocabulary tracking renames.
 */
export interface JobDefinition<TData extends object | null = object | null> {
  readonly name: QueueJobName;
  /** One line of human text; printed by `bun run queue:run --list`. */
  readonly description: string;
  /** Merged over `QUEUE_POLICY_DEFAULTS` and handed to `createQueue`. */
  readonly policy?: QueuePolicy;
  readonly audit: {
    /**
     * A name registered in `src/services/audit/actions.ts`. Typing it here is what stops a job from
     * inventing a fifth spelling of "purged": the audit vocabulary is shared with every HTTP mutation,
     * and a job-only action would be invisible to `grep`-ing the registry.
     */
    readonly action: AuditActionName;
    readonly category: AuditCategory;
    readonly resourceType: string;
  };
  handle(context: JobContext, data: TData): Promise<JobOutcome | undefined>;
}

/** Any definition, for the lists that cannot know each job's payload type. */
// biome-ignore lint/suspicious/noExplicitAny: the data type is only ever read back inside `handle`
export type AnyJobDefinition = JobDefinition<any>;

/** The audit sink: `writeAuditLog`'s exact signature, minus the `db` the worker already has. */
export type AuditWriter = (params: WriteAuditLogEntryParams) => Promise<void>;

/** Injected capabilities. A test hands in a recording sink; production hands in the real one. */
export interface WorkerDeps {
  readonly db: Db;
  readonly audit: AuditWriter;
}

/** Thrown on a definition that would compile, run, and quietly lose evidence. */
export class JobDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobDefinitionError";
  }
}

/**
 * Reject a job set that cannot be trusted: duplicate queue names (the second `work()` would
 * silently replace the first), an empty audit action (an unattributable audit row is worse than
 * none), or a handler that is not a function.
 */
export function validateJobDefinitions(jobs: readonly AnyJobDefinition[]): void {
  const seen = new Set<string>();

  for (const job of jobs) {
    if (seen.has(job.name)) {
      throw new JobDefinitionError(`duplicate job definition for queue "${job.name}"`);
    }
    seen.add(job.name);

    if (job.audit.action.trim().length === 0) {
      throw new JobDefinitionError(`job "${job.name}" has no audit action`);
    }
    if (typeof job.handle !== "function") {
      throw new JobDefinitionError(`job "${job.name}" has no handler`);
    }
  }
}

/**
 * Create the queue row for each definition, with its retry/expiry policy.
 *
 * The row must exist before anything can be sent to the queue — pg-boss v12 refuses `send()` on an
 * unknown queue (`Queue <name> does not exist`), and `work()` does not create one. That includes the
 * sends the *scheduler* makes on this process's behalf, which is why the runtime ensures queues even
 * when it is configured not to work them: a scheduler with no queue rows is a cron pass that throws
 * at 02:00 in a log nobody reads.
 */
export async function ensureQueues(
  boss: QueueClient,
  jobs: readonly AnyJobDefinition[],
): Promise<void> {
  validateJobDefinitions(jobs);

  for (const job of jobs) {
    await boss.createQueue(job.name, { ...QUEUE_POLICY_DEFAULTS, ...job.policy });
  }
}

/** Attach one worker per queue: a poll loop that takes a single job per handler call. */
export async function attachWorkers(
  boss: QueueClient,
  deps: WorkerDeps,
  jobs: readonly AnyJobDefinition[],
  options: { pollingIntervalSeconds?: number } = {},
): Promise<void> {
  // pg-boss floors this at 0.5s; a shorter value would only burn connections on an empty table.
  const pollingIntervalSeconds = Math.max(
    0.5,
    options.pollingIntervalSeconds ?? getConfig().QUEUE_POLLING_INTERVAL_SECONDS,
  );

  for (const job of jobs) {
    await boss.work<object | null>(
      job.name,
      // `batchSize: 1` keeps one attempt per handler call, so a failure retries *that* job and not
      // a batch whose earlier members already committed their work.
      { includeMetadata: true, batchSize: 1, pollingIntervalSeconds },
      async (received) => {
        for (const receivedJob of received) {
          await runJobGuarded(job, deps, attemptOf(receivedJob), receivedJob.data);
        }
      },
    );
  }
}

/**
 * Create each queue and attach its worker.
 *
 * The two halves are separately exported (`ensureQueues`, `attachWorkers`) because they are
 * separately configurable; this is the call a process makes when it owns the job set outright.
 */
export async function registerJobs(
  boss: QueueClient,
  deps: WorkerDeps,
  jobs: readonly AnyJobDefinition[],
  options: { pollingIntervalSeconds?: number } = {},
): Promise<void> {
  await ensureQueues(boss, jobs);
  await attachWorkers(boss, deps, jobs, options);
}

/** Detach every worker in the set. Queues, their jobs, and their schedules survive. */
export async function unregisterJobs(
  boss: QueueClient,
  jobs: readonly AnyJobDefinition[],
): Promise<void> {
  for (const job of jobs) {
    await boss.offWork(job.name);
  }
}

/**
 * Run one job with its audit events, retry semantics, and error propagation intact.
 *
 * Exported for two callers that must not fork this behavior: `bun run queue:run` (an operator
 * running one job now) and the tests. It is also the seam a later ticket uses to run a job inline
 * after a bulk admin action instead of waiting for the cron.
 */
export async function runJobGuarded<TData extends object | null>(
  job: JobDefinition<TData>,
  deps: WorkerDeps,
  attempt: JobAttempt,
  data: TData,
): Promise<JobOutcome | undefined> {
  let outcome: JobOutcome | undefined;

  try {
    outcome = await job.handle({ db: deps.db, job: attempt }, data);
  } catch (error) {
    const message = describeError(error);
    // A retry is still owed, so this is a warning; the last attempt spent is an alarm.
    const severity = attemptHasRetryLeft(attempt) ? "warning" : "critical";

    await writeAuditSafely(deps, job, {
      severity,
      reason: `${job.name} failed: ${message}`,
      changes: { error: message, attempt: attempt.attempt },
      metadata: auditMetadata(job, attempt),
    });

    // Rethrow, never swallow: pg-boss's retry/backoff is the whole point of using it, and a
    // handler error that does not reach the library marks the job completed.
    throw error;
  }

  await writeAuditSafely(deps, job, {
    severity: "info",
    afterState: outcome ?? { ok: true },
    metadata: auditMetadata(job, attempt),
  });

  return outcome;
}

/** `true` unless the attempt counter has reached the queue's retry limit. */
function attemptHasRetryLeft(attempt: JobAttempt): boolean {
  const { retryCount, retryLimit } = attempt;
  if (typeof retryCount !== "number" || typeof retryLimit !== "number") return false;
  return retryCount < retryLimit;
}

function auditMetadata(
  job: JobDefinition<object | null>,
  attempt: JobAttempt,
): Record<string, unknown> {
  return {
    queue: job.name,
    jobId: attempt.id,
    attempt: attempt.attempt,
    // Only when the attempt came from pg-boss: an operator's manual run has no budget to report,
    // and writing `retryLimit: null` would read as "no retries configured" rather than "unknown".
    ...(typeof attempt.retryLimit === "number" ? { retryLimit: attempt.retryLimit } : {}),
  };
}

/**
 * Write an audit row without ever letting the write itself change the job's outcome.
 *
 * If the audit insert fails on a *success*, the row is lost but the work is done — report it loudly
 * and complete the job, because failing a purge whose writes landed would only make the next run
 * re-derive the same result. If it fails on a *failure*, the error is still rethrown below and the
 * job retries, so the evidence gap is bounded by the retry. Either way the operator sees it on
 * stderr; P1-012 (observability) gives this line a home worth shipping to.
 */
async function writeAuditSafely(
  deps: WorkerDeps,
  job: JobDefinition<object | null>,
  event: Partial<WriteAuditLogEntryParams>,
): Promise<void> {
  try {
    await deps.audit({
      db: deps.db,
      // `module: "core"` and not `"system"` on purpose: `chk_ual_system_requires_checksum` makes
      // admin/system/compliance rows carry a hash-chain checksum, and nothing computes the chain
      // yet (NWB-P0-002's DSAR event cites the same reason). P1-002 flips these to their real
      // module when the chain exists.
      module: "core",
      // No organizationId: these queues are cross-tenant by design — one run sweeps every
      // organization's expired rows. Attributing the run to one tenant would be a lie.
      actorType: "system",
      action: job.audit.action,
      category: job.audit.category,
      resourceType: job.audit.resourceType,
      ...event,
    });
  } catch (error) {
    console.error(`[queue] audit write failed for "${job.name}": ${describeError(error)}`);
  }
}

/**
 * Refuse to start a runtime that would leave a declared queue unmanned.
 *
 * `QUEUE_JOB_NAMES` is what the scheduler is willing to fire; a name missing from the job set
 * therefore means "scheduled, and nothing will ever run it" — a queue that reads as healthy while
 * the retention clock silently stops. Cheap to check, and impossible to notice from the outside.
 */
export function assertJobSetIsComplete(jobs: readonly AnyJobDefinition[]): void {
  const registered = new Set<string>(jobs.map((job) => job.name));
  const unmanned = QUEUE_JOB_NAMES.filter((name) => !registered.has(name));
  if (unmanned.length > 0) {
    throw new JobDefinitionError(
      `queues with a name and no job definition (a schedule would fire into nothing): ${unmanned.join(", ")}`,
    );
  }
}

/** A running worker: the client it is attached to, and how to stop it. */
export interface WorkerHandle {
  readonly boss: QueueClient;
  readonly jobs: readonly AnyJobDefinition[];
  /** `true` when this handle started the client and therefore owns closing it. */
  readonly ownsClient: boolean;
  stop(): Promise<void>;
}

/**
 * Start workers (and, unless told otherwise, the scheduler) for a job set.
 *
 * This is the whole ADR-007 requirement — "running them as a separate process requires
 * configuration only, no code change": `withWorker` and `withSchedules` are the two toggles, and
 * `src/index.ts` and `src/scripts/queue-worker.ts` are the same call with different flags.
 *
 * **`stop()` does not unschedule.** Schedules live in the database precisely so they outlive a
 * deploy; clearing them on shutdown would mean "no nightly work until a process happens to be
 * started with the scheduler on", which is an outage waiting for a restart. Pause the clock on
 * purpose with `removeSchedules()`, never by accident on the way out.
 */
export async function startWorkerRuntime(
  deps: WorkerDeps,
  jobs: readonly AnyJobDefinition[],
  options: {
    /** Bring your own started client (tests, or a process sharing one client with the API).
     *  `| undefined` because callers pass `options.boss` straight through, and
     *  `exactOptionalPropertyTypes` makes an absent key and an explicit `undefined` different types. */
    boss?: QueueClient | undefined;
    withWorker?: boolean;
    withSchedules?: boolean;
    /** Resolved schedules to register; ignored unless `withSchedules`. */
    schedules?: readonly JobSchedule[];
    pollingIntervalSeconds?: number;
    /** Refuse a job set that leaves a declared queue unmanned. On by default. */
    requireCompleteJobSet?: boolean;
  } = {},
): Promise<WorkerHandle> {
  if (options.requireCompleteJobSet ?? true) assertJobSetIsComplete(jobs);

  const ownsClient = options.boss === undefined;
  const boss = options.boss ?? (await startQueue());

  // Queues first, whatever this process decides to do with them: see `ensureQueues`.
  await ensureQueues(boss, jobs);

  if (options.withWorker ?? true) {
    await attachWorkers(boss, deps, jobs, {
      pollingIntervalSeconds:
        options.pollingIntervalSeconds ?? getConfig().QUEUE_POLLING_INTERVAL_SECONDS,
    });
  }

  if (options.withSchedules ?? true) {
    await applySchedules(boss, options.schedules ?? resolveSchedules());
  }

  return {
    boss,
    jobs,
    ownsClient,
    async stop() {
      await unregisterJobs(boss, jobs);
      if (ownsClient) await stopQueue();
    },
  };
}

/**
 * Map a pg-boss job onto the narrow `JobAttempt` a handler is allowed to see.
 *
 * Typed structurally rather than as `JobWithMetadata` on purpose: pg-boss's handler signature is
 * derived from `includeMetadata` through a conditional type, and depending on the overload that
 * resolution leaves the job without its metadata columns. The three fields here are all the wrapper
 * needs, and reading them off either shape is the same lookup.
 */
export function attemptOf(job: {
  id: string;
  retryCount?: number | undefined;
  retryLimit?: number | undefined;
}): JobAttempt {
  return {
    id: job.id,
    // `retryCount` is retries *so far*, so the first attempt is 1.
    attempt: (typeof job.retryCount === "number" ? job.retryCount : 0) + 1,
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
  };
}
