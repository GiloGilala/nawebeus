import { timestamp } from "drizzle-orm/pg-core";

/**
 * Shared table name prefix. Currently empty — all tables use their
 * bare name as the Postgres table name. If multi-tenant table prefixing
 * is needed in the future, this is the single point of change.
 */
export const tablePrefix = "";

/**
 * Standard created_at / updated_at timestamp columns.
 * Spread (…timestamps) into any table definition that needs them.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/**
 * Soft-delete column set.
 * Spread (…softDelete) into any table that needs soft-delete support.
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
