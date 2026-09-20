# TRACEABILITY.md — Traceability Matrix
Every task mapped to source file/doc, owner (proposed), and status. Updated continuously as framework executes.

| Task ID | Phase | Description | Source File / Doc | Proposed Owner | Status | Output Artifact |
|---|---|---|---|---|---|---|
| T-001 | 0 | Inventory repo + manifest | `package.json`, `tsconfig.json`, `.env.example` | Senior Architect | Done | `RECON.md` |
| T-002 | 0 | Confirm `/doc` missing | `glob` (`**/doc/**` → 0) | Technical PM | Done | `GAP_REGISTER.md` (G-01) |
| T-003 | 0 | Catalog docs (`docs/Foundation Phase.md`, `AGENTS.md`) | `AGENTS.md`, `docs/Foundation Phase.md` | Senior Architect | Done | `RECON.md` |
| T-004 | 1 | Reconcile `docs/Foundation Phase.md` vs code | `docs/Foundation Phase.md`, `AGENTS.md:107-158` | Senior Architect | Done | `ADR-001` |
| T-005 | 1 | Reconcile `/doc` absence | `glob`, `AGENTS.md:191` | Technical PM | Done | `ADR-002` |
| T-006 | 1 | Classify remaining discrepancies (G-03..G-12) | `GAP_REGISTER.md` | Technical PM | Pending | `ADR-003+` |
| T-007 | 2 | Recover architecture (`ARCHITECTURE.md`) | `AGENTS.md:107-158`, `src/index.ts` | Senior Architect | Done | `doc/ARCHITECTURE.md` |
| T-008 | 2 | Recover API contracts (`API.md`) | `AGENTS.md:120-125`, `src/app/` | Service Engineer | Done | `doc/API.md` |
| T-009 | 2 | Recover data model (`DATA_MODEL.md`) | `AGENTS.md:153-157`, `db/core/`, `db/organization/` | Service Engineer | Done | `doc/DATA_MODEL.md` |
| T-010 | 3 | Run existing test suite; record baseline | `.github/workflows/ci.yml`, `AGENTS.md:72-79` | DevOps | Done | `doc/TESTING.md` |
| T-011 | 3 | Identify coverage gaps + missing critical path tests | `AGENTS.md:79`, `.github/workflows/ci.yml:9-15` | DevOps | Done | `TESTING.md` (gap section) |
| T-012 | 4 | Convert Gap Register to backlog | `doc/GAP_REGISTER.md` | Technical PM | Pending | Roadmap / Sprint plan |
| T-013 | 4 | Define RACI and sprint sequencing | `AGENTS.md` roles (Architect, PM, DevOps, Engineer) | Technical PM | Pending | `RACI` (in framework) |
| T-014 | 5 | Enforce doc-as-code automation rules | `AGENTS.md:182` (`biome.json` comments), `AGENTS.md:191` (doc references) | DevOps | Pending | `CI_DOC_DRIFT.md` |
| T-015 | 6 | Define release process (`RELEASE.md`) | `.github/workflows/ci.yml`, `package.json` | Technical PM | Pending | `RELEASE.md` |
| T-016 | 6 | Define runbook (`RUNBOOK.md`) | `AGENTS.md:60-63` (`WORKERS_ENABLED`), `AGENTS.md:64` (`WORKER_TIMEZONE`), `AGENTS.md:181` (`NWB_DEBUG_ERRORS`) | Technical PM | Pending | `RUNBOOK.md` |
| T-017 | 6 | Wire changelog (`CHANGELOG.md`) | `/doc/adr/` (ADR-001, ADR-002) | Technical PM | Pending | `CHANGELOG.md` |
