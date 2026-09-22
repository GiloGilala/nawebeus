/**
 * TanStack Start Server Functions — Templates domain
 *
 * Thin adapters: validate with shared Zod schemas, derive orgId & userId from
 * the session (never the payload), assert CASL abilities, and delegate to services.
 */

import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  recordUsageSchema,
  renderTemplateSchema,
  templateIdSchema,
  updateTemplateSchema,
} from "@/lib/validation";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  recordTemplateUsage,
  renderTemplateVariables,
  updateTemplate,
} from "@/services/templates";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

export const createTemplateServerFn = createServerFn({ method: "POST" })
  .validator(createTemplateSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createTemplateSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "templates");
    const db = getServerDb();

    const created = await withServerOrgContext(auth, () =>
      createTemplate(db, auth.orgId, auth.userId, parsed),
    );
    return { template: created };
  });

export const listTemplatesServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listTemplatesQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listTemplatesQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "templates");
    const db = getServerDb();

    const result = await withServerOrgContext(auth, () =>
      listTemplates(db, {
        orgId: auth.orgId,
        userId: auth.userId,
        templateType: parsed.templateType,
        platform: parsed.platform,
        category: parsed.category,
        categoryPath: parsed.categoryPath,
        intentMatch: parsed.intentMatch,
        isPidginAppropriate: parsed.isPidginAppropriate,
        tag: parsed.tag,
        q: parsed.q,
        visibility: parsed.visibility,
        approvalStatus: parsed.approvalStatus,
        isActive: parsed.isActive,
        sort: parsed.sort,
        limit: parsed.limit,
      }),
    );
    return { templates: result.items, pageInfo: result.pageInfo };
  });

export const getTemplateServerFn = createServerFn({ method: "GET" })
  .validator(templateIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "templates");
    const db = getServerDb();

    const template = await withServerOrgContext(auth, () =>
      getTemplateById(db, parsed.id, { orgId: auth.orgId, userId: auth.userId }),
    );
    return { template };
  });

export const updateTemplateServerFn = createServerFn({ method: "POST" })
  .validator(templateIdSchema.and(updateTemplateSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof updateTemplateSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "templates");
    const db = getServerDb();

    const canDelete = auth.ability.can("delete", "templates");
    const { id, ...updateFields } = parsed;
    const updated = await withServerOrgContext(auth, () =>
      updateTemplate(db, id, auth.orgId, auth.userId, updateFields, {
        isManagerOrAbove: canDelete,
        ...(parsed.version !== undefined ? { expectedVersion: parsed.version } : {}),
      }),
    );
    return { template: updated };
  });

export const deleteTemplateServerFn = createServerFn({ method: "POST" })
  .validator(templateIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "templates");
    const db = getServerDb();

    const result = await withServerOrgContext(auth, () =>
      deleteTemplate(db, parsed.id, auth.orgId, auth.userId, {
        isManagerOrAbove: true,
      }),
    );
    return result;
  });

export const recordTemplateUsageServerFn = createServerFn({ method: "POST" })
  .validator(templateIdSchema.and(recordUsageSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string; csat?: number; conversionRate?: number };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "templates");
    const db = getServerDb();

    const updated = await withServerOrgContext(auth, () =>
      recordTemplateUsage(db, parsed.id, auth.orgId, auth.userId, {
        ...(parsed.csat !== undefined ? { csat: parsed.csat } : {}),
        ...(parsed.conversionRate !== undefined ? { conversionRate: parsed.conversionRate } : {}),
      }),
    );
    return { template: updated };
  });

export const renderTemplateServerFn = createServerFn({ method: "POST" })
  .validator(templateIdSchema.and(renderTemplateSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof renderTemplateSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "templates");
    const db = getServerDb();

    const template = await withServerOrgContext(auth, () =>
      getTemplateById(db, parsed.id, { orgId: auth.orgId, userId: auth.userId }),
    );

    const render = renderTemplateVariables(template, parsed.variables, parsed.platform);
    return { render };
  });
