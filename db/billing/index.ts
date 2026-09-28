// db/billing/index.ts
//
// Billing & monetization module (P13).
//
// ADOPTED 2026-09-27 by NWB-P13-001 (ground rule 7 / migration-doc M2): exports joined
// `db/schema.ts`, the tsconfig exclude was removed, migration 0012 creates the six tables.
//
// The module arrived as a verbatim copy of a monorepo schema (`packages/database/schema/
// billing`) with broken imports — `../auth/users` (this repo keeps users in `db/core`),
// `../enums` and `../schema-utils` (this repo keeps them in `db/shared`) — and with
// divergent/duplicated pgEnum definitions. The adoption reconciled:
//
//   Imports:
//     users        → ../core/users
//     enums        → ../shared/enums
//     schema-utils → ../shared/schema-utils
//     jsonb shapes → @/server/billing/types/{plan-types,subscription-types}
//                    (the db layer consumes types from src/server/<domain>/types,
//                    never from src/services — see plan-types.ts header)
//
//   Enums (single source of truth is db/shared/enums.ts):
//     payment_method_type, card_brand, invoice_status
//        → pre-existing shared canonicals; the local Stripe-era copies (paypal,
//          apple_pay, sepa_debit, discover, jcb, ...) were dropped — the Paystack
//          processor (decision D7) does not offer them.
//     payment_processor, settlement_status, risk_level
//        → each was defined locally in TWO billing files with divergent value sets;
//          deduped to the shared union (paystack first, per D7; `manual` for
//          processor-less v1 records).
//     currency, plan_status, pricing_model, billing_cycle, product_type,
//       subscription_cancel_reason, payment_status, billing_transaction_status,
//       billing_transaction_category
//        → new shared entries (see the "BILLING — db/billing adoption" section).
//     subscription_status, subscription_plan, plan_tier
//        → reused from the pre-existing shared enums, not redefined.
//     invoice_type, collection_method, invoice_origin, invoice_created_from,
//       payment_method_status, card_funding, bank_account_type, processor_type,
//       risk_level, payment_type, refund_reason, action_type,
//       payment_initiator, payment_created_via, subscription_type,
//       transaction_type, processor_status, transaction_origin, dispute_status
//        → relocated into the shared billing section of db/shared/enums.ts
//          (single registry for enum values; the table files import them).
//
//   Two schema defects fixed in the source (they could never have migrated):
//     - subscriptions.type was typed with the plan-tier enum but stores scopes
//       (personal/organization) → now its own `subscription_type` enum.
//     - two payment_methods index predicates anchored on `now()` (STABLE),
//       which Postgres rejects in index predicates → predicates de-anchored.
//
// Tables:
//   plans            — platform-wide plan catalog (no organization_id by design)
//   subscriptions    — one organization's active product subscription
//   invoices         — billing documents (subscription, one_time, overage, ...)
//   payments         — payment attempts/captures against invoices or subscriptions
//   payment-methods  — stored payment instruments (v1: schema only — tokenization
//                      belongs to the processor integration, NWB-P13-002)
//   transactions     — double-entry-ish ledger for accounting exports (v1: schema
//                      only — written by the dunning/ledger jobs, NWB-P13-004)
//
// `db/relations.ts` is untouched (it re-exports cross-module relations for the
// dormant modules and stays excluded from tsconfig).

export * from "./invoices";
export * from "./payment-methods";
export * from "./payments";
export * from "./plans";
export * from "./subscriptions";
export * from "./transactions";
