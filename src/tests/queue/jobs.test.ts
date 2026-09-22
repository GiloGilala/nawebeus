/**
 * The maintenance jobs, against a real PostgreSQL (NWB-P1-001).
 *
 * The chain-verification job lives here too by registration but is tested in
 * `src/tests/audit/chain.test.ts`, next to the chain it verifies.
 *
 * What the fake-boss suite cannot prove, and this exists for:
 *
 * - the handler's SQL is valid against the actual columns (F-24 is the cautionary tale here: a
 *   purge service referenced a column that did not exist and shipped green because nothing ran it);
 * - re-running a job in the same window is a no-op — the idempotency ground rule, asserted on the
 *   data rather than on a mock;
 * - `organizations.owner_id` really does block the account purge, so the nightly order in
 *   `src/lib/scheduler.ts` is load-bearing and not a style choice;
 * - an audit row written by the real `writeAuditLog` lands, with jsonb `after_state`/`changes` and
 *   a NULL `organization_id` (a cross-tenant run attributing itself to one tenant would be a lie).
 *
 * Each test runs inside `withTestDb`'s transaction, so the DELETEs are real and then rolled back.
 */
import { describe, expect, test } from "bun:test";
import { type SQL, sql } from "drizzle-orm";
import { purgeExpiredAccountsJob } from "../../jobs/purge-expired-accounts";
import { purgeExpiredOrganizationsJob } from "../../jobs/purge-expired-organizations";
import { rateLimitReclaimJob } from "../../jobs/rate-limit-reclaim";
import type { Db } from "../../lib/db";
import { RATE_LIMIT_RECLAIM_GRACE_MS } from "../../lib/rate-limit";
import { type AnyJobDefinition, type JobAttempt, runJobGuarded } from "../../lib/worker";
import { writeAuditLog } from "../../services/audit";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const ATTEMPT: JobAttempt = { id: "job-test", attempt: 1 };

/** The columns the two audit tests read back, as PostgreSQL types them. */
interface AuditRow {
  action: string;
  severity: string;
  category: string;
  actor_type: string | null;
  module: string;
  organization_id: string | null;
  after_state: {
    deleted?: number;
    failed?: number;
    errors?: Array<{ id: string; error: string }>;
  } | null;
  metadata: { queue?: string; jobId?: string } | null;
  reason: string | null;
  changes: { error?: string } | null;
}

async function insertBucket(db: Db, key: string, expiresAt: string): Promise<void> {
  await db.execute(
    sql`INSERT INTO rate_limits (key, count, window_start, expires_at)
         VALUES (${key}, 1, ${expiresAt}, ${expiresAt})`,
  );
}

async function bucketExists(db: Db, key: string): Promise<boolean> {
  const row = await selectOne<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM rate_limits WHERE key = ${key}`,
  );
  return Number(row?.n ?? 0) > 0;
}

/** Put an account past the point of no return, the way `deleteAccount` would have days earlier. */
async function stampAccountExpired(db: Db, userId: string): Promise<void> {
  await db.execute(
    sql`UPDATE users SET deleted_at = now() - interval '31 days',
                         scheduled_deletion_at = now() - interval '1 day'
         WHERE id = ${userId}`,
  );
}

async function stampOrganizationExpired(db: Db, orgId: string): Promise<void> {
  await db.execute(
    sql`UPDATE organizations SET deleted_at = now() - interval '31 days',
                                  scheduled_deletion_at = now() - interval '1 day'
         WHERE id = ${orgId}`,
  );
}

/**
 * `db.execute` hands back the node-postgres result, so the row array sits one level down. Every
 * suite in this repo reads it the same way; centralised here because two of the tests below need it.
 */
async function selectOne<T>(db: Db, query: SQL): Promise<T | undefined> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: T[] }).rows?.[0];
}

async function rowGone(db: Db, table: string, id: string): Promise<boolean> {
  const row = await selectOne<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM ${sql.raw(table)} WHERE id = ${id}`,
  );
  return Number(row?.n ?? 0) === 0;
}

describe.skipIf(!hasDb())("queue jobs against a live database", () => {
  test("rate-limit reclamation deletes only buckets past the grace window, and the second run does nothing", async () => {
    await withTestDb(async ({ db }) => {
      const tag = crypto.randomUUID().slice(0, 8);
      // Past the grace window by every measure the reclaim uses: expired, and by more than an hour.
      const doomed = `q-test-doomed-${tag}`;
      const live = `q-test-live-${tag}`;
      await insertBucket(db, doomed, hoursAgo(2));
      await insertBucket(db, live, new Date(Date.now() + 60_000).toISOString());

      const first = await rateLimitReclaimJob.handle({ db, job: ATTEMPT }, null);
      expect((first as { deleted: number }).deleted).toBeGreaterThanOrEqual(1);
      expect(await bucketExists(db, doomed)).toBe(false);
      expect(await bucketExists(db, live)).toBe(true);

      // Ground rule 4, on the data: the same job in the same window finds nothing left to do.
      const second = await rateLimitReclaimJob.handle({ db, job: ATTEMPT }, null);
      expect(second).toEqual({ deleted: 0, graceMs: RATE_LIMIT_RECLAIM_GRACE_MS });
    });
  });

  test("a manual run can widen the window, and the scheduled run never does", async () => {
    await withTestDb(async ({ db }) => {
      const tag = crypto.randomUUID().slice(0, 8);
      const recent = `q-test-recent-${tag}`;
      // Expired a minute ago: inside the default grace window, outside `graceMs: 0`.
      await insertBucket(db, recent, new Date(Date.now() - 60_000).toISOString());

      expect(await rateLimitReclaimJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 0,
        graceMs: RATE_LIMIT_RECLAIM_GRACE_MS,
      });
      expect(await bucketExists(db, recent)).toBe(true);

      expect(await rateLimitReclaimJob.handle({ db, job: ATTEMPT }, { graceMs: 0 })).toEqual({
        deleted: 1,
        graceMs: 0,
      });
      expect(await bucketExists(db, recent)).toBe(false);
    });
  });

  test("one blocked account no longer wedges the batch: per-row delete, per-row report", async () => {
    await withTestDb(async ({ db }) => {
      const plain = await createTestUser(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await stampAccountExpired(db, plain.id);
      await stampAccountExpired(db, owner.id);
      await stampOrganizationExpired(db, org.id);

      /**
       * F-25 / D16 in the shape the job inherits it: the owner still owns an organization, so its
       * own DELETE refuses — but the refusal costs exactly that row now (NWB-P1-013), not the
       * statement. Nothing throws; the blocked row is reported with its error.
       */
      expect(await purgeExpiredAccountsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 1,
        failed: 1,
        errors: [{ id: owner.id, error: expect.stringMatching(/23503|owner_id/i) }],
        // No audit rows reference these factory users, so the erasure scrubs nothing — the key
        // is present because the report shape no longer depends on which hooks ran (NWB-P1-015).
        auditAnonymized: 0,
        held: 0,
      });
      expect(await rowGone(db, "users", plain.id)).toBe(true);
      expect(await rowGone(db, "users", owner.id)).toBe(false);

      // …so the scheduler still runs organizations first, and in the same hour the accounts go:
      // the org purge clears the reference the owner's erasure was waiting on.
      expect(await purgeExpiredOrganizationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        held: 0,
      });
      expect(await rowGone(db, "organizations", org.id)).toBe(true);

      expect(await purgeExpiredAccountsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
      expect(await rowGone(db, "users", owner.id)).toBe(true);

      // Both are no-ops the second time, which is what makes at-least-once delivery equivalent to
      // exactly-once here — the property the idempotency ground rule is actually asking for.
      expect(await purgeExpiredAccountsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 0,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
      expect(await purgeExpiredOrganizationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 0,
        failed: 0,
        errors: [],
        held: 0,
      });
    });
  });

  test("the org purge isolates a blocked row the same way — proven with a stand-in restrictive FK", async () => {
    await withTestDb(async ({ db }) => {
      // No restrictive edge to `organizations.id` exists in the active schema today (every FK is
      // CASCADE or SET NULL — verified against the applied migration DDL), so the blocker is a
      // temporary table with the default NO ACTION FK: the same refusal class the aspirational
      // billing tables will bring when they migrate. Transactional DDL — rolls back with the test.
      await db.execute(
        sql`CREATE TABLE tmp_org_purge_blocker (org_id uuid NOT NULL REFERENCES organizations(id))`,
      );
      const blockedOwner = await createTestUser(db);
      const freeOwner = await createTestUser(db);
      const blocked = await createTestOrg(db, { ownerId: blockedOwner.id });
      const free = await createTestOrg(db, { ownerId: freeOwner.id });
      await db.execute(sql`INSERT INTO tmp_org_purge_blocker (org_id) VALUES (${blocked.id})`);
      await stampOrganizationExpired(db, blocked.id);
      await stampOrganizationExpired(db, free.id);

      expect(await purgeExpiredOrganizationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 1,
        failed: 1,
        errors: [{ id: blocked.id, error: expect.stringMatching(/23503/i) }],
        held: 0,
      });
      expect(await rowGone(db, "organizations", free.id)).toBe(true);
      expect(await rowGone(db, "organizations", blocked.id)).toBe(false);

      // Re-running is still idempotent: the blocked row reports `failed` again, never `deleted`.
      expect(await purgeExpiredOrganizationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 0,
        failed: 1,
        errors: [{ id: blocked.id, error: expect.stringMatching(/23503/i) }],
        held: 0,
      });
    });
  });

  test("the real audit sink records a successful run, unscoped to any organization", async () => {
    await withTestDb(async ({ db }) => {
      const tag = crypto.randomUUID().slice(0, 8);
      await insertBucket(db, `q-test-audit-${tag}`, hoursAgo(2));

      const jobId = `audit-${tag}`;
      await runJobGuarded(
        rateLimitReclaimJob,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        null,
      );

      const row = await selectOne<AuditRow>(
        db,
        sql`SELECT action, severity, category, actor_type, module, organization_id, after_state, metadata
             FROM unified_audit_log WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );

      expect(row).toBeDefined();
      expect(row).toMatchObject({
        action: "rate-limits.reclaimed",
        severity: "info",
        // `core`, not `system`: `chk_ual_system_requires_checksum` would demand a hash chain
        // nothing computes yet. P1-002 moves these to their real module.
        module: "core",
        category: "data_ops",
        actor_type: "system",
        organization_id: null,
      });
      expect(row?.after_state?.deleted).toBeGreaterThanOrEqual(1);
      expect(row?.metadata?.queue).toBe(rateLimitReclaimJob.name);
    });
  });

  test("a partial run audits as warning, so a night that erased nothing-but-tried never reads as clean", async () => {
    await withTestDb(async ({ db }) => {
      // Two owners whose organizations are NOT expired: both rows refuse with 23503, nothing is
      // erased, and the run still reports — `{ deleted: 0, failed: 2 }` must be distinguishable
      // from a clean `{ deleted: 0 }` idle night.
      const first = await createTestUser(db);
      const second = await createTestUser(db);
      await createTestOrg(db, { ownerId: first.id });
      await createTestOrg(db, { ownerId: second.id });
      await stampAccountExpired(db, first.id);
      await stampAccountExpired(db, second.id);

      const jobId = `partial-${crypto.randomUUID().slice(0, 8)}`;
      const outcome = await runJobGuarded(
        purgeExpiredAccountsJob,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        null,
      );
      expect(outcome).toMatchObject({ deleted: 0, failed: 2 });

      const row = await selectOne<AuditRow>(
        db,
        sql`SELECT action, severity, after_state, metadata
             FROM unified_audit_log WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );

      expect(row).toBeDefined();
      expect(row).toMatchObject({ action: "accounts.purged", severity: "warning" });
      expect(row?.after_state).toMatchObject({ deleted: 0, failed: 2 });
      expect(row?.after_state?.errors).toHaveLength(2);
      expect(row?.metadata?.queue).toBe(purgeExpiredAccountsJob.name);
    });
  });

  test("a failure writes its own row, because a purge that has been dying nightly must be visible", async () => {
    await withTestDb(async ({ db }) => {
      const failing: AnyJobDefinition = {
        name: rateLimitReclaimJob.name,
        description: "forced failure",
        audit: {
          action: "rate-limits.reclaimed",
          category: "data_ops",
          resourceType: "rate_limit",
        },
        handle: async () => {
          throw new Error("forced purge failure");
        },
      };
      const jobId = `fail-${crypto.randomUUID().slice(0, 8)}`;

      await expect(
        runJobGuarded(
          failing,
          { db, audit: (params) => writeAuditLog(params) },
          { id: jobId, attempt: 1 },
          null,
        ),
      ).rejects.toThrow("forced purge failure");

      const row = await selectOne<AuditRow>(
        db,
        sql`SELECT severity, reason, changes FROM unified_audit_log WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );

      expect(row).toBeDefined();
      // No retry budget on a manual run, so this is terminal — `critical`, not `warning`.
      expect(row?.severity).toBe("critical");
      expect(row?.reason).toContain("forced purge failure");
      expect(row?.changes?.error).toBe("forced purge failure");
    });
  });
});
