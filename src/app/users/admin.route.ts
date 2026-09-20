import { Hono } from "hono";
import { z } from "zod";
import { success } from "../../lib/response";
import { authMiddleware } from "../../server/middleware/auth";
import { requireAbility } from "../../server/middleware/rbac";
import {
  deleteUser,
  getUserById,
  listUsers,
  updateUserAsAdmin,
} from "../../services/users/admin.service";
import { requestDataExport } from "../../services/users/dsar.service";

const adminUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "suspended", "pending_verification", "deleted"]).optional(),
  roleId: z.string().uuid().optional(),
});

const router = new Hono();

router.get("/", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const users = await listUsers(db, orgId);
  return c.json(success({ users }));
});

router.get("/:userId", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const userId = c.req.param("userId");
  const user = await getUserById(db, orgId, userId);
  return c.json(success({ user }));
});

router.patch("/:userId", authMiddleware, requireAbility("update", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = c.req.param("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = adminUpdateSchema.parse(body);
  const user = await updateUserAsAdmin(db, orgId, userId, parsed, actingUserId);
  return c.json(success({ user }));
});

router.delete("/:userId", authMiddleware, requireAbility("delete", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = c.req.param("userId");
  await deleteUser(db, orgId, userId, actingUserId);
  c.status(204);
  return c.body(null);
});

// POST /api/users/:userId/data-export — DSAR export on behalf of a member
// (NWB-P0-002). `users.create` gates this to Owner/Admin; the service
// additionally requires the actor and subject to share an active membership,
// which is the real cross-tenant guard.
router.post(
  "/:userId/data-export",
  authMiddleware,
  requireAbility("create", "users"),
  async (c) => {
    const { orgId, userId: actingUserId } = c.var.user;
    const db = c.var.db;
    const subjectUserId = c.req.param("userId");
    const result = await requestDataExport(db, {
      subjectUserId,
      requestedBy: actingUserId,
      organizationId: orgId,
      requestIp: c.req.header("x-forwarded-for") ?? undefined,
      requestUserAgent: c.req.header("user-agent") ?? undefined,
    });
    c.status(201);
    return c.json(success(result));
  },
);

export { router as adminRouter };
