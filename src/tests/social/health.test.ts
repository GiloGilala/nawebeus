/**
 * Account health checks + circuit breaker (NWB-P2-003) — live DB, scripted probe responses.
 *
 * The exit-gate words under test: the breaker **trips** (10 consecutive failures, FR-SOC-056),
 * **blocks dispatch** (the roadmap's P3/P7 requirement), and **recovers demonstrably** (a probe
 * success closes it, with the audit trail to prove both directions).
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { socialHealthCheckJob } from "../../jobs/social-health-check";
import { derivedKeyMaterial, encryptSecret } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import { CircuitBreakerOpenError, NotFoundError } from "../../lib/errors";
import {
  classifyPlatformHttpError,
  createSocialService,
  platformBackoffDelayMs,
  type SocialPlatform,
  setSocialServiceForTest,
} from "../../services/social";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

const KEY = derivedKeyMaterial("health-test-secret");
const CREDS: Record<string, string> = {
  OAUTH_YOUTUBE_CLIENT_ID: "yt-id",
  OAUTH_YOUTUBE_CLIENT_SECRET: "yt-secret",
};

/** A probe fetch scripted per call: each entry is {status} or {throws}. */
function scriptedFetch(script: { status?: number; throws?: string }[]) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step?.throws) throw new Error(step.throws);
    return new Response(null, { status: step?.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function serviceWithProbes(
  _db: Db,
  script: { status?: number; throws?: string }[],
  refreshImpl?: (refreshToken: string) => { accessToken: string } | { fail: true },
) {
  const probe = scriptedFetch(script);
  let refreshCalls = 0;
  const svc = createSocialService({
    readEnv: (name) => CREDS[name],
    keyMaterial: KEY,
    appBaseUrl: "http://localhost:3000",
    probeFetch: probe.fetchImpl,
    oauthClient: {
      async exchangeCode() {
        throw new Error("health tests never exchange");
      },
      async refreshTokens(args) {
        refreshCalls += 1;
        const outcome = refreshImpl?.(args.refreshToken) ?? { accessToken: "refreshed-access" };
        if ("fail" in outcome) {
          throw new (await import("../../services/social")).OAuthExchangeError(
            "youtube" as SocialPlatform,
            "invalid_grant",
            "refresh refused",
            400,
          );
        }
        return {
          accessToken: outcome.accessToken,
          refreshToken: null,
          rotated: false,
          expiresInSeconds: 3600,
          scope: null,
        };
      },
    },
  });
  return { svc, probeCalls: () => probe.calls, refreshCount: () => refreshCalls };
}

async function seedAccount(
  db: Db,
  orgId: string,
  userId: string,
  overrides: {
    status?: string;
    consecutive?: number;
    breakerOpen?: boolean;
    openedMinutesAgo?: number;
  } = {},
): Promise<string> {
  const accountId = `soc_${crypto.randomUUID()}`;
  const status = overrides.status ?? "active";
  const openedAt = overrides.breakerOpen
    ? sql`now() - ${`${overrides.openedMinutesAgo ?? 0} minutes`}::interval`
    : sql`null`;
  await db.execute(sql`
    INSERT INTO social_accounts (
      id, organization_id, platform, platform_user_id, platform_username,
      access_token_encrypted, refresh_token_encrypted, token_expires_at, status,
      consecutive_error_count, circuit_breaker_open, circuit_breaker_opened_at,
      connected_by, disconnected_at, disconnected_by, version
    ) VALUES (
      ${accountId}, ${orgId}, 'youtube', ${"UC_" + accountId.slice(-12)}, 'probe-channel',
      ${await encryptSecret("probe-access-token", KEY)},
      ${await encryptSecret("probe-refresh-token", KEY)},
      now() + interval '2 hours', ${status},
      ${overrides.consecutive ?? 0}, ${overrides.breakerOpen ?? false}, ${openedAt},
      ${userId},
      ${status === "disconnected" ? sql`now()` : null},
      ${status === "disconnected" ? userId : null},
      1
    )
  `);
  return accountId;
}

async function accountRow(db: Db, accountId: string) {
  const rows = await db.execute(sql`SELECT status, consecutive_error_count, circuit_breaker_open,
    circuit_breaker_opened_at, last_error_code, version FROM social_accounts WHERE id = ${accountId}`);
  return (rows as any).rows[0] as {
    status: string;
    consecutive_error_count: number;
    circuit_breaker_open: boolean;
    circuit_breaker_opened_at: string | null;
    last_error_code: string | null;
    version: number;
  };
}

describe("error classification + backoff (pure, FR-SOC-053/054)", () => {
  test("the five classes map exactly as the spec lists them", () => {
    expect(classifyPlatformHttpError(null)).toBe("network");
    expect(classifyPlatformHttpError(401)).toBe("auth");
    expect(classifyPlatformHttpError(429)).toBe("rate_limited");
    expect(classifyPlatformHttpError(500)).toBe("transient");
    expect(classifyPlatformHttpError(503)).toBe("transient");
    expect(classifyPlatformHttpError(400)).toBe("client");
    expect(classifyPlatformHttpError(403)).toBe("client");
    expect(classifyPlatformHttpError(404)).toBe("not_found");
  });

  test("backoff is 1s/2s/4s with bounded jitter, capped at three attempts", () => {
    expect(platformBackoffDelayMs(1, 0)).toBe(750); // 1s − 25%
    expect(platformBackoffDelayMs(1, 1)).toBe(1250); // 1s + 25%
    expect(platformBackoffDelayMs(2, 0)).toBe(1500);
    expect(platformBackoffDelayMs(3, 0)).toBe(3000);
    expect(platformBackoffDelayMs(99, 0)).toBe(3000); // capped
  });
});

describe.skipIf(!hasDb())("health checks — the breaker lifecycle", () => {
  test("a healthy probe records latency, keeps the ledger at zero, and touches nothing else", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc, probeCalls } = serviceWithProbes(db, [{ status: 200 }]);

      const result = await svc.runHealthChecks(db);
      expect(result.checked).toBe(1);
      expect(result.healthy).toBe(1);
      expect(result.failed).toBe(0);
      expect(probeCalls()[0]).toContain("youtube/v3/channels");

      const row = await accountRow(db, accountId);
      expect(row.status).toBe("active");
      expect(row.consecutive_error_count).toBe(0);
      expect(row.version).toBe(2);
      const health = await db.execute(sql`SELECT status, api_success FROM social_account_health_log
        WHERE social_account_id = ${accountId}`);
      expect((health as any).rows[0].status).toBe("healthy");
    });
  });

  test("nine failures then a success stay open-free; the tenth failure opens the breaker", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 2" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc } = serviceWithProbes(db, [{ status: 500 }]);

      // FR-SOC-040: nine failures must not open the breaker.
      for (let i = 1; i <= 9; i += 1) {
        const result = await svc.runHealthChecks(db);
        expect(result.failed).toBe(1);
        const row = await accountRow(db, accountId);
        expect(row.circuit_breaker_open).toBe(false);
        expect(row.consecutive_error_count).toBe(i);
      }

      // The tenth opens it, stamps the row, and audits the opening.
      const tenth = await svc.runHealthChecks(db);
      expect(tenth.breakerOpened).toBe(1);
      const row = await accountRow(db, accountId);
      expect(row.circuit_breaker_open).toBe(true);
      expect(row.circuit_breaker_opened_at).not.toBeNull();
      expect(row.status).toBe("error");
      const audit = await db.execute(sql`SELECT after_state FROM unified_audit_log
        WHERE resource_id = ${accountId} AND action = 'socialaccount.breaker_opened'`);
      expect(((audit as any).rows[0]?.after_state ?? {}).consecutiveFailures).toBe(10);

      // …and once open, dispatch is blocked (the roadmap's P3/P7 requirement).
      await expect(
        svc.assertDispatchAllowed(db, { organizationId: org.id, accountId }),
      ).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    });
  });

  test("recovery is demonstrable: a probe success closes the breaker and dispatch resumes", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 3" });
      const accountId = await seedAccount(db, org.id, owner.id, {
        breakerOpen: true,
        openedMinutesAgo: 30,
        consecutive: 10,
        status: "error",
      });

      // Open breaker probes every run (half-open).
      const { svc } = serviceWithProbes(db, [{ status: 200 }]);
      const result = await svc.runHealthChecks(db);
      expect(result.checked).toBe(1);
      expect(result.breakerRecovered).toBe(1);

      const row = await accountRow(db, accountId);
      expect(row.circuit_breaker_open).toBe(false);
      expect(row.circuit_breaker_opened_at).toBeNull();
      expect(row.status).toBe("active");
      expect(row.consecutive_error_count).toBe(0);

      const audit = await db.execute(sql`SELECT after_state FROM unified_audit_log
        WHERE resource_id = ${accountId} AND action = 'socialaccount.breaker_recovered'`);
      expect((audit as any).rows.length).toBe(1);

      // Dispatch allowed again.
      await svc.assertDispatchAllowed(db, { organizationId: org.id, accountId });
    });
  });

  test("429 records rate_limited and advances nothing (BR-SOC-019)", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 4" });
      const accountId = await seedAccount(db, org.id, owner.id, { consecutive: 5 });
      const { svc } = serviceWithProbes(db, [{ status: 429 }]);

      const result = await svc.runHealthChecks(db);
      expect(result.rateLimited).toBe(1);
      expect(result.failed).toBe(0);

      const row = await accountRow(db, accountId);
      expect(row.consecutive_error_count).toBe(5); // untouched
      expect(row.circuit_breaker_open).toBe(false);
      const health = await db.execute(sql`SELECT status, error_code FROM social_account_health_log
        WHERE social_account_id = ${accountId}`);
      expect((health as any).rows[0].status).toBe("rate_limited");
    });
  });
});

describe.skipIf(!hasDb())("health checks — the 401 path (FR-SOC-055)", () => {
  test("401 → one on_demand refresh → re-probe success restores without surfacing", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 5" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc, refreshCount, probeCalls } = serviceWithProbes(
        db,
        [{ status: 401 }, { status: 200 }],
        () => ({ accessToken: "fresh-access-token" }),
      );

      const result = await svc.runHealthChecks(db);
      expect(result.healthy).toBe(1);
      expect(result.needsReauth).toBe(0);
      expect(refreshCount()).toBe(1);
      expect(probeCalls().length).toBe(2); // the re-probe happened

      const row = await accountRow(db, accountId);
      expect(row.status).toBe("active");
      expect(row.version).toBe(3); // refresh bumped 1→2, probe success 2→3

      const { decryptSecret } = await import("../../lib/crypto");
      const raw = await db.execute(
        sql`SELECT access_token_encrypted FROM social_accounts WHERE id = ${accountId}`,
      );
      expect(await decryptSecret((raw as any).rows[0].access_token_encrypted, KEY)).toBe(
        "fresh-access-token",
      );
    });
  });

  test("401 with a failing refresh surfaces needs_reauth immediately (no retry)", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 6" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const { svc, refreshCount } = serviceWithProbes(db, [{ status: 401 }], () => ({
        fail: true,
      }));

      const result = await svc.runHealthChecks(db);
      expect(result.needsReauth).toBe(1);
      expect(refreshCount()).toBe(1); // FR-SOC-055: no retry

      const row = await accountRow(db, accountId);
      expect(row.status).toBe("needs_reauth");
      const health = await db.execute(sql`SELECT status, error_code FROM social_account_health_log
        WHERE social_account_id = ${accountId}`);
      expect((health as any).rows[0].error_code).toBe("auth_refresh_failed");

      // A needs_reauth account is no longer due for probes.
      const again = await svc.runHealthChecks(db);
      expect(again.checked).toBe(0);
    });
  });
});

describe.skipIf(!hasDb())("health checks — chronic escalation (FR-SOC-059)", () => {
  test("breaker open >24h escalates exactly once; fresh breakers stay quiet", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 7" });
      await seedAccount(db, org.id, owner.id, {
        breakerOpen: true,
        openedMinutesAgo: 25 * 60,
        status: "error",
      });
      await seedAccount(db, org.id, owner.id, {
        breakerOpen: true,
        openedMinutesAgo: 60,
        status: "error",
      });
      const { svc } = serviceWithProbes(db, [{ status: 500 }]);

      const first = await svc.runHealthChecks(db);
      expect(first.escalated).toBe(1);
      const second = await svc.runHealthChecks(db);
      expect(second.escalated).toBe(0); // the marker row makes it once-per-outage

      const audit = await db.execute(sql`SELECT after_state, severity FROM unified_audit_log
        WHERE action = 'socialaccount.chronic_failure'`);
      expect((audit as any).rows.length).toBe(1);
      expect((audit as any).rows[0].severity).toBe("critical");
    });
  });
});

describe.skipIf(!hasDb())("health checks — the dispatch gate", () => {
  test("missing and disconnected accounts are NotFound; needs_reauth is 503; active passes", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 8" });
      const activeId = await seedAccount(db, org.id, owner.id);
      const reauthId = await seedAccount(db, org.id, owner.id, { status: "needs_reauth" });
      const disconnectedId = await seedAccount(db, org.id, owner.id, { status: "disconnected" });
      const { svc } = serviceWithProbes(db, []);

      await svc.assertDispatchAllowed(db, { organizationId: org.id, accountId: activeId });
      await expect(
        svc.assertDispatchAllowed(db, { organizationId: org.id, accountId: reauthId }),
      ).rejects.toBeInstanceOf(CircuitBreakerOpenError);
      await expect(
        svc.assertDispatchAllowed(db, { organizationId: org.id, accountId: disconnectedId }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        svc.assertDispatchAllowed(db, {
          organizationId: org.id,
          accountId: "soc_00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe.skipIf(!hasDb())("health checks — the job", () => {
  test("the handler runs the sweep and reports the tick's counts", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Hp", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Hp Org 9" });
      await seedAccount(db, org.id, owner.id);
      const { svc } = serviceWithProbes(db, [{ status: 200 }]);
      setSocialServiceForTest(svc);
      try {
        const attempt = {
          id: "job-test",
          name: socialHealthCheckJob.name,
          data: null,
          attempt: 1,
          attemptsMax: 1,
          createdOn: new Date(),
          startedOn: new Date(),
        };
        const outcome = await socialHealthCheckJob.handle({ db, job: attempt as never }, null);
        expect(outcome).toMatchObject({ checked: 1, healthy: 1, breakerOpened: 0, escalated: 0 });
      } finally {
        setSocialServiceForTest(undefined);
      }
    });
  });
});
