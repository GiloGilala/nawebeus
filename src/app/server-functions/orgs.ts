/**
 * TanStack Start Server Functions — Organization domain
 *
 * Direct in-process calls to `src/services/orgs/*`. Every handler validates
 * with Zod, checks auth via `getServerAuth()`, scopes via `withServerOrgContext`,
 * and checks CASL via `assertServerAbility` — mirroring Hono middleware
 * `authMiddleware + requireOrgMatch + requireAbility` but without an HTTP hop.
 */

import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { bulkInviteMembers, inviteMember } from "@/services/orgs/invitation.service";
import { getMember, listMembers, removeMember, updateMember } from "@/services/orgs/member.service";
import { getOrg, isOrgMember, listUserOrgs, updateOrg } from "@/services/orgs/org.service";
import { assignRole } from "@/services/orgs/role-assignment.service";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

const updateOrgSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  name: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

const updateMemberSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  roleId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
});

const assignRoleSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  reason: z.string().optional(),
});

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().uuid().optional(),
  displayName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  invitationNote: z.string().optional(),
  expiresInHours: z.number().int().positive().optional(),
});

const bulkInviteSchema = z.object({
  orgId: z.string().min(1),
  csv: z.array(
    z.object({
      email: z.string().email(),
      roleId: z.string().uuid().optional(),
      displayName: z.string().optional(),
      department: z.string().optional(),
    }),
  ),
});

export const listOrgsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const orgs = await withServerOrgContext(auth, () => listUserOrgs(db, auth.userId));
  return { orgs };
});

export const getOrgServerFn = createServerFn({ method: "GET" })
  .validator(z.object({ orgId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    const db = getServerDb();
    const member = await isOrgMember(db, auth.userId, data.orgId);
    if (!member) throw new ValidationError("You are not a member of this organization");
    const org = await withServerOrgContext(auth, () => getOrg(db, data.orgId));
    return { org };
  });

export const updateOrgServerFn = createServerFn({ method: "POST" })
  .validator(updateOrgSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "update", "org");
    const db = getServerDb();
    const org = await withServerOrgContext(auth, () =>
      updateOrg(db, data.orgId, {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      }),
    );
    return { org };
  });

export const listMembersServerFn = createServerFn({ method: "GET" })
  .validator(z.object({ orgId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    const db = getServerDb();
    const members = await withServerOrgContext(auth, () => listMembers(db, data.orgId));
    return { members };
  });

export const getMemberServerFn = createServerFn({ method: "GET" })
  .validator(z.object({ orgId: z.string().min(1), memberId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () => getMember(db, data.orgId, data.memberId));
    return { member };
  });

export const updateMemberServerFn = createServerFn({ method: "POST" })
  .validator(updateMemberSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "update", "members");
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () =>
      updateMember(
        db,
        data.orgId,
        data.memberId,
        {
          ...(data.roleId ? { roleId: data.roleId } : {}),
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.jobTitle ? { jobTitle: data.jobTitle } : {}),
          ...(data.department ? { department: data.department } : {}),
        },
        auth.userId,
      ),
    );
    return { member };
  });

export const removeMemberServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ orgId: z.string().min(1), memberId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "delete", "members");
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      removeMember(db, data.orgId, data.memberId, auth.userId),
    );
    return { removed: true as const };
  });

export const assignRoleServerFn = createServerFn({ method: "POST" })
  .validator(assignRoleSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "update", "members");
    const db = getServerDb();
    const member = await withServerOrgContext(auth, () =>
      assignRole(db, data.orgId, auth.userId, {
        userId: data.userId,
        roleId: data.roleId,
        ...(data.reason ? { reason: data.reason } : {}),
      } as never),
    );
    return { member };
  });

export const inviteMemberServerFn = createServerFn({ method: "POST" })
  .validator(inviteSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "create", "members");
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      inviteMember(db, data.orgId, auth.userId, {
        email: data.email,
        ...(data.roleId ? { roleId: data.roleId } : {}),
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.jobTitle ? { jobTitle: data.jobTitle } : {}),
        ...(data.department ? { department: data.department } : {}),
        ...(data.invitationNote ? { invitationNote: data.invitationNote } : {}),
        ...(data.expiresInHours ? { expiresInHours: data.expiresInHours } : {}),
      } as never),
    );
    return result;
  });

export const bulkInviteServerFn = createServerFn({ method: "POST" })
  .validator(bulkInviteSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    if (data.orgId !== auth.orgId)
      throw new ValidationError("You do not have access to this organization");
    assertServerAbility(auth, "create", "members");
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      bulkInviteMembers(db, data.orgId, auth.userId, data.csv as never),
    );
    return { successes: result.successes.length, failures: result.failures };
  });
