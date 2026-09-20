# Nawebeus — Implementation Execution Plan

**Status:** Active
**Created:** 2026-09-13
**Baseline:** HEAD `049a837` (2026-08-03) — *"feat(auth): complete Module 1 auth & user management parity"*
**Owner:** Engineering Lead
**Companion docs:** `AGENTS.md` (codebase guide), `CONTEXT.md` (domain glossary), `docs/Foundation Phase.md` (backend build order), `docs/product/Roadmap.md` (business phasing), `docs/agents/issue-tracker.md` (ticket conventions)

> This is a **working plan**, not a template. The reusable audit/execution-plan template that previously occupied this path has been preserved at `docs/audit/DOMAIN_PRODUCTION_AUDIT_AND_EXECUTION_TEMPLATE.md` (byte-identical copy) and `docs/audit/DOMAIN_PRODUCTION_AUDIT_TEMPLATE.md` (audit-only variant).

---

## 0. How to use this document

1. **Read §1 (as-built baseline) before anything else.** It states what is actually true in the repo. Everything downstream is ordered relative to it.
2. **Resolve §4 (decisions required) as you hit them.** They are genuine blockers with no answer derivable from the repo. Do not silently invent an answer.
3. **Work phases in order.** Each phase has an entry gate and an exit gate. Do not start a phase whose entry gate is unmet.
4. **File each phase as a `.scratch/` feature directory** — `.scratch/<slug>/spec.md` plus `.scratch/<slug>/issues/NN-<slug>.md`. The phase's tickets below are the issue list. See §9.
5. **Update status as you go** using the vocabulary in `docs/agents/issue-tracker.md`. `Status:` is authoritative; checkboxes are advisory.
6. **Re-verify §1 periodically.** It carries a `Last verified against` marker. If the code has moved past it, refresh §1 before trusting the ticket lists.

### Scope of "start to finish"

This plan covers: **closing the current foundation gap → MVP (10 modules) → web application → beta hardening → public launch → mobile → post-launch roadmap.** Phases P0–P15 reach public launch. P16–P17 cover mobile and the post-launch roadmap (referenced, not duplicated, from `docs/product/Roadmap.md`).

---

## 1. As-built baseline

> **Last verified against HEAD `51c1a2d` on 2026-09-20 (NWB-P0-020).** Verified by reading `package.json`, `tsconfig.json`, `db/schema.ts`, the `src/` tree, and by executing the full gate against a freshly created PostgreSQL 14.23 database — see Appendix C for the measured numbers. If the tree has moved, re-verify before trusting this section.

### 1.1 What exists and works

| Area | State | Evidence |
|---|---|---|
| Runtime | Bun 1.4.2 + Hono + Drizzle ORM + PostgreSQL (`pg`) | `package.json` deps: `@casl/ability`, `drizzle-orm`, `hono`, `pg`, `zod` — nothing else |
| Entry point | Single API process | `src/index.ts` (`Bun.serve`), `src/server/index.ts` (Hono factory) |
| Auth | Cookie-based JWT, session rotation, token binding, MFA (TOTP), email verification, password reset + history, email change, account deletion, rate limiting + account lockout | `src/services/auth/*`, `src/server/api/auth/*`, `src/lib/rate-limit.ts` (the `src/app/auth/*` route mirror was deleted in NWB-P0-026) |
| RBAC | CASL abilities loaded per-request from DB, per `(user, org)`. The decorative `organizationId` *condition* was removed in NWB-P0-018 (inert under CASL v7 string subjects); isolation rests on JWT org → `requireOrgMatch` → service predicates | `src/services/auth/ability.ts`, `src/server/middleware/rbac.ts`, Security Architecture §4.3.1 |
| Multi-tenancy | `AsyncLocalStorage` org context; `:orgId` vs JWT org match | `src/lib/org-context.ts`, `src/server/middleware/org-match.ts` |
| Users / Orgs | Profile read+update, org settings, member list, invitations (incl. bulk CSV + accept), role assignment, organization deletion | `src/server/api/users/*`, `src/server/api/orgs/*`, `src/services/orgs/*` |
| Schema | **30** active tables across 3 modules, reached by committed migrations (`drizzle/migrations/`, NWB-P0-005) | verified live: 30 `public` tables after `db:migrate` on an empty database |
| Tests | **395 pass, 0 fail** with a live database; **222 pass / 184 skip / 0 fail** without one | Skips are DB-backed tests; documented behaviour without `DATABASE_URL`. Re-measured 2026-09-20 (NWB-P0-020) |

### 1.2 What is missing or non-functional

| Gap | Evidence | Impact |
|---|---|---|
| **API key management (FR-AUTH-010)** — no route, service, or `Bearer` middleware | No route, service, or `Bearer` handling in `src/`; the only trace is `"api_key"` as an `AuditActorType` in `src/services/audit.ts:5`. **The `apiKeys` table already exists** — `db/core/api-keys.ts`, exported from `db/schema.ts` | 1 of 10 Module 1 FRs unimplemented; blocks public API (P17). NWB-P0-001 is service + routes + middleware + tests only — **no new table** |
| **DSAR export** (AC8 of FR-AUTH-007) | No `dsar`/export code in `src/` | NDPR non-compliance |
| **No CI** | No `.github/` workflows | Nothing enforces the test suite |
| **No linter** | `bun run lint` → `echo 'no linter configured yet'` | Only `typecheck` gates quality |
| **No migration history** | `bun run db:push` only; one migration file on disk | No reproducible schema evolution |
| **No queue / scheduler / worker runtime** | Nothing in `src/lib/` | All background work (publishing, ingestion, SLA, aggregation) is unbuildable |
| **No email transport** | `src/services/email.ts` ships `ConsoleEmailTransport` | Verification/reset/invitation emails never actually send |
| **No cache** | ADR-004 claims SQLite; no cache library present | — |
| **No storage abstraction** | No media code | Uploads, media assets unbuildable |
| **No payments** | No Paystack/Stripe dependency | Cannot charge |
| **No web application** | `src/app/` is *Hono route handlers*, not a frontend | No user-facing product |
| **No mobile application** | — | — |
| **No RLS** | ADR-009 specifies it; not implemented | Tenant isolation is application-layer only |

### 1.3 Aspirational schema (present but not wired)

`db/` contains 10 module directories **excluded from `tsconfig.json`** and **not re-exported from `db/schema.ts`**: `billing/` (6), `campaigns/` (3), `commerce/` (5), `compliance/` (6), `engagement/` (6), `influencer/` (5), `monitoring/` (6), `pr/` (10), `publishing/` (2), `social-accounts/` (4) — **53 tables**. Plus `db/relations.ts` (cross-module relations, also excluded) and `db/index.ts` (empty).

**These tables are a design asset, not a runtime asset.** Nothing reads or writes them. They must be reviewed and wired module-by-module as each phase lands — do not assume they are correct just because they exist.

### 1.4 Documentation reality

`docs/` describes a materially different and larger system than the repo. Treat `src/` as truth.

| Doc claim | Reality |
|---|---|
| TanStack Start web app + React Native/Expo mobile | Neither exists |
| SQLite cache + rate limiting (ADR-004/015) | Rate limiting uses a **PostgreSQL `rate_limits` table** (`src/lib/rate-limit.ts`) |
| Nodemailer SMTP (`Tech Stack.md` §5.8) | `ConsoleEmailTransport` |
| Paystack (ADR-011) **and** Stripe (`Roadmap.md` §4.3) | Contradictory; neither present |
| Redis, Cloudflare R2 + Bunny CDN, WebSockets, queue | No dependencies or code |
| `Database Schema.md` table names (`conversations`, `mentions`, `articles`, `media_contacts`) | Actual names differ (`engagement_messages`, `social_mentions`, `media_articles`, `journalists`) |
| Module numbering | **Conflicts across three documents** — see §4/D1 |

---

## 2. Ground rules

1. **`src/` and `db/` are the source of truth.** Documentation establishes intent, never implementation. If a doc and the code disagree, the code wins and the doc is corrected.
2. **Service layer first, then HTTP.** Build and test services directly before adding route handlers.
3. **Every mutating service call writes an audit event.** No exceptions for security-sensitive operations.
4. **Every worker is idempotent.** Running twice must produce the same result.
5. **Tenant scope originates from authenticated context, never from the request body.**
6. **Every phase ends at a gate.** A phase is not complete because code was written — it is complete when its exit criteria are verified.
7. **New schema modules are wired one at a time.** When a phase adopts a `db/<module>/` directory, it must: review the tables against the module spec, add the exports to `db/schema.ts`, remove the directory from the `tsconfig.json` exclude list, generate a migration, and add tests.
8. **Do not build a second implementation of anything that exists.** Extend `src/lib/`, `src/services/`, `src/server/middleware/` rather than duplicating.

### 2.1 Definition of Done (applies to every ticket)

Implementation complete · migration generated and validated (if schema changed) · tests written (positive **and** negative) · `bun test` passes · `bun run typecheck` passes · lint passes · build passes · tenant isolation verified · authorization verified · audit event written (if mutating) · no parallel implementation introduced · relevant docs updated.

### 2.2 Ticket conventions

- **Ticket ID:** `NWB-P<phase>-<NNN>` — e.g. `NWB-P0-001`.
- **Phase slug (for `.scratch/`):** given per phase, e.g. `.scratch/p0-foundation-gap/`.
- **Size:** S (≤ half a day) · M (1–3 days) · L (4–10 days) · XL (needs splitting).
- Any ticket marked **XL** must be split before work starts.

---

## 3. Release definitions

| Release | Definition | Phases |
|---|---|---|
| **Foundation complete** | Every Module 1 FR implemented, CI green with a real database, migrations reproducible | P0–P1 |
| **MVP feature-complete** | All 10 MVP modules functional at API level with tests | P2–P13 |
| **Beta** | Web application covering all P0 workflows; security + NDPR review passed | P14–P15 |
| **Public launch** | Release gates in §8 satisfied; runbooks and support tooling in place | P15 |
| **Mobile** | iOS + Android shipped on shared API | P16 |
| **Post-launch** | AI/ML, public API, enterprise, additional platforms, i18n, white-label | P17 |

---

## 4. Decisions required

These were raised as unresolvable from the repo — the docs contradict each other or are silent. Each blocks specific phases. **Do not invent answers; record the decision and update the affected ADR.**

> **Updated 2026-09-13 (NWB-P0-007).** D1, D4, D5, and D7 are now resolved; D12 is new. Three of the original rows (D1, D4, D7) described conflicts that do not exist — they were resolvable all along from `docs/business/Decision Log.md`, an **approved** decision register this section had not consulted. The live register is `.scratch/p0-foundation-gap/decisions.md`.

| ID | Decision | Conflict / gap | Blocks | Recommendation |
|---|---|---|---|---|
| **D1** | Canonical module numbering | ✅ **Resolved 2026-09-13.** `docs/modules/*.md` is the lone outlier — 14 module docs in a 10-slot scheme with 5 collisions. `PRD.md` §8 (1–10) and `Roadmap.md` §4.2 **agree**; the Roadmap does not number modules at all. **This plan's phase labels use the `docs/modules/` scheme, not the PRD's** — only P2, P5, P6, P11 match. | All phases | ✅ Adopted: PRD 1–10 canonical, map added to `CONTEXT.md`. Non-PRD modules named, not numbered. **Raises D12** — the module *set* is still unresolved. |
| **D2** | Web framework | ADR-002 says TanStack Start; no frontend exists | P14 | Confirm TanStack Start, or supersede ADR-002 |
| **D3** | Cache + rate-limit store | ADR-004/015 say SQLite; `src/lib/rate-limit.ts` uses PostgreSQL. No cache library present | P1, P14 | Either amend ADR-004 to Postgres-backed rate limiting (matches code) or migrate to SQLite/Redis deliberately. Decide before load testing. |
| **D4** | Email provider | ✅ **Resolved 2026-09-13 — not a conflict.** `Decision Log.md` **DEC-028** (Approved 2026-01-25) specifies Resend; `Roadmap.md` §4.3 agrees. Only `Tech Stack.md` (Nodemailer) disagrees — a doc defect. | P1 | ✅ **Resend**, behind the existing transport interface in `src/services/email.ts`. Correct `Tech Stack.md`. |
| **D5** | Queue / scheduler runtime | ✅ **Resolved 2026-09-13** — genuinely undecided until now (no queue/scheduler/worker/cron decision in the ADRs or the Decision Log). | **P1 — was a hard blocker** | ✅ **ADR-028: `pg-boss`**, PostgreSQL-backed, started alongside the API per ADR-007. Redis/BullMQ only if D3 moves to Redis. |
| **D6** | Object storage | Docs say Cloudflare R2 + Bunny CDN; no code | P1 (media service) | Define a storage interface; R2 adapter in prod, local disk in dev |
| **D7** | Payment processor | ✅ **Resolved 2026-09-13 — not a contradiction.** `Decision Log.md` **DEC-025** (Approved 2026-01-10) specifies **both**: Paystack for NGN, Stripe for USD. | P13 | ✅ Dual processor per DEC-025. ADR-011 covers the NGN side, `Roadmap.md` §4.3 the USD side. Nothing to supersede. |
| **D8** | NLP / sentiment provider | Required by Monitoring + Listening; no decision recorded | P4, P5 | Choose provider; keep behind an interface so it is swappable |
| **D9** | Search implementation | `Tech Stack.md` says Postgres tsvector → Elasticsearch; nothing built | P4, P5 | Start with Postgres `tsvector`; defer Elasticsearch |
| **D10** | Decision Engine scope | `docs/modules/Nawebeus Decision Engine.md` (FR=17, US=25, untracked) explicitly **supersedes** the three `docs/modules/new features/` docs. Not referenced by the PRD or Roadmap | Product call | Decide whether it is in MVP scope. If yes it becomes a phase; if no, park it and note it in the Roadmap. |
| **D11** | Row-level security | ADR-009 specifies RLS; not implemented; app-layer scoping is | P15 (security review) | Either implement RLS or amend ADR-009 to "application-layer only, RLS deferred" — do not leave ambiguous |
| **D12** | **Module-set scope — is MVP five modules, ten, or this plan's twelve phases?** | **New, raised while resolving D1.** `DEC-005` (Approved) defines MVP as **five** modules (Grow, Listen, Monitor, Engage, Analyze) and explicitly **rejected** "All 10+ modules at MVP" as delaying launch 6+ months. `PRD.md`/`Roadmap.md` §4.2 say ten. This plan sequences P2–P13 (~14 domains). Two approved deferrals — **DEC-D003** (Influencer → Phase 4) and **DEC-D004** (Publishing → Phase 5) — place modules this plan schedules *inside* MVP, including **P3**, which §5 calls "the MVP's central demo" and which sits on the critical path. | **P3, P8, P9, P10** | **Product call — do not resolve in code.** Either DEC-005 governs (MVP = 5; move P3/P8/P9/P10 behind launch), or the PRD governs (supersede DEC-005), or this plan governs (supersede DEC-005 + DEC-D003/D004). The losing documents must be explicitly superseded. Tracked in `.scratch/p0-foundation-gap/decisions.md`. |

---

## 5. Phase plan

Each phase: **entry gate → tickets → exit gate.** Sizes are relative effort indicators, not commitments.

---

### P0 — Close the foundation gap

**Slug:** `.scratch/p0-foundation-gap/`
**Goal:** Make the existing foundation genuinely complete and enforceable before building on it.
**Entry gate:** none — start here.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P0-001 | API key management (FR-AUTH-010): create/list/revoke routes, service, `Bearer` auth middleware, key hashing | — | L | Key returned once on create, masked on list, revocable; `Bearer` authenticates on protected routes as a drop-in for the cookie; revoked key → 401 |
| NWB-P0-002 | DSAR data export (AC8 of FR-AUTH-007) | — | M | Request produces a machine-readable export of the subject's data within the NDPR window |
| NWB-P0-003 | CI pipeline: typecheck + lint + test against a Postgres service container | — | M | Every push runs `bun run typecheck`, `bun test` with `DATABASE_URL` set, and lint; failures block merge |
| NWB-P0-004 | Linter: adopt and configure (Biome recommended — single binary, Bun-friendly) | — | S | `bun run lint` lints for real; CI enforces |
| NWB-P0-005 | Migration baseline: move from `db:push` to generated, committed migrations | — | M | `drizzle/` holds an ordered, reviewable migration history; a clean database reaches current schema via migrations alone |
| NWB-P0-006 | Reconcile `.scratch/foundation` issue 07 → `done` | NWB-P0-001 | S | Foundation issue 07 and `p0-auth` statuses flip to `done`; no `in-progress` remains in the foundation set |
| NWB-P0-007 | Adopt decisions D1 + D5; record D2–D11 as tracked items | — | S | `CONTEXT.md` gains the module map; an ADR or note records the queue decision |

**Exit gate:** `bun test` green **in CI with a live database**; FR-AUTH-010 implemented and tested; migrations reproducible from zero; foundation `.scratch` set fully `done`.

---

### P1 — Shared infrastructure services

**Slug:** `.scratch/p1-shared-infra/`
**Goal:** Build the cross-cutting services every domain module needs. **This phase is the single largest multiplier in the plan** — skipping it forces every later module to reinvent audit, approval, media, and notifications.
**Entry gate:** P0 exit gate met; D5 (queue) decided.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P1-001 | **Queue + scheduler + worker base** (`src/lib/queue.ts`, `src/lib/scheduler.ts`, `src/lib/worker.ts`) | D5 | L | A registered worker runs on a cron/interval in dev; failures retry with backoff; failures and successes write audit events; a worker that runs twice is idempotent |
| NWB-P1-002 | Audit service formalization (`src/services/audit.ts` → full typing) | — | M | Every mutating service writes a typed audit event; queryable by actor/subject/org |
| NWB-P1-003 | Approval service (request, submit, approve, reject, approver queue, expire-stale worker) | P1-001 | L | Approval queue works end to end; stale requests expire on schedule |
| NWB-P1-004 | Email transport: real provider behind the existing interface | D4 | M | Verification, reset, and invitation emails deliver through a provider adapter; console adapter remains for dev/test |
| NWB-P1-005 | Media/storage service (initiate upload, confirm, process asset, signed URL, soft delete) | D6 | L | Upload → confirm → asset retrievable via signed URL; soft delete hides it; storage behind an interface |
| NWB-P1-006 | Templates service (create, get, picker, usage tracking) | — | M | Template CRUD + usage recorded |
| NWB-P1-007 | Contacts service (base `contacts` + `contact_interactions`) | — | M | Contact + interaction CRUD; reusable by PR and Influencer |
| NWB-P1-008 | Notification engine core (create notification, recipients, delivery log) | P1-004 | L | A notification fans out to recipients and records delivery attempts |
| NWB-P1-009 | Feature flags + system config (`evaluateFlag`, `getConfigValue`) | — | M | Flags gate a feature at runtime without redeploy; config read/write with audit |
| NWB-P1-010 | Retention + legal holds + backup records | P1-001 | M | Retention policy worker enforces deletion windows; legal holds block deletion |
| NWB-P1-011 | Impersonation sessions (start/end, audit) | P1-002 | M | Admin can impersonate with full audit trail; session ends cleanly |
| NWB-P1-012 | Observability baseline: structured logging, error tracking, request IDs | — | M | Errors are captured with correlation IDs; logs are structured |

**Exit gate:** a scheduled worker executes in dev and prod config; email actually sends via the chosen provider; the approval queue functions; media upload/retrieve works; feature flags gate a live code path. **Nothing downstream starts until this gate passes.**

---

### P2 — Social accounts & platform integration (Module 3)

**Slug:** `.scratch/p2-social-accounts/`
**Entry gate:** P1 exit gate. **Decision:** D8/D9 not required yet.
**Schema:** adopt `db/social-accounts/` (4 tables) per ground rule 7.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P2-001 | OAuth flow: initiate, state consumption (single-use, TTL), connect | P1-001 | L | A user connects a platform account; replayed state is rejected |
| NWB-P2-002 | Token lifecycle: encrypted storage, refresh worker, rotation | P2-001 | L | Tokens refresh before expiry; refresh failures are recorded and surfaced |
| NWB-P2-003 | Account health checks + circuit breaker | P2-002 | M | Unhealthy accounts are flagged; a tripped breaker stops dispatch to that account |
| NWB-P2-004 | Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`) | P2-001 | M | Quota exhaustion blocks further calls and reports remaining quota |
| NWB-P2-005 | Platform adapters × 5 (YouTube, X, Instagram, Facebook, Reddit — DEC-009) | P2-001 | XL → split per platform | Each platform connects, refreshes, and reports health |
| NWB-P2-006 | Routes: list, connect, callback, delete, health | P2-001…005 | M | Endpoints follow the response envelope and RBAC guards |

**Exit gate:** all five launch platforms connect, refresh tokens unattended, and report health. Circuit breaker demonstrably trips and recovers.

---

### P3 — Publishing & scheduling (Module 4)

**Slug:** `.scratch/p3-publishing/`
**Entry gate:** P2 exit gate; P1-003 (approval) and P1-005 (media) complete.
**Schema:** adopt `db/publishing/` (2 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P3-001 | Posts service: create, version history, update | P1-005 | L | Every content edit produces a retrievable version |
| NWB-P3-002 | Schedule + cancel | P3-001 | M | Scheduled post enters the queue; cancel removes it cleanly |
| NWB-P3-003 | Publishing results + dispatch worker | P3-002, P2-003 | L | Queued post publishes to a real platform; result recorded per platform |
| NWB-P3-004 | Retry worker + reconciliation worker | P3-003 | L | Failed publishes retry with backoff; platform status is reconciled back to our records |
| NWB-P3-005 | Approval integration (submit for approval → approve → publishable) | P3-001, P1-003 | M | Unapproved posts cannot be scheduled or published |
| NWB-P3-006 | Content calendar query | P3-002 | M | Calendar returns posts across a date range, tenant-scoped |
| NWB-P3-007 | Routes: posts CRUD, schedule, cancel, submit-for-approval, versions, calendar | P3-001…006 | M | All endpoints RBAC-guarded and envelope-compliant |

**Exit gate:** schedule a post → it publishes to a live platform → the result is recorded → a forced failure retries and reconciles. **This is the first end-to-end product proof; treat it as the MVP's central demo.**

---

### P4 — Media monitoring (Module 9)

**Slug:** `.scratch/p4-monitoring/`
**Entry gate:** P1 exit gate. **Decision:** D8 (NLP), D9 (search).
**Schema:** adopt `db/monitoring/` (6 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P4-001 | Monitoring campaigns service | — | M | Campaign CRUD, active-campaign query |
| NWB-P4-002 | Article ingestion worker | P1-001 | L | Articles are ingested on schedule; duplicates are not created |
| NWB-P4-003 | NLP enrichment worker (sentiment, entities) | P4-002, D8 | L | Ingested articles gain sentiment + entity metadata |
| NWB-P4-004 | Competitor tracking + metrics worker (weekly) | P4-002 | M | Share-of-voice computed per competitor on schedule |
| NWB-P4-005 | Crisis incidents (create, acknowledge, resolve, response actions) | P4-002 | M | Crisis lifecycle enforced with audit trail |
| NWB-P4-006 | Routes: campaigns, articles, competitors, crises | P4-001…005 | M | All endpoints tenant-scoped and RBAC-guarded |

**Exit gate:** articles ingest and enrich unattended; SOV is computed; a crisis can be raised, acknowledged, and resolved with a full audit trail.

---

### P5 — Social listening (Module 5)

**Slug:** `.scratch/p5-listening/`
**Entry gate:** P4 exit gate (shares the ingestion/enrichment pipeline — **extend it, do not duplicate it**).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P5-001 | Listening queries (builder, persistence) | — | M | Query CRUD; query definitions are tenant-scoped |
| NWB-P5-002 | Mention collection against queries | P4-002, P5-001 | L | Mentions collected per query without duplication |
| NWB-P5-003 | Sentiment + tagging on mentions | P4-003, P5-002 | M | Mentions scored and taggable |
| NWB-P5-004 | Listening alerts (rule → event) | P5-003, P1-008 | M | A matching mention fires an alert to the notification engine |
| NWB-P5-005 | Routes: queries, mentions, tags, alerts | P5-001…004 | M | Endpoints tenant-scoped, envelope-compliant |

**Exit gate:** a query collects mentions, scores sentiment, and fires an alert that reaches a recipient.

---

### P6 — Notifications & alerts delivery (Module 9)

**Slug:** `.scratch/p6-notifications/`
**Entry gate:** P1-008 (engine core).
**Note:** the *engine* lands in P1 because Monitoring, Listening, Engagement, and PR all depend on it. This phase completes **channels, preferences, and digests**.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P6-001 | Channel adapters: in-app, email | P1-004, P1-008 | L | Notifications deliver on both channels; failures recorded |
| NWB-P6-002 | Notification preferences (per user, per category) | P6-001 | M | Users control what they receive; preferences are respected at send time |
| NWB-P6-003 | Digest + batching worker | P6-002 | M | Digest mode batches instead of sending per event |
| NWB-P6-004 | Push channel (Expo) — **deferred to P16** | — | — | Placeholder: wire when mobile lands |
| NWB-P6-005 | Routes: preferences, notification list, mark-read | P6-001…003 | M | Endpoints tenant- and user-scoped |

**Exit gate:** a monitoring alert reaches a real inbox and a real email; preferences and digest mode demonstrably change behaviour.

---

### P7 — Engagement hub (Module 6)

**Slug:** `.scratch/p7-engagement/`
**Entry gate:** P2 exit gate (platform webhooks); P1-003, P1-008.
**Schema:** adopt `db/engagement/` (6 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P7-001 | Message ingestion from platform webhooks | P2-001, P1-001 | L | Inbound messages appear in the inbox; duplicate webhook deliveries are idempotent |
| NWB-P7-002 | Routing rules + application on ingestion | P7-001 | L | Rules assign messages deterministically |
| NWB-P7-003 | Workflow: assign, status, snooze, priority override, first-response | P7-001 | L | Message lifecycle enforced with audit |
| NWB-P7-004 | Response drafts + approval + send | P7-003, P1-003, P2-005 | L | A response is drafted, approved, sent, and its outcome recorded |
| NWB-P7-005 | SLA monitor worker + breach recording + escalation | P7-003, P1-001 | L | Breaches are recorded and escalate on schedule |
| NWB-P7-006 | AI suggestion storage + feedback | P7-004 | M | Suggestions stored, marked used, feedback recorded (generation itself is P17) |
| NWB-P7-007 | Routes: inbox, message detail, assign, resolve, snooze, responses, send, SLA at-risk, routing rules | P7-001…006 | L | All endpoints tenant-scoped and RBAC-guarded |

**Exit gate:** a real inbound message is routed, assigned, responded to, and — when unanswered — triggers an SLA breach with escalation.

---

### P8 — Media relations & PR (Module 8)

**Slug:** `.scratch/p8-pr/`
**Entry gate:** P1-007 (contacts), P1-003 (approval), P4 (coverage attribution needs monitoring).
**Schema:** adopt `db/pr/` (10 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P8-001 | Journalists (contacts + detail in one transaction), NDPR consent state | P1-007 | L | Journalist creation is atomic; consent state is queryable |
| NWB-P8-002 | Press releases + version history + approval | P1-003 | L | Every edit is versioned; approval gates distribution |
| NWB-P8-003 | Distributions with **NDPR consent gate** | NWB-P8-001, NWB-P8-002 | L | Distribution to a non-consented journalist is **refused at the service layer** |
| NWB-P8-004 | Distribution dispatch worker + metrics webhook | NWB-P8-003, P1-001 | L | Queued distributions send; metrics update inbound |
| NWB-P8-005 | Coverage attribution (link monitoring articles to releases, verify) | P4-002, NWB-P8-002 | L | Attribution created in a transaction; AVE updated atomically |
| NWB-P8-006 | Routes: journalists, consent, press releases, submit, approve, distributions, coverage | NWB-P8-001…005 | L | Endpoints tenant-scoped, RBAC-guarded |

**Exit gate:** a press release is approved, distributed only to consented journalists, and resulting coverage is attributed back to it.

---

### P9 — Influencer management (Module 10)

**Slug:** `.scratch/p9-influencer/`
**Entry gate:** P1-007; P12 (analytics) for performance actuals — schedule P9 performance tickets after P12 if needed.
**Schema:** adopt `db/influencer/` (5 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P9-001 | Influencer discovery + profile (contacts + detail transaction), blacklist | P1-007 | L | Creation is atomic; blacklisted influencers are excluded from discovery |
| NWB-P9-002 | Programs | NWB-P9-001 | M | Program CRUD with NGN budget |
| NWB-P9-003 | Assignments + **atomic `spentNaira` commit on contract** | NWB-P9-002 | L | Budget commit is transactional; concurrent commits cannot overspend |
| NWB-P9-004 | Content submissions + compliance checks + approval | NWB-P9-003, P1-003 | L | Content moves through submit → check → approve/changes → published |
| NWB-P9-005 | Performance workers (assignment + campaign actuals) | NWB-P9-003 | M | Performance updated on schedule |
| NWB-P9-006 | Routes: influencers, programs, assignments, status, content, approve | NWB-P9-001…005 | L | Endpoints tenant-scoped, RBAC-guarded |

**Exit gate:** an influencer is onboarded, contracted (budget committed atomically), submits content, and performance is tracked.

---

### P10 — Social commerce (Module 7)

**Slug:** `.scratch/p10-commerce/`
**Entry gate:** P2 (platform sync).
**Schema:** adopt `db/commerce/` (5 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P10-001 | Products: create, update inventory, publish, soft delete | — | L | Product lifecycle with soft delete; inventory updates are atomic |
| NWB-P10-002 | Discounts: create, activate, redeem, expiry worker | NWB-P10-001 | L | Discount redemption is atomic and cannot exceed limits; expired discounts stop applying |
| NWB-P10-003 | Orders + status + fulfilment | NWB-P10-001 | L | Order lifecycle enforced; invalid transitions rejected |
| NWB-P10-004 | Carts: upsert, abandonment worker, recovery, mark recovered | NWB-P10-001 | L | Abandoned carts detected on schedule; recovery recorded |
| NWB-P10-005 | Product sync to platforms + sync log | P2-005, NWB-P10-001 | L | Sync start/complete recorded; failures visible |
| NWB-P10-006 | Routes: products, orders, status, fulfilment, discounts | NWB-P10-001…005 | M | Endpoints tenant-scoped, RBAC-guarded |

**Exit gate:** a product is created, synced to a platform, ordered, and an abandoned cart is detected and recovered.

---

### P11 — Campaigns / Growth & giveaways (Module 4)

**Slug:** `.scratch/p11-campaigns/`
**Entry gate:** P1 (approval, notifications). **Note:** the public entry endpoint is the first **unauthenticated** write path in the system — treat it as security-critical.
**Schema:** adopt `db/campaigns/` (3 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P11-001 | Campaign builder (campaign + entry methods in one transaction), publish, end, public slug lookup | P1-001 | L | Campaign creation is atomic; public lookup exposes only published campaigns |
| NWB-P11-002 | Entries: idempotent create, referral counter, completed actions, verification | NWB-P11-001 | L | Duplicate entry attempts are rejected idempotently; referral counts are correct |
| NWB-P11-003 | **Public entry endpoint** — rate limited, validated, abuse-resistant | NWB-P11-002, D3 | L | Unauthenticated entry is rate-limited per IP and per identity; no enumeration leak |
| NWB-P11-004 | Fraud scoring worker | NWB-P11-002 | L | Suspicious entries are flagged for review |
| NWB-P11-005 | Winners: draw (random + points), notify, response, fulfilment, forfeit-overdue | NWB-P11-002, P1-008 | L | Draw is auditable and reproducible; deadlines enforced by worker |
| NWB-P11-006 | Routes: campaigns, publish, end, enter (public), entries, winners, draw, notify, fulfilment | NWB-P11-001…005 | L | Authenticated endpoints RBAC-guarded; the public one hardened |

**Exit gate:** a campaign goes live, accepts public entries under load with rate limiting, draws winners, and notifies them.

---

### P12 — Analytics & reporting (Module 7)

**Slug:** `.scratch/p12-analytics/`
**Entry gate:** P3–P11 emit events. Build last — it reads from everything.
**Schema:** adopt `db/shared/analytics*` (already active) + new aggregates.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P12-001 | Aggregation service + hourly/daily workers | P1-001 | L | Aggregates are upserted on schedule; re-running does not double-count |
| NWB-P12-002 | Dashboards (create, get, update widgets) | NWB-P12-001 | L | Dashboard CRUD; widgets render from aggregates |
| NWB-P12-003 | Reports: create, schedule, run worker, export | NWB-P12-001, P1-005 | L | Scheduled reports run and export to a retrievable file |
| NWB-P12-004 | Alert rules + evaluation worker (every 60s) | NWB-P12-001, P1-008 | L | Threshold breaches fire alerts |
| NWB-P12-005 | Routes: overview, time-series, dashboards, reports, alert rules | NWB-P12-001…004 | L | Endpoints tenant-scoped; aggregates never leak across tenants |

**Exit gate:** aggregates populate, a dashboard renders, a scheduled report exports, and a threshold alert fires.

---

### P13 — Billing & monetization

**Slug:** `.scratch/p13-billing/`
**Entry gate:** P1 (queue, config, notifications). **Decision:** D7 (processor).
**Schema:** adopt `db/billing/` (6 tables).

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P13-001 | Plans + subscriptions + entitlements model | D7 | L | A subscription maps to a set of entitlements |
| NWB-P13-002 | Processor integration (Paystack) + webhook handling | NWB-P13-001 | L | Webhooks are verified, idempotent, and update subscription state |
| NWB-P13-003 | Usage tracking + plan-limit enforcement | NWB-P13-001, P1-009 | L | Exceeding a plan limit blocks the gated action and prompts upgrade |
| NWB-P13-004 | Invoices + dunning (failed payment retry) | NWB-P13-002, P1-001 | L | Failed payments retry on schedule and notify |
| NWB-P13-005 | Routes: plans, subscribe, invoice list, webhook | NWB-P13-001…004 | L | Endpoints tenant-scoped; webhook is publicly reachable but signature-verified |

**Exit gate:** a customer subscribes, the entitlement applies, a plan limit is enforced, and a failed payment is retried and surfaced.

---

### P14 — Web application

**Slug:** `.scratch/p14-web/`
**Entry gate:** P3 (the first usable workflow) — but the app can start against the auth surface immediately. **Decision:** D2 (framework).
**Note:** this is the largest single phase. It should be split into sub-phases, one per screen cluster, each independently shippable.

Screen order (each unlocks the next, per `docs/Foundation Phase.md` Phase 15):

| Sub-phase | Screens | Deps | Notes |
|---|---|---|---|
| P14.1 | Auth: login, register, verify email, reset password | P0 | Unlocks everything |
| P14.2 | Org setup: create org, invite members, onboarding checklist | P0 | |
| P14.3 | Social account connect (OAuth) | P2 | |
| P14.4 | Publishing: composer, calendar, approval queue | P3 | First real product value |
| P14.5 | Monitoring: article list, sentiment dashboard, crisis panel | P4 | |
| P14.6 | Listening: query builder, mention feed | P5 | |
| P14.7 | Engagement: unified inbox, response composer, SLA panel | P7 | |
| P14.8 | PR: journalist CRM, release editor, distribution | P8 | |
| P14.9 | Influencer: discovery, briefing, content review | P9 | |
| P14.10 | Commerce: catalog, orders, cart recovery | P10 | |
| P14.11 | Campaigns: builder, public entry page, winner draw | P11 | Public page must be hardened |
| P14.12 | Analytics: dashboards, reports, alert rules | P12 | |
| P14.13 | Admin/compliance: audit log viewer, DSAR queue, feature flags, system config | P1 | |
| P14.14 | Billing: plans, checkout, invoices | P13 | |
| P14.15 | Notifications: preferences, inbox | P6 | |

**Per-screen requirements (applies to every sub-phase):** loading · skeleton · empty · error · permission-denied · not-found · mutation-pending · optimistic + rollback where used · success confirmation · cache invalidation · responsive · keyboard-accessible.

**Exit gate:** every P0 workflow is usable in the browser with complete UI states; no screen is a dead end; permission-gated UI matches server enforcement.

---

### P15 — Beta hardening & public launch

**Slug:** `.scratch/p15-launch/`
**Entry gate:** P14 exit gate.

| ID | Ticket | Deps | Size | Acceptance summary |
|---|---|---|---|---|
| NWB-P15-001 | Security review: tenant isolation on every read/write path, IDOR, authz bypass, mass assignment | P14 | L | No cross-tenant access path remains; findings remediated and regression-tested |
| NWB-P15-002 | NDPR / GDPR compliance verification (DSAR, retention, consent, audit) | P14, NWB-P0-002 | L | Compliance checklist signed off |
| NWB-P15-003 | Load & performance validation against agreed budgets | P14 | L | API p95 and page load meet `Roadmap.md` §18.3 targets at expected scale |
| NWB-P15-004 | Observability + alerting for production | P1-012 | M | Errors, queue depth, and worker failures are alerted |
| NWB-P15-005 | Runbooks: incident, rollback, backup restore, queue recovery | P14 | M | Each runbook executed once in staging |
| NWB-P15-006 | Support tooling: impersonation, audit lookup, account recovery | P1-011 | M | Support can resolve the top 10 expected tickets without engineering |
| NWB-P15-007 | Release gates checklist (§8) executed | all | M | Every gate item verified and recorded |

**Exit gate:** §8 release gates fully satisfied.

---

### P16 — Mobile application (post-launch)

**Slug:** `.scratch/p16-mobile/`
**Entry gate:** public launch (DEC-008 places native mobile after MVP launch).
**Framework:** React Native + Expo (shared API; `Roadmap.md` §6.3).

Key workstreams: shared auth/token storage · offline cache + mutation queue · sync with conflict handling · push notifications (wire NWB-P6-004) · biometric auth · core screens (inbox, mention feed, dashboard) · store submission.

**Critical requirement:** every offline path must define source-of-truth, ID reconciliation, idempotency, and conflict resolution **explicitly** — this is the single most failure-prone area of the product. Do not ship offline mutation support without tested conflict semantics.

**Exit gate:** offline mutations survive app termination and reconnect without data loss or duplication; conflicts resolve deterministically.

---

### P17 — Post-launch roadmap

**Slug:** `.scratch/p17-roadmap/`
**Entry gate:** public launch.

Referenced from `docs/product/Roadmap.md` — do not duplicate the detail here. Sequence: AI/ML features (Phase 4) → public API + integrations (Phase 5) → enterprise SSO/SCIM (Phase 6) → additional platforms (Phase 7) → internationalization (Phase 8) → white-label/agency (Phase 9) → marketplace (Phase 10).

Two dependencies this plan creates:
- **Public API (Roadmap Phase 5) is blocked by NWB-P0-001** (API keys) — it cannot ship without it.
- **AI features (Roadmap Phase 4) reuse** the suggestion storage built in NWB-P7-006 and the enrichment interface from D8.

---

## 6. Dependency graph & critical path

```text
P0  Close foundation gap (API keys, CI, migrations, lint)
     │
     ▼
P1  Shared infrastructure  ←── D5 (queue) is a HARD BLOCKER here
     │                        P1-001 queue  →  unblocks every worker in the plan
     ├──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼              ▼
P2 Social       P4 Monitoring   P6 Notif.     P13 Billing
 accounts           │           delivery          │
     │              ▼              │               │
     ▼         P5 Listening        │               │
P3 Publishing        │             │               │
     │               └──────┬──────┘               │
     ▼                      ▼                      │
P7 Engagement          P8 PR ──→ P9 Influencer      │
     │                      │         │            │
     ▼                      │         │            │
P10 Commerce                │         │            │
     │                      │         │            │
     └──────────┬───────────┴─────────┴────────────┘
                ▼
          P11 Campaigns
                │
                ▼
          P12 Analytics  ← must be last; reads from everything
                │
                ▼
          P14 Web application
                │
                ▼
          P15 Beta + launch
                │
                ▼
          P16 Mobile  →  P17 Post-launch roadmap
```

**Critical path:** `P0 → P1 (queue) → P2 → P3 → P7 → P11 → P12 → P14 → P15`.

**Safe parallelisation (after P1 exit gate):**
- `P2 → P3` and `P4 → P5` are independent streams.
- `P13 Billing` can proceed in parallel with `P4–P12` once P1 lands.
- `P14.1–P14.2` (auth + org screens) can start immediately after P0, in parallel with all backend work.
- `P6` must land before `P5-004`, `P8-004`, `P11-005` (all fire notifications).

**Do not parallelise** consumers of an unstable contract. `P3`, `P7`, `P10`, and `P14.4` all consume the social-account + publishing contracts — stabilise those first.

---

## 7. Cross-cutting workstreams

These run across phases and must not be treated as one-off tickets.

| Workstream | Where it applies | Notes |
|---|---|---|
| **Audit events** | Every mutating service, every phase | Enforced by P1-002; a service that mutates without auditing is a defect |
| **Tenant isolation** | Every query, every phase | Assert in tests: no path returns another org's data |
| **Authorization** | Every route, every phase | `requireAbility` on every endpoint; server-enforced, never UI-only |
| **Idempotency** | Every worker, every public write endpoint | P11-003 and webhook handlers are the highest-risk |
| **Transactions** | Multi-table writes | Journalist/influencer/campaign creation, budget commit, SLA breach, coverage attribution |
| **NDPR gates** | PR distribution, campaign entries, DSAR | Consent checked at the service layer, not the UI |
| **Nigerian defaults** | Org/user creation | `Africa/Lagos`, `NGN`, `en-NG`, `dd/mm/yyyy` |
| **Feature flags** | Every non-core feature | Ship dark, enable later (P1-009) |
| **Observability** | Every worker and route | Correlation IDs from P1-012 |
| **Migrations** | Every schema adoption | Ground rule 7 |

---

## 8. Release gates

### Before any phase begins
- [ ] Previous phase exit gate met and recorded.
- [ ] Required decisions (§4) resolved for this phase.
- [ ] Schema modules to be adopted reviewed against the module spec.
- [ ] Tenant + authorization invariants for new surfaces written down.
- [ ] Tests specified (positive and negative).

### Before public launch
- [ ] All P0–P15 tickets complete.
- [ ] CI green: typecheck + lint + full test suite against a live database.
- [ ] Migration path verified from an empty database to current schema.
- [ ] No known cross-tenant access path.
- [ ] No known IDOR or authorization bypass.
- [ ] NDPR/GDPR checklist signed off (incl. DSAR export).
- [ ] Every P0 workflow verified end-to-end in the browser.
- [ ] All workers idempotent and observable; queue failures alerted.
- [ ] Backup restore exercised successfully.
- [ ] Runbooks written and rehearsed.
- [ ] Performance budgets met.
- [ ] No unresolved destructive data-integrity issue.

---

## 9. Progress tracking

Each phase becomes a `.scratch/` feature directory following `docs/agents/issue-tracker.md`:

```
.scratch/
  p0-foundation-gap/
    spec.md                 ← phase goal, entry/exit gates, ticket index
    issues/
      01-api-key-management.md      ← NWB-P0-001
      02-dsar-export.md             ← NWB-P0-002
      ...
  p1-shared-infra/
  ...
```

Rules:
- `Status:` on each issue is authoritative (`ready-for-agent` → `claimed` → `in-progress` → `done`).
- `in-progress` **must** carry a one-line note naming what is outstanding.
- A phase's `spec.md` `Status:` is `in-progress` until every issue in it is `done`.
- Tick checkboxes only when the ticket is genuinely complete.
- The phase exit gate is recorded in the phase `spec.md` with the verification evidence (test output, screenshot, or command transcript).

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Aspirational schema is wrong** — 53 unwired tables have never been executed | High | High | Review each module's tables against its spec before adoption; add constraint tests as each is wired |
| **Queue decision deferred too long** (D5) | High | High | Resolve in P0. P1 cannot start without it |
| **Doc/reality drift misleads implementers** | High | Medium | §1.4 is the reference; correct docs when found wrong |
| **Module numbering confusion** (D1) | High | Medium | Adopt PRD numbering in P0-007 and add the map to `CONTEXT.md` |
| **Public campaign entry endpoint abused** | Medium | High | Rate limiting + fraud scoring (P11-003/004) treated as P0 within P11 |
| **Offline sync data loss** (P16) | Medium | Critical | Define conflict semantics before writing sync code; test termination mid-mutation |
| **NDPR non-compliance at launch** | Medium | High | DSAR export in P0; consent gates in P8/P11; compliance review in P15 |
| **Web phase becomes unbounded** | High | Medium | 15 sub-phases, each independently shippable, each with its own exit gate |
| **Payment processor contradiction** (D7) | Medium | Medium | Decide in P0; supersede the losing document |
| **Rate limiting degrades under real load** | Medium | Medium | Revisit D3 before load testing in P15 |
| **Test coverage gap on security paths** | Medium | High | Tenant-isolation and authorization tests are required in every phase's DoD |

---

## 11. Immediate next actions

In exact dependency order:

1. ~~**NWB-P0-007** — adopt D1 (module numbering) and D5 (queue runtime). These unblock P1 and are cheap.~~ ✅ **Done 2026-09-13.** Module map in `CONTEXT.md`; queue decision recorded as ADR-028. D4 and D7 also fell out as already-decided. **New blocker surfaced: D12** (module-set scope) — resolve before P3, P8, P9, or P10.
2. **NWB-P0-001** — implement API key management (FR-AUTH-010). Closes the one outstanding Module 1 FR and unblocks the future public API.
3. **NWB-P0-003 + NWB-P0-004** — stand up CI and a linter. Nothing after this is verifiable without them.
4. **NWB-P0-005** — migration baseline. Every later phase adopts schema; without reproducible migrations that is unsafe.
5. **NWB-P0-002** — DSAR export. Compliance obligation, small, and independent.
6. **NWB-P0-006** — flip foundation issue 07 to `done` once P0-001 lands.
7. **Begin P1** with NWB-P1-001 (queue) — the single highest-leverage ticket in the plan.

---

## Appendix A — Document conflict register

| Conflict | Documents | Resolution |
|---|---|---|
| Module numbering (5 collisions) | `docs/modules/*.md` **alone** — 14 module docs in a 10-slot scheme. `PRD.md` §8 and `Roadmap.md` §4.2 agree on the same ten modules | **D1 — resolved.** Adopt PRD numbering; `docs/modules/` numbers deprecated. Map in `CONTEXT.md` |
| MVP module *set* (5 vs 10 vs 12 phases) | `DEC-005` (5 modules) vs `PRD.md`/`Roadmap.md` §4.2 (10) vs this plan (P2–P13) | **D12 — open, product call** |
| Module deferrals | `DEC-D003`/`DEC-D004` defer Influencer and Publishing to Phases 4/5, but this plan schedules them at P9 and P3 (inside MVP) | **D12** |
| Web framework | `ADR-002` (TanStack Start) vs no frontend | D2 |
| Cache/rate-limit store | `ADR-004`/`ADR-015` (SQLite) vs `src/lib/rate-limit.ts` (Postgres) | D3 |
| Email provider | `Tech Stack.md` (Nodemailer) vs **`DEC-028` (Resend) + `Roadmap.md` (Resend)** | **D4 — resolved.** Resend; `Tech Stack.md` is the defect |
| Payment processor | **`DEC-025` resolves it: Paystack for NGN, Stripe for USD.** `ADR-011` and `Roadmap.md` §4.3 are the two halves, not a conflict | **D7 — resolved.** No supersession needed |
| Rate-limit ADR reference | `Tech Stack.md` cites "ADR-007" for Paystack; ADR-007 is single-deployable-service | Documentation defect — correct `Tech Stack.md` |
| Table names | `Database Schema.md` (`conversations`, `mentions`, `articles`) vs actual (`engagement_messages`, `social_mentions`, `media_articles`) | Documentation defect — correct `Database Schema.md` |
| Decision Engine scope | `docs/modules/Nawebeus Decision Engine.md` supersedes `docs/modules/new features/*`; unreferenced by PRD/Roadmap | D10 |
| Phase schemes | `Roadmap.md` (0–10), `Foundation Phase.md` (0–15), `Business.md` (4 phases), `Project Charter.md` (0–8) | This plan's P0–P17 is canonical for engineering; business phasing stays in the Roadmap |

---

## Appendix B — Ticket index

| Phase | Tickets | Slug |
|---|---|---|
| P0 | NWB-P0-001 … 007 | `p0-foundation-gap` |
| P1 | NWB-P1-001 … 012 | `p1-shared-infra` |
| P2 | NWB-P2-001 … 006 | `p2-social-accounts` |
| P3 | NWB-P3-001 … 007 | `p3-publishing` |
| P4 | NWB-P4-001 … 006 | `p4-monitoring` |
| P5 | NWB-P5-001 … 005 | `p5-listening` |
| P6 | NWB-P6-001 … 005 | `p6-notifications` |
| P7 | NWB-P7-001 … 007 | `p7-engagement` |
| P8 | NWB-P8-001 … 006 | `p8-pr` |
| P9 | NWB-P9-001 … 006 | `p9-influencer` |
| P10 | NWB-P10-001 … 006 | `p10-commerce` |
| P11 | NWB-P11-001 … 006 | `p11-campaigns` |
| P12 | NWB-P12-001 … 005 | `p12-analytics` |
| P13 | NWB-P13-001 … 005 | `p13-billing` |
| P14 | P14.1 … P14.15 (sub-phases) | `p14-web` |
| P15 | NWB-P15-001 … 007 | `p15-launch` |
| P16 | workstreams | `p16-mobile` |
| P17 | referenced from Roadmap | `p17-roadmap` |

---

## Appendix C — Verification log

### NWB-P0-020 re-run (2026-09-20) — supersedes the 2026-09-13 numbers below

Executed end to end on a **freshly created, empty** PostgreSQL 14.23 database
(`DROP DATABASE` → `CREATE DATABASE` → `db:migrate` → `seed` → `bun test`), at
HEAD `51c1a2d` on branch `arena/01a0c0ad-nawebeus`. Every number below was run,
not carried forward — the 2026-09-13 entries were dated and the sandbox that
produced the roadmap could not execute Bun at all.

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `51c1a2dedb91ac3627d43d6fbc0a31d97761d3eb` |
| `bun --version` | 1.4.2 (was 1.4.0 on 2026-09-13) |
| `node --version` | v22.22.3 |
| PostgreSQL | 14.23 (the pinned CI floor) |
| `db:migrate` from an **empty** database | PASS — 1 migration, 30 public tables, ~1.5 s |
| `db:migrate` re-run on the migrated database | PASS — **no-op, no error** (exit criterion 3) |
| `bun run seed` | PASS; re-run idempotent |
| `bun test` **with** `DATABASE_URL` | **395 pass / 0 fail**, 1182 assertions, 42 files, ~28 s |
| `bun test` **without** `DATABASE_URL` | **222 pass / 184 skip / 0 fail**, 406 collected, ~0.2 s |
| `bun run typecheck` | PASS (clean) |
| `bunx biome check .` | PASS — **0 errors**, 499 warnings, 2 infos, 178 files |
| `bun run build` | PASS — `dist/index.js`, 0.66 MB |
| Test files / blocks | 42 files, 438 `describe`/`test` blocks |
| Active tables | **30** (plan §1 said 28: `data_export_requests` added by NWB-P0-002, plus the org-deletion work) |
| Routes / services | 15 `*.route.ts`, 27 service modules, 124 `.ts` files under `src/` |

Deltas worth noting against the last recorded run: the suite has gone
**96 → 395 passing** (+311), the DB-gated skip count **33 → 184**, and lint moved
from red at HEAD (F-27) to 0 errors. The `db:push` step named in the original
NWB-P0-020 steps was deliberately **not** used — NWB-P0-005/009 replaced it with
`db:migrate` as the evolution path, and `db:push` is now dev-convenience only.

### Original log (2026-09-13, HEAD `049a837` — superseded)

| Date | Check | Result |
|---|---|---|
| 2026-09-13 | `bun test` | 96 pass, 0 fail, 33 skipped (DB-gated) |
| 2026-09-13 | `bun --version` | 1.4.0 |
| 2026-09-13 | `git rev-parse HEAD` | `049a837bfa7bfc2c8fa881b6531b040e129f3443` |
| 2026-09-13 | API key implementation search (`api[_-]?key`, `Bearer` in `src/`) | Not present — only `"api_key"` as an `AuditActorType` |
| 2026-09-13 | DSAR / export search in `src/` | Not present |
| 2026-09-13 | `db/schema.ts` exports | `shared` + `core` + `organization` only |
| 2026-09-13 | `tsconfig.json` excludes | 10 schema dirs + `db/relations.ts` |
| 2026-09-13 | `.scratch/` git status | Gitignored except `**/*.md` (verified via `git ls-files`) |

### NWB-P0-007 re-verification (2026-09-13)

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `049a837` — unchanged; §1 baseline still current |
| `bun test` | 96 pass, 33 skip, 0 fail — matches Appendix C |
| `docs/modules/*.md` numbering | 14 module docs, 5 collisions (4, 7, 9, 10 doubled; "3 & 5" double-claims 3) |
| `docs/product/Roadmap.md` module numbers | **None** — §4.2 lists the same ten modules as the PRD, unnumbered |
| `DEC-005` (Decision Log) | MVP = **five** modules; "All 10+ modules at MVP" explicitly rejected |
| `DEC-025` | Paystack (NGN) **and** Stripe (USD) — D7 already decided |
| `DEC-028` | Resend — D4 already decided |
| Queue/scheduler/worker/cron in ADRs + Decision Log | **Absent** — D5 was genuinely undecided (two incidental hits: `Bun.cron` in ADR-001, "Cloudflare Workers" in ADR-002) |
| `db/core/api-keys.ts` | **Exists** — `apiKeys` table defined and exported from `db/schema.ts` |
| ADR numbering | ADR-018 … ADR-027 reserved by the planned table; new ADR took **ADR-028** |

---

*This plan is a living document. When a phase completes, record the evidence in §8 and the phase `spec.md`, refresh §1 if the codebase has moved, and re-run the checks in Appendix C.*
