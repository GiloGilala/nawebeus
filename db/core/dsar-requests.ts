// db/core/dsar-requests.ts
//
// DSAR export requests — the bookkeeping row for NDPR/GDPR data-subject
// access exports (FR-AUTH-007 AC8, NWB-P0-002).
//
// Phase 1 (this table): a synchronous export. The row is created `completed`
// with the JSON package stored inline in `payload`, and stays re-downloadable
// until `expires_at` (requested + 7 days) — after which GET returns 410.
//
// Phase 2 (planned): a queued worker replaces the inline flow; the row then
// lives a `pending → processing → completed` lifecycle and `payload` is
// replaced by an object-storage URL, matching the aspirational design in
// `db/compliance/index.ts`.
//
// Reuses the `dsar_type` / `dsar_status` enums that already ship in the wired
// schema (`db/shared/enums.ts`) rather than inventing parallel ones.
//
// `userId` carries NO foreign key on purpose — the same decision the
// aspirational compliance module documents: compliance records must survive
// user deletion, so a DSAR row may outlive its subject. (That module's
// `varchar(32)` ids are not copied — see NWB-P0-009's note on narrow ids.)

import { index, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { dsarStatusEnum, dsarTypeEnum } from "../shared/enums";
import { timestamps } from "../shared/schema-utils";

export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    // The data subject — whose personal data the package contains.
    userId: uuid("user_id").notNull(),
    // The actor who submitted the request (the subject itself, or an
    // Owner/Admin exporting on behalf of a member of their organization).
    requestedBy: uuid("requested_by").notNull(),
    // The organization context of the request. Set for admin-on-behalf
    // requests (both parties must be members — enforced in the service);
    // null for a pure self-service export.
    organizationId: uuid("organization_id"),

    // Only `access` exports are built in Phase 1; the enum column keeps the
    // door open for erasure/portability/rectification without a migration.
    type: dsarTypeEnum("type").notNull().default("access"),
    status: dsarStatusEnum("status").notNull().default("completed"),

    // The export artifact itself, stored inline in Phase 1 (bounded by the
    // per-section row cap). Replaced by a storage URL in Phase 2.
    payload: jsonb("payload"),
    // Per-section { rows, truncated } so a consumer can see what was capped
    // without downloading the package again.
    sectionCounts: jsonb("section_counts"),
    packageSize: integer("package_size"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // After this instant the package is no longer served (HTTP 410). The
    // delivery itself is immediate in Phase 1, so this bounds re-downloads
    // only — 7 days, mirroring the aspirational dataPackageExpiresAt default.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    ...timestamps,
  },
  (table) => [
    index("idx_dsar_requests_user").on(table.userId),
    index("idx_dsar_requests_expires").on(table.expiresAt),
  ],
);

export type DsarRequest = typeof dsarRequests.$inferSelect;
export type NewDsarRequest = typeof dsarRequests.$inferInsert;
