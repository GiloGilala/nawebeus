/**
 * `/api/contacts` HTTP Route Tests (NWB-P1-007).
 *
 * Verifies:
 * - 401 Unauthorized for unauthenticated requests
 * - RBAC enforcement:
 *   - Viewer role can read/list, but cannot create (403), update (403), or delete (403)
 *   - Creator role can create, read, update, and log interactions (cannot delete: 403)
 *   - Manager role can delete contacts
 * - Input validation (400/422 on invalid bodies, 404 on malformed ID)
 * - Complete CRUD flow through Hono router
 * - Interaction logging & listing endpoints
 * - Follow-up completion endpoint
 * - Merge contact endpoint
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { ensureContactsSchema, withTestDb } from "../helpers/test-db";
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

describe.skipIf(!hasDb())("/api/contacts HTTP routes", () => {
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
      await ensureContactsSchema(db);
      const app = createTestApp(db);

      const res = await app.request("/api/contacts");
      expect(res.status).toBe(401);

      const postRes = await app.request("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "journalist", fullName: "Anonymous" }),
      });
      expect(postRes.status).toBe(401);
    });
  });

  test("RBAC: viewer can read, but cannot create, update, or delete", async () => {
    await withTestDb(async ({ db }) => {
      await ensureContactsSchema(db);
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

      // Creator creates a contact
      const createRes = await post(app, "/api/contacts", creatorCookie, {
        kind: "journalist",
        fullName: "Test Reporter",
        email: "test.reporter@example.com",
      });
      expect(createRes.status).toBe(201);
      const createdContact = ((await createRes.json()) as any).data.contact;

      // Viewer can read list
      const listRes = await get(app, "/api/contacts", viewerCookie);
      expect(listRes.status).toBe(200);

      // Viewer can get by ID
      const getRes = await get(app, `/api/contacts/${createdContact.id}`, viewerCookie);
      expect(getRes.status).toBe(200);

      // Viewer CANNOT create (403)
      const forbiddenCreate = await post(app, "/api/contacts", viewerCookie, {
        kind: "journalist",
        fullName: "Illegal Contact",
      });
      expect(forbiddenCreate.status).toBe(403);

      // Viewer CANNOT update (403)
      const forbiddenUpdate = await patch(app, `/api/contacts/${createdContact.id}`, viewerCookie, {
        fullName: "Illegal Update",
      });
      expect(forbiddenUpdate.status).toBe(403);

      // Viewer CANNOT delete (403)
      const forbiddenDelete = await del(app, `/api/contacts/${createdContact.id}`, viewerCookie);
      expect(forbiddenDelete.status).toBe(403);
    });
  });

  test("RBAC: creator cannot delete contacts (manager only)", async () => {
    await withTestDb(async ({ db }) => {
      await ensureContactsSchema(db);
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

      const createRes = await post(app, "/api/contacts", creatorCookie, {
        kind: "journalist",
        fullName: "Delete Target",
        email: "delete.target@example.com",
      });
      expect(createRes.status).toBe(201);
      const contact = ((await createRes.json()) as any).data.contact;

      // Creator fails to delete
      const creatorDel = await del(app, `/api/contacts/${contact.id}`, creatorCookie);
      expect(creatorDel.status).toBe(403);

      // Manager succeeds
      const managerDel = await del(app, `/api/contacts/${contact.id}`, managerCookie);
      expect(managerDel.status).toBe(200);
      const body = (await managerDel.json()) as any;
      expect(body.data.deleted).toBe(true);
    });
  });

  test("validates input bodies and path parameters", async () => {
    await withTestDb(async ({ db }) => {
      await ensureContactsSchema(db);
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

      // Missing fullName
      const invalidCreate = await post(app, "/api/contacts", cookie, {
        kind: "journalist",
      });
      expect(invalidCreate.status).toBe(422);

      // Invalid kind
      const invalidKind = await post(app, "/api/contacts", cookie, {
        kind: "invalid_kind",
        fullName: "Some Person",
      });
      expect(invalidKind.status).toBe(422);

      // Malformed ID path param
      const malformedGet = await get(app, "/api/contacts/not_valid_id", cookie);
      expect(malformedGet.status).toBe(404);
    });
  });

  test("full lifecycle: create, update, interaction, follow-up, merge, delete", async () => {
    await withTestDb(async ({ db }) => {
      await ensureContactsSchema(db);
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

      // 1. Create Target Contact
      const createRes1 = await post(app, "/api/contacts", cookie, {
        kind: "journalist",
        fullName: "Primary Reporter",
        email: "primary@example.com",
        location: "Lagos",
      });
      expect(createRes1.status).toBe(201);
      const targetContact = ((await createRes1.json()) as any).data.contact;

      // 2. Create Duplicate Contact
      const createRes2 = await post(app, "/api/contacts", cookie, {
        kind: "journalist",
        fullName: "Duplicate Reporter",
        email: "duplicate@example.com",
      });
      expect(createRes2.status).toBe(201);
      const sourceContact = ((await createRes2.json()) as any).data.contact;

      // 3. Update Contact
      const updateRes = await patch(app, `/api/contacts/${targetContact.id}`, cookie, {
        location: "Abuja",
        version: targetContact.version,
      });
      expect(updateRes.status).toBe(200);
      const updatedContact = ((await updateRes.json()) as any).data.contact;
      expect(updatedContact.location).toBe("Abuja");
      expect(updatedContact.version).toBe(2);

      // 4. Log Interaction
      const interactionRes = await post(
        app,
        `/api/contacts/${sourceContact.id}/interactions`,
        cookie,
        {
          interactionType: "phone_call",
          direction: "outbound",
          subject: "Initial call",
          followUpAt: new Date(Date.now() + 100000).toISOString(),
        },
      );
      expect(interactionRes.status).toBe(201);
      const interaction = ((await interactionRes.json()) as any).data.interaction;
      expect(interaction.followUpStatus).toBe("pending");

      // 5. Complete Follow-Up
      const completeRes = await post(
        app,
        `/api/contacts/interactions/${interaction.id}/complete-followup`,
        cookie,
        {},
      );
      expect(completeRes.status).toBe(200);
      const completedInteraction = ((await completeRes.json()) as any).data.interaction;
      expect(completedInteraction.followUpStatus).toBe("completed");

      // 6. Merge source into target
      const mergeRes = await post(app, `/api/contacts/${sourceContact.id}/merge`, cookie, {
        targetContactId: targetContact.id,
      });
      expect(mergeRes.status).toBe(200);

      // 7. List Interactions for target now includes the interaction from source
      const listInteractionsRes = await get(
        app,
        `/api/contacts/${targetContact.id}/interactions`,
        cookie,
      );
      expect(listInteractionsRes.status).toBe(200);
      const interactions = ((await listInteractionsRes.json()) as any).data.interactions;
      expect(interactions.length).toBe(1);
      expect(interactions[0].id).toBe(interaction.id);

      // 8. Delete Target Contact
      const deleteRes = await del(app, `/api/contacts/${targetContact.id}`, cookie);
      expect(deleteRes.status).toBe(200);
      expect(((await deleteRes.json()) as any).data.deleted).toBe(true);

      // 9. Confirm 404 after delete
      const getDeletedRes = await get(app, `/api/contacts/${targetContact.id}`, cookie);
      expect(getDeletedRes.status).toBe(404);
    });
  });
});
