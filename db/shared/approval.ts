import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  approvableEntityTypeEnum,
  approvalActionEnum,
  approvalRequestStatusEnum,
} from "../shared/enums";

// =============================================================================
// APPROVAL REQUESTS
// =============================================================================

/**
 * Shared approval request table used by all approvable entity types.
 *
 * Replaces (never create these):
 *   engagementApprovalRequests (engagement module — per-response approval)
 *   approvalHistory table      (publishing module — separate history table)
 *   Per-entity JSONB approval  (posts.approvalHistory, press_releases inline)
 *
 * Why one shared relational table beats per-module tables or JSONB:
 *
 *   Per-module tables:
 *     "Show me everything pending my approval" requires UNION across
 *     3 tables. Adding a new approvable entity type requires a new table.
 *     Index duplication — every module needs the same currentApproverId index.
 *
 *   JSONB history on entity:
 *     Cannot COUNT events: SELECT COUNT(*) FROM posts.approvalHistory...
 *     Cannot GROUP BY action: impossible without jsonb_array_elements()
 *     Cannot index individual events for fast approver-queue queries
 *     Cannot enforce referential integrity on actorId fields
 *     Parallel approval (multiple approvers at same stage) requires
 *     complex nested JSONB that becomes unmaintainable
 *
 *   This table:
 *     "Show me everything pending my approval across all entity types":
 *       SELECT * FROM approval_requests
 *       WHERE current_approver_id = $1 AND status = 'pending'
 *       — one query, one index, works for posts + press releases + responses
 *
 *     "How many approvals did this user make this month?":
 *       SELECT COUNT(*) FROM approval_history
 *       WHERE actor_id = $1 AND action = 'approved'
 *       AND created_at BETWEEN $start AND $end
 *
 *     "What is the average approval cycle time for press releases?":
 *       SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)
 *       FROM approval_requests
 *       WHERE entity_type = 'press_release'
 *       AND status = 'approved'
 *
 * ── Entity types ──────────────────────────────────────────────────────────────
 *
 * entityType='post':
 *   entityId → posts.id
 *   Triggered when: posts.requiresApproval = TRUE and post is submitted
 *   posts table keeps: currentApprovalRequestId (nullable FK, convenience)
 *
 * entityType='press_release':
 *   entityId → press_releases.id
 *   Triggered when: press release moves from draft to review
 *   press_releases table keeps: currentApprovalRequestId (nullable FK)
 *
 * entityType='engagement_response':
 *   entityId → engagement_responses.id
 *   Triggered when: engagement_responses.requiresApproval = TRUE
 *   engagement_responses table keeps: currentApprovalRequestId (nullable FK)
 *
 * ── approvalChain JSONB ───────────────────────────────────────────────────────
 *
 * Canonical shape — strictly enforced at the application layer via Zod.
 * One array of step objects in evaluation order. Empty arrays are rejected.
 *
 * Sequential approval (most common):
 * [
 *   { order: 1, userId: "usr_abc", role: "manager", isParallel: false },
 *   { order: 2, userId: "usr_def", role: "admin",   isParallel: false }
 * ]
 * Order 1 must approve before order 2 is notified.
 *
 * Parallel approval (any one of a group can approve):
 * [
 *   { order: 1, userId: "usr_abc", role: "manager", isParallel: true  },
 *   { order: 1, userId: "usr_def", role: "manager", isParallel: true  },
 *   { order: 2, userId: "usr_ghi", role: "admin",   isParallel: false }
 * ]
 * Any userId with order=1 can approve; order=2 is then notified.
 *
 * Single approver (simplest case):
 * [
 *   { order: 1, userId: "usr_abc", role: "admin", isParallel: false }
 * ]
 *
 * Role-based (approver determined at runtime):
 * [
 *   { order: 1, userId: null, role: "admin", isParallel: false }
 * ]
 * userId=null means any user with that role can approve.
 * currentApproverId is set to the first admin who views the request.
 *
 * Validation rules enforced in application code (Zod):
 *   - chain is a non-empty array
 *   - every step has order >= 1
 *   - userId is null OR a 32-char id
 *   - role is one of: 'manager', 'admin', 'owner'
 *   - isParallel is boolean
 *   - if multiple steps share the same order, isParallel must be true
 *
 * ── Status flow ───────────────────────────────────────────────────────────────
 *
 * pending → approved         (all required approvers approved)
 *        → rejected          (any approver rejects)
 *        → changes_requested (approver requests edits)
 *        → escalated         (expiresAt passed without decision;
 *                             escalation notification sent)
 *        → expired           (escalated but still no decision after
 *                             a second window)
 *        → recalled          (requester withdraws submission)
 *
 * When status = 'changes_requested':
 *   The entity is returned to the requester for editing.
 *   A new approval_request is created when re-submitted.
 *   The old request stays in the DB for history.
 *
 * ── Denormalized convenience fields on entities ───────────────────────────────
 *
 * posts, press_releases, and engagement_responses each have:
 *   currentApprovalRequestId VARCHAR(32) — nullable FK to approval_requests.id
 *   approvalStatus           (enum) — mirrors approval_requests.status
 *
 * These are write-through denorms updated whenever approval_requests changes.
 * Source of truth is always approval_requests.
 * They exist to avoid a JOIN on the entity list view.
 *
 * ── Concurrency ───────────────────────────────────────────────────────────────
 *
 * version:
 *   Optimistic locking counter. Application code MUST issue:
 *     UPDATE approval_requests
 *     SET status = $newStatus, currentApproverId = $next, version = version + 1
 *     WHERE id = $id AND version = $currentVersion
 *   If 0 rows are affected, the update is rejected and the caller must
 *   re-fetch and retry. Prevents two admins acting on the same approval
 *   simultaneously from corrupting the chain.
 *
 * ── contentSnapshot ───────────────────────────────────────────────────────────
 *
 * Immutable snapshot of the entity content at submission time.
 * NEVER updated. Reviewers see exactly what was submitted, even if the
 * entity is later edited (which creates a NEW approval_request).
 *
 * Shape varies by entityType:
 *   post:               { title, sharedContent, platformVariants, version }
 *   press_release:      { title, headline, body, version }
 *   engagement_response:{ content, messageId, characterCount, version }
 *
 * entityVersion:
 *   Version of the entity when this request was created.
 *   Matches posts.version / press_releases.version at submission time.
 *   Always present — every approval must know which entity version it belongs to.
 */
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Entity Reference ────────────────────────────────────────────────────
    entityType: approvableEntityTypeEnum("entity_type").notNull(),

    // Not FK — approval record must survive entity deletion
    // (deleted post's approval history must remain for audit purposes)
    entityId: varchar("entity_id", { length: 32 }).notNull(),

    // ─── Requester ───────────────────────────────────────────────────────────
    // Not FK — approval record outlives user records
    requesterId: varchar("requester_id", { length: 32 }).notNull(),

    // ─── Approval Chain ──────────────────────────────────────────────────────
    // Canonical shape — see JSDoc above. Set at creation and never modified.
    approvalChain: jsonb("approval_chain").notNull(),

    // The approver whose turn it currently is.
    // NULL when: status is terminal (approved, rejected, expired, recalled)
    // Set when: status = 'pending' (next approver's turn)
    // Not FK — approval record outlives user records
    currentApproverId: varchar("current_approver_id", { length: 32 }),

    // Current step in the chain (1-based)
    // Bounded 1..100 to catch runaway chains from bad data
    currentStep: integer("current_step").default(1).notNull(),

    // ─── Status ──────────────────────────────────────────────────────────────
    status: approvalRequestStatusEnum("status").default("pending").notNull(),

    // ─── Content Snapshot ────────────────────────────────────────────────────
    // Immutable snapshot — NEVER updated after insert
    contentSnapshot: jsonb("content_snapshot"),

    // Version of the entity when this request was created.
    // Always required (notNull) — every approval must know its entity version.
    entityVersion: integer("entity_version").notNull(),

    // ─── Timing ──────────────────────────────────────────────────────────────
    // When the request expires if no decision is made
    // NULL = no expiry (approval request stays pending indefinitely)
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // When the final decision was made (approved/rejected/recalled/expired)
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // ─── Escalation ──────────────────────────────────────────────────────────
    // When the escalation notification was sent
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),

    // Who was notified as the escalation recipient
    // Not FK — approval record outlives user records
    escalatedToId: varchar("escalated_to_id", { length: 32 }),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter — see JSDoc above.
    version: integer("version").default(1).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // currentStep must be between 1 and 100
    check("chk_apr_current_step_range", sql`${table.currentStep} BETWEEN 1 AND 100`),

    // entityVersion must be positive
    check("chk_apr_entity_version", sql`${table.entityVersion} >= 1`),

    // version must be positive (starts at 1)
    check("chk_apr_version", sql`${table.version} >= 1`),

    // completedAt must be set when status is terminal
    check(
      "chk_apr_completed_at_terminal",
      sql`NOT (
        ${table.status} IN ('approved', 'rejected', 'expired', 'recalled')
        AND ${table.completedAt} IS NULL
      )`,
    ),

    // completedAt must be >= createdAt
    check(
      "chk_apr_completed_after_created",
      sql`${table.completedAt} IS NULL
        OR ${table.completedAt} >= ${table.createdAt}`,
    ),

    // escalatedAt must be >= createdAt
    check(
      "chk_apr_escalated_after_created",
      sql`${table.escalatedAt} IS NULL
        OR ${table.escalatedAt} >= ${table.createdAt}`,
    ),

    // expiresAt must be after createdAt when set
    check(
      "chk_apr_expires_after_created",
      sql`${table.expiresAt} IS NULL
        OR ${table.expiresAt} > ${table.createdAt}`,
    ),

    // State consistency: pending requests must have a current approver
    check(
      "chk_apr_pending_has_approver",
      sql`NOT (
        ${table.status} = 'pending'
        AND ${table.currentApproverId} IS NULL
      )`,
    ),

    // State consistency: terminal requests must NOT have a current approver
    check(
      "chk_apr_terminal_no_approver",
      sql`NOT (
        ${table.status} IN ('approved', 'rejected', 'expired', 'recalled')
        AND ${table.currentApproverId} IS NOT NULL
      )`,
    ),

    // ── Primary approver queue ────────────────────────────────────────────────

    // "Show me everything pending my approval" — the most important query
    // Used by the approver inbox on the dashboard
    index("idx_apr_current_approver_pending")
      .on(table.currentApproverId, table.status)
      .where(sql`${table.status} = 'pending'`),

    // Org-level approval queue — all pending requests for the org
    index("idx_apr_org_status").on(table.organizationId, table.status, table.createdAt),

    // Dashboard query: pending requests by org + current approver + status
    index("idx_apr_org_approver_status").on(
      table.organizationId,
      table.currentApproverId,
      table.status,
    ),

    // ── Entity lookup ─────────────────────────────────────────────────────────

    // "Show me all approval requests for post XYZ"
    // Used by entity detail pages to show approval timeline
    index("idx_apr_entity").on(table.entityType, table.entityId, table.createdAt),

    // ── Requester queue ───────────────────────────────────────────────────────

    // "Show me all requests I submitted"
    index("idx_apr_requester").on(table.requesterId, table.status, table.createdAt),

    // Requester timeline — newest first
    index("idx_apr_requester_created").on(table.organizationId, table.requesterId, table.createdAt),

    // ── Escalation worker ─────────────────────────────────────────────────────

    // Requests past expiresAt with no decision
    index("idx_apr_expiry_pending")
      .on(table.expiresAt)
      .where(
        sql`${table.status} = 'pending'
          AND ${table.expiresAt} IS NOT NULL`,
      ),

    // ── Analytics ────────────────────────────────────────────────────────────

    // Approval cycle time reporting — completed requests by entity type
    index("idx_apr_completed_entity_type").on(table.entityType, table.completedAt),
  ],
);

// =============================================================================
// APPROVAL HISTORY
// =============================================================================

/**
 * Append-only log of every action taken on an approval request.
 *
 * One row per action. Never updated after insert.
 *
 * Why relational (not JSONB array on approval_requests):
 *   - COUNT actions by type: SELECT COUNT(*) WHERE action = 'approved'
 *   - Filter by actor: WHERE actor_id = $userId
 *   - Time-range queries: WHERE created_at BETWEEN $start AND $end
 *   - Join with users table for actor display name
 *   All impossible or expensive with JSONB arrays.
 *
 * Actions and what triggers them:
 *
 *   'submitted':
 *     Requester submits content for review.
 *     Written when: approval_request is created.
 *     actorId = requesterId
 *
 *   'approved':
 *     Approver approves the content.
 *     Written when: approver clicks "Approve".
 *     actorId = approver's userId
 *     If more approvers remain in chain: currentApproverId advances to next.
 *     If last approver: request.status → 'approved', entity published/activated.
 *
 *   'rejected':
 *     Approver rejects the content.
 *     Written when: approver clicks "Reject".
 *     actorId = approver's userId
 *     request.status → 'rejected', entity.status → 'changes_requested'
 *     requester notified.
 *     comment is REQUIRED — enforced by chk_aph_rejection_comment.
 *
 *   'changes_requested':
 *     Approver requests edits before re-submission.
 *     Written when: approver clicks "Request Changes".
 *     actorId = approver's userId
 *     request.status → 'changes_requested'
 *     Entity is returned to requester for editing.
 *     Requester must re-submit (creates new approval_request).
 *     comment is REQUIRED — enforced by chk_aph_changes_requested_comment.
 *
 *   'recalled':
 *     Requester withdraws the submission.
 *     Written when: requester clicks "Recall".
 *     actorId = requesterId
 *     request.status → 'recalled'
 *
 *   'escalated':
 *     No decision within escalation window.
 *     Written when: escalation worker fires.
 *     actorId = 'system' (literal, not a user ID)
 *     request.status → 'escalated'
 *     escalation notification sent to escalation recipients.
 *
 *   'delegated':
 *     Approver transfers their responsibility to another user.
 *     Written when: approver clicks "Delegate to...".
 *     actorId = delegating approver
 *     metadata = { delegatedToId, delegatedToName }
 *     currentApproverId updated to delegatedToId.
 *
 *   'reminder_sent':
 *     Automated reminder notification sent to currentApproverId.
 *     Written when: reminder worker fires (default: 24h after submission).
 *     actorId = 'system'
 *
 * comment field:
 *   Free-text comment from the actor.
 *   Required (DB-enforced) for:
 *     'rejected'           — rejectionReason must be provided
 *     'changes_requested'  — change description must be provided
 *   Optional for: approved, recalled, delegated
 *   NULL for: submitted, escalated, reminder_sent
 *
 * metadata field:
 *   Action-specific structured data:
 *   delegated:        { delegatedToId, delegatedToName }
 *   escalated:        { escalatedToId, escalatedToName, minutesOverdue }
 *   reminder_sent:    { reminderNumber, nextReminderAt }
 *   approved (chain): { nextApproverId, nextApproverName, remainingSteps }
 */
export const approvalHistory = pgTable(
  "approval_history",
  {
    id: varchar("id", { length: 32 }).notNull().primaryKey(),

    // FK to approval_requests — real FK (history row cannot outlive request)
    approvalRequestId: varchar("approval_request_id", { length: 32 })
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),

    // ─── Action ──────────────────────────────────────────────────────────────
    action: approvalActionEnum("action").notNull(),

    // Not FK — history must survive actor leaving the org
    // 'system' literal string for system-generated actions (escalation, reminders)
    actorId: varchar("actor_id", { length: 32 }).notNull(),

    // ─── Content ─────────────────────────────────────────────────────────────
    // Required for 'rejected' and 'changes_requested' — enforced at DB layer
    comment: text("comment"),

    // Action-specific structured payload — see JSDoc above for per-action shapes
    metadata: jsonb("metadata"),

    // Append-only — no updatedAt, ever
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // 'rejected' actions MUST have a comment (was previously app-layer only)
    check(
      "chk_aph_rejection_comment",
      sql`NOT (
        ${table.action} = 'rejected'
        AND ${table.comment} IS NULL
      )`,
    ),

    // 'changes_requested' actions MUST have a comment
    check(
      "chk_aph_changes_requested_comment",
      sql`NOT (
        ${table.action} = 'changes_requested'
        AND ${table.comment} IS NULL
      )`,
    ),

    // ── Primary lookups ───────────────────────────────────────────────────────

    // Full history for a request (approval timeline display)
    index("idx_aph_request_created").on(table.approvalRequestId, table.createdAt),

    // Actor history — "show me all approvals this user made this month"
    index("idx_aph_actor_action").on(table.actorId, table.action, table.createdAt),

    // Action type analytics — approval/rejection rates, cycle times
    index("idx_aph_action_created").on(table.action, table.createdAt),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Cross-module relations (resolved at the application layer, not by Drizzle):
 *   approval_requests.entityType + entityId →
 *     posts.id | press_releases.id | engagement_responses.id
 *
 *   approval_history.actorId → users.id (or 'system' literal)
 *
 * These are intentionally NOT modeled as Drizzle relations because:
 *   1. The entity reference is polymorphic (entityType discriminates)
 *   2. actorId may be the literal string 'system', not a valid user ID
 *   3. Application code resolves these at query time via the entityType
 */

export const approvalRequestsRelations = relations(approvalRequests, ({ many }) => ({
  // Full immutable event log for this request
  history: many(approvalHistory, {
    relationName: "approvalRequest_history",
  }),

  // The entity this request is for is resolved at application layer
  // (entityType + entityId → posts.id / press_releases.id / etc.)
  // No Drizzle relation declared — polymorphic pattern
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  // The approval request this event belongs to
  approvalRequest: one(approvalRequests, {
    fields: [approvalHistory.approvalRequestId],
    references: [approvalRequests.id],
    relationName: "approvalRequest_history",
  }),

  // actorId → users.id resolved at application layer
  // No Drizzle relation — actorId may be 'system' literal
}));
