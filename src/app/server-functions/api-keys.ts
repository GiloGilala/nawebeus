/**
 * TanStack Start Server Functions — API Keys domain
 *
 * Keys are org-scoped and permission-gated. Creating a key requires
 * `create:apikeys`, listing `read:apikeys`, etc. The plaintext key is
 * returned exactly once — the DB keeps only a hash.
 */

import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/services/auth/api-key";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

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

export const createApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "apikeys");
    const db = getServerDb();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await withServerOrgContext(auth, () =>
      createApiKey(db, {
        organizationId: auth.orgId,
        userId: auth.userId,
        createdBy: auth.userId,
        name: data.name,
        ...(data.description !== undefined ? { description: data.description } : {}),
        keyType: data.keyType,
        environment: data.environment,
        permissionLevel: data.permissionLevel,
        securityLevel: data.securityLevel,
        scopes: data.scopes,
        expiresAt,
        rotationStrategy: data.rotationStrategy,
      }),
    );
    return {
      apiKey: created,
      warning: "Store this key now. It cannot be retrieved again — only its prefix is kept.",
    };
  });

export const listApiKeysServerFn = createServerFn({ method: "GET" })
  .validator(listQuerySchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "apikeys");
    const db = getServerDb();
    const apiKeys = await withServerOrgContext(auth, () =>
      listApiKeys(db, auth.orgId, data.status as never),
    );
    return { apiKeys };
  });

export const revokeApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuidSchema }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "apikeys");
    const db = getServerDb();
    await withServerOrgContext(auth, () => revokeApiKey(db, auth.orgId, data.id, auth.userId));
    return { revoked: true as const, id: data.id };
  });

export const rotateApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuidSchema }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "apikeys");
    const db = getServerDb();
    const rotated = await withServerOrgContext(auth, () =>
      rotateApiKey(db, auth.orgId, data.id, auth.userId),
    );
    return {
      apiKey: rotated,
      warning: "Store this key now. It cannot be retrieved again — only its prefix is kept.",
    };
  });
