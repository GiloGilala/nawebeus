CREATE TYPE "public"."ai_model" AS ENUM('gpt-4', 'gpt-4o', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'custom');--> statement-breakpoint
CREATE TYPE "public"."alert_audience" AS ENUM('internal', 'participant');--> statement-breakpoint
CREATE TYPE "public"."alert_condition_type" AS ENUM('threshold', 'anomaly', 'trend', 'comparison', 'keyword_match', 'volume_spike', 'sentiment_crash', 'condition_type', 'sentiment_drop');--> statement-breakpoint
CREATE TYPE "public"."alert_event_severity" AS ENUM('info', 'warning', 'critical', 'crisis');--> statement-breakpoint
CREATE TYPE "public"."alert_frequency" AS ENUM('realtime', 'hourly', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."alert_recipient_mode" AS ENUM('fixed', 'triggering_entity');--> statement-breakpoint
CREATE TYPE "public"."alert_rule_source" AS ENUM('listening', 'monitoring', 'analytics', 'engagement', 'system', 'crisis', 'commerce', 'pr', 'campaign');--> statement-breakpoint
CREATE TYPE "public"."analytics_aggregation_method" AS ENUM('sum', 'avg', 'count', 'min', 'max', 'last', 'median');--> statement-breakpoint
CREATE TYPE "public"."analytics_event_source" AS ENUM('publishing', 'engagement', 'listening', 'monitoring', 'influencer', 'crisis', 'billing', 'user', 'system', 'commerce', 'campaigns', 'pr');--> statement-breakpoint
CREATE TYPE "public"."analytics_export_format" AS ENUM('csv', 'json', 'excel', 'pdf', 'pptx');--> statement-breakpoint
CREATE TYPE "public"."analytics_export_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analytics_granularity" AS ENUM('hour', 'day', 'week', 'month', 'quarter');--> statement-breakpoint
CREATE TYPE "public"."analytics_metric_type" AS ENUM('number', 'percentage', 'currency', 'duration', 'count', 'ratio');--> statement-breakpoint
CREATE TYPE "public"."api_key_environment" AS ENUM('production', 'staging', 'development');--> statement-breakpoint
CREATE TYPE "public"."api_key_permission_level" AS ENUM('read', 'write', 'admin', 'read_only');--> statement-breakpoint
CREATE TYPE "public"."api_key_security_level" AS ENUM('low', 'medium', 'high', 'critical', 'standard');--> statement-breakpoint
CREATE TYPE "public"."api_key_status" AS ENUM('active', 'inactive', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."api_key_type" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
CREATE TYPE "public"."approvable_entity_type" AS ENUM('post', 'press_release', 'engagement_response');--> statement-breakpoint
CREATE TYPE "public"."approval_action" AS ENUM('submitted', 'approved', 'rejected', 'changes_requested', 'recalled', 'escalated', 'delegated', 'reminder_sent');--> statement-breakpoint
CREATE TYPE "public"."approval_request_status" AS ENUM('pending', 'approved', 'rejected', 'changes_requested', 'escalated', 'expired', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'admin', 'system', 'api_key', 'impersonation');--> statement-breakpoint
CREATE TYPE "public"."audit_category" AS ENUM('authentication', 'authorization', 'user_management', 'content', 'billing', 'security', 'compliance', 'system_config', 'feature_flag', 'engagement', 'publishing', 'listening', 'data_ops');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'critical', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."audit_source_module" AS ENUM('core', 'admin', 'compliance', 'security', 'engagement', 'publishing', 'listening', 'monitoring', 'influencer', 'pr', 'commerce', 'campaigns', 'social_accounts', 'analytics', 'system');--> statement-breakpoint
CREATE TYPE "public"."author_tier" AS ENUM('mega', 'macro', 'mid', 'micro', 'nano');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('pending', 'running', 'completed', 'failed', 'expired', 'verified');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('full_database', 'incremental_wal', 'file_storage', 'configuration', 'metadata');--> statement-breakpoint
CREATE TYPE "public"."brand_mention_context" AS ENUM('primary', 'passing', 'none');--> statement-breakpoint
CREATE TYPE "public"."campaign_entry_method_type" AS ENUM('follow', 'like', 'comment', 'share', 'tag_friends', 'visit_website', 'email_subscribe', 'refer_friend', 'custom', 'purchase', 'review');--> statement-breakpoint
CREATE TYPE "public"."campaign_entry_status" AS ENUM('pending', 'verified', 'partial', 'failed', 'disqualified', 'winner', 'duplicate', 'referral', 'hidden', 'archived');--> statement-breakpoint
CREATE TYPE "public"."card_brand" AS ENUM('visa', 'mastercard', 'verve', 'amex', 'other');--> statement-breakpoint
CREATE TYPE "public"."commerce_platform" AS ENUM('instagram', 'facebook', 'tiktok', 'shopify', 'woocommerce', 'custom');--> statement-breakpoint
CREATE TYPE "public"."competitor_category" AS ENUM('direct', 'indirect', 'aspirational');--> statement-breakpoint
CREATE TYPE "public"."config_environment" AS ENUM('development', 'staging', 'production', 'sandbox');--> statement-breakpoint
CREATE TYPE "public"."config_kind" AS ENUM('system_config', 'feature_flag');--> statement-breakpoint
CREATE TYPE "public"."config_type" AS ENUM('security', 'rate_limit', 'feature_flag', 'integration', 'notification', 'billing', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'pending', 'revoked', 'connected');--> statement-breakpoint
CREATE TYPE "public"."consent_level" AS ENUM('none', 'partial', 'full', 'basic');--> statement-breakpoint
CREATE TYPE "public"."contact_interaction_direction" AS ENUM('inbound', 'outbound', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."contact_interaction_outcome" AS ENUM('positive', 'neutral', 'negative', 'no_response', 'coverage', 'meeting_scheduled', 'interview_scheduled', 'content_published', 'contract_signed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."contact_interaction_type" AS ENUM('email', 'whatsapp', 'phone_call', 'meeting', 'video_call', 'dm', 'event', 'social_dm', 'interview_request', 'press_release_open', 'coverage_published', 'briefing', 'content_review', 'negotiation', 'campaign_briefing', 'contract_signed');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('journalist', 'influencer');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'pending_review', 'changes_requested', 'approved', 'scheduled', 'publishing', 'published', 'partially_published', 'failed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('form', 'photo', 'video', 'text', 'link', 'social_post', 'poll_response');--> statement-breakpoint
CREATE TYPE "public"."credibility_rating" AS ENUM('verified', 'trusted', 'reliable', 'moderate', 'questionable', 'unreliable', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."crisis_status" AS ENUM('active', 'acknowledged', 'monitoring', 'resolved', 'false_positive');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('desktop', 'mobile', 'tablet', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."discount_status" AS ENUM('draft', 'active', 'paused', 'expired', 'archived');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed', 'buy_x_get_y', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."dsar_status" AS ENUM('pending', 'verifying', 'processing', 'completed', 'rejected', 'failed', 'partially_completed');--> statement-breakpoint
CREATE TYPE "public"."dsar_type" AS ENUM('access', 'erasure', 'portability', 'rectification', 'restrict_processing');--> statement-breakpoint
CREATE TYPE "public"."engagement_level" AS ENUM('none', 'low', 'medium', 'high', 'full', 'active');--> statement-breakpoint
CREATE TYPE "public"."engagement_workflow_status" AS ENUM('new', 'assigned', 'in_progress', 'awaiting_info', 'awaiting_customer', 'resolved', 'closed', 'snoozed', 'draft', 'pending_review', 'approved', 'sent', 'failed', 'scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('web', 'mobile_app', 'social', 'widget', 'api', 'import', 'referral');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."fraud_risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."giveaway_campaign_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'ended', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."giveaway_campaign_type" AS ENUM('standard', 'referral', 'multi_action', 'sweepstakes', 'contest', 'giveaway', 'photo_contest', 'video_contest', 'caption_contest', 'ugc_campaign', 'hashtag_campaign', 'poll', 'quiz', 'instant_win', 'milestone', 'engagement', 'awareness', 'conversion', 'custom', 'pr', 'influencer', 'event');--> statement-breakpoint
CREATE TYPE "public"."impersonation_end_reason" AS ENUM('expired', 'manual_end', 'security_terminated', 'system_terminated');--> statement-breakpoint
CREATE TYPE "public"."industry" AS ENUM('banking', 'fintech', 'telecom', 'fmcg', 'pr_agency', 'government', 'media', 'technology', 'other');--> statement-breakpoint
CREATE TYPE "public"."influencer_assignment_status" AS ENUM('identified', 'invited', 'negotiating', 'accepted', 'declined', 'contracted', 'content_submitted', 'content_approved', 'published', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."influencer_content_status" AS ENUM('draft', 'submitted', 'approved', 'changes_requested', 'rejected', 'published', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."influencer_content_type" AS ENUM('instagram_post', 'instagram_reel', 'instagram_story', 'tiktok_video', 'youtube_video', 'twitter_post', 'facebook_post', 'blog_post', 'linkedin_post');--> statement-breakpoint
CREATE TYPE "public"."influencer_payment_status" AS ENUM('pending', 'advance_paid', 'partial_paid', 'paid', 'overdue', 'disputed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."influencer_program_status" AS ENUM('planning', 'active', 'paused', 'completed', 'archived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."influencer_program_type" AS ENUM('product_seeding', 'brand_awareness', 'performance', 'event_promotion', 'csr', 'crisis_response');--> statement-breakpoint
CREATE TYPE "public"."influencer_status" AS ENUM('active', 'inactive', 'blacklisted', 'pending_verification');--> statement-breakpoint
CREATE TYPE "public"."influencer_tier" AS ENUM('nano', 'micro', 'mid', 'macro', 'mega');--> statement-breakpoint
CREATE TYPE "public"."intent_label" AS ENUM('question', 'complaint', 'praise', 'sales', 'support', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."interaction_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."interaction_visibility" AS ENUM('private', 'internal', 'organization');--> statement-breakpoint
CREATE TYPE "public"."invitation_role" AS ENUM('admin', 'manager', 'creator', 'analyst', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."journalist_contact_method" AS ENUM('email', 'whatsapp', 'phone', 'social', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."journalist_ndpr_consent_status" AS ENUM('pending', 'granted', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."journalist_tier" AS ENUM('tier1', 'tier2', 'tier3');--> statement-breakpoint
CREATE TYPE "public"."key_rotation_strategy" AS ENUM('manual', 'automatic', 'periodic', 'none');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_data_type" AS ENUM('user_data', 'conversations', 'audit_logs', 'orders', 'analytics', 'all');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_status" AS ENUM('active', 'released', 'expired', 'pending_release');--> statement-breakpoint
CREATE TYPE "public"."login_failure_reason" AS ENUM('invalid_password', 'account_locked', 'email_not_verified', 'account_suspended', 'account_deleted', 'mfa_failed', 'mfa_backup_failed');--> statement-breakpoint
CREATE TYPE "public"."login_method" AS ENUM('password', 'oauth', 'sso');--> statement-breakpoint
CREATE TYPE "public"."media_article_ingest_source" AS ENUM('social_listening', 'pr_monitoring', 'wire', 'manual');--> statement-breakpoint
CREATE TYPE "public"."media_article_source_type" AS ENUM('newspaper', 'blog', 'broadcast', 'wire', 'magazine', 'online', 'social');--> statement-breakpoint
CREATE TYPE "public"."media_asset_type" AS ENUM('image', 'video', 'gif', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."media_attached_to_type" AS ENUM('post', 'engagement_response', 'press_release', 'influencer_content', 'content_template');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'manager', 'creator', 'analyst', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'suspended', 'pending', 'invited');--> statement-breakpoint
CREATE TYPE "public"."mention_source" AS ENUM('social_media', 'news', 'blogs', 'forums', 'reviews', 'other');--> statement-breakpoint
CREATE TYPE "public"."mention_type" AS ENUM('direct', 'mention', 'reply', 'quote', 'retweet', 'repost');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('not_reviewed', 'pending', 'approved', 'rejected', 'flagged', 'auto_approved');--> statement-breakpoint
CREATE TYPE "public"."monitoring_campaign_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."news_source_type" AS ENUM('news_website', 'blog', 'magazine', 'newspaper', 'tv_station', 'radio_station', 'podcast', 'press_release_wire', 'industry_publication', 'trade_journal', 'newsletter', 'aggregator', 'social_media', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'in_app', 'push', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_frequency" AS ENUM('real_time', 'hourly', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."oauth_account_status" AS ENUM('active', 'inactive', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."oauth_connection_status" AS ENUM('active', 'pending', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'github', 'microsoft', 'apple');--> statement-breakpoint
CREATE TYPE "public"."oauth_scope" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
CREATE TYPE "public"."oauth_status" AS ENUM('active', 'inactive', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."oauth_token_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."onboarding_item" AS ENUM('connect_social_account', 'setup_monitoring_keyword', 'invite_team_member', 'complete_profile', 'customize_org_settings');--> statement-breakpoint
CREATE TYPE "public"."order_fulfillment_status" AS ENUM('unfulfilled', 'partially_fulfilled', 'fulfilled', 'shipped', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partial_refund');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'deleted', 'pending');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('individual', 'company', 'agency', 'government', 'team');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('card', 'bank_account', 'ussd');--> statement-breakpoint
CREATE TYPE "public"."permission_scope" AS ENUM('global', 'organization', 'resource');--> statement-breakpoint
CREATE TYPE "public"."permission_status" AS ENUM('active', 'inactive', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('read', 'write', 'execute', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('starter', 'growth', 'professional', 'enterprise', 'agency');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('twitter_x', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'reddit', 'telegram', 'web', 'email', 'sms', 'whatsapp', 'wire');--> statement-breakpoint
CREATE TYPE "public"."political_leaning" AS ENUM('far_left', 'left', 'center_left', 'center', 'center_right', 'right', 'far_right', 'neutral', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."pr_attribution_method" AS ENUM('keyword_match', 'journalist_link', 'content_match', 'manual', 'ai_detected', 'utm_tracking');--> statement-breakpoint
CREATE TYPE "public"."pr_crisis_type" AS ENUM('service_outage', 'data_breach', 'product_recall', 'negative_coverage', 'executive_misconduct', 'regulatory_action', 'social_media_storm', 'other');--> statement-breakpoint
CREATE TYPE "public"."pr_initiative_status" AS ENUM('planning', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."engagement_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."product_inventory_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."product_sync_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'org_only', 'private');--> statement-breakpoint
CREATE TYPE "public"."publishing_result_status" AS ENUM('queued', 'publishing', 'published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."retention_action" AS ENUM('delete', 'anonymize', 'archive', 'export');--> statement-breakpoint
CREATE TYPE "public"."revocation_type" AS ENUM('user', 'admin', 'system', 'security', 'manual');--> statement-breakpoint
CREATE TYPE "public"."revoke_reason" AS ENUM('user', 'admin', 'security', 'timeout', 'password_change');--> statement-breakpoint
CREATE TYPE "public"."role_assignment_source" AS ENUM('system', 'manual', 'inherited');--> statement-breakpoint
CREATE TYPE "public"."role_assignment_status" AS ENUM('active', 'revoked', 'pending');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('global', 'organization', 'project');--> statement-breakpoint
CREATE TYPE "public"."role_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('system', 'custom');--> statement-breakpoint
CREATE TYPE "public"."role_value_type" AS ENUM('admin', 'member', 'viewer', 'user');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('immediate', 'scheduled', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."security_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sentiment_label" AS ENUM('positive', 'neutral', 'negative', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('web', 'mobile', 'api', 'cli');--> statement-breakpoint
CREATE TYPE "public"."social_account_operation_type" AS ENUM('health_check', 'token_refresh', 'sync', 'reconnect', 'disconnect');--> statement-breakpoint
CREATE TYPE "public"."social_account_status" AS ENUM('active', 'error', 'paused', 'needs_reauth', 'disconnected', 'pending_verification');--> statement-breakpoint
CREATE TYPE "public"."social_account_type" AS ENUM('personal', 'business', 'creator', 'brand', 'organization');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'monitoring', 'paused', 'inactive', 'blocked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."source_tier" AS ENUM('tier_1', 'tier_2', 'tier_3', 'tier_4');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'cancelled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('post', 'engagement_response', 'press_release', 'campaign', 'email');--> statement-breakpoint
CREATE TYPE "public"."token_refresh_trigger" AS ENUM('proactive', 'on_demand', 'error_recovery', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."token_status" AS ENUM('active', 'expired', 'revoked', 'valid');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('access', 'refresh', 'email_verification', 'password_reset', 'invite', 'otp', 'magic_link');--> statement-breakpoint
CREATE TYPE "public"."usage_metric_type" AS ENUM('users', 'social_accounts', 'mentions', 'monitoring_keywords', 'conversations', 'storage_bytes', 'api_calls', 'custom_reports', 'scheduled_reports');--> statement-breakpoint
CREATE TYPE "public"."user_role_assignment_status" AS ENUM('active', 'revoked', 'pending');--> statement-breakpoint
CREATE TYPE "public"."user_role_source" AS ENUM('system', 'manual', 'inherited');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'pending_verification', 'pending_deletion', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."winner_status" AS ENUM('pending', 'notified', 'accepted', 'shipped', 'delivered', 'forfeited', 'expired');--> statement-breakpoint
CREATE TYPE "public"."winner_tier" AS ENUM('grand_prize', 'runner_up_1', 'runner_up_2', 'consolation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_events" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"rule_id" varchar(32),
	"alert_type" varchar(50) NOT NULL,
	"severity" "alert_event_severity" NOT NULL,
	"source_module" "alert_rule_source" NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar(32),
	"title" text NOT NULL,
	"description" text,
	"context" jsonb,
	"breach_type" varchar(30),
	"sla_started_at" timestamp with time zone,
	"breached_at" timestamp with time zone,
	"minutes_overdue" integer,
	"estimated_naira_impact" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"alert_sent" boolean DEFAULT false NOT NULL,
	"alert_sent_at" timestamp with time zone,
	"notification_status" jsonb DEFAULT '{}'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by_id" varchar(32),
	"acknowledged_at" timestamp with time zone,
	"acknowledgment_notes" text,
	"escalated_at" timestamp with time zone,
	"escalated_to_id" varchar(32),
	"escalation_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ae_minutes_overdue" CHECK ("alert_events"."minutes_overdue" >= 0),
	CONSTRAINT "chk_ae_naira_impact" CHECK ("alert_events"."estimated_naira_impact" IS NULL
        OR "alert_events"."estimated_naira_impact" >= 0),
	CONSTRAINT "chk_ae_alert_sent_consistency" CHECK (NOT (
        "alert_events"."alert_sent" = TRUE
        AND "alert_events"."alert_sent_at" IS NULL
      )),
	CONSTRAINT "chk_ae_alert_sent_after_created" CHECK ("alert_events"."alert_sent_at" IS NULL
        OR "alert_events"."alert_sent_at" >= "alert_events"."created_at"),
	CONSTRAINT "chk_ae_ack_consistency" CHECK (NOT (
        "alert_events"."is_acknowledged" = TRUE
        AND ("alert_events"."acknowledged_by_id" IS NULL
          OR "alert_events"."acknowledged_at" IS NULL)
      )),
	CONSTRAINT "chk_ae_ack_after_created" CHECK ("alert_events"."acknowledged_at" IS NULL
        OR "alert_events"."acknowledged_at" >= "alert_events"."created_at"),
	CONSTRAINT "chk_ae_escalation_consistency" CHECK (NOT (
        "alert_events"."escalated_at" IS NOT NULL
        AND "alert_events"."escalated_to_id" IS NULL
      )),
	CONSTRAINT "chk_ae_escalated_after_created" CHECK ("alert_events"."escalated_at" IS NULL
        OR "alert_events"."escalated_at" >= "alert_events"."created_at"),
	CONSTRAINT "chk_ae_sla_breach_fields" CHECK ("alert_events"."breach_type" IS NULL
        OR (
          "alert_events"."sla_started_at" IS NOT NULL
          AND "alert_events"."breached_at" IS NOT NULL
          AND "alert_events"."breached_at" >= "alert_events"."sla_started_at"
          AND "alert_events"."minutes_overdue" IS NOT NULL
        ))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_rules" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"source_module" "alert_rule_source" NOT NULL,
	"condition_type" "alert_condition_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"condition" jsonb NOT NULL,
	"watched_entity_ids" text[],
	"audience" "alert_audience" DEFAULT 'internal' NOT NULL,
	"recipient_mode" "alert_recipient_mode" DEFAULT 'fixed' NOT NULL,
	"threshold" numeric(10, 4),
	"scope_ids" text[],
	"default_severity" "alert_event_severity" DEFAULT 'warning' NOT NULL,
	"frequency" "alert_frequency" DEFAULT 'realtime' NOT NULL,
	"notification_channels" jsonb NOT NULL,
	"recipients" jsonb NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"timezone" varchar(100) DEFAULT 'Africa/Lagos' NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"max_alerts_per_day" integer,
	"escalate_after_minutes" integer,
	"escalation_recipients" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"last_severity" "alert_event_severity",
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ar_org_name" UNIQUE("organization_id","name"),
	CONSTRAINT "chk_ar_cooldown_positive" CHECK ("alert_rules"."cooldown_minutes" > 0),
	CONSTRAINT "chk_ar_max_alerts_positive" CHECK ("alert_rules"."max_alerts_per_day" IS NULL
        OR "alert_rules"."max_alerts_per_day" > 0),
	CONSTRAINT "chk_ar_escalate_positive" CHECK ("alert_rules"."escalate_after_minutes" IS NULL
        OR "alert_rules"."escalate_after_minutes" > 0),
	CONSTRAINT "chk_ar_trigger_count" CHECK ("alert_rules"."trigger_count" >= 0),
	CONSTRAINT "chk_ar_version" CHECK ("alert_rules"."version" >= 1),
	CONSTRAINT "chk_ar_quiet_hours_consistency" CHECK (("alert_rules"."quiet_hours_enabled" = FALSE
        AND "alert_rules"."quiet_hours_start" IS NULL
        AND "alert_rules"."quiet_hours_end" IS NULL)
      OR
      ("alert_rules"."quiet_hours_enabled" = TRUE
        AND "alert_rules"."quiet_hours_start" IS NOT NULL
        AND "alert_rules"."quiet_hours_end" IS NOT NULL)),
	CONSTRAINT "chk_ar_trigger_consistency" CHECK (("alert_rules"."trigger_count" = 0
        AND "alert_rules"."last_triggered_at" IS NULL)
      OR
      ("alert_rules"."trigger_count" > 0
        AND "alert_rules"."last_triggered_at" IS NOT NULL)),
	CONSTRAINT "chk_ar_threshold_only_for_threshold" CHECK ("alert_rules"."threshold" IS NULL
        OR "alert_rules"."condition_type" = 'threshold'),
	CONSTRAINT "chk_ar_engagement_no_quiet_hours" CHECK ("alert_rules"."source_module" <> 'engagement'
        OR "alert_rules"."quiet_hours_enabled" = FALSE),
	CONSTRAINT "chk_ar_system_no_scope" CHECK ("alert_rules"."source_module" <> 'system'
        OR "alert_rules"."scope_ids" IS NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_aggregates" (
	"organization_id" varchar(32) NOT NULL,
	"granularity" "analytics_granularity" NOT NULL,
	"time_bucket" timestamp with time zone NOT NULL,
	"platform" varchar(50) DEFAULT '' NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"dimension_1" varchar(100) DEFAULT '' NOT NULL,
	"dimension_2" varchar(100) DEFAULT '' NOT NULL,
	"dimension_3" varchar(100) DEFAULT '' NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"naira_value" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"sample_size" integer,
	"min_value" numeric(20, 4),
	"max_value" numeric(20, 4),
	"p50_value" numeric(20, 4),
	"p95_value" numeric(20, 4),
	"last_computed_at" timestamp with time zone,
	"data_complete" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pk_aag_natural_key" PRIMARY KEY("organization_id","granularity","time_bucket","platform","metric_name","dimension_1","dimension_2","dimension_3"),
	CONSTRAINT "chk_aag_sample_size" CHECK ("analytics_aggregates"."sample_size" >= 0),
	CONSTRAINT "chk_aag_naira_value" CHECK ("analytics_aggregates"."naira_value" IS NULL
        OR "analytics_aggregates"."naira_value" >= 0),
	CONSTRAINT "chk_aag_percentile_range" CHECK (("analytics_aggregates"."min_value" IS NULL
        OR "analytics_aggregates"."p50_value" IS NULL
        OR "analytics_aggregates"."max_value" IS NULL)
      OR ("analytics_aggregates"."min_value" <= "analytics_aggregates"."p50_value"
        AND "analytics_aggregates"."p50_value" <= "analytics_aggregates"."max_value")),
	CONSTRAINT "chk_aag_p95_gte_p50" CHECK ("analytics_aggregates"."p50_value" IS NULL
        OR "analytics_aggregates"."p95_value" IS NULL
        OR "analytics_aggregates"."p95_value" >= "analytics_aggregates"."p50_value"),
	CONSTRAINT "chk_aag_complete_has_computed_at" CHECK ("analytics_aggregates"."data_complete" = FALSE
        OR "analytics_aggregates"."last_computed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_dashboards" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"time_range" jsonb,
	"refresh_interval_seconds" integer DEFAULT 300 NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"shared_with" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_ad_refresh_interval" CHECK ("analytics_dashboards"."refresh_interval_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_timestamp" timestamp with time zone NOT NULL,
	"source" "analytics_event_source" NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar(32),
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"naira_amount" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"user_id" varchar(32),
	"session_id" varchar(32),
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_aev_naira_amount" CHECK ("analytics_events"."naira_amount" IS NULL
        OR "analytics_events"."naira_amount" >= 0),
	CONSTRAINT "chk_aev_event_timestamp" CHECK ("analytics_events"."event_timestamp" <= now() + interval '24 hours')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_metrics" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32),
	"name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50),
	"formula" text,
	"metric_type" "analytics_metric_type" NOT NULL,
	"aggregation_method" "analytics_aggregation_method" DEFAULT 'sum' NOT NULL,
	"default_granularity" "analytics_granularity" DEFAULT 'day' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"decimals" integer DEFAULT 2 NOT NULL,
	"unit" varchar(20),
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tags" text[],
	"created_by_id" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_am_org_name" UNIQUE("organization_id","name"),
	CONSTRAINT "chk_am_system_no_org" CHECK ("analytics_metrics"."is_system" = FALSE
        OR "analytics_metrics"."organization_id" IS NULL),
	CONSTRAINT "chk_am_custom_requires_org" CHECK ("analytics_metrics"."is_system" = TRUE
        OR "analytics_metrics"."organization_id" IS NOT NULL),
	CONSTRAINT "chk_am_formula_for_computed" CHECK ("analytics_metrics"."formula" IS NULL
        OR "analytics_metrics"."metric_type" IN ('ratio', 'percentage', 'currency')),
	CONSTRAINT "chk_am_decimals_range" CHECK ("analytics_metrics"."decimals" >= 0 AND "analytics_metrics"."decimals" <= 10)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_reports" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"config" jsonb NOT NULL,
	"template_id" varchar(32),
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_config" jsonb,
	"recipients" jsonb,
	"delivery_format" "analytics_export_format" DEFAULT 'pdf' NOT NULL,
	"include_raw_data" boolean DEFAULT false NOT NULL,
	"include_charts" boolean DEFAULT true NOT NULL,
	"is_white_label" boolean DEFAULT false NOT NULL,
	"white_label_config" jsonb,
	"last_export_status" "analytics_export_status",
	"last_export_url" text,
	"last_export_at" timestamp with time zone,
	"last_export_error" text,
	"last_export_row_count" bigint,
	"last_export_file_size_bytes" bigint,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"consecutive_failure_count" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ar_failure_count" CHECK ("analytics_reports"."consecutive_failure_count" >= 0),
	CONSTRAINT "chk_ar_export_row_count" CHECK ("analytics_reports"."last_export_row_count" IS NULL
        OR "analytics_reports"."last_export_row_count" >= 0),
	CONSTRAINT "chk_ar_export_file_size" CHECK ("analytics_reports"."last_export_file_size_bytes" IS NULL
        OR "analytics_reports"."last_export_file_size_bytes" >= 0),
	CONSTRAINT "chk_ar_scheduled_has_config" CHECK ("analytics_reports"."is_scheduled" = FALSE
        OR "analytics_reports"."schedule_config" IS NOT NULL),
	CONSTRAINT "chk_ar_scheduled_has_next_run" CHECK ("analytics_reports"."is_scheduled" = FALSE
        OR "analytics_reports"."next_run_at" IS NOT NULL),
	CONSTRAINT "chk_ar_white_label_has_config" CHECK ("analytics_reports"."is_white_label" = FALSE
        OR "analytics_reports"."white_label_config" IS NOT NULL),
	CONSTRAINT "chk_ar_export_status_has_timestamp" CHECK ("analytics_reports"."last_export_status" IS NULL
        OR "analytics_reports"."last_export_at" IS NOT NULL),
	CONSTRAINT "chk_ar_next_run_after_last_run" CHECK ("analytics_reports"."last_run_at" IS NULL
        OR "analytics_reports"."next_run_at" IS NULL
        OR "analytics_reports"."next_run_at" > "analytics_reports"."last_run_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(100),
	"version" integer DEFAULT 1 NOT NULL,
	"secret_version" integer DEFAULT 1 NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"project_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_type" "api_key_type" NOT NULL,
	"environment" "api_key_environment" DEFAULT 'production' NOT NULL,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"public_key" varchar(100) NOT NULL,
	"secret_hash" varchar(255),
	"encrypted_secret" text,
	"jwks_url" text,
	"key_prefix" varchar(8) NOT NULL,
	"fingerprint" varchar(64),
	"permission_level" "api_key_permission_level" DEFAULT 'read_only' NOT NULL,
	"security_level" "api_key_security_level" DEFAULT 'standard' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"allowed_platforms" jsonb DEFAULT '["web"]'::jsonb,
	"denied_platforms" jsonb DEFAULT '[]'::jsonb,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb,
	"allowed_ips" jsonb DEFAULT '[]'::jsonb,
	"denied_ips" jsonb DEFAULT '[]'::jsonb,
	"endpoints" jsonb DEFAULT '{}'::jsonb,
	"rate_limits" jsonb DEFAULT '{"limits":{},"enabled":false,"strategy":"fixed_window"}'::jsonb NOT NULL,
	"daily_quota" integer,
	"monthly_quota" integer,
	"total_quota" integer,
	"quota_used" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"last_status_code" integer,
	"average_latency" integer,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"not_before" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_used_ip" "inet",
	"last_used_country" varchar(100),
	"last_used_city" varchar(100),
	"last_user_agent" varchar(500),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_ip" "inet",
	"created_country" varchar(100),
	"created_user_agent" varchar(500),
	"rotation_strategy" "key_rotation_strategy" DEFAULT 'none',
	"rotated_from_id" uuid,
	"rotation_count" integer DEFAULT 0 NOT NULL,
	"next_rotation_at" timestamp with time zone,
	"last_rotated_at" timestamp with time zone,
	"is_secret_exposed" boolean DEFAULT false,
	"secret_last_exposed_at" timestamp with time zone,
	"max_inactivity_days" integer,
	"force_reauthentication" boolean DEFAULT false,
	"webhook" jsonb DEFAULT '{}'::jsonb,
	"platform_config" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"revocation_type" "revocation_type" DEFAULT 'manual',
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_expiry_check" CHECK ("api_keys"."expires_at" IS NULL OR "api_keys"."expires_at" > "api_keys"."issued_at"),
	CONSTRAINT "quota_check" CHECK ("api_keys"."quota_used" <= COALESCE("api_keys"."daily_quota", "api_keys"."monthly_quota", "api_keys"."total_quota", "api_keys"."quota_used")),
	CONSTRAINT "rotation_count_check" CHECK ("api_keys"."rotation_count" >= 0),
	CONSTRAINT "usage_count_check" CHECK ("api_keys"."usage_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_history" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"approval_request_id" varchar(32) NOT NULL,
	"action" "approval_action" NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_aph_rejection_comment" CHECK (NOT (
        "approval_history"."action" = 'rejected'
        AND "approval_history"."comment" IS NULL
      )),
	CONSTRAINT "chk_aph_changes_requested_comment" CHECK (NOT (
        "approval_history"."action" = 'changes_requested'
        AND "approval_history"."comment" IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_requests" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"entity_type" "approvable_entity_type" NOT NULL,
	"entity_id" varchar(32) NOT NULL,
	"requester_id" varchar(32) NOT NULL,
	"approval_chain" jsonb NOT NULL,
	"current_approver_id" varchar(32),
	"current_step" integer DEFAULT 1 NOT NULL,
	"status" "approval_request_status" DEFAULT 'pending' NOT NULL,
	"content_snapshot" jsonb,
	"entity_version" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"escalated_to_id" varchar(32),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_apr_current_step_range" CHECK ("approval_requests"."current_step" BETWEEN 1 AND 100),
	CONSTRAINT "chk_apr_entity_version" CHECK ("approval_requests"."entity_version" >= 1),
	CONSTRAINT "chk_apr_version" CHECK ("approval_requests"."version" >= 1),
	CONSTRAINT "chk_apr_completed_at_terminal" CHECK (NOT (
        "approval_requests"."status" IN ('approved', 'rejected', 'expired', 'recalled')
        AND "approval_requests"."completed_at" IS NULL
      )),
	CONSTRAINT "chk_apr_completed_after_created" CHECK ("approval_requests"."completed_at" IS NULL
        OR "approval_requests"."completed_at" >= "approval_requests"."created_at"),
	CONSTRAINT "chk_apr_escalated_after_created" CHECK ("approval_requests"."escalated_at" IS NULL
        OR "approval_requests"."escalated_at" >= "approval_requests"."created_at"),
	CONSTRAINT "chk_apr_expires_after_created" CHECK ("approval_requests"."expires_at" IS NULL
        OR "approval_requests"."expires_at" > "approval_requests"."created_at"),
	CONSTRAINT "chk_apr_pending_has_approver" CHECK (NOT (
        "approval_requests"."status" = 'pending'
        AND "approval_requests"."current_approver_id" IS NULL
      )),
	CONSTRAINT "chk_apr_terminal_no_approver" CHECK (NOT (
        "approval_requests"."status" IN ('approved', 'rejected', 'expired', 'recalled')
        AND "approval_requests"."current_approver_id" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unified_audit_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"module" "audit_source_module" NOT NULL,
	"organization_id" varchar(64),
	"actor_id" varchar(64),
	"actor_type" "audit_actor_type",
	"actor_ip" "inet",
	"actor_user_agent" text,
	"impersonation_session_id" varchar(64),
	"action" varchar(100) NOT NULL,
	"category" "audit_category",
	"resource_type" varchar(50),
	"resource_id" varchar(64),
	"target_user_id" varchar(64),
	"before_state" jsonb,
	"after_state" jsonb,
	"changes" jsonb,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"reason" text,
	"request_id" varchar(100),
	"session_id" varchar(64),
	"checksum" varchar(64),
	"previous_checksum" varchar(64),
	"hash_chain_valid" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ual_checksum_length" CHECK ("unified_audit_log"."checksum" IS NULL
        OR length("unified_audit_log"."checksum") = 64),
	CONSTRAINT "chk_ual_previous_checksum_length" CHECK ("unified_audit_log"."previous_checksum" IS NULL
        OR length("unified_audit_log"."previous_checksum") = 64),
	CONSTRAINT "chk_ual_checksum_pairing" CHECK (("unified_audit_log"."checksum" IS NULL
        AND "unified_audit_log"."previous_checksum" IS NULL)
      OR
      ("unified_audit_log"."checksum" IS NOT NULL
        AND "unified_audit_log"."previous_checksum" IS NOT NULL)),
	CONSTRAINT "chk_ual_actor_consistency" CHECK ("unified_audit_log"."actor_id" IS NULL
        OR "unified_audit_log"."actor_type" IS NOT NULL),
	CONSTRAINT "chk_ual_impersonation_consistency" CHECK ("unified_audit_log"."actor_type" <> 'impersonation'
        OR "unified_audit_log"."impersonation_session_id" IS NOT NULL),
	CONSTRAINT "chk_ual_impersonation_only" CHECK ("unified_audit_log"."impersonation_session_id" IS NULL
        OR "unified_audit_log"."actor_type" = 'impersonation'),
	CONSTRAINT "chk_ual_admin_requires_checksum" CHECK ("unified_audit_log"."module" <> 'admin'
        OR "unified_audit_log"."checksum" IS NOT NULL),
	CONSTRAINT "chk_ual_system_requires_checksum" CHECK ("unified_audit_log"."module" <> 'system'
        OR "unified_audit_log"."checksum" IS NOT NULL),
	CONSTRAINT "chk_ual_compliance_requires_checksum" CHECK ("unified_audit_log"."module" <> 'compliance'
        OR "unified_audit_log"."checksum" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_interactions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"contact_id" varchar(32) NOT NULL,
	"campaign_id" varchar(32),
	"press_release_id" varchar(32),
	"assignment_id" varchar(32),
	"distribution_id" varchar(32),
	"interaction_type" "contact_interaction_type" NOT NULL,
	"direction" "contact_interaction_direction",
	"subject" text,
	"content" text,
	"outcome" "contact_interaction_outcome",
	"response_time_minutes" integer,
	"duration_minutes" integer,
	"priority" "interaction_priority" DEFAULT 'medium' NOT NULL,
	"visibility" "interaction_visibility" DEFAULT 'organization' NOT NULL,
	"external_reference" varchar(255),
	"metadata" jsonb,
	"follow_up_at" timestamp with time zone,
	"follow_up_note" text,
	"follow_up_status" "follow_up_status" DEFAULT 'pending' NOT NULL,
	"follow_up_completed_at" timestamp with time zone,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ci_org_external_ref" UNIQUE("organization_id","external_reference"),
	CONSTRAINT "chk_ci_followup_consistency" CHECK (NOT (
        "contact_interactions"."follow_up_status" = 'completed'
        AND "contact_interactions"."follow_up_completed_at" IS NULL
      )),
	CONSTRAINT "chk_ci_response_time_positive" CHECK ("contact_interactions"."response_time_minutes" IS NULL
        OR "contact_interactions"."response_time_minutes" >= 0),
	CONSTRAINT "chk_ci_duration_positive" CHECK ("contact_interactions"."duration_minutes" IS NULL
        OR "contact_interactions"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"kind" "contact_kind" NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"display_name" varchar(255),
	"email" varchar(255),
	"email_secondary" varchar(255),
	"phone" varchar(20),
	"whatsapp" varchar(20),
	"telegram" varchar(100),
	"location" text,
	"tags" text[],
	"notes" text,
	"relationship_score" integer DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" varchar(32),
	"merged_into_id" varchar(32),
	"merged_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contacts_org_email" UNIQUE("organization_id","email"),
	CONSTRAINT "uq_contacts_org_phone" UNIQUE("organization_id","phone"),
	CONSTRAINT "chk_contacts_merged_consistency" CHECK (("contacts"."merged_into_id" IS NULL) = ("contacts"."merged_at" IS NULL)),
	CONSTRAINT "chk_contacts_deleted_consistency" CHECK (("contacts"."deleted_at" IS NULL) = ("contacts"."deleted_by_id" IS NULL)),
	CONSTRAINT "chk_contacts_relationship_score" CHECK ("contacts"."relationship_score" BETWEEN 0 AND 100),
	CONSTRAINT "chk_contacts_interaction_count" CHECK ("contacts"."interaction_count" >= 0),
	CONSTRAINT "chk_contacts_version" CHECK ("contacts"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_by" uuid,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32) NOT NULL,
	"attached_to_type" "media_attached_to_type",
	"attached_to_id" varchar(32),
	"used_in_entity_ids" text[],
	"name" varchar(255) NOT NULL,
	"asset_type" "media_asset_type" NOT NULL,
	"storage_url" text NOT NULL,
	"cdn_url" text,
	"thumbnail_url" text,
	"size_bytes" bigint NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" numeric(10, 3),
	"processing_state" jsonb,
	"folder_path" text,
	"is_library_asset" boolean DEFAULT true NOT NULL,
	"purpose" varchar(30),
	"display_order" integer,
	"tags" text[],
	"alt_text" text,
	"attribution" text,
	"license_type" varchar(50),
	"license_expires_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"uploaded_by" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ma_version" CHECK ("media_assets"."version" >= 1),
	CONSTRAINT "chk_ma_size_positive" CHECK ("media_assets"."size_bytes" > 0),
	CONSTRAINT "chk_ma_dimensions_consistent" CHECK (("media_assets"."width" IS NULL) = ("media_assets"."height" IS NULL)),
	CONSTRAINT "chk_ma_dimensions_positive" CHECK ("media_assets"."width" IS NULL
        OR ("media_assets"."width" > 0 AND "media_assets"."height" > 0)),
	CONSTRAINT "chk_ma_duration_positive" CHECK ("media_assets"."duration_seconds" IS NULL
        OR "media_assets"."duration_seconds" > 0),
	CONSTRAINT "chk_ma_duration_video_only" CHECK ("media_assets"."duration_seconds" IS NULL
        OR "media_assets"."asset_type" IN ('video', 'gif')),
	CONSTRAINT "chk_ma_thumbnail_visual_only" CHECK ("media_assets"."thumbnail_url" IS NULL
        OR "media_assets"."asset_type" IN ('image', 'video', 'gif')),
	CONSTRAINT "chk_ma_attachment_consistency" CHECK (("media_assets"."attached_to_type" IS NULL) = ("media_assets"."attached_to_id" IS NULL)),
	CONSTRAINT "chk_ma_soft_delete_library_only" CHECK (NOT ("media_assets"."is_deleted" = TRUE
            AND "media_assets"."attached_to_type" IS NOT NULL)),
	CONSTRAINT "chk_ma_folder_library_only" CHECK (NOT ("media_assets"."folder_path" IS NOT NULL
            AND "media_assets"."attached_to_type" IS NOT NULL)),
	CONSTRAINT "chk_ma_folder_path_nonempty" CHECK ("media_assets"."folder_path" IS NULL
        OR length(trim("media_assets"."folder_path")) > 0),
	CONSTRAINT "chk_ma_tags_library_only" CHECK ("media_assets"."tags" IS NULL
        OR "media_assets"."attached_to_type" IS NULL),
	CONSTRAINT "chk_ma_soft_delete_consistency" CHECK (("media_assets"."is_deleted" = FALSE
        AND "media_assets"."deleted_at" IS NULL)
      OR
      ("media_assets"."is_deleted" = TRUE
        AND "media_assets"."deleted_at" IS NOT NULL)),
	CONSTRAINT "chk_ma_license_expiry_requires_type" CHECK ("media_assets"."license_expires_at" IS NULL
        OR "media_assets"."license_type" IS NOT NULL),
	CONSTRAINT "chk_ma_license_expiry_after_created" CHECK ("media_assets"."license_expires_at" IS NULL
        OR "media_assets"."license_expires_at" > "media_assets"."created_at"),
	CONSTRAINT "chk_ma_deleted_at_after_created" CHECK ("media_assets"."deleted_at" IS NULL
        OR "media_assets"."deleted_at" >= "media_assets"."created_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"provider_username" varchar(255),
	"provider_account_email" varchar(255),
	"provider_account_email_verified" boolean DEFAULT false,
	"provider_account_phone" varchar(50),
	"provider_account_phone_verified" boolean DEFAULT false,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"token_type" varchar(50) DEFAULT 'Bearer',
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"id_token_expires_at" timestamp with time zone,
	"token_status" "token_status" DEFAULT 'valid' NOT NULL,
	"last_token_refresh_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"granted_permissions" jsonb DEFAULT '[]'::jsonb,
	"status" "oauth_account_status" DEFAULT 'active' NOT NULL,
	"connection_status" "connection_status" DEFAULT 'connected',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false,
	"is_default" boolean DEFAULT false,
	"last_connected_at" timestamp with time zone,
	"last_disconnected_at" timestamp with time zone,
	"connection_error" varchar(500),
	"retry_count" integer DEFAULT 0,
	"consent_level" "consent_level" DEFAULT 'basic' NOT NULL,
	"consent_granted_at" timestamp with time zone,
	"consent_expires_at" timestamp with time zone,
	"data_processing_consent" boolean DEFAULT false NOT NULL,
	"data_processing_consent_at" timestamp with time zone,
	"marketing_consent" boolean DEFAULT false,
	"marketing_consent_at" timestamp with time zone,
	"profile" jsonb DEFAULT '{}'::jsonb,
	"raw_profile" text,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb,
	"login_count" integer DEFAULT 0,
	"last_login_at" timestamp with time zone,
	"last_login_ip" "inet",
	"last_login_user_agent" varchar(500),
	"last_sync_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"sync_settings" jsonb DEFAULT '{}'::jsonb,
	"usage_stats" jsonb DEFAULT '{}'::jsonb,
	"security_flags" jsonb DEFAULT '[]'::jsonb,
	"compliance_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by_ip" "inet",
	"created_by_user_agent" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deletion_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"role_id" uuid,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone,
	"invited_email" varchar(255),
	"invitation_token" varchar(255),
	"invitation_token_hash" text,
	"invitation_sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"invitation_note" text,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"suspended_at" timestamp with time zone,
	"suspended_by" uuid,
	"suspension_reason" text,
	"suspension_ends_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" uuid,
	"deactivation_reason" text,
	"display_name" varchar(200),
	"job_title" varchar(100),
	"department" varchar(100),
	"bio" text,
	"avatar_url" varchar,
	"work_schedule" jsonb DEFAULT '{}'::jsonb,
	"permission_overrides" jsonb DEFAULT '{}'::jsonb,
	"access_restrictions" jsonb DEFAULT '{}'::jsonb,
	"last_active_at" timestamp with time zone,
	"last_activity_type" varchar(100),
	"activity_stats" jsonb DEFAULT '{}'::jsonb,
	"productivity_score" integer DEFAULT 0,
	"engagement_level" "engagement_level" DEFAULT 'active',
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"onboarding_data" jsonb DEFAULT '{}'::jsonb,
	"is_billable" boolean DEFAULT true NOT NULL,
	"seat_type" varchar(50) DEFAULT 'full',
	"license_info" jsonb DEFAULT '{}'::jsonb,
	"reports_to" uuid,
	"allowed_ips" jsonb DEFAULT '[]'::jsonb,
	"blocked_ips" jsonb DEFAULT '[]'::jsonb,
	"requires_mfa" boolean DEFAULT false NOT NULL,
	"access_schedule" jsonb DEFAULT '{}'::jsonb,
	"max_concurrent_sessions" integer DEFAULT 3,
	"current_active_sessions" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_name" varchar(200),
	"logo_url" varchar(2048),
	"icon_url" varchar(2048),
	"cover_image_url" varchar(2048),
	"description" text,
	"tagline" varchar(200),
	"email" varchar(255),
	"phone" varchar(20),
	"website" varchar(255),
	"address" jsonb DEFAULT '{}'::jsonb,
	"billing_address" jsonb DEFAULT '{}'::jsonb,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"language" varchar(10) DEFAULT 'en-NG' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"type" "organization_type" DEFAULT 'team' NOT NULL,
	"industry" "industry",
	"company_size" varchar(20),
	"founded_year" integer,
	"tax_id" varchar(100),
	"status" "organization_status" DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"setup_data" jsonb DEFAULT '{}'::jsonb,
	"owner_id" uuid NOT NULL,
	"created_by" uuid,
	"parent_organization_id" uuid,
	"is_parent" boolean DEFAULT false NOT NULL,
	"custom_domain" varchar(255),
	"custom_domain_verified" boolean DEFAULT false,
	"whitelabel" jsonb DEFAULT '{}'::jsonb,
	"team_stats" jsonb DEFAULT '{}'::jsonb,
	"collaboration_settings" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"integrations" jsonb DEFAULT '{}'::jsonb,
	"last_activity_at" timestamp with time zone,
	"last_activity_type" varchar(100),
	"activity_score" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"growth_score" integer DEFAULT 0 NOT NULL,
	"platform_stats" jsonb DEFAULT '{}'::jsonb,
	"content_stats" jsonb DEFAULT '{}'::jsonb,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" varchar(20),
	"dpa_accepted_at" timestamp with time zone,
	"dpa_version" varchar(20),
	"privacy_policy_accepted_at" timestamp with time zone,
	"privacy_policy_version" varchar(20),
	"cookie_consent_accepted_at" timestamp with time zone,
	"cookie_consent_version" varchar(20),
	"data_residency" varchar(50) DEFAULT 'US',
	"data_processing_location" varchar(50),
	"data_backup_location" varchar(50),
	"privacy_settings" jsonb DEFAULT '{}'::jsonb,
	"security_settings" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"public_notes" text,
	"health_score" integer DEFAULT 50,
	"health_score_version" varchar(20),
	"health_score_calculated_at" timestamp with time zone,
	"risk_level" varchar(20) DEFAULT 'low',
	"risk_level_calculated_at" timestamp with time zone,
	"churn_risk" integer DEFAULT 0,
	"churn_risk_calculated_at" timestamp with time zone,
	"customer_tier" varchar(20) DEFAULT 'standard',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deletion_reason" text,
	"scheduled_deletion_at" timestamp with time zone,
	"data_export_requested_at" timestamp with time zone,
	"data_export_completed_at" timestamp with time zone,
	"data_anonymized_at" timestamp with time zone,
	"data_archived_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permission_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"display_name" varchar(200),
	"description" text,
	"category" varchar(100) NOT NULL,
	"type" "permission_type" DEFAULT 'system' NOT NULL,
	"scope" "permission_scope" DEFAULT 'organization' NOT NULL,
	"organization_id" uuid,
	"sensitivity" "security_level" DEFAULT 'medium' NOT NULL,
	"requires_mfa" boolean DEFAULT false NOT NULL,
	"status" "permission_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT true NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"color" varchar(50),
	"icon" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "permission_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_permission_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" uuid,
	"permission" varchar(100) NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permission_string" varchar(255) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"parent_permission_id" uuid,
	"type" "permission_type" DEFAULT 'system' NOT NULL,
	"scope" "permission_scope" DEFAULT 'organization' NOT NULL,
	"organization_id" uuid,
	"name" varchar(200) NOT NULL,
	"display_name" varchar(200),
	"description" text,
	"category" varchar(100),
	"group_id" uuid,
	"sensitivity" "security_level" DEFAULT 'medium' NOT NULL,
	"requires_mfa" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"status" "permission_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"min_plan_tier" varchar(50),
	"available_for_plan_tiers" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deprecated_at" timestamp with time zone,
	CONSTRAINT "permissions_permission_string_unique" UNIQUE("permission_string")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_role_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"role_id" uuid,
	"role_name" varchar(100) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"previous_role_id" uuid,
	"previous_role_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"abac_rules" jsonb DEFAULT '[]'::jsonb,
	"resource_restrictions" jsonb DEFAULT '{}'::jsonb,
	"field_restrictions" jsonb DEFAULT '{}'::jsonb,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"assigned_by" uuid,
	"source" varchar(50) DEFAULT 'direct' NOT NULL,
	"template_id" uuid,
	"status" "user_role_assignment_status" DEFAULT 'active' NOT NULL,
	"is_inherited" boolean DEFAULT false NOT NULL,
	"inherited_from" uuid,
	"reason" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"change_history" jsonb DEFAULT '[]'::jsonb,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"code" varchar(50) NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"type" "role_type" DEFAULT 'custom' NOT NULL,
	"scope" "role_scope" DEFAULT 'organization' NOT NULL,
	"organization_id" uuid,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "role_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"requires_mfa" boolean DEFAULT false NOT NULL,
	"can_be_assigned_by" jsonb DEFAULT '[]'::jsonb,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"available_for_plan_tiers" jsonb DEFAULT '[]'::jsonb,
	"min_plan_tier" varchar(50),
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"color" varchar(20),
	"icon" varchar(50),
	"badge_text" varchar(50),
	"created_by" uuid,
	"last_modified_by" uuid,
	"change_history" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"archived_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"impersonated_user_id" uuid,
	"impersonated_by_user_id" uuid,
	"impersonation_reason" varchar(500),
	"impersonation_approved_at" timestamp with time zone,
	"impersonation_approved_by" uuid,
	"session_token_hash" varchar(512) NOT NULL,
	"session_token_salt" varchar(32),
	"external_session_id" varchar(255),
	"external_provider" varchar(100),
	"type" "session_type" DEFAULT 'web' NOT NULL,
	"login_method" "login_method" DEFAULT 'password' NOT NULL,
	"identity_provider" varchar(50),
	"auth_flow" varchar(100),
	"remember_me" boolean DEFAULT false NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" "security_level" DEFAULT 'low',
	"risk_calculated_at" timestamp with time zone,
	"suspicious_activity_detected" boolean DEFAULT false,
	"flagged_at" timestamp with time zone,
	"flag_reason" varchar(500),
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" varchar(500),
	"revocation_source" varchar(50),
	"replaced_by_session_id" uuid,
	"parent_session_id" uuid,
	"current_refresh_token_jti" varchar(128),
	"previous_refresh_token_jti" varchar(128),
	"previous_refresh_jti_grace_until" timestamp with time zone,
	"device_type" "device_type" DEFAULT 'unknown',
	"device_id" varchar(255),
	"device_fingerprint" varchar(512),
	"fingerprint_version" integer DEFAULT 1,
	"device_name" varchar(200),
	"device_model" varchar(200),
	"device_os" varchar(100),
	"device_os_version" varchar(50),
	"user_agent" varchar(500),
	"browser_name" varchar(100),
	"browser_version" varchar(50),
	"client_id" varchar(255),
	"client_name" varchar(255),
	"client_version" varchar(50),
	"ip_address" "inet",
	"location_country" varchar(100),
	"location_region" varchar(100),
	"location_city" varchar(100),
	"timezone" varchar(50),
	"country_code" varchar(2),
	"is_hosting" boolean DEFAULT false,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_timeout_at" timestamp with time zone,
	"absolute_timeout_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"last_refresh_at" timestamp with time zone,
	"mfa_verified_at" timestamp with time zone,
	"mfa_method" varchar(50),
	"authentication_level" varchar(50),
	"session_name" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(32),
	"template_type" "template_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"content" text,
	"shared_content" text,
	"platform_variants" jsonb,
	"variables" jsonb,
	"config" jsonb,
	"platform" "platform",
	"media_ids" text[],
	"category_path" text,
	"category" varchar(100),
	"tags" text[],
	"intent_match" varchar(30),
	"language" varchar(5) DEFAULT 'en-NG' NOT NULL,
	"is_pidgin_appropriate" boolean DEFAULT false NOT NULL,
	"is_organization_wide" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"current_approval_status" "approval_request_status",
	"usage_count" integer DEFAULT 0 NOT NULL,
	"avg_csat" numeric(3, 2),
	"avg_conversion_rate" numeric(5, 4),
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tmpl_org_name" UNIQUE("organization_id","name"),
	CONSTRAINT "chk_tmpl_version" CHECK ("templates"."version" >= 1),
	CONSTRAINT "chk_tmpl_usage_count" CHECK ("templates"."usage_count" >= 0),
	CONSTRAINT "chk_tmpl_org_wide_requires_org" CHECK (NOT ("templates"."is_organization_wide" = TRUE
            AND "templates"."organization_id" IS NULL)),
	CONSTRAINT "chk_tmpl_premium_requires_system" CHECK (NOT ("templates"."is_premium" = TRUE
            AND "templates"."organization_id" IS NOT NULL)),
	CONSTRAINT "chk_tmpl_public_requires_system" CHECK (NOT ("templates"."is_public" = TRUE
            AND "templates"."organization_id" IS NOT NULL)),
	CONSTRAINT "chk_tmpl_usage_consistency" CHECK (("templates"."usage_count" = 0 AND "templates"."last_used_at" IS NULL)
      OR ("templates"."usage_count" > 0 AND "templates"."last_used_at" IS NOT NULL)),
	CONSTRAINT "chk_tmpl_approval_consistency" CHECK (("templates"."requires_approval" = FALSE
        AND "templates"."current_approval_status" IS NULL)
      OR
      ("templates"."requires_approval" = TRUE
        AND "templates"."current_approval_status" IS NOT NULL)),
	CONSTRAINT "chk_tmpl_category_path_nonempty" CHECK ("templates"."category_path" IS NULL
        OR length(trim("templates"."category_path")) > 0),
	CONSTRAINT "chk_tmpl_csat_range" CHECK ("templates"."avg_csat" IS NULL
        OR ("templates"."avg_csat" >= 0 AND "templates"."avg_csat" <= 5)),
	CONSTRAINT "chk_tmpl_csat_engagement_only" CHECK ("templates"."avg_csat" IS NULL
        OR "templates"."template_type" = 'engagement_response'),
	CONSTRAINT "chk_tmpl_conversion_range" CHECK ("templates"."avg_conversion_rate" IS NULL
        OR ("templates"."avg_conversion_rate" >= 0
            AND "templates"."avg_conversion_rate" <= 1)),
	CONSTRAINT "chk_tmpl_conversion_campaign_only" CHECK ("templates"."avg_conversion_rate" IS NULL
        OR "templates"."template_type" = 'campaign'),
	CONSTRAINT "chk_tmpl_campaign_no_content" CHECK ("templates"."template_type" <> 'campaign'
        OR "templates"."content" IS NULL),
	CONSTRAINT "chk_tmpl_shared_content_post_only" CHECK ("templates"."template_type" = 'post'
        OR "templates"."shared_content" IS NULL),
	CONSTRAINT "chk_tmpl_platform_variants_post_only" CHECK ("templates"."template_type" = 'post'
        OR "templates"."platform_variants" IS NULL),
	CONSTRAINT "chk_tmpl_intent_match_engagement_only" CHECK ("templates"."intent_match" IS NULL
        OR "templates"."template_type" = 'engagement_response'),
	CONSTRAINT "chk_tmpl_pidgin_engagement_only" CHECK ("templates"."is_pidgin_appropriate" = FALSE
        OR "templates"."template_type" = 'engagement_response')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_type" "token_type" NOT NULL,
	"selector" varchar(64),
	"hashed_validator" text,
	"status" "token_status" DEFAULT 'active' NOT NULL,
	"purpose" varchar(100) NOT NULL,
	"target_email" varchar(255),
	"target_phone" varchar(50),
	"redirect_uri" varchar(2048),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"not_before" timestamp with time zone,
	"used_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"platform" "platform",
	"user_agent" text,
	"device_id" varchar(255),
	"fingerprint" varchar(64),
	"ip_address" text,
	"deleted_by" varchar(255),
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" "revoke_reason",
	"is_active" boolean DEFAULT true NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_selector_unique" UNIQUE("selector")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"source" "user_role_source" DEFAULT 'manual' NOT NULL,
	"context_id" uuid,
	"context_type" varchar(50),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_inherited" boolean DEFAULT false NOT NULL,
	"inherited_from" uuid,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"requires_mfa" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"approval_notes" text,
	"restrictions_override" jsonb DEFAULT '[]'::jsonb,
	"assignment_history" jsonb DEFAULT '[]'::jsonb,
	"reason" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(255) NOT NULL,
	"phone" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"password" varchar(255) NOT NULL,
	"password_history" jsonb DEFAULT '[]'::jsonb,
	"username" varchar(50) NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" varchar(255),
	"two_factor_backup_codes" jsonb DEFAULT '[]'::jsonb,
	"pending_two_factor_secret" varchar(255),
	"pending_two_factor_backup_codes" jsonb,
	"pending_two_factor_expires_at" timestamp with time zone,
	"login_count" integer DEFAULT 0 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_ip" "inet",
	"last_login_country" varchar(100),
	"last_login_user_agent" varchar(500),
	"trusted_devices" jsonb DEFAULT '[]'::jsonb,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"display_name" varchar(200),
	"profile_image" text,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"locale" varchar(10) DEFAULT 'en-NG' NOT NULL,
	"settings_id" uuid,
	"status" "user_status" DEFAULT 'pending_verification' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarding_data" jsonb DEFAULT '{}'::jsonb,
	"role_id" uuid,
	"role" "role_value_type" DEFAULT 'user' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"restrictions" jsonb DEFAULT '[]'::jsonb,
	"subscriptionPlan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"subscription_status" varchar(50),
	"subscription_expires_at" timestamp with time zone,
	"profileVisibility" "profile_visibility" DEFAULT 'public' NOT NULL,
	"allow_direct_messages" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"last_password_change_at" timestamp with time zone,
	"last_email_change_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"privacy_accepted_at" timestamp with time zone,
	"marketing_consent_at" timestamp with time zone,
	"newsletter_subscribed" boolean DEFAULT false,
	"referral_source" varchar(255),
	"referral_code" varchar(50),
	"referred_by" uuid,
	"total_earnings" integer DEFAULT 0 NOT NULL,
	"security_questions" jsonb DEFAULT '{}'::jsonb,
	"ip_history" jsonb DEFAULT '[]'::jsonb,
	"user_agent_history" jsonb DEFAULT '[]'::jsonb,
	"account_locked_until" timestamp with time zone,
	"data_processing_consent" boolean DEFAULT false,
	"marketing_consent" boolean DEFAULT false,
	"consent_updated_at" timestamp with time zone,
	"cookie_consent" jsonb DEFAULT '{}'::jsonb,
	"gdpr_consent_at" timestamp with time zone,
	"themePreference" "user_theme" DEFAULT 'system' NOT NULL,
	"push_tokens" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deletion_reason" varchar(500),
	"scheduled_deletion_at" timestamp with time zone,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_rotated_from_id_api_keys_id_fk" FOREIGN KEY ("rotated_from_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_deactivated_by_users_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_reports_to_organization_members_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_permission_history" ADD CONSTRAINT "member_permission_history_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_permission_history" ADD CONSTRAINT "member_permission_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_parent_permission_id_permissions_id_fk" FOREIGN KEY ("parent_permission_id") REFERENCES "public"."permissions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_id_permission_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."permission_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permissions" ADD CONSTRAINT "permissions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_role_history" ADD CONSTRAINT "member_role_history_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_role_history" ADD CONSTRAINT "member_role_history_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_role_history" ADD CONSTRAINT "member_role_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_user_id_users_id_fk" FOREIGN KEY ("impersonated_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_user_id_users_id_fk" FOREIGN KEY ("impersonated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonation_approved_by_users_id_fk" FOREIGN KEY ("impersonation_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replaced_by_session_id_sessions_id_fk" FOREIGN KEY ("replaced_by_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_parent_session_id_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tokens" ADD CONSTRAINT "tokens_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_rule_created" ON "alert_events" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_org_created" ON "alert_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_org_module_created" ON "alert_events" USING btree ("organization_id","source_module","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_dashboard_feed" ON "alert_events" USING btree ("organization_id","is_read","severity","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_ack_queue" ON "alert_events" USING btree ("organization_id","is_acknowledged","severity","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_unread" ON "alert_events" USING btree ("organization_id","is_read","created_at") WHERE "alert_events"."is_read" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_unacknowledged" ON "alert_events" USING btree ("organization_id","created_at") WHERE "alert_events"."is_acknowledged" = FALSE
          AND "alert_events"."alert_sent" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_source" ON "alert_events" USING btree ("source_type","source_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_severity_created" ON "alert_events" USING btree ("organization_id","severity","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_crisis" ON "alert_events" USING btree ("organization_id","created_at") WHERE "alert_events"."severity" = 'crisis';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_sla_breaches" ON "alert_events" USING btree ("organization_id","breached_at") WHERE "alert_events"."breach_type" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_pending_escalation" ON "alert_events" USING btree ("created_at") WHERE "alert_events"."is_acknowledged" = FALSE
          AND "alert_events"."escalated_at" IS NULL
          AND "alert_events"."alert_sent" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ae_rule_today" ON "alert_events" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_org_module_active" ON "alert_rules" USING btree ("organization_id","source_module","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_active_condition" ON "alert_rules" USING btree ("organization_id","source_module","condition_type","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_condition_type" ON "alert_rules" USING btree ("condition_type","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_escalation" ON "alert_rules" USING btree ("organization_id","escalate_after_minutes") WHERE "alert_rules"."escalate_after_minutes" IS NOT NULL
          AND "alert_rules"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_last_triggered" ON "alert_rules" USING btree ("organization_id","last_triggered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_capped" ON "alert_rules" USING btree ("organization_id") WHERE "alert_rules"."max_alerts_per_day" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_org_time" ON "analytics_aggregates" USING btree ("organization_id","time_bucket" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_metric_time" ON "analytics_aggregates" USING btree ("metric_name","time_bucket" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_platform_time" ON "analytics_aggregates" USING btree ("organization_id","platform","time_bucket" desc) WHERE "analytics_aggregates"."platform" != '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_entity_time" ON "analytics_aggregates" USING btree ("dimension_1","dimension_2","time_bucket" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_org_granularity_time" ON "analytics_aggregates" USING btree ("organization_id","granularity","time_bucket" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_org_metric_time" ON "analytics_aggregates" USING btree ("organization_id","metric_name","time_bucket" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_incomplete" ON "analytics_aggregates" USING btree ("organization_id","last_computed_at") WHERE "analytics_aggregates"."data_complete" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aag_naira" ON "analytics_aggregates" USING btree ("organization_id","time_bucket" desc) WHERE "analytics_aggregates"."naira_value" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_org_active" ON "analytics_dashboards" USING btree ("organization_id","created_at" desc) WHERE "analytics_dashboards"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_default" ON "analytics_dashboards" USING btree ("organization_id","is_default") WHERE "analytics_dashboards"."is_default" = TRUE AND "analytics_dashboards"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_creator" ON "analytics_dashboards" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_org_updated" ON "analytics_dashboards" USING btree ("organization_id","updated_at" desc) WHERE "analytics_dashboards"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_org_time" ON "analytics_events" USING btree ("organization_id","event_timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_type_time" ON "analytics_events" USING btree ("event_type","event_timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_source_time" ON "analytics_events" USING btree ("source","event_timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_entity" ON "analytics_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_user_time" ON "analytics_events" USING btree ("user_id","event_timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_financial" ON "analytics_events" USING btree ("organization_id","event_timestamp" desc) WHERE "analytics_events"."naira_amount" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aev_created" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_org_active" ON "analytics_metrics" USING btree ("organization_id") WHERE "analytics_metrics"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_category" ON "analytics_metrics" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_system" ON "analytics_metrics" USING btree ("name") WHERE "analytics_metrics"."is_system" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_org" ON "analytics_reports" USING btree ("organization_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_scheduled_next_run" ON "analytics_reports" USING btree ("next_run_at") WHERE "analytics_reports"."is_scheduled" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_failing" ON "analytics_reports" USING btree ("organization_id","consecutive_failure_count") WHERE "analytics_reports"."consecutive_failure_count" > 2;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_white_label" ON "analytics_reports" USING btree ("organization_id") WHERE "analytics_reports"."is_white_label" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_creator" ON "analytics_reports" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ar_template" ON "analytics_reports" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_public_key_unique_idx" ON "api_keys" USING btree ("public_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_secret_hash_unique_idx" ON "api_keys" USING btree ("secret_hash") WHERE "api_keys"."secret_hash" IS NOT NULL AND "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_external_id_unique_idx" ON "api_keys" USING btree ("external_id") WHERE "api_keys"."external_id" IS NOT NULL AND "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_org_name_unique_idx" ON "api_keys" USING btree ("organization_id","name") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_org_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_team_idx" ON "api_keys" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_project_idx" ON "api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_type_idx" ON "api_keys" USING btree ("key_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_status_idx" ON "api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_env_idx" ON "api_keys" USING btree ("environment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_permission_level_idx" ON "api_keys" USING btree ("permission_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_security_level_idx" ON "api_keys" USING btree ("security_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_issued_at_idx" ON "api_keys" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_last_used_idx" ON "api_keys" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_rotation_strategy_idx" ON "api_keys" USING btree ("rotation_strategy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_next_rotation_idx" ON "api_keys" USING btree ("next_rotation_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_revocation_type_idx" ON "api_keys" USING btree ("revocation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_last_used_ip_idx" ON "api_keys" USING btree ("last_used_ip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_created_ip_idx" ON "api_keys" USING btree ("created_ip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_active_idx" ON "api_keys" USING btree ("organization_id","public_key","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_needs_rotation_idx" ON "api_keys" USING btree ("organization_id","public_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_inactive_idx" ON "api_keys" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_expired_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_high_security_idx" ON "api_keys" USING btree ("organization_id","security_level") WHERE 
        "api_keys"."security_level" IN ('high', 'critical')
        AND "api_keys"."status" = 'active'
        AND "api_keys"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_scopes_gin_idx" ON "api_keys" USING gin ("scopes") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_restrictions_gin_idx" ON "api_keys" USING gin ("restrictions") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_allowed_ips_gin_idx" ON "api_keys" USING gin ("allowed_ips") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_denied_ips_gin_idx" ON "api_keys" USING gin ("denied_ips") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_allowed_origins_gin_idx" ON "api_keys" USING gin ("allowed_origins") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_metadata_gin_idx" ON "api_keys" USING gin ("metadata") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_org_status_env_idx" ON "api_keys" USING btree ("organization_id","status","environment") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_org_type_active_idx" ON "api_keys" USING btree ("organization_id","key_type","expires_at") WHERE "api_keys"."status" = 'active' AND "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_env_active_idx" ON "api_keys" USING btree ("user_id","environment","status") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_last_used_tracking_idx" ON "api_keys" USING btree ("last_used_at","last_used_ip") WHERE "api_keys"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aph_request_created" ON "approval_history" USING btree ("approval_request_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aph_actor_action" ON "approval_history" USING btree ("actor_id","action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aph_action_created" ON "approval_history" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_current_approver_pending" ON "approval_requests" USING btree ("current_approver_id","status") WHERE "approval_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_org_status" ON "approval_requests" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_org_approver_status" ON "approval_requests" USING btree ("organization_id","current_approver_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_entity" ON "approval_requests" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_requester" ON "approval_requests" USING btree ("requester_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_requester_created" ON "approval_requests" USING btree ("organization_id","requester_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_expiry_pending" ON "approval_requests" USING btree ("expires_at") WHERE "approval_requests"."status" = 'pending'
          AND "approval_requests"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apr_completed_entity_type" ON "approval_requests" USING btree ("entity_type","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_module_created" ON "unified_audit_log" USING btree ("module","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_org_created" ON "unified_audit_log" USING btree ("organization_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_actor_created" ON "unified_audit_log" USING btree ("actor_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_action_created" ON "unified_audit_log" USING btree ("action","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_resource" ON "unified_audit_log" USING btree ("resource_type","resource_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_severity_investigation" ON "unified_audit_log" USING btree ("organization_id","severity","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_target_user_investigation" ON "unified_audit_log" USING btree ("organization_id","target_user_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_category_created" ON "unified_audit_log" USING btree ("category","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_severity_created" ON "unified_audit_log" USING btree ("severity","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_impersonation" ON "unified_audit_log" USING btree ("impersonation_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_org_module_created" ON "unified_audit_log" USING btree ("organization_id","module","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_request_id" ON "unified_audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_session_created" ON "unified_audit_log" USING btree ("session_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_chain_scan" ON "unified_audit_log" USING btree ("module","previous_checksum");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_critical" ON "unified_audit_log" USING btree ("organization_id","created_at" desc) WHERE "unified_audit_log"."severity" = 'critical';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_security" ON "unified_audit_log" USING btree ("organization_id","created_at" desc) WHERE "unified_audit_log"."module" = 'security';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ual_actor_impersonation" ON "unified_audit_log" USING btree ("organization_id","created_at" desc) WHERE "unified_audit_log"."actor_type" = 'impersonation';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_contact_created" ON "contact_interactions" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_org_created" ON "contact_interactions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_campaign" ON "contact_interactions" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_press_release" ON "contact_interactions" USING btree ("press_release_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_assignment" ON "contact_interactions" USING btree ("assignment_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_followup_due" ON "contact_interactions" USING btree ("follow_up_at") WHERE "contact_interactions"."follow_up_at" IS NOT NULL
          AND "contact_interactions"."follow_up_status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_creator_followup" ON "contact_interactions" USING btree ("created_by_id","follow_up_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_type_created" ON "contact_interactions" USING btree ("organization_id","interaction_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_outcome_created" ON "contact_interactions" USING btree ("organization_id","outcome","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_priority_status" ON "contact_interactions" USING btree ("priority","follow_up_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_org_kind_active" ON "contacts" USING btree ("organization_id","kind","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_relationship_score" ON "contacts" USING btree ("organization_id","kind","relationship_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_merged" ON "contacts" USING btree ("merged_into_id") WHERE "contacts"."merged_into_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_last_interaction" ON "contacts" USING btree ("organization_id","kind","last_interaction_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_org_kind_score" ON "contacts" USING btree ("organization_id","kind","relationship_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_org_created" ON "contacts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_export_requests_user_idx" ON "data_export_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_export_requests_expires_at_idx" ON "data_export_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_library_active" ON "media_assets" USING btree ("organization_id","asset_type","created_at" desc) WHERE "media_assets"."attached_to_type" IS NULL
          AND "media_assets"."is_deleted" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_folder" ON "media_assets" USING btree ("organization_id","folder_path") WHERE "media_assets"."attached_to_type" IS NULL
          AND "media_assets"."is_deleted" = FALSE
          AND "media_assets"."folder_path" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_library_type" ON "media_assets" USING btree ("organization_id","asset_type") WHERE "media_assets"."attached_to_type" IS NULL
          AND "media_assets"."is_deleted" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_library_name" ON "media_assets" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_recent_uploaded" ON "media_assets" USING btree ("organization_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_attached" ON "media_assets" USING btree ("attached_to_type","attached_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_pending_processing" ON "media_assets" USING btree ("organization_id","created_at") WHERE "media_assets"."processing_state" IS NOT NULL
          AND ("media_assets"."processing_state"->>'status') IN ('pending', 'scanning', 'processing');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_failed_processing" ON "media_assets" USING btree ("organization_id","created_at") WHERE ("media_assets"."processing_state"->>'status') = 'failed';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_license_expiry" ON "media_assets" USING btree ("organization_id","license_expires_at") WHERE "media_assets"."license_expires_at" IS NOT NULL
          AND "media_assets"."is_deleted" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_uploader" ON "media_assets" USING btree ("uploaded_by","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_deleted" ON "media_assets" USING btree ("organization_id","deleted_at") WHERE "media_assets"."is_deleted" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_cdn_url" ON "media_assets" USING btree ("cdn_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_storage_url" ON "media_assets" USING btree ("storage_url");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_unique_idx" ON "oauth_accounts" USING btree ("provider","provider_account_id") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_user_provider_unique_idx" ON "oauth_accounts" USING btree ("user_id","provider") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_provider_idx" ON "oauth_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_status_idx" ON "oauth_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_connection_status_idx" ON "oauth_accounts" USING btree ("connection_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_is_active_idx" ON "oauth_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_token_status_idx" ON "oauth_accounts" USING btree ("token_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_organization_id_idx" ON "oauth_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_team_id_idx" ON "oauth_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_deleted_by_idx" ON "oauth_accounts" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_last_login_ip_idx" ON "oauth_accounts" USING btree ("last_login_ip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_token_expiry_idx" ON "oauth_accounts" USING btree ("access_token_expires_at","token_status") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_refresh_token_expiry_idx" ON "oauth_accounts" USING btree ("refresh_token_expires_at","token_status") WHERE "oauth_accounts"."refresh_token_expires_at" IS NOT NULL AND "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_active_connections_idx" ON "oauth_accounts" USING btree ("user_id","status","connection_status") WHERE 
        "oauth_accounts"."status" = 'active'
        AND "oauth_accounts"."connection_status" = 'connected'
        AND "oauth_accounts"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_needs_refresh_idx" ON "oauth_accounts" USING btree ("access_token_expires_at","connection_status") WHERE 
        "oauth_accounts"."connection_status" = 'connected'
        AND "oauth_accounts"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_email_verified_idx" ON "oauth_accounts" USING btree ("provider_account_email","provider_account_email_verified") WHERE "oauth_accounts"."provider_account_email" IS NOT NULL AND "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_provider_status_idx" ON "oauth_accounts" USING btree ("user_id","provider","status") WHERE 
        "oauth_accounts"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_last_used_idx" ON "oauth_accounts" USING btree ("last_used_at","status") WHERE 
        "oauth_accounts"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_scopes_gin_idx" ON "oauth_accounts" USING gin ("scopes") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_profile_gin_idx" ON "oauth_accounts" USING gin ("profile") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_metadata_gin_idx" ON "oauth_accounts" USING gin ("metadata") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_tags_gin_idx" ON "oauth_accounts" USING gin ("tags") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_sync_settings_gin_idx" ON "oauth_accounts" USING gin ("sync_settings") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_usage_stats_gin_idx" ON "oauth_accounts" USING gin ("usage_stats") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_compliance_metadata_gin_idx" ON "oauth_accounts" USING gin ("compliance_metadata") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_granted_permissions_gin_idx" ON "oauth_accounts" USING gin ("granted_permissions") WHERE "oauth_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_org_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_role_idx" ON "organization_members" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_status_idx" ON "organization_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_is_active_idx" ON "organization_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_invited_by_idx" ON "organization_members" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_invited_email_idx" ON "organization_members" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_invited_at_idx" ON "organization_members" USING btree ("invited_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_last_active_idx" ON "organization_members" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_engagement_level_idx" ON "organization_members" USING btree ("engagement_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_is_billable_idx" ON "organization_members" USING btree ("is_billable");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_seat_type_idx" ON "organization_members" USING btree ("seat_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_reports_to_idx" ON "organization_members" USING btree ("reports_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_suspended_at_idx" ON "organization_members" USING btree ("suspended_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_suspension_ends_idx" ON "organization_members" USING btree ("suspension_ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_deleted_at_idx" ON "organization_members" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_created_at_idx" ON "organization_members" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_org_active_idx" ON "organization_members" USING btree ("organization_id","status","is_active") WHERE 
        "organization_members"."status" = 'active' 
        AND "organization_members"."is_active" = true 
        AND "organization_members"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_org_role_idx" ON "organization_members" USING btree ("organization_id","role_id","is_active") WHERE 
        "organization_members"."is_active" = true 
        AND "organization_members"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_suspension_ending_idx" ON "organization_members" USING btree ("suspension_ends_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_billable_idx" ON "organization_members" USING btree ("organization_id","is_billable","seat_type") WHERE 
        "organization_members"."is_billable" = true 
        AND "organization_members"."is_active" = true 
        AND "organization_members"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_inactive_idx" ON "organization_members" USING btree ("last_active_at","engagement_level") WHERE 
        "organization_members"."engagement_level" IN ('none', 'low')
        AND "organization_members"."is_active" = true
        AND "organization_members"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_onboarding_incomplete_idx" ON "organization_members" USING btree ("organization_id","onboarding_data","accepted_at") WHERE 
        "organization_members"."onboarding_data" IS NOT NULL 
        AND "organization_members"."status" = 'active'
        AND "organization_members"."accepted_at" IS NOT NULL
        AND "organization_members"."deleted_at" IS NULL
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_access_restrictions_gin_idx" ON "organization_members" USING gin ("access_restrictions") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_permission_overrides_gin_idx" ON "organization_members" USING gin ("permission_overrides") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_metadata_gin_idx" ON "organization_members" USING gin ("metadata") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_tags_gin_idx" ON "organization_members" USING gin ("tags") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_activity_stats_gin_idx" ON "organization_members" USING gin ("activity_stats") WHERE "organization_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique_idx" ON "organizations" USING btree ("slug") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_email_unique_idx" ON "organizations" USING btree ("email") WHERE "organizations"."email" IS NOT NULL AND "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_custom_domain_unique_idx" ON "organizations" USING btree ("custom_domain") WHERE "organizations"."custom_domain" IS NOT NULL AND "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_is_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_is_verified_idx" ON "organizations" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_type_idx" ON "organizations" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_industry_idx" ON "organizations" USING btree ("industry");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_company_size_idx" ON "organizations" USING btree ("company_size");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_owner_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_created_by_idx" ON "organizations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_parent_org_idx" ON "organizations" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_is_parent_idx" ON "organizations" USING btree ("is_parent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_last_activity_idx" ON "organizations" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_activity_score_idx" ON "organizations" USING btree ("activity_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_engagement_score_idx" ON "organizations" USING btree ("engagement_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_growth_score_idx" ON "organizations" USING btree ("growth_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_health_score_idx" ON "organizations" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_risk_level_idx" ON "organizations" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_churn_risk_idx" ON "organizations" USING btree ("churn_risk");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_customer_tier_idx" ON "organizations" USING btree ("customer_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_deleted_at_idx" ON "organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_created_at_idx" ON "organizations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_scheduled_deletion_idx" ON "organizations" USING btree ("scheduled_deletion_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_data_anonymized_idx" ON "organizations" USING btree ("data_anonymized_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_custom_domain_idx" ON "organizations" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_owner_active_idx" ON "organizations" USING btree ("owner_id","is_active","status") WHERE 
          "organizations"."is_active" = true 
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_owner_activity_idx" ON "organizations" USING btree ("owner_id","last_activity_at","is_active") WHERE 
          "organizations"."is_active" = true 
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_high_churn_risk_idx" ON "organizations" USING btree ("churn_risk","is_active") WHERE 
          "organizations"."churn_risk" >= 70 
          AND "organizations"."is_active" = true
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_recent_activity_idx" ON "organizations" USING btree ("last_activity_at","is_active") WHERE 
          "organizations"."is_active" = true 
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_agencies_with_children_idx" ON "organizations" USING btree ("is_parent","type","status","is_active") WHERE 
          "organizations"."is_parent" = true 
          AND "organizations"."type" IN ('agency')
          AND "organizations"."is_active" = true
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_industry_size_idx" ON "organizations" USING btree ("industry","company_size","is_active") WHERE 
          "organizations"."is_active" = true 
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_search_idx" ON "organizations" USING btree ("name","slug","email","website") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_high_engagement_idx" ON "organizations" USING btree ("engagement_score","is_active","last_activity_at") WHERE 
          "organizations"."engagement_score" >= 80 
          AND "organizations"."is_active" = true
          AND "organizations"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_preferences_gin_idx" ON "organizations" USING gin ("preferences") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_security_settings_gin_idx" ON "organizations" USING gin ("security_settings") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_metadata_gin_idx" ON "organizations" USING gin ("metadata") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_tags_gin_idx" ON "organizations" USING gin ("tags") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_address_gin_idx" ON "organizations" USING gin ("address") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_billing_address_gin_idx" ON "organizations" USING gin ("billing_address") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_whitelabel_gin_idx" ON "organizations" USING gin ("whitelabel") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permission_groups_code_unique_idx" ON "permission_groups" USING btree ("code") WHERE "permission_groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_category_idx" ON "permission_groups" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_type_idx" ON "permission_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_status_idx" ON "permission_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_organization_idx" ON "permission_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_created_by_idx" ON "permission_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_active_idx" ON "permission_groups" USING btree ("is_active","status","type") WHERE "permission_groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_org_active_idx" ON "permission_groups" USING btree ("organization_id","is_active","status") WHERE "permission_groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_groups_metadata_gin_idx" ON "permission_groups" USING gin ("metadata") WHERE "permission_groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_permission_history_member_idx" ON "member_permission_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_permission_history_changed_at_idx" ON "member_permission_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_permission_history_permission_idx" ON "member_permission_history" USING btree ("permission");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_string_unique_idx" ON "permissions" USING btree ("permission_string") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_resource_action_unique_idx" ON "permissions" USING btree ("resource","action","organization_id") WHERE "permissions"."organization_id" IS NOT NULL AND "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_resource_idx" ON "permissions" USING btree ("resource");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_action_idx" ON "permissions" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_type_idx" ON "permissions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_scope_idx" ON "permissions" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_status_idx" ON "permissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_group_id_idx" ON "permissions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_organization_idx" ON "permissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_created_by_idx" ON "permissions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_deprecated_at_idx" ON "permissions" USING btree ("deprecated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_parent_permission_idx" ON "permissions" USING btree ("parent_permission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_active_idx" ON "permissions" USING btree ("is_active","status") WHERE "permissions"."is_active" = true AND "permissions"."status" = 'active' AND "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_org_active_idx" ON "permissions" USING btree ("organization_id","is_active","status") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_scope_active_idx" ON "permissions" USING btree ("scope","is_active","status") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_category_scope_idx" ON "permissions" USING btree ("category","scope","is_active") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_metadata_gin_idx" ON "permissions" USING gin ("metadata") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_plan_tiers_gin_idx" ON "permissions" USING gin ("available_for_plan_tiers") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limits_expires_at_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_role_history_member_idx" ON "member_role_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_role_history_changed_at_idx" ON "member_role_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_role_history_changed_by_idx" ON "member_role_history" USING btree ("changed_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique_idx" ON "role_permissions" USING btree ("role_id","permission_id") WHERE 
          "role_permissions"."status" = 'active' 
          AND "role_permissions"."revoked_at" IS NULL 
          AND "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_assigned_by_idx" ON "role_permissions" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_revoked_by_idx" ON "role_permissions" USING btree ("revoked_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_status_idx" ON "role_permissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_priority_idx" ON "role_permissions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_source_idx" ON "role_permissions" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_template_id_idx" ON "role_permissions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_valid_from_idx" ON "role_permissions" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_valid_until_idx" ON "role_permissions" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_revoked_at_idx" ON "role_permissions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_active_idx" ON "role_permissions" USING btree ("role_id","status","allowed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_priority_active_idx" ON "role_permissions" USING btree ("role_id","priority","allowed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_expiring_idx" ON "role_permissions" USING btree ("valid_until","status") WHERE 
          "role_permissions"."valid_until" IS NOT NULL
          AND "role_permissions"."status" = 'active'
          AND "role_permissions"."revoked_at" IS NULL
          AND "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_denied_idx" ON "role_permissions" USING btree ("role_id","allowed","status") WHERE 
          "role_permissions"."allowed" = false 
          AND "role_permissions"."status" = 'active'
          AND "role_permissions"."revoked_at" IS NULL
          AND "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_allowed_idx" ON "role_permissions" USING btree ("role_id","allowed","status") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_valid_period_idx" ON "role_permissions" USING btree ("valid_from","valid_until","status") WHERE 
          "role_permissions"."status" = 'active'
          AND "role_permissions"."revoked_at" IS NULL
          AND "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_conditions_gin_idx" ON "role_permissions" USING gin ("conditions") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_abac_rules_gin_idx" ON "role_permissions" USING gin ("abac_rules") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_resource_restrictions_gin_idx" ON "role_permissions" USING gin ("resource_restrictions") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_field_restrictions_gin_idx" ON "role_permissions" USING gin ("field_restrictions") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_metadata_gin_idx" ON "role_permissions" USING gin ("metadata") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_history_gin_idx" ON "role_permissions" USING gin ("change_history") WHERE 
          "role_permissions"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_slug_unique_idx" ON "roles" USING btree ("organization_id","slug") WHERE "roles"."archived_at" IS NULL AND "roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_default_unique_idx" ON "roles" USING btree ("organization_id") WHERE 
          "roles"."is_default" = true 
          AND "roles"."archived_at" IS NULL 
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_unique_idx" ON "roles" USING btree ("code") WHERE "roles"."deleted_at" IS NULL AND "roles"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_slug_idx" ON "roles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_display_name_idx" ON "roles" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_type_idx" ON "roles" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_scope_idx" ON "roles" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_organization_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_level_idx" ON "roles" USING btree ("level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_priority_idx" ON "roles" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_status_idx" ON "roles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_min_plan_tier_idx" ON "roles" USING btree ("min_plan_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_created_by_idx" ON "roles" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_last_modified_by_idx" ON "roles" USING btree ("last_modified_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_archived_by_idx" ON "roles" USING btree ("archived_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_deleted_by_idx" ON "roles" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_archived_at_idx" ON "roles" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_deleted_at_idx" ON "roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_created_at_idx" ON "roles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_org_active_idx" ON "roles" USING btree ("organization_id","is_active","status","priority") WHERE 
          "roles"."is_active" = true 
          AND "roles"."status" = 'active' 
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_system_active_idx" ON "roles" USING btree ("is_system_role","is_active","level") WHERE 
          "roles"."is_system_role" = true 
          AND "roles"."is_active" = true 
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_assignable_idx" ON "roles" USING btree ("organization_id","is_hidden","is_active","status") WHERE 
          "roles"."is_hidden" = false 
          AND "roles"."is_active" = true 
          AND "roles"."status" = 'active'
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_by_plan_tier_idx" ON "roles" USING btree ("min_plan_tier","is_active","status") WHERE 
          "roles"."min_plan_tier" IS NOT NULL
          AND "roles"."is_active" = true 
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_default_active_idx" ON "roles" USING btree ("is_default","is_active","organization_id") WHERE 
          "roles"."is_default" = true 
          AND "roles"."is_active" = true
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_level_priority_idx" ON "roles" USING btree ("level","priority","is_active") WHERE 
          "roles"."is_active" = true 
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_search_idx" ON "roles" USING btree ("name","slug","display_name","description") WHERE 
          "roles"."archived_at" IS NULL 
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_recently_updated_idx" ON "roles" USING btree ("updated_at","organization_id","is_active") WHERE 
          "roles"."is_active" = true 
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_requires_approval_idx" ON "roles" USING btree ("requires_approval","organization_id","is_active") WHERE 
          "roles"."requires_approval" = true 
          AND "roles"."is_active" = true
          AND "roles"."archived_at" IS NULL
          AND "roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_permissions_gin_idx" ON "roles" USING gin ("permissions") WHERE 
          "roles"."deleted_at" IS NULL 
          AND "roles"."archived_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_restrictions_gin_idx" ON "roles" USING gin ("restrictions") WHERE 
          "roles"."deleted_at" IS NULL 
          AND "roles"."archived_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_metadata_gin_idx" ON "roles" USING gin ("metadata") WHERE 
          "roles"."deleted_at" IS NULL 
          AND "roles"."archived_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_stats_gin_idx" ON "roles" USING gin ("stats") WHERE 
          "roles"."deleted_at" IS NULL 
          AND "roles"."archived_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_change_history_gin_idx" ON "roles" USING gin ("change_history") WHERE 
          "roles"."deleted_at" IS NULL 
          AND "roles"."archived_at" IS NULL
        ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_unique_idx" ON "sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_external_session_id_unique_idx" ON "sessions" USING btree ("external_session_id") WHERE "sessions"."external_session_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_risk_level_idx" ON "sessions" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_is_revoked_idx" ON "sessions" USING btree ("is_revoked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_device_id_idx" ON "sessions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_ip_address_idx" ON "sessions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_client_id_idx" ON "sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_external_session_id_idx" ON "sessions" USING btree ("external_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_revoked_by_idx" ON "sessions" USING btree ("revoked_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_impersonated_user_idx" ON "sessions" USING btree ("impersonated_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_impersonated_by_user_idx" ON "sessions" USING btree ("impersonated_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_impersonation_approved_by_idx" ON "sessions" USING btree ("impersonation_approved_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_parent_session_idx" ON "sessions" USING btree ("parent_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_replaced_by_session_idx" ON "sessions" USING btree ("replaced_by_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_last_activity_idx" ON "sessions" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_last_refresh_idx" ON "sessions" USING btree ("last_refresh_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_idle_timeout_idx" ON "sessions" USING btree ("idle_timeout_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_absolute_timeout_idx" ON "sessions" USING btree ("absolute_timeout_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_risk_calculated_idx" ON "sessions" USING btree ("risk_calculated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_authentication_level_idx" ON "sessions" USING btree ("authentication_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_active_recent_idx" ON "sessions" USING btree ("user_id","status","last_activity_at" DESC) WHERE "sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_active_sessions_idx" ON "sessions" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_device_active_idx" ON "sessions" USING btree ("user_id","device_id","status") WHERE "sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_cleanup_idx" ON "sessions" USING btree ("expires_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_risk_idx" ON "sessions" USING btree ("user_id","risk_level","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_remember_idx" ON "sessions" USING btree ("user_id","remember_me","status") WHERE 
        "sessions"."remember_me" = true 
        AND "sessions"."status" = 'active'
      ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_metadata_gin_idx" ON "sessions" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_org_type_active" ON "templates" USING btree ("organization_id","template_type","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_platform" ON "templates" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_org_updated" ON "templates" USING btree ("organization_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_creator_created" ON "templates" USING btree ("organization_id","created_by_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_approval_queue" ON "templates" USING btree ("organization_id","current_approval_status","updated_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_intent_active" ON "templates" USING btree ("organization_id","intent_match") WHERE "templates"."is_active" = TRUE
          AND "templates"."template_type" = 'engagement_response'
          AND "templates"."intent_match" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_pidgin" ON "templates" USING btree ("organization_id") WHERE "templates"."is_pidgin_appropriate" = TRUE
          AND "templates"."is_active" = TRUE
          AND "templates"."template_type" = 'engagement_response';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_public_active" ON "templates" USING btree ("template_type","is_public") WHERE "templates"."is_public" = TRUE
          AND "templates"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_premium" ON "templates" USING btree ("template_type") WHERE "templates"."is_premium" = TRUE
          AND "templates"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_usage_count" ON "templates" USING btree ("organization_id","template_type","usage_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_last_used" ON "templates" USING btree ("organization_id","template_type","last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_pending_approval" ON "templates" USING btree ("organization_id") WHERE "templates"."current_approval_status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tmpl_category" ON "templates" USING btree ("organization_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tokens_selector_unique_idx" ON "tokens" USING btree ("selector") WHERE "tokens"."selector" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_user_id_idx" ON "tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_token_type_idx" ON "tokens" USING btree ("token_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_status_idx" ON "tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_purpose_idx" ON "tokens" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_expires_at_idx" ON "tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_is_revoked_idx" ON "tokens" USING btree ("is_revoked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_issued_at_idx" ON "tokens" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_used_at_idx" ON "tokens" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_platform_idx" ON "tokens" USING btree ("platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_device_id_idx" ON "tokens" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_active_user_tokens_idx" ON "tokens" USING btree ("user_id","token_type","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_purpose_type_idx" ON "tokens" USING btree ("purpose","token_type","expires_at") WHERE 
      "tokens"."is_revoked" = false
      AND "tokens"."status" = 'active'
    ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_cleanup_idx" ON "tokens" USING btree ("expires_at","is_revoked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_otp_validation_idx" ON "tokens" USING btree ("selector","expires_at") WHERE 
      "tokens"."token_type" IN ('otp', 'magic_link')
      AND "tokens"."is_revoked" = false
      AND "tokens"."status" = 'active'
    ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_unique_idx" ON "user_roles" USING btree ("user_id","role_id","context_id","context_type") WHERE 
          "user_roles"."status" = 'active' 
          AND "user_roles"."revoked_at" IS NULL 
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_primary_unique_idx" ON "user_roles" USING btree ("user_id") WHERE 
          "user_roles"."is_primary" = true 
          AND "user_roles"."status" = 'active'
          AND "user_roles"."revoked_at" IS NULL
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_assigned_by_idx" ON "user_roles" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_approved_by_idx" ON "user_roles" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_revoked_by_idx" ON "user_roles" USING btree ("revoked_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_context_idx" ON "user_roles" USING btree ("context_id","context_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_status_idx" ON "user_roles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_source_idx" ON "user_roles" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_valid_from_idx" ON "user_roles" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_valid_until_idx" ON "user_roles" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_revoked_at_idx" ON "user_roles" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_active_idx" ON "user_roles" USING btree ("user_id","role_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_primary_active_idx" ON "user_roles" USING btree ("user_id","is_primary","status") WHERE 
          "user_roles"."is_primary" = true 
          AND "user_roles"."status" = 'active'
          AND "user_roles"."revoked_at" IS NULL
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_context_active_idx" ON "user_roles" USING btree ("context_id","context_type","status") WHERE 
          "user_roles"."status" = 'active'
          AND "user_roles"."revoked_at" IS NULL
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_expiring_idx" ON "user_roles" USING btree ("valid_until","status") WHERE 
          "user_roles"."valid_until" IS NOT NULL
          AND "user_roles"."status" = 'active'
          AND "user_roles"."revoked_at" IS NULL
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_recent_idx" ON "user_roles" USING btree ("created_at","user_id") WHERE 
          "user_roles"."revoked_at" IS NULL 
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_assigned_by_active_idx" ON "user_roles" USING btree ("assigned_by","status") WHERE 
          "user_roles"."revoked_at" IS NULL 
          AND "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_status_idx" ON "user_roles" USING btree ("user_id","status","is_primary") WHERE 
          "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_restrictions_override_gin_idx" ON "user_roles" USING gin ("restrictions_override") WHERE 
          "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_metadata_gin_idx" ON "user_roles" USING gin ("metadata") WHERE 
          "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_history_gin_idx" ON "user_roles" USING gin ("assignment_history") WHERE 
          "user_roles"."deleted_at" IS NULL
        ;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique_idx" ON "users" USING btree ("username") WHERE "users"."deleted_at" IS NULL AND "users"."username" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique_idx" ON "users" USING btree ("phone") WHERE "users"."phone" IS NOT NULL AND "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique_idx" ON "users" USING btree ("referral_code") WHERE "users"."referral_code" IS NOT NULL AND "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_verified_idx" ON "users" USING btree ("email_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_active_at_idx" ON "users" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_scheduled_deletion_idx" ON "users" USING btree ("scheduled_deletion_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_organization_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_login_ip_idx" ON "users" USING btree ("last_login_ip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_subscription_plan_idx" ON "users" USING btree ("subscriptionPlan");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_subscription_status_idx" ON "users" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_subscription_expires_idx" ON "users" USING btree ("subscription_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_status_active_idx" ON "users" USING btree ("status","deleted_at") WHERE "users"."status" = 'active' AND "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_org_status_deleted_idx" ON "users" USING btree ("organization_id","status","deleted_at") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_org_idx" ON "users" USING btree ("role_id","organization_id","deleted_at") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_login_tracking_idx" ON "users" USING btree ("last_login_at","last_login_ip") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_metadata_gin_idx" ON "users" USING gin ("metadata") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_permissions_gin_idx" ON "users" USING gin ("permissions") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_trusted_devices_gin_idx" ON "users" USING gin ("trusted_devices") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_restrictions_gin_idx" ON "users" USING gin ("restrictions") WHERE "users"."deleted_at" IS NULL;