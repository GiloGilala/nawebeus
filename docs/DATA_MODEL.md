# DATA_MODEL.md — Data Models (Verified Against `db/` Schema)
Status: Verified. Aspirational dirs excluded (`tsconfig.json` exclusions applied).

## Active Schema Directories (`AGENTS.md:153-157`)

### `db/core/`
- Users (`users` table)
- Roles (`roles`)
- Permissions (`permissions`)
- Sessions (`sessions` — includes `session_token_hash` for token binding per `AGENTS.md:176`)
- Tokens (`tokens` — access and refresh tokens; refresh token hash stored in session)
- OAuth accounts (`oauth-accounts`)

### `db/organization/`
- Organizations (`organizations`)
- Organization members (`organization_members`)
- Role history (`role_history`)

### `db/shared/`
- Enums (shared enums)
- Audit (`audit` events — see `AGENTS.md:137` service references `audit.ts`)
- Analytics, alerts, templates, media (part of shared infrastructure, but not all fully implemented — `AGENTS.md` references `analytics`, `alerts`, `templates`, `media` as shared modules)

## Schema Generation and Migration (`AGENTS.md:97-105`)

- `db/schema.ts` is the source of truth for Drizzle ORM.
- `db:migrate` replays `drizzle/migrations/` (reproducible, safe to re-run).
- `db:push` is broken (`AGENTS.md:100-102`): fails with `42P16` (`DROP CONSTRAINT` error on named constraints) and exits 0 even on failure. Not safe for CI or production.
- `db:generate` creates SQL to `drizzle/migrations/`.

## Key Constraints and Behaviors (verified)

- `DB_*` variables (`DB_HOST`, `DB_PORT`, etc.) must exist for `db:push` but `DATABASE_URL` is the official variable (`AGENTS.md:101`). Setting only `DATABASE_URL` makes `db:push` silently target the wrong database.
- `DB_PASSWORD` must be non-empty even when the role has no password (`AGENTS.md:102`).
- Database must exist before `db:migrate` (`AGENTS.md:28`; `.env.example:10`).

## Migration Baseline (`AGENTS.md` and `.github/workflows/ci.yml`)

- `drizzle/migrations/` contains committed baseline.
- `meta/_journal.json` tracked.
- CI applies `db:migrate` (not `db:push`) (`.github/workflows/ci.yml:126-128`).
