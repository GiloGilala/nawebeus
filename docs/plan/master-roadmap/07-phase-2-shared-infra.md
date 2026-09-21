# Master Roadmap — Phase 2: Shared Infrastructure Services (§12)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 12. Phase 2 — Shared infrastructure services (execution plan P1)

**Objective:** land the cross-cutting services every domain module needs. Per the execution plan this is "the single largest multiplier" — nothing downstream may start before its exit gate.
**Slug:** `.scratch/p1-shared-infra/` (create per plan §9).
**Entry criteria:** Phase 1 exit gate met; D6 (storage) resolved.
**Dependencies:** Phase 1 (migrations baseline for any schema touch; email/queue are new dependencies).

**Tickets (adopted verbatim from plan §5 P1 — ticket detail lives there; this section records verification-relevant additions):**

| ID | Ticket | Verified current state | Notes added by this audit |
|---|---|---|---|
| NWB-P1-001 | Queue + scheduler + worker base (pg-boss) | ✅ **DONE 2026-09-21** — §12.1 for what landed and the verification log. Was: nothing in `src/lib/`; ADR-028 accepted; `package.json` had no pg-boss | Add pg-boss dep with the ADR-028 rationale in the PR (AGENTS.md dependency rule). Workers must write audit events (success+failure) and be idempotent (ground rule 4). **Wire here:** rate-limit reclamation (NWB-P0-013's manual script), `purgeExpiredAccounts` (F-18), `purgeExpiredOrganizations` (NWB-P0-023). pg-boss schema bootstrap recorded per NWB-P0-005(5). |
| NWB-P1-002 | Audit service formalization | `writeAuditLog` exists; no reads; 5-module enum too small for 14 domains | Extend `AuditModule` taxonomy to cover PRD modules 3–10 + non-PRD domains; add query service (by actor/subject/org/category/date-range, paginated — fixes F-19 first half); retention + legal-hold hook in P1-010. |
| NWB-P1-003 | Approval service | `db/shared/approval.ts` active (2 tables), unused | Gates responses (P7), releases (PR phase), content (Publishing if D12=B/C). |
| NWB-P1-004 | Email transport: Resend adapter | console-only; DEC-028 approved | Also flips the Phase 1 "verification hard-block" checkbox (NWB-P0-015 note) — add the gate for `pending_verification` once real delivery exists. |
| NWB-P1-005 | Media/storage service | none; `media_assets` table active-ready; D6 open | Interface mirrors `EmailTransport`; R2 adapter prod / local-disk dev per docs; signed URLs; soft delete. Avatars (PRD `/me/avatar`) and report exports (P12) consume this. |
| NWB-P1-006 | Templates service | `templates` table active-ready | |
| NWB-P1-007 | Contacts service | `contacts` + `contact_interactions` active-ready | Reused by PR/Influencer (Option B/C) — build regardless (cheap, spec'd). |
| NWB-P1-008 | Notification engine core | `alerts` tables (2) active-ready | create/recipients/delivery-log; channels in P6. |
| NWB-P1-009 | Feature flags + system config | none | `evaluateFlag`, `getConfigValue`, audited config writes; used by billing limits + Phase 7 dark launches. |
| NWB-P1-010 | Retention + legal holds + backup records | none | 7-year audit retention (Module 1 spec) enforced by worker; holds block purge workers from P1/NWB-P0-023. |
| NWB-P1-011 | Impersonation sessions | `AuditActorType` already includes `"impersonation"` | Start/end, full audit, clean end; support tooling (P15-006). |
| NWB-P1-012 | Observability baseline | console + `NWB_DEBUG_ERRORS` only | Structured JSON logs (request id, org id, user id, duration), correlation IDs (reuse `requestId` field already in audit schema), error tracking, `/api/health` upgraded to a real readiness probe (DB ping + queue depth). Infra §6.2 stack (Prometheus/Alertmanager) is wired in Phase 8; Phase 2 makes the data exist. |

**Schema adoptions in this phase:** none new (approval/contacts/alerts/media/templates/analytics are already active). Any drift found while wiring is fixed in the schema + migration (ground rule 7), recorded in the ticket.

**Exit gate (plan §5 + this audit):** scheduled worker executes in dev **and** under the CI test job (a no-op scheduled job proves the loop); email actually sends via Resend in a dev sandbox (evidence in spec.md); approval queue works end-to-end; media upload→signed-URL works against local adapter (R2 smoke when credentials available); feature flag gates a live code path; observability: a request can be traced by correlation id from log to audit row; all purge/reclamation workers running on schedule. **Nothing downstream starts until this gate passes.** **Two clauses of that gate are met** (NWB-P1-001): the worker loop runs and purge/reclamation is scheduled — the remaining five wait on their own tickets.

### 12.1 What NWB-P1-001 actually landed (2026-09-21)

The foundation every later ticket here assumed. New: `src/lib/queue.ts` (client + `QUEUE_JOBS`
metadata + start/stop singleton), `src/lib/scheduler.ts` (the cron side), `src/lib/worker.ts` (the
worker base: register, audit, rethrow), `src/jobs/` (the three maintenance jobs + the job set),
`src/scripts/queue-worker.ts`, `src/scripts/queue-run.ts`. Changed: `src/lib/config.ts` (six `QUEUE_*`
keys), `src/index.ts` (starts the runtime, degrades to API-only), `.env.example`, `AGENTS.md`,
`drizzle/README.md`, `package.json` (`queue:worker`, `queue:run`).

**As-built, in one paragraph.** `startQueue()` builds a `PgBoss` from config alone — schema
`QUEUE_SCHEMA`, `pollingIntervalSeconds`, `tz`, `application_name` — and owns start/stop, because the
library does not: `PgBoss` has no public `started` flag, so `start()` twice replaces the supervisor's
event listeners and leaves the first monitor running against a closed pool. Every process that touches
the queue goes through it. `registerJobs(deps, jobs, { withWorker, withSchedules })` installs three
independent things: queue records, handlers, schedules. Queues are ensured on *every* start (a
scheduler-only process must still `send`, and v12 throws `Queue <name> does not exist` otherwise),
handlers only when `withWorker`, schedules only when `withSchedules` — one flag each, mirroring the
three config switches. Handlers get `{ includeMetadata: true, batchSize: 1 }`: `batchSize` because
`teamConcurrency` was removed in v12, metadata because the attempt number only arrives on the metadata
channel — and a worker that cannot see which attempt it is cannot log a retry differently from the
terminal failure, which is what makes `warning` while retries remain and `critical` when they do not be
worth anything. `stop()` converges handlers but deliberately **keeps** schedules: an API restart must
never cancel tonight's erasure.

**Two library behaviours worth knowing before this is touched.** A cron firing twice in one minute is
not a duplicate run — occurrences are filed into a slot bucket keyed on `(name, seconds … minute)`
(`node_modules/pg-boss/dist/plans.js` `occurrenceInsertions`, unique index `job_i4` in `manager.js`),
so the second tick is deduplicated by constraint; the worker-side guard is `startQueue`'s single
supervisor plus one queue per job name at `workerConcurrency: 1` (three queues, three workers, three
slots — the app never sets `maxWorkerConcurrency`, the knob that would break that arithmetic).
And **do not** add an app-level `singletonKey` to guard a double tick: `singletonNextSlot` *delays* into
the next slot instead of dropping, and `singletonSeconds` would throttle manual retries — the CLI is a
support tool and throttling it is the wrong trade. Retry backoff is `retryDelay × (2^retryCount / 2)`
plus jitter, so `retryDelay: 60` means a first retry inside ~30s; a schedule with a smaller period will
pile up.

**Verification.** `bun test src/tests/queue/` → **48 pass** across four files: `definitions` (16 —
the registry contract: three jobs exist, audit metadata present, `QUEUE_JOB_NAMES` in running order,
`assertJobSetIsComplete` refuses a partial set), `worker` (18 unit tests on a fake boss), `jobs` (5
DB-gated: both services delete only expired rows, re-runs are no-ops, the F-25 wedge reproduces and the
org-first order clears it, and **real** `unified_audit_log` rows are read back for a success and a
failure at column level), `loop` (9 against a live `PgBoss` in a throwaway schema: config installs and
versions the schema, a send is claimed with `attempt: 1`, a throwing handler records exactly three
attempts and lands in `failed` with a growing `startAfter`, `stop()` unregisters without cancelling the
schedule, `startQueue` is idempotent, a second `start()` fails loudly, `getQueue()` refuses instead of
lazily starting, and a cron `* * * * * *` fires). Gates: `bun test` 502 pass / 0 fail (447 before), 273
pass / 243 skip with `DATABASE_URL` unset in 0.3s (no connection attempts), `bun run typecheck` clean,
`biome check . --diagnostic-level=error` clean, `bun run build` clean, `coverage:check` green (`src/lib`
96.6%, `src/services` 89.9%). Live: `queue:worker` printed three queues and the three expected crons,
then shut down gracefully on SIGTERM; `queue:run` wrote the audit row quoted in the ticket;
`bun run src/index.ts` logged `[queue] 3 queue(s) active (worker: on, scheduler: on)` and served
`/api/health`; `QUEUE_ENABLED=false` logged nothing and served anyway; an unreachable `DATABASE_URL`
logged `WORKER NOT STARTED` and **still served** `/api/health`; `db:push --force` left an installed
`pgboss` schema byte-identical (12 tables, version 42). Two acceptance details in the ticket were
corrected against the library rather than fudged — see its Comments. **Follow-up found: NWB-P1-013**
(per-row batching in `purgeExpiredAccounts` — one org-owner FK violation aborts a whole night's
erasures).

---

