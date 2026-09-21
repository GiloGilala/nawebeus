# NWB-P1-013 — Purge batches must delete per row (one org-owner FK aborts a night of erasures)

Type: task
Status: ready-for-agent
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

- [ ] Two expired accounts, one of which still owns an organization: the other is deleted, the blocked
      one is reported as failed with its error. (Today: `23503 organizations_owner_id_fkey`, and the
      unblocked account survives too — that is the bug, and `src/tests/queue/jobs.test.ts` currently
      proves it by asserting it.)
- [ ] Same shape for the org purge with a blocking membership row.
- [ ] `after_state` distinguishes `{deleted: 0}` from `{deleted: 0, failed: 2}`.
- [ ] Re-running is still idempotent (the blocked row appears in `failed` twice, never in `deleted`).
- [ ] Audit row for a partial run is `warning`, not `info`, when `failed.length > 0` — decide whether
      that means `JobOutcome` carries a "partial" signal or the wrapper inspects the outcome; either
      way a night that erased nothing must not look like a clean night.
- [ ] `bun test`, `bun run typecheck`, `bun run build`, `bun run coverage:check` green; the two
      `jobs.test.ts` assertions that pinned the old behaviour updated in the same commit.

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
