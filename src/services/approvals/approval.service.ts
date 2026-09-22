/**
 * The shared approval workflow (NWB-P1-003).
 *
 * One service for every approvable entity — posts (P3), press releases (P8), engagement responses
 * (P7) — over the two tables `db/shared/approval.ts` already defines: `approval_requests` (the
 * state) and `approval_history` (the append-only timeline). No entity table exists yet, so the
 * service never looks an entity up: the caller supplies the `contentSnapshot` and `entityVersion`
 * the reviewers will see, and `entityId` is an opaque id. Ticket:
 * `.scratch/p1-shared-infra/issues/08-approval-service.md` — the decisions below are its §Decisions.
 *
 * **The chain is resolved at request time (decision 1).** A step names a user or a role tier;
 * tiers expand into one parallel step per eligible active member, so the stored chain is always
 * user-resolved and `chk_apr_pending_has_approver` needs no sentinel. The requester never appears
 * in it (no self-approval). Orders are normalised to `1..N`, so `current_step` *is* the order.
 *
 * **Decisions are optimistic updates under a row lock (decision 2).** Each mutation runs inside
 * `withAtomicWrites`, `SELECT … FOR UPDATE`s the row, and then issues `UPDATE … WHERE id = $1 AND
 * version = $2` — the lock serialises two approvers of one parallel group; the version predicate is
 * the model's own concurrency rule, and honours a caller's `expectedVersion` (409 when stale).
 *
 * **Terminal means terminal.** `approved`, `rejected`, `changes_requested`, `recalled`, `expired`
 * all set `completed_at` and clear `current_approver_id`; a resubmission after changes is a *new*
 * request (the snapshot is immutable). `escalated` is not written by anything yet — the model's
 * intermediate stage waits for notifications (NWB-P1-008).
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../lib/db";
import {
  ApprovalStateError,
  describeError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import type { Page, PaginationParams } from "../../lib/pagination";
import { buildPage, DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { type DbOrTx, withAtomicWrites } from "../../lib/transaction";
import { type AuditModule, writeAuditLog } from "../audit";
import { ROLE_LEVELS } from "../orgs/role-policy";

// ─── Vocabulary ───────────────────────────────────────────────────────────────────────────────

/** `approvable_entity_type` — the three entity kinds the schema knows. */
export const APPROVAL_ENTITY_TYPES = ["post", "press_release", "engagement_response"] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

/** `approval_request_status`, verbatim. */
export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
  "escalated",
  "expired",
  "recalled",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** The tiers a chain step may name — the model's `role` vocabulary, ranked by DEC-039 levels. */
export const APPROVER_TIERS = ["manager", "admin", "owner"] as const;
export type ApproverTier = (typeof APPROVER_TIERS)[number];

/** Which audit module a request's events file under — the domain the entity belongs to. */
const MODULE_BY_ENTITY_TYPE: Record<ApprovalEntityType, AuditModule> = {
  post: "publishing",
  press_release: "pr",
  engagement_response: "engagement",
};

/** FR-PUB-003 / BR-PUB-014: pending approvals expire after 7 days by default. */
export const APPROVAL_DEFAULT_EXPIRY_DAYS = 7;
/** A caller may shorten or lengthen the window within these bounds; `null` disables it. */
export const APPROVAL_MIN_EXPIRY_MS = 60 * 60 * 1000;
export const APPROVAL_MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
/** Rows one expiry pass will close; the next hour picks up the rest. */
export const APPROVAL_EXPIRY_BATCH_LIMIT = 1000;

/** `approval_history.actor_id` for worker-written rows, per the model ("'system' literal"). */
export const APPROVAL_SYSTEM_ACTOR = "system";

/** Opaque ids: `apr_`/`aph_` + 21 chars today; the columns are varchar(64). */
export const APPROVAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// ─── Chain input ──────────────────────────────────────────────────────────────────────────────

/**
 * One step as a caller writes it. `userId` names a member; `null`/absent means "any member at or
 * above `role`". `isParallel` is accepted for compatibility with the model's shape but *derived*
 * on storage: a step is parallel iff its order has more than one member after resolution.
 */
export const approvalStepInputSchema = z.object({
  order: z.number().int().min(1).max(100),
  userId: z.string().uuid("Must be a user id").nullable().optional(),
  role: z.enum(APPROVER_TIERS),
  isParallel: z.boolean().optional(),
});
export const approvalChainInputSchema = z
  .array(approvalStepInputSchema)
  .min(1, "The chain needs at least one step")
  .max(100, "A chain has at most 100 steps");

export type ApprovalStepInput = z.infer<typeof approvalStepInputSchema>;

/** One stored step: always a concrete user. */
export interface ApprovalChainStep {
  readonly order: number;
  readonly userId: string;
  readonly role: ApproverTier;
  readonly isParallel: boolean;
  /** True when this step came out of a role-tier expansion rather than being named. */
  readonly resolvedFromRole: boolean;
}

// ─── Read shapes ──────────────────────────────────────────────────────────────────────────────

export interface ApprovalRequestSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly entityType: ApprovalEntityType;
  readonly entityId: string;
  readonly entityVersion: number;
  readonly requesterId: string;
  readonly status: ApprovalStatus;
  readonly currentStep: number;
  readonly currentApproverId: string | null;
  readonly chain: ApprovalChainStep[];
  readonly expiresAt: string | null;
  readonly completedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApprovalHistoryEntry {
  readonly id: string;
  readonly action: string;
  readonly actorId: string;
  readonly comment: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  readonly contentSnapshot: Record<string, unknown> | null;
  readonly history: ApprovalHistoryEntry[];
}

// ─── Inputs ───────────────────────────────────────────────────────────────────────────────────

/** Request-context the route layer has and a service caller (P3's publish path) may not. */
export interface ApprovalActorContext {
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly requestId?: string | undefined;
}

export interface RequestApprovalInput {
  readonly organizationId: string;
  readonly requesterId: string;
  readonly entityType: ApprovalEntityType;
  readonly entityId: string;
  readonly entityVersion: number;
  readonly contentSnapshot: Record<string, unknown>;
  readonly chain: readonly ApprovalStepInput[];
  /**
   * `undefined` → the 7-day default; `null` → never expires; a timestamp → between 1 hour and 30
   * days from now. The bounds are the model's guard against a request nobody can act on in time
   * and one that stays pending for a quarter.
   */
  readonly expiresAt?: string | null | undefined;
  readonly actor?: ApprovalActorContext | undefined;
}

export interface ApprovalDecisionInput {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly comment?: string | undefined;
  /** The `version` the caller last read; a mismatch is 409, never a silent overwrite. */
  readonly expectedVersion?: number | undefined;
  readonly actor?: ApprovalActorContext | undefined;
}

export type ApprovalListView = "inbox" | "mine" | "all";

export interface ApprovalListScope {
  readonly organizationId: string;
  readonly userId: string;
}

export interface ApprovalListFilters {
  readonly view: ApprovalListView;
  readonly status?: ApprovalStatus | undefined;
  readonly entityType?: ApprovalEntityType | undefined;
  readonly entityId?: string | undefined;
}

/** Who is asking for a detail read; decides visibility (requester, chain member, or decider). */
export interface ApprovalViewer {
  readonly userId: string;
  readonly canDecide: boolean;
}

export interface ExpireStaleApprovalsResult {
  expired: number;
  failed: number;
  errors: { id: string; error: string }[];
  /** The closed ids, for the run's audit row (capped so `after_state` stays bounded). */
  ids: string[];
}

// ─── Row mapping ──────────────────────────────────────────────────────────────────────────────

type RequestRow = {
  id: string;
  organization_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  entity_version: number;
  requester_id: string;
  status: ApprovalStatus;
  current_step: number;
  current_approver_id: string | null;
  approval_chain: unknown;
  content_snapshot: unknown;
  expires_at: string | Date | null;
  completed_at: string | Date | null;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type HistoryRow = {
  id: string;
  action: string;
  actor_id: string;
  comment: string | null;
  metadata: unknown;
  created_at: string | Date;
};

const REQUEST_COLUMNS = sql.raw(
  [
    "id",
    "organization_id",
    "entity_type",
    "entity_id",
    "entity_version",
    "requester_id",
    "status",
    "current_step",
    "current_approver_id",
    "approval_chain",
    "content_snapshot",
    // `::text` keeps microsecond precision through node-postgres, which is what the keyset
    // cursor compares against; a JS Date would round to milliseconds.
    "expires_at::text AS expires_at",
    "completed_at::text AS completed_at",
    "version",
    "created_at::text AS created_at",
    "updated_at::text AS updated_at",
  ].join(", "),
);

function iso(value: string | Date | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toChain(value: unknown): ApprovalChainStep[] {
  return Array.isArray(value) ? (value as ApprovalChainStep[]) : [];
}

function toSummary(row: RequestRow): ApprovalRequestSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityVersion: Number(row.entity_version),
    requesterId: row.requester_id,
    status: row.status,
    currentStep: Number(row.current_step),
    currentApproverId: row.current_approver_id ?? null,
    chain: toChain(row.approval_chain),
    expiresAt: iso(row.expires_at),
    completedAt: iso(row.completed_at),
    version: Number(row.version),
    createdAt: iso(row.created_at) as string,
    updatedAt: iso(row.updated_at) as string,
  };
}

function toHistoryEntry(row: HistoryRow): ApprovalHistoryEntry {
  return {
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    comment: row.comment ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: iso(row.created_at) as string,
  };
}

function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/*
 * Timestamps are written as `clock_timestamp()` rather than the column default (`now()`):
 * `now()` is the transaction's start time, so a request and the decision that closes it in the
 * same transaction — the test harness's single rolled-back transaction, or P3's
 * submit-and-auto-approve — would tie on `created_at` and the lists' `(created_at, id)` ordering
 * would fall through to the random id. `clock_timestamp()` is the wall clock, so order is
 * insertion order wherever the rows were written.
 */

function requestId(): string {
  return `apr_${crypto.randomUUID().replaceAll("-", "").slice(0, 21)}`;
}

function historyId(): string {
  return `aph_${crypto.randomUUID().replaceAll("-", "").slice(0, 21)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tierLevel(tier: ApproverTier): number {
  return ROLE_LEVELS[tier];
}

/** The floor for *any* approver: FR-PUB-003 says approvers are "any user with role ≥ Manager". */
const APPROVER_FLOOR_LEVEL = ROLE_LEVELS.manager;

// ─── Chain resolution ─────────────────────────────────────────────────────────────────────────

interface EligibleMember {
  userId: string;
  level: number;
}

/**
 * Active members of the organization who may approve at all — an active membership on an active
 * account with a role at or above the manager floor — highest rank first, then join order, so a
 * tier expansion is deterministic and the "primary" of a parallel group is the most senior.
 */
async function loadEligibleApprovers(
  db: DbOrTx,
  organizationId: string,
): Promise<EligibleMember[]> {
  const result = await db.execute<{ user_id: string; level: number }>(sql`
    SELECT om.user_id, r.level
    FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${organizationId}
      AND om.status = 'active'
      AND om.deleted_at IS NULL
      AND u.status = 'active'
      AND u.deleted_at IS NULL
      AND r.level >= ${APPROVER_FLOOR_LEVEL}
    ORDER BY r.level DESC, om.created_at ASC, om.user_id ASC
  `);
  return rowsOf<{ user_id: string; level: number }>(result).map((row) => ({
    userId: row.user_id,
    level: Number(row.level),
  }));
}

/**
 * Turn the caller's steps into the stored chain (decision 1).
 *
 * Every refusal is a 422 naming the step, because the request has not been written yet and the
 * caller can fix the chain; the alternative — storing a chain that routes to nobody — is the AC1
 * failure ("routing reaches correct approvers in 100% of cases") this function exists to prevent.
 */
async function resolveChain(
  db: DbOrTx,
  organizationId: string,
  requesterId: string,
  input: readonly ApprovalStepInput[],
): Promise<ApprovalChainStep[]> {
  const eligible = await loadEligibleApprovers(db, organizationId);
  const levelByUser = new Map(eligible.map((member) => [member.userId, member.level]));

  // Normalise orders: the distinct input orders, sorted, become steps 1..N.
  const distinctOrders = [...new Set(input.map((step) => step.order))].sort((a, b) => a - b);
  const stepOf = new Map(distinctOrders.map((order, index) => [order, index + 1]));

  const issues: { field: string; message: string }[] = [];
  const membersByStep = new Map<number, Map<string, { role: ApproverTier; fromRole: boolean }>>();
  const put = (step: number, userId: string, role: ApproverTier, fromRole: boolean) => {
    let members = membersByStep.get(step);
    if (!members) {
      members = new Map();
      membersByStep.set(step, members);
    }
    // A named step wins over a tier expansion of the same user at the same order; either way the
    // user is in the group exactly once.
    const existing = members.get(userId);
    if (!existing || (existing.fromRole && !fromRole)) members.set(userId, { role, fromRole });
  };

  input.forEach((step, index) => {
    const stepNumber = stepOf.get(step.order) as number;
    const required = tierLevel(step.role);
    if (step.userId) {
      if (step.userId === requesterId) {
        issues.push({
          field: `chain[${index}].userId`,
          message: "the requester cannot approve their own request",
        });
        return;
      }
      const level = levelByUser.get(step.userId);
      if (level === undefined) {
        issues.push({
          field: `chain[${index}].userId`,
          message: "not an active member of this organization with approval authority",
        });
        return;
      }
      if (level < required) {
        issues.push({
          field: `chain[${index}].userId`,
          message: `does not hold a role at or above '${step.role}'`,
        });
        return;
      }
      put(stepNumber, step.userId, step.role, false);
      return;
    }
    // Tier step: everyone at or above the tier, minus the requester (no self-approval).
    const expanded = eligible.filter(
      (member) => member.level >= required && member.userId !== requesterId,
    );
    if (expanded.length === 0) {
      issues.push({
        field: `chain[${index}].role`,
        message: `no active member other than the requester holds a role at or above '${step.role}'`,
      });
      return;
    }
    for (const member of expanded) put(stepNumber, member.userId, step.role, true);
  });

  if (issues.length > 0) {
    throw new ValidationError("The approval chain cannot be routed as written", issues);
  }

  const chain: ApprovalChainStep[] = [];
  for (const stepNumber of [...membersByStep.keys()].sort((a, b) => a - b)) {
    const members = membersByStep.get(stepNumber) as Map<
      string,
      { role: ApproverTier; fromRole: boolean }
    >;
    // Most senior first, so `current_approver_id` (the group's primary) is the highest rank.
    const ordered = [...members.entries()].sort(
      (a, b) =>
        (levelByUser.get(b[0]) ?? 0) - (levelByUser.get(a[0]) ?? 0) || a[0].localeCompare(b[0]),
    );
    for (const [userId, meta] of ordered) {
      chain.push({
        order: stepNumber,
        userId,
        role: meta.role,
        isParallel: ordered.length > 1,
        resolvedFromRole: meta.fromRole,
      });
    }
  }
  return chain;
}

function stepMembers(chain: readonly ApprovalChainStep[], step: number): ApprovalChainStep[] {
  return chain.filter((entry) => entry.order === step);
}

function lastStep(chain: readonly ApprovalChainStep[]): number {
  return chain.reduce((max, entry) => Math.max(max, entry.order), 0);
}

// ─── Expiry window ────────────────────────────────────────────────────────────────────────────

function resolveExpiry(input: string | null | undefined, now: number): string | null {
  if (input === null) return null;
  if (input === undefined) {
    return new Date(now + APPROVAL_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  }
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    throw new ValidationError("expiresAt is not a valid timestamp", [
      { field: "expiresAt", message: "must be an ISO timestamp, null, or omitted" },
    ]);
  }
  const delta = parsed - now;
  if (delta < APPROVAL_MIN_EXPIRY_MS || delta > APPROVAL_MAX_EXPIRY_MS) {
    throw new ValidationError("expiresAt must fall between 1 hour and 30 days from now", [
      { field: "expiresAt", message: "outside the 1h–30d window (pass null for no expiry)" },
    ]);
  }
  return new Date(parsed).toISOString();
}

// ─── Request ──────────────────────────────────────────────────────────────────────────────────

/**
 * Open an approval request: resolve the chain, snapshot the content, write the `submitted`
 * history row and the audit event — atomically. Returns the detail the route responds with.
 */
export async function requestApproval(
  db: Db,
  input: RequestApprovalInput,
): Promise<ApprovalRequestDetail> {
  const issues: { field: string; message: string }[] = [];
  if (!APPROVAL_ENTITY_TYPES.includes(input.entityType)) {
    issues.push({ field: "entityType", message: `one of ${APPROVAL_ENTITY_TYPES.join(", ")}` });
  }
  if (!ENTITY_ID_PATTERN.test(input.entityId)) {
    issues.push({ field: "entityId", message: "1–64 characters of [A-Za-z0-9_-]" });
  }
  if (!Number.isInteger(input.entityVersion) || input.entityVersion < 1) {
    issues.push({ field: "entityVersion", message: "a positive integer" });
  }
  if (!isPlainObject(input.contentSnapshot) || Object.keys(input.contentSnapshot).length === 0) {
    issues.push({
      field: "contentSnapshot",
      message: "a non-empty object — reviewers see exactly this",
    });
  }
  const parsedChain = approvalChainInputSchema.safeParse(input.chain);
  if (!parsedChain.success) {
    for (const issue of parsedChain.error.issues) {
      issues.push({
        field: issue.path.length > 0 ? `chain.${issue.path.join(".")}` : "chain",
        message: issue.message,
      });
    }
  }
  if (issues.length > 0) throw new ValidationError("Invalid approval request", issues);

  const expiresAt = resolveExpiry(input.expiresAt, Date.now());
  const chainInput = parsedChain.success ? parsedChain.data : [];

  return withAtomicWrites(db, async (tx) => {
    const chain = await resolveChain(tx, input.organizationId, input.requesterId, chainInput);
    const primary = stepMembers(chain, 1)[0] as ApprovalChainStep;
    const id = requestId();

    try {
      await tx.execute(sql`
        INSERT INTO approval_requests
          (id, organization_id, entity_type, entity_id, requester_id, approval_chain,
           current_approver_id, current_step, status, content_snapshot, entity_version, expires_at,
           created_at, updated_at)
        VALUES
          (${id}, ${input.organizationId}, ${input.entityType}, ${input.entityId},
           ${input.requesterId}, ${JSON.stringify(chain)}::jsonb, ${primary.userId}, 1, 'pending',
           ${JSON.stringify(input.contentSnapshot)}::jsonb, ${input.entityVersion}, ${expiresAt},
           clock_timestamp(), clock_timestamp())
      `);
    } catch (error) {
      // The partial unique index is the arbiter under concurrency (`uq_apr_pending_per_entity`).
      if ((error as { code?: unknown } | null)?.code === "23505") {
        throw new ApprovalStateError(
          "APPROVAL_ALREADY_PENDING",
          "This entity already has a pending approval request",
          { entityType: input.entityType, entityId: input.entityId },
        );
      }
      throw error;
    }

    await tx.execute(sql`
      INSERT INTO approval_history
        (id, approval_request_id, action, actor_id, comment, metadata, created_at)
      VALUES (${historyId()}, ${id}, 'submitted', ${input.requesterId}, NULL,
              ${JSON.stringify({ chain, expiresAt, entityVersion: input.entityVersion })}::jsonb,
              clock_timestamp())
    `);

    await writeAuditLog({
      db: tx,
      module: MODULE_BY_ENTITY_TYPE[input.entityType],
      organizationId: input.organizationId,
      actorId: input.requesterId,
      actorType: "user",
      actorIp: input.actor?.ip,
      actorUserAgent: input.actor?.userAgent,
      requestId: input.actor?.requestId,
      action: "approvals.requested",
      resourceId: id,
      afterState: {
        entityType: input.entityType,
        entityId: input.entityId,
        entityVersion: input.entityVersion,
        status: "pending",
        currentStep: 1,
        currentApproverId: primary.userId,
        steps: lastStep(chain),
        expiresAt,
      },
    });

    return (await readDetail(tx, input.organizationId, id)) as ApprovalRequestDetail;
  });
}

// ─── Decisions ────────────────────────────────────────────────────────────────────────────────

async function lockRequest(
  tx: DbOrTx,
  organizationId: string,
  id: string,
): Promise<RequestRow | undefined> {
  const result = await tx.execute<RequestRow>(sql`
    SELECT ${REQUEST_COLUMNS}
    FROM approval_requests
    WHERE id = ${id} AND organization_id = ${organizationId}
    FOR UPDATE
  `);
  return rowsOf<RequestRow>(result)[0];
}

/** The 404 / 409 gate every decision shares, in that order: missing, stale version, not pending. */
function assertDecidable(row: RequestRow | undefined, input: ApprovalDecisionInput): RequestRow {
  if (!row) throw new NotFoundError("Approval request not found");
  if (input.expectedVersion !== undefined && Number(row.version) !== input.expectedVersion) {
    throw new ApprovalStateError(
      "APPROVAL_VERSION_CONFLICT",
      "The approval request changed since you read it — re-fetch and retry",
      { version: Number(row.version), expectedVersion: input.expectedVersion },
    );
  }
  if (row.status !== "pending") {
    throw new ApprovalStateError(
      "APPROVAL_ALREADY_REVIEWED",
      `The approval request is already ${row.status.replace("_", " ")}`,
      { status: row.status },
    );
  }
  return row;
}

function assertCurrentApprover(row: RequestRow, actorId: string): ApprovalChainStep[] {
  const members = stepMembers(toChain(row.approval_chain), Number(row.current_step));
  if (!members.some((member) => member.userId === actorId)) {
    throw new ForbiddenError(
      `Not this request's current approver: step ${row.current_step} is pending with someone else`,
    );
  }
  return members;
}

function requireComment(comment: string | undefined, action: string): string {
  const trimmed = comment?.trim() ?? "";
  if (trimmed.length === 0) {
    // Refused here, not by `chk_aph_rejection_comment`: the CHECK would surface as an opaque 500.
    throw new ValidationError(`A comment is required to ${action}`, [
      { field: "comment", message: "must not be empty" },
    ]);
  }
  return trimmed;
}

/** The optimistic UPDATE of decision 2; 0 rows can only mean the version moved under the lock. */
async function closeRequest(
  tx: DbOrTx,
  row: RequestRow,
  status: Exclude<ApprovalStatus, "pending" | "escalated">,
): Promise<number> {
  const result = await tx.execute<{ version: number }>(sql`
    UPDATE approval_requests
    SET status = ${status}, completed_at = clock_timestamp(), current_approver_id = NULL,
        version = version + 1, updated_at = clock_timestamp()
    WHERE id = ${row.id} AND version = ${Number(row.version)}
    RETURNING version
  `);
  const updated = rowsOf<{ version: number }>(result)[0];
  if (!updated) {
    throw new ApprovalStateError(
      "APPROVAL_VERSION_CONFLICT",
      "The approval request changed while the decision was being written",
    );
  }
  return Number(updated.version);
}

async function appendHistory(
  tx: DbOrTx,
  approvalRequestId: string,
  action: string,
  actorId: string,
  comment: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO approval_history
      (id, approval_request_id, action, actor_id, comment, metadata, created_at)
    VALUES (${historyId()}, ${approvalRequestId}, ${action}, ${actorId}, ${comment},
            ${JSON.stringify(metadata)}::jsonb, clock_timestamp())
  `);
}

async function auditDecision(
  tx: DbOrTx,
  row: RequestRow,
  input: ApprovalDecisionInput,
  action:
    | "approvals.approved"
    | "approvals.rejected"
    | "approvals.changes_requested"
    | "approvals.recalled",
  afterState: Record<string, unknown>,
  reason?: string,
): Promise<void> {
  await writeAuditLog({
    db: tx,
    module: MODULE_BY_ENTITY_TYPE[row.entity_type],
    organizationId: row.organization_id,
    actorId: input.actorId,
    actorType: "user",
    actorIp: input.actor?.ip,
    actorUserAgent: input.actor?.userAgent,
    requestId: input.actor?.requestId,
    action,
    resourceId: row.id,
    beforeState: { status: row.status, currentStep: Number(row.current_step) },
    afterState: { entityType: row.entity_type, entityId: row.entity_id, ...afterState },
    reason,
  });
}

/**
 * Approve the current step. A non-final step advances the chain to the next order's members (the
 * most senior becomes `current_approver_id`); the final step closes the request `approved`. In a
 * parallel group the first approval is the group's — the row lock makes "first" well-defined.
 */
export async function approveRequest(
  db: Db,
  input: ApprovalDecisionInput,
): Promise<ApprovalRequestDetail> {
  const comment = input.comment?.trim() || null;
  return withAtomicWrites(db, async (tx) => {
    const row = assertDecidable(await lockRequest(tx, input.organizationId, input.id), input);
    assertCurrentApprover(row, input.actorId);
    const chain = toChain(row.approval_chain);
    const step = Number(row.current_step);
    const final = step >= lastStep(chain);

    if (final) {
      await closeRequest(tx, row, "approved");
      await appendHistory(tx, row.id, "approved", input.actorId, comment, { step, final: true });
      await auditDecision(tx, row, input, "approvals.approved", {
        status: "approved",
        step,
        final: true,
      });
    } else {
      const nextStep = step + 1;
      const next = stepMembers(chain, nextStep);
      const primary = next[0] as ApprovalChainStep;
      const result = await tx.execute<{ version: number }>(sql`
        UPDATE approval_requests
        SET current_step = ${nextStep}, current_approver_id = ${primary.userId},
            version = version + 1, updated_at = clock_timestamp()
        WHERE id = ${row.id} AND version = ${Number(row.version)}
        RETURNING version
      `);
      if (rowsOf(result).length === 0) {
        throw new ApprovalStateError(
          "APPROVAL_VERSION_CONFLICT",
          "The approval request changed while the decision was being written",
        );
      }
      await appendHistory(tx, row.id, "approved", input.actorId, comment, {
        step,
        final: false,
        nextStep,
        nextApproverIds: next.map((member) => member.userId),
        remainingSteps: lastStep(chain) - step,
      });
      await auditDecision(tx, row, input, "approvals.approved", {
        status: "pending",
        step,
        final: false,
        currentStep: nextStep,
        currentApproverId: primary.userId,
      });
    }

    return (await readDetail(tx, input.organizationId, input.id)) as ApprovalRequestDetail;
  });
}

/** Reject: closes the request; the comment is the rejection reason and is mandatory (AC6). */
export async function rejectRequest(
  db: Db,
  input: ApprovalDecisionInput,
): Promise<ApprovalRequestDetail> {
  const comment = requireComment(input.comment, "reject");
  return withAtomicWrites(db, async (tx) => {
    const row = assertDecidable(await lockRequest(tx, input.organizationId, input.id), input);
    assertCurrentApprover(row, input.actorId);
    await closeRequest(tx, row, "rejected");
    await appendHistory(tx, row.id, "rejected", input.actorId, comment, {
      step: Number(row.current_step),
    });
    await auditDecision(
      tx,
      row,
      input,
      "approvals.rejected",
      { status: "rejected", step: Number(row.current_step) },
      comment,
    );
    return (await readDetail(tx, input.organizationId, input.id)) as ApprovalRequestDetail;
  });
}

/** Request changes: closes the request for edits; a resubmission is a new request. */
export async function requestChanges(
  db: Db,
  input: ApprovalDecisionInput,
): Promise<ApprovalRequestDetail> {
  const comment = requireComment(input.comment, "request changes");
  return withAtomicWrites(db, async (tx) => {
    const row = assertDecidable(await lockRequest(tx, input.organizationId, input.id), input);
    assertCurrentApprover(row, input.actorId);
    await closeRequest(tx, row, "changes_requested");
    await appendHistory(tx, row.id, "changes_requested", input.actorId, comment, {
      step: Number(row.current_step),
    });
    await auditDecision(
      tx,
      row,
      input,
      "approvals.changes_requested",
      { status: "changes_requested", step: Number(row.current_step) },
      comment,
    );
    return (await readDetail(tx, input.organizationId, input.id)) as ApprovalRequestDetail;
  });
}

/**
 * Recall: the requester withdraws — only while pending and before the first approval action
 * (FR-PUB-003 AC7). After an approver has acted the request belongs to the chain, and the
 * requester's exit is to let it finish or ask for changes.
 */
export async function recallRequest(
  db: Db,
  input: ApprovalDecisionInput,
): Promise<ApprovalRequestDetail> {
  const comment = input.comment?.trim() || null;
  return withAtomicWrites(db, async (tx) => {
    const row = assertDecidable(await lockRequest(tx, input.organizationId, input.id), input);
    if (row.requester_id !== input.actorId) {
      throw new ForbiddenError("Only the requester may recall an approval request");
    }
    const acted = await tx.execute<{ n: string }>(sql`
      SELECT count(*)::text AS n FROM approval_history
      WHERE approval_request_id = ${row.id} AND action = 'approved'
    `);
    if (Number(rowsOf<{ n: string }>(acted)[0]?.n ?? 0) > 0) {
      throw new ApprovalStateError(
        "APPROVAL_RECALL_WINDOW_CLOSED",
        "The request can no longer be recalled: an approver has already acted on it",
        { currentStep: Number(row.current_step) },
      );
    }
    await closeRequest(tx, row, "recalled");
    await appendHistory(tx, row.id, "recalled", input.actorId, comment, {
      step: Number(row.current_step),
    });
    await auditDecision(tx, row, input, "approvals.recalled", { status: "recalled" });
    return (await readDetail(tx, input.organizationId, input.id)) as ApprovalRequestDetail;
  });
}

// ─── Expiry ───────────────────────────────────────────────────────────────────────────────────

let expirySavepointCounter = 0;

/**
 * Close every pending request whose `expires_at` has passed (decision 3).
 *
 * Idempotent at the source — the candidate SELECT and each row's UPDATE both carry the
 * `status = 'pending' AND expires_at <= now()` predicate, so a second run in the same hour finds
 * nothing and a request decided between the SELECT and its UPDATE is left exactly as decided
 * (0 rows updated, counted as neither). Per row in its own savepoint, so one refusing row lands in
 * `errors` and the rest of the hour's batch still closes.
 */
export async function expireStaleApprovals(
  db: Db,
  options: { limit?: number } = {},
): Promise<ExpireStaleApprovalsResult> {
  const limit = options.limit ?? APPROVAL_EXPIRY_BATCH_LIMIT;
  const candidates = rowsOf<{ id: string }>(
    await db.execute<{ id: string }>(sql`
      SELECT id FROM approval_requests
      WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now()
      ORDER BY expires_at ASC, id ASC
      LIMIT ${limit}
    `),
  ).map((row) => row.id);
  if (candidates.length === 0) return { expired: 0, failed: 0, errors: [], ids: [] };

  return withAtomicWrites(db, async (tx) => {
    const ids: string[] = [];
    const errors: { id: string; error: string }[] = [];
    for (const id of candidates) {
      const savepoint = `sp_apr_expire_${expirySavepointCounter++}`;
      await tx.execute(sql.raw(`SAVEPOINT ${savepoint}`));
      try {
        const updated = rowsOf<{ id: string; current_step: number; minutes_overdue: string }>(
          await tx.execute(sql`
            UPDATE approval_requests
            SET status = 'expired', completed_at = clock_timestamp(), current_approver_id = NULL,
                version = version + 1, updated_at = clock_timestamp()
            WHERE id = ${id} AND status = 'pending' AND expires_at <= now()
            RETURNING id, current_step,
                      floor(extract(epoch FROM (now() - expires_at)) / 60)::text AS minutes_overdue
          `),
        )[0];
        if (updated) {
          await appendHistory(tx, id, "expired", APPROVAL_SYSTEM_ACTOR, null, {
            step: Number(updated.current_step),
            minutesOverdue: Number(updated.minutes_overdue),
          });
          ids.push(id);
        }
        await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
      } catch (error) {
        await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
        errors.push({ id, error: describeError(error) });
      }
    }
    return { expired: ids.length, failed: errors.length, errors, ids: ids.slice(0, 100) };
  });
}

// ─── Reads ────────────────────────────────────────────────────────────────────────────────────

async function readDetail(
  db: DbOrTx,
  organizationId: string,
  id: string,
): Promise<ApprovalRequestDetail | undefined> {
  const row = rowsOf<RequestRow>(
    await db.execute<RequestRow>(sql`
      SELECT ${REQUEST_COLUMNS} FROM approval_requests
      WHERE id = ${id} AND organization_id = ${organizationId}
      LIMIT 1
    `),
  )[0];
  if (!row) return undefined;
  const history = rowsOf<HistoryRow>(
    await db.execute<HistoryRow>(sql`
      SELECT id, action, actor_id, comment, metadata, created_at::text AS created_at
      FROM approval_history
      WHERE approval_request_id = ${id}
      ORDER BY created_at ASC, id ASC
    `),
  ).map(toHistoryEntry);
  return {
    ...toSummary(row),
    contentSnapshot: isPlainObject(row.content_snapshot) ? row.content_snapshot : null,
    history,
  };
}

/**
 * One request with its timeline. With a `viewer`, visibility follows FR-PUB-003's "who can see":
 * the requester, anyone in the chain, and anyone who may decide; everyone else reads 404 — not
 * 403, because confirming the id exists is information the endpoint should not hand out.
 */
export async function getApprovalRequest(
  db: Db,
  organizationId: string,
  id: string,
  viewer?: ApprovalViewer,
): Promise<ApprovalRequestDetail | undefined> {
  const detail = await readDetail(db, organizationId, id);
  if (!detail || !viewer) return detail;
  const visible =
    viewer.canDecide ||
    detail.requesterId === viewer.userId ||
    detail.chain.some((step) => step.userId === viewer.userId);
  return visible ? detail : undefined;
}

/**
 * One page of requests, newest first, keyset-cursored on `(created_at, id)` like the audit list.
 *
 * `inbox` is "pending and my turn": the chain JSONB is consulted because a parallel group has more
 * members than the single `current_approver_id` column can name (measured (5) in the ticket).
 * `mine` is what the caller submitted; `all` is the organization's queue and is gated by the route.
 */
export async function listApprovalRequests(
  db: Db,
  scope: ApprovalListScope,
  filters: ApprovalListFilters,
  page?: PaginationParams,
): Promise<Page<ApprovalRequestSummary>> {
  const limit = page?.limit ?? DEFAULT_PAGE_SIZE;
  const cursor = page?.cursor ?? null;
  const after = cursor
    ? sql`AND (created_at, id) < (${cursor.v}::timestamptz, ${cursor.id})`
    : sql``;

  const viewClause =
    filters.view === "inbox"
      ? sql`AND status = 'pending'
            AND approval_chain @> jsonb_build_array(
              jsonb_build_object('order', current_step, 'userId', ${scope.userId}::text))`
      : filters.view === "mine"
        ? sql`AND requester_id = ${scope.userId}`
        : sql``;
  const statusClause = filters.status ? sql`AND status = ${filters.status}` : sql``;
  const typeClause = filters.entityType ? sql`AND entity_type = ${filters.entityType}` : sql``;
  const entityClause = filters.entityId ? sql`AND entity_id = ${filters.entityId}` : sql``;

  const rows = rowsOf<RequestRow>(
    await db.execute<RequestRow>(sql`
      SELECT ${REQUEST_COLUMNS} FROM approval_requests
      WHERE organization_id = ${scope.organizationId}
        ${viewClause} ${statusClause} ${typeClause} ${entityClause} ${after}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `),
  ).map(toSummary);
  return buildPage(rows, limit, (row) => row.createdAt);
}
