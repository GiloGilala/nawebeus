# RELEASE.md — Release Process (Grounded in Existing Code)
Status: Proposed (Phase 6). Not yet automated (`AGENTS.md:95`: no deploy tooling).

## Release Steps (derived from `.github/workflows/ci.yml` and `package.json`)

1. Confirm `main` branch passes `quality` and `test` jobs (`.github/workflows/ci.yml`).
2. Confirm `db:migrate` (not `db:push`) is applied to production database (`AGENTS.md:98-105`).
3. Confirm `seed` is idempotent (`AGENTS.md:105`) — re-run if database is fresh.
4. Verify `WORKERS_ENABLED` configuration: API process (`false`) and worker process (`true`) must share the same database (`AGENTS.md:60-63`).
5. Tag release in git; update `/doc/CHANGELOG.md` with ADR references.
6. Build bundle: `bun run build` (`package.json:9`).

## What is Not Yet Supported (`AGENTS.md:95`)

- Coverage thresholds (impossible with `bunfig.toml` on Bun 1.4; must use external script over `coverage/lcov.info`).
- `db:migrate` is supported; `db:push` is not safe for production (`AGENTS.md:100-102`).
- Deploy automation: not configured (deliberately absent).
- Pre-commit hooks: not configured (`AGENTS.md:184`).
- Playwright, Snyk, Trivy, Codecov: not configured.

## Rollback Plan

- Database: replay last safe migration (`db:migrate` replay is safe; `AGENTS.md:97`).
- Code: revert to previous `main` commit; `bun.lock` pinned to Bun 1.4.0 ensures reproducible builds (`AGENTS.md:92`).
- Workers: stop worker process (`WORKERS_ENABLED=false`) independently of API (`AGENTS.md:60`); no code change required.
