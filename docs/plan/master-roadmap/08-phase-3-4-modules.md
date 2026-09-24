# Master Roadmap — Phase 3 & Phase 4: Social Accounts & Domain Modules (§13–§14)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 13. Phase 3 — Social accounts & platform integration (plan P2, PRD Module 3)

**Slug:** `.scratch/p2-social-accounts/`. **Entry gate:** Phase 2 exit.
**Schema adoption:** `db/social-accounts/` (4 tables) per ground rule 7 — review against `docs/modules/Social Media Integration.md` before wiring (plan risk #1: aspirational schema is a design asset, not a verified one).

| ID | Ticket | Notes |
|---|---|---|
| NWB-P2-001 | OAuth flow (initiate, single-use state with TTL, callback, connect) | ✅ **DONE 2026-09-24** — `.scratch/p2-social-accounts/issues/01-oauth-flow.md`: schema adopted (0011, ids 64 from birth), `src/lib/crypto.ts` AES-256-GCM, DEC-009 registry + injectable-fetch exchange client, single-use state machine (replay test), `/api/social` initiate + public callback, `socialaccounts.connect` seeded manager+; 889/889. Was: `db/social-accounts/` aspirational, no OAuth code |
| NWB-P2-002 | Token lifecycle (encrypted at rest, refresh worker, rotation, failure surfacing) | **Encryption:** spec requires AES-256 for tokens; use `crypto.subtle` (Bun native) behind a small `src/lib/crypto.ts` helper — record as new-but-justified (existing `tokens.ts` is for one-time web tokens, not OAuth secrets). |
| NWB-P2-003 | Account health checks + circuit breaker | Breaker must block dispatch (P3/P7 consumers). |
| NWB-P2-004 | Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`) | Feeds P13 plan limits. |
| NWB-P2-005 | Platform adapters × 5 (YouTube, X, Instagram, Facebook, Reddit — DEC-009) | XL → split into 5 tickets, one per platform; adapter interface first (PRD 8.3.2 "integration abstraction layer"). |
| NWB-P2-006 | Routes (list, connect, callback, delete, health) | Envelope + RBAC (`socialaccounts.*` permissions added to seed — extend the P1-014 role matrix). |

**Exit gate (plan):** all five platforms connect, refresh unattended, report health; breaker trips and recovers demonstrably.
**Security note:** OAuth callback is a public endpoint — CSRF via state single-use (tested); token secrets never in responses/logs (QA §6 matrix).

---

## 14. Phase 4 — Intelligence, engagement & growth modules (D12-shaped)

**Entry gate:** Phase 3 exit (platform data flows) + Phase 2 (queue, notifications core, approval, storage).
**D12 branch point:** under **Option A** (primary path) this phase = P4 Monitor + P5 Listen + P6 Notifications delivery + P7 Engage + P11 Grow. Under **Option B/C** it additionally includes P3 Publishing, P8 PR, P9 Influencer, P10 Commerce per plan §5 (ticket detail is in the plan; do not start those until D12 is recorded).

### 14.1 Monitor (plan P4, PRD Module 6) — slug `.scratch/p4-monitoring/`
Decisions needed first: **D8** (NLP/sentiment provider — behind an interface, plan §4) and **D9** (search — Postgres `tsvector` first, defer Elasticsearch).
Schema: adopt `db/monitoring/` (6 tables: incl. `media_articles`, `news_sources`, `social_mentions` — shared with Listen per CONTEXT.md: "extend it, never fork it").
Ingestion sources: NewsAPI + Mediastack (**DEC-027**, approved) — the monitor's external feeds.
Tickets NWB-P4-001…006 per plan (campaigns, ingestion worker (dedup), NLP enrichment, competitor SOV weekly worker, crisis lifecycle, routes).
**Exit:** articles ingest + enrich unattended; SOV computed; crisis raised→acknowledged→resolved with full audit trail.

### 14.2 Listen (plan P5, PRD Module 5) — slug `.scratch/p5-listening/`
**Entry:** P4 exit — shares the ingestion/enrichment pipeline (CONTEXT.md: extend, never fork).
Tickets NWB-P5-001…005 (queries, mention collection w/ dedup, sentiment+tags, alerts into P6 engine, routes).
**Exit:** a query collects mentions, scores sentiment, fires an alert that reaches a recipient.

### 14.3 Notifications delivery (plan P6, PRD Module 9) — slug `.scratch/p6-notifications/`
**Entry:** P1-008 core (Phase 2). **Must land before alert-firing tickets in 14.1/14.2/14.4/14.5** (plan §6).
Tickets NWB-P6-001…005 (in-app + email channels, preferences, digest worker; push = P16 deferred placeholder).
**Exit:** a monitoring alert reaches a real inbox and a real email; preferences + digest change behavior demonstrably.

### 14.4 Engage (plan P7, PRD Module 7) — slug `.scratch/p7-engagement/`
**Entry:** Phase 3 (platform webhooks) + P1-003 approval + P1-008. Schema: `db/engagement/` (6 tables).
Tickets NWB-P7-001…007 (webhook ingestion idempotent, routing rules, workflow lifecycle, response draft→approve→send via P2 adapters, SLA monitor + breach + escalation, AI-suggestion storage (generation is P17), routes).
**Exit:** real inbound message routed → assigned → responded → SLA breach with escalation when unanswered.
**Security:** webhook endpoints are public — signature verification per platform + idempotency keys (QA §6.4-style test matrix).

### 14.5 Grow / viral campaigns (plan P11, PRD Module 4) — slug `.scratch/p11-campaigns/`
**Entry:** Phase 2 (queue, notifications, flags). Schema: `db/campaigns/` (3 tables).
Tickets NWB-P11-001…006 per plan. **The public entry endpoint (NWB-P11-003) is the first unauthenticated write path in the system — treat as security-critical:** rate-limited per IP+identity using the fixed Phase 1 limiter, strict zod validation, no enumeration leaks, fraud scoring worker (NWB-P11-004), NDPR consent capture on entry data (spec §8.4.2).
**Exit:** campaign live → public entries under load with rate limiting → auditable winner draw → notifications.

### 14.6 (Option B/C only) Publishing (P3), PR (P8), Influencer (P9), Commerce (P10)
Plan §5 ticket sets apply unchanged, with these audit additions:
- **P3:** ADR-017's dormant rename SQL is consumed here only if PR/influencer land together — coordinate the migration.
- **P8:** NDPR consent gate at the **service layer** for distribution (plan §7 cross-cutting); coverage attribution needs P4 (entry gate already states this).
- **P9:** `spentNaira` atomic budget commit (concurrency test required — same discipline as NWB-P0-008); performance actuals from P12.
- **P10:** discount redemption atomicity (concurrency test); product sync logs.
- All four: fold their module's aspirational table review (ground rule 7) + the `Database Schema.md` name corrections (D-10) into the adoption tickets.

**Phase 4 exit (Option A):** Monitor stream + Listen + Engage + Grow all at their plan exit gates; notification channels deliver real alerts; no cross-tenant leak in any new table (isolation suite extended per QA §6.3).

---

