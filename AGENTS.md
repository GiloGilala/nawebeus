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

Only add a package once you have confirmed Bun can't cover the need — and say in the PR what you checked. This rule governs **new** dependencies only; the existing set (`hono`, `drizzle-orm`, `zod`, `pg`, `@casl/ability`) is settled, so don't propose replacing it on these grounds.

## Developer commands

### Setup

```bash
bun install
cp .env.example .env
# Edit .env to point DATABASE_URL at a local PostgreSQL instance, then:
bun run db:push        # push schema to DB
bun run seed            # seed permissions, roles, bootstrap org + admin
```

### Daily

```bash
bun run dev             # hot-reload dev server (src/index.ts)
bun test                # run all tests
bun run typecheck       # tsc --noEmit
bun run build           # typecheck + bundle to dist/
```

### Tests

- `bun test` — runs all tests. Tests requiring a database are silently skipped when `DATABASE_URL` is unset. Set it to run the full suite.
- Run a single test file: `bun test src/tests/auth/signup.test.ts`
- DB-backed tests use `withTestDb(...)` — wraps each test in a `BEGIN`/`ROLLBACK` transaction so the database is automatically cleaned between tests. No manual cleanup needed.
- Tests that don't need the DB use `createTestApp()` (from `src/tests/helpers/test-client.ts`), which injects a no-op database that throws if queried.
- `bun test --coverage` — no thresholds configured, and CI does not run coverage. The Engineering Standards doc (p. 730) targets 85% services / 90% lib.
- **Coverage gating cannot be done via `bunfig.toml` on Bun 1.4.** `coverageThreshold` is per-file, prints no failure message, is enforced only when the `text` reporter is enabled, cannot tolerate a file at 0% coverage at *any* threshold (including `0.0`), has no missing-file guard, and silently accepts keys it doesn't recognise. The docs' proposed `--coverage-threshold='{"services":85,"lib":90}'` is not a real flag — it is silently ignored, so it can never fail. Enforce coverage from a script over `coverage/lcov.info` instead. Verified findings: `.scratch/p0-foundation-gap/issues/03-ci-pipeline.md`.

### CI

`.github/workflows/ci.yml` runs on every push to `main`/`feature/**`/`bugfix/**`/`hotfix/**` and every PR into `main`.

| Job | Steps |
| --- | --- |
| `quality` | `bun install --frozen-lockfile` → `typecheck` → `lint` → `build` |
| `test` | `bun install --frozen-lockfile` → `db:push` → `seed` → `bun test` against a `postgres:14` service container |

- **PostgreSQL 14 is deliberate** — ADR-003 sets 14+ as the floor, so CI tests the floor. The generated DDL needs no extensions and nothing newer than PG14.
- Bun is pinned to `1.4.0` (the lockfile's version); do not float it.
- `bun run lint` runs `biome check .` — formatting, linting, and import order in one pass. It exits non-zero on **errors only**; warnings do not fail the build. `lint:fix` applies safe fixes, `format` formats without linting.
- The `db:push` step must set `DB_*` as well as `DATABASE_URL` — see the Database section above.
- Local reproduction of the `test` job: create a fresh database, then run `db:push` (with `DB_*`), `seed`, and `bun test` with `DATABASE_URL` set. A fresh database is required, because push is not idempotent.
- Deliberately absent (no tooling yet, and each would be permanently red): coverage thresholds, `bun audit`/Snyk/Trivy, Playwright, Codecov, `db:migrate`, deploy. Formatting and linting are now covered by Biome; ESLint and Prettier are not used and should not be added.


### Database

- `bun run db:push` — push `db/schema.ts` changes to the database (alias of `migrate`).
- **`db:push` reads `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`, not `DATABASE_URL`.** The app and the tests read `DATABASE_URL`. Setting only `DATABASE_URL` makes `db:push` silently target the `nawebeus` database. `DB_PASSWORD` must be non-empty even when the role has no password. See NWB-P0-009.
- **`db:push` is not idempotent** — it fails with `42P16` (`column "id" is in a primary key`) against any database that already has the schema, after partially applying statements. `strict: true` also makes it prompt unless you pass `-- --force`. Dropping and recreating the database is currently the only reliable path. NWB-P0-005 replaces this with a real migration baseline.
- `bun run db:generate` — generate migration SQL to `drizzle/migrations/`.
- `bun run db:studio` — open Drizzle Studio GUI.
- `bun run seed` — seed permissions, roles, the bootstrap admin, and its organization. **Idempotent and convergent**: role-permission grants not in the seed's matrix are removed on re-run, and the pre-DEC-039 roles (`org_admin`, `member`) are retired with their memberships re-pointed (`admin`, `creator`). The test suite depends on it: against an unseeded database 7 tests fail (the `seed data`, `RBAC integration`, and `signin with valid credentials` groups).

## Architecture

### Layers (current)

> **Last verified against HEAD `049a837` (2026-08-03) on 2026-09-13.** If the
> tree below looks older than the working copy, re-verify before trusting it —
> `src/` is always the source of truth.

```
src/index.ts              ← Bun.serve entry point
src/server/index.ts       ← Hono app factory (CORS, error handler, routes)
  auth/types/             ← auth request/response types
  organization/types/     ← organization types
src/app/                  ← Hono route handlers (thin: validate + delegate to services)
  auth/   signin, signup, signout, refresh, sessions, mfa,
          verification, password-reset
  users/  /me, /admin
  orgs/   /orgs, /members, /roles
  api-keys/ /api-keys (create + list), /api-keys/:id/rotate, DELETE /api-keys/:id
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
  orgs/    org.service, member.service, invitation.service,
           role-assignment.service, role-policy (hierarchy rules)
  email.ts, audit.ts
src/lib/                  ← Infrastructure
  config.ts      ← Zod-validated env singleton
  db.ts          ← Drizzle client factory + test DB helper
  org-context.ts ← AsyncLocalStorage for orgId/userId per-request
  errors.ts      ← Typed error hierarchy → HTTP status mapping
  response.ts    ← { data } / { error } envelope helpers
  rate-limit.ts  ← sliding-window limiter backed by the `rate_limits` table
  tokens.ts      ← token primitives (generate / hash / expiry) — see note below
  password.ts
src/tests/                ← Bun tests
  preload.ts ← runs before any test file (bunfig.toml); supplies the always-required
               JWT secrets so suites don't each set/delete them
  helpers/  test-db.ts (withTestDb), test-client.ts (createTestApp),
            test-factory.ts (data factories)
db/                       ← Drizzle schema modules
  schema.ts     ← re-exports active schema (shared + core + organization)
  core/         ← users, roles, permissions, sessions, tokens, oauth-accounts
  organization/ ← organizations, organization_members, role_history
  shared/       ← enums, audit, analytics, alerts, templates, media, etc.
```

**Two files named `tokens.ts`** — `src/lib/tokens.ts` holds the low-level
primitives (`generateSecureToken`, `hashToken`, `isTokenExpired`);
`src/services/auth/tokens.ts` holds the DB-backed token rows (`createToken`,
built on those primitives). Import deliberately — the bare name is ambiguous.

This tree names directories and the notable modules, not every file. The service
and route layers outgrew an exhaustive list; run `ls src/services/<layer>` (or the
directory you care about) for the complete set.

### Key facts

- **`loadConfig()` must run before `getConfig()`** — `config.ts` uses a singleton. `src/index.ts` calls it at startup; tests call `loadConfig()` inline (the always-required JWT secrets are supplied by `src/tests/preload.ts`).
- **Auth is cookie-first, with API keys as a Bearer alternative** — the browser flow sets an access token (15-min JWT) and refresh token (7-day JWT) as HTTP-only cookies (`nawebeus_access`, `nawebeus_refresh`) in the signin route. The access cookie path is `/`; the refresh cookie path is `/api/auth`. Machine clients send `Authorization: Bearer nwb_<env>_<publicKey>_<secret>` instead, which `authMiddleware` resolves to the same user + org. A Bearer header takes precedence over the cookie.
- **API keys are stored as a digest, never the secret** — only the SHA-256 of the 256-bit secret is persisted. The 128-bit `public_key` exists so verification is a single indexed lookup rather than a scan-and-compare over every stored hash. The full key is returned exactly once, at creation.
- **API key abilities are narrowed, never widened** — `apiKeyAbility(base, permissionLevel, scopes)` rebuilds the owner's ability, filtered by permission level (`read_only`/`read` → `read`; `write` → `read`,`create`,`update`, deliberately not `delete`; `admin` → no action narrowing) and by `scopes` (subject allow-list; empty means all subjects). It can only ever remove rules the owner already holds.
- **Session rotation on every refresh** — the old session is revoked and a new one created. Reusing a refresh token after rotation is detected and rejected.
- **Token binding** — each session stores `session_token_hash` (SHA-256 of the refresh token). On refresh and sign-out the presented token's hash must match the session row.
- **AsyncLocalStorage carries org context** — `runWithOrgContext()` is called by `authMiddleware` and wraps the rest of the request. Any service needing the current org/user calls `getOrgContext()`.
- **`runWithOrgContext()` must be awaited inside middleware** — Hono's `compose()` checks `context.finalized` as soon as a handler's promise settles. Calling `next()` without awaiting it resolves the chain before the route handler writes its response, and Hono throws "Context is not finalized" → a blanket 500 on every protected route.
- **Role hierarchy is DEC-039** — one platform role (`super_admin`, level 100) plus six per-organization system roles: `owner` 90, `admin` 80, `manager` 60, `creator` 40, `analyst` 20, `viewer` 10 (all `organization_id IS NULL`; `org_admin`/`member` no longer exist — the seed retires them). Rank comparisons use `roles.level`; only `owner`/`admin` have code-specific semantics. The rules — Owner is transferred never granted, Owner never demoted/removed, no self-change, actor must strictly outrank both the target and the granted role, at least one active Owner/Admin remains (BR-AUTH-030) — live in `src/services/orgs/role-policy.ts`, and **every** path that writes `organization_members.role_id` or removes/suspends a member goes through it (`assign-role`, `PATCH /members/:id`, `PATCH /users/:id`, both DELETEs). Add a new write path without it and you have re-opened F-07.
- **CASL for authorization** — `loadAbility()` queries the DB for the user's role permissions, builds a CASL ability scoped with `{ organizationId: orgId }`, and attaches it to the context. Routes use `requireAbility(action, subject)`.
- **API response envelope** — success: `{ data: T, meta? }`; error: `{ error: { code, message, details? } }`.
- **Every 500 is opaque by default** — `errorHandler` maps any non-`AppError` to a generic `INTERNAL_ERROR`, so the real cause never reaches the client. Run with `NWB_DEBUG_ERRORS=1` to have it log the underlying exception and stack first.
- **Biome is the formatter and linter** (`biome.json`, `@biomejs/biome`). Bun 1.4 ships neither a formatter nor a linter — verified: `bun fmt` is "Script not found", and `bun lint` just runs our own script. `bun run lint` fails CI on errors but **not** on warnings, and `noExplicitAny` is deliberately a warning because the codebase has 246 `any` sites. **Never put `//` comments in `biome.json`** — Biome's parser rejects them and then silently falls back to defaults, so a `--write` pass will reformat the tree to tabs instead of the configured 2 spaces. Put rationale in the ticket instead.
- **CI exists** (`.github/workflows/ci.yml`, added 2026-09-13) — typecheck + lint + build, then the full suite against a `postgres:14` service container. Branch protection on `main` is not yet configured, so CI currently reports without blocking. **No pre-commit hooks.**

### Path aliases (tsconfig.json)

- `@db/*` → `./db/*`
- `@/*` → `./src/*`

### Docs are aspirational

The docs under `docs/technical/` (Engineering Standards, File Structure, Tech Stack, etc.) describe a much larger planned architecture (TanStack Start web app, Expo mobile client, shared-types, Redis cache, Paystack billing, etc.). The **actual codebase is a smaller MVP** focused on auth, users, orgs, and RBAC. Do not treat the doc structure as the current reality — the code in `src/` is the source of truth.

The `db/` folder contains aspirational schema modules (`billing/`, `campaigns/`, `commerce/`, `compliance/`, `engagement/`, `influencer/`, `monitoring/`, `pr/`, `publishing/`, `social-accounts/`) that are **excluded from TypeScript compilation** in `tsconfig.json`. They are not wired into `db/schema.ts` yet.

### Issue tracker

Specs and tickets live as markdown files in `.scratch/`. See `docs/agents/issue-tracker.md` for conventions. Use `/wayfinder` to work through multi-ticket decision maps.

### Domain terminology

Read `CONTEXT.md` before naming things. The glossary explicitly avoids common synonyms (e.g., "Organization" not "Account"/"Tenant", "Content" for outbound units, "Post" only for blog articles). Drift to a glossary term's synonym in a PR is a code-review block.
