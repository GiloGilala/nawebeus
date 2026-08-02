// packages/database/schema/billing/transactions.ts
import {
  boolean,
  bigint,
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
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { organizations } from '../organization/organizations'
import { users } from '../auth/users'
import { subscriptions } from './subscriptions'
import { invoices } from './invoices'
import { payments } from './payments'
import { tablePrefix } from '../schema-utils'
import {
  billingTransactionStatusPgEnum,
  billingTransactionCategoryPgEnum,
  currencyPgEnum,
  productTypePgEnum,
} from '../enums'

// ============================================
// ENUMS
// ============================================

export const transactionTypeEnum = pgEnum('transaction_type', [
  'charge',
  'payment',
  'refund',
  'credit',
  'debit',
  'adjustment',
  'fee',
  'discount',
  'tax',
  'transfer',
  'chargeback',
  'payout',
  'deposit',
])

export const paymentProcessorEnum = pgEnum('payment_processor', [
  'paystack',
  'stripe',
  'flutterwave',
  'paypal',
  'manual',
  'wallet',
  'bank_transfer',
  'cash',
  'square',
  'adyen',
  'razorpay',
  'other',
])

export const processorStatusEnum = pgEnum('processor_status', [
  'authorized',
  'captured',
  'failed',
  'settled',
  'pending',
  'voided',
  'refunded',
])

export const originEnum = pgEnum('transaction_origin', [
  'subscription',
  'invoice',
  'manual',
  'refund',
  'api',
  'migration',
  'system',
  'admin',
  'cron',
  'webhook',
  'checkout',
])

export const disputeStatusEnum = pgEnum('dispute_status', [
  'pending',
  'under_review',
  'won',
  'lost',
  'closed',
])

export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',
  'in_transit',
  'settled',
  'failed',
  'reversed',
])

// ============================================
// TRANSACTIONS TABLE
// ============================================

export const transactions = pgTable(
  `${tablePrefix}transactions`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid('id').primaryKey().defaultRandom(),

    transactionNumber: varchar('transaction_number', { length: 50 })
      .notNull()
      .unique(),

    // NEW: Event ID for event sourcing
    eventId: uuid('event_id').unique(),

    // NEW: Optimistic locking
    version: integer('version').notNull().default(1),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    // NEW: Product type
    productType: productTypePgEnum('product_type').notNull().default('simple'),

    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),

    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),

    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),

    initiatedBy: uuid('initiated_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    parentTransactionId: uuid('parent_transaction_id').references(
      (): any => transactions.id,
      { onDelete: 'set null' },
    ),

    // NEW: Reversal FK
    reversalTransactionId: uuid('reversal_transaction_id').references(
      (): any => transactions.id,
      { onDelete: 'set null' },
    ),

    // ============================================
    // TRANSACTION DETAILS
    // ============================================
    type: transactionTypeEnum('type').notNull(),
    status: billingTransactionStatusPgEnum('status')
      .notNull()
      .default('pending'),
    category: billingTransactionCategoryPgEnum('category')
      .notNull()
      .default('other'),

    // NEW: Origin
    origin: originEnum('origin'),

    // ============================================
    // AMOUNT & CURRENCY (Using bigint for minor units)
    // ============================================
    amount: bigint('amount', { mode: 'number' }).notNull(), // in minor units (cents)
    currency: currencyPgEnum('currency').notNull().default('USD'),

    originalAmount: bigint('original_amount', { mode: 'number' }),
    originalCurrency: currencyPgEnum('original_currency'),
    exchangeRate: bigint('exchange_rate', { mode: 'number' }), // multiplied by 1000000 for precision
    exchangeProvider: varchar('exchange_provider', { length: 50 }),
    exchangeTimestamp: timestamp('exchange_timestamp', { withTimezone: true }),
    convertedAmount: bigint('converted_amount', { mode: 'number' }),

    // Net amount (after fees)
    netAmount: bigint('net_amount', { mode: 'number' }),
    feeAmount: bigint('fee_amount', { mode: 'number' }).default(0),

    // Tax
    taxAmount: bigint('tax_amount', { mode: 'number' }).default(0),
    taxRate: integer('tax_rate'), // basis points (e.g., 750 = 7.5%)

    // ============================================
    // BALANCE IMPACT
    // ============================================
    balanceImpact: bigint('balance_impact', { mode: 'number' }).notNull(),
    balanceBefore: bigint('balance_before', { mode: 'number' }),
    balanceAfter: bigint('balance_after', { mode: 'number' }),
    runningBalance: bigint('running_balance', { mode: 'number' }),

    // ============================================
    // ACCOUNTING (NEW)
    // ============================================
    debitAccount: varchar('debit_account', { length: 50 }),
    creditAccount: varchar('credit_account', { length: 50 }),
    journalEntryId: varchar('journal_entry_id', { length: 255 }),

    // ============================================
    // REVENUE RECOGNITION (NEW)
    // ============================================
    recognizedAmount: bigint('recognized_amount', { mode: 'number' }),
    deferredAmount: bigint('deferred_amount', { mode: 'number' }),
    recognizedAt: timestamp('recognized_at', { withTimezone: true }),

    // ============================================
    // SNAPSHOTS (NEW)
    // ============================================
    invoiceSnapshot: jsonb('invoice_snapshot'),
    customerSnapshot: jsonb('customer_snapshot'),
    subscriptionSnapshot: jsonb('subscription_snapshot'),

    // ============================================
    // DESCRIPTION & DETAILS
    // ============================================
    description: text('description').notNull(),
    shortDescription: varchar('short_description', { length: 200 }),

    // ============================================
    // EXTERNAL REFERENCES (NEW)
    // ============================================
    externalReference: varchar('external_reference', { length: 255 }),
    merchantReference: varchar('merchant_reference', { length: 255 }),
    clientReference: varchar('client_reference', { length: 255 }),
    purchaseOrder: varchar('purchase_order', { length: 100 }),

    // ============================================
    // RECEIPT (NEW)
    // ============================================
    receiptNumber: varchar('receipt_number', { length: 100 }),
    receiptUrl: varchar('receipt_url', { length: 500 }),

    // ============================================
    // LINE ITEMS
    // ============================================
    lineItems: jsonb('line_items')
      .$type<
        Array<{
          id: string
          description: string
          quantity: number
          unitPrice: number
          amount: number
          taxRate?: number
          taxAmount?: number
          discountAmount?: number
          metadata?: Record<string, unknown>
        }>
      >()
      .default([]),

    // ============================================
    // BILLING & SERVICE PERIODS
    // ============================================
    billingPeriodStart: timestamp('billing_period_start', {
      withTimezone: true,
    }),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),
    servicePeriodStart: timestamp('service_period_start', {
      withTimezone: true,
    }),
    servicePeriodEnd: timestamp('service_period_end', { withTimezone: true }),

    // ============================================
    // TIMING
    // ============================================
    transactionDate: timestamp('transaction_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveDate: timestamp('effective_date', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),

    // ============================================
    // RETRY TRACKING (NEW)
    // ============================================
    retryCount: integer('retry_count').default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),

    // ============================================
    // WEBHOOK TRACKING (NEW)
    // ============================================
    webhookId: varchar('webhook_id', { length: 255 }),
    webhookEvent: varchar('webhook_event', { length: 100 }),
    webhookReceivedAt: timestamp('webhook_received_at', { withTimezone: true }),
    webhookProcessedAt: timestamp('webhook_processed_at', {
      withTimezone: true,
    }),

    // ============================================
    // REVERSAL & DISPUTE
    // ============================================
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedBy: uuid('reversed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reversalReason: varchar('reversal_reason', { length: 255 }),

    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    disputeReason: varchar('dispute_reason', { length: 255 }),
    disputeStatus: disputeStatusEnum('dispute_status'),
    disputeResolution: text('dispute_resolution'),
    disputeResolvedAt: timestamp('dispute_resolved_at', { withTimezone: true }),

    // ============================================
    // PROCESSOR INFORMATION (Enhanced)
    // ============================================
    processorType: paymentProcessorEnum('processor_type'),
    processorTransactionId: varchar('processor_transaction_id', {
      length: 255,
    }),
    processorReference: varchar('processor_reference', { length: 255 }),
    processorStatus: processorStatusEnum('processor_status'),

    processorMetadata: jsonb('processor_metadata')
      .$type<{
        chargeId?: string
        transferId?: string
        balanceTransactionId?: string
        raw?: Record<string, unknown>
      }>()
      .default({}),

    // ============================================
    // ACCOUNTING & RECONCILIATION
    // ============================================
    accountingReference: varchar('accounting_reference', { length: 100 }),
    accountingCode: varchar('accounting_code', { length: 50 }),
    costCenter: varchar('cost_center', { length: 50 }),

    // NEW: Accounting export support
    accountingExported: boolean('accounting_exported').default(false),
    accountingExportedAt: timestamp('accounting_exported_at', {
      withTimezone: true,
    }),
    accountingBatchId: varchar('accounting_batch_id', { length: 255 }),
    accountingSyncStatus: varchar('accounting_sync_status', { length: 50 }),

    reconciled: boolean('reconciled').notNull().default(false),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    reconciledBy: uuid('reconciled_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    reportingPeriod: varchar('reporting_period', { length: 20 }),
    fiscalYear: integer('fiscal_year'),
    fiscalQuarter: integer('fiscal_quarter'),
    fiscalMonth: integer('fiscal_month'),

    // ============================================
    // PAYMENT DETAILS
    // ============================================
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentMethodDetails: jsonb('payment_method_details')
      .$type<{
        type?: string
        last4?: string
        brand?: string
      }>()
      .default({}),

    // ============================================
    // REFUND INFORMATION
    // ============================================
    refundedAmount: bigint('refunded_amount', { mode: 'number' }).default(0),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    refundDetails: jsonb('refund_details')
      .$type<
        Array<{
          transactionId: string
          amount: number
          reason: string
          refundedAt: string
          processorRefundId?: string
        }>
      >()
      .default([]),

    // ============================================
    // FEES & CHARGES
    // ============================================
    fees: jsonb('fees')
      .$type<
        Array<{
          type: 'processing' | 'platform' | 'service' | 'late' | 'other'
          description: string
          amount: number
          percentage?: number
        }>
      >()
      .default([]),

    // ============================================
    // DISCOUNTS & PROMOTIONS
    // ============================================
    discounts: jsonb('discounts')
      .$type<
        Array<{
          id: string
          code?: string
          name: string
          type: 'percentage' | 'fixed' | 'credit'
          value: number
          amount: number
        }>
      >()
      .default([]),

    // ============================================
    // TAX DETAILS
    // ============================================
    taxes: jsonb('taxes')
      .$type<
        Array<{
          name: string
          type: 'sales_tax' | 'vat' | 'gst' | 'other'
          rate: number
          amount: number
          jurisdiction?: string
          taxId?: string
        }>
      >()
      .default([]),

    taxExempt: boolean('tax_exempt').default(false),
    taxExemptReason: varchar('tax_exempt_reason', { length: 255 }),

    // ============================================
    // AUTHORIZATION & APPROVAL
    // ============================================
    requiresApproval: boolean('requires_approval').default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectionReason: varchar('rejection_reason', { length: 255 }),

    // ============================================
    // NOTIFICATIONS
    // ============================================
    customerNotified: boolean('customer_notified').default(false),
    customerNotifiedAt: timestamp('customer_notified_at', {
      withTimezone: true,
    }),
    notificationMethod: varchar('notification_method', { length: 50 }),

    // ============================================
    // SETTLEMENT & PAYOUT
    // ============================================
    settlementStatus: settlementStatusEnum('settlement_status'),
    settlementDate: timestamp('settlement_date', { withTimezone: true }),
    settlementReference: varchar('settlement_reference', { length: 100 }),
    payoutId: varchar('payout_id', { length: 100 }),

    // ============================================
    // RISK & FRAUD
    // ============================================
    riskScore: integer('risk_score'),
    riskLevel: varchar('risk_level', { length: 20 }),
    fraudDetected: boolean('fraud_detected').default(false),
    fraudReason: varchar('fraud_reason', { length: 255 }),

    // ============================================
    // METADATA & CONTEXT
    // ============================================
    source: varchar('source', { length: 100 }),
    sourceReference: varchar('source_reference', { length: 255 }),

    context: jsonb('context')
      .$type<{
        ipAddress?: string
        userAgent?: string
        location?: string
        channel?: 'web' | 'mobile' | 'api' | 'admin'
        sessionId?: string
      }>()
      .default({}),

    internalNotes: text('internal_notes'),
    customerNotes: text('customer_notes'),

    metadata: jsonb('metadata')
      .$type<{
        customFields?: Record<string, unknown>
        integrationData?: Record<string, unknown>
      }>()
      .default({}),

    tags: jsonb('tags').$type<Array<string>>().default([]),

    // ============================================
    // IDEMPOTENCY
    // ============================================
    idempotencyKey: varchar('idempotency_key', { length: 255 }),

    // ============================================
    // STATUS HISTORY (NEW)
    // ============================================
    statusHistory: jsonb('status_history')
      .$type<
        Array<{
          status: string
          at: string
          reason?: string
          userId?: string
        }>
      >()
      .default([]),

    // ============================================
    // AUDIT TRAIL
    // ============================================
    auditLog: jsonb('audit_log')
      .$type<
        Array<{
          timestamp: string
          userId?: string
          action: string
          changes?: Record<string, { from: unknown; to: unknown }>
          reason?: string
          ipAddress?: string
          userAgent?: string
        }>
      >()
      .default([]),

    // ============================================
    // ATTACHMENTS & DOCUMENTS
    // ============================================
    attachments: jsonb('attachments')
      .$type<
        Array<{
          id: string
          name: string
          type: string
          url: string
          uploadedAt: string
          uploadedBy?: string
        }>
      >()
      .default([]),

    // ============================================
    // TIMESTAMPS (Removed soft delete for financial records)
    // ============================================
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================

    uniqueIndex('transactions_number_unique').on(table.transactionNumber),
    uniqueIndex('transactions_event_id_unique').on(table.eventId),

    uniqueIndex('transactions_idempotency_key_unique')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),

    uniqueIndex('transactions_processor_id_unique')
      .on(table.processorType, table.processorTransactionId)
      .where(sql`processor_transaction_id IS NOT NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================

    index('transactions_org_idx').on(table.organizationId),
    index('transactions_subscription_idx').on(table.subscriptionId),
    index('transactions_invoice_idx').on(table.invoiceId),
    index('transactions_payment_idx').on(table.paymentId),
    index('transactions_initiated_by_idx').on(table.initiatedBy),
    index('transactions_parent_idx').on(table.parentTransactionId),
    index('transactions_reversal_idx').on(table.reversalTransactionId),

    // NEW: Product type index
    index('transactions_product_type_idx').on(table.productType),

    // Transaction details
    index('transactions_type_idx').on(table.type),
    index('transactions_status_idx').on(table.status),
    index('transactions_category_idx').on(table.category),
    index('transactions_origin_idx').on(table.origin),

    // Amount
    index('transactions_amount_idx').on(table.amount),
    index('transactions_balance_impact_idx').on(table.balanceImpact),
    index('transactions_currency_idx').on(table.currency),

    // Timing
    index('transactions_transaction_date_idx').on(table.transactionDate),
    index('transactions_effective_date_idx').on(table.effectiveDate),
    index('transactions_processed_at_idx').on(table.processedAt),
    index('transactions_completed_at_idx').on(table.completedAt),
    index('transactions_settled_at_idx').on(table.settledAt),
    index('transactions_scheduled_for_idx').on(table.scheduledFor),

    // Billing period
    index('transactions_billing_period_idx').on(
      table.billingPeriodStart,
      table.billingPeriodEnd,
    ),

    // Reversal
    index('transactions_reversed_at_idx').on(table.reversedAt),

    // Dispute
    index('transactions_disputed_at_idx').on(table.disputedAt),
    index('transactions_dispute_status_idx').on(table.disputeStatus),

    // Reconciliation
    index('transactions_reconciled_idx').on(table.reconciled),
    index('transactions_reconciled_at_idx').on(table.reconciledAt),
    index('transactions_accounting_reference_idx').on(
      table.accountingReference,
    ),

    // NEW: Accounting export
    index('transactions_accounting_exported_idx').on(table.accountingExported),

    // Financial reporting
    index('transactions_reporting_period_idx').on(table.reportingPeriod),
    index('transactions_fiscal_year_idx').on(table.fiscalYear),
    index('transactions_fiscal_quarter_idx').on(table.fiscalQuarter),

    // Settlement
    index('transactions_settlement_status_idx').on(table.settlementStatus),
    index('transactions_settlement_date_idx').on(table.settlementDate),

    // Risk
    index('transactions_fraud_detected_idx').on(table.fraudDetected),
    index('transactions_risk_level_idx').on(table.riskLevel),

    // Source
    index('transactions_source_idx').on(table.source),

    // Processor
    index('transactions_processor_type_idx').on(table.processorType),
    index('transactions_processor_transaction_idx').on(
      table.processorTransactionId,
    ),
    index('transactions_processor_status_idx').on(table.processorStatus),

    // Webhook
    index('transactions_webhook_id_idx').on(table.webhookId),

    // Lifecycle
    index('transactions_created_at_idx').on(table.createdAt),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================

    // NEW: Organization + Type + Status + Date
    index('transactions_org_type_status_date_idx').on(
      table.organizationId,
      table.type,
      table.status,
      table.transactionDate,
    ),

    // NEW: Organization + Reporting Period
    index('transactions_org_reporting_period_idx').on(
      table.organizationId,
      table.reportingPeriod,
    ),

    // NEW: Processor + Transaction ID
    index('transactions_processor_lookup_idx').on(
      table.processorType,
      table.processorTransactionId,
    ),

    // NEW: Currency + Date
    index('transactions_currency_date_idx').on(
      table.currency,
      table.transactionDate,
    ),

    // NEW: Subscription + Billing Period
    index('transactions_subscription_billing_idx').on(
      table.subscriptionId,
      table.billingPeriodStart,
    ),

    // Organization transaction history
    index('transactions_org_history_idx')
      .on(table.organizationId, table.transactionDate, table.status)
      .where(sql`status IN ('completed', 'settled')`),

    // Completed transactions by organization
    index('transactions_org_completed_idx')
      .on(table.organizationId, table.status, table.completedAt)
      .where(sql`status = 'completed'`),

    // Pending transactions
    index('transactions_pending_idx')
      .on(table.status, table.createdAt)
      .where(sql`status IN ('pending', 'processing')`),

    // Scheduled transactions due
    index('transactions_scheduled_due_idx').on(
      table.scheduledFor,
      table.status,
    ),

    // Unreconciled transactions
    index('transactions_unreconciled_idx').on(
      table.reconciled,
      table.status,
      table.completedAt,
    ).where(sql`
        reconciled = false
        AND status = 'completed'
      `),

    // Transactions by reporting period
    index('transactions_reporting_period_lookup_idx').on(
      table.reportingPeriod,
      table.organizationId,
      table.status,
    ),

    // Disputed transactions
    index('transactions_disputed_active_idx').on(
      table.disputeStatus,
      table.disputedAt,
    ).where(sql`
        dispute_status = 'pending'
      `),

    // Unsettled transactions
    index('transactions_unsettled_idx').on(
      table.settlementStatus,
      table.completedAt,
    ).where(sql`
        settlement_status IN ('pending', 'in_transit')
        AND status = 'completed'
      `),

    // High-risk transactions
    index('transactions_high_risk_idx').on(
      table.riskLevel,
      table.status,
      table.createdAt,
    ).where(sql`
        risk_level IN ('high', 'critical')
      `),

    // Recent large transactions
    index('transactions_large_recent_idx').on(
      table.amount,
      table.transactionDate,
    ),

    // Subscription transactions
    index('transactions_subscription_history_idx').on(
      table.subscriptionId,
      table.transactionDate,
      table.type,
    ).where(sql`
        subscription_id IS NOT NULL
      `),

    // Refunded transactions
    index('transactions_refunded_idx').on(
      table.refundedAmount,
      table.refundedAt,
    ).where(sql`
        refunded_amount > 0
      `),

    // NEW: Product type + Date for reporting
    index('transactions_product_date_idx').on(
      table.productType,
      table.transactionDate,
    ),

    // NEW: Retry tracking
    index('transactions_retry_due_idx').on(table.nextRetryAt, table.status)
      .where(sql`
        status IN ('pending', 'failed')
        AND retry_count < 5
      `),
  ],
)

// ============================================
// RELATIONS
// ============================================

export const transactionsRelations = relations(transactions, ({ one }) => ({
  organization: one(organizations, {
    fields: [transactions.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [transactions.subscriptionId],
    references: [subscriptions.id],
  }),
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),
  payment: one(payments, {
    fields: [transactions.paymentId],
    references: [payments.id],
  }),
  initiatedByUser: one(users, {
    fields: [transactions.initiatedBy],
    references: [users.id],
  }),
  parentTransaction: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
    relationName: 'transaction_parent',
  }),
  reversalTransaction: one(transactions, {
    fields: [transactions.reversalTransactionId],
    references: [transactions.id],
    relationName: 'transaction_reversal',
  }),
  reversedByUser: one(users, {
    fields: [transactions.reversedBy],
    references: [users.id],
    relationName: 'transaction_reversed_by',
  }),
  reconciledByUser: one(users, {
    fields: [transactions.reconciledBy],
    references: [users.id],
    relationName: 'transaction_reconciled_by',
  }),
  approvedByUser: one(users, {
    fields: [transactions.approvedBy],
    references: [users.id],
    relationName: 'transaction_approved_by',
  }),
  rejectedByUser: one(users, {
    fields: [transactions.rejectedBy],
    references: [users.id],
    relationName: 'transaction_rejected_by',
  }),
}))

// ============================================
// TYPE EXPORTS
// ============================================

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type TransactionTable = typeof transactions

// ============================================
// HELPER SELECTORS
// ============================================

export const transactionSelectors = {
  basic: {
    id: transactions.id,
    transactionNumber: transactions.transactionNumber,
    type: transactions.type,
    status: transactions.status,
    productType: transactions.productType,
    amount: transactions.amount,
    currency: transactions.currency,
    description: transactions.description,
    transactionDate: transactions.transactionDate,
    completedAt: transactions.completedAt,
    organizationId: transactions.organizationId,
  } as const,

  withDetails: {
    id: transactions.id,
    transactionNumber: transactions.transactionNumber,
    type: transactions.type,
    status: transactions.status,
    productType: transactions.productType,
    amount: transactions.amount,
    currency: transactions.currency,
    netAmount: transactions.netAmount,
    feeAmount: transactions.feeAmount,
    taxAmount: transactions.taxAmount,
    balanceImpact: transactions.balanceImpact,
    balanceBefore: transactions.balanceBefore,
    balanceAfter: transactions.balanceAfter,
    description: transactions.description,
    shortDescription: transactions.shortDescription,
    transactionDate: transactions.transactionDate,
    effectiveDate: transactions.effectiveDate,
    completedAt: transactions.completedAt,
    settledAt: transactions.settledAt,
    organizationId: transactions.organizationId,
    subscriptionId: transactions.subscriptionId,
    invoiceId: transactions.invoiceId,
    paymentId: transactions.paymentId,
  } as const,

  admin: {
    id: transactions.id,
    transactionNumber: transactions.transactionNumber,
    eventId: transactions.eventId,
    version: transactions.version,
    type: transactions.type,
    status: transactions.status,
    category: transactions.category,
    productType: transactions.productType,
    origin: transactions.origin,
    amount: transactions.amount,
    currency: transactions.currency,
    originalAmount: transactions.originalAmount,
    originalCurrency: transactions.originalCurrency,
    exchangeRate: transactions.exchangeRate,
    exchangeProvider: transactions.exchangeProvider,
    exchangeTimestamp: transactions.exchangeTimestamp,
    convertedAmount: transactions.convertedAmount,
    netAmount: transactions.netAmount,
    feeAmount: transactions.feeAmount,
    taxAmount: transactions.taxAmount,
    taxRate: transactions.taxRate,
    balanceImpact: transactions.balanceImpact,
    balanceBefore: transactions.balanceBefore,
    balanceAfter: transactions.balanceAfter,
    runningBalance: transactions.runningBalance,
    debitAccount: transactions.debitAccount,
    creditAccount: transactions.creditAccount,
    journalEntryId: transactions.journalEntryId,
    recognizedAmount: transactions.recognizedAmount,
    deferredAmount: transactions.deferredAmount,
    recognizedAt: transactions.recognizedAt,
    invoiceSnapshot: transactions.invoiceSnapshot,
    customerSnapshot: transactions.customerSnapshot,
    subscriptionSnapshot: transactions.subscriptionSnapshot,
    description: transactions.description,
    shortDescription: transactions.shortDescription,
    externalReference: transactions.externalReference,
    merchantReference: transactions.merchantReference,
    clientReference: transactions.clientReference,
    purchaseOrder: transactions.purchaseOrder,
    receiptNumber: transactions.receiptNumber,
    receiptUrl: transactions.receiptUrl,
    billingPeriodStart: transactions.billingPeriodStart,
    billingPeriodEnd: transactions.billingPeriodEnd,
    servicePeriodStart: transactions.servicePeriodStart,
    servicePeriodEnd: transactions.servicePeriodEnd,
    transactionDate: transactions.transactionDate,
    effectiveDate: transactions.effectiveDate,
    processedAt: transactions.processedAt,
    completedAt: transactions.completedAt,
    settledAt: transactions.settledAt,
    scheduledFor: transactions.scheduledFor,
    retryCount: transactions.retryCount,
    nextRetryAt: transactions.nextRetryAt,
    lastRetryAt: transactions.lastRetryAt,
    webhookId: transactions.webhookId,
    webhookEvent: transactions.webhookEvent,
    webhookReceivedAt: transactions.webhookReceivedAt,
    webhookProcessedAt: transactions.webhookProcessedAt,
    reversedAt: transactions.reversedAt,
    reversedBy: transactions.reversedBy,
    reversalReason: transactions.reversalReason,
    reversalTransactionId: transactions.reversalTransactionId,
    disputedAt: transactions.disputedAt,
    disputeReason: transactions.disputeReason,
    disputeStatus: transactions.disputeStatus,
    disputeResolution: transactions.disputeResolution,
    disputeResolvedAt: transactions.disputeResolvedAt,
    processorType: transactions.processorType,
    processorTransactionId: transactions.processorTransactionId,
    processorReference: transactions.processorReference,
    processorStatus: transactions.processorStatus,
    processorMetadata: transactions.processorMetadata,
    accountingReference: transactions.accountingReference,
    accountingCode: transactions.accountingCode,
    costCenter: transactions.costCenter,
    accountingExported: transactions.accountingExported,
    accountingExportedAt: transactions.accountingExportedAt,
    accountingBatchId: transactions.accountingBatchId,
    accountingSyncStatus: transactions.accountingSyncStatus,
    reconciled: transactions.reconciled,
    reconciledAt: transactions.reconciledAt,
    reconciledBy: transactions.reconciledBy,
    reportingPeriod: transactions.reportingPeriod,
    fiscalYear: transactions.fiscalYear,
    fiscalQuarter: transactions.fiscalQuarter,
    fiscalMonth: transactions.fiscalMonth,
    paymentMethod: transactions.paymentMethod,
    paymentMethodDetails: transactions.paymentMethodDetails,
    refundedAmount: transactions.refundedAmount,
    refundedAt: transactions.refundedAt,
    refundDetails: transactions.refundDetails,
    fees: transactions.fees,
    discounts: transactions.discounts,
    taxes: transactions.taxes,
    taxExempt: transactions.taxExempt,
    taxExemptReason: transactions.taxExemptReason,
    requiresApproval: transactions.requiresApproval,
    approvedAt: transactions.approvedAt,
    approvedBy: transactions.approvedBy,
    rejectedAt: transactions.rejectedAt,
    rejectedBy: transactions.rejectedBy,
    rejectionReason: transactions.rejectionReason,
    customerNotified: transactions.customerNotified,
    customerNotifiedAt: transactions.customerNotifiedAt,
    notificationMethod: transactions.notificationMethod,
    settlementStatus: transactions.settlementStatus,
    settlementDate: transactions.settlementDate,
    settlementReference: transactions.settlementReference,
    payoutId: transactions.payoutId,
    riskScore: transactions.riskScore,
    riskLevel: transactions.riskLevel,
    fraudDetected: transactions.fraudDetected,
    fraudReason: transactions.fraudReason,
    source: transactions.source,
    sourceReference: transactions.sourceReference,
    context: transactions.context,
    internalNotes: transactions.internalNotes,
    customerNotes: transactions.customerNotes,
    metadata: transactions.metadata,
    tags: transactions.tags,
    idempotencyKey: transactions.idempotencyKey,
    statusHistory: transactions.statusHistory,
    auditLog: transactions.auditLog,
    attachments: transactions.attachments,
    createdAt: transactions.createdAt,
    updatedAt: transactions.updatedAt,
  } as const,
}
