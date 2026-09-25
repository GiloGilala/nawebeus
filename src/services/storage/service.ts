/**
 * Media storage service (NWB-P1-005) — the only import path for storage, matching the
 * `email/` convention.
 *
 * What lives here vs. in a transport: the *row* is this file's job (media_assets, org scoping,
 * optimistic versioning, audit), the *bytes* are the transport's (local disk or R2). The service
 * dispatches on the row's `storage_url` scheme, so an asset uploaded under one driver stays
 * readable after a deployment switches drivers — the key is the durable identity, the transport
 * is where it happens to live today.
 *
 * Deliberately not here (see the ticket's scope-out): virus scanning, thumbnails, CDN upload —
 * the `processing_state` pipeline is the monitoring-era ingestion's business. Rows upload with
 * `processing_state = NULL`, which the schema header already defines as "treated as complete".
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Config } from "../../lib/config";
import {
  ConflictError,
  GoneError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from "../../lib/errors";
import { logger } from "../../lib/logger";
import {
  buildPage,
  type CursorIdShape,
  type Page,
  type PaginationParams,
} from "../../lib/pagination";
import { writeAuditLog } from "../audit";
import { LocalDiskStorageTransport } from "./local";
import { R2StorageTransport } from "./r2";
import { parseStorageUrl, type StorageDriver, type StorageTransport, storageUrlFor } from "./types";

/** Asset id prefix — `med_<uuid>`, 40 chars, inside the widened `varchar(64)`. */
export const MEDIA_ASSET_ID_PATTERN = /^med_[0-9a-f-]{36}$/i;

/** Cursor shape for the list route — `med_…` ids, not bare uuids. */
export const mediaCursorShape: CursorIdShape = { idPattern: MEDIA_ASSET_ID_PATTERN };

/** Hard floor so a caller cannot configure the cap below a favicon. */
export const MEDIA_MIN_UPLOAD_BYTES = 1;

/** mime → `media_asset_type`. Unmappable types upload as `other` — rejecting them would make
 *  the store unable to hold exactly the files support tickets are about. */
export function assetTypeForMime(
  mimeType: string,
): "image" | "video" | "gif" | "audio" | "document" | "other" {
  const mime = mimeType.toLowerCase();
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.startsWith("text/") ||
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation") ||
    mime.includes("zip") ||
    mime.includes("csv")
  ) {
    return "document";
  }
  return "other";
}

/**
 * Keep the client-supplied filename inside a single path segment: one line, no separators, no
 * dotfiles, bounded length. The transport's resolved-path check is the real guard; this is the
 * belt that keeps a key *readable* — and it is why the check back there exists at all.
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "upload";
  // Control characters are stripped by code point rather than a literal `\u0000` range inside
  // the regex source — Biome (correctly) refuses literal control characters in a regex, and a
  // class built from code points says the same thing without the lint fight.
  const controlChars = new RegExp(`[${String.fromCodePoint(0)}-${String.fromCodePoint(31)}]`, "gu");
  const cleaned = base
    .replace(controlChars, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim();
  const safe = cleaned.length > 0 ? cleaned : "upload";
  return safe.length > 200 ? `${safe.slice(0, 150)}…${safe.slice(-40)}` : safe;
}

/**
 * A Postgres array literal for text[] params. Built as a string rather than passed as a JS
 * array because the driver's inferred bind type does not survive the `::text[]` cast on every
 * element shape (42846); an explicit, properly quoted literal always parses.
 */
function tagsLiteral(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  return `{${tags.map((t) => `"${t.replace(/\\/g, "\\\\")}"`)}}`;
}

/** The object key an asset's bytes live under: `{orgId}/{assetId}/{filename}`. */
export function storageKeyFor(organizationId: string, assetId: string, fileName: string): string {
  return `${organizationId}/${assetId}/${sanitizeFileName(fileName)}`;
}

export interface MediaAssetRecord {
  id: string;
  organizationId: string;
  attachedToType: string | null;
  attachedToId: string | null;
  name: string;
  assetType: string;
  storageUrl: string;
  cdnUrl: string | null;
  sizeBytes: number;
  mimeType: string;
  folderPath: string | null;
  tags: string[] | null;
  altText: string | null;
  isDeleted: boolean;
  version: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type MediaAssetRowRaw = {
  id: string;
  organization_id: string;
  attached_to_type: string | null;
  attached_to_id: string | null;
  name: string;
  asset_type: string;
  storage_url: string;
  cdn_url: string | null;
  size_bytes: string | number;
  mime_type: string;
  folder_path: string | null;
  tags: string[] | null;
  alt_text: string | null;
  is_deleted: boolean;
  version: number;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
};

function mapRow(raw: MediaAssetRowRaw): MediaAssetRecord {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    attachedToType: raw.attached_to_type,
    attachedToId: raw.attached_to_id,
    name: raw.name,
    assetType: raw.asset_type,
    storageUrl: raw.storage_url,
    cdnUrl: raw.cdn_url,
    sizeBytes: Number(raw.size_bytes),
    mimeType: raw.mime_type,
    folderPath: raw.folder_path,
    tags: raw.tags,
    altText: raw.alt_text,
    isDeleted: raw.is_deleted,
    version: raw.version,
    uploadedBy: raw.uploaded_by,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

const MEDIA_COLUMNS = sql`
  id, organization_id, attached_to_type, attached_to_id, name, asset_type, storage_url,
  cdn_url, size_bytes, mime_type, folder_path, tags, alt_text, is_deleted, version,
  uploaded_by, created_at, updated_at
`;

export interface UploadMediaInput {
  organizationId: string;
  uploadedBy: string;
  /** Client-supplied filename. Sanitized before it touches a key. */
  name: string;
  mimeType: string;
  data: Uint8Array;
  folderPath?: string | undefined;
  altText?: string | undefined;
  tags?: string[] | undefined;
}

export interface UploadMediaResult {
  asset: MediaAssetRecord;
  /** The no-cookie URL this upload's bytes can be fetched from, right now. */
  signedUrl: string;
  signedUrlExpiresInSeconds: number;
}

export interface StorageServiceOptions {
  readonly config: Config;
  /** One transport per driver — reads dispatch on the row's `storage_url` scheme. */
  readonly transports: Partial<Record<StorageDriver, StorageTransport>>;
  /** Default transport for new uploads when the config-derived one is missing (tests). */
  readonly defaultDriver?: StorageDriver | undefined;
  readonly newId?: (() => string) | undefined;
  readonly now?: (() => Date) | undefined;
}

export const SIGNED_URL_DEFAULT_SECONDS = 900;
export const SIGNED_URL_MAX_SECONDS = 3_600;

export function createStorageService(options: StorageServiceOptions) {
  const { config, transports } = options;
  const defaultDriver: StorageDriver = options.defaultDriver ?? config.STORAGE_DRIVER_RESOLVED;
  const maxBytes = config.MEDIA_MAX_UPLOAD_MB * 1_000_000;

  function transportFor(driver: StorageDriver): StorageTransport {
    const transport = transports[driver];
    if (!transport) {
      throw new Error(`storage transport "${driver}" is not configured in this process`);
    }
    return transport;
  }

  async function fetchAssetRow(
    db: NodePgDatabase<Record<string, any>>,
    organizationId: string,
    assetId: string,
  ): Promise<MediaAssetRecord | null> {
    const rows = (await db.execute<MediaAssetRowRaw>(sql`
        SELECT ${MEDIA_COLUMNS} FROM media_assets
        WHERE id = ${assetId} AND organization_id = ${organizationId}
        LIMIT 1
      `)) as any;
    const raw = rows.rows?.[0] as MediaAssetRowRaw | undefined;
    return raw ? mapRow(raw) : null;
  }

  return {
    /** The driver new uploads go to — the config-derived one, overridable per instance. */
    get defaultDriver(): StorageDriver {
      return defaultDriver;
    },

    async uploadMedia(
      db: NodePgDatabase<Record<string, any>>,
      input: UploadMediaInput,
    ): Promise<UploadMediaResult> {
      if (input.data.byteLength < MEDIA_MIN_UPLOAD_BYTES) {
        throw new ValidationError("Cannot store an empty file", [
          { field: "file", message: "File is empty" },
        ]);
      }
      if (input.data.byteLength > maxBytes) {
        throw new PayloadTooLargeError(
          `File exceeds the ${config.MEDIA_MAX_UPLOAD_MB} MB upload limit`,
        );
      }

      const assetId = options.newId?.() ?? `med_${randomUUID()}`;
      const assetType = assetTypeForMime(input.mimeType);
      const key = storageKeyFor(input.organizationId, assetId, input.name);
      const transport = transportFor(defaultDriver);

      // Bytes first, row second: a row whose object vanished on a crash is recoverable garbage;
      // an object no row names is silent leakage. A rolled-back insert (the audit write failing,
      // a constraint refusing) leaves an orphaned object — acceptable at this layer, and the
      // storage-prefix sweep in the retention phase reclaims them.
      const put = await transport.put(key, input.data, { contentType: input.mimeType });

      const inserted = (await db.execute<MediaAssetRowRaw>(sql`
          INSERT INTO media_assets (
            id, organization_id, name, asset_type, storage_url, size_bytes, mime_type,
            folder_path, tags, alt_text, uploaded_by
          ) VALUES (
            ${assetId}, ${input.organizationId}, ${sanitizeFileName(input.name)}, ${assetType},
            ${storageUrlFor(defaultDriver, put.key)}, ${put.sizeBytes}, ${input.mimeType},
            ${input.folderPath ?? null},
            ${tagsLiteral(input.tags)}::text[],
            ${input.altText ?? null}, ${input.uploadedBy}
          )
          RETURNING ${MEDIA_COLUMNS}
        `)) as any;
      const asset = mapRow(inserted.rows[0] as MediaAssetRowRaw);

      await writeAuditLog({
        db,
        module: "core",
        organizationId: input.organizationId,
        actorId: input.uploadedBy,
        actorType: "user",
        action: "media.uploaded",
        resourceId: asset.id,
        afterState: {
          name: asset.name,
          assetType,
          sizeBytes: asset.sizeBytes,
          mimeType: asset.mimeType,
          storageDriver: defaultDriver,
          ...(input.folderPath ? { folderPath: input.folderPath } : {}),
        },
      });

      const signedUrlExpiresInSeconds = Math.min(
        SIGNED_URL_DEFAULT_SECONDS,
        SIGNED_URL_MAX_SECONDS,
      );
      const signedUrl = await transportFor(
        parseStorageUrl(asset.storageUrl)?.driver ?? defaultDriver,
      ).signedUrl(parseStorageUrl(asset.storageUrl)!.key, {
        expiresInSeconds: signedUrlExpiresInSeconds,
      });
      return { asset, signedUrl, signedUrlExpiresInSeconds };
    },

    async getMedia(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      assetId: string,
    ): Promise<MediaAssetRecord> {
      const asset = await fetchAssetRow(db, organizationId, assetId);
      if (!asset) throw new NotFoundError("Media asset not found");
      return asset;
    },

    /**
     * The owning org of one asset, or `undefined` — the signed route's pre-check, which must
     * know the org to verify an HMAC before it is allowed to touch the bytes. No org answer is
     * the same 404 the authed routes give; the signature is what separates this from an
     * enumeration oracle.
     */
    async assetOrg(
      db: NodePgDatabase<Record<string, any>>,
      assetId: string,
    ): Promise<{ organizationId: string; isDeleted: boolean } | undefined> {
      const rows = (await db.execute<{ organization_id: string; is_deleted: boolean }>(sql`
          SELECT organization_id, is_deleted FROM media_assets WHERE id = ${assetId} LIMIT 1
        `)) as any;
      const raw = rows.rows?.[0] as { organization_id: string; is_deleted: boolean } | undefined;
      return raw ? { organizationId: raw.organization_id, isDeleted: raw.is_deleted } : undefined;
    },

    /**
     * A no-cookie URL for one asset. Soft-deleted → `GoneError` (410): the asset existed, its
     * links must stop working, and "request it again" is a lie for a deleted upload.
     */
    async signedDownloadUrl(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      assetId: string,
      expiresInSeconds = SIGNED_URL_DEFAULT_SECONDS,
    ): Promise<string> {
      const asset = await fetchAssetRow(db, organizationId, assetId);
      if (!asset) throw new NotFoundError("Media asset not found");
      if (asset.isDeleted) throw new GoneError("Media asset has been deleted");
      const parsed = parseStorageUrl(asset.storageUrl);
      if (!parsed) throw new Error(`media asset ${asset.id} has a corrupt storage_url`);
      return transportFor(parsed.driver).signedUrl(parsed.key, {
        expiresInSeconds: Math.min(Math.max(expiresInSeconds, 1), SIGNED_URL_MAX_SECONDS),
      });
    },

    /** Bytes for the signed route. Signature/expiry checks are the route's job; this resolves. */
    async readContent(
      db: NodePgDatabase<Record<string, any>>,
      assetId: string,
    ): Promise<{ data: Uint8Array; mimeType: string; organizationId: string } | undefined> {
      const rows = (await db.execute<MediaAssetRowRaw>(sql`
          SELECT ${MEDIA_COLUMNS} FROM media_assets WHERE id = ${assetId} LIMIT 1
        `)) as any;
      const raw = rows.rows?.[0] as MediaAssetRowRaw | undefined;
      if (!raw) return undefined;
      const asset = mapRow(raw);
      if (asset.isDeleted) return undefined;
      const parsed = parseStorageUrl(asset.storageUrl);
      if (!parsed) {
        logger.warn("media.corrupt_storage_url", {
          assetId: asset.id,
          storageUrl: asset.storageUrl,
        });
        return undefined;
      }
      const content = await transportFor(parsed.driver).get(parsed.key);
      if (!content) return undefined;
      return { data: content.data, mimeType: asset.mimeType, organizationId: asset.organizationId };
    },

    /**
     * Soft delete — **library assets only**. Attached assets die with their parent entity (the
     * DB's `chk_ma_soft_delete_library_only` CHECK is the same rule in stone; refusing here
     * turns the constraint back into documentation). Optimistic version bump: a background
     * worker and an admin pressing delete must not silently interleave.
     */
    async softDeleteMedia(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      assetId: string,
      actor: { actorId: string; actorType: "user" | "api_key" | "admin" | "system" },
      expectedVersion: number,
    ): Promise<void> {
      const asset = await fetchAssetRow(db, organizationId, assetId);
      if (!asset) throw new NotFoundError("Media asset not found");
      if (asset.attachedToType !== null) {
        throw new ValidationError("Attached assets are deleted with their parent entity", [
          { field: "assetId", message: "This asset is attached and cannot be deleted directly" },
        ]);
      }
      if (asset.isDeleted) return; // Idempotent: the second click is a no-op, not an event.

      const updated = (await db.execute<{ id: string }>(sql`
          UPDATE media_assets
          SET is_deleted = true, deleted_at = now(), version = version + 1, updated_at = now()
          WHERE id = ${assetId} AND organization_id = ${organizationId}
            AND version = ${expectedVersion}
          RETURNING id
        `)) as any;
      if (((updated.rows as unknown[]) ?? []).length === 0) {
        throw new ConflictError("Media asset was modified concurrently — reload and retry");
      }

      await writeAuditLog({
        db,
        module: "core",
        organizationId,
        actorId: actor.actorId,
        actorType: actor.actorType,
        action: "media.deleted",
        resourceId: asset.id,
        beforeState: { version: asset.version, name: asset.name },
      });
    },

    async listLibraryAssets(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      page: PaginationParams,
      options: { folderPath?: string | undefined } = {},
    ): Promise<Page<MediaAssetRecord>> {
      const folderClause = options.folderPath
        ? sql`AND folder_path = ${options.folderPath}`
        : sql``;
      const cursorClause = page.cursor
        ? sql`AND (created_at, id) < (${page.cursor.v}::timestamptz, ${page.cursor.id}::text)`
        : sql``;
      // cursor_v carries microsecond precision (the api-key list's solution): `toISOString()`
      // truncates to milliseconds, and rows written in one transaction share `created_at` —
      // a truncated boundary would exclude the very ties the id tiebreak exists for.
      const rows = (await db.execute<MediaAssetRowRaw & { cursor_v: string }>(sql`
          SELECT ${MEDIA_COLUMNS},
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS cursor_v
          FROM media_assets
          WHERE organization_id = ${organizationId}
            AND is_deleted = false
            AND attached_to_type IS NULL
            ${folderClause}
            ${cursorClause}
          ORDER BY created_at DESC, id DESC
          LIMIT ${page.limit + 1}
        `)) as any;
      const entries = (rows.rows as (MediaAssetRowRaw & { cursor_v: string })[]).map(
        (raw): MediaAssetRecord & { _cursorV: string } => ({
          ...mapRow(raw),
          _cursorV: raw.cursor_v,
        }),
      );
      const result = buildPage(entries, page.limit, (row) => row._cursorV);
      // The precision carrier is internal — projections stay clean.
      return { ...result, items: result.items.map(({ _cursorV: _, ...rest }) => rest) };
    },
  };
}

export type StorageService = ReturnType<typeof createStorageService>;

// ── Process singleton (the email pattern) ─────────────────────────────────────────────────────

import { tryGetConfig } from "../../lib/config";
import { BunS3ClientAdapter } from "./bun-s3";

let _service: StorageService | undefined;

/**
 * The process-wide storage service, built from config on first use — `emailService`'s lazy
 * singleton, re-derived if config is reloaded in tests. The R2 transport is only constructed
 * when the resolved driver is `r2`, so a local-dev process never touches `Bun.s3`.
 */
export function getStorageService(): StorageService {
  if (_service) return _service;
  const config = tryGetConfig();
  if (!config) {
    throw new Error(
      "storage service needs a loaded config — call loadConfig() at boot (the emailService contract)",
    );
  }

  const transports: Partial<Record<StorageDriver, StorageTransport>> = {
    local: new LocalDiskStorageTransport({
      root: config.STORAGE_LOCAL_ROOT,
      baseUrl: config.APP_BASE_URL_RESOLVED,
      signingSecret: config.STORAGE_SIGNING_SECRET ?? config.JWT_ACCESS_SECRET,
    }),
  };
  if (config.STORAGE_DRIVER_RESOLVED === "r2") {
    transports.r2 = new R2StorageTransport(
      new BunS3ClientAdapter({
        accessKeyId: config.R2_ACCESS_KEY_ID!,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
        bucket: config.R2_BUCKET!,
        endpoint: config.R2_ENDPOINT_RESOLVED,
      }),
    );
  }
  _service = createStorageService({ config, transports });
  return _service;
}

/** Test seam — `setStorageServiceForTest(svc)` mirrors `setServerDbForTest`. */
export function setStorageServiceForTest(service: StorageService | undefined): void {
  _service = service;
}
