CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"platform" "platform" NOT NULL,
	"return_url" text,
	"state_data" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_os_expires_after_created" CHECK ("oauth_states"."expires_at" > "oauth_states"."created_at"),
	CONSTRAINT "chk_os_used_before_expires" CHECK ("oauth_states"."used_at" IS NULL
        OR "oauth_states"."used_at" <= "oauth_states"."expires_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_account_health_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"social_account_id" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"previous_status" varchar(20),
	"error_message" text,
	"error_code" varchar(50),
	"diagnostic_data" jsonb,
	"api_latency" integer,
	"api_success" boolean,
	"http_status_code" integer,
	"endpoint" varchar(255),
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sahl_api_latency" CHECK ("social_account_health_log"."api_latency" IS NULL OR "social_account_health_log"."api_latency" >= 0),
	CONSTRAINT "chk_sahl_http_status" CHECK ("social_account_health_log"."http_status_code" IS NULL
        OR "social_account_health_log"."http_status_code" BETWEEN 100 AND 599),
	CONSTRAINT "chk_sahl_transition_differs" CHECK ("social_account_health_log"."previous_status" IS NULL
        OR "social_account_health_log"."previous_status" <> "social_account_health_log"."status"),
	CONSTRAINT "chk_sahl_error_consistency" CHECK ("social_account_health_log"."status" NOT IN ('error', 'needs_reauth')
        OR "social_account_health_log"."error_message" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_accounts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_user_id" varchar(255) NOT NULL,
	"platform_username" varchar(100) NOT NULL,
	"display_name" varchar(100),
	"profile_image_url" text,
	"account_type" "social_account_type",
	"platform_url" text,
	"bio" text,
	"verified" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0,
	"post_count" integer DEFAULT 0,
	"engagement_rate" numeric(6, 4),
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[],
	"token_last_refreshed_at" timestamp with time zone,
	"status" "social_account_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_by" varchar(64) NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"primary_manager_id" varchar(64),
	"team_ids" text[],
	"last_sync_at" timestamp with time zone,
	"last_sync_status" varchar(20),
	"sync_frequency" integer DEFAULT 300 NOT NULL,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"last_error_code" varchar(50),
	"consecutive_error_count" integer DEFAULT 0 NOT NULL,
	"circuit_breaker_open" boolean DEFAULT false NOT NULL,
	"circuit_breaker_opened_at" timestamp with time zone,
	"quota_tracking" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_status" varchar(20) DEFAULT 'healthy' NOT NULL,
	"disconnected_at" timestamp with time zone,
	"disconnected_by" varchar(64),
	"disconnection_reason" text,
	"data_retention_until" timestamp with time zone,
	"tags" text[],
	"notes" text,
	"custom_fields" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_sa_org_platform_user" UNIQUE("organization_id","platform","platform_user_id"),
	CONSTRAINT "chk_sa_version" CHECK ("social_accounts"."version" >= 1),
	CONSTRAINT "chk_sa_follower_count" CHECK ("social_accounts"."follower_count" >= 0),
	CONSTRAINT "chk_sa_following_count" CHECK ("social_accounts"."following_count" IS NULL
        OR "social_accounts"."following_count" >= 0),
	CONSTRAINT "chk_sa_post_count" CHECK ("social_accounts"."post_count" IS NULL
        OR "social_accounts"."post_count" >= 0),
	CONSTRAINT "chk_sa_consecutive_error_count" CHECK ("social_accounts"."consecutive_error_count" >= 0),
	CONSTRAINT "chk_sa_sync_frequency_min" CHECK ("social_accounts"."sync_frequency" >= 60),
	CONSTRAINT "chk_sa_engagement_rate" CHECK ("social_accounts"."engagement_rate" IS NULL
        OR "social_accounts"."engagement_rate" BETWEEN 0 AND 1),
	CONSTRAINT "chk_sa_circuit_breaker_consistency" CHECK (NOT (
        "social_accounts"."circuit_breaker_open" = TRUE
        AND "social_accounts"."circuit_breaker_opened_at" IS NULL
      )),
	CONSTRAINT "chk_sa_disconnection_consistency" CHECK (("social_accounts"."disconnected_at" IS NULL)
        = ("social_accounts"."disconnected_by" IS NULL)),
	CONSTRAINT "chk_sa_disconnected_after_connected" CHECK ("social_accounts"."disconnected_at" IS NULL
        OR "social_accounts"."disconnected_at" >= "social_accounts"."connected_at"),
	CONSTRAINT "chk_sa_retention_after_disconnect" CHECK ("social_accounts"."data_retention_until" IS NULL
        OR "social_accounts"."disconnected_at" IS NULL
        OR "social_accounts"."data_retention_until" > "social_accounts"."disconnected_at"),
	CONSTRAINT "chk_sa_status_disconnected" CHECK ("social_accounts"."status" <> 'disconnected'
        OR "social_accounts"."disconnected_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_refresh_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"social_account_id" varchar(64) NOT NULL,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"failure_code" varchar(50),
	"http_status_code" integer,
	"triggered_by" "token_refresh_trigger" NOT NULL,
	"old_token_expiry" timestamp with time zone,
	"new_token_expiry" timestamp with time zone,
	"refresh_duration" integer,
	"new_refresh_token_issued" boolean DEFAULT false NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_trl_refresh_duration" CHECK ("token_refresh_log"."refresh_duration" IS NULL
        OR "token_refresh_log"."refresh_duration" >= 0),
	CONSTRAINT "chk_trl_retry_count" CHECK ("token_refresh_log"."retry_count" >= 0),
	CONSTRAINT "chk_trl_failure_reason_required" CHECK (NOT (
        "token_refresh_log"."success" = FALSE
        AND "token_refresh_log"."failure_reason" IS NULL
      )),
	CONSTRAINT "chk_trl_http_status" CHECK ("token_refresh_log"."http_status_code" IS NULL
        OR "token_refresh_log"."http_status_code" BETWEEN 100 AND 599),
	CONSTRAINT "chk_trl_rotation_implies_success" CHECK ("token_refresh_log"."new_refresh_token_issued" = FALSE
        OR "token_refresh_log"."success" = TRUE),
	CONSTRAINT "chk_trl_new_expiry_implies_success" CHECK ("token_refresh_log"."new_token_expiry" IS NULL
        OR "token_refresh_log"."success" = TRUE)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_account_health_log" ADD CONSTRAINT "social_account_health_log_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "token_refresh_log" ADD CONSTRAINT "token_refresh_log_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_os_expires" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_os_platform" ON "oauth_states" USING btree ("platform","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_os_user" ON "oauth_states" USING btree ("user_id","created_at" desc) WHERE "oauth_states"."used_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sahl_account" ON "social_account_health_log" USING btree ("social_account_id","checked_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sahl_status" ON "social_account_health_log" USING btree ("status","checked_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sahl_transition" ON "social_account_health_log" USING btree ("social_account_id","checked_at" desc) WHERE "social_account_health_log"."previous_status" IS NOT NULL
          AND "social_account_health_log"."previous_status" <> "social_account_health_log"."status";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sahl_cleanup" ON "social_account_health_log" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sahl_latency" ON "social_account_health_log" USING btree ("api_latency","checked_at" desc) WHERE "social_account_health_log"."api_latency" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_org" ON "social_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_status" ON "social_accounts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_platform" ON "social_accounts" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_sync" ON "social_accounts" USING btree ("last_sync_at","sync_frequency") WHERE "social_accounts"."status" = 'active' AND "social_accounts"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_token_expiry" ON "social_accounts" USING btree ("token_expires_at") WHERE "social_accounts"."status" = 'active'
          AND "social_accounts"."token_expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_circuit_breaker" ON "social_accounts" USING btree ("circuit_breaker_opened_at") WHERE "social_accounts"."circuit_breaker_open" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_connected_by" ON "social_accounts" USING btree ("connected_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_manager" ON "social_accounts" USING btree ("primary_manager_id") WHERE "social_accounts"."primary_manager_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_retention" ON "social_accounts" USING btree ("data_retention_until") WHERE "social_accounts"."status" = 'disconnected'
          AND "social_accounts"."data_retention_until" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_recent_connected" ON "social_accounts" USING btree ("organization_id","connected_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sa_quota_status" ON "social_accounts" USING btree ("organization_id") WHERE "social_accounts"."quota_status" <> 'healthy';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trl_account" ON "token_refresh_log" USING btree ("social_account_id","refreshed_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trl_failures" ON "token_refresh_log" USING btree ("refreshed_at" desc) WHERE "token_refresh_log"."success" = FALSE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trl_trigger" ON "token_refresh_log" USING btree ("triggered_by","refreshed_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trl_cleanup" ON "token_refresh_log" USING btree ("refreshed_at");