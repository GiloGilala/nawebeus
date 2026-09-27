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

**Status (2026-09-27):** started, out of plan order. Cluster 3 (social connect) is **done - NWB-P14.3**, ticket `.scratch/p14-web/issues/01-social-connect.md`. Cluster 2 (org setup/invitations) is **partly done - NWB-P14.2**: the `/invite` landing, the accept flow and the `/settings/team` screen (members, pending invites with expiry, resend, revoke, role change, single + bulk invite) plus the two service reads they needed (`listAssignableRoles`, `listPendingInvitations`), ticket `.scratch/p14-web/issues/02-invite-and-team.md`; the org-profile screen and the onboarding checklist from this cluster's plan line are still open and need no new backend. Phase spec `.scratch/p14-web/spec.md`. Cluster 1 is partly present in the tree already (`src/app/routes/auth/*`, `dashboard`); clusters 4-15 remain blocked on their backend phases (P3-P13).

Three deviations from this section's plan, recorded rather than left implicit:

1. **Location.** The web layer lives in `src/app/` (ADR-002's layout, as `docs/technical/File Structure.md` has it) - **not** a new top-level `web/`. One Bun process serves both surfaces (ADR-007), so a separate package would have meant a second build and a second deployable for no isolation gain.
2. **No client bundle yet, so no browser-rendered states and no Playwright.** `src/app/lib/createServerFn.ts` is a local isomorphic shim and `routeTree.gen.ts` is a CI stub; `@tanstack/react-start`/Query/Form are deliberately **not** installed (AGENTS.md) so `bun.lock` stays frozen for CI's `--frozen-lockfile`. Consequently the per-screen state matrix (loading, skeleton, empty, error, permission-denied, ...), TanStack Query cache invalidation and the E2E suite **cannot** be satisfied by P14.3 and are not claimed: the screen renders empty/error/success and mutation-pending states from React state, and what is actually proven is the Server Function layer (24 in-process tests against a real DB, all five seats x all eleven functions). Wiring the real toolchain is its own ticket and changes every screen at once.
3. **A structural gate this cluster did not have until NWB-P14.2.** Nothing rendered the `.tsx` routes and they carry `@ts-nocheck`, so a service could build an absolute URL - or a screen `<Link to="…">` - to a path no route answers, with every existing check green. That is exactly how `${APP_BASE_URL}/invite?token=…` (built since P1) and the OAuth callback's `/settings/integrations` both shipped pointing at 404s. `src/tests/route-links.test.ts` now scans `src/services/**` for link construction and `src/app/routes/**` for navigation targets and asserts a route file answers each; it also found `/reset-password` and `/change-email/confirm` still dangling (cluster 1's), which are allowlisted with an assertion that keeps the allowlist from becoming permanent.
4. **Permission-gated UI does not yet mirror server enforcement from a generated list.** F-02's lesson stands, but there is no permissions payload in the web session to gate on, so the screen renders every action and lets a 403 arrive as a message via `messageForAppError`. Server enforcement is the authority and is tested; the `PermissionGate` primitive and the single generated permission list arrive with the toolchain ticket (section 23).

---

## 23. Frontend & mobile plan

**Frontend (Phase 7):** as §17. Existing shared UI primitives: **none exist** (no frontend) — so "reuse existing components" applies from the first component onward: the Phase 7 spec must define the primitive set (Button, Input, Form (zod-driven), Table (paginated), Modal, Toast, EmptyState, ErrorState, Skeleton, PermissionGate) **once** and every screen cluster consumes it. No second form library, no second query cache.
**Offline behavior:** not applicable to the web app at MVP (no offline requirement in PRD; mobile-only concern — Phase 10, with the plan P16 critical requirement on conflict semantics).
**Mobile (Phase 10):** referenced, not duplicated — plan P16 + Roadmap §6.
**Permission states:** every screen renders permission-denied from the same permission strings the server enforces (single generated source — F-02 lesson).
**Accessibility:** WCAG 2.1 AA, axe-core CI gate (QA §8), keyboard-accessible per plan P14 per-screen list.

---

