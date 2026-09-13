import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import type { MemberProfile } from "./member.service";

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  reason?: string;
}

/**
 * Enforces the role-based self-protection rules:
 *  - Owner (role code 'owner') can never be demoted or removed.
 *  - The acting user cannot remove the Owner role from themselves.
 *  - The last active Admin cannot be removed (prevents lockout).
 */
export async function assignRole(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
  input: AssignRoleInput,
): Promise<MemberProfile> {
  // --- Look up the target member + their current role ---
  const targetRows = await db.execute<{
    member_id: string;
    user_id: string;
    role_code: string | null;
    role_name: string | null;
    role_slug: string | null;
    status: string;
    is_active: boolean;
  }>(
    sql`
      SELECT om.id AS member_id, om.user_id, r.code AS role_code, r.name AS role_name, r.slug AS role_slug,
             om.status, om.is_active
      FROM organization_members om
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = ${orgId}
        AND om.user_id = ${input.userId}
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const target = (targetRows as any).rows?.[0] as any;
  if (!target) throw new NotFoundError("Member not found in this organization");

  // --- Look up the new role ---
  const newRoleRows = await db.execute<{
    code: string;
    name: string;
    level: number;
  }>(
    sql`SELECT code, name, level FROM roles WHERE id = ${input.roleId} AND organization_id = ${orgId} AND deleted_at IS NULL LIMIT 1`,
  );
  const newRole = (newRoleRows as any).rows?.[0] as any;
  if (!newRole) throw new NotFoundError("Role not found");

  // --- Self-protection: nobody can demote/remove the Owner ---
  const currentCode = target.role_code;
  if (currentCode === "owner") {
    throw new ForbiddenError("Cannot change the Owner role of this user");
  }

  // --- Self-protection: owner can't remove their own role (except self-reassign is allowed to same) ---
  if (input.userId === actingUserId && newRole.code !== "owner" && currentCode === "admin") {
    // Owner demoting themselves to a non-owner role
    const actingRows = await db.execute<{ role_code: string | null }>(
      sql`
        SELECT r.code AS role_code FROM organization_members om
        LEFT JOIN roles r ON r.id = om.role_id
        WHERE om.organization_id = ${orgId} AND om.user_id = ${actingUserId} AND om.deleted_at IS NULL LIMIT 1
      `,
    );
    const actingRole = (actingRows as any).rows?.[0] as any;
    if (actingRole?.role_code === "owner") {
      throw new ForbiddenError("A Owner cannot remove their own role");
    }
  }

  // --- Self-protection: last active Admin cannot be removed ---
  if (currentCode === "admin") {
    const adminCountRows = await db.execute<{ count: number }>(
      sql`
        SELECT COUNT(*)::int AS count FROM organization_members om
        LEFT JOIN roles r ON r.id = om.role_id
        WHERE om.organization_id = ${orgId}
          AND r.code = 'admin'
          AND om.status = 'active'
          AND om.is_active = true
          AND om.deleted_at IS NULL
      `,
    );
    const adminCount = (adminCountRows as any).rows?.[0]?.count ?? 0;
    if (adminCount <= 1 && newRole.code !== "owner") {
      throw new ConflictError("Cannot remove the last Admin — first assign another Admin");
    }
  }

  // --- Perform the role assignment ---
  await db.execute(
    sql`
      UPDATE organization_members
      SET role_id = ${input.roleId},
          status = 'active',
          is_active = true,
          accepted_at = COALESCE(accepted_at, now()),
          updated_at = now()
      WHERE id = ${target.member_id}
        AND organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    actorId: actingUserId,
    actorType: "user",
    action: "organization.member.role_changed",
    category: "authorization",
    resourceType: "member",
    resourceId: target.member_id,
    afterState: { newRole: newRole.name, newRoleId: input.roleId },
  });

  // Re-fetch to return updated profile
  const refreshedRows = await db.execute<{
    id: string;
    user_id: string;
    organization_id: string;
    role_id: string | null;
    role_slug: string | null;
    status: string;
    is_active: boolean;
    display_name: string | null;
    job_title: string | null;
    department: string | null;
    email: string;
    username: string;
    created_at: string | null;
  }>(
    sql`
      SELECT om.id, om.user_id, om.organization_id, om.role_id,
             r.slug AS role_slug, om.status, om.is_active,
             om.display_name, om.job_title, om.department,
             u.email, u.username, om.created_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.id = ${target.member_id}
        AND om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (refreshedRows as any).rows?.[0] as any;
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    roleId: (row.role_id as string) ?? null,
    roleSlug: (row.role_slug as string) ?? null,
    status: row.status,
    isActive: !!row.is_active,
    displayName: (row.display_name as string) ?? null,
    jobTitle: (row.job_title as string) ?? null,
    department: (row.department as string) ?? null,
    email: row.email,
    username: row.username,
    joinedAt: (row.created_at as string) ?? null,
  };
}
