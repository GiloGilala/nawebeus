/**
 * F-05 / NWB-P0-015 — `users.status` is enforced.
 *
 * Before this ticket `signIn` selected `status` and never looked at it: a
 * suspended account authenticated and acted normally, and a session issued
 * before a suspension kept working until it expired. The rules pinned here:
 *
 *   1. `suspended` cannot sign in — 403 `ACCOUNT_SUSPENDED`, no cookies.
 *   2. The 403 is only reachable *after* a correct password, so sign-in does not
 *      become an account-enumeration oracle (a wrong password on a suspended
 *      account is still the generic 401).
 *   3. `pending_verification` may sign in, and the response says
 *      `emailVerified: false` so the client can gate features itself (the hard
 *      server-side gate arrives with real email delivery in Phase 2).
 *   4. Reactive/re-suspension takes effect at the next request, for both the
 *      session-cookie path and the API-key path.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import { createApiKey } from "../../services/auth/api-key";
import { signAccessToken } from "../../services/auth/jwt";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

type Db = Parameters<typeof createTestUser>[0];

async function signInWith(app: ReturnType<typeof createTestApp>, email: string, password: string) {
  return app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.7" },
    body: JSON.stringify({ email, password }),
  });
}

/** A user with an active `owner` membership, signed in via a real access token. */
async function signedInUser(db: Db) {
  const user = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: user.id });
  await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode: "owner" });
  await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`);
  const token = await signAccessToken(user.id, org.id, getConfig().JWT_ACCESS_SECRET);
  return { user, org, cookie: `nawebeus_access=${encodeURIComponent(token)}` };
}

describe.skipIf(!hasDb())("User status at sign-in (F-05)", () => {
  test("a suspended account cannot sign in, even with the right password", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db, { status: "suspended" });

      const res = await signInWith(app, user.email, TEST_USER_PASSWORD);

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe("ACCOUNT_SUSPENDED");
      // No session cookies were issued.
      expect(res.headers.get("set-cookie")).toBeNull();
    });
  });

  test("a wrong password on a suspended account is still the generic 401 (no enumeration)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db, { status: "suspended" });

      const res = await signInWith(app, user.email, "DefinitelyWrong1!");

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("AUTH_ERROR");
    });
  });

  test("reactivating an account clears the block", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db, { status: "suspended" });
      expect((await signInWith(app, user.email, TEST_USER_PASSWORD)).status).toBe(403);

      await db.execute(sql`UPDATE users SET status = 'active' WHERE id = ${user.id}`);

      const res = await signInWith(app, user.email, TEST_USER_PASSWORD);
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toContain("nawebeus_access=");
    });
  });

  test("a pending_verification account signs in and the response flags the unverified address", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const pending = await createTestUser(db, { status: "pending_verification" });

      const res = await signInWith(app, pending.email, TEST_USER_PASSWORD);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: { user: { emailVerified: boolean } } };
      expect(json.data.user.emailVerified).toBe(false);
    });
  });

  test("a verified active account reports emailVerified: true", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db);
      await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`);

      const res = await signInWith(app, user.email, TEST_USER_PASSWORD);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: { user: { emailVerified: boolean } } };
      expect(json.data.user.emailVerified).toBe(true);
    });
  });
});

describe.skipIf(!hasDb())("User status on every request (F-05)", () => {
  test("a suspension stops an in-flight session at the next request", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedInUser(db);

      // The session works while the account is active…
      expect((await app.request("/api/users/me", { headers: { cookie } })).status).toBe(200);

      // …an administrator suspends the account…
      await db.execute(sql`UPDATE users SET status = 'suspended' WHERE id = ${user.id}`);

      // …and the very next request is refused, without waiting for token expiry.
      const blocked = await app.request("/api/users/me", { headers: { cookie } });
      expect(blocked.status).toBe(403);
      expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe(
        "ACCOUNT_SUSPENDED",
      );

      // Reactivating restores access to the same session.
      await db.execute(sql`UPDATE users SET status = 'active' WHERE id = ${user.id}`);
      expect((await app.request("/api/users/me", { headers: { cookie } })).status).toBe(200);
    });
  });

  test("a soft-deleted account is refused with 401", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedInUser(db);

      await db.execute(sql`UPDATE users SET deleted_at = now() WHERE id = ${user.id}`);

      const res = await app.request("/api/users/me", { headers: { cookie } });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("AUTH_ERROR");
    });
  });

  test("a suspended owner's API keys stop working too", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, org } = await signedInUser(db);

      const created = await createApiKey(db, {
        organizationId: org.id,
        userId: user.id,
        createdBy: user.id,
        actorType: "user",
        name: `key-${crypto.randomUUID().slice(0, 6)}`,
        keyType: "admin",
        environment: "development",
        permissionLevel: "admin",
        securityLevel: "standard",
        scopes: [],
        expiresAt: null,
        rotationStrategy: "manual",
      });
      const headers = { authorization: `Bearer ${created.key}` };

      expect((await app.request("/api/users/me", { headers })).status).toBe(200);

      await db.execute(sql`UPDATE users SET status = 'suspended' WHERE id = ${user.id}`);

      const res = await app.request("/api/users/me", { headers });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        "ACCOUNT_SUSPENDED",
      );
    });
  });
});
