import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { success } from "@/lib/response";
import { parseWithValidation, signinSchema } from "@/lib/validation";
import { signIn } from "@/services/auth/auth.service";
import { setSessionCookies } from "./session-cookies";

const router = new Hono();

router.post("/signin", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(signinSchema, body);

  const db = c.var.db;
  // Null when no forwarding header carries a usable address. Deliberately left
  // undefined in that case: "unknown" is not a valid `inet` and 500s the
  // sign-in, and "0.0.0.0" would record a fabricated address.
  const ip = getClientIp(c, getConfig());

  const result = await signIn(db, parsed.email, parsed.password, {
    ...(ip ? { ip } : {}),
    rememberMe: parsed.rememberMe,
    ...(parsed.mfaCode ? { mfaCode: parsed.mfaCode } : {}),
  });

  if (result.requiresMfa) {
    // Don't set cookies yet; the client presents `mfaSessionId` plus the second
    // factor to POST /mfa/verify-login in a follow-up request.
    return c.json(
      success({
        requiresMfa: true,
        mfaMethod: result.mfaMethod,
        mfaSessionId: result.mfaSessionId,
        // Surfaced here too: the client decides whether to route to the
        // verification screen before or after the second factor, and
        // `pending_verification` accounts may hold a session (F-05).
        emailVerified: result.emailVerified ?? false,
      }),
    );
  }

  setSessionCookies(c, {
    accessToken: result.accessToken!,
    refreshToken: result.refreshToken!,
    rememberMe: parsed.rememberMe,
  });

  return c.json(
    success({
      user: {
        id: result.userId,
        orgId: result.orgId,
        emailVerified: result.emailVerified ?? false,
      },
    }),
  );
});

export { router as signinRouter };
