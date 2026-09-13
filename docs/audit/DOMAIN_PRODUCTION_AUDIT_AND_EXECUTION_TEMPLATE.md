# {{DOMAIN_NAME}} Domain — Production-Readiness Code Audit & Implementation Execution Plan

# <!--

# REUSABLE TEMPLATE — HOW TO USE

1. Copy this file to e.g. `audits/{{DOMAIN_SLUG}}/audit-prompt.md`.
2. Fill in every CONFIG placeholder in the CONFIGURATION table below.
3. Search/replace the CONFIG placeholders throughout (or instruct the
   auditor/AI to resolve them from the table).
4. Delete this comment block.
5. Hand the remainder to the auditor (human or AI) as the instruction.

THIS TEMPLATE RUNS IN TWO DELIBERATE STAGES
Stage 1 — Parts A–D (§0–§24): establish what is TRUE from the code.
No remediation design.
Stage 2 — Part E (§25–§42): convert verified findings into an
executable engineering plan.
Stage 2 must not begin until Stage 1 is complete. If running with an AI
and context is tight, run Part E as a second prompt with §18 (findings)
and §19 (extensions) pasted in as its inputs. The companion report
skeleton is `DOMAIN_PRODUCTION_AUDIT_REPORT_TEMPLATE.md`.

## CONFIG placeholders (global search/replace before use)

{{PROJECT_NAME}} e.g. "Gilo Business"
{{DOMAIN_NAME}} Title case, singular. e.g. "Client", "Invoice", "Appointment"
{{DOMAIN_NAME_PLURAL}} e.g. "Clients"
{{DOMAIN_SLUG}} kebab-case. e.g. "client", "invoice"
{{PRIMARY_TABLE}} e.g. `clients`
{{RELATED_TABLES}} e.g. `client_style_preferences`, `client_notes`
{{TENANT_KEYS}} e.g. `organizationId`, `businessProfileId`
{{UNIQUE_IDENTIFIER_FIELDS}} identity/duplicate-detection fields, e.g. "email, phone"
{{EXPECTED_STATES}} lifecycle/status values, e.g. "active, inactive, archived, suspended"
{{DOMAIN_SPECIFIC_FEATURES}} e.g. "VIP/loyalty points, tailor/stylist assignment, profile image"
{{RELATED_DOMAINS}} e.g. "measurements, projects, orders, invoices, appointments, fittings, transactions, media"
{{BACKEND_STACK}} e.g. "PostgreSQL + Drizzle + Hono"
{{WEB_STACK}} e.g. "Next.js + TanStack Query + shadcn/ui"
{{MOBILE_STACK}} e.g. "React Native/Expo + SQLite + Zustand + TanStack Query"
{{BACKEND_PATHS}} e.g. `apps/web/src/server/**`, `packages/db/**`
{{WEB_PATHS}} e.g. `apps/web/src/app/(dashboard)/clients/**`
{{MOBILE_PATHS}} e.g. `apps/mobile/src/**`
{{SHARED_PATHS}} e.g. `packages/shared/**`, `packages/validators/**`
{{DOCS_PATHS}} e.g. `docs/brd/**`, `docs/architecture/**`
{{DEPLOYED_MOBILE_VERSIONS}} mobile builds in users' hands that must keep working, e.g. "1.4.x–1.6.x"
{{RELEASE_SCOPE}} which P2 items are release-bound, e.g. "P0 + P1 only" or "P0 + P1 + selected P2"

## PER-TASK placeholders (do NOT global-replace; filled per task in §28)

{{TASK_ID}} e.g. `client-P0-001`
{{TASK_TITLE}} e.g. "Enforce tenant scope in getClientById"

## Example (Client domain)

DOMAIN_NAME=Client PRIMARY_TABLE=clients RELATED_TABLES=client_style_preferences
UNIQUE_IDENTIFIER_FIELDS=email, phone EXPECTED_STATES=active, inactive, archived
DOMAIN_SPECIFIC_FEATURES=VIP/loyalty points, tailor/stylist assignment, profile image
DEPLOYED_MOBILE_VERSIONS=1.4.x–1.6.x RELEASE_SCOPE=P0 + P1 only
=====================================================================
-->

## CONFIGURATION

| Key                                 | Value                                    |
| ----------------------------------- | ---------------------------------------- |
| Project                             | {{PROJECT_NAME}}                         |
| Domain                              | {{DOMAIN_NAME}} / {{DOMAIN_NAME_PLURAL}} |
| Primary table                       | {{PRIMARY_TABLE}}                        |
| Related tables                      | {{RELATED_TABLES}}                       |
| Tenant keys                         | {{TENANT_KEYS}}                          |
| Unique identifier fields            | {{UNIQUE_IDENTIFIER_FIELDS}}             |
| Expected lifecycle states           | {{EXPECTED_STATES}}                      |
| Domain-specific features            | {{DOMAIN_SPECIFIC_FEATURES}}             |
| Related domains                     | {{RELATED_DOMAINS}}                      |
| Backend stack                       | {{BACKEND_STACK}}                        |
| Web stack                           | {{WEB_STACK}}                            |
| Mobile stack                        | {{MOBILE_STACK}}                         |
| Backend paths                       | {{BACKEND_PATHS}}                        |
| Web paths                           | {{WEB_PATHS}}                            |
| Mobile paths                        | {{MOBILE_PATHS}}                         |
| Shared contracts paths              | {{SHARED_PATHS}}                         |
| Reference docs (requirements only)  | {{DOCS_PATHS}}                           |
| Deployed mobile versions to support | {{DEPLOYED_MOBILE_VERSIONS}}             |
| Release scope                       | {{RELEASE_SCOPE}}                        |

---

## AUDIT ROLE

Act as the **CTO and Principal Software Architect** conducting a strict production-readiness code audit of the existing **{{DOMAIN_NAME}}** implementation across **{{PROJECT_NAME}}** (backend, web, mobile, synchronization).

The objective is to determine whether the existing `{{PRIMARY_TABLE}}` schema, its relationships ({{RELATED_TABLES}}), services, APIs, web implementation, mobile implementation, synchronization, authorization, data integrity, performance, tests, and UI states are correctly implemented, complete, secure, maintainable, and production-ready — to produce an **As-Built + Gap Analysis + Extension Roadmap** grounded in actual code — and **then** to convert the verified findings into an **ordered, dependency-aware implementation execution plan**.

This is an **as-built implementation audit followed by a plan derived only from that audit**, not a redesign exercise.

---

# 0. NON-NEGOTIABLE CONSTRAINTS

## Existing Domain Only

Do NOT:

- Create a replacement `{{DOMAIN_NAME}}` schema.
- Duplicate the existing model/entity.
- Introduce a parallel `{{DOMAIN_NAME}}` entity.
- Silently redesign existing ownership boundaries.
- Modify code.
- Implement fixes unless explicitly requested after this audit.

The objective is strictly to:

- Understand the existing implementation.
- Verify it against actual code.
- Identify defects and gaps.
- Identify security and integrity risks.
- Identify incomplete functionality.
- Identify web/mobile divergence.
- Identify production-readiness blockers.
- Recommend extensions to the existing architecture.
- Plan remediation from verified findings only.

If a proposed capability genuinely cannot be implemented cleanly without a new table/schema/domain structure, state explicitly:

> **OUTSIDE EXISTING-SCHEMA CONSTRAINT:** This capability cannot be implemented cleanly using the existing structures.

Do not invent the structure.

## Complete Discovery Before Designing Remediation

- Parts A–D (§0–§24) establish facts. Part E (§25–§42) plans remediation from those facts.
- Do not draft fixes, task lists, or migrations while repository discovery is still in progress.
- Do not bend later findings to fit remediation ideas formed early. If a Part E task later proves unsupported by §18/§19 evidence, drop it.

---

# 1. EVIDENCE RULES

## Audit Code, Not Documentation

{{DOCS_PATHS}} (BRDs, FRDs, architecture documents, ADRs, feature lists, tickets, comments, TODOs) may establish **expected** behavior. They are **not** evidence that functionality exists.

Verify every claim against executable implementation artifacts:

database schemas · migrations · ORM definitions · relations · constraints · services · repositories · API routes · middleware · validators · DTOs · serializers · authorization code · permission definitions · query/mutation hooks · React components · React Native screens · SQLite schemas · sync services · background jobs · tests.

Never mark something "implemented" because it appears in a document.

## No Assumptions

Locate the actual schema, migration, relation, enum, validator, DTO, service/repository method, route, middleware, authorization check, component, screen, hook, query, mutation, sync operation, and test.

If sufficient code evidence cannot be located, classify the capability as **UNVERIFIED**. Do not guess.

## Be Adversarial

Assume hidden defects until proven otherwise. Look specifically for:

tenant-isolation failures · authorization bypasses · IDOR · cross-organization data leakage · soft-delete inconsistencies · stale data · race conditions · duplicate records · missing constraints · incorrect foreign keys · inconsistent enum values · frontend/backend contract drift · mobile/web schema divergence · offline sync corruption · cache-invalidation problems · optimistic-update rollback failures · missing loading/error/empty states · silent API failures · N+1 queries · inefficient filtering/search · missing indexes · unbounded queries · incorrect pagination · missing validation · unsafe mutation paths · inconsistent transaction boundaries · orphaned related records · missing auditability · inconsistent permission enforcement · security checks implemented only in the UI · dead or duplicated code · excessive coupling · misleading "production-ready" claims.

---

# 2. ALLOWED STATUS VALUES

Use ONLY these implementation statuses:

| Status                    | Definition                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**           | Required behavior is verified in code and no material defect was discovered within the audited scope.                                         |
| **PARTIALLY IMPLEMENTED** | Some required behavior exists, but meaningful portions are absent or incomplete.                                                              |
| **NEEDS HARDENING**       | Functionality exists but contains security, integrity, reliability, performance, synchronization, UX, testing, or maintainability weaknesses. |
| **MISSING**               | Expected functionality has no implementation evidence.                                                                                        |
| **UNVERIFIED**            | Repository evidence was unavailable, ambiguous, inaccessible, generated, or otherwise insufficient.                                           |

For **roadmap items only** (§19), **PLANNED** may additionally be used for capabilities referenced in docs/TODOs with no implementation.

Do not inflate statuses.

---

# 3. EVIDENCE STANDARD

Every material finding MUST identify:

> **File:** exact repository-relative path
> **Symbol:** function / class / schema / component / hook / table
> **Location:** line number or range where available
> **Observed behavior:** what the code actually does
> **Expected behavior:** what should happen
> **Gap:** exact discrepancy
> **Impact:** security / product / data / UX / operational consequence
> **Recommended fix:** remediation direction (no code changes)

Example:

> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/{{DOMAIN_SLUG}}-service.ts`
> **Symbol:** `get{{DOMAIN_NAME}}ById()`
> **Location:** Lines 120–145
> **Observed behavior:** Query filters by record ID but does not include {{TENANT_KEYS}}.
> **Expected behavior:** Tenant-owned records must be resolved using both record ID and authoritative tenant scope.
> **Gap:** Cross-tenant ownership is not enforced at the data-access boundary.
> **Impact:** Potential IDOR / cross-tenant data disclosure.
> **Recommended fix:** Enforce authoritative tenant scope in the query itself and retain authorization checks above the data-access layer.

Unacceptable language: "probably", "appears secure", "should already work", "the architecture says…", "the documentation indicates…", "I believe…", "the UI appears to…".

Distinguish observed facts from recommendations.

---

# 4. AUDIT METHOD

Before drawing conclusions:

1. Map the repository structure relevant to `{{DOMAIN_NAME}}` ({{BACKEND_PATHS}}, {{WEB_PATHS}}, {{MOBILE_PATHS}}, {{SHARED_PATHS}}).
2. Locate backend schema/migrations for `{{PRIMARY_TABLE}}` and {{RELATED_TABLES}}.
3. Locate all server-side references to the domain.
4. Locate web routes/components/hooks.
5. Locate mobile schema/services/stores/screens.
6. Locate shared contracts/types/validators.
7. Locate authorization/permission infrastructure.
8. Locate synchronization infrastructure.
9. Locate tests.
10. Search for direct database access that bypasses expected services.
11. Search for legacy/duplicate implementations.
12. Trace important operations end-to-end.

For critical operations, trace:

`UI → hook/store → API client / local service → route → middleware → authorization → validation → service/repository → database → response / cache / sync`

Do not assume security in one layer compensates for an unsafe lower layer.

---

# PART A — AS-BUILT AUDIT

# 5. BACKEND IMPLEMENTATION AUDIT

Audit all existing backend implementation related to `{{DOMAIN_NAME}}` in {{BACKEND_PATHS}} ({{BACKEND_STACK}}).

## 5.1 Database

Inspect: schema definitions · migrations · `{{PRIMARY_TABLE}}` · {{RELATED_TABLES}} · relations · columns · types · nullability · defaults · enums · check constraints · unique constraints · indexes · foreign keys · cascade/restrict/set-null behavior · timestamps · ownership metadata (`createdBy`/`updatedBy`/`lastUpdatedBy`) · audit metadata · soft deletion (`deletedAt`/`isDeleted`/status) · restoration · version / optimistic-concurrency fields · migrations vs. current schema drift.

Specifically verify: {{TENANT_KEYS}} · ownership fields · user assignments · status/state fields ({{EXPECTED_STATES}}) · identity rules for {{UNIQUE_IDENTIFIER_FIELDS}} · fields supporting {{DOMAIN_SPECIFIC_FEATURES}} · media/profile fields.

Document the **actual** schema rather than inferring it.

## 5.2 Validation and Contracts

Inspect: validators (Zod/Valibot/etc.) · create/update/query/bulk schemas · DTOs · response serializers · shared TypeScript contracts in {{SHARED_PATHS}} · server/web/mobile contract reuse · enum consistency · normalization (e.g. of {{UNIQUE_IDENTIFIER_FIELDS}}) · optional vs. nullable semantics · unknown-field handling · mass-assignment risk.

## 5.3 Service / Repository Layer

Audit: create · get by ID · get by {{UNIQUE_IDENTIFIER_FIELDS}} · list · search · filter · sort · pagination · count/statistics · update · delete · restore · hard delete · bulk operations · assignments · {{DOMAIN_SPECIFIC_FEATURES}} · media operations · history/audit behavior.

Check: tenant scoping · authorization · transactions · race conditions · stale writes · atomicity · exception handling · direct DB-access bypasses · reusable helpers that accidentally omit tenant scope.

## 5.4 API

Inspect every relevant endpoint: route registration · method · path · handler · route/query params · request-body validation · authentication · authorization · permission middleware · field-level permissions · ownership enforcement · tenant enforcement · status codes · error contracts · pagination contracts · serialization · bulk endpoints · delete/restore endpoints · sync endpoints (push/pull, version checking, source of truth).

**Produce an endpoint map** (method · path · handler · middleware chain · permission).

## 5.5 Related Domains

Trace integrations with existing domains: {{RELATED_DOMAINS}}, plus users/staff, notes/history, audit logs, notifications, and portal/client-facing features where applicable.

Determine whether the `{{DOMAIN_NAME}}` implementation owns data that logically belongs to one of these already-existing domains.

## 5.6 Tests

List relevant backend tests and their status (see §15 for the full test audit).

For every major capability, assign a status value (§2) and cite file paths and symbol names.

---

# 6. WEB IMPLEMENTATION AUDIT

Audit the actual web experience in {{WEB_PATHS}} ({{WEB_STACK}}).

Inspect: routes · page components · layouts · list · detail/profile · create · edit · delete · restore · search · filters · sorting · pagination/infinite queries · domain-specific views ({{DOMAIN_SPECIFIC_FEATURES}}) · related-domain information shown from the {{DOMAIN_NAME}} context ({{RELATED_DOMAINS}}) · history/activity timeline · forms · validators (and whether they mirror backend validation) · reusable components · API hooks · TanStack Query configuration (keys, `staleTime`, `enabled`) · mutations · optimistic updates · rollback · cache invalidation · error boundaries · permission-gated UI · field-level permissions · read-only states · responsive behavior.

Classify each feature as: **functional · partially functional · scaffolded/UI-only · mocked · dead/unwired · missing**.

Do not infer functionality from a rendered control. Trace the action to its mutation/API implementation.

---

# 7. MOBILE IMPLEMENTATION AUDIT

Audit mobile in {{MOBILE_PATHS}} ({{MOBILE_STACK}}) **independently from web**.

Inspect: SQLite schema · migrations · local `{{PRIMARY_TABLE}}` · local {{RELATED_TABLES}} · indexes · foreign keys · tenant fields · local IDs vs. server IDs · version fields · dirty/sync fields · service layer · CRUD · search · filters · sorting · pagination · bulk operations · soft delete · hard delete · restore · {{DOMAIN_SPECIFIC_FEATURES}} · Zustand stores · TanStack Query hooks · navigation/routes · list/detail/create/edit screens · forms · validation · permission enforcement · field-level permissions · media · local files · loading/error/empty/success states.

For every meaningful operation explicitly identify whether it is:

- **LOCAL ONLY**
- **SERVER ONLY**
- **LOCAL + SERVER SYNCHRONIZED**
- **UNCLEAR / UNVERIFIED**

Explicitly identify where the two platforms **can currently diverge**. Trace synchronization where present (§14).

---

# PART B — DEEP-DIVE AUDITS

# 8. SECURITY AND MULTI-TENANCY AUDIT

Treat this section as production-critical.

## 8.1 Tenant Isolation

Verify every read/write path for authoritative {{TENANT_KEYS}} scoping **at the server/data-access boundary**:

get by ID · get by {{UNIQUE_IDENTIFIER_FIELDS}} · list · search · filters · sorting · pagination · statistics/counts · domain-specific queries ({{DOMAIN_SPECIFIC_FEATURES}}) · related tables ({{RELATED_TABLES}}) · related domains ({{RELATED_DOMAINS}}) · media · assignments · bulk operations · create · update · delete · restore · history/audit · sync pull/push.

Check whether the server obtains tenant identity from trusted authenticated context or accepts caller-controlled tenant identifiers.

Look for: IDOR · cross-organization access · cross-business-profile access · global ID lookup without tenant scope · service methods callable without tenant constraints · nested-resource authorization gaps · unsafe joins · unscoped counts/statistics · unsafe bulk `IN (...)` operations · trusting tenant IDs from request bodies.

Frontend filtering is not security.

## 8.2 Authorization

Verify: authentication · role permissions · effective permissions · owner/admin/staff rules · super-admin/platform-admin behavior · read authorization · mutation authorization · field-level permissions · assignment permissions · delete/restore permissions · organization/tenant-switching behavior · permission caching and staleness.

Search specifically for: routes missing permission middleware · direct service calls without checks · `isSuperAdmin`-style shortcuts · permissive `can()` fallbacks/bypasses · client-supplied owner/creator IDs · JWT permission claims treated as authoritative without expected validation · UI-only authorization · mass assignment · hidden fields editable through direct API calls · unrestricted database queries.

Document exploit paths for confirmed security defects.

---

# 9. DATA-INTEGRITY AUDIT

Verify whether the database **and** application layers prevent invalid states.

Inspect: duplicate records · uniqueness and normalization of {{UNIQUE_IDENTIFIER_FIELDS}} (scoped to tenant or global?) · required fields · nullability · invalid enum values · enum consistency across DB / validation / web / mobile · status transitions ({{EXPECTED_STATES}}) · negative or out-of-range numeric fields · overflow · assignment validity · foreign keys for assignment/reference columns · orphaned {{RELATED_TABLES}} records · soft-deleted record visibility in every query · delete cascades · restore behavior · timestamps · `createdBy` / `updatedBy` · optimistic concurrency · versioning · transaction boundaries · concurrent mutations · stale writes · server/mobile divergence.

Identify every case where the database **permits** a state the business rules **prohibit**, and every business invariant enforced **only** by UI validation.

---

# 10. PERFORMANCE AND SCALABILITY AUDIT

Review behavior as a tenant grows from **100 → 1,000 → 10,000 → 100,000+** {{DOMAIN_NAME_PLURAL}}.

Inspect: indexes (vs. actual WHERE/ORDER BY/JOIN usage) · composite tenant indexes · unique indexes · search implementation (`ILIKE`/wildcard scans vs. FTS/trigram) · sorting · filtering · count queries · offset vs. cursor pagination · unbounded queries · joins · N+1 behavior · repeated queries · eager loading · over-/under-fetching · bulk operations · cache behavior · query invalidation · TanStack Query configuration · client-side filtering of server datasets · SQLite indexes · mobile local queries.

For each performance finding, explain the likely scaling bottleneck and the threshold at which it becomes material.

---

# 11. WEB UI/UX STATE AUDIT

For every relevant screen/component, verify each state exists and is handled correctly, and is visually/behaviorally consistent with the project's existing design system (do not invent a new UI language):

| State                                                          | Status | Evidence | Notes |
| -------------------------------------------------------------- | ------ | -------- | ----- |
| Initial loading                                                |        |          |       |
| Skeleton loading                                               |        |          |       |
| Detail loading                                                 |        |          |       |
| Search debounce / loading                                      |        |          |       |
| Filter loading                                                 |        |          |       |
| Form submitting / mutation pending                             |        |          |       |
| Pagination / load-more loading                                 |        |          |       |
| Image loading                                                  |        |          |       |
| Empty {{DOMAIN_NAME_PLURAL}} list                              |        |          |       |
| Empty search results                                           |        |          |       |
| Empty filtered results                                         |        |          |       |
| Empty domain-specific views ({{DOMAIN_SPECIFIC_FEATURES}})     |        |          |       |
| No related records ({{RELATED_DOMAINS}})                       |        |          |       |
| No history / activity                                          |        |          |       |
| API / server error                                             |        |          |       |
| Network / offline error                                        |        |          |       |
| Validation error                                               |        |          |       |
| Permission denied                                              |        |          |       |
| Unauthorized session                                           |        |          |       |
| Record not found                                               |        |          |       |
| Record deleted                                                 |        |          |       |
| Duplicate / uniqueness conflict ({{UNIQUE_IDENTIFIER_FIELDS}}) |        |          |       |
| Stale data / version conflict                                  |        |          |       |
| Mutation failure                                               |        |          |       |
| Timeout                                                        |        |          |       |
| Image failure                                                  |        |          |       |
| Missing image / placeholder                                    |        |          |       |
| Create success                                                 |        |          |       |
| Update success                                                 |        |          |       |
| Delete confirmation                                            |        |          |       |
| Delete success                                                 |        |          |       |
| Restore                                                        |        |          |       |
| Assignment success                                             |        |          |       |
| Domain-specific success ({{DOMAIN_SPECIFIC_FEATURES}})         |        |          |       |
| Optimistic update                                              |        |          |       |
| Rollback on failure                                            |        |          |       |
| Query invalidation / stale cache                               |        |          |       |
| Duplicate request prevention                                   |        |          |       |
| Navigation after mutation                                      |        |          |       |
| Unsaved-changes guard                                          |        |          |       |
| Disabled states                                                |        |          |       |
| Read-only vs. editable                                         |        |          |       |
| Lifecycle state ({{EXPECTED_STATES}})                          |        |          |       |
| Sync pending / rejected (if applicable)                        |        |          |       |

Report missing states as findings where they create meaningful usability or correctness problems.

---

# 12. MOBILE UI/UX STATE AUDIT

Repeat §11 for mobile, additionally checking:

local database initialization/loading · offline mode · online/offline transitions · pending synchronization · sync success · sync failure · retry · server rejection · version conflict · stale local record · remotely deleted record · local mutation queue · duplicate mutations · app restart with pending mutations · optimistic UI · rollback · pull-to-refresh · paginated/infinite loading · keyboard avoidance · focus/input behavior · navigation errors · media upload pending · local media missing · delete/restore flows · permission-gated controls · read-only fields.

Identify any path where the **UI reports success before durable server acceptance and fails to communicate later rejection**.

---

# 13. WEB ↔ MOBILE PARITY AUDIT

| Capability                                  | Backend | Web | Mobile | Parity | Risk | Evidence |
| ------------------------------------------- | ------- | --- | ------ | ------ | ---- | -------- |
| Schema fields                               |         |     |        |        |      |          |
| Enums                                       |         |     |        |        |      |          |
| Validation rules                            |         |     |        |        |      |          |
| Status values ({{EXPECTED_STATES}})         |         |     |        |        |      |          |
| CRUD                                        |         |     |        |        |      |          |
| Search                                      |         |     |        |        |      |          |
| Filters                                     |         |     |        |        |      |          |
| Sorting                                     |         |     |        |        |      |          |
| Pagination                                  |         |     |        |        |      |          |
| Soft delete                                 |         |     |        |        |      |          |
| Restore                                     |         |     |        |        |      |          |
| {{DOMAIN_SPECIFIC_FEATURES}} (one row each) |         |     |        |        |      |          |
| Related tables ({{RELATED_TABLES}})         |         |     |        |        |      |          |
| Permissions                                 |         |     |        |        |      |          |
| Field-level permissions                     |         |     |        |        |      |          |
| Media                                       |         |     |        |        |      |          |
| Timestamps                                  |         |     |        |        |      |          |
| Versioning                                  |         |     |        |        |      |          |
| Audit / history                             |         |     |        |        |      |          |
| Offline behavior                            | N/A     | N/A |        |        |      |          |
| Synchronization                             |         |     |        |        |      |          |

Identify: features on both · web-only · mobile-only · inconsistent field behavior · different validation · different permissions · different lifecycle behavior · different sync semantics.

Explicitly distinguish **schema drift · validation drift · permission drift · behavior drift · lifecycle drift · sync-semantic drift**.

---

# 14. SYNCHRONIZATION AUDIT

Where mobile/offline synchronization exists, identify the actual source of truth.

Trace: local create → server create · local update → server update · local delete → server delete · server update → local update · server deletion → local deletion/tombstone · ID reconciliation · timestamp reconciliation · dirty flags · sync queue · retries · idempotency · duplicate queue entries · network interruption · app termination · version checks · conflict detection · conflict resolution (server-wins / client-wins / field merge) · rejected mutations · partial batch failures · tenant switching · logout/login behavior · stale local records.

State explicitly where backend, web, and mobile can diverge.

Do not call synchronization production-ready unless failure/retry/conflict paths are supported by code evidence and tests.

---

# 15. TEST COVERAGE AUDIT

Locate actual tests for: schema/constraints · validators · service layer · repository layer · API/routes · authentication · authorization · tenant isolation · IDOR · field-level permissions · duplicate detection · soft delete · restore · bulk operations · {{DOMAIN_SPECIFIC_FEATURES}} · assignments · web components · web hooks · cache invalidation · mobile services · SQLite · synchronization · conflict handling · offline retry · migrations · E2E.

Report per area: relevant test file · scenarios covered · important scenarios not covered · whether tests are runnable from repository scripts · current result **if actually executed** during the audit.

Never state that tests pass unless they were executed successfully. Use **EXISTS — NOT EXECUTED** when tests exist but were not run.

Identify **dangerous untested paths**. For each major missing category, state the failure it would have detected.

---

# 16. ARCHITECTURAL RED FLAGS

Explicitly search for and report: duplicated business logic · duplicate domain representations · backend/mobile divergence · frontend-enforced business rules that should be server-enforced · service-layer bypass · direct DB-access bypass · inconsistent validation · schema drift · dead code · stale legacy paths · over-engineering · under-engineering · excessive coupling · circular dependencies · leaky abstractions · poor transaction boundaries · unclear business-rule ownership · incorrect separation of concerns · unbounded generic repositories · unsafe shared helpers · sync logic duplicated across screens · generated types that no longer match runtime contracts · data in `{{PRIMARY_TABLE}}` that logically belongs to an existing related domain · hidden technical debt.

---

# 17. REQUIREMENT-TO-IMPLEMENTATION MATRIX

Use {{DOCS_PATHS}} only to establish expected behavior. Verify each requirement in code.

| ID    | Requirement | Backend | Web | Mobile | Status | Evidence |
| ----- | ----------- | ------- | --- | ------ | ------ | -------- |
| R-001 |             |         |     |        |        |          |

Use only the statuses in §2. If requirements conflict with actual implementation, document both without treating documentation as implementation evidence. Do not inflate status.

---

# PART C — ROADMAP & PART D — AUDIT OUTPUTS

# 18. PRIMARY FINDINGS TABLE

**This is the primary remediation backlog and the most important audit output. Part E consumes it.**

Produce ONE prioritized table containing all material issues. Assign each finding a **stable identifier** (`F-001`, `F-002`, …) so Part E tasks can reference it.

| ID    | Priority | Severity | Finding | Evidence / File Path | Impact | Recommended Fix |
| ----- | -------- | -------- | ------- | -------------------- | ------ | --------------- |
| F-001 |          |          |         |                      |        |                 |

**Priority**

- **P0** — must fix before production
- **P1** — must fix before broad rollout / immediately after P0
- **P2** — important improvement
- **P3** — backlog optimization

**Severity**

- **CRITICAL** — exploitable security issue, cross-tenant exposure, destructive integrity issue, severe authorization bypass, or production-blocking failure
- **HIGH** — serious security, integrity, synchronization, architectural, or functional defect
- **MEDIUM** — meaningful defect, incomplete behavior, performance problem, UX failure, or maintainability issue
- **LOW** — minor defect/inconsistency, cleanup
- **INFO** — non-defect observation or optimization opportunity

**Sort order:** P0/CRITICAL → P0/HIGH → P1/HIGH → P1/MEDIUM → P2 → P3.

Security, tenant-isolation, destructive-integrity, and unsafe-synchronization findings must **never** be buried beneath UX findings.

---

# 19. EXISTING-SCHEMA EXTENSION OPPORTUNITIES

After documenting defects, identify enhancements possible by **extending `{{PRIMARY_TABLE}}` and existing related structures only** ({{RELATED_TABLES}}). Do NOT propose a replacement domain schema. Assign each a stable identifier (`E-001`, …) so Part E can reference it.

Allowed change types: column · enum extension · index · constraint · existing-relation enhancement · validation · service logic · API behavior · permission behavior · UI states/behavior · query optimization · synchronization change · audit improvement.

Consider (adapt to domain): lifecycle/status management · segmentation/tags · communication/contact history · referral/source/acquisition tracking · preferences · important dates · relationship links · notes/activity timeline · consent/privacy controls · analytics · retention/loyalty · risk/attention indicators · search/filter improvements · custom fields (only if architecturally appropriate) · portal-facing improvements · integration with {{RELATED_DOMAINS}} · media/profile improvements · {{DOMAIN_SPECIFIC_FEATURES}} enhancements.

| ID    | Enhancement | Existing Support (field / table / component) | Required Change (type from allowed list) | Stays in domain? | Duplication / Architecture Risk | Priority | Rationale |
| ----- | ----------- | -------------------------------------------- | ---------------------------------------- | ---------------- | ------------------------------- | -------- | --------- |
| E-001 |             |                                              |                                          |                  |                                 |          |           |

Group as: **P1 — High-value / near-term**, **P2 — Valuable / medium-term**, **P3 — Advanced / future**.

If an enhancement requires a genuinely new table/schema, mark it **OUTSIDE EXISTING-SCHEMA CONSTRAINT** rather than designing the table.

---

# 20. FINAL AS-BUILT ASSESSMENT

- **A. Already production-ready** — only capabilities positively verified in code.
- **B. Implemented but needs hardening** — existing capabilities with material weaknesses.
- **C. Incomplete or missing** — separate PARTIALLY IMPLEMENTED, MISSING, and UNVERIFIED.
- **D. Highest-value existing-schema extensions** — only those compatible with §0.
- **E. Web UI/UX gaps** — material state and workflow gaps.
- **F. Mobile UI/UX gaps** — include offline/sync concerns.
- **G. Web/Mobile parity gaps** — prioritize behavioral and schema divergence.
- **H. Security / data-integrity concerns** — tenant isolation, authorization, IDOR, concurrency, destructive integrity.
- **I. Recommended implementation order** — one-paragraph summary only; detailed sequencing lives in Part E (§36–§37, §41).

---

# 21. FINAL CTO ASSESSMENT

## Production Readiness — return EXACTLY ONE

- PRODUCTION READY
- PRODUCTION READY WITH MINOR HARDENING
- REQUIRES HARDENING
- NOT PRODUCTION READY

## Then provide

- **Executive Summary** — maximum 10 bullets
- **P0 Blockers** — genuine production blockers only
- **P1 Must-Fix Items**
- **P2 Improvements**
- **P3 Backlog**
- **Security Assessment** — based on code evidence: is tenant isolation safe? is authorization safe? is IDOR protection consistently enforced? is field-level authorization server-enforced? (UNVERIFIED if evidence is insufficient)
- **Data Integrity Assessment** — do the database AND service layer prevent invalid {{DOMAIN_NAME}} states?
- **Web Assessment** — functionally complete and production-ready?
- **Mobile Assessment** — functionally complete and production-ready?
- **Sync Assessment** — can offline synchronization safely handle real production usage?
- **Web/Mobile Parity** — meaningful divergence
- **Top 5 highest-value existing-schema extensions** — greatest product value without replacing or duplicating the existing schema

---

# 22. CTO SCORECARD

Score strictly on verified findings. Every score must be explainable from findings already documented.

| Area                 | Score / 10 | Assessment (must cite finding IDs) |
| -------------------- | ---------: | ---------------------------------- |
| Schema Design        |            |                                    |
| Data Integrity       |            |                                    |
| Tenant Isolation     |            |                                    |
| Authorization        |            |                                    |
| Backend Services     |            |                                    |
| API Design           |            |                                    |
| Performance          |            |                                    |
| Web Frontend         |            |                                    |
| Mobile Frontend      |            |                                    |
| Offline/Sync         |            |                                    |
| UX State Coverage    |            |                                    |
| Testing              |            |                                    |
| Maintainability      |            |                                    |
| Web/Mobile Parity    |            |                                    |
| Production Readiness |            |                                    |

---

# 23. REQUIRED OUTPUT ORDER

Return the audit in this order:

1. Repository / implementation surface discovered
2. As-built domain/schema summary (including endpoint map)
3. **Primary prioritized findings table** (§18)
4. Backend implementation audit (§5)
5. Security and multi-tenancy audit (§8)
6. Data-integrity audit (§9)
7. Performance/scalability audit (§10)
8. Web implementation audit (§6)
9. Web UI/UX state audit (§11)
10. Mobile implementation audit (§7)
11. Mobile UI/UX state audit (§12)
12. Synchronization / source-of-truth audit (§14)
13. Web/mobile parity matrix (§13)
14. Requirement-to-implementation matrix (§17)
15. Test coverage audit (§15)
16. Architectural red flags (§16)
17. Existing-schema extension opportunities (§19)
18. Final as-built assessment (§20)
19. Final CTO assessment (§21)
20. CTO scorecard (§22)
21. **Implementation execution plan** (Part E, §25–§41) — only after items 1–20 are complete
22. Implementation plan quality gate (§42)

---

# 24. AUDIT QUALITY GATE

Before proceeding to Part E, verify:

- [ ] Every CRITICAL/HIGH finding has concrete code evidence.
- [ ] Every security conclusion is traceable to an implementation artifact.
- [ ] Tenant scoping was checked on individual-record AND collection paths.
- [ ] Authorization was checked server-side rather than inferred from UI.
- [ ] Backend, web, and mobile were audited separately.
- [ ] Local-only mobile behavior is explicitly identified.
- [ ] Synchronization failure paths were inspected.
- [ ] Soft-delete semantics were traced across related queries.
- [ ] Validation was compared across backend/web/mobile.
- [ ] Database constraints were distinguished from application validation.
- [ ] Tests were not described as passing unless actually executed.
- [ ] Documentation was not treated as implementation evidence.
- [ ] Missing evidence was marked UNVERIFIED.
- [ ] Recommendations were clearly distinguished from observed behavior.
- [ ] No replacement/parallel `{{DOMAIN_NAME}}` schema was proposed.
- [ ] No code was modified.
- [ ] Findings table is sorted per §18 with security items on top, and every finding has a stable `F-###` ID.
- [ ] No remediation tasks were drafted before this gate.

---

# PART E — IMPLEMENTATION EXECUTION PLAN

> **STAGE GATE:** Do not begin Part E until §18 (findings) and §19 (extensions) are complete and §24 passes. Part E consumes them as its only inputs.

# 25. AUDIT-TO-EXECUTION CONVERSION

Convert the **verified findings** into a concrete engineering implementation plan grounded in the audited repository structure.

The plan must be sufficiently precise that another engineer or coding agent can execute it **without repeating repository discovery**.

Do not introduce speculative remediation. Every task must trace to:

1. A finding in §18 (`F-###`), or
2. An approved existing-schema extension in §19 (`E-###`).

This remains a planning exercise. **Do not modify code.**

## 25.1 Execution Constraints

- Do not replace `{{PRIMARY_TABLE}}` or create a parallel `{{DOMAIN_NAME}}` entity/model.
- Extend, correct, harden, optimize, or complete the existing implementation.
- Preserve established project architecture unless the audit demonstrated it is defective.
- Reuse existing services, validators, permission systems, UI components, query patterns, synchronization infrastructure, testing patterns, and related domains where appropriate; do not duplicate business logic where an established implementation can be extended.
- Security and data-integrity remediation takes precedence over feature development.
- Establish backend/database invariants and stable contracts before dependent web/mobile work.
- Account for already-deployed mobile clients ({{DEPLOYED_MOBILE_VERSIONS}}) when changing APIs, enums, validation, or synchronization contracts.
- Do not make undocumented product or architectural decisions to resolve ambiguity. Record unresolved decisions explicitly (§41 → Remaining Decisions).

## 25.2 Implementation Objectives

Translate the audit into the work required to achieve:

1. Correct tenant isolation.
2. Correct authentication and authorization.
3. Correct field-level permission enforcement.
4. Strong database/data integrity.
5. Stable backend contracts.
6. Correct soft-delete/restore behavior.
7. Safe concurrent updates.
8. Reliable web behavior.
9. Reliable mobile/offline behavior.
10. Safe synchronization.
11. Web/mobile behavioral parity where required.
12. Appropriate performance at expected scale.
13. Complete critical UX states.
14. Adequate automated regression coverage.
15. Production observability and failure visibility where existing infrastructure supports it.
16. High-value domain improvements that extend the existing schema without duplicating it.

---

# 26. FINDING → TASK TRACEABILITY

Every implementation task must trace to its source.

| Task ID | Source Finding / Extension (`F-###` / `E-###`) | Priority | Severity | Area | Required Outcome |
| ------- | ---------------------------------------------- | -------- | -------- | ---- | ---------------- |

Task IDs must use:

- `{{DOMAIN_SLUG}}-P0-001`
- `{{DOMAIN_SLUG}}-P1-001`
- `{{DOMAIN_SLUG}}-P2-001`
- `{{DOMAIN_SLUG}}-P3-001`

One finding may generate multiple tasks where remediation crosses database, backend, web, mobile, sync, or testing boundaries — link all of them to that finding.

Do not create implementation tasks for unsupported assumptions.

---

# 27. IMPLEMENTATION PHASES

Order work by **dependency and risk**, not merely by feature area.

## Phase 0 — Production Blockers

Only confirmed P0 issues: cross-tenant exposure · IDOR · authorization bypass · destructive data-integrity failures · unsafe synchronization / data loss · critical schema/constraint/migration failures · production-blocking runtime failures.

Nothing dependent on these areas proceeds until their invariants and contracts are established.

## Phase 1 — Security & Data Integrity

{{TENANT_KEYS}} enforcement · server-side authorization · field-level permissions · validation · uniqueness · foreign keys · soft-delete/restore consistency · transaction boundaries · race conditions · concurrent writes · version checking · unsafe mutation paths.

## Phase 2 — Backend Contracts & Services

DB/service invariants · repositories/data access · DTOs/validation · serializers · API completeness and contracts · search/filter/sort · pagination · statistics · bulk operations · assignments · {{DOMAIN_SPECIFIC_FEATURES}} · related-domain behavior ({{RELATED_DOMAINS}}) · audit/history · media · error contracts.

Backend contracts must stabilize before dependent web/mobile parity work.

## Phase 3 — Web Completion & Hardening

Queries/mutations/hooks · list/detail/create/edit · search/filter/sort/pagination · permission behavior · form validation · cache invalidation · optimistic updates and rollback · delete/restore · related-domain views · missing UI/UX states · responsive behavior · accessibility where relevant.

## Phase 4 — Mobile Completion & Offline Safety

SQLite schema alignment · local CRUD · tenant filtering · validation · permissions · forms · screens/navigation · Zustand/TanStack Query integration · offline mutations · sync queue · retries · idempotency · server rejection · conflict handling · stale records · delete/restore · local media · UX states.

## Phase 5 — Web/Mobile Parity

Resolve unjustified schema drift · enum drift · validation drift · permission drift · lifecycle drift · behavior drift · delete/restore differences · {{DOMAIN_SPECIFIC_FEATURES}} differences · assignment differences · sync-semantic drift.

Platform-specific differences may remain where intentional. Document the reason.

## Phase 6 — Performance & Scalability

Verified missing indexes · expensive searches · N+1 queries · unbounded queries · over-fetching · pagination problems · count-query cost · inefficient bulk operations · SQLite index gaps · excessive/unnecessary cache invalidation.

## Phase 7 — Existing-Schema Product Extensions

Only after correctness and security are established, schedule approved §19 extensions against the **existing schema/domain architecture**, using their P1/P2/P3 priority.

## Phase 8 — Production Validation

Regression · security · tenant-isolation · authorization · migration validation · sync · offline · performance · web/mobile smoke tests · production-readiness checklist (§40).

---

# 28. ENGINEERING TASK SPECIFICATION

Provide a full specification for **every P0 and P1 task**, and every P2 task within {{RELEASE_SCOPE}}. Other P2/P3 tasks may appear as single rows in §26 only.

## `{{TASK_ID}}` — {{TASK_TITLE}}

**Source finding / extension:** exact `F-###` / `E-###` ID and title
**Priority:** P0 / P1 / P2 / P3
**Severity:** CRITICAL / HIGH / MEDIUM / LOW / INFO
**Phase:** Phase N
**Dependencies:** task IDs or `None`

### Problem

State the verified defect or gap.

### Evidence

**File:** exact repository-relative path
**Symbol:** function / schema / component / hook
**Location:** line(s), where available
**Current behavior:** observed implementation established by the audit

### Required Change

Specify exactly what engineering must change. Identify expected changes to (list only applicable areas):

- database / migration
- schema
- validation
- service / repository
- API contract
- authorization
- web
- mobile
- synchronization
- tests

Do not provide an architectural redesign unless the audit established that one is required.

### Existing Architecture to Reuse

Identify existing schemas, services, repositories, middleware, permission utilities, validators, hooks, components, and sync infrastructure that should be extended instead of duplicated.

### Files Expected to Change

Repository-relative paths **verified during the audit**. Do not invent paths.

### Compatibility

State each, and explain every `YES`:

- DB migration required: YES / NO
- Backfill required: YES / NO
- API breaking change: YES / NO
- Existing web compatibility risk: YES / NO
- Existing mobile compatibility risk ({{DEPLOYED_MOBILE_VERSIONS}}): YES / NO
- Offline-data (installed app) migration risk: YES / NO
- Rollback concern: YES / NO

### Security / Integrity Invariants

State the invariants that must hold after implementation. Examples:

- Tenant identity originates from authenticated server context.
- Record lookup includes authoritative tenant scope.
- Authorization is server-enforced; caller-controlled ownership fields never override trusted context.
- Protected fields cannot be mass-assigned; field-level permissions apply to API mutations.
- Soft-deleted records are excluded by default.

### Acceptance Criteria

Objective, testable criteria only.

Good:

- An authenticated user in tenant A cannot retrieve the same endpoint's tenant B record by supplying its ID.
- Tenant B IDs return the application's standard not-found/authorization response.
- Authorized same-tenant requests continue to succeed.
- List, search, and count endpoints contain no records from other tenants.
- Regression tests prove allowed and denied paths.

Bad: "Improve tenant security." · "Fix RBAC." · "Make the feature reliable."

### Required Tests

Specify, with positive AND negative cases: unit · DB/schema/constraint · service · API/integration · authorization · tenant isolation · web/component · mobile · synchronization · regression.

### Definition of Done

A task is not complete merely because code was written. Require, where applicable:

implementation complete · migrations validated · backfill validated · tests pass · typecheck passes · lint passes · build passes · tenant isolation verified · authorization verified · web behavior verified · mobile behavior verified · sync behavior verified · backward compatibility verified · no parallel `{{DOMAIN_NAME}}` implementation introduced · relevant documentation/contracts updated.

---

# 29. FILE-LEVEL CHANGE MAP

| File / Directory | Planned Change | Task IDs | Change Type | Risk |
| ---------------- | -------------- | -------- | ----------- | ---- |

Change type: schema · migration · backend · API · authorization · web · mobile · sync · test.

Include existing files to modify, migrations to add, tests to add/update, components/hooks to update, mobile files to update. Use only repository paths verified during the audit. **Highlight files touched by multiple tasks** — they create sequencing/merge risk.

---

# 30. DATABASE MIGRATION PLAN

For every required change to the existing schema:

| Order | Migration | Existing Structure Affected | Purpose | Backfill | Data / Deployment Risk | Rollback / Recovery |
| ----- | --------- | --------------------------- | ------- | -------- | ---------------------- | ------------------- |

Safe ordering to consider:

1. additive nullable structures / indexes
2. application compatibility (deploy code that tolerates old + new)
3. data backfill
4. backfill validation
5. constraint enforcement
6. index/constraint finalization
7. cleanup only when safe

Evaluate: table locking · index-build behavior (e.g. concurrent builds) · existing invalid/duplicate data · rollback feasibility · old-mobile-client compatibility · enum compatibility.

Do NOT create a replacement `{{PRIMARY_TABLE}}`.

---

# 31. API CONTRACT EXECUTION PLAN

For every affected endpoint:

| Method / Endpoint | Current Contract | Required Contract | Breaking? | Web Impact | Mobile Impact | Task IDs |
| ----------------- | ---------------- | ----------------- | --------- | ---------- | ------------- | -------- |

Include changes to: input validation · request fields · protected fields · response fields · errors/status codes · tenant behavior · authorization · pagination · sorting/filtering · soft-deleted records · concurrency/versioning information.

Prefer backward-compatible transitions where {{DEPLOYED_MOBILE_VERSIONS}} may still call the API.

---

# 32. WEB EXECUTION PLAN

For each affected web workflow identify: route/page · components · hooks · queries/query keys · mutations · validation · permission behavior · optimistic behavior · rollback · cache invalidation · navigation · loading state · empty state · error state · success state · lifecycle/read-only behavior · responsive implications.

Tie each change to task IDs. **Backend remediation alone does not make the web workflow complete.**

---

# 33. MOBILE EXECUTION PLAN

For each affected mobile workflow identify: SQLite schema/migration · service · Zustand store · TanStack Query hook/mutation · screen/component · navigation · validation · permission behavior · offline behavior · sync behavior · retry behavior · conflict behavior · tenant/account-switch behavior · media behavior.

Explicitly identify changes requiring **migration of data already stored on users' devices**.

---

# 34. SYNCHRONIZATION SAFETY PLAN

For synchronized operations provide:

| Scenario                             | Current Behavior | Required Behavior | Implementation Task | Verification |
| ------------------------------------ | ---------------- | ----------------- | ------------------- | ------------ |
| Online mutation success              |                  |                   |                     |              |
| Offline local mutation               |                  |                   |                     |              |
| Reconnect                            |                  |                   |                     |              |
| Retry                                |                  |                   |                     |              |
| Duplicate retry                      |                  |                   |                     |              |
| Server rejection                     |                  |                   |                     |              |
| Permission changed before sync       |                  |                   |                     |              |
| Record deleted remotely              |                  |                   |                     |              |
| Concurrent server update             |                  |                   |                     |              |
| Version conflict                     |                  |                   |                     |              |
| App terminated with pending mutation |                  |                   |                     |              |
| Tenant / account switch              |                  |                   |                     |              |
| Partial batch failure                |                  |                   |                     |              |

State explicitly: authoritative source of truth · ID-reconciliation strategy · idempotency strategy · conflict-detection mechanism · conflict-resolution mechanism · tombstone/delete semantics — as **actually intended by the existing architecture**.

If existing requirements/code do not establish one of these, mark it **ARCHITECTURAL DECISION REQUIRED** and carry it to §41. Do not silently invent conflict semantics.

---

# 35. TEST EXECUTION PLAN

Convert dangerous coverage gaps into executable test work:

| Test ID | Related Task | Layer | Scenario | Expected Result | Protects Against |
| ------- | ------------ | ----- | -------- | --------------- | ---------------- |

At minimum cover verified risk in: tenant isolation · IDOR · authorization · field-level permissions · validation · duplicates · create/update · soft delete · soft-delete filtering · restore · bulk mutations · search/filter/pagination · related records · web cache invalidation · mobile persistence · offline sync · retry/idempotency · conflicts (where supported) · tenant/account switching.

Where practical, **first write a regression test that reproduces the confirmed defect**, then remediate.

---

# 36. DEPENDENCY GRAPH & PARALLEL WORKSTREAMS

Produce a dependency graph using task IDs. Example:

```text
{{DOMAIN_SLUG}}-P0-001 Tenant isolation
    ↓
{{DOMAIN_SLUG}}-P1-002 Database / service hardening
    ↓
{{DOMAIN_SLUG}}-P1-004 API contract stabilization
    ├──→ {{DOMAIN_SLUG}}-P1-006 Web integration
    └──→ {{DOMAIN_SLUG}}-P1-007 Mobile integration
              ↓
        {{DOMAIN_SLUG}}-P1-008 Sync validation
              ↓
        {{DOMAIN_SLUG}}-P2-003 Parity → Performance validation → Release
```

Then identify work that can safely run in parallel. **Do not parallelize consumers of an API/schema contract while that contract remains intentionally unstable.**

---

# 37. IMPLEMENTATION WAVES

Convert the dependency graph into practical delivery waves:

- **Wave 1 — Stop Production Risk:** P0 security, authorization, tenant-isolation, destructive-integrity, and data-loss issues plus their regression tests.
- **Wave 2 — Establish Backend Invariants:** database, validation, service, authorization, and API correctness.
- **Wave 3 — Web Alignment:** web functionality and critical UX-state coverage against the stabilized API.
- **Wave 4 — Mobile & Sync Alignment:** SQLite, services, screens, permissions, offline queues, conflicts, failure handling.
- **Wave 5 — Parity & Performance:** remaining platform divergence and verified scalability issues.
- **Wave 6 — Existing-Schema Extensions:** approved §19 improvements.
- **Wave 7 — Release Validation:** full regression and production-readiness gate (§40).

| Wave | Task IDs | Dependencies | Expected Result | Exit Criteria / Verification Gate |
| ---- | -------- | ------------ | --------------- | --------------------------------- |

---

# 38. DEPLOYMENT & ROLLOUT PLAN

Where changes require coordinated deployment, establish safe order. Evaluate a sequence such as:

1. Backward-compatible DB migration
2. Backend supporting current and new contracts (old + new clients)
3. Backend tests / security / integration verification
4. Web deployment
5. Mobile release
6. Mobile compatibility / adoption period ({{DEPLOYED_MOBILE_VERSIONS}})
7. Delayed constraint enforcement / backfill finalization where required
8. Cleanup only after old clients are safe to retire

Explicitly flag: non-backward-compatible migrations · API changes {{DEPLOYED_MOBILE_VERSIONS}} cannot handle · enum changes · sync-protocol changes · required feature flags · delayed constraints/backfills · unsafe rollback points · anything that makes rolling deployment unsafe.

**Do not assume web and mobile can be deployed atomically.**

---

# 39. IMPLEMENTATION RISK REGISTER

| Risk | Probability | Impact | Mitigation | Related Tasks |
| ---- | ----------- | ------ | ---------- | ------------- |

Consider: cross-tenant regression · dirty legacy data · migration failure · table locking · duplicate records / duplicate creation · accidental hard deletion · old-mobile incompatibility · sync corruption · permission regression · cache inconsistency · performance regression · incorrect backfill · enum/version incompatibility · rollback failure.

---

# 40. RELEASE GATES

## Before implementation begins

- [ ] P0 findings are understood and have concrete evidence.
- [ ] Tenant invariants are explicitly defined.
- [ ] Authorization invariants are explicitly defined.
- [ ] Existing schema ownership is understood.
- [ ] No parallel `{{DOMAIN_NAME}}` model is planned.
- [ ] Database changes are dependency-ordered; rollback/recovery is understood.
- [ ] API compatibility has been assessed.
- [ ] Web dependencies are mapped.
- [ ] Mobile dependencies and compatibility ({{DEPLOYED_MOBILE_VERSIONS}}) are mapped.
- [ ] Sync implications are mapped.
- [ ] Required tests are specified.

## Before production release

- [ ] All P0 tasks are complete.
- [ ] Release-required P1 security/integrity tasks are complete.
- [ ] Tenant-isolation regression tests pass.
- [ ] Authorization / field-permission regression tests pass.
- [ ] Database migrations and backfills are validated.
- [ ] Backend tests / typecheck / build pass.
- [ ] Web tests / typecheck / build pass.
- [ ] Mobile tests / typecheck / build pass.
- [ ] Critical web workflows and UI states are verified.
- [ ] Critical mobile workflows and UI states are verified.
- [ ] Offline / reconnect / retry behavior is verified.
- [ ] Sync rejection / conflict paths are verified where supported.
- [ ] API backward compatibility is verified.
- [ ] No unresolved destructive data-integrity issue remains.
- [ ] No known cross-tenant access path remains.

---

# 41. FINAL IMPLEMENTATION EXECUTION SUMMARY

- **Immediate Next Tasks** — the first tasks engineering should execute, in exact dependency order.
- **Critical Path** — the dependency chain controlling production readiness.
- **Parallel Workstreams** — tasks that can safely proceed concurrently.
- **Schema / Migration Work** — changes to the **existing** schema: migrations, indexes, constraints, backfills.
- **Backend Work** — service / API / authorization / validation.
- **Web Work** — web behavior and UX-state remediation.
- **Mobile Work** — mobile / local-database / workflow remediation.
- **Sync Work** — offline / synchronization remediation.
- **Test Work** — required regression and production-safety coverage.
- **Deferred Extensions** — P2/P3 extensions that must not delay production hardening.
- **Remaining Decisions** — ONLY decisions that cannot safely be determined from existing code or requirements (including every **ARCHITECTURAL DECISION REQUIRED** from §34). For each: decision required · why it blocks implementation · architecture-compatible options · consequences of each · recommended decision owner.

Do not silently make product or architectural decisions where repository evidence is insufficient.

---

# 42. IMPLEMENTATION PLAN QUALITY GATE

Before returning the plan, verify:

- [ ] Every P0/P1 task traces to an `F-###` finding or `E-###` extension.
- [ ] Every task references actual repository artifacts.
- [ ] Tasks are ordered by dependency as well as priority/severity.
- [ ] Security/integrity remediation precedes dependent feature work.
- [ ] Database migrations precede code that requires them and are migration-safe.
- [ ] Backend contracts stabilize before dependent web/mobile implementation.
- [ ] Deployed mobile compatibility is considered.
- [ ] Sync failure paths are explicitly covered.
- [ ] Acceptance criteria are objectively testable.
- [ ] Positive and negative tests are specified.
- [ ] No parallel `{{DOMAIN_NAME}}` schema/model is introduced.
- [ ] Existing infrastructure is reused where appropriate.
- [ ] Roadmap extensions do not displace production-critical remediation.
- [ ] Unresolved decisions are listed, not silently resolved.
- [ ] Another engineer can execute the plan without repeating repository discovery.

---

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

# FINAL STANDARD

Do not produce a generic architecture review or a generic roadmap. Produce a **code audit**, then an **implementation-ready engineering plan derived only from that audit**.

The audit answers:

> What is actually implemented, and what is wrong or missing?

The execution plan answers:

> Exactly what should engineering change, where, in what order, what depends on it, how will we prove it works, and what must be true before production release?

> **Every material conclusion must be traceable to an actual implementation artifact.**
> **Every planned task must be traceable to a verified finding or approved extension.**

- If something appears correct, say why and provide evidence.
- If something is incomplete, identify exactly what is missing.
- If something is dangerous, explain the exploit/failure path and business impact.
- If you cannot verify something, write **UNVERIFIED** — do not guess.
- If a sync/conflict/product decision is not established by code or requirements, write **ARCHITECTURAL DECISION REQUIRED** — do not invent it.

The final result must allow the engineering team to move directly from verified findings into an ordered, dependency-aware implementation plan with file-level changes, migrations, acceptance criteria, tests, rollout sequencing, and production release gates. Do not implement the changes during this audit.
