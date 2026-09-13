import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { AccountLockedError, AuthError } from "../../lib/errors";
import { signIn } from "../../services/auth/auth.service";
import { hashPassword } from "../../services/auth/password";
import { withTestDb } from "../helpers/test-db";

const hasDb = !!process.env.DATABASE_URL;

/**
 * Regression coverage for NWB-P0-008: `signIn` used to read `failed_login_attempts`, await
 * bcrypt, then write `read + 1`. N concurrent wrong passwords therefore all read the same value
 * and counted as ONE failure, so the lockout never engaged — useless against exactly the
 * parallelised credential-stuffing run it exists to stop.
 *
 * `signin-enhanced.test.ts` fires its five attempts sequentially; that passes whether or not the
 * bug is present. These fire concurrently, so they fail if the lost update ever comes back.
 */

const CORRECT_PASSWORD = "Correct-Horse-9-Battery!";
const WRONG_PASSWORD = "wrong-password";

async function insertUser(db: Db, label: string): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `lockout-${label}-${suffix}@test.local`;
  // `username` is varchar(50) — the email will not fit.
  const username = `lk-${label}-${suffix}`;
  const hashed = await hashPassword(CORRECT_PASSWORD);
  const orgRows = await db.execute<{ id: string }>(sql`SELECT id FROM organizations LIMIT 1`);
  const orgId = (orgRows as any).rows?.[0]?.id ?? null;

  const rows = await db.execute<{ id: string }>(
    sql`INSERT INTO users (email, username, first_name, last_name, password, status, organization_id)
        VALUES (${email}, ${username}, 'Lock', 'Test', ${hashed}, 'active', ${orgId})
        RETURNING id, email`,
  );
  const row = (rows as any).rows?.[0] as { id: string; email: string } | undefined;
  if (!row?.id) throw new Error(`failed to insert lockout test user (${label})`);
  return row.email;
}

async function readLockState(
  db: Db,
  email: string,
): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const rows = await db.execute<{ failed_login_attempts: number; account_locked_until: unknown }>(
    sql`SELECT failed_login_attempts, account_locked_until
          FROM users WHERE email = ${email}`,
  );
  const row = (rows as any).rows?.[0] as
    | { failed_login_attempts: number; account_locked_until: string | Date | null }
    | undefined;
  if (!row) throw new Error("lockout test user vanished");
  return {
    attempts: row.failed_login_attempts,
    lockedUntil: row.account_locked_until ? new Date(row.account_locked_until) : null,
  };
}

describe.skipIf(!hasDb)("signin lockout concurrency (NWB-P0-008)", () => {
  test("five concurrent wrong passwords count as five, not one", async () => {
    await withTestDb(async ({ db }) => {
      const email = await insertUser(db, "concurrent");

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          signIn(db, email, WRONG_PASSWORD, { ip: `203.0.113.${i + 1}` }),
        ),
      );

      // Every attempt must be rejected; the one that crosses the threshold reports the lock.
      expect(results.every((r) => r.status === "rejected")).toBe(true);
      const locked = results.filter(
        (r) => r.status === "rejected" && r.reason instanceof AccountLockedError,
      );
      expect(locked.length).toBe(1);

      const state = await readLockState(db, email);
      expect(state.attempts).toBe(5);
      expect(state.lockedUntil).not.toBeNull();
      expect(state.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  test("a locked account stays locked even with the correct password", async () => {
    await withTestDb(async ({ db }) => {
      const email = await insertUser(db, "locked");

      await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          signIn(db, email, WRONG_PASSWORD, { ip: `198.51.100.${i + 1}` }),
        ),
      );

      let error: unknown;
      try {
        await signIn(db, email, CORRECT_PASSWORD, { ip: "198.51.100.99" });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(AccountLockedError);
    });
  });

  test("a successful sign-in resets the counter without racing", async () => {
    await withTestDb(async ({ db }) => {
      const email = await insertUser(db, "reset");

      // Stay below the threshold so the account is not locked.
      for (let i = 0; i < 3; i++) {
        const failed = await signIn(db, email, WRONG_PASSWORD, { ip: `192.0.2.${i + 1}` }).then(
          () => false,
          (err: unknown) => err instanceof AuthError,
        );
        expect(failed).toBe(true);
      }
      expect((await readLockState(db, email)).attempts).toBe(3);

      const result = await signIn(db, email, CORRECT_PASSWORD, { ip: "192.0.2.50" });
      expect(result.requiresMfa).toBe(false);
      expect(result.accessToken).toBeDefined();

      const state = await readLockState(db, email);
      expect(state.attempts).toBe(0);
      expect(state.lockedUntil).toBeNull();
    });
  });
});
