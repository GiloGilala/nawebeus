import type {
  AlertAudience,
  AlertConditionType,
  AlertFrequency,
  AlertRecipientMode,
  AlertRuleSource,
  AlertSeverity,
  NotificationChannelConfig,
  RecipientInput,
} from "@/lib/validation";

export type {
  AlertAudience,
  AlertConditionType,
  AlertFrequency,
  AlertRecipientMode,
  AlertRuleSource,
  AlertSeverity,
  NotificationChannelConfig,
  RecipientInput,
};

export interface AlertRuleRecord {
  id: string;
  organizationId: string;
  sourceModule: AlertRuleSource;
  conditionType: AlertConditionType;
  name: string;
  description: string | null;
  condition: Record<string, unknown>;
  watchedEntityIds: string[] | null;
  audience: AlertAudience;
  recipientMode: AlertRecipientMode;
  threshold: number | null;
  scopeIds: string[] | null;
  defaultSeverity: AlertSeverity;
  frequency: AlertFrequency;
  notificationChannels: NotificationChannelConfig[];
  recipients: RecipientInput[];
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  cooldownMinutes: number;
  maxAlertsPerDay: number | null;
  escalateAfterMinutes: number | null;
  escalationRecipients: RecipientInput[] | null;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  triggerCount: number;
  lastSeverity: AlertSeverity | null;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStatus {
  email?: { sent: boolean; error?: string | undefined; sentAt?: string | undefined } | undefined;
  slack?: { sent: boolean; error?: string | undefined; sentAt?: string | undefined } | undefined;
  webhook?: { sent: boolean; error?: string | undefined; sentAt?: string | undefined } | undefined;
  inApp?: { sent: boolean; error?: string | undefined; sentAt?: string | undefined } | undefined;
}

export interface AlertEventRecord {
  id: string;
  organizationId: string;
  ruleId: string | null;
  alertType: string;
  severity: AlertSeverity;
  sourceModule: AlertRuleSource;
  sourceType: string;
  sourceId: string | null;
  title: string;
  description: string | null;
  context: Record<string, unknown> | null;
  breachType: string | null;
  slaStartedAt: Date | null;
  breachedAt: Date | null;
  minutesOverdue: number | null;
  estimatedNairaImpact: number | null;
  currency: string;
  alertSent: boolean;
  alertSentAt: Date | null;
  notificationStatus: NotificationStatus;
  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedById: string | null;
  acknowledgedAt: Date | null;
  acknowledgmentNotes: string | null;
  escalatedAt: Date | null;
  escalatedToId: string | null;
  escalationNotes: string | null;
  createdAt: Date;
}

export interface CreateAlertRuleInput {
  sourceModule: AlertRuleSource;
  conditionType: AlertConditionType;
  name: string;
  description?: string | null | undefined;
  condition?: Record<string, unknown> | undefined;
  watchedEntityIds?: string[] | undefined;
  audience?: AlertAudience | undefined;
  recipientMode?: AlertRecipientMode | undefined;
  threshold?: number | null | undefined;
  scopeIds?: string[] | null | undefined;
  defaultSeverity?: AlertSeverity | undefined;
  frequency?: AlertFrequency | undefined;
  notificationChannels?: NotificationChannelConfig[] | undefined;
  recipients?: RecipientInput[] | undefined;
  quietHoursEnabled?: boolean | undefined;
  quietHoursStart?: string | null | undefined;
  quietHoursEnd?: string | null | undefined;
  timezone?: string | undefined;
  cooldownMinutes?: number | undefined;
  maxAlertsPerDay?: number | null | undefined;
  escalateAfterMinutes?: number | null | undefined;
  escalationRecipients?: RecipientInput[] | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpdateAlertRuleInput {
  name?: string | undefined;
  description?: string | null | undefined;
  condition?: Record<string, unknown> | undefined;
  watchedEntityIds?: string[] | undefined;
  audience?: AlertAudience | undefined;
  recipientMode?: AlertRecipientMode | undefined;
  threshold?: number | null | undefined;
  scopeIds?: string[] | null | undefined;
  defaultSeverity?: AlertSeverity | undefined;
  frequency?: AlertFrequency | undefined;
  notificationChannels?: NotificationChannelConfig[] | undefined;
  recipients?: RecipientInput[] | undefined;
  quietHoursEnabled?: boolean | undefined;
  quietHoursStart?: string | null | undefined;
  quietHoursEnd?: string | null | undefined;
  timezone?: string | undefined;
  cooldownMinutes?: number | undefined;
  maxAlertsPerDay?: number | null | undefined;
  escalateAfterMinutes?: number | null | undefined;
  escalationRecipients?: RecipientInput[] | null | undefined;
  isActive?: boolean | undefined;
  version?: number | undefined;
}

export interface ListAlertRulesOptions {
  orgId: string;
  sourceModule?: AlertRuleSource | undefined;
  conditionType?: AlertConditionType | undefined;
  isActive?: boolean | undefined;
  limit?: number | undefined;
  cursor?: { v: string; id: string } | null | undefined;
}

export interface FireAlertInput {
  ruleId?: string | null | undefined;
  alertType: string;
  severity?: AlertSeverity | undefined;
  sourceModule: AlertRuleSource;
  sourceType: string;
  sourceId?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  context?: Record<string, unknown> | null | undefined;
  breachType?: string | null | undefined;
  slaStartedAt?: Date | null | undefined;
  breachedAt?: Date | null | undefined;
  minutesOverdue?: number | null | undefined;
  estimatedNairaImpact?: number | null | undefined;
  currency?: string | undefined;
  recipients?: RecipientInput[] | undefined;
  notificationChannels?: NotificationChannelConfig[] | undefined;
}

export interface ListAlertEventsOptions {
  orgId: string;
  ruleId?: string | undefined;
  sourceModule?: AlertRuleSource | undefined;
  severity?: AlertSeverity | undefined;
  isRead?: boolean | undefined;
  isAcknowledged?: boolean | undefined;
  limit?: number | undefined;
  cursor?: { v: string; id: string } | null | undefined;
}
