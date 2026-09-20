# NWB-P0-014 — Align the role model with the spec (D13) + make self-protection real (F-07)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + 227/227 `bun test` incl. 60 new tests; CI run on this branch's PR)
**Deps:** D13 ✅ (DEC-039). **Size:** M.
**Fixes:** F-07 (High). Also fixes **F-21** (new — member removal 500'd on an enum violation) and the
system-role lookup bug that made `POST /members/assign-role` 404 for every request (folded into F-07 below).
**Successor notes for:** NWB-P0-016 (invite accept — role validation helper is ready), NWB-P0-023 (org
deletion — `assertNotLastAdministrator` is the BR-AUTH-030 hook), D14 (admin user deletion semantics).

## What was built

| Layer | File |
| --- | --- |
| Policy (new) | `src/services/orgs/role-policy.ts` — role ladder constants (`ROLE_LEVELS`), pure rules (`assertRoleChangeAllowed`, `assertMemberActionAllowed`), DB lookups (`findMemberRole`, `requireActorRole`, `resolveAssignableRole`, `assertNotLastAdministrator`) |
| Service | `src/services/orgs/role-assignment.service.ts` — rewritten on the policy; writes `member_role_history`; audit `organization.member.role_changed` with before/after |
| Service | `src/services/orgs/member.service.ts` — `updateMember(roleId)` delegates to `assignRole`; `removeMember` guarded + F-21 fix + audit `organization.member.removed` |
| Service | `src/services/users/admin.service.ts` — `updateUserAsAdmin(roleId)` delegates to `assignRole`; status changes (suspend) guarded; `deleteUser` guarded + F-21 fix; audits |
| Routes | `src/app/orgs/member.route.ts`, `src/app/orgs/role.route.ts`, `src/app/users/admin.route.ts` — pass the acting user; the ad-hoc role lookup in `role.route.ts` moved into the service |
| Seed | `src/seed.ts` — DEC-039 role set (7), spec permission matrix, **retirement** of `org_admin`/`member`, convergent role-permission mappings, `type='system'`/`scope` set |
| Test helpers | `src/tests/helpers/test-factory.ts` — `systemRoleId()`, `addMemberWithRole()` |
| Tests | `src/tests/orgs/role-policy.test.ts` (new, 43 pure matrix tests), `src/tests/orgs/role-assignment.test.ts` (15 new integration tests), `src/tests/seed.test.ts` (role set + matrix), `src/tests/orgs/org.test.ts` (`org_admin` → `admin`) |

## The role model as shipped (DEC-039)

| code | level | scope | notes |
| --- | --- | --- | --- |
| `super_admin` | 100 | global | platform operator; full catalog |
| `owner` | 90 | organization | full catalog incl. `billing.*`, `org.delete`; assigned at signup (NWB-P0-010), **transferred, never granted** |
| `admin` | 80 | organization | everything except `billing.*` and `org.delete` |
| `manager` | 60 | organization | team management (`members.*`, `users.read/update`, `roles.read`), content incl. `posts.publish`, `analytics.export` |
| `creator` | 40 | organization | `posts.create/update/delete` + read-only baseline |
| `analyst` | 20 | organization | read-only baseline + `analytics.export` |
| `viewer` | 10 | organization | read-only baseline (`org.read`, `settings.read`, `posts.read`, `analytics.read`) |

Matrix source: module spec Auth & User Management §6.2 and Org & Account Management FR-ORG-006, mapped onto
the 31 existing permission strings. `members.read` follows FR-ORG-006 ("View team list": Owner/Admin/Manager) —
note `GET /orgs/:orgId/members` has no ability check today, so this changes no behaviour yet.
`users.delete` (admin-console account deletion) is Owner/Admin only, not Manager: FR-ORG-006's "Remove users ✅*"
maps to `members.delete` (membership removal), which Manager does hold.

## Rules enforced (and where)

All in `role-policy.ts`; every role-changing and member-moderating path calls into it:

| Rule | Source | Behaviour |
| --- | --- | --- |
| Owner is never *granted* | BR-AUTH-031, spec "Owner: transferred only" | 403 on any assignment to `owner` |
| Owner's role never changes; Owner never removed/suspended | BR-AUTH-031, §6.3 | 403 |
| Nobody changes their own role / removes / suspends themselves | §6.3 "Cannot demote self", "Cannot suspend self" | 403 |
| Actor must strictly outrank the target's current role | spec "Manager scope: roles below Manager only" | 403 |
| Actor must strictly outrank the role being granted | spec "Who Can Assign" table | 403 — yields exactly the table: Admin ← Owner; Manager ← Owner/Admin; Creator/Analyst/Viewer ← Owner/Admin/Manager |
| At least one active Owner/Admin remains | BR-AUTH-030, §6.3 "Last Admin protection" | 409 (`assertNotLastAdministrator`) |
| Role must be a system role or one of *this* org's roles | tenant isolation | 404 (`resolveAssignableRole`) — a foreign org's custom role is indistinguishable from a missing one |

Paths covered: `POST /orgs/:orgId/members/assign-role`, `PATCH /orgs/:orgId/members/:memberId` (`roleId`),
`PATCH /users/:userId` (`roleId`, `status`), `DELETE /orgs/:orgId/members/:memberId`, `DELETE /users/:userId`.
Before this ticket only the first had guards (which could never fire), the other four had none — the two PATCH
routes were an unguarded bypass of whatever assign-role would have enforced.

## Design decisions

1. **Rank by `roles.level`, identity by `code`.** The pure rules compare `level` and only look at `code` for the
   two roles with special semantics (`owner`, `admin`). Custom org-scoped roles (future) slot into the same
   ladder through their own `level` without touching the policy. The static `ROLE_LEVELS` map and the seed's
   levels must stay in step (the seed test pins the levels).

2. **"Strictly below" collapses the spec's assignment table into one rule.** Admin cannot grant Admin
   (80 ≮ 80), so "Admin ← Owner only" holds; Manager cannot grant Manager; etc. Peer demotion (admin → another
   admin) is refused by the same rule — the spec table governs grants, and the common "no peers or superiors"
   reading is the conservative one. The Owner can still demote any admin.

3. **Self-change is refused for every role, not only Owner/Admin.** §6.3 names Owner/Admin; a blanket rule is a
   conservative superset with no product downside (a Manager demoting themself is not a workflow anyone asked
   for). Leaving an organization is a separate future feature.

4. **BR-AUTH-030 counts `owner`+`admin`+`super_admin` memberships that are `active` and `is_active`,
   excluding the target.** Through the HTTP routes the invariant is structural — only an Owner or a
   super_admin outranks an Admin, and both are themselves active administrators — so the 409 is reachable only
   for service-level callers (e.g. an owner whose membership was suspended by account deletion, then a cascade
   that removes the last admin). It is tested at the service level and kept as defense in depth for NWB-P0-023
   (org deletion) and P14.13 (admin console).

5. **One write path for `organization_members.role_id`.** `updateMember` and `updateUserAsAdmin` delegate a
   `roleId` to `assignRole` rather than duplicating checks; `assignRole` re-reads the profile locally to avoid a
   runtime import cycle with `member.service` (type-only import of `MemberProfile`).

6. **Seed retires the dropped roles instead of leaving them.** For `org_admin` → `admin` and `member` →
   `creator`, memberships/`users.role_id`/`user_roles` are re-pointed to the successor *before* the role row is
   deleted (the FK is `ON DELETE SET NULL`, and a NULL role is F-01 all over again). Role-permission mappings now
   **converge** on the matrix — stale grants are deleted, so re-running the seed after a matrix change is
   corrective, not merely additive. Verified idempotent (second run: no retirements, same counts).

7. **Audit rows use `module: "core"`.** `unified_audit_log` has `chk_ual_admin_requires_checksum`: rows with
   `module = 'admin'` must carry a tamper-evidence checksum, which `writeAuditLog` does not compute yet
   (P1-002 hash chain). These are organization-membership events, so `core` is also the correct module.
   Events: `organization.member.role_changed` (before/after role, optional reason), `organization.member.removed`,
   `organization.member.status_changed`, `organization.member.deleted`.

8. **F-21 fix uses `status = 'suspended'` + `deleted_at` + `is_active = false`.** `member_status` is
   `active | suspended | pending | invited`; the previous `'deactivated'` literal was an enum violation, so
   `DELETE /orgs/:orgId/members/:id` and `DELETE /users/:id` failed with a 500 on every call. Adding an enum value
   would be a schema change (`db:push` is not idempotent — NWB-P0-005/009), and `deleted_at IS NULL` is already
   the membership predicate everywhere; `suspended` is what `account-deletion.service.ts` writes for the same
   purpose.

## Findings filed, not fixed here

- **F-21 (High, fixed here, registered in §5):** member removal / admin user deletion 500'd on
  `invalid input value for enum member_status: "deactivated"`. Both routes were dead since they were written.
- **`DELETE /users/:userId` soft-deletes the *user account*, not just the membership** — an org admin can delete
  a user's platform account. Inherited behaviour, now at least guarded by rank; the right shape depends on D14
  (single- vs multi-org). Flagged for D14 / NWB-P0-023.
- **§6.3 "Ownership transfer required: Owner cannot delete account without transferring ownership first"** is not
  enforced in `account-deletion.service.ts` (an owner can self-delete and orphan the org's billing role). Belongs
  with NWB-P0-023 (org lifecycle) — no ownership-transfer flow exists yet to point the user at.
- **F-11 confirmed in passing:** admin user routes are `/api/users/:userId` (not `/api/users/admin/...` as
  the roadmap text implies); only registration order keeps `/users/me` out of `adminRouter`.

## Verification (2026-09-20, local: bun 1.4.2, PG 18 via npm `embedded-postgres`)

- `bun run typecheck` — clean
- `bun run lint` — no errors (new warnings are all `noExplicitAny` on the codebase's existing
  `NodePgDatabase<Record<string, any>>` / `(rows as any).rows` pattern)
- `bun run seed` twice on a DB that had `org_admin`/`member`: first run retires both and moves memberships;
  second run is a no-op (idempotent)
- `bun test` with DB — **227 pass / 0 fail** (was 167; +60: 43 pure matrix, 15 integration, 2 seed)
- `bun test` without DB — 0 fail (88 skipped, DB-gated)
- Red-first evidence (against the pre-fix tree, same tests): assign-role → **404** for every request
  (system-role lookup); admin demoting the Owner via `PATCH /members/:id` → **200** (no guard); member removal →
  **500** (enum). All now 200/403/204 as specified.

## Rollback

Revert the commit. Pre-production — no data migration. A DB seeded by this version keeps the 7 roles; the old seed
would re-create `org_admin`/`member` alongside them (harmless).

## Comments

- 2026-09-20 — the roadmap task text asked for "remove last admin → 409" through the routes; under DEC-039 that
  state is unreachable via HTTP (see decision 4), so the 409 is pinned at the service boundary instead. The
  roadmap's "manager can invite but not delete members" line does not match FR-ORG-006 (Manager *can* remove
  users below Manager); the spec matrix was followed and the roadmap text left as-is with this note.
