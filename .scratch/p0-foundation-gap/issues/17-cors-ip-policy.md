# NWB-P0-017 — CORS origin config + single client-IP policy (F-13, F-10)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
301/301 `bun test` with a live database, 205 pass / 102 skip / 0 fail without
one, plus live curl preflight checks; CI re-run pending)
**Deps:** none. **Size:** S/M.
**Fixes:** F-13 (open CORS), F-10 (inconsistent/spoofable IP).

## What was built

| Layer | File |
| --- | --- |
| `getClientIp` + CIDR parse/match + trust policy | `src/lib/ip.ts` (extended) |
| `CORS_ORIGIN` list + `TRUSTED_PROXY_CIDRS` parsing | `src/lib/config.ts` |
| `cors({ origin })` from injected allow-list | `src/server/index.ts` (both factories) |
| Production wiring (`config.CORS_ORIGIN`) | `src/index.ts` |
| Test injection param | `src/tests/helpers/test-client.ts` |
| IP call-site conversions (4) | `middleware/auth.ts`, `signin.route.ts`, `mfa.route.ts`, `api-keys.route.ts` |
| List-compat (`[0]` + P0-021 marker) | `signup.ts`, `email-change.ts`, `invitation.service.ts` |
| Env docs | `.env.example` |
| Tests | `src/tests/ip.test.ts`, `src/tests/cors.test.ts`, `src/tests/config.test.ts` (new, 34 tests); `Cf-Connecting-Ip` → `X-Forwarded-For` in signin/mfa suites |

## Policy

- **CORS:** exact-match allow-list from `CORS_ORIGIN` (comma-separated, each
  canonicalised via `URL.origin`). Allowed preflight → 204 + ACAO echo + `Vary:
  Origin`; unlisted → 204 with no ACAO (browser blocks); no `Origin` header →
  untouched. `*` is rejected at startup — CORS bypass must never be one env
  typo away. No `credentials` flag (unchanged default): `SameSite=Strict`
  cookies don't cross origins anyway, and Bearer keys need no credentials
  mode; Phase 7 revisits with the web app.
- **Client IP (nginx trust model):** walk `X-Forwarded-For` right-to-left,
  skipping `TRUSTED_PROXY_CIDRS` hops (default: RFC1918 + v4/v6 loopback);
  first untrusted hop is the client; all-trusted chain → leftmost;
  unparseable hops skipped; `X-Real-IP` fallback; null when nothing usable.
  `CF-Connecting-IP` is not read (no Cloudflare in the ADR-008/VPS path).
- **Residual (documented in `ip.ts`):** direct-connection header forgery is
  undetectable without the socket peer address. The deployment is always
  behind nginx, which appends the true peer rightmost, so forged values can
  only sit further left where the walk ignores them. Plumbing
  `server.requestIP` through was deliberately not done (couples routes and
  tests to the server object).

## Acceptance criteria

- [x] No cross-origin credentialed preflight succeeds from an unlisted origin
- [x] One IP helper, all call sites converted, CF branch gone
- [x] `bun test` green with DB; typecheck, lint, build green

## Deviations & findings

- **Origins are injected, not imported.** The roadmap's `cors({ origin:
  config.CORS_ORIGIN })` is implemented with the list passed into the app
  factory (`src/index.ts` passes the loaded config; tests inject or take the
  dev default). A singleton read inside the factory — or a lazy `origin()`
  function, which hono evaluates on *every* request — would throw where
  `DATABASE_URL` is unset and break the zero-env no-DB suites. Verified: the
  no-DB run is 205 pass / 102 skip / 0 fail.
- **Four IP call sites, not three.** The ticket predates `verify-login` (which
  carried an explicit NWB-P0-017 marker, now fulfilled) and didn't count the
  API-key creation path. All four converted; `authMiddleware.clientIp`
  removed. Session recording flows through the signin call site — no
  `sessions` change needed.
- **CIDR matching is hand-rolled.** Per the dependency rule, `node:net`
  `BlockList` was checked first: it works for IPv4 on Bun 1.4.0 but returns
  `false` for `::1` after `addSubnet("::1", 128, "ipv6")` (probe-verified) —
  wrong for loopback, so unusable. The hand-rolled matcher (uint32 v4, bigint
  v6) is covered by unit tests including mask-off, host routes, and v6.
- **Bare IPs in `TRUSTED_PROXY_CIDRS` mean host routes**; empty string means
  trust-no-proxies (rightmost hop wins) — both fail-closed directions.
  IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is not recognised (consistent with
  `normaliseIp`, which also rejects it); such hops are skipped.
- **`CORS_ORIGIN[0]` at the three email-link readers** (signup, email-change,
  invitations) with a P0-021 marker — that ticket replaces them with
  `APP_BASE_URL` (defaulting from the same first origin).
- **Untouched, as scoped:** `verification.route.ts`'s client-`Origin` link
  base (F-09 → NWB-P0-021); `MfaRequiredError`-style dead code; the
  `org-context`/`org-match` suites build their own `cors()` apps and are
  byte-for-byte unaffected (named in the ticket, re-verified green).
