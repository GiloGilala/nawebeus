import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../../server/middleware/error-handler";
import { requireOrgMatch } from "../../server/middleware/org-match";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("requireOrgMatch — no DB needed", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) delete process.env[k];
  });

  test("matching orgIds pass", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/orgs/:orgId",
      (c, next) => {
        c.set("user", { userId: "user-1", orgId: "org_A" });
        return next();
      },
      requireOrgMatch(),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/orgs/org_A");
    expect(res.status).toBe(200);
  });

  test("mismatched orgIds return 403", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/orgs/:orgId",
      (c, next) => {
        c.set("user", { userId: "user-1", orgId: "org_A" });
        return next();
      },
      requireOrgMatch(),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/orgs/org_B");
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  test("missing URL orgId passes (no param to compare)", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/orgs",
      (c, next) => {
        c.set("user", { userId: "user-1", orgId: "org_A" });
        return next();
      },
      requireOrgMatch(),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/orgs");
    expect(res.status).toBe(200);
  });
});
