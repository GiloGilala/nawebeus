/**
 * API Key Type Definitions
 *
 * Domain unions and request/response shapes for API key management. The
 * database schema lives in `db/core/api-keys.ts` — this file holds the types
 * consumed by `src/services/auth/api-key.ts` and the route layer.
 *
 * The unions below mirror the PostgreSQL enums declared in `db/shared/enums.ts`.
 * If an enum changes there, change it here in the same commit.
 */

/** Mirrors the `api_key_status` enum. */
export type ApiKeyStatus = "active" | "inactive" | "revoked";

/** Mirrors the `api_key_type` enum. */
export type ApiKeyType = "read" | "write" | "admin";

/** Mirrors the `api_key_permission_level` enum. */
export type ApiKeyPermissionLevel = "read" | "write" | "admin" | "read_only";

/** Mirrors the `api_key_environment` enum. */
export type ApiKeyEnvironment = "production" | "staging" | "development";

/** Mirrors the `api_key_security_level` enum. */
export type ApiKeySecurityLevel = "low" | "medium" | "high" | "critical" | "standard";

/** Mirrors the `key_rotation_strategy` enum. */
export type KeyRotationStrategy = "manual" | "automatic" | "periodic" | "none";

/** Mirrors the `revocation_type` enum. */
export type RevocationType = "user" | "admin" | "system" | "security" | "manual";

/** Namespace segment on every presented key string. */
export const API_KEY_NAMESPACE = "nwb";

/**
 * Environment code embedded in the presented key string. Kept to four
 * characters so the resulting `key_prefix` (`nwb_` + code) is exactly 8.
 */
export const ENVIRONMENT_CODES: Record<ApiKeyEnvironment, string> = {
  production: "live",
  staging: "test",
  development: "dev",
};

/** Hex characters in the public (lookup) half of a key — 128 bits. */
export const PUBLIC_KEY_HEX_LENGTH = 32;

/** `api_keys.key_prefix` is `varchar(8)`. */
export const KEY_PREFIX_LENGTH = 8;

/**
 * A presented key, split into its lookup half and its secret half.
 *
 * The full string is `nwb_<envCode>_<publicKey>_<secret>`. The public half is
 * what the database indexes, so verification is a single indexed lookup rather
 * than a scan-and-compare over every stored hash.
 */
export interface ParsedApiKey {
  environmentCode: string;
  publicKey: string;
  secret: string;
}

export interface CreateApiKeyInput {
  organizationId: string;
  /** Owner of the key. A key with no owner cannot be authorized. */
  userId: string;
  createdBy: string;
  name: string;
  description?: string;
  keyType: ApiKeyType;
  environment: ApiKeyEnvironment;
  permissionLevel: ApiKeyPermissionLevel;
  securityLevel: ApiKeySecurityLevel;
  /** Empty means "inherit every action the owning user can perform". */
  scopes: string[];
  expiresAt: Date | null;
  rotationStrategy: KeyRotationStrategy;
  createdIp?: string;
  createdUserAgent?: string;
}

/**
 * Returned exactly once — from `createApiKey` and `rotateApiKey`.
 *
 * `key` is the only moment the plaintext secret exists outside the caller's
 * memory. It is never persisted in a recoverable form: the row stores a SHA-256
 * digest, and `encrypted_secret` is deliberately left NULL.
 */
export interface CreatedApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  publicKey: string;
  environment: ApiKeyEnvironment;
  keyType: ApiKeyType;
  permissionLevel: ApiKeyPermissionLevel;
  scopes: string[];
  status: ApiKeyStatus;
  issuedAt: Date;
  expiresAt: Date | null;
}

/** A list row. The secret is never present — only a display mask. */
export interface ApiKeyListEntry {
  id: string;
  name: string;
  description: string | null;
  maskedKey: string;
  keyType: ApiKeyType;
  environment: ApiKeyEnvironment;
  permissionLevel: ApiKeyPermissionLevel;
  securityLevel: ApiKeySecurityLevel;
  scopes: string[];
  status: ApiKeyStatus;
  issuedAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  revokedAt: Date | null;
  revokeReason: string | null;
}

/** The minimum an authenticated request needs out of a verified key. */
export interface ResolvedApiKey {
  id: string;
  organizationId: string;
  userId: string;
  permissionLevel: ApiKeyPermissionLevel;
  scopes: string[];
  environment: ApiKeyEnvironment;
}

export type RevokeOutcome =
  | { outcome: "revoked"; id: string }
  | { outcome: "not_found" }
  | { outcome: "already_revoked"; id: string };

export type RotateOutcome =
  | { outcome: "rotated"; key: CreatedApiKey }
  | { outcome: "not_found" }
  | { outcome: "already_revoked" };

export interface ApiKeyUsage {
  ip: string | null;
  userAgent: string | null;
}
