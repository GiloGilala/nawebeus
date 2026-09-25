import { type Ability, AbilityBuilder, createMongoAbility } from "@casl/ability";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * The verbs a permission string can end in. The CRUD four plus `manage` (CASL's wildcard), and
 * the non-CRUD verbs the seed catalog actually grants: `publish`/`export` (there since the role
 * matrix), `decide` (approvals, NWB-P1-003) and `impersonate` (support sessions, NWB-P1-011). `loadAbility` splits `<subject>.<verb>` and
 * passes the verb straight through, so this union is what `requireAbility` may ask for — a verb
 * missing here is a compile error at the route, not a silent 403.
 */
export type Actions =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage"
  | "publish"
  | "export"
  | "decide"
  | "impersonate"
  | "connect";
export type Subjects = string;

type AppAbility = Ability<[Actions, Subjects]>;

export async function loadAbility(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  orgId: string,
): Promise<AppAbility> {
  const rows = await db.execute<{ permission_string: string }>(
    sql`
      SELECT DISTINCT p.permission_string
      FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE om.user_id = ${userId}
        AND om.organization_id = ${orgId}
        AND om.status = 'active'
        AND rp.status = 'active'
        AND rp.revoked_at IS NULL
        AND rp.deleted_at IS NULL
    `,
  );

  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const rawRows = (rows as any).rows ?? [];

  for (const row of rawRows) {
    const perm = (row as any).permission_string as string;
    const dot = perm.lastIndexOf(".");
    if (dot === -1) continue;
    const subject = perm.slice(0, dot);
    const action = perm.slice(dot + 1);

    // NO `{ organizationId }` condition here — deliberately (NWB-P0-018, F-06).
    //
    // CASL evaluates conditions only against a *subject instance*. Every check
    // in this codebase is `ability.can(action, "string-subject")`, and for a
    // string subject CASL v7 skips condition matching entirely, so a condition
    // attached here is decorative: it can never deny anything. Carrying it
    // anyway made the authorization story read stronger than it was.
    //
    // The real org scoping is the query above: abilities are loaded per
    // (user, org) from *that org's* active memberships, so a user in org A
    // never receives org B's rules in the first place. On top of that sit
    // `requireOrgMatch()` (URL `:orgId` must equal the JWT org) and the
    // service-layer `organization_id` predicates. See
    // `docs/technical/Security Architecture.md` §4.3.
    can(action as Actions, subject);
  }

  return build();
}
