import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { hashPassword } from "./password";
import { getConfig } from "../../lib/config";
import { ConflictError } from "../../lib/errors";

function generateUsername(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return `${sanitized}-${crypto.randomUUID().slice(0, 6)}`;
}

function generateSlug(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return `${sanitized}-org-${crypto.randomUUID().slice(0, 6)}`;
}

function extractName(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] ?? "user";
  const parts = local.replace(/[^a-zA-Z-]/g, " ").trim().split(/\s+/);
  const firstName = parts[0] ?? "User";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Member";
  return { firstName, lastName };
}

export interface SignupInput {
  email: string;
  password: string;
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

export async function signup(db: NodePgDatabase<Record<string, any>>, input: SignupInput): Promise<SignupResult> {
  const config = getConfig();

  const { email, password } = input;

  // Check duplicate
  const existing = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`,
  );
  if ((existing as any).rows?.length > 0) {
    throw new ConflictError("A user with this email already exists");
  }

  const hashed = await hashPassword(password);
  const username = generateUsername(email);
  const { firstName, lastName } = extractName(email);

  // Create user
  const userRows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO users (email, password, username, first_name, last_name, status, email_verified)
      VALUES (${email}, ${hashed}, ${username}, ${firstName}, ${lastName}, 'pending_verification', false)
      RETURNING id
    `,
  );
  const userId = ((userRows as any).rows?.[0] as any)?.id as string;

  // Create personal org
  const orgSlug = generateSlug(email);
  const orgName = `${firstName}'s Organization`;
  const orgRows = await db.execute<{ id: string }>(
    sql`
      INSERT INTO organizations (name, slug, display_name, owner_id, created_by, is_parent, is_verified)
      VALUES (${orgName}, ${orgSlug}, ${orgName}, ${userId}, ${userId}, true, true)
      RETURNING id
    `,
  );
  const orgId = ((orgRows as any).rows?.[0] as any)?.id as string;

  // Link user to org
  await db.execute(
    sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${userId}`,
  );

  // Update org ownership
  await db.execute(
    sql`
      UPDATE organizations
      SET owner_id = ${userId}, created_by = ${userId}
      WHERE id = ${orgId}
    `,
  );

  // Create org membership
  await db.execute(
    sql`
      INSERT INTO organization_members (organization_id, user_id, status, is_active)
      VALUES (${orgId}, ${userId}, 'active', true)
    `,
  );

  // Generate email verification token
  const token = crypto.randomUUID();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.execute(
    sql`
      INSERT INTO tokens (user_id, token_type, status, purpose, target_email, expires_at)
      VALUES (${userId}, 'email_verification', 'active', 'email_verification', ${email}, ${tokenExpires.toISOString()})
    `,
  );

  await db.execute(
    sql`
      UPDATE tokens
      SET selector = ${token}, hashed_validator = ${token}
      WHERE user_id = ${userId} AND purpose = 'email_verification' AND status = 'active'
    `,
  );

  const verificationLink = `${config.CORS_ORIGIN}/api/auth/verify-email?token=${token}`;
  console.log(`\n[EMAIL VERIFICATION] ${verificationLink}\n`);

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
      name: orgName,
      slug: orgSlug,
    },
    emailVerificationToken: token,
  };
}
