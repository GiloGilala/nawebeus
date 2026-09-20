import { Hono } from "hono";
import { apiKeysRouter } from "./api-keys.route";

const apiKeyRootRouter = new Hono();

apiKeyRootRouter.route("/", apiKeysRouter);

export { apiKeyRootRouter };
