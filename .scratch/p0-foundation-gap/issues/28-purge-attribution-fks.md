# NWB-P0-028 — Purge still 23503s on `api_keys.*_by` and `tokens.revoked_by` (F-28)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 342/342 `bun test`
with a live database; red-first: with the old NO ACTION FKs the new test dies on 23503
(`api_keys_created_by_users_id_fk`), with the fix it passes and all six affected constraints
read `confdeltype = 'n'` (SET NULL) in the catalog; CI run on this branch's PR)
**Deps:** none. The `organizations.created_by` half of this class shipped in NWB-P0-025.
**Size:** S.
**Found while:** landing NWB-P0-025 (F-25) — enumeration of every FK to `users(id)` in the
active schema.

## The defect

`purgeExpiredAccounts` hard-`DELETE`s from `users`. Every attribution FK to `users(id)`
in the schema is `onDelete: "set null"` **except** these, which have no `onDelete` at
all — drizzle renders that as `NO ACTION`, i.e. restrictive:

| Table | Columns | Nullable? |
| --- | --- | --- |
| `api_keys` | `created_by`, `updated_by`, `revoked_by`, `deleted_by` | yes |
| `tokens` | `revoked_by` | yes |

So a user who ever created/updated/revoked an API key (NWB-P0-001 made that an everyday
path) or revoked a token can soft-delete their account, pass the 30-day grace window —
and the purge dies on **23503**, stranding the erasure exactly like F-25 did. Because
all five columns are nullable, the fix is the same one NWB-P0-025 applied to
`organizations.created_by`: `onDelete: "set null"`, matching the 25+ existing
attribution columns.

## Scope note

Out of NWB-P0-025's scope because the org-owner refusal gate (D16) never intersects
these columns — they block the purge of *ordinary* users, not specifically owners.
`organizations.owner_id` stays NOT NULL + `restrict` deliberately (that is what D16
gates on); `organizations.created_by` was fixed in NWB-P0-025.

## Acceptance criteria

- [x] All five columns carry `.references(() => users.id, { onDelete: "set null" })`
      (catalog-verified: `confdeltype = 'n'` on all six constraints incl.
      `organizations.created_by`)
- [x] A DB-gated test: user with an API key deletes their account, grace window is
      expired, `purgeExpiredAccounts` removes them and the attribution columns on the
      surviving rows are NULL — `src/tests/auth/account-deletion.test.ts` ("purge
      removes a user who created and revoked API keys…"), made to fail against the old
      NO ACTION FKs first (23503 on `api_keys_created_by_users_id_fk`)
- [x] `bun run db:push -- --force` applies cleanly (FK drop/add only; convergence run
      clean twice, incl. the stash-revert round-trip used for the red-first proof)
- [x] `bun test` green with DB — 342 pass / 0 fail

Note on coverage shape: the behavioral test exercises `created_by` and `revoked_by`
(the only columns with writers today — nothing writes `tokens.revoked_by` or
`api_keys.updated_by/deleted_by` yet); those three columns got the same `set null` so a
future writer cannot resurrect the blocker. `api_keys.user_id` was already correctly
`set null` — a purged user's keys survive as org-owned rows and authorize nothing,
since ability rebuild needs the owner.
