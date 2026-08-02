// @/db/schemas/billing/subscriptions.ts
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "../core/users";
import { organizations } from "../organization/organizations";
import { plans } from "./plans";
import { tablePrefix } from "../shared/schema-utils";
import {
  subscriptionStatusPgEnum,
  billingCyclePgEnum,
  subscriptionPlanPgEnum,
  subscriptionCancelReasonPgEnum,
  paymentMethodPgEnum,
  productTypePgEnum,
} from "../shared/enums";
import {
  BillingHistoryEvent,
  ChangeHistory,
  Discount,
  OverageCharge,
  OverageStatus,
  SubscriptionAddon,
  SubscriptionLimits,
  SubscriptionMetadata,
  SubscriptionUsage,
  PlanSnapshot,
  PaymentMethodDetails,
  NotificationSettings,
} from "@/server/billing/types/subscription-types";
import { ProductType } from "@/server/billing/types/plan-types";

// ============================================
// USAGE TRACKING TYPES
// ============================================

const UsageDefault: SubscriptionUsage = {
  productType: "social",
  // Social Media defaults
  socialAccounts: 0,
  postsThisMonth: 0,
  scheduledPosts: 0,
  activeTeamMembers: 0,
  aiGenerationsUsed: 0,
  reportsGenerated: 0,
  storageUsedMB: 0,
  apiCallsThisMonth: 0,
  keywordsTracked: 0,
  repliesSaved: 0,

  // Fashion defaults (set to undefined for social type)
  clientsCreated: undefined,
  measurementsTaken: undefined,
  patternsGenerated: undefined,
  projectsCreated: undefined,
  invoicesSent: undefined,
  teamMembersActive: undefined,

  // Metadata
  lastReset: new Date(),
  lastUpdated: new Date(),
};

// ============================================
// LIMITS TYPES
// ============================================

const LimitsDefault: SubscriptionLimits = {
  productType: "social",
  // Social Media limits
  socialAccounts: 0,
  postsPerMonth: 0,
  scheduledPosts: 0,
  teamMembers: 0,
  aiGenerations: 0,
  customReports: 0,
  storageGB: 0,
  apiCallsPerMonth: 0,
  keywordTracking: 0,
  savedReplies: 0,

  // Fashion limits (set to undefined for social type)
  maxClients: undefined,
  maxMeasurements: undefined,
  maxPatternsPerMonth: undefined,
  maxProjects: undefined,
  maxTeamMembers: undefined,
};

// ============================================
// OVERAGE TYPES
// ============================================

const OverageDefault: OverageCharge[] = [];

const OverageStatusDefault: OverageStatus = {
  hasOverage: false,
  totalOverage: 0,
  overageCharges: [],
  lastOverageCheck: new Date(),
  nextOverageCheck: new Date(),
  totalPendingOverage: 0,
  lastChecked: new Date(),
};

const AddonDefault: SubscriptionAddon[] = [];
const DiscountDefault: Discount[] = [];

const NotificationDefault: NotificationSettings = {
  paymentReminders: true,
  usageAlerts: true,
  renewalReminders: true,
  trialExpiring: true,
  paymentFailed: true,
  subscriptionCanceled: true,
  invoiceReady: true,
  overageWarnings: true,
  limitWarnings: true,
};

const BillingHistoryDefault: BillingHistoryEvent[] = [];
const ChangeHistoryDefault: ChangeHistory[] = [];

// ============================================
// SUBSCRIPTIONS TABLE
// ============================================

export const subscriptions = pgTable(
  `${tablePrefix}subscriptions`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // ============================================
    // OWNERSHIP
    // ============================================
    type: subscriptionPlanPgEnum("type").notNull().default("organization"),

    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    // ============================================
    // PRODUCT TYPE (MOVED OUT OF JSON - NEW)
    // ============================================
    productType: productTypePgEnum("product_type").notNull().default("social"),

    // ============================================
    // PLAN REFERENCE
    // ============================================
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),

    planSnapshot: jsonb("plan_snapshot").$type<PlanSnapshot>().notNull(),

    // ============================================
    // BILLING CONFIGURATION
    // ============================================
    billingCycle: billingCyclePgEnum("billing_cycle")
      .notNull()
      .default("monthly"),

    basePrice: integer("base_price").notNull(),
    additionalSeatsPrice: integer("additional_seats_price").default(0),
    addonsCost: integer("addons_cost").default(0),
    discountAmount: integer("discount_amount").default(0),
    totalPrice: integer("total_price").notNull(),

    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    // Seats
    seats: integer("seats").notNull().default(1),
    includedSeats: integer("included_seats").notNull().default(1),
    additionalSeats: integer("additional_seats").notNull().default(0),
    seatPrice: integer("seat_price").default(0),

    // ============================================
    // STATUS & LIFECYCLE
    // ============================================
    status: subscriptionStatusPgEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),

    // Trial
    isTrialing: boolean("is_trialing").notNull().default(false),
    trialStartsAt: timestamp("trial_starts_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    trialExtendedUntil: timestamp("trial_extended_until", {
      withTimezone: true,
    }),

    // Billing period
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),

    // Subscription lifecycle
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    // Renewal
    renewsAt: timestamp("renews_at", { withTimezone: true }),
    autoRenew: boolean("auto_renew").notNull().default(true),

    // Cancellation
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancellationEffectiveDate: timestamp("cancellation_effective_date", {
      withTimezone: true,
    }),
    cancellationReason: subscriptionCancelReasonPgEnum("cancellation_reason"),
    cancellationNote: text("cancellation_note"),
    canceledBy: uuid("canceled_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Pause/suspend
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    pauseReason: text("pause_reason"),

    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),

    // ============================================
    // PAYMENT PROVIDER (ABSTRACTED - NEW)
    // ============================================
    provider: varchar("provider", { length: 50 }).default("paystack"),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }),
    providerSubscriptionId: varchar("provider_subscription_id", {
      length: 255,
    }).unique(),
    providerPlanId: varchar("provider_plan_id", { length: 255 }),
    providerAuthorizationCode: varchar("provider_authorization_code", {
      length: 255,
    }),
    providerMetadata: jsonb("provider_metadata")
      .$type<Record<string, unknown>>()
      .default({}),

    // ============================================
    // LEGACY PAYSTACK FIELDS (KEPT FOR BACKWARDS COMPATIBILITY)
    // ============================================
    paystackCustomerCode: varchar("paystack_customer_code", { length: 255 }),
    paystackSubscriptionCode: varchar("paystack_subscription_code", {
      length: 255,
    }).unique(),
    paystackPlanCode: varchar("paystack_plan_code", { length: 255 }),
    paystackAuthorizationCode: varchar("paystack_authorization_code", {
      length: 255,
    }),

    // Last payment
    lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
    lastPaymentAmount: integer("last_payment_amount"),
    lastPaymentStatus: varchar("last_payment_status", { length: 50 }),
    lastPaymentReference: varchar("last_payment_reference", { length: 255 }),

    // Next payment
    nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }),
    nextPaymentAmount: integer("next_payment_amount"),

    // Payment failure tracking
    paymentFailureCount: integer("payment_failure_count").notNull().default(0),
    lastPaymentFailureAt: timestamp("last_payment_failure_at", {
      withTimezone: true,
    }),
    lastPaymentFailureReason: text("last_payment_failure_reason"),

    // ============================================
    // PAYMENT METHOD
    // ============================================
    paymentMethodType: paymentMethodPgEnum("payment_method_type"),
    paymentMethodDetails: jsonb("payment_method_details")
      .$type<PaymentMethodDetails>()
      .default({}),

    // ============================================
    // USAGE LIMITS & TRACKING
    // ============================================
    limits: jsonb("subscription_limits")
      .$type<SubscriptionLimits>()
      .notNull()
      .default(LimitsDefault),

    usage: jsonb("subscription_usage")
      .$type<SubscriptionUsage>()
      .notNull()
      .default(UsageDefault),

    // ============================================
    // OVERAGE TRACKING
    // ============================================
    overageCharges: jsonb("overage_charges")
      .$type<OverageCharge[]>()
      .default(OverageDefault),

    overageStatus: jsonb("overage_status")
      .$type<OverageStatus>()
      .default(OverageStatusDefault),

    // ============================================
    // ADDONS
    // ============================================
    addons: jsonb("addons").$type<SubscriptionAddon[]>().default(AddonDefault),

    // ============================================
    // DISCOUNTS & PROMOTIONS
    // ============================================
    discounts: jsonb("discounts").$type<Discount[]>().default(DiscountDefault),

    couponCode: varchar("coupon_code", { length: 100 }),
    couponAppliedAt: timestamp("coupon_applied_at", { withTimezone: true }),

    // ============================================
    // GRANDFATHERING & SPECIAL CONDITIONS
    // ============================================
    isGrandfathered: boolean("is_grandfathered").notNull().default(false),
    grandfatheredFeatures: jsonb("grandfathered_features")
      .$type<Record<string, unknown>>()
      .default({}),
    grandfatheredUntil: timestamp("grandfathered_until", {
      withTimezone: true,
    }),
    grandfatheringNotes: text("grandfathering_notes"),

    // Custom pricing
    hasCustomPricing: boolean("has_custom_pricing").notNull().default(false),
    customPricingNotes: text("custom_pricing_notes"),
    customPricingApprovedBy: uuid("custom_pricing_approved_by").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    // ============================================
    // NOTIFICATIONS & ALERTS
    // ============================================
    notificationSettings: jsonb("notification_settings")
      .$type<NotificationSettings>()
      .notNull()
      .default(NotificationDefault),

    lastUsageAlertAt: timestamp("last_usage_alert_at", { withTimezone: true }),
    lastRenewalReminderAt: timestamp("last_renewal_reminder_at", {
      withTimezone: true,
    }),
    lastOverageWarningAt: timestamp("last_overage_warning_at", {
      withTimezone: true,
    }),

    // ============================================
    // HISTORY & AUDIT
    // ============================================
    billingHistory: jsonb("billing_history")
      .$type<BillingHistoryEvent[]>()
      .default(BillingHistoryDefault),

    changeHistory: jsonb("change_history")
      .$type<ChangeHistory[]>()
      .default(ChangeHistoryDefault),

    // ============================================
    // METADATA
    // ============================================
    metadata: jsonb("metadata").$type<SubscriptionMetadata>().default({}),

    tags: jsonb("tags").$type<string[]>().default([]),
    internalNotes: text("internal_notes"),

    // ============================================
    // TIMESTAMPS
    // ============================================
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================
    index("subscriptions_provider_subscription_unique")
      .on(table.provider, table.providerSubscriptionId)
      .where(sql`provider_subscription_id IS NOT NULL AND deleted_at IS NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_organization_idx").on(table.organizationId),
    index("subscriptions_plan_idx").on(table.planId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_is_active_idx").on(table.isActive),
    index("subscriptions_billing_cycle_idx").on(table.billingCycle),
    index("subscriptions_product_type_idx").on(table.productType),

    // Dates
    index("subscriptions_current_period_end_idx").on(table.currentPeriodEnd),
    index("subscriptions_trial_ends_at_idx").on(table.trialEndsAt),
    index("subscriptions_renews_at_idx").on(table.renewsAt),
    index("subscriptions_ended_at_idx").on(table.endedAt),
    index("subscriptions_canceled_at_idx").on(table.canceledAt),
    index("subscriptions_next_payment_at_idx").on(table.nextPaymentAt),

    // Provider
    index("subscriptions_provider_idx").on(table.provider),
    index("subscriptions_provider_customer_idx").on(table.providerCustomerId),
    index("subscriptions_provider_subscription_idx").on(
      table.providerSubscriptionId,
    ),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================
    index("subscriptions_org_active_idx")
      .on(table.organizationId, table.status, table.isActive)
      .where(sql`deleted_at IS NULL`),

    index("subscriptions_org_product_idx")
      .on(table.organizationId, table.productType, table.status)
      .where(sql`deleted_at IS NULL`),

    index("subscriptions_org_current_period_idx")
      .on(table.organizationId, table.currentPeriodEnd, table.status)
      .where(sql`deleted_at IS NULL`),

    index("subscriptions_expiring_trials_idx")
      .on(table.trialEndsAt, table.isTrialing, table.status)
      .where(
        sql`is_trialing = true AND status = 'active' AND deleted_at IS NULL`,
      ),

    index("subscriptions_failing_payments_idx")
      .on(table.paymentFailureCount, table.status, table.nextPaymentAt)
      .where(
        sql`payment_failure_count > 0 AND status != 'canceled' AND deleted_at IS NULL`,
      ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index("subscriptions_metadata_gin_idx")
      .using("gin", table.metadata)
      .where(sql`metadata IS NOT NULL`),

    index("subscriptions_tags_gin_idx")
      .using("gin", table.tags)
      .where(sql`tags IS NOT NULL`),

    index("subscriptions_usage_gin_idx")
      .using("gin", table.usage)
      .where(sql`usage IS NOT NULL`),

    index("subscriptions_limits_gin_idx")
      .using("gin", table.limits)
      .where(sql`limits IS NOT NULL`),

    index("subscriptions_addons_gin_idx")
      .using("gin", table.addons)
      .where(sql`addons IS NOT NULL`),
  ],
);

// ============================================
// RELATIONS
// ============================================

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  canceledByUser: one(users, {
    fields: [subscriptions.canceledBy],
    references: [users.id],
    relationName: "subscription_canceled_by",
  }),
  customPricingApprover: one(users, {
    fields: [subscriptions.customPricingApprovedBy],
    references: [users.id],
    relationName: "subscription_custom_pricing_approver",
  }),
  deletedByUser: one(users, {
    fields: [subscriptions.deletedBy],
    references: [users.id],
    relationName: "subscription_deleted_by",
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionTable = typeof subscriptions;

// ============================================
// HELPER SELECTORS
// ============================================

export const subscriptionSelectors = {
  basic: {
    id: subscriptions.id,
    type: subscriptions.type,
    userId: subscriptions.userId,
    organizationId: subscriptions.organizationId,
    planId: subscriptions.planId,
    productType: subscriptions.productType,
    status: subscriptions.status,
    isActive: subscriptions.isActive,
    billingCycle: subscriptions.billingCycle,
    totalPrice: subscriptions.totalPrice,
    currency: subscriptions.currency,
    seats: subscriptions.seats,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    createdAt: subscriptions.createdAt,
  } as const,

  dashboard: {
    id: subscriptions.id,
    type: subscriptions.type,
    organizationId: subscriptions.organizationId,
    planId: subscriptions.planId,
    productType: subscriptions.productType,
    planSnapshot: subscriptions.planSnapshot,
    status: subscriptions.status,
    isActive: subscriptions.isActive,
    isTrialing: subscriptions.isTrialing,
    trialEndsAt: subscriptions.trialEndsAt,
    billingCycle: subscriptions.billingCycle,
    totalPrice: subscriptions.totalPrice,
    currency: subscriptions.currency,
    seats: subscriptions.seats,
    additionalSeats: subscriptions.additionalSeats,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    renewsAt: subscriptions.renewsAt,
    autoRenew: subscriptions.autoRenew,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    cancellationEffectiveDate: subscriptions.cancellationEffectiveDate,
    limits: subscriptions.limits,
    usage: subscriptions.usage,
    addons: subscriptions.addons,
    discounts: subscriptions.discounts,
    nextPaymentAt: subscriptions.nextPaymentAt,
    nextPaymentAmount: subscriptions.nextPaymentAmount,
    lastPaymentAt: subscriptions.lastPaymentAt,
    lastPaymentAmount: subscriptions.lastPaymentAmount,
    lastPaymentStatus: subscriptions.lastPaymentStatus,
    lastPaymentReference: subscriptions.lastPaymentReference,
    notificationSettings: subscriptions.notificationSettings,
    createdAt: subscriptions.createdAt,
    updatedAt: subscriptions.updatedAt,
  } as const,

  billing: {
    id: subscriptions.id,
    organizationId: subscriptions.organizationId,
    planId: subscriptions.planId,
    productType: subscriptions.productType,
    planSnapshot: subscriptions.planSnapshot,
    status: subscriptions.status,
    billingCycle: subscriptions.billingCycle,
    basePrice: subscriptions.basePrice,
    additionalSeatsPrice: subscriptions.additionalSeatsPrice,
    addonsCost: subscriptions.addonsCost,
    discountAmount: subscriptions.discountAmount,
    totalPrice: subscriptions.totalPrice,
    currency: subscriptions.currency,
    seats: subscriptions.seats,
    additionalSeats: subscriptions.additionalSeats,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    nextPaymentAt: subscriptions.nextPaymentAt,
    nextPaymentAmount: subscriptions.nextPaymentAmount,
    lastPaymentAt: subscriptions.lastPaymentAt,
    lastPaymentAmount: subscriptions.lastPaymentAmount,
    lastPaymentStatus: subscriptions.lastPaymentStatus,
    lastPaymentReference: subscriptions.lastPaymentReference,
    paymentFailureCount: subscriptions.paymentFailureCount,
    lastPaymentFailureAt: subscriptions.lastPaymentFailureAt,
    paymentMethodType: subscriptions.paymentMethodType,
    paymentMethodDetails: subscriptions.paymentMethodDetails,
    addons: subscriptions.addons,
    discounts: subscriptions.discounts,
    couponCode: subscriptions.couponCode,
    overageCharges: subscriptions.overageCharges,
    overageStatus: subscriptions.overageStatus,
    provider: subscriptions.provider,
    providerCustomerId: subscriptions.providerCustomerId,
    providerSubscriptionId: subscriptions.providerSubscriptionId,
    providerPlanId: subscriptions.providerPlanId,
    providerAuthorizationCode: subscriptions.providerAuthorizationCode,
    billingHistory: subscriptions.billingHistory,
    createdAt: subscriptions.createdAt,
    updatedAt: subscriptions.updatedAt,
  } as const,

  admin: {
    id: subscriptions.id,
    type: subscriptions.type,
    userId: subscriptions.userId,
    organizationId: subscriptions.organizationId,
    planId: subscriptions.planId,
    productType: subscriptions.productType,
    planSnapshot: subscriptions.planSnapshot,
    status: subscriptions.status,
    isActive: subscriptions.isActive,
    isTrialing: subscriptions.isTrialing,
    trialStartsAt: subscriptions.trialStartsAt,
    trialEndsAt: subscriptions.trialEndsAt,
    trialExtendedUntil: subscriptions.trialExtendedUntil,
    billingCycle: subscriptions.billingCycle,
    basePrice: subscriptions.basePrice,
    additionalSeatsPrice: subscriptions.additionalSeatsPrice,
    addonsCost: subscriptions.addonsCost,
    discountAmount: subscriptions.discountAmount,
    totalPrice: subscriptions.totalPrice,
    currency: subscriptions.currency,
    seats: subscriptions.seats,
    includedSeats: subscriptions.includedSeats,
    additionalSeats: subscriptions.additionalSeats,
    seatPrice: subscriptions.seatPrice,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    startedAt: subscriptions.startedAt,
    activatedAt: subscriptions.activatedAt,
    endedAt: subscriptions.endedAt,
    renewsAt: subscriptions.renewsAt,
    autoRenew: subscriptions.autoRenew,
    canceledAt: subscriptions.canceledAt,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    cancellationEffectiveDate: subscriptions.cancellationEffectiveDate,
    cancellationReason: subscriptions.cancellationReason,
    cancellationNote: subscriptions.cancellationNote,
    canceledBy: subscriptions.canceledBy,
    pausedAt: subscriptions.pausedAt,
    pausedUntil: subscriptions.pausedUntil,
    pauseReason: subscriptions.pauseReason,
    suspendedAt: subscriptions.suspendedAt,
    suspensionReason: subscriptions.suspensionReason,
    limits: subscriptions.limits,
    usage: subscriptions.usage,
    overageCharges: subscriptions.overageCharges,
    overageStatus: subscriptions.overageStatus,
    addons: subscriptions.addons,
    discounts: subscriptions.discounts,
    couponCode: subscriptions.couponCode,
    couponAppliedAt: subscriptions.couponAppliedAt,
    isGrandfathered: subscriptions.isGrandfathered,
    grandfatheredFeatures: subscriptions.grandfatheredFeatures,
    grandfatheredUntil: subscriptions.grandfatheredUntil,
    grandfatheringNotes: subscriptions.grandfatheringNotes,
    hasCustomPricing: subscriptions.hasCustomPricing,
    customPricingNotes: subscriptions.customPricingNotes,
    customPricingApprovedBy: subscriptions.customPricingApprovedBy,
    provider: subscriptions.provider,
    providerCustomerId: subscriptions.providerCustomerId,
    providerSubscriptionId: subscriptions.providerSubscriptionId,
    providerPlanId: subscriptions.providerPlanId,
    providerAuthorizationCode: subscriptions.providerAuthorizationCode,
    providerMetadata: subscriptions.providerMetadata,
    paystackCustomerCode: subscriptions.paystackCustomerCode,
    paystackSubscriptionCode: subscriptions.paystackSubscriptionCode,
    paystackPlanCode: subscriptions.paystackPlanCode,
    paystackAuthorizationCode: subscriptions.paystackAuthorizationCode,
    lastPaymentAt: subscriptions.lastPaymentAt,
    lastPaymentAmount: subscriptions.lastPaymentAmount,
    lastPaymentStatus: subscriptions.lastPaymentStatus,
    lastPaymentReference: subscriptions.lastPaymentReference,
    nextPaymentAt: subscriptions.nextPaymentAt,
    nextPaymentAmount: subscriptions.nextPaymentAmount,
    paymentFailureCount: subscriptions.paymentFailureCount,
    lastPaymentFailureAt: subscriptions.lastPaymentFailureAt,
    lastPaymentFailureReason: subscriptions.lastPaymentFailureReason,
    paymentMethodType: subscriptions.paymentMethodType,
    paymentMethodDetails: subscriptions.paymentMethodDetails,
    notificationSettings: subscriptions.notificationSettings,
    lastUsageAlertAt: subscriptions.lastUsageAlertAt,
    lastRenewalReminderAt: subscriptions.lastRenewalReminderAt,
    lastOverageWarningAt: subscriptions.lastOverageWarningAt,
    billingHistory: subscriptions.billingHistory,
    changeHistory: subscriptions.changeHistory,
    metadata: subscriptions.metadata,
    tags: subscriptions.tags,
    internalNotes: subscriptions.internalNotes,
    createdAt: subscriptions.createdAt,
    updatedAt: subscriptions.updatedAt,
    deletedAt: subscriptions.deletedAt,
    deletedBy: subscriptions.deletedBy,
  } as const,
};
