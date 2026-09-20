// db/core/rate-limits.ts
//
// Backing store for the sliding-window limiter in `src/lib/rate-limit.ts`.
//
// This table was referenced by `checkRateLimit()` from the day it was written
// but never actually defined, so the limiter failed on every call. That made
// the IP-level brute-force control (BR-AUTH-018) silently inoperative — and,
// because `checkRateLimit()` swallows its errors, the failure also poisoned any
// surrounding transaction (every later statement in the same transaction died
// with 25P02).

import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "../shared/schema-utils";

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    /**
     * Caller-defined bucket, e.g. `ip:203.0.113.7` or `user:<uuid>`.
     * Unique, because the limiter's `ON CONFLICT (key)` upsert needs an arbiter.
     */
    key: varchar("key", { length: 255 }).notNull().unique(),

    /** Attempts observed in the current window. */
    count: integer("count").notNull().default(1),

    /** Start of the window the current count belongs to. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),

    /** When this bucket may be reclaimed. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    ...timestamps,
  },
  (table) => [
    // Supports reclaiming expired buckets.
    index("rate_limits_expires_at_idx").on(table.expiresAt),
  ],
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
