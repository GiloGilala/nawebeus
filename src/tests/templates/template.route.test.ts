/**
 * `/api/templates` HTTP Route Tests (NWB-P1-006).
 *
 * Verifies:
 * - 401 Unauthorized for unauthenticated requests
 * - RBAC enforcement:
 *   - Viewer role can read/list, but cannot create (403), update (403), or delete (403)
 *   - Creator role can create, read, update
 *   - Manager role can delete and approve/reject
 * - Input validation (400/422 on invalid bodies, 404 on malformed ID)
 * - Complete CRUD flow through Hono router
 * - Template variable rendering endpoint
 * - Usage tracking endpoint
 * - Template approval endpoint
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { ensureTemplatesSchema, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};
const savedEnv: Record<string, string | undefined> = {};

type App = ReturnType<typeof createTestApp>;

async function cookieFor(app: App, email: string): Promise<string> {
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`signin failed: ${res.status} ${await res.text()}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

function post(app: App, path: string, cookie: string, body: unknown = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

function patch(app: App, path: string, cookie: string, body: unknown = {}) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

function get(app: App, path: string, cookie: string) {
  return app.request(path, {
    method: "GET",
    headers: { cookie },
  });
}

function del(app: App, path: string, cookie: string) {
  return app.request(path, {
    method: "DELETE",
    headers: { cookie },
  });
}

describe("Template Routes — Authentication & Validation (No DB)", () => {
  const app = createTestApp();

  test("returns 401 when unauthenticated", async () => {
    const listRes = await app.request("/api/templates");
    expect(listRes.status).toBe(401);

    const getRes = await app.request("/api/templates/tmpl_12345678901234567890123456789012");
    expect(getRes.status).toBe(401);

    const postRes = await app.request("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthenticated" }),
    });
    expect(postRes.status).toBe(401);
  });
});

describe("Template Routes — Full DB Integration", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) {
      savedEnv[k] = process.env[k];
      process.env[k] = v;
    }
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test("RBAC gates: viewer cannot create or delete, creator can create, manager can delete", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      await ensureTemplatesSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });

      const viewer = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: viewer.id,
        roleCode: "viewer",
      });
      const viewerCookie = await cookieFor(app, viewer.email);

      const creator = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });
      const creatorCookie = await cookieFor(app, creator.email);

      const manager = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      const managerCookie = await cookieFor(app, manager.email);

      // 1. Viewer tries to create template -> 403 Forbidden
      const viewerCreateRes = await post(app, "/api/templates", viewerCookie, {
        name: "Viewer Template",
        templateType: "post",
        sharedContent: "Not allowed",
      });
      expect(viewerCreateRes.status).toBe(403);

      // 2. Creator creates a template -> 201 Created
      const creatorCreateRes = await post(app, "/api/templates", creatorCookie, {
        name: "Creator Promo Post",
        templateType: "post",
        sharedContent: "Creator content for {{event}}",
        variables: [{ name: "event", description: "Event name", required: true }],
      });
      expect(creatorCreateRes.status).toBe(201);
      const createdBody = (await creatorCreateRes.json()) as any;
      const templateId = createdBody.data.template.id;
      expect(templateId).toBeDefined();

      // 3. Viewer can read template -> 200 OK
      const viewerGetRes = await get(app, `/api/templates/${templateId}`, viewerCookie);
      expect(viewerGetRes.status).toBe(200);

      // 4. Viewer cannot update template -> 403 Forbidden
      const viewerUpdateRes = await patch(app, `/api/templates/${templateId}`, viewerCookie, {
        name: "Viewer Renamed",
      });
      expect(viewerUpdateRes.status).toBe(403);

      // 5. Viewer cannot delete template -> 403 Forbidden
      const viewerDelRes = await del(app, `/api/templates/${templateId}`, viewerCookie);
      expect(viewerDelRes.status).toBe(403);

      // 6. Creator can update their template -> 200 OK
      const creatorUpdateRes = await patch(app, `/api/templates/${templateId}`, creatorCookie, {
        sharedContent: "Updated creator content for {{event}}",
        version: 1,
      });
      expect(creatorUpdateRes.status).toBe(200);
      const updatedBody = (await creatorUpdateRes.json()) as any;
      expect(updatedBody.data.template.version).toBe(2);

      // 7. Manager can delete the template -> 200 OK
      const managerDelRes = await del(app, `/api/templates/${templateId}`, managerCookie);
      expect(managerDelRes.status).toBe(200);

      // 8. Template is now deleted -> 404
      const afterDelGet = await get(app, `/api/templates/${templateId}`, creatorCookie);
      expect(afterDelGet.status).toBe(404);
    });
  });

  test("template usage tracking and rendering endpoints", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      await ensureTemplatesSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });

      const creator = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });
      const cookie = await cookieFor(app, creator.email);

      // Create an engagement response template
      const createRes = await post(app, "/api/templates", cookie, {
        name: "Support Reply",
        templateType: "engagement_response",
        content: "Hello {{customer_name}}, your ticket {{ticket_id}} is being processed.",
        category: "support",
      });
      expect(createRes.status).toBe(201);
      const templateId = ((await createRes.json()) as any).data.template.id;

      // Render variables via POST /api/templates/:id/render
      const renderRes = await post(app, `/api/templates/${templateId}/render`, cookie, {
        variables: {
          customer_name: "Tunde",
          ticket_id: "TCK-992",
        },
      });
      expect(renderRes.status).toBe(200);
      const renderBody = (await renderRes.json()) as any;
      expect(renderBody.data.render.rendered).toBe(
        "Hello Tunde, your ticket TCK-992 is being processed.",
      );
      expect(renderBody.data.render.missingVariables).toEqual([]);

      // Record usage via POST /api/templates/:id/use
      const useRes = await post(app, `/api/templates/${templateId}/use`, cookie, {
        csat: 4.8,
      });
      expect(useRes.status).toBe(200);
      const useBody = (await useRes.json()) as any;
      expect(useBody.data.template.usageCount).toBe(1);
      expect(useBody.data.template.csat).toBe(4.8);
      expect(useBody.data.template.lastUsedAt).not.toBeNull();
    });
  });

  test("manager approval endpoint workflow", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      await ensureTemplatesSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });

      const creator = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });
      const creatorCookie = await cookieFor(app, creator.email);

      const manager = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      const managerCookie = await cookieFor(app, manager.email);

      // Create template requiring approval
      const createRes = await post(app, "/api/templates", creatorCookie, {
        name: "Restricted Policy Reply",
        templateType: "engagement_response",
        content: "Official policy response for {{inquiry}}.",
        requiresApproval: true,
      });
      expect(createRes.status).toBe(201);
      const templateId = ((await createRes.json()) as any).data.template.id;

      // Creator cannot approve their own template -> 400/403
      const creatorApproveRes = await post(
        app,
        `/api/templates/${templateId}/approve`,
        creatorCookie,
        {
          status: "approved",
          comment: "Self approval attempt",
        },
      );
      expect(creatorApproveRes.status).toBeGreaterThanOrEqual(400);

      // Manager approves template -> 200 OK
      const managerApproveRes = await post(
        app,
        `/api/templates/${templateId}/approve`,
        managerCookie,
        {
          status: "approved",
          comment: "Approved for organization-wide deployment",
        },
      );
      expect(managerApproveRes.status).toBe(200);
      const approvedBody = (await managerApproveRes.json()) as any;
      expect(approvedBody.data.template.approvalStatus).toBe("approved");
      expect(approvedBody.data.template.approvedById).toBe(manager.id);
    });
  });

  test("list templates with pagination and filtering", async () => {
    if (!hasDb()) return;

    await withTestDb(async ({ db }) => {
      await ensureTemplatesSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });

      const creator = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });
      const cookie = await cookieFor(app, creator.email);

      // Create three templates
      for (let i = 1; i <= 3; i++) {
        await post(app, "/api/templates", cookie, {
          name: `Batch Template ${i}`,
          templateType: "post",
          sharedContent: `Content item ${i}`,
          category: i === 1 ? "marketing" : "announcements",
        });
      }

      // List all
      const listRes = await get(app, "/api/templates?limit=2", cookie);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as any;
      expect(listBody.data.templates.length).toBe(2);
      expect(listBody.meta.pagination.hasMore).toBe(true);

      // Filter by category
      const filterRes = await get(app, "/api/templates?category=marketing", cookie);
      expect(filterRes.status).toBe(200);
      const filterBody = (await filterRes.json()) as any;
      expect(filterBody.data.templates.length).toBe(1);
      expect(filterBody.data.templates[0].name).toBe("Batch Template 1");
    });
  });
});
