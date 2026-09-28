/**
 * Billing input schemas (NWB-P13-001).
 *
 * Shape-only validation, consumed by the functions slot (server functions)
 * and the route slot (Hono API) — both validate at the edge and delegate
 * *semantic* validation (does this plan exist, is this invoice payable, is
 * this method charged-able) to the service.
 *
 * Every schema is annotated against a type from `../types/billing-types`
 * (`z.ZodType<XInput>`), so the shape and the type cannot drift apart
 * silently: the types slot owns the shapes, this file proves the shapes.
 *
 * These are leaf inputs — no domain imports other than the types slot and
 * the enum value lists (drift-free, runtime-readable).
 */

import {
  billingCyclePgEnum,
  cardBrandEnum,
  currencyPgEnum,
  paymentMethodTypeEnum,
  processorTypeEnum,
  subscriptionCancelReasonPgEnum,
  subscriptionPlanPgEnum,
} from "@db/shared/enums";
import { z } from "zod";
import {
  BILLING_ID_PATTERN,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  MONEY_MAX,
  SEATS_MAX,
} from "../constants/billing-constant";
import type {
  AddPaymentMethodInput,
  BillingTransactionStatus,
  BillingTransactionType,
  CancelSubscriptionInput,
  CreatePlanInput,
  CreateSubscriptionInput,
  InvoiceStatus,
  InvoiceType,
  PayInvoiceInput,
  UpdatePaymentMethodInput,
  UpdatePlanInput,
} from "../types/billing-types";
import type { PlanFeatures } from "../types/plan-types";

// ── Ids ──────────────────────────────────────────────────────────────────────

export const billingIdSchema: z.ZodType<string> = z
  .string()
  .regex(BILLING_ID_PATTERN, "Must be a valid billing id");

// ── Shared value lists ───────────────────────────────────────────────────────

/** Cycles a customer may subscribe on (plan pricing columns exist for all). */
export const BILLING_CYCLE_VALUES = billingCyclePgEnum.enumValues.filter((v) => v !== "one_time");

/** Cancellation reasons (the `subscription_cancel_reason` enum, verbatim). */
export const CANCEL_REASON_VALUES = subscriptionCancelReasonPgEnum.enumValues;

/** Payment-method kinds the manual-activation on-ramp accepts. */
export const PAYMENT_METHOD_KIND_VALUES = paymentMethodTypeEnum.enumValues;

/** Processors a stored method may name (the `processor_type` enum, verbatim). */
export const PROCESSOR_VALUES = processorTypeEnum.enumValues;

/** Card brands a stored method may name (the `card_brand` enum, verbatim). */
export const CARD_BRAND_VALUES = cardBrandEnum.enumValues;

// ── Subscriptions ────────────────────────────────────────────────────────────

export const createSubscriptionSchema: z.ZodType<CreateSubscriptionInput> = z
  .object({
    planId: billingIdSchema,
    billingCycle: z.enum(BILLING_CYCLE_VALUES),
    seats: z.number().int().min(1).max(SEATS_MAX).optional(),
    startTrial: z.boolean().optional(),
  })
  .strict();

export const cancelSubscriptionSchema: z.ZodType<CancelSubscriptionInput> = z
  .object({
    atPeriodEnd: z.boolean(),
    reason: z.enum(CANCEL_REASON_VALUES).optional(),
  })
  .strict();

export const listSubscriptionsQuerySchema: z.ZodType<{
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

// ── Plans ────────────────────────────────────────────────────────────────────

// (No product-line filter at the edge: the plans table carries the product
// line inside the `features` jsonb, and the catalog is small enough that a
// client-side split on `productType` is cheaper than a jsonb predicate.)
export const listPlansQuerySchema: z.ZodType<{
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

// ── Invoices ─────────────────────────────────────────────────────────────────

export const payInvoiceSchema: z.ZodType<PayInvoiceInput> = z
  .object({
    paymentMethodId: billingIdSchema,
    idempotencyKey: z.string().min(1).max(IDEMPOTENCY_KEY_MAX_LENGTH).optional(),
  })
  .strict();

export const listInvoicesQuerySchema: z.ZodType<{
  status?: InvoiceStatus | null | undefined;
  type?: InvoiceType | null | undefined;
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    status: z
      .enum(["draft", "open", "paid", "void", "uncollectible", "overdue"])
      .nullable()
      .optional(),
    type: z
      .enum(["subscription", "one_time", "overage", "addon", "credit_note", "refund", "adjustment"])
      .nullable()
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

// ── Payment methods ──────────────────────────────────────────────────────────

export const addPaymentMethodSchema: z.ZodType<AddPaymentMethodInput> = z
  .object({
    kind: z.enum(PAYMENT_METHOD_KIND_VALUES),
    nickname: z.string().min(1).max(64).optional(),
    isDefault: z.boolean().optional(),
    processorPaymentMethodId: z.string().min(1).max(256),
    processor: z.enum(PROCESSOR_VALUES).optional(),
    brand: z.enum(CARD_BRAND_VALUES).optional(),
    last4: z
      .string()
      .regex(/^[0-9]{4}$/, "Must be exactly four digits")
      .optional(),
    expMonth: z.number().int().min(1).max(12).optional(),
    expYear: z.number().int().min(2026).max(2100).optional(),
  })
  .strict();

export const updatePaymentMethodSchema: z.ZodType<UpdatePaymentMethodInput> = z
  .object({
    nickname: z.string().min(1).max(64).nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const listPaymentMethodsQuerySchema: z.ZodType<{
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

// ── Transactions ─────────────────────────────────────────────────────────────

export const listTransactionsQuerySchema: z.ZodType<{
  type?: BillingTransactionType | null | undefined;
  status?: BillingTransactionStatus | null | undefined;
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    type: z
      .enum([
        "charge",
        "payment",
        "refund",
        "credit",
        "debit",
        "adjustment",
        "fee",
        "discount",
        "tax",
        "transfer",
        "chargeback",
        "payout",
        "deposit",
      ])
      .nullable()
      .optional(),
    status: z
      .enum([
        "pending",
        "processing",
        "completed",
        "settled",
        "failed",
        "reversed",
        "refunded",
        "disputed",
        "canceled",
      ])
      .nullable()
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

// ── Admin: platform plan management ──────────────────────────────────────────

/**
 * The feature map is shape-checked for its discriminator (`productType`) at
 * the edge; the feature/limit map itself is validated *semantically* in the
 * service (the edge cannot own the per-product-line field rules without
 * duplicating the plan types).
 */
const planFeaturesSchema = z
  .object({ productType: z.enum(["social", "fashion"]) })
  .passthrough()
  .transform((value) => value as PlanFeatures);

const adminMoneyInt = z.number().int().min(0).max(MONEY_MAX);

export const adminListPlansQuerySchema: z.ZodType<{
  status?: string | null | undefined;
  limit: number;
  cursor?: string | null | undefined;
}> = z
  .object({
    status: z.enum(["active", "inactive", "archived"]).nullable().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

export const createPlanSchema: z.ZodType<CreatePlanInput> = z
  .object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    displayName: z.string().min(1).max(120),
    description: z.string().min(1).max(2000).optional(),
    tagline: z.string().min(1).max(160).optional(),
    tier: z.enum(subscriptionPlanPgEnum.enumValues),
    pricingModel: z.enum(["flat_rate", "usage_based", "tiered"]),
    currency: z.enum(currencyPgEnum.enumValues),
    priceMonthly: adminMoneyInt.nullable().optional(),
    priceQuarterly: adminMoneyInt.nullable().optional(),
    priceAnnual: adminMoneyInt.nullable().optional(),
    setupFee: adminMoneyInt.optional(),
    hasFreeTrial: z.boolean().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    minimumSeats: z.number().int().min(1).max(SEATS_MAX).nullable().optional(),
    maximumSeats: z.number().int().min(1).max(SEATS_MAX).nullable().optional(),
    allowNewSignups: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    requiresSalesContact: z.boolean().optional(),
    minimumCommitmentMonths: z.number().int().min(0).max(60).nullable().optional(),
    features: planFeaturesSchema,
  })
  .strict();

export const updatePlanSchema: z.ZodType<UpdatePlanInput> = z
  .object({
    name: z.string().min(1).max(120).optional(),
    displayName: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(2000).nullable().optional(),
    tagline: z.string().min(1).max(160).nullable().optional(),
    pricingModel: z.enum(["flat_rate", "usage_based", "tiered"]).optional(),
    priceMonthly: adminMoneyInt.nullable().optional(),
    priceQuarterly: adminMoneyInt.nullable().optional(),
    priceAnnual: adminMoneyInt.nullable().optional(),
    setupFee: adminMoneyInt.optional(),
    hasFreeTrial: z.boolean().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    minimumSeats: z.number().int().min(1).max(SEATS_MAX).nullable().optional(),
    maximumSeats: z.number().int().min(1).max(SEATS_MAX).nullable().optional(),
    allowNewSignups: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    requiresSalesContact: z.boolean().optional(),
    minimumCommitmentMonths: z.number().int().min(0).max(60).nullable().optional(),
    features: planFeaturesSchema.optional(),
  })
  .strict();
