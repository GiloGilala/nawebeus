import { z } from "zod";

export const CONFIG_ID_PATTERN =
  /^(cfg|ff)_[a-zA-Z0-9_-]{16,40}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const configIdSchema = z
  .string()
  .regex(CONFIG_ID_PATTERN, "Invalid config or flag ID format");

export const CONFIG_KINDS = ["system_config", "feature_flag"] as const;
export type ConfigKind = (typeof CONFIG_KINDS)[number];
export const configKindSchema = z.enum(CONFIG_KINDS);

export const CONFIG_TYPES = [
  "security",
  "rate_limit",
  "feature_flag",
  "integration",
  "notification",
  "billing",
  "compliance",
] as const;
export type ConfigType = (typeof CONFIG_TYPES)[number];
export const configTypeSchema = z.enum(CONFIG_TYPES);

export const CONFIG_ENVIRONMENTS = ["development", "staging", "production", "sandbox"] as const;
export type ConfigEnvironment = (typeof CONFIG_ENVIRONMENTS)[number];
export const configEnvironmentSchema = z.enum(CONFIG_ENVIRONMENTS);

export const TARGETING_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "in",
  "greater_than",
  "less_than",
] as const;
export type TargetingOperator = (typeof TARGETING_OPERATORS)[number];

export const targetingRuleSchema = z.object({
  attribute: z.string().min(1).max(100),
  operator: z.enum(TARGETING_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});
export type TargetingRule = z.infer<typeof targetingRuleSchema>;

export const configKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9][a-z0-9_\-.]*$/i,
    "Key must start with alphanumeric character and contain dot notation, hyphens, underscores, or alphanumeric characters",
  );

export const createAppConfigSchema = z
  .object({
    kind: configKindSchema.default("system_config"),
    key: configKeySchema,
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    value: z.any(),
    defaultValue: z.any().optional(),
    configType: configTypeSchema,
    environment: configEnvironmentSchema.default("production"),
    changeReason: z
      .string()
      .min(10, "Change reason is mandatory and must be at least 10 characters")
      .max(500),
    organizationId: z.string().max(64).nullable().optional(),
    isEncrypted: z.boolean().default(false),
    isLocked: z.boolean().default(false),
    validationSchema: z.record(z.string(), z.any()).nullable().optional(),
    validationRules: z.record(z.string(), z.any()).nullable().optional(),
    exampleValue: z.any().optional(),
    // Feature flag specific fields
    enabled: z.boolean().default(false),
    killSwitch: z.boolean().default(false),
    rolloutPercentage: z.number().int().min(0).max(100).default(0),
    targetingRules: z.array(targetingRuleSchema).optional(),
    environments: z.array(configEnvironmentSchema).optional(),
    releaseDate: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.kind === "feature_flag" && data.configType !== "feature_flag") {
        return false;
      }
      return true;
    },
    {
      message: "Entries of kind 'feature_flag' must have configType 'feature_flag'",
      path: ["configType"],
    },
  );

export type CreateAppConfigInput = z.input<typeof createAppConfigSchema>;

export const createFeatureFlagSchema = z.object({
  key: configKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
  targetingRules: z.array(targetingRuleSchema).optional(),
  environments: z.array(configEnvironmentSchema).default(["development", "staging", "production"]),
  releaseDate: z.coerce.date().nullable().optional(),
  changeReason: z
    .string()
    .min(10, "Change reason is mandatory and must be at least 10 characters")
    .max(500),
  organizationId: z.string().max(64).nullable().optional(),
});

export type CreateFeatureFlagInput = z.input<typeof createFeatureFlagSchema>;

export const updateAppConfigSchema = z.object({
  value: z.any().optional(),
  changeReason: z
    .string()
    .min(10, "Change reason is mandatory and must be at least 10 characters")
    .max(500),
  expectedVersion: z.number().int().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  killSwitch: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  targetingRules: z.array(targetingRuleSchema).optional(),
  environments: z.array(configEnvironmentSchema).optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  isLocked: z.boolean().optional(),
  isDeprecated: z.boolean().optional(),
  deprecatedAt: z.coerce.date().nullable().optional(),
});

export type UpdateAppConfigInput = z.infer<typeof updateAppConfigSchema>;

export const rollbackAppConfigSchema = z.object({
  changeReason: z
    .string()
    .min(10, "Change reason is mandatory and must be at least 10 characters")
    .max(500),
});

export type RollbackAppConfigInput = z.infer<typeof rollbackAppConfigSchema>;

export const evaluateFlagSchema = z.object({
  key: configKeySchema,
  organizationId: z.string().max(64).nullable().optional(),
  userId: z.string().max(64).nullable().optional(),
  environment: configEnvironmentSchema.optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  fallback: z.boolean().optional(),
});

export type EvaluateFlagInput = z.infer<typeof evaluateFlagSchema>;

export const listAppConfigQuerySchema = z.object({
  kind: configKindSchema.optional(),
  environment: configEnvironmentSchema.optional(),
  configType: configTypeSchema.optional(),
  organizationId: z.string().max(64).optional(),
  includeGlobal: z.union([z.boolean(), z.string().transform((v) => v === "true")]).default(true),
  isDeprecated: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  search: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAppConfigQuery = z.infer<typeof listAppConfigQuerySchema>;
