/**
 * `/api/social` — the HTTP surface of the OAuth flow (NWB-P2-001).
 *
 * The no-DB describe pins the 401 wall and the platform param check. The DB describe drives the
 * full browser-shaped flow through the real app — sign-in cookie → initiate (201, authorize URL)
 * → public callback (302 to the state's relative `return_url`) → replay refused — with the
 * platform client faked, so no request ever leaves the process.
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

const EXCHANGE: OAuthExchangeResult = {
  accessToken: "route-test-access-token",
  refreshToken: "route-test-refresh-token",
  expiresInSeconds: 3600,
  scope: "https://www.googleapis.com/auth/youtube.readonly",
  platformUserId: "UC_route_1",
  platformUsername: "Route Channel",
  displayName: "Route Test",
  profileImageUrl: null,
  followerCount: 10,
};

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
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: { field: string }[] };
}

describe("social routes — no DB", () => {
  test("initiate is 401 without a session", async () => {
    const app = createTestApp();
    const res = await app.request("/api/social/oauth/youtube/initiate", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("an unsupported platform is a 422 param error on both routes", async () => {
    const app = createTestApp();
    const res = await app.request("/api/social/oauth/tiktok/initiate", {
      method: "POST",
      headers: { cookie: "session=whatever" },
    });
    expect(res.status).toBe(401); // auth wall first
    const cb = await app.request("/api/social/oauth/tiktok/callback?code=x&state=y");
    expect(cb.status).toBe(422);
    const body = (await cb.json()) as Envelope<unknown>;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});

describe.skipIf(!hasDb())("social routes — DB", () => {
  let app: App;
  let db: Db;
  let owner: { id: string; cookie: string };
  let manager: { id: string; cookie: string };
  let viewer: { id: string; cookie: string };
  let done: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const ctx = await createTestDb();
    db = ctx.db;
    done = ctx.done;

    setSocialServiceForTest(
      createSocialService({
        readEnv: (name) => CREDS[name],
        keyMaterial: derivedKeyMaterial("oauth-route-test-secret"),
        appBaseUrl: "http://localhost:3000",
        oauthClient: {
          async exchangeCode() {
            return EXCHANGE;
          },
        },
      }),
    );

    app = createTestApp(db);
    const ownerUser = await createTestUser(db, { firstName: "Social", lastName: "Owner" });
    const org = await createTestOrg(db, { ownerId: ownerUser.id, name: "Social Route Org" });
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: ownerUser.id,
      roleCode: "owner",
    });
    owner = { id: ownerUser.id, cookie: await cookieFor(app, ownerUser.email) };
    const mk = async (roleCode: string) => {
      const user = await createTestUser(db, { firstName: "Social", lastName: roleCode });
      await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
      return { id: user.id, cookie: await cookieFor(app, user.email) };
    };
    manager = await mk("manager");
    viewer = await mk("viewer");
  });

  afterAll(async () => {
    setSocialServiceForTest(undefined);
    if (done) await done();
  });

  test("initiate: 201 with authorize URL; viewer role is 403 (manager+ connects)", async () => {
    const res = await app.request("/api/social/oauth/youtube/initiate", {
      method: "POST",
      headers: { cookie: manager.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: "/settings/integrations" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Envelope<{ authorizeUrl: string }>;
    expect(body.data.authorizeUrl).toContain("accounts.google.com");
    expect(body.data.authorizeUrl).toContain("state=");
    expect(new URL(body.data.authorizeUrl).searchParams.get("code_challenge")).toBeTruthy();

    const denied = await app.request("/api/social/oauth/youtube/initiate", {
      method: "POST",
      headers: { cookie: viewer.cookie, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(denied.status).toBe(403);
  });

  test("the full flow: initiate → public callback → 302 to returnUrl; replay refused", async () => {
    const init = await app.request("/api/social/oauth/youtube/initiate", {
      method: "POST",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: "/settings/integrations?tab=connected" }),
    });
    expect(init.status).toBe(201);
    const { data } = (await init.json()) as Envelope<{ authorizeUrl: string }>;
    const state = new URL(data.authorizeUrl).searchParams.get("state")!;

    // No cookie — the platform's browser has no Nawebeus session (Module 3 §6.3).
    const cb = await app.request(
      `/api/social/oauth/youtube/callback?code=real-code&state=${encodeURIComponent(state)}`,
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.get("location")).toBe("/settings/integrations?tab=connected");
    const body = await cb.text();
    expect(body).not.toContain("route-test-access-token");

    // The account exists, tokens sealed.
    const row = await db.execute(sql`SELECT id, platform_username, status FROM social_accounts
      WHERE organization_id = (SELECT organization_id FROM oauth_states WHERE id = ${state})`);
    expect((row as any).rows.length).toBe(1);
    expect((row as any).rows[0].platform_username).toBe("Route Channel");

    // Replay: same callback again → generic error, no second row.
    const replay = await app.request(
      `/api/social/oauth/youtube/callback?code=real-code&state=${encodeURIComponent(state)}`,
    );
    expect(replay.status).toBe(422);
    const replayBody = (await replay.json()) as Envelope<unknown>;
    expect(replayBody.error?.message).toMatch(/invalid, expired, or already used/);
  });

  test("callback without code or state is the same generic error", async () => {
    const res = await app.request("/api/social/oauth/youtube/callback");
    expect(res.status).toBe(422);
    const body = (await res.json()) as Envelope<unknown>;
    expect(body.error?.message).toMatch(/missing its code or state/);
  });
});
