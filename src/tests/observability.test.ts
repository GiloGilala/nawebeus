/**
 * NWB-P1-012 — observability baseline: request context, access log, error
 * tracking, readiness probe.
 *
 * The exit-gate clause this file exists to prove: *a request can be traced by
 * correlation id from log to audit row.* The non-DB half pins the mechanics
 * (id assignment, log fields, route templates, error lines, probe states); the
 * `DATABASE_URL`-gated half closes the loop through a real sign-in, a real
 * org-scoped action, and the audit query API.
 */
import { afterEach, beforeEach, describe, expect, type Mock, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";
import { type LogFields, logger } from "@/lib/logger";
import { runWithRequestId } from "@/lib/request-context";
import { createAppWithDb } from "@/server";
import { collectHealth } from "@/server/health";
import { MAX_REQUEST_ID_LENGTH, resolveRequestId } from "@/server/middleware/request-context";
import { writeAuditLog } from "@/services/audit";
import { createNoopDb, createTestApp } from "./helpers/test-client";
import { withTestDb } from "./helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "./helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

let infoSpy: Mock<(...args: any[]) => any>;
let errorSpy: Mock<(...args: any[]) => any>;
let warnSpy: Mock<(...args: any[]) => any>;

beforeEach(() => {
  infoSpy = spyOn(logger, "info");
  errorSpy = spyOn(logger, "error");
  warnSpy = spyOn(logger, "warn");
});

afterEach(() => {
  infoSpy.mockRestore();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

/** The `logger.info("request", …)` line for the request under test, if any. */
function lastAccessLog(): LogFields | undefined {
  const call = infoSpy.mock.calls.find((c) => c[0] === "request");
  return call ? (call[1] as LogFields) : undefined;
}

async function auditRequestIds(
  db: Db,
  action: string,
  actorId: string,
): Promise<(string | null)[]> {
  const rows = await db.execute<{ request_id: string | null }>(
    sql`SELECT request_id FROM unified_audit_log
        WHERE action = ${action} AND actor_id = ${actorId}`,
  );
  return ((rows as { rows?: { request_id: string | null }[] }).rows ?? []).map((r) => r.request_id);
}

describe("request id assignment", () => {
  test("generates req_<uuid> when no header is sent, and echoes it", async () => {
    const app = createTestApp();
    const res = await app.request("/api/nonexistent");
    const echoed = res.headers.get("x-request-id");
    expect(echoed).toMatch(/^req_[0-9a-f-]{36}$/);
    expect(lastAccessLog()?.requestId).toBe(echoed);
  });

  test("honors a sane inbound x-request-id and echoes it back", async () => {
    const app = createTestApp();
    const res = await app.request("/api/nonexistent", {
      headers: { "x-request-id": "client-abc-123" },
    });
    expect(res.headers.get("x-request-id")).toBe("client-abc-123");
    expect(lastAccessLog()?.requestId).toBe("client-abc-123");
  });

  test("replaces an oversized inbound id (the audit column is varchar(100))", async () => {
    const oversized = "x".repeat(MAX_REQUEST_ID_LENGTH + 1);
    const res = await createTestApp().request("/api/nonexistent", {
      headers: { "x-request-id": oversized },
    });
    const echoed = res.headers.get("x-request-id");
    expect(echoed).not.toBe(oversized);
    expect(echoed).toMatch(/^req_/);
    expect((echoed ?? "").length).toBeLessThanOrEqual(MAX_REQUEST_ID_LENGTH);
  });

  test("resolveRequestId: empty → generated, exactly 100 chars → honored", () => {
    expect(resolveRequestId(undefined)).toMatch(/^req_/);
    expect(resolveRequestId("")).toMatch(/^req_/);
    const exact = "y".repeat(MAX_REQUEST_ID_LENGTH);
    expect(resolveRequestId(exact)).toBe(exact);
  });
});

describe("access log", () => {
  test("one line per request with method, route, status, durationMs", async () => {
    const app = createTestApp();
    const res = await app.request("/api/nonexistent");
    expect(res.status).toBe(404);

    const line = lastAccessLog();
    expect(line).toBeDefined();
    expect(line?.method).toBe("GET");
    expect(line?.status).toBe(404);
    expect(line?.route).toBe("/api/nonexistent"); // 404: no template, raw path
    expect(typeof line?.durationMs).toBe("number");
    expect(line?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("logs the route template, never a raw path that could carry a token", async () => {
    const app = createTestApp();
    const token = "tok_" + "a".repeat(40);
    // Unauthenticated: 401 from authMiddleware before anything touches the DB.
    const res = await app.request(`/api/audit/${token}`);
    expect(res.status).toBe(401);

    const line = lastAccessLog();
    expect(line?.route).toContain(":id");
    expect(line?.route).not.toContain(token);
    expect(JSON.stringify(line)).not.toContain(token);
  });

  test("health probes are not access-logged", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(lastAccessLog()).toBeUndefined();
  });

  test("a failed request still gets its access line, with the real status", async () => {
    const app = createTestApp();
    app.get("/api/boom", () => {
      throw new Error("boom");
    });
    const res = await app.request("/api/boom");
    expect(res.status).toBe(500);
    expect(lastAccessLog()?.status).toBe(500);
  });

  test("an AppError surfaces its own status on the access line, without an error line", async () => {
    const app = createTestApp();
    app.get("/api/conflict", () => {
      throw new ConflictError("Already there");
    });
    const res = await app.request("/api/conflict");
    expect(res.status).toBe(409);
    expect(lastAccessLog()?.status).toBe(409);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("error tracking", () => {
  beforeEach(() => {
    delete process.env.NWB_DEBUG_ERRORS;
  });
  afterEach(() => {
    delete process.env.NWB_DEBUG_ERRORS;
  });

  test("a 500 logs one structured error line with the request id and real cause", async () => {
    const app = createTestApp();
    app.get("/api/boom", () => {
      throw new Error("boom behind the curtain");
    });
    const res = await app.request("/api/boom");
    expect(res.status).toBe(500);

    // The client stays opaque:
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("boom");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message, fields] = errorSpy.mock.calls[0] as [string, LogFields];
    expect(message).toBe("request error");
    expect(fields.status).toBe(500);
    expect(String(fields.error)).toContain("boom behind the curtain");
    expect(fields.requestId).toBe(res.headers.get("x-request-id"));
    expect(fields.stack).toBeUndefined();
  });

  test("NWB_DEBUG_ERRORS adds the stack", async () => {
    process.env.NWB_DEBUG_ERRORS = "1";
    const app = createTestApp();
    app.get("/api/boom", () => {
      throw new Error("boom");
    });
    await app.request("/api/boom");
    const [, fields] = errorSpy.mock.calls[0] as [string, LogFields];
    expect(String(fields.stack)).toContain("Error: boom");
  });

  test("a 4xx AppError is not error-logged by default (the access line covers it)", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x" }),
    });
    expect(res.status).toBe(422);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(lastAccessLog()?.status).toBe(422);
  });

  test("with NWB_DEBUG_ERRORS, 4xx errors are logged at warn with the code", async () => {
    process.env.NWB_DEBUG_ERRORS = "1";
    const app = createTestApp();
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x" }),
    });
    expect(res.status).toBe(422);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, fields] = warnSpy.mock.calls[0] as [string, LogFields];
    expect(fields.code).toBe("VALIDATION_ERROR");
    expect(fields.status).toBe(422);
    expect(fields.requestId).toBe(res.headers.get("x-request-id"));
  });
});

describe("readiness probe states", () => {
  const queueOk = async () => ({ ready: 2, active: 1, failed: 0 });

  test("no injected database reports not-configured, not a fake ping", async () => {
    const report = await collectHealth({ db: undefined, queueDepth: queueOk });
    expect(report.checks.database.status).toBe("not-configured");
    expect(report.status).toBe("ok");
  });

  test("a successful ping reports ok with latency and queue depth", async () => {
    const report = await collectHealth({ db: createNoopDb(), queueDepth: queueOk });
    expect(report.checks.database).toMatchObject({ status: "ok" });
    expect(typeof report.checks.database.latencyMs).toBe("number");
    expect(report.checks.queue).toMatchObject({
      status: "ok",
      depth: { ready: 2, active: 1, failed: 0 },
    });
    expect(report.status).toBe("ok");
  });

  test("a failing ping is status error (the probe's hard dependency)", async () => {
    const failing = {
      execute: () => Promise.reject(new Error("ECONNREFUSED")),
    } as unknown as Db;
    const report = await collectHealth({ db: failing, queueDepth: queueOk });
    expect(report.status).toBe("error");
    expect(report.checks.database.status).toBe("error");
    expect(String(report.checks.database.error)).toContain("ECONNREFUSED");
  });

  test("no queue runtime is disabled — legal per ADR-007, not a fault", async () => {
    const report = await collectHealth({ db: createNoopDb(), queueDepth: async () => undefined });
    expect(report.checks.queue.status).toBe("disabled");
    expect(report.status).toBe("ok");
  });

  test("a started-but-failing queue degrades, but the probe still passes", async () => {
    const report = await collectHealth({
      db: createNoopDb(),
      queueDepth: async () => {
        throw new Error("pgboss schema dropped");
      },
    });
    expect(report.status).toBe("degraded");
    expect(report.checks.queue.status).toBe("error");
  });

  test("HTTP shape: 200 with both checks on the default test app", async () => {
    const res = await createTestApp().request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.checks.database.status).toBe("ok");
    expect(["ok", "disabled"]).toContain(body.data.checks.queue.status);
  });

  test("HTTP shape: 503 when the database is unreachable", async () => {
    const failing = {
      execute: () => Promise.reject(new Error("connection refused")),
    } as unknown as Db;
    const app = createAppWithDb({ db: failing });
    const out = await app.request("/api/health");
    expect(out.status).toBe(503);
    const body = await out.json();
    expect(body.data.status).toBe("error");
    expect(body.data.checks.database.status).toBe("error");
  });
});

describe.skipIf(!hasDb())("correlation end-to-end (log → audit row)", () => {
  test("a sign-in under x-request-id lands the id on its audit row and in the access log", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: user.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: user.id,
        roleCode: "owner",
      });

      const app = createTestApp(db);
      const requestId = "e2e-trace-signin-001";
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-request-id": requestId },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      expect(signin.status).toBe(200);
      expect(signin.headers.get("x-request-id")).toBe(requestId);

      // The access log line exists with the same id…
      const line = lastAccessLog();
      expect(line?.requestId).toBe(requestId);
      expect(line?.route).toContain("/auth/signin");

      // …and the audit row written by that request carries it:
      const found = await auditRequestIds(db, "auth.signin.completed", user.id);
      expect(found).toContain(requestId);
    });
  });

  test("an org-scoped action's row is findable through GET /api/audit?requestId=", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: user.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: user.id,
        roleCode: "owner",
      });

      const app = createTestApp(db);
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      expect(signin.status).toBe(200);
      const cookie = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join(";");

      // Second request, its own id, an org-scoped audit action (apikeys.created
      // carries organization_id, so the owner's org-scoped list admits it —
      // signin's row is orgless, platform-admin-only through the API).
      const requestId = "e2e-trace-apikey-001";
      const created = await app.request("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie, "x-request-id": requestId },
        body: JSON.stringify({ name: "trace-key" }),
      });
      expect(created.status).toBeLessThan(300);

      const list = await app.request(`/api/audit?requestId=${requestId}`, { headers: { cookie } });
      expect(list.status).toBe(200);
      const body = await list.json();
      const events = body.data.events as { action: string; requestId: string | null }[];
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.requestId).toBe(requestId);
      expect(events.some((e) => e.action === "apikeys.created")).toBe(true);
    });
  });

  test("an authenticated request logs orgId and userId", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: user.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: user.id,
        roleCode: "owner",
      });
      const app = createTestApp(db);
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      expect(signin.status).toBe(200);
      const cookie = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join(";");

      infoSpy.mockClear();
      const me = await app.request("/api/users/me", { headers: { cookie } });
      expect(me.status).toBe(200);
      const line = lastAccessLog();
      expect(line?.userId).toBe(user.id);
      expect(line?.orgId).toBe(org.id);
      expect(line?.authMethod).toBe("session");
    });
  });

  test("writeAuditLog defaults request_id from the request scope; explicit wins; outside → null", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);

      await runWithRequestId("als-default-id", async () => {
        await writeAuditLog({
          db,
          module: "core",
          actorId: user.id,
          actorType: "user",
          action: "auth.signin.completed",
          resourceId: user.id,
        });
      });

      await runWithRequestId("als-request-scoped", async () => {
        await writeAuditLog({
          db,
          module: "core",
          actorId: user.id,
          actorType: "user",
          action: "auth.signin.completed",
          resourceId: user.id,
          requestId: "explicit-wins",
        });
      });

      await writeAuditLog({
        db,
        module: "core",
        actorId: user.id,
        actorType: "user",
        action: "auth.signin.completed",
        resourceId: user.id,
      });

      const ids = await auditRequestIds(db, "auth.signin.completed", user.id);
      expect(ids).toContain("als-default-id");
      expect(ids).toContain("explicit-wins");
      expect(ids).toContain(null);
      expect(ids).not.toContain("als-request-scoped");
    });
  });
});
