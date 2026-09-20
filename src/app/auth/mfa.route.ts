import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "../../lib/errors";
import { success } from "../../lib/response";
import { authMiddleware } from "../../server/middleware/auth";
import { verifyMfaChallengeLogin } from "../../services/auth/auth.service";
import {
  confirmMFASetup,
  disableMFA,
  getMFAStatus,
  initiateMFASetup,
} from "../../services/auth/mfa";
import { setSessionCookies } from "./session-cookies";

const confirmSchema = z.object({
  token: z.string().length(6, "TOTP code must be 6 digits"),
});

const verifyLoginSchema = z.object({
  mfaSessionId: z.string().min(1, "Challenge token is required").max(128),
  code: z
    .string()
    .regex(
      /^(\d{6}|[A-Za-z0-9]{8})$/,
      "MFA code must be a 6-digit TOTP code or an 8-character backup code",
    ),
  rememberMe: z.boolean().optional().default(false),
});

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

  const parsed = verifyLoginSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join(".") || "_root",
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const db = c.var.db;
  // Same header read as signin.route.ts. There is one canonical client-IP
  // helper coming in NWB-P0-017 (F-10); both call sites switch to it there.
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For");

  const result = await verifyMfaChallengeLogin(db, {
    challengeToken: parsed.data.mfaSessionId,
    code: parsed.data.code,
    rememberMe: parsed.data.rememberMe,
    ...(ip ? { ip } : {}),
  });

  setSessionCookies(c, {
    accessToken: result.accessToken!,
    refreshToken: result.refreshToken!,
    rememberMe: parsed.data.rememberMe,
  });

  return c.json(
    success({
      user: { id: result.userId, orgId: result.orgId },
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

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const userRows = await db.execute<{ email: string }>(
    sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const userEmail = (userRows as any).rows?.[0]?.email as string | undefined;

  await confirmMFASetup(db, userId, parsed.data.token, userEmail);
  return c.json(success({ message: "Two-factor authentication enabled." }));
});

router.post("/mfa/disable", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  await disableMFA(db, userId);
  return c.json(success({ message: "Two-factor authentication disabled." }));
});

export { router as mfaRouter };
