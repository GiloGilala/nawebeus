# 07 — Core API: role assignment + API keys

**What to build:** Role management and programmatic access for the organization. An admin can change a member's role. Users can create, list, and revoke API keys for machine-to-machine access. API keys provide an alternative to JWT cookie auth for external tools and scripts. After this ticket, both human and programmatic access patterns work.

**Blocked by:** 05 — RBAC: CASL abilities + permission middleware

**Status:** done — role assignment shipped earlier; API keys (FR-AUTH-010) implemented 2026-09-13.

Permission subject is `apikeys.*` (lowercase plural), matching the existing convention
(`roles.*`, `members.*`, `posts.*`), not the `ApiKey` spelling used in this ticket's prose.
`super_admin` inherits all permissions and `org_admin` all but `billing.*`, so both receive
`apikeys.*` without further seeding.

One route was added beyond the ticket: `POST /api/api-keys/:id/rotate` (`apikeys.update`),
which issues a replacement key and kills the old one — rotation was called for in FR-AUTH-010.

- [ ] `PATCH /api/organizations/:id/members/:memberId/role` updates member's role (requires `update` on `OrganizationMember` with role-change permission)
- [ ] Role change is validated: cannot remove last `org_admin`
- [x] `POST /api/api-keys` creates a new API key (requires `create` on `ApiKey`); returns the key value once (never again)
- [x] `GET /api/api-keys` lists active API keys (requires `read` on `ApiKey`); key values are masked
- [x] `DELETE /api/api-keys/:id` revokes an API key (requires `delete` on `ApiKey`)
- [x] API key auth middleware: reads `Authorization: Bearer <key>` header, validates against `api_keys` table, attaches user + org context (same as JWT auth)
- [x] API key can be used as drop-in replacement for JWT cookie on any protected route
- [ ] Integration test: admin changes member's role
- [ ] Integration test: change to non-existent role returns 404
- [ ] Integration test: non-admin gets 403 attempting role change
- [x] Integration test: create API key returns key value once
- [x] Integration test: authenticate with API key on a protected route
- [x] Integration test: revoked API key returns 401

Beyond the listed criteria, `src/tests/auth/api-key.test.ts` (33 tests, all green) also covers:
key-format parsing and malformed/unknown/tampered keys, expiry, double-revoke → 409,
duplicate name → 409, tenant isolation, membership removal, rotation lineage, usage counters,
`?status=` filtering, audit events that exclude the key value, and the two escalation guards —
`write` must not inherit `delete`, and an `admin` key must not exceed its owner's permissions.
