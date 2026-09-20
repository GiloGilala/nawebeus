// DSAR data export (NWB-P0-002, AC8 of FR-AUTH-007).
//
// Phase 1: synchronous export. requestDataExport() assembles the subject's
// personal data from every wired table that holds any, stores the package on
// the dsar_requests row, and returns it in the same call — satisfying the
// PRD's 24-hour delivery window trivially. Phase 2 swaps assembly for a
// queued worker; the row/route shapes are designed for that swap (see
// db/core/dsar-requests.ts).
//
// Privacy rules enforced here, not at the route:
// - every section selects explicit columns — credentials and secrets
//   (password digests, MFA secret/backup codes, session token hashes, API-key
//   digests, OAuth tokens) never enter the package;
// - audit events carry only their own metadata; before/after/changes states
//   are excluded because they can embed other people's data;
// - every section is capped (default 10 000 rows) with a truncation marker;
// - an export on behalf of someone else requires both parties to hold an
//   active membership in the same organization — the CASL condition is inert
//   (F-06), so this membership predicate is the real cross-tenant guard.

import { type SQL, sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { ExportExpiredError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { writeAuditLog } from "../audit";

/** Hard cap per export section. Oversized sections set `truncated: true`. */
export const MAX_ROWS_PER_SECTION = 10_000;

/** How long a completed package stays downloadable (HTTP 410 after this). */
export const EXPORT_DOWNLOAD_WINDOW_DAYS = 7;

export type DsarType = "access";
export type DsarStatus =
  | "pending"
  | "verifying"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"
  | "partially_completed";

export interface ExportSectionMeta {
  rows: number;
  truncated: boolean;
}

export interface ExportPackage {
  format: "json";
  generatedAt: string;
  subjectUserId: string;
  sections: Record<string, unknown[]>;
  sectionMeta: Record<string, ExportSectionMeta>;
}

export interface ExportRequestRow {
  id: string;
  userId: string;
  requestedBy: string;
  organizationId: string | null;
  type: DsarType;
  status: DsarStatus;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string;
  packageSize: number | null;
}

export interface RequestDataExportResult {
  request: ExportRequestRow;
  exportPackage: ExportPackage;
}

interface requestDataExportOptions {
  /** The data subject — whose personal data is exported. */
  subjectUserId: string;
  /** The actor submitting the request (the subject, or an admin). */
  requestedBy: string;
  /** Organization context; required (and validated) for on-behalf requests. */
  organizationId?: string | null | undefined;
  requestIp?: string | undefined;
  requestUserAgent?: string | undefined;
  /** Test hook — shrink the per-section cap. */
  maxRowsPerSection?: number;
}

async function isActiveMemberOf(db: Db, userId: string, organizationId: string): Promise<boolean> {
  const res = await db.execute(
    sql`
      SELECT 1 FROM organization_members
      WHERE user_id = ${userId}
        AND organization_id = ${organizationId}
        AND is_active = true
        AND status = 'active'
      LIMIT 1
    `,
  );
  return ((res as any).rows?.length ?? 0) > 0;
}

/**
 * Build the export package for a subject. Exported as its own function so
 * tests can exercise truncation without going through the request flow.
 */
export async function buildExportPackage(
  db: Db,
  subjectUserId: string,
  maxRowsPerSection: number = MAX_ROWS_PER_SECTION,
): Promise<ExportPackage> {
  if (!Number.isInteger(maxRowsPerSection) || maxRowsPerSection < 1) {
    throw new Error("maxRowsPerSection must be a positive integer");
  }
  const cap = maxRowsPerSection;
  const sections: Record<string, unknown[]> = {};
  const sectionMeta: Record<string, ExportSectionMeta> = {};

  // Fetch cap + 1 rows so truncation is detectable in one query.
  const runSection = async (name: string, query: SQL) => {
    const res = await db.execute(query);
    const rows = ((res as any).rows ?? []) as unknown[];
    const truncated = rows.length > cap;
    sections[name] = truncated ? rows.slice(0, cap) : rows;
    sectionMeta[name] = { rows: Math.min(rows.length, cap), truncated };
  };

  // ── profile ──────────────────────────────────────────────────────────────
  // Explicit column list: password, password_history, two_factor_secret and
  // two_factor_backup_codes are deliberately absent — the subject gets their
  // data, not their credentials.
  await runSection(
    "profile",
    sql`
      SELECT id, organization_id, email, phone, email_verified, phone_verified,
             username, first_name, last_name, display_name, profile_image,
             timezone, locale, two_factor_enabled,
             last_login_country, last_login_user_agent, status,
             onboarding_completed, onboarding_step, subscription_status,
             created_at, updated_at, deleted_at
      FROM users WHERE id = ${subjectUserId}
    `,
  );

  // ── sessions ─────────────────────────────────────────────────────────────
  // Includes impersonation sessions that touched the subject. Token hashes
  // and salts are excluded.
  await runSection(
    "sessions",
    sql`
      SELECT id, impersonated_user_id, impersonated_by_user_id,
             identity_provider, auth_flow, remember_me, status,
             ip_address, user_agent, created_at, last_activity_at,
             expires_at, revoked_at
      FROM sessions
      WHERE user_id = ${subjectUserId} OR impersonated_user_id = ${subjectUserId}
      ORDER BY created_at DESC
      LIMIT ${cap + 1}
    `,
  );

  // ── memberships ──────────────────────────────────────────────────────────
  await runSection(
    "memberships",
    sql`
      SELECT m.organization_id, o.name AS organization_name, o.slug,
             r.code AS role_code, r.name AS role_name,
             m.status, m.is_active, m.invited_at, m.accepted_at,
             m.created_at, m.updated_at
      FROM organization_members m
      JOIN organizations o ON o.id = m.organization_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.user_id = ${subjectUserId}
      ORDER BY m.created_at
      LIMIT ${cap + 1}
    `,
  );

  // ── api_keys ─────────────────────────────────────────────────────────────
  // Metadata only: secret_hash, encrypted_secret and fingerprint are absent.
  // public_key is the public lookup half of the key pair, safe to include.
  await runSection(
    "api_keys",
    sql`
      SELECT id, organization_id, name, description, public_key, key_prefix,
             permission_level, scopes, environment, status, created_at,
             last_used_at, expires_at, revoked_at, deleted_at
      FROM api_keys
      WHERE user_id = ${subjectUserId} AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ${cap + 1}
    `,
  );

  // ── oauth_accounts ───────────────────────────────────────────────────────
  // Provider identity only — no access/refresh tokens.
  await runSection(
    "oauth_accounts",
    sql`
      SELECT provider, provider_account_id, provider_username,
             provider_account_email, created_at
      FROM oauth_accounts
      WHERE user_id = ${subjectUserId} AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ${cap + 1}
    `,
  );

  // ── audit_events ─────────────────────────────────────────────────────────
  // The subject's own trail: actions they performed and actions targeting
  // them. before_state / after_state / changes / metadata are excluded —
  // snapshots can embed other people's personal data, and the subject's
  // right of access does not extend to third parties.
  await runSection(
    "audit_events",
    sql`
      SELECT id, action, category, module, severity, organization_id,
             actor_id, target_user_id, actor_ip, created_at
      FROM unified_audit_log
      WHERE actor_id = ${subjectUserId} OR target_user_id = ${subjectUserId}
      ORDER BY created_at DESC
      LIMIT ${cap + 1}
    `,
  );

  // ── previous_exports ─────────────────────────────────────────────────────
  // Metadata only — the payloads are the exports themselves.
  await runSection(
    "previous_exports",
    sql`
      SELECT id, type, status, requested_at, completed_at, expires_at
      FROM dsar_requests
      WHERE user_id = ${subjectUserId}
      ORDER BY requested_at DESC
      LIMIT ${cap + 1}
    `,
  );

  return {
    format: "json",
    generatedAt: new Date().toISOString(),
    subjectUserId,
    sections,
    sectionMeta,
  };
}

/**
 * Request (and, in Phase 1, immediately fulfill) a DSAR export.
 *
 * On-behalf requests (`requestedBy !== subjectUserId`) require
 * `organizationId`, and both actor and subject must be active members of it —
 * otherwise ForbiddenError. The subject may always export themselves.
 */
export async function requestDataExport(
  db: Db,
  opts: requestDataExportOptions,
): Promise<RequestDataExportResult> {
  const {
    subjectUserId,
    requestedBy,
    organizationId = null,
    requestIp,
    requestUserAgent,
    maxRowsPerSection = MAX_ROWS_PER_SECTION,
  } = opts;

  if (requestedBy !== subjectUserId) {
    if (!organizationId) {
      throw new ForbiddenError(
        "Exporting on behalf of another user requires an organization context",
      );
    }
    const [actorIsMember, subjectIsMember] = await Promise.all([
      isActiveMemberOf(db, requestedBy, organizationId),
      isActiveMemberOf(db, subjectUserId, organizationId),
    ]);
    if (!actorIsMember || !subjectIsMember) {
      throw new ForbiddenError(
        "Exporter and subject must both be active members of the organization",
      );
    }
  }

  const exportPackage = await buildExportPackage(db, subjectUserId, maxRowsPerSection);
  const payloadJson = JSON.stringify(exportPackage);
  const packageSize = Buffer.byteLength(payloadJson, "utf8");

  const res = await db.execute(
    sql`
      INSERT INTO dsar_requests (
        user_id, requested_by, organization_id, type, status,
        payload, section_counts, package_size,
        completed_at, expires_at
      ) VALUES (
        ${subjectUserId}, ${requestedBy}, ${organizationId}, 'access', 'completed',
        ${payloadJson}::jsonb, ${JSON.stringify(exportPackage.sectionMeta)}::jsonb,
        ${packageSize},
        now(), now() + (${EXPORT_DOWNLOAD_WINDOW_DAYS} * interval '1 day')
      )
      RETURNING id, user_id, requested_by, organization_id, type, status,
                requested_at, completed_at, expires_at, package_size
    `,
  );
  const row = (res as any).rows?.[0] as
    | {
        id: string;
        user_id: string;
        requested_by: string;
        organization_id: string | null;
        type: DsarType;
        status: DsarStatus;
        requested_at: string;
        completed_at: string | null;
        expires_at: string;
        package_size: number | null;
      }
    | undefined;
  if (!row) {
    throw new Error("dsar_requests INSERT returned no row");
  }

  await writeAuditLog({
    db,
    // `module: "compliance"` would be truer to the taxonomy, but
    // chk_ual_compliance_requires_checksum makes it unwritable — the audit
    // writer does not compute checksums yet (see the ticket's finding).
    // Every existing audit write uses "core"; the action string keeps the
    // compliance namespace.
    module: "core",
    action: "compliance.dsar.requested",
    category: "user_management",
    ...(organizationId ? { organizationId } : {}),
    actorId: requestedBy,
    actorType: "user",
    ...(requestIp ? { actorIp: requestIp } : {}),
    ...(requestUserAgent ? { actorUserAgent: requestUserAgent } : {}),
    resourceType: "dsar_request",
    resourceId: row.id,
    targetUserId: subjectUserId,
    severity: "info",
    metadata: {
      type: "access",
      sections: exportPackage.sectionMeta,
      packageSize,
    },
  });

  return {
    request: {
      id: row.id,
      userId: row.user_id,
      requestedBy: row.requested_by,
      organizationId: row.organization_id,
      type: row.type as DsarType,
      status: row.status as DsarStatus,
      requestedAt: String(row.requested_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      expiresAt: String(row.expires_at),
      packageSize: row.package_size ?? null,
    },
    exportPackage,
  };
}

export interface GetExportResult {
  request: ExportRequestRow;
  exportPackage: ExportPackage;
}

/**
 * Fetch a completed export package for re-download.
 *
 * Allowed: the subject, or whoever submitted the request. Anyone else gets a
 * 404 (not a 403 — the id is a capability; existence is not disclosed).
 * Expired packages raise ExportExpiredError (410).
 */
export async function getExportRequest(
  db: Db,
  requestId: string,
  requesterId: string,
): Promise<GetExportResult> {
  const res = await db.execute(
    sql`
      SELECT id, user_id, requested_by, organization_id, type, status,
             payload, requested_at, completed_at, expires_at, package_size
      FROM dsar_requests
      WHERE id = ${requestId}
      LIMIT 1
    `,
  );
  const row = (res as any).rows?.[0] as
    | {
        id: string;
        user_id: string;
        requested_by: string;
        organization_id: string | null;
        type: DsarType;
        status: DsarStatus;
        payload: ExportPackage | null;
        requested_at: string;
        completed_at: string | null;
        expires_at: string;
        package_size: number | null;
      }
    | undefined;
  if (!row) {
    throw new NotFoundError("Export request not found");
  }
  if (row.user_id !== requesterId && row.requested_by !== requesterId) {
    // Deliberately 404: another user's request id should be indistinguishable
    // from a nonexistent one.
    throw new NotFoundError("Export request not found");
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ExportExpiredError("This export package has expired and is no longer downloadable");
  }

  await writeAuditLog({
    db,
    module: "core", // see the requested-event note: checksum chain unimplemented
    action: "compliance.dsar.downloaded",
    category: "user_management",
    ...(row.organization_id ? { organizationId: row.organization_id } : {}),
    actorId: requesterId,
    actorType: "user",
    resourceType: "dsar_request",
    resourceId: row.id,
    targetUserId: row.user_id,
    severity: "info",
  });

  return {
    request: {
      id: row.id,
      userId: row.user_id,
      requestedBy: row.requested_by,
      organizationId: row.organization_id,
      type: row.type,
      status: row.status,
      requestedAt: String(row.requested_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      expiresAt: String(row.expires_at),
      packageSize: row.package_size,
    },
    exportPackage: row.payload as ExportPackage,
  };
}
