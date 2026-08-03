import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { withTestDb } from "../helpers/test-db";
import { signIn, refreshSession, signOut } from "../../services/auth/auth.service";
import { hashPassword } from "../../services/auth/password";
import { AuthError } from "../../lib/errors";

const hasDb = () => !!process.env.DATABASE_URL;

async function seedUser(db: any, overrides: Partial<{ email: string; password: string; orgId: string }> = {}) {
  const email = overrides.email ?? "svc-test@example.com";
  const password = overrides.password ?? "Password@123";
  const orgId = overrides.orgId ?? crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await db.execute(
    sql`INSERT INTO users (id, email, username, first_name, last_name, password, organization_id, status)
        VALUES (${crypto.randomUUID()}, ${email}, 'svc-test', 'Service', 'Test', ${passwordHash}, ${orgId}, 'active')`,
  );
  return { email, password, orgId };
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
      expect(
        signIn(db, "svc-test@example.com", "wrong-password"),
      ).rejects.toThrow(AuthError);
    });
  });

  test("signIn with unknown email throws AuthError", async () => {
    await withTestDb(async ({ db }) => {
      expect(
        signIn(db, "nobody@example.com", "whatever"),
      ).rejects.toThrow(AuthError);
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

  test("refreshSession rejects a token that does not match its session", async () => {
    await withTestDb(async ({ db }) => {
      await seedUser(db);
      const first = await signIn(db, "svc-test@example.com", "Password@123");

      // Tamper: replace one char in the signature portion
      const tampered = first.refreshToken!.replace(/^(.+\.)(.{1})$/, (_m, p: string, s: string) => {
        const flip = s === "A" ? "B" : "A";
        return p + flip;
      });

      expect(refreshSession(db, tampered)).rejects.toThrow(AuthError);
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
