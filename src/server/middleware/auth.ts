import type { Ability } from "@casl/ability";
import { sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { AuthError, ForbiddenError } from "../../lib/errors";
import { getClientIp } from "../../lib/ip";
import { runWithOrgContext } from "../../lib/org-context";
import { type Actions, loadAbility, type Subjects } from "../../services/auth/ability";
import { apiKeyAbility, recordApiKeyUsage, resolveApiKey } from "../../services/auth/api-key";
import { type AccessPayload, verifyToken } from "../../services/auth/jwt";

export type AppAbility = Ability<[Actions, Subjects]>;

export interface AuthUser {
  userId: string;
  orgId: string;
}

/**
 * How the request proved its identity. Recorded so audit events can distinguish
 * a human action from a machine one — `AuditActorType` already carries
 * `"api_key"` for exactly this purpose.
 */
export type AuthMethod = "session" | "api_key";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    ability: AppAbility;
    db: Db;
    authMethod: AuthMethod;
    apiKeyId: string | undefined;
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * The key's owner must still be an active member of the key's organization.
 * Without this, removing someone from an org would leave their keys working —
 * the key row would still say `active`.
 */
async function assertActiveMembership(db: Db, userId: string, orgId: string): Promise<void> {
  const memberRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organization_members
        WHERE user_id = ${userId}
          AND organization_id = ${orgId}
          AND status = 'active'
          AND deleted_at IS NULL
        LIMIT 1`,
  );
  if (((memberRows as any).rows?.length ?? 0) === 0) {
    throw new ForbiddenError("You are not a member of this organization");
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const config = getConfig();
  const db = c.var.db;

  // ── API key path ─────────────────────────────────────────────────────────
  // A Bearer key is a drop-in replacement for the access-token cookie on every
  // protected route. It resolves to a user + org exactly as the cookie does,
  // but the ability it installs is narrowed to the key's own limits.
  const authHeader = c.req.header("authorization");
  if (authHeader && authHeader.startsWith(BEARER_PREFIX)) {
    const presented = authHeader.slice(BEARER_PREFIX.length).trim();
    if (!presented) throw new AuthError("Malformed Authorization header");

    const resolved = await resolveApiKey(db, presented);
    if (!resolved) throw new AuthError("Invalid or revoked API key");

    await assertActiveMembership(db, resolved.userId, resolved.organizationId);

    c.set("user", { userId: resolved.userId, orgId: resolved.organizationId });
    c.set("authMethod", "api_key");
    c.set("apiKeyId", resolved.id);

    const base = await loadAbility(db, resolved.userId, resolved.organizationId);
    c.set("ability", apiKeyAbility(base, resolved.permissionLevel, resolved.scopes));

    await recordApiKeyUsage(db, resolved.id, {
      ip: getClientIp(c, config),
      userAgent: c.req.header("user-agent") ?? null,
    });

    // MUST await: Hono's compose() checks `context.finalized` as soon as this
    // handler's promise settles. Dropping the await resolves the chain before
    // the route handler writes its response, and Hono throws
    // "Context is not finalized" → a blanket 500 on every protected route.
    await runWithOrgContext({ orgId: resolved.organizationId, userId: resolved.userId }, next);
    return;
  }

  // ── Session cookie path (unchanged) ──────────────────────────────────────
  const accessToken = getCookie(c, "nawebeus_access");
  if (!accessToken) throw new AuthError("No access token provided");

  let payload: AccessPayload;
  try {
    const result = await verifyToken(accessToken, config.JWT_ACCESS_SECRET);
    if (result.type !== "access") throw new AuthError("Invalid token type");
    payload = result;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("Invalid or expired access token");
  }

  // Verify membership — the JWT's orgId must match a real membership row
  await assertActiveMembership(db, payload.userId, payload.orgId);

  c.set("user", { userId: payload.userId, orgId: payload.orgId });
  c.set("authMethod", "session");
  c.set("apiKeyId", undefined);

  const ability = await loadAbility(db, payload.userId, payload.orgId);
  c.set("ability", ability);

  // Same reasoning as the API-key branch above — the await is load-bearing.
  await runWithOrgContext({ orgId: payload.orgId, userId: payload.userId }, next);
};
