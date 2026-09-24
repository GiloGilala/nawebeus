import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { createTestDb } from "../../lib/db";

export { createTestDb };

export interface TestDbContext {
  db: Db;
  done: () => Promise<void>;
}

export async function withTestDb<T>(
  fn: (ctx: TestDbContext) => Promise<T>,
  databaseUrl?: string,
): Promise<T> {
  const ctx = await createTestDb(databaseUrl);
  try {
    return await fn(ctx);
  } finally {
    await ctx.done();
  }
}

/**
 * Ensure a migration's objects exist by executing the migration file itself. Migration SQL, not
 * a copy: if the file stops running, this fails — which is the point. Runs inside the caller's
 * transaction, so it rolls back with the test.
 *
 * `duplicate_object` (42710) is tolerated per statement and nothing else is: generated DDL has
 * no `IF NOT EXISTS` on `CREATE TYPE`, so a fresh database reports the enums as already there —
 * which is exactly the state this helper wants. Any other error is a real failure in shipped
 * DDL and propagates.
 *
 * Each statement runs inside its own savepoint, because a swallowed error still aborts the
 * transaction: without the savepoint, tolerating the expected 42710 would poison every
 * statement after it with 25P02. The savepoint confines the tolerated failure to itself.
 */
export async function ensureMigrationApplied(db: Db, filename: string): Promise<void> {
  const migration = readFileSync(
    join(import.meta.dir, "..", "..", "..", "drizzle", "migrations", filename),
    "utf8",
  );
  const statements = migration
    .split(/^-->.*$/m)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((chunk) => chunk.length > 0);
  expect(statements.length).toBeGreaterThan(0);
  for (const statement of statements) {
    await db.execute(sql.raw("SAVEPOINT ensure_migration_statement"));
    try {
      await db.execute(sql.raw(statement));
      await db.execute(sql.raw("RELEASE SAVEPOINT ensure_migration_statement"));
    } catch (error) {
      await db.execute(sql.raw("ROLLBACK TO SAVEPOINT ensure_migration_statement"));
      if ((error as { code?: unknown } | null)?.code !== "42710") throw error;
    }
  }
}

/**
 * Ensure the anonymization-aware trigger exists by executing the migration that ships it.
 *
 * Shared because every purge-with-scrub suite needs the same hermeticity: push-built databases
 * (CI included) have no trigger at all, and without this a scrub test would pass trivially with
 * the flag/trigger integration untested.
 */
export async function ensureAnonymizationTrigger(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0002_audit_anonymization_exception.sql");
}

/**
 * Ensure the retention tables exist by executing the migration that ships them. Fresh
 * migrate- or push-built databases already have them (the tolerance above covers that); this
 * is for stale dev databases pushed before the models were adopted — the suite must not depend
 * on ambient schema.
 */
export async function ensureRetentionTables(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0003_legal_holds_backup_records.sql");
}

/**
 * Ensure the templates table has updated column lengths by executing migration 0005.
 */
export async function ensureTemplatesSchema(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0005_templates_id_lengths.sql");
}

/**
 * Ensure the contacts table has updated column lengths by executing migration 0006.
 */
export async function ensureContactsSchema(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0006_contacts_id_lengths.sql");
}

/**
 * Ensure the alert tables have updated column lengths by executing migration 0007.
 */
export async function ensureAlertsSchema(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0007_alerts_id_lengths.sql");
}

/**
 * Ensure the app_config table exists by executing migration 0008.
 */
export async function ensureAppConfigSchema(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0008_app_config.sql");
}

/**
 * Ensure media_assets id columns are at their migration-0010 width (the 0005/0006/0007
 * lesson: pushed-but-stale dev databases predate the widening).
 */
export async function ensureMediaSchema(db: Db): Promise<void> {
  return ensureMigrationApplied(db, "0010_media_assets_id_lengths.sql");
}
