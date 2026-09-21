# 07 — Core API: role assignment + API keys

**What to build:** Role management and programmatic access for the organization. An admin can change a member's role. Users can create, list, and revoke API keys for machine-to-machine access. API keys provide an alternative to JWT cookie auth for external tools and scripts. After this ticket, both human and programmatic access patterns work.

**Blocked by:** 05 — RBAC: CASL abilities + permission middleware

**Status:** done — API keys (FR-AUTH-010) implemented 2026-09-13; role assignment
shipped in NWB-P0-014 (2026-09-20) and its checklist reconciled against the code in
NWB-P0-006 (2026-09-20). Two criteria that had no test behind them now have one —
see `.scratch/p0-foundation-gap/issues/06-reconcile-foundation-07.md` for the audit.

Permission subject is `apikeys.*` (lowercase plural), matching the existing convention
(`roles.*`, `members.*`, `posts.*`), not the `ApiKey` spelling used in this ticket's prose.
`super_admin` inherits all permissions and `org_admin` all but `billing.*`, so both receive
`apikeys.*` without further seeding.

One route was added beyond the ticket: `POST /api/api-keys/:id/rotate` (`apikeys.update`),
which issues a replacement key and kills the old one — rotation was called for in FR-AUTH-010.

- [x] `PATCH /api/organizations/:id/members/:memberId/role` updates member's role (requires `update` on `OrganizationMember` with role-change permission) — **shipped at two paths, neither of them this one**: `POST /api/orgs/:orgId/members/assign-role` (the dedicated route) and `PATCH /api/orgs/:orgId/members/:memberId` when the body carries `roleId`, which runs the identical guards. This ticket's path is historical: the tree uses `orgs` not `organizations`, `:orgId` not `:id`, and the subject `members` (same compact-prefix convention as the `apikeys` note above). Both routes require `update` on `members`.
- [x] Role change is validated: cannot remove last `org_admin` — **ticked against the successor rule.** `org_admin` was retired by DEC-039 (the ladder is now `owner`/`admin`; the seed re-points pre-DEC-039 memberships). `assertNotLastAdministrator` (`src/services/orgs/role-policy.ts`) is the wider replacement: it refuses any demotion or removal that would leave no *other* active Owner-or-Admin, counting `owner`, `admin` and `super_admin` (BR-AUTH-030).
- [x] `POST /api/api-keys` creates a new API key (requires `create` on `ApiKey`); returns the key value once (never again)
- [x] `GET /api/api-keys` lists active API keys (requires `read` on `ApiKey`); key values are masked
- [x] `DELETE /api/api-keys/:id` revokes an API key (requires `delete` on `ApiKey`)
- [x] API key auth middleware: reads `Authorization: Bearer <key>` header, validates against `api_keys` table, attaches user + org context (same as JWT auth)
- [x] API key can be used as drop-in replacement for JWT cookie on any protected route
- [x] Integration test: admin changes member's role — `src/tests/orgs/role-assignment.test.ts`: "owner promotes a viewer to admin; the member's ability changes immediately" (also asserts the `member_role_history` row and the audit event), plus the `manager` and peer-`admin` scope tests.
- [x] Integration test: change to non-existent role returns 404 — added in NWB-P0-006: "a role id that exists nowhere returns 404, not 403 or 500". Asserts the member's role is unchanged, so a failed lookup is never a partial write. A sibling test covers the same class for the *member* id ("a user who is not a member of this organization returns 404"), which this checklist never named.
- [x] Integration test: non-admin gets 403 attempting role change — added in NWB-P0-006: "a member without members.update cannot assign roles at all (403 at the ability gate)". A `creator` is refused by `requireAbility` before the hierarchy policy is reached.
- [x] Integration test: create API key returns key value once
- [x] Integration test: authenticate with API key on a protected route
- [x] Integration test: revoked API key returns 401

Beyond the listed criteria, `src/tests/auth/api-key.test.ts` (33 tests, all green) also covers:
key-format parsing and malformed/unknown/tampered keys, expiry, double-revoke → 409,
duplicate name → 409, tenant isolation, membership removal, rotation lineage, usage counters,
`?status=` filtering, audit events that exclude the key value, and the two escalation guards —
`write` must not inherit `delete`, and an `admin` key must not exceed its owner's permissions.
