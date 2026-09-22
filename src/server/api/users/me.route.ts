import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { RateLimitError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { validatePassword } from "@/lib/password";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success } from "@/lib/response";
import {
  changePasswordSchema,
  deleteAccountSchema,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  parseWithValidation,
  updateMeSchema,
} from "@/lib/validation";
import { uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { changePassword } from "@/services/auth/auth.service";
import { confirmEmailChange, requestEmailChange } from "@/services/auth/email-change";
import {
  deleteAccount,
  getAccountDeletionStatus,
  reactivateAccount,
} from "@/services/users/account-deletion.service";
import { getDataExport, requestDataExport } from "@/services/users/dsar.service";
import { getUser, updateUser } from "@/services/users/user.service";

const router = new Hono();

router.get("/me", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const user = await getUser(db, userId);
  const deletionStatus = await getAccountDeletionStatus(db, userId);
  return c.json(success({ user, deletionStatus }));
});

router.patch("/me", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = parseWithValidation(updateMeSchema, body);
  const user = await updateUser(db, userId, parsed);
  return c.json(success({ user }));
});

// POST /api/users/me/change-password
router.post("/me/change-password", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  const parsed = parseWithValidation(changePasswordSchema, body);

  // Enforce password complexity
  const complexity = validatePassword(parsed.newPassword, { email: "" });
  if (!complexity.valid) {
    throw new ValidationError(
      "New password does not meet complexity requirements",
      complexity.errors.map((msg) => ({ field: "newPassword", message: msg })),
    );
  }

  await changePassword(db, userId, parsed.currentPassword, parsed.newPassword);
  return c.json(success({ changed: true }));
});

// DELETE /api/users/me — soft-delete with 30-day grace
router.delete("/me", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = parseWithValidation(deleteAccountSchema, body);

  const result = await deleteAccount(
    db,
    userId,
    parsed.reason ? { reason: parsed.reason } : undefined,
  );
  return c.json(success({ scheduledDeletionAt: result.scheduledDeletionAt }));
});

// POST /api/users/me/reactivate — restore within grace period
router.post("/me/reactivate", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  await reactivateAccount(db, userId);
  return c.json(success({ reactivated: true }));
});

// POST /api/users/me/email-change — request an email change
router.post("/me/email-change", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  const parsed = parseWithValidation(emailChangeRequestSchema, body);
  const result = await requestEmailChange(db, userId, {
    newEmail: parsed.newEmail,
  });
  return c.json(success(result));
});

// POST /api/users/me/email-change/confirm — confirm with token
router.post("/me/email-change/confirm", async (c) => {
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  const parsed = parseWithValidation(emailChangeConfirmSchema, body);
  const result = await confirmEmailChange(db, { token: parsed.token });
  return c.json(success(result));
});

// ── NDPR DSAR data export (NWB-P0-002, FR-AUTH-007 AC8) ─────────────────────
// Self-service only: the subject creates the export here and reads it back on
// the request id within a 7-day window. Admins can file on a subject's behalf
// via POST /api/users/:userId/data-export but never see the payload.

// POST /api/users/me/data-export — build the export synchronously.
router.post("/me/data-export", authMiddleware, async (c) => {
  const { userId, orgId } = c.var.user;
  const db = c.var.db;
  const dsar = RATE_LIMITS.dsarPerDay;
  if (await checkRateLimit(db, `dsar:req:${userId}`, dsar.max, dsar.windowMs)) {
    throw new RateLimitError(
      "Data export is limited to 5 requests per day.",
      Math.ceil(dsar.windowMs / 1000),
    );
  }
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  const receipt = await requestDataExport(db, {
    userId,
    organizationId: orgId,
    ...(ip ? { actorIp: ip } : {}),
    ...(userAgent ? { actorUserAgent: userAgent } : {}),
  });
  return c.json(success(receipt), 201);
});

// GET /api/users/me/data-export/:requestId — read back within the window;
// expired answers 410, unknown or another subject's id answers 404.
router.get("/me/data-export/:requestId", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const payload = await getDataExport(db, userId, uuidParam(c, "requestId", "export request id"));
  return c.json(success(payload));
});

export { router as meRouter };
