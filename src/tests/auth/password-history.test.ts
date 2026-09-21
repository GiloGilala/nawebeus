/**
 * Password history and the change-password flow — F-28.
 *
 * `docs/modules/Authentication & User Management.md` (BR-AUTH-022, AC3, §299/§321)
 * requires that **both** password-setting flows — reset and change — reject a
 * password matching any of the user's last 5. The module had one test between
 * the two of them, and the change flow turned out to be broken three ways:
 *
 *  1. it passed an already-hashed password to `recordPasswordChange`, which
 *     hashes its argument — so the stored password was double-hashed;
 *  2. it then wrote the returned *string* into the jsonb array column, so
 *     `password_history` stopped being an array;
 *  3. it never checked history at all, so BR-AUTH-022 applied to only one path.
 *
 * (1)+(2) combined into a genuinely serious outcome: `Bun.password.verify`
 * *throws* on a hash it cannot parse, so after one password change the reset
 * flow raised `UnsupportedAlgorithm` and the user could never recover their
 * account again. These tests pin all three, plus the data-shape hardening.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { changePassword } from "../../services/auth/auth.service";
import { verifyPassword } from "../../services/auth/password";
import { isPasswordInHistory, recordPasswordChange } from "../../services/auth/password-history";
import { resetPassword } from "../../services/auth/password-reset";
import { createToken } from "../../services/auth/tokens";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const PW2 = "SecondPassw0rd!x";
const PW3 = "ThirdPassw0rd!yz";

async function resetTokenFor(db: any, userId: string) {
  const { rawToken } = await createToken(db, {
    userId,
    tokenType: "password_reset",
    purpose: "password_reset",
    expiresInMinutes: 60,
  });
  return rawToken;
}

async function readHistory(db: any, userId: string) {
  const rows = await db.execute(
    sql`SELECT password, password_history FROM users WHERE id = ${userId}`,
  );
  return (rows as any).rows[0] as { password: string; password_history: unknown };
}

describe.skipIf(!hasDb())("changePassword (with DB)", () => {
  test("stores a password that can actually be verified", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);

      const row = await readHistory(db, user.id);
      // Double-hashing still "works" for sign-in only if the *same* double
      // hash is recomputed; it was not. Verify the stored hash against the
      // plaintext the user typed.
      expect(await verifyPassword(PW2, row.password)).toBe(true);
      expect(await verifyPassword(TEST_USER_PASSWORD, row.password)).toBe(false);
    });
  });

  test("keeps password_history a jsonb array", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);

      const row = await readHistory(db, user.id);
      // The regression wrote a bare string here. A string is also iterable,
      // which is what made the downstream failure so confusing.
      expect(Array.isArray(row.password_history)).toBe(true);
      expect((row.password_history as string[]).length).toBeGreaterThan(0);
      for (const h of row.password_history as string[]) {
        expect(typeof h).toBe("string");
      }
    });
  });

  test("rejects a password the user has used before (BR-AUTH-022)", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);

      // Change back to the original — must be refused on this path too, not
      // just on reset.
      await expect(changePassword(db, user.id, PW2, TEST_USER_PASSWORD)).rejects.toThrow(
        /last 5 passwords/i,
      );
    });
  });

  test("allows a genuinely new password", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);
      await changePassword(db, user.id, PW2, PW3);

      const row = await readHistory(db, user.id);
      expect(await verifyPassword(PW3, row.password)).toBe(true);
      // signup digest + PW2 + PW3 — the factory seeds the first, as real signup does.
      expect((row.password_history as string[]).length).toBe(3);
    });
  });

  test("still rejects a wrong current password", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await expect(changePassword(db, user.id, "NotMyPassw0rd!", PW2)).rejects.toThrow(
        /current password/i,
      );
    });
  });

  test("history is capped at 5 entries", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      let current = TEST_USER_PASSWORD;
      for (const next of [
        "Rotate1Passw0rd!",
        "Rotate2Passw0rd!",
        "Rotate3Passw0rd!",
        "Rotate4Passw0rd!",
        "Rotate5Passw0rd!",
        "Rotate6Passw0rd!",
      ]) {
        await changePassword(db, user.id, current, next);
        current = next;
      }
      const row = await readHistory(db, user.id);
      expect((row.password_history as string[]).length).toBe(5);
      // The oldest password has aged out and is usable again — that is the
      // intent of a *bounded* history, so assert it rather than leave it vague.
      expect(await isPasswordInHistory(db, user.id, TEST_USER_PASSWORD)).toBe(false);
      expect(await isPasswordInHistory(db, user.id, "Rotate6Passw0rd!")).toBe(true);
    });
  });
});

describe.skipIf(!hasDb())("Password reset after a password change (F-28 regression)", () => {
  test("a user who changed their password can still reset it", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);

      // This is the bug that mattered: the corrupted history made
      // Bun.password.verify throw inside the history check, so reset failed
      // with UnsupportedAlgorithm and account recovery was permanently dead.
      await resetPassword(db, await resetTokenFor(db, user.id), PW3);

      const row = await readHistory(db, user.id);
      expect(await verifyPassword(PW3, row.password)).toBe(true);
    });
  });

  test("reset still refuses a password from the history", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await changePassword(db, user.id, TEST_USER_PASSWORD, PW2);

      // The fix must not have weakened the reset-side rule into a no-op.
      await expect(resetPassword(db, await resetTokenFor(db, user.id), PW2)).rejects.toThrow(
        /last 5 passwords/i,
      );
    });
  });
});

describe.skipIf(!hasDb())("password_history data hardening (with DB)", () => {
  test("a corrupt bare-string history does not break the reuse check", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      // Rows written before the fix still hold this shape. Account recovery
      // must degrade to "no history" rather than throwing.
      await db.execute(
        sql`UPDATE users SET password_history = ${JSON.stringify("$2b$10$notarealhashvalue")}::jsonb
            WHERE id = ${user.id}`,
      );
      expect(await isPasswordInHistory(db, user.id, PW2)).toBe(false);
    });
  });

  test("an unparseable entry is skipped, not fatal, and the rest still match", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await recordPasswordChange(db, user.id, PW2);
      const row = await readHistory(db, user.id);
      const goodHash = (row.password_history as string[])[0];

      await db.execute(
        sql`UPDATE users SET password_history = ${JSON.stringify(["not-a-hash", goodHash])}::jsonb
            WHERE id = ${user.id}`,
      );

      // The junk entry must not mask the real one that follows it.
      expect(await isPasswordInHistory(db, user.id, PW2)).toBe(true);
      expect(await isPasswordInHistory(db, user.id, PW3)).toBe(false);
    });
  });

  test("a corrupt history is repaired rather than spread character-by-character", async () => {
    await withTestDb(async ({ db }) => {
      const user = await createTestUser(db);
      await db.execute(
        sql`UPDATE users SET password_history = ${JSON.stringify("$2b$10$notarealhashvalue")}::jsonb
            WHERE id = ${user.id}`,
      );

      await recordPasswordChange(db, user.id, PW2);

      const row = await readHistory(db, user.id);
      const history = row.password_history as string[];
      expect(Array.isArray(history)).toBe(true);
      // Spreading the old string would have produced ~19 single-character
      // "hashes" instead of one real one.
      expect(history).toHaveLength(1);
      expect(history[0]?.startsWith("$2")).toBe(true);
    });
  });
});

describe.skipIf(!hasDb())("POST /api/users/me/change-password (with DB)", () => {
  async function signedIn(app: ReturnType<typeof createTestApp>, db: any) {
    // The user needs an organization: signing in without one yields an empty
    // `orgId` in the JWT, which later reaches Postgres as a uuid and 500s.
    // That is a separate pre-existing issue; every other suite avoids it the
    // same way, by giving the user a real org.
    const user = await createTestUser(db);
    const org = await createTestOrg(db, { ownerId: user.id });
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: user.id,
      roleCode: "owner",
    });
    const res = await app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: TEST_USER_PASSWORD }),
    });
    const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    return { user, cookie };
  }

  test("changes the password and lets the user sign in with the new one", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedIn(app, db);

      const res = await app.request("/api/users/me/change-password", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: TEST_USER_PASSWORD, newPassword: PW2 }),
      });
      expect(res.status).toBe(200);

      // End-to-end proof that the stored hash is the single hash of what the
      // user typed: sign in with it.
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: PW2 }),
      });
      expect(signin.status).toBe(200);
    });
  });

  test("the old password no longer works", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedIn(app, db);
      await app.request("/api/users/me/change-password", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: TEST_USER_PASSWORD, newPassword: PW2 }),
      });

      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: TEST_USER_PASSWORD }),
      });
      expect(signin.status).toBeGreaterThanOrEqual(400);
    });
  });

  test("reusing a previous password is refused over HTTP", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedIn(app, db);
      await app.request("/api/users/me/change-password", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: TEST_USER_PASSWORD, newPassword: PW2 }),
      });

      // A password change revokes every session, so the old cookie is dead —
      // sign in again with the new password before attempting the reuse.
      const signin = await app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: PW2 }),
      });
      expect(signin.status).toBe(200);
      const fresh = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

      const res = await app.request("/api/users/me/change-password", {
        method: "POST",
        headers: { cookie: fresh, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: PW2, newPassword: TEST_USER_PASSWORD }),
      });
      expect(res.status).toBe(409);
    });
  });

  test("requires authentication", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const res = await app.request("/api/users/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: TEST_USER_PASSWORD, newPassword: PW2 }),
      });
      expect(res.status).toBe(401);
    });
  });
});
