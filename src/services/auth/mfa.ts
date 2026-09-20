import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AuthError, RateLimitError } from "../../lib/errors";
import { normaliseIp } from "../../lib/ip";
import { checkRateLimit } from "../../lib/rate-limit";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";
import { hashToken } from "./session";
import { createToken } from "./tokens";
import { generateTOTOPair, verifyTOTP } from "./totp";

export interface MFASetupResult {
  secret: string;
  uri: string;
  backupCodes: string[];
}

const BACKUP_CODE_COUNT = 10;

/** Staged setups live as long as a login challenge — confirm promptly or restart. */
const SETUP_STAGING_TTL_MIN = 15;

/** Login challenge lifetime (FR-AUTH-008 flow step 2–5). */
const MFA_CHALLENGE_TTL_MIN = 15;

/** AC8: at most 3 verification attempts per 15 minutes, per user + IP. */
const MFA_VERIFY_MAX_ATTEMPTS = 3;
const MFA_VERIFY_WINDOW_MS = 15 * 60 * 1000;

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    codes.push(crypto.randomUUID().slice(0, 8).toUpperCase());
  }
  return codes;
}

/**
 * Canonical form for backup-code comparison. Codes are generated uppercase, but a
 * user typing one by hand may use lowercase — normalising before hashing costs
 * nothing (the alphabet is unambiguous) and avoids rejecting a valid code.
 */
function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase();
}

async function hashBackupCode(code: string): Promise<string> {
  return hashToken(normalizeBackupCode(code));
}

/**
 * Starts (or restarts) MFA setup. The new secret and backup codes are STAGED in
 * the pending columns — the active secret is untouched, so an abandoned setup
 * never disturbs working MFA (F-04b). The plaintext codes are returned exactly
 * once; only their SHA-256 digests are stored (F-04).
 */
export async function initiateMFASetup(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<MFASetupResult> {
  const pair = generateTOTOPair(`${userId}@nawebeus.com`, "Nawebeus");
  const backupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));
  const expiresAt = new Date(Date.now() + SETUP_STAGING_TTL_MIN * 60_000).toISOString();

  await db.execute(
    sql`
      UPDATE users
      SET pending_two_factor_secret = ${pair.secret},
          pending_two_factor_backup_codes = ${JSON.stringify(hashedCodes)}::jsonb,
          pending_two_factor_expires_at = ${expiresAt}
      WHERE id = ${userId}
    `,
  );

  return { secret: pair.secret, uri: pair.uri, backupCodes };
}

/**
 * Confirms setup by verifying a TOTP code against the STAGED secret, then
 * promotes staged state to active. The stored backup-code set is exactly the
 * hashes of the codes displayed by `initiateMFASetup` — display set ≡ stored
 * set (F-04). Re-running setup while MFA is enabled re-stages without
 * disturbing the active secret until this confirms.
 */
export async function confirmMFASetup(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  token: string,
  userEmail?: string,
): Promise<void> {
  const rows = await db.execute<{
    email: string;
    pending_two_factor_secret: string | null;
    pending_two_factor_backup_codes: string[] | null;
    pending_two_factor_expires_at: string | null;
  }>(
    sql`SELECT email, pending_two_factor_secret, pending_two_factor_backup_codes,
               pending_two_factor_expires_at
        FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row || !row.pending_two_factor_secret) {
    throw new AuthError("MFA setup not initiated. Call initiateMFASetup first.");
  }

  if (
    row.pending_two_factor_expires_at &&
    new Date(row.pending_two_factor_expires_at).getTime() < Date.now()
  ) {
    await clearStagedSetup(db, userId);
    throw new AuthError("MFA setup expired. Start setup again.");
  }

  const valid = await verifyTOTP(row.pending_two_factor_secret, token);
  if (!valid) {
    throw new AuthError("Invalid TOTP code");
  }

  await db.execute(
    sql`
      UPDATE users
      SET two_factor_enabled = true,
          two_factor_secret = ${row.pending_two_factor_secret},
          two_factor_backup_codes = ${JSON.stringify(row.pending_two_factor_backup_codes ?? [])}::jsonb,
          pending_two_factor_secret = NULL,
          pending_two_factor_backup_codes = NULL,
          pending_two_factor_expires_at = NULL
      WHERE id = ${userId}
    `,
  );

  if (userEmail) {
    await emailService.send({
      to: userEmail,
      subject: "Two-factor authentication enabled",
      html: `<p>Your Nawebeus account now has two-factor authentication enabled.</p>`,
    });
  }

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.mfa.enabled",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
  });
}

async function clearStagedSetup(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<void> {
  await db.execute(
    sql`UPDATE users
        SET pending_two_factor_secret = NULL,
            pending_two_factor_backup_codes = NULL,
            pending_two_factor_expires_at = NULL
        WHERE id = ${userId}`,
  );
}

export async function disableMFA(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<void> {
  await db.execute(
    sql`
      UPDATE users
      SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_backup_codes = '[]'::jsonb,
          pending_two_factor_secret = NULL, pending_two_factor_backup_codes = NULL,
          pending_two_factor_expires_at = NULL
      WHERE id = ${userId}
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.mfa.disabled",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
  });
}

/**
 * Verifies a login-time second factor: a 6-digit TOTP code against the ACTIVE
 * secret, or a backup code against the stored digests. A matching backup code is
 * consumed (single-use). Success and failure are both audited (AC9).
 *
 * Callers must gate on `enforceMfaVerifyRateLimit` first — this function counts
 * no budget itself, so both the single-shot and challenge paths share one AC8
 * allowance.
 */
export async function verifyMFAForLogin(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  token: string,
  options?: { ip?: string },
): Promise<boolean> {
  const rows = await db.execute<{
    organization_id: string | null;
    two_factor_secret: string | null;
    two_factor_backup_codes: string[] | null;
  }>(
    sql`SELECT organization_id, two_factor_secret, two_factor_backup_codes
        FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row || !row.two_factor_secret) {
    throw new AuthError("MFA not enabled for this user");
  }

  const actorIp = normaliseIp(options?.ip);
  const auditBase = {
    db,
    module: "core" as const,
    ...(row.organization_id ? { organizationId: row.organization_id as string } : {}),
    actorId: userId,
    actorType: "user" as const,
    // `exactOptionalPropertyTypes` forbids passing `undefined` explicitly.
    ...(actorIp ? { actorIp } : {}),
    category: "authentication" as const,
    resourceType: "user",
    resourceId: userId,
  };

  // TOTP is the hot path and its shape (6 digits) is disjoint from backup codes
  // (8 alphanumerics), so order is unobservable — this just fails fast.
  if (await verifyTOTP(row.two_factor_secret, token)) {
    await writeAuditLog({ ...auditBase, action: "auth.mfa.verified" });
    return true;
  }

  const storedHashes: string[] = row.two_factor_backup_codes ?? [];
  const presentedHash = await hashBackupCode(token);
  if (storedHashes.includes(presentedHash)) {
    await db.execute(
      sql`UPDATE users
          SET two_factor_backup_codes = ${JSON.stringify(storedHashes.filter((h) => h !== presentedHash))}::jsonb
          WHERE id = ${userId}`,
    );
    await writeAuditLog({ ...auditBase, action: "auth.mfa.verified" });
    return true;
  }

  await writeAuditLog({ ...auditBase, action: "auth.mfa.failed", severity: "warning" });
  throw new AuthError("Invalid MFA code");
}

export async function getMFAStatus(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<{ enabled: boolean; backupCodesRemaining: number }> {
  const rows = await db.execute<{
    two_factor_enabled: boolean;
    two_factor_backup_codes: string[];
  }>(
    sql`SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) {
    throw new AuthError("User not found");
  }
  return {
    enabled: !!row.two_factor_enabled,
    backupCodesRemaining: (row.two_factor_backup_codes ?? []).length,
  };
}

/**
 * Issues a login challenge after the password checks out. The returned token is
 * the `mfaSessionId` the client presents to `POST /mfa/verify-login`. Issuing a
 * new challenge revokes any prior unused one for the user (via `createToken`),
 * so only the latest sign-in attempt can complete.
 */
export async function createMfaChallenge(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  ip?: string,
): Promise<string> {
  const { rawToken } = await createToken(db, {
    userId,
    tokenType: "otp",
    purpose: "mfa_challenge",
    expiresInMinutes: MFA_CHALLENGE_TTL_MIN,
    maxUses: 1,
    ...(ip ? { ipAddress: ip } : {}),
  });
  return rawToken;
}

export interface MfaChallenge {
  id: string;
  userId: string;
}

/**
 * Looks up a challenge WITHOUT consuming it — a failed code attempt must not
 * burn the challenge, because AC8 allows 3 attempts per window. The challenge is
 * revoked exactly once, on successful verification (`revokeMfaChallenge`).
 */
export async function peekMfaChallenge(
  db: NodePgDatabase<Record<string, any>>,
  rawToken: string,
): Promise<MfaChallenge | null> {
  const tokenHash = await hashToken(rawToken);
  const rows = await db.execute<{ id: string; user_id: string }>(
    sql`SELECT id, user_id FROM tokens
        WHERE selector = ${rawToken}
          AND hashed_validator = ${tokenHash}
          AND purpose = 'mfa_challenge'
          AND is_revoked = false
          AND status = 'active'
          AND expires_at > now()
        LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return { id: row.id, userId: row.user_id };
}

/** Burns a challenge after successful verification — challenges are single-use. */
export async function revokeMfaChallenge(
  db: NodePgDatabase<Record<string, any>>,
  challengeId: string,
): Promise<void> {
  await db.execute(
    sql`UPDATE tokens SET is_revoked = true, revoked_at = now(), status = 'revoked'
        WHERE id = ${challengeId}`,
  );
}

/**
 * AC8 gate: at most 3 verification attempts per 15 minutes per user + IP. Both
 * the single-shot `mfaCode` path and the challenge path call this with the same
 * key, so neither can be used to bypass the other's budget.
 *
 * Keyed per user+IP rather than per challenge: a per-challenge budget would let
 * a password-compromised attacker mint unlimited guesses by re-signing-in for a
 * fresh challenge. The price is that a stale budget lingers across logins from
 * the same IP — acceptable and standard.
 */
export async function enforceMfaVerifyRateLimit(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  ip?: string,
): Promise<void> {
  const exceeded = await checkRateLimit(
    db,
    `mfa-verify:${userId}:${ip ?? "unknown"}`,
    MFA_VERIFY_MAX_ATTEMPTS,
    MFA_VERIFY_WINDOW_MS,
  );
  if (exceeded) {
    throw new RateLimitError(
      "Too many MFA verification attempts. Try again in 15 minutes.",
      MFA_VERIFY_WINDOW_MS / 1000,
    );
  }
}
