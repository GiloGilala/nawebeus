# NWB-P1-010 — Retention worker + legal holds + backup records

Type: task
Status: done (2026-09-22 — merged in PR #17 as `657e2b7`; re-verified at `main` 4645d03 on 2026-09-22: typecheck + build + **582/582** `bun test` with a live PostgreSQL 14.23, `coverage:check` green at 92.3% services / 97.0% lib. `bun run lint` was **red** at that head — one formatting error in `src/services/audit/actions.ts` shipped with the commit and failed CI run 35710191299's Lint step; fixed in the close-out, see Comments)
Blocked by: NWB-P1-001 ✅ (the queue base the sixth job rides on)
Phase: P1 (roadmap Phase 2)
Size: M

## Why this exists

Three gaps, all measured, none theoretical:

**1. The §9.4 schedule has no enforcer.** `data_export_requests` keeps the whole DSAR PII
package in `payload` jsonb past `expires_at`, and nothing deletes it — `getDataExport`'s 410
comment even claims the package "was deleted on schedule", which is false today. Expired
`sessions` and `tokens` of live users accumulate forever (expiry is read-time enforced, so this
is hygiene + compliance evidence, not a live risk — but §5.3 gives session data a 1-year life
and nothing implements it). Both tables cascade on account purge, so the gap is exactly
live-user dead weight.

**2. Holds don't exist, but every seam points here.** `anonymize.ts` ("the hold check goes here
(service, not job)"), `invitation.service.ts` ("the hold seam is this service"), the org purge
("legal-hold skip needs per-row scope"). The enums shipped in 0000
(`legal_hold_data_type`, `legal_hold_status`); no table did. A litigated erasure today runs to
completion.

**3. Backup tracking is vocabulary without storage.** `backup_status`/`backup_type` enums exist,
used by nothing. §9.4's "Backup files | 30 days | Automatic overwrite" has no record of what
was backed up, when, or whether its window elapsed.

This is deliberately NOT the whole §9.4 table: mentions/articles/messages/analytics/invoices/
press rows belong to aspirational domains (their worker is a later ticket with aggregate-
verification it doesn't have yet), login-attempt records have no table (unimplementable as
stated), and export files are files, not rows.

## Decisions (2026-09-22, before coding)

Four scope questions went to the operator with measured options; all four took the
recommendation. The rest are engineering, settled here.

**1. Worker scope: DSAR packages + sessions + tokens (operator Q1).** The three active-schema
gaps, nothing aspirational. The P1-015 §8 `api_keys.name` residual stays out (middle option
taken — the surviving-key row is deliberate per the registry, and scrubbing it is a
purge-completeness ticket of its own). Analytics raw purge stays out: "keep aggregate" needs
aggregate-existence verification first.

**2. Audit retention is structural, plus a census (operator Q2).** Security Architecture §9.4
says audit rows see "No deletion (legally required)", so the worker never deletes audit rows —
retention is enforced by the append-only trigger + chain-verify (middle-delete) + a new
nightly per-module row census (tail-delete/TRUNCATE, the one thing neither sees). The census
compares against the previous run's own audited counts (no new table; first run bootstraps
silently). Any decrease writes a service-level `critical` row
(`retention.census.decrease_detected`, compliance/`audit_log`) — detection, not prevention.

**3. Holds: one user XOR one org, subject-wide (operator Q3).** A hold targets a user or an
org, never both/neither (DB CHECK), never global (rejected — a global switch stops every NDPR
clock). Blocking is subject-wide regardless of `data_type` (descriptive: what the matter
concerns): user holds block account purge, that user's invitee-side invite expiry (by
`user_id`, plus `invited_email`-matches-user-email for legacy rows), and that user's DSAR/
session/token retention deletes; org holds block org purge and in-org invite expiry. A hold
means "preserve everything about X" — the DSAR package of a held user is held evidence, even
though the roadmap names only purge workers. Mechanism is uniform: per-row hooks that throw
`LegalHoldError`, so the hold-hit lands in `errors` + `failed` (the night reads `warning` —
erasure deferred is erasure outstanding, and the NDPR-vs-hold tension must be visible, not
silent) with a top-level required `held` count for machine readability (required like
`auditAnonymized` — existing exact pins updated, the P1-015 precedent). `reason` is required
(a hold without a matter is a freeze without accountability); `placed_by` is recorded but
authorization defers to the future route layer (same posture as the purge services today).

**4. Backups: track runs, expire file-status (operator Q4).** The model comment already says
"Does NOT perform backups — tracks them". Service records a run (`pending`), completes/fails
it, and the worker flips past-window `completed`/`verified` rows to `expired` — the *file's*
status, eligible for infra overwrite; records are never deleted (evidence). Retention is
per-record `retentionDays`, default 30, clamped 30–90 per §9.4 — recorded divergence from the
model comment's per-type windows (90/30/60), which stay dormant: the policy table governs,
not the unmigrated comment. Entry is service call (script/console); no routes.

**5. Adoption, not invention — with two recorded divergences.** `legal_holds` and
`backup_records` are adopted from `db/compliance/` (the reviewed shape) into the active
schema via `db:generate`, not rewritten: (a) the target check tightens from the model's
"at least one" OR to XOR (both-set would be a third semantic nobody asked for); (b) UUID-
holding varchar columns widen 32→64, mirroring `auditLog.actorId` — a hyphenated UUID is 36
chars and would not fit (ground-rule-7 drift fix). The two enums the models need that 0000
lacks (`legal_hold_priority`, `backup_restore_status`) are created by the migration.
`dataRetentionPolicies` is NOT adopted: periods live as code constants (the
`LAPSED_INVITE_GRACE_DAYS` precedent) and the policies table is the documented future seam
for the configurable §9.4 rows.

**6. Worker-level holds, one job, roll-up outcome.** The roadmap says holds block purge
*workers* — no DB trigger (a trigger would also block operator remediation; worker-level
keeps release-then-purge operable). One job, `retention.enforce`, at `55 2 * * *` (after the
purges, before verify-stays-last — its audit rows join the walked set), with the standard
`QUEUE_CRON_*` override. Outcome is `{ deleted, failed, errors, held, tables, census }` —
top-level sums preserve `isPartialRun` untouched; `tables`/`census` carry per-table evidence.
`held` is required on `PerRowDeleteResult` (shape-stability, like `auditAnonymized`).
No `auditAnonymized` key — the worker scrubs nothing (the org-purge precedent).

**7. Predicates are clock-ruled; `status` is advisory.** DSAR: `expires_at <= now()` (the 7-day
window IS the retention). Sessions: dead (`expires_at <= now()` OR `is_revoked`) AND stale
(`COALESCE(last_activity_at, created_at) <= now() - 1 year`, §5.3). Tokens: (`expires_at <=
now() - 30d`) OR (`used_at <= now() - 30d`) — consumed single-purpose secrets die 30 days
after use even with a far-future expiry. Status columns may lie (nothing flips them); clocks
don't. NULL `expires_at` fails closed toward retention.

**8. No routes (phase consistency).** Holds and backup recording enter via service call +
`queue:run`, like the purges. Routes with super_admin checks are a later phase's seam,
documented, not built.

## Scope

Do:
- Migration 0003 (`db:generate` from adopted models, reviewed SQL): `legal_holds` +
  `backup_records` + 2 enums; granular `db/schema.ts` re-exports (the other four compliance
  tables stay dormant); tsconfig exclusion narrowed, not removed.
- `src/services/retention/`: `legal-holds.service.ts` (place/release/check + `LegalHoldError`),
  `retention.service.ts` (3 enforcers + census), `backups.service.ts` (record/complete/expire).
- Hold hooks in all three purge paths (account seam, org `beforeDelete`, invite `beforeDelete`
  + retention hooks); required `PerRowDeleteResult.held` + `LegalHoldError` counting in
  `deleteRowsPerRow`.
- Registry actions: `retention.enforced` (job, compliance), `retention.census.decrease_detected`
  (critical), `legal-holds.placed`/`legal-holds.released`, `backups.recorded`.
- Job + queue/scheduler/config/`.env.example` wiring; order-pin extension (verify still last).
- Tests: retention liveness matrix, census (decrease/increase/bootstrap), hold
  matrix (user/org × account/org/invite/retention + release/expiry), backup lifecycle,
  blocker-free per-row isolation where it matters, 0003 in-tx hermeticity via the shared
  helper pattern, job shape + idempotency.
- AGENTS.md + spec-table refresh (014/015/016 done, 010 claimed, stale 06-link fixed).

Don't:
- Don't delete audit rows, ever — census detects, nothing removes.
- Don't adopt `dataRetentionPolicies`, `impersonation_sessions`, `dsar_requests`, `app_config`.
- Don't build routes, a global freeze, per-type backup windows, or analytics purge.
- Don't touch the shipped schedules (the 55 slot fills the accounts→verify gap; nothing moves).
- Don't "fix" the 410 comment by deleting it — the worker makes it true.

## Acceptance

- [x] Past-window DSAR packages, dead+stale sessions, and expired/consumed+aged tokens are
      gone after the job; every live/kept row is byte-identical. Proven by a liveness matrix,
      not by row counts alone.
- [x] The census alarms exactly on decrease (critical row, compliance), stays silent on
      increase, and bootstraps without alarm. Proven by test with planted counts.
- [x] An active hold blocks its subject's rows in all three purges and the retention deletes;
      released/expired holds block nothing; hold-hits report in `errors` + `held`, and the
      run reads `warning`. Proven by a hold matrix, both target kinds.
- [x] Backup lifecycle: record → complete/fail → past-window `expired`; records are never
      deleted. Proven by test.
- [x] Migration 0003 is generate-clean, migrate-twice idempotent, and push-convergent; tests
      execute it in-transaction (no suite depends on ambient tables).
- [x] The sixth job is registered, scheduled, env-overridable, and runnable via `queue:run`;
      verify is still last and the pin says so.
- [x] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `biome`, `build`, `coverage:check`.

## Notes

- The XOR-vs-OR and varchar-64 divergences are the only model edits; everything else in the
  two adopted tables is verbatim, so a future wholesale compliance adoption reconciles cleanly.
- Census baseline lives in the job's own prior audit row (`after_state.counts`), not a table —
  self-referential by design; a restored/seeded DB simply re-bootstraps.
- `legal_hold_data_type` blocking is subject-wide by decision §3 even for `audit_logs`-typed
  holds (nothing deletes audit rows, so the type is descriptive there too).
- Login-attempt records (§9.4 90d) and export files (24h) remain unenforced: no table / not
  rows. If either gains storage, its enforcer joins this worker — the `tables` roll-up is
  built for that.

## Comments

**2026-09-22 — close-out (bookkeeping only; the code landed in PR #17 as `657e2b7`).** The
ticket was merged with its `Status:` still reading `claimed` while `spec.md` already said done;
this entry reconciles the two and records what the merge actually left behind.

- **Delivered as decided.** Migration `0003` (`legal_holds` XOR target + `backup_records`, the two
  enums, varchar-64 ids), `src/services/retention/` (`legal-holds`, `retention`, `backups`), hold
  hooks on all four purge paths (account, org, invite expiry, retention enforcers) via
  `LegalHoldError` (423) counted into the required `held` on `PerRowDeleteResult`, the sixth job
  `retention.enforce` at `55 2 * * *` (+ `QUEUE_CRON_RETENTION_ENFORCE`), the census with its
  self-referential baseline, and the five registry actions. `src/tests/retention/` carries the
  liveness matrix, the hold matrix and the backup lifecycle (979 lines, 19 tests).
- **Gates, re-run at `main` 4645d03 on a fresh embedded PostgreSQL 14.23** (migrate ×2 from zero
  → ledger 4, `seed`, then): `bun test` **582/582**, `typecheck` clean, `build` clean,
  `coverage:check` green at **92.3% services / 97.0% lib**.
- **Found at close-out: `main` was red.** `bun run lint` (`biome check .`) reported **1 error** —
  the `backups.recorded` description line in `src/services/audit/actions.ts` exceeded the print
  width, so the commit's "lint (0 errors)" claim did not hold, and CI run 35710191299 on the merge
  commit failed its Lint step (the test job was skipped as a consequence). Same class as
  NWB-P0-027 and the reason NWB-P0-022 (branch protection) still matters: a red check does not
  block a merge. Fixed by `biome format --write` on that one file in the P1-003 branch; `bun run
  lint` exits 0 again (548 warnings, 0 errors).
- **AGENTS.md was not refreshed by the commit** although this ticket's Do-list called for it:
  the tree lacked `src/services/retention/` and `src/jobs/retention-enforce.ts`, the nightly-order
  key fact still read "reclamation → organizations → accounts → verification" (missing the
  invitations slot from P1-016 *and* this ticket's retention slot), the coverage line quoted
  P1-015's numbers, and the F-18 paragraph still said neither purge was scheduled. All refreshed
  in the same close-out commit, plus a key-fact bullet for legal holds / retention.
- **Residuals carried, not lost:** `api_keys.name` after purge (decision §1, its own ticket);
  analytics raw purge (needs aggregate verification); login-attempt records and export files
  (no table / not rows); routes for holds and backup recording (later phase, super_admin);
  `approval_requests`/`approval_history` are FK-less to `organizations`, so an org purge orphans
  its approval rows — NWB-P1-003 notes it, and the `tables` roll-up is where an enforcer joins.
