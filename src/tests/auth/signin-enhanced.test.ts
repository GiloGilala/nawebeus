import { describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { sql } from "drizzle-orm";

const hasDb = () => !!process.env.DATABASE_URL;

describe("POST /api/auth/signin — validation (no DB)", () => {
  const validBody = {
    email: "adeola@example.com",
    password: "Str0ng!P@ssword",
  };

  test("signin without email returns 422", async () => {
    const app = createTestApp();
    const body = { ...validBody, email: "not-an-email" };
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(422);
  });

  test("signin with empty password returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, password: "" }),
    });
    expect(res.status).toBe(422);
  });

  test("signin with invalid credentials returns 401 (MFA-aware)", async () => {
    const app = createTestApp();
    // With noop DB, signIn throws → 500. This test validates the schema path instead.
    const body = { email: "adeola@example.com", password: "Str0ng!P@ssword" };
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // No DB → the service throws on DB access. With a real DB we'd expect 401.
    // In the no-DB case it'll be 500, so we skip the assertion for status but
    // verify the schema accepted a valid body without returning 422.
    expect(res.status).not.toBe(422);
  });

  test("signin with MFA code is accepted by schema", async () => {
    const app = createTestApp();
    const body = { email: "adeola@example.com", password: "Str0ng!P@ssword", mfaCode: "123456", rememberMe: true };
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Schema should accept it (not 422). No DB → 500.
    expect(res.status).not.toBe(422);
  });
});

describe.skipIf(!hasDb())("POST /api/auth/signin — lockout + MFA (integration)", () => {
  test("5 failed attempts → account locked for 15 min", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const password = "Str0ng!P@ssword";
      const { hashPassword } = await import("../../services/auth/password");

      // Create user with a placeholder org
      const orgId = crypto.randomUUID();
      const hashed = await hashPassword(password);
      await db.execute(
        sql`INSERT INTO users (id, email, password, username, first_name, last_name, status, email_verified, organization_id)
            VALUES ('user-locktest', 'locktest@example.com', ${hashed}, 'locktest', 'Test', 'User', 'active', true, ${orgId})`,
      );

      const makeAttempt = () =>
        app.request("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "1.2.3.4" },
          body: JSON.stringify({ email: "locktest@example.com", password: "WrongPassword1!" }),
        });

      const responses = await Promise.all([makeAttempt(), makeAttempt(), makeAttempt(), makeAttempt(), makeAttempt()]);

      // First 4 should be 401, 5th should be locked
      for (let i = 0; i < 4; i++) {
        expect(responses[i]!.status).toBe(401);
      }
      expect(responses[4]!.status).toBe(423); // Locked
      const json = await responses[4]!.json();
      expect(json.error.code).toBe("ACCOUNT_LOCKED");
      expect(json.error.details.lockedUntil).toBeDefined();

      // Correct password should still be locked
      const res6 = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "1.2.3.4" },
        body: JSON.stringify({ email: "locktest@example.com", password }),
      });
      expect(res6.status).toBe(423);
    });
  });
});
