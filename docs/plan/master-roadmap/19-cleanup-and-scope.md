# Master Roadmap — Cleanup & Consolidation / Scope Control (§31–§32)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 31. Cleanup & consolidation (evidence + safe removal)

Nothing is deleted in Phase 1 unless its removal is itself the task. Every entry: evidence → strategy.

| Item | Evidence | Safe removal/consolidation strategy | When |
|---|---|---|---|
| `createApp()` factory (F-17) | Only `createAppWithDb` used by `src/index.ts`; tests use `createTestApp` (= `createAppWithDb` + no-op db) — grep-verified no other reference | Delete after re-grep at removal time; CI green | Phase 1 (with NWB-P0-018 ticket) |
| `docs/audit/*` "Gilo Business" placeholder content (D-09) | Template comments name another project | **Do not delete the templates** (they are the Phase 8 audit method); redact/replace the foreign placeholder block with a Nawebeus example; owner sign-off recorded in the PR | Phase 8 prep |
| `docs/technical/ADRs.md` "Money Handling Convention / Gilo Business ecosystem" tail section (D-09) | Section describes a different project's mobile `formatNGN` | Quarantine: move to `docs/archive/foreign-content.md` with a note, not silent delete; record in Decision Log as housekeeping | Phase 1 bookkeeping (NWB-P0-019) |
| `db/manual-migrations/campaign-domain-disambiguation.sql` | Operates on aspirational tables only (not in active schema); ADR-017 | Fold renames into the pr/influencer adoption migration (M8), then delete the file with the ticket reference | Option B/C adoption (or Phase 10 if deferred) |
| `docs/modules/*.md` numbering (D-02) | 5 collisions; PRD canonical (CONTEXT.md map) | Header corrections only (numbers + "superseded numbering" note); FR content untouched | Phase 7 (with API ref rewrite) or opportunistic |
| Stale doc sections (D-04, D-10, D-15) | Nodemailer in Tech Stack; wrong table names in Database Schema.md; Redis/Stripe-only in Roadmap §4.3 | Targeted corrections per §6, each in the phase that touches the area (Tech Stack: Phase 2 email; Database Schema: module adoptions; Roadmap §4.3: Phase 1 bookkeeping) | spread |
| `p0-auth/spec.md` stale status line (says FR-AUTH-010 unbuilt) | api-key shipped 2026-09-13 | Status update (NWB-P0-019) | Phase 1 |
| 246+ `any` sites (AGENTS.md; CI comment says 248) | Lint warning by design | Track down via lint:fix-safe passes per phase; **no bulk rewrite** (AGENTS.md: warn, don't fail) | ongoing |
| Duplicate `tokens.ts` names (`src/lib/tokens.ts` vs `src/services/auth/tokens.ts`) | AGENTS.md documents the ambiguity | **Keep both** (different layers, both used); the doc note is the control — no rename (churn without benefit) | — |
| `db/relations.ts` (excluded from tsconfig) | Cross-module relations for aspirational tables | Keep; wire when modules adopt (ground rule 7) | per adoption |

---

## 32. Scope control (mandatory separation)

### Required for completion (MVP per Option A — must implement)
Phase 1 (all), Phase 2 (all), Phase 3 (all), Phase 4 Option-A set (Monitor, Listen, Notifications delivery, Engage, Grow), Phase 5 (Analyze), Phase 6 (Billing), Phase 7 (web, Option-A clusters), Phase 8 (hardening + infra), Phase 9 (launch).

### Required for production readiness (must address before release)
Branch protection (P0-022); migration baseline (P0-005); DSAR (P0-002); retention/legal-hold/erasure (P1-010 + purges); Resend adapter (P1-004); observability + alerts (P1-012 + P15-004); backups + restore drill (Infra §5); runbooks (P15-005); security suite + NDPR sign-off (P15-001/002); k6 validation (P15-003); coverage gate codebase-wide (Phase 2); D11 execution; secrets rotation schedule.

### Recommended improvement (useful, not blocking)
Device/UA parsing for sessions (F-15); magic-link login (PRD P1); HaveIBeenPwned breach check (PRD P1); MFA AC6 trust-device + AC7 enforcement (via Phase 2 flags); pagination earlier than Phase 7; ESLint-import-boundary rule (QA §11.2) once modules multiply; documentation site for the API reference.

### Future enhancement (explicitly outside the current build)
Mobile (P16, DEC-008); D12-deferred domains under Option A (Publishing/PR/Commerce/Influencer); P17 roadmap (AI/ML, public API, SSO/SCIM, extra platforms, i18n, white-label, marketplace); RLS (if deferred by D11); Elasticsearch; second-region/HA infra (Infra §7 scaling triggers).

**Out-of-scope guards (operating rules 22/6):** no microservices; no Redis (D3); no new cache/queue/ORM/state-management/DB; no framework swap (D2 confirms ADR-002); no rewrite of working auth/session/RBAC internals beyond the listed defects; no speculative endpoints beyond phase lists; the aspirational schema is adopted, not re-authored.

---

