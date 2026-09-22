/**
 * TanStack Start Server Functions Tests for Alerts (NWB-P1-008).
 *
 * Tests in-process execution:
 * - createAlertRuleServerFn
 * - listAlertRulesServerFn
 * - getAlertRuleServerFn
 * - updateAlertRuleServerFn
 * - fireAlertServerFn
 * - listAlertEventsServerFn
 * - getUnreadAlertCountServerFn
 * - getAlertEventServerFn
 * - markAlertAsReadServerFn
 * - markAllAlertsAsReadServerFn
 * - acknowledgeAlertServerFn
 * - escalateAlertServerFn
 * - deleteAlertRuleServerFn
 */

import { describe, expect, test } from "bun:test";
import {
  acknowledgeAlertServerFn,
  createAlertRuleServerFn,
  deleteAlertRuleServerFn,
  escalateAlertServerFn,
  fireAlertServerFn,
  getAlertEventServerFn,
  getAlertRuleServerFn,
  getUnreadAlertCountServerFn,
  listAlertEventsServerFn,
  listAlertRulesServerFn,
  markAlertAsReadServerFn,
  markAllAlertsAsReadServerFn,
  updateAlertRuleServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
  setServerHeadersForTest,
} from "@/app/server-functions/helpers";
import { getConfig } from "@/lib/config";
import { createTestDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { signAccessToken } from "@/services/auth/jwt";
import { ensureAlertsSchema } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

describe("Alert Server Functions — Validation (No DB)", () => {
  test("createAlertRuleServerFn with missing name throws ValidationError", async () => {
    try {
      await createAlertRuleServerFn({
        data: {
          sourceModule: "listening",
          conditionType: "volume_spike",
        } as any,
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("getAlertRuleServerFn with invalid ID pattern throws ValidationError", async () => {
    try {
      await getAlertRuleServerFn({ data: { id: "not_a_valid_id" } });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("fireAlertServerFn with missing required fields throws ValidationError", async () => {
    try {
      await fireAlertServerFn({
        data: {
          title: "Incomplete",
        } as any,
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });
});

describe.skipIf(!hasDb())("Alert Server Functions — Integration (with DB)", () => {
  test("full server function lifecycle: rule CRUD, fire, read count, ack, escalate, delete", async () => {
    const ctx = await createTestDb();
    const { db } = ctx;

    try {
      await ensureAlertsSchema(db);

      const owner = await createTestUser(db, { firstName: "Owner", lastName: "ServerFn" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Alerts ServerFn Org" });

      const manager = await createTestUser(db, { firstName: "Manager", lastName: "ServerFn" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });

      const config = getConfig();
      const token = await signAccessToken(
        manager.id,
        org.id,
        config.JWT_ACCESS_SECRET || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      setServerDbForTest(db as never);
      setServerHeadersForTest({ cookie: `nawebeus_access=${token}` });

      // 1. Create rule
      const { rule } = await createAlertRuleServerFn({
        data: {
          sourceModule: "engagement",
          conditionType: "threshold",
          name: "ServerFn SLA Rule",
          defaultSeverity: "critical",
        },
      });
      expect(rule.id).toMatch(/^ar_/);
      expect(rule.name).toBe("ServerFn SLA Rule");

      // 2. Get rule by ID
      const { rule: fetchedRule } = await getAlertRuleServerFn({
        data: { id: rule.id },
      });
      expect(fetchedRule.id).toBe(rule.id);

      // 3. Update rule
      const { rule: updatedRule } = await updateAlertRuleServerFn({
        data: {
          id: rule.id,
          description: "Updated SLA rule",
          version: rule.version,
        },
      });
      expect(updatedRule.description).toBe("Updated SLA rule");
      expect(updatedRule.version).toBe(2);

      // 4. List rules
      const { rules } = await listAlertRulesServerFn({
        data: { limit: 10 },
      });
      expect(rules.some((r: { id: string }) => r.id === rule.id)).toBe(true);

      // 5. Fire alert
      const fireRes = await fireAlertServerFn({
        data: {
          ruleId: rule.id,
          alertType: "sla_first_response",
          severity: "critical",
          sourceModule: "engagement",
          sourceType: "engagement_message",
          title: "SLA Breached via ServerFn",
        },
      });
      expect(fireRes.suppressed).toBe(false);
      expect(fireRes.event).not.toBeNull();
      const event = fireRes.event!;

      // 6. Get event by ID
      const { event: fetchedEvent } = await getAlertEventServerFn({
        data: { id: event.id },
      });
      expect(fetchedEvent.id).toBe(event.id);

      // 7. Unread count is 1
      const countRes = await getUnreadAlertCountServerFn();
      expect(countRes.unreadCount).toBe(1);

      // List events
      const { events } = await listAlertEventsServerFn({
        data: { limit: 10 },
      });
      expect(events.some((e: { id: string }) => e.id === event.id)).toBe(true);

      // 8. Mark as read
      const { event: readEvent } = await markAlertAsReadServerFn({
        data: { id: event.id },
      });
      expect(readEvent.isRead).toBe(true);

      // Mark all as read
      const markAllResult = await markAllAlertsAsReadServerFn();
      expect(markAllResult.updatedCount).toBe(0);

      // 9. Acknowledge alert
      const { event: ackEvent } = await acknowledgeAlertServerFn({
        data: {
          id: event.id,
          notes: "Acknowledged via server function",
        },
      });
      expect(ackEvent.isAcknowledged).toBe(true);

      // 10. Escalate alert
      const { event: escEvent } = await escalateAlertServerFn({
        data: {
          id: event.id,
          escalatedToId: manager.id,
          notes: "Escalated via server function",
        },
      });
      expect(escEvent.escalatedToId).toBe(manager.id);

      // 11. Delete rule
      const delRes = await deleteAlertRuleServerFn({
        data: { id: rule.id },
      });
      expect(delRes.deleted).toBe(true);
      expect(delRes.id).toBe(rule.id);
    } finally {
      clearServerHeadersForTest();
      clearServerDbForTest();
      await ctx.done();
    }
  });
});
