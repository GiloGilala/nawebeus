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
import { bulkInviteMembers, inviteMember } from "@/services/orgs/invitation.service";
import { getMember, listMembers, removeMember, updateMember } from "@/services/orgs/member.service";
import { getOrg, listUserOrgs, updateOrg } from "@/services/orgs/org.service";
import { deleteOrganization, reactivateOrganization } from "@/services/orgs/org-deletion.service";
import { assignRole } from "@/services/orgs/role-assignment.service";
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
