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
 * The probe query adds one round-trip per call; intended for correctness
 * paths (signup, org lifecycle), not hot loops.
 */
let savepointCounter = 0;

export async function withAtomicWrites<T>(db: Db, fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  // The harness (createTestDb) opens the client's transaction with a raw BEGIN
  // and marks the session with a custom GUC; this probe reads that marker.
  // Two earlier probes were wrong:
  // - txid_current_if_assigned() IS NOT NULL misreads every read-only-so-far
  //   transaction: PostgreSQL assigns xids lazily (on first write), so a
  //   transaction that had only read reports "not in a transaction". The
  //   production db.transaction() branch then ran inside the harness's open
  //   transaction and its COMMIT silently ended the harness BEGIN,
  //   persisting every later fixture write (found 2026-09-20 building the
  //   DSAR export, NWB-P0-002; regression-pinned in
  //   src/tests/atomic-writes.test.ts).
  // - current_setting('in_transaction') fails outright with 42704 on the
  //   PostgreSQL 14 floor (the setting is newer than 14).
  // A custom GUC is version-proof. Known limitation: a caller that opens its
  // own raw transaction outside the harness would be misread as "production";
  // no current caller does this (drizzle-managed nesting goes through
  // tx.transaction(), which savepoints natively).
  const probe = await db.execute<{ in_tx: boolean }>(
    sql`SELECT current_setting('nawebeus.test_harness', true) = 'on' AS in_tx`,
  );
  const inTx = Boolean((probe as any).rows?.[0]?.in_tx);

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
