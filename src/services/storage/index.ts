/**
 * Media storage (NWB-P1-005) — the only import path for the service, matching the `email/`
 * convention: callers import from `../storage`, never from the files inside.
 */

export { BunS3ClientAdapter, type BunS3ClientConfig } from "./bun-s3";
export { LocalDiskStorageTransport, localMediaSignature } from "./local";
export { R2StorageTransport } from "./r2";
export {
  assetTypeForMime,
  createStorageService,
  getStorageService,
  getStorageService as storageService,
  MEDIA_ASSET_ID_PATTERN,
  MEDIA_MIN_UPLOAD_BYTES,
  type MediaAssetRecord,
  mediaCursorShape,
  SIGNED_URL_DEFAULT_SECONDS,
  SIGNED_URL_MAX_SECONDS,
  type StorageService,
  sanitizeFileName,
  setStorageServiceForTest,
  storageKeyFor,
  type UploadMediaInput,
  type UploadMediaResult,
} from "./service";
export type {
  S3ClientLike,
  SignedUrlOptions,
  StorageDriver,
  StorageGetResult,
  StorageKey,
  StoragePutOptions,
  StoragePutResult,
  StorageTransport,
} from "./types";
export { parseStorageUrl, storageUrlFor } from "./types";
