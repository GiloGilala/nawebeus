import { Hono } from "hono";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { success } from "@/lib/response";
import { parseWithValidation, signupSchema } from "@/lib/validation";
import { type SignupInput, signup } from "@/services/auth/signup";

const router = new Hono();

router.post("/signup", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(signupSchema, body);

  // Enforce password complexity (BR-AUTH-020)
  const complexity = validatePassword(parsed.password, {
    username: parsed.fullName,
    email: parsed.email,
  });
  if (!complexity.valid) {
    const details = complexity.errors.map((msg) => ({
      field: "password",
      message: msg,
    }));
    throw new ValidationError("Password does not meet complexity requirements", details);
  }

  try {
    const db = c.var.db;
    const input: SignupInput = {
      email: parsed.email,
      password: parsed.password,
      fullName: parsed.fullName,
      organizationName: parsed.organizationName,
      termsAccepted: parsed.termsAccepted,
      privacyAccepted: parsed.privacyAccepted,
      ...(parsed.industry ? { industry: parsed.industry } : {}),
      ...(parsed.teamSize ? { teamSize: parsed.teamSize } : {}),
      ...(parsed.marketingOptIn !== undefined ? { marketingOptIn: parsed.marketingOptIn } : {}),
    };
    const result = await signup(db, input);
    c.status(201);
    return c.json(
      success({
        user: result.user,
        organization: result.organization,
      }),
    );
  } catch (e) {
    if (e instanceof ConflictError) {
      c.status(409);
      return c.json({
        error: { code: "CONFLICT", message: e.message },
      });
    }
    throw e;
  }
});

export { router as signupRouter };
