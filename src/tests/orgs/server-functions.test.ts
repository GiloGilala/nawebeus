/**
 * TanStack Start Server Functions Tests — invitations and the team surface (NWB-P14.2).
 *
 * The four functions under test are the web half of the invitation flow: the two public ones the
 * `/invite` landing page needs (`getInvitationPreviewServerFn`, `acceptInvitationServerFn`) and the
 * two org-scoped reads the team screen needed and nothing provided
 * (`listPendingInvitationsServerFn`, `listAssignableRolesServerFn`).
 *
 * What this file proves that the service and route suites cannot:
 *
 * - **The public pair really is public.** No session, no 401 — the emailed token is the credential.
 *   A Server Function that quietly required a cookie would turn every invitation email into a
 *   sign-in loop, and nothing else in the suite would notice.
 * - **The rate limits are shared with HTTP, not duplicated.** Both surfaces spend from the same
 *   `rate_limits` keys, so moving a probe from `/api/auth/invitations/:token` to the Server Function
 *   does not buy a fresh budget. This is the property that makes the copied constants safe.
 * - **The role catalog is the ladder.** Each seat gets exactly the roles `assertRoleGrantAllowed`
 *   would let it grant — never `owner`, never a platform role — so a picker built from it cannot
 *   offer something the service will refuse.
 * - **No token material reaches the web.** The pending-invitations read is asserted free of the raw
 *   token, its hash and both column names.
 *
 * Isolation is `withTestDb` per test (the convention in this folder): invitations are unique on
 * (org, address) and rate-limit buckets are keyed per IP, so a shared transaction would couple tests
 * through data they are meant to create themselves.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import {
  acceptInvitationServerFn,
  getInvitationPreviewServerFn,
  inviteMemberServerFn,
  listAssignableRolesServerFn,
  listMembersServerFn,
  listPendingInvitationsServerFn,
  removeMemberServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
  setServerHeadersForTest,
} from "@/app/server-functions/helpers";
import { getConfig, loadConfig } from "@/lib/config";
import type { Db } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { signAccessToken } from "@/services/auth/jwt";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

/** A password that satisfies `src/lib/password.ts` and contains neither name nor address. */
const STRONG_PASSWORD = "Zephyr!Quartz#4412";
/** Mirrors `src/lib/tokens.ts`: 32 bytes, hex — what a prober would have to guess. */
const BOGUS_TOKEN = "a".repeat(64);
const CLIENT_IP = "203.0.113.7";

type Seats = Record<string, string>;

/** Fails when nothing threw, so a guard that stopped guarding cannot pass quietly. */
async function expectThrows(fn: () => Promise<unknown>, type: new (...args: never[]) => Error) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(type);
    return error as Error;
  }
  throw new Error(`expected ${type.name}, nothing was thrown`);
}

/**
 * An organization with all five seats signed in. `seats` holds a session cookie per role, so a test
 * switches identity by setting headers rather than by rebuilding the org.
 */
async function team(db: Db, orgName = "Invitation Org") {
  const ownerUser = await createTestUser(db, { firstName: "Team", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: ownerUser.id, name: orgName });
  const config = getConfig();
  const seats: Seats = {};
  const ids: Record<string, string> = { owner: ownerUser.id };

  for (const role of ["owner", "admin", "manager", "creator", "viewer"] as const) {
    const user =
      role === "owner" ? ownerUser : await createTestUser(db, { firstName: `Team_${role}` });
    ids[role] = user.id;
    await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode: role });
    seats[role] = `nawebeus_access=${encodeURIComponent(
      await signAccessToken(user.id, org.id, config.JWT_ACCESS_SECRET),
    )}`;
  }
  return { orgId: org.id, orgName, seats, ids };
}

/**
 * `withTestDb` plus the Server Function seams. Every test here calls Server Functions, and they read
 * their database from `setServerDbForTest` — without it they build a real pool outside this
 * transaction and see none of the rows the test just wrote.
 */
async function withServerFns<T>(fn: (ctx: { db: Db }) => Promise<T>): Promise<T> {
  return withTestDb(async (ctx) => {
    setServerDbForTest(ctx.db);
    try {
      return await fn(ctx);
    } finally {
      clearServerDbForTest();
      clearServerHeadersForTest();
    }
  });
}

function as(seats: Seats, role: string, headers: Record<string, string> = {}) {
  setServerHeadersForTest({ cookie: seats[role], ...headers });
}

/** One invitation, minted through the Server Function the screen actually calls. */
async function invite(seats: Seats, email: string, extra: Record<string, unknown> = {}) {
  as(seats, "manager");
  const result = (await inviteMemberServerFn({ data: { email, ...extra } })) as {
    memberId: string;
    email: string;
    invitationToken: string;
    expiresAt: string;
  };
  return result;
}

/**
 * Payload rejection. These look like they need no database, and they did until they were run: the
 * `createServerFn` shim in this repo is an isomorphic stub that does **not** run `.validator()`
 * before the handler (the real TanStack Start runtime does). So `data: {}` reaches the handler body,
 * which spends a rate-limit bucket against `getServerDb()` before anything parses the payload — and
 * without `setServerDbForTest` that is a real pool, so the bucket is **committed** to the shared
 * test database. One such row is enough to fail an unrelated exact-count assertion in
 * `src/tests/queue/jobs.test.ts` (the rate-limit reclaim job reports every expired bucket it can
 * see). Hence `withServerFns` here too, and hence this block now needs `DATABASE_URL`.
 *
 * The refusals themselves are still worth pinning: they prove the payload is rejected *somewhere*
 * fail-closed — by the service's own parse, since the shim will not do it — rather than reaching a
 * query with `token = undefined`.
 */
describe.skipIf(!hasDb())("Invitation Server Functions — payload rejection", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("the preview needs a token", async () => {
    await withServerFns(async () => {
      await expectThrows(() => getInvitationPreviewServerFn({ data: {} }), ValidationError);
      await expectThrows(
        () => getInvitationPreviewServerFn({ data: { token: "" } }),
        ValidationError,
      );
    });
  });

  test("accepting needs a token — the body alone is not an invitation", async () => {
    await withServerFns(async () => {
      await expectThrows(
        () =>
          acceptInvitationServerFn({
            data: { fullName: "No Token", password: STRONG_PASSWORD },
          }),
        ValidationError,
      );
    });
  });

  test("the org-scoped reads are 401 without a session", async () => {
    await withServerFns(async () => {
      await expectThrows(() => listPendingInvitationsServerFn({}), UnauthorizedError);
      await expectThrows(() => listAssignableRolesServerFn({}), UnauthorizedError);
    });
  });

  test("a Bearer token is refused — the web surface is session cookies only", async () => {
    await withServerFns(async () => {
      setServerHeadersForTest({ authorization: "Bearer an-api-key-shaped-string" });
      await expectThrows(() => listPendingInvitationsServerFn({}), UnauthorizedError);
    });
  });
});

describe.skipIf(!hasDb())("Invitation Server Functions — integration (with DB)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("the landing page's read is public: no session, real token, real preview", async () => {
    await withServerFns(async ({ db }) => {
      const { orgName, seats } = await team(db);
      const invited = await invite(seats, "newface@test.com");

      // The invitee has no account and no cookie — that is the whole point of the page.
      clearServerHeadersForTest();
      const { invitation } = (await getInvitationPreviewServerFn({
        data: { token: invited.invitationToken },
      })) as {
        invitation: {
          organizationName: string;
          invitedEmail: string;
          expiresAt: string | null;
          requiresAccountSetup: boolean;
        };
      };
      expect(invitation.organizationName).toBe(orgName);
      expect(invitation.invitedEmail).toBe("newface@test.com");
      expect(invitation.requiresAccountSetup).toBe(true);
      expect(invitation.expiresAt).toBeTruthy();
    });
  });

  test("a bogus token and a revoked token give the same answer", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const invited = await invite(seats, "revoked@test.com");

      as(seats, "manager");
      await removeMemberServerFn({ data: { memberId: invited.memberId } });

      clearServerHeadersForTest();
      const bogus = await expectThrows(
        () => getInvitationPreviewServerFn({ data: { token: BOGUS_TOKEN } }),
        NotFoundError,
      );
      const revoked = await expectThrows(
        () => getInvitationPreviewServerFn({ data: { token: invited.invitationToken } }),
        NotFoundError,
      );
      // Indistinguishable on purpose: a prober must not learn which of the three it was.
      expect(bogus.message).toBe(revoked.message);
      expect(bogus.message).toMatch(/no longer valid/i);
    });
  });

  test("accepting registers the invitee, verifies the address, and is single-use", async () => {
    await withServerFns(async ({ db }) => {
      const { orgId, seats } = await team(db);
      const invited = await invite(seats, "joiner@test.com");

      clearServerHeadersForTest();
      const { membership } = (await acceptInvitationServerFn({
        data: {
          token: invited.invitationToken,
          fullName: "Ada Joiner",
          password: STRONG_PASSWORD,
          termsAccepted: true,
          privacyAccepted: true,
        },
      })) as { membership: { newUser: boolean; organizationId: string; email: string } };

      expect(membership.newUser).toBe(true);
      expect(membership.organizationId).toBe(orgId);
      expect(membership.email).toBe("joiner@test.com");

      const rows = await db.execute(sql`
        SELECT email_verified, status, organization_id FROM users WHERE email = ${"joiner@test.com"}
      `);
      const user = (rows as unknown as { rows: Record<string, unknown>[] }).rows[0];
      // Accepting *is* the verification: the link proved they read the address's inbox.
      expect(user?.email_verified).toBe(true);
      expect(user?.status).toBe("active");
      expect(user?.organization_id).toBe(orgId);

      const second = await expectThrows(
        () =>
          acceptInvitationServerFn({
            data: {
              token: invited.invitationToken,
              fullName: "Ada Joiner",
              password: STRONG_PASSWORD,
              termsAccepted: true,
              privacyAccepted: true,
            },
          }),
        ConflictError,
      );
      expect(second.message).toMatch(/already been accepted/i);
    });
  });

  test("a new address without the registration details is refused field by field", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const invited = await invite(seats, "incomplete@test.com");

      clearServerHeadersForTest();
      const missing = await expectThrows(
        () => acceptInvitationServerFn({ data: { token: invited.invitationToken } }),
        ValidationError,
      );
      expect(missing.message).toMatch(/registration details/i);

      const weak = await expectThrows(
        () =>
          acceptInvitationServerFn({
            data: {
              token: invited.invitationToken,
              fullName: "Ada",
              password: "short",
              termsAccepted: true,
              privacyAccepted: true,
            },
          }),
        ValidationError,
      );
      expect(weak.message).toMatch(/complexity/i);
    });
  });

  test("an existing account confirms with no password, and lands in the member list", async () => {
    await withServerFns(async ({ db }) => {
      const { orgId, seats } = await team(db);
      const existing = await createTestUser(db, { firstName: "Already", lastName: "Here" });
      const address = `already.here+${crypto.randomUUID().slice(0, 6)}@test.com`;
      await db.execute(sql`UPDATE users SET email = ${address} WHERE id = ${existing.id}`);

      const invited = await invite(seats, address);
      clearServerHeadersForTest();
      const { membership } = (await acceptInvitationServerFn({
        data: { token: invited.invitationToken },
      })) as { membership: { newUser: boolean; userId?: string } };
      expect(membership.newUser).toBe(false);

      as(seats, "manager");
      const { members } = (await listMembersServerFn()) as {
        members: { email: string; status: string; organizationId: string }[];
      };
      const joined = members.find((member) => member.email === address);
      expect(joined?.status).toBe("active");
      expect(joined?.organizationId).toBe(orgId);
    });
  });

  test("resending mints a new token and kills the old link, leaving one pending row", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const first = await invite(seats, "resend@test.com");
      const second = await invite(seats, "resend@test.com");

      expect(second.invitationToken).not.toBe(first.invitationToken);
      expect(second.memberId).toBe(first.memberId); // the dedup path updates, it does not duplicate

      clearServerHeadersForTest();
      await expectThrows(
        () => getInvitationPreviewServerFn({ data: { token: first.invitationToken } }),
        NotFoundError,
      );
      const { invitation } = (await getInvitationPreviewServerFn({
        data: { token: second.invitationToken },
      })) as { invitation: { invitedEmail: string } };
      expect(invitation.invitedEmail).toBe("resend@test.com");

      as(seats, "manager");
      const { invitations } = (await listPendingInvitationsServerFn()) as {
        invitations: { email: string }[];
      };
      expect(invitations.filter((row) => row.email === "resend@test.com")).toHaveLength(1);
    });
  });

  test("an expired invitation is still listed, flagged, and cannot be accepted", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const invited = await invite(seats, "late@test.com");
      await db.execute(sql`
        UPDATE organization_members SET expires_at = now() - interval '1 hour'
        WHERE id = ${invited.memberId}
      `);

      as(seats, "manager");
      const { invitations } = (await listPendingInvitationsServerFn()) as {
        invitations: { email: string; expired: boolean; expiresAt: Date | null }[];
      };
      const row = invitations.find((entry) => entry.email === "late@test.com");
      // Listed rather than hidden: an operator who watches a row vanish cannot tell "nobody
      // accepted" from "I never sent it", and the fix for both is the same resend button.
      expect(row?.expired).toBe(true);

      clearServerHeadersForTest();
      const expired = await expectThrows(
        () => getInvitationPreviewServerFn({ data: { token: invited.invitationToken } }),
        NotFoundError,
      );
      expect(expired.message).toMatch(/expired/i);
    });
  });

  test("the pending list carries no token material", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const invited = await invite(seats, "leaky@test.com", {
        roleId: undefined,
        displayName: "Leak Test",
        invitationNote: "check the panel",
      });

      as(seats, "manager");
      const { invitations } = (await listPendingInvitationsServerFn()) as {
        invitations: Record<string, unknown>[];
      };
      const serialized = JSON.stringify(invitations);
      expect(invitations.length).toBeGreaterThan(0);
      expect(serialized).not.toContain(invited.invitationToken);
      expect(serialized).not.toContain("invitation_token");
      expect(serialized).not.toContain("invitationToken");
      // The panel's own fields are present, so this is not passing on an empty projection.
      const row = invitations[0];
      expect(row?.email).toBe("leaky@test.com");
      expect(row?.roleName).toBeTruthy();
      expect(row?.hasAccount).toBe(false);
      expect(row?.invitationNote).toBe("check the panel");
      expect(row?.expiresAt).toBeInstanceOf(Date);
    });
  });

  test("the catalog is the ladder: each seat may grant exactly what the policy allows", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const codesFor = async (role: string) => {
        as(seats, role);
        const catalog = (await listAssignableRolesServerFn()) as {
          roles: { code: string; level: number; isCustom: boolean }[];
          actor: { code: string | null; level: number };
        };
        return { codes: catalog.roles.map((entry) => entry.code), actor: catalog.actor };
      };

      const owner = await codesFor("owner");
      expect(owner.actor.code).toBe("owner");
      // Admin…Viewer, highest first. Never owner (BR-AUTH-031) and never the platform role.
      expect(owner.codes).toEqual(["admin", "manager", "creator", "analyst", "viewer"]);

      const admin = await codesFor("admin");
      expect(admin.codes).toEqual(["manager", "creator", "analyst", "viewer"]);

      const manager = await codesFor("manager");
      expect(manager.codes).toEqual(["creator", "analyst", "viewer"]);

      // creator/analyst/viewer hold no roles.read, so the picker is not merely short — it is absent.
      for (const role of ["creator", "viewer"]) {
        as(seats, role);
        await expectThrows(() => listAssignableRolesServerFn(), ForbiddenError);
      }
    });
  });

  test("invitations and the catalog are manager+; the member list is not", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      await invite(seats, "gated@test.com");

      for (const role of ["creator", "viewer"]) {
        as(seats, role);
        await expectThrows(() => listPendingInvitationsServerFn(), ForbiddenError);
        await expectThrows(() => listAssignableRolesServerFn(), ForbiddenError);
        // F-P14.2-1, asserted rather than assumed: the members list has no ability check at all,
        // mirroring its Hono route. If that ever tightens, this line is the one that notices.
        const { members } = (await listMembersServerFn()) as { members: unknown[] };
        expect(members.length).toBeGreaterThan(0);
      }

      as(seats, "admin");
      const { invitations } = (await listPendingInvitationsServerFn()) as {
        invitations: { email: string }[];
      };
      expect(invitations.some((row) => row.email === "gated@test.com")).toBe(true);
    });
  });

  test("web and HTTP spend one rate-limit budget, not one each", async () => {
    await withServerFns(async ({ db }) => {
      await team(db);
      const app = createTestApp(db);

      // Same client IP on both surfaces, so both write the same `invite:validate:<ip>` key.
      setServerHeadersForTest({ xForwardedFor: CLIENT_IP });
      let rateLimited: Error | null = null;
      for (let attempt = 0; attempt < 25 && !rateLimited; attempt++) {
        try {
          await getInvitationPreviewServerFn({ data: { token: BOGUS_TOKEN } });
        } catch (error) {
          // A bogus token answers 404 until the budget runs out — that is the probing the limit
          // exists to stop, so it is the expected result of every attempt before the 21st.
          if (error instanceof RateLimitError) rateLimited = error;
          else if (!(error instanceof NotFoundError)) throw error;
        }
      }
      expect(rateLimited).toBeInstanceOf(RateLimitError);
      expect((rateLimited as unknown as { statusCode?: number }).statusCode).toBe(429);

      // The Server Function spent the shared budget, so HTTP is now refused too — the property that
      // makes copying the constants safe instead of merely convenient.
      const overHttp = await app.request("/api/auth/invitations/" + BOGUS_TOKEN, {
        headers: { "x-forwarded-for": CLIENT_IP },
      });
      expect(overHttp.status).toBe(429);

      // A different client IP is unaffected: the bucket is per address, not global.
      const otherIp = await app.request(`/api/auth/invitations/${BOGUS_TOKEN}`, {
        headers: { "x-forwarded-for": "198.51.100.9" },
      });
      expect(otherIp.status).toBe(404);
      clearServerHeadersForTest();
    });
  });

  test("accept attempts are budgeted per token, so one bad link cannot lock out another", async () => {
    await withServerFns(async ({ db }) => {
      const { seats } = await team(db);
      const invited = await invite(seats, "budget@test.com");
      setServerHeadersForTest({ xForwardedFor: CLIENT_IP });

      const otherToken = `${"b".repeat(16)}${"0".repeat(48)}`;
      let rateLimited = false;
      for (let attempt = 0; attempt < 15 && !rateLimited; attempt++) {
        try {
          await acceptInvitationServerFn({ data: { token: otherToken } });
        } catch (error) {
          if (error instanceof RateLimitError) rateLimited = true;
          else if (!(error instanceof NotFoundError)) throw error;
        }
      }
      // The key carries the token's first 16 characters, so hammering one link leaves the real
      // invitation's own budget untouched — the invitee is not locked out by a prober.
      expect(rateLimited).toBe(true);
      const { invitation } = (await getInvitationPreviewServerFn({
        data: { token: invited.invitationToken },
      })) as { invitation: { invitedEmail: string } };
      expect(invitation.invitedEmail).toBe("budget@test.com");
      clearServerHeadersForTest();
    });
  });

  test("another organization sees none of it, and cannot revoke what is not its own", async () => {
    await withServerFns(async ({ db }) => {
      const first = await team(db, "First Org");
      const invited = await invite(first.seats, "cross@test.com");
      const second = await team(db, "Second Org");

      as(second.seats, "manager");
      const { invitations } = (await listPendingInvitationsServerFn()) as {
        invitations: { email: string }[];
      };
      expect(invitations.some((row) => row.email === "cross@test.com")).toBe(false);

      // Revoking another org's invitation is a 404, not a 403: a cross-tenant id must not be
      // distinguishable from a missing one.
      await expectThrows(
        () => removeMemberServerFn({ data: { memberId: invited.memberId } }),
        NotFoundError,
      );

      // The public preview still answers — correctly. The token is the credential and the invitee
      // has no relationship with any organization; tenant-scoping this read would break the flow.
      clearServerHeadersForTest();
      const { invitation } = (await getInvitationPreviewServerFn({
        data: { token: invited.invitationToken },
      })) as { invitation: { organizationName: string } };
      expect(invitation.organizationName).toBe("First Org");
    });
  });
});
