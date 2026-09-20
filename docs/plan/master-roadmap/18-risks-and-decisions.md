# Master Roadmap — Risk Register & Decision Log (§29–§30)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 29. Risk register

Evidence-based (each risk traces to a finding/doc, not speculation).

| ID | Risk | Area | Impact | Prob. | Mitigation | Owner/Dep | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Onboarding defects (F-01/F-08) mean no real org has ever completed setup — unknown breakage may exist in paths no test exercises (e.g., bulk CSV invite edge cases) | Product/Backend | High | Medium | Phase 1 end-to-end demo sequence (§11 exit) + E2E from Phase 7; treat all Module 1/2 flows as unproven-in-practice until Phase 1 exit | Eng Lead | Open |
| R-02 | Aspirational schema (54 tables) has never been executed — constraints/indexes/names may be wrong at adoption time (plan risk #1) | Data | High | High | Ground rule 7 review at each adoption + constraint tests before wiring; ADR-017 rename fold (M8) | Eng Lead | Open |
| R-03 | **D12 unresolved** — Phase 4 scope (P3/P8/P9/P10) can shift, re-sequencing the critical path and web screen order (P14.4 etc.) | Scope | High | High (until decided) | Decide in Phase 1 (product); this roadmap carries Option A as primary; re-plan cost is bounded to §14/§17 screen order | Product Lead | **Blocking for Phase 4 shape** |
| R-04 | Role model realignment (D13) touches seed + guards + docs simultaneously | Auth/RBAC | Medium | Medium | Single task (NWB-P0-014) with full matrix tests; pre-prod so no data migration | Eng Lead | Open (Phase 1) |
| R-05 | pg-boss + Bun 1.4 compatibility at production scale (single-VPS) | Infra | Medium | Low-Med | Phase 2 proves the loop in CI + dev; queue-depth alerts from day 1; ADR-028 keeps process-split as config-only escape hatch | Eng Lead | Open (Phase 2) |
| R-06 | Platform API changes/limits (5 social platforms + NewsAPI/Mediastack) | Integration | High | Medium | Adapter interface (P2-005) isolates churn; circuit breaker (P2-003); quota tracking; health surfaced in UI | Eng Lead | Open |
| R-07 | Public campaign entry abuse (first unauthenticated write path) | Security | High | Medium | Plan treats P11-003 as P0-within-P11: fixed rate limiter (Phase 1), per-IP+identity limits, fraud scoring, no enumeration; load-test in Phase 8 | Eng Lead + Security | Open |
| R-08 | Migration baseline (NWB-P0-005) touches 81 schema files — mechanical error risk | Data | Medium | Low | CI-gated: typecheck + fresh-DB migrate + full suite after the change; 42P16 re-verification | Eng Lead | Open (Phase 1) |
| R-09 | Web phase scope creep (15 clusters) | Scope | Medium | High | Plan's 15 independently-shippable sub-phases with per-cluster gates; this roadmap keeps the order; D12 trims clusters under Option A | Eng Lead | Open |
| R-10 | Email deliverability (Resend) for Nigeria-targeted inboxes affects verification/invite conversion | Ops | Medium | Medium | Phase 2 proves delivery to real inboxes before Phase 7 auth screens depend on it; console transport remains the dev/test path | Eng Lead | Open (Phase 2) |
| R-11 | Single-VPS SPOF (ADR-008) at launch | Ops | High | Low-Med | Accept (ADR-008 approved) + backups/DR + monitoring + runbooks (Phase 8); scaling triggers documented (Infra §7.1) — revisit at first scale trigger | DevOps | Accepted (mitigated) |
| R-12 | NDPR non-compliance at launch (DSAR/retention/consent gaps) | Compliance | High | Medium (closes in Phases 1/2/8) | DSAR Phase 1; retention Phase 2; consent gates in module phases; P15-002 sign-off gate | Eng Lead + Legal | Open |
| R-13 | Offline sync data loss (mobile, Phase 10) | Mobile | Critical (if shipped wrong) | Medium | Plan P16 hard requirement: conflict semantics defined + tested before coding; out of current build | Eng Lead | Deferred |
| R-14 | Doc drift continues to mislead implementers (already 16 registered conflicts) | Docs | Medium | High | §6 register + per-phase doc corrections + API reference generated from routes (Phase 7) + "Last verified" markers | Eng Lead | Open (ongoing) |
| R-15 | Test coverage targets unenforced → silent coverage decay | Testing | Medium | Medium | Script-based gate (Bun 1.4 limitation documented) graduated in Phases 1→2 | Eng Lead | Open |
| R-16 | Payment processor webhook failures lose money/entitlements | Billing | High | Medium | Signature-verified idempotent webhooks (QA §6.4 matrix); dunning; reconciling job in P13 | Eng Lead | Open (Phase 6) |

---

## 30. Decision log (open + newly surfaced)

Existing D1–D12 status is tracked live in `.scratch/p0-foundation-gap/decisions.md` (D1/D4/D5/D7 resolved; D2/D3/D6/D8/D9/D10/D11/D12 open). This audit **confirms** that register and **adds** four new decisions:

| ID | Decision | Context | Options | Evidence | Recommended direction | Impact | Blocking? |
|---|---|---|---|---|---|---|---|
| D12 | MVP module set (5 vs 10 vs 12 phases) | 3 mutually inconsistent approved docs + plan (memo §1) | A: strict DEC-005 (10 PRD modules; P3/P8/P9/P10 deferred) · B: plan as written · C: hybrid (minimal Publishing) | DEC-005 (approved, rejected 10+ at MVP on 6-month grounds); DEC-D003/D004 (approved deferrals); D12 memo defect 3 (Publishing likely not on critical path) | **Option A** — zero supersessions; re-point P14 entry gate to Engage | Phase 4 shape, P12/P14 gates, §14/§17 scope | **Yes — before Phase 4** (decide in Phase 1) |
| D2 | Web framework | ADR-002 TanStack Start accepted; no frontend exists | TanStack Start (ADR-002) vs supersede | ADR-002 accepted 2026-06-16, unopposed; no audit finding contradicts it | **Confirm ADR-002** | Phase 7 setup | Yes — before Phase 7 (can be confirmed in Phase 1 cheaply) |
| D3 | Cache/rate-limit store | ADR-004/015 (SQLite) vs code (Postgres `rate_limits`) | Amend ADRs vs migrate code | Code is now real (table exists 2026-09-13); ADR-008 discourages extra services; SQLite schema never implemented | **Amend ADR-004/015** to Postgres-backed, no app cache at MVP | Docs only (ADR amendment) | No (decide in Phase 1) |
| D6 | Object storage | Docs: R2 + Bunny; no code | R2 (S3-compatible) + Bunny CDN vs other | `Tech Stack.md` + `Infrastructure.md` agree; Bun ships `Bun.s3` (AGENTS.md) | **R2 behind the Phase 2 storage interface, Bunny CDN for public media; local-disk adapter for dev** | Phase 2 media service | Yes — before Phase 2 media ticket |
| D8 | NLP/sentiment provider | Required by Monitor/Listen; no decision | Provider behind interface (plan §4) vs open-source local model | ADR-008 (data stays in Nigeria) + ADR-000 principle 9 constrain cross-border NLP APIs — **any provider must pass an NDPR data-flow review** | Choose after a 1-day provider evaluation in Phase 4 prep; keep behind interface | P4-003/P5-003 | Yes — before those tickets (Phase 4) |
| D9 | Search | tsvector → Elasticsearch (Tech Stack) | Postgres tsvector now vs ES | Nothing built; pilot scale small; ADR-003/008 favor no new infra | **tsvector first; ES post-launch** | P4/P5 query implementation | No (default settles it) |
| D10 | Decision Engine scope | 1281-line module doc supersedes `new features/` docs; unreferenced by PRD/Roadmap | In MVP vs park | PRD has no slot for it; DEC-005 counts 5 value modules | **Park (post-launch, P17)**; note in Roadmap | Scope only | No (product, Phase 1) |
| D11 | RLS vs app-layer isolation | ADR-009 (RLS) vs app-layer reality + F-06 | Implement RLS now vs amend ADR-009 to app-layer-mandatory + RLS deferred | F-06: API tier already app-layer-only; RLS surface = 28+54 tables; app-layer invariants are now test-enforced (NWB-P0-018) | **Amend ADR-009: app-layer mandatory + isolation suite; RLS to Phase 10 hardening** (reopen if Phase 8 security review disagrees) | Phase 8 security scope; Security Architecture doc | Yes — record in Phase 1, execute Phase 8 |
| **D13 (new)** | Role hierarchy: seed (super_admin/org_admin/member/viewer) vs PRD 5 tiers vs module-spec 6 tiers | F-07 guards reference non-existent codes; plan/AGENTS operate on seed names | (a) Keep seed set, rename+extend to spec tiers with `owner`/`admin` org roles (recommended) · (b) Adopt spec 6 tiers wholesale · (c) Keep seed set, rewrite guards to seed codes | PRD §8.2.2 (5), module spec §6 (6), `src/seed.ts` (4), guards (2 phantom codes), AGENTS.md (seed names) | **Option (a):** `super_admin` platform + per-org `owner/admin/manager/creator/analyst/viewer`; drop `org_admin`/`member` aliases pre-prod; guards reference real codes | seed, guards, P14.13 UI, module docs | **Yes — before NWB-P0-010/014 (Phase 1)** |
| **D14 (new)** | Multi-org membership / org switching | F-16: agency persona needs one user across client orgs; code is one-org-per-user (JWT orgId) | (a) Single-org at MVP (users.organization_id primary; re-home on invite with explicit refusal) · (b) Multi-org with session org-switch (membership-driven, ability reload) | PRD 2.4 agency persona; `users.organization_id` scalar; membership table already many-to-many | **Decide with D12's product session.** If agencies are in the launch segment (Roadmap §5.2 "first 100 customers" includes agencies per DEC-021), choose (b) — but implement (b) in Phase 7 (org-switch endpoint + session claim), not Phase 1; Phase 1's invitation accept uses (a) semantics as the conservative default | invitation accept branch; Phase 7 scope; JWT/session design | **Yes — before Phase 7** (Phase 1 proceeds with (a)) |
| **D15 (new)** | API versioning | Module docs promise `/api/v1/*`; actual API unversioned | Keep unversioned (fix docs) vs add `/v1` now | API is pre-production; adding `/v1` now = one-time cost, later = breaking change; but nothing external consumes it yet and the web app is the only client | **Keep unversioned; correct docs (D-11).** Revisit at P17 public API (that's when versioning earns its cost) | API reference, module docs | No (Phase 1 bookkeeping) |

**Record-when-decided:** D12/D13/D11/D15 → `docs/business/Decision Log.md` as new DEC entries (D12's memo already preps a DEC-038 record); D14 alongside D12; all recorded before the dependent tasks start.

---

