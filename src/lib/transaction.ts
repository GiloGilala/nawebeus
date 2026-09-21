import { sql } from "drizzle-orm";
import type { NodePgDatabase, NodePgTransaction } from "drizzle-orm/node-postgres";
import type { Db } from "./db";
import { describeError } from "./errors";

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

/**
 * One row's refusal inside a per-row delete: which row, and why it refused.
 * `error` is `describeError` text, so a PostgreSQL refusal keeps its code
 * (`(23503)` plus the constraint name) — which is what lets a test tell
 * "blocked by the owner FK" from "the database went away".
 */
export interface RowDeleteFailure {
  id: string;
  error: string;
}

/**
 * The honest count of a per-row delete: `deleted` rows actually erased (never
 * attempted), `failed` rows that refused, and the per-row reasons. `failed`
 * duplicates `errors.length` on purpose — it keeps "how many refused" a scalar
 * an operator can read off `after_state` without measuring an array, and it is
 * the key the worker's partial-run convention (`isPartialRun`) looks at.
 *
 * `auditAnonymized` sums what the rows' `beforeDelete` hooks reported (today the only hook in
 * the system is the audit scrub, NWB-P1-015 — the org purge reports 0 because it erases no
 * subject). Always present, so the report shape never depends on which hooks ran.
 */
export interface PerRowDeleteResult {
  deleted: number;
  failed: number;
  errors: RowDeleteFailure[];
  auditAnonymized: number;
}

/**
 * Per-row work a purge runs inside the row's savepoint, before its DELETE (NWB-P1-015).
 *
 * The placement is the point: the hook's writes share the row's atomic scope, so a hook failure
 * lands the row in `errors` with nothing half-done, and a DELETE refusal afterwards rolls the
 * hook's writes back with it. Return the number of side-effect rows touched for the run's report
 * (or nothing, for hooks with nothing to count) — the count is only claimed when the DELETE that
 * follows actually removes the row, so a refusal can never inflate it.
 */
export interface PerRowDeleteHooks {
  // `| undefined` is explicit because tsconfig sets `exactOptionalPropertyTypes`; `undefined`
  // rather than `void` in the return union because `void` there is the confusing kind (biome
  // `noConfusingVoidType`), and a hook's bare `return;` produces `undefined` anyway.
  beforeDelete?: ((tx: DbOrTx, id: string) => Promise<number | undefined>) | undefined;
}

/**
 * Tables a purge is allowed to delete from. A closed union, not `string`: the
 * table name is interpolated into SQL (identifiers cannot be parameterised),
 * so the type system is the allow-list.
 */
export type PurgeableTable = "users" | "organizations" | "organization_members";

/**
 * Delete `ids` from `table` one row at a time, each in its own savepoint
 * (NWB-P1-013).
 *
 * A single multi-row DELETE is atomic in the wrong direction for a purge: one
 * row's restrictive FK aborts the whole statement, so every healthy row waits
 * a night for a blocked one — and the 23503 carries no per-row information.
 * Here each id gets its own savepoint inside one `withAtomicWrites` scope, so a
 * refusal rolls back exactly that row and is collected into `errors` instead of
 * thrown. The run reports what actually happened: `{ deleted, failed, errors }`.
 *
 * A row that vanished between the candidate SELECT and its DELETE (a
 * concurrent run got there first) counts as neither: the run that actually
 * erased it already claimed it, and double-counting would lie in the other
 * direction.
 *
 * Callers pass candidate ids, not a predicate, so the "which rows are due"
 * decision stays in the service that owns the lifecycle — this helper only
 * decides *how* the delete is isolated.
 *
 * `hooks.beforeDelete`, when given, runs first inside the same savepoint. Its reported count is
 * held per-row and only added to `auditAnonymized` when the DELETE actually removes the row: a
 * refusal rolls the hook's writes back, so claiming its count would count work that did not
 * survive — and a vanished row (concurrent run got there first) claims nothing either, consistent
 * with `deleted`.
 */
export async function deleteRowsPerRow(
  db: Db,
  table: PurgeableTable,
  ids: readonly string[],
  hooks?: PerRowDeleteHooks,
): Promise<PerRowDeleteResult> {
  if (ids.length === 0) return { deleted: 0, failed: 0, errors: [], auditAnonymized: 0 };

  return withAtomicWrites(db, async (tx) => {
    let deleted = 0;
    let auditAnonymized = 0;
    const errors: RowDeleteFailure[] = [];
    for (const id of ids) {
      // Counter-derived, never caller input — the only interpolation `sql.raw`
      // is safe for. `withAtomicWrites`' own savepoint is the outer scope.
      const savepoint = `sp_purge_row_${savepointCounter++}`;
      await tx.execute(sql.raw(`SAVEPOINT ${savepoint}`));
      try {
        let rowScrubbed = 0;
        if (hooks?.beforeDelete) {
          rowScrubbed = (await hooks.beforeDelete(tx, id)) ?? 0;
        }
        const result = await tx.execute<{ id: string }>(
          sql`DELETE FROM ${sql.raw(table)} WHERE id = ${id} RETURNING id`,
        );
        const removed = (result as unknown as { rows?: unknown[] }).rows?.length ?? 0;
        if (removed > 0) {
          deleted++;
          auditAnonymized += rowScrubbed;
        }
        await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
      } catch (error) {
        await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
        errors.push({ id, error: describeError(error) });
      }
    }
    return { deleted, failed: errors.length, errors, auditAnonymized };
  });
}
