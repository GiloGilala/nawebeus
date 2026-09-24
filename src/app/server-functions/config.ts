/**
 * TanStack Start Server Functions — Feature Flags and System Config domain (NWB-P1-009).
 *
 * Thin adapters: validate with shared Zod schemas, derive orgId & userId from
 * the session (never the payload), assert CASL abilities, and delegate to services.
 */

import { z } from "zod";
import {
  type ConfigEnvironment,
  configEnvironmentSchema,
  configIdSchema,
  configKeySchema,
  createAppConfigSchema,
  createFeatureFlagSchema,
  evaluateFlagSchema,
  listAppConfigQuerySchema,
  rollbackAppConfigSchema,
  updateAppConfigSchema,
} from "@/lib/validation";
import { configService } from "@/services/config";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

// ── EVALUATION & RETRIEVAL ───────────────────────────────────────────────────

export const evaluateFlagServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => evaluateFlagSchema.parse(raw))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof evaluateFlagSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "flags");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      configService.evaluateFlag(db, parsed.key, {
        organizationId: parsed.organizationId ?? auth.orgId,
        userId: parsed.userId ?? auth.userId,
        environment: parsed.environment,
        attributes: parsed.attributes,
        fallback: parsed.fallback,
      }),
    );
  });

export const getConfigValueServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        key: configKeySchema,
        environment: configEnvironmentSchema.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const parsed = data as { key: string; environment?: ConfigEnvironment };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "config");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      configService.getConfigValue(db, parsed.key, {
        organizationId: auth.orgId,
        environment: parsed.environment,
      }),
    );
  });

// ── CONFIG & FLAGS CRUD ──────────────────────────────────────────────────────

export const createFeatureFlagServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => createFeatureFlagSchema.parse(raw))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createFeatureFlagSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "flags");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      configService.createFeatureFlag(
        db,
        {
          ...parsed,
          organizationId: parsed.organizationId ?? auth.orgId,
        },
        {
          id: auth.userId,
          organizationId: auth.orgId,
        },
      ),
    );
  });

export const createAppConfigServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => createAppConfigSchema.parse(raw))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createAppConfigSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "config");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      configService.createAppConfig(
        db,
        {
          ...parsed,
          organizationId: parsed.organizationId ?? auth.orgId,
        },
        {
          id: auth.userId,
          organizationId: auth.orgId,
        },
      ),
    );
  });

export const getAppConfigServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => configIdSchema.parse(raw))
  .handler(async ({ data }) => {
    const id = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "flags");
    const db = getServerDb();

    return withServerOrgContext(auth, () => configService.getAppConfigById(db, id, auth.orgId));
  });

export const listAppConfigsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listAppConfigQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listAppConfigQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "flags");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      configService.listAppConfigs(db, {
        ...parsed,
        organizationId: parsed.organizationId ?? auth.orgId,
      }),
    );
  });

export const updateAppConfigServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: configIdSchema,
        data: updateAppConfigSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const parsed = data as {
      id: string;
      data: ReturnType<typeof updateAppConfigSchema.parse>;
    };
    const auth = await getServerAuth();
    const db = getServerDb();
    const existing = await configService.getAppConfigById(db, parsed.id, auth.orgId);
    const subject = existing.kind === "feature_flag" ? "flags" : "config";
    assertServerAbility(auth, "update", subject);

    return withServerOrgContext(auth, () =>
      configService.updateAppConfig(db, parsed.id, parsed.data, {
        id: auth.userId,
        organizationId: auth.orgId,
      }),
    );
  });

export const rollbackAppConfigServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: configIdSchema,
        data: rollbackAppConfigSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const parsed = data as {
      id: string;
      data: ReturnType<typeof rollbackAppConfigSchema.parse>;
    };
    const auth = await getServerAuth();
    const db = getServerDb();
    const existing = await configService.getAppConfigById(db, parsed.id, auth.orgId);
    const subject = existing.kind === "feature_flag" ? "flags" : "config";
    assertServerAbility(auth, "update", subject);

    return withServerOrgContext(auth, () =>
      configService.rollbackAppConfig(db, parsed.id, parsed.data, {
        id: auth.userId,
        organizationId: auth.orgId,
      }),
    );
  });

export const deleteAppConfigServerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => configIdSchema.parse(raw))
  .handler(async ({ data }) => {
    const id = data as string;
    const auth = await getServerAuth();
    const db = getServerDb();
    const existing = await configService.getAppConfigById(db, id, auth.orgId);
    const subject = existing.kind === "feature_flag" ? "flags" : "config";
    assertServerAbility(auth, "delete", subject);

    await withServerOrgContext(auth, () =>
      configService.deleteAppConfig(db, id, {
        id: auth.userId,
        organizationId: auth.orgId,
      }),
    );

    return { deleted: true };
  });
