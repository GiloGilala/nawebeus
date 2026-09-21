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
 * Ensure the anonymization-aware trigger exists by executing the migration that ships it.
 * Migration SQL, not a copy: if the file stops running, this fails — which is the point.
 * Runs inside the caller's transaction, so it rolls back with the test.
 *
 * Shared because every purge-with-scrub suite needs the same hermeticity: push-built databases
 * (CI included) have no trigger at all, and without this a scrub test would pass trivially with
 * the flag/trigger integration untested.
 */
export async function ensureAnonymizationTrigger(db: Db): Promise<void> {
  const migration = readFileSync(
    join(
      import.meta.dir,
      "..",
      "..",
      "..",
      "drizzle",
      "migrations",
      "0002_audit_anonymization_exception.sql",
    ),
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
    await db.execute(sql.raw(statement));
  }
}
