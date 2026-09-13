import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError } from "../../lib/errors";

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

export async function updateUserAsAdmin(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  userId: string,
  input: AdminUpdateUserInput,
): Promise<AdminUserProfile> {
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

  if (input.roleId !== undefined) {
    await db.execute(
      sql`UPDATE organization_members SET role_id = ${input.roleId}, updated_at = now() WHERE organization_id = ${orgId} AND user_id = ${userId} AND deleted_at IS NULL`,
    );
  }

  return await getUserById(db, orgId, userId);
}

export async function deleteUser(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  userId: string,
): Promise<void> {
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
      SET deleted_at = now(), status = 'deactivated'
      WHERE organization_id = ${orgId} AND user_id = ${userId} AND deleted_at IS NULL
    `,
  );
}
