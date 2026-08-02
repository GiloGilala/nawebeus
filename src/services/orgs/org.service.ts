import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors";

export interface OrgProfile {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  description: string | null;
  logoUrl: string | null;
  type: string | null;
  status: string | null;
  isActive: boolean;
  ownerId: string | null;
  createdAt: string | null;
}

export interface UpdateOrgInput {
  name?: string | undefined;
  displayName?: string | undefined;
  description?: string | undefined;
  logoUrl?: string | undefined;
}

export async function listUserOrgs(db: NodePgDatabase<Record<string, any>>, userId: string): Promise<OrgProfile[]> {
  const rows = await db.execute(
    sql`
      SELECT o.id, o.name, o.slug, o.display_name, o.description,
             o.logo_url, o.type, o.status, o.is_active, o.owner_id, o.created_at
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ${userId}
        AND om.deleted_at IS NULL
        AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `,
  );
  return ((rows as any).rows ?? []).map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    displayName: (r.display_name as string) ?? null,
    description: (r.description as string) ?? null,
    logoUrl: (r.logo_url as string) ?? null,
    type: (r.type as string) ?? null,
    status: (r.status as string) ?? null,
    isActive: !!r.is_active,
    ownerId: (r.owner_id as string) ?? null,
    createdAt: (r.created_at as string) ?? null,
  }));
}

export async function getOrg(db: NodePgDatabase<Record<string, any>>, orgId: string): Promise<OrgProfile> {
  const rows = await db.execute(
    sql`
      SELECT id, name, slug, display_name, description, logo_url,
             type, status, is_active, owner_id, created_at
      FROM organizations
      WHERE id = ${orgId} AND deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new NotFoundError("Organization not found");
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    displayName: (row.display_name as string) ?? null,
    description: (row.description as string) ?? null,
    logoUrl: (row.logo_url as string) ?? null,
    type: (row.type as string) ?? null,
    status: (row.status as string) ?? null,
    isActive: !!row.is_active,
    ownerId: (row.owner_id as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  };
}

export async function updateOrg(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  input: UpdateOrgInput,
): Promise<OrgProfile> {
  const sets: ReturnType<typeof sql>[] = [];
  if (input.name !== undefined) sets.push(sql`name = ${input.name}`);
  if (input.displayName !== undefined) sets.push(sql`display_name = ${input.displayName}`);
  if (input.description !== undefined) sets.push(sql`description = ${input.description}`);
  if (input.logoUrl !== undefined) sets.push(sql`logo_url = ${input.logoUrl}`);

  if (sets.length === 0) return await getOrg(db, orgId);

  await db.execute(
    sql`UPDATE organizations SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${orgId} AND deleted_at IS NULL`,
  );
  return await getOrg(db, orgId);
}

export async function isOrgMember(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const rows = await db.execute(
    sql`
      SELECT 1 FROM organization_members
      WHERE organization_id = ${orgId}
        AND user_id = ${userId}
        AND deleted_at IS NULL
      LIMIT 1
    `,
  );
  return ((rows as any).rows?.length ?? 0) > 0;
}
