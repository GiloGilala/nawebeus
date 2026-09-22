# NWB-P1-006 — Templates service (create / get / list / update / delete / usage / picker)

Type: task
Status: done (2026-09-22 — implemented, validated, and tested end-to-end; 705 tests passing)
Blocked by: none
Phase: P1 (roadmap Phase 2)
Size: M

## Why this exists

Nawebeus uses a consolidated, unified template store across the entire platform (`db/shared/templates.ts`,
migration 0000). The execution plan §5 and master roadmap §12 schedule NWB-P1-006 as the cross-cutting
templates service supporting downstream modules:

- P3 publishing (`templateType='post'`: cross-platform copy, platform variants, media attachments)
- P7 engagement responses (`templateType='engagement_response'`: quick replies, AI intent matching, Pidgin support, CSAT tracking)
- P8 press releases (`templateType='press_release'`: boilerplate, crisis templates, checklists)
- P11 viral campaigns (`templateType='campaign'`: entry methods, prize tiers, conversion rate tracking)
- Transactional and marketing emails (`templateType='email'`: HTML/Markdown body, variable interpolation)

Before this ticket:
- `db/shared/templates.ts` defined the schema with strict CHECK constraints, but lacked service logic,
  validation schemas, HTTP endpoints, server functions, and audit events.
- `id`, `organization_id`, and `created_by_id` columns were defined as `varchar(32)` while tenant
  and user IDs are 36-character hyphenated UUIDs (the same ground-rule-7 drift class fixed in
  NWB-P1-003 and NWB-P1-010).

## Measured (2026-09-22)

1. **`varchar(32)` ID columns:** `templates.id`, `organization_id`, and `created_by_id` cannot fit
   36-character UUIDs. Migration 0005 widens all three to `varchar(64)`.
2. **Strict DB CHECK constraints:**
   - `chk_tmpl_campaign_no_content`: campaign templates must have `content IS NULL`.
   - `chk_tmpl_shared_content_post_only` & `chk_tmpl_platform_variants_post_only`: post only.
   - `chk_tmpl_intent_match_engagement_only` & `chk_tmpl_pidgin_engagement_only`: engagement_response only.
   - `chk_tmpl_csat_range` (0..5) & `chk_tmpl_csat_engagement_only`.
   - `chk_tmpl_conversion_range` (0..1) & `chk_tmpl_conversion_campaign_only`.
   - `chk_tmpl_usage_consistency`: `(usageCount = 0 AND lastUsedAt IS NULL) OR (usageCount > 0 AND lastUsedAt IS NOT NULL)`.
   - `chk_tmpl_approval_consistency`: `requiresApproval = false ↔ currentApprovalStatus IS NULL`.
   - `chk_tmpl_category_path_nonempty`: category path cannot be empty or whitespace.
   - `uq_tmpl_org_name`: unique template name per organization.
3. **Visibility rules:**
   - System templates: `organization_id IS NULL AND isPublic = true` (all orgs can use) or `isPublic = false` (internal only).
   - Organization templates: `isOrganizationWide = true` (all members can use) or `false` (creator's private draft).
   - Approval gate: if `requiresApproval = true`, non-creator members can only see and use the template once `currentApprovalStatus = 'approved'`.
4. **Optimistic concurrency:** `version` column incremented on every update with `WHERE id = $id AND version = $expectedVersion`.
5. **Usage tracking:** Atomic increment of `usageCount`, update `lastUsedAt = now()`, and rolling average updates for `avgCsat` and `avgConversionRate`.

## Architectural Decisions

1. **Service layer (`src/services/templates/`):**
   - Single source of truth: `createTemplate`, `getTemplateById`, `listTemplates`, `updateTemplate`,
     `deleteTemplate`, `recordTemplateUsage`, `approveTemplate`, `renderTemplateVariables`.
2. **Permissions:**
   - `templates.read`: all members (Owner, Admin, Manager, Creator, Analyst, Viewer).
   - `templates.create`, `templates.update`: Creator, Manager, Admin, Owner.
   - `templates.delete`: Manager, Admin, Owner (plus creator deleting their own unshared draft).
   - `approvals.decide` / `templates.update`: Manager, Admin, Owner to approve templates.
3. **Audit events:**
   - `template.created`, `template.updated`, `template.deleted`, `template.used`, `template.approved`, `template.rejected`.
4. **Thin HTTP routes (`/api/templates`) & Server Functions (`src/app/server-functions/templates.ts`):**
   - Consume shared validation schemas (`src/lib/validation/templates.schemas.ts`).
   - Keyset cursor pagination on lists via `buildPage` and `parsePagination`.

## Verification & Acceptance

- `bun run typecheck`: clean (0 errors with `exactOptionalPropertyTypes: true`).
- `bun run lint`: clean (0 errors, Biome checks pass).
- Unit & integration tests in `src/tests/templates/`:
  - `template.service.test.ts`: 15 tests covering CRUD, versioning, constraints, metrics, visibility, tenant isolation, and audit.
  - `template.route.test.ts`: 5 tests covering 401 unauthenticated, RBAC gates (viewer vs creator vs manager), rendering, approval, and listing with cursor pagination.
  - `server-functions.test.ts`: 3 tests covering validation without DB and full lifecycle with DB in-process.
- Full test suite: 705 tests across 68 files pass cleanly in ~75s.
