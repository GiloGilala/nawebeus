import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { signIn } from "../../services/auth/auth.service";
import { ValidationError } from "../../lib/errors";
import { success } from "../../lib/response";

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const router = new Hono();

router.post("/signin", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = signinSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const db = c.var.db;
  const result = await signIn(db, parsed.data);

  setCookie(c, "nawebeus_access", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 900,
  });
  setCookie(c, "nawebeus_refresh", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/api/auth",
    maxAge: 604800,
  });

  return c.json(
    success({
      user: {
        id: result.userId,
        orgId: result.orgId,
      },
    }),
  );
});

export { router as signinRouter };
