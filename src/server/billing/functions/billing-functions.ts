/**
 * Billing server functions (NWB-P13-001).
 *
 * Slot 4 of the domain module pattern — the TanStack Start Server Functions
 * the web app calls in-process (ADR-002). Thin adapters, per the pattern:
 *
 * - shape validation at the edge (the shared zod schemas, annotated against
 *   the types slot); *semantic* validation lives in the service;
 * - actor identity from the session (`getServerAuth`), never the payload —
 *   inputs are whitelisted field-by-field and never spread;
 * - CASL ability asserted per operation (`read billing` / `manage billing`);
 * - rate limits from the constants slot (domain budgets via
 *   `assertRateLimit`, category fan-out via `assertServerRateLimit`);
 * - non-fatal warnings the service carries come back in the response under
 *   `warnings` (the Hono envelope puts the same list in `meta`).
 *
 * Bundle rule: only request-facing functions are exported from this file.
 * TanStack Start turns every export into a callable endpoint, so the shared
 * helpers below are deliberately module-private.
 */
import { createServerFn } from "@/app/lib/createServerFn";
import {
  assertServerAbility,
  assertServerRateLimit,
  getServerAuth,
  getServerClientIp,
  getServerDb,
  getServerHeaders,
  withServerOrgContext,
} from "@/app/server-functions/helpers";
import type { Db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { decodeCursor } from "@/lib/pagination";
import { assertRateLimit } from "@/lib/rate-limit";
import { BILLING_ID_PATTERN, BILLING_RATE_LIMITS } from "../constants/billing-constant";
import {
  addPaymentMethodSchema,
  billingIdSchema,
  cancelSubscriptionSchema,
  createSubscriptionSchema,
  listInvoicesQuerySchema,
  listPaymentMethodsQuerySchema,
  listPlansQuerySchema,
  listSubscriptionsQuerySchema,
  listTransactionsQuerySchema,
  payInvoiceSchema,
  updatePaymentMethodSchema,
} from "../schemas/billing.schemas";
import {
  addPaymentMethod,
  cancelSubscription,
  createSubscription,
  deletePaymentMethod as deletePaymentMethodService,
  getEntitlements,
  getInvoice,
  getPlan,
  getSubscription,
  listInvoices,
  listPaymentMethods,
  listPlans,
  listSubscriptions,
  listTransactions,
  payInvoice,
  resumeSubscription,
  updatePaymentMethod,
} from "../service/billing-service";
import type {
  AddPaymentMethodInput,
  BillingActor,
  CancelSubscriptionInput,
  CreateSubscriptionInput,
  PayInvoiceInput,
  UpdatePaymentMethodInput,
} from "../types/billing-types";

// ── Module-private helpers (never exported — the bundle rule) ────────────────

/**
 * The actor, built only from session + request facts. `orgId`/`userId` come
 * from the verified session, `ip`/`userAgent` from the request headers —
 * nothing the payload can assert travels with the call.
 */
function actorOf(auth: Awaited<ReturnType<typeof getServerAuth>>): BillingActor {
  const headers = getServerHeaders();
  const ip = getServerClientIp();
  return {
    userId: auth.userId,
    orgId: auth.orgId,
    ...(ip ? { ip } : {}),
    ...(headers.userAgent ? { userAgent: headers.userAgent } : {}),
  };
}

/** Decode a cursor string from a query schema, 422 on garbage. */
function decodeOr422(cursor: string | null | undefined): {
  v: string;
  id: string;
} | null {
  if (cursor === null || cursor === undefined || cursor === "") return null;
  const decoded = decodeCursor(cursor, { idPattern: BILLING_ID_PATTERN });
  if (decoded === null) {
    throw new ValidationError("Invalid pagination parameter", [
      { field: "cursor", message: "Malformed cursor" },
    ]);
  }
  return decoded;
}

/** Domain budget for a user-keyed operation (constants slot, NWB-P13-001). */
function domainBudget(
  db: Db,
  keyPrefix: string,
  userId: string,
  budget: { max: number; windowMs: number },
): Promise<void> {
  return assertRateLimit(
    db,
    `billing:${keyPrefix}:${userId}`,
    budget.max,
    budget.windowMs,
    "Too many billing operations. Try again in a moment.",
  );
}

// ── Plans ────────────────────────────────────────────────────────────────────

export const listPlansServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listPlansQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const query = data as ReturnType<typeof listPlansQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const page = await withServerOrgContext(auth, () =>
      listPlans(db, {
        limit: query.limit,
        cursor: decodeOr422(query.cursor),
      }),
    );
    return { plans: page.items, pageInfo: page.pageInfo };
  });

export const getPlanServerFn = createServerFn({ method: "GET" })
  .validator(billingIdSchema)
  .handler(async ({ data }) => {
    const planId = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const plan = await withServerOrgContext(auth, () => getPlan(db, planId));
    return { plan };
  });

// ── Subscriptions ────────────────────────────────────────────────────────────

export const listSubscriptionsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listSubscriptionsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const query = data as ReturnType<typeof listSubscriptionsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const page = await withServerOrgContext(auth, () =>
      listSubscriptions(db, {
        orgId: auth.orgId,
        limit: query.limit,
        cursor: decodeOr422(query.cursor),
      }),
    );
    return { subscriptions: page.items, pageInfo: page.pageInfo };
  });

export const getSubscriptionServerFn = createServerFn({ method: "GET" })
  .validator(billingIdSchema)
  .handler(async ({ data }) => {
    const subscriptionId = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const subscription = await withServerOrgContext(auth, () =>
      getSubscription(db, auth.orgId, subscriptionId),
    );
    return { subscription };
  });

export const createSubscriptionServerFn = createServerFn({ method: "POST" })
  .validator(createSubscriptionSchema)
  .handler(async ({ data }) => {
    const input = data as CreateSubscriptionInput;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "subscription",
      auth.userId,
      BILLING_RATE_LIMITS.subscriptionChangePerHour,
    );

    // Whitelist the input field-by-field (never spread client input into the
    // service call — the service trusts only what the validator whitelisted).
    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      createSubscription(db, actor, {
        planId: input.planId,
        billingCycle: input.billingCycle,
        ...(input.seats !== undefined ? { seats: input.seats } : {}),
        ...(input.startTrial !== undefined ? { startTrial: input.startTrial } : {}),
      }),
    );
    return {
      subscription: result.subscription,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

export const cancelSubscriptionServerFn = createServerFn({ method: "POST" })
  .validator(billingIdSchema.and(cancelSubscriptionSchema))
  .handler(async ({ data }) => {
    const parsed = data as unknown as { id: string } & CancelSubscriptionInput;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "subscription",
      auth.userId,
      BILLING_RATE_LIMITS.subscriptionChangePerHour,
    );

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      cancelSubscription(db, actor, auth.orgId, parsed.id, {
        atPeriodEnd: parsed.atPeriodEnd,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      }),
    );
    return {
      subscription: result.subscription,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

export const resumeSubscriptionServerFn = createServerFn({ method: "POST" })
  .validator(billingIdSchema)
  .handler(async ({ data }) => {
    const subscriptionId = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "subscription",
      auth.userId,
      BILLING_RATE_LIMITS.subscriptionChangePerHour,
    );

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      resumeSubscription(db, actor, auth.orgId, subscriptionId),
    );
    return {
      subscription: result.subscription,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

// ── Invoices ─────────────────────────────────────────────────────────────────

export const listInvoicesServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listInvoicesQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const query = data as ReturnType<typeof listInvoicesQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const page = await withServerOrgContext(auth, () =>
      listInvoices(db, {
        orgId: auth.orgId,
        ...(query.status !== null && query.status !== undefined ? { status: query.status } : {}),
        ...(query.type !== null && query.type !== undefined ? { type: query.type } : {}),
        limit: query.limit,
        cursor: decodeOr422(query.cursor),
      }),
    );
    return { invoices: page.items, pageInfo: page.pageInfo };
  });

export const getInvoiceServerFn = createServerFn({ method: "GET" })
  .validator(billingIdSchema)
  .handler(async ({ data }) => {
    const invoiceId = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const invoice = await withServerOrgContext(auth, () => getInvoice(db, auth.orgId, invoiceId));
    return { invoice };
  });

export const payInvoiceServerFn = createServerFn({ method: "POST" })
  .validator(billingIdSchema.and(payInvoiceSchema))
  .handler(async ({ data }) => {
    const parsed = data as unknown as { id: string } & PayInvoiceInput;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    // Money moves: the domain budget sits on top of the category fan-out.
    await domainBudget(db, "pay-invoice", auth.userId, BILLING_RATE_LIMITS.invoicePayPerMinute);

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      payInvoice(db, actor, auth.orgId, parsed.id, {
        paymentMethodId: parsed.paymentMethodId,
        ...(parsed.idempotencyKey !== undefined ? { idempotencyKey: parsed.idempotencyKey } : {}),
      }),
    );
    return {
      payment: result.payment,
      idempotentReplay: result.idempotentReplay,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

// ── Transactions ─────────────────────────────────────────────────────────────

export const listTransactionsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listTransactionsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const query = data as ReturnType<typeof listTransactionsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const page = await withServerOrgContext(auth, () =>
      listTransactions(db, {
        orgId: auth.orgId,
        ...(query.type !== null && query.type !== undefined ? { type: query.type } : {}),
        ...(query.status !== null && query.status !== undefined ? { status: query.status } : {}),
        limit: query.limit,
        cursor: decodeOr422(query.cursor),
      }),
    );
    return { transactions: page.items, pageInfo: page.pageInfo };
  });

// ── Payment methods ──────────────────────────────────────────────────────────

export const listPaymentMethodsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listPaymentMethodsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const query = data as ReturnType<typeof listPaymentMethodsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "billing");
    const db = getServerDb();
    await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

    const page = await withServerOrgContext(auth, () =>
      listPaymentMethods(db, {
        orgId: auth.orgId,
        limit: query.limit,
        cursor: decodeOr422(query.cursor),
      }),
    );
    return { paymentMethods: page.items, pageInfo: page.pageInfo };
  });

export const addPaymentMethodServerFn = createServerFn({ method: "POST" })
  .validator(addPaymentMethodSchema)
  .handler(async ({ data }) => {
    const input = data as AddPaymentMethodInput;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "payment-method",
      auth.userId,
      BILLING_RATE_LIMITS.paymentMethodChangePerHour,
    );

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      addPaymentMethod(db, actor, auth.orgId, {
        kind: input.kind,
        processorPaymentMethodId: input.processorPaymentMethodId,
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.processor !== undefined ? { processor: input.processor } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.last4 !== undefined ? { last4: input.last4 } : {}),
        ...(input.expMonth !== undefined ? { expMonth: input.expMonth } : {}),
        ...(input.expYear !== undefined ? { expYear: input.expYear } : {}),
      }),
    );
    return {
      paymentMethod: result.paymentMethod,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

export const updatePaymentMethodServerFn = createServerFn({ method: "POST" })
  .validator(billingIdSchema.and(updatePaymentMethodSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & UpdatePaymentMethodInput;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "payment-method",
      auth.userId,
      BILLING_RATE_LIMITS.paymentMethodChangePerHour,
    );

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      updatePaymentMethod(db, actor, auth.orgId, parsed.id, {
        ...(parsed.nickname !== undefined ? { nickname: parsed.nickname } : {}),
        ...(parsed.isDefault !== undefined ? { isDefault: parsed.isDefault } : {}),
      }),
    );
    return {
      paymentMethod: result.paymentMethod,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

export const deletePaymentMethodServerFn = createServerFn({ method: "POST" })
  .validator(billingIdSchema)
  .handler(async ({ data }) => {
    const paymentMethodId = data as string;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "billing");
    const db = getServerDb();
    await assertServerRateLimit({
      category: "write",
      userId: auth.userId,
      ip: getServerClientIp(),
    });
    await domainBudget(
      db,
      "payment-method",
      auth.userId,
      BILLING_RATE_LIMITS.paymentMethodChangePerHour,
    );

    const actor = actorOf(auth);
    const result = await withServerOrgContext(auth, () =>
      deletePaymentMethodService(db, actor, auth.orgId, paymentMethodId),
    );
    return {
      deleted: result.deleted,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  });

// ── Usage & entitlements ─────────────────────────────────────────────────────

export const getEntitlementsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "billing");
  const db = getServerDb();
  await assertServerRateLimit({ category: "read", userId: auth.userId, ip: getServerClientIp() });

  const entitlements = await withServerOrgContext(auth, () => getEntitlements(db, auth.orgId));
  return { entitlements };
});
