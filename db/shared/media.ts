import { desc, relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { mediaAssetTypeEnum, mediaAttachedToTypeEnum } from "../shared/enums";

// =============================================================================
// MEDIA ASSETS
// =============================================================================

/**
 * Unified media asset store for the entire platform.
 *
 * Replaces (never create these):
 *   mediaAssets          (publishing module — library assets)
 *   engagementAttachments (engagement module — inbound attachments)
 *
 * ── Two categories of assets ─────────────────────────────────────────────────
 *
 * 1. Library assets (attachedToType = NULL):
 *    Uploaded by team members for reuse across posts, press releases,
 *    and email campaigns. Organized by folderPath for UI navigation.
 *    Lifecycle: uploaded → processed → active → soft-deleted → hard-deleted
 *    Hard delete via data_retention_policies after soft-delete grace period.
 *
 * 2. Attached assets (attachedToType SET):
 *    - 'engagement_response': inbound files sent by customers in DMs/comments
 *    - 'press_release': images/PDFs attached to press releases
 *    - 'influencer_content': draft content submitted by influencers for review
 *    - 'content_template': media pre-attached to a template
 *    - 'post': media attached to a specific post (vs library asset referenced
 *               by posts.mediaIds[] — both patterns are valid)
 *
 * ── Storage architecture ──────────────────────────────────────────────────────
 *
 * storageUrl → Cloudflare R2 origin URL
 *              Used for: internal processing, virus scanning, resizing
 *              Never exposed directly to end users or clients
 *
 * cdnUrl     → Bunny CDN delivery URL
 *              Used for: all client-facing contexts (UI, emails, API responses)
 *              NULL until CDN processing completes
 *              Pattern: https://cdn.gilobusiness.com/{orgId}/{assetId}/{filename}
 *
 * thumbnailUrl → CDN URL of the generated thumbnail
 *                NULL for: audio, document, and other non-visual assets
 *                Generated at: 400×400px, WebP format, 85% quality
 *
 * ── Processing pipeline state machine ────────────────────────────────────────
 *
 * processingState JSONB shape:
 * {
 *   status: 'pending' | 'scanning' | 'processing' | 'complete' | 'failed',
 *
 *   virusScan: {
 *     status: 'pending' | 'clean' | 'infected' | 'failed',
 *     scannedAt: string | null,
 *     engine: string | null,
 *     threatName: string | null
 *   },
 *
 *   processing: {
 *     originalDimensions: { width: number, height: number } | null,
 *     resizedVersions: Array<{
 *       size: 'thumb' | 'small' | 'medium' | 'large' | 'original',
 *       width: number,
 *       height: number,
 *       url: string,
 *       sizeBytes: number
 *     }>,
 *     duration: number | null,
 *     format: string | null,
 *     processedAt: string | null
 *   },
 *
 *   cdn: {
 *     uploaded: boolean,
 *     uploadedAt: string | null,
 *     cdnUrl: string | null,
 *     thumbnailUrl: string | null,
 *     error: string | null
 *   },
 *
 *   error: {
 *     stage: 'virus_scan' | 'processing' | 'cdn_upload',
 *     message: string,
 *     retryCount: number,
 *     lastRetryAt: string | null
 *   } | null
 * }
 *
 * State transitions:
 *   pending → scanning     (virus scan worker picks up the job)
 *   scanning → processing  (scan result: clean)
 *   scanning → failed      (scan result: infected OR scan engine error)
 *   processing → pending_cdn (image/video processing complete)
 *   pending_cdn → complete (CDN upload successful)
 *   any → failed           (unrecoverable error — retryCount exhausted)
 *
 * NULL processingState:
 *   Library assets that completed processing before this column was added
 *   OR assets that bypassed processing (e.g. direct CDN URL imports).
 *   Application layer treats NULL as 'complete'.
 *
 * ── Concurrency ──────────────────────────────────────────────────────────────
 *
 * This table is actively mutated by multiple background processes:
 *   - Virus scanner
 *   - Image/video processor
 *   - CDN uploader
 *   - Metadata editor
 *   - Soft-delete worker
 *
 * version:
 *   Optimistic locking counter. Application code MUST issue:
 *     UPDATE media_assets
 *     SET ..., version = version + 1
 *     WHERE id = $id AND version = $currentVersion
 *   If 0 rows affected, the update is rejected and the caller re-fetches
 *   and retries. Prevents two background workers from silently overwriting
 *   each other's updates — e.g. a CDN uploader and a metadata editor
 *   touching the same row simultaneously.
 *
 * ── Removed from original mediaAssets table ───────────────────────────────────
 *
 * usedInPosts TEXT[]:
 *   Removed — denormalized array that drifts out of sync as posts are
 *   created, edited, and deleted. Query instead:
 *
 *   Library asset used in a post:
 *     SELECT * FROM posts WHERE media_ids @> ARRAY[$assetId]
 *
 *   Attached asset for a post:
 *     SELECT * FROM media_assets
 *     WHERE attached_to_type = 'post'
 *     AND attached_to_id = $postId
 *
 * ── sizeBytes type choice ────────────────────────────────────────────────────
 *
 * integer (max ~2.1 GB) would be sufficient for most files but video assets
 * can exceed 2 GB. bigint used to avoid future constraint violations.
 *
 * ── altText ──────────────────────────────────────────────────────────────────
 *
 * Required for accessibility compliance (WCAG 2.1 AA) and SEO.
 * Not enforced as NOT NULL — inbound attachments from customers don't have
 * alt text and it would be wrong to block their upload.
 * Application layer warns when publishing a post with media missing altText.
 *
 * ── Soft delete ──────────────────────────────────────────────────────────────
 *
 * Library assets only. isDeleted + deletedAt enable:
 *   - Immediate removal from UI without destroying CDN links in published posts
 *   - 30-day recovery window before hard delete
 *   - Hard delete via data_retention_policies:
 *       dataType='media_assets', retentionDays=30, retentionAction='delete'
 *       filterCondition='is_deleted = TRUE'
 *
 * Attached assets are never soft-deleted — they are deleted when their parent
 * entity is deleted (enforced at application layer, not via DB CASCADE since
 * the FK is polymorphic).
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Attachment Context ───────────────────────────────────────────────────
    // NULL = library asset (reusable, org-owned, organized by folder)
    // SET  = attached to a specific entity instance
    attachedToType: mediaAttachedToTypeEnum("attached_to_type"),

    // Polymorphic entity ID — resolved by attachedToType at application layer
    // NULL when attachedToType is NULL (library asset)
    attachedToId: varchar("attached_to_id", { length: 32 }),

    // ─── Reverse index for library assets (denormalized, same pattern as
    //     the original media_assets.usedInPosts) ────────────────────────────
    usedInEntityIds: text("used_in_entity_ids").array(),

    // ─── Asset Identity ───────────────────────────────────────────────────────
    name: varchar("name", { length: 255 }).notNull(),
    assetType: mediaAssetTypeEnum("asset_type").notNull(),

    // ─── Storage URLs ────────────────────────────────────────────────────────
    // Cloudflare R2 origin — internal use only, never exposed to clients
    storageUrl: text("storage_url").notNull(),

    // Bunny CDN delivery URL — used in all client-facing contexts
    // NULL until CDN upload completes (processingState.cdn.uploaded = true)
    cdnUrl: text("cdn_url"),

    // Thumbnail CDN URL — NULL for audio, document, other non-visual types
    // Generated at 400×400px WebP by the processing pipeline
    thumbnailUrl: text("thumbnail_url"),

    // ─── File Metadata ───────────────────────────────────────────────────────
    // bigint — video files can exceed integer max (~2.1 GB)
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),

    // ─── Visual Dimensions ───────────────────────────────────────────────────
    // NULL for audio, document, and other non-visual asset types
    width: integer("width"),
    height: integer("height"),

    // Duration in seconds — video and gif assets only
    // NULL for image, audio, document types
    durationSeconds: decimal("duration_seconds", {
      precision: 10,
      scale: 3,
    }),

    // ─── Processing Pipeline ─────────────────────────────────────────────────
    // Full pipeline state machine — see JSDoc above for shape
    // NULL = processing complete (legacy) or bypassed (direct import)
    processingState: jsonb("processing_state"),

    // ─── Library Organization ────────────────────────────────────────────────
    // Only meaningful for library assets (attachedToType IS NULL)
    // Virtual folder path for UI navigation — NOT a real filesystem path
    // Examples: '/campaigns/q1-2026', '/brand-assets/logos', '/product-shots'
    // NULL for attached assets
    folderPath: text("folder_path"),
    //         never reused (was engagement_attachments)
    isLibraryAsset: boolean("is_library_asset").default(true).notNull(),
    purpose: varchar("purpose", { length: 30 }),
    displayOrder: integer("display_order"),
    // User-defined tags for search and filtering in the asset library
    // NULL for attached assets — they are not searched from the library
    tags: text("tags").array(),

    // Alt text for accessibility and SEO
    // Required for published posts with media (warned but not blocked at DB level)
    altText: text("alt_text"),

    // ─── Copyright & Attribution ─────────────────────────────────────────────
    // Optional — for stock images or licensed media
    attribution: text("attribution"),

    // License type e.g. 'CC-BY-4.0', 'royalty-free', 'editorial-only'
    licenseType: varchar("license_type", { length: 50 }),

    // Date after which this asset cannot be used in new content
    // NULL = no expiry. Checked at publish time.
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),

    // ─── Lifecycle (library assets only) ─────────────────────────────────────
    // Soft delete — attached assets are never soft-deleted
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter — see JSDoc above.
    version: integer("version").default(1).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — asset must survive uploader leaving the org
    uploadedBy: varchar("uploaded_by", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // version must be positive
    check("chk_ma_version", sql`${table.version} >= 1`),

    // sizeBytes must be positive
    check("chk_ma_size_positive", sql`${table.sizeBytes} > 0`),

    // Visual dimensions consistency: both set or both null
    check(
      "chk_ma_dimensions_consistent",
      sql`(${table.width} IS NULL) = (${table.height} IS NULL)`,
    ),

    // When dimensions are set, both must be positive
    check(
      "chk_ma_dimensions_positive",
      sql`${table.width} IS NULL
        OR (${table.width} > 0 AND ${table.height} > 0)`,
    ),

    // durationSeconds must be positive when set
    check(
      "chk_ma_duration_positive",
      sql`${table.durationSeconds} IS NULL
        OR ${table.durationSeconds} > 0`,
    ),

    // durationSeconds only meaningful for video and gif
    check(
      "chk_ma_duration_video_only",
      sql`${table.durationSeconds} IS NULL
        OR ${table.assetType} IN ('video', 'gif')`,
    ),

    // thumbnailUrl only for visual asset types
    // (image, video, gif) — never for audio, document, etc.
    check(
      "chk_ma_thumbnail_visual_only",
      sql`${table.thumbnailUrl} IS NULL
        OR ${table.assetType} IN ('image', 'video', 'gif')`,
    ),

    // attachedToId must be set when attachedToType is set, and vice versa
    check(
      "chk_ma_attachment_consistency",
      sql`(${table.attachedToType} IS NULL) = (${table.attachedToId} IS NULL)`,
    ),

    // Soft delete only makes sense for library assets
    check(
      "chk_ma_soft_delete_library_only",
      sql`NOT (${table.isDeleted} = TRUE
            AND ${table.attachedToType} IS NOT NULL)`,
    ),

    // folderPath only makes sense for library assets
    check(
      "chk_ma_folder_library_only",
      sql`NOT (${table.folderPath} IS NOT NULL
            AND ${table.attachedToType} IS NOT NULL)`,
    ),

    // folderPath, when set, must not be empty
    check(
      "chk_ma_folder_path_nonempty",
      sql`${table.folderPath} IS NULL
        OR length(trim(${table.folderPath})) > 0`,
    ),

    // tags only meaningful for library assets
    check(
      "chk_ma_tags_library_only",
      sql`${table.tags} IS NULL
        OR ${table.attachedToType} IS NULL`,
    ),

    // deletedAt ↔ isDeleted: deletedAt set iff isDeleted=true
    // (Strengthens the original one-direction check)
    check(
      "chk_ma_soft_delete_consistency",
      sql`(${table.isDeleted} = FALSE
        AND ${table.deletedAt} IS NULL)
      OR
      (${table.isDeleted} = TRUE
        AND ${table.deletedAt} IS NOT NULL)`,
    ),

    // licenseExpiresAt only meaningful when licenseType is set
    check(
      "chk_ma_license_expiry_requires_type",
      sql`${table.licenseExpiresAt} IS NULL
        OR ${table.licenseType} IS NOT NULL`,
    ),

    // licenseExpiresAt must be after createdAt when set
    check(
      "chk_ma_license_expiry_after_created",
      sql`${table.licenseExpiresAt} IS NULL
        OR ${table.licenseExpiresAt} > ${table.createdAt}`,
    ),

    // deletedAt must be after createdAt when set
    check(
      "chk_ma_deleted_at_after_created",
      sql`${table.deletedAt} IS NULL
        OR ${table.deletedAt} >= ${table.createdAt}`,
    ),

    // ── Library asset queries ─────────────────────────────────────────────────

    // Asset library main view — active, non-deleted library assets
    index("idx_ma_library_active")
      .on(table.organizationId, table.assetType, desc(table.createdAt))
      .where(
        sql`${table.attachedToType} IS NULL
          AND ${table.isDeleted} = FALSE`,
      ),

    // Folder navigation — browse assets in a specific folder
    index("idx_ma_folder")
      .on(table.organizationId, table.folderPath)
      .where(
        sql`${table.attachedToType} IS NULL
          AND ${table.isDeleted} = FALSE
          AND ${table.folderPath} IS NOT NULL`,
      ),

    // Type filter within library — "show me all videos"
    index("idx_ma_library_type")
      .on(table.organizationId, table.assetType)
      .where(
        sql`${table.attachedToType} IS NULL
          AND ${table.isDeleted} = FALSE`,
      ),

    // Name search — "find asset named X" within the library
    index("idx_ma_library_name").on(table.organizationId, table.name),

    // Recently uploaded — "what did we just upload?"
    index("idx_ma_recent_uploaded").on(table.organizationId, desc(table.createdAt)),

    // ── Attachment lookup ─────────────────────────────────────────────────────

    // "Find all assets attached to engagement response XYZ"
    // "Find all assets attached to press release ABC"
    index("idx_ma_attached").on(table.attachedToType, table.attachedToId),

    // ── Processing pipeline ───────────────────────────────────────────────────

    // Processing worker — find assets waiting to be processed
    index("idx_ma_pending_processing")
      .on(table.organizationId, table.createdAt)
      .where(
        sql`${table.processingState} IS NOT NULL
          AND (${table.processingState}->>'status') IN ('pending', 'scanning', 'processing')`,
      ),

    // Failed processing — alerts and retry queue
    index("idx_ma_failed_processing")
      .on(table.organizationId, table.createdAt)
      .where(sql`(${table.processingState}->>'status') = 'failed'`),

    // ── License management ────────────────────────────────────────────────────

    // Expiring licenses — warn editors before using about-to-expire assets
    index("idx_ma_license_expiry")
      .on(table.organizationId, table.licenseExpiresAt)
      .where(
        sql`${table.licenseExpiresAt} IS NOT NULL
          AND ${table.isDeleted} = FALSE`,
      ),

    // ── Admin / audit ────────────────────────────────────────────────────────

    // Uploader history — "show me all assets uploaded by this user"
    index("idx_ma_uploader").on(table.uploadedBy, desc(table.createdAt)),

    // Soft-deleted assets pending hard deletion
    index("idx_ma_deleted")
      .on(table.organizationId, table.deletedAt)
      .where(sql`${table.isDeleted} = TRUE`),

    // CDN URL lookup — direct CDN access for asset management
    // Rare but useful for CDN invalidation workers
    index("idx_ma_cdn_url").on(table.cdnUrl),

    // Storage URL lookup — workers locating the origin object
    index("idx_ma_storage_url").on(table.storageUrl),

    // GIN indexes — applied via raw SQL migration
    // (Cannot be expressed in Drizzle's index builder)
    //
    // CREATE INDEX idx_ma_tags ON media_assets
    //   USING GIN(tags)
    //   WHERE attached_to_type IS NULL AND is_deleted = FALSE;
    //
    // CREATE INDEX idx_ma_fts ON media_assets
    //   USING GIN(to_tsvector('english', name))
    //   WHERE attached_to_type IS NULL AND is_deleted = FALSE;
    //
    // CREATE INDEX idx_ma_processing_state ON media_assets
    //   USING GIN(processing_state)
    //   WHERE processing_state IS NOT NULL;
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *
 *   media_assets.uploadedBy         → users.id  (may be deleted)
 *   media_assets.attachedToType/Id → polymorphic per type:
 *     'engagement_response' → engagement_responses.id
 *     'press_release'       → press_releases.id
 *     'influencer_content'  → influencer_program_assignments.id
 *     'content_template'    → templates.id
 *     'post'                → posts.id
 *
 * No Drizzle relations are declared. The polymorphic pattern is preserved
 * to avoid circular imports and to keep the attached-vs-library semantics
 * explicit at the query layer.
 *
 *   Library asset referenced by a post (via posts.mediaIds[]):
 *     SELECT ma.* FROM media_assets ma
 *     WHERE ma.id = ANY($postMediaIds)
 *     AND ma.organization_id = $orgId
 *     AND ma.is_deleted = FALSE
 *
 *   Assets directly attached to an engagement response:
 *     SELECT ma.* FROM media_assets ma
 *     WHERE ma.attached_to_type = 'engagement_response'
 *     AND ma.attached_to_id = $responseId
 */
export const mediaAssetsRelations = relations(mediaAssets, (_) => ({
  // attachedToType + attachedToId are polymorphic — resolved at app layer.
  // uploadedBy references users — cross-module, resolved at app layer.
}));
