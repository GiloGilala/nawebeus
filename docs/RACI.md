# RACI — Framework Execution Roles
Inferred from `AGENTS.md` roles and `.github/workflows/ci.yml` job responsibilities.

| Role | Phase 0 Recon | Phase 1 Truth Reconcile | Phase 2 Contract Recovery | Phase 3 Test/CI | Phase 4 Forward Plan | Phase 5 Sync / CI Drift | Phase 6 Release / Iterate |
|---|---|---|---|---|---|---|---|
| Senior Architect | R / A | R / A | R / A | C | C | C | C |
| Technical PM | A | A | C | A | R / A | A | R / A |
| DevOps / CI Engineer | C | C | C | R / A | C | R / A | R / A |
| Service Engineer | C | C | R | C | C | C | C |

Key: R = Responsible, A = Accountable, C = Consulted.

Notes:
- Senior Architect owns architecture reality (`ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`); must verify every route and schema module against `AGENTS.md`.
- Technical PM owns gap burn-down (`GAP_REGISTER.md`), ADR tracking (`/doc/adr/`), and doc-as-code enforcement.
- DevOps owns CI rules (`CI_DOC_DRIFT.md`), build scripts, test baseline (`TESTING.md`), release (`RELEASE.md`), and runbook (`RUNBOOK.md`).
- Service Engineer owns service-layer accuracy (`src/services/`) and route contracts (`src/app/`).
