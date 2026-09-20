// @/db/schema/auth/user-roles.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userRoleSourcePgEnum, userRoleStatusPgEnum } from "../shared/enums";
import { softDelete, tablePrefix, timestamps } from "../shared/schema-utils";
import { roles } from "./roles";
import { users } from "./users";

// ============================================
// TYPES FOR JSON FIELDS
// ============================================

export interface AssignmentHistoryEntry {
  timestamp: string;
  action: "assigned" | "changed" | "revoked" | "reactivated";
  performedBy: string;
  previousStatus?: string;
  notes?: string;
}

export interface UserRoleMetadata {
  source?: string;
  department?: string;
  team?: string;
  project?: string;
  customFields?: Record<string, unknown>;
}

// ============================================
// USER-ROLE ASSOCIATION TABLE
// ============================================

export const userRoles = pgTable(
  `${tablePrefix}user_roles`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().default(sql`gen_random_uuid()`),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // ASSIGNMENT SOURCE
    // ============================================
    source: userRoleSourcePgEnum("source").notNull().default("manual"),

    // Assignment context
    contextId: uuid("context_id"),
    contextType: varchar("context_type", { length: 50 }),

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
    // STATUS & STATE
    // ============================================
    status: userRoleStatusPgEnum("status").notNull().default("active"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isInherited: boolean("is_inherited").notNull().default(false),
    inheritedFrom: uuid("inherited_from"),

    // ============================================
    // APPROVAL WORKFLOW
    // ============================================
    requiresApproval: boolean("requires_approval").notNull().default(false),
    requiresMFA: boolean("requires_mfa").notNull().default(false),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvalNotes: text("approval_notes"),

    // ============================================
    // RESTRICTIONS OVERRIDES
    // ============================================
    restrictionsOverride: jsonb("restrictions_override")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),

    // ============================================
    // AUDIT & METADATA
    // ============================================
    assignmentHistory: jsonb("assignment_history")
      .$type<AssignmentHistoryEntry[]>()
      .default(sql`'[]'::jsonb`),

    reason: text("reason"),
    notes: text("notes"),

    metadata: jsonb("metadata").$type<UserRoleMetadata>().default(sql`'{}'::jsonb`),

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
    uniqueIndex(`${tablePrefix}user_roles_unique_idx`)
      .on(table.userId, table.roleId, table.contextId, table.contextType)
      .where(
        sql`
          ${table.status} = 'active' 
          AND ${table.revokedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    uniqueIndex(`${tablePrefix}user_roles_primary_unique_idx`)
      .on(table.userId)
      .where(
        sql`
          ${table.isPrimary} = true 
          AND ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // PERFORMANCE INDEXES
    // ============================================
    index(`${tablePrefix}user_roles_user_id_idx`).on(table.userId),
    index(`${tablePrefix}user_roles_role_id_idx`).on(table.roleId),
    index(`${tablePrefix}user_roles_assigned_by_idx`).on(table.assignedBy),
    index(`${tablePrefix}user_roles_approved_by_idx`).on(table.approvedBy),
    index(`${tablePrefix}user_roles_revoked_by_idx`).on(table.revokedBy),

    index(`${tablePrefix}user_roles_context_idx`).on(table.contextId, table.contextType),
    index(`${tablePrefix}user_roles_status_idx`).on(table.status),
    index(`${tablePrefix}user_roles_source_idx`).on(table.source),

    index(`${tablePrefix}user_roles_valid_from_idx`).on(table.validFrom),
    index(`${tablePrefix}user_roles_valid_until_idx`).on(table.validUntil),
    index(`${tablePrefix}user_roles_revoked_at_idx`).on(table.revokedAt),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index(`${tablePrefix}user_roles_active_idx`).on(table.userId, table.roleId, table.status),

    index(`${tablePrefix}user_roles_primary_active_idx`)
      .on(table.userId, table.isPrimary, table.status)
      .where(
        sql`
          ${table.isPrimary} = true 
          AND ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_context_active_idx`)
      .on(table.contextId, table.contextType, table.status)
      .where(
        sql`
          ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_expiring_idx`)
      .on(table.validUntil, table.status)
      .where(
        sql`
          ${table.validUntil} IS NOT NULL
          AND ${table.status} = 'active'
          AND ${table.revokedAt} IS NULL
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_recent_idx`)
      .on(table.createdAt, table.userId)
      .where(
        sql`
          ${table.revokedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_assigned_by_active_idx`)
      .on(table.assignedBy, table.status)
      .where(
        sql`
          ${table.revokedAt} IS NULL 
          AND ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_user_status_idx`)
      .on(table.userId, table.status, table.isPrimary)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index(`${tablePrefix}user_roles_restrictions_override_gin_idx`)
      .using("gin", table.restrictionsOverride)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_metadata_gin_idx`)
      .using("gin", table.metadata)
      .where(
        sql`
          ${table.deletedAt} IS NULL
        `,
      ),

    index(`${tablePrefix}user_roles_history_gin_idx`)
      .using("gin", table.assignmentHistory)
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

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [userRoles.approvedBy],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [userRoles.revokedBy],
    references: [users.id],
  }),
}));
