import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../lib/config";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

function setupTestEnv() {
  for (const [k, v] of Object.entries(testEnv)) {
    process.env[k] ??= v;
  }
  loadConfig();
}

describe("POST /api/auth/signin — validation", () => {
  beforeAll(() => setupTestEnv());
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });
  test("signin with missing email returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "anything" }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("signin with missing password returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(res.status).toBe(422);
  });

  test("signin with invalid JSON body returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(422);
  });
});

describe("auth middleware — validation", () => {
  beforeAll(() => setupTestEnv());
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });
  test("request without access token returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("AUTH_ERROR");
  });

  test("request with invalid access token returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me", {
      headers: { Cookie: "nawebeus_access=invalid.jwt.token" },
    });
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!hasDb())("POST /api/auth/signin — integration", () => {
  test("signin with valid credentials returns 200 + cookies", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const res = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@nawebeus.com",
          password: "Admin@123456",
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.user.id).toBeDefined();
      expect(json.data.user.orgId).toBeDefined();

      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("nawebeus_access");
      expect(setCookie).toContain("nawebeus_refresh");
    });
  });

  test("signin with invalid password returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const res = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@nawebeus.com",
          password: "wrongpassword",
        }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("AUTH_ERROR");
    });
  });
});
