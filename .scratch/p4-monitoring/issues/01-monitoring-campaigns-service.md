# NWB-P4-001 — Monitoring campaigns service

Type: task
Status: done
Phase: P4 (PRD Module 6 — Monitor)
Size: M
Blocked by: none

## Goal

Implement the service-layer foundation for tenant-scoped monitoring campaigns and adopt the monitoring schema required by this phase. Campaigns are persistent Monitor configurations, not short-lived promotional Campaigns (see `CONTEXT.md`).

This ticket is in the common Monitor scope under each D12 option. D12 remains open; this ticket does not decide the disputed Publishing/PR/Commerce/Influencer scope.

## Context

- Plan: `docs/plan/IMPLEMENTATION EXECUTION PLAN.md` §5 P4; `docs/plan/master-roadmap/08-phase-3-4-modules.md` §14.1.
- Existing Drizzle design: `db/monitoring/index.ts`, initially aspirational and excluded from the active schema.
- Active app-layer tenant isolation is mandatory; do not add RLS or rely on CASL for data scoping.
- D9's current MVP default is PostgreSQL `tsvector` (search use is owned by downstream query work). D8 is not needed for campaign CRUD and remains a prerequisite only for P4-003.

## Scope

1. Review and adopt the existing monitoring schema using the repository's migration-only workflow. The roadmap adopts `db/monitoring/` as a six-table module; preserve the documented shared pipeline and references. Reconcile enum ownership and active-schema name collisions rather than introducing duplicate enums.
2. Before adoption, ensure every adopted ID column is 64 characters from birth, review unique/index names and PostgreSQL identifier limits, and verify the generated migration against the existing migration baseline. Do not edit historical migrations.
3. Implement `src/services/monitoring/campaign.service.ts` (and types/barrel as needed) for:
   - create a campaign for an explicit `orgId` and `userId`;
   - read one campaign by id within the organization;
   - list campaigns within the organization with stable keyset pagination;
   - query active campaigns in deterministic order for workers;
   - update supported campaign configuration fields; and
   - delete a campaign according to the adopted FK/retention behavior (articles survive campaign deletion, with their campaign reference cleared).
4. Validate service inputs at the boundary using the existing validation conventions. Keep business logic in the service; routes are NWB-P4-006.
5. Emit registered audit events for campaign create/update/delete without writing query contents or unnecessary sensitive data to audit metadata. Confirm `module`, category, actor, and resource conventions against `src/services/audit/actions.ts`.
6. Add DB-backed service tests through `withTestDb(...)`, including org isolation, active filtering, update behavior, delete behavior, and article survival/reference clearing. Add focused schema/migration checks as the repository conventions require.

## Out of scope

- HTTP routes, CASL permission seeding, web UI (P4-006 / later P14 work).
- Article ingestion, provider clients, scheduling jobs (P4-002).
- NLP provider selection or enrichment (D8 / P4-003).
- Search implementation beyond the D9 default and the schema/service needed here.
- Competitor metrics or crisis workflows (P4-004/005).
- Resolving D12, or adding PR/Publishing/Influencer/Commerce scope.

## Acceptance

- [x] `db/monitoring/` schema is adopted through reviewed migration `0014_brown_quasimodo.sql`; IDs are 64 characters from birth and shared enums are reused.
- [x] Campaign create/read/list/update/delete are tenant-scoped in every query; an id from another organization behaves as not found.
- [x] Active-campaign selection returns only eligible campaigns in stable creation/id order.
- [x] Deleting a campaign preserves its articles and nulls the campaign reference; its social mentions cascade as documented.
- [x] Mutations write registered audit events; audit metadata excludes full boolean expressions, keywords, and credentials.
- [x] Tests cover service behavior, cross-organization access, article/post dedup isolation, and migration/schema adoption. Migration and repeat-migration pass on local PostgreSQL 18.4; CI's PostgreSQL 14 run remains the compatibility gate.
- [x] Typecheck, lint, build, and the full DB-backed test suite pass.

## Implementation notes

- Use the local terms exactly: organization, Monitor, campaign, article, and Mention. Do not call this a social post or a promotional campaign.
- Services take `db`, `orgId`, and `userId` explicitly where needed. Always include `organization_id` in reads, updates, and deletes; IDs are not authorization.
- Use the repository's `writeAuditLog` and audit action registry; do not invent unregistered action strings.
- Avoid adding dependencies. Provider credentials/configuration are an operator concern and belong to the ingestion ticket, not this service.

## Comments

- **2026-09-29 — claimed and completed.** Adopted all six monitoring tables in migration `0014_brown_quasimodo.sql`; widened ID-shaped columns to 64 characters before first use; exported monitoring schema and removed its TypeScript exclusion.
- Schema review caught and corrected four latent adoption issues: a partial unique `news_sources.slug` index was duplicated by an unconditional `.unique()` constraint; a generated article-campaign FK name exceeded PostgreSQL's 63-byte identifier limit; `DATE(timestamptz)` made a social-mention expression index non-immutable; and global article URL / social-post uniqueness would have prevented two organizations from monitoring the same public coverage. The final constraints are tenant-scoped and the daily-range index is an immutable organization/timestamp index.
- Implemented tenant-scoped campaign CRUD, keyset listing, deterministic active-campaign query, Zod validation, and atomic audit writes. Added registered create/update/delete audit actions with no search terms in audit metadata.
- **Verification:** fresh migration + second no-op migration passed; `db:push -- --force` passed on a separate disposable DB; seed converged (62 permissions / 7 roles / 265 mappings); 1,020 tests passed / 0 failed (5,084 expectations); typecheck, lint, build, and coverage gate passed (`src/services` 94.0%, `src/lib` 97.0%). Database verification used embedded PostgreSQL 18.4; PostgreSQL 14 remains the CI compatibility floor.
