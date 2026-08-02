import { Hono } from "hono";
import { meRouter } from "./me.route";
import { adminRouter } from "./admin.route";

const userRouter = new Hono();

userRouter.route("/users", meRouter);
userRouter.route("/users", adminRouter);

export { userRouter };
