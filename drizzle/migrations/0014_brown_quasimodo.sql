CREATE TABLE IF NOT EXISTS "crisis_incidents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" integer NOT NULL,
	"status" "crisis_status" DEFAULT 'active' NOT NULL,
	"incident_commander_id" varchar(64),
	"incident_commander_assigned_at" timestamp with time zone,
	"origin_platform" varchar(50),
	"origin_article_id" varchar(64),
	"origin_alert_event_id" varchar(64),
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(64),
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(64),
	"time_to_acknowledge_minutes" integer,
	"time_to_resolve_minutes" integer,
	"response_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution_summary" text,
	"public_statement_issued" boolean DEFAULT false NOT NULL,
	"public_statement_url" text,
	"public_statement_issued_at" timestamp with time zone,
	"post_mortem_url" text,
	"lessons_learned" text,
	"article_count" integer DEFAULT 0 NOT NULL,
	"total_reach" bigint DEFAULT 0 NOT NULL,
	"peak_negative_sentiment" numeric(3, 2),
	"estimated_ave_impact_naira" numeric(15, 2) DEFAULT '0',
	"estimated_financial_impact_naira" numeric(15, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ci_severity_range" CHECK ("crisis_incidents"."severity" BETWEEN 1 AND 5),
	CONSTRAINT "chk_ci_acknowledged_consistency" CHECK (("crisis_incidents"."acknowledged_at" IS NULL) = ("crisis_incidents"."acknowledged_by" IS NULL)),
	CONSTRAINT "chk_ci_resolved_consistency" CHECK (("crisis_incidents"."resolved_at" IS NULL) = ("crisis_incidents"."resolved_by" IS NULL)),
	CONSTRAINT "chk_ci_acknowledged_after_detected" CHECK ("crisis_incidents"."acknowledged_at" IS NULL
        OR "crisis_incidents"."acknowledged_at" >= "crisis_incidents"."detected_at"),
	CONSTRAINT "chk_ci_resolved_after_detected" CHECK ("crisis_incidents"."resolved_at" IS NULL
        OR "crisis_incidents"."resolved_at" >= "crisis_incidents"."detected_at"),
	CONSTRAINT "chk_ci_resolved_state_requires_resolution" CHECK ("crisis_incidents"."status" NOT IN ('resolved', 'false_positive')
        OR ("crisis_incidents"."resolved_at" IS NOT NULL
            AND "crisis_incidents"."resolved_by" IS NOT NULL)),
	CONSTRAINT "chk_ci_article_count" CHECK ("crisis_incidents"."article_count" >= 0),
	CONSTRAINT "chk_ci_peak_sentiment" CHECK ("crisis_incidents"."peak_negative_sentiment" IS NULL
        OR "crisis_incidents"."peak_negative_sentiment" BETWEEN -1 AND 1),
	CONSTRAINT "chk_ci_public_statement_consistency" CHECK (("crisis_incidents"."public_statement_issued" = FALSE
          AND "crisis_incidents"."public_statement_issued_at" IS NULL
          AND "crisis_incidents"."public_statement_url" IS NULL)
        OR ("crisis_incidents"."public_statement_issued" = TRUE
          AND "crisis_incidents"."public_statement_issued_at" IS NOT NULL)),
	CONSTRAINT "chk_ci_commander_consistency" CHECK (("crisis_incidents"."incident_commander_id" IS NULL)
        = ("crisis_incidents"."incident_commander_assigned_at" IS NULL)),
	CONSTRAINT "chk_ci_acknowledged_state" CHECK ("crisis_incidents"."status" <> 'acknowledged'
        OR ("crisis_incidents"."acknowledged_at" IS NOT NULL
            AND "crisis_incidents"."acknowledged_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_articles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"monitoring_campaign_id" varchar(64),
	"source_id" varchar(64),
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_website" text,
	"source_type" "media_article_source_type",
	"media_format" varchar(30),
	"source_tier" integer,
	"source_authority_score" integer DEFAULT 0 NOT NULL,
	"author" varchar(255),
	"authors" jsonb DEFAULT '[]'::jsonb,
	"excerpt" text,
	"content" text,
	"word_count" integer,
	"reading_time_minutes" integer,
	"published_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"language" varchar(5),
	"country" varchar(2),
	"region" varchar(100),
	"city" varchar(100),
	"headline_sentiment" numeric(3, 2),
	"body_sentiment" numeric(3, 2),
	"overall_sentiment" numeric(3, 2),
	"sentiment_label" "sentiment_label",
	"sentiment_confidence" numeric(3, 2),
	"emotions" jsonb,
	"tone" jsonb,
	"impact_score" integer DEFAULT 0 NOT NULL,
	"reach_estimate" bigint DEFAULT 0 NOT NULL,
	"ave_naira" numeric(15, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"key_quotes" text[],
	"quotes" jsonb DEFAULT '[]'::jsonb,
	"topic_category" text,
	"entity_mentions" jsonb,
	"brand_mention_context" "brand_mention_context",
	"brand_mentions" jsonb DEFAULT '[]'::jsonb,
	"competitor_mentions" jsonb DEFAULT '[]'::jsonb,
	"people_mentioned" jsonb DEFAULT '[]'::jsonb,
	"organizations_mentioned" jsonb DEFAULT '[]'::jsonb,
	"locations_mentioned" jsonb DEFAULT '[]'::jsonb,
	"is_competitive" boolean DEFAULT false NOT NULL,
	"competitor_id" varchar(64),
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"original_article_id" varchar(64),
	"content_hash" varchar(64),
	"social_shares" jsonb,
	"social_metrics" jsonb DEFAULT '{}'::jsonb,
	"total_shares" integer DEFAULT 0,
	"total_engagements" integer DEFAULT 0,
	"is_breaking_news" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"is_opinion" boolean DEFAULT false NOT NULL,
	"is_satire" boolean DEFAULT false NOT NULL,
	"is_syndicated" boolean DEFAULT false NOT NULL,
	"original_source" varchar(500),
	"syndicated_from" varchar(64),
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" varchar(64),
	"last_viewed_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ma_source_tier" CHECK ("media_articles"."source_tier" IS NULL
        OR "media_articles"."source_tier" IN (1, 2, 3)),
	CONSTRAINT "chk_ma_authority_score" CHECK ("media_articles"."source_authority_score" BETWEEN 0 AND 100),
	CONSTRAINT "chk_ma_impact_score" CHECK ("media_articles"."impact_score" BETWEEN 0 AND 1000),
	CONSTRAINT "chk_ma_headline_sentiment" CHECK ("media_articles"."headline_sentiment" IS NULL
        OR "media_articles"."headline_sentiment" BETWEEN -1 AND 1),
	CONSTRAINT "chk_ma_body_sentiment" CHECK ("media_articles"."body_sentiment" IS NULL
        OR "media_articles"."body_sentiment" BETWEEN -1 AND 1),
	CONSTRAINT "chk_ma_overall_sentiment" CHECK ("media_articles"."overall_sentiment" IS NULL
        OR "media_articles"."overall_sentiment" BETWEEN -1 AND 1),
	CONSTRAINT "chk_ma_sentiment_confidence" CHECK ("media_articles"."sentiment_confidence" IS NULL
        OR "media_articles"."sentiment_confidence" BETWEEN 0 AND 1),
	CONSTRAINT "chk_ma_reach_estimate" CHECK ("media_articles"."reach_estimate" >= 0),
	CONSTRAINT "chk_ma_no_self_duplicate" CHECK ("media_articles"."original_article_id" IS NULL
        OR "media_articles"."original_article_id" <> "media_articles"."id"),
	CONSTRAINT "chk_ma_duplicate_consistency" CHECK (("media_articles"."is_duplicate" = FALSE AND "media_articles"."original_article_id" IS NULL)
        OR ("media_articles"."is_duplicate" = TRUE AND "media_articles"."original_article_id" IS NOT NULL)),
	CONSTRAINT "chk_ma_reviewed_consistency" CHECK (("media_articles"."reviewed_at" IS NULL) = ("media_articles"."reviewed_by" IS NULL)
        AND ("media_articles"."is_reviewed" = FALSE)
            = ("media_articles"."reviewed_at" IS NULL)),
	CONSTRAINT "chk_ma_word_count" CHECK ("media_articles"."word_count" IS NULL OR "media_articles"."word_count" >= 0),
	CONSTRAINT "chk_ma_reading_time" CHECK ("media_articles"."reading_time_minutes" IS NULL
        OR "media_articles"."reading_time_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring_campaigns" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"owner_id" varchar(64),
	"keywords" text[] NOT NULL,
	"boolean_expression" text,
	"query_config" jsonb DEFAULT '{}'::jsonb,
	"source_types" text[] NOT NULL,
	"languages" text[],
	"countries" text[],
	"min_authority_score" integer DEFAULT 0 NOT NULL,
	"exclude_obituaries" boolean DEFAULT true NOT NULL,
	"exclude_classifieds" boolean DEFAULT true NOT NULL,
	"platform_settings" jsonb DEFAULT '{}'::jsonb,
	"geo_scope" jsonb DEFAULT '{}'::jsonb,
	"alert_enabled" boolean DEFAULT false NOT NULL,
	"alert_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"alert_threshold" integer,
	"alert_recipients" jsonb,
	"schedule" jsonb DEFAULT '{}'::jsonb,
	"next_run_at" timestamp with time zone,
	"status" "monitoring_campaign_status" DEFAULT 'active' NOT NULL,
	"estimated_monthly_articles" integer,
	"actual_monthly_articles" integer,
	"precision_score" numeric(3, 2),
	"recall_score" numeric(3, 2),
	"noise_ratio" numeric(3, 2),
	"estimated_reach" bigint,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(20),
	"last_run_duration_ms" integer,
	"last_run_error" text,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"rate_limit" integer DEFAULT 100,
	"rate_limit_remaining" integer,
	"rate_limit_reset" timestamp with time zone,
	"total_matches" integer DEFAULT 0 NOT NULL,
	"retention_days" integer DEFAULT 90,
	"sampling_rate" numeric(3, 2) DEFAULT '1.00',
	"created_by_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_mc_keywords_not_empty" CHECK (array_length("monitoring_campaigns"."keywords", 1) > 0),
	CONSTRAINT "chk_mc_source_types_not_empty" CHECK (array_length("monitoring_campaigns"."source_types", 1) > 0),
	CONSTRAINT "chk_mc_authority_score_range" CHECK ("monitoring_campaigns"."min_authority_score" BETWEEN 0 AND 100),
	CONSTRAINT "chk_mc_precision_range" CHECK ("monitoring_campaigns"."precision_score" IS NULL
        OR "monitoring_campaigns"."precision_score" BETWEEN 0 AND 1),
	CONSTRAINT "chk_mc_recall_range" CHECK ("monitoring_campaigns"."recall_score" IS NULL
        OR "monitoring_campaigns"."recall_score" BETWEEN 0 AND 1),
	CONSTRAINT "chk_mc_noise_range" CHECK ("monitoring_campaigns"."noise_ratio" IS NULL
        OR "monitoring_campaigns"."noise_ratio" BETWEEN 0 AND 1),
	CONSTRAINT "chk_mc_total_matches" CHECK ("monitoring_campaigns"."total_matches" >= 0),
	CONSTRAINT "chk_mc_alert_threshold" CHECK ("monitoring_campaigns"."alert_threshold" IS NULL
        OR "monitoring_campaigns"."alert_threshold" > 0),
	CONSTRAINT "chk_mc_alert_threshold_required" CHECK ("monitoring_campaigns"."alert_enabled" = FALSE
        OR "monitoring_campaigns"."alert_threshold" IS NOT NULL),
	CONSTRAINT "chk_mc_last_run_error_consistency" CHECK ("monitoring_campaigns"."last_run_error" IS NULL
        OR "monitoring_campaigns"."last_run_status" IN ('failed', 'partial')),
	CONSTRAINT "chk_mc_last_run_duration_non_negative" CHECK ("monitoring_campaigns"."last_run_duration_ms" IS NULL
        OR "monitoring_campaigns"."last_run_duration_ms" >= 0),
	CONSTRAINT "chk_mc_last_run_status_values" CHECK ("monitoring_campaigns"."last_run_status" IS NULL
        OR "monitoring_campaigns"."last_run_status" IN ('success', 'failed', 'partial')),
	CONSTRAINT "chk_mc_estimated_reach" CHECK ("monitoring_campaigns"."estimated_reach" IS NULL
        OR "monitoring_campaigns"."estimated_reach" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring_competitors" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"keywords" text[] NOT NULL,
	"category" "competitor_category" DEFAULT 'direct' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"logo_url" text,
	"website" text,
	"social_profiles" jsonb,
	"share_of_voice" numeric(5, 2),
	"last_mentioned_at" timestamp with time zone,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"avg_sentiment" numeric(3, 2),
	"market_share" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_comp_keywords_not_empty" CHECK (array_length("monitoring_competitors"."keywords", 1) > 0),
	CONSTRAINT "chk_comp_mention_count" CHECK ("monitoring_competitors"."mention_count" >= 0),
	CONSTRAINT "chk_comp_sov_range" CHECK ("monitoring_competitors"."share_of_voice" IS NULL
        OR "monitoring_competitors"."share_of_voice" BETWEEN 0 AND 100),
	CONSTRAINT "chk_comp_avg_sentiment" CHECK ("monitoring_competitors"."avg_sentiment" IS NULL
        OR "monitoring_competitors"."avg_sentiment" BETWEEN -1 AND 1),
	CONSTRAINT "chk_comp_market_share_range" CHECK ("monitoring_competitors"."market_share" IS NULL
        OR "monitoring_competitors"."market_share" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_sources" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"display_name" varchar(500),
	"slug" varchar(255),
	"description" text,
	"tagline" varchar(500),
	"type" "news_source_type" NOT NULL,
	"tier" "source_tier" DEFAULT 'tier_3' NOT NULL,
	"website" text,
	"rss_feeds" jsonb DEFAULT '[]'::jsonb,
	"sitemap_url" text,
	"api_endpoint" text,
	"contact_info" jsonb DEFAULT '{}'::jsonb,
	"coverage" jsonb DEFAULT '{}'::jsonb,
	"outlet_social_handles" jsonb DEFAULT '{}'::jsonb,
	"political_leaning" "political_leaning" DEFAULT 'neutral',
	"bias_score" numeric(4, 2),
	"credibility_rating" "credibility_rating" DEFAULT 'unknown',
	"credibility_score" integer DEFAULT 50,
	"fact_check_rating" jsonb,
	"domain_authority" integer,
	"page_authority" integer,
	"trust_flow" integer,
	"citation_flow" integer,
	"monthly_visitors" integer,
	"owner" varchar(500),
	"parent_company" varchar(500),
	"founded_year" integer,
	"headquarters" varchar(255),
	"editorial_info" jsonb DEFAULT '{}'::jsonb,
	"publishing_stats" jsonb DEFAULT '{}'::jsonb,
	"status" "source_status" DEFAULT 'monitoring' NOT NULL,
	"monitoring_settings" jsonb DEFAULT '{"enabled":true,"crawlFrequency":"hourly","crawlDepth":2,"maxArticlesPerCrawl":100,"checkDuplicates":true,"similarityThreshold":0.85}'::jsonb NOT NULL,
	"last_crawl_at" timestamp with time zone,
	"next_crawl_at" timestamp with time zone,
	"crawl_count" integer DEFAULT 0 NOT NULL,
	"last_crawl_status" varchar(50),
	"last_crawl_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"technical_info" jsonb DEFAULT '{}'::jsonb,
	"robots_txt" text,
	"allows_crawling" boolean DEFAULT true NOT NULL,
	"relevance_score" integer DEFAULT 50,
	"importance_score" integer DEFAULT 50,
	"industry_relevance" jsonb DEFAULT '{}'::jsonb,
	"topic_tags" jsonb DEFAULT '[]'::jsonb,
	"expertise_areas" jsonb DEFAULT '[]'::jsonb,
	"relationship_status" varchar(50) DEFAULT 'neutral',
	"coverage_stats" jsonb DEFAULT '{}'::jsonb,
	"media_lists" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_categories" jsonb DEFAULT '[]'::jsonb,
	"is_priority" boolean DEFAULT false NOT NULL,
	"is_competitor" boolean DEFAULT false NOT NULL,
	"is_partner" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" varchar(64),
	"verification_data" jsonb DEFAULT '{}'::jsonb,
	"quality_score" integer DEFAULT 50,
	"quality_metrics" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"internal_notes" text,
	"public_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_mentions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"campaign_id" varchar(64) NOT NULL,
	"platform" "platform" NOT NULL,
	"source" "mention_source" DEFAULT 'social_media' NOT NULL,
	"platform_id" varchar(255) NOT NULL,
	"platform_url" text,
	"content_hash" varchar(64),
	"mention_type" "mention_type" DEFAULT 'mention' NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"content_snippet" varchar(500),
	"language" varchar(10) DEFAULT 'en',
	"media" jsonb DEFAULT '[]'::jsonb,
	"has_media" boolean DEFAULT false NOT NULL,
	"author_platform_id" varchar(255),
	"author_username" varchar(255),
	"author_name" varchar(255),
	"author_bio" text,
	"author_avatar_url" text,
	"author_url" text,
	"author_follower_count" integer DEFAULT 0,
	"author_following_count" integer DEFAULT 0,
	"author_post_count" integer DEFAULT 0,
	"author_engagement_rate" numeric(5, 2) DEFAULT '0',
	"author_verified" boolean DEFAULT false NOT NULL,
	"author_influence_score" integer DEFAULT 0,
	"author_tier" varchar(20),
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"save_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"total_engagement" integer DEFAULT 0,
	"engagement_rate" numeric(5, 2) DEFAULT '0',
	"estimated_reach" integer DEFAULT 0,
	"estimated_impressions" integer DEFAULT 0,
	"sentiment_label" "sentiment_label",
	"sentiment_score" numeric(5, 4),
	"sentiment_confidence" numeric(4, 3),
	"emotions" jsonb DEFAULT '{}'::jsonb,
	"tone" jsonb DEFAULT '{}'::jsonb,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"mentioned_accounts" jsonb DEFAULT '[]'::jsonb,
	"urls" jsonb DEFAULT '[]'::jsonb,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"entities" jsonb DEFAULT '[]'::jsonb,
	"brand_mentions" jsonb DEFAULT '[]'::jsonb,
	"parent_id" varchar(64),
	"thread_id" varchar(255),
	"is_reply" boolean DEFAULT false NOT NULL,
	"reply_to_username" varchar(255),
	"reply_to_platform_id" varchar(255),
	"conversation_id" varchar(255),
	"conversation_depth" integer DEFAULT 0,
	"conversation_size" integer DEFAULT 0,
	"location_name" varchar(255),
	"location_city" varchar(100),
	"location_region" varchar(100),
	"location_country" varchar(2),
	"location_latitude" numeric(10, 7),
	"location_longitude" numeric(10, 7),
	"has_location" boolean DEFAULT false NOT NULL,
	"relevance_score" numeric(5, 2) DEFAULT '0',
	"importance_score" numeric(5, 2) DEFAULT '0',
	"virality_score" numeric(5, 2) DEFAULT '0',
	"quality_score" numeric(5, 2) DEFAULT '0',
	"matched_terms" jsonb DEFAULT '[]'::jsonb,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moderation_flags" jsonb DEFAULT '[]'::jsonb,
	"spam_score" numeric(4, 3) DEFAULT '0',
	"toxicity_score" numeric(4, 3) DEFAULT '0',
	"authenticity_score" numeric(4, 3) DEFAULT '0',
	"ai_analysis" jsonb DEFAULT '{}'::jsonb,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"processed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_engagement_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crisis_incidents" ADD CONSTRAINT "crisis_incidents_origin_article_id_media_articles_id_fk" FOREIGN KEY ("origin_article_id") REFERENCES "public"."media_articles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_competitor_id_monitoring_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."monitoring_competitors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_syndicated_from_news_sources_id_fk" FOREIGN KEY ("syndicated_from") REFERENCES "public"."news_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_articles" ADD CONSTRAINT "fk_ma_monitoring_campaign" FOREIGN KEY ("monitoring_campaign_id") REFERENCES "public"."monitoring_campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_mentions" ADD CONSTRAINT "social_mentions_campaign_id_monitoring_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."monitoring_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_org_detected" ON "crisis_incidents" USING btree ("organization_id","detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_org_severity" ON "crisis_incidents" USING btree ("organization_id","severity","detected_at") WHERE "crisis_incidents"."status" NOT IN ('resolved', 'false_positive');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_org_updated" ON "crisis_incidents" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_status" ON "crisis_incidents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_active" ON "crisis_incidents" USING btree ("organization_id","severity") WHERE "crisis_incidents"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_origin_article" ON "crisis_incidents" USING btree ("origin_article_id") WHERE "crisis_incidents"."origin_article_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ci_origin_alert" ON "crisis_incidents" USING btree ("origin_alert_event_id") WHERE "crisis_incidents"."origin_alert_event_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ma_org_url" ON "media_articles" USING btree ("organization_id","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_org_published" ON "media_articles" USING btree ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_ingested" ON "media_articles" USING btree ("organization_id","ingested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_org_authority" ON "media_articles" USING btree ("organization_id","source_authority_score","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_org_impact" ON "media_articles" USING btree ("organization_id","impact_score","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_sentiment" ON "media_articles" USING btree ("organization_id","sentiment_label","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_campaign" ON "media_articles" USING btree ("monitoring_campaign_id","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_competitive" ON "media_articles" USING btree ("organization_id","is_competitive","published_at") WHERE "media_articles"."is_competitive" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_impact" ON "media_articles" USING btree ("organization_id","impact_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_hash" ON "media_articles" USING btree ("content_hash") WHERE "media_articles"."content_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_source" ON "media_articles" USING btree ("organization_id","source_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_tier" ON "media_articles" USING btree ("organization_id","source_tier","published_at") WHERE "media_articles"."source_tier" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_org_country" ON "media_articles" USING btree ("organization_id","country","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_active" ON "media_articles" USING btree ("organization_id","published_at") WHERE "media_articles"."is_archived" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_original" ON "media_articles" USING btree ("original_article_id") WHERE "media_articles"."is_duplicate" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ma_pending_review" ON "media_articles" USING btree ("organization_id","published_at") WHERE "media_articles"."is_reviewed" = FALSE
          AND "media_articles"."impact_score" >= 500
          AND "media_articles"."is_archived" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_org" ON "monitoring_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_status" ON "monitoring_campaigns" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_owner" ON "monitoring_campaigns" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_alert" ON "monitoring_campaigns" USING btree ("alert_enabled","alert_frequency") WHERE "monitoring_campaigns"."alert_enabled" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_last_run" ON "monitoring_campaigns" USING btree ("last_run_at") WHERE "monitoring_campaigns"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_last_run_failed" ON "monitoring_campaigns" USING btree ("organization_id","last_run_at") WHERE "monitoring_campaigns"."last_run_status" IN ('failed', 'partial');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_next_run" ON "monitoring_campaigns" USING btree ("status","next_run_at") WHERE "monitoring_campaigns"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_error_count" ON "monitoring_campaigns" USING btree ("organization_id","error_count") WHERE "monitoring_campaigns"."error_count" > 0;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mc_retention" ON "monitoring_campaigns" USING btree ("organization_id","retention_days") WHERE "monitoring_campaigns"."retention_days" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_org_active" ON "monitoring_competitors" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_category" ON "monitoring_competitors" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_mentions" ON "monitoring_competitors" USING btree ("organization_id","mention_count") WHERE "monitoring_competitors"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_sov" ON "monitoring_competitors" USING btree ("organization_id","share_of_voice") WHERE "monitoring_competitors"."is_active" = TRUE;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ns_slug" ON "news_sources" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ns_website" ON "news_sources" USING btree ("website") WHERE deleted_at IS NULL AND website IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_name" ON "news_sources" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_type" ON "news_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_tier" ON "news_sources" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_status" ON "news_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_credibility_rating" ON "news_sources" USING btree ("credibility_rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_credibility_score" ON "news_sources" USING btree ("credibility_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_quality_score" ON "news_sources" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_relevance_score" ON "news_sources" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_next_crawl" ON "news_sources" USING btree ("next_crawl_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_last_crawl" ON "news_sources" USING btree ("last_crawl_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_priority" ON "news_sources" USING btree ("is_priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_verified" ON "news_sources" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_competitor" ON "news_sources" USING btree ("is_competitor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_active_tier" ON "news_sources" USING btree ("status","tier","relevance_score") WHERE status = 'monitoring' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_crawl_queue" ON "news_sources" USING btree ("status","next_crawl_at","consecutive_failures");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_priority_queue" ON "news_sources" USING btree ("is_priority","credibility_score","relevance_score") WHERE is_priority = true AND status = 'monitoring' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ns_created_at" ON "news_sources" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sm_org_platform_id" ON "social_mentions" USING btree ("organization_id","platform","platform_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_campaign" ON "social_mentions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_org" ON "social_mentions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_platform" ON "social_mentions" USING btree ("platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_source" ON "social_mentions" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_content_hash" ON "social_mentions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_author_username" ON "social_mentions" USING btree ("author_username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_author_followers" ON "social_mentions" USING btree ("author_follower_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_sentiment" ON "social_mentions" USING btree ("sentiment_label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_sentiment_score" ON "social_mentions" USING btree ("sentiment_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_total_engagement" ON "social_mentions" USING btree ("total_engagement");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_engagement_rate" ON "social_mentions" USING btree ("engagement_rate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_relevance_score" ON "social_mentions" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_importance_score" ON "social_mentions" USING btree ("importance_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_virality_score" ON "social_mentions" USING btree ("virality_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_parent" ON "social_mentions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_thread" ON "social_mentions" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_processing_status" ON "social_mentions" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_published_at" ON "social_mentions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_fetched_at" ON "social_mentions" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_campaign_recent" ON "social_mentions" USING btree ("campaign_id","published_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_processing_queue" ON "social_mentions" USING btree ("processing_status","fetched_at") WHERE processing_status IN ('pending', 'failed') AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_high_priority" ON "social_mentions" USING btree ("organization_id","importance_score","published_at") WHERE importance_score > 70 AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sm_org_published" ON "social_mentions" USING btree ("organization_id","published_at") WHERE deleted_at IS NULL;