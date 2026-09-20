import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "../../lib/config";
import { signAccessToken } from "../../services/auth/jwt";
import { createSession } from "../../services/auth/session";
import {
  deleteAccount,
  getAccountDeletionStatus,
  purgeExpiredAccounts,
  reactivateAccount,
} from "../../services/users/account-deletion.service";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/**
 * Raw `db.execute` hands back timestamptz as PostgreSQL's text form
 * (`2026-10-20 17:23:37.731+00`), and `"2026-10-20T17:23:37.731+00"` is not
 * valid ISO 8601 — `new Date` returns Invalid Date. Read the instant from the
 * database as epoch milliseconds instead of parsing the server's text form.
 */
const SCHEDULED_MS = (id: string) =>
  sql`SELECT (extract(epoch FROM scheduled_deletion_at) * 1000)::bigint AS scheduled_ms FROM users WHERE id = ${id}`;

/**
 * Builds an authenticated user inside the test transaction: user → org →
 * active `owner` membership, with the access-token cookie the routes read.
 */
async function signedInUser(db: Parameters<typeof createTestUser>[0]) {
  const user = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: user.id });
  await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode: "owner" });
  await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`);
  const token = await signAccessToken(user.id, org.id, getConfig().JWT_ACCESS_SECRET);
  return { user, org, cookie: `nawebeus_access=${encodeURIComponent(token)}` };
}

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("Account deletion routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
  });

  test("DELETE /api/users/me without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("POST /api/users/me/reactivate without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/reactivate", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

/**
 * The service was never executed against a database before this suite existed:
 * `deleteAccount` / `reactivateAccount` / `purgeExpiredAccounts` /
 * `getAccountDeletionStatus` all reference `users.scheduled_deletion_at`, a
 * column the schema did not define (F-24). Every one of them failed with 42703,
 * which also 500'd `GET /api/users/me` for every authenticated user — the only
 * coverage was the two 401 checks above, which never reach the service.
 */
describe.skipIf(!hasDb())("Account deletion — service + route (with DB)", () => {
  test("GET /api/users/me returns 200 for an authenticated user (F-24 regression)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedInUser(db);

      const res = await app.request("/api/users/me", { headers: { cookie } });
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        data: {
          user: { id: string };
          deletionStatus: { deleted: boolean; scheduledDeletionAt: string | null };
        };
      };
      expect(json.data.user.id).toBe(user.id);
      expect(json.data.deletionStatus.deleted).toBe(false);
      expect(json.data.deletionStatus.scheduledDeletionAt).toBeNull();
    });
  });

  test("deleteAccount soft-deletes, schedules the purge 30 days out, revokes sessions and releases the email", async () => {
    await withTestDb(async ({ db }) => {
      const { user } = await signedInUser(db);
      await createSession(db, crypto.randomUUID(), user.id, "hash", false);

      const before = Date.now();
      const { scheduledDeletionAt } = await deleteAccount(db, user.id, { reason: "test" });

      const scheduled = new Date(scheduledDeletionAt).getTime();
      const graceDays = (scheduled - before) / (24 * 60 * 60 * 1000);
      expect(graceDays).toBeGreaterThan(29.9);
      expect(graceDays).toBeLessThan(30.1);

      const rows = await db.execute<{
        status: string;
        deleted_at: Date | null;
        deletion_reason: string | null;
        email: string;
        sessions: number;
      }>(sql`
        SELECT u.status, u.deleted_at, u.deletion_reason, u.email,
               (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.is_revoked = false) AS sessions
        FROM users u WHERE u.id = ${user.id}
      `);
      const row = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows[0]!;
      expect(row.status).toBe("suspended");
      expect(row.deleted_at).not.toBeNull();
      expect(row.deletion_reason).toBe("test");
      const ms = await db.execute<{ scheduled_ms: string }>(SCHEDULED_MS(user.id));
      const scheduledMs = (ms as unknown as { rows: Array<{ scheduled_ms: string }> }).rows[0]!
        .scheduled_ms;
      expect(Number(scheduledMs)).toBe(scheduled);
      expect(row.email as string).toContain("+deleted");
      expect(row.email as string).not.toBe(user.email);
      expect(row.sessions).toBe(0);

      // The account is no longer resolvable by its original address.
      const status = await getAccountDeletionStatus(db, user.id);
      expect(status.deleted).toBe(true);
      expect(status.scheduledDeletionAt).toBe(scheduledDeletionAt);
    });
  });

  test("reactivateAccount clears the soft delete, the schedule and the suspension", async () => {
    await withTestDb(async ({ db }) => {
      const { user } = await signedInUser(db);
      await deleteAccount(db, user.id);

      await reactivateAccount(db, user.id);

      const status = await getAccountDeletionStatus(db, user.id);
      expect(status.deleted).toBe(false);
      expect(status.scheduledDeletionAt).toBeNull();

      const rows = await db.execute<{ status: string; deleted_by: string | null }>(
        sql`SELECT status, deleted_by FROM users WHERE id = ${user.id}`,
      );
      const row = (
        rows as unknown as { rows: Array<{ status: string; deleted_by: string | null }> }
      ).rows[0]!;
      expect(row.status).toBe("active");
      expect(row.deleted_by).toBeNull();
    });
  });

  test("purgeExpiredAccounts removes only accounts past their grace window", async () => {
    await withTestDb(async ({ db }) => {
      const expired = await createTestUser(db);
      const pending = await createTestUser(db);
      await deleteAccount(db, expired.id);
      await deleteAccount(db, pending.id);

      // Only the first account's grace period has elapsed.
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${expired.id}`,
      );

      const purged = await purgeExpiredAccounts(db);
      expect(purged).toBe(1);

      const remaining = await db.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE id IN (${expired.id}, ${pending.id})`,
      );
      const ids = (remaining as unknown as { rows: Array<{ id: string }> }).rows.map((r) => r.id);
      expect(ids).toEqual([pending.id]);
    });
  });

  /**
   * Known limitation, filed as F-25 rather than fixed here: `organizations.owner_id`
   * is NOT NULL with a restrictive FK, so the hard DELETE cannot remove a user who
   * still owns an organization — the purge dies on 23503. Resolving it is a product
   * call (delete the owned orgs with the owner? refuse and report?) that belongs with
   * NWB-P0-023 (organization deletion). This test exists so the gap is visible in the
   * suite instead of discovered in production — flip it to `resolves` when given a
   * decision.
   */
  test("purgeExpiredAccounts currently fails for an organization owner (F-25 known limitation)", async () => {
    await withTestDb(async ({ db }) => {
      const { user } = await signedInUser(db);
      await deleteAccount(db, user.id);
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${user.id}`,
      );

      await expect(purgeExpiredAccounts(db)).rejects.toThrow(/foreign key constraint/i);
    });
  });
});
