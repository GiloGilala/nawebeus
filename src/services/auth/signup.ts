import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { ConflictError, InternalError, ValidationError } from "../../lib/errors";
import { withAtomicWrites } from "../../lib/transaction";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";
import { createEmailVerificationToken, createUserRecord } from "./user-record";

export interface SignupInput {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  industry?: string;
  teamSize?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn?: boolean;
}

export interface SignupResult {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  emailVerificationToken: string;
}

const NIGERIAN_ORG_DEFAULTS = {
  currency: "NGN",
  language: "en-NG",
  timezone: "Africa/Lagos",
  dateFormat: "DD/MM/YYYY",
};

function generateSlug(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${sanitized}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function signup(
  db: NodePgDatabase<Record<string, any>>,
  input: SignupInput,
): Promise<SignupResult> {
  const config = getConfig();
  const {
    email,
    password,
    fullName,
    organizationName,
    industry,
    teamSize,
    termsAccepted,
    privacyAccepted,
    marketingOptIn,
  } = input;

  if (!termsAccepted || !privacyAccepted) {
    throw new ValidationError("Terms and Privacy must be accepted");
  }

  // Check duplicate email
  const existing = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`,
  );
  if ((existing as any).rows?.length > 0) {
    throw new ConflictError(
      "A user with this email already exists. Log in or reset your password.",
    );
  }

  // Check duplicate org slug
  let slug = generateSlug(organizationName);
  const existingOrg = await db.execute<{ id: string }>(
    sql`SELECT id FROM organizations WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`,
  );
  if ((existingOrg as any).rows?.length > 0) {
    // Regenerate with a unique suffix
    slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  // D13/DEC-039: the org owner gets the per-org `owner` role (a system role
  // with a NULL organization_id). A missing role means an unseeded
  // environment — fail closed instead of creating a permission-less owner
  // (F-01: a NULL role_id means loadAbility yields zero permissions, so the
  // product was unusable right after signup).
  const roleRows = await db.execute<{ id: string }>(
    sql`
      SELECT id FROM roles
      WHERE code = 'owner'
        AND organization_id IS NULL
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
  );
  const ownerRoleId = (roleRows as any).rows?.[0]?.id as string | undefined;
  if (!ownerRoleId) {
    throw new InternalError(
      "The 'owner' role is missing from the role catalog. Run the seed before allowing signups.",
    );
  }

  const now = new Date().toISOString();

  // Atomic signup (FR-ORG-001 AC7): user + organization + membership +
  // token + audit rows commit or roll back together. Previously these were
  // six independent writes — a crash mid-signup left an orphan user or an
  // organization with no owner. The user row and the email-verification token
  // are created by the shared helpers in `user-record.ts` (NWB-P0-016) so the
  // invitation-accept path produces byte-identical user records; the email
  // *send* still happens after this transaction commits — a failed send must
  // not roll back a committed account.
  const { userId, orgId, username, firstName, lastName, rawToken } = await withAtomicWrites(
    db,
    async (tx) => {
      const user = await createUserRecord(tx, {
        email,
        password,
        fullName,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        ...(marketingOptIn !== undefined ? { marketingOptIn } : {}),
      });

      // Create organization with Nigerian defaults
      const orgRows = await tx.execute<{ id: string }>(
        sql`
      INSERT INTO organizations (
        name, slug, display_name, owner_id, created_by, is_parent, is_verified,
        type, industry, company_size, terms_accepted_at, privacy_policy_accepted_at,
        currency, language, status, is_active
      )
      VALUES (
        ${organizationName}, ${slug}, ${organizationName}, ${user.userId}, ${user.userId}, true, false,
        'team', ${industry ?? null}, ${teamSize ?? null},
        ${new Date().toISOString()}::timestamptz, ${new Date().toISOString()}::timestamptz,
        ${NIGERIAN_ORG_DEFAULTS.currency}, ${NIGERIAN_ORG_DEFAULTS.language},
        'active', true
      )
      RETURNING id
    `,
      );
      const org = (orgRows as any).rows?.[0] as any;

      // Set Nigerian preferences via JSON
      const prefs = {
        timezone: NIGERIAN_ORG_DEFAULTS.timezone,
        locale: NIGERIAN_ORG_DEFAULTS.language,
        dateFormat: NIGERIAN_ORG_DEFAULTS.dateFormat,
        currency: NIGERIAN_ORG_DEFAULTS.currency,
      };

      await tx.execute(
        sql`
      UPDATE organizations
      SET preferences = ${JSON.stringify(prefs)}::jsonb,
          owner_id = ${user.userId}, created_by = ${user.userId}
      WHERE id = ${org.id}
    `,
      );

      // Set user's organization
      await tx.execute(sql`UPDATE users SET organization_id = ${org.id} WHERE id = ${user.userId}`);

      // Create org membership WITH the owner role (FR-ORG-001 AC2 — this
      // column was missing before the F-01 fix; a NULL role_id yields zero
      // permissions in loadAbility).
      await tx.execute(
        sql`
      INSERT INTO organization_members (organization_id, user_id, role_id, status, is_active)
      VALUES (${org.id}, ${user.userId}, ${ownerRoleId}, 'active', true)
    `,
      );

      // (createUserRecord seeds password_history in the INSERT — the self-heal
      // UPDATE that used to live here was a no-op and went away with the
      // extraction.)
      const { rawToken } = await createEmailVerificationToken(tx, {
        userId: user.userId,
        email,
      });

      await writeAuditLog({
        db: tx,
        module: "core",
        actorId: user.userId,
        actorType: "user",
        action: "auth.signup.completed",
        category: "authentication",
        resourceType: "user",
        resourceId: user.userId,
        afterState: { organizationId: org.id, status: "pending_verification" },
      });

      await writeAuditLog({
        db: tx,
        module: "core",
        organizationId: org.id,
        actorId: user.userId,
        actorType: "user",
        action: "organization.owner.created",
        category: "authorization",
        resourceType: "organization",
        resourceId: org.id,
        afterState: { ownerId: user.userId, roleCode: "owner" },
      });

      return {
        userId: user.userId,
        orgId: org.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        rawToken,
      };
    },
  );

  // One server-decided base for every emailed link (NWB-P0-021). The path is
  // the API route that actually exists — `/api/auth/verify-email`, matching
  // `sendVerificationEmail`. The bare `/verify-email` this used to emit was a
  // 404 for every signup (F-09).
  const verificationLink = `${config.APP_BASE_URL_RESOLVED}/api/auth/verify-email?token=${rawToken}`;

  await emailService.send({
    kind: "verification",
    context: { organizationId: orgId, userId },
    to: email,
    subject: "Verify your Nawebeus email",
    html: `
      <h2>Welcome to Nawebeus</h2>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  return {
    user: {
      id: userId,
      email,
      username,
      firstName,
      lastName,
      status: "pending_verification",
    },
    organization: {
      id: orgId,
      name: organizationName,
      slug,
    },
    emailVerificationToken: rawToken,
  };
}
