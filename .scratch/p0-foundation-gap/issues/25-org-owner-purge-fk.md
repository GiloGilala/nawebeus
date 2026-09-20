# NWB-P0-025 — `purgeExpiredAccounts` cannot delete an organization's owner (F-25)

**Status:** ready-for-agent — **not fixed**. Decision needed (see Options).
**Deps:** NWB-P0-023 (organization deletion) — this is the account-side half of it. **Size:** S/M.
**Found while:** writing the NWB-P0-024 lifecycle tests.

## The defect

`purgeExpiredAccounts` hard-`DELETE`s from `users`. `organizations.owner_id` is `NOT NULL`
with a restrictive FK to `users(id)`, so for any user who still owns an organization the
delete dies on **23503** and the whole purge transaction aborts:

```
error: update or delete on table "users" violates foreign key constraint
       "organizations_owner_id_users_id_fk" on table "organizations"
```

Impact: the NDPR erasure clock (F-18) cannot be honoured for the most likely DSAR
subject — the org owner who deleted their account. Because the failure is a thrown error
inside one statement, a batch purge either reports nothing (if the caller swallows it) or
stops at the first owner.

## Evidence

`src/tests/auth/account-deletion.test.ts` → "purgeExpiredAccounts currently fails for an
organization owner (F-25 known limitation)" — a DB-gated test that asserts today's
`23503`. It is deliberately written to **fail when the decision is implemented**, so the
fix cannot land silently.

## Options (product call)

1. **Purge the owned organizations with the owner.** Cleanest NDPR story, but an
   organization is shared data — deleting an owner's account would destroy the team's
   workspace, and nothing in the account-deletion flow warns them.
2. **Refuse and report.** `deleteAccount` (not `purgeExpiredAccounts`) rejects while the
   user owns an organization, telling them to transfer ownership first; the purge then
   only ever sees users who own nothing. Requires an ownership-transfer path that does
   not exist yet (Owner is transferred, never granted — DEC-039).
3. **Anonymise the owner instead of deleting.** Keep the row, null the personal fields,
   keep `email` mangled — the FK stays satisfied. Weakest "erasure" claim.

Recommendation for whoever picks it up: **option 2**, because ownership transfer is
already a DEC-039 concept and option 1 silently destroys other people's data. Escalate to
the D14/D12 product session if the answer matters for launch.

## Acceptance criteria (when implemented)

- [ ] The chosen semantics are implemented and documented in the register
- [ ] `purgeExpiredAccounts` either succeeds or is never reachable for an owner
- [ ] The F-25 limitation test is flipped to the decided behaviour (not deleted)
- [ ] `bun test` green with DB
