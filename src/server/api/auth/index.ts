import { Hono } from "hono";
import { invitationRouter } from "./invitation.route";
import { mfaRouter } from "./mfa.route";
import { passwordResetRouter } from "./password-reset.route";
import { refreshRouter } from "./refresh.route";
import { sessionsRouter } from "./sessions.route";
import { signinRouter } from "./signin.route";
import { signoutRouter } from "./signout.route";
import { signupRouter } from "./signup.route";
import { verificationRouter } from "./verification.route";

const authRouter = new Hono();

authRouter.route("/auth", signupRouter);
authRouter.route("/auth", signinRouter);
authRouter.route("/auth", signoutRouter);
authRouter.route("/auth", refreshRouter);
authRouter.route("/auth", verificationRouter);
authRouter.route("/auth", passwordResetRouter);
authRouter.route("/auth", mfaRouter);
authRouter.route("/auth", sessionsRouter);
authRouter.route("/auth", invitationRouter);

export { authRouter };
