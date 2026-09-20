# NWB-P0-006 — Reconcile `.scratch/foundation` issue 07 → `done`

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
363/363 `bun test` with a live database, 215 pass / 155 skip / 0 fail without
one; CI run on this branch's PR)
**Deps:** NWB-P0-001 (API keys, done 2026-09-13), NWB-P0-014 (role model +
self-protection, done 2026-09-20). **Size:** S — grew to S/M once the audit
found two criteria with no test behind them.
**Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-006.

## Objective

`.scratch/foundation/issues/07-core-api-roles-api-keys.md` was marked
`done — role assignment shipped earlier; API keys implemented 2026-09-13`, but
**six of its twelve acceptance boxes were still unticked** — all six on the
role-assignment half. Either the work was not done (and the status lied), or it
was done and the boxes lied. The tracker convention says a `done` ticket's
checklist is evidence, so this had to be settled by reading the code, not by
ticking.

## What the audit found

Each unticked box, checked against HEAD:

| Box | Verdict |
| --- | --- |
| Route updates a member's role | **Shipped, but at a different path** — see "Route discrepancy" |
| Cannot remove last `org_admin` | **Shipped, under a renamed rule** — see "BR-AUTH-030" |
| Integration test: admin changes member's role | **Existed** — `role-assignment.test.ts` "owner promotes a viewer to admin" + the `admin`/`manager` scope tests |
| Integration test: change to non-existent role → 404 | **Missing** — behaviour correct, nothing pinned it |
| Integration test: non-admin gets 403 | **Missing** — behaviour correct, nothing pinned it |

So: four boxes were honestly tickable on the existing evidence, and two named
tests genuinely did not exist. The behaviour behind both was verified correct by
probe before writing anything (404 `Role not found`; 403 `Missing permission:
update members`), so these are **characterisation tests for working code**, not
bug fixes — but until they existed the boxes could not be ticked truthfully.

## Route discrepancy (recorded, not "fixed")

The ticket specifies `PATCH /api/organizations/:id/members/:memberId/role`.
Nothing at that path exists, and nothing should be built there. As-built there
are two entry points, both of which run the same policy:

- `POST /api/orgs/:orgId/members/assign-role` — the dedicated role-change route
  (`role.route.ts`), keyed by `userId` + `roleId`.
- `PATCH /api/orgs/:orgId/members/:memberId` — the general member update; when
  the body carries `roleId` it is routed through the identical guards, which is
  what the "no bypass" test in `role-assignment.test.ts` pins.

Three deliberate differences from the ticket's prose, all of them settled
conventions rather than drift: `orgs` not `organizations` (matches every other
route), `:orgId` not `:id`, and the subject spelling `members` (the
`apikeys`/`members`/`roles` convention recorded in the same ticket's own note
about `ApiKey`). The ticket's path is historical; the boxes are ticked against
the real routes and this table is the record of why.

## BR-AUTH-030 (the `org_admin` box)

The box says "cannot remove last `org_admin`". The role `org_admin` **no longer
exists** — DEC-039 retired it in favour of the `owner`/`admin` ladder, and the
seed re-points pre-DEC-039 memberships. The rule survived the rename with wider
scope: `assertNotLastAdministrator` (`role-policy.ts`) refuses to demote or
remove a member when no *other* active Owner-or-Admin would remain, counting
`owner`, `admin` and `super_admin`. Pinned by the BR-AUTH-030 test. The box is
ticked against the successor rule, with the rename noted inline so nobody reads
the tick as evidence that a retired role is still guarded.

## Changes

| Layer | File |
| --- | --- |
| Three new DB-gated integration tests | `src/tests/orgs/role-assignment.test.ts` |
| Twelve boxes ticked with per-box evidence; route + rename notes | `.scratch/foundation/issues/07-core-api-roles-api-keys.md` |
| `foundation` spec flipped to `done` (all 10 issues) | `.scratch/foundation/spec/…` |
| Ticket index + Outstanding line | `.scratch/p0-foundation-gap/spec.md` |

## Tests added

1. **a role id that exists nowhere returns 404** — asserts `NOT_FOUND` *and*
   that the member's role is unchanged, so a failed lookup can never be a
   partial write.
2. **a user who is not a member of this organization returns 404** — the
   ticket's criterion only named the role case; the member case is the same
   class and was equally unpinned. 404 rather than 403 is the deliberate answer:
   the caller *is* entitled to assign roles in this org, the subject simply is
   not a member, and neither response leaks whether the stranger exists.
3. **a member without `members.update` cannot assign roles at all** — a
   `creator` is refused at the `requireAbility` gate, before the hierarchy
   policy is consulted, and the target's role is unchanged.

`role-assignment.test.ts`: 18 → 21 tests, all green.

## Verification

- `bun run typecheck` — pass.
- `bunx biome check .` — 0 errors (warnings only, pre-existing `noExplicitAny`).
- `bun run build` — pass.
- `bun test` with a live PostgreSQL 14.23: **363 pass / 0 fail** (was 360).
- `bun test` with no `DATABASE_URL`: 215 pass / 155 skip / 0 fail.

## Acceptance criteria

- [x] Every box in `.scratch/foundation/issues/07` is ticked against real,
      named evidence — or annotated where the ticket's wording is historical.
- [x] The two criteria that had no test now have one.
- [x] The route discrepancy and the `org_admin` rename are recorded where a
      reader of the tick will see them, not silently absorbed.
- [x] `.scratch/foundation` is fully `done` — the P0 exit-gate clause
      "foundation `.scratch` set fully `done`" is satisfied.
