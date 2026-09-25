# NWB-P2-005 — Platform adapters ×5 (interface first, then one adapter per platform)

Type: task
Status: done 2026-09-25
Phase: P2 (roadmap Phase 3 · §13)
Size: L (interface + 5 dialects in one ticket; the roadmap's "split into 5" is the per-platform
work inside this row — the spec's ticket accounting keeps P2-005 as one row)
Blocked by: NWB-P2-001 (the `PlatformOAuthProfile` registry and `PlatformOAuthClient` the
adapters hang off), NWB-P2-004 (the quota gate the adapters will call before each spend).

## Why this exists

Roadmap §13 NWB-P2-005: *"Platform adapters × 5 … XL → split into 5 tickets, one per platform;
adapter interface first (PRD 8.3.2 'integration abstraction layer')"*. PRD 8.3.2's P0 acceptance
is *"Platform-specific code isolated behind a common interface"*; the execution plan's phase
acceptance is *"each platform connects, refreshes, and reports health"*. P2-001/002/003 built
connect/refresh/probe **generically** over the profile registry — which works, but left the
platform-specific code *not actually isolated*: the five profile-fetch dialects are inline
branches inside `oauth-client.ts`'s `fetchProfile`, every probe goes out with the same
one-size Bearer header (Reddit's API policy requires a descriptive `User-Agent`; the current
shape would be a production incident), and the Meta pair's refresh is *not* the RFC 6749
`refresh_token` grant the generic client sends — Facebook refreshes via `fb_exchange_token`,
Instagram via `ig_refresh_token`, neither rotating a refresh token. The lifecycle tests pass
today because they fake the whole client; the real dialects were untested. This ticket gives
each platform an adapter object behind one interface, and tests each dialect directly.

## Scope (in)

- **`PlatformAdapter` interface** (`adapters/shared.ts`) — the abstraction the PRD asks for:
  `fetchProfile(accessToken, fetch)` (FR-SOC-006 metadata dialect), `probeRequest(accessToken)`
  (FR-SOC-039 request shaping: URL + headers per platform), and an optional `refreshTokens`
  override for providers whose refresh is not the standard grant.
- **Five adapters** (`youtube.ts`, `twitter-x.ts`, `instagram.ts`, `facebook.ts`, `reddit.ts`):
  the `fetchProfile` bodies move out of `oauth-client.ts` verbatim; probes default to
  Bearer-on-`probeUrl` with reddit adding its required `User-Agent`; instagram and facebook
  override `refreshTokens` with their native grants (`ig_refresh_token` /
  `fb_exchange_token`, both returning no refresh token → `rotated: false`, the stored refresh
  token is kept).
- **`HttpPlatformOAuthClient` delegates**: `exchangeCode` asks the adapter for the profile;
  `refreshTokens` uses the adapter's override when present, else the generic grant.
  `OAuthExchangeError` and the token-response parsing move to `adapters/shared.ts` (re-exported
  from `oauth-client.ts` so no import surface changes).
- **Probes go through the adapter**: `probeAccount`'s two fetch sites use
  `probeRequest(accessToken)` instead of the inline Bearer header.
- **Direct dialect tests** (`src/tests/social/adapters.test.ts`, scripted fetch, no DB): profile
  mapping per platform (happy + missing-user error), probe shaping per platform (URL exact,
  reddit's UA), Meta refresh grants (grant type, credential placement, no rotation), generic
  refresh passthrough for the other three (auth style per profile), and one `exchangeCode`
  integration per fetch sequence.

## Scope (out)

- Publishing/collect/sync methods (P3 publishing, P7 engage, P10 sync consume the adapter
  interface when those phases build their features — the interface is the deliverable here,
  their endpoints are theirs).
- `Retry-After` retry loops (FR-SOC-036) — still P3/P7 call-site work over the same
  classification helpers.
- X `public_metrics` for follower counts on refresh — profile fetch already stores what it
  stores; enriching is a data-quality follow-up, not an abstraction task.
- Route/RBAC surface — NWB-P2-006.

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Adapters are plain objects over the existing profiles, not classes per platform | The registry is already tabular; only the dialects differ. Objects keep `PLATFORM_ADAPTERS: Record<SocialPlatform, PlatformAdapter>` a lookup, not a factory. |
| 2 | Meta refresh = native grants, `rotated: false`, refresh token kept | Facebook/Instagram issue long-lived tokens without a refresh token; forcing the RFC grant would 400 in production. The P2-002 sweep already treats `rotated: false` as "keep the stored token". |
| 3 | `fb_exchange_token` goes out as a POST form (secret in the body, not the query string) | Meta documents GET, but POST form is accepted and keeps the client secret out of any URL (BR-SOC-016 hygiene: URLs land in logs). |
| 4 | Instagram refresh URL unversioned, Facebook versioned v21.0 | Each matches that provider's own documentation for the refresh resource. |
| 5 | Probe shaping returns `{ url, headers }` rather than a Response | The service owns timing, logging, and classification; the adapter only owns the request's shape. |
| 6 | `refreshTokens` optional with generic fallback | Three of five platforms are exactly RFC 6749; making them spell that out would be ceremony inviting drift. |

## Exit criteria / acceptance — all met 2026-09-25

- [x] `PLATFORM_ADAPTERS` covers all five platforms; `HttpPlatformOAuthClient` has zero
      per-platform branches left (profile fetch and refresh dialects live in the adapters).
- [x] `probeAccount` shapes every probe request via the adapter (reddit UA present; the other
      four byte-identical to today's request) — both fetch sites (primary + 401 re-probe).
- [x] Meta pair refreshes via their native grants without rotation; youtube/twitter_x/reddit
      via the generic grant — all directly tested against scripted fetches (14 tests in
      `src/tests/social/adapters.test.ts`: registry totality, probe dialects, five profile
      mappings with refusal paths, ig_refresh_token + fb_exchange_token POST-form with the
      secret out of the URL, generic-grant post/basic passthrough, unreachable-endpoint error,
      and one exchangeCode integration).
- [x] Gates: typecheck ✅ · lint 0 errors · build ✅ · `bun test` **929 pass / 0 fail** (915
      before, +14) · `coverage:check` ✅ (services 93.5%, lib 96.8%).

## Comments

- 2026-09-25: claimed by the Arena agent (session `arena/01a0d531-nawebeus`), immediately after
  NWB-P2-004 closed (commit `1e5d71a`).
