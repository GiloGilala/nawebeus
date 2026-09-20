import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { signup } from "../../services/auth/signup";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Org routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("GET /api/orgs without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs");
    expect(res.status).toBe(401);
  });

  test("GET /api/orgs/:orgId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123");
    expect(res.status).toBe(401);
  });

  test("PATCH /api/orgs/:orgId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!hasDb())("Org routes — integration (F-02)", () => {
  const PASSWORD = "ValidPass123!";

  // Both tests build the same fixture inline: two users via signup (each
  // owns its own org), then the second is re-homed into the first's org
  // with the role under test — the single-org JWT model
  // (users.organization_id) is what requireOrgMatch and the ability check
  // both key on.

  test("PATCH /api/orgs/:orgId succeeds for a member holding org.update (F-02 positive)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const uid = crypto.randomUUID().slice(0, 8);
      const owner = await signup(db, {
        email: `own-${uid}@example.com`,
        password: PASSWORD,
        fullName: "Owner One",
        organizationName: `Fixture Org ${uid}`,
        termsAccepted: true,
        privacyAccepted: true,
      } as any);
      const orgId = owner.organization.id;
      const member = await signup(db, {
        email: `mem-${uid}@example.com`,
        password: PASSWORD,
        fullName: "Admin Two",
        organizationName: `Other Org ${uid}`,
        termsAccepted: true,
        privacyAccepted: true,
      } as any);

      // Re-home the member into the owner's org with the admin role
      // (carries org.update per the DEC-039 matrix; NWB-P0-014).
      const roleRows = await db.execute<{ id: string }>(
        sql`
          SELECT id FROM roles
          WHERE code = 'admin' AND organization_id IS NULL
            AND deleted_at IS NULL AND archived_at IS NULL
          LIMIT 1
        `,
      );
      const roleId = (roleRows as any).rows?.[0]?.id as string;
      expect(roleId).toBeDefined();
      await db.execute(
        sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${member.user.id}`,
      );
      await db.execute(
        sql`
          INSERT INTO organization_members (organization_id, user_id, role_id, status, is_active)
          VALUES (${orgId}, ${member.user.id}, ${roleId}, 'active', true)
        `,
      );

      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.user.email, password: PASSWORD }),
      });
      expect(signin.status).toBe(200);
      const cookies = (signin.headers.getSetCookie?.() ?? [])
        .map((c) => c.split(";")[0])
        .join("; ");

      const patch = await app.request(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: cookies },
        body: JSON.stringify({ name: "Renamed by admin" }),
      });
      // F-02: this returned 403 for every user before the subject fix
      expect(patch.status).toBe(200);
      const json = await patch.json();
      expect(json.data.org.name).toBe("Renamed by admin");
    });
  });

  test("PATCH /api/orgs/:orgId is denied for a member without org.update (F-02 negative)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const uid = crypto.randomUUID().slice(0, 8);
      const owner = await signup(db, {
        email: `own-${uid}@example.com`,
        password: PASSWORD,
        fullName: "Owner One",
        organizationName: `Fixture Org ${uid}`,
        termsAccepted: true,
        privacyAccepted: true,
      } as any);
      const orgId = owner.organization.id;
      const member = await signup(db, {
        email: `mem-${uid}@example.com`,
        password: PASSWORD,
        fullName: "Viewer Two",
        organizationName: `Other Org ${uid}`,
        termsAccepted: true,
        privacyAccepted: true,
      } as any);

      // viewer holds org.read but not org.update
      const roleRows = await db.execute<{ id: string }>(
        sql`
          SELECT id FROM roles
          WHERE code = 'viewer' AND organization_id IS NULL
            AND deleted_at IS NULL AND archived_at IS NULL
          LIMIT 1
        `,
      );
      const roleId = (roleRows as any).rows?.[0]?.id as string;
      expect(roleId).toBeDefined();
      await db.execute(
        sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${member.user.id}`,
      );
      await db.execute(
        sql`
          INSERT INTO organization_members (organization_id, user_id, role_id, status, is_active)
          VALUES (${orgId}, ${member.user.id}, ${roleId}, 'active', true)
        `,
      );

      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.user.email, password: PASSWORD }),
      });
      expect(signin.status).toBe(200);
      const cookies = (signin.headers.getSetCookie?.() ?? [])
        .map((c) => c.split(";")[0])
        .join("; ");

      const patch = await app.request(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: cookies },
        body: JSON.stringify({ name: "Should not work" }),
      });
      expect(patch.status).toBe(403);
      const json = await patch.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });
});
