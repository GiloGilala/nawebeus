/**
 * TanStack Start Server Functions Tests for Templates (NWB-P1-006).
 *
 * Tests in-process execution:
 * - createTemplateServerFn
 * - listTemplatesServerFn
 * - getTemplateServerFn
 * - updateTemplateServerFn
 * - deleteTemplateServerFn
 * - recordTemplateUsageServerFn
 * - renderTemplateServerFn
 */

import { describe, expect, test } from "bun:test";
import {
  createTemplateServerFn,
  deleteTemplateServerFn,
  getTemplateServerFn,
  listTemplatesServerFn,
  recordTemplateUsageServerFn,
  renderTemplateServerFn,
  updateTemplateServerFn,
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
import { ensureTemplatesSchema } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

describe("Template Server Functions — Validation (No DB)", () => {
  test("createTemplateServerFn with invalid type throws ValidationError", async () => {
    try {
      await createTemplateServerFn({
        data: {
          name: "Invalid Template",
          templateType: "unsupported_type" as any,
        },
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("getTemplateServerFn with invalid ID pattern throws ValidationError", async () => {
    try {
      await getTemplateServerFn({ data: { id: "not_a_valid_id" } });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });
});

describe.skipIf(!hasDb())("Template Server Functions — DB Integration", () => {
  test("full server function lifecycle with session cookie", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);

    try {
      await ensureTemplatesSchema(db);

      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });

      const creator = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "manager",
      });

      const config = getConfig();
      const accessToken = await signAccessToken(creator.id, org.id, config.JWT_ACCESS_SECRET);
      setServerHeadersForTest({ cookie: `nawebeus_access=${accessToken}` });

      // 1. Create template
      const createdRes = await createTemplateServerFn({
        data: {
          name: "SF Promotional Email",
          templateType: "email",
          content: "Welcome {{user_name}} to our platform!",
          variables: [{ name: "user_name", label: "User Name", required: true }],
          isOrganizationWide: true,
        },
      });
      expect(createdRes.template.id).toMatch(/^tmpl_/);
      expect(createdRes.template.name).toBe("SF Promotional Email");
      const templateId = createdRes.template.id;

      // 2. Get template
      const getRes = await getTemplateServerFn({ data: { id: templateId } });
      expect(getRes.template.id).toBe(templateId);

      // 3. List templates
      const listRes = await listTemplatesServerFn({ data: {} });
      expect(listRes.templates.some((t: any) => t.id === templateId)).toBe(true);

      // 4. Update template
      const updateRes = await updateTemplateServerFn({
        data: {
          id: templateId,
          content: "Updated: Welcome {{user_name}} to our platform!",
          version: 1,
        },
      });
      expect(updateRes.template.version).toBe(2);

      // 5. Render template
      const renderRes = await renderTemplateServerFn({
        data: {
          id: templateId,
          variables: { user_name: "Ade" },
        },
      });
      expect(renderRes.render.rendered).toBe("Updated: Welcome Ade to our platform!");

      // 6. Record usage
      const usageRes = await recordTemplateUsageServerFn({
        data: {
          id: templateId,
        },
      });
      expect(usageRes.template.usageCount).toBe(1);

      // 7. Delete template
      const delRes = await deleteTemplateServerFn({ data: { id: templateId } });
      expect(delRes.deleted).toBe(true);
    } finally {
      clearServerHeadersForTest();
      clearServerDbForTest();
      await done();
    }
  });
});
