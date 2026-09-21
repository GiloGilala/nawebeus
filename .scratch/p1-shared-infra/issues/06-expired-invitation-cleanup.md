# NWB-P1-016 — Expire lapsed invitations: delete the member row, scrub the audit email

Type: task
Status: done (2026-09-22 — typecheck + `bun run lint` exit 0 + build + **562/562** `bun test` with a live database, 294 pass / 283 skip / 0 fail without one, `coverage:check` green at 91.5% services / 97.0% lib)
Blocked by: NWB-P1-015 ✅ (the scrub machinery this reuses: flag dance, value gate, per-row hook)
Phase: P1 (roadmap Phase 2) · split out of NWB-P1-015's residuals on 2026-09-21
Size: S–M

## Why this exists

Never-joined invitees have no purge event at all: no user row, so `purgeExpiredAccounts` never
reaches them — yet the system holds their address in two places, forever. The invited member row
(`organization_members`: `invited_email`, token material, display/job/department/note) sits at
`status='invited'` with a long-dead `expires_at`, and the inviter's `organization.member.invited`
audit row keeps `afterState.email`. Accept and preview both refuse expired invites, so the member
row has no function left; it is retained PII with no basis, and the audit copy is the exact leak
NWB-P1-015 closed for erased subjects but could not reach without one.

This is deliberately NOT NWB-P1-010 (retention + legal holds + backup records — the 7-year audit
worker and the hold mechanism). It is the bounded, decidable slice: lapsed invites have a TTL, a
visible grace need, and a precise audit footprint, so nothing here needs the general retention
policy to exist first.

## Decisions (2026-09-21, before coding)

**1. Disposition: hard DELETE at expires_at + 30 days, not soft-delete.** `listMembers` shows
invited rows (no status filter), so a post-expiry grace has real UX value — admins see lapsed
invites for one cycle before they vanish. 30 days matches the codebase's standard grace idiom
(account/org deletion). Soft-delete would retain `invited_email` and fail the purpose; the audit
row is the durable record of the invite having happened, which is why the member row may go.
Candidates: `status='invited' AND deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <=
now() - grace`, oldest-lapsed-first (mirrors oldest-erasure-first). Accepted rows are excluded by
the status predicate even though accept leaves `expires_at` set; NULL-`expires_at` rows are
excluded because lapse is unprovable for them.

**2. Re-invite after cleanup is a fresh insert, and that is compatible.** `inviteMember`'s dedup
finds pending rows and refreshes them; a cleaned row is simply absent, so the insert path runs.
Pinned by test, not assumed.

**3. The audit scrub is resource-scoped, not email-blasted.** The invite writer sets
`resource_type='member', resource_id=<memberId>` on its audit row, and `memberId` is PK-unique —
so the scrub matches that identity first and the email value second. A whole-table email match
would eat the address from OTHER orgs' still-pending invite rows for the same address; the
resource scope makes that impossible by construction. No ip/UA nulling anywhere here: every
matched row belongs to an inviter who is not being erased (the NWB-P1-015 actor-only rule, taken
to its limit).

**4. The scrubbed addresses are the union of the column and the audit row.** Normally
`invited_email`; pre-`invited_email` rows (user_id set, column NULL) fall back to the invite audit
row's own `afterState.email` — same data ("the address this invite was sent to"), second location.
The union is collected pre-delete in the hook; NWB-P1-015's value gate still applies, so a row
containing someone else's address is untouched.

**5. Placement mirrors the account purge.** `expireInvitations` lives in `invitation.service.ts`
(the lifecycle owner), deletes via `deleteRowsPerRow` (the `PurgeableTable` allow-list gains
`"organization_members"` — still closed, still the injection guard), scrubs in `beforeDelete`,
reports `{ deleted, failed, errors, auditAnonymized }`. New job `retention.purge-expired-
invitations`, cron `30 2 * * *` (the gap between the org and account purges) with the standard
`QUEUE_CRON_*` override, slotted in `MAINTENANCE_JOBS` after the org purge; verify stays last
(the definitions pin is extended, not edited).

**6. `anonymize.ts` grows a shared core, not a copy.** The flag wrap and the scrub-update loop are
extracted for reuse; `anonymizeAuditActorContext` keeps its behavior byte-identical (its tests are
the proof), and `anonymizeAuditInviteeEmail(tx, { memberId, emails })` rides the same core with
network-nulling disabled. The per-row `SET LOCAL` dance stays inside the module — callers still
just call a function.

## Scope

**Build:**
- `expireInvitations(db)` in `src/services/orgs/invitation.service.ts` + `PurgeableTable` extension
  + `anonymizeAuditInviteeEmail` (+ shared-core refactor) + job + queue/scheduler/config/env
  wiring + `invitations.purged` registry action (compliance, resource `member`).
- Tests: lapsed-only deletion (fresh, grace-window, accepted, NULL-expiry rows all survive);
  audit email scrubbed with inviter context intact; a second org's pending invite for the SAME
  address untouched (the scoping test); re-invite after cleanup works; job outcome shape;
  trigger hermeticity via executed-0002 (new shared helper — the two older copies stay put, no
  churn in delivered tickets).
- `AGENTS.md`: nightly-order bullet + invitation bullet gain a sentence each; counts refreshed.

**Don't:**
- Don't touch accepted/active memberships, inviter context, or any user row (an invitee with an
  account keeps it — only their lapsed invite goes).
- Don't build the general retention policy or legal holds here; NWB-P1-010 stays open, and the
  hold seam (service-level check) is this service when it lands.
- Don't soft-delete as a halfway step (see §1).

## Acceptance

- [ ] After the job, no `organization_members` row is a lapsed invite (expired + past grace), and
      every other invited row still exists byte-identical.
- [ ] The lapsed invite's address is gone from its audit rows (marker, shape kept); the same
      address in another org's pending invite — member row and audit row — is untouched. Proven
      by test, both directions.
- [ ] Chain verification passes after a cleanup that touched a chained invite row — invite audit
      rows are `core` today, so this is proven by scrubbing one through the shared core and
      verifying, not by fixture coincidence. (If the writer ever chains invites, the machinery is
      already correct.)
- [ ] Re-inviting a cleaned address works (fresh insert, fresh token) — pinned, not assumed.
- [ ] The nightly order pin still holds with five jobs (reclaim first, verify last); the new job
      is registered, scheduled, env-overridable, and runnable via `queue:run` like the others.
- [ ] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `biome`, `build`, `coverage:check`. No
      migration (no schema change).

## Notes

- No FKs point INTO `organization_members` from other tables (verified), so today no row can
  refuse — but the delete still runs per row, for the same reason the org purge does (a future
  restrictive edge must cost one row, not the night).
- `expiresInHours` lets callers set custom TTLs; the grace counts from `expires_at`, so custom
  TTLs are honored automatically.
- The 0002 trigger needs no change: the scrub touches only PII columns under the flag, exactly
  the sanctioned shape.
