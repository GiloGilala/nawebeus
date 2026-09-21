import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { normaliseIp } from "../../lib/ip";
import {
  buildPage,
  DEFAULT_PAGE_SIZE,
  type Page,
  type PaginationParams,
} from "../../lib/pagination";
import { type AuditActor, writeAuditLog } from "../audit";

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

/**
 * Session / refresh-token lifetime, in seconds.
 *
 * Single source of truth: the refresh JWT's `exp` and the session row's
 * `expires_at` describe the same window, so they must not be computed
 * independently — a session row outliving its token (or vice versa) is a
 * silent auth bug.
 */
export const SESSION_TTL_SECONDS = {
  default: 7 * 24 * 60 * 60,
  rememberMe: 30 * 24 * 60 * 60,
} as const;

export function sessionTtlSeconds(rememberMe: boolean): number {
  return rememberMe ? SESSION_TTL_SECONDS.rememberMe : SESSION_TTL_SECONDS.default;
}

export interface CreateSessionOptions {
  /** Raw client IP as read from a header. Normalised before it reaches the `inet` column. */
  ip?: string;
  userAgent?: string;
}

/**
 * Creates a session row with an explicit sessionId and a hash of the refresh token.
 * The token hash binds the refresh token to this specific session row.
 *
 * `options.ip` is normalised to a real address or `null`. Passing it through
 * unchecked used to 500 the whole sign-in when the caller had no usable header:
 * the route fell back to the literal string `"unknown"`, which `inet` rejects.
 *
 * `expires_at` is NOT NULL on the table and has no default, so it is derived here
 * from the same TTL the refresh token is signed with.
 */
export async function createSession(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  userId: string,
  tokenHash: string,
  rememberMe: boolean,
  options?: CreateSessionOptions,
): Promise<SessionRow> {
  const expiresAt = new Date(Date.now() + sessionTtlSeconds(rememberMe) * 1000).toISOString();
  const rows = await db.execute<{
    id: string;
    user_id: string;
    status: string;
    is_revoked: boolean;
    session_token_hash: string;
  }>(
    sql`
      INSERT INTO sessions (id, user_id, session_token_hash, type, login_method, status, remember_me, ip_address, user_agent, expires_at)
      VALUES (${sessionId}, ${userId}, ${tokenHash}, 'web', 'password', 'active', ${rememberMe}, ${normaliseIp(options?.ip)}, ${options?.userAgent ?? null}, ${expiresAt})
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
  const rows = await db.execute<{
    id: string;
    user_id: string;
    status: string;
    is_revoked: boolean;
    session_token_hash: string;
  }>(
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

/**
 * Revoke one session.
 *
 * `actor` decides whether this call is audited *here*:
 *
 * - **an `AuditActor`** — a user (or machine key) asked for this, so the row is the event:
 *   `auth.session.revoked`, which is what "who signed me out" investigations read.
 * - **`null`** — this is an internal consequence of a bigger operation: refresh-token rotation
 *   (`src/services/auth/auth.service.ts`, twice per rotated session — per-row events there would
 *   write an audit row on every API call) and revoke-all-on-password-change, whose own aggregate
 *   events (`auth.password_reset.completed`, `security.password_changed`, `account.deleted`) already
 *   record that sessions died.
 *
 * The parameter is required rather than optional because an *optional* audit context is how the
 * property gets lost: every caller is forced to pick, in writing, whether it is the event or a
 * side effect of one. That choice used to be invisible, because the audit lived in the route and the
 * service had no idea who called it.
 */
export async function revokeSession(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  actor: AuditActor | null,
): Promise<void> {
  await db.execute(
    sql`
      UPDATE sessions
      SET is_revoked = true, revoked_at = now(), status = 'revoked'
      WHERE id = ${sessionId}
    `,
  );

  if (!actor) return;

  await writeAuditLog({
    db,
    module: "core",
    organizationId: actor.organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "auth.session.revoked",
    resourceId: sessionId,
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
  });
}

/**
 * "Sign out everywhere else": every live session of `userId` except the caller's current one.
 *
 * Belongs in the service, not in a route loop: the count in the audit row is the answer to
 * "how many credentials did this end?", and a caller that reimplemented the loop would quietly
 * produce a different answer. One event for the batch, because N rows for one user action is noise
 * that hides the action.
 */
export async function revokeOtherSessions(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  /** The caller's own session, which survives. `null`/`undefined` means "none named" → all revoked. */
  keepSessionId: string | null | undefined,
  actor: AuditActor,
): Promise<number> {
  // Unpaginated on purpose: revoking "all other" sessions must not stop at a page boundary and
  // leave sessions alive.
  const allIds = await listAllLiveSessionIds(db, userId);
  const toRevoke = keepSessionId ? allIds.filter((id) => id !== keepSessionId) : allIds;

  for (const sessionId of toRevoke) {
    // `null` per row: this batch owns the one aggregate event below.
    await revokeSession(db, sessionId, null);
  }
  if (toRevoke.length === 0) return 0;

  await writeAuditLog({
    db,
    module: "core",
    organizationId: actor.organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "auth.sessions.revoked_others",
    resourceId: userId,
    targetUserId: userId,
    afterState: { revokedCount: toRevoke.length },
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
  });
  return toRevoke.length;
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
  page?: PaginationParams,
): Promise<Page<SessionListEntry>> {
  const limit = page?.limit ?? DEFAULT_PAGE_SIZE;
  const cursor = page?.cursor ?? null;
  // `last_activity_at` is nullable, and a NULL sort key cannot be carried in a
  // cursor: every comparison against NULL is NULL, so paging would stall on the
  // first such row. COALESCE to `created_at` (NOT NULL) gives a total order the
  // keyset comparison can resume from, and removes the need for the previous
  // `NULLS LAST` — there are no NULLs left to place.
  const after = cursor
    ? sql`AND (COALESCE(last_activity_at, created_at), id) < (${cursor.v}::timestamptz, ${cursor.id}::uuid)`
    : sql``;
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
    cursor_v: string;
  }>(
    sql`
      SELECT id, status, is_revoked, remember_me, type, login_method,
             ip_address, user_agent, device_type, device_name, device_os,
             browser_name, browser_version, location_country, location_city,
             expires_at, last_activity_at, created_at, mfa_method, authentication_level,
             to_char(
               COALESCE(last_activity_at, created_at) AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.USOF'
             ) AS cursor_v
      FROM sessions
      WHERE user_id = ${userId}
        AND is_revoked = false
        ${after}
      ORDER BY COALESCE(last_activity_at, created_at) DESC, id DESC
      LIMIT ${limit + 1}
    `,
  );

  const mapped = ((rows as any).rows ?? []).map((r: any) => ({
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
    _cursorV: r.cursor_v as string,
  }));
  return buildPage(mapped, limit, (x: any) => x._cursorV);
}

/**
 * Every live session id for a user, unpaginated.
 *
 * "Revoke all other sessions" must act on *all* of them. Iterating the
 * paginated list would silently stop at the page size and leave the rest of a
 * compromised user's sessions alive — a security action that quietly does only
 * part of its job. Callers that revoke use this; callers that display use the
 * paginated `listUserSessions`.
 */
export async function listAllLiveSessionIds(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM sessions WHERE user_id = ${userId} AND is_revoked = false`,
  );
  return ((rows as any).rows ?? []).map((r: any) => r.id as string);
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
