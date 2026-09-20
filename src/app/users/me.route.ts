import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "../../lib/errors";
import { validatePassword } from "../../lib/password";
import { success } from "../../lib/response";
import { authMiddleware } from "../../server/middleware/auth";
import { changePassword } from "../../services/auth/auth.service";
import { confirmEmailChange, requestEmailChange } from "../../services/auth/email-change";
import {
  deleteAccount,
  getAccountDeletionStatus,
  reactivateAccount,
} from "../../services/users/account-deletion.service";
import { getExportRequest, requestDataExport } from "../../services/users/dsar.service";
import { getUser, updateUser } from "../../services/users/user.service";

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

// POST /api/users/me/data-export — DSAR: request (and, in Phase 1,
// immediately receive) a machine-readable export of the caller's personal
// data (NWB-P0-002, AC8 of FR-AUTH-007)
router.post("/me/data-export", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const result = await requestDataExport(db, {
    subjectUserId: userId,
    requestedBy: userId,
    requestIp: c.req.header("x-forwarded-for") ?? undefined,
    requestUserAgent: c.req.header("user-agent") ?? undefined,
  });
  c.status(201);
  return c.json(success(result));
});

// GET /api/users/me/data-export/:requestId — re-download a package until it
// expires (410 afterwards). Allowed for the subject or the original requester.
router.get("/me/data-export/:requestId", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const requestId = c.req.param("requestId");
  const result = await getExportRequest(db, requestId, userId);
  return c.json(success(result));
});

export { router as meRouter };
