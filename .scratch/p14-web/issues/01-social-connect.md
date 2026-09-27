# NWB-P14.3 — Social account connect (OAuth) + the connection-management screen

Type: task
Status: done 2026-09-27
Phase: P14 (web application) — sub-phase 3 of 15, taken early because its backend (P2) is merged
Size: M
Blocked by: NWB-P2-001…006 (merged, PRs #22/#23) and NWB-P2-007 (PR #24 — the lifecycle routes,
the attention filter, the impact preview and the notifier this screen consumes). Nothing else.

## Why this exists

Since NWB-P2-001 the OAuth callback has ended with

```
302 → /settings/integrations?connected=<platform>
```

and **that route did not exist.** Every successful connection in the product therefore landed an
operator on a 404 — the one screen the whole P2 phase was building toward was the only part of the
flow nobody could see. P2 shipped the service, the routes, the state machines, the breaker, the
quota ledger and the notification hops; P14.3 ships the place a human actually connects a channel,
watches its quota, pauses it, probes it and disconnects it.

It is also the first screen in the repo that is not auth: the first loader that pages, the first
mutation set, the first destructive action with a confirmation ceremony. The conventions it sets
are recorded in `../spec.md` so P14.2 and P14.4 do not have to rediscover them.

## Scope (in)

**`src/lib/validation/social.schemas.ts`** (new) — the payload shapes for the web surface: the five
platforms, the six account statuses, `soc_<uuid>`, the relative-`returnUrl` rule the public
callback's redirect depends on (an absolute URL there is an open redirect), the pause/resume
reason, the disconnect confirmation, and pagination bounded 1..100 default 20 to match
`src/lib/pagination.ts`. Exported from the validation barrel.

**`src/app/server-functions/social.ts`** (new) — eleven Server Functions, one per service method
the screen needs, each with the ability its Hono route asserts:

| Server Function | Method | Ability | Service call |
|---|---|---|---|
| `initiateSocialConnectServerFn` | POST | `connect` | `initiateConnect` |
| `listSocialAccountsServerFn` | GET | `read` | `listAccounts` (incl. `attention` + `attentionCount`) |
| `getSocialAccountServerFn` | GET | `read` | `getAccountDetail` |
| `getSocialAccountHealthServerFn` | GET | `read` | `getAccountHealthLog` |
| `getSocialUsageServerFn` | GET | `usage` | `getOrgQuotaUsage` |
| `getSocialAccountUsageServerFn` | GET | `usage` | `getManageableAccount` + `getQuotaSnapshot` |
| `checkSocialAccountHealthServerFn` | POST | `connect` | `checkAccountHealth` |
| `pauseSocialAccountServerFn` | POST | `connect` | `setAccountCollection(action:"pause")` |
| `resumeSocialAccountServerFn` | POST | `connect` | `setAccountCollection(action:"resume")` |
| `getSocialDisconnectImpactServerFn` | GET | `disconnect` | `getDisconnectImpact` |
| `disconnectSocialAccountServerFn` | POST | `disconnect` | `disconnectAccount` |

Re-exported from `src/app/server-functions/index.ts`.

**`src/app/routes/settings/integrations.tsx`** (new) — the screen: connect buttons per platform
(navigate to the returned `authorizeUrl`; the provider comes back to the public Hono callback,
which 302s here with `?connected=`), the FR-SOC-044 attention widget with its one-click filter,
the connection table (status badge, quota state, token expiry, breaker warning), per-row
pause/resume and on-demand probe, keyset "load more", and the disconnect modal — impact analysis
first (FR-SOC-011), typed username second (FR-SOC-012), revocation outcome in the receipt line.

**`src/tests/social/server-functions.test.ts`** (new) — 24 tests, in-process against a real DB with
the OAuth exchange, the probe `fetch` and the notifier all scripted.

## Scope (out)

- **The real TanStack Start toolchain.** No Vite/vinxi, no client bundle, no router generation —
  `createServerFn.ts` and `routeTree.gen.ts` stay stubs, and the route stays a structural document
  under `@ts-nocheck`. Replacing the stubs is its own ticket and would change every screen at once.
- **A design system.** Inline styles, as every existing route does. No CSS pipeline exists to hang
  tokens on, and inventing one for a single screen would be a second decision to reverse later.
- **The four impact domains' real counts.** `getDisconnectImpact` returns `count: null` with a
  `landsWith` pointer for campaigns/monitoring/publishing/engagement, because those `db/*` schemas
  are not adopted yet. The modal says so explicitly ("an unknown count is not a zero") rather than
  rendering a confident 0. Filling them in is P3/P4/P5/P7/P11 work.
- **Notifications UI (P14.15), org setup (P14.2), publishing (P14.4).** Different screens.
- **Any new permission, CASL verb, migration or queue.** The screen consumes exactly the surface
  P2 shipped; the seed still converges on 62 permissions / 7 roles / 265 mappings.

## Design decisions (this ticket's own calls)

1. **Impact preview and disconnect are two functions, not one `dryRun` flag.** The HTTP surface
   keeps `DELETE …?dryRun=true` because it has one route to serve both halves. On the web, a
   read-only function that cannot delete anything is strictly safer than a flag whose default a
   client could get wrong, and it makes the modal's order (show what breaks → ask for the username)
   the only order the code can express.
2. **`returnUrl` defaults to this screen, computed in the Server Function.** The callback's
   redirect target and the route that renders it stay in step in one place; a caller may still
   override it with a relative path, and the schema rejects anything absolute or protocol-relative.
3. **The loader makes one list call, not two.** `attentionCount` rides along on every list response
   and is org-wide and filter-independent by construction (NWB-P2-007), so the badge needs no second
   round trip; the "show them" button re-calls with `attention: true` when the operator asks.
4. **Render every action, let 403 arrive as a message.** The web has no permissions payload in the
   session, so hiding buttons would mean either shipping a new one or guessing. The ability matrix
   is asserted server-side and tested per seat below.
5. **Domain literals restated in the validation layer.** `SOCIAL_PLATFORMS`/statuses are duplicated
   from the service on purpose: `src/lib/validation` may depend on zod and itself only, and the
   service re-validates at runtime, so a drift fails closed. Importing them would invert the
   dependency for the sake of one less line.

## Exit criteria / acceptance — all met 2026-09-27

- [x] `/settings/integrations` exists; the callback's `?connected=<platform>` renders a success
      banner instead of a 404.
- [x] Every screen action reaches a service method through a Server Function; no component issues
      an HTTP call, and no Server Function contains business logic or SQL.
- [x] Ability per function matches the Hono route's `requireAbility` verb-for-verb — proven by a
      test that walks all five seats (owner/admin/manager/creator/viewer) over all eleven
      functions: `read` for every seat, `usage` refused below manager, `connect` refused below
      manager, `disconnect` refused for manager and everyone below.
- [x] Session cookies only: no cookie → `UnauthorizedError` on all eleven; a `Bearer` header →
      refused with the "use /api/* for API keys" message.
- [x] Tenant isolation: `orgId` comes from the token, never the payload; another org's account id
      is a 404 from detail/pause (not a 403 — a cross-tenant id must not be distinguishable from a
      missing one) and that org's list is empty.
- [x] No token material in any web payload: the list, the detail and the disconnect receipt are
      asserted free of the plaintext tokens, the sealed columns and their names (BR-SOC-016).
- [x] Disconnect ceremony end to end: wrong username → `ValidationError` and the row is still
      `active`/`is_active`; exact username → `disconnected`, both ciphertexts NULL, a
      `data_retention_until` ~90 days out, per-token `revocationDetail`, then hidden from the
      default list, 404 from detail/usage, 404 on repeat disconnect, and still readable when the
      `status=disconnected` filter names it (FR-SOC-014).
- [x] Lifecycle: pause → `paused`/`is_active=false` with `previousStatus`, probing a paused account
      is a `ConflictError` ("resume it first"), resume → `active`, resuming a live account is a
      conflict, and an on-demand probe writes a `healthy` row with the probe's HTTP status.
- [x] Real OAuth connect: the Server Function mints a single-use state, the public callback's
      service method consumes it, the account lands `active` with sealed tokens, and the FR-SOC-008
      `connected` notification reaches the notifier seam. The state's `returnUrl` is asserted to be
      `/settings/integrations?connected=youtube` — the callback appends `?connected=` **only** when
      the state carried no `returnUrl`, so a caller that passed the bare path would silently kill
      the success banner. The route omits it for exactly that reason, and the test is what keeps the
      omission deliberate.
- [x] Schema-level 422s before auth: unknown platform, unknown status filter, absolute `returnUrl`,
      `limit` 0 and 101, malformed `soc_<uuid>`, missing `confirmUsername`; a malformed cursor is a
      `ValidationError` from the handler, not a silent restart of the walk.
- [x] Gates: **990 tests pass / 0 fail** (966 at PR #24 + 24 here), `tsc --noEmit` clean,
      `bun run lint` errors 0, `bun run build` succeeds, coverage gate services 93.8% / lib 97.3%.

## Comments

- The route file is the deliverable's structural half; the *tested* half is the Server Function
  suite. Anyone wiring the real TanStack Start toolchain should treat
  `src/tests/social/server-functions.test.ts`'s local `WebAccount`/`WebAccountPage`/`WebImpact`
  interfaces as the payload contract the screen is written against — the `createServerFn` stub
  returns `any` at the call site, so those shapes are what keeps the assertions honest.
- Test-order gotcha worth remembering: `connect()` clears the Server Function headers to play the
  unauthenticated provider callback, so any test that connects must re-`as(<seat>)` afterwards.
- Found while writing the route, not while writing the tests: the attention widget's toggle first
  shipped as `setAttentionOnly(!attentionOnly)` — a flag flip with no re-fetch, i.e. a button that
  announced a filter it had not applied. `toggleAttention()` now sets the flag and reloads through
  it. Routes are `@ts-nocheck` and nothing renders them in CI, so this class of bug has no
  automated net; re-read the handlers when touching this file.
  The health-log query orders by `checked_at DESC` and a whole test file shares one transaction's
  frozen `now()`, so the probe's row must be *found* in the timeline rather than assumed first.
- Sandbox note: bun and the embedded PostgreSQL were reinstalled under `/home/user` this cycle
  (workspace-persistent) after a reset wiped `/usr/local` and `node_modules`; PG is 14 to match CI.
