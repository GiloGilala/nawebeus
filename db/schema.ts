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

// ─── Alerts ───────────────────────────────────────────────────────────────────
export {
  alertEvents,
  alertEventsRelations,
  alertRules,
  alertRulesRelations,
} from "./shared/alerts";
// ─── Analytics ────────────────────────────────────────────────────────────────
export {
  analyticsAggregates,
  analyticsAggregatesRelations,
  analyticsDashboards,
  analyticsDashboardsRelations,
  analyticsEvents,
  analyticsEventsRelations,
  analyticsMetrics,
  analyticsMetricsRelations,
  analyticsReports,
  analyticsReportsRelations,
} from "./shared/analytics";
// ─── Approval ─────────────────────────────────────────────────────────────────
export {
  approvalHistory,
  approvalHistoryRelations,
  approvalRequests,
  approvalRequestsRelations,
} from "./shared/approval";
// ─── Audit ────────────────────────────────────────────────────────────────────
export { auditLog } from "./shared/audit";
// ─── Contacts ─────────────────────────────────────────────────────────────────
export {
  contactInteractions,
  contactInteractionsRelations,
  contacts,
  contactsRelations,
} from "./shared/contacts";
// ─── Enums ────────────────────────────────────────────────────────────────────
export * from "./shared/enums";
// ─── Media Assets ─────────────────────────────────────────────────────────────
export { mediaAssets, mediaAssetsRelations } from "./shared/media";
// ─── Templates ────────────────────────────────────────────────────────────────
export { templates, templatesRelations } from "./shared/templates";

// =============================================================================
// CORE MODULE
// =============================================================================

export {
  apiKeys,
  dataExportRequests,
  oauthAccounts,
  oauthAccountsRelations,
  permissionGroups,
  permissionGroupsRelations,
  permissions,
  permissionsRelations,
  rateLimits,
  rolePermissions,
  rolePermissionsRelations,
  roles,
  rolesRelations,
  sessions,
  sessionsRelations,
  tokens,
  tokensRelations,
  userRoles,
  userRolesRelations,
  users,
  usersRelations,
} from "./core/index";

// =============================================================================
// ORGANIZATION MODULE
// =============================================================================

export {
  organizationMembers,
  organizationMembersRelations,
  permissionHistory,
  permissionHistoryRelations,
  roleHistory,
  roleHistoryRelations,
} from "./organization/organization-members";
export {
  organizations,
  organizationsRelations,
} from "./organization/organizations";
