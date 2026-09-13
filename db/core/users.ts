// @/db/schemas/users.ts

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
import type { TrustedDevice } from "@/server/auth/types/auth-types";
import { organizationMembers } from "../organization/organization-members";
import { organizations } from "../organization/organizations";
import {
  pgUserThemeEnum,
  profileVisibilityPgEnum,
  roleValueTypePgEnum,
  subscriptionPlanPgEnum,
  userStatusPgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { roles } from "./roles";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface UserOnboardingData {
  completedSteps: string[];
  skippedSteps: string[];
  completedAt?: string;
  toursSeen: string[];
}

export interface UserSecurityQuestions {
  question1?: { question: string; answer: string };
  question2?: { question: string; answer: string };
  question3?: { question: string; answer: string };
}

export interface UserCookieConsent {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export interface UserMetadata {
  source?: string;
  referrer?: string;
  campaign?: string;
  medium?: string;
  customFields?: Record<string, unknown>;
}

// ============================================
// USERS TABLE
// ============================================

export const users = pgTable(
  `${tablePrefix}users`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // MULTI-TENANCY
    // ============================================
    organizationId: uuid("organization_id").references((): any => organizations.id, {
      onDelete: "set null",
    }),

    // ============================================
    // AUTHENTICATION & IDENTITY
    // ============================================
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 255 }).unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    password: varchar("password", { length: 255 }).notNull(),
    passwordHistory: jsonb("password_history").$type<string[]>().default(sql`'[]'::jsonb`),
    username: varchar("username", { length: 50 }).notNull(),
    phoneVerified: boolean("phone_verified").notNull().default(false),

    // Two-factor authentication
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
    twoFactorBackupCodes: jsonb("two_factor_backup_codes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),

    // Security tracking
    loginCount: integer("login_count").notNull().default(0),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", {
      withTimezone: true,
      mode: "date",
    }),
    lastLoginIp: inet("last_login_ip"), // NEW
    lastLoginCountry: varchar("last_login_country", { length: 100 }), // NEW
    lastLoginUserAgent: varchar("last_login_user_agent", { length: 500 }), // NEW

    // Device management
    trustedDevices: jsonb("trusted_devices").$type<TrustedDevice[]>().default(sql`'[]'::jsonb`),

    // ============================================
    // PROFILE & PERSONALIZATION
    // ============================================
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    profileImage: text("profile_image"),

    // Preferences
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
    locale: varchar("locale", { length: 10 }).default("en-NG").notNull(),
    settingsId: uuid("settings_id"),

    // ============================================
    // STATUS & PERMISSIONS
    // ============================================
    status: userStatusPgEnum().notNull().default("pending_verification"),

    // Onboarding
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    onboardingData: jsonb("onboarding_data").$type<UserOnboardingData>().default(sql`'{}'::jsonb`),

    // ----------------------------------------------------------------
    // ROLE & PERMISSION SIGNALS — READ BEFORE TOUCHING
    //
    // There are three role/permission-related fields below. They are
    // NOT redundant copies of the same thing; they serve different
    // purposes and have different write rules:
    //
    //   1. `roleId`  — FK snapshot of the user's PRIMARY role, kept in
    //                  sync with the single `userRoles` row where
    //                  isPrimary = true. Fast path for "what's this
    //                  user's main role" without a join. Written ONLY
    //                  by the role-assignment service, never directly.
    //
    //   2. `role`    — coarse enum (owner/admin/user/etc) used for
    //                  cheap UI gating and route guards BEFORE the
    //                  full permission system loads. This is a
    //                  simplification, not a source of truth for
    //                  authorization decisions.
    //
    //   3. `permissions` (jsonb string[]) — DERIVED CACHE of the
    //                  user's effective permission strings, rebuilt by
    //                  resolveEffectivePermissions() whenever this
    //                  user's `userRoles` row or that role's
    //                  `rolePermissions` change. Never write to this
    //                  directly from business logic; treat it as
    //                  read-only outside the auth service.
    //
    // The actual source of truth for "can this user do X" is always
    // the join: userRoles -> rolePermissions. There is no per-user
    // direct-grant table by design — a user who needs a permission
    // their role doesn't have should get a new/adjusted role, not a
    // one-off grant. See @/db/schemas/auth/permissions.ts
    // ----------------------------------------------------------------
    roleId: uuid("role_id").references((): any => roles.id, {
      onDelete: "set null",
    }),

    role: roleValueTypePgEnum().default("user").notNull(),
    permissions: jsonb("permissions").$type<string[]>().default(sql`'[]'::jsonb`),
    restrictions: jsonb("restrictions").$type<string[]>().default(sql`'[]'::jsonb`),

    subscriptionPlan: subscriptionPlanPgEnum().default("free").notNull(),
    subscriptionStatus: varchar("subscription_status", { length: 50 }),
    subscriptionExpiresAt: timestamp("subscription_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Privacy settings
    profileVisibility: profileVisibilityPgEnum().default("public").notNull(),
    allowDirectMessages: boolean("allow_direct_messages").default(true).notNull(),

    // ============================================
    // ACTIVITY TRACKING
    // ============================================
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastActiveAt: timestamp("last_active_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastPasswordChangeAt: timestamp("last_password_change_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastEmailChangeAt: timestamp("last_email_change_at", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // SECURITY & COMPLIANCE
    // ============================================
    termsAcceptedAt: timestamp("terms_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    privacyAcceptedAt: timestamp("privacy_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    marketingConsentAt: timestamp("marketing_consent_at", {
      withTimezone: true,
      mode: "date",
    }),

    newsletterSubscribed: boolean("newsletter_subscribed").default(false),

    // Analytics
    referralSource: varchar("referral_source", { length: 255 }),
    referralCode: varchar("referral_code", { length: 50 }).unique(),
    referredBy: uuid("referred_by").references((): any => users.id, {
      onDelete: "set null",
    }),

    // Stored in smallest currency unit (kobo/cents)
    totalEarnings: integer("total_earnings").notNull().default(0),

    // Security metadata
    securityQuestions: jsonb("security_questions")
      .$type<UserSecurityQuestions>()
      .default(sql`'{}'::jsonb`),
    ipHistory: jsonb("ip_history").$type<string[]>().default(sql`'[]'::jsonb`),
    userAgentHistory: jsonb("user_agent_history").$type<string[]>().default(sql`'[]'::jsonb`),
    accountLockedUntil: timestamp("account_locked_until", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // LEGAL & COMPLIANCE
    // ============================================
    dataProcessingConsent: boolean("data_processing_consent").default(false),
    marketingConsent: boolean("marketing_consent").default(false),
    consentUpdatedAt: timestamp("consent_updated_at", {
      withTimezone: true,
      mode: "date",
    }),
    cookieConsent: jsonb("cookie_consent").$type<UserCookieConsent>().default(sql`'{}'::jsonb`),
    gdprConsentAt: timestamp("gdpr_consent_at", {
      withTimezone: true,
      mode: "date",
    }),
    themePreference: pgUserThemeEnum().notNull().default("system"),

    // ============================================
    // CUSTOM DATA & METADATA
    // ============================================
    pushTokens: jsonb("push_tokens").$type<string[]>().default(sql`'[]'::jsonb`),

    metadata: jsonb("metadata").$type<UserMetadata>().default(sql`'{}'::jsonb`),

    // ============================================
    // SOFT DELETE & TIMESTAMPS
    // ============================================
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    updatedBy: varchar("updated_by", { length: 255 }),

    // Timestamps
    ...timestamps,
  },
  (table) => [
    // Unique indexes with soft delete consideration
    uniqueIndex(`${tablePrefix}users_email_unique_idx`)
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}users_username_unique_idx`)
      .on(table.username)
      .where(sql`${table.deletedAt} IS NULL AND ${table.username} IS NOT NULL`),

    uniqueIndex(`${tablePrefix}users_phone_unique_idx`)
      .on(table.phone)
      .where(sql`${table.phone} IS NOT NULL AND ${table.deletedAt} IS NULL`), // FIXED: Added phone unique index

    uniqueIndex(`${tablePrefix}users_referral_code_unique_idx`)
      .on(table.referralCode)
      .where(sql`${table.referralCode} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    // Performance indexes
    index(`${tablePrefix}users_status_idx`).on(table.status),
    index(`${tablePrefix}users_email_verified_idx`).on(table.emailVerified),
    index(`${tablePrefix}users_last_active_at_idx`).on(table.lastActiveAt),
    index(`${tablePrefix}users_created_at_idx`).on(table.createdAt),
    index(`${tablePrefix}users_deleted_at_idx`).on(table.deletedAt),
    index(`${tablePrefix}users_organization_idx`).on(table.organizationId),
    index(`${tablePrefix}users_role_idx`).on(table.roleId),
    index(`${tablePrefix}users_last_login_ip_idx`).on(table.lastLoginIp), // NEW

    // Subscription indexes
    index(`${tablePrefix}users_subscription_plan_idx`).on(table.subscriptionPlan),
    index(`${tablePrefix}users_subscription_status_idx`).on(table.subscriptionStatus),
    index(`${tablePrefix}users_subscription_expires_idx`).on(table.subscriptionExpiresAt),

    // Composite indexes for common queries
    index(`${tablePrefix}users_status_active_idx`)
      .on(table.status, table.deletedAt)
      .where(sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`),

    // FIXED: organization_status_deleted composite index
    index(`${tablePrefix}users_org_status_deleted_idx`)
      .on(table.organizationId, table.status, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}users_role_org_idx`)
      .on(table.roleId, table.organizationId, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // New composite index for login tracking
    index(`${tablePrefix}users_login_tracking_idx`)
      .on(table.lastLoginAt, table.lastLoginIp)
      .where(sql`${table.deletedAt} IS NULL`),

    // JSONB GIN indexes
    index(`${tablePrefix}users_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}users_permissions_gin_idx`)
      .using("gin", table.permissions)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}users_trusted_devices_gin_idx`)
      .using("gin", table.trustedDevices)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}users_restrictions_gin_idx`)
      .using("gin", table.restrictions)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// RELATIONSHIPS (FIXED)
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  referredByUser: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [users.deletedBy],
    references: [users.id],
  }),
  referrals: many(users, {
    relationName: "referredBy",
  }),
  memberships: many(organizationMembers),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserTable = typeof users;

// ============================================
// USER SELECTORS
// ============================================

export const userSelectors = {
  // Basic safe user data (for public display)
  basic: {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    profileImage: users.profileImage,
    firstName: users.firstName,
    lastName: users.lastName,
  } as const,

  // Safe profile data (for user profiles)
  profile: {
    id: users.id,
    email: users.email,
    username: users.username,
    firstName: users.firstName,
    lastName: users.lastName,
    displayName: users.displayName,
    profileImage: users.profileImage,
    timezone: users.timezone,
    locale: users.locale,
    createdAt: users.createdAt,
    lastActiveAt: users.lastActiveAt,
  } as const,

  // Full safe user data (excludes sensitive fields)
  safe: {
    id: users.id,
    email: users.email,
    username: users.username,
    firstName: users.firstName,
    lastName: users.lastName,
    displayName: users.displayName,
    profileImage: users.profileImage,
    timezone: users.timezone,
    locale: users.locale,
    status: users.status,
    emailVerified: users.emailVerified,
    twoFactorEnabled: users.twoFactorEnabled,
    onboardingCompleted: users.onboardingCompleted,
    onboardingStep: users.onboardingStep,
    lastLoginAt: users.lastLoginAt,
    lastLoginIp: users.lastLoginIp,
    lastLoginCountry: users.lastLoginCountry,
    lastActiveAt: users.lastActiveAt,
    loginCount: users.loginCount,
    termsAcceptedAt: users.termsAcceptedAt,
    privacyAcceptedAt: users.privacyAcceptedAt,
    settingsId: users.settingsId,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  } as const,

  // Authentication data (for login/verification)
  auth: {
    id: users.id,
    email: users.email,
    password: users.password,
    username: users.username,
    status: users.status,
    emailVerified: users.emailVerified,
    twoFactorEnabled: users.twoFactorEnabled,
    twoFactorSecret: users.twoFactorSecret,
    twoFactorBackupCodes: users.twoFactorBackupCodes,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
    deletedAt: users.deletedAt,
    lastLoginIp: users.lastLoginIp,
  } as const,

  // Security audit data
  security: {
    id: users.id,
    email: users.email,
    status: users.status,
    lastLoginAt: users.lastLoginAt,
    lastLoginIp: users.lastLoginIp,
    lastLoginCountry: users.lastLoginCountry,
    lastLoginUserAgent: users.lastLoginUserAgent,
    lastActiveAt: users.lastActiveAt,
    loginCount: users.loginCount,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
    twoFactorEnabled: users.twoFactorEnabled,
    accountLockedUntil: users.accountLockedUntil,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  } as const,

  // Admin view (includes all non-sensitive data)
  admin: {
    id: users.id,
    email: users.email,
    phone: users.phone,
    username: users.username,
    firstName: users.firstName,
    lastName: users.lastName,
    displayName: users.displayName,
    profileImage: users.profileImage,
    timezone: users.timezone,
    locale: users.locale,
    status: users.status,
    emailVerified: users.emailVerified,
    phoneVerified: users.phoneVerified,
    twoFactorEnabled: users.twoFactorEnabled,
    onboardingCompleted: users.onboardingCompleted,
    onboardingStep: users.onboardingStep,
    lastLoginAt: users.lastLoginAt,
    lastLoginIp: users.lastLoginIp,
    lastLoginCountry: users.lastLoginCountry,
    lastLoginUserAgent: users.lastLoginUserAgent,
    lastActiveAt: users.lastActiveAt,
    loginCount: users.loginCount,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
    accountLockedUntil: users.accountLockedUntil,
    termsAcceptedAt: users.termsAcceptedAt,
    privacyAcceptedAt: users.privacyAcceptedAt,
    marketingConsentAt: users.marketingConsentAt,
    newsletterSubscribed: users.newsletterSubscribed,
    referralSource: users.referralSource,
    referralCode: users.referralCode,
    referredBy: users.referredBy,
    totalEarnings: users.totalEarnings,
    subscriptionPlan: users.subscriptionPlan,
    subscriptionStatus: users.subscriptionStatus,
    subscriptionExpiresAt: users.subscriptionExpiresAt,
    metadata: users.metadata,
    deletedAt: users.deletedAt,
    deletedBy: users.deletedBy,
    deletionReason: users.deletionReason,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  } as const,
};
