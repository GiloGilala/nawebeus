// packages/database/schema/billing/invoices.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "../auth/users";
import { currencyPgEnum, invoiceStatusPgEnum, paymentStatusPgEnum } from "../enums";
import { organizations } from "../organization/organizations";
import { subscriptions } from "./subscriptions";

// ============================================
// ENUMS
// ============================================

export const invoiceTypeEnum = pgEnum("invoice_type", [
  "subscription",
  "one_time",
  "overage",
  "addon",
  "credit_note",
  "refund",
  "adjustment",
]);

export const collectionMethodEnum = pgEnum("collection_method", [
  "charge_automatically",
  "send_invoice",
]);

export const originEnum = pgEnum("invoice_origin", [
  "subscription",
  "checkout",
  "manual",
  "import",
  "adjustment",
  "api",
  "dashboard",
  "admin",
  "system",
  "migration",
]);

export const createdFromEnum = pgEnum("invoice_created_from", [
  "api",
  "dashboard",
  "webhook",
  "migration",
  "admin",
  "system",
  "cron",
]);

// ============================================
// INVOICES TABLE
// ============================================

export const invoices = pgTable(
  "invoices",
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").primaryKey().defaultRandom(),

    // ============================================
    // INVOICE IDENTITY
    // ============================================
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    displayNumber: varchar("display_number", { length: 100 }),
    sequenceNumber: integer("sequence_number"), // NEW: For faster sorting

    version: integer("version").notNull().default(1), // NEW: Invoice versioning
    supersededBy: uuid("superseded_by"), // NEW: Reference to newer version
    supersedes: uuid("supersedes"), // NEW: Reference to older version

    type: invoiceTypeEnum("type").notNull().default("subscription"),
    status: invoiceStatusPgEnum("status").notNull().default("draft"),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),

    // NEW: Link to payment
    paymentId: uuid("payment_id"),

    // NEW: Credit note reference
    creditNoteId: uuid("credit_note_id"),

    // ============================================
    // AMOUNTS
    // ============================================
    currency: currencyPgEnum("currency").notNull().default("USD"),

    // NEW: Multi-currency support
    exchangeRate: decimal("exchange_rate", { precision: 20, scale: 6 }),
    baseCurrency: currencyPgEnum("base_currency"),
    exchangeRateAppliedAt: timestamp("exchange_rate_applied_at", {
      withTimezone: true,
    }),

    // Line items total
    subtotal: integer("subtotal").notNull().default(0),

    // Discounts
    discountAmount: integer("discount_amount").notNull().default(0),
    couponCode: varchar("coupon_code", { length: 100 }),

    // Tax
    taxAmount: integer("tax_amount").notNull().default(0),
    taxRate: integer("tax_rate").default(0),
    taxDescription: varchar("tax_description", { length: 200 }),

    // Credits applied
    creditAmount: integer("credit_amount").notNull().default(0),

    // Final amount
    total: integer("total").notNull().default(0),
    amountDue: integer("amount_due").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    amountRemaining: integer("amount_remaining").notNull().default(0),

    startingBalance: integer("starting_balance").default(0),
    endingBalance: integer("ending_balance").default(0),

    // ============================================
    // LINE ITEMS (Kept as JSON for now)
    // ============================================
    lineItems: jsonb("line_items")
      .$type<
        Array<{
          id: string;
          description: string;
          quantity: number;
          unitPrice: number;
          amount: number;
          type: "subscription" | "addon" | "overage" | "one_time" | "credit" | "adjustment";
          taxRate?: number;
          taxAmount?: number;
          discount?: number;
          discountAmount?: number;
          productId?: string;
          priceId?: string;
          period?: { start: string; end: string };
          prorated?: boolean;
          metadata?: Record<string, unknown>;
        }>
      >()
      .notNull()
      .default([]),

    // ============================================
    // BILLING PERIOD
    // ============================================
    billingPeriodStart: timestamp("billing_period_start", {
      withTimezone: true,
    }),
    billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),

    // ============================================
    // DATES & DEADLINES
    // ============================================
    invoiceDate: timestamp("invoice_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    markedUncollectibleAt: timestamp("marked_uncollectible_at", {
      withTimezone: true,
    }),

    // NEW: Write-off support
    writtenOffAt: timestamp("written_off_at", { withTimezone: true }),
    writtenOffBy: uuid("written_off_by").references(() => users.id, {
      onDelete: "set null",
    }),
    writeOffReason: text("write_off_reason"),

    // Reminders
    nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastReminderSentAt: timestamp("last_reminder_sent_at", {
      withTimezone: true,
    }),

    // ============================================
    // PAYMENT
    // ============================================
    paymentStatus: paymentStatusPgEnum("payment_status").default("pending"),
    collectionMethod: collectionMethodEnum("collection_method")
      .notNull()
      .default("charge_automatically"),

    paymentAttempts: integer("payment_attempts").notNull().default(0),
    lastPaymentAttemptAt: timestamp("last_payment_attempt_at", {
      withTimezone: true,
    }),
    lastPaymentError: text("last_payment_error"),

    nextPaymentAttemptAt: timestamp("next_payment_attempt_at", {
      withTimezone: true,
    }),
    autoAdvance: boolean("auto_advance").notNull().default(true),

    // ============================================
    // STRIPE INTEGRATION
    // ============================================
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),

    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),

    // ============================================
    // PDF GENERATION (NEW)
    // ============================================
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
    pdfVersion: integer("pdf_version"),
    pdfChecksum: varchar("pdf_checksum", { length: 64 }),

    // ============================================
    // CUSTOMER INFORMATION
    // ============================================
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }),

    // NEW: Search optimization
    searchText: text("search_text"),
    normalizedCustomerName: varchar("normalized_customer_name", {
      length: 200,
    }),
    normalizedEmail: varchar("normalized_email", { length: 255 }),

    billingAddress: jsonb("billing_address")
      .$type<{
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }>()
      .default({}),

    shippingAddress: jsonb("shipping_address")
      .$type<{
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }>()
      .default({}),

    taxId: varchar("tax_id", { length: 100 }),
    taxExempt: boolean("tax_exempt").notNull().default(false),
    taxExemptReason: varchar("tax_exempt_reason", { length: 200 }),

    // ============================================
    // COMPANY INFORMATION (Snapshot)
    // ============================================
    companyInfo: jsonb("company_info")
      .$type<{
        name: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
        };
        email?: string;
        phone?: string;
        website?: string;
        taxId?: string;
        registrationNumber?: string;
        logo?: string;
      }>()
      .default({
        name: "Nawebeus",
      }),

    // ============================================
    // PAYMENT TERMS & INSTRUCTIONS
    // ============================================
    paymentTerms: varchar("payment_terms", { length: 100 }).default("due_on_receipt"),
    paymentInstructions: text("payment_instructions"),

    bankTransferDetails: jsonb("bank_transfer_details")
      .$type<{
        accountNumber?: string;
        routingNumber?: string;
        bankName?: string;
        swift?: string;
        iban?: string;
        reference?: string;
      }>()
      .default({}),

    // ============================================
    // NOTES & CUSTOMIZATION
    // ============================================
    description: text("description"),
    footer: text("footer"),
    memo: text("memo"),

    customerNote: text("customer_note"),
    customFields: jsonb("custom_fields")
      .$type<
        Array<{
          name: string;
          value: string;
        }>
      >()
      .default([]),

    // ============================================
    // LOCALE (NEW)
    // ============================================
    locale: varchar("locale", { length: 10 }).default("en-US"),
    timezone: varchar("timezone", { length: 50 }),
    dateFormat: varchar("date_format", { length: 50 }),

    // ============================================
    // RECEIPT & ACKNOWLEDGMENT
    // ============================================
    receiptNumber: varchar("receipt_number", { length: 100 }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // REFUNDS & CREDITS (JSON for now)
    // ============================================
    refunds: jsonb("refunds")
      .$type<
        Array<{
          id: string;
          amount: number;
          reason?: string;
          refundedAt: string;
          processorRefundId?: string;
          status: "pending" | "succeeded" | "failed" | "canceled";
          refundedBy?: string;
        }>
      >()
      .default([]),

    creditsApplied: jsonb("credits_applied")
      .$type<
        Array<{
          creditNoteId: string;
          amount: number;
          appliedAt: string;
          appliedBy?: string;
        }>
      >()
      .default([]),

    // ============================================
    // DISPUTES (JSON for now)
    // ============================================
    disputes: jsonb("disputes")
      .$type<
        Array<{
          id: string;
          reason: string;
          status: "open" | "under_review" | "won" | "lost" | "closed";
          amount: number;
          openedAt: string;
          resolvedAt?: string;
          evidence?: Record<string, unknown>;
          processorDisputeId?: string;
        }>
      >()
      .default([]),

    hasDispute: boolean("has_dispute").notNull().default(false),

    // ============================================
    // DUNNING & COLLECTION (JSON for now)
    // ============================================
    dunningStatus: varchar("dunning_status", { length: 50 }),
    dunningAttempts: integer("dunning_attempts").notNull().default(0),
    lastDunningAttemptAt: timestamp("last_dunning_attempt_at", {
      withTimezone: true,
    }),
    nextDunningAttemptAt: timestamp("next_dunning_attempt_at", {
      withTimezone: true,
    }),

    collectionNotes: jsonb("collection_notes")
      .$type<
        Array<{
          timestamp: string;
          userId: string;
          note: string;
          action?: string;
        }>
      >()
      .default([]),

    // ============================================
    // EMAIL LOGS (JSON for now)
    // ============================================
    emailsSent: jsonb("emails_sent")
      .$type<
        Array<{
          type:
            | "invoice_sent"
            | "payment_reminder"
            | "payment_received"
            | "payment_failed"
            | "overdue_notice";
          sentAt: string;
          recipient: string;
          status: "delivered" | "bounced" | "failed";
          emailId?: string;
          metadata?: Record<string, unknown>;
        }>
      >()
      .default([]),

    sentToCustomerAt: timestamp("sent_to_customer_at", { withTimezone: true }),
    viewedByCustomerAt: timestamp("viewed_by_customer_at", {
      withTimezone: true,
    }),
    downloadedByCustomerAt: timestamp("downloaded_by_customer_at", {
      withTimezone: true,
    }),

    // ============================================
    // APPROVAL & WORKFLOW
    // ============================================
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvalNotes: text("approval_notes"),

    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: uuid("rejected_by").references(() => users.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),

    // ============================================
    // RECONCILIATION
    // ============================================
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    reconciledBy: uuid("reconciled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reconciliationNotes: text("reconciliation_notes"),

    // ============================================
    // LEDGER & ACCOUNTING (NEW)
    // ============================================
    journalEntryId: varchar("journal_entry_id", { length: 255 }),
    ledgerTransactionId: varchar("ledger_transaction_id", { length: 255 }),

    // ============================================
    // ORIGIN & SOURCE (NEW)
    // ============================================
    origin: originEnum("origin"),
    createdFrom: createdFromEnum("created_from"),

    // ============================================
    // VOID METADATA (Enhanced)
    // ============================================
    voidedBy: uuid("voided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    voidReason: text("void_reason"),
    voidCode: varchar("void_code", { length: 50 }), // NEW: duplicate, fraud, customer_request, system_error

    // ============================================
    // BILLING ENGINE VERSION (NEW)
    // ============================================
    billingEngineVersion: varchar("billing_engine_version", { length: 20 }),

    // ============================================
    // AUDIT & HISTORY (JSON for now)
    // ============================================
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    history: jsonb("history")
      .$type<
        Array<{
          timestamp: string;
          userId?: string;
          event: string;
          changes?: Record<string, { from: unknown; to: unknown }>;
          metadata?: Record<string, unknown>;
          ipAddress?: string;
          userAgent?: string;
        }>
      >()
      .default([]),

    // ============================================
    // METADATA
    // ============================================
    metadata: jsonb("metadata")
      .$type<{
        source?: string;
        campaign?: string;
        salesRep?: string;
        poNumber?: string;
        contractId?: string;
        projectId?: string;
        customFields?: Record<string, unknown>;
      }>()
      .default({}),

    tags: jsonb("tags").$type<Array<string>>().default([]),
    internalNotes: text("internal_notes"),

    // ============================================
    // TIMESTAMPS
    // ============================================
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================

    uniqueIndex("invoices_invoice_number_unique")
      .on(table.invoiceNumber)
      .where(sql`deleted_at IS NULL`),

    uniqueIndex("invoices_stripe_invoice_unique")
      .on(table.stripeInvoiceId)
      .where(sql`stripe_invoice_id IS NOT NULL AND deleted_at IS NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================

    index("invoices_invoice_number_idx").on(table.invoiceNumber),
    index("invoices_display_number_idx").on(table.displayNumber),
    index("invoices_sequence_number_idx").on(table.sequenceNumber),
    index("invoices_version_idx").on(table.version),

    // Relationships
    index("invoices_organization_idx").on(table.organizationId),
    index("invoices_subscription_idx").on(table.subscriptionId),
    index("invoices_payment_id_idx").on(table.paymentId),

    // Status
    index("invoices_status_idx").on(table.status),
    index("invoices_type_idx").on(table.type),
    index("invoices_payment_status_idx").on(table.paymentStatus),

    // Dates
    index("invoices_invoice_date_idx").on(table.invoiceDate),
    index("invoices_due_date_idx").on(table.dueDate),
    index("invoices_paid_at_idx").on(table.paidAt),

    // Billing period
    index("invoices_billing_period_start_idx").on(table.billingPeriodStart),
    index("invoices_billing_period_end_idx").on(table.billingPeriodEnd),

    // Payment
    index("invoices_collection_method_idx").on(table.collectionMethod),
    index("invoices_next_payment_attempt_idx").on(table.nextPaymentAttemptAt),

    // Reminders
    index("invoices_next_reminder_idx").on(table.nextReminderAt),

    // Stripe
    index("invoices_stripe_invoice_idx").on(table.stripeInvoiceId),
    index("invoices_stripe_customer_idx").on(table.stripeCustomerId),
    index("invoices_stripe_subscription_idx").on(table.stripeSubscriptionId),

    // Customer
    index("invoices_customer_email_idx").on(table.customerEmail),
    index("invoices_normalized_email_idx").on(table.normalizedEmail),
    index("invoices_normalized_customer_name_idx").on(table.normalizedCustomerName),

    // Search
    index("invoices_search_text_idx").on(table.searchText),

    // Disputes
    index("invoices_has_dispute_idx").on(table.hasDispute),

    // Dunning
    index("invoices_dunning_status_idx").on(table.dunningStatus),
    index("invoices_next_dunning_attempt_idx").on(table.nextDunningAttemptAt),

    // Workflow
    index("invoices_requires_approval_idx").on(table.requiresApproval),
    index("invoices_approved_at_idx").on(table.approvedAt),

    // Origin
    index("invoices_origin_idx").on(table.origin),
    index("invoices_created_from_idx").on(table.createdFrom),

    // Currency
    index("invoices_currency_idx").on(table.currency),

    // Audit
    index("invoices_created_by_idx").on(table.createdBy),
    index("invoices_voided_by_idx").on(table.voidedBy),

    // Lifecycle
    index("invoices_deleted_at_idx").on(table.deletedAt),
    index("invoices_created_at_idx").on(table.createdAt),

    // ============================================
    // COMPOSITE INDEXES FOR COMMON QUERIES
    // ============================================

    // NEW: Organization + Invoice Date
    index("invoices_org_date_idx")
      .on(table.organizationId, table.invoiceDate)
      .where(sql`deleted_at IS NULL`),

    // NEW: Organization + Paid At (Revenue reports)
    index("invoices_org_paid_idx")
      .on(table.organizationId, table.paidAt)
      .where(sql`status = 'paid' AND deleted_at IS NULL`),

    // NEW: Organization + Customer Email (Search)
    index("invoices_org_email_idx")
      .on(table.organizationId, table.customerEmail)
      .where(sql`deleted_at IS NULL`),

    // NEW: Organization + Invoice Number (Lookup)
    index("invoices_org_number_idx")
      .on(table.organizationId, table.invoiceNumber)
      .where(sql`deleted_at IS NULL`),

    // NEW: Organization + Status + Due Date (Collections)
    index("invoices_org_status_due_idx")
      .on(table.organizationId, table.status, table.dueDate)
      .where(sql`
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      `),

    // NEW: Organization + Payment Status (Dashboard)
    index("invoices_org_payment_status_idx")
      .on(table.organizationId, table.paymentStatus)
      .where(sql`deleted_at IS NULL`),

    // Unpaid invoices by organization
    index("invoices_org_unpaid_idx")
      .on(table.organizationId, table.status, table.amountDue)
      .where(sql`
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      `),

    // Overdue invoices
    index("invoices_overdue_idx")
      .on(table.dueDate, table.status, table.amountDue)
      .where(sql`
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      `),

    // Invoices needing reminders
    index("invoices_reminder_due_idx")
      .on(table.nextReminderAt, table.status)
      .where(sql`
        status IN ('open', 'overdue')
        AND deleted_at IS NULL
      `),

    // Invoices pending payment attempt
    index("invoices_payment_retry_idx")
      .on(table.nextPaymentAttemptAt, table.paymentStatus)
      .where(sql`
        payment_status IN ('pending', 'failed')
        AND deleted_at IS NULL
      `),

    // Invoices in dunning
    index("invoices_dunning_active_idx")
      .on(table.dunningStatus, table.nextDunningAttemptAt)
      .where(sql`
        dunning_status = 'active'
        AND deleted_at IS NULL
      `),

    // Invoices pending approval
    index("invoices_pending_approval_idx")
      .on(table.requiresApproval, table.status, table.approvedAt)
      .where(sql`
        requires_approval = true
        AND approved_at IS NULL
        AND status = 'draft'
        AND deleted_at IS NULL
      `),

    // Invoices with disputes
    index("invoices_disputed_idx")
      .on(table.hasDispute, table.status)
      .where(sql`
        has_dispute = true
        AND deleted_at IS NULL
      `),

    // Revenue reporting (paid invoices by date range)
    index("invoices_paid_revenue_idx")
      .on(table.paidAt, table.total, table.type)
      .where(sql`
        status = 'paid'
        AND type IN ('subscription', 'one_time', 'overage', 'addon')
        AND deleted_at IS NULL
      `),

    // NEW: Write-off tracking
    index("invoices_written_off_idx")
      .on(table.writtenOffAt, table.status)
      .where(sql`
        written_off_at IS NOT NULL
        AND deleted_at IS NULL
      `),
  ],
);

// ============================================
// RELATIONS
// ============================================

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
    relationName: "invoice_created_by",
  }),
  voidedByUser: one(users, {
    fields: [invoices.voidedBy],
    references: [users.id],
    relationName: "invoice_voided_by",
  }),
  approvedByUser: one(users, {
    fields: [invoices.approvedBy],
    references: [users.id],
    relationName: "invoice_approved_by",
  }),
  rejectedByUser: one(users, {
    fields: [invoices.rejectedBy],
    references: [users.id],
    relationName: "invoice_rejected_by",
  }),
  reconciledByUser: one(users, {
    fields: [invoices.reconciledBy],
    references: [users.id],
    relationName: "invoice_reconciled_by",
  }),
  acknowledgedByUser: one(users, {
    fields: [invoices.acknowledgedBy],
    references: [users.id],
    relationName: "invoice_acknowledged_by",
  }),
  writtenOffByUser: one(users, {
    fields: [invoices.writtenOffBy],
    references: [users.id],
    relationName: "invoice_written_off_by",
  }),
}));

// ============================================
// HELPER SELECTORS
// ============================================

export const invoiceSelectors = {
  basic: {
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    displayNumber: invoices.displayNumber,
    type: invoices.type,
    status: invoices.status,
    organizationId: invoices.organizationId,
    total: invoices.total,
    currency: invoices.currency,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    paidAt: invoices.paidAt,
    paymentStatus: invoices.paymentStatus,
    customerName: invoices.customerName,
    customerEmail: invoices.customerEmail,
  } as const,

  withLineItems: {
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    displayNumber: invoices.displayNumber,
    type: invoices.type,
    status: invoices.status,
    organizationId: invoices.organizationId,
    subscriptionId: invoices.subscriptionId,
    subtotal: invoices.subtotal,
    discountAmount: invoices.discountAmount,
    taxAmount: invoices.taxAmount,
    creditAmount: invoices.creditAmount,
    total: invoices.total,
    amountDue: invoices.amountDue,
    amountPaid: invoices.amountPaid,
    amountRemaining: invoices.amountRemaining,
    currency: invoices.currency,
    lineItems: invoices.lineItems,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    paidAt: invoices.paidAt,
    paymentStatus: invoices.paymentStatus,
    customerName: invoices.customerName,
    customerEmail: invoices.customerEmail,
    billingAddress: invoices.billingAddress,
  } as const,

  admin: {
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    displayNumber: invoices.displayNumber,
    sequenceNumber: invoices.sequenceNumber,
    version: invoices.version,
    supersededBy: invoices.supersededBy,
    supersedes: invoices.supersedes,
    type: invoices.type,
    status: invoices.status,
    organizationId: invoices.organizationId,
    subscriptionId: invoices.subscriptionId,
    paymentId: invoices.paymentId,
    creditNoteId: invoices.creditNoteId,
    currency: invoices.currency,
    exchangeRate: invoices.exchangeRate,
    baseCurrency: invoices.baseCurrency,
    subtotal: invoices.subtotal,
    discountAmount: invoices.discountAmount,
    couponCode: invoices.couponCode,
    taxAmount: invoices.taxAmount,
    taxRate: invoices.taxRate,
    taxDescription: invoices.taxDescription,
    creditAmount: invoices.creditAmount,
    total: invoices.total,
    amountDue: invoices.amountDue,
    amountPaid: invoices.amountPaid,
    amountRemaining: invoices.amountRemaining,
    startingBalance: invoices.startingBalance,
    endingBalance: invoices.endingBalance,
    lineItems: invoices.lineItems,
    billingPeriodStart: invoices.billingPeriodStart,
    billingPeriodEnd: invoices.billingPeriodEnd,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    paidAt: invoices.paidAt,
    voidedAt: invoices.voidedAt,
    markedUncollectibleAt: invoices.markedUncollectibleAt,
    writtenOffAt: invoices.writtenOffAt,
    writtenOffBy: invoices.writtenOffBy,
    writeOffReason: invoices.writeOffReason,
    paymentStatus: invoices.paymentStatus,
    collectionMethod: invoices.collectionMethod,
    paymentAttempts: invoices.paymentAttempts,
    lastPaymentAttemptAt: invoices.lastPaymentAttemptAt,
    lastPaymentError: invoices.lastPaymentError,
    nextPaymentAttemptAt: invoices.nextPaymentAttemptAt,
    autoAdvance: invoices.autoAdvance,
    stripeInvoiceId: invoices.stripeInvoiceId,
    stripeCustomerId: invoices.stripeCustomerId,
    stripeSubscriptionId: invoices.stripeSubscriptionId,
    stripePaymentIntentId: invoices.stripePaymentIntentId,
    stripeChargeId: invoices.stripeChargeId,
    hostedInvoiceUrl: invoices.hostedInvoiceUrl,
    invoicePdfUrl: invoices.invoicePdfUrl,
    pdfGeneratedAt: invoices.pdfGeneratedAt,
    pdfVersion: invoices.pdfVersion,
    pdfChecksum: invoices.pdfChecksum,
    customerName: invoices.customerName,
    customerEmail: invoices.customerEmail,
    customerPhone: invoices.customerPhone,
    searchText: invoices.searchText,
    normalizedCustomerName: invoices.normalizedCustomerName,
    normalizedEmail: invoices.normalizedEmail,
    billingAddress: invoices.billingAddress,
    shippingAddress: invoices.shippingAddress,
    taxId: invoices.taxId,
    taxExempt: invoices.taxExempt,
    taxExemptReason: invoices.taxExemptReason,
    companyInfo: invoices.companyInfo,
    paymentTerms: invoices.paymentTerms,
    paymentInstructions: invoices.paymentInstructions,
    bankTransferDetails: invoices.bankTransferDetails,
    description: invoices.description,
    footer: invoices.footer,
    memo: invoices.memo,
    customerNote: invoices.customerNote,
    customFields: invoices.customFields,
    locale: invoices.locale,
    timezone: invoices.timezone,
    dateFormat: invoices.dateFormat,
    receiptNumber: invoices.receiptNumber,
    acknowledgedAt: invoices.acknowledgedAt,
    acknowledgedBy: invoices.acknowledgedBy,
    refunds: invoices.refunds,
    creditsApplied: invoices.creditsApplied,
    disputes: invoices.disputes,
    hasDispute: invoices.hasDispute,
    dunningStatus: invoices.dunningStatus,
    dunningAttempts: invoices.dunningAttempts,
    lastDunningAttemptAt: invoices.lastDunningAttemptAt,
    nextDunningAttemptAt: invoices.nextDunningAttemptAt,
    collectionNotes: invoices.collectionNotes,
    emailsSent: invoices.emailsSent,
    sentToCustomerAt: invoices.sentToCustomerAt,
    viewedByCustomerAt: invoices.viewedByCustomerAt,
    downloadedByCustomerAt: invoices.downloadedByCustomerAt,
    requiresApproval: invoices.requiresApproval,
    approvedAt: invoices.approvedAt,
    approvedBy: invoices.approvedBy,
    approvalNotes: invoices.approvalNotes,
    rejectedAt: invoices.rejectedAt,
    rejectedBy: invoices.rejectedBy,
    rejectionReason: invoices.rejectionReason,
    reconciledAt: invoices.reconciledAt,
    reconciledBy: invoices.reconciledBy,
    reconciliationNotes: invoices.reconciliationNotes,
    journalEntryId: invoices.journalEntryId,
    ledgerTransactionId: invoices.ledgerTransactionId,
    origin: invoices.origin,
    createdFrom: invoices.createdFrom,
    voidedBy: invoices.voidedBy,
    voidReason: invoices.voidReason,
    voidCode: invoices.voidCode,
    billingEngineVersion: invoices.billingEngineVersion,
    createdBy: invoices.createdBy,
    history: invoices.history,
    metadata: invoices.metadata,
    tags: invoices.tags,
    internalNotes: invoices.internalNotes,
    createdAt: invoices.createdAt,
    updatedAt: invoices.updatedAt,
    deletedAt: invoices.deletedAt,
  } as const,
};
