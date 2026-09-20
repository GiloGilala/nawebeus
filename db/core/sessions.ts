// packages/database/schema/auth/sessions.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  deviceTypePgEnum,
  loginMethodPgEnum,
  securityLevelPgEnum,
  sessionStatusPgEnum,
  sessionTypePgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface SessionMetadata {
  sessionName?: string;
  notes?: string;
  tags?: string[];
  theme?: string;
  locale?: string;
  featureFlags?: Record<string, boolean>;
  experiments?: Record<string, string>;
  screenSize?: {
    width: number;
    height: number;
  };
  customFields?: Record<string, unknown>;
}

// ============================================
// SESSIONS TABLE
// ============================================

export const sessions = pgTable(
  `${tablePrefix}sessions`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    // ============================================
    // OWNERSHIP & USER RELATIONSHIP
    // ============================================
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // ============================================
    // IMPERSONATION (Keep but simplified)
    // ============================================
    impersonatedUserId: uuid("impersonated_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    impersonatedByUserId: uuid("impersonated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    impersonationReason: varchar("impersonation_reason", { length: 500 }),
    impersonationApprovedAt: timestamp("impersonation_approved_at", {
      withTimezone: true,
      mode: "date",
    }),
    impersonationApprovedBy: uuid("impersonation_approved_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // SESSION IDENTIFICATION
    // ============================================
    sessionTokenHash: varchar("session_token_hash", { length: 512 }).notNull().unique(),

    sessionTokenSalt: varchar("session_token_salt", { length: 32 }),

    // External session IDs (SSO, OAuth, etc.)
    externalSessionId: varchar("external_session_id", { length: 255 }),
    externalProvider: varchar("external_provider", { length: 100 }),

    // ============================================
    // SESSION CONTEXT & TYPE
    // ============================================
    type: sessionTypePgEnum("type").notNull().default("web"),
    loginMethod: loginMethodPgEnum("login_method").notNull().default("password"),

    identityProvider: varchar("identity_provider", { length: 50 }),
    authFlow: varchar("auth_flow", { length: 100 }),
    rememberMe: boolean("remember_me").notNull().default(false),

    // ============================================
    // SESSION VERSIONING
    // ============================================
    sessionVersion: integer("session_version").default(1).notNull(),

    // ============================================
    // SESSION STATUS & SECURITY
    // ============================================
    status: sessionStatusPgEnum("status").notNull().default("active"),

    // ============================================
    // RISK ASSESSMENT
    // ============================================
    riskScore: integer("risk_score").default(0).notNull(),
    riskLevel: securityLevelPgEnum("risk_level").default("low"),
    riskCalculatedAt: timestamp("risk_calculated_at", {
      withTimezone: true,
      mode: "date",
    }),
    suspiciousActivityDetected: boolean("suspicious_activity_detected").default(false),
    flaggedAt: timestamp("flagged_at", {
      withTimezone: true,
      mode: "date",
    }),
    flagReason: varchar("flag_reason", { length: 500 }),

    // ============================================
    // REVOCATION
    // ============================================
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
    revokedBy: uuid("revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    revocationReason: varchar("revocation_reason", { length: 500 }),
    revocationSource: varchar("revocation_source", { length: 50 }),

    // ============================================
    // SESSION HIERARCHY & ROTATION
    // ============================================
    replacedBySessionId: uuid("replaced_by_session_id").references((): any => sessions.id, {
      onDelete: "set null",
    }),
    parentSessionId: uuid("parent_session_id").references((): any => sessions.id, {
      onDelete: "set null",
    }),

    // Refresh-token single-use rotation tracking
    currentRefreshTokenJti: varchar("current_refresh_token_jti", {
      length: 128,
    }),
    previousRefreshTokenJti: varchar("previous_refresh_token_jti", {
      length: 128,
    }),
    previousRefreshJtiGraceUntil: timestamp("previous_refresh_jti_grace_until", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // DEVICE & PLATFORM INFORMATION
    // ============================================
    deviceType: deviceTypePgEnum("device_type").default("unknown"),
    deviceId: varchar("device_id", { length: 255 }),
    deviceFingerprint: varchar("device_fingerprint", { length: 512 }),
    fingerprintVersion: integer("fingerprint_version").default(1),
    deviceName: varchar("device_name", { length: 200 }),
    deviceModel: varchar("device_model", { length: 200 }),
    deviceOs: varchar("device_os", { length: 100 }),
    deviceOsVersion: varchar("device_os_version", { length: 50 }),

    // ============================================
    // BROWSER & CLIENT INFORMATION
    // ============================================
    userAgent: varchar("user_agent", { length: 500 }),
    browserName: varchar("browser_name", { length: 100 }),
    browserVersion: varchar("browser_version", { length: 50 }),
    // browserEngine REMOVED

    clientId: varchar("client_id", { length: 255 }),
    clientName: varchar("client_name", { length: 255 }),
    clientVersion: varchar("client_version", { length: 50 }),

    // ============================================
    // NETWORK & LOCATION CONTEXT
    // ============================================
    // Nullable: the client IP is genuinely unknown when no forwarding header is
    // present (local dev, some proxies). NOT NULL forced callers to invent a
    // value, and the invented "unknown" is not a valid `inet` at all.
    ipAddress: inet("ip_address"),

    locationCountry: varchar("location_country", { length: 100 }),
    locationRegion: varchar("location_region", { length: 100 }),
    locationCity: varchar("location_city", { length: 100 }),
    // locationCoordinates REMOVED
    timezone: varchar("timezone", { length: 50 }),
    countryCode: varchar("country_code", { length: 2 }),

    isHosting: boolean("is_hosting").default(false),

    // ============================================
    // ACTIVITY & LIFETIME TRACKING
    // ============================================
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    idleTimeoutAt: timestamp("idle_timeout_at", {
      withTimezone: true,
      mode: "date",
    }),
    absoluteTimeoutAt: timestamp("absolute_timeout_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastRefreshAt: timestamp("last_refresh_at", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // SECURITY METADATA
    // ============================================
    mfaVerifiedAt: timestamp("mfa_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    mfaMethod: varchar("mfa_method", { length: 50 }),
    authenticationLevel: varchar("authentication_level", { length: 50 }),

    // ============================================
    // SESSION METADATA
    // ============================================
    sessionName: varchar("session_name"),
    metadata: jsonb("metadata").$type<SessionMetadata>().default(sql`'{}'::jsonb`),
    // maxConcurrentSessions REMOVED

    // ============================================
    // TIMESTAMPS
    // ============================================
    ...timestamps,
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}sessions_token_hash_unique_idx`).on(table.sessionTokenHash),

    uniqueIndex(`${tablePrefix}sessions_external_session_id_unique_idx`)
      .on(table.externalSessionId)
      .where(sql`${table.externalSessionId} IS NOT NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}sessions_user_id_idx`).on(table.userId),
    index(`${tablePrefix}sessions_status_idx`).on(table.status),
    index(`${tablePrefix}sessions_risk_level_idx`).on(table.riskLevel),
    index(`${tablePrefix}sessions_expires_at_idx`).on(table.expiresAt),
    index(`${tablePrefix}sessions_is_revoked_idx`).on(table.isRevoked),
    index(`${tablePrefix}sessions_device_id_idx`).on(table.deviceId),
    index(`${tablePrefix}sessions_ip_address_idx`).on(table.ipAddress),
    index(`${tablePrefix}sessions_client_id_idx`).on(table.clientId),
    index(`${tablePrefix}sessions_external_session_id_idx`).on(table.externalSessionId),
    index(`${tablePrefix}sessions_revoked_by_idx`).on(table.revokedBy),

    // Impersonation indexes
    index(`${tablePrefix}sessions_impersonated_user_idx`).on(table.impersonatedUserId),
    index(`${tablePrefix}sessions_impersonated_by_user_idx`).on(table.impersonatedByUserId),
    index(`${tablePrefix}sessions_impersonation_approved_by_idx`).on(table.impersonationApprovedBy),

    index(`${tablePrefix}sessions_parent_session_idx`).on(table.parentSessionId),
    index(`${tablePrefix}sessions_replaced_by_session_idx`).on(table.replacedBySessionId),
    index(`${tablePrefix}sessions_last_activity_idx`).on(table.lastActivityAt),
    index(`${tablePrefix}sessions_last_refresh_idx`).on(table.lastRefreshAt),
    index(`${tablePrefix}sessions_idle_timeout_idx`).on(table.idleTimeoutAt),
    index(`${tablePrefix}sessions_absolute_timeout_idx`).on(table.absoluteTimeoutAt),
    index(`${tablePrefix}sessions_risk_calculated_idx`).on(table.riskCalculatedAt),
    index(`${tablePrefix}sessions_authentication_level_idx`).on(table.authenticationLevel),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index(`${tablePrefix}sessions_user_active_recent_idx`)
      .on(table.userId, table.status, sql`${table.lastActivityAt} DESC`)
      .where(sql`${table.status} = 'active'`),

    index(`${tablePrefix}sessions_active_sessions_idx`).on(
      table.userId,
      table.status,
      table.expiresAt,
    ),

    index(`${tablePrefix}sessions_user_device_active_idx`)
      .on(table.userId, table.deviceId, table.status)
      .where(sql`${table.status} = 'active'`),

    index(`${tablePrefix}sessions_cleanup_idx`).on(table.expiresAt, table.status),

    index(`${tablePrefix}sessions_user_risk_idx`).on(table.userId, table.riskLevel, table.status),

    index(`${tablePrefix}sessions_user_remember_idx`)
      .on(table.userId, table.rememberMe, table.status)
      .where(sql`
        ${table.rememberMe} = true 
        AND ${table.status} = 'active'
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}sessions_metadata_gin_idx`).using("gin", table.metadata),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  impersonatedUser: one(users, {
    fields: [sessions.impersonatedUserId],
    references: [users.id],
  }),
  impersonatedByUser: one(users, {
    fields: [sessions.impersonatedByUserId],
    references: [users.id],
  }),
  impersonationApprovedByUser: one(users, {
    fields: [sessions.impersonationApprovedBy],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [sessions.revokedBy],
    references: [users.id],
  }),
  replacedBySession: one(sessions, {
    fields: [sessions.replacedBySessionId],
    references: [sessions.id],
    relationName: "sessionReplacement",
  }),
  parentSession: one(sessions, {
    fields: [sessions.parentSessionId],
    references: [sessions.id],
    relationName: "sessionParent",
  }),
  childSessions: many(sessions, {
    relationName: "sessionParent",
  }),
  replacementSessions: many(sessions, {
    relationName: "sessionReplacement",
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionTable = typeof sessions;

// ============================================
// HELPER SELECTORS
// ============================================

export const sessionSelectors = {
  basic: {
    id: sessions.id,
    userId: sessions.userId,
    sessionTokenHash: sessions.sessionTokenHash,
    type: sessions.type,
    status: sessions.status,
    riskLevel: sessions.riskLevel,
    expiresAt: sessions.expiresAt,
    isRevoked: sessions.isRevoked,
    sessionVersion: sessions.sessionVersion,
    authenticationLevel: sessions.authenticationLevel,
  } as const,

  activity: {
    id: sessions.id,
    userId: sessions.userId,
    type: sessions.type,
    expiresAt: sessions.expiresAt,
    userAgent: sessions.userAgent,
    ipAddress: sessions.ipAddress,
    deviceType: sessions.deviceType,
    deviceName: sessions.deviceName,
    lastActivityAt: sessions.lastActivityAt,
    lastRefreshAt: sessions.lastRefreshAt,
  } as const,

  security: {
    id: sessions.id,
    userId: sessions.userId,
    status: sessions.status,
    riskLevel: sessions.riskLevel,
    riskScore: sessions.riskScore,
    riskCalculatedAt: sessions.riskCalculatedAt,
    expiresAt: sessions.expiresAt,
    isRevoked: sessions.isRevoked,
    revokedAt: sessions.revokedAt,
    revokedBy: sessions.revokedBy,
    revocationReason: sessions.revocationReason,
    revocationSource: sessions.revocationSource,
    ipAddress: sessions.ipAddress,
    locationCountry: sessions.locationCountry,
    locationCity: sessions.locationCity,
    deviceFingerprint: sessions.deviceFingerprint,
    fingerprintVersion: sessions.fingerprintVersion,
    userAgent: sessions.userAgent,
    authenticationLevel: sessions.authenticationLevel,
    mfaVerifiedAt: sessions.mfaVerifiedAt,
    mfaMethod: sessions.mfaMethod,
  } as const,

  admin: {
    id: sessions.id,
    userId: sessions.userId,
    impersonatedUserId: sessions.impersonatedUserId,
    impersonatedByUserId: sessions.impersonatedByUserId,
    impersonationReason: sessions.impersonationReason,
    impersonationApprovedAt: sessions.impersonationApprovedAt,
    impersonationApprovedBy: sessions.impersonationApprovedBy,
    sessionTokenHash: sessions.sessionTokenHash,
    type: sessions.type,
    loginMethod: sessions.loginMethod,
    identityProvider: sessions.identityProvider,
    status: sessions.status,
    sessionVersion: sessions.sessionVersion,
    riskLevel: sessions.riskLevel,
    riskScore: sessions.riskScore,
    riskCalculatedAt: sessions.riskCalculatedAt,
    deviceType: sessions.deviceType,
    deviceId: sessions.deviceId,
    deviceName: sessions.deviceName,
    deviceOs: sessions.deviceOs,
    fingerprintVersion: sessions.fingerprintVersion,
    userAgent: sessions.userAgent,
    browserName: sessions.browserName,
    browserVersion: sessions.browserVersion,
    ipAddress: sessions.ipAddress,
    locationCountry: sessions.locationCountry,
    locationCity: sessions.locationCity,
    expiresAt: sessions.expiresAt,
    isRevoked: sessions.isRevoked,
    revokedAt: sessions.revokedAt,
    revokedBy: sessions.revokedBy,
    revocationReason: sessions.revocationReason,
    revocationSource: sessions.revocationSource,
    replacedBySessionId: sessions.replacedBySessionId,
    parentSessionId: sessions.parentSessionId,
    mfaVerifiedAt: sessions.mfaVerifiedAt,
    mfaMethod: sessions.mfaMethod,
    authenticationLevel: sessions.authenticationLevel,
    lastActivityAt: sessions.lastActivityAt,
    lastRefreshAt: sessions.lastRefreshAt,
    createdAt: sessions.createdAt,
    updatedAt: sessions.updatedAt,
  } as const,

  impersonation: {
    id: sessions.id,
    userId: sessions.userId,
    impersonatedUserId: sessions.impersonatedUserId,
    impersonatedByUserId: sessions.impersonatedByUserId,
    impersonationReason: sessions.impersonationReason,
    impersonationApprovedAt: sessions.impersonationApprovedAt,
    impersonationApprovedBy: sessions.impersonationApprovedBy,
    status: sessions.status,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
  } as const,

  lifecycle: {
    id: sessions.id,
    userId: sessions.userId,
    status: sessions.status,
    expiresAt: sessions.expiresAt,
    idleTimeoutAt: sessions.idleTimeoutAt,
    absoluteTimeoutAt: sessions.absoluteTimeoutAt,
    lastActivityAt: sessions.lastActivityAt,
    lastRefreshAt: sessions.lastRefreshAt,
    isRevoked: sessions.isRevoked,
    revokedAt: sessions.revokedAt,
    revocationSource: sessions.revocationSource,
    createdAt: sessions.createdAt,
  } as const,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a session is currently active
 */
export function isSessionActive(session: Session): boolean {
  return session.status === "active" && !session.isRevoked && session.expiresAt > new Date();
}

/**
 * Check if a session is an impersonation session
 */
export function isImpersonationSession(session: Session): boolean {
  return !!session.impersonatedUserId && !!session.impersonatedByUserId;
}

/**
 * Check if a session needs refreshing
 */
export function needsRefresh(
  session: Session,
  refreshThresholdMs: number = 5 * 60 * 1000, // 5 minutes default
): boolean {
  if (!session.lastRefreshAt) return true;
  return Date.now() - session.lastRefreshAt.getTime() > refreshThresholdMs;
}

/**
 * Get the authentication assurance level
 */
export function getAuthAssuranceLevel(session: Session): string {
  if (session.authenticationLevel) return session.authenticationLevel;
  if (session.mfaVerifiedAt) return "mfa";
  return "password";
}

/**
 * Check if session is at risk
 */
export function isSessionAtRisk(session: Session): boolean {
  return (
    session.riskLevel === "critical" ||
    session.riskLevel === "high" ||
    session.suspiciousActivityDetected ||
    session.isRevoked
  );
}

/**
 * Generate a session display name
 */
export function getSessionDisplayName(session: Session): string {
  if (session.sessionName) return session.sessionName;
  if (session.deviceName) return session.deviceName;
  if (session.browserName) {
    return `${session.browserName}${session.deviceOs ? ` on ${session.deviceOs}` : ""}`;
  }
  return `Session ${session.id.slice(0, 8)}`;
}

/**
 * Check if a session has valid impersonation approval
 */
export function isImpersonationApproved(session: Session): boolean {
  if (!isImpersonationSession(session)) return false;
  if (!session.impersonationApprovedAt) return false;
  if (session.status !== "active") return false;
  if (session.isRevoked) return false;

  // Check if approval is still valid (e.g., within 24 hours)
  const approvalAge = Date.now() - session.impersonationApprovedAt.getTime();
  const maxApprovalAge = 24 * 60 * 60 * 1000; // 24 hours
  return approvalAge < maxApprovalAge;
}
