/**
 * Dedicated worker process — `bun run queue:worker` (NWB-P1-001).
 *
 * The same runtime `src/index.ts` starts alongside the API, minus the HTTP server. ADR-028 chose
 * pg-boss partly so that splitting the two is a deployment change rather than a rewrite; this file
 * is the second half of that claim — proof that the split needs no new wiring, and that a
 * worker-only process can be started before the API is reachable at all.
 *
 * Unlike `src/index.ts`, this process **exits non-zero** when the queue cannot start: the queue is
 * its entire job, and a supervisor should restart it rather than admire a healthy-looking idle.
 */

import { startMaintenanceWorker } from "../jobs";
import { getConfig, loadConfig } from "../lib/config";
import { closeDb, createDb } from "../lib/db";
import { describeError } from "../lib/errors";
import type { WorkerHandle } from "../lib/worker";

loadConfig();
const config = getConfig();

const db = createDb();
let worker: WorkerHandle | undefined;
let stopping: Promise<void> | undefined;

/** Idempotent: a supervisor that sends SIGTERM then SIGINT must not drain twice. */
async function shutdown(signal: string): Promise<void> {
  if (stopping) return stopping;
  stopping = (async () => {
    console.log(`[queue:worker] ${signal} — draining in-flight jobs`);
    // Graceful by default: a purge interrupted mid-statement would have committed nothing anyway,
    // but letting handlers finish means the job is *completed* rather than retried, so the next
    // tick is a no-op instead of a re-run.
    await worker?.stop();
    await closeDb();
  })();
  return stopping;
}

worker = await startMaintenanceWorker({ db, config }).catch((error: unknown) => {
  console.error(`[queue:worker] failed to start: ${describeError(error)}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});

if (!worker) {
  console.log("[queue:worker] QUEUE_ENABLED=false — no jobs registered, exiting");
  await closeDb();
  process.exit(0);
}

const schedules = await worker.boss.getSchedules();
console.log(
  `[queue:worker] ${worker.jobs.length} queue(s): ${worker.jobs.map((job) => job.name).join(", ")}`,
);
console.log(
  `[queue:worker] worker: ${config.QUEUE_WORKER_ENABLED ? "on" : "off"} · ` +
    `scheduler: ${config.QUEUE_SCHEDULER_ENABLED ? "on" : "off"} · ` +
    `schema: ${config.QUEUE_SCHEMA} @ ${config.QUEUE_TIMEZONE}`,
);
for (const schedule of schedules) {
  console.log(`[queue:worker] schedule ${schedule.name} "${schedule.cron}" (${schedule.timezone})`);
}
if (schedules.length === 0 && !config.QUEUE_SCHEDULER_ENABLED) {
  console.log("[queue:worker] no schedules — jobs will run only when something sends them");
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM").then(() => process.exit(0));
});
process.on("SIGINT", () => {
  void shutdown("SIGINT").then(() => process.exit(0));
});
