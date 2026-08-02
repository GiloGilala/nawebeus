import { AbilityBuilder, createMongoAbility, type Ability } from "@casl/ability";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

export type Actions = "create" | "read" | "update" | "delete" | "manage";
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

    // Scope abilities to the user's organization
    if (action === "manage") {
      can("manage", subject, { organizationId: orgId });
    } else {
      can(action as Actions, subject, { organizationId: orgId });
    }
  }

  return build();
}
