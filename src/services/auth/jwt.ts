export interface AccessPayload {
  userId: string;
  orgId: string;
  type: "access";
}

export interface RefreshPayload {
  sessionId: string;
  type: "refresh";
}

export type JwtPayload = AccessPayload | RefreshPayload;

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacSha256(secret: string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(data));
}

export async function signToken(payload: JwtPayload, secret: string, expiresInSec: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const headerB64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const bodyB64 = toBase64Url(enc.encode(JSON.stringify(body)));
  const signature = await hmacSha256(secret, `${headerB64}.${bodyB64}`);
  return `${headerB64}.${bodyB64}.${toBase64Url(signature)}`;
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [headerB64, bodyB64, sigB64] = parts;
  const expectedSig = new Uint8Array(await hmacSha256(secret, `${headerB64}.${bodyB64}`));
  const actualSig = fromBase64Url(sigB64!);
  if (actualSig.byteLength !== expectedSig.byteLength) throw new Error("Invalid signature");
  let match = true;
  for (let i = 0; i < expectedSig.byteLength; i++) if (expectedSig[i] !== actualSig[i]) match = false;
  if (!match) throw new Error("Invalid signature");
  const raw = JSON.parse(new TextDecoder().decode(fromBase64Url(bodyB64!)));
  if (raw.exp && raw.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return raw as JwtPayload;
}

export function signAccessToken(userId: string, orgId: string, secret: string): Promise<string> {
  return signToken({ userId, orgId, type: "access" }, secret, 900);
}

export function signRefreshToken(sessionId: string, secret: string): Promise<string> {
  return signToken({ sessionId, type: "refresh" }, secret, 604800);
}
