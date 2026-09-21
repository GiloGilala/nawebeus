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
import { type AuditActionName, auditActionSpec } from "./actions";
import type { AuditActorType, AuditCategory, AuditSeverity, WritableAuditModule } from "./types";

interface AuditEventFields {
  db: NodePgDatabase<Record<string, any>>;
  /**
   * Which part of the application wrote the row. `core` covers authentication, users, organizations
   * and the queue runtime; `security` for credential-shaped changes. `admin`, `system` and
   * `compliance` are not accepted here — see `CHECKSUM_ONLY_MODULES` in `./types` for why.
   */
  module: WritableAuditModule;
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

  await db.execute(
    sql`
      INSERT INTO unified_audit_log (
        id, module, organization_id, actor_id, actor_type, actor_ip,
        actor_user_agent, action, category, resource_type, resource_id,
        target_user_id, before_state, after_state, changes, severity,
        reason, request_id, session_id, metadata
      ) VALUES (
        ${id}, ${module}, ${organizationId ?? null}, ${actorId ?? null},
        ${actorType ?? null}, ${actorIp ?? null}, ${actorUserAgent ?? null},
        ${action}, ${category}, ${resourceType}, ${resourceId ?? null},
        ${targetUserId ?? null}, ${JSON.stringify(beforeState ?? null)},
        ${JSON.stringify(afterState ?? null)}, ${JSON.stringify(changes ?? null)},
        ${severity}, ${reason ?? null}, ${requestId ?? null},
        ${sessionId ?? null}, ${JSON.stringify(metadata ?? null)}
      )
    `,
  );
}
