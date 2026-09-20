# TESTING.md — Build, Test & CI Reality Check
Status: Verified against `.github/workflows/ci.yml`, `package.json`, and `AGENTS.md`.

## Build Commands (verified from `package.json`)

| Command | Script | Source |
|---|---|---|
| `bun run dev` | `bun run --hot src/index.ts` | `package.json:8` |
| `bun run build` | `tsc --noEmit && bun build src/index.ts --outdir dist --target bun` | `package.json:9` |
| `bun run typecheck` | `tsc --noEmit` | `package.json:10` |
| `bun run db:generate` | `drizzle-kit generate` | `package.json:11` |
| `bun run db:migrate` | `drizzle-kit migrate` | `package.json:12` |
| `bun run db:push` | `drizzle-kit push` (BROKEN) | `package.json:13`; `AGENTS.md:98-105` |
| `bun run db:drop` | `drizzle-kit drop` | `package.json:14` |
| `bun run db:studio` | `drizzle-kit studio` | `package.json:15` |
| `bun run seed` | `bun run src/seed.ts` | `package.json:16` |
| `bun test` | `bun test` | `package.json:17` |
| `bun run lint` | `biome check .` | `package.json:18` |

## CI Pipeline (`.github/workflows/ci.yml` — verified)

| Job | Steps | Duration (timeout) |
|---|---|---|
| `quality` | `bun install --frozen-lockfile` → `typecheck` → `lint` (`biome check .`) → `build` | 15 min |
| `test` (needs `quality`) | Setup Bun 1.4.0 → install → apply `db:migrate` (not `db:push`) → `seed` → `bun test` against `postgres:14` | 20 min |

### Key CI Evidence (`.github/workflows/ci.yml`)

- `postgres:14` is deliberate floor (`AGENTS.md:90`).
- `DB_*` variables are not needed in CI because `.github/workflows/ci.yml:124` notes `drizzle.config.ts` reads `DATABASE_URL` directly.
- `bun.lock` pinned to Bun 1.4.0 (`AGENTS.md:92`).
- Coverage thresholds are not configured (`AGENTS.md:79`; `.github/workflows/ci.yml:9-15`).
- No deploy stage (`AGENTS.md:95`).

## Test Baseline (`AGENTS.md:72-79` — verified)

- `bun test` runs all tests.
- DB-backed tests use `withTestDb(...)` (transaction `BEGIN`/`ROLLBACK` cleanup — `AGENTS.md:76`; `src/tests/helpers/test-db.ts`).
- Non-DB tests use `createTestApp()` (no-op DB that throws if queried — `AGENTS.md:77`; `src/tests/helpers/test-client.ts`).
- `bunfig.toml` provides `preload.ts` (`src/tests/preload.ts`) for JWT secrets (`AGENTS.md:149`).
- `seed` is mandatory: 7 tests fail against an unseeded database (`AGENTS.md:105`; `.github/workflows/ci.yml:132`).

## Coverage Gaps (verified — no thresholds configured)

- `bunfig.toml` `coverageThreshold` is broken per `AGENTS.md:79`:
  - Per-file enforcement only.
  - Prints no failure message.
  - Enforced only when `text` reporter enabled.
  - Cannot tolerate a file at 0% coverage at any threshold (`0.0` included).
  - Silently accepts unrecognized keys.
- The docs' proposed `--coverage-threshold='{"services":85,"lib":90}'` is a non-existent flag (silently ignored).
- Recommendation (`AGENTS.md:79`): enforce coverage from a script over `coverage/lcov.info`.

## Critical Path Tests (identified from `AGENTS.md` and `.scratch/` references)

- Auth / signin (`AGENTS.md:171`): cookie + Bearer precedence.
- Session rotation + token binding (`AGENTS.md:175-176`).
- RBAC (`AGENTS.md:179`): `loadAbility()` + `requireAbility()`.
- Seed dependency (`AGENTS.md:105`): `seed data`, `RBAC integration`, `signin with valid credentials`.
- `db:push` failure mode: must verify `db:migrate` is used in CI (`.github/workflows/ci.yml:126`), not `db:push`.

## Missing Tests (gaps to address in Phase 4 backlog)

- Tests for aspirational modules (`db/compliance/`, `db/monitoring/`, etc.) — excluded from `tsconfig.json`, not implemented.
- Tests for `db:push` failure behavior (`AGENTS.md:100-102`) — should be documented, not necessarily tested, since `db:push` is deprecated for production.
- Tests covering `runWithOrgContext()` middleware sequence (`AGENTS.md:178`) — critical because missing `await` causes blanket 500.
