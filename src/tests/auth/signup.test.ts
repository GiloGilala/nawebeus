import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { loadAbility } from "../../services/auth/ability";
import { signup } from "../../services/auth/signup";
import { verifyEmail } from "../../services/auth/verification";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

function signupBody(overrides?: Record<string, unknown>) {
  const email = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  return {
    email,
    password: "ValidPass123!",
    fullName: "Adeola Testing",
    organizationName: "Test Org",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

describe("POST /api/auth/signup — validation", () => {
  test("signup with invalid email returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signupBody(), email: "not-an-email" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toBeDefined();
    expect(json.error.details[0].field).toBe("email");
  });

  test("signup with weak password returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupBody({ password: "short" })),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.some((d: any) => d.field === "password")).toBe(true);
  });

  test("signup with missing fields returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  test("signup with invalid JSON body returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(422);
  });
});

describe.skipIf(!hasDb())("POST /api/auth/signup — integration", () => {
  test("signup with valid data returns 201 and user profile", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const body = signupBody();
      const res = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.user.email).toBe(body.email);
    });
  });

  test("signup with duplicate email returns 409", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const body = signupBody();

      const first = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(201);

      const second = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(second.status).toBe(409);
    });
  });

  test("signup assigns the owner role and the owner can invite a member (F-01)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const body = signupBody();
      const res = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      const userId = json.data.user.id as string;
      const orgId = json.data.organization.id as string;

      // The membership carries the per-org `owner` role (D13/DEC-039)
      const roleRows = await db.execute<{ id: string }>(
        sql`
          SELECT id FROM roles
          WHERE code = 'owner' AND organization_id IS NULL
            AND deleted_at IS NULL AND archived_at IS NULL
          LIMIT 1
        `,
      );
      const ownerRoleId = (roleRows as any).rows?.[0]?.id as string;
      expect(ownerRoleId).toBeDefined();

      const memberRows = await db.execute<{ role_id: string | null }>(
        sql`
          SELECT role_id FROM organization_members
          WHERE organization_id = ${orgId} AND user_id = ${userId} AND status = 'active'
        `,
      );
      expect((memberRows as any).rows?.[0]?.role_id).toBe(ownerRoleId);

      // The ability derived from that role grants members.create
      const ability = await loadAbility(db as any, userId, orgId);
      expect(ability.can("create", "members")).toBe(true);

      // Ownership grant is audited
      const auditRows = await db.execute<{ n: string }>(
        sql`
          SELECT COUNT(*)::text AS n FROM unified_audit_log
          WHERE action = 'organization.owner.created' AND organization_id = ${orgId}
        `,
      );
      expect((auditRows as any).rows?.[0]?.n).toBe("1");

      // The owner must verify before acting on the org (NWB-P1-004's gate); the route never
      // exposes the token, so redeem the one the token table holds through the real path.
      const tokenRows = await db.execute<{ selector: string }>(
        sql`SELECT selector FROM tokens WHERE user_id = ${userId} AND purpose = 'email_verification' AND status = 'active'`,
      );
      await verifyEmail(db, (tokenRows as any).rows[0].selector as string);

      // End-to-end: sign in as the new owner and invite a member —
      // this returned 403 before the F-01 fix (owner had no permissions).
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email, password: body.password }),
      });
      expect(signin.status).toBe(200);
      const cookies = (signin.headers.getSetCookie?.() ?? [])
        .map((c) => c.split(";")[0])
        .join("; ");
      expect(cookies).toContain("nawebeus_access=");

      const invite = await app.request(`/api/orgs/${orgId}/members/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookies },
        body: JSON.stringify({
          email: `invitee-${crypto.randomUUID().slice(0, 8)}@example.com`,
        }),
      });
      expect(invite.status).toBe(200);
    });
  });

  test("signup rolls back atomically when a mid-transaction write fails (FR-ORG-001 AC7)", async () => {
    await withTestDb(async ({ db }) => {
      const body = signupBody();
      // Force a failure on the membership insert — the fifth write inside
      // the signup atomic block, after the user and organization inserts.
      await db.execute(
        sql`
          CREATE FUNCTION _test_fail_membership_insert() RETURNS trigger AS $fn$
            BEGIN RAISE EXCEPTION 'forced failure: signup atomicity test'; END;
          $fn$ LANGUAGE plpgsql
        `,
      );
      await db.execute(
        sql`
          CREATE TRIGGER _test_fail_membership_insert
          BEFORE INSERT ON organization_members
          FOR EACH ROW EXECUTE FUNCTION _test_fail_membership_insert()
        `,
      );
      try {
        await expect(signup(db, body as any)).rejects.toThrow(
          "forced failure: signup atomicity test",
        );

        // The earlier writes in the same atomic block (user, organization,
        // token) must have rolled back with the failed membership insert.
        const users = await db.execute<{ n: string }>(
          sql`SELECT COUNT(*)::text AS n FROM users WHERE email = ${body.email}`,
        );
        expect((users as any).rows?.[0]?.n).toBe("0");
        const orgs = await db.execute<{ n: string }>(
          sql`
            SELECT COUNT(*)::text AS n FROM organizations o
            JOIN users u ON u.id = o.created_by
            WHERE u.email = ${body.email}
          `,
        );
        expect((orgs as any).rows?.[0]?.n).toBe("0");
        const tokens = await db.execute<{ n: string }>(
          sql`
            SELECT COUNT(*)::text AS n FROM tokens t
            JOIN users u ON u.id = t.user_id
            WHERE u.email = ${body.email}
          `,
        );
        expect((tokens as any).rows?.[0]?.n).toBe("0");
        const members = await db.execute<{ n: string }>(
          sql`
            SELECT COUNT(*)::text AS n FROM organization_members m
            JOIN users u ON u.id = m.user_id
            WHERE u.email = ${body.email}
          `,
        );
        expect((members as any).rows?.[0]?.n).toBe("0");
      } finally {
        await db.execute(
          sql`DROP TRIGGER IF EXISTS _test_fail_membership_insert ON organization_members`,
        );
        await db.execute(sql`DROP FUNCTION IF EXISTS _test_fail_membership_insert()`);
      }
    });
  });

  test("signup fails closed when the owner role is missing from the catalog", async () => {
    await withTestDb(async ({ db }) => {
      const body = signupBody();
      // Simulate an unseeded role catalog for this transaction (the harness
      // rolls it back).
      await db.execute(
        sql`UPDATE roles SET deleted_at = now()
            WHERE code = 'owner' AND organization_id IS NULL`,
      );
      await expect(signup(db, body as any)).rejects.toThrow(/owner. role is missing/);
      const users = await db.execute<{ n: string }>(
        sql`SELECT COUNT(*)::text AS n FROM users WHERE email = ${body.email}`,
      );
      expect((users as any).rows?.[0]?.n).toBe("0");
    });
  });
});
