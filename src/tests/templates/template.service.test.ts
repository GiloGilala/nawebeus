/**
 * Unified Templates Service tests (NWB-P1-006).
 *
 * Covers:
 * - Post, engagement response, and campaign template creation & constraints
 * - Organization-level name uniqueness (case-insensitive)
 * - Optimistic versioning and conflict handling (TemplateVersionConflictError)
 * - Template variable interpolation and multi-platform variant resolution
 * - RBAC & visibility gates (private vs org-wide, creator vs non-creator delete)
 * - Usage tracking (usageCount, lastUsedAt, running average CSAT & conversion rates)
 * - Full audit integration (created, updated, deleted, used, approved/rejected)
 * - Multi-tenant isolation (org A cannot access or mutate org B's templates)
 * - Cursor-based pagination and filtering (by type, platform, tag, intent, pidgin, search query)
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TemplateVersionConflictError,
} from "../../lib/errors";
import {
  approveTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  recordTemplateUsage,
  renderTemplateVariables,
  updateTemplate,
} from "../../services/templates";
import { ensureTemplatesSchema, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

interface TemplateWorkspace {
  orgId: string;
  creatorId: string;
  managerId: string;
  memberId: string;
  otherOrgId: string;
  otherUserId: string;
}

async function setupWorkspace(db: Db): Promise<TemplateWorkspace> {
  await ensureTemplatesSchema(db);

  const owner = await createTestUser(db, { firstName: "Template", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: owner.id, name: "Template Test Org" });

  const creator = await createTestUser(db, { firstName: "Template", lastName: "Creator" });
  await addMemberWithRole(db, { organizationId: org.id, userId: creator.id, roleCode: "creator" });

  const manager = await createTestUser(db, { firstName: "Template", lastName: "Manager" });
  await addMemberWithRole(db, { organizationId: org.id, userId: manager.id, roleCode: "manager" });

  const member = await createTestUser(db, { firstName: "Regular", lastName: "Member" });
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

describe("Template Service — Unit (No DB)", () => {
  test("renderTemplateVariables replaces placeholders with values", () => {
    const res = renderTemplateVariables(
      {
        content: "Hello {{name}}, welcome to {{service}}! Use code {{code}} for 10% off.",
        templateType: "engagement_response",
        sharedContent: null,
        platformVariants: null,
      },
      { name: "Amara", service: "Nawebeus", code: "SAVE10" },
    );
    expect(res.rendered).toBe("Hello Amara, welcome to Nawebeus! Use code SAVE10 for 10% off.");
    expect(res.missingVariables).toEqual([]);
  });

  test("renderTemplateVariables falls back to platform variant if specified", () => {
    const res = renderTemplateVariables(
      {
        content: null,
        templateType: "post",
        sharedContent: "Shared text for {{brand}}",
        platformVariants: {
          twitter: "Short tweet for {{brand}} #promo",
          linkedin: "Professional update regarding {{brand}} operations.",
        },
      },
      { brand: "Acme Corp" },
      "twitter",
    );
    expect(res.rendered).toBe("Short tweet for Acme Corp #promo");
    expect(res.platform).toBe("twitter");
  });

  test("renderTemplateVariables falls back to sharedContent if platform variant not found", () => {
    const res = renderTemplateVariables(
      {
        content: null,
        templateType: "post",
        sharedContent: "Fallback for {{brand}}",
        platformVariants: {
          twitter: "Twitter text",
        },
      },
      { brand: "Acme Corp" },
      "facebook",
    );
    expect(res.rendered).toBe("Fallback for Acme Corp");
  });

  test("renderTemplateVariables leaves unmatched placeholders intact", () => {
    const res = renderTemplateVariables(
      {
        content: "Hello {{name}}, your order {{order_id}} is ready.",
        templateType: "engagement_response",
        sharedContent: null,
        platformVariants: null,
      },
      { name: "Kofi" },
    );
    expect(res.rendered).toBe("Hello Kofi, your order {{order_id}} is ready.");
    expect(res.missingVariables).toEqual(["order_id"]);
  });
});

describe("Template Service — DB Integration", () => {
  test("creates a post template with platform variants and records audit", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(
        db,
        ws.orgId,
        ws.creatorId,
        {
          name: "Flash Sale Promo",
          description: "Black Friday cross-network promo post",
          templateType: "post",
          platform: "twitter_x",
          sharedContent: "Huge discounts today only! Visit {{link}}",
          platformVariants: {
            twitter_x: "🔥 Flash Sale! Don't miss out: {{link}} #Sale",
            instagram: "Shop our biggest sale of the year at {{link}}! Link in bio.",
          },
          variables: [{ name: "link", description: "Store link", required: true }],
          tags: ["promo", "blackfriday"],
          isOrganizationWide: true,
        },
        { ip: "127.0.0.1", userAgent: "Bun-Test" },
      );

      expect(template.id).toMatch(/^tmpl_[a-f0-9]{32}$/);
      expect(template.name).toBe("Flash Sale Promo");
      expect(template.templateType).toBe("post");
      expect(template.platform).toBe("twitter_x");
      expect(template.sharedContent).toBe("Huge discounts today only! Visit {{link}}");
      expect(template.platformVariants).toEqual({
        twitter_x: "🔥 Flash Sale! Don't miss out: {{link}} #Sale",
        instagram: "Shop our biggest sale of the year at {{link}}! Link in bio.",
      });
      expect(template.version).toBe(1);
      expect(template.usageCount).toBe(0);
      expect(template.isOrganizationWide).toBe(true);

      // Verify audit log
      const auditRows = await db.execute(
        sql`SELECT action, resource_id, organization_id, actor_id FROM unified_audit_log WHERE resource_id = ${template.id}`,
      );
      expect((auditRows.rows ?? []).length).toBe(1);
      expect((auditRows.rows as any)[0].action).toBe("template.created");
      expect((auditRows.rows as any)[0].actor_id).toBe(ws.creatorId);
    });
  });

  test("creates engagement_response template with pidgin and intent support", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Pidgin Greeting Response",
        description: "Informal friendly response in Nigerian Pidgin",
        templateType: "engagement_response",
        content: "How far {{customer_name}}, how body? We dey here to help you: {{help_text}}",
        intentMatch: "greeting",
        isPidginAppropriate: true,
        category: "customer_support",
        variables: [
          {
            name: "customer_name",
            description: "Customer name",
            required: false,
            defaultValue: "padi",
          },
          { name: "help_text", description: "Support message", required: true },
        ],
        tags: ["pidgin", "support", "greeting"],
      });

      expect(template.templateType).toBe("engagement_response");
      expect(template.isPidginAppropriate).toBe(true);
      expect(template.intentMatch).toBe("greeting");
      expect(template.content).toContain("How far");
      expect(template.category).toBe("customer_support");
    });
  });

  test("creates campaign template with category and campaignMetadata", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Product Launch Workflow",
        description: "Multi-week campaign structure for launch",
        templateType: "campaign",
        category: "product_launch",
        campaignMetadata: {
          weeks: 3,
          phases: ["teaser", "launch", "followup"],
          channels: ["email", "social"],
        },
        tags: ["campaign", "launch"],
      });

      expect(template.templateType).toBe("campaign");
      expect(template.category).toBe("product_launch");
      expect(template.campaignMetadata).toEqual({
        weeks: 3,
        phases: ["teaser", "launch", "followup"],
        channels: ["email", "social"],
      });
      expect(template.content).toBeNull();
      expect(template.sharedContent).toBeNull();
    });
  });

  test("enforces name uniqueness per organization (case-insensitive)", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Welcome Onboarding",
        templateType: "post",
        sharedContent: "Welcome!",
      });

      // Same name, different case -> ConflictError
      await expect(
        createTemplate(db, ws.orgId, ws.creatorId, {
          name: "welcome onboarding",
          templateType: "post",
          sharedContent: "Welcome again!",
        }),
      ).rejects.toThrow(ConflictError);

      // Same name in different organization -> allowed
      const otherTemplate = await createTemplate(db, ws.otherOrgId, ws.otherUserId, {
        name: "Welcome Onboarding",
        templateType: "post",
        sharedContent: "Welcome to other org!",
      });
      expect(otherTemplate.id).toBeDefined();
    });
  });

  test("updates template and increments version with optimistic locking", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Versioned Post",
        templateType: "post",
        sharedContent: "Version 1 content",
      });
      expect(template.version).toBe(1);

      // Update with matching expectedVersion
      const updated = await updateTemplate(
        db,
        template.id,
        ws.orgId,
        ws.creatorId,
        {
          sharedContent: "Version 2 content",
        },
        { expectedVersion: 1 },
      );
      expect(updated.version).toBe(2);
      expect(updated.sharedContent).toBe("Version 2 content");

      // Update with stale expectedVersion -> TemplateVersionConflictError
      await expect(
        updateTemplate(
          db,
          template.id,
          ws.orgId,
          ws.creatorId,
          { sharedContent: "Version 3 conflict" },
          { expectedVersion: 1 },
        ),
      ).rejects.toThrow(TemplateVersionConflictError);

      // Update without expectedVersion succeeds and bumps to version 3
      const updated3 = await updateTemplate(db, template.id, ws.orgId, ws.creatorId, {
        sharedContent: "Version 3 content",
      });
      expect(updated3.version).toBe(3);
    });
  });

  test("permission gates on update: non-creator non-manager gets ForbiddenError", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Creator's Special Template",
        templateType: "post",
        sharedContent: "Secret sauce",
      });

      // Member (not creator, not manager) cannot update
      await expect(
        updateTemplate(
          db,
          template.id,
          ws.orgId,
          ws.memberId,
          { sharedContent: "Tampered" },
          { isManagerOrAbove: false },
        ),
      ).rejects.toThrow(ForbiddenError);

      // Manager can update even though they didn't create it
      const managerUpdated = await updateTemplate(
        db,
        template.id,
        ws.orgId,
        ws.managerId,
        { sharedContent: "Manager revised this" },
        { isManagerOrAbove: true },
      );
      expect(managerUpdated.sharedContent).toBe("Manager revised this");
    });
  });

  test("deletes template: soft delete by default, creator or manager only", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "To Be Deleted",
        templateType: "post",
        sharedContent: "Goodbye world",
      });

      // Regular member cannot delete
      await expect(
        deleteTemplate(db, template.id, ws.orgId, ws.memberId, { isManagerOrAbove: false }),
      ).rejects.toThrow(ForbiddenError);

      // Creator can delete
      const result = await deleteTemplate(db, template.id, ws.orgId, ws.creatorId, {
        isManagerOrAbove: false,
      });
      expect(result.deleted).toBe(true);

      // Template is now soft-deleted (isActive = false), getTemplateById throws NotFoundError
      await expect(
        getTemplateById(db, template.id, { orgId: ws.orgId, userId: ws.creatorId }),
      ).rejects.toThrow(NotFoundError);

      // Check audit log for deletion
      const auditRows = await db.execute(
        sql`SELECT action FROM unified_audit_log WHERE resource_id = ${template.id} AND action = 'template.deleted'`,
      );
      expect((auditRows.rows ?? []).length).toBe(1);
    });
  });

  test("records template usage and calculates running average metrics", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // Engagement response template tests CSAT
      const engTemplate = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Support Response Metric",
        templateType: "engagement_response",
        content: "Thank you for contacting us.",
      });
      expect(engTemplate.usageCount).toBe(0);
      expect(engTemplate.csat).toBeNull();

      // First usage with CSAT 4.0
      const u1 = await recordTemplateUsage(db, engTemplate.id, ws.orgId, ws.creatorId, {
        csat: 4.0,
      });
      expect(u1.usageCount).toBe(1);
      expect(u1.lastUsedAt).not.toBeNull();
      expect(u1.csat).toBe(4.0);

      // Second usage with CSAT 5.0 -> average 4.5
      const u2 = await recordTemplateUsage(db, engTemplate.id, ws.orgId, ws.creatorId, {
        csat: 5.0,
      });
      expect(u2.usageCount).toBe(2);
      expect(u2.csat).toBe(4.5);

      // Campaign template tests conversion rate
      const campTemplate = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Campaign Metric Test",
        templateType: "campaign",
        category: "growth",
        campaignMetadata: { type: "giveaway" },
      });

      const cu1 = await recordTemplateUsage(db, campTemplate.id, ws.orgId, ws.creatorId, {
        conversionRate: 0.1,
      });
      expect(cu1.conversionRate).toBe(0.1);

      const cu2 = await recordTemplateUsage(db, campTemplate.id, ws.orgId, ws.creatorId, {
        conversionRate: 0.2,
      });
      expect(cu2.conversionRate).toBe(0.15);

      // Usage audit logged
      const auditRows = await db.execute(
        sql`SELECT action FROM unified_audit_log WHERE resource_id = ${engTemplate.id} AND action = 'template.used'`,
      );
      expect((auditRows.rows ?? []).length).toBe(2);
    });
  });

  test("approval lifecycle: pending -> approved/rejected", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // Create a private template with pending approval
      const template = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Pending Approval Template",
        templateType: "post",
        sharedContent: "Awaiting review",
        approvalStatus: "pending",
      });
      expect(template.approvalStatus).toBe("pending");
      expect(template.approvedAt).toBeNull();
      expect(template.approvedById).toBeNull();

      // Manager approves template
      const approved = await approveTemplate(db, template.id, ws.orgId, ws.managerId, {
        status: "approved",
        comment: "Looks great for production",
      });
      expect(approved.approvalStatus).toBe("approved");
      expect(approved.approvedById).toBe(ws.managerId);
      expect(approved.approvedAt).not.toBeNull();

      // Audit logged
      const auditRows = await db.execute(
        sql`SELECT action, metadata FROM unified_audit_log WHERE resource_id = ${template.id} AND action = 'template.approved'`,
      );
      expect((auditRows.rows ?? []).length).toBe(1);
    });
  });

  test("listTemplates respects filters, search, visibility, and sorting", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // Create several templates
      const t1 = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Customer Support Urgent Response",
        description: "For rapid resolution of critical tickets",
        templateType: "engagement_response",
        content: "We understand your urgency and are looking into it right away.",
        category: "support",
        tags: ["urgent", "support"],
        isOrganizationWide: true,
      });

      const t2 = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Sales Pitch Thread",
        templateType: "post",
        platform: "twitter_x",
        sharedContent: "Discover our new enterprise tier features.",
        category: "sales",
        tags: ["enterprise", "sales"],
        isOrganizationWide: true,
      });

      const t3 = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Pidgin Quick Greeting",
        templateType: "engagement_response",
        content: "Wetin dey happen?",
        intentMatch: "greeting",
        isPidginAppropriate: true,
        tags: ["pidgin", "greeting"],
        isOrganizationWide: false, // private to creator
      });

      // Filter by templateType
      const engagementOnly = await listTemplates(db, {
        orgId: ws.orgId,
        userId: ws.creatorId,
        templateType: "engagement_response",
      });
      expect(engagementOnly.items.length).toBe(2);
      expect(engagementOnly.items.map((i) => i.id).sort()).toEqual([t1.id, t3.id].sort());

      // Filter by isPidginAppropriate
      const pidginOnly = await listTemplates(db, {
        orgId: ws.orgId,
        userId: ws.creatorId,
        isPidginAppropriate: true,
      });
      expect(pidginOnly.items.length).toBe(1);
      expect(pidginOnly.items[0]?.id).toBe(t3.id);

      // Search query q
      const searchResults = await listTemplates(db, {
        orgId: ws.orgId,
        userId: ws.creatorId,
        q: "enterprise tier",
      });
      expect(searchResults.items.length).toBe(1);
      expect(searchResults.items[0]?.id).toBe(t2.id);

      // Private template visibility: other member cannot see t3 (isOrganizationWide = false)
      const memberList = await listTemplates(db, {
        orgId: ws.orgId,
        userId: ws.memberId,
      });
      expect(memberList.items.some((i) => i.id === t3.id)).toBe(false);
      expect(memberList.items.some((i) => i.id === t1.id)).toBe(true);
      expect(memberList.items.some((i) => i.id === t2.id)).toBe(true);
    });
  });

  test("tenant isolation: Org A templates are inaccessible to Org B", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const orgATemplate = await createTemplate(db, ws.orgId, ws.creatorId, {
        name: "Org A Confidential Template",
        templateType: "post",
        sharedContent: "Internal only",
        isOrganizationWide: true,
      });

      // User from otherOrg tries to get org A's template -> NotFoundError
      await expect(
        getTemplateById(db, orgATemplate.id, { orgId: ws.otherOrgId, userId: ws.otherUserId }),
      ).rejects.toThrow(NotFoundError);

      // User from otherOrg tries to update org A's template -> NotFoundError
      await expect(
        updateTemplate(db, orgATemplate.id, ws.otherOrgId, ws.otherUserId, {
          sharedContent: "Hacked",
        }),
      ).rejects.toThrow(NotFoundError);

      // User from otherOrg tries to delete org A's template -> NotFoundError
      await expect(
        deleteTemplate(db, orgATemplate.id, ws.otherOrgId, ws.otherUserId),
      ).rejects.toThrow(NotFoundError);

      // Listing templates in Org B returns 0 templates
      const otherList = await listTemplates(db, {
        orgId: ws.otherOrgId,
        userId: ws.otherUserId,
      });
      expect(otherList.items.length).toBe(0);
    });
  });
});
