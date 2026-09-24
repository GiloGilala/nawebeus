/**
 * Notification Engine Core Service (NWB-P1-008).
 *
 * Implements:
 * - Unified alert rule CRUD with optimistic version locking
 * - Rule rate limiting (cooldown window and 24-hour daily alert cap)
 * - Notification dispatch & alert event generation (immutable fact log)
 * - Multi-channel fan-out (in-app, email via P1-004 `emailService`, Slack/webhook metadata)
 * - Recipient resolution (user accounts, emails, organization roles)
 * - Operational triage (read tracking, unread count badge, acknowledgement, escalation)
 * - Keyset cursor pagination and multi-dimensional filtering
 * - Audit logging for all rule and alert lifecycle transitions
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  AlertRuleVersionConflictError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { buildPage, type Page } from "@/lib/pagination";
import { writeAuditLog } from "@/services/audit";
import { roles } from "../../../db/core/roles";
import { users } from "../../../db/core/users";
import { organizationMembers } from "../../../db/organization/organization-members";
import { alertEvents, alertRules } from "../../../db/shared/alerts";
import { emailService } from "../email";
import type {
  AlertConditionType,
  AlertEventRecord,
  AlertFrequency,
  AlertRecipientMode,
  AlertRuleRecord,
  AlertRuleSource,
  AlertSeverity,
  CreateAlertRuleInput,
  FireAlertInput,
  ListAlertEventsOptions,
  ListAlertRulesOptions,
  NotificationChannelConfig,
  NotificationStatus,
  RecipientInput,
  UpdateAlertRuleInput,
} from "./types";

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  return new Date(String(val));
}

function toRequiredDate(val: unknown): Date {
  if (val instanceof Date) return val;
  return new Date(String(val));
}

function mapRecordToAlertRule(row: Record<string, unknown>): AlertRuleRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId ?? row.organization_id),
    sourceModule: String(row.sourceModule ?? row.source_module) as AlertRuleSource,
    conditionType: String(row.conditionType ?? row.condition_type) as AlertConditionType,
    name: String(row.name),
    description: (row.description ?? null) as string | null,
    condition: (row.condition as Record<string, unknown>) ?? {},
    watchedEntityIds: Array.isArray(row.watchedEntityIds ?? row.watched_entity_ids)
      ? ((row.watchedEntityIds ?? row.watched_entity_ids) as string[])
      : null,
    audience: (row.audience as "internal" | "participant") ?? "internal",
    recipientMode: (row.recipientMode ?? row.recipient_mode ?? "fixed") as AlertRecipientMode,
    threshold: row.threshold !== null && row.threshold !== undefined ? Number(row.threshold) : null,
    scopeIds: Array.isArray(row.scopeIds ?? row.scope_ids)
      ? ((row.scopeIds ?? row.scope_ids) as string[])
      : null,
    defaultSeverity: (row.defaultSeverity ?? row.default_severity ?? "warning") as AlertSeverity,
    frequency: (row.frequency ?? "realtime") as AlertFrequency,
    notificationChannels: (row.notificationChannels ??
      row.notification_channels ??
      []) as NotificationChannelConfig[],
    recipients: (row.recipients ?? []) as RecipientInput[],
    quietHoursEnabled: Boolean(row.quietHoursEnabled ?? row.quiet_hours_enabled ?? false),
    quietHoursStart: (row.quietHoursStart ?? row.quiet_hours_start ?? null) as string | null,
    quietHoursEnd: (row.quietHoursEnd ?? row.quiet_hours_end ?? null) as string | null,
    timezone: String(row.timezone ?? "Africa/Lagos"),
    cooldownMinutes: Number(row.cooldownMinutes ?? row.cooldown_minutes ?? 60),
    maxAlertsPerDay:
      (row.maxAlertsPerDay ?? row.max_alerts_per_day) !== null &&
      (row.maxAlertsPerDay ?? row.max_alerts_per_day) !== undefined
        ? Number(row.maxAlertsPerDay ?? row.max_alerts_per_day)
        : null,
    escalateAfterMinutes:
      (row.escalateAfterMinutes ?? row.escalate_after_minutes) !== null &&
      (row.escalateAfterMinutes ?? row.escalate_after_minutes) !== undefined
        ? Number(row.escalateAfterMinutes ?? row.escalate_after_minutes)
        : null,
    escalationRecipients: (row.escalationRecipients ?? row.escalation_recipients ?? null) as
      | RecipientInput[]
      | null,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    lastTriggeredAt: toDate(row.lastTriggeredAt ?? row.last_triggered_at),
    triggerCount: Number(row.triggerCount ?? row.trigger_count ?? 0),
    lastSeverity: (row.lastSeverity ?? row.last_severity ?? null) as AlertSeverity | null,
    version: Number(row.version ?? 1),
    createdById: String(row.createdById ?? row.created_by_id),
    createdAt: toRequiredDate(row.createdAt ?? row.created_at),
    updatedAt: toRequiredDate(row.updatedAt ?? row.updated_at),
  };
}

function mapRecordToAlertEvent(row: Record<string, unknown>): AlertEventRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId ?? row.organization_id),
    ruleId: (row.ruleId ?? row.rule_id ?? null) as string | null,
    alertType: String(row.alertType ?? row.alert_type),
    severity: String(row.severity) as AlertSeverity,
    sourceModule: String(row.sourceModule ?? row.source_module) as AlertRuleSource,
    sourceType: String(row.sourceType ?? row.source_type),
    sourceId: (row.sourceId ?? row.source_id ?? null) as string | null,
    title: String(row.title),
    description: (row.description ?? null) as string | null,
    context: (row.context as Record<string, unknown>) ?? null,
    breachType: (row.breachType ?? row.breach_type ?? null) as string | null,
    slaStartedAt: toDate(row.slaStartedAt ?? row.sla_started_at),
    breachedAt: toDate(row.breachedAt ?? row.breached_at),
    minutesOverdue:
      (row.minutesOverdue ?? row.minutes_overdue) !== null &&
      (row.minutesOverdue ?? row.minutes_overdue) !== undefined
        ? Number(row.minutesOverdue ?? row.minutes_overdue)
        : null,
    estimatedNairaImpact:
      (row.estimatedNairaImpact ?? row.estimated_naira_impact) !== null &&
      (row.estimatedNairaImpact ?? row.estimated_naira_impact) !== undefined
        ? Number(row.estimatedNairaImpact ?? row.estimated_naira_impact)
        : null,
    currency: String(row.currency ?? "NGN"),
    alertSent: Boolean(row.alertSent ?? row.alert_sent ?? false),
    alertSentAt: toDate(row.alertSentAt ?? row.alert_sent_at),
    notificationStatus: (row.notificationStatus ??
      row.notification_status ??
      {}) as NotificationStatus,
    isRead: Boolean(row.isRead ?? row.is_read ?? false),
    isAcknowledged: Boolean(row.isAcknowledged ?? row.is_acknowledged ?? false),
    acknowledgedById: (row.acknowledgedById ?? row.acknowledged_by_id ?? null) as string | null,
    acknowledgedAt: toDate(row.acknowledgedAt ?? row.acknowledged_at),
    acknowledgmentNotes: (row.acknowledgmentNotes ?? row.acknowledgment_notes ?? null) as
      | string
      | null,
    escalatedAt: toDate(row.escalatedAt ?? row.escalated_at),
    escalatedToId: (row.escalatedToId ?? row.escalated_to_id ?? null) as string | null,
    escalationNotes: (row.escalationNotes ?? row.escalation_notes ?? null) as string | null,
    createdAt: toRequiredDate(row.createdAt ?? row.created_at),
  };
}

// ── ALERT RULE CRUD ──────────────────────────────────────────────────────────

export async function createAlertRule(
  db: Db,
  orgId: string,
  userId: string,
  input: CreateAlertRuleInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<AlertRuleRecord> {
  // Check name uniqueness per org
  const existingName = await db
    .select({ id: alertRules.id })
    .from(alertRules)
    .where(
      and(
        eq(alertRules.organizationId, orgId),
        sql`LOWER(${alertRules.name}) = LOWER(${input.name.trim()})`,
      ),
    )
    .limit(1);

  if (existingName.length > 0) {
    throw new ConflictError(
      `An alert rule named "${input.name.trim()}" already exists in this organization`,
    );
  }

  // System rules cannot specify scopeIds
  if (input.sourceModule === "system" && input.scopeIds && input.scopeIds.length > 0) {
    throw new ValidationError("System rules must not specify scopeIds");
  }

  // Engagement SLA rules cannot enable quiet hours
  if (input.sourceModule === "engagement" && input.quietHoursEnabled) {
    throw new ValidationError("Engagement SLA rules cannot enable quiet hours");
  }

  // Threshold scalar only allowed for threshold condition type
  if (
    input.threshold !== null &&
    input.threshold !== undefined &&
    input.conditionType !== "threshold"
  ) {
    throw new ValidationError("threshold can only be set when conditionType is 'threshold'");
  }

  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const id = `ar_${randomSuffix}`;
  const now = new Date();

  const insertedRows = await db
    .insert(alertRules)
    .values({
      id,
      organizationId: orgId,
      sourceModule: input.sourceModule,
      conditionType: input.conditionType,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      condition: input.condition ?? {},
      watchedEntityIds: input.watchedEntityIds ?? null,
      audience: input.audience ?? "internal",
      recipientMode: input.recipientMode ?? "fixed",
      threshold:
        input.threshold !== null && input.threshold !== undefined ? String(input.threshold) : null,
      scopeIds: input.scopeIds ?? null,
      defaultSeverity: input.defaultSeverity ?? "warning",
      frequency: input.frequency ?? "realtime",
      notificationChannels: input.notificationChannels ?? [{ channel: "in_app", config: {} }],
      recipients: input.recipients ?? [],
      quietHoursEnabled: input.quietHoursEnabled ?? false,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      timezone: input.timezone ?? "Africa/Lagos",
      cooldownMinutes: input.cooldownMinutes ?? 60,
      maxAlertsPerDay: input.maxAlertsPerDay ?? null,
      escalateAfterMinutes: input.escalateAfterMinutes ?? null,
      escalationRecipients: input.escalationRecipients ?? null,
      isActive: input.isActive ?? true,
      triggerCount: 0,
      version: 1,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to create alert rule");
  }

  const created = mapRecordToAlertRule(inserted as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.rule_created",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: created.id,
    metadata: {
      name: created.name,
      sourceModule: created.sourceModule,
      conditionType: created.conditionType,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return created;
}

export async function getAlertRuleById(
  db: Db,
  id: string,
  orgId: string,
): Promise<AlertRuleRecord> {
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, orgId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Alert rule not found");
  }

  return mapRecordToAlertRule(row as unknown as Record<string, unknown>);
}

export async function listAlertRules(
  db: Db,
  options: ListAlertRulesOptions,
): Promise<Page<AlertRuleRecord>> {
  const { orgId, sourceModule, conditionType, isActive, limit = 50, cursor } = options;

  const conditions = [eq(alertRules.organizationId, orgId)];

  if (sourceModule) {
    conditions.push(eq(alertRules.sourceModule, sourceModule));
  }
  if (conditionType) {
    conditions.push(eq(alertRules.conditionType, conditionType));
  }
  if (isActive !== undefined) {
    conditions.push(eq(alertRules.isActive, isActive));
  }

  if (cursor) {
    const cursorDate = new Date(cursor.v);
    const cond = sql`(${alertRules.createdAt} < ${cursorDate} OR (${alertRules.createdAt} = ${cursorDate} AND ${alertRules.id} < ${cursor.id}))`;
    conditions.push(cond);
  }

  const rows = await db
    .select()
    .from(alertRules)
    .where(and(...conditions))
    .orderBy(desc(alertRules.createdAt), desc(alertRules.id))
    .limit(limit + 1);

  const mapped = rows.map((r) => mapRecordToAlertRule(r as unknown as Record<string, unknown>));

  return buildPage(mapped, limit, (item) => item.createdAt.toISOString());
}

export async function updateAlertRule(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  input: UpdateAlertRuleInput,
  options: {
    expectedVersion?: number | undefined;
    actorContext?: { ip?: string | undefined; userAgent?: string | undefined } | undefined;
  } = {},
): Promise<AlertRuleRecord> {
  const existing = await getAlertRuleById(db, id, orgId);

  const { expectedVersion, actorContext = {} } = options;
  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new AlertRuleVersionConflictError();
  }

  // Check name uniqueness if changed
  if (input.name && input.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    const dup = await db
      .select({ id: alertRules.id })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.organizationId, orgId),
          sql`LOWER(${alertRules.name}) = LOWER(${input.name.trim()})`,
          sql`${alertRules.id} != ${id}`,
        ),
      )
      .limit(1);

    if (dup.length > 0) {
      throw new ConflictError(
        `An alert rule named "${input.name.trim()}" already exists in this organization`,
      );
    }
  }

  const now = new Date();
  const updateSet: Record<string, unknown> = {
    name: input.name !== undefined ? input.name.trim() : existing.name,
    description:
      input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
    condition: input.condition !== undefined ? input.condition : existing.condition,
    watchedEntityIds:
      input.watchedEntityIds !== undefined ? input.watchedEntityIds : existing.watchedEntityIds,
    audience: input.audience !== undefined ? input.audience : existing.audience,
    recipientMode: input.recipientMode !== undefined ? input.recipientMode : existing.recipientMode,
    threshold:
      input.threshold !== undefined
        ? input.threshold !== null
          ? String(input.threshold)
          : null
        : existing.threshold !== null
          ? String(existing.threshold)
          : null,
    scopeIds: input.scopeIds !== undefined ? input.scopeIds : existing.scopeIds,
    defaultSeverity:
      input.defaultSeverity !== undefined ? input.defaultSeverity : existing.defaultSeverity,
    frequency: input.frequency !== undefined ? input.frequency : existing.frequency,
    notificationChannels:
      input.notificationChannels !== undefined
        ? input.notificationChannels
        : existing.notificationChannels,
    recipients: input.recipients !== undefined ? input.recipients : existing.recipients,
    quietHoursEnabled:
      input.quietHoursEnabled !== undefined ? input.quietHoursEnabled : existing.quietHoursEnabled,
    quietHoursStart:
      input.quietHoursStart !== undefined ? input.quietHoursStart : existing.quietHoursStart,
    quietHoursEnd: input.quietHoursEnd !== undefined ? input.quietHoursEnd : existing.quietHoursEnd,
    timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
    cooldownMinutes:
      input.cooldownMinutes !== undefined ? input.cooldownMinutes : existing.cooldownMinutes,
    maxAlertsPerDay:
      input.maxAlertsPerDay !== undefined ? input.maxAlertsPerDay : existing.maxAlertsPerDay,
    escalateAfterMinutes:
      input.escalateAfterMinutes !== undefined
        ? input.escalateAfterMinutes
        : existing.escalateAfterMinutes,
    escalationRecipients:
      input.escalationRecipients !== undefined
        ? input.escalationRecipients
        : existing.escalationRecipients,
    isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
    version: existing.version + 1,
    updatedAt: now,
  };

  const updateConditions = [eq(alertRules.id, id), eq(alertRules.organizationId, orgId)];
  if (expectedVersion !== undefined) {
    updateConditions.push(eq(alertRules.version, expectedVersion));
  }

  const updatedRows = await db
    .update(alertRules)
    .set(updateSet)
    .where(and(...updateConditions))
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    if (expectedVersion !== undefined) {
      throw new AlertRuleVersionConflictError();
    }
    throw new NotFoundError("Alert rule not found");
  }

  const updated = mapRecordToAlertRule(updatedRow as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.rule_updated",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      name: updated.name,
      version: updated.version,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return updated;
}

export async function deleteAlertRule(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<{ deleted: boolean; id: string }> {
  const existing = await getAlertRuleById(db, id, orgId);

  await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, orgId)));

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.rule_deleted",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      name: existing.name,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return { deleted: true, id };
}

// ── RECIPIENT RESOLUTION ─────────────────────────────────────────────────────

async function resolveRecipientEmails(
  db: Db,
  orgId: string,
  recipients: RecipientInput[],
): Promise<string[]> {
  const emailSet = new Set<string>();

  const userIds: string[] = [];
  const rolesList: string[] = [];

  for (const r of recipients) {
    if (r.type === "email") {
      emailSet.add(r.address.toLowerCase().trim());
    } else if (r.type === "user") {
      userIds.push(r.id);
    } else if (r.type === "role") {
      rolesList.push(r.role);
    }
  }

  if (userIds.length > 0) {
    const userRows = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of userRows) {
      if (u.email) emailSet.add(u.email.toLowerCase().trim());
    }
  }

  if (rolesList.length > 0) {
    const memberRows = await db
      .select({ email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .innerJoin(roles, eq(roles.id, organizationMembers.roleId))
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.isActive, true),
          isNull(organizationMembers.deletedAt),
          inArray(roles.code, rolesList),
        ),
      );
    for (const m of memberRows) {
      if (m.email) emailSet.add(m.email.toLowerCase().trim());
    }
  }

  return Array.from(emailSet);
}

// ── NOTIFICATION DISPATCH & ALERT FIRING ──────────────────────────────────────

export interface FireAlertResult {
  event: AlertEventRecord | null;
  suppressed: boolean;
  reason?: "inactive_rule" | "cooldown" | "daily_cap_exceeded" | undefined;
}

export async function fireAlert(
  db: Db,
  orgId: string,
  input: FireAlertInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<FireAlertResult> {
  const now = new Date();
  let rule: AlertRuleRecord | null = null;

  if (input.ruleId) {
    rule = await getAlertRuleById(db, input.ruleId, orgId);

    if (!rule.isActive) {
      return { event: null, suppressed: true, reason: "inactive_rule" };
    }

    // Cooldown rate-limit check
    if (rule.lastTriggeredAt) {
      const elapsedMinutes = (now.getTime() - rule.lastTriggeredAt.getTime()) / (60 * 1000);
      if (elapsedMinutes < rule.cooldownMinutes) {
        return { event: null, suppressed: true, reason: "cooldown" };
      }
    }

    // Daily cap rate-limit check
    if (rule.maxAlertsPerDay) {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(alertEvents)
        .where(and(eq(alertEvents.ruleId, rule.id), sql`${alertEvents.createdAt} >= ${oneDayAgo}`));
      const todayCount = Number(countResult[0]?.count ?? 0);
      if (todayCount >= rule.maxAlertsPerDay) {
        return { event: null, suppressed: true, reason: "daily_cap_exceeded" };
      }
    }
  }

  const severity = input.severity ?? rule?.defaultSeverity ?? "warning";
  const notificationChannels = input.notificationChannels ??
    rule?.notificationChannels ?? [{ channel: "in_app", config: {} }];
  const recipients = input.recipients ?? rule?.recipients ?? [];

  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const eventId = `ae_${randomSuffix}`;

  // Fan out delivery status
  const notificationStatus: NotificationStatus = {};

  // In-app channel is always delivered to dashboard feed
  if (notificationChannels.some((c) => c.channel === "in_app")) {
    notificationStatus.inApp = { sent: true, sentAt: now.toISOString() };
  }

  // Email channel
  if (notificationChannels.some((c) => c.channel === "email")) {
    const emails = await resolveRecipientEmails(db, orgId, recipients);
    if (emails.length > 0) {
      const emailRes = await emailService.send({
        kind: "alert",
        to: emails,
        subject: `[${severity.toUpperCase()}] ${input.title}`,
        html: `<p><strong>${input.title}</strong></p><p>${input.description || ""}</p>`,
        context: { organizationId: orgId },
      });
      notificationStatus.email = {
        sent: emailRes.sent || emailRes.status === "queued",
        sentAt: now.toISOString(),
      };
    }
  }

  const insertedRows = await db
    .insert(alertEvents)
    .values({
      id: eventId,
      organizationId: orgId,
      ruleId: input.ruleId ?? null,
      alertType: input.alertType,
      severity,
      sourceModule: input.sourceModule,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      context: input.context ?? null,
      breachType: input.breachType ?? null,
      slaStartedAt: input.slaStartedAt ?? null,
      breachedAt: input.breachedAt ?? null,
      minutesOverdue: input.minutesOverdue ?? null,
      estimatedNairaImpact:
        input.estimatedNairaImpact !== null && input.estimatedNairaImpact !== undefined
          ? String(input.estimatedNairaImpact)
          : null,
      currency: input.currency ?? "NGN",
      alertSent: true,
      alertSentAt: now,
      notificationStatus: (notificationStatus ?? {}) as NonNullable<
        typeof alertEvents.$inferInsert.notificationStatus
      >,
      isRead: false,
      isAcknowledged: false,
      createdAt: now,
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to insert alert event");
  }

  // Update rule denormalized counters
  if (rule) {
    await db
      .update(alertRules)
      .set({
        lastTriggeredAt: now,
        triggerCount: sql`${alertRules.triggerCount} + 1`,
        lastSeverity: severity,
        updatedAt: now,
      })
      .where(and(eq(alertRules.id, rule.id), eq(alertRules.organizationId, orgId)));
  }

  const eventRecord = mapRecordToAlertEvent(inserted as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.fired",
    organizationId: orgId,
    actorId: "system",
    actorType: "system",
    resourceId: eventRecord.id,
    metadata: {
      alertType: eventRecord.alertType,
      severity: eventRecord.severity,
      sourceModule: eventRecord.sourceModule,
      ruleId: eventRecord.ruleId,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return { event: eventRecord, suppressed: false };
}

// ── ALERT EVENT OPERATIONS ───────────────────────────────────────────────────

export async function getAlertEventById(
  db: Db,
  id: string,
  orgId: string,
): Promise<AlertEventRecord> {
  const rows = await db
    .select()
    .from(alertEvents)
    .where(and(eq(alertEvents.id, id), eq(alertEvents.organizationId, orgId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Alert event not found");
  }

  return mapRecordToAlertEvent(row as unknown as Record<string, unknown>);
}

export async function listAlertEvents(
  db: Db,
  options: ListAlertEventsOptions,
): Promise<Page<AlertEventRecord>> {
  const {
    orgId,
    ruleId,
    sourceModule,
    severity,
    isRead,
    isAcknowledged,
    limit = 50,
    cursor,
  } = options;

  const conditions = [eq(alertEvents.organizationId, orgId)];

  if (ruleId) {
    conditions.push(eq(alertEvents.ruleId, ruleId));
  }
  if (sourceModule) {
    conditions.push(eq(alertEvents.sourceModule, sourceModule));
  }
  if (severity) {
    conditions.push(eq(alertEvents.severity, severity));
  }
  if (isRead !== undefined) {
    conditions.push(eq(alertEvents.isRead, isRead));
  }
  if (isAcknowledged !== undefined) {
    conditions.push(eq(alertEvents.isAcknowledged, isAcknowledged));
  }

  if (cursor) {
    const cursorDate = new Date(cursor.v);
    const cond = sql`(${alertEvents.createdAt} < ${cursorDate} OR (${alertEvents.createdAt} = ${cursorDate} AND ${alertEvents.id} < ${cursor.id}))`;
    conditions.push(cond);
  }

  const rows = await db
    .select()
    .from(alertEvents)
    .where(and(...conditions))
    .orderBy(desc(alertEvents.createdAt), desc(alertEvents.id))
    .limit(limit + 1);

  const mapped = rows.map((r) => mapRecordToAlertEvent(r as unknown as Record<string, unknown>));

  return buildPage(mapped, limit, (item) => item.createdAt.toISOString());
}

export async function getUnreadAlertCount(db: Db, orgId: string): Promise<{ unreadCount: number }> {
  const res = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alertEvents)
    .where(and(eq(alertEvents.organizationId, orgId), eq(alertEvents.isRead, false)));

  return { unreadCount: Number(res[0]?.count ?? 0) };
}

export async function markAlertAsRead(
  db: Db,
  id: string,
  orgId: string,
  isRead = true,
): Promise<AlertEventRecord> {
  const rows = await db
    .update(alertEvents)
    .set({ isRead })
    .where(and(eq(alertEvents.id, id), eq(alertEvents.organizationId, orgId)))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Alert event not found");
  }

  return mapRecordToAlertEvent(row as unknown as Record<string, unknown>);
}

export async function markAllAlertsAsRead(
  db: Db,
  orgId: string,
): Promise<{ updatedCount: number }> {
  const res = await db
    .update(alertEvents)
    .set({ isRead: true })
    .where(and(eq(alertEvents.organizationId, orgId), eq(alertEvents.isRead, false)))
    .returning({ id: alertEvents.id });

  return { updatedCount: res.length };
}

export async function acknowledgeAlert(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  notes?: string | null,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<AlertEventRecord> {
  const now = new Date();

  // Enforces chk_ae_ack_consistency: isAcknowledged=true <-> acknowledgedById & acknowledgedAt set
  const rows = await db
    .update(alertEvents)
    .set({
      isAcknowledged: true,
      acknowledgedById: userId,
      acknowledgedAt: now,
      acknowledgmentNotes: notes ?? null,
      isRead: true,
    })
    .where(and(eq(alertEvents.id, id), eq(alertEvents.organizationId, orgId)))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Alert event not found");
  }

  const acknowledged = mapRecordToAlertEvent(row as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.acknowledged",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      alertType: acknowledged.alertType,
      severity: acknowledged.severity,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return acknowledged;
}

export async function escalateAlert(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  escalatedToId: string,
  notes?: string | null,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<AlertEventRecord> {
  const now = new Date();

  // Enforces chk_ae_escalation_consistency: escalatedAt <-> escalatedToId both set
  const rows = await db
    .update(alertEvents)
    .set({
      escalatedAt: now,
      escalatedToId,
      escalationNotes: notes ?? null,
    })
    .where(and(eq(alertEvents.id, id), eq(alertEvents.organizationId, orgId)))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Alert event not found");
  }

  const escalated = mapRecordToAlertEvent(row as unknown as Record<string, unknown>);

  // Send escalation email to escalated user
  const targetUserRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, escalatedToId))
    .limit(1);

  if (targetUserRows[0]?.email) {
    await emailService.send({
      kind: "alert",
      to: targetUserRows[0].email,
      subject: `[ESCALATION] ${escalated.title}`,
      html: `<p><strong>Alert Escalation</strong></p><p>${escalated.title}</p><p>Notes: ${notes || "None"}</p>`,
      context: { organizationId: orgId, userId: escalatedToId },
    });
  }

  await writeAuditLog({
    db,
    module: "core",
    action: "alert.escalated",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      escalatedToId,
      alertType: escalated.alertType,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return escalated;
}
