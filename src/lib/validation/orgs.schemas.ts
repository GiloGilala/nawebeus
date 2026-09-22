/**
 * Organization-domain Zod schemas.
 *
 * Tenant id is NEVER in these payloads (tanstack-start.md §10.3). Hono reads
 * `:orgId` from the URL (then `requireOrgMatch`); Server Functions derive it
 * from the session. Accepting an org id from the client is a security bug.
 */

import { z } from "zod";

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export const deleteOrgSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
});

export const updateMemberByIdSchema = updateMemberSchema.extend({
  memberId: z.string().uuid(),
});

export const memberIdSchema = z.object({
  memberId: z.string().uuid(),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  reason: z.string().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid().optional(),
  displayName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  invitationNote: z.string().optional(),
  expiresInHours: z.number().int().positive().optional(),
});

export const bulkInviteSchema = z.object({
  csv: z.array(
    z.object({
      email: z.string().email(),
      roleId: z.string().uuid().optional(),
      displayName: z.string().optional(),
      department: z.string().optional(),
    }),
  ),
});
