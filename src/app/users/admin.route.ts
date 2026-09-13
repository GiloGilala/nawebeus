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
  const { orgId } = c.var.user;
  const db = c.var.db;
  const userId = c.req.param("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = adminUpdateSchema.parse(body);
  const user = await updateUserAsAdmin(db, orgId, userId, parsed);
  return c.json(success({ user }));
});

router.delete("/:userId", authMiddleware, requireAbility("delete", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const userId = c.req.param("userId");
  await deleteUser(db, orgId, userId);
  c.status(204);
  return c.body(null);
});

export { router as adminRouter };
