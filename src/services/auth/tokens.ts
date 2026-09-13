import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { generateSecureToken, hashToken, isTokenExpired } from "../../lib/tokens";

export interface TokenRow {
  id: string;
  userId: string;
  tokenType: string;
  purpose: string;
  status: string;
  targetEmail: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  useCount: number;
  isRevoked: boolean;
}

export async function createToken(
  db: NodePgDatabase<Record<string, any>>,
  params: {
    userId: string;
    tokenType: string;
    purpose: string;
    targetEmail?: string;
    expiresInMinutes: number;
    maxUses?: number;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<{ rawToken: string; row: TokenRow }> {
  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + params.expiresInMinutes * 60_000);

  // Revoke any prior unused tokens of the same purpose for this user
  await db.execute(
    sql`UPDATE tokens
        SET is_revoked = true, revoked_at = now(), status = 'revoked'
        WHERE user_id = ${params.userId}
          AND purpose = ${params.purpose}
          AND is_revoked = false
          AND expires_at > now()`,
  );

  const rows = await db.execute<{
    id: string;
    user_id: string;
    token_type: string;
    purpose: string;
    status: string;
    target_email: string;
    expires_at: Date;
    used_at: string | null;
    use_count: number;
    is_revoked: boolean;
  }>(
    sql`
      INSERT INTO tokens (
        user_id, token_type, selector, hashed_validator, status, purpose,
        target_email, expires_at, max_uses, ip_address, user_agent
      ) VALUES (
        ${params.userId}, ${params.tokenType}, ${rawToken}, ${tokenHash},
        'active', ${params.purpose}, ${params.targetEmail ?? null},
        ${expiresAt.toISOString()}, ${params.maxUses ?? 1},
        ${params.ipAddress ?? null}, ${params.userAgent ?? null}
      )
      RETURNING id, user_id, token_type, purpose, status, target_email, expires_at, used_at, use_count, is_revoked
    `,
  );

  const row = (rows as any).rows?.[0] as any;
  return {
    rawToken,
    row: {
      id: row.id,
      userId: row.user_id,
      tokenType: row.token_type,
      purpose: row.purpose,
      status: row.status,
      targetEmail: row.target_email,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      useCount: row.use_count,
      isRevoked: row.is_revoked,
    },
  };
}

export async function consumeToken(
  db: NodePgDatabase<Record<string, any>>,
  rawToken: string,
  purpose: string,
): Promise<TokenRow | null> {
  const tokenHash = await hashToken(rawToken);

  const rows = await db.execute<{
    id: string;
    user_id: string;
    token_type: string;
    purpose: string;
    status: string;
    target_email: string;
    expires_at: Date;
    used_at: string | null;
    use_count: number;
    is_revoked: boolean;
  }>(
    sql`
      SELECT id, user_id, token_type, purpose, status, target_email,
             expires_at, used_at, use_count, is_revoked
      FROM tokens
      WHERE selector = ${rawToken}
        AND hashed_validator = ${tokenHash}
        AND purpose = ${purpose}
        AND is_revoked = false
        AND status = 'active'
      LIMIT 1
    `,
  );

  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;

  if (isTokenExpired(new Date(row.expires_at))) {
    return null;
  }

  if (row.use_count >= (row.max_uses ?? 1)) {
    return null;
  }

  // Mark as used
  await db.execute(
    sql`
      UPDATE tokens
      SET used_at = now(), use_count = use_count + 1, status = 'valid'
      WHERE id = ${row.id}
    `,
  );

  return {
    id: row.id,
    userId: row.user_id,
    tokenType: row.token_type,
    purpose: row.purpose,
    status: "valid",
    targetEmail: row.target_email,
    expiresAt: row.expires_at,
    usedAt: new Date(),
    useCount: row.use_count + 1,
    isRevoked: row.is_revoked,
  };
}

export async function countRecentTokens(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  purpose: string,
  withinMinutes: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - withinMinutes * 60_000);
  const rows = await db.execute<{ count: string }>(
    sql`
      SELECT COUNT(*) as count
      FROM tokens
      WHERE user_id = ${userId}
        AND purpose = ${purpose}
        AND created_at > ${cutoff.toISOString()}
    `,
  );
  return Number((rows as any).rows?.[0]?.count ?? 0);
}
