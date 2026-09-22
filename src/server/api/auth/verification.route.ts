import { Hono } from "hono";
import { ValidationError } from "@/lib/errors";
import { success } from "@/lib/response";
import { parseWithValidation, resendVerificationSchema, verifyEmailSchema } from "@/lib/validation";
import { sendVerificationEmail, verifyEmail } from "@/services/auth/verification";

const router = new Hono();

router.post("/resend-verification", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(resendVerificationSchema, body);

  const db = c.var.db;
  // No Origin header: the emailed link's base is server-decided (NWB-P0-021).
  await sendVerificationEmail(db, parsed.email);

  // Always return the same message to avoid email enumeration
  return c.json(
    success({
      message: "If an account with that email exists, a verification link has been sent.",
    }),
  );
});

router.get("/verify-email", async (c) => {
  const { token } = parseWithValidation(verifyEmailSchema, { token: c.req.query("token") });

  const db = c.var.db;
  const result = await verifyEmail(db, token);

  return c.json(
    success({
      userId: result.userId,
      email: result.email,
      message: "Email verified successfully.",
    }),
  );
});

export { router as verificationRouter };
