import { Hono } from "hono";
import { orgRouter } from "./org.route";
import { memberRouter } from "./member.route";

const orgRootRouter = new Hono();

orgRootRouter.route("/", orgRouter);
orgRootRouter.route("/", memberRouter);

export { orgRootRouter };
