# Foundation: Core Application Infrastructure

**Spec ID:** `foundation-001`
**Status:** `done` — 10/10 foundation issues done (2026-09-20). Issue 07 was the last
open one: API keys landed in NWB-P0-001 (2026-09-13), role assignment in NWB-P0-014
(2026-09-20), and its checklist was reconciled against the code — with the two missing
integration tests written — in NWB-P0-006 (2026-09-20). Note that several issues were
marked `done` here while defects in the same surface were still open; those were filed
and closed separately under `.scratch/p0-foundation-gap/` (F-01…F-28), which is the
tracker to read for the current state of this code, not this spec.
**Triage:** None needed (produced by `/to-spec`)
**Depends on:** None (first buildable slice)

---

## Problem Statement

Nawebeus has a complete, well-tested database schema (~70 tables across 12 modules) but **zero runtime code**. There is no way to authenticate users, serve an API, execute business logic, or run a migration. Every downstream feature — social account integration, publishing, monitoring, engagement — depends on a shared foundation that does not yet exist. Engineers cannot begin feature work until the core infrastructure (project layout, database connection, auth, multi-tenant context, RBAC, error handling, and testing patterns) is in place.

## Solution

Build the **Core Application Infrastructure** — the foundational layer that every feature module builds on. This delivers:

1. A standard `src/` project structure split into framework-agnostic services (`src/services/`), Hono API routes (`src/server/`), and TanStack Start pages (`src/app/`).
2. Database connection pool managed through Drizzle ORM, with drizzle-kit migration support wired into the build pipeline.
3. A complete authentication system: email/password signup, sign-in with JWT access + refresh token cookies, session management, and MFA enrollment/verification.
4. Multi-tenant request context that extracts `organization_id` from the authenticated JWT and injects it into every downstream call — no service method needs to parse auth headers.
5. Role-based access control via CASL, with abilities derived from the `roles` and `role_permissions` tables at request time.
6. Core API routes: user profile CRUD, organization management, role/permission assignment, API key management, and session listing/revocation.
7. A typed error hierarchy (per ADR-016) and consistent JSON response envelope for all API responses.
8. A test scaffold with Hono API integration tests as the primary seam (per ADR-014 testing standards).

Everything downstream (social accounts, publishing, monitoring, billing, etc.) imports from this foundation — it never imports back.

## User Stories

1. As a **platform engineer**, I want a standard `src/` project layout with clear boundaries between web, API, and services, so I can add feature modules without restructuring the project.

2. As a **platform engineer**, I want Drizzle configured to use the existing `db/schema.ts` with a connection pool, so migrations generate against the real schema and queries resolve correctly.

3. As a **platform engineer**, I want a `migrate` and `seed` command that applies pending migrations and populates a default admin user + organization, so the application is bootable after checkout.

4. As a **potential customer**, I want to sign up with my email address and a password, so I can create a Nawebeus account.

5. As a **potential customer**, I want to receive a verification email after signup, so I can confirm my email address is valid.

6. As a **verified user**, I want to sign in with my email and password, so I can access the platform.

7. As a **verified user**, I want my session to persist across page reloads via HTTP-only cookies, so I don't have to sign in on every visit.

8. As a **verified user**, I want my access token to be refreshed automatically when it expires, so my session is seamless.

9. As a **verified user**, I want to sign out, which invalidates my current session, so I can secure my account on shared devices.

10. As a **verified user**, I want to enable MFA on my account, so my account is protected beyond just a password.

11. As a **verified user**, I want to provide my MFA code during sign-in when MFA is enabled, so I can complete the authentication flow.

12. As an **organization owner**, I want to create an organization, so my team can collaborate under a shared tenant.

13. As an **organization owner**, I want to invite team members to my organization, so they can access shared resources.

14. As an **organization admin**, I want to assign roles to organization members, so they have appropriate permissions.

15. As an **organization member**, I want my API requests to be automatically scoped to my organization, so I never accidentally access another org's data.

16. As a **developer building features**, I want a `getOrgContext()` helper that returns the current org ID from the request context, so I never parse auth headers in service code.

17. As a **platform engineer**, I want all API responses to follow a consistent JSON envelope (`{ data, meta, errors }`), so API consumers (mobile app, webhooks) have a predictable contract.

18. As a **platform engineer**, I want a typed error hierarchy (`AppError` → `AuthError | ValidationError | NotFoundError | ConflictError`), so error handling is uniform across the stack.

19. As a **developer building features**, I want to write integration tests that hit the Hono API in-process, so I can test the full auth → middleware → service → database flow.

20. As an **organization admin**, I want to create and revoke API keys for programmatic access, so external tools can integrate with Nawebeus.

21. As a **platform engineer**, I want the User and Organization tables seeded with a bootstrap admin account, so the first login is possible without a signup flow.

22. As a **platform engineer**, I want the `users` table to have a `lastLoginAt` timestamp updated on every successful sign-in, so audit trails are accurate.

23. As a **platform engineer**, I want password hashing using bcrypt (or Bun-native argon2), so credentials are never stored in plaintext.

24. As a **platform engineer**, I want rate-limiting on auth endpoints (sign-in, signup, password reset), so brute-force attacks are mitigated.

25. As a **platform engineer**, I want CORS configured for local development (localhost:3000) and the production domain, so the API is accessible from the web app.

## Implementation Decisions

### Project Structure (per ADR-002, ADR-007)

```
src/
  app/                  # TanStack Start web app (file-based routes)
    routes/
    components/
    lib/                # React hooks, TanStack Query wrappers
  server/               # Hono API entry point
    index.ts            # Hono app mounted at /api/*
    middleware/
      auth.ts           # JWT verification, org context injection
      rbac.ts           # CASL ability derivation
      error-handler.ts  # Global error → JSON response mapping
      rate-limit.ts     # Per-endpoint rate limiting (SQLite-backed)
    routes/
      auth/             # signup, signin, signout, mfa, refresh
      users/            # profile CRUD
      organizations/    # create, invite, member management
      roles/            # role & permission assignment
      api-keys/         # create, list, revoke
  services/             # Framework-agnostic business logic
    auth/
      auth.service.ts
      password.service.ts
      mfa.service.ts
      session.service.ts
    organization/
      org.service.ts
      member.service.ts
    user/
      user.service.ts
    api-key/
      api-key.service.ts
    rbac/
      ability.service.ts
  lib/                  # Shared utilities
    errors.ts           # Typed error hierarchy (ADR-016)
    response.ts         # JSON envelope helpers
    db.ts               # Drizzle client singleton
    config.ts           # Environment variable loader
  tests/                # Integration tests (primary seam)
    helpers/
      test-db.ts        # Test database setup/teardown
      test-factory.ts   # Factory functions for test data
      test-client.ts    # Hono request helper
    auth.test.ts
    users.test.ts
    organizations.test.ts
```

### Service Layer Contract

Every service function:
- Is an async function that accepts `DrizzleClient` as its first parameter (explicit dependency injection — no global singleton in service code).
- Returns a typed result or throws a typed `AppError` subclass.
- Does NOT import from Hono, TanStack Start, or any HTTP framework.

```typescript
// Example service signature (not literal code — captures the contract)
type ServiceResult<T> = T;
// Errors are thrown, not returned. They bubble up to the Hono error handler.

// Every service function signature:
async function doSomething(
  db: DrizzleClient,
  orgId: string,
  params: Input,
): Promise<ServiceResult<Output>>;
```

### Auth Flow (per ADR-010)

1. **Signup**: `POST /api/auth/signup` → creates `users` row + `organization_members` row + default `organization`. Returns 201 with user profile. Triggers email verification flow (stub in MVP — email service is out of scope).

2. **Signin**: `POST /api/auth/signin` → validates credentials, checks MFA requirement, issues two JWTs:
   - **Access token** (15 min, in HTTP-only cookie `nawebeus_access`)
   - **Refresh token** (7 days, in HTTP-only cookie `nawebeus_refresh`, stored as hashed value in `sessions` table)
   
3. **Token refresh**: `POST /api/auth/refresh` → validates refresh token against `sessions` table, rotates it (invalidates old, issues new), returns new access token.

4. **Signout**: `POST /api/auth/signout` → deletes session from `sessions` table, clears cookies.

5. **MFA enrollment**: `POST /api/auth/mfa/enroll` → generates TOTP secret, returns QR code URI. User scans with authenticator app.

6. **MFA verification**: `POST /api/auth/mfa/verify` → validates TOTP code, marks MFA as enabled on user.

### Multi-Tenant Context (per ADR-009)

- On every authenticated request, the `auth` middleware extracts `organization_id` from the JWT claims and stores it in a `AsyncLocalStorage` context.
- Service functions call `getOrgContext()` to retrieve the current org ID — they never parse cookies or headers directly.
- Row-level security is configured in PostgreSQL (future milestone — not MVP), but the application-layer org scoping is built from day one.

### RBAC (per ADR-006)

- On every authenticated request, the `rbac` middleware pre-computes the user's CASL `Ability` instance by querying `role_permissions` joined through `organization_members` → `roles`.
- The ability is attached to the request context. Service functions or route handlers call `verifyAbility(action, subject)` or use the `@requireAbility` middleware decorator.
- Admin routes block at the middleware level. Feature-specific permission checks happen in service code.

### API Response Envelope (per ADR-014)

```typescript
// Success
{
  "data": T,                    // The response payload
  "meta": {                     // Pagination / metadata (optional)
    "page": 1,
    "pageSize": 20,
    "total": 142
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR", // Machine-readable, stable
    "message": "Email is required", // Human-readable
    "details": [                // Field-level errors (optional)
      { "field": "email", "message": "must be a valid email" }
    ],
    "requestId": "req_abc123"  // Correlation ID for support
  }
}
```

### Error Hierarchy (per ADR-016)

```
AppError (abstract)
├── AuthError
│   ├── InvalidCredentialsError
│   ├── SessionExpiredError
│   ├── MfaRequiredError
│   └── MfaVerificationFailedError
├── ValidationError
│   └── (field-level details via details array)
├── NotFoundError
├── ConflictError (e.g., duplicate email)
├── RateLimitError
└── InternalError (unexpected — 500, no details leaked)
```

### Seed Data

A `seed.ts` script creates:
- A bootstrap organization ("Nawebeus" or configurable name)
- A super-admin user with known credentials (read from env vars `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`)
- Default roles: `super_admin`, `org_admin`, `member`, `viewer`
- Default permissions for each role (mapped from `permissions` table)

### Rate Limiting (per ADR-015)

Auth endpoints rate-limited via SQLite-backed token bucket:
- Sign-in: 5 attempts per email per 15 minutes
- Signup: 3 per IP per hour
- Password reset: 2 per email per hour
- General API: 1000 requests per org per minute

SQLite path: `./data/rate-limit.db` (not committed, created at runtime).

### Config & Environment

```env
# Required
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# Optional with defaults
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
SEED_ADMIN_EMAIL=admin@nawebeus.com
SEED_ADMIN_PASSWORD=changeme123
```

Config is loaded once at startup via `src/lib/config.ts`, validated with Zod, and exported as a typed `const config` object. No `process.env` accesses outside this file.

## Testing Decisions

### Seam Strategy (confirmed)

| Seam | Scope | Why This Level |
|------|-------|----------------|
| **Primary: Hono API integration tests** | Full auth → middleware → service → database flow through in-process Hono requests | Tests the public contract; exercises real auth, real RBAC, real DB queries. Catches middleware misconfiguration, schema drift, and permission bugs. |
| **Secondary: Service unit tests** | Individual service functions with isolated DB transaction | Used for business logic edge cases (e.g., password complexity rules, MFA code validation) where driving state through the API would be verbose. |
| **Tertiary: DB query tests** | Drizzle query shape validation | Rare — only for complex reporting queries where the SQL must be verified. |

### What Makes a Good Test

- **Tests behaviour, not implementation.** A test for sign-in sends `POST /api/auth/signin` with valid credentials and asserts it gets a 200 with a session cookie. It does NOT mock the password hasher or inspect the JWT payload.
- **One behaviour per test.** A test for duplicate email signup asserts exactly that: 409 Conflict. It does not also check the error message format in the same assertion.
- **Use factories, not fixtures.** Test data is generated by `test-factory.ts` functions, not hand-written JSON. Factories produce valid-by-default rows that tests override only for their specific scenario.
- **Transaction rollback.** Every test wraps in a database transaction that is rolled back after the test completes. No test pollutes the database for other tests.

### Test Database Setup

- A test PostgreSQL database (`nawebeus_test`) is created via a setup script.
- Before the test suite runs, all migrations are applied via `drizzle-kit push`.
- Each test file opens a fresh Drizzle client connected to a `pg` pool with `SAVEPOINT`-based isolation (or a schema-per-test-file pattern — confirmed at implementation time).
- The `test-client.ts` helper creates a Hono app instance with all middleware and routes registered, then provides a `fetch`-like interface so tests don't need an HTTP server.

### Prior Art

No existing tests in the codebase (this is the first build). The testing patterns follow:
- **Bun test** as the test runner (per `package.json` scripts)
- **Hono's built-in testing** — Hono apps are functions, not servers; they can be invoked in-process with `app.request(path, options)`
- **Drizzle's transactional testing pattern** — each test wraps in a Drizzle transaction that rolls back

## Out of Scope

- **Email sending** — verification emails and password resets are stubbed (console.log placeholder). An email service integration is a separate ticket.
- **Password reset flow** — the schema has `password_reset_tokens` but the API for "forgot password" is deferred. The reset endpoint requires a signed-in session to change password.
- **Row-level security policies** — RLS is documented in ADR-009 but requires DDL-level setup. The application-layer org scoping is built in this spec; RLS is a future hardening milestone.
- **WebSocket support** — ADR-013 is accepted but real-time features are not in this foundation spec.
- **Third-party OAuth** (Google, etc.) — only email/password auth. Social login is a separate spec.
- **Admin dashboard UI** — this spec covers the API only. The TanStack Start web app pages are a separate ticket.
- **Any feature module** (social accounts, publishing, monitoring, etc.) — each gets its own spec. This foundation is the dependency for all of them.
- **File uploads / media assets** — the `media_assets` table exists but the upload endpoint is deferred.
- **Billing / subscription enforcement** — the billing schema exists but plan limits are not enforced in this foundation spec.
- **Audit logging** — the `audit_log` table exists but writing audit events is deferred to each feature spec (each feature knows what to audit).
- **CI/CD pipeline** — GitHub Actions, lint-staged, etc. are deferred.

## Further Notes

- **Module conventions** are established here. Every future feature module should follow the same pattern: routes in `src/server/routes/<module>/`, services in `src/services/<module>/`, tests in `src/tests/<module>.test.ts`.
- The `src/app/` directory (TanStack Start) is **created but left minimal** — just a health-check page and a sign-in page skeleton. Full UI pages are separate tickets.
- The `db/` structure is treated as read-only during this build. No schema changes are expected; if one is discovered necessary, it must be proposed and documented separately.
- This spec produces **the base image** for all subsequent feature specs. Every future spec should assume this infrastructure is in place and import from it.
