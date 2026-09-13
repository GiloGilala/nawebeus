import { Hono } from "hono";
import { z } from "zod";
import { AuthError, ValidationError } from "../../lib/errors";
import { validatePassword } from "../../lib/password";
import { success } from "../../lib/response";
import { forgotPassword, resetPassword } from "../../services/auth/password-reset";

const router = new Hono();

const forgotSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/forgot-password", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const db = c.var.db;
  // We always show the same message regardless of whether the email exists
  await forgotPassword(db, parsed.data.email, c.req.header("origin") ?? "");
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

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const { token, password } = parsed.data;

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
