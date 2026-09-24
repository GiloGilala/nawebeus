/**
 * Impersonation routes (NWB-P1-011) — `/api/users/admin/impersonation*`.
 *
 * Route-level behaviour the service tests cannot see: authorization verbs, the
 * cookie swap, the shadowing regression (F-11 one level down), and the one
 * integration fact this ticket exists for — an audited action taken *inside* an
 * impersonation lands in `unified_audit_log` tagged `impersonation` with the
 * admin as actor and the account as target.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import { signAccessToken, signToken } from "../../services/auth/jwt";
import { generateTOTOSecret, getCurrentTOTP } from "../../services/auth/totp";
import { createTestApp } from "../helpers/test-client";
import { type TestDbContext, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

describe("Impersonation routes — no DB (auth/validation)", () => {
  test("all four routes 401 without credentials", async () => {
    const app = createTestApp();
    const cases: [string, string][] = [
      ["/api/users/admin/impersonations", "GET"],
      ["/api/users/admin/00000000-0000-4000-8000-000000000000/impersonate", "POST"],
      ["/api/users/admin/impersonations/imp_00000000-0000-4000-8000-000000000000/end", "POST"],
      ["/api/users/admin/impersonations/imp_00000000-0000-4000-8000-000000000000/token", "POST"],
    ];
    for (const [path, method] of cases) {
      const res = await app.request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify({}) } : {}),
      });
      expect(res.status, path).toBe(401);
    }
  });
});

describe.skipIf(!hasDb())("Impersonation routes (integration)", () => {
  interface World {
    app: ReturnType<typeof createTestApp>;
    db: TestDbContext["db"];
    orgId: string;
    adminId: string;
    targetId: string;
    adminCookie: string;
    mfaSecret: string;
  }

  async function makeWorld(db: TestDbContext["db"]): Promise<World> {
    const app = createTestApp(db);
    const admin = await createTestUser(db);
    const org = await createTestOrg(db, { ownerId: admin.id });
    await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "owner" });
    const target = await createTestUser(db);
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: target.id,
      roleCode: "creator",
    });
    const secret = generateTOTOSecret();
    await db.execute(
      sql`UPDATE users SET two_factor_enabled = true, two_factor_secret = ${secret} WHERE id = ${admin.id}`,
    );
    const adminCookie = `nawebeus_access=${await signAccessToken(admin.id, org.id, getConfig().JWT_ACCESS_SECRET)}`;
    return {
      app,
      db,
      orgId: org.id,
      adminId: admin.id,
      targetId: target.id,
      adminCookie,
      mfaSecret: secret,
    };
  }

  async function startImpersonated(w: World): Promise<{ cookie: string; sessionId: string }> {
    const res = await w.app.request(`/api/users/admin/${w.targetId}/impersonate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: w.adminCookie },
      body: JSON.stringify({
        reason: "Customer reported a broken publishing schedule",
        durationMinutes: 30,
        mfaCode: await getCurrentTOTP(w.mfaSecret),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const setCookie = (res.headers.getSetCookie?.() ?? []).find((c) =>
      c.startsWith("nawebeus_access="),
    );
    expect(setCookie).toBeDefined();
    const sessionId: string = body.data.impersonation.sessionId;
    return {
      cookie: setCookie!.split(";")[0] ?? "",
      sessionId,
    };
  }

  test("without users.impersonate the start route 403s (creator cannot impersonate)", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      const targetCookie = `nawebeus_access=${await signAccessToken(w.targetId, w.orgId, getConfig().JWT_ACCESS_SECRET)}`;
      const res = await w.app.request(`/api/users/admin/${w.adminId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: targetCookie },
        body: JSON.stringify({ reason: "I should not be able to do this at all" }),
      });
      expect(res.status).toBe(403);
    });
  });

  test("without an MFA code the start route 401s with MFA_REQUIRED", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      const res = await w.app.request(`/api/users/admin/${w.targetId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: w.adminCookie },
        body: JSON.stringify({ reason: "Missing the step-up code on purpose" }),
      });
      expect(res.status).toBe(401);
      expect(((await res.json()) as any).error.code).toBe("MFA_REQUIRED");
    });
  });

  test("start → the cookie acts as the target; short reasons and self-impersonation refuse", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);

      // Reason below the justification floor.
      const short = await w.app.request(`/api/users/admin/${w.targetId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: w.adminCookie },
        body: JSON.stringify({ reason: "fix it", mfaCode: await getCurrentTOTP(w.mfaSecret) }),
      });
      expect(short.status).toBe(422);

      // Self-impersonation: the module spec's named 403.
      const self = await w.app.request(`/api/users/admin/${w.adminId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: w.adminCookie },
        body: JSON.stringify({
          reason: "Trying to impersonate myself",
          mfaCode: await getCurrentTOTP(w.mfaSecret),
        }),
      });
      expect(self.status).toBe(403);
      expect(((await self.json()) as any).error.code).toBe("SELF_IMPERSONATION_DENIED");

      // The happy path: the swapped cookie now speaks as the target.
      const { cookie } = await startImpersonated(w);
      const me = await w.app.request("/api/users/me", { headers: { cookie } });
      expect(me.status).toBe(200);
      expect(((await me.json()) as any).data.user.id).toBe(w.targetId);
    });
  });

  test("GET /impersonations is not shadowed by GET /:userId (F-11, one level down)", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      // A non-uuid segment reaching the param route would 422; the literal route
      // must win — this test pins the registration order in admin.route.ts.
      const res = await w.app.request("/api/users/admin/impersonations", {
        headers: { cookie: w.adminCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data.impersonations)).toBe(true);

      // And the param route still works for real uuids.
      const byId = await w.app.request(`/api/users/admin/${w.targetId}`, {
        headers: { cookie: w.adminCookie },
      });
      expect(byId.status).toBe(200);
    });
  });

  test("the oversight list needs audit.read — a manager without it 403s", async () => {
    await withTestDb(async ({ db }) => {
      const admin = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: admin.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "owner" });
      const manager = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      const app = createTestApp(db);
      const managerCookie = `nawebeus_access=${await signAccessToken(manager.id, org.id, getConfig().JWT_ACCESS_SECRET)}`;
      // orgAdministration (the admin tier) holds audit.read; a manager does not,
      // so the oversight view refuses — it is a compliance view, not a team view.
      const res = await app.request("/api/users/admin/impersonations", {
        headers: { cookie: managerCookie },
      });
      expect(res.status).toBe(403);
    });
  });

  test("org.delete is stripped while impersonating, even against an owner target", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      // Make the target an owner too — they hold org.delete themselves; the
      // session must not (BR-ADMIN-009: no organization deletion through a
      // borrowed account). One membership row per (org, user), so promote the
      // existing creator membership rather than adding a second one.
      await db.execute(sql`
        UPDATE organization_members
        SET role_id = (SELECT id FROM roles WHERE code = 'owner' AND organization_id IS NULL LIMIT 1)
        WHERE organization_id = ${w.orgId} AND user_id = ${w.targetId}
      `);
      const { cookie } = await startImpersonated(w);
      const res = await w.app.request(`/api/orgs/${w.orgId}`, {
        method: "DELETE",
        headers: { cookie },
      });
      expect(res.status).toBe(403);

      // A plain target action still works — the deny-list is narrow.
      const me = await w.app.request("/api/users/me", { headers: { cookie } });
      expect(me.status).toBe(200);
    });
  });

  test("an audited action inside the session is tagged impersonation: admin actor, target user, session id", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      // The target holds a sign-in session row to revoke — a plain, audited
      // action the target's own account can perform.
      const { sessionId: impersonationId } = await startImpersonated(w);
      const sessionRow = (
        (await db.execute(sql`
          INSERT INTO sessions (id, user_id, session_token_hash, type, login_method, status, expires_at)
          VALUES (${crypto.randomUUID()}, ${w.targetId}, ${`hash-${crypto.randomUUID()}`}, 'web', 'password', 'active', now() + interval '7 days')
          RETURNING id
        `)) as any
      ).rows[0];
      expect(sessionRow).toBeDefined();

      // Re-mint through the route so the held cookie is the route's own product.
      const mint = await w.app.request(`/api/users/admin/impersonations/${impersonationId}/token`, {
        method: "POST",
        headers: { cookie: w.adminCookie },
      });
      expect(mint.status).toBe(200);
      const mintCookie =
        (mint.headers.getSetCookie?.() ?? [])
          .find((c) => c.startsWith("nawebeus_access="))!
          .split(";")[0] ?? "";

      const revoke = await w.app.request(`/api/auth/sessions/${sessionRow.id}`, {
        method: "DELETE",
        headers: { cookie: mintCookie },
      });
      expect(revoke.status).toBe(200);

      const rows = (
        (await db.execute(sql`
          SELECT actor_type, actor_id, target_user_id, impersonation_session_id
          FROM unified_audit_log
          WHERE action = 'auth.session.revoked' AND resource_id = ${sessionRow.id}
        `)) as any
      ).rows as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_type).toBe("impersonation");
      expect(rows[0].actor_id).toBe(w.adminId);
      expect(rows[0].target_user_id).toBe(w.targetId);
      expect(rows[0].impersonation_session_id).toBe(impersonationId);
    });
  });

  test("ending from inside works, clears the cookie, and the dead token is refused afterwards", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      const { cookie, sessionId } = await startImpersonated(w);

      // While impersonated, "Stop" must not 403 on the target's abilities.
      const end = await w.app.request(`/api/users/admin/impersonations/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: "{}",
      });
      expect(end.status).toBe(200);
      expect(((await end.json()) as any).data.impersonation.endReason).toBe("manual_end");
      // The access cookie was cleared.
      const cleared = (end.headers.getSetCookie?.() ?? []).find((c) =>
        c.startsWith("nawebeus_access="),
      );
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);

      // The dead token is refused on the next request — the row, not the exp.
      const after = await w.app.request("/api/users/me", { headers: { cookie } });
      expect(after.status).toBe(401);
      expect(((await after.json()) as any).error.code).toBe("UNAUTHORIZED");

      // An impersonated caller canNOT end a *different* session: the binding is
      // to their own id, and a random other id is 403 (not theirs to end).
      const second = await startImpersonated(w);
      const wrongEnd = await w.app.request(
        `/api/users/admin/impersonations/${`imp_${crypto.randomUUID()}`}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: second.cookie },
          body: "{}",
        },
      );
      expect(wrongEnd.status).toBe(403);
    });
  });

  test("a hand-crafted impersonation payload with an invented session id is refused", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      // Signature valid (our secret), row id invented: verifyToken accepts it,
      // resolveLiveImpersonation must not. This is the row-check earning its keep.
      const raw = await signToken(
        {
          userId: w.targetId,
          orgId: w.orgId,
          type: "access",
          impersonationSessionId: `imp_${crypto.randomUUID()}`,
          impersonatorId: w.adminId,
        } as never,
        getConfig().JWT_ACCESS_SECRET,
        900,
      );
      const res = await w.app.request("/api/users/me", {
        headers: { cookie: `nawebeus_access=${raw}` },
      });
      expect(res.status).toBe(401);
    });
  });

  test("re-mint from a normal admin works; the target cannot mint their own way in", async () => {
    await withTestDb(async ({ db }) => {
      const w = await makeWorld(db);
      const { sessionId, cookie } = await startImpersonated(w);

      // The session's own admin re-enters with a fresh token.
      const mint = await w.app.request(`/api/users/admin/impersonations/${sessionId}/token`, {
        method: "POST",
        headers: { cookie: w.adminCookie },
      });
      expect(mint.status).toBe(200);
      expect(((await mint.json()) as any).data.token).toBeTruthy();

      // The impersonated (target-ability) caller has no users.impersonate → 403.
      const fromInside = await w.app.request(`/api/users/admin/impersonations/${sessionId}/token`, {
        method: "POST",
        headers: { cookie },
      });
      expect(fromInside.status).toBe(403);

      void TEST_USER_PASSWORD;
    });
  });
});
