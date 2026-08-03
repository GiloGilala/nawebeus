import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { loadConfig } from "../../lib/config";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Email change routes — no DB (validation + auth)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) delete process.env[k];
  });

  test("POST /api/users/me/email-change without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/users/me/email-change/confirm with missing token returns 422", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/email-change/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
