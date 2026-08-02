import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestApp } from "../helpers/test-client";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Member routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) delete process.env[k];
  });

  test("GET /api/orgs/:orgId/members without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123/members");
    expect(res.status).toBe(401);
  });

  test("GET /api/orgs/:orgId/members/:memberId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123/members/member-456");
    expect(res.status).toBe(401);
  });

  test("PATCH /api/orgs/:orgId/members/:memberId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123/members/member-456", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(401);
  });
});
