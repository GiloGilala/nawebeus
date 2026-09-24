import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import {
  contactInteractionDirectionEnum,
  contactInteractionOutcomeEnum,
  contactInteractionTypeEnum,
  contactKindEnum,
  followUpStatusEnum,
  interactionPriorityEnum,
  interactionVisibilityEnum,
} from "../shared/enums";

// =============================================================================
// CONTACTS (BASE TABLE)
// =============================================================================

/**
 * Base contact table — shared identity fields for all contact types.
 *
 * Implements the shared-PK inheritance pattern (also called table-per-type
 * or concrete-table inheritance). Every contact has one row here plus one
 * row in either journalists or influencers that shares the same primary key.
 *
 * Why a base table at all (v3 §2.3):
 *
 *   Without a base table, contact_interactions needs a polymorphic FK:
 *     contactType: 'journalist' | 'influencer'
 *     contactId: varchar  ← Postgres cannot enforce this as a real FK
 *
 *   With a base table, contact_interactions gets a real FK:
 *     contactId: varchar → contacts.id  ← enforced by Postgres
 *
 *   This matters because:
 *     - Cascading deletes work correctly (delete contact → delete interactions)
 *     - JOIN is straightforward: JOIN contacts ON contact_id = contacts.id
 *     - "Show me all interactions across journalists AND influencers" is
 *       one query against contact_interactions, not a UNION
 *     - Adding a third contact type (e.g. 'advertiser', 'vendor') adds
 *       a detail table, not a new polymorphic column everywhere
 *
 * Shared-PK inheritance mechanics:
 *   1. Insert into contacts first — generates the ID
 *   2. Insert into journalists or influencers with the SAME ID as PK
 *      (journalists.id references contacts.id with CASCADE)
 *   3. Delete from contacts cascades to the detail table
 *   4. To query a journalist with base fields:
 *      SELECT c.*, j.* FROM contacts c JOIN journalists j USING (id)
 *      WHERE c.id = $id
 *
 * organizationId scoping:
 *   Contacts are org-scoped — a journalist tracked by Organization A is
 *   not visible to Organization B even if it's the same real-world person.
 *   This is intentional: relationship data, NDPR consent, and interaction
 *   history are org-specific and should not leak across organizations.
 *
 *   If the same journalist is tracked by two orgs, they have two contacts
 *   rows. This is the correct model for a B2B SaaS — each org owns its
 *   own relationship data independently.
 *
 * isActive vs deletedAt:
 *   isActive  = soft-disable (reversible). Hidden from UI but interactions preserved.
 *               Used when a journalist leaves their outlet or an influencer
 *               becomes inactive but history must be retained.
 *   deletedAt = soft-delete (final). User explicitly deleted the record.
 *               Distinct from inactive so admins can distinguish "paused"
 *               from "removed" contacts in audit reports.
 *
 * displayName:
 *   Pre-formatted honorific-aware name e.g. 'Dr. John Smith', 'Prof. Jane Doe',
 *   'Mr. Smith'. Computed once and stored so list views don't rebuild the
 *   string on every render. NULL falls back to fullName at the UI layer.
 *
 * version:
 *   Optimistic locking counter. Application code MUST read the current version
 *   and include it in the WHERE clause of any UPDATE; if 0 rows are affected,
 *   the update is rejected and the client must re-fetch and retry.
 *   Prevents lost-update races when two users edit the same contact.
 *
 * relationshipScore:
 *   0–100 composite relationship health score.
 *   NEVER updated by application code. Only background workers.
 *   Calculated from: interaction recency, response rate, coverage/content quality.
 *
 * tags:
 *   Org-defined labels for filtering e.g. ['vip', 'pending-intro', 'q1-target'].
 *   Stored on the base table so they can be searched across all contact kinds.
 *
 * notes:
 *   Free-text field for internal relationship notes.
 *   Not shown to the contact — strictly internal.
 *
 * mergedIntoId:
 *   Populated when this contact was merged into another (deduplication).
 *   Merged contacts are kept for history but are excluded from active queries.
 *   All interactions referencing the merged contact are re-pointed to the
 *   surviving contact by the merge service.
 *   NOT a FK — merged contact must remain readable after the target is deleted.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: varchar("id", { length: 64 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),

    // ─── Kind ────────────────────────────────────────────────────────────────
    // Determines which detail table has the matching row
    kind: contactKindEnum("kind").notNull(),

    // ─── Shared Identity ─────────────────────────────────────────────────────
    fullName: varchar("full_name", { length: 200 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),

    // Pre-formatted honorific-aware name e.g. 'Dr. John Smith'
    // Computed once at creation/edit; NULL falls back to fullName in UI
    displayName: varchar("display_name", { length: 255 }),

    // ─── Contact Details ─────────────────────────────────────────────────────
    email: varchar("email", { length: 255 }),
    emailSecondary: varchar("email_secondary", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    whatsapp: varchar("whatsapp", { length: 20 }),
    telegram: varchar("telegram", { length: 100 }),

    // ─── Location ────────────────────────────────────────────────────────────
    // Free-text location e.g. 'Lagos, Nigeria' or 'Abuja'
    // Not normalized into city/state/country — kept flexible intentionally.
    // Splitting adds JOINs and rarely pays off at this scale.
    location: text("location"),

    // ─── Relationship Metadata ───────────────────────────────────────────────
    // User-defined labels for grouping and filtering
    tags: text("tags").array(),

    // Internal relationship notes — not visible to the contact
    notes: text("notes"),

    // ─── Scores (denormalized — updated by background jobs ONLY) ─────────────
    // 0–100 composite relationship health score.
    // NEVER updated by application code. Only background workers.
    relationshipScore: integer("relationship_score").default(0).notNull(),

    // When this contact was last interacted with (any interaction type)
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),

    // Total number of interactions recorded for this contact
    interactionCount: integer("interaction_count").default(0).notNull(),

    // ─── Lifecycle ───────────────────────────────────────────────────────────
    // Soft-disable (reversible) — contact is hidden from UI but interactions
    // are preserved. Used when a journalist leaves their outlet.
    isActive: boolean("is_active").default(true).notNull(),

    // Soft-delete (final, but recoverable) — distinct from isActive.
    // Set when the user explicitly deletes a contact. Survives backups
    // and admin restore is possible. Hard-delete is never used in app code.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: varchar("deleted_by_id", { length: 64 }),

    // Set when this contact was merged into another during deduplication.
    // NOT a FK — merged contacts are kept for history.
    mergedIntoId: varchar("merged_into_id", { length: 64 }),
    mergedAt: timestamp("merged_at", { withTimezone: true }),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter. Incremented on every update.
    // Application MUST: UPDATE ... SET version = version + 1 WHERE id = $1 AND version = $2
    // If affected rows = 0, the update is rejected (someone else updated first).
    version: integer("version").default(1).notNull(),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — contact record outlives the user who added it
    createdById: varchar("created_by_id", { length: 64 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // Merged contacts must have a mergedAt timestamp
    check(
      "chk_contacts_merged_consistency",
      sql`(${table.mergedIntoId} IS NULL) = (${table.mergedAt} IS NULL)`,
    ),

    // Soft-delete consistency: deletedAt ↔ deletedById must be set together
    check(
      "chk_contacts_deleted_consistency",
      sql`(${table.deletedAt} IS NULL) = (${table.deletedById} IS NULL)`,
    ),

    // relationshipScore must be within 0-100
    check("chk_contacts_relationship_score", sql`${table.relationshipScore} BETWEEN 0 AND 100`),

    // interactionCount must be non-negative
    check("chk_contacts_interaction_count", sql`${table.interactionCount} >= 0`),

    // version must be positive (starts at 1)
    check("chk_contacts_version", sql`${table.version} >= 1`),

    // ── Uniqueness (per organization scope) ──────────────────────────────────

    // Email is unique per org. Note: NULL values are not considered duplicates
    // in Postgres unique constraints, so multiple contacts without email are allowed.
    unique("uq_contacts_org_email").on(table.organizationId, table.email),

    // Phone is unique per org (same NULL semantics)
    unique("uq_contacts_org_phone").on(table.organizationId, table.phone),

    // ── Primary queries ───────────────────────────────────────────────────────

    // Contact list — active contacts of a given kind for an org
    index("idx_contacts_org_kind_active").on(table.organizationId, table.kind, table.isActive),

    // Relationship score ranking with kind filter
    index("idx_contacts_relationship_score").on(
      table.organizationId,
      table.kind,
      table.relationshipScore,
    ),

    // Merge target lookup — find contacts that have been merged
    index("idx_contacts_merged")
      .on(table.mergedIntoId)
      .where(sql`${table.mergedIntoId} IS NOT NULL`),

    // Recent interaction sort — "show me contacts I haven't talked to lately"
    index("idx_contacts_last_interaction").on(
      table.organizationId,
      table.kind,
      table.lastInteractionAt,
    ),

    // Composite: org + kind + score for "top contacts by kind" leaderboards
    index("idx_contacts_org_kind_score").on(
      table.organizationId,
      table.kind,
      table.relationshipScore,
    ),

    // Created-at timeline
    index("idx_contacts_org_created").on(table.organizationId, table.createdAt),

    // Tag filtering — GIN applied via raw SQL migration:
    // CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags)
    //   WHERE is_active = TRUE AND deleted_at IS NULL AND merged_into_id IS NULL;
    //
    // Full-text search — applied via raw SQL migration:
    // CREATE INDEX idx_contacts_fts ON contacts
    //   USING GIN(to_tsvector('english',
    //     full_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(notes, '')))
    //   WHERE is_active = TRUE AND deleted_at IS NULL AND merged_into_id IS NULL;
  ],
);

// journalists detail table lives in pr/index.ts (shared-PK inheritance from contacts)
// influencers detail table lives in influencer/index.ts (shared-PK inheritance from contacts)

// =============================================================================
// CONTACT INTERACTIONS
// =============================================================================

/**
 * Unified interaction log for all contact types.
 *
 * Replaces (never create these):
 *   prInteractions          (pr module — journalist-specific)
 *   influencerInteractions  (influencer module — influencer-specific)
 *
 * Why one table beats two per-type tables:
 *   "Show me the last 10 interactions across all contacts" is one query.
 *   "How many interactions has this team member had this week?" is one query.
 *   Follow-up reminders are one query across all contact types.
 *
 * Real FK on contactId (the key benefit of the contacts base table):
 *   With journalists + influencers as separate standalone tables, a
 *   contact_interactions table would need a polymorphic FK (no Postgres
 *   enforcement) or two nullable FKs (one always NULL — ugly, error-prone).
 *   With the contacts base table, contactId is a real enforced FK.
 *   Deleting a contact cascades to delete all their interactions.
 *
 * Interaction type coverage:
 *   Shared types:    email, whatsapp, phone_call, meeting, video_call,
 *                   dm, event, social_dm
 *   Journalist-only: interview_request, press_release_open,
 *                   coverage_published, briefing
 *   Influencer-only: content_review, negotiation,
 *                   campaign_briefing, contract_signed
 *   All in one enum — no per-type enum needed.
 *
 * Campaign context:
 *   campaignId → pr_initiatives.id OR influencer_programs.id
 *                (determined by contact kind — not enforced by DB)
 *   pressReleaseId → press_releases.id (journalist interactions only)
 *   assignmentId   → influencer_program_assignments.id (influencer only)
 *   distributionId → content_deliveries.id (journalist interactions only)
 *   All nullable — interactions can be logged without a campaign context.
 *   All non-FK intentionally — interactions are facts that must outlive
 *   the campaign/press release/assignment/delivery they reference.
 *
 * Append-only:
 *   No updatedAt — interactions are facts in the past, not mutable state.
 *   The one exception is followUpStatus / followUpCompletedAt which can
 *   change when a follow-up is completed, cancelled, or rescheduled.
 *   In practice, "rescheduling" is often handled by creating a new
 *   interaction with outcome='meeting_scheduled' rather than editing.
 *
 * followUpStatus (replaces boolean followUpCompleted):
 *   pending     — follow-up is required, not yet acted on
 *   completed   — follow-up was completed (followUpCompletedAt must be set)
 *   cancelled   — follow-up is no longer needed (e.g. conversation closed)
 *   rescheduled — a new followUpAt was set; this row is closed but referenced
 *                 from the new one via metadata.previousInteractionId
 *   The partial index on follow-up due dates uses status = 'pending'.
 *
 * durationMinutes:
 *   How long the interaction lasted. Useful for calls, meetings, video calls.
 *   NULL when duration is not applicable (e.g. a single email).
 *
 * priority:
 *   Drives reminder urgency and dashboard sorting.
 *   low/medium/high/urgent. Default medium.
 *
 * visibility:
 *   private      — only the creator can see this note
 *   internal     — all team members in the org
 *   organization — everyone in the org including future-hire (default)
 *   Distinguishes "I jotted this for myself" from "this is for the team".
 *
 * externalReference:
 *   External system ID for idempotent sync:
 *     - Gmail Message ID
 *     - WhatsApp message ID
 *     - Slack message TS
 *     - Zoom meeting ID
 *     - HubSpot engagement ID
 *   Unique per organization. Prevents duplicate interactions when the
 *   same message arrives via multiple channels (e.g. email-to-Slack bridge).
 *
 * metadata JSONB:
 *   Free-form, validated at the application layer for known shapes.
 *   Examples:
 *     { emailOpened: true, attachmentCount: 2, campaign: 'Spring 2025' }
 *     { gmailThreadId, gmailLabels }
 *     { zoomRecordingUrl }
 *   No new table — JSONB is the right call here.
 */
export const contactInteractions = pgTable(
  "contact_interactions",
  {
    id: varchar("id", { length: 64 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),

    // ─── Contact Reference ────────────────────────────────────────────────────
    // Real FK — enforced by Postgres via contacts base table
    contactId: varchar("contact_id", { length: 64 })
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),

    // ─── Campaign Context (all nullable, all intentionally non-FK) ────────────
    // pr_initiatives.id OR influencer_programs.id (determined by contact.kind)
    campaignId: varchar("campaign_id", { length: 64 }),

    // press_releases.id — journalist interactions only
    pressReleaseId: varchar("press_release_id", { length: 64 }),

    // influencer_program_assignments.id — influencer interactions only
    assignmentId: varchar("assignment_id", { length: 64 }),

    // content_deliveries.id — journalist distribution interactions only
    distributionId: varchar("distribution_id", { length: 64 }),

    // ─── Interaction Details ──────────────────────────────────────────────────
    interactionType: contactInteractionTypeEnum("interaction_type").notNull(),
    direction: contactInteractionDirectionEnum("direction"),

    // Subject line (emails, DMs) or meeting title
    subject: text("subject"),

    // Body/notes of the interaction — not shown to the contact
    content: text("content"),

    // What happened as a result of this interaction
    outcome: contactInteractionOutcomeEnum("outcome"),

    // How long until the contact responded (NULL = no response yet)
    responseTimeMinutes: integer("response_time_minutes"),

    // ─── Duration, Priority, Visibility ──────────────────────────────────────
    // NULL when duration is not applicable (e.g. single email)
    durationMinutes: integer("duration_minutes"),

    // Drives reminder urgency and dashboard sorting
    priority: interactionPriorityEnum("priority").default("medium").notNull(),

    // Who can see this note
    visibility: interactionVisibilityEnum("visibility").default("organization").notNull(),

    // ─── External Reference (for idempotent sync) ────────────────────────────
    // Gmail Message ID, WhatsApp ID, Slack TS, Zoom Meeting ID, etc.
    externalReference: varchar("external_reference", { length: 255 }),

    // ─── Flexible Metadata ───────────────────────────────────────────────────
    // { emailOpened, attachmentCount, campaign, source, ... }
    metadata: jsonb("metadata"),

    // ─── Follow-up ───────────────────────────────────────────────────────────
    // When a follow-up is due — queried by the follow-up reminder worker
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),

    // What the follow-up action should be
    followUpNote: text("follow_up_note"),

    // Replaces boolean followUpCompleted — see JSDoc above
    followUpStatus: followUpStatusEnum("follow_up_status").default("pending").notNull(),

    // Set when followUpStatus transitions to 'completed'
    followUpCompletedAt: timestamp("follow_up_completed_at", {
      withTimezone: true,
    }),

    // ─── Audit ───────────────────────────────────────────────────────────────
    // Not FK — interaction must outlive the user who logged it
    createdById: varchar("created_by_id", { length: 64 }).notNull(),

    // Append-only — no updatedAt (only followUp fields can change)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // followUpCompletedAt must be set when followUpStatus = 'completed'
    check(
      "chk_ci_followup_consistency",
      sql`NOT (
        ${table.followUpStatus} = 'completed'
        AND ${table.followUpCompletedAt} IS NULL
      )`,
    ),

    // responseTimeMinutes must be non-negative
    check(
      "chk_ci_response_time_positive",
      sql`${table.responseTimeMinutes} IS NULL
        OR ${table.responseTimeMinutes} >= 0`,
    ),

    // durationMinutes must be non-negative
    check(
      "chk_ci_duration_positive",
      sql`${table.durationMinutes} IS NULL
        OR ${table.durationMinutes} >= 0`,
    ),

    // ── Primary queries ───────────────────────────────────────────────────────

    // Contact interaction timeline — "show me all interactions with journalist X"
    index("idx_ci_contact_created").on(table.contactId, table.createdAt),

    // Org-level interaction feed — "show me all interactions this week"
    index("idx_ci_org_created").on(table.organizationId, table.createdAt),

    // Campaign context — "show me all interactions for PR campaign Y"
    index("idx_ci_campaign").on(table.campaignId, table.createdAt),

    // Press release context — "show me all journalist responses to release Z"
    index("idx_ci_press_release").on(table.pressReleaseId, table.createdAt),

    // Assignment context — "show me all interactions for assignment W"
    index("idx_ci_assignment").on(table.assignmentId, table.createdAt),

    // ── Follow-up worker ──────────────────────────────────────────────────────

    // Follow-ups due today — partial index keeps it tiny as the table grows
    index("idx_ci_followup_due")
      .on(table.followUpAt)
      .where(
        sql`${table.followUpAt} IS NOT NULL
          AND ${table.followUpStatus} = 'pending'`,
      ),

    // Creator's pending follow-ups — "what do I need to follow up on?"
    index("idx_ci_creator_followup").on(table.createdById, table.followUpAt),

    // ── Interaction type analytics ────────────────────────────────────────────

    // Interaction type breakdown — "how many phone calls vs emails this month?"
    index("idx_ci_type_created").on(table.organizationId, table.interactionType, table.createdAt),

    // Outcome reporting — "how many interactions resulted in coverage?"
    index("idx_ci_outcome_created").on(table.organizationId, table.outcome, table.createdAt),

    // Priority-based views — "show me urgent pending follow-ups"
    index("idx_ci_priority_status").on(table.priority, table.followUpStatus),

    // External reference lookup — idempotent sync from Gmail/WhatsApp/Slack
    unique("uq_ci_org_external_ref").on(table.organizationId, table.externalReference),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *   press_releases          WHERE target_journalists @> ARRAY[contacts.id]
 *   pr_coverage_attribution WHERE journalist_id = contacts.id
 *   content_deliveries      WHERE target_recipient_ids @> ARRAY[contacts.id]
 *   influencer_program_assignments WHERE influencer_id = contacts.id
 *
 * These are intentionally NOT modeled as Drizzle relations because:
 *   1. They cross module boundaries (PR ↔ Contacts, Influencer ↔ Contacts)
 *   2. They use array containment (@>) which is not expressible as a Drizzle `one`/`many`
 *   3. They are read-mostly — listing them as relations implies write semantics
 *      that the application doesn't actually use
 */

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  // All interactions with this contact
  interactions: many(contactInteractions, {
    relationName: "contact_interactions",
  }),

  // The contact this was merged into (if merged)
  mergedInto: one(contacts, {
    fields: [contacts.mergedIntoId],
    references: [contacts.id],
    relationName: "contact_merges",
  }),
  // Contacts that were merged into this one
  mergedFrom: many(contacts, {
    relationName: "contact_merges",
  }),
}));

export const contactInteractionsRelations = relations(contactInteractions, ({ one }) => ({
  // Base contact row (real FK — enforced by Postgres)
  contact: one(contacts, {
    fields: [contactInteractions.contactId],
    references: [contacts.id],
    relationName: "contact_interactions",
  }),
}));
