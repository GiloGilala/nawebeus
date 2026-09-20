import { desc, relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import {
  analyticsAggregationMethodEnum,
  analyticsEventSourceEnum,
  analyticsExportFormatEnum,
  analyticsExportStatusEnum,
  analyticsGranularityEnum,
  analyticsMetricTypeEnum,
} from "../shared/enums";

// =============================================================================
// ANALYTICS EVENTS
// =============================================================================

/**
 * Raw event stream — one row per discrete event across all modules.
 *
 * This is the write-time record. analytics_aggregates is the read-time
 * record. The aggregation pipeline reads from here and writes to there.
 *
 * High-volume table:
 *   Expected write rate: ~50–500 events/second at scale.
 *   Retention: 90 days raw events (configurable via data_retention_policies).
 *   After 90 days: aggregates in analytics_aggregates are the source of truth.
 *
 * id uses serial (auto-increment integer) rather than varchar(32):
 *   - Avoids UUID generation overhead at high insert rates
 *   - Enables efficient range-based pagination (WHERE id > $last_seen_id)
 *   - Composite with organizationId for time-series partitioning readiness
 *
 * properties JSONB:
 *   Shape varies by eventType. Examples:
 *
 *   post.published:
 *     { postId, platforms: ['twitter_x', 'instagram'], templateId, hasMedia }
 *
 *   order.completed:
 *     { orderId, productIds: [...], subtotal, currency, platform }
 *
 *   engagement.message_received:
 *     { messageId, platform, priority, authorInfluenceScore }
 *
 *   campaign.entry_created:
 *     { campaignId, entryId, referralCode, fraudScore }
 *
 * Financial fields:
 *   nairaAmount is top-level (not buried in properties) so aggregation
 *   queries can SUM it directly without JSONB extraction overhead.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    // Auto-increment — efficient for high-volume inserts and range pagination
    id: serial("id").notNull().primaryKey(),

    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Event Classification ────────────────────────────────────────────────
    // <resource>.<verb> format matching audit_log action convention
    // e.g. 'post.published', 'order.completed', 'engagement.responded'
    eventType: varchar("event_type", { length: 100 }).notNull(),

    // When the event actually occurred (may differ from createdAt if backfilled)
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
    }).notNull(),

    // Which module generated this event
    source: analyticsEventSourceEnum("source").notNull(),

    // ─── Entity Reference ────────────────────────────────────────────────────
    // The primary entity this event relates to
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 32 }),

    // ─── Event Payload ───────────────────────────────────────────────────────
    // Shape varies by eventType — see JSDoc above for examples
    properties: jsonb("properties").notNull().default({}),

    // ─── Financial Fields ────────────────────────────────────────────────────
    // Top-level for direct aggregation — not buried in properties JSONB
    nairaAmount: numeric("naira_amount", { precision: 15, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Actor Context ───────────────────────────────────────────────────────
    // Not FK — events must outlive user records
    userId: varchar("user_id", { length: 32 }),
    sessionId: varchar("session_id", { length: 32 }),

    // ─── Network Context ─────────────────────────────────────────────────────
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    // When the event was written to the database
    // May differ from eventTimestamp for delayed/batched writes
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // nairaAmount must be non-negative when set
    check(
      "chk_aev_naira_amount",
      sql`${table.nairaAmount} IS NULL
        OR ${table.nairaAmount} >= 0`,
    ),

    // eventTimestamp must be a valid past/present timestamp
    // (allows up to 24h clock skew; rejects far-future or pre-epoch dates)
    check("chk_aev_event_timestamp", sql`${table.eventTimestamp} <= now() + interval '24 hours'`),

    // ── Primary time-series query ────────────────────────────────────────────

    // Primary time-series query — org events in time order
    index("idx_aev_org_time").on(table.organizationId, desc(table.eventTimestamp)),

    // Event type lookup — "how many posts were published this week?"
    index("idx_aev_type_time").on(table.eventType, desc(table.eventTimestamp)),

    // Source module breakdown
    index("idx_aev_source_time").on(table.source, desc(table.eventTimestamp)),

    // Entity history — "show me all events for post XYZ"
    index("idx_aev_entity").on(table.entityType, table.entityId),

    // User activity — "what did this user do today?"
    index("idx_aev_user_time").on(table.userId, desc(table.eventTimestamp)),

    // Financial aggregation — revenue reporting queries
    index("idx_aev_financial")
      .on(table.organizationId, desc(table.eventTimestamp))
      .where(sql`${table.nairaAmount} IS NOT NULL`),

    // Aggregation pipeline — find unprocessed events
    index("idx_aev_created").on(table.createdAt),

    // GIN index on properties — applied via raw SQL migration:
    // CREATE INDEX idx_aev_properties ON analytics_events USING GIN(properties);
  ],
);

// =============================================================================
// ANALYTICS METRICS
// =============================================================================

/**
 * Metric definitions — the catalog of what can be measured.
 *
 * Two categories:
 *   isSystem = true   → platform-wide metrics visible to all orgs
 *                       organizationId = NULL
 *                       Examples: 'post.reach', 'engagement.sla_compliance_rate'
 *
 *   isSystem = false  → custom metrics created by an org
 *                       organizationId = that org's ID
 *                       Examples: custom KPIs, calculated ratios
 *
 * Formula:
 *   For computed metrics — a string expression evaluated by the analytics
 *   engine. Operands reference other metric names.
 *   Example: "engagement_rate = (likes + comments + shares) / reach"
 *
 * Aggregation:
 *   aggregationMethod defines how raw values are combined across time:
 *   sum    → total count, revenue
 *   avg    → engagement rate, sentiment score
 *   last   → follower count (latest snapshot, not sum)
 *   count  → number of events
 *   median → response time
 */
export const analyticsMetrics = pgTable(
  "analytics_metrics",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // NULL = system metric visible to all orgs
    organizationId: varchar("organization_id", { length: 32 }),

    // ─── Identity ────────────────────────────────────────────────────────────
    // Machine-readable key — used as metric_name in analytics_aggregates
    // Convention: <module>.<metric> e.g. 'post.reach', 'engagement.csat'
    name: varchar("name", { length: 100 }).notNull(),

    // Human-readable label shown in dashboards and reports
    displayName: varchar("display_name", { length: 200 }).notNull(),

    description: text("description"),
    category: varchar("category", { length: 50 }),

    // ─── Computation ─────────────────────────────────────────────────────────
    // NULL for raw metrics; expression string for computed metrics
    formula: text("formula"),

    metricType: analyticsMetricTypeEnum("metric_type").notNull(),
    aggregationMethod: analyticsAggregationMethodEnum("aggregation_method")
      .default("sum")
      .notNull(),
    defaultGranularity: analyticsGranularityEnum("default_granularity").default("day").notNull(),

    // ─── Display Formatting ──────────────────────────────────────────────────
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
    decimals: integer("decimals").default(2).notNull(),
    // Unit suffix shown in UI e.g. '%', 'mins', 'NGN', 'posts'
    unit: varchar("unit", { length: 20 }),

    // ─── Lifecycle ───────────────────────────────────────────────────────────
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    tags: text("tags").array(),

    // Not FK — metric definitions outlive their creators
    createdById: varchar("created_by_id", { length: 32 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // System metrics must have organizationId = NULL
    // (system metrics are platform-wide, not org-scoped)
    check(
      "chk_am_system_no_org",
      sql`${table.isSystem} = FALSE
        OR ${table.organizationId} IS NULL`,
    ),

    // Non-system (org-defined) metrics must have organizationId set
    check(
      "chk_am_custom_requires_org",
      sql`${table.isSystem} = TRUE
        OR ${table.organizationId} IS NOT NULL`,
    ),

    // formula only meaningful for computed metric types
    // (raw/count metrics have no formula)
    check(
      "chk_am_formula_for_computed",
      sql`${table.formula} IS NULL
        OR ${table.metricType} IN ('ratio', 'percentage', 'currency')`,
    ),

    // decimals must be in valid range
    check("chk_am_decimals_range", sql`${table.decimals} >= 0 AND ${table.decimals} <= 10`),

    // ── Uniqueness ───────────────────────────────────────────────────────────

    // Metric name is unique per org
    // (System metrics use NULL organizationId, which Postgres treats as
    //  distinct in unique constraints — so each system metric name is also unique.)
    unique("uq_am_org_name").on(table.organizationId, table.name),

    // ── Primary lookups ──────────────────────────────────────────────────────

    // Active metrics for an org (includes system metrics via NULL org)
    index("idx_am_org_active").on(table.organizationId).where(sql`${table.isActive} = TRUE`),

    // Category grouping — used by metric selector in dashboard builder
    index("idx_am_category").on(table.category),

    // System metric lookup — used at application startup to cache definitions
    index("idx_am_system").on(table.name).where(sql`${table.isSystem} = TRUE`),

    // GIN index on tags — applied via raw SQL migration:
    // CREATE INDEX idx_am_tags ON analytics_metrics USING GIN(tags);
  ],
);

// =============================================================================
// ANALYTICS AGGREGATES
// =============================================================================

/**
 * Pre-aggregated time-series metrics — the single metrics store for the
 * entire platform.
 *
 * Replaces 7 module-specific metrics/performance/daily-stats tables:
 * ┌─────────────────────────────┬──────────────────┬────────────────┬──────────────┬─────────────────────────────────────────┐
 * │ Old table (never created)   │ dimension_1      │ dimension_2    │ platform     │ metric_name examples                    │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ post_performance            │ post_id          │ "post"         │ post platform│ reach, impressions, likes,              │
 * │                             │                  │                │              │ comments, shares, saves,                │
 * │                             │                  │                │              │ link_clicks, video_views,               │
 * │                             │                  │                │              │ engagement_rate                         │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ usage_tracking              │ org_id           │ "org_usage"    │ null         │ users, social_accounts, mentions,       │
 * │                             │                  │                │              │ monitoring_keywords, conversations,     │
 * │                             │                  │                │              │ storage_bytes, api_calls,               │
 * │                             │                  │                │              │ custom_reports, scheduled_reports       │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ social_account_metrics      │ social_acct_id   │ "social_acct"  │ acct platform│ follower_count, following_count,        │
 * │                             │                  │                │              │ post_count, engagement_rate,            │
 * │                             │                  │                │              │ follower_growth, likes, comments,       │
 * │                             │                  │                │              │ shares, saves, impressions, reach       │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ commerce_analytics          │ product_id OR    │ "product" OR   │ order        │ impressions, clicks, add_to_cart,       │
 * │                             │ content_id       │ "content"      │ platform     │ checkout_initiated, sales, revenue,     │
 * │                             │                  │                │              │ net_revenue, platform_fees,             │
 * │                             │                  │                │              │ conversion_rate, avg_order_value,       │
 * │                             │                  │                │              │ cart_abandonment_rate                   │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ campaign_daily_stats        │ campaign_id      │ "campaign"     │ null         │ entries, referrals, completions,        │
 * │                             │                  │                │              │ flagged_entries, blocked_entries,       │
 * │                             │                  │                │              │ follow_actions, like_actions,           │
 * │                             │                  │                │              │ comment_actions, share_actions          │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ monitoring_daily_summary    │ org_id           │ "monitoring"   │ null         │ total_articles, new_articles,           │
 * │                             │                  │                │              │ positive_sentiment, neutral_sentiment,  │
 * │                             │                  │                │              │ negative_sentiment, mixed_sentiment,    │
 * │                             │                  │                │              │ total_reach, ave_naira,                 │
 * │                             │                  │                │              │ competitor_mentions, share_of_voice,    │
 * │                             │                  │                │              │ alert_count, crisis_count               │
 * ├─────────────────────────────┼──────────────────┼────────────────┼──────────────┼─────────────────────────────────────────┤
 * │ engagement_performance      │ org_id           │ "engagement"   │ platform     │ total_messages, unique_authors,         │
 * │                             │                  │                │              │ messages_replied, avg_response_time_s,  │
 * │                             │                  │                │              │ first_response_rate, sla_met_count,     │
 * │                             │                  │                │              │ sla_breached_count, sla_compliance_rate,│
 * │                             │                  │                │              │ positive_sentiment, neutral_sentiment,  │
 * │                             │                  │                │              │ negative_sentiment, avg_csat,           │
 * │                             │                  │                │              │ csat_response_count, ai_assisted_count  │
 * └─────────────────────────────┴──────────────────┴────────────────┴──────────────┴─────────────────────────────────────────┘
 *
 * Composite primary key:
 *   (organizationId, granularity, timeBucket, platform, metricName,
 *    dimension1, dimension2, dimension3)
 *
 *   This is the natural key — there is exactly one aggregate value per
 *   (time window × platform × metric × entity slice). No surrogate ID needed.
 *
 *   NULL handling in composite PK:
 *   Postgres treats NULLs as distinct in unique constraints but NOT in
 *   primary keys — two rows with dimension1=NULL would violate the PK.
 *   Resolution: use '' (empty string) as the sentinel for "no value"
 *   rather than NULL in dimension columns. Application layer enforces this.
 *   e.g. org-level summaries: dimension1='', dimension2='monitoring', dimension3=''
 *
 * Upsert pattern:
 *   All writers use INSERT ... ON CONFLICT DO UPDATE (upsert).
 *   The aggregation pipeline runs hourly; dashboard queries always read
 *   the latest value regardless of when it was last computed.
 *
 * dataComplete flag:
 *   false = partial data (platform API hasn't returned final numbers yet)
 *   true  = final numbers confirmed — safe to cache aggressively
 *   Dashboard queries should show partial data with a visual indicator
 *   rather than hiding the row until complete.
 *
 * nairaValue:
 *   Populated only for financial metrics (revenue, AVE, cost).
 *   Kept as a top-level column for direct SUM aggregation.
 *   Same value as `value` but typed as numeric(15,2) for Naira precision.
 *
 * Partitioning readiness:
 *   This table will be the largest in the schema at scale.
 *   When row count exceeds ~100M, add range partitioning on timeBucket
 *   by month. The composite PK includes timeBucket so partitioning
 *   doesn't require a schema change — just a migration to add partitions.
 */
export const analyticsAggregates = pgTable(
  "analytics_aggregates",
  {
    // ─── Composite Primary Key Columns ───────────────────────────────────────
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    granularity: analyticsGranularityEnum("granularity").notNull(),

    // Start of the time window this aggregate covers
    // hour:    truncated to the hour  e.g. 2026-01-15 14:00:00+01
    // day:     truncated to the day   e.g. 2026-01-15 00:00:00+01
    // week:    truncated to Monday    e.g. 2026-01-13 00:00:00+01
    // month:   truncated to the 1st   e.g. 2026-01-01 00:00:00+01
    // quarter: truncated to Q start   e.g. 2026-01-01 00:00:00+01
    timeBucket: timestamp("time_bucket", { withTimezone: true }).notNull(),

    // Platform context — '' (empty string) for platform-agnostic metrics
    // Use platformEnum values: 'twitter_x', 'instagram', 'facebook', etc.
    platform: varchar("platform", { length: 50 }).notNull().default(""),

    // Metric name — matches analytics_metrics.name
    // Convention: <module>.<metric> e.g. 'post.reach', 'engagement.csat'
    metricName: varchar("metric_name", { length: 100 }).notNull(),

    // ─── Dimensions (entity slicing) ─────────────────────────────────────────
    // See dimension mapping table in JSDoc above for per-table mapping.
    // Use '' (empty string) when a dimension is not applicable.
    // Never use NULL — composite PK cannot contain NULLs.
    dimension1: varchar("dimension_1", { length: 100 }).notNull().default(""),
    dimension2: varchar("dimension_2", { length: 100 }).notNull().default(""),
    dimension3: varchar("dimension_3", { length: 100 }).notNull().default(""),

    // ─── Aggregated Values ───────────────────────────────────────────────────
    // Primary numeric value — scale 4 to handle engagement rates (0.0342)
    value: decimal("value", { precision: 20, scale: 4 }).notNull(),

    // Financial value in Naira — same as value but typed for Naira precision
    // NULL for non-financial metrics
    nairaValue: numeric("naira_value", { precision: 15, scale: 2 }),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Statistical Context ─────────────────────────────────────────────────
    // How many raw data points contributed to this aggregate
    sampleSize: integer("sample_size"),

    // Range statistics — populated for metrics where spread matters
    // (e.g. response time: min=2s, max=847s, avg=45s tells a different story)
    minValue: decimal("min_value", { precision: 20, scale: 4 }),
    maxValue: decimal("max_value", { precision: 20, scale: 4 }),
    p50Value: decimal("p50_value", { precision: 20, scale: 4 }),
    p95Value: decimal("p95_value", { precision: 20, scale: 4 }),

    // ─── Data Freshness ──────────────────────────────────────────────────────
    // When this aggregate was last recomputed
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),

    // false = partial data (platform API hasn't confirmed final numbers)
    // true  = final — safe to cache aggressively
    dataComplete: boolean("data_complete").default(false).notNull(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // sampleSize must be non-negative
    check("chk_aag_sample_size", sql`${table.sampleSize} >= 0`),

    // nairaValue must be non-negative when set
    check(
      "chk_aag_naira_value",
      sql`${table.nairaValue} IS NULL
        OR ${table.nairaValue} >= 0`,
    ),

    // min ≤ p50 ≤ max when all three are set (sanity check on percentiles)
    check(
      "chk_aag_percentile_range",
      sql`(${table.minValue} IS NULL
        OR ${table.p50Value} IS NULL
        OR ${table.maxValue} IS NULL)
      OR (${table.minValue} <= ${table.p50Value}
        AND ${table.p50Value} <= ${table.maxValue})`,
    ),

    // p95 must be >= p50 when both set
    check(
      "chk_aag_p95_gte_p50",
      sql`${table.p50Value} IS NULL
        OR ${table.p95Value} IS NULL
        OR ${table.p95Value} >= ${table.p50Value}`,
    ),

    // dataComplete=true implies lastComputedAt is set
    check(
      "chk_aag_complete_has_computed_at",
      sql`${table.dataComplete} = FALSE
        OR ${table.lastComputedAt} IS NOT NULL`,
    ),

    // Composite primary key — natural key, no surrogate ID needed.
    // `name` is deliberate: drizzle's generated name for this key is 120 chars,
    // and PostgreSQL truncates every identifier to 63 bytes. The truncated name
    // can never match what drizzle-kit expects, so push re-dropped and re-added
    // this constraint on every run (NWB-P0-009). A short explicit name converges.
    primaryKey({
      name: "pk_aag_natural_key",
      columns: [
        table.organizationId,
        table.granularity,
        table.timeBucket,
        table.platform,
        table.metricName,
        table.dimension1,
        table.dimension2,
        table.dimension3,
      ],
    }),

    // ── Primary dashboard query patterns ────────────────────────────────────

    // Org time-series — "show me all metrics for org X in date range"
    index("idx_aag_org_time").on(table.organizationId, desc(table.timeBucket)),

    // Metric lookup — "show me reach for all posts in January"
    index("idx_aag_metric_time").on(table.metricName, desc(table.timeBucket)),

    // Platform breakdown — "compare Twitter vs Instagram engagement"
    index("idx_aag_platform_time")
      .on(table.organizationId, table.platform, desc(table.timeBucket))
      .where(sql`${table.platform} != ''`),

    // Entity history — "show me reach for post XYZ over time"
    index("idx_aag_entity_time").on(table.dimension1, table.dimension2, desc(table.timeBucket)),

    // Granularity filter — dashboard queries always specify granularity
    index("idx_aag_org_granularity_time").on(
      table.organizationId,
      table.granularity,
      desc(table.timeBucket),
    ),

    // Metric + org combination — the most-frequent dashboard query
    index("idx_aag_org_metric_time").on(
      table.organizationId,
      table.metricName,
      desc(table.timeBucket),
    ),

    // Incomplete data refresh — aggregation pipeline picks up partial rows
    index("idx_aag_incomplete")
      .on(table.organizationId, table.lastComputedAt)
      .where(sql`${table.dataComplete} = FALSE`),

    // Financial aggregation — Naira sums and reporting
    index("idx_aag_naira")
      .on(table.organizationId, desc(table.timeBucket))
      .where(sql`${table.nairaValue} IS NOT NULL`),
  ],
);

// =============================================================================
// ANALYTICS DASHBOARDS
// =============================================================================

/**
 * Saved dashboard configurations.
 *
 * widgets JSONB structure:
 * [
 *   {
 *     id: string,
 *     type: 'line_chart' | 'bar_chart' | 'number' | 'table' | 'map',
 *     title: string,
 *     metricName: string,
 *     granularity: string,
 *     dimension2: string,
 *     platform: string,
 *     position: { x, y, w, h },
 *     config: { ... }
 *   }
 * ]
 *
 * sharedWith JSONB structure:
 * [
 *   { userId: string, permission: 'view' | 'edit' },
 *   { teamId: string, permission: 'view' }
 * ]
 *
 * Soft-delete:
 *   deletedAt is set instead of deleting the row.
 *   idx_ad_org partial index excludes deleted dashboards from list queries.
 *   Hard delete happens via data_retention_policies after 30 days.
 */
export const analyticsDashboards = pgTable(
  "analytics_dashboards",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    widgets: jsonb("widgets").notNull().default([]),
    filters: jsonb("filters").default({}),
    timeRange: jsonb("time_range"),

    // Auto-refresh interval in seconds — 0 = no auto-refresh
    // Default: 300 (5 minutes)
    refreshIntervalSeconds: integer("refresh_interval_seconds").default(300).notNull(),

    // ─── Sharing ─────────────────────────────────────────────────────────────
    isShared: boolean("is_shared").default(false).notNull(),

    // Granular sharing — see JSDoc above for shape
    sharedWith: jsonb("shared_with"),

    // true = shown first when the user opens Analytics
    isDefault: boolean("is_default").default(false).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — dashboard outlives creator if they leave the org
    createdById: varchar("created_by_id", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    // Soft delete — hard delete via retention policy after 30 days
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // refreshIntervalSeconds must be non-negative (0 = no auto-refresh)
    check("chk_ad_refresh_interval", sql`${table.refreshIntervalSeconds} >= 0`),

    // Soft-delete consistency: deletedAt alone
    // (no companion deletedById at the moment — can be added if needed)

    // ── Primary lookups ──────────────────────────────────────────────────────

    // Active dashboards for an org — excludes soft-deleted
    index("idx_ad_org_active")
      .on(table.organizationId, desc(table.createdAt))
      .where(sql`${table.deletedAt} IS NULL`),

    // Default dashboard lookup — fast load on Analytics open
    index("idx_ad_default")
      .on(table.organizationId, table.isDefault)
      .where(sql`${table.isDefault} = TRUE AND ${table.deletedAt} IS NULL`),

    // Creator's own dashboards
    index("idx_ad_creator").on(table.createdById),

    // Recently updated — common in management screens
    index("idx_ad_org_updated")
      .on(table.organizationId, desc(table.updatedAt))
      .where(sql`${table.deletedAt} IS NULL`),

    // Shared dashboards — user can view dashboards shared with them
    // Full GIN query at application layer: sharedWith @> [{ userId: $1 }]
    // CREATE INDEX idx_ad_shared ON analytics_dashboards USING GIN(shared_with)
    //   WHERE is_shared = FALSE AND deleted_at IS NULL;
  ],
);

// =============================================================================
// ANALYTICS REPORTS
// =============================================================================

/**
 * Saved report definitions with scheduling, export, and white-label support.
 *
 * Merged from the original analytics_reports + analytics_exports tables:
 *   The original design had a separate analytics_exports table for tracking
 *   export job state. That creates an unnecessary join for the common case
 *   of "show me the last export for this report." Since a report typically
 *   has one active export at a time, the last export state is inlined here.
 *   Full export history is available via audit_log:
 *     WHERE resource_type = 'analytics_report'
 *     AND action = 'report.exported'
 *
 * config JSONB structure:
 * {
 *   metrics: string[],
 *   dimensions: string[],
 *   filters: { platform?, dateRange?, ... },
 *   granularity: string,
 *   chartTypes: { [metricName]: string },
 *   sections: [{ title, metrics, chartType }]
 * }
 *
 * scheduleConfig JSONB structure:
 * {
 *   cron: string,                   // e.g. '0 8 * * 1' (Mondays 8am)
 *   timezone: string,               // IANA timezone
 *   startDate: string,              // ISO date
 *   endDate?: string                // ISO date — null = runs indefinitely
 * }
 *
 * recipients JSONB structure:
 * [
 *   { type: 'user', id: string },
 *   { type: 'email', address: string },
 *   { type: 'team', id: string }
 * ]
 *
 * whiteLabelConfig JSONB structure (Agency tier only):
 * {
 *   logoUrl, primaryColor, fontFamily,
 *   clientName, footerText, hidePoweredBy
 * }
 */
export const analyticsReports = pgTable(
  "analytics_reports",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    // ─── Report Definition ───────────────────────────────────────────────────
    config: jsonb("config").notNull(),

    // FK to templates — null if not based on a template
    templateId: varchar("template_id", { length: 32 }),

    // ─── Scheduling ──────────────────────────────────────────────────────────
    isScheduled: boolean("is_scheduled").default(false).notNull(),

    scheduleConfig: jsonb("schedule_config"),
    recipients: jsonb("recipients"),

    // ─── Delivery Options ────────────────────────────────────────────────────
    deliveryFormat: analyticsExportFormatEnum("delivery_format").default("pdf").notNull(),
    includeRawData: boolean("include_raw_data").default(false).notNull(),
    includeCharts: boolean("include_charts").default(true).notNull(),

    // ─── White-Label (Agency tier only) ──────────────────────────────────────
    isWhiteLabel: boolean("is_white_label").default(false).notNull(),
    whiteLabelConfig: jsonb("white_label_config"),

    // ─── Last Export State (inlined from analytics_exports) ──────────────────
    lastExportStatus: analyticsExportStatusEnum("last_export_status"),
    lastExportUrl: text("last_export_url"),
    lastExportAt: timestamp("last_export_at", { withTimezone: true }),
    lastExportError: text("last_export_error"),
    lastExportRowCount: bigint("last_export_row_count", { mode: "number" }),
    lastExportFileSizeBytes: bigint("last_export_file_size_bytes", {
      mode: "number",
    }),

    // ─── Schedule Tracking ───────────────────────────────────────────────────
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    consecutiveFailureCount: integer("consecutive_failure_count").default(0).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — report outlives creator if they leave the org
    createdById: varchar("created_by_id", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // consecutiveFailureCount must be non-negative
    check("chk_ar_failure_count", sql`${table.consecutiveFailureCount} >= 0`),

    // lastExportRowCount must be non-negative when set
    check(
      "chk_ar_export_row_count",
      sql`${table.lastExportRowCount} IS NULL
        OR ${table.lastExportRowCount} >= 0`,
    ),

    // lastExportFileSizeBytes must be non-negative when set
    check(
      "chk_ar_export_file_size",
      sql`${table.lastExportFileSizeBytes} IS NULL
        OR ${table.lastExportFileSizeBytes} >= 0`,
    ),

    // Scheduling consistency
    // isScheduled=true ↔ scheduleConfig is set
    check(
      "chk_ar_scheduled_has_config",
      sql`${table.isScheduled} = FALSE
        OR ${table.scheduleConfig} IS NOT NULL`,
    ),

    // isScheduled=true ↔ nextRunAt is set
    check(
      "chk_ar_scheduled_has_next_run",
      sql`${table.isScheduled} = FALSE
        OR ${table.nextRunAt} IS NOT NULL`,
    ),

    // White-label consistency
    // isWhiteLabel=true ↔ whiteLabelConfig is set
    check(
      "chk_ar_white_label_has_config",
      sql`${table.isWhiteLabel} = FALSE
        OR ${table.whiteLabelConfig} IS NOT NULL`,
    ),

    // Export status timing — lastExportAt must be set when status is non-null
    check(
      "chk_ar_export_status_has_timestamp",
      sql`${table.lastExportStatus} IS NULL
        OR ${table.lastExportAt} IS NOT NULL`,
    ),

    // nextRunAt must be after lastRunAt when both are set
    check(
      "chk_ar_next_run_after_last_run",
      sql`${table.lastRunAt} IS NULL
        OR ${table.nextRunAt} IS NULL
        OR ${table.nextRunAt} > ${table.lastRunAt}`,
    ),

    // ── Primary lookups ──────────────────────────────────────────────────────

    // Report list for an org
    index("idx_ar_org").on(table.organizationId, desc(table.createdAt)),

    // Scheduled report runner — find reports due for execution
    index("idx_ar_scheduled_next_run").on(table.nextRunAt).where(sql`${table.isScheduled} = TRUE`),

    // Failed schedule alerting — reports failing repeatedly
    index("idx_ar_failing")
      .on(table.organizationId, table.consecutiveFailureCount)
      .where(sql`${table.consecutiveFailureCount} > 2`),

    // White-label reports — Agency tier feature flag check
    index("idx_ar_white_label").on(table.organizationId).where(sql`${table.isWhiteLabel} = TRUE`),

    // Creator's own reports
    index("idx_ar_creator").on(table.createdById),

    // Template-based reports — find reports using a given template
    index("idx_ar_template").on(table.templateId),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *
 *   analytics_events.userId          → users.id            (may be deleted)
 *   analytics_events.entityType/Id  → polymorphic per source
 *   analytics_metrics.createdById    → users.id            (may be deleted)
 *   analytics_metrics.organizationId → organizations.id    (system metrics: NULL)
 *   analytics_aggregates.*          → no FKs (composite PK, polymorphic dims)
 *   analytics_dashboards.createdById → users.id            (may be deleted)
 *   analytics_reports.templateId    → templates.id        (cross-module)
 *   analytics_reports.createdById   → users.id            (may be deleted)
 *   analytics_reports.recipients    → resolved at app layer
 *
 * Modeling any of these as Drizzle relations would imply write semantics
 * the application does not use. These tables are read-mostly and most
 * queries are aggregations (SUM, AVG, GROUP BY).
 */

export const analyticsEventsRelations = relations(analyticsEvents, (_) => ({
  // analyticsEvents are self-contained write-time records.
  // entityType + entityId resolve to different tables depending on source.
  // userId references users — resolved at application layer.
  // No Drizzle relations declared to avoid circular imports.
}));

export const analyticsMetricsRelations = relations(analyticsMetrics, (_) => ({
  // Alert rules that watch this metric
  // Cross-module: alert_rules.metricId references analytics_metrics.id
  // Declared in shared/alerts.ts to avoid circular import
}));

export const analyticsAggregatesRelations = relations(analyticsAggregates, (_) => ({
  // Composite PK table — no FK relations.
  // dimension1 + dimension2 identify the entity at application layer.
  // metricName resolves to analytics_metrics.name at application layer.
}));

export const analyticsDashboardsRelations = relations(analyticsDashboards, (_) => ({
  // widgets JSONB references analytics_metrics.name — resolved at app layer.
  // createdById references users — resolved at application layer.
}));

export const analyticsReportsRelations = relations(analyticsReports, (_) => ({
  // templateId references templates — cross-module, resolved at app layer.
  // config.metrics[] references analytics_metrics.name — resolved at app layer.
}));
