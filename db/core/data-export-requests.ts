// db/core/data-export-requests.ts
//
// Phase 1 record for DSAR portability (NWB-P0-002, FR-AUTH-007 AC8): a user's
// request for a machine-readable export of their personal data. The Phase 1
// build is synchronous — the export is generated in the request handler and
// the payload is stored here with a download window. The Phase 2 queue
// (pg-boss) takes over generation later; the `status` vocabulary already
// reserves the queue states so the swap needs no schema change.
//
// The aspirational `db/compliance/dsar_requests` is the later module's
// case-management table (SLA tracking, linked tickets) and is intentionally
// not reused here — it is not part of the active schema.

import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "../shared/schema-utils";
import { users } from "./users";

export const DATA_EXPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "expired",
] as const;
export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

export const dataExportRequests = pgTable(
  "data_export_requests",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    /** The data subject. Cascades with the user: a purged account takes its exports along. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Who asked — the subject themselves, or an org admin on their behalf
     * (the DSAR ops channel). set-null so the record survives an admin purge.
     */
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),

    /** Phase 1 requests are always 'completed' (built synchronously). */
    status: varchar("status", { length: 20 }).notNull().default("completed"),

    /** The whole export, sections keyed by name (see dsar.service `meta.formatVersion`). */
    payload: jsonb("payload"),

    /** Download window end; reads after this instant answer 410. */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),

    ...timestamps,
  },
  (table) => [
    index("data_export_requests_user_idx").on(table.userId),
    index("data_export_requests_expires_at_idx").on(table.expiresAt),
  ],
);

export type DataExportRequest = typeof dataExportRequests.$inferSelect;
export type NewDataExportRequest = typeof dataExportRequests.$inferInsert;
