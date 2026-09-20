# NWB-P0-009 — `db:push` cannot converge on an existing database

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 249/249 `bun test`
with a live database; fresh-DB push convergence verified; CI re-run pending)
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

## Answer (2026-09-20)

Implemented **Option A** plus the config unification, and re-verified every clause of the
original diagnosis against the current toolchain (drizzle-kit **0.28.1**, PostgreSQL **14.23**,
Bun 1.4.0). Two findings below **supersede the ticket's original diagnosis**; the 42P16 as
described did not reproduce, but the underlying complaint — push cannot converge — did, for
three different reasons, two of which are now fixed in the schema and one of which is an
upstream drizzle-kit defect that no schema change can fix.

### Changes shipped

1. **`.notNull()` on every `primaryKey()`** — all 81 column-level declarations across `db/`
   are now `notNull().primaryKey()`; nothing else in the model changed. Mechanical, matches
   what PostgreSQL stores.
2. **`analytics_aggregates` composite PK got an explicit short name** — `pk_aag_natural_key`
   (`db/shared/analytics.ts`). drizzle's generated name for that 8-column key is **120 chars**;
   PostgreSQL truncates *every* identifier to 63 bytes, so the constraint came back named
   `analytics_aggregates_organization_id_granularity_time_bucket_pl`, which never matched what
   the model expected → drop + re-add on **every** push, forever. An explicit ≤63-char name
   round-trips. (Existing databases converge after one renaming push.)
3. **`api_keys.rate_limits` default is now a compact jsonb literal** (`db/core/api-keys.ts`).
   PG deparses jsonb defaults canonically (`'{"limits": {}, "enabled": false, ...}'::jsonb` —
   spaces, keys sorted by length then bytewise), drizzle-kit serializes a JS-object default as
   `JSON.stringify` (`'{"enabled":false,...}'`), and it compares the two **as text** →
   `SET DEFAULT` re-issued on every push. Kit's jsonb introspection strips whitespace before
   comparing, so a compact literal converges. Same jsonb value either way.
4. **`DATABASE_URL` is now the single source of truth for `db:push`** — `drizzle.config.ts`
   delegates to `src/lib/db-config.ts` (pure, unit-tested): `DATABASE_URL` wins; the `DB_*`
   variables are a fallback when the URL is unset; when **both** are present and any `DB_*`
   disagrees with the URL, push exits with an error naming each conflict. The old
   "silently targets `nawebeus`" footgun is impossible now. CI's `db:push` step no longer
   needs the duplicated `DB_*` block.
5. **22 unit tests** for the resolver in `src/tests/db-config.test.ts` (no DB required).

### Verified against the definition of done

| DoD clause | Result |
| --- | --- |
| Second push against an existing schema: clean no-op, exit 0 | **Partially met — see finding 1.** Push now exits 0 and emits **zero** column/constraint/default statements on re-push. It still emits 36 `DROP INDEX IF EXISTS` + 36 `CREATE INDEX IF NOT EXISTS` pairs, deterministic every run. |
| Fresh database → full schema, one documented non-destructive command | **Met.** `bun run db:push -- --force` with `DATABASE_URL` set. The `--force` is load-bearing: `strict: true` prompts even on a fresh DB, and with a closed stdin drizzle-kit **aborts silently while exiting 0** — a green no-op that pushes zero tables. Documented in AGENTS.md; CI already used `--force`. |
| `DATABASE_URL` and `DB_*` cannot disagree silently | **Met** — loud conflict error; unit-tested. |
| typecheck clean; full suite green with a live database | **Met.** `tsc --noEmit` clean, `biome check .` clean (errors; warnings are the pre-existing baseline), `bun run build` clean, `bun test` **249 pass / 0 fail** (was 227) against a pushed + seeded PostgreSQL 14.23. |

### Finding 1 — the desc/partial-index churn is an upstream drizzle-kit defect (open)

Every push drops and recreates exactly the 36 indexes that have `desc()` columns or a
`WHERE` predicate. Root cause, from the kit bundle and live queries:

- `desc(col)` in drizzle-orm 0.36 is a raw **SQL expression**; kit's model side serializes it
  as `expression="created_at" desc, isExpression=true`, while kit's introspection reports the
  same thing as a sorted **plain column** (`expression=created_at, isExpression=false,
  asc=false, nulls=first`, from `pg_index.indoption`). The two serialized forms can never be
  equal → "altered" → drop + recreate.
- `WHERE` predicates compare drizzle's rendered text
  (`"unified_audit_log"."actor_type" = 'impersonation'`) against PG's normalized
  `pg_get_expr` output (`(actor_type = 'impersonation'::audit_actor_type)`) — casts,
  parenthesization, and qualification differ; never equal.

**Spike: upgrading does not fix it.** drizzle-kit **0.31.10** (latest at the time of writing)
against this same schema produces the identical churn (75 statements on second push, same
three classes). Upgrading was therefore **not adopted** — it would change `db:generate`
output for NWB-P0-005 without buying convergence. The statements that do run are
semantically no-ops (identical index dropped and recreated), which is tolerable for a
dev-only push against disposable databases — and is exactly the argument for NWB-P0-005 to
replace push with a real migration baseline rather than keep polishing it.

### Finding 2 — the original 42P16 diagnosis does not reproduce on drizzle-kit 0.28.1

With 0.28.1 + PostgreSQL 14, a second push against the untouched original schema did **not**
emit `ALTER COLUMN id DROP NOT NULL` and did not fail — the only re-push statements were the
three churn classes above. The ticket's reproduction (2026-09-13, PostgreSQL 18) may have hit
a PG-18 introspection difference or an older kit. The `.notNull()` change is still correct
and kept: it makes the model state what the database enforces, and it costs nothing. The
"partially applied statements" complaint stands on its own — push does not wrap statements in
a transaction, so any mid-push failure still leaves the database between two schemas.
