# ADR-002 — `/doc` Directory and Technical Documentation Missing

## Status
Proposed / Reconciled (Phase 1)

## Context (evidence)
- User framework requires `/doc` as the single source of truth.
- `glob` pattern `**/doc/**` returned 0 results before this ADR.
- `docs/Foundation Phase.md` exists but is stale (`ADR-001`).
- `docs/technical/`, `docs/product/PRD.md`, `docs/product/Roadmap.md`, `docs/business/Decision Log.md`, `docs/agents/issue-tracker.md` are referenced by `AGENTS.md` and `CONTEXT.md` but missing (`glob` returned nothing).
- `AGENTS.md:191` explicitly states docs are aspirational (`docs/technical/` describes a larger planned architecture).

## Decision
Create `/doc/` as the canonical documentation directory for this framework. All proposed artifacts (`RECON.md`, `GAP_REGISTER.md`, `ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`, `TESTING.md`, `RELEASE.md`, `RUNBOOK.md`, `CHANGELOG.md`, `adr/`, `CI_DOC_DRIFT.md`, `TRACEABILITY.md`) are added there. Existing `docs/Foundation Phase.md` is preserved but marked stale.

## Impact
- Every future PR must either update `/doc/` or justify in its description why no doc update is needed (`AGENTS.md` doc-as-code principle).
- `/doc` must be included in `tsconfig.json` exclusions (currently `docs` is excluded; `/doc` should also be excluded to avoid TypeScript compilation errors, or added to include if docs contain code examples).

## References
- `AGENTS.md:191`
- `CONTEXT.md:7`
- `AGENTS.md:197-198`
- `glob` evidence (`**/doc/**` → 0 before creation)
