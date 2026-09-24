import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { ConfigLockedError, ConfigVersionConflictError } from "../../lib/errors";
import { clearConfigCache, configService } from "../../services/config";
import { ensureAppConfigSchema, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

interface ConfigWorkspace {
  orgId: string;
  adminId: string;
  memberId: string;
  otherOrgId: string;
}

async function setupWorkspace(db: Db): Promise<ConfigWorkspace> {
  await ensureAppConfigSchema(db);
  clearConfigCache();

  const admin = await createTestUser(db, { firstName: "Config", lastName: "Admin" });
  const member = await createTestUser(db, { firstName: "Normal", lastName: "Member" });
  const org = await createTestOrg(db, { ownerId: admin.id, name: "Config Test Org" });

  await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "admin" });
  await addMemberWithRole(db, { organizationId: org.id, userId: member.id, roleCode: "creator" });

  const otherAdmin = await createTestUser(db, { firstName: "Other", lastName: "Admin" });
  const otherOrg = await createTestOrg(db, { ownerId: otherAdmin.id, name: "Other Org" });
  await addMemberWithRole(db, {
    organizationId: otherOrg.id,
    userId: otherAdmin.id,
    roleCode: "admin",
  });

  return {
    orgId: org.id,
    adminId: admin.id,
    memberId: member.id,
    otherOrgId: otherOrg.id,
  };
}

describe.skipIf(!hasDb())("Config Service — DB Integration Tests", () => {
  test("creates system config and retrieves typed value with org override fallback", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // 1. Create global system config
      const globalConfig = await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "rate_limit.max_requests",
          name: "Global API Rate Limit",
          value: 100,
          configType: "rate_limit",
          environment: "production",
          changeReason: "Initial baseline rate limit configuration",
          organizationId: null,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      expect(globalConfig.id.startsWith("cfg_")).toBe(true);
      expect(globalConfig.key).toBe("rate_limit.max_requests");
      expect(globalConfig.value).toBe(100);
      expect(globalConfig.version).toBe(1);

      // Verify value retrieval returns global default
      const val1 = await configService.getConfigValue<number>(db, "rate_limit.max_requests", {
        organizationId: ws.orgId,
      });
      expect(val1).toBe(100);

      // 2. Create tenant override for org
      clearConfigCache();
      const orgConfig = await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "rate_limit.max_requests",
          name: "Org High-Tier Rate Limit",
          value: 500,
          configType: "rate_limit",
          environment: "production",
          changeReason: "Enterprise tier rate limit upgrade for customer",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );
      expect(orgConfig.value).toBe(500);

      // Verify tenant override takes precedence
      clearConfigCache();
      const val2 = await configService.getConfigValue<number>(db, "rate_limit.max_requests", {
        organizationId: ws.orgId,
      });
      expect(val2).toBe(500);

      // Other org still falls back to global value
      const valOther = await configService.getConfigValue<number>(db, "rate_limit.max_requests", {
        organizationId: ws.otherOrgId,
      });
      expect(valOther).toBe(100);

      // Non-existent key returns fallback
      const fallbackVal = await configService.getConfigValue<number>(db, "non.existent.key", {
        organizationId: ws.orgId,
        fallback: 42,
      });
      expect(fallbackVal).toBe(42);
    });
  });

  test("optimistic concurrency and locked config protection", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const cfg = await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "timeout.socket_seconds",
          value: 30,
          configType: "integration",
          environment: "production",
          changeReason: "Default socket timeout configuration",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      // Successful update increments version to 2
      const updated = await configService.updateAppConfig(
        db,
        cfg.id,
        {
          value: 45,
          expectedVersion: 1,
          changeReason: "Increasing timeout due to high backend latency",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );
      expect(updated.version).toBe(2);
      expect(updated.value).toBe(45);
      expect(updated.previousValue).toBe(30);

      // Stale update throws ConfigVersionConflictError
      expect(
        configService.updateAppConfig(
          db,
          cfg.id,
          {
            value: 60,
            expectedVersion: 1, // Stale version
            changeReason: "Conflicting update from another administrator",
          },
          { id: ws.adminId, organizationId: ws.orgId },
        ),
      ).rejects.toThrow(ConfigVersionConflictError);

      // Lock configuration
      await configService.updateAppConfig(
        db,
        cfg.id,
        {
          isLocked: true,
          changeReason: "Locking configuration for audit compliance freeze",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      // Attempting to modify locked config throws ConfigLockedError
      expect(
        configService.updateAppConfig(
          db,
          cfg.id,
          {
            value: 100,
            changeReason: "Unauthorized modification attempt while locked",
          },
          { id: ws.adminId, organizationId: ws.orgId },
        ),
      ).rejects.toThrow(ConfigLockedError);

      // Attempting to delete locked config throws ConfigLockedError
      expect(
        configService.deleteAppConfig(db, cfg.id, {
          id: ws.adminId,
          organizationId: ws.orgId,
        }),
      ).rejects.toThrow(ConfigLockedError);
    });
  });

  test("rollback restores previous value and increments version", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const cfg = await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "billing.max_seats",
          value: 10,
          configType: "billing",
          environment: "production",
          changeReason: "Initial plan seats allocation for team",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      // Update to new value
      await configService.updateAppConfig(
        db,
        cfg.id,
        {
          value: 20,
          changeReason: "Temporary seat expansion during campaign launch",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      // Rollback to previous value (10)
      const rolledBack = await configService.rollbackAppConfig(
        db,
        cfg.id,
        {
          changeReason: "Rolling back temporary seat expansion after campaign finished",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      expect(rolledBack.value).toBe(10);
      expect(rolledBack.previousValue).toBe(20);
      expect(rolledBack.version).toBe(3);
    });
  });

  test("feature flag evaluation: kill switch, release date, targeting rules, rollout", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // 1. Create disabled flag
      const flag1 = await configService.createFeatureFlag(
        db,
        {
          key: "beta.ai_generator",
          name: "AI Content Generator",
          enabled: false,
          changeReason: "Dark launching AI generator feature flag",
          organizationId: null, // Global
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );
      expect(flag1.id.startsWith("ff_")).toBe(true);

      const isEvalDisabled = await configService.evaluateFlag(db, "beta.ai_generator", {
        organizationId: ws.orgId,
      });
      expect(isEvalDisabled).toBe(false);

      // 2. Enable flag 100%
      clearConfigCache();
      await configService.updateAppConfig(
        db,
        flag1.id,
        {
          enabled: true,
          rolloutPercentage: 100,
          changeReason: "Enabling AI generator for 100% of platform users",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      const isEvalEnabled = await configService.evaluateFlag(db, "beta.ai_generator", {
        organizationId: ws.orgId,
      });
      expect(isEvalEnabled).toBe(true);

      // 3. Emergency Kill Switch override
      clearConfigCache();
      await configService.updateAppConfig(
        db,
        flag1.id,
        {
          killSwitch: true,
          changeReason: "Emergency kill switch triggered due to model provider 500 spike",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      const isEvalKilled = await configService.evaluateFlag(db, "beta.ai_generator", {
        organizationId: ws.orgId,
      });
      expect(isEvalKilled).toBe(false);

      // 4. Org-specific override: other org creates enabled override without killswitch
      clearConfigCache();
      await configService.createFeatureFlag(
        db,
        {
          key: "beta.ai_generator",
          name: "Org Private AI Generator",
          enabled: true,
          killSwitch: false,
          rolloutPercentage: 100,
          changeReason: "Enabling dedicated private cluster for enterprise org",
          organizationId: ws.otherOrgId,
        },
        { id: ws.adminId, organizationId: ws.otherOrgId },
      );

      const isOtherEval = await configService.evaluateFlag(db, "beta.ai_generator", {
        organizationId: ws.otherOrgId,
      });
      expect(isOtherEval).toBe(true);

      // 5. Targeting rules
      clearConfigCache();
      const flagTargeted = await configService.createFeatureFlag(
        db,
        {
          key: "beta.export_v2",
          name: "Data Export V2",
          enabled: true,
          rolloutPercentage: 0, // 0% general rollout, only targeted
          targetingRules: [
            {
              attribute: "tier",
              operator: "equals",
              value: "enterprise",
            },
          ],
          changeReason: "Targeting enterprise tier accounts for export v2 beta",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );
      expect(flagTargeted.enabled).toBe(true);

      const isMatch = await configService.evaluateFlag(db, "beta.export_v2", {
        organizationId: ws.orgId,
        attributes: { tier: "enterprise" },
      });
      expect(isMatch).toBe(true);

      const isNoMatch = await configService.evaluateFlag(db, "beta.export_v2", {
        organizationId: ws.orgId,
        attributes: { tier: "starter" },
      });
      expect(isNoMatch).toBe(false);
    });
  });

  test("keyset pagination and search filtering", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      // Create 3 configs
      await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "security.mfa_enforced",
          value: false,
          configType: "security",
          changeReason: "MFA enforcement toggle across organization",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "security.session_lifetime_minutes",
          value: 120,
          configType: "security",
          changeReason: "Standard session idle expiration time",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      await configService.createFeatureFlag(
        db,
        {
          key: "publishing.scheduled_reposts",
          name: "Auto-Reposts",
          changeReason: "Feature flag for automated repost schedules",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      // List with filter kind=system_config
      const listSys = await configService.listAppConfigs(db, {
        organizationId: ws.orgId,
        kind: "system_config",
      });
      expect(listSys.items.length).toBe(2);

      // List with search
      const listSearch = await configService.listAppConfigs(db, {
        organizationId: ws.orgId,
        search: "mfa",
      });
      expect(listSearch.items.length).toBe(1);
      expect(listSearch.items[0]?.key).toBe("security.mfa_enforced");

      // Pagination page size 1
      const page1 = await configService.listAppConfigs(db, {
        organizationId: ws.orgId,
        limit: 1,
      });
      expect(page1.items.length).toBe(1);
      expect(page1.pageInfo.hasMore).toBe(true);
      expect(page1.pageInfo.cursor).toBeDefined();

      // Page 2 using cursor
      expect(page1.pageInfo.cursor).toBeDefined();
      const page2 = await configService.listAppConfigs(db, {
        organizationId: ws.orgId,
        limit: 1,
        cursor: page1.pageInfo.cursor ?? undefined,
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });
  });

  test("audit logging writes entries for config and flag operations", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const cfg = await configService.createAppConfig(
        db,
        {
          kind: "system_config",
          key: "compliance.dsar_auto_approve",
          value: false,
          configType: "compliance",
          changeReason: "Initial DSAR approval safety settings",
          organizationId: ws.orgId,
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      await configService.updateAppConfig(
        db,
        cfg.id,
        {
          value: true,
          changeReason: "Enabling automated DSAR verification in sandbox",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      await configService.rollbackAppConfig(
        db,
        cfg.id,
        {
          changeReason: "Rolling back automated DSAR approval to manual",
        },
        { id: ws.adminId, organizationId: ws.orgId },
      );

      await configService.deleteAppConfig(db, cfg.id, {
        id: ws.adminId,
        organizationId: ws.orgId,
      });

      // Verify audit logs exist
      const logs = await db.execute<{ action: string }>(
        sql`SELECT action FROM unified_audit_log WHERE resource_id = ${cfg.id} ORDER BY created_at ASC`,
      );
      const rows = (logs as unknown as { rows: { action: string }[] }).rows;
      const actions = rows.map((r) => r.action);
      expect(actions).toContain("config.created");
      expect(actions).toContain("config.updated");
      expect(actions).toContain("config.rolled_back");
      expect(actions).toContain("config.deleted");
    });
  });
});
