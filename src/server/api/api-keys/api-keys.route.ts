import { type Context, Hono } from "hono";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { success } from "@/lib/response";
import type { ApiKeyStatus } from "@/server/auth/types/api-key-types";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import { writeAuditLog } from "@/services/audit";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/services/auth/api-key";

const router = new Hono();

// Auth applies to the collection and every sub-path. Bearer keys are accepted
// here exactly as session cookies are.
router.use("/api-keys/*", authMiddleware);

/** `api_keys.id` is a uuid — reject anything else before it reaches Postgres. */
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Must be a UUID");

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  keyType: z.enum(["read", "write", "admin"]).default("read"),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  permissionLevel: z.enum(["read", "write", "admin", "read_only"]).default("read_only"),
  securityLevel: z.enum(["low", "medium", "high", "standard"]).default("standard"),
  scopes: z.array(z.string().trim().min(1)).max(50).default([]),
  expiresInDays: z.number().int().positive().max(3650).optional(),
  rotationStrategy: z.enum(["manual", "automatic", "periodic", "none"]).default("none"),
});

const listQuerySchema = z.object({
  status: z.enum(["active", "inactive", "revoked"]).default("active"),
});

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

/** Audit attribution: a key acting on keys is recorded as a key, not a person. */
function actorOf(c: Context): {
  actorId: string;
  actorType: "user" | "api_key";
} {
  return {
    actorId: c.var.user.userId,
    actorType: c.var.authMethod === "api_key" ? "api_key" : "user",
  };
}

const STORE_ONCE_WARNING =
  "Store this key now. It cannot be retrieved again — only its prefix is kept.";

// ── POST /api/api-keys — create ─────────────────────────────────────────────
// The plaintext key appears in this response and nowhere else, ever.
router.post("/api-keys", requireAbility("create", "apikeys"), async (c) => {
  const { userId, orgId } = c.var.user;
  const db = c.var.db;

  const parsed = createSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid API key request", validationDetails(parsed.error));
  }
  const input = parsed.data;

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Hoisted so the truthiness check narrows the type for the spread below.
  const createdIp = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");

  const created = await createApiKey(db, {
    organizationId: orgId,
    userId,
    createdBy: userId,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    keyType: input.keyType,
    environment: input.environment,
    permissionLevel: input.permissionLevel,
    securityLevel: input.securityLevel,
    scopes: input.scopes,
    expiresAt,
    rotationStrategy: input.rotationStrategy,
    ...(createdIp ? { createdIp } : {}),
    ...(userAgent ? { createdUserAgent: userAgent } : {}),
  });

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    ...actorOf(c),
    action: "apikeys.created",
    category: "security",
    resourceType: "api_key",
    resourceId: created.id,
    // Metadata only — the key value must never reach the audit log.
    afterState: {
      name: created.name,
      keyType: created.keyType,
      environment: created.environment,
      permissionLevel: created.permissionLevel,
      scopes: created.scopes,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    },
  });

  return c.json(success({ apiKey: created, warning: STORE_ONCE_WARNING }), 201);
});

// ── GET /api/api-keys — list (masked) ───────────────────────────────────────
router.get("/api-keys", requireAbility("read", "apikeys"), async (c) => {
  const { orgId } = c.var.user;

  const parsed = listQuerySchema.safeParse({
    status: c.req.query("status") ?? "active",
  });
  if (!parsed.success) {
    throw new ValidationError("Invalid status filter", validationDetails(parsed.error));
  }

  const apiKeys = await listApiKeys(c.var.db, orgId, parsed.data.status as ApiKeyStatus);
  return c.json(success({ apiKeys }));
});

// ── POST /api/api-keys/:id/rotate — mint a replacement ──────────────────────
router.post("/api-keys/:id/rotate", requireAbility("update", "apikeys"), async (c) => {
  const { userId, orgId } = c.var.user;
  const db = c.var.db;

  const id = uuidSchema.safeParse(c.req.param("id"));
  if (!id.success) {
    throw new ValidationError("Invalid API key id", validationDetails(id.error));
  }

  const result = await rotateApiKey(db, orgId, id.data, userId);
  if (result.outcome === "not_found") throw new NotFoundError("API key not found");
  if (result.outcome === "already_revoked") {
    throw new ConflictError("Cannot rotate a revoked API key");
  }

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    ...actorOf(c),
    action: "apikeys.rotated",
    category: "security",
    resourceType: "api_key",
    resourceId: result.key.id,
    metadata: { rotatedFromId: id.data },
    afterState: {
      name: result.key.name,
      expiresAt: result.key.expiresAt?.toISOString() ?? null,
    },
  });

  return c.json(success({ apiKey: result.key, warning: STORE_ONCE_WARNING }), 201);
});

// ── DELETE /api/api-keys/:id — revoke ──────────────────────────────────────
// Revoking keeps the row so the key stays in history and can never be
// resurrected; it is not a soft delete.
router.delete("/api-keys/:id", requireAbility("delete", "apikeys"), async (c) => {
  const { userId, orgId } = c.var.user;
  const db = c.var.db;

  const id = uuidSchema.safeParse(c.req.param("id"));
  if (!id.success) {
    throw new ValidationError("Invalid API key id", validationDetails(id.error));
  }

  const result = await revokeApiKey(db, orgId, id.data, userId);
  if (result.outcome === "not_found") throw new NotFoundError("API key not found");
  if (result.outcome === "already_revoked") {
    throw new ConflictError("API key is already revoked");
  }

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgId,
    ...actorOf(c),
    action: "apikeys.revoked",
    category: "security",
    resourceType: "api_key",
    resourceId: id.data,
    beforeState: { status: "active" },
    afterState: { status: "revoked" },
  });

  return c.json(success({ revoked: true, id: id.data }));
});

export { router as apiKeysRouter };
