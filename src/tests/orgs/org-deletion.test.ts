/**
 * Organization deletion — PRD 8.2.1 (P0), D-14, NWB-P0-023.
 *
 * The ticket says to mirror the account-deletion pattern and to read F-24/F-25
 * first. Those two defects are the reason this file leans on a live database for
 * everything that touches a column: F-24 was an entire service referencing a
 * column that did not exist, shipped green because the only tests for it covered
 * the two unauthenticated 401 paths. So the lifecycle here is exercised
 * end to end — delete, cascade, reactivate, expire, purge — not stubbed.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { signup } from "../../services/auth/signup";
import { verifyEmail } from "../../services/auth/verification";
import {
  deleteOrganization,
  getOrgDeletionStatus,
  purgeExpiredOrganizations,
  reactivateOrganization,
} from "../../services/orgs/org-deletion.service";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestUser, TEST_USER_PASSWORD } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Organization deletion routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("DELETE /api/orgs/:orgId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("POST /api/orgs/:orgId/reactivate without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/orgs/org-123/reactivate", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

/** Owner + one admin member, signed in, with an active API key and session. */
async function buildOrg(db: Db) {
  const uid = crypto.randomUUID().slice(0, 8);
  const app = createTestApp(db);

  const created = await signup(db, {
    email: `orgowner-${uid}@example.com`,
    password: TEST_USER_PASSWORD,
    fullName: "Org Owner",
    organizationName: `Deletable Org ${uid}`,
    termsAccepted: true,
    privacyAccepted: true,
  } as any);
  const orgId = created.organization.id as string;
  const ownerId = created.user.id as string;
  // The owner acts through the API below; an unverified owner is refused at the door (NWB-P1-004).
  await verifyEmail(db, created.emailVerificationToken);

  const member = await createTestUser(db, { email: `orgmember-${uid}@example.com` });
  await addMemberWithRole(db, { organizationId: orgId, userId: member.id, roleCode: "admin" });

  const cookiesFor = async (email: string) => {
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
    });
    if (res.status !== 200) throw new Error(`signin for ${email} failed: ${res.status}`);
    return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  };

  return {
    app,
    orgId,
    owner: { id: ownerId, email: created.user.email as string },
    member: { id: member.id, email: member.email },
    cookiesFor,
  };
}

const orgRow = async (db: Db, orgId: string) => {
  const rows = await db.execute(
    sql`SELECT status, is_active, deleted_at, deleted_by, deletion_reason, scheduled_deletion_at
        FROM organizations WHERE id = ${orgId} LIMIT 1`,
  );
  return (rows as any).rows?.[0] as any;
};

const countWhere = async (db: Db, q: ReturnType<typeof sql>) => {
  const rows = await db.execute<{ n: number }>(q);
  return Number((rows as any).rows?.[0]?.n ?? 0);
};

/** Move an org's scheduled purge into the past, simulating an elapsed grace period. */
const expireGrace = (db: Db, orgId: string) =>
  db.execute(
    sql`UPDATE organizations SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${orgId}`,
  );

describe.skipIf(!hasDb())("Organization deletion — service + routes (with DB)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("owner deletes: 30-day grace recorded, members deactivated, keys revoked, sessions killed, audited", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      const cookie = await f.cookiesFor(f.owner.email);

      // An active API key and a live member session, so the cascades have
      // something real to act on rather than passing vacuously.
      const keyRes = await f.app.request("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ name: `key-${crypto.randomUUID().slice(0, 8)}` }),
      });
      expect(keyRes.status).toBe(201);
      await f.cookiesFor(f.member.email); // member now holds a session row

      const before = Date.now();
      const res = await f.app.request(`/api/orgs/${f.orgId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ reason: "shutting down" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const scheduled = Date.parse(body.data.organization.scheduledDeletionAt);
      // 30 days out, allowing a generous window for slow CI.
      const days = (scheduled - before) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);

      const org = await orgRow(db, f.orgId);
      expect(org.status).toBe("deleted");
      expect(org.is_active).toBe(false);
      expect(org.deleted_at).not.toBeNull();
      expect(org.deleted_by).toBe(f.owner.id);
      expect(org.deletion_reason).toBe("shutting down");

      // Cascades.
      const activeMembers = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM organization_members
            WHERE organization_id = ${f.orgId} AND status = 'active'`,
      );
      expect(activeMembers).toBe(0);

      const activeKeys = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM api_keys
            WHERE organization_id = ${f.orgId} AND status = 'active'`,
      );
      expect(activeKeys).toBe(0);

      const liveSessions = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM sessions
            WHERE is_revoked = false AND user_id IN (${f.owner.id}, ${f.member.id})`,
      );
      expect(liveSessions).toBe(0);

      const audit = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM unified_audit_log
            WHERE action = 'organization.deleted' AND resource_id = ${f.orgId}`,
      );
      expect(audit).toBe(1);
    });
  });

  test("after deletion every member is locked out, and the org disappears from listUserOrgs", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      const memberCookie = await f.cookiesFor(f.member.email);

      // Baseline: the member can work and can see the org.
      expect(
        (await f.app.request("/api/users/me", { headers: { cookie: memberCookie } })).status,
      ).toBe(200);

      await deleteOrganization(db, f.orgId, f.owner.id);

      // Every route is closed: the membership is no longer active, so
      // `assertActivePrincipal` refuses before any handler runs. The old cookie
      // is dead too (sessions were revoked), so this is checked with a fresh one.
      const freshCookie = await f.cookiesFor(f.member.email);
      const members = await f.app.request(`/api/orgs/${f.orgId}/members`, {
        headers: { cookie: freshCookie },
      });
      expect(members.status).toBe(403);

      const { listUserOrgs } = await import("../../services/orgs/org.service");
      expect(await listUserOrgs(db, f.member.id)).toEqual([]);
      expect(await listUserOrgs(db, f.owner.id)).toEqual([]);
    });
  });

  test("a non-owner cannot delete the organization, even an admin who can update it", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      const memberCookie = await f.cookiesFor(f.member.email);

      // The same admin *can* update the org — proving the 403 below is about
      // ownership, not a blanket lack of access to this organization.
      const update = await f.app.request(`/api/orgs/${f.orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: memberCookie },
        body: JSON.stringify({ displayName: "Renamed By Admin" }),
      });
      expect(update.status).toBe(200);

      const res = await f.app.request(`/api/orgs/${f.orgId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", cookie: memberCookie },
        body: "{}",
      });
      expect(res.status).toBe(403);
      expect((await orgRow(db, f.orgId)).deleted_at).toBeNull();
    });
  });

  test("deleting twice is a 409, not a second grace window", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      await deleteOrganization(db, f.orgId, f.owner.id);
      const first = await orgRow(db, f.orgId);

      await expect(deleteOrganization(db, f.orgId, f.owner.id)).rejects.toMatchObject({
        statusCode: 409,
      });

      // The original schedule is intact — a repeated call must not silently
      // extend the window the user was promised.
      const second = await orgRow(db, f.orgId);
      expect(String(second.scheduled_deletion_at)).toBe(String(first.scheduled_deletion_at));
    });
  });

  test("reactivation within the grace window restores the org, its members and its keys", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      const cookie = await f.cookiesFor(f.owner.email);
      const keyRes = await f.app.request("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ name: `key-${crypto.randomUUID().slice(0, 8)}` }),
      });
      expect(keyRes.status).toBe(201);

      await deleteOrganization(db, f.orgId, f.owner.id, { reason: "changed my mind" });

      const res = await f.app.request(`/api/orgs/${f.orgId}/reactivate`, {
        method: "POST",
        headers: { cookie: await f.cookiesFor(f.owner.email) },
      });
      expect(res.status).toBe(200);

      const org = await orgRow(db, f.orgId);
      expect(org.status).toBe("active");
      expect(org.is_active).toBe(true);
      expect(org.deleted_at).toBeNull();
      expect(org.scheduled_deletion_at).toBeNull();
      expect(org.deletion_reason).toBeNull();

      const activeMembers = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM organization_members
            WHERE organization_id = ${f.orgId} AND status = 'active'`,
      );
      expect(activeMembers).toBe(2);

      const activeKeys = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM api_keys
            WHERE organization_id = ${f.orgId} AND status = 'active'`,
      );
      expect(activeKeys).toBe(1);

      // The member can work again, and the org is visible once more.
      const memberCookie = await f.cookiesFor(f.member.email);
      expect(
        (await f.app.request(`/api/orgs/${f.orgId}/members`, { headers: { cookie: memberCookie } }))
          .status,
      ).toBe(200);

      const audit = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM unified_audit_log
            WHERE action = 'organization.reactivated' AND resource_id = ${f.orgId}`,
      );
      expect(audit).toBe(1);
    });
  });

  test("reactivation does NOT resurrect revoked sessions", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      await f.cookiesFor(f.member.email);

      await deleteOrganization(db, f.orgId, f.owner.id);
      await reactivateOrganization(db, f.orgId, f.owner.id);

      // A revoked session is a credential that may have leaked during the
      // deleted window; members sign in again rather than have it un-revoked.
      const live = await countWhere(
        db,
        sql`SELECT COUNT(*)::int AS n FROM sessions
            WHERE is_revoked = false AND user_id IN (${f.owner.id}, ${f.member.id})`,
      );
      expect(live).toBe(0);
    });
  });

  test("reactivation after the grace period has expired is refused", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      await deleteOrganization(db, f.orgId, f.owner.id);
      await expireGrace(db, f.orgId);

      await expect(reactivateOrganization(db, f.orgId, f.owner.id)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect((await orgRow(db, f.orgId)).deleted_at).not.toBeNull();
    });
  });

  test("a non-owner cannot reactivate", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      await deleteOrganization(db, f.orgId, f.owner.id);

      await expect(reactivateOrganization(db, f.orgId, f.member.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  test("purge removes only organizations whose grace has expired", async () => {
    await withTestDb(async ({ db }) => {
      const expired = await buildOrg(db);
      const withinGrace = await buildOrg(db);
      const untouched = await buildOrg(db);

      await deleteOrganization(db, expired.orgId, expired.owner.id);
      await deleteOrganization(db, withinGrace.orgId, withinGrace.owner.id);
      await expireGrace(db, expired.orgId);

      const purged = await purgeExpiredOrganizations(db);
      expect(purged.deleted).toBeGreaterThanOrEqual(1);
      expect(purged.failed).toBe(0);

      const stillThere = async (orgId: string) =>
        (await countWhere(
          db,
          sql`SELECT COUNT(*)::int AS n FROM organizations WHERE id = ${orgId}`,
        )) === 1;

      expect(await stillThere(expired.orgId)).toBe(false);
      expect(await stillThere(withinGrace.orgId)).toBe(true);
      expect(await stillThere(untouched.orgId)).toBe(true);
    });
  });

  test("the purge completes instead of dying on a foreign key — the F-25 class does not repeat here", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      const cookie = await f.cookiesFor(f.owner.email);
      // Rows on every CASCADE/SET NULL edge that references organizations.id:
      // an API key, two memberships, two users homed to the org, and a session.
      const keyRes = await f.app.request("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ name: `key-${crypto.randomUUID().slice(0, 8)}` }),
      });
      expect(keyRes.status).toBe(201);

      await deleteOrganization(db, f.orgId, f.owner.id);
      await expireGrace(db, f.orgId);

      // `purgeExpiredAccounts` could not do this for an owner (F-25) — a
      // restrictive FK refused and the whole statement aborted (per-row since
      // NWB-P1-013). Every FK to organizations.id is CASCADE or SET NULL, so
      // this must simply succeed.
      const orgPurge = await purgeExpiredOrganizations(db);
      expect(orgPurge.deleted).toBeGreaterThanOrEqual(1);
      expect(orgPurge.failed).toBe(0);

      expect(
        await countWhere(
          db,
          sql`SELECT COUNT(*)::int AS n FROM organizations WHERE id = ${f.orgId}`,
        ),
      ).toBe(0);
      expect(
        await countWhere(
          db,
          sql`SELECT COUNT(*)::int AS n FROM organization_members WHERE organization_id = ${f.orgId}`,
        ),
      ).toBe(0);
      expect(
        await countWhere(
          db,
          sql`SELECT COUNT(*)::int AS n FROM api_keys WHERE organization_id = ${f.orgId}`,
        ),
      ).toBe(0);

      // The people survive the workspace: users are detached, not deleted.
      // Cascade-deleting members with the org is the mistake F-25's option 1
      // was rejected for.
      const users = await db.execute<{ id: string; organization_id: string | null }>(
        sql`SELECT id, organization_id FROM users WHERE id IN (${f.owner.id}, ${f.member.id})`,
      );
      const rows = (users as any).rows as { id: string; organization_id: string | null }[];
      expect(rows).toHaveLength(2);
      for (const r of rows) expect(r.organization_id).toBeNull();
    });
  });

  test("getOrgDeletionStatus reports a parseable ISO instant, not the raw timestamptz text (F-24 class)", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);

      const before = await getOrgDeletionStatus(db, f.orgId);
      expect(before).toEqual({ deleted: false, scheduledDeletionAt: null });

      const { scheduledDeletionAt } = await deleteOrganization(db, f.orgId, f.owner.id);
      const after = await getOrgDeletionStatus(db, f.orgId);

      expect(after.deleted).toBe(true);
      expect(after.scheduledDeletionAt).not.toBeNull();
      // Must round-trip through Date — the bug this guards against returned
      // "2026-10-20 17:24:06.801+00", which new Date() rejects as Invalid Date.
      expect(Number.isNaN(Date.parse(after.scheduledDeletionAt as string))).toBe(false);
      // The service's return value and the read-back must agree to the second.
      expect(
        Math.abs(Date.parse(after.scheduledDeletionAt as string) - Date.parse(scheduledDeletionAt)),
      ).toBeLessThan(1000);
    });
  });

  test("deleting an organization that does not exist is a 404", async () => {
    await withTestDb(async ({ db }) => {
      const f = await buildOrg(db);
      await expect(deleteOrganization(db, crypto.randomUUID(), f.owner.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe.skipIf(!hasDb())(
  "Organization reactivation — the membership escape hatch stays narrow (with DB)",
  () => {
    beforeAll(() => {
      loadConfig();
    });

    test("it does not weaken user-status enforcement: a suspended user is still refused (F-05)", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db);
        const cookie = await f.cookiesFor(f.owner.email);
        await deleteOrganization(db, f.orgId, f.owner.id);
        await db.execute(sql`UPDATE users SET status = 'suspended' WHERE id = ${f.owner.id}`);

        const res = await f.app.request(`/api/orgs/${f.orgId}/reactivate`, {
          method: "POST",
          headers: { cookie },
        });
        // 403 ACCOUNT_SUSPENDED from assertAccountCanAuthenticate, not a 200.
        expect(res.status).toBe(403);
        expect((await orgRow(db, f.orgId)).deleted_at).not.toBeNull();
      });
    });

    test("it does not weaken soft-delete enforcement: a deleted account is still refused", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db);
        const cookie = await f.cookiesFor(f.owner.email);
        await deleteOrganization(db, f.orgId, f.owner.id);
        await db.execute(sql`UPDATE users SET deleted_at = now() WHERE id = ${f.owner.id}`);

        const res = await f.app.request(`/api/orgs/${f.orgId}/reactivate`, {
          method: "POST",
          headers: { cookie },
        });
        expect(res.status).toBe(401);
      });
    });

    test("it does not admit a non-member: someone with no membership row is still 403", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db);
        await deleteOrganization(db, f.orgId, f.owner.id);

        // An outsider whose JWT names this org (forged or stale) has no
        // membership row at all — the relaxed check looks for *a* row, not
        // merely an active one, so they are still refused.
        const outsider = await createTestUser(db, {
          email: `outsider-${crypto.randomUUID().slice(0, 8)}@example.com`,
          organizationId: f.orgId,
        });
        const res = await f.app.request("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: outsider.email, password: TEST_USER_PASSWORD }),
        });
        const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

        const attempt = await f.app.request(`/api/orgs/${f.orgId}/reactivate`, {
          method: "POST",
          headers: { cookie },
        });
        expect(attempt.status).toBe(403);

        // Asserting the *message* matters: both the middleware and the
        // service's owner check answer 403 here, so a bare status assertion
        // would pass even if the middleware stopped checking membership
        // altogether (verified by sabotage — dropping the membership
        // requirement left a status-only assertion green). The middleware must
        // be the layer that refuses.
        expect((await attempt.json()).error.message).toMatch(/not a member of this organization/i);
        expect((await orgRow(db, f.orgId)).deleted_at).not.toBeNull();
      });
    });

    test("every OTHER route still requires an ACTIVE membership after deletion", async () => {
      await withTestDb(async ({ db }) => {
        const f = await buildOrg(db);
        await deleteOrganization(db, f.orgId, f.owner.id);
        const cookie = await f.cookiesFor(f.owner.email);

        // The opt-out is wired to exactly one route. The owner holds a
        // (suspended) membership, so if the relaxation had leaked into the
        // shared middleware these would answer 200.
        for (const path of [
          `/api/orgs/${f.orgId}`,
          `/api/orgs/${f.orgId}/members`,
          "/api/api-keys",
        ]) {
          const res = await f.app.request(path, { headers: { cookie } });
          expect(res.status).toBe(403);
        }
      });
    });
  },
);

describe.skipIf(!hasDb())("D16 interaction — org deletion vs. account deletion (with DB)", () => {
  beforeAll(() => {
    loadConfig();
  });

  /**
   * NWB-P0-025 left an accepted consequence: signup creates a personal
   * organization owned by the user, so `deleteAccount` always 409s with
   * OWNERSHIP_TRANSFER_REQUIRED and a normally-registered user could never
   * complete account deletion. That ticket asked NWB-P0-023 to "relax the gate
   * for sole-member organizations once it can delete them safely".
   *
   * Measured rather than assumed, and the answer is **do not relax it**: the
   * gate exists because `organizations.owner_id` is a restrictive NOT NULL FK,
   * and a *soft*-deleted organization still holds that reference. Allowing an
   * owner of a soft-deleted org through the gate reintroduces F-25's 23503
   * verbatim at purge time — verified by direct experiment. The unblock is the
   * hard purge, not the soft delete.
   */
  test("the D16 gate is unblocked by the PURGE, not by the soft delete", async () => {
    await withTestDb(async ({ db }) => {
      const { deleteAccount, purgeExpiredAccounts } = await import(
        "../../services/users/account-deletion.service"
      );
      const f = await buildOrg(db);

      // Soft delete alone: still refused, and rightly so.
      await deleteOrganization(db, f.orgId, f.owner.id);
      await expect(deleteAccount(db, f.owner.id)).rejects.toMatchObject({
        code: "OWNERSHIP_TRANSFER_REQUIRED",
      });

      // After the grace period elapses and the organization is really gone,
      // the owner owns nothing and erasure proceeds end to end.
      await expireGrace(db, f.orgId);
      const orgPurge = await purgeExpiredOrganizations(db);
      expect(orgPurge.deleted).toBeGreaterThanOrEqual(1);
      expect(orgPurge.failed).toBe(0);

      await expect(deleteAccount(db, f.owner.id)).resolves.toMatchObject({
        scheduledDeletionAt: expect.any(String),
      });

      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${f.owner.id}`,
      );
      // The F-25 failure mode would surface here as a 23503 in `failed`; it must not.
      const accountPurge = await purgeExpiredAccounts(db);
      expect(accountPurge.deleted).toBeGreaterThanOrEqual(1);
      expect(accountPurge.failed).toBe(0);
    });
  });

  test("relaxing the gate to accept soft-deleted orgs would resurrect F-25 (negative control)", async () => {
    await withTestDb(async ({ db }) => {
      const { purgeExpiredAccounts } = await import(
        "../../services/users/account-deletion.service"
      );
      const f = await buildOrg(db);
      await deleteOrganization(db, f.orgId, f.owner.id);

      // Bypass the gate exactly as a "relaxed for sole-member orgs" version
      // would, by soft-deleting the account directly.
      await db.execute(
        sql`UPDATE users
            SET deleted_at = now(),
                scheduled_deletion_at = now() - interval '1 day',
                status = 'suspended'
            WHERE id = ${f.owner.id}`,
      );

      // The refusal is per-row since NWB-P1-013: the purge resolves, deletes
      // nothing, and reports the 23503 on organizations_owner_id_users_id_fk in
      // `errors` — the precise defect F-25 described, still present, still the
      // reason the gate stays as D16 decided it.
      const result = await purgeExpiredAccounts(db);
      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.id).toBe(f.owner.id);
      expect(result.errors[0]?.error).toMatch(/23503|owner_id/i);
    });
  });
});
