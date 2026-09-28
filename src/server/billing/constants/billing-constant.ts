/**
 * Billing domain constants (NWB-P13-001).
 *
 * Slot 1 of the domain module pattern — the leaf: no imports of any other
 * domain file, no I/O, no runtime state. Everything here is a compile-time
 * constant that the service, functions and route slots share, so there is
 * exactly one place a budget, a pattern or a threshold can change.
 *
 * Naira discipline (roadmap §16): all money is integer minor units — kobo
 * for NGN, cents for USD. No floating-point money anywhere in this module.
 */

// ── Route surface ────────────────────────────────────────────────────────────

/** Hono mount prefix for the billing API area (`/api/billing/*`). */
export const BILLING_ROUTE_PREFIX = "/billing" as const;

// ── Identifiers ──────────────────────────────────────────────────────────────

/**
 * All six billing tables are uuid-keyed. Shared by the functions slot (query
 * schemas) and the route slot (path-param checks) so a malformed id becomes a
 * 404/422 at the edge instead of a driver round-trip.
 */
export const BILLING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Human invoice number prefix (the `display_number` column). Sequence numbers
 * are per-organization, so the display format is `INV-<seq:06>` — stable,
 * sortable, and greppable across the UI, receipts and the audit trail.
 */
export const INVOICE_DISPLAY_PREFIX = "INV-" as const;

/** Idempotency keys are client-chosen tokens; bounded so they stay loggable. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128 as const;

// ── Money (integer minor units only) ─────────────────────────────────────────

/**
 * D7 / DEC-025: Paystack (NGN) + Stripe (USD). Currencies the billing module
 * accepts; the `currency` enum has more (EUR/GBP/KES/GHS/ZAR) but the
 * processors do not, and a currency no processor can settle is a dead end.
 */
export const BILLING_CURRENCIES = ["NGN", "USD"] as const;

/**
 * Default billing currency. NGN is the primary market (Lagos) and the
 * processor pair is NGN-first; plans carry a single integer price, so the
 * subscription's currency is fixed at creation time.
 */
export const BILLING_DEFAULT_CURRENCY = "NGN" as const;

/**
 * Absolute ceiling on any single money field (≈ 1bn in minor units: NGN 10m
 * / USD 10m). Beyond this a row would be a data-entry error, not a sale.
 */
export const MONEY_MAX = 100_000_000_000 as const;

/** Zero is a legal amount (free plan, full credit) and the universal floor. */
export const MONEY_MIN = 0 as const;

/** Maximum seats a single subscription may request (plan bounds also apply). */
export const SEATS_MAX = 1000 as const;

// ── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Statuses that occupy the organization's single active-subscription slot
 * (one-active-per-org, NWB-P13-001). `cancelled` is the only terminal status:
 * it frees the slot, everything else keeps it.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "paused"] as const;

/**
 * Statuses from which a cancellation is legal. (A `trial` subscription
 * cancels immediately; `paused` still holds the slot and must be released
 * explicitly.)
 */
export const CANCELLABLE_SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "paused"] as const;

/**
 * Manual activation (NWB-P13-001): a subscription becomes `active` when it is
 * created — there is no processor webhook that flips it on. Trial days come
 * from the plan and are bounded so a misconfigured plan cannot grant
 * unbounded free service.
 */
export const MAX_TRIAL_DAYS = 90 as const;

/** Advisory-lock key prefix for the one-active-per-org create path. */
export const SUBSCRIPTION_CREATE_LOCK_PREFIX = "nawebeus:billing:subscription:" as const;

// ── Invoices ─────────────────────────────────────────────────────────────────

/**
 * Invoice statuses a payment may settle. Mirrors the partial indexes
 * `invoices_payment_retry_idx` / dunning surface, which filter on exactly
 * these two — an invoice in any other state has a different lifecycle
 * (draft, void, written off) and must be reached by its own operation.
 */
export const PAYABLE_INVOICE_STATUSES = ["open", "overdue"] as const;

/**
 * Dunning budget (roadmap §16: "failed payment retried and surfaced"). The
 * dunning worker (NWB-P13-004) consumes these; they live here so the worker,
 * the invoice service and the tests all read one number.
 */
export const DUNNING_MAX_REMINDERS = 3 as const;
export const DUNNING_INTERVAL_HOURS = 24 as const;
export const DUNNING_MAX_ATTEMPTS = 5 as const;
export const DUNNING_RETRY_BASE_HOURS = 6 as const;

// ── Payment methods ──────────────────────────────────────────────────────────

/**
 * Manual-activation on-ramp (NWB-P13-001): methods arrive with a
 * processor-issued token (the raw PAN never touches this platform — DEC-025
 * keeps PCI scope at the processor). Only token-carrying methods can be
 * charged, which is what `payInvoice` enforces.
 */
export const PAYMENT_METHOD_KINDS = ["card", "bank_account", "ussd"] as const;

// ── Rate limiting (tanstack-start.md §18) ────────────────────────────────────

/**
 * Billing-specific budgets. The global category budgets (`RATE_LIMITS` in
 * `@/lib/rate-limit`) cover read/write fan-out; these cover the operations
 * whose abuse is expensive *per action*: paying an invoice (money moves) and
 * changing subscription state (one per org, so a tight hourly budget catches
 * a stuck client loop without breaking a human).
 *
 * Resolved legacy conflict: domain budgets belong in the domain's constants
 * slot, not in the shared `RATE_LIMITS` table.
 */
export const BILLING_RATE_LIMITS = {
  /** Pay-invoice attempts per user per minute (each one writes audit + ledger). */
  invoicePayPerMinute: { max: 10, windowMs: 60_000 },
  /** Subscription create/cancel/resume per user per hour. */
  subscriptionChangePerHour: { max: 5, windowMs: 3_600_000 },
  /** Payment-method mutations per user per hour. */
  paymentMethodChangePerHour: { max: 5, windowMs: 3_600_000 },
} as const;

// ── Usage / entitlements ─────────────────────────────────────────────────────

/**
 * Metered-usage alert threshold (percent of a limit). `notificationSettings.
 * usageAlerts` gates the email; the number itself is one decision, owned here.
 */
export const USAGE_ALERT_PERCENT = 80 as const;
