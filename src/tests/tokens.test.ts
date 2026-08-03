import { describe, expect, test } from "bun:test";
import { generateSecureToken, hashToken, isTokenExpired } from "../lib/tokens";

describe("generateSecureToken", () => {
  test("returns a 64-char hex string (32 bytes)", () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token.length).toBe(64);
  });

  test("each call produces a unique token", () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
  });

  test("token is URL-safe (no characters needing encoding)", () => {
    const token = generateSecureToken();
    expect(token).not.toMatch(/[+/=]/);
  });
});

describe("hashToken", () => {
  test("produces a 64-char SHA-256 hex digest", async () => {
    const hash = await hashToken("my-refresh-token-123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("same input always produces same hash", async () => {
    const a = await hashToken("abcdef");
    const b = await hashToken("abcdef");
    expect(a).toBe(b);
  });

  test("different inputs produce different hashes", async () => {
    const a = await hashToken("token-a");
    const b = await hashToken("token-b");
    expect(a).not.toBe(b);
  });

  test("hash is one-way (cannot recover plaintext)", async () => {
    const hash = await hashToken("secret");
    expect(hash).not.toContain("secret");
    expect(hash.length).toBe(64);
  });
});

describe("isTokenExpired", () => {
  test("returns false for a future expiry", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(future)).toBe(false);
  });

  test("returns true for a past expiry", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTokenExpired(past)).toBe(true);
  });

  test("returns true for an expired token within tolerance", () => {
    const justPast = new Date(Date.now() - 5_000);
    expect(isTokenExpired(justPast)).toBe(true);
  });
});
