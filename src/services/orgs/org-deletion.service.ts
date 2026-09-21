import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";

/**
 * Organization deletion — PRD 8.2.1 (P0), discrepancy D-14, ticket NWB-P0-023.
 *
 * Mirrors the account-deletion pattern (`src/services/users/account-deletion.service.ts`):
 * soft delete → 30-day grace → reactivate, plus a purge function that is not yet
 * scheduled (the scheduler arrives with the Phase 2 queue, same as F-18).
 *
 * The ticket says to copy that pattern; it also says to read F-24 and F-25 first,
 * because the pattern shipped broken twice. Both lessons are applied here:
 *
 *  - **F-24** was "the service referenced a column that does not exist" — every
 *    call died on 42703 and no test noticed. Every column this module writes was
 *    verified present on `organizations` against a live PostgreSQL 14 before the
 *    code was written: `deleted_at`, `deleted_by`, `deletion_reason`,
 *    `scheduled_deletion_at`, `status`, `is_active`. The lifecycle test exercises
 *    all four functions against a real database, so a missing column fails loudly.
 *
 *  - **F-25** was "the purge cannot delete an org owner, because a restrictive FK
 *    refuses". The equivalent question here is: what refuses a hard
 *    `DELETE FROM organizations`? Verified against the live catalog — every FK
 *    referencing `organizations.id` is `CASCADE` (api_keys, oauth_accounts,
 *    organization_members, permission_groups, permissions, roles) or `SET NULL`
 *    (organizations.parent_organization_id, users.organization_id). There is no
 *    restrictive edge, so `purgeExpiredOrganizations` can actually complete —
 *    unlike its account-side sibling, which had to be gated instead. This is
 *    asserted by a test rather than left as a claim.
 */

const DELETION_GRACE_DAYS = 30;

export interface OrgDeletionOptions {
  // `| undefined` is explicit because tsconfig sets `exactOptionalPropertyTypes`:
  // a Zod `.optional()` field yields `string | undefined`, which a bare `reason?:
  // string` rejects.
  reason?: string | undefined;
}

export interface OrgDeletionStatus {
  deleted: boolean;
  scheduledDeletionAt: string | null;
}

/**
 * Billing hook — Phase 6 / P13.
 *
 * PRD 8.2.1 blocks deletion while the organization has an active paid
 * subscription. No billing state exists yet, and the ticket is explicit: stub
 * the check, do not invent the state. This returns "nothing blocks" and is the
 * single place P13 has to change; keeping it as a real (if trivial) call means
 * the wiring is already tested by every delete test that passes through it.
 *
 * TODO(P13): resolve against the real subscription record and return the
 * blocking reason so `deleteOrganization` can 409 with it.
 */
async function findBillingBlocker(
  _db: NodePgDatabase<Record<string, any>>,
  _orgId: string,
): Promise<string | null> {
  return null;
}

/** The acting user must be the organization's owner (D13). */
async function assertActorIsOwner(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
): Promise<{ id: string; name: string; ownerId: string; deletedAt: string | null }> {
  const rows = await db.execute<{
    id: string;
    name: string;
    owner_id: string;
    deleted_at: string | null;
  }>(sql`SELECT id, name, owner_id, deleted_at FROM organizations WHERE id = ${orgId} LIMIT 1`);
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Organization not found");

  // Deliberately checked against `organizations.owner_id`, not against a role
  // row. DEC-039 makes Owner a transferred singleton recorded on the
  // organization itself; a membership carrying the `owner` role code is a
  // consequence of that, not the source of truth. Checking the column means a
  // desynced membership row can never authorise a deletion.
  if (row.owner_id !== actingUserId) {
    throw new ForbiddenError("Only the organization owner can delete this organization");
  }

  return {
    id: row.id as string,
    name: row.name as string,
    ownerId: row.owner_id as string,
    deletedAt: (row.deleted_at as string) ?? null,
  };
}

/**
 * Soft-deletes an organization and enters the 30-day grace period.
 *
 * Cascades, all reversible by `reactivateOrganization`:
 *  - memberships deactivated (`status='suspended'`, `is_active=false`) — but
 *    **not** `deleted_at`-stamped, so reactivation can tell "suspended because
 *    the org was deleted" from "suspended by an admin" and restore only the
 *    former;
 *  - API keys revoked;
 *  - sessions of every member revoked, so nobody keeps an authenticated window
 *    into a deleted organization.
 */
export async function deleteOrganization(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
  options?: OrgDeletionOptions,
): Promise<{ scheduledDeletionAt: string }> {
  const org = await assertActorIsOwner(db, orgId, actingUserId);
  if (org.deletedAt !== null) {
    throw new ConflictError("Organization is already scheduled for deletion");
  }

  const blocker = await findBillingBlocker(db, orgId);
  if (blocker) throw new ConflictError(blocker);

  const scheduledDeletionAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db.execute<{ id: string }>(
    sql`
      UPDATE organizations
      SET deleted_at = now(),
          deleted_by = ${actingUserId},
          deletion_reason = ${options?.reason ?? null},
          scheduled_deletion_at = ${scheduledDeletionAt.toISOString()}::timestamptz,
          status = 'deleted',
          is_active = false,
          updated_at = now()
      WHERE id = ${orgId}
        AND deleted_at IS NULL
      RETURNING id
    `,
  );
  if (!(rows as any).rows?.[0]) {
    // Lost the race with a concurrent delete between the read and the write.
    throw new ConflictError("Organization is already scheduled for deletion");
  }

  // Memberships: deactivated, not soft-deleted. See the docstring above —
  // `deleted_at IS NULL` is what lets reactivation distinguish this from an
  // admin's own suspension of a member.
  await db.execute(
    sql`
      UPDATE organization_members
      SET status = 'suspended', is_active = false, updated_at = now()
      WHERE organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );

  await db.execute(
    sql`
      UPDATE api_keys
      SET status = 'revoked', revoked_at = now(), revoked_by = ${actingUserId}
      WHERE organization_id = ${orgId}
        AND status = 'active'
        AND deleted_at IS NULL
    `,
  );

  // Sessions carry no organization_id (verified against the live catalog), so
  // they are revoked per member rather than by a single org predicate.
  await db.execute(
    sql`
      UPDATE sessions
      SET is_revoked = true, revoked_at = now(), status = 'revoked'
      WHERE is_revoked = false
        AND user_id IN (
          SELECT user_id FROM organization_members WHERE organization_id = ${orgId}
        )
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    actorId: actingUserId,
    actorType: "user",
    action: "organization.deleted",
    category: "security",
    severity: "warning",
    resourceType: "organization",
    resourceId: orgId,
    beforeState: { name: org.name, status: "active" },
    afterState: {
      status: "deleted",
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      deletionReason: options?.reason ?? null,
    },
  });

  return { scheduledDeletionAt: scheduledDeletionAt.toISOString() };
}

/**
 * Reverses a soft delete within the grace window, restoring the memberships and
 * API keys that `deleteOrganization` deactivated.
 *
 * Sessions are deliberately **not** restored: a revoked session is a
 * credential, and un-revoking one would resurrect tokens that may have leaked
 * during the deleted window. Members sign in again.
 */
export async function reactivateOrganization(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
): Promise<void> {
  // Ownership is re-checked here, and `assertActorIsOwner` reads the row
  // regardless of `deleted_at` — a deleted organization must still be
  // recoverable by its owner, which a `deleted_at IS NULL` filter would prevent.
  await assertActorIsOwner(db, orgId, actingUserId);

  const rows = await db.execute<{ id: string }>(
    sql`
      UPDATE organizations
      SET deleted_at = NULL,
          deleted_by = NULL,
          deletion_reason = NULL,
          scheduled_deletion_at = NULL,
          status = 'active',
          is_active = true,
          updated_at = now()
      WHERE id = ${orgId}
        AND deleted_at IS NOT NULL
        AND (scheduled_deletion_at IS NULL OR scheduled_deletion_at > now())
      RETURNING id
    `,
  );
  if (!(rows as any).rows?.[0]) {
    throw new NotFoundError("Organization is not deleted, or its grace period has expired");
  }

  await db.execute(
    sql`
      UPDATE organization_members
      SET status = 'active', is_active = true, updated_at = now()
      WHERE organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );

  await db.execute(
    sql`
      UPDATE api_keys
      SET status = 'active', revoked_at = NULL, revoked_by = NULL
      WHERE organization_id = ${orgId}
        AND status = 'revoked'
        AND deleted_at IS NULL
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    actorId: actingUserId,
    actorType: "user",
    action: "organization.reactivated",
    category: "security",
    resourceType: "organization",
    resourceId: orgId,
  });
}

/**
 * Permanently deletes organizations whose grace period has expired. Returns the
 * number purged. Intended for the Phase 2 scheduler; unscheduled until then, so
 * today it runs only when called directly (script or test) — exactly the state
 * `purgeExpiredAccounts` is in (F-18).
 *
 * Unlike the account purge, this one can actually complete: every FK referencing
 * `organizations.id` is CASCADE or SET NULL, with no restrictive edge (verified
 * against the live catalog; pinned by a test). The members themselves are not
 * deleted — a user is not owned by an organization, their `users.organization_id`
 * is simply set to NULL by the FK. Deleting people along with a workspace is the
 * mistake F-25's option 1 was rejected for.
 */
export async function purgeExpiredOrganizations(
  db: NodePgDatabase<Record<string, any>>,
): Promise<number> {
  const rows = await db.execute<{ id: string }>(
    sql`
      DELETE FROM organizations
      WHERE deleted_at IS NOT NULL
        AND scheduled_deletion_at IS NOT NULL
        AND scheduled_deletion_at <= now()
      RETURNING id
    `,
  );
  return (rows as any).rows?.length ?? 0;
}

export async function getOrgDeletionStatus(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
): Promise<OrgDeletionStatus> {
  // Epoch milliseconds, not the raw `timestamptz` — node-postgres returns that
  // type as `2026-10-20 17:24:06.801+00`, which is not ISO 8601 and which
  // `new Date()` rejects. This is the F-24 lesson from
  // `getAccountDeletionStatus`; the two must not disagree on the same field.
  const rows = await db.execute<{
    deleted_at: string | null;
    scheduled_ms: string | number | null;
  }>(
    sql`SELECT deleted_at,
               (extract(epoch FROM scheduled_deletion_at) * 1000)::bigint AS scheduled_ms
        FROM organizations WHERE id = ${orgId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Organization not found");
  return {
    deleted: !!row.deleted_at,
    scheduledDeletionAt:
      row.scheduled_ms == null ? null : new Date(Number(row.scheduled_ms)).toISOString(),
  };
}
