import { Hono } from "hono";
import { cors } from "hono/cors";
import { success } from "../lib/response";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "../app/auth";
import { userRouter } from "../app/users";
import { orgRootRouter } from "../app/orgs";

export function createApp() {
  const app = new Hono();

  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/api/health", (c) => {
    return c.json(success({ status: "ok" }));
  });

  app.route("/api", authRouter);
  app.route("/api", userRouter);
  app.route("/api", orgRootRouter);

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

export function createAppWithDb(deps: { db: import("../lib/db").Db }) {
  const app = new Hono();

  app.use("*", cors());
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
