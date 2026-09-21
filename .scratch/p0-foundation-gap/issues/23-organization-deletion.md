# NWB-P0-023 — Organization deletion (PRD 8.2.1 P0; discrepancy D-14)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
383/383 `bun test` with a live database, 217 pass / 176 skip / 0 fail without
one; CI run on this branch's PR)
**Deps:** none (NWB-P0-024/025 landed first and are prerequisites in fact — see
"Reading F-24/F-25 first"). **Size:** M.
**Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-023;
PRD 8.2.1; discrepancy D-14.

## Objective

An organization owner can delete their organization: soft delete, 30-day grace,
all members' sessions revoked, memberships deactivated, API keys revoked,
audited, plus a purge path for when the Phase 2 scheduler lands.

## Reading F-24/F-25 first (the ticket's instruction)

The ticket says to mirror `account-deletion.service.ts` **and** warns that the
pattern shipped broken twice. Both lessons were applied as checks, not as
assumptions:

- **F-24** (a whole service referencing a column that did not exist, green
  because its only tests covered the two 401 paths). Before writing any code,
  every column this module writes was verified present on `organizations`
  against a live PostgreSQL 14: `deleted_at`, `deleted_by`, `deletion_reason`,
  `scheduled_deletion_at`, `status`, `is_active`. They all exist — organizations
  were never missing what users were. The lifecycle is then exercised end to end
  against a real database, so a missing column fails loudly.
- **F-25** (the purge cannot delete an org owner because a restrictive FK
  refuses). The equivalent question here: what refuses a hard
  `DELETE FROM organizations`? Queried the live catalog — **every** FK
  referencing `organizations.id` is `CASCADE` (api_keys, oauth_accounts,
  organization_members, permission_groups, permissions, roles) or `SET NULL`
  (organizations.parent_organization_id, users.organization_id). No restrictive
  edge, so unlike its account-side sibling this purge can actually complete.
  Asserted by a test rather than left as a claim.

## What was built

| Layer | File |
| --- | --- |
| `deleteOrganization` / `reactivateOrganization` / `purgeExpiredOrganizations` / `getOrgDeletionStatus` | `src/services/orgs/org-deletion.service.ts` (new) |
| `DELETE /api/orgs/:orgId`, `POST /api/orgs/:orgId/reactivate` | `src/server/api/orgs/org.route.ts` |
| The reactivation escape hatch (see below) | `src/server/middleware/auth.ts` |
| 20 tests | `src/tests/orgs/org-deletion.test.ts` (new) |

**Cascades on delete:** memberships deactivated (`status='suspended'`,
`is_active=false`), API keys revoked, every member's sessions revoked.
Memberships are deliberately **not** `deleted_at`-stamped, so reactivation can
distinguish "suspended because the org was deleted" from "suspended by an admin"
and restore only the former.

**Not restored on reactivation: sessions.** A revoked session is a credential
that may have leaked during the deleted window; members sign in again. Pinned by
a test.

**Ownership is checked against `organizations.owner_id`, not a role row.**
DEC-039 makes Owner a transferred singleton recorded on the organization itself;
a membership carrying the `owner` code is a consequence of that, not the source
of truth. Checking the column means a desynced membership row cannot authorise a
deletion.

**Billing block:** stubbed as `findBillingBlocker()` returning `null`, with a
`TODO(P13)`, exactly as the ticket instructs ("do not invent billing state"). It
is a real call on the delete path, so P13 has one place to change and the wiring
is already covered by every delete test.

## The defect this ticket found in its own design

The first run of the reactivation test returned **403**, and the cause was not
the test.

Deleting an organization suspends *every* membership in it — including the
owner's. `assertActivePrincipal` then refuses that owner on their next request,
which locks them out of the only route that undoes the deletion. **The 30-day
grace period PRD 8.2.1 promises would have been unreachable**; the sole recovery
would have been a manual database edit. Shipping the "obvious" cascade would
have produced a feature that is destructive-only.

Two ways to fix it, and the tempting one is wrong:

- *Don't suspend the owner.* Then the owner keeps working inside a deleted
  organization and the deletion has not really taken effect. Rejected.
- *Let exactly one route accept a non-active membership.* Taken.
  `authMiddlewareAllowingInactiveMembership` keeps every other check — the
  account exists, is not soft-deleted, passes `users.status`, and holds a
  membership row in this org that is not itself soft-deleted — and relaxes only
  the `status='active'` requirement. The route then re-checks
  `organizations.owner_id` before acting.

`requireAbility("delete", "org")` is **not** applied to the reactivate route,
also deliberately: `loadAbility` builds rules from *active* memberships only
(that query is the org-scoping mechanism recorded in NWB-P0-018), so a deleted
organization yields an empty ability by construction and the gate could only
ever 403. Relaxing `loadAbility` to serve one route would weaken tenant scoping
everywhere. Authorization is the service's `owner_id` check, which is strictly
narrower than `org.delete` (super_admin holds that too).

Four tests fence the escape hatch in: a suspended user is still refused (F-05
intact), a soft-deleted account is still refused, a non-member is still refused,
and every *other* route still demands an active membership after deletion.

## D16: measured, and deliberately left alone

NWB-P0-025 recorded an accepted consequence — signup creates a personal
organization, so `deleteAccount` always 409s `OWNERSHIP_TRANSFER_REQUIRED` and a
normally-registered user can never complete account deletion — and asked this
ticket to "relax the gate for sole-member organizations once it can delete them
safely".

**Measured, and the answer is: do not relax it.** The gate exists because
`organizations.owner_id` is a restrictive NOT NULL FK, and a *soft*-deleted
organization still holds that reference. Letting the owner of a soft-deleted org
through reintroduces F-25's 23503 verbatim at purge time — verified by direct
experiment before deciding. What unblocks erasure is the **hard purge**, not the
soft delete, and that path now works end to end:

```
delete org → grace expires → purgeExpiredOrganizations → deleteAccount → purgeExpiredAccounts
```

Both facts are pinned: one test walks that sequence to a successful account
purge, and a negative control asserts that bypassing the gate with a
soft-deleted org still raises 23503. So the D16 consequence is now *reachable
to resolve* by the user (delete the org, wait out the grace) without weakening
the gate.

## Tests (20)

2 no-DB 401 route checks; 12 lifecycle tests (grace window recorded to within
0.1 day, all four cascades verified against real rows, lockout after deletion,
`listUserOrgs` hides it, non-owner 403 — asserted *alongside* that same admin
successfully updating the org, so the 403 is about ownership and not access,
double-delete 409 without extending the promised window, reactivation restores
members + keys, sessions stay dead, expired-grace reactivation refused,
non-owner cannot reactivate, purge takes only the expired, purge completes
across every FK while *users survive the workspace*, ISO round-trip on the
status field, 404 for an unknown org); 4 escape-hatch containment tests; 2 D16
interaction tests.

**One test was found to be worthless and fixed.** "A non-member is still 403"
originally asserted only the status code — and it still passed when the
membership check was deliberately sabotaged, because the service's owner check
answers 403 too. It now asserts the error *message*, so it pins the middleware
layer rather than agreeing with whatever refuses first. Re-verified by
re-running the sabotage: the test now goes red.

## Verification

- `bun run typecheck` — pass.
- `bunx biome check .` — 0 errors (warnings only, pre-existing `noExplicitAny`).
- `bun run build` — pass.
- `bun test` with a live PostgreSQL 14.23: **383 pass / 0 fail** (was 363).
- `bun test` with no `DATABASE_URL`: 217 pass / 176 skip / 0 fail.

## Acceptance criteria

- [x] Owner deletes → members 403 everywhere, org hidden from `listUserOrgs`.
- [x] Reactivate within grace works (and the escape hatch that makes it
      reachable is fenced in by four containment tests).
- [x] Purge removes only expired organizations, and actually completes.
- [x] Non-owner 403.
- [x] PRD 8.2.1: 30-day grace; the purge function honours the NDPR schedule.
- [x] Billing check stubbed as a no-op hook with a `TODO(P13)`, not invented.
- [x] Ownership semantics decided here rather than inherited (F-24/F-25 read
      first; D16 re-measured and deliberately left as-is).

## Comments

- 2026-09-20 — Not scheduled: `purgeExpiredOrganizations` has no runner, exactly
  like `purgeExpiredAccounts` (F-18). Both want the Phase 2 queue; whoever wires
  that should wire both together.
