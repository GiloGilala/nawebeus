/**
 * Users-domain Zod schemas — shared by `/api/users/*` and Server Functions.
 */

import { z } from "zod";

export const updateMeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  profileImage: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().max(500).optional(),
  jobTitle: z.string().max(100).optional(),
});

export const adminUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "suspended", "pending_verification", "deleted"]).optional(),
  roleId: z.string().uuid().optional(),
});

export const adminUpdateByIdSchema = adminUpdateSchema.extend({
  userId: z.string().min(1),
});

export const userIdSchema = z.object({
  userId: z.string().min(1),
});

export const emailChangeRequestSchema = z.object({
  newEmail: z.string().email(),
});

export const emailChangeConfirmSchema = z.object({
  token: z.string().min(1),
});

export const deleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmText: z.string().refine((v) => v === "DELETE", {
    message: 'Type "DELETE" to confirm',
  }),
});

export const dataExportIdSchema = z.object({
  requestId: z.string().uuid(),
});
