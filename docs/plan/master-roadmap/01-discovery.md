# Master Roadmap — Discovery: Repository, Documentation & Current State (§2–§4)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 2. Discovery: repository structure (as-built)

```
nawebeus/
├── src/                          ← the entire runtime (API only; ~9.5k LOC incl. tests)
│   ├── index.ts                  Bun.serve entry (single process, ADR-007)
│   ├── server/
│   │   ├── index.ts              Hono app factories: createApp() (test, no-DB) + createAppWithDb() (prod)
│   │   ├── middleware/           auth.ts (cookie OR Bearer API-key + CASL load), rbac.ts (requireAbility),
│   │   │                         org-match.ts (requireOrgMatch), error-handler.ts (AppError → status map)
│   │   └── auth/types, organization/types   request/response types
│   ├── app/                      Hono route handlers (thin: validate + delegate)
│   │   ├── auth/                 signin, signup, signout, refresh, sessions, mfa, verification, password-reset
│   │   ├── users/                me.* (profile, password, deletion, email-change), admin.* (list/get/update/delete)
│   │   ├── orgs/                 org.*, member.*, role.* (assign-role, invite, invite/bulk)
│   │   └── api-keys/             create, list, rotate, revoke
│   ├── services/                 business logic (single source of truth per ground rule 2)
│   │   ├── auth/                 auth.service, signup, session, jwt, tokens, password, password-history,
│   │   │                         password-reset, verification, email-change, mfa, totp, ability, api-key
│   │   ├── orgs/                 org.service, member.service, invitation.service, role-assignment.service
│   │   ├── users/                user.service, admin.service, account-deletion.service
│   │   ├── audit.ts              writeAuditLog → unified_audit_log
│   │   └── email.ts              EmailTransport interface + ConsoleEmailTransport (only implementation)
│   ├── lib/                      config.ts (zod env), db.ts (pg pool + withTestDb), org-context.ts (ALS),
│   │                             errors.ts (AppError hierarchy), response.ts ({data}/{error} envelope),
│   │                             rate-limit.ts (sliding window over rate_limits table), tokens.ts, password.ts, ip.ts
│   ├── tests/                    28 test files + helpers (test-db, test-client, test-factory) + preload.ts
│   └── seed.ts                   idempotent seed: permissions, 4 roles, bootstrap org + admin
├── db/                           Drizzle schema
│   ├── schema.ts                 active re-exports ONLY: shared + core + organization (28 tables)
│   ├── core/ (10)                users, roles, permissions+permissionGroups, rolePermissions (permission-roles.ts),
│   │                             user-roles, sessions, tokens, api-keys, oauth-accounts, rate-limits
│   ├── organization/ (4)         organizations, organizationMembers, roleHistory, permissionHistory
│   ├── shared/ (14)              enums, audit (unified_audit_log), analytics (5), alerts (2), approval (2),
│   │                             contacts (2), media, templates, schema-utils
│   ├── [10 aspirational dirs]    billing(6) campaigns(3) commerce(5) compliance(6) engagement(6)
│   │                             influencer(5) monitoring(6) pr(10) publishing(2) social-accounts(4) = 54 tables
│   │                             → EXCLUDED from tsconfig.json and from db/schema.ts; nothing reads them
│   └── manual-migrations/        campaign-domain-disabiguation.sql (ADR-017 renames; operates only on aspirational tables — dormant)
├── docs/                         see §3
├── .scratch/                     foundation/ (done), p0-auth/ (in-progress), p0-foundation-gap/ (ticket set + decisions)
├── .github/workflows/ci.yml      quality job (typecheck/lint/build) + test job (PG14 service, db:push, seed, bun test)
├── drizzle.config.ts             reads DB_* env (NOT DATABASE_URL); out: drizzle/migrations (directory does not exist)
├── package.json                  deps: hono, drizzle-orm, zod, pg, @casl/ability; dev: biome, drizzle-kit, typescript
└── biome.json, tsconfig.json, bunfig.toml (test preload)
```

**No other runtime surfaces exist.** There is no web app, no mobile app, no worker process, no cache, no storage client, no payment code, no queue, no WebSocket layer, no Dockerfile, no deploy scripts, no `drizzle/migrations/`.

### Key architecture facts (verified)

- **AuthN:** cookie-first (HTTP-only `nawebeus_access` 15-min JWT, `nawebeus_refresh` 7/30-day JWT, `SameSite=Strict`, `Secure` in prod, CHIPS `Partitioned` refresh cookie in prod — `src/app/auth/signin.route.ts:59-77`) with API-key Bearer as drop-in (`src/server/middleware/auth.ts` Bearer branch, added 2026-09-13 per NWB-P0-001).
- **Sessions:** server-side rows with rotating refresh token + token binding (SHA-256 of refresh token in `sessions.session_token_hash`); reuse after rotation is rejected (`src/services/auth/auth.service.ts:refreshSession`).
- **AuthZ:** CASL ability loaded per request from `organization_members → roles → role_permissions → permissions` (`src/services/auth/ability.ts:loadAbility`); routes guard with `requireAbility(action, subject)` (`src/server/middleware/rbac.ts`). **See defect F-06: the org-scoping condition on every rule is inert.**
- **Tenancy:** AsyncLocalStorage org context (`src/lib/org-context.ts`), `:orgId` vs JWT check (`src/server/middleware/org-match.ts`), membership re-asserted on every request (`authMiddleware → assertActiveMembership`). All current routes derive orgId from the JWT or enforce org-match — **no cross-tenant route exists today** (verified by route audit, §5/F-06).
- **Rate limiting:** sliding window over the `rate_limits` table, called **only** from `signIn` for the IP block (20/30 min) — `src/services/auth/auth.service.ts:51`.
- **Email:** `EmailTransport` interface with a single `ConsoleEmailTransport` implementation — no provider is wired.
- **One-org-per-user:** `users.organization_id` is a scalar FK (`db/core/users.ts:78`); the JWT carries exactly one `orgId`. The membership table supports many rows per user, but nothing consumes more than one. See decision D14.

---

## 3. Discovery: documentation structure

| Tree | Contents | Authority |
|---|---|---|
| `docs/product/PRD.md` (1,421 ln) | 10-module MVP, FR tables per module, NFRs, release criteria §17 | Canonical product requirements |
| `docs/product/Roadmap.md` (954 ln) | Business phases 0–10, module list §4.2 (unnumbered — agrees with PRD), performance targets §18.3 (API <500ms p95 Y1, page <2s) | Business phasing; §4.3 tech table is partly stale (Redis, "Payments: Stripe") |
| `docs/product/Personas.md`, `User Journeys.md`, `UX & Design.md` | Personas incl. agency multi-client (implies one user across multiple orgs), journeys, UX requirements | Input to P14 web phase |
| `docs/modules/*.md` (18 files) | Per-module specs with FR/US/AC tables, business rules (BR-xxx), Zod schemas, API references | Authoritative FR detail **per module**; numbering superseded (D1); table names in some docs stale (§6) |
| `docs/technical/ADRs.md` | ADR-001…017 + ADR-028 accepted; 018–027 reserved | Accepted architectural decisions (Bun, Hono/TanStack, PG14+, Drizzle, CASL, single service, VPS+WireGuard, RLS target, JWT cookies, Paystack, blue-green, WS, REST, cache patterns, typed errors, campaign disambiguation, pg-boss) |
| `docs/technical/Architecture.md`, `File Structure.md`, `Tech Stack.md`, `Infrastructure.md`, `Security Architecture.md`, `Database Schema.md`, `API Reference.md`, `Engineering Standards.md`, `QA Strategy.md` | Target-state descriptions | **Aspirational** (AGENTS.md). Several describe components that do not exist (TanStack app, Expo mobile, Redis, RLS, Nodemailer). `Infrastructure.md` is the most concrete production target: single VPS, Coolify (DEC-029), Nginx, systemd, blue-green, pg backups, Prometheus/Alertmanager, structured logs |
| `docs/business/Decision Log.md` | DEC-001…037 approved + DEC-D001…004 deferred | Approved decisions; **governs scope conflicts** (DEC-005 five modules; DEC-025 dual processor; DEC-027 NewsAPI+Mediastack; DEC-028 Resend; DEC-029 Coolify; DEC-D003/004 deferrals) |
| `docs/business/Business.md`, `Project Charter.md`, `Market Research.md` | Business context | Context only |
| `docs/customer/User Guide.md` | End-user guide for a product UI that does not exist yet | Future-state; do not use as current-state evidence |
| `docs/audit/*.md` | Two **reusable templates** for domain production audits (641 + 1,150 ln) | Templates; no completed audit exists anywhere in the repo |
| `docs/adr/ADR-001-foundation-phase-stale.md`, `ADR-002-doc-missing.md` | Notes about the stale foundation-phase doc and a missing doc | Housekeeping notes |
| `.scratch/foundation/` | Foundation spec + 10 tickets — **all done** (07 flipped done 2026-09-13) | Historical |
| `.scratch/p0-auth/` | Module 1 parity spec — `in-progress` (status line stale: FR-AUTH-010 has since shipped; DSAR + MFA-login gap remain) | Live |
| `.scratch/p0-foundation-gap/` | Tickets 01,03,04,07,08,09 done or open as marked; `decisions.md` live register; D12 memo | Live |

**No completed security audit, no completed domain audit, and no load-test results exist.** The only "audit findings" in the repo are the two self-discovered defects recorded during P0 work (NWB-P0-008 lockout lost-update — fixed; NWB-P0-009 `db:push` non-idempotent — open, subsumed into NWB-P0-005), plus the rate-limit table discovery noted in `decisions.md` (D3 row, 2026-09-13).

---

## 4. Current-state assessment (per subsystem)

Legend: ✅ complete & verified · 🟨 complete but with defects/gaps (defect IDs in §5) · 🔴 missing · ⬜ intentionally deferred/accepted

| Subsystem | State | Evidence & notes |
|---|---|---|
| AuthN: signup | 🟨 | Full flow with Nigerian org defaults (`src/services/auth/signup.ts`), but: owner membership created **without role** (F-01); verification email link broken (F-09); no org deletion counterpart |
| AuthN: signin | 🟨 | bcrypt verify, atomic lockout increment (NWB-P0-008 fix, concurrency-tested), IP rate-limit, MFA one-shot code path. But: MFA challenge flow is a dead end (F-03); user `status` selected but never enforced (F-05); IP header parsing inconsistent with middleware (F-10) |
| AuthN: refresh/signout | ✅ | Rotation + token binding + reuse rejection (`auth.service.ts:refreshSession`); cookies set correctly |
| AuthN: MFA | 🟨 | Setup/verify/disable + TOTP (RFC 6238) + backup codes. Defects: displayed backup codes are not the stored ones (F-04); codes stored plaintext vs spec AC4 (F-04b); no 2-step login endpoint (F-03); no Owner/Admin enforcement (AC7), no trust-device (AC6), no MFA-failure rate limit (AC8) |
| AuthN: verification / reset / email-change | ✅ | Token-table flows work (single-use, TTL, resend limits). Link bases fixed in NWB-P0-021: one server-decided `APP_BASE_URL`, no request header reaches an emailed link (F-09, F-09b closed) |
| Sessions/devices | 🟨 | List/detail/revoke implemented; device/browser/location columns exist in schema but **never populated** (no UA parsing) — `createSession` inserts only ip + user-agent |
| API keys | ✅ | Full lifecycle create/list/rotate/revoke, digest-only storage, permission narrowing, Bearer middleware, 33 tests (`.scratch/p0-foundation-gap/issues/01-api-key-management.md`) |
| RBAC | 🟨 | Per-request CASL load + `requireAbility` on every mutating route; but: subject mismatch kills org update (F-02); org-scoping condition inert (F-06); self-protection guards reference role codes that don't exist in seed (F-07) |
| Multi-tenancy | 🟨 | JWT-derived org + org-match + membership assert — tenant-safe today on all 28 routes (audited). One-org-per-user limits agency model (D14). No RLS (ADR-009; D11 open) |
| Orgs / members / roles | 🟨 | Org get/update, member list/update/remove, invite single+bulk CSV, assign-role. Gaps: **no invitation-accept endpoint** (F-08); no org deletion (PRD 8.2.1 P0); invitee never gets a role linked to a user account |
| Users / admin | ✅ (functionally) | `/me` full lifecycle incl. account deletion (soft, 30-day grace, reactivate) + `purgeExpiredAccounts` (exists, **never scheduled** — needs Phase 2 scheduler); admin list/get/update/delete. Route-shadowing smell `GET /users/:userId` vs `/users/me` (F-11, latent only) |
| DSAR export | 🔴 | Nowhere in `src/` (grep verified). NDPR obligation (FR-AUTH-007 AC8; PRD 8.1.4 P0). NWB-P0-002 open |
| Audit logging | 🟨 | `writeAuditLog` → `unified_audit_log` (active schema) used across auth/org/user mutations; no query API, no retention worker, no viewer UI; module taxonomy is fixed to 5 modules while 14 more domains are planned (extend when P12 lands) |
| Notifications | 🔴 | No engine, no channels, no preferences. Schema (alerts 2 tables) is active-ready |
| Queue / scheduler / workers | 🔴 | Nothing in `src/lib/`. ADR-028 adopted pg-boss 2026-09-13; dependency not yet added (package.json verified) |
| Email transport | 🔴 (provider) | Interface + console only. DEC-028 = Resend; adapter not built |
| Storage / media | 🔴 | No abstraction, no uploads. `media_assets` table active-ready. D6 open (R2+Bunny per docs) |
| Payments / billing | 🔴 | No code, no deps. DEC-025 = Paystack (NGN) + Stripe (USD); `db/billing/` 6 tables aspirational |
| Social platform integration | 🔴 | No OAuth, no adapters. `db/social-accounts/` 4 tables aspirational; DEC-009 = 5 platforms (YouTube, X, Instagram, Facebook, Reddit) |
| Listen / Monitor / Engage / Grow / Analyze (PRD 4–8) | 🔴 | Aspirational schemas only (`db/monitoring/`, `db/engagement/`, `db/campaigns/`, `db/shared/analytics*` active). No services |
| Publishing / PR / Commerce / Influencer (non-PRD) | 🔴 / D12 | Aspirational schemas; scope contested (D12). ADR-017 rename migration dormant in `db/manual-migrations/` |
| Web application | 🔴 | None. ADR-002 = TanStack Start (D2 open-but-unopposed) |
| Mobile application | 🔴 | Out of launch scope (DEC-008: web-only at launch; native in Phase 6) |
| Caching | 🔴 | None. ADR-004 says SQLite (stale vs code); D3 open — recommend amend ADR to "no app cache at MVP; Postgres rate limiting" |
| Observability | 🔴 | `console.log` startup line; `NWB_DEBUG_ERRORS` for 500 logging; no structured logs, request IDs, metrics, error tracking |
| CI/CD | 🟨 | CI exists (typecheck+lint+build; test vs PG14) but: **branch protection not configured** (AGENTS.md — CI reports without blocking); no CD, no deploy, no secret scanning, no coverage gate (QA Strategy targets: 85% services / 90% lib — unenforced; `bunfig.toml` gating verified impossible on Bun 1.4, enforce via script per `.scratch/p0-foundation-gap/issues/03-ci-pipeline.md`) |
| Migrations | 🔴 | `drizzle/migrations/` does not exist; `db:push` non-idempotent (NWB-P0-009, 42P16 root cause: 81 `primaryKey()` without `.notNull()`); CI only works on a fresh container DB |
| Deployment / infra | 🔴 | No Dockerfile, no systemd unit, no nginx conf in repo. Target documented in `docs/technical/Infrastructure.md` (VPS + Coolify + WireGuard, ADR-008/DEC-029) |
| Backups / DR | 🔴 | Documented strategy (Infra §5) not implemented; no scripts |
| Secrets management | 🔴 | Env vars via `.env`; no rotation schedule implemented (Infra §8.3 documented) |
| Testing | 🟨 | 28 test files, ~195 describe/test blocks; transaction-wrapped DB tests (`withTestDb`), no-DB unit seam, factories. Last verified: **96 pass / 33 skip without DB; 162 pass / 0 fail with live DB (2026-09-13, NWB-P0-008 note)** — must be re-run as first Phase 1 action (NWB-P0-020). No E2E (no UI to test), no coverage report, no security suite beyond ad-hoc tenant checks inside feature tests |
| Config | ✅ | Zod-validated env singleton (`src/lib/config.ts`); `loadConfig()` before `getConfig()` convention documented |

**P0 (execution plan) status, re-verified today:**

| Ticket | Plan status (2026-09-13) | Verified today |
|---|---|---|
| NWB-P0-001 API keys | done | ✅ `src/services/auth/api-key.ts`, routes, middleware, 33 tests |
| NWB-P0-002 DSAR export | open | 🔴 absent |
| NWB-P0-003 CI | done (first real GH run pending) | ✅ `.github/workflows/ci.yml`; branch protection still not configured |
| NWB-P0-004 Linter (Biome) | done | ✅ `biome.json`, scripts, CI step |
| NWB-P0-005 Migration baseline | open | 🔴 no `drizzle/migrations/` |
| NWB-P0-006 Foundation issue 07 → done | open | ✅ `.scratch/foundation/issues/07-*.md` marked done 2026-09-13 |
| NWB-P0-007 Adopt decisions | done | ✅ `CONTEXT.md` module map; ADR-028; D12 raised |
| NWB-P0-008 Lockout lost-update (extra) | done | ✅ atomic increment + concurrency test |
| NWB-P0-009 db:push not idempotent (extra) | open | 🔴 — fix via NWB-P0-005 |

**⇒ The P0 exit gate ("every Module 1 FR implemented and tested; CI green with a live DB; migrations reproducible from zero") is NOT met.** Module 1 is 9/10 FRs *built*, but DSAR is missing, the MFA login flow is incomplete, and the defect register (§5) contains issues the baseline predated.

---

