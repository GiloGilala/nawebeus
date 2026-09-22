import { pgEnum } from "drizzle-orm/pg-core";

// =============================================================================
// PLATFORM & CHANNEL
// =============================================================================

/**
 * Single canonical platform enum used across ALL modules.
 *
 * twitter_x = current branding — standardized from 'twitter' which appeared
 * in several v1 files. Never needs renaming again.
 *
 * web / email / sms / whatsapp / wire = non-social delivery channels
 * used by content_deliveries, alert_rules, and notification_preferences.
 */
export const platformEnum = pgEnum("platform", [
  "twitter_x",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "reddit",
  "telegram",
  "web",
  "email",
  "sms",
  "whatsapp",
  "wire",
]);

// =============================================================================
// SENTIMENT & NLP
// =============================================================================

/**
 * Unified sentiment label used across ALL modules.
 *
 * 'mixed' added everywhere — was missing from 3 of 4 original sentiment enums.
 * media_articles and PR coverage both need it; standardizing across the board
 * prevents the 4th case from being silently dropped.
 *
 * Replaces:
 *   sentimentLabelEnum        (listening v1)
 *   engagementSentimentLabel  (engagement)
 *   mediaArticleSentimentLabel (monitoring v2)
 *   prCoverageSentimentLabel  (pr)
 */
export const sentimentLabelEnum = pgEnum("sentiment_label", [
  "positive",
  "neutral",
  "negative",
  "mixed",
]);

/**
 * Unified intent label used across engagement and listening.
 */
export const intentLabelEnum = pgEnum("intent_label", [
  "question",
  "complaint",
  "praise",
  "sales",
  "support",
  "spam",
  "other",
]);

// =============================================================================
// CONTENT LIFECYCLE
// =============================================================================

/**
 * Canonical content lifecycle status used by posts, press_releases,
 * and publishing_results.
 *
 * Replaces: postStatusEnum, pressReleaseStatusEnum,
 *           publishingResultStatusEnum, prDistributionStatusEnum,
 *           contentStatusEnum (v2 publishing)
 *
 * Status flow for posts:
 *   draft → pending_review → changes_requested ↺ → approved
 *        → scheduled → publishing → published
 *                                 → partially_published
 *                                 → failed
 *        → cancelled
 *        → archived (terminal)
 *
 * Status flow for publishing_results:
 *   queued → publishing → published
 *                       → failed (retryCount incremented)
 *                       → cancelled
 */
export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
  "cancelled",
  "archived",
]);

/**
 * Publishing result status — narrower subset of contentStatusEnum.
 * Used only by publishing_results rows (per-platform delivery state).
 * Kept separate because publishing_results cannot be 'draft' or 'approved'.
 */
export const publishingResultStatusEnum = pgEnum("publishing_result_status", [
  "queued",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);

export const scheduleTypeEnum = pgEnum("schedule_type", ["immediate", "scheduled", "recurring"]);

// =============================================================================
// APPROVAL
// =============================================================================

/**
 * Approval request lifecycle — used by shared/approval.ts.
 * Replaces approvalStatusEnum across publishing, engagement, and PR.
 *
 * 'escalated' = routed to a higher approver when current approver
 *               doesn't respond within the SLA window.
 * 'expired'   = expiresAt passed without a decision.
 */
export const approvalRequestStatusEnum = pgEnum("approval_request_status", [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
  "escalated",
  "expired",
  "recalled",
]);

/**
 * Actions that can be taken on an approval request.
 * Each action produces one row in approval_history.
 */
export const approvalActionEnum = pgEnum("approval_action", [
  "submitted",
  "approved",
  "rejected",
  "changes_requested",
  "recalled",
  "escalated",
  "delegated",
  "reminder_sent",
  // Added by NWB-P1-003 (migration 0004): the status enum could say `expired` but the history
  // enum could not record it, so the worker's terminal transition had no history row.
  "expired",
]);

/**
 * Entity types that can have approval workflows.
 * Extend this enum when a new approvable entity type is added.
 */
export const approvableEntityTypeEnum = pgEnum("approvable_entity_type", [
  "post",
  "press_release",
  "engagement_response",
]);

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * Unified template type — covers all four template stores that previously
 * existed as separate tables.
 *
 * Replaces:
 *   content_templates    (publishing module)
 *   engagement_templates (engagement module)
 *   campaign_templates   (campaigns module)
 *   crisis template fields inlined on press_releases
 *
 * 'notification_templates' explicitly excluded — no such table exists
 * in the actual schema (verified against all pasted files).
 */
export const templateTypeEnum = pgEnum("template_type", [
  "post",
  "engagement_response",
  "press_release",
  "campaign",
  "email",
]);

// =============================================================================
// MEDIA ASSETS
// =============================================================================

/**
 * Unified asset type covering publishing library assets and
 * inbound engagement/influencer attachments.
 *
 * Replaces: mediaAssetTypeEnum (publishing v1 + v2)
 */
export const mediaAssetTypeEnum = pgEnum("media_asset_type", [
  "image",
  "video",
  "gif",
  "audio",
  "document",
  "other",
]);

/**
 * Which entity type an asset is attached to.
 * NULL = unattached library asset.
 */
export const mediaAttachedToTypeEnum = pgEnum("media_attached_to_type", [
  "post",
  "engagement_response",
  "press_release",
  "influencer_content",
  "content_template",
]);

// =============================================================================
// AUDIT
// =============================================================================

/**
 * Who performed the audited action.
 */
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "admin",
  "system",
  "api_key",
  "impersonation",
]);

/**
 * Logical grouping of audit events.
 * Used for filtering in the audit log UI and compliance reports.
 *
 * Replaces: adminAuditCategoryEnum (compliance v1 + v2)
 */
export const auditCategoryEnum = pgEnum("audit_category", [
  "authentication",
  "authorization",
  "user_management",
  "content",
  "billing",
  "security",
  "compliance",
  "system_config",
  "feature_flag",
  "engagement",
  "publishing",
  "listening",
  "data_ops",
]);

/**
 * Which module of the application generated this audit event.
 */
export const auditSourceModuleEnum = pgEnum("audit_source_module", [
  "core",
  "admin",
  // `compliance` and `security` are referenced by unified_audit_log's CHECK
  // constraints and partial indexes, and by AuditModule in
  // src/services/audit.ts. Omitting them made the enum reject its own
  // constraints, which broke `bun run db:push` outright.
  "compliance",
  "security",
  "engagement",
  "publishing",
  "listening",
  "monitoring",
  "influencer",
  "pr",
  "commerce",
  "campaigns",
  "social_accounts",
  "analytics",
  "system",
]);

/**
 * How serious this audit event is.
 */
export const auditSeverityEnum = pgEnum("audit_severity", [
  "info",
  "warning",
  "critical",
  "emergency",
]);

// =============================================================================
// ALERTS
// =============================================================================

/**
 * Which module owns an alert rule.
 */
export const alertRuleSourceEnum = pgEnum("alert_rule_source", [
  "listening",
  "monitoring",
  "analytics",
  "engagement",
  "system",
  "crisis",
  "commerce",
  "pr",
  "campaign",
]);

/**
 * What kind of condition evaluates the alert rule.
 */
export const alertConditionTypeEnum = pgEnum("alert_condition_type", [
  "threshold",
  "anomaly",
  "trend",
  "comparison",
  "keyword_match",
  "volume_spike",
  "sentiment_crash",
  "condition_type",
  "sentiment_drop",
]);

/**
 * Severity of a fired alert event.
 */
export const alertEventSeverityEnum = pgEnum("alert_event_severity", [
  "info",
  "warning",
  "critical",
  "crisis",
]);

export const alertAudienceEnum = pgEnum("alert_audience", [
  "internal", // staff/ops — the original use case (recipients is a fixed list)
  "participant", // the end user who triggered the event (recipients is unused)
]);

export const alertRecipientModeEnum = pgEnum("alert_recipient_mode", [
  "fixed", // recipients jsonb holds a literal list of {userId, channel}
  "triggering_entity", // send to whoever triggered the event (e.g. the campaign
  // entrant), using contact info already on that entity —
  // recipients jsonb is unused/null in this mode
]);

export const alertFrequencyEnum = pgEnum("alert_frequency", [
  "realtime",
  "hourly",
  "daily",
  "weekly",
  "monthly",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "not_reviewed",
  "pending",
  "approved",
  "rejected",
  "flagged",
  "auto_approved",
]);

// =============================================================================
// CONTACTS
// =============================================================================

/**
 * The two contact subtypes that currently exist.
 * Extend when customers, vendors, or partners are added.
 */
export const contactKindEnum = pgEnum("contact_kind", ["journalist", "influencer"]);

/**
 * Unified interaction type covering both journalist and influencer interactions.
 *
 * Replaces:
 *   prInteractionTypeEnum         (pr module)
 *   influencerInteractionTypeEnum (influencer module)
 *
 * journalist-specific: interview_request, press_release_open,
 *                      coverage_published, briefing
 * influencer-specific: content_review, negotiation,
 *                      campaign_briefing, contract_signed
 * shared:              email, whatsapp, phone_call, meeting,
 *                      video_call, dm, event, social_dm
 */

// In shared/enums.ts

/**
 * Follow-up lifecycle state for a contact interaction.
 *
 * pending     — follow-up is required, not yet acted on. Drives the
 *               follow-up reminder worker via a partial index.
 * completed   — follow-up was completed. followUpCompletedAt MUST be set
 *               (enforced by chk_ci_followup_consistency).
 * cancelled   — follow-up is no longer needed. E.g. the conversation
 *               closed or the contact became unreachable.
 * rescheduled — a new followUpAt was set on a different interaction;
 *               this row is closed but referenced from the new one
 *               via metadata.previousInteractionId.
 */
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "pending",
  "completed",
  "cancelled",
  "rescheduled",
]);

/**
 * Urgency level for an interaction. Drives:
 *   - reminder frequency and notification channel
 *   - dashboard sorting
 *   - SLA calculations for the team
 */
export const interactionPriorityEnum = pgEnum("interaction_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

/**
 * Who can see a given interaction note.
 *
 * private      — only the user who created the interaction.
 *               Use for personal scratchpads.
 * internal     — all team members in the organization. Use for
 *               notes the team needs but customers don't.
 * organization — the default. Visible to everyone in the org
 *               including cross-functional collaborators.
 */
export const interactionVisibilityEnum = pgEnum("interaction_visibility", [
  "private",
  "internal",
  "organization",
]);

export const contactInteractionTypeEnum = pgEnum("contact_interaction_type", [
  // Shared
  "email",
  "whatsapp",
  "phone_call",
  "meeting",
  "video_call",
  "dm",
  "event",
  "social_dm",
  // Journalist-specific
  "interview_request",
  "press_release_open",
  "coverage_published",
  "briefing",
  // Influencer-specific
  "content_review",
  "negotiation",
  "campaign_briefing",
  "contract_signed",
]);

export const contactInteractionDirectionEnum = pgEnum("contact_interaction_direction", [
  "inbound",
  "outbound",
  "automatic",
]);

/**
 * Unified outcome covering both journalist and influencer interaction outcomes.
 *
 * Replaces:
 *   prInteractionOutcomeEnum         (pr module)
 *   influencerInteractionOutcomeEnum (influencer module)
 */
export const contactInteractionOutcomeEnum = pgEnum("contact_interaction_outcome", [
  // Shared
  "positive",
  "neutral",
  "negative",
  "no_response",
  // Journalist-specific
  "coverage",
  "meeting_scheduled",
  "interview_scheduled",
  // Influencer-specific
  "content_published",
  "contract_signed",
  "declined",
]);

// =============================================================================
// ANALYTICS
// =============================================================================

export const analyticsGranularityEnum = pgEnum("analytics_granularity", [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
]);

export const analyticsMetricTypeEnum = pgEnum("analytics_metric_type", [
  "number",
  "percentage",
  "currency",
  "duration",
  "count",
  "ratio",
]);

export const analyticsAggregationMethodEnum = pgEnum("analytics_aggregation_method", [
  "sum",
  "avg",
  "count",
  "min",
  "max",
  "last",
  "median",
]);

export const analyticsExportFormatEnum = pgEnum("analytics_export_format", [
  "csv",
  "json",
  "excel",
  "pdf",
  "pptx",
]);

export const analyticsExportStatusEnum = pgEnum("analytics_export_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

/**
 * Which module generated an analytics event.
 */
export const analyticsEventSourceEnum = pgEnum("analytics_event_source", [
  "publishing",
  "engagement",
  "listening",
  "monitoring",
  "influencer",
  "crisis",
  "billing",
  "user",
  "system",
  "commerce",
  "campaigns",
  "pr",
]);

// =============================================================================
// USER & ORGANIZATION
// =============================================================================

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "pending_verification",
  "pending_deletion",
  "deleted",
]);

export const planTierEnum = pgEnum("plan_tier", [
  "starter",
  "growth",
  "professional",
  "enterprise",
  "agency",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "cancelled",
  "paused",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "manager",
  "creator",
  "analyst",
  "viewer",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "suspended",
  "pending",
  "invited",
]);

/**
 * Owner excluded — owners are created only at registration
 * or via ownership transfer, never via invitation.
 */
export const invitationRoleEnum = pgEnum("invitation_role", [
  "admin",
  "manager",
  "creator",
  "analyst",
  "viewer",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const industryEnum = pgEnum("industry", [
  "banking",
  "fintech",
  "telecom",
  "fmcg",
  "pr_agency",
  "government",
  "media",
  "technology",
  "other",
]);

export const deviceTypeEnum = pgEnum("device_type", ["desktop", "mobile", "tablet", "unknown"]);

export const loginFailureReasonEnum = pgEnum("login_failure_reason", [
  "invalid_password",
  "account_locked",
  "email_not_verified",
  "account_suspended",
  "account_deleted",
  "mfa_failed",
  "mfa_backup_failed",
]);

// =============================================================================
// COMPLIANCE
// =============================================================================

export const impersonationEndReasonEnum = pgEnum("impersonation_end_reason", [
  "expired",
  "manual_end",
  "security_terminated",
  "system_terminated",
]);

export const dsarTypeEnum = pgEnum("dsar_type", [
  "access",
  "erasure",
  "portability",
  "rectification",
  "restrict_processing",
]);

export const dsarStatusEnum = pgEnum("dsar_status", [
  "pending",
  "verifying",
  "processing",
  "completed",
  "rejected",
  "failed",
  "partially_completed",
]);

export const legalHoldDataTypeEnum = pgEnum("legal_hold_data_type", [
  "user_data",
  "conversations",
  "audit_logs",
  "orders",
  "analytics",
  "all",
]);

export const legalHoldStatusEnum = pgEnum("legal_hold_status", [
  "active",
  "released",
  "expired",
  "pending_release",
]);

/**
 * Hold urgency, mirroring the house priority set (`engagement_priority`). Referenced by the
 * `legal_holds` model since it was written but never defined — NWB-P1-010's adoption is what
 * needed the DDL to exist. P1-010 itself treats every active hold as blocking; priority serves
 * the future review dashboard, not the worker.
 */
export const legalHoldPriorityEnum = pgEnum("legal_hold_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const retentionActionEnum = pgEnum("retention_action", [
  "delete",
  "anonymize",
  "archive",
  "export",
]);

// =============================================================================
// APP CONFIG (merged system_config + feature_flags)
// =============================================================================

export const configKindEnum = pgEnum("config_kind", ["system_config", "feature_flag"]);

export const configEnvironmentEnum = pgEnum("config_environment", [
  "development",
  "staging",
  "production",
  "sandbox",
]);

export const configTypeEnum = pgEnum("config_type", [
  "security",
  "rate_limit",
  "feature_flag",
  "integration",
  "notification",
  "billing",
  "compliance",
]);

export const backupTypeEnum = pgEnum("backup_type", [
  "full_database",
  "incremental_wal",
  "file_storage",
  "configuration",
  "metadata",
]);

export const backupStatusEnum = pgEnum("backup_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "expired",
  "verified",
]);

/**
 * Outcome of the most recent full-restore drill against a backup (NULL = never drilled).
 * Referenced by the `backup_records` model since it was written but never defined — the value
 * set is NWB-P1-010's, chosen to match the model's `pending → passed | failed` lifecycle.
 */
export const backupRestoreStatusEnum = pgEnum("backup_restore_status", [
  "pending",
  "passed",
  "failed",
]);

// =============================================================================
// SOCIAL ACCOUNTS
// =============================================================================

export const socialAccountTypeEnum = pgEnum("social_account_type", [
  "personal",
  "business",
  "creator",
  "brand",
  "organization",
]);

export const socialAccountStatusEnum = pgEnum("social_account_status", [
  "active",
  "error",
  "paused",
  "needs_reauth",
  "disconnected",
  "pending_verification",
]);

export const socialAccountOperationTypeEnum = pgEnum("social_account_operation_type", [
  "health_check",
  "token_refresh",
  "sync",
  "reconnect",
  "disconnect",
]);

export const tokenRefreshTriggerEnum = pgEnum("token_refresh_trigger", [
  "proactive",
  "on_demand",
  "error_recovery",
  "scheduled",
]);

// =============================================================================
// LISTENING & MONITORING
// =============================================================================

export const monitoringCampaignStatusEnum = pgEnum("monitoring_campaign_status", [
  "active",
  "paused",
  "archived",
]);

export const mediaArticleSourceTypeEnum = pgEnum("media_article_source_type", [
  "newspaper",
  "blog",
  "broadcast",
  "wire",
  "magazine",
  "online",
  "social",
]);

// ─── News Source Registry ────────────────────────────────────────────────────

/**
 * Type of media outlet — richer than mediaArticleSourceTypeEnum which
 * describes the article's origin format. This describes the outlet itself.
 */
export const newsSourceTypeEnum = pgEnum("news_source_type", [
  "news_website",
  "blog",
  "magazine",
  "newspaper",
  "tv_station",
  "radio_station",
  "podcast",
  "press_release_wire",
  "industry_publication",
  "trade_journal",
  "newsletter",
  "aggregator",
  "social_media",
  "other",
]);

/**
 * Source tier — replaces the integer-based sourceTier on media_articles.
 * tier_1 = major national/international, tier_4 = blogs/independent media.
 */
export const sourceTierEnum = pgEnum("source_tier", ["tier_1", "tier_2", "tier_3", "tier_4"]);

export const sourceStatusEnum = pgEnum("source_status", [
  "active",
  "monitoring",
  "paused",
  "inactive",
  "blocked",
  "archived",
]);

export const credibilityRatingEnum = pgEnum("credibility_rating", [
  "verified",
  "trusted",
  "reliable",
  "moderate",
  "questionable",
  "unreliable",
  "unknown",
]);

export const politicalLeaningEnum = pgEnum("political_leaning", [
  "far_left",
  "left",
  "center_left",
  "center",
  "center_right",
  "right",
  "far_right",
  "neutral",
  "unknown",
]);

export const mediaArticleIngestSourceEnum = pgEnum("media_article_ingest_source", [
  "social_listening",
  "pr_monitoring",
  "wire",
  "manual",
]);

export const brandMentionContextEnum = pgEnum("brand_mention_context", [
  "primary",
  "passing",
  "none",
]);

export const crisisStatusEnum = pgEnum("crisis_status", [
  "active",
  "acknowledged",
  "monitoring",
  "resolved",
  "false_positive",
]);

export const authorTierEnum = pgEnum("author_tier", ["mega", "macro", "mid", "micro", "nano"]);

export const competitorCategoryEnum = pgEnum("competitor_category", [
  "direct",
  "indirect",
  "aspirational",
]);

// ─── Social Mentions ──────────────────────────────────────────────────────────

/**
 * Where a social mention was found — distinct from platformEnum which
 * identifies the specific platform (twitter_x, instagram, etc.).
 */
export const mentionSourceEnum = pgEnum("mention_source", [
  "social_media",
  "news",
  "blogs",
  "forums",
  "reviews",
  "other",
]);

/**
 * How the mention references the tracked entity.
 */
export const mentionTypeEnum = pgEnum("mention_type", [
  "direct",
  "mention",
  "reply",
  "quote",
  "retweet",
  "repost",
]);

/**
 * Processing pipeline state for a social mention.
 */
export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "skipped",
]);

// =============================================================================
// ENGAGEMENT
// =============================================================================

/**
 * Unified workflow status covering message states and response states.
 *
 * Message states: new → assigned → in_progress → awaiting_info
 *                     → awaiting_customer → resolved → closed → snoozed
 *
 * Response states: draft → pending_review → approved → sent
 *                        → failed → scheduled → cancelled
 */
export const engagementWorkflowStatusEnum = pgEnum("engagement_workflow_status", [
  // Message states
  "new",
  "assigned",
  "in_progress",
  "awaiting_info",
  "awaiting_customer",
  "resolved",
  "closed",
  "snoozed",
  // Response states
  "draft",
  "pending_review",
  "approved",
  "sent",
  "failed",
  "scheduled",
  "cancelled",
]);

export const priorityEnum = pgEnum("engagement_priority", ["critical", "high", "medium", "low"]);

export const aiModelEnum = pgEnum("ai_model", [
  "gpt-4",
  "gpt-4o",
  "gpt-3.5-turbo",
  "claude-3-opus",
  "claude-3-sonnet",
  "custom",
]);

// =============================================================================
// PR
// =============================================================================

export const prCrisisTypeEnum = pgEnum("pr_crisis_type", [
  "service_outage",
  "data_breach",
  "product_recall",
  "negative_coverage",
  "executive_misconduct",
  "regulatory_action",
  "social_media_storm",
  "other",
]);

export const journalistContactMethodEnum = pgEnum("journalist_contact_method", [
  "email",
  "whatsapp",
  "phone",
  "social",
  "telegram",
]);

export const journalistNdprConsentStatusEnum = pgEnum("journalist_ndpr_consent_status", [
  "pending",
  "granted",
  "withdrawn",
  "expired",
]);

export const journalistTierEnum = pgEnum("journalist_tier", ["tier1", "tier2", "tier3"]);

export const prAttributionMethodEnum = pgEnum("pr_attribution_method", [
  "keyword_match",
  "journalist_link",
  "content_match",
  "manual",
  "ai_detected",
  "utm_tracking",
]);

export const prInitiativeStatusEnum = pgEnum("pr_initiative_status", [
  "planning",
  "active",
  "completed",
  "archived",
]);

// =============================================================================
// INFLUENCER
// =============================================================================

export const influencerTierEnum = pgEnum("influencer_tier", [
  "nano", // 1K–10K
  "micro", // 10K–50K
  "mid", // 50K–250K
  "macro", // 250K–1M
  "mega", // 1M+
]);

export const influencerStatusEnum = pgEnum("influencer_status", [
  "active",
  "inactive",
  "blacklisted",
  "pending_verification",
]);

export const influencerProgramTypeEnum = pgEnum("influencer_program_type", [
  "product_seeding",
  "brand_awareness",
  "performance",
  "event_promotion",
  "csr",
  "crisis_response",
]);

export const influencerProgramStatusEnum = pgEnum("influencer_program_status", [
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
  "cancelled",
]);

export const influencerAssignmentStatusEnum = pgEnum("influencer_assignment_status", [
  "identified",
  "invited",
  "negotiating",
  "accepted",
  "declined",
  "contracted",
  "content_submitted",
  "content_approved",
  "published",
  "completed",
  "cancelled",
]);

export const influencerPaymentStatusEnum = pgEnum("influencer_payment_status", [
  "pending",
  "advance_paid",
  "partial_paid",
  "paid",
  "overdue",
  "disputed",
  "refunded",
]);

export const influencerContentTypeEnum = pgEnum("influencer_content_type", [
  "instagram_post",
  "instagram_reel",
  "instagram_story",
  "tiktok_video",
  "youtube_video",
  "twitter_post",
  "facebook_post",
  "blog_post",
  "linkedin_post",
]);

export const influencerContentStatusEnum = pgEnum("influencer_content_status", [
  "draft",
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
  "published",
  "scheduled",
]);

// =============================================================================
// COMMERCE
// =============================================================================

export const productInventoryStatusEnum = pgEnum("product_inventory_status", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "discontinued",
]);

export const commercePlatformEnum = pgEnum("commerce_platform", [
  "instagram",
  "facebook",
  "tiktok",
  "shopify",
  "woocommerce",
  "custom",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "failed",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partial_refund",
]);

export const orderFulfillmentStatusEnum = pgEnum("order_fulfillment_status", [
  "unfulfilled",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "delivered",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed",
  "buy_x_get_y",
  "free_shipping",
]);

export const discountStatusEnum = pgEnum("discount_status", [
  "draft",
  "active",
  "paused",
  "expired",
  "archived",
]);

export const productSyncStatusEnum = pgEnum("product_sync_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

// =============================================================================
// CAMPAIGNS / GIVEAWAY
// =============================================================================

export const giveawayCampaignTypeEnum = pgEnum("giveaway_campaign_type", [
  "standard",
  "referral",
  "multi_action",
  "sweepstakes",
  "contest",
  "giveaway",
  "photo_contest",
  "video_contest",
  "caption_contest",
  "ugc_campaign",
  "hashtag_campaign",
  "poll",
  "quiz",
  "instant_win",
  "milestone",
  "engagement",
  "awareness",
  "conversion",
  "custom",
  "pr",
  "influencer",
  "event",
]);

export const giveawayCampaignStatusEnum = pgEnum("giveaway_campaign_status", [
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
  "cancelled",
  "archived",
]);

export const campaignEntryMethodTypeEnum = pgEnum("campaign_entry_method_type", [
  "follow",
  "like",
  "comment",
  "share",
  "tag_friends",
  "visit_website",
  "email_subscribe",
  "refer_friend",
  "custom",
  "purchase",
  "review",
]);

export const entrySourceEnum = pgEnum("entry_source", [
  "web",
  "mobile_app",
  "social",
  "widget",
  "api",
  "import",
  "referral",
]);

export const campaignEntryStatusEnum = pgEnum("campaign_entry_status", [
  "pending", // entry submitted, actions not yet verified
  "verified", // all required actions verified
  "partial", // some (but not all) required actions completed
  "failed", // action verification failed
  "disqualified", // fraud detection flagged this entry
  "winner", // selected as a winner
  "duplicate", // detected as a duplicate entry
  "referral", // entry created via referral
  "hidden", // hidden from public view (NOT deleted — legal record)
  "archived", // archived for long-term storage (NOT deleted)
]);

export const winnerTierEnum = pgEnum("winner_tier", [
  "grand_prize",
  "runner_up_1",
  "runner_up_2",
  "consolation",
]);

export const winnerStatusEnum = pgEnum("winner_status", [
  "pending",
  "notified",
  "accepted",
  "shipped",
  "delivered",
  "forfeited",
  "expired",
]);

export const fraudRiskLevelEnum = pgEnum("fraud_risk_level", ["low", "medium", "high", "critical"]);

export const contentTypeEnum = pgEnum("content_type", [
  "form",
  "photo",
  "video",
  "text",
  "link",
  "social_post",
  "poll_response",
]);

// =============================================================================
// BILLING & NOTIFICATIONS
// =============================================================================

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "card",
  "bank_account",
  "ussd",
]);

export const cardBrandEnum = pgEnum("card_brand", ["visa", "mastercard", "verve", "amex", "other"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "in_app",
  "push",
  "sms",
]);

export const notificationFrequencyEnum = pgEnum("notification_frequency", [
  "real_time",
  "hourly",
  "daily",
  "weekly",
]);

export const onboardingItemEnum = pgEnum("onboarding_item", [
  "connect_social_account",
  "setup_monitoring_keyword",
  "invite_team_member",
  "complete_profile",
  "customize_org_settings",
]);

export const usageMetricTypeEnum = pgEnum("usage_metric_type", [
  "users",
  "social_accounts",
  "mentions",
  "monitoring_keywords",
  "conversations",
  "storage_bytes",
  "api_calls",
  "custom_reports",
  "scheduled_reports",
]);

// =============================================================================
// SESSION
// =============================================================================

export const sessionTypePgEnum = pgEnum("session_type", ["web", "mobile", "api", "cli"]);

export const loginMethodPgEnum = pgEnum("login_method", ["password", "oauth", "sso"]);

export const securityLevelPgEnum = pgEnum("security_level", ["low", "medium", "high", "critical"]);

export const sessionStatusPgEnum = pgEnum("session_status", ["active", "expired", "revoked"]);

// =============================================================================
// ROLE
// =============================================================================

export const roleTypePgEnum = pgEnum("role_type", ["system", "custom"]);

export const roleScopePgEnum = pgEnum("role_scope", ["global", "organization", "project"]);

export const roleStatusPgEnum = pgEnum("role_status", ["active", "inactive", "archived"]);

// =============================================================================
// ROLE ASSIGNMENT
// =============================================================================

export const roleAssignmentSourcePgEnum = pgEnum("role_assignment_source", [
  "system",
  "manual",
  "inherited",
]);

export const roleAssignmentStatusPgEnum = pgEnum("role_assignment_status", [
  "active",
  "revoked",
  "pending",
]);

export const roleAssignmentStatusEnum = roleAssignmentStatusPgEnum;

// =============================================================================
// PERMISSION
// =============================================================================

export const permissionScopePgEnum = pgEnum("permission_scope", [
  "global",
  "organization",
  "resource",
]);

export const permissionTypePgEnum = pgEnum("permission_type", [
  "read",
  "write",
  "execute",
  "admin",
  "system",
]);

export const permissionStatusPgEnum = pgEnum("permission_status", [
  "active",
  "inactive",
  "revoked",
]);

// =============================================================================
// API KEY
// =============================================================================

export const apiKeyStatusPgEnum = pgEnum("api_key_status", ["active", "inactive", "revoked"]);

export const apiKeyTypePgEnum = pgEnum("api_key_type", ["read", "write", "admin"]);

export const apiKeyPermissionLevelPgEnum = pgEnum("api_key_permission_level", [
  "read",
  "write",
  "admin",
  "read_only",
]);

export const apiKeyEnvironmentPgEnum = pgEnum("api_key_environment", [
  "production",
  "staging",
  "development",
]);

export const apiKeySecurityLevelPgEnum = pgEnum("api_key_security_level", [
  "low",
  "medium",
  "high",
  "critical",
  "standard",
]);

export const keyRotationStrategyPgEnum = pgEnum("key_rotation_strategy", [
  "manual",
  "automatic",
  "periodic",
  "none",
]);

export const revocationTypePgEnum = pgEnum("revocation_type", [
  "user",
  "admin",
  "system",
  "security",
  "manual",
]);

// =============================================================================
// OAUTH
// =============================================================================

export const oauthProviderEnum = pgEnum("oauth_provider", [
  "google",
  "github",
  "microsoft",
  "apple",
]);

export const oauthProviderPgEnum = oauthProviderEnum;

export const oauthStatusEnum = pgEnum("oauth_status", ["active", "inactive", "revoked"]);

export const oauthConnectionStatusEnum = pgEnum("oauth_connection_status", [
  "active",
  "pending",
  "revoked",
]);

export const oauthScopeEnum = pgEnum("oauth_scope", ["read", "write", "admin"]);

export const oauthTokenStatusEnum = pgEnum("oauth_token_status", ["active", "expired", "revoked"]);

export const oauthAccountStatusPgEnum = pgEnum("oauth_account_status", [
  "active",
  "inactive",
  "revoked",
]);

export const connectionStatusPgEnum = pgEnum("connection_status", [
  "active",
  "pending",
  "revoked",
  "connected",
]);

export const consentLevelPgEnum = pgEnum("consent_level", ["none", "partial", "full", "basic"]);

// =============================================================================
// TOKEN
// =============================================================================

export const tokenTypePgEnum = pgEnum("token_type", [
  "access",
  "refresh",
  "email_verification",
  "password_reset",
  "invite",
  "otp",
  "magic_link",
]);

export const tokenStatusPgEnum = pgEnum("token_status", ["active", "expired", "revoked", "valid"]);

export const revokeReasonPgEnum = pgEnum("revoke_reason", [
  "user",
  "admin",
  "security",
  "timeout",
  "password_change",
]);

// =============================================================================
// USER ROLE
// =============================================================================

export const userRoleAssignmentStatusPgEnum = pgEnum("user_role_assignment_status", [
  "active",
  "revoked",
  "pending",
]);

export const userRoleSourcePgEnum = pgEnum("user_role_source", ["system", "manual", "inherited"]);

// =============================================================================
// SUBSCRIPTION & USER
// =============================================================================

export const subscriptionPlanPgEnum = pgEnum("subscription_plan", [
  "free",
  "starter",
  "professional",
  "enterprise",
]);

export const profileVisibilityPgEnum = pgEnum("profile_visibility", [
  "public",
  "org_only",
  "private",
]);

export const pgUserThemeEnum = pgEnum("user_theme", ["light", "dark", "system"]);

export const roleValueTypePgEnum = pgEnum("role_value_type", ["admin", "member", "viewer", "user"]);

// =============================================================================
// ENGAGEMENT LEVEL
// =============================================================================

export const engagementLevelPgEnum = pgEnum("engagement_level", [
  "none",
  "low",
  "medium",
  "high",
  "full",
  "active",
]);

// =============================================================================
// ORGANIZATION
// =============================================================================

export const organizationTypePgEnum = pgEnum("organization_type", [
  "individual",
  "company",
  "agency",
  "government",
  "team",
]);

export const organizationStatusPgEnum = pgEnum("organization_status", [
  "active",
  "suspended",
  "deleted",
  "pending",
]);

// =============================================================================
// ALIASES (import names that differ from the canonical enum name)
// =============================================================================

export const deviceTypePgEnum = deviceTypeEnum;

export const platformPgEnum = platformEnum;

export const invitationStatusPgEnum = invitationStatusEnum;

export const memberStatusPgEnum = memberStatusEnum;

export const industryPgEnum = industryEnum;

export const userStatusPgEnum = userStatusEnum;

export const userRoleStatusPgEnum = userStatusEnum;
