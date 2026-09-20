import { sql } from "drizzle-orm";
import { generateSecureToken, hashToken } from "../../lib/tokens";
import type { DbOrTx } from "../../lib/transaction";
import { hashPassword } from "./password";

/**
 * Shared user-record creation (NWB-P0-016). Extracted from `signup` so the
 * invitation-accept flow can register-into-org **without duplicating** this
 * block — the two paths must produce byte-identical user rows or they will
 * drift (username shape, consent timestamps, password-history seeding,
 * `pending_verification` status).
 */

export interface CreateUserRecordInput {
  email: string;
  /** Plaintext — hashed here with the same `hashPassword` signup uses. */
  password: string;
  fullName: string;
  /** Consent instants; both callers capture them on the accepting request. */
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  marketingOptIn?: boolean;
  /** Locale defaults match signup's (Nigerian defaults, DEC-context Nigeria-first). */
  timezone?: string;
  locale?: string;
}

export interface CreatedUserRecord {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
}

export function generateUsername(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return `${sanitized}-${crypto.randomUUID().slice(0, 6)}`;
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Member";
  return { firstName, lastName };
}

/**
 * Insert a users row in `pending_verification` status with its password
 * history seeded. Callers decide on organization linkage themselves — signup
 * creates a personal organization; invitation-accept points the user at the
 * inviting organization.
 */
export async function createUserRecord(
  tx: DbOrTx,
  input: CreateUserRecordInput,
): Promise<CreatedUserRecord> {
  const hashed = await hashPassword(input.password);
  const username = generateUsername(input.email);
  const { firstName, lastName } = splitName(input.fullName);
  const now = new Date().toISOString();

  const userRows = await tx.execute<{ id: string }>(
    sql`
      INSERT INTO users (
        email, password, password_history, username, first_name, last_name,
        status, email_verified, timezone, locale,
        terms_accepted_at, privacy_accepted_at,
        marketing_consent_at, data_processing_consent
      )
      VALUES (
        ${input.email}, ${hashed}, ${JSON.stringify([hashed])}::jsonb, ${username}, ${firstName}, ${lastName},
        'pending_verification', false, ${input.timezone ?? "Africa/Lagos"}, ${input.locale ?? "en-NG"},
        ${input.termsAcceptedAt}::timestamptz, ${input.privacyAcceptedAt}::timestamptz,
        ${input.marketingOptIn ? now : null}::timestamptz, ${input.marketingOptIn ?? false}
      )
      RETURNING id
    `,
  );
  const user = (userRows as any).rows?.[0] as any;

  return { userId: user.id as string, username, firstName, lastName };
}

/**
 * The 24-hour email-verification token row (32-byte token, SHA-256 stored).
 * Returns the raw token — the only form that can go into a link. Callers send
 * the email **after** the surrounding transaction commits: a failed send must
 * not roll back a committed account.
 */
export async function createEmailVerificationToken(
  tx: DbOrTx,
  input: { userId: string; email: string },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await tx.execute(
    sql`
      INSERT INTO tokens (
        user_id, token_type, selector, hashed_validator, status, purpose, target_email, expires_at
      )
      VALUES (
        ${input.userId}, 'email_verification', ${rawToken.slice(0, 32)}, ${tokenHash},
        'active', 'email_verification', ${input.email}, ${expiresAt.toISOString()}
      )
    `,
  );

  return { rawToken, expiresAt };
}
