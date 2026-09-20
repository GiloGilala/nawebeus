import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig, loadConfig } from "../lib/config";
import { reclaimRateLimits } from "../lib/rate-limit";

const { Pool } = pg;

/**
 * Manual reclamation for expired rate-limit buckets (NWB-P0-013).
 * Phase 1 runs this by hand (`bun run db:reclaim-rate-limits`); Phase 2
 * (NWB-P1-001) wires the same export to the pg-boss scheduler nightly.
 */
async function main() {
  loadConfig();
  const config = getConfig();
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  try {
    const deleted = await reclaimRateLimits(drizzle(pool));
    console.log(`[db:reclaim-rate-limits] deleted ${deleted} expired bucket(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:reclaim-rate-limits] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
