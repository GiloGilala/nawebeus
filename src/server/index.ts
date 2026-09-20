import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyRootRouter } from "../app/api-keys";
import { authRouter } from "../app/auth";
import { orgRootRouter } from "../app/orgs";
import { userRouter } from "../app/users";
import { DEFAULT_CORS_ORIGIN } from "../lib/config";
import { success } from "../lib/response";
import { errorHandler } from "./middleware/error-handler";

export function createApp(corsOrigins: string[] = [DEFAULT_CORS_ORIGIN]) {
  const app = new Hono();

  app.use("*", cors({ origin: corsOrigins }));
  app.onError(errorHandler);

  app.get("/api/health", (c) => {
    return c.json(success({ status: "ok" }));
  });

  app.route("/api", authRouter);
  app.route("/api", userRouter);
  app.route("/api", orgRootRouter);
  app.route("/api", apiKeyRootRouter);

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
  app.use("*", cors({ origin: deps.corsOrigins ?? [DEFAULT_CORS_ORIGIN] }));
  app.use("*", async (c, next) => {
    c.set("db", deps.db);
    await next();
  });
  app.onError(errorHandler);

  app.get("/api/health", (c) => {
    return c.json(success({ status: "ok" }));
  });

  app.route("/api", authRouter);
  app.route("/api", userRouter);
  app.route("/api", orgRootRouter);
  app.route("/api", apiKeyRootRouter);

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
