# RECON.md — Phase 0 Reconnaissance
Source-of-truth rules applied: code authoritative for behavior; `/doc` absent (`glob` confirmed); `AGENTS.md` authoritative for architecture intent; `docs/Foundation Phase.md` aspirational/stale.

## Repository Structure (verified by `glob` and `read`)

| Path / Pattern | Evidence | Source File |
|---|---|---|
| Entry point | `src/index.ts` — `Bun.serve`, `loadConfig()`, workers start if `WORKERS_ENABLED` | `AGENTS.md:115-158`; `.env.example` |
| Hono app factory | `src/server/index.ts` — routes `auth/`, `users/`, `orgs/`, `api-keys/` | `AGENTS.md:120-125` |
| Auth services | `src/services/auth/` (auth.service, signup, session, jwt, tokens, password, etc.) | `AGENTS.md:131-137` |
| User/org services | `src/services/users/` (user.service, admin.service, account-deletion.service); `src/services/orgs/` (org.service, member.service, invitation.service, role-assignment.service) | `AGENTS.md:131-137` |
| Queue / workers | `pg-boss` (`package.json`); `src/workers/index.ts`, `notification-delivery.ts`, `approval-expiry.ts` | `AGENTS.md:58`; `package.json` |
| Middleware | `src/server/middleware/auth.ts`, `rbac.ts`, `org-match.ts`, `error-handler.ts` | `AGENTS.md:127-130` |
| Infrastructure lib | `src/lib/config.ts`, `db.ts`, `org-context.ts`, `errors.ts`, `response.ts`, `rate-limit.ts`, `tokens.ts` (primitives), `password.ts` | `AGENTS.md:139-146` |
| Schema (current) | `db/core/` (users, roles, permissions, sessions, tokens, oauth-accounts); `db/organization/` (organizations, organization_members, role_history); `db/shared/` | `AGENTS.md:153-157` |
| Schema (aspirational) | `db/billing/`, `campaigns/`, `commerce/`, `compliance/`, `engagement/`, `influencer/`, `monitoring/`, `pr/`, `publishing/`, `social-accounts/` — excluded by `tsconfig.json` | `tsconfig.json:35-48`; `AGENTS.md:193` |

## Manifest / Tech Stack (verified)

- `package.json`: Bun + Hono (`hono` ^4.12.32) + Drizzle ORM (`drizzle-orm` ^0.36.0) + PostgreSQL (`pg` ^8.13.0) + `pg-boss` ^12.32.0 + `nodemailer` ^10.0.10 + `zod` ^4.4.3 + `@casl/ability` ^7.0.1.
- `biome.json`: Biome (`@biomejs/biome` ^2.5.13) — formatting + linting in one pass.
- `tsconfig.json`: `strict: true`, paths `@db/*` and `@/*`, excludes aspirational `db/` dirs and `docs`.
- `drizzle.config.ts`: exists (not fully read in recon, but referenced by `AGENTS.md`).
- `bun.lock`: pinned to Bun 1.4.0 (`AGENTS.md:92`).

## `/doc` Status (verified — critical gap)

- `/doc`: **MISSING**. `glob` pattern `**/doc/**` returned 0 results.
- `docs/`: only `docs/Foundation Phase.md` found. It is aspirational/stale (`core/users.service.ts` referenced but does not exist; reality is `src/services/auth/auth.service`).
- `docs/technical/`: referenced by `AGENTS.md:191` — missing.
- `docs/product/PRD.md` and `docs/product/Roadmap.md`: referenced by `CONTEXT.md:7` — missing.
- `docs/business/Decision Log.md`: referenced by `AGENTS.md` and `CONTEXT.md` — missing.
- `docs/agents/issue-tracker.md`: referenced by `AGENTS.md:198` — missing.
- `docs/modules/*.md`: `CONTEXT.md:26` says superseded; exact files not found by `glob`.

## Issue Tracker (verified)

- `.scratch/` contains `p0-auth/` and `p1-shared-infra/` subfolders.
- `.scratch/*.md` returned nothing — tracker files may be nested deeper or missing.
- `AGENTS.md:197` confirms `.scratch/` is the canonical tracker.

## CI Reality (verified by `.github/workflows/ci.yml`)

- `quality`: typecheck (`bun run typecheck`), lint (`biome check .`), build (`tsc --noEmit && bun build`).
- `test`: `postgres:14` service; applies `db:migrate` (not `db:push` — `db:push` broken per `AGENTS.md:98-105` and `.github/workflows/ci.yml:122`); seeds; runs `bun test`.
- Coverage gating: impossible via `bunfig.toml` (`AGENTS.md:79`; `.github/workflows/ci.yml:9-15`). Must use script over `coverage/lcov.info`.
- No deploy stage (`AGENTS.md:95`); no pre-commit hooks (`AGENTS.md:184`).

## Domain Terminology (verified by `CONTEXT.md`)

- Organization (not Account), Membership (not Affiliation), Content (not Post for outbound social), Post (blog/article only), Conversation (not Thread), Mention (not Post for inbound), Monitor, Source, Ability, Permission string.

## Key Conflicts (code vs doc intent)

1. `docs/Foundation Phase.md` (lines 1-1286) describes phases 0-15 referencing files (`core/users.service.ts`, `shared/audit.service.ts`, `compliance/`, etc.) that either don't exist in `src/` or are aspirational. Code reality (`AGENTS.md`) is a smaller MVP focused on auth, users, orgs, RBAC.
2. `AGENTS.md` references `docs/technical/` (aspirational docs) that don't exist — doc debt.
3. `.env.example` and `AGENTS.md` note `DB_*` variables must exist for `db:push` but `DATABASE_URL` is the only official variable — a discrepancy (`AGENTS.md:98-105`).

## Questions (information gaps before full reconciliation)

- Does `.scratch/p0-auth/spec.md` exist? (`glob` returned nothing — if missing, auth spec is undocumented.)
- Where is `docs/agents/issue-tracker.md`? (`AGENTS.md:198` references it — missing.)
- What is the exact content of `docs/modules/*.md`? (`CONTEXT.md` says superseded, but files may exist in subfolders not matched.)
- What is the state of `db/relations.ts`? (`tsconfig.json` excludes it — dead or planned?)
