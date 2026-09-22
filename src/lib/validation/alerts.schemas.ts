import { z } from "zod";

export const ALERT_RULE_SOURCES = [
  "listening",
  "monitoring",
  "analytics",
  "engagement",
  "system",
  "crisis",
  "commerce",
  "pr",
  "campaign",
] as const;
export type AlertRuleSource = (typeof ALERT_RULE_SOURCES)[number];

export const ALERT_CONDITION_TYPES = [
  "threshold",
  "anomaly",
  "trend",
  "comparison",
  "keyword_match",
  "volume_spike",
  "sentiment_crash",
  "condition_type",
  "sentiment_drop",
] as const;
export type AlertConditionType = (typeof ALERT_CONDITION_TYPES)[number];

export const ALERT_SEVERITIES = ["info", "warning", "critical", "crisis"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_AUDIENCES = ["internal", "participant"] as const;
export type AlertAudience = (typeof ALERT_AUDIENCES)[number];

export const ALERT_RECIPIENT_MODES = ["fixed", "triggering_entity"] as const;
export type AlertRecipientMode = (typeof ALERT_RECIPIENT_MODES)[number];

export const ALERT_FREQUENCIES = ["realtime", "hourly", "daily", "weekly", "monthly"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_CHANNELS = ["in_app", "email", "slack", "sms", "webhook"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALERT_RULE_ID_PATTERN = /^ar_[0-9a-zA-Z_-]{8,50}$/;
export const ALERT_EVENT_ID_PATTERN = /^ae_[0-9a-zA-Z_-]{8,50}$/;

export const recipientSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user"),
    id: z.string().trim().min(1, "User ID is required"),
  }),
  z.object({
    type: z.literal("email"),
    address: z.string().trim().email("Invalid email address"),
  }),
  z.object({
    type: z.literal("role"),
    role: z.string().trim().min(1, "Role is required"),
  }),
  z.object({
    type: z.literal("team"),
    id: z.string().trim().min(1, "Team ID is required"),
  }),
]);
export type RecipientInput = z.infer<typeof recipientSchema>;

export const notificationChannelConfigSchema = z.object({
  channel: z.enum(ALERT_CHANNELS),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});
export type NotificationChannelConfig = z.infer<typeof notificationChannelConfigSchema>;

// ── Alert Rule Schemas ───────────────────────────────────────────────────────

export const alertRuleIdSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(ALERT_RULE_ID_PATTERN, "Invalid alert rule ID; must match ar_<chars>"),
});

export const alertEventIdSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(ALERT_EVENT_ID_PATTERN, "Invalid alert event ID; must match ae_<chars>"),
});

export const createAlertRuleSchema = z
  .object({
    sourceModule: z.enum(ALERT_RULE_SOURCES),
    conditionType: z.enum(ALERT_CONDITION_TYPES),
    name: z.string().trim().min(1, "Name is required").max(100),
    description: z.string().trim().max(2000).nullable().optional(),
    condition: z.record(z.string(), z.unknown()).default({}),
    watchedEntityIds: z.array(z.string().trim()).optional(),
    audience: z.enum(ALERT_AUDIENCES).default("internal"),
    recipientMode: z.enum(ALERT_RECIPIENT_MODES).default("fixed"),
    threshold: z.coerce.number().nullable().optional(),
    scopeIds: z.array(z.string().trim()).nullable().optional(),
    defaultSeverity: z.enum(ALERT_SEVERITIES).default("warning"),
    frequency: z.enum(ALERT_FREQUENCIES).default("realtime"),
    notificationChannels: z
      .array(notificationChannelConfigSchema)
      .default([{ channel: "in_app", config: {} }]),
    recipients: z.array(recipientSchema).default([]),
    quietHoursEnabled: z.boolean().default(false),
    quietHoursStart: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format must be HH:MM")
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format must be HH:MM")
      .nullable()
      .optional(),
    timezone: z.string().trim().default("Africa/Lagos"),
    cooldownMinutes: z.number().int().min(1).default(60),
    maxAlertsPerDay: z.number().int().min(1).nullable().optional(),
    escalateAfterMinutes: z.number().int().min(1).nullable().optional(),
    escalationRecipients: z.array(recipientSchema).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.threshold !== null && data.threshold !== undefined) {
        return data.conditionType === "threshold";
      }
      return true;
    },
    {
      message: "threshold can only be set when conditionType is 'threshold'",
      path: ["threshold"],
    },
  )
  .refine(
    (data) => {
      if (data.sourceModule === "engagement" && data.quietHoursEnabled) {
        return false;
      }
      return true;
    },
    {
      message: "Engagement SLA rules cannot enable quiet hours",
      path: ["quietHoursEnabled"],
    },
  )
  .refine(
    (data) => {
      if (data.sourceModule === "system" && data.scopeIds && data.scopeIds.length > 0) {
        return false;
      }
      return true;
    },
    {
      message: "System rules must not specify scopeIds",
      path: ["scopeIds"],
    },
  )
  .refine(
    (data) => {
      if (data.quietHoursEnabled) {
        return Boolean(data.quietHoursStart) && Boolean(data.quietHoursEnd);
      }
      return true;
    },
    {
      message: "quietHoursStart and quietHoursEnd are required when quiet hours are enabled",
      path: ["quietHoursStart"],
    },
  );

export const updateAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  watchedEntityIds: z.array(z.string().trim()).optional(),
  audience: z.enum(ALERT_AUDIENCES).optional(),
  recipientMode: z.enum(ALERT_RECIPIENT_MODES).optional(),
  threshold: z.coerce.number().nullable().optional(),
  scopeIds: z.array(z.string().trim()).nullable().optional(),
  defaultSeverity: z.enum(ALERT_SEVERITIES).optional(),
  frequency: z.enum(ALERT_FREQUENCIES).optional(),
  notificationChannels: z.array(notificationChannelConfigSchema).optional(),
  recipients: z.array(recipientSchema).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format must be HH:MM")
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format must be HH:MM")
    .nullable()
    .optional(),
  timezone: z.string().trim().optional(),
  cooldownMinutes: z.number().int().min(1).optional(),
  maxAlertsPerDay: z.number().int().min(1).nullable().optional(),
  escalateAfterMinutes: z.number().int().min(1).nullable().optional(),
  escalationRecipients: z.array(recipientSchema).nullable().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive().optional(),
});

export const listAlertRulesQuerySchema = z.object({
  sourceModule: z.enum(ALERT_RULE_SOURCES).optional(),
  conditionType: z.enum(ALERT_CONDITION_TYPES).optional(),
  isActive: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().optional(),
});

// ── Alert Event / Fire Notification Schemas ──────────────────────────────────

export const fireAlertSchema = z.object({
  ruleId: z
    .string()
    .trim()
    .regex(ALERT_RULE_ID_PATTERN, "Invalid alert rule ID")
    .nullable()
    .optional(),
  alertType: z.string().trim().min(1, "Alert type is required").max(50),
  severity: z.enum(ALERT_SEVERITIES).default("warning"),
  sourceModule: z.enum(ALERT_RULE_SOURCES),
  sourceType: z.string().trim().min(1, "Source type is required").max(50),
  sourceId: z.string().trim().max(64).nullable().optional(),
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
  breachType: z.string().trim().max(30).nullable().optional(),
  slaStartedAt: z.coerce.date().nullable().optional(),
  breachedAt: z.coerce.date().nullable().optional(),
  minutesOverdue: z.number().int().min(0).nullable().optional(),
  estimatedNairaImpact: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().trim().max(3).default("NGN"),
  // Optional override of recipients and channels if not firing through an existing rule
  recipients: z.array(recipientSchema).optional(),
  notificationChannels: z.array(notificationChannelConfigSchema).optional(),
});

export const listAlertEventsQuerySchema = z.object({
  ruleId: z.string().trim().regex(ALERT_RULE_ID_PATTERN).optional(),
  sourceModule: z.enum(ALERT_RULE_SOURCES).optional(),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  isRead: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  isAcknowledged: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().optional(),
});

export const acknowledgeAlertSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const escalateAlertSchema = z.object({
  escalatedToId: z.string().trim().max(64).min(1, "Escalated user ID is required"),
  notes: z.string().trim().max(2000).nullable().optional(),
});
