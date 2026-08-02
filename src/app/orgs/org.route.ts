import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../server/middleware/auth";
import { requireAbility } from "../../server/middleware/rbac";
import { requireOrgMatch } from "../../server/middleware/org-match";
import { listUserOrgs, getOrg, updateOrg, isOrgMember } from "../../services/orgs/org.service";
import { success } from "../../lib/response";
import { ForbiddenError } from "../../lib/errors";

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

const router = new Hono();

router.get("/orgs", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const orgs = await listUserOrgs(db, userId);
  return c.json(success({ orgs }));
});

router.get("/orgs/:orgId", authMiddleware, requireOrgMatch(), async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const orgId = c.req.param("orgId");
  const member = await isOrgMember(db, userId, orgId);
  if (!member) throw new ForbiddenError("You are not a member of this organization");
  const org = await getOrg(db, orgId);
  return c.json(success({ org }));
});

router.patch(
  "/orgs/:orgId",
  authMiddleware,
  requireOrgMatch(),
  requireAbility("update", "organization"),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const parsed = updateOrgSchema.parse(body);
    const org = await updateOrg(db, orgId, parsed);
    return c.json(success({ org }));
  },
);

export { router as orgRouter };
