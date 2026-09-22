/**
 * TanStack Start Server Functions — Auth domain
 *
 * Thin transport: Zod validate + delegate to `src/services/*` (tanstack-start.md §13).
 * Session-cookie auth only. IP and tenant id are never taken from the payload.
 */

import { NotFoundError, ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import {
  changePasswordSchema,
  confirmMfaSchema,
  forgotPasswordSchema,
  refreshSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  revokeOthersSchema,
  sessionIdSchema,
  signinSchema,
  signoutSchema,
  signupSchema,
  verifyEmailSchema,
  verifyLoginSchema,
} from "@/lib/validation";
import {
  changePassword,
  refreshSession,
  signIn,
  signOut,
  verifyMfaChallengeLogin,
} from "@/services/auth/auth.service";
import { confirmMFASetup, disableMFA, getMFAStatus, initiateMFASetup } from "@/services/auth/mfa";
import { forgotPassword, resetPassword } from "@/services/auth/password-reset";
import {
  getSessionDetail,
  listUserSessions,
  revokeOtherSessions,
  revokeSession,
} from "@/services/auth/session";
import { signup } from "@/services/auth/signup";
import { sendVerificationEmail, verifyEmail } from "@/services/auth/verification";
import { createServerFn } from "../lib/createServerFn";
import {
  clearServerAuthCookies,
  cookieValue,
  getServerAuth,
  getServerClientIp,
  getServerDb,
  setServerAuthCookies,
  withServerOrgContext,
} from "./helpers";

export const signupServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = signupSchema.parse(data);
    const complexity = validatePassword(parsed.password, {
      username: parsed.fullName,
      email: parsed.email,
    });
    if (!complexity.valid) {
      throw new ValidationError(
        "Password does not meet complexity requirements",
        complexity.errors.map((msg) => ({ field: "password", message: msg })),
      );
    }
    return parsed;
  })
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof signupSchema.parse>;
    const db = getServerDb();
    const result = await signup(db, {
      email: parsed.email,
      password: parsed.password,
      fullName: parsed.fullName,
      organizationName: parsed.organizationName,
      termsAccepted: parsed.termsAccepted,
      privacyAccepted: parsed.privacyAccepted,
      ...(parsed.industry ? { industry: parsed.industry } : {}),
      ...(parsed.teamSize ? { teamSize: parsed.teamSize } : {}),
      ...(parsed.marketingOptIn !== undefined ? { marketingOptIn: parsed.marketingOptIn } : {}),
    });
    return { user: result.user, organization: result.organization };
  });

export const signinServerFn = createServerFn({ method: "POST" })
  .validator(signinSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof signinSchema.parse>;
    const db = getServerDb();
    const ip = getServerClientIp();
    const result = await signIn(db, parsed.email, parsed.password, {
      ...(ip ? { ip } : {}),
      rememberMe: parsed.rememberMe,
      ...(parsed.mfaCode ? { mfaCode: parsed.mfaCode } : {}),
    });

    if (result.requiresMfa) {
      return {
        requiresMfa: true as const,
        mfaMethod: result.mfaMethod,
        mfaSessionId: result.mfaSessionId,
        emailVerified: result.emailVerified ?? false,
      };
    }

    setServerAuthCookies({
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      rememberMe: parsed.rememberMe,
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
    const parsed = data as ReturnType<typeof verifyLoginSchema.parse>;
    const db = getServerDb();
    const ip = getServerClientIp();
    const result = await verifyMfaChallengeLogin(db, {
      challengeToken: parsed.mfaSessionId,
      code: parsed.code,
      rememberMe: parsed.rememberMe,
      ...(ip ? { ip } : {}),
    });

    setServerAuthCookies({
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      rememberMe: parsed.rememberMe,
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
    const parsed = data as { refreshToken?: string };
    const refreshToken = parsed.refreshToken ?? cookieValue("nawebeus_refresh");
    if (!refreshToken) throw new ValidationError("Refresh token is required");
    const db = getServerDb();
    const result = await refreshSession(db, refreshToken);
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
  .validator(signoutSchema)
  .handler(async ({ data }) => {
    const parsed = data as { refreshToken?: string };
    const refreshToken = parsed.refreshToken ?? cookieValue("nawebeus_refresh");
    const db = getServerDb();
    if (refreshToken) await signOut(db, refreshToken);
    clearServerAuthCookies();
    return { signedOut: true as const };
  });

export const forgotPasswordServerFn = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    const parsed = data as { email: string };
    const db = getServerDb();
    await forgotPassword(db, parsed.email);
    return {
      message: "If an account with that email exists, a password reset link has been sent.",
    };
  });

export const resetPasswordServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = resetPasswordSchema.parse(data);
    const complexity = validatePassword(parsed.password);
    if (!complexity.valid) {
      throw new ValidationError("Password does not meet complexity requirements", [
        { field: "password", message: complexity.errors.join("; ") },
      ]);
    }
    return parsed;
  })
  .handler(async ({ data }) => {
    const parsed = data as { token: string; password: string };
    const db = getServerDb();
    const result = await resetPassword(db, parsed.token, parsed.password);
    return { message: "Password reset successfully.", email: result.email };
  });

export const resendVerificationServerFn = createServerFn({ method: "POST" })
  .validator(resendVerificationSchema)
  .handler(async ({ data }) => {
    const parsed = data as { email: string };
    const db = getServerDb();
    await sendVerificationEmail(db, parsed.email);
    return { message: "If an account with that email exists, a verification link has been sent." };
  });

export const verifyEmailServerFn = createServerFn({ method: "GET" })
  .validator(verifyEmailSchema)
  .handler(async ({ data }) => {
    const parsed = data as { token: string };
    const db = getServerDb();
    const result = await verifyEmail(db, parsed.token);
    return { userId: result.userId, email: result.email, message: "Email verified successfully." };
  });

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
  .validator(confirmMfaSchema)
  .handler(async ({ data }) => {
    const parsed = data as { token: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    await withServerOrgContext(auth, () => confirmMFASetup(db, auth.userId, parsed.token));
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
  const sessions = (await withServerOrgContext(auth, () => listUserSessions(db, auth.userId)))
    .items;
  return { sessions };
});

export const getSessionDetailServerFn = createServerFn({ method: "GET" })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { sessionId: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const detail = await withServerOrgContext(auth, () =>
      getSessionDetail(db, parsed.sessionId, auth.userId),
    );
    if (!detail) throw new NotFoundError("Session not found");
    return { session: detail };
  });

export const revokeSessionServerFn = createServerFn({ method: "POST" })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { sessionId: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const detail = await withServerOrgContext(auth, () =>
      getSessionDetail(db, parsed.sessionId, auth.userId),
    );
    if (!detail) throw new NotFoundError("Session not found");
    await withServerOrgContext(auth, () =>
      revokeSession(db, parsed.sessionId, {
        actorId: auth.userId,
        actorType: "user",
        organizationId: auth.orgId,
      }),
    );
    return { revoked: true as const, sessionId: parsed.sessionId };
  });

export const revokeOthersServerFn = createServerFn({ method: "POST" })
  .validator(revokeOthersSchema)
  .handler(async ({ data }) => {
    const parsed = data as { currentSessionId?: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const revokedCount = await withServerOrgContext(auth, () =>
      revokeOtherSessions(db, auth.userId, parsed.currentSessionId, {
        actorId: auth.userId,
        actorType: "user",
        organizationId: auth.orgId,
      }),
    );
    return { revokedCount };
  });

export const changePasswordServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = changePasswordSchema.parse(data);
    const complexity = validatePassword(parsed.newPassword, { email: "" });
    if (!complexity.valid) {
      throw new ValidationError(
        "New password does not meet complexity requirements",
        complexity.errors.map((msg) => ({ field: "newPassword", message: msg })),
      );
    }
    return parsed;
  })
  .handler(async ({ data }) => {
    const parsed = data as { currentPassword: string; newPassword: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      changePassword(db, auth.userId, parsed.currentPassword, parsed.newPassword),
    );
    return { changed: true as const };
  });
