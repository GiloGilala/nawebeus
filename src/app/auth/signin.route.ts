import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { signIn } from "../../services/auth/auth.service";
import { ValidationError } from "../../lib/errors";
import { success } from "../../lib/response";

const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  mfaCode: z.string().length(6, "MFA code must be 6 digits").optional(),
  rememberMe: z.boolean().optional().default(false),
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
      field: i.path.join(".") || "_root",
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const db = c.var.db;
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";

  const result = await signIn(db, parsed.data.email, parsed.data.password, {
    ip,
    rememberMe: parsed.data.rememberMe,
    ...(parsed.data.mfaCode ? { mfaCode: parsed.data.mfaCode } : {}),
  });

  if (result.requiresMfa) {
    // Don't set cookies yet; client must submit MFA code in a follow-up request
    return c.json(
      success({ requiresMfa: true, mfaMethod: result.mfaMethod, sessionId: result.sessionId }),
    );
  }

  setCookie(c, "nawebeus_access", result.accessToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 900,
  });

  // Refresh TTL: 7 days normal, 30 days with remember-me
  const refreshMaxAge = parsed.data.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  setCookie(c, "nawebeus_refresh", result.refreshToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/api/auth",
    maxAge: refreshMaxAge,
    partitioned: true,
  });

  return c.json(
    success({
      user: { id: result.userId, orgId: result.orgId },
    }),
  );
});

export { router as signinRouter };
