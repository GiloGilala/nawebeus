# Master Roadmap — Phase 7: Web Application (+ Frontend & Mobile Plan §23)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 17. Phase 7 — Web application (plan P14)

**Entry:** Phase 1 exit is sufficient for P14.1–P14.2 (auth + org surfaces exist and are now actually working — see Phase 1 demo); each later sub-phase gates on its backend phase per plan §5 P14 screen order.
**Decision:** D2 — confirm **TanStack Start** (ADR-002, unopposed) or supersede it. **Recommendation: confirm ADR-002** — it is an accepted ADR, the only frontend decision on record, and nothing in this audit contradicts it.
**Framework setup (reuse-first):** new top-level `web/` (or per `docs/technical/File Structure.md` layout — verify against ADR-002 before choosing; record the choice in the phase spec). Shared: TanStack Query + the existing `{data}/{error}` envelope; one API client module; cookie handling for refresh (`/api/auth/refresh` scoping already exists — cookie path `/api/auth`); no state library beyond TanStack Query (avoid new abstraction per rule 6).
**Screen clusters (plan P14.1–15, order retained):** 1 auth · 2 org setup/invitations (consumes Phase 1's working invite-accept) · 3 social connect · 4 publishing (Option B/C only — under Option A this becomes *Engage inbox* as the first real product value, per D12 memo §3 Option A "launch demo") · 5 monitoring · 6 listening · 7 engagement · 8 PR (B/C) · 9 influencer (B/C) · 10 commerce (B/C) · 11 campaigns (+ public entry page — hardened, Phase 4) · 12 analytics · 13 admin/compliance (audit viewer, DSAR queue, flags, config, impersonation UI) · 14 billing · 15 notifications.
**Per-screen requirement (plan P14, unchanged):** loading · skeleton · empty · error · permission-denied · not-found · mutation-pending · optimistic+rollback where used · success confirmation · cache invalidation · responsive · keyboard-accessible. Plus: **permission-gated UI must mirror server enforcement** (same permission strings — import from a single generated list; never re-spell subjects in UI, the F-02 lesson).
**E2E (QA §5.2):** Playwright suite per user journey; begins with P14.1 (signup→verify→invite→accept→workflows) and grows per cluster; daily CI job per QA §2.1.
**API reference rewrite (D-11):** generated from the route definitions at this phase's start (the surface is finally stable); module docs §7 corrected to match.
**Accessibility:** WCAG 2.1 AA, axe-core in CI (QA §8) — gate at 0 violations.
**Exit gate (plan):** every in-scope workflow usable in the browser with complete UI states; no dead ends; E2E green for all P0 workflows.

---

## 23. Frontend & mobile plan

**Frontend (Phase 7):** as §17. Existing shared UI primitives: **none exist** (no frontend) — so "reuse existing components" applies from the first component onward: the Phase 7 spec must define the primitive set (Button, Input, Form (zod-driven), Table (paginated), Modal, Toast, EmptyState, ErrorState, Skeleton, PermissionGate) **once** and every screen cluster consumes it. No second form library, no second query cache.
**Offline behavior:** not applicable to the web app at MVP (no offline requirement in PRD; mobile-only concern — Phase 10, with the plan P16 critical requirement on conflict semantics).
**Mobile (Phase 10):** referenced, not duplicated — plan P16 + Roadmap §6.
**Permission states:** every screen renders permission-denied from the same permission strings the server enforces (single generated source — F-02 lesson).
**Accessibility:** WCAG 2.1 AA, axe-core CI gate (QA §8), keyboard-accessible per plan P14 per-screen list.

---

