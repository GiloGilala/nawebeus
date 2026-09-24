# P1 — Shared infrastructure services

**Feature slug:** `p1-shared-infra`
**Spec owner:** Engineering Lead
**Roadmap:** `docs/plan/master-roadmap/07-phase-2-shared-infra.md` (§12) · execution plan §5 P1
**Status:** in-progress — **15 of 16 tickets done** (the roadmap's 12 plus four found during
delivery: 013–016). Queue, audit (+chain, +anonymization), approvals, retention, email, templates,
contacts, notifications, flags, invitation expiry all **done 2026-09-21/22** — see the index.
**NWB-P1-012** (observability baseline: request ids + access log + error tracking + readiness
probe) **done 2026-09-24** — this ticket closed the exit-gate clause *"a request can be traced by
correlation id from log to audit row"* (evidence in issues/14). **NWB-P1-011** (impersonation
sessions — start/end, full audit, clean end) **done 2026-09-24** (evidence in issues/15): the
`unified_audit_log` impersonation machinery finally has a writer. Remaining: **NWB-P1-005**
(media/storage — blocked on D6) and the operator-run Resend send for the email clause.

**Goal:** land the cross-cutting services every domain module needs. Per the execution plan this is
"the single largest multiplier in the plan" — nothing downstream starts before the exit gate.

**Entry gate:** Phase 1 (P0) exit gate met ✅ · D5 (queue runtime) decided ✅ (ADR-028: pg-boss).
D6 (object storage) is **still open** and blocks NWB-P1-005 only.

**Exit gate (plan §5 + roadmap §12):** a scheduled worker executes in dev **and** under the CI test
job (a no-op scheduled job proves the loop) · email actually sends via Resend in a dev sandbox
(evidence in this file) · the approval queue works end to end · media upload → signed URL works
against the local adapter · a feature flag gates a live code path · a request can be traced by
correlation id from log to audit row ✅ (NWB-P1-012, 2026-09-24 — `src/tests/observability.test.ts`
proves log line → `unified_audit_log.request_id` → `GET /api/audit?requestId=`) · all
purge/reclamation workers running on schedule.
**Nothing downstream starts until this gate passes.** Clauses still open: media upload → signed
URL (NWB-P1-005, blocked on D6) · the Resend sandbox send (operator run) · the CI no-op scheduled
job (verify at the gate, not per ticket).

## Ticket index

| ID | Ticket | Size | File | Status |
| --- | --- | --- | --- | --- |
| NWB-P1-001 | Queue + scheduler + worker base (pg-boss) | L | [issues/01-queue-scheduler-worker-base.md](issues/01-queue-scheduler-worker-base.md) | **done** |
| NWB-P1-002 | Audit service formalization + query API (closes F-19's read half) | M | [issues/03-audit-formalization-and-query-api.md](issues/03-audit-formalization-and-query-api.md) | **done** 2026-09-21 — registry + typed writes + `GET /api/audit`(:id); chain → P1-014, retention → P1-010, anonymization → P1-015 |
| NWB-P1-003 | Approval service (request/submit/approve/reject/expire-stale) | L | [issues/08-approval-service.md](issues/08-approval-service.md) | **done** 2026-09-22 — `src/services/approvals`, `/api/approvals` (submit, inbox/mine/all, approve/reject/request-changes/recall), `approvals.read/create/decide`, hourly `approvals.expire-stale` (7th job), migration 0004 |
| NWB-P1-013 | Purge batches must delete per row (org-owner FK aborts a night of erasures) | M | [issues/02-purge-batches-must-be-per-row.md](issues/02-purge-batches-must-be-per-row.md) | **done** 2026-09-21 — `deleteRowsPerRow` + `{deleted, failed, errors}` + partial-run `warning`; unblocks P1-010 |
| NWB-P1-014 | Audit hash chain: checksums on write + scheduled verification | M | [issues/04-audit-hash-chain.md](issues/04-audit-hash-chain.md) | **done** 2026-09-21 — sealed on write, nightly verify, append-only trigger; + `chainValid` read filter follow-up |
| NWB-P1-015 | Anonymize audit actor context on hard purge (F-29 / BR-AUTH-043) | S–M | [issues/05-audit-anonymization-on-purge.md](issues/05-audit-anonymization-on-purge.md) | **done** 2026-09-21 — subject scrub in `beforeDelete`, 0002 trigger exception, `auditAnonymized` |
| NWB-P1-016 | Expire lapsed invitations (split out of P1-015's residuals) | S–M | [issues/06-expired-invitation-cleanup.md](issues/06-expired-invitation-cleanup.md) | **done** 2026-09-22 — `expireInvitations` + resource-scoped invitee scrub, 5th job |
| NWB-P1-004 | Email transport: Resend adapter behind `EmailTransport` | M | [issues/09-email-transport-resend.md](issues/09-email-transport-resend.md) | **done** 2026-09-22 — `src/services/email/` (Resend over `fetch`, console for dev), `email.deliver` outbox on pg-boss (8th job, on-demand) with direct-send fallback, `email.delivered`/`email.delivery_failed` audit with masked recipient, 403 `EMAIL_NOT_VERIFIED` gate, invitation acceptance = verified; fixed two latent verification bugs the gate exposed. **Exit-gate evidence pending operator run** — see below |
| NWB-P1-005 | Media/storage service | L | to file | **blocked on D6** |
| NWB-P1-006 | Templates service | M | [issues/10-templates-service.md](issues/10-templates-service.md) | **done** 2026-09-22 — unified template service with CRUD, optimistic concurrency, platform variants, variable rendering, usage tracking, approval workflow, seeded permissions, audit events, and migration 0005 |
| NWB-P1-007 | Contacts service | M | [issues/11-contacts-service.md](issues/11-contacts-service.md) | **done** 2026-09-22 — shared contact CRUD, optimistic concurrency, deduplication merge with interaction repointing, timeline tracking, follow-up state machine, keyset pagination, audit events, RBAC, and migration 0006 |
| NWB-P1-008 | Notification engine core | L | [issues/12-notification-engine-core.md](issues/12-notification-engine-core.md) | **done** 2026-09-22 — alert rules CRUD, rate limiting (cooldown & daily cap), multi-recipient fan-out, email dispatch, alert event state machine (read, ack, escalate), keyset pagination, audit events, RBAC, and migration 0007 |
| NWB-P1-009 | Feature flags + system config | M | [issues/13-feature-flags-and-system-config.md](issues/13-feature-flags-and-system-config.md) | **done** 2026-09-22 — `evaluateFlag`, `getConfigValue`, optimistic concurrency, rollback, kill-switch, deterministic rollout percentage, targeting rules, audited writes, RBAC gates, `requireFeatureFlag` live code path gating, and migration 0008 |
| NWB-P1-010 | Retention + legal holds + backup records | M | [issues/07-retention-legal-holds-backup-records.md](issues/07-retention-legal-holds-backup-records.md) | **done** 2026-09-22 — holds block all four purge paths; `retention.enforce` nightly 02:55; census + backup records; adopts `legal_holds` + `backup_records` |
| NWB-P1-011 | Impersonation sessions | M | [issues/15-impersonation-sessions.md](issues/15-impersonation-sessions.md) | **done** 2026-09-24 — `src/services/impersonation/` (MFA step-up, 4 h clamp, one-impersonator-per-target), `impersonation_sessions` adopted (migration 0009), per-request row validation in the auth middleware, automatic `actorType='impersonation'` tagging via a request-scope ALS in `writeAuditLog`, BR-ADMIN-009 ability deny-list, `/api/users/admin` surface (impersonate / token / end / list), `impersonation.expire` 5-min job, `users.impersonate` seeded to owner + super_admin; 837/837 tests |
| NWB-P1-012 | Observability baseline (structured logs, correlation ids, real `/api/health`) | M | [issues/14-observability-baseline.md](issues/14-observability-baseline.md) | **done 2026-09-24** — request-context middleware (id + echo + access log), `writeAuditLog` ALS default, always-on 5xx error lines, readiness probe (DB ping + queue depth); 809/809 tests, live smoke; closed the exit-gate correlation clause |

Tickets are filed as one file per ticket when picked up, per `docs/agents/issue-tracker.md`; the
rows above without a file are the roadmap's own §12 list, not yet specced.

## Exit-gate evidence: "email actually sends via Resend in a dev sandbox"

The tooling is delivered; the send itself needs a Resend API key and a verified sending domain,
which the agent sandbox does not have and must not be given in chat. **Operator action:**

```sh
# in a shell with RESEND_API_KEY and EMAIL_FROM set (EMAIL_FROM on a domain verified in Resend)
bun run email:smoke -- --to you@example.com
```

The script sends one message through the configured transport (no queue, no audit) and prints
`evidence line for spec.md: <date> · resend · <id> · <masked recipient>`. Paste that line here:

- **Evidence:** _pending — not yet run against a real key._

Everything short of the network hop is covered by tests: the request/response mapping against a
fake `fetch` and a real `Bun.serve` socket (`src/tests/email.test.ts`), the outbox round trip on
live pg-boss (`src/tests/queue/loop.test.ts`), and the delivery job's audit rows
(`src/tests/queue/email-deliver.test.ts`).

## What P1-001 gave the phase

- `src/lib/queue.ts` — the pg-boss client: construction from config, `start()`/`stop()`, one
  singleton per process, per-queue policy (retry/backoff/expiry) declared in code.
- `src/lib/scheduler.ts` — the cron side: schedule table, per-job cron overrides from env, one
  `tz`, `missed: "once"` so a deploy that was down overnight still runs the job exactly once.
- `src/lib/worker.ts` — the worker base: register a definition, wrap its handler with the audit
  write (success **and** failure), hand it a `Db`, retry by rethrow, and a guard that keeps a
  broken queue runtime from killing the API process.
- `src/jobs/` — the three maintenance jobs Phase 1 left unwired: rate-limit reclamation
  (NWB-P0-013's script), `purgeExpiredAccounts` (F-18), `purgeExpiredOrganizations` (NWB-P0-023).
- Entrypoints: `src/index.ts` starts worker + scheduler alongside the API (ADR-007);
  `bun run queue:worker` runs workers only; `bun run queue:run <job>` runs one job through the same
  wrapper an operator would otherwise do by hand.
- **Nothing downstream reinvents this.** P1-003's expire-stale worker, P1-010's retention worker
  and P1-012's queue-depth health check all register a `JobDefinition`; the domain modules enqueue
  transactionally with `boss.send(name, data, { db: tx })`.

## Decisions this phase takes

| # | Decision | Outcome |
| --- | --- | --- |
| P1.1 | Queue runtime | Inherited — **ADR-028** (`pg-boss`, Postgres-backed, workers start alongside the API per ADR-007). |
| P1.2 | pg-boss schema ownership | Library-managed: `boss.start()` creates and versions schema `pgboss`; its tables never enter `drizzle/migrations/` (the rule NWB-P0-005 wrote; README updated with the as-built name). |
| P1.3 | Which process owns the queue | Configuration, not code: `QUEUE_WORKER_ENABLED` / `QUEUE_SCHEDULER_ENABLED` split the two responsibilities inside one entrypoint, so ADR-007 can be revisited without a rewrite. |
| P1.4 | Audit module for worker events | `module: "core"`, not `"system"` — `chk_ual_system_requires_checksum` demands a hash chain for `system` and nothing computes the chain yet (same reason NWB-P0-002's DSAR event cites `core`). Recorded in the code, not just here. |
| P1.5 | Job handler placement | `src/jobs/**` — thin adapters that validate input and call `src/services/**`. `src/lib/worker.ts` stays business-logic-free so a second worker type costs one file. |

## Notes for whoever picks this up

- `bun test` runs the loop test **only** when `DATABASE_URL` is set (like every DB-gated suite);
  it creates a throwaway `pgboss_test_*` schema, asserts a real send → work → audit round trip, and
  drops the schema. No litter, and no dependence on the app's singleton.
- `pg-boss@12.33.2` `work()` handlers receive an **array** of jobs, and the queue must exist before
  `send()` — `registerJobs()` calls `createQueue()` for you; a hand-rolled `send()` in a later
  ticket must too, or it throws `Queue <name> does not exist`.
- New dependency, checked per AGENTS.md: `pg-boss` is mandated by ADR-028, which already rejected
  `Bun.cron` (a trigger, not a queue: no persistence, retry, backoff or job state) and in-process
  timers. Nothing in Bun or `node:*` provides a persistent job table.
