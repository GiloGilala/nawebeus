/**
 * Queue client — the pg-boss lifecycle every worker and every enqueue goes through
 * (NWB-P1-001, ADR-028).
 *
 * **Why pg-boss:** ADR-028 chose it over `Bun.cron` (a trigger, not a queue — no persistence,
 * retry, backoff, or job state), over in-process timers (jobs die with the process), and over
 * Redis/BullMQ (a second service to run on a single self-hosted VPS, ADR-008). It stores jobs in
 * the PostgreSQL instance ADR-003 already provides, and its own tables live in their own schema,
 * which never enters `db/schema.ts` or `drizzle/migrations/` — see `drizzle/README.md`.
 *
 * **Why this file owns the client and nothing else:** pg-boss's API is wide, and its versioning is
 * its own (the library migrates its schema on `start()`). Everything that could be affected by a
 * pg-boss upgrade is in `src/lib/queue.ts`, `src/lib/scheduler.ts`, and `src/lib/worker.ts`;
 * job handlers and services never import the library directly.
 */

import type { ConstructorOptions, QueueOptions, SendOptions } from "pg-boss";
import { PgBoss } from "pg-boss";
import { getConfig } from "./config";
import { describeError } from "./errors";

/**
 * The queues this application owns, as one exhaustive map.
 *
 * Names are stable identifiers: they are stored in `unified_audit_log.metadata` and in pg-boss's
 * own queue table, so renaming one is a data migration, not a rename. Job handlers reach them via
 * `QUEUE_JOBS`, never as a string literal.
 */
export const QUEUE_JOBS = {
  /** NWB-P0-013's reclamation of expired `rate_limits` buckets. */
  rateLimitReclaim: "maintenance.rate-limit-reclaim",
  /** F-18 — hard deletion of accounts past their 30-day grace window (NDPR erasure). */
  purgeExpiredAccounts: "retention.purge-expired-accounts",
  /** NWB-P0-023 — hard deletion of organizations past their 30-day grace window. */
  purgeExpiredOrganizations: "retention.purge-expired-organizations",
  /** NWB-P1-016 — hard deletion of invitations lapsed past the 30-day grace window. */
  purgeExpiredInvitations: "retention.purge-expired-invitations",
  /** NWB-P1-010 — nightly enforcement of the §9.4 retention schedule. */
  retentionEnforce: "retention.enforce",
  /** NWB-P1-014 — nightly verification of the audit hash chains. */
  auditChainVerify: "integrity.audit-chain-verify",
} as const;

export type QueueJobName = (typeof QUEUE_JOBS)[keyof typeof QUEUE_JOBS];

/**
 * Every queue name, **in the order the nightly schedule runs them** (see
 * `src/lib/scheduler.ts`): reclamation, then organizations, then invitations, then accounts,
 * then retention enforcement, then chain verification. The job set and the schedule table are
 * both compared against this list, so the order is the invariant, not a style choice — see
 * `src/tests/queue/definitions.test.ts`.
 */
export const QUEUE_JOB_NAMES: readonly QueueJobName[] = [
  QUEUE_JOBS.rateLimitReclaim,
  QUEUE_JOBS.purgeExpiredOrganizations,
  QUEUE_JOBS.purgeExpiredInvitations,
  QUEUE_JOBS.purgeExpiredAccounts,
  QUEUE_JOBS.retentionEnforce,
  QUEUE_JOBS.auditChainVerify,
];

/** `true` for a known queue name — the guard scripts and tests use instead of a cast. */
export function isQueueJobName(value: string): value is QueueJobName {
  return (QUEUE_JOB_NAMES as readonly string[]).includes(value);
}

/**
 * Per-queue retry and expiry policy. Declared as a *queue* option (not per send) because these
 * jobs are created by the scheduler, which has no place to pass them.
 */
export type QueuePolicy = Pick<
  QueueOptions,
  "retryLimit" | "retryDelay" | "retryBackoff" | "expireInSeconds"
>;

/**
 * Three attempts, 60s apart, doubling (60 → 120 → 240; pg-boss's `retryBackoff` is
 * `retryDelay * 2 ^ retryCount`), then the job is failed and the next scheduled tick is the real
 * retry. 15 minutes of runtime before pg-boss calls a job dead and retries it (the library's own
 * default) — long enough for a purge of a table of expired rows, short enough that a wedged
 * handler does not sit on a connection for hours.
 */
export const QUEUE_POLICY_DEFAULTS: QueuePolicy = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 900,
};

/**
 * The slice of pg-boss this codebase uses, declared structurally so a test can hand `registerJobs`
 * and `applySchedules` a recording fake instead of a database. A `PgBoss` satisfies it as-is.
 */
export type QueueClient = Pick<
  PgBoss,
  | "start"
  | "stop"
  | "createQueue"
  | "send"
  | "work"
  | "offWork"
  | "schedule"
  | "unschedule"
  | "getSchedules"
  | "getQueue"
  | "findJobs"
  | "on"
>;

/**
 * Build a pg-boss client from config. Not started, not registered, not connected — callers that
 * want the process-wide, already-started instance use {@link startQueue}.
 *
 * `overrides` exists for the one legitimate exception: the integration test in
 * `src/tests/queue/loop.test.ts` installs into a throwaway schema so it can drop it afterwards
 * without touching a real installation. It is not an invitation to configure a second queue.
 */
export function createQueueClient(overrides: Partial<ConstructorOptions> = {}): PgBoss {
  const config = getConfig();

  return new PgBoss({
    connectionString: config.DATABASE_URL,
    /**
     * Its own schema, on purpose: pg-boss's tables must never look like application tables to
     * drizzle (NWB-P0-005's rule) and must never be swept up by a tenant-scoped query or a future
     * RLS policy (D11).
     */
    schema: config.QUEUE_SCHEMA,
    // Shows up in pg_stat_activity; makes "which process is hammering the job table" answerable.
    application_name: "nawebeus-queue",
    ...overrides,
  });
}

let _client: PgBoss | undefined;

/**
 * Start the process-wide queue client (idempotent — a second call returns the live instance).
 *
 * `boss.start()` is what applies pg-boss's own schema migrations, so it is also the only place the
 * queue schema is ever created. It is deliberately not called at import time anywhere.
 */
export async function startQueue(overrides: Partial<ConstructorOptions> = {}): Promise<PgBoss> {
  if (_client) return _client;

  const boss = createQueueClient(overrides);

  /**
   * pg-boss surfaces internal failures (a dropped connection during maintenance, a failed
   * migration) on this event. Without a listener an `EventEmitter` throws, and a queue that
   * cannot reach the database would take the API process down with it — which is exactly what
   * ADR-007's single-process shape makes easy to do by accident. Logged, not fatal: the workers
   * are retry-owning by construction, so a lost poll cycle costs latency and nothing else.
   */
  boss.on("error", (error) => {
    console.error(`[queue] pg-boss error: ${describeError(error)}`);
  });

  await boss.start();
  _client = boss;
  return boss;
}

/** The started client, or `undefined` when this process has no queue runtime. */
export function getQueue(): QueueClient | undefined {
  return _client;
}

/** True while this process holds a started queue client. */
export function isQueueStarted(): boolean {
  return _client !== undefined;
}

/**
 * Stop the process-wide client. Graceful: in-flight handlers finish, then the pools close. Safe to
 * call when nothing was started (shutdown paths must not need to know that).
 */
export async function stopQueue(
  options: { graceful?: boolean; timeout?: number } = {},
): Promise<void> {
  const boss = _client;
  if (!boss) return;
  _client = undefined;
  await boss.stop({ graceful: options.graceful ?? true, timeout: options.timeout ?? 10_000 });
}

/**
 * Enqueue a job on an already-registered queue.
 *
 * The queue must exist: `boss.work()` does not create it, and v12's `send()` throws
 * `Queue <name> does not exist` otherwise — which is why `registerJobs()` (worker.ts) creates the
 * queue before it attaches a worker. Domain tickets that enqueue from a request path
 * (NWB-P1-003's approval expiry, P2's publish dispatch) go through here or pass the caller's
 * transaction to pg-boss (`send(name, data, { db: tx })`) when the enqueue must commit with the
 * business write — ADR-028's rationale for choosing the library in the first place.
 */
export async function enqueueJob(
  boss: QueueClient,
  name: string,
  data: object | null = null,
  options?: SendOptions,
): Promise<string | null> {
  return boss.send(name, data, options);
}
