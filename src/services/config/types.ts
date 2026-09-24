import type {
  ConfigEnvironment,
  ConfigKind,
  ConfigType,
  TargetingRule,
} from "../../lib/validation/config.schemas";

export interface AppConfigRecord {
  id: string;
  organizationId: string | null;
  kind: ConfigKind;
  key: string;
  name: string | null;
  description: string | null;
  value: unknown;
  configType: ConfigType;
  environment: ConfigEnvironment;
  enabled: boolean;
  killSwitch: boolean;
  rolloutPercentage: number;
  targetingRules: TargetingRule[] | null;
  environments: ConfigEnvironment[] | null;
  releaseDate: Date | null;
  defaultValue: unknown;
  previousValue: unknown | null;
  validationSchema: Record<string, unknown> | null;
  validationRules: Record<string, unknown> | null;
  exampleValue: unknown | null;
  changeReason: string;
  version: number;
  isEncrypted: boolean;
  isLocked: boolean;
  isDeprecated: boolean;
  deprecatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagEvaluationContext {
  organizationId?: string | null | undefined;
  userId?: string | null | undefined;
  environment?: ConfigEnvironment | undefined;
  attributes?: Record<string, unknown> | undefined;
  fallback?: boolean | undefined;
}

export interface GetConfigOptions<T = unknown> {
  organizationId?: string | null | undefined;
  environment?: ConfigEnvironment | undefined;
  fallback?: T | undefined;
}

export interface ConfigActor {
  id: string;
  organizationId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface ListConfigOptions {
  kind?: ConfigKind | undefined;
  environment?: ConfigEnvironment | undefined;
  configType?: ConfigType | undefined;
  organizationId?: string | undefined;
  includeGlobal?: boolean | undefined;
  isDeprecated?: boolean | undefined;
  search?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}
