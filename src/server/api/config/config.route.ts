import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { ZodError } from "zod";
import { getConfig } from "@/lib/config";
import { FeatureFlagDisabledError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  CONFIG_ID_PATTERN,
  createAppConfigSchema,
  createFeatureFlagSchema,
  evaluateFlagSchema,
  listAppConfigQuerySchema,
  rollbackAppConfigSchema,
  updateAppConfigSchema,
} from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import { configService } from "@/services/config";

const router = new Hono();

router.use("/config/*", authMiddleware);
router.use("/config", authMiddleware);

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function validationDetails(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
}

/**
 * Middleware that gates a live route behind a runtime feature flag.
 * (Phase 2 exit gate requirement: "feature flag gates a live code path")
 */
export function requireFeatureFlag(flagKey: string, fallback = false): MiddlewareHandler {
  return async (c, next) => {
    const db = c.var.db;
    const user = c.var.user;
    const isEnabled = await configService.evaluateFlag(db, flagKey, {
      organizationId: user?.orgId,
      userId: user?.userId,
      fallback,
    });
    if (!isEnabled) {
      throw new FeatureFlagDisabledError(flagKey);
    }
    await next();
  };
}

// ─── Evaluation & Retrieval Endpoints ─────────────────────────────────────────

// GET /api/config/evaluate — Evaluate a feature flag in caller's context
router.get("/config/evaluate", requireAbility("read", "flags"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const query = c.req.query();

  const parsed = evaluateFlagSchema.safeParse({
    key: query.key,
    organizationId: query.organizationId ?? user.orgId,
    userId: query.userId ?? user.userId,
    environment: query.environment,
    fallback: query.fallback === "true",
  });

  if (!parsed.success) {
    throw new ValidationError("Invalid flag evaluation query", validationDetails(parsed.error));
  }

  const enabled = await configService.evaluateFlag(db, parsed.data.key, {
    organizationId: parsed.data.organizationId,
    userId: parsed.data.userId,
    environment: parsed.data.environment,
    fallback: parsed.data.fallback,
  });

  return c.json(success({ key: parsed.data.key, enabled }), 200);
});

// GET /api/config/value — Get typed system configuration value
router.get("/config/value", requireAbility("read", "config"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const key = c.req.query("key");
  const environment = c.req.query("environment") as
    | import("@/lib/validation").ConfigEnvironment
    | undefined;

  if (!key) {
    throw new ValidationError("Missing required query parameter: key");
  }

  const value = await configService.getConfigValue(db, key, {
    organizationId: user.orgId,
    environment,
  });

  return c.json(success({ key, value }), 200);
});

// GET /api/config/gated-demo — Live code path gated by feature flag
router.get("/config/gated-demo", requireFeatureFlag("beta.experimental_feature"), async (c) => {
  return c.json(
    success({
      gatedFeature: "active",
      message: "Live code path successfully executed through feature flag",
    }),
    200,
  );
});

// ─── App Config & Flags CRUD Endpoints ────────────────────────────────────────

// POST /api/config/flags — Create a feature flag
router.post("/config/flags", requireAbility("create", "flags"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const body = await readJsonBody(c);

  const parsed = createFeatureFlagSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid feature flag payload", validationDetails(parsed.error));
  }

  const record = await configService.createFeatureFlag(
    db,
    {
      ...parsed.data,
      organizationId: parsed.data.organizationId ?? user.orgId,
    },
    {
      id: user.userId,
      organizationId: user.orgId,
      ipAddress: getClientIp(c, getConfig()),
      userAgent: c.req.header("user-agent"),
    },
  );

  return c.json(success(record), 201);
});

// POST /api/config — Create app config entry
router.post("/config", requireAbility("create", "config"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const body = await readJsonBody(c);

  const parsed = createAppConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid config payload", validationDetails(parsed.error));
  }

  const record = await configService.createAppConfig(
    db,
    {
      ...parsed.data,
      organizationId: parsed.data.organizationId ?? user.orgId,
    },
    {
      id: user.userId,
      organizationId: user.orgId,
      ipAddress: getClientIp(c, getConfig()),
      userAgent: c.req.header("user-agent"),
    },
  );

  return c.json(success(record), 201);
});

// GET /api/config — List app configs with keyset pagination
router.get("/config", requireAbility("read", "flags"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const query = c.req.query();

  const pagination = parsePagination(new URL(c.req.url), { idPattern: CONFIG_ID_PATTERN });
  const parsed = listAppConfigQuerySchema.safeParse({
    ...query,
    limit: pagination.limit,
    cursor: query.cursor,
  });

  if (!parsed.success) {
    throw new ValidationError("Invalid config query parameters", validationDetails(parsed.error));
  }

  const page = await configService.listAppConfigs(db, {
    kind: parsed.data.kind,
    environment: parsed.data.environment,
    configType: parsed.data.configType,
    organizationId: parsed.data.organizationId ?? user.orgId,
    includeGlobal: parsed.data.includeGlobal,
    isDeprecated: parsed.data.isDeprecated,
    search: parsed.data.search,
    cursor: pagination.cursor?.id,
    limit: pagination.limit,
  });

  return c.json(
    {
      ...success({ configs: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

// GET /api/config/:id — Get config by ID
router.get("/config/:id", requireAbility("read", "flags"), async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const id = c.req.param("id");

  if (!CONFIG_ID_PATTERN.test(id)) {
    throw new ValidationError("Invalid config ID format");
  }

  const record = await configService.getAppConfigById(db, id, user.orgId);
  return c.json(success(record), 200);
});

// PATCH /api/config/:id — Update config entry
router.patch("/config/:id", async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const ability = c.var.ability;
  const id = c.req.param("id");

  if (!CONFIG_ID_PATTERN.test(id)) {
    throw new ValidationError("Invalid config ID format");
  }

  const canUpdateConfig = ability?.can("update", "config");
  const canUpdateFlags = ability?.can("update", "flags");
  if (!canUpdateConfig && !canUpdateFlags) {
    return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
  }

  const body = await readJsonBody(c);
  const parsed = updateAppConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid update config payload", validationDetails(parsed.error));
  }

  const record = await configService.updateAppConfig(db, id, parsed.data, {
    id: user.userId,
    organizationId: user.orgId,
    ipAddress: getClientIp(c, getConfig()),
    userAgent: c.req.header("user-agent"),
  });

  return c.json(success(record), 200);
});

// POST /api/config/:id/rollback — Rollback config to previous value
router.post("/config/:id/rollback", async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const ability = c.var.ability;
  const id = c.req.param("id");

  if (!CONFIG_ID_PATTERN.test(id)) {
    throw new ValidationError("Invalid config ID format");
  }

  const canUpdateConfig = ability?.can("update", "config");
  const canUpdateFlags = ability?.can("update", "flags");
  if (!canUpdateConfig && !canUpdateFlags) {
    return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
  }

  const body = await readJsonBody(c);
  const parsed = rollbackAppConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid rollback payload", validationDetails(parsed.error));
  }

  const record = await configService.rollbackAppConfig(db, id, parsed.data, {
    id: user.userId,
    organizationId: user.orgId,
    ipAddress: getClientIp(c, getConfig()),
    userAgent: c.req.header("user-agent"),
  });

  return c.json(success(record), 200);
});

// DELETE /api/config/:id — Delete config entry
router.delete("/config/:id", async (c) => {
  const db = c.var.db;
  const user = c.var.user;
  const ability = c.var.ability;
  const id = c.req.param("id");

  if (!CONFIG_ID_PATTERN.test(id)) {
    throw new ValidationError("Invalid config ID format");
  }

  const canDeleteConfig = ability?.can("delete", "config");
  const canDeleteFlags = ability?.can("delete", "flags");
  if (!canDeleteConfig && !canDeleteFlags) {
    return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
  }

  await configService.deleteAppConfig(db, id, {
    id: user.userId,
    organizationId: user.orgId,
    ipAddress: getClientIp(c, getConfig()),
    userAgent: c.req.header("user-agent"),
  });

  return c.json(success({ deleted: true }), 200);
});

export { router as configRouter };
