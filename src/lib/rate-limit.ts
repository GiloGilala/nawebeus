import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { RateLimitError } from "@/lib/errors";

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

/**
 * Category budgets from tanstack-start.md §18. Server functions and Hono
 * routes share these so the two transports enforce identically.
 */
export const RATE_LIMITS = {
  authPerMinute: { max: 5, windowMs: 60_000 },
  authPerHour: { max: 20, windowMs: 3_600_000 },
  apiReadPerMinute: { max: 100, windowMs: 60_000 },
  apiWritePerMinute: { max: 50, windowMs: 60_000 },
  dsarPerDay: { max: 5, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export async function assertRateLimit(
  db: NodePgDatabase<Record<string, any>>,
  key: string,
  max: number,
  windowMs: number,
  message = "Too many requests. Try again later.",
): Promise<void> {
  if (await checkRateLimit(db, key, max, windowMs)) {
    throw new RateLimitError(message, Math.ceil(windowMs / 1000));
  }
}

/** Set after the first failure so a broken limiter warns once, not per request. */
let warnedAboutFailure = false;

/**
 * Default reclamation grace: buckets expire at their window end, but are only
 * deleted once they have been expired for this long (roadmap's specified
 * `interval '1 hour'`). The grace is belt-and-braces — deleting a
 * just-expired bucket would be harmless (the upsert recreates it on next use),
 * but it keeps recently-active keys observable for debugging.
 */
export const RATE_LIMIT_RECLAIM_GRACE_MS = 3_600_000;

/**
 * Fixed-window rate limit backed by the `rate_limits` table.
 * Returns true when the caller has exceeded the allowed number of attempts.
 *
 * Window-aware upsert (NWB-P0-013's specified statement, adopted here as a
 * prerequisite because the MFA AC8 gate needs a working limiter): the stored
 * window is compared against the current clock-anchored window in one
 * statement, so the count increments inside the window and resets to 1 when
 * the window rolls. The previous shape compared the stored `window_start`
 * against a freshly computed sliding begin, which is always later than any
 * stored value — so the `WHERE` never matched, the count stuck at 1, and the
 * limiter never blocked anything (F-12 is worse than described: not "dead
 * after the first window" but a complete no-op).
 *
 * Anchored windows admit a boundary burst (up to 2× max across a window edge).
 * That is the roadmap's specified semantic; brute-forcing any current budget
 * (IP 20/30 min, MFA 3/15 min) stays infeasible even doubled.
 *
 * Expired buckets are removed by `reclaimRateLimits` (manual
 * `bun run db:reclaim-rate-limits` in Phase 1; the Phase 2 scheduler wires it
 * to run nightly). Buckets whose window rolled but which were never touched
 * again would otherwise accumulate one row per key forever.
 *
 * Dedicated limiter tests live in `src/tests/rate-limit.test.ts`; the MFA AC8
 * tests additionally cover this statement behaviorally (3 allowed, 4th blocked
 * in-window).
 */
export async function checkRateLimit(
  db: NodePgDatabase<Record<string, any>>,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  try {
    // Clock-anchored window: the CASE below is only correct when `$windowStart`
    // is stable within a window (a sliding begin would reset the count on
    // every call — the mirror image of the bug this replaces).
    const anchor = Math.floor(Date.now() / windowMs) * windowMs;
    const windowStart = new Date(anchor);
    const windowEnd = new Date(anchor + windowMs);
    await db.execute(
      sql`
        INSERT INTO rate_limits (id, key, count, window_start, expires_at)
        VALUES (${crypto.randomUUID()}, ${key}, 1, ${windowStart.toISOString()}, ${windowEnd.toISOString()})
        ON CONFLICT (key)
        DO UPDATE SET
          count = CASE WHEN rate_limits.window_start >= ${windowStart.toISOString()}
                       THEN rate_limits.count + 1 ELSE 1 END,
          window_start = CASE WHEN rate_limits.window_start >= ${windowStart.toISOString()}
                              THEN rate_limits.window_start ELSE ${windowStart.toISOString()} END,
          expires_at = ${windowEnd.toISOString()}
      `,
    );
    const rows = await db.execute<{ count: number }>(
      sql`SELECT count FROM rate_limits WHERE key = ${key} AND window_start >= ${windowStart.toISOString()} LIMIT 1`,
    );
    const row = (rows as any).rows?.[0] as any;
    return row ? row.count > max : false;
  } catch (error) {
    // Fail open, but never silently. This catch swallowed a missing `rate_limits`
    // table for the entire life of the module, so the IP brute-force control
    // (BR-AUTH-018) did nothing and nobody noticed. Warn once per process.
    //
    // Only report real database failures: the no-op DB used by tests that must
    // not touch the database throws a plain Error, and warning about that would
    // be noise on every run.
    //
    // Caveat for callers inside a transaction: the failed statement aborts it, so
    // every later query in that transaction fails with 25P02 even though this
    // function reports a clean `false`.
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode && !warnedAboutFailure) {
      warnedAboutFailure = true;
      console.warn(
        `[rate-limit] checkRateLimit failed (${pgCode}) — failing open:`,
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }
}

/**
 * Delete buckets whose window expired more than `graceMs` ago (default
 * {@link RATE_LIMIT_RECLAIM_GRACE_MS}). Returns the number of rows deleted.
 *
 * Unlike `checkRateLimit`, failures here throw: this runs as an operator-
 * invoked script (`bun run db:reclaim-rate-limits`), where a loud failure
 * beats silent accumulation.
 */
export async function reclaimRateLimits(
  db: NodePgDatabase<Record<string, any>>,
  graceMs: number = RATE_LIMIT_RECLAIM_GRACE_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - graceMs);
  const result = await db.execute(
    sql`DELETE FROM rate_limits WHERE expires_at < ${cutoff.toISOString()}`,
  );
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
