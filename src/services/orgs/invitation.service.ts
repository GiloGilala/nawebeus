import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { ConflictError, InternalError, NotFoundError, ValidationError } from "../../lib/errors";
import { validatePassword } from "../../lib/password";
import { generateSecureToken, hashToken } from "../../lib/tokens";
import {
  type DbOrTx,
  deleteRowsPerRow,
  type PerRowDeleteResult,
  withAtomicWrites,
} from "../../lib/transaction";
import { anonymizeAuditInviteeEmail, writeAuditLog } from "../audit";
import { createUserRecord } from "../auth/user-record";
import { emailService } from "../email";
import {
  assertNoActiveHoldForOrg,
  assertNoActiveHoldForUser,
  assertNoActiveHoldForUserEmail,
} from "../retention/legal-holds.service";
import {
  assertRoleGrantAllowed,
  type MemberRole,
  requireActorRole,
  resolveAssignableRole,
} from "./role-policy";

export interface InviteOneInput {
  email: string;
  roleId?: string | undefined;
  displayName?: string;
  jobTitle?: string;
  department?: string;
  invitationNote?: string;
  expiresInHours?: number;
}

export interface InviteResult {
  inviteId: string;
  memberId: string;
  email: string;
  invitationToken: string;
  expiresAt: string;
}

const DEFAULT_INVITE_TTL_HOURS = 7 * 24; // FR-AUTH-006 AC3: 7 days

/**
 * Resolve a system-catalog role (shared, `organization_id IS NULL`) by code.
 * Fail closed when the catalog is unseeded — same posture as signup's owner
 * guard (F-01: a NULL role_id means a zero-permission member).
 */
async function requireSystemRole(
  db: DbOrTx,
  code: string,
): Promise<{ id: string; code: string; level: number }> {
  const rows = await db.execute<{ id: string; code: string; level: number }>(
    sql`
      SELECT id, code, level FROM roles
      WHERE code = ${code}
        AND organization_id IS NULL
        AND status = 'active'
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
  );
  const role = (rows as any).rows?.[0] as any;
  if (!role) {
    throw new InternalError(
      `The '${code}' role is missing from the role catalog. Run the seed before inviting members.`,
    );
  }
  return { id: role.id as string, code: role.code as string, level: Number(role.level) };
}

/**
 * The role an invitation will carry. An explicit `roleId` goes through the
 * DEC-039 ladder — resolvable for this organization (`resolveAssignableRole`,
 * 404 for cross-tenant/missing) and grantable by the inviter
 * (`assertRoleGrantAllowed`: never `owner`, always strictly below the
 * inviter's own level). Without this check, `inviteMember` wrote any UUID
 * into `organization_members.role_id` and the grant took effect at accept —
 * the F-07 class re-opened through a new write path (NWB-P0-016).
 *
 * An omitted role defaults to `viewer` (lowest tier) so an accepted member is
 * never a zero-permission row.
 */
async function resolveInviteRole(
  db: DbOrTx,
  orgId: string,
  actor: MemberRole,
  roleId?: string,
): Promise<{ id: string; code: string | null; level: number }> {
  if (roleId) {
    const role = await resolveAssignableRole(db, orgId as string, roleId);
    assertRoleGrantAllowed({
      actor: { code: actor.code, level: actor.level },
      newRole: role,
    });
    return role;
  }
  return requireSystemRole(db, "viewer");
}

/**
 * Invites a single email to an organization. Creates an `organization_members` row
 * with status='invited' and a token for the invitation link. If a pending invite
 * already exists for this email in the org, it's updated with a fresh token.
 */
export async function inviteMember(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
  input: InviteOneInput,
): Promise<InviteResult> {
  const config = getConfig();

  // The inviter must be an active member with a role in this org, whatever
  // their CASL ability says — same service-layer predicate as assignRole.
  const actor = await requireActorRole(db, orgId, actingUserId);
  const role = await resolveInviteRole(db, orgId, actor, input.roleId);

  const orgRows = await db.execute<{ name: string }>(
    sql`SELECT name FROM organizations WHERE id = ${orgId} AND deleted_at IS NULL LIMIT 1`,
  );
  const orgName = ((orgRows as any).rows?.[0] as any)?.name as string;

  // FR-AUTH-006: "This user is already a member of your organization".
  const activeMember = await db.execute<{ id: string }>(
    sql`
      SELECT om.id FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
        AND u.email = ${input.email}
        AND om.status = 'active'
        AND om.is_active = true
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  if ((activeMember as any).rows?.length > 0) {
    throw new ConflictError("This user is already a member of your organization");
  }

  // Dedup pending invites on (org, email): `invited_email` covers account-less
  // invites (user_id NULL — invisible to the old JOIN-users check, which is
  // why repeat invites to a new email used to create duplicate rows); the
  // users join covers rows written before `invited_email` existed.
  const existing = await db.execute<{ id: string }>(
    sql`
      SELECT om.id FROM organization_members om
      LEFT JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
        AND (om.invited_email = ${input.email} OR u.email = ${input.email})
        AND om.status = 'invited'
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const existingRow = (existing as any).rows?.[0] as any;

  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const ttlHours = input.expiresInHours ?? DEFAULT_INVITE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  // The user_id is recorded when the invitee already has an account (a hint
  // for accept); the addressee of record is `invited_email` either way.
  const userRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${input.email} AND deleted_at IS NULL LIMIT 1`,
  );
  const existingUser = (userRows as any).rows?.[0] as any;
  const userId = existingUser?.id ?? null;

  let memberId: string;
  if (existingRow) {
    await db.execute(
      sql`
        UPDATE organization_members
        SET user_id = ${userId},
            role_id = ${role.id},
            invitation_token = ${rawToken},
            invitation_token_hash = ${tokenHash},
            invitation_sent_at = now(),
            expires_at = ${expiresAt.toISOString()}::timestamptz,
            invited_email = ${input.email},
            display_name = ${input.displayName ?? null},
            job_title = ${input.jobTitle ?? null},
            department = ${input.department ?? null},
            invitation_note = ${input.invitationNote ?? null}
        WHERE id = ${existingRow.id}
      `,
    );
    memberId = existingRow.id;
  } else {
    const insertRows = await db.execute<{ id: string }>(
      sql`
        INSERT INTO organization_members (
          organization_id, user_id, role_id, status, is_active,
          invited_email, display_name, job_title, department, invitation_note,
          invitation_token, invitation_token_hash, invitation_sent_at, expires_at,
          invited_by, invited_at
        )
        VALUES (
          ${orgId}, ${userId}, ${role.id}, 'invited', false,
          ${input.email}, ${input.displayName ?? null}, ${input.jobTitle ?? null}, ${input.department ?? null}, ${input.invitationNote ?? null},
          ${rawToken}, ${tokenHash}, now(), ${expiresAt.toISOString()}::timestamptz,
          ${actingUserId}, now()
        )
        RETURNING id
      `,
    );
    memberId = (insertRows as any).rows?.[0]?.id as string;
  }

  await writeAuditLog({
    db,
    module: "core",
    actorId: actingUserId,
    actorType: "user",
    action: "organization.member.invited",
    category: "authorization",
    resourceType: "member",
    resourceId: memberId,
    afterState: { email: input.email, roleId: role.id, roleCode: role.code },
  });

  // The link is the only way to accept — existing-account invitees need it
  // too (previously only account-less invitees were emailed, which stranded
  // everyone else the moment NWB-P0-016 gave them something to accept).
  // One server-decided base for every emailed link (NWB-P0-021).
  const inviteLink = `${config.APP_BASE_URL_RESOLVED}/invite?token=${rawToken}`;
  await emailService.send({
    kind: "invitation",
    context: { organizationId: orgId, ...(userId ? { userId } : {}) },
    to: input.email,
    subject: `You've been invited to join ${orgName} on Nawebeus`,
    html: `
      <h2>Invitation to Nawebeus</h2>
      <p>You've been invited to join <strong>${orgName}</strong> on Nawebeus.</p>
      <p><a href="${inviteLink}">Accept Invitation</a></p>
      <p>This link expires in ${ttlHours} hours.</p>
    `,
  });

  return {
    inviteId: rawToken.slice(0, 32),
    memberId,
    email: input.email,
    invitationToken: rawToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export interface InvitationPreview {
  organizationName: string;
  invitedEmail: string;
  expiresAt: string | null;
  /** True when no account exists for the invited email — the accept form must collect registration details. */
  requiresAccountSetup: boolean;
}

interface InvitationRow {
  memberId: string;
  organizationId: string;
  organizationName: string;
  userId: string | null;
  roleId: string | null;
  invitedEmail: string | null;
  acceptedAt: Date | null;
  expiresAt: Date | null;
}

const INVITATION_NOT_FOUND = "This invitation is no longer valid.";
const INVITATION_EXPIRED = "This invitation has expired. Ask your admin to send a new invitation.";
const INVITATION_ACCEPTED = "This invitation has already been accepted.";

/**
 * Look up an invitation by its raw token. Unknown and revoked (deleted)
 * invitations are one indistinguishable 404 (FR-AUTH-006: "This invitation is
 * no longer valid."); expiry is a separate 404 with the spec's clearer
 * message (a prober cannot learn anything — the token space is 32 bytes).
 * Already-accepted rows resolve — callers decide how to surface the 409.
 */
async function findInvitationByToken(db: DbOrTx, token: string): Promise<InvitationRow> {
  const tokenHash = await hashToken(token);
  const rows = await db.execute(
    sql`
      SELECT om.id AS member_id, om.organization_id, om.user_id, om.role_id,
             om.invited_email, om.accepted_at, om.expires_at,
             (om.expires_at IS NOT NULL AND om.expires_at <= now()) AS expired,
             o.name AS organization_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
      WHERE om.invitation_token_hash = ${tokenHash}
        AND om.deleted_at IS NULL
      ORDER BY om.created_at DESC
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError(INVITATION_NOT_FOUND);
  if (row.expired) throw new NotFoundError(INVITATION_EXPIRED);
  return {
    memberId: row.member_id as string,
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string,
    userId: (row.user_id as string) ?? null,
    roleId: (row.role_id as string) ?? null,
    invitedEmail: (row.invited_email as string) ?? null,
    acceptedAt: (row.accepted_at as Date) ?? null,
    expiresAt: (row.expires_at as Date) ?? null,
  };
}

/**
 * Public preview for the invitation landing page (`GET …/invitations/:token`):
 * enough to render org context and pick the right form, nothing more. The
 * invited email is returned because the token went to that inbox — possession
 * of the link is the proof (standard invitation trust model).
 */
export async function getInvitationByToken(
  db: NodePgDatabase<Record<string, any>>,
  token: string,
): Promise<InvitationPreview> {
  const invite = await findInvitationByToken(db, token);
  if (invite.acceptedAt) throw new ConflictError(INVITATION_ACCEPTED);
  if (!invite.invitedEmail) throw new NotFoundError(INVITATION_NOT_FOUND);

  const userRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${invite.invitedEmail} AND deleted_at IS NULL LIMIT 1`,
  );

  return {
    organizationName: invite.organizationName,
    invitedEmail: invite.invitedEmail,
    expiresAt: invite.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
    requiresAccountSetup: (userRows as any).rows?.length === 0,
  };
}

export interface AcceptInvitationInput {
  token: string;
  password?: string | undefined;
  fullName?: string | undefined;
  termsAccepted?: boolean | undefined;
  privacyAccepted?: boolean | undefined;
  marketingOptIn?: boolean | undefined;
}

export interface AcceptInvitationResult {
  memberId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  email: string;
  roleId: string;
  newUser: boolean;
}

/**
 * Accept an invitation and activate the membership (F-08 / NWB-P0-016).
 *
 *  - Token: hash-matched, expiry-checked, single-use — claimed with an
 *    atomic `UPDATE … WHERE accepted_at IS NULL` before any other write, so a
 *    concurrent second accept re-evaluates the predicate and gets the 409.
 *  - New email → register-into-org through the shared `createUserRecord`
 *    (byte-identical record to signup's), organization set to the inviting
 *    org (single-org model), verification email after commit.
 *  - Existing account → D14 interim answer (single-org, option (a)): any
 *    active membership in *another* organization is a clear 409 — a user's
 *    primary org is never silently re-homed. The multi-org branch is
 *    deliberately not built until D14's final call.
 *  - The membership activates with the role the inviter was allowed to grant
 *    at invite time (DEC-039 ladder, enforced in `inviteMember`). Legacy
 *    NULL-role rows fall back to `viewer`, never a zero-permission member.
 *
 * Every write commits or rolls back together (`withAtomicWrites`).
 */
export async function acceptInvitation(
  db: NodePgDatabase<Record<string, any>>,
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const invite = await findInvitationByToken(db, input.token);
  if (invite.acceptedAt) throw new ConflictError(INVITATION_ACCEPTED);
  // Rows from the pre-`invited_email` window with no linked account are
  // unaddressable — the addressee existed only in the sent email.
  if (!invite.invitedEmail && !invite.userId) throw new NotFoundError(INVITATION_NOT_FOUND);

  const invitedEmail = invite.invitedEmail as string;

  return await withAtomicWrites(db, async (tx) => {
    const claim = await tx.execute<{ id: string }>(
      sql`
        UPDATE organization_members
        SET accepted_at = now(), invitation_token = NULL, updated_at = now()
        WHERE id = ${invite.memberId}
          AND accepted_at IS NULL
          AND deleted_at IS NULL
        RETURNING id
      `,
    );
    if ((claim as any).rows?.length === 0) throw new ConflictError(INVITATION_ACCEPTED);

    let userId: string | null = invite.userId;
    if (!userId) {
      const userRows = await tx.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE email = ${invitedEmail} AND deleted_at IS NULL LIMIT 1`,
      );
      userId = ((userRows as any).rows?.[0] as any)?.id ?? null;
    }

    let newUser = false;

    if (!userId) {
      // Register-into-org (FR-AUTH-006 step 9b). The registration fields are
      // required here, not in zod — existing accounts don't need them.
      const missing: { field: string; message: string }[] = [];
      if (!input.password) {
        missing.push({ field: "password", message: "Password is required to create your account" });
      }
      if (!input.fullName) missing.push({ field: "fullName", message: "Full name is required" });
      if (input.termsAccepted !== true) {
        missing.push({ field: "termsAccepted", message: "Terms must be accepted" });
      }
      if (input.privacyAccepted !== true) {
        missing.push({ field: "privacyAccepted", message: "Privacy policy must be accepted" });
      }
      if (missing.length > 0) {
        throw new ValidationError(
          "Registration details are required to accept this invitation",
          missing,
        );
      }

      const complexity = validatePassword(input.password as string, { email: invitedEmail });
      if (!complexity.valid) {
        throw new ValidationError(
          "Password does not meet complexity requirements",
          complexity.errors.map((message) => ({ field: "password", message })),
        );
      }

      const now = new Date().toISOString();
      const user = await createUserRecord(tx, {
        email: invitedEmail,
        password: input.password as string,
        fullName: input.fullName as string,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        marketingOptIn: input.marketingOptIn ?? false,
      });
      userId = user.userId;
      newUser = true;
      // Accepting the invitation *is* the verification (NWB-P1-004 decision 3): the link that
      // brought them here was delivered to this address, and the token they presented proves
      // they read it. Creating them `pending_verification` would put the verified-email gate in
      // front of the workspace they were just invited into, for a second click on a second email
      // that says nothing the first did not.
      await tx.execute(
        sql`UPDATE users
            SET organization_id = ${invite.organizationId},
                status = 'active',
                email_verified = true
            WHERE id = ${userId}`,
      );
    } else {
      // Existing account (step 9a). D14 interim single-org semantics
      // (option (a)): refuse rather than silently re-home a primary org.
      const elsewhere = await tx.execute<{ id: string }>(
        sql`
          SELECT om.id FROM organization_members om
          WHERE om.user_id = ${userId}
            AND om.organization_id <> ${invite.organizationId}
            AND om.status = 'active'
            AND om.is_active = true
            AND om.deleted_at IS NULL
          LIMIT 1
        `,
      );
      if ((elsewhere as any).rows?.length > 0) {
        throw new ConflictError(
          "This account already belongs to another organization. Multi-organization membership is not supported yet — ask your administrator to invite a different email address.",
        );
      }

      const here = await tx.execute<{ id: string }>(
        sql`
          SELECT id FROM organization_members
          WHERE user_id = ${userId}
            AND organization_id = ${invite.organizationId}
            AND status = 'active'
            AND deleted_at IS NULL
          LIMIT 1
        `,
      );
      if ((here as any).rows?.length > 0) {
        throw new ConflictError("This user is already a member of this organization");
      }

      // The user's only active membership is now this one — under single-org
      // semantics their primary org follows it (signin derives orgId from
      // users.organization_id).
      await tx.execute(
        sql`UPDATE users SET organization_id = ${invite.organizationId} WHERE id = ${userId}`,
      );
    }

    // Invited role, laddered at invite time; legacy NULL → viewer (see above).
    const roleId = invite.roleId ?? (await requireSystemRole(tx, "viewer")).id;

    await tx.execute(
      sql`
        UPDATE organization_members
        SET user_id = ${userId}, role_id = ${roleId}, status = 'active', is_active = true, updated_at = now()
        WHERE id = ${invite.memberId}
      `,
    );

    await writeAuditLog({
      db: tx,
      module: "core",
      organizationId: invite.organizationId,
      actorId: userId,
      actorType: "user",
      action: "organization.member.accepted",
      category: "authorization",
      resourceType: "member",
      resourceId: invite.memberId,
      afterState: { userId, roleId, email: invitedEmail, newUser },
    });

    return {
      memberId: invite.memberId,
      userId,
      organizationId: invite.organizationId,
      organizationName: invite.organizationName,
      email: invitedEmail,
      roleId,
      newUser,
    };
  });
}

export interface InviteCsvRow {
  email: string;
  roleId?: string;
  displayName?: string;
  department?: string;
}

/**
 * Bulk-invites members from CSV rows. Processes sequentially; each failure is
 * captured rather than aborting the batch.
 */
export async function bulkInviteMembers(
  db: NodePgDatabase<Record<string, any>>,
  orgId: string,
  actingUserId: string,
  rows: InviteCsvRow[],
): Promise<{
  successes: InviteResult[];
  failures: { row: number; email: string; error: string }[];
}> {
  const successes: InviteResult[] = [];
  const failures: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.email || !row.email.includes("@")) {
      failures.push({
        row: i + 1,
        email: row?.email ?? "",
        error: "Invalid or missing email",
      });
      continue;
    }
    try {
      const inviteInput: InviteOneInput = {
        email: row.email,
        ...(row.roleId ? { roleId: row.roleId } : {}),
        ...(row.displayName ? { displayName: row.displayName } : {}),
        ...(row.department ? { department: row.department } : {}),
      };
      const result = await inviteMember(db, orgId, actingUserId, inviteInput);
      successes.push(result);
    } catch (e) {
      failures.push({
        row: i + 1,
        email: row.email,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  await writeAuditLog({
    db,
    module: "core",
    actorId: actingUserId,
    actorType: "user",
    action: "organization.members.bulk_invited",
    category: "authorization",
    resourceType: "organization",
    resourceId: orgId,
    afterState: {
      successCount: successes.length,
      failureCount: failures.length,
    },
  });

  return { successes, failures };
}

/**
 * How long a lapsed invitation stays visible before it is erased (NWB-P1-016).
 *
 * The same 30-day grace idiom as account and organization deletion: `listMembers` shows invited
 * rows, so admins see a lapsed invite for one cycle before it vanishes. Past the grace the row is
 * hard-deleted, not soft-deleted — a soft delete would retain `invited_email` and fail the
 * purpose. The audit row is the durable record of the invite having happened, which is why the
 * member row may go.
 */
const LAPSED_INVITE_GRACE_DAYS = 30;

/**
 * The addresses one lapsed invite's audit scrub is value-gated on: the member row's
 * `invited_email` plus the invite audit row's own `afterState.email` — the same datum ("the
 * address this invite was sent to") in its two possible locations. The audit half covers
 * pre-`invited_email` rows, where the column is NULL and the audit row is the only record.
 *
 * Collected pre-delete in the hook, while the member row still exists; the scrub itself stays
 * value-gated, so a resource-scoped row holding someone else's address is still untouched.
 */
interface InviteeScrubContext {
  emails: string[];
  userId: string | null;
  organizationId: string | null;
  invitedEmail: string | null;
}

async function collectInviteeContext(tx: DbOrTx, memberId: string): Promise<InviteeScrubContext> {
  const member = await tx.execute<{
    invited_email: string | null;
    user_id: string | null;
    organization_id: string;
  }>(
    sql`SELECT invited_email, user_id, organization_id
        FROM organization_members WHERE id = ${memberId}`,
  );
  const memberRow = (
    member as unknown as {
      rows?: { invited_email: string | null; user_id: string | null; organization_id: string }[];
    }
  ).rows?.[0];
  const audit = await tx.execute<{ email: string | null }>(
    sql`SELECT DISTINCT after_state->>'email' AS email
        FROM unified_audit_log
        WHERE resource_type = 'member' AND resource_id = ${memberId}
          AND after_state->>'email' IS NOT NULL`,
  );
  const auditRows = (audit as unknown as { rows?: { email: string | null }[] }).rows ?? [];

  const emails = new Set<string>();
  if (memberRow?.invited_email) emails.add(memberRow.invited_email);
  for (const row of auditRows) {
    if (row.email) emails.add(row.email);
  }
  // A missing row means a concurrent run got there first — its DELETE will remove 0 and the
  // row counts as neither (the deleteRowsPerRow contract), so the context degrades to empty
  // and the hold checks below are skipped: there is nothing left to hold.
  if (!memberRow) return { emails: [], userId: null, organizationId: null, invitedEmail: null };
  return {
    emails: [...emails],
    userId: memberRow.user_id,
    organizationId: memberRow.organization_id,
    invitedEmail: memberRow.invited_email,
  };
}

/**
 * Permanently deletes invitations that lapsed past the grace window, one row at a time.
 * Returns `{ deleted, failed, errors, auditAnonymized, held }` — rows actually erased, rows
 * that refused, the per-row reasons, audit rows scrubbed of invitee addresses, and rows held
 * by legal freeze. Called by the `retention.purge-expired-invitations` job; idempotent at the
 * source, so at-least-once delivery is safe — a re-run simply finds nothing.
 *
 * Candidates are `status='invited'` rows with a known lapse (`expires_at` set and past grace),
 * oldest-lapsed-first. Accepted rows are excluded by the status predicate even though accept
 * leaves `expires_at` set; NULL-`expires_at` rows are excluded because lapse is unprovable for
 * them. No row can refuse today — nothing references `organization_members` restrictively — but
 * the delete still runs per row (NWB-P1-013), because the scrub needs per-row scope regardless.
 *
 * Each row's invitee address is scrubbed from its own audit rows before the DELETE
 * (`anonymizeAuditInviteeEmail`, resource-scoped to the member id), and a re-invite afterwards
 * is a fresh insert: `inviteMember`'s dedup finds no pending row and takes the insert path.
 * Existing-user invitees keep their accounts — only the member row goes.
 */
export async function expireInvitations(
  db: NodePgDatabase<Record<string, any>>,
): Promise<PerRowDeleteResult> {
  const rows = await db.execute<{ id: string }>(
    sql`
      SELECT id FROM organization_members
      WHERE status = 'invited'
        AND deleted_at IS NULL
        AND expires_at IS NOT NULL
        AND expires_at <= now() - make_interval(days => ${LAPSED_INVITE_GRACE_DAYS})
      ORDER BY expires_at, id
    `,
  );
  const ids = ((rows as unknown as { rows?: { id: string }[] }).rows ?? []).map((row) => row.id);
  return deleteRowsPerRow(db, "organization_members", ids, {
    beforeDelete: async (tx, id) => {
      const context = await collectInviteeContext(tx, id);
      // Hold predicates, invitee-side: the org's hold freezes its invites; a held user's invite
      // is held evidence whether the row hints at them by id or (legacy rows) names them only
      // by address. The scrub runs after — scrubbing held evidence would be erasure by another
      // name. A concurrently-vanished row (null org) skips straight to the no-op scrub.
      if (context.organizationId !== null) {
        await assertNoActiveHoldForOrg(tx, context.organizationId, `invitation ${id}`);
      }
      if (context.userId !== null) {
        await assertNoActiveHoldForUser(tx, context.userId, `invitation ${id}`);
      } else if (context.invitedEmail !== null) {
        await assertNoActiveHoldForUserEmail(tx, context.invitedEmail, `invitation ${id}`);
      }
      return anonymizeAuditInviteeEmail(tx, { memberId: id, emails: context.emails });
    },
  });
}
