# 09 — Rate limiting (auth endpoints)

**What to build:** Abuse prevention for authentication endpoints. A SQLite-backed token bucket rate limiter that tracks requests per email and per IP. Applied to signin, signup, and password-reset endpoints. After this ticket, brute-force and enumeration attacks against auth endpoints are mitigated.

**Blocked by:** 01 — Project scaffold + config + DB + error framework

**Status:** done

- [x] SQLite database created at configurable path (`./data/rate-limit.db`) — not committed
- [x] Token bucket implementation: bucket per key (email or IP), refills at configurable rate, max capacity
- [x] `POST /api/auth/signin`: 5 attempts per email per 15 minutes
- [x] `POST /api/auth/signup`: 3 per IP per hour
- [x] `POST /api/auth/refresh`: 10 per session per minute
- [x] Rate limit middleware: checks bucket before route handler, returns 429 with `Retry-After` header when exceeded
- [x] `RateLimitError` typed error returned in JSON envelope on 429
- [x] Rate limit headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [x] SQLite file created at runtime if not exists; schema created on first use
- [x] Integration test: exceed signin rate limit → 429
- [x] Integration test: rate limit resets after window expires
- [x] Integration test: non-auth endpoints are NOT rate-limited by this middleware
