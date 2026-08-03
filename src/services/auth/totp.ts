const B32_LOOKUP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const B32_REVERSE: Record<string, number> = {};
for (let i = 0; i < B32_LOOKUP.length; i++) B32_REVERSE[B32_LOOKUP[i]!] = i;

const EPOCH_SECONDS = 30;

function b32Decode(b32: string): Uint8Array {
  const out: number[] = [];
  let accum = 0;
  let bitsLeft = 0;
  for (const c of b32.toUpperCase()) {
    if (c === "=") continue;
    const val = B32_REVERSE[c];
    if (val === undefined) continue;
    accum = (accum << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((accum >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function b32Encode(buf: Uint8Array): string {
  let out = "";
  let bitsLeft = 0;
  let accum = 0;
  for (const b of buf) {
    accum = (accum << 8) | b;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      out += B32_LOOKUP[(accum >> bitsLeft) & 0x1f];
    }
  }
  if (bitsLeft > 0) {
    out += B32_LOOKUP[(accum << (5 - bitsLeft)) & 0x1f];
  }
  while (out.length % 8 !== 0) out += "=";
  return out;
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as any);
  return new Uint8Array(sig);
}

export function generateTOTOSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return b32Encode(bytes);
}

export async function totpCodeAt(secret: string, counter: number): Promise<string> {
  const key = b32Decode(secret);
  const counterBuf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const sig = await hmacSha1(key, counterBuf);
  const offset = sig[19]! & 0x0f;
  const binary =
    ((sig[offset]! & 0x0d) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff);
  const code = (binary % 1_000_000).toString().padStart(6, "0");
  return code;
}

export interface TOTPPair {
  secret: string;
  uri: string;
}

export function generateTOTOPair(account: string, issuer = "Nawebeus"): TOTPPair {
  const secret = generateTOTOSecret();
  return {
    secret,
    uri: totpKeyUri(secret, account, issuer),
  };
}

export function totpKeyUri(secret: string, account: string, issuer: string): string {
  const encodedSecret = encodeURIComponent(secret);
  const encodedAccount = encodeURIComponent(account);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${encodedSecret}&issuer=${encodedIssuer}`;
}

export async function getCurrentTOTP(secret: string): Promise<string> {
  const counter = Math.floor(Date.now() / (EPOCH_SECONDS * 1000));
  return totpCodeAt(secret, counter);
}

export async function verifyTOTP(
  secret: string,
  token: string,
  window: number = 1,
): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;

  const counter = Math.floor(Date.now() / (EPOCH_SECONDS * 1000));

  for (let i = -window; i <= window; i++) {
    const code = await totpCodeAt(secret, counter + i);
    // constant-time comparison
    let match = true;
    for (let j = 0; j < 6; j++) {
      if (code[j] !== token[j]) match = false;
    }
    if (match) return true;
  }

  return false;
}
