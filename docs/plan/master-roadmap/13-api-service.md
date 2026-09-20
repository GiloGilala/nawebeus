# Master Roadmap — API & Service Plan (§22)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 22. API & service plan

**Current surface (audited, 2026-09-20):**

| Area | Endpoints | Auth | Tenant scoping | Notes |
|---|---|---|---|---|
| Health | `GET /api/health` | — | — | upgraded to readiness probe in P1-012 |
| Auth | `POST /api/auth/signup`, `POST /signin`, `POST /signout`, `POST /refresh`, `GET /resend-verification`, `GET /verify-email?token`, `POST /forgot-password`*, `POST /reset-password`*, `GET /mfa/status`, `POST /mfa/setup`, `POST /mfa/verify-setup`, `POST /mfa/disable`, `GET /sessions`*, `DELETE /sessions/:id`* | public (token-bearing) or auth | n/a | *exact paths per `src/app/auth/*`; Phase 1 adds `POST /mfa/verify-login` |
| Users | `GET/PATCH /users/me`, `POST /users/me/change-password`, `DELETE /users/me`, `POST /users/me/reactivate`, `POST /users/me/email-change(+confirm)`, `GET /users/admin`, `GET/PATCH/DELETE /users/admin/:userId` | auth; admin routes require `users.*` | JWT org | Phase 1 adds data-export routes; F-11 shadowing fixed |
| Orgs | `GET /orgs`, `GET/PATCH /orgs/:orgId`, `GET /orgs/:orgId/members`, `GET/PATCH/DELETE /orgs/:orgId/members/:memberId`, `POST /orgs/:orgId/members/assign-role`, `POST /orgs/:orgId/members/invite(+bulk)` | auth + org-match + `org.*/members.*` | org-match | Phase 1: invite-accept (auth area), org deletion |
| API keys | `POST/GET /api/api-keys`, `POST /api/api-keys/:id/rotate`, `DELETE /api/api-keys/:id` | auth + `apikeys.*` | JWT org | complete (NWB-P0-001) |

**Conventions (existing — all new APIs must follow):** `{data}/{error}` envelope (`src/lib/response.ts`); zod body validation with field-level details; `AppError` hierarchy; `requireAbility` on every mutating endpoint + `requireOrgMatch` on every `:orgId` route (now test-enforced, NWB-P0-018); audit event per mutation; orgId from JWT/context only (ground rule 5); idempotency keys on public/webhook endpoints (P2 webhooks, P11 entry, P13 webhooks).

**Missing endpoints (by phase):** Phase 1 additions (above); Phase 2: none user-facing (flags/config are internal admin surfaces for P14.13); Phase 3: social-account lifecycle + **public OAuth callback + public platform webhooks (P7)**; Phase 4: module CRUD + **public campaign entry**; Phase 5: dashboards/reports/alert-rules; Phase 6: plans/subscribe/invoices + **processor webhooks (public, signature-verified)**; Phase 7: no new API (web consumes existing) + API reference doc; notification preference/inbox routes (P6).

**Cross-cutting gaps:** pagination on all list endpoints (F-14 — introduce `?page&limit` with `meta.pagination` in the envelope's existing `meta` slot; adopt when Phase 7's list screens land, backend-ready by then); rate limiting on public endpoints (Phase 1 limiter is the only implementation — P11 entry, P13 webhooks, P2 callbacks all reuse it per plan §7 "idempotency/public writes"); error contract for 429 (existing `RateLimitError` + `retryAfter` — keep).

**Transaction/concurrency standards (proven patterns to reuse):** atomic increment with `RETURNING` (NWB-P0-008); window-aware upsert (NWB-P0-013); enqueue-in-transaction (ADR-028); single-transaction multi-table writes (journalist/influencer/campaign creation per plan §7).

---

