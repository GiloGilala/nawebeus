/**
 * AES-256-GCM secret encryption for OAuth tokens at rest (FR-SOC-003 / Module 3).
 *
 * Why here and not `src/lib/tokens.ts`: that module is for one-time *web* tokens (generate /
 * hash / expiry); this is symmetric sealing of third-party credentials, a different trust
 * relationship — the DB must not be able to leak a platform token even if a row does. Web Crypto
 * (`crypto.subtle`) is used directly rather than a dependency: Bun ships it, and the shape
 * (AES-256-GCM, random 96-bit IV per call, auth tag appended) is the NIST-recommended baseline
 * the module spec asks for.
 *
 * Ciphertext format: base64(iv ‖ ciphertext+tag). The IV is fresh per call, so encrypting the
 * same plaintext twice never repeats bytes (pinned by test).
 *
 * The key comes from config: `SOCIAL_TOKEN_ENCRYPTION_KEY` (base64url of 32 random bytes) when
 * set; otherwise — outside production, which config refuses — the derived fallback built by
 * `derivedKeyMaterial(JWT_ACCESS_SECRET)` (see `config.ts`; the storage-signing precedent). The
 * derivation is SHA-256 over a versioned label ‖ secret, so the JWT secret is never itself used
 * as an AES key.
 */

const IV_BYTES = 12; // 96-bit IV — GCM's recommended size
const KEY_BYTES = 32; // AES-256

const DERIVE_PREFIX = "derive:";

function keyMaterialLabel(): Uint8Array {
  return new TextEncoder().encode("nawebeus:social-token-v1");
}

/** Raw 32-byte AES key from base64url (or base64) key material. */
function decodeKey(material: string): Uint8Array {
  let bytes = new Uint8Array(Buffer.from(material, "base64url"));
  if (bytes.length !== KEY_BYTES) {
    bytes = new Uint8Array(Buffer.from(material, "base64"));
  }
  if (bytes.length !== KEY_BYTES) {
    throw new Error(
      `encryption key material must decode to ${KEY_BYTES} bytes (base64url of 32 random bytes)`,
    );
  }
  return bytes;
}

/** SHA-256(label ‖ secret) — the dev/test fallback derivation, deterministic per secret. */
async function deriveKey(secret: string): Promise<Uint8Array> {
  const label = keyMaterialLabel();
  const material = new TextEncoder().encode(secret);
  const input = new Uint8Array(label.length + material.length);
  input.set(label, 0);
  input.set(material, label.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}

async function resolveKey(keyMaterial: string): Promise<CryptoKey> {
  const bytes = keyMaterial.startsWith(DERIVE_PREFIX)
    ? await deriveKey(keyMaterial.slice(DERIVE_PREFIX.length))
    : decodeKey(keyMaterial);
  return crypto.subtle.importKey(
    "raw",
    bytes as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Seal `plaintext` under `keyMaterial` → base64(iv ‖ ciphertext‖tag). */
export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  const key = await resolveKey(keyMaterial);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      new TextEncoder().encode(plaintext) as unknown as ArrayBuffer,
    ),
  );
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv, 0);
  out.set(sealed, IV_BYTES);
  return Buffer.from(out).toString("base64");
}

/** Open a value produced by `encryptSecret`. Throws on any tampering or key mismatch. */
export async function decryptSecret(sealed: string, keyMaterial: string): Promise<string> {
  const key = await resolveKey(keyMaterial);
  const raw = new Uint8Array(Buffer.from(sealed, "base64"));
  if (raw.length <= IV_BYTES) {
    throw new Error("sealed value is too short to be an iv+ciphertext pair");
  }
  const iv = raw.slice(0, IV_BYTES);
  const ciphertext = raw.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    ciphertext as unknown as ArrayBuffer,
  );
  return new TextDecoder().decode(plain);
}

/** The dev/test fallback key material marker: derive from the given deployed secret. */
export function derivedKeyMaterial(secret: string): string {
  return `${DERIVE_PREFIX}${secret}`;
}
