# Master Roadmap — Target Architecture & Dependency Graph (§8–§9)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 8. Target architecture (derived from existing, per reuse-first rule)

### 8.1 Existing and **retained unchanged**
- Runtime: Bun 1.4.0 + Hono + Drizzle + `pg` (ADR-001/003/005); single deployable service (ADR-007) — pg-boss workers start in-process per ADR-028, structured so a separate process is config-only.
- Layering: `src/app` (thin routes) → `src/services` (logic + audit) → `src/lib` (infra). Ground rules 2 & 8 (services first; no parallel implementations).
- AuthN core: cookie JWT + rotation + token binding + API keys (all verified sound).
- Tenant pattern: JWT-derived orgId + `requireOrgMatch` + service-level org predicates + ALS org context.
- Error hierarchy + response envelope (`{data}`/`{error}`), typed AppErrors (ADR-016).
- Test architecture: `withTestDb` transaction wrapping, no-op DB unit seam, factories, preload.
- CI shape (quality + test jobs) — **extend, don't replace**.
- 28-table active schema; seed conventions; Nigerian defaults (NGN/Africa/Lagos/en-NG/DD/MM/YYYY).
- Aspirational schema modules — retained as design assets, adopted per ground rule 7.

### 8.2 Existing but **requiring modification**
| Component | Modification | Driver |
|---|---|---|
| `src/services/auth/signup.ts` | Assign owner role atomically in the signup write; fix verification link base | F-01, F-09 |
| `src/services/auth/mfa.ts` + new route | Complete challenge flow; single backup-code set, hashed | F-03/F-04 |
| `src/services/auth/auth.service.ts` | Enforce user status at sign-in | F-05 |
| `src/lib/rate-limit.ts` | Correct window-reset semantics; add reclamation worker; tests | F-12 |
| `src/seed.ts` + role model | Align role set (D13) and make self-protection guards reference real codes | F-07 |
| `src/app/orgs/org.route.ts` or seed strings | Single source of truth for the `org` vs `organization` subject | F-02 |
| `src/server/index.ts` | `cors({ origin: config.CORS_ORIGIN })`; single trusted-IP policy | F-13, F-10 |
| `src/server/middleware/rbac.ts` + `ability.ts` | Either pass condition objects for object-level checks or drop the decorative condition; document the real enforcement chain (F-06); add a regression test pinning CASL v7 behavior | F-06 |
| `src/server/api/users/index.ts` (the `src/app/` mirror was deleted in NWB-P0-026) | ~~Remove shadowing (mount admin routes under explicit `/users/admin/…`)~~ — **done, NWB-P0-029**: `userRouter.route("/users/admin", adminRouter)` | F-11 **closed** |
| `src/server/index.ts` | Delete dead `createApp()` factory (after confirming test usage) | F-17 |
| `db/schema.ts` + `tsconfig.json` | Per-module adoption as phases land (ground rule 7) | plan P2–P13 |
| `drizzle.config.ts` / CI | Migrate to `drizzle/` migration history (also covers pg-boss schema) | NWB-P0-005 |
| `src/services/email.ts` | Add Resend adapter; keep console for test | DEC-028 |
| `src/services/audit.ts` | Typed events, query API, extended module taxonomy | P1-002 |
| Docs | §6 corrections; API reference regenerated from routes | §6 |

### 8.3 **New and required** (all reuse existing patterns)
| New component | Reuses pattern of | Phase |
|---|---|---|
| `src/lib/queue.ts` + `src/lib/scheduler.ts` + `src/lib/worker.ts` (pg-boss) | `src/lib/db.ts` factory pattern; worker idempotency = ground rule 4 | 2 |
| `src/services/email/resend.ts` (transport adapter) | `ConsoleEmailTransport` | 2 |
| `src/services/storage/` (interface + R2/local adapters) | `EmailTransport` interface | 2 (D6) |
| `src/services/approval/`, `src/services/contacts/`, `src/services/notification/`, `src/services/flags/`, `src/services/impersonation/` | Existing service conventions (typed errors, audit, org predicate) | 2 |
| Observability: `src/lib/logging.ts`, `src/lib/correlation.ts` (request IDs) | `src/lib/*` | 2 |
| Module services + routes for P2–P6 (social-accounts, monitoring, listening, engagement, campaigns, notifications, [publishing/pr/commerce/influencer per D12], analytics, billing) | All existing conventions; schemas already drafted | 3–6 |
| Web app: TanStack Start (D2) with route-per-screen, TanStack Query, shared API client, per-state UI matrix (plan P14 "per-screen requirements") | ADR-002; API envelope already stable | 7 |
| Deployment: Dockerfile (Bun), systemd/Coolify manifests, nginx config, backup/restore scripts, Prometheus/Alertmanager config | `Infrastructure.md` §3–§6 (concrete, adopt as-is) | 8 |
| Coverage-gate script over `coverage/lcov.info` (85% services / 90% lib) — Bun 1.4 cannot gate via bunfig (verified in NWB-P0-003 ticket) | CI job pattern | 1 |
| Security test suite (tenant isolation matrix over all multi-tenant tables; permission positive+negative; IDOR sweep) | `rbac.test.ts` + `org-match.test.ts` patterns | 1 (foundation subset) → 8 (full) |

### 8.4 **Deprecated / removable** (evidence in §5/§6; nothing deleted without the strategy in §29)
- `src/server/index.ts:createApp` (dead) — F-17
- `docs/modules/*.md` numbering (superseded by D1) — header fixes only
- ADR-004/015 SQLite cache content (amend, don't delete) — D-03
- `db/manual-migrations/campaign-domain-disambiguation.sql` — fold into generated migrations when pr/influencer are adopted (ADR-017); delete file then
- "Gilo Business" contamination sections (D-09) — quarantine with owner sign-off
- `db/billing` … `db/social-accounts` aspirational dirs — **never delete**; they are the design asset for Phases 3–6

### 8.5 Boundaries (target state)
- **Application boundary:** one API service + in-process workers (ADR-007/028). Web app is a separate deployable (TanStack Start) consuming the REST API; no server routes move into the web app beyond the SSR proxy.
- **Module boundary:** each PRD module = `db/<domain>/` + `src/services/<domain>/` + `src/app/<domain>/` + `src/tests/<domain>/`; shared cross-cutting stays in `src/lib`/`src/services` root (audit, email, storage, notification, approval, contacts, flags).
- **Data ownership:** Organization owns all module data (every multi-tenant table carries `organization_id`; enforced by org predicate in every service + optional RLS per D11). Users own auth rows; platform owns `unified_audit_log` (tenant-scoped rows where org exists).
- **Tenant boundary:** JWT/API-key → single active org per session; org switching only if D14 mandates (then: session-scoped `orgId` override with membership re-check, ability reload).
- **API boundary:** `/api/auth/*`, `/api/users/*`, `/api/orgs/*`, `/api/api-keys/*` stable; future modules add `/api/<domain>/*`. No `/v1` (D15). Webhook/public endpoints explicitly listed per phase (platform webhooks P2/P7, Paystack/Stripe P13, campaign entry P11, notification callbacks).
- **State management:** server = PostgreSQL only (no cache at MVP per D3 recommendation); client = TanStack Query cache; no client-side business state.
- **Background processing:** pg-boss only; every worker idempotent; enqueue-in-transaction where the business write and job are atomic (ADR-028 rationale).
- **Testing architecture:** unit (no-DB, no-op seam) → integration (withTestDb) → API (createTestApp + real DB in CI) → E2E (Playwright, Phase 7+) → security suite → migration verification. Coverage gate by script.
- **Deployment:** single VPS, Coolify blue-green, Nginx TLS termination, WireGuard admin access (ADR-008), pg dumps + WAL archiving per Infra §5, Prometheus node/pg/app metrics + Alertmanager rules per Infra §6.4.

---

## 9. Dependency graph & critical path

```
PHASE 0  Discovery / baseline (this document)                      [DONE]
   │
   ▼
PHASE 1  Foundation completion + defect remediation
   │   ├─ D12 (scope) ────────────────┐  (blocks Phase 4 shape only)
   │   ├─ D13 (role model)  ──► F-01/F-07 fixes
   │   ├─ D11 (RLS) ─────────► Phase 8 security review
   │   ├─ D15 (API versioning) → API reference rewrite
   │   └─ NWB-P0-005 (migrations) ──► everything that adopts schema
   ▼
PHASE 2  Shared infrastructure (plan P1)   ← queue (NWB-P1-001) is the multiplier
   │      ├─ queue ──► approval, retention, purge, all module workers
   │      ├─ email (Resend) ──► notifications channels, DSAR delivery
   │      ├─ storage ──► media, report exports, avatars
   │      ├─ observability ──► Phase 8 alerting
   │      └─ flags/config ──► billing limits, dark launches
   ▼
PHASE 3  Social accounts (plan P2, Module 3)
   │      ├─► PHASE 4a  Monitor (P4) ─► Listen (P5)      [intelligence stream]
   │      ├─► PHASE 4b  Engage (P7)                                    [needs P2 webhooks]
   │      ├─► PHASE 4c  Grow/Campaigns (P11)  [public endpoint: security-critical]
   │      ├─► PHASE 4d  Notifications delivery (P6)  [before 4a/4b/4c alerts fire]
   │      └─► (Option B/C only) Publishing P3, PR P8, Influencer P9, Commerce P10
   │           ← all four BLOCKED by D12; P8 needs P4; P9 needs P12 actuals (or decoupled)
   ▼
PHASE 5  Analytics (plan P12)  ← builds last; reads aggregates from 4a–4d
   ▼
PHASE 6  Billing (plan P13)  ← parallelizable from Phase 2 onward (own schema, own processor)
   ▼
PHASE 7  Web application (plan P14.1–15)  ← 14.1/14.2 can start right after Phase 1 (auth+org surfaces)
   ▼
PHASE 8  Beta hardening + production readiness (plan P15 + Infra workstream)
   ▼
PHASE 9  Public launch (release gates §27)
   ▼
PHASE 10 Post-launch: mobile (P16), D12-deferred domains (Option A), P17 roadmap   [FUTURE]
```

**Critical path (Option A):** Phase 1 → Phase 2 (queue) → Phase 3 → Phase 4d/4a/4b → Phase 5 → Phase 7 → Phase 8 → Phase 9.
(Per the D12 memo §5 defect analysis, Publishing is *not* on the critical path — Engage is the first usable workflow under Option A; the memo's defect 3 is confirmed by this audit: P7's entry gate does not include P3.)

**Safe parallelism:**
- After Phase 1: web auth/org screens (P14.1–14.2) in parallel with Phase 2 backend.
- After Phase 2: Monitor stream (4a), Engage (4b), Campaigns (4c), Billing (Phase 6) are independent streams (each own schema + workers).
- Phase 4d (notification channels) must land before alert-firing tickets in 4a/4b/4c (plan §6 note).
- After Phase 5: analytics screens (P14.12) in parallel with remaining P14 clusters.
- **Do not parallelize** consumers of unstable contracts: P7/P10 (Option B) and web P14.4 all consume social-account/publishing contracts — stabilize Phase 3 first.

**Blocking dependencies summary:**
- D12 → Phase 4 scope (P3/P8/P9/P10 in/out).
- D13 → Phase 1 tasks NWB-P0-010/014 (which role codes to implement).
- D11 → Phase 8 security review scope.
- D6 → Phase 2 storage service.
- D8/D9 → Phase 4a (NLP + search).
- NWB-P0-005 (migrations) → every schema adoption (ground rule 7) — i.e., all of Phases 3–6.
- NWB-P1-001 (queue) → every worker (approval expiry, retention, purge, ingestion, SLA, aggregation, dunning).

---

