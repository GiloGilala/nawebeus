/**
 * Readiness probe for `GET /api/health` (NWB-P1-012).
 *
 * The route used to answer a static `{ status: "ok" }` — 200 with the database
 * down, which is a health check that cannot fail. It now verifies what the
 * process actually depends on:
 *
 * - **database** — one `SELECT 1`. This is the hard dependency: with it down,
 *   `authMiddleware` cannot validate a principal and every protected route is
 *   dead, so a failure is `status: "error"` and **503**. `createApp()` has no
 *   injected database and reports `not-configured` instead of pretending.
 * - **queue** — depth from `getQueueDepth()` (pg-boss over `QUEUE_JOB_NAMES`).
 *   Three legal states: `disabled` (no runtime — an API-only deployment per
 *   ADR-007, not a fault), `ok` (+ depth), and `error` (started but failing).
 *   A queue fault degrades the report but keeps the probe at **200**: the API
 *   serves without its queue by design — `src/index.ts` boots past a queue
 *   failure, and the one request-path enqueue (the email outbox) falls back to
 *   a direct send. Failing readiness on it would make the queue exactly the
 *   hostage ADR-007 refuses to create.
 *
 * Depth is summed across the app's own queues — enough for "is work piling
 * up?". Prometheus-grade per-queue metrics arrive with Phase 8 (roadmap §12);
 * Phase 2 makes the data exist.
 */
import type { Context } from "hono";
import type { Db } from "../lib/db";
import { describeError } from "../lib/errors";
import { getQueueDepth, type QueueDepth } from "../lib/queue";
import { success } from "../lib/response";

export interface DatabaseCheck {
  status: "ok" | "error" | "not-configured";
  latencyMs?: number;
  error?: string;
}

export interface QueueCheck {
  status: "ok" | "disabled" | "error";
  depth?: QueueDepth;
  error?: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "error";
  checks: {
    database: DatabaseCheck;
    queue: QueueCheck;
  };
}

export interface HealthDeps {
  /** Injected database; absent on the web-only `createApp()` entry. */
  db?: Db | undefined;
  /** Queue reading; defaults to the process-wide queue client. */
  queueDepth?: () => Promise<QueueDepth | undefined>;
}

/** The readiness ping. A plain string on purpose — drizzle executes it via `sql.raw`, and the test suite's no-op database recognizes it exactly. */
const PING = "SELECT 1";

/**
 * Evaluate both checks and fold them into one report. Split from the Hono
 * handler so the states (degraded / disabled / not-configured) can be pinned
 * without HTTP, and so `deps` can be injected by tests.
 */
export async function collectHealth(deps: HealthDeps): Promise<HealthReport> {
  const database: DatabaseCheck = deps.db
    ? await (async () => {
        const startedAt = Date.now();
        try {
          await deps.db?.execute(PING);
          return { status: "ok" as const, latencyMs: Date.now() - startedAt };
        } catch (error) {
          return { status: "error" as const, error: describeError(error) };
        }
      })()
    : { status: "not-configured" };

  const queue: QueueCheck = await (async () => {
    try {
      const depth = await (deps.queueDepth ?? getQueueDepth)();
      return depth ? { status: "ok" as const, depth } : { status: "disabled" as const };
    } catch (error) {
      return { status: "error" as const, error: describeError(error) };
    }
  })();

  const status: HealthReport["status"] =
    database.status === "error" ? "error" : queue.status === "error" ? "degraded" : "ok";

  return { status, checks: { database, queue } };
}

/**
 * Route handler factory: `createAppWithDb` passes its database, `createApp`
 * (web entry, no injected db) passes nothing.
 */
export function healthHandler(deps: HealthDeps) {
  return async (c: Context): Promise<Response> => {
    const report = await collectHealth(deps);
    c.status(report.status === "error" ? 503 : 200);
    return c.json(success(report));
  };
}
