/**
 * `/api/approvals` — the shared approval workflow over HTTP (NWB-P1-003).
 *
 * The routes are thin: the permission gate (`approvals.read|create|decide`) decides whether a
 * caller reaches the endpoint at all, and the service decides whether *this* caller may act on
 * *this* row (requester, current approver, chain member). Everything cross-tenant or invisible
 * is a 404 from the service, never a 403 that leaks the row's existence.
 *
 * Ids are `apr_` + 21 characters, not uuids, so the path parameter is checked with
 * `APPROVAL_ID_PATTERN` rather than `uuidParam`.
 */
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  APPROVAL_ENTITY_TYPES,
  APPROVAL_ID_PATTERN,
  APPROVAL_STATUSES,
  type ApprovalActorContext,
  type ApprovalDecisionInput,
  approvalChainInputSchema,
  approveRequest,
  getApprovalRequest,
  listApprovalRequests,
  recallRequest,
  rejectRequest,
  requestApproval,
  requestChanges,
} from "@/services/approvals";

const router = new Hono();

router.use("/approvals/*", authMiddleware);
router.use("/approvals", authMiddleware);

// ── Schemas ───────────────────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  entityType: z.enum(APPROVAL_ENTITY_TYPES),
  entityId: z.string().trim().min(1).max(64),
  entityVersion: z.number().int().positive(),
  contentSnapshot: z.record(z.string(), z.unknown()),
  chain: approvalChainInputSchema,
  // Absent → the service's 7-day default; explicit null → never expires.
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const decisionSchema = z.object({
  comment: z.string().trim().max(4000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

/** Reject/request-changes carry a mandatory reason (mirrors the DB CHECKs, fails at 422 first). */
const reasonedDecisionSchema = decisionSchema.extend({
  comment: z.string().trim().min(1, "A comment is required").max(4000),
});

const listQuerySchema = z.object({
  view: z.enum(["inbox", "mine", "all"]).default("mine"),
  status: z.enum(APPROVAL_STATUSES).optional(),
  entityType: z.enum(APPROVAL_ENTITY_TYPES).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function validationDetails(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

/** A malformed id can never match a row, so it is the same 404 an unknown one gets. */
function approvalIdParam(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!APPROVAL_ID_PATTERN.test(id)) {
    throw new NotFoundError("Approval request");
  }
  return id;
}

function actorContext(c: Context): ApprovalActorContext {
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  // The normalized request id from the request-context middleware (NWB-P1-012),
  // not the raw header: it is length-checked against the audit column and
  // present on every request, so approvals decisions correlate like everything
  // else. The raw header was a latent 22001 above 100 chars.
  const requestId = c.var.requestId;
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function parseDecision<T extends z.ZodTypeAny>(schema: T, body: unknown, what: string): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(`Invalid ${what} request`, validationDetails(parsed.error));
  }
  return parsed.data;
}

async function decisionInput(
  c: Context,
  schema: typeof decisionSchema | typeof reasonedDecisionSchema,
  what: string,
): Promise<ApprovalDecisionInput> {
  const id = approvalIdParam(c);
  const body = parseDecision(schema, await readJsonBody(c), what);
  return {
    id,
    organizationId: c.var.user.orgId,
    actorId: c.var.user.userId,
    ...(body.comment !== undefined ? { comment: body.comment } : {}),
    ...(body.expectedVersion !== undefined ? { expectedVersion: body.expectedVersion } : {}),
    actor: actorContext(c),
  };
}

// ── POST /api/approvals — submit for approval ─────────────────────────────────────────────────

router.post("/approvals", requireAbility("create", "approvals"), async (c) => {
  const parsed = requestSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid approval request", validationDetails(parsed.error));
  }
  const input = parsed.data;

  const created = await requestApproval(c.var.db, {
    organizationId: c.var.user.orgId,
    requesterId: c.var.user.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    entityVersion: input.entityVersion,
    contentSnapshot: input.contentSnapshot,
    chain: input.chain,
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    actor: actorContext(c),
  });

  return c.json(success({ approval: created }), 201);
});

// ── GET /api/approvals — inbox / mine / all ───────────────────────────────────────────────────

router.get("/approvals", requireAbility("read", "approvals"), async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new ValidationError("Invalid approval query", validationDetails(parsed.error));
  }
  const filters = parsed.data;

  // `all` is the org-wide queue; it is a decider's view, not a reader's.
  if (filters.view === "all" && c.var.ability.cannot("decide", "approvals")) {
    throw new ValidationError("Invalid approval query", [
      { field: "view", message: "the org-wide view requires approvals.decide" },
    ]);
  }

  const page = parsePagination(new URL(c.req.url), { idPattern: APPROVAL_ID_PATTERN });
  const { items, pageInfo } = await listApprovalRequests(
    c.var.db,
    { organizationId: c.var.user.orgId, userId: c.var.user.userId },
    filters,
    page,
  );

  return c.json(success({ approvals: items }, paginationMeta(pageInfo)));
});

// ── GET /api/approvals/:id ────────────────────────────────────────────────────────────────────

router.get("/approvals/:id", requireAbility("read", "approvals"), async (c) => {
  const id = approvalIdParam(c);
  const detail = await getApprovalRequest(c.var.db, c.var.user.orgId, id, {
    userId: c.var.user.userId,
    canDecide: c.var.ability.can("decide", "approvals"),
  });
  // Unknown, other tenant's, or simply not visible to this caller: one answer for all three.
  if (!detail) throw new NotFoundError("Approval request");
  return c.json(success({ approval: detail }));
});

// ── Decisions ─────────────────────────────────────────────────────────────────────────────────

router.post("/approvals/:id/approve", requireAbility("decide", "approvals"), async (c) => {
  const input = await decisionInput(c, decisionSchema, "approve");
  return c.json(success({ approval: await approveRequest(c.var.db, input) }));
});

router.post("/approvals/:id/reject", requireAbility("decide", "approvals"), async (c) => {
  const input = await decisionInput(c, reasonedDecisionSchema, "reject");
  return c.json(success({ approval: await rejectRequest(c.var.db, input) }));
});

router.post("/approvals/:id/request-changes", requireAbility("decide", "approvals"), async (c) => {
  const input = await decisionInput(c, reasonedDecisionSchema, "request-changes");
  return c.json(success({ approval: await requestChanges(c.var.db, input) }));
});

// Recall is the requester's move, so it sits behind `create`, not `decide`.
router.post("/approvals/:id/recall", requireAbility("create", "approvals"), async (c) => {
  const input = await decisionInput(c, decisionSchema, "recall");
  return c.json(success({ approval: await recallRequest(c.var.db, input) }));
});

export { router as approvalsRouter };
