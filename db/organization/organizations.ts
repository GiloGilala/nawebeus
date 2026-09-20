// @/db/schemas/auth/organizations.ts

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
import type { OrganizationBillingAddress } from "@/server/organization/types/organization-type";
import { roles } from "../core/roles";
import { users } from "../core/users";
import { industryPgEnum, organizationStatusPgEnum, organizationTypePgEnum } from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { organizationMembers } from "./organization-members";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface OrganizationWhitelabel {
  enabled?: boolean;
  brandName?: string;
  supportEmail?: string;
  customCss?: string;
  hideNawebeusBranding?: boolean;
  logo?: string;
  logoDark?: string;
  logoLight?: string;
  primaryColor?: string;
  secondaryColor?: string;
  favicon?: string;
}

export interface OrganizationSetupData {
  completedSteps: string[];
  skippedSteps: string[];
  completedAt?: string;
  toursSeen: string[];
  setupCompleted?: boolean;
  setupStep?: number;
}

export interface OrganizationSocialLinks {
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  pinterest?: string;
  github?: string;
  website?: string;
}

export interface OrganizationAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface OrganizationPlatformStats {
  connectedAccounts: number;
  totalFollowers: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  postsPublished: number;
  activePlatforms: string[];
  lastSync: string | null;
}

export interface OrganizationIntegration {
  [key: string]: unknown;
}

export interface OrganizationTeamStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  admins: number;
  managers: number;
  members: number;
  guests: number;
  lastUpdated: string;
}

export interface OrganizationContentStats {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  totalEngagements: number;
  averageEngagementRate: number;
}

export interface OrganizationCollaborationSettings {
  requireApprovalForPosts: boolean;
  allowMemberInvites: boolean;
  defaultMemberRole: string;
  allowExternalSharing: boolean;
  requireTwoFactorAuth: boolean;
  sessionTimeout: number;
  requireEmailVerification: boolean;
  approvalWorkflows: {
    contentPublishing: boolean;
    userInvitations: boolean;
    budgetChanges: boolean;
    settingsChanges: boolean;
  };
  notificationDefaults: {
    emailDigest: boolean;
    realTimeAlerts: boolean;
    weeklyReports: boolean;
    mentionNotifications: boolean;
  };
}

/**
 * USER PREFERENCES (UI/UX defaults)
 * These are user experience defaults, NOT security enforcement policies
 */
export interface OrganizationPreferences {
  timezone: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: number;
  currency: string;
  branding: Record<string, unknown>;
  notifications: {
    email: boolean;
    push: boolean;
    slack: boolean;
    webhook: boolean;
    channels: {
      generalUpdates: boolean;
      securityAlerts: boolean;
      teamActivity: boolean;
      contentAlerts: boolean;
      analyticsReports: boolean;
      complianceAlerts: boolean;
    };
    frequency: string;
    digestSchedule: {
      day: number;
      time: string;
      timezone: string;
    };
  };
  content: {
    defaultPublishingWorkflow: string;
    defaultPostVisibility: string;
    linkShortening: boolean;
    utmTracking: boolean;
    defaultUTMParams: {
      source: string;
      medium: string;
    };
    autoSchedule: boolean;
    scheduleDensity: string;
    contentCalendarView: string;
  };
  analytics: {
    defaultMetrics: string[];
    reportFrequency: string;
    reportFormat: string;
    dashboardLayout: string;
    kpis: string[];
    benchmarkComparison: boolean;
    anomalyDetection: boolean;
  };
  // Preferences only - security enforcement moved to securitySettings
  security: {
    sessionManagement: {
      rememberMeEnabled: boolean;
      rememberMeDuration: number;
      concurrentSessions: number;
      deviceFingerprinting: boolean;
    };
  };
  integrations: {
    defaultApiRateLimit: number;
    webhookRetryPolicy: {
      maxAttempts: number;
      backoffMultiplier: number;
      timeout: number;
    };
    syncFrequency: {
      socialAccounts: number;
      analytics: number;
      content: number;
    };
  };
}

export interface OrganizationPrivacySettings {
  allowDataProcessing: boolean;
  allowAnalytics: boolean;
  allowThirdPartyIntegrations: boolean;
  allowDataSharing: boolean;
  allowMarketingEmails: boolean;
  dataRetentionDays: number;
  rightToBeForgotten: boolean;
  dataPortability: boolean;
  consentManagement: boolean;
}

/**
 * SECURITY POLICIES (Enforcement)
 * These are enforcement policies, NOT user preferences
 */
export interface OrganizationSecuritySettings {
  requireMFAForAdmins: boolean;
  requireMFAForAll: boolean;
  allowedMfaMethods: string[];
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    historySize: number;
  };
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  autoLogoutInactiveMinutes: number;
  rememberMeEnabled: boolean;
  rememberMeDurationDays: number;
  roleBasedAccessControl: boolean;
  permissionGranularity: string;
  defaultPermissions: string[];
  auditLogRetentionDays: number;
  logAllApiCalls: boolean;
  logAllUserActions: boolean;
  realTimeMonitoring: boolean;
  anomalyDetection: boolean;
  alerting: {
    enabled: boolean;
    channels: string[];
    thresholds: Record<string, unknown>;
  };
  dataEncryption: {
    atRest: boolean;
    inTransit: boolean;
    algorithm: string;
    keyManagement: string;
  };
  dataLossPrevention: boolean;
  backupFrequency: string;
  backupRetentionDays: number;
  complianceFrameworks: string[];
  securityCertifications: string[];
  regularSecurityAudits: boolean;
  penetrationTesting: boolean;
  incidentResponsePlan: boolean;
}

// ============================================
// DEFAULT VALUES - Now actually used
// ============================================

export const collaborationSettingsDefault = (): OrganizationCollaborationSettings => ({
  requireApprovalForPosts: false,
  allowMemberInvites: true,
  defaultMemberRole: "member",
  allowExternalSharing: false,
  requireTwoFactorAuth: false,
  sessionTimeout: 1440,
  requireEmailVerification: true,
  approvalWorkflows: {
    contentPublishing: false,
    userInvitations: false,
    budgetChanges: true,
    settingsChanges: true,
  },
  notificationDefaults: {
    emailDigest: true,
    realTimeAlerts: true,
    weeklyReports: true,
    mentionNotifications: true,
  },
});

export const preferencesDefault = (): OrganizationPreferences => ({
  timezone: "UTC",
  locale: "en-US",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  weekStartsOn: 0,
  currency: "USD",
  branding: {},
  notifications: {
    email: true,
    push: false,
    slack: false,
    webhook: false,
    channels: {
      generalUpdates: true,
      securityAlerts: true,
      teamActivity: false,
      contentAlerts: true,
      analyticsReports: true,
      complianceAlerts: true,
    },
    frequency: "daily",
    digestSchedule: {
      day: 0,
      time: "09:00",
      timezone: "UTC",
    },
  },
  content: {
    defaultPublishingWorkflow: "direct",
    defaultPostVisibility: "public",
    linkShortening: true,
    utmTracking: true,
    defaultUTMParams: {
      source: "nawebeus",
      medium: "social",
    },
    autoSchedule: false,
    scheduleDensity: "medium",
    contentCalendarView: "week",
  },
  analytics: {
    defaultMetrics: ["engagement", "reach", "impressions", "clicks"],
    reportFrequency: "weekly",
    reportFormat: "pdf",
    dashboardLayout: "default",
    kpis: [],
    benchmarkComparison: false,
    anomalyDetection: false,
  },
  security: {
    sessionManagement: {
      rememberMeEnabled: true,
      rememberMeDuration: 30,
      concurrentSessions: 5,
      deviceFingerprinting: true,
    },
  },
  integrations: {
    defaultApiRateLimit: 1000,
    webhookRetryPolicy: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      timeout: 30,
    },
    syncFrequency: {
      socialAccounts: 60,
      analytics: 360,
      content: 30,
    },
  },
});

export const privacySettingsDefault = (): OrganizationPrivacySettings => ({
  allowDataProcessing: true,
  allowAnalytics: true,
  allowThirdPartyIntegrations: true,
  allowDataSharing: false,
  allowMarketingEmails: false,
  dataRetentionDays: 730,
  rightToBeForgotten: true,
  dataPortability: true,
  consentManagement: true,
});

export const securitySettingsDefault = (): OrganizationSecuritySettings => ({
  requireMFAForAdmins: false,
  requireMFAForAll: false,
  allowedMfaMethods: ["app", "sms", "email"],
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    historySize: 5,
  },
  sessionTimeoutMinutes: 1440,
  maxConcurrentSessions: 5,
  autoLogoutInactiveMinutes: 60,
  rememberMeEnabled: true,
  rememberMeDurationDays: 30,
  roleBasedAccessControl: true,
  permissionGranularity: "basic",
  defaultPermissions: [
    "view:profile",
    "view:dashboard",
    "view:analytics",
    "view:posts",
    "view:drafts",
    "create:posts",
    "create:drafts",
    "edit:posts",
    "edit:profile",
    "delete:posts",
    "delete:drafts",
    "manage:settings",
  ],
  auditLogRetentionDays: 365,
  logAllApiCalls: true,
  logAllUserActions: false,
  realTimeMonitoring: false,
  anomalyDetection: false,
  alerting: {
    enabled: false,
    channels: ["email"],
    thresholds: {},
  },
  dataEncryption: {
    atRest: true,
    inTransit: true,
    algorithm: "AES-256-GCM",
    keyManagement: "managed",
  },
  dataLossPrevention: false,
  backupFrequency: "daily",
  backupRetentionDays: 90,
  complianceFrameworks: [],
  securityCertifications: [],
  regularSecurityAudits: false,
  penetrationTesting: false,
  incidentResponsePlan: false,
});

// ============================================
// ORGANIZATIONS TABLE
// ============================================

export const organizations = pgTable(
  `${tablePrefix}organizations`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().default(sql`gen_random_uuid()`),

    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    displayName: varchar("display_name", { length: 200 }),

    // ============================================
    // PROFILE & BRANDING
    // ============================================
    logoUrl: varchar("logo_url", { length: 2048 }),
    iconUrl: varchar("icon_url", { length: 2048 }),
    coverImageUrl: varchar("cover_image_url", { length: 2048 }),

    description: text("description"),
    tagline: varchar("tagline", { length: 200 }),

    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    website: varchar("website", { length: 255 }),

    address: jsonb("address").$type<OrganizationAddress>().default(sql`'{}'::jsonb`),
    billingAddress: jsonb("billing_address")
      .$type<OrganizationBillingAddress>()
      .default(sql`'{}'::jsonb`),

    socialLinks: jsonb("social_links").$type<OrganizationSocialLinks>().default(sql`'{}'::jsonb`),

    language: varchar("language", { length: 10 }).default("en-NG").notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ============================================
    // CLASSIFICATION
    // ============================================
    type: organizationTypePgEnum("type").notNull().default("team"),
    industry: industryPgEnum("industry"),
    companySize: varchar("company_size", { length: 20 }),
    foundedYear: integer("founded_year"),
    taxId: varchar("tax_id", { length: 100 }),

    // ============================================
    // STATUS & LIFECYCLE
    // ============================================
    status: organizationStatusPgEnum("status").notNull().default("pending"),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "date",
    }),

    setupData: jsonb("setup_data").$type<OrganizationSetupData>().default(sql`'{}'::jsonb`),

    // ============================================
    // OWNERSHIP & HIERARCHY
    // ============================================
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // Nullable + `set null`, matching every other attribution column in the
    // schema (25+ `*_by` FKs all use `onDelete: "set null"`): a purged user's
    // id must not block their own erasure. With `restrict` here (as shipped),
    // hard-deleting an organization's creator died on 23503 even after
    // ownership had moved on — found while landing F-25 (NWB-P0-025). A NULL
    // creator means "erased or not recorded". `owner_id` above stays
    // NOT NULL + `restrict` on purpose: an organization must have an owner,
    // and `deleteAccount` refuses current owners outright (D16).
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

    parentOrganizationId: uuid("parent_organization_id").references((): any => organizations.id, {
      onDelete: "set null",
    }),

    isParent: boolean("is_parent").notNull().default(false),

    customDomain: varchar("custom_domain", { length: 255 }).unique(),
    customDomainVerified: boolean("custom_domain_verified").default(false),

    // Consolidated whitelabel settings
    whitelabel: jsonb("whitelabel").$type<OrganizationWhitelabel>().default(sql`'{}'::jsonb`),

    // ============================================
    // TEAM & COLLABORATION
    // ============================================
    // NOTE: These are CACHED analytics values, NOT source of truth
    // Recalculated periodically from organization_members table
    teamStats: jsonb("team_stats").$type<OrganizationTeamStats>().default(sql`'{}'::jsonb`),

    collaborationSettings: jsonb("collaboration_settings")
      .$type<OrganizationCollaborationSettings>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // PREFERENCES & SETTINGS
    // ============================================
    // UI/UX preferences - user experience defaults
    preferences: jsonb("preferences")
      .$type<OrganizationPreferences>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // INTEGRATIONS
    // ============================================
    integrations: jsonb("integrations").$type<OrganizationIntegration>().default(sql`'{}'::jsonb`),

    // ============================================
    // ACTIVITY & ENGAGEMENT
    // ============================================
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastActivityType: varchar("last_activity_type", { length: 100 }),
    activityScore: integer("activity_score").notNull().default(0),
    engagementScore: integer("engagement_score").notNull().default(0),
    growthScore: integer("growth_score").notNull().default(0),

    // NOTE: These are CACHED analytics values, NOT source of truth
    // Recalculated periodically from social accounts and content tables
    platformStats: jsonb("platform_stats")
      .$type<OrganizationPlatformStats>()
      .default(sql`'{}'::jsonb`),

    // NOTE: These are CACHED analytics values, NOT source of truth
    // Recalculated periodically from content tables
    contentStats: jsonb("content_stats")
      .$type<OrganizationContentStats>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // COMPLIANCE & LEGAL
    // ============================================
    termsAcceptedAt: timestamp("terms_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    termsVersion: varchar("terms_version", { length: 20 }),
    dataProcessingAgreementAcceptedAt: timestamp("dpa_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    dataProcessingAgreementVersion: varchar("dpa_version", { length: 20 }),
    privacyPolicyAcceptedAt: timestamp("privacy_policy_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    privacyPolicyVersion: varchar("privacy_policy_version", { length: 20 }),
    cookieConsentAcceptedAt: timestamp("cookie_consent_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    cookieConsentVersion: varchar("cookie_consent_version", { length: 20 }),

    dataResidency: varchar("data_residency", { length: 50 }).default("US"),
    dataProcessingLocation: varchar("data_processing_location", { length: 50 }),
    dataBackupLocation: varchar("data_backup_location", { length: 50 }),

    privacySettings: jsonb("privacy_settings")
      .$type<OrganizationPrivacySettings>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // SECURITY POLICIES (Enforcement)
    // ============================================
    securitySettings: jsonb("security_settings")
      .$type<OrganizationSecuritySettings>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // METADATA & TAGS
    // ============================================
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),

    internalNotes: text("internal_notes"),
    publicNotes: text("public_notes"),

    // ============================================
    // HEALTH & RISK SCORES
    // ============================================
    // NOTE: These are COMPUTED scores, NOT manually set
    // Algorithm version should be tracked
    healthScore: integer("health_score").default(50),
    healthScoreVersion: varchar("health_score_version", { length: 20 }),
    healthScoreCalculatedAt: timestamp("health_score_calculated_at", {
      withTimezone: true,
      mode: "date",
    }),

    riskLevel: varchar("risk_level", { length: 20 }).default("low"),
    riskLevelCalculatedAt: timestamp("risk_level_calculated_at", {
      withTimezone: true,
      mode: "date",
    }),

    churnRisk: integer("churn_risk").default(0),
    churnRiskCalculatedAt: timestamp("churn_risk_calculated_at", {
      withTimezone: true,
      mode: "date",
    }),

    customerTier: varchar("customer_tier", { length: 20 }).default("standard"),

    // ============================================
    // TIMESTAMPS & GDPR/DATA LIFECYCLE
    // ============================================
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deletionReason: text("deletion_reason"),

    scheduledDeletionAt: timestamp("scheduled_deletion_at", {
      withTimezone: true,
      mode: "date",
    }),
    dataExportRequestedAt: timestamp("data_export_requested_at", {
      withTimezone: true,
      mode: "date",
    }),
    dataExportCompletedAt: timestamp("data_export_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    dataAnonymizedAt: timestamp("data_anonymized_at", {
      withTimezone: true,
      mode: "date",
    }),
    dataArchivedAt: timestamp("data_archived_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}organizations_slug_unique_idx`)
      .on(table.slug)
      .where(sql`${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}organizations_email_unique_idx`)
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}organizations_custom_domain_unique_idx`)
      .on(table.customDomain)
      .where(sql`${table.customDomain} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}organizations_name_idx`).on(table.name),
    index(`${tablePrefix}organizations_slug_idx`).on(table.slug),

    index(`${tablePrefix}organizations_status_idx`).on(table.status),
    index(`${tablePrefix}organizations_is_active_idx`).on(table.isActive),
    index(`${tablePrefix}organizations_is_verified_idx`).on(table.isVerified),

    index(`${tablePrefix}organizations_type_idx`).on(table.type),
    index(`${tablePrefix}organizations_industry_idx`).on(table.industry),
    index(`${tablePrefix}organizations_company_size_idx`).on(table.companySize),

    index(`${tablePrefix}organizations_owner_idx`).on(table.ownerId),
    index(`${tablePrefix}organizations_created_by_idx`).on(table.createdBy),
    index(`${tablePrefix}organizations_parent_org_idx`).on(table.parentOrganizationId),
    index(`${tablePrefix}organizations_is_parent_idx`).on(table.isParent),

    index(`${tablePrefix}organizations_last_activity_idx`).on(table.lastActivityAt),
    index(`${tablePrefix}organizations_activity_score_idx`).on(table.activityScore),
    index(`${tablePrefix}organizations_engagement_score_idx`).on(table.engagementScore),
    index(`${tablePrefix}organizations_growth_score_idx`).on(table.growthScore),

    index(`${tablePrefix}organizations_health_score_idx`).on(table.healthScore),
    index(`${tablePrefix}organizations_risk_level_idx`).on(table.riskLevel),
    index(`${tablePrefix}organizations_churn_risk_idx`).on(table.churnRisk),
    index(`${tablePrefix}organizations_customer_tier_idx`).on(table.customerTier),

    index(`${tablePrefix}organizations_deleted_at_idx`).on(table.deletedAt),
    index(`${tablePrefix}organizations_created_at_idx`).on(table.createdAt),
    index(`${tablePrefix}organizations_scheduled_deletion_idx`).on(table.scheduledDeletionAt),
    index(`${tablePrefix}organizations_data_anonymized_idx`).on(table.dataAnonymizedAt),

    index(`${tablePrefix}organizations_custom_domain_idx`).on(table.customDomain),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================
    // Owner's active organizations
    index(`${tablePrefix}organizations_owner_active_idx`)
      .on(table.ownerId, table.isActive, table.status)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Owner's organizations with activity
    index(`${tablePrefix}organizations_owner_activity_idx`)
      .on(table.ownerId, table.lastActivityAt, table.isActive)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Organizations at risk of churn
    index(`${tablePrefix}organizations_high_churn_risk_idx`)
      .on(table.churnRisk, table.isActive)
      .where(
        sql`
          ${table.churnRisk} >= 70 
          AND ${table.isActive} = true
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Organizations with recent activity
    index(`${tablePrefix}organizations_recent_activity_idx`)
      .on(table.lastActivityAt, table.isActive)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Agencies with child organizations.
    // The predicate previously read ('agency', 'enterprise'), but
    // `organization_type` has no `enterprise` label — that value belongs to
    // `subscription_plan`. Postgres rejected the whole `bun run db:push`.
    // Narrowed to `agency`, matching this index's name and comment. A partial
    // index's predicate only governs which rows are indexed, never which rows a
    // query returns, so narrowing it cannot change results.
    index(`${tablePrefix}organizations_agencies_with_children_idx`)
      .on(table.isParent, table.type, table.status, table.isActive)
      .where(
        sql`
          ${table.isParent} = true 
          AND ${table.type} IN ('agency')
          AND ${table.isActive} = true
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Industry + company size segmentation
    index(`${tablePrefix}organizations_industry_size_idx`)
      .on(table.industry, table.companySize, table.isActive)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // Full-text search index
    index(`${tablePrefix}organizations_search_idx`)
      .on(table.name, table.slug, table.email, table.website)
      .where(sql`${table.deletedAt} IS NULL`),

    // High engagement organizations
    index(`${tablePrefix}organizations_high_engagement_idx`)
      .on(table.engagementScore, table.isActive, table.lastActivityAt)
      .where(
        sql`
          ${table.engagementScore} >= 80 
          AND ${table.isActive} = true
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}organizations_preferences_gin_idx`)
      .using("gin", table.preferences)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_security_settings_gin_idx`)
      .using("gin", table.securitySettings)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_tags_gin_idx`)
      .using("gin", table.tags)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_address_gin_idx`)
      .using("gin", table.address)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_billing_address_gin_idx`)
      .using("gin", table.billingAddress)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}organizations_whitelabel_gin_idx`)
      .using("gin", table.whitelabel)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// RELATIONS
// ============================================

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [organizations.createdBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [organizations.deletedBy],
    references: [users.id],
  }),
  parentOrganization: one(organizations, {
    fields: [organizations.parentOrganizationId],
    references: [organizations.id],
    relationName: "organizationParent",
  }),
  childOrganizations: many(organizations, {
    relationName: "organizationParent",
  }),
  members: many(organizationMembers),
  roles: many(roles),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationTable = typeof organizations;

// ============================================
// HELPER SELECTORS
// ============================================

export const organizationSelectors = {
  basic: {
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    displayName: organizations.displayName,
    logoUrl: organizations.logoUrl,
    type: organizations.type,
    status: organizations.status,
    isActive: organizations.isActive,
    isVerified: organizations.isVerified,
    ownerId: organizations.ownerId,
    createdAt: organizations.createdAt,
  } as const,

  profile: {
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    displayName: organizations.displayName,
    logoUrl: organizations.logoUrl,
    iconUrl: organizations.iconUrl,
    coverImageUrl: organizations.coverImageUrl,
    description: organizations.description,
    tagline: organizations.tagline,
    email: organizations.email,
    phone: organizations.phone,
    website: organizations.website,
    address: organizations.address,
    socialLinks: organizations.socialLinks,
    language: organizations.language,
    currency: organizations.currency,
  } as const,

  admin: {
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    displayName: organizations.displayName,
    logoUrl: organizations.logoUrl,
    type: organizations.type,
    industry: organizations.industry,
    companySize: organizations.companySize,
    status: organizations.status,
    isActive: organizations.isActive,
    isVerified: organizations.isVerified,
    ownerId: organizations.ownerId,
    createdBy: organizations.createdBy,
    parentOrganizationId: organizations.parentOrganizationId,
    isParent: organizations.isParent,
    customDomain: organizations.customDomain,
    customDomainVerified: organizations.customDomainVerified,
    lastActivityAt: organizations.lastActivityAt,
    activityScore: organizations.activityScore,
    engagementScore: organizations.engagementScore,
    growthScore: organizations.growthScore,
    healthScore: organizations.healthScore,
    riskLevel: organizations.riskLevel,
    churnRisk: organizations.churnRisk,
    customerTier: organizations.customerTier,
    deletedAt: organizations.deletedAt,
    scheduledDeletionAt: organizations.scheduledDeletionAt,
    createdAt: organizations.createdAt,
    updatedAt: organizations.updatedAt,
  } as const,

  analytics: {
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    teamStats: organizations.teamStats,
    platformStats: organizations.platformStats,
    contentStats: organizations.contentStats,
    activityScore: organizations.activityScore,
    engagementScore: organizations.engagementScore,
    growthScore: organizations.growthScore,
    healthScore: organizations.healthScore,
    healthScoreVersion: organizations.healthScoreVersion,
    healthScoreCalculatedAt: organizations.healthScoreCalculatedAt,
    riskLevel: organizations.riskLevel,
    riskLevelCalculatedAt: organizations.riskLevelCalculatedAt,
    churnRisk: organizations.churnRisk,
    churnRiskCalculatedAt: organizations.churnRiskCalculatedAt,
    customerTier: organizations.customerTier,
    lastActivityAt: organizations.lastActivityAt,
  } as const,

  compliance: {
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    termsAcceptedAt: organizations.termsAcceptedAt,
    termsVersion: organizations.termsVersion,
    dataProcessingAgreementAcceptedAt: organizations.dataProcessingAgreementAcceptedAt,
    dataProcessingAgreementVersion: organizations.dataProcessingAgreementVersion,
    privacyPolicyAcceptedAt: organizations.privacyPolicyAcceptedAt,
    privacyPolicyVersion: organizations.privacyPolicyVersion,
    cookieConsentAcceptedAt: organizations.cookieConsentAcceptedAt,
    cookieConsentVersion: organizations.cookieConsentVersion,
    dataResidency: organizations.dataResidency,
    dataProcessingLocation: organizations.dataProcessingLocation,
    dataBackupLocation: organizations.dataBackupLocation,
    privacySettings: organizations.privacySettings,
    securitySettings: organizations.securitySettings,
    deletedAt: organizations.deletedAt,
    dataAnonymizedAt: organizations.dataAnonymizedAt,
    dataArchivedAt: organizations.dataArchivedAt,
  } as const,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if organization is active and not deleted
 */
export function isOrganizationActive(org: Organization): boolean {
  return org.isActive && org.status === "active" && org.deletedAt === null;
}

/**
 * Check if organization is a parent organization
 */
export function isParentOrganization(org: Organization): boolean {
  return org.isParent === true;
}

/**
 * Check if organization has child organizations
 */
export async function hasChildOrganizations(orgId: string, db: any): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizations)
    .where(
      sql`${organizations.parentOrganizationId} = ${orgId} AND ${organizations.deletedAt} IS NULL`,
    );
  return Number(result[0]?.count) > 0;
}

/**
 * Get organization's health status
 */
export function getHealthStatus(org: Organization): {
  status: "healthy" | "warning" | "critical";
  score: number;
} {
  const score = org.healthScore || 50;
  if (score >= 80) return { status: "healthy", score };
  if (score >= 50) return { status: "warning", score };
  return { status: "critical", score };
}

/**
 * Get organization's churn risk level
 */
export function getChurnRiskLevel(org: Organization): {
  level: "low" | "medium" | "high" | "critical";
  score: number;
} {
  const score = org.churnRisk || 0;
  if (score < 30) return { level: "low", score };
  if (score < 50) return { level: "medium", score };
  if (score < 70) return { level: "high", score };
  return { level: "critical", score };
}

/**
 * Format organization name for display
 */
export function getDisplayName(org: Organization): string {
  return org.displayName || org.name;
}

/**
 * Get organization's full address as string
 */
export function getFullAddress(org: Organization): string | null {
  const addr = org.address as OrganizationAddress;
  if (!addr) return null;
  const parts = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
