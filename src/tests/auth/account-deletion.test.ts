import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../lib/config";
import { createTestApp } from "../helpers/test-client";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Account deletion routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("DELETE /api/users/me without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("POST /api/users/me/reactivate without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/reactivate", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});
