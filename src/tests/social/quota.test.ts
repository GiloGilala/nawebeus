/**
 * Quota tracking (NWB-P2-004) — the jsonb ledger on `social_accounts`, live DB.
 *
 * Under test: the atomic increment (concurrent spenders cannot lose units), the
 * `quota_status` ladder with one audit event per crossing (FR-SOC-033/034/038), the gate's
 * headroom/reset semantics, worst-bucket-wins, and the nightly roll's automatic resume.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { derivedKeyMaterial } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import { NotFoundError } from "../../lib/errors";
import { createSocialService, type QuotaStatus } from "../../services/social";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

function service(_db: Db) {
  return createSocialService({
    readEnv: () => undefined,
    keyMaterial: derivedKeyMaterial("quota-test-secret"),
    appBaseUrl: "http://localhost:3000",
    defaultQuotaLimit: 1000,
  });
}

async function seedAccount(db: Db, orgId: string, userId: string): Promise<string> {
  const accountId = `soc_${crypto.randomUUID()}`;
  await db.execute(sql`
    INSERT INTO social_accounts (
      id, organization_id, platform, platform_user_id, platform_username,
      access_token_encrypted, token_expires_at, status, connected_by, version
    ) VALUES (
      ${accountId}, ${orgId}, 'youtube', ${"UC_" + accountId.slice(-12)}, 'quota-channel',
      ${Buffer.from("sealed").toString("base64")}, now() + interval '2 hours', 'active',
      ${userId}, 1
    )
  `);
  return accountId;
}

async function quotaRow(db: Db, accountId: string) {
  const rows = await db.execute(sql`SELECT quota_tracking, quota_status, version
    FROM social_accounts WHERE id = ${accountId}`);
  return (rows as any).rows[0] as {
    quota_tracking: Record<string, { limit: number; used: number; resetsAt?: string }>;
    quota_status: QuotaStatus;
    version: number;
  };
}

describe.skipIf(!hasDb())("quota tracking — updateQuotaUsage", () => {
  test("increments atomically under concurrency; twenty spenders land exactly twenty", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);

      // One increment first to materialize the bucket at the explicit limit.
      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "write",
        units: 0,
        resetsAt: new Date(Date.now() + 86_400_000),
      });

      // 20 concurrent increments of 1 — lost updates would show up as a smaller total.
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          svc.updateQuotaUsage(db, { organizationId: org.id, accountId, kind: "write", units: 1 }),
        ),
      );
      expect(results.length).toBe(20);
      const row = await quotaRow(db, accountId);
      expect(row.quota_tracking.write!.used).toBe(20);
      expect(row.quota_tracking.write!.limit).toBe(1000);
      // seed 1 + the account-materialize UPDATE + 20 spends
      expect(row.version).toBe(22);
    });
  });

  test("the status ladder crossings audit exactly once each", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org 2" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);
      const base = {
        organizationId: org.id,
        accountId,
        kind: "read" as const,
        resetsAt: new Date(Date.now() + 3_600_000),
      };

      // Materialize at limit 1000, then climb: 79 → 800 (80%, warning) → 950 (critical) → 1000 (exhausted).
      await svc.updateQuotaUsage(db, { ...base, units: 0 });
      const w = await svc.updateQuotaUsage(db, { ...base, units: 800 });
      expect(w.status).toBe("warning");
      expect(w.crossedTo).toBe("warning");
      const w2 = await svc.updateQuotaUsage(db, { ...base, units: 1 });
      expect(w2.status).toBe("warning");
      expect(w2.crossedTo).toBeUndefined(); // no second audit inside the band
      const c = await svc.updateQuotaUsage(db, { ...base, units: 149 });
      expect(c.status).toBe("critical");
      expect(c.crossedTo).toBe("critical");
      const e = await svc.updateQuotaUsage(db, { ...base, units: 50 });
      expect(e.status).toBe("exhausted");
      expect(e.crossedTo).toBe("exhausted");

      const audits = await db.execute(sql`SELECT action FROM unified_audit_log
        WHERE resource_id = ${accountId} AND action LIKE 'socialaccount.quota%'
        ORDER BY action`);
      const actions = (audits as any).rows.map((r: { action: string }) => r.action).sort();
      expect(actions).toEqual([
        "socialaccount.quota_critical",
        "socialaccount.quota_exhausted",
        "socialaccount.quota_warning",
      ]);
    });
  });

  test("worst bucket wins: read exhausted + write fresh is exhausted", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org 3" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);
      const resetsAt = new Date(Date.now() + 3_600_000);
      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "write",
        units: 1,
        resetsAt,
      });
      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "read",
        units: 1000,
        resetsAt,
      });
      const row = await quotaRow(db, accountId);
      expect(row.quota_status).toBe("exhausted");
    });
  });

  test("a negative spend is refused; an unknown account is 404", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org 4" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);
      await expect(
        svc.updateQuotaUsage(db, { organizationId: org.id, accountId, kind: "read", units: -1 }),
      ).rejects.toThrow(/cannot be negative/);
      await expect(
        svc.updateQuotaUsage(db, {
          organizationId: org.id,
          accountId: "soc_00000000-0000-4000-8000-000000000000",
          kind: "read",
          units: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe.skipIf(!hasDb())("quota tracking — hasQuotaRemaining", () => {
  test("headroom true, past-limit false, exactly-at-limit false, spent window rolled true", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org 5" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);

      expect(
        await svc.hasQuotaRemaining(db, {
          organizationId: org.id,
          accountId,
          kind: "read",
          units: 5,
        }),
      ).toBe(true);

      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "read",
        units: 995,
        resetsAt: new Date(Date.now() + 3_600_000),
      });
      expect(
        await svc.hasQuotaRemaining(db, {
          organizationId: org.id,
          accountId,
          kind: "read",
          units: 5,
        }),
      ).toBe(true);
      expect(
        await svc.hasQuotaRemaining(db, {
          organizationId: org.id,
          accountId,
          kind: "read",
          units: 6,
        }),
      ).toBe(false);

      await svc.updateQuotaUsage(db, { organizationId: org.id, accountId, kind: "read", units: 5 });
      expect(
        await svc.hasQuotaRemaining(db, {
          organizationId: org.id,
          accountId,
          kind: "read",
          units: 1,
        }),
      ).toBe(false);

      // A spent bucket whose reset instant has passed reads as empty (full headroom).
      const rolled = `soc_${crypto.randomUUID()}`;
      await db.execute(sql`
        INSERT INTO social_accounts (id, organization_id, platform, platform_user_id, platform_username,
          access_token_encrypted, token_expires_at, status, connected_by, quota_tracking, version)
        VALUES (${rolled}, ${org.id}, 'youtube', ${"UC_" + rolled.slice(-12)}, 'rolled',
          'x', now() + interval '2 hours', 'active', ${owner.id},
          ${JSON.stringify({ read: { limit: 1000, used: 1000, resetsAt: new Date(Date.now() - 1_000).toISOString() } })}::jsonb, 1)`);
      expect(
        await svc.hasQuotaRemaining(db, {
          organizationId: org.id,
          accountId: rolled,
          kind: "read",
        }),
      ).toBe(true);
    });
  });
});

describe.skipIf(!hasDb())("quota tracking — snapshot + reset", () => {
  test("snapshot reports per-bucket utilization; the reset roll zeroes due buckets and restores healthy", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Qt", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Qt Org 6" });
      const accountId = await seedAccount(db, org.id, owner.id);
      const svc = service(db);

      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "read",
        units: 900,
        resetsAt: new Date(Date.now() - 60_000),
      });
      await svc.updateQuotaUsage(db, {
        organizationId: org.id,
        accountId,
        kind: "write",
        units: 10,
        resetsAt: new Date(Date.now() + 3_600_000),
      });

      const snapshot = await svc.getQuotaSnapshot(db, { organizationId: org.id, accountId });
      expect(snapshot.status).toBe("warning"); // read 90% > write 1%
      expect(snapshot.buckets.read!.percent).toBe(90);
      expect(snapshot.buckets.write!.percent).toBe(1);

      const { reset } = await svc.resetDueQuotas(db);
      expect(reset).toBeGreaterThanOrEqual(1);
      const row = await quotaRow(db, accountId);
      expect(row.quota_tracking.read!.used).toBe(0);
      expect(row.quota_tracking.write!.used).toBe(10); // future reset untouched
      expect(row.quota_status).toBe("healthy"); // remaining bucket is 1%

      // Idempotent: nothing due on the second pass.
      const second = await svc.resetDueQuotas(db);
      expect(second.reset).toBe(0);
    });
  });
});
