import { Hono } from "hono";
import { signupRouter } from "./signup.route";
import { signinRouter } from "./signin.route";
import { signoutRouter } from "./signout.route";
import { refreshRouter } from "./refresh.route";

const authRouter = new Hono();

authRouter.route("/auth", signupRouter);
authRouter.route("/auth", signinRouter);
authRouter.route("/auth", signoutRouter);
authRouter.route("/auth", refreshRouter);

export { authRouter };
