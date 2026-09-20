# Local database for tests and development

`bun run dev`, `bun run seed`, and the integration suites need a PostgreSQL 14+ database. Nothing else does:

- **Without `DATABASE_URL`** `bun test` runs the pure suites (217 pass, ~0.2 s) and cleanly **skips the 176 database-gated tests** (`describe.skipIf(!hasDb())`). It never goes red for lack of a database.
- **With `DATABASE_URL`** pointing at a pushed and seeded database, the full suite runs (383 tests across 41 files, ~28 s).
- **CI** always runs the full suite against a `postgres:14` service container (`.github/workflows/ci.yml`). That is the source of truth; anything below is for reproducing it locally.

## Option 1 — a PostgreSQL you already have

Any PostgreSQL 14+ works, including Docker:

```bash
docker run --name nawebeus-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nawebeus_test -p 5432:5432 -d postgres:14
```

Then continue at [Configure and run](#configure-and-run).

## Option 2 — no server, no Docker, no new repo dependency

Use the [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres) npm package (MIT; ships real PostgreSQL binaries for Linux, macOS and Windows) from a **scratch directory outside the repository**. The repo's `package.json` stays untouched — Phase 1 forbids new dependencies, and this needs none.

Verified 2026-09-20 in the Arena sandbox: install 3 s, start ~1 s, `db:push` 1.8 s, `bun test` 325 pass / 0 fail in ~18 s (first verified at 249 tests; the count grows with every ticket, so read the *current* numbers off your own run rather than this line).

```bash
mkdir -p ~/nawebeus-db && cd ~/nawebeus-db
npm init -y >/dev/null
npm install embedded-postgres@14.23.0-beta.17   # PostgreSQL 14.23 = the CI floor (ADR-003)
```

The package's major version tracks the PostgreSQL major version, and *every* release carries a `-beta.N` suffix — that is the only tag it publishes, not a warning. Pick the `14.x` line so local behaviour matches CI; it is ~60 MB on disk.

Create `~/nawebeus-db/start.mjs`:

```js
// Throwaway PostgreSQL on $PGPORT (default 5432), user/password postgres/postgres,
// with an empty database `nawebeus_test`. Data lives in ./data and is wiped on every start.
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.PGPORT ?? 5432);
const pg = new EmbeddedPostgres({
  databaseDir: new URL("./data", import.meta.url).pathname,
  user: "postgres",
  password: "postgres",
  port,
  persistent: false,
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});

await pg.initialise();
await pg.start();
await pg.createDatabase("nawebeus_test");
console.log(`READY postgresql://postgres:postgres@localhost:${port}/nawebeus_test`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
```

Run it and leave it running (`Ctrl-C` stops it and discards the data):

```bash
node ~/nawebeus-db/start.mjs          # prints READY postgresql://...
PGPORT=5433 node ~/nawebeus-db/start.mjs   # if 5432 is taken
```

## Configure and run

`.env` (gitignored; Bun loads it automatically for `bun run`, `bun test`, and `bun -e`):

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nawebeus_test
JWT_ACCESS_SECRET=local-access-secret-at-least-32-chars-long-xx
JWT_REFRESH_SECRET=local-refresh-secret-at-least-32-chars-long-x
```

`DATABASE_URL` is the single source of truth — the app, the seed script, the tests, **and** `bun run db:push` all read it (NWB-P0-009). The old `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` variables still work as a fallback when `DATABASE_URL` is unset, but if both are set and any `DB_*` disagrees with the URL, `db:push` refuses to run rather than silently picking a database. Then, from the repo root:

```bash
bun run db:push -- --force   # schema (--force is required, see below)
bun run seed                 # permissions, DEC-039 roles, bootstrap org + admin
bun test                     # full suite
```

Always pass `-- --force`: `strict: true` makes drizzle-kit prompt even on a fresh database, and with a closed stdin (scripts, CI) it aborts **silently while exiting 0** — a green no-op that pushes zero tables.

| Command | Reads |
| --- | --- |
| `bun run db:push` | `DATABASE_URL` (with `DB_*` as a validated fallback — see above) |
| `bun run seed`, `bun run dev` | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| `bun test` | `DATABASE_URL` only — `src/tests/preload.ts` supplies placeholder JWT secrets |

### Resetting the database

`db:push` is not a migration history (see the Database section of `AGENTS.md`). Re-pushing over an existing database now converges cleanly except for a known upstream drizzle-kit quirk (it drops and recreates the descending/partial indexes every run), but push remains a dev-only tool: when you want a guaranteed-clean start, recreate the database. With Option 2, `Ctrl-C` and re-run `start.mjs`. With any server, recreate the database using the `pg` driver the repo already has:

```bash
bun -e 'const { Client } = await import("pg"); const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/postgres") }); await c.connect(); await c.query("DROP DATABASE IF EXISTS nawebeus_test WITH (FORCE)"); await c.query("CREATE DATABASE nawebeus_test"); await c.end(); console.log("nawebeus_test recreated")'
bun run db:push -- --force && bun run seed
```

## Evaluated and not adopted: PGlite

PGlite (PostgreSQL compiled to WASM) behind `@electric-sql/pglite-socket` was spiked on 2026-09-20 (PGlite 0.5.8 = PostgreSQL 18.3, pglite-socket 0.2.11) with the repo code unchanged. It gets close — `db:push`, `seed`, and 226/227 tests — but was not adopted because:

- It needs two new devDependencies; the recipe above needs none in the repo.
- It runs PostgreSQL 18, not the PostgreSQL 14 floor that CI tests.
- All connections multiplex onto **one** PGlite session, so tests about connection isolation or concurrency pass without proving what they prove on a real server.
- `PGLiteSocketServer` defaults to `maxConnections: 1`, which makes Node's `net.Server` reset connections that arrive before the previous close is counted — 9–12 flaky `ECONNRESET` failures per run until it is raised (8 was enough).
- One deterministic failure in `src/tests/auth/signup.test.ts` ("rolls back atomically", FR-ORG-001 AC7): after a PL/pgSQL trigger raises inside a savepoint, the wire-protocol bridge returns an empty result for the next parameterised query and then emits a stray `RowDescription` that kills the connection. PGlite's direct JS API handles the same sequence correctly, so it is a bridge bug, not a database-semantics or test bug — but it means the suite cannot be green on PGlite as-is.

Re-evaluate if the bridge bug is fixed upstream and a download-free setup is needed on machines where Option 2 cannot run.
