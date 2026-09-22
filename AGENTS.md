## Overview

Nawebeus is a multi-tenant social media management and PR intelligence SaaS. The API server is built with **Bun** + **Hono** + **Drizzle ORM** (PostgreSQL). The domain glossary is in `CONTEXT.md` — use its exact terms (Organization, Membership, Content, Conversation, etc.) in code, test names, and issue titles.

## Dependencies

**Before adding any new dependency, check whether Bun 1.4 can already do it.** Bun ships a broad standard library and implements most of Node's, so a package is often unnecessary. Check these first:

- Crypto & hashing — `Bun.password` (argon2id / bcrypt), `Bun.CryptoHasher`, `crypto.subtle`
- SQL, cache, storage — `Bun.sql` (Postgres), `bun:sqlite`, `Bun.redis`, `Bun.s3`
- HTTP — `Bun.serve`, the built-in `fetch` / `Request` / `Response`
- Files, processes, globbing — `Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.Glob`, `Bun.$`
- Test & runtime utilities — `bun:test`, `Bun.env`, `Bun.deepEquals`, `Bun.escapeHTML`, `Bun.semver`, `Bun.sleep`, `Bun.cron`, `Bun.randomUUIDv7`
- Node built-ins are implemented — `node:fs`, `node:path`, `node:crypto`, `node:stream`, `node:zlib`, `node:events`, `node:url`, `node:util`, `node:buffer`, `node:http`

Only add a package once you have confirmed Bun can't cover the need — and say in the PR what you checked. This rule governs **new** dependencies only; the existing set (`hono`, `drizzle-orm`, `zod`, `pg`, `@casl/ability`, `pg-boss`) is settled, so don't propose replacing it on these grounds.

`pg-boss` (NWB-P1-001) is the one exception worth recording, because the check has already been
done and written down: **ADR-028** chose it deliberately over `Bun.cron` (a trigger, not a queue —
no persistence, retry, backoff, or job state), over in-process `setTimeout`/`setInterval` (jobs die
with the process, no depth visibility), and over BullMQ+Redis (a second service on a self-hosted VPS,
ADR-008). It stores jobs in the PostgreSQL instance ADR-003 already provides and manages its own
schema; its tables never enter `db/schema.ts` or `drizzle/migrations/`.

## Developer commands

### Setup

```bash
bun install
cp .env.example .env
# Edit .env to point DATABASE_URL *and* DB_* at a local PostgreSQL 14+ instance, then:
bun run db:generate    # emit a new migration from db/schema.ts changes
bun run db:migrate     # apply committed migrations (idempotent)
bun run db:push        # dev-only schema push; NOT the evolution path
bun run seed            # seed permissions, roles, bootstrap org + admin
```

No PostgreSQL server (and no Docker)? `docs/agents/local-database.md` has a zero-dependency recipe (`embedded-postgres` from a scratch directory outside the repo) that reproduces CI's full suite in ~13 s.

### Daily

```bash
bun run dev             # hot-reload dev server (src/index.ts) — also starts the queue runtime
bun test                # run all tests
bun run typecheck       # tsc --noEmit
bun run build           # typecheck + bundle to dist/
bun run queue:worker    # workers + scheduler only, no HTTP server (ADR-007's other half)
bun run queue:run --list            # the queues that exist, and what each one does
bun run queue:run <queue-name> ['{"json":"data"}']   # run one job now, same audit events
```

### Tests

- `bun test` — runs all tests. Tests requiring a database (275 of them) are silently skipped when `DATABASE_URL` is unset. Set it to run the full suite — see `docs/agents/local-database.md` for getting a database with nothing installed.
- Run a single test file: `bun test src/tests/auth/signup.test.ts`
- DB-backed tests use `withTestDb(...)` — wraps each test in a `BEGIN`/`ROLLBACK` transaction so the database is automatically cleaned between tests. No manual cleanup needed.
- Tests that don't need the DB use `createTestApp()` (from `src/tests/helpers/test-client.ts`), which injects a no-op database that throws if queried.
- **`src/tests/queue/loop.test.ts` is the one suite that does not use `withTestDb`, and it must not.** pg-boss claims jobs on its own connection, outside any transaction the harness opens, so rollback-based isolation cannot contain it; the suite installs into a throwaway `pgboss_test_*` schema and drops it in `afterAll`. Write a queue test that way or don't write one — pointing pg-boss at the app schema commits real rows.
- **Coverage:** `bun run coverage` writes `coverage/lcov.info`, then `bun run coverage:check` enforces the gate (`src/scripts/check-coverage.ts`). Thresholds are **aggregate line coverage per directory**: `src/services` ≥ 85%, `src/lib` ≥ 90% (Engineering Standards p. 730). Currently 92.3% / 97.0% (NWB-P1-010). Deliberately *graduated* — only those two directories are gated; routes and server functions join in Phase 2 with the queue services, because gating them today would be permanently red. The gate also fails if a gated directory is **absent** from the report, so deleting a test suite cannot read as a coverage improvement. **It is not yet a CI step** (the workflow file cannot be pushed by the Arena GitHub App — same block as NWB-P0-005), so treat it as a local/maintainer gate, not an enforced one. See NWB-P0-031.
- **Coverage gating cannot be done via `bunfig.toml` on Bun 1.4.** `coverageThreshold` is per-file, prints no failure message, is enforced only when the `text` reporter is enabled, cannot tolerate a file at 0% coverage at *any* threshold (including `0.0`), has no missing-file guard, and silently accepts keys it doesn't recognise. The docs' proposed `--coverage-threshold='{"services":85,"lib":90}'` is not a real flag — it is silently ignored, so it can never fail. Enforce coverage from a script over `coverage/lcov.info` instead. Verified findings: `.scratch/p0-foundation-gap/issues/03-ci-pipeline.md`.

### CI

`.github/workflows/ci.yml` runs on every push to `main`/`feature/**`/`bugfix/**`/`hotfix/**` and every PR into `main`.

| Job | Steps |
| --- | --- |
| `quality` | `bun install --frozen-lockfile` → `typecheck` → `lint` → `build` |
| `test` | `bun install --frozen-lockfile` → `db:migrate` (×2 — the second run proves idempotency) → `seed` → `bun test` against a `postgres:14` service container |

- **PostgreSQL 14 is deliberate** — ADR-003 sets 14+ as the floor, so CI tests the floor. The generated DDL needs no extensions and nothing newer than PG14.
- Bun is pinned to `1.4.0` (the lockfile's version); do not float it.
- `bun run lint` runs `biome check .` — formatting, linting, and import order in one pass. It exits non-zero on **errors only**; warnings do not fail the build. `lint:fix` applies safe fixes, `format` formats without linting.
- The `db:migrate` step needs only `DATABASE_URL` — `drizzle.config.ts` resolves the connection from it and refuses to run when a `DB_*` variable disagrees with it (NWB-P0-009).
- Local reproduction of the `test` job: create a fresh database, then run `db:migrate`, `seed`, and `bun test` with `DATABASE_URL` set. Dev convenience only: `db:push -- --force` against throwaway databases (see the Database section). Step-by-step, including a no-install PostgreSQL 14: `docs/agents/local-database.md`.
- Deliberately absent (no tooling yet, and each would be permanently red): coverage thresholds, `bun audit`/Snyk/Trivy, Playwright, Codecov, `db:migrate`, deploy. Formatting and linting are now covered by Biome; ESLint and Prettier are not used and should not be added.


### Database

- **Schema evolution is migration-only (NWB-P0-005).** `drizzle/migrations/` is the committed, ordered history of the active schema. Change `db/**`, run `bun run db:generate`, review the generated SQL, commit it, apply with `bun run db:migrate` (idempotent — the `drizzle.__drizzle_migrations` ledger makes a second run a no-op). See `drizzle/README.md` for the rules of the road, incl. **pg-boss being library-managed** (its tables never enter the drizzle baseline) and the ADR-017 pointer (`db/manual-migrations/` applies when PR/influencer are adopted).
- `bun run db:push` — dev convenience only against disposable databases; NOT a migration history, never the evolution path.
- **`db:push` reads `DATABASE_URL`** — the same variable the app and the tests read (`src/lib/db-config.ts` is the resolver; `drizzle.config.ts` calls it). The old `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` variables still work as a fallback when `DATABASE_URL` is unset, but when **both** are set and any of them disagrees with the URL, `db:push` exits with an error naming the conflict instead of silently picking a database. See NWB-P0-009.
- **`db:push` always needs `-- --force`** (dev use). `strict: true` makes drizzle-kit prompt even on a fresh database; with a closed stdin (CI, scripts) it aborts **silently while exiting 0**, leaving zero tables pushed — a green no-op. Always `bun run db:push -- --force`.
- **`db:push` converges, with one known exception** (verified 2026-09-20, NWB-P0-009). The old `42P16` failure on re-push is fixed (every `primaryKey()` now carries `.notNull()`, matching what PostgreSQL actually stores) and two churn sources are gone: the `analytics_aggregates` composite PK has an explicit ≤63-char name (PostgreSQL truncates identifiers to 63 bytes, so drizzle's 120-char generated name could never round-trip), and `api_keys.rate_limits` uses a compact jsonb literal default (PG deparses jsonb defaults with spaces; drizzle-kit compares textually after stripping them). The remaining exception: every push drops and recreates the **36 descending/partial indexes**. drizzle-kit models `desc()` as a raw SQL expression and predicates as drizzle-rendered text, while introspection reports sorted plain columns and PG-normalized predicates — the two textual forms can never agree. Verified unfixed in both drizzle-kit 0.28.1 and latest 0.31.10; the statements are semantically no-ops. Since NWB-P0-005, push is dev-only; `db:migrate` is the path for anything that matters.
- `bun run db:generate` — generate the next migration into `drizzle/migrations/`; `bun run db:migrate` — apply committed migrations (idempotent).
- `bun run db:studio` — open Drizzle Studio GUI.
- `bun run seed` — seed permissions, roles, the bootstrap admin, and its organization. **Idempotent and convergent**: role-permission grants not in the seed's matrix are removed on re-run, and the pre-DEC-039 roles (`org_admin`, `member`) are retired with their memberships re-pointed (`admin`, `creator`). The test suite depends on it: against an unseeded database 7 tests fail (the `seed data`, `RBAC integration`, and `signin with valid credentials` groups).

## Architecture

### Layers (current)

> **Last verified against HEAD `c2a2453` on 2026-09-20 (NWB-P0-020 re-run; counts refreshed by NWB-P0-029).** If the
> tree below looks older than the working copy, re-verify before trusting it —
> `src/` is always the source of truth.

**Two entry points, one `services/` layer.** The Hono API serves `/api/*` for mobile,
webhooks and third parties; the web app goes through TanStack Start Server Functions
(`src/app/server-functions/**`), which call `src/services/*` in-process (ADR-002/ADR-007).
Anything in the planning docs that points at `src/app/auth/…`, `src/app/users/…`,
`src/app/orgs/…` or `src/app/api-keys/…` as a *route* path is historical — those copies were
deleted in NWB-P0-026 and the canonical tree is `src/server/api/**`.

```
src/index.ts              ← Bun.serve entry point
src/server/index.ts       ← Hono app factory (CORS, error handler, route mounting)
  api/                    ← Hono route handlers, mounted at /api (thin: validate + delegate)
    auth/   signin, signup, signout, refresh, sessions, mfa, verification,
            password-reset, invitations (public validate + accept), session-cookies helper
    users/  /me (self-service), /admin (admin surface — mounted on the literal
            `/users/admin` prefix so it can never shadow `/users/me*`; F-11/NWB-P0-029)
    orgs/   /orgs (incl. DELETE + /reactivate), /members, /roles
    api-keys/ /api-keys (create + list), /api-keys/:id/rotate, DELETE /api-keys/:id
  auth/types/             ← auth request/response types
  organization/types/     ← organization types
src/app/                  ← Web layer (TanStack Start): routes/ (file-based pages),
                            server-functions/ (in-process services calls + auth helpers),
                            router.tsx, start.ts, routeTree.gen.ts
src/app/lib/createServerFn.ts ← local shim used by every Server Function (no framework
                            dependency is installed; the app is not yet runnable end to end)
src/server/middleware/    ← Hono middleware
  auth.ts      ← session-cookie OR API-key Bearer verification + CASL ability load
  rbac.ts      ← requireAbility(action, subject) guard
  org-match.ts ← :orgId URL param vs JWT orgId check
  error-handler.ts
src/services/             ← Business logic (single source of truth)
  auth/    auth.service, signup, session, jwt, tokens, password,
           password-history, password-reset, verification, email-change,
           mfa, totp, ability, api-key
  users/   user.service, admin.service, account-deletion.service
  orgs/    org.service, org-deletion.service, member.service, invitation.service,
           role-assignment.service, role-policy (hierarchy rules)
  audit/   actions (registry), write (sealed writes), chain, anonymize, query.service
  retention/ legal-holds.service, retention.service, backups.service (NWB-P1-010)
  email.ts
src/jobs/                 ← Queue job definitions (thin adapters over services)
  index.ts       ← the job set + `startMaintenanceWorker()` + `runMaintenanceJob()`
  rate-limit-reclaim.ts, purge-expired-accounts.ts, purge-expired-organizations.ts,
  purge-expired-invitations.ts, retention-enforce.ts, audit-chain-verify.ts
src/lib/                  ← Infrastructure
  config.ts      ← Zod-validated env singleton
  db.ts          ← Drizzle client factory + test DB helper
  org-context.ts ← AsyncLocalStorage for orgId/userId per-request
  errors.ts      ← Typed error hierarchy → HTTP status mapping
  response.ts    ← { data } / { error } envelope helpers
  rate-limit.ts  ← sliding-window limiter backed by the `rate_limits` table
  queue.ts       ← pg-boss client: config-driven construction, start/stop singleton, queue policy
  scheduler.ts   ← the cron side: schedule table, per-job env overrides, converge-not-init
  worker.ts      ← the worker base: register, audit both outcomes, rethrow for retry
  transaction.ts ← atomic-write helper that is safe inside the test harness's transaction
  tokens.ts      ← token primitives (generate / hash / expiry) — see note below
  password.ts
src/tests/                ← Bun tests
  preload.ts ← runs before any test file (bunfig.toml); supplies the always-required
               JWT secrets so suites don't each set/delete them
  route-invariants.test.ts ← static scan: every `:orgId` route must carry requireOrgMatch
  helpers/  test-db.ts (withTestDb), test-client.ts (createTestApp),
            test-factory.ts (data factories)
db/                       ← Drizzle schema modules
  schema.ts     ← re-exports active schema (shared + core + organization)
  core/         ← users, roles, permissions, sessions, tokens, oauth-accounts
  organization/ ← organizations, organization_members, role_history
  shared/       ← enums, audit, analytics, alerts, approval, contacts, templates, media
  compliance/   ← legal_holds + backup_records adopted (NWB-P1-010); the other four
                  models compile but stay out of schema.ts until their own tickets
```

**Two files named `tokens.ts`** — `src/lib/tokens.ts` holds the low-level
primitives (`generateSecureToken`, `hashToken`, `isTokenExpired`);
`src/services/auth/tokens.ts` holds the DB-backed token rows (`createToken`,
built on those primitives). Import deliberately — the bare name is ambiguous.

This tree names directories and the notable modules, not every file. The service
and route layers outgrew an exhaustive list; run `ls src/services/<layer>` (or the
directory you care about) for the complete set.

### Key facts

- **The queue runtime is configuration, not a code path** (ADR-007 · ADR-028 · NWB-P1-001) — three
  processes can be built from one tree: `bun run dev`/`src/index.ts` (API + workers + scheduler),
  `bun run queue:worker` (workers only, and it **exits non-zero** if pg-boss cannot start, because
  there the queue is the whole job), and `QUEUE_ENABLED=false` (API only). `src/index.ts` does the
  opposite on the same failure — logs `WORKER NOT STARTED` and keeps serving, because nothing in
  `src/server/**` enqueues yet and an API hostage to a background runtime is unoperatable. Handlers
  never touch pg-boss: they declare a `JobDefinition` (`name`, `audit`, `policy`, `handle`) and the
  base in `src/lib/worker.ts` supplies the audit events, the attempt number, and the rethrow that
  makes pg-boss retry with backoff. Swallow a handler error there and every job silently "succeeds".
- **Worker audit events are `module: "core"`, actor type `system`, with `organization_id` NULL** —
  `core` because the 15-value module enum has no `queue` value, not because of the chain: the
  hash chain exists since NWB-P1-014, and `admin`/`system`/`compliance` rows are sealed on write,
  so reach for the honest module and let the writer seal it (NWB-P0-002's DSAR event cites
  `compliance` again). NULL organization because one run sweeps every tenant — a future RLS
  policy (D11) will need to account for that.
- **Audit rows for `admin`/`system`/`compliance` are hash-chained, sealed at write** (NWB-P1-014) —
  `computeChainChecksum` (`src/services/audit/chain.ts`) over
  `(id, action, actorId, resourceId, createdAt, previousChecksum)`; `writeAuditLog` seals chained
  modules inside a per-module advisory transaction lock so concurrent writers cannot fork the chain,
  and stamps `created_at` monotonically per module (`max(now, predecessor + 1ms)`) so the seal order
  and the `(created_at, id)` walk order can never disagree — do not \"simplify\" either away, both
  are load-bearing and both are red-verified by `src/tests/audit/chain.test.ts`. The
  `audit-chain-verify` job walks each chain nightly, sets `hash_chain_valid = false` from the first
  mismatch onward, and audits both outcomes as `module: "system"`. The table is append-only by
  trigger (`impl_trg_ual_append_only`: UPDATE only the flag or the hard-purge PII scrub — the
  scrub touches exactly the columns the checksum does NOT cover, under a transaction-local flag,
  and the two exceptions are disjoint — no DELETE; TRUNCATE stays a role-permission concern).
  Never write chained modules via raw SQL — the registry scan fails it.
- **The nightly order is load-bearing: reclamation → organizations → invitations → accounts →
  retention enforcement → audit-chain verification** (02:00 / 02:15 / 02:30 / 02:45 / 02:55 /
  03:00 UTC, `QUEUE_SCHEDULE_DEFAULTS` in `src/lib/scheduler.ts`, each overridable by
  `QUEUE_CRON_*`) — a user who still
  owns an organization cannot be hard-deleted (`organizations.owner_id` is `NOT NULL` + restrictive,
  F-25/D16), so the org purge has to clear that reference first for the same night's erasure of the
  *owner* to land. Since NWB-P1-013 a blocked row costs only itself: both purges delete per row
  (each id in its own savepoint, `deleteRowsPerRow` in `src/lib/transaction.ts`) and report
  `{ deleted, failed, errors }`, so one un-purgeable owner no longer holds every other erasure
  hostage for the night — and a nonzero `failed` makes the run's audit row `warning` (the
  partial-run convention, `isPartialRun` in `src/lib/worker.ts`). `src/tests/queue/jobs.test.ts`
  proves the isolation, the report shape, and the order. Verification runs last because it walks
  the night's complete set (`src/tests/queue/definitions.test.ts` pins it).
- **Legal holds freeze erasure at the worker, not the database** (NWB-P1-010) — `legal_holds`
  targets exactly one user XOR one organization (DB CHECK; never global), `reason` is required,
  and blocking is subject-wide regardless of `data_type`. Every purge path checks it per row
  (`assertNoActiveHold*` in `src/services/retention/legal-holds.service.ts`, called from the
  account scrub, the org purge's `beforeDelete`, the invite expiry, and the retention enforcers)
  and throws `LegalHoldError` (423 `LEGAL_HOLD`), which `deleteRowsPerRow` counts into the
  **required** `held` on every purge outcome (`held ⊆ failed`, so a held row makes the night's
  audit row `warning` on purpose — erasure deferred is erasure outstanding). No trigger: a
  trigger would also block operator remediation. Holds expire at read time and release
  idempotently. `retention.enforce` (02:55) deletes what a *clock* ended — DSAR packages past
  `expires_at`, sessions dead **and** stale (> 1 year), tokens expired/consumed > 30 days — flips
  past-window `backup_records` to `expired` (the app tracks backups, never performs them; records
  are never deleted), and runs the audit **census**: per-module row counts compared with the
  previous run's own `after_state.census.counts`; any decrease writes a `critical`
  `retention.census.decrease_detected` row. Audit rows are never deleted by anything here.
  Add a new purge path without the hold hook and you have reopened the gap this ticket closed.
- **`loadConfig()` must run before `getConfig()`** — `config.ts` uses a singleton. `src/index.ts` calls it at startup; tests call `loadConfig()` inline (the always-required JWT secrets are supplied by `src/tests/preload.ts`).
- **Auth is cookie-first, with API keys as a Bearer alternative** — the browser flow sets an access token (15-min JWT) and refresh token (7-day JWT) as HTTP-only cookies (`nawebeus_access`, `nawebeus_refresh`) in the signin route. The access cookie path is `/`; the refresh cookie path is `/api/auth`. Machine clients send `Authorization: Bearer nwb_<env>_<publicKey>_<secret>` instead, which `authMiddleware` resolves to the same user + org. A Bearer header takes precedence over the cookie.
- **API keys are stored as a digest, never the secret** — only the SHA-256 of the 256-bit secret is persisted. The 128-bit `public_key` exists so verification is a single indexed lookup rather than a scan-and-compare over every stored hash. The full key is returned exactly once, at creation.
- **API key abilities are narrowed, never widened** — `apiKeyAbility(base, permissionLevel, scopes)` rebuilds the owner's ability, filtered by permission level (`read_only`/`read` → `read`; `write` → `read`,`create`,`update`, deliberately not `delete`; `admin` → no action narrowing) and by `scopes` (subject allow-list; empty means all subjects). It can only ever remove rules the owner already holds.
- **`users.status` is enforced twice, from one predicate** — `assertAccountCanAuthenticate()`
  (`src/services/auth/auth.service.ts`) runs after the password check in `signIn` and
  `verifyMfaChallengeLogin`, and again on **every** request in `authMiddleware`
  (`assertActivePrincipal`, one statement covering account + status + membership, for both the
  cookie and API-key paths). Allowed: `active`, `pending_verification` (the response carries
  `emailVerified: false`; the hard server-side gate lands with real email in Phase 2).
  `suspended` → 403 `ACCOUNT_SUSPENDED`; `deleted`/unknown → generic 401 so the status is never
  disclosed to a caller without the password. NWB-P0-015.
- **Organization deletion is soft, with a reachable undo** — `deleteOrganization` (`src/services/orgs/org-deletion.service.ts`) stamps `deleted_at`/`scheduled_deletion_at` 30 days out, suspends every membership, revokes the org's API keys and all members' sessions; `reactivateOrganization` restores the memberships and keys but **never the sessions** (a revoked session is a credential that may have leaked). Ownership is checked against `organizations.owner_id`, not a role row — DEC-039 makes Owner a transferred singleton on the organization itself. **`POST /orgs/:orgId/reactivate` is the one route that uses `authMiddlewareAllowingInactiveMembership`**: deletion suspends the owner's own membership, so the normal `assertActivePrincipal` check would 403 the only person who can undo it, making the grace period unreachable. That middleware relaxes *only* the `status='active'` requirement — account existence, soft-delete, `users.status` and "holds a membership row here" all still apply — and the route carries no `requireAbility` because `loadAbility` reads active memberships only, so a deleted org yields an empty ability by construction. Do not reuse it elsewhere. NWB-P0-023.
- **`purgeExpiredOrganizations` actually completes; `purgeExpiredAccounts` is gated instead** — every FK referencing `organizations.id` is CASCADE or SET NULL, so the org purge has no restrictive edge (users are *detached*, never deleted with the workspace). The account purge has one (`organizations.owner_id`), which is why `deleteAccount` refuses an owner up front (D16/F-25). Relaxing that gate for soft-deleted orgs reintroduces the 23503 — a soft-deleted org still holds the reference; a negative-control test pins this. The unblock is the hard purge: delete org → grace expires → `purgeExpiredOrganizations` → `deleteAccount` → `purgeExpiredAccounts`. Both run nightly since NWB-P1-001 (F-18 closed); the order above is why organizations go first.
- **Account deletion keeps its grace window in `users.scheduled_deletion_at`** — nullable
  `timestamptz` written by `deleteAccount`, read by `reactivateAccount` /
  `purgeExpiredAccounts` / `getAccountDeletionStatus`. The column was missing until NWB-P0-024,
  which meant every one of those functions failed with 42703. Read instants back with
  `extract(epoch …)::bigint`, not `timestamptz`: node-postgres returns the latter as
  `2026-10-20 17:24:06.801+00`, which JS `Date` rejects. **`deleteAccount` refuses an
  organization owner** (F-25 / D16, option 2 — refuse and report): 409
  `OWNERSHIP_TRANSFER_REQUIRED`, naming the owned organizations, before anything is
  written, so the purge is never reachable for an owner. `organizations.created_by` is
  nullable + `set null` so a *former* owner erases cleanly once ownership has moved on —
  `owner_id` itself stays NOT NULL + `restrict` on purpose. The same restrictive-FK
  class on `api_keys.*_by` / `tokens.revoked_by` is closed too (F-28 / NWB-P0-028 —
  every attribution FK to `users(id)` in the schema is now `set null`).
  Until NWB-P0-023 ships an ownership-transfer path, a user whose signup created their
  personal organization cannot complete account deletion.
- **DSAR data export exists (AC8 of FR-AUTH-007 / NWB-P0-002)** — Phase 1 is synchronous:
  `POST /api/users/me/data-export` builds the package in-request and stores it on
  `data_export_requests` with a 7-day download window (expired reads answer 410,
  `GoneError`; unknown or another subject's id answers 404). Sections: profile minus
  credentials/2FA material, sessions, memberships, apiKeys masked (prefix + `public_key`
  — never `secret_hash`/`encrypted_secret`), auditLog for rows `actor_id = subject OR
  target_user_id = subject` (admin-filed requests must be visible to the subject), and
  `meta.formatVersion: 1`. Each collection caps at 10k rows and closes with a
  `truncated` marker (`sectionRowCap` is an internal service option for tests). The
  `compliance.dsar.requested` event is written BEFORE the build so the request
  self-cites inside its own export — and its module is `compliance`, sealed into the hash chain
  (it cited `core` until NWB-P1-014 because nothing computed the chain yet).
  Admin-on-behalf is `POST /api/users/admin/:userId/data-export`
  (org-scoped, 404 cross-tenant with no request row created) and returns the receipt
  only — the payload only ever travels the subject's own channel
  (`GET /api/users/me/data-export/:requestId`). Self-service POST is rate-limited
  5/day per user (`dsar:req:<userId>`).
- **Session rotation on every refresh** — the old session is revoked and a new one created. Reusing a refresh token after rotation is detected and rejected.
- **Token binding** — each session stores `session_token_hash` (SHA-256 of the refresh token). On refresh and sign-out the presented token's hash must match the session row.
- **AsyncLocalStorage carries org context** — `runWithOrgContext()` is called by `authMiddleware` and wraps the rest of the request. Any service needing the current org/user calls `getOrgContext()`.
- **`runWithOrgContext()` must be awaited inside middleware** — Hono's `compose()` checks `context.finalized` as soon as a handler's promise settles. Calling `next()` without awaiting it resolves the chain before the route handler writes its response, and Hono throws "Context is not finalized" → a blanket 500 on every protected route.
- **Path params that are uuids must go through `uuidParam`** (`src/server/api/route-params.ts`). An unvalidated segment lands in a `WHERE id = $1` against a `uuid` column and Postgres answers `22P02`, which surfaces as a **500** instead of a 422 — four route families did exactly that until NWB-P0-029. `uuidParam(c, "userId", "user id")` throws `ValidationError` before the query runs. Pinned by `src/tests/route-params.test.ts`.
- **Role hierarchy is DEC-039** — one platform role (`super_admin`, level 100) plus six per-organization system roles: `owner` 90, `admin` 80, `manager` 60, `creator` 40, `analyst` 20, `viewer` 10 (all `organization_id IS NULL`; `org_admin`/`member` no longer exist — the seed retires them). Rank comparisons use `roles.level`; only `owner`/`admin` have code-specific semantics. The rules — Owner is transferred never granted, Owner never demoted/removed, no self-change, actor must strictly outrank both the target and the granted role, at least one active Owner/Admin remains (BR-AUTH-030) — live in `src/services/orgs/role-policy.ts`, and **every** path that grants, writes, or clears `organization_members.role_id` or removes/suspends a member goes through it (`assign-role`, `PATCH /members/:id`, `PATCH /users/:id`, both DELETEs, and the invitation pair — `inviteMember` at grant time via `resolveAssignableRole` + `assertRoleGrantAllowed`, `acceptInvitation` activating what the invite was allowed to grant). Add a new write path without it and you have re-opened F-07.
- **Invitation accept exists and is the only way members join** (F-08 / NWB-P0-016) —
  `inviteMember` writes `organization_members` rows (`status='invited'`; `invited_email`
  is the addressee of record, and dedup runs on (org, invited_email)) and emails a 7-day
  single-use token; `GET /api/auth/invitations/:token` previews (org name, invited email,
  account-setup flag) and `POST /api/auth/invitations/:token/accept` activates:
  register-into-org via the shared `createUserRecord` (`src/services/auth/user-record.ts`
  — never re-duplicate signup's user insert) or link an existing account. The token
  claim is an atomic `UPDATE … WHERE accepted_at IS NULL`; the raw token is nulled, the
  hash stays for the double-accept 409. D14's interim single-org answer is enforced: an
  account with an active membership elsewhere gets a clear 409, never a silent re-home —
  the multi-org branch is deliberately unbuilt until D14's final call.
- **CASL for authorization, and org scoping is NOT a CASL condition** — `loadAbility(db, userId, orgId)` queries that org's memberships for the user's role permissions and builds `can(action, subject)` rules with **no conditions**; routes use `requireAbility(action, subject)`. The rules used to carry `{ organizationId: orgId }`, which was inert: CASL v7 evaluates conditions only against a *subject instance*, and every check here passes a string subject, so the condition could never deny anything (F-06, removed in NWB-P0-018). What actually scopes a request to one organization: the JWT-derived `orgId` (no request input can change it) → `assertActivePrincipal` (active membership + active `users.status`) → the per-(user, org) ability load itself (a user in org A is never handed org B's rules) → `requireOrgMatch()` on any `:orgId` path plus the services' `organization_id` predicates. Full chain: `docs/technical/Security Architecture.md` §4.3.1. **Do not re-add rule conditions** expecting them to enforce anything — `src/tests/auth/ability-scoping.test.ts` fails if you do, and `src/tests/route-invariants.test.ts` fails any new `:orgId` route that omits `requireOrgMatch`.
- **API response envelope** — success: `{ data: T, meta? }`; error: `{ error: { code, message, details? } }`.
- **Every 500 is opaque by default** — `errorHandler` maps any non-`AppError` to a generic `INTERNAL_ERROR`, so the real cause never reaches the client. Run with `NWB_DEBUG_ERRORS=1` to have it log the underlying exception and stack first.
- **Biome is the formatter and linter** (`biome.json`, `@biomejs/biome`). Bun 1.4 ships neither a formatter nor a linter — verified: `bun fmt` is "Script not found", and `bun lint` just runs our own script. `bun run lint` fails CI on errors but **not** on warnings, and `noExplicitAny` is deliberately a warning because the codebase has 246 `any` sites. **Never put `//` comments in `biome.json`** — Biome's parser rejects them and then silently falls back to defaults, so a `--write` pass will reformat the tree to tabs instead of the configured 2 spaces. Put rationale in the ticket instead.
- **CI exists and runs** (`.github/workflows/ci.yml`, added 2026-09-13) — `quality` (typecheck + lint + build, ~23 s) then `test` (the full suite against a `postgres:14` service container, ~55 s). Both are green as of PR #12 (run 35526182874). Two things to know: **branch protection on `main` is not configured** (NWB-P0-022), so a red check does not block a merge — `main` sat red between PR #11's merge and PR #12 because the web merge left `bun run lint` failing with 18 formatting/import-order errors (fixed in NWB-P0-027); and the check names to require are exactly `Typecheck, lint, build` and `Test (PostgreSQL)` (the job *names*, not the ids `quality`/`test` — GitHub matches required checks by reported name, so the ids would create a rule nothing can satisfy). Also note the `test` job still runs **`db:push -- --force`**, not `db:migrate`: NWB-P0-005's last step, blocked on the same App's missing `workflows` permission. Run `bunx biome check .` locally before pushing. **No pre-commit hooks.**

### Path aliases (tsconfig.json)

- `@db/*` → `./db/*`
- `@/*` → `./src/*`

### Docs are aspirational

The docs under `docs/technical/` (Engineering Standards, File Structure, Tech Stack, etc.) describe a much larger planned architecture (TanStack Start web app, Expo mobile client, shared-types, Redis cache, Paystack billing, etc.). The **actual codebase is a smaller MVP** focused on auth, users, orgs, and RBAC. Do not treat the doc structure as the current reality — the code in `src/` is the source of truth.

The `db/` folder contains aspirational schema modules (`billing/`, `campaigns/`, `commerce/`, `engagement/`, `influencer/`, `monitoring/`, `pr/`, `publishing/`, `social-accounts/`) that are **excluded from TypeScript compilation** in `tsconfig.json`. They are not wired into `db/schema.ts` yet. `compliance/` compiles since NWB-P1-010, but only `legal_holds` and `backup_records` are re-exported from `db/schema.ts` — granularity lives in that file, not in tsconfig.

### Issue tracker

Specs and tickets live as markdown files in `.scratch/`. See `docs/agents/issue-tracker.md` for conventions. Use `/wayfinder` to work through multi-ticket decision maps.

### Domain terminology

Read `CONTEXT.md` before naming things. The glossary explicitly avoids common synonyms (e.g., "Organization" not "Account"/"Tenant", "Content" for outbound units, "Post" only for blog articles). Drift to a glossary term's synonym in a PR is a code-review block.
