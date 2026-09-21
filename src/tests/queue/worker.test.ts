/**
 * The worker wrapper — what every job in the system inherits (NWB-P1-001).
 *
 * No database here on purpose. The wrapper's contract is about *ordering and outcomes*: audit
 * written on both paths, the handler's error rethrown so pg-boss retries rather than completing, a
 * broken audit sink never changing the job's fate. A fake boss makes all of that assertable
 * exactly, including the cases a real queue will not reproduce on demand (the final attempt of a
 * three-retry job, an audit insert that fails).
 *
 * The real library, the real cron, and a real retry are exercised against PostgreSQL in
 * `loop.test.ts`; the real audit insert is exercised in `jobs.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import type { Db } from "../../lib/db";
import { QUEUE_JOBS, type QueueClient, type QueueJobName } from "../../lib/queue";
import {
  type AnyJobDefinition,
  attemptOf,
  type JobAttempt,
  registerJobs,
  runJobGuarded,
  startWorkerRuntime,
  type WorkerDeps,
} from "../../lib/worker";
import type { WriteAuditLogEntryParams } from "../../services/audit";

interface FakeBoss {
  readonly queues: { name: string; options: Record<string, unknown> }[];
  readonly workers: Map<string, (jobs: object[]) => Promise<unknown>>;
  readonly workOptions: Map<string, Record<string, unknown>>;
  readonly offWorked: string[];
  readonly scheduled: { name: string; cron: string; options: Record<string, unknown> }[];
  readonly unscheduled: string[];
  readonly boss: QueueClient;
}

function createFakeBoss(): FakeBoss {
  const queues: FakeBoss["queues"] = [];
  const workers = new Map<string, (jobs: object[]) => Promise<unknown>>();
  const workOptions = new Map<string, Record<string, unknown>>();
  const offWorked: string[] = [];
  const scheduled: FakeBoss["scheduled"] = [];
  const unscheduled: string[] = [];

  const fake = {
    queues,
    workers,
    workOptions,
    offWorked,
    scheduled,
    unscheduled,
    async start() {},
    async stop() {},
    async createQueue(name: string, options: Record<string, unknown> = {}) {
      queues.push({ name, options });
    },
    async work(
      name: string,
      options: Record<string, unknown>,
      handler: (jobs: object[]) => Promise<unknown>,
    ) {
      workers.set(name, handler);
      workOptions.set(name, options);
      return `worker-${name}`;
    },
    async offWork(name: string) {
      offWorked.push(name);
      workers.delete(name);
    },
    async schedule(
      name: string,
      cron: string,
      _data: unknown,
      options: Record<string, unknown> = {},
    ) {
      scheduled.push({ name, cron, options });
    },
    async unschedule(name: string) {
      unscheduled.push(name);
    },
    async getSchedules() {
      return scheduled.map((entry) => ({ name: entry.name, cron: entry.cron }));
    },
    on() {},
  };

  return { ...fake, boss: fake as unknown as QueueClient };
}

function fakeDefinition(
  overrides: Partial<AnyJobDefinition> & { name?: QueueJobName } = {},
): AnyJobDefinition {
  return {
    name: overrides.name ?? QUEUE_JOBS.rateLimitReclaim,
    description: "test job",
    audit: { action: "things.done", category: "data_ops", resourceType: "thing" },
    handle: async () => ({ worked: true }),
    ...overrides,
  };
}

function fakeDeps(events: WriteAuditLogEntryParams[]): WorkerDeps {
  return {
    db: { fake: "db" } as unknown as Db,
    audit: async (params) => {
      events.push(params);
    },
  };
}

const attempt = (overrides: Partial<JobAttempt> = {}): JobAttempt => ({
  id: "job-1",
  attempt: 1,
  ...overrides,
});

describe("registerJobs", () => {
  test("creates each queue with the defaults merged under the job's own policy", async () => {
    const fake = createFakeBoss();
    const job = fakeDefinition({ policy: { expireInSeconds: 300 } });

    await registerJobs(fake.boss, fakeDeps([]), [job]);

    expect(fake.queues).toHaveLength(1);
    expect(fake.queues[0]?.name).toBe(job.name);
    expect(fake.queues[0]?.options).toMatchObject({
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 300,
    });
  });

  test("attaches one worker per queue, one job at a time, with metadata for the attempt counter", async () => {
    const fake = createFakeBoss();
    const job = fakeDefinition();

    await registerJobs(fake.boss, fakeDeps([]), [job]);

    expect(fake.workers.has(job.name)).toBe(true);
    expect(fake.workOptions.get(job.name)).toMatchObject({
      includeMetadata: true,
      batchSize: 1,
    });
  });

  test("refuses to poll faster than pg-boss's own floor", async () => {
    const fake = createFakeBoss();
    await registerJobs(fake.boss, fakeDeps([]), [fakeDefinition()], {
      pollingIntervalSeconds: 0.1,
    });
    expect(fake.workOptions.get(QUEUE_JOBS.rateLimitReclaim)?.pollingIntervalSeconds).toBe(0.5);

    const fake2 = createFakeBoss();
    await registerJobs(fake2.boss, fakeDeps([]), [fakeDefinition()], { pollingIntervalSeconds: 7 });
    expect(fake2.workOptions.get(QUEUE_JOBS.rateLimitReclaim)?.pollingIntervalSeconds).toBe(7);
  });

  test("a rejected definition set never reaches the database", async () => {
    const fake = createFakeBoss();
    await expect(
      registerJobs(fake.boss, fakeDeps([]), [fakeDefinition(), fakeDefinition()]),
    ).rejects.toThrow(/duplicate job definition/);
    expect(fake.queues).toHaveLength(0);
  });
});

describe("the executed job", () => {
  test("success writes one audit event, system-attributed, carrying the handler's result", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const fake = createFakeBoss();
    const deps = fakeDeps(events);
    const job = fakeDefinition({ handle: async () => ({ deleted: 3 }) });

    await registerJobs(fake.boss, deps, [job]);
    const handler = fake.workers.get(job.name)!;
    await handler([{ id: "job-9", data: null, retryCount: 0, retryLimit: 3 }]);

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event).toMatchObject({
      module: "core",
      actorType: "system",
      action: "things.done",
      category: "data_ops",
      resourceType: "thing",
      severity: "info",
    });
    // The wrapper hands the job the injected handle, so audit writes obey the same transaction
    // semantics as every other write in the app (see src/lib/transaction.ts).
    expect(event.db).toBe(deps.db);
    expect(event.afterState).toEqual({ deleted: 3 });
    expect(event.metadata).toMatchObject({
      queue: job.name,
      jobId: "job-9",
      attempt: 1,
      retryLimit: 3,
    });
    // Cross-tenant by design: one run sweeps every organization, so naming one would be a lie.
    expect(event.organizationId).toBeUndefined();
  });

  test("a handler that reports nothing still leaves a row, so a no-op run is evidence the loop turned", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const fake = createFakeBoss();
    await registerJobs(fake.boss, fakeDeps(events), [
      fakeDefinition({ handle: async () => undefined }),
    ]);

    await fake.workers.get(QUEUE_JOBS.rateLimitReclaim)!([{ id: "job-1", data: null }]);

    expect(events[0]?.afterState).toEqual({ ok: true });
  });

  test("the handler sees the job payload and a 1-based attempt number", async () => {
    const seen: unknown[] = [];
    const fake = createFakeBoss();
    const job = fakeDefinition({
      handle: async (context, data) => {
        seen.push({ data, job: context.job });
        return {};
      },
    });

    await registerJobs(fake.boss, fakeDeps([]), [job]);
    await fake.workers.get(job.name)!([
      { id: "job-2", data: { graceMs: 0 }, retryCount: 2, retryLimit: 5 },
    ]);

    // The payload arrives verbatim, and pg-boss's `retryCount` (retries *so far*) reads as the
    // third attempt — the number that appears in the audit row an investigator follows.
    expect(seen).toEqual([
      { data: { graceMs: 0 }, job: { id: "job-2", attempt: 3, retryCount: 2, retryLimit: 5 } },
    ]);
  });

  test("every job in a batch runs, and the batch keeps its per-job order", async () => {
    const ran: string[] = [];
    const fake = createFakeBoss();
    const job = fakeDefinition({
      handle: async (_ctx, data) => {
        ran.push(String((data as { n: number }).n));
        return {};
      },
    });

    await registerJobs(fake.boss, fakeDeps([]), [job]);
    await fake.workers.get(job.name)!([
      { id: "a", data: { n: 1 } },
      { id: "b", data: { n: 2 } },
    ]);

    expect(ran).toEqual(["1", "2"]);
  });
});

describe("failure handling", () => {
  test("a retry is still owed: warn, and rethrow so pg-boss does the retrying", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const fake = createFakeBoss();
    const job = fakeDefinition({
      handle: async () => {
        throw new Error("connection lost");
      },
    });

    await registerJobs(fake.boss, fakeDeps(events), [job]);
    await expect(
      fake.workers.get(job.name)!([{ id: "job-1", data: null, retryCount: 0, retryLimit: 3 }]),
    ).rejects.toThrow("connection lost");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ severity: "warning", actorType: "system", module: "core" });
    expect(events[0]?.reason).toContain("connection lost");
    expect(events[0]?.changes).toEqual({ error: "connection lost", attempt: 1 });
    // Nothing in the wrapper turns a thrown handler error into a completion: swallowing it here
    // would mark the purge successful and the data would simply never be deleted.
  });

  test("the last attempt spent is an alarm, not a warning", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const fake = createFakeBoss();
    const job = fakeDefinition({
      handle: async () => {
        throw new Error("still broken");
      },
    });

    await registerJobs(fake.boss, fakeDeps(events), [job]);
    await expect(
      fake.workers.get(job.name)!([{ id: "job-1", data: null, retryCount: 3, retryLimit: 3 }]),
    ).rejects.toThrow("still broken");

    expect(events[0]?.severity).toBe("critical");
  });

  test("a manual run with no queue budget is reported as terminal", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const job = fakeDefinition({
      handle: async () => {
        throw new Error("no such table");
      },
    });

    await expect(runJobGuarded(job, fakeDeps(events), attempt(), null)).rejects.toThrow(
      "no such table",
    );

    expect(events[0]?.severity).toBe("critical");
    expect(events[0]?.metadata).toEqual({ queue: job.name, jobId: "job-1", attempt: 1 });
  });

  test("an audit write that fails never masks the handler's outcome", async () => {
    const stderrLines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      stderrLines.push(args.join(" "));
    };
    try {
      const deps: WorkerDeps = {
        db: {} as unknown as Db,
        audit: async () => {
          throw new Error("audit table unavailable");
        },
      };
      const job = fakeDefinition({ handle: async () => ({ deleted: 1 }) });

      await expect(runJobGuarded(job, deps, attempt(), null)).resolves.toEqual({ deleted: 1 });

      expect(stderrLines).toHaveLength(1);
      expect(stderrLines[0]).toContain("audit table unavailable");
    } finally {
      console.error = original;
    }
  });

  test("…and on the failure path the handler's own error still propagates", async () => {
    const deps: WorkerDeps = {
      db: {} as unknown as Db,
      audit: async () => {
        throw new Error("audit insert rejected");
      },
    };
    const job = fakeDefinition({
      handle: async () => {
        throw new Error("the real problem");
      },
    });

    await expect(runJobGuarded(job, deps, attempt(), null)).rejects.toThrow("the real problem");
  });
});

describe("startWorkerRuntime", () => {
  test("registers, converges the schedule, and stops without clearing it", async () => {
    const fake = createFakeBoss();
    const events: WriteAuditLogEntryParams[] = [];

    const handle = await startWorkerRuntime(fakeDeps(events), [fakeDefinition()], {
      boss: fake.boss,
      requireCompleteJobSet: false,
      withSchedules: true,
      schedules: [
        {
          job: QUEUE_JOBS.rateLimitReclaim,
          cron: "0 2 * * *",
          tz: "UTC",
          data: null,
          missed: "once",
        },
      ],
      pollingIntervalSeconds: 2,
    });

    expect(fake.scheduled).toHaveLength(1);
    expect(fake.scheduled[0]?.options).toMatchObject({ tz: "UTC", missed: "once" });

    await handle.stop();

    expect(fake.offWorked).toEqual([QUEUE_JOBS.rateLimitReclaim]);
    // Schedules persist in the database so they survive a deploy. Clearing them on the way out
    // would mean "no nightly work until someone starts a process with the scheduler on".
    expect(fake.unscheduled).toEqual([]);
    expect(handle.ownsClient).toBe(false);
  });

  test("worker and scheduler can be switched off independently — the ADR-007 split", async () => {
    const fake = createFakeBoss();

    await startWorkerRuntime(fakeDeps([]), [fakeDefinition()], {
      boss: fake.boss,
      requireCompleteJobSet: false,
      withWorker: false,
      withSchedules: false,
    });

    expect(fake.workers.size).toBe(0);
    expect(fake.scheduled).toHaveLength(0);
    // The queue row still exists, so a manual `queue:run` in another process can still enqueue.
    expect(fake.queues).toHaveLength(1);
  });

  test("refuses a job set that leaves a declared queue unmanned", async () => {
    const fake = createFakeBoss();
    await expect(
      startWorkerRuntime(fakeDeps([]), [fakeDefinition()], { boss: fake.boss }),
    ).rejects.toThrow(/queues with a name and no job definition/);
  });
});

describe("attemptOf", () => {
  test("reads pg-boss's retry counter as the attempt number", () => {
    expect(attemptOf({ id: "j", retryCount: 0, retryLimit: 3 })).toEqual({
      id: "j",
      attempt: 1,
      retryCount: 0,
      retryLimit: 3,
    });
    expect(attemptOf({ id: "j", retryCount: 2, retryLimit: 3 }).attempt).toBe(3);
  });

  test("tolerates a job with no metadata at all", () => {
    expect(attemptOf({ id: "j" })).toEqual({
      id: "j",
      attempt: 1,
      retryCount: undefined,
      retryLimit: undefined,
    });
  });
});
