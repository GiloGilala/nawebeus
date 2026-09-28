/**
 * Local embedded Postgres for development (NWB-P13-001).
 *
 * `bun run db:dev [--reset]`
 *
 * - First run initialises a cluster under `~/.nawebeus/pg` (override with
 *   `PGDATA`) and starts it on 127.0.0.1:5432 (override with `PGPORT`),
 *   then creates the `nawebeus_test` database.
 * - Already running → no-op, exit 0.
 * - `--reset` wipes the data directory first (fresh cluster).
 * - `persistent: true` — the cluster survives restarts; initdb runs once.
 *
 * The process stays alive while Postgres runs (kill it to stop the server).
 * Migrations are not applied here: run `bun run db:migrate` with
 * `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nawebeus_test`
 * afterwards (this keeps the bootstrap free of schema concerns).
 */
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";

// The platform package bundles its own shared libraries (libpq, libicu, …)
// under `native/lib`; the native binaries need them on LD_LIBRARY_PATH.
function platformLibDir(): string | undefined {
  // src/scripts/dev-db.ts → repo root is two levels up.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  for (const pkg of [
    "@embedded-postgres/linux-x64",
    "@embedded-postgres/darwin-arm64",
    "@embedded-postgres/darwin-x64",
    "@embedded-postgres/win32-x64",
  ]) {
    const dir = join(root, "node_modules", pkg, "native", "lib");
    if (existsSync(dir)) return dir;
  }
  return undefined;
}
/**
 * The package ships versioned libs (`libpq.so.5.18`) but the loader wants the
 * soname (`libpq.so.5`); without the symlink every native binary dies with
 * "cannot open shared object file". Create the missing soname links in place
 * (idempotent; node_modules reinstalls wipe them).
 */
function fixupSonameLinks(libDir: string): void {
  for (const file of readdirSync(libDir)) {
    const m = file.match(/^(.*\.so)\.(\d+)(\.\d+)+$/);
    if (!m) continue;
    const soname = `${m[1]}.${m[2]}`;
    if (soname === file) continue;
    const target = join(libDir, soname);
    if (!existsSync(target)) {
      try {
        symlinkSync(file, target);
      } catch {
        // already there (race) or read-only dir; the loader error will surface
      }
    }
  }
}

const libDir = platformLibDir();
if (libDir) {
  fixupSonameLinks(libDir);
  process.env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
}

const reset = process.argv.includes("--reset");
const dataDir = process.env.PGDATA ?? join(homedir(), ".nawebeus", "pg");
const host = "127.0.0.1";
const port = Number(process.env.PGPORT ?? 5432);
const user = "postgres";
const password = "postgres";

const isUp = async (): Promise<boolean> => {
  try {
    const c = new Client({
      host,
      port,
      user,
      password,
      database: "postgres",
      connectionTimeoutMillis: 1500,
    });
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
};

if (await isUp()) {
  console.log(`dev-db: postgres already running on ${host}:${port}; nothing to do.`);
  process.exit(0);
}

if (reset) {
  console.log("dev-db: wiping", dataDir);
  rmSync(dataDir, { recursive: true, force: true });
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
});

if (!existsSync(join(dataDir, "PG_VERSION"))) {
  // A leftover from a failed initdb (non-empty, no PG_VERSION) would make
  // initdb refuse; wipe it rather than fail.
  if (existsSync(dataDir) && rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 })) {
    console.log("dev-db: cleared a partial cluster at", dataDir);
  }
  console.log("dev-db: initialising cluster at", dataDir);
  mkdirSync(dataDir, { recursive: true });
  await pg.initialise();
}

console.log(`dev-db: starting postgres on ${host}:${port}`);
await pg.start();

const admin = new Client({ host, port, user, password, database: "postgres" });
await admin.connect();
for (const db of ["nawebeus_test"]) {
  const r = await admin.query<{ d: string }>(
    `SELECT datname AS d FROM pg_database WHERE datname = $1`,
    [db],
  );
  if (r.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${db}`);
    console.log("dev-db: created database", db);
  }
}
await admin.end();

console.log(`dev-db: ready — postgres on ${host}:${port}, dev db: nawebeus_test`);

// Stay alive while the server runs; stop cleanly on SIGINT/SIGTERM.
const shutdown = async (signal: string): Promise<void> => {
  console.log(`dev-db: ${signal} received, stopping postgres`);
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
await new Promise(() => {});
