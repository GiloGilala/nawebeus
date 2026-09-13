import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "../../lib/config";
import type { AppAbility } from "../../server/middleware/auth";
import { errorHandler } from "../../server/middleware/error-handler";
import { requireAbility } from "../../server/middleware/rbac";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("requireAbility — no DB needed", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("missing ability on context returns 403", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get("/api/admin", requireAbility("manage", "users"), (c) => c.json({ ok: true }));

    const res = await app.request("/api/admin");
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  test("user with permission gets 200", async () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("read", "posts");

    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/posts",
      (c, next) => {
        c.set("ability", build());
        return next();
      },
      requireAbility("read", "posts"),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test("user without permission returns 403", async () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("read", "posts");

    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/admin",
      (c, next) => {
        c.set("ability", build());
        return next();
      },
      requireAbility("manage", "users"),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/admin");
    expect(res.status).toBe(403);
  });
});

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("RBAC integration", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("authMiddleware loads ability for valid user", async () => {
    await withTestDb(async ({ db }) => {
      const { authMiddleware } = await import("../../server/middleware/auth");
      const { requireAbility } = await import("../../server/middleware/rbac");

      const app = createTestApp(db);
      app.get("/api/protected", authMiddleware, requireAbility("read", "users"), (c) =>
        c.json({ data: { ok: true } }),
      );

      const signinRes = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@nawebeus.com",
          password: "Admin@123456",
        }),
      });

      const cookie = signinRes.headers.get("set-cookie") ?? "";

      const res = await app.request("/api/protected", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
    });
  });

  test("user without permission gets 403", async () => {
    await withTestDb(async ({ db }) => {
      const { authMiddleware } = await import("../../server/middleware/auth");
      const { requireAbility } = await import("../../server/middleware/rbac");

      const app = createTestApp(db);
      app.get("/api/secret", authMiddleware, requireAbility("delete", "nonexistent"), (c) =>
        c.json({ ok: true }),
      );

      const signinRes = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@nawebeus.com",
          password: "Admin@123456",
        }),
      });

      const cookie = signinRes.headers.get("set-cookie") ?? "";

      const res = await app.request("/api/secret", {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(403);
    });
  });
});
