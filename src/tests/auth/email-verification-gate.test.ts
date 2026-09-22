/**
 * The verified-email gate — NWB-P1-004 decision 3, closing NWB-P0-015's Phase 1 note.
 *
 * `pending_verification` still signs in (that is pinned in `user-status.test.ts`), but from this
 * ticket on the session is *verification-limited*: 403 `EMAIL_NOT_VERIFIED` on every protected
 * route except the two families the verification screen needs — `/api/auth/*` and
 * `/api/users/me*`. Both auth branches gate (cookie and API key), the status is read from the row
 * on every request (verifying opens the gate for the session already held), and a verified account
 * never sees the code. The exempt-path predicate is pinned on its own because it is the entire
 * policy in one function.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import { isVerificationExemptPath } from "../../server/middleware/auth";
import { createApiKey } from "../../services/auth/api-key";
import { signAccessToken } from "../../services/auth/jwt";
import { signup } from "../../services/auth/signup";
import { verifyEmail } from "../../services/auth/verification";
import { type EmailMessage, emailService } from "../../services/email";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { TEST_USER_PASSWORD } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

type Db = Parameters<typeof signup>[0];

/** A brand-new account the way the product creates one: pending, with its verification token in hand. */
async function pendingSignup(db: Db) {
  const uid = crypto.randomUUID().slice(0, 8);
  const created = await signup(db, {
    email: `gate-${uid}@example.com`,
    password: TEST_USER_PASSWORD,
    fullName: "Gate Tester",
    organizationName: `Gate Org ${uid}`,
    termsAccepted: true,
    privacyAccepted: true,
  } as never);
  const token = await signAccessToken(
    created.user.id,
    created.organization.id,
    getConfig().JWT_ACCESS_SECRET,
  );
  return {
    userId: created.user.id as string,
    orgId: created.organization.id as string,
    email: created.user.email as string,
    verificationToken: created.emailVerificationToken,
    headers: { cookie: `nawebeus_access=${encodeURIComponent(token)}` },
  };
}

const errorCode = async (res: Response) =>
  ((await res.json()) as { error?: { code?: string } }).error?.code;

describe("isVerificationExemptPath", () => {
  test("auth and self-service are exempt; everything tenant-facing is gated", () => {
    for (const path of [
      "/api/auth/resend-verification",
      "/api/auth/verify-email",
      "/api/auth/signout",
      "/api/auth/sessions",
      "/api/auth/mfa/status",
      "/api/users/me",
      "/api/users/me/email-change",
      "/api/users/me/data-export/req_1",
    ]) {
      expect(isVerificationExemptPath(path), path).toBe(true);
    }
    for (const path of [
      "/api/orgs",
      "/api/orgs/org_1",
      "/api/orgs/org_1/members",
      "/api/api-keys",
      "/api/audit",
      "/api/approvals/inbox",
      "/api/users/admin",
      "/api/users/admin/usr_1",
      "/api/users/meow",
      "/api/auth",
      "/api/authority/anything",
    ]) {
      expect(isVerificationExemptPath(path), path).toBe(false);
    }
  });
});

describe.skipIf(!hasDb())("verified-email gate (NWB-P1-004)", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  test("the link the signup email carries verifies the account — end to end through the routes", async () => {
    // Regression pin for two bugs the gate exposed: the signup token row stored a 32-char
    // selector that `consumeToken` could never match, and `verifyEmail` updated a column
    // `users` does not have. Before NWB-P1-004 no signup link had ever been redeemed.
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const sent: EmailMessage[] = [];
      const spy = spyOn(emailService, "send").mockImplementation(async (message) => {
        sent.push(message);
        return { status: "sent", sent: true, messageId: "em_test", recipient: String(message.to) };
      });
      restore = () => spy.mockRestore();

      const uid = crypto.randomUUID().slice(0, 8);
      const email = `e2e-${uid}@example.com`;
      const signupRes = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: TEST_USER_PASSWORD,
          fullName: "End Toend",
          organizationName: `E2E Org ${uid}`,
          termsAccepted: true,
          privacyAccepted: true,
        }),
      });
      expect(signupRes.status).toBe(201);
      const orgId = ((await signupRes.json()) as { data: { organization: { id: string } } }).data
        .organization.id;

      expect(sent).toHaveLength(1);
      expect(sent[0]?.kind).toBe("verification");
      expect(sent[0]?.context?.organizationId).toBe(orgId);
      const link = /href="([^"]+)"/.exec(sent[0]!.html)?.[1] as string;
      const url = new URL(link);
      expect(url.pathname).toBe("/api/auth/verify-email");

      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
      });
      expect(signin.status).toBe(200);
      const cookie = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

      expect((await app.request(`/api/orgs/${orgId}`, { headers: { cookie } })).status).toBe(403);

      const verify = await app.request(`${url.pathname}${url.search}`);
      expect(verify.status).toBe(200);
      expect(((await verify.json()) as { data: { email: string } }).data.email).toBe(email);

      const opened = await app.request(`/api/orgs/${orgId}`, { headers: { cookie } });
      expect(opened.status).toBe(200);

      // The link is single-use.
      expect((await app.request(`${url.pathname}${url.search}`)).status).toBe(401);
    });
  });

  test("a pending account is refused on a tenant route with 403 EMAIL_NOT_VERIFIED", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await pendingSignup(db);

      const res = await app.request(`/api/orgs/${pending.orgId}`, { headers: pending.headers });
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe("EMAIL_NOT_VERIFIED");

      // A second gated family, to show it is the path predicate and not one router.
      const keys = await app.request("/api/api-keys", { headers: pending.headers });
      expect(keys.status).toBe(403);
      expect(await errorCode(keys)).toBe("EMAIL_NOT_VERIFIED");
    });
  });

  test("the same session reaches everything the verification screen needs", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await pendingSignup(db);

      const me = await app.request("/api/users/me", { headers: pending.headers });
      expect(me.status).toBe(200);
      expect(
        ((await me.json()) as { data: { user: { emailVerified: boolean } } }).data.user
          .emailVerified,
      ).toBe(false);

      const sessions = await app.request("/api/auth/sessions", { headers: pending.headers });
      expect(sessions.status).toBe(200);

      const mfa = await app.request("/api/auth/mfa/status", { headers: pending.headers });
      expect(mfa.status).toBe(200);

      // Resending the link is unauthenticated but lives under the exempt prefix either way.
      const resend = await app.request("/api/auth/resend-verification", {
        method: "POST",
        headers: { ...pending.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email }),
      });
      expect(resend.status).toBe(200);

      const signout = await app.request("/api/auth/signout", {
        method: "POST",
        headers: pending.headers,
      });
      expect(signout.status).toBe(204);
    });
  });

  test("verifying opens the gate for the session already held — no new sign-in required", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await pendingSignup(db);

      expect(
        (await app.request(`/api/orgs/${pending.orgId}`, { headers: pending.headers })).status,
      ).toBe(403);

      await verifyEmail(db, pending.verificationToken);

      const after = await app.request(`/api/orgs/${pending.orgId}`, { headers: pending.headers });
      expect(after.status).toBe(200);
    });
  });

  test("the API-key branch is gated the same way", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await pendingSignup(db);
      const created = await createApiKey(db, {
        organizationId: pending.orgId,
        userId: pending.userId,
        createdBy: pending.userId,
        actorType: "user",
        name: `gate-key-${crypto.randomUUID().slice(0, 6)}`,
        keyType: "admin",
        environment: "development",
        permissionLevel: "admin",
        securityLevel: "standard",
        scopes: [],
        expiresAt: null,
        rotationStrategy: "manual",
      });
      const headers = { authorization: `Bearer ${created.key}` };

      const gated = await app.request(`/api/orgs/${pending.orgId}`, { headers });
      expect(gated.status).toBe(403);
      expect(await errorCode(gated)).toBe("EMAIL_NOT_VERIFIED");

      expect((await app.request("/api/users/me", { headers })).status).toBe(200);

      await verifyEmail(db, pending.verificationToken);
      expect((await app.request(`/api/orgs/${pending.orgId}`, { headers })).status).toBe(200);
    });
  });

  test("a suspension still outranks the gate: the account-state error comes first", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await pendingSignup(db);
      await db.execute(sql`UPDATE users SET status = 'suspended' WHERE id = ${pending.userId}`);

      const res = await app.request(`/api/orgs/${pending.orgId}`, { headers: pending.headers });
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe("ACCOUNT_SUSPENDED");
    });
  });
});
