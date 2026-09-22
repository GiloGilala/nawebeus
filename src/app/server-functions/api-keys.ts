/**
 * TanStack Start Server Functions — API Keys domain
 *
 * Org-scoped and permission-gated. The org id is taken from the session.
 * The plaintext key is returned exactly once — the DB keeps only a hash.
 */

import {
  apiKeyIdSchema,
  createApiKeySchema,
  expiresAtFromDays,
  listApiKeysQuerySchema,
} from "@/lib/validation";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/services/auth/api-key";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

const STORE_ONCE_WARNING =
  "Store this key now. It cannot be retrieved again — only its prefix is kept.";

export const createApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(createApiKeySchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createApiKeySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "apikeys");
    const db = getServerDb();
    const expiresAt = expiresAtFromDays(parsed.expiresInDays);

    const created = await withServerOrgContext(auth, () =>
      createApiKey(db, {
        organizationId: auth.orgId,
        userId: auth.userId,
        createdBy: auth.userId,
        actorType: "user",
        name: parsed.name,
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        keyType: parsed.keyType,
        environment: parsed.environment,
        permissionLevel: parsed.permissionLevel,
        securityLevel: parsed.securityLevel,
        scopes: parsed.scopes,
        expiresAt,
        rotationStrategy: parsed.rotationStrategy,
      }),
    );
    return { apiKey: created, warning: STORE_ONCE_WARNING };
  });

export const listApiKeysServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listApiKeysQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listApiKeysQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "apikeys");
    const db = getServerDb();
    const apiKeys = await withServerOrgContext(auth, () =>
      listApiKeys(db, auth.orgId, parsed.status as never).then((p) => p.items),
    );
    return { apiKeys };
  });

export const revokeApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(apiKeyIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "apikeys");
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      revokeApiKey(db, auth.orgId, parsed.id, {
        actorId: auth.userId,
        actorType: "user",
        organizationId: auth.orgId,
      }),
    );
    return { revoked: true as const, id: parsed.id };
  });

export const rotateApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(apiKeyIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "apikeys");
    const db = getServerDb();
    const rotated = await withServerOrgContext(auth, () =>
      rotateApiKey(db, auth.orgId, parsed.id, {
        actorId: auth.userId,
        actorType: "user",
        organizationId: auth.orgId,
      }),
    );
    return { apiKey: rotated, warning: STORE_ONCE_WARNING };
  });
