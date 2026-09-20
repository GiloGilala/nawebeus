# RUNBOOK.md — Operations Runbook (Grounded in Code)
Status: Proposed (Phase 6). References `AGENTS.md` operational facts.

## Environment Variables (verified by `.env.example` and `AGENTS.md`)

- `DATABASE_URL`: the ONLY database connection variable (`AGENTS.md:97`; `.env.example:7-8`). Do NOT rely on `DB_HOST`/`DB_PORT` etc. for app/test — they are only for `db:push` (broken).
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: minimum 32 characters (`.env.example:20-21`).
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`: optional. If `SMTP_HOST` is unset, console transport is used (`AGENTS.md:75`; `.env.example:25-36`).
- `PORT`: default 3000 (`.env.example:40`).
- `NODE_ENV`: `development` or `production` (`.env.example:41`).
- `WORKER_TIMEZONE`: default `Africa/Lagos` (`AGENTS.md:64`). Without it, pg-boss uses UTC, which silently shifts schedules.
- `WORKERS_ENABLED`: `false` for API-only process; `true` for worker process (`AGENTS.md:60-63`).
- `NWB_DEBUG_ERRORS`: set `1` to reveal exception and stack for 500 errors (`AGENTS.md:181`). Without it, all 500 responses are opaque (`INTERNAL_ERROR`).

## Worker Configuration (`AGENTS.md:60-70`)

- Queue runtime: `pg-boss` (`package.json`).
- Schema: `pgboss` (owned by pg-boss, not in `drizzle/migrations/`).
- Idempotency keys: logical identity of work (`publish:post-123`), never the job id (`AGENTS.md:69` — job id changes on retry).
- Retry and backoff: provided by pg-boss; do not hand-roll (`AGENTS.md:68`).
- Cron expressions: evaluated in `WORKER_TIMEZONE` (`AGENTS.md:64`).

## Common Failures and Fixes (`AGENTS.md` references)

| Symptom | Cause | Fix | Source |
|---|---|---|---|
| `db:push` exits 0 but fails | `42P16` (`DROP CONSTRAINT`); `db:push` is broken against PostgreSQL 18 / named constraints | Use `db:migrate` (replay migrations) | `AGENTS.md:98-105`; `.github/workflows/ci.yml:122` |
| `Context is not finalized` 500 on protected routes | `runWithOrgContext()` called without `await` inside middleware | Await `next()` inside middleware (`AGENTS.md:178`) | `AGENTS.md:178` |
| Every 500 opaque | `NWB_DEBUG_ERRORS` unset (default); `errorHandler` maps non-`AppError` to `INTERNAL_ERROR` | Set `NWB_DEBUG_ERRORS=1` temporarily for debugging | `AGENTS.md:181` |
| Coverage threshold never fails | `bunfig.toml` `coverageThreshold` key broken (ignored); docs propose non-existent flag | Enforce via script over `coverage/lcov.info` | `AGENTS.md:79`; `.github/workflows/ci.yml:9-15` |
| `tokens.ts` import ambiguous | Two files: `src/lib/tokens.ts` (primitives) and `src/services/auth/tokens.ts` (DB-backed rows) | Import with full path or alias; never bare `tokens` (`AGENTS.md:160-163`) | `AGENTS.md:160-163` |

## Health Checks

- Server: `PORT` responds (`src/index.ts`).
- Database: `createDb()` creates connection (`src/lib/db.ts`); `db:migrate` verifies schema exists.
- Queue: `startQueue()` starts `pg-boss`; `registerWorkers()` registers workers (`src/index.ts:29-35`).
- Seed: `seed` must run before tests; 7 tests fail without it (`AGENTS.md:105`; `.github/workflows/ci.yml:132`).
