import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "../../lib/config";
import { signIn } from "../../services/auth/auth.service";
import { signAccessToken } from "../../services/auth/jwt";
import { acceptInvitation, inviteMember } from "../../services/orgs/invitation.service";
import { listMembers } from "../../services/orgs/member.service";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const TEST_PASSWORD = "TestPassword123!";

/** An org with an active owner, plus the owner cookie for route-level checks. */
async function ownerOrg(db: Parameters<typeof createTestUser>[0]) {
  const owner = await createTestUser(db);
  const orgName = "Owner Org";
  const org = await createTestOrg(db, { ownerId: owner.id, name: orgName });
  await addMemberWithRole(db, {
    organizationId: org.id,
    userId: owner.id,
    roleCode: "owner",
  });
  await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${owner.id}`);
  const token = await signAccessToken(owner.id, org.id, getConfig().JWT_ACCESS_SECRET);
  return {
    owner,
    org,
    orgName,
    cookie: `nawebeus_access=${encodeURIComponent(token)}`,
  };
}

const memberRow = (db: Parameters<typeof createTestUser>[0], memberId: string) =>
  db.execute<Record<string, unknown>>(
    sql`SELECT user_id, role_id, status, is_active, invited_email, invitation_token, invitation_token_hash, accepted_at
        FROM organization_members WHERE id = ${memberId}`,
  );
// biome-ignore lint/suspicious/noExplicitAny: test rows are read dynamically throughout
const rowOf = (rows: unknown): any => (rows as any).rows?.[0];

describe.skipIf(!hasDb())("Invitation accept flow (F-08 / NWB-P0-016)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("GET /api/auth/invitations/:token validates and previews org + account requirement", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { owner, org, orgName } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "newface@test.com" });

      const bad = await app.request("/api/auth/invitations/not-a-real-token");
      expect(bad.status).toBe(404);
      expect(((await bad.json()) as any).error.message).toMatch(/no longer valid/i);

      const res = await app.request(`/api/auth/invitations/${invite.invitationToken}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.invitation.organizationName).toBe(orgName);
      expect(json.data.invitation.invitedEmail).toBe("newface@test.com");
      expect(json.data.invitation.requiresAccountSetup).toBe(true);
    });
  });

  test("new user registers into the org: account, role, active membership, verification token, sign-in", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const adminRole = await db.execute<{ id: string }>(
        sql`SELECT id FROM roles WHERE code = 'admin' AND organization_id IS NULL AND deleted_at IS NULL LIMIT 1`,
      );
      const adminRoleId = rowOf(adminRole).id as string;
      const invite = await inviteMember(db, org.id, owner.id, {
        email: "signup-via-invite@test.com",
        roleId: adminRoleId,
      });

      const result = await acceptInvitation(db, {
        token: invite.invitationToken,
        password: TEST_PASSWORD,
        fullName: "Invite Signup",
        termsAccepted: true,
        privacyAccepted: true,
      });

      expect(result.newUser).toBe(true);
      expect(result.roleId).toBe(adminRoleId);

      const member = rowOf(await memberRow(db, invite.memberId));
      expect(member.status).toBe("active");
      expect(member.is_active).toBe(true);
      expect(member.user_id).toBe(result.userId);
      // Single-use hygiene: the raw token is gone; the hash remains for the 409 path.
      expect(member.invitation_token).toBeNull();
      expect(member.invitation_token_hash).not.toBeNull();
      expect(member.accepted_at).not.toBeNull();

      const userRows = await db.execute<{ organization_id: string; status: string }>(
        sql`SELECT organization_id, status FROM users WHERE id = ${result.userId}`,
      );
      expect(rowOf(userRows).organization_id).toBe(org.id); // single-org model
      expect(rowOf(userRows).status).toBe("pending_verification");

      const tokenRows = await db.execute<{ id: string }>(
        sql`SELECT id FROM tokens WHERE user_id = ${result.userId} AND token_type = 'email_verification' AND status = 'active'`,
      );
      expect((tokenRows as unknown as { rows: unknown[] }).rows).toHaveLength(1);

      const auditRows = await db.execute<{ action: string }>(
        sql`SELECT action FROM unified_audit_log WHERE action = 'organization.member.accepted' AND resource_id = ${invite.memberId}`,
      );
      expect((auditRows as unknown as { rows: unknown[] }).rows).toHaveLength(1);

      // The invitee can sign in immediately (pending_verification is allowed),
      // landing in the inviting org (orgId derives from users.organization_id).
      const session = await signIn(db, "signup-via-invite@test.com", TEST_PASSWORD, {
        ip: "127.0.0.1-test-invite",
      });
      expect(session.orgId).toBe(org.id);
      expect(session.emailVerified).toBe(false);

      // Second accept of the same token → 409, not a silent re-activation.
      await expect(
        acceptInvitation(db, {
          token: invite.invitationToken,
          password: TEST_PASSWORD,
          fullName: "Invite Signup",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  test("new-user accept requires the registration fields and a compliant password", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "needs-fields@test.com" });

      const err = await acceptInvitation(db, { token: invite.invitationToken }).then(
        () => null,
        (e) => e as any,
      );
      expect(err?.statusCode).toBe(422);
      const fields = (err?.details ?? []).map((d: any) => d.field);
      expect(fields).toContain("password");
      expect(fields).toContain("fullName");
      expect(fields).toContain("termsAccepted");
      expect(fields).toContain("privacyAccepted");

      const weak = await acceptInvitation(db, {
        token: invite.invitationToken,
        password: "short",
        fullName: "Weak Pass",
        termsAccepted: true,
        privacyAccepted: true,
      }).then(
        () => null,
        (e) => e as any,
      );
      expect(weak?.statusCode).toBe(422);

      // Nothing was consumed: the token still accepts a valid retry.
      const ok = await acceptInvitation(db, {
        token: invite.invitationToken,
        password: TEST_PASSWORD,
        fullName: "Retry Works",
        termsAccepted: true,
        privacyAccepted: true,
      });
      expect(ok.newUser).toBe(true);
    });
  });

  test("expired token → 404 with the spec's expiration message", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "late@test.com" });
      await db.execute(
        sql`UPDATE organization_members SET expires_at = now() - interval '1 hour' WHERE id = ${invite.memberId}`,
      );

      await expect(
        acceptInvitation(db, {
          token: invite.invitationToken,
          password: TEST_PASSWORD,
          fullName: "Too Late",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toMatchObject({ statusCode: 404, message: expect.stringMatching(/expired/i) });
    });
  });

  test("revoked invitation (membership deleted) → 404 'no longer valid'", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "revoked@test.com" });
      await db.execute(
        sql`UPDATE organization_members SET deleted_at = now() WHERE id = ${invite.memberId}`,
      );

      await expect(
        acceptInvitation(db, {
          token: invite.invitationToken,
          password: TEST_PASSWORD,
          fullName: "Revoked Invite",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/no longer valid/i),
      });
    });
  });

  test("existing org-less account is linked and activated; primary org follows", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const invitee = await createTestUser(db); // account, but no organization
      const invite = await inviteMember(db, org.id, owner.id, { email: invitee.email });

      const result = await acceptInvitation(db, { token: invite.invitationToken });
      expect(result.newUser).toBe(false);
      expect(result.userId).toBe(invitee.id);

      const member = rowOf(await memberRow(db, invite.memberId));
      expect(member.status).toBe("active");
      expect(member.user_id).toBe(invitee.id);

      const userRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${invitee.id}`,
      );
      expect(rowOf(userRows).organization_id).toBe(org.id);
    });
  });

  test("existing account with a membership elsewhere → 409 (D14 single-org interim)", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      // A normally-registered user: owns their personal organization.
      const invitee = await createTestUser(db);
      const ownOrg = await createTestOrg(db, { ownerId: invitee.id });
      await addMemberWithRole(db, {
        organizationId: ownOrg.id,
        userId: invitee.id,
        roleCode: "owner",
      });

      const invite = await inviteMember(db, org.id, owner.id, { email: invitee.email });
      const err = await acceptInvitation(db, { token: invite.invitationToken }).then(
        () => null,
        (e) => e as any,
      );
      expect(err?.statusCode).toBe(409);
      expect(err?.message).toMatch(/another organization/i);

      // Nothing was re-homed: the invitee's primary org is untouched, and the
      // rollback undid the single-use claim — the invite stays pending, so the
      // admin can invite a different address and this one can still expire.
      const userRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${invitee.id}`,
      );
      expect(rowOf(userRows).organization_id).toBe(ownOrg.id);
      const member = rowOf(await memberRow(db, invite.memberId));
      expect(member.status).toBe("invited");
      expect(member.accepted_at).toBeNull();
    });
  });

  test("route: POST accept end-to-end and validation errors as 422 JSON", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { owner, org, orgName } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "route-accept@test.com" });

      const bad = await app.request(`/api/auth/invitations/${invite.invitationToken}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: "No Password" }),
      });
      expect(bad.status).toBe(422);
      expect(((await bad.json()) as any).error.code).toBe("VALIDATION_ERROR");

      const res = await app.request(`/api/auth/invitations/${invite.invitationToken}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: TEST_PASSWORD,
          fullName: "Route Accept",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.membership.status).toBe("active");
      expect(json.data.membership.organizationName).toBe(orgName);
      // The service-level verification token is not exposed by the route.
      expect(json.data.membership.emailVerificationToken).toBeUndefined();

      const replay = await app.request(`/api/auth/invitations/${invite.invitationToken}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: TEST_PASSWORD,
          fullName: "Route Accept",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      });
      expect(replay.status).toBe(409);
    });
  });

  test("invite enforces the role ladder (F-07 class): owner ungrantable, no self-outranking grants", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const roles = await db.execute<{ id: string; code: string }>(
        sql`SELECT id, code FROM roles WHERE code IN ('owner','admin','super_admin') AND organization_id IS NULL AND deleted_at IS NULL`,
      );
      const rows_ = (roles as unknown as { rows: Array<{ id: string; code: string }> }).rows;
      const byCode: Record<string, string> = {};
      for (const r of rows_) byCode[r.code] = r.id;

      await expect(
        inviteMember(db, org.id, owner.id, { email: "as-owner@test.com", roleId: byCode.owner }),
      ).rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/owner/i) });

      await expect(
        inviteMember(db, org.id, owner.id, {
          email: "as-super@test.com",
          roleId: byCode.super_admin,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        inviteMember(db, org.id, owner.id, {
          email: "bogus@test.com",
          roleId: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      // A manager cannot grant above their own tier (spec: "Manager invites
      // Admin" is refused).
      const manager = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      await expect(
        inviteMember(db, org.id, manager.id, {
          email: "m-invites-a@test.com",
          roleId: byCode.admin,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/below your own role/i),
      });

      // …but a manager inviting a creator is fine.
      const creatorRole = await db.execute<{ id: string }>(
        sql`SELECT id FROM roles WHERE code = 'creator' AND organization_id IS NULL AND deleted_at IS NULL LIMIT 1`,
      );
      const ok = await inviteMember(db, org.id, manager.id, {
        email: "m-invites-c@test.com",
        roleId: rowOf(creatorRole).id as string,
      });
      expect(ok.memberId).toBeTruthy();
    });
  });

  test("invite without roleId defaults to viewer, never a zero-permission member", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const viewer = await db.execute<{ id: string }>(
        sql`SELECT id FROM roles WHERE code = 'viewer' AND organization_id IS NULL AND deleted_at IS NULL LIMIT 1`,
      );
      const invite = await inviteMember(db, org.id, owner.id, { email: "default-role@test.com" });
      const member = rowOf(await memberRow(db, invite.memberId));
      expect(member.role_id).toBe(rowOf(viewer).id);

      const accepted = await acceptInvitation(db, {
        token: invite.invitationToken,
        password: TEST_PASSWORD,
        fullName: "Default Role",
        termsAccepted: true,
        privacyAccepted: true,
      });
      expect(accepted.roleId).toBe(rowOf(viewer).id);
    });
  });

  test("inviting an email that is already an active member → 409 (spec string)", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      await expect(
        inviteMember(db, org.id, owner.id, { email: owner.email }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/already a member of your organization/i),
      });
    });
  });

  test("repeat invite to the same email refreshes one row; the old token dies", async () => {
    await withTestDb(async ({ db }) => {
      const { owner, org } = await ownerOrg(db);
      const first = await inviteMember(db, org.id, owner.id, { email: "dupe@test.com" });
      const second = await inviteMember(db, org.id, owner.id, {
        email: "dupe@test.com",
        displayName: "Second Try",
      });

      expect(second.memberId).toBe(first.memberId);
      const pending = await db.execute<{ id: string }>(
        sql`SELECT id FROM organization_members WHERE organization_id = ${org.id} AND invited_email = 'dupe@test.com' AND status = 'invited' AND deleted_at IS NULL`,
      );
      expect((pending as unknown as { rows: unknown[] }).rows).toHaveLength(1);

      await expect(
        acceptInvitation(db, {
          token: first.invitationToken,
          password: TEST_PASSWORD,
          fullName: "Old Token",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      const ok = await acceptInvitation(db, {
        token: second.invitationToken,
        password: TEST_PASSWORD,
        fullName: "New Token",
        termsAccepted: true,
        privacyAccepted: true,
      });
      expect(ok.newUser).toBe(true);
    });
  });

  test("member list surfaces pending invites (LEFT JOIN; FR-AUTH-006 AC5) and via the route", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { owner, org, cookie } = await ownerOrg(db);
      await inviteMember(db, org.id, owner.id, { email: "pending-visible@test.com" });

      const members = (await listMembers(db, org.id)).items;
      const pending = members.find((m) => m.email === "pending-visible@test.com");
      expect(pending).toBeDefined();
      expect(pending?.status).toBe("invited");
      expect(pending?.userId).toBeNull();
      expect(pending?.username).toBeNull();

      const res = await app.request(`/api/orgs/${org.id}/members`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.members.some((m: any) => m.email === "pending-visible@test.com")).toBe(true);
    });
  });

  test("accept route rate-limits: budget exhaustion answers 429", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { owner, org } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: "limited@test.com" });

      let lastStatus = 0;
      for (let i = 0; i < 11; i++) {
        const res = await app.request(`/api/auth/invitations/${invite.invitationToken}/accept`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: "No Password" }), // 422, but consumes budget
        });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
