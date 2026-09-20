# NWB-P0-021 — Email link consistency (F-09, F-09b)

- **Status:** done
- **Epic:** p0-foundation-gap
- **Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-021; defects F-09, F-09b
- **Size:** S/M
- **Depends on:** —

## Objective

Every link the server puts in an email is built from one server-decided base URL.
No value taken from the request may appear in a security email.

## What was actually wrong

The ticket describes a broken signup link plus an `Origin`-derived base on the
verification resend route. The audit found the same header base on a route the
ticket does not mention, and that route makes this a real vulnerability rather
than a hygiene problem.

**Reproduced against pre-fix code** (throwaway test spying on `emailService.send`):

```
POST /api/auth/forgot-password
Origin: https://evil.example.com
{"email":"victim@example.com"}

→ 200 OK
→ email to victim contains https://evil.example.com/reset-password?token=<valid token>
```

The endpoint is unauthenticated, the token is real, and the domain is the
attacker's. Anyone who can name a victim's email address can have a working
password-reset token delivered to a page they control; they only need the
victim to click a link that looks exactly like the genuine one. That is account
takeover with one click of user interaction, from an anonymous request.

Five call sites built link bases, in two flavours:

| Call site | Base before |
|---|---|
| `src/server/api/auth/password-reset.route.ts:38` | `c.req.header("origin") ?? ""` |
| `src/server/api/auth/verification.route.ts:31` | `c.req.header("origin") ?? ""` |
| `src/services/auth/email-change.ts:59` | `config.CORS_ORIGIN[0]` |
| `src/services/auth/signup.ts:235` | `config.CORS_ORIGIN[0]` + wrong path |
| `src/services/orgs/invitation.service.ts:223` | `config.CORS_ORIGIN[0]` |

Two further problems surfaced that were not in the ticket:

- `src/app/server-functions/auth.ts` called both services with `origin = ""`,
  producing `"/reset-password?token=…"` — a **relative URL in an email**, which
  no mail client can resolve. The Server Function path was silently broken.
- The `?? ""` fallbacks meant that a client which simply omits `Origin` (any
  non-browser caller — curl, a mobile app) got the same relative, dead link.

## Change

**`src/lib/config.ts`** — optional `APP_BASE_URL` (zod, refined to a single
http(s) URL), plus a derived `APP_BASE_URL_RESOLVED` on the `Config` type that
is always present and always absolute:

- unset → first `CORS_ORIGIN` entry, which is what three services already used,
  so dev and existing deployments need no new variable;
- trailing slashes stripped, so `` `${base}/path` `` can never double up;
- a non-URL value throws at `loadConfig`, i.e. at startup, rather than emitting
  broken links for the life of the process.

`APP_BASE_URL_RESOLVED` is derived rather than parsed so no call site can set it
directly, and it is separate from `CORS_ORIGIN` because the origin a browser
calls the API from is not necessarily the host you want in an email.

**Services** — the `origin` parameter was **deleted from the signatures** of
`forgotPassword` and `sendVerificationEmail`. Defaulting it would have left the
door open; removing it makes "pass a header in here" a type error, and it is why
the two Server Function call sites had to be fixed rather than being missed.
All five sites now use `getConfig().APP_BASE_URL_RESOLVED`.

**Signup path** — `${base}/verify-email` → `${base}/api/auth/verify-email`,
matching `GET /api/auth/verify-email`, the only route that exists and what
`sendVerificationEmail` already emitted. That is F-09 proper: every signup
verification link was a 404.

## Tests — `src/tests/email-links.test.ts` (12)

DB-backed (7):

1. **F-09b regression pin** — forged `Origin` on forgot-password: link base is
   the configured one, and `evil.example.com` appears nowhere in the body.
2. Same for the verification-resend route.
3. **Negative** — no `Origin` header at all: the link still parses as an
   absolute URL (the case that used to emit a relative one).
4. F-09 — the signup link points at `/api/auth/verify-email`.
5. Invitation link base.
6. Email-change confirmation link base.
7. Sweep — for every emitted email, *every* `href` parses and its `origin`
   equals the configured base, with `Origin`, `Referer` and `X-Forwarded-Host`
   all set hostile at once.

Config resolution, no DB (5): `CORS_ORIGIN[0]` fallback; explicit `APP_BASE_URL`
wins; trailing slashes stripped; `"not-a-url"`, `"javascript:alert(1)"`,
`"//evil.example.com"` and `""` each throw; the resolved base is always absolute.

**Verified red before green.** The service was reverted to the vulnerable form
(`origin` parameter back, defaulted to the attacker domain) and the suite
re-run: tests 1, 3 and 7 failed, the other nine still passed. The tests detect
this specific regression and are not passing by accident.

Full suite: **395 pass / 0 fail** (383 → 395). DB-less: 222 pass / 176 skip / 0 fail.

## Notes / out of scope

- No audit event: nothing here is a state mutation; the flows that do mutate
  (reset, verification) already emit their own events.
- No tenant-isolation surface — all five call sites are either unauthenticated
  or already org-scoped by their callers.
- MFA-notice emails, listed in the ticket's audit step, contain no links.
- `CORS_ORIGIN` keeps its own meaning (the browser allow-list) and is untouched
  apart from losing its "until NWB-P0-021" comment.

## Acceptance

- [x] One server-decided base for every emailed link.
- [x] Zero client-controlled values in any emailed URL — enforced by type
      signature, not convention.
- [x] Positive tests: links use the configured base.
- [x] Negative tests: forged header ignored; absent header still absolute;
      bad config fails closed.
- [x] `bun test` green with a live DB, `bun run typecheck`, `bun run lint`,
      `bun run build`.
- [x] Docs: `.env.example`, `02-defects.md` (F-09 closed, severity corrected),
      `01-discovery.md`, roadmap, `AGENTS.md`, `docs/agents/local-database.md`.
