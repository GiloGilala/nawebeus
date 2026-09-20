import type { Db } from "../../lib/db";
import { createAppWithDb } from "../../server";

/**
 * Lazy no-op database. Satisfies the Db interface but throws if actually queried.
 * Used by tests that never touch the database (validation, 401, health).
 */
export function createNoopDb(): Db {
  const never = (method: string) => () => {
    throw new Error(`Noop db queried via ${method} — this test should not touch the database`);
  };
  return {
    execute: never("execute"),
    select: never("select"),
    insert: never("insert"),
    update: never("update"),
    delete: never("delete"),
    transaction: never("transaction"),
    query: undefined as never,
    _: undefined as never,
    $client: undefined as never,
  } as unknown as Db;
}

/**
 * Thin alias of the production app factory. Tests run the exact same
 * assembly as production — CORS, errorHandler, notFound, and all routes.
 * `corsOrigins` overrides the dev-default allow-list (CORS tests use this).
 */
export function createTestApp(db: Db = createNoopDb(), corsOrigins?: string[]) {
  return createAppWithDb({ db, ...(corsOrigins ? { corsOrigins } : {}) });
}
