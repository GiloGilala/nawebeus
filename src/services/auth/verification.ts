import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AuthError, ConflictError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";
import { getUserByEmail } from "../users/user.service";
import { consumeToken, countRecentTokens, createToken } from "./tokens";

const VERIFICATION_TTL_MINUTES = 24 * 60;
const MAX_RESENDS_PER_HOUR = 3;

export interface SendVerificationResult {
  sent: boolean;
  message: string;
}

export async function sendVerificationEmail(
  db: NodePgDatabase<Record<string, any>>,
  email: string,
  origin: string,
): Promise<SendVerificationResult> {
  const user = await getUserByEmail(db, email);
  if (!user) {
    return {
      sent: false,
      message: "If an account with that email exists, a verification link has been sent.",
    };
  }

  if (user.emailVerified) {
    throw new ConflictError("Email is already verified");
  }

  if (user.status === "pending_verification" || user.status === "active") {
    // OK
  } else if (user.status === "deleted") {
    throw new AuthError("Account is deleted");
  }

  const recent = await countRecentTokens(db, user.id, "email_verification", 60);
  if (recent >= MAX_RESENDS_PER_HOUR) {
    throw new ConflictError("Verification email rate limit exceeded. Try again later.");
  }

  const { rawToken } = await createToken(db, {
    userId: user.id,
    tokenType: "email_verification",
    purpose: "email_verification",
    targetEmail: email,
    expiresInMinutes: VERIFICATION_TTL_MINUTES,
  });

  const link = `${origin}/api/auth/verify-email?token=${rawToken}`;

  await emailService.send({
    to: email,
    subject: "Verify your Nawebeus email",
    html: `
      <h2>Welcome to Nawebeus</h2>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${link}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  await writeAuditLog({
    db,
    module: "core",
    actorId: user.id,
    actorType: "user",
    action: "auth.email_verification.sent",
    category: "authentication",
    resourceType: "user",
    resourceId: user.id,
  });

  return { sent: true, message: "Verification email sent." };
}

export async function verifyEmail(
  db: NodePgDatabase<Record<string, any>>,
  rawToken: string,
): Promise<{ userId: string; email: string }> {
  const token = await consumeToken(db, rawToken, "email_verification");
  if (!token) {
    throw new AuthError("Invalid or expired verification token");
  }

  const user = await getUserById(db, token.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  await db.execute(
    sql`
      UPDATE users
      SET email_verified = true, email_verified_at = now(), status = 'active'
      WHERE id = ${token.userId} AND email_verified = false
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    actorId: token.userId,
    actorType: "user",
    action: "auth.email_verification.completed",
    category: "authentication",
    resourceType: "user",
    resourceId: token.userId,
  });

  return { userId: token.userId, email: user.email };
}

async function getUserById(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<{
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
} | null> {
  const rows = await db.execute<{
    id: string;
    email: string;
    email_verified: boolean;
    status: string;
  }>(sql`SELECT id, email, email_verified, status FROM users WHERE id = ${userId} LIMIT 1`);
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    status: row.status,
  };
}
