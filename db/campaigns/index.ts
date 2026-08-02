// db/schema/campaigns/index.ts
//
// Campaigns & Giveaways module — v5 (consolidated + merged + legal-compliant).
//
// Tables (3):
//   campaigns              — campaign/giveaway/sweepstakes definitions
//   campaign_entries       — participant entries with fraud detection and winner lifecycle
//   campaign_entry_methods — entry action definitions (follow, like, share, etc.)
//
// Tables removed → shared modules:
//   campaignTemplates       → shared/templates.ts
//                              templateType = 'campaign'
//   campaignDailyStats      → shared/analytics.ts (analytics_aggregates)
//                              dimension_1 = campaign_id
//                              dimension_2 = 'campaign'
//                              metric_name = 'entries', 'referrals', 'completions',
//                                'flagged_entries', 'blocked_entries'
//   campaigns.mediaGallery  → shared/media-assets.ts (media_assets)
//                              attachedToType = 'campaign', attachedToId = campaigns.id
//                              isLibraryAsset = FALSE for campaign-specific uploads
//                              media_assets gained caption/purpose/displayOrder
//                                columns specifically to support this
//   campaigns.notifications → shared/alerts.ts (alert_rules)
//                              source = 'campaign', audience = 'participant',
//                              recipientMode = 'triggering_entity'
//                              Each toggle (entryConfirmation, approvalNotification,
//                                etc.) becomes one alert_rules row instead of a
//                                boolean flag; fired sends have delivery history
//                                via alert_events that the boolean-toggle version
//                                never had.
//
// Design decisions:
//
//   UUID primary keys:
//     Used because entry IDs appear in public URLs (referral links),
//     UUIDs prevent enumeration attacks on entry counts, and they're
//     consistent with the commerce module (products/orders).
//
//   campaign_entries — consolidated from entries + winners:
//     The v2 schema had a separate winners concept. This version
//     consolidates winner fields (isWinner, winnerTier, winnerStatus,
//     prize fulfillment) directly onto campaign_entries. A participant
//     who wins is the same row with isWinner = true. This avoids a
//     polymorphic FK, duplicate participant data, and complex joins.
//
//   completedActions JSONB on campaign_entries:
//     Replaces the separate entry_actions table from v2. Each element
//     captures one completed action with methodType, verificationStatus,
//     pointsAwarded, verifiedAt, platformUserId. Actions are always
//     read/written with the entry, never queried independently.
//
//   Referral tracking:
//     Self-referential: referrerEntryId points to the entry that referred
//     this participant. referralCode is unique per campaign per entry.
//     referralCount is denormalized for leaderboard display.
//
//   Fraud detection:
//     ipAddress, deviceFingerprint, recaptchaScore, fraudScore,
//     fraudRiskLevel, fraudFlags. The fraud engine evaluates on entry
//     creation and may allow, flag for review, or auto-block.
//
//   Prize representation (mutually exclusive):
//     - Single prize: flat columns (prizeName, prizeValue, prizeQuantity)
//     - Multi-tier:   prizeTiers JSONB
//     Enforced by chk_camp_prize_representation.
//
//   NDPR compliance:
//     ndprCompliant on campaigns. Participant-level consent captured
//     in campaign_entries.compliance. termsAndConditions, officialRules,
//     and privacyPolicyUrl are required fields on every campaign.
//
//   entryMethods on campaigns vs campaign_entry_methods table:
//     campaigns.entryMethods JSONB is the denormalized quick-read.
//     campaign_entry_methods is the relational source of truth.
//     Service layer keeps both in sync.
//
//   No FK to organizations or users:
//     organizationId, createdBy are plain UUID. Campaign data has
//     legal/regulatory retention requirements.
//
//   Scheduling model (unified):
//     startDate / endDate       : canonical entry window
//     scheduledStartAt          : optional future auto-publish
//     startedAt                 : when actually went live
//     endedAt                   : when actually closed
//     launchedAt                : when first entry was accepted
//     pausedAt / resumedAt      : pause lifecycle
//     completedAt               : final completion timestamp
//     canceledAt                : cancellation timestamp
//     archivedAt                : archive timestamp (post-end lifecycle)
//
//   No soft delete on entries:
//     Entries are legal records under NDPR, GDPR, and contest/giveaway
//     law. They cannot be deleted. To remove an entry from public view,
//     set status = 'hidden' (hidden from leaderboards, public pages,
//     search). For long-term storage, set status = 'archived'. The row
//     itself is never removed. The campaign's ON DELETE CASCADE only
//     applies if the entire campaign is purged via legal/forensic
//     process — not via the application.
//
//   Cache counters on campaigns:
//     actualEntries, actualReferrals, conversionRate are denormalized
//     columns updated by background jobs. Avoids COUNT(*) on
//     campaign_entries in hot dashboard paths. Trade-off: brief
//     staleness is acceptable for analytics views.
//
//   Performance metrics on campaigns:
//     performanceScore, engagementRateBp, clickThroughRateBp are flat
//     columns for fast sort/filter in dashboards. Source of truth is
//     analytics_aggregates; these are denormalized snapshots.
//
//   Self-FK migration:
//     referrerEntryId and duplicateOf on campaign_entries are declared
//     as plain UUID columns here. The FK constraints are added in
//     migration 0002 because Drizzle cannot express same-table self-FKs
//     inside a single pgTable call.
//
//   Notifications split:
//     campaigns.notifications (toggles: what CAN be sent) → alert_rules
//     campaign_entries.notificationsSent (log: what WAS sent) — stays.
//     Each log entry links to alert_events for full delivery state
//     (sent, delivered, opened, clicked).
//
//   Prize value snapshot:
//     campaign_entries.prizeValue is a snapshot of the awarded prize
//     value at win time. Necessary because prizeTiers on the campaign
//     can change after the draw (e.g. prize substitution). The winner's
//     record reflects what they actually won.
//
//   Leaderboard via materialized view:
//     rank and percentile are NOT flat columns. Use the
//     campaign_leaderboard materialized view (created in migration 0002)
//     for fast leaderboard reads. Flat rank columns would require
//     O(N) updates per new entry — unacceptable at scale.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  decimal,
  jsonb,
  timestamp,
  date,
  inet,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  giveawayPlatformEnum,
  giveawayCampaignTypeEnum,
  giveawayCampaignStatusEnum,
  campaignEntryMethodTypeEnum,
  campaignEntryStatusEnum,
  winnerTierEnum,
  winnerStatusEnum,
  fraudRiskLevelEnum,
} from "../shared/enums";
import { users } from "../core";

// =============================================================================
// CAMPAIGNS
// =============================================================================

/**
 * Campaign/giveaway/sweepstakes definitions.
 *
 * Campaign types: standard, referral, multi_action, sweepstakes, contest,
 * giveaway, ugc, poll, quiz, custom.
 *
 * entryMethods JSONB — quick-read for form rendering:
 *   [{ methodType, config, points, isRequired, displayOrder }, ...]
 *
 * fraudRules JSONB:
 *   { maxEntriesPerUser, maxEntriesPerIP, recaptchaRequired,
 *     recaptchaMinScore, blockVpn, blockDisposableEmail, ... }
 *
 * branding JSONB:
 *   { primaryColor, secondaryColor, logoUrl, fontFamily }
 *
 * targetMetrics JSONB:
 *   { entries, referrals, conversions, socialFollowers, emailSubscribers }
 *
 * targeting JSONB (richer eligibility):
 *   { ageRange, genders, languages, interests, audiences,
 *     minimumFollowers, requiresHashtag, requiredHashtags, ... }
 *
 * contentGuidelines JSONB (UGC/contests):
 *   { themes, toneOfVoice, guidelines, requiredHashtags,
 *     bannedWords, approvalRequired, approvers }
 *
 * goals JSONB:
 *   [{ id, name, type, target, current, unit, priority, progress }, ...]
 *
 * landingPage JSONB:
 *   { enabled, customUrl, title, subtitle, heroImage,
 *     sections: [{ id, type, content, order }],
 *     faqs: [{ question, answer }] }
 *
 * privacy / moderation JSONBs:
 *   Per-campaign display and review toggles.
 *
 * trackingCodes JSONB:
 *   { googleAnalyticsId, facebookPixelId, utm*, customEvents }
 *
 * budget JSONB:
 *   { totalBudget, spent, prizesCost, currency, breakdown }
 *
 * winnerSelection JSONB:
 *   { method, judgesIds, votingStartDate, votingEndDate,
 *     votingPublic, instantWinProbability, pointsCalculation }
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Not FK — campaign data has regulatory retention
    organizationId: uuid("organization_id").notNull(),

    // ─── Basic Info ───────────────────────────────────────────────────────────
    name: text("name").notNull(),

    // URL-friendly slug — unique per org, used in public campaign URLs
    slug: text("slug").notNull(),

    // Public-facing title (may differ from internal name)
    title: text("title").notNull(),
    displayName: varchar("display_name", { length: 200 }),

    description: text("description").notNull(),
    shortDescription: varchar("short_description", { length: 500 }),

    campaignType: giveawayCampaignTypeEnum("campaign_type").notNull(),

    coverImageUrl: text("cover_image_url"),
    coverImage: text("cover_image"),
    color: varchar("color", { length: 7 }),
    backgroundColor: varchar("background_color", { length: 7 }),
    landingPageUrl: text("landing_page_url"),

    // Platforms this campaign runs on
    platforms: jsonb("platforms")
      .$type<
        Array<{
          platform: (typeof giveawayPlatformEnum.enumValues)[number];
          enabled: boolean;
          accountId?: string;
          accountHandle?: string;
          connectionId?: string;
        }>
      >()
      .default([])
      .notNull(),
    primaryPlatform: giveawayPlatformEnum("primary_platform"),
    targetPlatforms: text("target_platforms").array().notNull(),

    // ─── Entry Methods (denormalized) ─────────────────────────────────────────
    // Quick-read for form rendering; source of truth is
    // campaign_entry_methods. Service layer keeps both in sync.
    entryMethods: jsonb("entry_methods").notNull(),

    // ─── Prize Details (single-prize representation) ─────────────────────────
    // Used when prizeTiers is null. See chk_camp_prize_representation.
    prizeName: text("prize_name"),
    prizeDescription: text("prize_description"),
    prizeValue: bigint("prize_value", { mode: "number" }),
    prizeQuantity: integer("prize_quantity"),
    prizeImages: text("prize_images").array(),

    // Campaign-wide settings regardless of prize representation
    winnerCount: integer("winner_count").notNull(),
    shippingRequired: boolean("shipping_required").default(false).notNull(),

    // Multi-tier representation. Mutually exclusive with the flat columns.
    prizeTiers: jsonb("prize_tiers"),

    // ─── Schedule ─────────────────────────────────────────────────────────────
    // Canonical entry window — immutable after publish.
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),

    // IANA timezone — used to render countdowns and schedule auto-jobs.
    timezone: varchar("timezone", { length: 50 })
      .default("Africa/Lagos")
      .notNull(),

    // Optional scheduled publish (null = publish immediately on status change).
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),

    // Actual lifecycle timestamps (set by state transitions).
    startedAt: timestamp("started_at", { withTimezone: true }),

    // Distinct: scheduledEndAt is the planned end, endedAt is the actual.
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    // Auto management
    autoStart: boolean("auto_start").default(true).notNull(),
    autoEnd: boolean("auto_end").default(true).notNull(),

    // Pause/resume tracking
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedBy: uuid("paused_by").references(() => users.id, {
      onDelete: "set null",
    }),
    pauseReason: varchar("pause_reason", { length: 255 }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),

    // Completion
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionType: varchar("completion_type", { length: 50 }),

    // Cancellation
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledBy: uuid("canceled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),

    // ─── Entry Settings (flat — queryable) ────────────────────────────────────
    requiresApproval: boolean("requires_approval").default(false).notNull(),
    allowMultipleEntries: boolean("allow_multiple_entries")
      .default(false)
      .notNull(),
    maxEntriesPerUser: integer("max_entries_per_user").default(1).notNull(),
    entryLimit: integer("entry_limit").default(0).notNull(), // 0 = unlimited
    requireEmailVerification: boolean("require_email_verification")
      .default(false)
      .notNull(),
    requirePhoneVerification: boolean("require_phone_verification")
      .default(false)
      .notNull(),
    requiresAccount: boolean("requires_account").default(false).notNull(),

    // ─── Eligibility ──────────────────────────────────────────────────────────
    minimumAge: integer("minimum_age").default(18).notNull(),

    // ISO 3166-1 alpha-2 codes
    restrictedCountries: text("restricted_countries").array(),
    allowedCountries: text("allowed_countries").array(),
    allowedStates: text("allowed_states").array(),
    excludedStates: text("excluded_states").array(),

    // Richer targeting: ageRange, genders, languages, interests, hashtags, etc.
    targeting: jsonb("targeting")
      .$type<{
        ageRange?: [number, number];
        genders?: Array<string>;
        languages?: Array<string>;
        interests?: Array<string>;
        audiences?: Array<string>;
        minimumFollowers?: number;
        requiresHashtag?: boolean;
        requiredHashtags?: Array<string>;
        requiresMention?: boolean;
        requiredMentions?: Array<string>;
      }>()
      .default({})
      .notNull(),

    // Content guidelines for UGC/contests
    contentGuidelines: jsonb("content_guidelines")
      .$type<{
        themes?: Array<string>;
        toneOfVoice?: string;
        guidelines?: string;
        requiredHashtags?: Array<string>;
        bannedWords?: Array<string>;
        approvalRequired?: boolean;
        approvers?: Array<string>;
      }>()
      .default({})
      .notNull(),

    // ─── Legal ────────────────────────────────────────────────────────────────
    termsAndConditions: text("terms_and_conditions").notNull(),
    officialRules: text("official_rules").notNull(),
    privacyPolicyUrl: text("privacy_policy_url").notNull(),

    termsAcceptanceRequired: boolean("terms_acceptance_required")
      .default(true)
      .notNull(),
    officialRulesUrl: varchar("official_rules_url", { length: 500 }),

    // Nigeria Data Protection Regulation compliance
    ndprCompliant: boolean("ndpr_compliant").default(true).notNull(),
    gdprCompliant: boolean("gdpr_compliant").default(true).notNull(),

    requiresLegalReview: boolean("requires_legal_review")
      .default(false)
      .notNull(),
    legalReviewedAt: timestamp("legal_reviewed_at", { withTimezone: true }),
    legalReviewedBy: uuid("legal_reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ─── Winner Management ────────────────────────────────────────────────────
    // Whether the system auto-selects winners at drawDate
    autoDrawWinners: boolean("auto_draw_winners").default(false).notNull(),

    // When to draw winners
    drawDate: timestamp("draw_date", { withTimezone: true }),

    // Days a winner has to respond before forfeiture
    responseDeadlineDays: integer("response_deadline_days")
      .default(7)
      .notNull(),

    backupWinnerCount: integer("backup_winner_count").default(0).notNull(),

    // Selection config: method, judges, voting, instant-win probability
    winnerSelection: jsonb("winner_selection")
      .$type<{
        method?:
          | "random"
          | "manual"
          | "voting"
          | "points"
          | "first_come"
          | "instant_win"
          | "hybrid";
        judgesIds?: Array<string>;
        votingStartDate?: string;
        votingEndDate?: string;
        votingPublic?: boolean;
        instantWinProbability?: number;
        pointsCalculation?: {
          likes: number;
          comments: number;
          shares: number;
          views: number;
        };
      }>()
      .default({})
      .notNull(),

    // Draw/announce audit timestamps
    winnersDrawnAt: timestamp("winners_drawn_at", { withTimezone: true }),
    winnersAnnouncedAt: timestamp("winners_announced_at", {
      withTimezone: true,
    }),

    // ─── Fraud Prevention ─────────────────────────────────────────────────────
    // See JSDoc above
    fraudRules: jsonb("fraud_rules"),

    // ─── Status & Publishing ──────────────────────────────────────────────────
    status: giveawayCampaignStatusEnum("status").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // Distinct: publishedAt is admin publish, launchedAt is when first
    // entry was accepted.
    launchedAt: timestamp("launched_at", { withTimezone: true }),

    // ─── Branding ─────────────────────────────────────────────────────────────
    // See JSDoc above
    branding: jsonb("branding"),

    // ─── Targets ──────────────────────────────────────────────────────────────
    // See JSDoc above
    targetMetrics: jsonb("target_metrics"),

    // ─── Goals & KPIs ─────────────────────────────────────────────────────────
    goals: jsonb("goals")
      .$type<
        Array<{
          id: string;
          name: string;
          type:
            | "reach"
            | "engagement"
            | "clicks"
            | "conversions"
            | "followers"
            | "mentions"
            | "entries"
            | "participants"
            | "custom";
          target: number;
          current: number;
          unit: string;
          priority: "primary" | "secondary";
          progress: number;
        }>
      >()
      .default([])
      .notNull(),

    // ─── Landing Page ─────────────────────────────────────────────────────────
    landingPage: jsonb("landing_page")
      .$type<{
        enabled: boolean;
        customUrl?: string;
        title?: string;
        subtitle?: string;
        heroImage?: string;
        sections?: Array<{
          id: string;
          type:
            | "text"
            | "image"
            | "video"
            | "cta"
            | "faq"
            | "countdown"
            | "rules"
            | "prizes"
            | "leaderboard";
          content: unknown;
          order: number;
        }>;
        faqs?: Array<{ question: string; answer: string }>;
      }>()
      .default({ enabled: false })
      .notNull(),

    // ─── Privacy & Display ────────────────────────────────────────────────────
    privacy: jsonb("privacy")
      .$type<{
        showParticipantCount: boolean;
        showEntryCount: boolean;
        showLeaderboard: boolean;
        allowPublicVoting: boolean;
        displayWinners: boolean;
        collectPersonalInfo: boolean;
      }>()
      .default({
        showParticipantCount: true,
        showEntryCount: true,
        showLeaderboard: true,
        allowPublicVoting: false,
        displayWinners: true,
        collectPersonalInfo: false,
      })
      .notNull(),

    // ─── Moderation Settings ──────────────────────────────────────────────────
    moderation: jsonb("moderation")
      .$type<{
        autoModeration: boolean;
        profanityFilter: boolean;
        requiresReview: boolean;
        flagThreshold: number;
      }>()
      .default({
        autoModeration: true,
        profanityFilter: true,
        requiresReview: false,
        flagThreshold: 3,
      })
      .notNull(),

    // ─── Notification Toggles (moved to alert_rules) ──────────────────────────
    // REMOVED from this table. Each toggle (entryConfirmation,
    // approvalNotification, etc.) is now one alert_rules row with
    // source='campaign', audience='participant',
    // recipientMode='triggering_entity', watchedEntityIds=[this id].
    // See shared/alerts.ts.

    // ─── Tracking Codes ───────────────────────────────────────────────────────
    trackingCodes: jsonb("tracking_codes")
      .$type<{
        googleAnalyticsId?: string;
        facebookPixelId?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        customEvents?: Array<{ name: string; trigger: string }>;
      }>()
      .default({})
      .notNull(),

    // ─── Budget ───────────────────────────────────────────────────────────────
    budget: jsonb("budget")
      .$type<{
        totalBudget?: number;
        spent?: number;
        prizesCost?: number;
        promotionCost?: number;
        platformCost?: number;
        managementCost?: number;
        otherCosts?: number;
        currency: string;
        breakdown?: Record<string, number>;
      }>()
      .default({ currency: "NGN" })
      .notNull(),

    // ─── Performance Metrics (flat — for fast sort) ───────────────────────────
    // 0-100 composite; updated by background job from analytics_aggregates.
    performanceScore: integer("performance_score").default(0).notNull(),

    // 0-10000 basis points (0.00%-100.00%); avoid float for sortable indexes.
    engagementRateBp: integer("engagement_rate_bp").default(0).notNull(),
    clickThroughRateBp: integer("click_through_rate_bp").default(0).notNull(),

    // ─── Display Flags ────────────────────────────────────────────────────────
    isFeatured: boolean("is_featured").default(false).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    isTemplate: boolean("is_template").default(false).notNull(),

    // ─── Workflow ─────────────────────────────────────────────────────────────
    // Not FK — user may be deleted
    createdBy: uuid("created_by").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),

    // ─── Cache counters (denormalized) ────────────────────────────────────────
    actualEntries: integer("actual_entries").default(0).notNull(),
    actualReferrals: integer("actual_referrals").default(0).notNull(),

    // actualEntries / expected entries from targetMetrics
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }),

    // ─── Template Reference ───────────────────────────────────────────────────
    // Not FK — template may be deleted after campaign creation
    templateId: uuid("template_id"),

    // ─── Operations ───────────────────────────────────────────────────────────
    internalNotes: text("internal_notes"),
    publicNotes: text("public_notes"),
    metadata: jsonb("metadata")
      .$type<{
        source?: string;
        templateId?: string;
        clonedFrom?: string;
        version?: string;
        externalIds?: Record<string, string>;
        customFields?: Record<string, unknown>;
      }>()
      .default({})
      .notNull(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Soft archive (distinct from cancellation)
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // Slug unique per org
    unique("uq_campaigns_org_slug").on(table.organizationId, table.slug),

    // endDate must be after startDate
    check(
      "chk_camp_end_after_start",
      sql`${table.endDate} > ${table.startDate}`,
    ),

    // prizeValue must be positive (when set)
    check(
      "chk_camp_prize_value_positive",
      sql`${table.prizeValue} IS NULL OR ${table.prizeValue} > 0`,
    ),

    // prizeQuantity must be positive (when set)
    check(
      "chk_camp_prize_quantity_positive",
      sql`${table.prizeQuantity} IS NULL OR ${table.prizeQuantity} > 0`,
    ),

    // winnerCount must be positive
    check("chk_camp_winner_count_positive", sql`${table.winnerCount} > 0`),

    // winnerCount cannot exceed prizeQuantity (single-prize case only)
    check(
      "chk_camp_winner_count_lte_prize_quantity",
      sql`${table.prizeQuantity} IS NULL
        OR ${table.winnerCount} <= ${table.prizeQuantity}`,
    ),

    // Prize representation: either prizeTiers OR the three single-prize
    // columns must be populated. Prevents creating a campaign with no
    // prize information at all.
    check(
      "chk_camp_prize_representation",
      sql`${table.prizeTiers} IS NOT NULL
        OR (${table.prizeName} IS NOT NULL
          AND ${table.prizeValue} IS NOT NULL
          AND ${table.prizeQuantity} IS NOT NULL)`,
    ),

    // minimumAge must be >= 13
    check("chk_camp_minimum_age_range", sql`${table.minimumAge} >= 13`),

    // responseDeadlineDays must be positive
    check(
      "chk_camp_response_deadline_positive",
      sql`${table.responseDeadlineDays} > 0`,
    ),

    // backupWinnerCount must be non-negative
    check(
      "chk_camp_backup_winners_non_negative",
      sql`${table.backupWinnerCount} >= 0`,
    ),

    // actualEntries must be non-negative
    check(
      "chk_camp_actual_entries_non_negative",
      sql`${table.actualEntries} >= 0`,
    ),

    // actualReferrals must be non-negative
    check(
      "chk_camp_actual_referrals_non_negative",
      sql`${table.actualReferrals} >= 0`,
    ),

    // performanceScore must be 0-100
    check(
      "chk_camp_performance_score_range",
      sql`${table.performanceScore} BETWEEN 0 AND 100`,
    ),

    // engagementRateBp must be 0-10000 basis points
    check(
      "chk_camp_engagement_rate_range",
      sql`${table.engagementRateBp} BETWEEN 0 AND 10000`,
    ),

    // clickThroughRateBp must be 0-10000 basis points
    check(
      "chk_camp_ctr_range",
      sql`${table.clickThroughRateBp} BETWEEN 0 AND 10000`,
    ),

    // maxEntriesPerUser must be positive
    check("chk_camp_max_entries_positive", sql`${table.maxEntriesPerUser} > 0`),

    // entryLimit must be non-negative (0 = unlimited)
    check("chk_camp_entry_limit_non_negative", sql`${table.entryLimit} >= 0`),

    // drawDate must be after endDate (if set)
    check(
      "chk_camp_draw_after_end",
      sql`${table.drawDate} IS NULL
        OR ${table.drawDate} >= ${table.endDate}`,
    ),

    // drawDate required when autoDrawWinners = true
    check(
      "chk_camp_auto_draw_requires_date",
      sql`${table.autoDrawWinners} = FALSE
        OR ${table.drawDate} IS NOT NULL`,
    ),

    // publishedAt only when status is beyond draft
    check(
      "chk_camp_published_at_consistency",
      sql`${table.publishedAt} IS NULL
        OR ${table.status} NOT IN ('draft')`,
    ),

    // endedAt only when status is ended/cancelled/archived
    check(
      "chk_camp_ended_at_consistency",
      sql`${table.endedAt} IS NULL
        OR ${table.status} IN ('ended', 'cancelled', 'archived')`,
    ),

    // archivedAt only when status is archived/cancelled/ended
    check(
      "chk_camp_archived_at_consistency",
      sql`${table.archivedAt} IS NULL
        OR ${table.status} IN ('archived', 'cancelled', 'ended')`,
    ),

    // scheduledStartAt must be within the entry window
    check(
      "chk_camp_scheduled_start_before_end",
      sql`${table.scheduledStartAt} IS NULL
        OR ${table.scheduledStartAt} >= ${table.startDate}`,
    ),

    // completedAt must be after endedAt
    check(
      "chk_camp_completed_at_after_end",
      sql`${table.completedAt} IS NULL
        OR ${table.endedAt} IS NULL
        OR ${table.completedAt} >= ${table.endedAt}`,
    ),

    // resumedAt must be after pausedAt
    check(
      "chk_camp_resumed_after_paused",
      sql`${table.resumedAt} IS NULL
        OR ${table.pausedAt} IS NULL
        OR ${table.resumedAt} >= ${table.pausedAt}`,
    ),

    // pausedBy requires pausedAt
    check(
      "chk_camp_paused_by_requires_paused_at",
      sql`${table.pausedBy} IS NULL
        OR ${table.pausedAt} IS NOT NULL`,
    ),

    // canceledBy requires canceledAt
    check(
      "chk_camp_canceled_by_requires_canceled_at",
      sql`${table.canceledBy} IS NULL
        OR ${table.canceledAt} IS NOT NULL`,
    ),

    // legalReviewedBy requires legalReviewedAt
    check(
      "chk_camp_legal_reviewed_consistency",
      sql`${table.legalReviewedBy} IS NULL
        OR ${table.legalReviewedAt} IS NOT NULL`,
    ),

    // archivedBy requires archivedAt
    check(
      "chk_camp_archived_by_consistency",
      sql`${table.archivedBy} IS NULL
        OR ${table.archivedAt} IS NOT NULL`,
    ),

    // launchedAt must be at or after publishedAt
    check(
      "chk_camp_launched_after_published",
      sql`${table.launchedAt} IS NULL
        OR ${table.publishedAt} IS NULL
        OR ${table.launchedAt} >= ${table.publishedAt}`,
    ),

    // winnersDrawnAt must be at or after launchedAt
    check(
      "chk_camp_winners_drawn_after_launched",
      sql`${table.winnersDrawnAt} IS NULL
        OR ${table.launchedAt} IS NULL
        OR ${table.winnersDrawnAt} >= ${table.launchedAt}`,
    ),

    // winnersAnnouncedAt must be at or after winnersDrawnAt
    check(
      "chk_camp_winners_announced_after_drawn",
      sql`${table.winnersAnnouncedAt} IS NULL
        OR ${table.winnersDrawnAt} IS NULL
        OR ${table.winnersAnnouncedAt} >= ${table.winnersDrawnAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Org's campaigns — campaign list view
    index("idx_camp_org").on(table.organizationId),

    // Status filter — "show me active campaigns"
    index("idx_camp_status").on(table.organizationId, table.status),

    // Date range — "campaigns running this month"
    index("idx_camp_dates").on(table.startDate, table.endDate),

    // Slug lookup — public campaign URL resolution
    index("idx_camp_slug").on(table.organizationId, table.slug),

    // Org's campaigns of a type — admin filtering
    index("idx_camp_type_created").on(
      table.organizationId,
      table.campaignType,
      table.createdAt,
    ),

    // Created date — chronological listing
    index("idx_camp_created").on(table.organizationId, table.createdAt),

    // Published campaigns
    index("idx_camp_published").on(table.organizationId, table.publishedAt),

    // Assigned campaigns — team member workload view
    index("idx_camp_assigned").on(table.assignedTo),

    // Performance sort
    index("idx_camp_performance").on(
      table.organizationId,
      table.performanceScore,
    ),

    // Featured + public + active — public discovery query
    index("idx_camp_featured_public")
      .on(table.isFeatured, table.publishedAt)
      .where(
        sql`${table.isFeatured} = TRUE
          AND ${table.isPublic} = TRUE
          AND ${table.archivedAt} IS NULL`,
      ),

    // Auto-draw scheduling — background job finds campaigns due for drawing
    index("idx_camp_auto_draw")
      .on(table.drawDate)
      .where(
        sql`${table.autoDrawWinners} = TRUE
          AND ${table.status} = 'ended'
          AND ${table.drawDate} IS NOT NULL`,
      ),

    // Scheduled publish — background job finds campaigns due for publishing
    index("idx_camp_scheduled_start")
      .on(table.scheduledStartAt)
      .where(sql`${table.scheduledStartAt} IS NOT NULL`),

    // Templates
    index("idx_camp_templates")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.isTemplate} = TRUE`),

    // GIN indexes (raw SQL migration):
    // CREATE INDEX idx_camp_entry_methods ON campaigns USING GIN(entry_methods);
    // CREATE INDEX idx_camp_platforms ON campaigns USING GIN(platforms);
    // CREATE INDEX idx_camp_targeting ON campaigns USING GIN(targeting);
    // CREATE INDEX idx_camp_goals ON campaigns USING GIN(goals);
  ],
);

// =============================================================================
// CAMPAIGN ENTRIES
// =============================================================================

/**
 * Participant entries with fraud detection and winner lifecycle.
 *
 * Each row represents one person's participation in a campaign.
 * Uniqueness: (campaignId, lower(email)) — one entry per email per campaign.
 * entryNumber is globally unique for human-readable identification.
 *
 * Entry lifecycle:
 *   pending      — entry submitted, actions not yet verified
 *   verified     — all required actions verified
 *   partial      — some (but not all) required actions completed
 *   failed       — action verification failed
 *   disqualified — fraud detection flagged this entry
 *   winner       — selected as a winner
 *   duplicate    — detected as a duplicate entry
 *   referral     — entry created via referral
 *   hidden       — hidden from public view (NOT deleted — legal record)
 *   archived     — archived for long-term storage (NOT deleted)
 *
 * Winner lifecycle (when isWinner = true):
 *   pending   → notified → accepted → shipped → delivered
 *            ↘ forfeited (no response within deadline)
 *            ↘ expired (response deadline passed)
 *
 * Referral mechanics:
 *   referrerEntryId: the entry that referred this participant
 *   referralCode: unique code per campaign per entry (used in referral URL)
 *   referralCount: how many people entered using this code (denormalized)
 *
 * Completed actions JSONB:
 *   See module-level JSDoc for structure.
 *   Replaces the separate entry_actions table.
 *
 * Fraud signals:
 *   ipAddress, userAgent, deviceFingerprint: browser/device identification
 *   recaptchaScore: 0.00-1.00 from Google reCAPTCHA v3
 *   fraudScore: 0.00-1.00 composite fraud probability
 *   fraudRiskLevel: low/medium/high/critical
 *   fraudFlags: array of specific detections e.g. ['vpn_detected', 'duplicate_device']
 *
 * Winner fields:
 *   All winner-related fields are null when isWinner = false.
 *   When isWinner = true:
 *   - winnerTier: which prize tier
 *   - winnerSelectedAt: when the draw happened
 *   - selectionProof: cryptographic proof of fair selection
 *   - winnerStatus: fulfillment lifecycle
 *   - notifiedAt, responseDeadline, respondedAt: notification cycle
 *   - accepted, declineReason: acceptance/decline
 *   - shippingAddress, trackingNumber, carrier, shippedAt, deliveredAt: fulfillment
 *   - prizeClaimed, prizeClaimedAt, prizeValue: completion
 *
 * Legal record note:
 *   Entries are legal records under NDPR, GDPR, and contest/giveaway law.
 *   They are NEVER deleted. To hide an entry from public view, set
 *   status = 'hidden'. For long-term storage, set status = 'archived'.
 *   The row remains permanently for legal/audit purposes.
 */
export const campaignEntries = pgTable(
  "campaign_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Real FK to campaigns — CASCADE on delete
    // (Only invoked via legal/forensic campaign purge, not app layer)
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    // ─── Identity & Numbering ────────────────────────────────────────────────
    // Human-readable entry number (e.g. "ENT-2025-00001") for CS, receipts,
    // exports, and customer support lookups.
    entryNumber: varchar("entry_number", { length: 50 }).notNull().unique(),

    // ─── Entry Attributes ────────────────────────────────────────────────────
    status: campaignEntryStatusEnum("status").notNull(),

    // Where the entry originated: web, mobile_app, social, widget, api,
    // import, referral. Distinct from campaign.platforms (which are the
    // *target* platforms of the campaign, not the source of this entry).
    source: varchar("source", { length: 50 }).notNull().default("web"),

    // Type of content submitted: form, photo, video, text, link, social_post,
    // poll_response.
    contentType: varchar("content_type", { length: 50 })
      .notNull()
      .default("form"),

    // ─── Participant (flat columns — keep queryable) ─────────────────────────
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    phone: text("phone"),

    // ISO 3166-1 alpha-2
    country: text("country"),
    city: text("city"),
    state: text("state"),

    // Campaign-specific data e.g. { favoriteProduct: '...', whyJoin: '...' }
    customFields: jsonb("custom_fields"),

    // ─── Submission Content (UGC, photo, video, essay contests) ──────────────
    // {
    //   title?, description?, caption?, answer?, story?,
    //   images?: [{ url, thumbnailUrl, alt, caption, width, height }],
    //   videos?: [{ url, thumbnailUrl, title, duration, platform, embedCode }],
    //   links?:  [{ url, title, description }],
    //   socialPost?: { platform, postId, postUrl, permalink, embedCode, capturedAt },
    //   attachments?: [{ id, name, type, url, size }]
    // }
    submissionContent: jsonb("submission_content").default({}).notNull(),

    // Plain-text mirror for ILIKE / full-text search (populated by trigger).
    contentText: text("content_text"),

    // ─── Completed Actions (replaces entry_actions table) ─────────────────────
    // [
    //   { methodType, verificationStatus, pointsAwarded,
    //     verifiedAt, platformUserId }
    // ]
    completedActions: jsonb("completed_actions").default([]).notNull(),

    // ─── Requirements & Verification ─────────────────────────────────────────
    // Which campaign-defined requirements this entry has met.
    // {
    //   hasHashtag?, requiredHashtags?, hasMention?, requiredMentions?,
    //   followsAccount?, sharedPost?, taggedFriends?, minTaggedFriends?,
    //   completedQuiz?, quizScore?, minFollowers?,
    //   termsAccepted?, ageRequirement?, locationRequirement?
    // }
    requirementsMet: jsonb("requirements_met").default({}).notNull(),

    // Per-channel verification state. Richer than the flat booleans below.
    // {
    //   emailVerified, phoneVerified, socialAccountVerified,
    //   ageVerified, locationVerified, captchaVerified,
    //   duplicateCheck, fraudCheck, allChecksPassed
    // }
    verificationChecks: jsonb("verification_checks")
      .$type<{
        emailVerified: boolean;
        phoneVerified: boolean;
        socialAccountVerified: boolean;
        ageVerified: boolean;
        locationVerified: boolean;
        captchaVerified: boolean;
        duplicateCheck: boolean;
        fraudCheck: boolean;
        allChecksPassed: boolean;
      }>()
      .default({
        emailVerified: false,
        phoneVerified: false,
        socialAccountVerified: false,
        ageVerified: false,
        locationVerified: false,
        captchaVerified: false,
        duplicateCheck: true,
        fraudCheck: true,
        allChecksPassed: false,
      })
      .notNull(),

    // Per-channel verification booleans (hot path — flat for fast filtering).
    emailVerified: boolean("email_verified").default(false).notNull(),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    socialVerified: boolean("social_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    // ─── Scoring ─────────────────────────────────────────────────────────────
    // Total points from completed actions. Use the campaign_leaderboard
    // materialized view (migration 0002) for rank/percentile.
    pointsEarned: integer("points_earned").default(0).notNull(),

    // ─── Engagement Metrics (denormalized; updated by background job) ────────
    // {
    //   views, likes, comments, shares, votes, clicks,
    //   reactions: { emoji: count }, lastUpdated
    // }
    // Source: analytics_aggregates (dimension_2 = 'engagement')
    engagement: jsonb("engagement")
      .$type<{
        views: number;
        likes: number;
        comments: number;
        shares: number;
        votes: number;
        clicks: number;
        reactions: Record<string, number>;
        lastUpdated?: string;
      }>()
      .default({
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        votes: 0,
        clicks: 0,
        reactions: {},
      })
      .notNull(),

    // ─── Activity Timestamps ─────────────────────────────────────────────────
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    lastReferralAt: timestamp("last_referral_at", { withTimezone: true }),
    lastFraudCheckAt: timestamp("last_fraud_check_at", { withTimezone: true }),

    // ─── Moderation (flat — used in admin queues) ────────────────────────────
    // Independent of the main status field. status = 'verified' may still
    // have moderationStatus = 'flagged' for content review.
    moderationStatus: varchar("moderation_status", { length: 50 })
      .notNull()
      .default("not_reviewed"),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),

    // 0-100 quality score (lower = worse). For sort/filter in review queues.
    moderationScore: integer("moderation_score").default(100).notNull(),

    // AI/automated moderation detections. Audit record of what the
    // moderation engine flagged. The moderation engine may recompute
    // these on demand; this is the historical record.
    // [{ type, severity, confidence, details, detectedAt }]
    autoModerationFlags: jsonb("auto_moderation_flags")
      .$type<
        Array<{
          type:
            | "profanity"
            | "spam"
            | "inappropriate"
            | "duplicate"
            | "suspicious"
            | "quality";
          severity: "low" | "medium" | "high";
          confidence: number;
          details?: string;
          detectedAt: string;
        }>
      >()
      .default([])
      .notNull(),

    // ─── Submission Context ──────────────────────────────────────────────────
    // {
    //   ipAddress, userAgent,
    //   device?: { type, os, browser },
    //   location?: { city, region, country, coordinates: { lat, lng } },
    //   referrer, utmParams: { source, medium, campaign, term, content },
    //   sessionId, language, timezone
    // }
    submissionContext: jsonb("submission_context")
      .$type<{
        ipAddress?: string;
        userAgent?: string;
        device?: {
          type: "mobile" | "tablet" | "desktop";
          os?: string;
          browser?: string;
        };
        location?: {
          city?: string;
          region?: string;
          country?: string;
          coordinates?: { latitude: number; longitude: number };
        };
        referrer?: string;
        utmParams?: {
          source?: string;
          medium?: string;
          campaign?: string;
          term?: string;
          content?: string;
        };
        sessionId?: string;
        language?: string;
        timezone?: string;
      }>()
      .default({})
      .notNull(),

    // ─── Fraud Signals (top-level for fast filtering) ────────────────────────
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    deviceFingerprint: text("device_fingerprint"),

    // 0.00-1.00 reCAPTCHA v3 score
    recaptchaScore: decimal("recaptcha_score", { precision: 3, scale: 2 }),

    // 0.00-1.00 composite fraud probability
    fraudScore: decimal("fraud_score", { precision: 3, scale: 2 }),

    fraudRiskLevel: fraudRiskLevelEnum("fraud_risk_level")
      .default("low")
      .notNull(),

    // Array of specific fraud flags
    fraudFlags: text("fraud_flags").array(),

    // ─── Duplicate Detection ──────────────────────────────────────────────────
    isDuplicate: boolean("is_duplicate").default(false).notNull(),
    duplicateReason: varchar("duplicate_reason", { length: 255 }),

    // Self-FK to the entry this was identified as a duplicate of.
    // FK constraint added in migration 0002 (same-table self-FK).
    duplicateOf: uuid("duplicate_of"),

    // List of similar entry IDs (from fuzzy matching). Soft hint, not a
    // source of truth — recomputed by the fraud engine.
    similarEntries: jsonb("similar_entries")
      .$type<Array<string>>()
      .default([])
      .notNull(),

    // ─── Referral Tracking ────────────────────────────────────────────────────
    // Self-referential. FK added in migration 0002 (same-table self-FK).
    referrerEntryId: uuid("referrer_entry_id"),
    referralCode: text("referral_code").notNull(),
    referralCount: integer("referral_count").default(0).notNull(),

    // ─── Compliance & Legal (participant consent) ────────────────────────────
    // NDPR/GDPR consent records captured at submission. Required for the
    // legal record retention. Even after the entry is hidden/archived,
    // this consent record must be preserved.
    // {
    //   termsAccepted, termsAcceptedAt, termsVersion,
    //   privacyAccepted, privacyAcceptedAt,
    //   ageConfirmed, parentalConsent?,
    //   marketingOptIn?, dataProcessingConsent?,
    //   ipAddress
    // }
    compliance: jsonb("compliance")
      .$type<{
        termsAccepted: boolean;
        termsAcceptedAt?: string;
        termsVersion?: string;
        privacyAccepted: boolean;
        privacyAcceptedAt?: string;
        ageConfirmed: boolean;
        parentalConsent?: boolean;
        marketingOptIn?: boolean;
        dataProcessingConsent?: boolean;
        ipAddress?: string;
      }>()
      .default({
        termsAccepted: false,
        privacyAccepted: false,
        ageConfirmed: false,
      })
      .notNull(),

    // ─── Notification Delivery Log ────────────────────────────────────────────
    // Per-entry history of what was actually sent. The TOGGLES of what CAN
    // be sent moved to alert_rules (shared/alerts.ts); this stays because
    // it links to alert_events for delivery state (sent, delivered,
    // opened, clicked). Each element is one fired send.
    notificationsSent: jsonb("notifications_sent")
      .$type<
        Array<{
          type:
            | "confirmation"
            | "approval"
            | "rejection"
            | "winner"
            | "reminder";
          channel: "email" | "sms" | "push" | "in_app";
          sentAt: string;
          delivered: boolean;
          opened?: boolean;
          clicked?: boolean;
          // alertEventId references shared/alert_events.id for join
          alertEventId?: string;
        }>
      >()
      .default([])
      .notNull(),

    // ─── Winner Fields ────────────────────────────────────────────────────────
    isWinner: boolean("is_winner").default(false).notNull(),
    isBackupWinner: boolean("is_backup_winner").default(false).notNull(),
    winnerTier: winnerTierEnum("winner_tier"),
    winnerSelectedAt: timestamp("winner_selected_at", { withTimezone: true }),
    selectionProof: text("selection_proof"),
    selectionMethod: text("selection_method"),

    // ─── Winner Lifecycle ─────────────────────────────────────────────────────
    winnerStatus: winnerStatusEnum("winner_status"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    responseDeadline: timestamp("response_deadline", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    accepted: boolean("accepted"),
    declineReason: text("decline_reason"),

    // Separate from notifiedAt — winner clicks "I confirm receipt" button.
    winnerConfirmed: boolean("winner_confirmed").default(false).notNull(),
    winnerConfirmedAt: timestamp("winner_confirmed_at", { withTimezone: true }),

    // ─── Prize Fulfillment ────────────────────────────────────────────────────
    shippingAddress: jsonb("shipping_address"),
    taxFormUrl: text("tax_form_url"),
    affidavitUrl: text("affidavit_url"),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    prizeClaimed: boolean("prize_claimed").default(false).notNull(),
    prizeClaimedAt: timestamp("prize_claimed_at", { withTimezone: true }),

    // Prize value snapshot at win time. Necessary because prizeTiers
    // on the campaign can change after the draw (e.g. prize substitution).
    prizeValue: bigint("prize_value", { mode: "number" }),

    // ─── Operations ───────────────────────────────────────────────────────────
    internalNotes: text("internal_notes"),
    tags: jsonb("tags").$type<Array<string>>().default([]).notNull(),
    metadata: jsonb("metadata")
      .$type<{
        importId?: string;
        batchId?: string;
        source?: string;
        customFields?: Record<string, unknown>;
      }>()
      .default({})
      .notNull(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    // Distinct from createdAt: imports and retries may have submission
    // times earlier than the row creation time.
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),

    // NOTE: No soft delete columns. Entries are legal records and are
    // never deleted. Use status = 'hidden' or 'archived' to remove
    // from public view while preserving the legal record.
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────
    unique("uq_entries_entry_number").on(table.entryNumber),
    unique("uq_entries_campaign_referral").on(
      table.campaignId,
      table.referralCode,
    ),

    // One entry per email per campaign.
    // JSONB path unique index (added in migration 0002):
    //   CREATE UNIQUE INDEX uq_entries_campaign_email
    //     ON campaign_entries (campaign_id, lower(email));
    // (No partial filter — entries are never deleted.)

    check("chk_entry_points_non_negative", sql`${table.pointsEarned} >= 0`),
    check(
      "chk_entry_referral_count_non_negative",
      sql`${table.referralCount} >= 0`,
    ),
    check(
      "chk_entry_moderation_score_range",
      sql`${table.moderationScore} BETWEEN 0 AND 100`,
    ),
    check(
      "chk_entry_recaptcha_range",
      sql`${table.recaptchaScore} IS NULL
        OR ${table.recaptchaScore} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_entry_fraud_score_range",
      sql`${table.fraudScore} IS NULL
        OR ${table.fraudScore} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_entry_no_self_referral",
      sql`${table.referrerEntryId} IS NULL
        OR ${table.referrerEntryId} <> ${table.id}`,
    ),
    check(
      "chk_entry_no_self_duplicate",
      sql`${table.duplicateOf} IS NULL
        OR ${table.duplicateOf} <> ${table.id}`,
    ),

    // Winner fields consistency
    check(
      "chk_entry_winner_tier_consistency",
      sql`${table.isWinner} = FALSE OR ${table.winnerTier} IS NOT NULL`,
    ),
    check(
      "chk_entry_winner_status_consistency",
      sql`${table.isWinner} = FALSE OR ${table.winnerStatus} IS NOT NULL`,
    ),
    check(
      "chk_entry_winner_selected_at_consistency",
      sql`${table.isWinner} = FALSE
        OR ${table.winnerSelectedAt} IS NOT NULL`,
    ),

    // Backup winner implies winner
    check(
      "chk_entry_backup_implies_winner",
      sql`${table.isBackupWinner} = FALSE OR ${table.isWinner} = TRUE`,
    ),

    // Notification confirmation
    check(
      "chk_entry_winner_confirmed_consistency",
      sql`(${table.winnerConfirmed} = FALSE
          AND ${table.winnerConfirmedAt} IS NULL)
        OR (${table.winnerConfirmed} = TRUE
          AND ${table.winnerConfirmedAt} IS NOT NULL)`,
    ),

    // Fulfillment chain
    check(
      "chk_entry_delivered_after_shipped",
      sql`${table.deliveredAt} IS NULL
        OR ${table.shippedAt} IS NULL
        OR ${table.deliveredAt} >= ${table.shippedAt}`,
    ),
    check(
      "chk_entry_prize_claimed_consistency",
      sql`(${table.prizeClaimed} = FALSE
          AND ${table.prizeClaimedAt} IS NULL)
        OR (${table.prizeClaimed} = TRUE
          AND ${table.prizeClaimedAt} IS NOT NULL)`,
    ),

    // Response cycle
    check(
      "chk_entry_decline_reason_consistency",
      sql`${table.declineReason} IS NULL
        OR ${table.accepted} = FALSE`,
    ),
    check(
      "chk_entry_responded_after_notified",
      sql`${table.respondedAt} IS NULL
        OR ${table.notifiedAt} IS NOT NULL`,
    ),
    check(
      "chk_entry_response_deadline_after_notified",
      sql`${table.responseDeadline} IS NULL
        OR ${table.notifiedAt} IS NULL
        OR ${table.responseDeadline} >= ${table.notifiedAt}`,
    ),

    // Duplicate state
    check(
      "chk_entry_duplicate_consistency",
      sql`(${table.isDuplicate} = FALSE
          AND ${table.duplicateReason} IS NULL)
        OR (${table.isDuplicate} = TRUE
          AND ${table.duplicateReason} IS NOT NULL)`,
    ),

    // Hidden/archived entries must have been created before being marked
    // (cannot set terminal status on a row that doesn't exist yet)
    check(
      "chk_entry_terminal_status_has_submitted_at",
      sql`${table.status} NOT IN ('hidden', 'archived')
        OR ${table.submittedAt} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_entry_entry_number").on(table.entryNumber),
    index("idx_entry_campaign_submitted").on(
      table.campaignId,
      table.submittedAt,
    ),
    index("idx_entry_campaign_status").on(
      table.campaignId,
      table.status,
      table.submittedAt,
    ),
    index("idx_entry_email").on(table.email),
    index("idx_entry_source").on(table.campaignId, table.source),
    index("idx_entry_content_type").on(table.campaignId, table.contentType),

    // Moderation queue
    index("idx_entry_pending_moderation")
      .on(table.campaignId, table.submittedAt)
      .where(
        sql`moderation_status = 'not_reviewed'
          AND status = 'pending'
          AND status NOT IN ('hidden', 'archived')`,
      ),

    // Scoring (leaderboard via materialized view, not flat columns)
    index("idx_entry_points").on(table.campaignId, table.pointsEarned),

    // Fraud
    index("idx_entry_fraud_score").on(table.campaignId, table.fraudScore),
    index("idx_entry_fraud")
      .on(table.campaignId, table.fraudRiskLevel)
      .where(sql`fraud_risk_level IN ('high', 'critical')`),

    // Duplicate
    index("idx_entry_duplicate")
      .on(table.campaignId, table.isDuplicate)
      .where(sql`${table.isDuplicate} = TRUE`),
    index("idx_entry_duplicate_of").on(table.duplicateOf),

    // Winner
    index("idx_entry_winner")
      .on(table.campaignId, table.winnerSelectedAt)
      .where(sql`${table.isWinner} = TRUE`),
    index("idx_entry_winner_fulfillment")
      .on(table.campaignId, table.winnerStatus)
      .where(
        sql`${table.isWinner} = TRUE
          AND ${table.winnerStatus} IN ('accepted', 'shipped')`,
      ),
    index("idx_entry_response_deadline")
      .on(table.responseDeadline)
      .where(
        sql`${table.isWinner} = TRUE
          AND ${table.winnerStatus} = 'notified'
          AND ${table.respondedAt} IS NULL`,
      ),
    index("idx_entry_prize_claimed")
      .on(table.campaignId, table.prizeClaimed)
      .where(sql`${table.prizeClaimed} = TRUE`),
    index("idx_entry_backup_winner")
      .on(table.campaignId, table.winnerSelectedAt)
      .where(sql`${table.isBackupWinner} = TRUE`),

    // Referral
    index("idx_entry_referral_count")
      .on(table.campaignId, table.referralCount)
      .where(sql`${table.referralCount} > 0`),
    index("idx_entry_referrer")
      .on(table.referrerEntryId)
      .where(sql`${table.referrerEntryId} IS NOT NULL`),

    // Hidden/archived filtering
    index("idx_entry_hidden")
      .on(table.campaignId, table.status)
      .where(sql`status IN ('hidden', 'archived')`),

    // GIN indexes (raw SQL migration 0002):
    // CREATE INDEX idx_entry_submission_content
    //   ON campaign_entries USING GIN(submission_content);
    // CREATE INDEX idx_entry_completed_actions
    //   ON campaign_entries USING GIN(completed_actions);
    // CREATE INDEX idx_entry_requirements_met
    //   ON campaign_entries USING GIN(requirements_met);
    // CREATE INDEX idx_entry_engagement
    //   ON campaign_entries USING GIN(engagement);
    // CREATE INDEX idx_entry_tags
    //   ON campaign_entries USING GIN(tags);
    // CREATE INDEX idx_entry_auto_moderation_flags
    //   ON campaign_entries USING GIN(auto_moderation_flags);
  ],
);

// =============================================================================
// CAMPAIGN ENTRY METHODS
// =============================================================================

/**
 * Entry action definitions per campaign.
 *
 * Each method type defines one action participants can perform:
 *   follow:          follow a social account
 *   like:            like a social post
 *   comment:         comment on a social post
 *   share:           share/retweet a social post
 *   tag_friends:     tag N friends in a comment
 *   visit_website:   visit a URL (verified via redirect tracking)
 *   email_subscribe: subscribe to email list
 *   refer_friend:    share referral link (verified when referee enters)
 *   custom:          custom action defined by methodConfig
 *   purchase:        purchase a product (verified via order matching)
 *   review:          leave a product/service review
 *
 * methodConfig JSONB — varies by methodType:
 *   follow:  { platform: 'instagram', handle: '@brand' }
 *   like:    { platform: 'twitter_x', postUrl: 'https://...' }
 *   comment: { platform: 'instagram', postUrl: 'https://...', minLength: 10 }
 *   share:   { platform: 'twitter_x', postUrl: 'https://...', requiredText: '...' }
 *   tag_friends: { platform: 'instagram', postUrl: '...', minTags: 3 }
 *   visit_website: { url: 'https://...', minTimeSeconds: 10 }
 *   email_subscribe: { listId: 'list_123', doubleOptIn: true }
 *   refer_friend: { bonusPoints: 3 }
 *   custom: { label: 'Watch Video', verificationUrl: 'https://...' }
 *   purchase: { minAmount: 5000, productIds: [...] }
 *   review: { platform: 'google', minLength: 50 }
 *
 * Points:
 *   1-50 range enforced by CHECK constraint.
 *   Points are awarded when verificationStatus = 'verified' in
 *   the entry's completedActions array.
 *
 * isRequired:
 *   If true, the entry cannot reach 'verified' status without this action.
 *   If false, the action is optional (bonus points only).
 *
 * UI fields (icon, buttonText, helpText):
 *   Used by the public entry form renderer. Decoupled from the
 *   verification logic so brand wording can change without touching
 *   methodConfig.
 *
 * Verification flow:
 *   verificationTimeout: seconds the participant has to complete the action
 *   verificationRetries: how many retry attempts before marking failed
 */
export const campaignEntryMethods = pgTable(
  "campaign_entry_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Real FK to campaigns — CASCADE on delete
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    // ─── Method Definition ────────────────────────────────────────────────────
    methodType: campaignEntryMethodTypeEnum("method_type").notNull(),

    // Platform/action-specific configuration (see JSDoc above)
    methodConfig: jsonb("method_config").notNull(),

    // Points awarded when this action is verified
    points: integer("points").notNull(),

    // Whether this action is mandatory for entry verification
    isRequired: boolean("is_required").default(false).notNull(),

    // UI display order (ascending)
    displayOrder: integer("display_order").notNull(),

    // Maximum times a participant can repeat this action (null = once)
    maxActionsPerEntry: integer("max_actions_per_entry"),

    // ─── UI affordances ───────────────────────────────────────────────────────
    // Visual identifier for the entry form (lucide/heroicon name or URL).
    icon: varchar("icon", { length: 100 }),

    // CTA copy shown on the action button.
    buttonText: varchar("button_text", { length: 100 }),

    // Helper text shown beneath the action.
    helpText: text("help_text"),

    // ─── Verification flow ────────────────────────────────────────────────────
    // Seconds the participant has to complete the action before it times out.
    verificationTimeout: integer("verification_timeout"),

    // Number of retry attempts before the action is marked failed.
    verificationRetries: integer("verification_retries").default(3).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // points must be 1-50
    check("chk_cem_points_range", sql`${table.points} BETWEEN 1 AND 50`),

    // displayOrder must be positive
    check("chk_cem_display_order_positive", sql`${table.displayOrder} > 0`),

    // maxActionsPerEntry must be positive (if set)
    check(
      "chk_cem_max_actions_positive",
      sql`${table.maxActionsPerEntry} IS NULL
        OR ${table.maxActionsPerEntry} > 0`,
    ),

    // verificationTimeout must be positive (if set)
    check(
      "chk_cem_verification_timeout_positive",
      sql`${table.verificationTimeout} IS NULL
        OR ${table.verificationTimeout} > 0`,
    ),

    // verificationRetries must be non-negative
    check(
      "chk_cem_verification_retries_non_negative",
      sql`${table.verificationRetries} >= 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Campaign's entry methods in display order
    index("idx_cem_campaign").on(table.campaignId, table.displayOrder),

    // Campaign's entry methods of a given type
    index("idx_cem_campaign_type").on(table.campaignId, table.methodType),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  // Entry methods for this campaign
  entryMethods: many(campaignEntryMethods, {
    relationName: "campaign_entryMethods",
  }),

  // Participant entries
  entries: many(campaignEntries, {
    relationName: "campaign_entries",
  }),

  // Cross-module references (resolved at application layer):
  //   templateId → templates.id (shared/templates.ts)
  //   mediaGallery (banner/prize/etc.) → media_assets WHERE
  //     attached_to_type = 'campaign' AND attached_to_id = this.id
  //   notifications (toggles) → alert_rules WHERE source = 'campaign'
  //     AND audience = 'participant'
  //   Daily stats → analytics_aggregates WHERE dimension_1 = this.id
  //     AND dimension_2 = 'campaign'
}));

export const campaignEntriesRelations = relations(
  campaignEntries,
  ({ one, many }) => ({
    // The campaign this entry belongs to
    campaign: one(campaigns, {
      fields: [campaignEntries.campaignId],
      references: [campaigns.id],
      relationName: "campaign_entries",
    }),

    // Moderation audit FK
    reviewedByUser: one(users, {
      fields: [campaignEntries.reviewedBy],
      references: [users.id],
      relationName: "entry_reviewed_by",
    }),

    // Self-referential referral chain
    referrerEntry: one(campaignEntries, {
      fields: [campaignEntries.referrerEntryId],
      references: [campaignEntries.id],
      relationName: "entry_referrals",
    }),

    // Entries referred by this entry
    referredEntries: many(campaignEntries, {
      relationName: "entry_referrals",
    }),

    // Self-referential duplicate lineage
    duplicateOfEntry: one(campaignEntries, {
      fields: [campaignEntries.duplicateOf],
      references: [campaignEntries.id],
      relationName: "entry_duplicates",
    }),
  }),
);

export const campaignEntryMethodsRelations = relations(
  campaignEntryMethods,
  ({ one }) => ({
    // The campaign this entry method belongs to
    campaign: one(campaigns, {
      fields: [campaignEntryMethods.campaignId],
      references: [campaigns.id],
      relationName: "campaign_entryMethods",
    }),
  }),
);
