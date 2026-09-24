import type { ErrorHandler } from "hono";
import { AppError, describeError, InternalError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { err } from "../../lib/response";
import { endpointRoute } from "./request-context";

/**
 * Maps errors to the response envelope, and — since NWB-P1-012 — tracks them
 * server-side with the request's correlation id.
 *
 * Every 5xx writes one structured `logger.error` line carrying `requestId`,
 * method, route, and the real cause. That line is new: before this ticket the
 * handler logged *nothing* unless `NWB_DEBUG_ERRORS` was set, so a production
 * 500 left zero server-side evidence. Error tracking that needs a dev flag
 * tracks nothing.
 *
 * The flag keeps its old job — adding the stack — and now also dumps 4xx
 * errors, which is what a developer staring at a rejection wants. What has
 * NOT changed is the client contract: a non-`AppError` still answers the
 * opaque `INTERNAL_ERROR`, and `NWB_DEBUG_ERRORS` never reaches the wire
 * (AGENTS.md: "Every 500 is opaque by default").
 *
 * 4xx without the flag is deliberately *not* logged here — the access line one
 * level up already records method, route, and status; the response body
 * carries the error code. A separate line per 401 would drown the signal.
 */
export const errorHandler: ErrorHandler = (e, c) => {
  const debug = !!process.env.NWB_DEBUG_ERRORS;
  const status = e instanceof AppError ? e.statusCode : 500;

  if (status >= 500 || debug) {
    const level = status >= 500 ? "error" : "warn";
    logger[level]("request error", {
      requestId: c.get("requestId"),
      method: c.req.method,
      route: endpointRoute(c),
      status,
      ...(e instanceof AppError ? { code: e.code } : {}),
      errorName: e instanceof Error ? e.name : typeof e,
      error: describeError(e),
      ...(debug && e instanceof Error && e.stack ? { stack: e.stack } : {}),
    });
  }

  if (e instanceof AppError) {
    c.status(e.statusCode as 400 | 401 | 403 | 404 | 409 | 410 | 422 | 423 | 429 | 500);
    return c.json(err(e));
  }
  c.status(500 as 400 | 401 | 403 | 404 | 409 | 410 | 422 | 423 | 429 | 500);
  return c.json(err(new InternalError("An unexpected error occurred")));
};
