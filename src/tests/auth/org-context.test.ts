import { describe, expect, test } from "bun:test";
import { getOrgContext, runWithOrgContext } from "../../lib/org-context";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../../server/middleware/error-handler";

describe("org-context lib", () => {
  test("getOrgContext inside runWithOrgContext returns the context", () => {
    runWithOrgContext({ orgId: "org-1", userId: "user-1" }, () => {
      const ctx = getOrgContext();
      expect(ctx.orgId).toBe("org-1");
      expect(ctx.userId).toBe("user-1");
    });
  });

  test("getOrgContext outside runWithOrgContext throws", () => {
    expect(() => getOrgContext()).toThrow("No org context available");
  });

  test("nested runWithOrgContext uses innermost context", () => {
    runWithOrgContext({ orgId: "outer", userId: "outer-user" }, () => {
      runWithOrgContext({ orgId: "inner", userId: "inner-user" }, () => {
        const ctx = getOrgContext();
        expect(ctx.orgId).toBe("inner");
        expect(ctx.userId).toBe("inner-user");
      });
      const ctx = getOrgContext();
      expect(ctx.orgId).toBe("outer");
    });
  });
});

describe("org-context middleware", () => {
  test("route handler can read org context when set via middleware", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/me",
      (_c, next) => {
        runWithOrgContext({ orgId: "org-456", userId: "user-123" }, next);
      },
      (c) => {
        const ctx = getOrgContext();
        return c.json({ data: { userId: ctx.userId, orgId: ctx.orgId } });
      },
    );

    const res = await app.request("/api/me");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.orgId).toBe("org-456");
    expect(json.data.userId).toBe("user-123");
  });

  test("request without context throws", async () => {
    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get("/api/me", (_c) => {
      try {
        getOrgContext();
        return new Response(null, { status: 200 });
      } catch {
        return new Response(null, { status: 500 });
      }
    });

    const res = await app.request("/api/me");
    expect(res.status).toBe(500);
  });
});
