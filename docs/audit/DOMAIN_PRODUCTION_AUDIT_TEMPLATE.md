# {{DOMAIN_NAME}} Domain — Production-Readiness Code Audit

# <!--

# REUSABLE TEMPLATE — HOW TO USE

1. Copy this file to e.g. `audits/{{DOMAIN_SLUG}}/audit-prompt.md`.
2. Fill in every placeholder in the CONFIGURATION table below.
3. Search/replace the placeholders throughout the document
   (or instruct the auditor/AI to resolve them from the table).
4. Delete this comment block.
5. Hand the remainder to the auditor (human or AI) as the instruction.

## Placeholder legend

{{PROJECT_NAME}} e.g. "Gilo Business"
{{DOMAIN_NAME}} Title case, singular. e.g. "Client", "Invoice", "Appointment"
{{DOMAIN_NAME_PLURAL}} e.g. "Clients"
{{DOMAIN_SLUG}} kebab-case. e.g. "client", "invoice"
{{PRIMARY_TABLE}} e.g. `clients`
{{RELATED_TABLES}} e.g. `client_style_preferences`, `client_notes`
{{TENANT_KEYS}} e.g. `organizationId`, `businessProfileId`
{{UNIQUE_IDENTIFIER_FIELDS}} fields used for identity/duplicate detection, e.g. "email, phone"
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

## Example (Client domain)

DOMAIN_NAME=Client PRIMARY_TABLE=clients RELATED_TABLES=client_style_preferences
UNIQUE_IDENTIFIER_FIELDS=email, phone EXPECTED_STATES=active, inactive, archived
DOMAIN_SPECIFIC_FEATURES=VIP/loyalty points, tailor/stylist assignment, profile image
=====================================================================
-->

## CONFIGURATION

| Key                                | Value                                    |
| ---------------------------------- | ---------------------------------------- |
| Project                            | {{PROJECT_NAME}}                         |
| Domain                             | {{DOMAIN_NAME}} / {{DOMAIN_NAME_PLURAL}} |
| Primary table                      | {{PRIMARY_TABLE}}                        |
| Related tables                     | {{RELATED_TABLES}}                       |
| Tenant keys                        | {{TENANT_KEYS}}                          |
| Unique identifier fields           | {{UNIQUE_IDENTIFIER_FIELDS}}             |
| Expected lifecycle states          | {{EXPECTED_STATES}}                      |
| Domain-specific features           | {{DOMAIN_SPECIFIC_FEATURES}}             |
| Related domains                    | {{RELATED_DOMAINS}}                      |
| Backend stack                      | {{BACKEND_STACK}}                        |
| Web stack                          | {{WEB_STACK}}                            |
| Mobile stack                       | {{MOBILE_STACK}}                         |
| Backend paths                      | {{BACKEND_PATHS}}                        |
| Web paths                          | {{WEB_PATHS}}                            |
| Mobile paths                       | {{MOBILE_PATHS}}                         |
| Shared contracts paths             | {{SHARED_PATHS}}                         |
| Reference docs (requirements only) | {{DOCS_PATHS}}                           |

---

## AUDIT ROLE

Act as the **CTO and Principal Software Architect** conducting a strict production-readiness code audit of the existing **{{DOMAIN_NAME}}** implementation across **{{PROJECT_NAME}}** (backend, web, mobile, synchronization).

The objective is to determine whether the existing `{{PRIMARY_TABLE}}` schema, its relationships ({{RELATED_TABLES}}), services, APIs, web implementation, mobile implementation, synchronization, authorization, data integrity, performance, tests, and UI states are correctly implemented, complete, secure, maintainable, and production-ready — and to produce an **As-Built + Gap Analysis + Extension Roadmap** grounded in actual code.

This is an **as-built implementation audit**, not a redesign exercise.

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

If a proposed capability genuinely cannot be implemented cleanly without a new table/schema/domain structure, state explicitly:

> **OUTSIDE EXISTING-SCHEMA CONSTRAINT:** This capability cannot be implemented cleanly using the existing structures.

Do not invent the structure.

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

> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/services/{{DOMAIN_SLUG}}-service.ts`
> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/functions/{{DOMAIN_SLUG}}-functions.ts`
> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/routes/{{DOMAIN_SLUG}}-routes.ts`
> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/types/{{DOMAIN_SLUG}}-types.ts`
> **File:** `{{BACKEND_PATHS}}/{{DOMAIN_SLUG}}/utils/{{DOMAIN_SLUG}}-utils.ts`
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

| Requirement | Backend | Web | Mobile | Status | Evidence |
| ----------- | ------- | --- | ------ | ------ | -------- |

Use only the statuses in §2. If requirements conflict with actual implementation, document both without treating documentation as implementation evidence. Do not inflate status.

---

# 18. PRIMARY FINDINGS TABLE

**This is the primary remediation backlog and the most important output.**

Produce ONE prioritized table containing all material issues, using EXACTLY these columns:

| Priority | Severity | Finding | Evidence / File Path | Impact | Recommended Fix |
| -------- | -------- | ------- | -------------------- | ------ | --------------- |

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

After documenting defects, identify enhancements possible by **extending `{{PRIMARY_TABLE}}` and existing related structures only** ({{RELATED_TABLES}}). Do NOT propose a replacement domain schema.

Allowed change types: column · enum extension · index · constraint · existing-relation enhancement · validation · service logic · API behavior · permission behavior · UI states/behavior · query optimization · synchronization change · audit improvement.

Consider (adapt to domain): lifecycle/status management · segmentation/tags · communication/contact history · referral/source/acquisition tracking · preferences · important dates · relationship links · notes/activity timeline · consent/privacy controls · analytics · retention/loyalty · risk/attention indicators · search/filter improvements · custom fields (only if architecturally appropriate) · portal-facing improvements · integration with {{RELATED_DOMAINS}} · media/profile improvements · {{DOMAIN_SPECIFIC_FEATURES}} enhancements.

| Enhancement | Existing Support (field / table / component) | Required Change (type from allowed list) | Stays in domain? | Duplication / Architecture Risk | Priority | Rationale |
| ----------- | -------------------------------------------- | ---------------------------------------- | ---------------- | ------------------------------- | -------- | --------- |

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
- **I. Recommended implementation order** — ordered by dependency and production risk.

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

| Area                 | Score / 10 | Assessment (must cite findings) |
| -------------------- | ---------: | ------------------------------- |
| Schema Design        |            |                                 |
| Data Integrity       |            |                                 |
| Tenant Isolation     |            |                                 |
| Authorization        |            |                                 |
| Backend Services     |            |                                 |
| API Design           |            |                                 |
| Performance          |            |                                 |
| Web Frontend         |            |                                 |
| Mobile Frontend      |            |                                 |
| Offline/Sync         |            |                                 |
| UX State Coverage    |            |                                 |
| Testing              |            |                                 |
| Maintainability      |            |                                 |
| Web/Mobile Parity    |            |                                 |
| Production Readiness |            |                                 |

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

---

# 24. AUDIT QUALITY GATE

Before returning the report, verify:

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
- [ ] Findings table is sorted per §18 with security items on top.

---

# FINAL AUDIT STANDARD

This must be a **code audit**, not a generic architecture review.

> **Every material conclusion must be traceable to an actual implementation artifact.**

- When implementation is correct: identify the artifact and explain why the behavior is correct.
- When implementation is incomplete: identify the artifact and exactly what is absent.
- When implementation is dangerous: identify the artifact, describe the concrete failure/exploit path, and explain the business impact.
- When evidence cannot establish the answer: write **UNVERIFIED**. Do not fill gaps with assumptions.

The resulting report must be sufficiently concrete that the engineering team can convert the Primary Findings Table directly into a remediation backlog.
