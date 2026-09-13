import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AuthError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";
import { hashToken } from "./session";
import { generateTOTOPair, verifyTOTP } from "./totp";

export interface MFASetupResult {
  secret: string;
  uri: string;
  backupCodes: string[];
}

const BACKUP_CODE_COUNT = 10;

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    codes.push(crypto.randomUUID().slice(0, 8).toUpperCase());
  }
  return codes;
}

export async function initiateMFASetup(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<MFASetupResult> {
  const pair = generateTOTOPair(`${userId}@nawebeus.com`, "Nawebeus");
  const backupCodes = generateBackupCodes();

  await db.execute(
    sql`
      UPDATE users
      SET two_factor_secret = ${pair.secret}, two_factor_backup_codes = ${JSON.stringify(backupCodes)}::jsonb
      WHERE id = ${userId}
    `,
  );

  return { secret: pair.secret, uri: pair.uri, backupCodes };
}

export async function confirmMFASetup(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  token: string,
  userEmail?: string,
): Promise<void> {
  const rows = await db.execute<{ two_factor_secret: string; email: string }>(
    sql`SELECT two_factor_secret, email FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row || !row.two_factor_secret) {
    throw new AuthError("MFA setup not initiated. Call initiateMFASetup first.");
  }

  const secret = row.two_factor_secret;
  const valid = await verifyTOTP(secret, token);
  if (!valid) {
    throw new AuthError("Invalid TOTP code");
  }

  const backupCodes = generateBackupCodes();

  await db.execute(
    sql`
      UPDATE users
      SET two_factor_enabled = true,
          two_factor_secret = ${secret},
          two_factor_backup_codes = ${JSON.stringify(backupCodes)}::jsonb
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

export async function disableMFA(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<void> {
  await db.execute(
    sql`
      UPDATE users
      SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_backup_codes = '[]'::jsonb
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

export async function verifyMFAForLogin(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  token: string,
): Promise<boolean> {
  const rows = await db.execute<{
    two_factor_secret: string;
    two_factor_backup_codes: string[];
  }>(
    sql`SELECT two_factor_secret, two_factor_backup_codes FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row || !row.two_factor_secret) {
    throw new AuthError("MFA not enabled for this user");
  }

  const secret = row.two_factor_secret;
  const backupCodes: string[] = row.two_factor_backup_codes ?? [];

  // Check backup codes first
  if (backupCodes.includes(token)) {
    await db.execute(
      sql`UPDATE users SET two_factor_backup_codes = ${JSON.stringify(backupCodes.filter((c) => c !== token))}::jsonb WHERE id = ${userId}`,
    );
    return true;
  }

  // Check TOTP
  const valid = await verifyTOTP(secret, token);
  if (!valid) {
    throw new AuthError("Invalid MFA code");
  }
  return true;
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

// For signin flow: check if MFA is required but not yet verified
export async function checkMFAForLogin(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<{ required: boolean; tokenHash: string | null }> {
  const rows = await db.execute<{
    two_factor_enabled: boolean;
    two_factor_backup_codes: string[];
  }>(sql`SELECT two_factor_enabled FROM users WHERE id = ${userId} LIMIT 1`);
  const row = (rows as any).rows?.[0] as any;
  if (!row || !row.two_factor_enabled) {
    return { required: false, tokenHash: null };
  }
  const tempToken = crypto.randomUUID();
  const tokenHash = await hashToken(tempToken);
  await db.execute(
    sql`INSERT INTO tokens (user_id, token_type, selector, hashed_validator, status, purpose, expires_at, max_uses)
        VALUES (${userId}, 'access', ${tempToken}, ${tokenHash}, 'active', 'mfa_challenge', ${new Date(Date.now() + 15 * 60_000).toISOString()}, 1)`,
  );
  return { required: true, tokenHash };
}

export async function confirmMFAChallenge(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  token: string,
): Promise<boolean> {
  return verifyMFAForLogin(db, userId, token);
}
