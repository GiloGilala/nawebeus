import { Hono } from "hono";
import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { success } from "@/lib/response";
import { authMiddleware, authMiddlewareAllowingInactiveMembership } from "@/server/middleware/auth";
import { requireOrgMatch } from "@/server/middleware/org-match";
import { requireAbility } from "@/server/middleware/rbac";
import { getOrg, isOrgMember, listUserOrgs, updateOrg } from "@/services/orgs/org.service";
import { deleteOrganization, reactivateOrganization } from "@/services/orgs/org-deletion.service";

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
  // Subject is "org", not "organization": ability subjects derive from the
  // permission_string prefix (seed: org.read/org.update/org.delete), and all
  // other routes use the compact prefix convention (members, users, apikeys).
  // The old "organization" subject matched no rule, so this route 403'd for
  // every user (F-02).
  requireAbility("update", "org"),
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

const deleteOrgSchema = z.object({
  reason: z.string().max(2000).optional(),
});

// DELETE /orgs/:orgId — soft delete, 30-day grace (PRD 8.2.1, NWB-P0-023).
//
// Two gates, deliberately both: `requireAbility("delete", "org")` is the
// permission check (the seed grants `org.delete` to owner and super_admin
// only), and the service re-checks `organizations.owner_id` against the caller.
// The ability answers "may this role ever delete an organization"; the service
// answers "is this the owner of *this* one" — a super_admin's blanket grant
// must not let them delete a tenant they do not own.
router.delete(
  "/orgs/:orgId",
  authMiddleware,
  requireOrgMatch(),
  requireAbility("delete", "org"),
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const { userId } = c.var.user;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const parsed = deleteOrgSchema.parse(body);
    const result = await deleteOrganization(db, orgId, userId, parsed);
    return c.json(success({ organization: { id: orgId, ...result } }));
  },
);

// POST /orgs/:orgId/reactivate — undo within the grace window.
//
// `requireOrgMatch` still applies: the JWT of a member of the deleted org still
// carries its orgId, so the owner can reach this route. What they cannot do is
// reach any *other* route — `assertActivePrincipal` rejects them, because
// deletion suspended every membership. That asymmetry is the point: exactly one
// door stays open, and it is the one that undoes the deletion.
router.post(
  "/orgs/:orgId/reactivate",
  // Not the standard `authMiddleware`: deleting the organization suspended the
  // owner's own membership, so the usual active-membership check would 403 the
  // only person who can undo it. See the comment on
  // `authMiddlewareAllowingInactiveMembership`.
  authMiddlewareAllowingInactiveMembership,
  requireOrgMatch(),
  // No `requireAbility` here, deliberately. `loadAbility` builds rules from
  // *active* memberships only (that query is the org-scoping mechanism —
  // NWB-P0-018), and deletion suspended every membership, so a deleted
  // organization yields an empty ability by construction and this gate could
  // only ever 403. Relaxing `loadAbility` to fix that would weaken tenant
  // scoping everywhere to serve one route. Authorization here is the service's
  // `organizations.owner_id` check, which is the actual source of truth for
  // ownership under DEC-039 — strictly narrower than `org.delete`, which
  // super_admin also holds.
  async (c) => {
    const db = c.var.db;
    const orgId = c.req.param("orgId");
    const { userId } = c.var.user;
    await reactivateOrganization(db, orgId, userId);
    const org = await getOrg(db, orgId);
    return c.json(success({ org }));
  },
);

export { router as orgRouter };
