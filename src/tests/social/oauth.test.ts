/**
 * The OAuth state machine (NWB-P2-001) — service level, live DB, fake platform.
 *
 * The roadmap's required replay test lives here: the same callback consumed twice fails the
 * second time, because consumption is a single conditional UPDATE. Everything else orbits that
 * guarantee — TTL expiry, the generic invalid-state error, sealed tokens at rest, the
 * duplicate-connection rule (FR-SOC-004), reconnect revival, and the 24-hour purge.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { derivedKeyMaterial } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import { AccountAlreadyConnectedError, ValidationError } from "../../lib/errors";
import type { OAuthExchangeResult } from "../../services/social";
import { createSocialService, type SocialPlatform } from "../../services/social";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

const KEY = derivedKeyMaterial("oauth-service-test-secret");
const CREDS = {
  OAUTH_YOUTUBE_CLIENT_ID: "yt-client-id",
  OAUTH_YOUTUBE_CLIENT_SECRET: "yt-client-secret",
  OAUTH_FACEBOOK_CLIENT_ID: "fb-client-id",
  OAUTH_FACEBOOK_CLIENT_SECRET: "fb-client-secret",
};

function fakeClient(exchange: OAuthExchangeResult) {
  const calls: { platform: string; code: string; codeVerifier?: string; redirectUri: string }[] =
    [];
  return {
    client: {
      async exchangeCode(args: {
        platform: SocialPlatform;
        code: string;
        redirectUri: string;
        codeVerifier: string | undefined;
      }) {
        calls.push({
          platform: args.platform,
          code: args.code,
          redirectUri: args.redirectUri,
          ...(args.codeVerifier !== undefined ? { codeVerifier: args.codeVerifier } : {}),
        });
        return exchange;
      },
    },
    calls,
  };
}

const EXCHANGE: OAuthExchangeResult = {
  accessToken: "raw-access-token-value",
  refreshToken: "raw-refresh-token-value",
  expiresInSeconds: 3600,
  scope: "https://www.googleapis.com/auth/youtube.readonly",
  platformUserId: "UC_platform_123",
  platformUsername: "Nawebeus Channel",
  displayName: "Nawebeus",
  profileImageUrl: "https://example.com/avatar.png",
  followerCount: 4321,
};

function service(_db: Db, exchangeResult = EXCHANGE) {
  const fake = fakeClient(exchangeResult);
  const svc = createSocialService({
    readEnv: (name) => (CREDS as Record<string, string | undefined>)[name],
    keyMaterial: KEY,
    appBaseUrl: "http://localhost:3000",
    oauthClient: fake.client,
  });
  return { svc, calls: fake.calls };
}

describe.skipIf(!hasDb())("OAuth flow — initiate", () => {
  test("creates a single-use state row and a PKCE authorize URL (youtube)", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Social Org" });
      const { svc } = service(db);

      const { authorizeUrl, expiresAt } = await svc.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
        returnUrl: "/settings/integrations",
      });

      const url = new URL(authorizeUrl);
      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("yt-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/social/oauth/youtube/callback",
      );
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      const state = url.searchParams.get("state")!;
      expect(state).toMatch(/^[0-9a-f]{128}$/);
      expect(url.searchParams.get("scope")).toContain("youtube.readonly");

      const row =
        await db.execute(sql`SELECT id, platform, expires_at, used_at, state_data, return_url
        FROM oauth_states WHERE id = ${state}`);
      const stored = (row as any).rows[0];
      expect(stored.platform).toBe("youtube");
      expect(stored.used_at).toBeNull();
      expect(stored.return_url).toBe("/settings/integrations");
      expect((stored.state_data as any).codeVerifier).toBeTypeOf("string");
      // ~10 minutes out (FR-SOC-002).
      const skew = new Date(expiresAt).getTime() - Date.now();
      expect(skew).toBeGreaterThan(9 * 60 * 1000);
      expect(skew).toBeLessThanOrEqual(10 * 60 * 1000);
    });
  });

  test("a non-PKCE platform (facebook) omits the challenge; unconfigured platform refuses", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Social Org 2" });
      const { svc } = service(db);

      const { authorizeUrl } = await svc.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "facebook",
      });
      expect(new URL(authorizeUrl).searchParams.get("code_challenge")).toBeNull();

      await expect(
        svc.initiateConnect(db, { organizationId: org.id, userId: owner.id, platform: "reddit" }),
      ).rejects.toThrow(/Reddit OAuth is not configured/);
    });
  });

  test("an absolute returnUrl is refused — the callback must never open-redirect", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Social Org 3" });
      const { svc } = service(db);

      for (const bad of ["https://evil.example/cb", "//evil.example/cb", "settings/x"]) {
        await expect(
          svc.initiateConnect(db, {
            organizationId: org.id,
            userId: owner.id,
            platform: "youtube",
            returnUrl: bad,
          }),
        ).rejects.toBeInstanceOf(ValidationError);
      }
    });
  });
});

describe.skipIf(!hasDb())("OAuth flow — callback", () => {
  test("connects: state consumed once, tokens sealed at rest, audit without token material", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Connect Org" });
      const { svc, calls } = service(db);
      const { authorizeUrl } = await svc.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
      });
      const state = new URL(authorizeUrl).searchParams.get("state")!;

      const result = await svc.handleCallback(db, {
        platform: "youtube",
        code: "auth-code-1",
        state,
      });
      expect(result.reconnected).toBe(false);
      expect(result.returnUrl).toBeNull();
      expect(result.account.id).toMatch(/^soc_[0-9a-f-]{36}$/);
      expect(result.account.platformUsername).toBe("Nawebeus Channel");
      expect(result.account.followerCount).toBe(4321);
      // The exchange saw the PKCE verifier carried through the state row.
      expect(calls[0]?.codeVerifier).toBeTypeOf("string");
      expect(calls[0]?.code).toBe("auth-code-1");

      // Ciphertext at rest: no plaintext anywhere in the row; unseal round-trips.
      const raw = await db.execute(sql`SELECT access_token_encrypted, refresh_token_encrypted
        FROM social_accounts WHERE id = ${result.account.id}`);
      const stored = (raw as any).rows[0];
      expect(stored.access_token_encrypted).not.toContain("raw-access-token-value");
      expect(stored.refresh_token_encrypted).not.toContain("raw-refresh-token-value");
      expect(await svc.unsealAccessToken(db, org.id, result.account.id)).toBe(
        "raw-access-token-value",
      );

      // Audit: platform + username + scopes; never token material.
      const audit = await db.execute(sql`SELECT after_state FROM unified_audit_log
        WHERE resource_id = ${result.account.id} AND action = 'socialaccount.connected'`);
      const after = (audit as any).rows[0]?.after_state ?? {};
      expect(after.platform).toBe("youtube");
      expect(after.username).toBe("Nawebeus Channel");
      expect(JSON.stringify(after)).not.toContain("raw-");

      // REPLAY — the roadmap-required test: the same state is dead after one use.
      await expect(
        svc.handleCallback(db, { platform: "youtube", code: "auth-code-2", state }),
      ).rejects.toThrow(/invalid, expired, or already used/);
    });
  });

  test("expired states fail like unknown states; consumption marks used_at", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Expiry Org" });
      const { svc } = service(db);

      await db.execute(sql`
        INSERT INTO oauth_states (id, organization_id, user_id, platform, created_at, expires_at, used_at)
        VALUES (${"f".repeat(128)}, ${org.id}, ${owner.id}, 'youtube',
                now() - interval '11 minutes', now() - interval '1 minute', NULL)`);
      await expect(
        svc.handleCallback(db, { platform: "youtube", code: "c", state: "f".repeat(128) }),
      ).rejects.toBeInstanceOf(ValidationError);

      // And consumption is visible: a fresh state is used_at-stamped exactly once.
      const { authorizeUrl } = await svc.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
      });
      const state = new URL(authorizeUrl).searchParams.get("state")!;
      await svc.handleCallback(db, { platform: "youtube", code: "c1", state });
      const row = await db.execute(sql`SELECT used_at FROM oauth_states WHERE id = ${state}`);
      expect((row as any).rows[0].used_at).not.toBeNull();
    });
  });

  test("a live duplicate is ACCOUNT_ALREADY_CONNECTED; a disconnected row is revived", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Dup Org" });
      const { svc } = service(db);

      const { authorizeUrl } = await svc.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
      });
      const state = new URL(authorizeUrl).searchParams.get("state")!;
      const first = await svc.handleCallback(db, { platform: "youtube", code: "c1", state });

      // Second connect of the same platform account — new state, same platform user.
      const { svc: svc2 } = service(db, { ...EXCHANGE, accessToken: "second-token" });
      const again = await svc2.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
      });
      const state2 = new URL(again.authorizeUrl).searchParams.get("state")!;
      await expect(
        svc2.handleCallback(db, { platform: "youtube", code: "c2", state: state2 }),
      ).rejects.toBeInstanceOf(AccountAlreadyConnectedError);

      // Disconnect, then reconnect revives the same row (no second row; version bumped).
      await db.execute(sql`
        UPDATE social_accounts SET status = 'disconnected', disconnected_at = now(),
          disconnected_by = ${owner.id}, is_active = false
        WHERE id = ${first.account.id}`);
      const third = await svc2.initiateConnect(db, {
        organizationId: org.id,
        userId: owner.id,
        platform: "youtube",
      });
      const state3 = new URL(third.authorizeUrl).searchParams.get("state")!;
      const revived = await svc2.handleCallback(db, {
        platform: "youtube",
        code: "c3",
        state: state3,
      });
      expect(revived.reconnected).toBe(true);
      expect(revived.account.id).toBe(first.account.id);
      expect(revived.account.status).toBe("active");
      expect(revived.account.version).toBe(first.account.version + 1);
      expect(await svc2.unsealAccessToken(db, org.id, first.account.id)).toBe("second-token");

      const count = await db.execute(sql`SELECT count(*)::int AS n FROM social_accounts`);
      expect((count as any).rows[0].n).toBe(1);
    });
  });
});

describe.skipIf(!hasDb())("OAuth flow — state purge", () => {
  test("purges rows 24h past expiry or use, keeps everything fresher", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Purge Org" });
      const { svc } = service(db);

      const ancientId = "a".repeat(128);
      const usedRecentId = "b".repeat(128);
      const freshId = "c".repeat(128);
      await db.execute(sql`
        INSERT INTO oauth_states (id, organization_id, user_id, platform, expires_at, used_at, created_at)
        VALUES
          (${ancientId}, ${org.id}, ${owner.id}, 'youtube', now() - interval '25 hours', NULL, now() - interval '26 hours'),
          (${usedRecentId}, ${org.id}, ${owner.id}, 'youtube', now() + interval '5 minutes', now() - interval '25 hours', now() - interval '25 hours'),
          (${freshId}, ${org.id}, ${owner.id}, 'youtube', now() + interval '9 minutes', NULL, now())`);

      const { deleted } = await svc.purgeExpiredOAuthStates(db);
      expect(deleted).toBeGreaterThanOrEqual(2);
      const left = await db.execute(
        sql`SELECT count(*)::int AS n FROM oauth_states WHERE id IN (${ancientId}, ${usedRecentId}, ${freshId})`,
      );
      expect((left as any).rows[0].n).toBe(1);
      const survivors = await db.execute(
        sql`SELECT id FROM oauth_states WHERE id IN (${ancientId}, ${usedRecentId}, ${freshId})`,
      );
      expect((survivors as any).rows[0].id).toBe(freshId);
    });
  });
});
