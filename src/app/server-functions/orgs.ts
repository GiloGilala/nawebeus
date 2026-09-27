/**
 * TanStack Start Server Functions — Organization domain
 *
 * Thin adapters: validate with the shared Zod schemas, derive org id from the
 * session (never the payload — tanstack-start.md §10.3), check CASL, delegate.
 */

import {
  assignRoleSchema,
  bulkInviteSchema,
  deleteOrgSchema,
  inviteMemberSchema,
  memberIdSchema,
  updateMemberByIdSchema,
  updateOrgSchema,
} from "@/lib/validation";
import {
  bulkInviteMembers,
  inviteMember,
  listPendingInvitations,
} from "@/services/orgs/invitation.service";
import { getMember, listMembers, removeMember, updateMember } from "@/services/orgs/member.service";
import { getOrg, listUserOrgs, updateOrg } from "@/services/orgs/org.service";
import { deleteOrganization, reactivateOrganization } from "@/services/orgs/org-deletion.service";
import { assignRole } from "@/services/orgs/role-assignment.service";
import { listAssignableRoles } from "@/services/orgs/role-policy";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

export const listOrgsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const orgs = await withServerOrgContext(auth, () => listUserOrgs(db, auth.userId));
  return { orgs };
});

export const getOrgServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const org = await withServerOrgContext(auth, () => getOrg(db, auth.orgId));
  return { org };
});

export const updateOrgServerFn = createServerFn({ method: "POST" })
  .validator(updateOrgSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof updateOrgSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "org");
    const db = getServerDb();
    const org = await withServerOrgContext(auth, () =>
      updateOrg(db, auth.orgId, {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.logoUrl !== undefined ? { logoUrl: parsed.logoUrl } : {}),
      }),
    );
    return { org };
  });

export const deleteOrgServerFn = createServerFn({ method: "POST" })
  .validator(deleteOrgSchema)
  .handler(async ({ data }) => {
    const parsed = data as { reason?: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "org");
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      deleteOrganization(db, auth.orgId, auth.userId, parsed),
    );
    return { organization: { id: auth.orgId, ...result } };
  });

export const reactivateOrgServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth(undefined, { requireActiveMembership: false });
  const db = getServerDb();
  await withServerOrgContext(auth, () => reactivateOrganization(db, auth.orgId, auth.userId));
  const org = await getOrg(db, auth.orgId);
  return { org };
});

export const listMembersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const members = (await withServerOrgContext(auth, () => listMembers(db, auth.orgId))).items;
  return { members };
});

export const getMemberServerFn = createServerFn({ method: "GET" })
  .validator(memberIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { memberId: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () =>
      getMember(db, auth.orgId, parsed.memberId),
    );
    return { member };
  });

export const updateMemberServerFn = createServerFn({ method: "POST" })
  .validator(updateMemberByIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof updateMemberByIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "members");
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () =>
      updateMember(
        db,
        auth.orgId,
        parsed.memberId,
        {
          ...(parsed.roleId ? { roleId: parsed.roleId } : {}),
          ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
          ...(parsed.jobTitle ? { jobTitle: parsed.jobTitle } : {}),
          ...(parsed.department ? { department: parsed.department } : {}),
        },
        auth.userId,
      ),
    );
    return { member };
  });

export const removeMemberServerFn = createServerFn({ method: "POST" })
  .validator(memberIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { memberId: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "members");
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      removeMember(db, auth.orgId, parsed.memberId, auth.userId),
    );
    return { removed: true as const };
  });

export const assignRoleServerFn = createServerFn({ method: "POST" })
  .validator(assignRoleSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof assignRoleSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "members");
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () =>
      assignRole(db, auth.orgId, auth.userId, {
        userId: parsed.userId,
        roleId: parsed.roleId,
        ...(parsed.reason ? { reason: parsed.reason } : {}),
      } as never),
    );
    return { member };
  });

export const inviteMemberServerFn = createServerFn({ method: "POST" })
  .validator(inviteMemberSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof inviteMemberSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "members");
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      inviteMember(db, auth.orgId, auth.userId, {
        email: parsed.email,
        ...(parsed.roleId ? { roleId: parsed.roleId } : {}),
        ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
        ...(parsed.jobTitle ? { jobTitle: parsed.jobTitle } : {}),
        ...(parsed.department ? { department: parsed.department } : {}),
        ...(parsed.invitationNote ? { invitationNote: parsed.invitationNote } : {}),
        ...(parsed.expiresInHours ? { expiresInHours: parsed.expiresInHours } : {}),
      } as never),
    );
    return result;
  });

export const bulkInviteServerFn = createServerFn({ method: "POST" })
  .validator(bulkInviteSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof bulkInviteSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "members");
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      bulkInviteMembers(db, auth.orgId, auth.userId, parsed.csv as never),
    );
    return { successes: result.successes.length, failures: result.failures };
  });

/**
 * The outstanding invitations for this organization (NWB-P14.2) — the team screen's "awaiting
 * acceptance" panel: who was invited, to which role, when it expires, and whether it has already
 * lapsed (`expired`, still listed because the fix is the same resend button).
 *
 * Gated on `members.read` (manager+ in the seeded matrix), which is **stricter than
 * `listMembersServerFn` above** — that one asserts no ability at all, mirroring a Hono route that
 * also asserts none. The asymmetry is deliberate and recorded rather than accidental: an invitation
 * carries an emailed address and a live token lifetime, its only consumer is the invite panel, and
 * nobody who cannot invite needs it. Tightening the members list to match is a security-model
 * decision that belongs in its own ticket, not in a web cluster (finding F-P14.2-1).
 *
 * Never carries a token, plaintext or hashed — see `listPendingInvitations`.
 */
export const listPendingInvitationsServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "members");
    const db = getServerDb();
    const invitations = await withServerOrgContext(auth, () =>
      listPendingInvitations(db, auth.orgId),
    );
    return { invitations };
  },
);

/**
 * The roles this seat may grant (NWB-P14.2) — DEC-039's ladder evaluated as a query.
 *
 * The invite form and the role picker both need a role *id*, and until now nothing answered "which
 * ids are assignable?": `resolveAssignableRole` only says whether one you already have is. Without
 * a catalog a UI either hard-codes the seeded ids (the F-02 lesson — never re-spell authorization
 * data in the client) or offers all six and lets the service refuse most of them, which reads as a
 * bug to whoever clicked. So the list comes back already filtered to strictly-below-the-actor,
 * `owner` excluded (BR-AUTH-031: ownership is transferred, not granted), and `actor` rides along so
 * the screen can explain a short list instead of rendering an empty one.
 *
 * `roles.read` is manager+ in the seeded matrix — the same seats that hold `members.create`, so
 * whoever can open the invite form can populate its picker, and nobody else needs to.
 */
export const listAssignableRolesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "roles");
  const db = getServerDb();
  return withServerOrgContext(auth, () => listAssignableRoles(db, auth.orgId, auth.userId));
});
