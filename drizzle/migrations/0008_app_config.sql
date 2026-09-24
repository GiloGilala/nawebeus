CREATE TABLE IF NOT EXISTS "app_config" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64),
	"kind" "config_kind" NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(200),
	"description" text,
	"value" jsonb NOT NULL,
	"config_type" "config_type" NOT NULL,
	"environment" "config_environment" DEFAULT 'production' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"rollout_percentage" integer DEFAULT 0 NOT NULL,
	"targeting_rules" jsonb,
	"environments" jsonb,
	"release_date" timestamp with time zone,
	"default_value" jsonb NOT NULL,
	"previous_value" jsonb,
	"validation_schema" jsonb,
	"validation_rules" jsonb,
	"example_value" jsonb,
	"change_reason" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"deprecated_at" timestamp with time zone,
	"created_by" varchar(64) NOT NULL,
	"updated_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ac_org_key_env" UNIQUE("kind","organization_id","key","environment"),
	CONSTRAINT "chk_ac_version_positive" CHECK ("app_config"."version" >= 1),
	CONSTRAINT "chk_ac_deprecation_consistency" CHECK (NOT (
        "app_config"."is_deprecated" = TRUE
        AND "app_config"."deprecated_at" IS NULL
      )),
	CONSTRAINT "chk_ac_previous_differs" CHECK ("app_config"."previous_value" IS NULL
        OR "app_config"."previous_value"::text <> "app_config"."value"::text),
	CONSTRAINT "chk_ac_rollout_range" CHECK ("app_config"."rollout_percentage" >= 0
        AND "app_config"."rollout_percentage" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ac_org_key" ON "app_config" USING btree ("organization_id","key") WHERE "app_config"."kind" = 'feature_flag' AND "app_config"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ac_global_flag_key" ON "app_config" USING btree ("key") WHERE "app_config"."kind" = 'feature_flag' AND "app_config"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ac_global_config_key_env" ON "app_config" USING btree ("key","environment") WHERE "app_config"."kind" = 'system_config' AND "app_config"."organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_kind" ON "app_config" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_key_lookup" ON "app_config" USING btree ("key","organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_org" ON "app_config" USING btree ("organization_id") WHERE "app_config"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_env_category" ON "app_config" USING btree ("environment","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_type" ON "app_config" USING btree ("config_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_enabled" ON "app_config" USING btree ("enabled") WHERE "app_config"."enabled" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_kill_switch" ON "app_config" USING btree ("organization_id","key") WHERE "app_config"."kill_switch" = TRUE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ac_deprecated" ON "app_config" USING btree ("is_deprecated") WHERE "app_config"."is_deprecated" = TRUE;