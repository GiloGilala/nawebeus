# Nawebeus — Master Implementation Roadmap (Road to Production)

**Status:** Active — supersedes nothing; refines `docs/plan/IMPLEMENTATION EXECUTION PLAN.md`
**Created:** 2026-09-20 · **Split into parts:** 2026-09-20 (this file is the index; parts live in [`master-roadmap/`](master-roadmap/))
**Baseline:** HEAD `249707c` (squashed working tree; `049a837` is not present in this clone)
**Method:** every current-state claim was verified against the working tree on 2026-09-20 (file paths cited). Test-run numbers carry their own "last verified" dates from the plan's Appendix C because this sandbox cannot execute `bun test` (Bun is not installed here).
**Companion docs:** `AGENTS.md`, `CONTEXT.md`, `docs/plan/IMPLEMENTATION EXECUTION PLAN.md` (the ticket-level plan this document sequences), `.scratch/p0-foundation-gap/decisions.md` (live decision register), `docs/business/Decision Log.md` (approved decision register)

> **How to read this roadmap.**
> - This index holds the **part map**, **§1 (sources of truth)**, the **consolidated roadmap (§33)** and the **executive summary (§34)** — the two things every reader needs first/last.
> - Everything else is split into 19 parts under [`master-roadmap/`](master-roadmap/). Read them in part order; each part header links back here.
> - Section numbers (§N) are **global across parts** — a reference like "§27 GO/NO-GO" in any part resolves via the part map below.
>
> **Scope decision pending:** D12 (MVP module set) is still open. Parts 8 and 10 sequence work for **Option A (strict DEC-005: 10 PRD modules, four non-PRD domains deferred)** as the primary path, because it is the only option requiring zero supersessions of approved decisions, and it is the documented recommendation (`.scratch/p0-foundation-gap/D12-scope-decision-memo.md` §6). Every place where Option B/C changes the plan is called out inline. **Do not start P3/P8/P9/P10 work until D12 is resolved.**

## Part index

| Part | File | Sections | What it contains |
|---|---|---|---|
| 01 | [01-discovery.md](master-roadmap/01-discovery.md) | §2–§4 | Repository structure (as-built), documentation structure & authority, current-state assessment per subsystem + P0 re-verification |
| 02 | [02-defects.md](master-roadmap/02-defects.md) | §5 | Defect register — 14 defects verified in the working tree 2026-09-20 (F-01…F-19, F-20; F-01/F-20 since fixed) + CASL v7 semantic verification |
| 03 | [03-discrepancies.md](master-roadmap/03-discrepancies.md) | §6 | Doc ↔ code discrepancy register (D-01…D-16) with adjudications |
| 04 | [04-gap-matrix.md](master-roadmap/04-gap-matrix.md) | §7 | Full gap matrix (area / current / required / gap / evidence / deps / priority / status) |
| 05 | [05-target-architecture.md](master-roadmap/05-target-architecture.md) | §8–§9 | Target architecture (retained / modified / new / deprecated) + dependency graph & critical path |
| 06 | [06-phase-1-foundation.md](master-roadmap/06-phase-1-foundation.md) | §10–§11 | Phase 0 (done) + Phase 1: foundation completion & all 14 defect-remediation tasks (NWB-P0-002/005/010…023) |
| 07 | [07-phase-2-shared-infra.md](master-roadmap/07-phase-2-shared-infra.md) | §12 | Phase 2: shared infrastructure (queue, email, storage, approval, notifications core, flags, retention, impersonation, observability) |
| 08 | [08-phase-3-4-modules.md](master-roadmap/08-phase-3-4-modules.md) | §13–§14 | Phase 3: social accounts · Phase 4: Monitor/Listen/Notifications/Engage/Grow (+ D12-dependent Publishing/PR/Influencer/Commerce) |
| 09 | [09-phase-5-6-analytics-billing.md](master-roadmap/09-phase-5-6-analytics-billing.md) | §15–§16 | Phase 5: analytics & reporting · Phase 6: billing (Paystack + Stripe) |
| 10 | [10-phase-7-web.md](master-roadmap/10-phase-7-web.md) | §17, §23 | Phase 7: web application (TanStack Start, P14.1–15 screen clusters) + frontend & mobile plan |
| 11 | [11-phase-8-9-release.md](master-roadmap/11-phase-8-9-release.md) | §18–§20 | Phase 8: beta hardening + production readiness · Phase 9: public launch · Phase 10: post-launch (future) |
| 12 | [12-database-migration.md](master-roadmap/12-database-migration.md) | §21 | Database & data migration plan (M0–M8, rules, rollback) |
| 13 | [13-api-service.md](master-roadmap/13-api-service.md) | §22 | API & service plan (current surface audited, conventions, missing endpoints) |
| 14 | [14-security.md](master-roadmap/14-security.md) | §24 | Security review: findings → remediation tasks → verification tests (S-01…S-15) |
| 15 | [15-testing.md](master-roadmap/15-testing.md) | §25 | Testing strategy & acceptance gates per layer |
| 16 | [16-production-readiness.md](master-roadmap/16-production-readiness.md) | §26 | Production readiness workstream (config, secrets, backups, monitoring, runbooks…) |
| 17 | [17-release-gates-and-dod.md](master-roadmap/17-release-gates-and-dod.md) | §27–§28 | Release strategy & 14-item GO/NO-GO criteria + project-wide Definition of Done |
| 18 | [18-risks-and-decisions.md](master-roadmap/18-risks-and-decisions.md) | §29–§30 | Risk register (R-01…R-16) + decision log (D1–D15, incl. 4 new) |
| 19 | [19-cleanup-and-scope.md](master-roadmap/19-cleanup-and-scope.md) | §31–§32 | Cleanup & consolidation (evidence + safe removal) + scope control (required / prod-ready / recommended / future) |
| — | *this file* | §1, §33, §34 | Sources of truth · consolidated master roadmap · executive summary (incl. production gate + completion checklist) |


## 1. Sources of truth and their authority ranking

| Rank | Source | Authority | Note |
|---|---|---|---|
| 1 | `src/`, `db/` (working tree) | Implementation truth | If docs disagree with code, code wins and docs get corrected (execution plan ground rule 1) |
| 2 | `.scratch/*/` (specs, tickets, decision register) | Working state + open decisions | `Status:` lines are authoritative for ticket state |
| 3 | `docs/plan/IMPLEMENTATION EXECUTION PLAN.md` | Engineering phasing + DoD + release gates | Active, last re-verified 2026-09-13 |
| 4 | `docs/business/Decision Log.md` (DEC-xxx, all **Approved**) | Product/business decisions | Predates the execution plan; the plan's §4 corrections acknowledge it |
| 5 | `docs/product/PRD.md`, `docs/product/Roadmap.md` | Product requirements (10-module MVP) | PRD §8 is the canonical module set + FRs |
| 6 | `docs/modules/*.md` | Module specs (FR-level detail) | **Numbering superseded** (D1); FR content still authoritative per module |
| 7 | `docs/technical/*.md` | Target technical architecture | **Aspirational** (AGENTS.md "Docs are aspirational"); ADRs are accepted decisions; descriptive text often describes systems that do not exist yet |
| 8 | `docs/audit/*` | **Reusable templates only** — no completed audits exist in this directory | Templates even contain another project's placeholder ("Gilo Business") — see §6 D-09 |
| 9 | `docs/business/*`, `docs/customer/*` | Business context, not implementation requirements | |

The user-facing `/doc` directory referenced in the brief is `docs/` in this repository.

---


## 33. Final consolidated master roadmap

| Phase | Name | Status (2026-09-20) | Key tasks (IDs) | Dependencies | Blocking items | Evidence of state | Exit criteria (short) |
|---|---|---|---|---|---|---|---|
| 0 | Discovery / Baseline | ✅ **DONE** (this document) | — | — | — | §2–§7 (all verified against HEAD 249707c) | Current state + gaps + decisions established |
| 1 | Foundation completion + defect remediation | 🟨 in progress — NWB-P0-010 done, D13 recorded (DEC-039) 2026-09-20 | NWB-P0-010 ✅, NWB-P0-011…023 + NWB-P0-002, NWB-P0-005 | Phase 0 | **D13 ✅ (DEC-039)**; D12, D11, D15 (decide in-phase) | §4, §5 (14 defects), §11 | §11 exit criteria (1–7): E2E owner→invite→accept demo; migrations from zero; DSAR; 0 Critical/High open |
| 2 | Shared infrastructure (P1) | 🔴 not started | NWB-P1-001…012 | Phase 1; **D6** | pg-boss dep (justified by ADR-028); Resend/R2 credentials | plan §5 P1; §12 | §12 exit gate: worker loop, real email, approval queue, media, flags, observability, purge/reclamation scheduled |
| 3 | Social accounts (P2, Mod 3) | 🔴 not started | NWB-P2-001…006 | Phase 2 | platform API credentials | plan §5 P2; §13 | 5 platforms connect/refresh/healthy; breaker trips+recovers |
| 4 | Intelligence/engagement/growth (P4,P5,P6,P7,P11 [+P3,P8,P9,P10 if D12≠A]) | 🔴 not started | NWB-P4/P5/P6/P7/P11-xxx [+ P3/P8/P9/P10-xxx] | Phase 3; Phase 2; **D8, D9** (before P4 NLP/search tickets); **D12** (scope) | none after deps | plan §5; §14 | Each module at its plan exit gate; isolation suite extended; alerts delivered on real channels |
| 5 | Analytics (P12, Mod 8) | 🔴 not started | NWB-P12-001…005 | Phase 4 emitters | — | plan §5 P12; §15 | aggregates; dashboard; scheduled report export; threshold alert |
| 6 | Billing (P13) | 🔴 not started (parallelizable from Phase 2) | NWB-P13-001…005 | Phase 2 | processor accounts (Paystack+Stripe) | plan §5 P13; §16 | subscribe→entitlement→limit enforced→dunning |
| 7 | Web application (P14) | 🔴 not started (P14.1–14.2 may start right after Phase 1) | P14.1…P14.15 (Option-A cluster set); D11 API-ref rewrite; D2 confirm | per-cluster backend phases; **D2** | none after deps | plan §5 P14; §17/§23 | every in-scope workflow usable with full state matrix; E2E green; axe-clean |
| 8 | Beta hardening + production readiness (P15 + Infra) | 🔴 not started | NWB-P15-001…007 + §26 workstream | Phase 7 (Option A) | **D11 execution** | plan §5 P15; §18/§24/§26 | §27 GO criteria 1–14 all evidenced |
| 9 | Public launch | 🔴 not started | Release sequence §27 | Phase 8 | GO/NO-GO | — | Production live; post-deploy verification passed; sign-off |
| 10 | Post-launch (mobile P16, D12-deferred domains, P17) | ⬜ future | plan P16/P17 references | Phase 9 | R-13 offline semantics before coding | DEC-008; plan §5 P16/P17 | per-plan exit gates when scheduled |

**Critical path:** 1 → 2(queue) → 3 → 4d → {4a→5 ∥ 4b ∥ 4c} → 5 → 7 → 8 → 9 (Option A).
**Parallel-safe:** 7.1–7.2 ∥ 2 · 4a ∥ 4b ∥ 4c ∥ 6 (after 2+3) · 5's aggregation design ∥ 4 (code after 4).
**Blocking decisions timeline:** D13+D11+D15 (Phase 1, week 1) → D12 (Phase 1, product) → D6 (before Phase 2 media) → D8/D9 (before Phase 4 NLP/search tickets) → D2 (before Phase 7 setup) → D14 (before Phase 7 org-switch scope).

---

## 34. Executive summary

### Current state (what exists today)
A single Bun+Hono+Drizzle+PostgreSQL API service (~9.5k LOC) implementing **Module 1 (Auth) and Module 2 (Org) at the API level**: full signup/signin/refresh/signout with rotating bound sessions, MFA enrollment, API-key Bearer auth, CASL RBAC, AsyncLocalStorage tenancy, account deletion with grace, audit logging, and a working CI gate (typecheck/lint/build + full suite on PostgreSQL 14) with an idempotent seed. 28 active tables are schema-complete; 54 more are drafted for the coming modules. The execution plan's P0 is ~80% done (API keys, CI, linter, lockout fix, decision adoption verified in code).

### Target state
The same service, hardened and extended per the plan: Module 1/2 defect-free and team-onboarding-complete; pg-boss workers; Resend email; R2 media; approval/notification/flag/retention/impersonation/observability services; the five PRD value modules (Grow/Listen/Monitor/Engage/Analyze) at API level with their module schemas adopted; billing (Paystack+Stripe); a TanStack Start web app covering all in-scope workflows with full UI state discipline; production on a Nigerian VPS (Coolify blue-green) with migrations-from-zero, backups+restore drills, monitoring+alerts, runbooks, and a signed NDPR checklist. Mobile and the four non-PRD domains (under Option A) are explicitly post-launch.

### Remaining work (only what is required)
1. **~14 defect fixes + DSAR + migration baseline** (Phase 1) — the foundation is close but has verified Critical defects (owner role, invite acceptance) and a permanently-degrading rate limiter.
2. **Shared infrastructure** (Phase 2) — the queue is the single largest multiplier; email/storage/approval/notifications-core/observability.
3. **Five value modules + social accounts** (Phases 3–5) — each with schema adoption per ground rule 7.
4. **Billing** (Phase 6, parallel).
5. **Web app** (Phase 7).
6. **Hardening + production readiness + launch** (Phases 8–9).
Everything else in `docs/` (mobile, AI, public API, enterprise, i18n, white-label, Elasticsearch, RLS-if-deferred) is **post-launch and out of this build**.

### Critical path
Phase 1 (defects + migrations) → Phase 2 (queue) → Phase 3 (social accounts) → Monitor/Listen → Analytics → Web → Hardening → Launch. (Publishing is *not* on the critical path — the D12 memo's defect 3, confirmed by this audit.)

### Parallel work (safe)
Web auth/org screens from Phase 1 onward · Monitor ∥ Engage ∥ Grow ∥ Billing streams after Phases 2–3 · Analytics design during Phase 4 · Phase 8 infra workstream starts as soon as Phase 2 observability exists (no need to wait for all features for backup/monitoring work).

### Blocking decisions
**D12** (MVP scope — product; blocks Phase 4 shape) · **D13** (role model — blocks Phase 1 RBAC fixes) · **D11** (RLS posture — record Phase 1, execute Phase 8) · **D15** (API versioning — trivial, Phase 1) · then **D6** (storage), **D8/D9** (NLP/search), **D2** (web framework confirm), **D14** (multi-org, before Phase 7).

### Major risks
R-01 (untested-in-practice onboarding paths), R-02 (54 never-executed aspirational tables), R-03 (D12 re-sequencing), R-07 (public campaign entry abuse), R-12 (NDPR at launch), R-11 (single-VPS SPOF — accepted with mitigations). Full register: §29.

### Production gate (exact)
The 14-item GO/NO-GO table in §27 — CI green incl. coverage script; migrations from zero; isolation suite 100% of tables / 0 leaks; RBAC matrix green; zero open Critical/High; NDPR signed; all in-scope workflows E2E-verified in browser; workers idempotent+alerted; backup restore rehearsed; runbooks executed; performance budgets met; no destructive-integrity issues; secrets audited. **Any single NO-GO holds the release.**

### Final completion checklist (CTO/lead verification)
- [ ] Phase 0 accepted; this document's "Last verified" markers current
- [ ] D12, D13, D11, D15, D6, D8, D9, D2, D14 recorded in `docs/business/Decision Log.md` with supersession notes where applicable
- [ ] §5 defect register: every ID closed with its red-green test cited
- [ ] Fresh-org end-to-end demo (signup → owner role → invite → accept → role change with self-protection) recorded in Phase 1 spec
- [ ] `drizzle/` migrations: empty DB → current; re-migrate no-op; CI uses `db:migrate`
- [ ] DSAR export produces valid machine-readable payload (sample archived)
- [ ] Queue: scheduled + retried + idempotent worker demonstrated in CI and dev; purge/reclamation workers on schedule
- [ ] Real email (Resend) delivered in sandbox; console transport confined to dev/test
- [ ] Media: upload → signed URL → soft delete demonstrated
- [ ] All five value modules at their plan exit gates; isolation suite green over every multi-tenant table
- [ ] Billing: subscribe → entitlement → limit → dunning demonstrated
- [ ] Web: every in-scope workflow E2E green; 12-state UI matrix per screen; axe 0 violations
- [ ] Security: §24 standing zero Critical/High; NDPR checklist signed
- [ ] Infra: backups + **restore drill log**; runbooks executed; alerts fired (demo); k6 report within budgets
- [ ] §27 GO criteria 1–14 each have a named artifact
- [ ] Release executed per §27 sequence; post-deployment verification + 30-min watch logged; sign-off recorded

---

*End of master roadmap. This document is the project's road-to-production plan. It is a living document: refresh "Last verified" markers and the status column of §33 as phases complete; record every decision in the Decision Log, never only here.*
