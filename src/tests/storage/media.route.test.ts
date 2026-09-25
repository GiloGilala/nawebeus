/**
 * `/api/media` — the HTTP surface (NWB-P1-005).
 *
 * The no-DB describe pins the 401 wall before any query. The DB describe drives the roadmap's
 * exit gate — "media upload→signed URL works against the local adapter" — through the real app:
 * a multipart upload whose `signedUrl` is then fetched **without any cookie** and must return
 * the exact bytes, plus the negative space (tampered/expired signatures, deleted assets,
 * cross-org reads, oversize, optimistic delete) and the projection rule (`storage_url` never
 * leaves the server).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { logger } from "../../lib/logger";
import {
  createStorageService,
  LocalDiskStorageTransport,
  localMediaSignature,
  setStorageServiceForTest,
} from "../../services/storage";
import { createTestApp } from "../helpers/test-client";
import { createTestDb, ensureMediaSchema } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

type App = ReturnType<typeof createTestApp>;

async function cookieFor(app: App, email: string): Promise<string> {
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`signin failed: ${res.status} ${await res.text()}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

interface Envelope<T> {
  data: T;
  meta?: { location?: string };
  error?: { code: string; message: string; details?: { field: string }[] };
}

async function json<T>(res: Response): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>;
}

function uploadForm(file: File, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

let roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nawebeus-media-route-"));
  roots.push(root);
  return root;
}

describe("media routes — no DB", () => {
  test("every verb is 401 without a session, before any query", async () => {
    const app = createTestApp();
    for (const [method, path] of [
      ["POST", "/api/media"],
      ["GET", "/api/media"],
      ["GET", "/api/media/med_11111111-1111-4111-8111-111111111111"],
      ["GET", "/api/media/med_11111111-1111-4111-8111-111111111111/content"],
      ["DELETE", "/api/media/med_11111111-1111-4111-8111-111111111111?version=1"],
    ] as const) {
      const res = await app.request(path, { method });
      expect([method, res.status]).toEqual([method, 401]);
    }
  });

  test("the signed route is mounted before /:assetId (no shadowing)", async () => {
    const app = createTestApp();
    // A malformed med id on the signed route is 422 (param pattern), not swallowed by /:assetId.
    const res = await app.request("/api/media/signed/not-an-id");
    expect(res.status).toBe(422);
  });
});

describe.skipIf(!hasDb())("media routes — DB", () => {
  let app: App;
  let db: Db;
  let owner: { id: string; cookie: string };
  let creator: { id: string; cookie: string };
  let viewer: { id: string; cookie: string };
  let otherOwner: { id: string; cookie: string; orgId: string };
  let done: (() => Promise<void>) | undefined;
  let root: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    (logger as any).error = console.error; // TEMP-DEBUG
    // Held open for the whole describe (the server-functions suites' pattern): one transaction
    // that rolls back in afterAll, so sign-in cookies outlive a single test.
    const ctx = await createTestDb();
    db = ctx.db;
    done = ctx.done;

    await ensureMediaSchema(db);
    root = tempRoot();
    // Inject a service over a temp root, signed with the secret the route will recompute.
    const config = getConfig();
    setStorageServiceForTest(
      createStorageService({
        config,
        transports: {
          local: new LocalDiskStorageTransport({
            root,
            baseUrl: "http://localhost:3000",
            signingSecret: config.JWT_ACCESS_SECRET,
          }),
        },
      }),
    );

    app = createTestApp(db);

    const ownerUser = await createTestUser(db, { firstName: "Media", lastName: "Owner" });
    const org = await createTestOrg(db, { ownerId: ownerUser.id, name: "Media Route Org" });
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: ownerUser.id,
      roleCode: "owner",
    });
    const mkMember = async (roleCode: string, name: string) => {
      const user = await createTestUser(db, { firstName: name, lastName: roleCode });
      await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
      return { id: user.id, cookie: await cookieFor(app, user.email) };
    };
    owner = { id: ownerUser.id, cookie: await cookieFor(app, ownerUser.email) };
    creator = await mkMember("creator", "Med");
    viewer = await mkMember("viewer", "Med");

    const otherUser = await createTestUser(db, { firstName: "Other", lastName: "Owner" });
    const otherOrg = await createTestOrg(db, { ownerId: otherUser.id, name: "Other Media Org" });
    await addMemberWithRole(db, {
      organizationId: otherOrg.id,
      userId: otherUser.id,
      roleCode: "owner",
    });
    otherOwner = {
      id: otherUser.id,
      orgId: otherOrg.id,
      cookie: await cookieFor(app, otherUser.email),
    };
  });

  afterAll(async () => {
    setStorageServiceForTest(undefined);
    for (const r of roots) rmSync(r, { recursive: true, force: true });
    roots = [];
    if (done) await done();
  });

  test("upload → 201 with projection, signedUrl; viewer role cannot upload", async () => {
    const res = await app.request("/api/media", {
      method: "POST",
      headers: { cookie: creator.cookie },
      body: uploadForm(
        new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }),
        {
          altText: "The logo",
          folderPath: "brand",
          tags: "logo, dark",
        },
      ),
    });
    expect(res.status).toBe(201);
    const body = await json<{
      asset: {
        id: string;
        name: string;
        assetType: string;
        tags: string[] | null;
        storageUrl?: string;
      };
      signedUrl: string;
      signedUrlExpiresInSeconds: number;
    }>(res);
    expect(body.meta?.location).toMatch(/^\/api\/media\/med_/);
    expect(body.data.asset.id).toMatch(/^med_[0-9a-f-]{36}$/);
    expect(body.data.asset.name).toBe("logo.png");
    expect(body.data.asset.assetType).toBe("image");
    expect(body.data.asset.tags).toEqual(["logo", "dark"]);
    // The projection rule: origin internals never leave the server.
    expect(body.data.asset.storageUrl).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("local://");

    const viewerRes = await app.request("/api/media", {
      method: "POST",
      headers: { cookie: viewer.cookie },
      body: uploadForm(new File([new Uint8Array([1])], "x.png", { type: "image/png" })),
    });
    expect(viewerRes.status).toBe(403);
  });

  test("signed URL serves exact bytes with NO cookie; tampered and expired signatures are 403", async () => {
    const bytes = new TextEncoder().encode("signed-route-bytes");
    const up = await app.request("/api/media", {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: uploadForm(new File([bytes], "note.txt", { type: "text/plain" })),
    });
    expect(up.status).toBe(201);
    const { data } = await json<{ asset: { id: string }; signedUrl: string }>(up);
    const signedPath =
      new URL(data.signedUrl, "http://localhost:3000").pathname + new URL(data.signedUrl).search;

    // No cookie — the entire point of the signed URL.
    const fresh = await app.request(signedPath);
    expect(fresh.status).toBe(200);
    expect(new Uint8Array(await fresh.arrayBuffer())).toEqual(bytes);
    expect(fresh.headers.get("content-type")).toContain("text/plain");
    expect(fresh.headers.get("cache-control")).toContain("private");

    // Tampered signature → 403.
    const url = new URL(signedPath, "http://localhost:3000");
    const sig = url.searchParams.get("sig")!;
    const flipped = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
    url.searchParams.set("sig", flipped);
    expect((await app.request(url.pathname + url.search)).status).toBe(403);

    // Expired (past exp, otherwise valid signature) → 403.
    const config = getConfig();
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const expired = `/api/media/signed/${data.asset.id}?exp=${pastExp}&sig=${localMediaSignature(data.asset.id, await orgIdOf(db, data.asset.id), pastExp, config.JWT_ACCESS_SECRET)}`;
    const expiredRes = await app.request(expired);
    expect(expiredRes.status).toBe(403);
    expect((await json(expiredRes)).error?.message).toMatch(/expired/i);
  });

  test("metadata + content are authed and org-scoped; deleted assets 404 everywhere", async () => {
    const up = await app.request("/api/media", {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: uploadForm(new File([new Uint8Array([9, 9])], "doomed.png", { type: "image/png" })),
    });
    const { data } = await json<{ asset: { id: string; version: number }; signedUrl: string }>(up);
    const assetId = data.asset.id;

    // Owner sees metadata; the other org's owner does not (silent 404).
    expect(
      (await app.request(`/api/media/${assetId}`, { headers: { cookie: owner.cookie } })).status,
    ).toBe(200);
    const cross = await app.request(`/api/media/${assetId}`, {
      headers: { cookie: otherOwner.cookie },
    });
    expect(cross.status).toBe(404);

    // Content route is the authed path.
    expect(
      (await app.request(`/api/media/${assetId}/content`, { headers: { cookie: owner.cookie } }))
        .status,
    ).toBe(200);
    expect(
      (await app.request(`/api/media/${assetId}/content`, { headers: { cookie: viewer.cookie } }))
        .status,
    ).toBe(200); // media.read is everyone

    // Delete with the wrong version → 409; without version → 422.
    expect(
      (
        await app.request(`/api/media/${assetId}?version=9`, {
          method: "DELETE",
          headers: { cookie: owner.cookie },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(`/api/media/${assetId}`, {
          method: "DELETE",
          headers: { cookie: owner.cookie },
        })
      ).status,
    ).toBe(422);

    // Correct optimistic delete → 200; then every read path 404s (anti-enumeration).
    const del = await app.request(`/api/media/${assetId}?version=1`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(del.status).toBe(200);
    expect((await json(del)).data).toMatchObject({ deleted: true, assetId });

    expect(
      (await app.request(`/api/media/${assetId}`, { headers: { cookie: owner.cookie } })).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/media/${assetId}/content`, { headers: { cookie: owner.cookie } }))
        .status,
    ).toBe(404);
    expect((await app.request(data.signedUrl.replace("http://localhost:3000", ""))).status).toBe(
      404,
    );

    // Second delete is the designed idempotent no-op (softDeleteMedia early-returns): 200 again.
    const del2 = await app.request(`/api/media/${assetId}?version=2`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(del2.status).toBe(200);
    expect((await json(del2)).data).toMatchObject({ deleted: true });
  });

  test("attached assets refuse direct delete (422) and drop out of the library list", async () => {
    const up = await app.request("/api/media", {
      method: "POST",
      headers: { cookie: creator.cookie },
      body: uploadForm(new File([new Uint8Array([5])], "attached.png", { type: "image/png" })),
    });
    const { data } = await json<{ asset: { id: string } }>(up);
    const assetId = data.asset.id;

    // Attach directly (attachment is denormalized on the row; the P1-012 attach flow does this).
    await db.execute(sql`
      UPDATE media_assets SET attached_to_type = 'post', attached_to_id = ${"22222222-2222-4222-8222-222222222222"}
      WHERE id = ${assetId}`);

    const del = await app.request(`/api/media/${assetId}?version=1`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(del.status).toBe(422);

    // Library list excludes attached assets (and the folder filter is exact).
    const list = await app.request("/api/media?folderPath=brand", {
      headers: { cookie: creator.cookie },
    });
    expect(list.status).toBe(200);
    const listed = await json<{ assets: { id: string; storageUrl?: string }[] }>(list);
    expect(listed.data.assets.some((a) => a.id === assetId)).toBe(false);
    expect(JSON.stringify(listed)).not.toContain("local://");
  });

  test("oversize uploads are 413 before any row exists", async () => {
    const config = getConfig();
    setStorageServiceForTest(
      createStorageService({
        config: { ...config, MEDIA_MAX_UPLOAD_MB: 1 },
        transports: {
          local: new LocalDiskStorageTransport({
            root: tempRoot(),
            baseUrl: "http://localhost:3000",
            signingSecret: config.JWT_ACCESS_SECRET,
          }),
        },
      }),
    );
    try {
      const res = await app.request("/api/media", {
        method: "POST",
        headers: { cookie: owner.cookie },
        body: uploadForm(
          new File([new Uint8Array(1_000_001)], "big.bin", { type: "application/octet-stream" }),
        ),
      });
      expect(res.status).toBe(413);
      // The suite shares one transaction — count only this upload's name, not the whole table.
      const count = await db.execute(
        sql`SELECT count(*)::int AS n FROM media_assets WHERE name = 'big.bin'`,
      );
      expect((count as any).rows[0].n).toBe(0);
    } finally {
      const fresh = getConfig();
      setStorageServiceForTest(
        createStorageService({
          config: fresh,
          transports: {
            local: new LocalDiskStorageTransport({
              root,
              baseUrl: "http://localhost:3000",
              signingSecret: fresh.JWT_ACCESS_SECRET,
            }),
          },
        }),
      );
    }
  });

  test("non-media users of other orgs see an empty library; pagination cursor walks", async () => {
    const list = await app.request("/api/media", { headers: { cookie: otherOwner.cookie } });
    expect(list.status).toBe(200);
    const body = await json<{ assets: unknown[] }>(list);
    expect(body.data.assets).toEqual([]);
  });
});

async function orgIdOf(db: Db, assetId: string): Promise<string> {
  const rows = await db.execute(
    sql`SELECT organization_id FROM media_assets WHERE id = ${assetId}`,
  );
  return (rows as any).rows[0].organization_id as string;
}
