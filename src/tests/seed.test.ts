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

  test("default roles are created (DEC-039: super_admin + six org tiers)", async () => {
    const expected: Array<[string, number]> = [
      ["super_admin", 100],
      ["owner", 90],
      ["admin", 80],
      ["manager", 60],
      ["creator", 40],
      ["analyst", 20],
      ["viewer", 10],
    ];
    for (const [code, level] of expected) {
      const rows = await db.execute<{ id: string; level: number; is_system_role: boolean }>(
        sql`
          SELECT id, level, is_system_role FROM roles
          WHERE code = ${code} AND organization_id IS NULL AND deleted_at IS NULL
        `,
      );
      expect((rows as any).rows?.length).toBe(1);
      expect((rows as any).rows[0].level).toBe(level);
      expect((rows as any).rows[0].is_system_role).toBe(true);
    }
  });

  test("pre-DEC-039 roles org_admin and member are retired", async () => {
    const rows = await db.execute<{ code: string }>(
      sql`SELECT code FROM roles WHERE code IN ('org_admin', 'member') AND deleted_at IS NULL`,
    );
    expect((rows as any).rows?.length).toBe(0);
  });

  test("role permission matrix matches the module spec (§6.2 / FR-ORG-006)", async () => {
    const rows = await db.execute<{ code: string; permission_string: string }>(
      sql`
        SELECT r.code, p.permission_string
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id AND rp.status = 'active' AND rp.revoked_at IS NULL
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.organization_id IS NULL AND r.deleted_at IS NULL
      `,
    );
    const grants = new Map<string, Set<string>>();
    for (const row of (rows as any).rows ?? []) {
      const set = grants.get(row.code) ?? new Set<string>();
      set.add(row.permission_string);
      grants.set(row.code, set);
    }
    const has = (code: string, perm: string) => grants.get(code)?.has(perm) ?? false;

    // Billing and organization deletion are Owner-only
    for (const perm of ["billing.read", "billing.update", "org.delete"]) {
      expect(has("owner", perm)).toBe(true);
      for (const code of ["admin", "manager", "creator", "analyst", "viewer"]) {
        expect([code, perm, has(code, perm)]).toEqual([code, perm, false]);
      }
    }
    // Configure organization / audit / API keys: Owner + Admin only
    for (const perm of ["org.update", "audit.read", "apikeys.create"]) {
      expect(has("admin", perm)).toBe(true);
      expect(has("manager", perm)).toBe(false);
    }
    // Team management: Owner, Admin, Manager (Manager scope enforced in code)
    for (const perm of ["members.create", "members.update", "members.delete", "users.update"]) {
      expect(has("manager", perm)).toBe(true);
      expect(has("creator", perm)).toBe(false);
      expect(has("analyst", perm)).toBe(false);
      expect(has("viewer", perm)).toBe(false);
    }
    // Content: Creator creates but cannot approve/publish; Manager can
    expect(has("creator", "posts.create")).toBe(true);
    expect(has("creator", "posts.publish")).toBe(false);
    expect(has("manager", "posts.publish")).toBe(true);
    expect(has("analyst", "posts.create")).toBe(false);
    // Analytics: everyone reads; export is Manager/Analyst and above
    for (const code of ["owner", "admin", "manager", "creator", "analyst", "viewer"]) {
      expect(has(code, "analytics.read")).toBe(true);
      expect(has(code, "org.read")).toBe(true);
    }
    expect(has("analyst", "analytics.export")).toBe(true);
    expect(has("viewer", "analytics.export")).toBe(false);
    expect(has("creator", "analytics.export")).toBe(false);
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
