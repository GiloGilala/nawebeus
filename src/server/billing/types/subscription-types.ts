/**
 * Billing subscription domain types (NWB-P13-001).
 *
 * Shapes the Drizzle schema in `db/billing/subscriptions.ts` consumes as jsonb
 * column types. Same placement rule as `plan-types.ts`: the db layer consumes
 * types from `src/server/<domain>/types/`, never from `src/services/`.
 *
 * Shapes only: no logic, no I/O.
 */
import type { PlanFeatures, ProductType } from "./plan-types";

/**
 * Metered usage of the subscription's organization, keyed to the limit it
 * consumes. `lastReset` marks the start of the current metering period.
 */
export interface SubscriptionUsage {
  productType: ProductType;

  // Social media usage
  socialAccounts: number;
  postsThisMonth: number;
  scheduledPosts: number;
  activeTeamMembers: number;
  aiGenerationsUsed: number;
  reportsGenerated: number;
  storageUsedMB: number;
  apiCallsThisMonth: number;
  keywordsTracked: number;
  repliesSaved: number;

  // Fashion usage (undefined for social subscriptions)
  clientsCreated?: number | undefined;
  measurementsTaken?: number | undefined;
  patternsGenerated?: number | undefined;
  projectsCreated?: number | undefined;
  invoicesSent?: number | undefined;
  teamMembersActive?: number | undefined;

  lastReset: Date;
  lastUpdated: Date;
}

/** The hard limits a subscription grants (projected from the plan's features). */
export interface SubscriptionLimits {
  productType: ProductType;

  // Social media limits
  socialAccounts: number;
  postsPerMonth: number;
  scheduledPosts: number;
  teamMembers: number;
  aiGenerations: number;
  customReports: number;
  storageGB: number;
  apiCallsPerMonth: number;
  keywordTracking: number;
  savedReplies: number;

  // Fashion limits (undefined for social subscriptions)
  maxClients?: number | undefined;
  maxMeasurements?: number | undefined;
  maxPatternsPerMonth?: number | undefined;
  maxProjects?: number | undefined;
  maxTeamMembers?: number | undefined;
}

/** A single overage charge (usage beyond a limit). */
export interface OverageCharge {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: "pending" | "charged" | "waived";
  incurredAt: Date;
}

/** Rolling overage bookkeeping for the current period. */
export interface OverageStatus {
  hasOverage: boolean;
  totalOverage: number;
  overageCharges: OverageCharge[];
  lastOverageCheck: Date;
  nextOverageCheck: Date;
  totalPendingOverage: number;
  lastChecked: Date;
}

/** An addon attached to the subscription beyond the base plan. */
export interface SubscriptionAddon {
  id: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  active: boolean;
}

/** A discount applied to the subscription. */
export interface Discount {
  code: string;
  kind: "percent" | "amount";
  value: number;
  currency?: string;
  appliedAt: Date;
}

/**
 * The immutable plan state captured when the subscription was created, so a
 * later plan edit (price, limits, archive) never rewrites history.
 */
export interface PlanSnapshot {
  id: string;
  name: string;
  slug: string;
  tier: string;
  pricingModel: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  priceQuarterly: number | null;
  currency: string;
  features: PlanFeatures;
}

/** One entry in the subscription's change history. */
export interface ChangeHistory {
  at: Date;
  changedBy: string;
  change: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/** One entry in the subscription's billing history (charges, refunds, credits). */
export interface BillingHistoryEvent {
  at: Date;
  type: string;
  amount?: number;
  currency?: string;
  description?: string;
  reference?: string;
}

/** Which billing notifications the organization opted into. */
export interface NotificationSettings {
  paymentReminders: boolean;
  usageAlerts: boolean;
  renewalReminders: boolean;
  trialExpiring: boolean;
  paymentFailed: boolean;
  subscriptionCanceled: boolean;
  invoiceReady: boolean;
  overageWarnings: boolean;
  limitWarnings: boolean;
}

/** The payment method on file, without raw PAN data (ciphertext belongs to the processor). */
export interface PaymentMethodDetails {
  type?: "card" | "bank_account" | "ussd";
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  accountNumberLast4?: string;
  /** Processor-side token/identifier, never the payment instrument itself. */
  processorToken?: string;
  raw?: Record<string, unknown>;
}

/** Free-form, ops-only metadata. */
export type SubscriptionMetadata = Record<string, unknown>;
