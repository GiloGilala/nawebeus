import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { signAccessToken } from "../../services/auth/jwt";
import { hashToken } from "../../services/auth/session";
import { getCurrentTOTP } from "../../services/auth/totp";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import {
  createTestMember,
  createTestOrg,
  createTestUser,
  systemRoleId,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

beforeAll(() => {
  for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  loadConfig();
});
afterAll(() => {
  for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
});

const hasDb = () => !!process.env.DATABASE_URL;

describe("POST /api/auth/mfa/verify-login — no DB (validation)", () => {
  test("missing body fields return 422", async () => {
    const res = await createTestApp().request("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  test("malformed code shape returns 422", async () => {
    const res = await createTestApp().request("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaSessionId: "x".repeat(64), code: "12" }),
    });
    expect(res.status).toBe(422);
  });

  test("well-formed body passes validation (no DB → 500, not 422)", async () => {
    const res = await createTestApp().request("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaSessionId: "x".repeat(64), code: "123456" }),
    });
    expect(res.status).not.toBe(422);
  });

  test("setup/status/verify-setup/disable without auth return 401", async () => {
    const app = createTestApp();
    for (const [path, method] of [
      ["/api/auth/mfa/setup", "POST"],
      ["/api/auth/mfa/status", "GET"],
      ["/api/auth/mfa/verify-setup", "POST"],
      ["/api/auth/mfa/disable", "POST"],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "123456" }),
      });
      expect(res.status).toBe(401);
    }
  });
});

describe.skipIf(!hasDb())("MFA login flow (integration)", () => {
  interface Fixture {
    app: ReturnType<typeof createTestApp>;
    db: Db;
    userId: string;
    email: string;
    password: string;
    orgId: string;
    cookie: string;
  }

  async function makeFixture(db: Db): Promise<Fixture> {
    const password = TEST_USER_PASSWORD;
    const user = await createTestUser(db, { password });
    const org = await createTestOrg(db, { ownerId: user.id });
    await db.execute(sql`UPDATE users SET organization_id = ${org.id} WHERE id = ${user.id}`);
    await createTestMember(db, {
      organizationId: org.id,
      userId: user.id,
      roleId: await systemRoleId(db, "owner"),
    });
    const token = await signAccessToken(user.id, org.id, getConfig().JWT_ACCESS_SECRET);
    return {
      app: createTestApp(db),
      db,
      userId: user.id,
      email: user.email,
      password: user.password,
      orgId: org.id,
      cookie: `nawebeus_access=${token}`,
    };
  }

  /** Enables MFA for the fixture user through the HTTP setup flow. */
  async function enableMfa(f: Fixture): Promise<{ secret: string; backupCodes: string[] }> {
    const setupRes = await f.app.request("/api/auth/mfa/setup", {
      method: "POST",
      headers: { cookie: f.cookie },
    });
    expect(setupRes.status).toBe(200);
    const setup = ((await setupRes.json()) as any).data;
    expect(setup.secret).toBeDefined();
    expect(setup.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.backupCodes).toHaveLength(10);

    const confirmRes = await f.app.request("/api/auth/mfa/verify-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: f.cookie },
      body: JSON.stringify({ token: await getCurrentTOTP(setup.secret) }),
    });
    expect(confirmRes.status).toBe(200);
    return { secret: setup.secret, backupCodes: setup.backupCodes };
  }

  /** Signs in (password only) and returns the challenge token. */
  async function signinChallenge(f: Fixture, ip = "10.0.0.1"): Promise<string> {
    const res = await f.app.request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": ip },
      body: JSON.stringify({ email: f.email, password: f.password }),
    });
    expect(res.status).toBe(200);
    const json = ((await res.json()) as any).data;
    expect(json.requiresMfa).toBe(true);
    return json.mfaSessionId as string;
  }

  async function verifyLogin(
    f: Fixture,
    mfaSessionId: string,
    code: string,
    ip = "10.0.0.1",
  ): Promise<Response> {
    return f.app.request("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": ip },
      body: JSON.stringify({ mfaSessionId, code }),
    });
  }

  function accessCookieFrom(res: Response): string | null {
    for (const c of res.headers.getSetCookie()) {
      const match = /^nawebeus_access=([^;]+)/.exec(c);
      if (match?.[1]) return `nawebeus_access=${match[1]}`;
    }
    return null;
  }

  /** A TOTP code guaranteed to differ from the currently valid one. */
  async function wrongTotp(secret: string): Promise<string> {
    const valid = await getCurrentTOTP(secret);
    return valid === "000000" ? "000001" : "000000";
  }

  test("full flow: signin → challenge → verify → cookies + working session", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);

      const challengeRes = await f.app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.1.1" },
        body: JSON.stringify({ email: f.email, password: f.password }),
      });
      expect(challengeRes.status).toBe(200);
      const challenge = ((await challengeRes.json()) as any).data;
      expect(challenge.requiresMfa).toBe(true);
      expect(challenge.mfaMethod).toBe("totp");
      expect(typeof challenge.mfaSessionId).toBe("string");
      expect(challenge.mfaSessionId.length).toBeGreaterThan(16);
      // The old response leaked the userId as `sessionId` — gone.
      expect("sessionId" in challenge).toBe(false);
      // No session yet: the challenge response must not set cookies.
      expect(challengeRes.headers.getSetCookie()).toHaveLength(0);

      const verifyRes = await verifyLogin(
        f,
        challenge.mfaSessionId,
        await getCurrentTOTP(secret),
        "10.0.1.1",
      );
      expect(verifyRes.status).toBe(200);
      const verified = ((await verifyRes.json()) as any).data;
      expect(verified.user).toEqual({ id: f.userId, orgId: f.orgId });

      const setCookies = verifyRes.headers.getSetCookie().join(";");
      expect(setCookies).toContain("nawebeus_access=");
      expect(setCookies).toContain("nawebeus_refresh=");

      // The issued session actually works.
      const sessionCookie = accessCookieFrom(verifyRes);
      expect(sessionCookie).not.toBeNull();
      const statusRes = await f.app.request("/api/auth/mfa/status", {
        headers: { cookie: sessionCookie! },
      });
      expect(statusRes.status).toBe(200);
      expect(((await statusRes.json()) as any).data.enabled).toBe(true);
    });
  });

  test("AC8: 3 wrong codes → 401s, 4th attempt → 429 even with the right code", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);
      const mfaSessionId = await signinChallenge(f, "10.0.2.1");

      for (let i = 0; i < 3; i++) {
        const res = await verifyLogin(f, mfaSessionId, await wrongTotp(secret), "10.0.2.1");
        expect(res.status).toBe(401);
      }

      const blocked = await verifyLogin(f, mfaSessionId, await getCurrentTOTP(secret), "10.0.2.1");
      expect(blocked.status).toBe(429);
      const json = (await blocked.json()) as any;
      expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.error.details.retryAfter).toBe(900);
    });
  });

  test("backup code from the displayed set works once, then is consumed", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { backupCodes } = await enableMfa(f);

      const statusBefore = await f.app.request("/api/auth/mfa/status", {
        headers: { cookie: f.cookie },
      });
      expect(((await statusBefore.json()) as any).data.backupCodesRemaining).toBe(10);

      const mfaSessionId = await signinChallenge(f, "10.0.3.1");
      const ok = await verifyLogin(f, mfaSessionId, backupCodes[0]!, "10.0.3.1");
      expect(ok.status).toBe(200);
      expect(accessCookieFrom(ok)).not.toBeNull();

      const statusAfter = await f.app.request("/api/auth/mfa/status", {
        headers: { cookie: f.cookie },
      });
      expect(((await statusAfter.json()) as any).data.backupCodesRemaining).toBe(9);

      // Same code on a fresh challenge is rejected — single-use.
      const mfaSessionId2 = await signinChallenge(f, "10.0.3.1");
      const replay = await verifyLogin(f, mfaSessionId2, backupCodes[0]!, "10.0.3.1");
      expect(replay.status).toBe(401);
    });
  });

  test("AC4: stored backup codes are hashes of exactly the displayed set", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { backupCodes } = await enableMfa(f);

      const rows = await db.execute<{ two_factor_backup_codes: string[] }>(
        sql`SELECT two_factor_backup_codes FROM users WHERE id = ${f.userId}`,
      );
      const stored = (((rows as any).rows?.[0] as any)?.two_factor_backup_codes ?? []) as string[];
      expect(stored).toHaveLength(10);
      // Nothing stored in plaintext…
      for (const code of backupCodes) expect(stored).not.toContain(code);
      // …and the stored set is exactly the displayed set, hashed.
      const expected = await Promise.all(backupCodes.map((c) => hashToken(c)));
      expect([...stored].sort()).toEqual([...expected].sort());
    });
  });

  test("abandoned re-setup leaves the active MFA intact; confirm promotes", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const first = await enableMfa(f);

      // Start setup again but never confirm: stages a *new* secret.
      const restageRes = await f.app.request("/api/auth/mfa/setup", {
        method: "POST",
        headers: { cookie: f.cookie },
      });
      expect(restageRes.status).toBe(200);
      const restaged = ((await restageRes.json()) as any).data;
      expect(restaged.secret).not.toBe(first.secret);

      // The OLD secret still completes a login…
      const mfaSessionId = await signinChallenge(f, "10.0.4.1");
      const withOld = await verifyLogin(
        f,
        mfaSessionId,
        await getCurrentTOTP(first.secret),
        "10.0.4.1",
      );
      expect(withOld.status).toBe(200);

      // …while the staged secret is not yet valid for login.
      const mfaSessionId2 = await signinChallenge(f, "10.0.4.2");
      const withStaged = await verifyLogin(
        f,
        mfaSessionId2,
        await getCurrentTOTP(restaged.secret),
        "10.0.4.2",
      );
      expect(withStaged.status).toBe(401);

      // Confirming promotes the staged secret: new works, old dies.
      const confirmRes = await f.app.request("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: f.cookie },
        body: JSON.stringify({ token: await getCurrentTOTP(restaged.secret) }),
      });
      expect(confirmRes.status).toBe(200);

      const mfaSessionId3 = await signinChallenge(f, "10.0.4.3");
      const withNew = await verifyLogin(
        f,
        mfaSessionId3,
        await getCurrentTOTP(restaged.secret),
        "10.0.4.3",
      );
      expect(withNew.status).toBe(200);

      const mfaSessionId4 = await signinChallenge(f, "10.0.4.4");
      const withRetired = await verifyLogin(
        f,
        mfaSessionId4,
        await getCurrentTOTP(first.secret),
        "10.0.4.4",
      );
      expect(withRetired.status).toBe(401);
    });
  });

  test("challenge is single-use: replay after success is rejected", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);
      const mfaSessionId = await signinChallenge(f, "10.0.5.1");

      const ok = await verifyLogin(f, mfaSessionId, await getCurrentTOTP(secret), "10.0.5.1");
      expect(ok.status).toBe(200);

      const replay = await verifyLogin(f, mfaSessionId, await getCurrentTOTP(secret), "10.0.5.1");
      expect(replay.status).toBe(401);
      expect(((await replay.json()) as any).error.message).toMatch(/expired|invalid/i);
    });
  });

  test("expired challenge is rejected", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);
      const mfaSessionId = await signinChallenge(f, "10.0.6.1");

      await db.execute(
        sql`UPDATE tokens SET expires_at = now() - interval '1 minute' WHERE selector = ${mfaSessionId}`,
      );

      const res = await verifyLogin(f, mfaSessionId, await getCurrentTOTP(secret), "10.0.6.1");
      expect(res.status).toBe(401);
    });
  });

  test("a fresh signin revokes the previous challenge", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);
      const first = await signinChallenge(f, "10.0.7.1");
      const second = await signinChallenge(f, "10.0.7.1");
      expect(second).not.toBe(first);

      const stale = await verifyLogin(f, first, await getCurrentTOTP(secret), "10.0.7.1");
      expect(stale.status).toBe(401);

      const fresh = await verifyLogin(f, second, await getCurrentTOTP(secret), "10.0.7.1");
      expect(fresh.status).toBe(200);
    });
  });

  test("single-shot signin with a TOTP code completes directly; wrong code fails", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);

      const ok = await f.app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.8.1" },
        body: JSON.stringify({
          email: f.email,
          password: f.password,
          mfaCode: await getCurrentTOTP(secret),
        }),
      });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as any).data.user).toEqual({ id: f.userId, orgId: f.orgId });
      expect(accessCookieFrom(ok)).not.toBeNull();

      // Regression: the old path never awaited the TOTP check, so ANY 6-char
      // code was accepted. A wrong code must fail.
      const bad = await f.app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.8.2" },
        body: JSON.stringify({
          email: f.email,
          password: f.password,
          mfaCode: await wrongTotp(secret),
        }),
      });
      expect(bad.status).toBe(401);
    });
  });

  test("single-shot signin with a backup code works and shares the AC8 budget", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { backupCodes, secret } = await enableMfa(f);

      const attempt = (mfaCode: string) =>
        f.app.request("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.9.1" },
          body: JSON.stringify({ email: f.email, password: f.password, mfaCode }),
        });

      // Three failures through the single-shot path…
      for (let i = 0; i < 3; i++) {
        expect((await attempt(await wrongTotp(secret))).status).toBe(401);
      }
      // …exhaust the budget the challenge path shares: even a valid backup
      // code is now rate-limited rather than verified.
      expect((await attempt(backupCodes[0]!)).status).toBe(429);

      // From a fresh IP the backup code completes the login in one request.
      const freshIp = await f.app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.9.2" },
        body: JSON.stringify({ email: f.email, password: f.password, mfaCode: backupCodes[0]! }),
      });
      expect(freshIp.status).toBe(200);
    });
  });

  test("signin without MFA is unaffected: direct session, no challenge", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const res = await f.app.request("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cf-Connecting-Ip": "10.0.10.1" },
        body: JSON.stringify({ email: f.email, password: f.password }),
      });
      expect(res.status).toBe(200);
      const json = ((await res.json()) as any).data;
      expect("requiresMfa" in json).toBe(false);
      expect(json.user).toEqual({ id: f.userId, orgId: f.orgId });
      expect(accessCookieFrom(res)).not.toBeNull();
    });
  });

  test("setup confirmation rejects a wrong code and requires an initiated setup", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);

      // No setup initiated at all.
      const uninitiated = await f.app.request("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: f.cookie },
        body: JSON.stringify({ token: "123456" }),
      });
      expect(uninitiated.status).toBe(401);

      // Setup initiated, wrong confirmation code.
      const setupRes = await f.app.request("/api/auth/mfa/setup", {
        method: "POST",
        headers: { cookie: f.cookie },
      });
      expect(setupRes.status).toBe(200);
      const { secret } = ((await setupRes.json()) as any).data;

      const wrong = await f.app.request("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: f.cookie },
        body: JSON.stringify({ token: await wrongTotp(secret) }),
      });
      expect(wrong.status).toBe(401);

      // MFA must not be enabled by the failed confirmation.
      const statusRes = await f.app.request("/api/auth/mfa/status", {
        headers: { cookie: f.cookie },
      });
      expect(((await statusRes.json()) as any).data.enabled).toBe(false);
    });
  });

  test("stale staged setup expires and must be restarted", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const setupRes = await f.app.request("/api/auth/mfa/setup", {
        method: "POST",
        headers: { cookie: f.cookie },
      });
      const { secret } = ((await setupRes.json()) as any).data;

      await db.execute(
        sql`UPDATE users SET pending_two_factor_expires_at = now() - interval '1 minute' WHERE id = ${f.userId}`,
      );

      const confirmRes = await f.app.request("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: f.cookie },
        body: JSON.stringify({ token: await getCurrentTOTP(secret) }),
      });
      expect(confirmRes.status).toBe(401);
      expect(((await confirmRes.json()) as any).error.message).toMatch(/expired/i);
    });
  });

  test("AC9: enable, verified, failed, and signin completions are audited", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { secret } = await enableMfa(f);

      const mfaSessionId = await signinChallenge(f, "10.0.11.1");
      const bad = await verifyLogin(f, mfaSessionId, await wrongTotp(secret), "10.0.11.1");
      expect(bad.status).toBe(401);
      const good = await verifyLogin(f, mfaSessionId, await getCurrentTOTP(secret), "10.0.11.1");
      expect(good.status).toBe(200);

      const rows = await db.execute<{ action: string }>(
        sql`SELECT action FROM unified_audit_log WHERE actor_id = ${f.userId} ORDER BY created_at`,
      );
      const actions = ((rows as any).rows as any[]).map((r) => r.action as string);
      expect(actions).toContain("auth.mfa.enabled");
      expect(actions).toContain("auth.mfa.failed");
      expect(actions).toContain("auth.mfa.verified");
      expect(actions).toContain("auth.signin.completed");
    });
  });
});
