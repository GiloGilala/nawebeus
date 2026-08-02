import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  profileImage: string | null;
  status: string;
  role: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface UpdateUserInput {
  firstName?: string | undefined;
  lastName?: string | undefined;
  displayName?: string | undefined;
  profileImage?: string | undefined;
}

export async function getUser(db: NodePgDatabase<Record<string, any>>, userId: string): Promise<UserProfile> {
  const rows = await db.execute(
    sql`
      SELECT id, email, username, first_name, last_name, display_name,
             profile_image, status, role, last_login_at, created_at
      FROM users
      WHERE id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new NotFoundError("User not found");
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
    lastLoginAt: (row.last_login_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  };
}

export async function updateUser(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  input: UpdateUserInput,
): Promise<UserProfile> {
  const sets: ReturnType<typeof sql>[] = [];
  if (input.firstName !== undefined) sets.push(sql`first_name = ${input.firstName}`);
  if (input.lastName !== undefined) sets.push(sql`last_name = ${input.lastName}`);
  if (input.displayName !== undefined) sets.push(sql`display_name = ${input.displayName}`);
  if (input.profileImage !== undefined) sets.push(sql`profile_image = ${input.profileImage}`);

  if (sets.length === 0) return await getUser(db, userId);

  await db.execute(
    sql`UPDATE users SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${userId} AND deleted_at IS NULL`,
  );
  return await getUser(db, userId);
}
