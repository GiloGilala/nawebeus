// db/schema/influencer/index.ts
//
// Influencer module — v4 (consolidated + enterprise-hardened).
//
// Tables (5):
//   influencers                     — influencer profiles (detail table, FK to contacts)
//   influencer_programs            — program planning, budgeting, KPI tracking
//   influencer_program_assignments — influencer ↔ program contracts and performance
//   influencer_content_submissions  — deliverable submissions with compliance checks
//   payments                        — installment / refund transactions
//
// Tables removed → shared modules:
//   influencerInteractions       → shared/contacts.ts (contact_interactions)
//   influencerAccounts           → deferred (per-platform metrics; build when
//                                 fetching from APIs becomes a feature)
//   influencerMetricsHistory     → deferred (follower count changes tracked in
//                                 analytics_aggregates with granularity='daily')
//   audienceDemographics         → deferred (build when third-party audience
//                                 insights integration ships)
//   influencerContracts          → contracts stored in media_assets +
//                                 assignment-level metadata for v1
//   influencer_negotiations      → contact_interactions WHERE type='negotiation'

// handles JSONB (strict shape):
//   {
//     twitter_x:    '@handle',   // optional
//     instagram:    '@handle',   // optional
//     tiktok:       '@handle',   // optional
//     youtube:      '@handle',   // optional
//     facebook:     '@handle',   // optional
//     linkedin:     '@handle',   // optional
//     threads:      '@handle'    // optional
//   }
//
// Design decisions:
//
//   Shared-PK contact inheritance:
//     influencers.id is a FK to contacts.id (shared/contacts.ts).
//     The contacts base table holds: fullName, email, phone, whatsapp,
//     isActive, organizationId, kind = 'influencer'.
//
//   payments table (added in v4):
//     The single feeNaira/advanceNaira/paymentStatus fields on assignments
//     could not capture multi-installment payments, refunds, or per-
//     transaction audit trails. A separate payments table is the only
//     way to support advance + milestone + final + bonus + refund with
//     proper accounting.
//
//   Denormalized deliverables count DROPPED:
//     deliverablesTotal and deliverablesFulfilled on assignments were
//     denormalized from the JSONB deliverables array. They drift and
//     can be derived from COUNT(*) on influencer_content_submissions
//     WHERE status IN ('approved', 'published'). Removed.
//
//   Blacklist metadata on influencers:
//     status = 'blacklisted' requires blacklistedAt + blacklistedReason +
//     blacklistedBy. The reason field is required for compliance audit
//     and for reactivation workflows.
//
//   AI analysis + review checklist as JSONB:
//     aiAnalysis (caption quality, NSFW, OCR, etc.) and reviewChecklist
//     (logo visible, hashtags correct, music licensed) are both
//     snapshots from single AI/review pipeline calls. They are not
//     individually queryable — the structured fields (brandSafetyScore,
//     sentimentScore, prohibitedKeywordsFound) remain for filtering.
//
//   Coupon / tracking on assignments, UTM on programs:
//     couponCode, trackingUrl, affiliateLink are per-influencer (assigned).
//     utmCampaign is per-program. utmSource can be overridden per-
//     influencer for attribution.
//
//   No soft delete on assignments or submissions:
//     Assignments are contract records (financial value).
//     Submissions are compliance records (APCON). They are never
//     deleted — only status-flagged. Influencers inherit isActive
//     from contacts (boolean, not deletedAt).
//
//   No revision chain self-FK (yet):
//     Revisions are linear (revisionNumber monotonically increases per
//     assignment). To reconstruct the chain:
//       SELECT * FROM influencer_content_submissions
//       WHERE assignment_id = $1
//       ORDER BY revision_number ASC
//     If branching is needed (parallel drafts), add previousSubmissionId
//     self-FK.

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { contacts } from "../shared/contacts";
import {
  influencerAssignmentStatusEnum,
  influencerContentStatusEnum,
  influencerContentTypeEnum,
  influencerPaymentStatusEnum,
  influencerProgramStatusEnum,
  influencerProgramTypeEnum,
  influencerStatusEnum,
  influencerTierEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from "../shared/enums";

// =============================================================================
// INFLUENCERS
// =============================================================================

export const influencers = pgTable(
  "influencers",
  {
    // PK = FK to contacts.id (shared-PK inheritance)
    id: varchar("id", { length: 64 })
      .notNull()
      .primaryKey()
      .references(() => contacts.id, { onDelete: "cascade" }),

    // ─── Primary Platform ─────────────────────────────────────────────────────
    primaryPlatform: varchar("primary_platform", { length: 20 }).notNull(),
    platformUserId: varchar("platform_user_id", { length: 255 }),
    usernamePrimary: varchar("username_primary", { length: 100 }).notNull(),
    handles: jsonb("handles"),
    socialUrls: jsonb("social_urls"),

    // ─── Profile ──────────────────────────────────────────────────────────────
    bio: text("bio"),
    categories: text("categories").array(),
    location: text("location"),
    nigerianState: varchar("nigerian_state", { length: 50 }),

    // ─── Verification ────────────────────────────────────────────────────────
    // Platform API verification (e.g. Instagram verified badge) vs. our own
    // internal verification (manual review, agency-confirmed identity)
    verified: boolean("verified").default(false).notNull(),

    // 'manual' | 'platform_api' | 'creator_signed' | 'agency_verified'
    verificationMethod: varchar("verification_method", { length: 30 }),

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    // Not FK — user may be deleted
    verifiedBy: varchar("verified_by", { length: 32 }),

    // ─── Audience Snapshot ───────────────────────────────────────────────────
    // Single field for Nigerian audience share. Richer audience demographics
    // (gender/age/geo/interests) deferred until third-party audience
    // insights integration ships.
    audienceNigerianPercent: decimal("audience_nigerian_percent", {
      precision: 5,
      scale: 2,
    }),

    // ─── Demographics (basic) ────────────────────────────────────────────────
    gender: varchar("gender", { length: 20 }),
    ageRange: varchar("age_range", { length: 20 }),

    // ─── Primary Platform Metrics ─────────────────────────────────────────────
    followerCount: integer("follower_count").default(0).notNull(),
    engagementRate: decimal("engagement_rate", { precision: 6, scale: 4 }),
    averageLikes: integer("average_likes").default(0),
    averageComments: integer("average_comments").default(0),
    averageShares: integer("average_shares").default(0),
    averageViews: integer("average_views").default(0),

    // ─── Scoring (all 0–100) ──────────────────────────────────────────────────
    influenceScore: decimal("influence_score", { precision: 5, scale: 2 }).default("0").notNull(),
    authenticityScore: decimal("authenticity_score", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    fraudScore: decimal("fraud_score", { precision: 5, scale: 2 }).default("0").notNull(),
    brandSafetyScore: decimal("brand_safety_score", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    relationshipScore: decimal("relationship_score", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),

    // ─── Tier ─────────────────────────────────────────────────────────────────
    tier: influencerTierEnum("tier"),

    // ─── Rates (all in Nigerian Naira) ────────────────────────────────────────
    typicalRatePostNaira: numeric("typical_rate_post_naira", {
      precision: 15,
      scale: 2,
    }),
    typicalRateReelNaira: numeric("typical_rate_reel_naira", {
      precision: 15,
      scale: 2,
    }),
    typicalRateStoryNaira: numeric("typical_rate_story_naira", {
      precision: 15,
      scale: 2,
    }),
    typicalRateVideoNaira: numeric("typical_rate_video_naira", {
      precision: 15,
      scale: 2,
    }),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Status & Lifecycle ───────────────────────────────────────────────────
    status: influencerStatusEnum("status").default("active").notNull(),

    // Blacklist metadata (required when status = 'blacklisted')
    blacklistedAt: timestamp("blacklisted_at", { withTimezone: true }),
    blacklistedReason: text("blacklisted_reason"),
    blacklistedBy: varchar("blacklisted_by", { length: 32 }),

    // ─── Denormalized Program Metrics ────────────────────────────────────────
    programCount: integer("campaign_count").default(0).notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),

    // ─── CRM & Discovery ──────────────────────────────────────────────────────
    tags: text("tags").array(),
    notes: text("notes"),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_inf_follower_count_non_negative", sql`${table.followerCount} >= 0`),
    check(
      "chk_inf_engagement_rate_range",
      sql`${table.engagementRate} IS NULL
        OR ${table.engagementRate} BETWEEN 0 AND 1`,
    ),
    check("chk_inf_influence_score_range", sql`${table.influenceScore} BETWEEN 0 AND 100`),
    check("chk_inf_authenticity_score_range", sql`${table.authenticityScore} BETWEEN 0 AND 100`),
    check("chk_inf_fraud_score_range", sql`${table.fraudScore} BETWEEN 0 AND 100`),
    check("chk_inf_brand_safety_score_range", sql`${table.brandSafetyScore} BETWEEN 0 AND 100`),
    check("chk_inf_relationship_score_range", sql`${table.relationshipScore} BETWEEN 0 AND 100`),
    check(
      "chk_inf_audience_nigerian_range",
      sql`${table.audienceNigerianPercent} IS NULL
        OR ${table.audienceNigerianPercent} BETWEEN 0 AND 100`,
    ),
    check(
      "chk_inf_average_rating_range",
      sql`${table.averageRating} IS NULL
        OR ${table.averageRating} BETWEEN 1 AND 5`,
    ),
    check("chk_inf_program_count_non_negative", sql`${table.programCount} >= 0`),

    // Blacklist consistency: if status = 'blacklisted', all three required
    check(
      "chk_inf_blacklist_consistency",
      sql`${table.status} <> 'blacklisted'
        OR (${table.blacklistedAt} IS NOT NULL
            AND ${table.blacklistedReason} IS NOT NULL
            AND ${table.blacklistedBy} IS NOT NULL)`,
    ),

    // Verification consistency
    check(
      "chk_inf_verified_consistency",
      sql`(${table.verified} = FALSE)
        OR (${table.verifiedAt} IS NOT NULL
            AND ${table.verificationMethod} IS NOT NULL)`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_inf_influence_score").on(table.influenceScore),
    index("idx_inf_tier").on(table.tier),
    index("idx_inf_nigerian_state").on(table.nigerianState),
    index("idx_inf_status").on(table.status),
    index("idx_inf_brand_safety").on(table.brandSafetyScore),
    index("idx_inf_fraud_score").on(table.fraudScore),
    index("idx_inf_platform").on(table.primaryPlatform),
    index("idx_inf_verified").on(table.verified),

    // Blacklist filter
    index("idx_inf_blacklisted")
      .on(table.organizationId, table.blacklistedAt)
      .where(sql`${table.status} = 'blacklisted'`),

    // GIN (raw SQL migration):
    // CREATE INDEX idx_inf_categories ON influencers USING GIN(categories);
    // CREATE INDEX idx_inf_tags ON influencers USING GIN(tags);
  ],
);

// =============================================================================
// INFLUENCER PROGRAMS
// =============================================================================

export const influencerPrograms = pgTable(
  "influencer_programs",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    programType: influencerProgramTypeEnum("campaign_type").default("brand_awareness").notNull(),

    // ─── Timeline ─────────────────────────────────────────────────────────────
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: influencerProgramStatusEnum("status").default("planning").notNull(),

    // ─── Budget (Naira) ───────────────────────────────────────────────────────
    budgetNaira: numeric("budget_naira", { precision: 15, scale: 2 }).notNull().default("0"),
    spentNaira: numeric("spent_naira", { precision: 15, scale: 2 }).default("0"),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Creative Brief ───────────────────────────────────────────────────────
    briefText: text("brief_text"),
    targetPlatforms: text("target_platforms").array(),
    requiredHashtags: text("required_hashtags").array(),
    prohibitedKeywords: text("prohibited_keywords").array(),
    requiredMentions: text("required_mentions").array(),
    requiresApconDisclosure: boolean("requires_apcon_disclosure").default(true).notNull(),

    // ─── Targeting ────────────────────────────────────────────────────────────
    targetAudience: jsonb("target_audience"),
    preferredTiers: text("preferred_tiers").array(),

    // ─── UTM Defaults (per-program) ──────────────────────────────────────────
    // Per-influencer overrides live on the assignment
    utmCampaign: varchar("utm_campaign", { length: 200 }),
    utmSourceDefault: varchar("utm_source_default", { length: 200 }),

    // ─── Target KPIs ──────────────────────────────────────────────────────────
    reachTarget: bigint("reach_target", { mode: "number" }),
    engagementTarget: bigint("engagement_target", { mode: "number" }),
    conversionTarget: integer("conversion_target"),
    revenueTargetNaira: numeric("revenue_target_naira", {
      precision: 15,
      scale: 2,
    }),

    // ─── Actual Performance (denormalized) ───────────────────────────────────
    actualReach: bigint("actual_reach", { mode: "number" }).default(0).notNull(),
    actualEngagements: bigint("actual_engagements", { mode: "number" }).default(0).notNull(),
    actualConversions: integer("actual_conversions").default(0).notNull(),
    revenueAttributedNaira: numeric("revenue_attributed_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    roiPercent: decimal("roi_percent", { precision: 10, scale: 4 }),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_ic_budget_non_negative", sql`${table.budgetNaira}::numeric >= 0`),
    check("chk_ic_spent_non_negative", sql`${table.spentNaira}::numeric >= 0`),
    check(
      "chk_ic_spent_lte_budget",
      sql`${table.spentNaira}::numeric <= ${table.budgetNaira}::numeric`,
    ),
    check(
      "chk_ic_end_after_start",
      sql`${table.endDate} IS NULL
        OR ${table.endDate} > ${table.startDate}`,
    ),
    check("chk_ic_actual_reach_non_negative", sql`${table.actualReach} >= 0`),
    check("chk_ic_actual_engagements_non_negative", sql`${table.actualEngagements} >= 0`),
    check("chk_ic_actual_conversions_non_negative", sql`${table.actualConversions} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_icmp_org").on(table.organizationId),
    index("idx_icmp_status").on(table.organizationId, table.status),
    index("idx_icmp_dates").on(table.startDate, table.endDate),
    index("idx_icmp_type").on(table.organizationId, table.programType),
  ],
);

// =============================================================================
// INFLUENCER PROGRAM ASSIGNMENTS
// =============================================================================

export const influencerProgramAssignments = pgTable(
  "influencer_program_assignments",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Real FK to influencer_programs — CASCADE on delete
    programId: varchar("campaign_id", { length: 32 })
      .notNull()
      .references(() => influencerPrograms.id, { onDelete: "cascade" }),

    // Real FK to influencers — RESTRICT on delete (preserves contract history)
    influencerId: varchar("influencer_id", { length: 32 })
      .notNull()
      .references(() => influencers.id, { onDelete: "restrict" }),

    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: influencerAssignmentStatusEnum("status").default("identified").notNull(),

    // ─── Contract ─────────────────────────────────────────────────────────────
    // Structured deliverable list — see JSDoc
    deliverables: jsonb("deliverables").notNull(),

    contractTerms: text("contract_terms"),

    // Pointer to contract PDF/Doc in media_assets
    contractDocumentUrl: text("contract_document_url"),

    contractSignedAt: timestamp("contract_signed_at", { withTimezone: true }),
    contractExpiresAt: timestamp("contract_expires_at", { withTimezone: true }),

    // ─── Payment (high-level fields; per-transaction detail in payments table) ─
    // feeNaira is the contract total. Per-transaction amounts are on payments.
    feeNaira: numeric("fee_naira", { precision: 15, scale: 2 }).default("0"),

    // Status rolled up from payments table:
    // pending (no payments), partial (some but not all paid), paid, overdue, refunded
    paymentStatus: influencerPaymentStatusEnum("payment_status").default("pending").notNull(),

    // Bank/mobile money details (encrypted at application layer)
    paymentDetails: jsonb("payment_details"),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Performance Tracking Links ──────────────────────────────────────────
    // Per-influencer coupon code (unique within the program)
    couponCode: varchar("coupon_code", { length: 50 }),

    // Per-influencer tracking URL (program URL + influencer UTM params)
    trackingUrl: text("tracking_url"),

    // Per-influencer affiliate link (for affiliate programs)
    affiliateLink: text("affiliate_link"),

    // UTM override for this influencer (e.g. source = influencer handle)
    utmSourceOverride: varchar("utm_source_override", { length: 200 }),

    // ─── Performance Metrics ──────────────────────────────────────────────────
    reach: bigint("reach", { mode: "number" }).default(0).notNull(),
    engagements: bigint("engagements", { mode: "number" }).default(0).notNull(),
    conversions: integer("conversions").default(0).notNull(),
    revenueAttributedNaira: numeric("revenue_attributed_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),

    costPerEngagementNaira: numeric("cost_per_engagement_naira", {
      precision: 15,
      scale: 2,
    }),
    roiPercent: decimal("roi_percent", { precision: 10, scale: 4 }),

    // NOTE: deliverablesTotal and deliverablesFulfilled were removed.
    // Compute via COUNT on influencer_content_submissions:
    //   Total: COUNT(*) WHERE assignment_id = X
    //   Fulfilled: COUNT(*) WHERE assignment_id = X
    //               AND status IN ('approved', 'published')

    onTimeDeliveryRate: decimal("on_time_delivery_rate", {
      precision: 5,
      scale: 2,
    }),

    // ─── Feedback ─────────────────────────────────────────────────────────────
    influencerRating: integer("influencer_rating"),
    feedbackNotes: text("feedback_notes"),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One assignment per influencer per program
    unique("uq_ica_program_influencer").on(table.programId, table.influencerId),

    // couponCode unique per program (if set)
    uniqueIndex("uq_ica_program_coupon")
      .on(table.programId, table.couponCode)
      .where(sql`${table.couponCode} IS NOT NULL`),

    check("chk_ica_fee_non_negative", sql`${table.feeNaira}::numeric >= 0`),
    check("chk_ica_reach_non_negative", sql`${table.reach} >= 0`),
    check("chk_ica_engagements_non_negative", sql`${table.engagements} >= 0`),
    check("chk_ica_conversions_non_negative", sql`${table.conversions} >= 0`),
    check(
      "chk_ica_on_time_delivery_rate_range",
      sql`${table.onTimeDeliveryRate} IS NULL
        OR ${table.onTimeDeliveryRate} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_ica_rating_range",
      sql`${table.influencerRating} IS NULL
        OR ${table.influencerRating} BETWEEN 1 AND 5`,
    ),
    check(
      "chk_ica_contract_expiry_after_signed",
      sql`${table.contractExpiresAt} IS NULL
        OR ${table.contractSignedAt} IS NULL
        OR ${table.contractExpiresAt} > ${table.contractSignedAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_ica_program").on(table.programId),
    index("idx_ica_influencer").on(table.influencerId),
    index("idx_ica_status").on(table.organizationId, table.status),
    index("idx_ica_payment_status").on(table.organizationId, table.paymentStatus),
    index("idx_ica_payment_overdue")
      .on(table.organizationId, table.paymentStatus)
      .where(sql`${table.paymentStatus} = 'overdue'`),
  ],
);

// =============================================================================
// INFLUENCER CONTENT SUBMISSIONS
// =============================================================================

export const influencerContentSubmissions = pgTable(
  "influencer_content_submissions",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Real FK to assignments — CASCADE on delete
    assignmentId: varchar("assignment_id", { length: 32 })
      .notNull()
      .references(() => influencerProgramAssignments.id, {
        onDelete: "cascade",
      }),

    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Content Details ──────────────────────────────────────────────────────
    contentType: influencerContentTypeEnum("content_type").notNull(),
    draftUrl: text("draft_url"),
    platformUrl: text("platform_url"),
    caption: text("caption"),
    hashtags: text("hashtags").array(),
    mediaUrls: text("media_urls").array(),

    // ─── Automated Compliance Checks ──────────────────────────────────────────
    apconDisclosurePresent: boolean("apcon_disclosure_present"),
    brandSafetyScore: decimal("brand_safety_score", { precision: 5, scale: 2 }),
    sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),
    prohibitedKeywordsFound: text("prohibited_keywords_found").array(),
    competitorMentionsFound: text("competitor_mentions_found").array(),

    // AI pipeline output: caption quality, NSFW, OCR text, logo detection,
    // face detection, language detection, duplicate score, etc.
    // Single JSONB blob — not per-field queryable.
    aiAnalysis: jsonb("ai_analysis"),

    // Manual review checklist output:
    // { logoVisible, hashtagsCorrect, mentionsCorrect, ctaIncluded,
    //   musicLicensed, disclosurePresent, ... }
    reviewChecklist: jsonb("review_checklist"),

    // ─── Review Status ────────────────────────────────────────────────────────
    status: influencerContentStatusEnum("status").default("draft").notNull(),
    reviewedById: varchar("reviewed_by_id", { length: 32 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    // revisionNumber is unique per assignment (linear chain)
    revisionNumber: integer("revision_number").default(1).notNull(),

    // ─── Post-publish Performance ─────────────────────────────────────────────
    reach: bigint("reach", { mode: "number" }).default(0).notNull(),
    engagements: bigint("engagements", { mode: "number" }).default(0).notNull(),
    conversions: integer("conversions").default(0).notNull(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // No updatedAt — append-only; revisions are new rows
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // revisionNumber unique per assignment
    unique("uq_ics_assignment_revision").on(table.assignmentId, table.revisionNumber),

    check(
      "chk_ics_brand_safety_score_range",
      sql`${table.brandSafetyScore} IS NULL
        OR ${table.brandSafetyScore} BETWEEN 0 AND 100`,
    ),
    check(
      "chk_ics_sentiment_score_range",
      sql`${table.sentimentScore} IS NULL
        OR ${table.sentimentScore} BETWEEN -1 AND 1`,
    ),
    check("chk_ics_reach_non_negative", sql`${table.reach} >= 0`),
    check("chk_ics_engagements_non_negative", sql`${table.engagements} >= 0`),
    check("chk_ics_conversions_non_negative", sql`${table.conversions} >= 0`),
    check("chk_ics_revision_number_positive", sql`${table.revisionNumber} >= 1`),
    check(
      "chk_ics_platform_url_status",
      sql`${table.platformUrl} IS NULL
        OR ${table.status} IN ('published', 'approved')`,
    ),
    check(
      "chk_ics_published_at_status",
      sql`${table.publishedAt} IS NULL
        OR ${table.status} = 'published'`,
    ),
    check(
      "chk_ics_review_consistency",
      sql`(${table.reviewedById} IS NULL) = (${table.reviewedAt} IS NULL)`,
    ),
    check(
      "chk_ics_submitted_at_consistency",
      sql`${table.status} = 'draft' OR ${table.submittedAt} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_ics_assignment").on(table.assignmentId, table.revisionNumber),
    index("idx_ics_status").on(table.status),
    index("idx_ics_type").on(table.contentType),
    index("idx_ics_published").on(table.publishedAt).where(sql`${table.publishedAt} IS NOT NULL`),
    index("idx_ics_apcon")
      .on(table.organizationId, table.apconDisclosurePresent)
      .where(
        sql`${table.apconDisclosurePresent} = FALSE
          AND ${table.status} IN ('submitted', 'approved', 'published')`,
      ),
    index("idx_ics_brand_safety")
      .on(table.brandSafetyScore)
      .where(sql`${table.brandSafetyScore} IS NOT NULL`),
  ],
);

// =============================================================================
// INFLUENCER PAYMENTS
// =============================================================================

/**
 * Per-transaction payment records for influencer compensation.
 *
 * One row per payment event (advance, milestone, final, bonus, refund).
 * Sum of non-refunded payments for an assignment should equal the
 * total amount paid. The assignment's paymentStatus is rolled up from
 * the sum of these rows.
 *
 * Named influencer_payments to disambiguate from billing/payments
 * (which tracks platform billing transactions).
 *
 * Payment types:
 *   advance    — upfront payment on contract signing
 *   milestone  — installment triggered by a deliverable
 *   final      — final payment on program completion
 *   bonus      — discretionary bonus for outstanding work
 *   refund     — money returned (negative amount)
 *
 * Payment status:
 *   pending    — recorded but not yet transferred
 *   processing — bank/transfer in progress
 *   completed  — funds delivered
 *   failed     — transfer failed
 *   cancelled  — payment cancelled before processing
 *
 * method:
 *   bank_transfer | mobile_money | paystack | flutterwave | international_wire
 *
 * reference:
 *   The bank/transfer reference number for reconciliation.
 *
 * Bank/mobile money details are NOT stored here (already encrypted on
 * the assignment's paymentDetails). This table only stores the
 * transaction record, not the destination.
 */
export const influencerPayments = pgTable(
  "influencer_payments",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Real FK to assignment — RESTRICT on delete (financial records)
    assignmentId: varchar("assignment_id", { length: 32 })
      .notNull()
      .references(() => influencerProgramAssignments.id, {
        onDelete: "restrict",
      }),

    // Denormalized for query convenience
    organizationId: varchar("organization_id", { length: 32 }).notNull(),
    influencerId: varchar("influencer_id", { length: 32 }).notNull(),

    // ─── Payment Details ─────────────────────────────────────────────────────
    paymentType: varchar("payment_type", { length: 30 }).notNull(),

    // 'advance' | 'milestone' | 'final' | 'bonus' | 'refund'
    // Amount in Naira. Refunds are negative.
    amountNaira: numeric("amount_naira", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Method & Reference ──────────────────────────────────────────────────
    method: paymentMethodEnum("method").notNull(),

    // Bank/transfer reference for reconciliation
    reference: varchar("reference", { length: 200 }),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: paymentStatusEnum("status").default("pending").notNull(),

    // ─── Documents ────────────────────────────────────────────────────────────
    // Link to invoice PDF in media_assets
    invoiceUrl: text("invoice_url"),
    receiptUrl: text("receipt_url"),

    // ─── Audit ────────────────────────────────────────────────────────────────
    // Not FK — user may be deleted
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    approvedById: varchar("approved_by_id", { length: 32 }),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // amountNaira must be non-zero (refunds are negative)
    check("chk_pay_amount_non_zero", sql`${table.amountNaira}::numeric != 0`),

    // approvedById requires paidAt (financial control: no approval without payment)
    check(
      "chk_pay_approval_consistency",
      sql`${table.approvedById} IS NULL
        OR ${table.status} IN ('processing', 'completed')`,
    ),

    // paidAt only when status = 'completed'
    check("chk_pay_paid_at_status", sql`${table.paidAt} IS NULL OR ${table.status} = 'completed'`),

    // invoiceUrl only when status is processing or completed
    check(
      "chk_pay_invoice_url_status",
      sql`${table.invoiceUrl} IS NULL
        OR ${table.status} IN ('processing', 'completed')`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_pay_assignment").on(table.assignmentId),
    index("idx_pay_org_status").on(table.organizationId, table.status),
    index("idx_pay_influencer").on(table.influencerId),
    index("idx_pay_type").on(table.assignmentId, table.paymentType),

    // Pending payments — finance worker polls this
    index("idx_pay_pending")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.status} IN ('pending', 'processing')`),

    // Failed payments — retry queue
    index("idx_pay_failed")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.status} = 'failed'`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const influencersRelations = relations(influencers, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [influencers.id],
    references: [contacts.id],
    relationName: "contact_influencer",
  }),
  assignments: many(influencerProgramAssignments, {
    relationName: "influencer_assignments",
  }),
}));

export const influencerProgramsRelations = relations(influencerPrograms, ({ many }) => ({
  assignments: many(influencerProgramAssignments, {
    relationName: "program_assignments",
  }),
}));

export const influencerProgramAssignmentsRelations = relations(
  influencerProgramAssignments,
  ({ one, many }) => ({
    program: one(influencerPrograms, {
      fields: [influencerProgramAssignments.programId],
      references: [influencerPrograms.id],
      relationName: "program_assignments",
    }),
    influencer: one(influencers, {
      fields: [influencerProgramAssignments.influencerId],
      references: [influencers.id],
      relationName: "influencer_assignments",
    }),
    contentSubmissions: many(influencerContentSubmissions, {
      relationName: "assignment_submissions",
    }),
    influencerPayments: many(influencerPayments, {
      relationName: "assignment_payments",
    }),
  }),
);

export const influencerContentSubmissionsRelations = relations(
  influencerContentSubmissions,
  ({ one }) => ({
    assignment: one(influencerProgramAssignments, {
      fields: [influencerContentSubmissions.assignmentId],
      references: [influencerProgramAssignments.id],
      relationName: "assignment_submissions",
    }),
  }),
);

export const influencerPaymentsRelations = relations(influencerPayments, ({ one }) => ({
  assignment: one(influencerProgramAssignments, {
    fields: [influencerPayments.assignmentId],
    references: [influencerProgramAssignments.id],
    relationName: "assignment_payments",
  }),
}));
