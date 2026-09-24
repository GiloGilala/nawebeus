import type { Db } from "../../lib/db";
import { createAppWithDb } from "../../server";

/**
 * Lazy no-op database. Satisfies the Db interface but throws if actually queried.
 * Used by tests that never touch the database (validation, 401, health).
 *
 * The one query it answers is the readiness probe's `SELECT 1` ping
 * (NWB-P1-012): `/api/health` now verifies its database, so "no DB in this
 * test" and "health returns 200" are only compatible if the ping is allowed.
 * Anything else still throws — the guard this function exists for.
 */
const READINESS_PING = "SELECT 1";

export function createNoopDb(): Db {
  const never = (method: string) => () => {
    throw new Error(`Noop db queried via ${method} — this test should not touch the database`);
  };
  return {
    execute: (query?: unknown) => {
      if (query === READINESS_PING) {
        return Promise.resolve({ rows: [{ "?column?": 1 }] }) as never;
      }
      throw new Error(`Noop db queried via execute — this test should not touch the database`);
    },
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
