import { startMaintenanceWorker } from "./jobs";
import { loadConfig } from "./lib/config";
import { closeDb, createDb } from "./lib/db";
import { describeError } from "./lib/errors";
import { createAppWithDb } from "./server";

const config = loadConfig();

const db = createDb();
const app = createAppWithDb({ db, corsOrigins: config.CORS_ORIGIN });

const server = Bun.serve({
  fetch: app.fetch,
  port: config.PORT,
});

/**
 * Queue runtime — workers and scheduler, in this process (ADR-007 · NWB-P1-001).
 *
 * ADR-007 is one deployable with two entry points, and ADR-028 put the workers in the same
 * process to keep a single self-hosted VPS from having to orchestrate a third. Which half runs
 * here is config, not code: `QUEUE_WORKER_ENABLED` / `QUEUE_SCHEDULER_ENABLED` (set both false and
 * this becomes an API-only process; `bun run queue:worker` is the worker-only mirror).
 *
 * **A queue failure does not stop the API.** The request path has no queue dependency — nothing in
 * `src/server/**` enqueues yet — so a pg-boss that cannot install its schema must not take
 * authentication and org management down with it. The runtime therefore retries nothing here and
 * promises nothing here; it reports and steps aside. The dedicated worker process takes the
 * opposite stance on purpose (`src/scripts/queue-worker.ts` exits non-zero), so a deployment that
 * cares about job latency runs it under a supervisor and a deployment that does not can leave it to
 * the API process.
 */
const worker = await startMaintenanceWorker({ db, config }).catch((error: unknown) => {
  console.error(`[queue] WORKER NOT STARTED — API continuing without it: ${describeError(error)}`);
  return undefined;
});

console.log(`Server running on http://localhost:${config.PORT}`);
if (worker) {
  console.log(
    `[queue] ${worker.jobs.length} queue(s) active (worker: ${config.QUEUE_WORKER_ENABLED ? "on" : "off"}, ` +
      `scheduler: ${config.QUEUE_SCHEDULER_ENABLED ? "on" : "off"})`,
  );
}

process.on("SIGTERM", async () => {
  server.stop();
  // Stop the queue before closing the pool: `stop()` waits for a handler that is mid-purge, and a
  // pool closed underneath it turns an orderly shutdown into a stack of connection errors.
  await worker?.stop();
  await closeDb();
  process.exit(0);
});
