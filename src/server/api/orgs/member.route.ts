import { Hono } from "hono";
import { getOrgContext } from "@/lib/org-context";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { parseWithValidation, updateMemberSchema } from "@/lib/validation";
import { uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireOrgMatch } from "@/server/middleware/org-match";
import { requireAbility } from "@/server/middleware/rbac";
import { getMember, listMembers, removeMember, updateMember } from "@/services/orgs/member.service";

const router = new Hono();

router.get("/orgs/:orgId/members", authMiddleware, requireOrgMatch(), async (c) => {
  const db = c.var.db;
  const orgId = c.req.param("orgId");
  const page = parsePagination(new URL(c.req.url));
  const { items: members, pageInfo } = await listMembers(db, orgId, page);
  return c.json(success({ members }, paginationMeta(pageInfo)));
});

router.get("/orgs/:orgId/members/:memberId", authMiddleware, requireOrgMatch(), async (c) => {
  const db = c.var.db;
  const orgId = c.req.param("orgId");
  const memberId = uuidParam(c, "memberId", "member id");
  const member = await getMember(db, orgId, memberId);
  return c.json(success({ member }));
});

router.patch(
  "/orgs/:orgId/members/:memberId",
  authMiddleware,
  requireOrgMatch(),
  requireAbility("update", "members"),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const memberId = uuidParam(c, "memberId", "member id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const parsed = parseWithValidation(updateMemberSchema, body);
    const { userId: actingUserId } = await getOrgContext();
    const member = await updateMember(db, orgId, memberId, parsed, actingUserId);
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
    const memberId = uuidParam(c, "memberId", "member id");
    const { userId: actingUserId } = await getOrgContext();
    await removeMember(db, orgId, memberId, actingUserId);
    c.status(204);
    return c.body(null);
  },
);

export { router as memberRouter };
