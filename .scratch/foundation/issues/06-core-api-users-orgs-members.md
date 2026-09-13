# 06 — Core API: user profile + organization + members

**What to build:** The foundational CRUD routes for managing user profiles, organizations, and organization memberships. A user can view and update their own profile. An organization admin can view and update organization settings, list members, and invite new members (email delivery stubbed). After this ticket, the basic organizational structure is manageable through the API.

**Blocked by:** 05 — RBAC: CASL abilities + permission middleware

**Status:** done

- [x] `GET /api/users/me` returns current user's profile (requires auth)
- [x] `PATCH /api/users/me` updates profile fields (name, avatar, etc.) (requires auth)
- [x] `GET /api/organizations/:id` returns organization settings (requires `read` on `Organization`)
- [x] `PATCH /api/organizations/:id` updates organization settings (requires `update` on `Organization`)
- [x] `GET /api/organizations/:id/members` lists members with roles (requires `read` on `OrganizationMember`)
- [x] `POST /api/organizations/:id/members` creates invitation (requires `create` on `OrganizationMember`); email notification stubbed to console
- [x] All routes return consistent JSON envelope
- [x] Permission checks enforced: member without `update:Organization` gets 403 when trying to update org settings
- [x] Integration test: user fetches own profile
- [x] Integration test: user updates own profile
- [x] Integration test: admin updates org settings
- [x] Integration test: non-admin gets 403 updating org settings
- [x] Integration test: org admin lists members
- [x] Integration test: org admin invites new member
