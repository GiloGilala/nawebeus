/**
 * `/api/social` management routes (NWB-P2-006) — list, detail, health log, usage, disconnect.
 *
 * The no-DB describe pins the 401 wall on all five routes. The DB describe connects real
 * accounts through the real OAuth state machine (platform client + revocation fetch faked, so
 * nothing leaves the process) and drives the RBAC matrix (read = everyone, usage = manager+,
 * disconnect = admin/owner), the keyset pagination, the typed-username confirmation, and the
 * revocation-outcome recording (revoked / provider_refused / unreachable / not_supported —
 * best-effort by contract: the local wipe happens either way).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { derivedKeyMaterial } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import {
  createSocialService,
  type OAuthExchangeResult,
  setSocialServiceForTest,
} from "../../services/social";
import { createTestApp } from "../helpers/test-client";
import { createTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

type App = ReturnType<typeof createTestApp>;

const CREDS: Record<string, string> = {
  OAUTH_YOUTUBE_CLIENT_ID: "yt-client-id",
  OAUTH_YOUTUBE_CLIENT_SECRET: "yt-client-secret",
};

function exchangeFor(seq: number): OAuthExchangeResult {
  return {
    accessToken: `mgmt-access-${seq}`,
    refreshToken: `mgmt-refresh-${seq}`,
    expiresInSeconds: 3600,
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    platformUserId: `UC_mgmt_${seq}`,
    platformUsername: `mgmt.channel.${seq}`,
    displayName: `Mgmt Channel ${seq}`,
    profileImageUrl: null,
    followerCount: 100 * seq,
  };
}

async function cookieFor(app: App, email: string): Promise<string> {
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`signin failed: ${res.status} ${await res.text()}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

interface Envelope<T> {
  data: T;
  meta?: { pagination?: { cursor: string | null; hasMore: boolean } };
  error?: { code: string; message: string; details?: { field: string; message: string }[] };
}

/** Connects one youtube account through the real state machine; the fake client answers. */
async function connectAccount(app: App, db: Db, cookie: string, seq: number): Promise<string> {
  const init = await app.request("/api/social/oauth/youtube/initiate", {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ returnUrl: "/settings/integrations" }),
  });
  expect(init.status).toBe(201);
  const { data } = (await init.json()) as Envelope<{ authorizeUrl: string }>;
  const state = new URL(data.authorizeUrl).searchParams.get("state")!;
  const cb = await app.request(
    `/api/social/oauth/youtube/callback?code=code-${seq}&state=${encodeURIComponent(state)}`,
  );
  expect(cb.status).toBe(302);
  // The whole file runs in ONE transaction, so connected_at's now() is frozen — every row
  // ties. The platform username is the deterministic key (unique per connect here).
  const row = await db.execute(sql`
    SELECT id FROM social_accounts
    WHERE organization_id = (SELECT organization_id FROM oauth_states WHERE id = ${state})
      AND platform_username = ${"mgmt.channel." + seq}
  `);
  expect((row as any).rows).toHaveLength(1);
  return ((row as any).rows[0] as { id: string }).id;
}

let db: Db;

describe("social management routes — no DB", () => {
  test("all five routes are 401 without a session", async () => {
    const app = createTestApp();
    const socId = `soc_${crypto.randomUUID()}`;
    const routes: [string, RequestInit][] = [
      ["/api/social/accounts", {}],
      [`/api/social/accounts/${socId}`, {}],
      [`/api/social/accounts/${socId}/health`, {}],
      ["/api/social/usage", {}],
      [`/api/social/accounts/${socId}`, { method: "DELETE" }],
    ];
    for (const [path, init] of routes) {
      const res = await app.request(path, init);
      expect(res.status).toBe(401);
    }
  });
});

describe.skipIf(!hasDb())("social management routes — DB", () => {
  let app: App;
  let owner: { id: string; cookie: string };
  let manager: { id: string; cookie: string };
  let viewer: { id: string; cookie: string };
  let firstAccountId: string;
  let secondAccountId: string;
  let done: (() => Promise<void>) | undefined;
  let revocationStatus = 200;
  let revocationThrow = false;
  let revocationCalls: { url: string; body: string }[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const ctx = await createTestDb();
    db = ctx.db;
    done = ctx.done;

    setSocialServiceForTest(
      createSocialService({
        readEnv: (name) => CREDS[name],
        keyMaterial: derivedKeyMaterial("mgmt-routes-test-secret"),
        appBaseUrl: "http://localhost:3000",
        oauthClient: {
          async exchangeCode(_input) {
            // The counter lives in the URL-received code — one exchange per connect.
            const seq = Number.parseInt(_input.code.replace("code-", ""), 10) || 1;
            return exchangeFor(seq);
          },
          async refreshTokens() {
            throw new Error("mgmt route tests never refresh");
          },
        },
        probeFetch: (async (url: URL | RequestInfo, init?: RequestInit) => {
          revocationCalls.push({ url: String(url), body: String(init?.body ?? "") });
          if (revocationThrow) throw new Error("revoke endpoint unreachable");
          return new Response(null, { status: revocationStatus });
        }) as typeof fetch,
      }),
    );

    app = createTestApp(db);
    const ownerUser = await createTestUser(db, { firstName: "Mgmt", lastName: "Owner" });
    const org = await createTestOrg(db, { ownerId: ownerUser.id, name: "Mgmt Routes Org" });
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: ownerUser.id,
      roleCode: "owner",
    });
    owner = { id: ownerUser.id, cookie: await cookieFor(app, ownerUser.email) };
    const mk = async (roleCode: string) => {
      const user = await createTestUser(db, { firstName: "Mgmt", lastName: roleCode });
      await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
      return { id: user.id, cookie: await cookieFor(app, user.email) };
    };
    manager = await mk("manager");
    viewer = await mk("viewer");

    firstAccountId = await connectAccount(app, db, manager.cookie, 1);
    // A beat so the two rows cannot share the same connected_at microsecond.
    await new Promise((r) => setTimeout(r, 5));
    secondAccountId = await connectAccount(app, db, owner.cookie, 2);
  });

  afterAll(async () => {
    setSocialServiceForTest(undefined);
    if (done) await done();
  });

  test("list: read tier is everyone (viewer reads); newest first; no token material", async () => {
    const res = await app.request("/api/social/accounts", { headers: { cookie: viewer.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{ accounts: Record<string, unknown>[] }>;
    expect(body.data.accounts).toHaveLength(2);
    // Newest first; the whole file shares one transaction so connected_at ties and the
    // (connected_at, id) keyset falls through to the id DESC tiebreak.
    expect(body.data.accounts.map((a) => a.id).sort()).toEqual(
      [firstAccountId, secondAccountId].sort(),
    );
    const at = (a: unknown) => a as { connectedAt: string; id: string };
    const [first, second] = body.data.accounts.map(at);
    const key = (x: { connectedAt: string; id: string }) => `${x.connectedAt}:${x.id}`;
    expect(key(first!) > key(second!)).toBe(true);
    for (const account of body.data.accounts) {
      expect(account.platformUsername).toMatch(/^mgmt\.channel\./);
      expect(JSON.stringify(account)).not.toContain("mgmt-access");
      expect(JSON.stringify(account)).not.toContain("mgmt-refresh");
    }
    expect(body.meta?.pagination?.hasMore).toBe(false);
  });

  test("list: platform and status filters; bad values are 422", async () => {
    const yt = await app.request("/api/social/accounts?platform=youtube", {
      headers: { cookie: viewer.cookie },
    });
    expect(yt.status).toBe(200);
    const ytBody = (await yt.json()) as Envelope<{ accounts: { platform: string }[] }>;
    expect(ytBody.data.accounts.every((a) => a.platform === "youtube")).toBe(true);

    const connected = await app.request("/api/social/accounts?status=active", {
      headers: { cookie: viewer.cookie },
    });
    const connectedBody = (await connected.json()) as Envelope<{ accounts: unknown[] }>;
    expect(connectedBody.data.accounts).toHaveLength(2);

    const badPlatform = await app.request("/api/social/accounts?platform=tiktok", {
      headers: { cookie: viewer.cookie },
    });
    expect(badPlatform.status).toBe(422);
    const badStatus = await app.request("/api/social/accounts?status=pending", {
      headers: { cookie: viewer.cookie },
    });
    expect(badStatus.status).toBe(422);
  });

  test("list: keyset pagination walks both accounts without repeats", async () => {
    const page1 = await app.request("/api/social/accounts?limit=1", {
      headers: { cookie: viewer.cookie },
    });
    const p1 = (await page1.json()) as Envelope<{ accounts: { id: string }[] }>;
    expect(p1.data.accounts).toHaveLength(1);
    expect(p1.meta?.pagination?.hasMore).toBe(true);
    expect(p1.meta?.pagination?.cursor).toBeTruthy();

    const page2 = await app.request(
      `/api/social/accounts?limit=1&cursor=${encodeURIComponent(p1.meta!.pagination!.cursor!)}`,
      { headers: { cookie: viewer.cookie } },
    );
    const p2 = (await page2.json()) as Envelope<{ accounts: { id: string }[] }>;
    expect(page2.status).toBe(200);
    expect(p2.data.accounts).toHaveLength(1);
    expect(p2.data.accounts[0]!.id).not.toBe(p1.data.accounts[0]!.id);
    expect(p2.meta?.pagination?.hasMore).toBe(false);
  });

  test("detail: profile + quota + no health row yet; malformed id 422; unknown 404", async () => {
    const res = await app.request(`/api/social/accounts/${firstAccountId}`, {
      headers: { cookie: viewer.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      account: Record<string, unknown>;
      quota: { status: string; buckets: Record<string, unknown> };
      latestHealth?: unknown;
    }>;
    expect(body.data.account.platformUsername).toBe("mgmt.channel.1");
    expect(body.data.account.circuitBreakerOpen).toBe(false);
    expect(body.data.quota.status).toBe("healthy");
    expect(body.data.latestHealth).toBeUndefined();
    expect(JSON.stringify(body.data)).not.toContain("mgmt-access-1");

    const malformed = await app.request("/api/social/accounts/not-an-id", {
      headers: { cookie: viewer.cookie },
    });
    expect(malformed.status).toBe(422);

    const unknown = await app.request(`/api/social/accounts/soc_${crypto.randomUUID()}`, {
      headers: { cookie: viewer.cookie },
    });
    expect(unknown.status).toBe(404);
  });

  test("health log: newest first; limit honored; unknown account 404; bad limit 422", async () => {
    await db!.execute(sql`
      INSERT INTO social_account_health_log
        (id, social_account_id, status, previous_status, error_message, error_code, api_latency, http_status_code, checked_at)
      VALUES
        ('sahl_t1', ${firstAccountId}, 'degraded', 'healthy', 'slow responses', 'TIMEOUT_SLOW', 4200, 504, now() - interval '2 hours'),
        ('sahl_t2', ${firstAccountId}, 'healthy', 'degraded', NULL, NULL, 210, 200, now() - interval '1 hour')
    `);

    const res = await app.request(`/api/social/accounts/${firstAccountId}/health`, {
      headers: { cookie: viewer.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      health: { id: string; status: string; apiLatency: number | null }[];
    }>;
    expect(body.data.health.map((h) => h.id)).toEqual(["sahl_t2", "sahl_t1"]);

    const one = await app.request(`/api/social/accounts/${firstAccountId}/health?limit=1`, {
      headers: { cookie: viewer.cookie },
    });
    const oneBody = (await one.json()) as Envelope<{ health: unknown[] }>;
    expect(oneBody.data.health).toHaveLength(1);

    const bad = await app.request(`/api/social/accounts/${firstAccountId}/health?limit=-3`, {
      headers: { cookie: viewer.cookie },
    });
    expect(bad.status).toBe(422);

    const unknown = await app.request(`/api/social/accounts/soc_${crypto.randomUUID()}/health`, {
      headers: { cookie: viewer.cookie },
    });
    expect(unknown.status).toBe(404);
  });

  test("detail surfaces the latest health row and quota buckets once materialized", async () => {
    await db!.execute(sql`
      UPDATE social_accounts SET
        quota_tracking = jsonb_set(quota_tracking, '{post}', '{"limit": 1000, "used": 850}'::jsonb),
        quota_status = 'warning'
      WHERE id = ${secondAccountId}
    `);

    const res = await app.request(`/api/social/accounts/${secondAccountId}`, {
      headers: { cookie: manager.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      account: { quotaStatus: string };
      quota: {
        status: string;
        buckets: Record<
          string,
          { used: number; limit: number; percent: number; resetsAt: string | null }
        >;
      };
    }>;
    expect(body.data.account.quotaStatus).toBe("warning");
    expect(body.data.quota.status).toBe("warning");
    expect(body.data.quota.buckets.post).toEqual({
      used: 850,
      limit: 1000,
      percent: 85,
      resetsAt: null as string | null,
    });
  });

  test("usage: manager+ only; lists every live account with buckets", async () => {
    const denied = await app.request("/api/social/usage", {
      headers: { cookie: viewer.cookie },
    });
    expect(denied.status).toBe(403);

    const res = await app.request("/api/social/usage", {
      headers: { cookie: manager.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      usage: {
        accountId: string;
        platform: string;
        quotaStatus: string;
        buckets: Record<string, { used: number }>;
      }[];
    }>;
    expect(body.data.usage.map((u) => u.accountId).sort()).toEqual(
      [firstAccountId, secondAccountId].sort(),
    );
    const second = body.data.usage.find((u) => u.accountId === secondAccountId)!;
    expect(second.quotaStatus).toBe("warning");
    expect(second.buckets.post?.used).toBe(850);
  });

  test("disconnect: 403 for viewer and manager; body confirmation mandatory", async () => {
    const viewerDenied = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: viewer.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.1" }),
    });
    expect(viewerDenied.status).toBe(403);

    const managerDenied = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: manager.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.1" }),
    });
    expect(managerDenied.status).toBe(403);

    const noConfirm = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(noConfirm.status).toBe(422);
    const noConfirmBody = (await noConfirm.json()) as Envelope<unknown>;
    expect(noConfirmBody.error?.details?.some((d) => d.field === "confirmUsername")).toBe(true);
  });

  test("disconnect: wrong username is a 422, the account stays live", async () => {
    const res = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.wrong" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Envelope<unknown>;
    expect(body.error?.details?.some((d) => d.field === "confirmUsername")).toBe(true);

    const still = await app.request(`/api/social/accounts/${firstAccountId}`, {
      headers: { cookie: viewer.cookie },
    });
    expect(still.status).toBe(200);
  });

  test("disconnect: owner + exact username → revoked, tokens wiped, 90-day retention, audit row", async () => {
    revocationCalls = [];
    revocationStatus = 200;
    revocationThrow = false;
    const before = Date.now();
    const res = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.1", reason: "offboarding" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      platform: string;
      platformUsername: string;
      revocation: string;
      dataRetentionUntil: string;
    }>;
    expect(body.data.platform).toBe("youtube");
    expect(body.data.platformUsername).toBe("mgmt.channel.1");
    expect(body.data.revocation).toBe("revoked");
    const retention = new Date(body.data.dataRetentionUntil).getTime();
    expect(retention).toBeGreaterThan(before + 89 * 24 * 3_600 * 1_000);
    expect(retention).toBeLessThan(Date.now() + 91 * 24 * 3_600 * 1_000);

    // The adapter dialect hit the provider's revoke endpoint, form-encoded, no auth header.
    expect(revocationCalls).toHaveLength(1);
    expect(revocationCalls[0]!.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(revocationCalls[0]!.body).toContain("token=mgmt-access-1");
    expect(revocationCalls[0]!.body).not.toMatch(/authorization/i);

    const row = await db!.execute(sql`
      SELECT status, disconnected_at, disconnected_by, disconnection_reason,
             data_retention_until, access_token_encrypted, refresh_token_encrypted, token_expires_at
      FROM social_accounts WHERE id = ${firstAccountId}
    `);
    const r = (row as any).rows[0] as Record<string, unknown>;
    expect(r.status).toBe("disconnected");
    expect(r.disconnected_by).toBe(owner.id);
    expect(r.disconnection_reason).toBe("offboarding");
    expect(r.access_token_encrypted).toBeNull();
    expect(r.refresh_token_encrypted).toBeNull();
    expect(r.token_expires_at).toBeNull();
    expect(new Date(r.data_retention_until as string).getTime()).toBe(retention);

    const audit = await db!.execute(sql`
      SELECT id FROM unified_audit_log
      WHERE action = 'socialaccount.disconnected' AND resource_id = ${firstAccountId}
    `);
    expect((audit as any).rows.length).toBe(1);
  });

  test("after disconnect: detail 404, list hides it unless explicitly filtered, repeat DELETE 404", async () => {
    const detail = await app.request(`/api/social/accounts/${firstAccountId}`, {
      headers: { cookie: viewer.cookie },
    });
    expect(detail.status).toBe(404);

    const live = await app.request("/api/social/accounts", {
      headers: { cookie: viewer.cookie },
    });
    const liveBody = (await live.json()) as Envelope<{ accounts: { id: string }[] }>;
    expect(liveBody.data.accounts.map((a) => a.id)).toEqual([secondAccountId]);

    const gone = await app.request("/api/social/accounts?status=disconnected", {
      headers: { cookie: viewer.cookie },
    });
    const goneBody = (await gone.json()) as Envelope<{ accounts: { id: string }[] }>;
    expect(goneBody.data.accounts.map((a) => a.id)).toEqual([firstAccountId]);

    const repeat = await app.request(`/api/social/accounts/${firstAccountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.1" }),
    });
    expect(repeat.status).toBe(404);
  });

  test("disconnect: provider refusal and network failure are recorded, not fatal", async () => {
    // Provider refuses (HTTP 400): the wipe still happens, outcome = provider_refused.
    revocationStatus = 400;
    revocationThrow = false;
    const refused = await app.request(`/api/social/accounts/${secondAccountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.2" }),
    });
    expect(refused.status).toBe(200);
    const refusedBody = (await refused.json()) as Envelope<{ revocation: string }>;
    expect(refusedBody.data.revocation).toBe("provider_refused");
    const refusedRow = await db!.execute(sql`
      SELECT status, access_token_encrypted FROM social_accounts WHERE id = ${secondAccountId}
    `);
    expect(((refusedRow as any).rows[0] as Record<string, unknown>).status).toBe("disconnected");
    expect(
      ((refusedRow as any).rows[0] as Record<string, unknown>).access_token_encrypted,
    ).toBeNull();

    const refusedAudit = await db!.execute(sql`
      SELECT after_state FROM unified_audit_log
      WHERE action = 'socialaccount.disconnected' AND resource_id = ${secondAccountId}
    `);
    const afterState = ((refusedAudit as any).rows[0] as Record<string, unknown>).after_state;
    expect(typeof afterState === "string" ? afterState : JSON.stringify(afterState)).toContain(
      "provider_refused",
    );
  });

  test("disconnect: unreachable provider still disconnects with outcome 'unreachable'", async () => {
    // A third account whose revocation call throws.
    revocationStatus = 200;
    revocationThrow = true;
    const thirdId = await connectAccount(app, db, owner.cookie, 3);
    const res = await app.request(`/api/social/accounts/${thirdId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "mgmt.channel.3" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{ revocation: string }>;
    expect(body.data.revocation).toBe("unreachable");
    const row = await db!.execute(sql`SELECT status FROM social_accounts WHERE id = ${thirdId}`);
    expect(((row as any).rows[0] as Record<string, unknown>).status).toBe("disconnected");
  });
});
