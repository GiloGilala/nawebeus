import { z } from "zod";

export const MONITORING_CAMPAIGN_STATUSES = ["active", "paused", "archived"] as const;
export type MonitoringCampaignStatus = (typeof MONITORING_CAMPAIGN_STATUSES)[number];

export const MEDIA_ARTICLE_SOURCE_TYPES = [
  "newspaper",
  "blog",
  "broadcast",
  "wire",
  "magazine",
  "online",
  "social",
] as const;
export type MediaArticleSourceType = (typeof MEDIA_ARTICLE_SOURCE_TYPES)[number];

export const MONITORING_CAMPAIGN_ID_PATTERN = /^mc_[0-9a-f]{32}$/i;

const campaignNameSchema = z.string().trim().min(1, "Name is required").max(100);
const keywordsSchema = z
  .array(z.string().trim().min(1).max(200))
  .min(1, "At least one keyword is required")
  .max(100);
const sourceTypesSchema = z.array(z.enum(MEDIA_ARTICLE_SOURCE_TYPES)).min(1).max(7);
const stringFilterSchema = z.array(z.string().trim().min(1).max(100)).max(100);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const monitoringCampaignIdSchema = z.object({
  id: z.string().trim().regex(MONITORING_CAMPAIGN_ID_PATTERN, "Invalid monitoring campaign ID"),
});

export const createMonitoringCampaignSchema = z
  .object({
    name: campaignNameSchema,
    description: z.string().trim().max(2000).nullable().optional(),
    ownerId: z.string().trim().min(1).max(64).nullable().optional(),
    keywords: keywordsSchema,
    booleanExpression: z.string().trim().max(4000).nullable().optional(),
    queryConfig: jsonObjectSchema.optional(),
    sourceTypes: sourceTypesSchema.default([
      "newspaper",
      "blog",
      "broadcast",
      "wire",
      "magazine",
      "online",
    ]),
    languages: stringFilterSchema.nullable().optional(),
    countries: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/),
      )
      .max(250)
      .nullable()
      .optional(),
    minAuthorityScore: z.number().int().min(0).max(100).default(0),
    excludeObituaries: z.boolean().default(true),
    excludeClassifieds: z.boolean().default(true),
    geoScope: jsonObjectSchema.optional(),
    schedule: jsonObjectSchema.optional(),
    alertEnabled: z.boolean().default(false),
    alertFrequency: z.enum(["realtime", "hourly", "daily", "weekly"]).default("daily"),
    alertThreshold: z.number().int().positive().nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.alertEnabled && input.alertThreshold == null) {
      ctx.addIssue({
        code: "custom",
        path: ["alertThreshold"],
        message: "An alert threshold is required when alerts are enabled",
      });
    }
  });
export type CreateMonitoringCampaignInput = z.input<typeof createMonitoringCampaignSchema>;

export const updateMonitoringCampaignSchema = z
  .object({
    name: campaignNameSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    ownerId: z.string().trim().min(1).max(64).nullable().optional(),
    keywords: keywordsSchema.optional(),
    booleanExpression: z.string().trim().max(4000).nullable().optional(),
    queryConfig: jsonObjectSchema.nullable().optional(),
    sourceTypes: sourceTypesSchema.optional(),
    languages: stringFilterSchema.nullable().optional(),
    countries: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/),
      )
      .max(250)
      .nullable()
      .optional(),
    minAuthorityScore: z.number().int().min(0).max(100).optional(),
    excludeObituaries: z.boolean().optional(),
    excludeClassifieds: z.boolean().optional(),
    geoScope: jsonObjectSchema.nullable().optional(),
    schedule: jsonObjectSchema.nullable().optional(),
    alertEnabled: z.boolean().optional(),
    alertFrequency: z.enum(["realtime", "hourly", "daily", "weekly"]).optional(),
    alertThreshold: z.number().int().positive().nullable().optional(),
    status: z.enum(MONITORING_CAMPAIGN_STATUSES).optional(),
  })
  .superRefine((input, ctx) => {
    if (Object.keys(input).length === 0) {
      ctx.addIssue({ code: "custom", message: "At least one field must be provided" });
    }
  });
export type UpdateMonitoringCampaignInput = z.input<typeof updateMonitoringCampaignSchema>;

export const listMonitoringCampaignsQuerySchema = z.object({
  status: z.enum(MONITORING_CAMPAIGN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
});
