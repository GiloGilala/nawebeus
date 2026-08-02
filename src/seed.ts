import { loadConfig, getConfig } from "./lib/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

async function seed() {
  loadConfig();
  const config = getConfig();
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const db = drizzle(pool);

  // ── Permissions ─────────────────────────────────────────────────
  const permissionDefs = [
    // User management
    { string: "users.create", resource: "users", action: "create", name: "Create Users" },
    { string: "users.read", resource: "users", action: "read", name: "Read Users" },
    { string: "users.update", resource: "users", action: "update", name: "Update Users" },
    { string: "users.delete", resource: "users", action: "delete", name: "Delete Users" },
    // Organization
    { string: "org.read", resource: "organization", action: "read", name: "Read Organization" },
    { string: "org.update", resource: "organization", action: "update", name: "Update Organization" },
    { string: "org.delete", resource: "organization", action: "delete", name: "Delete Organization" },
    // Roles & Permissions
    { string: "roles.create", resource: "roles", action: "create", name: "Create Roles" },
    { string: "roles.read", resource: "roles", action: "read", name: "Read Roles" },
    { string: "roles.update", resource: "roles", action: "update", name: "Update Roles" },
    { string: "roles.delete", resource: "roles", action: "delete", name: "Delete Roles" },
    // Members
    { string: "members.create", resource: "members", action: "create", name: "Invite Members" },
    { string: "members.read", resource: "members", action: "read", name: "View Members" },
    { string: "members.update", resource: "members", action: "update", name: "Update Members" },
    { string: "members.delete", resource: "members", action: "delete", name: "Remove Members" },
    // Content / Posts
    { string: "posts.create", resource: "posts", action: "create", name: "Create Posts" },
    { string: "posts.read", resource: "posts", action: "read", name: "Read Posts" },
    { string: "posts.update", resource: "posts", action: "update", name: "Update Posts" },
    { string: "posts.delete", resource: "posts", action: "delete", name: "Delete Posts" },
    { string: "posts.publish", resource: "posts", action: "publish", name: "Publish Posts" },
    // Analytics
    { string: "analytics.read", resource: "analytics", action: "read", name: "View Analytics" },
    { string: "analytics.export", resource: "analytics", action: "export", name: "Export Analytics" },
    // Settings
    { string: "settings.read", resource: "settings", action: "read", name: "View Settings" },
    { string: "settings.update", resource: "settings", action: "update", name: "Update Settings" },
    // Billing
    { string: "billing.read", resource: "billing", action: "read", name: "View Billing" },
    { string: "billing.update", resource: "billing", action: "update", name: "Manage Billing" },
    // Audit
    { string: "audit.read", resource: "audit", action: "read", name: "View Audit Log" },
  ] as const;

  for (const perm of permissionDefs) {
    await db.execute(
      sql`
        INSERT INTO permissions (permission_string, resource, action, name)
        VALUES (${perm.string}, ${perm.resource}, ${perm.action}, ${perm.name})
        ON CONFLICT (permission_string) DO NOTHING
      `,
    );
  }
  console.log(`  ✓ ${permissionDefs.length} permissions seeded`);

  // Fetch permission IDs for mapping
  const permRows = await db.execute<{ id: string; permission_string: string }>(
    sql`SELECT id, permission_string FROM permissions`,
  );
  const permMap = new Map<string, string>();
  for (const row of permRows.rows ?? []) {
    permMap.set(
      (row as any).permission_string as string,
      (row as any).id as string,
    );
  }

  // ── Roles ────────────────────────────────────────────────────────
  const roleDefs = [
    {
      slug: "super_admin",
      name: "Super Admin",
      code: "super_admin",
      level: 100,
      priority: 1,
      isSystemRole: true,
      isProtected: true,
      permissions: permissionDefs.map((p) => p.string),
    },
    {
      slug: "org_admin",
      name: "Organization Admin",
      code: "org_admin",
      level: 80,
      priority: 10,
      isSystemRole: true,
      isProtected: true,
      permissions: permissionDefs
        .filter((p) => !p.string.startsWith("billing."))
        .map((p) => p.string),
    },
    {
      slug: "member",
      name: "Member",
      code: "member",
      level: 30,
      priority: 50,
      isSystemRole: true,
      isProtected: false,
      permissions: [
        "posts.create",
        "posts.read",
        "posts.update",
        "posts.delete",
        "posts.publish",
        "analytics.read",
        "members.read",
        "users.read",
        "org.read",
        "settings.read",
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      code: "viewer",
      level: 10,
      priority: 100,
      isSystemRole: true,
      isProtected: false,
      permissions: ["posts.read", "analytics.read", "members.read", "org.read"],
    },
  ] as const;

  for (const role of roleDefs) {
    await db.execute(
      sql`
        INSERT INTO roles (slug, name, display_name, code, level, priority, is_system_role, is_protected)
        VALUES (${role.slug}, ${role.name}, ${role.name}, ${role.code}, ${role.level}, ${role.priority}, ${role.isSystemRole}, ${role.isProtected})
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          code = EXCLUDED.code,
          level = EXCLUDED.level,
          priority = EXCLUDED.priority
        RETURNING id
      `,
    );
  }
  console.log(`  ✓ ${roleDefs.length} roles seeded`);

  // Fetch role IDs
  const roleRows = await db.execute<{ id: string; slug: string }>(
    sql`SELECT id, slug FROM roles`,
  );
  const roleMap = new Map<string, string>();
  for (const row of roleRows.rows ?? []) {
    roleMap.set((row as any).slug as string, (row as any).id as string);
  }

  // ── Role-Permission Mappings ─────────────────────────────────────
  let mappingCount = 0;
  for (const role of roleDefs) {
    const roleId = roleMap.get(role.slug);
    if (!roleId) continue;
    for (const permString of role.permissions) {
      const permId = permMap.get(permString);
      if (!permId) continue;
      await db.execute(
        sql`
          INSERT INTO role_permissions (role_id, permission_id, source)
          VALUES (${roleId}, ${permId}, 'system')
          ON CONFLICT (role_id, permission_id) WHERE status = 'active' AND revoked_at IS NULL AND deleted_at IS NULL
          DO NOTHING
        `,
      );
      mappingCount++;
    }
  }
  console.log(`  ✓ ${mappingCount} role-permission mappings seeded`);

  // ── Bootstrap Organization ────────────────────────────────────────
  const orgSlug = "nawebeus";
  const orgName = "Nawebeus";

  await db.execute(
    sql`
      INSERT INTO organizations (name, slug, display_name, type, status, is_active, is_verified)
      VALUES (${orgName}, ${orgSlug}, ${orgName}, 'agency', 'active', true, true)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name
    `,
  );
  console.log(`  ✓ Organization "${orgName}" seeded`);

  const orgRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`,
  );
  const orgId = (orgRows.rows?.[0] as any)?.id as string | undefined;

  // ── Super Admin User ─────────────────────────────────────────────
  const adminEmail = config.SEED_ADMIN_EMAIL;
  const adminPassword = config.SEED_ADMIN_PASSWORD;

  await db.execute(
    sql`
      INSERT INTO users (email, password, username, first_name, last_name, status, email_verified)
      VALUES (${adminEmail}, ${adminPassword}, 'superadmin', 'Super', 'Admin', 'active', true)
      ON CONFLICT (email) DO UPDATE SET
        status = 'active',
        email_verified = true
    `,
  );
  console.log(`  ✓ Admin user "${adminEmail}" seeded`);

  const userRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1`,
  );
  const userId = (userRows.rows?.[0] as any)?.id as string | undefined;

  // ── Update Organization ownership ────────────────────────────────
  if (orgId && userId) {
    await db.execute(
      sql`
        UPDATE organizations
        SET owner_id = ${userId}, created_by = ${userId}
        WHERE id = ${orgId}
      `,
    );

    // Link user to org
    await db.execute(
      sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${userId}`,
    );

    // ── Organization Membership ──────────────────────────────────────
    const superAdminRoleId = roleMap.get("super_admin");
    if (superAdminRoleId) {
      await db.execute(
        sql`
          INSERT INTO organization_members (organization_id, user_id, role_id, status)
          VALUES (${orgId}, ${userId}, ${superAdminRoleId}, 'active')
          ON CONFLICT (organization_id, user_id) WHERE status = 'active' AND deleted_at IS NULL
          DO NOTHING
        `,
      );

      // ── User-Role Assignment ────────────────────────────────────────
      await db.execute(
        sql`
          INSERT INTO user_roles (user_id, role_id, is_primary, source)
          VALUES (${userId}, ${superAdminRoleId}, true, 'system')
          ON CONFLICT (user_id, role_id, context_id, context_type)
          WHERE status = 'active' AND revoked_at IS NULL AND deleted_at IS NULL
          DO NOTHING
        `,
      );

      // Update user's cached role fields
      await db.execute(
        sql`
          UPDATE users
          SET role_id = ${superAdminRoleId}, role = 'owner'
          WHERE id = ${userId}
        `,
      );
    }

    console.log("  ✓ User-Org-Role relationships linked");
  }

  console.log("\n✅ Seed complete");
  await pool.end();
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
