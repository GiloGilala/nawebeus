import { describe, expect, test } from "bun:test";
import { generateTOTOPair, verifyTOTP, totpKeyUri } from "../services/auth/totp";

describe("generateTOTOPair", () => {
  test("returns a base32 secret and a key URI", () => {
    const pair = generateTOTOPair("user@example.com");
    expect(pair.secret).toMatch(/^[A-Z2-7]+$/);
    expect(pair.secret.length).toBeGreaterThanOrEqual(16);
    expect(pair.uri).toContain("otpauth://totp/");
  });

  test("URI contains issuer and account name", () => {
    const pair = generateTOTOPair("ade@nawebeus.com", "Nawebeus");
    expect(pair.uri).toContain("issuer=Nawebeus");
    expect(pair.uri).toContain("ade%40nawebeus.com");
  });
});

describe("verifyTOTP", () => {
  test("verifies a code generated from the same secret", async () => {
    const { secret } = generateTOTOPair("user@example.com");
    const code = await totpNow(secret);
    expect(await verifyTOTP(secret, code)).toBe(true);
  });

  test("rejects an incorrect code", async () => {
    const { secret } = generateTOTOPair("user@example.com");
    expect(await verifyTOTP(secret, "000000")).toBe(false);
  });

  test("rejects a 5-digit code", async () => {
    const { secret } = generateTOTOPair("user@example.com");
    expect(await verifyTOTP(secret, "12345")).toBe(false);
  });

  test("accepts code with ±1 step drift", async () => {
    const { secret } = generateTOTOPair("user@example.com");
    const prev = await totpAt(secret, -1);
    const next = await totpAt(secret, 1);
    expect(await verifyTOTP(secret, prev)).toBe(true);
    expect(await verifyTOTP(secret, next)).toBe(true);
  });

  test("rejects code with ±2 step drift", async () => {
    const { secret } = generateTOTOPair("user@example.com");
    const far = await totpAt(secret, -2);
    expect(await verifyTOTP(secret, far)).toBe(false);
  });
});

describe("totpKeyUri", () => {
  test("encodes secret in URI with issuer and label", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const uri = totpKeyUri(secret, "user@example.com", "MyApp");
    expect(uri).toContain("otpauth://totp/MyApp:user%40example.com?");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=MyApp");
  });
});

// helpers

const B32_LOOKUP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Decode(b32: string): Uint8Array {
  const out: number[] = [];
  let accum = 0;
  let bitsLeft = 0;
  for (const c of b32.toUpperCase()) {
    if (c === "=") continue;
    const val = B32_LOOKUP.indexOf(c);
    if (val === -1) continue;
    accum = (accum << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((accum >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(out);
}

async function totpCodeAt(secret: string, counter: number): Promise<string> {
  const key = b32Decode(secret);
  const counterBuf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, counterBuf as any);
  const arr = new Uint8Array(sig);
  const offset = arr[19]! & 0x0f;
  const binary =
    ((arr[offset]! & 0x0d) << 24) |
    ((arr[offset + 1]! & 0xff) << 16) |
    ((arr[offset + 2]! & 0xff) << 8) |
    (arr[offset + 3]! & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

async function totpNow(secret: string): Promise<string> {
  const counter = Math.floor(Date.now() / 30_000);
  return totpCodeAt(secret, counter);
}

async function totpAt(secret: string, offset: number): Promise<string> {
  const counter = Math.floor(Date.now() / 30_000) + offset;
  return totpCodeAt(secret, counter);
}
