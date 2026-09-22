import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig, loadConfig } from "./lib/config";
import { hashPassword } from "./services/auth/password";

const { Pool } = pg;

async function seed() {
  loadConfig();
  const config = getConfig();
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const db = drizzle(pool);

  // ── Permissions ─────────────────────────────────────────────────
  const permissionDefs = [
    // User management
    {
      string: "users.create",
      resource: "users",
      action: "create",
      name: "Create Users",
    },
    {
      string: "users.read",
      resource: "users",
      action: "read",
      name: "Read Users",
    },
    {
      string: "users.update",
      resource: "users",
      action: "update",
      name: "Update Users",
    },
    {
      string: "users.delete",
      resource: "users",
      action: "delete",
      name: "Delete Users",
    },
    // Organization
    {
      string: "org.read",
      resource: "organization",
      action: "read",
      name: "Read Organization",
    },
    {
      string: "org.update",
      resource: "organization",
      action: "update",
      name: "Update Organization",
    },
    {
      string: "org.delete",
      resource: "organization",
      action: "delete",
      name: "Delete Organization",
    },
    // Roles & Permissions
    {
      string: "roles.create",
      resource: "roles",
      action: "create",
      name: "Create Roles",
    },
    {
      string: "roles.read",
      resource: "roles",
      action: "read",
      name: "Read Roles",
    },
    {
      string: "roles.update",
      resource: "roles",
      action: "update",
      name: "Update Roles",
    },
    {
      string: "roles.delete",
      resource: "roles",
      action: "delete",
      name: "Delete Roles",
    },
    // Members
    {
      string: "members.create",
      resource: "members",
      action: "create",
      name: "Invite Members",
    },
    {
      string: "members.read",
      resource: "members",
      action: "read",
      name: "View Members",
    },
    {
      string: "members.update",
      resource: "members",
      action: "update",
      name: "Update Members",
    },
    {
      string: "members.delete",
      resource: "members",
      action: "delete",
      name: "Remove Members",
    },
    // Content / Posts
    {
      string: "posts.create",
      resource: "posts",
      action: "create",
      name: "Create Posts",
    },
    {
      string: "posts.read",
      resource: "posts",
      action: "read",
      name: "Read Posts",
    },
    {
      string: "posts.update",
      resource: "posts",
      action: "update",
      name: "Update Posts",
    },
    {
      string: "posts.delete",
      resource: "posts",
      action: "delete",
      name: "Delete Posts",
    },
    {
      string: "posts.publish",
      resource: "posts",
      action: "publish",
      name: "Publish Posts",
    },
    // Analytics
    {
      string: "analytics.read",
      resource: "analytics",
      action: "read",
      name: "View Analytics",
    },
    {
      string: "analytics.export",
      resource: "analytics",
      action: "export",
      name: "Export Analytics",
    },
    // Settings
    {
      string: "settings.read",
      resource: "settings",
      action: "read",
      name: "View Settings",
    },
    {
      string: "settings.update",
      resource: "settings",
      action: "update",
      name: "Update Settings",
    },
    // Billing
    {
      string: "billing.read",
      resource: "billing",
      action: "read",
      name: "View Billing",
    },
    {
      string: "billing.update",
      resource: "billing",
      action: "update",
      name: "Manage Billing",
    },
    // Audit
    {
      string: "audit.read",
      resource: "audit",
      action: "read",
      name: "View Audit Log",
    },
    // Approvals (NWB-P1-003) — the shared workflow; `decide` covers approve, reject and
    // request-changes. The row itself decides *whose* turn it is; this only reaches the endpoint.
    {
      string: "approvals.read",
      resource: "approvals",
      action: "read",
      name: "View Approval Requests",
    },
    {
      string: "approvals.create",
      resource: "approvals",
      action: "create",
      name: "Submit for Approval",
    },
    {
      string: "approvals.decide",
      resource: "approvals",
      action: "decide",
      name: "Approve, Reject or Request Changes",
    },
    // Templates (NWB-P1-006)
    {
      string: "templates.read",
      resource: "templates",
      action: "read",
      name: "View Templates",
    },
    {
      string: "templates.create",
      resource: "templates",
      action: "create",
      name: "Create Templates",
    },
    {
      string: "templates.update",
      resource: "templates",
      action: "update",
      name: "Update Templates",
    },
    {
      string: "templates.delete",
      resource: "templates",
      action: "delete",
      name: "Delete Templates",
    },
    // Contacts (NWB-P1-007)
    {
      string: "contacts.read",
      resource: "contacts",
      action: "read",
      name: "View Contacts and Interactions",
    },
    {
      string: "contacts.create",
      resource: "contacts",
      action: "create",
      name: "Create Contacts and Log Interactions",
    },
    {
      string: "contacts.update",
      resource: "contacts",
      action: "update",
      name: "Update Contacts and Interactions",
    },
    {
      string: "contacts.delete",
      resource: "contacts",
      action: "delete",
      name: "Delete Contacts",
    },
    // API Keys (FR-AUTH-010)
    {
      string: "apikeys.create",
      resource: "apikeys",
      action: "create",
      name: "Create API Keys",
    },
    {
      string: "apikeys.read",
      resource: "apikeys",
      action: "read",
      name: "View API Keys",
    },
    {
      string: "apikeys.update",
      resource: "apikeys",
      action: "update",
      name: "Rotate API Keys",
    },
    {
      string: "apikeys.delete",
      resource: "apikeys",
      action: "delete",
      name: "Revoke API Keys",
    },
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
    permMap.set((row as any).permission_string as string, (row as any).id as string);
  }

  // ── Roles (DEC-039 / D13) ────────────────────────────────────────
  // One platform role + the module spec's six per-org tiers. Levels are the
  // rank the role-hierarchy policy compares (src/services/orgs/role-policy.ts);
  // keep them in step with ROLE_LEVELS there. Permission sets are the module
  // spec matrices (Auth & User Management §6.2, Org & Account Management
  // FR-ORG-006) mapped onto the permission strings above:
  //
  //   owner    everything, incl. billing.* and org.delete (sole billing owner)
  //   admin    everything except billing.* and org.delete
  //   manager  team management (members.*, users.read/update, roles.read),
  //            content incl. approval (posts.publish, approvals.decide), analytics export
  //   creator  create/submit content (posts.* except publish, approvals.create), read-only
  //            elsewhere
  //   analyst  read-only + analytics.export; no content creation
  //   viewer   read-only dashboards/reports
  //
  // Hierarchy rules ("Manager scope: roles below Manager only", Owner never
  // demoted, last Owner/Admin stays) are enforced in code, not here.
  const everyone = [
    "org.read",
    "settings.read",
    "posts.read",
    "analytics.read",
    // Reading approvals is scoped by the service (own requests, own inbox); the org-wide view
    // needs `approvals.decide` (NWB-P1-003).
    "approvals.read",
    "templates.read",
    "contacts.read",
  ];
  const teamManagement = [
    "members.read",
    "members.create",
    "members.update",
    "members.delete",
    "users.read",
    "users.update",
    "roles.read",
  ];
  const contentCreation = [
    "posts.create",
    "posts.update",
    "posts.delete",
    "approvals.create",
    "templates.create",
    "templates.update",
    "contacts.create",
    "contacts.update",
  ];
  const contentApproval = [
    "posts.publish",
    "approvals.decide",
    "templates.delete",
    "contacts.delete",
  ];
  const analyticsExport = ["analytics.export"];
  const orgAdministration = [
    "org.update",
    "settings.update",
    "users.create",
    "users.delete",
    "roles.create",
    "roles.update",
    "roles.delete",
    "audit.read",
    "apikeys.create",
    "apikeys.read",
    "apikeys.update",
    "apikeys.delete",
  ];
  // Owner-only, and therefore absent from admin above: billing.read,
  // billing.update, org.delete. owner/super_admin take the full catalog.

  const roleDefs = [
    {
      slug: "super_admin",
      name: "Super Admin",
      code: "super_admin",
      description: "Platform operator. Not an organization tier.",
      level: 100,
      priority: 1,
      scope: "global",
      isProtected: true,
      permissions: permissionDefs.map((p) => p.string),
    },
    {
      slug: "owner",
      name: "Owner",
      code: "owner",
      description: "Full access; owns billing; assigned at signup, transferred not granted.",
      level: 90,
      priority: 5,
      scope: "organization",
      isProtected: true,
      permissions: permissionDefs.map((p) => p.string),
    },
    {
      slug: "admin",
      name: "Admin",
      code: "admin",
      description: "Full platform access except billing ownership and organization deletion.",
      level: 80,
      priority: 10,
      scope: "organization",
      isProtected: true,
      permissions: [
        ...everyone,
        ...teamManagement,
        ...contentCreation,
        ...contentApproval,
        ...analyticsExport,
        ...orgAdministration,
      ],
    },
    {
      slug: "manager",
      name: "Manager",
      code: "manager",
      description: "Operational access; content approval; team management below Manager.",
      level: 60,
      priority: 20,
      scope: "organization",
      isProtected: false,
      permissions: [
        ...everyone,
        ...teamManagement,
        ...contentCreation,
        ...contentApproval,
        ...analyticsExport,
      ],
    },
    {
      slug: "creator",
      name: "Creator",
      code: "creator",
      description: "Create and submit content; no approval authority.",
      level: 40,
      priority: 30,
      scope: "organization",
      isProtected: false,
      permissions: [...everyone, ...contentCreation],
    },
    {
      slug: "analyst",
      name: "Analyst",
      code: "analyst",
      description: "Read-only analytics, monitoring and reporting; no content creation.",
      level: 20,
      priority: 40,
      scope: "organization",
      isProtected: false,
      permissions: [...everyone, ...analyticsExport],
    },
    {
      slug: "viewer",
      name: "Viewer",
      code: "viewer",
      description: "Read-only dashboard and report access.",
      level: 10,
      priority: 50,
      scope: "organization",
      isProtected: false,
      permissions: [...everyone],
    },
  ] as const;

  for (const role of roleDefs) {
    // Conflict on "code", not "slug": the only unique indexes on roles are
    // (organization_id, slug) and (code), both partial. System roles have a NULL
    // organization_id and NULLs don't collide in a composite index, so "slug"
    // alone can never infer an arbiter (Postgres 42P10).
    await db.execute(
      sql`
        INSERT INTO roles (slug, name, display_name, description, code, level, priority, type, scope, is_system_role, is_protected)
        VALUES (${role.slug}, ${role.name}, ${role.name}, ${role.description}, ${role.code}, ${role.level}, ${role.priority}, 'system', ${role.scope}::role_scope, true, ${role.isProtected})
        ON CONFLICT (code) WHERE deleted_at IS NULL AND archived_at IS NULL DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          level = EXCLUDED.level,
          priority = EXCLUDED.priority,
          type = EXCLUDED.type,
          scope = EXCLUDED.scope,
          is_system_role = EXCLUDED.is_system_role,
          is_protected = EXCLUDED.is_protected
        RETURNING id
      `,
    );
  }
  console.log(`  ✓ ${roleDefs.length} roles seeded`);

  // Fetch role IDs
  const roleRows = await db.execute<{ id: string; slug: string }>(
    sql`SELECT id, slug FROM roles WHERE organization_id IS NULL AND deleted_at IS NULL`,
  );
  const roleMap = new Map<string, string>();
  for (const row of roleRows.rows ?? []) {
    roleMap.set((row as any).slug as string, (row as any).id as string);
  }

  // ── Retire pre-DEC-039 roles ─────────────────────────────────────
  // `org_admin` and `member` are dropped, not aliased (pre-production, no
  // compatibility burden). Any membership still pointing at them is moved to
  // the nearest successor first — organization_members.role_id is ON DELETE
  // SET NULL, and a NULL role means zero permissions (F-01). role_permissions
  // and user_roles cascade.
  const retired: Array<{ code: string; successor: string }> = [
    { code: "org_admin", successor: "admin" },
    { code: "member", successor: "creator" },
  ];
  for (const { code, successor } of retired) {
    const successorId = roleMap.get(successor);
    if (!successorId) continue;
    for (const table of ["organization_members", "users", "user_roles"] as const) {
      await db.execute(
        sql`
          UPDATE ${sql.raw(table)} t SET role_id = ${successorId}
          FROM roles r
          WHERE t.role_id = r.id AND r.code = ${code} AND r.organization_id IS NULL
        `,
      );
    }
    const deleted = await db.execute(
      sql`DELETE FROM roles WHERE code = ${code} AND organization_id IS NULL RETURNING id`,
    );
    if ((deleted.rows ?? []).length > 0) {
      console.log(`  ✓ retired role "${code}" (memberships moved to "${successor}")`);
    }
  }

  // ── Role-Permission Mappings ─────────────────────────────────────
  // Converges on the matrix above: grants that are missing are added and
  // grants that are no longer in the matrix are removed, so re-running the
  // seed after a matrix change leaves no stale permissions behind.
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
    await db.execute(
      sql`
        DELETE FROM role_permissions rp
        USING permissions p
        WHERE rp.role_id = ${roleId}
          AND rp.permission_id = p.id
          AND p.permission_string NOT IN (${sql.join(
            role.permissions.map((perm) => sql`${perm}`),
            sql`, `,
          )})
      `,
    );
  }
  console.log(`  ✓ ${mappingCount} role-permission mappings seeded`);

  // ── Super Admin User ─────────────────────────────────────────────
  // Created before the organization: organizations.owner_id is NOT NULL, so the
  // org cannot be inserted until its owner exists. (The previous order inserted
  // the org first and back-filled owner_id afterwards, which never worked.)
  const adminEmail = config.SEED_ADMIN_EMAIL;
  const adminPassword = config.SEED_ADMIN_PASSWORD;
  // Hash before storing. This used to insert the plaintext, which made sign-in
  // throw rather than fail cleanly: Bun.password.verify() rejects a non-bcrypt
  // digest with "UnsupportedAlgorithm" instead of returning false.
  const adminPasswordHash = await hashPassword(adminPassword);

  await db.execute(
    sql`
      INSERT INTO users (email, password, username, first_name, last_name, status, email_verified)
      VALUES (${adminEmail}, ${adminPasswordHash}, 'superadmin', 'Super', 'Admin', 'active', true)
      ON CONFLICT (email) DO UPDATE SET
        status = 'active',
        email_verified = true,
        -- Converge on the configured password, so re-running the seed repairs a
        -- bootstrap admin whose stored digest is missing or stale.
        password = EXCLUDED.password
    `,
  );
  console.log(`  ✓ Admin user "${adminEmail}" seeded`);

  const userRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1`,
  );
  const userId = (userRows.rows?.[0] as any)?.id as string | undefined;

  // ── Bootstrap Organization ────────────────────────────────────────
  const orgSlug = "nawebeus";
  const orgName = "Nawebeus";

  await db.execute(
    sql`
      INSERT INTO organizations (name, slug, display_name, type, status, is_active, is_verified, owner_id, created_by)
      VALUES (${orgName}, ${orgSlug}, ${orgName}, 'agency', 'active', true, true, ${userId}, ${userId})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name,
        owner_id = EXCLUDED.owner_id
    `,
  );
  console.log(`  ✓ Organization "${orgName}" seeded`);

  const orgRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`,
  );
  const orgId = (orgRows.rows?.[0] as any)?.id as string | undefined;

  // ── Link admin to organization ───────────────────────────────────
  if (orgId && userId) {
    // Link user to org
    await db.execute(sql`UPDATE users SET organization_id = ${orgId} WHERE id = ${userId}`);

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
      // Conflict on the "one primary role per user" index, not on
      // (user_id, role_id, context_id, context_type): context_id/context_type are
      // NULL here and NULLs never collide in a composite unique index, so that
      // arbiter could never match and every re-run tried a duplicate insert.
      await db.execute(
        sql`
          INSERT INTO user_roles (user_id, role_id, is_primary, source)
          VALUES (${userId}, ${superAdminRoleId}, true, 'system')
          ON CONFLICT (user_id)
          WHERE is_primary = true AND status = 'active' AND revoked_at IS NULL AND deleted_at IS NULL
          DO UPDATE SET role_id = EXCLUDED.role_id, source = EXCLUDED.source
        `,
      );

      // Update user's cached role fields. `users.role` is the role_value_type
      // enum (admin | member | viewer | user) — there is no 'owner' value;
      // ownership lives on organizations.owner_id.
      await db.execute(
        sql`
          UPDATE users
          SET role_id = ${superAdminRoleId}, role = 'admin'
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
