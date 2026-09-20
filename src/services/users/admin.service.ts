import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { assignRole } from "../orgs/role-assignment.service";
import {
  assertMemberActionAllowed,
  assertNotLastAdministrator,
  findMemberRole,
  requireActorRole,
} from "../orgs/role-policy";

export interface AdminUserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  profileImage: string | null;
  status: string;
  role: string | null;
  memberId: string;
  memberStatus: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface AdminUpdateUserInput {
  status?: string | undefined;
  roleId?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  displayName?: string | undefined;
}

export async function listUsers(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
): Promise<AdminUserProfile[]> {
  const rows = await db.execute(
    sql`
      SELECT u.id, u.email, u.username, u.first_name, u.last_name,
             u.display_name, u.profile_image, u.status, u.role,
             om.id AS member_id, om.status AS member_status, om.is_active,
             u.last_login_at, u.created_at
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `,
  );
  return ((rows as any).rows ?? []).map((r: any) => ({
    id: r.id as string,
    email: r.email as string,
    username: r.username as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    displayName: (r.display_name as string) ?? null,
    profileImage: (r.profile_image as string) ?? null,
    status: r.status as string,
    role: (r.role as string) ?? null,
    memberId: r.member_id as string,
    memberStatus: r.member_status as string,
    isActive: !!r.is_active,
    lastLoginAt: (r.last_login_at as string) ?? null,
    createdAt: (r.created_at as string) ?? null,
  }));
}

export async function getUserById(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  userId: string,
): Promise<AdminUserProfile> {
  const rows = await db.execute(
    sql`
      SELECT u.id, u.email, u.username, u.first_name, u.last_name,
             u.display_name, u.profile_image, u.status, u.role,
             om.id AS member_id, om.status AS member_status, om.is_active,
             u.last_login_at, u.created_at
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE om.organization_id = ${orgId}
        AND u.id = ${userId}
        AND om.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new NotFoundError("User not found in this organization");
  return {
    id: row.id as string,
    email: row.email as string,
    username: row.username as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    displayName: (row.display_name as string) ?? null,
    profileImage: (row.profile_image as string) ?? null,
    status: row.status as string,
    role: (row.role as string) ?? null,
    memberId: row.member_id as string,
    memberStatus: row.member_status as string,
    isActive: !!row.is_active,
    lastLoginAt: (row.last_login_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  };
}

/**
 * Admin update of a user inside the acting user's organization.
 *
 * Role changes delegate to `assignRole`, so this endpoint enforces the same
 * hierarchy and self-protection rules as /members/assign-role. Suspending
 * (or otherwise changing the status of) a member is a moderation action on
 * that member and is guarded the same way removal is: not the Owner, not
 * yourself ("Cannot suspend self", module spec §6.3), only members below
 * your own role, and never the last active Owner/Admin.
 */
export async function updateUserAsAdmin(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  userId: string,
  input: AdminUpdateUserInput,
  actingUserId: string,
): Promise<AdminUserProfile> {
  // Confirms the target is a member of *this* organization before any write.
  const before = await getUserById(db, orgId, userId);

  if (input.roleId !== undefined) {
    await assignRole(db, orgId, actingUserId, { userId, roleId: input.roleId });
  }

  if (input.status !== undefined && input.status !== before.status) {
    const actor = await requireActorRole(db, orgId, actingUserId);
    const target = await findMemberRole(db, orgId, { userId });
    if (!target) throw new NotFoundError("User not found in this organization");
    assertMemberActionAllowed({
      actor: { userId: actor.userId, code: actor.code, level: actor.level },
      target: { userId: target.userId, code: target.code, level: target.level },
    });
    if (input.status !== "active") {
      await assertNotLastAdministrator(db, orgId, target);
    }
  }

  const sets: ReturnType<typeof sql>[] = [];
  if (input.firstName !== undefined) sets.push(sql`first_name = ${input.firstName}`);
  if (input.lastName !== undefined) sets.push(sql`last_name = ${input.lastName}`);
  if (input.displayName !== undefined) sets.push(sql`display_name = ${input.displayName}`);
  if (input.status !== undefined) sets.push(sql`status = ${input.status}`);

  if (sets.length > 0) {
    await db.execute(
      sql`UPDATE users SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${userId} AND deleted_at IS NULL`,
    );
  }

  if (input.status !== undefined && input.status !== before.status) {
    await writeAuditLog({
      db,
      module: "core",
      organizationId: orgId,
      actorId: actingUserId,
      actorType: "user",
      action: "organization.member.status_changed",
      category: "user_management",
      resourceType: "user",
      resourceId: userId,
      targetUserId: userId,
      beforeState: { status: before.status },
      afterState: { status: input.status },
    });
  }

  return await getUserById(db, orgId, userId);
}

/**
 * Admin deletion of a user from the acting user's organization.
 *
 * Guarded like member removal (Owner never, self never, only members below
 * the actor, last Owner/Admin stays). The membership status is set to
 * `suspended` alongside `deleted_at` because `member_status` has no
 * "deactivated" value — the previous literal was an enum violation and every
 * call 500'd (F-21).
 *
 * Note: this soft-deletes the *user account*, not just the membership —
 * inherited behaviour, kept as-is pending the multi-org decision (D14).
 */
export async function deleteUser(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  userId: string,
  actingUserId: string,
): Promise<void> {
  const actor = await requireActorRole(db, orgId, actingUserId);
  const target = await findMemberRole(db, orgId, { userId });
  if (!target) throw new NotFoundError("User not found in this organization");
  if (actor.userId === target.userId) {
    throw new ForbiddenError("You cannot delete your own account here — use account deletion");
  }
  assertMemberActionAllowed({
    actor: { userId: actor.userId, code: actor.code, level: actor.level },
    target: { userId: target.userId, code: target.code, level: target.level },
  });
  await assertNotLastAdministrator(db, orgId, target);

  await db.execute(
    sql`
      UPDATE users
      SET deleted_at = now(), status = 'deleted'
      WHERE id = ${userId} AND deleted_at IS NULL
    `,
  );
  await db.execute(
    sql`
      UPDATE organization_members
      SET deleted_at = now(), status = 'suspended', is_active = false, updated_at = now()
      WHERE organization_id = ${orgId} AND user_id = ${userId} AND deleted_at IS NULL
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    actorId: actingUserId,
    actorType: "user",
    action: "organization.member.deleted",
    category: "user_management",
    resourceType: "user",
    resourceId: userId,
    targetUserId: userId,
    beforeState: { roleId: target.roleId, roleCode: target.code, status: target.status },
  });
}
