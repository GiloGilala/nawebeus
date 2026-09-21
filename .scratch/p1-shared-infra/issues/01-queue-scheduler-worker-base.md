# NWB-P1-001 — Queue + scheduler + worker base (pg-boss)

Type: task
Status: done (2026-09-21)
Blocked by: —
Phase: P1 (roadmap Phase 2) · execution plan §5 P1
Size: L

## Ask (verbatim from the plan)

> **NWB-P1-001** | **Queue + scheduler + worker base** (`src/lib/queue.ts`, `src/lib/scheduler.ts`,
> `src/lib/worker.ts`) | D5 | L | A registered worker runs on a cron/interval in dev; failures retry
> with backoff; failures and successes write audit events; a worker that runs twice is idempotent

Roadmap §12 adds the wiring this ticket owns: *"Add pg-boss dep with the ADR-028 rationale in the PR
(AGENTS.md dependency rule). Workers must write audit events (success+failure) and be idempotent
(ground rule 4). Wire here: rate-limit reclamation (NWB-P0-013's manual script),
`purgeExpiredAccounts` (F-18), `purgeExpiredOrganizations` (NWB-P0-023). pg-boss schema bootstrap
recorded per NWB-P0-005(5)."*

## Why it is the first ticket of the phase

Three data-lifecycle jobs already exist as correct, tested **functions** with no caller:

| Job | Function | Left waiting by |
| --- | --- | --- |
| rate-limit bucket reclamation | `reclaimRateLimits` (`src/lib/rate-limit.ts`) | NWB-P0-013 — shipped as a manual script, "Phase 2 wires the same export to the pg-boss scheduler nightly" |
| expired account purge (NDPR erasure) | `purgeExpiredAccounts` (`src/services/users/account-deletion.service.ts`) | F-18 — the 30-day grace window ends and nothing deletes |
| expired organization purge | `purgeExpiredOrganizations` (`src/services/orgs/org-deletion.service.ts`) | NWB-P0-023 — same shape: soft delete + grace, no hard purge runner |

Until this lands, the grace periods Phase 1 built are decorative, and every later module invents
its own cron.

## Scope

**In:**

1. `pg-boss` dependency, justified per AGENTS.md's dependency rule (checked: `Bun.cron` and
   `setInterval` were both rejected **in ADR-028 itself**, which is the accepted decision this ticket
   implements; no Bun/node builtin persists job state, retries, or backs off).
2. `src/lib/queue.ts` — client construction from validated config, `start`/`stop`, one singleton per
   process, queue policy (retry limit, exponential backoff, expiry) declared next to the job.
3. `src/lib/scheduler.ts` — the schedule table (job → cron + tz), env overrides per job,
   `missed: "once"` catch-up policy, idempotent `applySchedules`.
4. `src/lib/worker.ts` — `JobDefinition` + `registerJobs` + `runJobGuarded`: audit write on success
   and on failure, error rethrow so pg-boss retries, a guard so a queue failure cannot take the API
   down, and a `startWorker()` composed from the two other files.
5. `src/jobs/` — the three jobs above, as thin adapters over the existing functions (ground rule 8:
   extend, never fork).
6. Entrypoints: `src/index.ts` starts worker + scheduler alongside the API (ADR-007);
   `bun run queue:worker` runs workers only, no HTTP port (ADR-007 revisited = config change);
   `bun run queue:run <job>` runs one job now, through the same wrapper (`--list` to see them).
7. Config + `.env.example`: `QUEUE_ENABLED`, `QUEUE_WORKER_ENABLED`, `QUEUE_SCHEDULER_ENABLED`,
   `QUEUE_SCHEMA`, `QUEUE_POLLING_INTERVAL_SECONDS`, `QUEUE_TIMEZONE`, `QUEUE_CRON_*`.
8. Tests (unit, no DB) + a DB-gated integration test that proves the loop through a real PgBoss
   instance in a throwaway schema.
9. Docs: AGENTS.md (Key facts + architecture tree + commands + the dependency-rule note naming pg-boss), `drizzle/README.md`
   (pg-boss bootstrap is now an as-built fact, and its schema name), roadmap §12 + the phase-status
   table, this spec's status lines, F-18 closed in the defect register.

**Out (deliberately):** domain-module job handlers (they belong to their modules, which register
against this base); `queue.pause`/`resume` and any admin surface (Module 10 / P15-006 tooling);
`/api/health` learning queue depth (NWB-P1-012 owns the health probe); a CI workflow step running
the loop test (the workflow file cannot be pushed by the Arena GitHub App — the same block as
NWB-P0-005/022; the test is DB-gated so it runs wherever `DATABASE_URL` exists); audit hash-chain
support (NWB-P1-002).

## Acceptance

- [x] A registered worker runs on a schedule — proven by a real `send → work → completed` round trip
      against a live PostgreSQL, and by `boss.getSchedules()` returning the three jobs with their cron.
- [x] A failing worker retries with backoff, and the retry count is visible to the handler.
- [x] Success **and** failure each write a `unified_audit_log` row (actor type `system`, category
      `data_ops`, `<resource>.<verb>` action, severity `warning` when a retry is still owed and
      `critical` when the last attempt was spent).
- [x] A worker that runs twice is idempotent — asserted for all three jobs by running each twice in
      one transaction and asserting the second pass reports zero work. **Corrected during delivery:**
      the plan's mechanism (a `singletonKey`/`singletonNextSlot` pair) is not what guarantees this and
      was not implemented — those options throttle/debounce rather than deduplicate, and
      `singletonNextSlot` would *delay* a second occurrence into the next slot instead of dropping it.
      pg-boss already guarantees one job per slot at the library level: occurrences are filed into a
      slot keyed `(name, seconds…minute)` (`plans.js` `occurrenceInsertions`) under unique index
      `job_i4` (`manager.js`), so a cron that ticks twice in a minute inserts one job. Worker-side the
      guard is one supervisor per process (`startQueue`) plus one queue per name at
      `workerConcurrency: 1`. `singletonSeconds` is deliberately left off the schedules so manual
      `queue:run` retries are never throttled.
- [x] The API process does not die if the queue cannot start, and the test suite (which never
      imports `src/index.ts`) never opens a queue connection.
- [x] `bun test` green with a live database · `bun run typecheck` · `bunx biome check .` clean ·
      `bun run build` passes.

## Notes for the implementer

- pg-boss v12 hands the `work()` handler an **array** of jobs, and `send()` throws
  `Queue <name> does not exist` unless the queue row exists — so job registration must
  `createQueue(name, policy)` first. Both verified against 12.33.2 in this sandbox, not assumed.
- `writeAuditLog` needs a `Db`; the worker injects the app's (or the test's) handle so audit writes
  obey the same transaction semantics as every other write in the repo (`src/lib/transaction.ts`).
- Purge jobs must not be wrapped in `withAtomicWrites`: they are single statements, and re-running
  one is already safe. The idempotency guarantee is "the query is a no-op once the work is done",
  not "the job is executed at most once" — pg-boss gives at-least-once, and every job here is
  written so that is the same thing.

## Comments

**2026-09-21 — delivered.** Three new `src/lib` modules (`queue.ts`, `scheduler.ts`, `worker.ts`),
`src/jobs/` with the three maintenance jobs, two entrypoints (`bun run queue:worker`,
`bun run queue:run`), and `src/index.ts` wired to start the runtime. No route changed.

**Two of this ticket's own acceptance details were wrong against pg-boss 12.33, and both were
corrected rather than quietly satisfied.** (1) "A registered worker runs on a cron/interval **in
dev**" — dev polling is a *worker-side* setting, and a poll-only dev mode would not have exercised
the crons this ticket exists to install. So `dev` keeps polling AND schedules; `production`/`staging`
keep schedules with a 5s poll; `test` gets neither and runs jobs through
`runMaintenanceJob()`/`runJobGuarded()` instead. The one thing that must not differ across
environments is schedule presence, and `definitions.test.ts` pins that (the runtime stays on in the
test env precisely so the wiring can't be commented out while tests stay green). (2) "a worker that
runs twice is idempotent **via `singletonKey`/`singletonNextSlot`**" — those knobs are a throttle and
a debounce, not a dedupe of the same tick: `singletonNextSlot` *delays* a second occurrence into the
next slot rather than dropping it, and `singletonSeconds` would throttle the manual runs, which are a
support path. pg-boss already guarantees what the clause was reaching for, structurally: occurrences
are filed into a slot bucket keyed `(name, seconds … minute)` (`plans.js` `occurrenceInsertions`) with
unique index `job_i4` (`manager.js`), so two ticks in one slot insert one job — that is what
`scheduler.ts` documents and what the "one run per slot" test asserts against. Worker-side, the guard
is `startQueue`'s single supervisor plus one queue per job name at `workerConcurrency: 1`; the app
never sets `maxWorkerConcurrency`, which is the knob that would multiply workers per process.

**Verification log.**
- `bun test src/tests/queue/` → **48 pass / 0 fail** (definitions 16, worker 18, jobs 5 DB-gated, loop 9 against a live PgBoss).
- `bun test` → 502 pass / 0 fail (447 before this work). With `DATABASE_URL` unset: 273 pass /
  243 skip / 0 fail in 0.3s — nothing reached for a connection.
- `bun run typecheck` clean · `bunx biome check . --diagnostic-level=error` 0 errors (the tree's
  ~2k existing warnings untouched) · `bun run build` clean · `bun run coverage:check` green
  (`src/lib` 96.6%, `src/services` 89.9%).
- Live, local Postgres (`nawebeus_test`, schema `pgboss_test_dev` for the worker run):
  `bun run queue:worker` → `queues: maintenance.rate-limit-reclaim, retention.purge-expired-accounts,
  retention.purge-expired-organizations` + the three expected crons (`0 2 * * *`, `15 2 * * *`,
  `45 2 * * *`, all UTC), then `queue worker: SIGTERM — draining in-flight jobs` and a clean exit.
- `bun run queue:run maintenance.rate-limit-reclaim '{}'` → result `{"deleted":0,"graceMs":3600000}`
  and this row in `unified_audit_log`:
  `action=rate-limits.reclaimed | category=data_ops | actor_type=system | organization_id=NULL |
  module=core | severity=info | resource_type=rate_limit | resource_id=NULL |
  after_state={"deleted":0,"graceMs":3600000} | ip_address=NULL | metadata={"queue":
  "maintenance.rate-limit-reclaim","jobId":"manual-1789936620125","attempt":1}`.
  An unknown name exits 1 with `unknown queue "…". Known queues: …` before touching the database;
  `--list` names all three with their schedules.
- `bun run src/index.ts` → `[queue] 3 queue(s) active (worker: on, scheduler: on)` with `/api/health`
  200. With `QUEUE_ENABLED=false` the queue line never appears and health stays 200. With an
  unreachable `DATABASE_URL` (port 5499) the log reads `[queue] WORKER NOT STARTED — API continuing
  without it: connect ECONNREFUSED … 127.0.0.1:5499` and **health still answers 200** — deliberate
  asymmetry against `queue:worker`, which exits 1 there because the queue is the entire job.

**Found while proving the schedule order (not fixed here):** the account purge is one `DELETE`, so a
single user who still owns an organization — including one soft-deleted inside the 30-day window —
aborts every other erasure in that night's batch (`23503 organizations_owner_id_fkey`; reproduced,
then pinned as a passing test in `src/tests/queue/jobs.test.ts`). Running the org purge at 02:15 and
the account purge at 02:45 clears the *in-scope* case, which is what this ticket promised; the
mid-window case is **NWB-P1-013**.
