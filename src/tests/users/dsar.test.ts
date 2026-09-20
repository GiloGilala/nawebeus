import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { ForbiddenError } from "../../lib/errors";
import { writeAuditLog } from "../../services/audit";
import { signup } from "../../services/auth/signup";
import { buildExportPackage, requestDataExport } from "../../services/users/dsar.service";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("DSAR export routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("POST /api/users/me/data-export without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/data-export", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("GET /api/users/me/data-export/:requestId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/data-export/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
  });

  test("POST /api/users/:userId/data-export without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/user-123/data-export", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

const PASSWORD = "ValidPass123!";

interface FixtureUser {
  id: string;
  email: string;
  cookies: string;
}

interface Fixture {
  app: ReturnType<typeof createTestApp>;
  db: Db;
  owner: FixtureUser; // org A, owner role (users.create)
  admin: FixtureUser; // org A, admin role (users.create)
  member: FixtureUser; // org A, viewer role (no users.create)
  foreign: FixtureUser; // owns org B only
  orgId: string;
  foreignOrgId: string;
}

/**
 * Builds the fixture inside the caller's transaction:
 * - owner signs up (owns org A);
 * - admin + member are re-homed into org A with admin / viewer roles;
 * - foreign signs up (owns org B, nothing in org A);
 * - every actor signs in (real session rows + cookies);
 * - a synthetic session row and API key for the owner carry marker secret
 *   values that must never leak into an export;
 * - audit rows exist on both sides of the owner (actor and target).
 */
async function buildFixture(db: Db, app: ReturnType<typeof createTestApp>): Promise<Fixture> {
  const uid = crypto.randomUUID().slice(0, 8);

  const signupUser = async (label: string, roleCode?: string, homeOrg?: string) => {
    const u = await signup(db, {
      email: `dsar-${label}-${uid}@example.com`,
      password: PASSWORD,
      fullName: `Dsar ${label}`,
      organizationName: `${label} org ${uid}`,
      termsAccepted: true,
      privacyAccepted: true,
    } as any);
    if (roleCode && homeOrg) {
      const roleRows = await db.execute<{ id: string }>(
        sql`
          SELECT id FROM roles
          WHERE code = ${roleCode} AND organization_id IS NULL
            AND deleted_at IS NULL AND archived_at IS NULL
          LIMIT 1
        `,
      );
      const roleId = (roleRows as any).rows?.[0]?.id as string;
      expect(roleId).toBeDefined();
      await db.execute(sql`UPDATE users SET organization_id = ${homeOrg} WHERE id = ${u.user.id}`);
      await db.execute(
        sql`
          INSERT INTO organization_members (organization_id, user_id, role_id, status, is_active)
          VALUES (${homeOrg}, ${u.user.id}, ${roleId}, 'active', true)
        `,
      );
      await db.execute(
        sql`UPDATE organization_members SET status = 'active', is_active = true
            WHERE user_id = ${u.user.id} AND organization_id = ${homeOrg}`,
      );
    }
    return u;
  };

  const ownerU = await signupUser("owner");
  const orgId = ownerU.organization.id;
  const adminU = await signupUser("admin", "admin", orgId);
  const memberU = await signupUser("member", "viewer", orgId);
  const foreignU = await signupUser("foreign");
  const foreignOrgId = foreignU.organization.id;

  const signinCookies = async (email: string) => {
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  };

  const owner: FixtureUser = {
    id: ownerU.user.id,
    email: ownerU.user.email,
    cookies: await signinCookies(ownerU.user.email),
  };
  const admin: FixtureUser = {
    id: adminU.user.id,
    email: adminU.user.email,
    cookies: await signinCookies(adminU.user.email),
  };
  const member: FixtureUser = {
    id: memberU.user.id,
    email: memberU.user.email,
    cookies: await signinCookies(memberU.user.email),
  };
  const foreign: FixtureUser = {
    id: foreignU.user.id,
    email: foreignU.user.email,
    cookies: await signinCookies(foreignU.user.email),
  };

  // Synthetic secrets with known marker values — the export must never
  // contain them.
  await db.execute(
    sql`
      INSERT INTO sessions (user_id, session_token_hash, ip_address, user_agent, expires_at, last_activity_at)
      VALUES (${owner.id}, ${`marker-session-token-hash-${uid}`}, '10.0.0.9', 'dsar-test-agent', now() + interval '1 day', now())
    `,
  );
  await db.execute(
    sql`
      INSERT INTO api_keys (organization_id, user_id, name, public_key, key_prefix, secret_hash, key_type, created_by)
      VALUES (${orgId}, ${owner.id}, ${`key-${uid}`}, ${`nwb_test_${uid}_pub`}, ${uid.slice(0, 8)}, ${`marker-api-secret-hash-${uid}`}, 'read', ${owner.id})
    `,
  );

  // Audit rows on both sides of the subject (actor = owner, target = owner).
  await writeAuditLog({
    db,
    module: "core",
    action: "fixture.dsar.actor",
    category: "user_management",
    actorId: owner.id,
    actorType: "user",
    organizationId: orgId,
  });
  await writeAuditLog({
    db,
    module: "core",
    action: "fixture.dsar.target",
    category: "user_management",
    actorId: foreign.id,
    actorType: "user",
    organizationId: orgId,
    targetUserId: owner.id,
  });

  return { app, db, owner, admin, member, foreign, orgId, foreignOrgId };
}

const SECTION_NAMES = [
  "profile",
  "sessions",
  "memberships",
  "api_keys",
  "oauth_accounts",
  "audit_events",
  "previous_exports",
];

describe.skipIf(!hasDb())("DSAR export — self service (NWB-P0-002)", () => {
  test("POST /me/data-export returns a complete, secret-free package", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const res = await fx.app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie: fx.owner.cookies },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      const { request, exportPackage } = body.data;

      expect(request.userId).toBe(fx.owner.id);
      expect(request.requestedBy).toBe(fx.owner.id);
      expect(request.status).toBe("completed");
      expect(request.type).toBe("access");
      expect(new Date(request.expiresAt).getTime()).toBeGreaterThan(Date.now());

      for (const s of SECTION_NAMES) {
        expect(exportPackage.sectionMeta[s]).toBeDefined();
        expect(exportPackage.sectionMeta[s].truncated).toBe(false);
      }

      const profile = exportPackage.sections.profile[0];
      expect(profile.email).toBe(fx.owner.email);
      expect(profile.first_name).toBe("Dsar");

      // Secret-free: markers and credential columns never appear.
      const raw = JSON.stringify(exportPackage);
      expect(raw).not.toContain("marker-session-token-hash");
      expect(raw).not.toContain("marker-api-secret-hash");
      expect(raw).not.toContain("session_token_hash");
      expect(raw).not.toContain("secret_hash");
      expect(raw).not.toContain("two_factor_secret");
      expect(raw).not.toContain("password_history");

      // Own-org membership with role metadata.
      const membership = exportPackage.sections.memberships.find(
        (m: any) => m.organization_id === fx.orgId,
      );
      expect(membership).toBeDefined();
      expect(membership.role_code).toBe("owner");

      // The API key section carries metadata, not secrets.
      const apiKeyRow = exportPackage.sections.api_keys[0];
      expect(apiKeyRow.name).toStartWith("key-");
      expect(apiKeyRow.public_key).toStartWith("nwb_test_");
      expect(apiKeyRow.secret_hash).toBeUndefined();

      // Both fixture audit rows are in the subject's trail.
      const actions = exportPackage.sections.audit_events.map((a: any) => a.action);
      expect(actions).toContain("fixture.dsar.actor");
      expect(actions).toContain("fixture.dsar.target");
      // Bulk state columns are excluded.
      expect(actions.length).toBeGreaterThan(0);
      for (const a of exportPackage.sections.audit_events) {
        expect(a.before_state).toBeUndefined();
        expect(a.after_state).toBeUndefined();
      }
    });
  });

  test("the request and the download are audited (compliance.dsar.*)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const created = await fx.app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie: fx.owner.cookies },
      });
      const requestId = (await created.json()).data.request.id;

      const downloaded = await fx.app.request(`/api/users/me/data-export/${requestId}`, {
        headers: { cookie: fx.owner.cookies },
      });
      expect(downloaded.status).toBe(200);

      const audited = await db.execute<{ action: string; target_user_id: string }>(
        sql`
          SELECT action, target_user_id FROM unified_audit_log
          WHERE resource_id = ${requestId}
            AND action IN ('compliance.dsar.requested', 'compliance.dsar.downloaded')
          ORDER BY created_at
        `,
      );
      const actions = (audited as any).rows.map((r: any) => r.action);
      expect(actions).toContain("compliance.dsar.requested");
      expect(actions).toContain("compliance.dsar.downloaded");
      const requested = (audited as any).rows.find(
        (r: any) => r.action === "compliance.dsar.requested",
      );
      expect(requested.target_user_id).toBe(fx.owner.id);
    });
  });

  test("re-download by requestId returns the same package", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const created = await fx.app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie: fx.owner.cookies },
      });
      expect(created.status).toBe(201);
      const createdBody = await created.json();
      const requestId = createdBody.data.request.id;
      const original = createdBody.data.exportPackage;

      const res = await fx.app.request(`/api/users/me/data-export/${requestId}`, {
        headers: { cookie: fx.owner.cookies },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.request.id).toBe(requestId);
      expect(body.data.exportPackage.sections.profile[0].email).toBe(fx.owner.email);
      expect(body.data.exportPackage.sectionMeta).toEqual(original.sectionMeta);
    });
  });
});

describe.skipIf(!hasDb())("DSAR export — negative paths (NWB-P0-002)", () => {
  test("another user's request id is indistinguishable from a missing one (404)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const created = await fx.app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie: fx.owner.cookies },
      });
      const requestId = (await created.json()).data.request.id;

      const res = await fx.app.request(`/api/users/me/data-export/${requestId}`, {
        headers: { cookie: fx.foreign.cookies },
      });
      expect(res.status).toBe(404);

      // A nonexistent id looks exactly the same.
      const missing = await fx.app.request(`/api/users/me/data-export/${crypto.randomUUID()}`, {
        headers: { cookie: fx.foreign.cookies },
      });
      expect(missing.status).toBe(404);
      expect((await missing.json()).error.code).toBe((await res.json()).error.code);
    });
  });

  test("expired package returns 410 EXPORT_EXPIRED", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const created = await fx.app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie: fx.owner.cookies },
      });
      const requestId = (await created.json()).data.request.id;

      await db.execute(
        sql`UPDATE dsar_requests SET expires_at = now() - interval '1 hour' WHERE id = ${requestId}`,
      );

      const res = await fx.app.request(`/api/users/me/data-export/${requestId}`, {
        headers: { cookie: fx.owner.cookies },
      });
      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error.code).toBe("EXPORT_EXPIRED");
    });
  });

  test("admin exports own-org member (201); cross-tenant 403; viewer 403", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      // Positive: org A admin exports the org A member.
      const ok = await fx.app.request(`/api/users/${fx.member.id}/data-export`, {
        method: "POST",
        headers: { cookie: fx.admin.cookies },
      });
      expect(ok.status).toBe(201);
      const okBody = await ok.json();
      expect(okBody.data.request.userId).toBe(fx.member.id);
      expect(okBody.data.request.requestedBy).toBe(fx.admin.id);
      expect(okBody.data.request.organizationId).toBe(fx.orgId);
      expect(okBody.data.exportPackage.sections.profile[0].email).toBe(fx.member.email);

      // Negative: org A admin cannot export the foreign user (org B).
      const crossTenant = await fx.app.request(`/api/users/${fx.foreign.id}/data-export`, {
        method: "POST",
        headers: { cookie: fx.admin.cookies },
      });
      expect(crossTenant.status).toBe(403);
      expect((await crossTenant.json()).error.code).toBe("FORBIDDEN");

      // Negative: the foreign owner holds users.create in their own org but
      // the subject is not a member of it — the service guard rejects.
      const foreignTargetsAdmin = await fx.app.request(`/api/users/${fx.admin.id}/data-export`, {
        method: "POST",
        headers: { cookie: fx.foreign.cookies },
      });
      expect(foreignTargetsAdmin.status).toBe(403);

      // Negative: the viewer holds no users.create at all.
      const viewerAttempt = await fx.app.request(`/api/users/${fx.member.id}/data-export`, {
        method: "POST",
        headers: { cookie: fx.member.cookies },
      });
      expect(viewerAttempt.status).toBe(403);
    });
  });

  test("on-behalf request without an organization context is refused", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      const attempt = () =>
        requestDataExport(db, {
          subjectUserId: fx.member.id,
          requestedBy: fx.owner.id,
          // Deliberately no organizationId — on-behalf must name the org.
        });
      expect(attempt()).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("sections are capped with a truncation marker", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const fx = await buildFixture(db, app);

      for (let i = 0; i < 8; i++) {
        await writeAuditLog({
          db,
          module: "core",
          action: `fixture.cap.${i}`,
          category: "user_management",
          actorId: fx.owner.id,
          actorType: "user",
        });
      }

      const pkg = await buildExportPackage(db, fx.owner.id, 5);
      const meta = pkg.sectionMeta.audit_events;
      expect(meta).toBeDefined();
      expect(meta!.truncated).toBe(true);
      expect(meta!.rows).toBe(5);
      expect(pkg.sections.audit_events!.length).toBe(5);

      // Default cap is not hit for the same data.
      const full = await buildExportPackage(db, fx.owner.id);
      expect(full.sectionMeta.audit_events!.truncated).toBe(false);
    });
  });
});
