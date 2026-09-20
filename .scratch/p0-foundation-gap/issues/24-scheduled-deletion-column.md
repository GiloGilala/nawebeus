# NWB-P0-024 — The whole account-deletion service referenced a column that does not exist (F-24)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 325/325
`bun test` with a live database; CI green on PR #12)
**Deps:** none. **Size:** S.
**Fixes:** F-24. **Found while:** running the suite at `d03dc49` — one test was red
(`Server Functions — integration (with DB)`), and the cause was not the Server Function.

## The defect

`src/services/users/account-deletion.service.ts` reads and writes
`users.scheduled_deletion_at` in all four of its exports (`deleteAccount`,
`reactivateAccount`, `purgeExpiredAccounts`, `getAccountDeletionStatus`). The column was
never defined in `db/core/users.ts` — only `organizations.scheduled_deletion_at` exists.
Every call failed with `42703`, which meant:

- `GET /api/users/me` **500'd for every authenticated user** (it calls
  `getAccountDeletionStatus`) and so did `getMeServerFn`;
- `DELETE /api/users/me` and `POST /api/users/me/reactivate` could never work;
- `purgeExpiredAccounts` — the NDPR erasure path F-18 already tracks as unscheduled —
  could not have deleted anything even once scheduled.

Nothing caught it: `src/tests/auth/account-deletion.test.ts` covered only the two
unauthenticated 401 paths, which never reach the service. The defect register's F-18 row
("`purgeExpiredAccounts` exists but is never scheduled") assumed the function worked; the
roadmap even tells NWB-P0-023 to mirror "the **proven** account-deletion pattern".

## What was done

| Layer | Change |
| --- | --- |
| Schema | `db/core/users.ts` — nullable `scheduled_deletion_at timestamptz`, mirroring the `organizations` column; plain index `users_scheduled_deletion_idx` (not partial: partial predicates make `db:push` drop/recreate the index every run) |
| Service | `getAccountDeletionStatus` reads the instant as epoch-ms (`extract(epoch …)::bigint`) instead of `timestamptz` — node-postgres hands `timestamptz` back as `2026-10-20 17:24:06.801+00`, which JS `Date` rejects, so the field used to be a text form while `deleteAccount` returned a real ISO string for the same field |
| Tests | `src/tests/auth/account-deletion.test.ts` — DB-gated suite (5 new tests): `GET /api/users/me` 200 regression, delete (30-day window, `status='suspended'`, session revocation, email release, reason), reactivate, purge-selectivity, and the F-25 owner limitation |

## Acceptance criteria

- [x] `db:push -- --force` adds the column; `bun run seed` unaffected
- [x] `GET /api/users/me` returns 200 for an authenticated user (the regression that made
      the Server Function test red)
- [x] Full suite green: 325 pass / 0 fail (was 311 pass / 1 fail at `d03dc49`)
- [x] Both service mutators and the status reader execute against a real database

## Deviations & findings

- **Fixed schema-side, not service-side.** Operating rule 1 (`db/` is source of truth)
  does not settle this on its own — both halves are code — so the tiebreaker is the
  documented intent: the 30-day grace + purge pattern is specified for organizations by
  NWB-P0-023 *by copying this one*, and `deleteAccount` already writes the field. Adding
  the column is also the only option that keeps `purgeExpiredAccounts` able to honour the
  NDPR erasure clock.
- **`deleteAccount` also uses `gen_random_uuid()`** for the released email; core since
  PostgreSQL 13, so it is fine on the PG14 floor (no `pgcrypto` needed).
- **Out of scope, filed instead:** the purge cannot delete a user who owns an
  organization (F-25) — that needs a product decision and belongs with NWB-P0-023.
- **Not done, deliberately:** F-18 (scheduling the purge) is untouched; there is still no
  scheduler until Phase 2.
