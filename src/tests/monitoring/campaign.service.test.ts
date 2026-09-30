/** Database-backed monitoring campaign service tests (NWB-P4-001). */

import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { mediaArticles, socialMentions } from "../../../db/monitoring/index";
import { auditLog } from "../../../db/shared/audit";
import type { Db } from "../../lib/db";
import { NotFoundError, ValidationError } from "../../lib/errors";
import type { CreateMonitoringCampaignInput } from "../../lib/validation";
import {
  createMonitoringCampaign,
  deleteMonitoringCampaign,
  getMonitoringCampaign,
  listActiveMonitoringCampaigns,
  listMonitoringCampaigns,
  updateMonitoringCampaign,
} from "../../services/monitoring";
import { ensureMonitoringSchema, withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

interface Workspace {
  orgId: string;
  userId: string;
  otherOrgId: string;
  otherUserId: string;
}

async function setupWorkspace(db: Db): Promise<Workspace> {
  await ensureMonitoringSchema(db);
  const user = await createTestUser(db, { firstName: "Monitor", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: user.id, name: "Monitor Test Org" });
  const otherUser = await createTestUser(db, { firstName: "Other", lastName: "Owner" });
  const otherOrg = await createTestOrg(db, { ownerId: otherUser.id, name: "Other Monitor Org" });
  return { orgId: org.id, userId: user.id, otherOrgId: otherOrg.id, otherUserId: otherUser.id };
}

function input(name: string, keyword = "Nawebeus"): CreateMonitoringCampaignInput {
  return { name, keywords: [keyword], sourceTypes: ["newspaper", "online"] };
}

describe.skipIf(!hasDb())("Monitoring campaign service", () => {
  test("creates, reads, and isolates campaigns by organization", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const campaign = await createMonitoringCampaign(
        db,
        ws.orgId,
        ws.userId,
        input("Brand watch"),
      );

      expect(campaign.id).toMatch(/^mc_[0-9a-f]{32}$/i);
      expect(campaign.id.length).toBeLessThanOrEqual(64);
      expect(campaign.organizationId).toBe(ws.orgId);
      expect(campaign.createdById).toBe(ws.userId);
      expect(campaign.status).toBe("active");
      expect(campaign.keywords).toEqual(["Nawebeus"]);
      expect(campaign.sourceTypes).toEqual(["newspaper", "online"]);
      expect(campaign.minAuthorityScore).toBe(0);
      expect(campaign.excludeObituaries).toBe(true);
      expect(campaign.alertEnabled).toBe(false);
      expect((await getMonitoringCampaign(db, campaign.id, ws.orgId)).id).toBe(campaign.id);

      await expect(getMonitoringCampaign(db, campaign.id, ws.otherOrgId)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(getMonitoringCampaign(db, "bad-id", ws.orgId)).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  test("lists tenant campaigns with keyset pagination and returns active campaigns deterministically", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const first = await createMonitoringCampaign(db, ws.orgId, ws.userId, input("First"));
      const second = await createMonitoringCampaign(db, ws.orgId, ws.userId, input("Second"));
      await createMonitoringCampaign(
        db,
        ws.otherOrgId,
        ws.otherUserId,
        input("Other organization"),
      );
      await updateMonitoringCampaign(db, second.id, ws.orgId, ws.userId, { status: "paused" });

      const page = await listMonitoringCampaigns(db, ws.orgId, { limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.pageInfo.hasMore).toBe(true);
      expect(page.pageInfo.cursor).toBeString();
      const next = await listMonitoringCampaigns(db, ws.orgId, {
        limit: 1,
        cursor: page.pageInfo.cursor ?? undefined,
      });
      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
      expect(next.pageInfo.hasMore).toBe(false);

      const paused = await listMonitoringCampaigns(db, ws.orgId, { status: "paused" });
      expect(paused.items.map((item) => item.id)).toEqual([second.id]);

      const active = await listActiveMonitoringCampaigns(db, ws.orgId);
      expect(active.map((item) => item.id)).toEqual([first.id]);
      expect(active.every((item) => item.status === "active")).toBe(true);
    });
  });

  test("updates supported configuration and prevents enabling alerts without a threshold", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const campaign = await createMonitoringCampaign(db, ws.orgId, ws.userId, input("Update me"));

      await expect(
        updateMonitoringCampaign(db, campaign.id, ws.orgId, ws.userId, { alertEnabled: true }),
      ).rejects.toBeInstanceOf(ValidationError);

      const updated = await updateMonitoringCampaign(db, campaign.id, ws.orgId, ws.userId, {
        name: "Updated Monitor",
        keywords: ["Nawebeus", "new product"],
        alertEnabled: true,
        alertThreshold: 4,
        status: "paused",
      });
      expect(updated.name).toBe("Updated Monitor");
      expect(updated.keywords).toEqual(["Nawebeus", "new product"]);
      expect(updated.alertEnabled).toBe(true);
      expect(updated.alertThreshold).toBe(4);
      expect(updated.status).toBe("paused");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(campaign.updatedAt.getTime());

      await expect(
        updateMonitoringCampaign(db, campaign.id, ws.otherOrgId, ws.otherUserId, { name: "Nope" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        updateMonitoringCampaign(db, campaign.id, ws.orgId, ws.userId, {}),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("deletes a campaign without deleting its article and records minimal audit metadata", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);
      const campaign = await createMonitoringCampaign(db, ws.orgId, ws.userId, {
        ...input("Delete safely", "private query phrase"),
        booleanExpression: '"private query phrase" AND brand',
      });
      const articleId = `ma_${crypto.randomUUID().replaceAll("-", "")}`;
      const sharedUrl = "https://news.example.test/article/unique-monitoring-test";
      await db.insert(mediaArticles).values({
        id: articleId,
        organizationId: ws.orgId,
        monitoringCampaignId: campaign.id,
        title: "Coverage headline",
        url: sharedUrl,
        sourceName: "Example News",
        publishedAt: new Date("2026-09-29T10:00:00.000Z"),
      });

      const otherCampaign = await createMonitoringCampaign(
        db,
        ws.otherOrgId,
        ws.otherUserId,
        input("Other org coverage"),
      );
      await db.insert(mediaArticles).values({
        id: `ma_${crypto.randomUUID().replaceAll("-", "")}`,
        organizationId: ws.otherOrgId,
        monitoringCampaignId: otherCampaign.id,
        title: "Same public coverage",
        url: sharedUrl,
        sourceName: "Example News",
        publishedAt: new Date("2026-09-29T10:00:00.000Z"),
      });

      const mentionIdA = `sm_${crypto.randomUUID().replaceAll("-", "")}`;
      const mentionIdB = `sm_${crypto.randomUUID().replaceAll("-", "")}`;
      await db.insert(socialMentions).values({
        id: mentionIdA,
        organizationId: ws.orgId,
        campaignId: campaign.id,
        platform: "twitter_x",
        platformId: "shared-platform-post-id",
        content: "Same public social post",
        publishedAt: new Date("2026-09-29T10:00:00.000Z"),
      });
      await db.insert(socialMentions).values({
        id: mentionIdB,
        organizationId: ws.otherOrgId,
        campaignId: otherCampaign.id,
        platform: "twitter_x",
        platformId: "shared-platform-post-id",
        content: "Same public social post",
        publishedAt: new Date("2026-09-29T10:00:00.000Z"),
      });

      const removed = await deleteMonitoringCampaign(db, campaign.id, ws.orgId, ws.userId);
      expect(removed).toEqual({ id: campaign.id, deleted: true });
      const articles = await db
        .select({ id: mediaArticles.id, campaignId: mediaArticles.monitoringCampaignId })
        .from(mediaArticles)
        .where(eq(mediaArticles.id, articleId));
      expect(articles).toEqual([{ id: articleId, campaignId: null }]);
      const remainingMentions = await db
        .select({ id: socialMentions.id })
        .from(socialMentions)
        .where(eq(socialMentions.id, mentionIdB));
      const deletedMentions = await db
        .select({ id: socialMentions.id })
        .from(socialMentions)
        .where(eq(socialMentions.id, mentionIdA));
      expect(remainingMentions.map((mention) => mention.id)).toEqual([mentionIdB]);
      expect(deletedMentions).toEqual([]);
      await expect(getMonitoringCampaign(db, campaign.id, ws.orgId)).rejects.toBeInstanceOf(
        NotFoundError,
      );

      const events = await db
        .select({ action: auditLog.action, metadata: auditLog.metadata })
        .from(auditLog)
        .where(and(eq(auditLog.resourceId, campaign.id), eq(auditLog.organizationId, ws.orgId)));
      expect(events.map((event) => event.action).sort()).toEqual([
        "monitoring.campaign.created",
        "monitoring.campaign.deleted",
      ]);
      expect(JSON.stringify(events)).not.toContain("private query phrase");
    });
  });
});
