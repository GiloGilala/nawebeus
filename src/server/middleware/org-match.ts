import type { MiddlewareHandler } from "hono";
import { ForbiddenError } from "../../lib/errors";

/**
 * Validates that the :orgId URL parameter matches the authenticated user's JWT orgId.
 * Use on any route where the orgId comes from the URL path.
 */
export function requireOrgMatch(): MiddlewareHandler {
  return async (c, next) => {
    const jwtOrgId = c.var.user?.orgId;
    const urlOrgId = c.req.param("orgId");

    if (urlOrgId && jwtOrgId && urlOrgId !== jwtOrgId) {
      throw new ForbiddenError("You do not have access to this organization");
    }

    await next();
  };
}
