# Decision register — D1 … D16

Tracks the decisions raised in §4 of `docs/plan/IMPLEMENTATION EXECUTION PLAN.md`.

Verified against the repo on **2026-09-13** at HEAD `049a837`.

| ID | Decision | Status | Resolution / evidence |
| --- | --- | --- | --- |
| D1 | Canonical module numbering | ✅ **Resolved** | PRD `docs/product/PRD.md` §8 Modules 1–10. Roadmap §4.2 lists the same ten by name — the two agree. Map recorded in `CONTEXT.md`. **Caveat: see D12.** |
| D2 | Web framework | 🔴 Open | No frontend exists. ADR-002 (TanStack Start) unopposed but unvalidated. Blocks P14. |
| D3 | Cache + rate-limit store | 🔴 Open | ADR-004/015 say SQLite; `src/lib/rate-limit.ts` uses a PostgreSQL `rate_limits` table. Code and ADR disagree. **2026-09-13: the table was missing entirely until now** — `checkRateLimit()` had always queried a non-existent table and swallowed the error, so this was aspirational code, not a working Postgres implementation. It now exists (`db/core/rate-limits.ts`), which makes the code's commitment to Postgres real and strengthens the case for revising the ADR rather than the code. Blocks P1 (partially), P14, P11-003. |
| D4 | Email provider | ✅ **Resolved** | **DEC-028 (Approved, 2026-01-25): Resend.** Roadmap §4.3 agrees. The only outlier is `Tech Stack.md` (Nodemailer) — a doc defect. Blocks P1-004. |
| D5 | Queue / scheduler runtime | ✅ **Resolved** | **ADR-028: `pg-boss`**, PostgreSQL-backed. Recorded in `docs/technical/ADRs.md` §22. Unblocks P1. |
| D6 | Object storage | 🔴 Open | Docs say Cloudflare R2 + Bunny CDN; no code. Blocks P1-005. |
| D7 | Payment processor | ✅ **Resolved** | **DEC-025 (Approved, 2026-01-10) is dual-processor: Paystack for NGN, Stripe for USD.** Not a contradiction — a documented decision. Plan's "Paystack wins, supersede the Roadmap line" is wrong. |
| D8 | NLP / sentiment provider | 🔴 Open | No decision recorded. Blocks P4-003, P5-003. |
| D9 | Search implementation | 🔴 Open | Postgres `tsvector` first is the sensible default; no decision recorded. Blocks P4, P5. |
| D10 | Decision Engine scope | 🔴 Open | `docs/modules/Nawebeus Decision Engine.md` supersedes the `new features/` docs and is unreferenced by PRD/Roadmap. Product call. |
| D11 | Row-level security | 🟡 **Recorded, still open** | ADR-009 specifies RLS; **not implemented — verified live 2026-09-20: 0 policies in `pg_policies`, 0 tables with `relrowsecurity`, no RLS statement anywhere in `drizzle/`, `db/` or `src/`**. Now carried in the Decision Log as **DEC-O009** with a written engineering recommendation (implement as defense-in-depth in Phase 8, keeping the application-layer chain primary) and the (a)/(b)/(c) trade-off. **Deliberately not resolved by NWB-P0-019** — it is an architecture + procurement call, not an implementation detail. Option (c), leaving ADR-009 unimplemented *and* unaddressed, is ruled out; Security Architecture states the gap plainly (NWB-P0-018). Blocks P15-001 sizing, not Phase 1. |
| D12 | **Module-set scope** *(new — found during D1)* | 🔴 Open | **Must be resolved before P3, P8, P9, P10.** Options memo: [D12-scope-decision-memo.md](D12-scope-decision-memo.md). See below. |
| D13 | **Role hierarchy** *(new — master roadmap audit 2026-09-20)* | ✅ **Resolved** | **DEC-039 (Approved, 2026-09-20), option (a):** platform `super_admin` + per-org `owner/admin/manager/creator/analyst/viewer`; drop `org_admin`/`member` pre-prod; guards reference real codes. **Implemented: NWB-P0-010 (owner at signup) + NWB-P0-014 (full role set, guards, seed retirement) — both done 2026-09-20.** See below. |
| D14 | **Multi-org membership / org switching** *(new — master roadmap 2026-09-20)* | 🔴 Open | Phase 1 proceeds with single-org semantics (option (a)) as the conservative default for invitation-accept. Final call with D12's product session, **before Phase 7**. **Interim branch implemented (2026-09-20, NWB-P0-016):** `acceptInvitation` refuses with a clear 409 when the invitee's account already holds an active membership in another organization (no silent re-home of the primary org); the multi-org branch is deliberately unbuilt. |
| D15 | **API versioning** *(new — master roadmap 2026-09-20)* | ✅ **Resolved** | **DEC-040 (Approved, 2026-09-20): the MVP API ships unversioned** (`/api/...`); the docs claiming `/api/v1/...` are wrong and get rewritten at Phase 7, when the reference is generated from the routes rather than hand-maintained. Revisit a `/v1` prefix when a public API is offered (P17 / DEC-D001). Closes discrepancy **D-11**. No code change — the prefix is a single mount-point edit if it is ever wanted. Recorded by NWB-P0-019. |
| D16 | **Org-owner account purge (F-25)** *(new — NWB-P0-025)* | ✅ **Resolved** | **Option 2 — refuse and report (2026-09-20):** `deleteAccount` rejects with 409 `OWNERSHIP_TRANSFER_REQUIRED`, naming the owned organizations, before anything is written — so `purgeExpiredAccounts` is never reachable for an owner and the 23503 cannot occur. `organizations.created_by` made nullable + `set null` (matching the 25+ other attribution FKs) so a *former* owner erases cleanly once ownership has moved; the same class on `api_keys.*_by` / `tokens.revoked_by` is closed by **NWB-P0-028 (F-28, done 2026-09-20)**. Consequence until NWB-P0-023 (organization deletion / ownership transfer) ships: a user whose signup created their personal organization cannot complete account deletion — accepted, because option 1 silently destroys shared workspaces and option 3 is the weakest erasure claim. Evidence: `issues/25-org-owner-purge-fk.md`, 327/327 `bun test` with a live database. **Re-measured in NWB-P0-023 (2026-09-20) and deliberately left as-is:** that ticket was asked to relax the gate for sole-member organizations, but a *soft*-deleted organization still holds the restrictive `owner_id` FK, so relaxing it reintroduces the 23503 verbatim (verified by experiment; pinned as a negative-control test). The unblock is the **hard purge**, not the soft delete — `delete org → grace expires → purgeExpiredOrganizations → deleteAccount → purgeExpiredAccounts` now works end to end, so the consequence is reachable-to-resolve by the user without weakening the gate. |

---

## D12 — Module-set scope (new finding)

> **Full options analysis:** [D12-scope-decision-memo.md](D12-scope-decision-memo.md) — three options, phase-sequencing impact, critical path per option, and what gets superseded. **Recommendation: Option A (strict DEC-005).**

D1 asked which *numbering* is canonical. That is now settled. But resolving it exposed a
larger question D1 assumed away: **which modules are actually in MVP scope?**

There are three mutually inconsistent answers in the repo, and the execution plan implies a
fourth:

| Source | MVP module set | Count |
| --- | --- | --- |
| `DEC-005` (Approved, 2025-10-01) | Grow, Listen, Monitor, Engage, Analyze | **5** |
| `PRD` §8 + `Roadmap` §4.2 | the ten listed in `CONTEXT.md` | **10** |
| Execution plan §3 ("MVP feature-complete") | P2–P13 | **12 phases, ~14 domains** |

**These first two do not actually conflict** — DEC-005 counts the five *value* modules; the PRD counts those five plus five *enablers* (Auth, Org, Social Integration, Notifications, System Admin). The mapping is exact:

```
PRD Modules 1–10  =  DEC-005's five (PRD 4–8)  +  five enablers (PRD 1,2,3,9,10)
```

So Option A *is* the PRD. The only genuine conflict is that the execution plan adds four domains present in neither list — Publishing, PR, Commerce, Influencer — which is the whole of D12.

`DEC-005` is explicit that "All 10+ modules at MVP" was **rejected** as an alternative, on
the grounds that it "would delay launch by 6+ months".

Two approved deferrals contradict the plan's sequencing directly:

- **DEC-D003** — "Influencer management module" deferred to Phase 4. The plan puts it at **P9**, inside MVP.
- **DEC-D004** — "Social media publishing and scheduling" deferred to Phase 5. The plan puts it at **P3**, inside MVP — and calls P3 "the MVP's central demo".

This matters because P3 is described as the first end-to-end product proof. If DEC-005 and
DEC-D003/D004 stand, the critical path changes shape.

**This is a product call, not an engineering one.** Do not resolve it in code. Options:

---

## D13 — Role hierarchy (new finding, master roadmap audit 2026-09-20)

> **Resolution: DEC-039 (Approved, 2026-09-20) — option (a).** Full analysis in the master
> roadmap decision log (`docs/plan/master-roadmap/18-risks-and-decisions.md`, §30 row D13);
> approved decision record in `docs/business/Decision Log.md` (DEC-039).

The master roadmap audit (2026-09-20) found three mutually inconsistent role models
(module spec §6: six tiers; PRD §8.2.2: five tiers; `src/seed.ts`: four roles) and two
defects caused by the drift:

- **F-01 (Critical):** signup creates the owner membership **without a role**; `loadAbility`
  derives permissions from `role_id`, so every new org owner has zero permissions.
- **F-07 (High):** role self-protection guards reference role codes `owner`/`admin` that do
  not exist in the seed — the guards can never fire.

**Decision (option (a)):** platform `super_admin` + per-org `owner/admin/manager/creator/
analyst/viewer`; drop `org_admin`/`member` pre-prod (no compatibility burden); all guards
reference the real codes. Implemented in NWB-P0-010 (owner role at signup) and NWB-P0-014
(role model + guard alignment), each with full role × permission matrix tests.

---

1. **DEC-005 governs** — MVP is five modules; P3/P8/P9/P10 move behind launch. Critical path becomes `P0 → P1 → P2 → P7 → P11 → P12 → P14 → P15`.
2. **PRD governs** — MVP is ten modules; DEC-005 is superseded and must say so.
3. **The plan governs** — the plan's scope is accepted and DEC-005 / DEC-D003 / DEC-D004 are superseded in the Decision Log.

Whichever is chosen, the losing documents must be explicitly superseded. Leaving three
scopes in force is the drift risk already named in the plan's §10.

---

## Corrections to the execution plan's §4

Three rows of §4 describe conflicts that do not exist, because the plan did not consult
`docs/business/Decision Log.md` — an approved decision register that predates it:

| Plan says | Reality |
| --- | --- |
| D1: "PRD, `docs/modules/*.md`, and `Roadmap.md` all number modules differently" | Roadmap does **not** number modules at all; it lists the same ten as the PRD. The outlier is `docs/modules/` alone. A **fourth** taxonomy (DEC-005's five) was missed. |
| D1: "Ticket titles in this plan already use PRD numbering" | **False.** 4 of 11 phase labels match the PRD (P2, P5, P6, P11); 7 do not (P3, P4, P7, P8, P9, P10, P12). The plan's labels are the `docs/modules/` scheme. |
| D4: "Pick one" between Nodemailer / Resend / console stub | Already decided: **DEC-028 = Resend**. Only `Tech Stack.md` disagrees. |
| D7: "ADR-011 says Paystack; Roadmap §4.3 says Stripe — direct contradiction" | Already decided: **DEC-025 = both**, Paystack for NGN and Stripe for USD. No contradiction. |

## Incidental defects found

Not part of this ticket; recorded so they are not lost.

- `docs/technical/ADRs.md` had **two sections numbered "## 22"**. Fixed while inserting ADR-028.
- `docs/technical/ADRs.md` ends with a **"Money Handling Convention"** section describing "the Gilo Business ecosystem" and `formatNGN` on mobile — content from a different project. It also truncates the Document Version History table mid-sentence. Left in place; it needs an owner's call, not a silent delete.
- `docs/technical/ADRs.md` §2 claimed "Current ADRs: 17" while the planned-ADR table reserves ADR-018 … ADR-027. Count corrected to 18.
