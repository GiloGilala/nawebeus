CREATE TYPE "public"."backup_restore_status" AS ENUM('pending', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_records" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64),
	"backup_type" "backup_type" NOT NULL,
	"backup_name" varchar(200),
	"status" "backup_status" NOT NULL,
	"size_bytes" bigint,
	"location" text NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"compression_type" varchar(50),
	"checksum" varchar(64),
	"checksum_algorithm" varchar(20) DEFAULT 'SHA-256',
	"included_tables" text[],
	"excluded_tables" text[],
	"backup_metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"duration_seconds" integer,
	"verified_by" varchar(100),
	"last_restore_test_at" timestamp with time zone,
	"restore_status" "backup_restore_status",
	"restore_duration_seconds" integer,
	"restore_tested_by" varchar(100),
	"error_message" text,
	"error_stack" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"triggered_by" varchar(64),
	"trigger_type" varchar(50),
	CONSTRAINT "chk_br_completed_after_started" CHECK ("backup_records"."completed_at" IS NULL
        OR "backup_records"."completed_at" >= "backup_records"."started_at"),
	CONSTRAINT "chk_br_verified_after_completed" CHECK ("backup_records"."verified_at" IS NULL
        OR ("backup_records"."completed_at" IS NOT NULL
          AND "backup_records"."verified_at" >= "backup_records"."completed_at")),
	CONSTRAINT "chk_br_retry_count_non_negative" CHECK ("backup_records"."retry_count" >= 0),
	CONSTRAINT "chk_br_error_required_on_failure" CHECK (NOT (
        "backup_records"."status" = 'failed'
        AND "backup_records"."error_message" IS NULL
      )),
	CONSTRAINT "chk_br_size_non_negative" CHECK ("backup_records"."size_bytes" IS NULL
        OR "backup_records"."size_bytes" >= 0),
	CONSTRAINT "chk_br_duration_non_negative" CHECK ("backup_records"."duration_seconds" IS NULL
        OR "backup_records"."duration_seconds" >= 0),
	CONSTRAINT "chk_br_restore_duration_non_negative" CHECK ("backup_records"."restore_duration_seconds" IS NULL
        OR "backup_records"."restore_duration_seconds" >= 0),
	CONSTRAINT "chk_br_restore_after_completed" CHECK ("backup_records"."last_restore_test_at" IS NULL
        OR ("backup_records"."completed_at" IS NOT NULL
          AND "backup_records"."last_restore_test_at" >= "backup_records"."completed_at")),
	CONSTRAINT "chk_br_checksum_length" CHECK ("backup_records"."checksum" IS NULL
        OR length("backup_records"."checksum") = 64)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_holds" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64),
	"user_id" varchar(64),
	"data_type" "legal_hold_data_type" NOT NULL,
	"priority" "legal_hold_priority" DEFAULT 'medium' NOT NULL,
	"reason" text NOT NULL,
	"legal_case_id" varchar(100),
	"legal_team_contact" varchar(255),
	"regulatory_body" varchar(100),
	"case_reference" varchar(100),
	"scope" jsonb,
	"preservation_notes" text,
	"placed_by" varchar(64) NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by" varchar(64),
	"release_reason" text,
	"status" "legal_hold_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_lh_target_required" CHECK (("legal_holds"."organization_id" IS NOT NULL)::int
        + ("legal_holds"."user_id" IS NOT NULL)::int = 1),
	CONSTRAINT "chk_lh_release_consistency" CHECK (("legal_holds"."released_at" IS NULL) = ("legal_holds"."released_by" IS NULL)),
	CONSTRAINT "chk_lh_release_reason_required" CHECK ("legal_holds"."released_at" IS NULL
        OR "legal_holds"."release_reason" IS NOT NULL),
	CONSTRAINT "chk_lh_expires_after_placed" CHECK ("legal_holds"."expires_at" IS NULL
        OR "legal_holds"."expires_at" > "legal_holds"."placed_at"),
	CONSTRAINT "chk_lh_released_after_placed" CHECK ("legal_holds"."released_at" IS NULL
        OR "legal_holds"."released_at" >= "legal_holds"."placed_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_type" ON "backup_records" USING btree ("backup_type","started_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_status" ON "backup_records" USING btree ("status","started_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_org" ON "backup_records" USING btree ("organization_id") WHERE "backup_records"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_expires" ON "backup_records" USING btree ("expires_at") WHERE "backup_records"."expires_at" IS NOT NULL
          AND "backup_records"."status" = 'completed';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_unverified" ON "backup_records" USING btree ("completed_at") WHERE "backup_records"."status" = 'completed'
          AND "backup_records"."verified_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_br_restore_due" ON "backup_records" USING btree ("last_restore_test_at" desc) WHERE "backup_records"."status" = 'completed'
          AND "backup_records"."verified_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_org" ON "legal_holds" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_user" ON "legal_holds" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_active" ON "legal_holds" USING btree ("status") WHERE "legal_holds"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_critical" ON "legal_holds" USING btree ("organization_id","priority") WHERE "legal_holds"."priority" = 'critical' AND "legal_holds"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_case" ON "legal_holds" USING btree ("legal_case_id") WHERE "legal_holds"."legal_case_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lh_expiring" ON "legal_holds" USING btree ("expires_at") WHERE "legal_holds"."status" = 'active'
          AND "legal_holds"."expires_at" IS NOT NULL;