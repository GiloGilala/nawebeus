# P0 — Close the foundation gap

**Feature slug:** `p0-foundation-gap`
**Spec owner:** Engineering Lead
**Status:** in-progress — the MVP defect set is closed; the infrastructure pair is not.
**Done:** NWB-P0-001 (API keys), 003 (CI), 004 (linter), 007 (adopt decisions), 008 (concurrent
lockout), 009 (`db:push` convergence + `DATABASE_URL` unification), 010 (owner at signup),
011 (org subject), 012 (MFA login flow), 013 (rate limiter), 014 (role model + self-protection),
015 (status enforcement), 016 (invitation accept, F-08 — incl. the invite-time F-07 class
and the residual F-20 list/dedup work), 017 (CORS + IP policy), and the findings raised
while landing them — 024 (missing `users.scheduled_deletion_at`), 025 (org-owner purge
refused at delete time, F-25 / D16), 026 (duplicate route mirror), 027 (lint gate red at
HEAD), 028 (purge attribution FKs, F-28 — filed while landing 025),
006 (foundation issue-07 reconciled — `.scratch/foundation` is now fully `done`),
023 (organization deletion, PRD 8.2.1 / D-14 — incl. the reactivation lockout it
uncovered and the D16 re-measurement),
and 002 (DSAR data export, AC8 of FR-AUTH-007), plus 005 (migration baseline —
`drizzle/migrations/` is the committed evolution path; the CI step switch to
`db:migrate` is locally proven and blocked only on the GitHub App's missing
`workflows` permission — see the ticket), and 018 (CASL scope cleanup, F-06 —
the inert org condition removed, the real enforcement chain documented, and a
route-invariant scan that fails any `:orgId` route missing `requireOrgMatch`).
**Outstanding — all of it needs someone with repo-owner access or a product call:**
**NWB-P0-022** (branch protection; settings change, exact values specified in its ticket),
**NWB-P0-005's last step** (CI still runs `db:push`, not `db:migrate` — blocked on the
GitHub App's `workflows` permission), and two decisions that are not an agent's to take:
**D11** (RLS — recorded as DEC-O009 with a written recommendation) and **D12**
(module-set scope — options memo written). Every other ticket, 01–28, is **done**.

> **2026-09-20 (latest): the last two blockers were re-tested, not assumed (NWB-P0-022).**
> Both are credential limits, and both are now proven with the exact failure. Branch
> protection: the agent token reports `admin:false` and **403s on even reading**
> `/branches/main/protection`; `rulesets` is empty, so `main` has **no protection of any
> kind** and a red PR can still merge. The ops ticket carries the click-through settings and
> the `gh api` equivalent, and flags the trap that the required checks must be the job
> *names* (`Typecheck, lint, build`, `Test (PostgreSQL)`) — entering the roadmap's job ids
> `quality`/`test` would create a rule nothing can ever satisfy, blocking every merge.
> Reading the workflow also caught an overstatement of mine: **CI still runs
> `db:push -- --force`, not `db:migrate`**, so Phase 1 exit criterion 3 is only *partly* met
> — NWB-P0-020 had scored it green on the strength of the migration path alone. Corrected
> there and in the roadmap.
>
> **2026-09-20: P0 bookkeeping closed (NWB-P0-019) — with two decisions
> deliberately left open.** `p0-auth` flipped to `done` (10/10 Module 1 FRs) after checking
> that all three blockers — API keys, MFA login, DSAR export — are really in the tree.
> D15 became **DEC-040 (Approved): the MVP API ships unversioned**, which ratifies what is
> already built and closes discrepancy D-11. D11 became **DEC-O009 (Open)**: I verified the
> premise first (live database: **0 RLS policies, 0 tables with `relrowsecurity`**, no RLS
> statement anywhere in the repo, against an ADR-009 that was Accepted in June) and recorded
> a written recommendation — defense-in-depth in Phase 8, application layer stays primary —
> but left it unapproved, because choosing between implementing RLS and superseding ADR-009
> is an architecture and procurement call, not an implementation detail. D12 likewise stays
> a product call. Recording a recommendation is not the same as taking the decision.
>
> **2026-09-20: the verification log is re-measured, not carried forward (NWB-P0-020).**
> Every "last verified" number in the plan dated from 2026-09-13 at HEAD `049a837`, and the
> sandbox that wrote the roadmap could not run Bun at all — so some figures had never been
> executed anywhere. Re-run at HEAD `51c1a2d` against a **freshly created empty** PostgreSQL
> 14.23: `db:migrate` from zero PASS, **re-run a no-op** (Phase 1 exit criterion 3 now evidenced
> directly), seed idempotent, **395 pass / 0 fail** with a database, 222 pass / 184 skip without,
> lint 0 errors, build PASS. Verifying also caught doc drift unrelated to counts: plan §1 said 28
> tables (it is 30) and still cited the `src/app/*` route mirrors deleted in NWB-P0-026. Exit
> criteria re-scored against evidence — **5 is the one genuine gap** (D11/D12/D15 missing from
> the Decision Log → NWB-P0-019).
>
> **2026-09-20: emailed link bases are server-decided (NWB-P0-021), closing a live
> account-takeover path.** The ticket read as hygiene — a wrong signup link, a client `Origin`
> used as the resend base. The audit found the same header base on *unauthenticated*
> `POST /api/auth/forgot-password`: sending `Origin: https://evil.example.com` returned 200 and
> emailed the victim a **valid reset token** on the attacker's domain. Reproduced against the
> real code before touching it, now pinned as a regression test (and verified red against the
> pre-fix service). Fix is one derived `APP_BASE_URL_RESOLVED` in `config.ts`; the `origin`
> parameter was deleted from the service signatures so no call site can pass one, which also
> surfaced two Server Functions that had been emitting relative — unclickable — links.
>
> **2026-09-20: organization deletion ships (NWB-P0-023), and it found a defect in
> its own design.** Soft-deleting an organization suspends every membership *including the
> owner's*, so `assertActivePrincipal` would have locked the owner out of the only route that
> undoes it — the 30-day grace PRD 8.2.1 promises would have been unreachable without a manual
> database edit. Fixed with a single-route escape hatch
> (`authMiddlewareAllowingInactiveMembership`) that relaxes *only* the active-membership
> requirement, fenced in by four containment tests. Separately, D16's "relax the account-deletion
> gate for sole-member orgs" follow-up was **measured and declined**: a soft-deleted org still
> holds the restrictive `owner_id` FK, so relaxing it reintroduces F-25's 23503 verbatim
> (negative control test). The hard purge is the unblock, and that path now works end to end.
> Suite: **383 pass / 0 fail** with a live database.

> **2026-09-20: `.scratch/foundation` is fully `done` (NWB-P0-006).** Its issue 07
> carried six unticked boxes under a `done` status. Audit: four were honestly tickable on
> existing evidence; two named integration tests (non-existent role → 404, non-admin → 403)
> genuinely did not exist — the behaviour was correct, nothing pinned it. Both written, plus
> a third for the unpinned member-id case. Two wording mismatches are recorded rather than
> "fixed": the ticket's `PATCH /api/organizations/:id/members/:memberId/role` does not exist
> (as-built: `POST /orgs/:orgId/members/assign-role` and `PATCH /orgs/:orgId/members/:memberId`
> with `roleId`), and the last-`org_admin` rule is ticked against its DEC-039 successor,
> `assertNotLastAdministrator`. Suite: **363 pass / 0 fail** with a live database.
> This closes the exit-gate clause "foundation `.scratch` set fully `done`".

> **2026-09-20: F-06 is closed and the IDOR class is now caught by CI.** NWB-P0-018
> removed the `{ organizationId }` condition `loadAbility` attached to every rule — it was
> inert (CASL v7 skips conditions for string subjects, and every check here passes a string),
> so the removal is behaviour-identical and the "3-layer defense" in Security Architecture
> §4.3 now reads as what it is. §4.3.1 states the chain that actually runs, the CASL trap is
> pinned by a regression test, and a new static scan (`src/tests/route-invariants.test.ts`)
> fails any `:orgId` route that omits `requireOrgMatch`. Suite: **360 pass / 0 fail** with a
> live database (was 353), 215 pass / 152 skip / 0 fail without one; `biome check .` clean.

> **2026-09-20:** the merged tree was red — one test
> (`Server Functions — integration (with DB)`) failed on a **missing `users.scheduled_deletion_at`
> column** (F-24), which also 500'd `GET /api/users/me` for every authenticated user. Fixed in
> NWB-P0-024. Suite now **325 pass / 0 fail** with a live database and 208 pass / 123 skip /
> 0 fail without one; `biome check .` is clean (F-27). NWB-P0-015 landed on top: `users.status`
> is enforced at sign-in and on every request. **CI has been running all along** (this spec's
> "first run pending" note was wrong) and is **green on PR #12** for both jobs — the first green
> run since PR #11's merge, which failed on those 18 lint errors. `main` can still merge red:
> branch protection is unset (NWB-P0-022).

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
| NWB-P0-005 | Migration baseline | — | M | `issues/05-migration-baseline.md` — **code done; CI workflow edit blocked on GitHub `workflows` permission** |
| NWB-P0-006 | Reconcile `.scratch/foundation` issue 07 → `done` | NWB-P0-001, NWB-P0-014 | S/M | `issues/06-reconcile-foundation-07.md` — **done** |
| NWB-P0-007 | Adopt decisions D1 + D5; track D2–D12 | — | S | [issues/07-adopt-decisions.md](issues/07-adopt-decisions.md) |
| NWB-P0-008 | Concurrent sign-in lockout is a lost update | — | S | `issues/08-concurrent-lockout-lost-update.md` |
| NWB-P0-009 | `db:push` cannot converge on an existing database | NWB-P0-005 | M | `issues/09-db-push-not-idempotent.md` — **done** |
| NWB-P0-010 | Assign the Owner role atomically at signup (F-01) | D13 | M | `issues/10-owner-role-at-signup.md` — **done** |
| NWB-P0-011 | Org permission subject `org` vs `organization` (F-02) | D13 | S | `issues/11-org-permission-subject.md` — **done** |
| NWB-P0-014 | Role model (DEC-039) + real self-protection guards (F-07, F-21) | D13 | M | `issues/14-role-model-and-self-protection.md` — **done** |
| NWB-P0-015 | Enforce user status at sign-in (F-05) | — | M | `issues/15-user-status-enforcement.md` — **done** |
| NWB-P0-016 | Invitation accept flow (F-08; incl. invite role ladder + residual F-20) | D14 interim | M | `issues/16-invitation-accept.md` — **done** |
| NWB-P0-018 | CASL scope cleanup — make the scoping decision explicit (F-06) | D11 (wording) | S/M | `issues/18-casl-scope-cleanup.md` — **done** |
| NWB-P0-019 | Close out P0 bookkeeping (documentation) | — | S | `issues/19-p0-bookkeeping.md` — **done** |
| NWB-P0-020 | Re-run the verification log (Appendix C) | — | S | `issues/20-rerun-verification-log.md` — **done** |
| NWB-P0-021 | Email link consistency (F-09, F-09b) | — | S/M | `issues/21-email-link-consistency.md` — **done** |
| NWB-P0-022 | Branch protection + CI as a real gate | — | S | `issues/22-branch-protection.md` — **blocked (ops: needs repo admin)** |
| NWB-P0-023 | Organization deletion (PRD 8.2.1 P0; D-14) | — | M | `issues/23-organization-deletion.md` — **done** |
| NWB-P0-024 | Account deletion referenced a missing column (F-24) | — | S | `issues/24-scheduled-deletion-column.md` — **done** |
| NWB-P0-025 | `purgeExpiredAccounts` cannot delete an org owner (F-25) | NWB-P0-023 | S/M | `issues/25-org-owner-purge-fk.md` — **done** |
| NWB-P0-026 | Duplicate Hono route mirror under `src/app/**` (F-26) | — | S | `issues/26-duplicate-route-mirror.md` — **done** |
| NWB-P0-027 | `bun run lint` red at HEAD — CI quality job could never pass (F-27) | NWB-P0-004 | S | `issues/27-lint-gate-red-at-head.md` — **done** |
| NWB-P0-028 | Purge 23503s on `api_keys.*_by` / `tokens.revoked_by` (F-28) | — | S | `issues/28-purge-attribution-fks.md` — **done** |

> **Every ticket now has a file: 01–28.** All are `done` except **05** (code complete,
> blocked on the GitHub App's missing `workflows` permission) and **22** (a GitHub
> *settings* change needing repo admin). Both blockers were re-verified by experiment on
> 2026-09-20 rather than assumed — see those two tickets for the exact 403s and the
> remote-rejection message. The Phase 1
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
