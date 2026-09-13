import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError } from "../../lib/errors";

export interface MemberProfile {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string | null;
  roleSlug: string | null;
  status: string;
  isActive: boolean;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  email: string;
  username: string;
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
             u.email, u.username, om.created_at AS joined_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = ${orgId}
        AND om.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY om.created_at ASC
    `,
  );
  return ((rows as any).rows ?? []).map((r: any) => ({
    id: r.id as string,
    userId: r.user_id as string,
    organizationId: r.organization_id as string,
    roleId: (r.role_id as string) ?? null,
    roleSlug: (r.role_slug as string) ?? null,
    status: r.status as string,
    isActive: !!r.is_active,
    displayName: (r.display_name as string) ?? null,
    jobTitle: (r.job_title as string) ?? null,
    department: (r.department as string) ?? null,
    email: r.email as string,
    username: r.username as string,
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

export async function updateMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
  input: UpdateMemberInput,
): Promise<MemberProfile> {
  const sets: ReturnType<typeof sql>[] = [];
  if (input.roleId !== undefined) sets.push(sql`role_id = ${input.roleId}`);
  if (input.displayName !== undefined) sets.push(sql`display_name = ${input.displayName}`);
  if (input.jobTitle !== undefined) sets.push(sql`job_title = ${input.jobTitle}`);
  if (input.department !== undefined) sets.push(sql`department = ${input.department}`);

  if (sets.length === 0) return await getMember(db, orgId, memberId);

  await db.execute(
    sql`UPDATE organization_members SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${memberId} AND organization_id = ${orgId} AND deleted_at IS NULL`,
  );
  return await getMember(db, orgId, memberId);
}

export async function removeMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  memberId: string,
): Promise<void> {
  await db.execute(
    sql`
      UPDATE organization_members
      SET deleted_at = now(), status = 'deactivated'
      WHERE id = ${memberId}
        AND organization_id = ${orgId}
        AND deleted_at IS NULL
    `,
  );
}
