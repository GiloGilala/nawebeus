import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getConfig } from "../../lib/config";
import { ConflictError, ValidationError } from "../../lib/errors";
import { generateSecureToken, hashToken } from "../../lib/tokens";
import { writeAuditLog } from "../audit";
import { emailService } from "../email";
import { hashPassword } from "./password";

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

function generateUsername(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return `${sanitized}-${crypto.randomUUID().slice(0, 6)}`;
}

function generateSlug(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${sanitized}-${crypto.randomUUID().slice(0, 6)}`;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Member";
  return { firstName, lastName };
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

  const hashed = await hashPassword(password);
  const username = generateUsername(email);
  const { firstName, lastName } = splitName(fullName);

  // Create user with password history
  const now = new Date().toISOString();
  const userRows = await db.execute<{
    id: string;
    password_history: string[] | null;
  }>(
    sql`
      INSERT INTO users (
        email, password, password_history, username, first_name, last_name,
        status, email_verified, timezone, locale,
        terms_accepted_at, privacy_accepted_at,
        marketing_consent_at, data_processing_consent
      )
      VALUES (
        ${email}, ${hashed}, ${JSON.stringify([hashed])}::jsonb, ${username}, ${firstName}, ${lastName},
        'pending_verification', false, 'Africa/Lagos', 'en-NG',
        ${now}::timestamptz, ${now}::timestamptz,
        ${marketingOptIn ? now : null}::timestamptz, ${marketingOptIn ?? false}
      )
      RETURNING id, password_history
    `,
  );
  const user = (userRows as any).rows?.[0] as any;
  const userId = user.id;

  // Create organization with Nigerian defaults
  const orgRows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO organizations (
        name, slug, display_name, owner_id, created_by, is_parent, is_verified,
        type, industry, company_size, terms_accepted_at, privacy_policy_accepted_at,
        currency, language, status, is_active
      )
      VALUES (
        ${organizationName}, ${slug}, ${organizationName}, ${userId}, ${userId}, true, false,
        'team', ${industry ?? null}, ${teamSize ?? null},
        ${new Date().toISOString()}::timestamptz, ${new Date().toISOString()}::timestamptz,
        ${NIGERIAN_ORG_DEFAULTS.currency}, ${NIGERIAN_ORG_DEFAULTS.language},
        'active', true
      )
      RETURNING id
    `,
  );
  const org = (orgRows as any).rows?.[0] as any;
  const orgId = org.id;

  // Set Nigerian preferences via JSON
  const prefs = {
    timezone: NIGERIAN_ORG_DEFAULTS.timezone,
    locale: NIGERIAN_ORG_DEFAULTS.language,
    dateFormat: NIGERIAN_ORG_DEFAULTS.dateFormat,
    currency: NIGERIAN_ORG_DEFAULTS.currency,
  };

  await db.execute(
    sql`
      UPDATE organizations
      SET preferences = ${JSON.stringify(prefs)}::jsonb,
          owner_id = ${userId}, created_by = ${userId}
      WHERE id = ${orgId}
    `,
  );

  // Set user's organization
  await db.execute(sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${userId}`);

  // Create org membership (user is Owner)
  await db.execute(
    sql`
      INSERT INTO organization_members (organization_id, user_id, status, is_active)
      VALUES (${orgId}, ${userId}, 'active', true)
    `,
  );

  // If password_history is null, update it
  if (!user.password_history || user.password_history.length === 0) {
    await db.execute(
      sql`UPDATE users SET password_history = ${JSON.stringify([hashed])}::jsonb WHERE id = ${userId}`,
    );
  }

  // Generate email verification token (32 bytes, SHA-256 hash stored)
  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.execute(
    sql`
      INSERT INTO tokens (
        user_id, token_type, selector, hashed_validator, status, purpose, target_email, expires_at
      )
      VALUES (
        ${userId}, 'email_verification', ${rawToken.slice(0, 32)}, ${tokenHash},
        'active', 'email_verification', ${email}, ${tokenExpires.toISOString()}
      )
    `,
  );

  const verificationLink = `${config.CORS_ORIGIN}/verify-email?token=${rawToken}`;

  await emailService.send({
    to: email,
    subject: "Verify your Nawebeus email",
    html: `
      <h2>Welcome to Nawebeus</h2>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.signup.completed",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
    afterState: { organizationId: orgId, status: "pending_verification" },
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
