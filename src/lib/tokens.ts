const TOKEN_BYTES = 32;

export function generateSecureToken(): string {
  const buf = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}

export function tokenExpiryFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}
