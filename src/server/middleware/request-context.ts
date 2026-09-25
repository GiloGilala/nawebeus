/**
 * Request context middleware — one correlation id per request, one access-log
 * line per request (NWB-P1-012).
 *
 * Registered first in both app factories, so the id exists before any other
 * middleware (including CORS) and before any handler can throw. The id is:
 *
 * - taken from an inbound `x-request-id` when the value is 1..100 chars —
 *   100 because `unified_audit_log.request_id` is `varchar(100)`, and the
 *   approvals route used to forward the raw header straight into that column;
 * - otherwise generated as `req_<uuid>`;
 * - echoed on the response so a client can correlate without re-reading;
 * - stored on the Hono context (`c.var.requestId`) for code holding `c`;
 * - installed in the AsyncLocalStorage (`src/lib/request-context.ts`) for code
 *   that does not — most importantly `writeAuditLog`, whose rows then carry it.
 *
 * The access log line names the **route template** (`c.req.routePath`), never
 * the raw path: path parameters can be live single-use tokens (the invitation
 * token, for one), and a log file is not a place one should linger — the same
 * reasoning that caps the email outbox's job retention at an hour (NWB-P1-004).
 * Unmatched routes fall back to the raw path (a 404 has no template, and
 * nothing matched well enough to carry a parameter).
 *
 * `/api/health` is deliberately not logged: a readiness probe fires every few
 * seconds, that is infrastructure traffic rather than an application request,
 * and the endpoint already reports its own state in its response.
 */
import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { runWithRequestId } from "../../lib/request-context";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export const REQUEST_ID_HEADER = "x-request-id";

/** Fits `unified_audit_log.request_id` (`varchar(100)`). */
export const MAX_REQUEST_ID_LENGTH = 100;

/**
 * Honor a sane inbound id; mint one otherwise. A client that sends an empty
 * or oversized value gets a generated id rather than a 422 — correlation is
 * observability, not a contract to reject requests over.
 */
export function resolveRequestId(inbound: string | undefined): string {
  if (inbound && inbound.length <= MAX_REQUEST_ID_LENGTH) return inbound;
  return `req_${crypto.randomUUID()}`;
}

/**
 * Where an error surfaced with a status the client will actually see. Unknown
 * errors become 500 because that is what `errorHandler` will answer with.
 */
function statusOf(error: unknown): number {
  return error instanceof AppError ? error.statusCode : 500;
}

/**
 * The endpoint's registered template for this request — what a log line
 * should name — falling back to the raw path when no endpoint matched.
 *
 * `c.req.routePath` is NOT usable for this: it reports the *frame* the reader
 * is standing in (a middleware's `/api/audit/*`, or the catch-all `/*` on a
 * 404), so an aborted request logs the wrong pattern. `matchedRoutes` is the
 * full chain computed upfront, and the endpoint is its last entry — present
 * even when the request died in an earlier middleware.
 */
export function endpointRoute(c: Context): string {
  const routes = c.req.matchedRoutes;
  for (let i = routes.length - 1; i >= 0; i--) {
    const path = routes[i]?.path;
    // The root catch-all (`app.use("*")`) matched every request and says
    // nothing about the endpoint; anything deeper is worth keeping.
    if (path && path !== "*" && path !== "/*") return path;
  }
  return c.req.path;
}

export const requestContext: MiddlewareHandler = async (c, next) => {
  const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);

  const startedAt = Date.now();
  // Probes and CORS preflights are infrastructure handshakes, not application
  // requests: logging them would drown real traffic (a probe fires every few
  // seconds), and a preflight of a token-bearing GET would carry the raw path.
  const isInfrastructureTraffic = c.req.path === "/api/health" || c.req.method === "OPTIONS";

  const emitAccessLog = (status: number): void => {
    if (isInfrastructureTraffic) return;
    // Set by authMiddleware on authenticated routes; undefined on public ones.
    const user = c.get("user") as { userId: string; orgId: string } | undefined;
    const authMethod = c.get("authMethod");
    // Set by authMiddleware when the access token is an impersonation token
    // (NWB-P1-011). The support session's id joins the access line, so "who was
    // inside this account" is answerable from the log alone, without joining to
    // the audit table.
    const impersonation = c.get("impersonation") as { impersonationSessionId: string } | undefined;
    logger.info("request", {
      requestId,
      method: c.req.method,
      // The endpoint template, never a raw path with a live token in it —
      // see the file header.
      route: endpointRoute(c),
      status,
      durationMs: Date.now() - startedAt,
      ...(user ? { orgId: user.orgId, userId: user.userId } : {}),
      ...(user && authMethod ? { authMethod } : {}),
      ...(impersonation ? { impersonationSessionId: impersonation.impersonationSessionId } : {}),
    });
  };

  try {
    await runWithRequestId(requestId, next);
    emitAccessLog(c.res.status);
  } catch (error) {
    // The access line must exist for failures too — it is the line an
    // operator greps first, and the error-handler detail line carries the
    // same requestId right after it.
    emitAccessLog(statusOf(error));
    throw error;
  }
};
