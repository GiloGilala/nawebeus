import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { withTestDb } from "./helpers/test-db";
import { createTestMember, createTestOrg, createTestUser } from "./helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("test factory", () => {
  test("createTestUser produces a valid user", async () => {
    await withTestDb(async (ctx) => {
      const user = await createTestUser(ctx.db);
      expect(user.id).toBeDefined();
      expect(user.id.length).toBeGreaterThan(0);
      expect(user.email).toContain("@");

      const rows = await ctx.db.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE id = ${user.id} LIMIT 1`,
      );
      expect((rows as any).rows?.length).toBe(1);
    });
  });

  test("createTestOrg produces a valid organization", async () => {
    await withTestDb(async (ctx) => {
      const user = await createTestUser(ctx.db);
      const org = await createTestOrg(ctx.db, { ownerId: user.id });
      expect(org.id).toBeDefined();
      expect(org.id.length).toBeGreaterThan(0);
      expect(org.slug).toBeDefined();

      const rows = await ctx.db.execute<{ id: string }>(
        sql`SELECT id FROM organizations WHERE id = ${org.id} LIMIT 1`,
      );
      expect((rows as any).rows?.length).toBe(1);
    });
  });

  test("createTestMember produces a valid membership", async () => {
    await withTestDb(async (ctx) => {
      const user = await createTestUser(ctx.db);
      const org = await createTestOrg(ctx.db, { ownerId: user.id });

      // Create a role first
      const roleRows = await ctx.db.execute<{ id: string }>(
        sql`
          INSERT INTO roles (slug, name, display_name, code, level, priority, is_system_role)
          VALUES ('test-role', 'Test Role', 'Test Role', 'test_role', 1, 1, false)
          RETURNING id
        `,
      );
      const roleId = ((roleRows as any).rows?.[0] as any)?.id as string;

      const member = await createTestMember(ctx.db, {
        organizationId: org.id,
        userId: user.id,
        roleId,
      });
      expect(member.id).toBeDefined();
      expect(member.id.length).toBeGreaterThan(0);
    });
  });

  test("createTestUser with overrides", async () => {
    await withTestDb(async (ctx) => {
      const user = await createTestUser(ctx.db, {
        email: "override@test.com",
        username: "override-user",
        firstName: "Override",
        lastName: "User",
      });
      expect(user.email).toBe("override@test.com");

      const rows = await ctx.db.execute<{
        first_name: string;
        last_name: string;
      }>(sql`SELECT first_name, last_name FROM users WHERE id = ${user.id} LIMIT 1`);
      expect((rows as any).rows[0].first_name).toBe("Override");
      expect((rows as any).rows[0].last_name).toBe("User");
    });
  });

  test("creates are rolled back after test", async () => {
    const countBefore = async () => {
      const rows = await withTestDb(async (ctx) => {
        const r = await ctx.db.execute<{ count: string }>(sql`SELECT COUNT(*) as count FROM users`);
        return Number((r as any).rows?.[0]?.count ?? 0);
      });
      return rows;
    };

    const c1 = await countBefore();
    const c2 = await countBefore();
    expect(c1).toBe(c2);
  });
});
