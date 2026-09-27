/**
 * TanStack Start Server Functions Tests — social accounts (P14.3, the "social connect" cluster).
 *
 * What is under test is the *adapter*, not the domain: the state machines, the breaker, the quota
 * ledger and the revocation semantics are covered by `service.test.ts`, `routes.test.ts` and
 * `lifecycle.route.test.ts`. What this file proves is the part the Hono routes cannot — that the
 * web surface reaches the same service through a session cookie only, that `orgId`/`userId` come
 * from the token and never from the payload, and that the ability asserted per function is the one
 * the route asserts for the same operation (a Server Function bypasses `requireAbility` entirely,
 * so `assertServerAbility` *is* the guard here — get the verb wrong and there is no second line).
 *
 * In-process execution:
 * - initiateSocialConnectServerFn        connect
 * - listSocialAccountsServerFn           read   (+ attention filter/count, keyset page)
 * - getSocialAccountServerFn             read
 * - getSocialAccountHealthServerFn       read
 * - getSocialUsageServerFn               usage
 * - getSocialAccountUsageServerFn        usage
 * - checkSocialAccountHealthServerFn     connect
 * - pauseSocialAccountServerFn           connect
 * - resumeSocialAccountServerFn          connect
 * - getSocialDisconnectImpactServerFn    disconnect
 * - disconnectSocialAccountServerFn      disconnect (typed-username confirmation)
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import {
  checkSocialAccountHealthServerFn,
  disconnectSocialAccountServerFn,
  getSocialAccountHealthServerFn,
  getSocialAccountServerFn,
  getSocialAccountUsageServerFn,
  getSocialDisconnectImpactServerFn,
  getSocialUsageServerFn,
  initiateSocialConnectServerFn,
  listSocialAccountsServerFn,
  pauseSocialAccountServerFn,
  resumeSocialAccountServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
  setServerHeadersForTest,
  withServerOrgContext,
} from "@/app/server-functions/helpers";
import { getConfig } from "@/lib/config";
import { derivedKeyMaterial } from "@/lib/crypto";
import type { Db } from "@/lib/db";
import { createTestDb } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { signAccessToken } from "@/services/auth/jwt";
import {
  createSocialService,
  type OAuthExchangeResult,
  type SocialNotificationEvent,
  setSocialNotifierForTest,
  setSocialServiceForTest,
} from "@/services/social";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

const SOC_ID = `soc_${crypto.randomUUID()}`;

/**
 * Typed views of what the web receives. The `createServerFn` shim returns `any` at the call site
 * (it mirrors production's RPC type, which is generated), so these local shapes are what make the
 * assertions below assertions rather than `any`-typed theatre — and they document the contract the
 * `/settings/integrations` route is written against.
 */
interface WebAccount {
  id: string;
  platform: string;
  platformUsername: string;
  displayName: string | null;
  status: string;
  quotaStatus: string;
  circuitBreakerOpen: boolean;
  tokenExpiresAt: Date | null;
  connectedAt: Date;
}
interface WebAccountPage {
  accounts: WebAccount[];
  pageInfo: { cursor: string | null; hasMore: boolean };
  attentionCount: number;
}
interface WebImpact {
  account: { id: string; platform: string; platformUsername: string; status: string };
  domains: { domain: string; label: string; count: number | null; landsWith: string }[];
  retentionDays: number;
  confirmationUsername: string;
}

/** Fails when nothing was thrown, so a guard that silently stopped guarding cannot pass. */
async function expectThrows<T>(
  fn: () => Promise<T>,
  type: abstract new (...args: any[]) => T | Error,
) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(type);
    return e;
  }
  throw new Error(`expected ${type.name}, nothing was thrown`);
}

describe("Social Server Functions — Validation (No DB)", () => {
  test("initiate rejects a platform outside the enum", async () => {
    await expectThrows(
      () =>
        initiateSocialConnectServerFn({
          data: { platform: "tiktok" as never },
        }),
      ValidationError,
    );
  });

  test("initiate rejects an absolute returnUrl — the callback's redirect stays same-origin", async () => {
    await expectThrows(
      () =>
        initiateSocialConnectServerFn({
          data: { platform: "youtube", returnUrl: "https://evil.example/collect" },
        }),
      ValidationError,
    );
  });

  test("list rejects an unknown platform or status filter at the schema, before auth", async () => {
    await expectThrows(
      () => listSocialAccountsServerFn({ data: { platform: "tiktok" } }),
      ValidationError,
    );
    await expectThrows(
      () => listSocialAccountsServerFn({ data: { status: "deactivated" } }),
      ValidationError,
    );
  });

  test("list rejects a limit outside 1..100 in both directions", async () => {
    await expectThrows(() => listSocialAccountsServerFn({ data: { limit: 0 } }), ValidationError);
    await expectThrows(() => listSocialAccountsServerFn({ data: { limit: 101 } }), ValidationError);
  });

  test("account id must match soc_<uuid>", async () => {
    const byId: (() => Promise<unknown>)[] = [
      () => getSocialAccountServerFn({ data: { accountId: "acct_1" } }),
      () => getSocialAccountHealthServerFn({ data: { accountId: "acct_1" } }),
      () => getSocialAccountUsageServerFn({ data: { accountId: "acct_1" } }),
      () => getSocialDisconnectImpactServerFn({ data: { accountId: "acct_1" } }),
    ];
    for (const call of byId) {
      await expectThrows(call, ValidationError);
    }
  });

  test("disconnect without the confirmation username is a validation error, not a deletion", async () => {
    await expectThrows(
      () => disconnectSocialAccountServerFn({ data: { accountId: SOC_ID } as never }),
      ValidationError,
    );
  });

  test("pause/resume need an account id", async () => {
    await expectThrows(
      () => pauseSocialAccountServerFn({ data: { reason: "no id" } as never }),
      ValidationError,
    );
    await expectThrows(() => resumeSocialAccountServerFn({ data: {} as never }), ValidationError);
  });

  test("every function is 401 without a session cookie", async () => {
    clearServerHeadersForTest();
    const calls: (() => Promise<unknown>)[] = [
      () => initiateSocialConnectServerFn({ data: { platform: "youtube" } }),
      () => listSocialAccountsServerFn({ data: {} }),
      () => getSocialAccountServerFn({ data: { accountId: SOC_ID } }),
      () => getSocialAccountHealthServerFn({ data: { accountId: SOC_ID } }),
      () => getSocialUsageServerFn({}),
      () => getSocialAccountUsageServerFn({ data: { accountId: SOC_ID } }),
      () => checkSocialAccountHealthServerFn({ data: { accountId: SOC_ID } }),
      () => pauseSocialAccountServerFn({ data: { accountId: SOC_ID } }),
      () => resumeSocialAccountServerFn({ data: { accountId: SOC_ID } }),
      () => getSocialDisconnectImpactServerFn({ data: { accountId: SOC_ID } }),
      () =>
        disconnectSocialAccountServerFn({
          data: { accountId: SOC_ID, confirmUsername: "someone" },
        }),
    ];
    for (const call of calls) {
      await expectThrows(call, UnauthorizedError);
    }
  });

  test("a Bearer token is refused — the web surface is session cookies only", async () => {
    setServerHeadersForTest({ authorization: "Bearer whatever-an-api-key-looks-like" });
    try {
      await expectThrows(() => listSocialAccountsServerFn({ data: {} }), UnauthorizedError);
    } finally {
      clearServerHeadersForTest();
    }
  });
});

describe.skipIf(!hasDb())("Social Server Functions — Integration (with DB)", () => {
  let db: Db;
  let done: (() => Promise<void>) | undefined;
  let orgId: string;
  const seats: Record<string, string> = {};
  const ids: Record<string, string> = {};

  /** A row id recorded by an earlier test in this file; `noUncheckedIndexedAccess` wants the guard. */
  function idOf(key: string): string {
    const value = ids[key];
    if (!value) throw new Error(`test setup missing id "${key}"`);
    return value;
  }

  async function list(data: Record<string, unknown>): Promise<WebAccountPage> {
    return (await listSocialAccountsServerFn({ data })) as WebAccountPage;
  }

  /** Every notification the service asked to be delivered, in order. */
  const notifications: SocialNotificationEvent[] = [];
  /** Outbound fetches: probes and provider revocations. Nothing leaves the process. */
  const fetchCalls: { url: string; body: string }[] = [];
  let probeStatus = 200;

  const CREDS: Record<string, string> = {
    OAUTH_YOUTUBE_CLIENT_ID: "sf-client-id",
    OAUTH_YOUTUBE_CLIENT_SECRET: "sf-client-secret",
  };

  /** The scripted service: real state machine, no network, deterministic profiles. */
  function makeService() {
    return createSocialService({
      readEnv: (name) => CREDS[name],
      keyMaterial: derivedKeyMaterial("social-serverfn-test-secret"),
      appBaseUrl: "http://localhost:3000",
      oauthClient: {
        async exchangeCode(input) {
          return exchangeFor(Number.parseInt(input.code.replace("code-", ""), 10) || 1);
        },
        async refreshTokens() {
          throw new Error("server function tests never refresh successfully");
        },
      },
      probeFetch: (async (probeUrl: URL | RequestInfo, init?: RequestInit) => {
        fetchCalls.push({ url: String(probeUrl), body: String(init?.body ?? "") });
        return new Response(null, { status: probeStatus });
      }) as typeof fetch,
    });
  }

  function exchangeFor(seq: number): OAuthExchangeResult {
    return {
      accessToken: `sf-access-${seq}`,
      refreshToken: `sf-refresh-${seq}`,
      expiresInSeconds: 3600,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      platformUserId: `UC_sf_${seq}`,
      platformUsername: `sf.channel.${seq}`,
      displayName: `ServerFn Channel ${seq}`,
      profileImageUrl: null,
      followerCount: 10 * seq,
    };
  }

  /** Signs in as a seat by setting the test headers, the way the shim reads a real request. */
  function as(seat: "owner" | "admin" | "manager" | "creator" | "viewer") {
    setServerHeadersForTest({ cookie: `nawebeus_access=${seats[seat]}` });
  }

  /**
   * Walks one account through the real OAuth state machine: the Server Function mints the state,
   * then the *public* Hono callback's service method consumes it — which is exactly what happens in
   * production, where the provider (not the web app) calls back.
   */
  async function connect(seq: number): Promise<string> {
    as("manager");
    const { authorizeUrl, expiresAt } = await initiateSocialConnectServerFn({
      // No returnUrl — exactly what the route does, so the Server Function's default is exercised.
      data: { platform: "youtube" },
    });
    expect(expiresAt).toBeInstanceOf(Date);
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get("response_type")).toBe("code");
    const state = url.searchParams.get("state");
    if (!state) throw new Error("initiate returned an authorize URL with no state");

    // The callback is unauthenticated by design (it is the provider arriving), so it runs outside
    // any seat's headers — inside the org context the state row carries, like the route does.
    clearServerHeadersForTest();
    const { account, reconnected, returnUrl } = await withServerOrgContext(
      { orgId, userId: ids.manager } as never,
      () =>
        makeService().handleCallback(db as never, {
          platform: "youtube",
          code: `code-${seq}`,
          state,
        }),
    );
    expect(reconnected).toBe(false);
    expect(account.status).toBe("active");
    // The Server Function defaults returnUrl to this screen *with* `?connected=`, because the
    // public callback appends that query only when the state carried no returnUrl at all. The
    // route therefore omits it, and pinning the value here is what stops a well-meaning caller
    // from passing the bare path and silently killing the success banner.
    expect(returnUrl).toBe("/settings/integrations?connected=youtube");
    return account.id;
  }

  async function accountRow(accountId: string): Promise<Record<string, unknown>> {
    const rows = (await db.execute(sql`
      SELECT status, is_active, circuit_breaker_open, data_retention_until,
             access_token_encrypted, refresh_token_encrypted, platform_username
      FROM social_accounts WHERE id = ${accountId}
    `)) as unknown as { rows: Record<string, unknown>[] };
    // biome-ignore lint/style/noNonNullAssertion: a row this file just wrote is present or the test is broken
    return rows.rows[0]!;
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const ctx = await createTestDb();
    db = ctx.db;
    done = ctx.done;

    setSocialServiceForTest(makeService());
    setSocialNotifierForTest(async (_db, event) => {
      notifications.push(event);
      return { notified: 1 };
    });

    const config = getConfig();
    const owner = await createTestUser(db, { firstName: "Sf", lastName: "Owner" });
    const org = await createTestOrg(db, { ownerId: owner.id, name: "ServerFn Social Org" });
    orgId = org.id;
    ids.owner = owner.id;

    for (const role of ["owner", "admin", "manager", "creator", "viewer"] as const) {
      const user = role === "owner" ? owner : await createTestUser(db, { firstName: `Sf_${role}` });
      ids[role] = user.id;
      await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode: role });
      seats[role] = await signAccessToken(
        user.id,
        org.id,
        config.JWT_ACCESS_SECRET || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );
    }

    setServerDbForTest(db as never);
  });

  afterAll(async () => {
    clearServerDbForTest();
    clearServerHeadersForTest();
    setSocialServiceForTest(undefined);
    setSocialNotifierForTest(undefined);
    await done?.();
  });

  test("the connect flow: authorize URL → callback → connected notification", async () => {
    const before = notifications.length;
    const accountId = await connect(1);

    const row = await accountRow(accountId);
    expect(row.status).toBe("active");
    expect(row.platform_username).toBe("sf.channel.1");
    // Tokens are sealed at rest; the web never sees them.
    expect(String(row.access_token_encrypted)).not.toContain("sf-access-1");
    expect(String(row.refresh_token_encrypted)).not.toContain("sf-refresh-1");

    // FR-SOC-008: the owner is told a connection landed, through the notifier seam.
    const hop = notifications.slice(before).find((n) => n.event === "connected");
    expect(hop).toBeTruthy();
    expect(hop?.accountId).toBe(accountId);

    ids.accountA = accountId;
  });

  test("list: every seat may read; no token material anywhere in the payload", async () => {
    for (const seat of ["owner", "admin", "manager", "creator", "viewer"] as const) {
      as(seat);
      const { accounts, pageInfo, attentionCount } = await list({});
      expect(accounts.length).toBeGreaterThan(0);
      expect(typeof attentionCount).toBe("number");
      expect(typeof pageInfo.hasMore).toBe("boolean");
      const serialized = JSON.stringify(accounts);
      expect(serialized).not.toContain("sf-access-");
      expect(serialized).not.toContain("sf-refresh-");
      expect(serialized).not.toContain("access_token_encrypted");
      // Dates arrive as Dates over RPC, not as the API's ISO strings.
      const [firstRow] = accounts;
      expect(firstRow).toBeTruthy();
      expect(firstRow?.connectedAt).toBeInstanceOf(Date);
    }
  });

  test("list: attention filter returns only attention accounts; the count is org-wide", async () => {
    as("manager");
    const all = await list({ limit: 50 });
    const attention = await list({ limit: 50, attention: true });
    expect(attention.attentionCount).toBe(all.attentionCount);
    expect(attention.accounts.length).toBeLessThanOrEqual(all.accounts.length);
    for (const account of attention.accounts) {
      expect(["needs_reauth", "error"].includes(account.status)).toBe(true);
    }
  });

  test("list: keyset pagination walks both accounts without repeats", async () => {
    await connect(2);
    as("viewer"); // connect() cleared the headers to play the unauthenticated provider callback
    const first = await list({ limit: 1 });
    // (the cursor is decoded inside the handler, after auth — a malformed one is a 422, not a
    // silent "start over", which is what makes a corrupt link fail loudly instead of looping)
    await expectThrows(() => list({ limit: 1, cursor: "not-base64-of-anything" }), ValidationError);
    expect(first.accounts).toHaveLength(1);
    expect(first.pageInfo.hasMore).toBe(true);
    const second = await list({ limit: 1, cursor: first.pageInfo.cursor });
    expect(second.accounts).toHaveLength(1);
    const [secondRow] = second.accounts;
    const [firstRow] = first.accounts;
    expect(secondRow?.id).not.toBe(firstRow?.id);
    ids.accountB = secondRow?.id === ids.accountA ? (firstRow?.id ?? "") : (secondRow?.id ?? "");
    expect(ids.accountB).toBeTruthy();
  });

  test("detail and health log are readable by every seat", async () => {
    for (const seat of ["manager", "viewer"] as const) {
      as(seat);
      const detail = await getSocialAccountServerFn({ data: { accountId: idOf("accountA") } });
      expect(detail.account.platformUsername).toBe("sf.channel.1");
      expect(detail.quota).toBeTruthy();

      const { health } = await getSocialAccountHealthServerFn({
        data: { accountId: idOf("accountA") },
      });
      expect(Array.isArray(health)).toBe(true);
    }
  });

  test("detail on an unknown or malformed id: 404, never a leak about other tenants", async () => {
    as("manager");
    await expectThrows(
      () => getSocialAccountServerFn({ data: { accountId: SOC_ID } }),
      NotFoundError,
    );
    await expectThrows(
      () => getSocialAccountHealthServerFn({ data: { accountId: SOC_ID } }),
      NotFoundError,
    );
  });

  test("usage is manager and above; creator and viewer are refused", async () => {
    for (const seat of ["creator", "viewer"] as const) {
      as(seat);
      await expectThrows(() => getSocialUsageServerFn({}), ForbiddenError);
      await expectThrows(
        () => getSocialAccountUsageServerFn({ data: { accountId: idOf("accountA") } }),
        ForbiddenError,
      );
    }
    for (const seat of ["manager", "admin", "owner"] as const) {
      as(seat);
      const { usage } = await getSocialUsageServerFn({});
      expect(usage.length).toBeGreaterThanOrEqual(1);
      expect(usage[0]?.buckets).toBeTruthy();
      const perAccount = await getSocialAccountUsageServerFn({
        data: { accountId: idOf("accountA") },
      });
      expect(perAccount.platform).toBe("youtube");
      expect(perAccount.usage).toBeTruthy();
    }
  });

  test("pause and resume are connect-tier: refused for creator and viewer, allowed for manager", async () => {
    for (const seat of ["creator", "viewer"] as const) {
      as(seat);
      await expectThrows(
        () => pauseSocialAccountServerFn({ data: { accountId: idOf("accountA") } }),
        ForbiddenError,
      );
    }

    as("manager");
    const paused = await pauseSocialAccountServerFn({
      data: { accountId: idOf("accountA"), reason: "operator asked" },
    });
    expect(paused.status).toBe("paused");
    expect(paused.previousStatus).toBe("active");
    expect(paused.isActive).toBe(false);

    // A paused account is not probed — the conflict says to resume first.
    await expectThrows(
      () => checkSocialAccountHealthServerFn({ data: { accountId: idOf("accountA") } }),
      ConflictError,
    );

    const resumed = await resumeSocialAccountServerFn({ data: { accountId: idOf("accountA") } });
    expect(resumed.status).toBe("active");
    expect(resumed.isActive).toBe(true);

    // Resuming a live account is a conflict, not a no-op.
    await expectThrows(
      () => resumeSocialAccountServerFn({ data: { accountId: idOf("accountA") } }),
      ConflictError,
    );
  });

  test("health-check probes on demand and closes a breaker that a success earns", async () => {
    as("admin");
    probeStatus = 200;
    fetchCalls.length = 0;
    const healthy = await checkSocialAccountHealthServerFn({
      data: { accountId: idOf("accountA") },
    });
    expect(healthy.probe).toBe("healthy");
    expect(healthy.status).toBe("active");
    expect(healthy.circuitBreakerOpen).toBe(false);
    expect(fetchCalls.length).toBe(1);

    // The timeline carries the pause/resume rows the previous test wrote as well as the probe's.
    // Its order is `checked_at DESC`, and every row here shares one transaction's frozen `now()`,
    // so the probe's row is *found* rather than assumed to be first.
    const { health } = await getSocialAccountHealthServerFn({
      data: { accountId: idOf("accountA"), limit: 10 },
    });
    const statuses = health.map((row: { status: string }) => row.status);
    expect(statuses).toContain("healthy");
    expect(statuses).toContain("paused");
    const probeRow = health.find((row: { status: string }) => row.status === "healthy") as {
      httpStatusCode: number | null;
      checkedAt: Date;
    };
    expect(probeRow.httpStatusCode).toBe(200);
    expect(probeRow.checkedAt).toBeInstanceOf(Date);
  });

  test("health-check is refused below manager", async () => {
    as("creator");
    await expectThrows(
      () => checkSocialAccountHealthServerFn({ data: { accountId: idOf("accountA") } }),
      ForbiddenError,
    );
  });

  test("impact preview and disconnect are admin and above — manager included in the refusal", async () => {
    for (const seat of ["manager", "creator", "viewer"] as const) {
      as(seat);
      await expectThrows(
        () => getSocialDisconnectImpactServerFn({ data: { accountId: idOf("accountB") } }),
        ForbiddenError,
      );
      await expectThrows(
        () =>
          disconnectSocialAccountServerFn({
            data: { accountId: idOf("accountB"), confirmUsername: "sf.channel.2" },
          }),
        ForbiddenError,
      );
    }

    as("admin");
    const impact = (await getSocialDisconnectImpactServerFn({
      data: { accountId: idOf("accountB") },
    })) as WebImpact;
    expect(impact.account.id).toBe(idOf("accountB"));
    expect(impact.retentionDays).toBe(90);
    expect(impact.confirmationUsername).toBe("sf.channel.2");
    // Four domains, none countable yet — the modules that would count them are not adopted.
    expect(impact.domains.map((d) => d.domain)).toEqual([
      "campaigns",
      "monitoring",
      "publishing",
      "engagement",
    ]);
    for (const domain of impact.domains) {
      expect(domain.count).toBeNull();
      expect(domain.landsWith).toBeTruthy();
    }
  });

  test("disconnect: a wrong username is refused and the account stays live", async () => {
    as("admin");
    await expectThrows(
      () =>
        disconnectSocialAccountServerFn({
          data: { accountId: idOf("accountB"), confirmUsername: "SF.Channel.2" },
        }),
      ValidationError,
    );
    const row = await accountRow(idOf("accountB"));
    expect(row.status).toBe("active");
    expect(row.is_active).toBe(true);
  });

  test("disconnect: exact username → status flipped, tokens wiped, 90-day retention stamped", async () => {
    as("admin");
    const result = await disconnectSocialAccountServerFn({
      data: {
        accountId: idOf("accountB"),
        confirmUsername: "sf.channel.2",
        reason: "channel closed",
      },
    });
    expect(result.platform).toBe("youtube");
    expect(result.platformUsername).toBe("sf.channel.2");
    expect(result.revocationDetail.access).toBeTruthy();
    expect(result.revocationDetail.refresh).toBeTruthy();
    expect(result.dataRetentionUntil).toBeInstanceOf(Date);
    expect(result.dataRetentionUntil.getTime()).toBeGreaterThan(Date.now());

    const row = await accountRow(idOf("accountB"));
    expect(row.status).toBe("disconnected");
    expect(row.is_active).toBe(false);
    expect(row.access_token_encrypted).toBeNull();
    expect(row.refresh_token_encrypted).toBeNull();
    expect(row.data_retention_until).toBeTruthy();
  });

  test("after disconnect: hidden from the list, detail and usage 404, repeat disconnect 404", async () => {
    as("admin");
    const { accounts } = await list({ limit: 50 });
    expect(accounts.some((a) => a.id === idOf("accountB"))).toBe(false);

    await expectThrows(
      () => getSocialAccountServerFn({ data: { accountId: idOf("accountB") } }),
      NotFoundError,
    );
    await expectThrows(
      () => getSocialAccountUsageServerFn({ data: { accountId: idOf("accountB") } }),
      NotFoundError,
    );
    await expectThrows(
      () =>
        disconnectSocialAccountServerFn({
          data: { accountId: idOf("accountB"), confirmUsername: "sf.channel.2" },
        }),
      NotFoundError,
    );

    // Explicitly asked for, the archived row is still readable — FR-SOC-014's retention window.
    const archived = await list({ status: "disconnected" });
    expect(archived.accounts.some((a) => a.id === idOf("accountB"))).toBe(true);
  });

  test("an account id from another organization is a 404, not a 403 and not a leak", async () => {
    const outsider = await createTestUser(db, { firstName: "Sf", lastName: "Outsider" });
    const otherOrg = await createTestOrg(db, { ownerId: outsider.id, name: "Other Org" });
    await addMemberWithRole(db, {
      organizationId: otherOrg.id,
      userId: outsider.id,
      roleCode: "owner",
    });
    const config = getConfig();
    setServerHeadersForTest({
      cookie: `nawebeus_access=${await signAccessToken(
        outsider.id,
        otherOrg.id,
        config.JWT_ACCESS_SECRET || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      )}`,
    });

    await expectThrows(
      () => getSocialAccountServerFn({ data: { accountId: idOf("accountA") } }),
      NotFoundError,
    );
    await expectThrows(
      () => pauseSocialAccountServerFn({ data: { accountId: idOf("accountA") } }),
      NotFoundError,
    );
    const { accounts } = await list({});
    expect(accounts).toHaveLength(0);
  });
});
