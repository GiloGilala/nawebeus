import type { Context } from "hono";
import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  ALERT_EVENT_ID_PATTERN,
  ALERT_RULE_ID_PATTERN,
  acknowledgeAlertSchema,
  createAlertRuleSchema,
  escalateAlertSchema,
  fireAlertSchema,
  listAlertEventsQuerySchema,
  listAlertRulesQuerySchema,
  updateAlertRuleSchema,
} from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  acknowledgeAlert,
  createAlertRule,
  deleteAlertRule,
  escalateAlert,
  fireAlert,
  getAlertEventById,
  getAlertRuleById,
  getUnreadAlertCount,
  listAlertEvents,
  listAlertRules,
  markAlertAsRead,
  markAllAlertsAsRead,
  updateAlertRule,
} from "@/services/alerts";

const router = new Hono();

router.use("/alerts/*", authMiddleware);
router.use("/alerts", authMiddleware);

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function validationDetails(error: import("zod").ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

function ruleIdParam(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!ALERT_RULE_ID_PATTERN.test(id)) {
    throw new NotFoundError("Alert rule not found");
  }
  return id;
}

function eventIdParam(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!ALERT_EVENT_ID_PATTERN.test(id)) {
    throw new NotFoundError("Alert event not found");
  }
  return id;
}

function actorContext(c: Context): { ip?: string | undefined; userAgent?: string | undefined } {
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

// ── ALERT RULES ROUTES ───────────────────────────────────────────────────────

router.post("/alerts/rules", requireAbility("create", "alerts"), async (c) => {
  const parsed = createAlertRuleSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid alert rule input", validationDetails(parsed.error));
  }

  const created = await createAlertRule(
    c.var.db,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    actorContext(c),
  );

  return c.json(success({ rule: created }), 201);
});

router.get("/alerts/rules", requireAbility("read", "alerts"), async (c) => {
  const url = new URL(c.req.url);
  const pagination = parsePagination(url, { idPattern: ALERT_RULE_ID_PATTERN });

  const queryParams = c.req.query();
  const parsedQuery = listAlertRulesQuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ValidationError("Invalid query parameters", validationDetails(parsedQuery.error));
  }

  const page = await listAlertRules(c.var.db, {
    orgId: c.var.user.orgId,
    sourceModule: parsedQuery.data.sourceModule,
    conditionType: parsedQuery.data.conditionType,
    isActive: parsedQuery.data.isActive,
    limit: pagination.limit,
    cursor: pagination.cursor,
  });

  return c.json(
    {
      ...success({ rules: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

router.get("/alerts/rules/:id", requireAbility("read", "alerts"), async (c) => {
  const id = ruleIdParam(c);
  const rule = await getAlertRuleById(c.var.db, id, c.var.user.orgId);
  return c.json(success({ rule }), 200);
});

router.patch("/alerts/rules/:id", requireAbility("update", "alerts"), async (c) => {
  const id = ruleIdParam(c);
  const parsed = updateAlertRuleSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid update input", validationDetails(parsed.error));
  }

  const updated = await updateAlertRule(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    {
      expectedVersion: parsed.data.version,
      actorContext: actorContext(c),
    },
  );

  return c.json(success({ rule: updated }), 200);
});

router.delete("/alerts/rules/:id", requireAbility("delete", "alerts"), async (c) => {
  const id = ruleIdParam(c);
  const result = await deleteAlertRule(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    actorContext(c),
  );
  return c.json(success(result), 200);
});

// ── ALERT EVENTS & DISPATCH ROUTES ───────────────────────────────────────────

router.post("/alerts/events", requireAbility("create", "alerts"), async (c) => {
  const parsed = fireAlertSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid alert fire input", validationDetails(parsed.error));
  }

  const result = await fireAlert(c.var.db, c.var.user.orgId, parsed.data, actorContext(c));

  return c.json(success(result), 201);
});

router.get("/alerts/events", requireAbility("read", "alerts"), async (c) => {
  const url = new URL(c.req.url);
  const pagination = parsePagination(url, { idPattern: ALERT_EVENT_ID_PATTERN });

  const queryParams = c.req.query();
  const parsedQuery = listAlertEventsQuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ValidationError("Invalid query parameters", validationDetails(parsedQuery.error));
  }

  const page = await listAlertEvents(c.var.db, {
    orgId: c.var.user.orgId,
    ruleId: parsedQuery.data.ruleId,
    sourceModule: parsedQuery.data.sourceModule,
    severity: parsedQuery.data.severity,
    isRead: parsedQuery.data.isRead,
    isAcknowledged: parsedQuery.data.isAcknowledged,
    limit: pagination.limit,
    cursor: pagination.cursor,
  });

  return c.json(
    {
      ...success({ events: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

router.get("/alerts/events/unread-count", requireAbility("read", "alerts"), async (c) => {
  const result = await getUnreadAlertCount(c.var.db, c.var.user.orgId);
  return c.json(success(result), 200);
});

router.get("/alerts/events/:id", requireAbility("read", "alerts"), async (c) => {
  const id = eventIdParam(c);
  const event = await getAlertEventById(c.var.db, id, c.var.user.orgId);
  return c.json(success({ event }), 200);
});

router.post("/alerts/events/:id/read", requireAbility("read", "alerts"), async (c) => {
  const id = eventIdParam(c);
  const event = await markAlertAsRead(c.var.db, id, c.var.user.orgId, true);
  return c.json(success({ event }), 200);
});

router.post("/alerts/events/read-all", requireAbility("read", "alerts"), async (c) => {
  const result = await markAllAlertsAsRead(c.var.db, c.var.user.orgId);
  return c.json(success(result), 200);
});

router.post("/alerts/events/:id/acknowledge", requireAbility("update", "alerts"), async (c) => {
  const id = eventIdParam(c);
  const parsed = acknowledgeAlertSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid acknowledge input", validationDetails(parsed.error));
  }

  const event = await acknowledgeAlert(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data.notes,
    actorContext(c),
  );

  return c.json(success({ event }), 200);
});

router.post("/alerts/events/:id/escalate", requireAbility("update", "alerts"), async (c) => {
  const id = eventIdParam(c);
  const parsed = escalateAlertSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid escalate input", validationDetails(parsed.error));
  }

  const event = await escalateAlert(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data.escalatedToId,
    parsed.data.notes,
    actorContext(c),
  );

  return c.json(success({ event }), 200);
});

export { router as alertRouter };
