# NWB-P0-025 — `purgeExpiredAccounts` cannot delete an organization's owner (F-25)

**Status:** done — 2026-09-20 (decision D16, option 2; verified locally: typecheck + lint +
build + 327/327 `bun test` with a live database, 2 pass / 7 skip / 0 fail without one in this
file; **CI green on PR #13**, run
[35528428246](https://github.com/GiloGilala/nawebeus/actions/runs/35528428246))
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

- [x] The chosen semantics are implemented and documented in the register (D16)
- [x] `purgeExpiredAccounts` either succeeds or is never reachable for an owner
      (never reachable — the `deleteAccount` gate writes nothing for an owner)
- [x] The F-25 limitation test is flipped to the decided behaviour (not deleted)
- [x] `bun test` green with DB

## What was built (2026-09-20)

**Decision D16 — option 2 (refuse and report), the ticket's recommendation.**

| Layer | File | Change |
| --- | --- | --- |
| Typed error | `src/lib/errors.ts` | `OwnershipTransferRequiredError` — 409 `OWNERSHIP_TRANSFER_REQUIRED`, carries `details.organizations` (id + name) |
| Gate | `src/services/users/account-deletion.service.ts` | `deleteAccount` looks up `organizations WHERE owner_id = userId` **before writing anything** and refuses, naming the blocking organizations; `purgeExpiredAccounts` docstring records the never-reachable invariant and why the FK staying loud is deliberate |
| Schema | `db/organization/organizations.ts` | `created_by`: NOT NULL + `restrict` → nullable + `set null`, matching the 25+ other attribution FKs. `owner_id` unchanged on purpose |
| Tests | `src/tests/auth/account-deletion.test.ts` | limitation test flipped into three decided-behaviour tests (+2 net, 327 total) |

Two facts surfaced while landing it that the ticket's diagnosis did not cover:

1. **`owner_id` was not the only blocker.** `organizations.created_by` was also
   NOT NULL + `restrict`, so even after ownership moved, purging the former owner —
   still the org's creator — died on 23503. Fixed in-schema (above); the flip test
   proves it end to end: transfer → delete → expire → purge, org survives on its new
   owner with `created_by` set-nulled.
2. **The same class survives elsewhere** — `api_keys.created_by`/`updated_by`/
   `revoked_by`/`deleted_by` and `tokens.revoked_by` have no `onDelete` at all
   (`NO ACTION` ≈ restrict). Out of this ticket's scope (they block ordinary users,
   not specifically owners) → filed as **NWB-P0-028 (F-28)**.

Accepted consequence, recorded in D16: signup creates a personal organization owned by
the user, so until NWB-P0-023 ships organization deletion / ownership transfer, a
normally-registered user cannot complete account deletion — they get 409 with the org
named. That is the cost of refusing over cascade-deleting shared workspaces (option 1)
or weak anonymisation (option 3). NWB-P0-023 should relax the gate for sole-member
organizations once it can delete them safely, and any transfer path it builds must
refuse to reparent an organization onto an account already scheduled for deletion.

## Comments

- 2026-09-20 — Claimed and implemented as above. Verification: fresh embedded
  PostgreSQL 14.23 (`embedded-postgres`, CI floor); typecheck clean; `biome check .`
  0 errors; build ok; **327 pass / 0 fail** across 37 files with a live database
  (325 before + 2 net new in this file); without `DATABASE_URL` this file runs
  2 pass / 7 skip / 0 fail. The three pre-decision tests were made to fail against
  the fix first — the two ownership-path tests went red the moment the gate landed
  and the limitation test went red when the purge stopped throwing — so the flipped
  suite is real coverage of the new behaviour, not tests that agree with whatever
  is there.
