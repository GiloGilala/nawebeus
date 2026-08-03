import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { getUserByEmail } from "../users/user.service";
import { createToken, consumeToken } from "./tokens";
import { recordPasswordChange, isPasswordInHistory } from "./password-history";
import { emailService } from "../email";
import { writeAuditLog } from "../audit";
import { validatePassword } from "../../lib/password";
import { AuthError, ConflictError, NotFoundError } from "../../lib/errors";
import { revokeAllSessionsForUser } from "./session";

const RESET_TTL_MINUTES = 60;

export async function forgotPassword(
  db: NodePgDatabase<Record<string, any>>,
  email: string,
  origin: string,
): Promise<void> {
  const user = await getUserByEmail(db, email);

  if (user) {
    const { rawToken } = await createToken(db, {
      userId: user.id,
      tokenType: "password_reset",
      purpose: "password_reset",
      targetEmail: email,
      expiresInMinutes: RESET_TTL_MINUTES,
    });

    const link = `${origin}/reset-password?token=${rawToken}`;

    await emailService.send({
      to: email,
      subject: "Reset your Nawebeus password",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${link}">Reset Password</a></p>
        <p>This link expires in 1 hour and can only be used once.</p>
      `,
    });

    await writeAuditLog({
      db,
      module: "core",
      actorId: user.id,
      actorType: "user",
      action: "auth.password_reset.requested",
      category: "authentication",
      resourceType: "user",
      resourceId: user.id,
    });
  }
  // Always return void — caller shows generic success message regardless
}

export interface ResetPasswordResult {
  success: boolean;
  email: string | null;
}

export async function resetPassword(
  db: NodePgDatabase<Record<string, any>>,
  rawToken: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const token = await consumeToken(db, rawToken, "password_reset");
  if (!token) {
    throw new AuthError("Invalid or expired reset token");
  }

  const user = await getUserById(db, token.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (user.status === "deleted") {
    throw new AuthError("Account is deleted");
  }

  const validation = validatePassword(newPassword, {
    username: user.username,
    email: user.email,
  });
  if (!validation.valid) {
    throw new ConflictError(`Password does not meet complexity requirements: ${validation.errors.join("; ")}`);
  }

  const inHistory = await isPasswordInHistory(db, token.userId, newPassword);
  if (inHistory) {
    throw new ConflictError("New password must not match any of your last 5 passwords");
  }

  await recordPasswordChange(db, token.userId, newPassword);

  // Invalidate all active sessions
  await revokeAllSessionsForUser(db, token.userId);

  await writeAuditLog({
    db,
    module: "core",
    actorId: token.userId,
    actorType: "user",
    action: "auth.password_reset.completed",
    category: "authentication",
    resourceType: "user",
    resourceId: token.userId,
  });

  return { success: true, email: user.email };
}

async function getUserById(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<{ id: string; email: string; username: string; status: string } | null> {
  const rows = await db.execute<{ id: string; email: string; username: string; status: string }>(
    sql`SELECT id, email, username, status FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return { id: row.id, email: row.email, username: row.username, status: row.status };
}
