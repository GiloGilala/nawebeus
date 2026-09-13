import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

/** Set after the first failure so a broken limiter warns once, not per request. */
let warnedAboutFailure = false;

/**
 * Sliding-window rate limit backed by the `rate_limits` table.
 * Returns true when the caller has exceeded the allowed number of attempts.
 */
export async function checkRateLimit(
  db: NodePgDatabase<Record<string, any>>,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowMs);
    await db.execute(
      sql`
        INSERT INTO rate_limits (id, key, count, window_start, expires_at)
        VALUES (${crypto.randomUUID()}, ${key}, 1, ${windowStart.toISOString()}, ${new Date(Date.now() + windowMs).toISOString()})
        ON CONFLICT (key)
        DO UPDATE SET count = rate_limits.count + 1, expires_at = ${new Date(Date.now() + windowMs).toISOString()}
        WHERE rate_limits.window_start >= ${windowStart.toISOString()}
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
