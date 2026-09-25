/**
 * The application's job set — the composition root of the queue runtime (NWB-P1-001).
 *
 * Everything in `src/lib/` (queue, scheduler, worker) is generic machinery; this is the file that
 * says *which* jobs exist, which `Db` they write through, and which audit sink they use. Both
 * entrypoints (`src/index.ts` and `src/scripts/queue-worker.ts`) call {@link startMaintenanceWorker},
 * so the API and the dedicated worker process cannot drift into registering different jobs — which
 * matters, because a queue with a schedule and no worker fails silently and a queue with a worker
 * and no schedule is just idle.
 */

import { type Config, getConfig } from "../lib/config";
import { type Db, getDb } from "../lib/db";
import { QUEUE_JOB_NAMES, type QueueClient } from "../lib/queue";
import { resolveSchedules } from "../lib/scheduler";
import {
  type AnyJobDefinition,
  runJobGuarded,
  startWorkerRuntime,
  type WorkerDeps,
  type WorkerHandle,
} from "../lib/worker";
import { writeAuditLog } from "../services/audit";
import { approvalsExpireStaleJob } from "./approvals-expire-stale";
import { auditChainVerifyJob } from "./audit-chain-verify";
import { emailDeliverJob } from "./email-deliver";
import { impersonationExpireJob } from "./impersonation-expire";
import { purgeExpiredAccountsJob } from "./purge-expired-accounts";
import { purgeExpiredInvitationsJob } from "./purge-expired-invitations";
import { purgeExpiredOrganizationsJob } from "./purge-expired-organizations";
import { rateLimitReclaimJob } from "./rate-limit-reclaim";
import { retentionEnforceJob } from "./retention-enforce";
import { socialTokenRefreshJob } from "./social-token-refresh";

/**
 * Every job this application runs, in the order `QUEUE_JOB_NAMES` declares them: the scheduled
 * seven in the order the nightly schedule expects — reclamation, then organizations, then
 * invitations, then accounts, then retention enforcement, then chain verification (see
 * `src/lib/scheduler.ts` for why that order is load-bearing), with the hourly approval expiry
 * second, with the five-minute impersonation expiry (NWB-P1-011) third — both outside
 * the nightly chain — and then the on-demand queues, of which the email outbox
 * (NWB-P1-004) is the first: no cron, filled by `emailService.send()` from request paths.
 */
export const MAINTENANCE_JOBS: readonly AnyJobDefinition[] = [
  rateLimitReclaimJob,
  approvalsExpireStaleJob,
  impersonationExpireJob,
  socialTokenRefreshJob,
  purgeExpiredOrganizationsJob,
  purgeExpiredInvitationsJob,
  purgeExpiredAccountsJob,
  retentionEnforceJob,
  auditChainVerifyJob,
  emailDeliverJob,
];

/** The declared queue names, re-exported so a test can assert this list covers them. */
export const MAINTENANCE_JOB_NAMES = QUEUE_JOB_NAMES;

/** Look a job up by its queue name — what `bun run queue:run <name>` resolves before running it. */
export function findJob(name: string): AnyJobDefinition | undefined {
  return MAINTENANCE_JOBS.find((job) => job.name === name);
}

/**
 * Wire the injected capabilities the worker base needs: the app's database handle and the real
 * audit sink. The sink is passed as a function rather than imported by `src/lib/worker.ts` so
 * `src/lib/` keeps no runtime edge into `src/services/`.
 */
export function createWorkerDeps(db: Db = getDb()): WorkerDeps {
  return { db, audit: (params) => writeAuditLog(params) };
}

/**
 * Start the maintenance runtime for this process, exactly as config says.
 *
 * Returns `undefined` when the queue is switched off — the caller's job is then to do nothing, not
 * to fail, because an API that cannot start while a background worker is disabled is an API that
 * cannot be operated. A failure *inside* the runtime propagates: if pg-boss cannot install or
 * migrate its schema, an operator should hear about it at boot rather than at 02:00.
 */
export async function startMaintenanceWorker(
  options: { db?: Db; config?: Config; boss?: QueueClient } = {},
): Promise<WorkerHandle | undefined> {
  const config = options.config ?? getConfig();
  if (!config.QUEUE_ENABLED) return undefined;

  return startWorkerRuntime(createWorkerDeps(options.db ?? getDb()), MAINTENANCE_JOBS, {
    boss: options.boss,
    withWorker: config.QUEUE_WORKER_ENABLED,
    withSchedules: config.QUEUE_SCHEDULER_ENABLED,
    schedules: resolveSchedules(config),
    pollingIntervalSeconds: config.QUEUE_POLLING_INTERVAL_SECONDS,
  });
}

/**
 * Run one job right now, through the same wrapper the worker uses: no poller, no scheduler, and
 * the same audit events. `bun run queue:run <name> ['{…}']` is the operator path; the tests use
 * the same function, which is the only reason the manual path and the nightly one cannot disagree.
 */
export async function runMaintenanceJob(
  name: string,
  data: Record<string, unknown> | null = null,
  options: { db?: Db } = {},
): Promise<Record<string, unknown> | undefined> {
  const job = findJob(name);
  if (!job) {
    throw new Error(
      `[queue] unknown job "${name}". Known: ${MAINTENANCE_JOBS.map((entry) => entry.name).join(", ")}`,
    );
  }

  const deps = createWorkerDeps(options.db ?? getDb());
  return runJobGuarded(job, deps, { id: `manual-${crypto.randomUUID()}`, attempt: 1 }, data);
}
