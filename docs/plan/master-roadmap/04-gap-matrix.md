# Master Roadmap — Gap Matrix (§7)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 7. Gap matrix

"Required state" = PRD + approved DEC-xxx + accepted ADRs + execution-plan release gates. DONE = already implemented and verified (§4/§5); references are tasks in §10+ or plan tickets (NWB-Px-yyy).

| Area | Current state | Required state | Gap | Evidence | Deps | Priority | Status |
|---|---|---|---|---|---|---|---|
| **Product — Module 1 Auth** | 9/10 FRs built; defects F-01…F-05, F-09, F-12 | All 10 FRs incl. DSAR (AC8), MFA login flow, working rate limit | DSAR missing; MFA challenge endpoint; status enforcement; backup-code fix; rate-limit fix | §5 | — | **Required** | Phase 1 |
| Product — Module 2 Org | Org CRUD, members, invites (one-way), roles (4, misaligned) | Full org lifecycle incl. deletion, working invite-accept, aligned role model | F-01, F-07, F-08, D-14 (org deletion) | §5, D-12/D-14 | D13 | **Required** | Phase 1 |
| Product — Module 3 Social integration | 🔴 none | 5-platform OAuth, token lifecycle, health, quota, adapters | Entire phase | `db/social-accounts/` (4 tbls, aspirational) | P1 queue | **Required** | Phase 3 |
| Product — Module 4 Grow (campaigns) | 🔴 none | Campaign builder, public entry endpoint (hardened), entries, winners, fraud | Entire phase | `db/campaigns/` (3 tbls) | P1, P6 core | **Required (Option A)** | Phase 4 |
| Product — Module 5 Listen | 🔴 none | Queries, mention collection, sentiment, alerts | Entire phase | `db/monitoring/social_mentions` | P4 pipeline, D8, D9 | **Required** | Phase 4 |
| Product — Module 6 Monitor | 🔴 none | Campaigns (media), article ingestion (NewsAPI/Mediastack per DEC-027), NLP, SOV, crises | Entire phase | `db/monitoring/` (6 tbls) | D8, D9 | **Required** | Phase 4 |
| Product — Module 7 Engage | 🔴 none | Webhook ingestion, routing, workflow, responses, SLA | Entire phase | `db/engagement/` (6 tbls) | P2 webhooks, P1 | **Required** | Phase 4 |
| Product — Module 8 Analyze | 🔴 none (schema active) | Aggregates, dashboards, reports, alert rules | Entire phase | `db/shared/analytics.ts` (active, unused) | all emitters | **Required** | Phase 5 |
| Product — Module 9 Notifications | 🔴 none (schema active) | Engine + in-app/email channels, preferences, digests; push deferred to mobile | Engine in P1; channels in P6 | `db/shared/alerts.ts` (active, unused) | P1 email | **Required** | Phase 2/4 |
| Product — Module 10 Sys admin | Audit write-only; no DSAR; no config/flags | Audit query+retention, DSAR queue, feature flags, system config, impersonation | P1-002/009/010/011 + DSAR | `unified_audit_log` active | P1 | **Required** | Phase 1/2 |
| Product — Publishing / PR / Commerce / Influencer | 🔴 none (aspirational schemas) | Per D12: Option A defers all four post-launch; Option B/C includes some | Scope decision | D12 memo; ADR-017 rename dormant | D12 | **D12-dependent** | Phase 4 (B/C) |
| **Backend — queue/workers** | 🔴 none | pg-boss queue + scheduler + worker base, idempotent workers, audit on success/failure | Entire base (ADR-028) | ADR-028; nothing in `src/lib/` | P0-005 (pg-boss schema versioning) | **Required — highest leverage** | Phase 2 |
| Backend — email | Console transport only | Resend adapter behind `EmailTransport` (DEC-028); console kept for test | Adapter | `src/services/email.ts` | — | **Required** | Phase 2 |
| Backend — storage/media | ✅ core (was 🔴; NWB-P1-005, 2026-09-24) | `StorageTransport` + R2 (`Bun.s3`, zero deps)/local adapters, multipart upload → signed URL, library soft delete, 64-wide ids (0010); R2 live smoke + CDN/avatars/exports are later config/tickets | P1-005 | `media_assets` schema only | D6 (R2 creds = ops action) | **Required** | Phase 2 |
| Backend — audit | Write-only, 5-module enum | Typed events, query API, retention worker, legal holds, extended module taxonomy | P1-002, P1-010 | `src/services/audit.ts` | queue | **Required** | Phase 2 |
| Backend — approval | 🔴 (schema active) | Request/submit/approve/reject queue + stale-expire worker | P1-003 | `db/shared/approval.ts` active | queue | **Required** (gates P3/P8/P9 in B/C; needed by P7 responses) | Phase 2 |
| Backend — contacts | 🔴 (schema active) | Contact + interaction CRUD | P1-007 | `db/shared/contacts.ts` | — | **Required** (PR/Influencer in B/C) | Phase 2 |
| Backend — feature flags/config | 🔴 | `evaluateFlag`, `getConfigValue` with audit | P1-009 | — | — | **Required** (billing limits, dark launches) | Phase 2 |
| Backend — impersonation | ✅ (was 🔴; NWB-P1-011, 2026-09-24) | Start/end + audit | P1-011 | `src/services/impersonation/` + `impersonation_sessions` (0009); every action tagged `impersonation` with the admin as actor | audit formalization | **Required** (support tooling; UI in P15-006) | Phase 2 |
| Backend — observability | console + NWB_DEBUG_ERRORS | Structured JSON logs, request IDs, error tracking, metrics endpoints | P1-012 | — | — | **Required** | Phase 2 |
| Backend — org context | ✅ ALS + org-match | Keep; add org-switch if D14 says yes | Possible extension | `src/lib/org-context.ts` | D14 | Conditional | Phase 1/7 |
| **API** | 28 routes (auth 16, users 8, orgs 7, api-keys 4) | Same surface hardened + all module APIs per plan | Envelope/RBAC conventions exist and are good; add pagination (F-14), pagination/sorting per API Reference conventions, public endpoints hardened (campaign entry, webhooks) | route audit §2 | — | **Required** | per phase |
| API — API versioning | No `/v1` | Docs promise `/api/v1/…` | **Decide: keep unversioned** (simpler; docs corrected per D-11) — record as decision D15 (new) | D-11 | — | **Recommended** | Phase 1 |
| **Database** | 28 active tables; 54 aspirational; no migration history | Migrations reproducible from zero; pg-boss schema versioned; aspirational tables adopted one module at a time (ground rule 7) | NWB-P0-005 (+P0-009 root cause: `primaryKey().notNull()` x81) | `drizzle/migrations/` absent | — | **Required — blocks safe evolution** | Phase 1 |
| DB — tenant isolation | App-layer (sound today) | Same + RLS per D11 decision | D11 | ADR-009; F-06 | D11 | **Required-for-prod** (or documented deferral) | Phase 8 |
| **AuthN hardening** | See §5 | Status enforcement, MFA completion, rate-limit correctness, IP policy | F-03…F-05, F-10, F-12 | §5 | — | **Required** | Phase 1 |
| **Security** | 13 defects in §5; open CORS; no secrets rotation; no branch protection | Zero Critical/High open; release gates §8 of plan | All F-items + F-13 + D-08 + branch protection + secrets | §5, D-08 | — | **Required** | Phase 1 + Phase 8 |
| **Frontend** | 🔴 none | TanStack Start (ADR-002) covering P14.1–P14.15 screen clusters w/ full state matrix (loading/empty/error/permission/… per plan P14) | Entire app | ADR-002; D2 | API phases | **Required** | Phase 7 |
| **Mobile** | 🔴 none | Post-launch (DEC-008): RN+Expo, offline sync semantics defined before coding | Entire app | DEC-008; plan P16 | launch | **Future** | Phase 10 |
| **Billing** | 🔴 none | Paystack + Stripe (DEC-025), plans/entitlements, usage enforcement, invoices, dunning | Entire phase | `db/billing/` (6 tbls) | P1, D7 (resolved) | **Required** | Phase 6 |
| **Testing** | 28 files, ~195 blocks; DB-gated skips; no coverage gate; no E2E; no security suite | QA Strategy gates: 85% services / 90% lib (script-enforced), negative-test rule, tenant-isolation suite, security suite, migration verification, E2E of P0 workflows | Coverage tooling, security suite, E2E (when UI exists), migration tests | QA Strategy §2/§6/§11; `.scratch/…/03-ci-pipeline.md` | Phase 1 fixes | **Required** | per phase + Phase 8 |
| **CI/CD** | CI exists; no branch protection; no CD | Branch protection ON; CD per QA §11.3 (staging smoke → blue-green → prod smoke → 30-min error watch); secret scanning optional (not in current CI by design) | Branch protection, CD pipeline, deploy scripts | AGENTS.md; QA §11.3 | Phase 1 | **Required-for-prod** | Phase 1 (protection) / Phase 8 (CD) |
| **Deployment/infra** | 🔴 | Single VPS (Nigeria, ADR-008) + Coolify (DEC-029) + Nginx + systemd + blue-green (ADR-012) + backups/DR (Infra §5) + monitoring (Infra §6) | Entire workstream | `Infrastructure.md` (concrete) | Phase 2 observability | **Required-for-prod** | Phase 8 |
| **Compliance (NDPR/GDPR)** | Consent fields at signup; audit; DSAR missing; purge unscheduled; no retention worker | DSAR export, retention + legal holds, consent gates (PR phase), 7-yr audit retention, erase-on-grace enforced | DSAR (P0-002), retention (P1-010), org deletion (P0-023) | PRD §9.5; Module 1 spec §4 | Phase 1/2 | **Required-for-prod** | Phase 1/2/8 |
| **Documentation** | Large, authoritative where cited; drift register §6 | Code-generated API reference; corrected stale docs; decision records complete | D-04/D-09/D-10/D-11/D-15 cleanups + API ref rewrite | §6 | Phase 7 | **Recommended** (except D-08/D-11 ADR amendments = Required) | spread |
| **Seed data** | Idempotent; 4 roles; bootstrap admin | Align with D13 role model; keep idempotent | Role seed change | `src/seed.ts` | D13 | **Required** | Phase 1 |

---

