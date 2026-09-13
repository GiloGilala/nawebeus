// @/db/schemas/billing/plans.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { PlanFeatures } from "@/server/billing/types/plan-types";
import { users } from "../core/users";
import { tablePrefix } from "../schema-utils";
import {
  currencyPgEnum,
  planStatusPgEnum,
  pricingModelPgEnum,
  subscriptionPlanPgEnum,
} from "../shared/enums";
import { subscriptions } from "./subscriptions";

// ============================================
// DEFAULT FEATURES - SOCIAL PLAN
// ============================================

const defaultSocialFeatures = {
  // Core features
  socialAccounts: 3,
  postsPerMonth: 30,
  scheduledPosts: 10,
  teamMembers: 1,

  // AI & Content
  aiGenerations: 50,
  aiContentAssistant: true,
  contentLibrary: false,
  contentTemplates: 5,

  // Publishing
  bulkScheduling: false,
  contentCalendar: true,
  postApprovalWorkflow: false,
  autoPublishing: true,
  rssAutoPosting: false,

  // Analytics & Reporting
  analyticsRetentionDays: 90,
  customReports: 0,
  exportReports: false,
  competitorAnalysis: false,
  advancedAnalytics: false,
  realTimeAnalytics: false,

  // Monitoring
  socialListening: false,
  keywordTracking: 5,
  mentionAlerts: true,
  sentimentAnalysis: false,
  crisisDetection: false,
  brandMonitoring: false,

  // Engagement
  unifiedInbox: true,
  autoResponder: false,
  savedReplies: 10,
  conversationHistory: true,

  // Collaboration
  teamCollaboration: false,
  roleBasedAccess: false,
  approvalWorkflows: false,
  activityLog: true,

  // Integration & API
  apiAccess: false,
  apiCallsPerMonth: 0,
  webhooks: false,
  customIntegrations: false,
  zapierIntegration: false,

  // Storage
  storageGB: 5,
  mediaLibrary: true,

  // Support
  prioritySupport: false,
  dedicatedAccountManager: false,
  onboarding: false,
  training: false,
  sla: false,

  // White Label
  whiteLabel: false,
  customBranding: false,
  customDomain: false,

  // Platform specific
  platformSpecific: {},
};

const defaultFeatures: PlanFeatures = {
  productType: "social",
  social: defaultSocialFeatures,
};

// ============================================
// PLANS TABLE
// ============================================

export const plans = pgTable(
  `${tablePrefix}plans`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // PLAN IDENTITY
    // ============================================
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    tier: subscriptionPlanPgEnum("tier").notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    tagline: varchar("tagline", { length: 200 }),

    // ============================================
    // PRICING
    // ============================================
    pricingModel: pricingModelPgEnum("pricing_model").notNull().default("flat_rate"),

    // Base pricing (in cents)
    priceMonthly: integer("price_monthly"),
    priceAnnual: integer("price_annual"),
    priceQuarterly: integer("price_quarterly"),

    // Currency enum
    currency: currencyPgEnum("currency").notNull().default("USD"),

    // Discounts
    annualDiscount: integer("annual_discount").default(0),
    quarterlyDiscount: integer("quarterly_discount").default(0),

    // Trial
    trialDays: integer("trial_days").default(0),
    hasFreeTrial: boolean("has_free_trial").notNull().default(false),

    // Setup fee
    setupFee: integer("setup_fee").default(0),

    // Pricing tiers for usage-based pricing
    pricingTiers: jsonb("pricing_tiers")
      .$type<
        {
          upTo: number | "unlimited";
          unitPrice: number;
          flatFee?: number;
          currency?: string;
          minimumCharge?: number;
          maximumCharge?: number;
        }[]
      >()
      .default([]),

    // ============================================
    // FEATURES & LIMITS
    // ============================================
    features: jsonb("features").$type<PlanFeatures>().notNull().default(defaultFeatures),

    featureHighlights: jsonb("feature_highlights").$type<string[]>().default([]),

    upcomingFeatures: jsonb("upcoming_features").$type<string[]>().default([]),

    // ============================================
    // STATUS & VISIBILITY
    // ============================================
    status: planStatusPgEnum("status").notNull().default("active"),
    isPublic: boolean("is_public").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPopular: boolean("is_popular").notNull().default(false),
    isRecommended: boolean("is_recommended").notNull().default(false),

    // Availability
    allowNewSignups: boolean("allow_new_signups").notNull().default(true),
    allowUpgrade: boolean("allow_upgrade").notNull().default(true),
    allowDowngrade: boolean("allow_downgrade").notNull().default(true),

    // Geographic availability
    availableCountries: jsonb("available_countries").$type<string[]>().default([]),
    restrictedCountries: jsonb("restricted_countries").$type<string[]>().default([]),

    // ============================================
    // PROCESSOR INTEGRATION
    // ============================================
    stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 255 }),
    stripePriceIdAnnual: varchar("stripe_price_id_annual", { length: 255 }),
    stripePriceIdQuarterly: varchar("stripe_price_id_quarterly", {
      length: 255,
    }),
    stripeProductId: varchar("stripe_product_id", { length: 255 }),

    // ============================================
    // ORDERING & PRESENTATION
    // ============================================
    sortOrder: integer("sort_order").notNull().default(0),
    displayPosition: integer("display_position"),

    // UI customization
    color: varchar("color", { length: 20 }),
    icon: varchar("icon", { length: 50 }),
    badgeText: varchar("badge_text", { length: 50 }),

    // ============================================
    // RESTRICTIONS & REQUIREMENTS
    // ============================================
    minimumSeats: integer("minimum_seats").default(1),
    maximumSeats: integer("maximum_seats"),

    requiresBusinessEmail: boolean("requires_business_email").notNull().default(false),
    requiresContract: boolean("requires_contract").notNull().default(false),
    requiresSalesContact: boolean("requires_sales_contact").notNull().default(false),

    // Commitment
    minimumCommitmentMonths: integer("minimum_commitment_months").default(0),
    cancellationPolicy: text("cancellation_policy"),

    // ============================================
    // ADDONS & OVERAGES
    // ============================================
    allowAddons: boolean("allow_addons").notNull().default(false),

    overageRates: jsonb("overage_rates")
      .$type<
        Array<{
          feature: string;
          price: number;
          unit: string;
          per: number;
          currency?: string;
          minimumCharge?: number;
        }>
      >()
      .default([]),

    // ============================================
    // TAX CONFIGURATION
    // ============================================
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    automaticTax: boolean("automatic_tax").notNull().default(false),
    taxCategory: varchar("tax_category", { length: 50 }),

    // ============================================
    // INVOICE CONFIGURATION
    // ============================================
    invoicePrefix: varchar("invoice_prefix", { length: 10 }),
    invoiceDescriptionTemplate: text("invoice_description_template"),
    invoiceFooter: text("invoice_footer"),

    // ============================================
    // UPGRADE RULES
    // ============================================
    allowedUpgradeTargets: jsonb("allowed_upgrade_targets").$type<string[]>().default([]),
    allowedDowngradeTargets: jsonb("allowed_downgrade_targets").$type<string[]>().default([]),

    // ============================================
    // BILLING CYCLE LIMITS
    // ============================================
    minimumBillingCycles: integer("minimum_billing_cycles"),
    maximumBillingCycles: integer("maximum_billing_cycles"),

    // ============================================
    // METADATA & MARKETING
    // ============================================
    targetAudience: varchar("target_audience", { length: 100 }),
    useCases: jsonb("use_cases").$type<string[]>().default([]),

    comparisonFeatures: jsonb("comparison_features")
      .$type<
        {
          feature: string;
          included: boolean;
          value?: string | number;
          tooltip?: string;
        }[]
      >()
      .default([]),

    metadata: jsonb("metadata")
      .$type<{
        internalNotes?: string;
        salesNotes?: string;
        migrationNotes?: string;
        customFields?: Record<string, unknown>;
      }>()
      .default({}),

    // ============================================
    // VERSIONING & HISTORY
    // ============================================
    version: integer("version").notNull().default(1),
    replacedBy: uuid("replaced_by").references((): any => plans.id, {
      onDelete: "set null",
    }),
    replacesId: uuid("replaces_id").references((): any => plans.id, {
      onDelete: "set null",
    }),

    effectiveDate: timestamp("effective_date", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),

    // Grandfathering
    allowGrandfathering: boolean("allow_grandfathering").notNull().default(false),
    grandfatheringUntil: timestamp("grandfathering_until", {
      withTimezone: true,
    }),

    // ============================================
    // AUDIT
    // ============================================
    createdBy: uuid("created_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    publishedBy: uuid("published_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    lastPriceChange: timestamp("last_price_change", { withTimezone: true }),
    lastFeatureChange: timestamp("last_feature_change", { withTimezone: true }),

    // ============================================
    // TIMESTAMPS & LIFECYCLE
    // ============================================
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references((): any => users.id, {
      onDelete: "set null",
    }),
    archivedReason: text("archived_reason"),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================
    uniqueIndex("plans_slug_unique").on(table.slug).where(sql`archived_at IS NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================
    index("plans_tier_idx").on(table.tier),
    index("plans_slug_idx").on(table.slug),

    // Status & visibility
    index("plans_status_idx").on(table.status),
    index("plans_is_public_idx").on(table.isPublic),
    index("plans_is_featured_idx").on(table.isFeatured),
    index("plans_is_popular_idx").on(table.isPopular),

    // Pricing
    index("plans_pricing_model_idx").on(table.pricingModel),
    index("plans_price_monthly_idx").on(table.priceMonthly),
    index("plans_currency_idx").on(table.currency),

    // Signup controls
    index("plans_allow_new_signups_idx").on(table.allowNewSignups),

    // Stripe integration
    index("plans_stripe_product_idx").on(table.stripeProductId),

    // Ordering
    index("plans_sort_order_idx").on(table.sortOrder),
    index("plans_display_position_idx").on(table.displayPosition),

    // Versioning
    index("plans_version_idx").on(table.version),
    index("plans_replaced_by_idx").on(table.replacedBy),
    index("plans_replaces_idx").on(table.replacesId),

    // Dates
    index("plans_effective_date_idx").on(table.effectiveDate),
    index("plans_expiry_date_idx").on(table.expiryDate),

    // Lifecycle
    index("plans_archived_at_idx").on(table.archivedAt),
    index("plans_created_at_idx").on(table.createdAt),

    // Audit
    index("plans_created_by_idx").on(table.createdBy),
    index("plans_published_by_idx").on(table.publishedBy),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    // Active public plans for pricing page
    index("plans_public_active_idx")
      .on(table.sortOrder, table.isPublic, table.status)
      .where(sql`
        is_public = true 
        AND status = 'active' 
        AND archived_at IS NULL
      `),

    // Plans available for signup
    index("plans_available_for_signup_idx")
      .on(table.tier, table.allowNewSignups, table.status)
      .where(sql`
        allow_new_signups = true 
        AND status = 'active' 
        AND archived_at IS NULL
      `),

    // Featured plans
    index("plans_featured_idx")
      .on(table.sortOrder, table.isFeatured)
      .where(sql`
        is_featured = true 
        AND is_public = true 
        AND status = 'active' 
        AND archived_at IS NULL
      `),

    // Current active plans
    index("plans_current_active_idx")
      .on(table.effectiveDate, table.expiryDate, table.status)
      .where(sql`
        status = 'active' 
        AND archived_at IS NULL
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index("plans_features_gin_idx").using("gin", table.features).where(sql`features IS NOT NULL`),

    index("plans_metadata_gin_idx").using("gin", table.metadata).where(sql`metadata IS NOT NULL`),

    index("plans_comparison_features_gin_idx")
      .using("gin", table.comparisonFeatures)
      .where(sql`comparison_features IS NOT NULL`),

    index("plans_overage_rates_gin_idx")
      .using("gin", table.overageRates)
      .where(sql`overage_rates IS NOT NULL`),
  ],
);

// ============================================
// RELATIONS
// ============================================

export const plansRelations = relations(plans, ({ many, one }) => ({
  subscriptions: many(subscriptions),
  replacedByPlan: one(plans, {
    fields: [plans.replacedBy],
    references: [plans.id],
    relationName: "plan_replacement",
  }),
  replacesPlan: one(plans, {
    fields: [plans.replacesId],
    references: [plans.id],
    relationName: "plan_replaced",
  }),
  createdByUser: one(users, {
    fields: [plans.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [plans.updatedBy],
    references: [users.id],
  }),
  publishedByUser: one(users, {
    fields: [plans.publishedBy],
    references: [users.id],
  }),
  archivedByUser: one(users, {
    fields: [plans.archivedBy],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanTable = typeof plans;

// ============================================
// HELPER SELECTORS
// ============================================

export const planSelectors = {
  basic: {
    id: plans.id,
    name: plans.name,
    slug: plans.slug,
    tier: plans.tier,
    displayName: plans.displayName,
    productType: sql<PlanFeatures["productType"]>`${plans.features}->>'productType'`,
    priceMonthly: plans.priceMonthly,
    priceAnnual: plans.priceAnnual,
    currency: plans.currency,
    trialDays: plans.trialDays,
    status: plans.status,
  } as const,

  pricing: {
    id: plans.id,
    name: plans.name,
    slug: plans.slug,
    tier: plans.tier,
    displayName: plans.displayName,
    productType: sql<PlanFeatures["productType"]>`${plans.features}->>'productType'`,
    description: plans.description,
    tagline: plans.tagline,
    priceMonthly: plans.priceMonthly,
    priceAnnual: plans.priceAnnual,
    priceQuarterly: plans.priceQuarterly,
    currency: plans.currency,
    annualDiscount: plans.annualDiscount,
    trialDays: plans.trialDays,
    hasFreeTrial: plans.hasFreeTrial,
    features: plans.features,
    featureHighlights: plans.featureHighlights,
    isFeatured: plans.isFeatured,
    isPopular: plans.isPopular,
    isRecommended: plans.isRecommended,
    color: plans.color,
    icon: plans.icon,
    badgeText: plans.badgeText,
    sortOrder: plans.sortOrder,
    status: plans.status,
  } as const,

  admin: {
    id: plans.id,
    name: plans.name,
    slug: plans.slug,
    tier: plans.tier,
    displayName: plans.displayName,
    description: plans.description,
    tagline: plans.tagline,
    pricingModel: plans.pricingModel,
    priceMonthly: plans.priceMonthly,
    priceAnnual: plans.priceAnnual,
    priceQuarterly: plans.priceQuarterly,
    currency: plans.currency,
    annualDiscount: plans.annualDiscount,
    quarterlyDiscount: plans.quarterlyDiscount,
    trialDays: plans.trialDays,
    hasFreeTrial: plans.hasFreeTrial,
    setupFee: plans.setupFee,
    pricingTiers: plans.pricingTiers,
    features: plans.features,
    featureHighlights: plans.featureHighlights,
    upcomingFeatures: plans.upcomingFeatures,
    status: plans.status,
    isPublic: plans.isPublic,
    isFeatured: plans.isFeatured,
    isPopular: plans.isPopular,
    isRecommended: plans.isRecommended,
    allowNewSignups: plans.allowNewSignups,
    allowUpgrade: plans.allowUpgrade,
    allowDowngrade: plans.allowDowngrade,
    availableCountries: plans.availableCountries,
    restrictedCountries: plans.restrictedCountries,
    stripePriceIdMonthly: plans.stripePriceIdMonthly,
    stripePriceIdAnnual: plans.stripePriceIdAnnual,
    stripePriceIdQuarterly: plans.stripePriceIdQuarterly,
    stripeProductId: plans.stripeProductId,
    sortOrder: plans.sortOrder,
    displayPosition: plans.displayPosition,
    color: plans.color,
    icon: plans.icon,
    badgeText: plans.badgeText,
    minimumSeats: plans.minimumSeats,
    maximumSeats: plans.maximumSeats,
    requiresBusinessEmail: plans.requiresBusinessEmail,
    requiresContract: plans.requiresContract,
    requiresSalesContact: plans.requiresSalesContact,
    minimumCommitmentMonths: plans.minimumCommitmentMonths,
    cancellationPolicy: plans.cancellationPolicy,
    allowAddons: plans.allowAddons,
    overageRates: plans.overageRates,
    targetAudience: plans.targetAudience,
    useCases: plans.useCases,
    comparisonFeatures: plans.comparisonFeatures,
    metadata: plans.metadata,
    version: plans.version,
    replacedBy: plans.replacedBy,
    replacesId: plans.replacesId,
    effectiveDate: plans.effectiveDate,
    expiryDate: plans.expiryDate,
    allowGrandfathering: plans.allowGrandfathering,
    grandfatheringUntil: plans.grandfatheringUntil,
    taxInclusive: plans.taxInclusive,
    automaticTax: plans.automaticTax,
    taxCategory: plans.taxCategory,
    invoicePrefix: plans.invoicePrefix,
    invoiceDescriptionTemplate: plans.invoiceDescriptionTemplate,
    invoiceFooter: plans.invoiceFooter,
    allowedUpgradeTargets: plans.allowedUpgradeTargets,
    allowedDowngradeTargets: plans.allowedDowngradeTargets,
    minimumBillingCycles: plans.minimumBillingCycles,
    maximumBillingCycles: plans.maximumBillingCycles,
    createdBy: plans.createdBy,
    updatedBy: plans.updatedBy,
    publishedBy: plans.publishedBy,
    publishedAt: plans.publishedAt,
    lastPriceChange: plans.lastPriceChange,
    lastFeatureChange: plans.lastFeatureChange,
    createdAt: plans.createdAt,
    updatedAt: plans.updatedAt,
    archivedAt: plans.archivedAt,
    archivedBy: plans.archivedBy,
    archivedReason: plans.archivedReason,
  } as const,
};
