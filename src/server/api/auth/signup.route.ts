import { Hono } from "hono";
import { z } from "zod";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { success } from "@/lib/response";
import { type SignupInput, signup } from "@/services/auth/signup";

const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  industry: z
    .enum([
      "banking",
      "fintech",
      "telecom",
      "fmcg",
      "pr_agency",
      "government",
      "media",
      "technology",
      "other",
    ])
    .optional(),
  teamSize: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the Terms of Service",
  }),
  privacyAccepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the Privacy Policy",
  }),
  marketingOptIn: z.boolean().optional(),
});

const router = new Hono();

router.post("/signup", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  // Enforce password complexity (BR-AUTH-020)
  const complexity = validatePassword(parsed.data.password, {
    username: parsed.data.fullName,
    email: parsed.data.email,
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
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      organizationName: parsed.data.organizationName,
      termsAccepted: parsed.data.termsAccepted,
      privacyAccepted: parsed.data.privacyAccepted,
      ...(parsed.data.industry ? { industry: parsed.data.industry } : {}),
      ...(parsed.data.teamSize ? { teamSize: parsed.data.teamSize } : {}),
      ...(parsed.data.marketingOptIn !== undefined
        ? { marketingOptIn: parsed.data.marketingOptIn }
        : {}),
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
