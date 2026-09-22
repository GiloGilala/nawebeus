import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { retentionEnforceJob } from "../../jobs/retention-enforce";
import { loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { type JobAttempt, runJobGuarded } from "../../lib/worker";
import { writeAuditLog } from "../../services/audit";
import {
  completeBackup,
  expireBackupRecords,
  recordBackup,
} from "../../services/retention/backups.service";
import { placeLegalHold, releaseLegalHold } from "../../services/retention/legal-holds.service";
import { enforceRetention, runAuditCensus } from "../../services/retention/retention.service";
import { deleteAccount } from "../../services/users/account-deletion.service";
import { ensureRetentionTables, withTestDb } from "../helpers/test-db";
import { createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const ATTEMPT: JobAttempt = { id: "retention-test", attempt: 1 };

// biome-ignore lint/suspicious/noExplicitAny: test rows are read dynamically throughout
const rowOf = (rows: unknown): any => (rows as any).rows?.[0];
// biome-ignore lint/suspicious/noExplicitAny: test rows are read dynamically throughout
const rowsOf = (rows: unknown): any[] => (rows as any).rows ?? [];

async function seedDataExport(db: Db, userId: string, expiresIn: string): Promise<string> {
  return rowOf(
    await db.execute(
      sql`INSERT INTO data_export_requests (user_id, expires_at)
          VALUES (${userId}, now() + ${expiresIn}::interval) RETURNING id`,
    ),
  ).id as string;
}

async function seedSession(
  db: Db,
  userId: string,
  options: { expiresIn: string; activityAgo: string; revoked?: boolean },
): Promise<string> {
  return rowOf(
    await db.execute(
      sql`INSERT INTO sessions (user_id, session_token_hash, expires_at, last_activity_at, is_revoked)
          VALUES (${userId}, ${`hash-${crypto.randomUUID()}`},
                  now() + ${options.expiresIn}::interval,
                  now() - ${options.activityAgo}::interval,
                  ${options.revoked ?? false})
          RETURNING id`,
    ),
  ).id as string;
}

async function seedToken(
  db: Db,
  userId: string,
  options: { expiresIn: string; usedAgo?: string | null },
): Promise<string> {
  const usedAt =
    options.usedAgo === undefined || options.usedAgo === null
      ? sql`NULL`
      : sql`now() - ${options.usedAgo}::interval`;
  return rowOf(
    await db.execute(
      sql`INSERT INTO tokens (user_id, token_type, purpose, expires_at, used_at)
          VALUES (${userId}, 'refresh', 'test', now() + ${options.expiresIn}::interval, ${usedAt})
          RETURNING id`,
    ),
  ).id as string;
}

async function rowExists(
  db: Db,
  table: "data_export_requests" | "sessions" | "tokens",
  id: string,
): Promise<boolean> {
  const query =
    table === "data_export_requests"
      ? sql`SELECT id FROM data_export_requests WHERE id = ${id}`
      : table === "sessions"
        ? sql`SELECT id FROM sessions WHERE id = ${id}`
        : sql`SELECT id FROM tokens WHERE id = ${id}`;
  return rowsOf(await db.execute(query)).length > 0;
}

describe.skipIf(!hasDb())("retention liveness (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("due rows go, live rows stay, and the outcome accounts for every table", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const user = await createTestUser(db);

      const dueExport = await seedDataExport(db, user.id, "-1 day");
      const freshExport = await seedDataExport(db, user.id, "30 days");

      const staleDeadSession = await seedSession(db, user.id, {
        expiresIn: "-10 days",
        activityAgo: "400 days",
      });
      const recentDeadSession = await seedSession(db, user.id, {
        expiresIn: "-10 days",
        activityAgo: "1 hour",
      });
      const staleLiveSession = await seedSession(db, user.id, {
        expiresIn: "10 days",
        activityAgo: "400 days",
      });
      const revokedStaleSession = await seedSession(db, user.id, {
        expiresIn: "10 days",
        activityAgo: "400 days",
        revoked: true,
      });

      const oldExpiredToken = await seedToken(db, user.id, { expiresIn: "-31 days" });
      const freshExpiredToken = await seedToken(db, user.id, { expiresIn: "-1 day" });
      const oldUsedToken = await seedToken(db, user.id, {
        expiresIn: "300 days",
        usedAgo: "31 days",
      });
      const freshUsedToken = await seedToken(db, user.id, {
        expiresIn: "300 days",
        usedAgo: "1 day",
      });
      const freshToken = await seedToken(db, user.id, { expiresIn: "300 days" });

      const outcome = await enforceRetention(db);
      expect(outcome.deleted).toBe(5);
      expect(outcome.failed).toBe(0);
      expect(outcome.errors).toEqual([]);
      expect(outcome.held).toBe(0);
      expect(outcome.tables.data_export_requests).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
      expect(outcome.tables.sessions).toEqual({
        deleted: 2,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
      expect(outcome.tables.tokens).toEqual({
        deleted: 2,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
      expect(outcome.tables.backup_records).toEqual({ expired: 0 });
      expect(outcome.census.bootstrapped).toBe(true);
      expect(outcome.census.decreased).toEqual([]);

      for (const id of [
        dueExport,
        staleDeadSession,
        revokedStaleSession,
        oldExpiredToken,
        oldUsedToken,
      ]) {
        const table =
          id === dueExport
            ? ("data_export_requests" as const)
            : id === staleDeadSession || id === revokedStaleSession
              ? ("sessions" as const)
              : ("tokens" as const);
        expect(await rowExists(db, table, id)).toBe(false);
      }
      expect(await rowExists(db, "data_export_requests", freshExport)).toBe(true);
      expect(await rowExists(db, "sessions", recentDeadSession)).toBe(true);
      expect(await rowExists(db, "sessions", staleLiveSession)).toBe(true);
      expect(await rowExists(db, "tokens", freshExpiredToken)).toBe(true);
      expect(await rowExists(db, "tokens", freshUsedToken)).toBe(true);
      expect(await rowExists(db, "tokens", freshToken)).toBe(true);
    });
  });

  test("a held user's due rows survive every enforcer; release frees them", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const user = await createTestUser(db);
      const hold = await placeLegalHold(db, {
        userId: user.id,
        reason: "retention-scoped preservation",
        placedBy: "compliance-officer",
      });

      const dueExport = await seedDataExport(db, user.id, "-1 day");
      const dueSession = await seedSession(db, user.id, {
        expiresIn: "-10 days",
        activityAgo: "400 days",
      });
      const dueToken = await seedToken(db, user.id, { expiresIn: "-31 days" });

      const blocked = await enforceRetention(db);
      expect(blocked.deleted).toBe(0);
      expect(blocked.failed).toBe(3);
      expect(blocked.held).toBe(3);
      expect(blocked.tables.data_export_requests.held).toBe(1);
      expect(blocked.tables.sessions.held).toBe(1);
      expect(blocked.tables.tokens.held).toBe(1);
      for (const entry of blocked.errors) {
        expect(String(entry.error)).toContain(hold.id);
      }
      expect(await rowExists(db, "data_export_requests", dueExport)).toBe(true);
      expect(await rowExists(db, "sessions", dueSession)).toBe(true);
      expect(await rowExists(db, "tokens", dueToken)).toBe(true);

      await releaseLegalHold(db, {
        id: hold.id,
        releasedBy: "compliance-officer",
        releaseReason: "matter closed",
      });
      const freed = await enforceRetention(db);
      expect(freed.deleted).toBe(3);
      expect(freed.held).toBe(0);
    });
  });
});

describe.skipIf(!hasDb())("audit census (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("growth is silent, shrinkage raises a critical system alarm — counts relative, never absolute", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      // Other suites commit audit rows to the shared host, so absolute counts are meaningless
      // here: the baseline is planted relative to whatever is actually there.
      const actual = Number(
        rowOf(
          await db.execute(
            sql`SELECT count(*)::text AS n FROM unified_audit_log WHERE module = 'core'`,
          ),
        ).n,
      );

      // Phase 1: the log grew (or held steady) since the planted baseline — silence.
      await writeAuditLog({
        db,
        module: "compliance",
        actorType: "system",
        action: "retention.enforced",
        resourceType: "retention",
        resourceId: "planted-baseline-growth",
        afterState: { census: { counts: { core: Math.max(0, actual - 1) } } },
      });
      const grown = await runAuditCensus(db);
      expect(grown.bootstrapped).toBe(false);
      expect(grown.decreased).toEqual([]);
      // The snapshot is the truth, verifiable independently of the function that took it: no
      // alarm row was written, so a re-read must match exactly.
      const regrouped = rowsOf(
        await db.execute(
          sql`SELECT module, count(*)::text AS n FROM unified_audit_log GROUP BY module`,
        ),
      );
      const expected: Record<string, number> = {};
      for (const group of regrouped as { module: string; n: string }[]) {
        expected[group.module] = Number(group.n);
      }
      expect(grown.counts).toEqual(expected);
      const silent = rowsOf(
        await db.execute(
          sql`SELECT id FROM unified_audit_log WHERE action = 'retention.census.decrease_detected'`,
        ),
      );
      expect(silent).toHaveLength(0);

      // Phase 2: a row that existed at baseline is gone — an inflated planted count simulates
      // deletion arithmetically, which is all the detector's contract covers. (Preventing real
      // deletion is the 0002 trigger's tested territory, not this function's.)
      await writeAuditLog({
        db,
        module: "compliance",
        actorType: "system",
        action: "retention.enforced",
        resourceType: "retention",
        resourceId: "planted-baseline-shrink",
        afterState: { census: { counts: { core: actual + 1 } } },
      });
      const shrunk = await runAuditCensus(db);
      expect(shrunk.bootstrapped).toBe(false);
      expect(shrunk.decreased).toEqual(["core"]);

      const alarms = rowsOf(
        await db.execute(
          sql`SELECT action, severity, actor_type, resource_type, after_state
              FROM unified_audit_log WHERE action = 'retention.census.decrease_detected'`,
        ),
      ) as {
        action: string;
        severity: string;
        actor_type: string;
        resource_type: string;
        after_state: unknown;
      }[];
      expect(alarms).toHaveLength(1);
      expect(alarms[0]).toMatchObject({
        severity: "critical",
        actor_type: "system",
        resource_type: "audit_log",
      });
      expect(alarms[0]?.after_state).toEqual({
        decreased: [{ module: "core", before: actual + 1, after: actual }],
      });
    });
  });

  test("the first run bootstraps: no baseline, no alarm, just the snapshot", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const census = await runAuditCensus(db);
      expect(census).toEqual({
        counts: expect.any(Object),
        decreased: [],
        bootstrapped: true,
      });
    });
  });
});

describe.skipIf(!hasDb())("backup records (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("record → complete → expire, with failures never expiring and records never deleted", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);

      const recorded = await recordBackup(db, {
        backupType: "full_database",
        location: "s3://nawebeus-backups/nightly-001",
      });
      expect(recorded.id).toMatch(/^br_/);
      // No `retention_days` column exists — the window is proven by `expires_at`, which the
      // service computes from the input (30 days by default).
      const window = rowOf(
        await db.execute(sql`SELECT
            status,
            (expires_at > now() + interval '29 days'
             AND expires_at < now() + interval '31 days') AS in_window
          FROM backup_records WHERE id = ${recorded.id}`),
      );
      expect(window).toMatchObject({ status: "pending", in_window: true });

      const audit = rowsOf(
        await db.execute(
          sql`SELECT action, resource_type, resource_id FROM unified_audit_log
              WHERE action = 'backups.recorded' AND resource_id = ${recorded.id}`,
        ),
      );
      expect(audit).toHaveLength(1);

      const done = await completeBackup(db, {
        id: recorded.id,
        status: "completed",
        sizeBytes: 1024,
      });
      expect(done).toEqual({ id: recorded.id, status: "completed" });

      const failed = await recordBackup(db, {
        backupType: "incremental_wal",
        location: "s3://nawebeus-backups/nightly-002",
      });
      const failedClose = await completeBackup(db, {
        id: failed.id,
        status: "failed",
        errorMessage: "snapshot timed out",
      });
      expect(failedClose).toEqual({ id: failed.id, status: "failed" });

      expect(await expireBackupRecords(db)).toEqual({ expired: 0 });

      // Both runs age past their window; only the completed one expires.
      await db.execute(
        sql`UPDATE backup_records SET expires_at = now() - interval '1 day'
            WHERE id IN (${recorded.id}, ${failed.id})`,
      );
      expect(await expireBackupRecords(db)).toEqual({ expired: 1 });

      const statuses = rowsOf(
        await db.execute(
          sql`SELECT id, status FROM backup_records WHERE id IN (${recorded.id}, ${failed.id})`,
        ),
      ) as { id: string; status: string }[];
      expect(statuses).toHaveLength(2);
      expect(statuses.find((row) => row.id === recorded.id)?.status).toBe("expired");
      expect(statuses.find((row) => row.id === failed.id)?.status).toBe("failed");
    });
  });

  test("record and complete validate: bounds are rejected, terminal states are final", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);

      await expect(
        recordBackup(db, { backupType: "full_database", location: "  " }),
      ).rejects.toThrow(ValidationError);
      for (const retentionDays of [0, 29, 91]) {
        await expect(
          recordBackup(db, {
            backupType: "full_database",
            location: "s3://nawebeus-backups/x",
            retentionDays,
          }),
        ).rejects.toThrow(ValidationError);
      }
      const edge = await recordBackup(db, {
        backupType: "full_database",
        location: "s3://nawebeus-backups/edge",
        retentionDays: 90,
      });
      expect(edge.id).toMatch(/^br_/);

      await expect(
        completeBackup(db, { id: "br_doesnotexist", status: "completed" }),
      ).rejects.toThrow(NotFoundError);
      await expect(completeBackup(db, { id: edge.id, status: "failed" })).rejects.toThrow(
        ValidationError,
      );
      await completeBackup(db, { id: edge.id, status: "completed" });
      await expect(completeBackup(db, { id: edge.id, status: "completed" })).rejects.toThrow(
        ValidationError,
      );
    });
  });
});

describe.skipIf(!hasDb())("retention enforcement job (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("runJobGuarded twice: the first run's audit row is the second run's census baseline", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const user = await createTestUser(db);
      // A soft-deleted owner proves the DSAR enforcer needs no live subject: the package is
      // keyed by id, the hold check by owner, and neither requires an active account.
      await deleteAccount(db, user.id);
      const due = await seedDataExport(db, user.id, "-1 day");

      // The worker injects `deps.db` into the audit call, so the run's own audit row lands in
      // this transaction and rolls back with it — the suite is re-run safe by construction.
      const first = await runJobGuarded(
        retentionEnforceJob,
        { db, audit: writeAuditLog },
        ATTEMPT,
        null,
      );
      expect(first?.deleted).toBe(1);
      expect(first?.failed).toBe(0);
      expect(first?.held).toBe(0);
      expect(first?.census).toMatchObject({ bootstrapped: true });
      expect(await rowExists(db, "data_export_requests", due)).toBe(false);

      const enforced = rowOf(
        await db.execute(
          sql`SELECT action, category, resource_type, after_state FROM unified_audit_log
              WHERE action = 'retention.enforced'`,
        ),
      ) as {
        action: string;
        category: string;
        resource_type: string;
        after_state: { census?: { counts?: unknown } };
      };
      expect(enforced.category).toBe("compliance");
      expect(enforced.resource_type).toBe("retention");
      expect(enforced.after_state.census?.counts).toEqual(expect.any(Object));

      // Second run: nothing left to erase, and the census compares against the first run's row
      // — which added one `core` row since, so growth-silence is exercised for real.
      const second = await runJobGuarded(
        retentionEnforceJob,
        { db, audit: writeAuditLog },
        { id: "retention-test-2", attempt: 1 },
        null,
      );
      expect(second?.deleted).toBe(0);
      expect(second?.failed).toBe(0);
      expect(second?.held).toBe(0);
      expect(second?.errors).toEqual([]);
      expect(second?.census).toMatchObject({ bootstrapped: false, decreased: [] });
    });
  });
});
