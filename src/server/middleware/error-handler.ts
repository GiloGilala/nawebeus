import type { ErrorHandler } from "hono";
import { AppError, InternalError } from "../../lib/errors";
import { err } from "../../lib/response";

export const errorHandler: ErrorHandler = (e, c) => {
  if (process.env.NWB_DEBUG_ERRORS) {
    // eslint-disable-next-line no-console
    console.error("[NWB_DEBUG_ERRORS]", e);
  }
  if (e instanceof AppError) {
    c.status(e.statusCode as 400 | 401 | 403 | 404 | 409 | 410 | 422 | 423 | 429 | 500);
    return c.json(err(e));
  }
  c.status(500 as 400 | 401 | 403 | 404 | 409 | 410 | 422 | 423 | 429 | 500);
  return c.json(err(new InternalError("An unexpected error occurred")));
};
