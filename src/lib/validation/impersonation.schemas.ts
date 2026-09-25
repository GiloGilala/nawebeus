/**
 * Impersonation schemas (NWB-P1-011) — shared by `/api/users/admin/*` and Server Functions.
 *
 * `mfaCode` reuses the sign-in shape exactly (6-digit TOTP or 8-character backup code) so the
 * support step-up and the login challenge are one input contract, not two spellings of one.
 * `reason` is BR-ADMIN-008's "written justification": it goes to the target's notification
 * email and the audit row, so it has a real floor (ten characters — "fix it" is not a
 * justification) and a ceiling that fits comfortably in both.
 */

import { z } from "zod";

export const startImpersonationSchema = z.object({
  reason: z.string().trim().min(10, "A written reason is required").max(2000),
  ticketId: z.string().trim().max(100).optional(),
  durationMinutes: z
    .number()
    .int("durationMinutes must be a whole number of minutes")
    .min(5)
    .max(240)
    .optional(),
  mfaCode: z
    .string()
    .regex(
      /^(\d{6}|[A-Za-z0-9]{8})$/,
      "MFA code must be a 6-digit TOTP code or an 8-character backup code",
    )
    .optional(),
});

export type StartImpersonationInput = z.infer<typeof startImpersonationSchema>;

/** The end route takes no body; the schema exists so the route parses uniformly. */
export const endImpersonationSchema = z.object({}).passthrough();

export type EndImpersonationInput = z.infer<typeof endImpersonationSchema>;
