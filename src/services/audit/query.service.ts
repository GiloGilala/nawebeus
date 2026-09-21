/**
 * Audit reads (NWB-P1-002, closes F-19's read half).
 *
 * `writeAuditLog` was the module's only export: the log could be produced but not consulted, which
 * made every compliance promise attached to it theoretical. PRD §8.10.2 asks for search by
 * user/action/resource/date range in under 5s at 1M rows, and there was nothing to search with.
 *
 * Three rules this file exists to keep:
 *
 * **The tenant predicate is not optional.** `scope.organizationId` is required with no "all" value,
 * so a caller cannot read the whole table by forgetting a filter — the omission that turns a
 * compliance tool into a cross-tenant leak. Who may read *which* organization is decided one layer up
 * (`src/server/api/audit/audit.route.ts`) from the JWT; `includeOrgless` there is a *capability*
 * result, never a query parameter. `docs/modules/Authentication & User Management.md:1415` settled
 * that the audit table has **no RLS** — "global; admins can query their org's log" — so this service
 * *is* the enforcement point, and the org indexes (`idx_ual_org_created`, `idx_ual_org_module_created`)
 * exist to make that cheap.
 *
 * **`before_state`/`after_state`/`changes` stay out of list rows.** They are the fat in the table (full
 * entity snapshots), and the access pattern is triage — a page of 100 is a several-hundred-kilobyte
 * response nobody reads. The detail endpoint returns them. `actor_ip`/`actor_user_agent` are omitted
 * for the opposite reason: bulk personal data that matters only once you are looking at one event.
 * (NWB-P1-015 is about why those two columns also have to be scrubbed at purge time.)
 *
 * **`checksum`/`previous_checksum` are never returned.** They exist for `hash_chain_valid`, which an
 * operator reads; the hashes are for the verifier, and no API response should hand out the material to
 * replay or construct a chain.
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Page, PaginationParams } from "../../lib/pagination";
import { buildPage, DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import type { AuditActionName } from "./actions";
import type { AuditActorType, AuditModule, AuditSeverity } from "./types";

type Db = NodePgDatabase<Record<string, any>>;

/**
 * What this read is allowed to see.
 *
 * `includeOrgless` admits rows whose `organization_id IS NULL` — the cross-tenant system events,
 * including the nightly purge and reclamation runs (see `src/lib/worker.ts`: an event with an
 * organization on it would be a lie, one run sweeps every tenant). An NDPR enquiry is *about* those
 * rows, so they must be reachable; but they are nobody's tenant data, so reaching them takes a
 * platform capability rather than a filter.
 */
export interface AuditReadScope {
  readonly organizationId: string;
  readonly includeOrgless?: boolean;
}

/** What a caller may narrow a search to. Every field is `undefined` = "not filtered". */
export interface AuditEventFilters {
  readonly actorId?: string | undefined;
  readonly targetUserId?: string | undefined;
  /**
   * Exact match. Typed as the registry's names for the normal case, but widened to `string` because a
   * search is how you find a spelling that is no longer written — filtering on a retired action is a
   * legitimate compliance query, and refusing it here would make the log unable to describe itself.
   */
  readonly action?: AuditActionName | string | undefined;
  readonly module?: AuditModule | undefined;
  readonly severity?: AuditSeverity | undefined;
  /**
   * Who, categorically, did it. Filterable as well as returnable: "every event an API key wrote" and
   * "every event an impersonated session wrote" are the two queries that turn this column into an
   * investigation, and both are single-value equality so the org index carries them.
   */
  readonly actorType?: AuditActorType | undefined;
  readonly category?: string | undefined;
  readonly resourceType?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly requestId?: string | undefined;
  /**
   * Chain state. `false` is the compliance query — "show me rows the nightly verification
   * flagged" — which is why `whereClause` gates this on `!== undefined` rather than truthiness:
   * the interesting value is falsy.
   */
  readonly chainValid?: boolean | undefined;
  /** Inclusive lower bound, `created_at >= from`. */
  readonly from?: Date | undefined;
  /** Inclusive upper bound, `created_at <= to`. */
  readonly to?: Date | undefined;
}

/**
 * One row of the triage list.
 *
 * `createdAt` is the full-precision `to_char(… 'YYYY-MM-DD"T"HH24:MI:SS.USOF')` text — microsecond
 * `US`, offset `OF` — and deliberately *not* `Date.toISOString()`. A JS Date truncates to
 * milliseconds, and this column doubles as the keyset cursor value; truncating the cursor is how rows
 * between the truncated and the real instant get silently skipped, the exact failure class F-14 was
 * filed for. `organization_members` bulk inserts collide at the microsecond level routinely; so do
 * audit rows written in one transaction.
 */
export interface AuditEventSummary {
  readonly id: string;
  readonly module: string;
  readonly organizationId: string | null;
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly action: string;
  readonly category: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly targetUserId: string | null;
  readonly severity: string;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly sessionId: string | null;
  /** False only when the verification job found this row's chain broken (NWB-P1-014). */
  readonly hashChainValid: boolean;
  readonly createdAt: string;
}

/** One event plus the payload and the actor context. @see {@link AuditEventSummary} for the list shape. */
export interface AuditEventDetail extends AuditEventSummary {
  readonly actorIp: string | null;
  readonly actorUserAgent: string | null;
  readonly beforeState: Record<string, unknown> | null;
  readonly afterState: Record<string, unknown> | null;
  readonly changes: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
}

interface AuditRow {
  id: string;
  module: string;
  organization_id: string | null;
  actor_id: string | null;
  actor_type: string | null;
  action: string;
  category: string | null;
  resource_type: string | null;
  resource_id: string | null;
  target_user_id: string | null;
  severity: string;
  reason: string | null;
  request_id: string | null;
  session_id: string | null;
  hash_chain_valid: boolean;
  created_at: string;
  actor_ip?: string | null;
  actor_user_agent?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  changes?: unknown;
  metadata?: unknown;
}

/** `created_at` is aliased to its full-precision text form; see {@link AuditEventSummary}. */
const LIST_COLUMNS = sql`
  id, module, organization_id, actor_id, actor_type, action, category,
  resource_type, resource_id, target_user_id, severity, reason, request_id,
  session_id, hash_chain_valid,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS created_at
`;

const DETAIL_COLUMNS = sql`
  ${LIST_COLUMNS},
  actor_ip, actor_user_agent, before_state, after_state, changes, metadata
`;

function scopePredicate(scope: AuditReadScope) {
  return scope.includeOrgless
    ? sql`(organization_id = ${scope.organizationId} OR organization_id IS NULL)`
    : sql`organization_id = ${scope.organizationId}`;
}

function jsonbOrNull(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  // node-postgres hands `jsonb` back already parsed; a raw string only reaches here from a driver
  // configured without the jsonb parser, and guessing at that silently would corrupt evidence.
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function toSummary(row: AuditRow): AuditEventSummary {
  return {
    id: row.id,
    module: row.module,
    organizationId: row.organization_id,
    actorId: row.actor_id,
    actorType: row.actor_type,
    action: row.action,
    category: row.category,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    targetUserId: row.target_user_id,
    severity: row.severity,
    reason: row.reason,
    requestId: row.request_id,
    sessionId: row.session_id,
    hashChainValid: row.hash_chain_valid,
    createdAt: row.created_at,
  };
}

/**
 * `WHERE` fragments for one search.
 *
 * `resourceId` without `resourceType` is accepted deliberately: investigating one user id wants every
 * event about it, whichever resource the writer called it. With both present the
 * `(resource_type, resource_id, created_at)` index applies; with one, the org index carries it.
 */
function whereClause(scope: AuditReadScope, filters: AuditEventFilters) {
  const parts = [scopePredicate(scope)];
  if (filters.actorId) parts.push(eq(sql`actor_id`, filters.actorId));
  if (filters.targetUserId) parts.push(eq(sql`target_user_id`, filters.targetUserId));
  if (filters.action) parts.push(eq(sql`action`, filters.action));
  if (filters.module) parts.push(eq(sql`module`, filters.module));
  if (filters.actorType) parts.push(eq(sql`actor_type`, filters.actorType));
  if (filters.severity) parts.push(eq(sql`severity`, filters.severity));
  if (filters.category) parts.push(eq(sql`category`, filters.category));
  if (filters.resourceType) parts.push(eq(sql`resource_type`, filters.resourceType));
  if (filters.resourceId) parts.push(eq(sql`resource_id`, filters.resourceId));
  if (filters.requestId) parts.push(eq(sql`request_id`, filters.requestId));
  // `!== undefined`, not truthiness: `false` ("show me the flagged rows") is the whole point.
  if (filters.chainValid !== undefined) parts.push(eq(sql`hash_chain_valid`, filters.chainValid));
  if (filters.from) parts.push(gte(sql`created_at`, filters.from));
  if (filters.to) parts.push(lte(sql`created_at`, filters.to));
  return and(...parts);
}

/**
 * One page of audit events, newest first.
 *
 * Keyset-cursored on `(created_at, id)`: `src/lib/pagination.ts` documents why the tiebreaker is not
 * decoration, and here it is unavoidable — an invitation batch writes several audit rows in one
 * transaction with identical microsecond timestamps. `id` is `varchar(64)` with an `al_` prefix on
 * this table, not a uuid, so the comparison casts to `text` (a `::uuid` here would 22P03 on every
 * second page, which is the trap `uuidParam` exists for on the other side of the router).
 */
export async function listAuditEvents(
  db: Db,
  scope: AuditReadScope,
  filters: AuditEventFilters = {},
  page?: PaginationParams,
): Promise<Page<AuditEventSummary>> {
  const limit = page?.limit ?? DEFAULT_PAGE_SIZE;
  const cursor = page?.cursor ?? null;
  // Descending list, so the cursor selects rows *before* the boundary.
  const after = cursor
    ? sql`AND (created_at, id) < (${cursor.v}::timestamptz, ${cursor.id})`
    : sql``;

  const result = await db.execute(
    sql`
      SELECT ${LIST_COLUMNS}
      FROM unified_audit_log
      WHERE ${whereClause(scope, filters)}
        ${after}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `,
  );
  const rows = ((result as unknown as { rows?: AuditRow[] }).rows ?? []).map(toSummary);
  // `createdAt` is the ORDER BY value verbatim, so no shadow `_cursorV` field is needed — and none
  // leaks into the response either, which the four older list endpoints all do (recorded as F-30).
  return buildPage(rows, limit, (r) => r.createdAt);
}

/**
 * One event by id, or `null` when it does not exist **or is outside the caller's scope** — the route
 * turns both into 404, which is the right answer either way: a 403 on someone else's audit id confirms
 * the id exists, and audit ids are exactly what a leaked list hands out.
 */
export async function getAuditEvent(
  db: Db,
  scope: AuditReadScope,
  id: string,
): Promise<AuditEventDetail | null> {
  const result = await db.execute(
    sql`
      SELECT ${DETAIL_COLUMNS}
      FROM unified_audit_log
      WHERE id = ${id}
        AND ${scopePredicate(scope)}
      LIMIT 1
    `,
  );
  const row = (result as unknown as { rows?: AuditRow[] }).rows?.[0];
  if (!row) return null;
  return {
    ...toSummary(row),
    actorIp: row.actor_ip ?? null,
    actorUserAgent: row.actor_user_agent ?? null,
    beforeState: jsonbOrNull(row.before_state),
    afterState: jsonbOrNull(row.after_state),
    changes: jsonbOrNull(row.changes),
    metadata: jsonbOrNull(row.metadata),
  };
}
