import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import type { MemberProfile } from "./member.service";
import {
  assertNotLastAdministrator,
  assertRoleChangeAllowed,
  findMemberRole,
  requireActorRole,
  resolveAssignableRole,
} from "./role-policy";

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  reason?: string;
}

/**
 * Change a member's role, enforcing the role hierarchy policy
 * (`role-policy.ts`, DEC-039):
 *
 *  - the Owner role is transferred, never assigned; the Owner's own role
 *    never changes (BR-AUTH-031);
 *  - nobody changes their own role;
 *  - the actor must outrank both the member's current role and the new role
 *    ("Manager scope: roles below Manager only");
 *  - the last active Owner/Admin cannot be demoted (BR-AUTH-030).
 *
 * This is the **only** code path that writes `organization_members.role_id`
 * after signup: `updateMember` (PATCH /members/:id) and `updateUserAsAdmin`
 * (PATCH /users/admin/:id) delegate here, so the guards cannot be bypassed
 * through a sibling endpoint. Every change is audited and appended to
 * `member_role_history`.
 */
export async function assignRole(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
  input: AssignRoleInput,
): Promise<MemberProfile> {
  const actor = await requireActorRole(db, orgId, actingUserId);

  const target = await findMemberRole(db, orgId, { userId: input.userId });
  if (!target) throw new NotFoundError("Member not found in this organization");

  // 404 for roles that don't exist *for this organization* — a custom role
  // from another tenant is not distinguishable from a missing one.
  const newRole = await resolveAssignableRole(db, orgId, input.roleId);

  assertRoleChangeAllowed({
    actor: { userId: actor.userId, code: actor.code, level: actor.level },
    target: { userId: target.userId, code: target.code, level: target.level },
    newRole,
  });

  // Same role again is a no-op — don't spend an audit row or a history row.
  if (target.roleId === newRole.id) {
    return await readMemberProfile(db, orgId, target.memberId);
  }

  // Demoting an administrator: somebody else must still be able to run the org.
  if (newRole.code !== "owner" && newRole.code !== "admin") {
    await assertNotLastAdministrator(db, orgId, target);
  }

  await db.execute(
    sql`
      UPDATE organization_members
      SET role_id = ${newRole.id},
          updated_at = now()
      WHERE id = ${target.memberId}
        AND organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );

  await db.execute(
    sql`
      INSERT INTO member_role_history
        (member_id, role_id, role_name, changed_by, reason, previous_role_id, previous_role_name)
      VALUES
        (${target.memberId}, ${newRole.id}, ${newRole.name}, ${actingUserId}, ${input.reason ?? null},
         ${target.roleId}, ${target.roleName})
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    actorId: actingUserId,
    actorType: "user",
    action: "organization.member.role_changed",
    category: "authorization",
    resourceType: "member",
    resourceId: target.memberId,
    beforeState: { roleId: target.roleId, roleCode: target.code },
    afterState: {
      roleId: newRole.id,
      roleCode: newRole.code,
      newRole: newRole.name,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });

  return await readMemberProfile(db, orgId, target.memberId);
}

/**
 * Local re-read of the member profile. `member.service` imports `assignRole`
 * (PATCH /members/:id delegates its role change here), so importing
 * `getMember` back from it would create a runtime import cycle; the
 * `MemberProfile` import above is type-only and erased.
 */
async function readMemberProfile(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
): Promise<MemberProfile> {
  const rows = await db.execute(
    sql`
      SELECT om.id, om.user_id, om.organization_id, om.role_id,
             r.slug AS role_slug, om.status, om.is_active,
             om.display_name, om.job_title, om.department,
             u.email, u.username, om.created_at AS joined_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.id = ${memberId}
        AND om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new NotFoundError("Member not found");
  return {
    id: row.id as string,
    userId: row.user_id as string,
    organizationId: row.organization_id as string,
    roleId: (row.role_id as string) ?? null,
    roleSlug: (row.role_slug as string) ?? null,
    status: row.status as string,
    isActive: !!row.is_active,
    displayName: (row.display_name as string) ?? null,
    jobTitle: (row.job_title as string) ?? null,
    department: (row.department as string) ?? null,
    email: row.email as string,
    username: row.username as string,
    joinedAt: (row.joined_at as string) ?? null,
  };
}
