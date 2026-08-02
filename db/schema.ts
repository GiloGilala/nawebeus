// db/schema/schema.ts
//
// Re-exports all schema objects (tables, enums, relations) from the active
// schema modules. This is the single import point for drizzle-kit and the
// database client.
//
// Usage:
//   import * as schema from "@/db/schema/schema";
//   const db = drizzle(pool, { schema });
//
// This file ONLY re-exports. No table/relation definitions live here.
// Each module owns its own definitions in its own index.ts file.
//
// NOTE: Aspirational modules (billing, campaigns, commerce, compliance,
// engagement, influencer, monitoring, pr, publishing, social-accounts) are
// excluded here and in tsconfig.json until they are wired up.

// =============================================================================
// SHARED MODULES
// =============================================================================

// ─── Enums ────────────────────────────────────────────────────────────────────
export * from "./shared/enums";

// ─── Audit ────────────────────────────────────────────────────────────────────
export { auditLog } from "./shared/audit";

// ─── Analytics ────────────────────────────────────────────────────────────────
export {
  analyticsEvents,
  analyticsMetrics,
  analyticsAggregates,
  analyticsDashboards,
  analyticsReports,
  analyticsEventsRelations,
  analyticsMetricsRelations,
  analyticsAggregatesRelations,
  analyticsDashboardsRelations,
  analyticsReportsRelations,
} from "./shared/analytics";

// ─── Alerts ───────────────────────────────────────────────────────────────────
export {
  alertRules,
  alertEvents,
  alertRulesRelations,
  alertEventsRelations,
} from "./shared/alerts";

// ─── Templates ────────────────────────────────────────────────────────────────
export { templates, templatesRelations } from "./shared/templates";

// ─── Media Assets ─────────────────────────────────────────────────────────────
export { mediaAssets, mediaAssetsRelations } from "./shared/media";

// ─── Approval ─────────────────────────────────────────────────────────────────
export {
  approvalRequests,
  approvalHistory,
  approvalRequestsRelations,
  approvalHistoryRelations,
} from "./shared/approval";

// ─── Contacts ─────────────────────────────────────────────────────────────────
export {
  contacts,
  contactInteractions,
  contactsRelations,
  contactInteractionsRelations,
} from "./shared/contacts";

// =============================================================================
// CORE MODULE
// =============================================================================

export {
  users,
  sessions,
  apiKeys,
  tokens,
  oauthAccounts,
  roles,
  permissions,
  permissionGroups,
  userRoles,
  rolePermissions,
  usersRelations,
  sessionsRelations,
  tokensRelations,
  oauthAccountsRelations,
  rolesRelations,
  permissionsRelations,
  permissionGroupsRelations,
  userRolesRelations,
  rolePermissionsRelations,
} from "./core/index";

// =============================================================================
// ORGANIZATION MODULE
// =============================================================================

export {
  organizations,
  organizationsRelations,
} from "./organization/organizations";

export {
  organizationMembers,
  roleHistory,
  permissionHistory,
  organizationMembersRelations,
  roleHistoryRelations,
  permissionHistoryRelations,
} from "./organization/organization-members";
