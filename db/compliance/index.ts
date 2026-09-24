// db/schema/compliance/index.ts
//
// Compliance & administration module — v2 only (v1 deleted per §1).
//
// Tables:
//   impersonation_sessions    — admin-as-user sessions with full audit trail
//   dsar_requests             — NDPR/GDPR data subject access requests
//   legal_holds               — litigation/regulatory preservation holds
//   data_retention_policies   — automated data lifecycle rules
//   app_config                — merged: system config + feature flags
//   backup_records            — backup lifecycle tracking
//
// Design decisions:
//
//   impersonation_sessions lives here (not shared/audit.ts) because:
//     It is an active stateful entity with its own lifecycle (start → end),
//     not an append-only log entry. audit_log has a nullable
//     impersonation_session_id FK that points here. The relation is:
//     one impersonation_session → many audit_log entries.
//
//   No FK to users table:
//     All user ID columns (admin_user_id, target_user_id, placed_by, etc.)
//     are stored as plain varchar, not FK references. This is intentional:
//     compliance records must survive user deletion. A DSAR erasure request
//     that deletes a user must not cascade-delete the DSAR record itself.
//     Joins to users are done at the application layer with LEFT JOIN.
//
//   No FK to organizations table:
//     Same reasoning — compliance records outlive orgs. organization_id is
//     a plain varchar used for filtering, not a cascading FK.

import { desc, relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { auditLog } from "../shared/audit";
import {
  backupRestoreStatusEnum,
  backupStatusEnum,
  backupTypeEnum,
  configEnvironmentEnum,
  configKindEnum,
  configTypeEnum,
  dsarStatusEnum,
  dsarTypeEnum,
  impersonationEndReasonEnum,
  legalHoldDataTypeEnum,
  legalHoldPriorityEnum,
  legalHoldStatusEnum,
  retentionActionEnum,
} from "../shared/enums";

// =============================================================================
// IMPERSONATION SESSIONS
// =============================================================================

/**
 * Tracks admin-as-user impersonation sessions.
 *
 * Security model:
 *   1. Admin initiates impersonation — must provide reason and (optionally)
 *      a support ticket ID. MFA re-verification is required.
 *   2. A time-limited session is created (default: 1 hour, max: 4 hours).
 *   3. Every action performed during impersonation is tagged in audit_log
 *      via impersonation_session_id — the audit trail is unbreakable.
 *   4. The target user receives a security notification (email) that their
 *      account was accessed by an admin, with timestamp and reason.
 *   5. Session ends when: admin ends it manually, time expires, or a
 *      security officer terminates it (e.g. suspicious activity detected).
 *
 * approvedBy / approvedAt:
 *   For enterprise-tier orgs, impersonation may require approval from a
 *   second admin or security officer before the session can begin.
 *   NULL = no approval required (starter/growth tiers).
 *
 * actionsPerformed:
 *   Counter incremented by audit_log write middleware whenever an audit
 *   event is written with this session's ID. Used on the admin dashboard
 *   to show "this session performed N actions".
 *
 * lastActionAt:
 *   Timestamp of the most recent audit event written under this session.
 *   Used for idle-timeout detection — sessions idle for >15 minutes
 *   are automatically terminated by a background worker.
 *
 * Device & geo context (added per Staff review):
 *   startedByDevice / endedByDevice  → 'web'|'ios'|'android'|'api'|'cli'
 *   geoLocation JSONB                → { country, city, region, lat, lon }
 *   Captured at start; geo updated at end if the session moved
 *   significantly (rare but useful for security forensics).
 *
 * Append-only considerations:
 *   Unlike audit_log, this table IS mutable — endedAt, endReason,
 *   actionsPerformed, lastActionAt are updated during the session lifecycle.
 *   The immutable audit trail is in audit_log, not here.
 */
export const impersonationSessions = pgTable(
  "impersonation_sessions",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // ─── Participants ─────────────────────────────────────────────────────────
    // Not FK — must survive user deletion
    adminUserId: varchar("admin_user_id", { length: 32 }).notNull(),
    targetUserId: varchar("target_user_id", { length: 32 }).notNull(),

    // ─── Justification ────────────────────────────────────────────────────────
    // Free-text reason — required, shown to security reviewers
    reason: text("reason").notNull(),

    // External support ticket reference e.g. 'SUPPORT-12345'
    ticketId: varchar("ticket_id", { length: 100 }),

    // Second-admin approval (enterprise tier only)
    // Not FK — must survive user deletion
    approvedBy: varchar("approved_by", { length: 32 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // ─── Session ──────────────────────────────────────────────────────────────
    // SHA-256 hash of the session token — never store the raw token
    sessionTokenHash: varchar("session_token_hash", { length: 255 }).notNull(),

    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),

    // ─── Device & Geo Context ────────────────────────────────────────────────
    startedByDevice: varchar("started_by_device", { length: 30 }),
    // { country, city, region, latitude, longitude, asn, isVpn, isTor }
    startedGeoLocation: jsonb("started_geo_location"),

    // Populated when the session ends (rare; only if geolocation changed
    // significantly during the session)
    endedByDevice: varchar("ended_by_device", { length: 30 }),
    endedGeoLocation: jsonb("ended_geo_location"),

    // ─── Timing ───────────────────────────────────────────────────────────────
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),

    // When this session is scheduled to auto-expire
    // Default: startedAt + 1 hour. Max: startedAt + 4 hours.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // When the session actually ended (NULL = still active)
    endedAt: timestamp("ended_at", { withTimezone: true }),

    // Why the session ended — NULL while active
    endReason: impersonationEndReasonEnum("end_reason"),

    // ─── Security ─────────────────────────────────────────────────────────────
    // Whether the admin completed MFA before starting the session
    mfaVerified: boolean("mfa_verified").default(false).notNull(),

    // Whether the target user was notified of the impersonation
    securityNotified: boolean("security_notified").default(false).notNull(),
    securityNotifiedAt: timestamp("security_notified_at", {
      withTimezone: true,
    }),

    // ─── Activity Tracking ────────────────────────────────────────────────────
    // Number of audit events written under this session
    actionsPerformed: integer("actions_performed").default(0).notNull(),

    // Timestamp of the last audit event — used for idle timeout
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // No self-impersonation
    check("chk_imp_no_self_impersonation", sql`${table.adminUserId} <> ${table.targetUserId}`),

    // expiresAt must be after startedAt
    check("chk_imp_expires_after_start", sql`${table.expiresAt} > ${table.startedAt}`),

    // end consistency: endedAt ↔ endReason
    check(
      "chk_imp_end_consistency",
      sql`(${table.endedAt} IS NULL) = (${table.endReason} IS NULL)`,
    ),

    // endedAt must be >= startedAt
    check(
      "chk_imp_ended_after_start",
      sql`${table.endedAt} IS NULL
        OR ${table.endedAt} >= ${table.startedAt}`,
    ),

    // approval consistency
    check(
      "chk_imp_approval_consistency",
      sql`(${table.approvedBy} IS NULL) = (${table.approvedAt} IS NULL)`,
    ),

    // notification consistency
    check(
      "chk_imp_notification_consistency",
      sql`NOT (
        ${table.securityNotified} = TRUE
        AND ${table.securityNotifiedAt} IS NULL
      )`,
    ),

    // actionsPerformed must be non-negative
    check("chk_imp_actions_positive", sql`${table.actionsPerformed} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_imp_admin").on(table.adminUserId, desc(table.startedAt)),
    index("idx_imp_target").on(table.targetUserId, desc(table.startedAt)),

    // Active sessions — for the security dashboard
    index("idx_imp_active").on(table.expiresAt).where(sql`${table.endedAt} IS NULL`),

    // Idle-timeout worker — sessions that haven't acted recently
    index("idx_imp_idle").on(table.lastActionAt).where(sql`${table.endedAt} IS NULL`),

    // Ticket lookup — find all sessions for a support ticket
    index("idx_imp_ticket").on(table.ticketId).where(sql`${table.ticketId} IS NOT NULL`),

    // Geo — suspicious country detection
    // index("idx_imp_geo")
    //   .on(table.organizationId, table.startedAt)
    //   .where(sql`${table.startedGeoLocation} IS NOT NULL`),
  ],
);

// =============================================================================
// DSAR REQUESTS
// =============================================================================

/**
 * Data Subject Access Requests — NDPR (Nigeria) and GDPR (EU) compliance.
 *
 * Lifecycle:
 *   pending → verifying → processing → completed | rejected | failed
 *   pending → verifying → processing → partially_completed
 *
 * Statutory deadlines:
 *   NDPR: 30 days. dueDate = requestedAt + 30 days (set by app layer).
 *   The overdue partial index powers a daily worker that escalates
 *   requests approaching their deadline.
 *
 * slaBreachedAt (added per Staff review):
 *   Set automatically when the worker detects that dueDate has passed
 *   without the request reaching a terminal status. This makes the SLA
 *   breach explicit rather than implicit (you can have dueDate < now()
 *   AND status = 'processing' for a window before slaBreachedAt is set).
 *   Powers the compliance dashboard's "breached requests" count.
 *
 * Legal hold interaction:
 *   Before processing an erasure request, the system checks for active
 *   legal holds on the user's data. If a hold exists, the erasure is
 *   blocked and the request status moves to 'failed'.
 *
 * Data package:
 *   For access/portability requests, the system generates a ZIP file
 *   uploaded to encrypted storage with a time-limited URL (dataPackageUrl).
 *   URL expires after dataPackageExpiresAt (default: completedAt + 7 days).
 */
export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Not FK — must survive user deletion
    userId: varchar("user_id", { length: 32 }).notNull(),
    organizationId: varchar("organization_id", { length: 32 }),

    // ─── Request Details ──────────────────────────────────────────────────────
    type: dsarTypeEnum("type").notNull(),
    status: dsarStatusEnum("status").default("pending").notNull(),
    description: text("description"),
    specificData: jsonb("specific_data"),

    // ─── Verification ─────────────────────────────────────────────────────────
    verificationMethod: varchar("verification_method", { length: 50 }),
    verificationData: jsonb("verification_data"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: varchar("verified_by", { length: 32 }),

    // ─── Timing ───────────────────────────────────────────────────────────────
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: varchar("completed_by", { length: 32 }),

    // Set when the SLA worker detects dueDate < now() and the request
    // is not yet in a terminal state. Not nulled if the request then
    // completes late — preserves the breach record.
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),

    // ─── Data Package ─────────────────────────────────────────────────────────
    dataPackageUrl: text("data_package_url"),
    dataPackageSize: bigint("data_package_size", { mode: "number" }),
    dataPackageExpiresAt: timestamp("data_package_expires_at", {
      withTimezone: true,
    }),

    // ─── Notes ────────────────────────────────────────────────────────────────
    notes: text("notes"),
    rejectionReason: text("rejection_reason"),
    internalComments: text("internal_comments"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    check("chk_dsar_due_after_requested", sql`${table.dueDate} > ${table.requestedAt}`),
    check(
      "chk_dsar_completed_after_requested",
      sql`${table.completedAt} IS NULL
        OR ${table.completedAt} >= ${table.requestedAt}`,
    ),
    check(
      "chk_dsar_verification_consistency",
      sql`(${table.verifiedAt} IS NULL) = (${table.verifiedBy} IS NULL)`,
    ),
    check(
      "chk_dsar_completion_consistency",
      sql`(${table.completedAt} IS NULL) = (${table.completedBy} IS NULL)`,
    ),
    check(
      "chk_dsar_rejection_reason_required",
      sql`NOT (
        ${table.status} = 'rejected'
        AND ${table.rejectionReason} IS NULL
      )`,
    ),
    check(
      "chk_dsar_package_for_access",
      sql`NOT (
        ${table.status} = 'completed'
        AND ${table.type} IN ('access', 'portability')
        AND ${table.dataPackageUrl} IS NULL
      )`,
    ),
    // slaBreachedAt can only be set when dueDate is already past
    check(
      "chk_dsar_breach_after_due",
      sql`${table.slaBreachedAt} IS NULL
        OR ${table.slaBreachedAt} >= ${table.dueDate}`,
    ),
    // dataPackageSize must be non-negative when set
    check(
      "chk_dsar_package_size",
      sql`${table.dataPackageSize} IS NULL
        OR ${table.dataPackageSize} >= 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_dsar_user").on(table.userId),
    index("idx_dsar_status_due").on(table.status, table.dueDate),

    // Overdue requests — daily SLA worker
    index("idx_dsar_overdue")
      .on(table.dueDate)
      .where(sql`${table.status} NOT IN ('completed', 'rejected', 'failed')`),

    // SLA breach scan — find breached requests for the compliance dashboard
    index("idx_dsar_breached")
      .on(table.organizationId, desc(table.slaBreachedAt))
      .where(sql`${table.slaBreachedAt} IS NOT NULL`),

    index("idx_dsar_type").on(table.type, table.status),
    index("idx_dsar_org")
      .on(table.organizationId, table.status)
      .where(sql`${table.organizationId} IS NOT NULL`),

    // Expired data packages — cleanup worker
    index("idx_dsar_package_expiry")
      .on(table.dataPackageExpiresAt)
      .where(sql`${table.dataPackageUrl} IS NOT NULL`),
  ],
);

// =============================================================================
// LEGAL HOLDS
// =============================================================================

/**
 * Litigation/regulatory preservation holds.
 *
 * When active, all data matching the scope MUST NOT be deleted,
 * anonymized, or modified by retention policies or DSAR erasure requests.
 *
 * Lifecycle: active → released | expired | pending_release
 *
 * holdPriority (added per Staff review):
 *   Overlapping holds do happen. When a high-priority hold (e.g. criminal
 *   investigation) and a low-priority hold (e.g. internal review) target
 *   the same data, the high-priority one wins. The release worker checks
 *   priority before unlocking scope. Values: 'critical'|'high'|'medium'|'low'.
 *   critical holds require dual-approval to release.
 *
 * Scope can target:
 *   - A specific user (userId set)
 *   - An entire org (organizationId set, userId null)
 *   - Specific data types and date ranges (scope JSONB)
 */
export const legalHolds = pgTable(
  "legal_holds",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Exactly one of organizationId or userId must be set (XOR CHECK below — NWB-P1-010
    // tightened the model's "at least one": both-set would be a user-in-org semantic nobody
    // asked for). Width 64, not the model's 32: these hold hyphenated UUIDs (36 chars), mirroring
    // `auditLog.actorId`. Still plain varchar, not FK — compliance records outlive their subjects.
    organizationId: varchar("organization_id", { length: 64 }),
    userId: varchar("user_id", { length: 64 }),

    // ─── Hold Details ─────────────────────────────────────────────────────────
    dataType: legalHoldDataTypeEnum("data_type").notNull(),
    priority: legalHoldPriorityEnum("priority").default("medium").notNull(),
    reason: text("reason").notNull(),
    legalCaseId: varchar("legal_case_id", { length: 100 }),
    legalTeamContact: varchar("legal_team_contact", { length: 255 }),
    regulatoryBody: varchar("regulatory_body", { length: 100 }),
    caseReference: varchar("case_reference", { length: 100 }),

    // { dateRange: { from, to }, dataTypes: [...], systems: [...] }
    scope: jsonb("scope"),
    preservationNotes: text("preservation_notes"),

    // ─── Placed By ────────────────────────────────────────────────────────────
    placedBy: varchar("placed_by", { length: 64 }).notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),

    // ─── Expiry & Release ─────────────────────────────────────────────────────
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: varchar("released_by", { length: 64 }),
    releaseReason: text("release_reason"),

    status: legalHoldStatusEnum("status").default("active").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    check(
      "chk_lh_target_required",
      sql`(${table.organizationId} IS NOT NULL)::int
        + (${table.userId} IS NOT NULL)::int = 1`,
    ),
    check(
      "chk_lh_release_consistency",
      sql`(${table.releasedAt} IS NULL) = (${table.releasedBy} IS NULL)`,
    ),
    check(
      "chk_lh_release_reason_required",
      sql`${table.releasedAt} IS NULL
        OR ${table.releaseReason} IS NOT NULL`,
    ),
    check(
      "chk_lh_expires_after_placed",
      sql`${table.expiresAt} IS NULL
        OR ${table.expiresAt} > ${table.placedAt}`,
    ),
    check(
      "chk_lh_released_after_placed",
      sql`${table.releasedAt} IS NULL
        OR ${table.releasedAt} >= ${table.placedAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_lh_org").on(table.organizationId, table.status),
    index("idx_lh_user").on(table.userId, table.status),

    // Active holds — hot path for retention worker
    index("idx_lh_active").on(table.status).where(sql`${table.status} = 'active'`),

    // Critical-priority holds — security team dashboard
    index("idx_lh_critical")
      .on(table.organizationId, table.priority)
      .where(sql`${table.priority} = 'critical' AND ${table.status} = 'active'`),

    index("idx_lh_case").on(table.legalCaseId).where(sql`${table.legalCaseId} IS NOT NULL`),

    // Expiring holds — review before auto-expiry
    index("idx_lh_expiring")
      .on(table.expiresAt)
      .where(
        sql`${table.status} = 'active'
          AND ${table.expiresAt} IS NOT NULL`,
      ),
  ],
);

// =============================================================================
// DATA RETENTION POLICIES
// =============================================================================

/**
 * Automated data lifecycle rules.
 *
 * Evaluation order: lower priority number = evaluated first.
 * First matching policy wins — org-specific overrides beat system defaults.
 *
 * dryRunEnabled (added per Staff review):
 *   When true, the worker computes the affected record count and updates
 *   lastAffectedCount but does NOT execute the deletion. Many orgs first
 *   simulate ("Would delete: 12,941 users, 93,112 media...") before
 *   committing to a destructive policy. UI displays the simulated count.
 *
 * Legal hold override: before executing a retention action, the worker
 * checks for active legal holds. If a hold exists, the action is skipped
 * and lastSkippedAt / lastSkipReason are updated.
 *
 * isLocked: when true, cannot be edited via UI. Only super-admins can unlock.
 */
export const dataRetentionPolicies = pgTable(
  "data_retention_policies",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // NULL = system-wide default policy
    organizationId: varchar("organization_id", { length: 32 }),

    // ─── Policy Details ───────────────────────────────────────────────────────
    dataType: varchar("data_type", { length: 50 }).notNull(),
    dataCategory: varchar("data_category", { length: 50 }),
    retentionDays: integer("retention_days").notNull(),
    retentionAction: retentionActionEnum("retention_action").notNull(),

    // ─── Legal Basis ──────────────────────────────────────────────────────────
    legalBasis: text("legal_basis"),
    regulatoryReference: varchar("regulatory_reference", { length: 100 }),
    ndprArticle: varchar("ndpr_article", { length: 50 }),

    // { conditions: [...], dataTypes: [...], users: [...] }
    exceptions: jsonb("exceptions"),

    // ─── Evaluation ───────────────────────────────────────────────────────────
    priority: integer("priority").default(50).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    enabled: boolean("enabled").default(true).notNull(),

    // When true, the worker computes and records the affected count
    // but does NOT delete anything. UI surfaces the dry-run result.
    dryRunEnabled: boolean("dry_run_enabled").default(false).notNull(),

    // ─── Execution Tracking ───────────────────────────────────────────────────
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    lastAffectedCount: integer("last_affected_count"),
    lastSkippedAt: timestamp("last_skipped_at", { withTimezone: true }),
    lastSkipReason: text("last_skip_reason"),

    // ─── Audit ────────────────────────────────────────────────────────────────
    createdBy: varchar("created_by", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    check("chk_drp_retention_days_positive", sql`${table.retentionDays} > 0`),
    check("chk_drp_priority_range", sql`${table.priority} BETWEEN 1 AND 100`),
    check(
      "chk_drp_affected_count_non_negative",
      sql`${table.lastAffectedCount} IS NULL
        OR ${table.lastAffectedCount} >= 0`,
    ),
    // dry-run policies should never be marked as "applied" in a way
    // that suggests data was actually modified
    check(
      "chk_drp_dry_run_consistency",
      sql`${table.dryRunEnabled} = FALSE
        OR ${table.lastAppliedAt} IS NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_drp_org").on(table.organizationId),
    index("idx_drp_type").on(table.dataType, table.dataCategory),

    // Worker — enabled policies ordered by priority
    index("idx_drp_enabled").on(table.enabled, table.priority),

    index("idx_drp_action").on(table.retentionAction),

    // Dry-run policies — admin UI to view simulated results
    index("idx_drp_dry_run")
      .on(table.organizationId, table.dataType)
      .where(sql`${table.dryRunEnabled} = TRUE`),
  ],
);

// =============================================================================
// APP CONFIG (merged system_config + feature_flags)
// =============================================================================

/**
 * Unified application configuration table that replaces the former
 * system_config and feature_flags tables.
 *
 * A single row can represent either:
 *   - A general system/runtime config entry (kind = 'system_config')
 *   - A feature-flag with rollout targeting (kind = 'feature_flag')
 *
 * --- Uniqueness model ---
 *
 * Two unique constraints cover both kinds:
 *
 *   system_config entries:
 *     Unique on (kind, organization_id, key, environment).
 *     - NULL org = system-wide default
 *     - Set org = org-specific override
 *     - Same key can coexist in multiple environments & orgs
 *
 *   feature_flag entries:
 *     Unique on (organization_id, key) WHERE kind = 'feature_flag'.
 *     - NULL org = global flag visible to all orgs
 *     - Set org = org-specific override
 *     - Postgres treats NULL as distinct in unique constraints, so
 *       (NULL, 'enterprise_ai') and (org_123, 'enterprise_ai') can coexist.
 *
 *   WARNING on feature-flag NULL behavior: Postgres does NOT enforce
 *   uniqueness for rows where ALL unique columns are NULL. Application
 *   layer must guard against duplicate system-wide defaults.
 *
 * --- Key design decisions ---
 *
 * organizationId is deliberately NOT a FK:
 *   Config entries survive org deletion. App layer resolves overrides.
 *
 * defaultValue / previousValue:
 *   defaultValue = factory default (set once, never changes).
 *   previousValue = value before most recent update (powers rollback).
 *
 * isEncrypted:
 *   When TRUE, value contains AES-256-GCM encrypted payload. The
 *   decryption key is in the app's secret manager, not the DB.
 *
 * isLocked:
 *   When TRUE, value cannot be modified via normal UI. Only API bypass.
 *
 * changeReason:
 *   Required for all changes (SOC 2 / ISO 27001 compliance).
 *
 * validationSchema:
 *   JSON Schema document for value validation before write.
 *   NULL = no validation enforced.
 *
 * version: monotonically increasing, incremented on every update.
 */
export const appConfig = pgTable(
  "app_config",
  {
    // ─── Core Identity ──────────────────────────────────────────────────────
    id: varchar("id", { length: 64 }).notNull().primaryKey(),

    // NULL = system-wide default / global flag
    organizationId: varchar("organization_id", { length: 64 }),

    // ─── Discriminator ──────────────────────────────────────────────────────
    // What kind of config entry this is.
    kind: configKindEnum("kind").notNull(),

    // ─── Identification ────────────────────────────────────────────────────
    // For system_config: the config key (e.g. 'rate_limit.max_requests')
    // For feature_flag:  the flag key  (e.g. 'engagement.ai_suggestions')
    key: varchar("key", { length: 100 }).notNull(),

    // Human-readable display name (feature flags have this)
    name: varchar("name", { length: 200 }),

    description: text("description"),

    // ─── Value ──────────────────────────────────────────────────────────────
    // For system_config: the actual config value (any JSON-able type)
    // For feature_flag:  typically boolean, but stored as jsonb for uniformity
    value: jsonb("value").notNull(),

    // Describes the data type of value (string, number, boolean, json, etc.)
    configType: configTypeEnum("config_type").notNull(),

    // Which environment this entry applies to
    environment: configEnvironmentEnum("environment").default("production").notNull(),

    // ─── Feature-Flag Specific ──────────────────────────────────────────────
    enabled: boolean("enabled").default(false).notNull(),
    killSwitch: boolean("kill_switch").default(false).notNull(),
    rolloutPercentage: integer("rollout_percentage").default(0).notNull(),
    targetingRules: jsonb("targeting_rules"),
    environments: jsonb("environments"),
    releaseDate: timestamp("release_date", { withTimezone: true }),

    // ─── Versioning (rollback support) ──────────────────────────────────────
    defaultValue: jsonb("default_value").notNull(),
    previousValue: jsonb("previous_value"),

    // ─── Validation ─────────────────────────────────────────────────────────
    validationSchema: jsonb("validation_schema"),
    validationRules: jsonb("validation_rules"),
    exampleValue: jsonb("example_value"),

    // ─── Change Management ─────────────────────────────────────────────────
    changeReason: text("change_reason").notNull(),
    version: integer("version").default(1).notNull(),

    // ─── Security ──────────────────────────────────────────────────────────
    isEncrypted: boolean("is_encrypted").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),

    // ─── Lifecycle ─────────────────────────────────────────────────────────
    isDeprecated: boolean("is_deprecated").default(false).notNull(),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),

    // ─── Audit ─────────────────────────────────────────────────────────────
    createdBy: varchar("created_by", { length: 64 }).notNull(),
    updatedBy: varchar("updated_by", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Uniqueness ──────────────────────────────────────────────────────────

    // system_config scoped by kind + org + key + environment
    unique("uq_ac_org_key_env").on(table.kind, table.organizationId, table.key, table.environment),

    // feature_flag scoped by org + key (regardless of environment)
    // Uses partial index to avoid conflicting with system_config entries.
    // (`uniqueIndex`, not `unique`: the builder for constraints has no `.where` — the model's
    // original spelling never compiled. Same DDL either way: a partial UNIQUE index.)
    uniqueIndex("uq_ac_org_key")
      .on(table.organizationId, table.key)
      .where(sql`${table.kind} = 'feature_flag' AND ${table.organizationId} IS NOT NULL`),

    // Global feature flag: unique key where org is null
    uniqueIndex("uq_ac_global_flag_key")
      .on(table.key)
      .where(sql`${table.kind} = 'feature_flag' AND ${table.organizationId} IS NULL`),

    // Global system config: unique key + environment where org is null
    uniqueIndex("uq_ac_global_config_key_env")
      .on(table.key, table.environment)
      .where(sql`${table.kind} = 'system_config' AND ${table.organizationId} IS NULL`),

    // ── Check Constraints ──────────────────────────────────────────────────

    check("chk_ac_version_positive", sql`${table.version} >= 1`),
    check(
      "chk_ac_deprecation_consistency",
      sql`NOT (
        ${table.isDeprecated} = TRUE
        AND ${table.deprecatedAt} IS NULL
      )`,
    ),
    check(
      "chk_ac_previous_differs",
      sql`${table.previousValue} IS NULL
        OR ${table.previousValue}::text <> ${table.value}::text`,
    ),
    check(
      "chk_ac_rollout_range",
      sql`${table.rolloutPercentage} >= 0
        AND ${table.rolloutPercentage} <= 100`,
    ),

    // ── Indexes ─────────────────────────────────────────────────────────────

    // Lookup by kind (e.g. "show me all feature flags")
    index("idx_ac_kind").on(table.kind),

    // Lookup by key within scope
    index("idx_ac_key_lookup").on(table.key, table.organizationId),

    // Org-scoped entries
    index("idx_ac_org").on(table.organizationId).where(sql`${table.organizationId} IS NOT NULL`),

    // Environment-scoped queries
    index("idx_ac_env_category").on(table.environment, table.kind),

    // By config type
    index("idx_ac_type").on(table.configType),

    // Active feature flags
    index("idx_ac_enabled").on(table.enabled).where(sql`${table.enabled} = TRUE`),

    // Active kill switches
    index("idx_ac_kill_switch")
      .on(table.organizationId, table.key)
      .where(sql`${table.killSwitch} = TRUE`),

    // Deprecated entries
    index("idx_ac_deprecated").on(table.isDeprecated).where(sql`${table.isDeprecated} = TRUE`),
  ],
);

// =============================================================================
// BACKUP RECORDS
// =============================================================================

/**
 * Tracks backup lifecycle for the admin dashboard.
 *
 * Does NOT perform backups — tracks them. The backup worker creates a row
 * when a backup starts, updates it during progress, marks it done/failed.
 *
 * Verification:
 *   After completion, a worker downloads part of the artifact, recomputes
 *   its checksum, and sets verifiedAt if it matches. Failed verification
 *   triggers a re-run.
 *
 * Retention:
 *   Full DB: 90 days. Incremental WAL: 30 days. File storage: 60 days.
 *   expiresAt is set at creation. Cleanup worker deletes expired artifacts.
 *
 * durationSeconds (added per Staff review):
 *   Total wall-clock time of the backup operation, in seconds. Stored
 *   explicitly because retries may extend the effective duration; the
 *   simple `completedAt - startedAt` math doesn't capture that.
 *
 * verifiedBy (added per Staff review):
 *   The worker (or human) that confirmed the artifact checksum. Not a FK —
 *   workers are infrastructure, not users.
 *
 * Restore testing (added per Staff review):
 *   lastRestoreTestAt    — when we last performed a full restore drill
 *   restoreStatus        — outcome of the most recent test
 *   restoreDurationSecs  — how long the test restore took
 *   "Many backups are never restored until disaster" — restore drills
 *   are the only way to know a backup actually works.
 */
export const backupRecords = pgTable(
  "backup_records",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // NULL = system-wide backup
    organizationId: varchar("organization_id", { length: 64 }),

    // ─── Backup Details ───────────────────────────────────────────────────────
    backupType: backupTypeEnum("backup_type").notNull(),
    backupName: varchar("backup_name", { length: 200 }),
    status: backupStatusEnum("status").notNull(),

    // ─── Storage ──────────────────────────────────────────────────────────────
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    location: text("location").notNull(),
    encrypted: boolean("encrypted").default(true).notNull(),
    compressionType: varchar("compression_type", { length: 50 }),
    checksum: varchar("checksum", { length: 64 }),
    checksumAlgorithm: varchar("checksum_algorithm", { length: 20 }).default("SHA-256"),

    // ─── Scope ────────────────────────────────────────────────────────────────
    includedTables: text("included_tables").array(),
    excludedTables: text("excluded_tables").array(),
    backupMetadata: jsonb("backup_metadata"),

    // ─── Timing ───────────────────────────────────────────────────────────────
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    // Wall-clock duration including retries
    durationSeconds: integer("duration_seconds"),

    // ─── Verification ─────────────────────────────────────────────────────────
    // The worker (or human) that confirmed the artifact checksum.
    // Not a FK — workers are infrastructure, not users.
    verifiedBy: varchar("verified_by", { length: 100 }),

    // ─── Restore Testing ──────────────────────────────────────────────────────
    // Outcome of the most recent full-restore drill against this backup.
    // "Many backups are never restored until disaster" — these columns
    // make drill cadence and success rate visible at a glance.
    lastRestoreTestAt: timestamp("last_restore_test_at", {
      withTimezone: true,
    }),
    restoreStatus: backupRestoreStatusEnum("restore_status"),
    restoreDurationSeconds: integer("restore_duration_seconds"),
    restoreTestedBy: varchar("restore_tested_by", { length: 100 }),

    // ─── Error Handling ───────────────────────────────────────────────────────
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    retryCount: integer("retry_count").default(0).notNull(),

    // ─── Trigger ──────────────────────────────────────────────────────────────
    triggeredBy: varchar("triggered_by", { length: 64 }),
    triggerType: varchar("trigger_type", { length: 50 }),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    check(
      "chk_br_completed_after_started",
      sql`${table.completedAt} IS NULL
        OR ${table.completedAt} >= ${table.startedAt}`,
    ),
    check(
      "chk_br_verified_after_completed",
      sql`${table.verifiedAt} IS NULL
        OR (${table.completedAt} IS NOT NULL
          AND ${table.verifiedAt} >= ${table.completedAt})`,
    ),
    check("chk_br_retry_count_non_negative", sql`${table.retryCount} >= 0`),
    check(
      "chk_br_error_required_on_failure",
      sql`NOT (
        ${table.status} = 'failed'
        AND ${table.errorMessage} IS NULL
      )`,
    ),
    check(
      "chk_br_size_non_negative",
      sql`${table.sizeBytes} IS NULL
        OR ${table.sizeBytes} >= 0`,
    ),
    check(
      "chk_br_duration_non_negative",
      sql`${table.durationSeconds} IS NULL
        OR ${table.durationSeconds} >= 0`,
    ),
    check(
      "chk_br_restore_duration_non_negative",
      sql`${table.restoreDurationSeconds} IS NULL
        OR ${table.restoreDurationSeconds} >= 0`,
    ),
    // Restore drill can only be tested after the backup is complete
    check(
      "chk_br_restore_after_completed",
      sql`${table.lastRestoreTestAt} IS NULL
        OR (${table.completedAt} IS NOT NULL
          AND ${table.lastRestoreTestAt} >= ${table.completedAt})`,
    ),
    // SHA-256 hex is exactly 64 characters
    check(
      "chk_br_checksum_length",
      sql`${table.checksum} IS NULL
        OR length(${table.checksum}) = 64`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_br_type").on(table.backupType, desc(table.startedAt)),
    index("idx_br_status").on(table.status, desc(table.startedAt)),
    index("idx_br_org").on(table.organizationId).where(sql`${table.organizationId} IS NOT NULL`),

    // Cleanup worker — expired completed backups
    index("idx_br_expires")
      .on(table.expiresAt)
      .where(
        sql`${table.expiresAt} IS NOT NULL
          AND ${table.status} = 'completed'`,
      ),

    // Verification worker — completed but not yet verified
    index("idx_br_unverified")
      .on(table.completedAt)
      .where(
        sql`${table.status} = 'completed'
          AND ${table.verifiedAt} IS NULL`,
      ),

    // Restore drill scheduler — backups overdue for a restore test
    index("idx_br_restore_due")
      .on(desc(table.lastRestoreTestAt))
      .where(
        sql`${table.status} = 'completed'
          AND ${table.verifiedAt} IS NOT NULL`,
      ),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const impersonationSessionsRelations = relations(impersonationSessions, ({ many }) => ({
  auditEvents: many(auditLog, {
    relationName: "impersonationSession_auditEvents",
  }),
}));

export const dsarRequestsRelations = relations(dsarRequests, (_) => ({}));
export const legalHoldsRelations = relations(legalHolds, (_) => ({}));
export const dataRetentionPoliciesRelations = relations(dataRetentionPolicies, (_) => ({}));
export const appConfigRelations = relations(appConfig, (_) => ({}));
export const backupRecordsRelations = relations(backupRecords, (_) => ({}));
