// packages/database/schema/billing/payment-methods.ts

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "../auth/users";
import { organizations } from "../organization/organizations";
import { tablePrefix } from "../schema-utils";

// ============================================
// ENUMS
// ============================================

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "card",
  "bank_account",
  "paypal",
  "apple_pay",
  "google_pay",
  "sepa_debit",
  "ach_debit",
  "bacs_debit",
  "au_becs_debit",
  "us_bank_account",
  "link",
  "crypto_wallet",
  "other",
]);

export const paymentMethodStatusEnum = pgEnum("payment_method_status", [
  "active",
  "inactive",
  "verification_pending",
  "verification_failed",
  "expired",
  "canceled",
]);

export const cardBrandEnum = pgEnum("card_brand", [
  "visa",
  "mastercard",
  "amex",
  "discover",
  "diners",
  "jcb",
  "unionpay",
  "maestro",
  "elo",
  "mir",
  "unknown",
]);

export const cardFundingEnum = pgEnum("card_funding", ["credit", "debit", "prepaid", "unknown"]);

export const bankAccountTypeEnum = pgEnum("bank_account_type", [
  "checking",
  "savings",
  "business_checking",
  "business_savings",
]);

export const processorTypeEnum = pgEnum("processor_type", [
  "stripe",
  "paypal",
  "paystack",
  "flutterwave",
  "square",
  "adyen",
  "razorpay",
  "cashfree",
  "monnify",
  "opay",
  "momo",
  "braintree",
  "authorize_net",
  "worldpay",
  "other",
]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical", "blocked"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "processing",
  "verified",
  "failed",
  "expired",
  "manual_review",
]);

export const accountHolderTypeEnum = pgEnum("account_holder_type", [
  "individual",
  "company",
  "government",
  "non_profit",
]);

export const verificationMethodEnum = pgEnum("verification_method", [
  "instant",
  "micro_deposit",
  "manual",
  "processor",
  "bank_api",
  "third_party",
]);

export const cvcCheckEnum = pgEnum("cvc_check", ["pass", "fail", "unchecked", "unavailable"]);

export const addressCheckEnum = pgEnum("address_check", [
  "pass",
  "fail",
  "unchecked",
  "unavailable",
]);

export const fraudStatusEnum = pgEnum("fraud_status", [
  "clean",
  "suspected",
  "confirmed",
  "blocked",
]);

export const blockStatusEnum = pgEnum("block_status", ["active", "blocked", "released"]);

export const walletProviderEnum = pgEnum("wallet_provider", [
  "apple_pay",
  "google_pay",
  "samsung_pay",
  "paypal",
  "venmo",
  "cash_app",
  "other",
]);

export const networkTokenStatusEnum = pgEnum("network_token_status", [
  "enabled",
  "disabled",
  "pending",
  "failed",
]);

export const sourceEnum = pgEnum("payment_method_source", [
  "checkout",
  "subscription",
  "admin",
  "mobile",
  "invoice",
  "api",
  "migration",
  "import",
  "dashboard",
]);

// ============================================
// PAYMENT METHODS TABLE
// ============================================

export const paymentMethods = pgTable(
  `${tablePrefix}payment_methods`,
  {
    // ============================================
    // CORE IDENTIFIERS
    // ============================================
    id: uuid("id").notNull().primaryKey().defaultRandom(),

    // ============================================
    // RELATIONSHIPS
    // ============================================
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // FIXED: removed .notNull() to allow SET NULL
    addedBy: uuid("added_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // ============================================
    // PAYMENT METHOD DETAILS
    // ============================================
    type: paymentMethodTypeEnum("type").notNull(),
    status: paymentMethodStatusEnum("status").notNull().default("active"),

    // Display information
    nickname: varchar("nickname", { length: 100 }),
    isDefault: boolean("is_default").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),

    // ============================================
    // PROCESSOR INTEGRATION
    // ============================================
    processorType: processorTypeEnum("processor_type").notNull(),
    processorPaymentMethodId: varchar("processor_payment_method_id", {
      length: 255,
    }).notNull(),
    processorCustomerId: varchar("processor_customer_id", { length: 255 }),

    // NEW: Processor PCI compliance status
    processorPciCompliant: boolean("processor_pci_compliant").default(true),

    processorMetadata: jsonb("processor_metadata")
      .$type<{
        setupIntentId?: string;
        mandateId?: string;
        raw?: Record<string, unknown>;
      }>()
      .default({}),

    // ============================================
    // CARD DETAILS (if type = card)
    // ============================================
    cardBrand: cardBrandEnum("card_brand"),
    cardLast4: varchar("card_last4", { length: 4 }),
    cardExpMonth: integer("card_exp_month"),
    cardExpYear: integer("card_exp_year"),
    cardFunding: cardFundingEnum("card_funding"),
    cardCountry: varchar("card_country", { length: 2 }),
    cardFingerprint: varchar("card_fingerprint", { length: 64 }),

    // Card capabilities
    card3dsSupported: boolean("card_3ds_supported").default(false),
    cardContactless: boolean("card_contactless").default(false),

    // Card issuer
    cardIssuer: varchar("card_issuer", { length: 100 }),
    cardBin: varchar("card_bin", { length: 8 }),

    // ============================================
    // TOKENIZATION (NEW)
    // ============================================
    tokenized: boolean("tokenized").default(false),
    tokenVersion: varchar("token_version", { length: 20 }),
    tokenProvider: varchar("token_provider", { length: 50 }),

    // Network Token (NEW)
    networkTokenEnabled: boolean("network_token_enabled").default(false),
    networkTokenStatus: networkTokenStatusEnum("network_token_status").default("disabled"),
    networkTokenId: varchar("network_token_id", { length: 255 }),

    // ============================================
    // BANK ACCOUNT DETAILS (if type = bank_account)
    // ============================================
    bankName: varchar("bank_name", { length: 100 }),
    bankAccountType: bankAccountTypeEnum("bank_account_type"),
    bankAccountLast4: varchar("bank_account_last4", { length: 4 }),
    bankRoutingNumber: varchar("bank_routing_number", { length: 20 }),
    bankCountry: varchar("bank_country", { length: 2 }),
    bankCurrency: varchar("bank_currency", { length: 3 }).default("USD"),
    bankFingerprint: varchar("bank_fingerprint", { length: 64 }), // NEW: For duplicate detection

    // Account holder
    accountHolderName: varchar("account_holder_name", { length: 200 }),
    accountHolderType: accountHolderTypeEnum("account_holder_type"),

    // ============================================
    // DIGITAL WALLET DETAILS (NEW)
    // ============================================
    walletProvider: walletProviderEnum("wallet_provider"),
    walletEmail: varchar("wallet_email", { length: 255 }),
    walletPhoneNumber: varchar("wallet_phone_number", { length: 20 }),
    walletAccountId: varchar("wallet_account_id", { length: 255 }),

    // ============================================
    // CRYPTO WALLET DETAILS (if type = crypto_wallet)
    // ============================================
    cryptoAddress: varchar("crypto_address", { length: 255 }),
    cryptoCurrency: varchar("crypto_currency", { length: 20 }),
    cryptoNetwork: varchar("crypto_network", { length: 50 }),

    // ============================================
    // BILLING ADDRESS
    // ============================================
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

    // Preferred billing currency (NEW)
    preferredCurrency: varchar("preferred_currency", { length: 3 }).default("USD"),

    // ============================================
    // VERIFICATION & SECURITY
    // ============================================
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationMethod: verificationMethodEnum("verification_method"),
    verificationAttempts: integer("verification_attempts").default(0),
    verificationStatus: verificationStatusEnum("verification_status"),

    verificationDetails: jsonb("verification_details")
      .$type<{
        microdepositsVerified?: boolean;
        microdepositsAttempts?: number;
        instantVerified?: boolean;
        verificationToken?: string;
      }>()
      .default({}),

    // Security checks (using enums)
    cvcCheck: cvcCheckEnum("cvc_check").default("unchecked"),
    addressLine1Check: addressCheckEnum("address_line1_check").default("unchecked"),
    addressPostalCodeCheck: addressCheckEnum("address_postal_code_check").default("unchecked"),

    // ============================================
    // FRAUD DETECTION (Enhanced)
    // ============================================
    riskScore: integer("risk_score").default(0), // 0-100
    riskLevel: riskLevelEnum("risk_level").default("low"),
    fraudStatus: fraudStatusEnum("fraud_status").default("clean"),
    blockStatus: blockStatusEnum("block_status").default("active"),
    blocklistReason: varchar("blocklist_reason", { length: 255 }),

    // ============================================
    // USAGE & STATISTICS
    // ============================================
    usageCount: integer("usage_count").notNull().default(0),
    // FIXED: Use numeric for financial amounts
    totalAmountProcessed: numeric("total_amount_processed", {
      precision: 20,
      scale: 2,
    }).default("0"),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    firstUsedAt: timestamp("first_used_at", { withTimezone: true }),
    lastSuccessfulChargeAt: timestamp("last_successful_charge_at", {
      withTimezone: true,
    }), // NEW

    // REMOVED: successRate (derived)
    successfulCharges: integer("successful_charges").default(0),
    failedCharges: integer("failed_charges").default(0),

    // NEW: Last failure details
    lastFailureCode: varchar("last_failure_code", { length: 50 }),
    lastFailureReason: text("last_failure_reason"),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),

    // ============================================
    // CAPABILITIES & LIMITS
    // ============================================
    capabilities: jsonb("capabilities")
      .$type<{
        supportsRecurring: boolean;
        supportsOneTime: boolean;
        supportsRefunds: boolean;
        supportsDisputes: boolean;
        supportsCapture: boolean;
        supports3DSecure: boolean;
        supportsInternational: boolean;
        maxAmount?: number;
        minAmount?: number;
        supportedCurrencies?: Array<string>;
      }>()
      .default({
        supportsRecurring: true,
        supportsOneTime: true,
        supportsRefunds: true,
        supportsDisputes: false,
        supportsCapture: true,
        supports3DSecure: false,
        supportsInternational: false,
      }),

    // ============================================
    // EXPIRATION & LIFECYCLE
    // ============================================
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // REMOVED: expiresSoon (derived)
    // REMOVED: expired (derived)

    // Automatic updates (for cards)
    autoUpdateEnabled: boolean("auto_update_enabled").default(true),
    lastAutoUpdateAt: timestamp("last_auto_update_at", { withTimezone: true }),
    autoUpdateSource: varchar("auto_update_source", { length: 50 }),

    // ============================================
    // PREFERENCES & SETTINGS
    // ============================================
    preferences: jsonb("preferences")
      .$type<{
        allowRecurring?: boolean;
        allowOneTime?: boolean;
        requireCVC?: boolean;
        require3DSecure?: boolean;
        maxTransactionAmount?: number;
        dailyLimit?: number;
        monthlyLimit?: number;
        notifyOnCharge?: boolean;
        notifyOnExpiry?: boolean;
      }>()
      .default({
        allowRecurring: true,
        allowOneTime: true,
        requireCVC: false,
        require3DSecure: false,
        notifyOnCharge: false,
        notifyOnExpiry: true,
      }),

    // ============================================
    // MANDATES & AUTHORIZATION
    // ============================================
    mandateAccepted: boolean("mandate_accepted").default(false),
    mandateAcceptedAt: timestamp("mandate_accepted_at", { withTimezone: true }),
    mandateReference: varchar("mandate_reference", { length: 255 }),
    mandateUrl: varchar("mandate_url", { length: 500 }),

    mandateDetails: jsonb("mandate_details")
      .$type<{
        type?: "single" | "recurring";
        acceptedBy?: string;
        ipAddress?: string;
        userAgent?: string;
        acceptanceMethod?: "online" | "offline" | "api";
        acceptedCountry?: string; // NEW
        acceptedLocation?: string; // NEW
        acceptedDevice?: string; // NEW
        browserFingerprint?: string; // NEW
      }>()
      .default({}),

    // ============================================
    // DEACTIVATION & REMOVAL
    // ============================================
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivatedBy: uuid("deactivated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deactivationReason: varchar("deactivation_reason", { length: 255 }),

    canBeReactivated: boolean("can_be_reactivated").default(true),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deletionReason: varchar("deletion_reason", { length: 255 }),

    // ============================================
    // NOTIFICATIONS & REMINDERS
    // ============================================
    expiryReminderSent: boolean("expiry_reminder_sent").default(false),
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", {
      withTimezone: true,
    }),

    updateRequestedAt: timestamp("update_requested_at", { withTimezone: true }),
    updateRemindersSent: integer("update_reminders_sent").default(0),

    // ============================================
    // COMPLIANCE & REGULATORY
    // ============================================
    // REMOVED: pciCompliant (misleading - renamed to processorPciCompliant)
    strongCustomerAuthRequired: boolean("strong_customer_auth_required").default(false),

    complianceChecks: jsonb("compliance_checks")
      .$type<{
        kycVerified?: boolean;
        kycVerifiedAt?: string;
        amlChecked?: boolean;
        amlCheckedAt?: string;
        sanctionsChecked?: boolean;
        sanctionsCheckedAt?: string;
      }>()
      .default({}),

    // ============================================
    // AUDIT INFORMATION (NEW)
    // ============================================
    createdFromIp: inet("created_from_ip"),
    createdFromCountry: varchar("created_from_country", { length: 2 }),
    createdDevice: varchar("created_device", { length: 100 }),
    createdPlatform: varchar("created_platform", { length: 50 }),
    createdVia: sourceEnum("created_via"),

    // ============================================
    // NOTES & METADATA
    // ============================================
    internalNotes: text("internal_notes"),
    customerNotes: text("customer_notes"),

    metadata: jsonb("metadata")
      .$type<{
        source?: string;
        campaign?: string;
        imported?: boolean;
        customFields?: Record<string, unknown>;
      }>()
      .default({}),

    tags: jsonb("tags").$type<Array<string>>().default([]),

    // ============================================
    // TIMESTAMPS
    // ============================================
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    // ============================================
    // UNIQUE CONSTRAINTS
    // ============================================

    // Only one default payment method per organization
    uniqueIndex("payment_methods_org_default_unique")
      .on(table.organizationId)
      .where(sql`is_default = true AND deleted_at IS NULL`),

    // Only one primary payment method per organization
    uniqueIndex("payment_methods_org_primary_unique")
      .on(table.organizationId)
      .where(sql`is_primary = true AND deleted_at IS NULL`),

    // Unique processor payment method ID per processor
    uniqueIndex("payment_methods_processor_id_unique")
      .on(table.processorType, table.processorPaymentMethodId)
      .where(sql`deleted_at IS NULL`),

    // ============================================
    // CORE INDEXES
    // ============================================

    // Relationships
    index("payment_methods_org_idx").on(table.organizationId),
    index("payment_methods_added_by_idx").on(table.addedBy),

    // Status and type
    index("payment_methods_status_idx").on(table.status),
    index("payment_methods_type_idx").on(table.type),
    index("payment_methods_is_default_idx").on(table.isDefault),
    index("payment_methods_is_primary_idx").on(table.isPrimary),

    // Processor
    index("payment_methods_processor_type_idx").on(table.processorType),
    index("payment_methods_processor_payment_method_id_idx").on(table.processorPaymentMethodId),
    index("payment_methods_processor_customer_id_idx").on(table.processorCustomerId),

    // Card details
    index("payment_methods_card_brand_idx").on(table.cardBrand),
    index("payment_methods_card_last4_idx").on(table.cardLast4),
    index("payment_methods_card_fingerprint_idx").on(table.cardFingerprint),

    // Verification
    index("payment_methods_is_verified_idx").on(table.isVerified),
    index("payment_methods_verified_at_idx").on(table.verifiedAt),
    index("payment_methods_verification_status_idx").on(table.verificationStatus),

    // Security
    index("payment_methods_fraud_status_idx").on(table.fraudStatus),
    index("payment_methods_block_status_idx").on(table.blockStatus),
    index("payment_methods_risk_level_idx").on(table.riskLevel),

    // Usage
    index("payment_methods_last_used_at_idx").on(table.lastUsedAt),
    index("payment_methods_usage_count_idx").on(table.usageCount),

    // Expiration
    index("payment_methods_expires_at_idx").on(table.expiresAt),

    // Lifecycle
    index("payment_methods_deactivated_at_idx").on(table.deactivatedAt),
    index("payment_methods_deleted_at_idx").on(table.deletedAt),
    index("payment_methods_created_at_idx").on(table.createdAt),

    // Audit (NEW)
    index("payment_methods_created_via_idx").on(table.createdVia),
    index("payment_methods_created_from_ip_idx").on(table.createdFromIp),

    // ============================================
    // COMPOSITE INDEXES
    // ============================================

    // Active payment methods for organization
    index("payment_methods_org_active_idx")
      .on(table.organizationId, table.status, table.isDefault)
      .where(sql`
        status = 'active' 
        AND deleted_at IS NULL
      `),

    // Default payment method lookup
    index("payment_methods_org_default_lookup_idx")
      .on(table.organizationId, table.isDefault, table.status)
      .where(sql`
        is_default = true 
        AND status = 'active' 
        AND deleted_at IS NULL
      `),

    // Organization + Type (NEW)
    index("payment_methods_org_type_idx")
      .on(table.organizationId, table.type)
      .where(sql`deleted_at IS NULL`),

    // Organization + Verified (NEW)
    index("payment_methods_org_verified_idx")
      .on(table.organizationId, table.isVerified)
      .where(sql`deleted_at IS NULL`),

    // Organization + Processor (NEW)
    index("payment_methods_org_processor_idx")
      .on(table.organizationId, table.processorType)
      .where(sql`deleted_at IS NULL`),

    // Organization + Deleted (NEW)
    index("payment_methods_org_deleted_idx")
      .on(table.organizationId, table.deletedAt)
      .where(sql`deleted_at IS NOT NULL`),

    // Expiring soon (for reminders)
    index("payment_methods_expiring_soon_idx")
      .on(table.expiresAt, table.status)
      .where(sql`
        status = 'active' 
        AND deleted_at IS NULL
        AND expires_at IS NOT NULL
        AND expires_at < now() + interval '2 months'
      `),

    // Expired (for cleanup)
    index("payment_methods_expired_cleanup_idx")
      .on(table.expiresAt)
      .where(sql`
        status = 'active' 
        AND deleted_at IS NULL
        AND expires_at IS NOT NULL
        AND expires_at < now()
      `),

    // Verification pending
    index("payment_methods_verification_pending_idx")
      .on(table.status, table.isVerified, table.createdAt)
      .where(sql`
        status = 'verification_pending' 
        AND is_verified = false
        AND deleted_at IS NULL
      `),

    // Blocked payment methods
    index("payment_methods_blocked_active_idx")
      .on(table.blockStatus, table.organizationId)
      .where(sql`
        block_status = 'blocked' 
        AND deleted_at IS NULL
      `),

    // High-risk payment methods
    index("payment_methods_high_risk_idx")
      .on(table.riskLevel, table.status)
      .where(sql`
        risk_level IN ('high', 'critical')
        AND status = 'active'
        AND deleted_at IS NULL
      `),

    // Recently added
    index("payment_methods_recent_idx")
      .on(table.organizationId, table.createdAt)
      .where(sql`deleted_at IS NULL`),

    // Unused payment methods (for cleanup suggestions)
    index("payment_methods_unused_idx")
      .on(table.lastUsedAt, table.status)
      .where(sql`
        status = 'active'
        AND deleted_at IS NULL
        AND last_used_at IS NOT NULL
        AND last_used_at < now() - interval '180 days'
      `),

    // Update reminders
    index("payment_methods_update_reminder_idx")
      .on(table.updateRequestedAt, table.updateRemindersSent)
      .where(sql`
        update_requested_at IS NOT NULL
        AND update_reminders_sent < 3
        AND status = 'active'
        AND deleted_at IS NULL
      `),

    // ============================================
    // JSONB GIN INDEXES
    // ============================================
    index("payment_methods_metadata_gin_idx")
      .using("gin", table.metadata)
      .where(sql`deleted_at IS NULL`),

    index("payment_methods_tags_gin_idx").using("gin", table.tags).where(sql`deleted_at IS NULL`),

    index("payment_methods_capabilities_gin_idx")
      .using("gin", table.capabilities)
      .where(sql`deleted_at IS NULL`),

    index("payment_methods_preferences_gin_idx")
      .using("gin", table.preferences)
      .where(sql`deleted_at IS NULL`),
  ],
);

// ============================================
// RELATIONS
// ============================================

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentMethods.organizationId],
    references: [organizations.id],
  }),
  addedByUser: one(users, {
    fields: [paymentMethods.addedBy],
    references: [users.id],
  }),
  deactivatedByUser: one(users, {
    fields: [paymentMethods.deactivatedBy],
    references: [users.id],
    relationName: "payment_method_deactivated_by",
  }),
  deletedByUser: one(users, {
    fields: [paymentMethods.deletedBy],
    references: [users.id],
    relationName: "payment_method_deleted_by",
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type PaymentMethodTable = typeof paymentMethods;

// ============================================
// HELPER SELECTORS
// ============================================

export const paymentMethodSelectors = {
  basic: {
    id: paymentMethods.id,
    organizationId: paymentMethods.organizationId,
    type: paymentMethods.type,
    status: paymentMethods.status,
    isDefault: paymentMethods.isDefault,
    isPrimary: paymentMethods.isPrimary,
    nickname: paymentMethods.nickname,
    processorType: paymentMethods.processorType,
    lastUsedAt: paymentMethods.lastUsedAt,
    expiresAt: paymentMethods.expiresAt,
    isVerified: paymentMethods.isVerified,
  } as const,

  card: {
    id: paymentMethods.id,
    cardBrand: paymentMethods.cardBrand,
    cardLast4: paymentMethods.cardLast4,
    cardExpMonth: paymentMethods.cardExpMonth,
    cardExpYear: paymentMethods.cardExpYear,
    cardFunding: paymentMethods.cardFunding,
    cardCountry: paymentMethods.cardCountry,
  } as const,

  bank: {
    id: paymentMethods.id,
    bankName: paymentMethods.bankName,
    bankAccountType: paymentMethods.bankAccountType,
    bankAccountLast4: paymentMethods.bankAccountLast4,
    bankCountry: paymentMethods.bankCountry,
    bankCurrency: paymentMethods.bankCurrency,
    accountHolderName: paymentMethods.accountHolderName,
  } as const,

  admin: {
    id: paymentMethods.id,
    organizationId: paymentMethods.organizationId,
    addedBy: paymentMethods.addedBy,
    type: paymentMethods.type,
    status: paymentMethods.status,
    nickname: paymentMethods.nickname,
    isDefault: paymentMethods.isDefault,
    isPrimary: paymentMethods.isPrimary,
    processorType: paymentMethods.processorType,
    processorPaymentMethodId: paymentMethods.processorPaymentMethodId,
    processorCustomerId: paymentMethods.processorCustomerId,
    isVerified: paymentMethods.isVerified,
    verificationStatus: paymentMethods.verificationStatus,
    riskLevel: paymentMethods.riskLevel,
    fraudStatus: paymentMethods.fraudStatus,
    blockStatus: paymentMethods.blockStatus,
    usageCount: paymentMethods.usageCount,
    totalAmountProcessed: paymentMethods.totalAmountProcessed,
    lastUsedAt: paymentMethods.lastUsedAt,
    firstUsedAt: paymentMethods.firstUsedAt,
    expiresAt: paymentMethods.expiresAt,
    createdAt: paymentMethods.createdAt,
    updatedAt: paymentMethods.updatedAt,
    deletedAt: paymentMethods.deletedAt,
  } as const,
};
