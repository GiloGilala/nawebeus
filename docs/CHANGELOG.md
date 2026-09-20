# CHANGELOG.md — Wired to `/doc/adr/`
Every entry links to an ADR (`/doc/adr/ADR-###-...`). No changes without ADR reference (doc-as-code rule from framework Phase 5).

## Changes

### [Proposed / Framework Phase 1]
- `ADR-001`: `docs/Foundation Phase.md` reconciled as stale (`code-correct-doc-stale`). Evidence: `docs/Foundation Phase.md` references `core/users.service.ts` (does not exist); reality is `AGENTS.md` architecture (`src/services/auth/auth.service`).
- `ADR-002`: `/doc` directory created; technical docs (`docs/technical/`, `docs/product/PRD.md`, `docs/business/Decision Log.md`, `docs/agents/issue-tracker.md`) missing. Evidence: `glob` `**/doc/**` → 0 before creation.

### [Pending — Phase 4 Backlog / Sprint]
- G-03 (`docs/technical/`): create architecture docs from `AGENTS.md`.
- G-04 (`docs/product/PRD.md`): create or confirm PRD reference.
- G-05 (`docs/business/Decision Log.md`): create decision log linked to `.scratch/` tracker.
- G-06 (`.scratch/` tracker files): verify `.scratch/p0-auth/*.md` and `.scratch/p1-shared-infra/*.md` exist.
- G-08 (aspirational schema excluded by `tsconfig.json`): document exclusion rationale in `ARCHITECTURE.md`.
- G-09 (`db:push` broken): document `db:migrate` as only safe path; reference `.github/workflows/ci.yml:122`.
- G-10 (coverage threshold broken): enforce via external script; reference `AGENTS.md:79`.
- G-11 (`tokens.ts` ambiguous): resolve import naming in code or docs.
- G-12 (`docs/agents/issue-tracker.md`): create tracker conventions doc.
