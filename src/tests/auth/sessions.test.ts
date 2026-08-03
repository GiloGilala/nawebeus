import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { loadConfig } from "../../lib/config";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Session management routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) delete process.env[k];
  });

  test("GET /api/auth/sessions without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/sessions");
    expect(res.status).toBe(401);
  });

  test("DELETE /api/auth/sessions/:id without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/sessions/abc", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("DELETE /api/auth/sessions/revoke-others without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/sessions/revoke-others", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
