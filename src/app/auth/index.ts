import { Hono } from "hono";
import { signupRouter } from "./signup.route";
import { signinRouter } from "./signin.route";
import { signoutRouter } from "./signout.route";
import { refreshRouter } from "./refresh.route";
import { verificationRouter } from "./verification.route";
import { passwordResetRouter } from "./password-reset.route";
import { mfaRouter } from "./mfa.route";
import { sessionsRouter } from "./sessions.route";

const authRouter = new Hono();

authRouter.route("/auth", signupRouter);
authRouter.route("/auth", signinRouter);
authRouter.route("/auth", signoutRouter);
authRouter.route("/auth", refreshRouter);
authRouter.route("/auth", verificationRouter);
authRouter.route("/auth", passwordResetRouter);
authRouter.route("/auth", mfaRouter);
authRouter.route("/auth", sessionsRouter);

export { authRouter };
