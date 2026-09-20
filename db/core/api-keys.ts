/**
 * API Keys Database Schema
 * This file contains ONLY the database schema definition.
 * All TypeScript types are in @/server/auth/types/api-key-types.ts
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "../organization/organizations";
import {
  apiKeyEnvironmentPgEnum,
  apiKeyPermissionLevelPgEnum,
  apiKeySecurityLevelPgEnum,
  apiKeyStatusPgEnum,
  apiKeyTypePgEnum,
  keyRotationStrategyPgEnum,
  revocationTypePgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { users } from "./users";

/**
 * API Keys Table Definition
 *
 * This schema defines the database structure for API key management.
 * For type definitions, see: @/server/auth/types/api-key-types.ts
 */
export const apiKeys = pgTable(
  `${tablePrefix}api_keys`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }),
    version: integer("version").notNull().default(1),
    secretVersion: integer("secret_version").notNull().default(1), // NEW

    // ============================================
    // ORGANIZATION CONTEXT
    // ============================================
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // ============================================
    // OWNERSHIP
    // ============================================
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // teamId and projectId kept as UUIDs without FK until tables exist
    // They will be validated at the application level
    teamId: uuid("team_id"),
    projectId: uuid("project_id"),

    // ============================================
    // KEY METADATA
    // ============================================
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    keyType: apiKeyTypePgEnum("key_type").notNull(),
    environment: apiKeyEnvironmentPgEnum("environment").notNull().default("production"),
    status: apiKeyStatusPgEnum("status").notNull().default("active"),

    // ============================================
    // KEY VALUES (SECURITY)
    // ============================================
    publicKey: varchar("public_key", { length: 100 }).notNull(),
    secretHash: varchar("secret_hash", { length: 255 }),
    encryptedSecret: text("encrypted_secret"), // KEPT - design decision documented
    jwksUrl: text("jwks_url"),
    keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }),

    // ============================================
    // ACCESS CONTROL
    // ============================================
    permissionLevel: apiKeyPermissionLevelPgEnum("permission_level").notNull().default("read_only"),
    securityLevel: apiKeySecurityLevelPgEnum("security_level").notNull().default("standard"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    restrictions: jsonb("restrictions").$type<string[]>().notNull().default([]),
    permissions: jsonb("permissions")
      .$type<{
        resources?: {
          type: string;
          ids?: string[];
          actions: string[];
          conditions?: Record<string, unknown>;
        }[];
        globalConditions?: Record<string, unknown>;
        restrictions?: {
          endpoints?: string[];
          operations?: string[];
          dataTypes?: string[];
        };
      }>()
      .default({}),

    // ============================================
    // PLATFORM & NETWORK RESTRICTIONS
    // ============================================
    allowedPlatforms: jsonb("allowed_platforms").$type<string[]>().default(["web"]),
    deniedPlatforms: jsonb("denied_platforms").$type<string[]>().default([]),
    allowedOrigins: jsonb("allowed_origins").$type<string[]>().default([]),
    allowedIps: jsonb("allowed_ips").$type<string[]>().default([]),
    deniedIps: jsonb("denied_ips").$type<string[]>().default([]),

    // ============================================
    // ENDPOINT CONTROL
    // ============================================
    endpoints: jsonb("endpoints")
      .$type<{
        allowed?: string[];
        denied?: string[];
        rateLimits?: {
          requestsPerMinute?: number;
          requestsPerHour?: number;
          requestsPerDay?: number;
        };
      }>()
      .default({}),

    // ============================================
    // RATE LIMITING & QUOTAS (Enhanced)
    // ============================================
    rateLimits: jsonb("rate_limits")
      .$type<{
        enabled: boolean;
        strategy: "fixed_window" | "token_bucket" | "sliding_window";
        limits: {
          perSecond?: number;
          perMinute?: number;
          perHour?: number;
          perDay?: number;
          burst?: number;
        };
        currentUsage?: {
          second?: number;
          minute?: number;
          hour?: number;
          day?: number;
          total?: number;
          lastReset: Date;
        };
      }>()
      .notNull()
      // The default is a compact literal rather than a JS object on purpose
      // (NWB-P0-009): PostgreSQL deparses jsonb defaults in canonical form
      // (spaces after ':' and ',', keys sorted by length then bytewise), while
      // drizzle-kit serializes a JS-object default as JSON.stringify output and
      // compares the two as text — so an object default re-issued SET DEFAULT
      // on every push. drizzle-kit's jsonb introspection strips whitespace
      // before comparing, so a compact literal converges. Same jsonb value
      // either way — whitespace is insignificant in jsonb.
      .default(sql`'{"limits":{},"enabled":false,"strategy":"fixed_window"}'::jsonb`),

    // Enhanced quotas
    dailyQuota: integer("daily_quota"),
    monthlyQuota: integer("monthly_quota"),
    totalQuota: integer("total_quota"),
    quotaUsed: integer("quota_used").notNull().default(0),

    // Usage analytics (NEW)
    successfulRequests: integer("successful_requests").notNull().default(0),
    failedRequests: integer("failed_requests").notNull().default(0),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastStatusCode: integer("last_status_code"),
    averageLatency: integer("average_latency"), // in milliseconds

    // ============================================
    // LIFECYCLE
    // ============================================
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notBefore: timestamp("not_before", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: inet("last_used_ip"), // NEW
    lastUsedCountry: varchar("last_used_country", { length: 100 }), // NEW
    lastUsedCity: varchar("last_used_city", { length: 100 }), // NEW
    lastUserAgent: varchar("last_user_agent", { length: 500 }), // NEW
    usageCount: integer("usage_count").notNull().default(0),

    // ============================================
    // CREATION CONTEXT (NEW)
    // ============================================
    createdIp: inet("created_ip"),
    createdCountry: varchar("created_country", { length: 100 }),
    createdUserAgent: varchar("created_user_agent", { length: 500 }),

    // ============================================
    // ROTATION
    // ============================================
    rotationStrategy: keyRotationStrategyPgEnum("rotation_strategy").default("none"),
    rotatedFromId: uuid("rotated_from_id").references((): any => apiKeys.id),
    rotationCount: integer("rotation_count").notNull().default(0),
    nextRotationAt: timestamp("next_rotation_at", { withTimezone: true }),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),

    // ============================================
    // SECURITY CONTROLS
    // ============================================
    isSecretExposed: boolean("is_secret_exposed").default(false),
    secretLastExposedAt: timestamp("secret_last_exposed_at", {
      withTimezone: true,
    }),
    maxInactivityDays: integer("max_inactivity_days"),
    forceReauthentication: boolean("force_reauthentication").default(false),

    // ============================================
    // WEBHOOK CONFIGURATION
    // ============================================
    webhook: jsonb("webhook")
      .$type<{
        url?: string;
        secret?: string;
        events?: string[];
        retryPolicy?: {
          maxAttempts: number;
          backoffMultiplier: number;
        };
        active?: boolean;
        lastDelivery?: Date | null;
        failureCount?: number;
      }>()
      .default({}),

    // ============================================
    // PLATFORM SETTINGS
    // ============================================
    platformConfig: jsonb("platform_config")
      .$type<{
        web?: {
          corsAllowedOrigins?: string[];
          csrfProtection?: boolean;
          sessionTimeout?: number;
        };
        mobile?: {
          bundleIds?: string[];
          packageNames?: string[];
          deviceBinding?: boolean;
          certificatePinning?: boolean;
        };
        server?: {
          ipWhitelist?: string[];
          mutualTls?: boolean;
          proxyHeaders?: string[];
        };
      }>()
      .default({}),

    // ============================================
    // METADATA & TAGGING
    // ============================================
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata")
      .$type<{
        clientName?: string;
        contactEmail?: string;
        department?: string;
        costCenter?: string;
        projectCode?: string;
        custom?: Record<string, unknown>;
      }>()
      .default({}),

    // ============================================
    // AUDIT TRAIL
    // ============================================
    // set null, matching every other attribution FK in the schema: a purged
    // user must not block their own erasure (F-28 — these four had no
    // onDelete, i.e. NO ACTION, so purging anyone who ever created, updated,
    // revoked, or deleted an API key died on 23503).
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),

    // ============================================
    // REVOCATION (Enhanced)
    // ============================================
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
    revokeReason: text("revoke_reason"),
    revocationType: revocationTypePgEnum("revocation_type").default("manual"), // NEW

    // ============================================
    // SOFT DELETE & TIMESTAMPS
    // ============================================
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}api_keys_public_key_unique_idx`).on(table.publicKey),
    uniqueIndex(`${tablePrefix}api_keys_secret_hash_unique_idx`)
      .on(table.secretHash)
      .where(sql`${table.secretHash} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    uniqueIndex(`${tablePrefix}api_keys_external_id_unique_idx`)
      .on(table.externalId)
      .where(sql`${table.externalId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    // Organization + name uniqueness
    uniqueIndex(`${tablePrefix}api_keys_org_name_unique_idx`)
      .on(table.organizationId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}api_keys_org_idx`).on(table.organizationId),
    index(`${tablePrefix}api_keys_user_idx`).on(table.userId),
    index(`${tablePrefix}api_keys_team_idx`).on(table.teamId),
    index(`${tablePrefix}api_keys_project_idx`).on(table.projectId),
    index(`${tablePrefix}api_keys_type_idx`).on(table.keyType),
    index(`${tablePrefix}api_keys_status_idx`).on(table.status),
    index(`${tablePrefix}api_keys_env_idx`).on(table.environment),
    index(`${tablePrefix}api_keys_permission_level_idx`).on(table.permissionLevel),
    index(`${tablePrefix}api_keys_security_level_idx`).on(table.securityLevel),
    index(`${tablePrefix}api_keys_expires_at_idx`).on(table.expiresAt),
    index(`${tablePrefix}api_keys_issued_at_idx`).on(table.issuedAt),
    index(`${tablePrefix}api_keys_last_used_idx`).on(table.lastUsedAt),
    index(`${tablePrefix}api_keys_rotation_strategy_idx`).on(table.rotationStrategy),
    index(`${tablePrefix}api_keys_next_rotation_idx`).on(table.nextRotationAt),
    index(`${tablePrefix}api_keys_revocation_type_idx`).on(table.revocationType),
    index(`${tablePrefix}api_keys_last_used_ip_idx`).on(table.lastUsedIp), // NEW
    index(`${tablePrefix}api_keys_created_ip_idx`).on(table.createdIp), // NEW

    // ============================================
    // PARTIAL INDEXES FOR PERFORMANCE
    // ============================================
    index(`${tablePrefix}api_keys_active_idx`).on(
      table.organizationId,
      table.publicKey,
      table.expiresAt,
    ),
    index(`${tablePrefix}api_keys_needs_rotation_idx`).on(table.organizationId, table.publicKey),
    index(`${tablePrefix}api_keys_inactive_idx`).on(table.lastUsedAt),
    index(`${tablePrefix}api_keys_expired_idx`).on(table.expiresAt),
    index(`${tablePrefix}api_keys_high_security_idx`)
      .on(table.organizationId, table.securityLevel)
      .where(sql`
        ${table.securityLevel} IN ('high', 'critical')
        AND ${table.status} = 'active'
        AND ${table.deletedAt} IS NULL
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}api_keys_scopes_gin_idx`)
      .using("gin", table.scopes)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_restrictions_gin_idx`)
      .using("gin", table.restrictions)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_allowed_ips_gin_idx`)
      .using("gin", table.allowedIps)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_denied_ips_gin_idx`)
      .using("gin", table.deniedIps)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_allowed_origins_gin_idx`)
      .using("gin", table.allowedOrigins)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // COMPOSITE INDEXES (Enhanced)
    // ============================================
    // New: Organization + Status + Environment
    index(`${tablePrefix}api_keys_org_status_env_idx`)
      .on(table.organizationId, table.status, table.environment)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_org_type_active_idx`)
      .on(table.organizationId, table.keyType, table.expiresAt)
      .where(sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`),

    index(`${tablePrefix}api_keys_user_env_active_idx`)
      .on(table.userId, table.environment, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    // New: Last used tracking
    index(`${tablePrefix}api_keys_last_used_tracking_idx`)
      .on(table.lastUsedAt, table.lastUsedIp)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // CHECK CONSTRAINTS
    // ============================================
    check(
      "valid_expiry_check",
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.issuedAt}`,
    ),
    check(
      "quota_check",
      sql`${table.quotaUsed} <= COALESCE(${table.dailyQuota}, ${table.monthlyQuota}, ${table.totalQuota}, ${table.quotaUsed})`,
    ),
    check("rotation_count_check", sql`${table.rotationCount} >= 0`),
    check("usage_count_check", sql`${table.usageCount} >= 0`),
  ],
);

/**
 * API Keys Relations
 * Defines relationships between tables
 */
export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [apiKeys.updatedBy],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [apiKeys.revokedBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [apiKeys.deletedBy],
    references: [users.id],
  }),
  rotatedFrom: one(apiKeys, {
    fields: [apiKeys.rotatedFromId],
    references: [apiKeys.id],
    relationName: "rotatedFrom",
  }),
  rotations: many(apiKeys, {
    relationName: "rotatedFrom",
  }),
}));

/**
 * Database Selectors for Common Queries
 * These provide type-safe column selections
 */
export const apiKeySelectors = {
  basic: {
    id: apiKeys.id,
    organizationId: apiKeys.organizationId,
    userId: apiKeys.userId,
    name: apiKeys.name,
    keyType: apiKeys.keyType,
    publicKey: apiKeys.publicKey,
    keyPrefix: apiKeys.keyPrefix,
    environment: apiKeys.environment,
    permissionLevel: apiKeys.permissionLevel,
    securityLevel: apiKeys.securityLevel,
    status: apiKeys.status,
    issuedAt: apiKeys.issuedAt,
    expiresAt: apiKeys.expiresAt,
    lastUsedAt: apiKeys.lastUsedAt,
  } as const,

  validation: {
    id: apiKeys.id,
    organizationId: apiKeys.organizationId,
    userId: apiKeys.userId,
    keyType: apiKeys.keyType,
    publicKey: apiKeys.publicKey,
    secretHash: apiKeys.secretHash,
    encryptedSecret: apiKeys.encryptedSecret,
    permissionLevel: apiKeys.permissionLevel,
    securityLevel: apiKeys.securityLevel,
    scopes: apiKeys.scopes,
    permissions: apiKeys.permissions,
    status: apiKeys.status,
    issuedAt: apiKeys.issuedAt,
    expiresAt: apiKeys.expiresAt,
    notBefore: apiKeys.notBefore,
    revokedAt: apiKeys.revokedAt,
    allowedOrigins: apiKeys.allowedOrigins,
    allowedIps: apiKeys.allowedIps,
    deniedIps: apiKeys.deniedIps,
    endpoints: apiKeys.endpoints,
    rateLimits: apiKeys.rateLimits,
    dailyQuota: apiKeys.dailyQuota,
    monthlyQuota: apiKeys.monthlyQuota,
    totalQuota: apiKeys.totalQuota,
    quotaUsed: apiKeys.quotaUsed,
  } as const,

  security: {
    id: apiKeys.id,
    organizationId: apiKeys.organizationId,
    userId: apiKeys.userId,
    name: apiKeys.name,
    keyType: apiKeys.keyType,
    publicKey: apiKeys.publicKey,
    fingerprint: apiKeys.fingerprint,
    environment: apiKeys.environment,
    permissionLevel: apiKeys.permissionLevel,
    securityLevel: apiKeys.securityLevel,
    status: apiKeys.status,
    issuedAt: apiKeys.issuedAt,
    expiresAt: apiKeys.expiresAt,
    lastUsedAt: apiKeys.lastUsedAt,
    lastUsedIp: apiKeys.lastUsedIp,
    lastUsedCountry: apiKeys.lastUsedCountry,
    revokedAt: apiKeys.revokedAt,
    revokedBy: apiKeys.revokedBy,
    revokeReason: apiKeys.revokeReason,
    revocationType: apiKeys.revocationType,
    isSecretExposed: apiKeys.isSecretExposed,
    secretLastExposedAt: apiKeys.secretLastExposedAt,
    allowedIps: apiKeys.allowedIps,
    deniedIps: apiKeys.deniedIps,
    maxInactivityDays: apiKeys.maxInactivityDays,
    rotationStrategy: apiKeys.rotationStrategy,
    lastRotatedAt: apiKeys.lastRotatedAt,
    secretVersion: apiKeys.secretVersion,
  } as const,

  admin: {
    id: apiKeys.id,
    externalId: apiKeys.externalId,
    organizationId: apiKeys.organizationId,
    userId: apiKeys.userId,
    teamId: apiKeys.teamId,
    projectId: apiKeys.projectId,
    name: apiKeys.name,
    description: apiKeys.description,
    keyType: apiKeys.keyType,
    publicKey: apiKeys.publicKey,
    secretHash: apiKeys.secretHash,
    encryptedSecret: apiKeys.encryptedSecret,
    jwksUrl: apiKeys.jwksUrl,
    keyPrefix: apiKeys.keyPrefix,
    fingerprint: apiKeys.fingerprint,
    environment: apiKeys.environment,
    permissionLevel: apiKeys.permissionLevel,
    securityLevel: apiKeys.securityLevel,
    status: apiKeys.status,
    scopes: apiKeys.scopes,
    permissions: apiKeys.permissions,
    allowedPlatforms: apiKeys.allowedPlatforms,
    deniedPlatforms: apiKeys.deniedPlatforms,
    allowedOrigins: apiKeys.allowedOrigins,
    allowedIps: apiKeys.allowedIps,
    deniedIps: apiKeys.deniedIps,
    endpoints: apiKeys.endpoints,
    rateLimits: apiKeys.rateLimits,
    dailyQuota: apiKeys.dailyQuota,
    monthlyQuota: apiKeys.monthlyQuota,
    totalQuota: apiKeys.totalQuota,
    quotaUsed: apiKeys.quotaUsed,
    successfulRequests: apiKeys.successfulRequests,
    failedRequests: apiKeys.failedRequests,
    lastFailureAt: apiKeys.lastFailureAt,
    lastError: apiKeys.lastError,
    lastStatusCode: apiKeys.lastStatusCode,
    averageLatency: apiKeys.averageLatency,
    issuedAt: apiKeys.issuedAt,
    expiresAt: apiKeys.expiresAt,
    notBefore: apiKeys.notBefore,
    lastUsedAt: apiKeys.lastUsedAt,
    lastUsedIp: apiKeys.lastUsedIp,
    lastUsedCountry: apiKeys.lastUsedCountry,
    lastUsedCity: apiKeys.lastUsedCity,
    lastUserAgent: apiKeys.lastUserAgent,
    usageCount: apiKeys.usageCount,
    createdIp: apiKeys.createdIp,
    createdCountry: apiKeys.createdCountry,
    createdUserAgent: apiKeys.createdUserAgent,
    rotationStrategy: apiKeys.rotationStrategy,
    rotatedFromId: apiKeys.rotatedFromId,
    rotationCount: apiKeys.rotationCount,
    nextRotationAt: apiKeys.nextRotationAt,
    lastRotatedAt: apiKeys.lastRotatedAt,
    secretVersion: apiKeys.secretVersion,
    isSecretExposed: apiKeys.isSecretExposed,
    secretLastExposedAt: apiKeys.secretLastExposedAt,
    maxInactivityDays: apiKeys.maxInactivityDays,
    forceReauthentication: apiKeys.forceReauthentication,
    webhook: apiKeys.webhook,
    platformConfig: apiKeys.platformConfig,
    tags: apiKeys.tags,
    metadata: apiKeys.metadata,
    createdBy: apiKeys.createdBy,
    updatedBy: apiKeys.updatedBy,
    revokedAt: apiKeys.revokedAt,
    revokedBy: apiKeys.revokedBy,
    revokeReason: apiKeys.revokeReason,
    revocationType: apiKeys.revocationType,
    deletedAt: apiKeys.deletedAt,
    deletedBy: apiKeys.deletedBy,
    createdAt: apiKeys.createdAt,
    updatedAt: apiKeys.updatedAt,
  } as const,

  analytics: {
    id: apiKeys.id,
    organizationId: apiKeys.organizationId,
    userId: apiKeys.userId,
    name: apiKeys.name,
    keyType: apiKeys.keyType,
    environment: apiKeys.environment,
    status: apiKeys.status,
    usageCount: apiKeys.usageCount,
    successfulRequests: apiKeys.successfulRequests,
    failedRequests: apiKeys.failedRequests,
    lastUsedAt: apiKeys.lastUsedAt,
    lastFailureAt: apiKeys.lastFailureAt,
    lastError: apiKeys.lastError,
    lastStatusCode: apiKeys.lastStatusCode,
    averageLatency: apiKeys.averageLatency,
    lastUsedIp: apiKeys.lastUsedIp,
    lastUsedCountry: apiKeys.lastUsedCountry,
    dailyQuota: apiKeys.dailyQuota,
    monthlyQuota: apiKeys.monthlyQuota,
    totalQuota: apiKeys.totalQuota,
    quotaUsed: apiKeys.quotaUsed,
  } as const,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if an API key is active and valid
 */
export function isApiKeyActive(key: {
  status: string;
  deletedAt: Date | null;
  expiresAt: Date | null;
  notBefore: Date | null;
  revokedAt: Date | null;
}): boolean {
  if (key.status !== "active") return false;
  if (key.deletedAt) return false;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return false;
  if (key.notBefore && new Date(key.notBefore) > new Date()) return false;
  if (key.revokedAt) return false;
  return true;
}

/**
 * Check if an API key is expired
 */
export function isApiKeyExpired(key: { expiresAt: Date | null }): boolean {
  if (!key.expiresAt) return false;
  return new Date(key.expiresAt) < new Date();
}

/**
 * Check if an API key needs rotation
 */
export function needsRotation(key: {
  rotationStrategy: string;
  rotationCount: number;
  nextRotationAt: Date | null;
  lastRotatedAt: Date | null;
  issuedAt: Date;
  maxInactivityDays: number | null;
  lastUsedAt: Date | null;
}): boolean {
  if (key.rotationStrategy === "none") return false;

  // Check scheduled rotation
  if (key.nextRotationAt && new Date(key.nextRotationAt) < new Date()) {
    return true;
  }

  // Check inactivity
  if (key.maxInactivityDays && key.lastUsedAt) {
    const inactiveDays = (Date.now() - new Date(key.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (inactiveDays > key.maxInactivityDays) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate remaining quota
 */
export function getRemainingQuota(key: {
  dailyQuota: number | null;
  monthlyQuota: number | null;
  totalQuota: number | null;
  quotaUsed: number;
}): number | null {
  const quota = key.dailyQuota || key.monthlyQuota || key.totalQuota;
  if (!quota) return null;
  return Math.max(0, quota - key.quotaUsed);
}

/**
 * Check if quota is exceeded
 */
export function isQuotaExceeded(key: {
  dailyQuota: number | null;
  monthlyQuota: number | null;
  totalQuota: number | null;
  quotaUsed: number;
}): boolean {
  const remaining = getRemainingQuota(key);
  if (remaining === null) return false;
  return remaining <= 0;
}

/**
 * Get API key success rate
 */
export function getSuccessRate(key: {
  successfulRequests: number;
  failedRequests: number;
}): number {
  const total = key.successfulRequests + key.failedRequests;
  if (total === 0) return 100;
  return (key.successfulRequests / total) * 100;
}

/**
 * Check if key was created from a specific IP
 */
export function wasCreatedFromIp(key: { createdIp: string | null }, ip: string): boolean {
  if (!key.createdIp) return false;
  return key.createdIp === ip;
}

/**
 * Get key's last used location summary
 */
export function getLastUsedLocation(key: {
  lastUsedCountry: string | null;
  lastUsedCity: string | null;
}): string {
  if (!key.lastUsedCountry && !key.lastUsedCity) return "Unknown";
  if (key.lastUsedCountry && key.lastUsedCity) {
    return `${key.lastUsedCity}, ${key.lastUsedCountry}`;
  }
  return key.lastUsedCountry || key.lastUsedCity || "Unknown";
}
