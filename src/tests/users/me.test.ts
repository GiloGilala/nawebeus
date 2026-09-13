import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("GET /api/users/me", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/users/me", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "New" }),
    });
    expect(res.status).toBe(401);
  });
});
