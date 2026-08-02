import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import { AuthError, ForbiddenError } from "../../lib/errors";
import { verifyToken, type AccessPayload } from "../../services/auth/jwt";
import { runWithOrgContext } from "../../lib/org-context";
import { loadAbility, type Actions, type Subjects } from "../../services/auth/ability";
import type { Ability } from "@casl/ability";
import type { Db } from "../../lib/db";

export type AppAbility = Ability<[Actions, Subjects]>;

export interface AuthUser {
  userId: string;
  orgId: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    ability: AppAbility;
    db: Db;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const config = getConfig();
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
  const db = c.var.db;
  const memberRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organization_members
        WHERE user_id = ${payload.userId}
          AND organization_id = ${payload.orgId}
          AND status = 'active'
          AND deleted_at IS NULL
        LIMIT 1`,
  );
  if (((memberRows as any).rows?.length ?? 0) === 0) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  c.set("user", { userId: payload.userId, orgId: payload.orgId });
  const ability = await loadAbility(db, payload.userId, payload.orgId);
  c.set("ability", ability);

  runWithOrgContext({ orgId: payload.orgId, userId: payload.userId }, next);
};
