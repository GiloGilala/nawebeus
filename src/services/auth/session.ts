import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

export interface SessionRow {
  id: string;
  userId: string;
  status: string;
  isRevoked: boolean;
  tokenHash: string;
}

export interface SessionDetail {
  id: string;
  userId: string;
  status: string;
  isRevoked: boolean;
  rememberMe: boolean;
  type: string;
  loginMethod: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  deviceName: string | null;
  deviceOs: string | null;
  browserName: string | null;
  browserVersion: string | null;
  locationCountry: string | null;
  locationCity: string | null;
  timezone: string | null;
  expiresAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date | null;
  revokedAt: Date | null;
  tokenHash: string;
  mfaVerifiedAt: Date | null;
  mfaMethod: string | null;
  authenticationLevel: string | null;
}

export interface SessionListEntry {
  id: string;
  status: string;
  isRevoked: boolean;
  rememberMe: boolean;
  deviceType: string | null;
  deviceName: string | null;
  browserName: string | null;
  browserVersion: string | null;
  locationCountry: string | null;
  locationCity: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date | null;
  mfaMethod: string | null;
  authenticationLevel: string | null;
}

export interface CreateSessionOptions {
  ip?: string;
  userAgent?: string;
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
  options?: CreateSessionOptions,
): Promise<SessionRow> {
  const rows = await db.execute<{ id: string; user_id: string; status: string; is_revoked: boolean; session_token_hash: string }>(
    sql`
      INSERT INTO sessions (id, user_id, session_token_hash, type, login_method, status, remember_me, ip_address, user_agent)
      VALUES (${sessionId}, ${userId}, ${tokenHash}, 'web', 'password', 'active', ${rememberMe}, ${options?.ip ?? null}, ${options?.userAgent ?? null})
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

export async function revokeAllSessionsForUser(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<number> {
  const rows = await db.execute<{ count: string }>(
    sql`
      UPDATE sessions
      SET is_revoked = true, revoked_at = now(), status = 'revoked'
      WHERE user_id = ${userId}
        AND is_revoked = false
      RETURNING id
    `,
  );
  return (rows as any).rows?.length ?? 0;
}

export async function listUserSessions(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<SessionListEntry[]> {
  const rows = await db.execute<{
    id: string;
    status: string;
    is_revoked: boolean;
    remember_me: boolean;
    type: string;
    login_method: string;
    ip_address: string;
    user_agent: string;
    device_type: string;
    device_name: string;
    device_os: string;
    browser_name: string;
    browser_version: string;
    location_country: string;
    location_city: string;
    expires_at: Date;
    last_activity_at: Date;
    created_at: Date;
    mfa_method: string;
    authentication_level: string;
  }>(
    sql`
      SELECT id, status, is_revoked, remember_me, type, login_method,
             ip_address, user_agent, device_type, device_name, device_os,
             browser_name, browser_version, location_country, location_city,
             expires_at, last_activity_at, created_at, mfa_method, authentication_level
      FROM sessions
      WHERE user_id = ${userId}
        AND is_revoked = false
      ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    `,
  );

  return ((rows as any).rows ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    isRevoked: r.is_revoked,
    rememberMe: r.remember_me,
    deviceType: r.device_type ?? null,
    deviceName: r.device_name ?? null,
    browserName: r.browser_name ?? null,
    browserVersion: r.browser_version ?? null,
    locationCountry: r.location_country ?? null,
    locationCity: r.location_city ?? null,
    ipAddress: r.ip_address ?? null,
    userAgent: r.user_agent ?? null,
    expiresAt: r.expires_at ? new Date(r.expires_at) : null,
    lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at) : null,
    createdAt: r.created_at ? new Date(r.created_at) : null,
    mfaMethod: r.mfa_method ?? null,
    authenticationLevel: r.authentication_level ?? null,
  }));
}

export async function getSessionDetail(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  userId: string,
): Promise<SessionDetail | null> {
  const rows = await db.execute<{
    id: string;
    user_id: string;
    status: string;
    is_revoked: boolean;
    session_token_hash: string;
    remember_me: boolean;
    type: string;
    login_method: string;
    ip_address: string;
    user_agent: string;
    device_type: string;
    device_name: string;
    device_os: string;
    device_os_version: string;
    browser_name: string;
    browser_version: string;
    location_country: string;
    location_region: string;
    location_city: string;
    timezone: string;
    expires_at: Date;
    last_activity_at: Date;
    created_at: Date;
    revoked_at: Date;
    mfa_verified_at: Date;
    mfa_method: string;
    authentication_level: string;
  }>(
    sql`
      SELECT id, user_id, status, is_revoked, session_token_hash, remember_me,
             type, login_method, ip_address, user_agent, device_type, device_name,
             device_os, device_os_version, browser_name, browser_version,
             location_country, location_region, location_city, timezone,
             expires_at, last_activity_at, created_at, revoked_at,
             mfa_verified_at, mfa_method, authentication_level
      FROM sessions
      WHERE id = ${sessionId}
        AND user_id = ${userId}
      LIMIT 1
    `,
  );

  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    isRevoked: row.is_revoked,
    tokenHash: row.session_token_hash,
    rememberMe: row.remember_me,
    type: row.type,
    loginMethod: row.login_method,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    deviceType: row.device_type ?? null,
    deviceName: row.device_name ?? null,
    deviceOs: row.device_os ?? null,
    browserName: row.browser_name ?? null,
    browserVersion: row.browser_version ?? null,
    locationCountry: row.location_country ?? null,
    locationCity: row.location_city ?? null,
    timezone: row.timezone ?? null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    mfaVerifiedAt: row.mfa_verified_at ? new Date(row.mfa_verified_at) : null,
    mfaMethod: row.mfa_method ?? null,
    authenticationLevel: row.authentication_level ?? null,
  };
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
