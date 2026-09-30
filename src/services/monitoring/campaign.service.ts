/** Monitoring campaign configuration service (NWB-P4-001). */

import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { buildPage, decodeCursor, type Page } from "@/lib/pagination";
import { withAtomicWrites } from "@/lib/transaction";
import {
  type CreateMonitoringCampaignInput,
  createMonitoringCampaignSchema,
  listMonitoringCampaignsQuerySchema,
  MONITORING_CAMPAIGN_ID_PATTERN,
  type MonitoringCampaignStatus,
  monitoringCampaignIdSchema,
  parseWithValidation,
  type UpdateMonitoringCampaignInput,
  updateMonitoringCampaignSchema,
} from "@/lib/validation";
import { writeAuditLog } from "@/services/audit";
import { monitoringCampaigns } from "../../../db/monitoring/index";

export type MonitoringCampaignRecord = typeof monitoringCampaigns.$inferSelect;

export interface ListMonitoringCampaignsOptions {
  status?: MonitoringCampaignStatus | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

interface ActorContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

function campaignId(): string {
  return `mc_${crypto.randomUUID().replaceAll("-", "")}`;
}

function parseCampaignId(id: string): string {
  return parseWithValidation(monitoringCampaignIdSchema, { id }).id;
}

function parseCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (raw === undefined) return null;
  const cursor = decodeCursor(raw, { idPattern: MONITORING_CAMPAIGN_ID_PATTERN });
  if (!cursor) {
    throw new ValidationError("Invalid pagination parameter", [
      { field: "cursor", message: "Malformed cursor" },
    ]);
  }
  const createdAt = new Date(cursor.v);
  if (Number.isNaN(createdAt.getTime())) {
    throw new ValidationError("Invalid pagination parameter", [
      { field: "cursor", message: "Malformed campaign timestamp" },
    ]);
  }
  return { createdAt, id: cursor.id };
}

export async function createMonitoringCampaign(
  db: Db,
  orgId: string,
  userId: string,
  rawInput: CreateMonitoringCampaignInput,
  actorContext: ActorContext = {},
): Promise<MonitoringCampaignRecord> {
  const input = parseWithValidation(createMonitoringCampaignSchema, rawInput);
  const now = new Date();
  const id = campaignId();

  return withAtomicWrites(db, async (tx) => {
    const rows = await tx
      .insert(monitoringCampaigns)
      .values({
        id,
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        ownerId: input.ownerId ?? null,
        keywords: input.keywords,
        booleanExpression: input.booleanExpression ?? null,
        queryConfig: input.queryConfig ?? {},
        sourceTypes: input.sourceTypes,
        languages: input.languages ?? null,
        countries: input.countries ?? null,
        minAuthorityScore: input.minAuthorityScore,
        excludeObituaries: input.excludeObituaries,
        excludeClassifieds: input.excludeClassifieds,
        geoScope: input.geoScope ?? {},
        schedule: input.schedule ?? {},
        alertEnabled: input.alertEnabled,
        alertFrequency: input.alertFrequency,
        alertThreshold: input.alertThreshold ?? null,
        status: "active",
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const created = rows[0];
    if (!created) throw new Error("Failed to create monitoring campaign");

    await writeAuditLog({
      db: tx,
      module: "monitoring",
      action: "monitoring.campaign.created",
      organizationId: orgId,
      actorId: userId,
      actorType: "user",
      resourceId: id,
      afterState: {
        status: created.status,
        keywordCount: created.keywords.length,
        sourceTypes: created.sourceTypes,
      },
      actorIp: actorContext.ip,
      actorUserAgent: actorContext.userAgent,
    });
    return created;
  });
}

export async function getMonitoringCampaign(
  db: Db,
  id: string,
  orgId: string,
): Promise<MonitoringCampaignRecord> {
  const safeId = parseCampaignId(id);
  const rows = await db
    .select()
    .from(monitoringCampaigns)
    .where(and(eq(monitoringCampaigns.id, safeId), eq(monitoringCampaigns.organizationId, orgId)))
    .limit(1);
  const campaign = rows[0];
  if (!campaign) throw new NotFoundError("Monitoring campaign not found");
  return campaign;
}

export async function listMonitoringCampaigns(
  db: Db,
  orgId: string,
  rawOptions: ListMonitoringCampaignsOptions = {},
): Promise<Page<MonitoringCampaignRecord>> {
  const options = parseWithValidation(listMonitoringCampaignsQuerySchema, rawOptions);
  const cursor = parseCursor(options.cursor);
  const conditions = [eq(monitoringCampaigns.organizationId, orgId)];
  if (options.status) conditions.push(eq(monitoringCampaigns.status, options.status));
  if (cursor) {
    const cursorCondition = or(
      lt(monitoringCampaigns.createdAt, cursor.createdAt),
      and(
        eq(monitoringCampaigns.createdAt, cursor.createdAt),
        lt(monitoringCampaigns.id, cursor.id),
      ),
    );
    if (cursorCondition) conditions.push(cursorCondition);
  }

  const rows = await db
    .select()
    .from(monitoringCampaigns)
    .where(and(...conditions))
    .orderBy(desc(monitoringCampaigns.createdAt), desc(monitoringCampaigns.id))
    .limit(options.limit + 1);

  return buildPage(rows, options.limit, (campaign) => campaign.createdAt.toISOString());
}

/** Stable active-only query for ingestion and enrichment workers. */
export async function listActiveMonitoringCampaigns(
  db: Db,
  orgId: string,
): Promise<MonitoringCampaignRecord[]> {
  return db
    .select()
    .from(monitoringCampaigns)
    .where(
      and(eq(monitoringCampaigns.organizationId, orgId), eq(monitoringCampaigns.status, "active")),
    )
    .orderBy(asc(monitoringCampaigns.createdAt), asc(monitoringCampaigns.id));
}

export async function updateMonitoringCampaign(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  rawInput: UpdateMonitoringCampaignInput,
  actorContext: ActorContext = {},
): Promise<MonitoringCampaignRecord> {
  const safeId = parseCampaignId(id);
  const input = parseWithValidation(updateMonitoringCampaignSchema, rawInput);

  return withAtomicWrites(db, async (tx) => {
    const existing = await getMonitoringCampaign(tx as Db, safeId, orgId);
    const effectiveAlertEnabled = input.alertEnabled ?? existing.alertEnabled;
    const effectiveAlertThreshold =
      input.alertThreshold !== undefined ? input.alertThreshold : existing.alertThreshold;
    if (effectiveAlertEnabled && effectiveAlertThreshold === null) {
      throw new ValidationError("An alert threshold is required when alerts are enabled", [
        { field: "alertThreshold", message: "Required when alertEnabled is true" },
      ]);
    }

    const updates: Partial<typeof monitoringCampaigns.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.ownerId !== undefined) updates.ownerId = input.ownerId;
    if (input.keywords !== undefined) updates.keywords = input.keywords;
    if (input.booleanExpression !== undefined) updates.booleanExpression = input.booleanExpression;
    if (input.queryConfig !== undefined) updates.queryConfig = input.queryConfig;
    if (input.sourceTypes !== undefined) updates.sourceTypes = input.sourceTypes;
    if (input.languages !== undefined) updates.languages = input.languages;
    if (input.countries !== undefined) updates.countries = input.countries;
    if (input.minAuthorityScore !== undefined) updates.minAuthorityScore = input.minAuthorityScore;
    if (input.excludeObituaries !== undefined) updates.excludeObituaries = input.excludeObituaries;
    if (input.excludeClassifieds !== undefined)
      updates.excludeClassifieds = input.excludeClassifieds;
    if (input.geoScope !== undefined) updates.geoScope = input.geoScope;
    if (input.schedule !== undefined) updates.schedule = input.schedule;
    if (input.alertEnabled !== undefined) updates.alertEnabled = input.alertEnabled;
    if (input.alertFrequency !== undefined) updates.alertFrequency = input.alertFrequency;
    if (input.alertThreshold !== undefined) updates.alertThreshold = input.alertThreshold;
    if (input.status !== undefined) updates.status = input.status;

    const rows = await tx
      .update(monitoringCampaigns)
      .set(updates)
      .where(and(eq(monitoringCampaigns.id, safeId), eq(monitoringCampaigns.organizationId, orgId)))
      .returning();
    const updated = rows[0];
    if (!updated) throw new NotFoundError("Monitoring campaign not found");

    await writeAuditLog({
      db: tx,
      module: "monitoring",
      action: "monitoring.campaign.updated",
      organizationId: orgId,
      actorId: userId,
      actorType: "user",
      resourceId: safeId,
      beforeState: { status: existing.status },
      afterState: {
        status: updated.status,
        changedFields: Object.keys(input),
      },
      actorIp: actorContext.ip,
      actorUserAgent: actorContext.userAgent,
    });
    return updated;
  });
}

export async function deleteMonitoringCampaign(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  actorContext: ActorContext = {},
): Promise<{ id: string; deleted: true }> {
  const safeId = parseCampaignId(id);
  return withAtomicWrites(db, async (tx) => {
    const existing = await getMonitoringCampaign(tx as Db, safeId, orgId);
    const rows = await tx
      .delete(monitoringCampaigns)
      .where(and(eq(monitoringCampaigns.id, safeId), eq(monitoringCampaigns.organizationId, orgId)))
      .returning({ id: monitoringCampaigns.id });
    if (!rows[0]) throw new NotFoundError("Monitoring campaign not found");

    await writeAuditLog({
      db: tx,
      module: "monitoring",
      action: "monitoring.campaign.deleted",
      organizationId: orgId,
      actorId: userId,
      actorType: "user",
      resourceId: safeId,
      beforeState: { status: existing.status },
      actorIp: actorContext.ip,
      actorUserAgent: actorContext.userAgent,
    });
    return { id: safeId, deleted: true };
  });
}
