import { type Ability, AbilityBuilder, createMongoAbility } from "@casl/ability";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ConflictError } from "../../lib/errors";
import { normaliseIp } from "../../lib/ip";
import {
  buildPage,
  DEFAULT_PAGE_SIZE,
  type Page,
  type PaginationParams,
} from "../../lib/pagination";
import { generateSecureToken, hashToken } from "../../lib/tokens";
import {
  API_KEY_NAMESPACE,
  type ApiKeyEnvironment,
  type ApiKeyListEntry,
  type ApiKeyPermissionLevel,
  type ApiKeySecurityLevel,
  type ApiKeyStatus,
  type ApiKeyType,
  type ApiKeyUsage,
  type CreateApiKeyInput,
  type CreatedApiKey,
  ENVIRONMENT_CODES,
  KEY_PREFIX_LENGTH,
  type ParsedApiKey,
  PUBLIC_KEY_HEX_LENGTH,
  type ResolvedApiKey,
  type RevocationType,
  type RevokeOutcome,
  type RotateOutcome,
} from "../../server/auth/types/api-key-types";
import { type AuditActor, writeAuditLog } from "../audit";
import type { Actions, Subjects } from "./ability";

type Db = NodePgDatabase<Record<string, any>>;
type AppAbility = Ability<[Actions, Subjects]>;

/**
 * Which CASL actions a key at each permission level may exercise. This is the
 * narrowing applied on top of the owning user's ability — a key can never be
 * broader than its owner, only narrower.
 *
 * `read_only` and `read` are equivalent; the schema carries both spellings
 * (`read_only` is the column default) so both must map to the same behaviour.
 */
/**
 * Which CASL actions a key at each permission level may inherit from its owner.
 *
 * `admin` is the wildcard, NOT the literal action `"manage"`. `loadAbility()`
 * expands permissions into concrete actions (`read`/`create`/`update`/`delete`),
 * so filtering on the string `"manage"` would match nothing and hand an admin key
 * an empty ability. Admin therefore means "do not narrow the action at all" —
 * the subject allow-list (`scopes`) still applies.
 */
const ACTIONS_BY_PERMISSION_LEVEL: Record<ApiKeyPermissionLevel, Actions[] | "any"> = {
  read_only: ["read"],
  read: ["read"],
  // Deliberately excludes `delete`: a write key can change things, not destroy them.
  write: ["read", "create", "update"],
  admin: "any",
};

/** Postgres `unique_violation`. */
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

/**
 * Length-independent, branch-free comparison of two hex digests.
 *
 * Mirrors the manual byte loop in `src/services/auth/jwt.ts`. Kept local rather
 * than shared because the two operate on different representations (hex string
 * vs Uint8Array) and neither is on a hot enough path to justify a shared
 * helper with two adapters.
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Mints a fresh key. The public half is 128 bits of CSPRNG output used purely as
 * an indexed lookup id; the secret half is 256 bits and is the only secret.
 */
export function generateApiKeyMaterial(environment: ApiKeyEnvironment): {
  key: string;
  publicKey: string;
  secret: string;
  keyPrefix: string;
} {
  const environmentCode = ENVIRONMENT_CODES[environment];
  const publicKey = generateSecureToken().slice(0, PUBLIC_KEY_HEX_LENGTH);
  const secret = generateSecureToken();
  const key = `${API_KEY_NAMESPACE}_${environmentCode}_${publicKey}_${secret}`;
  return { key, publicKey, secret, keyPrefix: key.slice(0, KEY_PREFIX_LENGTH) };
}

/** Splits a presented key. Returns null for anything that is not our format. */
export function parseApiKey(raw: string): ParsedApiKey | null {
  const parts = raw.split("_");
  if (parts.length !== 4) return null;

  const namespace = parts[0]!;
  const environmentCode = parts[1]!;
  const publicKey = parts[2]!;
  const secret = parts[3]!;

  if (namespace !== API_KEY_NAMESPACE) return null;
  if (!environmentCode || !publicKey || !secret) return null;
  if (publicKey.length !== PUBLIC_KEY_HEX_LENGTH) return null;
  if (!/^[0-9a-f]+$/.test(publicKey) || !/^[0-9a-f]+$/.test(secret)) return null;

  return { environmentCode, publicKey, secret };
}

/**
 * Display form for the list endpoint. Reveals the environment prefix and the
 * last four characters of the *public* half — never any part of the secret,
 * because no fragment of the secret is stored.
 */
export function maskApiKey(keyPrefix: string, publicKey: string): string {
  return `${keyPrefix}...${publicKey.slice(-4)}`;
}

export async function createApiKey(db: Db, input: CreateApiKeyInput): Promise<CreatedApiKey> {
  // (organization_id, name) is unique among live rows. Pre-check for a clean 409;
  // the catch below covers the race where two creates interleave.
  const duplicate = await db.execute<{ id: string }>(
    sql`SELECT id FROM api_keys
        WHERE organization_id = ${input.organizationId}
          AND name = ${input.name}
          AND deleted_at IS NULL
        LIMIT 1`,
  );
  if (((duplicate as any).rows?.length ?? 0) > 0) {
    throw new ConflictError(`An API key named "${input.name}" already exists`);
  }

  const material = generateApiKeyMaterial(input.environment);
  const secretHash = await hashToken(material.secret);
  // Identifies a key without revealing it — stable across the key's lifetime.
  const fingerprint = await hashToken(material.publicKey);

  let rows: unknown;
  try {
    rows = await db.execute<{ id: string; issued_at: Date }>(
      sql`
        INSERT INTO api_keys (
          organization_id, user_id, name, description, key_type, environment, status,
          public_key, secret_hash, key_prefix, fingerprint,
          permission_level, security_level, scopes,
          expires_at, rotation_strategy,
          created_ip, created_user_agent, created_by
        ) VALUES (
          ${input.organizationId}, ${input.userId}, ${input.name}, ${input.description ?? null},
          ${input.keyType}, ${input.environment}, 'active',
          ${material.publicKey}, ${secretHash}, ${material.keyPrefix}, ${fingerprint},
          ${input.permissionLevel}, ${input.securityLevel}, ${JSON.stringify(input.scopes)},
          ${input.expiresAt}, ${input.rotationStrategy},
          ${normaliseIp(input.createdIp)}, ${input.createdUserAgent ?? null}, ${input.createdBy}
        )
        RETURNING id, issued_at
      `,
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`An API key named "${input.name}" already exists`);
    }
    throw error;
  }

  const row = (rows as any).rows?.[0] as any;

  // Audited here rather than at the caller. Two of this file's mutators were audited from
  // `api-keys.route.ts`, which meant the same operation through `src/app/server-functions/api-keys.ts`
  // — the TanStack side of the same feature — mutated with no audit row at all. A service that owns its
  // event cannot be bypassed by choosing a different entrypoint, and `unified_audit_log`'s promise is
  // "100% write operation coverage" (PRD §8.10.2), not "100% coverage of the HTTP path".
  await writeAuditLog({
    db,
    module: "core",
    organizationId: input.organizationId,
    actorId: input.createdBy,
    actorType: input.actorType,
    actorIp: input.createdIp ?? undefined,
    actorUserAgent: input.createdUserAgent ?? undefined,
    action: "apikeys.created",
    resourceId: row.id,
    // Metadata only — the key value must never reach the audit log. `name`/`scopes`/`expiresAt` are
    // what makes "which key was abused" answerable; the prefix and hash are not needed to say that.
    afterState: {
      name: input.name,
      keyType: input.keyType,
      environment: input.environment,
      permissionLevel: input.permissionLevel,
      scopes: input.scopes,
      expiresAt: input.expiresAt?.toISOString() ?? null,
    },
  });

  return {
    id: row.id,
    name: input.name,
    key: material.key,
    keyPrefix: material.keyPrefix,
    publicKey: material.publicKey,
    environment: input.environment,
    keyType: input.keyType,
    permissionLevel: input.permissionLevel,
    scopes: input.scopes,
    status: "active",
    issuedAt: row.issued_at ? new Date(row.issued_at) : new Date(),
    expiresAt: input.expiresAt,
  };
}

export async function listApiKeys(
  db: Db,
  organizationId: string,
  status: ApiKeyStatus = "active",
  page?: PaginationParams,
): Promise<Page<ApiKeyListEntry>> {
  const limit = page?.limit ?? DEFAULT_PAGE_SIZE;
  const cursor = page?.cursor ?? null;
  const after = cursor
    ? sql`AND (issued_at, id) < (${cursor.v}::timestamptz, ${cursor.id}::uuid)`
    : sql``;
  const rows = await db.execute<{
    id: string;
    name: string;
    description: string | null;
    key_prefix: string;
    public_key: string;
    key_type: string;
    environment: string;
    permission_level: string;
    security_level: string;
    scopes: string[] | null;
    status: string;
    issued_at: Date;
    expires_at: Date | null;
    last_used_at: Date | null;
    usage_count: number;
    revoked_at: Date | null;
    revoke_reason: string | null;
    cursor_v: string;
  }>(
    sql`
      SELECT id, name, description, key_prefix, public_key, key_type, environment,
             permission_level, security_level, scopes, status, issued_at, expires_at,
             last_used_at, usage_count, revoked_at, revoke_reason,
             to_char(issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS cursor_v
      FROM api_keys
      WHERE organization_id = ${organizationId}
        AND deleted_at IS NULL
        AND status = ${status}
        ${after}
      ORDER BY issued_at DESC, id DESC
      LIMIT ${limit + 1}
    `,
  );

  const mapped = ((rows as any).rows ?? []).map(
    (r: any): ApiKeyListEntry & { _cursorV: string } => ({
      _cursorV: r.cursor_v,
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      maskedKey: maskApiKey(r.key_prefix, r.public_key),
      keyType: r.key_type as ApiKeyType,
      environment: r.environment as ApiKeyEnvironment,
      permissionLevel: r.permission_level as ApiKeyPermissionLevel,
      securityLevel: r.security_level as ApiKeySecurityLevel,
      scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
      status: r.status as ApiKeyStatus,
      issuedAt: new Date(r.issued_at),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
      usageCount: r.usage_count ?? 0,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      revokeReason: r.revoke_reason ?? null,
    }),
  );
  return buildPage(mapped, limit, (k: any) => k._cursorV);
}

/**
 * Revokes a key. Scoped by organization so an id from another tenant reads as
 * absent rather than forbidden — the caller learns nothing about foreign ids.
 *
 * The row is retained (status flips to `revoked`); it is not soft-deleted, so
 * the key stays visible in history and can never be resurrected.
 */
export async function revokeApiKey(
  db: Db,
  organizationId: string,
  id: string,
  /** Who revoked it — required, because a revocation with no actor is indistinguishable from a bug. */
  actor: AuditActor,
  reason: string | null = null,
  revocationType: RevocationType = "user",
): Promise<RevokeOutcome> {
  const existing = await db.execute<{ id: string; revoked_at: Date | null }>(
    sql`SELECT id, revoked_at FROM api_keys
        WHERE id = ${id}
          AND organization_id = ${organizationId}
          AND deleted_at IS NULL
        LIMIT 1`,
  );
  const row = (existing as any).rows?.[0] as any;
  if (!row) return { outcome: "not_found" };
  if (row.revoked_at) return { outcome: "already_revoked", id };

  await db.execute(
    sql`
      UPDATE api_keys
      SET status = 'revoked', revoked_at = now(), revoked_by = ${actor.actorId},
          revoke_reason = ${reason}, revocation_type = ${revocationType},
          updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId}
    `,
  );

  await writeAuditLog({
    db,
    module: "core",
    organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "apikeys.revoked",
    resourceId: id,
    ...(reason ? { reason } : {}),
    beforeState: { status: "active" },
    afterState: { status: "revoked" },
    metadata: { revocationType },
  });

  return { outcome: "revoked", id };
}

/**
 * Rotates a key by minting a replacement and retiring the original.
 *
 * The old row is both revoked *and* soft-deleted: soft-deleting is what frees
 * the `(organization_id, name)` unique index so the replacement can reuse the
 * name, and revoking is what makes the old credential fail closed. The row is
 * kept for audit lineage via `rotated_from_id`.
 *
 * Deliberately not wrapped in a transaction. Retiring first means the failure
 * mode is "old key dead, new key missing" — recoverable by creating a key —
 * rather than "both keys live", which is not. `db.transaction` is also unusable
 * here: DB-backed tests already run inside an outer transaction that the
 * harness rolls back, and a nested BEGIN/COMMIT would break that isolation.
 */
export async function rotateApiKey(
  db: Db,
  organizationId: string,
  id: string,
  actor: AuditActor,
): Promise<RotateOutcome> {
  const existing = await db.execute<{
    id: string;
    user_id: string | null;
    name: string;
    description: string | null;
    key_type: string;
    environment: string;
    permission_level: string;
    security_level: string;
    scopes: string[] | null;
    expires_at: Date | null;
    rotation_strategy: string | null;
    rotation_count: number;
    secret_version: number;
    status: string;
    revoked_at: Date | null;
  }>(
    sql`
      SELECT id, user_id, name, description, key_type, environment, permission_level,
             security_level, scopes, expires_at, rotation_strategy, rotation_count,
             secret_version, status, revoked_at
      FROM api_keys
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      LIMIT 1
    `,
  );

  const old = (existing as any).rows?.[0] as any;
  if (!old) return { outcome: "not_found" };
  if (old.revoked_at || old.status === "revoked") return { outcome: "already_revoked" };

  const environment = old.environment as ApiKeyEnvironment;
  const material = generateApiKeyMaterial(environment);
  const secretHash = await hashToken(material.secret);
  const fingerprint = await hashToken(material.publicKey);

  await db.execute(
    sql`
      UPDATE api_keys
      SET status = 'revoked', revoked_at = now(), revoked_by = ${actor.actorId},
          revoke_reason = 'rotated', revocation_type = 'user',
          deleted_at = now(), deleted_by = ${actor.actorId}, updated_at = now()
      WHERE id = ${old.id} AND organization_id = ${organizationId}
    `,
  );

  const inserted = await db.execute<{ id: string; issued_at: Date }>(
    sql`
      INSERT INTO api_keys (
        organization_id, user_id, name, description, key_type, environment, status,
        public_key, secret_hash, key_prefix, fingerprint,
        permission_level, security_level, scopes,
        expires_at, rotation_strategy, rotated_from_id, rotation_count,
        secret_version, last_rotated_at, created_by
      ) VALUES (
        ${organizationId}, ${old.user_id}, ${old.name}, ${old.description ?? null},
        ${old.key_type}, ${environment}, 'active',
        ${material.publicKey}, ${secretHash}, ${material.keyPrefix}, ${fingerprint},
        ${old.permission_level}, ${old.security_level},
        ${JSON.stringify(Array.isArray(old.scopes) ? old.scopes : [])},
        ${old.expires_at}, ${old.rotation_strategy ?? "none"}, ${old.id},
        ${(old.rotation_count ?? 0) + 1}, ${(old.secret_version ?? 1) + 1},
        now(), ${actor.actorId}
      )
      RETURNING id, issued_at
    `,
  );

  const row = (inserted as any).rows?.[0] as any;

  await writeAuditLog({
    db,
    module: "core",
    organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "apikeys.rotated",
    // The *new* key is the resource: this is the event that says "a credential changed", and the
    // id it replaced is in `metadata` so both directions are queryable.
    resourceId: row.id,
    metadata: { rotatedFromId: old.id },
    afterState: {
      name: old.name,
      expiresAt: old.expires_at ? new Date(old.expires_at).toISOString() : null,
    },
  });

  return {
    outcome: "rotated",
    key: {
      id: row.id,
      name: old.name,
      key: material.key,
      keyPrefix: material.keyPrefix,
      publicKey: material.publicKey,
      environment,
      keyType: old.key_type as ApiKeyType,
      permissionLevel: old.permission_level as ApiKeyPermissionLevel,
      scopes: Array.isArray(old.scopes) ? (old.scopes as string[]) : [],
      status: "active",
      issuedAt: row.issued_at ? new Date(row.issued_at) : new Date(),
      expiresAt: old.expires_at ? new Date(old.expires_at) : null,
    },
  };
}

/**
 * Verifies a presented key and returns the identity it carries, or null.
 *
 * Every rejection path returns null with no detail, so a caller cannot
 * distinguish "no such key" from "wrong secret" from "revoked" from "expired".
 * The two miss paths still perform a hash so they cost the same as a hit.
 */
export async function resolveApiKey(db: Db, rawKey: string): Promise<ResolvedApiKey | null> {
  const parsed = parseApiKey(rawKey);
  if (!parsed) {
    await hashToken(rawKey);
    return null;
  }

  const rows = await db.execute<{
    id: string;
    organization_id: string;
    user_id: string | null;
    secret_hash: string | null;
    status: string;
    environment: string;
    permission_level: string;
    scopes: string[] | null;
    expires_at: Date | null;
    not_before: Date | null;
    revoked_at: Date | null;
    deleted_at: Date | null;
  }>(
    sql`
      SELECT id, organization_id, user_id, secret_hash, status, environment,
             permission_level, scopes, expires_at, not_before, revoked_at, deleted_at
      FROM api_keys
      WHERE public_key = ${parsed.publicKey}
      LIMIT 1
    `,
  );

  const row = (rows as any).rows?.[0] as any;
  if (!row) {
    await hashToken(parsed.secret);
    return null;
  }

  const presentedHash = await hashToken(parsed.secret);
  if (!row.secret_hash || !constantTimeEqualHex(presentedHash, row.secret_hash)) return null;

  if (row.deleted_at || row.revoked_at) return null;
  if (row.status !== "active") return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.not_before && new Date(row.not_before).getTime() > Date.now()) return null;
  // An unowned key has no ability to load, so it cannot authorize anything.
  if (!row.user_id) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    permissionLevel: row.permission_level as ApiKeyPermissionLevel,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    environment: row.environment as ApiKeyEnvironment,
  };
}

/**
 * Best-effort usage bookkeeping. Never throws: usage tracking is observability,
 * not authorization, and must not reject an otherwise valid request. The
 * eventual home for this is a batched worker (NWB-P1-001) rather than an
 * inline write per request.
 */
export async function recordApiKeyUsage(db: Db, id: string, usage: ApiKeyUsage): Promise<void> {
  try {
    await db.execute(
      sql`
        UPDATE api_keys
        SET last_used_at = now(),
            usage_count = usage_count + 1,
            last_used_ip = ${normaliseIp(usage.ip)},
            last_user_agent = ${usage.userAgent},
            updated_at = now()
        WHERE id = ${id}
      `,
    );
  } catch {
    // Intentionally swallowed — see docstring.
  }
}

/**
 * Narrows the owning user's ability to what the key is allowed to do.
 *
 * The result is installed as the request's ability, so the existing
 * `requireAbility(action, subject)` guard enforces the key's limits with no
 * change to the guard itself — a read-only key hitting a `create` route gets a
 * 403 from the same code path that already guards cookie sessions.
 *
 * `scopes` is a subject allow-list. Empty means "everything the owner can do,
 * subject to `permissionLevel`"; non-empty means "only these subjects".
 */
export function apiKeyAbility(
  base: AppAbility,
  permissionLevel: ApiKeyPermissionLevel,
  scopes: string[],
): AppAbility {
  const allowed = ACTIONS_BY_PERMISSION_LEVEL[permissionLevel];
  const allowsAction = (action: string): boolean =>
    allowed === "any" || allowed.includes(action as Actions);
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const rule of base.rules as Array<{
    action: string | string[];
    subject: string | string[];
    conditions?: Record<string, unknown>;
  }>) {
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
    const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];

    for (const action of actions) {
      if (!allowsAction(action)) continue;
      for (const subject of subjects) {
        if (scopes.length > 0 && !scopes.includes(subject)) continue;
        can(action as Actions, subject as Subjects, rule.conditions as never);
      }
    }
  }

  return build();
}
