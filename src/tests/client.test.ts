import { describe, expect, test } from "bun:test";
import { createTestApp } from "./helpers/test-client";

describe("test app via shared factory", () => {
  test("health endpoint returns 200", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
  });

  test("non-existent route returns 404", async () => {
    const app = createTestApp();
    const res = await app.request("/api/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
