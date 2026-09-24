import type { Ability } from "@casl/ability";
import { sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import {
  AuthError,
  EmailNotVerifiedError,
  ForbiddenError,
  UnauthorizedError,
} from "../../lib/errors";
import {
  type ImpersonationContext,
  runWithImpersonationContext,
} from "../../lib/impersonation-context";
import { getClientIp } from "../../lib/ip";
import { runWithOrgContext } from "../../lib/org-context";
import { type Actions, loadAbility, type Subjects } from "../../services/auth/ability";
import { apiKeyAbility, recordApiKeyUsage, resolveApiKey } from "../../services/auth/api-key";
import { assertAccountCanAuthenticate } from "../../services/auth/auth.service";
import { type AccessPayload, isImpersonationToken, verifyToken } from "../../services/auth/jwt";
import { impersonationAbility, resolveLiveImpersonation } from "../../services/impersonation";

export type AppAbility = Ability<[Actions, Subjects]>;

export interface AuthUser {
  userId: string;
  orgId: string;
}

/**
 * How the request proved its identity. Recorded so audit events can distinguish
 * a human action from a machine one — `AuditActorType` already carries
 * `"api_key"` for exactly this purpose.
 */
export type AuthMethod = "session" | "api_key";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    ability: AppAbility;
    db: Db;
    authMethod: AuthMethod;
    apiKeyId: string | undefined;
    /**
     * NWB-P1-011 — set only while the access token is a live impersonation
     * token. `writeAuditLog` reads the matching ALS scope, the access log reads
     * this, and the impersonation end route reads it to let a support session
     * end itself.
     */
    impersonation: ImpersonationContext | undefined;
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * Everything that must still be true about the principal behind a session cookie
 * or an API key, checked on **every** request:
 *
 * - the account exists and has not been soft-deleted;
 * - `users.status` still permits access (F-05 / NWB-P0-015) — a suspension must
 *   take effect at the next request, not at the next sign-in, and a 15-minute
 *   access token must not outlive an administrator's decision;
 * - the membership row for the token's org is still active. Without this,
 *   removing someone from an org would leave their keys working — the key row
 *   would still say `active`.
 *
 * One statement, three answers, so the extra guard costs no extra round trip.
 */
export async function assertActivePrincipal(
  db: Db,
  userId: string,
  orgId: string,
  opts?: { requireActiveMembership?: boolean },
): Promise<{ status: string }> {
  const requireActiveMembership = opts?.requireActiveMembership !== false;
  const rows = await db.execute<{
    member_id: string | null;
    any_member_id: string | null;
    status: string;
    deleted_at: string | null;
  }>(
    sql`SELECT
          (SELECT om.id FROM organization_members om
            WHERE om.user_id = u.id
              AND om.organization_id = ${orgId}
              AND om.status = 'active'
              AND om.deleted_at IS NULL
            LIMIT 1) AS member_id,
          (SELECT om.id FROM organization_members om
            WHERE om.user_id = u.id
              AND om.organization_id = ${orgId}
              AND om.deleted_at IS NULL
            LIMIT 1) AS any_member_id,
          u.status,
          u.deleted_at
        FROM users u
        WHERE u.id = ${userId}
        LIMIT 1`,
  );
  const row = (rows as any).rows?.[0] as
    | {
        member_id: string | null;
        any_member_id: string | null;
        status: string;
        deleted_at: string | null;
      }
    | undefined;

  if (!row || row.deleted_at !== null) throw new AuthError("Account is no longer active");
  assertAccountCanAuthenticate(row.status);

  const memberId = requireActiveMembership ? row.member_id : row.any_member_id;
  if (memberId === null) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  return { status: row.status };
}

/**
 * The verified-email gate (NWB-P1-004 decision 3; closes NWB-P0-015's "server-side gate once
 * real delivery exists").
 *
 * A `pending_verification` account may sign in — `assertAccountCanAuthenticate` allows it on
 * purpose, and the sign-in response says `emailVerified: false` — but it may not *act*. The
 * server answers 403 `EMAIL_NOT_VERIFIED` on every protected route except the two families the
 * verification screen itself needs: `/api/auth/*` (resend the link, verify it, sign out, sessions,
 * MFA) and `/api/users/me*` (read the profile, change a mistyped address, delete the account).
 * Everything tenant-facing — organizations, members, invitations, approvals, audit, API keys, the
 * admin user routes — waits for the click.
 *
 * Matched on the full path (`c.req.path`) rather than on which router installed the middleware,
 * so a new router cannot opt out by accident: it is gated unless it lives under an exempt prefix.
 */
export function isVerificationExemptPath(path: string): boolean {
  return (
    path.startsWith("/api/auth/") || path === "/api/users/me" || path.startsWith("/api/users/me/")
  );
}

function assertEmailVerifiedFor(path: string, status: string): void {
  if (status !== "pending_verification") return;
  if (isVerificationExemptPath(path)) return;
  throw new EmailNotVerifiedError();
}

/**
 * The org-lifecycle escape hatch (NWB-P0-023).
 *
 * Deleting an organization suspends *every* membership in it — including the
 * owner's. `assertActivePrincipal` then refuses the owner on the next request,
 * which locks them out of the one route that undoes the deletion. The 30-day
 * grace period PRD 8.2.1 promises would have been unreachable in practice: the
 * only recovery would have been a manual database edit.
 *
 * Found by the NWB-P0-023 reactivation test, which 403'd. Rather than not
 * suspending the owner (which would leave them able to keep working inside a
 * deleted organization, so the deletion would not really have taken effect),
 * exactly one route opts out of the *active*-membership requirement while
 * keeping every other check: the account must still exist, not be soft-deleted,
 * pass `users.status`, and hold a membership row in this organization that is
 * not itself soft-deleted. The route then re-checks `organizations.owner_id`
 * before doing anything.
 *
 * Do not reach for this anywhere else. It exists so that "deleted" can mean
 * deleted without also meaning unrecoverable.
 */
const AUTH_ALLOW_INACTIVE_MEMBERSHIP = { requireActiveMembership: false } as const;

function buildAuthMiddleware(principalOpts?: {
  requireActiveMembership?: boolean;
}): MiddlewareHandler {
  return async (c, next) => {
    const config = getConfig();
    const db = c.var.db;

    // ── API key path ─────────────────────────────────────────────────────────
    // A Bearer key is a drop-in replacement for the access-token cookie on every
    // protected route. It resolves to a user + org exactly as the cookie does,
    // but the ability it installs is narrowed to the key's own limits.
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.startsWith(BEARER_PREFIX)) {
      const presented = authHeader.slice(BEARER_PREFIX.length).trim();
      if (!presented) throw new AuthError("Malformed Authorization header");

      const resolved = await resolveApiKey(db, presented);
      if (!resolved) throw new AuthError("Invalid or revoked API key");

      const principal = await assertActivePrincipal(
        db,
        resolved.userId,
        resolved.organizationId,
        principalOpts,
      );
      // A key minted before verification is still a key of an unverified account.
      assertEmailVerifiedFor(c.req.path, principal.status);

      c.set("user", { userId: resolved.userId, orgId: resolved.organizationId });
      c.set("authMethod", "api_key");
      c.set("apiKeyId", resolved.id);

      const base = await loadAbility(db, resolved.userId, resolved.organizationId);
      c.set("ability", apiKeyAbility(base, resolved.permissionLevel, resolved.scopes));

      await recordApiKeyUsage(db, resolved.id, {
        ip: getClientIp(c, config),
        userAgent: c.req.header("user-agent") ?? null,
      });

      // MUST await: Hono's compose() checks `context.finalized` as soon as this
      // handler's promise settles. Dropping the await resolves the chain before
      // the route handler writes its response, and Hono throws
      // "Context is not finalized" → a blanket 500 on every protected route.
      await runWithOrgContext({ orgId: resolved.organizationId, userId: resolved.userId }, next);
      return;
    }

    // ── Session cookie path (unchanged) ──────────────────────────────────────
    const accessToken = getCookie(c, "nawebeus_access");
    if (!accessToken) throw new AuthError("No access token provided");

    let payload: AccessPayload;
    try {
      const result = await verifyToken(accessToken, config.JWT_ACCESS_SECRET);
      if (result.type !== "access") throw new AuthError("Invalid token type");
      payload = result;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError("Invalid or expired access token");
    }

    // ── Impersonation gate (NWB-P1-011) ─────────────────────────────────────
    // An impersonation token is a normal access JWT for the target's identity plus two
    // fields naming the support session. The row — not the token's `exp` — is the source
    // of truth: it is re-validated on every request, so a session that was ended,
    // terminated, or expired dies on the *next request*, and an admin who is suspended
    // or removed from the organization takes their running impersonations down with them.
    const impersonation = isImpersonationToken(payload)
      ? await resolveLiveImpersonation(db, {
          userId: payload.userId,
          orgId: payload.orgId,
          impersonationSessionId: payload.impersonationSessionId,
          impersonatorId: payload.impersonatorId,
        })
      : undefined;
    if (isImpersonationToken(payload) && !impersonation) {
      throw new UnauthorizedError("Impersonation session is no longer active");
    }

    // Verify membership — the JWT's orgId must match a real membership row
    const principal = await assertActivePrincipal(db, payload.userId, payload.orgId, principalOpts);
    // Read from the row on every request, not from the token: verifying flips the gate open for
    // the session the user already holds, without a fresh sign-in.
    assertEmailVerifiedFor(c.req.path, principal.status);

    c.set("user", { userId: payload.userId, orgId: payload.orgId });
    c.set("authMethod", "session");
    c.set("apiKeyId", undefined);
    const impersonationScope = impersonation
      ? {
          impersonationSessionId: impersonation.sessionId,
          adminUserId: impersonation.adminUserId,
          impersonatedUserId: payload.userId,
        }
      : undefined;
    c.set("impersonation", impersonationScope);

    // While impersonating, the ability is the **target's** own — see the product as they
    // see it, and inherit their ceilings — minus the impersonation deny-list
    // (billing, org deletion, team writes, nested impersonation; see `ability.ts`).
    const baseAbility = await loadAbility(db, payload.userId, payload.orgId);
    c.set("ability", impersonation ? impersonationAbility(baseAbility) : baseAbility);

    // Same reasoning as the API-key branch above — the await is load-bearing.
    if (impersonationScope) {
      await runWithImpersonationContext(impersonationScope, () =>
        runWithOrgContext({ orgId: payload.orgId, userId: payload.userId }, next),
      );
      return;
    }
    await runWithOrgContext({ orgId: payload.orgId, userId: payload.userId }, next);
  };
}

export const authMiddleware: MiddlewareHandler = buildAuthMiddleware();

/**
 * `authMiddleware`, minus the requirement that the membership be *active*.
 * See AUTH_ALLOW_INACTIVE_MEMBERSHIP above — org reactivation only.
 */
export const authMiddlewareAllowingInactiveMembership: MiddlewareHandler = buildAuthMiddleware(
  AUTH_ALLOW_INACTIVE_MEMBERSHIP,
);
