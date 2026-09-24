/**
 * Media routes (NWB-P1-005) — `/api/media`.
 *
 * One deliberately public route and one rule that keeps it safe: `GET /media/signed/:assetId`
 * authenticates with the HMAC a signed URL carries, not with a session — that is the entire
 * point of a signed URL (an `<img src>` carries no cookies). It is registered **before** the
 * `/:assetId` routes because Hono resolves in registration order (the F-11 lesson, one level
 * down and pinned by test); everything else is session/API-key auth + the `media` subject's
 * abilities (`media.read` everyone, `media.create` content creators, `media.delete` the
 * approval tier).
 *
 * Metadata responses never include `storage_url` — the schema header's "origin URL is internal,
 * never exposed" rule, enforced by mapping every read through a projection that omits it.
 */
import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { patternParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  getStorageService,
  localMediaSignature,
  MEDIA_ASSET_ID_PATTERN,
  type StorageService,
} from "@/services/storage";

export const mediaRouter = new Hono();

function storage(): StorageService {
  return getStorageService();
}

/** The client-facing projection of an asset — `storage_url`/`cdn_url` internals stay out. */
function publicAsset(asset: {
  id: string;
  organizationId: string;
  attachedToType: string | null;
  attachedToId: string | null;
  name: string;
  assetType: string;
  sizeBytes: number;
  mimeType: string;
  folderPath: string | null;
  tags: string[] | null;
  altText: string | null;
  isDeleted: boolean;
  version: number;
  uploadedBy: string;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    organizationId: asset.organizationId,
    attachedToType: asset.attachedToType,
    attachedToId: asset.attachedToId,
    name: asset.name,
    assetType: asset.assetType,
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    folderPath: asset.folderPath,
    tags: asset.tags,
    altText: asset.altText,
    isDeleted: asset.isDeleted,
    version: asset.version,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt.toISOString(),
  };
}

function assetIdParam(c: Context): string {
  return patternParam(c, "assetId", MEDIA_ASSET_ID_PATTERN, "media asset id");
}

// ── The signed route FIRST (registration-order shadowing; see the file header) ────────────────

mediaRouter.get("/media/signed/:assetId", async (c) => {
  const assetId = assetIdParam(c);
  const expRaw = c.req.query("exp");
  const sig = c.req.query("sig");
  const exp = expRaw !== undefined && /^\d{1,12}$/.test(expRaw) ? Number(expRaw) : NaN;
  if (!Number.isFinite(exp) || typeof sig !== "string" || sig.length === 0) {
    throw new ValidationError("Invalid signed media URL", [
      { field: "sig", message: "Missing or malformed signature" },
    ]);
  }
  if (exp * 1000 < Date.now()) {
    throw new ForbiddenError("Signed media URL has expired");
  }

  const db = c.var.db;
  const meta = await storage().assetOrg(db, assetId);
  // No asset, or a deleted one: the same 404 either way — the signature may be valid, the
  // answer must not become an existence oracle.
  if (!meta || meta.isDeleted) throw new NotFoundError("Media asset not found");

  const config = getConfig();
  const expected = localMediaSignature(
    assetId,
    meta.organizationId,
    exp,
    config.STORAGE_SIGNING_SECRET ?? config.JWT_ACCESS_SECRET,
  );
  const presented = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (presented.length !== expectedBuf.length || !timingSafeEqual(presented, expectedBuf)) {
    throw new ForbiddenError("Invalid signed media URL signature");
  }

  const content = await storage().readContent(db, assetId);
  if (!content) throw new NotFoundError("Media asset not found");
  return c.body(content.data as unknown as ArrayBuffer, 200, {
    "Content-Type": content.mimeType,
    "Content-Length": String(content.data.byteLength),
    "Cache-Control": "private, max-age=300",
  });
});

// ── Authenticated surface ─────────────────────────────────────────────────────────────────────

// POST /api/media — upload one asset (multipart: `file` plus optional name/altText/folderPath/tags).
mediaRouter.post("/media", authMiddleware, requireAbility("create", "media"), async (c) => {
  const { orgId, userId } = c.var.user;
  const db = c.var.db;

  let form: Record<string, string | File | (string | File)[]>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw new ValidationError("Expected a multipart/form-data upload", [
      { field: "file", message: "A file part is required" },
    ]);
  }

  const part = form.file;
  const file = Array.isArray(part) ? part[0] : part;
  if (!(file instanceof File)) {
    throw new ValidationError("Expected a multipart/form-data upload", [
      { field: "file", message: "A file part is required" },
    ]);
  }

  const asString = (v: string | File | (string | File)[] | undefined): string | undefined => {
    const one = Array.isArray(v) ? v[0] : v;
    return typeof one === "string" ? one : undefined;
  };
  const name = asString(form.name) ?? file.name;
  const altText = asString(form.altText);
  const folderPath = asString(form.folderPath);
  const tagsField = form.tags;
  const tagsRaw = Array.isArray(tagsField) ? tagsField[0] : tagsField;
  const tags =
    typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await storage().uploadMedia(db, {
    organizationId: orgId,
    uploadedBy: userId,
    name: name || file.name,
    mimeType: file.type || "application/octet-stream",
    data: bytes,
    ...(folderPath ? { folderPath } : {}),
    ...(altText ? { altText } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
  });

  return c.json(
    success(
      {
        asset: publicAsset(result.asset),
        signedUrl: result.signedUrl,
        signedUrlExpiresInSeconds: result.signedUrlExpiresInSeconds,
      },
      { location: `/api/media/${result.asset.id}` },
    ),
    201,
  );
});

// GET /api/media — the library list (soft-deleted and attached assets excluded at the source).
mediaRouter.get("/media", authMiddleware, requireAbility("read", "media"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const url = new URL(c.req.url);
  const page = parsePagination(url, { idPattern: MEDIA_ASSET_ID_PATTERN });
  const folderPath = url.searchParams.get("folderPath") ?? undefined;
  const { items, pageInfo } = await storage().listLibraryAssets(db, orgId, page, {
    ...(folderPath ? { folderPath } : {}),
  });
  return c.json(success({ assets: items.map(publicAsset) }, paginationMeta(pageInfo)));
});

// GET /api/media/:assetId — metadata.
mediaRouter.get("/media/:assetId", authMiddleware, requireAbility("read", "media"), async (c) => {
  const { orgId } = c.var.user;
  const assetId = assetIdParam(c);
  const asset = await storage().getMedia(c.var.db, orgId, assetId);
  if (asset.isDeleted) throw new NotFoundError("Media asset not found");
  return c.json(success({ asset: publicAsset(asset) }));
});

// GET /api/media/:assetId/content — the bytes, authed (the signed route is the no-cookie path).
mediaRouter.get(
  "/media/:assetId/content",
  authMiddleware,
  requireAbility("read", "media"),
  async (c) => {
    const { orgId } = c.var.user;
    const assetId = assetIdParam(c);
    const asset = await storage().getMedia(c.var.db, orgId, assetId);
    if (asset.isDeleted) throw new NotFoundError("Media asset not found");
    const content = await storage().readContent(c.var.db, assetId);
    if (!content || content.organizationId !== orgId) {
      throw new NotFoundError("Media asset not found");
    }
    return c.body(content.data as unknown as ArrayBuffer, 200, {
      "Content-Type": content.mimeType,
      "Content-Length": String(content.data.byteLength),
      "Cache-Control": "private, max-age=60",
    });
  },
);

// DELETE /api/media/:assetId — soft delete, library assets only, optimistic on `version`.
mediaRouter.delete(
  "/media/:assetId",
  authMiddleware,
  requireAbility("delete", "media"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const authMethod = c.var.authMethod;
    const assetId = assetIdParam(c);
    const versionRaw = c.req.query("version");
    const version = versionRaw !== undefined && /^\d+$/.test(versionRaw) ? Number(versionRaw) : NaN;
    if (!Number.isInteger(version) || version < 1) {
      throw new ValidationError("Invalid version parameter", [
        { field: "version", message: "Must be the asset's current version" },
      ]);
    }
    await storage().softDeleteMedia(
      c.var.db,
      orgId,
      assetId,
      { actorId: userId, actorType: authMethod === "api_key" ? "api_key" : "user" },
      version,
    );
    return c.json(success({ deleted: true, assetId }));
  },
);
