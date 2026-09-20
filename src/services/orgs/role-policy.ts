import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";

/**
 * Role hierarchy policy — DEC-039 / D13 (NWB-P0-014).
 *
 * One platform role plus six per-organization tiers. `level` is the rank used
 * for every "who may act on whom" comparison; `code` is only consulted for the
 * two roles with special semantics (`owner`, `admin`). Custom, org-scoped roles
 * (a future feature — `roles.organization_id = <org>`) slot into the same
 * ladder through their own `level`, so nothing below hard-codes the six names.
 *
 * Rules enforced here (module spec §6.3 + BR-AUTH-030/031, module spec
 * "Role Selection Options" table):
 *
 *  1. `owner` is never *granted* through role assignment — ownership is
 *     transferred (a separate, future flow), and there is exactly one Owner
 *     per organization (`organizations.owner_id`).
 *  2. The Owner's role is never changed and the Owner is never removed.
 *  3. Nobody changes their own role or removes themselves (self-protection;
 *     leaving an organization is a different feature).
 *  4. An actor may only act on members strictly below their own level, and
 *     may only grant roles strictly below their own level. This single rule
 *     yields the spec table: Owner grants Admin…Viewer, Admin grants
 *     Manager…Viewer, Manager grants Creator…Viewer ("Manager scope: roles
 *     below Manager only").
 *  5. An organization must keep at least one *active* Owner-or-Admin
 *     (BR-AUTH-030) — demoting or removing the last one is refused.
 *
 * Every function throws an `AppError` (403 / 404 / 409) so routes need no
 * extra mapping.
 */

export const PLATFORM_ROLE_CODES = ["super_admin"] as const;
export const ORG_ROLE_CODES = [
  "owner",
  "admin",
  "manager",
  "creator",
  "analyst",
  "viewer",
] as const;
export type OrgRoleCode = (typeof ORG_ROLE_CODES)[number];
export type RoleCode = OrgRoleCode | (typeof PLATFORM_ROLE_CODES)[number];

/** Canonical levels for the seeded roles (higher = more authority). */
export const ROLE_LEVELS: Record<RoleCode, number> = {
  super_admin: 100,
  owner: 90,
  admin: 80,
  manager: 60,
  creator: 40,
  analyst: 20,
  viewer: 10,
};

/** Roles that satisfy BR-AUTH-030 ("at least one Owner or Admin at all times"). */
export const ADMINISTRATOR_CODES: ReadonlySet<string> = new Set(["owner", "admin", "super_admin"]);

/** The role a member currently holds, as needed by the policy checks. */
export interface RoleRank {
  code: string | null;
  level: number;
}

/** A member with no role yet (legacy row / pending invite) ranks below everyone. */
export const NO_ROLE: RoleRank = { code: null, level: -1 };

export interface RoleChangeCheck {
  actor: RoleRank & { userId: string };
  target: RoleRank & { userId: string };
  newRole: RoleRank;
}

/**
 * Rules 1–4 for a role change. Pure — no database access — so the whole
 * matrix is unit-testable without fixtures.
 */
export function assertRoleChangeAllowed({ actor, target, newRole }: RoleChangeCheck): void {
  if (newRole.code === "owner") {
    throw new ForbiddenError(
      "The Owner role cannot be assigned — ownership is transferred, not granted (BR-AUTH-031)",
    );
  }
  if (target.code === "owner") {
    throw new ForbiddenError("The Owner's role cannot be changed (BR-AUTH-031)");
  }
  if (actor.userId === target.userId) {
    throw new ForbiddenError("You cannot change your own role");
  }
  if (actor.level <= target.level) {
    throw new ForbiddenError("You can only change the role of members below your own role");
  }
  if (actor.level <= newRole.level) {
    throw new ForbiddenError("You can only assign roles below your own role");
  }
}

export interface MemberActionCheck {
  actor: RoleRank & { userId: string };
  target: RoleRank & { userId: string };
}

/**
 * Rules 2–4 for acting *on* a member without granting a role: removal from
 * the organization, suspension, and the like.
 */
export function assertMemberActionAllowed({ actor, target }: MemberActionCheck): void {
  if (target.code === "owner") {
    throw new ForbiddenError("The Owner cannot be removed or suspended (BR-AUTH-031)");
  }
  if (actor.userId === target.userId) {
    throw new ForbiddenError("You cannot remove or suspend yourself");
  }
  if (actor.level <= target.level) {
    throw new ForbiddenError("You can only act on members below your own role");
  }
}

// ── Database-backed lookups ───────────────────────────────────────────────

type Db = NodePgDatabase<Record<string, any>>;

export interface MemberRole extends RoleRank {
  memberId: string;
  userId: string;
  roleId: string | null;
  roleName: string | null;
  status: string;
  isActive: boolean;
}

/**
 * The membership row + current role for `userId` in `orgId`. Soft-deleted
 * memberships are ignored; the caller decides whether a missing row is a
 * 404 (target) or 403 (actor).
 */
export async function findMemberRole(
  db: Db,
  orgId: string,
  where: { userId: string } | { memberId: string },
): Promise<MemberRole | null> {
  const predicate =
    "userId" in where ? sql`om.user_id = ${where.userId}` : sql`om.id = ${where.memberId}`;
  const rows = await db.execute(
    sql`
      SELECT om.id AS member_id, om.user_id, om.role_id, om.status, om.is_active,
             r.code AS role_code, r.name AS role_name, r.level AS role_level
      FROM organization_members om
      LEFT JOIN roles r ON r.id = om.role_id AND r.deleted_at IS NULL
      WHERE om.organization_id = ${orgId}
        AND ${predicate}
        AND om.deleted_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return {
    memberId: row.member_id as string,
    userId: row.user_id as string,
    roleId: (row.role_id as string) ?? null,
    roleName: (row.role_name as string) ?? null,
    code: (row.role_code as string) ?? null,
    level:
      row.role_level === null || row.role_level === undefined
        ? NO_ROLE.level
        : Number(row.role_level),
    status: row.status as string,
    isActive: !!row.is_active,
  };
}

/**
 * The acting user's role in `orgId`. A caller who is not an active member
 * cannot act on the organization at all (403), whatever their CASL ability
 * says — this is the service-layer org predicate.
 */
export async function requireActorRole(
  db: Db,
  orgId: string,
  actingUserId: string,
): Promise<MemberRole> {
  const actor = await findMemberRole(db, orgId, { userId: actingUserId });
  if (!actor || actor.status !== "active" || !actor.roleId) {
    throw new ForbiddenError("You do not have a role in this organization");
  }
  return actor;
}

export interface AssignableRole extends RoleRank {
  id: string;
  name: string;
}

/**
 * Resolve a role that may be assigned within `orgId`: a system role (shared
 * catalog, `organization_id IS NULL`) or a custom role owned by this
 * organization. A role belonging to another organization is indistinguishable
 * from a non-existent one (404) — no cross-tenant role leakage.
 *
 * Fixes the pre-DEC-039 lookup, which required `organization_id = orgId`
 * and therefore could never resolve a seeded role: every assignment 404'd.
 */
export async function resolveAssignableRole(
  db: Db,
  orgId: string,
  roleId: string,
): Promise<AssignableRole> {
  const rows = await db.execute(
    sql`
      SELECT id, code, name, level FROM roles
      WHERE id = ${roleId}
        AND (organization_id IS NULL OR organization_id = ${orgId})
        AND status = 'active'
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
  );
  const row = (rows as any).rows?.[0] as any;
  if (!row) throw new NotFoundError("Role not found");
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    level: Number(row.level),
  };
}

/**
 * BR-AUTH-030: refuse to demote/remove `target` if no *other* active
 * Owner-or-Admin would remain in the organization.
 *
 * Only relevant when the target is currently an administrator — losing a
 * Manager never violates the rule, so callers can skip the query otherwise.
 */
export async function assertNotLastAdministrator(
  db: Db,
  orgId: string,
  target: MemberRole,
): Promise<void> {
  if (!target.code || !ADMINISTRATOR_CODES.has(target.code)) return;
  const rows = await db.execute<{ count: number }>(
    sql`
      SELECT COUNT(*)::int AS count
      FROM organization_members om
      JOIN roles r ON r.id = om.role_id AND r.deleted_at IS NULL
      WHERE om.organization_id = ${orgId}
        AND om.id <> ${target.memberId}
        AND r.code IN ('owner', 'admin', 'super_admin')
        AND om.status = 'active'
        AND om.is_active = true
        AND om.deleted_at IS NULL
    `,
  );
  const remaining = Number((rows as any).rows?.[0]?.count ?? 0);
  if (remaining === 0) {
    throw new ConflictError(
      "An organization must keep at least one active Owner or Admin — assign another Admin first (BR-AUTH-030)",
    );
  }
}
