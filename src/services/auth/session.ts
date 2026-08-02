import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

export interface SessionRow {
  id: string;
  userId: string;
  status: string;
  isRevoked: boolean;
  tokenHash: string;
}

/**
 * Creates a session row with an explicit sessionId and a hash of the refresh token.
 * The token hash binds the refresh token to this specific session row.
 */
export async function createSession(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  userId: string,
  tokenHash: string,
  rememberMe: boolean,
): Promise<SessionRow> {
  const rows = await db.execute<{ id: string; user_id: string; status: string; is_revoked: boolean; session_token_hash: string }>(
    sql`
      INSERT INTO sessions (id, user_id, session_token_hash, type, login_method, status, remember_me)
      VALUES (${sessionId}, ${userId}, ${tokenHash}, 'web', 'password', 'active', ${rememberMe})
      RETURNING id, user_id, status, is_revoked, session_token_hash
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    isRevoked: row.is_revoked,
    tokenHash: row.session_token_hash,
  };
}

export async function findSession(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
): Promise<SessionRow | null> {
  const rows = await db.execute<{ id: string; user_id: string; status: string; is_revoked: boolean; session_token_hash: string }>(
    sql`SELECT id, user_id, status, is_revoked, session_token_hash FROM sessions WHERE id = ${sessionId} LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    isRevoked: row.is_revoked,
    tokenHash: row.session_token_hash,
  };
}

export async function revokeSession(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
): Promise<void> {
  await db.execute(
    sql`
      UPDATE sessions
      SET is_revoked = true, revoked_at = now(), status = 'revoked'
      WHERE id = ${sessionId}
    `,
  );
}

/**
 * SHA-256 hex digest of a refresh token. The digest, not the token, is stored in the
 * session_token_hash column so a DB read alone cannot be used to mint sessions.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
