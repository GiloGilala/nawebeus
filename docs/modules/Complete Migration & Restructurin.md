# Complete Migration & Restructuring Documentation

## What Changed, Where It Went, and How to Find It

---

## Table of Contents

1. [High-Level Summary](#high-level-summary)
2. [Folder Structure Overview](#folder-structure)
3. [Shared Module Changes](#shared-modules)
4. [Core Module Changes](#core-module)
5. [Compliance Module Changes](#compliance-module)
6. [Social Accounts Module Changes](#social-accounts-module)
7. [Publishing Module Changes](#publishing-module)
8. [Monitoring Module Changes](#monitoring-module)
9. [Engagement Module Changes](#engagement-module)
10. [PR Module Changes](#pr-module)
11. [Influencer Module Changes](#influencer-module)
12. [Commerce Module Changes](#commerce-module)
13. [Campaigns Module Changes](#campaigns-module)
14. [Master Table Relocation Index](#master-table-index)
15. [Master Enum Changes](#master-enum-changes)
16. [Quick Lookup: "Where Is X Now?"](#quick-lookup)
17. [Never-Create List](#never-create-list)

---

## 1. High-Level Summary {#high-level-summary}

### What This Restructuring Did

| Goal | Result |
|------|--------|
| Eliminate duplicate tables across modules | ~35 duplicate declarations removed |
| Consolidate shared concerns into one place | 7 shared files created |
| Reduce total table count | Net reduction of ~25+ tables |
| Fix polymorphic FK problems | Shared-PK inheritance pattern adopted |
| Unify audit logging | 4 audit tables → 1 `audit_log` |
| Unify analytics/performance | 12 tables → 5 tables |
| Unify approval workflow | 5 patterns → 2 tables |
| Unify alert system | 6 tables → 2 tables |
| Unify template system | 4 tables → 1 table |
| Unify media assets | 2 tables → 1 table |
| Unify contact system | 5 tables → 4 tables (with real FKs) |

---

## 2. Folder Structure Overview {#folder-structure}

### Generation Order (dependency-safe)

```
db/
├── shared/
│   ├── enums.ts             ← Step 1  (no dependencies)
│   ├── audit.ts             ← Step 2  (needs enums)
│   ├── analytics.ts         ← Step 3  (needs enums)
│   ├── alerts.ts            ← Step 4  (needs enums)
│   ├── templates.ts         ← Step 5  (needs enums)
│   ├── media.ts             ← Step 6  (needs enums)
│   ├── approval.ts          ← Step 7  (needs enums)
│   └── contacts.ts          ← Step 8  (needs enums)
│
├── core/
│   └── index.ts             ← Step 9
│
├── compliance/
│   └── index.ts             ← Step 10 (needs enums, audit)
│
├── social-accounts/
│   └── index.ts             ← Step 11 (needs enums, analytics)
│
├── publishing/
│   └── index.ts             ← Step 12 (needs enums, templates, media,
│                                        approval, analytics)
├── monitoring/
│   └── index.ts             ← Step 13 (needs enums, alerts, analytics)
│
├── engagement/
│   └── index.ts             ← Step 14 (needs enums, alerts, templates,
│                                        media, approval)
├── pr/
│   └── index.ts             ← Step 15 (needs enums, contacts, templates)
│
├── influencer/
│   └── index.ts             ← Step 16 (needs enums, contacts, analytics)
│
├── commerce/
│   └── index.ts             ← Step 17 (needs enums, analytics)
│
├── campaigns/
│   └── index.ts             ← Step 18 (needs enums, templates, analytics)
│
├── relations.ts             ← Step 19 (needs everything)
├── schema.ts                ← Step 20 (re-exports everything)
└── index.ts                 ← Step 21 (public API)
```

---

## 3. Shared Module Changes {#shared-modules}

### 3.1 `shared/enums.ts`

**What it is:** Single source of truth for all enums across the entire codebase.

**What changed:**

| Enum | Change | Detail |
|------|--------|--------|
| `platform` | Standardized | Value `twitter_x` used throughout — 13 values total |
| `sentiment` | Added value | Now includes `'mixed'` — 4 values total |
| `contentStatusEnum` | Narrowed | 11 states — used by posts + press_releases |
| `publishingResultStatusEnum` | NEW (narrower subset) | 5 states — only for `publishing_results` rows |
| `approvalRequestStatusEnum` | Renamed | Was `approvalStatusEnum` — now shared across all entities |
| `approvalActionEnum` | Standardized | 8 actions — each produces one `approval_history` row |
| `templateTypeEnum` | Corrected | 5 types — `notification_templates` excluded (does not exist) |
| `contactKindEnum` | NEW | 2 values — designed to extend |
| `aiModelEnum` | Updated | Added `gpt-4o` + `claude-3-sonnet` |
| `auditSourceModuleEnum` | Added value | Added `'monitoring'` (was missing) — 13 modules total |
| `auditSeverityEnum` | Kept separate | Uses `emergency` — NOT the same as `alertEventSeverityEnum` |
| `alertEventSeverityEnum` | Kept separate | Uses `crisis` — NOT the same as `auditSeverityEnum` |

**Total enums defined:** 78
**Duplicate declarations removed:** ~35 (across 8+ original files)

---

### 3.2 `shared/audit.ts`

**What it contains:**

```
audit_log              ← consolidated from 4 tables
impersonation_sessions ← MOVED here from compliance (then moved again — see below)
```

> ⚠️ **Note on `impersonation_sessions`:** Initially placed in `shared/audit.ts`, then **moved to `compliance/index.ts`** because impersonation is a compliance concern (NDPR, security policy), not general audit infrastructure. `audit_log` still links back via `impersonationSessionId`.

**Tables consolidated INTO `audit_log`:**

| Original Table | Original Location | Now In | Discriminator |
|---------------|-------------------|--------|---------------|
| `auditLog` | `core/index.ts` | `audit_log` | `sourceModule='core'` |
| `adminAuditLog` v1 | `compliance/index.ts` | `audit_log` | `sourceModule='admin'` |
| `adminAuditLog` v2 | `compliance/index.ts` | `audit_log` | `sourceModule='admin'` (v2 wins) |
| `engagementAuditLog` | `engagement/index.ts` | `audit_log` | `sourceModule='engagement'` |

**Fields added to `audit_log` vs prior versions:**

| Field | Why Added |
|-------|-----------|
| `actorId` now nullable | NULL = system-initiated event (`actorType='system'`) |
| `requestId` | Correlates related events from one HTTP request |
| `checksum` / `previousChecksum` | Nullable — only admin/system events populate these |
| `metadata` jsonb | Module-specific extras |

**No FK constraints on:** `organizationId`, `actorId`, `resourceId`, `targetUserId`, `sessionId`, `impersonationSessionId` — audit entries must outlive all referenced records.

**Tables kept separate from `audit_log`:**

| Table | Reason |
|-------|--------|
| `impersonation_sessions` | Own lifecycle (active/expired/ended) — links TO audit_log |
| `dsar_requests` | 30-day NDPR response lifecycle |
| `legal_holds` | Own active/released lifecycle |
| `data_retention_policies` | Own scheduled execution lifecycle |
| `social_account_operation_log` | High-volume ops log, shorter retention, different read pattern |

**Result:** 2 tables replace 4 tables

---

### 3.3 `shared/analytics.ts`

**Tables consolidated INTO `analytics_aggregates`:**

| Original Table | Original Location | Now In | Discriminator |
|---------------|-------------------|--------|---------------|
| `post_performance` | `publishing/` | `analytics_aggregates` | `dimension_2='post'` |
| `usage_tracking` | `core/index.ts` | `analytics_aggregates` | `dimension_2='org_usage'` |
| `social_account_metrics` | `social-accounts/` | `analytics_aggregates` | `dimension_2='social_account'` |
| `commerce_analytics` | `commerce/` | `analytics_aggregates` | `dimension_2='product'` or `'content'` |
| `campaign_daily_stats` | `campaigns/` | `analytics_aggregates` | `dimension_2='campaign'` |
| `monitoring_daily_summary` | `monitoring/` | `analytics_aggregates` | `dimension_2='monitoring'` |
| `engagement_performance` | `engagement/` | `analytics_aggregates` | `dimension_2='engagement'` |

**Merged INTO `analytics_reports`:**

| Original Table | What Happened |
|---------------|---------------|
| `analytics_exports` | Inlined as `lastExport*` columns on `analytics_reports`. Full export history → `audit_log` (action=`'report.exported'`) |

**Fields added vs prior versions:**

| Field | Location | Why |
|-------|----------|-----|
| `p50Value` / `p95Value` | `analytics_aggregates` | Percentile columns for response time metrics |
| `consecutiveFailureCount` | `analytics_reports` | Scheduled report failure alerting |
| `lastExportFileSizeBytes` | `analytics_reports` | Renamed from `lastExportFileSize` for clarity |
| `includeRawData` | `analytics_reports` | Renamed from `includeData` for clarity |
| `userId` | `analytics_events` | Actor context for user-initiated events |

**Corrections made:**

| Issue | Fix |
|-------|-----|
| NULL in composite PK | Documented sentinel pattern — use `''` not NULL |
| `analytics_events.id` | Changed `serial` not `varchar(32)` — high-volume insert table |
| `platform` column | `varchar` not `platformEnum` in aggregates — avoids enum migration for new platforms |

**Result:** 5 tables replace 12 tables

---

### 3.4 `shared/alerts.ts`

**Name change:** `alert_policies` → `alert_rules` (simpler, clearer, matches `sourceModule` naming)

**Tables consolidated INTO `alert_rules`:**

| Original Table | Original Location | Now In | Discriminator |
|---------------|-------------------|--------|---------------|
| `engagementSlaPolicies` | `engagement/` | `alert_rules` | `sourceModule='engagement'`, `conditionType='threshold'` |
| `listeningAlerts` | `listening/` (v1, deleted) | `alert_rules` | `sourceModule='listening'` |
| `monitoringAlerts` (config rows) | `monitoring/` | `alert_rules` | `sourceModule='monitoring'` |
| `analyticsAlerts` (config) | `analytics/` | `alert_rules` | `sourceModule='analytics'` |

**Tables consolidated INTO `alert_events`:**

| Original Table | Original Location | Now In | Key fields preserved |
|---------------|-------------------|--------|---------------------|
| `engagementSlaBreaches` | `engagement/` | `alert_events` | `breachType`, `slaStartedAt`, `breachedAt`, `minutesOverdue` |
| `monitoringAlerts` (event rows) | `monitoring/` | `alert_events` | `title`, `description`, `severity`, `isRead`, `isAcknowledged` |
| `analyticsAlerts.history` (JSONB array) | `analytics/` | `alert_events` | Each array entry → one `alert_events` row |

**Fields added vs prior versions:**

| Field | Location | Why |
|-------|----------|-----|
| `threshold` | `alert_rules` | Scalar shortcut — avoids JSONB extraction for simple rules |
| `defaultSeverity` | `alert_rules` | Replaces `severityMinimum` integer (self-documenting) |
| `maxAlertsPerDay` | `alert_rules` | Prevents alert storms (renamed from `maxAlertCount`) |
| `minBaselineVolume` | condition JSONB | Prevents false positives at low volume |
| `minSampleSize` | condition JSONB | Prevents false positives with small samples |
| `minAuthorityScore` | condition JSONB | Monitoring rules filter low-credibility sources |
| `sourceTiers` | condition JSONB | Monitoring rules filter by outlet tier |
| `alertType` | `alert_events` | Copied from rule at fire time — preserved even if rule changes |
| `alertSentAt` | `alert_events` | Timestamp when notification was dispatched |
| `escalatedToId` | `alert_events` | Typed FK — was plain `varchar` |

**Fields removed vs prior versions:**

| Removed Field | Why | Replaced By |
|--------------|-----|-------------|
| `businessHoursOnly` (top-level) | Moved inside `condition` JSONB | `condition.businessHoursOnly` |
| `businessHours` (top-level) | Moved inside `condition` JSONB | `condition.businessHours` |
| `severityMinimum` (integer 1-4) | Not self-documenting | `defaultSeverity` enum |
| `policyType` enum | Required migration for new types | `sourceModule` + `conditionType` combination |

**Kept separate:**

| Table | Location | Reason |
|-------|----------|--------|
| `crisis_incidents` | `monitoring/index.ts` | Own lifecycle — links to `alert_events` via `originAlertEventId` |

**Result:** 2 tables replace 6 tables

---

### 3.5 `shared/templates.ts`

**Tables consolidated INTO `templates`:**

| Original Table | Original Location | Now In | Discriminator |
|---------------|-------------------|--------|---------------|
| `contentTemplates` | `publishing/` | `templates` | `templateType='post'` |
| `engagementTemplates` | `engagement/` | `templates` | `templateType='engagement_response'` |
| `campaignTemplates` | `campaigns/` | `templates` | `templateType='campaign'` |
| Crisis template fields | Inlined on `press_releases` | `templates` | `templateType='press_release'`, `config.isCrisisTemplate=true` |

> ⚠️ **`notification_templates` does NOT exist.** It was referenced in earlier versions but has been verified as non-existent across all schema files. It is explicitly excluded and must never be created.

**Fields added vs prior versions:**

| Field | Why |
|-------|-----|
| `sharedContent` | Cross-platform base copy (post type) |
| `currentApprovalStatus` | Denormalized from `approval_requests` for fast list-view queries |
| `avgConversionRate` | Campaign template performance metric |
| `categoryPath` | Dot-notation tree for UI navigation |
| `category` | Flat grouping for picker header |
| `isPidginAppropriate` | Nigerian market: Pidgin English flag |
| `language` | BCP-47 code, defaults to `en-NG` |
| `mediaIds` | Pre-attached media (post + email types) |

**Visibility logic:**

```
organizationId=NULL + isPublic=true    → all orgs (template marketplace)
organizationId=NULL + isPublic=false   → internal system use only
organizationId=SET  + isOrganizationWide=true  → all org members
organizationId=SET  + isOrganizationWide=false → creator only
```

**Approval pattern corrected:**
- ❌ Old: inline `approvalHistory` JSONB on templates
- ✅ New: `currentApprovalStatus` (denormalized) + `approval_requests` table (shared relational)

**Result:** 1 table replaces 4 tables

---

### 3.6 `shared/media.ts`

**Tables consolidated INTO `media_assets`:**

| Original Table | Original Location | Now In |
|---------------|-------------------|--------|
| `mediaAssets` | `publishing/` | `media_assets` |
| `engagementAttachments` | `engagement/` | `media_assets` (via `attachedToType='engagement_response'`) |

**Field removed:**

| Removed Field | Why | How to query instead |
|--------------|-----|---------------------|
| `usedInPosts TEXT[]` | Denormalized array drifts out of sync | `SELECT * FROM posts WHERE media_ids @> ARRAY[$id]` OR `SELECT * FROM media_assets WHERE attached_to_type='post' AND attached_to_id=$postId` |

**Fields added vs prior versions:**

| Field | Why |
|-------|-----|
| `attachedToType` / `attachedToId` | Polymorphic attachment context — replaces `engagementAttachments` |
| `processingState` JSONB | Full pipeline state machine — replaces `processed boolean + processError text` |
| `attribution` | Copyright attribution text |
| `licenseType` | Asset license identifier |
| `licenseExpiresAt` | Expiry date for licensed media |

**Corrections:**

| Issue | Fix |
|-------|-----|
| `processed boolean + processError text` | → `processingState` JSONB state machine (supports intermediate states: scanning, processing, cdn_upload) |
| `sizeBytes: integer` | → `bigint` (integer max ~2.1GB, 4K video exceeds this) |
| `durationSeconds scale: 2` | → `scale: 3` (supports sub-second precision for gif frame timing) |

**Visibility rules:**

```
Library assets:   attachedToType IS NULL
                  → browseable, searchable, reusable, soft-deletable

Attached assets:  attachedToType SET
                  → accessed only via parent entity
                  → never soft-deleted (deleted with parent)
                  → no folderPath, no tags (not browseable)
```

**Result:** 1 table replaces 2 tables

---

### 3.7 `shared/approval.ts`

**Patterns consolidated:**

| Original Pattern | Original Location | Now In |
|-----------------|-------------------|--------|
| `engagementApprovalRequests` table | `engagement/` | `approval_requests` (`entityType='engagement_response'`) |
| `approvalHistory` table | `publishing/` | `approval_history` (shared) |
| `posts.approvalHistory` JSONB | `publishing/` | `approval_history` rows (relational, indexed) |
| `press_releases` inline approval fields | `pr/` | `approval_requests` columns |

**Why the old JSONB approach failed:**

| Operation | JSONB Approach | Relational Approach |
|-----------|---------------|---------------------|
| Count events | Impossible directly | `SELECT COUNT(*) FROM approval_history` |
| Group by action | Requires `jsonb_array_elements()` + subquery | `GROUP BY action` |
| Index approver | Cannot index inside JSONB array | Standard B-tree index |
| Parallel approval | Nested JSONB unmaintainable | `isParallel` flag + `currentStep` |
| Cross-entity queue | UNION of 3 tables with JSONB extraction | One query, one index |

**Entity pointer pattern:**

```
posts.currentApprovalRequestId              → FK to approval_requests.id
press_releases.currentApprovalRequestId     → FK to approval_requests.id
engagement_responses.currentApprovalRequestId → FK to approval_requests.id

These nullable columns are denormalized convenience pointers.
Set when request is created. Cleared when request reaches terminal state.
Source of truth: approval_requests WHERE entity_type=$t AND entity_id=$id
```

**Fields added vs prior versions:**

| Field | Location | Why |
|-------|----------|-----|
| `contentSnapshot` JSONB | `approval_requests` | Read-only copy of content at submission time |
| `versionSnapshot` | `approval_requests` | Links to `posts.version` / `press_releases.version` |
| `versionAtAction` | `approval_history` | Per-history-row version context |
| `stageOrder` | `approval_history` | "Who approved at stage 2?" |
| `actorType` | `approval_history` | `'user'` or `'system'` for automated actions |
| `delegatedToId` | `approval_history` | Tracks delegation chain |
| `reminderCount` | `approval_requests` | How many reminders sent to currentApprover |
| `lastReminderAt` | `approval_requests` | When the last reminder was sent |
| `escalatedAt` / `escalatedToId` | `approval_requests` | Escalation tracking |
| `decidedById` / `decidedAt` | `approval_requests` | Who made the final decision |
| `currentStep` | `approval_requests` | Tracks position in sequential chain |
| `entityVersion` | `approval_requests` | Entity version when submitted |

**No FK constraints on:**
- `approvalRequestId` in history (history must outlive request for compliance)
- `entityId` (approval records must outlive deleted entities)

**Result:** 2 tables replace 5 patterns

---

### 3.8 `shared/contacts.ts`

**Problem solved:** Polymorphic FK pattern had no DB enforcement.

```
OLD (polymorphic — no enforcement):
  contactType: 'journalist' | 'influencer'  ← string, no FK
  contactId: varchar                          ← no FK constraint
  DELETE journalist does NOT cascade to interactions

NEW (shared-PK inheritance — DB-enforced):
  contacts.id = journalists.id = influencers.id
  journalists.id REFERENCES contacts.id ON DELETE CASCADE
  influencers.id REFERENCES contacts.id ON DELETE CASCADE
  contact_interactions.contactId REFERENCES contacts.id ON DELETE CASCADE
```

**Tables changed:**

| Original Table | What Happened | Now In |
|---------------|---------------|--------|
| `journalists` (standalone) | Converted to detail table | `journalists` (id = FK to `contacts.id`) |
| `influencers` (standalone, influencer module) | Converted to detail table | `influencers` (id = FK to `contacts.id`) |
| `influencers` (listening v1) | Deleted with listening v1 | — |
| `prInteractions` | Removed | `contact_interactions` |
| `influencerInteractions` | Removed | `contact_interactions` |

**Fields added vs prior versions:**

| Field | Location | Why |
|-------|----------|-----|
| `mergedIntoId` / `mergedAt` | `contacts` | Deduplication merge tracking |
| `relationshipScore` | `contacts` | Composite score on base table |
| `interactionCount` | `contacts` | Denormalized counter |
| `lastInteractionAt` | `contacts` | Denormalized on base table |
| `followUpCompleted` / `completedAt` | `contact_interactions` | Follow-up lifecycle |

**Result:** 4 tables replace 5 tables. Net = 0 added, but real FK enforcement gained.

---

## 4. Core Module Changes {#core-module}

**File:** `core/index.ts`

**Tables removed (moved elsewhere):**

| Table | Moved To | Why |
|-------|----------|-----|
| `auditLog` | `shared/audit.ts` → `audit_log` | Consolidated with 3 other audit tables |
| `usage_tracking` | `shared/analytics.ts` → `analytics_aggregates` | `dimension_2='org_usage'` |
| `social_accounts` (core version) | Deleted — `social-accounts/` is canonical | Name collision resolved |

**Tables added (were missing, now defined):**

| Table | Why Added |
|-------|-----------|
| `email_verification_tokens` | Referenced but undefined in original |
| `password_reset_tokens` | Referenced but undefined in original |
| `password_history` | Referenced but undefined in original |
| `login_attempts` | Referenced but undefined in original |

**Fields added to existing tables:**

| Table | Field Added | Why |
|-------|------------|-----|
| `users` | `totalLoginCount` | Lifetime login counter |
| `users` | `passwordChangedAt` | Password rotation policy enforcement |
| `organization_members` | `suspendedBy` | Who suspended the member |
| `organization_members` | `suspendedReason` | Why the member was suspended |
| `sessions` | `revokedReason` | Why the session was revoked |
| `api_keys` | `lastUsedIp` | IP of last API call |
| `api_keys` | `usageCount` | Total API calls with this key |
| `payment_methods` | `bankAccountLast4` | Bank account identification |
| `invoices` | `paymentMethodId` | Which payment method was used |

**Check constraints added:** 28 total
**Indexes added:** 47 total (was ~25)

**Total tables in core:** 15
```
users, email_verification_tokens, password_reset_tokens,
password_history, login_attempts, organizations,
organization_members, sessions, invitations, api_keys,
payment_methods, invoices, notification_preferences,
onboarding_progress
```

---

## 5. Compliance Module Changes {#compliance-module}

**File:** `compliance/index.ts`

**Version deduplication:** v1 and v2 of all tables existed. v2 wins in every case.

**Table moved INTO this module:**

| Table | Moved From | Reason |
|-------|-----------|--------|
| `impersonation_sessions` | `shared/audit.ts` | Impersonation is a compliance concern (NDPR, security policy), not general audit infrastructure |

**Tables deleted (v1 versions — never create):**

| Deleted Table | Replaced By |
|--------------|-------------|
| `adminAuditLog` v1 | `audit_log` in `shared/audit.ts` |
| `impersonationSessions` v1 | `impersonation_sessions` in this file (improved) |
| `dsarRequests` v1 | `dsar_requests` in this file (improved) |
| `legalHolds` v1 | `legal_holds` in this file (improved) |
| `dataRetentionPolicies` v1 | `data_retention_policies` in this file (improved) |
| `systemConfiguration` v1 | `system_config` v2 → later merged into `app_config` |
| `featureFlags` v1 | `feature_flags` v2 → later merged into `app_config` |
| `backupRecords` v1 | `backup_records` in this file (improved) |

**Key fields added across all tables:**

| Table | Fields Added |
|-------|-------------|
| `impersonation_sessions` | `approvedBy`, `approvedAt`, `lastActionAt`, `securityNotifiedAt` |
| `dsar_requests` | `specificData` JSONB, `dataPackageSize` |
| `legal_holds` | Release consistency checks, expiry indexes |
| `data_retention_policies` | `lastAffectedCount`, `lastSkippedAt`, `lastSkipReason`, `priority` |
| `system_config` v2 / `feature_flags` v2 | merged into `app_config` — see `app_config` row |
| `app_config` | unified table with `kind` discriminator, all columns from both predecessors |
| `backup_records` | `checksumAlgorithm`, `compressionType`, `backupName`, `includedTables`, `excludedTables`, `errorStack` |

**Check constraints added:** 25 new constraints (v2); additional 5 in `app_config` merge
**Total indexes:** 31 (was ~20); consolidated to 9 on `app_config`
**Net reduction:** −7 tables (from version deduplication)

**Total tables in compliance:** 6
```
impersonation_sessions, dsar_requests, legal_holds,
data_retention_policies, app_config, backup_records
```

---

## 6. Social Accounts Module Changes {#social-accounts-module}

**File:** `social-accounts/index.ts`

**Tables removed:**

| Table | Moved To | Discriminator |
|-------|----------|---------------|
| `social_account_metrics` | `shared/analytics.ts` → `analytics_aggregates` | `dimension_2='social_account'` |
| `social_accounts` (core module version) | Deleted — this module is canonical | — |

**Name collision resolution:**
- `socialAccounts` in core module → **deleted**
- `socialAccounts` in listening v1 → **deleted with listening v1**
- `socialAccounts` here → **canonical version**

**ID type change:** `uuid` → `varchar(32)` for consistency with all other modules.

**Fields added to existing tables:**

| Table | Field Added | Why |
|-------|------------|-----|
| `social_accounts` | `quotaStatus` | Overall quota health indicator |
| `social_accounts` | `dataRetentionUntil` | Retention deadline for disconnected accounts |
| `social_account_health_log` | `httpStatusCode` | Platform API response code |
| `social_account_health_log` | `endpoint` | Which API endpoint was checked |
| `token_refresh_log` | `httpStatusCode` | Token refresh endpoint response code |
| `token_refresh_log` | `newRefreshTokenIssued` | Tracks token rotation |

**Check constraints added:** 15
**Indexes:** 24 total (was ~15)

**New partial indexes:**

| Index | Purpose |
|-------|---------|
| `idx_sa_circuit_breaker` | Accounts with open circuit breakers |
| `idx_sa_retention` | Disconnected accounts past retention |
| `idx_sahl_transition` | Status change events only |
| `idx_sahl_latency` | Slow API responses |
| `idx_trl_failures` | Failed refresh attempts only |
| `idx_os_user` | User's pending OAuth flows |

**Total tables:** 4
```
social_accounts, oauth_states,
social_account_health_log, token_refresh_log
```

---

## 7. Publishing Module Changes {#publishing-module}

**File:** `publishing/index.ts`

**Tables removed (moved to shared):**

| Table | Moved To | How to Access |
|-------|----------|---------------|
| `content_templates` | `shared/templates.ts` | `templateType='post'` |
| `media_assets` | `shared/media.ts` | `attachedToType='post'` |
| `post_performance` | `shared/analytics.ts` | `dimension_2='post'`, `dimension_1=post_id` |
| `post_drafts` | Eliminated | Version history via `posts.previousVersionId` chain |
| `approval_history` | `shared/approval.ts` | `entityType='post'` |

**Fields removed from `posts` (v2 inlining reverted):**

| Removed Field | Why | Where Now |
|--------------|-----|-----------|
| `platform` (singular) | Posts target multiple platforms | `posts.platforms` (array) |
| `reach`, `impressions`, `likes`, `comments`, `shares`, `saves`, `linkClicks`, `videoViews`, `engagementRate` | Performance data | `analytics_aggregates` |
| `lastFetchedAt`, `dataComplete` | Performance metadata | `analytics_aggregates` |
| `approvalHistory` (JSONB) | Cannot be queried efficiently | `approval_history` table |
| `approvalChain` (JSONB) | Cannot be queried efficiently | `approval_requests.approvalChain` |
| `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`, `rejectionReason` | Inline approval fields | `approval_requests` + `approval_history` |

**Fields added to `posts`:**

| Field Added | Why |
|------------|-----|
| `previousVersionId` | Self-referential version chain |
| `isLatestVersion` | Partial index for fast latest-version queries |
| `isAutoSave` | Distinguish auto-save from manual save |
| `versionComment` | What changed in this version |
| `savedBy` | Who saved this version |
| `savedAt` | When this version was saved |
| `currentApprovalRequestId` | Pointer to `shared/approval.ts` |
| `isUrgent` | Priority flag for approval queue |

**Fields added to `publishing_results`:**

| Field Added | Why |
|------------|-----|
| `nextRetryAt` | Exponential backoff scheduling |
| `publishedContent` | Snapshot of what was sent to platform |
| `publishedMediaUrls` | Media URLs submitted to platform |

> ⚠️ **Key correction:** `publishing_results` stays **relational** (one row per post+platform). It is NOT inlined onto posts.

**Check constraints:** 9 total
**Indexes:** 19 total

**Total tables:** 2
```
posts, publishing_results
```

---

## 8. Monitoring Module Changes {#monitoring-module}

**File:** `monitoring/index.ts`

**Listening v1 — entirely deleted (never create):**

| Deleted Table | Replaced By | Location |
|--------------|-------------|----------|
| `listeningQueries` | `monitoring_campaigns` | `monitoring/index.ts` |
| `socialMentions` | Deleted — engagement module handles social | — |
| `mediaArticles` v1 | `media_articles` | `monitoring/index.ts` |
| `mentionTags` | `media_articles.tags` | `monitoring/index.ts` |
| `listeningAlerts` | `alert_rules` + `alert_events` | `shared/alerts.ts` |
| `competitors` v1 | `monitoring_competitors` | `monitoring/index.ts` |
| `influencers` v1 | Deleted — contacts module has influencers | — |
| `crisisIncidents` v1 | `crisis_incidents` (expanded) | `monitoring/index.ts` |

**Tables removed to shared:**

| Table | Moved To |
|-------|----------|
| `monitoring_alerts` | `shared/alerts.ts` |
| `monitoring_daily_summary` | `shared/analytics.ts` → `analytics_aggregates` (`dimension_2='monitoring'`) |

**Fields added to existing tables:**

| Table | Fields Added |
|-------|-------------|
| `monitoring_campaigns` | `precisionScore`, `recallScore`, `noiseRatio`, `lastRunAt`, `totalMatches`, `alertThreshold` |
| `media_articles` | `keyQuotes`, `sourceTier`, `excerpt` |
| `monitoring_competitors` | `avgSentiment`, `logoUrl`, `website` |
| `crisis_incidents` | `originAlertEventId`, `responseActions` JSONB, `lessonsLearned`, `articleCount`, `totalReach`, `peakNegativeSentiment`, `estimatedAveImpactNaira` |

**Check constraints:** 24 total
**Indexes:** 27 total

**Total tables:** 4
```
monitoring_campaigns, media_articles,
monitoring_competitors, crisis_incidents
```

---

## 9. Engagement Module Changes {#engagement-module}

**File:** `engagement/index.ts`

**Tables removed (moved to shared):**

| Removed Table | Moved To | How to Access |
|--------------|----------|---------------|
| `engagementTemplates` | `shared/templates.ts` | `templateType='engagement_response'` |
| `engagementAttachments` | `shared/media.ts` | `attachedToType='engagement_response'` |
| `engagementApprovalRequests` | `shared/approval.ts` | `entityType='engagement_response'` |
| `engagementPerformance` | `shared/analytics.ts` | `dimension_2='engagement'` |
| `engagementAuditLog` | `shared/audit.ts` → `audit_log` | `sourceModule='engagement'` |

**FK corrections:**

| Table | Field | Change |
|-------|-------|--------|
| `engagement_responses` | `messageId` | Now real FK with CASCADE |
| `engagement_sla_breaches` | `messageId` | Now real FK with RESTRICT |
| `engagement_ai_suggestions` | `messageId` | Now real FK with CASCADE |

**SLA correction:** `businessHours` is now required when `businessHoursOnly = true` (CHECK constraint enforced at DB level).

**Check constraints added:** 28 total across all 6 tables
**New indexes:** `idx_em_platform`, `idx_em_sentiment`, `idx_em_sla_policy`, `idx_er_failed`, `idx_ais_feedback`

---

## 10. PR Module Changes {#pr-module}

**File:** `pr/index.ts`

**Pattern changes:**

| What Changed | Old Pattern | New Pattern |
|-------------|-------------|-------------|
| `journalists` table | Standalone table | Detail table — `id` is FK to `contacts.id` (shared-PK inheritance) |
| `prInteractions` | Separate table in PR module | `contact_interactions` in `shared/contacts.ts` |
| Press releases approval | Inline columns on `press_releases` | `approval_requests` + `approval_history` in shared |
| Crisis templates | Fields inlined on `press_releases` | `templates` table, `config.isCrisisTemplate=true` |
| Version history | Separate `press_release_versions` table | JSONB append-only array on `press_releases` |

**Fields added:**

| Table | Field | Why |
|-------|-------|-----|
| `press_releases` | `currentApprovalRequestId` | Pointer to `shared/approval.ts` |

**FK corrections:**

| Table | Field | Change |
|-------|-------|--------|
| `pr_distributions` | `pressReleaseId` | Now real FK with CASCADE |
| `pr_coverage_attribution` | `pressReleaseId` | Now real FK with CASCADE |

**Check constraints:** 32 total — temporal ordering, score ranges, metric consistency, NDPR consistency

**New indexes:** `idx_pr_pending_approval`, `idx_pr_active`, `idx_dist_failed`, `idx_dist_channel`, `idx_cov_unverified`, `idx_cov_attribution_method`

---

## 11. Influencer Module Changes {#influencer-module}

**File:** `influencer/index.ts`

**Name collision resolution:**

| Version | Status |
|---------|--------|
| `influencers` (listening v1) | **Deleted** with listening v1 |
| `influencers` (influencer module) | **Canonical** — now extends contacts base table |

**Pattern changes:**

| What Changed | Old Pattern | New Pattern |
|-------------|-------------|-------------|
| `influencers` table | Standalone table | Detail table — `id` is FK to `contacts.id` (shared-PK inheritance) |
| `influencerInteractions` | Separate table | `contact_interactions` in `shared/contacts.ts` |

**Fields added vs prior versions:**

| Table | Field | Why |
|-------|-------|-----|
| `influencers` | `averageViews` | Was missing from v2 |
| `influencer_content_submissions` | `revisionNumber` | Replaces confusing `revisionCount` on assignments |

**FK corrections:**

| Table | Field | Change |
|-------|-------|--------|
| `influencer_program_assignments` | `programId` | Now real FK with CASCADE |
| `influencer_program_assignments` | `influencerId` | Now real FK with RESTRICT |
| `influencer_content_submissions` | `assignmentId` | Now real FK with CASCADE |

**Atomic operation added:** `spentNaira` update on contract — atomically increments when assignment moves to `contracted` status.

**Check constraints:** 34 total — budget/spend consistency, score ranges, temporal ordering, deliverable counts, APCON status logic

**New indexes:** `idx_ica_payment_overdue`, `idx_ics_apcon`, `idx_ics_brand_safety`, `idx_inf_brand_safety`, `idx_inf_fraud_score`

---

## 12. Commerce Module Changes {#commerce-module}

**File:** `commerce/index.ts`

**Tables removed:**

| Table | Moved To | Discriminator |
|-------|----------|---------------|
| `commerceAnalytics` | `shared/analytics.ts` → `analytics_aggregates` | `dimension_2='product'` or `'content'` |

**Fields added to existing tables:**

| Table | Fields Added | Why |
|-------|-------------|-----|
| `carts` | `isRecovered`, `recoveredAt` | Tracks whether abandoned cart was recovered |
| `products` | `isDeleted`, `deletedAt` | Soft-delete with consistency check |

**Corrections:**

| Issue | Fix |
|-------|-----|
| `products.publishedAt` consistency | CHECK: `isPublished=true` requires `publishedAt` |
| `productDiscounts` percentage max | CHECK: <= 100 for percentage type |

**New partial indexes:**

| Index | Purpose |
|-------|---------|
| `idx_cart_recovery_email` | Recovery email workflow |
| `idx_cart_recovery_sms` | Recovery SMS workflow |
| `idx_cart_abandoned` | Abandoned non-recovered carts |
| `idx_ord_platform_order_id` | External sync idempotency |
| `idx_prod_external` | External sync operations |
| `idx_psl_latest` | Last completed sync per platform |

**Check constraints:** 46 total across all 5 tables

---

## 13. Campaigns Module Changes {#campaigns-module}

**File:** `campaigns/index.ts`

**Tables removed:**

| Table | Moved To | How to Access |
|-------|----------|---------------|
| `campaignTemplates` | `shared/templates.ts` | `templateType='campaign'` |
| `campaignDailyStats` | `shared/analytics.ts` → `analytics_aggregates` | `dimension_2='campaign'` |

**FK corrections:**

| Table | Field | Change |
|-------|-------|--------|
| `campaign_entries` | `campaignId` | Now real FK with CASCADE |
| `campaign_entry_methods` | `campaignId` | Now real FK with CASCADE |

**New CHECK constraints on campaigns:**

| Constraint | Rule |
|-----------|------|
| drawDate >= endDate | Draw cannot happen before campaign ends |
| autoDrawWinners | Requires `drawDate` |
| `publishedAt` consistency | Status-dependent |
| `endedAt` consistency | Status-dependent |

**New CHECK constraints on entries:**

| Constraint | Rule |
|-----------|------|
| Self-referral prevention | Cannot refer yourself |
| Winner field consistency | 4 checks |
| Prize claimed consistency | Claimed requires fulfillment data |
| Decline reason consistency | Required on decline |
| Responded-after-notified | Temporal ordering |

**New indexes:** `idx_camp_auto_draw`, `idx_camp_slug`, `idx_entry_winner_fulfillment`, `idx_entry_response_deadline`, `idx_entry_referral_count`

**Check constraints:** 29 total across 3 tables

---

## 14. Master Table Relocation Index {#master-table-index}

### Complete "Old Name → New Location" Reference

| Old Table Name | Old Location | New Location | Action |
|---------------|--------------|--------------|--------|
| `auditLog` | `core/` | `shared/audit.ts` → `audit_log` | Consolidated |
| `adminAuditLog` v1 | `compliance/` | `shared/audit.ts` → `audit_log` | Consolidated |
| `adminAuditLog` v2 | `compliance/` | `shared/audit.ts` → `audit_log` | Consolidated (v2 wins) |
| `engagementAuditLog` | `engagement/` | `shared/audit.ts` → `audit_log` | Consolidated |
| `impersonationSessions` v1 | `compliance/` | Deleted | v2 replaces |
| `impersonationSessions` v2 | `shared/audit.ts` | `compliance/index.ts` | Moved |
| `post_performance` | `publishing/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `usage_tracking` | `core/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `social_account_metrics` | `social-accounts/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `commerce_analytics` | `commerce/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `campaign_daily_stats` | `campaigns/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `monitoring_daily_summary` | `monitoring/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `engagement_performance` | `engagement/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `analytics_exports` | `analytics/` | Inlined into `analytics_reports` | Merged |
| `alert_policies` | Various | `shared/alerts.ts` → `alert_rules` | Renamed + Consolidated |
| `engagementSlaPolicies` | `engagement/` | `shared/alerts.ts` → `alert_rules` | Consolidated |
| `engagementSlaBreaches` | `engagement/` | `shared/alerts.ts` → `alert_events` | Consolidated |
| `listeningAlerts` | `listening/` (deleted) | `shared/alerts.ts` → `alert_rules` | Consolidated |
| `monitoringAlerts` (config) | `monitoring/` | `shared/alerts.ts` → `alert_rules` | Split |
| `monitoringAlerts` (events) | `monitoring/` | `shared/alerts.ts` → `alert_events` | Split |
| `analyticsAlerts` config | `analytics/` | `shared/alerts.ts` → `alert_rules` | Split |
| `analyticsAlerts` history | `analytics/` | `shared/alerts.ts` → `alert_events` | Split (each row) |
| `contentTemplates` | `publishing/` | `shared/templates.ts` | Consolidated |
| `engagementTemplates` | `engagement/` | `shared/templates.ts` | Consolidated |
| `campaignTemplates` | `campaigns/` | `shared/templates.ts` | Consolidated |
| Crisis template fields | `press_releases` (inline) | `shared/templates.ts` | Consolidated |
| `notification_templates` | — | Does not exist | Never create |
| `mediaAssets` | `publishing/` | `shared/media.ts` → `media_assets` | Consolidated |
| `engagementAttachments` | `engagement/` | `shared/media.ts` → `media_assets` | Consolidated |
| `engagementApprovalRequests` | `engagement/` | `shared/approval.ts` → `approval_requests` | Consolidated |
| `approvalHistory` | `publishing/` | `shared/approval.ts` → `approval_history` | Consolidated |
| `posts.approvalHistory` JSONB | `publishing/` | `shared/approval.ts` → `approval_history` rows | Converted |
| `press_releases` approval fields | `pr/` | `shared/approval.ts` | Consolidated |
| `journalists` (standalone) | `pr/` | `shared/contacts.ts` → `journalists` (detail table) | Refactored |
| `influencers` (standalone) | `influencer/` | `shared/contacts.ts` → `influencers` (detail table) | Refactored |
| `influencers` (listening v1) | `listening/` (deleted) | Deleted | Removed |
| `prInteractions` | `pr/` | `shared/contacts.ts` → `contact_interactions` | Consolidated |
| `influencerInteractions` | `influencer/` | `shared/contacts.ts` → `contact_interactions` | Consolidated |
| `social_accounts` (core version) | `core/` | Deleted | `social-accounts/` is canonical |
| `social_accounts` (listening v1) | `listening/` (deleted) | Deleted | Listening v1 retired |
| `post_drafts` | `publishing/` | Eliminated | Version chain via `previousVersionId` |
| `press_release_versions` | `pr/` | Eliminated | JSONB array on `press_releases` |
| `listeningQueries` | `listening/` (deleted) | `monitoring_campaigns` | Replaced |
| `socialMentions` | `listening/` (deleted) | Deleted | Engagement module handles social |
| `mediaArticles` v1 | `listening/` (deleted) | `monitoring/media_articles` | Replaced |
| `mentionTags` | `listening/` (deleted) | `media_articles.tags` | Inlined |
| `competitors` v1 | `listening/` (deleted) | `monitoring_competitors` | Replaced |
| `crisisIncidents` v1 | `listening/` (deleted) | `monitoring/crisis_incidents` | Replaced + expanded |
| `commerceAnalytics` | `commerce/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `campaignTemplates` | `campaigns/` | `shared/templates.ts` | Consolidated |
| `usageTracking` | `core/` | `shared/analytics.ts` → `analytics_aggregates` | Consolidated |
| `systemConfiguration` v1 | `compliance/` | `compliance/app_config` (v3) | Replaced (v2 merged into v3) |
| `dsarRequests` v1 | `compliance/` | `compliance/dsar_requests` (v2) | Replaced |
| `legalHolds` v1 | `compliance/` | `compliance/legal_holds` (v2) | Replaced |
| `dataRetentionPolicies` v1 | `compliance/` | `compliance/data_retention_policies` (v2) | Replaced |
| `featureFlags` v1 | `compliance/` | `compliance/app_config` (v3) | Replaced (v2 merged into v3) |
| `backupRecords` v1 | `compliance/` | `compliance/backup_records` (v2) | Replaced |

---

## 15. Master Enum Changes {#master-enum-changes}

### All 78 Enums — Defined in `shared/enums.ts`

| Enum Name | Key Change | Values |
|-----------|-----------|--------|
| `platform` | `twitter_x` throughout (not `twitter`) | 13 values |
| `sentiment` | Added `'mixed'` | 4 values |
| `contentStatusEnum` | 11 states | posts + press_releases |
| `publishingResultStatusEnum` | NEW — narrower | 5 states, `publishing_results` only |
| `approvalRequestStatusEnum` | Renamed from `approvalStatusEnum` | 7 states |
| `approvalActionEnum` | Standardized | 8 actions |
| `templateTypeEnum` | `notification_templates` excluded | 5 types |
| `contactKindEnum` | NEW | 2 values |
| `aiModelEnum` | Added `gpt-4o`, `claude-3-sonnet` | Updated |
| `auditSourceModuleEnum` | Added `'monitoring'` | 13 modules |
| `auditSeverityEnum` | Kept SEPARATE from alert severity | Uses `emergency` |
| `alertEventSeverityEnum` | Kept SEPARATE from audit severity | Uses `crisis` |

---

## 16. Quick Lookup: "Where Is X Now?" {#quick-lookup}

### Common Questions

| Question | Answer |
|----------|--------|
| Where is post performance data? | `shared/analytics.ts` → `analytics_aggregates` where `dimension_2='post'` |
| Where is audit logging? | `shared/audit.ts` → `audit_log`, filter by `sourceModule` |
| Where are media files tracked? | `shared/media.ts` → `media_assets` |
| Where are approval workflows? | `shared/approval.ts` → `approval_requests` + `approval_history` |
| Where are all alert rules? | `shared/alerts.ts` → `alert_rules` |
| Where are all alert events? | `shared/alerts.ts` → `alert_events` |
| Where are content templates? | `shared/templates.ts` → `templates` |
| Where are journalist records? | `shared/contacts.ts` → `contacts` JOIN `journalists` |
| Where are influencer records? | `shared/contacts.ts` → `contacts` JOIN `influencers` |
| Where are all interactions (journalists + influencers)? | `shared/contacts.ts` → `contact_interactions` |
| Where is usage/billing analytics? | `shared/analytics.ts` → `analytics_aggregates` where `dimension_2='org_usage'` |
| Where is social account performance? | `shared/analytics.ts` → `analytics_aggregates` where `dimension_2='social_account'` |
| Where is campaign performance? | `shared/analytics.ts` → `analytics_aggregates` where `dimension_2='campaign'` |
| Where is engagement performance? | `shared/analytics.ts` → `analytics_aggregates` where `dimension_2='engagement'` |
| Where are SLA breach records? | `shared/alerts.ts` → `alert_events` where `sourceType='sla_timer'` |
| Where are crisis incidents? | `monitoring/index.ts` → `crisis_incidents` |
| Where is post version history? | `publishing/index.ts` → `posts` — follow `previousVersionId` chain |
| Where are press release versions? | `pr/index.ts` → `press_releases.versionHistory` (JSONB array) |
| Where is impersonation data? | `compliance/index.ts` → `impersonation_sessions` |
| Where is the canonical `social_accounts` table? | `social-accounts/index.ts` |
| Where is the engagement SLA configuration? | `shared/alerts.ts` → `alert_rules` where `sourceModule='engagement'` |

---

## 17. Never-Create List {#never-create-list}

The following tables must **never be created**. They are either deleted, consolidated, or renamed:

```
❌ notification_templates          → does not exist in schema
❌ auditLog (core module)          → use audit_log in shared/audit.ts
❌ adminAuditLog v1                → use audit_log in shared/audit.ts
❌ adminAuditLog v2                → use audit_log in shared/audit.ts
❌ engagementAuditLog              → use audit_log in shared/audit.ts
❌ alert_policies                  → renamed to alert_rules
❌ engagementSlaPolicies           → use alert_rules (sourceModule='engagement')
❌ engagementSlaBreaches           → use alert_events
❌ listeningAlerts                 → use alert_rules (sourceModule='listening')
❌ monitoringAlerts                → split into alert_rules + alert_events
❌ analyticsAlerts                 → split into alert_rules + alert_events
❌ contentTemplates (publishing)   → use templates (templateType='post')
❌ engagementTemplates             → use templates (templateType='engagement_response')
❌ campaignTemplates               → use templates (templateType='campaign')
❌ engagementAttachments           → use media_assets (attachedToType='engagement_response')
❌ mediaAssets (publishing)        → use media_assets in shared/media.ts
❌ engagementApprovalRequests      → use approval_requests (entityType='engagement_response')
❌ approvalHistory (publishing)    → use approval_history in shared/approval.ts
❌ posts.approvalHistory JSONB     → use approval_history rows
❌ journalists (standalone)        → use contacts JOIN journalists (shared-PK)
❌ influencers (standalone)        → use contacts JOIN influencers (shared-PK)
❌ influencers (listening v1)      → deleted with listening v1
❌ prInteractions                  → use contact_interactions
❌ influencerInteractions          → use contact_interactions
❌ social_accounts (core module)   → social-accounts/ module is canonical
❌ social_accounts (listening v1)  → deleted with listening v1
❌ post_performance                → use analytics_aggregates (dimension_2='post')
❌ usage_tracking                  → use analytics_aggregates (dimension_2='org_usage')
❌ social_account_metrics          → use analytics_aggregates (dimension_2='social_account')
❌ commerce_analytics              → use analytics_aggregates (dimension_2='product')
❌ campaign_daily_stats            → use analytics_aggregates (dimension_2='campaign')
❌ monitoring_daily_summary        → use analytics_aggregates (dimension_2='monitoring')
❌ engagement_performance          → use analytics_aggregates (dimension_2='engagement')
❌ analytics_exports               → inlined into analytics_reports
❌ post_drafts                     → use posts.previousVersionId chain
❌ press_release_versions          → use press_releases.versionHistory JSONB
❌ listeningQueries                → use monitoring_campaigns
❌ socialMentions                  → deleted (engagement module handles social)
❌ mediaArticles v1                → use monitoring/media_articles
❌ mentionTags                     → use media_articles.tags
❌ competitors v1                  → use monitoring_competitors
❌ crisisIncidents v1              → use monitoring/crisis_incidents
❌ systemConfiguration v1          → use app_config (v3; v2 system_config was merged)
❌ system_config v2                → use app_config (merged with feature_flags v2)
❌ featureFlags v1                 → use app_config (v3; v2 feature_flags was merged)
❌ feature_flags v2                → use app_config (merged with system_config v2)
❌ dsarRequests v1                 → use dsar_requests (v2)
❌ legalHolds v1                   → use legal_holds (v2)
❌ dataRetentionPolicies v1        → use data_retention_policies (v2)
❌ backupRecords v1                → use backup_records (v2)
❌ impersonationSessions v1        → use impersonation_sessions (v2 in compliance/)
```

---

*This document covers all changes made during the v3 schema restructuring. For any table not listed above, check `shared/` first, then the relevant module's `index.ts`.*