/**
 * The storage contract every caller and every transport shares (NWB-P1-005) — the twin of the
 * email contract (NWB-P1-004), by the ticket's own instruction ("interface mirrors
 * `EmailTransport`").
 *
 * Three shapes, in the order an asset moves through them:
 *
 * - **`StorageKey`** — where the bytes live: `{orgId}/{assetId}/{filename}`. The durable part of
 *   an asset: rows can be re-pointed between transports, keys cannot change meaning.
 * - **`storageUrl`** — what the row stores: `<driver>://<key>` (`local://…`, `r2://…`). An
 *   *internal identifier*, never a client-facing URL — the `media_assets` header comment's rule
 *   ("storageUrl → origin, never exposed to end users"), enforced by construction because a URI
 *   with a non-HTTP scheme cannot be accidentally rendered.
 * - **`SignedUrl`** — what a client receives: for R2, a real presigned S3 URL (the browser talks
 *   to the origin directly); for the local transport, an app URL (`/api/media/signed/:assetId`)
 *   whose HMAC the route verifies. Both answer the same question — "let a browser fetch these
 *   bytes without a session cookie" — which is the only reason signed URLs exist.
 */

/** Driver schemes allowed in `media_assets.storage_url`. Anything else is a corrupt row. */
export type StorageDriver = "local" | "r2";

/** An object key: `{orgId}/{assetId}/{filename}`, path-safe by construction. */
export type StorageKey = string;

/** What `put` reports — the key it stored and the byte count it wrote. */
export interface StoragePutResult {
  readonly key: StorageKey;
  readonly sizeBytes: number;
}

export interface StoragePutOptions {
  readonly contentType?: string | undefined;
}

export interface StorageGetResult {
  readonly data: Uint8Array;
  readonly contentType: string | undefined;
}

export interface SignedUrlOptions {
  readonly expiresInSeconds: number;
  readonly method?: "GET" | "PUT" | undefined;
}

/**
 * One way to store bytes. Two implementations: `LocalDiskStorageTransport` (dev, tests, and a
 * single-box deployment that says so) and `R2StorageTransport` (Cloudflare R2 over Bun.s3 —
 * production). `signedUrl` is part of the contract because "upload → signed URL" is the exit
 * gate's own phrasing: a transport that cannot hand back a no-cookie URL has not done the job.
 */
export interface StorageTransport {
  /** `local` or `r2` — the driver half of the `storageUrl` URI. */
  readonly name: StorageDriver;
  put(key: StorageKey, data: Uint8Array, options?: StoragePutOptions): Promise<StoragePutResult>;
  /** `undefined` when the key does not exist — callers decide 404 vs 410. */
  get(key: StorageKey): Promise<StorageGetResult | undefined>;
  /** Idempotent: deleting a missing key resolves. */
  delete(key: StorageKey): Promise<void>;
  signedUrl(key: StorageKey, options: SignedUrlOptions): Promise<string>;
}

/** The `<driver>://<key>` identifier the `media_assets.storage_url` column holds. */
export function storageUrlFor(driver: StorageDriver, key: StorageKey): string {
  return `${driver}://${key}`;
}

/** Inverse of {@link storageUrlFor}; `undefined` for a URL this process's drivers did not write. */
export function parseStorageUrl(
  storageUrl: string,
): { driver: StorageDriver; key: StorageKey } | undefined {
  const match = /^(local|r2):\/\/(.+)$/.exec(storageUrl);
  if (!match) return undefined;
  return { driver: match[1] as StorageDriver, key: match[2]! };
}

/**
 * The slice of `Bun.S3Client` the R2 adapter touches, declared structurally so a test can hand
 * the adapter a recording fake exactly the way the Resend transport's tests hand it a fake
 * `fetch`. A real `Bun.S3Client` satisfies this as-is; the composition root builds it from
 * config and passes it in, which keeps `Bun.s3` un-imported everywhere else.
 */
export interface S3ClientLike {
  putObject(key: string, data: Uint8Array): Promise<number>;
  getObject(key: string): Promise<Blob>;
  deleteObject(key: string): Promise<void>;
  presign(
    key: string,
    options?: { expiresIn?: number; method?: "GET" | "PUT" | "HEAD" },
  ): Promise<string>;
}
