/**
 * Scheduler — the cron side of the queue runtime (NWB-P1-001, ADR-028).
 *
 * pg-boss persists schedules in its own schema, so a schedule registered once survives restarts:
 * `applySchedules()` is a **converge**, not an init. Running it on every process start is how a
 * changed cron takes effect, and it is safe to run twice — `schedule(name, cron, …)` replaces the
 * row for `(name, key)` rather than adding one — verified against 12.33.2 and pinned twice:
 * `src/tests/queue/loop.test.ts` ("applying the schedule set twice converges rather than duplicates"),
 * and every other test file relies on it, since `beforeEach` converges the shared schedule rows off
 * `QUEUE_SCHEDULE_DEFAULTS` rather than trying to undo them.
 *
 * **A double tick is already impossible, so no app-level guard belongs here.** The plan's idempotency
 * clause reached for `singletonKey` / `singletonNextSlot` (and `docs/technical/ADRs.md` §22 adds
 * `singletonSeconds`); those are not a dedupe of the same tick. `singletonNextSlot` *delays* a second
 * occurrence into the next slot instead of dropping it, and `singletonSeconds` throttles a named key
 * for N seconds — which would silently swallow an operator's manual retry, the very thing the CLI is
 * for. pg-boss guarantees the property at the storage layer: occurrences are filed into a slot bucket
 * keyed `(name, seconds, minutes, hours, day, month, year)`
 * (`node_modules/pg-boss/dist/plans.js`, `occurrenceInsertions`) whose insert is
 * `on conflict do nothing` under unique index `job_i4` (`manager.js`), so a cron that ticks twice in a
 * minute produces one job. The worker-side halves are `startQueue`'s single supervisor per process and
 * one queue per job name at the default `workerConcurrency: 1` — do not set `maxWorkerConcurrency`
 * higher without re-reading why three queues and three slots currently match.
 *
 * The API process, a dedicated worker process, or both can own this responsibility; see
 * `QUEUE_SCHEDULER_ENABLED` in `src/lib/config.ts`. ADR-007 says one deployable, so by default
 * `src/index.ts` does it.
 */
import { type Config, getConfig } from "./config";
import { QUEUE_JOB_NAMES, QUEUE_JOBS, type QueueClient, type QueueJobName } from "./queue";

/** A persisted cron schedule for one queue. */
export interface JobSchedule {
  readonly job: QueueJobName;
  /** Five-field cron, in `tz`. Validated for shape at config load; pg-boss parses it for real. */
  readonly cron: string;
  /** IANA zone the cron fields are read in — never the server's local time. */
  readonly tz: string;
  /** Payload handed to the handler. `null` means "the scheduled occurrence itself, nothing else". */
  readonly data: object | null;
  /**
   * What to do about occurrences that came due while no cron pass ran — a deploy, an outage.
   * `"once"` sends one job for the most recent miss. `skip` would silently drop a night of
   * retention enforcement, and a night nobody purged is a compliance clock that stopped.
   */
  readonly missed: "skip" | "once";
}

/**
 * The night's running order, one hour apart and anchored at 02:00 UTC so it lands in Lagos'
 * low-traffic window (03:00 WAT) without depending on the server's timezone.
 *
 * The order is not cosmetic:
 *
 * 1. **rate-limit reclamation first** — cheapest, no dependents, and it keeps the hot table small
 *    for everything after it.
 * 2. **organizations before accounts** — `organizations.owner_id` is `NOT NULL` with a restrictive
 *    FK (F-25 / DEC-D16). An account that still owns a live or merely soft-deleted organization
 *    cannot be hard-deleted, so the org purge has to clear that reference first for the same
 *    night's erasure to land.
 */
export const QUEUE_SCHEDULE_DEFAULTS: Record<QueueJobName, string> = {
  [QUEUE_JOBS.rateLimitReclaim]: "0 2 * * *",
  [QUEUE_JOBS.purgeExpiredOrganizations]: "15 2 * * *",
  [QUEUE_JOBS.purgeExpiredAccounts]: "45 2 * * *",
};

/**
 * Read the schedules out of validated config. Every one of them is overridable per deployment
 * (`QUEUE_CRON_*`) because "nightly" means different hours to different operators; the job set
 * itself is not, deliberately — a queue with no worker is a silent hole, so what can run is
 * fixed in `QUEUE_JOBS`.
 */
export function resolveSchedules(config: Config = getConfig()): JobSchedule[] {
  const tz = config.QUEUE_TIMEZONE;
  return [
    {
      job: QUEUE_JOBS.rateLimitReclaim,
      cron:
        config.QUEUE_CRON_RATE_LIMIT_RECLAIM ??
        QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.rateLimitReclaim],
      tz,
      data: null,
      missed: "once",
    },
    {
      job: QUEUE_JOBS.purgeExpiredOrganizations,
      cron:
        config.QUEUE_CRON_PURGE_EXPIRED_ORGANIZATIONS ??
        QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.purgeExpiredOrganizations],
      tz,
      data: null,
      missed: "once",
    },
    {
      job: QUEUE_JOBS.purgeExpiredAccounts,
      cron:
        config.QUEUE_CRON_PURGE_EXPIRED_ACCOUNTS ??
        QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.purgeExpiredAccounts],
      tz,
      data: null,
      missed: "once",
    },
  ];
}

/**
 * Converge the persisted schedules onto `schedules`, then return them.
 *
 * Call this **after** `ensureQueues()`: a schedule whose queue does not exist yet fires into
 * `Queue <name> does not exist` inside pg-boss's own cron pass — loud, but at 02:00, in a log
 * nobody reads. `startWorkerRuntime()` orders this correctly, including when the worker half of
 * the runtime is switched off.
 */
export async function applySchedules(
  boss: QueueClient,
  schedules: readonly JobSchedule[] = resolveSchedules(),
): Promise<readonly JobSchedule[]> {
  for (const entry of schedules) {
    await boss.schedule(entry.job, entry.cron, entry.data, {
      tz: entry.tz,
      missed: entry.missed,
    });
  }
  return schedules;
}

/**
 * Remove schedules — the teardown path for tests and for an operator pausing the clock without
 * killing the worker. Deliberately does **not** delete queued jobs: those are work already promised.
 */
export async function removeSchedules(
  boss: QueueClient,
  jobs: readonly QueueJobName[] = QUEUE_JOB_NAMES as readonly QueueJobName[],
): Promise<void> {
  for (const job of jobs) {
    await boss.unschedule(job);
  }
}
