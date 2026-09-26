# Master Roadmap — Phase 3 & Phase 4: Social Accounts & Domain Modules (§13–§14)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 13. Phase 3 — Social accounts & platform integration (plan P2, PRD Module 3)

**Slug:** `.scratch/p2-social-accounts/`. **Entry gate:** Phase 2 exit.
**Schema adoption:** `db/social-accounts/` (4 tables) per ground rule 7 — review against `docs/modules/Social Media Integration.md` before wiring (plan risk #1: aspirational schema is a design asset, not a verified one).

| ID | Ticket | Notes |
|---|---|---|
| NWB-P2-001 | OAuth flow (initiate, single-use state with TTL, callback, connect) | ✅ **DONE 2026-09-24** — `.scratch/p2-social-accounts/issues/01-oauth-flow.md`: schema adopted (0011, ids 64 from birth), `src/lib/crypto.ts` AES-256-GCM, DEC-009 registry + injectable-fetch exchange client, single-use state machine (replay test), `/api/social` initiate + public callback, `socialaccounts.connect` seeded manager+; 889/889. Was: `db/social-accounts/` aspirational, no OAuth code |
| NWB-P2-002 | Token lifecycle (encrypted at rest, refresh worker, rotation, failure surfacing) | ✅ **DONE 2026-09-24** — `.scratch/p2-social-accounts/issues/02-token-lifecycle.md`: `socialaccounts.token-refresh` job (*/5, ninth queue) refreshing 1 h before expiry (BR-SOC-013), rotation kept/replaced per provider, one retry then `needs_reauth` + health transition + audit (FR-SOC-021/022), full `token_refresh_log`. (Encryption itself landed in P2-001's `src/lib/crypto.ts` — the new-but-justified record stands.) |
| NWB-P2-003 | Account health checks + circuit breaker | ✅ **DONE 2026-09-24** — `.scratch/p2-social-accounts/issues/03-account-health-and-breaker.md`: `socialaccounts.health-check` job (*/5, tenth queue), probe endpoints in the registry, FR-SOC-053 classification + FR-SOC-054 backoff helper, breaker at 10 consecutive failures (module spec over schema sketch), `assertDispatchAllowed` = the P3/P7 dispatch gate (503 `CIRCUIT_BREAKER_OPEN`), half-open recovery by probe success, 429 non-advancing, >24h chronic escalation to a critical audit |
| NWB-P2-004 | Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`) | ✅ **DONE 2026-09-25** — `.scratch/p2-social-accounts/issues/04-quota-tracking.md`: jsonb ledger on `social_accounts` (`quota_tracking` + derived `quota_status`), atomic single-statement spend (concurrent spenders cannot lose an increment; PG 18 `jsonb_set` no longer creates intermediates — bucket composed then merged at the top level), ladder healthy→warning(≥80%)→critical(≥95%)→exhausted(≥100%) worst-bucket-wins with one audit event per crossing (FR-SOC-033/034/038; delivery P6), dispatch gate `hasQuotaRemaining` (FR-SOC-035), nightly `resetDueQuotas` roll rides `rate-limit-reclaim` and auto-resumes | Feeds P13 plan limits (per-platform quota numbers are P13 config). |
| NWB-P2-005 | Platform adapters × 5 (YouTube, X, Instagram, Facebook, Reddit — DEC-009) | ✅ **DONE 2026-09-25** — `.scratch/p2-social-accounts/issues/05-platform-adapters.md`: `PlatformAdapter` interface + `PLATFORM_ADAPTERS` registry (PRD 8.3.2 "integration abstraction layer"), profile-fetch dialects moved out of the OAuth client (zero per-platform branches left), probe request shaping per platform (Reddit's required User-Agent), Meta pair refresh via native grants (`fb_exchange_token` POST-form keeping the secret out of the URL / `ig_refresh_token`, both `rotated: false` keeping the stored token), the other three on the RFC grant — every dialect directly tested against scripted fetches | XL → the "split into 5" landed as five adapters inside this one row (the spec's ticket accounting); publishing/collect/sync methods are P3/P7/P10's consumers of this interface. |
| NWB-P2-006 | Routes (list, connect, callback, delete, health) | ✅ **DONE 2026-09-25** — `.scratch/p2-social-accounts/issues/06-routes.md`: management surface on `/api/social` — list (keyset `(connected_at, id)`, token-free projection, `platform`/`status` filters, disconnected rows hidden unless named), per-account detail (breaker + last error + quota snapshot + latest health row), newest-first health timeline, org quota roll-up, disconnect (typed-username confirmation **in the body** — query strings outlive requests in logs; best-effort adapter `revokeRequest` with the outcome audited, never thrown; both token columns NULLed; `data_retention_until = now()+90d` per FR-SOC-014; repeat DELETE → 404); RBAC per Module 3 §6.2 — `socialaccounts.read` → everyone, `usage` → manager+, `disconnect` → admin (connect stays manager+) | Envelope + RBAC (`socialaccounts.*` permissions added to seed — extend the P1-014 role matrix). |

| NWB-P2-007 | Follow-up: the lifecycle gaps P2-006 scoped out + two bugs found comparing it against a parallel implementation | 🟨 **IN PROGRESS 2026-09-26** — `.scratch/p2-social-accounts/issues/07-lifecycle-gaps-and-bug-fixes.md`: pause/resume (FR-SOC-016), on-demand health-check probe (P2-003's breaker recovery made operator-reachable), per-account usage read, `?attention=true` + `meta.attentionCount` (FR-SOC-044's data half), `DELETE ?dryRun=true` impact preview (FR-SOC-011), FR-SOC-008/022 notifications through a `SocialNotifier` port over the P1 email channel, X's RFC 7009 revocation dialect + revoking the refresh token too, and the fixes for a `markNeedsReauth` that aborted its caller's transaction on a non-transition and a reconnect revive that left the breaker / `is_active` / retention stamp behind. No new CASL verbs, no migration. |

**Exit gate (plan): MET 2026-09-25** — all five platforms connect, refresh unattended, report health; breaker trips and recovers demonstrably (phase evidence in `.scratch/p2-social-accounts/spec.md`; 946/946 tests, coverage gate 93.6% services / 96.8% lib).
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

