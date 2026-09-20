import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMIT_RECLAIM_GRACE_MS, reclaimRateLimits } from "../lib/rate-limit";
import { withTestDb } from "./helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;
const WINDOW_MS = 60_000;
const MAX = 3;

const freshKey = (tag: string) => `rl-test-${tag}-${crypto.randomUUID()}`;

interface BucketRow {
  count: number;
  window_start: Date | string;
  expires_at: Date | string;
}

async function readBucket(db: any, key: string): Promise<BucketRow | undefined> {
  const rows = await db.execute(
    sql`SELECT count, window_start, expires_at FROM rate_limits WHERE key = ${key} LIMIT 1`,
  );
  return (rows as any).rows?.[0] as BucketRow | undefined;
}

/** Simulate window expiry by backdating the stored window (no real waits). */
async function forceWindowRoll(db: any, key: string, windowsAgo = 2): Promise<void> {
  const stale = new Date(Date.now() - windowsAgo * WINDOW_MS);
  await db.execute(
    sql`UPDATE rate_limits
        SET window_start = ${stale.toISOString()}, expires_at = ${stale.toISOString()}
        WHERE key = ${key}`,
  );
}

/** Fill a bucket past its budget; returns the results of each call. */
async function fillPastBudget(db: any, key: string): Promise<boolean[]> {
  const results: boolean[] = [];
  for (let i = 0; i < MAX + 1; i++) {
    results.push(await checkRateLimit(db, key, MAX, WINDOW_MS));
  }
  return results;
}

describe.skipIf(!hasDb())("checkRateLimit", () => {
  test("counts within a window: first max calls pass, N+1th exceeds and stays exceeded", async () => {
    await withTestDb(async ({ db }) => {
      const key = freshKey("count");
      const results = await fillPastBudget(db, key);
      expect(results).toEqual([false, false, false, true]);
      expect(await checkRateLimit(db, key, MAX, WINDOW_MS)).toBe(true);
      expect((await readBucket(db, key))?.count).toBe(MAX + 2);
    });
  });

  test("a rolled window resets the count to 1", async () => {
    await withTestDb(async ({ db }) => {
      const key = freshKey("roll");
      expect(await fillPastBudget(db, key)).toEqual([false, false, false, true]);

      await forceWindowRoll(db, key);
      expect(await checkRateLimit(db, key, MAX, WINDOW_MS)).toBe(false);
      expect((await readBucket(db, key))?.count).toBe(1);
    });
  });

  test("stays correct across three consecutive window boundaries on one bucket", async () => {
    await withTestDb(async ({ db }) => {
      const key = freshKey("boundaries");
      // Baseline: saturate the current window.
      expect(await fillPastBudget(db, key)).toEqual([false, false, false, true]);
      for (let boundary = 1; boundary <= 3; boundary++) {
        await forceWindowRoll(db, key);
        // First call after the roll resets to 1 (false), then the budget
        // refills exactly; the final count proves the reset happened (no
        // reset would accumulate 8, 12, … across iterations).
        expect(await fillPastBudget(db, key)).toEqual([false, false, false, true]);
        expect((await readBucket(db, key))?.count).toBe(MAX + 1);
      }
    });
  });

  test("buckets are independent per key", async () => {
    await withTestDb(async ({ db }) => {
      const hot = freshKey("hot");
      const cold = freshKey("cold");
      expect(await fillPastBudget(db, hot)).toEqual([false, false, false, true]);
      expect(await checkRateLimit(db, cold, MAX, WINDOW_MS)).toBe(false);
      expect((await readBucket(db, cold))?.count).toBe(1);
    });
  });
});

describe.skipIf(!hasDb())("reclaimRateLimits", () => {
  async function seedBucket(db: any, key: string, expiresAt: Date): Promise<void> {
    await db.execute(
      sql`INSERT INTO rate_limits (id, key, count, window_start, expires_at)
          VALUES (${crypto.randomUUID()}, ${key}, 9,
                  ${new Date(expiresAt.getTime() - WINDOW_MS).toISOString()},
                  ${expiresAt.toISOString()})`,
    );
  }

  async function remainingKeys(db: any, keys: string[]): Promise<string[]> {
    const rows = await db.execute(
      sql`SELECT key FROM rate_limits WHERE key IN ${keys} ORDER BY key`,
    );
    return ((rows as any).rows as { key: string }[]).map((r) => r.key);
  }

  test("deletes only buckets expired beyond the grace period", async () => {
    await withTestDb(async ({ db }) => {
      const now = Date.now();
      const active = freshKey("active");
      const recent = freshKey("recent");
      const stale = freshKey("stale");
      await seedBucket(db, active, new Date(now + WINDOW_MS));
      await seedBucket(db, recent, new Date(now - RATE_LIMIT_RECLAIM_GRACE_MS / 2));
      await seedBucket(db, stale, new Date(now - RATE_LIMIT_RECLAIM_GRACE_MS * 2));

      const deleted = await reclaimRateLimits(db);
      expect(deleted).toBe(1);
      expect(await remainingKeys(db, [active, recent, stale])).toEqual([active, recent].sort());

      // A zero grace reclaims everything already expired.
      expect(await reclaimRateLimits(db, 0)).toBe(1);
      expect(await remainingKeys(db, [active, recent, stale])).toEqual([active]);
    });
  });
});
