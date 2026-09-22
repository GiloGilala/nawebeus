/**
 * Unified Contacts Service Implementation (NWB-P1-007).
 *
 * Implements Contact CRM, shared-PK inheritance, optimistic version locking,
 * deduplication merging, interaction timeline tracking, and follow-up completion.
 */

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  ConflictError,
  ContactAlreadyMergedError,
  ContactVersionConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { buildPage, type Page } from "@/lib/pagination";
import type {
  FollowUpStatus,
  InteractionDirection,
  InteractionOutcome,
  InteractionPriority,
  InteractionType,
  InteractionVisibility,
} from "@/lib/validation";
import { writeAuditLog } from "@/services/audit";
import { contactInteractions, contacts } from "../../../db/shared/contacts";
import type {
  ContactInteractionRecord,
  ContactRecord,
  CreateContactInput,
  CreateInteractionInput,
  ListContactsOptions,
  ListInteractionsOptions,
  UpdateContactInput,
} from "./types";

function mapRecordToContact(row: Record<string, unknown>): ContactRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId ?? row.organization_id),
    kind: (row.kind as "journalist" | "influencer") ?? "journalist",
    fullName: String(row.fullName ?? row.full_name),
    firstName: (row.firstName ?? row.first_name ?? null) as string | null,
    lastName: (row.lastName ?? row.last_name ?? null) as string | null,
    displayName: (row.displayName ?? row.display_name ?? null) as string | null,
    email: (row.email ?? null) as string | null,
    emailSecondary: (row.emailSecondary ?? row.email_secondary ?? null) as string | null,
    phone: (row.phone ?? null) as string | null,
    whatsapp: (row.whatsapp ?? null) as string | null,
    telegram: (row.telegram ?? null) as string | null,
    location: (row.location ?? null) as string | null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    notes: (row.notes ?? null) as string | null,
    relationshipScore: Number(row.relationshipScore ?? row.relationship_score ?? 0),
    lastInteractionAt:
      (row.lastInteractionAt ?? row.last_interaction_at)
        ? new Date(String(row.lastInteractionAt ?? row.last_interaction_at))
        : null,
    interactionCount: Number(row.interactionCount ?? row.interaction_count ?? 0),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    deletedAt:
      (row.deletedAt ?? row.deleted_at) ? new Date(String(row.deletedAt ?? row.deleted_at)) : null,
    deletedById: (row.deletedById ?? row.deleted_by_id ?? null) as string | null,
    mergedIntoId: (row.mergedIntoId ?? row.merged_into_id ?? null) as string | null,
    mergedAt:
      (row.mergedAt ?? row.merged_at) ? new Date(String(row.mergedAt ?? row.merged_at)) : null,
    version: Number(row.version ?? 1),
    createdById: String(row.createdById ?? row.created_by_id),
    createdAt: new Date(String(row.createdAt ?? row.created_at)),
    updatedAt: new Date(String(row.updatedAt ?? row.updated_at)),
  };
}

function mapRecordToInteraction(row: Record<string, unknown>): ContactInteractionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId ?? row.organization_id),
    contactId: String(row.contactId ?? row.contact_id),
    campaignId: (row.campaignId ?? row.campaign_id ?? null) as string | null,
    pressReleaseId: (row.pressReleaseId ?? row.press_release_id ?? null) as string | null,
    assignmentId: (row.assignmentId ?? row.assignment_id ?? null) as string | null,
    distributionId: (row.distributionId ?? row.distribution_id ?? null) as string | null,
    interactionType: (row.interactionType ?? row.interaction_type) as InteractionType,
    direction: (row.direction ?? null) as InteractionDirection | null,
    subject: (row.subject ?? null) as string | null,
    content: (row.content ?? null) as string | null,
    outcome: (row.outcome ?? null) as InteractionOutcome | null,
    responseTimeMinutes:
      row.responseTimeMinutes !== undefined && row.responseTimeMinutes !== null
        ? Number(row.responseTimeMinutes)
        : row.response_time_minutes !== undefined && row.response_time_minutes !== null
          ? Number(row.response_time_minutes)
          : null,
    durationMinutes:
      row.durationMinutes !== undefined && row.durationMinutes !== null
        ? Number(row.durationMinutes)
        : row.duration_minutes !== undefined && row.duration_minutes !== null
          ? Number(row.duration_minutes)
          : null,
    priority: (row.priority ?? "medium") as InteractionPriority,
    visibility: (row.visibility ?? "organization") as InteractionVisibility,
    externalReference: (row.externalReference ?? row.external_reference ?? null) as string | null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    followUpAt:
      (row.followUpAt ?? row.follow_up_at)
        ? new Date(String(row.followUpAt ?? row.follow_up_at))
        : null,
    followUpNote: (row.followUpNote ?? row.follow_up_note ?? null) as string | null,
    followUpStatus: (row.followUpStatus ?? row.follow_up_status ?? "pending") as FollowUpStatus,
    followUpCompletedAt:
      (row.followUpCompletedAt ?? row.follow_up_completed_at)
        ? new Date(String(row.followUpCompletedAt ?? row.follow_up_completed_at))
        : null,
    createdById: String(row.createdById ?? row.created_by_id),
    createdAt: new Date(String(row.createdAt ?? row.created_at)),
  };
}

// ── CREATE CONTACT ───────────────────────────────────────────────────────────

export async function createContact(
  db: Db,
  orgId: string,
  userId: string,
  input: CreateContactInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<ContactRecord> {
  // Check email uniqueness per org (case-insensitive)
  if (input.email && input.email.trim().length > 0) {
    const existingEmail = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          sql`lower(${contacts.email}) = lower(${input.email.trim()})`,
          sql`${contacts.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (existingEmail.length > 0) {
      throw new ConflictError(
        `A contact with email "${input.email.trim()}" already exists in this organization`,
      );
    }
  }

  // Check phone uniqueness per org
  if (input.phone && input.phone.trim().length > 0) {
    const existingPhone = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          eq(contacts.phone, input.phone.trim()),
          sql`${contacts.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (existingPhone.length > 0) {
      throw new ConflictError(
        `A contact with phone "${input.phone.trim()}" already exists in this organization`,
      );
    }
  }

  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const id = `con_${randomSuffix}`;

  const displayName =
    input.displayName ??
    (input.firstName && input.lastName ? `${input.firstName} ${input.lastName}` : input.fullName);

  const insertedRows = await db
    .insert(contacts)
    .values({
      id,
      organizationId: orgId,
      kind: input.kind,
      fullName: input.fullName,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      displayName,
      email: input.email ? input.email.trim().toLowerCase() : null,
      emailSecondary: input.emailSecondary ? input.emailSecondary.trim().toLowerCase() : null,
      phone: input.phone ? input.phone.trim() : null,
      whatsapp: input.whatsapp ? input.whatsapp.trim() : null,
      telegram: input.telegram ? input.telegram.trim() : null,
      location: input.location ?? null,
      tags: input.tags ?? null,
      notes: input.notes ?? null,
      relationshipScore: 0,
      interactionCount: 0,
      isActive: true,
      version: 1,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to create contact");
  }

  const created = mapRecordToContact(inserted);

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.created",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: created.id,
    metadata: {
      kind: created.kind,
      fullName: created.fullName,
      email: created.email,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return created;
}

// ── GET CONTACT BY ID ────────────────────────────────────────────────────────

export async function getContactById(
  db: Db,
  id: string,
  orgId: string,
  options?: { includeMerged?: boolean },
): Promise<ContactRecord> {
  const conditions = [
    eq(contacts.id, id),
    eq(contacts.organizationId, orgId),
    sql`${contacts.deletedAt} IS NULL`,
  ];

  if (!options?.includeMerged) {
    conditions.push(sql`${contacts.mergedIntoId} IS NULL`);
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Contact not found");
  }

  return mapRecordToContact(row);
}

// ── LIST CONTACTS ────────────────────────────────────────────────────────────

export async function listContacts(
  db: Db,
  options: ListContactsOptions,
): Promise<Page<ContactRecord>> {
  const { orgId, kind, tag, isActive, q, sort = "recent", limit = 20, cursor } = options;

  const conditions = [
    eq(contacts.organizationId, orgId),
    sql`${contacts.deletedAt} IS NULL`,
    sql`${contacts.mergedIntoId} IS NULL`,
  ];

  if (isActive !== undefined) {
    conditions.push(eq(contacts.isActive, isActive));
  }
  if (kind) {
    conditions.push(eq(contacts.kind, kind));
  }
  if (tag) {
    conditions.push(sql`${tag} = ANY(${contacts.tags})`);
  }
  if (q && q.trim().length > 0) {
    const searchPattern = `%${q.trim()}%`;
    const cond = or(
      ilike(contacts.fullName, searchPattern),
      ilike(contacts.displayName, searchPattern),
      ilike(contacts.email, searchPattern),
      ilike(contacts.phone, searchPattern),
      ilike(contacts.notes, searchPattern),
      ilike(contacts.location, searchPattern),
    );
    if (cond) {
      conditions.push(cond);
    }
  }

  // Cursor pagination conditions & order
  let orderClause = [
    desc(sql`COALESCE(${contacts.lastInteractionAt}, ${contacts.createdAt})`),
    desc(contacts.id),
  ];
  let sortValueFn: (item: ContactRecord) => string = (item) =>
    (item.lastInteractionAt ?? item.createdAt).toISOString();

  if (sort === "name") {
    orderClause = [asc(contacts.fullName), asc(contacts.id)];
    sortValueFn = (item) => item.fullName;
  } else if (sort === "score") {
    orderClause = [desc(contacts.relationshipScore), desc(contacts.id)];
    sortValueFn = (item) => String(item.relationshipScore);
  } else if (sort === "interactions") {
    orderClause = [desc(contacts.interactionCount), desc(contacts.id)];
    sortValueFn = (item) => String(item.interactionCount);
  }

  if (cursor) {
    if (sort === "name") {
      const cond = or(
        sql`${contacts.fullName} > ${cursor.v}`,
        and(sql`${contacts.fullName} = ${cursor.v}`, sql`${contacts.id} > ${cursor.id}`),
      );
      if (cond) conditions.push(cond);
    } else if (sort === "score") {
      const cursorScore = Number(cursor.v);
      const cond = or(
        sql`${contacts.relationshipScore} < ${cursorScore}`,
        and(
          sql`${contacts.relationshipScore} = ${cursorScore}`,
          sql`${contacts.id} < ${cursor.id}`,
        ),
      );
      if (cond) conditions.push(cond);
    } else if (sort === "interactions") {
      const cursorCount = Number(cursor.v);
      const cond = or(
        sql`${contacts.interactionCount} < ${cursorCount}`,
        and(sql`${contacts.interactionCount} = ${cursorCount}`, sql`${contacts.id} < ${cursor.id}`),
      );
      if (cond) conditions.push(cond);
    } else {
      const cursorDate = new Date(cursor.v);
      const cond = or(
        sql`COALESCE(${contacts.lastInteractionAt}, ${contacts.createdAt}) < ${cursorDate}`,
        and(
          sql`COALESCE(${contacts.lastInteractionAt}, ${contacts.createdAt}) = ${cursorDate}`,
          sql`${contacts.id} < ${cursor.id}`,
        ),
      );
      if (cond) conditions.push(cond);
    }
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(...orderClause)
    .limit(limit + 1);

  const items = rows.map(mapRecordToContact);
  return buildPage(items, limit, sortValueFn);
}

// ── UPDATE CONTACT ───────────────────────────────────────────────────────────

export async function updateContact(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  input: UpdateContactInput,
  options: {
    expectedVersion?: number | undefined;
    actorContext?: { ip?: string | undefined; userAgent?: string | undefined } | undefined;
  } = {},
): Promise<ContactRecord> {
  const existing = await getContactById(db, id, orgId);

  if (existing.mergedIntoId) {
    throw new ContactAlreadyMergedError();
  }

  const expectedVersion = options.expectedVersion ?? input.version;
  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new ContactVersionConflictError(
      `Contact was modified concurrently. Expected version ${expectedVersion}, but found ${existing.version}. Please reload and retry.`,
    );
  }

  // Check email uniqueness if changing
  if (input.email && input.email.trim().toLowerCase() !== (existing.email ?? "").toLowerCase()) {
    const dupEmail = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          sql`lower(${contacts.email}) = lower(${input.email.trim()})`,
          sql`${contacts.deletedAt} IS NULL`,
          sql`${contacts.id} != ${id}`,
        ),
      )
      .limit(1);

    if (dupEmail.length > 0) {
      throw new ConflictError(
        `A contact with email "${input.email.trim()}" already exists in this organization`,
      );
    }
  }

  // Check phone uniqueness if changing
  if (input.phone && input.phone.trim() !== (existing.phone ?? "")) {
    const dupPhone = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          eq(contacts.phone, input.phone.trim()),
          sql`${contacts.deletedAt} IS NULL`,
          sql`${contacts.id} != ${id}`,
        ),
      )
      .limit(1);

    if (dupPhone.length > 0) {
      throw new ConflictError(
        `A contact with phone "${input.phone.trim()}" already exists in this organization`,
      );
    }
  }

  const updateSet: Record<string, unknown> = {
    fullName: input.fullName ?? existing.fullName,
    firstName: input.firstName !== undefined ? input.firstName : existing.firstName,
    lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
    displayName: input.displayName !== undefined ? input.displayName : existing.displayName,
    email:
      input.email !== undefined
        ? input.email
          ? input.email.trim().toLowerCase()
          : null
        : existing.email,
    emailSecondary:
      input.emailSecondary !== undefined
        ? input.emailSecondary
          ? input.emailSecondary.trim().toLowerCase()
          : null
        : existing.emailSecondary,
    phone: input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : existing.phone,
    whatsapp:
      input.whatsapp !== undefined
        ? input.whatsapp
          ? input.whatsapp.trim()
          : null
        : existing.whatsapp,
    telegram:
      input.telegram !== undefined
        ? input.telegram
          ? input.telegram.trim()
          : null
        : existing.telegram,
    location: input.location !== undefined ? input.location : existing.location,
    tags: input.tags !== undefined ? input.tags : existing.tags,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    isActive: input.isActive ?? existing.isActive,
    version: sql`${contacts.version} + 1`,
    updatedAt: new Date(),
  };

  const updateConditions = [eq(contacts.id, id), eq(contacts.organizationId, orgId)];
  if (expectedVersion !== undefined) {
    updateConditions.push(eq(contacts.version, expectedVersion));
  }

  const updatedRows = await db
    .update(contacts)
    .set(updateSet)
    .where(and(...updateConditions))
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    throw new ContactVersionConflictError(
      "Concurrent update conflict: the contact was modified by another operation.",
    );
  }

  const updated = mapRecordToContact(updatedRow);

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.updated",
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

// ── DELETE CONTACT ───────────────────────────────────────────────────────────

export async function deleteContact(
  db: Db,
  id: string,
  orgId: string,
  userId: string,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<{ id: string; deleted: boolean }> {
  const existing = await getContactById(db, id, orgId);

  const now = new Date();
  await db
    .update(contacts)
    .set({
      deletedAt: now,
      deletedById: userId,
      isActive: false,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, orgId)));

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.deleted",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: id,
    metadata: {
      fullName: existing.fullName,
      kind: existing.kind,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return { id, deleted: true };
}

// ── MERGE CONTACTS ───────────────────────────────────────────────────────────

export async function mergeContacts(
  db: Db,
  sourceContactId: string,
  targetContactId: string,
  orgId: string,
  userId: string,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<ContactRecord> {
  if (sourceContactId === targetContactId) {
    throw new ValidationError("Cannot merge a contact into itself");
  }

  const source = await getContactById(db, sourceContactId, orgId, { includeMerged: true });
  const target = await getContactById(db, targetContactId, orgId, { includeMerged: true });

  if (source.mergedIntoId) {
    throw new ContactAlreadyMergedError("Source contact is already merged");
  }
  if (target.mergedIntoId) {
    throw new ContactAlreadyMergedError("Target contact is already merged");
  }

  const now = new Date();

  // Re-link all interactions from source to target
  await db
    .update(contactInteractions)
    .set({ contactId: targetContactId })
    .where(
      and(
        eq(contactInteractions.contactId, sourceContactId),
        eq(contactInteractions.organizationId, orgId),
      ),
    );

  // Mark source contact as merged
  await db
    .update(contacts)
    .set({
      mergedIntoId: targetContactId,
      mergedAt: now,
      isActive: false,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, sourceContactId), eq(contacts.organizationId, orgId)));

  // Determine latest interaction timestamp
  const latestInteraction =
    source.lastInteractionAt && target.lastInteractionAt
      ? source.lastInteractionAt > target.lastInteractionAt
        ? source.lastInteractionAt
        : target.lastInteractionAt
      : (source.lastInteractionAt ?? target.lastInteractionAt);

  // Update target contact counters
  const updatedTargetRows = await db
    .update(contacts)
    .set({
      interactionCount: target.interactionCount + source.interactionCount,
      lastInteractionAt: latestInteraction,
      version: sql`${contacts.version} + 1`,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, targetContactId), eq(contacts.organizationId, orgId)))
    .returning();

  const updatedTargetRow = updatedTargetRows[0];
  if (!updatedTargetRow) {
    throw new Error("Failed to update target contact");
  }
  const updatedTarget = mapRecordToContact(updatedTargetRow as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.merged",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: targetContactId,
    metadata: {
      sourceContactId,
      targetContactId,
      sourceName: source.fullName,
      targetName: target.fullName,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return updatedTarget;
}

// ── LOG INTERACTION ──────────────────────────────────────────────────────────

export async function createInteraction(
  db: Db,
  orgId: string,
  userId: string,
  input: CreateInteractionInput,
  actorContext: { ip?: string | undefined; userAgent?: string | undefined } = {},
): Promise<ContactInteractionRecord> {
  // Ensure contact exists in this org
  await getContactById(db, input.contactId, orgId);

  // If external reference provided, check uniqueness within org
  if (input.externalReference && input.externalReference.trim().length > 0) {
    const existingRef = await db
      .select({ id: contactInteractions.id })
      .from(contactInteractions)
      .where(
        and(
          eq(contactInteractions.organizationId, orgId),
          eq(contactInteractions.externalReference, input.externalReference.trim()),
        ),
      )
      .limit(1);

    if (existingRef.length > 0) {
      throw new ConflictError(
        `An interaction with external reference "${input.externalReference.trim()}" already exists`,
      );
    }
  }

  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const id = `ci_${randomSuffix}`;

  const now = new Date();

  const insertedRows = await db
    .insert(contactInteractions)
    .values({
      id,
      organizationId: orgId,
      contactId: input.contactId,
      campaignId: input.campaignId ?? null,
      pressReleaseId: input.pressReleaseId ?? null,
      assignmentId: input.assignmentId ?? null,
      distributionId: input.distributionId ?? null,
      interactionType: input.interactionType,
      direction: input.direction ?? null,
      subject: input.subject ?? null,
      content: input.content ?? null,
      outcome: input.outcome ?? null,
      responseTimeMinutes: input.responseTimeMinutes ?? null,
      durationMinutes: input.durationMinutes ?? null,
      priority: input.priority ?? "medium",
      visibility: input.visibility ?? "organization",
      externalReference: input.externalReference ? input.externalReference.trim() : null,
      metadata: input.metadata ?? null,
      followUpAt: input.followUpAt ?? null,
      followUpNote: input.followUpNote ?? null,
      followUpStatus: "pending",
      createdById: userId,
      createdAt: now,
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error("Failed to log interaction");
  }

  // Update contact interaction count and lastInteractionAt
  await db
    .update(contacts)
    .set({
      lastInteractionAt: now,
      interactionCount: sql`${contacts.interactionCount} + 1`,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, input.contactId), eq(contacts.organizationId, orgId)));

  const interaction = mapRecordToInteraction(inserted);

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.interaction_logged",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: interaction.id,
    metadata: {
      contactId: interaction.contactId,
      interactionType: interaction.interactionType,
      outcome: interaction.outcome,
    },
    actorIp: actorContext.ip,
    actorUserAgent: actorContext.userAgent,
  });

  return interaction;
}

// ── LIST INTERACTIONS ────────────────────────────────────────────────────────

export async function listInteractions(
  db: Db,
  options: ListInteractionsOptions,
): Promise<Page<ContactInteractionRecord>> {
  const { orgId, contactId, limit = 20, cursor } = options;

  const conditions = [eq(contactInteractions.organizationId, orgId)];

  if (contactId) {
    conditions.push(eq(contactInteractions.contactId, contactId));
  }

  if (cursor) {
    const cursorDate = new Date(cursor.v);
    const cond = or(
      sql`${contactInteractions.createdAt} < ${cursorDate}`,
      and(
        sql`${contactInteractions.createdAt} = ${cursorDate}`,
        sql`${contactInteractions.id} < ${cursor.id}`,
      ),
    );
    if (cond) {
      conditions.push(cond);
    }
  }

  const rows = await db
    .select()
    .from(contactInteractions)
    .where(and(...conditions))
    .orderBy(desc(contactInteractions.createdAt), desc(contactInteractions.id))
    .limit(limit + 1);

  const items = rows.map(mapRecordToInteraction);
  return buildPage(items, limit, (item) => item.createdAt.toISOString());
}

// ── COMPLETE FOLLOW-UP ───────────────────────────────────────────────────────

export async function completeFollowUp(
  db: Db,
  interactionId: string,
  orgId: string,
  userId: string,
  options: {
    completedAt?: Date | undefined;
    actorContext?: { ip?: string | undefined; userAgent?: string | undefined } | undefined;
  } = {},
): Promise<ContactInteractionRecord> {
  const existingRows = await db
    .select()
    .from(contactInteractions)
    .where(
      and(eq(contactInteractions.id, interactionId), eq(contactInteractions.organizationId, orgId)),
    )
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    throw new NotFoundError("Interaction not found");
  }

  const completedAt = options.completedAt ?? new Date();

  const updatedRows = await db
    .update(contactInteractions)
    .set({
      followUpStatus: "completed",
      followUpCompletedAt: completedAt,
    })
    .where(
      and(eq(contactInteractions.id, interactionId), eq(contactInteractions.organizationId, orgId)),
    )
    .returning();

  const updatedRow = updatedRows[0];
  if (!updatedRow) {
    throw new Error("Failed to complete follow up");
  }
  const updated = mapRecordToInteraction(updatedRow as unknown as Record<string, unknown>);

  await writeAuditLog({
    db,
    module: "core",
    action: "contact.followup_completed",
    organizationId: orgId,
    actorId: userId,
    actorType: "user",
    resourceId: interactionId,
    metadata: {
      contactId: updated.contactId,
      completedAt: completedAt.toISOString(),
    },
    actorIp: options.actorContext?.ip,
    actorUserAgent: options.actorContext?.userAgent,
  });

  return updated;
}
