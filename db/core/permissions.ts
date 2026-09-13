// @/db/schemas/auth/permissions.ts
// ============================================
// PERMISSIONS DATABASE SCHEMA
// Drizzle ORM schema for fine-grained permission management
//
// SOURCE OF TRUTH NOTE:
// A user's permissions are determined ENTIRELY through their role:
//   organization_members (user's membership in an organization)
//     -> roles (what role does this user have)
//       -> role_permissions (what can that role do) - COMING SOON
//         -> permissions (definition of each permission)
//
// There is no per-user direct-grant table. If a user needs a
// permission their role doesn't have, the answer is a new/adjusted
// role — not a one-off grant on the user.
//
// `roles.permissions` (JSONB) and `users.permissions` (JSONB) elsewhere
// in the schema are DERIVED CACHES ONLY — they exist for fast reads and
// must be rebuilt whenever `role_permissions` changes. No business logic
// should write permission *grants* directly into those JSONB columns.
// See resolveEffectivePermissions() in the auth service layer.
// ============================================

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
import { organizations } from "../organization/organizations";
import {
  permissionScopePgEnum,
  permissionStatusPgEnum,
  permissionTypePgEnum,
  securityLevelPgEnum,
} from "../shared/enums";
import { tablePrefix, timestamps } from "../shared/schema-utils";
import { rolePermissions } from "./permission-roles";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface PermissionMetadata {
  tags?: string[];
  dependencies?: string[];
  notes?: string;
  examples?: string[];
  alternativePermissions?: string[];
  impliedPermissions?: string[]; // NEW: Permissions this implies
  customFields?: Record<string, unknown>;
}

export interface PermissionGroupMetadata {
  tags?: string[];
  dependencies?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
}

// ============================================
// PERMISSIONS TABLE
// ============================================

export const permissions = pgTable(
  `${tablePrefix}permissions`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // PERMISSION IDENTITY
    // ============================================
    // permissionString is the primary identifier: "resource.action"
    // Examples: "users.create", "posts.publish", "organization.manage"
    permissionString: varchar("permission_string", { length: 255 }).notNull().unique(),

    // Derived from permissionString for easier querying
    resource: varchar("resource", { length: 100 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),

    // ============================================
    // PERMISSION HIERARCHY (NEW)
    // ============================================
    parentPermissionId: uuid("parent_permission_id").references((): any => permissions.id, {
      onDelete: "set null",
    }),

    // ============================================
    // CLASSIFICATION
    // ============================================
    type: permissionTypePgEnum("type").notNull().default("system"),
    scope: permissionScopePgEnum("scope").notNull().default("organization"),

    organizationId: uuid("organization_id").references((): any => organizations.id, {
      onDelete: "cascade",
    }),

    // ============================================
    // METADATA
    // ============================================
    name: varchar("name", { length: 200 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    description: text("description"),
    category: varchar("category", { length: 100 }),

    // CHANGED: groupId instead of groupCode (FK to permission_groups)
    groupId: uuid("group_id").references((): any => permissionGroups.id, {
      onDelete: "set null",
    }),

    // ============================================
    // SECURITY & SENSITIVITY
    // ============================================
    sensitivity: securityLevelPgEnum("sensitivity").notNull().default("medium"),
    requiresMFA: boolean("requires_mfa").notNull().default(false),
    requiresApproval: boolean("requires_approval").notNull().default(false),

    // ============================================
    // STATUS & AVAILABILITY
    // ============================================
    status: permissionStatusPgEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),

    minPlanTier: varchar("min_plan_tier", { length: 50 }),
    availableForPlanTiers: jsonb("available_for_plan_tiers")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),

    // ============================================
    // VERSIONING (NEW)
    // ============================================
    version: integer("version").notNull().default(1),

    // ============================================
    // AUDIT & METADATA
    // ============================================
    notes: text("notes"),
    metadata: jsonb("metadata").$type<PermissionMetadata>().default(sql`'{}'::jsonb`),

    createdBy: uuid("created_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references((): any => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // TIMESTAMPS
    // ============================================
    ...timestamps,

    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references((): any => users.id, {
      onDelete: "set null",
    }),

    deprecatedAt: timestamp("deprecated_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}permissions_string_unique_idx`)
      .on(table.permissionString)
      .where(sql`${table.deletedAt} IS NULL`),

    uniqueIndex(`${tablePrefix}permissions_resource_action_unique_idx`)
      .on(table.resource, table.action, table.organizationId)
      .where(sql`${table.organizationId} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}permissions_resource_idx`).on(table.resource),
    index(`${tablePrefix}permissions_action_idx`).on(table.action),
    index(`${tablePrefix}permissions_type_idx`).on(table.type),
    index(`${tablePrefix}permissions_scope_idx`).on(table.scope),
    index(`${tablePrefix}permissions_status_idx`).on(table.status),
    index(`${tablePrefix}permissions_category_idx`).on(table.category),
    index(`${tablePrefix}permissions_group_id_idx`).on(table.groupId), // CHANGED
    index(`${tablePrefix}permissions_organization_idx`).on(table.organizationId),
    index(`${tablePrefix}permissions_created_by_idx`).on(table.createdBy),
    index(`${tablePrefix}permissions_deprecated_at_idx`).on(table.deprecatedAt),
    index(`${tablePrefix}permissions_parent_permission_idx`).on(table.parentPermissionId), // NEW

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index(`${tablePrefix}permissions_active_idx`)
      .on(table.isActive, table.status)
      .where(
        sql`${table.isActive} = true AND ${table.status} = 'active' AND ${table.deletedAt} IS NULL`,
      ),

    index(`${tablePrefix}permissions_org_active_idx`)
      .on(table.organizationId, table.isActive, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}permissions_scope_active_idx`)
      .on(table.scope, table.isActive, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}permissions_category_scope_idx`)
      .on(table.category, table.scope, table.isActive)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}permissions_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}permissions_plan_tiers_gin_idx`)
      .using("gin", table.availableForPlanTiers)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// PERMISSION GROUPS TABLE
// ============================================

export const permissionGroups = pgTable(
  `${tablePrefix}permission_groups`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    code: varchar("code", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    description: text("description"),

    // ============================================
    // CLASSIFICATION
    // ============================================
    category: varchar("category", { length: 100 }).notNull(),
    type: permissionTypePgEnum("type").notNull().default("system"),
    scope: permissionScopePgEnum("scope").notNull().default("organization"),

    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    // ============================================
    // SECURITY
    // ============================================
    sensitivity: securityLevelPgEnum("sensitivity").notNull().default("medium"),
    requiresMFA: boolean("requires_mfa").notNull().default(false),

    // ============================================
    // STATUS
    // ============================================
    status: permissionStatusPgEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(true),
    isHidden: boolean("is_hidden").notNull().default(false),

    // ============================================
    // UI
    // ============================================
    color: varchar("color", { length: 50 }),
    icon: varchar("icon", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),

    // ============================================
    // METADATA
    // ============================================
    metadata: jsonb("metadata").$type<PermissionGroupMetadata>().default(sql`'{}'::jsonb`),
    notes: text("notes"),

    // ============================================
    // AUDIT
    // ============================================
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // TIMESTAMPS
    // ============================================
    ...timestamps,

    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}permission_groups_code_unique_idx`)
      .on(table.code)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}permission_groups_category_idx`).on(table.category),
    index(`${tablePrefix}permission_groups_type_idx`).on(table.type),
    index(`${tablePrefix}permission_groups_status_idx`).on(table.status),
    index(`${tablePrefix}permission_groups_organization_idx`).on(table.organizationId),
    index(`${tablePrefix}permission_groups_created_by_idx`).on(table.createdBy),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index(`${tablePrefix}permission_groups_active_idx`)
      .on(table.isActive, table.status, table.type)
      .where(sql`${table.deletedAt} IS NULL`),

    index(`${tablePrefix}permission_groups_org_active_idx`)
      .on(table.organizationId, table.isActive, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}permission_groups_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================

// @/db/schemas/auth/permissions.ts

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [permissions.organizationId],
    references: [organizations.id],
  }),
  group: one(permissionGroups, {
    fields: [permissions.groupId],
    references: [permissionGroups.id],
  }),
  parentPermission: one(permissions, {
    fields: [permissions.parentPermissionId],
    references: [permissions.id],
    relationName: "permissionHierarchy",
  }),
  childPermissions: many(permissions, {
    relationName: "permissionHierarchy",
  }),
  createdByUser: one(users, {
    fields: [permissions.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [permissions.updatedBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [permissions.deletedBy],
    references: [users.id],
  }),
  // NEW: Add rolePermissions relation
  rolePermissions: many(rolePermissions), // Import from './role-permissions'
}));

export const permissionGroupsRelations = relations(permissionGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [permissionGroups.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [permissionGroups.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [permissionGroups.updatedBy],
    references: [users.id],
  }),
  deletedByUser: one(users, {
    fields: [permissionGroups.deletedBy],
    references: [users.id],
  }),
  permissions: many(permissions),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type PermissionTable = typeof permissions;

export type PermissionGroup = typeof permissionGroups.$inferSelect;
export type NewPermissionGroup = typeof permissionGroups.$inferInsert;
export type PermissionGroupTable = typeof permissionGroups;

// ============================================
// HELPER SELECTORS
// ============================================

export const permissionSelectors = {
  basic: {
    id: permissions.id,
    permissionString: permissions.permissionString,
    resource: permissions.resource,
    action: permissions.action,
    name: permissions.name,
    displayName: permissions.displayName,
    category: permissions.category,
    groupId: permissions.groupId,
  } as const,

  safe: {
    id: permissions.id,
    permissionString: permissions.permissionString,
    resource: permissions.resource,
    action: permissions.action,
    name: permissions.name,
    displayName: permissions.displayName,
    description: permissions.description,
    category: permissions.category,
    groupId: permissions.groupId,
    type: permissions.type,
    scope: permissions.scope,
    sensitivity: permissions.sensitivity,
    requiresMFA: permissions.requiresMFA,
    isActive: permissions.isActive,
    isSystem: permissions.isSystem,
    status: permissions.status,
    version: permissions.version,
    createdAt: permissions.createdAt,
  } as const,

  admin: {
    id: permissions.id,
    permissionString: permissions.permissionString,
    resource: permissions.resource,
    action: permissions.action,
    name: permissions.name,
    displayName: permissions.displayName,
    description: permissions.description,
    category: permissions.category,
    groupId: permissions.groupId,
    type: permissions.type,
    scope: permissions.scope,
    sensitivity: permissions.sensitivity,
    requiresMFA: permissions.requiresMFA,
    requiresApproval: permissions.requiresApproval,
    isActive: permissions.isActive,
    isSystem: permissions.isSystem,
    isHidden: permissions.isHidden,
    status: permissions.status,
    minPlanTier: permissions.minPlanTier,
    availableForPlanTiers: permissions.availableForPlanTiers,
    version: permissions.version,
    parentPermissionId: permissions.parentPermissionId,
    metadata: permissions.metadata,
    notes: permissions.notes,
    createdBy: permissions.createdBy,
    updatedBy: permissions.updatedBy,
    deprecatedAt: permissions.deprecatedAt,
    deletedAt: permissions.deletedAt,
    deletedBy: permissions.deletedBy,
    createdAt: permissions.createdAt,
    updatedAt: permissions.updatedAt,
  } as const,
};

export const permissionGroupSelectors = {
  basic: {
    id: permissionGroups.id,
    code: permissionGroups.code,
    name: permissionGroups.name,
    displayName: permissionGroups.displayName,
    category: permissionGroups.category,
    type: permissionGroups.type,
  } as const,

  full: {
    id: permissionGroups.id,
    code: permissionGroups.code,
    name: permissionGroups.name,
    displayName: permissionGroups.displayName,
    description: permissionGroups.description,
    category: permissionGroups.category,
    type: permissionGroups.type,
    scope: permissionGroups.scope,
    sensitivity: permissionGroups.sensitivity,
    requiresMFA: permissionGroups.requiresMFA,
    isActive: permissionGroups.isActive,
    isSystem: permissionGroups.isSystem,
    isHidden: permissionGroups.isHidden,
    status: permissionGroups.status,
    color: permissionGroups.color,
    icon: permissionGroups.icon,
    sortOrder: permissionGroups.sortOrder,
    metadata: permissionGroups.metadata,
    notes: permissionGroups.notes,
    createdBy: permissionGroups.createdBy,
    updatedBy: permissionGroups.updatedBy,
    deletedAt: permissionGroups.deletedAt,
    deletedBy: permissionGroups.deletedBy,
    createdAt: permissionGroups.createdAt,
    updatedAt: permissionGroups.updatedAt,
  } as const,
};
