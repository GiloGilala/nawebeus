import { Hono } from "hono";
import { adminRouter } from "./admin.route";
import { meRouter } from "./me.route";

const userRouter = new Hono();

userRouter.route("/users", meRouter);
userRouter.route("/users", adminRouter);

export { userRouter };
