/**
 * TanStack Start Server Functions — Auth domain
 *
 * ADR-002 / Principle 3 (Direct Calls): the web app calls business logic
 * in-process via Server Functions, not via HTTP to `/api/*`. Hono at
 * `/api/*` remains for mobile / webhooks / third-party. Both entry points
 * share `src/services/*` and enforce the same Zod validation.
 *
 * Each export is a `createServerFn({ method }) .validator(zodSchema) .handler`
 * that validates at the boundary and throws typed `AppError`s. The handler
 * calls the framework-agnostic service directly — no `fetch`, no HTTP hop.
 *
 * @see docs/technical/ADRs.md#adr-002
 * @see docs/technical/Architecture.md#5.1
 * @see docs/technical/Engineering%20Standards.md#4.4
 */

import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import {
  changePassword,
  refreshSession,
  signIn,
  signOut,
  verifyMfaChallengeLogin,
} from "@/services/auth/auth.service";
import { confirmMFASetup, disableMFA, getMFAStatus, initiateMFASetup } from "@/services/auth/mfa";
import { forgotPassword, resetPassword } from "@/services/auth/password-reset";
import { getSessionDetail, listUserSessions, revokeSession } from "@/services/auth/session";
import { signup } from "@/services/auth/signup";
import { sendVerificationEmail, verifyEmail } from "@/services/auth/verification";
import { createServerFn } from "../lib/createServerFn";
import { getServerAuth, getServerDb, setServerAuthCookies, withServerOrgContext } from "./helpers";

// ---------------------------------------------------------------------------
// Schemas — shared with Hono routes and `services/` input validation.
// The docs require the same Zod schema at every boundary (Engineering Standards §4.4).
// ---------------------------------------------------------------------------

const signupSchema = z.object({
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

const signinSchema = z.object({
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
  // Injected by the caller when available (SSR loader can pass `x-forwarded-for`)
  ip: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const verifyLoginSchema = z.object({
  mfaSessionId: z.string().min(1, "Challenge token is required").max(128),
  code: z
    .string()
    .regex(
      /^(\d{6}|[A-Za-z0-9]{8})$/,
      "MFA code must be a 6-digit TOTP code or an 8-character backup code",
    ),
  rememberMe: z.boolean().optional().default(false),
  ip: z.string().optional(),
});

const confirmMFASchema = z.object({
  token: z.string().length(6, "TOTP code must be 6 digits"),
});

const forgotSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(1, "Password is required"),
});

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ---------------------------------------------------------------------------
// Public Server Functions — no session required
// ---------------------------------------------------------------------------

export const signupServerFn = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    const complexity = validatePassword(data.password, {
      username: data.fullName,
      email: data.email,
    });
    if (!complexity.valid) {
      throw new ValidationError(
        "Password does not meet complexity requirements",
        complexity.errors.map((msg) => ({ field: "password", message: msg })),
      );
    }
    const db = getServerDb();
    const result = await signup(db, {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      organizationName: data.organizationName,
      termsAccepted: data.termsAccepted,
      privacyAccepted: data.privacyAccepted,
      ...(data.industry ? { industry: data.industry } : {}),
      ...(data.teamSize ? { teamSize: data.teamSize } : {}),
      ...(data.marketingOptIn !== undefined ? { marketingOptIn: data.marketingOptIn } : {}),
    });
    return { user: result.user, organization: result.organization };
  });

export const signinServerFn = createServerFn({ method: "POST" })
  .validator(signinSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    const result = await signIn(db, data.email, data.password, {
      ...(data.ip ? { ip: data.ip } : {}),
      rememberMe: data.rememberMe,
      ...(data.mfaCode ? { mfaCode: data.mfaCode } : {}),
    });

    if (result.requiresMfa) {
      return {
        requiresMfa: true as const,
        mfaMethod: result.mfaMethod,
        mfaSessionId: result.mfaSessionId,
        emailVerified: result.emailVerified ?? false,
      };
    }

    // Mint cookies for the browser; also return tokens so a non-browser
    // caller (e.g. a test) can assert on them without inspecting headers.
    setServerAuthCookies({
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      rememberMe: data.rememberMe,
    });

    return {
      requiresMfa: false as const,
      user: {
        id: result.userId,
        orgId: result.orgId,
        emailVerified: result.emailVerified ?? false,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  });

export const verifyMfaLoginServerFn = createServerFn({ method: "POST" })
  .validator(verifyLoginSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    const result = await verifyMfaChallengeLogin(db, {
      challengeToken: data.mfaSessionId,
      code: data.code,
      rememberMe: data.rememberMe,
      ...(data.ip ? { ip: data.ip } : {}),
    });

    setServerAuthCookies({
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      rememberMe: data.rememberMe,
    });

    return {
      user: { id: result.userId, orgId: result.orgId },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  });

export const refreshServerFn = createServerFn({ method: "POST" })
  .validator(refreshSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    const result = await refreshSession(db, data.refreshToken);
    if (result.requiresMfa || !result.accessToken || !result.refreshToken) {
      throw new ValidationError("Refresh failed");
    }
    setServerAuthCookies({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return {
      user: { id: result.userId, orgId: result.orgId },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  });

export const signoutServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ refreshToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getServerDb();
    await signOut(db, data.refreshToken);
    // Clear cookies — Hono's `clearCookie` equivalent for Server Functions
    try {
      const mod = require("@tanstack/start-server-core") as {
        appendResponseHeader?: (name: string, value: string) => void;
      };
      if (mod.appendResponseHeader) {
        mod.appendResponseHeader(
          "Set-Cookie",
          "nawebeus_access=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
        );
        mod.appendResponseHeader(
          "Set-Cookie",
          "nawebeus_refresh=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0",
        );
      }
    } catch {
      // outside TanStack Start — caller clears cookies client-side
    }
    return { signedOut: true as const };
  });

export const forgotPasswordServerFn = createServerFn({ method: "POST" })
  .validator(forgotSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    // Origin is not needed for the Server Function path; Hono route passes `c.req.header("origin")`
    await forgotPassword(db, data.email, "");
    return {
      message: "If an account with that email exists, a password reset link has been sent.",
    };
  });

export const resetPasswordServerFn = createServerFn({ method: "POST" })
  .validator(resetSchema)
  .handler(async ({ data }) => {
    const complexity = validatePassword(data.password);
    if (!complexity.valid) {
      throw new ValidationError("Password does not meet complexity requirements", [
        { field: "password", message: complexity.errors.join("; ") },
      ]);
    }
    const db = getServerDb();
    const result = await resetPassword(db, data.token, data.password);
    return { message: "Password reset successfully.", email: result.email };
  });

export const resendVerificationServerFn = createServerFn({ method: "POST" })
  .validator(resendVerificationSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    await sendVerificationEmail(db, data.email, "");
    return { message: "If an account with that email exists, a verification link has been sent." };
  });

export const verifyEmailServerFn = createServerFn({ method: "GET" })
  .validator(verifyEmailSchema)
  .handler(async ({ data }) => {
    const db = getServerDb();
    const result = await verifyEmail(db, data.token);
    return { userId: result.userId, email: result.email, message: "Email verified successfully." };
  });

// ---------------------------------------------------------------------------
// Protected Server Functions — require a valid session (cookie or Bearer key)
// ---------------------------------------------------------------------------

export const getMfaStatusServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  return withServerOrgContext(auth, () => getMFAStatus(db, auth.userId));
});

export const initiateMfaSetupServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  return withServerOrgContext(auth, () => initiateMFASetup(db, auth.userId));
});

export const confirmMfaSetupServerFn = createServerFn({ method: "POST" })
  .validator(confirmMFASchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    // mfa service looks up the user email itself if needed
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute<{ email: string }>(
      sql`SELECT email FROM users WHERE id = ${auth.userId} LIMIT 1`,
    );
    const email = (rows as unknown as { rows?: Array<{ email: string }> }).rows?.[0]?.email;
    await withServerOrgContext(auth, () => confirmMFASetup(db, auth.userId, data.token, email));
    return { message: "Two-factor authentication enabled." };
  });

export const disableMfaServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  await withServerOrgContext(auth, () => disableMFA(db, auth.userId));
  return { message: "Two-factor authentication disabled." };
});

export const listSessionsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const sessions = await withServerOrgContext(auth, () => listUserSessions(db, auth.userId));
  return { sessions };
});

export const getSessionDetailServerFn = createServerFn({ method: "GET" })
  .validator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    const detail = await withServerOrgContext(auth, () =>
      getSessionDetail(db, data.sessionId, auth.userId),
    );
    if (!detail) throw new ValidationError("Session not found");
    return { session: detail };
  });

export const revokeSessionServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    const detail = await withServerOrgContext(auth, () =>
      getSessionDetail(db, data.sessionId, auth.userId),
    );
    if (!detail) throw new ValidationError("Session not found");
    await withServerOrgContext(auth, () => revokeSession(db, data.sessionId));
    return { revoked: true as const, sessionId: data.sessionId };
  });

export const revokeOthersServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ currentSessionId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    const all = await withServerOrgContext(auth, () => listUserSessions(db, auth.userId));
    const toRevoke = all.filter((s) => s.id !== data.currentSessionId);
    for (const s of toRevoke) {
      await withServerOrgContext(auth, () => revokeSession(db, s.id));
    }
    return { revokedCount: toRevoke.length };
  });

export const changePasswordServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const complexity = validatePassword(data.newPassword, { email: "" });
    if (!complexity.valid) {
      throw new ValidationError(
        "New password does not meet complexity requirements",
        complexity.errors.map((msg) => ({ field: "newPassword", message: msg })),
      );
    }
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      changePassword(db, auth.userId, data.currentPassword, data.newPassword),
    );
    return { changed: true as const };
  });
