import { desc, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  auditActorTypeEnum,
  auditCategoryEnum,
  auditSeverityEnum,
  auditSourceModuleEnum,
} from "./enums";

// =============================================================================
// UNIFIED AUDIT LOG
// =============================================================================

/**
 * Single append-only audit table for the entire application.
 *
 * Replaces (never recreate these):
 *   - audit_log             (core module)
 *   - admin_audit_log       (compliance module ×2 versions)
 *   - engagement_audit_log  (engagement module)
 *
 * Discriminators:
 *   - module      → which part of the application wrote this row
 *   - actorType   → who performed the action
 *   - category    → what kind of action it was
 *   - severity    → how important it is
 *
 * Why one table is correct:
 *   - Compliance investigations cut across modules ("show me everything
 *     admin X did across the whole platform in the last 30 days")
 *   - Adding a new module is a metadata change, not a schema migration
 *   - One tamper-detection chain to verify, not N chains
 *   - Single retention/deletion policy (regulatory driven)
 *
 * Append-only contract:
 *   - No updatedAt column — by design.
 *   - Application layer enforces: no UPDATE, no DELETE on this table.
 *   - The only "change" allowed is the integrity verification job
 *     setting hashChainValid = FALSE when tampering is detected.
 *   - PostgreSQL role permissions should be configured to enforce
 *     this at the DB layer as a defense-in-depth measure.
 *
 * Tamper detection (hash chain):
 *   - checksum        → SHA-256 hash of
 *                       (id + action + actorId + resourceId +
 *                        createdAt + previousChecksum)
 *   - previousChecksum → checksum of the immediately preceding row for
 *                        the same module
 *   - Required for:   module IN ('admin', 'system', 'compliance')
 *   - Optional for:   other modules (lightweight, high-volume)
 *   - Verification job scans the chain in createdAt order and sets
 *     hashChainValid = FALSE on rows whose chain is broken.
 *
 * Compliance notes:
 *   - Rows must outlive the actors and resources they reference.
 *   - No FK constraints on actorId, resourceId, targetUserId, or
 *     impersonationSessionId — referenced entities may be deleted;
 *     audit entries must be preserved.
 *   - organizationId is nullable — system-level events (backups,
 *     migrations, cron) have no org context.
 *
 * Mutation category rule:
 *   - For category IN ('create','update','delete','state_change'),
 *     at least one of (beforeState, afterState, changes) MUST be populated.
 *   - For categories like ('login','view','read'), all three may be NULL.
 *
 * Index strategy:
 *   - Almost every audit query is "newest first for X" — most indexes
 *     use desc(createdAt) to match the access pattern.
 *   - requestId is included as a standalone index for cross-system
 *     request tracing (every log, every error, every audit shares
 *     one request id; you'll search it constantly when debugging).
 */
export const auditLog = pgTable(
  "unified_audit_log",
  {
    // NOTE 2026-09-13: every id column below was varchar(32). Nawebeus ids are
    // UUIDs (36 chars), so any audit write carrying a real id failed with
    //   22001 value too long for type character varying(32)
    // which silently broke the entire audit trail — the DB-backed audit test
    // passed only because it used short fake ids like "org-1". Widened to 64 so
    // the columns hold UUIDs and prefixed ids ("al_...", "sess_...") alike.
    id: varchar("id", { length: 64 }).primaryKey(),

    // ─── Scope ───────────────────────────────────────────────────────────────
    module: auditSourceModuleEnum("module").notNull(),

    // Nullable — system-level events (backups, migrations) have no org context
    organizationId: varchar("organization_id", { length: 64 }),

    // ─── Actor ───────────────────────────────────────────────────────────────
    // Not a FK — actor record may be deleted; audit entry must be preserved
    actorId: varchar("actor_id", { length: 64 }),
    actorType: auditActorTypeEnum("actor_type"),
    actorIp: inet("actor_ip"),
    actorUserAgent: text("actor_user_agent"),

    // ─── Impersonation Context ───────────────────────────────────────────────
    // Populated when actorType = 'impersonation'
    // Not a FK — impersonation session may be purged; log must be preserved
    impersonationSessionId: varchar("impersonation_session_id", { length: 64 }),

    // ─── Action ──────────────────────────────────────────────────────────────
    // Free-form verb e.g. 'user.created', 'post.published', 'login.failed'
    // Convention: <resource>.<verb> — enforced at application layer
    action: varchar("action", { length: 100 }).notNull(),
    category: auditCategoryEnum("category"),

    // ─── Resource ────────────────────────────────────────────────────────────
    // Not FK constraints — resource may be deleted after audit entry written
    resourceType: varchar("resource_type", { length: 50 }),
    resourceId: varchar("resource_id", { length: 64 }),

    // The user whose data was affected (may differ from actorId)
    // e.g. admin modifying another user's account
    targetUserId: varchar("target_user_id", { length: 64 }),

    // ─── Changes ─────────────────────────────────────────────────────────────
    // Full entity snapshots — only populated for high-value mutations
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),

    // Diff summary — lighter weight than full snapshots for routine events
    changes: jsonb("changes"),

    // ─── Context ─────────────────────────────────────────────────────────────
    severity: auditSeverityEnum("severity").default("info").notNull(),
    reason: text("reason"),
    requestId: varchar("request_id", { length: 100 }),
    sessionId: varchar("session_id", { length: 64 }),

    // ─── Tamper Detection ────────────────────────────────────────────────────
    // SHA-256 hash of (id + action + actorId + resourceId +
    //                  createdAt + previousChecksum)
    // NULL for low-sensitivity rows where the chain is not maintained
    // (lightweight, high-volume modules).
    // Required for module IN ('admin', 'system', 'compliance').
    checksum: varchar("checksum", { length: 64 }),

    // Checksum of the immediately preceding row for the same module.
    // Enables chain-of-custody verification.
    // Must be present iff checksum is present.
    previousChecksum: varchar("previous_checksum", { length: 64 }),

    // Set to false by integrity verification job if chain is broken.
    // New rows default to true. Nullable for backfilled historical rows
    // whose chain validity has not yet been verified.
    hashChainValid: boolean("hash_chain_valid").default(true).notNull(),

    // ─── Extra Payload ───────────────────────────────────────────────────────
    // Module-specific fields that don't map to shared columns
    metadata: jsonb("metadata"),

    // Append-only — no updatedAt
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // SHA-256 hex is exactly 64 characters when present
    check(
      "chk_ual_checksum_length",
      sql`${table.checksum} IS NULL
        OR length(${table.checksum}) = 64`,
    ),
    check(
      "chk_ual_previous_checksum_length",
      sql`${table.previousChecksum} IS NULL
        OR length(${table.previousChecksum}) = 64`,
    ),

    // checksum ↔ previousChecksum are populated together
    // (you can't be a chain link without knowing the previous link)
    check(
      "chk_ual_checksum_pairing",
      sql`(${table.checksum} IS NULL
        AND ${table.previousChecksum} IS NULL)
      OR
      (${table.checksum} IS NOT NULL
        AND ${table.previousChecksum} IS NOT NULL)`,
    ),

    // actorId ↔ actorType: if we know who acted, we know what type of actor
    // (a NULL actorId represents a system event with no actorType)
    check(
      "chk_ual_actor_consistency",
      sql`${table.actorId} IS NULL
        OR ${table.actorType} IS NOT NULL`,
    ),

    // Impersonation events MUST reference a session
    check(
      "chk_ual_impersonation_consistency",
      sql`${table.actorType} <> 'impersonation'
        OR ${table.impersonationSessionId} IS NOT NULL`,
    ),

    // Non-impersonation events MUST NOT have an impersonation session
    // (defense against accidentally populating the field for the wrong actor)
    check(
      "chk_ual_impersonation_only",
      sql`${table.impersonationSessionId} IS NULL
        OR ${table.actorType} = 'impersonation'`,
    ),

    // Tamper detection required for security-sensitive modules
    // These modules must always participate in the chain
    check(
      "chk_ual_admin_requires_checksum",
      sql`${table.module} <> 'admin'
        OR ${table.checksum} IS NOT NULL`,
    ),
    check(
      "chk_ual_system_requires_checksum",
      sql`${table.module} <> 'system'
        OR ${table.checksum} IS NOT NULL`,
    ),
    check(
      "chk_ual_compliance_requires_checksum",
      sql`${table.module} <> 'compliance'
        OR ${table.checksum} IS NOT NULL`,
    ),

    // Mutation categories must have at least one of before/after/changes.
    //
    // REMOVED 2026-09-13: the constraint read
    //   category NOT IN ('create','update','delete','state_change') OR <state present>
    // which references an *operation* taxonomy. `audit_category` is a *domain*
    // taxonomy (authentication, content, billing, …) and can never hold those
    // literals, so Postgres could not even create the constraint — it rejected
    // the whole `bun run db:push` with
    //   invalid input value for enum audit_category: "create".
    //
    // Deleting it is behaviour-preserving: the constraint has never existed in
    // any database, so it enforced nothing. Re-expressing the rule needs an
    // operation field that does not exist yet (see `action`, which is free-text).
    // Recorded as an open finding — do not re-add without deciding the taxonomy.

    // ── Primary query patterns ───────────────────────────────────────────────

    // Module-scoped feed — most common admin/compliance query
    index("idx_ual_module_created").on(table.module, desc(table.createdAt)),

    // Org-scoped feed — tenant audit view, newest first
    index("idx_ual_org_created").on(table.organizationId, desc(table.createdAt)),

    // Actor history — "everything user X has done"
    index("idx_ual_actor_created").on(table.actorId, desc(table.createdAt)),

    // Action lookup — "every 'post.published' event"
    index("idx_ual_action_created").on(table.action, desc(table.createdAt)),

    // Resource lookup — entity detail page audit timeline
    index("idx_ual_resource").on(table.resourceType, table.resourceId, desc(table.createdAt)),

    // Security investigations — "show me critical events for org X"
    index("idx_ual_severity_investigation").on(
      table.organizationId,
      table.severity,
      desc(table.createdAt),
    ),

    // User-targeted investigations — "everything done TO user Y"
    index("idx_ual_target_user_investigation").on(
      table.organizationId,
      table.targetUserId,
      desc(table.createdAt),
    ),

    // Category filter — "all login events this week"
    index("idx_ual_category_created").on(table.category, desc(table.createdAt)),

    // Severity scan — crisis/critical event triage
    index("idx_ual_severity_created").on(table.severity, desc(table.createdAt)),

    // Impersonation audit trail
    index("idx_ual_impersonation").on(table.impersonationSessionId),

    // Compliance dashboard — org + module combination
    index("idx_ual_org_module_created").on(
      table.organizationId,
      table.module,
      desc(table.createdAt),
    ),

    // Request tracing — every log, every audit, every error
    // shares one request id; you'll search it constantly
    index("idx_ual_request_id").on(table.requestId),

    // Session trace — correlate all events for a single user session
    index("idx_ual_session_created").on(table.sessionId, desc(table.createdAt)),

    // Tamper verification — scan chains per module in createdAt order
    index("idx_ual_chain_scan").on(table.module, table.previousChecksum),

    // ── Partial indexes (hot paths) ──────────────────────────────────────────

    // Critical-severity events — instant retrieval
    index("idx_ual_critical")
      .on(table.organizationId, desc(table.createdAt))
      .where(sql`${table.severity} = 'critical'`),

    // Security module events — fast module-specific queries
    index("idx_ual_security")
      .on(table.organizationId, desc(table.createdAt))
      .where(sql`${table.module} = 'security'`),

    // Impersonation events — all impersonation activity
    index("idx_ual_actor_impersonation")
      .on(table.organizationId, desc(table.createdAt))
      .where(sql`${table.actorType} = 'impersonation'`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * No Drizzle relations declared on purpose.
 *
 * Audit log references are intentionally non-FK and resolved at the
 * application layer:
 *   actorId              → users.id        (may be deleted)
 *   targetUserId         → users.id        (may be deleted)
 *   resourceId           → polymorphic     (module determines target)
 *   impersonationSessionId → sessions.id   (may be purged)
 *   organizationId       → organizations.id (system events are org-less)
 *
 * Modeling any of these as Drizzle relations would imply write semantics
 * the application does not use. The audit log is read-mostly and most
 * queries are pure aggregations (count, group by severity, etc.).
 */
