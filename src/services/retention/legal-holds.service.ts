/**
 * Legal holds (NWB-P1-010): freeze erasure for one user or one organization.
 *
 * A hold means "preserve everything about X": while one is active, the purge workers
 * (accounts, organizations, invitations) and the retention worker's subject-keyed deletes all
 * refuse X's rows — each through a per-row hook that throws `LegalHoldError`, so the refusal
 * lands in the night's `errors` + `held` count instead of failing silently. Blocking is
 * subject-wide regardless of `data_type` (descriptive: what the matter concerns); underbroad
 * preservation destroys evidence, overbroad merely defers erasure.
 *
 * No foreign keys to `users`/`organizations` by design (the compliance-module convention): the
 * hold record must outlive its subject as evidence of who froze whom, when, and why. For the
 * same reason a hold is never deleted — it is released, and the release is audited too.
 *
 * Operator entry is this service (script/console) until routes land with super_admin checks in
 * a later phase; `placed_by` is recorded now so the accountability chain has no gap.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { LegalHoldError, NotFoundError, ValidationError } from "../../lib/errors";
import type { DbOrTx } from "../../lib/transaction";
// Direct `./write` import, not the `../audit` barrel: `audit/anonymize.ts` calls back into this
// service for the hold check, so going through the barrel would close an import cycle.
import { writeAuditLog } from "../audit/write";

/** The `legal_hold_data_type` vocabulary — descriptive, never a blocking filter. */
export type LegalHoldDataType =
  | "user_data"
  | "conversations"
  | "audit_logs"
  | "orders"
  | "analytics"
  | "all";

export interface LegalHold {
  id: string;
  userId: string | null;
  organizationId: string | null;
  dataType: LegalHoldDataType;
  reason: string;
  placedBy: string;
  placedAt: string;
  expiresAt: string | null;
  status: string;
}

export interface PlaceLegalHoldInput {
  userId?: string | undefined;
  organizationId?: string | undefined;
  dataType?: LegalHoldDataType | undefined;
  /** The matter. Required — a hold without a reason is a freeze without accountability. */
  reason: string;
  legalCaseId?: string | undefined;
  placedBy: string;
  /** Indefinite when omitted; past timestamps are rejected, not silently lapsed. */
  expiresAt?: string | undefined;
}

function holdId(): string {
  return `lh_${crypto.randomUUID().slice(0, 21)}`;
}

function toHold(row: Record<string, unknown>): LegalHold {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    organizationId: (row.organization_id as string | null) ?? null,
    dataType: row.data_type as LegalHoldDataType,
    reason: row.reason as string,
    placedBy: row.placed_by as string,
    placedAt: String(row.placed_at),
    expiresAt: row.expires_at === null ? null : String(row.expires_at),
    status: row.status as string,
  };
}

/**
 * Freeze a subject's erasure. Fails fast on a missing/ambiguous target (the XOR CHECK would
 * refuse it anyway) and on an unknown subject — a typo'd id that silently protected nothing
 * while the operator believed otherwise is the failure this check exists for. Soft-deleted
 * subjects are placeable: stopping tonight's purge of a pending erasure is the core use case.
 */
export async function placeLegalHold(
  db: NodePgDatabase<Record<string, any>>,
  input: PlaceLegalHoldInput,
): Promise<{ id: string }> {
  const hasUser = input.userId !== undefined && input.userId !== "";
  const hasOrg = input.organizationId !== undefined && input.organizationId !== "";
  if (hasUser === hasOrg) {
    throw new ValidationError(
      "A legal hold targets exactly one user or one organization, not both or neither.",
      [
        {
          field: hasUser ? "userId,organizationId" : "userId",
          message: "exactly one target is required",
        },
      ],
    );
  }
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new ValidationError("A legal hold requires a reason.", [
      { field: "reason", message: "reason must not be empty" },
    ]);
  }
  if (input.expiresAt !== undefined && Number.isNaN(Date.parse(input.expiresAt))) {
    throw new ValidationError("expiresAt is not a valid timestamp.", [
      { field: "expiresAt", message: "must be an ISO timestamp" },
    ]);
  }
  if (input.expiresAt !== undefined && Date.parse(input.expiresAt) <= Date.now()) {
    throw new ValidationError("expiresAt is in the past — place an active hold or none.", [
      { field: "expiresAt", message: "must be in the future" },
    ]);
  }

  if (hasUser) {
    const subject = await db.execute<{ id: string }>(
      sql`SELECT id FROM users WHERE id = ${input.userId as string} LIMIT 1`,
    );
    if (((subject as unknown as { rows?: unknown[] }).rows ?? []).length === 0) {
      throw new NotFoundError("No such user to hold.");
    }
  } else {
    const subject = await db.execute<{ id: string }>(
      sql`SELECT id FROM organizations WHERE id = ${input.organizationId as string} LIMIT 1`,
    );
    if (((subject as unknown as { rows?: unknown[] }).rows ?? []).length === 0) {
      throw new NotFoundError("No such organization to hold.");
    }
  }

  const id = holdId();
  await db.execute(
    sql`INSERT INTO legal_holds
          (id, user_id, organization_id, data_type, reason, legal_case_id, placed_by, expires_at)
        VALUES
          (${id}, ${input.userId ?? null}, ${input.organizationId ?? null},
           ${input.dataType ?? "all"}, ${reason}, ${input.legalCaseId ?? null},
           ${input.placedBy}, ${input.expiresAt ?? null})`,
  );
  await writeAuditLog({
    db,
    module: "core",
    actorId: input.placedBy,
    actorType: "user",
    action: "legal-holds.placed",
    category: "compliance",
    resourceType: "legal_hold",
    resourceId: id,
    afterState: {
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      dataType: input.dataType ?? "all",
      reason,
    },
  });
  return { id };
}

export interface ReleaseLegalHoldInput {
  id: string;
  releasedBy: string;
  /** Required twice over: here and by `chk_lh_release_reason_required`. */
  releaseReason: string;
}

/**
 * Lift a hold; withheld erasures become eligible on the next run. Idempotent on an already
 * released hold (the release is the durable fact, not the call), 404 on an unknown id.
 */
export async function releaseLegalHold(
  db: NodePgDatabase<Record<string, any>>,
  input: ReleaseLegalHoldInput,
): Promise<{ released: boolean }> {
  const reason = input.releaseReason.trim();
  if (reason.length === 0) {
    throw new ValidationError("Releasing a legal hold requires a reason.", [
      { field: "releaseReason", message: "releaseReason must not be empty" },
    ]);
  }
  const current = await db.execute<{ status: string }>(
    sql`SELECT status FROM legal_holds WHERE id = ${input.id} LIMIT 1`,
  );
  const row = (current as unknown as { rows?: { status: string }[] }).rows?.[0];
  if (!row) {
    throw new NotFoundError("No such legal hold.");
  }
  if (row.status !== "active") {
    return { released: false };
  }
  await db.execute(
    sql`UPDATE legal_holds
        SET status = 'released', released_at = now(),
            released_by = ${input.releasedBy}, release_reason = ${reason}
        WHERE id = ${input.id}`,
  );
  await writeAuditLog({
    db,
    module: "core",
    actorId: input.releasedBy,
    actorType: "user",
    action: "legal-holds.released",
    category: "compliance",
    resourceType: "legal_hold",
    resourceId: input.id,
    afterState: { reason },
  });
  return { released: true };
}

const HOLD_COLUMNS = sql`id, user_id, organization_id, data_type, reason, placed_by, placed_at, expires_at, status`;

/**
 * The oldest active hold on a user, if any. Expiry is evaluated at read time — no worker flips
 * rows to `expired`, so a lapsed hold simply stops matching. Oldest first: the blocking reason
 * cites the hold that has waited longest.
 */
export async function findActiveHoldForUser(
  db: DbOrTx,
  userId: string,
): Promise<LegalHold | undefined> {
  const rows = await db.execute<Record<string, unknown>>(
    sql`SELECT ${HOLD_COLUMNS} FROM legal_holds
        WHERE user_id = ${userId} AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY placed_at LIMIT 1`,
  );
  const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0];
  return row === undefined ? undefined : toHold(row);
}

/** The oldest active hold on an organization, if any — same expiry semantics. */
export async function findActiveHoldForOrg(
  db: DbOrTx,
  organizationId: string,
): Promise<LegalHold | undefined> {
  const rows = await db.execute<Record<string, unknown>>(
    sql`SELECT ${HOLD_COLUMNS} FROM legal_holds
        WHERE organization_id = ${organizationId} AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY placed_at LIMIT 1`,
  );
  const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0];
  return row === undefined ? undefined : toHold(row);
}

/**
 * Throw `LegalHoldError` when the user is held, otherwise return. What the purge/retention
 * `beforeDelete` hooks call — the check lives in the hook (service, not job) so a held row
 * costs exactly itself and reports through the standard per-row channel.
 */
export async function assertNoActiveHoldForUser(
  tx: DbOrTx,
  userId: string,
  subject: string,
): Promise<void> {
  const hold = await findActiveHoldForUser(tx, userId);
  if (hold) {
    throw new LegalHoldError(`legal hold ${hold.id} blocks ${subject}: ${hold.reason}`, hold.id);
  }
}

/**
 * The oldest active hold on the user with this email, if any. The invite-expiry path needs it:
 * legacy member rows name their invitee only by `invited_email`, with no `user_id` hint to
 * check. Address match is exact — holds are too blunt an instrument for fuzzy matching.
 */
export async function findActiveHoldForUserEmail(
  tx: DbOrTx,
  email: string,
): Promise<LegalHold | undefined> {
  const rows = await tx.execute<Record<string, unknown>>(
    sql`SELECT lh.id, lh.user_id, lh.organization_id, lh.data_type, lh.reason,
               lh.placed_by, lh.placed_at, lh.expires_at, lh.status
        FROM legal_holds lh JOIN users u ON u.id::text = lh.user_id
        WHERE u.email = ${email} AND lh.user_id IS NOT NULL AND lh.status = 'active'
          AND (lh.expires_at IS NULL OR lh.expires_at > now())
        ORDER BY lh.placed_at LIMIT 1`,
  );
  const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0];
  return row === undefined ? undefined : toHold(row);
}

/** Throw `LegalHoldError` when the organization is held, otherwise return. */
export async function assertNoActiveHoldForOrg(
  tx: DbOrTx,
  organizationId: string,
  subject: string,
): Promise<void> {
  const hold = await findActiveHoldForOrg(tx, organizationId);
  if (hold) {
    throw new LegalHoldError(`legal hold ${hold.id} blocks ${subject}: ${hold.reason}`, hold.id);
  }
}

/** Throw `LegalHoldError` when the user with this email is held, otherwise return. */
export async function assertNoActiveHoldForUserEmail(
  tx: DbOrTx,
  email: string,
  subject: string,
): Promise<void> {
  const hold = await findActiveHoldForUserEmail(tx, email);
  if (hold) {
    throw new LegalHoldError(`legal hold ${hold.id} blocks ${subject}: ${hold.reason}`, hold.id);
  }
}
