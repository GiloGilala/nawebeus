# NWB-P0-009 — `db:push` cannot converge on an existing database

**Status:** open — found 2026-09-13 while fixing the DB-gated suite
**Deps:** overlaps **NWB-P0-005** (migration baseline) — fix there, not here. **Size:** M.

## The bug

`bun run db:push` fails against any database that already has the schema:

```
error: column "id" is in a primary key
  code: '42P16'
  routine: 'dropconstraint_internal'
```

Reproduced 2026-09-13 against `nawebeus_test` (PostgreSQL 18).

The cause is a schema-vs-introspection mismatch. Every table declares its primary key as

```ts
id: uuid("id").primaryKey().defaultRandom(),
```

without an explicit `.notNull()` — **81 `primaryKey()` declarations, 0 of them paired with
`.notNull()`** (`grep -rn "primaryKey()" db/ | wc -l` → 81; `notNull().primaryKey()` → 0).

drizzle-kit therefore believes `id` *should* be nullable. The live database knows better —
PostgreSQL makes primary-key columns `NOT NULL` implicitly — so the diff engine emits
`ALTER COLUMN id DROP NOT NULL`. PostgreSQL refuses, because the `NOT NULL` is not a standalone
constraint it can drop: it is implied by the primary key. Hence `42P16`.

## Why it matters

- **Push is not idempotent.** Running it twice fails the second time. Any workflow that assumes
  "push the schema, then work" only ever works against a virgin database.
- **It silently does half the work first.** In the reproduction the push emitted a run of
  `CREATE INDEX IF NOT EXISTS …` and `ADD CONSTRAINT … UNIQUE(…)` statements and *then* hit the
  error. Statements are not wrapped in a transaction, so the database is left part-way between
  the old and new schema. Recovering means either completing the push by hand or dropping the
  database.
- **It contradicts the exit gate.** P0's exit gate requires "migrations reproducible from zero".
  `drizzle/migrations/` currently holds **one** migration file
  (`0000_campaign_domain_disambiguation.sql`, 1.4 KB) for a schema of 81 tables — there is no
  migration history at all, and `db:push` cannot stand in for one.
- **The workaround is destructive.** `DROP DATABASE … WITH (FORCE)` + `CREATE DATABASE` + push is
  the only reliable path today. That is acceptable for `nawebeus_test`; it is not acceptable
  anywhere else, and it is exactly the kind of habit that loses data.

## Second defect found alongside it: two sources of truth for the connection

`drizzle.config.ts` reads **`DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`**,
while the application (`src/lib/config.ts`) and every test suite read **`DATABASE_URL`**.

So setting `DATABASE_URL` alone is not enough to run `db:push`:

```
Error  Please provide required params for Postgres driver:
    [x] password: ''
```

The push silently targets the **`nawebeus`** database (the `DB_NAME` default) even when
`DATABASE_URL` points at `nawebeus_test` — a plausible route to pushing schema changes at the
wrong database. Pick one variable and derive the other, or validate that the two agree.

Related: `DB_PASSWORD` is required to be non-empty by the driver, but the local `postgres` role
authenticates by trust and has no password. There is no documented way to run `db:push` locally
without inventing a dummy value.

## Options

| Option | Notes |
| --- | --- |
| **A. Add `.notNull()` to every `primaryKey()`** | Mechanical (81 sites), makes the model match reality, unblocks push. Does not give migration history — still needs P0-005. |
| **B. Generate migrations and stop using push** | The real fix, and what P0-005 is for. `db:generate` + `db:migrate` from a baseline; push becomes a dev-only convenience against disposable databases. |
| **C. Leave push broken, document the drop/recreate dance** | Cheapest, and the status quo. Acceptable only for throwaway local databases, and it will keep costing time. |

**Recommendation: A now, B as part of P0-005.** A is a small mechanical change that stops the
bleeding and makes local development sane; B is the durable answer and is already ticketed.

## Definition of done

- `db:push` run twice in a row against a database that already has the schema: second run is a
  clean no-op, exit 0.
- A fresh database can be brought to the full schema by one documented, non-destructive command.
- `DATABASE_URL` and the `DB_*` variables cannot disagree silently.
- `bun run typecheck` clean; full suite green with a live database.

## Notes

- `db/compliance/index.ts` declares ids as `varchar("id", { length: 32 }).primaryKey()`. This is
  the same too-narrow-uuid defect that had silently broken `unified_audit_log` (widened to
  `varchar(64)` on 2026-09-13), and it will bite the same way once that module is wired in. The
  module is currently excluded from `tsconfig.json`, so nothing catches it today.
- The error surfaces at `dropconstraint_internal`, i.e. only when push is diffing against an
  existing database — which is why a first-ever push into an empty database appears to work and
  the problem looks intermittent.
