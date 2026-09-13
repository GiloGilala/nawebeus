# 02 — Auth: signup

**What to build:** The account registration flow. A visitor provides an email and password, and receives a created user account with a personal organization and an organization membership. The password is hashed before storage. An email verification stub logs the verification link to console (real email delivery is out of scope). After this ticket, a user can sign up and receive a confirmation that their account exists.

**Blocked by:** 01 — Project scaffold + config + DB + error framework

**Status:** done

- [x] Password hashing service: `hash(plaintext)` returns hash, `verify(plaintext, hash)` returns boolean
- [x] Auth service: `signup(email, password)` creates `users` row + `organizations` row (named after user) + `organization_members` row (owner role)
- [x] `POST /api/auth/signup` accepts `{ email, password }`, validates input (email format, password min length), returns 201 with user profile
- [x] Duplicate email returns 409 Conflict with appropriate error envelope
- [x] Weak password returns 422 ValidationError with field-level details
- [x] Email verification token generated and stored in database; verification link logged to console (stub)
- [x] Integration test: signup with valid data returns 201 and user profile
- [x] Integration test: signup with duplicate email returns 409
- [x] Integration test: signup with invalid email returns 422
- [x] Integration test: signup with weak password returns 422
