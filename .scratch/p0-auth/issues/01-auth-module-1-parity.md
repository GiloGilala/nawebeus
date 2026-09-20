# Auth Module 1 parity — spec & implementation tracker

> **Status:** done (2026-09-20, NWB-P0-019) — 10/10 Module 1 FRs implemented: FR-AUTH-010 (API keys) shipped in NWB-P0-001 (2026-09-13) and FR-AUTH-006's accept half shipped in NWB-P0-016 (2026-09-20, incl. the DEC-039 invite ladder — note the module spec's "Owner can invite with Owner role" table row is superseded by DEC-039). DSAR export (AC8 of FR-AUTH-007) shipped in NWB-P0-002 — `src/services/users/dsar.service.ts`, covered by `src/tests/users/dsar-export.test.ts` — which closed the last FR-level gap.
> **Priority:** high
> **Source spec:** `docs/modules/Authentication & User Management.md`

## 1. Problem

The codebase (`src/`) is at the **Initial commit** stage. A comprehensive Drizzle schema exists in `db/` covering users, organizations, roles, permissions, sessions, tokens, API keys, and audit logging — but the runtime wiring only implements **signup → signin → refresh → signout** with a basic profile/org CRUD surface.

The Module 1 spec (`docs/modules/Authentication & User Management.md`) defines **10 functional requirements** and **~30 user stories**. The gap between what exists and what is specified is substantial: password complexity, password reset, email verification, MFA, session/device management, account deletion, invitations, role management, organization defaults, audit logging, and account lockout are all **absent** from the runtime.

## 2. Goals / Success Criteria

- All 10 FRs (FR-AUTH-001 → FR-AUTH-010) implemented with routes, services, and tests
- Password min 12 chars with full complexity (BR-AUTH-020) + history (last 5)
- Password reset flow (forgot → reset → token single-use, 1h TTL)
- Email verification (verify-email + resend, 24h TTL, max 3/hr)
- MFA TOTP setup/enable/disable (RFC 6238, ±30s)
- "Remember me" (30-day refresh) + rotating refresh tokens
- Session/device management (list + revoke individual/all)
- Account deletion (soft-delete, 30-day grace, reactivate)
- Account lockout (5 failures → 15-min lock; 20/IP/5min → 30-min IP block)
- User invitation flow (individual + bulk CSV, 7-day TTL)
- Role assignment management (Owner-can't-demote-self; can't-remove-last-Admin)
- Organization Nigerian defaults (NGN/WAT/en-NG) applied at runtime
- Audit log writer (every auth+profile+org mutation)
- `bun test` passes with 0 failures

## 3. What's Already Done (keep / extend)

- `db/schema.ts` — full schema declares `password_history`, `sessions`, `tokens`, `api_keys`, `audit_log`. **No schema changes needed;** only runtime wiring.
- `src/seed.ts` — seeds permissions + 6 roles.
- `src/services/auth/ability.ts` — CASL RBAC matrix (6-tier).
- `src/server/middleware/auth.ts` — JWT verification + org context via AsyncLocalStorage.
- `src/app/auth/signup.ts`, `signin.ts`, `refresh.ts`, `signout.ts` — basic flows (extend, don't replace).

## 4. What's Missing (build backlog)

| Priority | Feature | Files to create/extend |
|----------|---------|------------------------|
| P0 | Password complexity validator (12-char min, BR-AUTH-020 rules) | `src/lib/password.ts` |
| P0 | Password reset flow | `src/services/auth/password-reset.ts` + route |
| P0 | Email verification (resend + verify) | `src/services/auth/verification.ts` + routes |
| P0 | MFA TOTP setup/enable/disable | `src/services/auth/mfa.ts` + routes |
| P0 | "Remember me" + rotating refresh | extend `src/app/auth/signin.ts` |
| P0 | Session/device management | `src/app/sessions.ts` + service |
| P0 | Account deletion (soft-delete + 30-day grace) | `src/app/users/delete.ts` + service |
| P0 | Account lockout (brute force) | `src/services/auth/lockout.ts` + middleware |
| P0 | Audit log writer | `src/services/audit.ts` |
| P0 | Nigerian org defaults at signup | extend `src/app/auth/signup.ts` |
| P0 | User invitation flow | `src/services/invitations.ts` + routes |
| P0 | Role management | extend `src/app/orgs/members.ts` |
| P0 | Profile fields (phone, timezone, bio, job_title) | extend `src/app/users/profile.ts` |
| P1 | Bulk CSV invitations | extension of invitations service |
| P1 | DSAR export | extension of users service |

## 5. Out of Scope

| Feature | Phase |
|---------|-------|
| Enterprise SSO (SAML, Okta, Azure AD) | Phase 6 |
| SCIM automated provisioning | Phase 7 |
| Passwordless (magic links, WebAuthn) | Year 3 |
| Social login (Google, Microsoft, Apple) | Year 3 |
| SMS-based MFA | Phase 8 |
| Department / team hierarchy | Phase 9 |
| Advanced fraud detection | Phase 12 |

## 6. Technical Approach & Constraints

### Stack
- **Runtime**: Bun
- **HTTP**: Hono (`app.request()`)
- **ORM**: Drizzle ORM

### ADR conflicts to watch
- Check `docs/adr/` — if ADRs specify different token TTLs or hashing, follow the ADR over the Module 1 spec.
- If no ADR mandates an email provider, stub `src/services/email.ts` with a swappable transport.

### Nigerian market defaults (must be enforced at runtime)
- New org → `currency = 'NGN'`, `timezone = 'africa/lagos'`, `language = 'en-NG'`, `date_format = 'dd/mm/yyyy'`
- New user → `timezone = 'africa/lagos'` default
- All audit timestamps in WAT

### Self-protection rules
- Owner cannot demote themselves
- Last Admin in an org cannot be removed

## 7. Testing Seam

Highest seam = **HTTP route layer**. Tests use the existing `createTestApp(db)` helper (`src/tests/helpers/test-client.ts`) and `withTestDb()` for transactional DB rollback (`src/tests/helpers/test-db.ts`).

Pattern:
```ts
const app = createTestApp(testDb);
const res = await app.request("/api/auth/reset-password/abc", { method: "POST", ... });
expect(res.status).toBe(200);
```

**Run:** `bun test`

## 8. Acceptance / Done

- `bun test` passes (0 failures)
- All 10 FRs have ≥1 test per AC from the spec
- Code review passes (Standards + Spec axes)

---

## Comments

