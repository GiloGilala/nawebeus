import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { generateSecureToken, hashToken } from "../../lib/tokens";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";

export interface InviteOneInput {
  email: string;
  roleId?: string;
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

  // Check if a pending invite already exists for an existing user with this email
  const existing = await db.execute<{ id: string }>(
    sql`
      SELECT om.id FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
        AND u.email = ${input.email}
        AND om.status = 'invited'
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const existingRow = (existing as any).rows?.[0] as any;

  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const ttlHours = input.expiresInHours ?? 7 * 24;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  // Check if the user exists (by email)
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
        SET invitation_token = ${rawToken},
            invitation_token_hash = ${tokenHash},
            invitation_sent_at = now(),
            expires_at = ${expiresAt.toISOString()}::timestamptz,
            role_id = ${input.roleId ?? null},
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
          display_name, job_title, department, invitation_note,
          invitation_token, invitation_token_hash, invitation_sent_at, expires_at,
          invited_by, invited_at
        )
        VALUES (
          ${orgId}, ${userId}, ${input.roleId ?? null}, 'invited', false,
          ${input.displayName ?? null}, ${input.jobTitle ?? null}, ${input.department ?? null}, ${input.invitationNote ?? null},
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
    afterState: { email: input.email, roleId: input.roleId ?? null },
  });

  // If the user doesn't exist yet, send the invite email with the token
  if (!existingUser) {
    const inviteLink = `${config.CORS_ORIGIN}/invite?token=${rawToken}`;
    await emailService.send({
      to: input.email,
      subject: "You've been invited to join a Nawebeus organization",
      html: `
        <h2>Invitation to Nawebeus</h2>
        <p>You've been invited to join an organization on Nawebeus.</p>
        <p><a href="${inviteLink}">Accept Invitation</a></p>
        <p>This link expires in ${ttlHours} hours.</p>
      `,
    });
  }

  return {
    inviteId: rawToken.slice(0, 32),
    memberId,
    email: input.email,
    invitationToken: rawToken,
    expiresAt: expiresAt.toISOString(),
  };
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
