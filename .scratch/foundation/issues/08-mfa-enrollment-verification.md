# 08 — MFA enrollment + verification

**What to build:** Two-factor authentication via TOTP. A user can enroll a TOTP authenticator app, verify enrollment, and then be required to provide a TOTP code during sign-in. After this ticket, users with MFA enabled have a second authentication factor protecting their account.

**Blocked by:** 03 — Auth: signin + sessions + JWT

**Status:** done

- [x] TOTP service: generates secret, generates QR code URI (for `otpauth://` scheme), verifies code against secret
- [x] `POST /api/auth/mfa/enroll` generates TOTP secret, returns QR code URI + backup codes (requires auth)
- [x] `POST /api/auth/mfa/verify` accepts TOTP code, marks MFA as enabled on user (requires auth)
- [x] Modified signin: if user has MFA enabled, `POST /api/auth/signin` returns 200 with `{ mfa_required: true, mfaSession: "temp_token" }` — does NOT issue session cookies
- [x] `POST /api/auth/mfa/challenge` accepts `{ mfaSession, code }`, validates TOTP, issues session cookies (same as normal signin)
- [x] `mfaSession` temporary token is a short-lived JWT (5 min) tied to the auth attempt
- [x] Failed MFA challenge (invalid code) returns 401 with remaining attempts count
- [x] After 5 failed MFA attempts, the `mfaSession` is invalidated
- [x] Integration test: enroll MFA returns QR URI
- [x] Integration test: verify valid TOTP code enables MFA
- [x] Integration test: signin with MFA-enabled user returns mfa_required
- [x] Integration test: complete MFA challenge with valid code issues session
- [x] Integration test: invalid MFA code returns 401
