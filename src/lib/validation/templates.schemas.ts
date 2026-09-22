import { z } from "zod";

export const TEMPLATE_TYPES = [
  "post",
  "engagement_response",
  "press_release",
  "campaign",
  "email",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const PLATFORMS = [
  "twitter_x",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TEMPLATE_ID_PATTERN = /^tmpl_[0-9a-zA-Z_-]{8,50}$/;

export const templateIdSchema = z.object({
  id: z.string().trim().regex(TEMPLATE_ID_PATTERN, "Invalid template ID; must match tmpl_<chars>"),
});

export const templateVariableSchema = z.object({
  name: z.string().trim().min(1, "Variable name is required").max(100),
  type: z.enum(["text", "number", "date", "url", "select"]).default("text"),
  label: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  defaultValue: z.string().max(1000).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().max(200)).optional(),
});

export const createTemplateSchema = z
  .object({
    templateType: z.enum(TEMPLATE_TYPES),
    name: z.string().trim().min(1, "Name is required").max(200),
    description: z.string().trim().max(2000).optional(),
    content: z.string().max(50000).nullable().optional(),
    sharedContent: z.string().max(50000).nullable().optional(),
    platformVariants: z.record(z.string(), z.unknown()).nullable().optional(),
    variables: z.array(templateVariableSchema).nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    platform: z.enum(PLATFORMS).nullable().optional(),
    mediaIds: z.array(z.string().trim().max(64)).optional(),
    categoryPath: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    intentMatch: z.string().trim().max(30).nullable().optional(),
    language: z.string().trim().min(2).max(10).default("en-NG"),
    isPidginAppropriate: z.boolean().default(false),
    isOrganizationWide: z.boolean().default(true),
    isPublic: z.boolean().default(false),
    isPremium: z.boolean().default(false),
    requiresApproval: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.templateType === "campaign" && val.content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Campaign templates cannot have content (campaigns use config scaffolds)",
        path: ["content"],
      });
    }
    if (val.templateType !== "post" && val.sharedContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sharedContent is only allowed for post templates",
        path: ["sharedContent"],
      });
    }
    if (val.templateType !== "post" && val.platformVariants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "platformVariants is only allowed for post templates",
        path: ["platformVariants"],
      });
    }
    if (val.templateType !== "engagement_response" && val.intentMatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "intentMatch is only allowed for engagement_response templates",
        path: ["intentMatch"],
      });
    }
    if (val.templateType !== "engagement_response" && val.isPidginAppropriate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "isPidginAppropriate is only allowed for engagement_response templates",
        path: ["isPidginAppropriate"],
      });
    }
  });

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    content: z.string().max(50000).nullable().optional(),
    sharedContent: z.string().max(50000).nullable().optional(),
    platformVariants: z.record(z.string(), z.unknown()).nullable().optional(),
    variables: z.array(templateVariableSchema).nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    platform: z.enum(PLATFORMS).nullable().optional(),
    mediaIds: z.array(z.string().trim().max(64)).optional(),
    categoryPath: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    intentMatch: z.string().trim().max(30).nullable().optional(),
    language: z.string().trim().min(2).max(10).optional(),
    isPidginAppropriate: z.boolean().optional(),
    isOrganizationWide: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    version: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.categoryPath !== undefined && val.categoryPath !== null) {
      if (val.categoryPath.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "categoryPath cannot be empty or whitespace",
          path: ["categoryPath"],
        });
      }
    }
  });

export const listTemplatesQuerySchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES).optional(),
  platform: z.enum(PLATFORMS).optional(),
  category: z.string().trim().optional(),
  categoryPath: z.string().trim().optional(),
  intentMatch: z.string().trim().optional(),
  isPidginAppropriate: z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional()),
  tag: z.string().trim().optional(),
  q: z.string().trim().optional(),
  visibility: z.enum(["all", "organization", "mine", "system"]).default("all"),
  approvalStatus: z.enum(["all", "pending", "approved", "rejected"]).optional(),
  isActive: z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().default(true)),
  sort: z.enum(["newest", "most_used", "recently_used", "name"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const recordUsageSchema = z.object({
  csat: z.number().min(0).max(5).optional(),
  conversionRate: z.number().min(0).max(1).optional(),
});

export const renderTemplateSchema = z.object({
  variables: z.record(z.string(), z.union([z.string(), z.number()])),
  platform: z.enum(PLATFORMS).optional(),
});

export const approveTemplateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});
