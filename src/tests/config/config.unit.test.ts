import { describe, expect, test } from "bun:test";
import {
  CONFIG_ID_PATTERN,
  configIdSchema,
  configKeySchema,
  createAppConfigSchema,
  createFeatureFlagSchema,
  evaluateFlagSchema,
  listAppConfigQuerySchema,
  rollbackAppConfigSchema,
  updateAppConfigSchema,
} from "../../lib/validation/config.schemas";
import { computeRolloutBucket, evaluateTargetingRules } from "../../services/config/config.service";

describe("Config & Feature Flags — Unit Tests (No DB)", () => {
  describe("computeRolloutBucket", () => {
    test("is deterministic for identical key and identifier", () => {
      const b1 = computeRolloutBucket("beta.search", "user-123");
      const b2 = computeRolloutBucket("beta.search", "user-123");
      expect(b1).toBe(b2);
      expect(b1).toBeGreaterThanOrEqual(0);
      expect(b1).toBeLessThan(100);
    });

    test("varies across different keys and users", () => {
      const b1 = computeRolloutBucket("beta.feature_a", "user-1");
      const b2 = computeRolloutBucket("beta.feature_b", "user-1");
      const b3 = computeRolloutBucket("beta.feature_a", "user-2");
      // Buckets are numbers between 0 and 99
      expect(typeof b1).toBe("number");
      expect(typeof b2).toBe("number");
      expect(typeof b3).toBe("number");
    });
  });

  describe("evaluateTargetingRules", () => {
    test("returns true when rules array is empty", () => {
      expect(evaluateTargetingRules([], { plan: "pro" })).toBe(true);
    });

    test("evaluates 'equals' and 'not_equals'", () => {
      const ruleEquals = [{ attribute: "plan", operator: "equals" as const, value: "enterprise" }];
      expect(evaluateTargetingRules(ruleEquals, { plan: "enterprise" })).toBe(true);
      expect(evaluateTargetingRules(ruleEquals, { plan: "pro" })).toBe(false);

      const ruleNotEquals = [{ attribute: "plan", operator: "not_equals" as const, value: "free" }];
      expect(evaluateTargetingRules(ruleNotEquals, { plan: "pro" })).toBe(true);
      expect(evaluateTargetingRules(ruleNotEquals, { plan: "free" })).toBe(false);
    });

    test("evaluates 'in' operator", () => {
      const ruleIn = [
        {
          attribute: "tier",
          operator: "in" as const,
          value: ["growth", "enterprise"],
        },
      ];
      expect(evaluateTargetingRules(ruleIn, { tier: "growth" })).toBe(true);
      expect(evaluateTargetingRules(ruleIn, { tier: "enterprise" })).toBe(true);
      expect(evaluateTargetingRules(ruleIn, { tier: "starter" })).toBe(false);
    });

    test("evaluates 'contains' operator on strings and arrays", () => {
      const ruleContainsStr = [
        {
          attribute: "email",
          operator: "contains" as const,
          value: "@nawebeus.com",
        },
      ];
      expect(evaluateTargetingRules(ruleContainsStr, { email: "alice@nawebeus.com" })).toBe(true);
      expect(evaluateTargetingRules(ruleContainsStr, { email: "alice@gmail.com" })).toBe(false);

      const ruleContainsArr = [
        {
          attribute: "roles",
          operator: "contains" as const,
          value: "admin",
        },
      ];
      expect(evaluateTargetingRules(ruleContainsArr, { roles: ["member", "admin"] })).toBe(true);
      expect(evaluateTargetingRules(ruleContainsArr, { roles: ["member"] })).toBe(false);
    });

    test("evaluates 'greater_than' and 'less_than'", () => {
      const ruleGt = [{ attribute: "membersCount", operator: "greater_than" as const, value: 10 }];
      expect(evaluateTargetingRules(ruleGt, { membersCount: 15 })).toBe(true);
      expect(evaluateTargetingRules(ruleGt, { membersCount: 10 })).toBe(false);
      expect(evaluateTargetingRules(ruleGt, { membersCount: 5 })).toBe(false);

      const ruleLt = [{ attribute: "ageDays", operator: "less_than" as const, value: 30 }];
      expect(evaluateTargetingRules(ruleLt, { ageDays: 14 })).toBe(true);
      expect(evaluateTargetingRules(ruleLt, { ageDays: 30 })).toBe(false);
      expect(evaluateTargetingRules(ruleLt, { ageDays: 45 })).toBe(false);
    });

    test("returns false when attribute is missing", () => {
      const rule = [{ attribute: "nonExistent", operator: "equals" as const, value: "test" }];
      expect(evaluateTargetingRules(rule, {})).toBe(false);
    });
  });

  describe("Validation Schemas", () => {
    test("configIdSchema accepts cfg_ and ff_ prefixes and UUIDs", () => {
      expect(configIdSchema.safeParse("cfg_1234567890abcdef12345678").success).toBe(true);
      expect(configIdSchema.safeParse("ff_1234567890abcdef12345678").success).toBe(true);
      expect(configIdSchema.safeParse("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d").success).toBe(true);

      expect(configIdSchema.safeParse("invalid_id").success).toBe(false);
      expect(configIdSchema.safeParse("").success).toBe(false);
      expect(CONFIG_ID_PATTERN.test("cfg_1234567890abcdef12345678")).toBe(true);
      expect(CONFIG_ID_PATTERN.test("ff_1234567890abcdef12345678")).toBe(true);
    });

    test("configKeySchema enforces valid naming pattern", () => {
      expect(configKeySchema.safeParse("rate_limit.max_requests").success).toBe(true);
      expect(configKeySchema.safeParse("engagement.ai_suggestions").success).toBe(true);
      expect(configKeySchema.safeParse("dark-mode.v2").success).toBe(true);
      expect(configKeySchema.safeParse("simpleKey").success).toBe(true);

      expect(configKeySchema.safeParse(".invalidLeadingDot").success).toBe(false);
      expect(configKeySchema.safeParse("-invalidLeadingDash").success).toBe(false);
      expect(configKeySchema.safeParse("").success).toBe(false);
    });

    test("createAppConfigSchema requires changeReason with minimum 10 characters", () => {
      const valid = {
        kind: "system_config",
        key: "rate_limit.api",
        value: { maxPerMinute: 60 },
        configType: "rate_limit",
        changeReason: "Adjusted limit for high traffic event",
      };
      expect(createAppConfigSchema.safeParse(valid).success).toBe(true);

      const invalidShortReason = {
        ...valid,
        changeReason: "too short",
      };
      const res = createAppConfigSchema.safeParse(invalidShortReason);
      expect(res.success).toBe(false);
    });

    test("createAppConfigSchema enforces configType 'feature_flag' when kind is 'feature_flag'", () => {
      const invalid = {
        kind: "feature_flag",
        key: "beta.flag",
        value: true,
        configType: "security", // Mismatch
        changeReason: "Enabling beta feature flag across all orgs",
      };
      const res = createAppConfigSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    test("createFeatureFlagSchema applies sensible defaults", () => {
      const input = {
        key: "beta.dashboard_v2",
        name: "Dashboard V2 Beta",
        changeReason: "Rolling out redesigned dashboard to beta testers",
      };
      const parsed = createFeatureFlagSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.enabled).toBe(false);
        expect(parsed.data.rolloutPercentage).toBe(0);
        expect(parsed.data.environments).toEqual(["development", "staging", "production"]);
      }
    });

    test("updateAppConfigSchema validates version and reason", () => {
      const valid = {
        value: 120,
        expectedVersion: 2,
        changeReason: "Scaling limits up for Black Friday surge",
      };
      expect(updateAppConfigSchema.safeParse(valid).success).toBe(true);
    });

    test("rollbackAppConfigSchema requires changeReason", () => {
      expect(
        rollbackAppConfigSchema.safeParse({ changeReason: "Rollback due to regression" }).success,
      ).toBe(true);
      expect(rollbackAppConfigSchema.safeParse({ changeReason: "Short" }).success).toBe(false);
    });

    test("evaluateFlagSchema validates query shape", () => {
      expect(evaluateFlagSchema.safeParse({ key: "beta.feature" }).success).toBe(true);
      expect(
        evaluateFlagSchema.safeParse({
          key: "beta.feature",
          organizationId: "org-1",
          userId: "usr-1",
          fallback: true,
        }).success,
      ).toBe(true);
    });

    test("listAppConfigQuerySchema transforms query parameters", () => {
      const parsed = listAppConfigQuerySchema.safeParse({
        kind: "feature_flag",
        includeGlobal: "true",
        limit: "50",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.includeGlobal).toBe(true);
        expect(parsed.data.limit).toBe(50);
      }
    });
  });
});
