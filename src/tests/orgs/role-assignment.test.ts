import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { loadAbility } from "../../services/auth/ability";
import { signup } from "../../services/auth/signup";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestUser,
  systemRoleId,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Role assignment + invitation routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("POST /api/orgs/:orgId/members/assign-role without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/assign-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", roleId: "role-1" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/orgs/:orgId/members/invite without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "guest@example.com" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/orgs/:orgId/members/invite/bulk without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/abc/members/invite/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: [{ email: "a@b.com" }] }),
    });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: the DEC-039 hierarchy + self-protection rules through the routes
// (NWB-P0-014, closes F-07 and F-21).
// ─────────────────────────────────────────────────────────────────────────────

const hasDb = () => !!process.env.DATABASE_URL;

interface Fixture {
  app: ReturnType<typeof createTestApp>;
  orgId: string;
  owner: { id: string; email: string };
  /** member by role code (one active member of `orgId` per requested tier) */
  u: (roleCode: string) => { id: string; email: string; memberId: string };
  cookiesFor: (email: string) => Promise<string>;
  assign: (
    actorEmail: string,
    targetUserId: string,
    roleCode: string,
  ) => Promise<{ status: number; json: any }>;
}

/**
 * One organization (created through the real signup path, so the owner holds
 * the seeded `owner` role) plus one active member per requested tier.
 */
async function buildOrg(db: Db, roles: string[]): Promise<Fixture> {
  const app = createTestApp(db);
  const uid = crypto.randomUUID().slice(0, 8);
  const created = await signup(db, {
    email: `owner-${uid}@example.com`,
    password: TEST_USER_PASSWORD,
    fullName: "Org Owner",
    organizationName: `Role Org ${uid}`,
    termsAccepted: true,
    privacyAccepted: true,
  } as any);
  const orgId = created.organization.id;

  const users: Record<string, { id: string; email: string; memberId: string }> = {};
  for (const roleCode of roles) {
    const u = await createTestUser(db, { email: `${roleCode}-${uid}@example.com` });
    const m = await addMemberWithRole(db, { organizationId: orgId, userId: u.id, roleCode });
    users[roleCode] = { id: u.id, email: u.email, memberId: m.id };
  }

  const cookiesFor = async (email: string) => {
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
    });
    if (res.status !== 200) throw new Error(`signin for ${email} failed: ${res.status}`);
    return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  };

  const assign = async (actorEmail: string, targetUserId: string, roleCode: string) => {
    const res = await app.request(`/api/orgs/${orgId}/members/assign-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: await cookiesFor(actorEmail) },
      body: JSON.stringify({ userId: targetUserId, roleId: await systemRoleId(db, roleCode) }),
    });
    const json = res.status === 204 ? null : await res.json();
    return { status: res.status, json };
  };

  return {
    app,
    orgId,
    owner: { id: created.user.id, email: created.user.email },
    u: (roleCode) => {
      const member = users[roleCode];
      if (!member) throw new Error(`fixture has no ${roleCode} member`);
      return member;
    },
    cookiesFor,
    assign,
  };
}

async function roleCodeOf(db: Db, memberId: string): Promise<string | null> {
  const rows = await db.execute<{ code: string | null }>(
    sql`
      SELECT r.code FROM organization_members om
      LEFT JOIN roles r ON r.id = om.role_id
      WHERE om.id = ${memberId}
    `,
  );
  return ((rows as any).rows?.[0]?.code as string | null) ?? null;
}

describe.skipIf(!hasDb())("Role assignment — hierarchy & self-protection (DEC-039, F-07)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("owner promotes a viewer to admin; the member's ability changes immediately", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["viewer"]);
      const before = await loadAbility(db, f.u("viewer").id, f.orgId);
      expect(before.can("create", "apikeys")).toBe(false);

      // Before this ticket the new-role lookup required organization_id =
      // orgId, which no seeded (system) role satisfies — every call was 404.
      const { status, json } = await f.assign(f.owner.email, f.u("viewer").id, "admin");
      expect(status).toBe(200);
      expect(json.data.member.roleSlug).toBe("admin");

      const after = await loadAbility(db, f.u("viewer").id, f.orgId);
      expect(after.can("create", "apikeys")).toBe(true);
      expect(after.can("update", "billing")).toBe(false); // admin ≠ owner

      const history = await db.execute<{ role_name: string; previous_role_name: string }>(
        sql`SELECT role_name, previous_role_name FROM member_role_history WHERE member_id = ${f.u("viewer").memberId}`,
      );
      expect((history as any).rows).toHaveLength(1);
      expect((history as any).rows[0]).toMatchObject({
        role_name: "Admin",
        previous_role_name: "Viewer",
      });

      const audit = await db.execute<{ count: number }>(
        sql`
          SELECT COUNT(*)::int AS count FROM unified_audit_log
          WHERE action = 'organization.member.role_changed' AND resource_id = ${f.u("viewer").memberId}
        `,
      );
      expect((audit as any).rows[0].count).toBe(1);
    });
  });

  test("the Owner role cannot be granted — ownership is transferred (BR-AUTH-031)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin"]);
      const { status, json } = await f.assign(f.owner.email, f.u("admin").id, "owner");
      expect(status).toBe(403);
      expect(json.error.message).toMatch(/transferred/);
      expect(await roleCodeOf(db, f.u("admin").memberId)).toBe("admin");
    });
  });

  test("an admin cannot change the Owner's role (was a no-op guard: code 'owner' did not exist)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin"]);
      const ownerMember = await db.execute<{ id: string }>(
        sql`SELECT id FROM organization_members WHERE organization_id = ${f.orgId} AND user_id = ${f.owner.id}`,
      );
      const { status } = await f.assign(f.u("admin").email, f.owner.id, "viewer");
      expect(status).toBe(403);
      expect(await roleCodeOf(db, (ownerMember as any).rows[0].id)).toBe("owner");
    });
  });

  test("an admin cannot change their own role (§6.3 'Cannot demote self')", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin"]);
      const { status, json } = await f.assign(f.u("admin").email, f.u("admin").id, "viewer");
      expect(status).toBe(403);
      expect(json.error.message).toMatch(/own role/);
    });
  });

  test("manager scope: may assign roles below Manager, nothing else (spec 'Who Can Assign')", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["manager", "creator", "viewer", "admin"]);
      const m = f.u("manager").email;

      // ✅ creator → analyst (both below Manager)
      expect((await f.assign(m, f.u("creator").id, "analyst")).status).toBe(200);
      expect(await roleCodeOf(db, f.u("creator").memberId)).toBe("analyst");

      // ❌ cannot grant Manager (peer level) or Admin
      expect((await f.assign(m, f.u("viewer").id, "manager")).status).toBe(403);
      expect((await f.assign(m, f.u("viewer").id, "admin")).status).toBe(403);
      // ❌ cannot touch an Admin at all
      expect((await f.assign(m, f.u("admin").id, "viewer")).status).toBe(403);
      expect(await roleCodeOf(db, f.u("admin").memberId)).toBe("admin");
    });
  });

  test("an admin cannot demote a peer admin, but the owner can", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin"]);
      const uid = crypto.randomUUID().slice(0, 8);
      const other = await createTestUser(db, { email: `admin2-${uid}@example.com` });
      const otherMember = await addMemberWithRole(db, {
        organizationId: f.orgId,
        userId: other.id,
        roleCode: "admin",
      });

      expect((await f.assign(f.u("admin").email, other.id, "manager")).status).toBe(403);
      expect(await roleCodeOf(db, otherMember.id)).toBe("admin");

      expect((await f.assign(f.owner.email, other.id, "manager")).status).toBe(200);
      expect(await roleCodeOf(db, otherMember.id)).toBe("manager");
    });
  });

  test("last administrator protection (BR-AUTH-030): 409 when no other active Owner/Admin remains", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin"]);
      const { assertNotLastAdministrator, findMemberRole } = await import(
        "../../services/orgs/role-policy"
      );
      const admin = await findMemberRole(db, f.orgId, { userId: f.u("admin").id });
      expect(admin).not.toBeNull();
      if (!admin) return;

      // Owner active ⇒ the admin is not the last administrator.
      await expect(assertNotLastAdministrator(db, f.orgId, admin)).resolves.toBeUndefined();

      // Owner's membership suspended (what account deletion does to
      // memberships) ⇒ the admin is the only active Owner/Admin left ⇒ 409.
      await db.execute(
        sql`
          UPDATE organization_members SET status = 'suspended', is_active = false
          WHERE organization_id = ${f.orgId} AND user_id = ${f.owner.id}
        `,
      );
      await expect(assertNotLastAdministrator(db, f.orgId, admin)).rejects.toMatchObject({
        statusCode: 409,
      });

      // A second active admin satisfies the rule again.
      const uid = crypto.randomUUID().slice(0, 8);
      const second = await createTestUser(db, { email: `admin2-${uid}@example.com` });
      await addMemberWithRole(db, {
        organizationId: f.orgId,
        userId: second.id,
        roleCode: "admin",
      });
      await expect(assertNotLastAdministrator(db, f.orgId, admin)).resolves.toBeUndefined();

      // Non-administrators are never subject to the rule.
      const viewer = await createTestUser(db, { email: `viewer-${uid}@example.com` });
      await addMemberWithRole(db, {
        organizationId: f.orgId,
        userId: viewer.id,
        roleCode: "viewer",
      });
      const viewerMember = await findMemberRole(db, f.orgId, { userId: viewer.id });
      if (!viewerMember) throw new Error("fixture");
      await expect(assertNotLastAdministrator(db, f.orgId, viewerMember)).resolves.toBeUndefined();

      // Through the routes the invariant is structural: only an Owner or a
      // super_admin outranks an Admin, and both are themselves counted as
      // active administrators — so the 409 is defense in depth for service
      // callers (org deletion, account-deletion cascades, future consoles).
    });
  });

  // The three acceptance criteria that `.scratch/foundation/issues/07` listed
  // and NWB-P0-014 never wrote a test for. The behaviour was correct; nothing
  // pinned it, which is why the boxes could not honestly be ticked (NWB-P0-006).
  test("a role id that exists nowhere returns 404, not 403 or 500", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["viewer"]);
      const res = await f.app.request(`/api/orgs/${f.orgId}/members/assign-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: await f.cookiesFor(f.owner.email) },
        body: JSON.stringify({ userId: f.u("viewer").id, roleId: crypto.randomUUID() }),
      });
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
      // The member is untouched — a failed lookup must not be a partial write.
      expect(await roleCodeOf(db, f.u("viewer").memberId)).toBe("viewer");
    });
  });

  test("a user who is not a member of this organization returns 404", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["viewer"]);
      const stranger = await createTestUser(db, {
        email: `stranger-${crypto.randomUUID().slice(0, 8)}@example.com`,
      });
      const res = await f.app.request(`/api/orgs/${f.orgId}/members/assign-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: await f.cookiesFor(f.owner.email) },
        body: JSON.stringify({
          userId: stranger.id,
          roleId: await systemRoleId(db, "viewer"),
        }),
      });
      // 404, not 403: the caller is entitled to assign roles here, the subject
      // simply is not one of this org's members. Nothing about the stranger's
      // existence leaks either way.
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    });
  });

  test("a member without members.update cannot assign roles at all (403 at the ability gate)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["creator", "viewer"]);
      // A creator holds content permissions, never `members.update` — so this
      // is refused by `requireAbility` before the hierarchy policy is consulted.
      const res = await f.app.request(`/api/orgs/${f.orgId}/members/assign-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: await f.cookiesFor(f.u("creator").email),
        },
        body: JSON.stringify({
          userId: f.u("viewer").id,
          roleId: await systemRoleId(db, "analyst"),
        }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      expect(await roleCodeOf(db, f.u("viewer").memberId)).toBe("viewer");
    });
  });

  test("a role from another organization is not assignable (404, no cross-tenant leakage)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["viewer"]);
      const otherOrg = await signup(db, {
        email: `other-${crypto.randomUUID().slice(0, 8)}@example.com`,
        password: TEST_USER_PASSWORD,
        fullName: "Other Owner",
        organizationName: "Other Org",
        termsAccepted: true,
        privacyAccepted: true,
      } as any);
      const customRole = await db.execute<{ id: string }>(
        sql`
          INSERT INTO roles (slug, name, display_name, code, level, priority, organization_id, is_system_role)
          VALUES ('their-role', 'Their Role', 'Their Role', ${`their_role_${crypto.randomUUID().slice(0, 8)}`}, 70, 15, ${otherOrg.organization.id}, false)
          RETURNING id
        `,
      );
      const res = await f.app.request(`/api/orgs/${f.orgId}/members/assign-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: await f.cookiesFor(f.owner.email) },
        body: JSON.stringify({
          userId: f.u("viewer").id,
          roleId: (customRole as any).rows[0].id,
        }),
      });
      expect(res.status).toBe(404);
      expect(await roleCodeOf(db, f.u("viewer").memberId)).toBe("viewer");
    });
  });

  test("PATCH /members/:memberId with roleId goes through the same guards (no bypass)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin", "viewer"]);
      const ownerMember = await db.execute<{ id: string }>(
        sql`SELECT id FROM organization_members WHERE organization_id = ${f.orgId} AND user_id = ${f.owner.id}`,
      );
      const ownerMemberId = (ownerMember as any).rows[0].id as string;

      // Before: this UPDATE ran with no checks at all — an admin could demote the owner.
      const demoteOwner = await f.app.request(`/api/orgs/${f.orgId}/members/${ownerMemberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: await f.cookiesFor(f.u("admin").email),
        },
        body: JSON.stringify({ roleId: await systemRoleId(db, "viewer") }),
      });
      expect(demoteOwner.status).toBe(403);
      expect(await roleCodeOf(db, ownerMemberId)).toBe("owner");

      // Legitimate change through PATCH still works, and profile fields update alongside.
      const promote = await f.app.request(
        `/api/orgs/${f.orgId}/members/${f.u("viewer").memberId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            cookie: await f.cookiesFor(f.u("admin").email),
          },
          body: JSON.stringify({
            roleId: await systemRoleId(db, "creator"),
            jobTitle: "Content Lead",
          }),
        },
      );
      expect(promote.status).toBe(200);
      const body = await promote.json();
      expect(body.data.member.roleSlug).toBe("creator");
      expect(body.data.member.jobTitle).toBe("Content Lead");
    });
  });

  test("PATCH /users/admin/:userId with roleId goes through the same guards (no bypass)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["manager", "admin"]);
      // manager holds users.update, but cannot grant admin
      const res = await f.app.request(`/api/users/admin/${f.u("admin").id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: await f.cookiesFor(f.u("manager").email),
        },
        body: JSON.stringify({ roleId: await systemRoleId(db, "viewer") }),
      });
      expect(res.status).toBe(403);
      expect(await roleCodeOf(db, f.u("admin").memberId)).toBe("admin");
    });
  });

  test("suspension via the admin console: not yourself, not the Owner, only members below you", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db, ["admin", "manager", "creator"]);
      const patchStatus = async (actorEmail: string, userId: string, status: string) =>
        f.app.request(`/api/users/admin/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", cookie: await f.cookiesFor(actorEmail) },
          body: JSON.stringify({ status }),
        });

      expect((await patchStatus(f.u("admin").email, f.u("admin").id, "suspended")).status).toBe(
        403,
      );
      expect((await patchStatus(f.u("admin").email, f.owner.id, "suspended")).status).toBe(403);
      expect((await patchStatus(f.u("manager").email, f.u("admin").id, "suspended")).status).toBe(
        403,
      );
      const ok = await patchStatus(f.u("manager").email, f.u("creator").id, "suspended");
      expect(ok.status).toBe(200);
      expect((await ok.json()).data.user.status).toBe("suspended");
    });
  });
});

describe.skipIf(!hasDb())(
  "Member removal — guards + F-21 (removal used to 500 on an enum violation)",
  () => {
    beforeAll(() => {
      loadConfig();
    });

    test("admin removes a manager: 204, membership soft-deleted, audited", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db, ["admin", "manager"]);
        const res = await f.app.request(`/api/orgs/${f.orgId}/members/${f.u("manager").memberId}`, {
          method: "DELETE",
          headers: { cookie: await f.cookiesFor(f.u("admin").email) },
        });
        // F-21: this was a 500 (`invalid input value for enum member_status: "deactivated"`)
        expect(res.status).toBe(204);

        const row = await db.execute<{
          deleted_at: string | null;
          is_active: boolean;
          status: string;
        }>(
          sql`SELECT deleted_at, is_active, status FROM organization_members WHERE id = ${f.u("manager").memberId}`,
        );
        expect((row as any).rows[0].deleted_at).not.toBeNull();
        expect((row as any).rows[0].is_active).toBe(false);

        const list = await f.app.request(`/api/orgs/${f.orgId}/members`, {
          headers: { cookie: await f.cookiesFor(f.u("admin").email) },
        });
        const members = (await list.json()).data.members as Array<{ userId: string }>;
        expect(members.some((m) => m.userId === f.u("manager").id)).toBe(false);

        const audit = await db.execute<{ count: number }>(
          sql`SELECT COUNT(*)::int AS count FROM unified_audit_log WHERE action = 'organization.member.removed' AND resource_id = ${f.u("manager").memberId}`,
        );
        expect((audit as any).rows[0].count).toBe(1);
      });
    });

    test("the Owner cannot be removed (BR-AUTH-031) — 403 for admin and for the owner themself", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db, ["admin"]);
        const ownerMember = await db.execute<{ id: string }>(
          sql`SELECT id FROM organization_members WHERE organization_id = ${f.orgId} AND user_id = ${f.owner.id}`,
        );
        const ownerMemberId = (ownerMember as any).rows[0].id as string;
        for (const actor of [f.u("admin").email, f.owner.email]) {
          const res = await f.app.request(`/api/orgs/${f.orgId}/members/${ownerMemberId}`, {
            method: "DELETE",
            headers: { cookie: await f.cookiesFor(actor) },
          });
          expect(res.status).toBe(403);
        }
        const row = await db.execute<{ deleted_at: string | null }>(
          sql`SELECT deleted_at FROM organization_members WHERE id = ${ownerMemberId}`,
        );
        expect((row as any).rows[0].deleted_at).toBeNull();
      });
    });

    test("a manager cannot remove an admin or a fellow manager; a creator lacks the ability entirely", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db, ["admin", "manager", "creator", "viewer"]);
        const uid = crypto.randomUUID().slice(0, 8);
        const peer = await createTestUser(db, { email: `manager2-${uid}@example.com` });
        const peerMember = await addMemberWithRole(db, {
          organizationId: f.orgId,
          userId: peer.id,
          roleCode: "manager",
        });

        const del = async (actorEmail: string, memberId: string) =>
          (
            await f.app.request(`/api/orgs/${f.orgId}/members/${memberId}`, {
              method: "DELETE",
              headers: { cookie: await f.cookiesFor(actorEmail) },
            })
          ).status;

        expect(await del(f.u("manager").email, f.u("admin").memberId)).toBe(403);
        expect(await del(f.u("manager").email, peerMember.id)).toBe(403);
        expect(await del(f.u("creator").email, f.u("viewer").memberId)).toBe(403); // no members.delete
        expect(await del(f.u("manager").email, f.u("viewer").memberId)).toBe(204); // below Manager ✓
      });
    });

    test("DELETE /users/admin/:userId (account deletion by admin) is guarded the same way and no longer 500s", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db, ["admin", "creator"]);
        const del = async (actorEmail: string, userId: string) =>
          (
            await f.app.request(`/api/users/admin/${userId}`, {
              method: "DELETE",
              headers: { cookie: await f.cookiesFor(actorEmail) },
            })
          ).status;

        expect(await del(f.u("admin").email, f.owner.id)).toBe(403);
        expect(await del(f.u("admin").email, f.u("admin").id)).toBe(403);
        expect(await del(f.u("admin").email, f.u("creator").id)).toBe(204); // was 500 (F-21)

        const user = await db.execute<{ status: string; deleted_at: string | null }>(
          sql`SELECT status, deleted_at FROM users WHERE id = ${f.u("creator").id}`,
        );
        expect((user as any).rows[0].status).toBe("deleted");
        expect((user as any).rows[0].deleted_at).not.toBeNull();
      });
    });
  },
);
