import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig } from "./config";

const { Pool } = pg;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = NodePgDatabase<any>;

let _db: Db | undefined;
let _pool: pg.Pool | undefined;

export function createDb(databaseUrl?: string): Db {
  const config = getConfig();
  const pool = new Pool({
    connectionString: databaseUrl ?? config.DATABASE_URL,
  });
  _pool = pool;
  _db = drizzle(pool);
  return _db;
}

export function getDb(): Db {
  if (!_db) {
    return createDb();
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
    _db = undefined;
  }
}

export interface TestDb {
  db: Db;
  done: () => Promise<void>;
}

export async function createTestDb(databaseUrl?: string): Promise<TestDb> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for test DB");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  await client.query("BEGIN");
  // Session-level marker read by withAtomicWrites (src/lib/transaction.ts) so
  // it can tell "inside the harness transaction" (use savepoints) from
  // "bare production handle" (use db.transaction). A custom GUC is used
  // because txids are assigned lazily and PostgreSQL 14 has no
  // in_transaction setting. is_local=false: the marker survives the harness
  // ROLLBACK and dies with the session.
  await client.query("SELECT set_config('nawebeus.test_harness', 'on', false)");
  const db = drizzle(client as any) as unknown as Db;

  const done = async () => {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
      await pool.end();
    }
  };

  return { db, done };
}
