import { type Context, Hono } from "hono";
import { getConfig } from "@/lib/config";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  apiKeyIdSchema,
  createApiKeySchema,
  expiresAtFromDays,
  listApiKeysQuerySchema,
  parseWithValidation,
} from "@/lib/validation";
import type { ApiKeyStatus } from "@/server/auth/types/api-key-types";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/services/auth/api-key";

const router = new Hono();

// Auth applies to the collection and every sub-path. Bearer keys are accepted
// here exactly as session cookies are.
router.use("/api-keys/*", authMiddleware);

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
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

  const input = parseWithValidation(createApiKeySchema, await readJsonBody(c));
  const expiresAt = expiresAtFromDays(input.expiresInDays);

  // Hoisted so the truthiness check narrows the type for the spread below.
  const createdIp = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");

  const created = await createApiKey(db, {
    organizationId: orgId,
    userId,
    createdBy: userId,
    // The audit row is written inside the service now; the route contributes only what it knows and
    // the service cannot derive — whether this caller arrived with a session cookie or a machine key.
    actorType: actorOf(c).actorType,
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

  return c.json(success({ apiKey: created, warning: STORE_ONCE_WARNING }), 201);
});

// ── GET /api/api-keys — list (masked) ───────────────────────────────────────
router.get("/api-keys", requireAbility("read", "apikeys"), async (c) => {
  const { orgId } = c.var.user;

  const parsed = parseWithValidation(listApiKeysQuerySchema, {
    status: c.req.query("status") ?? "active",
  });

  const page = parsePagination(new URL(c.req.url));
  const { items: apiKeys, pageInfo } = await listApiKeys(
    c.var.db,
    orgId,
    parsed.status as ApiKeyStatus,
    page,
  );
  return c.json(success({ apiKeys }, paginationMeta(pageInfo)));
});

// ── POST /api/api-keys/:id/rotate — mint a replacement ──────────────────────
router.post("/api-keys/:id/rotate", requireAbility("update", "apikeys"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;

  const id = parseWithValidation(apiKeyIdSchema, { id: c.req.param("id") });

  const result = await rotateApiKey(db, orgId, id.id, {
    ...actorOf(c),
    organizationId: orgId,
  });
  if (result.outcome === "not_found") throw new NotFoundError("API key not found");
  if (result.outcome === "already_revoked") {
    throw new ConflictError("Cannot rotate a revoked API key");
  }

  // No audit block here: `rotateApiKey` writes the event, so the server-function path cannot skip it.
  return c.json(success({ apiKey: result.key, warning: STORE_ONCE_WARNING }), 201);
});

// ── DELETE /api/api-keys/:id — revoke ──────────────────────────────────────
// Revoking keeps the row so the key stays in history and can never be
// resurrected; it is not a soft delete.
router.delete("/api-keys/:id", requireAbility("delete", "apikeys"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;

  const id = parseWithValidation(apiKeyIdSchema, { id: c.req.param("id") });

  const result = await revokeApiKey(db, orgId, id.id, {
    ...actorOf(c),
    organizationId: orgId,
  });
  if (result.outcome === "not_found") throw new NotFoundError("API key not found");
  if (result.outcome === "already_revoked") {
    throw new ConflictError("API key is already revoked");
  }

  return c.json(success({ revoked: true, id: id.id }));
});

export { router as apiKeysRouter };
