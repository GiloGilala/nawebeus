import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, getTableColumns, ilike, isNull, or, sql } from "drizzle-orm";
import { appConfig } from "../../../db/compliance";
import type { Db } from "../../lib/db";
import {
  ConfigLockedError,
  ConfigVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import { buildPage, decodeCursor, type Page } from "../../lib/pagination";
import {
  CONFIG_ID_PATTERN,
  type ConfigEnvironment,
  type ConfigKind,
  type ConfigType,
  type CreateAppConfigInput,
  type CreateFeatureFlagInput,
  type RollbackAppConfigInput,
  type TargetingRule,
  type UpdateAppConfigInput,
} from "../../lib/validation/config.schemas";
import { writeAuditLog } from "../audit";
import type {
  AppConfigRecord,
  ConfigActor,
  FlagEvaluationContext,
  GetConfigOptions,
  ListConfigOptions,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

function mintConfigId(kind: ConfigKind): string {
  const prefix = kind === "feature_flag" ? "ff" : "cfg";
  const randomPart = randomBytes(16).toString("hex");
  return `${prefix}_${randomPart}`;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  return new Date(String(val));
}

function toRequiredDate(val: unknown): Date {
  if (val instanceof Date) return val;
  return new Date(String(val));
}

function resolveTargetEnv(env?: string | null): ConfigEnvironment {
  if (env === "production" || env === "staging" || env === "sandbox" || env === "development") {
    return env;
  }
  return "production";
}

function mapRowToRecord(row: typeof appConfig.$inferSelect): AppConfigRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind as ConfigKind,
    key: row.key,
    name: row.name,
    description: row.description,
    value: row.value,
    configType: row.configType as ConfigType,
    environment: row.environment as ConfigEnvironment,
    enabled: row.enabled,
    killSwitch: row.killSwitch,
    rolloutPercentage: row.rolloutPercentage,
    targetingRules: row.targetingRules as TargetingRule[] | null,
    environments: row.environments as ConfigEnvironment[] | null,
    releaseDate: toDate(row.releaseDate),
    defaultValue: row.defaultValue,
    previousValue: row.previousValue,
    validationSchema: row.validationSchema as Record<string, unknown> | null,
    validationRules: row.validationRules as Record<string, unknown> | null,
    exampleValue: row.exampleValue,
    changeReason: row.changeReason,
    version: row.version,
    isEncrypted: row.isEncrypted,
    isLocked: row.isLocked,
    isDeprecated: row.isDeprecated,
    deprecatedAt: toDate(row.deprecatedAt),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: toRequiredDate(row.createdAt),
    updatedAt: toRequiredDate(row.updatedAt),
  };
}

/**
 * Deterministic bucket hash (0..99) for rollout percentage.
 */
export function computeRolloutBucket(key: string, identifier: string): number {
  const hash = createHash("sha256").update(`${key}:${identifier}`).digest("hex");
  const intVal = Number.parseInt(hash.slice(0, 8), 16);
  return intVal % 100;
}

/**
 * Evaluates feature flag targeting rules against provided context attributes.
 */
export function evaluateTargetingRules(
  rules: TargetingRule[],
  attributes: Record<string, unknown> = {},
): boolean {
  if (rules.length === 0) return true;

  return rules.every((rule) => {
    const attrVal = attributes[rule.attribute];
    if (attrVal === undefined || attrVal === null) return false;

    switch (rule.operator) {
      case "equals":
        return String(attrVal) === String(rule.value);
      case "not_equals":
        return String(attrVal) !== String(rule.value);
      case "in":
        if (Array.isArray(rule.value)) {
          return rule.value.map(String).includes(String(attrVal));
        }
        return false;
      case "contains":
        if (typeof attrVal === "string" && typeof rule.value === "string") {
          return attrVal.includes(rule.value);
        }
        if (Array.isArray(attrVal)) {
          return attrVal.map(String).includes(String(rule.value));
        }
        return false;
      case "greater_than":
        return Number(attrVal) > Number(rule.value);
      case "less_than":
        return Number(attrVal) < Number(rule.value);
      default:
        return false;
    }
  });
}

// =============================================================================
// IN-MEMORY TTL CACHE
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const configCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function clearConfigCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    configCache.clear();
    return;
  }
  for (const k of configCache.keys()) {
    if (k.startsWith(keyPrefix)) {
      configCache.delete(k);
    }
  }
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class ConfigService {
  /**
   * Evaluates a feature flag at runtime without redeploy.
   *
   * Checks:
   * 1. Org-specific override vs global flag.
   * 2. Kill switch emergency override.
   * 3. Flag enabled status.
   * 4. Release date schedule.
   * 5. Environment scoping.
   * 6. Targeting rules matching.
   * 7. Deterministic rollout percentage hashing.
   */
  async evaluateFlag(db: Db, key: string, context?: FlagEvaluationContext): Promise<boolean> {
    const targetEnv: ConfigEnvironment = resolveTargetEnv(
      context?.environment ?? process.env.NODE_ENV,
    );
    const cacheKey = `flag:${key}:${context?.organizationId ?? "global"}:${targetEnv}`;

    // Cache lookup if no custom attributes
    if (!context?.attributes) {
      const cached = configCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const flag = cached.value as AppConfigRecord | null;
        if (!flag) return context?.fallback ?? false;
        return this.evaluateFlagRules(flag, context, targetEnv);
      }
    }

    // DB lookup: First check org-specific flag, then fall back to global flag
    let flagRow: typeof appConfig.$inferSelect | undefined;

    if (context?.organizationId) {
      const orgRows = await db
        .select()
        .from(appConfig)
        .where(
          and(
            eq(appConfig.kind, "feature_flag"),
            eq(appConfig.key, key),
            eq(appConfig.organizationId, context.organizationId),
          ),
        )
        .limit(1);
      if (orgRows.length > 0) {
        flagRow = orgRows[0];
      }
    }

    if (!flagRow) {
      const globalRows = await db
        .select()
        .from(appConfig)
        .where(
          and(
            eq(appConfig.kind, "feature_flag"),
            eq(appConfig.key, key),
            isNull(appConfig.organizationId),
          ),
        )
        .limit(1);
      if (globalRows.length > 0) {
        flagRow = globalRows[0];
      }
    }

    if (!flagRow) {
      configCache.set(cacheKey, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return context?.fallback ?? false;
    }

    const record = mapRowToRecord(flagRow);
    configCache.set(cacheKey, { value: record, expiresAt: Date.now() + CACHE_TTL_MS });

    return this.evaluateFlagRules(record, context, targetEnv);
  }

  private evaluateFlagRules(
    flag: AppConfigRecord,
    context: FlagEvaluationContext | undefined,
    targetEnv: ConfigEnvironment,
  ): boolean {
    // 1. Kill switch
    if (flag.killSwitch) {
      return false;
    }

    // 2. Enabled flag
    if (!flag.enabled) {
      return false;
    }

    // 3. Release date
    if (flag.releaseDate && flag.releaseDate.getTime() > Date.now()) {
      return false;
    }

    // 4. Environment check
    if (flag.environments && flag.environments.length > 0) {
      if (!flag.environments.includes(targetEnv)) {
        return false;
      }
    }

    // 5. Targeting rules
    if (flag.targetingRules && flag.targetingRules.length > 0) {
      const match = evaluateTargetingRules(flag.targetingRules, context?.attributes ?? {});
      if (match) return true;
    }

    // 6. Rollout percentage
    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    if (flag.rolloutPercentage <= 0) {
      return false;
    }

    const identifier = context?.userId ?? context?.organizationId;
    if (!identifier) {
      return false;
    }

    const bucket = computeRolloutBucket(flag.key, identifier);
    return bucket < flag.rolloutPercentage;
  }

  /**
   * Retrieves a typed system configuration value with org override fallback and default.
   */
  async getConfigValue<T = unknown>(
    db: Db,
    key: string,
    options?: GetConfigOptions<T>,
  ): Promise<T> {
    const targetEnv: ConfigEnvironment = resolveTargetEnv(
      options?.environment ?? process.env.NODE_ENV,
    );
    const cacheKey = `cfg:${key}:${options?.organizationId ?? "global"}:${targetEnv}`;

    const cached = configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.value !== undefined) {
        return cached.value as T;
      }
      return options?.fallback as T;
    }

    let configRow: typeof appConfig.$inferSelect | undefined;

    if (options?.organizationId) {
      const orgRows = await db
        .select()
        .from(appConfig)
        .where(
          and(
            eq(appConfig.kind, "system_config"),
            eq(appConfig.key, key),
            eq(appConfig.organizationId, options.organizationId),
            eq(appConfig.environment, targetEnv),
          ),
        )
        .limit(1);
      if (orgRows.length > 0) {
        configRow = orgRows[0];
      }
    }

    if (!configRow) {
      const globalRows = await db
        .select()
        .from(appConfig)
        .where(
          and(
            eq(appConfig.kind, "system_config"),
            eq(appConfig.key, key),
            isNull(appConfig.organizationId),
            eq(appConfig.environment, targetEnv),
          ),
        )
        .limit(1);
      if (globalRows.length > 0) {
        configRow = globalRows[0];
      }
    }

    if (!configRow) {
      configCache.set(cacheKey, {
        value: options?.fallback,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return options?.fallback as T;
    }

    const result = (configRow.value ?? configRow.defaultValue) as T;
    configCache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  /**
   * Creates a new app_config entry (system_config or feature_flag) with full audit.
   */
  async createAppConfig(
    db: Db,
    input: CreateAppConfigInput,
    actor: ConfigActor,
  ): Promise<AppConfigRecord> {
    const kind: ConfigKind = input.kind ?? "system_config";
    const id = mintConfigId(kind);

    const insertedRows = await db
      .insert(appConfig)
      .values({
        id,
        organizationId: input.organizationId ?? null,
        kind,
        key: input.key,
        name: input.name ?? null,
        description: input.description ?? null,
        value: input.value,
        configType: input.configType,
        environment: input.environment ?? "production",
        enabled: input.enabled ?? false,
        killSwitch: input.killSwitch ?? false,
        rolloutPercentage: input.rolloutPercentage ?? 0,
        targetingRules: input.targetingRules ?? null,
        environments: input.environments ?? null,
        releaseDate: toDate(input.releaseDate),
        defaultValue: input.defaultValue ?? input.value,
        previousValue: null,
        validationSchema: input.validationSchema ?? null,
        validationRules: input.validationRules ?? null,
        exampleValue: input.exampleValue ?? null,
        changeReason: input.changeReason,
        version: 1,
        isEncrypted: input.isEncrypted ?? false,
        isLocked: input.isLocked ?? false,
        isDeprecated: false,
        deprecatedAt: null,
        createdBy: actor.id,
        updatedBy: null,
      })
      .returning();

    const first = insertedRows[0];
    if (!first) {
      throw new Error("Failed to insert app_config row");
    }
    const record = mapRowToRecord(first);
    clearConfigCache();

    await writeAuditLog({
      db,
      module: "core",
      organizationId: record.organizationId ?? undefined,
      actorId: actor.id,
      actorType: "user",
      actorIp: actor.ipAddress ?? undefined,
      actorUserAgent: actor.userAgent ?? undefined,
      action: record.kind === "feature_flag" ? "flag.created" : "config.created",
      resourceId: record.id,
      afterState: {
        key: record.key,
        kind: record.kind,
        value: record.value,
        enabled: record.enabled,
        rolloutPercentage: record.rolloutPercentage,
        changeReason: record.changeReason,
      },
    });

    return record;
  }

  /**
   * Creates a feature flag using the simplified feature flag schema.
   */
  async createFeatureFlag(
    db: Db,
    input: CreateFeatureFlagInput,
    actor: ConfigActor,
  ): Promise<AppConfigRecord> {
    const isEnabled = input.enabled ?? false;
    const rollout =
      input.rolloutPercentage !== undefined ? input.rolloutPercentage : isEnabled ? 100 : 0;

    return this.createAppConfig(
      db,
      {
        kind: "feature_flag",
        key: input.key,
        name: input.name,
        description: input.description,
        value: isEnabled,
        defaultValue: false,
        configType: "feature_flag",
        environment: "production",
        enabled: isEnabled,
        killSwitch: input.killSwitch ?? false,
        rolloutPercentage: rollout,
        targetingRules: input.targetingRules,
        environments: input.environments ?? ["development", "staging", "production"],
        releaseDate: input.releaseDate,
        changeReason: input.changeReason,
        organizationId: input.organizationId,
        isEncrypted: false,
        isLocked: false,
      },
      actor,
    );
  }

  /**
   * Updates an existing configuration entry with optimistic concurrency and rollback preservation.
   */
  async updateAppConfig(
    db: Db,
    id: string,
    input: UpdateAppConfigInput,
    actor: ConfigActor,
  ): Promise<AppConfigRecord> {
    const existingRows = await db.select().from(appConfig).where(eq(appConfig.id, id)).limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundError("App config entry not found");
    }

    const current = existingRows[0];
    if (!current) {
      throw new NotFoundError("App config entry not found");
    }

    if (current.isLocked) {
      throw new ConfigLockedError();
    }

    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new ConfigVersionConflictError();
    }

    const resolvedValue =
      input.value !== undefined
        ? input.value
        : current.kind === "feature_flag" && input.enabled !== undefined
          ? input.enabled
          : undefined;

    const valueChanged =
      resolvedValue !== undefined &&
      JSON.stringify(resolvedValue) !== JSON.stringify(current.value);

    const isToggle =
      (input.enabled !== undefined && input.enabled !== current.enabled) ||
      (input.killSwitch !== undefined && input.killSwitch !== current.killSwitch);

    const resolvedRollout =
      input.rolloutPercentage !== undefined
        ? input.rolloutPercentage
        : input.enabled === true && current.rolloutPercentage === 0
          ? 100
          : undefined;

    const updatedRows = await db
      .update(appConfig)
      .set({
        ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
        ...(valueChanged ? { previousValue: current.value } : {}),
        changeReason: input.changeReason,
        version: current.version + 1,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.killSwitch !== undefined ? { killSwitch: input.killSwitch } : {}),
        ...(resolvedRollout !== undefined ? { rolloutPercentage: resolvedRollout } : {}),
        ...(input.targetingRules !== undefined ? { targetingRules: input.targetingRules } : {}),
        ...(input.environments !== undefined ? { environments: input.environments } : {}),
        ...(input.releaseDate !== undefined ? { releaseDate: input.releaseDate } : {}),
        ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
        ...(input.isDeprecated !== undefined ? { isDeprecated: input.isDeprecated } : {}),
        ...(input.deprecatedAt !== undefined ? { deprecatedAt: input.deprecatedAt } : {}),
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(appConfig.id, id))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("Failed to update app_config row");
    }
    const record = mapRowToRecord(updated);
    clearConfigCache();

    let action: "flag.toggled" | "flag.updated" | "config.updated";
    if (record.kind === "feature_flag") {
      action = isToggle ? "flag.toggled" : "flag.updated";
    } else {
      action = "config.updated";
    }

    await writeAuditLog({
      db,
      module: "core",
      organizationId: record.organizationId ?? undefined,
      actorId: actor.id,
      actorType: "user",
      actorIp: actor.ipAddress ?? undefined,
      actorUserAgent: actor.userAgent ?? undefined,
      action,
      resourceId: record.id,
      beforeState: {
        value: current.value,
        version: current.version,
        enabled: current.enabled,
        killSwitch: current.killSwitch,
      },
      afterState: {
        value: record.value,
        version: record.version,
        enabled: record.enabled,
        killSwitch: record.killSwitch,
        changeReason: input.changeReason,
      },
    });

    return record;
  }

  /**
   * Rolls back a configuration entry to its previous value.
   */
  async rollbackAppConfig(
    db: Db,
    id: string,
    input: RollbackAppConfigInput,
    actor: ConfigActor,
  ): Promise<AppConfigRecord> {
    const existingRows = await db.select().from(appConfig).where(eq(appConfig.id, id)).limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundError("App config entry not found");
    }

    const current = existingRows[0];
    if (!current) {
      throw new NotFoundError("App config entry not found");
    }

    if (current.isLocked) {
      throw new ConfigLockedError();
    }

    if (current.previousValue === null || current.previousValue === undefined) {
      throw new ValidationError("No previous value available to rollback to");
    }

    const updatedRows = await db
      .update(appConfig)
      .set({
        value: current.previousValue,
        previousValue: current.value,
        version: current.version + 1,
        changeReason: input.changeReason,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(appConfig.id, id))
      .returning();

    const rolledBack = updatedRows[0];
    if (!rolledBack) {
      throw new Error("Failed to rollback app_config row");
    }
    const record = mapRowToRecord(rolledBack);
    clearConfigCache();

    await writeAuditLog({
      db,
      module: "core",
      organizationId: record.organizationId ?? undefined,
      actorId: actor.id,
      actorType: "user",
      actorIp: actor.ipAddress ?? undefined,
      actorUserAgent: actor.userAgent ?? undefined,
      action: "config.rolled_back",
      resourceId: record.id,
      beforeState: { value: current.value },
      afterState: { value: record.value, changeReason: input.changeReason },
    });

    return record;
  }

  /**
   * Deletes an app_config entry.
   */
  async deleteAppConfig(db: Db, id: string, actor: ConfigActor): Promise<void> {
    const existingRows = await db.select().from(appConfig).where(eq(appConfig.id, id)).limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundError("App config entry not found");
    }

    const current = existingRows[0];
    if (!current) {
      throw new NotFoundError("App config entry not found");
    }

    if (current.isLocked) {
      throw new ConfigLockedError();
    }

    await db.delete(appConfig).where(eq(appConfig.id, id));
    clearConfigCache();

    await writeAuditLog({
      db,
      module: "core",
      organizationId: current.organizationId ?? undefined,
      actorId: actor.id,
      actorType: "user",
      actorIp: actor.ipAddress ?? undefined,
      actorUserAgent: actor.userAgent ?? undefined,
      action: current.kind === "feature_flag" ? "flag.deleted" : "config.deleted",
      resourceId: current.id,
      beforeState: {
        key: current.key,
        kind: current.kind,
        value: current.value,
      },
    });
  }

  /**
   * Retrieves an app_config entry by ID with optional tenant check.
   */
  async getAppConfigById(db: Db, id: string, organizationId?: string): Promise<AppConfigRecord> {
    const rows = await db.select().from(appConfig).where(eq(appConfig.id, id)).limit(1);

    if (rows.length === 0 || !rows[0]) {
      throw new NotFoundError("App config entry not found");
    }

    const row = rows[0];

    // Tenant boundary: If entry is scoped to an org and organizationId is provided, enforce match
    if (organizationId && row.organizationId !== null && row.organizationId !== organizationId) {
      throw new NotFoundError("App config entry not found");
    }

    return mapRowToRecord(row);
  }

  /**
   * Lists app_config entries with cursor keyset pagination and filtering.
   */
  async listAppConfigs(db: Db, options: ListConfigOptions = {}): Promise<Page<AppConfigRecord>> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const conditions = [];

    if (options.kind) {
      conditions.push(eq(appConfig.kind, options.kind));
    }

    if (options.environment) {
      conditions.push(eq(appConfig.environment, options.environment));
    }

    if (options.configType) {
      conditions.push(eq(appConfig.configType, options.configType));
    }

    if (options.organizationId) {
      if (options.includeGlobal !== false) {
        conditions.push(
          or(
            eq(appConfig.organizationId, options.organizationId),
            isNull(appConfig.organizationId),
          ),
        );
      } else {
        conditions.push(eq(appConfig.organizationId, options.organizationId));
      }
    } else if (options.includeGlobal === false) {
      conditions.push(sql`${appConfig.organizationId} IS NOT NULL`);
    }

    if (options.isDeprecated !== undefined) {
      conditions.push(eq(appConfig.isDeprecated, options.isDeprecated));
    }

    if (options.search) {
      const pattern = `%${options.search}%`;
      conditions.push(or(ilike(appConfig.key, pattern), ilike(appConfig.name, pattern)));
    }

    const cursorVCol =
      sql<string>`to_char(${appConfig.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF')`.as(
        "cursor_v",
      );

    if (options.cursor) {
      const decoded = decodeCursor(options.cursor, { idPattern: CONFIG_ID_PATTERN });
      if (decoded) {
        conditions.push(
          sql`(${appConfig.createdAt}, ${appConfig.id}) < (${decoded.v}::timestamptz, ${decoded.id})`,
        );
      }
    }

    const rows = await db
      .select({
        ...getTableColumns(appConfig),
        cursorV: cursorVCol,
      })
      .from(appConfig)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(appConfig.createdAt), desc(appConfig.id))
      .limit(limit + 1);

    const records = rows.map((r) => {
      const record = mapRowToRecord(r);
      Object.defineProperty(record, "_cursorV", { value: r.cursorV, enumerable: false });
      return record;
    });

    return buildPage(records, limit, (r) => (r as unknown as { _cursorV: string })._cursorV);
  }
}

export const configService = new ConfigService();
