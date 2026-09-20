import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { assignRole } from "./role-assignment.service";
import {
  assertMemberActionAllowed,
  assertNotLastAdministrator,
  findMemberRole,
  requireActorRole,
} from "./role-policy";

export interface MemberProfile {
  id: string;
  /** NULL while the membership is a pending invite whose invitee has no account yet. */
  userId: string | null;
  organizationId: string;
  roleId: string | null;
  roleSlug: string | null;
  status: string;
  isActive: boolean;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  email: string;
  username: string | null;
  joinedAt: string | null;
}

export interface UpdateMemberInput {
  roleId?: string | undefined;
  displayName?: string | undefined;
  jobTitle?: string | undefined;
  department?: string | undefined;
}

export async function listMembers(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
): Promise<MemberProfile[]> {
  const rows = await db.execute(
    sql`
      SELECT om.id, om.user_id, om.organization_id, om.role_id,
             r.slug AS role_slug, om.status, om.is_active,
             om.display_name, om.job_title, om.department,
             COALESCE(u.email, om.invited_email) AS email,
             u.username, om.created_at AS joined_at
      FROM organization_members om
      LEFT JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
      ORDER BY om.created_at ASC
    `,
  );
  return ((rows as any).rows ?? []).map((r: any) => ({
    id: r.id as string,
    userId: (r.user_id as string) ?? null,
    organizationId: r.organization_id as string,
    roleId: (r.role_id as string) ?? null,
    roleSlug: (r.role_slug as string) ?? null,
    status: r.status as string,
    isActive: !!r.is_active,
    displayName: (r.display_name as string) ?? null,
    jobTitle: (r.job_title as string) ?? null,
    department: (r.department as string) ?? null,
    email: r.email as string,
    username: (r.username as string) ?? null,
    joinedAt: (r.joined_at as string) ?? null,
  }));
}

export async function getMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
): Promise<MemberProfile> {
  const rows = await db.execute(
    sql`
      SELECT om.id, om.user_id, om.organization_id, om.role_id,
             r.slug AS role_slug, om.status, om.is_active,
             om.display_name, om.job_title, om.department,
             COALESCE(u.email, om.invited_email) AS email,
             u.username, om.created_at AS joined_at
      FROM organization_members om
      LEFT JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.id = ${memberId}
        AND om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new NotFoundError("Member not found");
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    organizationId: row.organization_id as string,
    roleId: (row.role_id as string) ?? null,
    roleSlug: (row.role_slug as string) ?? null,
    status: row.status as string,
    isActive: !!row.is_active,
    displayName: (row.display_name as string) ?? null,
    jobTitle: (row.job_title as string) ?? null,
    department: (row.department as string) ?? null,
    email: row.email as string,
    username: (row.username as string) ?? null,
    joinedAt: (row.joined_at as string) ?? null,
  };
}

export async function updateMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
  input: UpdateMemberInput,
  actingUserId: string,
): Promise<MemberProfile> {
  // A role change is a role assignment, wherever it is submitted from: run
  // it through the guarded path so PATCH /members/:id cannot bypass the
  // hierarchy and self-protection rules enforced on /members/assign-role.
  if (input.roleId !== undefined) {
    const target = await getMember(db, orgId, memberId);
    // A pending invite (user_id NULL) is re-roled by re-inviting with the new
    // role, which also re-runs the grant ladder (NWB-P0-016).
    if (!target.userId) {
      throw new ValidationError(
        "Cannot change the role of a member who has not accepted their invitation yet — re-invite them with the new role instead",
      );
    }
    await assignRole(db, orgId, actingUserId, { userId: target.userId, roleId: input.roleId });
  }

  const sets: ReturnType<typeof sql>[] = [];
  if (input.displayName !== undefined) sets.push(sql`display_name = ${input.displayName}`);
  if (input.jobTitle !== undefined) sets.push(sql`job_title = ${input.jobTitle}`);
  if (input.department !== undefined) sets.push(sql`department = ${input.department}`);

  if (sets.length === 0) return await getMember(db, orgId, memberId);

  await db.execute(
    sql`UPDATE organization_members SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${memberId} AND organization_id = ${orgId} AND deleted_at IS NULL`,
  );
  return await getMember(db, orgId, memberId);
}

/**
 * Remove a member from the organization (soft delete).
 *
 * Guards (role-policy.ts): the Owner is never removed, nobody removes
 * themselves, the actor must outrank the member, and the last active
 * Owner/Admin stays (BR-AUTH-030).
 *
 * The row is marked `deleted_at` + `is_active = false` and its status set to
 * `suspended`: `member_status` has no "removed"/"deactivated" value (the
 * previous `status = 'deactivated'` was an enum violation, so every removal
 * failed with a 500 — F-21). `deleted_at IS NULL` is the membership
 * predicate everywhere, so the status value only has to be a legal one;
 * `suspended` matches what account deletion already writes.
 */
export async function removeMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
  actingUserId: string,
): Promise<void> {
  const actor = await requireActorRole(db, orgId, actingUserId);
  const target = await findMemberRole(db, orgId, { memberId });
  if (!target) throw new NotFoundError("Member not found");

  assertMemberActionAllowed({
    actor: { userId: actor.userId, code: actor.code, level: actor.level },
    target: { userId: target.userId, code: target.code, level: target.level },
  });
  await assertNotLastAdministrator(db, orgId, target);

  await db.execute(
    sql`
      UPDATE organization_members
      SET deleted_at = now(), status = 'suspended', is_active = false, updated_at = now()
      WHERE id = ${memberId}
        AND organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    actorId: actingUserId,
    actorType: "user",
    action: "organization.member.removed",
    category: "authorization",
    resourceType: "member",
    resourceId: memberId,
    targetUserId: target.userId,
    beforeState: { roleId: target.roleId, roleCode: target.code, status: target.status },
  });
}
