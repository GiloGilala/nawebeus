# Master Roadmap — Phase 8, Phase 9 & Post-Launch: Hardening, Production Readiness, Launch (§18–§20)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 18. Phase 8 — Beta hardening & production readiness (plan P15 + Infrastructure workstream)

**Entry:** Phase 7 exit (Option A) — i.e., the in-scope workflows all work in the browser.
**Two workstreams run in parallel, then converge on the release gate:**

### 18.1 Security & compliance workstream (plan P15 + Phase 1 residues)
- **NWB-P15-001 Security review:** full re-audit per `docs/audit/` template methodology (the template exists precisely for this — fill it per domain: auth, orgs, each Phase 4/5/6 module): tenant isolation on every read/write path (isolation suite over **every multi-tenant table**, QA §6.3), IDOR sweep (the route-invariant scan from NWB-P0-018 extended to new routes), authz bypass, mass-assignment (zod strictness audit of every body schema — reject unknown keys), injection review (all raw SQL is parameterized today — verify no new `sql` interpolation of identifiers), file upload review (Phase 2 storage), secrets (env audit, no secrets in logs — QA §11.2 secret-detection gate), CSRF/CORS (Phase 1 CORS fixed; re-verify with the web app's origins).
- **NWB-P15-002 NDPR/GDPR verification:** DSAR (Phase 1) + retention (P1-010) + consent gates + 7-year audit retention + erasure (purge workers) — checklist signed off (PRD §17.1).
- **RLS decision execution (D11):** if "implement RLS": policies per Security Architecture §4.4 on all tenant tables + `app.current_org_id` set in the connection context (the doc's SQL pattern) + RLS regression suite; if "defer": ADR-009 amended with the deferral and the app-layer invariants (NWB-P0-018 test) become the enforceable control. **Must be one or the other — not ambiguous** (plan §4 D11).
- **NWB-P15-003 Load & performance validation:** k6 suite per QA §7.3 against QA §7.2 targets **as they apply to the API at pilot scale** (API read <200ms p95 cache-miss, write <100ms, 5,000 concurrent pilot users; Roadmap §18.3 Y1: API <500ms, page <2s). Measure, record, fix regressions; do not invent stricter numbers.
- **NWB-P15-004 Observability + alerting for production:** Phase 2 data sources → Prometheus/Alertmanager per Infra §6.2/§6.4 (error rate, queue depth, worker failures, DB pool, cert expiry); Sentry (or self-hosted equivalent) error tracking.
- **NWB-P15-005 Runbooks:** incident, rollback, backup restore, queue recovery — **each executed once in staging** (plan requirement).
- **NWB-P15-006 Support tooling:** impersonation (P1-011), audit lookup (P1-002), account recovery — "support can resolve the top-10 expected tickets without engineering".
- **NWB-P15-007 Release gates checklist executed** (§27).

### 18.2 Infrastructure workstream (from `docs/technical/Infrastructure.md` — adopt as the implementation spec)
| Area | Concrete task | Source |
|---|---|---|
| Provisioning | VPS spec per phase (§3.1), initial setup script (§3.2), WireGuard (§3.3) | Infra §3, ADR-008 |
| PostgreSQL | Config tuning (§3.4), **backup strategy: daily pg_dump + WAL archiving, off-site copy** (§5.1), backup script (§5.2), RPO/RTO (§5.3), **monthly restore test** (§5.5) | Infra §3.4/§5 |
| Nginx | TLS termination, proxy headers (must set the X-Forwarded-For the Phase 1 IP policy trusts), rate-limit headers | Infra §3.5 |
| Service | systemd unit + Bun runtime (§3.6), graceful shutdown (already in `src/index.ts` SIGTERM handler) | Infra §3.6 |
| CI/CD | CD pipeline per QA §11.3: build image → Coolify staging (blue-green, ADR-012/DEC-029) → staging smoke → E2E on staging → manual sign-off (major releases) → prod blue-green → prod smoke → 30-min error watch with auto-rollback trigger | QA §11.3, Infra §4 |
| Monitoring | Health/readiness (Phase 2 `/api/health` upgrade), dashboards (§6.3), alert rules (§6.4), structured logging to disk + logrotate (§6.5) | Infra §6 |
| Access & secrets | Server access matrix (§8.1), SSH key mgmt (§8.2), **secret rotation schedule implemented** (§8.3) — JWT secrets rotation needs a dual-secret grace (access tokens live 15 min — rotation is safe within one access-TTL window; document procedure) | Infra §8 |
| Recovery drill | **Backup restore exercised successfully** (plan release gate) | Infra §5.4 |

**Phase 8 exit:** plan §8 "before public launch" checklist fully satisfied (reproduced in §27).

---

## 19. Phase 9 — Public launch (release)

**Objective:** execute the release strategy (§27) and declare production.
**Entry:** Phase 8 exit (GO criteria all green).
**Steps (plan §5 P15 + §27):** staging freeze → final migration verification from empty DB → production deploy (blue-green) → smoke suite → 30-min monitoring window → post-deployment verification checklist (§27.10) → release sign-off (CTO + Engineering Lead + Product).
**Rollback:** blue-green flip back to previous green (ADR-012) + migration rollback plan per §21 (schema changes in a release must be backward-compatible for one release — forward-only with expansion-then-contraction pattern; record any destructive change with its impact per operating rule 11).
**Exit:** production serving real organizations; uptime/CSAT monitoring live (Roadmap §18.3 Y1 targets tracked).

---

## 20. Phase 10 — Post-launch (future, explicitly outside the current build)

Per scope control (§28): **Future enhancement.**
- **Mobile (plan P16):** RN + Expo per DEC-008; offline mutation semantics (source-of-truth, ID reconciliation, idempotency, conflict resolution) **defined and tested before coding** (plan P16 critical requirement); push channel wires NWB-P6-004.
- **D12-deferred domains (Option A):** Publishing, PR, Commerce, Influencer — their plan ticket sets (P3/P8/P9/P10) remain the implementation record; entry gate: post-launch capacity.
- **P17 roadmap:** AI/ML (reuses P7-006 suggestion storage + D8 enrichment interface), public API (**blocked by Phase 1's API-key work — now unblocked**), enterprise SSO/SCIM, additional platforms, i18n, white-label.
- **RLS (if deferred by D11)** lands here as hardening.
- **MFA AC6/AC7** (trust-device, Owner/Admin enforcement) via Phase 2 flags.

---

