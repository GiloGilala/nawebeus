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
// NOTE: Aspirational modules (campaigns, commerce, engagement, influencer,
// pr, publishing) are excluded here and in tsconfig.json until they are wired up.
// Compliance is partial (NWB-P1-010); monitoring and social-accounts have been adopted.

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

// =============================================================================
// COMPLIANCE MODULE (partial — NWB-P1-010, NWB-P1-009)
// =============================================================================

// Re-exported adopted tables: `legal_holds` + `backup_records` (NWB-P1-010), `app_config` (NWB-P1-009),
// `impersonation_sessions` (NWB-P1-011). `dsar_requests` and `data_retention_policies` stay
// dormant — their tickets re-export them here when they adopt them. Importing from
// `./compliance/index` pulls the whole module's definitions, but drizzle-kit migrates only
// what this file re-exports, so granularity lives here, not in tsconfig.
export {
  appConfig,
  appConfigRelations,
  backupRecords,
  backupRecordsRelations,
  impersonationSessions,
  impersonationSessionsRelations,
  legalHolds,
  legalHoldsRelations,
} from "./compliance/index";

// =============================================================================
// BILLING MODULE (adopted — NWB-P13-001)
// =============================================================================

// All six tables adopt together (they cross-reference each other's ids).
// `db/billing/index.ts` carries the module's adoption header: the import and
// enum reconciliation notes, and which tables the v1 service layer covers.
export {
  invoices,
  invoicesRelations,
} from "./billing/invoices";
export {
  paymentMethods,
  paymentMethodsRelations,
} from "./billing/payment-methods";
export {
  payments,
  paymentsRelations,
} from "./billing/payments";
export {
  plans,
  plansRelations,
} from "./billing/plans";
export {
  subscriptions,
  subscriptionsRelations,
} from "./billing/subscriptions";
export {
  transactions,
  transactionsRelations,
} from "./billing/transactions";

// =============================================================================
// SOCIAL ACCOUNTS MODULE (adopted — NWB-P2-001)
// =============================================================================

// All four tables adopt together (they reference each other's shapes and the migration-doc
// M2 row covers the module as a unit). `db/social-accounts/index.ts` carries the module's
// design header: token columns are ciphertext, `oauth_states.id` is the state parameter.
export {
  oauthStates,
  oauthStatesRelations,
  socialAccountHealthLog,
  socialAccountHealthLogRelations,
  socialAccounts,
  socialAccountsRelations,
  tokenRefreshLog,
  tokenRefreshLogRelations,
} from "./social-accounts/index";

// =============================================================================
// MEDIA MONITORING MODULE (adopted — NWB-P4-001)
// =============================================================================

// The six monitoring tables form one schema unit and are shared with P5 Listen.
export {
  crisisIncidents,
  crisisIncidentsRelations,
  mediaArticles,
  mediaArticlesRelations,
  monitoringCampaigns,
  monitoringCampaignsRelations,
  monitoringCompetitors,
  monitoringCompetitorsRelations,
  newsSources,
  newsSourcesRelations,
  socialMentions,
  socialMentionsRelations,
} from "./monitoring/index";
