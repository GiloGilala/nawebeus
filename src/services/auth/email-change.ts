import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createToken, consumeToken, countRecentTokens } from "./tokens";
import { getUserByEmail } from "../users/user.service";
import { getConfig } from "../../lib/config";
import { ConflictError, ValidationError, NotFoundError } from "../../lib/errors";
import { emailService } from "../email";
import { writeAuditLog } from "../audit";

const EMAIL_CHANGE_TTL_MIN = 24 * 60; // 24h in minutes for createToken
const RATE_LIMIT = 3;
const RATE_WINDOW_MIN = 60;

export interface EmailChangeRequestInput {
  newEmail: string;
}

export interface EmailChangeConfirmInput {
  token: string;
}

export interface EmailChangeResult {
  message: string;
}

/**
 * Requests an email change. Generates a single-use token, stores it hashed in
 * the `tokens` table, and emails a confirmation link to the new address.
 * Does NOT change the user's email until confirmation.
 */
export async function requestEmailChange(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  input: EmailChangeRequestInput,
): Promise<EmailChangeResult> {
  // Verify the new email isn't already taken by another active user
  const existing = await getUserByEmail(db, input.newEmail);
  if (existing && existing.id !== userId) {
    throw new ConflictError("This email is already in use by another account");
  }

  // Rate limit: max 3 requests per hour per user
  const recent = await countRecentTokens(db, userId, "email_change", RATE_WINDOW_MIN);
  if (recent >= RATE_LIMIT) {
    throw new ValidationError("Email change requests are rate limited. Try again later.");
  }

  const { rawToken, row } = await createToken(db, {
    userId,
    tokenType: "email_verification",
    purpose: "email_change",
    targetEmail: input.newEmail,
    expiresInMinutes: EMAIL_CHANGE_TTL_MIN,
    maxUses: 1,
  });

  const config = getConfig();
  const confirmLink = `${config.CORS_ORIGIN}/change-email/confirm?token=${rawToken}`;

  await emailService.send({
    to: input.newEmail,
    subject: "Confirm your new Nawebeus email address",
    html: `
      <h2>Confirm your new email</h2>
      <p>Click below to confirm this new email address for your Nawebeus account.</p>
      <p><a href="${confirmLink}">Confirm Email Change</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.email_change.requested",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
    afterState: { newEmail: input.newEmail },
  });

  void row; // token row stored; rawToken sent to user via email
  return { message: "A confirmation email has been sent to the new address" };
}

/**
 * Confirms an email change using the token. Validates the token (hash + expiry
 * + single-use), updates the user's email, and marks the token as used.
 */
export async function confirmEmailChange(
  db: NodePgDatabase<Record<string, any>>,
  input: EmailChangeConfirmInput,
): Promise<EmailChangeResult> {
  const tokenRow = await consumeToken(db, input.token, "email_change");
  if (!tokenRow) {
    throw new NotFoundError("Invalid or expired token");
  }

  await db.execute(
    sql`UPDATE users SET email = ${tokenRow.targetEmail}, last_email_change_at = now() WHERE id = ${tokenRow.userId} AND deleted_at IS NULL`,
  );

  await writeAuditLog({
    db,
    module: "core",
    actorId: tokenRow.userId,
    actorType: "user",
    action: "auth.email_change.confirmed",
    category: "authentication",
    resourceType: "user",
    resourceId: tokenRow.userId,
    afterState: { newEmail: tokenRow.targetEmail },
  });

  return { message: "Your email has been updated" };
}
