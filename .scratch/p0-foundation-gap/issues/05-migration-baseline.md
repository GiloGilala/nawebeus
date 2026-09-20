# NWB-P0-005 — Migration baseline (subsumes NWB-P0-009)

**Status:** blocked on CI wiring — implementation + local proof complete;
the `.github/workflows/ci.yml` edit cannot be pushed by the Arena GitHub App
(lacks the `workflows` permission — see "CI wiring" below). Claimed 2026-09-20.
**Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-005;
`issues/09-db-push-not-idempotent.md` (option B). **Size:** M.

## Objective (from the plan task)

A clean database reaches the current schema via committed, ordered migrations alone;
`db:push` is no longer the evolution path; pg-boss schema versioning is documented.
Hard dependency for Phases 3–6.

## Recon (2026-09-20)

- Plan step (1) is **done already** — NWB-P0-009 shipped option A: all 82
  `primaryKey()` sites across `db/` carry `.notNull()` (chain-aware count, including
  the multi-line shared-PK sites in the aspirational `pr`/`influencer` dirs). Nothing
  left to fix there.
- `drizzle/` does not exist — the "one dormant manual SQL file" is the committed
  `db/manual-migrations/campaign-domain-disambiguation.sql` (ADR-017 renames for the
  PR/influencer modules, which the active schema excludes). Plan step (4): record it
  as "applies when pr/influencer are adopted — fold into that module's first
  migration". It stays where it is; the note lands here and in `drizzle/README.md`.
- `package.json` has `db:generate` but no `db:migrate`.
- CI `test` job still uses `db:push --force` on a fresh service container; its comment
  block is stale twice over (claims push is non-idempotent — 42P16 is gone since 009;
  claims drizzle.config reads `DB_*` — it has read `DATABASE_URL` since 009).
- `drizzle.config.ts` already points `out` at `./drizzle/migrations`.

## Plan

1. ~~Add `.notNull()` to the remaining `primaryKey()` sites~~ — already complete
   (009 covered all 82, verified chain-aware).
2. `bun run db:generate` → `drizzle/migrations/0000_*.sql` + `meta/`
   (`_journal.json`, `0000_snapshot.json`). Verify statement census matches the
   active schema (28-table claim is stale — count from the generated SQL itself).
3. `package.json` → `db:migrate` = `drizzle-kit migrate`; document.
4. CI: replace the `Push schema` step with `db:migrate` and run it **twice** (second
   run proves the idempotent-no-op guarantee the acceptance criteria require) + fix
   the stale comment block.
5. `drizzle/README.md` — pg-boss note (library-managed schema; the Phase 2 queue task
   runs `pgBoss.start()` idempotently at process start, its tables must NOT enter the
   drizzle baseline), push-stays-for-dev note, ADR-017 pointer to
   `db/manual-migrations/`.
6. Docs: `AGENTS.md` Database fact, `spec.md` Done/index, plan-note that NWB-P0-009
   is closed.

## Verification / acceptance (plan task, verbatim bar)

- Clean DB + `db:migrate` + seed + `bun test` = green.
- Re-run `db:migrate` = no-op (also exercised in CI).
- `db:push` on the migrated DB converges (42P16 gone) — verify and record.
- CI green on both jobs with the new migrate step.

## Evidence (2026-09-20; local PG 14.23 embedded = CI floor)

- `bun run db:generate` → **`drizzle/migrations/0000_tense_goliath.sql`**
  (+ `meta/_journal.json`, `meta/0000_snapshot.json`); census **30 tables,
  439 index statements, 225 enum types** — supersedes the plan's stale
  "28-table" phrasing (rate_limits and data_export_requests landed since).
- **Acceptance loop on a virgin cluster:** `db:migrate` → `seed` →
  `bun test` ⇒ **353 pass / 0 fail** (39 files).
- **Idempotency:** second `db:migrate` is a true no-op — output is the
  generic success line and the `drizzle.__drizzle_migrations` ledger holds
  exactly 1 row afterward.
- **Push converges on the migrated DB:** `db:push --force` completes with
  no 42P16; its remaining diff is the already-documented 36 ×
  `DROP INDEX IF EXISTS` + `CREATE INDEX IF NOT EXISTS` pairs for
  descending/partial indexes (drizzle-kit introspection gap — compare
  `AGENTS.md` Database §, verified deterministic across consecutive runs:
  identical statement sets, safe to re-run, which is exactly why push is
  dev-only now).
- CI: `Push schema` step replaced by `Apply schema migrations` +
  `Verify migrations are idempotent` (a second `db:migrate`); the stale
  comment block (DB_*/42P16) rewritten. The DB_* step env was dropped —
  `drizzle.config.ts` reads `DATABASE_URL` since 009.
- `package.json` gains `db:migrate` (`drizzle-kit migrate`); `db:push`
  explicitly demoted to dev convenience (package.json note lives in
  docs — `drizzle/README.md` + AGENTS.md Database §, plan step (6)).
- `drizzle/README.md` records the pg-boss rule (library-managed schema,
  never in this baseline) and the ADR-017 pointer:
  `db/manual-migrations/campaign-domain-disambiguation.sql` applies when
  pr/influencer are adopted — fold into that module's first migration.
- NWB-P0-009 is closed with this: its option B is now the shipped state.

## Acceptance

- [x] Clean DB + `db:migrate` + `seed` + `bun test` = green (353/0).
- [x] Re-run `db:migrate` = no-op (local + enforced in CI).
- [x] `db:push` on migrated DB converges (42P16 gone; deterministic residual
      index-pair no-op documented).
- [ ] **CI green on both jobs with the new migrate step** — blocked, see below.
- [x] pg-boss + ADR-017 documented (`drizzle/README.md`).
- [x] Plan NWB-P0-009 closed.

## CI wiring — blocked on GitHub App permission (ACTION NEEDED)

The CI edit (replace the `Push schema` step with `Apply schema migrations` + a
second idempotency run, comment block rewritten) is complete but could not be
pushed: the Arena GitHub App token has no `workflows` permission
(`refusing to allow a GitHub App to create or update workflow .github/workflows/ci.yml`).

**Patch (verbatim from the working state at commit `ae29592`, reverted for push):**

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ the test job, after "Install dependencies":
-      # drizzle.config.ts reads DB_* rather than DATABASE_URL (see NWB-P0-009), so
-      # the connection has to be supplied twice. `--force` suppresses the prompt that
-      # `strict: true` would otherwise raise on a non-interactive runner.
-      #
-      # This works only because the service container starts empty. It is NOT
-      # idempotent — a second push against the same database fails with 42P16 — which
-      # is why NWB-P0-005 must eventually replace this step with `db:migrate`.
-      - name: Push schema
-        run: bun run db:push -- --force
-        env:
-          DB_HOST: localhost
-          DB_PORT: "5432"
-          DB_NAME: nawebeus_test
-          DB_USER: postgres
-          DB_PASSWORD: postgres
+      # Schema evolution is migration-only (NWB-P0-005): `drizzle/migrations/` is the
+      # committed history and `db:migrate` is idempotent — it works against a virgin
+      # database AND an already-migrated one, which `db:push` never could (42P16).
+      # The second run is the standing proof of the no-op guarantee the plan task's
+      # acceptance criteria require: one ledger row, zero statements.
+      - name: Apply schema migrations
+        run: bun run db:migrate
+
+      - name: Verify migrations are idempotent (second run is a no-op)
+        run: bun run db:migrate
```

The exact sequence was executed locally against a virgin PG 14.23 cluster
(same as CI's service container): migrate → seed → `bun test` 353/0 → migrate
again (no-op) → push converges. To land: reconnect GitHub with the `workflows`
permission, or apply the block above by hand in the GitHub UI, then flip this
ticket's status to done and record the CI run.
