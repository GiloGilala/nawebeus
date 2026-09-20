// src/services/users/dsar.service.ts
//
// NDPR DSAR portability (NWB-P0-002, FR-AUTH-007 AC8): build a machine-readable
// export of everything the platform holds about one user. Phase 1 is
// synchronous — the package is assembled in the request handler and stored on
// `data_export_requests` with a 7-day download window. The Phase 2 queue
// (pg-boss) takes over generation later; the table's status vocabulary already
// reserves the queue states, so the swap is service-internal with no schema
// change.
//
// Self-citation rule for the audit section: the `compliance.dsar.requested`
// event is written BEFORE the export is assembled, so the request that
// produced this very package appears inside it. A subject reading the export
// can see exactly when and why their data was packaged.
//
// Scope discipline: own data only (no cross-tenant peeking — the admin on the
// org-scoped route gets an id + expiry back, never the payload), credentials
// and second-factor material are never exported, and every collection section
// is capped (10k rows) with a per-section `truncated` marker instead of
// streaming unbounded data through the synchronous route.

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { GoneError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";

export const DATA_EXPORT_FORMAT_VERSION = 1;
export const DATA_EXPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7-day download window
export const DATA_EXPORT_SECTION_CAP = 10_000;

export interface RequestDataExportInput {
  /** The data subject — the export is always about this user. */
  userId: string;
  /** Who asked. Defaults to the subject; differs when an org admin files on their behalf. */
  requestedBy?: string;
  organizationId?: string;
  actorIp?: string;
  actorUserAgent?: string;
  /** Correlation id of the HTTP request, threaded into the audit event. */
  requestId?: string;
}

export interface RequestDataExportOptions {
  /**
   * Rows per collection section before the section is closed with
   * `truncated: true`. Internal/testing knob — routes never expose it.
   */
  sectionRowCap?: number;
}

export interface DataExportReceipt {
  id: string;
  status: string;
  expiresAt: string;
}

export async function requestDataExport(
  db: NodePgDatabase<Record<string, any>>,
  input: RequestDataExportInput,
  options: RequestDataExportOptions = {},
): Promise<DataExportReceipt> {
  const subjectId = input.userId;
  const requestedBy = input.requestedBy ?? subjectId;
  const cap = options.sectionRowCap ?? DATA_EXPORT_SECTION_CAP;
  const limit = cap + 1; // fetch one past the cap to detect truncation

  // Pre-generate the id so the audit event written below can point at the
  // record the event is about.
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + DATA_EXPORT_WINDOW_MS);

  // 1. Audit FIRST — the self-citation rule (header comment).
  //
  // Module stays "core" like every other active writer: `unified_audit_log`
  // check constraints require a hash-chain `checksum` for modules 'admin' /
  // 'compliance' / 'system', and `writeAuditLog` does not compute the chain
  // yet. Semantic (category + `compliance.dsar.*` action) travels in the
  // low-cost columns; the row graduates to module 'compliance' with the
  // tamper-evidence work that owns the checksum.
  await writeAuditLog({
    db,
    module: "core",
    category: "compliance",
    action: "compliance.dsar.requested",
    resourceType: "data_export_request",
    resourceId: id,
    actorId: requestedBy,
    actorType: requestedBy === subjectId ? "user" : "admin",
    ...(requestedBy !== subjectId ? { targetUserId: subjectId } : {}),
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.actorIp ? { actorIp: input.actorIp } : {}),
    ...(input.actorUserAgent ? { actorUserAgent: input.actorUserAgent } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    severity: "info",
    metadata: { expiresAt: expiresAt.toISOString() },
  });

  // 2. Assemble the sections. Every collection caps at `cap` rows; the extra
  //    row never leaves the database cursor into the payload.
  const profile = await loadProfile(db, subjectId);
  if (!profile) {
    // Defensive: callers (routes) validate the subject first, so reaching this
    // means a broken invariant — say so plainly instead of exporting an empty
    // "user" shape.
    throw new NotFoundError("User not found");
  }
  const [sessions, memberships, apiKeys, auditLog] = await Promise.all([
    loadRows(
      db,
      sql`
        SELECT s.id, s.device_type, s.device_id, s.device_name, s.device_model,
               s.device_os, s.device_os_version, s.user_agent,
               s.browser_name, s.browser_version, s.ip_address,
               s.location_country, s.location_region, s.location_city,
               s.timezone, s.remember_me, s.is_revoked, s.revoked_at,
               s.revocation_reason, s.expires_at, s.last_activity_at,
               s.mfa_verified_at, s.mfa_method, s.authentication_level,
               s.status, s.created_at
        FROM sessions s
        WHERE s.user_id = ${subjectId}
        ORDER BY s.created_at DESC
        LIMIT ${limit}
      `,
      cap,
    ),
    loadRows(
      db,
      sql`
        SELECT om.id, om.organization_id, o.name AS organization_name,
               o.slug AS organization_slug, r.name AS role_name,
               om.status, om.is_active, om.display_name, om.job_title,
               om.department, om.bio, om.work_schedule,
               om.notification_preferences, om.invited_at, om.accepted_at,
               om.activated_at, om.suspended_at, om.suspension_reason,
               om.suspended_by, om.deactivated_at, om.deactivation_reason,
               om.last_active_at, om.created_at, om.updated_at
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        LEFT JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = ${subjectId}
        ORDER BY om.created_at DESC
        LIMIT ${limit}
      `,
      cap,
    ),
    loadRows(
      db,
      sql`
        SELECT k.id, k.name, k.key_prefix, k.public_key, k.key_type,
               k.environment, k.permission_level, k.scopes, k.status,
               k.organization_id, k.team_id, k.project_id,
               k.issued_at, k.expires_at, k.last_used_at,
               k.allowed_ips, k.allowed_origins, k.restrictions,
               k.revoked_at, k.revoke_reason, k.revocation_type,
               k.created_at, k.updated_at
        FROM api_keys k
        WHERE k.user_id = ${subjectId} AND k.deleted_at IS NULL
        ORDER BY k.created_at DESC
        LIMIT ${limit}
      `,
      cap,
    ),
    loadRows(
      db,
      // Audit rows BY the subject and ABOUT the subject. An admin-filed DSAR
      // request has actor=admin/target=subject — under actor-only filtering the
      // subject could never see who asked for their data, which inverts the
      // transparency the right exists for.
      sql`
        SELECT a.id, a.module, a.category, a.action, a.resource_type,
               a.resource_id, a.organization_id, a.target_user_id,
               a.actor_id, a.actor_type, a.actor_ip, a.severity, a.reason,
               a.request_id, a.before_state, a.after_state, a.changes,
               a.metadata, a.created_at
        FROM unified_audit_log a
        WHERE a.actor_id = ${subjectId} OR a.target_user_id = ${subjectId}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `,
      cap,
    ),
  ]);

  const payload = {
    meta: {
      formatVersion: DATA_EXPORT_FORMAT_VERSION,
      requestId: id,
      subject: { id: profile.id, email: profile.email },
      generatedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      sections: {
        profile: { rows: 1, truncated: false },
        sessions: { rows: sessions.rows.length, truncated: sessions.truncated },
        memberships: { rows: memberships.rows.length, truncated: memberships.truncated },
        apiKeys: { rows: apiKeys.rows.length, truncated: apiKeys.truncated },
        auditLog: { rows: auditLog.rows.length, truncated: auditLog.truncated },
      },
    },
    profile,
    sessions: sessions.rows,
    memberships: memberships.rows,
    apiKeys: apiKeys.rows,
    auditLog: auditLog.rows,
  };

  // 3. Persist. Phase 1 keeps the whole package on the row; a subject GET
  //    reads it back within the window.
  await db.execute(sql`
    INSERT INTO data_export_requests
      (id, user_id, requested_by, status, payload, expires_at)
    VALUES
      (${id}, ${subjectId}, ${requestedBy}, 'completed',
       ${JSON.stringify(payload)}::jsonb, ${expiresAt.toISOString()})
  `);

  return { id, status: "completed", expiresAt: expiresAt.toISOString() };
}

/**
 * Subject-only read. Unknown id and foreign id are the same 404 — the export
 * is a personal data package, so its existence is itself withheld. An expired
 * window answers 410 (GoneError): the package existed and was deleted on
 * schedule, request a fresh one.
 */
export async function getDataExport(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  requestId: string,
): Promise<unknown> {
  const rows = await db.execute(sql`
    SELECT payload, expires_at
    FROM data_export_requests
    WHERE id = ${requestId} AND user_id = ${userId}
    LIMIT 1
  `);
  const row = (rows as any).rows?.[0] as
    | { payload: unknown; expires_at: Date | string }
    | undefined;
  if (!row) {
    throw new NotFoundError("Data export request not found");
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new GoneError(
      "This data export has expired. Download windows last 7 days — request a fresh export.",
    );
  }
  return row.payload;
}

/**
 * Personal-data surface of `users` minus credential and second-factor
 * material: password (+history), 2FA secret/backup codes (+ pending variants),
 * security questions/answers, push tokens and trusted-device blobs.
 */
async function loadProfile(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db.execute(sql`
    SELECT u.id, u.email, u.phone, u.email_verified, u.username,
           u.phone_verified, u.two_factor_enabled, u.login_count,
           u.last_login_ip, u.last_login_country, u.last_login_user_agent,
           u.first_name, u.last_name, u.display_name, u.profile_image,
           u.timezone, u.locale, u.onboarding_completed, u.onboarding_step,
           u.onboarding_data, u.subscription_status, u.subscription_expires_at,
           u.allow_direct_messages, u.last_login_at, u.last_active_at,
           u.last_password_change_at, u.last_email_change_at,
           u.terms_accepted_at, u.privacy_accepted_at, u.marketing_consent_at,
           u.newsletter_subscribed, u.referral_source, u.referral_code,
           u.referred_by, u.ip_history, u.user_agent_history,
           u.data_processing_consent, u.marketing_consent,
           u.consent_updated_at, u.cookie_consent, u.gdpr_consent_at,
           u.metadata, u.created_at, u.updated_at
    FROM users u
    WHERE u.id = ${userId} AND u.deleted_at IS NULL
    LIMIT 1
  `);
  const row = (rows as any).rows?.[0] as Record<string, unknown> | undefined;
  return row ?? null;
}

/** Cap-enforcing row loader: returns at most `cap` rows plus the truncation flag. */
async function loadRows(
  db: NodePgDatabase<Record<string, any>>,
  query: ReturnType<typeof sql>,
  cap: number,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const result = await db.execute(query);
  const all = ((result as any).rows ?? []) as Record<string, unknown>[];
  const truncated = all.length > cap;
  return { rows: truncated ? all.slice(0, cap) : all, truncated };
}
