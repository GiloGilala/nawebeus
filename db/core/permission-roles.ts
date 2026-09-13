// @/db/schema/auth/permission-roles.ts

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
import { userRoleAssignmentStatusPgEnum } from "../shared/enums";
import { softDelete, tablePrefix, timestamps } from "../shared/schema-utils";
import { permissions } from "./permissions";
import { roles } from "./roles";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface PermissionCondition {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "nin"
    | "contains"
    | "startsWith"
    | "endsWith";
  value: unknown;
}

export interface AbacRule {
  attribute: string;
  operator: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
  value: string | string[];
}

export interface ResourceRestrictions {
  allowedResources?: string[];
  deniedResources?: string[];
  wildcardAllowed?: boolean;
}

export interface FieldRestrictions {
  allowedFields?: string[];
  deniedFields?: string[];
}

export interface PermissionChangeEntry {
  timestamp: string;
  changedBy: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
}

export interface RolePermissionMetadata {
  source?: string;
  department?: string;
  team?: string;
  project?: string;
  environment?: "development" | "staging" | "production";
  customFields?: Record<string, unknown>;
}

// ============================================
// PERMISSION-ROLE ASSOCIATION TABLE
// ============================================

export const rolePermissions = pgTable(
  `${tablePrefix}role_permissions`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // ============================================
    // PERMISSION ASSIGNMENT
    // ============================================
    allowed: boolean("allowed").notNull().default(true),
    priority: integer("priority").notNull().default(0),

    // ============================================
    // CONTEXTUAL OVERRIDES
    // ============================================
    conditions: jsonb("conditions").$type<PermissionCondition[]>().default(sql`'[]'::jsonb`),

    abacRules: jsonb("abac_rules").$type<AbacRule[]>().default(sql`'[]'::jsonb`),

    resourceRestrictions: jsonb("resource_restrictions")
      .$type<ResourceRestrictions>()
      .default(sql`'{}'::jsonb`),

    fieldRestrictions: jsonb("field_restrictions")
      .$type<FieldRestrictions>()
      .default(sql`'{}'::jsonb`),

    // ============================================
    // VALIDITY PERIOD
    // ============================================
    validFrom: timestamp("valid_from", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`now()`)
      .notNull(),
    validUntil: timestamp("valid_until", {
      withTimezone: true,
      mode: "date",
    }),

    // ============================================
    // ASSIGNMENT CONTEXT
    // ============================================
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    source: varchar("source", { length: 50 }).notNull().default("direct"),
    templateId: uuid("template_id"),

    // ============================================
    // STATUS & STATE
    // ============================================
    status: userRoleAssignmentStatusPgEnum().notNull().default("active"),

    isInherited: boolean("is_inherited").notNull().default(false),
    inheritedFrom: uuid("inherited_from"),

    // ============================================
    // AUDIT & METADATA
    // ============================================
    reason: text("reason"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<RolePermissionMetadata>().default(sql`'{}'::jsonb`),

    changeHistory: jsonb("change_history")
      .$type<PermissionChangeEntry[]>()
      .default(sql`'[]'::jsonb`),

    // ============================================
    // REVOCATION
    // ============================================
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
    revokedBy: uuid("revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    revokeReason: text("revoke_reason"),

    // ============================================
    // TIMESTAMPS
    // ============================================
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    // ============================================
    // UNIQUE INDEXES
    // ============================================
    uniqueIndex(`${tablePrefix}role_permissions_unique_idx`)
      .on(table.roleId, table.permissionId)
      .where(
        sql`
          ${table.status} = 'active' 
          AND ${table.revokedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}role_permissions_role_id_idx`).on(table.roleId),
    index(`${tablePrefix}role_permissions_permission_id_idx`).on(table.permissionId),
    index(`${tablePrefix}role_permissions_assigned_by_idx`).on(table.assignedBy),
    index(`${tablePrefix}role_permissions_revoked_by_idx`).on(table.revokedBy),

    index(`${tablePrefix}role_permissions_status_idx`).on(table.status),
    index(`${tablePrefix}role_permissions_priority_idx`).on(table.priority),
    index(`${tablePrefix}role_permissions_source_idx`).on(table.source),
    index(`${tablePrefix}role_permissions_template_id_idx`).on(table.templateId),

    index(`${tablePrefix}role_permissions_valid_from_idx`).on(table.validFrom),
    index(`${tablePrefix}role_permissions_valid_until_idx`).on(table.validUntil),
    index(`${tablePrefix}role_permissions_revoked_at_idx`).on(table.revokedAt),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index(`${tablePrefix}role_permissions_active_idx`).on(
      table.roleId,
      table.status,
      table.allowed,
    ),

    index(`${tablePrefix}role_permissions_priority_active_idx`).on(
      table.roleId,
      table.priority,
      table.allowed,
    ),

    index(`${tablePrefix}role_permissions_expiring_idx`)
      .on(table.validUntil, table.status)
      .where(
        sql`
          ${table.validUntil} IS NOT NULL
          AND ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_denied_idx`)
      .on(table.roleId, table.allowed, table.status)
      .where(
        sql`
          ${table.allowed} = false 
          AND ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_role_allowed_idx`)
      .on(table.roleId, table.allowed, table.status)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_valid_period_idx`)
      .on(table.validFrom, table.validUntil, table.status)
      .where(
        sql`
          ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}role_permissions_conditions_gin_idx`)
      .using("gin", table.conditions)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_abac_rules_gin_idx`)
      .using("gin", table.abacRules)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_resource_restrictions_gin_idx`)
      .using("gin", table.resourceRestrictions)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_field_restrictions_gin_idx`)
      .using("gin", table.fieldRestrictions)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}role_permissions_history_gin_idx`)
      .using("gin", table.changeHistory)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),
  ],
);

// ============================================
// RELATIONSHIPS
// ============================================

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
  assignedByUser: one(users, {
    fields: [rolePermissions.assignedBy],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [rolePermissions.revokedBy],
    references: [users.id],
  }),
}));
