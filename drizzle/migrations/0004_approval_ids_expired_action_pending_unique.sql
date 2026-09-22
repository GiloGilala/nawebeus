ALTER TYPE "public"."approval_action" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "approval_history" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_history" ALTER COLUMN "approval_request_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_history" ALTER COLUMN "actor_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "organization_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "entity_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "requester_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "current_approver_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "escalated_to_id" SET DATA TYPE varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_apr_pending_per_entity" ON "approval_requests" USING btree ("organization_id","entity_type","entity_id") WHERE "approval_requests"."status" = 'pending';