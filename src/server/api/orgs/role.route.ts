import { Hono } from "hono";
import { ValidationError } from "@/lib/errors";
import { getOrgContext } from "@/lib/org-context";
import { success } from "@/lib/response";
import {
  assignRoleSchema,
  bulkInviteSchema,
  inviteMemberSchema,
  parseWithValidation,
} from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { requireOrgMatch } from "@/server/middleware/org-match";
import { requireAbility } from "@/server/middleware/rbac";
import { bulkInviteMembers, inviteMember } from "@/services/orgs/invitation.service";
import { assignRole } from "@/services/orgs/role-assignment.service";

const router = new Hono();

router.use("/orgs/:orgId/members/assign-role", authMiddleware, requireOrgMatch());
router.use("/orgs/:orgId/members/invite", authMiddleware, requireOrgMatch());
router.use("/orgs/:orgId/members/invite/bulk", authMiddleware, requireOrgMatch());

function parseJsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  return c.req.json().catch(() => {
    throw new ValidationError("Invalid JSON body");
  });
}

// POST /orgs/:orgId/members/assign-role — change a member's role. The
// hierarchy + self-protection rules live in the service (role-policy.ts).
router.post("/orgs/:orgId/members/assign-role", requireAbility("update", "members"), async (c) => {
  const { userId: actingUserId, orgId } = await getOrgContext();
  const db = c.var.db;

  const body = await parseJsonBody(c);
  const parsed = parseWithValidation(assignRoleSchema, body);

  const assignInput: Record<string, unknown> = {
    userId: parsed.userId,
    roleId: parsed.roleId,
    ...(parsed.reason ? { reason: parsed.reason } : {}),
  };
  const member = await assignRole(db, orgId, actingUserId, assignInput as any);

  return c.json(success({ member }));
});

// POST /orgs/:orgId/members/invite — invite a single member
router.post("/orgs/:orgId/members/invite", requireAbility("create", "members"), async (c) => {
  const orgId = c.req.param("orgId");
  const { userId: actingUserId } = await getOrgContext();
  const db = c.var.db;

  const body = await parseJsonBody(c);
  const parsed = parseWithValidation(inviteMemberSchema, body);

  const inviteInput: Record<string, unknown> = {
    email: parsed.email,
    ...(parsed.roleId ? { roleId: parsed.roleId } : {}),
    ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
    ...(parsed.jobTitle ? { jobTitle: parsed.jobTitle } : {}),
    ...(parsed.department ? { department: parsed.department } : {}),
    ...(parsed.invitationNote ? { invitationNote: parsed.invitationNote } : {}),
    ...(parsed.expiresInHours ? { expiresInHours: parsed.expiresInHours } : {}),
  };

  const result = await inviteMember(db, orgId, actingUserId, inviteInput as any);
  return c.json(success(result));
});

// POST /orgs/:orgId/members/invite/bulk — bulk invite from CSV rows
router.post("/orgs/:orgId/members/invite/bulk", requireAbility("create", "members"), async (c) => {
  const orgId = c.req.param("orgId");
  const { userId: actingUserId } = await getOrgContext();
  const db = c.var.db;

  const body = await parseJsonBody(c);
  const parsed = parseWithValidation(bulkInviteSchema, body);

  const result = await bulkInviteMembers(db, orgId, actingUserId, parsed.csv as any);
  return c.json(
    success({
      successes: result.successes.length,
      failures: result.failures,
    }),
  );
});

export { router as roleRouter };
