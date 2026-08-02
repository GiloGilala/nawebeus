// packages/database/schema/billing/payments.ts
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
  uuid,
  varchar,
  inet,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { organizations } from '../organization/organizations'
import { users } from '../auth/users'
import { subscriptions } from './subscriptions'
import { invoices } from './invoices'
import { paymentMethods } from './payment-methods'
import { tablePrefix } from '../schema-utils'
import { paymentStatusPgEnum, paymentMethodPgEnum } from '../enums'

// ============================================
// ENUMS
// ============================================

export const paymentTypeEnum = pgEnum('payment_type', [
  'subscription',
  'one_time',
  'addon',
  'usage',
  'setup_fee',
  'late_fee',
  'credit_adjustment',
  'refund',
])

export const refundReasonEnum = pgEnum('refund_reason', [
  'requested_by_customer',
  'duplicate',
  'fraudulent',
  'service_issue',
  'cancellation',
  'billing_error',
  'other',
])

export const paymentProcessorEnum = pgEnum('payment_processor', [
  'stripe',
  'paypal',
  'braintree',
  'square',
  'authorize_net',
  'manual',
  'other',
])

export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',
  'processing',
  'settled',
  'failed',
  'reversed',
])

export const riskLevelEnum = pgEnum('risk_level', [
  'low',
  'medium',
  'high',
  'critical',
])

export const actionTypeEnum = pgEnum('action_type', [
  '3d_secure',
  'redirect',
  'verify_with_microdeposits',
  'verify_with_instant',
])

export const paymentInitiatorEnum = pgEnum('payment_initiator', [
  'customer',
  'admin',
  'system',
  'cron',
  'subscription',
  'api',
  'migration',
  'checkout',
  'invoice',
])

export const createdViaEnum = pgEnum('payment_created_via', [
  'dashboard',
  'api',
  'subscription',
  'invoice',
  'checkout',
  'migration',
  'admin',
])

// ============================================
// PAYMENTS TABLE
// ============================================

export const payments = pgTable(
  `${tablePrefix}payments`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid('id').primaryKey().defaultRandom(),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),

    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),

    // NEW: Link to saved payment method
    paymentMethodId: uuid('payment_method_id').references(
      () => paymentMethods.id,
      {
        onDelete: 'set null',
      },
    ),

    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    // ============================================
    // PAYMENT DETAILS
    // ============================================
    type: paymentTypeEnum('type').notNull().default('subscription'),
    status: paymentStatusPgEnum('status').notNull().default('pending'),

    // Amount information - using numeric with higher precision
    amount: decimal('amount', { precision: 20, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),

    // Amount breakdown
    subtotal: decimal('subtotal', { precision: 20, scale: 2 }),
    taxAmount: decimal('tax_amount', { precision: 20, scale: 2 }).default(
      '0.00',
    ),
    discountAmount: decimal('discount_amount', {
      precision: 20,
      scale: 2,
    }).default('0.00'),
    creditAmount: decimal('credit_amount', { precision: 20, scale: 2 }).default(
      '0.00',
    ),

    // Fee information - supporting multiple fee components
    processingFee: decimal('processing_fee', {
      precision: 20,
      scale: 2,
    }).default('0.00'),
    platformFee: decimal('platform_fee', { precision: 20, scale: 2 }).default(
      '0.00',
    ),
    netAmount: decimal('net_amount', { precision: 20, scale: 2 }),

    // NEW: Enterprise fee breakdown
    feeBreakdown: jsonb('fee_breakdown')
      .$type<
        Array<{
          type:
            | 'processor'
            | 'network'
            | 'tax'
            | 'currency_conversion'
            | 'application'
            | 'other'
          name: string
          amount: number
          currency: string
          rate?: number
        }>
      >()
      .default([]),

    // ============================================
    // PAYMENT METHOD (Snapshot + Link)
    // ============================================
    paymentMethod: paymentMethodPgEnum('payment_method')
      .notNull()
      .default('card'),
    paymentProcessor: paymentProcessorEnum('payment_processor')
      .notNull()
      .default('stripe'),

    // Snapshot of payment method details at time of payment
    paymentMethodDetails: jsonb('payment_method_details')
      .$type<{
        // Card details
        card?: {
          brand:
            | 'visa'
            | 'mastercard'
            | 'amex'
            | 'discover'
            | 'diners'
            | 'jcb'
            | 'unionpay'
            | 'unknown'
          last4: string
          expMonth: number
          expYear: number
          country?: string
          funding?: 'credit' | 'debit' | 'prepaid' | 'unknown'
          fingerprint?: string
        }
        // Bank account details
        bankAccount?: {
          bankName?: string
          accountType?: 'checking' | 'savings'
          last4: string
          country?: string
          routingNumber?: string
        }
        // Digital wallet
        wallet?: {
          type: 'apple_pay' | 'google_pay' | 'paypal'
          email?: string
        }
        // Other
        holderName?: string
        billingAddress?: {
          line1?: string
          line2?: string
          city?: string
          state?: string
          postalCode?: string
          country?: string
        }
      }>()
      .default({}),

    // NEW: Snapshot version
    paymentMethodSnapshotVersion: integer(
      'payment_method_snapshot_version',
    ).default(1),

    // ============================================
    // PROCESSOR INTEGRATION
    // ============================================
    processorPaymentId: varchar('processor_payment_id', { length: 255 }),
    processorCustomerId: varchar('processor_customer_id', { length: 255 }),
    processorPaymentMethodId: varchar('processor_payment_method_id', {
      length: 255,
    }),

    // NEW: Idempotency key for preventing duplicate payments
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),

    // NEW: External reference
    externalReference: varchar('external_reference', { length: 255 }),
    externalSystem: varchar('external_system', { length: 50 }),

    // NEW: Checkout session
    checkoutSessionId: varchar('checkout_session_id', { length: 255 }),

    // NEW: Client secret
    clientSecret: varchar('client_secret', { length: 255 }),

    // NEW: Merchant account
    merchantAccountId: varchar('merchant_account_id', { length: 255 }),

    processorMetadata: jsonb('processor_metadata')
      .$type<{
        chargeId?: string
        transactionId?: string
        paymentIntentId?: string
        refundId?: string
        balanceTransactionId?: string
        receiptUrl?: string
        receiptNumber?: string
        statementDescriptor?: string
        raw?: Record<string, unknown>
      }>()
      .default({}),

    // ============================================
    // TRANSACTION DETAILS
    // ============================================
    description: text('description'),
    statementDescriptor: varchar('statement_descriptor', { length: 22 }),

    // Line items for this payment
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

    // Applied discounts/coupons
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

    // Tax breakdown
    taxes: jsonb('taxes')
      .$type<
        Array<{
          name: string
          rate: number
          amount: number
          jurisdiction?: string
        }>
      >()
      .default([]),

    // ============================================
    // TIMING
    // ============================================
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    succeededAt: timestamp('succeeded_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),

    // For scheduled/future payments
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),

    // Billing period (for subscription payments)
    billingPeriodStart: timestamp('billing_period_start', {
      withTimezone: true,
    }),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),

    // ============================================
    // FAILURE & RETRY (Enhanced)
    // ============================================
    failureReason: text('failure_reason'),
    failureMessage: text('failure_message'),

    // NEW: Separate processor failure codes
    processorFailureCode: varchar('processor_failure_code', { length: 100 }),
    processorDeclineCode: varchar('processor_decline_code', { length: 100 }),
    internalFailureCode: varchar('internal_failure_code', { length: 100 }),

    // Retry information
    attemptCount: integer('attempt_count').notNull().default(1),
    maxAttempts: integer('max_attempts').default(3),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),

    // Decline information
    declineCode: varchar('decline_code', { length: 100 }),

    // ============================================
    // FRAUD/RISK (Enhanced)
    // ============================================
    riskScore: integer('risk_score'), // 0-100
    riskLevel: riskLevelEnum('risk_level').default('low'),
    fraudDetected: boolean('fraud_detected').notNull().default(false),

    // ============================================
    // REFUND INFORMATION
    // ============================================
    refundedAmount: decimal('refunded_amount', {
      precision: 20,
      scale: 2,
    }).default('0.00'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundReason: refundReasonEnum('refund_reason'),
    refundNote: text('refund_note'),

    // REFUND: Normalize to separate table recommended for enterprise
    refundDetails: jsonb('refund_details')
      .$type<
        Array<{
          id: string
          amount: number
          reason: string
          refundedAt: string
          processorRefundId?: string
          refundedBy?: string // User ID
        }>
      >()
      .default([]),

    // ============================================
    // AUTHORIZATION & CAPTURE
    // ============================================
    requiresCapture: boolean('requires_capture').notNull().default(false),
    authorizedAmount: decimal('authorized_amount', { precision: 20, scale: 2 }),
    capturedAmount: decimal('captured_amount', {
      precision: 20,
      scale: 2,
    }).default('0.00'),

    authorizationCode: varchar('authorization_code', { length: 100 }),
    authorizationExpiresAt: timestamp('authorization_expires_at', {
      withTimezone: true,
    }),

    // ============================================
    // CUSTOMER ACTIONS
    // ============================================
    requiresAction: boolean('requires_action').notNull().default(false),
    actionType: actionTypeEnum('action_type'),
    actionUrl: varchar('action_url', { length: 500 }),
    actionCompletedAt: timestamp('action_completed_at', { withTimezone: true }),

    // ============================================
    // DEVICE & NETWORK INFORMATION (NEW)
    // ============================================
    ipAddress: inet('ip_address'),
    country: varchar('country', { length: 2 }),
    city: varchar('city', { length: 100 }),
    region: varchar('region', { length: 100 }),
    timezone: varchar('timezone', { length: 50 }),

    // NEW: Network detection
    asn: varchar('asn', { length: 50 }),
    proxyDetected: boolean('proxy_detected').default(false),
    vpnDetected: boolean('vpn_detected').default(false),

    // NEW: Device fingerprinting
    deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
    browserFingerprint: varchar('browser_fingerprint', { length: 255 }),
    operatingSystem: varchar('operating_system', { length: 100 }),
    deviceType: varchar('device_type', { length: 50 }),
    appVersion: varchar('app_version', { length: 50 }),

    // ============================================
    // PAYMENT HISTORY & WEBHOOKS (Enterprise: Use separate tables)
    // ============================================
    events: jsonb('events')
      .$type<
        Array<{
          timestamp: string
          event: string
          status: string
          message?: string
          metadata?: Record<string, unknown>
        }>
      >()
      .default([]),

    webhookEvents: jsonb('webhook_events')
      .$type<
        Array<{
          id: string
          type: string
          receivedAt: string
          processed: boolean
          data?: Record<string, unknown>
        }>
      >()
      .default([]),

    // ============================================
    // MULTI-CURRENCY (NEW)
    // ============================================
    exchangeRate: decimal('exchange_rate', { precision: 20, scale: 6 }),
    baseCurrency: varchar('base_currency', { length: 3 }),
    convertedAmount: decimal('converted_amount', { precision: 20, scale: 2 }),

    // ============================================
    // DISPUTES & CHARGEBACKS (NEW)
    // ============================================
    disputeStatus: varchar('dispute_status', { length: 50 }),
    disputeOpenedAt: timestamp('dispute_opened_at', { withTimezone: true }),
    disputeWonAt: timestamp('dispute_won_at', { withTimezone: true }),
    disputeLostAt: timestamp('dispute_lost_at', { withTimezone: true }),
    disputeReason: varchar('dispute_reason', { length: 255 }),
    disputeDeadline: timestamp('dispute_deadline_at', { withTimezone: true }),
    processorDisputeId: varchar('processor_dispute_id', { length: 255 }),

    chargebackStatus: varchar('chargeback_status', { length: 50 }),
    chargebackAmount: decimal('chargeback_amount', { precision: 20, scale: 2 }),
    chargebackAt: timestamp('chargeback_at', { withTimezone: true }),

    // ============================================
    // RECONCILIATION & ACCOUNTING
    // ============================================
    reconciled: boolean('reconciled').notNull().default(false),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    reconciledBy: uuid('reconciled_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    accountingReference: varchar('accounting_reference', { length: 100 }),
    journalEntryId: varchar('journal_entry_id', { length: 255 }),
    ledgerTransactionId: varchar('ledger_transaction_id', { length: 255 }),

    settlementStatus:
      settlementStatusEnum('settlement_status').default('pending'),
    settlementDate: timestamp('settlement_date', { withTimezone: true }),
    settlementAmount: decimal('settlement_amount', { precision: 20, scale: 2 }),

    // ============================================
    // PROCESSING DURATION (NEW)
    // ============================================
    processingStartedAt: timestamp('processing_started_at', {
      withTimezone: true,
    }),
    processingCompletedAt: timestamp('processing_completed_at', {
      withTimezone: true,
    }),
    processingDurationMs: integer('processing_duration_ms'),

    // ============================================
    // COMPLIANCE & TAX
    // ============================================
    taxExempt: boolean('tax_exempt').notNull().default(false),
    taxId: varchar('tax_id', { length: 100 }),

    // REMOVED: pciCompliant (belongs to processor/merchant, not payment)

    // ============================================
    // AUDIT (NEW)
    // ============================================
    createdVia: createdViaEnum('created_via'),
    initiator: paymentInitiatorEnum('initiator'),

    // ============================================
    // NOTES & METADATA
    // ============================================
    internalNotes: text('internal_notes'),
    customerNotes: text('customer_notes'),

    metadata: jsonb('metadata')
      .$type<{
        orderId?: string
        campaignId?: string
        affiliateId?: string
        source?: string
        customFields?: Record<string, unknown>
      }>()
      .default({}),

    tags: jsonb('tags').$type<Array<string>>().default([]),

    // ============================================
    // NOTIFICATIONS
    // ============================================
    emailSent: boolean('email_sent').notNull().default(false),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    receiptUrl: varchar('receipt_url', { length: 500 }),
    receiptNumber: varchar('receipt_number', { length: 100 }),

    // ============================================
    // CANCELLATION
    // ============================================
    canceledBy: uuid('canceled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancellationReason: varchar('cancellation_reason', { length: 255 }),

    // ============================================
    // TIMESTAMPS (No soft delete for payments)
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
    // UNIQUE INDEXES
    // ============================================

    // Prevent duplicate processor payment records
    uniqueIndex('payments_processor_payment_unique')
      .on(table.paymentProcessor, table.processorPaymentId)
      .where(sql`processor_payment_id IS NOT NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================

    // Relationships
    index('payments_org_idx').on(table.organizationId),
    index('payments_subscription_idx').on(table.subscriptionId),
    index('payments_invoice_idx').on(table.invoiceId),
    index('payments_payment_method_idx').on(table.paymentMethodId),
    index('payments_user_idx').on(table.userId),

    // Status and type
    index('payments_status_idx').on(table.status),
    index('payments_type_idx').on(table.type),
    index('payments_payment_method_enum_idx').on(table.paymentMethod),
    index('payments_processor_idx').on(table.paymentProcessor),

    // Processor references
    index('payments_processor_payment_id_idx').on(table.processorPaymentId),
    index('payments_processor_customer_id_idx').on(table.processorCustomerId),

    // Timing
    index('payments_attempted_at_idx').on(table.attemptedAt),
    index('payments_succeeded_at_idx').on(table.succeededAt),
    index('payments_failed_at_idx').on(table.failedAt),
    index('payments_scheduled_for_idx').on(table.scheduledFor),
    index('payments_next_retry_at_idx').on(table.nextRetryAt),

    // Billing period
    index('payments_billing_period_idx').on(
      table.billingPeriodStart,
      table.billingPeriodEnd,
    ),

    // Refunds
    index('payments_refunded_at_idx').on(table.refundedAt),
    index('payments_refund_reason_idx').on(table.refundReason),

    // Reconciliation
    index('payments_reconciled_idx').on(table.reconciled),
    index('payments_reconciled_at_idx').on(table.reconciledAt),
    index('payments_settlement_status_idx').on(table.settlementStatus),
    index('payments_settlement_date_idx').on(table.settlementDate),

    // Actions
    index('payments_requires_action_idx').on(table.requiresAction),
    index('payments_requires_capture_idx').on(table.requiresCapture),

    // Fraud
    index('payments_fraud_detected_idx').on(table.fraudDetected),
    index('payments_risk_level_idx').on(table.riskLevel),

    // Audit
    index('payments_created_via_idx').on(table.createdVia),
    index('payments_initiator_idx').on(table.initiator),

    // Lifecycle
    index('payments_created_at_idx').on(table.createdAt),
    index('payments_updated_at_idx').on(table.updatedAt),

    // Idempotency
    index('payments_idempotency_key_idx').on(table.idempotencyKey),

    // IP
    index('payments_ip_address_idx').on(table.ipAddress),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================

    // Organization + Invoice
    index('payments_org_invoice_idx')
      .on(table.organizationId, table.invoiceId)
      .where(sql`invoice_id IS NOT NULL`),

    // Organization + Subscription
    index('payments_org_subscription_idx')
      .on(table.organizationId, table.subscriptionId)
      .where(sql`subscription_id IS NOT NULL`),

    // Organization + Processor
    index('payments_org_processor_idx')
      .on(table.organizationId, table.paymentProcessor)
      .where(sql`deleted_at IS NULL`),

    // Organization + Currency
    index('payments_org_currency_idx').on(table.organizationId, table.currency),

    // Organization + Payment Method
    index('payments_org_method_idx').on(
      table.organizationId,
      table.paymentMethod,
    ),

    // Successful payments by organization
    index('payments_org_succeeded_idx')
      .on(table.organizationId, table.status, table.succeededAt)
      .where(sql`status = 'succeeded'`),

    // Failed payments needing retry
    index('payments_retry_pending_idx').on(
      table.status,
      table.nextRetryAt,
      table.attemptCount,
    ),

    // Pending payments by organization
    index('payments_org_pending_idx')
      .on(table.organizationId, table.status, table.createdAt)
      .where(sql`status IN ('pending', 'processing')`),

    // Payments requiring action
    index('payments_action_required_idx')
      .on(table.requiresAction, table.status, table.createdAt)
      .where(sql`requires_action = true AND status = 'requires_action'`),

    // Unreconciled successful payments
    index('payments_unreconciled_idx')
      .on(table.reconciled, table.status, table.succeededAt)
      .where(sql`reconciled = false AND status = 'succeeded'`),

    // Scheduled payments due
    index('payments_scheduled_due_idx').on(table.scheduledFor, table.status),

    // Recent payments for organization (dashboard)
    index('payments_org_recent_idx').on(
      table.organizationId,
      table.createdAt,
      table.status,
    ),

    // Refunded payments
    index('payments_refunded_idx')
      .on(table.status, table.refundedAt, table.refundedAmount)
      .where(sql`status IN ('refunded', 'partially_refunded')`),

    // High-risk payments for review
    index('payments_high_risk_idx').on(
      table.riskLevel,
      table.status,
      table.createdAt,
    ).where(sql`
        risk_level IN ('high', 'critical') 
        AND status IN ('pending', 'requires_action')
      `),

    // Settlement tracking
    index('payments_settlement_pending_idx').on(
      table.settlementStatus,
      table.succeededAt,
    ).where(sql`
        settlement_status IN ('pending', 'in_transit')
        AND status = 'succeeded'
      `),

    // Disputes
    index('payments_dispute_status_idx').on(
      table.disputeStatus,
      table.disputeOpenedAt,
    ),

    // Chargebacks
    index('payments_chargeback_status_idx').on(
      table.chargebackStatus,
      table.chargebackAt,
    ),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index('payments_metadata_gin_idx')
      .using('gin', table.metadata)
      .where(sql`metadata IS NOT NULL`),

    index('payments_tags_gin_idx')
      .using('gin', table.tags)
      .where(sql`tags IS NOT NULL`),

    index('payments_line_items_gin_idx')
      .using('gin', table.lineItems)
      .where(sql`line_items IS NOT NULL`),

    index('payments_fee_breakdown_gin_idx')
      .using('gin', table.feeBreakdown)
      .where(sql`fee_breakdown IS NOT NULL`),
  ],
)

// ============================================
// RELATIONS
// ============================================

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payments.paymentMethodId],
    references: [paymentMethods.id],
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  reconciledByUser: one(users, {
    fields: [payments.reconciledBy],
    references: [users.id],
    relationName: 'payment_reconciled_by',
  }),
  canceledByUser: one(users, {
    fields: [payments.canceledBy],
    references: [users.id],
    relationName: 'payment_canceled_by',
  }),
}))
