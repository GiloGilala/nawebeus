/**
 * The loop, for real — pg-boss, PostgreSQL, cron, retries (NWB-P1-001).
 *
 * This is the file that turns "we wrote a worker base" into "a scheduled worker runs", which is
 * Phase 2's exit-gate language and the part a fake cannot establish. It runs against the same
 * database the rest of the suite uses, in a **throwaway pg-boss schema** (`pgboss_test_…`, dropped
 * in `afterAll`), for two reasons:
 *
 * - the app's own `pgboss` schema must not be disturbed by a test — `boss.start()` installs and
 *   *versions* that schema, and a test writing into it would be a real migration;
 * - job tables are the one place a rollback-only harness does not work: pg-boss claims jobs on its
 *   own connection, outside `withTestDb`'s transaction, so sharing the app's schema would commit
 *   rows on purpose. Isolation by schema, not by rollback.
 *
 * Audit writes are captured by an injected sink, so nothing here touches `unified_audit_log` — the
 * real insert is covered in `jobs.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import pg from "pg";
import { PgBoss } from "pg-boss";
import type { Db } from "../../lib/db";
import {
  createQueueClient,
  enqueueJob,
  getQueue,
  isQueueStarted,
  QUEUE_JOBS,
  startQueue,
  stopQueue,
} from "../../lib/queue";
import { applySchedules, removeSchedules } from "../../lib/scheduler";
import {
  type AnyJobDefinition,
  attachWorkers,
  ensureQueues,
  type WorkerDeps,
} from "../../lib/worker";
import type { AuditActionName, WriteAuditLogEntryParams } from "../../services/audit";

const hasDb = () => !!process.env.DATABASE_URL;
const url = process.env.DATABASE_URL ?? "";

/** A name legal in `CREATE SCHEMA`, unique per run so parallel checkouts cannot collide. */
const testSchema = `pgboss_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

/** The queue this file exercises: a real declared name, with a handler that only counts. */
const LOOP_QUEUE = QUEUE_JOBS.rateLimitReclaim;

/**
 * The audit action the harness job reports, as a shared constant.
 *
 * It has to be a *registered* action, because `JobDefinition.audit.action` is typed as
 * `AuditActionName` since NWB-P1-002. Inventing `"loop-test.ran"` would mean adding a test-only name
 * to a vocabulary that saved filters and future retention rules are keyed on, so the harness borrows
 * the action of the queue it really does drive — and the assertions below read the same constant, so
 * the pair cannot drift apart the way the first draft of this file did.
 */
const LOOP_AUDIT_ACTION = "rate-limits.reclaimed" satisfies AuditActionName;

let boss: PgBoss;

/**
 * A fresh handler, attempt log, and audit capture per test — deliberately not module state.
 *
 * (An earlier draft shared a `failRemaining` counter across tests, which turned "the retry never
 * happened" into "the job never failed": the wrapper reported a clean completion because the test
 * had quietly stopped failing. Per-test state cannot leak that way, and the failure each test wants
 * is a parameter of its own harness.)
 */
interface Harness {
  readonly runs: { attempt: number; jobId: string }[];
  readonly auditEvents: WriteAuditLogEntryParams[];
  readonly job: AnyJobDefinition;
  readonly deps: WorkerDeps;
}

function harness(options: { failOnAttempts?: number[] } = {}): Harness {
  const runs: Harness["runs"] = [];
  const auditEvents: WriteAuditLogEntryParams[] = [];

  const job: AnyJobDefinition = {
    name: LOOP_QUEUE,
    description: "loop test job",
    audit: { action: LOOP_AUDIT_ACTION, category: "data_ops", resourceType: "loop_test" },
    handle: async (context) => {
      runs.push({ attempt: context.job.attempt, jobId: context.job.id });
      if (options.failOnAttempts?.includes(runs.length)) {
        throw new Error(`forced failure on attempt ${runs.length}`);
      }
      return { ran: true, attempt: context.job.attempt };
    },
  };

  return {
    runs,
    auditEvents,
    job,
    deps: {
      // The counting handler never touches the database, and the audit write goes to the capture
      // above, so no `Db` is needed — `{}` keeps the type honest without pretending to a transaction.
      db: {} as unknown as Db,
      audit: async (params) => {
        auditEvents.push(params);
      },
    },
  };
}

/** Poll until `check` says yes (or the clock runs out) — the loop's only synchronisation. */
async function waitFor(
  what: string,
  timeoutMs: number,
  check: () => boolean | Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline)
      throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Rows in `information_schema` for one schema — how this file checks what pg-boss installed. */
async function tablesIn(schema: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
      [schema],
    );
    return rows.map((row: { table_name: string }) => row.table_name);
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasDb())("queue loop against a live pg-boss", () => {
  beforeAll(async () => {
    boss = new PgBoss({
      schema: testSchema,
      connectionString: url,
      // Defaults are 30s and 5s; a test that waits a minute for a cron tick is a test nobody runs.
      cronMonitorIntervalSeconds: 1,
      cronWorkerIntervalSeconds: 1,
    });
    boss.on("error", (error: unknown) => {
      console.error("[test] pg-boss error:", String(error));
    });
    await boss.start();
  }, 60_000);

  afterAll(async () => {
    await boss?.stop({ graceful: true, timeout: 2_000 });

    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      await client.end();
    }
  }, 60_000);

  /**
   * One worker and one schedule per test: `offWork` drains whatever is attached (a no-op when
   * nothing is) and `removeSchedules` clears the cron, so no test can catch a leftover worker from
   * the one before it and read someone else's attempt counter.
   */
  beforeEach(async () => {
    await boss.offWork(LOOP_QUEUE);
    await removeSchedules(boss, [LOOP_QUEUE]);
  });

  /** Attach this test's harness and hand back its job id once sent. */
  async function run(local: Harness, data: object | null = null, options = {}): Promise<string> {
    await ensureQueues(boss, [local.job]);
    await attachWorkers(boss, local.deps, [local.job], { pollingIntervalSeconds: 0.5 });
    const jobId = await boss.send(LOOP_QUEUE, data, options);
    expect(jobId).toBeTruthy();
    return String(jobId);
  }

  test("start() installs the queue schema in its own namespace, and `public` stays untouched", async () => {
    const installed = await tablesIn(testSchema);
    expect(installed).toContain("job");
    expect(installed).toContain("schedule");
    expect(installed).toContain("version");
    // The rule NWB-P0-005 wrote: pg-boss's tables never enter the application schema, so drizzle
    // cannot see them and `db:generate` can never propose a migration that drops them.
    expect(await tablesIn("public")).not.toContain("job");
    expect(await boss.schemaVersion()).toBeGreaterThan(0);
  });

  test("a sent job is claimed by the registered worker and completes", async () => {
    const local = harness();
    const jobId = await run(local, { hello: "world" });

    await waitFor("the worker to claim the job", 15_000, () => local.runs.length >= 1);

    expect(local.runs[0]).toEqual({ attempt: 1, jobId });
    expect(local.auditEvents).toHaveLength(1);
    expect(local.auditEvents[0]).toMatchObject({ action: LOOP_AUDIT_ACTION, severity: "info" });
    expect(local.auditEvents[0]?.metadata).toMatchObject({ jobId, queue: LOOP_QUEUE });
    expect(local.auditEvents[0]?.afterState).toEqual({ ran: true, attempt: 1 });

    // Polled, not read once: the handler returning and the job being *settled* are two instants,
    // with the wrapper's audit write in between them. That gap is the at-least-once seam, and it
    // is exactly why every handler here has to be safe to run twice.
    let settled: { state?: string | undefined; data?: unknown } = {};
    await waitFor("the job to be recorded as completed", 10_000, async () => {
      const [row] = await boss.findJobs(LOOP_QUEUE, { id: jobId });
      settled = { state: row?.state, data: row?.data };
      return row?.state === "completed";
    });
    expect(settled.state).toBe("completed");
    expect(settled.data).toEqual({ hello: "world" });
  }, 30_000);

  test("a failing job is retried with backoff, and each attempt audits its own outcome", async () => {
    const local = harness({ failOnAttempts: [1] });
    await run(local, null, { retryLimit: 2, retryDelay: 1, retryBackoff: true });

    await waitFor("the retry to run", 20_000, () => local.runs.length >= 2);

    // Attempt 1 failed with a retry still owed (warning), attempt 2 succeeded (info). The retry
    // count, the delay, and the backoff all belong to pg-boss; what this pins is that the wrapper
    // neither swallowed the error (which would have completed the job) nor double-counted it.
    expect(local.runs.map((run) => run.attempt)).toEqual([1, 2]);
    expect(local.auditEvents.map((event) => event.severity)).toEqual(["warning", "info"]);
    expect(local.auditEvents[0]?.reason).toContain("forced failure on attempt 1");
    expect(local.auditEvents[0]?.changes).toMatchObject({ attempt: 1 });
    expect(local.auditEvents[1]?.afterState).toEqual({ ran: true, attempt: 2 });
  }, 30_000);

  test("a job that fails every attempt ends failed — and the audit trail escalates", async () => {
    const local = harness({ failOnAttempts: [1, 2] });
    const jobId = await run(local, null, { retryLimit: 1, retryDelay: 1 });

    await waitFor("both attempts to run", 20_000, () => local.runs.length >= 2);

    // Read the library's own row rather than infer it from what ran: `failed` *is* the assertion
    // that the wrapper's rethrow reached pg-boss and the budget was then spent.
    let row: { state?: string | undefined; retryCount?: number | undefined } = {};
    await waitFor("the job to be recorded as failed", 10_000, async () => {
      const found = (await boss.findJobs(LOOP_QUEUE, { id: jobId }))[0];
      row = { state: found?.state, retryCount: found?.retryCount };
      return found?.state === "failed";
    });
    expect(row.state).toBe("failed");
    expect(row.retryCount).toBe(1);

    // The last attempt spends the budget, so the wrapper escalates: warning → critical. That is the
    // row an alert should read, and the reason a nightly purge cannot stop silently.
    expect(local.auditEvents.map((event) => event.severity)).toEqual(["warning", "critical"]);
  }, 40_000);

  test("applySchedules converges: two calls, one schedule row, with tz and catch-up policy", async () => {
    const local = harness();
    await ensureQueues(boss, [local.job]);

    const schedules = [
      { job: LOOP_QUEUE, cron: "0 2 * * *", tz: "UTC", data: null, missed: "once" as const },
    ];

    await applySchedules(boss, schedules);
    await applySchedules(boss, schedules);

    const rows = await boss.getSchedules(LOOP_QUEUE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cron: "0 2 * * *", timezone: "UTC" });
    expect(rows[0]?.options?.missed).toBe("once");

    await removeSchedules(boss, [LOOP_QUEUE]);
    expect(await boss.getSchedules(LOOP_QUEUE)).toHaveLength(0);
  }, 30_000);

  test("a cron tick enqueues on its own and the worker runs it, without anything sending", async () => {
    const local = harness();
    await ensureQueues(boss, [local.job]);
    await attachWorkers(boss, local.deps, [local.job], { pollingIntervalSeconds: 0.5 });
    // Every second, so the test waits a couple of ticks rather than until 02:00.
    await applySchedules(boss, [
      { job: LOOP_QUEUE, cron: "* * * * * *", tz: "UTC", data: null, missed: "once" as const },
    ]);

    try {
      // Nobody called `send()` in this test: the row exists because the cron pass made it — the
      // acceptance criterion in plan §5 P1, read literally.
      await waitFor("the cron pass to fire", 25_000, () => local.runs.length >= 1);
      expect(local.runs[0]?.attempt).toBe(1);
      // Asserted, not implied: a run that came from the schedule still went through the wrapper, so
      // it wrote an audit row naming the queue and the 1-based attempt.
      expect(local.auditEvents[0]).toMatchObject({
        action: LOOP_AUDIT_ACTION,
        severity: "info",
        metadata: { queue: LOOP_QUEUE, attempt: 1 },
      });
    } finally {
      await removeSchedules(boss, [LOOP_QUEUE]);
    }

    // pg-boss files each occurrence into a 60s slot (`OCCURRENCE_WINDOW_SECONDS`, timekeeper.js), so
    // a schedule finer than a slot cannot double-enqueue the same occurrence — the guarantee behind
    // "run it nightly and stop worrying about a restart mid-hour", and the reason `scheduler.ts`
    // invents no deduplication key of its own. Cited from the library rather than counted here:
    // counting would race the slot boundary and flake for the right reason.
  }, 60_000);
});

/**
 * The process-wide singleton `src/index.ts` and `bun run queue:worker` share. It gets its own
 * schema for the same reason the loop suite does, and it runs in its own describe so it never
 * competes with the loop tests for the client.
 */
const lifecycleSchema = `${testSchema}_life`;

describe.skipIf(!hasDb())("queue client lifecycle", () => {
  beforeEach(async () => {
    await stopQueue();
  });

  afterAll(async () => {
    await stopQueue();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${lifecycleSchema} CASCADE`);
    } finally {
      await client.end();
    }
  });

  test("startQueue starts once, and every caller gets the same client", async () => {
    const first = await startQueue({ schema: lifecycleSchema });
    const second = await startQueue({ schema: "definitely_not_a_second_schema" });

    expect(second).toBe(first);
    expect(isQueueStarted()).toBe(true);
    expect(getQueue()).toBe(first);

    await stopQueue();
    expect(getQueue()).toBeUndefined();
    expect(isQueueStarted()).toBe(false);
    // Stopping twice is the real shutdown path: `SIGTERM` racing an explicit `worker.stop()`.
    await stopQueue();
  }, 30_000);

  test("enqueueJob is the one way a caller puts work on a queue", async () => {
    const client = await startQueue({ schema: lifecycleSchema });
    await client.createQueue(LOOP_QUEUE, { retryLimit: 1 });
    await client.offWork(LOOP_QUEUE);

    const jobId = await enqueueJob(client, LOOP_QUEUE, { via: "singleton" });
    expect(jobId).toMatch(/^[0-9a-f-]{36}$/);

    const [row] = await client.findJobs(LOOP_QUEUE, { id: String(jobId) });
    expect(row?.data).toEqual({ via: "singleton" });

    // An unknown queue fails loudly here rather than dropping the job: pg-boss v12 will not invent
    // a queue on `send`, and this is the call a later domain ticket makes from a request path.
    await expect(enqueueJob(client, "not.a.queue" as never)).rejects.toThrow(/does not exist/);
  }, 30_000);

  test("the client is built from config, and nothing connects until start()", async () => {
    expect(createQueueClient({ schema: lifecycleSchema })).toBeInstanceOf(PgBoss);
    // The point of the split: a test run, or an API started with the queue off, never opens a pool.
    expect(getQueue()).toBeUndefined();
    expect(isQueueStarted()).toBe(false);
  });
});
