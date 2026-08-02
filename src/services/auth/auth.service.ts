import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { AuthError } from "../../lib/errors";
import { verifyPassword } from "./password";
import { signAccessToken, signRefreshToken, verifyToken } from "./jwt";
import { createSession, findSession, revokeSession, hashToken } from "./session";

export interface SignInInput {
  email: string;
  password: string;
}

export interface SessionResult {
  userId: string;
  orgId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

export async function signIn(
  db: NodePgDatabase<Record<string, any>>,
  input: SignInInput,
): Promise<SessionResult> {
  const config = getConfig();
  const { email, password } = input;

  const rows = await db.execute<{ id: string; password: string; organization_id: string }>(
    sql`SELECT id, password, organization_id FROM users WHERE email = ${email} LIMIT 1`,
  );
  const user = (rows as any).rows?.[0] as any;
  if (!user) throw new AuthError("Invalid email or password");

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new AuthError("Invalid email or password");

  const userId = user.id as string;
  const orgId = (user.organization_id as string) ?? "";

  // Create session with a real hash of the refresh token
  const sessionId = crypto.randomUUID();
  const refreshToken = await signRefreshToken(sessionId, config.JWT_REFRESH_SECRET);
  const tokenHash = await hashToken(refreshToken);
  const session = await createSession(db, sessionId, userId, tokenHash, false);

  const accessToken = await signAccessToken(userId, orgId, config.JWT_ACCESS_SECRET);

  await db.execute(sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`);

  return {
    userId,
    orgId,
    sessionId: session.id,
    accessToken,
    refreshToken,
  };
}

export async function refreshSession(
  db: NodePgDatabase<Record<string, any>>,
  refreshToken: string,
): Promise<SessionResult> {
  const config = getConfig();

  let payload;
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

  // Rotate: revoke old session, create new one
  await revokeSession(db, session.id);
  const newSessionId = crypto.randomUUID();
  const newRefreshToken = await signRefreshToken(newSessionId, config.JWT_REFRESH_SECRET);
  const newTokenHash = await hashToken(newRefreshToken);
  const newSession = await createSession(db, newSessionId, session.userId, newTokenHash, false);

  // Look up user org
  const rows = await db.execute<{ organization_id: string }>(
    sql`SELECT organization_id FROM users WHERE id = ${session.userId} LIMIT 1`,
  );
  const orgId = ((rows as any).rows?.[0] as any)?.organization_id ?? "";

  const accessToken = await signAccessToken(session.userId, orgId, config.JWT_ACCESS_SECRET);

  return {
    userId: session.userId,
    orgId,
    sessionId: newSession.id,
    accessToken,
    refreshToken: newRefreshToken,
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
