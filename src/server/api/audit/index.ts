import { Hono } from "hono";
import { auditRouter } from "./audit.route";

/**
 * Same one-line wrapper shape as `../api-keys/index.ts`, so every area of `src/server/api/` is
 * imported as a directory by `src/server/index.ts` and no area is special.
 */
const auditRootRouter = new Hono();

auditRootRouter.route("/", auditRouter);

export { auditRootRouter };
