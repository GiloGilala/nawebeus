// @/db/schema/auth/organization-members.ts

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
import { roles } from "../core/roles";
import { users } from "../core/users";
import { engagementLevelPgEnum, memberStatusPgEnum } from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { organizations } from "./organizations";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface WorkSchedule {
  timezone?: string;
  workingHours: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  daysOff: string[];
  holidays: { date: string; name: string }[];
}

export interface PermissionOverrides {
  allowedPermissions?: string[];
  deniedPermissions?: string[];
}

export interface AccessRestrictions {
  allowedSocialAccountIds?: string[];
  allowedWorkspaceIds?: string[];
  restrictedFeatures: string[];
  customLimits: {
    maxPostsPerDay?: number;
    maxScheduledPosts?: number;
    maxDraftPosts?: number;
  };
}

export interface ActivityStats {
  postsCreated: number;
  postsPublished: number;
  postsScheduled: number;
  commentsReplied: number;
  reportsGenerated: number;
  loginCount: number;
  lastLoginAt?: string;
  averageSessionDuration?: number;
  totalTimeSpent?: number;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  slack: boolean;
  channels: {
    mentions: boolean;
    assignments: boolean;
    approvals: boolean;
    comments: boolean;
    teamActivity: boolean;
    organizationUpdates: boolean;
  };
  frequency: "realtime" | "hourly" | "daily" | "weekly";
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface OnboardingData {
  completedSteps: string[];
  skippedSteps: string[];
  completedAt?: string;
  toursSeen: string[];
  setupCompleted?: boolean;
  setupStep?: number;
}

export interface LicenseInfo {
  assignedAt?: string;
  expiresAt?: string;
  cost?: number;
  notes?: string;
}

export interface MemberMetadata {
  source?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  contractType?: "full_time" | "part_time" | "contractor" | "intern";
  location?: string;
  customFields: Record<string, unknown>;
}

export interface AccessSchedule {
  enabled: boolean;
  allowedHours: {
    start: string;
    end: string;
    timezone: string;
  };
  allowedDays: number[];
}

// History moved to dedicated tables for better scalability
// RoleHistory and PermissionHistory tables defined below

// ============================================
// HISTORY TABLES (NEW - for better scalability)
// ============================================

export const roleHistory = pgTable(
  `${tablePrefix}member_role_history`,
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    roleName: varchar("role_name", { length: 100 }).notNull(),
    changedAt: timestamp("changed_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    previousRoleId: uuid("previous_role_id"),
    previousRoleName: varchar("previous_role_name", { length: 100 }),
    ...timestamps,
  },
  (table) => [
    index("member_role_history_member_idx").on(table.memberId),
    index("member_role_history_changed_at_idx").on(table.changedAt),
    index("member_role_history_changed_by_idx").on(table.changedBy),
  ],
);

export const permissionHistory = pgTable(
  `${tablePrefix}member_permission_history`,
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    permission: varchar("permission", { length: 100 }).notNull(),
    changeType: varchar("change_type", { length: 20 }).notNull(), // 'granted' | 'revoked' | 'modified'
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    reason: text("reason"),
    ...timestamps,
  },
  (table) => [
    index("member_permission_history_member_idx").on(table.memberId),
    index("member_permission_history_changed_at_idx").on(table.changedAt),
    index("member_permission_history_permission_idx").on(table.permission),
  ],
);

// ============================================
// DEFAULT VALUES
// ============================================

export const workScheduleDefault = (): WorkSchedule => ({
  workingHours: {},
  daysOff: [],
  holidays: [],
});

export const permissionOverridesDefault = (): PermissionOverrides => ({
  allowedPermissions: [],
  deniedPermissions: [],
});

export const accessRestrictionsDefault = (): AccessRestrictions => ({
  restrictedFeatures: [],
  customLimits: {},
});

export const activityStatsDefault = (): ActivityStats => ({
  postsCreated: 0,
  postsPublished: 0,
  postsScheduled: 0,
  commentsReplied: 0,
  reportsGenerated: 0,
  loginCount: 0,
});

export const notificationPreferencesDefault = (): NotificationPreferences => ({
  email: true,
  inApp: true,
  slack: false,
  channels: {
    mentions: true,
    assignments: true,
    approvals: true,
    comments: true,
    teamActivity: false,
    organizationUpdates: true,
  },
  frequency: "realtime",
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00",
  },
});

export const onboardingDataDefault = (): OnboardingData => ({
  completedSteps: [],
  skippedSteps: [],
  toursSeen: [],
  setupCompleted: false,
  setupStep: 1,
});

export const licenseInfoDefault = (): LicenseInfo => ({});

export const metadataDefault = (): MemberMetadata => ({
  customFields: {},
});

export const accessScheduleDefault = (): AccessSchedule => ({
  enabled: false,
  allowedHours: {
    start: "09:00",
    end: "17:00",
    timezone: "UTC",
  },
  allowedDays: [1, 2, 3, 4, 5],
});

// ============================================
// ORGANIZATION MEMBERS TABLE
// ============================================

export const organizationMembers = pgTable(
  `${tablePrefix}organization_members`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Nullable on purpose: an invited member who has no account yet is a
    // row with status='invited' and user_id=NULL until they accept (the
    // invitation flow, F-08/NWB-P0-016). inviteMember has always inserted
    // NULL there; the old NOT NULL made every invite of a new email 500
    // with 23502 (F-20). The (organization_id, user_id) unique index is
    // unaffected — Postgres treats NULLs as distinct.
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    roleId: uuid("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),

    // ============================================
    // STATUS & LIFECYCLE
    // ============================================
    status: memberStatusPgEnum("status").notNull().default("invited"),
    isActive: boolean("is_active").notNull().default(false),

    // Invitation details
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", {
      withTimezone: true,
      mode: "date",
    }),

    // The address the invitation was sent to. Added in NWB-P0-016: until then a
    // pending invite for an account-less email stored user_id=NULL and nothing
    // else — the addressee existed only in the sent email, so dedup on
    // (org, email) was impossible and an accept flow could not know whose
    // invitation this was. Written for every invite, account or not.
    invitedEmail: varchar("invited_email", { length: 255 }),

    // Invitation token (raw value shown in the /invite?token= link) and its
    // SHA-256 hash. Written by inviteMember since before these columns
    // existed in the schema (F-20): every invite 500'd with 42703 until
    // 2026-09-20. Conventions follow the core `tokens` table (text hash).
    invitationToken: varchar("invitation_token", { length: 255 }),
    invitationTokenHash: text("invitation_token_hash"),
    invitationSentAt: timestamp("invitation_sent_at", {
      withTimezone: true,
      mode: "date",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    invitationNote: text("invitation_note"),

    // Acceptance
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    declinedAt: timestamp("declined_at", {
      withTimezone: true,
      mode: "date",
    }),
    declineReason: text("decline_reason"),

    // Activation
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "date",
    }),
    activatedBy: uuid("activated_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Suspension
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "date",
    }),
    suspendedBy: uuid("suspended_by").references(() => users.id, {
      onDelete: "set null",
    }),
    suspensionReason: text("suspension_reason"),
    suspensionEndsAt: timestamp("suspension_ends_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Deactivation
    deactivatedAt: timestamp("deactivated_at", {
      withTimezone: true,
      mode: "date",
    }),
    deactivatedBy: uuid("deactivated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deactivationReason: text("deactivation_reason"),

    // ============================================
    // MEMBER PROFILE
    // ============================================
    displayName: varchar("display_name", { length: 200 }),
    jobTitle: varchar("job_title", { length: 100 }),
    department: varchar("department", { length: 100 }),

    bio: text("bio"),
    avatarUrl: varchar("avatar_url"),

    workSchedule: jsonb("work_schedule").$type<WorkSchedule>().default(sql`'{}'::jsonb`),

    // ============================================
    // PERMISSION OVERRIDES
    // ============================================
    permissionOverrides: jsonb("permission_overrides")
      .$type<PermissionOverrides>()
      .default(sql`'{}'::jsonb`),

    accessRestrictions: jsonb("access_restrictions")
      .$type<AccessRestrictions>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // ACTIVITY & ENGAGEMENT
    // ============================================
    lastActiveAt: timestamp("last_active_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastActivityType: varchar("last_activity_type", { length: 100 }),

    // Cached analytics - not source of truth
    activityStats: jsonb("activity_stats").$type<ActivityStats>().default(sql`'{}'::jsonb`),

    productivityScore: integer("productivity_score").default(0),
    engagementLevel: engagementLevelPgEnum("engagement_level").default("active"),

    // ============================================
    // NOTIFICATIONS & PREFERENCES
    // ============================================
    notificationPreferences: jsonb("notification_preferences")
      .$type<NotificationPreferences>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // ONBOARDING
    // ============================================
    onboardingData: jsonb("onboarding_data").$type<OnboardingData>().default(sql`'{}'::jsonb`),

    // ============================================
    // BILLING & LICENSING
    // ============================================
    isBillable: boolean("is_billable").notNull().default(true),
    seatType: varchar("seat_type", { length: 50 }).default("full"),

    licenseInfo: jsonb("license_info").$type<LicenseInfo>().default(sql`'{}'::jsonb`),

    // ============================================
    // COLLABORATION
    // ============================================
    reportsTo: uuid("reports_to").references((): any => organizationMembers.id, {
      onDelete: "set null",
    }),

    // ============================================
    // SECURITY & COMPLIANCE
    // ============================================
    allowedIPs: jsonb("allowed_ips").$type<string[]>().default(sql`'[]'::jsonb`),
    blockedIPs: jsonb("blocked_ips").$type<string[]>().default(sql`'[]'::jsonb`),

    requiresMFA: boolean("requires_mfa").notNull().default(false),

    accessSchedule: jsonb("access_schedule").$type<AccessSchedule>().default(sql`'{}'::jsonb`),

    maxConcurrentSessions: integer("max_concurrent_sessions").default(3),
    currentActiveSessions: integer("current_active_sessions").default(0),

    // ============================================
    // METADATA
    // ============================================
    metadata: jsonb("metadata").$type<MemberMetadata>().default(sql`'{}'::jsonb`),

    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
    notes: text("notes"),

    // ============================================
    // TIMESTAMPS (No soft delete - use status instead)
    // ============================================
    ...timestamps,
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "date",
    }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================
    uniqueIndex("organization_members_org_user_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================
    index("organization_members_org_idx").on(table.organizationId),
    index("organization_members_user_idx").on(table.userId),
    index("organization_members_role_idx").on(table.roleId),

    index("organization_members_status_idx").on(table.status),
    index("organization_members_is_active_idx").on(table.isActive),
    index("organization_members_invited_by_idx").on(table.invitedBy),
    index("organization_members_invited_email_idx").on(table.invitedEmail),
    index("organization_members_invited_at_idx").on(table.invitedAt),

    index("organization_members_last_active_idx").on(table.lastActiveAt),
    index("organization_members_engagement_level_idx").on(table.engagementLevel),

    index("organization_members_is_billable_idx").on(table.isBillable),
    index("organization_members_seat_type_idx").on(table.seatType),

    index("organization_members_reports_to_idx").on(table.reportsTo),

    index("organization_members_suspended_at_idx").on(table.suspendedAt),
    index("organization_members_suspension_ends_idx").on(table.suspensionEndsAt),

    index("organization_members_deleted_at_idx").on(table.deletedAt),
    index("organization_members_created_at_idx").on(table.createdAt),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================
    // Active members in an organization
    index("organization_members_org_active_idx")
      .on(table.organizationId, table.status, table.isActive)
      .where(sql`
        ${table.status} = 'active' 
        AND ${table.isActive} = true 
        AND ${table.deletedAt} IS NULL
      `),

    // Members by role in an organization
    index("organization_members_org_role_idx")
      .on(table.organizationId, table.roleId, table.isActive)
      .where(sql`
        ${table.isActive} = true 
        AND ${table.deletedAt} IS NULL
      `),

    // Members with ending suspensions
    index("organization_members_suspension_ending_idx").on(table.suspensionEndsAt, table.status),

    // Billable members for billing calculations
    index("organization_members_billable_idx")
      .on(table.organizationId, table.isBillable, table.seatType)
      .where(sql`
        ${table.isBillable} = true 
        AND ${table.isActive} = true 
        AND ${table.deletedAt} IS NULL
      `),

    // Inactive/low engagement members for outreach.
    // `engagement_level` runs none → low → medium → high → full → active, so the
    // disengaged end is `none`. This predicate previously read `'inactive'`,
    // which is not a label of the enum — Postgres rejected the whole
    // `bun run db:push` with "invalid input value for enum engagement_level".
    index("organization_members_inactive_idx")
      .on(table.lastActiveAt, table.engagementLevel)
      .where(sql`
        ${table.engagementLevel} IN ('none', 'low')
        AND ${table.isActive} = true
        AND ${table.deletedAt} IS NULL
      `),

    // Members with incomplete onboarding
    index("organization_members_onboarding_incomplete_idx")
      .on(table.organizationId, table.onboardingData, table.acceptedAt)
      .where(sql`
        ${table.onboardingData} IS NOT NULL 
        AND ${table.status} = 'active'
        AND ${table.acceptedAt} IS NOT NULL
        AND ${table.deletedAt} IS NULL
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index("organization_members_access_restrictions_gin_idx")
      .using("gin", table.accessRestrictions)
      .where(sql`${table.deletedAt} IS NULL`),

    index("organization_members_permission_overrides_gin_idx")
      .using("gin", table.permissionOverrides)
      .where(sql`${table.deletedAt} IS NULL`),

    index("organization_members_metadata_gin_idx")
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index("organization_members_tags_gin_idx")
      .using("gin", table.tags)
      .where(sql`${table.deletedAt} IS NULL`),

    index("organization_members_activity_stats_gin_idx")
      .using("gin", table.activityStats)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================

export const organizationMembersRelations = relations(organizationMembers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [organizationMembers.roleId],
    references: [roles.id],
  }),
  invitedByUser: one(users, {
    fields: [organizationMembers.invitedBy],
    references: [users.id],
  }),
  activatedByUser: one(users, {
    fields: [organizationMembers.activatedBy],
    references: [users.id],
  }),
  suspendedByUser: one(users, {
    fields: [organizationMembers.suspendedBy],
    references: [users.id],
  }),
  deactivatedByUser: one(users, {
    fields: [organizationMembers.deactivatedBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [organizationMembers.deletedBy],
    references: [users.id],
  }),
  manager: one(organizationMembers, {
    fields: [organizationMembers.reportsTo],
    references: [organizationMembers.id],
    relationName: "managedEmployees",
  }),
  directReports: many(organizationMembers, {
    relationName: "managedEmployees",
  }),
  roleHistory: many(roleHistory),
  permissionHistory: many(permissionHistory),
}));

// ============================================
// RELATIONS FOR HISTORY TABLES
// ============================================

export const roleHistoryRelations = relations(roleHistory, ({ one }) => ({
  member: one(organizationMembers, {
    fields: [roleHistory.memberId],
    references: [organizationMembers.id],
  }),
  changedByUser: one(users, {
    fields: [roleHistory.changedBy],
    references: [users.id],
  }),
}));

export const permissionHistoryRelations = relations(permissionHistory, ({ one }) => ({
  member: one(organizationMembers, {
    fields: [permissionHistory.memberId],
    references: [organizationMembers.id],
  }),
  changedByUser: one(users, {
    fields: [permissionHistory.changedBy],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type OrganizationMemberTable = typeof organizationMembers;

export type RoleHistory = typeof roleHistory.$inferSelect;
export type NewRoleHistory = typeof roleHistory.$inferInsert;

export type PermissionHistory = typeof permissionHistory.$inferSelect;
export type NewPermissionHistory = typeof permissionHistory.$inferInsert;

// ============================================
// HELPER SELECTORS
// ============================================

export const memberSelectors = {
  basic: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    roleId: organizationMembers.roleId,
    status: organizationMembers.status,
    isActive: organizationMembers.isActive,
    displayName: organizationMembers.displayName,
    jobTitle: organizationMembers.jobTitle,
    department: organizationMembers.department,
    lastActiveAt: organizationMembers.lastActiveAt,
    engagementLevel: organizationMembers.engagementLevel,
    createdAt: organizationMembers.createdAt,
  } as const,

  profile: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    displayName: organizationMembers.displayName,
    jobTitle: organizationMembers.jobTitle,
    department: organizationMembers.department,
    bio: organizationMembers.bio,
    avatarUrl: organizationMembers.avatarUrl,
    workSchedule: organizationMembers.workSchedule,
  } as const,

  admin: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    roleId: organizationMembers.roleId,
    status: organizationMembers.status,
    isActive: organizationMembers.isActive,
    invitedBy: organizationMembers.invitedBy,
    invitedAt: organizationMembers.invitedAt,
    acceptedAt: organizationMembers.acceptedAt,
    activatedAt: organizationMembers.activatedAt,
    suspendedAt: organizationMembers.suspendedAt,
    suspensionReason: organizationMembers.suspensionReason,
    suspensionEndsAt: organizationMembers.suspensionEndsAt,
    deactivatedAt: organizationMembers.deactivatedAt,
    deactivationReason: organizationMembers.deactivationReason,
    isBillable: organizationMembers.isBillable,
    seatType: organizationMembers.seatType,
    reportsTo: organizationMembers.reportsTo,
    requiresMFA: organizationMembers.requiresMFA,
    maxConcurrentSessions: organizationMembers.maxConcurrentSessions,
    currentActiveSessions: organizationMembers.currentActiveSessions,
    deletedAt: organizationMembers.deletedAt,
    createdAt: organizationMembers.createdAt,
    updatedAt: organizationMembers.updatedAt,
  } as const,

  permissions: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    roleId: organizationMembers.roleId,
    permissionOverrides: organizationMembers.permissionOverrides,
    accessRestrictions: organizationMembers.accessRestrictions,
    requiresMFA: organizationMembers.requiresMFA,
    allowedIPs: organizationMembers.allowedIPs,
    blockedIPs: organizationMembers.blockedIPs,
    accessSchedule: organizationMembers.accessSchedule,
  } as const,

  analytics: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    lastActiveAt: organizationMembers.lastActiveAt,
    lastActivityType: organizationMembers.lastActivityType,
    activityStats: organizationMembers.activityStats,
    productivityScore: organizationMembers.productivityScore,
    engagementLevel: organizationMembers.engagementLevel,
  } as const,

  billing: {
    id: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    userId: organizationMembers.userId,
    isBillable: organizationMembers.isBillable,
    seatType: organizationMembers.seatType,
    licenseInfo: organizationMembers.licenseInfo,
  } as const,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a member is active
 */
export function isMemberActive(member: OrganizationMember): boolean {
  return member.status === "active" && member.isActive === true && member.deletedAt === null;
}

/**
 * Check if a member is currently suspended
 */
export function isMemberSuspended(member: OrganizationMember): boolean {
  if (member.status !== "suspended") return false;
  if (!member.suspensionEndsAt) return true;
  return new Date(member.suspensionEndsAt) > new Date();
}

/**
 * Check if a member is a manager (has direct reports)
 */
export function isManager(member: OrganizationMember): boolean {
  return !!member.reportsTo;
}

/**
 * Get member's full display name
 */
export function getMemberDisplayName(member: OrganizationMember): string {
  if (member.displayName) return member.displayName;
  // Pending invites have no account yet (user_id is NULL, F-20)
  if (member.userId) return `User ${member.userId.slice(0, 8)}`;
  return "Invited member";
}

/**
 * Check if a member has a specific permission
 */
export function hasPermission(member: OrganizationMember, permission: string): boolean {
  const overrides = member.permissionOverrides as PermissionOverrides;
  if (!overrides) return false;

  // Check explicit denies first
  if (overrides.deniedPermissions?.includes(permission)) return false;

  // Check explicit allows
  if (overrides.allowedPermissions?.includes(permission)) return true;

  // If no overrides, role-based permissions would be checked elsewhere
  return false;
}

/**
 * Check if a member has access to a specific social account
 */
export function hasSocialAccountAccess(member: OrganizationMember, accountId: string): boolean {
  const restrictions = member.accessRestrictions as AccessRestrictions;
  if (!restrictions?.allowedSocialAccountIds) return true;
  return restrictions.allowedSocialAccountIds.includes(accountId);
}

/**
 * Get the direct reports count
 */
export function getDirectReportsCount(member: OrganizationMember, db: any): Promise<number> {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(organizationMembers)
    .where(
      sql`
        ${organizationMembers.reportsTo} = ${member.id}
        AND ${organizationMembers.deletedAt} IS NULL
      `,
    )
    .then((result: { count: unknown }[]) => Number(result[0]?.count) || 0);
}
