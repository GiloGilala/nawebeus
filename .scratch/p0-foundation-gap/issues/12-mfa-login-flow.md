# NWB-P0-012 — Complete the MFA login flow (F-03, F-04, F-04b)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
267/267 `bun test` with a live database, twice in a row, litter-free; CI re-run pending)
**Deps:** F-10 (IP policy) — soft; this ticket mirrors `signin.route.ts`'s header
read and notes the NWB-P0-017 upgrade path. **Size:** M.
**Fixes:** F-03 (incl. a bypass facet the register didn't know about), F-04, F-04b.
Prerequisites fixed en route: F-12's upsert (reclaim + tests stay with NWB-P0-013),
F-22 (`tokens.selector`, found here), F-23 (`withAtomicWrites` probe, found here).

## What was built

| Layer | File |
| --- | --- |
| Challenge + verify + staged setup + hashed codes + AC8 gate | `src/services/auth/mfa.ts` (rewritten) |
| Session-issuance extraction + challenge completion + single-shot fix | `src/services/auth/auth.service.ts` |
| `POST /mfa/verify-login` (public) | `src/app/auth/mfa.route.ts` |
| Shared cookie helper (extracted from signin) | `src/app/auth/session-cookies.ts` (new) |
| Challenge response shape (`mfaSessionId`, no `sessionId`) | `src/app/auth/signin.route.ts` |
| `retryAfter` serialised into 429 envelopes | `src/lib/response.ts` |
| Pending staging columns; `selector` 32 → 64 | `db/core/users.ts`, `db/core/tokens.ts` |
| Prerequisite: window-aware limiter upsert | `src/lib/rate-limit.ts` |
| Prerequisite: savepoint-based in-tx probe | `src/lib/transaction.ts` |
| Tests | `src/tests/auth/mfa-login.test.ts` (new, 18 tests) |
| Register | `docs/plan/master-roadmap/02-defects.md` (F-03/F-12 updated, F-22/F-23 added) |

## Flow

1. `POST /api/auth/signin` (password only, MFA enabled) → 200
   `{ requiresMfa: true, mfaMethod: "totp", mfaSessionId }`, no cookies. The
   challenge is a `tokens` row (`token_type 'otp'`, purpose `'mfa_challenge'`,
   15-min TTL, `max_uses 1`); issuing one revokes prior unused ones.
2. `POST /api/auth/mfa/verify-login` `{ mfaSessionId, code, rememberMe? }` →
   peek challenge (no state change on failure) → AC8 gate (3/15 min per
   user+IP) → verify TOTP or backup code → burn challenge → issue session +
   cookies via the shared helper.
3. Single-shot `mfaCode` in signin still works (TOTP or backup code), verified
   and AC8-gated identically — it shares the limiter key with the challenge
   path so neither bypasses the other's budget.

Setup is confirm-or-discard via `pending_two_factor_*` columns; confirm
promotes staged → active. Backup codes are SHA-256 hex digests; the display
set ≡ stored set is pinned by hashing the displayed codes in-test.

## Acceptance criteria

- [x] Full flow: enable → signin → challenge → verify → cookies + working session
- [x] AC8: 4th attempt within 15 min → 429, even with the correct code
- [x] Backup code path works with the displayed code; single-use; stored hashed
- [x] Abandoned re-setup keeps old MFA functional
- [x] MFA-disabled signin unaffected; challenge single-use + expiry honored
- [x] AC9: enable/disable/verified/failed all audited
- [x] `bun test` green with DB; typecheck, lint, build green

## Deviations & findings

- **F-03 was a bypass, not just a dead end.** The single-shot path never
  awaited the async `verifyTOTP` (a Promise is truthy → the check never fired)
  and passed its arguments swapped. Any 6-character code completed an MFA
  login. Proven red: the new wrong-code test returns 200 against the old code
  (verified via `git stash`), 401 against the new.
- **SHA-256 vs bcrypt (spec AC4).** Per the roadmap: SHA-256 hex per code,
  deviation recorded. Caveat for a future hardening pass: codes are 8-char
  UUID slices (~32 bits), so an offline DB leak admits brute force; bcrypt
  would close that at the cost of ~10 sequential verifies per login attempt.
  Online guessing stays infeasible under AC8 either way.
- **AC8 as rate-limit, not account lock.** The spec's login flow says "3
  consecutive failures → lock account 15 min"; implemented as the roadmap
  specifies (429 after 3 attempts/15 min per user+IP). Keyed per user+IP
  rather than per challenge, so a password-compromised attacker can't mint
  unlimited guesses by re-signing-in.
- **Pending columns over the tokens table** for setup staging: `tokens` has no
  payload column (`scopes`/`redirectUri` abuse would mislead), and both setup
  endpoints are authenticated, so per-user columns are the natural key. The
  roadmap allows either.
- **Challenge peek-then-revoke**, not `consumeToken` per attempt: consuming on
  failure would burn the challenge on the first wrong code, contradicting the
  3-attempt allowance. (Also note, not fixed here: `consumeToken` never
  selects `max_uses`, so `maxUses > 1` is silently single-use — someone else's
  ticket.)
- **`rememberMe` is accepted in the verify-login body** (default false); the
  challenge carries no login options.
- **F-12 is worse than the register said** (complete no-op, count stuck at 1 —
  verified empirically) and is a prerequisite for any AC8 gate, so this ticket
  adopts NWB-P0-013's specified upsert verbatim, with `$windowStart`/
  `$windowEnd` defined as clock-anchored fixed windows (the only semantics
  under which the snippet's CASE is correct; a sliding begin would reset the
  count on every call). **NWB-P0-013 retains** the reclaim path, dedicated
  limiter tests (rollover, reclamation), and doc updates; semantics note left
  in `rate-limit.ts` for that session. Boundary burst (2× max across a window
  edge) accepted per the specified semantic.
- **F-22 (found here, fixed as prerequisite):** `tokens.selector` varchar(32)
  vs 64-char `generateSecureToken()` — every `createToken` 500'd with 22001,
  breaking password-reset, email-verification, and email-change end to end
  (no DB test ever exercised `createToken`). Widened to varchar(64); all three
  flows smoke-verified at 200.
- **F-23 (found here, fixed as prerequisite):** `withAtomicWrites`' in-tx
  probe (`txid_current_if_assigned() IS NOT NULL`) reads NULL until the first
  *write*, so read-first callers took the production path whose stray COMMIT
  ended the test harness's outer transaction — 169 users of litter, an
  order-dependent suite, and committed `ip:unknown` limiter rows that the
  fixed F-12 limiter then (correctly) tripped on. Probe is now a throwaway
  SAVEPOINT pair. Suite re-verified litter-free (seed rows only) across
  repeat runs. Latent prod variant (stray COMMIT inside a real write-less
  drizzle tx) closed by the same fix.
- **Response shape change (intended):** the `requiresMfa` response now carries
  `mfaSessionId` instead of `sessionId: userId`. No working client can depend
  on the old shape — the flow it belonged to was a dead end.
- **Untouched, as scoped:** AC6 (trust-device), AC7 (enforcement) — post-MVP
  per the roadmap. `MfaRequiredError`/`MfaVerificationFailedError` remain
  unused (the flow signals MFA in-band with 200 + `requiresMfa`); removing
  them is a cleanup ticket's call, not this one's.
- **Tracker note for NWB-P0-019:** `.scratch/p0-auth/issues/01-auth-module-1-parity.md`
  still says 9/10 FRs with FR-AUTH-010 unbuilt — stale before this ticket, and
  019 already owns flipping it.
