// @/db/schemas/auth/roles.ts

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
import { organizationMembers } from "../organization/organization-members";
import { organizations } from "../organization/organizations";
import { roleScopePgEnum, roleStatusPgEnum, roleTypePgEnum } from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { rolePermissions } from "./permission-roles";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface RoleStats {
  totalMembers: number;
  activeMembers: number;
  monthlyActivity: Record<string, number>;
  mostUsedPermissions: string[];
  productUsage: {
    social: number;
    fashion: number;
    hybrid: number;
  };
}

export interface RoleMetadata {
  tags: string[];
  category: string;
  productType: "social" | "fashion" | "hybrid";
  targetAudience: string[];
  useCases: string[];
  customFields: Record<string, unknown>;
}

export interface RoleChangeEntry {
  timestamp: string;
  changedBy: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const statsDefault = (): RoleStats => ({
  totalMembers: 0,
  activeMembers: 0,
  monthlyActivity: {},
  mostUsedPermissions: [],
  productUsage: { social: 0, fashion: 0, hybrid: 0 },
});

export const metadataDefault = (): RoleMetadata => ({
  tags: [],
  category: "custom",
  productType: "social",
  targetAudience: [],
  useCases: [],
  customFields: {},
});

export const changeHistoryDefault = (): RoleChangeEntry[] => [];

// ============================================
// ROLES TABLE
// ============================================

export const roles = pgTable(
  `${tablePrefix}roles`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    // ============================================
    // ROLE IDENTITY
    // ============================================
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    code: varchar("code", { length: 50 }).notNull(),

    isProtected: boolean("is_protected").default(false).notNull(),

    // ============================================
    // ROLE CLASSIFICATION
    // ============================================
    type: roleTypePgEnum("type").notNull().default("custom"),
    scope: roleScopePgEnum("scope").notNull().default("organization"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    isSystemRole: boolean("is_system_role").notNull().default(false),

    // Hierarchy
    level: integer("level").notNull().default(0),
    priority: integer("priority").notNull().default(50),

    // ============================================
    // PERMISSIONS (DERIVED CACHE) to be removed
    // ============================================
    permissions: jsonb("permissions").notNull().$type<string[]>().default(sql`'[]'::jsonb`),

    // ============================================
    // RESTRICTIONS & LIMITS
    // ============================================
    restrictions: jsonb("restrictions").notNull().$type<string[]>().default(sql`'[]'::jsonb`),

    // ============================================
    // STATUS & AVAILABILITY
    // ============================================
    status: roleStatusPgEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),

    requiresMFA: boolean("requires_mfa").default(false).notNull(),

    // Assignment controls
    canBeAssignedBy: jsonb("can_be_assigned_by").$type<string[]>().default(sql`'[]'::jsonb`),
    requiresApproval: boolean("requires_approval").notNull().default(false),

    // Availability
    availableForPlanTiers: jsonb("available_for_plan_tiers")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    minPlanTier: varchar("min_plan_tier", { length: 50 }),

    // ============================================
    // USAGE & STATISTICS
    // ============================================
    stats: jsonb("stats").notNull().$type<RoleStats>().default(sql`'{}'::jsonb`),

    // ============================================
    // UI & PRESENTATION
    // ============================================
    color: varchar("color", { length: 20 }),
    icon: varchar("icon", { length: 50 }),
    badgeText: varchar("badge_text", { length: 50 }),

    // ============================================
    // AUDIT & METADATA
    // ============================================
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lastModifiedBy: uuid("last_modified_by").references(() => users.id, {
      onDelete: "set null",
    }),

    changeHistory: jsonb("change_history").$type<RoleChangeEntry[]>().default(sql`'[]'::jsonb`),

    metadata: jsonb("metadata").notNull().$type<RoleMetadata>().default(sql`'{}'::jsonb`),

    notes: text("notes"),

    // ============================================
    // TIMESTAMPS & ARCHIVAL
    // ============================================
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,

    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "date",
    }),
    archivedBy: uuid("archived_by").references(() => users.id, {
      onDelete: "set null",
    }),
    archivedReason: text("archived_reason"),
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}roles_org_slug_unique_idx`)
      .on(table.organizationId, table.slug)
      .where(sql`${table.archivedAt} IS NULL AND ${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}roles_org_default_unique_idx`)
      .on(table.organizationId)
      .where(
        sql`
          ${table.isDefault} = true 
          AND ${table.archivedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    uniqueIndex(`${tablePrefix}roles_code_unique_idx`)
      .on(table.code)
      .where(sql`${table.deletedAt} IS NULL AND ${table.archivedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}roles_name_idx`).on(table.name),
    index(`${tablePrefix}roles_slug_idx`).on(table.slug),
    index(`${tablePrefix}roles_display_name_idx`).on(table.displayName),

    index(`${tablePrefix}roles_type_idx`).on(table.type),
    index(`${tablePrefix}roles_scope_idx`).on(table.scope),
    index(`${tablePrefix}roles_organization_idx`).on(table.organizationId),

    index(`${tablePrefix}roles_level_idx`).on(table.level),
    index(`${tablePrefix}roles_priority_idx`).on(table.priority),

    index(`${tablePrefix}roles_status_idx`).on(table.status),
    index(`${tablePrefix}roles_min_plan_tier_idx`).on(table.minPlanTier),

    index(`${tablePrefix}roles_created_by_idx`).on(table.createdBy),
    index(`${tablePrefix}roles_last_modified_by_idx`).on(table.lastModifiedBy),
    index(`${tablePrefix}roles_archived_by_idx`).on(table.archivedBy),
    index(`${tablePrefix}roles_deleted_by_idx`).on(table.deletedBy),

    index(`${tablePrefix}roles_archived_at_idx`).on(table.archivedAt),
    index(`${tablePrefix}roles_deleted_at_idx`).on(table.deletedAt),
    index(`${tablePrefix}roles_created_at_idx`).on(table.createdAt),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================
    index(`${tablePrefix}roles_org_active_idx`)
      .on(table.organizationId, table.isActive, table.status, table.priority)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.status} = 'active' 
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_system_active_idx`)
      .on(table.isSystemRole, table.isActive, table.level)
      .where(
        sql`
          ${table.isSystemRole} = true 
          AND ${table.isActive} = true 
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_assignable_idx`)
      .on(table.organizationId, table.isHidden, table.isActive, table.status)
      .where(
        sql`
          ${table.isHidden} = false 
          AND ${table.isActive} = true 
          AND ${table.status} = 'active'
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_by_plan_tier_idx`)
      .on(table.minPlanTier, table.isActive, table.status)
      .where(
        sql`
          ${table.minPlanTier} IS NOT NULL
          AND ${table.isActive} = true 
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_default_active_idx`)
      .on(table.isDefault, table.isActive, table.organizationId)
      .where(
        sql`
          ${table.isDefault} = true 
          AND ${table.isActive} = true
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_level_priority_idx`)
      .on(table.level, table.priority, table.isActive)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_search_idx`)
      .on(table.name, table.slug, table.displayName, table.description)
      .where(
        sql`
          ${table.archivedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_recently_updated_idx`)
      .on(table.updatedAt, table.organizationId, table.isActive)
      .where(
        sql`
          ${table.isActive} = true 
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_requires_approval_idx`)
      .on(table.requiresApproval, table.organizationId, table.isActive)
      .where(
        sql`
          ${table.requiresApproval} = true 
          AND ${table.isActive} = true
          AND ${table.archivedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}roles_permissions_gin_idx`)
      .using("gin", table.permissions)
      .where(
        sql`
          ${table.deletedAt} IS NULL 
          AND ${table.archivedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_restrictions_gin_idx`)
      .using("gin", table.restrictions)
      .where(
        sql`
          ${table.deletedAt} IS NULL 
          AND ${table.archivedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(
        sql`
          ${table.deletedAt} IS NULL 
          AND ${table.archivedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_stats_gin_idx`)
      .using("gin", table.stats)
      .where(
        sql`
          ${table.deletedAt} IS NULL 
          AND ${table.archivedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}roles_change_history_gin_idx`)
      .using("gin", table.changeHistory)
      .where(
        sql`
          ${table.deletedAt} IS NULL 
          AND ${table.archivedAt} IS NULL
        `,
      ),
  ],
);

// ============================================
// RELATIONS (FIXED: Properly using roles table)
// ============================================

// @/db/schemas/auth/roles.ts

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [roles.createdBy],
    references: [users.id],
  }),
  lastModifiedByUser: one(users, {
    fields: [roles.lastModifiedBy],
    references: [users.id],
  }),
  archivedByUser: one(users, {
    fields: [roles.archivedBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [roles.deletedBy],
    references: [users.id],
  }),
  members: many(organizationMembers),
  // NEW: Add rolePermissions relation
  rolePermissions: many(rolePermissions), // Import from './role-permissions'
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleTable = typeof roles;

// ============================================
// HELPER SELECTORS
// ============================================

export const roleSelectors = {
  basic: {
    id: roles.id,
    name: roles.name,
    displayName: roles.displayName,
    description: roles.description,
    code: roles.code,
    level: roles.level,
    isSystemRole: roles.isSystemRole,
    isDefault: roles.isDefault,
    isActive: roles.isActive,
    status: roles.status,
    color: roles.color,
    icon: roles.icon,
  } as const,

  withPermissions: {
    id: roles.id,
    name: roles.name,
    displayName: roles.displayName,
    description: roles.description,
    code: roles.code,
    level: roles.level,
    permissions: roles.permissions,
    restrictions: roles.restrictions,
    requiresMFA: roles.requiresMFA,
    isSystemRole: roles.isSystemRole,
    isDefault: roles.isDefault,
    isProtected: roles.isProtected,
    isActive: roles.isActive,
    status: roles.status,
  } as const,

  full: {
    id: roles.id,
    organizationId: roles.organizationId,
    name: roles.name,
    slug: roles.slug,
    displayName: roles.displayName,
    description: roles.description,
    code: roles.code,
    type: roles.type,
    scope: roles.scope,
    level: roles.level,
    priority: roles.priority,
    permissions: roles.permissions,
    restrictions: roles.restrictions,
    isSystemRole: roles.isSystemRole,
    isDefault: roles.isDefault,
    isProtected: roles.isProtected,
    isActive: roles.isActive,
    isHidden: roles.isHidden,
    status: roles.status,
    requiresMFA: roles.requiresMFA,
    requiresApproval: roles.requiresApproval,
    canBeAssignedBy: roles.canBeAssignedBy,
    availableForPlanTiers: roles.availableForPlanTiers,
    minPlanTier: roles.minPlanTier,
    stats: roles.stats,
    color: roles.color,
    icon: roles.icon,
    badgeText: roles.badgeText,
    createdBy: roles.createdBy,
    lastModifiedBy: roles.lastModifiedBy,
    metadata: roles.metadata,
    notes: roles.notes,
    archivedAt: roles.archivedAt,
    archivedBy: roles.archivedBy,
    archivedReason: roles.archivedReason,
    deletedAt: roles.deletedAt,
    deletedBy: roles.deletedBy,
    createdAt: roles.createdAt,
    updatedAt: roles.updatedAt,
  } as const,

  admin: {
    id: roles.id,
    organizationId: roles.organizationId,
    name: roles.name,
    slug: roles.slug,
    displayName: roles.displayName,
    description: roles.description,
    code: roles.code,
    type: roles.type,
    scope: roles.scope,
    level: roles.level,
    priority: roles.priority,
    permissions: roles.permissions,
    restrictions: roles.restrictions,
    isSystemRole: roles.isSystemRole,
    isDefault: roles.isDefault,
    isProtected: roles.isProtected,
    isActive: roles.isActive,
    isHidden: roles.isHidden,
    status: roles.status,
    requiresMFA: roles.requiresMFA,
    requiresApproval: roles.requiresApproval,
    canBeAssignedBy: roles.canBeAssignedBy,
    availableForPlanTiers: roles.availableForPlanTiers,
    minPlanTier: roles.minPlanTier,
    stats: roles.stats,
    color: roles.color,
    icon: roles.icon,
    badgeText: roles.badgeText,
    createdBy: roles.createdBy,
    lastModifiedBy: roles.lastModifiedBy,
    changeHistory: roles.changeHistory,
    metadata: roles.metadata,
    notes: roles.notes,
    archivedAt: roles.archivedAt,
    archivedBy: roles.archivedBy,
    archivedReason: roles.archivedReason,
    deletedAt: roles.deletedAt,
    deletedBy: roles.deletedBy,
    createdAt: roles.createdAt,
    updatedAt: roles.updatedAt,
  } as const,
};
