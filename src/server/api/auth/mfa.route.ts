import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { success } from "@/lib/response";
import { confirmMfaSchema, parseWithValidation, verifyLoginSchema } from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { verifyMfaChallengeLogin } from "@/services/auth/auth.service";
import { confirmMFASetup, disableMFA, getMFAStatus, initiateMFASetup } from "@/services/auth/mfa";
import { setSessionCookies } from "./session-cookies";

const router = new Hono();

/**
 * Completes a challenged login. Public by necessity — the caller has proven the
 * password (which is what minted the challenge) but holds no session yet. The
 * challenge token itself is the unguessable credential, and attempts are
 * rate-limited per user + IP (AC8) inside the service.
 */
router.post("/mfa/verify-login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(verifyLoginSchema, body);

  const db = c.var.db;
  const ip = getClientIp(c, getConfig());

  const result = await verifyMfaChallengeLogin(db, {
    challengeToken: parsed.mfaSessionId,
    code: parsed.code,
    rememberMe: parsed.rememberMe,
    ...(ip ? { ip } : {}),
  });

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

router.get("/mfa/status", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const status = await getMFAStatus(db, userId);
  return c.json(success(status));
});

router.post("/mfa/setup", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const result = await initiateMFASetup(db, userId);
  return c.json(
    success({
      secret: result.secret,
      uri: result.uri,
      backupCodes: result.backupCodes,
    }),
  );
});

router.post("/mfa/verify-setup", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = parseWithValidation(confirmMfaSchema, body);
  await confirmMFASetup(db, userId, parsed.token);
  return c.json(success({ message: "Two-factor authentication enabled." }));
});

router.post("/mfa/disable", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  await disableMFA(db, userId);
  return c.json(success({ message: "Two-factor authentication disabled." }));
});

export { router as mfaRouter };
