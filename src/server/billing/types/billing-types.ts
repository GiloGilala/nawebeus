/**
 * Billing domain types (NWB-P13-001).
 *
 * Slot 2 of the domain module pattern. The types slot is the single owner of
 * the domain's shapes: the service, functions and route slots all import from
 * here and nobody redefines a billing type in their own file (the zod
 * schemas in `../schemas/billing.schemas.ts` are annotated *against* these
 * types, so a drift is a compile error, not a runtime surprise).
 *
 * Sits beside `plan-types.ts` and `subscription-types.ts` (the jsonb column
 * shapes the db layer consumes) — this file owns the *API-facing* shapes:
 * what a billing request carries in, what a billing response carries out.
 *
 * Shapes only: no logic, no I/O.
 */

import type { PlanFeatures } from "./plan-types";
import type {
  OverageStatus,
  PaymentMethodDetails,
  PlanSnapshot,
  SubscriptionLimits,
  SubscriptionUsage,
} from "./subscription-types";

// ── Enum-shaped filter unions ────────────────────────────────────────────────
//
// The API-facing spellings of the db pgEnums the list endpoints filter on and
// the write paths store. They live here — not in the db layer and not in the
// zod schemas — because the types slot is the single owner of the domain's
// shapes: the query schemas are annotated against these unions (so a drift
// between what a client may send and what the column accepts is a compile
// error), and the service's `eq()` predicates narrow instead of casting a
// bare `string` into an enum column.
//
// Keep in sync with db/shared/enums.ts (the db-side registry); the values
// below are that registry's billing section.

/** Invoice lifecycle (`invoice_status`). */
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible" | "overdue";

/** What an invoice bills for (`invoice_type`). */
export type InvoiceType =
  | "subscription"
  | "one_time"
  | "overage"
  | "addon"
  | "credit_note"
  | "refund"
  | "adjustment";

/** Ledger entry kinds (`transaction_type`). */
export type BillingTransactionType =
  | "charge"
  | "payment"
  | "refund"
  | "credit"
  | "debit"
  | "adjustment"
  | "fee"
  | "discount"
  | "tax"
  | "transfer"
  | "chargeback"
  | "payout"
  | "deposit";

/** Ledger entry states (`billing_transaction_status`). */
export type BillingTransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "settled"
  | "failed"
  | "reversed"
  | "refunded"
  | "disputed"
  | "canceled";

/** Why a subscription was canceled (`subscription_cancel_reason`). */
export type SubscriptionCancelReason =
  | "price_too_high"
  | "switching_provider"
  | "missing_features"
  | "no_longer_needed"
  | "other";

/** Card brands (`card_brand`; the Nigerian-market set, verve included). */
export type CardBrand = "visa" | "mastercard" | "verve" | "amex" | "other";

/** Payment processors (`processor_type`; Paystack-first per decision D7). */
export type PaymentProcessor =
  | "stripe"
  | "paypal"
  | "paystack"
  | "flutterwave"
  | "square"
  | "adyen"
  | "razorpay"
  | "cashfree"
  | "monnify"
  | "opay"
  | "momo"
  | "braintree"
  | "authorize_net"
  | "worldpay"
  | "other";

// ── Actor ────────────────────────────────────────────────────────────────────

/**
 * The acting principal, as a billing service receives it (NWB-P1-002
 * convention: the actor travels with the call so a service invoked from any
 * entry point — Hono route, server function, queue job — still audits
 * correctly). `orgId`/`userId` come from the session, never the payload;
 * `ip`/`userAgent` from the request headers, never the body.
 */
export interface BillingActor {
  readonly userId: string;
  readonly orgId: string;
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
}

// ── Shared fragments ─────────────────────────────────────────────────────────

/** A metered limit and how much of it the current period has consumed. */
export interface MeteredLimit {
  /** Limit key, as it appears in `SubscriptionLimits` (e.g. `postsPerMonth`). */
  readonly key: string;
  readonly allowed: number;
  readonly used: number;
  readonly remaining: number;
  /** Percent of `allowed` consumed (0–100+, rounded to one decimal). */
  readonly percentUsed: number;
  /** True at/over the alert threshold (`USAGE_ALERT_PERCENT`). */
  readonly alert: boolean;
  /** True when used >= allowed — the gated-action check for the UI. */
  readonly exceeded: boolean;
}

// ── Plans (platform-global catalog) ──────────────────────────────────────────

/** What the plan catalog shows (the prices are integer minor units). */
export interface PlanView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly tagline?: string | undefined;
  /** Product line this plan sells (`social` | `fashion`). */
  readonly productType: string;
  readonly pricingModel: string;
  /** The plan's currency (integer minor units: kobo for NGN, cents for USD). */
  readonly currency: string;
  readonly priceMonthly: number | null;
  readonly priceQuarterly: number | null;
  readonly priceAnnual: number | null;
  readonly setupFee: number;
  readonly hasFreeTrial: boolean;
  readonly trialDays: number;
  readonly minimumSeats: number | null;
  readonly maximumSeats: number | null;
  readonly allowNewSignups: boolean;
  readonly isFeatured: boolean;
  readonly isPopular: boolean;
  readonly requiresSalesContact: boolean;
  readonly minimumCommitmentMonths: number | null;
  readonly features: PlanFeatures;
  readonly createdAt: string;
}

/**
 * The admin (platform) view of a plan: the public view plus the lifecycle
 * state only plan management needs. `features` carries the product line and
 * the feature/limit map (the plans table stores the line inside the jsonb).
 */
export interface AdminPlanView extends PlanView {
  readonly status: string;
  readonly archivedAt?: string | undefined;
  readonly publishedAt?: string | undefined;
  readonly version: number;
}

/**
 * Plan creation input (platform admin, NWB-P13-001). Money fields are
 * integer minor units; `features` must carry the product line plus the
 * feature/limit map for that line (semantic check in the service).
 */
export interface CreatePlanInput {
  readonly name: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly tagline?: string | undefined;
  readonly tier: string;
  readonly pricingModel: "flat_rate" | "usage_based" | "tiered";
  readonly currency: "USD" | "EUR" | "GBP" | "NGN" | "KES" | "GHS" | "ZAR";
  readonly priceMonthly?: number | null | undefined;
  readonly priceQuarterly?: number | null | undefined;
  readonly priceAnnual?: number | null | undefined;
  readonly setupFee?: number | undefined;
  readonly hasFreeTrial?: boolean | undefined;
  readonly trialDays?: number | undefined;
  readonly minimumSeats?: number | null | undefined;
  readonly maximumSeats?: number | null | undefined;
  readonly allowNewSignups?: boolean | undefined;
  readonly isPublic?: boolean | undefined;
  readonly isFeatured?: boolean | undefined;
  readonly isPopular?: boolean | undefined;
  readonly requiresSalesContact?: boolean | undefined;
  readonly minimumCommitmentMonths?: number | null | undefined;
  /** `{ productType, …feature map }` — shape-checked at the edge, semantically in the service. */
  readonly features: PlanFeatures;
}

/** Plan update input — every field optional (partial update, no version gate in v1). */
export interface UpdatePlanInput {
  readonly name?: string | undefined;
  readonly displayName?: string | undefined;
  readonly description?: string | null | undefined;
  readonly tagline?: string | null | undefined;
  readonly pricingModel?: "flat_rate" | "usage_based" | "tiered" | undefined;
  readonly priceMonthly?: number | null | undefined;
  readonly priceQuarterly?: number | null | undefined;
  readonly priceAnnual?: number | null | undefined;
  readonly setupFee?: number | undefined;
  readonly hasFreeTrial?: boolean | undefined;
  readonly trialDays?: number | undefined;
  readonly minimumSeats?: number | null | undefined;
  readonly maximumSeats?: number | null | undefined;
  readonly allowNewSignups?: boolean | undefined;
  readonly isPublic?: boolean | undefined;
  readonly isFeatured?: boolean | undefined;
  readonly isPopular?: boolean | undefined;
  readonly requiresSalesContact?: boolean | undefined;
  readonly minimumCommitmentMonths?: number | null | undefined;
  readonly features?: PlanFeatures | undefined;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

/** The subscription as the API presents it (amounts in minor units). */
export interface SubscriptionView {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly isActive: boolean;
  readonly isTrialing: boolean;
  readonly planId: string;
  readonly plan: PlanSnapshot;
  readonly seats: number;
  readonly includedSeats: number;
  readonly additionalSeats: number;
  readonly basePrice: number;
  readonly totalPrice: number;
  readonly currency: string;
  readonly billingCycle: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly startedAt: string;
  readonly activatedAt?: string | undefined;
  readonly trialEndsAt?: string | undefined;
  readonly renewsAt?: string | undefined;
  readonly autoRenew: boolean;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly paymentFailureCount: number;
  readonly nextPaymentAt?: string | undefined;
  readonly nextPaymentAmount?: number | undefined;
  readonly limits: SubscriptionLimits;
  readonly usage: SubscriptionUsage | null;
  readonly overageStatus: OverageStatus | null;
  readonly paymentMethod?: PaymentMethodDetails | undefined;
  readonly createdAt: string;
}

export interface CreateSubscriptionInput {
  readonly planId: string;
  /** `monthly` | `quarterly` | `annual` — the price column billed. */
  readonly billingCycle: "monthly" | "quarterly" | "annual";
  /** Seats requested; defaults to the plan minimum (or 1). */
  readonly seats?: number | undefined;
  /**
   * Request the plan's free trial when it has one (manual activation — the
   * subscription is created in `trial` state and activates when the trial
   * ends; the activation tick is NWB-P13-004's job).
   */
  readonly startTrial?: boolean | undefined;
}

export interface CancelSubscriptionInput {
  /**
   * `true` — keep service until the period end (`cancelAtPeriodEnd`);
   * `false` — end it now (`endedAt = now`, status `cancelled`).
   */
  readonly atPeriodEnd: boolean;
  readonly reason?: SubscriptionCancelReason | undefined;
}

export interface SubscriptionPage {
  readonly items: SubscriptionView[];
  readonly pageInfo: {
    readonly cursor: string | null;
    readonly hasMore: boolean;
  };
}

// ── Invoices ─────────────────────────────────────────────────────────────────

/**
 * A line on the invoice's statement — mirrors the `line_items` jsonb shape in
 * `db/billing/invoices.ts` (single owner: the db file; this is the read view).
 */
export interface InvoiceLineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
  readonly type: "subscription" | "addon" | "overage" | "one_time" | "credit" | "adjustment";
  readonly taxRate?: number | undefined;
  readonly taxAmount?: number | undefined;
  readonly discount?: number | undefined;
  readonly discountAmount?: number | undefined;
  readonly productId?: string | undefined;
  readonly priceId?: string | undefined;
  readonly period?: { start: string; end: string } | undefined;
  readonly prorated?: boolean | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface InvoiceView {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly displayNumber: string | null;
  readonly type: string;
  readonly status: string;
  readonly subscriptionId?: string | undefined;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly amountRemaining: number;
  readonly currency: string;
  readonly invoiceDate: string;
  readonly dueDate?: string | undefined;
  readonly paidAt?: string | undefined;
  readonly lineItems: InvoiceLineItem[];
  readonly paymentAttempts: number;
  readonly lastPaymentError?: string | undefined;
  readonly version: number;
  /** Creation timestamp — the keyset cursor's sort value for invoice lists. */
  readonly createdAt: string;
}

export interface PayInvoiceInput {
  /** The (processor-token-backed) method to charge. */
  readonly paymentMethodId: string;
  /**
   * Client-chosen idempotency token: replaying the same pay request with the
   * same key returns the original payment instead of charging twice.
   */
  readonly idempotencyKey?: string | undefined;
}

export interface InvoicePage {
  readonly items: InvoiceView[];
  readonly pageInfo: {
    readonly cursor: string | null;
    readonly hasMore: boolean;
  };
}

// ── Payment methods (masked — never raw PAN data) ────────────────────────────

export interface PaymentMethodView {
  readonly id: string;
  readonly kind: string;
  readonly nickname?: string | undefined;
  readonly isDefault: boolean;
  readonly isPrimary: boolean;
  readonly processor?: string | undefined;
  readonly processorPaymentMethodId?: string | undefined;
  readonly brand?: string | undefined;
  /** Card last four / account last four — the display fragment, never more. */
  readonly last4?: string | undefined;
  readonly expMonth?: number | undefined;
  readonly expYear?: number | undefined;
  readonly isVerified: boolean;
  readonly riskLevel?: string | undefined;
  readonly lastUsedAt?: string | undefined;
  readonly expiresAt?: string | undefined;
  readonly createdAt: string;
}

export interface AddPaymentMethodInput {
  readonly kind: "card" | "bank_account" | "ussd";
  readonly nickname?: string | undefined;
  readonly isDefault?: boolean | undefined;
  /**
   * Processor-issued token (Paystack/Stripe card token or bank/ussd
   * reference). Required: a method without a token cannot be charged, and
   * raw card data is never accepted (PCI scope stays at the processor).
   */
  readonly processorPaymentMethodId: string;
  readonly processor?: PaymentProcessor | undefined;
  readonly brand?: CardBrand | undefined;
  readonly last4?: string | undefined;
  readonly expMonth?: number | undefined;
  readonly expYear?: number | undefined;
}

export interface UpdatePaymentMethodInput {
  /** `null` clears the nickname. */
  readonly nickname?: string | null | undefined;
  readonly isDefault?: boolean | undefined;
}

// ── Transactions (ledger) ────────────────────────────────────────────────────

export interface TransactionView {
  readonly id: string;
  readonly transactionNumber: string;
  readonly type: string;
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  readonly balanceImpact: number;
  readonly invoiceId?: string | undefined;
  readonly subscriptionId?: string | undefined;
  readonly description?: string | undefined;
  readonly transactionDate: string;
  readonly processedAt?: string | undefined;
  readonly settledAt?: string | undefined;
  /** Creation timestamp — the keyset cursor's sort value for ledger lists. */
  readonly createdAt: string;
}

export interface TransactionPage {
  readonly items: TransactionView[];
  readonly pageInfo: {
    readonly cursor: string | null;
    readonly hasMore: boolean;
  };
}

// ── Usage & entitlements ─────────────────────────────────────────────────────

/**
 * The organization's current standing against its plan: the resolved
 * entitlement switches plus every metered limit with its consumption. This is
 * what a gated feature check renders ("upgrade prompt" — roadmap §16 exit).
 */
export interface EntitlementsView {
  /** No active subscription: every gate closed. */
  readonly hasSubscription: boolean;
  readonly planSlug?: string | undefined;
  readonly planName?: string | undefined;
  /** Boolean entitlement switches resolved from the plan features. */
  readonly features: Record<string, boolean>;
  /** Metered limits with consumption for the current period. */
  readonly limits: MeteredLimit[];
  /** Pending overage for the period, in minor units. */
  readonly pendingOverage: number;
}
