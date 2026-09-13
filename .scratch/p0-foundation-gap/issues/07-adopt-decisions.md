# 07 — Adopt decisions D1 + D5; track D2–D12

**Ticket:** NWB-P0-007
**Phase:** P0 — Close the foundation gap
**Blocked by:** —

**Status:** done — module map adopted into `CONTEXT.md`, queue decision recorded as ADR-028, D2–D12 tracked in [decisions.md](../decisions.md). **Raised D12**, which must be resolved before P3/P8/P9/P10.

## What to build

Adopt the two decisions that gate P1, and make the remaining decisions visible and
trackable rather than buried in a plan document.

Per the execution plan's §4: *"Do not invent answers; record the decision and update the
affected ADR."*

## Acceptance criteria

- [x] `CONTEXT.md` gains the canonical module map — numbers, schema home, plan phase
- [x] The superseded `docs/modules/` numbering is recorded as *not to be used*, with its collisions listed
- [x] Modules with no PRD number are named, not given invented numbers
- [x] An ADR records the queue / scheduler runtime decision
- [x] D2–D12 recorded as tracked items with status and evidence

## What was done

| Item | Artefact |
| --- | --- |
| D1 — module map | `CONTEXT.md` → new `## Modules` section |
| D5 — queue runtime | `docs/technical/ADRs.md` → **ADR-028: Queue, Scheduler, and Worker Runtime** (`pg-boss`) |
| D2–D12 register | [decisions.md](../decisions.md) |

## Findings

**D1's premise was partly wrong, and its recommendation was not self-consistent.**

1. The plan claimed PRD, `docs/modules/*.md`, and `Roadmap.md` each number modules
   differently. `Roadmap.md` does not number modules at all — §4.2 lists the same ten the
   PRD does, by name. The only outlier is `docs/modules/`, which crams 14 module docs into a
   10-slot scheme and collides with itself five times.
2. The plan claimed its ticket titles already use PRD numbering. They do not: only P2, P5,
   P6, and P11 match. The other seven carry `docs/modules/` numbers.
3. A **fourth** taxonomy exists that the plan never mentions: `DEC-005` (Approved) defines
   MVP as **five** modules — Grow, Listen, Monitor, Engage, Analyze — and explicitly
   rejected "All 10+ modules at MVP".

**Three decisions the plan called unresolvable are already resolved** by
`docs/business/Decision Log.md`, which §4 did not consult:

| ID | Plan's framing | Actual |
| --- | --- | --- |
| D4 | Nodemailer vs Resend vs console stub | DEC-028: **Resend** |
| D7 | ADR-011 Paystack vs Roadmap Stripe, "direct contradiction" | DEC-025: **both** — Paystack NGN, Stripe USD |
| D1 | three-way numbering conflict | PRD + Roadmap **agree**; `docs/modules/` is the lone outlier |

**New decision raised: D12 — module-set scope.** Resolving the *numbering* exposed a
*scope* conflict: DEC-005 says five MVP modules, PRD/Roadmap say ten, the plan sequences
twelve phases covering ~14 domains. Two approved deferrals (DEC-D003 Influencer, DEC-D004
Publishing) place modules the plan schedules *inside* MVP — including P3, which the plan
calls "the MVP's central demo" and which sits on the critical path. This is a product call.
Recorded in [decisions.md](../decisions.md) with three options.

**Correction to the execution plan's §1.2.** It reads as though API key management is absent
end to end. In fact `db/core/api-keys.ts` already defines the `apiKeys` table and
`db/schema.ts` already exports it — a detailed table with key types, environments,
permission levels, security levels, and rotation strategy. NWB-P0-001 is service, routes,
`Bearer` middleware, and tests — **no new table, no migration for it**.

## Incidental fixes

- `docs/technical/ADRs.md` had two sections numbered `## 22`. Renumbered while inserting ADR-028 (§22–§26 now sequential).
- ADR index and the "Current ADRs: 17" count updated to 18.
- ADR-018 … ADR-027 are reserved by the planned-ADR table, so the new ADR took **ADR-028**. A numbering note was added to the index.

## Not fixed — needs an owner

`docs/technical/ADRs.md` ends with a **"Money Handling Convention"** section written for
"the Gilo Business ecosystem", referencing `formatNGN` on mobile. It is not Nawebeus
content, and the Document Version History table above it is truncated mid-sentence. Left in
place deliberately — deleting another project's content is not a call this ticket should make.
