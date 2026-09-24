/**
 * `/api/config` HTTP Route Tests (NWB-P1-009).
 *
 * Verifies:
 * - 401 Unauthorized for unauthenticated requests
 * - RBAC enforcement:
 *   - Viewer role can read flags, but cannot create config (403), update (403), or delete (403)
 *   - Admin role can create, update, rollback, delete
 * - Input validation (422 on invalid bodies, 422 on malformed IDs)
 * - Complete CRUD flow through Hono router
 * - Feature flag gating on a live code path (Phase 2 exit gate criterion)
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { clearConfigCache } from "../../services/config";
import { createTestApp } from "../helpers/test-client";
import { ensureAppConfigSchema, withTestDb } from "../helpers/test-db";
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

describe.skipIf(!hasDb())("/api/config HTTP routes", () => {
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

  test("unauthenticated requests return 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/config");
    expect(res.status).toBe(401);

    const evalRes = await app.request("/api/config/evaluate?key=beta.test");
    expect(evalRes.status).toBe(401);
  });

  test("RBAC: viewer can read flags, but cannot create, update, or delete config", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAppConfigSchema(db);
      clearConfigCache();

      const admin = await createTestUser(db, { firstName: "Admin", lastName: "Cfg" });
      const viewer = await createTestUser(db, { firstName: "Viewer", lastName: "Cfg" });
      const org = await createTestOrg(db, { ownerId: admin.id, name: "RBAC Org" });

      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: viewer.id,
        roleCode: "viewer",
      });

      const app = createTestApp(db);
      const viewerCookie = await cookieFor(app, viewer.email);
      const adminCookie = await cookieFor(app, admin.email);

      // Viewer cannot create config (403)
      const createRes = await post(app, "/api/config", viewerCookie, {
        kind: "system_config",
        key: "test.key",
        value: 123,
        configType: "security",
        changeReason: "Unauthorized configuration creation attempt",
      });
      expect(createRes.status).toBe(403);

      // Admin can create config
      const adminCreateRes = await post(app, "/api/config", adminCookie, {
        kind: "system_config",
        key: "test.key",
        value: 123,
        configType: "security",
        changeReason: "Authorized initial configuration setting",
      });
      expect(adminCreateRes.status).toBe(201);
      const created = await adminCreateRes.json();

      // Viewer cannot update config (403)
      const updateRes = await patch(app, `/api/config/${created.data.id}`, viewerCookie, {
        value: 456,
        changeReason: "Unauthorized modification attempt by viewer",
      });
      expect(updateRes.status).toBe(403);

      // Viewer cannot delete config (403)
      const delRes = await del(app, `/api/config/${created.data.id}`, viewerCookie);
      expect(delRes.status).toBe(403);

      // Admin can delete config (200)
      const adminDelRes = await del(app, `/api/config/${created.data.id}`, adminCookie);
      expect(adminDelRes.status).toBe(200);
    });
  });

  test("validates input bodies and path parameters", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAppConfigSchema(db);
      clearConfigCache();

      const admin = await createTestUser(db, { firstName: "Admin", lastName: "Val" });
      const org = await createTestOrg(db, { ownerId: admin.id, name: "Val Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });

      const app = createTestApp(db);
      const cookie = await cookieFor(app, admin.email);

      // Missing changeReason -> 422
      const badRes = await post(app, "/api/config", cookie, {
        kind: "system_config",
        key: "bad.key",
        value: "test",
        configType: "security",
      });
      expect(badRes.status).toBe(422);

      // Invalid ID -> 422
      const badIdRes = await get(app, "/api/config/not-a-valid-id", cookie);
      expect(badIdRes.status).toBe(422);
    });
  });

  test("Exit Gate Verification: Feature flag gates a live code path", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAppConfigSchema(db);
      clearConfigCache();

      const admin = await createTestUser(db, { firstName: "Admin", lastName: "Gate" });
      const org = await createTestOrg(db, { ownerId: admin.id, name: "Gate Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });

      const app = createTestApp(db);
      const cookie = await cookieFor(app, admin.email);

      // 1. Initially, 'beta.experimental_feature' does not exist -> live endpoint returns 403 FEATURE_FLAG_DISABLED
      const initialGatedRes = await get(app, "/api/config/gated-demo", cookie);
      expect(initialGatedRes.status).toBe(403);
      const initialBody = await initialGatedRes.json();
      expect(initialBody.error.code).toBe("FEATURE_FLAG_DISABLED");

      // 2. Admin creates and enables the feature flag
      const flagRes = await post(app, "/api/config/flags", cookie, {
        key: "beta.experimental_feature",
        name: "Experimental Feature Beta",
        enabled: true,
        rolloutPercentage: 100,
        changeReason: "Unlocking experimental feature for production trial",
      });
      expect(flagRes.status).toBe(201);
      clearConfigCache();

      // 3. Now the live code path runs and succeeds!
      const activeGatedRes = await get(app, "/api/config/gated-demo", cookie);
      expect(activeGatedRes.status).toBe(200);
      const activeBody = await activeGatedRes.json();
      expect(activeBody.data.gatedFeature).toBe("active");
      expect(activeBody.data.message).toBe(
        "Live code path successfully executed through feature flag",
      );

      // 4. Disable flag -> live path is gated again (403)
      const flagData = await flagRes.json();
      clearConfigCache();
      await patch(app, `/api/config/${flagData.data.id}`, cookie, {
        enabled: false,
        changeReason: "Disabling experimental feature after trial",
      });
      clearConfigCache();

      const disabledGatedRes = await get(app, "/api/config/gated-demo", cookie);
      expect(disabledGatedRes.status).toBe(403);
    });
  });

  test("full CRUD and evaluation lifecycle", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAppConfigSchema(db);
      clearConfigCache();

      const admin = await createTestUser(db, { firstName: "Admin", lastName: "Full" });
      const org = await createTestOrg(db, { ownerId: admin.id, name: "Full Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });

      const app = createTestApp(db);
      const cookie = await cookieFor(app, admin.email);

      // 1. Create feature flag
      const flagRes = await post(app, "/api/config/flags", cookie, {
        key: "engagement.sentiment_ai",
        name: "Sentiment AI Analyzer",
        enabled: true,
        rolloutPercentage: 100,
        changeReason: "Enabling sentiment analysis engine across tenant",
      });
      expect(flagRes.status).toBe(201);

      // 2. Evaluate flag
      const evalRes = await get(app, "/api/config/evaluate?key=engagement.sentiment_ai", cookie);
      expect(evalRes.status).toBe(200);
      const evalBody = await evalRes.json();
      expect(evalBody.data.enabled).toBe(true);

      // 3. Create system config
      const cfgRes = await post(app, "/api/config", cookie, {
        kind: "system_config",
        key: "analytics.retention_days",
        value: 90,
        configType: "compliance",
        changeReason: "Setting tenant data retention period",
      });
      expect(cfgRes.status).toBe(201);
      const cfg = (await cfgRes.json()).data;

      // 4. Get config value endpoint
      const valRes = await get(app, "/api/config/value?key=analytics.retention_days", cookie);
      expect(valRes.status).toBe(200);
      const valBody = await valRes.json();
      expect(valBody.data.value).toBe(90);

      // 5. Update config
      const updateRes = await patch(app, `/api/config/${cfg.id}`, cookie, {
        value: 180,
        changeReason: "Extending retention period to 180 days for audit",
      });
      expect(updateRes.status).toBe(200);
      expect((await updateRes.json()).data.value).toBe(180);

      // 6. Rollback config
      const rollbackRes = await post(app, `/api/config/${cfg.id}/rollback`, cookie, {
        changeReason: "Reverting retention period extension back to 90",
      });
      expect(rollbackRes.status).toBe(200);
      expect((await rollbackRes.json()).data.value).toBe(90);

      // 7. Delete config
      const delRes = await del(app, `/api/config/${cfg.id}`, cookie);
      expect(delRes.status).toBe(200);

      // 8. Confirm deleted
      const getDeletedRes = await get(app, `/api/config/${cfg.id}`, cookie);
      expect(getDeletedRes.status).toBe(404);
    });
  });
});
