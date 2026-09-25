/**
 * Token lifecycle (NWB-P2-002) — the refresh sweep, rotation, and `needs_reauth` surfacing,
 * against a live DB with the platform client faked.
 *
 * The rules under test, verbatim from Module 3: proactive refresh 1 h before expiry
 * (BR-SOC-013/FR-SOC-019), exactly one retry before surfacing (FR-SOC-021), every attempt
 * logged with context but never token material (FR-SOC-024/BR-SOC-016), and optimistic
 * version bumps because many workers share the row.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { socialTokenRefreshJob } from "../../jobs/social-token-refresh";
import { derivedKeyMaterial, encryptSecret } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import {
  createSocialService,
  OAuthExchangeError,
  type OAuthRefreshResult,
  type SocialPlatform,
  setSocialServiceForTest,
} from "../../services/social";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

const KEY = derivedKeyMaterial("token-lifecycle-test-secret");
const CREDS: Record<string, string> = {
  OAUTH_YOUTUBE_CLIENT_ID: "yt-id",
  OAUTH_YOUTUBE_CLIENT_SECRET: "yt-secret",
};

interface FakeOutcome {
  result?: OAuthRefreshResult;
  error?: { providerError: string; httpStatusCode: number | null; message: string };
}

function serviceWithRefresh(
  _db: Db,
  impl: (refreshToken: string) => Promise<FakeOutcome> | FakeOutcome,
) {
  let refreshCalls = 0;
  const seen: string[] = [];
  const svc = createSocialService({
    readEnv: (name) => CREDS[name],
    keyMaterial: KEY,
    appBaseUrl: "http://localhost:3000",
    oauthClient: {
      async exchangeCode() {
        throw new Error("lifecycle tests never exchange");
      },
      async refreshTokens(args) {
        refreshCalls += 1;
        seen.push(args.refreshToken);
        const outcome = await impl(args.refreshToken);
        if (outcome.error) {
          throw new OAuthExchangeError(
            "youtube" as SocialPlatform,
            outcome.error.providerError,
            outcome.error.message,
            outcome.error.httpStatusCode,
          );
        }
        return outcome.result!;
      },
    },
  });
  return { svc, count: () => refreshCalls, seen };
}

async function seedAccount(
  db: Db,
  orgId: string,
  userId: string,
  overrides: {
    expiresInMinutes?: number;
    status?: string;
    withRefreshToken?: boolean;
    refreshToken?: string;
  } = {},
): Promise<string> {
  const accountId = `soc_${crypto.randomUUID()}`;
  const platformUserId = `UC_seed_${accountId.slice(-12)}`;
  const refreshToken = overrides.refreshToken ?? "stored-refresh-token-value";
  const sealed =
    overrides.withRefreshToken === false ? null : await encryptSecret(refreshToken, KEY);
  const minutes = overrides.expiresInMinutes ?? 30;
  const status = overrides.status ?? "active";
  await db.execute(sql`
    INSERT INTO social_accounts (
      id, organization_id, platform, platform_user_id, platform_username,
      access_token_encrypted, refresh_token_encrypted, token_expires_at, status,
      connected_by, disconnected_at, disconnected_by, version
    ) VALUES (
      ${accountId}, ${orgId}, 'youtube', ${platformUserId}, 'seed-channel',
      ${await encryptSecret("old-access-token", KEY)}, ${sealed},
      now() + ${`${minutes} minutes`}::interval, ${status},
      ${userId},
      ${status === "disconnected" ? sql`now()` : null},
      ${status === "disconnected" ? userId : null},
      1
    )
  `);
  return accountId;
}

async function accountRow(db: Db, accountId: string) {
  const rows = await db.execute(sql`SELECT status, is_active, version, token_expires_at,
    access_token_encrypted, refresh_token_encrypted FROM social_accounts WHERE id = ${accountId}`);
  return (rows as any).rows[0] as {
    status: string;
    is_active: boolean;
    version: number;
    token_expires_at: string;
    access_token_encrypted: string;
    refresh_token_encrypted: string | null;
  };
}

describe.skipIf(!hasDb())("token lifecycle — refresh sweep", () => {
  test("refreshes a due account: seals the new tokens, records rotation, bumps version", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc, count, seen } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "new-access-token-value",
          refreshToken: "rotated-refresh-token-value",
          rotated: true,
          expiresInSeconds: 3600,
          scope: null,
        },
      }));

      const result = await svc.refreshDueTokens(db);
      expect(result.due).toBe(1);
      expect(result.refreshed).toBe(1);
      expect(result.rotated).toBe(1);
      expect(result.needsReauth).toBe(0);
      expect(count()).toBe(1);
      // The stored (unsealed) refresh token went to the provider.
      expect(seen[0]).toBe("stored-refresh-token-value");

      const row = await accountRow(db, accountId);
      expect(row.version).toBe(2);
      expect(row.status).toBe("active");
      expect(new Date(row.token_expires_at) > new Date()).toBe(true);
      const { decryptSecret } = await import("../../lib/crypto");
      expect(await decryptSecret(row.access_token_encrypted, KEY)).toBe("new-access-token-value");
      expect(await decryptSecret(row.refresh_token_encrypted!, KEY)).toBe(
        "rotated-refresh-token-value",
      );

      const log = await db.execute(sql`SELECT success, triggered_by, new_refresh_token_issued,
        old_token_expiry, new_token_expiry, retry_count FROM token_refresh_log
        WHERE social_account_id = ${accountId}`);
      const entry = (log as any).rows[0];
      expect(entry.success).toBe(true);
      expect(entry.triggered_by).toBe("proactive");
      expect(entry.new_refresh_token_issued).toBe(true);
      expect(entry.retry_count).toBe(0);
      expect(new Date(entry.new_token_expiry) > new Date(entry.old_token_expiry)).toBe(true);
    });
  });

  test("without rotation the stored refresh token is kept; the log says so", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 2" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "access-v2",
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 7200,
          scope: null,
        },
      }));

      const result = await svc.refreshDueTokens(db);
      expect(result.refreshed).toBe(1);
      const row = await accountRow(db, accountId);
      const { decryptSecret } = await import("../../lib/crypto");
      // Old refresh token survives (Meta-style providers reuse it).
      expect(await decryptSecret(row.refresh_token_encrypted!, KEY)).toBe(
        "stored-refresh-token-value",
      );
      const log = await db.execute(sql`SELECT new_refresh_token_issued FROM token_refresh_log`);
      expect((log as any).rows[0].new_refresh_token_issued).toBe(false);
    });
  });

  test("an account with more than an hour of token left is not due", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 3" });
      await seedAccount(db, org.id, owner.id, { expiresInMinutes: 121 });
      const { svc, count } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "x",
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 3600,
          scope: null,
        },
      }));
      const result = await svc.refreshDueTokens(db);
      expect(result.due).toBe(0);
      expect(count()).toBe(0);
    });
  });

  test("disconnected and needs_reauth accounts are never due", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 4" });
      await seedAccount(db, org.id, owner.id, { expiresInMinutes: 10, status: "disconnected" });
      await seedAccount(db, org.id, owner.id, { expiresInMinutes: 10, status: "needs_reauth" });
      const { svc, count } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "x",
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 3600,
          scope: null,
        },
      }));
      const result = await svc.refreshDueTokens(db);
      expect(result.due).toBe(0);
      expect(count()).toBe(0);
    });
  });
});

describe.skipIf(!hasDb())("token lifecycle — failure surfacing", () => {
  test("failure → exactly one retry → needs_reauth with health log + audit, two log rows", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 5" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc, count } = serviceWithRefresh(db, () => ({
        error: { providerError: "invalid_grant", httpStatusCode: 400, message: "token revoked" },
      }));

      const result = await svc.refreshDueTokens(db);
      expect(result.refreshed).toBe(0);
      expect(result.needsReauth).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(count()).toBe(2); // FR-SOC-021: one retry, then stop

      const row = await accountRow(db, accountId);
      expect(row.status).toBe("needs_reauth");
      expect(row.is_active).toBe(false);
      expect(row.version).toBe(2);

      // Two attempts, both logged with failure context (FR-SOC-024) and never tokens.
      const logs = await db.execute(sql`SELECT success, failure_code, failure_reason, retry_count,
        http_status_code FROM token_refresh_log WHERE social_account_id = ${accountId}
        ORDER BY retry_count`);
      const entries = (logs as any).rows;
      expect(entries).toHaveLength(2);
      expect(entries[0].success).toBe(false);
      expect(entries[0].failure_code).toBe("invalid_grant");
      expect(entries[0].http_status_code).toBe(400);
      expect(entries[1].retry_count).toBe(1);
      expect(JSON.stringify(entries)).not.toContain("stored-refresh-token-value");

      // The health transition row exists with the required error message (schema CHECK).
      const health = await db.execute(sql`SELECT status, previous_status, error_message
        FROM social_account_health_log WHERE social_account_id = ${accountId}`);
      const healthRow = (health as any).rows[0];
      expect(healthRow.status).toBe("needs_reauth");
      expect(healthRow.previous_status).toBe("active");
      expect(healthRow.error_message).toContain("invalid_grant");

      // The audit event carries the surfacing, never token material.
      const audit = await db.execute(sql`SELECT after_state FROM unified_audit_log
        WHERE resource_id = ${accountId} AND action = 'socialaccount.needs_reauth'`);
      const after = (audit as any).rows[0]?.after_state ?? {};
      expect(after.providerCode).toBe("invalid_grant");
      expect(after.attempts).toBe(2);
      expect(JSON.stringify(after)).not.toContain("stored-refresh-token-value");
    });
  });

  test("an account with no stored refresh token surfaces immediately (one attempt)", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 6" });
      const accountId = await seedAccount(db, org.id, owner.id, { withRefreshToken: false });
      const { svc, count } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "x",
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 3600,
          scope: null,
        },
      }));

      const result = await svc.refreshDueTokens(db);
      expect(result.needsReauth).toBe(1);
      expect(count()).toBe(0); // nothing to send — no retry could change this
      expect((await accountRow(db, accountId)).status).toBe("needs_reauth");
    });
  });
});

describe.skipIf(!hasDb())("token lifecycle — the job", () => {
  test("the job handler runs the sweep and reports the tick's counts", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Tok", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Tok Org 7" });
      await seedAccount(db, org.id, owner.id, { expiresInMinutes: 15 });
      const { svc } = serviceWithRefresh(db, () => ({
        result: {
          accessToken: "job-access",
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 3600,
          scope: null,
        },
      }));
      setSocialServiceForTest(svc);
      try {
        const attempt = {
          id: "job-test",
          name: socialTokenRefreshJob.name,
          data: null,
          attempt: 1,
          attemptsMax: 1,
          createdOn: new Date(),
          startedOn: new Date(),
        };
        const outcome = await socialTokenRefreshJob.handle({ db, job: attempt as never }, null);
        expect(outcome).toMatchObject({ due: 1, refreshed: 1, needsReauth: 0, failed: 0 });
      } finally {
        setSocialServiceForTest(undefined);
      }
    });
  });
});
