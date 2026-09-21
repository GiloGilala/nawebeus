# NWB-P1-015 — Anonymize audit actor context on hard purge (F-29 / BR-AUTH-043)

Type: task
Status: ready-for-agent
Blocked by: NWB-P1-014 (the chain decides what may be mutated in an audit row; an UPDATE that changes
a hashed field breaks it, so this cannot be bolted on before the chain exists)
Phase: P1 (roadmap Phase 2) · found while scoping NWB-P1-002 on 2026-09-21
Size: S–M

## The finding

`docs/modules/Authentication & User Management.md:828`:

> **BR-AUTH-043** | Audit log entries **anonymized (not deleted)** on account deletion | Legal
> compliance — 7-year retention

Implemented nowhere: `grep -rn anonymi src/` → no hits. And it is now *load-bearing*, because
NWB-P1-001 put `purgeExpiredAccounts` on a nightly schedule: the erasure that satisfies an NDPR request
leaves the subject's personal data sitting in `unified_audit_log` — `actor_ip` (`inet`),
`actor_user_agent` (`text`), `actor_id`, `target_user_id`, plus anything inside `before_state`,
`after_state`, `changes` and `metadata` jsonb (a profile PATCH audited `before_state` with the user's
name, email and phone; a member removal names an email).

The 7-year retention rule is the *reason* the row must survive, so "just delete the audit rows for that
user" is not an option — and neither is leaving it, which is why this ticket exists.

## Why it waited for the chain

The table's contract is append-only: no UPDATE, no DELETE (and NWB-P1-014 proposes a trigger to
enforce that at the DB, with `hash_chain_valid` as the sole sanctioned exception). Anonymization is
by definition an UPDATE of personal columns. So the mechanism has to be decided as part of the chain:

- Does `checksum` cover the row *including* the anonymizable columns? In the designed formula
  (`id + action + actorId + resourceId + createdAt + previousChecksum`) it covers `actorId` but not
  IP/user-agent/jsonb — so nulling IP and UA does **not** break the chain, while replacing `actor_id`
  does. That asymmetry is the whole design space in one sentence, and it is why `actorId` is in the
  hash at all (tamper resistance) yet is also the erasure target (data protection).
- Replacing `actor_id` with a one-way hash of itself preserves linkability-without-identity but
  invalidates that row's checksum, and any successor row's `previousChecksum` chain. Handling it means
  either re-chaining from that row (an UPDATE of *many* audit rows — the append-only rule's whole point)
  or recording the transition (a dedicated "anonymized at" event whose checksum chain includes the
  *pre*-anonymization digest, so the historical state is provable even though the row is now scrubbed).
- Option that avoids both: **do not touch historical rows**; scrub only the columns the hash does not
  cover, and make `actor_id` unrecoverable by deleting the user (which the purge already does) — under
  this reading the requirement is met for `actor_id` by erasure, and the remaining leak is precisely
  `actor_ip` + `actor_user_agent` + free-text in the jsonb payloads.

Recommend the last one **plus** targeted scrubbing of IP/UA/jsonb email-ish keys, because it is the only
option that is both honest about `checksum` coverage and does not rewrite history.

## Scope

**Build:**
- `anonymizeAuditActorContext(db, { userId, actorIdHash? })` in `src/services/audit/` — one place,
  called from `purgeExpiredAccounts` (and the org purge, which reaches `created_by`-style references),
  so the erasure path and the audit path cannot drift apart.
- Nulls `actor_ip`, `actor_user_agent` for rows where `actor_id` or `target_user_id` = the purged user;
  rewrites the `id`/`email`/`phone` keys inside the four jsonb columns to a redaction marker rather than
  dropping the columns (an audit row that has lost `before_state` is still evidence that a change
  happened; one that has lost its shape is not).
- Records what it did in the run's `JobOutcome` → `after_state` (`{ …, auditAnonymized: n }`), because
  an erasure that silently edits the audit trail needs its own evidence.
- Test on real rows: seed a user, generate audit rows with IP/UA and a `before_state` containing an
  email, run the purge, assert the row **still exists**, its `checksum` (post-NWB-P1-014) still
  verifies, `actor_ip`/`actor_user_agent` are NULL, and the email is gone from every jsonb column.
- `docs/technical/Security Architecture.md` + `AGENTS.md`: the append-only rule gains a documented
  exception, and that must be written down where the rule is stated, or the next reader "fixes" it.

**Don't:**
- Don't delete audit rows, and don't touch `created_at` (it's a hash input and the retention clock).
- Don't decide this by adding a `deleted_at` column to `unified_audit_log` — the table has no
  `updatedAt` **by design** (see its header comment), and a soft-delete column is a `UPDATE` in
  disguise plus a new "who may set it" problem.
- Don't reach for "anonymize by deleting the user row and calling it done" without checking
  `actor_ip`/`actor_user_agent`; those are the actual leak.

## Acceptance

- [ ] After a hard purge, no `unified_audit_log` row references the erased subject in any column that a
      reader could resolve to them, and the row is still present.
- [ ] Chain verification (NWB-P1-014) passes on a database that has been anonymized — proven by a test,
      asserted rather than argued.
- [ ] `hash_chain_valid` is NOT abused to encode "this row was anonymized" (its one documented meaning
      is tamper state).
- [ ] Anonymization is idempotent (re-running the purge on an already-scrubbed row is a no-op — same
      ground rule as every other worker, NWB-P1-001).
- [ ] The append-only exception is documented in `db/shared/audit.ts`'s header, where the rule lives.
- [ ] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `biome`, `build`, `coverage:check`.

## Notes

- `organizationId` is *not* personal data about the subject and must survive — an org's compliance
  history cannot be erased because one member left.
- The 30-day grace window is irrelevant here: this runs at hard-purge time, not soft-delete time.
- If NWB-P1-010 (retention + legal holds) lands first, a legal hold must **block** this scrubbing for
  the held rows — same rule as blocking a purge. Coordinate the two; the hold check belongs in the
  service, not the job.
