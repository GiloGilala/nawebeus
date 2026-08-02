import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../server/middleware/auth";
import { requireAbility } from "../../server/middleware/rbac";
import { requireOrgMatch } from "../../server/middleware/org-match";
import {
  listMembers,
  getMember,
  updateMember,
  removeMember,
} from "../../services/orgs/member.service";
import { success } from "../../lib/response";

const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
});

const router = new Hono();

router.get(
  "/orgs/:orgId/members",
  authMiddleware,
  requireOrgMatch(),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const members = await listMembers(db, orgId);
    return c.json(success({ members }));
  },
);

router.get(
  "/orgs/:orgId/members/:memberId",
  authMiddleware,
  requireOrgMatch(),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const memberId = c.req.param("memberId");
    const member = await getMember(db, orgId, memberId);
    return c.json(success({ member }));
  },
);

router.patch(
  "/orgs/:orgId/members/:memberId",
  authMiddleware,
  requireOrgMatch(),
  requireAbility("update", "members"),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const memberId = c.req.param("memberId");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const parsed = updateMemberSchema.parse(body);
    const member = await updateMember(db, orgId, memberId, parsed);
    return c.json(success({ member }));
  },
);

router.delete(
  "/orgs/:orgId/members/:memberId",
  authMiddleware,
  requireOrgMatch(),
  requireAbility("delete", "members"),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const memberId = c.req.param("memberId");
    await removeMember(db, orgId, memberId);
    c.status(204);
    return c.body(null);
  },
);

export { router as memberRouter };
