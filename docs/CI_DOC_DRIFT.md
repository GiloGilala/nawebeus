# CI_DOC_DRIFT.md — Doc Drift Check Rules
Status: Proposed automation rules for Phase 5 (`AGENTS.md` doc-as-code principle). These rules must be enforced by CI before any PR merges.

## Concrete Checks (derived from framework evidence)

### 1. `/doc` directory must exist
- Command: `test -d doc`
- Fail if: missing (`G-01` blocker).

### 2. `docs/Foundation Phase.md` must not be referenced as current architecture
- Fail if: any `/doc/` file references `core/users.service.ts` or other non-existent files as current reality (evidence: `docs/Foundation Phase.md` references files not in `src/`).
- Allow: references to `docs/Foundation Phase.md` as historical / aspirational (must include `STALE` tag).

### 3. `ARCHITECTURE.md` must reference only existing schema modules
- Fail if: references aspirational dirs (`db/compliance/`, `db/monitoring/`, etc.) excluded by `tsconfig.json` as current.
- Source: `tsconfig.json:35-48` exclusions.

### 4. `API.md` must align with `src/app/` routes
- Verify routes listed in `AGENTS.md:120-125` (`auth/`, `users/`, `orgs/`, `api-keys/`).
- Fail if: `API.md` lists routes not present in `src/app/`.

### 5. `GAP_REGISTER.md` must be updated per PR
- Fail if: `GAP_REGISTER.md` has open gaps (`Status: Open`) without an associated ADR (`/doc/adr/`) or sprint assignment.
- Allow: gaps moved to `Status: In Progress` or `Closed` with ADR reference.

### 6. `biome.json` must not contain `//` comments
- `AGENTS.md:182`: Biome parser rejects `//` comments and silently falls back to defaults (2 spaces → tabs). This causes formatting drift.
- Command: `grep -n '//' biome.json` (fail if any match).

### 7. `ADR-###` files must cite source evidence
- Every ADR must reference at least one file (`AGENTS.md`, `package.json`, `.github/workflows/ci.yml`, etc.).
- Fail if: ADR has no `References` section.

### 8. `CHANGELOG.md` must reference `/doc/adr/`
- Every entry must link to an ADR (`ADR-001`, `ADR-002`, etc.) or explicitly justify absence (`AGENTS.md` doc-as-code rule).

## Implementation Note
These checks are not yet wired into `.github/workflows/ci.yml` (deliberately absent per `AGENTS.md:95` — no deploy/tooling yet). They must be added as a `quality` job step or a separate lint/check script before any PR merges.
