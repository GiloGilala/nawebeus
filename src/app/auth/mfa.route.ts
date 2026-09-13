import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "../../lib/errors";
import { success } from "../../lib/response";
import { authMiddleware } from "../../server/middleware/auth";
import {
  confirmMFASetup,
  disableMFA,
  getMFAStatus,
  initiateMFASetup,
} from "../../services/auth/mfa";

const confirmSchema = z.object({
  token: z.string().length(6, "TOTP code must be 6 digits"),
});

const router = new Hono();

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
