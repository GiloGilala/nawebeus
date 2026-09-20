import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("seed data", () => {
  let pool: pg.Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("seed completes without error", async () => {
    const rows = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*) as count FROM permissions`,
    );
    const count = Number((rows as any).rows?.[0]?.count ?? 0);
    expect(count).toBeGreaterThan(0);
  });

  test("bootstrap admin user exists with configured email", async () => {
    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@nawebeus.com";
    const rows = await db.execute<{ id: string; email: string }>(
      sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`,
    );
    expect((rows as any).rows?.length).toBe(1);
    expect((rows as any).rows[0].email).toBe(email);
  });

  test("default roles are created", async () => {
    const slugs = ["super_admin", "owner", "org_admin", "member", "viewer"];
    for (const slug of slugs) {
      const rows = await db.execute<{ id: string }>(
        sql`SELECT id FROM roles WHERE slug = ${slug} LIMIT 1`,
      );
      expect((rows as any).rows?.length).toBe(1);
    }
  });

  test("default permissions are mapped to super_admin role", async () => {
    const roleRows = await db.execute<{ id: string }>(
      sql`SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1`,
    );
    const roleId = (roleRows as any).rows?.[0]?.id;
    expect(roleId).toBeDefined();

    const permRows = await db.execute<{ count: string }>(
      sql`
        SELECT COUNT(*) as count FROM role_permissions
        WHERE role_id = ${roleId} AND status = 'active'
      `,
    );
    const count = Number((permRows as any).rows?.[0]?.count ?? 0);
    expect(count).toBeGreaterThan(0);
  });
});
