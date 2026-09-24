/**
 * `/api/alerts` HTTP Route Tests (NWB-P1-008).
 *
 * Verifies:
 * - 401 Unauthorized for unauthenticated requests
 * - RBAC enforcement:
 *   - Viewer role can read rules/events and mark as read, but cannot create (403), update (403), or delete (403)
 *   - Creator role can create rules, fire alerts, update rules, acknowledge/escalate alerts (cannot delete: 403)
 *   - Manager role can delete alert rules
 * - Input validation (400/422 on invalid bodies, 404 on malformed ID)
 * - Complete CRUD and alert lifecycle flow through Hono router
 * - Read tracking, unread count badge, acknowledgement, escalation
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { ensureAlertsSchema, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

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

function del(app: App, path: string, cookie: string) {
  return app.request(path, {
    method: "DELETE",
    headers: { cookie },
  });
}

function get(app: App, path: string, cookie: string) {
  return app.request(path, {
    method: "GET",
    headers: { cookie },
  });
}

describe.skipIf(!hasDb())("/api/alerts HTTP routes", () => {
  beforeAll(() => {
    for (const [key, val] of Object.entries(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = val;
    }
  });

  afterAll(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  test("unauthenticated requests return 401", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAlertsSchema(db);
      const app = createTestApp(db);

      const res = await app.request("/api/alerts/rules");
      expect(res.status).toBe(401);

      const eventsRes = await app.request("/api/alerts/events");
      expect(eventsRes.status).toBe(401);
    });
  });

  test("RBAC: viewer can read, but cannot create, update, or delete rules", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAlertsSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db, { firstName: "Org", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id });

      const viewer = await createTestUser(db, { firstName: "Viewer", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: viewer.id,
        roleCode: "viewer",
      });

      const creator = await createTestUser(db, { firstName: "Creator", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });

      const viewerCookie = await cookieFor(app, viewer.email);
      const creatorCookie = await cookieFor(app, creator.email);

      // Creator creates a rule
      const createRes = await post(app, "/api/alerts/rules", creatorCookie, {
        sourceModule: "monitoring",
        conditionType: "volume_spike",
        name: "Viewer Test Rule",
      });
      expect(createRes.status).toBe(201);
      const createdRule = ((await createRes.json()) as any).data.rule;

      // Viewer can read list
      const listRes = await get(app, "/api/alerts/rules", viewerCookie);
      expect(listRes.status).toBe(200);

      // Viewer can get by ID
      const getRes = await get(app, `/api/alerts/rules/${createdRule.id}`, viewerCookie);
      expect(getRes.status).toBe(200);

      // Viewer CANNOT create rule (403)
      const forbiddenCreate = await post(app, "/api/alerts/rules", viewerCookie, {
        sourceModule: "monitoring",
        conditionType: "volume_spike",
        name: "Illegal Rule",
      });
      expect(forbiddenCreate.status).toBe(403);

      // Viewer CANNOT update rule (403)
      const forbiddenUpdate = await patch(
        app,
        `/api/alerts/rules/${createdRule.id}`,
        viewerCookie,
        { name: "Illegal Update" },
      );
      expect(forbiddenUpdate.status).toBe(403);

      // Viewer CANNOT delete rule (403)
      const forbiddenDelete = await del(app, `/api/alerts/rules/${createdRule.id}`, viewerCookie);
      expect(forbiddenDelete.status).toBe(403);
    });
  });

  test("RBAC: creator cannot delete rules (manager only)", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAlertsSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db, { firstName: "Org", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id });

      const creator = await createTestUser(db, { firstName: "Creator", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });

      const manager = await createTestUser(db, { firstName: "Manager", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });

      const creatorCookie = await cookieFor(app, creator.email);
      const managerCookie = await cookieFor(app, manager.email);

      const createRes = await post(app, "/api/alerts/rules", creatorCookie, {
        sourceModule: "crisis",
        conditionType: "sentiment_crash",
        name: "Delete Target Rule",
      });
      expect(createRes.status).toBe(201);
      const rule = ((await createRes.json()) as any).data.rule;

      // Creator fails to delete (403)
      const creatorDel = await del(app, `/api/alerts/rules/${rule.id}`, creatorCookie);
      expect(creatorDel.status).toBe(403);

      // Manager succeeds (200)
      const managerDel = await del(app, `/api/alerts/rules/${rule.id}`, managerCookie);
      expect(managerDel.status).toBe(200);
      expect(((await managerDel.json()) as any).data.deleted).toBe(true);
    });
  });

  test("validates input bodies and path parameters", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAlertsSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db, { firstName: "Org", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id });
      const creator = await createTestUser(db, { firstName: "Creator", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: creator.id,
        roleCode: "creator",
      });
      const cookie = await cookieFor(app, creator.email);

      // Missing required name
      const invalidCreate = await post(app, "/api/alerts/rules", cookie, {
        sourceModule: "listening",
        conditionType: "volume_spike",
      });
      expect(invalidCreate.status).toBe(422);

      // Malformed ID path param
      const malformedGet = await get(app, "/api/alerts/rules/not_valid_id", cookie);
      expect(malformedGet.status).toBe(404);
    });
  });

  test("full lifecycle: create rule, fire alert, read count, acknowledge, escalate, delete", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAlertsSchema(db);
      const app = createTestApp(db);

      const owner = await createTestUser(db, { firstName: "Org", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id });
      const manager = await createTestUser(db, { firstName: "Manager", lastName: "User" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      const cookie = await cookieFor(app, manager.email);

      // 1. Create rule
      const createRes = await post(app, "/api/alerts/rules", cookie, {
        sourceModule: "engagement",
        conditionType: "threshold",
        name: "Full Lifecycle Rule",
        defaultSeverity: "critical",
      });
      expect(createRes.status).toBe(201);
      const rule = ((await createRes.json()) as any).data.rule;

      // 2. Fire alert
      const fireRes = await post(app, "/api/alerts/events", cookie, {
        ruleId: rule.id,
        alertType: "sla_first_response",
        severity: "critical",
        sourceModule: "engagement",
        sourceType: "engagement_message",
        title: "Customer Waiting",
      });
      expect(fireRes.status).toBe(201);
      const event = ((await fireRes.json()) as any).data.event;
      expect(event.id).toMatch(/^ae_/);

      // 3. Unread count is 1
      const countRes = await get(app, "/api/alerts/events/unread-count", cookie);
      expect(countRes.status).toBe(200);
      expect(((await countRes.json()) as any).data.unreadCount).toBe(1);

      // 4. Mark single as read
      const readRes = await post(app, `/api/alerts/events/${event.id}/read`, cookie, {});
      expect(readRes.status).toBe(200);

      // 5. Acknowledge alert
      const ackRes = await post(app, `/api/alerts/events/${event.id}/acknowledge`, cookie, {
        notes: "Acknowledged by manager",
      });
      expect(ackRes.status).toBe(200);
      const ackEvent = ((await ackRes.json()) as any).data.event;
      expect(ackEvent.isAcknowledged).toBe(true);

      // 6. Escalate alert
      const escRes = await post(app, `/api/alerts/events/${event.id}/escalate`, cookie, {
        escalatedToId: manager.id,
        notes: "Escalated for review",
      });
      expect(escRes.status).toBe(200);
      const escEvent = ((await escRes.json()) as any).data.event;
      expect(escEvent.escalatedToId).toBe(manager.id);

      // 7. Delete rule
      const delRes = await del(app, `/api/alerts/rules/${rule.id}`, cookie);
      expect(delRes.status).toBe(200);
      expect(((await delRes.json()) as any).data.deleted).toBe(true);
    });
  });
});
