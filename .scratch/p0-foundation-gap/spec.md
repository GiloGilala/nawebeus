# P0 — Close the foundation gap

**Feature slug:** `p0-foundation-gap`
**Spec owner:** Engineering Lead
**Status:** in-progress — 6/7 done. Done: NWB-P0-001 (API keys), NWB-P0-003 (CI), NWB-P0-004
(linter), NWB-P0-007 (adopt decisions), NWB-P0-008 (concurrent lockout lost update, 2026-09-13),
**NWB-P0-009 (`db:push` convergence + `DATABASE_URL` unification, 2026-09-20)**,
**NWB-P0-002 (DSAR export, 2026-09-20 — includes the `withAtomicWrites` harness-commit fix
in 010's helper)**, and the Phase 1 tickets NWB-P0-010 / 011 / 014. Outstanding:
migration baseline (05), foundation issue-07 reconciliation (06 — the API-key half is now
`done`; the role-assignment half was already shipped and its boxes are still unticked).
Two findings raised during NWB-P0-001's verification are filed as NWB-P0-008 and NWB-P0-009.

> **2026-09-13:** the suite half of the exit gate is met — `bun test` is **159 pass / 0 fail**
> with a live database (was 146/12), and `.github/workflows/ci.yml` now runs typecheck, lint,
> build, and the full suite against a `postgres:14` service container. **The only part of the
> exit gate not yet satisfied is the first real CI run** — the workflow is written and was
> simulated step-for-step against a fresh database, but it has not executed on GitHub Actions,
> and branch protection on `main` is not yet configured to require it. See `issues/03-ci-pipeline.md`.
>
> **2026-09-13 (later): the trigger mismatch is fixed; the remote is not.** The branch was
> `master` while `ci.yml` only fired on `main`/`feature/**`/`bugfix/**`/`hotfix/**` — so the
> workflow could never have run. Branch renamed to `main` (`git branch -m`), and all P0 work is
> now committed: `55be0f2` (tooling, CI, docs) and `87008b6` (API keys + the four sign-in
> breakers). **Still blocking: `git remote -v` is empty.** No remote means no push, no CI run,
> and nowhere to configure branch protection. Needs a GitHub repo and `git remote add origin …`.


## Summary

Make the existing foundation genuinely complete and enforceable before building on it.
Phase P0 of `docs/plan/IMPLEMENTATION EXECUTION PLAN.md`.

The repo is at baseline HEAD `049a837` with 96 tests passing, 0 failing, 33 skipped
(DB-gated). Module 1 is 9/10 FRs implemented. Nothing enforces the suite: there is no CI,
no linter, and no migration history.

**Entry gate:** none — this is the first phase.
**Exit gate:** `bun test` green **in CI with a live database**; FR-AUTH-010 implemented and
tested; migrations reproducible from zero; foundation `.scratch` set fully `done`.

## Ticket index

| ID | Ticket | Deps | Size | File |
| --- | --- | --- | --- | --- |
| NWB-P0-001 | API key management (FR-AUTH-010) | — | L | `issues/01-api-key-management.md` |
| NWB-P0-002 | DSAR data export (AC8 of FR-AUTH-007) | — | M | `issues/02-dsar-export.md` — **done** |
| NWB-P0-003 | CI pipeline | — | M | `issues/03-ci-pipeline.md` |
| NWB-P0-004 | Linter (Biome) | — | S | `issues/04-linter.md` |
| NWB-P0-005 | Migration baseline | — | M | `issues/05-migration-baseline.md` |
| NWB-P0-006 | Reconcile `.scratch/foundation` issue 07 → `done` | NWB-P0-001 | S | `issues/06-reconcile-foundation-07.md` |
| NWB-P0-007 | Adopt decisions D1 + D5; track D2–D12 | — | S | [issues/07-adopt-decisions.md](issues/07-adopt-decisions.md) |
| NWB-P0-008 | Concurrent sign-in lockout is a lost update | — | S | `issues/08-concurrent-lockout-lost-update.md` |
| NWB-P0-009 | `db:push` cannot converge on an existing database | NWB-P0-005 | M | `issues/09-db-push-not-idempotent.md` — **done** |
| NWB-P0-010 | Assign the Owner role atomically at signup (F-01) | D13 | M | `issues/10-owner-role-at-signup.md` — **done** |
| NWB-P0-011 | Org permission subject `org` vs `organization` (F-02) | D13 | S | `issues/11-org-permission-subject.md` — **done** |
| NWB-P0-014 | Role model (DEC-039) + real self-protection guards (F-07, F-21) | D13 | M | `issues/14-role-model-and-self-protection.md` — **done** |

> Tickets 02, 05, and 06 are listed here but their files do not exist yet — the index was
> written ahead of the tickets. Files present: 01, 03, 04, 07, 08, 09, 10, 11, 14. The Phase 1
> task list (012…023) is in `docs/plan/master-roadmap/06-phase-1-foundation.md`; tickets are
> filed here as they are picked up.


## Decisions

D1 and D5 are resolved. D4 and D7 were found to be already resolved by an approved
business decision the execution plan had not consulted. The full register — including
three new findings that need a product call — is in [decisions.md](decisions.md).

**Blocking for later phases:** D12 (module-set scope) must be resolved before P3, P8, P9,
or P10 starts. It does not block P0's exit gate. Options analysis:
[D12-scope-decision-memo.md](D12-scope-decision-memo.md) — recommendation is Option A
(strict DEC-005), on the grounds that it is the only option requiring zero supersessions.

## Notes for whoever picks this up

- `db/core/api-keys.ts` **already defines** the `apiKeys` table and `db/schema.ts` already
  exports it. NWB-P0-001 is service + routes + `Bearer` middleware + tests — no new table.
  The execution plan's §1.2 reads as if the feature is absent end to end; it is not.
- `.scratch/` is gitignored except `**/*.md`, so these files are tracked.
- **The 12 pre-existing failures are fixed — 2026-09-13.** Running `bun test` against a live
  database executes the DB-gated suites for the first time in the repo's history (they had always
  silently skipped). The suite is now green: **159 pass / 0 fail** against
  `postgresql://localhost:5432/nawebeus_test`, verified stable across repeated runs; **102 pass /
  61 skip / 0 fail** with no database configured. The suite half of the exit gate is therefore
  met. **NWB-P0-003 (CI) is now done** — `.github/workflows/ci.yml` runs the suite against a
  `postgres:14` service container. What is left of the exit gate is the first real CI run plus
  branch protection on `main`.
- **The suite is not independent of seed data.** Running it against a freshly pushed but
  *unseeded* database fails 7 tests (the `seed data` group, `RBAC integration`, and `signin with
  valid credentials`) — they need the seeded permission/role/ability graph. CI therefore runs
  `bun run seed` between `db:push` and `bun test`. Worth knowing before anyone "simplifies" the
  workflow by dropping that step.

- **The 12 failures were hiding four independent sign-in breakers**, none of them P0-001's fault:
  1. `createTestUser` (`src/tests/helpers/test-factory.ts`) and `src/seed.ts` stored passwords as
     **plaintext**. `Bun.password.verify` *throws* `UnsupportedAlgorithm` on a non-bcrypt value
     rather than returning `false`, so every sign-in path exploded before it could compare. No
     factory-created user and no seeded bootstrap admin could ever sign in. Both now hash.
  2. `sessions.ip_address` was `inet NOT NULL`, but the signin route passed the literal
     `"unknown"` and `createSession` passed `null` — both invalid for `inet` (`22P02`). The column
     is now nullable, and values pass through a strict validator (`src/lib/ip.ts`) that rejects
     `"unknown"`, CIDR blocks, and `0.0.0.0` rather than coercing them.
  3. `sessions.expires_at` was `NOT NULL` with no default and `createSession` never set it
     (`23502`). TTL now has a single source of truth (`sessionTtlSeconds`), shared with the JWT
     expiry in `auth.service`.
  4. The refresh cookie set `partitioned: true` without `secure`. CHIPS requires both, and Hono
     throws otherwise — so sign-in worked in production and 500'd in dev and test.
  Also fixed: the `rate_limits` table that `checkRateLimit()` had queried since it was written
  **did not exist** (`42P01`). The failure was swallowed and the aborted statement poisoned the
  enclosing transaction (`25P02`), so BR-AUTH-018 was silently inoperative. It is now defined in
  `db/core/rate-limits.ts`.
- **Two findings filed rather than fixed silently** — both need decisions, not patches:
  - **NWB-P0-008** — concurrent-login lockout is a lost update. `signIn` reads
    `failed_login_attempts`, awaits bcrypt, then writes, so N parallel wrong passwords all read
    the same value and count as **one** failure. The lockout is inert against parallelised
    credential stuffing. The test was made sequential to stop it flaking, which hides the bug
    rather than fixing it.
  - **NWB-P0-009** — `db:push` cannot converge on an existing database (`42P16`; 81
    `primaryKey()` declarations, none with `.notNull()`). It also reads `DB_*` while everything
    else reads `DATABASE_URL`, so a push can silently target the wrong database. Belongs to
    NWB-P0-005.

- Test-infrastructure change worth knowing about: `bunfig.toml` now preloads
  `src/tests/preload.ts`, which supplies the always-required JWT secrets once per run. Twelve
  test files used to `delete` env keys they had only conditionally set, wiping `DATABASE_URL`
  for every suite that ran afterwards and making the DB-gated suites skip in a
  file-order-dependent way. Their `afterAll` now only removes what the file itself set.
