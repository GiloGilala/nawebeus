/**
 * TanStack Start Server Functions — Auth domain
 *
 * Thin transport: Zod validate + delegate to `src/services/*` (tanstack-start.md §13).
 * Session-cookie auth only. IP and tenant id are never taken from the payload.
 */

import { NotFoundError, RateLimitError, ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  acceptInvitationSchema,
  changePasswordSchema,
  confirmMfaSchema,
  forgotPasswordSchema,
  invitationTokenSchema,
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
import { acceptInvitation, getInvitationByToken } from "@/services/orgs/invitation.service";
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

/**
 * The invitation endpoints' probing budget, copied from `src/server/api/auth/invitation.route.ts`.
 *
 * Duplicated rather than imported because the route file owns no exports beyond its router, and the
 * numbers are the contract: the *keys* are shared through the `rate_limits` table, so web and API
 * spend from one budget. If one side's numbers drift, the stricter one wins in practice and the
 * looser one becomes the bypass — which is why `src/tests/orgs/server-functions.test.ts` pins both
 * surfaces against the same key and count.
 */
const INVITATION_VALIDATE_MAX = 20;
const INVITATION_ACCEPT_MAX = 10;
const INVITATION_WINDOW_MS = 30 * 60 * 1000;

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

/**
 * The invitation landing page's read (NWB-P14.2) — `GET /api/auth/invitations/:token`'s twin.
 *
 * **Public by design.** The bearer of the token is mid-onboarding and has no session; the 64-hex
 * emailed token *is* the credential, so there is no `getServerAuth()` here — exactly as in the Hono
 * route. What replaces it is the route's rate limit, reproduced key-for-key:
 * `invite:validate:<ip>`, 20 per 30 minutes. Same key means web and API **share one budget**, so
 * moving the probing to the other surface does not double it.
 *
 * Returns the preview only (org name, invited address, expiry, whether the form must also collect
 * registration details). A token that is unknown, revoked or expired answers `NotFoundError` from
 * the service — one indistinguishable "no longer valid", so the screen renders that state instead
 * of leaking which of the three it was.
 */
export const getInvitationPreviewServerFn = createServerFn({ method: "GET" })
  .validator(invitationTokenSchema)
  .handler(async ({ data }) => {
    const parsed = data as { token: string };
    const db = getServerDb();
    const ip = getServerClientIp();
    if (
      await checkRateLimit(
        db,
        `invite:validate:${ip}`,
        INVITATION_VALIDATE_MAX,
        INVITATION_WINDOW_MS,
      )
    ) {
      throw new RateLimitError(
        "Too many invitation lookups. Try again later.",
        INVITATION_WINDOW_MS / 1000,
      );
    }
    const invitation = await getInvitationByToken(db, parsed.token);
    return { invitation };
  });

/**
 * Accept an invitation (NWB-P14.2) — `POST /api/auth/invitations/:token/accept`'s twin.
 *
 * Public, and rate-limited on the route's stricter per-token key
 * (`invite:accept:<ip>:<first 16 chars of the token>`, 10 per 30 minutes) so a single leaked link
 * cannot be brute-forced into a membership and one noisy neighbour cannot exhaust the org's invites.
 *
 * **Deliberately does not set session cookies.** `acceptInvitation` activates the membership and,
 * for a new address, registers the account through the same `createUserRecord` signup uses — but it
 * creates no session, and neither does the HTTP route. Auto-sign-in is not available here on
 * principle rather than by omission: an invitee who already had an account never typed a password
 * into this form, so there is nothing to authenticate with. The screen therefore lands on sign-in
 * with a "your account is ready" notice, which is one extra step and zero new auth paths.
 *
 * The single-use claim stays the service's (`UPDATE … WHERE accepted_at IS NULL`), so a concurrent
 * second accept is a 409 on both surfaces rather than two memberships.
 */
export const acceptInvitationServerFn = createServerFn({ method: "POST" })
  .validator(acceptInvitationSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof acceptInvitationSchema.parse>;
    const db = getServerDb();
    const ip = getServerClientIp();
    const bucket = `invite:accept:${ip}:${parsed.token.slice(0, 16)}`;
    if (await checkRateLimit(db, bucket, INVITATION_ACCEPT_MAX, INVITATION_WINDOW_MS)) {
      throw new RateLimitError(
        "Too many acceptance attempts. Try again later.",
        INVITATION_WINDOW_MS / 1000,
      );
    }
    const result = await acceptInvitation(db, {
      token: parsed.token,
      ...(parsed.password !== undefined ? { password: parsed.password } : {}),
      ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
      ...(parsed.termsAccepted !== undefined ? { termsAccepted: parsed.termsAccepted } : {}),
      ...(parsed.privacyAccepted !== undefined ? { privacyAccepted: parsed.privacyAccepted } : {}),
      ...(parsed.marketingOptIn !== undefined ? { marketingOptIn: parsed.marketingOptIn } : {}),
    });
    return {
      membership: {
        id: result.memberId,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        email: result.email,
        roleId: result.roleId,
        status: "active" as const,
        newUser: result.newUser,
      },
    };
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
