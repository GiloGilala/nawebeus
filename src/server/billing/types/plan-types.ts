/**
 * Billing plan domain types (NWB-P13-001).
 *
 * These are the shapes the Drizzle schema in `db/billing/plans.ts` consumes as
 * jsonb column types. They live in `src/server/billing/types/` — not in
 * `src/services/billing/` — following the established split: the db layer may
 * consume types from `src/server/<domain>/types/` (cf.
 * `db/organization/organizations.ts` → `@/server/organization/types/organization-type`)
 * but never from `src/services/` (that would invert the dependency direction).
 *
 * Shapes only: no logic, no I/O.
 */

/** Product lines the plan catalog serves (see `product_type` in `db/shared/enums.ts`). */
export const PRODUCT_TYPES = ["social", "fashion"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/**
 * Feature/limit map for the social product line.
 *
 * The numeric fields double as subscription limits: `deriveLimitsFromFeatures`
 * in `src/services/billing/subscription.service.ts` projects this map onto
 * `SubscriptionLimits` when a subscription is created. Boolean fields are
 * entitlement switches, not metered limits.
 */
export interface SocialPlanFeatures {
  // Core features
  socialAccounts: number;
  postsPerMonth: number;
  scheduledPosts: number;
  teamMembers: number;

  // AI & Content
  aiGenerations: number;
  aiContentAssistant: boolean;
  contentLibrary: boolean;
  contentTemplates: number;

  // Publishing
  bulkScheduling: boolean;
  contentCalendar: boolean;
  postApprovalWorkflow: boolean;
  autoPublishing: boolean;
  rssAutoPosting: boolean;

  // Analytics & Reporting
  analyticsRetentionDays: number;
  customReports: number;
  exportReports: boolean;
  competitorAnalysis: boolean;
  advancedAnalytics: boolean;
  realTimeAnalytics: boolean;

  // Monitoring
  socialListening: boolean;
  keywordTracking: number;
  mentionAlerts: boolean;
  sentimentAnalysis: boolean;
  crisisDetection: boolean;
  brandMonitoring: boolean;

  // Engagement
  unifiedInbox: boolean;
  autoResponder: boolean;
  savedReplies: number;
  conversationHistory: boolean;

  // Collaboration
  teamCollaboration: boolean;
  roleBasedAccess: boolean;
  approvalWorkflows: boolean;
  activityLog: boolean;

  // Integration & API
  apiAccess: boolean;
  apiCallsPerMonth: number;
  webhooks: boolean;
  customIntegrations: boolean;
  zapierIntegration: boolean;

  // Storage
  storageGB: number;
  mediaLibrary: boolean;

  // Support
  prioritySupport: boolean;
  dedicatedAccountManager: boolean;
  onboarding: boolean;
  training: boolean;
  sla: boolean;

  // White Label
  whiteLabel: boolean;
  customBranding: boolean;
  customDomain: boolean;

  // Platform-specific extras
  platformSpecific: Record<string, unknown>;
}

/** Feature/limit map for the fashion product line (metered limits only). */
export interface FashionPlanFeatures {
  maxClients: number;
  maxMeasurements: number;
  maxPatternsPerMonth: number;
  maxProjects: number;
  maxTeamMembers: number;
}

/** The plan's feature set, keyed by product line. */
export interface PlanFeatures {
  productType: ProductType;
  social?: SocialPlanFeatures;
  fashion?: FashionPlanFeatures;
}
