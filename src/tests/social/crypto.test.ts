/**
 * AES-256-GCM secret sealing (NWB-P2-001, FR-SOC-003) — pure crypto, no DB.
 *
 * What these pin that the OAuth service tests cannot: the seal is non-deterministic (fresh IV),
 * tamper-evident, and keyed — plus the derived-fallback key material behaves like real
 * material so dev/test never needs a second deployed secret.
 */
import { describe, expect, test } from "bun:test";
import { decryptSecret, derivedKeyMaterial, encryptSecret } from "../../lib/crypto";

const KEY = derivedKeyMaterial("test-jwt-secret-0123456789abcdef");
const OTHER_KEY = derivedKeyMaterial("a-different-secret");

describe("lib/crypto — encryptSecret / decryptSecret", () => {
  test("round-trips the plaintext", async () => {
    const sealed = await encryptSecret("platform-access-token-value", KEY);
    expect(sealed).not.toContain("platform-access-token-value");
    expect(await decryptSecret(sealed, KEY)).toBe("platform-access-token-value");
  });

  test("never repeats bytes for the same plaintext (fresh IV per call)", async () => {
    const a = await encryptSecret("same-plaintext", KEY);
    const b = await encryptSecret("same-plaintext", KEY);
    expect(a).not.toBe(b);
    expect(await decryptSecret(a, KEY)).toBe("same-plaintext");
    expect(await decryptSecret(b, KEY)).toBe("same-plaintext");
  });

  test("a flipped byte in the ciphertext refuses to decrypt", async () => {
    const sealed = await encryptSecret("integrity-matters", KEY);
    const raw = Buffer.from(sealed, "base64");
    raw[raw.length - 1]! ^= 0x01; // flip one bit in the auth tag's neighbourhood
    const tampered = raw.toString("base64");
    await expect(decryptSecret(tampered, KEY)).rejects.toThrow();
  });

  test("the wrong key refuses to decrypt", async () => {
    const sealed = await encryptSecret("for-one-key-only", KEY);
    await expect(decryptSecret(sealed, OTHER_KEY)).rejects.toThrow();
  });

  test("base64 key material works and wrong lengths are refused", async () => {
    const material = Buffer.from(new Uint8Array(32).fill(7)).toString("base64url");
    const sealed = await encryptSecret("explicit-key", material);
    expect(await decryptSecret(sealed, material)).toBe("explicit-key");

    const short = Buffer.from(new Uint8Array(16)).toString("base64url");
    await expect(encryptSecret("x", short)).rejects.toThrow(/32 bytes/);
  });

  test("a truncated sealed value refuses to decrypt instead of crashing", async () => {
    await expect(decryptSecret(Buffer.from([1, 2, 3]).toString("base64"), KEY)).rejects.toThrow(
      /too short/,
    );
  });
});
