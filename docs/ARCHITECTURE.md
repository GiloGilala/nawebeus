# ARCHITECTURE.md — System Architecture (Recovered from Code)
Status: Verified against `AGENTS.md` and `src/`. Aspirational modules excluded per `tsconfig.json`.

## Entry Point
`src/index.ts` (`AGENTS.md:115`; verified by read):
- `loadConfig()` (singleton from `src/lib/config.ts`)
- `createDb()` (`src/lib/db.ts`)
- `createAppWithDb({ db })` (`src/server/index.ts`)
- `Bun.serve({ fetch: app.fetch, port: config.PORT })`
- Queue starts if `config.WORKERS_ENABLED` (`AGENTS.md:60-63`; `src/workers/index.ts`)

## Layers (from `AGENTS.md:107-158`)

```
Bun.serve (port from config)
  → src/server/index.ts (Hono app factory)
    → Middleware (`src/server/middleware/`): auth.ts, rbac.ts, org-match.ts, error-handler.ts
      → Routes (`src/app/`): auth/, users/, orgs/, api-keys/
        → Services (`src/services/`): auth/, users/, orgs/
          → DB (`db/core/`, `db/organization/`, `db/shared/` via Drizzle client)
            → Queue (`pg-boss`, `src/lib/queue.ts`)
              → Workers (`src/workers/`)
```

## Key Behaviors (verified by `AGENTS.md`)

- Auth is cookie-first (`nawebeus_access`, `nawebeus_refresh`) with Bearer API-key alternative (`AGENTS.md:171`).
- Session rotation on every refresh; token binding via `session_token_hash` (`AGENTS.md:175-176`).
- AsyncLocalStorage carries org context (`runWithOrgContext()`) (`AGENTS.md:177`).
- `runWithOrgContext()` must be awaited inside middleware (`AGENTS.md:178`).
- CASL ability scoped to `{ organizationId: orgId }` (`AGENTS.md:179`).
- Response envelope: `{ data: T, meta? }` / `{ error: { code, message, details? } }` (`AGENTS.md:180`).
- Every 500 is opaque by default (`AGENTS.md:181`); `NWB_DEBUG_ERRORS=1` reveals details.

## Tech Stack (from `package.json`)

- Runtime: Bun 1.4.0 (pinned by `bun.lock`)
- Server: Hono (`hono` ^4.12.32)
- DB: PostgreSQL 14+ (`pg` ^8.13.0); Drizzle ORM (`drizzle-orm` ^0.36.0)
- Queue: pg-boss (`pg-boss` ^12.32.0)
- Auth / RBAC: `@casl/ability` (^7.0.1)
- Validation: `zod` (^4.4.3)
- Email: `nodemailer` (^10.0.10) (SMTP optional; console transport default)
- Format / Lint: `@biomejs/biome` (^2.5.13)
- TypeScript: `typescript` (^5.6.0)

## Excluded / Aspirational (from `tsconfig.json` and `AGENTS.md`)

The following `db/` modules are excluded from TypeScript compilation (`tsconfig.json:35-48`) and are aspirational (`AGENTS.md:193`):
- `db/billing/`
- `db/campaigns/`
- `db/commerce/`
- `db/compliance/`
- `db/engagement/`
- `db/influencer/`
- `db/monitoring/`
- `db/pr/`
- `db/publishing/`
- `db/social-accounts/`

They are not wired into `db/schema.ts` and must not be referenced as current reality in `/doc/ARCHITECTURE.md`.

## Path Aliases (`tsconfig.json`)

- `@db/*` → `./db/*`
- `@/*` → `./src/*`
