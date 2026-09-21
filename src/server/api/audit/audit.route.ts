/**
 * `GET /api/audit` — the read surface for `unified_audit_log` (NWB-P1-002, F-19).
 *
 * Two things this file is responsible for, and neither can move into the service:
 *
 * **Which organization is readable.** `organizationId` comes from the JWT and nothing else, per the
 * plan's rule that tenant scope is never request input. `super_admin` may *name* one organization with
 * `?organizationId=` — bounded on purpose: there is no route that reads the whole table, so the
 * platform escape hatch is "another single tenant", not "every tenant". That also means the escape hatch
 * cannot be used to enumerate: it answers questions about an org you already have to name.
 *
 * **Whether org-less rows are visible.** Nightly purge and reclamation events carry `organization_id
 * IS NULL` because one run sweeps every tenant (`src/lib/worker.ts`), and they are precisely what an
 * NDPR enquiry asks for. They are nobody's tenant data, so reaching them takes the platform role, not
 * a query parameter — `includeOrgless` is derived here and passed into the service's *scope*, which is
 * where a capability belongs and never where a filter belongs.
 *
 * The audit id is `varchar(64)` with an `al_` prefix, **not** a uuid, so this route deliberately does
 * not use `uuidParam`: there is no `::uuid` cast anywhere in the query, and the malformed-input class
 * that helper exists to stop (22P02 surfacing as a 500, NWB-P0-029) cannot occur here. The length and
 * charset guard below is what the column actually requires — an unbounded string would still be a
 * pointless index scan.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  AUDIT_ACTOR_TYPE_VALUES,
  AUDIT_CATEGORY_VALUES,
  AUDIT_MODULE_VALUES,
  AUDIT_SEVERITY_VALUES,
  type AuditEventFilters,
  type AuditReadScope,
  getAuditEvent,
  listAuditEvents,
} from "@/services/audit";
import { findMemberRole, PLATFORM_ROLE_CODES, type RoleCode } from "@/services/orgs/role-policy";

const router = new Hono();

router.use("/audit/*", authMiddleware);

/**
 * `al_` + 21 chars today; the column is `varchar(64)` and prefix-formatted, so accept that shape and
 * nothing wider. The same pattern governs cursor tiebreakers (see `parsePagination` below), which is
 * why it lives here once rather than twice.
 */
const AUDIT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const auditIdSchema = z.string().regex(AUDIT_ID_PATTERN, "Must be an audit event id");

const listQuerySchema = z.object({
  actorId: z.string().uuid("Must be a user id").optional(),
  targetUserId: z.string().uuid("Must be a user id").optional(),
  action: z.string().min(1).max(100).optional(),
  // Values straight from the schema's enums, so a filter cannot drift from what the column accepts and
  // an invalid one reports the whole legal set rather than a bare "Invalid input".
  module: z.enum(AUDIT_MODULE_VALUES).optional(),
  severity: z.enum(AUDIT_SEVERITY_VALUES).optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPE_VALUES).optional(),
  category: z.enum(AUDIT_CATEGORY_VALUES).optional(),
  resourceType: z.string().min(1).max(50).optional(),
  resourceId: z.string().min(1).max(64).optional(),
  requestId: z.string().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  organizationId: z.string().uuid("Must be an organization id").optional(),
});

function validationDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}

/** `Db` is the injected handle, not a fresh connection — the read joins the request's pool. */
type Db = NodePgDatabase<Record<string, any>>;

/**
 * Resolve what this caller may read, from the token and the role — never from the query alone.
 *
 * `?organizationId=` is checked against the actor's *own* organization's role, so a super_admin whose
 * JWT names org A can look at org B, while an org-A admin asking for org B gets 403 rather than a
 * silently-ignored parameter. Ignoring it would be worse than refusing: the caller would read their own
 * log believing they were reading someone else's.
 */

async function resolveScope(
  db: Db,
  c: Context,
  requestedOrgId: string | undefined,
): Promise<AuditReadScope> {
  const { userId, orgId } = c.var.user;
  if (!requestedOrgId || requestedOrgId === orgId) {
    return { organizationId: orgId, includeOrgless: await isPlatformAdmin(db, userId, orgId) };
  }
  if (!(await isPlatformAdmin(db, userId, orgId))) {
    // 403 and not 404: this is not a resource lookup, and "that organization does not exist" would be
    // a leak about the platform's tenant list from an endpoint whose whole job is reading metadata.
    throw new ForbiddenError(
      "Only a platform administrator may read another organization's audit log",
    );
  }
  return { organizationId: requestedOrgId, includeOrgless: true };
}

async function isPlatformAdmin(db: Db, userId: string, orgId: string): Promise<boolean> {
  const actor = await findMemberRole(db, orgId, { userId });
  return (
    !!actor?.code && (PLATFORM_ROLE_CODES as readonly RoleCode[]).includes(actor.code as RoleCode)
  );
}

// GET /api/audit — one page of the log, newest first.
router.get("/audit", requireAbility("read", "audit"), async (c) => {
  const db = c.var.db;
  const parsed = listQuerySchema.safeParse({
    actorId: c.req.query("actorId") ?? undefined,
    targetUserId: c.req.query("targetUserId") ?? undefined,
    action: c.req.query("action") ?? undefined,
    module: c.req.query("module") ?? undefined,
    severity: c.req.query("severity") ?? undefined,
    actorType: c.req.query("actorType") ?? undefined,
    category: c.req.query("category") ?? undefined,
    resourceType: c.req.query("resourceType") ?? undefined,
    resourceId: c.req.query("resourceId") ?? undefined,
    requestId: c.req.query("requestId") ?? undefined,
    from: c.req.query("from") ?? undefined,
    to: c.req.query("to") ?? undefined,
    organizationId: c.req.query("organizationId") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError("Invalid audit query", validationDetails(parsed.error));
  }

  const scope = await resolveScope(db, c, parsed.data.organizationId);
  // `idPattern` is not decoration: `decodeCursor` requires a uuid by default, and audit ids are
  // prefixed varchar, so without this the *second page* of every audit list would 422 — a bug that is
  // invisible in a test that only ever reads page one.
  const page = parsePagination(new URL(c.req.url), { idPattern: AUDIT_ID_PATTERN });
  const filters: AuditEventFilters = {
    ...(parsed.data.actorId ? { actorId: parsed.data.actorId } : {}),
    ...(parsed.data.targetUserId ? { targetUserId: parsed.data.targetUserId } : {}),
    ...(parsed.data.action ? { action: parsed.data.action } : {}),
    ...(parsed.data.module ? { module: parsed.data.module } : {}),
    ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
    ...(parsed.data.actorType ? { actorType: parsed.data.actorType } : {}),
    ...(parsed.data.category ? { category: parsed.data.category } : {}),
    ...(parsed.data.resourceType ? { resourceType: parsed.data.resourceType } : {}),
    ...(parsed.data.resourceId ? { resourceId: parsed.data.resourceId } : {}),
    ...(parsed.data.requestId ? { requestId: parsed.data.requestId } : {}),
    ...(parsed.data.from ? { from: parsed.data.from } : {}),
    ...(parsed.data.to ? { to: parsed.data.to } : {}),
  };

  const { items: events, pageInfo } = await listAuditEvents(db, scope, filters, page);
  return c.json(success({ events }, paginationMeta(pageInfo)));
});

// GET /api/audit/:id — one event, with the state snapshots the list omits.
router.get("/audit/:id", requireAbility("read", "audit"), async (c) => {
  const db = c.var.db;
  const parsed = auditIdSchema.safeParse(c.req.param("id"));
  if (!parsed.success) {
    throw new ValidationError("Invalid audit event id", validationDetails(parsed.error));
  }
  const scope = await resolveScope(db, c, c.req.query("organizationId") ?? undefined);
  const event = await getAuditEvent(db, scope, parsed.data);
  if (!event) {
    // NotFoundError, not ForbiddenError — see `getAuditEvent`: distinguishing the two would confirm
    // that the id exists, which is information this endpoint has no business handing out.
    throw new NotFoundError("Audit event not found");
  }
  return c.json(success({ event }));
});

export { router as auditRouter };
