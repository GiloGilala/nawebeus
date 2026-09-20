# Master Roadmap — Production Readiness Workstream (§26)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 26. Production readiness workstream (Phase 8 detail)

| Area | State | Required | Source |
|---|---|---|---|
| Environment config | zod env (good); `APP_BASE_URL` added Phase 1 | prod `.env` schema review; no dev defaults in prod (`loadConfig` fails closed — keep) | config.ts |
| Secrets | env vars; no rotation | rotation schedule (Infra §8.3): JWT (dual-secret grace), DB, Resend, Paystack/Stripe, R2; stored in Coolify secret store, never in repo | Infra §8 |
| Database | PG (CI floor 14; ADR-003 14+) | production PG config (Infra §3.4); connection pool limits; statement timeouts | Infra §3.4 |
| Migrations | Phase 1 baseline | forward-only discipline (§21); release = `db:migrate` before process start; rollback plan per migration | §21 |
| Backups | none | daily pg_dump + WAL archiving + off-site; **restore rehearsed in staging** (plan gate) | Infra §5 |
| Recovery | none | RPO/RTO per Infra §5.3; incident runbook | Infra §5 |
| Logging | console | structured JSON (Phase 2), logrotate (Infra §6.5), 7-year audit retention (P1-010) | Infra §6.5 |
| Monitoring | none | Prometheus (node/pg/app) + Grafana dashboards (Infra §6.3) + error tracking | Infra §6.2 |
| Alerts | none | Alertmanager rules (Infra §6.4): 5xx rate, queue depth, worker failures, DB pool, disk, cert; on-call paging | Infra §6.4 |
| Metrics | none | request latency (p50/p95), error rate, queue depth, active sessions | QA §7.2 measurement |
| Queues/workers | Phase 2 pg-boss | depth + failure alerts; dead-letter review runbook | ADR-028 |
| Storage | Phase 2 R2 | bucket lifecycle, private access, signed URLs only | D6 |
| Rate limiting | Phase 1 fixed | applied to all public endpoints; 429 contract; capacity headroom checked in k6 | §22 |
| Security | §24 | launch = zero Critical/High; isolation suite green | §24 |
| Performance | — | k6 pilot scale; budgets met (QA §7.2 / Roadmap §18.3 Y1) | §25 |
| Deployment | none | Coolify blue-green (ADR-012/DEC-029); staging + prod; smoke suites both; 30-min auto-rollback watch | QA §11.3 |
| Health checks | `/api/health` (liveness only) | readiness probe (DB ping + queue) from Phase 2; nginx upstream health | Phase 2 / Phase 8 |
| Smoke tests | none | post-deploy script: health, signup (test account), signin, refresh, one module read | Phase 8 |
| Operational docs | Infrastructure.md (design) | runbooks (incident/rollback/restore/queue) **executed once** (plan NWB-P15-005) | Phase 8 |
| Incident procedures | none | severity model (QA §13.1), comms template, postmortem template | QA §13 |

---

