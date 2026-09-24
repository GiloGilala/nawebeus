/**
 * The only way to write an audit event (NWB-P1-002).
 *
 * Two properties are load-bearing and both are easy to lose in a refactor:
 *
 * **It does not commit.** The insert joins the caller's transaction, which is why the first parameter
 * is the `db` handle rather than a client of its own. An audit row that lands while the mutation it
 * describes is rolled back is worse than no row — it is evidence of something that did not happen.
 * (The queue runtime deliberately does *not* wrap a job in a transaction, so its events survive a
 * rolled-back handler; see `src/lib/worker.ts`.)
 *
 * **Its `id` is generated, not derived.** `al_` + 21 chars of a v4 uuid fits the column's
 * `varchar(64)` and keeps the prefix humans grep for. The ids this table references (`actor_id`,
 * `resource_id`, `target_user_id`) are deliberately **not** foreign keys: a purge must not delete
 * history, so the row outlives the thing it describes.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { currentRequestId } from "../../lib/request-context";
import { type DbOrTx, withAtomicWrites } from "../../lib/transaction";
import { type AuditActionName, auditActionSpec } from "./actions";
import { isChainedModule, sealChainLink } from "./chain";
import type { AuditActorType, AuditCategory, AuditModule, AuditSeverity } from "./types";

interface AuditEventFields {
  db: NodePgDatabase<Record<string, any>>;
  /**
   * Which part of the application wrote the row. `core` covers authentication, users, organizations
   * and the queue runtime; `security` for credential-shaped changes. `admin`, `system` and
   * `compliance` are sealed into their per-module hash chain on write — see
   * `CHECKSUM_ONLY_MODULES` in `./types` and `./chain`.
   */
  module: AuditModule;
  /**
   * The tenant this event belongs to. **NULL means "not tenant-scoped"**, and only two things may say
   * that: a cross-tenant system operation (a nightly purge sweeps every organization) and a
   * pre-tenant event (signup creating the first membership). It is never a fallback for "we forgot".
   */
  organizationId?: string | undefined;
  actorIp?: string | undefined;
  actorUserAgent?: string | undefined;
  /** Registered in `./actions`. An unregistered name is a type error, not a new spelling. */
  action: AuditActionName;
  /** Defaults to the registry's category for `action`; pass it only to *correct* an odd fit. */
  category?: AuditCategory | undefined;
  /** Defaults to the registry's resource type for `action`. */
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  targetUserId?: string | undefined;
  beforeState?: Record<string, unknown> | undefined;
  afterState?: Record<string, unknown> | undefined;
  changes?: Record<string, unknown> | undefined;
  /** Defaults to the registry's severity, else `info`. */
  severity?: AuditSeverity | undefined;
  reason?: string | undefined;
  /**
   * Correlation id for `GET /api/audit?requestId=`. When absent, defaults to the current request's
   * id (NWB-P1-012) — the one that produced this write — so every row written while handling a
   * request is findable from its access-log line, without each call site threading the id through.
   * An explicit value wins (DSAR cites its own domain id, not the HTTP one); outside a request
   * scope (worker, CLI) the column stays NULL, as it always was.
   */
  requestId?: string | undefined;
  sessionId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * `actor_id` without `actor_type` is rejected by `chk_ual_actor_consistency` at the database, which
 * surfaces as a `23514` inside whatever mutation was being audited — a 500 whose message names neither
 * the audit table nor the missing field. Expressing the pairing in the type moves that failure to the
 * call site, which is the whole argument for a union here instead of two optional fields.
 *
 * The asymmetry is intentional: a *typed* actor with no id is meaningless too, but it is already
 * impossible because `actorType` has no meaning without an `actorId`… except for a system event, which
 * is exactly the branch below that permits an `actorType` alone (`src/lib/worker.ts` records
 * `actorType: "system"` with no id, and the DB allows it: the constraint only fires when `actor_id` is
 * non-NULL).
 */
export type WriteAuditLogEntryParams = AuditEventFields &
  (
    | { actorId: string; actorType: AuditActorType }
    | { actorId?: undefined; actorType?: AuditActorType | undefined }
  );

/** Columns the registry supplies, resolved against `action`. */
export interface ResolvedAuditFields {
  readonly category: AuditCategory;
  readonly resourceType: string | null;
  readonly severity: AuditSeverity;
}

/**
 * Fold the registry's defaults into a caller's parameters.
 *
 * Exported because `src/lib/worker.ts` builds its audit payload field-by-field and must resolve it the
 * same way: an event whose category came from a job definition and whose severity came from the
 * registry would otherwise be able to disagree with the same event written by hand.
 */
export function resolveAuditDefaults(params: {
  action: AuditActionName;
  category?: AuditCategory | undefined;
  resourceType?: string | undefined;
  severity?: AuditSeverity | undefined;
}): ResolvedAuditFields {
  const spec = auditActionSpec(params.action);
  return {
    category: params.category ?? spec.category,
    resourceType: params.resourceType ?? spec.resourceType,
    severity: params.severity ?? spec.severity ?? "info",
  };
}

/**
 * Insert one audit row. Resolves to `void` — an audit write has nothing to report back, and returning
 * the id invited callers to correlate on it instead of on `requestId`, which is what
 * `idx_ual_request_id` exists for.
 */
export async function writeAuditLog(params: WriteAuditLogEntryParams): Promise<void> {
  const {
    db,
    module,
    organizationId,
    actorId,
    actorType,
    actorIp,
    actorUserAgent,
    action,
    resourceId,
    targetUserId,
    beforeState,
    afterState,
    changes,
    reason,
    requestId,
    sessionId,
    metadata,
  } = params;

  const { category, resourceType, severity } = resolveAuditDefaults(params);
  const id = `al_${crypto.randomUUID().slice(0, 21)}`;
  // Set explicitly rather than defaulted: on a chained module the hash input and the stored
  // instant must derive from one `Date`, never be formatted twice. Millisecond precision fits
  // PostgreSQL's microsecond storage exactly, so the verifier reads back the same instant.
  const createdAt = new Date();

  const row = {
    id,
    module,
    organizationId: organizationId ?? null,
    actorId: actorId ?? null,
    actorType: actorType ?? null,
    actorIp: actorIp ?? null,
    actorUserAgent: actorUserAgent ?? null,
    action,
    category,
    resourceType,
    resourceId: resourceId ?? null,
    targetUserId: targetUserId ?? null,
    beforeState: JSON.stringify(beforeState ?? null),
    afterState: JSON.stringify(afterState ?? null),
    changes: JSON.stringify(changes ?? null),
    severity,
    reason: reason ?? null,
    requestId: requestId ?? currentRequestId() ?? null,
    sessionId: sessionId ?? null,
    metadata: JSON.stringify(metadata ?? null),
    createdAt,
  };

  if (!isChainedModule(module)) {
    // The lightweight path, unchanged: one INSERT, no lock, no extra round trips.
    await insertAuditRow(db, { ...row, checksum: null, previousChecksum: null });
    return;
  }

  // The seal — lock, predecessor read, INSERT — joins the caller's transaction when there is one
  // and scopes its own when there isn't (the queue runtime's autocommit writes). Either way the
  // advisory lock is held across the read and the INSERT, which is what keeps two writers to one
  // module from forking the chain. "Does not commit" still holds: `withAtomicWrites` only commits
  // a transaction it opened itself.
  await withAtomicWrites(db, async (tx) => {
    const sealed = await sealChainLink(tx, module, {
      id,
      action,
      actorId: actorId ?? null,
      resourceId: resourceId ?? null,
      createdAt,
    });
    await insertAuditRow(tx, {
      ...row,
      // The seal's instant, not the caller's: monotonic per module (see `./chain`).
      createdAt: sealed.createdAt,
      checksum: sealed.checksum,
      previousChecksum: sealed.previousChecksum,
    });
  });
}

interface InsertableAuditRow {
  readonly id: string;
  readonly module: AuditModule;
  readonly organizationId: string | null;
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly actorIp: string | null;
  readonly actorUserAgent: string | null;
  readonly action: string;
  readonly category: string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly targetUserId: string | null;
  readonly beforeState: string;
  readonly afterState: string;
  readonly changes: string;
  readonly severity: string;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly sessionId: string | null;
  readonly metadata: string;
  readonly createdAt: Date;
  readonly checksum: string | null;
  readonly previousChecksum: string | null;
}

async function insertAuditRow(tx: DbOrTx, row: InsertableAuditRow): Promise<void> {
  await tx.execute(
    sql`
      INSERT INTO unified_audit_log (
        id, module, organization_id, actor_id, actor_type, actor_ip,
        actor_user_agent, action, category, resource_type, resource_id,
        target_user_id, before_state, after_state, changes, severity,
        reason, request_id, session_id, metadata, created_at,
        checksum, previous_checksum
      ) VALUES (
        ${row.id}, ${row.module}, ${row.organizationId}, ${row.actorId},
        ${row.actorType}, ${row.actorIp}, ${row.actorUserAgent},
        ${row.action}, ${row.category}, ${row.resourceType}, ${row.resourceId},
        ${row.targetUserId}, ${row.beforeState},
        ${row.afterState}, ${row.changes},
        ${row.severity}, ${row.reason}, ${row.requestId},
        ${row.sessionId}, ${row.metadata}, ${row.createdAt.toISOString()},
        ${row.checksum}, ${row.previousChecksum}
      )
    `,
  );
}
