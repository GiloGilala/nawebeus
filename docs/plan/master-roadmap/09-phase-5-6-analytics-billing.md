# Master Roadmap — Phase 5 & Phase 6: Analytics & Billing (§15–§16)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 15. Phase 5 — Analytics & reporting (plan P12, PRD Module 8)

**Entry:** all Phase 4 emitters in place ("build last — it reads from everything").
Schema: `db/shared/analytics*` already active (5 tables) + new aggregate tables (migration via NWB-P0-005 process).
Tickets NWB-P12-001…005 (aggregation upsert workers idempotent, dashboards, scheduled reports + export via P1-005 storage, alert rules every-60s, routes with aggregate-level tenant isolation tests).
**Exit:** aggregates populate; dashboard renders; scheduled report exports; threshold alert fires.
**Performance:** aggregation workers must not block request latency (they are scheduled; verify queue depth alerts from Phase 2 cover them).

---

## 16. Phase 6 — Billing & monetization (plan P13)

**Entry:** Phase 2 (queue, flags, notifications). **D7 resolved: Paystack (NGN) + Stripe (USD) per DEC-025.**
Schema: adopt `db/billing/` (6 tables).
Tickets NWB-P13-001…005 (plans/entitlements, processor integrations + **signature-verified idempotent webhooks** (QA §6.4 test matrix), usage tracking + plan-limit enforcement via P1-009 flags, invoices + dunning worker, routes).
**Concurrency note:** entitlement application + usage counters need the same atomic-increment discipline proven in NWB-P0-008/013 (concurrency tests).
**Naira discipline:** all money in integer kobo (NGN) / cents (USD); QA §3.3 "Naira-specific unit tests" apply to every calculation (QA gate: 100% of billing calculations unit-tested).
**Exit:** customer subscribes → entitlement applies → plan limit enforced (gated action blocked + upgrade prompt) → failed payment retried and surfaced.
**Parallelism:** this phase may run concurrently with Phases 4/5 (independent schema + processor surface); its webhook endpoint is the only public surface.

---

