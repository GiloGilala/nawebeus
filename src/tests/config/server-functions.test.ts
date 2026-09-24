/**
 * TanStack Start Server Functions Tests for Feature Flags and System Config (NWB-P1-009).
 *
 * Tests in-process execution:
 * - evaluateFlagServerFn
 * - getConfigValueServerFn
 * - createFeatureFlagServerFn
 * - createAppConfigServerFn
 * - getAppConfigServerFn
 * - listAppConfigsServerFn
 * - updateAppConfigServerFn
 * - rollbackAppConfigServerFn
 * - deleteAppConfigServerFn
 */

import { describe, expect, test } from "bun:test";
import {
  createAppConfigServerFn,
  createFeatureFlagServerFn,
  deleteAppConfigServerFn,
  evaluateFlagServerFn,
  getAppConfigServerFn,
  getConfigValueServerFn,
  listAppConfigsServerFn,
  rollbackAppConfigServerFn,
  updateAppConfigServerFn,
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
import { clearConfigCache } from "@/services/config";
import { ensureAppConfigSchema } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

describe("Config Server Functions — Validation (No DB)", () => {
  test("createAppConfigServerFn with missing changeReason throws ValidationError", async () => {
    try {
      await createAppConfigServerFn({
        data: {
          kind: "system_config",
          key: "rate_limit.test",
          value: 10,
          configType: "rate_limit",
        } as unknown as never,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  test("getAppConfigServerFn with invalid ID pattern throws ValidationError", async () => {
    try {
      await getAppConfigServerFn({ data: "not-valid-id" });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  test("createFeatureFlagServerFn with invalid key throws ValidationError", async () => {
    try {
      await createFeatureFlagServerFn({
        data: {
          key: ".invalid.key",
          name: "Test Flag",
          changeReason: "Valid length change reason here",
        } as unknown as never,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });
});

describe.skipIf(!hasDb())("Config Server Functions — Integration (with DB)", () => {
  test("full server function lifecycle: flags, config, evaluate, rollback", async () => {
    const config = getConfig();
    const dbCtx = await createTestDb(config.DATABASE_URL);
    const db = dbCtx.db;

    try {
      await ensureAppConfigSchema(db);
      clearConfigCache();

      const admin = await createTestUser(db, { firstName: "FnAdmin", lastName: "Cfg" });
      const org = await createTestOrg(db, { ownerId: admin.id, name: "Fn Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });

      const token = await signAccessToken(admin.id, org.id, config.JWT_ACCESS_SECRET);

      setServerDbForTest(db);
      setServerHeadersForTest({
        cookie: `nawebeus_access=${token}`,
      });

      // 1. Create feature flag via server function
      const flag = await createFeatureFlagServerFn({
        data: {
          key: "beta.server_fn_flag",
          name: "Server Function Test Flag",
          enabled: true,
          rolloutPercentage: 100,
          changeReason: "Testing feature flag server function creation",
        },
      });
      expect(flag.id.startsWith("ff_")).toBe(true);

      // 2. Evaluate flag via server function
      const isEnabled = await evaluateFlagServerFn({
        data: {
          key: "beta.server_fn_flag",
        },
      });
      expect(isEnabled).toBe(true);

      // 3. Create system config via server function
      const cfg = await createAppConfigServerFn({
        data: {
          kind: "system_config",
          key: "system.maintenance_mode",
          value: false,
          configType: "security",
          changeReason: "Setting baseline maintenance mode to false",
        },
      });
      expect(cfg.id.startsWith("cfg_")).toBe(true);

      // 4. Get config value via server function
      const cfgVal = await getConfigValueServerFn({
        data: {
          key: "system.maintenance_mode",
        },
      });
      expect(cfgVal).toBe(false);

      // 5. Update config via server function
      const updated = await updateAppConfigServerFn({
        data: {
          id: cfg.id,
          data: {
            value: true,
            changeReason: "Enabling maintenance mode for planned upgrade",
          },
        },
      });
      expect(updated.value).toBe(true);
      expect(updated.version).toBe(2);

      // 6. Rollback config via server function
      const rolledBack = await rollbackAppConfigServerFn({
        data: {
          id: cfg.id,
          data: {
            changeReason: "Rolling back maintenance mode after upgrade",
          },
        },
      });
      expect(rolledBack.value).toBe(false);
      expect(rolledBack.version).toBe(3);

      // 7. List configs via server function
      const list = await listAppConfigsServerFn({
        data: {
          kind: "system_config",
        },
      });
      expect(list.items.length).toBeGreaterThanOrEqual(1);

      // 8. Delete config via server function
      const delRes = await deleteAppConfigServerFn({
        data: cfg.id,
      });
      expect(delRes.deleted).toBe(true);
    } finally {
      clearServerDbForTest();
      clearServerHeadersForTest();
      await dbCtx.done();
    }
  });
});
