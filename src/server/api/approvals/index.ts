import { Hono } from "hono";
import { approvalsRouter } from "./approval.route";

const approvalRootRouter = new Hono();

approvalRootRouter.route("/", approvalsRouter);

export { approvalRootRouter };
