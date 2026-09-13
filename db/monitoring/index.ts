// db/schema/monitoring/index.ts
//
// Media monitoring module — v5 (consolidated + source registry + mentions).
//
// Tables (6):
//   monitoring_campaigns   — keyword/boolean search configurations
//   news_sources           — curated registry of media outlets
//   social_mentions        — ingested social media posts (passive, no workflow)
//   media_articles         — ingested articles from news, blogs, broadcast
//   monitoring_competitors — competitive tracking targets
//   crisis_incidents       — crisis detection and lifecycle management
//
// Tables removed → shared modules:
//   monitoring_alerts          → shared/alerts.ts (alert_rules + alert_events)
//   monitoring_daily_summary   → shared/analytics.ts (analytics_aggregates)
//   competitors (listening v1) → monitoring_competitors here
//   social_mentions (v1)       → engagement module (engagement_messages)
//
// Design decisions:
//
//   No FK to organizations, users, or cross-module tables:
//     organizationId, createdById, acknowledgedBy, resolvedBy are plain
//     varchar. Monitoring data must survive user/org deletion for
//     compliance (NDPR) and analytics continuity.
//
//   Intra-module FKs (where retention profiles match):
//     media_articles.monitoringCampaignId → monitoring_campaigns.id
//       (SET NULL on delete; articles outlive campaign definitions)
//     media_articles.competitorId → monitoring_competitors.id
//       (SET NULL on delete)
//     media_articles.originalArticleId → media_articles.id
//       (self-FK, SET NULL on delete)
//     media_articles.sourceId → news_sources.id
//       (SET NULL on delete; articles survive source removal)
//     crisis_incidents.originArticleId → media_articles.id
//       (SET NULL on delete; crisis survives article removal)
//
//   Cross-module references (NOT FK — resolved at application layer):
//     crisis_incidents.originAlertEventId → alert_events.id
//     The crisis must survive alert cleanup (different retention).
//
//   Execution tracking:
//     lastRunStatus + lastRunAt + lastRunDurationMs + lastRunError.
//     Single status column (success/failed/partial) instead of two
//     separate timestamp columns. lastRunError is NULL when successful.
//
//   nextRunAt is NOT stored:
//     Schedulers compute next-run from alertFrequency + lastRunAt at
//     query time. Storing nextRunAt would create drift on schedule
//     changes and write contention on scheduler polls.
//
//   No soft delete on articles:
//     isArchived flag (false = active) replaces deletedAt columns.
//     Articles are never hard-deleted; archival preserves history.
//
//   Editorial review (single-user, not multi-user):
//     isReviewed + reviewedAt + reviewedBy is a flat per-article flag.
//     For multi-user review workflows (assignee, due date, notes),
//     promote to media_article_reviews table (out of scope for v1).
//
//   View tracking (global, not per-agent):
//     lastViewedAt is the global "anyone has viewed" flag.
//     For per-agent tracking (who viewed, when, duration),
//     build media_article_views table (out of scope for v1).
//
//   Resolution timing:
//     resolvedAt/resolvedBy are required when status is resolved
//     OR false_positive (both are terminal states with accountability).
//
//   Brand color is NOT stored:
//     brandColor on competitors is a UI concern, not a data concern.
//     Store in frontend theme config.

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
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  brandMentionContextEnum,
  competitorCategoryEnum,
  credibilityRatingEnum,
  crisisStatusEnum,
  mediaArticleSourceTypeEnum,
  mentionSourceEnum,
  mentionTypeEnum,
  monitoringCampaignStatusEnum,
  newsSourceTypeEnum,
  platformEnum,
  politicalLeaningEnum,
  processingStatusEnum,
  sentimentLabelEnum,
  sourceStatusEnum,
  sourceTierEnum,
} from "../shared/enums";

// =============================================================================
// MONITORING CAMPAIGNS
// =============================================================================

/**
 * Keyword/boolean search configurations for media monitoring.
 *
 * A campaign defines WHAT to monitor:
 *   - keywords: ['brand name', 'product name', 'CEO name']
 *   - booleanExpression: '("brand name" OR "product") AND -competitor'
 *   - sourceTypes, languages, countries, minAuthorityScore
 *
 * When booleanExpression is set, it overrides keywords at query time.
 * However, keywords must still be populated (NOT NULL + non-empty)
 * for keyword-level analytics and as a fallback if booleanExpression
 * is malformed.
 *
 * Quality scores:
 *   precisionScore, recallScore, noiseRatio are updated by background
 *   jobs to help users tune their search queries. They are not
 *   mathematically constrained (noise ≠ 1 - precision in all cases).
 *
 * Execution tracking:
 *   lastRunStatus, lastRunAt, lastRunDurationMs, lastRunError. The
 *   pipeline updates these on each run. lastRunError is NULL on success.
 *   nextRunAt is NOT stored — schedulers compute it from alertFrequency.
 */
export const monitoringCampaigns = pgTable(
  "monitoring_campaigns",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Campaign Details ─────────────────────────────────────────────────────
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // ─── Ownership ────────────────────────────────────────────────────────────
    // The user responsible for the campaign (may differ from creator)
    ownerId: varchar("owner_id", { length: 32 }),

    // ─── Search Configuration ─────────────────────────────────────────────────
    keywords: text("keywords").array().notNull(),

    // Full boolean expression — overrides simple keywords when set
    booleanExpression: text("boolean_expression"),

    // Structured query configuration (richer than flat keywords + booleanExpression)
    queryConfig: jsonb("query_config")
      .$type<{
        includeTerms?: Array<string>;
        excludeTerms?: Array<string>;
        exactPhrases?: Array<string>;
        anyOfTerms?: Array<string>;

        // Hashtag/mention filters
        hashtags?: Array<string>;
        excludeHashtags?: Array<string>;
        mentions?: Array<string>;
        excludeAccounts?: Array<string>;

        // Engagement filters
        minLikes?: number;
        minShares?: number;
        minComments?: number;
        minFollowers?: number;

        // Content filters
        hasLinks?: boolean;
        hasMedia?: boolean;
        hasVideo?: boolean;
        isVerifiedOnly?: boolean;

        // Sentiment filters
        sentiment?: Array<"positive" | "negative" | "neutral">;

        // Custom scoring weights
        weightings?: {
          keywords?: number;
          hashtags?: number;
          mentions?: number;
          engagement?: number;
          authorScore?: number;
        };
      }>()
      .default({}),

    sourceTypes: text("source_types").array().notNull(),
    languages: text("languages").array(),
    countries: text("countries").array(),
    minAuthorityScore: integer("min_authority_score").default(0).notNull(),

    excludeObituaries: boolean("exclude_obituaries").default(true).notNull(),
    excludeClassifieds: boolean("exclude_classifieds").default(true).notNull(),

    // ─── Platform & Geo Scope ──────────────────────────────────────────────────
    platformSettings: jsonb("platform_settings")
      .$type<{
        [platform: string]: {
          enabled: boolean;
          filters?: Record<string, any>;
          rateLimit?: number;
          apiEndpoint?: string;
          credentialsId?: string;
        };
      }>()
      .default({}),

    geoScope: jsonb("geo_scope")
      .$type<{
        countries?: Array<string>;
        regions?: Array<string>;
        cities?: Array<string>;
        radius?: {
          latitude: number;
          longitude: number;
          radiusKm: number;
        };
        customRegions?: Array<{
          name: string;
          coordinates: Array<{ lat: number; lng: number }>;
        }>;
      }>()
      .default({}),

    // ─── Alert Configuration ──────────────────────────────────────────────────
    alertEnabled: boolean("alert_enabled").default(false).notNull(),
    alertFrequency: varchar("alert_frequency", { length: 20 }).default("daily").notNull(),
    alertThreshold: integer("alert_threshold"),
    alertRecipients: jsonb("alert_recipients"),

    // ─── Scheduling ─────────────────────────────────────────────────────────────
    schedule: jsonb("schedule")
      .$type<{
        timezone?: string;
        daysOfWeek?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
        hoursOfDay?: Array<number>;
        interval?: number;
        cronExpression?: string;
      }>()
      .default({}),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: monitoringCampaignStatusEnum("status").default("active").notNull(),

    // ─── Quality Metrics ──────────────────────────────────────────────────────
    estimatedMonthlyArticles: integer("estimated_monthly_articles"),
    actualMonthlyArticles: integer("actual_monthly_articles"),

    precisionScore: decimal("precision_score", { precision: 3, scale: 2 }),
    recallScore: decimal("recall_score", { precision: 3, scale: 2 }),
    noiseRatio: decimal("noise_ratio", { precision: 3, scale: 2 }),

    // ─── Reach Estimate ───────────────────────────────────────────────────────
    // Estimated audience reach for matched articles (used for planning).
    // Distinct from estimatedMonthlyArticles (count vs people).
    estimatedReach: bigint("estimated_reach", { mode: "number" }),

    // ─── Execution Tracking ───────────────────────────────────────────────────
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),

    // 'success' | 'failed' | 'partial' | NULL (never run)
    lastRunStatus: varchar("last_run_status", { length: 20 }),
    lastRunDurationMs: integer("last_run_duration_ms"),
    lastRunError: text("last_run_error"),

    // ─── Execution Health ──────────────────────────────────────────────────────
    executionCount: integer("execution_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    // Rate limiting
    rateLimit: integer("rate_limit").default(100),
    rateLimitRemaining: integer("rate_limit_remaining"),
    rateLimitReset: timestamp("rate_limit_reset", { withTimezone: true }),

    totalMatches: integer("total_matches").default(0).notNull(),

    // ─── Data Retention ────────────────────────────────────────────────────────
    retentionDays: integer("retention_days").default(90),
    samplingRate: decimal("sampling_rate", { precision: 3, scale: 2 }).default("1.00"),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: varchar("created_by_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_mc_keywords_not_empty", sql`array_length(${table.keywords}, 1) > 0`),
    check("chk_mc_source_types_not_empty", sql`array_length(${table.sourceTypes}, 1) > 0`),
    check("chk_mc_authority_score_range", sql`${table.minAuthorityScore} BETWEEN 0 AND 100`),
    check(
      "chk_mc_precision_range",
      sql`${table.precisionScore} IS NULL
        OR ${table.precisionScore} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_mc_recall_range",
      sql`${table.recallScore} IS NULL
        OR ${table.recallScore} BETWEEN 0 AND 1`,
    ),
    check(
      "chk_mc_noise_range",
      sql`${table.noiseRatio} IS NULL
        OR ${table.noiseRatio} BETWEEN 0 AND 1`,
    ),
    check("chk_mc_total_matches", sql`${table.totalMatches} >= 0`),
    check(
      "chk_mc_alert_threshold",
      sql`${table.alertThreshold} IS NULL
        OR ${table.alertThreshold} > 0`,
    ),

    // alertThreshold required when alertEnabled = true
    check(
      "chk_mc_alert_threshold_required",
      sql`${table.alertEnabled} = FALSE
        OR ${table.alertThreshold} IS NOT NULL`,
    ),

    // lastRunError only when lastRunStatus = 'failed' or 'partial'
    check(
      "chk_mc_last_run_error_consistency",
      sql`${table.lastRunError} IS NULL
        OR ${table.lastRunStatus} IN ('failed', 'partial')`,
    ),

    // lastRunDurationMs must be non-negative
    check(
      "chk_mc_last_run_duration_non_negative",
      sql`${table.lastRunDurationMs} IS NULL
        OR ${table.lastRunDurationMs} >= 0`,
    ),

    // lastRunStatus allowed values
    check(
      "chk_mc_last_run_status_values",
      sql`${table.lastRunStatus} IS NULL
        OR ${table.lastRunStatus} IN ('success', 'failed', 'partial')`,
    ),

    // estimatedReach must be non-negative
    check(
      "chk_mc_estimated_reach",
      sql`${table.estimatedReach} IS NULL
        OR ${table.estimatedReach} >= 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_mc_org").on(table.organizationId),
    index("idx_mc_status").on(table.organizationId, table.status),
    index("idx_mc_owner").on(table.ownerId),

    index("idx_mc_alert")
      .on(table.alertEnabled, table.alertFrequency)
      .where(sql`${table.alertEnabled} = TRUE`),

    index("idx_mc_last_run").on(table.lastRunAt).where(sql`${table.status} = 'active'`),

    // Recent errors — operations dashboard
    index("idx_mc_last_run_failed")
      .on(table.organizationId, table.lastRunAt)
      .where(sql`${table.lastRunStatus} IN ('failed', 'partial')`),

    // Scheduler queue — active campaigns needing execution
    index("idx_mc_next_run")
      .on(table.status, table.nextRunAt)
      .where(sql`${table.status} = 'active'`),

    // Execution health — campaigns with high error rates
    index("idx_mc_error_count")
      .on(table.organizationId, table.errorCount)
      .where(sql`${table.errorCount} > 0`),

    // Data retention — campaigns due for archival
    index("idx_mc_retention")
      .on(table.organizationId, table.retentionDays)
      .where(sql`${table.retentionDays} IS NOT NULL`),
  ],
);

// =============================================================================
// NEWS SOURCES (SOURCE REGISTRY)
// =============================================================================

/**
 * Curated registry of media outlets (news websites, newspapers, TV stations,
 * blogs, etc.) that the organization monitors.
 *
 * This is the "source side" of the monitoring data model. Each news_source
 * represents a publication outlet with its own crawl configuration, credibility
 * ratings, authority metrics, and relevance scoring. Articles ingested by
 * the monitoring system link to this table via media_articles.sourceId.
 *
 * Previously, source metadata lived as flat columns (sourceName, sourceType,
 * sourceAuthorityScore) directly on every media_articles row. Normalising into
 * a source registry enables:
 *   - Tracking a publication's reputation over time
 *   - Per-source crawl configuration (frequency, depth, filters)
 *   - Deduplication of source identity (one row per outlet)
 *   - Rich discovery queries: "show me every article from tier-1 sources
 *     with credibility >= 70"
 *
 * Design decisions:
 *
 *   No FK to users/orgs:
 *     verifiedBy is varchar (not FK) to match the module convention.
 *     Audit trail is captured in unified_audit_log (module='monitoring').
 *
 *   Soft delete via deletedAt:
 *     Unlike media_articles (which uses isArchived), sources use a
 *     standard deletedAt column because source removal is rare and
 *     unequivocal — you either trust the outlet or you don't.
 *
 *   Media assets routed through shared media_assets table:
 *     Logo, icon, favicon, cover image are NOT stored on this row.
 *     Attach via media_assets (attachedToType='news_source') instead.
 *
 *   Outlet social handles vs connected social accounts:
 *     outletSocialHandles stores the outlet's OWN public social profiles.
 *     This is distinct from the social_accounts table, which tracks
 *     YOUR organization's connected accounts for publishing.
 *
 *   Interactions routed through shared contact_interactions:
 *     The interactions JSONB from the reference schema is omitted.
 *     If a news source doubles as a journalist relationship, record
 *     interactions in contact_interactions (contactType='outlet').
 *
 *   Syndication tracking omitted:
 *     partnerships/syndicatedBy/syndicatesFrom are low-priority and
 *     add schema bloat for a feature that may never be used.
 */
export const newsSources = pgTable(
  "news_sources",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // ─── Source Identity ───────────────────────────────────────────────────────
    name: varchar("name", { length: 500 }).notNull(),
    displayName: varchar("display_name", { length: 500 }),
    slug: varchar("slug", { length: 255 }).unique(),
    description: text("description"),
    tagline: varchar("tagline", { length: 500 }),

    type: newsSourceTypeEnum("type").notNull(),
    tier: sourceTierEnum("tier").notNull().default("tier_3"),

    // ─── Web Presence ──────────────────────────────────────────────────────────
    website: text("website"),
    rssFeeds: jsonb("rss_feeds")
      .$type<
        Array<{
          url: string;
          type: "main" | "category" | "author" | "tag";
          category?: string;
          lastChecked?: string;
          itemCount?: number;
          isActive: boolean;
        }>
      >()
      .default([]),
    sitemapUrl: text("sitemap_url"),
    apiEndpoint: text("api_endpoint"),

    // ─── Contact & Coverage ────────────────────────────────────────────────────
    contactInfo: jsonb("contact_info")
      .$type<{
        email?: string;
        phone?: string;
        pressEmail?: string;
        newsroomEmail?: string;
        tipsEmail?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
        };
      }>()
      .default({}),

    coverage: jsonb("coverage")
      .$type<{
        geographic?: {
          global?: boolean;
          countries?: Array<string>;
          regions?: Array<string>;
          states?: Array<string>;
          cities?: Array<string>;
        };
        topics?: Array<string>;
        industries?: Array<string>;
        categories?: Array<string>;
        languages?: Array<string>;
      }>()
      .default({}),

    // ─── Outlet Social Handles ─────────────────────────────────────────────────
    // The outlet's own public social profiles (not to be confused with
    // the social_accounts table which tracks YOUR connected accounts).
    outletSocialHandles: jsonb("outlet_social_handles")
      .$type<{
        twitter?: {
          handle: string;
          url: string;
          verified?: boolean;
          followers?: number;
        };
        facebook?: {
          handle: string;
          url: string;
          verified?: boolean;
          followers?: number;
        };
        instagram?: {
          handle: string;
          url: string;
          verified?: boolean;
          followers?: number;
        };
        linkedin?: {
          handle: string;
          url: string;
          followers?: number;
        };
        youtube?: {
          handle: string;
          url: string;
          subscribers?: number;
        };
      }>()
      .default({}),

    // ─── Classification & Ratings ──────────────────────────────────────────────
    politicalLeaning: politicalLeaningEnum("political_leaning").default("neutral"),
    biasScore: decimal("bias_score", { precision: 4, scale: 2 }),

    credibilityRating: credibilityRatingEnum("credibility_rating").default("unknown"),
    credibilityScore: integer("credibility_score").default(50),

    factCheckRating: jsonb("fact_check_rating").$type<{
      rating?: "high" | "medium" | "low" | "mixed";
      score?: number;
      source?: string;
      lastUpdated?: string;
    }>(),

    // Authority metrics
    domainAuthority: integer("domain_authority"),
    pageAuthority: integer("page_authority"),
    trustFlow: integer("trust_flow"),
    citationFlow: integer("citation_flow"),
    monthlyVisitors: integer("monthly_visitors"),

    // ─── Editorial Information ─────────────────────────────────────────────────
    owner: varchar("owner", { length: 500 }),
    parentCompany: varchar("parent_company", { length: 500 }),
    foundedYear: integer("founded_year"),
    headquarters: varchar("headquarters", { length: 255 }),

    editorialInfo: jsonb("editorial_info")
      .$type<{
        editorInChief?: string;
        managingEditor?: string;
        newsroom?: {
          size?: number;
          locations?: Array<string>;
        };
        keyJournalists?: Array<{
          name: string;
          title?: string;
          beat?: string;
          email?: string;
          twitter?: string;
        }>;
        hasEthicsPolicy?: boolean;
        hasCorrectionsPolicy?: boolean;
        membershipAffiliations?: Array<string>;
      }>()
      .default({}),

    publishingStats: jsonb("publishing_stats")
      .$type<{
        avgArticlesPerDay?: number;
        avgArticlesPerWeek?: number;
        avgArticlesPerMonth?: number;
        totalArticles?: number;
        contentMix?: {
          news?: number;
          opinion?: number;
          analysis?: number;
          features?: number;
          multimedia?: number;
        };
        updateFrequency?: "realtime" | "hourly" | "daily" | "weekly" | "monthly";
        peakPublishingHours?: Array<number>;
        lastPublished?: string;
      }>()
      .default({}),

    // ─── Monitoring Configuration ──────────────────────────────────────────────
    status: sourceStatusEnum("status").notNull().default("monitoring"),

    monitoringSettings: jsonb("monitoring_settings")
      .$type<{
        enabled?: boolean;
        crawlFrequency?: "realtime" | "every_5min" | "every_15min" | "hourly" | "daily";
        crawlDepth?: number;
        maxArticlesPerCrawl?: number;
        includeCategories?: Array<string>;
        excludeCategories?: Array<string>;
        minWordCount?: number;
        specificAuthors?: Array<string>;
        minQualityScore?: number;
        excludeOpinion?: boolean;
        excludeSyndicated?: boolean;
        checkDuplicates?: boolean;
        similarityThreshold?: number;
      }>()
      .notNull()
      .default({
        enabled: true,
        crawlFrequency: "hourly",
        crawlDepth: 2,
        maxArticlesPerCrawl: 100,
        checkDuplicates: true,
        similarityThreshold: 0.85,
      }),

    lastCrawlAt: timestamp("last_crawl_at", { withTimezone: true }),
    nextCrawlAt: timestamp("next_crawl_at", { withTimezone: true }),
    crawlCount: integer("crawl_count").notNull().default(0),
    lastCrawlStatus: varchar("last_crawl_status", { length: 50 }),
    lastCrawlError: text("last_crawl_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    // ─── Technical Details ─────────────────────────────────────────────────────
    technicalInfo: jsonb("technical_info")
      .$type<{
        selectors?: {
          article?: string;
          title?: string;
          author?: string;
          date?: string;
          content?: string;
          image?: string;
        };
        apiKey?: string;
        apiFormat?: "json" | "xml" | "rss";
        rateLimit?: number;
        cms?: string;
        framework?: string;
        avgResponseTime?: number;
        uptime?: number;
        requiresAuth?: boolean;
        authType?: "basic" | "oauth" | "api_key";
      }>()
      .default({}),
    robotsTxt: text("robots_txt"),
    allowsCrawling: boolean("allows_crawling").notNull().default(true),

    // ─── Relevance & Importance ────────────────────────────────────────────────
    relevanceScore: integer("relevance_score").default(50),
    importanceScore: integer("importance_score").default(50),
    industryRelevance: jsonb("industry_relevance").$type<Record<string, number>>().default({}),
    topicTags: jsonb("topic_tags").$type<Array<string>>().default([]),
    expertiseAreas: jsonb("expertise_areas").$type<Array<string>>().default([]),

    relationshipStatus: varchar("relationship_status", { length: 50 }).default("neutral"),
    coverageStats: jsonb("coverage_stats")
      .$type<{
        totalMentions?: number;
        positiveMentions?: number;
        neutralMentions?: number;
        negativeMentions?: number;
        lastMentionDate?: string;
        avgSentiment?: number;
        frontPageMentions?: number;
        featureMentions?: number;
      }>()
      .default({}),

    // ─── Lists & Tags ──────────────────────────────────────────────────────────
    mediaLists: jsonb("media_lists").$type<Array<string>>().default([]),
    tags: jsonb("tags").$type<Array<string>>().default([]),
    customCategories: jsonb("custom_categories").$type<Array<string>>().default([]),

    isPriority: boolean("is_priority").notNull().default(false),
    isCompetitor: boolean("is_competitor").notNull().default(false),
    isPartner: boolean("is_partner").notNull().default(false),

    // ─── Verification ──────────────────────────────────────────────────────────
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: varchar("verified_by", { length: 32 }),

    verificationData: jsonb("verification_data")
      .$type<{
        method?: string;
        documents?: Array<string>;
        contactVerified?: boolean;
        domainVerified?: boolean;
        socialVerified?: boolean;
      }>()
      .default({}),

    qualityScore: integer("quality_score").default(50),
    qualityMetrics: jsonb("quality_metrics")
      .$type<{
        contentQuality?: number;
        updateFrequency?: number;
        technicalReliability?: number;
        editorialStandards?: number;
        transparency?: number;
      }>()
      .default({}),

    // ─── Metadata & Notes ──────────────────────────────────────────────────────
    metadata: jsonb("metadata")
      .$type<{
        source?: string;
        addedReason?: string;
        customFields?: Record<string, any>;
        externalIds?: {
          cision?: string;
          meltwater?: string;
          muckrack?: string;
        };
      }>()
      .default({}),
    internalNotes: text("internal_notes"),
    publicNotes: text("public_notes"),

    // ─── Timestamps ────────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Unique constraints (soft-delete aware)
    uniqueIndex("uq_ns_slug").on(table.slug).where(sql`deleted_at IS NULL`),
    uniqueIndex("uq_ns_website")
      .on(table.website)
      .where(sql`deleted_at IS NULL AND website IS NOT NULL`),

    // Core indexes
    index("idx_ns_name").on(table.name),
    index("idx_ns_type").on(table.type),
    index("idx_ns_tier").on(table.tier),
    index("idx_ns_status").on(table.status),

    // Quality & ratings
    index("idx_ns_credibility_rating").on(table.credibilityRating),
    index("idx_ns_credibility_score").on(table.credibilityScore),
    index("idx_ns_quality_score").on(table.qualityScore),
    index("idx_ns_relevance_score").on(table.relevanceScore),

    // Crawl queue
    index("idx_ns_next_crawl").on(table.nextCrawlAt),
    index("idx_ns_last_crawl").on(table.lastCrawlAt),

    // Flags
    index("idx_ns_priority").on(table.isPriority),
    index("idx_ns_verified").on(table.isVerified),
    index("idx_ns_competitor").on(table.isCompetitor),

    // Composite — active sources by tier
    index("idx_ns_active_tier")
      .on(table.status, table.tier, table.relevanceScore)
      .where(sql`status = 'monitoring' AND deleted_at IS NULL`),

    // Composite — crawl queue
    index("idx_ns_crawl_queue").on(table.status, table.nextCrawlAt, table.consecutiveFailures),

    // Composite — priority sources
    index("idx_ns_priority_queue")
      .on(table.isPriority, table.credibilityScore, table.relevanceScore)
      .where(sql`is_priority = true AND status = 'monitoring' AND deleted_at IS NULL`),

    index("idx_ns_created_at").on(table.createdAt),
  ],
);

// =============================================================================
// SOCIAL MENTIONS
// =============================================================================

/**
 * Ingested social media posts (Twitter/X, Facebook, Instagram, LinkedIn, TikTok,
 * YouTube, Reddit, etc.) discovered by monitoring campaigns.
 *
 * This table is deliberately PASSIVE — it holds the raw mention + enrichment
 * (content, author, sentiment, scores) but NO workflow columns (isRead,
 * assignedTo, etc.). When a mention needs a response, the response workflow
 * lives in engagement_messages (sourceMentionId FK).
 *
 * Design decisions:
 *
 *   Passive mention store:
 *     No isRead/isStarred/assignedTo/escalatedAt/respondedAt columns.
 *     Workflow routing is handled by engagementMessages, not duplicated here.
 *     This is option (a) from the schema review — one workflow system, not two.
 *
 *   Deduplication via (platform, platformId) unique index:
 *     Same post from the same platform is rejected at insert time.
 *     Soft delete via deletedAt for compliance recovery.
 *
 *   Author block mirrors engagementMessages.author*:
 *     Same author shape, same column names. When a mention escalates to a
 *     response, the engagementMessages row copies the author info at creation
 *     time so it remains readable even if the mention is later deleted.
 *
 *   Enrichment columns are nullable/optional:
 *     NLP pipeline runs async; the row is inserted with just content + platform
 *     data, then enrichment (sentiment, entities, scores) is backfilled.
 */
export const socialMentions = pgTable(
  "social_mentions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Real FK to monitoring_campaigns — CASCADE on delete
    // (mentions belong to a campaign; no campaign = no reason to keep them)
    campaignId: varchar("campaign_id", { length: 32 })
      .notNull()
      .references(() => monitoringCampaigns.id, { onDelete: "cascade" }),

    // ─── Platform & Identifiers ────────────────────────────────────────────────
    platform: platformEnum("platform").notNull(),
    source: mentionSourceEnum("source").notNull().default("social_media"),

    // Platform's own ID for this post (used for dedup)
    platformId: varchar("platform_id", { length: 255 }).notNull(),
    platformUrl: text("platform_url"),
    contentHash: varchar("content_hash", { length: 64 }),

    // ─── Content ───────────────────────────────────────────────────────────────
    mentionType: mentionTypeEnum("mention_type").notNull().default("mention"),
    title: varchar("title", { length: 500 }),
    content: text("content").notNull(),
    contentSnippet: varchar("content_snippet", { length: 500 }),
    language: varchar("language", { length: 10 }).default("en"),

    media: jsonb("media")
      .$type<
        Array<{
          type: "image" | "video" | "audio" | "document" | "gif";
          url: string;
          thumbnailUrl?: string;
          width?: number;
          height?: number;
          duration?: number;
          altText?: string;
        }>
      >()
      .default([]),
    hasMedia: boolean("has_media").notNull().default(false),

    // ─── Author ────────────────────────────────────────────────────────────────
    // Mirrors engagementMessages.author* shape for consistency
    authorPlatformId: varchar("author_platform_id", { length: 255 }),
    authorUsername: varchar("author_username", { length: 255 }),
    authorName: varchar("author_name", { length: 255 }),
    authorBio: text("author_bio"),
    authorAvatarUrl: text("author_avatar_url"),
    authorUrl: text("author_url"),

    authorFollowerCount: integer("author_follower_count").default(0),
    authorFollowingCount: integer("author_following_count").default(0),
    authorPostCount: integer("author_post_count").default(0),
    authorEngagementRate: decimal("author_engagement_rate", {
      precision: 5,
      scale: 2,
    }).default("0"),

    authorVerified: boolean("author_verified").notNull().default(false),
    authorInfluenceScore: integer("author_influence_score").default(0),
    authorTier: varchar("author_tier", { length: 20 }),

    // ─── Engagement Metrics ────────────────────────────────────────────────────
    // Per-post engagement counts (facts about this post, not rollups).
    // Daily aggregates of these belong in analytics_aggregates.
    likeCount: integer("like_count").default(0),
    commentCount: integer("comment_count").default(0),
    shareCount: integer("share_count").default(0),
    saveCount: integer("save_count").default(0),
    viewCount: integer("view_count").default(0),
    clickCount: integer("click_count").default(0),

    totalEngagement: integer("total_engagement").default(0),
    engagementRate: decimal("engagement_rate", {
      precision: 5,
      scale: 2,
    }).default("0"),

    estimatedReach: integer("estimated_reach").default(0),
    estimatedImpressions: integer("estimated_impressions").default(0),

    // ─── Sentiment & Tone ──────────────────────────────────────────────────────
    sentimentLabel: sentimentLabelEnum("sentiment_label"),
    sentimentScore: decimal("sentiment_score", { precision: 5, scale: 4 }),
    sentimentConfidence: decimal("sentiment_confidence", {
      precision: 4,
      scale: 3,
    }),

    emotions: jsonb("emotions")
      .$type<{
        joy?: number;
        sadness?: number;
        anger?: number;
        fear?: number;
        surprise?: number;
        disgust?: number;
        trust?: number;
        anticipation?: number;
      }>()
      .default({}),

    tone: jsonb("tone")
      .$type<{
        formal?: number;
        analytical?: number;
        confident?: number;
        tentative?: number;
        joyful?: number;
        sad?: number;
        angry?: number;
        anxious?: number;
        excited?: number;
        sarcastic?: number;
      }>()
      .default({}),

    // ─── Classification & Extraction ───────────────────────────────────────────
    keywords: jsonb("keywords")
      .$type<
        Array<{
          keyword: string;
          relevance: number;
          position: number;
          sentiment?: string;
        }>
      >()
      .default([]),
    hashtags: jsonb("hashtags").$type<Array<string>>().default([]),
    mentionedAccounts: jsonb("mentioned_accounts").$type<Array<string>>().default([]),
    urls: jsonb("urls").$type<Array<string>>().default([]),

    topics: jsonb("topics")
      .$type<
        Array<{
          name: string;
          confidence: number;
          category?: string;
        }>
      >()
      .default([]),
    categories: jsonb("categories").$type<Array<string>>().default([]),

    entities: jsonb("entities")
      .$type<
        Array<{
          type:
            | "person"
            | "organization"
            | "location"
            | "product"
            | "brand"
            | "event"
            | "date"
            | "money";
          name: string;
          confidence: number;
          sentiment?: string;
          metadata?: Record<string, any>;
        }>
      >()
      .default([]),

    brandMentions: jsonb("brand_mentions")
      .$type<
        Array<{
          brandName: string;
          context: string;
          sentiment: string;
          isPrimary: boolean;
          sentimentScore?: number;
        }>
      >()
      .default([]),

    // ─── Threading ─────────────────────────────────────────────────────────────
    parentId: varchar("parent_id", { length: 32 }),
    threadId: varchar("thread_id", { length: 255 }),

    isReply: boolean("is_reply").notNull().default(false),
    replyToUsername: varchar("reply_to_username", { length: 255 }),
    replyToPlatformId: varchar("reply_to_platform_id", { length: 255 }),

    conversationId: varchar("conversation_id", { length: 255 }),
    conversationDepth: integer("conversation_depth").default(0),
    conversationSize: integer("conversation_size").default(0),

    // ─── Location ──────────────────────────────────────────────────────────────
    locationName: varchar("location_name", { length: 255 }),
    locationCity: varchar("location_city", { length: 100 }),
    locationRegion: varchar("location_region", { length: 100 }),
    locationCountry: varchar("location_country", { length: 2 }),
    locationLatitude: decimal("location_latitude", { precision: 10, scale: 7 }),
    locationLongitude: decimal("location_longitude", {
      precision: 10,
      scale: 7,
    }),
    hasLocation: boolean("has_location").notNull().default(false),

    // ─── Relevance & Scoring ───────────────────────────────────────────────────
    relevanceScore: decimal("relevance_score", {
      precision: 5,
      scale: 2,
    }).default("0"),
    importanceScore: decimal("importance_score", {
      precision: 5,
      scale: 2,
    }).default("0"),
    viralityScore: decimal("virality_score", {
      precision: 5,
      scale: 2,
    }).default("0"),
    qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0"),

    matchedTerms: jsonb("matched_terms")
      .$type<
        Array<{
          term: string;
          type: "keyword" | "hashtag" | "mention" | "phrase" | "regex";
          position: number;
          score: number;
        }>
      >()
      .default([]),

    // ─── Flags ─────────────────────────────────────────────────────────────────
    flags: jsonb("flags")
      .$type<{
        isSpam?: boolean;
        isBot?: boolean;
        isNSFW?: boolean;
        isPotentialCrisis?: boolean;
        isOpportunity?: boolean;
        isComplaint?: boolean;
        isQuestion?: boolean;
        isPraise?: boolean;
        hasBrandMention?: boolean;
        hasCompetitorMention?: boolean;
        isDuplicate?: boolean;
      }>()
      .notNull()
      .default({}),

    moderationFlags: jsonb("moderation_flags")
      .$type<
        Array<{
          type: string;
          severity: "low" | "medium" | "high";
          confidence: number;
          reason: string;
        }>
      >()
      .default([]),

    spamScore: decimal("spam_score", { precision: 4, scale: 3 }).default("0"),
    toxicityScore: decimal("toxicity_score", {
      precision: 4,
      scale: 3,
    }).default("0"),
    authenticityScore: decimal("authenticity_score", {
      precision: 4,
      scale: 3,
    }).default("0"),

    // ─── AI Analysis ───────────────────────────────────────────────────────────
    aiAnalysis: jsonb("ai_analysis")
      .$type<{
        summary?: string;
        keyPoints?: Array<string>;
        suggestedResponse?: string;
        urgencyLevel?: "low" | "medium" | "high" | "critical";
        intent?:
          | "question"
          | "complaint"
          | "praise"
          | "suggestion"
          | "support"
          | "purchase_intent"
          | "feedback"
          | "other";
        intentConfidence?: number;
        analyzedAt?: string;
        modelVersion?: string;
      }>()
      .default({}),

    // ─── Processing ────────────────────────────────────────────────────────────
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    processingError: text("processing_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // ─── Metadata ──────────────────────────────────────────────────────────────
    metadata: jsonb("metadata")
      .$type<{
        crawlerId?: string;
        crawlerName?: string;
        importBatchId?: string;
        dataProvider?: string;
        customFields?: Record<string, any>;
      }>()
      .default({}),

    tags: jsonb("tags").$type<Array<string>>().default([]),

    // ─── Timestamps ────────────────────────────────────────────────────────────
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),

    lastEngagementAt: timestamp("last_engagement_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // ── Uniqueness ─────────────────────────────────────────────────────────────
    // Same post from the same platform — dedup at insert time
    uniqueIndex("uq_sm_platform_id")
      .on(table.platform, table.platformId)
      .where(sql`deleted_at IS NULL`),

    // ── Core lookups ───────────────────────────────────────────────────────────
    index("idx_sm_campaign").on(table.campaignId),
    index("idx_sm_org").on(table.organizationId),
    index("idx_sm_platform").on(table.platform),
    index("idx_sm_source").on(table.source),
    index("idx_sm_content_hash").on(table.contentHash),

    // Author lookups
    index("idx_sm_author_username").on(table.authorUsername),
    index("idx_sm_author_followers").on(table.authorFollowerCount),

    // Sentiment
    index("idx_sm_sentiment").on(table.sentimentLabel),
    index("idx_sm_sentiment_score").on(table.sentimentScore),

    // Engagement
    index("idx_sm_total_engagement").on(table.totalEngagement),
    index("idx_sm_engagement_rate").on(table.engagementRate),

    // Scores
    index("idx_sm_relevance_score").on(table.relevanceScore),
    index("idx_sm_importance_score").on(table.importanceScore),
    index("idx_sm_virality_score").on(table.viralityScore),

    // Threading
    index("idx_sm_parent").on(table.parentId),
    index("idx_sm_thread").on(table.threadId),

    // Processing
    index("idx_sm_processing_status").on(table.processingStatus),

    // Timestamps
    index("idx_sm_published_at").on(table.publishedAt),
    index("idx_sm_fetched_at").on(table.fetchedAt),

    // ── Composite ───────────────────────────────────────────────────────────────
    // Campaign feed — recent mentions for a campaign
    index("idx_sm_campaign_recent")
      .on(table.campaignId, table.publishedAt)
      .where(sql`deleted_at IS NULL`),

    // Processing queue — mentions awaiting enrichment
    index("idx_sm_processing_queue")
      .on(table.processingStatus, table.fetchedAt)
      .where(sql`processing_status IN ('pending', 'failed') AND deleted_at IS NULL`),

    // High-priority mentions
    index("idx_sm_high_priority")
      .on(table.organizationId, table.importanceScore, table.publishedAt)
      .where(sql`importance_score > 70 AND deleted_at IS NULL`),

    // Daily stats aggregate
    index("idx_sm_daily_stats")
      .on(table.organizationId, sql`DATE(published_at)`)
      .where(sql`deleted_at IS NULL`),
  ],
);

// =============================================================================
// MEDIA ARTICLES
// =============================================================================

/**
 * Ingested articles from news sources, blogs, broadcast transcripts.
 *
 * Ingestion flow:
 *   1. External feeds/crawlers discover articles
 *   2. URL uniqueness check + content hash check
 *   3. Insert with initial metadata
 *   4. NLP enrichment (sentiment, entities, impact)
 *   5. Campaign matcher links article to monitoringCampaignId
 *
 * Deduplication:
 *   url UNIQUE — same URL rejected at insert
 *   contentHash — catches syndicated articles under different URLs
 *   isDuplicate + originalArticleId — keeps all instances, marks chain
 *
 * Sentiment:
 *   headlineSentiment (40% weight) + bodySentiment (60% weight) =
 *   overallSentiment. All -1.00 to +1.00.
 *
 * Impact scoring (0–1000):
 *   Composite from: source authority, reach, sentiment strength,
 *   brand mention prominence, social amplification.
 *
 * Geographic metadata:
 *   country (ISO 3166-1 alpha-2), region, city for sub-national analysis.
 *
 * Editorial review:
 *   isReviewed + reviewedAt + reviewedBy is a per-article flag
 *   (not per-user). For multi-user review workflows, promote to
 *   media_article_reviews table.
 */
export const mediaArticles = pgTable(
  "media_articles",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Real FK to monitoring_campaigns — SET NULL on delete
    monitoringCampaignId: varchar("monitoring_campaign_id", {
      length: 32,
    }).references(() => monitoringCampaigns.id, { onDelete: "set null" }),

    // Real FK to news_sources — SET NULL on delete
    sourceId: varchar("source_id", { length: 32 }).references(() => newsSources.id, {
      onDelete: "set null",
    }),

    // ─── Article Metadata ─────────────────────────────────────────────────────
    title: text("title").notNull(),
    url: text("url").notNull().unique(),

    // Source outlet name
    sourceName: varchar("source_name", { length: 255 }).notNull(),

    // Source's main website (distinct from article URL)
    sourceWebsite: text("source_website"),

    sourceType: mediaArticleSourceTypeEnum("source_type"),

    // Content format (distinct from sourceType)
    // article | interview | podcast | television | radio | press_release | transcript
    mediaFormat: varchar("media_format", { length: 30 }),

    sourceTier: integer("source_tier"),
    sourceAuthorityScore: integer("source_authority_score").default(0).notNull(),

    author: varchar("author", { length: 255 }),
    authors: jsonb("authors")
      .$type<
        Array<{
          name: string;
          email?: string;
          bio?: string;
          url?: string;
          twitter?: string;
          avatar?: string;
        }>
      >()
      .default([]),
    excerpt: text("excerpt"),
    content: text("content"),

    // Word count and reading time (cached from content)
    wordCount: integer("word_count"),
    readingTimeMinutes: integer("reading_time_minutes"),

    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),

    language: varchar("language", { length: 5 }),

    // Geographic (sub-national)
    country: varchar("country", { length: 2 }),
    region: varchar("region", { length: 100 }),
    city: varchar("city", { length: 100 }),

    // ─── Sentiment ────────────────────────────────────────────────────────────
    headlineSentiment: decimal("headline_sentiment", {
      precision: 3,
      scale: 2,
    }),
    bodySentiment: decimal("body_sentiment", { precision: 3, scale: 2 }),
    overallSentiment: decimal("overall_sentiment", {
      precision: 3,
      scale: 2,
    }),
    sentimentLabel: sentimentLabelEnum("sentiment_label"),
    sentimentConfidence: decimal("sentiment_confidence", {
      precision: 3,
      scale: 2,
    }),

    // Emotional tone analysis
    emotions: jsonb("emotions").$type<{
      joy?: number;
      trust?: number;
      fear?: number;
      surprise?: number;
      sadness?: number;
      disgust?: number;
      anger?: number;
      anticipation?: number;
    }>(),

    tone: jsonb("tone").$type<{
      analytical?: number;
      confident?: number;
      tentative?: number;
      formal?: number;
      casual?: number;
    }>(),

    // ─── Impact Metrics ───────────────────────────────────────────────────────
    impactScore: integer("impact_score").default(0).notNull(),
    reachEstimate: bigint("reach_estimate", { mode: "number" }).default(0).notNull(),

    // Advertising Value Equivalent in Naira
    aveNaira: numeric("ave_naira", { precision: 15, scale: 2 }).default("0"),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Content Analysis ─────────────────────────────────────────────────────
    keyQuotes: text("key_quotes").array(),
    quotes: jsonb("quotes")
      .$type<
        Array<{
          text: string;
          speaker?: string;
          speakerTitle?: string;
          speakerOrganization?: string;
          context?: string;
          sentiment?: string;
          isDirectQuote: boolean;
          prominence: "headline" | "lede" | "body";
        }>
      >()
      .default([]),
    topicCategory: text("topic_category"),
    entityMentions: jsonb("entity_mentions"),
    brandMentionContext: brandMentionContextEnum("brand_mention_context"),

    // Structured brand mentions (richer upgrade of entityMentions)
    brandMentions: jsonb("brand_mentions")
      .$type<
        Array<{
          brandId?: string;
          brandName: string;
          mentionCount: number;
          prominence: "headline" | "lede" | "body" | "quote";
          sentiment: string;
          sentimentScore: number;
          contexts: Array<string>;
          quotes?: Array<string>;
        }>
      >()
      .default([]),

    competitorMentions: jsonb("competitor_mentions")
      .$type<
        Array<{
          competitorId?: string;
          name: string;
          mentionCount: number;
          sentiment: string;
          contexts: Array<string>;
        }>
      >()
      .default([]),

    peopleMentioned: jsonb("people_mentioned")
      .$type<
        Array<{
          name: string;
          title?: string;
          organization?: string;
          role?: string;
          isQuoted?: boolean;
          quotes?: Array<string>;
        }>
      >()
      .default([]),

    organizationsMentioned: jsonb("organizations_mentioned")
      .$type<
        Array<{
          name: string;
          type?: string;
          role?: string;
          mentionCount?: number;
        }>
      >()
      .default([]),

    locationsMentioned: jsonb("locations_mentioned")
      .$type<
        Array<{
          name: string;
          type: "city" | "state" | "country" | "region";
          coordinates?: {
            latitude: number;
            longitude: number;
          };
        }>
      >()
      .default([]),

    // ─── Competitive ──────────────────────────────────────────────────────────
    isCompetitive: boolean("is_competitive").default(false).notNull(),

    // Real FK to monitoring_competitors — SET NULL on delete
    competitorId: varchar("competitor_id", { length: 32 }).references(
      () => monitoringCompetitors.id,
      { onDelete: "set null" },
    ),

    // ─── Deduplication ────────────────────────────────────────────────────────
    isDuplicate: boolean("is_duplicate").default(false).notNull(),

    // Self-FK to canonical article — SET NULL on delete
    originalArticleId: varchar("original_article_id", { length: 32 }),

    contentHash: varchar("content_hash", { length: 64 }),

    // ─── Social Amplification ─────────────────────────────────────────────────
    socialShares: jsonb("social_shares"),

    // Richer social metrics (upgrade of socialShares)
    socialMetrics: jsonb("social_metrics")
      .$type<{
        facebook?: {
          shares?: number;
          comments?: number;
          reactions?: number;
        };
        twitter?: {
          tweets?: number;
          retweets?: number;
          likes?: number;
          replies?: number;
        };
        linkedin?: {
          shares?: number;
          comments?: number;
          reactions?: number;
        };
        reddit?: {
          posts?: number;
          upvotes?: number;
          comments?: number;
        };
        pinterest?: {
          pins?: number;
        };
      }>()
      .default({}),
    totalShares: integer("total_shares").default(0),
    totalEngagements: integer("total_engagements").default(0),

    // ─── Content Flags ─────────────────────────────────────────────────────────
    isBreakingNews: boolean("is_breaking_news").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    isExclusive: boolean("is_exclusive").notNull().default(false),
    isOpinion: boolean("is_opinion").notNull().default(false),
    isSatire: boolean("is_satire").notNull().default(false),

    // ─── Syndication ───────────────────────────────────────────────────────────
    isSyndicated: boolean("is_syndicated").notNull().default(false),
    originalSource: varchar("original_source", { length: 500 }),
    syndicatedFrom: varchar("syndicated_from", { length: 32 }).references(() => newsSources.id, {
      onDelete: "set null",
    }),

    // ─── Editorial Review ─────────────────────────────────────────────────────
    // Per-article flag (not per-user; see table-level comment)
    isReviewed: boolean("is_reviewed").default(false).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: varchar("reviewed_by", { length: 32 }),

    // ─── View Tracking (global flag) ──────────────────────────────────────────
    // lastViewedAt = "anyone has viewed this article"
    // For per-agent tracking, build media_article_views table.
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),

    // ─── Archival ─────────────────────────────────────────────────────────────
    isArchived: boolean("is_archived").default(false).notNull(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "chk_ma_source_tier",
      sql`${table.sourceTier} IS NULL
        OR ${table.sourceTier} IN (1, 2, 3)`,
    ),
    check("chk_ma_authority_score", sql`${table.sourceAuthorityScore} BETWEEN 0 AND 100`),
    check("chk_ma_impact_score", sql`${table.impactScore} BETWEEN 0 AND 1000`),

    check(
      "chk_ma_headline_sentiment",
      sql`${table.headlineSentiment} IS NULL
        OR ${table.headlineSentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_ma_body_sentiment",
      sql`${table.bodySentiment} IS NULL
        OR ${table.bodySentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_ma_overall_sentiment",
      sql`${table.overallSentiment} IS NULL
        OR ${table.overallSentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_ma_sentiment_confidence",
      sql`${table.sentimentConfidence} IS NULL
        OR ${table.sentimentConfidence} BETWEEN 0 AND 1`,
    ),
    check("chk_ma_reach_estimate", sql`${table.reachEstimate} >= 0`),

    check(
      "chk_ma_no_self_duplicate",
      sql`${table.originalArticleId} IS NULL
        OR ${table.originalArticleId} <> ${table.id}`,
    ),

    // isDuplicate consistency
    check(
      "chk_ma_duplicate_consistency",
      sql`(${table.isDuplicate} = FALSE AND ${table.originalArticleId} IS NULL)
        OR (${table.isDuplicate} = TRUE AND ${table.originalArticleId} IS NOT NULL)`,
    ),

    // Editorial review consistency
    check(
      "chk_ma_reviewed_consistency",
      sql`(${table.reviewedAt} IS NULL) = (${table.reviewedBy} IS NULL)
        AND (${table.isReviewed} = FALSE)
            = (${table.reviewedAt} IS NULL)`,
    ),

    // wordCount must be non-negative (if set)
    check("chk_ma_word_count", sql`${table.wordCount} IS NULL OR ${table.wordCount} >= 0`),

    // readingTimeMinutes must be non-negative (if set)
    check(
      "chk_ma_reading_time",
      sql`${table.readingTimeMinutes} IS NULL
        OR ${table.readingTimeMinutes} >= 0`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_ma_org_published").on(table.organizationId, table.publishedAt),

    // Recently ingested
    index("idx_ma_ingested").on(table.organizationId, table.ingestedAt),

    // Top-quality sources (your suggestion)
    index("idx_ma_org_authority").on(
      table.organizationId,
      table.sourceAuthorityScore,
      table.publishedAt,
    ),

    // Dashboard ranking (your suggestion)
    index("idx_ma_org_impact").on(table.organizationId, table.impactScore, table.publishedAt),

    index("idx_ma_sentiment").on(table.organizationId, table.sentimentLabel, table.publishedAt),

    index("idx_ma_campaign").on(table.monitoringCampaignId, table.publishedAt),

    index("idx_ma_competitive")
      .on(table.organizationId, table.isCompetitive, table.publishedAt)
      .where(sql`${table.isCompetitive} = TRUE`),

    index("idx_ma_impact").on(table.organizationId, table.impactScore),

    index("idx_ma_hash").on(table.contentHash).where(sql`${table.contentHash} IS NOT NULL`),

    index("idx_ma_source").on(table.organizationId, table.sourceName),

    index("idx_ma_tier")
      .on(table.organizationId, table.sourceTier, table.publishedAt)
      .where(sql`${table.sourceTier} IS NOT NULL`),

    // Regional analysis (your suggestion)
    index("idx_ma_org_country").on(table.organizationId, table.country, table.publishedAt),

    index("idx_ma_active")
      .on(table.organizationId, table.publishedAt)
      .where(sql`${table.isArchived} = FALSE`),

    index("idx_ma_original").on(table.originalArticleId).where(sql`${table.isDuplicate} = TRUE`),

    // Unreviewed articles — editorial review queue
    index("idx_ma_pending_review")
      .on(table.organizationId, table.publishedAt)
      .where(
        sql`${table.isReviewed} = FALSE
          AND ${table.impactScore} >= 500
          AND ${table.isArchived} = FALSE`,
      ),

    // Full-text search (raw SQL migration):
    // CREATE INDEX idx_ma_fts ON media_articles
    //   USING GIN(to_tsvector('english',
    //     title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')))
    //   WHERE is_archived = FALSE;

    // Entity search (raw SQL migration):
    // CREATE INDEX idx_ma_entities ON media_articles
    //   USING GIN(entity_mentions) WHERE entity_mentions IS NOT NULL;
  ],
);

// =============================================================================
// MONITORING COMPETITORS
// =============================================================================

/**
 * Competitive tracking targets.
 *
 * Each competitor has keywords used to detect mentions in articles.
 * Matched articles set media_articles.isCompetitive = true and
 * competitorId = this record's id.
 *
 * Category:
 *   direct       — same market, same product
 *   indirect     — adjacent market, substitute product
 *   aspirational — market leader we aspire to match
 *
 * Two distinct share metrics:
 *   shareOfVoice  — auto-computed from article data (media coverage share)
 *   marketShare   — manually entered (actual market position, requires
 *                    market research data; updated quarterly/annually)
 */
export const monitoringCompetitors = pgTable(
  "monitoring_competitors",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    keywords: text("keywords").array().notNull(),
    category: competitorCategoryEnum("category").default("direct").notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    logoUrl: text("logo_url"),
    website: text("website"),

    // Social profiles across platforms (JSONB; promote to a table if
    // per-platform query patterns emerge)
    socialProfiles: jsonb("social_profiles"),

    // ─── Metrics (denormalized — updated by background job) ───────────────────
    shareOfVoice: decimal("share_of_voice", { precision: 5, scale: 2 }),
    lastMentionedAt: timestamp("last_mentioned_at", { withTimezone: true }),
    mentionCount: integer("mention_count").default(0).notNull(),
    avgSentiment: decimal("avg_sentiment", { precision: 3, scale: 2 }),

    // Market share (manually entered, requires market research data)
    marketShare: decimal("market_share", { precision: 5, scale: 2 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_comp_keywords_not_empty", sql`array_length(${table.keywords}, 1) > 0`),
    check("chk_comp_mention_count", sql`${table.mentionCount} >= 0`),
    check(
      "chk_comp_sov_range",
      sql`${table.shareOfVoice} IS NULL
        OR ${table.shareOfVoice} BETWEEN 0 AND 100`,
    ),
    check(
      "chk_comp_avg_sentiment",
      sql`${table.avgSentiment} IS NULL
        OR ${table.avgSentiment} BETWEEN -1 AND 1`,
    ),
    check(
      "chk_comp_market_share_range",
      sql`${table.marketShare} IS NULL
        OR ${table.marketShare} BETWEEN 0 AND 100`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_comp_org_active").on(table.organizationId, table.isActive),
    index("idx_comp_category").on(table.organizationId, table.category),

    // Competitive ranking (your suggestion)
    index("idx_comp_mentions")
      .on(table.organizationId, table.mentionCount)
      .where(sql`${table.isActive} = TRUE`),

    index("idx_comp_sov")
      .on(table.organizationId, table.shareOfVoice)
      .where(sql`${table.isActive} = TRUE`),
  ],
);

// =============================================================================
// CRISIS INCIDENTS
// =============================================================================

/**
 * Crisis detection and lifecycle management.
 *
 * Lifecycle:
 *   active → acknowledged → monitoring → resolved | false_positive
 *
 * Both resolved and false_positive are terminal states requiring
 * resolvedAt + resolvedBy for accountability.
 *
 * Severity (1–5):
 *   1 = minor: single negative article, limited reach
 *   2 = moderate: multiple articles, growing social discussion
 *   3 = significant: major outlet coverage, significant reach
 *   4 = severe: widespread coverage, trending on social, exec attention
 *   5 = critical: regulatory/legal exposure, CEO must respond
 *
 * Two distinct impact metrics:
 *   estimatedAveImpactNaira  — "what would this coverage have cost
 *                              as advertising" (AVE = Advertising Value
 *                              Equivalent). Wide industry adoption.
 *   estimatedFinancialImpactNaira — "what did this actually cost us"
 *                              (lost sales, customer churn, regulatory
 *                              fines). Requires manual entry or
 *                              integration with financial systems.
 *
 * Public statement tracking:
 *   publicStatementIssued + publicStatementUrl + publicStatementIssuedAt
 *   form a complete audit trail of crisis communications.
 */
export const crisisIncidents = pgTable(
  "crisis_incidents",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    severity: integer("severity").notNull(),

    // active | acknowledged | monitoring | resolved | false_positive
    status: crisisStatusEnum("status").default("active").notNull(),

    // ─── Commander ────────────────────────────────────────────────────────────
    incidentCommanderId: varchar("incident_commander_id", { length: 32 }),
    incidentCommanderAssignedAt: timestamp("incident_commander_assigned_at", {
      withTimezone: true,
    }),

    // ─── Origin ───────────────────────────────────────────────────────────────
    originPlatform: varchar("origin_platform", { length: 50 }),

    // Real FK to media_articles — SET NULL on delete
    originArticleId: varchar("origin_article_id", { length: 32 }).references(
      () => mediaArticles.id,
      { onDelete: "set null" },
    ),

    // Cross-module — NOT FK (alert retention differs)
    originAlertEventId: varchar("origin_alert_event_id", { length: 32 }),

    // ─── Timing ───────────────────────────────────────────────────────────────
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),

    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: varchar("acknowledged_by", { length: 32 }),

    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: varchar("resolved_by", { length: 32 }),

    // Denormalized response times (maintained by trigger on
    // acknowledgedAt/resolvedAt updates; alternatively use the
    // crisis_response_times view)
    timeToAcknowledgeMinutes: integer("time_to_acknowledge_minutes"),
    timeToResolveMinutes: integer("time_to_resolve_minutes"),

    // ─── Response ─────────────────────────────────────────────────────────────
    responseActions: jsonb("response_actions").default([]).notNull(),

    // Executive summary (free text; distinct from structured action log)
    resolutionSummary: text("resolution_summary"),

    // ─── Public Communication ─────────────────────────────────────────────────
    publicStatementIssued: boolean("public_statement_issued").default(false).notNull(),
    publicStatementUrl: text("public_statement_url"),
    publicStatementIssuedAt: timestamp("public_statement_issued_at", {
      withTimezone: true,
    }),

    // ─── Post-Mortem ──────────────────────────────────────────────────────────
    postMortemUrl: text("post_mortem_url"),
    lessonsLearned: text("lessons_learned"),

    // ─── Impact Metrics (denormalized) ───────────────────────────────────────
    articleCount: integer("article_count").default(0).notNull(),
    totalReach: bigint("total_reach", { mode: "number" }).default(0).notNull(),

    peakNegativeSentiment: decimal("peak_negative_sentiment", {
      precision: 3,
      scale: 2,
    }),

    // AVE in Naira (industry-standard crisis impact metric)
    estimatedAveImpactNaira: numeric("estimated_ave_impact_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Actual financial impact (lost sales, regulatory fines, etc.)
    estimatedFinancialImpactNaira: numeric("estimated_financial_impact_naira", {
      precision: 15,
      scale: 2,
    }).default("0"),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_ci_severity_range", sql`${table.severity} BETWEEN 1 AND 5`),

    check(
      "chk_ci_acknowledged_consistency",
      sql`(${table.acknowledgedAt} IS NULL) = (${table.acknowledgedBy} IS NULL)`,
    ),
    check(
      "chk_ci_resolved_consistency",
      sql`(${table.resolvedAt} IS NULL) = (${table.resolvedBy} IS NULL)`,
    ),
    check(
      "chk_ci_acknowledged_after_detected",
      sql`${table.acknowledgedAt} IS NULL
        OR ${table.acknowledgedAt} >= ${table.detectedAt}`,
    ),
    check(
      "chk_ci_resolved_after_detected",
      sql`${table.resolvedAt} IS NULL
        OR ${table.resolvedAt} >= ${table.detectedAt}`,
    ),

    // Terminal states require resolvedAt + resolvedBy
    check(
      "chk_ci_resolved_state_requires_resolution",
      sql`${table.status} NOT IN ('resolved', 'false_positive')
        OR (${table.resolvedAt} IS NOT NULL
            AND ${table.resolvedBy} IS NOT NULL)`,
    ),

    check("chk_ci_article_count", sql`${table.articleCount} >= 0`),
    check(
      "chk_ci_peak_sentiment",
      sql`${table.peakNegativeSentiment} IS NULL
        OR ${table.peakNegativeSentiment} BETWEEN -1 AND 1`,
    ),

    // Public statement consistency
    check(
      "chk_ci_public_statement_consistency",
      sql`(${table.publicStatementIssued} = FALSE
          AND ${table.publicStatementIssuedAt} IS NULL
          AND ${table.publicStatementUrl} IS NULL)
        OR (${table.publicStatementIssued} = TRUE
          AND ${table.publicStatementIssuedAt} IS NOT NULL)`,
    ),

    // Incident commander consistency
    check(
      "chk_ci_commander_consistency",
      sql`(${table.incidentCommanderId} IS NULL)
        = (${table.incidentCommanderAssignedAt} IS NULL)`,
    ),

    // Acknowledged status requires acknowledgedAt + acknowledgedBy
    check(
      "chk_ci_acknowledged_state",
      sql`${table.status} <> 'acknowledged'
        OR (${table.acknowledgedAt} IS NOT NULL
            AND ${table.acknowledgedBy} IS NOT NULL)`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    index("idx_ci_org_detected").on(table.organizationId, table.detectedAt),

    // Critical crises (your suggestion)
    index("idx_ci_org_severity")
      .on(table.organizationId, table.severity, table.detectedAt)
      .where(sql`${table.status} NOT IN ('resolved', 'false_positive')`),

    // Recently active (your suggestion)
    index("idx_ci_org_updated").on(table.organizationId, table.updatedAt),

    index("idx_ci_status").on(table.organizationId, table.status),

    index("idx_ci_active")
      .on(table.organizationId, table.severity)
      .where(sql`${table.status} = 'active'`),

    index("idx_ci_origin_article")
      .on(table.originArticleId)
      .where(sql`${table.originArticleId} IS NOT NULL`),

    index("idx_ci_origin_alert")
      .on(table.originAlertEventId)
      .where(sql`${table.originAlertEventId} IS NOT NULL`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const monitoringCampaignsRelations = relations(monitoringCampaigns, ({ many }) => ({
  mediaArticles: many(mediaArticles, {
    relationName: "monitoringCampaign_mediaArticles",
  }),

  socialMentions: many(socialMentions, {
    relationName: "monitoringCampaign_socialMentions",
  }),

  // Alert rules for this campaign are in shared/alerts.ts:
  //   alert_rules WHERE source_module = 'monitoring'
  //     AND scope_ids @> ARRAY[campaign.id]
  // Resolved at application layer.
}));

export const newsSourcesRelations = relations(newsSources, ({ many }) => ({
  articles: many(mediaArticles, {
    relationName: "newsSource_mediaArticles",
  }),
}));

export const socialMentionsRelations = relations(socialMentions, ({ one, many }) => ({
  campaign: one(monitoringCampaigns, {
    fields: [socialMentions.campaignId],
    references: [monitoringCampaigns.id],
    relationName: "monitoringCampaign_socialMentions",
  }),

  // Self-FK for threading (parent mention)
  parent: one(socialMentions, {
    fields: [socialMentions.parentId],
    references: [socialMentions.id],
    relationName: "socialMention_parent",
  }),
  replies: many(socialMentions, {
    relationName: "socialMention_parent",
  }),
}));

export const mediaArticlesRelations = relations(mediaArticles, ({ one, many }) => ({
  monitoringCampaign: one(monitoringCampaigns, {
    fields: [mediaArticles.monitoringCampaignId],
    references: [monitoringCampaigns.id],
    relationName: "monitoringCampaign_mediaArticles",
  }),

  // Real FK to news_sources
  source: one(newsSources, {
    fields: [mediaArticles.sourceId],
    references: [newsSources.id],
    relationName: "newsSource_mediaArticles",
  }),

  // Real FK
  competitor: one(monitoringCompetitors, {
    fields: [mediaArticles.competitorId],
    references: [monitoringCompetitors.id],
  }),

  // Self-FK for duplicate chain
  originalArticle: one(mediaArticles, {
    fields: [mediaArticles.originalArticleId],
    references: [mediaArticles.id],
    relationName: "mediaArticle_duplicates",
  }),
  duplicates: many(mediaArticles, {
    relationName: "mediaArticle_duplicates",
  }),

  // FK to news_sources for syndicated origin
  syndicatedFromSource: one(newsSources, {
    fields: [mediaArticles.syndicatedFrom],
    references: [newsSources.id],
    relationName: "mediaArticle_syndicatedFrom",
  }),
}));

export const monitoringCompetitorsRelations = relations(monitoringCompetitors, ({ many }) => ({
  // Reverse relation: articles that mention this competitor
  mediaArticles: many(mediaArticles),
}));

export const crisisIncidentsRelations = relations(crisisIncidents, ({ one }) => ({
  // Real FK to media_articles
  originArticle: one(mediaArticles, {
    fields: [crisisIncidents.originArticleId],
    references: [mediaArticles.id],
    relationName: "crisisIncident_originArticle",
  }),

  // Cross-module reference (NOT FK):
  //   originAlertEventId → alert_events.id (shared/alerts.ts)
}));
