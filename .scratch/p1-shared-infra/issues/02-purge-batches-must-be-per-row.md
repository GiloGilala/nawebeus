# NWB-P1-013 — Purge batches must delete per row (one org-owner FK aborts a night of erasures)

Type: task
Status: done (2026-09-21 — verified locally: typecheck + `bun run lint` exit 0 + build + **535/535** `bun test` with a live database, 289 pass / 260 skip / 0 fail without one, `coverage:check` green at 90.7% services / 96.7% lib)
Blocked by: — (NWB-P1-001 landed the scheduler that makes this visible; the defect predates it)
Phase: P1 (roadmap Phase 2) · found while delivering NWB-P1-001 on 2026-09-21

**Warning — this is not a "nice" cleanup.** It decides whether an NDPR erasure deadline is actually
met. The org-first schedule order shipped in NWB-P1-001 covers the common case; this ticket covers
what it cannot, and it should not be read as already fixed.

## Parent

`.scratch/p1-shared-infra/spec.md` — discovered during delivery, not in the roadmap's original P1
numbering. It is **013** rather than a free low number on purpose: NWB-P1-002 in the plan's own
numbering is the audit-log ticket, and colliding with it here would mis-file this against real work.

## Blocks

NWB-P1-010 (retention + legal holds: a hold check that has to skip rows needs per-row scope), and any
support workflow that answers "was this user erased on time".

## Question produced

Does a failed row belong to *this* run's audit record (report `{deleted: n, failed: m, errors: […]}`)
or to a dedicated dead-letter structure? Answer before coding: the audit `after_state` is the only
place this run records anything, and "deleted 0" is indistinguishable from "nothing to do" unless the
failure count travels with it. If the answer is dead-letter (it probably is — the plan already reserves
DLQ shape for NWB-P1-012's observability), that is a schema decision and needs its own ticket.

## Answer (2026-09-21, before coding)

**Failed rows belong to this run's audit record** — `after_state: { deleted, failed, errors }` —
not to a dead-letter structure. Three reasons:

1. A refused row is retried by the *next nightly run*, not by an operator reading a DLQ: the row
   is still expired, so the next run selects it again. A DLQ table would need its own lifecycle
   (when does an entry clear — when a later run succeeds?), which is a second source of truth for
   "was this user erased on time".
2. `after_state` already carries the run's counts; `{ deleted: 0, failed: 2 }` keeps "erased vs
   blocked" queryable per night with no join. If P1-012 wants repeated-failure alerting, it can
   aggregate `failed > 0` runs from the audit log — no new schema needed.
3. No migration. This ticket touches no DDL, so NWB-P0-005's "migrations from zero" criterion is
   untouched.

**Severity mechanism: the wrapper inspects the outcome.** `runJobGuarded` treats an outcome with a
numeric `failed > 0` as a partial run and writes `warning` instead of `info` (`isPartialRun` in
`src/lib/worker.ts`). Partiality is a property of *this run* — the same job is clean most nights —
so it is read off the outcome, not declared on the definition; jobs that never report `failed`
keep exactly the severity they always had.

**Correction measured while scoping:** the ticket text claims a membership edge
("`organizations_member_org_membership`") can abort an org batch. It cannot — verified against the
applied migration DDL, `organization_members_organization_id_organizations_id_fk` is `ON DELETE
cascade`, and every other FK to `organizations.id` in the active schema is CASCADE or SET NULL.
The org-side per-row isolation is still built (same helper, same shape): the aspirational billing
tables already declare `restrict` FKs to `organizations.id` (`invoices`, `payments`,
`transactions`), so the day they migrate is the day a batch DELETE would start wedging — and
NWB-P1-010's hold-skip needs per-row scope regardless. The org-side blocking test therefore uses a
temporary restrictive FK (transactional DDL, rolls back with the test) as a stand-in for that
future edge.

## Scope

**Files:**
- `src/services/users/account-deletion.service.ts` — `purgeExpiredAccounts`
- `src/services/orgs/org-deletion.service.ts` — `purgeExpiredOrganizations`
- `src/jobs/purge-expired-accounts.ts`, `src/jobs/purge-expired-organizations.ts` — what they report
- `src/tests/queue/jobs.test.ts` — a passing test asserting the wedge (it is written to survive this fix)
- Possibly a new migration, if the answer to the question above is a dead-letter table

**Build:**
- One candidate set, then one transaction per id. `purgeExpiredAccounts` today is a single
  `DELETE … WHERE deleted_at IS NOT NULL AND scheduled_deletion_at <= now() - grace AND id IN (batch)`
  — correct per batch, fragile per row. Loop the batch ids, each in its own savepoint/transaction, and
  collect `{ok: string[], failed: {id, error}[]}` so one rejected FK costs one user and not the night.
- Return the failure list from the service and carry it into the job's `JobOutcome`, so it lands in
  `unified_audit_log.after_state` — an operator reading the audit trail must be able to tell "nothing
  expired" from "everything failed".
- Keep `deleted` meaning *rows actually erased*, never "rows attempted".
- Same treatment for the org purge (`organizations.owner_id` is the same class of constraint from the
  other side; `organizations_member_org_membership` can also abort a batch).

**Don't:**
- Don't add a dead-letter table here unless the question above is answered that way — then file it
  separately and keep this ticket to "per-row + honest reporting".
- Don't change the schedule order or times; 02:00 reclaim → 02:15 orgs → 02:45 accounts is load-bearing
  and documented in `src/lib/scheduler.ts`.
- Don't swallow errors to make the job look green. The wrapper in `src/lib/worker.ts` rethrows on
  request so pg-boss retries; per-row failures are *not* a request failure — they are a partial result,
  and must be reported as one.

## Acceptance criteria

- [x] Two expired accounts, one of which still owns an organization: the other is deleted, the blocked
      one is reported as failed with its error. (`jobs.test.ts`: "one blocked account no longer
      wedges the batch".)
- [x] Same shape for the org purge with a blocking row — via a temporary restrictive FK, because the
      ticket's assumed membership edge turned out to be `ON DELETE cascade` (see Answer above).
      (`jobs.test.ts`: "the org purge isolates a blocked row the same way".)
- [x] `after_state` distinguishes `{deleted: 0}` from `{deleted: 0, failed: 2}`. (Partial-run audit
      test asserts exactly `{ deleted: 0, failed: 2 }` on the row.)
- [x] Re-running is still idempotent (the blocked row appears in `failed` twice, never in `deleted`).
- [x] Audit row for a partial run is `warning`, not `info`, when `failed > 0` — wrapper inspects the
      outcome (`isPartialRun`; see Answer above). Unit-pinned in `worker.test.ts`, integration-pinned
      in `jobs.test.ts`.
- [x] `bun test`, `bun run typecheck`, `bun run build`, `bun run coverage:check` green; the
      `jobs.test.ts` wedge assertions that pinned the old behaviour rewritten in the same commit —
      plus `org-deletion.test.ts`'s negative control, which also pinned throw-on-23503 and now pins
      report-on-23503.

## Evidence of the defect (2026-09-21)

Reproduced in `src/tests/queue/jobs.test.ts` inside one transaction:
- Setup: an expired account whose user owns a soft-deleted organization still present in
  `organizations`; plus a second, unrelated expired account in the same batch window.
- `purgeExpiredAccounts(db, { graceMs: 0 })` throws `23503 … organizations_owner_id_fkey`, and
  **both** accounts are still there afterwards — PostgreSQL aborts the whole `DELETE`, so the healthy
  row is collateral damage.
- Running the org purge first clears the org, after which the account purge deletes both
  (`{deleted: 2}`) and a re-run deletes nothing (`{deleted: 0}`). That ordering is why the schedules are
  02:15 before 02:45; it does not help a user whose org is soft-deleted *within* the same grace window,
  which is the case this ticket exists for.

## Comments

**2026-09-21 — delivered.** Shape decided as `{ deleted, failed, errors }` (`failed` duplicates
`errors.length` so the count stays a scalar in `after_state` and the wrapper's check stays a number
comparison). One shared helper (`deleteRowsPerRow` in `src/lib/transaction.ts`) serves both purges,
so the savepoint handling cannot drift between them; candidates run oldest-erasure-first so a cut-short
night still lands the rows closest to their NDPR deadline. A row that vanishes between SELECT and
DELETE (a concurrent run got there first) counts as neither deleted nor failed — the run that erased
it already claimed it. No migration (see Answer §3); schedule order and times untouched.

Verification beyond the gates: the `ROLLBACK TO SAVEPOINT` line was temporarily removed and all
three purge tests failed red with `25P02` (transaction aborted) — the savepoint is load-bearing and
the tests prove it — then restored, green again. Suite: 531 → 535 pass (4 new: org stand-in-FK
isolation, partial-run audit row, 2 wrapper-convention units); no-DB run 289 pass / 260 skip / 0 fail.
(The 23-vs-20 test-count wobble in `org-deletion.test.ts` between no-DB and with-DB runs was checked
against the pristine tree and is pre-existing, not from this ticket.)

Unblocks NWB-P1-010's per-row hold check as filed. Feeds NWB-P1-015 one thing to know: `errors`
carries the ids of rows that were *not* erased, so it is operational data about living subjects, not
erasure residue — the anonymizer must still scrub any purged-subject ids that reach the jsonb columns
through other paths.
