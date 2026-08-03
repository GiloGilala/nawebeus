## Overview

Nawebeus is a multi-tenant social media management and PR intelligence SaaS. The API server is built with **Bun** + **Hono** + **Drizzle ORM** (PostgreSQL). The domain glossary is in `CONTEXT.md` — use its exact terms (Organization, Membership, Content, Conversation, etc.) in code, test names, and issue titles.

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
- `bun test --coverage` — coverage isn't configured with thresholds; the Engineering Standards doc (p. 730) targets 85% services / 90% lib but that CI gate is not yet enforced.

### Database

- `bun run db:push` — push `db/schema.ts` changes to the database (alias of `migrate`).
- `bun run db:generate` — generate migration SQL to `drizzle/migrations/`.
- `bun run db:studio` — open Drizzle Studio GUI.

## Architecture

### Layers (current)

```
src/index.ts              ← Bun.serve entry point
src/server/index.ts       ← Hono app factory (CORS, error handler, routes)
src/app/                  ← Hono route handlers (thin: validate + delegate to services)
  auth/   signin, signup, signout, refresh
  users/  /me, /admin
  orgs/   /orgs, /members
src/server/middleware/    ← Hono middleware
  auth.ts      ← JWT verification + CASL ability load
  rbac.ts      ← requireAbility(action, subject) guard
  org-match.ts ← :orgId URL param vs JWT orgId check
  error-handler.ts
src/services/             ← Business logic (single source of truth)
  auth/    signup, auth.service, session, jwt, password, ability
  users/   user.service, admin.service
  orgs/    org.service, member.service
  email.ts, audit.ts
src/lib/                  ← Infrastructure
  config.ts      ← Zod-validated env singleton
  db.ts          ← Drizzle client factory + test DB helper
  org-context.ts ← AsyncLocalStorage for orgId/userId per-request
  errors.ts      ← Typed error hierarchy → HTTP status mapping
  response.ts    ← { data } / { error } envelope helpers
  tokens.ts, password.ts, password-history.ts
db/                       ← Drizzle schema modules
  schema.ts     ← re-exports active schema (shared + core + organization)
  core/         ← users, roles, permissions, sessions, tokens, oauth-accounts
  organization/ ← organizations, organization_members, role_history
  shared/       ← enums, audit, analytics, alerts, templates, media, etc.
```

### Key facts

- **`loadConfig()` must run before `getConfig()`** — `config.ts` uses a singleton. `src/index.ts` calls it at startup; tests set env vars directly and call `loadConfig()` inline.
- **Auth is cookie-based, not Bearer** — access token (15-min JWT) and refresh token (7-day JWT) are set as HTTP-only cookies (`nawebeus_access`, `nawebeus_refresh`) in the signin route. The access cookie path is `/`; the refresh cookie path is `/api/auth`.
- **Session rotation on every refresh** — the old session is revoked and a new one created. Reusing a refresh token after rotation is detected and rejected.
- **Token binding** — each session stores `session_token_hash` (SHA-256 of the refresh token). On refresh and sign-out the presented token's hash must match the session row.
- **AsyncLocalStorage carries org context** — `runWithOrgContext()` is called by `authMiddleware` and wraps the rest of the request. Any service needing the current org/user calls `getOrgContext()`.
- **CASL for authorization** — `loadAbility()` queries the DB for the user's role permissions, builds a CASL ability scoped with `{ organizationId: orgId }`, and attaches it to the context. Routes use `requireAbility(action, subject)`.
- **API response envelope** — success: `{ data: T, meta? }`; error: `{ error: { code, message, details? } }`.
- **No linter configured** — `bun run lint` prints "no linter configured yet". Type safety is the only automated check (`bun run typecheck`).
- **No CI / no pre-commit hooks** — none present in the repo.

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
