import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import { AuthError } from "../../lib/errors";
import { refreshSession, signIn, signOut } from "../../services/auth/auth.service";
import { signRefreshToken } from "../../services/auth/jwt";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/**
 * Creates a user attached to a real organization.
 *
 * `organizations.owner_id` is NOT NULL and FKs to `users`, so the user has to
 * exist before the organization that owns it — hence the two-step link. This
 * fixture used to point the user at a random, non-existent org id, which the
 * `users.organization_id` FK rejects.
 */
async function seedUser(
  db: any,
  overrides: Partial<{ email: string; password: string; orgId: string }> = {},
) {
  const email = overrides.email ?? "svc-test@example.com";
  const password = overrides.password ?? "Password@123";
  const user = await createTestUser(db, { email, password });

  const orgId = overrides.orgId ?? (await createTestOrg(db, { ownerId: user.id })).id;
  await db.execute(sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${user.id}`);

  return { email: user.email, password, orgId, userId: user.id };
}

describe.skipIf(!hasDb())("auth.service", () => {
  test("signIn returns tokens + identity for valid credentials", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const result = await signIn(db, "svc-test@example.com", "Password@123");
      expect(result.userId).toBeDefined();
      expect(result.orgId).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken!.split(".").length).toBe(3);
      expect(result.refreshToken!.split(".").length).toBe(3);
    });
  });

  test("signIn with wrong password throws AuthError", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      expect(signIn(db, "svc-test@example.com", "wrong-password")).rejects.toThrow(AuthError);
    });
  });

  test("signIn with unknown email throws AuthError", async () => {
    await withTestDb(async ({ db }) => {
      expect(signIn(db, "nobody@example.com", "whatever")).rejects.toThrow(AuthError);
    });
  });

  test("refreshSession rotates the session and returns new tokens", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");

      const rotated = await refreshSession(db, first.refreshToken!);
      expect(rotated.refreshToken).not.toBe(first.refreshToken);
      expect(rotated.sessionId).not.toBe(first.sessionId);
      expect(rotated.userId).toBe(first.userId);

      // Old session is now revoked — reusing the old token must fail
      expect(refreshSession(db, first.refreshToken!)).rejects.toThrow(AuthError);
    });
  });

  test("refreshSession rejects a token with a broken signature", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");

      // Flip the FIRST signature character, not the last. A 32-byte signature
      // base64url-encodes to 43 characters, and the final character carries only
      // 4 data bits — so 'A' and 'B' decode to identical bytes and tampering with
      // it silently did nothing roughly 6% of the time.
      const [header, body, signature] = first.refreshToken!.split(".");
      const flipped = (signature![0] === "A" ? "B" : "A") + signature!.slice(1);
      const tampered = `${header}.${body}.${flipped}`;
      expect(tampered).not.toBe(first.refreshToken);

      expect(refreshSession(db, tampered)).rejects.toThrow(AuthError);
    });
  });

  test("refreshSession rejects a validly-signed token that does not match its session", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");

      // Correctly signed with the real secret, and pointing at a real session —
      // but a different token string, so its digest cannot match the one stored
      // on the session row. This is the token-binding control: a leaked token
      // cannot be swapped for another one for the same session.
      const other = await signRefreshToken(
        first.sessionId!,
        first.userId,
        first.orgId,
        getConfig().JWT_REFRESH_SECRET,
        1234,
      );
      expect(other).not.toBe(first.refreshToken);

      expect(refreshSession(db, other)).rejects.toThrow(AuthError);
    });
  });

  test("refreshSession rejects a revoked session", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");
      await signOut(db, first.refreshToken!);
      expect(refreshSession(db, first.refreshToken!)).rejects.toThrow(AuthError);
    });
  });

  test("signOut revokes the session", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");

      await signOut(db, first.refreshToken!);

      const rows = await db.execute(
        sql`SELECT is_revoked FROM sessions WHERE id = ${first.sessionId}`,
      );
      const session = (rows as any).rows?.[0] as any;
      expect(session.is_revoked).toBe(true);
    });
  });

  test("signOut with invalid token does not throw", async () => {
    await withTestDb(async ({ db }) => {
      await expect(signOut(db, "garbage-token")).resolves.toBeUndefined();
    });
  });
});
