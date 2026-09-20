import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { AccountLockedError, AccountSuspendedError, AuthError } from "../../lib/errors";
import { checkRateLimit } from "../../lib/rate-limit";
import { writeAuditLog } from "../audit";
import { type JwtPayload, signAccessToken, signRefreshToken, verifyToken } from "./jwt";
import {
  createMfaChallenge,
  enforceMfaVerifyRateLimit,
  peekMfaChallenge,
  revokeMfaChallenge,
  verifyMFAForLogin,
} from "./mfa";
import { hashPassword, verifyPassword } from "./password";
import { recordPasswordChange } from "./password-history";
import {
  createSession,
  findSession,
  hashToken,
  revokeAllSessionsForUser,
  revokeSession,
  sessionTtlSeconds,
} from "./session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min
const IP_BLOCK_THRESHOLD = 20;
const IP_BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 min

/**
 * Statuses allowed to hold a session (F-05 / NWB-P0-015). `pending_verification`
 * is deliberately included: the verification email is console-only in dev, so
 * hard-blocking there would strand users before Phase 2 ships a real provider.
 * The client is told via `emailVerified` and gates features itself; Phase 2 adds
 * the server-side gate together with real email delivery.
 */
const SIGN_IN_ALLOWED_STATUSES = ["active", "pending_verification"] as const;

/**
 * Single source of truth for "may this account sign in / keep its session".
 * Shared by `signIn`, `verifyMfaChallengeLogin` and `authMiddleware` so a
 * suspension is effective at the next request, not at the next sign-in.
 *
 * Callers must have proven the password (or hold a valid session) before calling
 * this: `suspended` is a 403 with a distinct code, and disclosing it to an
 * anonymous caller would turn sign-in into an account-enumeration oracle.
 */
export function assertAccountCanAuthenticate(status: string): void {
  if ((SIGN_IN_ALLOWED_STATUSES as readonly string[]).includes(status)) return;
  if (status === "suspended") {
    throw new AccountSuspendedError(
      "This account is suspended. Contact your organization administrator.",
    );
  }
  // `deleted` (and anything unrecognised) is not disclosed as a distinct state.
  throw new AuthError("Invalid email or password");
}

export interface SignInOptions {
  mfaCode?: string;
  rememberMe?: boolean;
  ip?: string;
}

export interface SignInResult {
  userId: string;
  orgId: string;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  requiresMfa: boolean;
  mfaMethod?: "totp" | "backup";
  /**
   * `users.email_verified`. `pending_verification` accounts may sign in (see
   * `SIGN_IN_ALLOWED_STATUSES`) but must be told the address is unconfirmed so
   * the client can route to the verification screen. Absent on refresh.
   */
  emailVerified?: boolean;
  /**
   * Login-challenge token, present only when `requiresMfa` is true. The client
   * presents it to `POST /mfa/verify-login` alongside the TOTP/backup code.
   * Single-use, 15-minute TTL.
   */
  mfaSessionId?: string;
}

export async function signIn(
  db: NodePgDatabase<Record<string, any>>,
  email: string,
  password: string,
  options?: SignInOptions,
): Promise<SignInResult> {
  const ip = options?.ip ?? "unknown";

  // --- IP-level rate limit (BR-AUTH-018) ---
  const ipBlocked = await checkRateLimit(db, `ip:${ip}`, IP_BLOCK_THRESHOLD, IP_BLOCK_DURATION_MS);
  if (ipBlocked) {
    throw new AccountLockedError(
      "Too many failed attempts from this IP. Try again later.",
      new Date(Date.now() + IP_BLOCK_DURATION_MS),
    );
  }

  // --- Look up user ---
  // `failed_login_attempts` is deliberately NOT selected: the failure path below increments it
  // atomically in the database. Reading it here would invite using that value, which is exactly
  // the lost-update bug this replaced (NWB-P0-008).
  const rows = await db.execute<{
    id: string;
    password: string;
    organization_id: string;
    account_locked_until: string | null;
    two_factor_enabled: boolean;
    two_factor_secret: string | null;
    status: string;
    email_verified: boolean;
  }>(
    sql`SELECT id, password, organization_id, account_locked_until,
              two_factor_enabled, two_factor_secret, status, email_verified
        FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`,
  );
  const user = (rows as any).rows?.[0] as any;
  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  // --- Account-level lockout check (BR-AUTH-017) ---
  if (user.account_locked_until) {
    const lockedUntil = new Date(user.account_locked_until);
    if (lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedError(
        "Account is temporarily locked due to too many failed login attempts.",
        lockedUntil,
      );
    }
  }

  // --- Verify password ---
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    // Increment atomically and let the database decide whether the threshold was crossed.
    //
    // The previous shape read `failed_login_attempts` in the SELECT above, awaited bcrypt, then
    // wrote `read + 1`. Every concurrent attempt read the same starting value and wrote the same
    // result, so N parallel wrong passwords counted as ONE failure and the lockout never
    // engaged — the control did nothing against parallelised credential stuffing (NWB-P0-008).
    //
    // `RETURNING` is the post-increment truth for *this* statement under any interleaving, so
    // the threshold test below cannot be based on a stale read.
    //
    // Deliberately not `SELECT … FOR UPDATE`: that would hold a row lock across an intentional
    // bcrypt delay, which turns the lockout into a denial of service against a legitimate user.
    const updated = await db.execute<{
      failed_login_attempts: number;
      account_locked_until: string | Date | null;
    }>(
      sql`UPDATE users
             SET failed_login_attempts = failed_login_attempts + 1,
                 account_locked_until = CASE
                   WHEN failed_login_attempts + 1 >= ${MAX_FAILED_ATTEMPTS}::int
                     THEN now() + (${LOCKOUT_DURATION_MS}::int * interval '1 millisecond')
                     ELSE account_locked_until
                   END
           WHERE id = ${user.id}
         RETURNING failed_login_attempts, account_locked_until`,
    );
    const row = (updated as any).rows?.[0] as
      | { failed_login_attempts: number; account_locked_until: string | Date | null }
      | undefined;

    // No row means the user disappeared between the SELECT and here. Refuse rather than guess.
    if (!row) throw new AuthError("Invalid email or password");

    const lockedUntil = row.account_locked_until ? new Date(row.account_locked_until) : null;

    if (row.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
      throw new AccountLockedError(
        "Account locked after too many failed attempts. Try again in 15 minutes.",
        lockedUntil ?? new Date(Date.now() + LOCKOUT_DURATION_MS),
      );
    }

    throw new AuthError("Invalid email or password");
  }

  // --- Status gate (F-05 / NWB-P0-015) ---
  // Deliberately after the password check: the 403 must not be reachable without
  // valid credentials, or it becomes an account-enumeration oracle.
  assertAccountCanAuthenticate(user.status as string);

  // --- Reset failed attempts on success ---
  await db.execute(
    sql`UPDATE users SET failed_login_attempts = 0, account_locked_until = null WHERE id = ${user.id}`,
  );

  const userId = user.id as string;
  const orgId = (user.organization_id as string) ?? "";
  const emailVerified = !!user.email_verified;

  // --- MFA: single-shot code, or issue a login challenge ---
  if (user.two_factor_enabled) {
    if (options?.mfaCode) {
      // Password + second factor in one request. Gated by the same AC8 budget
      // as the challenge path, and verified against the active secret (TOTP)
      // or the stored backup-code digests.
      await enforceMfaVerifyRateLimit(db, userId, ip);
      await verifyMFAForLogin(db, userId, options.mfaCode, { ip });
    } else {
      // Password checks out but the second factor is still outstanding: issue a
      // challenge and let `verifyMfaChallengeLogin` complete the login.
      const mfaSessionId = await createMfaChallenge(db, userId, ip);
      return {
        userId,
        orgId,
        requiresMfa: true,
        mfaMethod: "totp",
        mfaSessionId,
        emailVerified,
      };
    }
  }

  // --- Create session (shared with the MFA-challenge completion path) ---
  const issued = await completeSignIn(db, userId, orgId, {
    rememberMe: !!options?.rememberMe,
    ip,
  });

  return {
    userId,
    orgId,
    sessionId: issued.sessionId,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    requiresMfa: false,
    emailVerified,
  };
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a session + token pair for an already-authenticated user. Shared by
 * `signIn` (password-only and single-shot MFA logins) and
 * `verifyMfaChallengeLogin` (challenge completion), so every login path mints
 * sessions identically.
 */
export async function completeSignIn(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  orgId: string,
  options: { rememberMe: boolean; ip: string },
): Promise<IssuedSession> {
  const config = getConfig();

  const sessionId = crypto.randomUUID();
  // Same TTL the session row records as `expires_at` — see sessionTtlSeconds.
  const refreshTtlSec = sessionTtlSeconds(options.rememberMe);
  const refreshToken = await signRefreshToken(
    sessionId,
    userId,
    orgId,
    config.JWT_REFRESH_SECRET,
    refreshTtlSec,
  );
  const tokenHash = await hashToken(refreshToken);
  const session = await createSession(db, sessionId, userId, tokenHash, options.rememberMe, {
    ip: options.ip,
  });

  const accessToken = await signAccessToken(userId, orgId, config.JWT_ACCESS_SECRET);

  await db.execute(sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`);

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.signin.completed",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
  });

  return { sessionId: session.id, accessToken, refreshToken };
}

export interface VerifyMfaChallengeInput {
  challengeToken: string;
  code: string;
  rememberMe?: boolean;
  ip?: string;
}

/**
 * Completes a challenged login: validates the `mfaSessionId` issued by `signIn`,
 * enforces the AC8 attempt budget, verifies the TOTP/backup code, burns the
 * challenge (single-use), and issues the session.
 */
export async function verifyMfaChallengeLogin(
  db: NodePgDatabase<Record<string, any>>,
  input: VerifyMfaChallengeInput,
): Promise<SignInResult> {
  const ip = input.ip ?? "unknown";

  const challenge = await peekMfaChallenge(db, input.challengeToken);
  if (!challenge) {
    throw new AuthError("Invalid or expired MFA challenge. Sign in again to get a new one.");
  }

  await enforceMfaVerifyRateLimit(db, challenge.userId, ip);
  await verifyMFAForLogin(db, challenge.userId, input.code, { ip });

  // Success burns the challenge: a verified challenge can never complete twice.
  await revokeMfaChallenge(db, challenge.id);

  const rows = await db.execute<{
    organization_id: string | null;
    status: string;
    email_verified: boolean;
  }>(
    sql`SELECT organization_id, status, email_verified FROM users WHERE id = ${challenge.userId} LIMIT 1`,
  );
  const user = (rows as any).rows?.[0] as any;
  if (!user) throw new AuthError("User not found");
  // The challenge was minted after a valid password; re-check the account state
  // here so a suspension between the two steps cannot finish a login.
  assertAccountCanAuthenticate(user.status as string);
  const orgId = (user.organization_id as string | null) ?? "";

  const issued = await completeSignIn(db, challenge.userId, orgId, {
    rememberMe: !!input.rememberMe,
    ip,
  });

  return {
    userId: challenge.userId,
    orgId,
    sessionId: issued.sessionId,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    requiresMfa: false,
    emailVerified: !!user.email_verified,
  };
}

export async function refreshSession(
  db: NodePgDatabase<Record<string, any>>,
  refreshToken: string,
): Promise<SignInResult> {
  const config = getConfig();

  let payload: JwtPayload;
  try {
    payload = await verifyToken(refreshToken, config.JWT_REFRESH_SECRET);
  } catch {
    throw new AuthError("Invalid or expired refresh token");
  }
  if (payload.type !== "refresh") throw new AuthError("Invalid token type");

  const session = await findSession(db, payload.sessionId);
  if (!session || session.isRevoked) throw new AuthError("Session revoked");

  // Verify the presented token actually belongs to this session row
  const presentedHash = await hashToken(refreshToken);
  if (presentedHash !== session.tokenHash) {
    throw new AuthError("Session token mismatch");
  }

  // Look up user org
  const rows = await db.execute<{ organization_id: string }>(
    sql`SELECT organization_id FROM users WHERE id = ${session.userId} LIMIT 1`,
  );
  const user = (rows as any).rows?.[0] as any;
  if (!user) throw new AuthError("User not found");

  const orgId = user.organization_id ?? "";

  // Rotate: revoke old session, create new one
  await revokeSession(db, session.id);
  const newSessionId = crypto.randomUUID();
  const newRefreshToken = await signRefreshToken(
    newSessionId,
    session.userId,
    orgId,
    config.JWT_REFRESH_SECRET,
  );
  const newTokenHash = await hashToken(newRefreshToken);
  const newSession = await createSession(db, newSessionId, session.userId, newTokenHash, false);

  const accessToken = await signAccessToken(session.userId, orgId, config.JWT_ACCESS_SECRET);

  return {
    userId: session.userId,
    orgId,
    sessionId: newSession.id,
    accessToken,
    refreshToken: newRefreshToken,
    requiresMfa: false,
  };
}

export async function signOut(
  db: NodePgDatabase<Record<string, any>>,
  refreshToken: string,
): Promise<void> {
  const config = getConfig();

  try {
    const payload = await verifyToken(refreshToken, config.JWT_REFRESH_SECRET);
    if (payload.type === "refresh") {
      const session = await findSession(db, payload.sessionId);
      if (session && !session.isRevoked) {
        const presentedHash = await hashToken(refreshToken);
        if (presentedHash === session.tokenHash) {
          await revokeSession(db, session.id);
        }
      }
    }
  } catch {
    // Token invalid — sign-out is best-effort; caller clears cookies anyway
  }
}

export async function changePassword(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const rows = await db.execute<{ password: string }>(
    sql`SELECT password FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const user = (rows as any).rows?.[0] as any;
  if (!user) throw new AuthError("User not found");

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new AuthError("Current password is incorrect");

  const hashed = await hashPassword(newPassword);
  const newHistory = await recordPasswordChange(db, userId, hashed);

  await db.execute(
    sql`UPDATE users SET password = ${hashed},
        password_history = ${JSON.stringify(newHistory)}::jsonb
        WHERE id = ${userId}`,
  );

  await revokeAllSessionsForUser(db, userId);

  await writeAuditLog({
    db,
    module: "security",
    actorId: userId,
    actorType: "user",
    action: "security.password_changed",
    category: "security",
    resourceType: "user",
    resourceId: userId,
  });
}
