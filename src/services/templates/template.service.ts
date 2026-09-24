/**
 * Unified Templates Service Implementation (NWB-P1-006).
 *
 * Implements CRUD, optimistic versioning, permission & approval gates,
 * usage tracking, variable interpolation, search, and audit logging.
 */

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TemplateVersionConflictError,
} from "@/lib/errors";
import { buildPage, type Page } from "@/lib/pagination";
import { writeAuditLog } from "@/services/audit";
import { templates } from "../../../db/shared/templates";
import type {
  ApproveTemplateInput,
  CreateTemplateInput,
  ListTemplatesOptions,
  RenderResult,
  TemplateRecord,
  UpdateTemplateInput,
} from "./types";

function mapRecordToTemplate(row: any): TemplateRecord {
  return {
    id: row.id,
    organizationId: row.organizationId ?? row.organization_id ?? null,
    templateType: row.templateType ?? row.template_type,
    name: row.name,
    description: row.description ?? null,
    content: row.content ?? null,
    sharedContent: row.sharedContent ?? row.shared_content ?? null,
    platformVariants: row.platformVariants ?? row.platform_variants ?? null,
    variables: row.variables ?? null,
    config: row.config ?? null,
    campaignMetadata:
      (row.templateType ?? row.template_type) === "campaign" ? (row.config ?? null) : null,
    platform: row.platform ?? null,
    mediaIds: row.mediaIds ?? row.media_ids ?? null,
    categoryPath: row.categoryPath ?? row.category_path ?? null,
    category: row.category ?? null,
    tags: row.tags ?? null,
    intentMatch: row.intentMatch ?? row.intent_match ?? null,
    language: row.language ?? "en-NG",
    isPidginAppropriate: Boolean(row.isPidginAppropriate ?? row.is_pidgin_appropriate ?? false),
    isOrganizationWide: Boolean(row.isOrganizationWide ?? row.is_organization_wide ?? false),
    isPublic: Boolean(row.isPublic ?? row.is_public ?? false),
    isPremium: Boolean(row.isPremium ?? row.is_premium ?? false),
    requiresApproval: Boolean(row.requiresApproval ?? row.requires_approval ?? false),
    currentApprovalStatus: row.currentApprovalStatus ?? row.current_approval_status ?? null,
    approvalStatus: row.currentApprovalStatus ?? row.current_approval_status ?? null,
    approvedAt:
      (row.approvedAt ?? row.approved_at) ? new Date(row.approvedAt ?? row.approved_at) : null,
    approvedById: row.approvedById ?? row.approved_by_id ?? null,
    usageCount: Number(row.usageCount ?? row.usage_count ?? 0),
    avgCsat:
      (row.avgCsat ?? row.avg_csat) !== null && (row.avgCsat ?? row.avg_csat) !== undefined
        ? String(row.avgCsat ?? row.avg_csat)
        : null,
    csat:
      (row.avgCsat ?? row.avg_csat) !== null && (row.avgCsat ?? row.avg_csat) !== undefined
        ? Number(row.avgCsat ?? row.avg_csat)
        : null,
    avgConversionRate:
      (row.avgConversionRate ?? row.avg_conversion_rate) !== null &&
      (row.avgConversionRate ?? row.avg_conversion_rate) !== undefined
        ? String(row.avgConversionRate ?? row.avg_conversion_rate)
        : null,
    conversionRate:
      (row.avgConversionRate ?? row.avg_conversion_rate) !== null &&
      (row.avgConversionRate ?? row.avg_conversion_rate) !== undefined
        ? Number(row.avgConversionRate ?? row.avg_conversion_rate)
        : null,
    lastUsedAt:
      (row.lastUsedAt ?? row.last_used_at) ? new Date(row.lastUsedAt ?? row.last_used_at) : null,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    version: Number(row.version ?? 1),
    createdById: row.createdById ?? row.created_by_id,
    createdAt: new Date(row.createdAt ?? row.created_at),
    updatedAt: new Date(row.updatedAt ?? row.updated_at),
  };
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createTemplate(
  db: Db,
  orgId: string | null,
  userId: string,
  input: CreateTemplateInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<TemplateRecord> {
  // Check name uniqueness within the organization
  if (orgId) {
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .where(
        and(
          eq(templates.organizationId, orgId),
          sql`lower(${templates.name}) = lower(${input.name})`,
          eq(templates.isActive, true),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(
        `A template named "${input.name}" already exists in this organization`,
      );
    }
  }

  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const id = `tmpl_${randomSuffix}`;

  // Enforce DB check constraints
  const content = input.templateType === "campaign" ? null : (input.content ?? null);
  const sharedContent = input.templateType === "post" ? (input.sharedContent ?? null) : null;
  const platformVariants = input.templateType === "post" ? (input.platformVariants ?? null) : null;
  const intentMatch =
    input.templateType === "engagement_response" ? (input.intentMatch ?? null) : null;
  const isPidginAppropriate =
    input.templateType === "engagement_response" ? (input.isPidginAppropriate ?? false) : false;

  const requiresApproval =
    input.requiresApproval ?? (input.approvalStatus !== undefined && input.approvalStatus !== null);
  const currentApprovalStatus = requiresApproval
    ? ((input.approvalStatus as any) ?? "pending")
    : null;

  const isOrganizationWide = input.isOrganizationWide ?? true;
  const isPublic = input.isPublic ?? false;
  const isPremium = input.isPremium ?? false;
  const language = input.language ?? "en-NG";

  const configValue =
    input.config ??
    (input.templateType === "campaign" && input.campaignMetadata ? input.campaignMetadata : null);

  const insertedRows = await db
    .insert(templates)
    .values({
      id,
      organizationId: orgId,
      templateType: input.templateType,
      name: input.name,
      description: input.description ?? null,
      content,
      sharedContent,
      platformVariants: platformVariants as any,
      variables: (input.variables as any) ?? null,
      config: configValue as any,
      platform: (input.platform as any) ?? null,
      mediaIds: input.mediaIds ?? null,
      categoryPath: input.categoryPath ?? null,
      category: input.category ?? null,
      tags: input.tags ?? null,
      intentMatch: intentMatch as any,
      language,
      isPidginAppropriate,
      isOrganizationWide,
      isPublic,
      isPremium,
      requiresApproval,
      currentApprovalStatus,
      usageCount: 0,
      version: 1,
      isActive: true,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to create template");
  }

  const created = mapRecordToTemplate(inserted);

  if (orgId) {
    await writeAuditLog({
      db,
      module: "core",
      action: "template.created",
      organizationId: orgId,
      actorId: userId,
      actorType: "user",
      resourceId: created.id,
      metadata: {
        templateType: created.templateType,
        name: created.name,
        isOrganizationWide: created.isOrganizationWide,
        version: created.version,
      },
      actorIp: actorContext.ip,
      actorUserAgent: actorContext.userAgent,
    });
  }

  return created;
}

// ── GET BY ID ────────────────────────────────────────────────────────────────

export async function getTemplateById(
  db: Db,
  id: string,
  options: {
    orgId?: string | null | undefined;
    userId?: string | undefined;
    includePending?: boolean | undefined;
  } = {},
): Promise<TemplateRecord> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.isActive, true)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Template not found");
  }

  const template = mapRecordToTemplate(row);

  // Multi-tenant check: org template must match user org or be public
  if (options.orgId && template.organizationId && template.organizationId !== options.orgId) {
    throw new NotFoundError("Template not found");
  }

  // Visibility check: private templates only visible to creator
  if (!template.isOrganizationWide && options.userId && template.createdById !== options.userId) {
    throw new NotFoundError("Template not found");
  }

  return template;
}

// ── LIST / SEARCH ────────────────────────────────────────────────────────────

export async function listTemplates(
  db: Db,
  options: ListTemplatesOptions,
): Promise<Page<TemplateRecord>> {
  const {
    orgId,
    userId,
    templateType,
    platform,
    category,
    categoryPath,
    intentMatch,
    isPidginAppropriate,
    tag,
    q,
    visibility,
    approvalStatus,
    isActive = true,
    sort = "recent",
    limit = 20,
    cursor,
    includePending = false,
  } = options;

  const conditions = [eq(templates.isActive, isActive)];

  // Tenant scoping: org templates or system public templates
  if (orgId) {
    conditions.push(
      or(
        eq(templates.organizationId, orgId),
        and(sql`${templates.organizationId} IS NULL`, eq(templates.isPublic, true)),
      )!,
    );
  }

  // Visibility filtering
  if (visibility === "private" && userId) {
    conditions.push(
      and(eq(templates.isOrganizationWide, false), eq(templates.createdById, userId))!,
    );
  } else if (visibility === "organization") {
    conditions.push(eq(templates.isOrganizationWide, true));
  } else if (userId) {
    // By default, hide other users' private drafts
    conditions.push(or(eq(templates.isOrganizationWide, true), eq(templates.createdById, userId))!);
  }

  // Filters
  if (templateType) {
    conditions.push(eq(templates.templateType, templateType));
  }
  if (platform) {
    conditions.push(
      or(sql`${templates.platform} IS NULL`, eq(templates.platform, platform as any))!,
    );
  }
  if (category) {
    conditions.push(eq(templates.category, category));
  }
  if (categoryPath) {
    conditions.push(
      or(
        eq(templates.categoryPath, categoryPath),
        sql`${templates.categoryPath} LIKE ${`${categoryPath}.%`}`,
      )!,
    );
  }
  if (intentMatch) {
    conditions.push(eq(templates.intentMatch, intentMatch as any));
  }
  if (isPidginAppropriate !== undefined) {
    conditions.push(eq(templates.isPidginAppropriate, isPidginAppropriate));
  }
  if (tag) {
    conditions.push(sql`${tag} = ANY(${templates.tags})`);
  }
  if (q && q.trim().length > 0) {
    const searchPattern = `%${q.trim()}%`;
    conditions.push(
      or(
        ilike(templates.name, searchPattern),
        ilike(templates.description, searchPattern),
        ilike(templates.content, searchPattern),
        ilike(templates.sharedContent, searchPattern),
      )!,
    );
  }

  // Approval status filtering
  if (approvalStatus && approvalStatus !== "all") {
    conditions.push(eq(templates.currentApprovalStatus, approvalStatus as any));
  } else if (!includePending) {
    // If not including pending, show approved or non-approval-required templates
    if (userId) {
      conditions.push(
        or(
          sql`${templates.currentApprovalStatus} IS NULL`,
          eq(templates.currentApprovalStatus, "approved"),
          eq(templates.createdById, userId),
        )!,
      );
    } else {
      conditions.push(
        or(
          sql`${templates.currentApprovalStatus} IS NULL`,
          eq(templates.currentApprovalStatus, "approved"),
        )!,
      );
    }
  }

  // Cursor pagination condition
  if (cursor) {
    if (sort === "most_used") {
      const cursorCount = Number(cursor.v);
      conditions.push(
        or(
          sql`${templates.usageCount} < ${cursorCount}`,
          and(sql`${templates.usageCount} = ${cursorCount}`, sql`${templates.id} < ${cursor.id}`),
        )!,
      );
    } else if (sort === "highest_rated") {
      const cursorCsat = Number(cursor.v);
      conditions.push(
        or(
          sql`COALESCE(${templates.avgCsat}, 0) < ${cursorCsat}`,
          and(
            sql`COALESCE(${templates.avgCsat}, 0) = ${cursorCsat}`,
            sql`${templates.id} < ${cursor.id}`,
          ),
        )!,
      );
    } else {
      const cursorDate = new Date(cursor.v);
      conditions.push(
        or(
          sql`${templates.updatedAt} < ${cursorDate}`,
          and(sql`${templates.updatedAt} = ${cursorDate}`, sql`${templates.id} < ${cursor.id}`),
        )!,
      );
    }
  }

  // Query order
  let orderClause = [desc(templates.updatedAt), desc(templates.id)];
  let sortValueFn: (item: TemplateRecord) => string = (item) => item.updatedAt.toISOString();

  if (sort === "most_used") {
    orderClause = [desc(templates.usageCount), desc(templates.id)];
    sortValueFn = (item) => String(item.usageCount);
  } else if (sort === "highest_rated") {
    orderClause = [desc(templates.avgCsat), desc(templates.id)];
    sortValueFn = (item) => String(item.csat ?? 0);
  }

  // Fetch limit + 1 items to determine hasNextPage
  const rows = await db
    .select()
    .from(templates)
    .where(and(...conditions))
    .orderBy(...orderClause)
    .limit(limit + 1);

  const items = rows.map(mapRecordToTemplate);
  return buildPage(items, limit, sortValueFn);
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateTemplate(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  input: UpdateTemplateInput,
  options: {
    isManagerOrAbove?: boolean | undefined;
    expectedVersion?: number | undefined;
    actorContext?: { ip?: string | undefined; userAgent?: string | undefined } | undefined;
  } = {},
): Promise<TemplateRecord> {
  const existing = await getTemplateById(db, id, { orgId, userId, includePending: true });

  // Ownership gate: non-managers can only edit their own templates
  if (!options.isManagerOrAbove && existing.createdById !== userId) {
    throw new ForbiddenError("You can only edit your own templates");
  }

  // Name uniqueness check if name is being changed
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dup = await db
      .select({ id: templates.id })
      .from(templates)
      .where(
        and(
          eq(templates.organizationId, orgId),
          sql`lower(${templates.name}) = lower(${input.name})`,
          eq(templates.isActive, true),
          sql`${templates.id} != ${id}`,
        ),
      )
      .limit(1);

    if (dup.length > 0) {
      throw new ConflictError(
        `A template named "${input.name}" already exists in this organization`,
      );
    }
  }

  // Optimistic concurrency check
  if (options.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
    throw new TemplateVersionConflictError(
      `Template was modified concurrently. Expected version ${options.expectedVersion}, but found ${existing.version}. Please reload and retry.`,
    );
  }

  // Type-specific field sanitization
  const content =
    existing.templateType === "campaign"
      ? null
      : input.content !== undefined
        ? input.content
        : existing.content;

  const sharedContent =
    existing.templateType === "post"
      ? input.sharedContent !== undefined
        ? input.sharedContent
        : existing.sharedContent
      : null;

  const platformVariants =
    existing.templateType === "post"
      ? input.platformVariants !== undefined
        ? input.platformVariants
        : existing.platformVariants
      : null;

  const intentMatch =
    existing.templateType === "engagement_response"
      ? input.intentMatch !== undefined
        ? input.intentMatch
        : existing.intentMatch
      : null;

  const isPidginAppropriate =
    existing.templateType === "engagement_response"
      ? (input.isPidginAppropriate ?? existing.isPidginAppropriate)
      : false;
  const isOrganizationWide = input.isOrganizationWide ?? existing.isOrganizationWide;
  const isPublic = input.isPublic ?? existing.isPublic;
  const isPremium = input.isPremium ?? existing.isPremium;

  let requiresApproval = existing.requiresApproval;
  let currentApprovalStatus = existing.approvalStatus;

  if (input.approvalStatus !== undefined) {
    if (input.approvalStatus === null) {
      currentApprovalStatus = null;
      requiresApproval = false;
    } else {
      currentApprovalStatus = input.approvalStatus;
      requiresApproval = true;
    }
  } else if (input.requiresApproval !== undefined) {
    requiresApproval = input.requiresApproval;
    if (!requiresApproval) {
      currentApprovalStatus = null;
    } else if (!currentApprovalStatus) {
      currentApprovalStatus = "pending";
    }
  }

  const configValue =
    input.config !== undefined
      ? input.config
      : input.campaignMetadata !== undefined
        ? input.campaignMetadata
        : existing.config;

  const updateSet: Record<string, any> = {
    name: input.name ?? existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    content,
    sharedContent,
    platformVariants: platformVariants as any,
    variables:
      input.variables !== undefined ? (input.variables as any) : (existing.variables as any),
    config: configValue as any,
    platform: input.platform !== undefined ? (input.platform as any) : (existing.platform as any),
    mediaIds: input.mediaIds !== undefined ? input.mediaIds : existing.mediaIds,
    categoryPath: input.categoryPath !== undefined ? input.categoryPath : existing.categoryPath,
    category: input.category !== undefined ? input.category : existing.category,
    tags: input.tags !== undefined ? input.tags : existing.tags,
    intentMatch: intentMatch as any,
    language: input.language ?? existing.language,
    isPidginAppropriate,
    isOrganizationWide,
    isPublic,
    isPremium,
    requiresApproval,
    currentApprovalStatus,
    isActive: input.isActive ?? existing.isActive,
    version: sql`${templates.version} + 1`,
    updatedAt: new Date(),
  };

  const updateConditions = [eq(templates.id, id), eq(templates.organizationId, orgId)];
  if (options.expectedVersion !== undefined) {
    updateConditions.push(eq(templates.version, options.expectedVersion));
  }

  const updatedRows = await db
    .update(templates)
    .set(updateSet)
    .where(and(...updateConditions))
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    throw new TemplateVersionConflictError(
      "Concurrent update conflict: the template was modified by another operation.",
    );
  }

  const updated = mapRecordToTemplate(updatedRow);

  await writeAuditLog({
    db,
    module: "core",
    action: "template.updated",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      previousVersion: existing.version,
      newVersion: updated.version,
      changedFields: Object.keys(input),
    },
    actorIp: options.actorContext?.ip,
    actorUserAgent: options.actorContext?.userAgent,
  });

  return updated;
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteTemplate(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  options: {
    isManagerOrAbove?: boolean | undefined;
    hard?: boolean | undefined;
    actorContext?: { ip?: string | undefined; userAgent?: string | undefined } | undefined;
  } = {},
): Promise<{ id: string; deleted: boolean }> {
  const existing = await getTemplateById(db, id, { orgId, userId, includePending: true });

  // Ownership gate: non-managers can only delete their own templates
  if (!options.isManagerOrAbove && existing.createdById !== userId) {
    throw new ForbiddenError("You can only delete your own templates");
  }

  if (options.hard) {
    await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)));
  } else {
    await db
      .update(templates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)));
  }

  await writeAuditLog({
    db,
    module: "core",
    action: "template.deleted",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      name: existing.name,
      hard: Boolean(options.hard),
    },
    actorIp: options.actorContext?.ip,
    actorUserAgent: options.actorContext?.userAgent,
  });

  return { id, deleted: true };
}

// ── RECORD USAGE ─────────────────────────────────────────────────────────────

export async function recordTemplateUsage(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  metrics: { csat?: number | undefined; conversionRate?: number | undefined } = {},
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<TemplateRecord> {
  const existing = await getTemplateById(db, id, { orgId, userId, includePending: true });

  const currentCount = existing.usageCount;
  const newCount = currentCount + 1;

  // Running average calculation
  let newCsat: number | undefined;
  if (metrics.csat !== undefined && existing.templateType === "engagement_response") {
    if (existing.csat !== null) {
      newCsat = Number(((existing.csat * currentCount + metrics.csat) / newCount).toFixed(2));
    } else {
      newCsat = Number(metrics.csat.toFixed(2));
    }
  }

  let newConversion: number | undefined;
  if (metrics.conversionRate !== undefined && existing.templateType === "campaign") {
    if (existing.conversionRate !== null) {
      newConversion = Number(
        ((existing.conversionRate * currentCount + metrics.conversionRate) / newCount).toFixed(4),
      );
    } else {
      newConversion = Number(metrics.conversionRate.toFixed(4));
    }
  }

  const now = new Date();

  const updatedRows = await db
    .update(templates)
    .set({
      usageCount: sql`${templates.usageCount} + 1`,
      lastUsedAt: now,
      ...(newCsat !== undefined ? { avgCsat: sql`${newCsat}::numeric` } : {}),
      ...(newConversion !== undefined ? { avgConversionRate: sql`${newConversion}::numeric` } : {}),
      updatedAt: now,
    })
    .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)))
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    throw new NotFoundError("Template not found");
  }

  const updated = mapRecordToTemplate(updatedRow);

  await writeAuditLog({
    db,
    module: "core",
    action: "template.used",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      usageCount: updated.usageCount,
      metrics,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return updated;
}

// ── APPROVE / REJECT ─────────────────────────────────────────────────────────

export async function approveTemplate(
  db: Db,
  id: string,
  orgId: string,
  reviewerId: string,
  input: ApproveTemplateInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<TemplateRecord> {
  const existing = await getTemplateById(db, id, { orgId, includePending: true });

  const now = new Date();
  const updatedRows = await db
    .update(templates)
    .set({
      requiresApproval: true,
      currentApprovalStatus: input.status,
      updatedAt: now,
    })
    .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)))
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    throw new NotFoundError("Template not found");
  }

  const updated = mapRecordToTemplate(updatedRow);

  // Set review fields onto response object
  updated.approvedAt = input.status === "approved" ? now : null;
  updated.approvedById = reviewerId;

  await writeAuditLog({
    db,
    module: "core",
    action: input.status === "approved" ? "template.approved" : "template.rejected",
    organizationId: orgId,
    actorId: reviewerId,
    actorType: "user",
    resourceId: id,
    metadata: {
      status: input.status,
      comment: input.comment ?? null,
      previousStatus: existing.approvalStatus,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return updated;
}

// ── RENDER VARIABLES ─────────────────────────────────────────────────────────

export function renderTemplateVariables(
  template: Pick<TemplateRecord, "content" | "sharedContent" | "platformVariants" | "templateType">,
  variables: Record<string, string | number>,
  platform?: string | undefined,
): RenderResult {
  let sourceText: string | null = null;

  if (template.templateType === "post") {
    if (platform && template.platformVariants && template.platformVariants[platform]) {
      const pv = template.platformVariants[platform] as any;
      sourceText = typeof pv === "string" ? pv : (pv?.text ?? pv?.caption ?? null);
    }
    if (!sourceText) {
      sourceText = template.sharedContent ?? template.content ?? "";
    }
  } else {
    sourceText = template.content ?? "";
  }

  if (!sourceText) {
    return {
      rendered: "",
      missingVariables: [],
      ...(platform !== undefined ? { platform } : {}),
    };
  }

  const missingVariables: string[] = [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

  const rendered = sourceText.replace(regex, (match, varName) => {
    if (Object.hasOwn(variables, varName)) {
      return String(variables[varName]!);
    }
    missingVariables.push(varName);
    return match;
  });

  return {
    rendered,
    missingVariables,
    ...(platform !== undefined ? { platform } : {}),
  };
}
