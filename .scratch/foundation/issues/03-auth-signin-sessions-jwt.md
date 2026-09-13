# 03 — Auth: signin + sessions + JWT

**What to build:** The sign-in and session management system. A registered user can sign in with their email and password, receive HTTP-only JWT cookies (access + refresh), and use those cookies to authenticate subsequent requests. The refresh token is stored as a hash in the sessions table and can be rotated. The user can sign out to invalidate their session. The auth middleware extracts the verified JWT and attaches the user identity to the request context. After this ticket, a user can sign in, stay signed in across page loads, and sign out.

**Blocked by:** 02 — Auth: signup

**Status:** done

- [x] JWT service: `signAccessToken(userId, orgId)` returns short-lived JWT (15 min), `signRefreshToken(sessionId)` returns longer-lived JWT (7 days), `verify(token)` returns decoded payload or throws
- [x] Session service: `create(userId)` inserts row into `sessions` table, returns session; `find(refreshTokenHash)` queries session; `delete(sessionId)` marks as revoked
- [x] `POST /api/auth/signin` validates credentials, creates session, issues `nawebeus_access` + `nawebeus_refresh` HTTP-only cookies, returns 200 with user profile
- [x] `POST /api/auth/signout` clears cookies, marks session as revoked, returns 204
- [x] `POST /api/auth/refresh` validates refresh cookie, rotates session (invalidate old, create new), issues new cookie pair, returns 200
- [x] Auth middleware: reads cookies, verifies access JWT, attaches `{ userId, orgId }` to request context. If JWT expired, returns 401; if invalid, returns 401
- [x] Invalid credentials return 401 AuthError
- [x] Revoked session returns 401 on refresh
- [x] Access token expiry returns 401 (client should refresh)
- [x] `lastLoginAt` on `users` table updated on successful signin
- [x] Integration test: signin with valid credentials returns 200 + cookies
- [x] Integration test: signin with invalid password returns 401
- [x] Integration test: authenticated request with valid cookie succeeds
- [x] Integration test: authenticated request with expired cookie returns 401
- [x] Integration test: refresh returns new cookies, old cookie revoked
- [x] Integration test: signout clears cookies, session revoked
