# NWB-P0-019 — Close out P0 bookkeeping (documentation)

**Status:** done — 2026-09-20 (docs-only; full gate re-run green: 395/0 with a live
database, typecheck + `biome check .` 0 errors + build clean)

- **Epic:** p0-foundation-gap
- **Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-019
- **Size:** S
- **Depends on:** NWB-P0-020 (its re-scored exit criteria identified the real gap)

## Objective

The issue tracker tells the truth. Four sub-tasks, each verified rather than assumed.

## 1. `p0-auth/spec.md` → `done`

The ticket says to keep it `in-progress` "until DSAR (P0-002) and the MFA login flow
(P0-012) land, then flip". Both have landed. I checked the code before flipping rather
than trusting the ticket's own note:

| Blocker | Evidence |
|---|---|
| FR-AUTH-010 API keys (NWB-P0-001) | `src/services/auth/api-key.ts`, `src/tests/auth/api-key.test.ts` |
| MFA login flow (NWB-P0-012) | `POST /api/auth/mfa/verify-login` in `src/server/api/auth/mfa.route.ts:36`, `src/tests/auth/mfa-login.test.ts` |
| DSAR export (NWB-P0-002) | `src/services/users/dsar.service.ts`, `src/tests/users/dsar-export.test.ts` |

Flipped to `done` — 10/10 Module 1 FRs — with a pointer to `p0-foundation-gap` as the
tracker to read for the *current* state of that code, because several defects in the same
surface were found after the FRs were first called complete.

## 2. `foundation` spec → `done`

Already `done` (10/10), flipped by NWB-P0-006. Verified, no change needed.

## 3. Decisions into `docs/business/Decision Log.md`

This is where the ticket's wording ("record D13/D15 decisions + the D11 recommendation")
needed care, because the three are not the same kind of thing.

### D13 — already recorded

**DEC-039 (Approved, 2026-09-20)** already existed. No action.

### D15 (API versioning) → **DEC-040, Approved**

The module spec documents `/api/v1/auth/register|login`; the code has always served
`/api/auth/signup|signin`. Recorded as: **the MVP ships unversioned, the docs are wrong.**

This one is safe for me to mark Approved because it *ratifies what is already built and
shipped* rather than choosing a new direction — the alternative (adopt `/v1` now) would be
a code change, and nothing in the repo has ever served the prefix. Rationale, three
rejected alternatives, and the deferral to P17/DEC-D001 are written up in full. Closes
discrepancy **D-11**; the doc rewrite stays scheduled for Phase 7, when the API reference
can be generated from routes instead of hand-maintained.

### D11 (row-level security) → **DEC-O009, Open**

**I did not resolve this, deliberately.** The ticket asks for "the D11 recommendation",
and a recommendation is what I recorded — as an *open* decision with an owner, not an
approved one. Choosing between implementing RLS and formally superseding ADR-009 is an
architecture and enterprise-procurement call with a real cost attached; an agent marking
it Approved would be manufacturing consent for a decision nobody made.

First I verified the premise, since the register's claim was 2026-09-13 vintage:

```
SELECT count(*) FROM pg_policies WHERE schemaname='public';                    -- 0
SELECT count(*) FROM pg_class ... WHERE relrowsecurity;                        -- 0
grep -rli 'CREATE POLICY|ENABLE ROW|current_setting' drizzle/ db/ src/          -- no hits
```

So ADR-009 (Accepted 2026-06-23) specifies a control that does not exist anywhere.

The recorded recommendation: implement RLS as **defense in depth** in Phase 8, keeping the
application-layer chain (JWT org → `assertActivePrincipal` → `requireOrgMatch` → service
predicates) as the primary control, driven by a session GUC set by the same middleware
that populates org context so the two layers cannot diverge. The write-up is explicit that
the hard part is pooling/GUC leakage and the maintenance paths that legitimately cross
tenants, not the policy DDL.

Options (a) implement and (b) formally supersede ADR-009 are both defensible and are laid
out with arguments on each side. Option **(c) — leave ADR-009 unimplemented and
unaddressed — is ruled out**, because that is precisely the S-12 condition: a security
document describing a control that isn't there. NWB-P0-018 already made Security
Architecture state the gap plainly, which is the interim mitigation.

### D12 — out of scope, still open

NWB-P0-019's text does not ask for D12, and I did not force it. It is a **product** call
(which modules are in MVP scope) with a recommendation waiting in
`D12-scope-decision-memo.md`. It blocks P3/P8/P9/P10, not Phase 1.

## 4. Plan §1 "Last verified" marker

Refreshed by **NWB-P0-020** in the previous commit (HEAD `51c1a2d`, measured against a
freshly created database). Verified present, no further change.

## Acceptance

- [x] No `in-progress` ticket without an accurate one-line outstanding note — `p0-auth`
      was the only one, and it is now legitimately `done`.
- [x] D13 confirmed already logged; D15 logged as **DEC-040 (Approved)**; D11 logged as
      **DEC-O009 (Open, with recommendation)** — not silently approved.
- [x] `decisions.md` D11/D15 rows updated; discrepancy **D-11 closed** in
      `03-discrepancies.md`.
- [x] Plan §1 marker verified current.
- [x] Gate re-run after docs edits: 395 pass / 0 fail, typecheck, lint 0 errors, build.

## Consequence for Phase 1 exit criterion 5

Criterion 5 reads "D12, D13, D11, D15 recorded in the Decision Log with status." All four
are now **recorded with an honest status**: D13 Approved (DEC-039), D15 Approved
(DEC-040), D11 Open with a recommendation (DEC-O009), D12 open with an options memo. If
the criterion is read as *recorded*, it is met. If it is read as *all four decided*, then
**D11 and D12 still need a human decision** — and neither is mine to make. Flagging that
rather than declaring the criterion green.
