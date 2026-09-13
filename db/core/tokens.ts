// @/db/schema/auth/tokens.ts
// the popose for this token is for authentication.
// the different types of tokens are:
// - authentication tokens: for authentication.
// - refresh tokens: for authentication.
// - password reset tokens: for password reset.
// - email verification tokens: for email verification.
// - phone verification tokens: for phone verification.
// - email change tokens: for email change.
// - phone change tokens: for phone change.
// - invitation tokens: for invitation poeple to join the platform- users.

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  platformPgEnum,
  revokeReasonPgEnum,
  tokenStatusPgEnum,
  tokenTypePgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { users } from "./users";

export const tokens = pgTable(
  `${tablePrefix}tokens`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // USER OWNERSHIP
    // ============================================
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // ============================================
    // TOKEN IDENTIFICATION & TYPE
    // ============================================
    tokenType: tokenTypePgEnum("token_type").notNull(),

    // For OTP/magic links
    selector: varchar("selector", { length: 32 }).unique(),
    hashedValidator: text("hashed_validator"),

    status: tokenStatusPgEnum("status").notNull().default("active"),

    // ============================================
    // PURPOSE & TARGET
    // ============================================
    purpose: varchar("purpose", { length: 100 }).notNull(),
    targetEmail: varchar("target_email", { length: 255 }),
    targetPhone: varchar("target_phone", { length: 50 }),
    redirectUri: varchar("redirect_uri", { length: 2048 }),

    // ============================================
    // VALIDITY & EXPIRATION
    // ============================================
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    notBefore: timestamp("not_before", { withTimezone: true }),

    // ============================================
    // USAGE TRACKING
    // ============================================
    usedAt: timestamp("used_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),

    // ============================================
    // PLATFORM & DEVICE CONTEXT
    // ============================================
    platform: platformPgEnum("platform"),
    userAgent: text("user_agent"),
    deviceId: varchar("device_id", { length: 255 }),
    fingerprint: varchar("fingerprint", { length: 64 }),

    // ============================================
    // NETWORK CONTEXT
    // ============================================
    ipAddress: text("ip_address"),

    // ============================================
    // SECURITY & REVOCATION
    // ============================================
    deletedBy: varchar("deleted_by", { length: 255 }),
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id),
    revokeReason: revokeReasonPgEnum("revoke_reason"),
    isActive: boolean("is_active").notNull().default(true),

    // ============================================
    // AUTHORIZATION
    // ============================================
    scopes: jsonb("scopes").$type<string[]>().default([]),
    note: text("note"),
    // ============================================
    // TIMESTAMPS
    // ============================================
    ...timestamps,
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================

    uniqueIndex(`${tablePrefix}tokens_selector_unique_idx`)
      .on(table.selector)
      .where(sql`${table.selector} IS NOT NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}tokens_user_id_idx`).on(table.userId),
    index(`${tablePrefix}tokens_token_type_idx`).on(table.tokenType),
    index(`${tablePrefix}tokens_status_idx`).on(table.status),
    index(`${tablePrefix}tokens_purpose_idx`).on(table.purpose),
    index(`${tablePrefix}tokens_expires_at_idx`).on(table.expiresAt),
    index(`${tablePrefix}tokens_is_revoked_idx`).on(table.isRevoked),
    index(`${tablePrefix}tokens_issued_at_idx`).on(table.issuedAt),
    index(`${tablePrefix}tokens_used_at_idx`).on(table.usedAt),
    index(`${tablePrefix}tokens_platform_idx`).on(table.platform),
    index(`${tablePrefix}tokens_device_id_idx`).on(table.deviceId),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================
    index(`${tablePrefix}tokens_active_user_tokens_idx`).on(
      table.userId,
      table.tokenType,
      table.expiresAt,
    ),

    index(`${tablePrefix}tokens_purpose_type_idx`)
      .on(table.purpose, table.tokenType, table.expiresAt)
      .where(sql`
      ${table.isRevoked} = false
      AND ${table.status} = 'active'
    `),

    index(`${tablePrefix}tokens_cleanup_idx`).on(table.expiresAt, table.isRevoked),

    index(`${tablePrefix}tokens_otp_validation_idx`)
      .on(table.selector, table.expiresAt)
      .where(sql`
      ${table.tokenType} IN ('otp', 'magic_link')
      AND ${table.isRevoked} = false
      AND ${table.status} = 'active'
    `),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================
export const tokensRelations = relations(tokens, ({ one }) => ({
  // User who owns this token
  user: one(users, {
    fields: [tokens.userId],
    references: [users.id],
    relationName: "user_tokens",
  }),

  // User who revoked this token (if any)
  revokedByUser: one(users, {
    fields: [tokens.revokedBy],
    references: [users.id],
    relationName: "revoked_tokens",
  }),
}));

// ============================================
// HELPER SELECTORS
// ============================================
export const tokenSelectors = {
  basic: {
    id: tokens.id,
    userId: tokens.userId,
    tokenType: tokens.tokenType,
    purpose: tokens.purpose,
    status: tokens.status,
    issuedAt: tokens.issuedAt,
    expiresAt: tokens.expiresAt,
    isRevoked: tokens.isRevoked,
  } as const,

  validation: {
    id: tokens.id,
    userId: tokens.userId,
    tokenType: tokens.tokenType,
    selector: tokens.selector,
    hashedValidator: tokens.hashedValidator,
    purpose: tokens.purpose,
    status: tokens.status,
    issuedAt: tokens.issuedAt,
    expiresAt: tokens.expiresAt,
    maxUses: tokens.maxUses,
    useCount: tokens.useCount,
    isRevoked: tokens.isRevoked,
    targetEmail: tokens.targetEmail,
    targetPhone: tokens.targetPhone,
    redirectUri: tokens.redirectUri,
  } as const,

  security: {
    id: tokens.id,
    userId: tokens.userId,
    tokenType: tokens.tokenType,
    purpose: tokens.purpose,
    status: tokens.status,
    issuedAt: tokens.issuedAt,
    expiresAt: tokens.expiresAt,
    isRevoked: tokens.isRevoked,
    revokedAt: tokens.revokedAt,
    revokeReason: tokens.revokeReason,
    ipAddress: tokens.ipAddress,
    deviceId: tokens.deviceId,
    platform: tokens.platform,
    userAgent: tokens.userAgent,
  } as const,

  admin: {
    id: tokens.id,
    userId: tokens.userId,
    tokenType: tokens.tokenType,
    selector: tokens.selector,
    purpose: tokens.purpose,
    status: tokens.status,
    issuedAt: tokens.issuedAt,
    expiresAt: tokens.expiresAt,
    notBefore: tokens.notBefore,
    usedAt: tokens.usedAt,
    lastUsedAt: tokens.lastUsedAt,
    maxUses: tokens.maxUses,
    useCount: tokens.useCount,
    platform: tokens.platform,
    deviceId: tokens.deviceId,
    userAgent: tokens.userAgent,
    fingerprint: tokens.fingerprint,
    ipAddress: tokens.ipAddress,
    isRevoked: tokens.isRevoked,
    revokedAt: tokens.revokedAt,
    revokeReason: tokens.revokeReason,
    scopes: tokens.scopes,
    targetEmail: tokens.targetEmail,
    targetPhone: tokens.targetPhone,
    redirectUri: tokens.redirectUri,
    createdAt: tokens.createdAt,
    updatedAt: tokens.updatedAt,
  } as const,
} as const;
