# P14 — Web application

**Feature slug:** `p14-web`
**Spec owner:** Engineering Lead
**Roadmap:** `docs/plan/master-roadmap/` (Phase 7 settings/web clusters) · execution plan §P14 · ADR-002 (TanStack Start), ADR-007 (single Bun process)
**Status:** **in progress, out of plan order.** The auth screens already exist in the tree
(`src/app/routes/auth/*`, `dashboard`, the `createServerFn`/`routeTree.gen` stubs); P14.3 (social
account connect) and P14.2 (invitation landing + team screen, partially — see "Order") are **done
2026-09-27**. The rest of the cluster is deliberately not started.

> Provenance caveat: this working clone carries only the `main` refspec, so the commits that
> originally added `src/app` are not reachable — `git log --diff-filter=A -- src/app` attributes the
> whole directory to merge `5d9e003` (PR #23). The web layer's originating ticket therefore cannot
> be verified from here and is deliberately not claimed below.

## What P14 is, and what it is not

P14 is the **screen layer**, not a second backend. Every screen calls a Server Function in
`src/app/server-functions/`, and every Server Function is a thin adapter: validate with the shared
Zod schema, derive `orgId`/`userId` from the session cookie, `assertServerAbility`, then call the
same `src/services/` method the Hono `/api/*` route calls (ADR-002 Principle 3 — Direct Calls). No
`fetch("/api/…")` from a component, no duplicated business logic, no new SQL. If a screen needs a
behaviour the service does not have, that is a service ticket first.

This is also why P14 has **no live-preview deliverable in the agent sandbox**: the repo ships
`src/app/lib/createServerFn.ts` as an isomorphic stub and `routeTree.gen.ts` as a CI stub, there is
no Vite/vinxi client bundle, and `.tsx` routes carry `@ts-nocheck` by convention (AGENTS.md). The
artifacts that are tested are the Server Functions (in-process, real DB) and the route files as
structural documents. Do not install `@tanstack/react-start` or start a dev server to "see" a
screen — the wiring ticket that replaces the stubs with the real toolchain is its own piece of
work, and until then the honest evidence is the Server Function suite.

## Order

The execution plan lists P14.1–P14.15 with dependencies on the backend phases (P14.4 needs P3
publishing, P14.5 needs P4 monitoring, and so on). Two of them have their backend already merged,
so they are the two that can be built without inventing a service:

| Sub-phase | Screen | Backend | State |
|---|---|---|---|
| P14.1 | Auth: sign in, register, verify, reset | P0 | **already in the tree** (`src/app/routes/auth/*`, `dashboard`) — ticket unverifiable from this clone, see caveat above |
| P14.2 | Org setup: create org, invite members, onboarding checklist | P1 (orgs, users, invitations) | **invitations + team screen done 2026-09-27 — `issues/02-invite-and-team.md`**; org-profile screen and onboarding checklist still open |
| **P14.3** | **Social account connect (OAuth) + connection management** | **P2 (NWB-P2-001…007)** | **done 2026-09-27 — `issues/01-social-connect.md`** |
| P14.4+ | Publishing, monitoring, listening, engagement, PR, influencer, commerce, campaigns, analytics, admin, billing, notifications | P3–P13 | blocked on their backend phases |

P14.3 was taken before P14.2 by explicit choice (it is the screen the OAuth callback has been
302-ing to since NWB-P2-001, so a redirect in shipped code pointed at a route that did not exist).
P14.2 then took the invitation half first for the same reason — `invitation.service.ts` has built
`${APP_BASE_URL}/invite?token=…` since P1, into a route that did not exist — and split the
org-profile screen and onboarding checklist into a follow-up. NWB-P0-019, for the record, was P0's
*documentation* close-out — not the web layer.

P14.2 also produced a gate the cluster did not have: `src/tests/route-links.test.ts` scans services
for absolute links and routes for navigation targets and fails when no route answers. Both dangling
links above were invisible to every existing check, because `.tsx` routes are `@ts-nocheck` and
nothing renders them. Two more are known and allowlisted (`/reset-password`,
`/change-email/confirm` — P14.1's), with an assertion that keeps the allowlist from quietly
becoming permanent.

## Conventions this cluster follows (recorded once, apply to every screen)

- **Routes** live in `src/app/routes/<area>/<name>.tsx`, start with `// @ts-nocheck`, use inline
  styles (no CSS pipeline is wired), and read loader data with `Route.useLoaderData()` /
  `Route.useSearch()`. Loaders call Server Functions and turn `AuthError` into
  `redirect({ to: "/auth/sign-in" })`; other errors propagate so a 500 is never a login loop.
- **Server Functions** live in `src/app/server-functions/<domain>.ts` and are re-exported from that
  folder's `index.ts` alphabetically. `contacts.ts` is the reference implementation.
- **Validation** for a Server Function's payload lives in `src/lib/validation/<domain>.schemas.ts`
  and is exported from the barrel. Domain literals (enums, id patterns) are *restated* there rather
  than imported from `src/services/`: the validation layer may depend on zod and itself only, and
  the service re-checks at runtime, so drift fails closed instead of silently widening a payload.
- **Authorization** is `assertServerAbility(auth, verb, subject)` with the verb/subject the
  matching Hono route's `requireAbility` uses. A Server Function bypasses Hono's middleware
  entirely, so this call *is* the guard — there is no second line of defence if the verb is wrong.
- **Pagination** is keyset, decoded with `decodeCursor(cursor, { idPattern })`, bounded 1..100 with
  a default of 20 to match `src/lib/pagination.ts`. A malformed cursor is a `ValidationError`, not
  a silent restart of the walk.
- **Dates** stay `Date` objects over the Server Function boundary (the RPC serialises them); only
  the HTTP routes call `.toISOString()`, because JSON has no date type.
- **Errors** reach the user through `messageForAppError` (`src/app/lib/client-errors.ts`), which
  maps the shared `AppError` contract to a sentence. Components render every action and let a 403
  arrive as a message: the web has no permissions payload to hide buttons with, and a button that
  lies about being clickable is worse than one that explains itself when clicked.
- **Testing a Server Function** means `setServerDbForTest(db)` inside `withTestDb` (see the
  `withServerFns` helper in `src/tests/orgs/server-functions.test.ts` and
  `src/tests/social/server-functions.test.ts`): the functions read their database from
  `getServerDb()`, which builds a real pool when the seam is unset. Two consequences worth knowing
  before writing one. The seam is *load-bearing for isolation*, not only for visibility — a call
  outside the test transaction **commits** to the shared database, and a single stray `rate_limits`
  row is enough to fail an unrelated exact-count assertion in `src/tests/queue/jobs.test.ts`. And the
  shim does **not** run `.validator()` before the handler (the real TanStack Start runtime does), so
  there is no such thing as a database-free Server Function test for a handler that rate-limits or
  reads before it parses: even a "missing field is refused" test executes the body. Refusals are
  still fail-closed — the service parses the payload itself — but the test must be wrapped like any
  other.

## Exit gate (per execution plan §P14)

All P14 sub-phases shipped with the per-screen requirements satisfied (loading · skeleton · empty ·
error · permission-denied · not-found · mutation-pending · success confirmation · cache
invalidation · responsive · keyboard-accessible). Tracked per screen in `issues/`; the state today
is "P14.1 done, P14.3 done, P14.2 partially done, remainder blocked on their backend phases", so
the phase gate is **not** met and P15 does not start here.

Two standing caveats on how far "done" reaches for a screen in this cluster:

- The per-screen UI states are **reviewed by hand, not automated** — nothing renders `.tsx` in CI.
  What is automated is the Server Functions behind them (in-process, real DB) and the route files as
  structural documents, plus the link scan above.
- P14.2 recorded one security finding worth scheduling ahead of further org work:
  `organization_members.invitation_token` keeps the raw emailed token in plaintext beside its own
  hash, and nothing reads it (F-P14.2 in `issues/02-invite-and-team.md`).
