import { desc, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { approvalRequestStatusEnum, platformEnum, templateTypeEnum } from "../shared/enums";

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * Unified template store for the entire platform.
 *
 * Replaces (never create these):
 *   contentTemplates    (publishing module)
 *   engagementTemplates (engagement module)
 *   campaignTemplates   (campaigns module)
 *   crisis template fields inlined on press_releases
 *
 * notification_templates is explicitly excluded — no such table exists
 * in the actual schema (verified against all pasted files in this session).
 *
 * ── Template Types ────────────────────────────────────────────────────────────
 *
 * 'post':
 *   Used by the publishing module to pre-fill post content.
 *   content         → shared copy shown in the cross-platform editor
 *   platformVariants → per-platform overrides
 *   mediaIds        → pre-attached media asset IDs
 *   platform        → NULL = suitable for all platforms; set to restrict
 *   variables       → placeholder definitions
 *   config          → {
 *                       scheduleType?: 'immediate'|'scheduled'|'recurring',
 *                       defaultTimezone?: string,
 *                       utmCampaign?: string,
 *                       utmSource?: string,
 *                       utmMedium?: string,
 *                       requiresApproval?: boolean
 *                     }
 *
 * 'engagement_response':
 *   Used by the engagement module for quick replies to customer messages.
 *   content         → response body (may contain {{variable}} placeholders)
 *   platform        → NULL = all platforms; set to restrict to one platform
 *   variables       → placeholder definitions for mail-merge style fills
 *   intentMatch     → maps to intentLabelEnum values for AI-assisted matching
 *   language        → BCP-47 code e.g. 'en-NG', 'ha', 'yo', 'ig', 'pcm'
 *   isPidginAppropriate → true = safe to use for Nigerian Pidgin conversations
 *   categoryPath    → dot-notation path for UI tree e.g. 'billing.refunds'
 *   config          → {
 *                       toneGuide?: string,         // 'formal'|'casual'|'empathetic'
 *                       maxCharacters?: number,      // platform character limit hint
 *                       suggestedFollowUps?: string[] // IDs of follow-up templates
 *                     }
 *
 * 'press_release':
 *   Used by the PR module as a starting point for new press releases.
 *   Also covers crisis templates (isCrisisTemplate flag in config).
 *   content         → press release body (boilerplate / structure)
 *   variables       → [{ name, description, example }]
 *   config          → {
 *                       // Standard press release config
 *                       headline?: string,
 *                       subheadline?: string,
 *                       boilerplate?: string,       // standard company boilerplate
 *                       targetAudience?: string[],
 *                       distribution?: string[],    // default distribution channels
 *
 *                       // Crisis template config (isCrisisTemplate = true)
 *                       isCrisisTemplate?: boolean,
 *                       crisisType?: string,        // prCrisisTypeEnum value
 *                       crisisSeverity?: number,    // 1-5
 *                       holdingStatement?: string,  // immediate response copy
 *                       responseSteps?: Array<{     // crisis response checklist
 *                         order: number,
 *                         action: string,
 *                         owner: string,
 *                         deadline: string
 *                       }>,
 *                       escalationChannels?: string[]
 *                     }
 *
 * 'campaign':
 *   Used by the campaigns module as a starting scaffold for new giveaway/
 *   contest campaigns. These were the campaignTemplates table.
 *   content         → NULL (campaigns don't have a single text body)
 *   config          → {
 *                       // Full campaign scaffold — mirrors campaigns table shape
 *                       campaignType: string,
 *                       entryMethods: Array<{
 *                         methodType: string,
 *                         points: number,
 *                         isRequired: boolean,
 *                         displayOrder: number,
 *                         config: object
 *                       }>,
 *                       prizeTiers: Array<{
 *                         tier: string,
 *                         name: string,
 *                         description: string,
 *                         quantity: number,
 *                         value: number
 *                       }>,
 *                       eligibilityCriteria: object,
 *                       fraudRules: object,
 *                       branding: object,
 *                       targetMetrics: object,
 *                       minimumAge: number,
 *                       ndprCompliant: boolean,
 *                       // Success benchmarks from prior campaigns
 *                       successMetrics: {
 *                         avgConversionRate: number,
 *                         avgEntries: number,
 *                         avgDurationDays: number
 *                       }
 *                     }
 *
 * 'email':
 *   Used for transactional and marketing email templates.
 *   content         → HTML or Markdown email body
 *   variables       → [{ name, type, defaultValue, required }]
 *   config          → {
 *                       subject: string,
 *                       previewText?: string,
 *                       fromName?: string,
 *                       replyTo?: string,
 *                       category: 'transactional'|'marketing'|'notification'
 *                     }
 *
 * ── Visibility Matrix ─────────────────────────────────────────────────────────
 *
 * organizationId=NULL + isPublic=true   → system template, all orgs can use
 * organizationId=NULL + isPublic=false  → system template, internal only
 * organizationId=SET  + isOrganizationWide=true  → all org members can use
 * organizationId=SET  + isOrganizationWide=false → creator only (private draft)
 * isPremium=true → requires plan tier >= 'professional' to use
 *                  enforced at application layer
 *
 * ── Approval ──────────────────────────────────────────────────────────────────
 * requiresApproval = true → template content must be approved before it can be
 * used by other team members. The approval workflow uses approval_requests with
 * entityType='content_template'. Until approved, only the creator can use it.
 *
 * currentApprovalStatus is denormalized from the active approval_requests row
 * for fast list-view queries. Source of truth is approval_requests table.
 *
 * ── Usage Analytics ───────────────────────────────────────────────────────────
 * usageCount      → incremented every time this template is used to create
 *                   a post, response, press release, or campaign
 * avgCsat         → rolling average CSAT score from engagement responses
 *                   using this template (engagement_response type only)
 * avgConversionRate → rolling average conversion rate for campaign templates
 * lastUsedAt      → used to sort templates by recency in the UI picker
 *
 * ── Concurrency ───────────────────────────────────────────────────────────────
 * version:
 *   Optimistic locking counter. Application code MUST issue:
 *     UPDATE templates SET ..., version = version + 1
 *     WHERE id = $id AND version = $currentVersion
 *   Templates are edited frequently (variable tweaks, content refinements,
 *   A/B variations) so two-team-member concurrent edits are a real risk.
 *   If 0 rows are affected, the update is rejected and the caller
 *   re-fetches and retries.
 *
 * ── Per-type field rules (DB-enforced) ────────────────────────────────────────
 *
 * These rules are documented in JSDoc above and now enforced in CHECK:
 *   campaign           → content MUST be NULL
 *   post               → sharedContent and platformVariants are meaningful
 *   engagement_response→ avgCsat, intentMatch, isPidginAppropriate meaningful
 *   campaign           → avgConversionRate is meaningful
 *
 * ── Variables JSONB ───────────────────────────────────────────────────────────
 * [
 *   {
 *     name: string,           // e.g. 'customer_name', 'product_name'
 *     type: 'text' | 'number' | 'date' | 'url' | 'select',
 *     label: string,
 *     description?: string,
 *     defaultValue?: string,
 *     required: boolean,
 *     options?: string[]
 *   }
 * ]
 *
 * ── platformVariants JSONB ────────────────────────────────────────────────────
 * {
 *   twitter_x: { text: string, threadParts?: string[] },
 *   instagram: { caption: string, hashtags?: string[], altText?: string },
 *   linkedin:  { text: string, articleTitle?: string },
 *   facebook:  { text: string },
 *   tiktok:    { caption: string, hashtags?: string[] }
 * }
 */
export const templates = pgTable(
  "templates",
  {
    id: varchar("id", { length: 64 }).notNull().primaryKey(),

    // NULL = system template (visible to all orgs or internal only)
    // SET  = org-specific template
    organizationId: varchar("organization_id", { length: 64 }),

    // ─── Classification ──────────────────────────────────────────────────────
    templateType: templateTypeEnum("template_type").notNull(),

    // ─── Core Identity ───────────────────────────────────────────────────────
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    // ─── Content ─────────────────────────────────────────────────────────────
    // Primary text body — used by post, engagement_response, press_release,
    // email types. NULL for campaign type (no single text body).
    content: text("content"),

    // Cross-platform base copy — post templates only
    // Shown in the shared editor pane before platform-specific variants
    sharedContent: text("shared_content"),

    // Per-platform content overrides — post templates only
    platformVariants: jsonb("platform_variants"),

    // Placeholder variable definitions — see variables JSONB shape above
    variables: jsonb("variables"),

    // Type-specific configuration — see per-type config shapes in JSDoc above
    config: jsonb("config"),

    // ─── Targeting ───────────────────────────────────────────────────────────
    // NULL = suitable for all platforms (most templates)
    // SET  = restricted to one platform (e.g. TikTok-specific engagement reply)
    platform: platformEnum("platform"),

    // ─── Media ───────────────────────────────────────────────────────────────
    // References to media_assets.id — post and email templates only
    // Attached media is pre-filled when the template is applied
    mediaIds: text("media_ids").array(),

    // ─── Categorization ──────────────────────────────────────────────────────
    // Dot-notation path for UI tree navigation
    categoryPath: text("category_path"),

    // Flat category for simple grouping
    category: varchar("category", { length: 100 }),

    // User-defined tags for search and filtering
    tags: text("tags").array(),

    // ─── Engagement-Specific Fields ───────────────────────────────────────────
    // Only meaningful for templateType='engagement_response'
    // AI-assisted matching: compared against intentLabelEnum on incoming messages
    intentMatch: varchar("intent_match", { length: 30 }),

    // BCP-47 language code — defaults to Nigerian English
    language: varchar("language", { length: 5 }).default("en-NG").notNull(),

    // true = appropriate to use when customer writes in Nigerian Pidgin English
    isPidginAppropriate: boolean("is_pidgin_appropriate").default(false).notNull(),

    // ─── Visibility ──────────────────────────────────────────────────────────
    isOrganizationWide: boolean("is_organization_wide").default(false).notNull(),

    isPublic: boolean("is_public").default(false).notNull(),

    isPremium: boolean("is_premium").default(false).notNull(),

    // ─── Approval ────────────────────────────────────────────────────────────
    requiresApproval: boolean("requires_approval").default(false).notNull(),

    // Denormalized from active approval_requests row for fast list queries
    // Source of truth: approval_requests WHERE entity_type='content_template'
    //                  AND entity_id = templates.id
    currentApprovalStatus: approvalRequestStatusEnum("current_approval_status"),

    // ─── Usage Analytics ─────────────────────────────────────────────────────
    // Incremented by application layer each time template is applied
    usageCount: integer("usage_count").default(0).notNull(),

    // Rolling average CSAT — engagement_response templates only (0.00–5.00)
    avgCsat: decimal("avg_csat", { precision: 3, scale: 2 }),

    // Rolling average conversion rate — campaign templates only (0.0000–1.0000)
    avgConversionRate: decimal("avg_conversion_rate", {
      precision: 5,
      scale: 4,
    }),

    // When this template was last applied to create content
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    // ─── Lifecycle ───────────────────────────────────────────────────────────
    isActive: boolean("is_active").default(true).notNull(),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter — see JSDoc above.
    version: integer("version").default(1).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — template outlives creator if they leave the org
    createdById: varchar("created_by_id", { length: 64 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // version must be positive
    check("chk_tmpl_version", sql`${table.version} >= 1`),

    // usageCount must be non-negative
    check("chk_tmpl_usage_count", sql`${table.usageCount} >= 0`),

    // Visibility scope consistency
    check(
      "chk_tmpl_org_wide_requires_org",
      sql`NOT (${table.isOrganizationWide} = TRUE
            AND ${table.organizationId} IS NULL)`,
    ),
    check(
      "chk_tmpl_premium_requires_system",
      sql`NOT (${table.isPremium} = TRUE
            AND ${table.organizationId} IS NOT NULL)`,
    ),
    check(
      "chk_tmpl_public_requires_system",
      sql`NOT (${table.isPublic} = TRUE
            AND ${table.organizationId} IS NOT NULL)`,
    ),

    // usageCount / lastUsedAt consistency
    // usageCount > 0 ↔ lastUsedAt is set
    check(
      "chk_tmpl_usage_consistency",
      sql`(${table.usageCount} = 0 AND ${table.lastUsedAt} IS NULL)
      OR (${table.usageCount} > 0 AND ${table.lastUsedAt} IS NOT NULL)`,
    ),

    // Approval consistency
    // requiresApproval=false → currentApprovalStatus IS NULL
    // requiresApproval=true  → currentApprovalStatus IS NOT NULL
    check(
      "chk_tmpl_approval_consistency",
      sql`(${table.requiresApproval} = FALSE
        AND ${table.currentApprovalStatus} IS NULL)
      OR
      (${table.requiresApproval} = TRUE
        AND ${table.currentApprovalStatus} IS NOT NULL)`,
    ),

    // categoryPath, when set, must not be empty / whitespace
    check(
      "chk_tmpl_category_path_nonempty",
      sql`${table.categoryPath} IS NULL
        OR length(trim(${table.categoryPath})) > 0`,
    ),

    // avgCsat range — engagement_response only
    check(
      "chk_tmpl_csat_range",
      sql`${table.avgCsat} IS NULL
        OR (${table.avgCsat} >= 0 AND ${table.avgCsat} <= 5)`,
    ),
    check(
      "chk_tmpl_csat_engagement_only",
      sql`${table.avgCsat} IS NULL
        OR ${table.templateType} = 'engagement_response'`,
    ),

    // avgConversionRate range — campaign only
    check(
      "chk_tmpl_conversion_range",
      sql`${table.avgConversionRate} IS NULL
        OR (${table.avgConversionRate} >= 0
            AND ${table.avgConversionRate} <= 1)`,
    ),
    check(
      "chk_tmpl_conversion_campaign_only",
      sql`${table.avgConversionRate} IS NULL
        OR ${table.templateType} = 'campaign'`,
    ),

    // Per-type field rules
    // Campaign has no single text body
    check(
      "chk_tmpl_campaign_no_content",
      sql`${table.templateType} <> 'campaign'
        OR ${table.content} IS NULL`,
    ),

    // sharedContent and platformVariants only meaningful for post
    check(
      "chk_tmpl_shared_content_post_only",
      sql`${table.templateType} = 'post'
        OR ${table.sharedContent} IS NULL`,
    ),
    check(
      "chk_tmpl_platform_variants_post_only",
      sql`${table.templateType} = 'post'
        OR ${table.platformVariants} IS NULL`,
    ),

    // intentMatch / isPidginAppropriate only meaningful for engagement_response
    check(
      "chk_tmpl_intent_match_engagement_only",
      sql`${table.intentMatch} IS NULL
        OR ${table.templateType} = 'engagement_response'`,
    ),
    check(
      "chk_tmpl_pidgin_engagement_only",
      sql`${table.isPidginAppropriate} = FALSE
        OR ${table.templateType} = 'engagement_response'`,
    ),

    // ── Uniqueness ───────────────────────────────────────────────────────────

    // Template name is unique per organization
    // (prevents accidental "Welcome Email" × 3 in the same org)
    unique("uq_tmpl_org_name").on(table.organizationId, table.name),

    // ── Primary query patterns ────────────────────────────────────────────────

    // Template picker — org-scoped, type-filtered, active only
    index("idx_tmpl_org_type_active").on(table.organizationId, table.templateType, table.isActive),

    // Platform filter — find templates usable on a specific platform
    index("idx_tmpl_platform").on(table.organizationId, table.platform),

    // Recently updated — common in template management screens
    index("idx_tmpl_org_updated").on(table.organizationId, desc(table.updatedAt)),

    // Creator's templates — "My Templates" view
    index("idx_tmpl_creator_created").on(
      table.organizationId,
      table.createdById,
      desc(table.createdAt),
    ),

    // Approval queue — templates pending review
    index("idx_tmpl_approval_queue").on(
      table.organizationId,
      table.currentApprovalStatus,
      desc(table.updatedAt),
    ),

    // ── Engagement-specific ───────────────────────────────────────────────────

    // AI template selector — match incoming message intent to template
    index("idx_tmpl_intent_active")
      .on(table.organizationId, table.intentMatch)
      .where(
        sql`${table.isActive} = TRUE
          AND ${table.templateType} = 'engagement_response'
          AND ${table.intentMatch} IS NOT NULL`,
      ),

    // Pidgin-appropriate filter — used when message isPidgin=true
    index("idx_tmpl_pidgin")
      .on(table.organizationId)
      .where(
        sql`${table.isPidginAppropriate} = TRUE
          AND ${table.isActive} = TRUE
          AND ${table.templateType} = 'engagement_response'`,
      ),

    // ── System template discovery ─────────────────────────────────────────────

    // Public system templates — template marketplace / starter gallery
    index("idx_tmpl_public_active")
      .on(table.templateType, table.isPublic)
      .where(
        sql`${table.isPublic} = TRUE
          AND ${table.isActive} = TRUE`,
      ),

    // Premium system templates — gated by plan tier
    index("idx_tmpl_premium")
      .on(table.templateType)
      .where(
        sql`${table.isPremium} = TRUE
          AND ${table.isActive} = TRUE`,
      ),

    // ── Usage ranking ─────────────────────────────────────────────────────────

    // "Most used" sort in template picker
    index("idx_tmpl_usage_count").on(table.organizationId, table.templateType, table.usageCount),

    // "Recently used" sort in template picker
    index("idx_tmpl_last_used").on(table.organizationId, table.templateType, table.lastUsedAt),

    // ── Approval ─────────────────────────────────────────────────────────────

    // Templates pending approval — shown in approver's queue
    index("idx_tmpl_pending_approval")
      .on(table.organizationId)
      .where(sql`${table.currentApprovalStatus} = 'pending'`),

    // ── Category navigation ───────────────────────────────────────────────────

    index("idx_tmpl_category").on(table.organizationId, table.category),

    // GIN indexes — applied via raw SQL migration
    // (Drizzle's index builder cannot express GIN in the schema definition)
    //
    // CREATE INDEX idx_tmpl_fts ON templates
    //   USING GIN(to_tsvector('english',
    //     name || ' ' || COALESCE(description, '')))
    //   WHERE is_active = TRUE;
    //
    // CREATE INDEX idx_tmpl_tags ON templates
    //   USING GIN(tags)
    //   WHERE is_active = TRUE;
    //
    // CREATE INDEX idx_tmpl_variables ON templates
    //   USING GIN(variables);
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *
 *   posts           WHERE template_id = templates.id  (publishing module)
 *   press_releases  WHERE template_id = templates.id  (pr module)
 *   campaigns       WHERE template_id = templates.id  (campaigns module)
 *   approval_requests WHERE entity_type='content_template'
 *                       AND entity_id = templates.id   (shared/approval)
 *
 * These are intentionally NOT modeled as Drizzle relations on templates
 * because they cross module boundaries. Each owning module declares the
 * back-reference on its own table.
 */
export const templatesRelations = relations(templates, (_) => ({
  // Cross-module relations are declared in the owning module's schema file.
  // See comments above for the resolution pattern.
}));
