CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"admin_user_id" varchar(64) NOT NULL,
	"target_user_id" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"ticket_id" varchar(100),
	"approved_by" varchar(64),
	"approved_at" timestamp with time zone,
	"ip_address" "inet",
	"user_agent" text,
	"started_by_device" varchar(30),
	"started_geo_location" jsonb,
	"ended_by_device" varchar(30),
	"ended_geo_location" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" "impersonation_end_reason",
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"security_notified" boolean DEFAULT false NOT NULL,
	"security_notified_at" timestamp with time zone,
	"actions_performed" integer DEFAULT 0 NOT NULL,
	"last_action_at" timestamp with time zone,
	CONSTRAINT "chk_imp_no_self_impersonation" CHECK ("impersonation_sessions"."admin_user_id" <> "impersonation_sessions"."target_user_id"),
	CONSTRAINT "chk_imp_expires_after_start" CHECK ("impersonation_sessions"."expires_at" > "impersonation_sessions"."started_at"),
	CONSTRAINT "chk_imp_end_consistency" CHECK (("impersonation_sessions"."ended_at" IS NULL) = ("impersonation_sessions"."end_reason" IS NULL)),
	CONSTRAINT "chk_imp_ended_after_start" CHECK ("impersonation_sessions"."ended_at" IS NULL
        OR "impersonation_sessions"."ended_at" >= "impersonation_sessions"."started_at"),
	CONSTRAINT "chk_imp_approval_consistency" CHECK (("impersonation_sessions"."approved_by" IS NULL) = ("impersonation_sessions"."approved_at" IS NULL)),
	CONSTRAINT "chk_imp_notification_consistency" CHECK (NOT (
        "impersonation_sessions"."security_notified" = TRUE
        AND "impersonation_sessions"."security_notified_at" IS NULL
      )),
	CONSTRAINT "chk_imp_actions_positive" CHECK ("impersonation_sessions"."actions_performed" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_admin" ON "impersonation_sessions" USING btree ("admin_user_id","started_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_target" ON "impersonation_sessions" USING btree ("target_user_id","started_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_active" ON "impersonation_sessions" USING btree ("expires_at") WHERE "impersonation_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_idle" ON "impersonation_sessions" USING btree ("last_action_at") WHERE "impersonation_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_ticket" ON "impersonation_sessions" USING btree ("ticket_id") WHERE "impersonation_sessions"."ticket_id" IS NOT NULL;