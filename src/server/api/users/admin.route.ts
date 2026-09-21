import { Hono } from "hono";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  deleteUser,
  getUserById,
  listUsers,
  updateUserAsAdmin,
} from "@/services/users/admin.service";
import { requestDataExport } from "@/services/users/dsar.service";

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
  const page = parsePagination(new URL(c.req.url));
  const { items: users, pageInfo } = await listUsers(db, orgId, page);
  return c.json(success({ users }, paginationMeta(pageInfo)));
});

router.get("/:userId", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  const user = await getUserById(db, orgId, userId);
  return c.json(success({ user }));
});

router.patch("/:userId", authMiddleware, requireAbility("update", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
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
  const userId = uuidParam(c, "userId", "user id");
  await deleteUser(db, orgId, userId, actingUserId);
  c.status(204);
  return c.body(null);
});

// POST /api/users/:userId/data-export — file a DSAR export on a member's
// behalf (the DSAR ops channel). Org-scoped: getUserById answers 404 for a
// cross-tenant id and nothing is created. The response carries only the
// receipt — the payload is the subject's data and is delivered in their own
// channel (GET /api/users/me/data-export/:requestId), never here.
router.post("/:userId/data-export", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  await getUserById(db, orgId, userId);
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  const receipt = await requestDataExport(db, {
    userId,
    requestedBy: actingUserId,
    organizationId: orgId,
    ...(ip ? { actorIp: ip } : {}),
    ...(userAgent ? { actorUserAgent: userAgent } : {}),
  });
  return c.json(success(receipt), 201);
});

export { router as adminRouter };
