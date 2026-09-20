import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError, OwnershipTransferRequiredError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { revokeAllSessionsForUser } from "../auth/session";

const DELETION_GRACE_DAYS = 30;

export interface AccountDeletionOptions {
  reason?: string;
}

/**
 * Soft-deletes the user's account. The account enters a 30-day grace period:
 * sessions are revoked, the user is excluded from auth, and a hard purge is
 * scheduled for DELETION_GRACE_DAYS later.
 */
export async function deleteAccount(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  options?: AccountDeletionOptions,
): Promise<{ scheduledDeletionAt: string }> {
  // F-25 / D16 (option 2 — refuse and report). `organizations.owner_id` is a
  // restrictive NOT NULL FK to `users(id)`, so the hard purge could never remove
  // someone who still owns an organization — it could only die on 23503, thirty
  // days after the user was told their erasure was scheduled. Ownership is
  // checked here instead, before anything is written, and the request is
  // refused with the names of the blocking organizations. This gate is also
  // what keeps `purgeExpiredAccounts` unreachable for an owner: nothing reaches
  // the purge without passing it. Until NWB-P0-023 (organization deletion /
  // ownership transfer) ships, a user whose signup created their personal
  // organization cannot complete account deletion — an accepted trade-off,
  // recorded in the decision register as D16.
  const owned = await db.execute<{ id: string; name: string }>(
    sql`SELECT id, name FROM organizations WHERE owner_id = ${userId} ORDER BY created_at, name LIMIT 100`,
  );
  const ownedRows = ((owned as any).rows ?? []) as { id: string; name: string }[];
  if (ownedRows.length > 0) {
    const names = ownedRows.map((o) => `"${o.name}"`).join(", ");
    throw new OwnershipTransferRequiredError(
      `Account deletion is unavailable while you own ${
        ownedRows.length === 1 ? "an organization" : `${ownedRows.length} organizations`
      } (${names}). Transfer ownership of each organization before deleting your account.`,
      { organizations: ownedRows },
    );
  }

  const scheduledDeletionAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db.execute<{ id: string; deleted_at: string | null }>(
    sql`
      UPDATE users
      SET deleted_at = now(),
          deleted_by = ${userId},
          deletion_reason = ${options?.reason ?? null},
          scheduled_deletion_at = ${scheduledDeletionAt.toISOString()}::timestamptz,
          status = 'suspended',
          email = email || '+deleted' || left(gen_random_uuid()::text, 8)
      WHERE id = ${userId}
        AND deleted_at IS NULL
      RETURNING id, deleted_at
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Account not found");

  await revokeAllSessionsForUser(db, userId);

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "account.deleted",
    category: "security",
    resourceType: "user",
    resourceId: userId,
    afterState: {
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      deletionReason: options?.reason ?? null,
    },
  });

  return { scheduledDeletionAt: scheduledDeletionAt.toISOString() };
}

/**
 * Reactivates a soft-deleted account within the grace period.
 */
export async function reactivateAccount(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<void> {
  const rows = await db.execute<{ id: string }>(
    sql`
      UPDATE users
      SET deleted_at = NULL,
          deleted_by = NULL,
          deletion_reason = NULL,
          scheduled_deletion_at = NULL,
          status = 'active'
      WHERE id = ${userId}
        AND deleted_at IS NOT NULL
        AND (scheduled_deletion_at IS NULL OR scheduled_deletion_at > now())
      RETURNING id
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Account not found or grace period expired");

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "account.reactivated",
    category: "security",
    resourceType: "user",
    resourceId: userId,
  });
}

/**
 * Permanently deletes accounts whose grace period has expired.
 * Returns the number of purged accounts. Intended for a scheduled job.
 *
 * An organization owner can never be in this set — `deleteAccount` refuses them
 * up front (F-25 / D16). If that invariant is ever broken from the outside (e.g.
 * a future ownership-transfer path reparents an organization onto an
 * already-scheduled account), the restrictive FK on `organizations.owner_id`
 * makes this DELETE fail loudly rather than silently stranding the erasure.
 * The loudness is deliberate — do not convert it to a silent skip.
 */
export async function purgeExpiredAccounts(
  db: NodePgDatabase<Record<string, any>>,
): Promise<number> {
  const rows = await db.execute<{ id: string }>(
    sql`
      DELETE FROM users
      WHERE deleted_at IS NOT NULL
        AND scheduled_deletion_at IS NOT NULL
        AND scheduled_deletion_at <= now()
      RETURNING id
    `,
  );
  return (rows as any).rows?.length ?? 0;
}

export async function getAccountDeletionStatus(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<{ deleted: boolean; scheduledDeletionAt: string | null }> {
  // The instant is read back from the database as epoch milliseconds rather than
  // as `timestamptz`: node-postgres hands that type to JS as its text form
  // (`2026-10-20 17:24:06.801+00`), which is not valid ISO 8601 and which
  // `new Date()` rejects. `deleteAccount` returns a real ISO string, so parsing
  // the text form here would have made the two halves of the same field disagree.
  const rows = await db.execute<{
    deleted_at: string | null;
    scheduled_ms: string | number | null;
  }>(
    sql`SELECT deleted_at,
               (extract(epoch FROM scheduled_deletion_at) * 1000)::bigint AS scheduled_ms
        FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Account not found");
  return {
    deleted: !!row.deleted_at,
    scheduledDeletionAt:
      row.scheduled_ms == null ? null : new Date(Number(row.scheduled_ms)).toISOString(),
  };
}
