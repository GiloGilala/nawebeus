// db/schema/pr/index.ts
//
// Public Relations module — v4 (consolidated + enterprise features).
//
// Tables (10):
//   journalists              — journalist CRM (detail table, FK to contacts)
//   press_releases           — press release lifecycle with version history
//   pr_distributions         — distribution jobs per press release
//   pr_initiatives           — PR initiative planning and ROI tracking
//   pr_coverage_attribution  — coverage tracking and AVE calculation
//   media_lists              — curated journalist lists (static + dynamic)
//   pitch_templates          — reusable email templates
//   pr_events                — press conferences, briefings, launches
//   award_submissions        — award tracking
//   analyst_relations        — Gartner/Forrester/IDC relationships
//
// Tables removed → shared modules:
//   prInteractions     → shared/contacts.ts (contact_interactions)
//                         contactId = journalist.id (contacts base table)
//   press_kits         → query result (media_assets + company profile bundle)
//   newsrooms          → presentation layer (filtered view of press_releases)
//   interview_requests → contact_interactions WHERE type='interview_request'
//   media_alerts       → shared/alerts.ts (already moved in v2)
//   crisis_incidents   → monitoring module (crisisIncidents table)
//   influencer_relations → influencer module (already exists)
//
// Design decisions:
//
//   Journalists as shared contacts (§2.3):
//     journalists.id is a FK to contacts.id (shared/contacts.ts).
//     The contacts base table holds: fullName, email, phone, whatsapp,
//     isActive, organizationId. The journalists table holds all
//     journalist-specific fields (outlet, beats, NDPR consent, tier, etc.).
//     contact_interactions uses a real FK to contacts.id instead of a
//     polymorphic string reference.
//
//   Press releases — version history as JSONB:
//     versionHistory is an append-only JSONB array of snapshots.
//     Each element captures: version, body, keyMessages, changedBy,
//     changedAt, changeSummary. For a content asset edited O(10) times
//     before distribution, JSONB is appropriate.
//
//   Crisis template fields on press_releases:
//     isCrisisTemplate, crisisType, crisisSeverity, responseSteps,
//     escalationChannels, holdingStatement are kept on the press_releases
//     table (not a separate crisis_templates table). Crisis templates
//     are press releases with status = 'draft' and isCrisisTemplate = true.
//
//   prDistributions.targetJournalistIds as TEXT[]:
//     Frozen snapshot of journalist list at send time. Not FK — must
//     survive journalist changes after distribution.
//
//   pr_initiatives.pressReleaseIds as TEXT[]:
//     Soft association — press release can belong to multiple initiatives.
//
//   pr_coverage_attribution.articleId:
//     References media_articles.id (monitoring module) as plain varchar.
//     Not FK — monitoring articles may be purged on shorter retention.
//
//   Distribution delivery metadata:
//     deliveryProvider, providerJobId, providerResponse, lastWebhookAt,
//     templateVersion, batchNumber support multi-provider email/WhatsApp
//     delivery with debugging and partial-failure analysis.
//
//   per-recipient delivery state (bounceCount, etc.):
//     Deferred to a future distribution_recipients table. Storing
//     aggregates on pr_distributions would lose per-recipient detail.
//
//   Media lists (static + dynamic):
//     Static lists have explicit memberIds. Dynamic lists have criteria
//     (beat, tier, outlet, etc.) that are evaluated by background job
//     to populate the list. Either memberIds or criteria must be set.
//
//   Analyst relations:
//     Denormalized (firmName, analystName) for v1. Promote to
//     analyst_contacts table when this becomes its own CRM.
//
//   No FK to organizations or users:
//     organizationId, createdById, approvedBy, legalReviewedBy are plain
//     varchar — PR content must survive user/org deletion for compliance
//     (NDPR, regulatory records, financial reporting of AVE).
//
//   NDPR compliance:
//     ndprConsentStatus tracks journalist consent lifecycle.
//     Distributions check this before sending. emailInvalid + bounceCount
//     track hard bounces for deliverability hygiene.

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
  journalistContactMethodEnum,
  journalistNdprConsentStatusEnum,
  journalistTierEnum,
  prAttributionMethodEnum,
  prCoverageSentimentLabelEnum,
  prCrisisTypeEnum,
  prDistributionChannelEnum,
  prDistributionStatusEnum,
  pressReleaseStatusEnum,
  prInitiativeStatusEnum,
} from "../shared/enums";

// =============================================================================
// JOURNALISTS
// =============================================================================

/**
 * Journalist CRM — detail table using shared-PK inheritance.
 *
 * journalists.id is a FK to contacts.id (shared/contacts.ts).
 * contacts row holds: organizationId, fullName, email, phone, whatsapp.
 * This table holds all journalist-specific fields.
 *
 * Tier classification:
 *   tier1 — national editors, bureau chiefs, senior correspondents
 *   tier2 — specialist/beat reporters, trade press
 *   tier3 — bloggers, freelancers, community correspondents
 *
 * NDPR consent lifecycle:
 *   pending   — consent has been requested but not yet responded to
 *   granted   — journalist has explicitly opted in
 *   withdrawn — journalist has opted out (stop all outreach)
 *   expired   — consent grant has passed its validity period
 *
 * Outreach preferences:
 *   preferredContactTime: when during the day to reach out
 *   requiresEmbargo: respects pre-publication embargos
 *   acceptsWhatsApp: WhatsApp-pitchable
 *   pitchPreferences JSONB: full preference set
 *   excludedTopics: topics this journalist doesn't cover
 *   preferredAttachments: acceptable attachment formats
 *
 * Email health:
 *   emailBounceCount: cumulative bounce count
 *   emailInvalid: hard-bounce flag — once true, stop sending
 *
 * Scoring (all 0–100):
 *   expertiseScore:    topic authority based on coverage history
 *   relationshipScore: CRM health (frequency + recency + response rate)
 *   influenceScore:    platform/audience influence
 *   responseRate:      0.00–1.00 fraction of outreach that received a response
 *   avgResponseTimeHours: average hours between outreach and response
 */
export const journalists = pgTable(
  "journalists",
  {
    // PK = FK to contacts.id (shared-PK inheritance)
    id: varchar("id", { length: 32 })
      .notNull()
      .primaryKey()
      .references(() => contacts.id, { onDelete: "cascade" }),

    // ─── Outlet & Beat ────────────────────────────────────────────────────────
    outletPrimary: varchar("outlet_primary", { length: 255 }).notNull(),

    // All outlets this journalist writes for
    outletsAll: text("outlets_all").array(),

    jobTitle: varchar("job_title", { length: 100 }),

    beats: text("beats").array(),
    specialtyTopics: text("specialty_topics").array(),
    geographicCoverage: text("geographic_coverage").array(),
    languages: text("languages").array(),
    location: text("location"),

    // ─── Social & Contact ─────────────────────────────────────────────────────
    twitterHandle: varchar("twitter_handle", { length: 100 }),
    linkedinUrl: text("linkedin_url"),
    instagramHandle: varchar("instagram_handle", { length: 100 }),
    telegram: varchar("telegram", { length: 100 }),
    emailSecondary: varchar("email_secondary", { length: 255 }),

    preferredContactMethod: journalistContactMethodEnum("preferred_contact_method")
      .default("email")
      .notNull(),

    // ─── Outreach Preferences ────────────────────────────────────────────────
    // IANA timezone for outreach scheduling
    timezone: varchar("timezone", { length: 100 }),

    // 'morning' | 'afternoon' | 'evening' | 'weekday_only' | 'anytime'
    preferredContactTime: varchar("preferred_contact_time", { length: 20 }),

    // Whether the journalist respects pre-publication embargos
    requiresEmbargo: boolean("requires_embargo").default(false).notNull(),

    // Whether the journalist accepts WhatsApp pitches
    acceptsWhatsApp: boolean("accepts_whats_app").default(false).notNull(),

    // Full preference set: { prefersExclusive, likesData, likesFounderQuotes,
    //   acceptsWhatsApp, requiresEmbargo, prefersVideoCalls, ... }
    pitchPreferences: jsonb("pitch_preferences"),

    // Topics this journalist will not accept pitches for
    excludedTopics: text("excluded_topics").array(),

    // Acceptable attachment formats: ['pdf', 'docx', 'images', 'videos', 'dropbox', 'gdrive']
    preferredAttachments: text("preferred_attachments").array(),

    // ─── Employment History ───────────────────────────────────────────────────
    // [{ outlet, role, from, to }] — JSONB for v1.
    // Promote to journalist_employments table if cross-time analytics emerge.
    employmentHistory: jsonb("employment_history"),

    // ─── Engagement Tracking ──────────────────────────────────────────────────
    // When the journalist last opened a pitch email
    lastPitchOpenedAt: timestamp("last_pitch_opened_at", {
      withTimezone: true,
    }),

    // ─── Email Health ─────────────────────────────────────────────────────────
    // Cumulative bounce count for this journalist
    emailBounceCount: integer("email_bounce_count").default(0).notNull(),

    // Hard-bounce flag — once true, stop sending to this journalist
    emailInvalid: boolean("email_invalid").default(false).notNull(),

    // When the journalist last requested a media kit
    requestedMediaKitAt: timestamp("requested_media_kit_at", {
      withTimezone: true,
    }),

    // ─── Classification ───────────────────────────────────────────────────────
    tier: journalistTierEnum("tier").default("tier3").notNull(),

    // ─── Scoring (all 0–100) ──────────────────────────────────────────────────
    expertiseScore: integer("expertise_score").default(0).notNull(),
    relationshipScore: integer("relationship_score").default(0).notNull(),
    influenceScore: integer("influence_score").default(0).notNull(),

    responseRate: decimal("response_rate", { precision: 5, scale: 2 }),

    // Wide decimal (8,2) to allow up to 999999.99 hours
    avgResponseTimeHours: decimal("avg_response_time_hours", {
      precision: 8,
      scale: 2,
    }),

    // ─── NDPR Consent ─────────────────────────────────────────────────────────
    ndprConsentStatus: journalistNdprConsentStatusEnum("ndpr_consent_status")
      .default("pending")
      .notNull(),

    ndprConsentDate: timestamp("ndpr_consent_date", { withTimezone: true }),

    // 'email_opt_in' | 'verbal' | 'form' | 'imported_with_consent'
    ndprConsentMethod: varchar("ndpr_consent_method", { length: 50 }),

    ndprConsentNote: text("ndpr_consent_note"),

    // ─── Denormalized Activity Metrics ────────────────────────────────────────
    interactionCount: integer("interaction_count").default(0).notNull(),
    coverageCount: integer("coverage_count").default(0).notNull(),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    lastCoverageAt: timestamp("last_coverage_at", { withTimezone: true }),

    // ─── CRM Fields ───────────────────────────────────────────────────────────
    tags: text("tags").array(),
    notes: text("notes"),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_j_expertise_score_range", sql`${table.expertiseScore} BETWEEN 0 AND 100`),
    check("chk_j_relationship_score_range", sql`${table.relationshipScore} BETWEEN 0 AND 100`),
    check("chk_j_influence_score_range", sql`${table.influenceScore} BETWEEN 0 AND 100`),
    check(
      "chk_j_response_rate_range",
      sql`${table.responseRate} IS NULL
        OR ${table.responseRate} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_j_avg_response_time_non_negative",
      sql`${table.avgResponseTimeHours} IS NULL
        OR ${table.avgResponseTimeHours} >= 0`,
    ),
    check("chk_j_interaction_count_non_negative", sql`${table.interactionCount} >= 0`),
    check("chk_j_coverage_count_non_negative", sql`${table.coverageCount} >= 0`),
    check("chk_j_email_bounce_count_non_negative", sql`${table.emailBounceCount} >= 0`),
    check(
      "chk_j_ndpr_consent_date_consistency",
      sql`${table.ndprConsentStatus} NOT IN ('granted', 'withdrawn')
        OR ${table.ndprConsentDate} IS NOT NULL`,
    ),
    check(
      "chk_j_email_invalid_implies_bounces",
      sql`${table.emailInvalid} = FALSE
        OR ${table.emailBounceCount} > 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_j_outlet").on(table.outletPrimary),
    index("idx_j_tier").on(table.tier),
    index("idx_j_ndpr").on(table.ndprConsentStatus),
    index("idx_j_relationship_score").on(table.relationshipScore),
    index("idx_j_email_invalid").on(table.emailInvalid).where(sql`${table.emailInvalid} = TRUE`),
    index("idx_j_timezone").on(table.timezone).where(sql`${table.timezone} IS NOT NULL`),

    // GIN (raw SQL migration):
    // CREATE INDEX idx_j_beats ON journalists USING GIN(beats);
    // CREATE INDEX idx_j_tags ON journalists USING GIN(tags);
    // CREATE INDEX idx_j_excluded_topics ON journalists USING GIN(excluded_topics);
    // CREATE INDEX idx_j_geographic_coverage ON journalists USING GIN(geographic_coverage);

    // Full-text search (across contacts + journalists):
    // CREATE INDEX idx_j_search ON journalists
    //   USING GIN(to_tsvector('english', outlet_primary || ' ' || COALESCE(job_title, '')));
  ],
);

// =============================================================================
// PRESS RELEASES
// =============================================================================

/**
 * Press release lifecycle — from draft to distribution.
 *
 * Dual-purpose table:
 *   Regular press releases: isCrisisTemplate = false (default)
 *   Crisis templates:       isCrisisTemplate = true, status = 'draft'
 *
 * Version history (JSONB):
 *   Each content edit appends a snapshot to versionHistory.
 *
 * Embargo:
 *   embargoAt: release should not be published before this timestamp.
 *
 * AP Style & Regulatory compliance:
 *   apStyleChecked, regulatoryChecked, regulatoryIndustry
 *
 * SEO + Localization:
 *   seo: { title, description, slug, keywords }
 *   translations: { es: { headline, body }, fr: { headline, body } }
 *   language, country: ISO codes
 *
 * AI disclosure:
 *   generatedWithAi, aiProvider, aiReviewedBy/At, aiPromptSummary
 *   For AI-generated drafts, requires disclosure + human review.
 *
 * Asset snapshot:
 *   assetSnapshot freezes the media URLs at distribution time so later
 *   asset changes don't retroactively alter sent releases.
 *
 * Readability metrics:
 *   readingGrade, estimatedReadingMinutes, wordCount (cached from body)
 *
 * Tamper-evidence:
 *   contentHash (SHA-256 of body) — verifies no edits after approval
 */
export const pressReleases = pgTable(
  "press_releases",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Content ──────────────────────────────────────────────────────────────
    title: varchar("title", { length: 500 }).notNull(),
    headline: varchar("headline", { length: 500 }).notNull(),
    subheadline: varchar("subheadline", { length: 500 }),
    body: text("body").notNull(),
    keyMessages: text("key_messages").array(),

    // Structured quote attribution: [{ speaker, position, quote, headshotUrl }]
    quotes: jsonb("quotes"),

    // Media asset IDs (pointers to media_assets)
    mediaIds: text("media_ids").array(),

    // Asset snapshot — frozen URLs at distribution time
    assetSnapshot: jsonb("asset_snapshot"),

    tags: text("tags").array(),

    // ─── Localization ─────────────────────────────────────────────────────────
    language: varchar("language", { length: 5 }).default("en").notNull(),
    country: varchar("country", { length: 2 }),

    // { es: { headline, body, keyMessages }, fr: { ... } }
    translations: jsonb("translations"),

    // ─── SEO ──────────────────────────────────────────────────────────────────
    // { title, description, slug, keywords }
    seo: jsonb("seo"),

    // ─── Status & Versioning ──────────────────────────────────────────────────
    status: pressReleaseStatusEnum("status").default("draft").notNull(),
    version: integer("version").default(1).notNull(),
    versionHistory: jsonb("version_history").default([]).notNull(),

    // SHA-256 of body at last approval — tamper-evidence
    contentHash: varchar("content_hash", { length: 64 }),

    // ─── Timing ───────────────────────────────────────────────────────────────
    embargoAt: timestamp("embargo_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),
    distributionAt: timestamp("distribution_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ─── Readability (cached from body) ──────────────────────────────────────
    readingGrade: decimal("reading_grade", { precision: 4, scale: 2 }),
    estimatedReadingMinutes: integer("estimated_reading_minutes"),
    wordCount: integer("word_count"),

    // ─── Targeting ────────────────────────────────────────────────────────────
    targetAudience: text("target_audience").array(),
    targetJournalists: text("target_journalists").array(),

    // ─── Crisis Template Fields ───────────────────────────────────────────────
    isCrisisTemplate: boolean("is_crisis_template").default(false).notNull(),
    crisisType: prCrisisTypeEnum("crisis_type"),
    crisisSeverity: integer("crisis_severity"),
    responseSteps: jsonb("response_steps"),
    escalationChannels: jsonb("escalation_channels"),
    holdingStatement: text("holding_statement"),

    // ─── Compliance ───────────────────────────────────────────────────────────
    apStyleChecked: boolean("ap_style_checked").default(false).notNull(),
    regulatoryChecked: boolean("regulatory_checked").default(false).notNull(),
    regulatoryIndustry: varchar("regulatory_industry", { length: 50 }),

    legalReviewedBy: varchar("legal_reviewed_by", { length: 32 }),
    legalReviewedAt: timestamp("legal_reviewed_at", { withTimezone: true }),

    // ─── AI Disclosure ────────────────────────────────────────────────────────
    generatedWithAi: boolean("generated_with_ai").default(false).notNull(),
    aiProvider: varchar("ai_provider", { length: 50 }),
    aiPromptSummary: varchar("ai_prompt_summary", { length: 200 }),
    aiReviewedBy: varchar("ai_reviewed_by", { length: 32 }),
    aiReviewedAt: timestamp("ai_reviewed_at", { withTimezone: true }),

    // ─── Approval ─────────────────────────────────────────────────────────────
    approvedBy: varchar("approved_by", { length: 32 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    changesRequestedBy: varchar("changes_requested_by", { length: 32 }),
    changesRequestedAt: timestamp("changes_requested_at", {
      withTimezone: true,
    }),
    changesRequestedNote: text("changes_requested_note"),

    currentApprovalRequestId: varchar("current_approval_request_id", {
      length: 32,
    }),

    // ─── Aggregate Metrics (denormalized) ─────────────────────────────────────
    distributionCount: integer("distribution_count").default(0).notNull(),
    openCount: integer("open_count").default(0).notNull(),
    responseCount: integer("response_count").default(0).notNull(),
    coverageCount: integer("coverage_count").default(0).notNull(),
    aveNaira: numeric("ave_naira", { precision: 15, scale: 2 }).default("0"),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    check("chk_pr_version_positive", sql`${table.version} >= 1`),
    check(
      "chk_pr_crisis_severity_range",
      sql`${table.crisisSeverity} IS NULL
        OR ${table.crisisSeverity} BETWEEN 1 AND 5`,
    ),
    check(
      "chk_pr_crisis_type_consistency",
      sql`${table.isCrisisTemplate} = FALSE
        OR ${table.crisisType} IS NOT NULL`,
    ),
    check(
      "chk_pr_embargo_before_distribution",
      sql`${table.embargoAt} IS NULL
        OR ${table.distributionAt} IS NULL
        OR ${table.embargoAt} <= ${table.distributionAt}`,
    ),
    check(
      "chk_pr_published_after_distribution",
      sql`${table.publishedAt} IS NULL
        OR ${table.distributionAt} IS NULL
        OR ${table.publishedAt} >= ${table.distributionAt}`,
    ),
    check(
      "chk_pr_approval_consistency",
      sql`(${table.approvedBy} IS NULL) = (${table.approvedAt} IS NULL)`,
    ),
    check(
      "chk_pr_legal_review_consistency",
      sql`(${table.legalReviewedBy} IS NULL) = (${table.legalReviewedAt} IS NULL)`,
    ),
    check(
      "chk_pr_changes_requested_consistency",
      sql`(${table.changesRequestedBy} IS NULL) = (${table.changesRequestedAt} IS NULL)
        AND (${table.changesRequestedNote} IS NULL) = (${table.changesRequestedBy} IS NULL)`,
    ),
    check(
      "chk_pr_ai_review_consistency",
      sql`(${table.aiReviewedBy} IS NULL) = (${table.aiReviewedAt} IS NULL)`,
    ),
    check(
      "chk_pr_ai_disclosure",
      sql`${table.generatedWithAi} = FALSE
        OR (${table.aiProvider} IS NOT NULL
            AND ${table.aiReviewedBy} IS NOT NULL
            AND ${table.aiReviewedAt} IS NOT NULL)`,
    ),
    check(
      "chk_pr_word_count_non_negative",
      sql`${table.wordCount} IS NULL OR ${table.wordCount} >= 0`,
    ),
    check(
      "chk_pr_reading_minutes_non_negative",
      sql`${table.estimatedReadingMinutes} IS NULL
        OR ${table.estimatedReadingMinutes} >= 0`,
    ),
    check("chk_pr_distribution_count_non_negative", sql`${table.distributionCount} >= 0`),
    check("chk_pr_coverage_count_non_negative", sql`${table.coverageCount} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_pr_org").on(table.organizationId, table.createdAt),
    index("idx_pr_status").on(table.organizationId, table.status),
    index("idx_pr_embargo")
      .on(table.embargoAt)
      .where(
        sql`${table.embargoAt} IS NOT NULL
          AND ${table.status} = 'approved'`,
      ),
    index("idx_pr_crisis")
      .on(table.organizationId, table.crisisType)
      .where(sql`${table.isCrisisTemplate} = TRUE`),
    index("idx_pr_pending_approval")
      .on(table.organizationId, table.currentApprovalRequestId)
      .where(sql`${table.status} = 'review'`),
    index("idx_pr_active")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.archivedAt} IS NULL`),
    index("idx_pr_published")
      .on(table.organizationId, table.publishedAt)
      .where(sql`${table.publishedAt} IS NOT NULL`),

    // GIN (raw SQL migration):
    // CREATE INDEX idx_pr_versions ON press_releases USING GIN(version_history);
    // CREATE INDEX idx_pr_translations ON press_releases USING GIN(translations);
    // CREATE INDEX idx_pr_seo ON press_releases USING GIN(seo);
  ],
);

// =============================================================================
// PR DISTRIBUTIONS
// =============================================================================

/**
 * Distribution jobs — one row per send attempt per press release.
 *
 * Delivery metadata:
 *   deliveryProvider: 'ses' | 'sendgrid' | 'mailgun' | 'whatsapp_business' | 'other'
 *   providerJobId: provider's job ID for debugging
 *   providerResponse: full API response JSON for diagnostics
 *   lastWebhookAt: when the provider last pinged us back
 *   templateVersion: which email template version was used
 *   batchNumber: for large sends split into batches
 *
 * Per-recipient detail (bounceCount, spamComplaintCount, etc.):
 *   Deferred to distribution_recipients table. Aggregates on this row
 *   would lose per-recipient detail.
 *
 * Delivery metrics:
 *   targetCount: how many journalists were targeted
 *   deliveredCount: delivery confirmations received
 *   openCount: unique opens tracked
 *   clickCount: link clicks tracked
 *   responseCount: journalist replies received
 *   coverageCount: articles attributed to this distribution
 *   aveNaira: total AVE from coverage attributed
 */
export const prDistributions = pgTable(
  "pr_distributions",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    pressReleaseId: varchar("press_release_id", { length: 32 })
      .notNull()
      .references(() => pressReleases.id, { onDelete: "cascade" }),

    // ─── Targeting ────────────────────────────────────────────────────────────
    targetJournalistIds: text("target_journalist_ids").array().notNull(),
    targetSegments: text("target_segments").array(),

    // ─── Delivery ─────────────────────────────────────────────────────────────
    channel: prDistributionChannelEnum("channel").notNull(),

    subject: text("subject"),
    personalized: boolean("personalized").default(false).notNull(),
    personalizationFields: jsonb("personalization_fields"),

    // ─── Delivery Provider Metadata ───────────────────────────────────────────
    deliveryProvider: varchar("delivery_provider", { length: 50 }),
    // 'ses' | 'sendgrid' | 'mailgun' | 'whatsapp_business' | 'other'
    providerJobId: varchar("provider_job_id", { length: 255 }),
    providerResponse: jsonb("provider_response"),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),

    // Email template version used for this send
    templateVersion: varchar("template_version", { length: 50 }),

    // Batch number for large sends (1, 2, 3, ...)
    batchNumber: integer("batch_number"),

    // ─── Status & Scheduling ──────────────────────────────────────────────────
    status: prDistributionStatusEnum("status").default("queued").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // ─── Delivery Metrics ─────────────────────────────────────────────────────
    targetCount: integer("target_count").default(0).notNull(),
    deliveredCount: integer("delivered_count").default(0).notNull(),
    openCount: integer("open_count").default(0).notNull(),
    clickCount: integer("click_count").default(0).notNull(),
    responseCount: integer("response_count").default(0).notNull(),
    coverageCount: integer("coverage_count").default(0).notNull(),
    aveNaira: numeric("ave_naira", { precision: 15, scale: 2 }).default("0"),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Error Handling ───────────────────────────────────────────────────────
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 50 }),
    retryCount: integer("retry_count").default(0).notNull(),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_dist_targets_not_empty", sql`array_length(${table.targetJournalistIds}, 1) > 0`),
    check("chk_dist_target_count_non_negative", sql`${table.targetCount} >= 0`),
    check("chk_dist_delivered_lte_target", sql`${table.deliveredCount} <= ${table.targetCount}`),
    check(
      "chk_dist_open_lte_delivered",
      sql`${table.openCount} <= ${table.deliveredCount}
        OR ${table.deliveredCount} = 0`,
    ),
    check(
      "chk_dist_click_lte_open",
      sql`${table.clickCount} <= ${table.openCount}
        OR ${table.openCount} = 0`,
    ),
    check("chk_dist_retry_count_non_negative", sql`${table.retryCount} >= 0`),
    check(
      "chk_dist_batch_number_positive",
      sql`
      ${table.batchNumber} IS NULL OR ${table.batchNumber} >= 1
    `,
    ),
    check(
      "chk_dist_sent_after_scheduled",
      sql`${table.sentAt} IS NULL
        OR ${table.scheduledAt} IS NULL
        OR ${table.sentAt} >= ${table.scheduledAt}`,
    ),
    check(
      "chk_dist_completed_after_sent",
      sql`${table.completedAt} IS NULL
        OR ${table.sentAt} IS NULL
        OR ${table.completedAt} >= ${table.sentAt}`,
    ),
    check(
      "chk_dist_personalization_consistency",
      sql`${table.personalized} = FALSE
        OR ${table.personalizationFields} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_dist_press_release").on(table.pressReleaseId, table.createdAt),
    index("idx_dist_org").on(table.organizationId, table.createdAt),
    index("idx_dist_queued").on(table.scheduledAt).where(sql`${table.status} = 'queued'`),
    index("idx_dist_failed")
      .on(table.organizationId, table.retryCount)
      .where(sql`${table.status} = 'failed'`),
    index("idx_dist_channel").on(table.organizationId, table.channel),
    index("idx_dist_provider").on(table.organizationId, table.deliveryProvider),
  ],
);

// =============================================================================
// PR INITIATIVES
// =============================================================================

/**
 * PR initiative planning, tracking, and ROI measurement.
 *
 * Targets:
 *   targetCoverageCount, targetAveNaira, targetImpressions,
 *   targetSentiment, targetResponseRate
 *
 * Costs (all in Naira):
 *   agencyCost, distributionCost, wireCost, eventCost, totalCost
 *
 * Actuals (denormalized, updated by background job):
 *   actualCoverageCount, actualAveNaira, actualImpressions,
 *   actualSentiment, actualResponseRate
 *
 * ROI:
 *   roiPercent: (actualAveNaira - totalCostNaira) / totalCostNaira × 100
 *   roaPercent: actualAveNaira / totalCostNaira × 100
 *
 * Workflow:
 *   ownerId, approvedBudgetNaira, successCriteria
 *
 * Structuring:
 *   initiativeObjectives, initiativeRisks, stakeholders (all JSONB)
 *
 * Soft associations:
 *   pressReleaseIds TEXT[] — not FK (press release can belong to multiple initiatives)
 */
export const prInitiatives = pgTable(
  "pr_initiatives",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    status: prInitiativeStatusEnum("status").default("planning").notNull(),

    // ─── Ownership ────────────────────────────────────────────────────────────
    // The user responsible for the initiative (may differ from creator)
    ownerId: varchar("owner_id", { length: 32 }),

    // ─── Timeline ─────────────────────────────────────────────────────────────
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    // ─── Target KPIs ──────────────────────────────────────────────────────────
    targetCoverageCount: integer("target_coverage_count"),
    targetAveNaira: numeric("target_ave_naira", { precision: 15, scale: 2 }),
    targetImpressions: bigint("target_impressions", { mode: "number" }),
    targetSentiment: decimal("target_sentiment", { precision: 3, scale: 2 }),
    targetResponseRate: decimal("target_response_rate", {
      precision: 5,
      scale: 2,
    }),

    // ─── Cost Tracking (all in Naira) ─────────────────────────────────────────
    agencyCostNaira: numeric("agency_cost_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    distributionCostNaira: numeric("distribution_cost_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    wireCostNaira: numeric("wire_cost_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    eventCostNaira: numeric("event_cost_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    totalCostNaira: numeric("total_cost_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Distinguishes "requested budget" from "approved budget"
    approvedBudgetNaira: numeric("approved_budget_naira", {
      precision: 15,
      scale: 2,
    }),

    // ─── Actual Performance ───────────────────────────────────────────────────
    actualCoverageCount: integer("actual_coverage_count").default(0).notNull(),
    actualAveNaira: numeric("actual_ave_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),
    actualImpressions: bigint("actual_impressions", { mode: "number" }).default(0).notNull(),
    actualSentiment: decimal("actual_sentiment", { precision: 3, scale: 2 }),
    actualResponseRate: decimal("actual_response_rate", {
      precision: 5,
      scale: 2,
    }),

    // ─── PR-specific Outreach Metrics ────────────────────────────────────────
    socialMentionCount: integer("social_mention_count").default(0).notNull(),
    backlinkCount: integer("backlink_count").default(0).notNull(),

    // ─── ROI Metrics ──────────────────────────────────────────────────────────
    roiPercent: decimal("roi_percent", { precision: 10, scale: 2 }),
    roaPercent: decimal("roa_percent", { precision: 10, scale: 2 }),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Strategic Structuring ────────────────────────────────────────────────
    // [{ goal, target, metric, deadline }]
    initiativeObjectives: jsonb("campaign_objectives"),

    // [{ risk, likelihood, impact, mitigation }]
    initiativeRisks: jsonb("campaign_risks"),

    // [{ userId, role, interest, influence }]
    stakeholders: jsonb("stakeholders"),

    // [{ criterion, target, measurement, deadline }]
    successCriteria: jsonb("success_criteria"),

    // ─── Associated Press Releases ────────────────────────────────────────────
    pressReleaseIds: text("press_release_ids").array(),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "chk_camp_end_after_start",
      sql`${table.endDate} IS NULL
        OR ${table.endDate} > ${table.startDate}`,
    ),
    check(
      "chk_camp_target_sentiment_range",
      sql`${table.targetSentiment} IS NULL
        OR ${table.targetSentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_camp_actual_sentiment_range",
      sql`${table.actualSentiment} IS NULL
        OR ${table.actualSentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_camp_target_response_rate_range",
      sql`${table.targetResponseRate} IS NULL
        OR ${table.targetResponseRate} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_camp_actual_response_rate_range",
      sql`${table.actualResponseRate} IS NULL
        OR ${table.actualResponseRate} BETWEEN 0 AND 1`,
    ),
    check("chk_camp_actual_coverage_non_negative", sql`${table.actualCoverageCount} >= 0`),
    check("chk_camp_social_mention_non_negative", sql`${table.socialMentionCount} >= 0`),
    check("chk_camp_backlink_count_non_negative", sql`${table.backlinkCount} >= 0`),
    check(
      "chk_camp_approved_budget_consistency",
      sql`${table.approvedBudgetNaira} IS NULL
        OR ${table.approvedBudgetNaira}::numeric <= ${table.totalCostNaira}::numeric`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_camp_org").on(table.organizationId),
    index("idx_camp_status").on(table.organizationId, table.status),
    index("idx_camp_dates").on(table.startDate, table.endDate),
    index("idx_camp_owner").on(table.ownerId),
  ],
);

// =============================================================================
// PR COVERAGE ATTRIBUTION
// =============================================================================

/**
 * Tracks which articles are attributed to which press releases.
 *
 * Attribution methods:
 *   keyword_match   — article contains the press release's key phrases
 *   journalist_link — the journalist who received the distribution wrote this
 *   content_match   — high semantic similarity to press release body
 *   manual          — a team member manually linked the article
 *   ai_detected     — AI identified the attribution with high confidence
 *   utm_tracking    — UTM parameters in article links trace back to the release
 *
 * Message discipline:
 *   keyMessagesFound: which press release key messages appeared
 *   pullThroughRate: 0.00–1.00 fraction of key messages that made it into coverage
 *
 * Article classification:
 *   mediaType: 'tv' | 'radio' | 'podcast' | 'print' | 'online' | 'newsletter'
 *   reachConfidence: 'estimated' | 'verified' | 'publisher_provided'
 *   headlineSimilarity, bodySimilarity: 0.00–1.00
 *   summary: AI-generated coverage summary
 *   quotedPeople, competitorMentions, brandMentionCount
 *
 * Verification:
 *   verifiedBy / verifiedAt track human verification of auto-attribution.
 */
export const prCoverageAttribution = pgTable(
  "pr_coverage_attribution",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    pressReleaseId: varchar("press_release_id", { length: 32 })
      .notNull()
      .references(() => pressReleases.id, { onDelete: "cascade" }),

    // ─── Article Reference ────────────────────────────────────────────────────
    articleId: varchar("article_id", { length: 32 }),
    journalistId: varchar("journalist_id", { length: 32 }),

    outlet: varchar("outlet", { length: 255 }).notNull(),
    articleUrl: text("article_url"),
    articleTitle: text("article_title"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ─── Article Classification ───────────────────────────────────────────────
    mediaType: varchar("media_type", { length: 30 }),
    // 'tv' | 'radio' | 'podcast' | 'print' | 'online' | 'newsletter'
    reachConfidence: varchar("reach_confidence", { length: 30 }),
    // 'estimated' | 'verified' | 'publisher_provided'

    // ─── Attribution ──────────────────────────────────────────────────────────
    attributionMethod: prAttributionMethodEnum("attribution_method"),
    attributionConfidence: decimal("attribution_confidence", {
      precision: 3,
      scale: 2,
    }),

    // Similarity scores (0.00–1.00)
    headlineSimilarity: decimal("headline_similarity", {
      precision: 3,
      scale: 2,
    }),
    bodySimilarity: decimal("body_similarity", { precision: 3, scale: 2 }),

    // AI-generated summary of the coverage
    summary: text("summary"),

    // ─── Message Discipline ───────────────────────────────────────────────────
    keyMessagesFound: text("key_messages_found").array(),
    pullThroughRate: decimal("pull_through_rate", { precision: 5, scale: 2 }),

    // ─── People & Competitors Mentioned ──────────────────────────────────────
    quotedPeople: text("quoted_people").array(),
    competitorMentions: text("competitor_mentions").array(),
    brandMentionCount: integer("brand_mention_count").default(0).notNull(),

    // ─── Impact Metrics ───────────────────────────────────────────────────────
    aveNaira: numeric("ave_naira", { precision: 15, scale: 2 }).default("0"),
    impressions: bigint("impressions", { mode: "number" }).default(0).notNull(),

    sentimentLabel: prCoverageSentimentLabelEnum("sentiment_label"),
    sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),

    shareOfVoice: decimal("share_of_voice", { precision: 5, scale: 2 }),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Verification ─────────────────────────────────────────────────────────
    verifiedBy: varchar("verified_by", { length: 32 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "chk_cov_attribution_confidence_range",
      sql`${table.attributionConfidence} IS NULL
        OR ${table.attributionConfidence} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_cov_headline_similarity_range",
      sql`${table.headlineSimilarity} IS NULL
        OR ${table.headlineSimilarity} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_cov_body_similarity_range",
      sql`${table.bodySimilarity} IS NULL
        OR ${table.bodySimilarity} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_cov_pull_through_range",
      sql`${table.pullThroughRate} IS NULL
        OR ${table.pullThroughRate} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_cov_sentiment_score_range",
      sql`${table.sentimentScore} IS NULL
        OR ${table.sentimentScore} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_cov_sov_range",
      sql`${table.shareOfVoice} IS NULL
        OR ${table.shareOfVoice} BETWEEN 0 AND 1`,
    ),
    check("chk_cov_impressions_non_negative", sql`${table.impressions} >= 0`),
    check("chk_cov_brand_mention_count_non_negative", sql`${table.brandMentionCount} >= 0`),
    check(
      "chk_cov_verification_consistency",
      sql`(${table.verifiedBy} IS NULL) = (${table.verifiedAt} IS NULL)`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_cov_press_release").on(table.pressReleaseId, table.publishedAt),
    index("idx_cov_org").on(table.organizationId, table.publishedAt),
    index("idx_cov_journalist")
      .on(table.journalistId)
      .where(sql`${table.journalistId} IS NOT NULL`),
    index("idx_cov_article").on(table.articleId).where(sql`${table.articleId} IS NOT NULL`),
    index("idx_cov_outlet").on(table.organizationId, table.outlet),
    index("idx_cov_unverified")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.verifiedAt} IS NULL`),
    index("idx_cov_attribution_method").on(table.organizationId, table.attributionMethod),
    index("idx_cov_media_type").on(table.organizationId, table.mediaType),
  ],
);

// =============================================================================
// MEDIA LISTS
// =============================================================================

/**
 * Curated journalist lists for repeated targeting.
 *
 * Two list types:
 *   static:  explicit memberIds (manual curation)
 *   dynamic: criteria (beat, tier, outlet) evaluated by background job
 *
 * Either memberIds or criteria must be set, not both. Enforced by CHECK.
 *
 * memberCount is cached for static lists (array length) and dynamic
 * lists (last evaluation result). Last refreshed timestamp tracks
 * staleness for dynamic lists.
 */
export const mediaLists = pgTable(
  "media_lists",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    // Static or dynamic list
    isDynamic: boolean("is_dynamic").default(false).notNull(),

    // For static lists: explicit journalist IDs
    memberIds: text("member_ids").array(),

    // For dynamic lists: query criteria
    // { beats: ['fintech'], tier: ['tier1', 'tier2'],
    //   outlets: [...], geographicCoverage: ['Lagos'] }
    criteria: jsonb("criteria"),

    // Cached member count (for fast display without array_length on read)
    memberCount: integer("member_count").default(0).notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),

    isPublic: boolean("is_public").default(false).notNull(),

    // Soft association with media_lists — many-to-many
    parentListIds: text("parent_list_ids").array(),

    tags: text("tags").array(),

    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Static lists use memberIds; dynamic lists use criteria
    check(
      "chk_ml_static_or_dynamic",
      sql`(${table.isDynamic} = FALSE
        AND ${table.memberIds} IS NOT NULL
        AND array_length(${table.memberIds}, 1) > 0)
        OR (${table.isDynamic} = TRUE
          AND ${table.criteria} IS NOT NULL)`,
    ),
    check("chk_ml_member_count_non_negative", sql`${table.memberCount} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_ml_org").on(table.organizationId),
    index("idx_ml_public")
      .on(table.organizationId, table.isPublic)
      .where(sql`${table.isPublic} = TRUE`),
    index("idx_ml_dynamic")
      .on(table.organizationId, table.lastRefreshedAt)
      .where(sql`${table.isDynamic} = TRUE`),
  ],
);

// =============================================================================
// PITCH TEMPLATES
// =============================================================================

/**
 * Reusable email templates for journalist outreach.
 *
 * Merge variables in subject and body:
 *   {firstName}, {outletPrimary}, {beats}, {recentCoverage}, etc.
 *
 * availableVariables JSONB documents which variables the template uses,
 * enabling UI hints when composing a pitch.
 *
 * category groups templates by use case:
 *   'product_launch' | 'funding_announcement' | 'executive_hire' |
 *   'crisis_response' | 'event_invitation' | 'exclusive_pitch' | etc.
 *
 * usageCount tracks how often the template has been used (for analytics).
 */
export const pitchTemplates = pgTable(
  "pitch_templates",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    subject: text("subject").notNull(),
    body: text("body").notNull(),

    // Documentation of available merge variables
    availableVariables: jsonb("available_variables"),

    category: varchar("category", { length: 50 }),

    isActive: boolean("is_active").default(true).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),

    tags: text("tags").array(),

    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_pt_usage_count_non_negative", sql`${table.usageCount} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_pt_org").on(table.organizationId),
    index("idx_pt_category").on(table.organizationId, table.category),
    index("idx_pt_active").on(table.organizationId, table.isActive),
  ],
);

// =============================================================================
// PR EVENTS
// =============================================================================

/**
 * Press events — press conferences, media briefings, product launches.
 *
 * Event types:
 *   'press_conference' | 'media_briefing' | 'product_launch' |
 *   'panel' | 'speaking_engagement' | 'interview' | 'other'
 *
 * RSVP tracking:
 *   invitedJournalistIds: who was invited
 *   confirmedRsvpIds: who confirmed
 *   declinedRsvpIds: who declined
 *   Constraint: no journalist can be in both confirmed and declined lists.
 *
 * Virtual or in-person:
 *   isVirtual + meetingUrl for virtual events
 *   venue for physical
 *
 * Status: 'planning' | 'invitations_sent' | 'confirmed' | 'in_progress' |
 *         'completed' | 'cancelled'
 */
export const prEvents = pgTable(
  "pr_events",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    eventType: varchar("event_type", { length: 50 }).notNull(),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    venue: text("venue"),
    isVirtual: boolean("is_virtual").default(false).notNull(),
    meetingUrl: text("meeting_url"),

    invitedJournalistIds: text("invited_journalist_ids").array(),
    confirmedRsvpIds: text("confirmed_rsvp_ids").array(),
    declinedRsvpIds: text("declined_rsvp_ids").array(),

    // Optional link to a related press release
    pressReleaseId: varchar("press_release_id", { length: 32 }),

    status: varchar("status", { length: 30 }).notNull().default("planning"),

    tags: text("tags").array(),

    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "chk_pe_end_after_start",
      sql`${table.endAt} IS NULL OR ${table.endAt} > ${table.startAt}`,
    ),

    // No journalist can be both confirmed and declined
    check(
      "chk_pe_no_conflict_rsvp",
      sql`${table.confirmedRsvpIds} IS NULL
        OR ${table.declinedRsvpIds} IS NULL
        OR NOT (${table.confirmedRsvpIds} && ${table.declinedRsvpIds})`,
    ),

    // Confirmed RSVPs must be in invited list
    check(
      "chk_pe_confirmed_in_invited",
      sql`${table.confirmedRsvpIds} IS NULL
        OR ${table.invitedJournalistIds} IS NULL
        OR (${table.confirmedRsvpIds} <@ ${table.invitedJournalistIds})`,
    ),

    check(
      "chk_pe_declined_in_invited",
      sql`${table.declinedRsvpIds} IS NULL
        OR ${table.invitedJournalistIds} IS NULL
        OR (${table.declinedRsvpIds} <@ ${table.invitedJournalistIds})`,
    ),

    // Virtual events must have meetingUrl
    check(
      "chk_pe_virtual_has_url",
      sql`${table.isVirtual} = FALSE OR ${table.meetingUrl} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_pe_org").on(table.organizationId),
    index("idx_pe_start").on(table.organizationId, table.startAt),
    index("idx_pe_type").on(table.organizationId, table.eventType),
    index("idx_pe_status").on(table.organizationId, table.status),
    index("idx_pe_upcoming")
      .on(table.organizationId, table.startAt)
      .where(sql`${table.status} IN ('planning', 'invitations_sent', 'confirmed')`),
  ],
);

// =============================================================================
// AWARD SUBMISSIONS
// =============================================================================

/**
 * Award submission tracking for PR-driven industry awards.
 *
 * Status lifecycle:
 *   'researching' → 'preparing' → 'submitted' → 'shortlisted' → 'won' | 'lost' | 'withdrawn'
 *
 * Documents (pointers to media_assets):
 *   submissionDocumentIds: the actual submission package
 *   supportingEvidenceIds: case studies, metrics, testimonials
 *
 * Cost tracking:
 *   entryFeeNaira: award entry fee (most have a cost)
 *
 * submissionDeadline and announcementDate drive the workflow timeline.
 */
export const awardSubmissions = pgTable(
  "award_submissions",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    awardName: varchar("award_name", { length: 200 }).notNull(),
    awardingBody: varchar("awarding_body", { length: 200 }),
    category: varchar("category", { length: 100 }),

    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }),
    announcementDate: timestamp("announcement_date", { withTimezone: true }),

    status: varchar("status", { length: 30 }).notNull().default("researching"),

    submissionDocumentIds: text("submission_document_ids").array(),
    supportingEvidenceIds: text("supporting_evidence_ids").array(),

    notes: text("notes"),

    entryFeeNaira: numeric("entry_fee_naira", { precision: 15, scale: 2 }),

    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_asw_entry_fee_non_negative", sql`${table.entryFeeNaira}::numeric >= 0`),

    // announcementDate must be after submissionDeadline (if both set)
    check(
      "chk_asw_announcement_after_deadline",
      sql`${table.announcementDate} IS NULL
        OR ${table.submissionDeadline} IS NULL
        OR ${table.announcementDate} >= ${table.submissionDeadline}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_asw_org").on(table.organizationId),
    index("idx_asw_status").on(table.organizationId, table.status),
    index("idx_asw_deadline")
      .on(table.submissionDeadline)
      .where(sql`${table.status} NOT IN ('won', 'lost', 'withdrawn')`),
    index("idx_asw_awarding_body").on(table.organizationId, table.awardingBody),
  ],
);

// =============================================================================
// ANALYST RELATIONS
// =============================================================================

/**
 * Analyst relations — Gartner, Forrester, IDC, etc.
 *
 * Firm and analyst are denormalized for v1. Promote to analyst_contacts
 * table (similar to journalist + contact) when this becomes its own CRM.
 *
 * Coverage areas: what topics this analyst covers
 *
 * Status: 'identified' | 'contacted' | 'engaged' | 'briefing_scheduled' | 'inactive'
 *
 * Briefing history: count of briefings held (detail via contact_interactions)
 * Report inclusions: structured record of analyst reports mentioning the org
 */
export const analystRelations = pgTable(
  "analyst_relations",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Firm and analyst (denormalized)
    firmName: varchar("firm_name", { length: 200 }).notNull(),
    analystName: varchar("analyst_name", { length: 200 }).notNull(),
    analystEmail: varchar("analyst_email", { length: 255 }),

    coverageAreas: text("coverage_areas").array(),

    status: varchar("status", { length: 30 }).notNull().default("identified"),

    briefingCount: integer("briefing_count").default(0).notNull(),
    lastBriefingAt: timestamp("last_briefing_at", { withTimezone: true }),

    // [{ reportName, publishDate, sentiment, quote }]
    reportInclusions: jsonb("report_inclusions"),

    notes: text("notes"),

    tags: text("tags").array(),

    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_ar_briefing_count_non_negative", sql`${table.briefingCount} >= 0`),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_ar_org").on(table.organizationId),
    index("idx_ar_firm").on(table.organizationId, table.firmName),
    index("idx_ar_status").on(table.organizationId, table.status),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const journalistsRelations = relations(journalists, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [journalists.id],
    references: [contacts.id],
    relationName: "contact_journalist",
  }),

  coverageAttributions: many(prCoverageAttribution, {
    relationName: "journalist_coverageAttributions",
  }),

  // Cross-module references (resolved at application layer):
  //   Interactions → contact_interactions WHERE contact_id = this.id
  //     (shared/contacts.ts)
}));

export const pressReleasesRelations = relations(pressReleases, ({ many }) => ({
  distributions: many(prDistributions, {
    relationName: "pressRelease_distributions",
  }),
  coverageAttributions: many(prCoverageAttribution, {
    relationName: "pressRelease_coverageAttributions",
  }),

  // Cross-module references (resolved at application layer):
  //   currentApprovalRequestId → approval_requests.id (shared/approval.ts)
  //   mediaIds → media_assets.id (shared/media.ts)
  //   Interactions → contact_interactions WHERE press_release_id = this.id
  //   Audit → audit_log WHERE source_module = 'pr' AND resource_id = this.id
}));

export const prDistributionsRelations = relations(prDistributions, ({ one }) => ({
  pressRelease: one(pressReleases, {
    fields: [prDistributions.pressReleaseId],
    references: [pressReleases.id],
    relationName: "pressRelease_distributions",
  }),

  // Cross-module references (resolved at application layer):
  //   targetJournalistIds → journalists.id (this module)
  //   contact_interactions WHERE distribution_id = this.id
}));

export const prInitiativesRelations = relations(prInitiatives, (_) => ({
  // pressReleaseIds is TEXT[] — resolved at application layer:
  //   SELECT * FROM press_releases WHERE id = ANY(initiative.press_release_ids)
}));

export const prCoverageAttributionRelations = relations(prCoverageAttribution, ({ one }) => ({
  pressRelease: one(pressReleases, {
    fields: [prCoverageAttribution.pressReleaseId],
    references: [pressReleases.id],
    relationName: "pressRelease_coverageAttributions",
  }),
  journalist: one(journalists, {
    fields: [prCoverageAttribution.journalistId],
    references: [journalists.id],
    relationName: "journalist_coverageAttributions",
  }),

  // Cross-module references (resolved at application layer):
  //   articleId → media_articles.id (monitoring module)
}));

export const mediaListsRelations = relations(mediaLists, (_) => ({
  // memberIds is TEXT[] — resolved at application layer
  // parentListIds is TEXT[] — resolved at application layer
}));

export const pitchTemplatesRelations = relations(pitchTemplates, (_) => ({
  // No relations — standalone template table
}));

export const prEventsRelations = relations(prEvents, ({ one }) => ({
  // pressReleaseId → press_releases.id (no FK; soft reference)
  pressRelease: one(pressReleases, {
    fields: [prEvents.pressReleaseId],
    references: [pressReleases.id],
  }),
}));

export const awardSubmissionsRelations = relations(awardSubmissions, (_) => ({
  // No relations — standalone table
  // submissionDocumentIds, supportingEvidenceIds are TEXT[] of media_assets.id
}));

export const analystRelationsRelations = relations(analystRelations, (_) => ({
  // No relations — denormalized analyst contact data for v1
  // Promote to analyst_contacts table when this becomes its own CRM
}));
