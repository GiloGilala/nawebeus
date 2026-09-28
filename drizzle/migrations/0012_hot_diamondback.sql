CREATE TYPE "public"."account_holder_type" AS ENUM('individual', 'company', 'government', 'non_profit');--> statement-breakpoint
CREATE TYPE "public"."action_type" AS ENUM('3d_secure', 'redirect', 'verify_with_microdeposits', 'verify_with_instant');--> statement-breakpoint
CREATE TYPE "public"."address_check" AS ENUM('pass', 'fail', 'unchecked', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."bank_account_type" AS ENUM('checking', 'savings', 'business_checking', 'business_savings');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'quarterly', 'annual', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."billing_transaction_category" AS ENUM('payment', 'charge', 'refund', 'fee', 'credit', 'adjustment', 'settlement', 'other');--> statement-breakpoint
CREATE TYPE "public"."billing_transaction_status" AS ENUM('pending', 'processing', 'completed', 'settled', 'failed', 'reversed', 'refunded', 'disputed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."block_status" AS ENUM('active', 'blocked', 'released');--> statement-breakpoint
CREATE TYPE "public"."card_funding" AS ENUM('credit', 'debit', 'prepaid', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."collection_method" AS ENUM('charge_automatically', 'send_invoice');--> statement-breakpoint
CREATE TYPE "public"."invoice_created_from" AS ENUM('api', 'dashboard', 'webhook', 'migration', 'admin', 'system', 'cron');--> statement-breakpoint
CREATE TYPE "public"."payment_created_via" AS ENUM('dashboard', 'api', 'subscription', 'invoice', 'checkout', 'migration', 'admin');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR');--> statement-breakpoint
CREATE TYPE "public"."cvc_check" AS ENUM('pass', 'fail', 'unchecked', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('pending', 'under_review', 'won', 'lost', 'closed');--> statement-breakpoint
CREATE TYPE "public"."fraud_status" AS ENUM('clean', 'suspected', 'confirmed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('subscription', 'one_time', 'overage', 'addon', 'credit_note', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."network_token_status" AS ENUM('enabled', 'disabled', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_origin" AS ENUM('subscription', 'checkout', 'manual', 'import', 'adjustment', 'api', 'dashboard', 'admin', 'system', 'migration');--> statement-breakpoint
CREATE TYPE "public"."payment_initiator" AS ENUM('customer', 'admin', 'system', 'cron', 'subscription', 'api', 'migration', 'checkout', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."payment_method_status" AS ENUM('active', 'inactive', 'verification_pending', 'verification_failed', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_processor" AS ENUM('paystack', 'stripe', 'flutterwave', 'paypal', 'braintree', 'square', 'authorize_net', 'adyen', 'razorpay', 'manual', 'wallet', 'bank_transfer', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded', 'disputed', 'expired', 'requires_action');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('subscription', 'one_time', 'addon', 'usage', 'setup_fee', 'late_fee', 'credit_adjustment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat_rate', 'usage_based', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."processor_status" AS ENUM('authorized', 'captured', 'failed', 'settled', 'pending', 'voided', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."processor_type" AS ENUM('stripe', 'paypal', 'paystack', 'flutterwave', 'square', 'adyen', 'razorpay', 'cashfree', 'monnify', 'opay', 'momo', 'braintree', 'authorize_net', 'worldpay', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('social', 'fashion');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('requested_by_customer', 'duplicate', 'fraudulent', 'service_issue', 'cancellation', 'billing_error', 'other');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'processing', 'in_transit', 'settled', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payment_method_source" AS ENUM('checkout', 'subscription', 'admin', 'mobile', 'invoice', 'api', 'migration', 'import', 'dashboard');--> statement-breakpoint
CREATE TYPE "public"."subscription_cancel_reason" AS ENUM('price_too_high', 'switching_provider', 'missing_features', 'no_longer_needed', 'other');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('personal', 'organization');--> statement-breakpoint
CREATE TYPE "public"."transaction_origin" AS ENUM('subscription', 'invoice', 'manual', 'refund', 'api', 'migration', 'system', 'admin', 'cron', 'webhook', 'checkout');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('charge', 'payment', 'refund', 'credit', 'debit', 'adjustment', 'fee', 'discount', 'tax', 'transfer', 'chargeback', 'payout', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('instant', 'micro_deposit', 'manual', 'processor', 'bank_api', 'third_party');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'processing', 'verified', 'failed', 'expired', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."wallet_provider" AS ENUM('apple_pay', 'google_pay', 'samsung_pay', 'paypal', 'venmo', 'cash_app', 'other');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'overdue';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"display_number" varchar(100),
	"sequence_number" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by" uuid,
	"supersedes" uuid,
	"type" "invoice_type" DEFAULT 'subscription' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"payment_id" uuid,
	"credit_note_id" uuid,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(20, 6),
	"base_currency" "currency",
	"exchange_rate_applied_at" timestamp with time zone,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"coupon_code" varchar(100),
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"tax_rate" integer DEFAULT 0,
	"tax_description" varchar(200),
	"credit_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"amount_remaining" integer DEFAULT 0 NOT NULL,
	"starting_balance" integer DEFAULT 0,
	"ending_balance" integer DEFAULT 0,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"billing_period_start" timestamp with time zone,
	"billing_period_end" timestamp with time zone,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"marked_uncollectible_at" timestamp with time zone,
	"written_off_at" timestamp with time zone,
	"written_off_by" uuid,
	"write_off_reason" text,
	"next_reminder_at" timestamp with time zone,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminder_sent_at" timestamp with time zone,
	"payment_status" "payment_status" DEFAULT 'pending',
	"collection_method" "collection_method" DEFAULT 'charge_automatically' NOT NULL,
	"payment_attempts" integer DEFAULT 0 NOT NULL,
	"last_payment_attempt_at" timestamp with time zone,
	"last_payment_error" text,
	"next_payment_attempt_at" timestamp with time zone,
	"auto_advance" boolean DEFAULT true NOT NULL,
	"stripe_invoice_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"hosted_invoice_url" text,
	"invoice_pdf_url" text,
	"pdf_generated_at" timestamp with time zone,
	"pdf_version" integer,
	"pdf_checksum" varchar(64),
	"customer_name" varchar(200) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_phone" varchar(20),
	"search_text" text,
	"normalized_customer_name" varchar(200),
	"normalized_email" varchar(255),
	"billing_address" jsonb DEFAULT '{}'::jsonb,
	"shipping_address" jsonb DEFAULT '{}'::jsonb,
	"tax_id" varchar(100),
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"tax_exempt_reason" varchar(200),
	"company_info" jsonb DEFAULT '{"name":"Nawebeus"}'::jsonb,
	"payment_terms" varchar(100) DEFAULT 'due_on_receipt',
	"payment_instructions" text,
	"bank_transfer_details" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"footer" text,
	"memo" text,
	"customer_note" text,
	"custom_fields" jsonb DEFAULT '[]'::jsonb,
	"locale" varchar(10) DEFAULT 'en-US',
	"timezone" varchar(50),
	"date_format" varchar(50),
	"receipt_number" varchar(100),
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"refunds" jsonb DEFAULT '[]'::jsonb,
	"credits_applied" jsonb DEFAULT '[]'::jsonb,
	"disputes" jsonb DEFAULT '[]'::jsonb,
	"has_dispute" boolean DEFAULT false NOT NULL,
	"dunning_status" varchar(50),
	"dunning_attempts" integer DEFAULT 0 NOT NULL,
	"last_dunning_attempt_at" timestamp with time zone,
	"next_dunning_attempt_at" timestamp with time zone,
	"collection_notes" jsonb DEFAULT '[]'::jsonb,
	"emails_sent" jsonb DEFAULT '[]'::jsonb,
	"sent_to_customer_at" timestamp with time zone,
	"viewed_by_customer_at" timestamp with time zone,
	"downloaded_by_customer_at" timestamp with time zone,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"approval_notes" text,
	"rejected_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejection_reason" text,
	"reconciled_at" timestamp with time zone,
	"reconciled_by" uuid,
	"reconciliation_notes" text,
	"journal_entry_id" varchar(255),
	"ledger_transaction_id" varchar(255),
	"origin" "invoice_origin",
	"created_from" "invoice_created_from",
	"voided_by" uuid,
	"void_reason" text,
	"void_code" varchar(50),
	"billing_engine_version" varchar(20),
	"created_by" uuid,
	"history" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"added_by" uuid,
	"type" "payment_method_type" NOT NULL,
	"status" "payment_method_status" DEFAULT 'active' NOT NULL,
	"nickname" varchar(100),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"processor_type" "processor_type" NOT NULL,
	"processor_payment_method_id" varchar(255) NOT NULL,
	"processor_customer_id" varchar(255),
	"processor_pci_compliant" boolean DEFAULT true,
	"processor_metadata" jsonb DEFAULT '{}'::jsonb,
	"card_brand" "card_brand",
	"card_last4" varchar(4),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"card_funding" "card_funding",
	"card_country" varchar(2),
	"card_fingerprint" varchar(64),
	"card_3ds_supported" boolean DEFAULT false,
	"card_contactless" boolean DEFAULT false,
	"card_issuer" varchar(100),
	"card_bin" varchar(8),
	"tokenized" boolean DEFAULT false,
	"token_version" varchar(20),
	"token_provider" varchar(50),
	"network_token_enabled" boolean DEFAULT false,
	"network_token_status" "network_token_status" DEFAULT 'disabled',
	"network_token_id" varchar(255),
	"bank_name" varchar(100),
	"bank_account_type" "bank_account_type",
	"bank_account_last4" varchar(4),
	"bank_routing_number" varchar(20),
	"bank_country" varchar(2),
	"bank_currency" varchar(3) DEFAULT 'USD',
	"bank_fingerprint" varchar(64),
	"account_holder_name" varchar(200),
	"account_holder_type" "account_holder_type",
	"wallet_provider" "wallet_provider",
	"wallet_email" varchar(255),
	"wallet_phone_number" varchar(20),
	"wallet_account_id" varchar(255),
	"crypto_address" varchar(255),
	"crypto_currency" varchar(20),
	"crypto_network" varchar(50),
	"billing_address" jsonb DEFAULT '{}'::jsonb,
	"preferred_currency" varchar(3) DEFAULT 'USD',
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_method" "verification_method",
	"verification_attempts" integer DEFAULT 0,
	"verification_status" "verification_status",
	"verification_details" jsonb DEFAULT '{}'::jsonb,
	"cvc_check" "cvc_check" DEFAULT 'unchecked',
	"address_line1_check" "address_check" DEFAULT 'unchecked',
	"address_postal_code_check" "address_check" DEFAULT 'unchecked',
	"risk_score" integer DEFAULT 0,
	"risk_level" "risk_level" DEFAULT 'low',
	"fraud_status" "fraud_status" DEFAULT 'clean',
	"block_status" "block_status" DEFAULT 'active',
	"blocklist_reason" varchar(255),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"total_amount_processed" numeric(20, 2) DEFAULT '0',
	"last_used_at" timestamp with time zone,
	"first_used_at" timestamp with time zone,
	"last_successful_charge_at" timestamp with time zone,
	"successful_charges" integer DEFAULT 0,
	"failed_charges" integer DEFAULT 0,
	"last_failure_code" varchar(50),
	"last_failure_reason" text,
	"last_failure_at" timestamp with time zone,
	"capabilities" jsonb DEFAULT '{"supportsRecurring":true,"supportsOneTime":true,"supportsRefunds":true,"supportsDisputes":false,"supportsCapture":true,"supports3DSecure":false,"supportsInternational":false}'::jsonb,
	"expires_at" timestamp with time zone,
	"auto_update_enabled" boolean DEFAULT true,
	"last_auto_update_at" timestamp with time zone,
	"auto_update_source" varchar(50),
	"preferences" jsonb DEFAULT '{"allowRecurring":true,"allowOneTime":true,"requireCVC":false,"require3DSecure":false,"notifyOnCharge":false,"notifyOnExpiry":true}'::jsonb,
	"mandate_accepted" boolean DEFAULT false,
	"mandate_accepted_at" timestamp with time zone,
	"mandate_reference" varchar(255),
	"mandate_url" varchar(500),
	"mandate_details" jsonb DEFAULT '{}'::jsonb,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" uuid,
	"deactivation_reason" varchar(255),
	"can_be_reactivated" boolean DEFAULT true,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deletion_reason" varchar(255),
	"expiry_reminder_sent" boolean DEFAULT false,
	"expiry_reminder_sent_at" timestamp with time zone,
	"update_requested_at" timestamp with time zone,
	"update_reminders_sent" integer DEFAULT 0,
	"strong_customer_auth_required" boolean DEFAULT false,
	"compliance_checks" jsonb DEFAULT '{}'::jsonb,
	"created_from_ip" "inet",
	"created_from_country" varchar(2),
	"created_device" varchar(100),
	"created_platform" varchar(50),
	"created_via" "payment_method_source",
	"internal_notes" text,
	"customer_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"payment_method_id" uuid,
	"user_id" uuid,
	"type" "payment_type" DEFAULT 'subscription' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(20, 2),
	"tax_amount" numeric(20, 2) DEFAULT '0.00',
	"discount_amount" numeric(20, 2) DEFAULT '0.00',
	"credit_amount" numeric(20, 2) DEFAULT '0.00',
	"processing_fee" numeric(20, 2) DEFAULT '0.00',
	"platform_fee" numeric(20, 2) DEFAULT '0.00',
	"net_amount" numeric(20, 2),
	"fee_breakdown" jsonb DEFAULT '[]'::jsonb,
	"payment_method" "payment_method_type" DEFAULT 'card' NOT NULL,
	"payment_processor" "payment_processor" DEFAULT 'stripe' NOT NULL,
	"payment_method_details" jsonb DEFAULT '{}'::jsonb,
	"payment_method_snapshot_version" integer DEFAULT 1,
	"processor_payment_id" varchar(255),
	"processor_customer_id" varchar(255),
	"processor_payment_method_id" varchar(255),
	"idempotency_key" varchar(255),
	"external_reference" varchar(255),
	"external_system" varchar(50),
	"checkout_session_id" varchar(255),
	"client_secret" varchar(255),
	"merchant_account_id" varchar(255),
	"processor_metadata" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"statement_descriptor" varchar(22),
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"discounts" jsonb DEFAULT '[]'::jsonb,
	"taxes" jsonb DEFAULT '[]'::jsonb,
	"attempted_at" timestamp with time zone,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"billing_period_start" timestamp with time zone,
	"billing_period_end" timestamp with time zone,
	"failure_reason" text,
	"failure_message" text,
	"processor_failure_code" varchar(100),
	"processor_decline_code" varchar(100),
	"internal_failure_code" varchar(100),
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3,
	"next_retry_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"decline_code" varchar(100),
	"risk_score" integer,
	"risk_level" "risk_level" DEFAULT 'low',
	"fraud_detected" boolean DEFAULT false NOT NULL,
	"refunded_amount" numeric(20, 2) DEFAULT '0.00',
	"refunded_at" timestamp with time zone,
	"refund_reason" "refund_reason",
	"refund_note" text,
	"refund_details" jsonb DEFAULT '[]'::jsonb,
	"requires_capture" boolean DEFAULT false NOT NULL,
	"authorized_amount" numeric(20, 2),
	"captured_amount" numeric(20, 2) DEFAULT '0.00',
	"authorization_code" varchar(100),
	"authorization_expires_at" timestamp with time zone,
	"requires_action" boolean DEFAULT false NOT NULL,
	"action_type" "action_type",
	"action_url" varchar(500),
	"action_completed_at" timestamp with time zone,
	"ip_address" "inet",
	"country" varchar(2),
	"city" varchar(100),
	"region" varchar(100),
	"timezone" varchar(50),
	"asn" varchar(50),
	"proxy_detected" boolean DEFAULT false,
	"vpn_detected" boolean DEFAULT false,
	"device_fingerprint" varchar(255),
	"browser_fingerprint" varchar(255),
	"operating_system" varchar(100),
	"device_type" varchar(50),
	"app_version" varchar(50),
	"events" jsonb DEFAULT '[]'::jsonb,
	"webhook_events" jsonb DEFAULT '[]'::jsonb,
	"exchange_rate" numeric(20, 6),
	"base_currency" varchar(3),
	"converted_amount" numeric(20, 2),
	"dispute_status" varchar(50),
	"dispute_opened_at" timestamp with time zone,
	"dispute_won_at" timestamp with time zone,
	"dispute_lost_at" timestamp with time zone,
	"dispute_reason" varchar(255),
	"dispute_deadline_at" timestamp with time zone,
	"processor_dispute_id" varchar(255),
	"chargeback_status" varchar(50),
	"chargeback_amount" numeric(20, 2),
	"chargeback_at" timestamp with time zone,
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_at" timestamp with time zone,
	"reconciled_by" uuid,
	"accounting_reference" varchar(100),
	"journal_entry_id" varchar(255),
	"ledger_transaction_id" varchar(255),
	"settlement_status" "settlement_status" DEFAULT 'pending',
	"settlement_date" timestamp with time zone,
	"settlement_amount" numeric(20, 2),
	"processing_started_at" timestamp with time zone,
	"processing_completed_at" timestamp with time zone,
	"processing_duration_ms" integer,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"tax_id" varchar(100),
	"created_via" "payment_created_via",
	"initiator" "payment_initiator",
	"internal_notes" text,
	"customer_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"receipt_url" varchar(500),
	"receipt_number" varchar(100),
	"canceled_by" uuid,
	"cancellation_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"tier" "subscription_plan" NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"tagline" varchar(200),
	"pricing_model" "pricing_model" DEFAULT 'flat_rate' NOT NULL,
	"price_monthly" integer,
	"price_annual" integer,
	"price_quarterly" integer,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"annual_discount" integer DEFAULT 0,
	"quarterly_discount" integer DEFAULT 0,
	"trial_days" integer DEFAULT 0,
	"has_free_trial" boolean DEFAULT false NOT NULL,
	"setup_fee" integer DEFAULT 0,
	"pricing_tiers" jsonb DEFAULT '[]'::jsonb,
	"features" jsonb DEFAULT '{"productType":"social","social":{"socialAccounts":3,"postsPerMonth":30,"scheduledPosts":10,"teamMembers":1,"aiGenerations":50,"aiContentAssistant":true,"contentLibrary":false,"contentTemplates":5,"bulkScheduling":false,"contentCalendar":true,"postApprovalWorkflow":false,"autoPublishing":true,"rssAutoPosting":false,"analyticsRetentionDays":90,"customReports":0,"exportReports":false,"competitorAnalysis":false,"advancedAnalytics":false,"realTimeAnalytics":false,"socialListening":false,"keywordTracking":5,"mentionAlerts":true,"sentimentAnalysis":false,"crisisDetection":false,"brandMonitoring":false,"unifiedInbox":true,"autoResponder":false,"savedReplies":10,"conversationHistory":true,"teamCollaboration":false,"roleBasedAccess":false,"approvalWorkflows":false,"activityLog":true,"apiAccess":false,"apiCallsPerMonth":0,"webhooks":false,"customIntegrations":false,"zapierIntegration":false,"storageGB":5,"mediaLibrary":true,"prioritySupport":false,"dedicatedAccountManager":false,"onboarding":false,"training":false,"sla":false,"whiteLabel":false,"customBranding":false,"customDomain":false,"platformSpecific":{}}}'::jsonb NOT NULL,
	"feature_highlights" jsonb DEFAULT '[]'::jsonb,
	"upcoming_features" jsonb DEFAULT '[]'::jsonb,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"allow_new_signups" boolean DEFAULT true NOT NULL,
	"allow_upgrade" boolean DEFAULT true NOT NULL,
	"allow_downgrade" boolean DEFAULT true NOT NULL,
	"available_countries" jsonb DEFAULT '[]'::jsonb,
	"restricted_countries" jsonb DEFAULT '[]'::jsonb,
	"stripe_price_id_monthly" varchar(255),
	"stripe_price_id_annual" varchar(255),
	"stripe_price_id_quarterly" varchar(255),
	"stripe_product_id" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"display_position" integer,
	"color" varchar(20),
	"icon" varchar(50),
	"badge_text" varchar(50),
	"minimum_seats" integer DEFAULT 1,
	"maximum_seats" integer,
	"requires_business_email" boolean DEFAULT false NOT NULL,
	"requires_contract" boolean DEFAULT false NOT NULL,
	"requires_sales_contact" boolean DEFAULT false NOT NULL,
	"minimum_commitment_months" integer DEFAULT 0,
	"cancellation_policy" text,
	"allow_addons" boolean DEFAULT false NOT NULL,
	"overage_rates" jsonb DEFAULT '[]'::jsonb,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"automatic_tax" boolean DEFAULT false NOT NULL,
	"tax_category" varchar(50),
	"invoice_prefix" varchar(10),
	"invoice_description_template" text,
	"invoice_footer" text,
	"allowed_upgrade_targets" jsonb DEFAULT '[]'::jsonb,
	"allowed_downgrade_targets" jsonb DEFAULT '[]'::jsonb,
	"minimum_billing_cycles" integer,
	"maximum_billing_cycles" integer,
	"target_audience" varchar(100),
	"use_cases" jsonb DEFAULT '[]'::jsonb,
	"comparison_features" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"replaced_by" uuid,
	"replaces_id" uuid,
	"effective_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"allow_grandfathering" boolean DEFAULT false NOT NULL,
	"grandfathering_until" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"last_price_change" timestamp with time zone,
	"last_feature_change" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"archived_reason" text,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "subscription_type" DEFAULT 'organization' NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"product_type" "product_type" DEFAULT 'social' NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_snapshot" jsonb NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"base_price" integer NOT NULL,
	"additional_seats_price" integer DEFAULT 0,
	"addons_cost" integer DEFAULT 0,
	"discount_amount" integer DEFAULT 0,
	"total_price" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"included_seats" integer DEFAULT 1 NOT NULL,
	"additional_seats" integer DEFAULT 0 NOT NULL,
	"seat_price" integer DEFAULT 0,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_trialing" boolean DEFAULT false NOT NULL,
	"trial_starts_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"trial_extended_until" timestamp with time zone,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"renews_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"canceled_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancellation_effective_date" timestamp with time zone,
	"cancellation_reason" "subscription_cancel_reason",
	"cancellation_note" text,
	"canceled_by" uuid,
	"paused_at" timestamp with time zone,
	"paused_until" timestamp with time zone,
	"pause_reason" text,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"provider" varchar(50) DEFAULT 'paystack',
	"provider_customer_id" varchar(255),
	"provider_subscription_id" varchar(255),
	"provider_plan_id" varchar(255),
	"provider_authorization_code" varchar(255),
	"provider_metadata" jsonb DEFAULT '{}'::jsonb,
	"paystack_customer_code" varchar(255),
	"paystack_subscription_code" varchar(255),
	"paystack_plan_code" varchar(255),
	"paystack_authorization_code" varchar(255),
	"last_payment_at" timestamp with time zone,
	"last_payment_amount" integer,
	"last_payment_status" varchar(50),
	"last_payment_reference" varchar(255),
	"next_payment_at" timestamp with time zone,
	"next_payment_amount" integer,
	"payment_failure_count" integer DEFAULT 0 NOT NULL,
	"last_payment_failure_at" timestamp with time zone,
	"last_payment_failure_reason" text,
	"payment_method_type" "payment_method_type",
	"payment_method_details" jsonb DEFAULT '{}'::jsonb,
	"subscription_limits" jsonb DEFAULT '{"productType":"social","socialAccounts":0,"postsPerMonth":0,"scheduledPosts":0,"teamMembers":0,"aiGenerations":0,"customReports":0,"storageGB":0,"apiCallsPerMonth":0,"keywordTracking":0,"savedReplies":0}'::jsonb NOT NULL,
	"subscription_usage" jsonb DEFAULT '{"productType":"social","socialAccounts":0,"postsThisMonth":0,"scheduledPosts":0,"activeTeamMembers":0,"aiGenerationsUsed":0,"reportsGenerated":0,"storageUsedMB":0,"apiCallsThisMonth":0,"keywordsTracked":0,"repliesSaved":0,"lastReset":"2026-09-27T15:11:07.160Z","lastUpdated":"2026-09-27T15:11:07.160Z"}'::jsonb NOT NULL,
	"overage_charges" jsonb DEFAULT '[]'::jsonb,
	"overage_status" jsonb DEFAULT '{"hasOverage":false,"totalOverage":0,"overageCharges":[],"lastOverageCheck":"2026-09-27T15:11:07.160Z","nextOverageCheck":"2026-09-27T15:11:07.160Z","totalPendingOverage":0,"lastChecked":"2026-09-27T15:11:07.160Z"}'::jsonb,
	"addons" jsonb DEFAULT '[]'::jsonb,
	"discounts" jsonb DEFAULT '[]'::jsonb,
	"coupon_code" varchar(100),
	"coupon_applied_at" timestamp with time zone,
	"is_grandfathered" boolean DEFAULT false NOT NULL,
	"grandfathered_features" jsonb DEFAULT '{}'::jsonb,
	"grandfathered_until" timestamp with time zone,
	"grandfathering_notes" text,
	"has_custom_pricing" boolean DEFAULT false NOT NULL,
	"custom_pricing_notes" text,
	"custom_pricing_approved_by" uuid,
	"notification_settings" jsonb DEFAULT '{"paymentReminders":true,"usageAlerts":true,"renewalReminders":true,"trialExpiring":true,"paymentFailed":true,"subscriptionCanceled":true,"invoiceReady":true,"overageWarnings":true,"limitWarnings":true}'::jsonb NOT NULL,
	"last_usage_alert_at" timestamp with time zone,
	"last_renewal_reminder_at" timestamp with time zone,
	"last_overage_warning_at" timestamp with time zone,
	"billing_history" jsonb DEFAULT '[]'::jsonb,
	"change_history" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscriptions_paystack_subscription_code_unique" UNIQUE("paystack_subscription_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" varchar(50) NOT NULL,
	"event_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_type" "product_type" DEFAULT 'social' NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"payment_id" uuid,
	"initiated_by" uuid,
	"parent_transaction_id" uuid,
	"reversal_transaction_id" uuid,
	"type" "transaction_type" NOT NULL,
	"status" "billing_transaction_status" DEFAULT 'pending' NOT NULL,
	"category" "billing_transaction_category" DEFAULT 'other' NOT NULL,
	"origin" "transaction_origin",
	"amount" bigint NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"original_amount" bigint,
	"original_currency" "currency",
	"exchange_rate" bigint,
	"exchange_provider" varchar(50),
	"exchange_timestamp" timestamp with time zone,
	"converted_amount" bigint,
	"net_amount" bigint,
	"fee_amount" bigint DEFAULT 0,
	"tax_amount" bigint DEFAULT 0,
	"tax_rate" integer,
	"balance_impact" bigint NOT NULL,
	"balance_before" bigint,
	"balance_after" bigint,
	"running_balance" bigint,
	"debit_account" varchar(50),
	"credit_account" varchar(50),
	"journal_entry_id" varchar(255),
	"recognized_amount" bigint,
	"deferred_amount" bigint,
	"recognized_at" timestamp with time zone,
	"invoice_snapshot" jsonb,
	"customer_snapshot" jsonb,
	"subscription_snapshot" jsonb,
	"description" text NOT NULL,
	"short_description" varchar(200),
	"external_reference" varchar(255),
	"merchant_reference" varchar(255),
	"client_reference" varchar(255),
	"purchase_order" varchar(100),
	"receipt_number" varchar(100),
	"receipt_url" varchar(500),
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"billing_period_start" timestamp with time zone,
	"billing_period_end" timestamp with time zone,
	"service_period_start" timestamp with time zone,
	"service_period_end" timestamp with time zone,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_date" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp with time zone,
	"last_retry_at" timestamp with time zone,
	"webhook_id" varchar(255),
	"webhook_event" varchar(100),
	"webhook_received_at" timestamp with time zone,
	"webhook_processed_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversal_reason" varchar(255),
	"disputed_at" timestamp with time zone,
	"dispute_reason" varchar(255),
	"dispute_status" "dispute_status",
	"dispute_resolution" text,
	"dispute_resolved_at" timestamp with time zone,
	"processor_type" "payment_processor",
	"processor_transaction_id" varchar(255),
	"processor_reference" varchar(255),
	"processor_status" "processor_status",
	"processor_metadata" jsonb DEFAULT '{}'::jsonb,
	"accounting_reference" varchar(100),
	"accounting_code" varchar(50),
	"cost_center" varchar(50),
	"accounting_exported" boolean DEFAULT false,
	"accounting_exported_at" timestamp with time zone,
	"accounting_batch_id" varchar(255),
	"accounting_sync_status" varchar(50),
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_at" timestamp with time zone,
	"reconciled_by" uuid,
	"reporting_period" varchar(20),
	"fiscal_year" integer,
	"fiscal_quarter" integer,
	"fiscal_month" integer,
	"payment_method" varchar(50),
	"payment_method_details" jsonb DEFAULT '{}'::jsonb,
	"refunded_amount" bigint DEFAULT 0,
	"refunded_at" timestamp with time zone,
	"refund_details" jsonb DEFAULT '[]'::jsonb,
	"fees" jsonb DEFAULT '[]'::jsonb,
	"discounts" jsonb DEFAULT '[]'::jsonb,
	"taxes" jsonb DEFAULT '[]'::jsonb,
	"tax_exempt" boolean DEFAULT false,
	"tax_exempt_reason" varchar(255),
	"requires_approval" boolean DEFAULT false,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejection_reason" varchar(255),
	"customer_notified" boolean DEFAULT false,
	"customer_notified_at" timestamp with time zone,
	"notification_method" varchar(50),
	"settlement_status" "settlement_status",
	"settlement_date" timestamp with time zone,
	"settlement_reference" varchar(100),
	"payout_id" varchar(100),
	"risk_score" integer,
	"risk_level" varchar(20),
	"fraud_detected" boolean DEFAULT false,
	"fraud_reason" varchar(255),
	"source" varchar(100),
	"source_reference" varchar(255),
	"context" jsonb DEFAULT '{}'::jsonb,
	"internal_notes" text,
	"customer_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"idempotency_key" varchar(255),
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"audit_log" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_number_unique" UNIQUE("transaction_number"),
	CONSTRAINT "transactions_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_written_off_by_users_id_fk" FOREIGN KEY ("written_off_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_deactivated_by_users_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_canceled_by_users_id_fk" FOREIGN KEY ("canceled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_replaced_by_plans_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_replaces_id_plans_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_canceled_by_users_id_fk" FOREIGN KEY ("canceled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_custom_pricing_approved_by_users_id_fk" FOREIGN KEY ("custom_pricing_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversal_transaction_id_transactions_id_fk" FOREIGN KEY ("reversal_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_stripe_invoice_unique" ON "invoices" USING btree ("stripe_invoice_id") WHERE stripe_invoice_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_display_number_idx" ON "invoices" USING btree ("display_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_sequence_number_idx" ON "invoices" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_version_idx" ON "invoices" USING btree ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_organization_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_subscription_idx" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_payment_id_idx" ON "invoices" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_type_idx" ON "invoices" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_payment_status_idx" ON "invoices" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_invoice_date_idx" ON "invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_paid_at_idx" ON "invoices" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_billing_period_start_idx" ON "invoices" USING btree ("billing_period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_billing_period_end_idx" ON "invoices" USING btree ("billing_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_collection_method_idx" ON "invoices" USING btree ("collection_method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_next_payment_attempt_idx" ON "invoices" USING btree ("next_payment_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_next_reminder_idx" ON "invoices" USING btree ("next_reminder_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_stripe_invoice_idx" ON "invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_stripe_customer_idx" ON "invoices" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_stripe_subscription_idx" ON "invoices" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_customer_email_idx" ON "invoices" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_normalized_email_idx" ON "invoices" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_normalized_customer_name_idx" ON "invoices" USING btree ("normalized_customer_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_search_text_idx" ON "invoices" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_has_dispute_idx" ON "invoices" USING btree ("has_dispute");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_dunning_status_idx" ON "invoices" USING btree ("dunning_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_next_dunning_attempt_idx" ON "invoices" USING btree ("next_dunning_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_requires_approval_idx" ON "invoices" USING btree ("requires_approval");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_approved_at_idx" ON "invoices" USING btree ("approved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_origin_idx" ON "invoices" USING btree ("origin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_created_from_idx" ON "invoices" USING btree ("created_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_currency_idx" ON "invoices" USING btree ("currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_created_by_idx" ON "invoices" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_voided_by_idx" ON "invoices" USING btree ("voided_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_deleted_at_idx" ON "invoices" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_date_idx" ON "invoices" USING btree ("organization_id","invoice_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_paid_idx" ON "invoices" USING btree ("organization_id","paid_at") WHERE status = 'paid' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_email_idx" ON "invoices" USING btree ("organization_id","customer_email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_number_idx" ON "invoices" USING btree ("organization_id","invoice_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_status_due_idx" ON "invoices" USING btree ("organization_id","status","due_date") WHERE 
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_payment_status_idx" ON "invoices" USING btree ("organization_id","payment_status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_unpaid_idx" ON "invoices" USING btree ("organization_id","status","amount_due") WHERE 
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_overdue_idx" ON "invoices" USING btree ("due_date","status","amount_due") WHERE 
        status IN ('open', 'overdue') 
        AND amount_due > 0
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_reminder_due_idx" ON "invoices" USING btree ("next_reminder_at","status") WHERE 
        status IN ('open', 'overdue')
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_payment_retry_idx" ON "invoices" USING btree ("next_payment_attempt_at","payment_status") WHERE 
        payment_status IN ('pending', 'failed')
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_dunning_active_idx" ON "invoices" USING btree ("dunning_status","next_dunning_attempt_at") WHERE 
        dunning_status = 'active'
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_pending_approval_idx" ON "invoices" USING btree ("requires_approval","status","approved_at") WHERE 
        requires_approval = true
        AND approved_at IS NULL
        AND status = 'draft'
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_disputed_idx" ON "invoices" USING btree ("has_dispute","status") WHERE 
        has_dispute = true
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_paid_revenue_idx" ON "invoices" USING btree ("paid_at","total","type") WHERE 
        status = 'paid'
        AND type IN ('subscription', 'one_time', 'overage', 'addon')
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_written_off_idx" ON "invoices" USING btree ("written_off_at","status") WHERE 
        written_off_at IS NOT NULL
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_org_default_unique" ON "payment_methods" USING btree ("organization_id") WHERE is_default = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_org_primary_unique" ON "payment_methods" USING btree ("organization_id") WHERE is_primary = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_processor_id_unique" ON "payment_methods" USING btree ("processor_type","processor_payment_method_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_idx" ON "payment_methods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_added_by_idx" ON "payment_methods" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_status_idx" ON "payment_methods" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_type_idx" ON "payment_methods" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_is_default_idx" ON "payment_methods" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_is_primary_idx" ON "payment_methods" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_processor_type_idx" ON "payment_methods" USING btree ("processor_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_processor_payment_method_id_idx" ON "payment_methods" USING btree ("processor_payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_processor_customer_id_idx" ON "payment_methods" USING btree ("processor_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_card_brand_idx" ON "payment_methods" USING btree ("card_brand");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_card_last4_idx" ON "payment_methods" USING btree ("card_last4");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_card_fingerprint_idx" ON "payment_methods" USING btree ("card_fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_is_verified_idx" ON "payment_methods" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_verified_at_idx" ON "payment_methods" USING btree ("verified_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_verification_status_idx" ON "payment_methods" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_fraud_status_idx" ON "payment_methods" USING btree ("fraud_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_block_status_idx" ON "payment_methods" USING btree ("block_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_risk_level_idx" ON "payment_methods" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_last_used_at_idx" ON "payment_methods" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_usage_count_idx" ON "payment_methods" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_expires_at_idx" ON "payment_methods" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_deactivated_at_idx" ON "payment_methods" USING btree ("deactivated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_deleted_at_idx" ON "payment_methods" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_created_at_idx" ON "payment_methods" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_created_via_idx" ON "payment_methods" USING btree ("created_via");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_created_from_ip_idx" ON "payment_methods" USING btree ("created_from_ip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_active_idx" ON "payment_methods" USING btree ("organization_id","status","is_default") WHERE 
        status = 'active' 
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_default_lookup_idx" ON "payment_methods" USING btree ("organization_id","is_default","status") WHERE 
        is_default = true 
        AND status = 'active' 
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_type_idx" ON "payment_methods" USING btree ("organization_id","type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_verified_idx" ON "payment_methods" USING btree ("organization_id","is_verified") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_processor_idx" ON "payment_methods" USING btree ("organization_id","processor_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_org_deleted_idx" ON "payment_methods" USING btree ("organization_id","deleted_at") WHERE deleted_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_expiring_soon_idx" ON "payment_methods" USING btree ("expires_at","status") WHERE 
        status = 'active'
        AND deleted_at IS NULL
        AND expires_at IS NOT NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_expired_cleanup_idx" ON "payment_methods" USING btree ("expires_at") WHERE 
        status = 'active'
        AND deleted_at IS NULL
        AND expires_at IS NOT NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_verification_pending_idx" ON "payment_methods" USING btree ("status","is_verified","created_at") WHERE 
        status = 'verification_pending' 
        AND is_verified = false
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_blocked_active_idx" ON "payment_methods" USING btree ("block_status","organization_id") WHERE 
        block_status = 'blocked' 
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_high_risk_idx" ON "payment_methods" USING btree ("risk_level","status") WHERE 
        risk_level IN ('high', 'critical')
        AND status = 'active'
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_recent_idx" ON "payment_methods" USING btree ("organization_id","created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_unused_idx" ON "payment_methods" USING btree ("last_used_at","status") WHERE 
        status = 'active'
        AND deleted_at IS NULL
        AND last_used_at IS NOT NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_update_reminder_idx" ON "payment_methods" USING btree ("update_requested_at","update_reminders_sent") WHERE 
        update_requested_at IS NOT NULL
        AND update_reminders_sent < 3
        AND status = 'active'
        AND deleted_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_metadata_gin_idx" ON "payment_methods" USING gin ("metadata") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_tags_gin_idx" ON "payment_methods" USING gin ("tags") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_capabilities_gin_idx" ON "payment_methods" USING gin ("capabilities") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_preferences_gin_idx" ON "payment_methods" USING gin ("preferences") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_processor_payment_unique" ON "payments" USING btree ("payment_processor","processor_payment_id") WHERE processor_payment_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_subscription_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_payment_method_idx" ON "payments" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_type_idx" ON "payments" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_payment_method_enum_idx" ON "payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_processor_idx" ON "payments" USING btree ("payment_processor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_processor_payment_id_idx" ON "payments" USING btree ("processor_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_processor_customer_id_idx" ON "payments" USING btree ("processor_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_attempted_at_idx" ON "payments" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_succeeded_at_idx" ON "payments" USING btree ("succeeded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_failed_at_idx" ON "payments" USING btree ("failed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_scheduled_for_idx" ON "payments" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_next_retry_at_idx" ON "payments" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_billing_period_idx" ON "payments" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_refunded_at_idx" ON "payments" USING btree ("refunded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_refund_reason_idx" ON "payments" USING btree ("refund_reason");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_reconciled_idx" ON "payments" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_reconciled_at_idx" ON "payments" USING btree ("reconciled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_settlement_status_idx" ON "payments" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_settlement_date_idx" ON "payments" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_requires_action_idx" ON "payments" USING btree ("requires_action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_requires_capture_idx" ON "payments" USING btree ("requires_capture");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_fraud_detected_idx" ON "payments" USING btree ("fraud_detected");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_risk_level_idx" ON "payments" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_via_idx" ON "payments" USING btree ("created_via");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_initiator_idx" ON "payments" USING btree ("initiator");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_updated_at_idx" ON "payments" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_idempotency_key_idx" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_ip_address_idx" ON "payments" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_invoice_idx" ON "payments" USING btree ("organization_id","invoice_id") WHERE invoice_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_subscription_idx" ON "payments" USING btree ("organization_id","subscription_id") WHERE subscription_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_processor_idx" ON "payments" USING btree ("organization_id","payment_processor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_currency_idx" ON "payments" USING btree ("organization_id","currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_method_idx" ON "payments" USING btree ("organization_id","payment_method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_succeeded_idx" ON "payments" USING btree ("organization_id","status","succeeded_at") WHERE status = 'succeeded';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_retry_pending_idx" ON "payments" USING btree ("status","next_retry_at","attempt_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_pending_idx" ON "payments" USING btree ("organization_id","status","created_at") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_action_required_idx" ON "payments" USING btree ("requires_action","status","created_at") WHERE requires_action = true AND status = 'requires_action';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_unreconciled_idx" ON "payments" USING btree ("reconciled","status","succeeded_at") WHERE reconciled = false AND status = 'succeeded';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_scheduled_due_idx" ON "payments" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_recent_idx" ON "payments" USING btree ("organization_id","created_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_refunded_idx" ON "payments" USING btree ("status","refunded_at","refunded_amount") WHERE status IN ('refunded', 'partially_refunded');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_high_risk_idx" ON "payments" USING btree ("risk_level","status","created_at") WHERE 
        risk_level IN ('high', 'critical') 
        AND status IN ('pending', 'requires_action')
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_settlement_pending_idx" ON "payments" USING btree ("settlement_status","succeeded_at") WHERE 
        settlement_status IN ('pending', 'in_transit')
        AND status = 'succeeded'
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_dispute_status_idx" ON "payments" USING btree ("dispute_status","dispute_opened_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_chargeback_status_idx" ON "payments" USING btree ("chargeback_status","chargeback_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_metadata_gin_idx" ON "payments" USING gin ("metadata") WHERE metadata IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_tags_gin_idx" ON "payments" USING gin ("tags") WHERE tags IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_line_items_gin_idx" ON "payments" USING gin ("line_items") WHERE line_items IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_fee_breakdown_gin_idx" ON "payments" USING gin ("fee_breakdown") WHERE fee_breakdown IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_unique" ON "plans" USING btree ("slug") WHERE archived_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_tier_idx" ON "plans" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_slug_idx" ON "plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_status_idx" ON "plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_is_public_idx" ON "plans" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_is_featured_idx" ON "plans" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_is_popular_idx" ON "plans" USING btree ("is_popular");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_pricing_model_idx" ON "plans" USING btree ("pricing_model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_price_monthly_idx" ON "plans" USING btree ("price_monthly");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_currency_idx" ON "plans" USING btree ("currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_allow_new_signups_idx" ON "plans" USING btree ("allow_new_signups");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_stripe_product_idx" ON "plans" USING btree ("stripe_product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_sort_order_idx" ON "plans" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_display_position_idx" ON "plans" USING btree ("display_position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_version_idx" ON "plans" USING btree ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_replaced_by_idx" ON "plans" USING btree ("replaced_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_replaces_idx" ON "plans" USING btree ("replaces_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_effective_date_idx" ON "plans" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_expiry_date_idx" ON "plans" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_archived_at_idx" ON "plans" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_created_by_idx" ON "plans" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_published_by_idx" ON "plans" USING btree ("published_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_public_active_idx" ON "plans" USING btree ("sort_order","is_public","status") WHERE 
        is_public = true 
        AND status = 'active' 
        AND archived_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_available_for_signup_idx" ON "plans" USING btree ("tier","allow_new_signups","status") WHERE 
        allow_new_signups = true 
        AND status = 'active' 
        AND archived_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_featured_idx" ON "plans" USING btree ("sort_order","is_featured") WHERE 
        is_featured = true 
        AND is_public = true 
        AND status = 'active' 
        AND archived_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_current_active_idx" ON "plans" USING btree ("effective_date","expiry_date","status") WHERE 
        status = 'active' 
        AND archived_at IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_features_gin_idx" ON "plans" USING gin ("features") WHERE features IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_metadata_gin_idx" ON "plans" USING gin ("metadata") WHERE metadata IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_comparison_features_gin_idx" ON "plans" USING gin ("comparison_features") WHERE comparison_features IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_overage_rates_gin_idx" ON "plans" USING gin ("overage_rates") WHERE overage_rates IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_provider_subscription_unique" ON "subscriptions" USING btree ("provider","provider_subscription_id") WHERE provider_subscription_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_organization_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_is_active_idx" ON "subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_billing_cycle_idx" ON "subscriptions" USING btree ("billing_cycle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_product_type_idx" ON "subscriptions" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_current_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_trial_ends_at_idx" ON "subscriptions" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_renews_at_idx" ON "subscriptions" USING btree ("renews_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_ended_at_idx" ON "subscriptions" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_canceled_at_idx" ON "subscriptions" USING btree ("canceled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_next_payment_at_idx" ON "subscriptions" USING btree ("next_payment_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_provider_idx" ON "subscriptions" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_provider_customer_idx" ON "subscriptions" USING btree ("provider_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_provider_subscription_idx" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_org_active_idx" ON "subscriptions" USING btree ("organization_id","status","is_active") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_org_product_idx" ON "subscriptions" USING btree ("organization_id","product_type","status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_org_current_period_idx" ON "subscriptions" USING btree ("organization_id","current_period_end","status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_expiring_trials_idx" ON "subscriptions" USING btree ("trial_ends_at","is_trialing","status") WHERE is_trialing = true AND status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_failing_payments_idx" ON "subscriptions" USING btree ("payment_failure_count","status","next_payment_at") WHERE payment_failure_count > 0 AND status != 'cancelled' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_metadata_gin_idx" ON "subscriptions" USING gin ("metadata") WHERE metadata IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_tags_gin_idx" ON "subscriptions" USING gin ("tags") WHERE tags IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_usage_gin_idx" ON "subscriptions" USING gin ("subscription_usage") WHERE subscription_usage IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_limits_gin_idx" ON "subscriptions" USING gin ("subscription_limits") WHERE subscription_limits IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_addons_gin_idx" ON "subscriptions" USING gin ("addons") WHERE addons IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_number_unique" ON "transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_event_id_unique" ON "transactions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_idempotency_key_unique" ON "transactions" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_processor_id_unique" ON "transactions" USING btree ("processor_type","processor_transaction_id") WHERE processor_transaction_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_idx" ON "transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_subscription_idx" ON "transactions" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_invoice_idx" ON "transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_payment_idx" ON "transactions" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_initiated_by_idx" ON "transactions" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_parent_idx" ON "transactions" USING btree ("parent_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reversal_idx" ON "transactions" USING btree ("reversal_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_product_type_idx" ON "transactions" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_category_idx" ON "transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_origin_idx" ON "transactions" USING btree ("origin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_amount_idx" ON "transactions" USING btree ("amount");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_balance_impact_idx" ON "transactions" USING btree ("balance_impact");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_currency_idx" ON "transactions" USING btree ("currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_transaction_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_effective_date_idx" ON "transactions" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_processed_at_idx" ON "transactions" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_completed_at_idx" ON "transactions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_settled_at_idx" ON "transactions" USING btree ("settled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_scheduled_for_idx" ON "transactions" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_billing_period_idx" ON "transactions" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reversed_at_idx" ON "transactions" USING btree ("reversed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_disputed_at_idx" ON "transactions" USING btree ("disputed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_dispute_status_idx" ON "transactions" USING btree ("dispute_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reconciled_idx" ON "transactions" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reconciled_at_idx" ON "transactions" USING btree ("reconciled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_accounting_reference_idx" ON "transactions" USING btree ("accounting_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_accounting_exported_idx" ON "transactions" USING btree ("accounting_exported");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reporting_period_idx" ON "transactions" USING btree ("reporting_period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_fiscal_year_idx" ON "transactions" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_fiscal_quarter_idx" ON "transactions" USING btree ("fiscal_quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_settlement_status_idx" ON "transactions" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_settlement_date_idx" ON "transactions" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_fraud_detected_idx" ON "transactions" USING btree ("fraud_detected");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_risk_level_idx" ON "transactions" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_source_idx" ON "transactions" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_processor_type_idx" ON "transactions" USING btree ("processor_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_processor_transaction_idx" ON "transactions" USING btree ("processor_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_processor_status_idx" ON "transactions" USING btree ("processor_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_webhook_id_idx" ON "transactions" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_type_status_date_idx" ON "transactions" USING btree ("organization_id","type","status","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_reporting_period_idx" ON "transactions" USING btree ("organization_id","reporting_period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_processor_lookup_idx" ON "transactions" USING btree ("processor_type","processor_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_currency_date_idx" ON "transactions" USING btree ("currency","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_subscription_billing_idx" ON "transactions" USING btree ("subscription_id","billing_period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_history_idx" ON "transactions" USING btree ("organization_id","transaction_date","status") WHERE status IN ('completed', 'settled');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_completed_idx" ON "transactions" USING btree ("organization_id","status","completed_at") WHERE status = 'completed';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_pending_idx" ON "transactions" USING btree ("status","created_at") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_scheduled_due_idx" ON "transactions" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_unreconciled_idx" ON "transactions" USING btree ("reconciled","status","completed_at") WHERE 
        reconciled = false
        AND status = 'completed'
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reporting_period_lookup_idx" ON "transactions" USING btree ("reporting_period","organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_disputed_active_idx" ON "transactions" USING btree ("dispute_status","disputed_at") WHERE 
        dispute_status = 'pending'
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_unsettled_idx" ON "transactions" USING btree ("settlement_status","completed_at") WHERE 
        settlement_status IN ('pending', 'in_transit')
        AND status = 'completed'
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_high_risk_idx" ON "transactions" USING btree ("risk_level","status","created_at") WHERE 
        risk_level IN ('high', 'critical')
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_large_recent_idx" ON "transactions" USING btree ("amount","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_subscription_history_idx" ON "transactions" USING btree ("subscription_id","transaction_date","type") WHERE 
        subscription_id IS NOT NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_refunded_idx" ON "transactions" USING btree ("refunded_amount","refunded_at") WHERE 
        refunded_amount > 0
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_product_date_idx" ON "transactions" USING btree ("product_type","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_retry_due_idx" ON "transactions" USING btree ("next_retry_at","status") WHERE 
        status IN ('pending', 'failed')
        AND retry_count < 5
      ;