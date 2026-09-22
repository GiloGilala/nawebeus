# NWB-P1-015 — Anonymize audit actor context on hard purge (F-29 / BR-AUTH-043)

Type: task
Status: done (2026-09-21 — typecheck + `bun run lint` exit 0 + build + **553/553** `bun test` with a live database, 293 pass / 274 skip / 0 fail without one, `coverage:check` green at 91.4% services / 96.9% lib)
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

## Decisions (2026-09-21, before coding)

**1. The trigger exception is a declared intent plus a column confinement, not an open door.**
Migration `0002` extends `impl_ual_append_only()`: when the transaction carries
`SET LOCAL audit.anonymizing = 'on'`, an UPDATE confined to the six PII columns (`actor_ip`,
`actor_user_agent`, `before_state`, `after_state`, `changes`, `metadata`) is allowed; anything else
under the flag — including a combined flag flip — still raises, and the NWB-P1-014 flag path is
unchanged. Alternatives rejected: open PII-column UPDATEs (any bug could then rewrite `before_state`
*without breaking the chain*, since jsonb is not hashed — the evidence-substance hole), and
direction-checking in plpgsql (a "scrub-ward only" proof over jsonb is not expressible there). The
threat model stays what it was: bugs, not malicious DBAs (who could drop the trigger anyway). The
service sets the flag transaction-locally around its scrub and resets it in a `finally`, so a test
that purges and then asserts rejection still sees rejection.

**2. The scrub rule is evidence-driven and supersedes the ticket's `id`/`email`/`phone` guess.**
Surveyed all 17 `writeAuditLog` call sites: the only subject-PII keys any writer emits are the
email family (`email` on invite/accept, `newEmail` on email-change); no writer emits a `phone` or
bare-`id` key; `name` is ambiguous (org names are compliance history that must survive, and API-key
names survive in `api_keys` anyway since `user_id` is SET NULL — scrubbing the audit copy would be
theater); free-text `reason` values are unscrubbable without reading prose. Rule: recursive walk over
the four jsonb columns, string values under `/email/i` or `/phone/i` keys replaced with
`"[redacted]"` **iff the value equals one of the subject's known identity values** (emails
case-insensitive, phones digit-normalized). The value gate is what makes substring key matching safe
and what preserves other people's emails in shared rows: purging an inviter keeps the invitee's
email, purging the invitee scrubs it.

**3. Known identity values, recoverable pre-delete.** `users.email` as-is (mangled) plus the
recovered original (repeated trailing-strip of `+deleted<8hex>` — unambiguous, the suffix is
appended after the full address), `users.phone` if set, and `organization_members.invited_email`
for the subject's memberships (readable because the scrub runs before the DELETE in the same
savepoint; memberships CASCADE with the user).

**4. Matching is id-first plus email-second, and ip/UA nulling is actor-only (refines the
ticket's Build rule).** Rows with `actor_id` = subject get the full scrub including ip/UA nulling —
that context is unambiguously theirs. Target-matched rows get jsonb value-scrubbing only: when an
admin acts on a subject, the row's ip/UA describes the admin's session, and the ticket's "null for
actor_id or target_user_id" rule would erase it — destruction beyond the erasure scope, required by
neither acceptance #1 (the admin's ip does not resolve to the subject) nor any known writer shape.
The survey found one real
cross-reference shape outside that rule — the inviter's `organization.member.invited` row, whose
actor is not the subject — so a second pass matches non-id rows whose jsonb contains a known email
(`strpos` pre-filter on the text form, exact key+value confirmation in JS) and replaces only the
matching values, leaving ip/UA alone (that context belongs to someone else). Full-scan cost
accepted: verification already walks nightly, and shape-agnosticism beats an action-name allow-list.
`actor_id`, `target_user_id` and `resource_id` stay untouched (hash inputs and unresolvable uuids —
the ticket's recommended reading); `organization_id` survives per the Notes; `session_id`/`requestId`
are unresolvable-random and stay.

**5. `actorIdHash?` is dropped from the signature.** It belonged to the rejected re-chaining option;
nothing in the built design hashes the actor.

**6. The hook runs inside the row's savepoint, scrub-before-delete.** `deleteRowsPerRow` gains an
optional `beforeDelete(tx, id)` returning the scrubbed-row count; failure lands the row in `errors`
(user intact, retried next night), and a later DELETE refusal rolls the scrub back (a non-erased
user keeps intact context — verified by test, not argued). `PerRowDeleteResult` and the job outcome
gain always-present `auditAnonymized` (the P1-013 exact pins are updated in the same commit, as that
ticket did to its predecessors).

**7. The org purge gets no call — deliberate disagreement with the ticket's parenthetical.** It
erases no data subject (members are detached, accounts intact), so scrubbing members' actor context
there would destroy non-erased users' data; `created_by` dies with the org row itself; org names and
IDs survive per the Notes. `auditAnonymized: 0` on its outcome is the honest report.

**8. Known residuals, written down rather than fixed.** Never-joined invitees have no purge event at
all (no user row → no erasure trigger; their invite rows and `invited_email` live on — needs
NWB-P1-010 retention thinking, not this ticket). Free-text `reason` mentions of a subject are
unmatchable. `api_keys.name` surviving in its source table is a purge-completeness question beyond
BR-AUTH-043's audit scope. When NWB-P1-010 lands legal holds, the hold check goes in
`anonymizeAuditActorContext` (service, not job) — this function is the seam.

**As-built (delivery, 2026-09-21).** The dev database (like CI) is push-built and triggerless
(verified: zero trigger rows), so the purge tests execute `0002`'s SQL in-transaction first —
without that, the scrub passes trivially and the flag/trigger integration goes untested. Three
sabotage red-checks, all restored: no flag → all 4 DB tests fail; no value gate → the inviter test
+ 2 unit tests fail (the control-row test passing under sabotage is correct — it pins candidate
selection, which the gate does not affect); count claimed before DELETE → the blocked-run
`auditAnonymized: 0` pin fails.

## Acceptance

- [x] After a hard purge, no `unified_audit_log` row references the erased subject in any column that a
      reader could resolve to them, and the row is still present. (`anonymize.test.ts`: the purge
      test — ip/UA nulled, emails `[redacted]`, rows present, uuids/organization intact; known
      residuals — never-joined invitees, free-text `reason`, `api_keys.name` — recorded in Decisions
      §8, not silently dropped.)
- [x] Chain verification (NWB-P1-014) passes on a database that has been anonymized — proven by a test,
      asserted rather than argued. (`verifyAuditChains` over the scrubbed rows: `rowsChecked: 1`,
      `broken: []` — the count pins the scrubbed row was walked, not skipped.)
- [x] `hash_chain_valid` is NOT abused to encode "this row was anonymized" (its one documented meaning
      is tamper state). (Explicitly asserted still-`true` on scrubbed rows; the trigger keeps the
      two mutations disjoint — a combined flip+scrub raises.)
- [x] Anonymization is idempotent (re-running the purge on an already-scrubbed row is a no-op — same
      ground rule as every other worker, NWB-P1-001). (Second run returns 0 with byte-identical
      rows; missing user returns 0 without throwing.)
- [x] The append-only exception is documented in `db/shared/audit.ts`'s header, where the rule lives.
      (Plus the ticket's other two sites: `Security Architecture.md` §§1/5.3/9.4 and the AGENTS.md
      chain bullet.)
- [x] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `biome`, `build`, `coverage:check`. (553/553
      with DB; 293/274/0 without; typecheck + lint exit 0 + build green; coverage 91.4/96.9;
      migrate-twice from zero (ledger 3, 0002 live) + `db:push --force` converges with the trigger
      surviving.)

## Notes

- `organizationId` is *not* personal data about the subject and must survive — an org's compliance
  history cannot be erased because one member left.
- The 30-day grace window is irrelevant here: this runs at hard-purge time, not soft-delete time.
- If NWB-P1-010 (retention + legal holds) lands first, a legal hold must **block** this scrubbing for
  the held rows — same rule as blocking a purge. Coordinate the two; the hold check belongs in the
  service, not the job.
