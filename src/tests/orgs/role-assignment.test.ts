import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../lib/config";
import { createTestApp } from "../helpers/test-client";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Role assignment + invitation routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("POST /api/orgs/:orgId/members/assign-role without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/assign-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", roleId: "role-1" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/orgs/:orgId/members/invite without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "guest@example.com" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/orgs/:orgId/members/invite/bulk without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/invite/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: [{ email: "a@b.com" }] }),
    });
    expect(res.status).toBe(401);
  });
});
