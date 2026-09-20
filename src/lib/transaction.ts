import { sql } from "drizzle-orm";
import type { NodePgDatabase, NodePgTransaction } from "drizzle-orm/node-postgres";
import type { Db } from "./db";

/**
 * A drizzle handle that can execute SQL: either the top-level database or a
 * transaction object. Both expose the same `execute` API.
 */
export type DbOrTx =
  | NodePgDatabase<Record<string, any>>
  | NodePgTransaction<Record<string, any>, Record<string, any>>;

/**
 * Run `fn` atomically on `db`.
 *
 * **Why a helper instead of `db.transaction`**: the production handle is
 * pool-backed, where drizzle's `db.transaction()` acquires a dedicated
 * connection and issues a real BEGIN/COMMIT. The test harness
 * (`createTestDb` in `src/lib/db.ts`) instead binds a single client that is
 * already inside the harness's outer rollback transaction; on that handle a
 * nested `db.transaction()` is a no-op BEGIN plus a stray COMMIT that ends
 * the outer test transaction and silently persists test data — which is why
 * `rotateApiKey` (see `src/services/auth/api-key.ts`) is deliberately left
 * unwrapped.
 *
 * This helper branches on whether the client is already in a transaction:
 *
 * - **not in one (production)**: delegates to drizzle's `db.transaction`
 *   (real BEGIN/COMMIT on a pooled connection);
 * - **in one (tests, or a caller that already opened a transaction)**:
 *   SAVEPOINT / RELEASE / ROLLBACK TO SAVEPOINT — still fully atomic for
 *   `fn`'s writes, and a failure inside `fn` rolls back exactly those writes
 *   while leaving the outer transaction usable (preserving the harness's
 *   rollback isolation).
 *
 * The probe adds two round-trips per call; intended for correctness paths
 * (signup, org lifecycle), not hot loops.
 */
let savepointCounter = 0;

/**
 * True when the handle's connection is already inside a transaction block.
 *
 * Implemented as a throwaway SAVEPOINT pair: PostgreSQL accepts it inside a
 * transaction and rejects it outside one (25P01), and a statement that fails
 * outside a transaction auto-commits nothing, so the failed probe poisons
 * nothing. Do NOT "simplify" this to `txid_current_if_assigned() IS NOT
 * NULL` — that reads NULL until the transaction's first *write*, so a caller
 * that only reads before this helper (every signup test) takes the production
 * path, whose stray COMMIT ends the outer transaction and silently persists
 * the data (F-23).
 */
async function isInTransaction(db: Db): Promise<boolean> {
  const probe = `sp_tx_probe_${savepointCounter++}`;
  try {
    await db.execute(sql.raw(`SAVEPOINT ${probe}`));
    await db.execute(sql.raw(`RELEASE SAVEPOINT ${probe}`));
    return true;
  } catch {
    return false;
  }
}

export async function withAtomicWrites<T>(db: Db, fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  const inTx = await isInTransaction(db);

  if (!inTx) {
    // Production path: drizzle manages BEGIN/COMMIT on a dedicated pooled
    // connection. (If a caller is already inside a real drizzle transaction
    // this would be detected above and take the savepoint path instead.)
    return (db as NodePgDatabase<Record<string, any>>).transaction(async (tx) => fn(tx));
  }

  // Test / nested path: scope the rollback to a savepoint so the outer
  // transaction stays intact and usable.
  const savepoint = `sp_atomic_${savepointCounter++}`;
  await db.execute(sql.raw(`SAVEPOINT ${savepoint}`));
  try {
    const result = await fn(db);
    await db.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
    return result;
  } catch (err) {
    await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
    throw err;
  }
}
