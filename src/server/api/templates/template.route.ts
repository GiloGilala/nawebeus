import type { Context } from "hono";
import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  approveTemplateSchema,
  createTemplateSchema,
  listTemplatesQuerySchema,
  recordUsageSchema,
  renderTemplateSchema,
  TEMPLATE_ID_PATTERN,
  updateTemplateSchema,
} from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  approveTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  recordTemplateUsage,
  renderTemplateVariables,
  updateTemplate,
} from "@/services/templates";

const router = new Hono();

router.use("/templates/*", authMiddleware);
router.use("/templates", authMiddleware);

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

function templateIdParam(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!TEMPLATE_ID_PATTERN.test(id)) {
    throw new NotFoundError("Template not found");
  }
  return id;
}

function actorContext(c: Context): { ip?: string; userAgent?: string } {
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

// ── POST /api/templates — create template ───────────────────────────────────────────────────

router.post("/templates", requireAbility("create", "templates"), async (c) => {
  const parsed = createTemplateSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid template input", validationDetails(parsed.error));
  }

  const created = await createTemplate(
    c.var.db,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    actorContext(c),
  );

  return c.json(success({ template: created }), 201);
});

// ── GET /api/templates — list / picker ──────────────────────────────────────────────────────

router.get("/templates", requireAbility("read", "templates"), async (c) => {
  const url = new URL(c.req.url);
  const pagination = parsePagination(url, { idPattern: TEMPLATE_ID_PATTERN });

  const queryParams = c.req.query();
  const parsedQuery = listTemplatesQuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ValidationError("Invalid query parameters", validationDetails(parsedQuery.error));
  }

  const canManage = c.var.ability.can("update", "templates");
  const data = parsedQuery.data;

  const page = await listTemplates(c.var.db, {
    orgId: c.var.user.orgId,
    userId: c.var.user.userId,
    templateType: data.templateType,
    platform: data.platform,
    category: data.category,
    categoryPath: data.categoryPath,
    intentMatch: data.intentMatch,
    isPidginAppropriate: data.isPidginAppropriate,
    tag: data.tag,
    q: data.q,
    visibility: data.visibility,
    approvalStatus: data.approvalStatus,
    isActive: data.isActive,
    sort: data.sort,
    limit: pagination.limit,
    cursor: pagination.cursor,
    includePending:
      canManage && (data.approvalStatus === "pending" || data.approvalStatus === "all"),
  });

  return c.json(
    {
      ...success({ templates: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

// ── GET /api/templates/:id — get template ───────────────────────────────────────────────────

router.get("/templates/:id", requireAbility("read", "templates"), async (c) => {
  const id = templateIdParam(c);
  const canManage = c.var.ability.can("update", "templates");

  const template = await getTemplateById(c.var.db, id, {
    orgId: c.var.user.orgId,
    userId: c.var.user.userId,
    includePending: canManage,
  });

  return c.json(success({ template }), 200);
});

// ── PATCH /api/templates/:id — update template ─────────────────────────────────────────────

router.patch("/templates/:id", requireAbility("update", "templates"), async (c) => {
  const id = templateIdParam(c);
  const parsed = updateTemplateSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid update input", validationDetails(parsed.error));
  }

  const isManagerOrAbove = c.var.ability.can("delete", "templates");

  const updated = await updateTemplate(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    {
      isManagerOrAbove,
      ...(parsed.data.version !== undefined ? { expectedVersion: parsed.data.version } : {}),
      actorContext: actorContext(c),
    },
  );

  return c.json(success({ template: updated }), 200);
});

// ── DELETE /api/templates/:id — delete template ─────────────────────────────────────────────

router.delete("/templates/:id", requireAbility("delete", "templates"), async (c) => {
  const id = templateIdParam(c);
  const isManagerOrAbove = c.var.ability.can("delete", "templates");

  const result = await deleteTemplate(c.var.db, id, c.var.user.orgId, c.var.user.userId, {
    isManagerOrAbove,
    actorContext: actorContext(c),
  });

  return c.json(success(result), 200);
});

// ── POST /api/templates/:id/use — record usage ──────────────────────────────────────────────

router.post("/templates/:id/use", requireAbility("read", "templates"), async (c) => {
  const id = templateIdParam(c);
  const parsed = recordUsageSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid usage input", validationDetails(parsed.error));
  }

  const updated = await recordTemplateUsage(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    {
      ...(parsed.data.csat !== undefined ? { csat: parsed.data.csat } : {}),
      ...(parsed.data.conversionRate !== undefined
        ? { conversionRate: parsed.data.conversionRate }
        : {}),
    },
    actorContext(c),
  );

  return c.json(success({ template: updated }), 200);
});

// ── POST /api/templates/:id/render — render template variables ──────────────────────────────

router.post("/templates/:id/render", requireAbility("read", "templates"), async (c) => {
  const id = templateIdParam(c);
  const parsed = renderTemplateSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid render input", validationDetails(parsed.error));
  }

  const canManage = c.var.ability.can("update", "templates");
  const template = await getTemplateById(c.var.db, id, {
    orgId: c.var.user.orgId,
    userId: c.var.user.userId,
    includePending: canManage,
  });

  const rendered = renderTemplateVariables(template, parsed.data.variables, parsed.data.platform);

  return c.json(success({ render: rendered }), 200);
});

// ── POST /api/templates/:id/approve — approve or reject template ───────────────────────────

router.post("/templates/:id/approve", requireAbility("update", "templates"), async (c) => {
  const id = templateIdParam(c);
  const parsed = approveTemplateSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid approval input", validationDetails(parsed.error));
  }

  // Must have manager-level delete or approval decision ability
  const canDecide =
    c.var.ability.can("delete", "templates") || c.var.ability.can("decide", "approvals");
  if (!canDecide) {
    throw new ValidationError("Only managers and administrators can approve templates");
  }

  const updated = await approveTemplate(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    {
      status: parsed.data.status,
      ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
    },
    actorContext(c),
  );

  return c.json(success({ template: updated }), 200);
});

export { router as templateRouter };
