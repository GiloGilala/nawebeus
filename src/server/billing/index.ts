/**
 * Billing domain (NWB-P13-001) — domain module pattern, five slots.
 *
 * ```
 * constants/billing-constant.ts   leaf: budgets, patterns, thresholds (no I/O)
 * types/billing-types.ts          the API-facing shapes (single owner)
 * schemas/billing.schemas.ts      zod, annotated against the types slot
 * service/billing-service.ts      the business logic (shared by both entries)
 * functions/billing-functions.ts  TanStack Start server functions (web, in-proc)
 * route/billing-route.ts          Hono /api/billing/* (mobile/webhooks/3rd party)
 * ```
 *
 * Dependency direction: constants ← {types, schemas} ← service ←
 * {functions, route}. The route imports the service, never the functions
 * slot or the db layer; the functions slot is a bundle of request-facing
 * server functions only (its helpers are module-private).
 *
 * Sits beside `types/plan-types.ts` and `types/subscription-types.ts` (the
 * jsonb column shapes the db layer consumes) — those are the db-facing
 * halves of the same domain.
 */

export * from "./constants/billing-constant";
export * from "./functions/billing-functions";
export { billingRouter } from "./route/billing-route";
export * from "./schemas/billing.schemas";
export * from "./service/billing-service";
export * from "./types/billing-types";
