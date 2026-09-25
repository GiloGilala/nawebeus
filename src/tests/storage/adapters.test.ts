/**
 * Storage adapters (NWB-P1-005) — pure unit tests, no database.
 *
 * The local adapter owns a filesystem edge (temporary directory per run); the R2 adapter owns a
 * network edge it never touches here (recording fake, the Resend-transport precedent). What
 * these pin that the service tests cannot: path-traversal rejection, the signature formula the
 * route recomputes, and the exact calls forwarded to an S3 client.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskStorageTransport, localMediaSignature } from "../../services/storage/local";
import { R2StorageTransport } from "../../services/storage/r2";
import { assetTypeForMime, sanitizeFileName, storageKeyFor } from "../../services/storage/service";
import type { S3ClientLike } from "../../services/storage/types";
import { parseStorageUrl, storageUrlFor } from "../../services/storage/types";

const SECRET = "storage-test-signing-secret-0123456789";

describe("LocalDiskStorageTransport", () => {
  let root: string;
  let transport: LocalDiskStorageTransport;

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("put writes the file under the root; get reads the exact bytes back", async () => {
    root = mkdtempSync(join(tmpdir(), "nawebeus-media-"));
    transport = new LocalDiskStorageTransport({
      root,
      baseUrl: "http://localhost:3000",
      signingSecret: SECRET,
    });

    const data = new TextEncoder().encode("pixel-bytes-0123456789");
    const put = await transport.put("org-1/med_a/banner.png", data, { contentType: "image/png" });
    expect(put).toEqual({ key: "org-1/med_a/banner.png", sizeBytes: data.byteLength });
    // The relative layout is the operator promise: plain `ls` finds the upload.
    expect(statSync(join(root, "org-1", "med_a", "banner.png")).isFile()).toBe(true);

    const got = await transport.get("org-1/med_a/banner.png");
    expect(got).toBeDefined();
    expect(new TextDecoder().decode(got!.data)).toBe("pixel-bytes-0123456789");
  });

  test("get of a missing key is undefined (callers decide 404 vs 410)", async () => {
    expect(await transport.get("org-1/med_nope/none.png")).toBeUndefined();
  });

  test("delete removes the file and is idempotent", async () => {
    await transport.delete("org-1/med_a/banner.png");
    expect(await transport.get("org-1/med_a/banner.png")).toBeUndefined();
    await transport.delete("org-1/med_a/banner.png"); // no throw
  });

  test("a key that escapes the root is rejected on the resolved path, not by substring", async () => {
    // Traversal via absolute path — no ".." anywhere in the key.
    await expect(transport.put("/etc/hostname", new Uint8Array([1]))).rejects.toThrow(
      /escapes the local root/,
    );
    await expect(transport.get("../outside.bin")).rejects.toThrow(/escapes the local root/);
    // And the classic: a client-supplied filename with dot-dot inside.
    await expect(
      transport.put("org-1/med_a/../../../escape.png", new Uint8Array([1])),
    ).rejects.toThrow(/escapes the local root/);
  });

  test("signedUrl is an app URL carrying exp + HMAC; the formula is the route's formula", async () => {
    const url = await transport.signedUrl("org-1/med_a/pic.png", { expiresInSeconds: 60 });
    expect(url).toMatch(
      /^http:\/\/localhost:3000\/api\/media\/signed\/med_a\?exp=\d+&sig=[0-9a-f]{64}$/,
    );

    // The route recomputes `localMediaSignature(assetId, orgId, exp, secret)` — pin the formula
    // here so the two halves cannot drift.
    const exp = Math.floor(Date.now() / 1000) + 60;
    const url2 = await transport.signedUrl("org-1/med_a/pic.png", { expiresInSeconds: 60 });
    const sigInUrl = new URL(url2).searchParams.get("sig")!;
    const expected = createHmac("sha256", SECRET)
      .update(`med_a.org-1.${exp}`, "utf8")
      .digest("hex");
    expect(sigInUrl).toBe(expected);
    expect(localMediaSignature("med_a", "org-1", exp, SECRET)).toBe(expected);
  });
});

describe("R2StorageTransport (recording S3 fake)", () => {
  function fakeClient() {
    const calls: { method: string; key: string; options?: unknown }[] = [];
    const objects = new Map<string, Uint8Array>();
    const client: S3ClientLike = {
      async putObject(key, data) {
        calls.push({ method: "putObject", key });
        objects.set(key, data);
        return data.byteLength;
      },
      async getObject(key) {
        calls.push({ method: "getObject", key });
        const data = objects.get(key);
        if (!data) {
          const error = new Error("NoSuchKey") as Error & { code?: string };
          error.code = "NoSuchKey";
          throw error;
        }
        return new Blob([data as unknown as BlobPart], { type: "image/png" });
      },
      async deleteObject(key) {
        calls.push({ method: "deleteObject", key });
        objects.delete(key);
      },
      async presign(key, options) {
        calls.push({ method: "presign", key, options });
        return `https://acct.r2.cloudflarestorage.com/bucket/${key}?X-Amz-Expires=${options?.expiresIn ?? 900}&X-Amz-Method=${options?.method ?? "GET"}`;
      },
    };
    return { client, calls, objects };
  }

  test("put/get/delete forward to the client; get maps NoSuchKey to undefined", async () => {
    const { client, calls } = fakeClient();
    const r2 = new R2StorageTransport(client);

    const put = await r2.put("org-1/med_a/video.mp4", new Uint8Array([9, 9, 9]), {
      contentType: "video/mp4",
    });
    expect(put).toEqual({ key: "org-1/med_a/video.mp4", sizeBytes: 3 });

    const got = await r2.get("org-1/med_a/video.mp4");
    expect(got?.data).toEqual(new Uint8Array([9, 9, 9]));
    expect(got?.contentType).toBe("image/png");

    expect(await r2.get("org-1/med_nope/x.mp4")).toBeUndefined();

    await r2.delete("org-1/med_a/video.mp4");
    expect(await r2.get("org-1/med_a/video.mp4")).toBeUndefined();

    expect(calls.map((c) => c.method)).toEqual([
      "putObject",
      "getObject",
      "getObject",
      "deleteObject",
      "getObject",
    ]);
  });

  test("signedUrl is a real presigned URL with the requested expiry and method", async () => {
    const { client, calls } = fakeClient();
    const r2 = new R2StorageTransport(client);
    const url = await r2.signedUrl("org-1/med_a/pic.png", { expiresInSeconds: 120 });
    expect(url).toContain("X-Amz-Expires=120");
    expect(url).toContain("X-Amz-Method=GET");
    expect(calls.at(-1)).toMatchObject({ method: "presign", key: "org-1/med_a/pic.png" });
  });
});

describe("key and name shaping (pure)", () => {
  test("storageKeyFor keeps the {org}/{asset}/{name} layout with a single-segment name", () => {
    expect(storageKeyFor("org-1", "med_a", "team photo.png")).toBe("org-1/med_a/team photo.png");
    expect(storageKeyFor("org-1", "med_a", "../../etc/passwd")).toBe("org-1/med_a/passwd");
  });

  test("sanitizeFileName strips separators, control characters, and dotfile prefixes", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..hidden.png")).toBe("hidden.png");
    expect(sanitizeFileName('bad<>:"|?*.png')).toBe("bad.png");
    expect(sanitizeFileName("")).toBe("upload");
    const withControl = `bad${String.fromCodePoint(7)}name.png`;
    expect(sanitizeFileName(withControl)).toBe("badname.png");
  });

  test("assetTypeForMime covers the enum's six values", () => {
    expect(assetTypeForMime("image/png")).toBe("image");
    expect(assetTypeForMime("image/gif")).toBe("gif");
    expect(assetTypeForMime("video/mp4")).toBe("video");
    expect(assetTypeForMime("audio/mpeg")).toBe("audio");
    expect(assetTypeForMime("application/pdf")).toBe("document");
    expect(assetTypeForMime("application/x-weird")).toBe("other");
  });

  test("storageUrlFor / parseStorageUrl round-trip, and foreign URLs do not parse", () => {
    expect(storageUrlFor("local", "org/med_a/x")).toBe("local://org/med_a/x");
    expect(parseStorageUrl("r2://org/med_a/x")).toEqual({ driver: "r2", key: "org/med_a/x" });
    expect(parseStorageUrl("https://cdn.example.com/x")).toBeUndefined();
    expect(parseStorageUrl("gopher://org/x")).toBeUndefined();
  });
});
