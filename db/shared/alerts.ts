import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import {
  alertAudienceEnum,
  alertConditionTypeEnum,
  alertEventSeverityEnum,
  alertFrequencyEnum,
  alertRecipientModeEnum,
  alertRuleSourceEnum,
} from "../shared/enums";

// =============================================================================
// ALERT RULES
// =============================================================================

/**
 * Unified alert rule configuration for the entire platform.
 *
 * Replaces (never create these):
 *   engagementSlaPolicies   (engagement module)
 *   listeningAlerts         (listening v1 module — config rows)
 *   monitoringAlerts        (monitoring v2 — was conflating config + events)
 *   analyticsAlerts         (analytics module — config + inline JSONB history)
 *
 * The original implementations had three inconsistent patterns:
 *   listeningAlerts   → config only, no event log anywhere
 *   analyticsAlerts   → config + JSONB history array on the same row
 *   monitoringAlerts  → event instances only, no backing rule table
 *   engagementSla     → config only, breaches in a separate table
 *
 * This table is config only.
 * Every firing produces exactly one row in alert_events.
 *
 * ── condition JSONB shapes by sourceModule + conditionType ──────────────────
 *
 * sourceModule='engagement', conditionType='threshold' (SLA rules):
 * {
 *   slaType: 'first_response' | 'resolution',
 *   firstResponseMinutes: number,       // minutes until first response SLA
 *   resolutionMinutes: number | null,   // null = no resolution SLA
 *   escalationThresholdPercent: number, // alert at X% of SLA window consumed
 *   platforms: string[],               // which platforms this SLA covers
 *   priorities: string[],              // 'critical'|'high'|'medium'|'low'
 *   businessHoursOnly: boolean,        // pause SLA clock outside hours
 *   businessHours: {                   // null if businessHoursOnly=false
 *     start: string,                   // 'HH:MM' WAT
 *     end: string,                     // 'HH:MM' WAT
 *     days: number[],                  // 0=Sun, 1=Mon ... 6=Sat
 *     timezone: string                 // IANA timezone
 *   } | null
 * }
 *
 * sourceModule='listening', conditionType='volume_spike':
 * {
 *   campaignIds: string[],
 *   baselineMultiplier: number,
 *   windowMinutes: number,
 *   minBaselineVolume: number
 * }
 *
 * sourceModule='listening', conditionType='sentiment_crash':
 * {
 *   campaignIds: string[],
 *   negativeThresholdPercent: number,
 *   windowMinutes: number,
 *   minSampleSize: number
 * }
 *
 * sourceModule='listening', conditionType='keyword_match':
 * {
 *   campaignIds: string[],
 *   keywords: string[],
 *   platforms: string[],               // null = all platforms
 *   minInfluenceScore: number          // 0-100
 * }
 *
 * sourceModule='monitoring', conditionType='volume_spike':
 * {
 *   campaignIds: string[],
 *   baselineMultiplier: number,
 *   windowHours: number,
 *   sourceTypes: string[]
 * }
 *
 * sourceModule='monitoring', conditionType='sentiment_crash':
 * {
 *   campaignIds: string[],
 *   negativeThresholdPercent: number,
 *   windowHours: number,
 *   minAuthorityScore: number
 * }
 *
 * sourceModule='monitoring', conditionType='keyword_match':
 * {
 *   campaignIds: string[],
 *   keywords: string[],
 *   sourceTiers: number[],
 *   minImpactScore: number
 * }
 *
 * sourceModule='analytics', conditionType='threshold':
 * {
 *   metricName: string,
 *   dimension2: string,
 *   platform: string | null,
 *   granularity: 'hour'|'day'|'week',
 *   operator: 'gt'|'lt'|'gte'|'lte',
 *   warningValue: number,
 *   criticalValue: number
 * }
 *
 * sourceModule='analytics', conditionType='anomaly':
 * {
 *   metricName: string,
 *   dimension2: string,
 *   sensitivityStdDev: number,
 *   lookbackDays: number,
 *   minSampleSize: number
 * }
 *
 * sourceModule='analytics', conditionType='trend':
 * {
 *   metricName: string,
 *   dimension2: string,
 *   direction: 'increasing' | 'decreasing',
 *   thresholdPercent: number,
 *   comparisonPeriod: 'previous_day'|'previous_week'|'previous_month'
 * }
 *
 * sourceModule='system', conditionType='threshold':
 * {
 *   systemMetric: 'backup_failure' | 'quota_exhausted' | 'error_rate',
 *   threshold: number | null
 * }
 *
 * ── scopeIds ─────────────────────────────────────────────────────────────────
 * Entity IDs the rule applies to — interpretation depends on sourceModule:
 *   listening  → monitoring_campaigns.id values
 *   monitoring → monitoring_campaigns.id values
 *   analytics  → analytics_metrics.id values
 *   engagement → null (applies to all messages matching priority/platform)
 *   system     → null (applies platform-wide)
 *
 * ── notificationChannels JSONB ────────────────────────────────────────────────
 * [
 *   { channel: 'email',   config: {} },
 *   { channel: 'slack',   config: { webhookUrl: '...' } },
 *   { channel: 'in_app',  config: {} },
 *   { channel: 'sms',     config: {} },
 *   { channel: 'webhook', config: { url: '...', secret: '...' } }
 * ]
 *
 * ── recipients JSONB ──────────────────────────────────────────────────────────
 * [
 *   { type: 'user',  id: string },
 *   { type: 'team',  id: string },
 *   { type: 'email', address: string },
 *   { type: 'role',  role: 'admin'|'manager'|... }
 * ]
 *
 * ── Rate limiting ─────────────────────────────────────────────────────────────
 * cooldownMinutes  → minimum gap between consecutive firings of this rule.
 *                    During cooldown, the trigger condition is still evaluated
 *                    but no alert_event is written and no notification is sent.
 * maxAlertsPerDay  → maximum alert_events written per 24-hour window.
 *                    NULL = unlimited. Prevents alert storms.
 *
 * ── Escalation ────────────────────────────────────────────────────────────────
 * escalateAfterMinutes → if alert_event remains unacknowledged after this
 *                         many minutes, send escalation notification.
 * escalationRecipients → same format as recipients JSONB.
 *                         NULL = use same recipients as the rule.
 *
 * ── Concurrency ───────────────────────────────────────────────────────────────
 * version:
 *   Optimistic locking counter. Application code MUST issue:
 *     UPDATE alert_rules
 *     SET ..., version = version + 1
 *     WHERE id = $id AND version = $currentVersion
 *   If 0 rows affected, the update is rejected and the caller must
 *   re-fetch and retry. Prevents two admins editing the same rule
 *   simultaneously from overwriting each other's changes.
 *
 * ── Denormalized counters ─────────────────────────────────────────────────────
 * lastTriggeredAt, triggerCount, lastSeverity:
 *   Copied from the most recent alert_event for quick dashboard display.
 *   Source of truth is alert_events — these are read-optimized denorms.
 *   Updated ONLY by the alert engine, never by application code.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Classification ──────────────────────────────────────────────────────
    sourceModule: alertRuleSourceEnum("source_module").notNull(),
    conditionType: alertConditionTypeEnum("condition_type").notNull(),

    // ─── Identity ────────────────────────────────────────────────────────────
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // ─── Trigger Condition ───────────────────────────────────────────────────
    // Full condition config — shape varies by sourceModule + conditionType
    // See JSDoc above for per-combination shape documentation
    condition: jsonb("condition").notNull(),

    // Which entities this rule watches — a listening query id, a monitoring
    // campaign id, an SLA policy id, etc. Polymorphic by source, resolved at
    // the application layer (no FK, same reasoning as audit_log).
    watchedEntityIds: text("watched_entity_ids").array(),

    // FIX (campaigns module): distinguishes staff-facing alerts (the
    // original design) from participant-facing transactional notifications
    // (e.g. "notify the entrant their entry was approved"). See enum
    // comments above for the full explanation.
    audience: alertAudienceEnum("audience").default("internal").notNull(),
    recipientMode: alertRecipientModeEnum("recipient_mode").default("fixed").notNull(),

    // Scalar threshold shortcut for simple rules — avoids JSONB extraction
    // in the trigger evaluator for the common case of a single numeric threshold.
    // NULL for complex rules (anomaly, trend, keyword_match).
    // When populated, conditionType must be 'threshold' (enforced by CHECK).
    threshold: decimal("threshold", { precision: 10, scale: 4 }),

    // ─── Scope ───────────────────────────────────────────────────────────────
    // Entity IDs this rule applies to — see JSDoc for per-module interpretation
    // NULL = rule applies to all entities of the relevant type for this org
    scopeIds: text("scope_ids").array(),

    // ─── Severity ────────────────────────────────────────────────────────────
    // Minimum severity level at which this rule fires
    // 'info' = fires on all triggers, 'crisis' = only on most severe
    // Also controls the severity written to alert_events when this rule fires
    defaultSeverity: alertEventSeverityEnum("default_severity").default("warning").notNull(),

    // ─── Delivery ────────────────────────────────────────────────────────────
    frequency: alertFrequencyEnum("frequency").default("realtime").notNull(),

    // Delivery channel configs — see JSDoc above for shape
    notificationChannels: jsonb("notification_channels").notNull(),

    // Recipient list — see JSDoc above for shape
    recipients: jsonb("recipients").notNull(),

    // ─── Quiet Hours ─────────────────────────────────────────────────────────
    // Notifications suppressed during quiet hours.
    // NOTE: SLA breach alerts (sourceModule='engagement') always fire
    // immediately regardless of quiet hours — SLA deadlines don't pause.
    quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),
    // IANA timezone — defaults to WAT (Africa/Lagos)
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    // ─── Rate Limiting ───────────────────────────────────────────────────────
    // Minimum minutes between consecutive firings of this rule
    cooldownMinutes: integer("cooldown_minutes").default(60).notNull(),

    // Maximum alert_events per 24-hour window — NULL = unlimited
    maxAlertsPerDay: integer("max_alerts_per_day"),

    // ─── Escalation ──────────────────────────────────────────────────────────
    // Minutes after alert_event creation before escalation fires
    // NULL = no escalation configured
    escalateAfterMinutes: integer("escalate_after_minutes"),

    // Who receives the escalation — NULL = use same recipients as the rule
    escalationRecipients: jsonb("escalation_recipients"),

    // ─── State ───────────────────────────────────────────────────────────────
    isActive: boolean("is_active").default(true).notNull(),

    // ─── Denormalized Counters ───────────────────────────────────────────────
    // Copied from the most recent alert_event for quick dashboard display.
    // Source of truth is alert_events — these are read-optimized denorms.
    // Updated ONLY by the alert engine, never by application code.
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    triggerCount: integer("trigger_count").default(0).notNull(),
    lastSeverity: alertEventSeverityEnum("last_severity"),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter — see JSDoc above.
    version: integer("version").default(1).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — rule must outlive creator if they leave the org
    createdById: varchar("created_by_id", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // cooldownMinutes must be positive
    check("chk_ar_cooldown_positive", sql`${table.cooldownMinutes} > 0`),

    // maxAlertsPerDay must be positive when set
    check(
      "chk_ar_max_alerts_positive",
      sql`${table.maxAlertsPerDay} IS NULL
        OR ${table.maxAlertsPerDay} > 0`,
    ),

    // escalateAfterMinutes must be positive when set
    check(
      "chk_ar_escalate_positive",
      sql`${table.escalateAfterMinutes} IS NULL
        OR ${table.escalateAfterMinutes} > 0`,
    ),

    // triggerCount must be non-negative
    check("chk_ar_trigger_count", sql`${table.triggerCount} >= 0`),

    // version must be positive
    check("chk_ar_version", sql`${table.version} >= 1`),

    // Quiet hours consistency: enabled ↔ both start AND end set
    check(
      "chk_ar_quiet_hours_consistency",
      sql`(${table.quietHoursEnabled} = FALSE
        AND ${table.quietHoursStart} IS NULL
        AND ${table.quietHoursEnd} IS NULL)
      OR
      (${table.quietHoursEnabled} = TRUE
        AND ${table.quietHoursStart} IS NOT NULL
        AND ${table.quietHoursEnd} IS NOT NULL)`,
    ),

    // triggerCount / lastTriggeredAt consistency
    // triggerCount > 0 ↔ lastTriggeredAt is set
    check(
      "chk_ar_trigger_consistency",
      sql`(${table.triggerCount} = 0
        AND ${table.lastTriggeredAt} IS NULL)
      OR
      (${table.triggerCount} > 0
        AND ${table.lastTriggeredAt} IS NOT NULL)`,
    ),

    // threshold should only be set when conditionType='threshold'.
    // For other conditionTypes, the threshold semantics live inside the
    // condition JSONB. Enforced in SQL so application bugs cannot violate it.
    check(
      "chk_ar_threshold_only_for_threshold",
      sql`${table.threshold} IS NULL
        OR ${table.conditionType} = 'threshold'`,
    ),

    // Engagement SLA rules ignore quiet hours (SLA deadlines don't pause).
    // We enforce this at the DB layer so a misconfiguration can't silently
    // suppress a breach notification.
    check(
      "chk_ar_engagement_no_quiet_hours",
      sql`${table.sourceModule} <> 'engagement'
        OR ${table.quietHoursEnabled} = FALSE`,
    ),

    // System rules are platform-wide — scopeIds must be NULL
    check(
      "chk_ar_system_no_scope",
      sql`${table.sourceModule} <> 'system'
        OR ${table.scopeIds} IS NULL`,
    ),

    // ── Uniqueness ───────────────────────────────────────────────────────────

    // Rule name is unique per org (prevents accidental duplicate rules)
    unique("uq_ar_org_name").on(table.organizationId, table.name),

    // ── Primary rule lookups ─────────────────────────────────────────────────

    // Primary rule lookup — all enabled rules for a module
    index("idx_ar_org_module_active").on(table.organizationId, table.sourceModule, table.isActive),

    // Evaluator hot path — active rules for a source + condition type
    index("idx_ar_active_condition").on(
      table.organizationId,
      table.sourceModule,
      table.conditionType,
      table.isActive,
    ),

    // Trigger evaluator — rules by condition type
    index("idx_ar_condition_type").on(table.conditionType, table.isActive),

    // Escalation worker — rules with escalation configured
    index("idx_ar_escalation")
      .on(table.organizationId, table.escalateAfterMinutes)
      .where(
        sql`${table.escalateAfterMinutes} IS NOT NULL
          AND ${table.isActive} = TRUE`,
      ),

    // Cooldown check — most recently triggered rules
    index("idx_ar_last_triggered").on(table.organizationId, table.lastTriggeredAt),

    // Daily alert cap enforcement — rules with maxAlertsPerDay set
    index("idx_ar_capped")
      .on(table.organizationId)
      .where(sql`${table.maxAlertsPerDay} IS NOT NULL`),
  ],
);

// =============================================================================
// ALERT EVENTS
// =============================================================================

/**
 * One row per alert firing — the event log for alert_rules.
 *
 * Replaces (never create these):
 *   engagementSlaBreaches  (engagement module — SLA breach event rows)
 *   monitoringAlerts       (monitoring v2 — was being used as event log)
 *   analyticsAlerts.history (inline JSONB array on the config row)
 *
 * Why all three are wrong:
 *   engagementSlaBreaches  → separate table per type = duplicated pattern
 *   monitoringAlerts       → no backing rule table = can't query "how many
 *                            times did rule X fire this week?"
 *   analyticsAlerts.history → JSONB array = can't index, can't count,
 *                             can't GROUP BY severity
 *
 * This table + alert_rules gives:
 *   SELECT COUNT(*) FROM alert_events WHERE rule_id = $1 AND created_at > $2
 *   SELECT * FROM alert_events WHERE rule_id = $1 ORDER BY created_at DESC
 *   SELECT severity, COUNT(*) FROM alert_events GROUP BY severity
 *   All impossible with the original designs.
 *
 * ruleId is nullable:
 *   System-generated events (e.g. backup failure detected by cron job)
 *   may not have a backing rule row if no rule was configured for that
 *   condition. The event is still written so it appears in the alert feed.
 *
 * sourceType + sourceId:
 *   Polymorphic reference to the entity that triggered the alert.
 *   sourceType='engagement_message' → engagement_messages.id
 *   sourceType='media_article'      → media_articles.id
 *   sourceType='social_mention'     → social_mentions.id
 *   sourceType='analytics_metric'   → analytics_metrics.id
 *   sourceType='sla_timer'          → engagement_messages.id
 *                                     (message that breached SLA)
 *   sourceType='system'             → backup_records.id or similar
 *   sourceType='monitoring_campaign'→ monitoring_campaigns.id
 *
 * SLA breach fields:
 *   breachType, slaStartedAt, breachedAt, minutesOverdue
 *   Populated only when alertType starts with 'sla_'.
 *   These columns replace the entire engagementSlaBreaches table.
 *
 * Mutability:
 *   isRead and isAcknowledged are the only mutable fields after insert.
 *   All other fields are set at insert time and never updated.
 *   This is intentional — the event record is the immutable fact;
 *   isRead/isAcknowledged are operational state, not historical record.
 *
 * context JSONB shape by alertType:
 *
 *   sla_first_response / sla_resolution:
 *   {
 *     messageId: string,
 *     platform: string,
 *     priority: string,
 *     assigneeId: string | null,
 *     teamId: string | null,
 *     authorHandle: string
 *   }
 *
 *   volume_spike:
 *   {
 *     campaignId: string,
 *     currentVolume: number,
 *     baselineVolume: number,
 *     multiplier: number,
 *     platform: string | null,
 *     windowMinutes: number
 *   }
 *
 *   sentiment_crash:
 *   {
 *     campaignId: string,
 *     negativePercent: number,
 *     previousNegativePercent: number,
 *     sampleSize: number,
 *     topNegativeMentions: string[]
 *   }
 *
 *   analytics_threshold / analytics_anomaly:
 *   {
 *     metricName: string,
 *     metricDisplayName: string,
 *     currentValue: number,
 *     thresholdValue: number,
 *     percentageDeviation: number,
 *     granularity: string,
 *     dimension2: string
 *   }
 *
 *   monitoring_coverage:
 *   {
 *     campaignId: string,
 *     articleId: string,
 *     sourceName: string,
 *     sourceTier: number,
 *     impactScore: number,
 *     aveNaira: number,
 *     sentimentLabel: string
 *   }
 */
export const alertEvents = pgTable(
  "alert_events",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Rule Reference ──────────────────────────────────────────────────────
    // Nullable — system events may not have a backing rule
    // Not FK — alert_events must outlive alert_rules (rule may be deleted
    // after firing; historical events must remain readable)
    ruleId: varchar("rule_id", { length: 32 }),

    // ─── Alert Classification ────────────────────────────────────────────────
    // Copied from alert_rules at fire time — preserved even if rule changes
    // Free-form slug e.g. 'sla_first_response', 'volume_spike', 'backup_failed'
    alertType: varchar("alert_type", { length: 50 }).notNull(),
    severity: alertEventSeverityEnum("severity").notNull(),
    sourceModule: alertRuleSourceEnum("source_module").notNull(),

    // ─── Trigger Source ──────────────────────────────────────────────────────
    // Polymorphic reference — see JSDoc for sourceType value mapping
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    // NULL for system-level events that aren't tied to a specific entity
    sourceId: varchar("source_id", { length: 32 }),

    // ─── Content ─────────────────────────────────────────────────────────────
    title: text("title").notNull(),
    description: text("description"),

    // Structured trigger context — shape varies by alertType, see JSDoc above
    context: jsonb("context"),

    // ─── SLA Breach Fields ───────────────────────────────────────────────────
    // Populated only when alertType IN ('sla_first_response', 'sla_resolution')
    // These replace the entire engagementSlaBreaches table
    breachType: varchar("breach_type", { length: 30 }),
    // When the SLA clock started (message receivedAt for first_response,
    // or first_response_at for resolution SLA)
    slaStartedAt: timestamp("sla_started_at", { withTimezone: true }),
    // When the SLA threshold was actually crossed
    breachedAt: timestamp("breached_at", { withTimezone: true }),
    // How many minutes past the SLA deadline at time of detection
    minutesOverdue: integer("minutes_overdue"),

    // ─── Financial Impact ────────────────────────────────────────────────────
    // Estimated Naira impact — monitoring and PR alerts only
    // NULL for non-financial alerts
    estimatedNairaImpact: numeric("estimated_naira_impact", {
      precision: 15,
      scale: 2,
    }),
    // Always set — defaults to NGN. Made notNull since the default covers
    // every realistic case and a NULL currency is never meaningful.
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Delivery State ──────────────────────────────────────────────────────
    // true once the notification has been dispatched to all channels
    alertSent: boolean("alert_sent").default(false).notNull(),
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),

    // Per-channel delivery tracking (email/slack/webhook)
    notificationStatus: jsonb("notification_status")
      .$type<{
        email?: { sent: boolean; error?: string; sentAt?: string };
        slack?: { sent: boolean; error?: string; sentAt?: string };
        webhook?: { sent: boolean; error?: string; sentAt?: string };
        inApp?: { sent: boolean; error?: string; sentAt?: string };
      }>()
      .default({}),

    // ─── Acknowledgement (mutable) ───────────────────────────────────────────
    isRead: boolean("is_read").default(false).notNull(),
    isAcknowledged: boolean("is_acknowledged").default(false).notNull(),
    // Not FK — acknowledgement record outlives the acknowledging user
    acknowledgedById: varchar("acknowledged_by_id", { length: 32 }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgmentNotes: text("acknowledgment_notes"),

    // ─── Escalation ──────────────────────────────────────────────────────────
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    // Not FK — escalation record outlives the escalated-to user
    escalatedToId: varchar("escalated_to_id", { length: 32 }),
    escalationNotes: text("escalation_notes"),

    // Append-only after insert — only isRead + isAcknowledged are mutable
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // minutesOverdue must be non-negative
    check("chk_ae_minutes_overdue", sql`${table.minutesOverdue} >= 0`),

    // estimatedNairaImpact must be non-negative when set
    check(
      "chk_ae_naira_impact",
      sql`${table.estimatedNairaImpact} IS NULL
        OR ${table.estimatedNairaImpact} >= 0`,
    ),

    // alertSent=true ↔ alertSentAt is set
    check(
      "chk_ae_alert_sent_consistency",
      sql`NOT (
        ${table.alertSent} = TRUE
        AND ${table.alertSentAt} IS NULL
      )`,
    ),

    // alertSentAt must be >= createdAt
    check(
      "chk_ae_alert_sent_after_created",
      sql`${table.alertSentAt} IS NULL
        OR ${table.alertSentAt} >= ${table.createdAt}`,
    ),

    // isAcknowledged=true ↔ acknowledgedById AND acknowledgedAt are set
    check(
      "chk_ae_ack_consistency",
      sql`NOT (
        ${table.isAcknowledged} = TRUE
        AND (${table.acknowledgedById} IS NULL
          OR ${table.acknowledgedAt} IS NULL)
      )`,
    ),

    // acknowledgedAt must be >= createdAt
    check(
      "chk_ae_ack_after_created",
      sql`${table.acknowledgedAt} IS NULL
        OR ${table.acknowledgedAt} >= ${table.createdAt}`,
    ),

    // escalatedAt ↔ escalatedToId both set
    check(
      "chk_ae_escalation_consistency",
      sql`NOT (
        ${table.escalatedAt} IS NOT NULL
        AND ${table.escalatedToId} IS NULL
      )`,
    ),

    // escalatedAt must be >= createdAt
    check(
      "chk_ae_escalated_after_created",
      sql`${table.escalatedAt} IS NULL
        OR ${table.escalatedAt} >= ${table.createdAt}`,
    ),

    // SLA breach field consistency: when breachType is set, the related
    // timestamps must be present and breachedAt must be >= slaStartedAt.
    check(
      "chk_ae_sla_breach_fields",
      sql`${table.breachType} IS NULL
        OR (
          ${table.slaStartedAt} IS NOT NULL
          AND ${table.breachedAt} IS NOT NULL
          AND ${table.breachedAt} >= ${table.slaStartedAt}
          AND ${table.minutesOverdue} IS NOT NULL
        )`,
    ),

    // ── Primary lookups ───────────────────────────────────────────────────────

    // Rule → events join (rule detail page: "show me all firings of this rule")
    index("idx_ae_rule_created").on(table.ruleId, table.createdAt),

    // Org-level alert feed — newest first
    index("idx_ae_org_created").on(table.organizationId, table.createdAt),

    // Module-scoped feed — each module's own alert history
    index("idx_ae_org_module_created").on(
      table.organizationId,
      table.sourceModule,
      table.createdAt,
    ),

    // Dashboard feed: org + unread + severity + createdAt DESC
    // This is the most-frequently-hit query for the alerts dashboard.
    index("idx_ae_dashboard_feed").on(
      table.organizationId,
      table.isRead,
      table.severity,
      table.createdAt,
    ),

    // Acknowledgement queue: org + unack + severity + createdAt DESC
    // Used by operations teams to triage pending work.
    index("idx_ae_ack_queue").on(
      table.organizationId,
      table.isAcknowledged,
      table.severity,
      table.createdAt,
    ),

    // Unread badge count — fast COUNT for notification bell
    index("idx_ae_unread")
      .on(table.organizationId, table.isRead, table.createdAt)
      .where(sql`${table.isRead} = FALSE`),

    // Unacknowledged — escalation worker query
    index("idx_ae_unacknowledged")
      .on(table.organizationId, table.createdAt)
      .where(
        sql`${table.isAcknowledged} = FALSE
          AND ${table.alertSent} = TRUE`,
      ),

    // Source entity lookup — show alerts on entity detail pages
    // e.g. "show me all alerts triggered by post XYZ"
    index("idx_ae_source").on(table.sourceType, table.sourceId, table.createdAt),

    // Severity filter — crisis alerts always shown at top of feed
    index("idx_ae_severity_created").on(table.organizationId, table.severity, table.createdAt),

    // Crisis-only partial index — highest priority query, needs to be fast
    index("idx_ae_crisis")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.severity} = 'crisis'`),

    // SLA breach reporting — compliance and performance dashboards
    index("idx_ae_sla_breaches")
      .on(table.organizationId, table.breachedAt)
      .where(sql`${table.breachType} IS NOT NULL`),

    // Escalation worker — events past threshold with no escalation yet
    index("idx_ae_pending_escalation")
      .on(table.createdAt)
      .where(
        sql`${table.isAcknowledged} = FALSE
          AND ${table.escalatedAt} IS NULL
          AND ${table.alertSent} = TRUE`,
      ),

    // Daily alert cap enforcement — count today's events for a rule
    index("idx_ae_rule_today").on(table.ruleId, table.createdAt),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *   alert_events.ruleId → alert_rules.id (modeled above)
 *   alert_events.sourceType + sourceId →
 *     engagement_messages.id | media_articles.id | social_mentions.id
 *     | analytics_metrics.id | backup_records.id | monitoring_campaigns.id
 *   alert_events.acknowledgedById / escalatedToId → users.id
 *
 * These are intentionally NOT modeled as Drizzle relations because:
 *   1. sourceType/sourceId is polymorphic
 *   2. The user references may resolve to deleted users (intentional non-FK)
 */
export const alertRulesRelations = relations(alertRules, ({ many }) => ({
  // Every firing of this rule — one row per trigger instance
  events: many(alertEvents, {
    relationName: "alertRule_events",
  }),
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
  // The rule that generated this event
  // Nullable — system events may have no backing rule
  rule: one(alertRules, {
    fields: [alertEvents.ruleId],
    references: [alertRules.id],
    relationName: "alertRule_events",
  }),

  // sourceType + sourceId are polymorphic — resolved at application layer.
  // No Drizzle relations for:
  //   sourceType='engagement_message' → engagement_messages.id
  //   sourceType='media_article'      → media_articles.id
  //   sourceType='social_mention'     → social_mentions.id
  //   sourceType='sla_timer'          → engagement_messages.id
  //   sourceType='analytics_metric'   → analytics_metrics.id
  //   sourceType='system'             → backup_records.id
  //   sourceType='monitoring_campaign'→ monitoring_campaigns.id
}));
