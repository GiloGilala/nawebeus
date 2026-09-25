/**
 * Local-disk storage transport (NWB-P1-005) — dev, tests, and a single-box deployment that
 * chose it on purpose (`STORAGE_DRIVER=local`; production refuses it by omission).
 *
 * Keys map to files under `root` with the same relative path — `{orgId}/{assetId}/{name}` — so
 * an operator can inspect an upload with plain `ls`. Two rules keep that mapping safe:
 *
 * - **Keys are rejected unless the resolved path stays inside the root.** A key is built from a
 *   filename a *client* uploaded ("../../etc/passwd" is a legal filename to claim), so the
 *   check is on the resolved path, not on a substring scan — `contains("..")` is how the bug
 *   survives a review.
 * - **Directories are created per write** (`mkdir -p` semantics); a missing root is not an
 *   error state to configure away.
 *
 * `signedUrl` returns an **app URL** (`{base}/api/media/signed/{assetId}?exp=…&sig=…`) whose
 * HMAC the media route verifies with a timing-safe compare — a `file://` path would be both
 * unusable from a browser and an absolute-path disclosure. The bytes still leave this process;
 * that is what the local driver is for, and R2 replaces the mechanism (not the property) with a
 * real presigned URL when it is configured.
 */
import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type {
  SignedUrlOptions,
  StorageGetResult,
  StorageKey,
  StoragePutOptions,
  StoragePutResult,
  StorageTransport,
} from "./types";

export interface LocalDiskStorageOptions {
  /** Directory files are written under. Created on demand. */
  readonly root: string;
  /**
   * Absolute base for signed URLs — the app's own origin, the same `APP_BASE_URL_RESOLVED`
   * emailed links use (one server-decided base, NWB-P0-021).
   */
  readonly baseUrl: string;
  /** HMAC key for the signature. `getConfig().STORAGE_SIGNING_SECRET ?? JWT_ACCESS_SECRET`. */
  readonly signingSecret: string;
}

/** Reject path traversal on the *resolved* path — a `..` substring check is decoration. */
function safePath(root: string, key: string): string {
  const absoluteRoot = resolve(root) + sep;
  const path = resolve(root, key);
  if (!path.startsWith(absoluteRoot)) {
    throw new Error(`storage key escapes the local root: ${JSON.stringify(key)}`);
  }
  return path;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * The signature a signed media URL must present, and the one the route recomputes — exported so
 * the adapter and the route cannot drift into two formulas (the chain-checksum lesson).
 */
export function localMediaSignature(
  assetId: string,
  organizationId: string,
  exp: number,
  secret: string,
): string {
  return sign(`${assetId}.${organizationId}.${exp}`, secret);
}

export class LocalDiskStorageTransport implements StorageTransport {
  readonly name = "local" as const;

  constructor(private readonly options: LocalDiskStorageOptions) {}

  async put(
    key: StorageKey,
    data: Uint8Array,
    putOptions?: StoragePutOptions,
  ): Promise<StoragePutResult> {
    void putOptions;
    const path = safePath(this.options.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { key, sizeBytes: data.byteLength };
  }

  async get(key: StorageKey): Promise<StorageGetResult | undefined> {
    const path = safePath(this.options.root, key);
    try {
      const data = await readFile(path);
      return { data: new Uint8Array(data), contentType: undefined };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async delete(key: StorageKey): Promise<void> {
    // Idempotent on purpose: the soft-delete flow may re-run, and the row is the record — a
    // vanished file is not a second event.
    await rm(safePath(this.options.root, key), { force: true });
  }

  async exists(key: StorageKey): Promise<boolean> {
    try {
      await stat(safePath(this.options.root, key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: StorageKey, options: SignedUrlOptions): Promise<string> {
    // The local transport signs the *asset*, and the route re-derives org + key from the row —
    // so the key appears only in the HMAC payload, never in the URL (a path on disk is exactly
    // what a signed URL must not disclose).
    const [orgId, assetId] = key.split("/");
    if (!orgId || !assetId) {
      throw new Error(
        `local signed URLs need a {orgId}/{assetId}/… key, got ${JSON.stringify(key)}`,
      );
    }
    const exp = Math.floor(Date.now() / 1000) + options.expiresInSeconds;
    const signature = localMediaSignature(assetId, orgId, exp, this.options.signingSecret);
    return `${this.options.baseUrl}/api/media/signed/${assetId}?exp=${exp}&sig=${signature}`;
  }
}
