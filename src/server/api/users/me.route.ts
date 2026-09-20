import { Hono } from "hono";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { RateLimitError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { success } from "@/lib/response";
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

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  profileImage: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().max(500).optional(),
  jobTitle: z.string().max(100).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

const emailChangeRequestSchema = z.object({
  newEmail: z.string().email(),
});

const emailChangeConfirmSchema = z.object({
  token: z.string(),
});

const deleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmText: z.string().refine((v) => v === "DELETE", {
    message: 'Type "DELETE" to confirm',
  }),
});

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
  const parsed = updateMeSchema.parse(body);
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
  const parsed = changePasswordSchema.parse(body);

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
  const parsed = deleteAccountSchema.parse(body);

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
  const parsed = emailChangeRequestSchema.parse(body);
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
  const parsed = emailChangeConfirmSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join(".") || "_root",
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }
  const result = await confirmEmailChange(db, { token: parsed.data.token });
  return c.json(success(result));
});

// ── NDPR DSAR data export (NWB-P0-002, FR-AUTH-007 AC8) ─────────────────────
// Self-service only: the subject creates the export here and reads it back on
// the request id within a 7-day window. Admins can file on a subject's behalf
// via POST /api/users/:userId/data-export but never see the payload.

/** Data-portability requests a user may open per day. Generous for the
 *  subject, tight enough that a stolen session can't exfiltrate repeatedly. */
const DSAR_REQUEST_MAX = 5;
/** Fixed window for the above — calendar day rounded to UTC. */
const DSAR_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

// POST /api/users/me/data-export — build the export synchronously.
router.post("/me/data-export", authMiddleware, async (c) => {
  const { userId, orgId } = c.var.user;
  const db = c.var.db;
  if (await checkRateLimit(db, `dsar:req:${userId}`, DSAR_REQUEST_MAX, DSAR_REQUEST_WINDOW_MS)) {
    throw new RateLimitError(
      "Data export is limited to 5 requests per day.",
      Math.ceil(DSAR_REQUEST_WINDOW_MS / 1000),
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
