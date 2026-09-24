/**
 * The one place `Bun.s3` is touched (NWB-P1-005).
 *
 * `Bun.S3Client` is structurally compatible with the storage contract's `S3ClientLike`, but its
 * method surface is larger (`file()`, `write()`, presign-on-file, …) and its exact generic shape
 * is a Bun-version concern. This adapter pins the four calls the R2 transport makes, so a Bun
 * upgrade that moves the S3 API breaks *here* — at the composition root — instead of inside the
 * service. Every other module in the codebase stays Bun-S3-free and fake-driven.
 */
import type { S3ClientLike } from "./types";

export interface BunS3ClientConfig {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  /** The S3 endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`. */
  readonly endpoint: string;
}

interface MinimalS3File {
  arrayBuffer(): Promise<ArrayBuffer>;
  readonly type: string;
}

interface MinimalS3Client {
  write(key: string, data: Uint8Array | string): Promise<number>;
  file(key: string, options?: { type?: string }): MinimalS3File;
  delete(key: string): Promise<void>;
  presign(key: string, options?: { expiresIn?: number; method?: string }): Promise<string>;
}

export class BunS3ClientAdapter implements S3ClientLike {
  private readonly client: MinimalS3Client;

  constructor(config: BunS3ClientConfig) {
    // The global exists only under the Bun runtime; importing `Bun` at the top level would make
    // this module un-importable under other loaders. Resolved lazily, with a message that names
    // the actual requirement.
    const bun = (
      globalThis as unknown as { Bun?: { S3Client: new (options: unknown) => MinimalS3Client } }
    ).Bun;
    if (!bun?.S3Client) {
      throw new Error("BunS3ClientAdapter requires the Bun runtime (Bun.S3Client is unavailable)");
    }
    this.client = new bun.S3Client({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucket: config.bucket,
      endpoint: config.endpoint,
    });
  }

  async putObject(key: string, data: Uint8Array): Promise<number> {
    return this.client.write(key, data);
  }

  async getObject(key: string): Promise<Blob> {
    const file = this.client.file(key);
    // `S3File` is Blob-like; wrap to a real Blob so the transport sees one type everywhere.
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.delete(key);
  }

  async presign(
    key: string,
    options?: { expiresIn?: number; method?: "GET" | "PUT" | "HEAD" },
  ): Promise<string> {
    return this.client.presign(key, {
      ...(options?.expiresIn !== undefined ? { expiresIn: options.expiresIn } : {}),
      method: options?.method ?? "GET",
    });
  }
}
