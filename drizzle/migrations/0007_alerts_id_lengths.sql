ALTER TABLE "alert_events" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "organization_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "rule_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "source_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "acknowledged_by_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "escalated_to_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_rules" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_rules" ALTER COLUMN "organization_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "alert_rules" ALTER COLUMN "created_by_id" SET DATA TYPE varchar(64);