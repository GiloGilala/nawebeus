import type { Context } from "hono";
import { ValidationError } from "../../lib/errors";

/**
 * Path-parameter validation for identifiers that are uuid columns.
 *
 * Every id in this schema is a Postgres `uuid`. A path segment goes straight
 * into a `WHERE id = $1`, so an unvalidated one reaches the driver and
 * Postgres answers `22P02 invalid input syntax for type uuid`. That surfaces as
 * a **500** — the wrong status (the client sent a bad request, the server is
 * fine), a needless error-shaped response, and in a less careful error handler
 * a leak of the driver's message back to the caller.
 *
 * Measured before this helper existed: `GET /api/users/admin/not-a-uuid`,
 * `GET /api/orgs/:orgId/members/not-a-uuid`, `DELETE /api/auth/sessions/not-a-uuid`
 * and `GET /api/users/me/data-export/not-a-uuid` all returned 500. Only the
 * api-keys routes were safe, because they already validated inline — this is
 * that same check, lifted to one place so new routes can reuse it instead of
 * re-deriving it (it had already been copy-pasted into three files).
 *
 * The check is a regex rather than zod's `.uuid()` because it is also what the
 * api-keys routes used, and it accepts exactly the 8-4-4-4-12 hex shape
 * Postgres does.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid uuid. */
export function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Reads a path parameter that must be a uuid.
 *
 * Throws `ValidationError` (422) — never lets a malformed id reach the
 * database. `label` names the parameter in the message, e.g. "user id".
 */
export function uuidParam(c: Context, name: string, label = `${name}`): string {
  const raw = c.req.param(name);
  if (!isUuid(raw)) {
    throw new ValidationError(`Invalid ${label}`, [{ field: name, message: "Must be a UUID" }]);
  }
  return raw;
}
