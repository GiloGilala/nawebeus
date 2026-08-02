import type { Db } from "../../lib/db";
import { sql } from "drizzle-orm";

export interface CreatedUser {
  id: string;
  email: string;
}

export interface CreatedOrg {
  id: string;
  slug: string;
}

export async function createTestUser(
  db: Db,
  overrides?: Partial<{
    email: string;
    password: string;
    username: string;
    firstName: string;
    lastName: string;
    status: string;
    organizationId: string;
  }>,
): Promise<CreatedUser> {
  const email = overrides?.email ?? `test-${crypto.randomUUID().slice(0, 8)}@test.com`;
  const username = overrides?.username ?? `testuser-${crypto.randomUUID().slice(0, 8)}`;
  const rows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO users (email, password, username, first_name, last_name, status)
      VALUES (
        ${email},
        ${overrides?.password ?? "TestPassword123!"},
        ${username},
        ${overrides?.firstName ?? "Test"},
        ${overrides?.lastName ?? "User"},
        ${overrides?.status ?? "active"}
      )
      RETURNING id
    `,
  );
  const id = ((rows as any).rows?.[0] as any)?.id as string;

  if (overrides?.organizationId) {
    await db.execute(
      sql`UPDATE users SET organization_id = ${overrides.organizationId} WHERE id = ${id}`,
    );
  }

  return { id, email };
}

export async function createTestOrg(
  db: Db,
  overrides?: Partial<{
    name: string;
    slug: string;
    type: string;
    status: string;
  }>,
): Promise<CreatedOrg> {
  const slug = overrides?.slug ?? `test-org-${crypto.randomUUID().slice(0, 8)}`;
  const name = overrides?.name ?? "Test Organization";
  const rows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO organizations (name, slug, display_name, type, status, is_active, is_verified)
      VALUES (
        ${name},
        ${slug},
        ${name},
        ${overrides?.type ?? "team"},
        ${overrides?.status ?? "active"},
        true,
        true
      )
      RETURNING id
    `,
  );
  const id = ((rows as any).rows?.[0] as any)?.id as string;
  return { id, slug };
}

export async function createTestMember(
  db: Db,
  overrides: {
    organizationId: string;
    userId: string;
    roleId: string;
    status?: string;
  },
): Promise<{ id: string }> {
  const rows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO organization_members (organization_id, user_id, role_id, status)
      VALUES (
        ${overrides.organizationId},
        ${overrides.userId},
        ${overrides.roleId},
        ${overrides.status ?? "active"}
      )
      RETURNING id
    `,
  );
  const id = ((rows as any).rows?.[0] as any)?.id as string;
  return { id };
}
