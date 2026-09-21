# P1 — Shared infrastructure services

**Feature slug:** `p1-shared-infra`
**Spec owner:** Engineering Lead
**Roadmap:** `docs/plan/master-roadmap/07-phase-2-shared-infra.md` (§12) · execution plan §5 P1
**Status:** in-progress — NWB-P1-001 (queue + scheduler + worker base), NWB-P1-002 (audit
formalization + query API) and NWB-P1-013 (per-row purge deletes + honest partial-run reporting, found
while delivering P1-001) all **done 2026-09-21**. Live in the queue: **NWB-P1-003** (approval service)
is drafted with four scope questions open; **NWB-P1-014** (audit hash chain) is the next unblocked
ticket by number and unblocks NWB-P1-015. The other eight tickets are not started.

**Goal:** land the cross-cutting services every domain module needs. Per the execution plan this is
"the single largest multiplier in the plan" — nothing downstream starts before the exit gate.

**Entry gate:** Phase 1 (P0) exit gate met ✅ · D5 (queue runtime) decided ✅ (ADR-028: pg-boss).
D6 (object storage) is **still open** and blocks NWB-P1-005 only.

**Exit gate (plan §5 + roadmap §12):** a scheduled worker executes in dev **and** under the CI test
job (a no-op scheduled job proves the loop) · email actually sends via Resend in a dev sandbox
(evidence in this file) · the approval queue works end to end · media upload → signed URL works
against the local adapter · a feature flag gates a live code path · a request can be traced by
correlation id from log to audit row · all purge/reclamation workers running on schedule.
**Nothing downstream starts until this gate passes.**

## Ticket index

| ID | Ticket | Size | File | Status |
| --- | --- | --- | --- | --- |
| NWB-P1-001 | Queue + scheduler + worker base (pg-boss) | L | [issues/01-queue-scheduler-worker-base.md](issues/01-queue-scheduler-worker-base.md) | **done** |
| NWB-P1-002 | Audit service formalization + query API (closes F-19's read half) | M | [issues/03-audit-formalization-and-query-api.md](issues/03-audit-formalization-and-query-api.md) | **done** 2026-09-21 — registry + typed writes + `GET /api/audit`(:id); chain → P1-014, retention → P1-010, anonymization → P1-015 |
| NWB-P1-003 | Approval service (request/submit/approve/reject/expire-stale) | L | [issues/06-approval-service.md](issues/06-approval-service.md) | **drafted 2026-09-21** — schema measured, 4 scope questions open (approver model, chain semantics, expiry worker, permissions) |
| NWB-P1-013 | Purge batches must delete per row (org-owner FK aborts a night of erasures) | M | [issues/02-purge-batches-must-be-per-row.md](issues/02-purge-batches-must-be-per-row.md) | **done** 2026-09-21 — `deleteRowsPerRow` + `{deleted, failed, errors}` + partial-run `warning`; unblocks P1-010 |
| NWB-P1-014 | Audit hash chain: checksums on write + scheduled verification | M | [issues/04-audit-hash-chain.md](issues/04-audit-hash-chain.md) | ready-for-agent (split out of P1-002; blocks P1-015) |
| NWB-P1-015 | Anonymize audit actor context on hard purge (F-29 / BR-AUTH-043) | S–M | [issues/05-audit-anonymization-on-purge.md](issues/05-audit-anonymization-on-purge.md) | ready-for-agent (needs P1-014) |
| NWB-P1-004 | Email transport: Resend adapter behind `EmailTransport` | M | to file | ready-for-agent |
| NWB-P1-005 | Media/storage service | L | to file | **blocked on D6** |
| NWB-P1-006 | Templates service | M | to file | ready-for-agent |
| NWB-P1-007 | Contacts service | M | to file | ready-for-agent |
| NWB-P1-008 | Notification engine core | L | to file | ready-for-agent (needs P1-004) |
| NWB-P1-009 | Feature flags + system config | M | to file | ready-for-agent |
| NWB-P1-010 | Retention + legal holds + backup records | M | to file | ready-for-agent (needs P1-001 ✅) |
| NWB-P1-011 | Impersonation sessions | M | to file | ready-for-agent (needs P1-002) |
| NWB-P1-012 | Observability baseline (structured logs, correlation ids, real `/api/health`) | M | to file | ready-for-agent |

Tickets are filed as one file per ticket when picked up, per `docs/agents/issue-tracker.md`; the
rows above without a file are the roadmap's own §12 list, not yet specced.

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
