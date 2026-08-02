// db/schema/engagement/index.ts
//
// Engagement module — v4 (consolidated + operations-hardened).
//
// Tables (6):
//   engagement_sla_policies     — SLA definitions with business hours support
//   engagement_messages         — inbound social messages (unified inbox)
//   engagement_responses        — outbound replies (draft → approved → sent)
//   engagement_routing_rules    — auto-assignment rules
//   engagement_sla_breaches     — SLA breach audit trail
//   engagement_ai_suggestions   — AI-generated response suggestions
//
// Tables removed → shared modules:
//   engagementTemplates         → shared/templates.ts
//   engagementAttachments       → shared/media.ts (media_assets)
//   engagementApprovalRequests  → shared/approval.ts (approval_requests)
//   engagementPerformance       → shared/analytics.ts (analytics_aggregates)
//   engagementAuditLog          → shared/audit.ts (audit_log)
//
// Design decisions:
//
//   Unified workflow status:
//     One enum covers both message states (new → assigned → in_progress →
//     resolved → closed) and response states (draft → pending_approval →
//     approved → sent → failed). Application layer enforces valid
//     transitions per entity type. See the in-line comment block on the
//     status field for the per-entity valid transitions.
//
//   No FK to organizations, users, or cross-module tables:
//     organizationId, assigneeId, authorId are plain varchar — engagement
//     data must survive user/org deletion for compliance (NDPR) and
//     analytics continuity.
//
//   SLA policy and breach FKs (intra-module):
//     engagementMessages.slaPolicyId → engagement_sla_policies.id
//       (SET NULL on delete; soft FK in app if needed)
//     engagementSlaBreaches.messageId → engagement_messages.id
//       (RESTRICT on delete; breach records are compliance artifacts)
//     engagementSlaBreaches.slaPolicyId → engagement_sla_policies.id
//       (RESTRICT on delete; breach records reference real policies)
//
//   Approval flow:
//     engagementResponses.approvalRequestId is plain varchar pointing to
//     approval_requests.id (shared/approval.ts). Not a FK — approval
//     records may be purged on a different retention schedule.
//
//   AI suggestions:
//     engagement_ai_suggestions tracks every AI-generated draft. Each
//     row is immutable once created (no updatedAt). promptVersion
//     identifies which prompt template version produced the suggestion,
//     enabling A/B comparison across prompt iterations.
//
//   SLA breaches:
//     Append-only. One row per breach event. No updatedAt — once a
//     breach is recorded, it cannot be modified. alertSent + alertSentAt
//     + alertError track notification delivery state.
//
//   CSAT:
//     Stored on engagement_messages because each message gets at most one
//     CSAT score and it's always scoped to the conversation, not the
//     response. Avoids a join on every message read.
//
//   Message views (read tracking) — DEFERRED:
//     isRead, firstViewedAt, lastViewedAt are NOT on the message. They
//     would be implemented as a separate message_views table for
//     per-agent tracking. Without that table, we have only the global
//     "anyone has viewed" flag, which we expose as a single
//     firstViewedAt column. Per-agent view history requires the
//     message_views table and is out of scope for v1.
//
//   Platform URLs — derived, not stored:
//     platformMessageUrl and platformProfileUrl are NOT columns on
//     engagement_messages. They are derived from platform + IDs in
//     lib/platform-urls.ts. Storing them would create stale data risk
//     when platforms change URL formats. See lib/platform-urls.ts.
//
//   Thread model:
//     parentMessageId — direct parent in a reply chain
//     rootMessageId   — thread root (first message in the conversation).
//                       For the root message itself, rootMessageId = id
//                       (this is by design; do NOT add a no-self check).
//     mergedIntoMessageId — when two conversations are merged, the
//                       subordinate message points to the dominant one.
//     isMerged is a denormalized flag set with mergedIntoMessageId.
//
//   Last activity (denormalized):
//     lastActivityAt is denormalized from the conversation's most
//     recent event (response sent, status change, etc.). Maintained by
//     a background job. Used for inbox sorting ("active conversations"
//     = sorted by lastActivityAt DESC).
//
//   Follow-up tracking:
//     requiresFollowUp is a boolean for support workflows. followUpDueAt
//     sets the deadline. followUpCompletedAt + followUpCompletedBy
//     track resolution.
//
//   Escalation:
//     SLA-driven escalation is tracked via engagement_sla_breaches.
//     Manual escalation is tracked via manualEscalatedTo /
//     manualEscalatedAt / manualEscalationReason on the message. These
//     are distinct paths and use distinct fields.
//
//   Routing decisions — DEFERRED:
//     We do not currently store which routing rule was applied to a
//     message. The appliedRoutingRuleId field is a placeholder; full
//     routing decision history requires a routing_decisions table and
//     is out of scope for v1.
//
//   Attachment counts:
//     attachmentCount is NOT denormalized. Compute it on read from
//     media_assets WHERE attached_to_type = 'engagement_response'. The
//     join is on indexed columns and only happens on response detail
//     view, not inbox list.

import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  jsonb,
  timestamp,
  inet,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  platformEnum,
  authorTierEnum,
  sentimentLabelEnum,
  intentLabelEnum,
  priorityEnum,
  engagementWorkflowStatusEnum,
  engagementBreachTypeEnum,
  aiModelEnum,
} from "../shared/enums";

// =============================================================================
// SLA POLICIES
// =============================================================================

/**
 * SLA definitions for engagement response time targets.
 *
 * Multiple policies per org: each org can have multiple SLA policies.
 * The routing engine selects the most specific matching policy (by
 * priority ascending) for each incoming message. A default catch-all
 * policy (no conditions) should always exist.
 */
export const engagementSlaPolicies = pgTable(
  "engagement_sla_policies",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // ─── Matching Rules ───────────────────────────────────────────────────────
    // JSONB rule object — null = catch-all (default) policy
    conditions: jsonb("conditions"),

    // ─── Selection Priority ───────────────────────────────────────────────────
    // Lower number = selected first when multiple policies match.
    // Default 100 puts custom rules above the catch-all.
    slaPolicyPriority: integer("sla_policy_priority").default(100).notNull(),

    // ─── SLA Targets ──────────────────────────────────────────────────────────
    firstResponseMinutes: integer("first_response_minutes").notNull(),
    resolutionMinutes: integer("resolution_minutes"),

    // Alert when this % of the SLA window is consumed (default: 80%)
    escalationThresholdPercent: integer("escalation_threshold_percent")
      .default(80)
      .notNull(),

    // ─── Business Hours ───────────────────────────────────────────────────────
    businessHoursOnly: boolean("business_hours_only").default(false).notNull(),

    // { start, end, days, timezone } — null if businessHoursOnly = false
    businessHours: jsonb("business_hours"),

    // IANA timezone for SLA calculations
    timezone: varchar("timezone", { length: 100 })
      .default("Africa/Lagos")
      .notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    createdBy: varchar("created_by", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_sla_first_response_positive",
      sql`${table.firstResponseMinutes} > 0`,
    ),
    check(
      "chk_sla_resolution_positive",
      sql`${table.resolutionMinutes} IS NULL
        OR ${table.resolutionMinutes} > 0`,
    ),
    check(
      "chk_sla_resolution_gte_first",
      sql`${table.resolutionMinutes} IS NULL
        OR ${table.resolutionMinutes} >= ${table.firstResponseMinutes}`,
    ),
    check(
      "chk_sla_escalation_threshold_range",
      sql`${table.escalationThresholdPercent} BETWEEN 1 AND 99`,
    ),
    check("chk_sla_priority_positive", sql`${table.slaPolicyPriority} > 0`),
    check(
      "chk_sla_business_hours_consistency",
      sql`${table.businessHoursOnly} = FALSE
        OR ${table.businessHours} IS NOT NULL`,
    ),

    index("idx_sla_org_active").on(table.organizationId, table.isActive),
    index("idx_sla_org_priority").on(
      table.organizationId,
      table.slaPolicyPriority,
    ),
  ],
);

// =============================================================================
// ENGAGEMENT MESSAGES
// =============================================================================

/**
 * Inbound social messages in the unified engagement inbox.
 *
 * Thread model:
 *   parentMessageId — direct parent in a reply chain
 *   rootMessageId   — thread root. For the root message, rootMessageId = id
 *                     (by design; do not add a no-self-root check).
 *   mergedIntoMessageId — set when this conversation was merged into
 *                     another; isMerged = true.
 *
 * Status transitions (enforced in application layer):
 *   new → assigned → in_progress → resolved → closed
 *   any state → snoozed → previous state
 *   any state → cancelled
 *
 * SLA fields:
 *   slaPolicyId — FK to engagement_sla_policies (SET NULL on delete)
 *   slaDueAt — combined deadline
 *   firstResponseDueAt / resolutionDueAt — individual deadlines
 *   slaBreached — denormalized flag; detail in engagement_sla_breaches
 */
export const engagementMessages = pgTable(
  "engagement_messages",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Platform Identifiers ─────────────────────────────────────────────────
    platform: platformEnum("platform").notNull(),
    platformMessageId: varchar("platform_message_id", {
      length: 255,
    }).notNull(),
    platformThreadId: varchar("platform_thread_id", { length: 255 }),
    platformConversationId: varchar("platform_conversation_id", {
      length: 255,
    }),

    // ─── Author ───────────────────────────────────────────────────────────────
    authorPlatformId: varchar("author_platform_id", { length: 255 }).notNull(),
    authorHandle: varchar("author_handle", { length: 100 }),
    authorDisplayName: varchar("author_display_name", { length: 100 }),
    authorAvatarUrl: text("author_avatar_url"),
    authorFollowerCount: integer("author_follower_count").default(0).notNull(),
    authorVerified: boolean("author_verified").default(false).notNull(),
    authorInfluenceScore: integer("author_influence_score")
      .default(0)
      .notNull(),
    authorTier: authorTierEnum("author_tier"),
    authorCountry: varchar("author_country", { length: 2 }),

    // ─── Content ──────────────────────────────────────────────────────────────
    content: text("content").notNull(),
    contentLanguage: varchar("content_language", { length: 5 }),
    isPidgin: boolean("is_pidgin").default(false).notNull(),
    contentTranslated: text("content_translated"),

    // ─── Sentiment ────────────────────────────────────────────────────────────
    sentimentLabel: sentimentLabelEnum("sentiment_label"),
    sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),
    sentimentConfidence: decimal("sentiment_confidence", {
      precision: 3,
      scale: 2,
    }),

    // ─── Intent ───────────────────────────────────────────────────────────────
    intentLabel: intentLabelEnum("intent_label"),
    intentConfidence: decimal("intent_confidence", { precision: 3, scale: 2 }),

    // ─── Priority ─────────────────────────────────────────────────────────────
    priority: priorityEnum("priority").default("medium").notNull(),
    priorityOverride: priorityEnum("priority_override"),
    priorityOverrideReason: text("priority_override_reason"),
    priorityOverriddenBy: varchar("priority_overridden_by", { length: 32 }),
    priorityOverriddenAt: timestamp("priority_overridden_at", {
      withTimezone: true,
    }),

    // ─── Flags ────────────────────────────────────────────────────────────────
    isVip: boolean("is_vip").default(false).notNull(),
    isCrisis: boolean("is_crisis").default(false).notNull(),
    isSpam: boolean("is_spam").default(false).notNull(),
    isBot: boolean("is_bot").default(false).notNull(),

    // ─── Thread Management ────────────────────────────────────────────────────
    parentMessageId: varchar("parent_message_id", { length: 32 }),
    rootMessageId: varchar("root_message_id", { length: 32 }),
    mergedIntoMessageId: varchar("merged_into_message_id", { length: 32 }),

    // ─── Workflow ─────────────────────────────────────────────────────────────
    status: engagementWorkflowStatusEnum("status").default("new").notNull(),
    assigneeId: varchar("assignee_id", { length: 32 }),
    teamId: varchar("team_id", { length: 32 }),

    // ─── Assignment Audit ─────────────────────────────────────────────────────
    // When the message was assigned (latest assignment, no history table).
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    assignedBy: varchar("assigned_by", { length: 32 }),

    // ─── Read Tracking (first-view only; per-agent requires message_views) ────
    // firstViewedAt is set the first time ANY agent views the message.
    // For per-agent view tracking, see the message_views table (deferred).
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),

    // ─── Last Activity (denormalized) ─────────────────────────────────────────
    // Updated by background job to reflect most recent activity:
    // response sent, status change, follow-up completed, etc.
    // Powers the "active conversations" inbox sort.
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
    }).defaultNow(),

    // ─── Denormalized Counts ─────────────────────────────────────────────────
    // Response count per message. Cheap to query, expensive to compute
    // via COUNT(*) on every inbox load. Maintained by trigger or app layer.
    responseCount: integer("response_count").default(0).notNull(),

    // ─── Follow-up ────────────────────────────────────────────────────────────
    requiresFollowUp: boolean("requires_follow_up").default(false).notNull(),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
    followUpCompletedAt: timestamp("follow_up_completed_at", {
      withTimezone: true,
    }),
    followUpCompletedBy: varchar("follow_up_completed_by", { length: 32 }),

    // ─── Manual Escalation (distinct from SLA breach escalation) ─────────────
    manualEscalatedTo: varchar("manual_escalated_to", { length: 32 }),
    manualEscalatedAt: timestamp("manual_escalated_at", {
      withTimezone: true,
    }),
    manualEscalationReason: text("manual_escalation_reason"),

    // ─── Routing Decision (placeholder; full history requires routing_decisions) ─
    appliedRoutingRuleId: varchar("applied_routing_rule_id", { length: 32 }),

    // ─── SLA ──────────────────────────────────────────────────────────────────
    slaPolicyId: varchar("sla_policy_id", { length: 32 }),
    slaBreached: boolean("sla_breached").default(false).notNull(),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    firstResponseDueAt: timestamp("first_response_due_at", {
      withTimezone: true,
    }),
    resolutionDueAt: timestamp("resolution_due_at", { withTimezone: true }),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }),

    // ─── CSAT ─────────────────────────────────────────────────────────────────
    csatSentAt: timestamp("csat_sent_at", { withTimezone: true }),
    csatScore: integer("csat_score"),
    csatFeedback: text("csat_feedback"),

    // ─── Tags & Custom Fields ─────────────────────────────────────────────────
    tags: text("tags").array(),
    customFields: jsonb("custom_fields"),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_em_org_platform_message").on(
      table.organizationId,
      table.platform,
      table.platformMessageId,
    ),

    check(
      "chk_em_influence_score_range",
      sql`${table.authorInfluenceScore} BETWEEN 0 AND 100`,
    ),
    check(
      "chk_em_sentiment_score_range",
      sql`${table.sentimentScore} IS NULL
        OR ${table.sentimentScore} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_em_sentiment_confidence_range",
      sql`${table.sentimentConfidence} IS NULL
        OR ${table.sentimentConfidence} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_em_intent_confidence_range",
      sql`${table.intentConfidence} IS NULL
        OR ${table.intentConfidence} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_em_csat_score_range",
      sql`${table.csatScore} IS NULL
        OR ${table.csatScore} BETWEEN 1 AND 5`,
    ),

    // No self-parent
    check(
      "chk_em_no_self_parent",
      sql`${table.parentMessageId} IS NULL
        OR ${table.parentMessageId} <> ${table.id}`,
    ),

    // No self-merge
    check(
      "chk_em_no_self_merge",
      sql`${table.mergedIntoMessageId} IS NULL
        OR ${table.mergedIntoMessageId} <> ${table.id}`,
    ),

    // NOTE: No chk_em_no_self_root. The root message has
    // rootMessageId = id by design (it's the thread's origin).

    // Merge consistency
    check(
      "chk_em_merge_consistency",
      sql`(${table.isMerged} = FALSE AND ${table.mergedIntoMessageId} IS NULL)
        OR (${table.isMerged} = TRUE AND ${table.mergedIntoMessageId} IS NOT NULL)`,
    ),

    // Lifecycle ordering
    check(
      "chk_em_resolved_after_received",
      sql`${table.resolvedAt} IS NULL
        OR ${table.resolvedAt} >= ${table.receivedAt}`,
    ),
    check(
      "chk_em_closed_after_resolved",
      sql`${table.closedAt} IS NULL
        OR ${table.resolvedAt} IS NULL
        OR ${table.closedAt} >= ${table.resolvedAt}`,
    ),
    check(
      "chk_em_first_response_after_received",
      sql`${table.firstResponseAt} IS NULL
        OR ${table.firstResponseAt} >= ${table.receivedAt}`,
    ),

    // Follow-up consistency
    check(
      "chk_em_follow_up_completed_consistency",
      sql`(${table.followUpCompletedAt} IS NULL)
        = (${table.followUpCompletedBy} IS NULL)`,
    ),
    check(
      "chk_em_follow_up_completed_after_due",
      sql`${table.followUpCompletedAt} IS NULL
        OR ${table.followUpDueAt} IS NULL
        OR ${table.followUpCompletedAt} >= ${table.followUpDueAt}`,
    ),

    // Manual escalation consistency
    check(
      "chk_em_manual_escalation_consistency",
      sql`(${table.manualEscalatedTo} IS NULL)
        = (${table.manualEscalatedAt} IS NULL)`,
    ),

    // Assignment audit consistency
    check(
      "chk_em_assigned_consistency",
      sql`(${table.assigneeId} IS NULL)
        OR (${table.assignedAt} IS NOT NULL)`,
    ),

    // View tracking consistency
    check(
      "chk_em_first_viewed_before_last",
      sql`${table.lastViewedAt} IS NULL
        OR ${table.firstViewedAt} IS NULL
        OR ${table.lastViewedAt} >= ${table.firstViewedAt}`,
    ),

    // Priority override consistency
    check(
      "chk_em_priority_override_consistency",
      sql`(${table.priorityOverride} IS NULL)
        = (${table.priorityOverriddenAt} IS NULL)
        AND (${table.priorityOverride} IS NULL)
            = (${table.priorityOverriddenBy} IS NULL)`,
    ),

    // Response count non-negative
    check(
      "chk_em_response_count_non_negative",
      sql`${table.responseCount} >= 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Main inbox view
    index("idx_em_org_status").on(
      table.organizationId,
      table.status,
      table.receivedAt,
    ),

    // Newest-first inbox (your suggestion)
    index("idx_em_org_received_desc").on(
      table.organizationId,
      table.receivedAt,
    ),

    // Active conversations sorted by recent activity
    index("idx_em_org_last_activity").on(
      table.organizationId,
      table.lastActivityAt,
    ),

    // Agent's inbox
    index("idx_em_assignee")
      .on(table.assigneeId, table.status)
      .where(sql`${table.status} NOT IN ('resolved', 'closed', 'cancelled')`),

    // SLA monitor
    index("idx_em_sla")
      .on(table.slaDueAt)
      .where(
        sql`${table.slaBreached} = FALSE
          AND ${table.status} NOT IN ('resolved', 'closed', 'cancelled')`,
      ),

    // Crisis filter
    index("idx_em_crisis")
      .on(table.organizationId, table.receivedAt)
      .where(sql`${table.isCrisis} = TRUE`),

    // Priority queue
    index("idx_em_priority")
      .on(table.organizationId, table.priority, table.status)
      .where(sql`${table.status} NOT IN ('resolved', 'closed', 'cancelled')`),

    // Thread navigation
    index("idx_em_platform_thread").on(table.platform, table.platformThreadId),

    // Platform filter
    index("idx_em_platform").on(
      table.organizationId,
      table.platform,
      table.receivedAt,
    ),

    // Sentiment filter
    index("idx_em_sentiment").on(
      table.organizationId,
      table.sentimentLabel,
      table.receivedAt,
    ),

    // SLA policy lookup
    index("idx_em_sla_policy").on(table.slaPolicyId),

    // All conversations from a specific customer
    index("idx_em_org_author").on(table.organizationId, table.authorPlatformId),

    // Follow-up queue
    index("idx_em_follow_up_due")
      .on(table.followUpDueAt)
      .where(
        sql`${table.requiresFollowUp} = TRUE
          AND ${table.followUpCompletedAt} IS NULL`,
      ),

    // Full-text search (raw SQL migration):
    // CREATE INDEX idx_em_search ON engagement_messages
    //   USING GIN(to_tsvector('english', content))
    //   WHERE is_spam = FALSE;

    // Tags search (raw SQL migration):
    // CREATE INDEX idx_em_tags ON engagement_messages
    //   USING GIN(tags) WHERE tags IS NOT NULL;
  ],
);

// =============================================================================
// ENGAGEMENT RESPONSES
// =============================================================================

/**
 * Outbound replies.
 *
 * Status transitions (enforced in application layer):
 *   draft → pending_approval → approved → sent
 *                       ↘ rejected → draft
 *   draft → scheduled → sent
 *   draft → sent (if requiresApproval = false on the template)
 *   sent → failed (with retry) → sent
 *   any state → cancelled
 *
 * Approval integration:
 *   approvalRequestId is plain varchar pointing to approval_requests.id
 *   (shared/approval.ts). approvedById / approvedAt are denormalized
 *   for fast read.
 *
 * Delivery tracking:
 *   sentAt — we submitted to the platform API
 *   deliveredAt — platform confirmed receipt by the recipient's server
 *   readAt — platform confirmed the recipient opened/read it
 *   These are critical for support metrics. They may be NULL if the
 *   platform doesn't provide delivery/read receipts.
 *
 * Error handling:
 *   errorCode, errorMessage, retryCount, platformResponse (full JSONB
 *   of the API response) for diagnosing delivery failures.
 */
export const engagementResponses = pgTable(
  "engagement_responses",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    messageId: varchar("message_id", { length: 32 })
      .notNull()
      .references(() => engagementMessages.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),
    authorId: varchar("author_id", { length: 32 }).notNull(),

    content: text("content").notNull(),
    characterCount: integer("character_count"),
    isInternalNote: boolean("is_internal_note").default(false).notNull(),

    // ─── AI Assistance ────────────────────────────────────────────────────────
    aiAssisted: boolean("ai_assisted").default(false).notNull(),
    aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
    aiModel: aiModelEnum("ai_model"),
    aiSuggestionId: varchar("ai_suggestion_id", { length: 32 }),

    // ─── Response Analytics ───────────────────────────────────────────────────
    responseTimeSeconds: integer("response_time_seconds"),
    responseSentiment: sentimentLabelEnum("response_sentiment"),
    resolvedIssue: boolean("resolved_issue"),

    // ─── Workflow ─────────────────────────────────────────────────────────────
    status: engagementWorkflowStatusEnum("status").default("draft").notNull(),

    // ─── Approval ─────────────────────────────────────────────────────────────
    approvalRequestId: varchar("approval_request_id", { length: 32 }),
    approvedById: varchar("approved_by_id", { length: 32 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // ─── Template ─────────────────────────────────────────────────────────────
    templateId: varchar("template_id", { length: 32 }),

    // ─── Scheduling ───────────────────────────────────────────────────────────
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),

    // ─── Platform Delivery ────────────────────────────────────────────────────
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    platformResponseId: varchar("platform_response_id", { length: 255 }),

    // ─── Error Handling ───────────────────────────────────────────────────────
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),

    // Full API response payload for debugging
    platformResponse: jsonb("platform_response"),

    retryCount: integer("retry_count").default(0).notNull(),

    // ─── Versioning ───────────────────────────────────────────────────────────
    version: integer("version").default(1).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_er_char_count_non_negative",
      sql`${table.characterCount} IS NULL
        OR ${table.characterCount} >= 0`,
    ),
    check(
      "chk_er_ai_confidence_range",
      sql`${table.aiConfidence} IS NULL
        OR ${table.aiConfidence} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_er_response_time_non_negative",
      sql`${table.responseTimeSeconds} IS NULL
        OR ${table.responseTimeSeconds} >= 0`,
    ),
    check("chk_er_retry_count_non_negative", sql`${table.retryCount} >= 0`),
    check("chk_er_version_positive", sql`${table.version} >= 1`),

    check(
      "chk_er_approval_consistency",
      sql`(${table.approvedById} IS NULL) = (${table.approvedAt} IS NULL)`,
    ),

    check(
      "chk_er_scheduled_for_status",
      sql`${table.scheduledFor} IS NULL
        OR ${table.status} IN ('draft', 'scheduled', 'pending_approval')`,
    ),

    check(
      "chk_er_sent_at_status",
      sql`${table.sentAt} IS NULL
        OR ${table.status} IN ('sent', 'failed')`,
    ),

    check(
      "chk_er_delivered_after_sent",
      sql`${table.deliveredAt} IS NULL
        OR ${table.sentAt} IS NULL
        OR ${table.deliveredAt} >= ${table.sentAt}`,
    ),

    check(
      "chk_er_read_after_delivered",
      sql`${table.readAt} IS NULL
        OR ${table.deliveredAt} IS NULL
        OR ${table.readAt} >= ${table.deliveredAt}`,
    ),

    check(
      "chk_er_internal_note_not_sent",
      sql`${table.isInternalNote} = FALSE
        OR ${table.sentAt} IS NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_er_message").on(table.messageId, table.createdAt),

    index("idx_er_scheduled")
      .on(table.scheduledFor)
      .where(sql`${table.status} = 'scheduled'`),

    index("idx_er_approval")
      .on(table.approvalRequestId)
      .where(sql`${table.status} = 'pending_approval'`),

    index("idx_er_author").on(table.authorId, table.createdAt),

    index("idx_er_failed")
      .on(table.organizationId, table.retryCount)
      .where(sql`${table.status} = 'failed'`),

    // Delivery tracking queries
    index("idx_er_delivered")
      .on(table.organizationId, table.deliveredAt)
      .where(sql`${table.deliveredAt} IS NOT NULL`),

    // AI-assisted response analytics
    index("idx_er_ai_assisted")
      .on(table.organizationId, table.aiAssisted)
      .where(sql`${table.aiAssisted} = TRUE`),
  ],
);

// =============================================================================
// ENGAGEMENT ROUTING RULES
// =============================================================================

/**
 * Auto-assignment rules.
 *
 * Rules are evaluated in ascending priority order. The first matching
 * rule's actions are applied. A default catch-all rule (conditions
 * always true) should exist at priority 9999.
 */
export const engagementRoutingRules = pgTable(
  "engagement_routing_rules",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Lower number = evaluated first
    routingRulePriority: integer("routing_rule_priority").default(50).notNull(),

    conditions: jsonb("conditions").notNull(),
    actions: jsonb("actions").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdById: varchar("created_by_id", { length: 32 }).notNull(),

    // ─── Performance Metrics ──────────────────────────────────────────────────
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    evaluationCount: integer("evaluation_count").default(0).notNull(),
    matchCount: integer("match_count").default(0).notNull(),

    // Last time this rule actually matched and applied actions
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),

    // Most recent evaluation error (for debugging misconfigured rules)
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("chk_err_priority_positive", sql`${table.routingRulePriority} > 0`),
    check(
      "chk_err_evaluation_count_non_negative",
      sql`${table.evaluationCount} >= 0`,
    ),
    check(
      "chk_err_match_lte_evaluation",
      sql`${table.matchCount} <= ${table.evaluationCount}`,
    ),

    // lastErrorAt only valid when lastErrorMessage is set
    check(
      "chk_err_last_error_consistency",
      sql`(${table.lastErrorAt} IS NULL)
        = (${table.lastErrorMessage} IS NULL)`,
    ),

    index("idx_err_org_priority").on(
      table.organizationId,
      table.isActive,
      table.routingRulePriority,
    ),
  ],
);

// =============================================================================
// ENGAGEMENT SLA BREACHES
// =============================================================================

/**
 * Append-only SLA breach audit trail.
 *
 * One row per breach event. A single message can generate multiple
 * breach rows: first_response breach, resolution breach, etc.
 *
 * Append-only: no updatedAt. Once a breach is recorded, it cannot
 * be modified. alertSent + alertSentAt + alertError are the only
 * mutable fields (alert delivery state can change after record
 * creation).
 *
 * RESTRICT on delete: breach records are compliance artifacts and
 * must not be deleted with the parent message.
 */
export const engagementSlaBreaches = pgTable(
  "engagement_sla_breaches",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Real FK to engagement_messages — RESTRICT on delete
    messageId: varchar("message_id", { length: 32 })
      .notNull()
      .references(() => engagementMessages.id, { onDelete: "restrict" }),

    // Real FK to engagement_sla_policies — RESTRICT on delete
    slaPolicyId: varchar("sla_policy_id", { length: 32 })
      .notNull()
      .references(() => engagementSlaPolicies.id, { onDelete: "restrict" }),

    breachType: engagementBreachTypeEnum("breach_type").notNull(),
    slaStartedAt: timestamp("sla_started_at", { withTimezone: true }).notNull(),
    breachedAt: timestamp("breached_at", { withTimezone: true }).notNull(),
    minutesOverdue: integer("minutes_overdue").notNull(),

    // ─── Escalation ───────────────────────────────────────────────────────────
    alertSent: boolean("alert_sent").default(false).notNull(),
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
    alertError: text("alert_error"),

    escalatedTo: varchar("escalated_to", { length: 32 }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),

    // No updatedAt — append-only
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("chk_slb_minutes_overdue_positive", sql`${table.minutesOverdue} > 0`),
    check(
      "chk_slb_breached_after_started",
      sql`${table.breachedAt} > ${table.slaStartedAt}`,
    ),
    check(
      "chk_slb_escalation_consistency",
      sql`(${table.escalatedTo} IS NULL) = (${table.escalatedAt} IS NULL)`,
    ),

    // alertSentAt only valid when alertSent = true
    check(
      "chk_slb_alert_sent_consistency",
      sql`(${table.alertSent} = FALSE AND ${table.alertSentAt} IS NULL)
        OR (${table.alertSent} = TRUE AND ${table.alertSentAt} IS NOT NULL)`,
    ),

    // alertError only valid when alert was attempted
    check(
      "chk_slb_alert_error_attempted",
      sql`${table.alertError} IS NULL
        OR ${table.alertSentAt} IS NOT NULL
        OR ${table.alertSent} = FALSE`,
    ),

    index("idx_slb_message").on(table.messageId),
    index("idx_slb_org").on(table.organizationId, table.breachedAt),
    index("idx_slb_policy").on(table.slaPolicyId),
    index("idx_slb_breach_type").on(table.breachType, table.breachedAt),

    // Unalerted breaches — escalation worker polls this
    index("idx_slb_unescalated")
      .on(table.organizationId, table.breachedAt)
      .where(sql`${table.alertSent} = FALSE`),
  ],
);

// =============================================================================
// ENGAGEMENT AI SUGGESTIONS
// =============================================================================

/**
 * AI-generated response suggestions.
 *
 * One suggestion request can produce multiple alternatives (stored in
 * the alternatives JSONB array). The primary suggestion is in
 * suggestedContent.
 *
 * Immutable: no updatedAt. Once created, suggestions cannot be modified.
 * The only mutable state is wasUsed + usedInResponseId + userFeedback,
 * set when the agent acts on the suggestion.
 *
 * promptVersion identifies which prompt template version produced the
 * suggestion. Critical for A/B comparison across prompt iterations.
 *
 * generationDurationMs tracks inference latency for cost/performance
 * analysis.
 */
export const engagementAiSuggestions = pgTable(
  "engagement_ai_suggestions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Real FK to engagement_messages — CASCADE on delete
    messageId: varchar("message_id", { length: 32 })
      .notNull()
      .references(() => engagementMessages.id, { onDelete: "cascade" }),

    suggestedContent: text("suggested_content").notNull(),
    alternatives: jsonb("alternatives").default([]).notNull(),

    // ─── Model Metadata ───────────────────────────────────────────────────────
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    model: engagementAiModelEnum("model"),

    // Prompt template version (e.g. "v1.2.0", "2026-01-15-experiment-A")
    promptVersion: varchar("prompt_version", { length: 50 }),

    // Inference latency in milliseconds
    generationDurationMs: integer("generation_duration_ms"),

    // ─── Usage Tracking ───────────────────────────────────────────────────────
    wasUsed: boolean("was_used").default(false).notNull(),
    usedInResponseId: varchar("used_in_response_id", { length: 32 }),
    userFeedback: integer("user_feedback"),
    feedbackComment: text("feedback_comment"),
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),

    // No updatedAt — suggestions are immutable once created
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_ais_confidence_range",
      sql`${table.confidence} IS NULL
        OR ${table.confidence} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_ais_feedback_range",
      sql`${table.userFeedback} IS NULL
        OR ${table.userFeedback} BETWEEN 1 AND 5`,
    ),
    check(
      "chk_ais_used_consistency",
      sql`${table.wasUsed} = FALSE
        OR ${table.usedInResponseId} IS NOT NULL`,
    ),
    check(
      "chk_ais_feedback_at_consistency",
      sql`(${table.userFeedback} IS NULL) = (${table.feedbackAt} IS NULL)`,
    ),

    check(
      "chk_ais_generation_duration_non_negative",
      sql`${table.generationDurationMs} IS NULL
        OR ${table.generationDurationMs} >= 0`,
    ),

    index("idx_ais_message").on(table.messageId),
    index("idx_ais_org").on(table.organizationId),
    index("idx_ais_used").on(table.wasUsed),
    index("idx_ais_model").on(table.model),
    index("idx_ais_prompt_version").on(table.promptVersion),
    index("idx_ais_feedback")
      .on(table.organizationId, table.userFeedback)
      .where(sql`${table.userFeedback} IS NOT NULL`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const engagementSlaPoliciesRelations = relations(
  engagementSlaPolicies,
  ({ many }) => ({
    messages: many(engagementMessages, {
      relationName: "slaPolicy_messages",
    }),
    slaBreaches: many(engagementSlaBreaches, {
      relationName: "slaPolicy_breaches",
    }),
  }),
);

export const engagementMessagesRelations = relations(
  engagementMessages,
  ({ one, many }) => ({
    slaPolicy: one(engagementSlaPolicies, {
      fields: [engagementMessages.slaPolicyId],
      references: [engagementSlaPolicies.id],
      relationName: "slaPolicy_messages",
    }),

    parentMessage: one(engagementMessages, {
      fields: [engagementMessages.parentMessageId],
      references: [engagementMessages.id],
      relationName: "engagementMessage_replies",
    }),
    childMessages: many(engagementMessages, {
      relationName: "engagementMessage_replies",
    }),

    rootMessage: one(engagementMessages, {
      fields: [engagementMessages.rootMessageId],
      references: [engagementMessages.id],
      relationName: "engagementMessage_thread",
    }),
    threadMessages: many(engagementMessages, {
      relationName: "engagementMessage_thread",
    }),

    mergedInto: one(engagementMessages, {
      fields: [engagementMessages.mergedIntoMessageId],
      references: [engagementMessages.id],
      relationName: "engagementMessage_mergedMessages",
    }),
    mergedMessages: many(engagementMessages, {
      relationName: "engagementMessage_mergedMessages",
    }),

    responses: many(engagementResponses, {
      relationName: "message_responses",
    }),

    slaBreaches: many(engagementSlaBreaches, {
      relationName: "message_slaBreaches",
    }),

    aiSuggestions: many(engagementAiSuggestions, {
      relationName: "message_aiSuggestions",
    }),

    // Cross-module references (resolved at application layer):
    //   Attachments → media_assets WHERE attached_to_type = 'engagement_response'
    //     AND attached_to_id IN (responses for this message)
    //   Approval → approval_requests WHERE entity_type = 'engagement_response'
    //   Audit → audit_log WHERE source_module = 'engagement'
    //   Performance → analytics_aggregates WHERE dimension_2 = 'engagement_summary'
  }),
);

export const engagementResponsesRelations = relations(
  engagementResponses,
  ({ one }) => ({
    message: one(engagementMessages, {
      fields: [engagementResponses.messageId],
      references: [engagementMessages.id],
      relationName: "message_responses",
    }),

    aiSuggestion: one(engagementAiSuggestions, {
      fields: [engagementResponses.aiSuggestionId],
      references: [engagementAiSuggestions.id],
      relationName: "aiSuggestion_response",
    }),

    // Cross-module references (resolved at application layer):
    //   templateId → templates.id
    //   approvalRequestId → approval_requests.id
    //   Attachments → media_assets WHERE attached_to_id = this.id
  }),
);

export const engagementRoutingRulesRelations = relations(
  engagementRoutingRules,
  () => ({
    // No Drizzle relations — rule conditions/actions reference IDs
    // stored as JSONB, resolved at the application layer.
  }),
);

export const engagementSlaBreachesRelations = relations(
  engagementSlaBreaches,
  ({ one }) => ({
    message: one(engagementMessages, {
      fields: [engagementSlaBreaches.messageId],
      references: [engagementMessages.id],
      relationName: "message_slaBreaches",
    }),

    slaPolicy: one(engagementSlaPolicies, {
      fields: [engagementSlaBreaches.slaPolicyId],
      references: [engagementSlaPolicies.id],
      relationName: "slaPolicy_breaches",
    }),
  }),
);

export const engagementAiSuggestionsRelations = relations(
  engagementAiSuggestions,
  ({ one }) => ({
    message: one(engagementMessages, {
      fields: [engagementAiSuggestions.messageId],
      references: [engagementMessages.id],
      relationName: "message_aiSuggestions",
    }),

    usedInResponse: one(engagementResponses, {
      fields: [engagementAiSuggestions.usedInResponseId],
      references: [engagementResponses.id],
      relationName: "aiSuggestion_response",
    }),
  }),
);
