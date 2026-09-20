# NWB-P0-010 — Assign the Owner role atomically at signup (F-01)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + 165/165 `bun test` incl. 3 new tests; CI re-run pending)
**Deps:** D13 ✅ (DEC-039 — role code is `owner`). **Size:** M.
**Fixes:** F-01 (Critical). Related: F-20 (found + fixed as a prerequisite while verifying this ticket's acceptance path).

## What was built

| Layer | File |
| --- | --- |
| Atomicity helper | `src/lib/transaction.ts` (new) — `withAtomicWrites()` |
| Service | `src/services/auth/signup.ts` — owner role lookup + `role_id` on the membership + atomic block + `organization.owner.created` audit |
| Seed | `src/seed.ts` — new `owner` system role (level 90, full permission set incl. `billing.*` per module spec §3.6 RBAC matrix) |
| Tests | `src/tests/auth/signup.test.ts` (3 new integration tests), `src/tests/seed.test.ts` (owner slug) |

## Design decisions

1. **Role code `owner`** — per DEC-039 (D13, option (a)): platform `super_admin` + per-org
   `owner/admin/manager/creator/analyst/viewer`. The `owner` role is a **system role**
   (`organization_id IS NULL`, `is_protected`), seeded between `super_admin` (100) and
   `org_admin` (80). It carries the full permission set including `billing.*` — the module
   spec RBAC matrix (`docs/modules/Organization & Account Management.md` §3.6) gives only
   Owner "Manage billing (₦)". FR-ORG-001 **AC2** ("User assigned Owner role
   automatically") is the spec's own requirement; the pre-fix behavior (NULL `role_id`)
   was a spec violation, not a design choice.

2. **Fail closed on a missing role.** The role is looked up by `code = 'owner' AND
   organization_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL` before any
   write; if absent (unseeded environment) signup throws `InternalError` rather than
   creating a permission-less owner again.

3. **Atomicity via `withAtomicWrites`, not `db.transaction` directly.** The production
   handle is pool-backed (drizzle's `db.transaction` = real BEGIN/COMMIT), but the test
   harness (`createTestDb`) binds a single client already inside the harness's outer
   rollback transaction, where a nested `db.transaction` is a no-op BEGIN + a stray
   COMMIT that would persist test data (same constraint documented in
   `src/services/auth/api-key.ts`). `withAtomicWrites` probes
   `txid_current_if_assigned()` and branches: real BEGIN/COMMIT outside a transaction,
   SAVEPOINT/RELEASE/ROLLBACK TO SAVEPOINT inside one. A failure inside the block rolls
   back exactly the block's writes and leaves the outer transaction usable. The email
   send (side effect) deliberately stays **after** the commit — a failed email must not
   roll back a committed account (the verification token row is persisted and the
   resend path exists).

4. **Audit** — `organization.owner.created` (category `authorization`, org-scoped) in
   addition to the existing `auth.signup.completed`, both inside the atomic block.

5. **F-20 (found during verification, fixed as a separate commit):** the invite endpoint
   — this ticket's acceptance path — 500'd for *everyone* (even the seeded
   super_admin) because `invitation.service.ts` writes `invitation_token`,
   `invitation_token_hash`, `invitation_sent_at`, `expires_at` (absent from the schema,
   PG 42703) and inserts `user_id = NULL` for not-yet-registered invitees (schema had
   `user_id NOT NULL`, PG 23502). Schema aligned to the service: 4 columns added to
   `db/organization/organization-members.ts` (conventions follow the core `tokens`
   table), `user_id` made nullable (spec's pre-acceptance invite lifecycle; the
   `(organization_id, user_id)` unique index is unaffected — NULLs are distinct).
   Residual work stays with NWB-P0-016: member list `INNER JOIN users` hides pending
   invites (needs LEFT JOIN + invited-email display); re-inviting the same
   not-yet-registered email creates duplicate pending rows (needs dedup).

## Verification (2026-09-20, local: bun 1.4.2, PG 18.4 via npm `embedded-postgres`;
CI PG14 remains the canonical gate)

- `bun run typecheck` — clean
- `bun run lint` — no new diagnostics (repo baseline warnings unchanged)
- `bun test` — **165 pass / 0 fail** (was 162 before; +3 new), 337 expect() calls
- New tests:
  - *owner role + invite E2E*: signup → membership carries the `owner` role id →
    `loadAbility` grants `members.create` → `organization.owner.created` audited →
    sign in as the new owner → `POST /api/orgs/:orgId/members/invite` **200** (403 pre-fix)
  - *atomicity*: trigger forced to fail on the membership insert (5th write) → signup
    rejects → 0 rows left in `users` / `organizations` / `tokens` / `organization_members`
  - *fail-closed*: owner role hidden from the catalog → signup rejects, 0 user rows
- Environment note: this sandbox cannot reach `bun.sh` or the Debian mirrors; bun was
  installed via `npm i -g bun` (1.4.2) and Postgres via the npm `embedded-postgres`
  package (18.4, initdb/pg_ctl from `node_modules`). Local DB is built from zero with
  `db:push -- --force` + `bun run seed` (matches CI), so the from-zero schema build is
  verified too.

## Rollback

Revert the two commits (`feat(f-01)…` + the F-20 schema commit). No data migration
needed (pre-prod; `organization_members.role_id` was already nullable).
