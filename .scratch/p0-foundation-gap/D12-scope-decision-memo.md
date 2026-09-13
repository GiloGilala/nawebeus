# D12 — MVP Scope Decision Memo

**Decision required:** Which module set constitutes MVP?
**Raised:** 2026-09-13, while resolving D1 (module numbering) under NWB-P0-007
**Blocks:** P3 (Publishing), P8 (PR), P9 (Influencer), P10 (Commerce) — and, indirectly, the P12 and P14 entry gates
**Owner of the call:** Product Lead. This is **not** an engineering decision.
**Status:** 🔴 Open — awaiting decision

---

## 1. Why this exists

D1 asked *which numbering* is canonical. Settling it exposed a larger question: the repo
holds **three different answers to "what is MVP?"**, and the execution plan implies a fourth.

| Source | Status | MVP module set |
| --- | --- | --- |
| `DEC-005` | ✅ Approved 2025-10-01 | **5** — Grow, Listen, Monitor, Engage, Analyze |
| `PRD.md` §8 + `Roadmap.md` §4.2 | Active docs | **10** — the above plus Auth, Org, Social Integration, Notifications, System Admin |
| Execution plan §5 | Active | **P2–P13** — ~14 domains, adding Publishing, PR, Commerce, Influencer |
| `DEC-D003` / `DEC-D004` | ✅ Approved | Influencer → Phase 4; Publishing → Phase 5 (i.e. **post-MVP**) |

## 2. Headline finding: DEC-005 and the PRD do not actually conflict

They count different things, and neither document says so:

- **DEC-005 counts the five *value* modules** — the capabilities a customer buys.
- **The PRD counts those five plus five *enablers*** — Auth, Org, Social Integration, Notifications, System Admin.

```
PRD Modules 1–10  =  DEC-005's five (PRD 4–8)  +  five enablers (PRD 1,2,3,9,10)
```

The mapping is exact, with no leftovers. **So Option A does not require superseding the PRD
— it *is* the PRD.** The only genuine conflict is that the execution plan adds four domains
that appear in neither list:

> **Social Publishing & Scheduling · Media Relations & PR · Social Commerce · Influencer Management**

That is the whole of D12. The question is not "5 or 10" — it is **"are these four in MVP?"**

## 3. The options

### Option A — Strict DEC-005 (recommended)

MVP is the PRD's ten modules. The four non-PRD domains ship post-launch.

| | |
| --- | --- |
| **In MVP** | P0, P1, P2, P4, P5, P6, P7, P11, P12, P13, P14, P15 |
| **Deferred** | P3, P8, P9, P10 |
| **Critical path** | `P0 → P1 → P2 → {P7 ∥ P11} → P12 → P14 → P15` (P4 → P5 in parallel) |
| **Launch demo** | The **Engage inbox** driven by **Monitor** coverage and **Listen** mentions — "find it, understand it, respond to it" |
| **Supersessions** | **None required.** DEC-005, the PRD, DEC-D003 and DEC-D004 all already agree. |
| **Cost** | No outbound publishing at launch. Nawebeus launches as an intelligence-and-response product, not a publishing tool. |

**Product consequence to weigh:** the product is named "social media management and **PR
intelligence**" and DEC-002 positions it as "the first unified social media and **PR**
platform built for Africa". Deferring P8 (PR) means neither half of that positioning is
fully true at launch. This is the strongest argument *against* Option A, and it is a
marketing/positioning call rather than an engineering one.

### Option B — Execution plan as written

MVP is P2–P13. All four non-PRD domains ship before launch.

| | |
| --- | --- |
| **In MVP** | P2–P13, ~14 domains |
| **Deferred** | nothing |
| **Critical path** | `P0 → P1 → P2 → P3 → P7 → P11 → P12 → P14 → P15` — **as the plan states it, but see §4** |
| **Launch demo** | P3 Publishing end-to-end — the plan calls this "the MVP's central demo" |
| **Supersessions** | **Three, all approved decisions:** DEC-005, DEC-D003, DEC-D004 |
| **Cost** | DEC-005 explicitly rejected "All 10+ modules at MVP" on the grounds it "would delay launch by 6+ months". This option re-adopts the rejected alternative and must say so in the Decision Log. |

### Option C — Hybrid / sequenced

Core five plus a **minimal** Publishing path; defer PR, Influencer, Commerce.

| | |
| --- | --- |
| **In MVP** | P0, P1, P2, P3 (reduced), P4, P5, P6, P7, P11, P12, P13, P14, P15 |
| **Deferred** | P8, P9, P10 — plus P3's non-demo tickets (see below) |
| **Critical path** | `P0 → P1 → P2 → P3(min) → P7 → P11 → P12 → P14 → P15` |
| **Launch demo** | Compose → schedule → publish → result recorded |
| **Supersessions** | DEC-D004 superseded (Publishing pulled forward); DEC-005 **amended, not superseded** — the five value modules are unchanged, one more capability is added |
| **Cost** | P3's hard part is not the CRUD — it is P3-003 (dispatch) and P3-004 (retry + reconciliation), both L, both requiring real platform round-trips. "Minimal" means keeping those two and deferring P3-006 (calendar) and P3-005 (approval integration) — which is a smaller saving than it looks. |

**If Option C is chosen, P3 should be re-scoped explicitly** rather than left as-is:
keep NWB-P3-001 … 004; defer NWB-P3-005 (approval) and NWB-P3-006 (calendar) to post-launch.

## 4. Phase-sequencing impact

| Phase | Option A | Option B | Option C |
| --- | --- | --- | --- |
| **P3** Publishing | ❌ Deferred post-launch | ✅ As written, at P3, on the critical path | ⚠️ Reduced to tickets 001–004; 005/006 deferred |
| **P8** PR | ❌ Deferred post-launch | ✅ As written, after P4 | ❌ Deferred post-launch |
| **P9** Influencer | ❌ Deferred post-launch | ✅ As written, after P8, performance tickets after P12 | ❌ Deferred post-launch |
| **P10** Commerce | ❌ Deferred post-launch | ✅ As written, after P2 | ❌ Deferred post-launch |
| **P12** Analytics | Gate narrows to `P4–P11 emit events` | Gate unchanged (`P3–P11`) | Gate unchanged (`P3–P11`) |
| **P14** Web app | **Gate must be re-pointed** from P3 to P7 | Gate unchanged (P3) | Gate unchanged (P3) |
| **P14.4** composer/calendar screens | Dropped from the P14 screen order | As written | Kept (composer); calendar deferred |

**Two knock-on changes in every non-B option:**

1. **P14's entry gate is currently P3** — "P3 (the first usable workflow)". If P3 is deferred, this gate has no referent and must be re-pointed at P7 (Engage inbox), which becomes the first usable workflow. This is a real edit to the plan, not a formality.
2. **P12's entry gate is currently "P3–P11 emit events."** It narrows to `P4–P11`.

## 5. Three defects in the plan's own sequencing

Found while building this memo. They should be fixed regardless of which option wins.

1. **The critical path contradicts the dependency graph.** The stated path skips P10:
   `P0 → P1 → P2 → P3 → P7 → P11 → …` — but the graph routes `P3 → P7 → P10 → P11`.
2. **P11's entry gate contradicts the graph.** P11's gate is `P1 (approval, notifications)`, which would let Campaigns start in parallel with P3–P10. The graph draws it after P8, P9, and P10.
3. **P7's dependency on P3 is unstated.** The graph routes P3 → P7, but P7's entry gate is `P2 (platform webhooks); P1-003, P1-008` — no P3. So P3 may not be on the critical path at all, which weakens the "Publishing is the demo" argument.

Defect 3 matters: **if P7 does not actually depend on P3, then Option A's critical path and
Option B's are the same length** — and the "6+ month delay" argument for keeping Publishing
in MVP evaporates. This should be resolved before the scope call, because it may make the
decision much easier.

## 6. Recommendation

**Option A**, on three grounds:

1. It is the only option requiring **zero supersessions**. DEC-005, the PRD, DEC-D003 and DEC-D004 all already agree; adopting Option A makes the repo internally consistent for the first time.
2. Option B re-adopts an alternative that DEC-005 **explicitly rejected**, with a stated cost of 6+ months. Overriding that needs a stronger reason than "the plan already scheduled it".
3. Defect 3 above suggests Publishing may not even be on the critical path — in which case deferring it costs **sequence**, not **time**.

**But** the positioning consequence in §3 is real and is not mine to weigh: deferring PR means
launching without the "PR" half of the product's stated identity. If that is unacceptable,
**Option C** is the honest middle — pull Publishing forward, leave PR, Influencer, and
Commerce deferred, and amend DEC-005 rather than superseding it.

## 7. Decision record

> Fill in and move to `docs/business/Decision Log.md` as **DEC-038** once made.

| Field | Value |
| --- | --- |
| Decision ID | DEC-038 |
| Date | _pending_ |
| Category | Product |
| Status | _pending_ |
| Decision | _pending_ |
| Supersedes | _none / DEC-005 / DEC-D003 / DEC-D004_ |
| Consequent plan edits | §5 phase list, §6 critical path + graph, P12 and P14 entry gates, §11 next actions |
| Consequent doc edits | `CONTEXT.md` ("Modules outside the PRD" phasing note), `Roadmap.md` §4.2 if scope changes |
