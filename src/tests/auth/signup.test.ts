import { describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

function signupBody(overrides?: Record<string, unknown>) {
  const email = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  return {
    email,
    password: "ValidPass123!",
    ...overrides,
  };
}

describe("POST /api/auth/signup — validation", () => {
  test("signup with invalid email returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "ValidPass123!" }),
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
      body: JSON.stringify({ email: "test@example.com", password: "short" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details[0].field).toBe("password");
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
});
