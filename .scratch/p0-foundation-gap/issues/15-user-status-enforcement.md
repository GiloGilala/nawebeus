# NWB-P0-015 — Enforce user status at sign-in (F-05)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 325/325
`bun test` with a live database, 208 pass / 123 skip / 0 fail without one; CI re-run
pending)
**Deps:** none. **Size:** M.
**Fixes:** F-05 (suspended/pending accounts could authenticate and act).
Found en route: F-24, F-25, F-26, F-27 (see their tickets).

## What was built

| Layer | File |
| --- | --- |
| `assertAccountCanAuthenticate(status)` — the one status rule | `src/services/auth/auth.service.ts` (exported) |
| Gate after the password check (`suspended` → 403, no enumeration) | `src/services/auth/auth.service.ts` (`signIn`) |
| Same gate when an MFA challenge completes | `src/services/auth/auth.service.ts` (`verifyMfaChallengeLogin`) |
| `emailVerified` on every completed/carried sign-in | `SignInResult` + both routes + `signinServerFn` |
| `AccountSuspendedError` (403, `ACCOUNT_SUSPENDED`) | `src/lib/errors.ts` |
| Per-request re-check for cookie **and** API-key principals | `src/server/middleware/auth.ts` (`assertActivePrincipal`) |
| Tests | `src/tests/auth/user-status.test.ts` (new, 8 tests) |

## Policy

- **Allowed to hold a session: `active` and `pending_verification`.** Anything else is
  refused; `suspended` gets 403 `ACCOUNT_SUSPENDED`, `deleted`/unknown gets the generic
  401 so a status is never disclosed to a caller who has not proven the password.
- **Checked after the password, never before** — otherwise the 403 turns sign-in into an
  account-enumeration oracle. Pinned by a test (wrong password on a suspended account ⇒
  401 `AUTH_ERROR`).
- **`pending_verification` is deliberately allowed.** The verification email is
  console-only in dev, so a hard block would strand every new signup until Phase 2 ships
  a real provider. The response carries `emailVerified: false` so the client gates
  features itself; the server-side gate lands with real email delivery (Phase 2) — the
  PRD's "unverified users cannot access platform features" is only half-satisfied until
  then, by design, and recorded here.
- **Effective at the next request, not the next sign-in.** `authMiddleware` re-checks the
  account on every request for both the session-cookie and API-key paths, so a suspension
  cannot be outlived by a 15-minute access token (the roadmap's "acceptable ≤15 min" is
  beaten outright). One statement returns the membership, the status and the soft-delete
  flag, so the extra guard costs no extra round trip.
- **Reactivating restores the same session** — the suspension check is a live read, not a
  flag burned into the token (test-pinned).

## Acceptance criteria

- [x] `suspended` cannot authenticate — 403, no cookies issued
- [x] No enumeration: the 403 requires a correct password
- [x] Reactivation clears the block
- [x] `pending_verification` signs in and the response says `emailVerified: false`
- [x] A suspension stops an in-flight session **and** its API keys at the next request
- [x] `bun test` green with DB; typecheck, lint, build green

## Red-green evidence

Against the pre-ticket code (gate removed from both `signIn` and `authMiddleware`): **4 of
the 8 new tests fail** (suspended sign-in 200 instead of 403, reactivation, in-flight
session 200 instead of 403, suspended owner's API key 200 instead of 403). The remaining
four (enumeration, `emailVerified` reporting, soft-deleted 401) pin behaviour that existed
and must not regress.

## Deviations & findings

- **A new error class, not `ForbiddenError`.** The roadmap suggested "new `SuspendedError`
  → 403"; named `AccountSuspendedError` for symmetry with `AccountLockedError` so a client
  can tell an administrator's decision (403, needs a human) from a lockout (423, clears
  itself).
- **`emailVerified` was added to the signin *and* verify-login responses** (and to
  `signinServerFn`); the roadmap only specified the signin response. The MFA path completes
  a login, so it must report the same shape — the client decides where to route before it
  knows which factor the account uses.
- **The status gate lives in the service, and the middleware imports it.** Duplicating the
  rule in a second place is exactly what F-26 was; one exported predicate is used by all
  three call sites.
- **Not done, deliberately:** `AC6` (trust-this-device) and `AC7` (Owner/Admin MFA
  enforcement + grace) stay deferred per the ticket's own scope note; no audit event is
  written for a blocked sign-in (the attempt is already counted by the IP limiter, and the
  failed-login path is un-audited by design — audit events are for mutations).
