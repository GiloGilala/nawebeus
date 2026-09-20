// db/schema/publishing/index.ts
//
// Content publishing module.
//
// Tables:
//   posts                — content with multi-platform targeting, versioning
//   publishing_results   — per-platform publishing status (one row per post+platform)
//
// Design decisions:
//
//   publishing_results stays relational (§1.0 correction):
//     A post targets multiple platforms (platforms TEXT[]), but each platform
//     has its own publishing status, native post ID, error state, and retry
//     count. The v2 schema tried to inline these as singular columns on
//     posts — that's wrong: a post targeting Twitter AND Instagram can't
//     have one `reach` or one `platformPostId`. One row per (post, platform).
//
//   Tables removed → shared modules:
//     content_templates    → shared/templates.ts (templateType = 'post')
//     media_assets         → shared/media.ts
//     post_performance     → shared/analytics.ts (analytics_aggregates)
//       dimension_1 = post_id, dimension_2 = 'post',
//       platform = publishing_results.platform
//     post_drafts          → version history on posts table (see below)
//     approval_history     → shared/approval.ts (approval_requests + approval_history)
//
//   Version history (replaces post_drafts):
//     Instead of a separate post_drafts table, posts uses self-referential
//     versioning: previousVersionId points to the prior version's row.
//     isLatestVersion = true on only the current version.
//     This is simpler and avoids the dual-write problem where drafts and
//     posts could get out of sync. Trade-off: querying all versions of a
//     post requires a recursive CTE or application-layer traversal.
//     For our use case (show latest + optionally show version history),
//     the isLatestVersion partial index makes the common case fast.
//
//   Approval workflow:
//     Posts that require approval have currentApprovalRequestId set,
//     pointing to shared/approval.ts approval_requests. The approval
//     lifecycle (submit → approve/reject → changes_requested) is handled
//     entirely by the shared approval module. Posts just carry:
//       - requiresApproval: boolean
//       - currentApprovalRequestId: varchar (nullable FK-like pointer)
//     When approval completes, the publishing service updates posts.status
//     based on the approval outcome.
//
//   No FK to organizations, users, or social accounts:
//     organizationId, createdBy, savedBy are plain varchar — posts may
//     need to survive user deletion for audit purposes.
//     templateId references shared/templates.ts but is not a FK constraint
//     — the template may be archived after the post is created.
//
//   Content status lifecycle:
//     draft → pending_review → [changes_requested → pending_review] →
//     approved → scheduled → publishing → published | partially_published | failed
//     OR: draft → scheduled → publishing → published (if no approval required)
//     OR: draft → publishing → published (if immediate + no approval)
//     cancelled: can be set from any non-terminal state.

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  contentStatusEnum,
  platformEnum,
  publishingResultStatusEnum,
  scheduleTypeEnum,
} from "../shared/enums";

// =============================================================================
// POSTS
// =============================================================================

/**
 * Content posts with multi-platform targeting and self-referential versioning.
 *
 * A post represents a piece of content that can be published to one or
 * more social platforms. The content may vary per platform (platformVariants)
 * while sharing a common base (sharedContent).
 *
 * Versioning:
 *   Every content edit creates a new posts row:
 *     - New row gets version = old.version + 1
 *     - New row gets previousVersionId = old.id
 *     - New row gets isLatestVersion = true
 *     - Old row gets isLatestVersion = false
 *   This gives full version history without a separate table.
 *   The isLatestVersion partial index ensures the "get latest post"
 *   query is always fast.
 *
 *   Auto-save:
 *     The editor auto-saves every 30 seconds. Auto-saves create a new
 *     version with isAutoSave = true. The version history UI can filter
 *     to show only manual saves (isAutoSave = false).
 *
 * Platform variants:
 *   {
 *     twitter_x: { content: "Short version #hashtag", characterCount: 42 },
 *     instagram: { content: "Longer caption...", hashtags: [...] },
 *     linkedin:  { content: "Professional version...", articleMode: true }
 *   }
 *   Each variant can have platform-specific fields. The publishing worker
 *   reads the variant for the target platform, falling back to sharedContent
 *   if no variant exists.
 *
 * Scheduling:
 *   scheduleType = 'immediate': publish as soon as approved
 *   scheduleType = 'scheduled': publish at scheduledAt
 *   scheduleType = 'recurring': publish on recurringPattern schedule
 *
 *   The publishing scheduler queries:
 *     WHERE status = 'scheduled' AND scheduledAt <= NOW()
 *   and creates publishing_results rows for each target platform.
 *
 * UTM tracking:
 *   Optional UTM parameters appended to any links in the content.
 *   The publishing worker applies these before sending to the platform.
 *
 * Media:
 *   mediaIds is a TEXT[] of media_asset IDs from shared/media.ts.
 *   The publishing worker resolves these to CDN URLs before publishing.
 *   Platform-specific media constraints (aspect ratio, file size) are
 *   validated at the application layer before scheduling.
 */
export const posts = pgTable(
  "posts",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // Not FK — post may outlive the org for audit purposes
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Not FK — post may outlive the user who created it
    createdBy: varchar("created_by", { length: 32 }).notNull(),

    // ─── Content ──────────────────────────────────────────────────────────────
    // Internal working title — not published, used for list views
    title: varchar("title", { length: 200 }),

    // Copy shared across all target platforms (fallback if no variant)
    sharedContent: text("shared_content"),

    // Per-platform content overrides — keyed by platform slug
    // { twitter_x: { content, characterCount }, instagram: { content, hashtags } }
    platformVariants: jsonb("platform_variants").notNull(),

    // Which platforms this post targets
    platforms: text("platforms").array().notNull(),

    // Media asset IDs from shared/media.ts
    mediaIds: text("media_ids").array(),

    // User-defined tags for filtering and categorization
    tags: text("tags").array(),

    // Template this post was created from (shared/templates.ts)
    // Not FK — template may be archived after post creation
    templateId: varchar("template_id", { length: 32 }),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: contentStatusEnum("status").default("draft").notNull(),

    // ─── Approval ─────────────────────────────────────────────────────────────
    // Whether this post requires approval before publishing
    requiresApproval: boolean("requires_approval").default(false).notNull(),

    // Points to shared/approval.ts approval_requests.id
    // Not FK — approval request lifecycle is managed by shared module
    currentApprovalRequestId: varchar("current_approval_request_id", {
      length: 32,
    }),

    // Convenience flag set by the approval callback
    isUrgent: boolean("is_urgent").default(false).notNull(),

    // ─── Versioning ───────────────────────────────────────────────────────────
    // Monotonically increasing per post lineage
    version: integer("version").default(1).notNull(),

    // Points to the previous version of this post (same logical post)
    // NULL = this is the first version
    previousVersionId: varchar("previous_version_id", { length: 32 }),

    // Only true on the most recent version — all queries filter on this
    isLatestVersion: boolean("is_latest_version").default(true).notNull(),

    // Whether this version was created by auto-save (vs manual save)
    isAutoSave: boolean("is_auto_save").default(false).notNull(),

    // Free-text description of what changed in this version
    versionComment: text("version_comment"),

    // Who saved this version — may differ from createdBy (collaborative editing)
    // Not FK — user may be deleted
    savedBy: varchar("saved_by", { length: 32 }),

    // When this version was saved
    savedAt: timestamp("saved_at", { withTimezone: true }),

    // ─── Scheduling ───────────────────────────────────────────────────────────
    scheduleType: scheduleTypeEnum("schedule_type").default("immediate").notNull(),

    // When to publish (only used when scheduleType = 'scheduled')
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

    // IANA timezone — used for display and recurring schedule calculation
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    // Recurrence config (only used when scheduleType = 'recurring')
    // { frequency: 'weekly', days: ['MON', 'WED'], time: '09:00' }
    recurringPattern: jsonb("recurring_pattern"),

    // When the post was actually published (set by publishing worker)
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ─── UTM Tracking ─────────────────────────────────────────────────────────
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // version must be positive
    check("chk_posts_version_positive", sql`${table.version} >= 1`),

    // scheduledAt required when scheduleType = 'scheduled'
    check(
      "chk_posts_scheduled_at_required",
      sql`NOT (
        ${table.scheduleType} = 'scheduled'
        AND ${table.scheduledAt} IS NULL
      )`,
    ),

    // recurringPattern required when scheduleType = 'recurring'
    check(
      "chk_posts_recurring_pattern_required",
      sql`NOT (
        ${table.scheduleType} = 'recurring'
        AND ${table.recurringPattern} IS NULL
      )`,
    ),

    // platforms array must not be empty
    check("chk_posts_platforms_not_empty", sql`array_length(${table.platforms}, 1) > 0`),

    // previousVersionId cannot point to itself
    check(
      "chk_posts_no_self_reference",
      sql`${table.previousVersionId} IS NULL
        OR ${table.previousVersionId} <> ${table.id}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Org's posts — main post list view (latest versions only)
    index("idx_posts_org_latest")
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.isLatestVersion} = TRUE`),

    // Status filter — "show me all drafts for org X"
    index("idx_posts_org_status")
      .on(table.organizationId, table.status)
      .where(sql`${table.isLatestVersion} = TRUE`),

    // Publishing scheduler — "find posts ready to publish"
    index("idx_posts_scheduled").on(table.scheduledAt).where(sql`${table.status} = 'scheduled'`),

    // Creator's posts — "show me my drafts"
    index("idx_posts_creator")
      .on(table.createdBy, table.status)
      .where(sql`${table.isLatestVersion} = TRUE`),

    // Approval queue — "find posts awaiting my approval"
    index("idx_posts_approval")
      .on(table.currentApprovalRequestId)
      .where(
        sql`${table.currentApprovalRequestId} IS NOT NULL
          AND ${table.status} = 'pending_review'`,
      ),

    // Version history — "show me all versions of post X"
    // Traversed via previousVersionId chain
    index("idx_posts_version_chain")
      .on(table.previousVersionId)
      .where(sql`${table.previousVersionId} IS NOT NULL`),

    // Published posts timeline — analytics and reporting
    index("idx_posts_published")
      .on(table.organizationId, table.publishedAt)
      .where(sql`${table.status} = 'published'`),

    // Template usage — "which posts were created from template X?"
    index("idx_posts_template").on(table.templateId).where(sql`${table.templateId} IS NOT NULL`),

    // Tags filter — GIN applied via raw SQL migration:
    // CREATE INDEX idx_posts_tags ON posts USING GIN(tags)
    //   WHERE is_latest_version = TRUE;

    // Urgent posts — prioritized in approval queue
    index("idx_posts_urgent")
      .on(table.organizationId, table.isUrgent)
      .where(
        sql`${table.isUrgent} = TRUE
          AND ${table.status} = 'pending_review'`,
      ),
  ],
);

// =============================================================================
// PUBLISHING RESULTS
// =============================================================================

/**
 * Per-platform publishing status — one row per (post, platform).
 *
 * When the publishing scheduler picks up a post that's ready to publish,
 * it creates one publishing_results row for each platform in post.platforms:
 *
 *   Post targets: ['twitter_x', 'instagram', 'linkedin']
 *   → 3 publishing_results rows created, all with status = 'queued'
 *
 * The publishing worker processes each row independently:
 *   queued → publishing → published | failed
 *
 * If some platforms succeed and others fail:
 *   posts.status = 'partially_published'
 *   Individual platform statuses are in publishing_results.status
 *
 * Retry logic:
 *   Failed results are retried up to 3 times (retryCount < 3).
 *   The retry worker picks up failed results with retryCount < 3
 *   and re-queues them.
 *
 * After publishing:
 *   platformPostId = the native ID assigned by the platform
 *   platformUrl = the canonical URL of the published post
 *   These are used to fetch performance metrics (via analytics_aggregates)
 *   and to generate "View on Platform" links in the UI.
 *
 * Performance metrics:
 *   NOT stored here — they go to shared/analytics.ts analytics_aggregates:
 *     dimension_1 = publishing_results.postId
 *     dimension_2 = 'post'
 *     platform    = publishing_results.platform
 *     metric_name = 'reach', 'impressions', 'likes', 'engagement_rate', etc.
 *   This avoids duplicating time-series storage when analytics_aggregates
 *   already handles multi-granularity aggregation across all modules.
 */
export const publishingResults = pgTable(
  "publishing_results",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // FK-like pointer to posts — not a real FK because:
    // 1. Post versioning means the post.id changes on each edit
    //    (but publishing results stay attached to the version that was published)
    // 2. We may need to retain publishing results after post deletion for analytics
    postId: varchar("post_id", { length: 32 }).notNull(),

    // Not FK — publishing results may outlive the org
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Platform ─────────────────────────────────────────────────────────────
    // Which platform this result is for
    platform: platformEnum("platform").notNull(),

    // Native post ID assigned by the platform after successful publishing
    // NULL until the post is published
    platformPostId: varchar("platform_post_id", { length: 255 }),

    // Canonical URL of the published post on the platform
    // NULL until the post is published
    platformUrl: text("platform_url"),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: publishingResultStatusEnum("status").default("queued").notNull(),

    // ─── Error Handling ───────────────────────────────────────────────────────
    // Human-readable error message (if status = 'failed')
    errorMessage: text("error_message"),

    // Platform-specific error code e.g. 'RATE_LIMIT', 'INVALID_MEDIA'
    errorCode: varchar("error_code", { length: 50 }),

    // How many times this publish has been retried (max 3)
    retryCount: integer("retry_count").default(0).notNull(),

    // When the next retry is scheduled (NULL if not retrying)
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

    // ─── Scheduling ───────────────────────────────────────────────────────────
    // When this result was scheduled to be published
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),

    // When the post was actually published on this platform
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ─── Content Snapshot ─────────────────────────────────────────────────────
    // The actual content that was sent to the platform (after variable
    // substitution, UTM appending, etc.) — useful for debugging
    publishedContent: text("published_content"),

    // Media URLs that were submitted to the platform
    publishedMediaUrls: text("published_media_urls").array(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // retryCount must be 0–5
    check("chk_pr_retry_count", sql`${table.retryCount} BETWEEN 0 AND 5`),

    // errorMessage required when status = 'failed'
    check(
      "chk_pr_error_required",
      sql`NOT (
        ${table.status} = 'failed'
        AND ${table.errorMessage} IS NULL
      )`,
    ),

    // publishedAt required when status = 'published'
    check(
      "chk_pr_published_at_required",
      sql`NOT (
        ${table.status} = 'published'
        AND ${table.publishedAt} IS NULL
      )`,
    ),

    // platformPostId required when status = 'published'
    check(
      "chk_pr_platform_post_id_required",
      sql`NOT (
        ${table.status} = 'published'
        AND ${table.platformPostId} IS NULL
      )`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Post's results — "show me publishing status for post X"
    index("idx_pr_post").on(table.postId),

    // Org's results — admin view
    index("idx_pr_org").on(table.organizationId),

    // Publishing worker — "find queued results ready to publish"
    index("idx_pr_queued").on(table.scheduledAt).where(sql`${table.status} = 'queued'`),

    // Currently publishing — "what's being published right now?"
    index("idx_pr_publishing").on(table.status).where(sql`${table.status} = 'publishing'`),

    // Retry worker — "find failed results eligible for retry"
    index("idx_pr_retry")
      .on(table.nextRetryAt)
      .where(
        sql`${table.status} = 'failed'
          AND ${table.retryCount} < 5
          AND ${table.nextRetryAt} IS NOT NULL`,
      ),

    // Platform filter — "show me all Instagram results for org X"
    index("idx_pr_platform").on(table.organizationId, table.platform),

    // Published results — metrics collection worker
    index("idx_pr_published").on(table.publishedAt).where(sql`${table.status} = 'published'`),

    // Platform post lookup — "find our record for platform post ID Y"
    index("idx_pr_platform_post_id")
      .on(table.platformPostId)
      .where(sql`${table.platformPostId} IS NOT NULL`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const postsRelations = relations(posts, ({ one, many }) => ({
  // Per-platform publishing results
  publishingResults: many(publishingResults, {
    relationName: "post_publishingResults",
  }),

  // Previous version (self-referential version chain)
  previousVersion: one(posts, {
    fields: [posts.previousVersionId],
    references: [posts.id],
    relationName: "post_versionChain",
  }),

  // Newer versions that point to this one
  newerVersions: many(posts, {
    relationName: "post_versionChain",
  }),

  // Cross-module references (resolved at application layer):
  //   templateId       → shared/templates.ts templates.id
  //   mediaIds[]       → shared/media.ts media_assets.id
  //   currentApprovalRequestId → shared/approval.ts approval_requests.id
  //   organizationId   → core/index.ts organizations.id
  //   createdBy        → core/index.ts users.id
}));

export const publishingResultsRelations = relations(publishingResults, ({ one }) => ({
  post: one(posts, {
    fields: [publishingResults.postId],
    references: [posts.id],
    relationName: "post_publishingResults",
  }),

  // Cross-module references (resolved at application layer):
  //   Performance metrics → analytics_aggregates
  //     WHERE dimension_1 = postId AND dimension_2 = 'post'
  //     AND platform = this.platform
}));
