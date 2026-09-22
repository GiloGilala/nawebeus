import { Hono } from "hono";
import { AuthError, ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { success } from "@/lib/response";
import { forgotPasswordSchema, parseWithValidation, resetPasswordSchema } from "@/lib/validation";
import { forgotPassword, resetPassword } from "@/services/auth/password-reset";

const router = new Hono();

router.post("/forgot-password", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(forgotPasswordSchema, body);

  const db = c.var.db;
  // We always show the same message regardless of whether the email exists
  // No Origin header: the emailed link's base is server-decided (NWB-P0-021).
  await forgotPassword(db, parsed.email);
  return c.json(
    success({
      message: "If an account with that email exists, a password reset link has been sent.",
    }),
  );
});

router.post("/reset-password", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const { token, password } = parseWithValidation(resetPasswordSchema, body);

  const complexity = validatePassword(password);
  if (!complexity.valid) {
    throw new ValidationError("Password does not meet complexity requirements", [
      { field: "password", message: complexity.errors.join("; ") },
    ]);
  }

  const db = c.var.db;
  try {
    const result = await resetPassword(db, token, password);
    return c.json(
      success({
        message: "Password reset successfully.",
        email: result.email,
      }),
    );
  } catch (e) {
    if (e instanceof AuthError) {
      throw e;
    }
    throw e;
  }
});

export { router as passwordResetRouter };
