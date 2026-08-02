import type { MiddlewareHandler } from "hono";
import { ForbiddenError } from "../../lib/errors";
import type { Actions, Subjects } from "../../services/auth/ability";

export function requireAbility(action: Actions, subject: Subjects): MiddlewareHandler {
  return async (c, next) => {
    const ability = c.var.ability;
    if (!ability) throw new ForbiddenError("No ability loaded");
    if (!ability.can(action, subject)) {
      throw new ForbiddenError(`Missing permission: ${action} ${subject}`);
    }
    await next();
  };
}
