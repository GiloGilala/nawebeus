import { Hono } from "hono";
import { z } from "zod";
import { sendVerificationEmail, verifyEmail } from "../../services/auth/verification";
import { ValidationError } from "../../lib/errors";
import { success } from "../../lib/response";

const router = new Hono();

const resendSchema = z.object({
  email: z.string().email("Invalid email format"),
});

router.post("/resend-verification", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const db = c.var.db;
  const origin = c.req.header("origin") ?? "";
  await sendVerificationEmail(db, parsed.data.email, origin);

  // Always return the same message to avoid email enumeration
  return c.json(
    success({
      message: "If an account with that email exists, a verification link has been sent.",
    }),
  );
});

router.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    throw new ValidationError("Token is required", [{ field: "token", message: "Token is required" }]);
  }

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
