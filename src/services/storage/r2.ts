/**
 * Cloudflare R2 storage transport (NWB-P1-005, D6) — production.
 *
 * R2 speaks the S3 API, and Bun ships an S3 client (`Bun.s3`), so the production adapter costs
 * the codebase **zero new dependencies** — the headline argument in the D6 memo. The client is
 * injected through the minimal `S3ClientLike` structural interface (built from config at the
 * composition root), so this file never imports `Bun` and the tests drive a recording fake the
 * way the Resend transport's tests drive a fake `fetch`.
 *
 * `signedUrl` is a **real presigned URL**: the browser fetches bytes from the origin directly
 * and this process is out of the loop — the property the local adapter approximates with its
 * HMAC'd app URL. `storageUrl` records `r2://{key}`, an internal identifier rather than an
 * origin URL, per the schema comment's "never exposed to clients" rule (and so an origin move
 * or bucket rename does not rewrite every row).
 */
import type {
  S3ClientLike,
  SignedUrlOptions,
  StorageGetResult,
  StorageKey,
  StoragePutOptions,
  StoragePutResult,
  StorageTransport,
} from "./types";

export class R2StorageTransport implements StorageTransport {
  readonly name = "r2" as const;

  constructor(private readonly client: S3ClientLike) {}

  async put(
    key: StorageKey,
    data: Uint8Array,
    _options?: StoragePutOptions,
  ): Promise<StoragePutResult> {
    void _options;
    const sizeBytes = await this.client.putObject(key, data);
    return { key, sizeBytes };
  }

  async get(key: StorageKey): Promise<StorageGetResult | undefined> {
    try {
      const blob = await this.client.getObject(key);
      return {
        data: new Uint8Array(await blob.arrayBuffer()),
        contentType: blob.type || undefined,
      };
    } catch (error) {
      // Bun's S3 client signals a missing object with a NotFound error carrying code
      // "NoSuchKey"; the fake in tests rejects with the same shape. Anything else is real.
      if ((error as { code?: string } | undefined)?.code === "NoSuchKey") return undefined;
      throw error;
    }
  }

  async delete(key: StorageKey): Promise<void> {
    // S3 DELETE is idempotent by specification; no existence check.
    await this.client.deleteObject(key);
  }

  async signedUrl(key: StorageKey, options: SignedUrlOptions): Promise<string> {
    return this.client.presign(key, {
      expiresIn: options.expiresInSeconds,
      method: options.method ?? "GET",
    });
  }
}
