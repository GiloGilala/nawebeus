import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { hashPassword } from "../../services/auth/password";

/**
 * Default password for factory-created users. Exported so tests that need to
 * sign in know what to send.
 */
export const TEST_USER_PASSWORD = "TestPassword123!";

export interface CreatedUser {
  id: string;
  email: string;
  /** The plaintext password the user was created with — never the stored digest. */
  password: string;
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
  const password = overrides?.password ?? TEST_USER_PASSWORD;

  // Store a real bcrypt digest, exactly as the signup path does. Inserting the
  // plaintext made sign-in throw rather than fail cleanly: Bun.password.verify()
  // raises "UnsupportedAlgorithm" for a non-bcrypt value instead of returning false.
  const passwordHash = await hashPassword(password);

  const rows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO users (email, password, username, first_name, last_name, status)
      VALUES (
        ${email},
        ${passwordHash},
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

  return { id, email, password };
}

/**
 * Creates an organization.
 *
 * `ownerId` is required, not optional: `organizations.owner_id` is NOT NULL with
 * a restrictive FK to `users`, so an organization cannot exist without an owner.
 * Create the owner first, then the organization.
 */
export async function createTestOrg(
  db: Db,
  overrides: { ownerId: string } & Partial<{
    name: string;
    slug: string;
    type: string;
    status: string;
  }>,
): Promise<CreatedOrg> {
  const slug = overrides.slug ?? `test-org-${crypto.randomUUID().slice(0, 8)}`;
  const name = overrides.name ?? "Test Organization";
  const rows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO organizations (name, slug, display_name, type, status, is_active, is_verified, owner_id, created_by)
      VALUES (
        ${name},
        ${slug},
        ${name},
        ${overrides.type ?? "team"},
        ${overrides.status ?? "active"},
        true,
        true,
        ${overrides.ownerId},
        ${overrides.ownerId}
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
