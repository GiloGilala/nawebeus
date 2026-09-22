/**
 * Backup records (NWB-P1-010): track backup runs, never perform them.
 *
 * The lifecycle is record → complete/fail → expire. Recording opens a `pending` row when a
 * backup starts (target location known up front); completion stamps the terminal state; the
 * retention worker flips past-window `completed`/`verified` rows to `expired` — the *file's*
 * status, marking it eligible for infra overwrite. Records themselves are never deleted: the
 * row is the evidence the backup happened. Failed runs never expire — a failure is evidence
 * too, and there is no file to overwrite.
 *
 * Retention is per-record `retentionDays` (default 30, §9.4 bounds 30–90, rejected outside —
 * silently coercing an out-of-policy window would lie about intent). The model's per-type
 * windows (90/30/60) stay dormant: the policy table governs, not the unmigrated comment.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { NotFoundError, ValidationError } from "../../lib/errors";
// Direct `./write` import, not the `../audit` barrel — same cycle the holds service avoids.
import { writeAuditLog } from "../audit/write";

/** The `backup_type` vocabulary. */
export type BackupType =
  | "full_database"
  | "incremental_wal"
  | "file_storage"
  | "configuration"
  | "metadata";

/** §9.4: backup files live 30 days by default, 30–90 when the operator says otherwise. */
export const BACKUP_RETENTION_DAYS_DEFAULT = 30;
export const BACKUP_RETENTION_DAYS_MIN = 30;
export const BACKUP_RETENTION_DAYS_MAX = 90;

export interface RecordBackupInput {
  backupType: BackupType;
  /** Where the artifact will land. Required — a backup to nowhere is not a backup. */
  location: string;
  retentionDays?: number | undefined;
  /** NULL = system-wide backup. */
  organizationId?: string | undefined;
  backupName?: string | undefined;
  triggeredBy?: string | undefined;
}

function backupId(): string {
  return `br_${crypto.randomUUID().slice(0, 21)}`;
}

/**
 * Open a `pending` record for a backup run. `expires_at` is set at creation from the
 * retention window — the worker only reads it, never computes policy.
 */
export async function recordBackup(
  db: NodePgDatabase<Record<string, any>>,
  input: RecordBackupInput,
): Promise<{ id: string; expiresAt: string }> {
  const location = input.location.trim();
  if (location.length === 0) {
    throw new ValidationError("A backup record requires a location.", [
      { field: "location", message: "location must not be empty" },
    ]);
  }
  const retentionDays = input.retentionDays ?? BACKUP_RETENTION_DAYS_DEFAULT;
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < BACKUP_RETENTION_DAYS_MIN ||
    retentionDays > BACKUP_RETENTION_DAYS_MAX
  ) {
    throw new ValidationError(
      `retentionDays must be ${BACKUP_RETENTION_DAYS_MIN}–${BACKUP_RETENTION_DAYS_MAX} (§9.4).`,
      [{ field: "retentionDays", message: "outside the §9.4 window" }],
    );
  }
  const id = backupId();
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await db.execute(
    sql`INSERT INTO backup_records
          (id, organization_id, backup_type, backup_name, status, location, expires_at, triggered_by)
        VALUES
          (${id}, ${input.organizationId ?? null}, ${input.backupType},
           ${input.backupName ?? null}, 'pending', ${location}, ${expiresAt}, ${input.triggeredBy ?? null})`,
  );
  await writeAuditLog({
    db,
    module: "core",
    actorId: input.triggeredBy ?? undefined,
    actorType: "user",
    action: "backups.recorded",
    category: "compliance",
    resourceType: "backup",
    resourceId: id,
    afterState: { backupType: input.backupType, location, expiresAt },
  });
  return { id, expiresAt };
}

export interface CompleteBackupInput {
  id: string;
  status: "completed" | "failed";
  sizeBytes?: number | undefined;
  checksum?: string | undefined;
  /** Required on failure — by the service and by `chk_br_error_required_on_failure`. */
  errorMessage?: string | undefined;
  durationSeconds?: number | undefined;
}

/**
 * Close a run. Terminal states are final — completing twice is a conflict, not an update
 * (the run happened once; its record says so). `running`/`verified` belong to the progress
 * and verification workers, which don't exist yet; this API covers record → done.
 */
export async function completeBackup(
  db: NodePgDatabase<Record<string, any>>,
  input: CompleteBackupInput,
): Promise<{ id: string; status: string }> {
  const current = await db.execute<{ status: string }>(
    sql`SELECT status FROM backup_records WHERE id = ${input.id} LIMIT 1`,
  );
  const row = (current as unknown as { rows?: { status: string }[] }).rows?.[0];
  if (!row) {
    throw new NotFoundError("No such backup record.");
  }
  if (row.status !== "pending" && row.status !== "running") {
    throw new ValidationError(`Backup ${input.id} is already ${row.status}.`, [
      { field: "status", message: "terminal states are final" },
    ]);
  }
  if (input.status === "failed" && (input.errorMessage ?? "").trim().length === 0) {
    throw new ValidationError("A failed backup requires an error message.", [
      { field: "errorMessage", message: "errorMessage must not be empty on failure" },
    ]);
  }
  await db.execute(
    sql`UPDATE backup_records
        SET status = ${input.status}, completed_at = now(),
            size_bytes = ${input.sizeBytes ?? null},
            checksum = ${input.checksum ?? null},
            error_message = ${input.errorMessage ?? null},
            duration_seconds = ${input.durationSeconds ?? null}
        WHERE id = ${input.id}`,
  );
  return { id: input.id, status: input.status };
}

/**
 * Flip past-window runs to `expired`. Bulk by design, not per row: nothing references
 * `backup_records`, so no row can refuse, and a status flip needs no hook. Returns the count
 * for the job's outcome — the expiry's evidence is the job row, not one audit row per flip.
 */
export async function expireBackupRecords(
  db: NodePgDatabase<Record<string, any>>,
): Promise<{ expired: number }> {
  const result = await db.execute<{ id: string }>(
    sql`UPDATE backup_records SET status = 'expired'
        WHERE status IN ('completed', 'verified') AND expires_at <= now()
        RETURNING id`,
  );
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
  return { expired: rows.length };
}
