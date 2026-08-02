import { Hono } from "hono";
import { z } from "zod";
import { signup } from "../../services/auth/signup";
import { ValidationError, ConflictError } from "../../lib/errors";
import { success } from "../../lib/response";

const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

  try {
    const db = c.var.db;
    const result = await signup(db, parsed.data);
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
