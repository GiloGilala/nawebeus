import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestApp } from "../helpers/test-client";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Admin user routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) delete process.env[k];
  });

  test("GET /api/users without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users");
    expect(res.status).toBe(401);
  });

  test("GET /api/users/:userId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/user-123");
    expect(res.status).toBe(401);
  });

  test("PATCH /api/users/:userId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/user-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "New" }),
    });
    expect(res.status).toBe(401);
  });
});
