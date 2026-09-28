/**
 * Billing Hono routes (NWB-P13-001).
 *
 * Slot 5 of the domain module pattern — the `/api/billing/*` surface for
 * mobile, webhooks and third-party integrations (the web app calls the
 * functions slot in-process instead, ADR-002). Per the pattern:
 *
 * - this slot imports the *service* (and the types/constants/schemas slots) —
 *   never the functions slot and never the db layer; the database handle is
 *   the request's (`c.var.db`), supplied by middleware;
 * - shape validation at the edge (shared zod schemas), semantic validation in
 *   the service;
 * - actor identity from the session (`c.var.user`), never the body: `ip` from
 *   the client headers, `userAgent` from the request — the whitelist is
 *   explicit and nothing is spread;
 * - `success(data, meta?)` envelopes; list endpoints carry the cursor page in
 *   `meta.pagination` (the envelope's meta slot, discrepancy D-17);
 * - CASL per route (`read billing` / `manage billing`); domain rate budgets
 *   from the constants slot on top of the shared limiter.
 */

import type { Context } from "hono";
import { Hono } from "hono";
import type { ZodError, ZodType } from "zod";
import { getConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { assertRateLimit } from "@/lib/rate-limit";
import { success } from "@/lib/response";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import { BILLING_ID_PATTERN, BILLING_RATE_LIMITS } from "../constants/billing-constant";
import {
  addPaymentMethodSchema,
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
  deletePaymentMethod,
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

export const billingRouter = new Hono();

billingRouter.use("/billing/*", authMiddleware);
billingRouter.use("/billing", authMiddleware);

// ── Edge helpers (module-private) ────────────────────────────────────────────

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function validationDetails(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

/** Parse a shared zod schema or throw the shared 422 envelope. */
function parseOr422<T>(schema: ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(label, validationDetails(parsed.error));
  }
  return parsed.data;
}

/** Path param → validated id → 404 (a bad id reads as "not found", like every other area). */
function idParam(c: Context, name: string): string {
  const id = c.req.param(name) ?? "";
  if (!BILLING_ID_PATTERN.test(id)) {
    throw new NotFoundError("Resource not found");
  }
  return id;
}

/** The actor from session + request facts only (never the body). */
function actorOf(c: Context): BillingActor {
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  return {
    userId: c.var.user.userId,
    orgId: c.var.user.orgId,
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

/** Domain budget (constants slot) on the request's database handle. */
function assertDomainBudget(
  c: Context,
  keyPrefix: string,
  budget: { max: number; windowMs: number },
): Promise<void> {
  return assertRateLimit(
    c.var.db,
    `billing:${keyPrefix}:${c.var.user.userId}`,
    budget.max,
    budget.windowMs,
    "Too many billing operations. Try again in a moment.",
  );
}

// ── Plans ────────────────────────────────────────────────────────────────────

// GET /api/billing/plans — the platform plan catalog
billingRouter.get("/billing/plans", requireAbility("read", "billing"), async (c) => {
  const { limit, cursor } = parsePagination(new URL(c.req.url), { idPattern: BILLING_ID_PATTERN });
  parseOr422(listPlansQuerySchema, c.req.query(), "Invalid query parameters");
  const page = await listPlans(c.var.db, { limit, cursor });
  return c.json(success({ plans: page.items }, paginationMeta(page.pageInfo)));
});

// GET /api/billing/plans/:id — one plan
billingRouter.get("/billing/plans/:id", requireAbility("read", "billing"), async (c) => {
  const plan = await getPlan(c.var.db, idParam(c, "id"));
  return c.json(success({ plan }));
});

// ── Subscriptions ────────────────────────────────────────────────────────────

// GET /api/billing/subscriptions — the org's subscriptions (cursor page)
billingRouter.get("/billing/subscriptions", requireAbility("read", "billing"), async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url, { idPattern: BILLING_ID_PATTERN });
  parseOr422(listSubscriptionsQuerySchema, c.req.query(), "Invalid query parameters");
  const page = await listSubscriptions(c.var.db, {
    orgId: c.var.user.orgId,
    limit,
    cursor,
  });
  return c.json(success({ subscriptions: page.items }, paginationMeta(page.pageInfo)));
});

// GET /api/billing/subscriptions/:id — one subscription
billingRouter.get("/billing/subscriptions/:id", requireAbility("read", "billing"), async (c) => {
  const subscription = await getSubscription(c.var.db, c.var.user.orgId, idParam(c, "id"));
  return c.json(success({ subscription }));
});

// POST /api/billing/subscriptions — subscribe (manual activation; one active per org)
billingRouter.post("/billing/subscriptions", requireAbility("update", "billing"), async (c) => {
  await assertDomainBudget(c, "subscription", BILLING_RATE_LIMITS.subscriptionChangePerHour);
  const input = parseOr422(
    createSubscriptionSchema,
    await readJsonBody(c),
    "Invalid subscription input",
  ) as CreateSubscriptionInput;

  const result = await createSubscription(c.var.db, actorOf(c), {
    planId: input.planId,
    billingCycle: input.billingCycle,
    ...(input.seats !== undefined ? { seats: input.seats } : {}),
    ...(input.startTrial !== undefined ? { startTrial: input.startTrial } : {}),
  });
  return c.json(
    success(
      { subscription: result.subscription },
      result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
    ),
    201,
  );
});

// POST /api/billing/subscriptions/:id/cancel — cancel (now or at period end)
billingRouter.post(
  "/billing/subscriptions/:id/cancel",
  requireAbility("update", "billing"),
  async (c) => {
    await assertDomainBudget(c, "subscription", BILLING_RATE_LIMITS.subscriptionChangePerHour);
    const input = parseOr422(
      cancelSubscriptionSchema,
      await readJsonBody(c),
      "Invalid cancellation input",
    ) as CancelSubscriptionInput;

    const result = await cancelSubscription(
      c.var.db,
      actorOf(c),
      c.var.user.orgId,
      idParam(c, "id"),
      {
        atPeriodEnd: input.atPeriodEnd,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
    );
    return c.json(
      success(
        { subscription: result.subscription },
        result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
      ),
    );
  },
);

// POST /api/billing/subscriptions/:id/resume — resume a paused subscription
billingRouter.post(
  "/billing/subscriptions/:id/resume",
  requireAbility("update", "billing"),
  async (c) => {
    await assertDomainBudget(c, "subscription", BILLING_RATE_LIMITS.subscriptionChangePerHour);
    const result = await resumeSubscription(
      c.var.db,
      actorOf(c),
      c.var.user.orgId,
      idParam(c, "id"),
    );
    return c.json(
      success(
        { subscription: result.subscription },
        result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
      ),
    );
  },
);

// ── Invoices ─────────────────────────────────────────────────────────────────

// GET /api/billing/invoices — the org's invoices (cursor page)
billingRouter.get("/billing/invoices", requireAbility("read", "billing"), async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url, { idPattern: BILLING_ID_PATTERN });
  const query = parseOr422(listInvoicesQuerySchema, c.req.query(), "Invalid query parameters");
  const page = await listInvoices(c.var.db, {
    orgId: c.var.user.orgId,
    ...(query.status !== null && query.status !== undefined ? { status: query.status } : {}),
    ...(query.type !== null && query.type !== undefined ? { type: query.type } : {}),
    limit,
    cursor,
  });
  return c.json(success({ invoices: page.items }, paginationMeta(page.pageInfo)));
});

// GET /api/billing/invoices/:id — one invoice
billingRouter.get("/billing/invoices/:id", requireAbility("read", "billing"), async (c) => {
  const invoice = await getInvoice(c.var.db, c.var.user.orgId, idParam(c, "id"));
  return c.json(success({ invoice }));
});

// POST /api/billing/invoices/:id/pay — pay an open/overdue invoice (atomic)
billingRouter.post("/billing/invoices/:id/pay", requireAbility("update", "billing"), async (c) => {
  await assertDomainBudget(c, "pay-invoice", BILLING_RATE_LIMITS.invoicePayPerMinute);
  const input = parseOr422(
    payInvoiceSchema,
    await readJsonBody(c),
    "Invalid payment input",
  ) as PayInvoiceInput;

  const result = await payInvoice(c.var.db, actorOf(c), c.var.user.orgId, idParam(c, "id"), {
    paymentMethodId: input.paymentMethodId,
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
  });
  return c.json(
    success(
      { payment: result.payment, idempotentReplay: result.idempotentReplay },
      result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
    ),
  );
});

// ── Transactions (ledger) ────────────────────────────────────────────────────

// GET /api/billing/transactions — the org's ledger history (cursor page)
billingRouter.get("/billing/transactions", requireAbility("read", "billing"), async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url, { idPattern: BILLING_ID_PATTERN });
  const query = parseOr422(listTransactionsQuerySchema, c.req.query(), "Invalid query parameters");
  const page = await listTransactions(c.var.db, {
    orgId: c.var.user.orgId,
    ...(query.type !== null && query.type !== undefined ? { type: query.type } : {}),
    ...(query.status !== null && query.status !== undefined ? { status: query.status } : {}),
    limit,
    cursor,
  });
  return c.json(success({ transactions: page.items }, paginationMeta(page.pageInfo)));
});

// ── Payment methods ──────────────────────────────────────────────────────────

// GET /api/billing/payment-methods — the org's methods (masked view)
billingRouter.get("/billing/payment-methods", requireAbility("read", "billing"), async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url, { idPattern: BILLING_ID_PATTERN });
  parseOr422(listPaymentMethodsQuerySchema, c.req.query(), "Invalid query parameters");
  const page = await listPaymentMethods(c.var.db, {
    orgId: c.var.user.orgId,
    limit,
    cursor,
  });
  return c.json(success({ paymentMethods: page.items }, paginationMeta(page.pageInfo)));
});

// POST /api/billing/payment-methods — attach a processor-token-backed method
billingRouter.post("/billing/payment-methods", requireAbility("update", "billing"), async (c) => {
  await assertDomainBudget(c, "payment-method", BILLING_RATE_LIMITS.paymentMethodChangePerHour);
  const input = parseOr422(
    addPaymentMethodSchema,
    await readJsonBody(c),
    "Invalid payment method input",
  ) as AddPaymentMethodInput;

  const result = await addPaymentMethod(c.var.db, actorOf(c), c.var.user.orgId, {
    kind: input.kind,
    processorPaymentMethodId: input.processorPaymentMethodId,
    ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    ...(input.processor !== undefined ? { processor: input.processor } : {}),
    ...(input.brand !== undefined ? { brand: input.brand } : {}),
    ...(input.last4 !== undefined ? { last4: input.last4 } : {}),
    ...(input.expMonth !== undefined ? { expMonth: input.expMonth } : {}),
    ...(input.expYear !== undefined ? { expYear: input.expYear } : {}),
  });
  return c.json(
    success(
      { paymentMethod: result.paymentMethod },
      result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
    ),
    201,
  );
});

// PATCH /api/billing/payment-methods/:id — nickname / default flag
billingRouter.patch(
  "/billing/payment-methods/:id",
  requireAbility("update", "billing"),
  async (c) => {
    await assertDomainBudget(c, "payment-method", BILLING_RATE_LIMITS.paymentMethodChangePerHour);
    const input = parseOr422(
      updatePaymentMethodSchema,
      await readJsonBody(c),
      "Invalid payment method input",
    ) as UpdatePaymentMethodInput;

    const result = await updatePaymentMethod(
      c.var.db,
      actorOf(c),
      c.var.user.orgId,
      idParam(c, "id"),
      {
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    );
    return c.json(
      success(
        { paymentMethod: result.paymentMethod },
        result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
      ),
    );
  },
);

// DELETE /api/billing/payment-methods/:id — soft-delete
billingRouter.delete(
  "/billing/payment-methods/:id",
  requireAbility("update", "billing"),
  async (c) => {
    await assertDomainBudget(c, "payment-method", BILLING_RATE_LIMITS.paymentMethodChangePerHour);
    const result = await deletePaymentMethod(
      c.var.db,
      actorOf(c),
      c.var.user.orgId,
      idParam(c, "id"),
    );
    return c.json(
      success(
        { deleted: true },
        result.warnings.length > 0 ? { warnings: result.warnings } : undefined,
      ),
    );
  },
);

// ── Usage & entitlements ─────────────────────────────────────────────────────

// GET /api/billing/entitlements — resolved entitlements + metered usage
billingRouter.get("/billing/entitlements", requireAbility("read", "billing"), async (c) => {
  const entitlements = await getEntitlements(c.var.db, c.var.user.orgId);
  return c.json(success({ entitlements }));
});
