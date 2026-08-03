import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

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
  } catch {
    // If the table doesn't exist (e.g. tests with no DB), fail open
    return false;
  }
}
