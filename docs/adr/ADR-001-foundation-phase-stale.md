# ADR-001 — Foundation Phase Documentation is Stale (Reconciliation)

## Status
Proposed / Reconciled (Phase 1)

## Context (evidence)
- `docs/Foundation Phase.md` (line 1-1286) references modules and files (`core/users.service.ts`, `shared/audit.service.ts`, `compliance/impersonation.service.ts`, etc.) that describe a planned architecture of 15 phases.
- `AGENTS.md` (line 107-158) documents the actual architecture: Bun + Hono + Drizzle ORM + PostgreSQL; services in `src/services/auth/`, `users/`, `orgs/`; routes in `src/app/auth/`, `users/`, `orgs/`, `api-keys/`; middleware in `src/server/middleware/`.
- `src/index.ts` (line 1-42) confirms the actual entry point: `loadConfig()`, `createAppWithDb()`, `Bun.serve()`.
- `package.json` confirms the dependency set; no `core/` or `shared/` directories at root level in `src/`.

## Decision
`docs/Foundation Phase.md` is **stale / aspirational** and superseded by `AGENTS.md` as the current architecture source of truth. It is retained (not deleted) because it is evidentiary (shows original build plan), but it is marked `STALE` and excluded from production architecture references.

## Classification
`code-correct-doc-stale` (`docs/Foundation Phase.md` out of date with `AGENTS.md` and code).

## Impact
- All references to `docs/Foundation Phase.md` as a current build guide are revoked.
- `/doc/ARCHITECTURE.md` (Phase 2) will be derived from `AGENTS.md` and `src/`, not from `docs/Foundation Phase.md`.
- Any future schema/module references must verify against `tsconfig.json` exclusions (aspirational dirs excluded) and actual `src/` file tree.

## References
- `docs/Foundation Phase.md`
- `AGENTS.md:107-158`
- `src/index.ts`
- `package.json`
- `.github/workflows/ci.yml:122` (uses `db:migrate`, consistent with current reality, not `db:push`)
