import { Hono } from "hono";
import { cors } from "hono/cors";
import { DEFAULT_CORS_ORIGIN } from "../lib/config";
// Canonical Hono API — mounted at `/api/*` for mobile, webhooks and
// third-party integrations. The web app's entry point is TanStack Start
// Server Functions in `src/app/server-functions/*` which call `src/services/*`
// directly in-process (ADR-002, Principle 3: Direct Calls). Both entry points
// share the single `services/` layer and run in one Bun process (ADR-007).
//
// `src/app/*` previously held these Hono routes; they remain as deprecated
// re-exports for backward compatibility and will be removed once all imports
// are updated.
import { alertRouter } from "./api/alerts";
import { apiKeyRootRouter } from "./api/api-keys";
import { approvalRootRouter } from "./api/approvals";
import { auditRootRouter } from "./api/audit";
import { authRouter } from "./api/auth";
import { configRouter } from "./api/config";
import { contactRouter } from "./api/contacts";
import { mediaRouter } from "./api/media";
import { orgRootRouter } from "./api/orgs";
import { templateRootRouter } from "./api/templates";
import { userRouter } from "./api/users";
import { healthHandler } from "./health";
import { errorHandler } from "./middleware/error-handler";
import { requestContext } from "./middleware/request-context";

/**
 * Every API area in one place.
 *
 * Both app builders below used to repeat these four lines, which is a bug waiting to be half-fixed:
 * an area mounted in `createApp` (production) and not in `createAppWithDb` (what the tests build)
 * would ship untested, and the reverse would ship a route no test could reach. `NWB-P1-002`'s audit
 * surface is the fifth area, so the list is shared now rather than duplicated a fifth time.
 */
function mountApiRouters(app: Hono): void {
  app.route("/api", authRouter);
  app.route("/api", userRouter);
  app.route("/api", orgRootRouter);
  app.route("/api", apiKeyRootRouter);
  app.route("/api", auditRootRouter);
  app.route("/api", approvalRootRouter);
  app.route("/api", templateRootRouter);
  app.route("/api", contactRouter);
  app.route("/api", alertRouter);
  app.route("/api", configRouter);
  app.route("/api", mediaRouter);
}

export function createApp(corsOrigins: string[] = [DEFAULT_CORS_ORIGIN]) {
  const app = new Hono();

  // First: the correlation id must exist before CORS, before handlers, before
  // anything can throw (NWB-P1-012).
  app.use("*", requestContext);
  app.use("*", cors({ origin: corsOrigins }));
  app.onError(errorHandler);

  // No injected database on this entry (it serves the web app) — the probe
  // says `not-configured` rather than inventing a ping.
  app.get("/api/health", healthHandler({}));

  mountApiRouters(app);

  app.notFound((c) => {
    c.status(404);
    return c.json({
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    });
  });

  return app;
}

export function createAppWithDb(deps: { db: import("../lib/db").Db; corsOrigins?: string[] }) {
  const app = new Hono();

  // Origins are injected, not read from the config singleton: resolving them
  // here would couple app creation to loadConfig order and break the zero-env
  // no-DB suites. Production passes `config.CORS_ORIGIN` (src/index.ts);
  // tests pass explicit lists or take the dev default.
  app.use("*", requestContext);
  app.use("*", cors({ origin: deps.corsOrigins ?? [DEFAULT_CORS_ORIGIN] }));
  app.use("*", async (c, next) => {
    c.set("db", deps.db);
    await next();
  });
  app.onError(errorHandler);

  app.get("/api/health", healthHandler({ db: deps.db }));

  mountApiRouters(app);

  app.notFound((c) => {
    c.status(404);
    return c.json({
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    });
  });

  return app;
}
