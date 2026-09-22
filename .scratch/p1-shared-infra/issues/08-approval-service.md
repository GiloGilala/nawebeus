# NWB-P1-003 — Approval service (request / approve / reject / request-changes / recall / expire-stale)

Type: task
Status: done (2026-09-22 — filed and delivered the same day; re-measured after the 2026-09-21 draft was lost with the `issues/06` slot; 4 scope questions answered by operator before filing, all four took the recommendation)
Blocked by: NWB-P1-001 ✅ (the queue base the expiry job rides on), NWB-P1-002 ✅ (the registry the actions join)
Phase: P1 (roadmap Phase 2)
Size: L

## Why this exists

The shared approval workflow gates four downstream phases — P3 publishing (D12 B/C), P7 engagement
responses, P8 press releases, P9 influencer submissions — and the execution plan's exit gate for
this phase says "the approval queue works end to end". Today:

- `approval_requests` + `approval_history` are **active** (`db/shared/approval.ts`, in migration
  0000, re-exported by `db/schema.ts`) and used by nothing: `grep -rn approval src/` finds one
  comment in `src/lib/queue.ts` naming this ticket.
- The three enums exist and are complete for the request side (`approval_request_status`,
  `approvable_entity_type`); the history side is not — see drift (2) below.
- No `approvals.*` permission exists; "content approval" is `posts.publish` (seed matrix,
  manager+).

## Measured (2026-09-22)

1. **Every id column in both tables is `varchar(32)`** — `approval_requests.id, organization_id,
   entity_id, requester_id, current_approver_id, escalated_to_id` and `approval_history.id,
   approval_request_id, actor_id` — while `users.id` and `organizations.id` are `uuid` (36 chars
   hyphenated). A real user id does not fit; the first insert would 22001. Same ground-rule-7
   drift class NWB-P1-010 fixed on `legal_holds` (→ varchar 64, mirroring `auditLog.actorId`).
2. **`approval_action` has no `expired` value** (submitted, approved, rejected, changes_requested,
   recalled, escalated, delegated, reminder_sent). `approval_request_status` *does* have
   `expired`. So the model's own "append-only log of every action taken" cannot record an expiry.
3. **The DB CHECKs decide the state machine's shape:** `chk_apr_pending_has_approver` (pending ⇒
   `current_approver_id` NOT NULL), `chk_apr_terminal_no_approver` and
   `chk_apr_completed_at_terminal` name exactly `approved, rejected, expired, recalled` as
   terminal — `changes_requested` and `escalated` are unconstrained either way, and
   `chk_aph_rejection_comment` / `chk_aph_changes_requested_comment` make the comment mandatory at
   the database.
4. **The model's role-based step** (`userId: null` — "currentApproverId is set to the first admin
   who views the request") needs a claim operation that exists nowhere, and the CHECK in (3)
   forbids a pending row without an approver, so the role step cannot be stored unresolved.
5. **Parallel groups have one `current_approver_id` column and one index** on it; "everything
   pending my approval" for a member of a parallel group who is not the primary must consult the
   chain JSONB (`approval_chain @> [{order, userId}]`). Fine at P1 scale; a GIN index is the
   day-two fix.
6. **No FK from `approval_requests.organization_id` to `organizations`** (by design: "approval
   record must survive entity deletion"). Consequence: an org purge orphans its approval rows;
   NWB-P1-010's `tables` roll-up is where an enforcer would join. Recorded, not built.
7. **Seed converges the role matrix on re-run** (`src/seed.ts`: missing grants are added, grants
   outside the matrix are deleted), so new permission strings map onto existing roles without a
   migration. CI runs `seed` before `bun test`.
8. **`Actions` in `src/services/auth/ability.ts` is `create|read|update|delete|manage`** while
   the seed already grants `posts.publish` and `analytics.export` — the type already under-describes
   the catalog; `decide` widens it, `apiKeyAbility`'s level filter is unaffected (`write` keys keep
   `read/create/update`, so deciding via API key needs an `admin`-level key — correct).

## Decisions (2026-09-22, operator answered before coding)

**1. Approver model: named users + role tiers, resolved at request time (Q1).** A step naming a
user must be an *active* member of the organization with role level ≥ manager (60) and ≥ the
step's tier (`manager` 60 / `admin` 80 / `owner` 90). A role-tier step (`userId: null`) expands
at request time into one parallel step per eligible active member (level ≥ tier) at that order,
so the stored chain is always user-resolved and the CHECK in measured (3) is satisfied with no
sentinel. An expansion that resolves to nobody is a 422 (routing must reach approvers in 100% of
cases — FR-PUB-003 AC1 — so refusing at submit beats a dangling request). **No self-approval:** a
named requester is a 422; a role expansion silently excludes the requester and 422s if nothing is
left. Orders are normalised to `1..N` (sorted distinct input orders → step numbers) so
`current_step` equals the stored `order`. Duplicate users within one order are collapsed. The
claim model and delegation stay unbuilt (UI-driven semantics; residual).

**2. Chain semantics: AC7 strict (Q2).** Sequential = every order must pass; a parallel group is
satisfied by any one member's approval (FR-PUB-003: "any one approval sufficient"). `approve` on
a non-final step advances `current_step` and re-points `current_approver_id` at the next step's
first member; on the final step it closes the request `approved`. `reject` and
`request-changes` close the request (`rejected` / `changes_requested`, `completed_at`, approver
NULL) — a resubmission is a **new** request (the model's immutable `content_snapshot` rule).
**Recall** is the requester's, only while pending **and before the first approval action** (no
`approved` history row) — spec AC7 verbatim; afterwards it is 409. Every decision is an optimistic
update `… WHERE id = $1 AND version = $2` (0 rows ⇒ 409 `APPROVAL_VERSION_CONFLICT`), inside
`withAtomicWrites` with the row `SELECT … FOR UPDATE` first, so two approvers on one parallel
group cannot both "advance". One open (pending) request per `(organization, entityType,
entityId)` — a second is 409 `APPROVAL_ALREADY_PENDING`.

**3. Expiry: direct, hourly, with the enum fixed (Q3).** Job `approvals.expire-stale` at
`0 * * * *` (`QUEUE_CRON_APPROVALS_EXPIRE_STALE` override, `missed: "once"`): every `pending`
request with `expires_at <= now()` becomes `expired` (terminal, `completed_at`, approver NULL)
with an `expired` history row (`actor_id = 'system'`) — per row in its own savepoint so one bad
row cannot hold the hour's batch, reporting `{ expired, failed, errors }` (`failed` feeds the
wrapper's partial-run `warning`). Default window **7 days** (`APPROVAL_DEFAULT_EXPIRY_DAYS`);
per-request override between 1 hour and 30 days; an explicit `null` means never. Escalation
(`escalated` status/action, `escalated_to_id`) stays dormant until NWB-P1-008 can notify
someone — an escalation nobody hears is an expiry with a misleading label. Migration **0004**
adds `expired` to `approval_action` and widens the nine id columns of measured (1) to
`varchar(64)`.

**4. Permissions + routes: a new `approvals.*` family (Q4).** `approvals.read`,
`approvals.create`, `approvals.decide`; owner/admin/manager hold all three, creator holds
read + create, analyst/viewer hold read. Two gates, both required: the permission gets you to the
endpoint, the **row** decides — only a member of the *current* step may approve / reject /
request changes, only the requester may recall. Routes under `/api/approvals` (organization from
the JWT; no `:orgId`): `POST /approvals`, `GET /approvals?view=inbox|mine|all`,
`GET /approvals/:id` (with history), `POST /approvals/:id/{approve,reject,request-changes,recall}`.
`view=all` needs `decide`; the detail is visible to the requester, chain members, and holders of
`decide` — anyone else gets 404, not 403 (existence is not confirmed). No admin override in P1
(BR-EH-04's audited bypass is a residual).

**5. Audit: one registry action per transition, module from the entity type.** `approvals.requested`,
`approvals.approved`, `approvals.rejected`, `approvals.changes_requested`, `approvals.recalled`
(category `content`, resource `approval_request`), and the job's `approvals.expired` (aggregate).
Module is `publishing` / `pr` / `engagement` by entity type, so a module filter on `GET /api/audit`
finds them where the domain expects — none of the three is a sealed module, so no chain cost.
`approval_history` remains the per-request timeline; audit rows are the org-level trail.

**6. Snapshot is caller-supplied and opaque.** No entity table exists yet, so the service cannot
look anything up: `contentSnapshot` (non-empty object) and `entityVersion ≥ 1` are required
inputs, `entityId` is an opaque 1–64 char id. P3/P7/P8 call the service directly with their rows;
the HTTP `POST /approvals` exists so the exit gate can be shown over the wire.

## Scope

Do:
- Migration 0004 (`db:generate`, reviewed): nine `varchar(32)` → `varchar(64)`, `approval_action`
  + `expired`.
- `src/services/approvals/approval.service.ts` — request, approve, reject, requestChanges,
  recall, expireStaleApprovals, getApprovalRequest, listApprovalRequests; chain validation +
  resolution; `ApprovalStateError` (409) in `src/lib/errors.ts`.
- Routes `src/server/api/approvals/` mounted in `src/server/index.ts`; `Actions` gains `decide`.
- Seed: three permissions + matrix; `src/tests/seed.test.ts` pins.
- Job `src/jobs/approvals-expire-stale.ts` + queue/scheduler/config/`.env.example` wiring; the
  job set becomes seven with verification still last.
- Registry: six actions.
- Tests: chain-resolution matrix, sequential + parallel walks, terminal transitions, AC7 recall,
  version conflict, duplicate pending, cross-tenant isolation, visibility, pagination, expiry
  (idempotent, per-row isolated, decided rows untouched), route layer (401/403/422/201/200),
  job registration/order/`queue:run`, 0004 hermeticity via `ensureMigrationApplied`.
- AGENTS.md + spec-table refresh.

Don't:
- Don't build claim/delegate/escalate/reminders/urgent-bypass/admin-override (residuals, named).
- Don't add entity tables, denormalised `currentApprovalRequestId` mirrors, or notifications.
- Don't touch the nightly schedule; the hourly job is independent of the 02:00 chain.
- Don't delete approval rows anywhere (retention of orphaned rows is a P1-010 follow-up).

## Acceptance

- [x] A creator's request with a named manager and a role-tier `admin` step walks approve →
      approve → `approved`; the stored chain is user-resolved; history has submitted + 2 approved.
- [x] Parallel group: one member's approval advances the step; the other member's later
      approve is 403/409, never a second advance. Proven with `FOR UPDATE` + version pin.
- [x] Reject / request-changes close the request and require a comment (422 before the DB
      CHECK ever fires); recall works before the first approval and is 409 after.
- [x] Under-ranked, non-member, requester-named and empty-expansion chains are 422 with the
      offending field named; cross-tenant ids are 404; a stale `version` is 409.
- [x] Expiry: planted past-window pending rows flip to `expired` with an `expired` history row;
      a second run is a no-op; decided rows are untouched; the job is registered, scheduled,
      env-overridable, runnable via `queue:run`, and verification is still last.
- [x] Routes: 401 unauthenticated, viewer cannot request (403), creator cannot decide (403) or see
      `view=all` (**422** naming `view` — it is a bad query parameter for that caller, not a
      forbidden resource; see comment), manager approves over HTTP, second page reachable through
      the cursor.
- [x] Migration 0004 is generate-clean, migrate-twice idempotent, push-convergent; tests execute
      it in-transaction via the shared helper.
- [x] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `biome`, `build`, `coverage:check`.

## Notes

- `approval_history.actor_id` carries the literal `system` for worker rows, per the model; the
  column has no FK so this is representable, and `writeAuditLog` is *not* used for per-request
  history (the table is the timeline; audit is the org-level trail).
- The inbox predicate is `status = 'pending' AND approval_chain @> jsonb_build_array(
  jsonb_build_object('order', current_step, 'userId', $me))` — correct for parallel members the
  single `current_approver_id` column cannot name; add a GIN index when the queue grows.

## Comments

**2026-09-22 — delivered.** Everything in the Do-list landed in one commit on
`arena/01a0c86e-nawebeus`; the details that differ from, or sharpen, the decisions above:

- **Migration is `0004_approval_ids_expired_action_pending_unique.sql`** (11 statements): the
  `expired` enum value, the nine `varchar(64)` widenings, and — added while writing the service,
  not in the original Do-list — the partial unique index `uq_apr_pending_per_entity` on
  `(organization_id, entity_type, entity_id) WHERE status = 'pending'`. Decision 4's
  "one pending per entity" had been specified as a pre-check; a pre-check under two concurrent
  submits admits both, so the index is the arbiter and the service maps its 23505 to
  `APPROVAL_ALREADY_PENDING`. Generate-clean afterwards (`No schema changes`), migrate-twice
  idempotent from zero (ledger 5), `db:push` proposes only its usual `DROP/CREATE INDEX IF NOT
  EXISTS` churn for `desc`/partial indexes (78 statements, none touching columns, enums or
  constraints — the known drizzle-kit quirk, not a divergence).
- **Timestamps are written as `clock_timestamp()`**, not the column default. `now()` is the
  transaction start, so a request and its decision in one transaction (the test harness, or a
  future submit-and-auto-approve) tie on `created_at` and the `(created_at, id)` list order
  falls through to the random id. Found by the first run of the list test; the comment above
  `requestId()` in the service records it. Consequence for tests that plant "stale" rows: the
  table's `chk_apr_expires_after_created` means `created_at` has to be backdated alongside
  `expires_at`.
- **`?view=all` without `approvals.decide` is 422, not 403.** `requireAbility("read")` already
  admitted the caller to the collection; what is wrong is the value of one query parameter for
  that caller, so it is reported the way every other bad query parameter is, with `field: view`.
  Recall lives behind `approvals.create` + the requester check (403 for a decider who is not the
  requester), exactly as decided.
- **`isParallel` is derived, never trusted:** a step group with more than one member is parallel
  (any one member), a group of one is sequential. The input field is accepted for compatibility
  with the model's shape and otherwise ignored — two callers disagreeing about the flag on the
  same group cannot produce a request nobody can complete.
- **Job:** `approvals.expire-stale`, `0 * * * *`, `QUEUE_CRON_APPROVALS_EXPIRE_STALE`, second in
  `QUEUE_JOB_NAMES` (outside the nightly chain; `definitions.test.ts` pins the cron, the slot and
  the audit descriptor). Returns `{ expired, failed, errors, ids }` — `ids` capped at 100 so the
  run's `after_state` stays bounded. The per-request evidence is the `approval_history` row
  (`actor_id = 'system'`), the audit row summarises the hour.
- **Tests:** `src/tests/approvals/approval.service.test.ts` (16) and
  `approval.route.test.ts` (5, incl. the job through `runJobGuarded` and the real audit sink);
  seed pins for the three permissions; queue pin for the seventh job. Suite: **604/604** with
  `DATABASE_URL`, 302 pass / 323 skip without (`.env` moved aside — Bun auto-loads it, so
  `env -u` alone does not produce the no-DB mode; an *empty* `DATABASE_URL=` is a third state
  the existing no-DB describes do not handle either, pre-existing and not this ticket's).
- **Gates:** `typecheck` clean, `bun run lint` 0 errors (548 warnings, as before), `build` clean,
  `coverage:check` **92.9% services / 97.1% lib** (the service file itself 97.1%, the route file
  97.2%, the job 100%).
- **Residuals (unchanged from Decisions, on the record):** admin override (BR-EH-04),
  claim/delegate/escalate, reminders, notifications on every transition (P1-008 — the audit
  rows carry the module and entity so a notifier can subscribe), a GIN index on
  `approval_chain` once inboxes are measured, approval rows orphaned by an organization purge
  (P1-010's `tables` roll-up is where an enforcer joins), PII in comments (retention policy
  needed before the DSAR export can include them).
