/**
 * Auth-domain Zod schemas — single source of truth for Hono `/api/auth/*`
 * and TanStack Start Server Functions (tanstack-start.md §4, §13).
 */

import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  industry: z
    .enum([
      "banking",
      "fintech",
      "telecom",
      "fmcg",
      "pr_agency",
      "government",
      "media",
      "technology",
      "other",
    ])
    .optional(),
  teamSize: z.string().optional(),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, { message: "You must accept the Terms of Service" }),
  privacyAccepted: z
    .boolean()
    .refine((v) => v === true, { message: "You must accept the Privacy Policy" }),
  marketingOptIn: z.boolean().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  mfaCode: z
    .string()
    .regex(
      /^(\d{6}|[A-Za-z0-9]{8})$/,
      "MFA code must be a 6-digit TOTP code or an 8-character backup code",
    )
    .optional(),
  rememberMe: z.boolean().optional().default(false),
});

export type SigninInput = z.infer<typeof signinSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").optional(),
});

export const verifyLoginSchema = z.object({
  mfaSessionId: z.string().min(1, "Challenge token is required").max(128),
  code: z
    .string()
    .regex(
      /^(\d{6}|[A-Za-z0-9]{8})$/,
      "MFA code must be a 6-digit TOTP code or an 8-character backup code",
    ),
  rememberMe: z.boolean().optional().default(false),
});

export const confirmMfaSchema = z.object({
  token: z.string().length(6, "TOTP code must be 6 digits"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(1, "Password is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const acceptInvitationBodySchema = z.object({
  password: z.string().min(1).max(128).optional(),
  fullName: z.string().min(1).max(200).optional(),
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const acceptInvitationSchema = acceptInvitationBodySchema.extend({
  token: z.string().min(1),
});

export const invitationTokenSchema = z.object({
  token: z.string().min(1),
});

export const revokeOthersSchema = z.object({
  currentSessionId: z.string().uuid().optional(),
});

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export const signoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
