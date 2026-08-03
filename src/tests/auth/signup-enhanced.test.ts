import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

function signupBody(overrides?: Record<string, unknown>) {
  const email = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  return {
    email,
    password: "Str0ng!P@ssword",
    fullName: "Adeola Testing",
    organizationName: "Test Org",
    industry: "fintech",
    teamSize: "10",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

describe("POST /api/auth/signup — validation (no DB)", () => {
  test("signup without ToS acceptance returns 422", async () => {
    const app = createTestApp();
    const body = signupBody({ termsAccepted: false });
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(422);
  });

  test("signup without privacy acceptance returns 422", async () => {
    const app = createTestApp();
    const body = signupBody({ privacyAccepted: false });
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(422);
  });

  test("signup with password under 12 chars returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signupBody(), password: "Short1!" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.details).toBeDefined();
    expect(json.error.details[0].field).toBe("password");
  });

  test("signup without organization name returns 422", async () => {
    const app = createTestApp();
    const body: Record<string, unknown> = signupBody();
    delete body.organizationName;
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(422);
  });

  test("signup with too-short name returns 422", async () => {
    const app = createTestApp();
    const body = signupBody({ fullName: "A" });
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(422);
  });
});

describe.skipIf(!hasDb())("POST /api/auth/signup — integration", () => {
  test("valid signup creates user + org with NGN/WAT defaults", async () => {
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
      expect(json.data.organization.name).toBe(body.organizationName);

      // Verify org has Nigerian defaults
      const orgRows = await db.execute(
        sql`SELECT currency, language, preferences FROM organizations WHERE name = ${body.organizationName}`,
      );
      const org = (orgRows as any).rows?.[0] as any;
      expect(org.currency).toBe("NGN");
      expect(org.language).toBe("en-NG");
      const prefs = org.preferences ?? {};
      expect(prefs.timezone).toBe("Africa/Lagos");
      expect(prefs.dateFormat).toBe("DD/MM/YYYY");

      // Verify user has password history recorded
      const userRows = await db.execute(
        sql`SELECT password_history FROM users WHERE email = ${body.email}`,
      );
      const user = (userRows as any).rows?.[0] as any;
      expect(user.password_history).toBeDefined();
      expect(user.password_history.length).toBeGreaterThan(0);
    });
  });

  test("signup with duplicate email returns 409", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const body = signupBody();
      await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(409);
    });
  });
});
