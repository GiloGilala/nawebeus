import { Hono } from "hono";
import { memberRouter } from "./member.route";
import { orgRouter } from "./org.route";
import { roleRouter } from "./role.route";

const orgRootRouter = new Hono();

orgRootRouter.route("/", orgRouter);
orgRootRouter.route("/", memberRouter);
orgRootRouter.route("/", roleRouter);

export { orgRootRouter };
