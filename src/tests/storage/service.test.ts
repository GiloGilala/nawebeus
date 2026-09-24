/**
 * Storage service tests (NWB-P1-005) — the DB half of the media core.
 *
 * Covers:
 * - uploadMedia: row shape (storage_url scheme, public projection inputs), audit trail without
 *   bytes, oversize refusal (413 semantics via PayloadTooLargeError)
 * - Tenancy: every read/write scoped by organization_id (cross-org is a silent 404)
 * - signedDownloadUrl: driver dispatch on storage_url, GoneError after soft delete, expiry clamp
 * - softDeleteMedia: optimistic version, idempotency, attached-asset refusal, audit before/after
 * - listLibraryAssets: keyset pagination, folder filter, attached + deleted exclusion
 * - readContent: exact bytes + owning org
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { ConflictError, GoneError, NotFoundError, PayloadTooLargeError } from "../../lib/errors";
import { type CursorPayload, decodeCursor } from "../../lib/pagination";
import { LocalDiskStorageTransport } from "../../services/storage/local";
import { createStorageService } from "../../services/storage/service";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

const SECRET = "storage-service-test-secret-0123456789abcdef";

interface Workspace {
  orgId: string;
  ownerId: string;
  otherOrgId: string;
  otherUserId: string;
}

async function setupWorkspace(db: Db): Promise<Workspace> {
  const owner = await createTestUser(db, { firstName: "Media", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: owner.id, name: "Media Test Org" });
  const otherOwner = await createTestUser(db, { firstName: "Other", lastName: "Owner" });
  const otherOrg = await createTestOrg(db, { ownerId: otherOwner.id, name: "Other Media Org" });
  return { orgId: org.id, ownerId: owner.id, otherOrgId: otherOrg.id, otherUserId: otherOwner.id };
}

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nawebeus-media-svc-"));
  roots.push(root);
  return root;
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function testService(_db: Db, overrides?: { maxUploadMb?: number }) {
  const config = {
    ...getConfig(),
    MEDIA_MAX_UPLOAD_MB: overrides?.maxUploadMb ?? 25,
  } as ReturnType<typeof getConfig>;
  return createStorageService({
    config,
    transports: {
      local: new LocalDiskStorageTransport({
        root: tempRoot(),
        baseUrl: "http://localhost:3000",
        signingSecret: SECRET,
      }),
    },
  });
}

describe.skipIf(!hasDb())("Storage service — upload", () => {
  test("uploads an asset: row shape, storage_url scheme, signed URL, audit trail", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);

      const data = new TextEncoder().encode("png-bytes-not-really");
      const { asset, signedUrl, signedUrlExpiresInSeconds } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "../../team photo.PNG",
        mimeType: "image/png",
        data,
        folderPath: "campaigns/launch",
        tags: ["logo", "dark"],
        altText: "The dark logo",
      });

      expect(asset.id).toMatch(/^med_[0-9a-f-]{36}$/);
      expect(asset.name).toBe("team photo.PNG"); // sanitized, traversal gone
      expect(asset.assetType).toBe("image");
      expect(asset.sizeBytes).toBe(data.byteLength);
      expect(asset.mimeType).toBe("image/png");
      expect(asset.folderPath).toBe("campaigns/launch");
      expect(asset.storageUrl).toMatch(/^local:\/\//); // `<driver>://<key>` — internal URI
      expect(asset.storageUrl).not.toContain("..");
      expect(asset.isDeleted).toBe(false);
      expect(asset.version).toBe(1);

      expect(signedUrl).toContain(`/api/media/signed/${asset.id}`);
      expect(signedUrlExpiresInSeconds).toBe(900);

      // The stored row keeps origin only; public projections strip storage_url/cdn_url.
      const rawRow = await db.execute(sql`SELECT storage_url, cdn_url, processing_state, uploaded_by
        FROM media_assets WHERE id = ${asset.id}`);
      const row = (rawRow as any).rows[0];
      expect(row.storage_url).toBe(asset.storageUrl);
      expect(row.cdn_url).toBeNull(); // CDN is out of scope for P1-005
      expect(row.processing_state).toBeNull(); // NULL = complete per schema header
      expect(row.uploaded_by).toBe(ws.ownerId);

      // Audit exists and carries no bytes.
      const audit = await db.execute(sql`SELECT action, before_state, after_state, resource_type
        FROM unified_audit_log WHERE resource_id = ${asset.id} AND action = 'media.uploaded'`);
      const after = (audit as any).rows[0]?.after_state ?? {};
      expect(after).toEqual({
        name: "team photo.PNG",
        assetType: "image",
        sizeBytes: data.byteLength,
        mimeType: "image/png",
        storageDriver: "local",
        folderPath: "campaigns/launch",
      });
      expect((audit as any).rows[0].before_state).toBeNull();
    });
  });

  test("rejects oversize uploads with PayloadTooLargeError before any row exists", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db, { maxUploadMb: 1 });

      const big = new Uint8Array(1_000_001); // 1 MB cap is 1_000_000 bytes
      await expect(
        service.uploadMedia(db, {
          organizationId: ws.orgId,
          uploadedBy: ws.ownerId,
          name: "big.bin",
          mimeType: "application/octet-stream",
          data: big,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeError);

      const count = await db.execute(sql`SELECT count(*)::int AS n FROM media_assets`);
      expect((count as any).rows[0].n).toBe(0);
    });
  });
});

describe.skipIf(!hasDb())("Storage service — reads & tenancy", () => {
  test("getMedia scopes by organization; cross-org reads are silent 404s", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "shared.png",
        mimeType: "image/png",
        data: new Uint8Array([1, 2, 3]),
      });

      expect((await service.getMedia(db, ws.orgId, asset.id))?.name).toBe("shared.png");
      await expect(service.getMedia(db, ws.otherOrgId, asset.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );

      // assetOrg is the route helper for ownership checks on signed URLs.
      const org = await service.assetOrg(db, asset.id);
      expect(org).toEqual({ organizationId: ws.orgId, isDeleted: false });
      expect(
        await service.assetOrg(db, "med_00000000-0000-4000-8000-000000000000"),
      ).toBeUndefined();
    });
  });

  test("readContent returns exact bytes and owning org", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const bytes = new TextEncoder().encode("content-round-trip");
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "round.txt",
        mimeType: "text/plain",
        data: bytes,
      });

      const content = await service.readContent(db, asset.id);
      expect(content?.data).toEqual(bytes);
      expect(content?.mimeType).toBe("text/plain");
      expect(content?.organizationId).toBe(ws.orgId);
      expect(
        await service.readContent(db, "med_00000000-0000-4000-8000-000000000000"),
      ).toBeUndefined();
    });
  });

  test("signedDownloadUrl dispatches on the row's storage_url scheme and clamps expiry", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "clamped.png",
        mimeType: "image/png",
        data: new Uint8Array([7]),
      });

      const url = await service.signedDownloadUrl(db, ws.orgId, asset.id, 99_999);
      expect(url).toContain(`/api/media/signed/${asset.id}`);
      const exp = Number(new URL(url).searchParams.get("exp"));
      const now = Math.floor(Date.now() / 1000);
      expect(exp).toBeGreaterThanOrEqual(now + 3_595); // clamped to SIGNED_URL_MAX_SECONDS
      expect(exp).toBeLessThanOrEqual(now + 3_600);
    });
  });
});

describe.skipIf(!hasDb())("Storage service — soft delete", () => {
  test("soft delete bumps version, writes audit before/after, then reads turn 410/404", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "doomed.png",
        mimeType: "image/png",
        data: new Uint8Array([1]),
      });

      await service.softDeleteMedia(
        db,
        ws.orgId,
        asset.id,
        { actorId: ws.ownerId, actorType: "user" },
        1,
      );

      const row = await db.execute(
        sql`SELECT version, is_deleted, deleted_at FROM media_assets WHERE id = ${asset.id}`,
      );
      expect((row as any).rows[0].version).toBe(2);
      expect((row as any).rows[0].is_deleted).toBe(true);
      expect((row as any).rows[0].deleted_at).not.toBeNull();

      // Audit row with before/after states.
      const audit = await db.execute(sql`SELECT before_state, after_state FROM unified_audit_log
        WHERE resource_id = ${asset.id} AND action = 'media.deleted'`);
      const beforeState = (audit as any).rows[0]?.before_state ?? {};
      expect(beforeState.version).toBe(1);
      expect(beforeState.name).toBe("doomed.png");

      await expect(service.signedDownloadUrl(db, ws.orgId, asset.id)).rejects.toBeInstanceOf(
        GoneError,
      );
      expect((await service.assetOrg(db, asset.id))?.isDeleted).toBe(true);
    });
  });

  test("soft delete is idempotent when already deleted", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "twice.png",
        mimeType: "image/png",
        data: new Uint8Array([1]),
      });
      await service.softDeleteMedia(
        db,
        ws.orgId,
        asset.id,
        { actorId: ws.ownerId, actorType: "user" },
        1,
      );
      // Second click — even with a stale expectedVersion — is a no-op, not an event.
      await service.softDeleteMedia(
        db,
        ws.orgId,
        asset.id,
        { actorId: ws.ownerId, actorType: "user" },
        1,
      );
      const row = await db.execute(sql`SELECT version FROM media_assets WHERE id = ${asset.id}`);
      expect((row as any).rows[0].version).toBe(2);
    });
  });

  test("wrong expected version is a ConflictError; cross-org delete is a NotFoundError", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "locked.png",
        mimeType: "image/png",
        data: new Uint8Array([1]),
      });
      await expect(
        service.softDeleteMedia(
          db,
          ws.orgId,
          asset.id,
          { actorId: ws.ownerId, actorType: "user" },
          7,
        ),
      ).rejects.toBeInstanceOf(ConflictError);
      await expect(
        service.softDeleteMedia(
          db,
          ws.otherOrgId,
          asset.id,
          { actorId: ws.otherUserId, actorType: "user" },
          1,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("assets attached to library content cannot be soft-deleted (ValidationError)", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);
      const { asset } = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "attached.png",
        mimeType: "image/png",
        data: new Uint8Array([1]),
      });

      // Attach it to a post directly — attachment is denormalized onto the asset row
      // (attached_to_type/attached_to_id), polymorphic, with no join table.
      await db.execute(sql`
        UPDATE media_assets SET attached_to_type = 'post', attached_to_id = ${"11111111-1111-4111-8111-111111111111"}
        WHERE id = ${asset.id}`);

      await expect(
        service.softDeleteMedia(
          db,
          ws.orgId,
          asset.id,
          { actorId: ws.ownerId, actorType: "user" },
          1,
        ),
      ).rejects.toBeInstanceOf(Error); // ValidationError — attachment consistency rule
      // And the row is untouched.
      expect((await service.assetOrg(db, asset.id))?.isDeleted).toBe(false);
    });
  });
});

describe.skipIf(!hasDb())("Storage service — library listing", () => {
  test("lists newest-first with keyset pagination, folder filter, and exclusions", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const service = testService(db);

      await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "a.png",
        mimeType: "image/png",
        data: new Uint8Array([1]),
        folderPath: "root",
      });
      const b = await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "b.png",
        mimeType: "image/png",
        data: new Uint8Array([2]),
        folderPath: "root/child",
      });
      await service.uploadMedia(db, {
        organizationId: ws.orgId,
        uploadedBy: ws.ownerId,
        name: "c.png",
        mimeType: "image/png",
        data: new Uint8Array([3]),
        folderPath: "root/child",
      });

      // Delete one — excluded from listing.
      await service.softDeleteMedia(
        db,
        ws.orgId,
        b.asset.id,
        { actorId: ws.ownerId, actorType: "user" },
        1,
      );

      const page1 = await service.listLibraryAssets(db, ws.orgId, { limit: 1, cursor: null });
      expect(page1.items).toHaveLength(1);
      expect(page1.pageInfo.hasMore).toBe(true);
      expect(page1.pageInfo.cursor).toBeTypeOf("string");

      // Resume from the opaque cursor — the walk covers both, no repeats, then exhausts.
      const decode = { idPattern: /^med_[0-9a-f-]{36}$/i };
      const cursor1: CursorPayload | null = decodeCursor(page1.pageInfo.cursor!, decode);
      expect(cursor1).not.toBeNull();
      const page2 = await service.listLibraryAssets(db, ws.orgId, { limit: 1, cursor: cursor1 });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
      // List exhausted: no cursor once there is nothing left — the walk stops here.
      expect(page2.pageInfo.hasMore).toBe(false);
      expect(page2.pageInfo.cursor).toBeNull();

      // Two survivors with a generous limit: no phantom hasMore.
      const all = await service.listLibraryAssets(db, ws.orgId, { limit: 10, cursor: null });
      expect([...all.items.map((x) => x.name)].sort()).toEqual(["a.png", "c.png"]);
      expect(all.pageInfo.hasMore).toBe(false);

      // Folder filter is an exact folder_path match.
      const childOnly = await service.listLibraryAssets(
        db,
        ws.orgId,
        { limit: 10, cursor: null },
        { folderPath: "root/child" },
      );
      expect(childOnly.items.map((x) => x.name)).toEqual(["c.png"]);

      // Other org sees nothing of this library.
      const other = await service.listLibraryAssets(db, ws.otherOrgId, { limit: 10, cursor: null });
      expect(other.items).toEqual([]);
    });
  });
});
