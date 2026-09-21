/**
 * `GET /api/audit` — the HTTP surface (NWB-P1-002).
 *
 * Split into two describes the way the repo does it: the unauthenticated shape must answer *without a
 * database* (`createTestApp()`'s no-op handle), because auth and validation run before any query and a
 * CI job with no `DATABASE_URL` still has to know those work. Everything that reads rows is DB-gated.
 *
 * The paging test here is the point of the file: it drives `?limit=1` through the real
 * `parsePagination` → `decodeCursor` path. `decodeCursor` requires a uuid tiebreaker by default and
 * audit ids are prefixed varchar, so a route that forgot to widen the shape returns page one
 * perfectly and 422s forever after — invisible to any test that reads one page.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { writeAuditLog } from "../../services/audit";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

// `beforeAll` + `??=` is the repo's no-DB pattern, but the restore has to remember what it actually
// changed rather than delete "whatever equals my placeholder": a real `.env` may legitimately carry that
// same value, and deleting it there poisoned every later file in the same `bun test` process (six
// suites' `loadConfig()` calls started throwing for no visible reason). Restoring by saved value is
// correct whichever way the coincidence falls.
const savedEnv: Record<string, string | undefined> = {};

async function cookieFor(app: ReturnType<typeof createTestApp>, email: string) {
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`signin failed: ${res.status} ${await res.text()}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

describe("audit routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) {
      savedEnv[k] = process.env[k];
      process.env[k] ??= v;
    }
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  test("GET /api/audit without a session is 401, not a driver error", async () => {
    const res = await createTestApp().request("/api/audit");
    expect(res.status).toBe(401);
  });

  test("GET /api/audit/:id without a session is 401", async () => {
    const res = await createTestApp().request("/api/audit/al_whatever000000000000");
    expect(res.status).toBe(401);
  });

  test("the route is mounted in the test app builder too", async () => {
    // `createApp` and `createAppWithDb` share one mount list since this ticket; if that ever splits,
    // this fails loudly instead of an endpoint shipping that no test can reach.
    const res = await createTestApp().request("/api/audit?limit=abc");
    expect(res.status).not.toBe(404);
  });
});

describe.skipIf(!hasDb())("audit routes — with DB", () => {
  test("an organization admin reads their own log, newest first, with pagination meta", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const cookie = await cookieFor(app, owner.email);

      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "auth.signin.completed",
        resourceId: owner.id,
      });
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "apikeys.created",
        resourceId: "key-1",
      });

      const res = await app.request("/api/audit", { headers: { cookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { events: { action: string; category: string }[] };
        meta: { pagination: { cursor: string | null; hasMore: boolean } };
      };
      expect(body.data.events.length).toBeGreaterThanOrEqual(2);
      expect(new Set(body.data.events.map((e) => e.action))).toEqual(
        new Set(["auth.signin.completed", "apikeys.created"]),
      );
      // The signin event was written by the route's own audit path inside `signin`, so the log the
      // admin reads includes the act of reading surface's own authentication. `category` proves the
      // registry default reached the row through the service, not a literal in the test.
      expect(body.data.events.find((e) => e.action === "apikeys.created")?.category).toBe(
        "security",
      );
      expect(body.meta.pagination.hasMore).toBe(false);
      expect(body.meta.pagination.cursor).toBeNull();
    });
  });

  test("a second page is reachable, which is what the cursor id shape decides", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const cookie = await cookieFor(app, owner.email);

      for (const action of ["apikeys.created", "apikeys.rotated", "apikeys.revoked"] as const) {
        await writeAuditLog({
          db,
          module: "core",
          organizationId: org.id,
          actorId: owner.id,
          actorType: "user",
          action,
          resourceId: `key-${action}`,
        });
      }

      const first = await app.request("/api/audit?limit=2", { headers: { cookie } });
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as {
        data: { events: { id: string }[] };
        meta: { pagination: { cursor: string | null; hasMore: boolean } };
      };
      expect(firstBody.data.events).toHaveLength(2);
      expect(firstBody.meta.pagination.hasMore).toBe(true);
      const cursor = firstBody.meta.pagination.cursor;
      expect(typeof cursor).toBe("string");

      const second = await app.request(`/api/audit?limit=2&cursor=${cursor}`, {
        headers: { cookie },
      });
      // The assertion this test exists for: a 422 here means the cursor was rejected, not exhausted.
      expect(second.status).toBe(200);
      const secondBody = (await second.json()) as {
        data: { events: { id: string }[] };
        meta: { pagination: { hasMore: boolean } };
      };
      expect(secondBody.data.events.length).toBeGreaterThanOrEqual(1);
      const overlap = secondBody.data.events.filter((e) =>
        firstBody.data.events.some((f) => f.id === e.id),
      );
      expect(overlap).toHaveLength(0);
    });
  });

  test("filters reach the query, and a bad value is 422 with the legal set named", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const cookie = await cookieFor(app, owner.email);
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "apikeys.revoked",
        resourceId: "key-1",
        severity: "critical",
      });

      const filtered = await app.request(`/api/audit?actorId=${owner.id}&severity=critical`, {
        headers: { cookie },
      });
      expect(filtered.status).toBe(200);
      const filteredBody = (await filtered.json()) as { data: { events: { action: string }[] } };
      expect(filteredBody.data.events.map((e) => e.action)).toContain("apikeys.revoked");

      const noneForOtherActor = await app.request(`/api/audit?actorId=${crypto.randomUUID()}`, {
        headers: { cookie },
      });
      const noneBody = (await noneForOtherActor.json()) as { data: { events: unknown[] } };
      expect(noneBody.data.events).toEqual([]);

      const byActorType = await app.request("/api/audit?actorType=user", { headers: { cookie } });
      expect(byActorType.status).toBe(200);
      const byTypeBody = (await byActorType.json()) as { data: { events: { action: string }[] } };
      expect(byTypeBody.data.events.map((e) => e.action)).toContain("apikeys.revoked");

      const wrongActorType = await app.request("/api/audit?actorType=api_key", {
        headers: { cookie },
      });
      const wrongTypeBody = (await wrongActorType.json()) as { data: { events: unknown[] } };
      expect(wrongTypeBody.data.events).toEqual([]);

      const badModule = await app.request("/api/audit?module=nonsense", { headers: { cookie } });
      expect(badModule.status).toBe(422);
      const text = await badModule.text();
      expect(text).toContain("Invalid audit query");
      expect(text).toContain("social_accounts"); // the enum's own values, from the schema

      const badActor = await app.request("/api/audit?actorId=1", { headers: { cookie } });
      expect(badActor.status).toBe(422);

      const badLimit = await app.request("/api/audit?limit=1000", { headers: { cookie } });
      expect(badLimit.status).toBe(422);
    });
  });

  test("a role without audit.read is refused, and a foreign organization is not readable", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });

      const viewer = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: viewer.id,
        roleCode: "viewer",
      });

      const allowed = await cookieFor(app, owner.email);
      const refused = await cookieFor(app, viewer.email);
      expect((await app.request("/api/audit", { headers: { cookie: allowed } })).status).toBe(200);
      // `viewer` is the correct negative here: its role has every `everyone` permission but not
      // `audit.read`, so a 403 proves the ability check rather than "not a member at all".
      const denied = await app.request("/api/audit", { headers: { cookie: refused } });
      expect(denied.status).toBe(403);
      expect(await denied.text()).toContain("Missing permission: read audit");

      // Another organization's id, guessed exactly: 404, never 403 — see `getAuditEvent`.
      const other = await createTestUser(db);
      const otherOrg = await createTestOrg(db, { ownerId: other.id });
      await addMemberWithRole(db, {
        organizationId: otherOrg.id,
        userId: other.id,
        roleCode: "owner",
      });
      await writeAuditLog({
        db,
        module: "core",
        organizationId: otherOrg.id,
        actorId: other.id,
        actorType: "user",
        action: "account.deleted",
        resourceId: other.id,
      });
      const foreign = await db
        .execute(
          `SELECT id FROM unified_audit_log WHERE organization_id = '${otherOrg.id}' LIMIT 1`,
        )
        .then((r: any) => r.rows?.[0]?.id as string);

      const res = await app.request(`/api/audit/${foreign}`, { headers: { cookie: allowed } });
      expect(res.status).toBe(404);
    });
  });

  test("detail returns the snapshots, and a malformed id is rejected before the driver", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const cookie = await cookieFor(app, owner.email);

      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "organization.member.role_changed",
        resourceId: "member-1",
        beforeState: { role: "viewer" },
        afterState: { role: "admin" },
        changes: { role: { from: "viewer", to: "admin" } },
        actorIp: "203.0.113.9",
        actorUserAgent: "audit-test/1.0",
      });
      const id = await db
        .execute(
          `SELECT id FROM unified_audit_log WHERE action = 'organization.member.role_changed' LIMIT 1`,
        )
        .then((r: any) => r.rows?.[0]?.id as string);

      const res = await app.request(`/api/audit/${id}`, { headers: { cookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { event: Record<string, unknown> };
      };
      expect(body.data.event.beforeState).toEqual({ role: "viewer" });
      expect(body.data.event.afterState).toEqual({ role: "admin" });
      expect(body.data.event.changes).toEqual({ role: { from: "viewer", to: "admin" } });
      expect(body.data.event.actorIp).toBe("203.0.113.9");
      expect(body.data.event.actorUserAgent).toBe("audit-test/1.0");
      // Never the chain material, not even on the detail path.
      expect(body.data.event).not.toHaveProperty("checksum");
      expect(body.data.event).not.toHaveProperty("previousChecksum");

      const tooLong = await app.request(`/api/audit/${"x".repeat(80)}`, { headers: { cookie } });
      expect(tooLong.status).toBe(422);
      const quote = await app.request(`/api/audit/${encodeURIComponent("a'b\"c")}`, {
        headers: { cookie },
      });
      expect(quote.status).toBe(422);
    });
  });
});
