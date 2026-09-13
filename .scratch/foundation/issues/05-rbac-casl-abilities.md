# 05 — RBAC: CASL abilities + permission middleware

**What to build:** The role-based access control layer. On every authenticated request, the user's roles and permissions are loaded from the database and compiled into a CASL `Ability` instance. Protected routes declare required permissions via a `requireAbility()` middleware factory. After this ticket, any route can be protected declaratively: users without the right permission get a 403 before any service code runs.

**Blocked by:** 04 — Multi-tenant context middleware

**Status:** done

- [x] Ability factory service: queries `role_permissions` joined through `organization_members` → `roles` for the current user + org, returns CASL `Ability` instance
- [x] RBAC middleware: runs after auth middleware, loads ability, attaches to request context. Runs on every authenticated request (pre-computes to avoid per-route DB queries)
- [x] `requireAbility(action, subject)` middleware factory: returns middleware that checks ability; returns 403 Forbidden with error envelope if not authorized
- [x] `getAbility()` helper: returns current request's ability from context
- [x] Seed data for default roles (`super_admin`, `org_admin`, `member`, `viewer`) with their mapped permissions from the `permissions` table
- [x] Integration test: route protected by `requireAbility('read', 'User')` — user with permission gets 200, user without gets 403
- [x] Integration test: ability correctly resolves org-specific permissions (not global)
