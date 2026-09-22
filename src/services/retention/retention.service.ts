/**
 * Retention enforcement (NWB-P1-010): the §9.4 schedule, worked nightly.
 *
 * Three delete tables — expired DSAR packages, dead-and-stale sessions, expired/consumed
 * tokens — each through `deleteRowsPerRow` with a hold-check hook, so a held subject's rows
 * cost exactly themselves and report through the standard per-row channel. Plus the audit
 * census (detection, never deletion) and backup file-status expiry. The composed
 * `enforceRetention` rolls everything into one outcome whose top-level sums preserve the
 * partial-run convention untouched.
 *
 * Predicates are clock-ruled; `status` columns are advisory (nothing flips them) and NULL
 * expiries fail closed toward retention. When a new §9.4 row gains storage, its enforcer
 * joins `tables` here — the roll-up is built for that.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  type DbOrTx,
  deleteRowsPerRow,
  type PerRowDeleteResult,
  type RowDeleteFailure,
} from "../../lib/transaction";
// Direct `./write` import, not the `../audit` barrel — same cycle the holds service avoids.
import { writeAuditLog } from "../audit/write";
import { expireBackupRecords } from "./backups.service";
import { assertNoActiveHoldForUser } from "./legal-holds.service";

/** §5.3: session data lives a year — forensic history, then dead weight. */
const SESSION_STALE_DAYS = 365;
/** Consumed single-purpose secrets die a month after use or expiry, whichever the clock says. */
const TOKEN_GRACE_DAYS = 30;
/** DSAR packages carry no constant: their 7-day window IS the retention (DATA_EXPORT_WINDOW_MS). */

/**
 * The owner a retention hook hold-checks. `undefined` means a concurrent run got there first —
 * the DELETE below will remove 0 and the row counts as neither, so the hook returns 0 without
 * checking: there is nothing left to hold.
 */
async function hookOwnerId(
  tx: DbOrTx,
  table: "data_export_requests" | "sessions" | "tokens",
  id: string,
): Promise<string | undefined> {
  const owner = await tx.execute<{ user_id: string }>(
    sql`SELECT user_id FROM ${sql.raw(table)} WHERE id = ${id}`,
  );
  return (owner as unknown as { rows?: { user_id: string }[] }).rows?.[0]?.user_id;
}

/**
 * Delete DSAR packages past their download window. The package doubles as the subject's PII
 * bundle, so expiry deletes the whole row — the 410 path already treats it as gone.
 */
export async function pruneExpiredDataExports(
  db: NodePgDatabase<Record<string, any>>,
): Promise<PerRowDeleteResult> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM data_export_requests WHERE expires_at <= now() ORDER BY expires_at, id`,
  );
  const ids = ((rows as unknown as { rows?: { id: string }[] }).rows ?? []).map((row) => row.id);
  return deleteRowsPerRow(db, "data_export_requests", ids, {
    beforeDelete: async (tx, id) => {
      const userId = await hookOwnerId(tx, "data_export_requests", id);
      if (userId === undefined) return 0;
      await assertNoActiveHoldForUser(tx, userId, `data export ${id}`);
      return 0;
    },
  });
}

/**
 * Delete sessions that are dead (`expires_at` past or revoked) and stale (no activity in a
 * year). Live sessions are untouched at any age — the dead-gate runs first, so a long-lived
 * `remember_me` session never qualifies while it can still authenticate.
 */
export async function pruneExpiredSessions(
  db: NodePgDatabase<Record<string, any>>,
): Promise<PerRowDeleteResult> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM sessions
        WHERE (expires_at <= now() OR is_revoked)
          AND COALESCE(last_activity_at, created_at) <= now() - make_interval(days => ${SESSION_STALE_DAYS})
        ORDER BY COALESCE(last_activity_at, created_at), id`,
  );
  const ids = ((rows as unknown as { rows?: { id: string }[] }).rows ?? []).map((row) => row.id);
  return deleteRowsPerRow(db, "sessions", ids, {
    beforeDelete: async (tx, id) => {
      const userId = await hookOwnerId(tx, "sessions", id);
      if (userId === undefined) return 0;
      await assertNoActiveHoldForUser(tx, userId, `session ${id}`);
      return 0;
    },
  });
}

/**
 * Delete tokens past their usefulness: expired over a month ago, or consumed over a month
 * ago even with a far-future expiry. `used_at` is the honest clock for single-purpose
 * secrets — a consumed reset token with a year left on `expires_at` is still garbage.
 */
export async function pruneExpiredTokens(
  db: NodePgDatabase<Record<string, any>>,
): Promise<PerRowDeleteResult> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM tokens
        WHERE expires_at <= now() - make_interval(days => ${TOKEN_GRACE_DAYS})
           OR used_at <= now() - make_interval(days => ${TOKEN_GRACE_DAYS})
        ORDER BY COALESCE(used_at, expires_at), id`,
  );
  const ids = ((rows as unknown as { rows?: { id: string }[] }).rows ?? []).map((row) => row.id);
  return deleteRowsPerRow(db, "tokens", ids, {
    beforeDelete: async (tx, id) => {
      const userId = await hookOwnerId(tx, "tokens", id);
      if (userId === undefined) return 0;
      await assertNoActiveHoldForUser(tx, userId, `token ${id}`);
      return 0;
    },
  });
}

export interface CensusResult {
  /** Tonight's row count per audit module — the next run's baseline. */
  counts: Record<string, number>;
  /** Modules that shrank since the baseline. Any entry here also wrote the alarm row. */
  decreased: string[];
  /** True on the first run: no baseline exists yet, so nothing could decrease. */
  bootstrapped: boolean;
}

/**
 * The audit census: count rows per module and compare against the previous run's own audited
 * counts. Append-only storage means counts only grow — a decrease is a tail-delete or a
 * TRUNCATE below the trigger, and it gets a `critical` row, not a quiet log line. The
 * baseline lives in the job's prior audit row (`after_state.census.counts`), so a
 * restored/seeded database simply re-bootstraps instead of alarming on history it never saw.
 */
export async function runAuditCensus(
  db: NodePgDatabase<Record<string, any>>,
): Promise<CensusResult> {
  const counted = await db.execute<{ module: string; n: string }>(
    sql`SELECT module, count(*)::text AS n FROM unified_audit_log GROUP BY module`,
  );
  const countRows = (counted as unknown as { rows?: { module: string; n: string }[] }).rows ?? [];
  const counts: Record<string, number> = {};
  for (const row of countRows) counts[row.module] = Number(row.n);

  const prior = await db.execute<{ after_state: unknown }>(
    sql`SELECT after_state FROM unified_audit_log
        WHERE action = 'retention.enforced' ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  const priorRow = (prior as unknown as { rows?: { after_state: unknown }[] }).rows?.[0];
  const baseline = (priorRow?.after_state as { census?: { counts?: unknown } } | null)?.census
    ?.counts;
  if (baseline === undefined || baseline === null || typeof baseline !== "object") {
    return { counts, decreased: [], bootstrapped: true };
  }

  const decreased: string[] = [];
  const detail: { module: string; before: number; after: number }[] = [];
  for (const [module, beforeRaw] of Object.entries(baseline as Record<string, unknown>)) {
    const before = Number(beforeRaw);
    if (!Number.isFinite(before)) continue;
    const after = counts[module] ?? 0;
    if (after < before) {
      decreased.push(module);
      detail.push({ module, before, after });
    }
  }
  if (decreased.length > 0) {
    await writeAuditLog({
      db,
      module: "system",
      actorType: "system",
      action: "retention.census.decrease_detected",
      afterState: { decreased: detail },
    });
  }
  return { counts, decreased, bootstrapped: false };
}

export interface RetentionEnforcementOutcome {
  deleted: number;
  failed: number;
  errors: RowDeleteFailure[];
  held: number;
  tables: {
    data_export_requests: PerRowDeleteResult;
    sessions: PerRowDeleteResult;
    tokens: PerRowDeleteResult;
    backup_records: { expired: number };
  };
  census: CensusResult;
}

/**
 * Work the whole §9.4 slice in one run: the three delete tables, backup file-status expiry,
 * then the census last — it reads the state the night leaves behind (minus the chain
 * verifier's own row, which lands after and only adds). Top-level `deleted`/`failed`/`held`
 * sum the delete tables alone: a backup status flip is not an erasure and must not read as
 * one. No `auditAnonymized` key — the worker scrubs nothing (the org-purge precedent).
 */
export async function enforceRetention(
  db: NodePgDatabase<Record<string, any>>,
): Promise<RetentionEnforcementOutcome> {
  const dataExports = await pruneExpiredDataExports(db);
  const sessions = await pruneExpiredSessions(db);
  const tokens = await pruneExpiredTokens(db);
  const backups = await expireBackupRecords(db);
  const census = await runAuditCensus(db);

  const tables = [dataExports, sessions, tokens];
  return {
    deleted: tables.reduce((sum, table) => sum + table.deleted, 0),
    failed: tables.reduce((sum, table) => sum + table.failed, 0),
    errors: tables.flatMap((table) => table.errors),
    held: tables.reduce((sum, table) => sum + (table.held ?? 0), 0),
    tables: {
      data_export_requests: dataExports,
      sessions,
      tokens,
      backup_records: backups,
    },
    census,
  };
}
