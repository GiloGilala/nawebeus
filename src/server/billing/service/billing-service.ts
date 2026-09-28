/**
 * Billing domain service (NWB-P13-001).
 *
 * Slot 3 of the domain module pattern — the single business-logic layer for
 * the billing domain, shared by both entry points: the functions slot
 * (TanStack Start server functions, in-process web calls) and the route slot
 * (Hono `/api/billing/*` for mobile/webhooks). Neither entry point owns
 * billing logic; both validate shape at the edge and delegate everything
 * here.
 *
 * Contract (per the domain module pattern, repo-native):
 * - semantic validation lives here (plan exists and accepts signups, invoice
 *   is payable, method is chargeable, one-active-per-org) — the edge only
 *   proves the shape;
 * - the actor travels with the call (`BillingActor`) and is never read from
 *   the payload: `orgId`/`userId` scope every read, `ip`/`userAgent` feed the
 *   audit row;
 * - every logger call carries the request's correlation id;
 * - a not-found lookup warns before it throws, so a 404 is findable in the
 *   same log stream as the request;
 * - money-moving and multi-row writes are atomic (`withAtomicWrites`),
 *   counters and guarded state transitions use single statements, and the
 *   one-active-per-org create path holds an advisory lock;
 * - non-fatal side-effect failures surface as `warnings` on the result (the
 *   envelope carries them in `meta`), never as silent drops or 500s.
 *
 * Scope (NWB-P13-001): platform-global plan catalog, manual-activation
 * subscriptions, one-active-per-org, invoice payment (record-and-reconcile;
 * processor round-trips are NWB-P13-002), payment methods by processor
 * token, ledger reads, usage/entitlement resolution. Invoice *creation* and
 * dunning are the billing-run worker's job (NWB-P13-004).
 */

import { invoices, paymentMethods, payments, plans, subscriptions, transactions } from "@db/schema";
import type { SQLWrapper } from "drizzle-orm";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { BillingStateError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { buildPage, type CursorPayload, type Page } from "@/lib/pagination";
import { currentRequestId } from "@/lib/request-context";
import { type DbOrTx, withAtomicWrites } from "@/lib/transaction";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  CANCELLABLE_SUBSCRIPTION_STATUSES,
  MAX_TRIAL_DAYS,
  PAYABLE_INVOICE_STATUSES,
  SUBSCRIPTION_CREATE_LOCK_PREFIX,
  USAGE_ALERT_PERCENT,
} from "@/server/billing/constants/billing-constant";
import type {
  AddPaymentMethodInput,
  BillingActor,
  BillingTransactionStatus,
  BillingTransactionType,
  CancelSubscriptionInput,
  CreateSubscriptionInput,
  EntitlementsView,
  InvoicePage,
  InvoiceStatus,
  InvoiceType,
  InvoiceView,
  MeteredLimit,
  PayInvoiceInput,
  PaymentMethodView,
  PlanView,
  SubscriptionView,
  TransactionView,
  UpdatePaymentMethodInput,
} from "@/server/billing/types/billing-types";
import type { PlanFeatures } from "@/server/billing/types/plan-types";
import type {
  NotificationSettings,
  OverageStatus,
  PlanSnapshot,
  SubscriptionLimits,
  SubscriptionUsage,
} from "@/server/billing/types/subscription-types";
import { writeAuditLog } from "@/services/audit";

// ── Row shapes (what the tables hand back) ───────────────────────────────────

type PlanRow = typeof plans.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PaymentMethodRow = typeof paymentMethods.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;

// ── Small shared helpers (module-private — the bundle rule keeps the
//    functions/route slots from importing service internals) ──────────────────

function logContext(extra?: Record<string, unknown>): Record<string, unknown> {
  const requestId = currentRequestId();
  return { ...(requestId !== undefined ? { requestId } : {}), ...extra };
}

/**
 * `payments.payment_method_details.card.brand` is the processor-agnostic
 * snapshot set; `payment_methods.card_brand` is the Nigerian-market set
 * (verve included). Map at the snapshot boundary — a brand the snapshot set
 * has no name for records as `unknown` rather than being silently dropped.
 */
const CARD_BRAND_SNAPSHOT: Record<
  "visa" | "mastercard" | "verve" | "amex" | "other",
  "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay" | "unknown"
> = {
  visa: "visa",
  mastercard: "mastercard",
  verve: "unknown",
  amex: "amex",
  other: "unknown",
};

/** Add one billing cycle to a date (monthly/quarterly/annual). */
function addCycle(date: Date, cycle: "monthly" | "quarterly" | "annual"): Date {
  const out = new Date(date);
  if (cycle === "monthly") out.setMonth(out.getMonth() + 1);
  else if (cycle === "quarterly") out.setMonth(out.getMonth() + 3);
  else out.setFullYear(out.getFullYear() + 1);
  return out;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Cursor predicate for `(created_at, id) DESC` listings: the keyset
 * comparison that makes deep pages O(limit) regardless of concurrent writes
 * (see `@/lib/pagination`). Takes the *table* (its `createdAt`/`id` columns
 * are interpolated as SQL values by drizzle's `sql` template), not a row.
 */
function cursorPredicate(
  table: { createdAt: SQLWrapper; id: SQLWrapper },
  cursor: CursorPayload | null,
) {
  if (cursor === null) return undefined;
  return sql`(${table.createdAt}, ${table.id}) < (${cursor.v}::timestamptz, ${cursor.id})`;
}

// ── Entitlement projection ───────────────────────────────────────────────────

const FASHION_LIMIT_PAIRS: Array<{ limitKey: string; usageKey: string; scale?: number }> = [
  { limitKey: "maxClients", usageKey: "clientsCreated" },
  { limitKey: "maxMeasurements", usageKey: "measurementsTaken" },
  { limitKey: "maxPatternsPerMonth", usageKey: "patternsGenerated" },
  { limitKey: "maxProjects", usageKey: "projectsCreated" },
  { limitKey: "maxTeamMembers", usageKey: "teamMembersActive" },
];

const SOCIAL_LIMIT_PAIRS: Array<{ limitKey: string; usageKey: string; scale?: number }> = [
  { limitKey: "socialAccounts", usageKey: "socialAccounts" },
  { limitKey: "postsPerMonth", usageKey: "postsThisMonth" },
  { limitKey: "scheduledPosts", usageKey: "scheduledPosts" },
  { limitKey: "teamMembers", usageKey: "activeTeamMembers" },
  { limitKey: "aiGenerations", usageKey: "aiGenerationsUsed" },
  { limitKey: "customReports", usageKey: "reportsGenerated" },
  { limitKey: "storageGB", usageKey: "storageUsedMB", scale: 1024 }, // MB used vs GB allowed
  { limitKey: "apiCallsPerMonth", usageKey: "apiCallsThisMonth" },
  { limitKey: "keywordTracking", usageKey: "keywordsTracked" },
  { limitKey: "savedReplies", usageKey: "savedReplies" },
];

/**
 * Project a plan's feature map onto the subscription's hard limits (the
 * immutable-at-creation snapshot that gating checks against).
 */
function deriveLimitsFromFeatures(features: PlanFeatures): SubscriptionLimits {
  if (features.productType === "fashion" && features.fashion) {
    const f = features.fashion;
    // Social fields are zero (the shape is shared; the pair lists select
    // which side of the union actually meters).
    return {
      productType: "fashion",
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
      maxClients: f.maxClients,
      maxMeasurements: f.maxMeasurements,
      maxPatternsPerMonth: f.maxPatternsPerMonth,
      maxProjects: f.maxProjects,
      maxTeamMembers: f.maxTeamMembers,
    };
  }
  const s = features.social ?? ({} as NonNullable<PlanFeatures["social"]>);
  return {
    productType: "social",
    socialAccounts: s.socialAccounts ?? 0,
    postsPerMonth: s.postsPerMonth ?? 0,
    scheduledPosts: s.scheduledPosts ?? 0,
    teamMembers: s.teamMembers ?? 0,
    aiGenerations: s.aiGenerations ?? 0,
    customReports: s.customReports ?? 0,
    storageGB: s.storageGB ?? 0,
    apiCallsPerMonth: s.apiCallsPerMonth ?? 0,
    keywordTracking: s.keywordTracking ?? 0,
    savedReplies: s.savedReplies ?? 0,
  };
}

/**
 * Resolve the org's current standing: entitlement switches + every metered
 * limit with consumption (the "gated action blocked + upgrade prompt" check,
 * roadmap §16).
 */
function meteredLimits(
  limits: SubscriptionLimits,
  usage: SubscriptionUsage | null,
): MeteredLimit[] {
  const pairs = limits.productType === "fashion" ? FASHION_LIMIT_PAIRS : SOCIAL_LIMIT_PAIRS;
  const limitsAsRecord = limits as unknown as Record<string, number | undefined>;
  return pairs.map(({ limitKey, usageKey, scale = 1 }) => {
    const allowed = Number(limitsAsRecord[limitKey] ?? 0);
    const usageRecord = usage as unknown as Record<string, unknown> | null;
    const rawUsed = usage ? Number(usageRecord?.[usageKey] ?? 0) : 0;
    const used = Math.max(0, Math.floor(rawUsed / scale));
    const remaining = Math.max(0, allowed - used);
    const percentUsed =
      allowed <= 0 ? (used > 0 ? 100 : 0) : Math.round((used / allowed) * 1000) / 10;
    return {
      key: limitKey,
      allowed,
      used,
      remaining,
      percentUsed,
      alert: allowed > 0 && percentUsed >= USAGE_ALERT_PERCENT,
      exceeded: allowed > 0 && used >= allowed,
    };
  });
}

/** Boolean entitlement switches from the plan features (fashion: none). */
function entitlementFeatures(features: PlanFeatures): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (features.productType === "social" && features.social) {
    for (const [k, v] of Object.entries(features.social)) {
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

// ── View mappers ─────────────────────────────────────────────────────────────

function toPlanView(row: PlanRow): PlanView {
  const features = row.features as PlanFeatures;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayName: row.displayName,
    ...(row.description ? { description: row.description } : {}),
    ...(row.tagline ? { tagline: row.tagline } : {}),
    productType: features.productType,
    pricingModel: row.pricingModel,
    currency: row.currency,
    priceMonthly: row.priceMonthly,
    priceQuarterly: row.priceQuarterly,
    priceAnnual: row.priceAnnual,
    setupFee: row.setupFee ?? 0,
    hasFreeTrial: row.hasFreeTrial,
    trialDays: row.trialDays ?? 0,
    minimumSeats: row.minimumSeats,
    maximumSeats: row.maximumSeats,
    allowNewSignups: row.allowNewSignups,
    isFeatured: row.isFeatured,
    isPopular: row.isPopular,
    requiresSalesContact: row.requiresSalesContact,
    minimumCommitmentMonths: row.minimumCommitmentMonths,
    features: row.features,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSubscriptionView(row: SubscriptionRow): SubscriptionView {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    isActive: row.isActive,
    isTrialing: row.isTrialing,
    planId: row.planId,
    plan: row.planSnapshot,
    seats: row.seats,
    includedSeats: row.includedSeats,
    additionalSeats: row.additionalSeats,
    basePrice: row.basePrice,
    totalPrice: row.totalPrice,
    currency: row.currency,
    billingCycle: row.billingCycle,
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd.toISOString(),
    startedAt: row.startedAt.toISOString(),
    ...(row.activatedAt ? { activatedAt: row.activatedAt.toISOString() } : {}),
    ...(row.trialEndsAt ? { trialEndsAt: row.trialEndsAt.toISOString() } : {}),
    ...(row.renewsAt ? { renewsAt: row.renewsAt.toISOString() } : {}),
    autoRenew: row.autoRenew,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    ...(row.canceledAt ? { canceledAt: row.canceledAt.toISOString() } : {}),
    ...(row.cancellationReason ? { cancellationReason: row.cancellationReason } : {}),
    paymentFailureCount: row.paymentFailureCount,
    ...(row.nextPaymentAt ? { nextPaymentAt: row.nextPaymentAt.toISOString() } : {}),
    ...(row.nextPaymentAmount !== null && row.nextPaymentAmount !== undefined
      ? { nextPaymentAmount: row.nextPaymentAmount }
      : {}),
    limits: row.limits,
    usage: row.usage,
    overageStatus: row.overageStatus,
    ...(row.paymentMethodDetails ? { paymentMethod: row.paymentMethodDetails } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function toInvoiceView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    displayNumber: row.displayNumber,
    type: row.type,
    status: row.status,
    ...(row.subscriptionId ? { subscriptionId: row.subscriptionId } : {}),
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    total: row.total,
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    amountRemaining: row.amountRemaining,
    currency: row.currency,
    invoiceDate: row.invoiceDate.toISOString(),
    ...(row.dueDate ? { dueDate: row.dueDate.toISOString() } : {}),
    ...(row.paidAt ? { paidAt: row.paidAt.toISOString() } : {}),
    lineItems: row.lineItems,
    paymentAttempts: row.paymentAttempts,
    ...(row.lastPaymentError ? { lastPaymentError: row.lastPaymentError } : {}),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPaymentMethodView(row: PaymentMethodRow): PaymentMethodView {
  return {
    id: row.id,
    kind: row.type,
    ...(row.nickname ? { nickname: row.nickname } : {}),
    isDefault: row.isDefault,
    isPrimary: row.isPrimary,
    processor: row.processorType,
    ...(row.processorPaymentMethodId
      ? { processorPaymentMethodId: row.processorPaymentMethodId }
      : {}),
    ...(row.cardBrand ? { brand: row.cardBrand } : {}),
    ...(row.cardLast4 ? { last4: row.cardLast4 } : {}),
    ...(row.cardExpMonth ? { expMonth: row.cardExpMonth } : {}),
    ...(row.cardExpYear ? { expYear: row.cardExpYear } : {}),
    isVerified: row.isVerified,
    ...(row.riskLevel ? { riskLevel: row.riskLevel } : {}),
    ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function toTransactionView(row: TransactionRow): TransactionView {
  return {
    id: row.id,
    transactionNumber: row.transactionNumber,
    type: row.type,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    balanceImpact: row.balanceImpact,
    ...(row.invoiceId ? { invoiceId: row.invoiceId } : {}),
    ...(row.subscriptionId ? { subscriptionId: row.subscriptionId } : {}),
    ...(row.description ? { description: row.description } : {}),
    transactionDate: row.transactionDate.toISOString(),
    ...(row.processedAt ? { processedAt: row.processedAt.toISOString() } : {}),
    ...(row.settledAt ? { settledAt: row.settledAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Loaders (warn before 404, per the pattern) ───────────────────────────────

async function loadPlanRow(db: DbOrTx, planId: string): Promise<PlanRow> {
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), isNull(plans.archivedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    logger.warn("billing: plan not found", logContext({ planId }));
    throw new NotFoundError("Plan not found");
  }
  return row;
}

async function loadSubscriptionRow(
  db: DbOrTx,
  orgId: string,
  id: string,
): Promise<SubscriptionRow> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.id, id),
        eq(subscriptions.organizationId, orgId),
        isNull(subscriptions.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    logger.warn("billing: subscription not found", logContext({ orgId, subscriptionId: id }));
    throw new NotFoundError("Subscription not found");
  }
  return row;
}

async function loadInvoiceRow(db: DbOrTx, orgId: string, id: string): Promise<InvoiceRow> {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId), isNull(invoices.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    logger.warn("billing: invoice not found", logContext({ orgId, invoiceId: id }));
    throw new NotFoundError("Invoice not found");
  }
  return row;
}

async function loadPaymentMethodRow(
  db: DbOrTx,
  orgId: string,
  id: string,
): Promise<PaymentMethodRow> {
  const rows = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.organizationId, orgId),
        isNull(paymentMethods.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    logger.warn("billing: payment method not found", logContext({ orgId, paymentMethodId: id }));
    throw new NotFoundError("Payment method not found");
  }
  return row;
}

/** Advisory-lock key prefix for the pay-invoice path (double-pay guard). */
const INVOICE_PAY_LOCK_PREFIX = "nawebeus:billing:invoice:";

/**
 * The organization's single active subscription (the one holding the
 * one-active-per-org slot), most recent first.
 */
async function loadActiveSubscriptionRow(
  db: DbOrTx,
  orgId: string,
): Promise<SubscriptionRow | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, orgId),
        inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
        isNull(subscriptions.deletedAt),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ── Plans (platform-global catalog) ──────────────────────────────────────────

export async function listPlans(
  db: Db,
  opts: {
    limit: number;
    cursor: CursorPayload | null;
  },
): Promise<Page<PlanView>> {
  // The catalog: published, active, accepting signups (platform-global —
  // no org scoping on plans, NWB-P13-001).
  const where = and(
    eq(plans.status, "active"),
    eq(plans.isPublic, true),
    eq(plans.allowNewSignups, true),
    isNull(plans.archivedAt),
    cursorPredicate(plans, opts.cursor),
  );
  const rows = await db
    .select()
    .from(plans)
    .where(where)
    .orderBy(desc(plans.createdAt), desc(plans.id))
    .limit(opts.limit + 1);
  const viewRows = rows.map(toPlanView);
  return buildPage(viewRows, opts.limit, (row) => row.createdAt);
}

export async function getPlan(db: Db, planId: string): Promise<PlanView> {
  const row = await loadPlanRow(db, planId);
  if (!row.isPublic || !row.allowNewSignups) {
    logger.warn("billing: plan not subscribable", logContext({ planId }));
    throw new BillingStateError(
      "PLAN_NOT_SUBSCRIBABLE",
      "This plan is not accepting new subscriptions",
    );
  }
  return toPlanView(row);
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function listSubscriptions(
  db: Db,
  opts: { orgId: string; limit: number; cursor: CursorPayload | null },
): Promise<Page<SubscriptionView>> {
  const where = and(
    eq(subscriptions.organizationId, opts.orgId),
    isNull(subscriptions.deletedAt),
    cursorPredicate(subscriptions, opts.cursor),
  );
  const rows = await db
    .select()
    .from(subscriptions)
    .where(where)
    .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
    .limit(opts.limit + 1);
  const viewRows = rows.map(toSubscriptionView);
  return buildPage(viewRows, opts.limit, (row) => row.createdAt);
}

export async function getSubscription(
  db: Db,
  orgId: string,
  id: string,
): Promise<SubscriptionView> {
  const row = await loadSubscriptionRow(db, orgId, id);
  return toSubscriptionView(row);
}

export async function createSubscription(
  db: Db,
  actor: BillingActor,
  input: CreateSubscriptionInput,
): Promise<{ subscription: SubscriptionView; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    // Semantic: the plan exists, is public, and accepts signups.
    const plan = await loadPlanRow(tx, input.planId);
    if (!plan.isPublic || !plan.allowNewSignups) {
      throw new BillingStateError(
        "PLAN_NOT_SUBSCRIBABLE",
        "This plan is not accepting new subscriptions",
        { planId: plan.id },
      );
    }

    // Semantic: the requested cycle is priced on this plan.
    const price =
      input.billingCycle === "monthly"
        ? plan.priceMonthly
        : input.billingCycle === "quarterly"
          ? plan.priceQuarterly
          : plan.priceAnnual;
    if (price === null) {
      throw new ValidationError(`This plan does not offer ${input.billingCycle} billing`, [
        { field: "billingCycle", message: `Plan has no ${input.billingCycle} price` },
      ]);
    }
    const currency = plan.currency;
    const features = plan.features as PlanFeatures;

    // Semantic: seats within the plan's bounds (default: plan minimum or 1).
    const minSeats = plan.minimumSeats ?? 1;
    const maxSeats = plan.maximumSeats ?? minSeats;
    const seats = input.seats ?? minSeats;
    if (seats < minSeats || seats > maxSeats) {
      throw new ValidationError("Seat count outside plan bounds", [
        { field: "seats", message: `Must be between ${minSeats} and ${maxSeats}` },
      ]);
    }

    // Trial request must be offered by the plan (no silent activation).
    if (input.startTrial && (!plan.hasFreeTrial || (plan.trialDays ?? 0) <= 0)) {
      throw new ValidationError("This plan offers no free trial", [
        { field: "startTrial", message: "Plan has no free trial" },
      ]);
    }

    // One-active-per-org: serialize the check-then-insert on an advisory
    // lock keyed by org so two concurrent creates cannot both pass the
    // check (roadmap §16 concurrency note).
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${SUBSCRIPTION_CREATE_LOCK_PREFIX + actor.orgId}))`,
    );
    const existing = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, actor.orgId),
          inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
          isNull(subscriptions.deletedAt),
        ),
      )
      .limit(1);
    const existingRow = existing[0];
    if (existingRow) {
      logger.warn(
        "billing: active subscription already exists",
        logContext({
          orgId: actor.orgId,
          existingSubscriptionId: existingRow.id,
        }),
      );
      throw new BillingStateError(
        "ACTIVE_SUBSCRIPTION_EXISTS",
        "This organization already has an active subscription",
        { existingSubscriptionId: existingRow.id },
      );
    }

    const startTrial = input.startTrial === true && plan.hasFreeTrial && (plan.trialDays ?? 0) > 0;
    const now = new Date();
    const trialDays = Math.min(plan.trialDays ?? 0, MAX_TRIAL_DAYS);
    const periodEnd = addCycle(now, input.billingCycle);

    const limits = deriveLimitsFromFeatures(features);
    const usage: SubscriptionUsage = {
      productType: limits.productType,
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
      lastReset: now,
      lastUpdated: now,
    };
    const overageStatus: OverageStatus = {
      hasOverage: false,
      totalOverage: 0,
      overageCharges: [],
      lastOverageCheck: now,
      nextOverageCheck: now,
      totalPendingOverage: 0,
      lastChecked: now,
    };
    const notificationSettings: NotificationSettings = {
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
    const planSnapshot: PlanSnapshot = {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      tier: plan.tier,
      pricingModel: plan.pricingModel,
      priceMonthly: plan.priceMonthly,
      priceAnnual: plan.priceAnnual,
      priceQuarterly: plan.priceQuarterly,
      currency,
      features,
    };

    const inserted = await tx
      .insert(subscriptions)
      .values({
        type: "organization",
        userId: actor.userId,
        organizationId: actor.orgId,
        productType: features.productType,
        planId: plan.id,
        planSnapshot,
        billingCycle: input.billingCycle,
        basePrice: price,
        additionalSeatsPrice: 0,
        addonsCost: 0,
        discountAmount: 0,
        totalPrice: price,
        currency,
        seats,
        includedSeats: seats,
        additionalSeats: 0,
        seatPrice: 0,
        status: startTrial ? "trial" : "active",
        isActive: true,
        isTrialing: startTrial,
        ...(startTrial ? { trialStartsAt: now, trialEndsAt: addDays(now, trialDays) } : {}),
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
        ...(startTrial ? {} : { activatedAt: now }),
        autoRenew: true,
        limits,
        usage,
        overageStatus,
        notificationSettings,
        billingHistory: [
          {
            at: now,
            type: startTrial ? "trial.started" : "subscription.activated",
            amount: price,
            currency,
            description: `Subscribed to ${plan.displayName} (${input.billingCycle}, ${seats} seat${seats === 1 ? "" : "s"})`,
          },
        ],
        changeHistory: [{ at: now, changedBy: actor.userId, change: "created" }],
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      // Unreachable in practice (the insert either returns the row or throws);
      // the guard keeps `row` non-optional for every use below.
      throw new Error("Subscription could not be read back after it was created");
    }

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: actor.orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.subscription.created",
      resourceId: row.id,
      afterState: {
        planId: plan.id,
        billingCycle: input.billingCycle,
        seats,
        status: row.status,
        totalPrice: price,
        currency,
      },
    });

    logger.info(
      "billing: subscription created",
      logContext({
        orgId: actor.orgId,
        subscriptionId: row.id,
        planId: plan.id,
        billingCycle: input.billingCycle,
        startTrial,
      }),
    );

    return {
      subscription: toSubscriptionView(row),
      warnings: [],
    };
  });
}

export async function cancelSubscription(
  db: Db,
  actor: BillingActor,
  orgId: string,
  id: string,
  input: CancelSubscriptionInput,
): Promise<{ subscription: SubscriptionView; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    const row = await loadSubscriptionRow(tx, orgId, id);

    if (!(CANCELLABLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status)) {
      throw new BillingStateError(
        "SUBSCRIPTION_NOT_CANCELLABLE",
        `A ${row.status} subscription cannot be canceled`,
        { status: row.status },
      );
    }

    const now = new Date();
    const immediate = !input.atPeriodEnd;
    const updates: Partial<typeof subscriptions.$inferInsert> = {
      autoRenew: false,
      canceledAt: now,
      ...(input.reason ? { cancellationReason: input.reason } : {}),
      canceledBy: actor.userId,
      changeHistory: [
        ...(row.changeHistory ?? []),
        {
          at: now,
          changedBy: actor.userId,
          change: immediate ? "canceled" : "cancel_scheduled",
          previousValue: row.status,
          newValue: immediate ? "cancelled" : row.status,
        },
      ],
    };
    if (immediate) {
      updates.status = "cancelled";
      updates.isActive = false;
      updates.endedAt = now;
      updates.cancellationEffectiveDate = now;
    } else {
      updates.cancelAtPeriodEnd = true;
      updates.cancellationEffectiveDate = row.currentPeriodEnd;
    }

    const updatedRows = await tx
      .update(subscriptions)
      .set(updates)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.organizationId, orgId)))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      // The row was loaded inside this same transaction a few lines above,
      // so a zero-row update means it vanished concurrently.
      throw new Error("Subscription disappeared before the cancellation could be recorded");
    }

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.subscription.canceled",
      resourceId: id,
      beforeState: { status: row.status },
      afterState: {
        status: updated.status,
        atPeriodEnd: !immediate,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    logger.info(
      "billing: subscription canceled",
      logContext({
        orgId,
        subscriptionId: id,
        immediate,
      }),
    );

    return { subscription: toSubscriptionView(updated), warnings: [] };
  });
}

export async function resumeSubscription(
  db: Db,
  actor: BillingActor,
  orgId: string,
  id: string,
): Promise<{ subscription: SubscriptionView; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    const row = await loadSubscriptionRow(tx, orgId, id);

    // Only a paused subscription resumes; an immediate cancel is terminal
    // (roadmap §16 cancel semantics), an at-period-end cancel is released by
    // clearing `cancelAtPeriodEnd` in a future version of this operation.
    if (row.status !== "paused") {
      throw new BillingStateError(
        "SUBSCRIPTION_NOT_RESUMABLE",
        `A ${row.status} subscription cannot be resumed`,
        { status: row.status },
      );
    }

    const now = new Date();
    const resumedRows = await tx
      .update(subscriptions)
      .set({
        status: "active",
        isActive: true,
        autoRenew: true,
        pausedAt: null,
        pausedUntil: null,
        pauseReason: null,
        changeHistory: [
          ...(row.changeHistory ?? []),
          {
            at: now,
            changedBy: actor.userId,
            change: "resumed",
            previousValue: "paused",
            newValue: "active",
          },
        ],
      })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.organizationId, orgId)))
      .returning();

    const updated = resumedRows[0];
    if (!updated) {
      throw new Error("Subscription changed before it could be resumed");
    }

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.subscription.resumed",
      resourceId: id,
      beforeState: { status: "paused" },
      afterState: { status: "active" },
    });

    return { subscription: toSubscriptionView(updated), warnings: [] };
  });
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function listInvoices(
  db: Db,
  opts: {
    orgId: string;
    status?: InvoiceStatus | null | undefined;
    type?: InvoiceType | null | undefined;
    limit: number;
    cursor: CursorPayload | null;
  },
): Promise<InvoicePage> {
  const where = and(
    eq(invoices.organizationId, opts.orgId),
    isNull(invoices.deletedAt),
    opts.status ? eq(invoices.status, opts.status) : undefined,
    opts.type ? eq(invoices.type, opts.type) : undefined,
    cursorPredicate(invoices, opts.cursor),
  );
  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(opts.limit + 1);
  const viewRows = rows.map(toInvoiceView);
  return buildPage(viewRows, opts.limit, (row) => row.createdAt);
}

export async function getInvoice(db: Db, orgId: string, id: string): Promise<InvoiceView> {
  const row = await loadInvoiceRow(db, orgId, id);
  return toInvoiceView(row);
}

export async function payInvoice(
  db: Db,
  actor: BillingActor,
  orgId: string,
  invoiceId: string,
  input: PayInvoiceInput,
): Promise<{ payment: PaymentView; idempotentReplay: boolean; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    // Serialize double-pay attempts on the invoice (advisory lock).
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${INVOICE_PAY_LOCK_PREFIX + invoiceId}))`,
    );

    const invoice = await loadInvoiceRow(tx, orgId, invoiceId);

    // Semantic: only open/overdue invoices take a payment.
    if (!(PAYABLE_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
      throw new BillingStateError(
        "INVOICE_NOT_PAYABLE",
        `An invoice in ${invoice.status} state cannot be paid`,
        { status: invoice.status },
      );
    }

    // Idempotent replay: same key, same invoice → original payment.
    if (input.idempotencyKey) {
      const prior = await tx
        .select()
        .from(payments)
        .where(
          and(eq(payments.invoiceId, invoiceId), eq(payments.idempotencyKey, input.idempotencyKey)),
        )
        .limit(1);
      const priorPayment = prior[0];
      if (priorPayment) {
        logger.info(
          "billing: pay-invoice idempotent replay",
          logContext({
            orgId,
            invoiceId,
            paymentId: priorPayment.id,
          }),
        );
        return {
          payment: toPaymentView(priorPayment),
          idempotentReplay: true,
          warnings: [
            "Idempotent replay: an earlier payment with this key is being returned, not a new charge.",
          ],
        };
      }
    }

    const method = await loadPaymentMethodRow(tx, orgId, input.paymentMethodId);
    if (!method.processorPaymentMethodId) {
      throw new BillingStateError(
        "PAYMENT_METHOD_NOT_CHARGEABLE",
        "This payment method has no processor token and cannot be charged",
      );
    }
    if (
      method.status !== "active" ||
      method.blockStatus === "blocked" ||
      method.riskLevel === "blocked"
    ) {
      throw new BillingStateError(
        "PAYMENT_METHOD_NOT_CHARGEABLE",
        `This payment method cannot be charged (status: ${method.status})`,
        { status: method.status },
      );
    }

    const now = new Date();
    const amount = Math.max(invoice.amountRemaining, 0) || invoice.total;
    const label = invoice.displayNumber ?? invoice.invoiceNumber;

    // 1) The payment (record-and-reconcile: manual activation, NWB-P13-001.
    //    The processor round-trip — token charge, signature-verified webhook —
    //    is NWB-P13-002 and will replace this direct write.)
    const insertedPayments = await tx
      .insert(payments)
      .values({
        organizationId: orgId,
        ...(invoice.subscriptionId ? { subscriptionId: invoice.subscriptionId } : {}),
        invoiceId: invoice.id,
        paymentMethodId: method.id,
        userId: actor.userId,
        // `payments` stores money as decimal(20,2) — drizzle maps decimal to
        // string — while the invoice side is integer minor units. Convert at
        // the boundary so the value round-trips exactly.
        amount: String(amount),
        currency: invoice.currency,
        subtotal: String(invoice.subtotal),
        taxAmount: String(invoice.taxAmount),
        discountAmount: String(invoice.discountAmount),
        netAmount: String(amount),
        paymentMethod: method.type,
        // Snapshot of the instrument at payment time, in the column's
        // canonical shape (db/billing/payments.ts). The processor token is
        // not part of that shape — it goes to the payment's own
        // `processor_payment_method_id` column below.
        ...(method.type === "card" &&
        method.cardBrand &&
        method.cardLast4 &&
        method.cardExpMonth &&
        method.cardExpYear
          ? {
              paymentMethodDetails: {
                card: {
                  brand: CARD_BRAND_SNAPSHOT[method.cardBrand],
                  last4: method.cardLast4,
                  expMonth: method.cardExpMonth,
                  expYear: method.cardExpYear,
                },
              },
            }
          : {}),
        ...(method.processorPaymentMethodId
          ? { processorPaymentMethodId: method.processorPaymentMethodId }
          : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        status: "succeeded",
        attemptedAt: now,
        capturedAt: now,
        succeededAt: now,
        description: `Payment for invoice ${label}`,
        ...(actor.ip ? { ipAddress: actor.ip } : {}),
      })
      .returning();

    const payment = insertedPayments[0];
    if (!payment) {
      throw new Error("Payment could not be read back after it was recorded");
    }

    // 2) The invoice transitions — one guarded statement: the WHERE carries
    //    the payable-state check, so a concurrent state change loses the race
    //    cleanly (0 rows) instead of paying a voided invoice.
    const updatedInvoices = await tx
      .update(invoices)
      .set({
        status: "paid",
        amountPaid: invoice.amountPaid + amount,
        amountRemaining: 0,
        paidAt: now,
        paymentId: payment.id,
        version: invoice.version + 1,
      })
      .where(
        and(eq(invoices.id, invoice.id), inArray(invoices.status, [...PAYABLE_INVOICE_STATUSES])),
      )
      .returning();
    if (updatedInvoices.length === 0) {
      logger.warn(
        "billing: invoice state changed during payment",
        logContext({
          orgId,
          invoiceId,
        }),
      );
      throw new BillingStateError(
        "INVOICE_NOT_PAYABLE",
        "The invoice changed state before the payment could be recorded",
      );
    }

    // 3) Subscription bookkeeping — non-fatal when the invoice is not
    //    subscription-backed (one_time, adjustment): a warning, not a drop.
    const warnings: string[] = [];
    if (invoice.subscriptionId) {
      const subRows = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.id, invoice.subscriptionId), isNull(subscriptions.deletedAt)))
        .limit(1);
      const sub = subRows[0];
      if (sub) {
        await tx
          .update(subscriptions)
          .set({
            lastPaymentAt: now,
            lastPaymentAmount: amount,
            lastPaymentStatus: "succeeded",
            paymentFailureCount: 0,
            billingHistory: [
              ...(sub.billingHistory ?? []),
              {
                at: now,
                type: "invoice.paid",
                amount,
                currency: invoice.currency,
                description: `Invoice ${label} paid`,
                reference: payment.id,
              },
            ],
          })
          .where(eq(subscriptions.id, invoice.subscriptionId));
      } else {
        warnings.push(
          "Subscription payment history was not updated: the linked subscription no longer exists.",
        );
        logger.warn(
          "billing: linked subscription missing on pay-invoice",
          logContext({
            orgId,
            invoiceId,
            subscriptionId: invoice.subscriptionId,
          }),
        );
      }
    } else {
      warnings.push("Invoice is not subscription-backed; no subscription state was updated.");
    }

    // 4) The ledger row (the audit of money, separate from the audit of
    //    actions — both are written in the same transaction).
    await tx.insert(transactions).values({
      transactionNumber: `TXN-${payment.id.replace(/-/g, "").slice(0, 42)}`,
      organizationId: orgId,
      ...(invoice.subscriptionId ? { subscriptionId: invoice.subscriptionId } : {}),
      invoiceId: invoice.id,
      paymentId: payment.id,
      initiatedBy: actor.userId,
      type: "payment",
      status: "completed",
      amount,
      currency: invoice.currency,
      netAmount: amount,
      balanceImpact: amount,
      transactionDate: now,
      processedAt: now,
      completedAt: now,
      description: `Payment for invoice ${label}`,
    });

    // 5) The audit row (evidence of the action, same transaction — an audit
    //    row must never outlive a rolled-back payment).
    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.invoice.paid",
      resourceId: invoice.id,
      afterState: {
        paymentId: payment.id,
        amount,
        currency: invoice.currency,
        paymentMethodId: method.id,
      },
    });

    logger.info(
      "billing: invoice paid",
      logContext({
        orgId,
        invoiceId,
        paymentId: payment.id,
        amount,
        currency: invoice.currency,
      }),
    );

    return { payment: toPaymentView(payment), idempotentReplay: false, warnings };
  });
}

interface PaymentView {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly succeededAt?: string | undefined;
  readonly invoiceId?: string | undefined;
  readonly paymentMethodId?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly createdAt: string;
}

function toPaymentView(row: PaymentRow): PaymentView {
  return {
    id: row.id,
    // `payments.amount` is decimal(20,2) — drizzle hands it back as a string;
    // the API view is a number (minor units on the invoice side).
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    ...(row.succeededAt ? { succeededAt: row.succeededAt.toISOString() } : {}),
    ...(row.invoiceId ? { invoiceId: row.invoiceId } : {}),
    ...(row.paymentMethodId ? { paymentMethodId: row.paymentMethodId } : {}),
    ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Payment methods ──────────────────────────────────────────────────────────

export async function listPaymentMethods(
  db: Db,
  opts: { orgId: string; limit: number; cursor: CursorPayload | null },
): Promise<Page<PaymentMethodView>> {
  const where = and(
    eq(paymentMethods.organizationId, opts.orgId),
    isNull(paymentMethods.deletedAt),
    cursorPredicate(paymentMethods, opts.cursor),
  );
  const rows = await db
    .select()
    .from(paymentMethods)
    .where(where)
    .orderBy(desc(paymentMethods.createdAt), desc(paymentMethods.id))
    .limit(opts.limit + 1);
  const viewRows = rows.map(toPaymentMethodView);
  return buildPage(viewRows, opts.limit, (row) => row.createdAt);
}

export async function addPaymentMethod(
  db: Db,
  actor: BillingActor,
  orgId: string,
  input: AddPaymentMethodInput,
): Promise<{ paymentMethod: PaymentMethodView; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    const isDefault = input.isDefault ?? false;

    // One default at a time: making the new method default demotes the old.
    if (isDefault) {
      await tx
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(
          and(
            eq(paymentMethods.organizationId, orgId),
            eq(paymentMethods.isDefault, true),
            isNull(paymentMethods.deletedAt),
          ),
        );
    }

    const insertedMethods = await tx
      .insert(paymentMethods)
      .values({
        organizationId: orgId,
        addedBy: actor.userId,
        type: input.kind,
        processorType: input.processor ?? "paystack",
        processorPaymentMethodId: input.processorPaymentMethodId,
        ...(input.nickname ? { nickname: input.nickname } : {}),
        ...(input.brand ? { cardBrand: input.brand } : {}),
        ...(input.last4 ? { cardLast4: input.last4 } : {}),
        ...(input.expMonth ? { cardExpMonth: input.expMonth } : {}),
        ...(input.expYear ? { cardExpYear: input.expYear } : {}),
        isDefault,
        isPrimary: false,
        isVerified: false,
        tokenized: true,
      })
      .returning();

    const row = insertedMethods[0];
    if (!row) {
      throw new Error("Payment method could not be read back after it was stored");
    }

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.payment_method.added",
      resourceId: row.id,
      afterState: {
        kind: row.type,
        processor: row.processorType,
        isDefault,
      },
    });

    return {
      paymentMethod: toPaymentMethodView(row),
      warnings: [
        "The method is stored but unverified; verification flows with processor integration (NWB-P13-002).",
      ],
    };
  });
}

export async function updatePaymentMethod(
  db: Db,
  actor: BillingActor,
  orgId: string,
  id: string,
  input: UpdatePaymentMethodInput,
): Promise<{ paymentMethod: PaymentMethodView; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    const row = await loadPaymentMethodRow(tx, orgId, id);

    if (input.isDefault === true && !row.isDefault) {
      await tx
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(
          and(
            eq(paymentMethods.organizationId, orgId),
            eq(paymentMethods.isDefault, true),
            isNull(paymentMethods.deletedAt),
          ),
        );
    }

    const updatedRows = await tx
      .update(paymentMethods)
      .set({
        ...(input.nickname !== undefined ? { nickname: input.nickname ?? null } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.organizationId, orgId)))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("Payment method changed before the update could be recorded");
    }

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.payment_method.updated",
      resourceId: id,
      beforeState: { nickname: row.nickname, isDefault: row.isDefault },
      afterState: {
        nickname: updated.nickname,
        isDefault: updated.isDefault,
      },
    });

    return { paymentMethod: toPaymentMethodView(updated), warnings: [] };
  });
}

export async function deletePaymentMethod(
  db: Db,
  actor: BillingActor,
  orgId: string,
  id: string,
): Promise<{ deleted: true; warnings: string[] }> {
  return withAtomicWrites(db, async (tx) => {
    const row = await loadPaymentMethodRow(tx, orgId, id);

    // The default method cannot be the last one standing without leaving the
    // org charge-less: a warning is not enough, that is a state conflict.
    const siblings = await tx
      .select({ id: paymentMethods.id, isDefault: paymentMethods.isDefault })
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.organizationId, orgId),
          isNull(paymentMethods.deletedAt),
          sql`${paymentMethods.id} != ${id}`,
        ),
      );
    const warnings: string[] = [];
    if (row.isDefault && siblings.length === 0) {
      throw new BillingStateError(
        "PAYMENT_METHOD_NOT_CHARGEABLE",
        "The only payment method cannot be deleted; add another first",
      );
    }
    const newDefault = siblings[0];
    if (row.isDefault && newDefault) {
      await tx
        .update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, newDefault.id));
      warnings.push("Another method was made the new default.");
    }

    const now = new Date();
    await tx
      .update(paymentMethods)
      .set({
        deletedAt: now,
        deletedBy: actor.userId,
        deletionReason: "user_request",
        isDefault: false,
      })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.organizationId, orgId)));

    await writeAuditLog({
      db: tx,
      module: "billing",
      organizationId: orgId,
      actorId: actor.userId,
      actorType: "user",
      ...(actor.ip ? { actorIp: actor.ip } : {}),
      ...(actor.userAgent ? { actorUserAgent: actor.userAgent } : {}),
      action: "billing.payment_method.deleted",
      resourceId: id,
      beforeState: { kind: row.type, isDefault: row.isDefault },
    });

    return { deleted: true, warnings };
  });
}

// ── Transactions (ledger) ────────────────────────────────────────────────────

export async function listTransactions(
  db: Db,
  opts: {
    orgId: string;
    type?: BillingTransactionType | null | undefined;
    status?: BillingTransactionStatus | null | undefined;
    limit: number;
    cursor: CursorPayload | null;
  },
): Promise<Page<TransactionView>> {
  const where = and(
    eq(transactions.organizationId, opts.orgId),
    opts.type ? eq(transactions.type, opts.type) : undefined,
    opts.status ? eq(transactions.status, opts.status) : undefined,
    cursorPredicate(transactions, opts.cursor),
  );
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(opts.limit + 1);
  const viewRows = rows.map(toTransactionView);
  return buildPage(viewRows, opts.limit, (row) => row.createdAt);
}

// ── Usage & entitlements ─────────────────────────────────────────────────────

export async function getEntitlements(db: Db, orgId: string): Promise<EntitlementsView> {
  const sub = await loadActiveSubscriptionRow(db, orgId);
  if (sub === null) {
    logger.debug("billing: no active subscription for entitlements", logContext({ orgId }));
    return { hasSubscription: false, features: {}, limits: [], pendingOverage: 0 };
  }

  const features = sub.planSnapshot.features as PlanFeatures;
  return {
    hasSubscription: true,
    planSlug: sub.planSnapshot.slug,
    planName: sub.planSnapshot.name,
    features: entitlementFeatures(features),
    limits: meteredLimits(sub.limits, sub.usage),
    pendingOverage: sub.overageStatus?.totalPendingOverage ?? 0,
  };
}
