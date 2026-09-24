/**
 * Unified Alerts & Notification Engine Service tests (NWB-P1-008).
 *
 * Covers:
 * - Alert rule creation & DB constraints (threshold-only, no quiet hours on SLA, system no scope)
 * - Name uniqueness per organization
 * - Optimistic version locking (AlertRuleVersionConflictError)
 * - Notification dispatch & alert firing (fan-out, email dispatch, in-app feed)
 * - Recipient resolution (users, emails, roles)
 * - Rate limiting (cooldown window and daily alert cap suppression)
 * - Denormalized rule counters update (triggerCount, lastTriggeredAt, lastSeverity)
 * - Operational triage (read tracking, unread badge count, acknowledgement, escalation)
 * - Keyset cursor pagination and multi-dimensional filtering
 * - Full audit trail (rule_created, rule_updated, rule_deleted, fired, acknowledged, escalated)
 */

import { describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { alertRules } from "../../../db/shared/alerts";
import type { Db } from "../../lib/db";
import {
  AlertRuleVersionConflictError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import {
  acknowledgeAlert,
  createAlertRule,
  deleteAlertRule,
  escalateAlert,
  fireAlert,
  getAlertEventById,
  getAlertRuleById,
  getUnreadAlertCount,
  listAlertEvents,
  listAlertRules,
  markAlertAsRead,
  markAllAlertsAsRead,
  updateAlertRule,
} from "../../services/alerts";
import { emailService } from "../../services/email";
import { ensureAlertsSchema, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

interface AlertsWorkspace {
  orgId: string;
  creatorId: string;
  managerId: string;
  memberId: string;
  otherOrgId: string;
  otherUserId: string;
}

async function setupWorkspace(db: Db): Promise<AlertsWorkspace> {
  await ensureAlertsSchema(db);

  const owner = await createTestUser(db, { firstName: "Alert", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: owner.id, name: "Alerts Test Org" });

  const creator = await createTestUser(db, {
    firstName: "Alert",
    lastName: "Creator",
    email: "alert.creator@test.com",
  });
  await addMemberWithRole(db, { organizationId: org.id, userId: creator.id, roleCode: "creator" });

  const manager = await createTestUser(db, {
    firstName: "Alert",
    lastName: "Manager",
    email: "alert.manager@test.com",
  });
  await addMemberWithRole(db, { organizationId: org.id, userId: manager.id, roleCode: "manager" });

  const member = await createTestUser(db, {
    firstName: "Alert",
    lastName: "Member",
    email: "alert.member@test.com",
  });
  await addMemberWithRole(db, { organizationId: org.id, userId: member.id, roleCode: "viewer" });

  const otherOwner = await createTestUser(db, { firstName: "Other", lastName: "Owner" });
  const otherOrg = await createTestOrg(db, { ownerId: otherOwner.id, name: "Other Org" });
  const otherUser = await createTestUser(db, { firstName: "Other", lastName: "User" });
  await addMemberWithRole(db, {
    organizationId: otherOrg.id,
    userId: otherUser.id,
    roleCode: "creator",
  });

  return {
    orgId: org.id,
    creatorId: creator.id,
    managerId: manager.id,
    memberId: member.id,
    otherOrgId: otherOrg.id,
    otherUserId: otherUser.id,
  };
}

describe.skipIf(!hasDb())("Alert Rules — CRUD & Constraints", () => {
  test("creates alert rule with proper fields and defaults", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "monitoring",
        conditionType: "volume_spike",
        name: "Viral Mention Spike",
        description: "Notifies when mentions increase by 3x baseline",
        condition: { baselineMultiplier: 3, windowHours: 2 },
        defaultSeverity: "critical",
        frequency: "realtime",
        notificationChannels: [
          { channel: "in_app", config: {} },
          { channel: "email", config: {} },
        ],
        recipients: [
          { type: "user", id: ws.creatorId },
          { type: "email", address: "alerts@client.com" },
        ],
        cooldownMinutes: 30,
      });

      expect(rule.id).toMatch(/^ar_/);
      expect(rule.organizationId).toBe(ws.orgId);
      expect(rule.name).toBe("Viral Mention Spike");
      expect(rule.defaultSeverity).toBe("critical");
      expect(rule.cooldownMinutes).toBe(30);
      expect(rule.triggerCount).toBe(0);
      expect(rule.lastTriggeredAt).toBeNull();
      expect(rule.version).toBe(1);
      expect(rule.isActive).toBe(true);
    });
  });

  test("enforces name uniqueness per organization", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "analytics",
        conditionType: "threshold",
        name: "High Bounce Rate",
        threshold: 0.8,
      });

      // Duplicate in same org fails
      await expect(
        createAlertRule(db, ws.orgId, ws.creatorId, {
          sourceModule: "analytics",
          conditionType: "threshold",
          name: "high bounce rate",
          threshold: 0.85,
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      // Same name in different org succeeds
      const otherRule = await createAlertRule(db, ws.otherOrgId, ws.otherUserId, {
        sourceModule: "analytics",
        conditionType: "threshold",
        name: "High Bounce Rate",
        threshold: 0.8,
      });
      expect(otherRule.organizationId).toBe(ws.otherOrgId);
    });
  });

  test("enforces DB constraints: threshold-only, SLA no quiet hours, system no scope", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // Threshold can only be set when conditionType is threshold
      await expect(
        createAlertRule(db, ws.orgId, ws.creatorId, {
          sourceModule: "listening",
          conditionType: "volume_spike",
          name: "Invalid Threshold Rule",
          threshold: 50,
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      // Engagement SLA cannot have quiet hours enabled
      await expect(
        createAlertRule(db, ws.orgId, ws.creatorId, {
          sourceModule: "engagement",
          conditionType: "threshold",
          name: "SLA Rule with Quiet Hours",
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      // System rule cannot specify scopeIds
      await expect(
        createAlertRule(db, ws.orgId, ws.creatorId, {
          sourceModule: "system",
          conditionType: "threshold",
          name: "System with Scope",
          scopeIds: ["some_id"],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("updates alert rule and increments version with optimistic locking", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "listening",
        conditionType: "sentiment_crash",
        name: "Negative Sentiment Alert",
      });

      expect(rule.version).toBe(1);

      // Valid update with expectedVersion 1 -> version 2
      const updated = await updateAlertRule(
        db,
        rule.id,
        ws.orgId,
        ws.creatorId,
        {
          cooldownMinutes: 45,
          version: 1,
        },
        { expectedVersion: 1 },
      );
      expect(updated.version).toBe(2);
      expect(updated.cooldownMinutes).toBe(45);

      // Stale update with expectedVersion 1 fails
      await expect(
        updateAlertRule(
          db,
          rule.id,
          ws.orgId,
          ws.creatorId,
          {
            cooldownMinutes: 60,
          },
          { expectedVersion: 1 },
        ),
      ).rejects.toBeInstanceOf(AlertRuleVersionConflictError);
    });
  });

  test("deletes alert rule cleanly", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "crisis",
        conditionType: "anomaly",
        name: "Temporary Rule",
      });

      const res = await deleteAlertRule(db, rule.id, ws.orgId, ws.managerId);
      expect(res.deleted).toBe(true);

      await expect(getAlertRuleById(db, rule.id, ws.orgId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe.skipIf(!hasDb())("Notification Dispatch & Alert Firing", () => {
  test("fires alert, resolves recipients, sends email, updates counters", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "engagement",
        conditionType: "threshold",
        name: "First Response SLA Breach",
        defaultSeverity: "critical",
        notificationChannels: [
          { channel: "in_app", config: {} },
          { channel: "email", config: {} },
        ],
        recipients: [
          { type: "user", id: ws.creatorId },
          { type: "role", role: "manager" },
          { type: "email", address: "support-lead@example.com" },
        ],
        cooldownMinutes: 10,
      });

      const sentEmails: unknown[] = [];
      const originalSend = emailService.send.bind(emailService);
      emailService.send = async (msg) => {
        sentEmails.push(msg);
        return {
          status: "sent",
          sent: true,
          messageId: "em_test_001",
          recipient: typeof msg.to === "string" ? msg.to : msg.to.join(", "),
        };
      };

      try {
        const fireRes = await fireAlert(db, ws.orgId, {
          ruleId: rule.id,
          alertType: "sla_first_response",
          severity: "critical",
          sourceModule: "engagement",
          sourceType: "engagement_message",
          sourceId: "msg_12345",
          title: "SLA Breached: High Priority Customer Waiting",
          description: "Response SLA exceeded by 15 minutes",
          breachType: "first_response",
          slaStartedAt: new Date(Date.now() - 3600000),
          breachedAt: new Date(Date.now() - 900000),
          minutesOverdue: 15,
        });

        expect(fireRes.suppressed).toBe(false);
        const event = fireRes.event;
        expect(event).not.toBeNull();
        expect(event?.id).toMatch(/^ae_/);
        expect(event?.alertType).toBe("sla_first_response");
        expect(event?.minutesOverdue).toBe(15);
        expect(event?.alertSent).toBe(true);
        expect(event?.notificationStatus.inApp?.sent).toBe(true);
        expect(event?.notificationStatus.email?.sent).toBe(true);

        // Verify email was sent to resolved recipients
        expect(sentEmails.length).toBe(1);
        const dispatchedMsg = sentEmails[0] as { to: string[] };
        expect(dispatchedMsg.to).toContain("alert.creator@test.com");
        expect(dispatchedMsg.to).toContain("alert.manager@test.com");
        expect(dispatchedMsg.to).toContain("support-lead@example.com");

        // Verify rule denormalized counters
        const refreshedRule = await getAlertRuleById(db, rule.id, ws.orgId);
        expect(refreshedRule.triggerCount).toBe(1);
        expect(refreshedRule.lastTriggeredAt).not.toBeNull();
        expect(refreshedRule.lastSeverity).toBe("critical");
      } finally {
        emailService.send = originalSend;
      }
    });
  });

  test("rate limiting: suppresses firing during cooldown window", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "monitoring",
        conditionType: "volume_spike",
        name: "Cooldown Test Rule",
        cooldownMinutes: 60,
      });

      // First firing succeeds
      const first = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "volume_spike",
        sourceModule: "monitoring",
        sourceType: "monitoring_campaign",
        title: "Spike Detected 1",
      });
      expect(first.suppressed).toBe(false);
      expect(first.event).not.toBeNull();

      // Immediate second firing is suppressed by cooldown
      const second = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "volume_spike",
        sourceModule: "monitoring",
        sourceType: "monitoring_campaign",
        title: "Spike Detected 2",
      });
      expect(second.suppressed).toBe(true);
      expect(second.reason).toBe("cooldown");
      expect(second.event).toBeNull();
    });
  });

  test("rate limiting: suppresses firing when daily cap is reached", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "analytics",
        conditionType: "threshold",
        name: "Capped Rule",
        cooldownMinutes: 1, // short cooldown
        maxAlertsPerDay: 2,
      });

      // Fire 1
      const f1 = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "metric_anomaly",
        sourceModule: "analytics",
        sourceType: "analytics_metric",
        title: "Anomaly 1",
      });
      expect(f1.suppressed).toBe(false);

      // Reset lastTriggeredAt to simulate cooldown elapsed
      await db
        .update(alertRules)
        .set({ lastTriggeredAt: new Date(Date.now() - 120000) })
        .where(eq(alertRules.id, rule.id));

      // Fire 2
      const f2 = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "metric_anomaly",
        sourceModule: "analytics",
        sourceType: "analytics_metric",
        title: "Anomaly 2",
      });
      expect(f2.suppressed).toBe(false);

      // Reset lastTriggeredAt again
      await db
        .update(alertRules)
        .set({ lastTriggeredAt: new Date(Date.now() - 120000) })
        .where(eq(alertRules.id, rule.id));

      // Fire 3 -> daily cap exceeded (max 2)
      const f3 = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "metric_anomaly",
        sourceModule: "analytics",
        sourceType: "analytics_metric",
        title: "Anomaly 3",
      });
      expect(f3.suppressed).toBe(true);
      expect(f3.reason).toBe("daily_cap_exceeded");
    });
  });
});

describe.skipIf(!hasDb())("Alert Event Operations — Read, Acknowledge, Escalate", () => {
  test("read tracking and unread badge count", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const a1 = await fireAlert(db, ws.orgId, {
        alertType: "system_error",
        sourceModule: "system",
        sourceType: "system",
        title: "Database Backup Delay",
      });

      const a2 = await fireAlert(db, ws.orgId, {
        alertType: "system_error",
        sourceModule: "system",
        sourceType: "system",
        title: "High Memory Warning",
      });

      expect(a1.event).not.toBeNull();
      expect(a2.event).not.toBeNull();

      // Unread badge count is 2
      const unread = await getUnreadAlertCount(db, ws.orgId);
      expect(unread.unreadCount).toBe(2);

      // Mark single alert as read
      const readEvent = await markAlertAsRead(db, a1.event?.id ?? "", ws.orgId, true);
      expect(readEvent.isRead).toBe(true);

      const unreadAfterOne = await getUnreadAlertCount(db, ws.orgId);
      expect(unreadAfterOne.unreadCount).toBe(1);

      // Mark all as read
      const markAllRes = await markAllAlertsAsRead(db, ws.orgId);
      expect(markAllRes.updatedCount).toBe(1);

      const unreadAfterAll = await getUnreadAlertCount(db, ws.orgId);
      expect(unreadAfterAll.unreadCount).toBe(0);

      // Get event by ID
      expect(a1.event).toBeDefined();
      const fetchedEvent = await getAlertEventById(db, a1.event!.id, ws.orgId);
      expect(fetchedEvent.id).toBe(a1.event!.id);

      // List alert events
      const eventList = await listAlertEvents(db, { orgId: ws.orgId, limit: 10 });
      expect(eventList.items.length).toBe(2);
    });
  });

  test("acknowledges alert with user identity and notes", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const { event } = await fireAlert(db, ws.orgId, {
        alertType: "sla_resolution",
        severity: "critical",
        sourceModule: "engagement",
        sourceType: "engagement_message",
        title: "Resolution SLA Exceeded",
      });

      expect(event?.isAcknowledged).toBe(false);

      const acknowledged = await acknowledgeAlert(
        db,
        event?.id ?? "",
        ws.orgId,
        ws.creatorId,
        "Investigating customer issue now",
      );

      expect(acknowledged.isAcknowledged).toBe(true);
      expect(acknowledged.acknowledgedById).toBe(ws.creatorId);
      expect(acknowledged.acknowledgedAt).not.toBeNull();
      expect(acknowledged.acknowledgmentNotes).toBe("Investigating customer issue now");
      expect(acknowledged.isRead).toBe(true);
    });
  });

  test("escalates alert with escalatedToId and sends notification email", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const { event } = await fireAlert(db, ws.orgId, {
        alertType: "crisis_detected",
        severity: "crisis",
        sourceModule: "crisis",
        sourceType: "social_mention",
        title: "Severe Brand Attack",
      });

      const sentEmails: unknown[] = [];
      const originalSend = emailService.send.bind(emailService);
      emailService.send = async (msg) => {
        sentEmails.push(msg);
        return {
          status: "sent",
          sent: true,
          messageId: "em_esc_001",
          recipient: typeof msg.to === "string" ? msg.to : msg.to.join(", "),
        };
      };

      try {
        const escalated = await escalateAlert(
          db,
          event?.id ?? "",
          ws.orgId,
          ws.creatorId,
          ws.managerId,
          "Urgent crisis: escalated to manager for immediate PR statement",
        );

        expect(escalated.escalatedAt).not.toBeNull();
        expect(escalated.escalatedToId).toBe(ws.managerId);
        expect(escalated.escalationNotes).toBe(
          "Urgent crisis: escalated to manager for immediate PR statement",
        );

        // Verification email sent to manager
        expect(sentEmails.length).toBe(1);
        const email = sentEmails[0] as { to: string; subject: string };
        expect(email.to).toBe("alert.manager@test.com");
        expect(email.subject).toContain("Severe Brand Attack");
      } finally {
        emailService.send = originalSend;
      }
    });
  });
});

describe.skipIf(!hasDb())("Alerts Service — Keyset Pagination & Filtering", () => {
  test("filters rules and events with cursor pagination", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "listening",
        conditionType: "volume_spike",
        name: "Rule A",
      });

      await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "monitoring",
        conditionType: "keyword_match",
        name: "Rule B",
      });

      // Filter by sourceModule
      const listeningRules = await listAlertRules(db, {
        orgId: ws.orgId,
        sourceModule: "listening",
      });
      expect(listeningRules.items.length).toBe(1);
      expect(listeningRules.items[0]?.name).toBe("Rule A");

      // Pagination
      const page1 = await listAlertRules(db, { orgId: ws.orgId, limit: 1 });
      expect(page1.items.length).toBe(1);
      expect(page1.pageInfo.hasMore).toBe(true);

      const page2 = await listAlertRules(db, {
        orgId: ws.orgId,
        limit: 1,
        cursor: { v: page1.items[0]?.createdAt.toISOString() ?? "", id: page1.items[0]?.id ?? "" },
      });
      expect(page2.items.length).toBe(1);
      expect(page2.pageInfo.hasMore).toBe(false);
    });
  });
});

describe.skipIf(!hasDb())("Alerts Service — Audit Logging", () => {
  test("writes audit entries for rule and alert events", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const rule = await createAlertRule(db, ws.orgId, ws.creatorId, {
        sourceModule: "system",
        conditionType: "threshold",
        name: "Audited Alert Rule",
      });

      await updateAlertRule(db, rule.id, ws.orgId, ws.creatorId, {
        description: "Updated description",
      });

      const { event } = await fireAlert(db, ws.orgId, {
        ruleId: rule.id,
        alertType: "system_ping",
        sourceModule: "system",
        sourceType: "system",
        title: "Audit Test Ping",
      });

      await acknowledgeAlert(db, event?.id ?? "", ws.orgId, ws.creatorId, "Acknowledged");

      await escalateAlert(db, event?.id ?? "", ws.orgId, ws.creatorId, ws.managerId, "Escalated");

      await deleteAlertRule(db, rule.id, ws.orgId, ws.managerId);

      const auditRows = await db.execute(
        sql`SELECT action FROM unified_audit_log WHERE organization_id = ${ws.orgId} ORDER BY created_at ASC`,
      );

      const actions = (auditRows as unknown as { rows: { action: string }[] }).rows.map(
        (r) => r.action,
      );

      expect(actions).toContain("alert.rule_created");
      expect(actions).toContain("alert.rule_updated");
      expect(actions).toContain("alert.fired");
      expect(actions).toContain("alert.acknowledged");
      expect(actions).toContain("alert.escalated");
      expect(actions).toContain("alert.rule_deleted");
    });
  });
});
