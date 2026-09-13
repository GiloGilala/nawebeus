// packages/database/schema/auth/oauth-accounts.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
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
  connectionStatusPgEnum,
  consentLevelPgEnum,
  oauthAccountStatusPgEnum,
  oauthProviderPgEnum,
  tokenStatusPgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface OAuthProfile {
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  picture?: string;
  locale?: string;
  updated_at?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  birthdate?: string;
  gender?: string;
  website?: string;
  zoneinfo?: string;
}

export interface OAuthSyncSettings {
  syncProfile?: boolean;
  syncEmail?: boolean;
  syncAvatar?: boolean;
  syncCalendar?: boolean;
  syncContacts?: boolean;
  autoSyncInterval?: number; // minutes
  lastSyncStatus?: "success" | "failed" | "in_progress";
  syncErrors?: string[];
  customSyncConfig?: Record<string, unknown>;
}

export interface OAuthUsageStats {
  apiCalls?: number;
  apiCallsLastMonth?: number;
  totalApiCalls?: number;
  lastApiCallAt?: string;
  errorCount?: number;
  successRate?: number;
  averageResponseTime?: number;
}

export interface OAuthMetadata {
  source?: string;
  department?: string;
  team?: string;
  purpose?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface OAuthComplianceMetadata {
  dataRetentionPolicy?: string;
  gdprCompliant?: boolean;
  ccpaCompliant?: boolean;
  hipaaCompliant?: boolean;
  dataProcessingAgreement?: string;
  lastComplianceReview?: string;
}

// ============================================
// OAUTH ACCOUNTS TABLE
// ============================================

export const oauthAccounts = pgTable(
  `${tablePrefix}oauth_accounts`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // OWNERSHIP & RELATIONSHIPS
    // ============================================
    ownerId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // For team/organization contexts
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id"),

    // ============================================
    // PLATFORM IDENTITY
    // ============================================
    provider: oauthProviderPgEnum("provider").notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),

    // Account identifiers
    providerUsername: varchar("provider_username", { length: 255 }),
    providerAccountEmail: varchar("provider_account_email", { length: 255 }),
    providerAccountEmailVerified: boolean("provider_account_email_verified").default(false),
    providerAccountPhone: varchar("provider_account_phone", { length: 50 }),
    providerAccountPhoneVerified: boolean("provider_account_phone_verified").default(false),

    // ============================================
    // OAUTH TOKENS & CREDENTIALS
    // ============================================
    // ENCRYPTED - tokens should be encrypted at rest using AES-256-GCM or libsodium secretbox
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),

    tokenType: varchar("token_type", { length: 50 }).default("Bearer"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    idTokenExpiresAt: timestamp("id_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    tokenStatus: tokenStatusPgEnum("token_status").notNull().default("valid"),
    lastTokenRefreshAt: timestamp("last_token_refresh_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Scopes granted by user
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    grantedPermissions: jsonb("granted_permissions").$type<string[]>().default(sql`'[]'::jsonb`),

    // ============================================
    // ACCOUNT STATUS & CONNECTION
    // ============================================
    status: oauthAccountStatusPgEnum("status").notNull().default("active"),
    connectionStatus: connectionStatusPgEnum("connection_status").default("connected"),

    isActive: boolean("is_active").notNull().default(true),
    isPrimary: boolean("is_primary").default(false),
    isDefault: boolean("is_default").default(false),

    lastConnectedAt: timestamp("last_connected_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastDisconnectedAt: timestamp("last_disconnected_at", {
      withTimezone: true,
      mode: "date",
    }),
    connectionError: varchar("connection_error", { length: 500 }),
    retryCount: integer("retry_count").default(0),

    // ============================================
    // CONSENT & PERMISSIONS
    // ============================================
    consentLevel: consentLevelPgEnum("consent_level").notNull().default("basic"),
    consentGrantedAt: timestamp("consent_granted_at", {
      withTimezone: true,
      mode: "date",
    }),
    consentExpiresAt: timestamp("consent_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    dataProcessingConsent: boolean("data_processing_consent").notNull().default(false),
    dataProcessingConsentAt: timestamp("data_processing_consent_at", {
      withTimezone: true,
      mode: "date",
    }),

    marketingConsent: boolean("marketing_consent").default(false),
    marketingConsentAt: timestamp("marketing_consent_at", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // PROFILE DATA FROM PROVIDER
    // ============================================
    profile: jsonb("profile").$type<OAuthProfile>().default(sql`'{}'::jsonb`),

    rawProfile: text("raw_profile"),

    // Provider-specific metadata
    providerMetadata: jsonb("provider_metadata").default(sql`'{}'::jsonb`),

    // ============================================
    // USAGE & ACTIVITY
    // ============================================
    loginCount: integer("login_count").default(0),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastLoginIp: inet("last_login_ip"), // NEW
    lastLoginUserAgent: varchar("last_login_user_agent", { length: 500 }), // NEW
    lastSyncAt: timestamp("last_sync_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "date",
    }),

    syncSettings: jsonb("sync_settings").$type<OAuthSyncSettings>().default(sql`'{}'::jsonb`),
    usageStats: jsonb("usage_stats").$type<OAuthUsageStats>().default(sql`'{}'::jsonb`),

    // ============================================
    // SECURITY & COMPLIANCE
    // ============================================
    securityFlags: jsonb("security_flags").$type<string[]>().default(sql`'[]'::jsonb`),
    complianceMetadata: jsonb("compliance_metadata")
      .$type<OAuthComplianceMetadata>()
      .default(sql`'{}'::jsonb`),

    // For audit logging
    createdByIp: inet("created_by_ip"), // Changed from varchar to inet
    createdByUserAgent: varchar("created_by_user_agent", { length: 500 }),

    // ============================================
    // CUSTOM DATA & METADATA
    // ============================================
    metadata: jsonb("metadata").$type<OAuthMetadata>().default(sql`'{}'::jsonb`),
    customFields: jsonb("custom_fields").default(sql`'{}'::jsonb`),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),

    // ============================================
    // SOFT DELETE & TIMESTAMPS
    // ============================================
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deletionReason: varchar("deletion_reason", { length: 500 }),

    ...timestamps,
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}oauth_accounts_provider_unique_idx`)
      .on(table.provider, table.providerAccountId)
      .where(sql`${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}oauth_accounts_user_provider_unique_idx`)
      .on(table.ownerId, table.provider)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}oauth_accounts_user_id_idx`).on(table.ownerId),
    index(`${tablePrefix}oauth_accounts_provider_idx`).on(table.provider),
    index(`${tablePrefix}oauth_accounts_status_idx`).on(table.status),
    index(`${tablePrefix}oauth_accounts_connection_status_idx`).on(table.connectionStatus),
    index(`${tablePrefix}oauth_accounts_is_active_idx`).on(table.isActive),
    index(`${tablePrefix}oauth_accounts_token_status_idx`).on(table.tokenStatus),
    index(`${tablePrefix}oauth_accounts_organization_id_idx`).on(table.organizationId),
    index(`${tablePrefix}oauth_accounts_team_id_idx`).on(table.teamId),
    index(`${tablePrefix}oauth_accounts_deleted_by_idx`).on(table.deletedBy),
    index(`${tablePrefix}oauth_accounts_last_login_ip_idx`).on(table.lastLoginIp), // NEW

    // ============================================
    // TOKEN MANAGEMENT INDEXES
    // ============================================
    index(`${tablePrefix}oauth_accounts_token_expiry_idx`)
      .on(table.accessTokenExpiresAt, table.tokenStatus)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_refresh_token_expiry_idx`)
      .on(table.refreshTokenExpiresAt, table.tokenStatus)
      .where(sql`${table.refreshTokenExpiresAt} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================
    index(`${tablePrefix}oauth_accounts_active_connections_idx`)
      .on(table.ownerId, table.status, table.connectionStatus)
      .where(sql`
        ${table.status} = 'active'
        AND ${table.connectionStatus} = 'connected'
        AND ${table.deletedAt} IS NULL
      `),

    index(`${tablePrefix}oauth_accounts_needs_refresh_idx`)
      .on(table.accessTokenExpiresAt, table.connectionStatus)
      .where(sql`
        ${table.connectionStatus} = 'connected'
        AND ${table.deletedAt} IS NULL
      `),

    index(`${tablePrefix}oauth_accounts_email_verified_idx`)
      .on(table.providerAccountEmail, table.providerAccountEmailVerified)
      .where(sql`${table.providerAccountEmail} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_user_provider_status_idx`)
      .on(table.ownerId, table.provider, table.status)
      .where(sql`
        ${table.deletedAt} IS NULL
      `),

    index(`${tablePrefix}oauth_accounts_last_used_idx`)
      .on(table.lastUsedAt, table.status)
      .where(sql`
        ${table.deletedAt} IS NULL
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}oauth_accounts_scopes_gin_idx`)
      .using("gin", table.scopes)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_profile_gin_idx`)
      .using("gin", table.profile)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_tags_gin_idx`)
      .using("gin", table.tags)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_sync_settings_gin_idx`)
      .using("gin", table.syncSettings)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_usage_stats_gin_idx`)
      .using("gin", table.usageStats)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_compliance_metadata_gin_idx`)
      .using("gin", table.complianceMetadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}oauth_accounts_granted_permissions_gin_idx`)
      .using("gin", table.grantedPermissions)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.ownerId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [oauthAccounts.organizationId],
    references: [organizations.id],
  }),
  deletedByUser: one(users, {
    fields: [oauthAccounts.deletedBy],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type OAuthAccountTable = typeof oauthAccounts;

// ============================================
// HELPER SELECTORS
// ============================================

export const oauthAccountSelectors = {
  basic: {
    id: oauthAccounts.id,
    ownerId: oauthAccounts.ownerId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    providerAccountEmail: oauthAccounts.providerAccountEmail,
    providerAccountEmailVerified: oauthAccounts.providerAccountEmailVerified,
    accessToken: oauthAccounts.accessToken,
    refreshToken: oauthAccounts.refreshToken,
    accessTokenExpiresAt: oauthAccounts.accessTokenExpiresAt,
    tokenStatus: oauthAccounts.tokenStatus,
    status: oauthAccounts.status,
    connectionStatus: oauthAccounts.connectionStatus,
    isActive: oauthAccounts.isActive,
    scopes: oauthAccounts.scopes,
  } as const,

  profile: {
    id: oauthAccounts.id,
    ownerId: oauthAccounts.ownerId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    providerUsername: oauthAccounts.providerUsername,
    providerAccountEmail: oauthAccounts.providerAccountEmail,
    providerAccountEmailVerified: oauthAccounts.providerAccountEmailVerified,
    profile: oauthAccounts.profile,
    scopes: oauthAccounts.scopes,
    lastSyncAt: oauthAccounts.lastSyncAt,
    syncSettings: oauthAccounts.syncSettings,
  } as const,

  connection: {
    id: oauthAccounts.id,
    ownerId: oauthAccounts.ownerId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    providerAccountEmail: oauthAccounts.providerAccountEmail,
    status: oauthAccounts.status,
    connectionStatus: oauthAccounts.connectionStatus,
    isActive: oauthAccounts.isActive,
    accessTokenExpiresAt: oauthAccounts.accessTokenExpiresAt,
    lastConnectedAt: oauthAccounts.lastConnectedAt,
    lastDisconnectedAt: oauthAccounts.lastDisconnectedAt,
    connectionError: oauthAccounts.connectionError,
    retryCount: oauthAccounts.retryCount,
  } as const,

  security: {
    id: oauthAccounts.id,
    ownerId: oauthAccounts.ownerId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    status: oauthAccounts.status,
    connectionStatus: oauthAccounts.connectionStatus,
    tokenStatus: oauthAccounts.tokenStatus,
    consentLevel: oauthAccounts.consentLevel,
    consentGrantedAt: oauthAccounts.consentGrantedAt,
    consentExpiresAt: oauthAccounts.consentExpiresAt,
    dataProcessingConsent: oauthAccounts.dataProcessingConsent,
    dataProcessingConsentAt: oauthAccounts.dataProcessingConsentAt,
    lastLoginAt: oauthAccounts.lastLoginAt,
    lastLoginIp: oauthAccounts.lastLoginIp,
    lastLoginUserAgent: oauthAccounts.lastLoginUserAgent,
    loginCount: oauthAccounts.loginCount,
    securityFlags: oauthAccounts.securityFlags,
    createdAt: oauthAccounts.createdAt,
    updatedAt: oauthAccounts.updatedAt,
  } as const,

  admin: {
    id: oauthAccounts.id,
    ownerId: oauthAccounts.ownerId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    providerUsername: oauthAccounts.providerUsername,
    providerAccountEmail: oauthAccounts.providerAccountEmail,
    providerAccountEmailVerified: oauthAccounts.providerAccountEmailVerified,
    status: oauthAccounts.status,
    connectionStatus: oauthAccounts.connectionStatus,
    isActive: oauthAccounts.isActive,
    isPrimary: oauthAccounts.isPrimary,
    isDefault: oauthAccounts.isDefault,
    accessTokenExpiresAt: oauthAccounts.accessTokenExpiresAt,
    refreshTokenExpiresAt: oauthAccounts.refreshTokenExpiresAt,
    tokenStatus: oauthAccounts.tokenStatus,
    scopes: oauthAccounts.scopes,
    consentLevel: oauthAccounts.consentLevel,
    consentGrantedAt: oauthAccounts.consentGrantedAt,
    consentExpiresAt: oauthAccounts.consentExpiresAt,
    dataProcessingConsent: oauthAccounts.dataProcessingConsent,
    dataProcessingConsentAt: oauthAccounts.dataProcessingConsentAt,
    profile: oauthAccounts.profile,
    lastLoginAt: oauthAccounts.lastLoginAt,
    lastLoginIp: oauthAccounts.lastLoginIp,
    lastLoginUserAgent: oauthAccounts.lastLoginUserAgent,
    loginCount: oauthAccounts.loginCount,
    lastConnectedAt: oauthAccounts.lastConnectedAt,
    lastDisconnectedAt: oauthAccounts.lastDisconnectedAt,
    connectionError: oauthAccounts.connectionError,
    retryCount: oauthAccounts.retryCount,
    metadata: oauthAccounts.metadata,
    customFields: oauthAccounts.customFields,
    tags: oauthAccounts.tags,
    deletedAt: oauthAccounts.deletedAt,
    deletedBy: oauthAccounts.deletedBy,
    deletionReason: oauthAccounts.deletionReason,
    createdAt: oauthAccounts.createdAt,
    updatedAt: oauthAccounts.updatedAt,
  } as const,
};
