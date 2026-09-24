/**
 * TanStack Start Server Functions — Alerts and Notifications domain (NWB-P1-008).
 *
 * Thin adapters: validate with shared Zod schemas, derive orgId & userId from
 * the session (never the payload), assert CASL abilities, and delegate to services.
 */

import { ValidationError } from "@/lib/errors";
import { decodeCursor } from "@/lib/pagination";
import {
  ALERT_EVENT_ID_PATTERN,
  ALERT_RULE_ID_PATTERN,
  acknowledgeAlertSchema,
  alertEventIdSchema,
  alertRuleIdSchema,
  createAlertRuleSchema,
  escalateAlertSchema,
  fireAlertSchema,
  listAlertEventsQuerySchema,
  listAlertRulesQuerySchema,
  updateAlertRuleSchema,
} from "@/lib/validation";
import {
  acknowledgeAlert,
  createAlertRule,
  deleteAlertRule,
  escalateAlert,
  fireAlert,
  getAlertEventById,
  getAlertRuleById,
  getUnreadAlertCount,
  listAlertEvents,
  listAlertRules,
  markAlertAsRead,
  markAllAlertsAsRead,
  updateAlertRule,
} from "@/services/alerts";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

// ── ALERT RULES ──────────────────────────────────────────────────────────────

export const createAlertRuleServerFn = createServerFn({ method: "POST" })
  .validator(createAlertRuleSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createAlertRuleSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "alerts");
    const db = getServerDb();

    const created = await withServerOrgContext(auth, () =>
      createAlertRule(db, auth.orgId, auth.userId, parsed),
    );
    return { rule: created };
  });

export const listAlertRulesServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listAlertRulesQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listAlertRulesQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "alerts");
    const db = getServerDb();

    let cursor: { v: string; id: string } | null = null;
    if (parsed.cursor) {
      cursor = decodeCursor(parsed.cursor, { idPattern: ALERT_RULE_ID_PATTERN });
      if (cursor === null) {
        throw new ValidationError("Invalid pagination parameter", [
          { field: "cursor", message: "Malformed cursor" },
        ]);
      }
    }

    const result = await withServerOrgContext(auth, () =>
      listAlertRules(db, {
        orgId: auth.orgId,
        sourceModule: parsed.sourceModule,
        conditionType: parsed.conditionType,
        isActive: parsed.isActive,
        limit: parsed.limit,
        cursor,
      }),
    );
    return { rules: result.items, pageInfo: result.pageInfo };
  });

export const getAlertRuleServerFn = createServerFn({ method: "GET" })
  .validator(alertRuleIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "alerts");
    const db = getServerDb();

    const rule = await withServerOrgContext(auth, () =>
      getAlertRuleById(db, parsed.id, auth.orgId),
    );
    return { rule };
  });

export const updateAlertRuleServerFn = createServerFn({ method: "POST" })
  .validator(alertRuleIdSchema.and(updateAlertRuleSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof updateAlertRuleSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "alerts");
    const db = getServerDb();

    const { id, ...updateFields } = parsed;
    const updated = await withServerOrgContext(auth, () =>
      updateAlertRule(db, id, auth.orgId, auth.userId, updateFields, {
        ...(parsed.version !== undefined ? { expectedVersion: parsed.version } : {}),
      }),
    );
    return { rule: updated };
  });

export const deleteAlertRuleServerFn = createServerFn({ method: "POST" })
  .validator(alertRuleIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "alerts");
    const db = getServerDb();

    const result = await withServerOrgContext(auth, () =>
      deleteAlertRule(db, parsed.id, auth.orgId, auth.userId),
    );
    return result;
  });

// ── ALERT EVENTS & DISPATCH ──────────────────────────────────────────────────

export const fireAlertServerFn = createServerFn({ method: "POST" })
  .validator(fireAlertSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof fireAlertSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "alerts");
    const db = getServerDb();

    const result = await withServerOrgContext(auth, () => fireAlert(db, auth.orgId, parsed));
    return result;
  });

export const listAlertEventsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listAlertEventsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listAlertEventsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "alerts");
    const db = getServerDb();

    let cursor: { v: string; id: string } | null = null;
    if (parsed.cursor) {
      cursor = decodeCursor(parsed.cursor, { idPattern: ALERT_EVENT_ID_PATTERN });
      if (cursor === null) {
        throw new ValidationError("Invalid pagination parameter", [
          { field: "cursor", message: "Malformed cursor" },
        ]);
      }
    }

    const result = await withServerOrgContext(auth, () =>
      listAlertEvents(db, {
        orgId: auth.orgId,
        ruleId: parsed.ruleId,
        sourceModule: parsed.sourceModule,
        severity: parsed.severity,
        isRead: parsed.isRead,
        isAcknowledged: parsed.isAcknowledged,
        limit: parsed.limit,
        cursor,
      }),
    );
    return { events: result.items, pageInfo: result.pageInfo };
  });

export const getUnreadAlertCountServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "alerts");
  const db = getServerDb();

  const result = await withServerOrgContext(auth, () => getUnreadAlertCount(db, auth.orgId));
  return result;
});

export const getAlertEventServerFn = createServerFn({ method: "GET" })
  .validator(alertEventIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "alerts");
    const db = getServerDb();

    const event = await withServerOrgContext(auth, () =>
      getAlertEventById(db, parsed.id, auth.orgId),
    );
    return { event };
  });

export const markAlertAsReadServerFn = createServerFn({ method: "POST" })
  .validator(alertEventIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "alerts");
    const db = getServerDb();

    const event = await withServerOrgContext(auth, () =>
      markAlertAsRead(db, parsed.id, auth.orgId, true),
    );
    return { event };
  });

export const markAllAlertsAsReadServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "alerts");
  const db = getServerDb();

  const result = await withServerOrgContext(auth, () => markAllAlertsAsRead(db, auth.orgId));
  return result;
});

export const acknowledgeAlertServerFn = createServerFn({ method: "POST" })
  .validator(alertEventIdSchema.and(acknowledgeAlertSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof acknowledgeAlertSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "alerts");
    const db = getServerDb();

    const event = await withServerOrgContext(auth, () =>
      acknowledgeAlert(db, parsed.id, auth.orgId, auth.userId, parsed.notes),
    );
    return { event };
  });

export const escalateAlertServerFn = createServerFn({ method: "POST" })
  .validator(alertEventIdSchema.and(escalateAlertSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof escalateAlertSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "alerts");
    const db = getServerDb();

    const event = await withServerOrgContext(auth, () =>
      escalateAlert(db, parsed.id, auth.orgId, auth.userId, parsed.escalatedToId, parsed.notes),
    );
    return { event };
  });
