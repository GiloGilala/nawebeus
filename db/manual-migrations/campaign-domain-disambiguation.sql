-- Domain disambiguation of the overloaded "Campaign" term (ADR-017).
--
-- The single term was used for three distinct concepts. Table and enum type
-- names are renamed; individual column name strings and the shared
-- `campaign_id` polymorphic pointer are intentionally kept (Option γ).
--
-- Migrations generated from `db/schema.ts` cannot capture these renames
-- because the PR and influencer modules are excluded there (aspirational),
-- so this operates directly against the target database.

-- 1. PR module: pr_campaigns -> pr_initiatives
ALTER TABLE "public"."pr_campaigns" RENAME TO "pr_initiatives";

-- 2. PR status enum: pr_campaign_status -> pr_initiative_status
ALTER TYPE "public"."pr_campaign_status" RENAME TO "pr_initiative_status";

-- 3. Influencer module: influencer_campaigns -> influencer_programs
ALTER TABLE "public"."influencer_campaigns" RENAME TO "influencer_programs";

-- 4. Influencer status enum: influencer_campaign_status -> influencer_program_status
ALTER TYPE "public"."influencer_campaign_status" RENAME TO "influencer_program_status";

-- 5. Influencer type enum: influencer_campaign_type -> influencer_program_type
ALTER TYPE "public"."influencer_campaign_type" RENAME TO "influencer_program_type";

-- Child table of the influencer module follows its program parent.
ALTER TABLE "public"."influencer_campaign_assignments" RENAME TO "influencer_program_assignments";