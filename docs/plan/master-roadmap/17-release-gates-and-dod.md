# Master Roadmap — Release Strategy, GO/NO-GO & Definition of Done (§27–§28)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 27. Release strategy & GO/NO-GO

**Sequence (per operating rule 17):**
1. **Development verification** — every phase exit gate met and recorded (this document's phases).
2. **Integration verification** — full cross-module E2E journeys (signup → org → connect → monitor/listen/engage → report → billing) green on staging; migration verification from empty DB and from "previous release DB" shape.
3. **Staging deployment** — blue-green to Coolify staging; soak ≥ 48h with synthetic load (k6 pilot profile).
4. **Migration verification** — `db:migrate` on staging from the last production-shaped schema; diff review.
5. **Smoke testing** — smoke suite on staging.
6. **Regression testing** — full CI suite + E2E + security suite on staging.
7. **Security verification** — §24 standing: zero Critical/High; isolation suite; NDPR checklist signed (DSAR, retention, consent, audit retention, erasure).
8. **Performance verification** — k6 at pilot scale; budgets (QA §7.2 applicable + Roadmap §18.3 Y1) met; report archived.
9. **Production deployment** — blue-green; maintenance window only if a migration is not backward-compatible (should not happen under §21 rules).
10. **Post-deployment verification** — prod smoke suite; 30-min error-rate watch (auto-rollback trigger); first real signup walk-through by an operator (runbook); audit-log spot check.
11. **Rollback procedure** — flip blue→green; if a migration ran: apply the recorded compensating migration (expansion-only changes need none — verify per release); communication runbook.
12. **Sign-off** — CTO + Engineering Lead + Product Lead against the checklist below.

**GO / NO-GO criteria (evidence-based — each line is a recorded artifact):**

| # | Criterion | Evidence artifact |
|---|---|---|
| 1 | All in-scope Phase 1–8 tickets `done` with recorded exit gates | `.scratch/*/spec.md` status lines + verification evidence (plan §9) |
| 2 | CI green: typecheck, lint, build, full suite on PG14, coverage script pass | CI run log at release commit |
| 3 | Migration path verified from empty DB to current schema (+ re-migrate no-op) | migration verification log |
| 4 | Tenant isolation suite: 100% of multi-tenant tables, 0 leaks | security suite report |
| 5 | RBAC matrix: all roles × actions positive+negative green | security suite report |
| 6 | No open Critical/High security finding | §24 register status |
| 7 | NDPR/GDPR checklist signed (DSAR, retention, consent gates, 7-yr audit, erasure) | signed checklist (NWB-P15-002) |
| 8 | Every in-scope P0 workflow verified end-to-end in the browser | E2E report + recordings/screenshots |
| 9 | All workers idempotent (double-run test) and observable; queue failures alerted | worker test reports + staging alert demo |
| 10 | Backup restore exercised successfully (RPO/RTO met) | restore drill log (Infra §5.5) |
| 11 | Runbooks written **and each executed once** in staging | runbook execution logs |
| 12 | Performance budgets met at pilot scale | k6 report |
| 13 | No unresolved destructive data-integrity issue | risk register status (§28) |
| 14 | Secrets rotated post-launch plan documented; no secrets in repo/logs | secret audit log |

**NO-GO on any item** — the release waits; the failing line becomes the work order.

---

## 28. Definition of Done (project-wide)

A feature/phase is complete when **all** of the following are evidenced (plan §2.1 extended):

| Dimension | Done when |
|---|---|
| Implementation | Code merged; follows layering (app → services → lib); no parallel implementation of an existing responsibility (ground rule 8) |
| Database | Schema change via migration (post-Phase 1); constraint tests present; backward-compatible (or compensating migration recorded) |
| API | Envelope-compliant; zod-validated; error contract correct; documented in the generated API reference |
| Authorization | `requireAbility` present (mutating) / permission matrix row covered; object-level checks in service layer |
| Tenant isolation | org predicate in every query; `:orgId` routes carry `requireOrgMatch` (invariant test passes); isolation-suite row for every touched table |
| UI (when applicable) | all 12 plan-P14 states implemented; permission-gated UI mirrors server; keyboard-accessible; axe-clean |
| Mobile (when applicable) | plan P16 requirements incl. offline semantics |
| Validation | positive + negative (Negative Test Rule); boundary values; mass-assignment rejected |
| Error handling | typed AppErrors; 500s opaque; no stack/SQL leakage; 429 carries `retryAfter` |
| Tests | unit + integration + API (or E2E from P7) green in CI; concurrency tested where read-modify-write; red-green for any fixed defect |
| Documentation | module spec / API reference / runbooks updated; decisions recorded in Decision Log; `Status:` lines updated |
| Observability | structured logs with correlation id; audit event for every mutation; worker success/failure audited; metrics exist |
| Security | §24 standing (no new open finding); secrets handled per §26; rate-limited where public |
| Migration | migration verified from zero + idempotent re-run |
| Deployment | covered by the release's CD pipeline; smoke-tested |
| Verification | phase exit criteria recorded with evidence (test output / command transcript / screenshot) in the phase `spec.md` (plan §9) |

---

