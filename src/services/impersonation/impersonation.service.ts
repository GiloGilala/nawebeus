/**
 * Impersonation sessions (NWB-P1-011) — support access with an unbreakable audit trail.
 *
 * An admin (holder of `users.impersonate`) opens a time-boxed session inside another account's
 * identity to reproduce and fix their problem. The rules this module enforces come from the
 * System Administration module spec and are not negotiable at the call sites:
 *
 * - **MFA + written justification** (BR-ADMIN-008): no enrolled MFA → no impersonation, and
 *   every start re-verifies with a fresh TOTP/backup code (step-up, not "they logged in with
 *   MFA once this morning").
 * - **4 hours, maximum** (FR-ADMIN-015): durations are clamped on write, and the scheduled
 *   `impersonation.expire` sweep closes whatever a client never closed.
 * - **Every action tagged** (BR-ADMIN-021): the token puts the request into an impersonation
 *   scope (`src/lib/impersonation-context.ts`); `writeAuditLog` retags rows out of that scope
 *   (`actor_type='impersonation'`, `actor_id` = the admin, `impersonation_session_id`,
 *   `target_user_id` = the account). Neither property lives in the routes, where a refactor
 *   could quietly lose it — the scope and the writer own it, and the database's CHECK pair
 *   (`chk_ual_impersonation_consistency` / `chk_ual_impersonation_only`) is the net under both.
 * - **Clean end**: ended means ended — the row is the source of truth, the middleware
 *   re-validates it on every request (`resolveLiveImpersonation`), so `security_terminated`
 *   bites the next request rather than the next token expiry.
 * - **Least privilege inside the session** (BR-ADMIN-009): the admin acts with the *target's*
 *   abilities minus a hard deny-list (billing, org deletion, team writes, nested
 *   impersonation) — see `ability.ts`. You cannot do to their organization what they could
 *   not do either.
 *
 * The table (`impersonation_sessions`, adopted this ticket) carries no FK to `users` on
 * purpose: a compliance record outlives the accounts it names, exactly like the audit rows
 * that point at it.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  ConflictError,
  ForbiddenError,
  ImpersonationActiveError,
  MfaRequiredError,
  NotFoundError,
  SelfImpersonationError,
} from "../../lib/errors";
import { normaliseIp } from "../../lib/ip";
import { logger } from "../../lib/logger";
import {
  buildPage,
  type CursorIdShape,
  type Page,
  type PaginationParams,
} from "../../lib/pagination";
import { withAtomicWrites } from "../../lib/transaction";
import { writeAuditLog } from "../audit";
import { assertAccountCanAuthenticate } from "../auth/auth.service";
import { signImpersonationToken } from "../auth/jwt";
import { verifyMFAForLogin } from "../auth/mfa";
import { emailService } from "../email";

/** Row shape the lifecycle functions read and return. */
export interface ImpersonationSessionRow {
  id: string;
  organizationId: string;
  adminUserId: string;
  targetUserId: string;
  reason: string;
  ticketId: string | null;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  mfaVerified: boolean;
  securityNotified: boolean;
}

/**
 * Session-window constants (BR-ADMIN-008 / FR-ADMIN-015). The default is an hour of support
 * time; five minutes is the shortest window that still makes sense for a hand-off demo; four
 * hours is the hard maximum — a `durationMinutes` beyond it is clamped, not rejected, so a
 * client bug cannot turn "as long as needed" into an override.
 */
export const IMPERSONATION_DEFAULT_MINUTES = 60;
export const IMPERSONATION_MIN_MINUTES = 5;
export const IMPERSONATION_MAX_MINUTES = 240;

/** The token's own TTL: never longer than the normal access token, whatever the window says. */
export const IMPERSONATION_TOKEN_TTL_SECONDS = 900;

/** Per-run ceiling for the expiry sweep — a runaway table cannot make one run unbounded. */
const EXPIRY_BATCH_LIMIT = 200;

/** List cursors carry `imp_<uuid>` session ids, not bare uuids (see `decodeCursor`). */
export const IMPERSONATION_ID_PATTERN = /^imp_[0-9a-f-]{36}$/i;

function clampDurationMinutes(requested: number | undefined): number {
  if (requested === undefined) return IMPERSONATION_DEFAULT_MINUTES;
  return Math.min(Math.max(requested, IMPERSONATION_MIN_MINUTES), IMPERSONATION_MAX_MINUTES);
}

type SessionRowRaw = {
  id: string;
  organization_id: string;
  admin_user_id: string;
  target_user_id: string;
  reason: string;
  ticket_id: string | null;
  started_at: Date;
  expires_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
  mfa_verified: boolean;
  security_notified: boolean;
};

const SESSION_COLUMNS = sql`
  id, organization_id, admin_user_id, target_user_id, reason, ticket_id,
  started_at, expires_at, ended_at, end_reason, mfa_verified, security_notified
`;

function mapRow(raw: SessionRowRaw): ImpersonationSessionRow {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    adminUserId: raw.admin_user_id,
    targetUserId: raw.target_user_id,
    reason: raw.reason,
    ticketId: raw.ticket_id,
    startedAt: new Date(raw.started_at),
    expiresAt: new Date(raw.expires_at),
    endedAt: raw.ended_at ? new Date(raw.ended_at) : null,
    endReason: raw.end_reason,
    mfaVerified: raw.mfa_verified,
    securityNotified: raw.security_notified,
  };
}

async function selectSessionRow(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  organizationId?: string,
): Promise<ImpersonationSessionRow | null> {
  const rows = (await db.execute<SessionRowRaw>(sql`
      SELECT ${SESSION_COLUMNS}
      FROM impersonation_sessions
      WHERE id = ${sessionId}
        ${organizationId ? sql`AND organization_id = ${organizationId}` : sql``}
      LIMIT 1
    `)) as any;
  const raw = rows.rows?.[0] as SessionRowRaw | undefined;
  return raw ? mapRow(raw) : null;
}

/**
 * The token's TTL: the window's remainder, capped at the normal access-token lifetime. A long
 * support session re-mints through `mintImpersonationToken` rather than holding a four-hour
 * credential — the same doctrine that caps every access token in this codebase at 900 s.
 */
function tokenTtlSeconds(expiresAt: Date, now = Date.now()): number {
  const remainingSeconds = Math.floor((expiresAt.getTime() - now) / 1000);
  return Math.max(Math.min(remainingSeconds, IMPERSONATION_TOKEN_TTL_SECONDS), 1);
}

// ─── Start ────────────────────────────────────────────────────────────────────────────────────

export interface StartImpersonationInput {
  organizationId: string;
  adminUserId: string;
  targetUserId: string;
  /** Written justification — required, shown to the target and to security reviewers. */
  reason: string;
  ticketId?: string | undefined;
  durationMinutes?: number | undefined;
  /** MFA step-up code (TOTP or backup). Required whenever the admin has MFA enrolled. */
  mfaCode?: string | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
  /** JWT access secret — injected so tests (and callers) sign with the configured secret. */
  accessSecret: string;
}

export interface StartImpersonationResult {
  session: ImpersonationSessionRow;
  /** The short-lived impersonation access token. Also set as the access cookie by the route. */
  token: string;
  tokenExpiresAt: string;
  /** True when this call re-entered the admin's own still-active session instead of a new one. */
  reentered: boolean;
}

/**
 * Start (or re-enter) an impersonation session.
 *
 * Throws, in order: `SelfImpersonationError` (403), `NotFoundError` (404 — unknown target,
 * soft-deleted target, or target outside the caller's organization: one answer, so the route
 * cannot be used to enumerate accounts), `MfaRequiredError` (401 — not enrolled, or enrolled
 * without a code), `AuthError` (401 — wrong code), `ImpersonationActiveError` (409 — another
 * admin is already inside this account), `AccountSuspendedError` et al. (the target's status
 * must allow sign-in, or there is no working session to step into).
 */
export async function startImpersonation(
  db: NodePgDatabase<Record<string, any>>,
  input: StartImpersonationInput,
): Promise<StartImpersonationResult> {
  if (input.targetUserId === input.adminUserId) {
    throw new SelfImpersonationError("You cannot impersonate your own account");
  }

  // ── MFA step-up before any state change or expensive lookup: the control that gates the
  // whole feature fails first and cheapest.
  const adminRows = (await db.execute<{ two_factor_enabled: boolean; email: string }>(sql`
      SELECT two_factor_enabled, email FROM users WHERE id = ${input.adminUserId} LIMIT 1
    `)) as any;
  const admin = adminRows.rows?.[0] as { two_factor_enabled: boolean; email: string } | undefined;
  if (!admin) throw new NotFoundError("Admin account not found");

  let mfaVerified = false;
  if (admin.two_factor_enabled) {
    if (!input.mfaCode) {
      throw new MfaRequiredError("An MFA code is required to start an impersonation session");
    }
    // Reuses the sign-in verifier on purpose: same TOTP/backup-code semantics, same single-use
    // backup-code consumption, and the step-up writes its own `auth.mfa.verified` /
    // `auth.mfa.failed` rows — so the trail shows the code being presented *for this*.
    await verifyMFAForLogin(
      db,
      input.adminUserId,
      input.mfaCode,
      ...(input.ip ? [{ ip: input.ip }] : []),
    );
    mfaVerified = true;
  } else {
    // BR-ADMIN-008 says impersonation *requires* MFA — an admin who never enrolled does not
    // get to bypass the control by omission.
    throw new MfaRequiredError(
      "Impersonation requires MFA. Enroll in multi-factor authentication before using support impersonation.",
    );
  }

  // ── Target: must exist, not be deleted, and be an active member of the caller's org.
  const targetRows = (await db.execute<{
    id: string;
    email: string;
    status: string;
    deleted_at: string | null;
    member_id: string | null;
  }>(sql`
      SELECT u.id, u.email, u.status, u.deleted_at,
             (SELECT om.id FROM organization_members om
               WHERE om.user_id = u.id AND om.organization_id = ${input.organizationId}
                 AND om.status = 'active' AND om.deleted_at IS NULL LIMIT 1) AS member_id
      FROM users u WHERE u.id = ${input.targetUserId} LIMIT 1
    `)) as any;
  const target = targetRows.rows?.[0] as
    | {
        id: string;
        email: string;
        status: string;
        deleted_at: string | null;
        member_id: string | null;
      }
    | undefined;
  // One 404 for "unknown", "deleted", and "not in your organization" — a differentiated
  // answer is an account-existence oracle for anyone holding `users.impersonate`.
  if (!target || target.deleted_at !== null || target.member_id === null) {
    throw new NotFoundError("User not found");
  }
  // A suspended / unverified target has no working session to step into; impersonating one
  // would mint tokens the middleware refuses on the very next request.
  assertAccountCanAuthenticate(target.status);

  const durationMinutes = clampDurationMinutes(input.durationMinutes);
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  // ── The critical section: one impersonator per target, re-entry for the same admin, then
  // the insert and its audit row. Atomic so two admins clicking at once cannot both pass the
  // open-session check (the email that follows deliberately sits outside — a queued send must
  // not commit with a business write that could still roll back).
  const created = await withAtomicWrites(db, async (tx) => {
    const openRows = (await tx.execute<{
      id: string;
      admin_user_id: string;
      expires_at: Date;
    }>(sql`
        SELECT id, admin_user_id, expires_at FROM impersonation_sessions
        WHERE target_user_id = ${input.targetUserId}
          AND organization_id = ${input.organizationId}
          AND ended_at IS NULL
        ORDER BY started_at ASC
        FOR UPDATE
      `)) as any;
    const open = openRows.rows as
      | { id: string; admin_user_id: string; expires_at: Date }[]
      | undefined;

    for (const row of open ?? []) {
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        // Close the lapsed row inline — the sweep would within five minutes anyway, but a
        // start that found the account "busy" because of a just-lapsed ghost would be a
        // support flow that jams on its own cleanup.
        await tx.execute(sql`
            UPDATE impersonation_sessions
            SET ended_at = now(), end_reason = 'expired'
            WHERE id = ${row.id} AND ended_at IS NULL
          `);
        continue;
      }
      if (row.admin_user_id === input.adminUserId) {
        // Re-entry: same admin, same target, window still open → the SAME session gets a new
        // token. Stacking a second row would fork the audit trail mid-support.
        const reenteredRows = (await tx.execute<SessionRowRaw>(sql`
            SELECT ${SESSION_COLUMNS} FROM impersonation_sessions WHERE id = ${row.id} LIMIT 1
          `)) as any;
        const session = mapRow(reenteredRows.rows[0] as SessionRowRaw);
        await writeAuditLog({
          db: tx,
          module: "admin",
          organizationId: session.organizationId,
          actorId: input.adminUserId,
          actorType: "admin",
          action: "admin.impersonation.reentered",
          resourceId: session.id,
          targetUserId: session.targetUserId,
          afterState: { via: "start", reason: session.reason },
          ...(input.ip ? { actorIp: input.ip } : {}),
          ...(input.userAgent ? { actorUserAgent: input.userAgent } : {}),
        });
        return { kind: "reentered" as const, session };
      }
      throw new ImpersonationActiveError(
        "Another admin is already impersonating this user",
        row.id,
      );
    }

    const sessionId = `imp_${crypto.randomUUID()}`;
    const inserted = (await tx.execute<SessionRowRaw>(sql`
        INSERT INTO impersonation_sessions (
          id, organization_id, admin_user_id, target_user_id, reason, ticket_id,
          ip_address, user_agent, started_at, expires_at, mfa_verified
        ) VALUES (
          ${sessionId}, ${input.organizationId}, ${input.adminUserId}, ${input.targetUserId},
          ${input.reason}, ${input.ticketId ?? null}, ${normaliseIp(input.ip)},
          ${input.userAgent ?? null}, now(), ${expiresAt.toISOString()}, ${mfaVerified}
        )
        RETURNING ${SESSION_COLUMNS}
      `)) as any;
    const session = mapRow(inserted.rows[0] as SessionRowRaw);

    await writeAuditLog({
      db: tx,
      module: "admin",
      organizationId: input.organizationId,
      actorId: input.adminUserId,
      actorType: "admin",
      // `warning`, not the default `info`: a human is now inside someone else's account. The
      // registry supplies category and resource type; severity is the one field whose meaning
      // belongs to this call site ("pay attention to this row").
      severity: "warning",
      action: "admin.impersonation.started",
      resourceId: session.id,
      targetUserId: session.targetUserId,
      afterState: {
        reason: session.reason,
        ...(session.ticketId ? { ticketId: session.ticketId } : {}),
        durationMinutes,
        expiresAt: session.expiresAt.toISOString(),
        mfaVerified,
      },
      ...(input.ip ? { actorIp: input.ip } : {}),
      ...(input.userAgent ? { actorUserAgent: input.userAgent } : {}),
    });

    return { kind: "created" as const, session };
  });

  const session = created.session;
  const ttl = tokenTtlSeconds(session.expiresAt);
  const token = await signImpersonationToken(
    {
      targetUserId: session.targetUserId,
      orgId: session.organizationId,
      impersonationSessionId: session.id,
      impersonatorId: session.adminUserId,
    },
    input.accessSecret,
    ttl,
  );

  // The notification sits outside the atomic block on purpose (a queued send must not commit
  // with a business write that could still roll back); its outcome is folded into the returned
  // snapshot so the caller sees the flag the row now carries.
  let notified = false;
  if (created.kind === "created") {
    notified = await notifyTarget(db, session, {
      adminEmail: admin.email,
      orgId: input.organizationId,
      durationMinutes,
    });
  }

  return {
    session: notified ? { ...session, securityNotified: true } : session,
    token,
    tokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    reentered: created.kind === "reentered",
  };
}

/**
 * Tell the target their account was accessed (schema comment step 4). Best-effort by the
 * email contract — `send()` never throws; only the flag flip observes the outcome, and a
 * failed delivery leaves `security_notified = false` for an operator to see. There is
 * deliberately no retry job: the next impersonation of the same user re-notifies.
 */
async function notifyTarget(
  db: NodePgDatabase<Record<string, any>>,
  session: ImpersonationSessionRow,
  ctx: { adminEmail: string; orgId: string; durationMinutes: number },
): Promise<boolean> {
  try {
    const rows = (await db.execute<{ email: string }>(
      sql`SELECT email FROM users WHERE id = ${session.targetUserId} LIMIT 1`,
    )) as any;
    const to = (rows.rows?.[0] as { email: string } | undefined)?.email;
    if (!to) return false;

    const result = await emailService.send({
      kind: "impersonation",
      context: { organizationId: ctx.orgId, userId: session.targetUserId },
      to,
      subject: "Support accessed your account",
      html: `
        <h2>Your account was accessed by support</h2>
        <p>An administrator (${ctx.adminEmail}) opened a support session in your account
        for up to ${ctx.durationMinutes} minutes, starting ${new Date().toISOString()}.</p>
        <p>Reason given: ${session.reason}</p>
        <p>If you did not expect this, contact your organization's owner.</p>
      `,
    });
    if (result.status === "failed") {
      logger.warn("impersonation.target_notification_failed", {
        sessionId: session.id,
        status: result.status,
      });
      return false;
    }
    await db.execute(sql`
        UPDATE impersonation_sessions
        SET security_notified = true, security_notified_at = now()
        WHERE id = ${session.id}
      `);
    return true;
  } catch (error) {
    // The email path itself broke (transport construction, address lookup). Never fail the start.
    logger.warn("impersonation.target_notification_error", {
      sessionId: session.id,
      error: String(error),
    });
    return false;
  }
}

// ─── Re-mint ─────────────────────────────────────────────────────────────────────────────────

export interface MintTokenInput {
  sessionId: string;
  organizationId: string;
  adminUserId: string;
  accessSecret: string;
}

/**
 * Re-mint the access token inside a still-live window (`POST …/impersonations/:id/token`).
 * Only the session's own admin may hold its credential — a second admin's remedy is
 * `security_terminated`, not a borrowed token. Audited as a re-entry.
 */
export async function mintImpersonationToken(
  db: NodePgDatabase<Record<string, any>>,
  input: MintTokenInput,
): Promise<{ token: string; tokenExpiresAt: string; session: ImpersonationSessionRow }> {
  const session = await selectSessionRow(db, input.sessionId, input.organizationId);
  if (!session) throw new NotFoundError("Impersonation session not found");
  if (session.endedAt !== null) {
    throw new ConflictError("Impersonation session has already ended");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired while unswept: close it now (the sweep's semantics, applied at read time) and
    // refuse — a token for a dead window would be a credential with no live row behind it.
    await endSessionRow(db, session.id, "expired");
    throw new ConflictError("Impersonation session has expired");
  }
  if (session.adminUserId !== input.adminUserId) {
    throw new ForbiddenError("Only the admin who started this session may re-enter it");
  }

  const ttl = tokenTtlSeconds(session.expiresAt);
  const token = await signImpersonationToken(
    {
      targetUserId: session.targetUserId,
      orgId: session.organizationId,
      impersonationSessionId: session.id,
      impersonatorId: session.adminUserId,
    },
    input.accessSecret,
    ttl,
  );
  await writeAuditLog({
    db,
    module: "admin",
    organizationId: session.organizationId,
    actorId: input.adminUserId,
    actorType: "admin",
    action: "admin.impersonation.reentered",
    resourceId: session.id,
    targetUserId: session.targetUserId,
    afterState: { via: "token" },
  });
  return {
    token,
    tokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    session,
  };
}

// ─── End ──────────────────────────────────────────────────────────────────────────────────────

export interface EndImpersonationInput {
  sessionId: string;
  organizationId: string;
  /** The caller — the session's own admin (manual end) or another impersonate-holder (security). */
  actorUserId: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface EndImpersonationResult {
  sessionId: string;
  endReason: "manual_end" | "security_terminated";
}

/**
 * End an impersonation session early. The session's own admin gets `manual_end`; any other
 * `users.impersonate` holder gets `security_terminated` — the oversight path a security admin
 * uses on a session that should not be running. Already-ended → 409, so a double-clicked
 * "Stop" button cannot rewrite the first end.
 *
 * Callable from *inside* the impersonation: the route passes the impersonation context's
 * adminUserId, because after the cookie swap the caller's abilities are the target's — and a
 * "Stop" button that 403s is a support session the support UI cannot end.
 */
export async function endImpersonation(
  db: NodePgDatabase<Record<string, any>>,
  input: EndImpersonationInput,
): Promise<EndImpersonationResult> {
  const session = await selectSessionRow(db, input.sessionId, input.organizationId);
  if (!session) throw new NotFoundError("Impersonation session not found");
  if (session.endedAt !== null) {
    throw new ConflictError("Impersonation session has already ended");
  }

  const own = session.adminUserId === input.actorUserId;
  const endReason: EndImpersonationResult["endReason"] = own ? "manual_end" : "security_terminated";
  await endSessionRow(db, session.id, endReason);

  await writeAuditLog({
    db,
    module: "admin",
    organizationId: session.organizationId,
    actorId: input.actorUserId,
    actorType: "admin",
    severity: own ? "info" : "warning",
    action: own ? "admin.impersonation.ended" : "admin.impersonation.terminated",
    resourceId: session.id,
    targetUserId: session.targetUserId,
    afterState: {
      endReason,
      startedAt: session.startedAt.toISOString(),
      endedEarly: session.expiresAt.getTime() > Date.now(),
    },
    ...(input.ip ? { actorIp: input.ip } : {}),
    ...(input.userAgent ? { actorUserAgent: input.userAgent } : {}),
  });

  return { sessionId: session.id, endReason };
}

/** The one UPDATE an end is. Every path (manual, security, expired, inline) converges here. */
async function endSessionRow(
  db: NodePgDatabase<Record<string, any>>,
  sessionId: string,
  endReason: "expired" | "manual_end" | "security_terminated" | "system_terminated",
): Promise<void> {
  await db.execute(sql`
      UPDATE impersonation_sessions
      SET ended_at = now(), end_reason = ${endReason}
      WHERE id = ${sessionId} AND ended_at IS NULL
    `);
}

// ─── Expiry sweep ─────────────────────────────────────────────────────────────────────────────

export interface ExpireLapsedResult {
  expired: number;
  failed: number;
  errors: { id: string; error: string }[];
  ids: string[];
}

/**
 * Close every session past its `expires_at` — the sweep behind the scheduled
 * `impersonation.expire` job, and the same function an operator runs by hand
 * (`bun run queue:run impersonation.expire`). Idempotent at the source: only rows with
 * `ended_at IS NULL AND expires_at <= now()` are selected, so a re-delivered tick finds
 * nothing. Each closure writes its own audit row (`admin.impersonation.expired`, actor
 * `system`) — per-row evidence, because "when did support access actually stop" is a
 * security question with one answer per session, not per batch.
 */
export async function expireLapsedImpersonations(
  db: NodePgDatabase<Record<string, any>>,
  options: { limit?: number } = {},
): Promise<ExpireLapsedResult> {
  const limit = options.limit ?? EXPIRY_BATCH_LIMIT;
  const candidates = (
    (await db.execute<{ id: string }>(sql`
      SELECT id FROM impersonation_sessions
      WHERE ended_at IS NULL AND expires_at <= now()
      ORDER BY expires_at ASC, id ASC
      LIMIT ${limit}
    `)) as any
  ).rows as { id: string }[];
  if (candidates.length === 0) return { expired: 0, failed: 0, errors: [], ids: [] };

  const ids: string[] = [];
  const errors: { id: string; error: string }[] = [];
  for (const { id } of candidates) {
    try {
      const updated = (
        (await db.execute<{ id: string; target_user_id: string }>(sql`
          UPDATE impersonation_sessions
          SET ended_at = now(), end_reason = 'expired'
          WHERE id = ${id} AND ended_at IS NULL AND expires_at <= now()
          RETURNING id, target_user_id
        `)) as any
      ).rows as { id: string; target_user_id: string }[];
      if (updated.length > 0) {
        ids.push(id);
        await writeAuditLog({
          db,
          module: "admin",
          action: "admin.impersonation.expired",
          // A sweep has no human actor; the DB accepts `system` with no id.
          actorType: "system",
          resourceId: id,
          targetUserId: updated[0]!.target_user_id,
          afterState: { endReason: "expired" },
        });
      }
    } catch (error) {
      errors.push({ id, error: String(error) });
    }
  }
  return { expired: ids.length, failed: errors.length, errors, ids: ids.slice(0, 100) };
}

// ─── Reads ────────────────────────────────────────────────────────────────────────────────────

export interface ImpersonationListEntry {
  id: string;
  adminUserId: string;
  adminEmail: string | null;
  targetUserId: string;
  targetEmail: string | null;
  reason: string;
  ticketId: string | null;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  securityNotified: boolean;
}

/**
 * Org-scoped oversight list (the security dashboard's feed, until P15-006 gives it a screen).
 * Default view: everything still open plus the trailing week of closed sessions — an
 * oversight list that only showed open sessions could not answer "what happened yesterday".
 * Keyset-paginated on `(started_at, id)` exactly like every other list (F-14).
 */
export async function listImpersonations(
  db: NodePgDatabase<Record<string, any>>,
  organizationId: string,
  page: PaginationParams,
  options: { scope?: "all" | "active" | "ended" } = {},
): Promise<Page<ImpersonationListEntry>> {
  const scope = options.scope ?? "all";
  const scopeClause =
    scope === "active"
      ? sql`AND s.ended_at IS NULL`
      : scope === "ended"
        ? sql`AND s.ended_at IS NOT NULL`
        : sql`AND (s.ended_at IS NULL OR s.started_at > now() - interval '7 days')`;
  const cursorClause = page.cursor
    ? sql`AND (s.started_at, s.id) < (${page.cursor.v}::timestamptz, ${page.cursor.id}::text)`
    : sql``;

  const rawRows = (
    (await db.execute<
      SessionRowRaw & {
        admin_email: string | null;
        target_email: string | null;
      }
    >(sql`
      SELECT s.id, s.organization_id, s.admin_user_id, admin_u.email AS admin_email,
             s.target_user_id, target_u.email AS target_email,
             s.reason, s.ticket_id, s.started_at, s.expires_at,
             s.ended_at, s.end_reason, s.mfa_verified, s.security_notified
      FROM impersonation_sessions s
      LEFT JOIN users admin_u ON admin_u.id = s.admin_user_id::uuid
      LEFT JOIN users target_u ON target_u.id = s.target_user_id::uuid
      WHERE s.organization_id = ${organizationId}
      ${scopeClause}
      ORDER BY s.started_at DESC, s.id DESC
      ${cursorClause}
      LIMIT ${page.limit + 1}
    `)) as any
  ).rows as (SessionRowRaw & {
    admin_email: string | null;
    target_email: string | null;
  })[];

  const entries: ImpersonationListEntry[] = rawRows.map((raw) => ({
    id: raw.id,
    adminUserId: raw.admin_user_id,
    adminEmail: raw.admin_email,
    targetUserId: raw.target_user_id,
    targetEmail: raw.target_email,
    reason: raw.reason,
    ticketId: raw.ticket_id,
    startedAt: new Date(raw.started_at),
    expiresAt: new Date(raw.expires_at),
    endedAt: raw.ended_at ? new Date(raw.ended_at) : null,
    endReason: raw.end_reason,
    securityNotified: raw.security_notified,
  }));

  return buildPage(entries, page.limit, (row) => row.startedAt.toISOString());
}

/** Cursor shape for the list route — `imp_…` ids, not bare uuids. */
export const impersonationCursorShape: CursorIdShape = { idPattern: IMPERSONATION_ID_PATTERN };

// ─── Middleware support ───────────────────────────────────────────────────────────────────────

export interface LiveImpersonation {
  sessionId: string;
  adminUserId: string;
  targetUserId: string;
  organizationId: string;
}

/**
 * Validate an impersonation token against its row — the per-request gate that makes "ended"
 * mean ended. Every binding the token claims is checked against the row (target, admin, org),
 * so a token can never outlive or detach from the session that minted it — and the admin's
 * own account must still be an active member in good standing: suspending or removing the
 * admin kills their running impersonations on the next request, the same way F-05 kills
 * everything else they hold.
 *
 * Returns `undefined` when the session is ended, expired, or disagrees with the token — the
 * caller answers 401 either way; the distinction matters to the audit trail, not the client.
 */
export async function resolveLiveImpersonation(
  db: NodePgDatabase<Record<string, any>>,
  token: {
    userId: string;
    orgId: string;
    impersonationSessionId: string;
    impersonatorId: string;
  },
): Promise<LiveImpersonation | undefined> {
  const rows = (await db.execute<{
    id: string;
    organization_id: string;
    admin_user_id: string;
    target_user_id: string;
    admin_status: string | null;
    admin_deleted_at: string | null;
    admin_member_id: string | null;
  }>(sql`
      SELECT s.id, s.organization_id, s.admin_user_id, s.target_user_id,
             a.status AS admin_status, a.deleted_at AS admin_deleted_at,
             (SELECT om.id FROM organization_members om
               WHERE om.user_id = s.admin_user_id::uuid
                 AND om.organization_id = s.organization_id::uuid
                 AND om.status = 'active' AND om.deleted_at IS NULL LIMIT 1) AS admin_member_id
      FROM impersonation_sessions s
      LEFT JOIN users a ON a.id = s.admin_user_id::uuid
      WHERE s.id = ${token.impersonationSessionId}
        AND s.ended_at IS NULL
        AND s.expires_at > now()
      LIMIT 1
    `)) as any;
  const row = rows.rows?.[0] as
    | {
        id: string;
        organization_id: string;
        admin_user_id: string;
        target_user_id: string;
        admin_status: string | null;
        admin_deleted_at: string | null;
        admin_member_id: string | null;
      }
    | undefined;

  if (!row) return undefined;
  if (row.target_user_id !== token.userId) return undefined;
  if (row.admin_user_id !== token.impersonatorId) return undefined;
  if (row.organization_id !== token.orgId) return undefined;
  if (!row.admin_member_id || row.admin_deleted_at !== null) return undefined;
  try {
    assertAccountCanAuthenticate(row.admin_status ?? "");
  } catch {
    return undefined;
  }

  return {
    sessionId: row.id,
    adminUserId: row.admin_user_id,
    targetUserId: row.target_user_id,
    organizationId: row.organization_id,
  };
}
