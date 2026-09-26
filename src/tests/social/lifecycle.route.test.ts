/**
 * Social account lifecycle routes (NWB-P2-007) — pause / resume, the on-demand health probe,
 * the per-account quota read, the list's `attention` filter, the disconnect's `dryRun` impact
 * preview, and the two notification hops (FR-SOC-008 on connect, FR-SOC-022 on `needs_reauth`).
 *
 * It also carries the regressions for the two bugs this ticket found in the merged P2-006:
 * a reconnect that left the circuit breaker open (B2) and a re-surfaced `needs_reauth` that
 * aborted its caller's transaction on `chk_sahl_transition_differs` (B1).
 *
 * Same harness as `routes.test.ts`: one transaction for the file, real OAuth state machine, the
 * platform client and every outbound `fetch` scripted so nothing leaves the process. The notifier
 * is a recorder by default — the tests that exercise the *production* notifier spy on
 * `emailService.send` instead, which is the seam the email suite already uses.
 */
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { derivedKeyMaterial } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import { emailService } from "../../services/email";
import {
  createSocialService,
  type OAuthExchangeResult,
  type SocialNotificationEvent,
  setSocialNotifierForTest,
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
  OAUTH_YOUTUBE_CLIENT_ID: "lc-client-id",
  OAUTH_YOUTUBE_CLIENT_SECRET: "lc-client-secret",
};

function exchangeFor(seq: number): OAuthExchangeResult {
  return {
    accessToken: `lc-access-${seq}`,
    refreshToken: `lc-refresh-${seq}`,
    expiresInSeconds: 3600,
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    platformUserId: `UC_lc_${seq}`,
    platformUsername: `lifecycle.channel.${seq}`,
    displayName: `Lifecycle Channel ${seq}`,
    profileImageUrl: null,
    followerCount: 10 * seq,
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
  meta?: { pagination?: { cursor: string | null; hasMore: boolean }; attentionCount?: number };
  error?: { code: string; message: string; details?: { field: string; message: string }[] };
}

/** Strings that must never appear in a response body (FR-SOC-023 / BR-SOC-016). */
const TOKEN_MATERIAL = ["lc-access-", "lc-refresh-", "access_token_encrypted", "refresh_token"];

let db: Db;

describe("social lifecycle routes — no DB", () => {
  test("every new route is 401 without a session", async () => {
    const app = createTestApp();
    const socId = `soc_${crypto.randomUUID()}`;
    const routes: [string, RequestInit][] = [
      [`/api/social/accounts/${socId}/usage`, {}],
      [`/api/social/accounts/${socId}/health-check`, { method: "POST" }],
      [`/api/social/accounts/${socId}/pause`, { method: "POST" }],
      [`/api/social/accounts/${socId}/resume`, { method: "POST" }],
      [`/api/social/accounts/${socId}?dryRun=true`, { method: "DELETE" }],
    ];
    for (const [path, init] of routes) {
      const res = await app.request(path, init);
      expect(res.status).toBe(401);
    }
  });
});

describe.skipIf(!hasDb())("social lifecycle routes — DB", () => {
  let app: App;
  let orgId: string;
  let owner: { id: string; cookie: string };
  let admin: { id: string; cookie: string };
  let manager: { id: string; cookie: string };
  let creator: { id: string; cookie: string };
  let viewer: { id: string; cookie: string };
  let otherOrgUser: { id: string; cookie: string };
  let done: (() => Promise<void>) | undefined;

  /** Every outbound fetch the service makes: probes and provider revocations. */
  let probeStatus = 200;
  const probeThrow = false;
  let fetchCalls: { url: string; body: string }[] = [];

  /** The recording notifier: what the service asked to be delivered, in order. */
  let notifications: SocialNotificationEvent[] = [];
  let notifierThrows = false;

  let restoreEmailSpy: (() => void) | undefined;
  const sentEmails: { to: string[]; subject: string; kind: string; html: string }[] = [];

  /** Connects one youtube account through the real state machine; returns its id. */
  async function connectAccount(cookie: string, seq: number): Promise<string> {
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
    // One transaction for the whole file, so connected_at's now() is frozen and every row ties —
    // the platform username is the deterministic key (unique per connect here).
    const row = await db.execute(sql`
      SELECT id FROM social_accounts
      WHERE organization_id = ${orgId} AND platform_username = ${"lifecycle.channel." + seq}
    `);
    expect((row as any).rows).toHaveLength(1);
    return ((row as any).rows[0] as { id: string }).id;
  }

  async function accountRow(accountId: string): Promise<Record<string, unknown>> {
    const rows = await db.execute(sql`
      SELECT status, is_active, circuit_breaker_open, circuit_breaker_opened_at,
             data_retention_until, access_token_encrypted, refresh_token_encrypted,
             consecutive_error_count, primary_manager_id, version
      FROM social_accounts WHERE id = ${accountId}
    `);
    return (rows as any).rows[0] as Record<string, unknown>;
  }

  async function countAudit(accountId: string, action: string): Promise<number> {
    const rows = await db.execute(sql`
      SELECT count(*)::int AS n FROM unified_audit_log
      WHERE resource_id = ${accountId} AND action = ${action}
    `);
    return ((rows as any).rows[0] as { n: number }).n;
  }

  async function healthRows(accountId: string, status: string): Promise<number> {
    const rows = await db.execute(sql`
      SELECT count(*)::int AS n FROM social_account_health_log
      WHERE social_account_id = ${accountId} AND status = ${status}
    `);
    return ((rows as any).rows[0] as { n: number }).n;
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const ctx = await createTestDb();
    db = ctx.db;
    done = ctx.done;

    setSocialServiceForTest(
      createSocialService({
        readEnv: (name) => CREDS[name],
        keyMaterial: derivedKeyMaterial("lifecycle-routes-test-secret"),
        appBaseUrl: "http://localhost:3000",
        oauthClient: {
          async exchangeCode(input) {
            const seq = Number.parseInt(input.code.replace("code-", ""), 10) || 1;
            return exchangeFor(seq);
          },
          async refreshTokens() {
            // Every probe in this file either succeeds or 401s into this; a successful refresh
            // would make the "stuck account" test unreachable, so it always fails.
            throw new Error("lifecycle tests never refresh successfully");
          },
        },
        probeFetch: (async (url: URL | RequestInfo, init?: RequestInit) => {
          fetchCalls.push({ url: String(url), body: String(init?.body ?? "") });
          if (probeThrow) throw new Error("endpoint unreachable");
          return new Response(null, { status: probeStatus });
        }) as typeof fetch,
      }),
    );

    setSocialNotifierForTest(async (_db, event) => {
      if (notifierThrows) throw new Error("notifier exploded");
      notifications.push(event);
      return { notified: 1 };
    });

    app = createTestApp(db);
    const ownerUser = await createTestUser(db, { firstName: "Life", lastName: "Owner" });
    const org = await createTestOrg(db, { ownerId: ownerUser.id, name: "Lifecycle Org" });
    orgId = org.id;
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: ownerUser.id,
      roleCode: "owner",
    });
    owner = { id: ownerUser.id, cookie: await cookieFor(app, ownerUser.email) };

    const mk = async (roleCode: string, label: string) => {
      const user = await createTestUser(db, { firstName: "Life", lastName: label });
      await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
      return { id: user.id, cookie: await cookieFor(app, user.email) };
    };
    admin = await mk("admin", "Admin");
    manager = await mk("manager", "Manager");
    creator = await mk("creator", "Creator");
    viewer = await mk("viewer", "Viewer");

    // A second tenant, for the cross-tenant 404s.
    const otherOwner = await createTestUser(db, { firstName: "Life", lastName: "Elsewhere" });
    const otherOrg = await createTestOrg(db, {
      ownerId: otherOwner.id,
      name: "Other Lifecycle Org",
    });
    await addMemberWithRole(db, {
      organizationId: otherOrg.id,
      userId: otherOwner.id,
      roleCode: "owner",
    });
    otherOrgUser = { id: otherOwner.id, cookie: await cookieFor(app, otherOwner.email) };
  });

  afterAll(async () => {
    setSocialNotifierForTest(undefined);
    setSocialServiceForTest(undefined);
    restoreEmailSpy?.();
    if (done) await done();
  });

  // ── the notification hops ───────────────────────────────────────────────────

  test("FR-SOC-008: connecting an account notifies the org's admins, carrying no token material", async () => {
    notifications = [];
    const accountId = await connectAccount(manager.cookie, 1);
    expect(accountId).toMatch(/^soc_/);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      event: "connected",
      organizationId: orgId,
      accountId,
      platform: "youtube",
      platformUsername: "lifecycle.channel.1",
    });
    expect(JSON.stringify(notifications[0])).not.toContain("lc-access-1");
  });

  test("FR-SOC-022: a dead token notifies admins + the Primary Manager, once per transition", async () => {
    const accountId = await connectAccount(owner.cookie, 2);
    notifications = []; // the connect notification is the first test's subject, not this one's
    // US-SOC-011's assignment column: the manager owns this account's alerts.
    await db.execute(sql`
      UPDATE social_accounts SET primary_manager_id = ${manager.id} WHERE id = ${accountId}
    `);
    // No usable token at all → the probe surfaces `needs_reauth` without any HTTP call.
    await db.execute(sql`
      UPDATE social_accounts
      SET access_token_encrypted = NULL, refresh_token_encrypted = NULL
      WHERE id = ${accountId}
    `);

    fetchCalls = [];
    const first = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as Envelope<{ probe: string; status: string }>;
    expect(firstBody.data.probe).toBe("needs_reauth");
    expect(firstBody.data.status).toBe("needs_reauth");
    expect(fetchCalls).toHaveLength(0); // nothing to probe with
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      event: "needs_reauth",
      accountId,
      primaryManagerId: manager.id,
    });
    expect(notifications[0]!.reason).toBeTruthy();
    expect(await countAudit(accountId, "socialaccount.needs_reauth")).toBe(1);
    expect(await healthRows(accountId, "needs_reauth")).toBe(1);

    // B1's regression: re-surfacing the same account must answer, not abort the transaction on
    // chk_sahl_transition_differs (23514) — and must not re-audit or re-email anyone.
    notifications = [];
    const second = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(second.status).toBe(200);
    expect(((await second.json()) as Envelope<{ probe: string }>).data.probe).toBe("needs_reauth");
    expect(notifications).toHaveLength(0);
    expect(await countAudit(accountId, "socialaccount.needs_reauth")).toBe(1);
    expect(await healthRows(accountId, "needs_reauth")).toBe(1);
  });

  test("a notifier that throws is reported and swallowed — the operation still succeeds", async () => {
    notifierThrows = true;
    const accountId = await connectAccount(owner.cookie, 3);
    expect(accountId).toMatch(/^soc_/);
    const res = await app.request(`/api/social/accounts/${accountId}`, {
      headers: { cookie: viewer.cookie },
    });
    expect(res.status).toBe(200);
    notifierThrows = false;
  });

  test("the production notifier emails owner + admin on connect, and adds the Primary Manager on needs_reauth", async () => {
    // Factory users are unverified; the notifier only mails addresses that have been proven.
    await db.execute(sql`UPDATE users SET email_verified = TRUE WHERE email LIKE '%@test.com'`);
    sentEmails.length = 0;
    const spy = spyOn(emailService, "send").mockImplementation(async (message: any) => {
      sentEmails.push({
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        kind: message.kind,
        html: message.html,
      });
      return { status: "sent", sent: true, messageId: "em_test", recipient: String(message.to) };
    });
    restoreEmailSpy = () => spy.mockRestore();
    setSocialNotifierForTest(undefined); // the real one, for this test

    const adminEmails = await db.execute(sql`
      SELECT u.email FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId} AND om.status = 'active'
        AND r.code IN ('owner', 'admin')
      ORDER BY u.email
    `);
    const expectedAdmins = ((adminEmails as any).rows as { email: string }[]).map((r) => r.email);
    expect(expectedAdmins.length).toBe(2); // owner + admin; the manager is an operational tier

    const accountId = await connectAccount(owner.cookie, 4);
    expect(sentEmails).toHaveLength(1);
    expect([...sentEmails[0]!.to].sort()).toEqual([...expectedAdmins].sort());
    expect(sentEmails[0]!.subject).toContain("connected");
    expect(sentEmails[0]!.kind).toBe("notification");
    expect(sentEmails[0]!.html).toContain("lifecycle.channel.4");
    expect(sentEmails[0]!.html).not.toContain("lc-access-4");

    // needs_reauth adds the Primary Manager (US-SOC-011) to the same administrative set.
    const managerEmail = await db.execute(sql`SELECT email FROM users WHERE id = ${manager.id}`);
    const managerAddress = ((managerEmail as any).rows[0] as { email: string }).email;
    await db.execute(sql`
      UPDATE social_accounts
      SET primary_manager_id = ${manager.id},
          access_token_encrypted = NULL,
          refresh_token_encrypted = NULL
      WHERE id = ${accountId}
    `);
    sentEmails.length = 0;
    const probe = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(probe.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect([...sentEmails[0]!.to].sort()).toEqual([...expectedAdmins, managerAddress].sort());
    expect(sentEmails[0]!.subject.toLowerCase()).toContain("re-authentication");

    restoreEmailSpy();
    restoreEmailSpy = undefined;
    setSocialNotifierForTest(async (_db, event) => {
      if (notifierThrows) throw new Error("notifier exploded");
      notifications.push(event);
      return { notified: 1 };
    });
  });

  // ── B2: reconnect clears the breaker (and the retention stamp) ──────────────

  test("B2: reconnecting a disconnected, breaker-open account revives it dispatchable", async () => {
    const accountId = await connectAccount(owner.cookie, 5);
    // Break it the way an outage would, then disconnect it.
    await db.execute(sql`
      UPDATE social_accounts
      SET circuit_breaker_open = true, circuit_breaker_opened_at = now(),
          status = 'error', consecutive_error_count = 10
      WHERE id = ${accountId}
    `);
    const disconnect = await app.request(`/api/social/accounts/${accountId}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: "lifecycle.channel.5" }),
    });
    expect(disconnect.status).toBe(200);
    const after = await accountRow(accountId);
    expect(after.status).toBe("disconnected");
    expect(after.data_retention_until).not.toBeNull();
    expect(after.circuit_breaker_open).toBe(true); // the disconnect does not clear it

    // Re-authenticate the same platform identity → the row is revived.
    notifications = []; // the first connect's notification is not this assertion's subject
    const revived = await connectAccount(owner.cookie, 5);
    expect(revived).toBe(accountId);
    const row = await accountRow(accountId);
    expect(row.status).toBe("active");
    expect(row.is_active).toBe(true);
    expect(row.circuit_breaker_open).toBe(false);
    expect(row.circuit_breaker_opened_at).toBeNull();
    expect(row.consecutive_error_count).toBe(0);
    expect(row.data_retention_until).toBeNull();
    expect(row.access_token_encrypted).not.toBeNull();

    // The point of clearing it: P3/P7 can dispatch immediately, with no probe in between.
    const service = (await import("../../services/social")).getSocialService();
    await expect(
      service.assertDispatchAllowed(db, { organizationId: orgId, accountId }),
    ).resolves.toBeUndefined();

    // And the reconnect announced itself as a reconnect, not a first connection.
    expect(notifications.map((n) => n.event)).toEqual(["reconnected"]);
  });

  // ── pause / resume (FR-SOC-016) ─────────────────────────────────────────────

  test("pause stops collection and keeps the sealed tokens; resume restores it with no new grant", async () => {
    const accountId = await connectAccount(owner.cookie, 6);
    const sealedBefore = (await accountRow(accountId)).access_token_encrypted;

    const pause = await app.request(`/api/social/accounts/${accountId}/pause`, {
      method: "POST",
      headers: { cookie: manager.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "brand freeze" }),
    });
    expect(pause.status).toBe(200);
    const paused = (await pause.json()) as Envelope<{
      status: string;
      isActive: boolean;
      previousStatus: string;
    }>;
    expect(paused.data).toMatchObject({
      status: "paused",
      isActive: false,
      previousStatus: "active",
    });
    const row = await accountRow(accountId);
    expect(row.status).toBe("paused");
    expect(row.is_active).toBe(false);
    // The tokens are the point of pausing rather than disconnecting: untouched, still sealed.
    expect(row.access_token_encrypted).toBe(sealedBefore);
    expect(row.refresh_token_encrypted).not.toBeNull();
    expect(await countAudit(accountId, "socialaccount.paused")).toBe(1);
    expect(await healthRows(accountId, "paused")).toBe(1);

    // The health timeline names the actor's reason, which is what makes "who stopped collection"
    // answerable later (FR-SOC-042's diagnostics read).
    const timeline = await db.execute(sql`
      SELECT status, previous_status, diagnostic_data FROM social_account_health_log
      WHERE social_account_id = ${accountId} AND status = 'paused'
    `);
    const entry = (timeline as any).rows[0] as {
      status: string;
      previous_status: string;
      diagnostic_data: { trigger: string; actorId: string; reason?: string };
    };
    expect(entry.previous_status).toBe("active");
    expect(entry.diagnostic_data).toMatchObject({ trigger: "operator", reason: "brand freeze" });

    const resume = await app.request(`/api/social/accounts/${accountId}/resume`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(resume.status).toBe(200);
    const resumed = (await resume.json()) as Envelope<{ status: string; isActive: boolean }>;
    expect(resumed.data).toMatchObject({ status: "active", isActive: true });
    expect(await countAudit(accountId, "socialaccount.resumed")).toBe(1);
    expect((await accountRow(accountId)).access_token_encrypted).toBe(sealedBefore);

    // FR-SOC-016's promise, checked the only way that counts: the sealed token still unseals.
    const service = (await import("../../services/social")).getSocialService();
    const token = await service.unsealAccessToken(db, orgId, accountId);
    expect(token).toBe("lc-access-6");
  });

  test("the pause/resume state machine refuses the transitions that would lie", async () => {
    const accountId = await connectAccount(owner.cookie, 7);
    const post = (path: string, cookie: string) =>
      app.request(`/api/social/accounts/${accountId}/${path}`, {
        method: "POST",
        headers: { cookie },
      });

    // Pausing twice is a 409, not a silent no-op: the operator's screen is out of date.
    expect((await post("pause", manager.cookie)).status).toBe(200);
    const twice = await post("pause", manager.cookie);
    expect(twice.status).toBe(409);
    expect(((await twice.json()) as Envelope<unknown>).error?.code).toBe(
      "SOCIAL_ACCOUNT_STATE_CONFLICT",
    );

    // Resuming an active account is a 409 too.
    expect((await post("resume", manager.cookie)).status).toBe(200);
    const resumeActive = await post("resume", manager.cookie);
    expect(resumeActive.status).toBe(409);

    // A dead-token account must go back through OAuth, not be "resumed" into looking healthy.
    await db.execute(
      sql`UPDATE social_accounts SET status = 'needs_reauth' WHERE id = ${accountId}`,
    );
    const resumeDead = await post("resume", manager.cookie);
    expect(resumeDead.status).toBe(409);
    expect(((await resumeDead.json()) as Envelope<unknown>).error?.message).toContain(
      "needs_reauth",
    );
    // …and pausing it would hide the one state an operator must see.
    const pauseDead = await post("pause", manager.cookie);
    expect(pauseDead.status).toBe(409);
    expect((await accountRow(accountId)).status).toBe("needs_reauth");
  });

  test("pause/resume: RBAC and tenant isolation", async () => {
    const accountId = await connectAccount(owner.cookie, 8);
    for (const seat of [creator, viewer]) {
      for (const path of ["pause", "resume"]) {
        const res = await app.request(`/api/social/accounts/${accountId}/${path}`, {
          method: "POST",
          headers: { cookie: seat.cookie },
        });
        expect(res.status).toBe(403);
      }
    }
    // Manager+ may; owner and admin may.
    expect(
      (
        await app.request(`/api/social/accounts/${accountId}/pause`, {
          method: "POST",
          headers: { cookie: admin.cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/social/accounts/${accountId}/resume`, {
          method: "POST",
          headers: { cookie: owner.cookie },
        })
      ).status,
    ).toBe(200);

    // Another tenant's owner gets a 404, not a 403: the row's existence is not their business.
    const foreign = await app.request(`/api/social/accounts/${accountId}/pause`, {
      method: "POST",
      headers: { cookie: otherOrgUser.cookie },
    });
    expect(foreign.status).toBe(404);
    expect((await accountRow(accountId)).status).toBe("active");

    // A malformed id is a 422 at the route, never a driver error.
    const malformed = await app.request("/api/social/accounts/not-an-id/pause", {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(malformed.status).toBe(422);
  });

  test("a paused account is skipped by the refresh sweep and refused by the dispatch gate", async () => {
    const accountId = await connectAccount(owner.cookie, 9);
    const service = (await import("../../services/social")).getSocialService();
    // A fresh connect expires inside the refresh horizon (tokens live an hour, the sweep refreshes
    // from an hour before expiry), so every account in this file is "due" — push the others out of
    // the window to make this one the only thing the sweep can pick up.
    await db.execute(sql`
      UPDATE social_accounts
      SET token_expires_at = CASE WHEN id = ${accountId}
                                  THEN now() + interval '10 minutes'
                                  ELSE now() + interval '30 days' END
      WHERE organization_id = ${orgId} AND status = 'active'
    `);
    const before = await service.refreshDueTokens(db, { limit: 50 });
    expect(before.due).toBe(1);
    // The sweep picked it up and, because this file's refresh grant always fails, surfaced it as
    // `needs_reauth` — which is the proof it was *visible* to the sweep.
    expect((await accountRow(accountId)).status).toBe("needs_reauth");

    // Put it back to a pausable state, then pause it.
    await db.execute(sql`UPDATE social_accounts SET status = 'active' WHERE id = ${accountId}`);
    const pause = await app.request(`/api/social/accounts/${accountId}/pause`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(pause.status).toBe(200);
    // The sweep selects `status = 'active' AND is_active = true`, so a paused row is invisible to
    // it — collection really does stop, rather than stopping and being refreshed anyway.
    const after = await service.refreshDueTokens(db, { limit: 50 });
    expect(after.due).toBe(0);
    expect((await accountRow(accountId)).status).toBe("paused");
    await expect(
      service.assertDispatchAllowed(db, { organizationId: orgId, accountId }),
    ).rejects.toThrow();
  });

  // ── the on-demand probe ─────────────────────────────────────────────────────

  test("health-check: a success closes an open breaker and reports the fresh state", async () => {
    const accountId = await connectAccount(owner.cookie, 10);
    await db.execute(sql`
      UPDATE social_accounts
      SET circuit_breaker_open = true, circuit_breaker_opened_at = now(),
          status = 'error', consecutive_error_count = 10
      WHERE id = ${accountId}
    `);
    // Dispatch is refused while it is open — that is the breaker's whole job.
    const service = (await import("../../services/social")).getSocialService();
    await expect(
      service.assertDispatchAllowed(db, { organizationId: orgId, accountId }),
    ).rejects.toThrow();

    probeStatus = 200;
    fetchCalls = [];
    const res = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      probe: string;
      status: string;
      circuitBreakerOpen: boolean;
      consecutiveErrorCount: number;
      lastErrorMessage: string | null;
    }>;
    expect(body.data.probe).toBe("healthy");
    expect(body.data.status).toBe("active");
    expect(body.data.circuitBreakerOpen).toBe(false);
    expect(body.data.consecutiveErrorCount).toBe(0);
    expect(body.data.lastErrorMessage).toBeNull();
    expect(fetchCalls).toHaveLength(1); // the probe, and only the probe
    // P2-003's recovery audit event, now reachable by an operator rather than only by the sweep.
    expect(await countAudit(accountId, "socialaccount.breaker_recovered")).toBe(1);
    await expect(
      service.assertDispatchAllowed(db, { organizationId: orgId, accountId }),
    ).resolves.toBeUndefined();
  });

  test("health-check: a 429 is recorded and advances nothing (BR-SOC-019)", async () => {
    const accountId = await connectAccount(owner.cookie, 11);
    probeStatus = 429;
    const res = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      probe: string;
      status: string;
      consecutiveErrorCount: number;
    }>;
    expect(body.data.probe).toBe("rate_limited");
    expect(body.data.status).toBe("active"); // a rate limit is not an account failure
    expect(body.data.consecutiveErrorCount).toBe(0);
    probeStatus = 200;
  });

  test("health-check: RBAC, tenant isolation, and the paused/disconnected refusals", async () => {
    const accountId = await connectAccount(owner.cookie, 12);
    for (const seat of [creator, viewer]) {
      const res = await app.request(`/api/social/accounts/${accountId}/health-check`, {
        method: "POST",
        headers: { cookie: seat.cookie },
      });
      expect(res.status).toBe(403);
    }
    const foreign = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: otherOrgUser.cookie },
    });
    expect(foreign.status).toBe(404);

    // A paused account has no live collection to protect, so probing it is refused rather than
    // silently spending platform quota.
    await app.request(`/api/social/accounts/${accountId}/pause`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    const paused = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(paused.status).toBe(409);

    // A disconnected one is a 404, matching the detail route's anti-enumeration stance.
    await app.request(`/api/social/accounts/${accountId}/resume`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    await db.execute(sql`
      UPDATE social_accounts
      SET status = 'disconnected', is_active = false, disconnected_at = now(),
          disconnected_by = ${owner.id}, data_retention_until = now() + interval '90 days'
      WHERE id = ${accountId}
    `);
    const disconnected = await app.request(`/api/social/accounts/${accountId}/health-check`, {
      method: "POST",
      headers: { cookie: manager.cookie },
    });
    expect(disconnected.status).toBe(404);
  });

  // ── per-account usage ───────────────────────────────────────────────────────

  test("per-account usage: the quota snapshot at the `usage` tier, tenant-scoped", async () => {
    const accountId = await connectAccount(owner.cookie, 13);
    const service = (await import("../../services/social")).getSocialService();
    await service.updateQuotaUsage(db, {
      organizationId: orgId,
      accountId,
      kind: "read",
      units: 250,
    });

    const res = await app.request(`/api/social/accounts/${accountId}/usage`, {
      headers: { cookie: manager.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      accountId: string;
      platform: string;
      usage: {
        status: string;
        buckets: Record<string, { used: number; limit: number; percent: number }>;
      };
    }>;
    expect(body.data.accountId).toBe(accountId);
    expect(body.data.platform).toBe("youtube");
    expect(body.data.usage.buckets.read).toMatchObject({ used: 250, percent: 3 });
    expect(body.data.usage.status).toBe("healthy");
    // It agrees with the snapshot the service returns — the route adds nothing of its own.
    const direct = await service.getQuotaSnapshot(db, { organizationId: orgId, accountId });
    expect(direct.buckets.read?.used).toBe(body.data.usage.buckets.read?.used);

    for (const seat of [creator, viewer]) {
      const forbidden = await app.request(`/api/social/accounts/${accountId}/usage`, {
        headers: { cookie: seat.cookie },
      });
      expect(forbidden.status).toBe(403);
    }
    // Every seat may still read the account itself; only the quota roll-up is manager+.
    expect(
      (
        await app.request(`/api/social/accounts/${accountId}`, {
          headers: { cookie: viewer.cookie },
        })
      ).status,
    ).toBe(200);
    const foreign = await app.request(`/api/social/accounts/${accountId}/usage`, {
      headers: { cookie: otherOrgUser.cookie },
    });
    expect(foreign.status).toBe(404);
  });

  // ── the attention filter (FR-SOC-044's data half) ───────────────────────────

  test("list: ?attention=true filters to the accounts that need one, and meta carries the total", async () => {
    const healthy = await connectAccount(owner.cookie, 20);
    const errored = await connectAccount(owner.cookie, 21);
    const dead = await connectAccount(owner.cookie, 22);
    await db.execute(sql`
      UPDATE social_accounts SET status = 'error', consecutive_error_count = 3 WHERE id = ${errored}
    `);
    await db.execute(sql`UPDATE social_accounts SET status = 'needs_reauth' WHERE id = ${dead}`);

    const all = await app.request("/api/social/accounts?limit=100", {
      headers: { cookie: viewer.cookie },
    });
    expect(all.status).toBe(200);
    const allBody = (await all.json()) as Envelope<{ accounts: { id: string }[] }>;
    for (const id of [healthy, errored, dead]) {
      expect(allBody.data.accounts.map((a) => a.id)).toContain(id);
    }
    // The count is org-wide and filter-independent: the widget shows it while the operator is
    // looking at something else entirely.
    expect(allBody.meta?.attentionCount).toBeGreaterThanOrEqual(2);

    const attention = await app.request("/api/social/accounts?attention=true&limit=100", {
      headers: { cookie: viewer.cookie },
    });
    expect(attention.status).toBe(200);
    const attentionBody = (await attention.json()) as Envelope<{ accounts: { id: string }[] }>;
    const ids = attentionBody.data.accounts.map((a) => a.id);
    expect(ids).toContain(errored);
    expect(ids).toContain(dead);
    expect(ids).not.toContain(healthy);
    expect(attentionBody.meta?.attentionCount).toBe(ids.length);

    // It composes with the other filters (AND, not override).
    const both = await app.request("/api/social/accounts?attention=true&platform=youtube", {
      headers: { cookie: viewer.cookie },
    });
    expect(both.status).toBe(200);
    expect(((await both.json()) as Envelope<{ accounts: unknown[] }>).data.accounts.length).toBe(
      ids.length,
    );

    const bad = await app.request("/api/social/accounts?attention=maybe", {
      headers: { cookie: viewer.cookie },
    });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as Envelope<unknown>).error?.details?.[0]?.field).toBe("attention");
  });

  test("list: an exhausted quota bucket puts an otherwise-healthy account in the attention set", async () => {
    const accountId = await connectAccount(owner.cookie, 23);
    const service = (await import("../../services/social")).getSocialService();
    await service.updateQuotaUsage(db, {
      organizationId: orgId,
      accountId,
      kind: "read",
      units: 10_000, // the default bucket limit → 100% → `exhausted`
    });
    const res = await app.request("/api/social/accounts?attention=true&limit=100", {
      headers: { cookie: manager.cookie },
    });
    const body = (await res.json()) as Envelope<{
      accounts: { id: string; status: string; quotaStatus: string }[];
    }>;
    const row = body.data.accounts.find((a) => a.id === accountId);
    expect(row).toBeDefined();
    expect(row!.status).toBe("active"); // not an error — a quota problem
    expect(row!.quotaStatus).toBe("exhausted");
  });

  // ── the disconnect's dry run (FR-SOC-011) ───────────────────────────────────

  test("DELETE ?dryRun=true previews the impact and writes nothing", async () => {
    const accountId = await connectAccount(owner.cookie, 30);
    const sealedBefore = (await accountRow(accountId)).access_token_encrypted;
    fetchCalls = [];

    const res = await app.request(`/api/social/accounts/${accountId}?dryRun=true`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      dryRun: boolean;
      account: { id: string; platform: string; platformUsername: string; status: string };
      domains: { domain: string; label: string; count: number | null; landsWith: string }[];
      retentionDays: number;
      confirmationUsername: string;
    }>;
    expect(body.data.dryRun).toBe(true);
    expect(body.data.account).toMatchObject({
      id: accountId,
      platform: "youtube",
      platformUsername: "lifecycle.channel.30",
    });
    // The modal needs to know what to ask for; the dry run tells it, and nothing was written.
    expect(body.data.confirmationUsername).toBe("lifecycle.channel.30");
    expect(body.data.retentionDays).toBe(90);
    expect(body.data.domains).toHaveLength(4);
    for (const domain of body.data.domains) {
      // `null` = "not computable yet", never `0`: a zero in a confirmation modal is a false
      // all-clear, and the campaign/monitor/publishing tables are not adopted modules yet.
      expect(domain.count).toBeNull();
      expect(domain.landsWith).toMatch(/NWB-P/);
      expect(domain.label.length).toBeGreaterThan(0);
    }
    expect(fetchCalls).toHaveLength(0); // no provider call was made
    const row = await accountRow(accountId);
    expect(row.status).toBe("active");
    expect(row.access_token_encrypted).toBe(sealedBefore);
    expect(await countAudit(accountId, "socialaccount.disconnected")).toBe(0);

    // The dry run is still admin-only: it discloses what the account is wired to.
    const forbidden = await app.request(`/api/social/accounts/${accountId}?dryRun=true`, {
      method: "DELETE",
      headers: { cookie: manager.cookie },
    });
    expect(forbidden.status).toBe(403);
    const badFlag = await app.request(`/api/social/accounts/${accountId}?dryRun=perhaps`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(badFlag.status).toBe(422);
    // And a dry run against another tenant's account is a 404 like the real thing.
    const foreign = await app.request(`/api/social/accounts/${accountId}?dryRun=true`, {
      method: "DELETE",
      headers: { cookie: otherOrgUser.cookie },
    });
    expect(foreign.status).toBe(404);
  });

  // ── token material never leaves the service (FR-SOC-023) ────────────────────

  test("no social response body carries token material, on any route", async () => {
    const accountId = await connectAccount(owner.cookie, 40);
    const responses: Response[] = [
      await app.request("/api/social/accounts?limit=100", { headers: { cookie: viewer.cookie } }),
      await app.request("/api/social/accounts?attention=true", {
        headers: { cookie: viewer.cookie },
      }),
      await app.request(`/api/social/accounts/${accountId}`, {
        headers: { cookie: viewer.cookie },
      }),
      await app.request(`/api/social/accounts/${accountId}/health`, {
        headers: { cookie: viewer.cookie },
      }),
      await app.request(`/api/social/accounts/${accountId}/usage`, {
        headers: { cookie: manager.cookie },
      }),
      await app.request("/api/social/usage", { headers: { cookie: manager.cookie } }),
      await app.request(`/api/social/accounts/${accountId}/health-check`, {
        method: "POST",
        headers: { cookie: manager.cookie },
      }),
      await app.request(`/api/social/accounts/${accountId}?dryRun=true`, {
        method: "DELETE",
        headers: { cookie: owner.cookie },
      }),
    ];
    for (const res of responses) {
      const text = await res.clone().text();
      for (const forbidden of TOKEN_MATERIAL) {
        expect(text).not.toContain(forbidden);
      }
    }
  });
});
