# NWB-P2-007 — Social account lifecycle gaps + two latent bugs in the merged P2-006

Type: task
Status: done 2026-09-26
Phase: P2 (roadmap Phase 3 · §13) — **follow-up to the phase's closing ticket**
Size: M
Blocked by: NWB-P2-006 (merged as PR #23, 2026-09-25 15:17 UTC). Nothing else.

## Why this exists

NWB-P2-006 shipped the management surface and closed the phase. Two things followed:

1. **A second, independent implementation of the same ticket was built in parallel** (session
   `arena/01a0d8fe-nawebeus`, from a sandbox cloned at the pre-#23 base `e9bc730` — the session's
   context predated the merge). It was **not** merged; `main`'s version is the one that stands,
   including its permission model (`read` everyone / `usage` manager+ / `disconnect` admin-only,
   with `usage` and `disconnect` added to the CASL verb union — closer to Module 3 §6.2 than the
   parallel build's `delete`-verb reuse). The parallel tree is preserved for reference in
   `.scratch/p2-social-accounts/agent-worktree-backup/` (patch + the four new files) and is the
   source of the tests and the notifier port this ticket lands.
2. **Reading the two side by side surfaced real gaps and two live bugs on `main`.** P2-006's own
   issue file scopes several of them out explicitly ("pause/resume … each deserves its own ticket
   when a consumer needs it"), and the parallel build had answers for them. The Phase 7 settings UI
   is that consumer.

### The two bugs (both live on `main` at 5d9e003)

| # | Bug | Effect | Where |
|---|---|---|---|
| B1 | `markNeedsReauth` writes a `social_account_health_log` row whenever its `UPDATE` matched a row — and the `UPDATE`'s guard is `status NOT IN ('disconnected')`, so an account that is **already** `needs_reauth` matches. The insert then has `previous_status = status`, which `chk_sahl_transition_differs` rejects. | **23514 aborts the caller's transaction.** Reachable today through any path that re-surfaces a stuck account — an on-demand probe of a `needs_reauth` account (this ticket's health-check route) goes `probeAccount` → 401 → refresh-once → `markNeedsReauth` with `previous_status` already `needs_reauth` — and it would equally poison a batch that retried one. It also re-audits the same transition and (once notifications exist) re-emails admins on every attempt. The two `*/5` sweeps happen to select `status = 'active'`/`IN ('active','error')` only, which is the sole reason this is latent rather than daily. | `service.ts` `markNeedsReauth` (~569) |
| B2 | The reconnect/revive path in `handleCallback` resets `consecutive_error_count`, `last_error_*` and the disconnection columns — but **not** `circuit_breaker_open` / `circuit_breaker_opened_at`. | A revived account is **born undispatchable**: `assertDispatchAllowed` answers 503 `CIRCUIT_BREAKER_OPEN` until a health probe happens to close the breaker (up to six hours, or the next sweep tick for breaker-open rows). Re-authenticating is exactly what an operator does to fix a broken connection, and it does not fix this. | `service.ts` `handleCallback` revive `UPDATE` (~417) |

Both are one-line-ish fixes with regression tests; neither is covered by the 946 tests in `main`.

## Scope (in)

**Bug fixes**
- **B1** — gate the health-log insert, the audit event and the notification on a real transition
  (`account.status !== "needs_reauth"`), and keep returning `false` for the no-op so callers'
  counters stay honest.
- **B2** — clear `circuit_breaker_open = false, circuit_breaker_opened_at = NULL` in the revive
  `UPDATE`; assert `assertDispatchAllowed` passes immediately after a reconnect.

**Lifecycle routes** (all on the existing `socialRouter`, envelope + `authMiddleware` +
`requireAbility`, `accountIdParam` for the id):

| Route | Ability | Purpose |
|---|---|---|
| `POST /social/accounts/:accountId/pause` | `socialaccounts.connect` | FR-SOC-016 — collection stops, sealed tokens and history stay; `status='paused'`, `is_active=false` |
| `POST /social/accounts/:accountId/resume` | `socialaccounts.connect` | FR-SOC-016's resume "without re-authentication" — from `paused` only |
| `POST /social/accounts/:accountId/health-check` | `socialaccounts.connect` | on-demand probe through `probeAccount` — the operator-reachable half of P2-003's recovery path (a success closes an open breaker) |
| `GET /social/accounts/:accountId/usage` | `socialaccounts.usage` | the per-account `getQuotaSnapshot` (already in the detail response; this is the cheap poll a quota panel wants) |

**List/disconnect refinements**
- `?attention=true` on `GET /social/accounts` — the FR-SOC-044 widget's data half: accounts whose
  `status IN ('error','needs_reauth')` **or** `quota_status IN ('critical','exhausted')` **or**
  `circuit_breaker_open`, plus `meta.attentionCount` so the widget can render "X need attention"
  without a second call.
- `?dryRun=true` on `DELETE /social/accounts/:accountId` — FR-SOC-011's impact analysis *before*
  the confirmation modal: returns the affected domains and writes nothing, so it needs no typed
  username. Counts are `null` + a `landsWith` ticket name until `db/campaigns`, `db/monitoring`,
  `db/publishing` and engagement are adopted — a `0` would be a false all-clear in a modal.

**Notifications (FR-SOC-008 + FR-SOC-022's second half)**
- `src/services/social/notifier.ts` — a `SocialNotifier` **port** (one function type over a
  `SocialNotificationEvent`) with `defaultSocialNotifier` resolving recipients from
  `organization_members` + `roles` and sending through P1-004's `emailService`:
  `connected`/`reconnected` → the org's `owner` + `admin` seats; `needs_reauth` → those plus the
  account's Primary Manager (US-SOC-011). `setSocialNotifierForTest` is the injection seam.
- The service awaits it through a `notify()` helper that **try/catches and logs** — a broken
  notifier can never fail a connect, a probe or the refresh sweep. P2-006 scoped this to P6; the
  email channel already exists and satisfies both requirements as written, so it lands now and P6
  swaps the implementation when in-app channels do.
- No `alert_rule_source` enum change (there is no `social` value) → **no migration**.

**Revocation**
- X (Twitter) `revokeRequest` dialect — RFC 7009 on `https://api.twitter.com/2/oauth2/revoke`
  (Basic auth from the client pair, `token=` + `token_type_hint=refresh_token` form). P2-006
  shipped YouTube + Reddit; X publishes one too, and today its tokens are wiped locally while
  staying live at the provider.
- Revoke the **refresh token as well** when one is stored: revoking only the access token leaves
  the provider able to mint a new one, which defeats FR-SOC-013 ("immediately revoke OAuth
  tokens"). The response/audit gain a per-token outcome rather than one string.

**Audit registry** — `socialaccount.paused`, `socialaccount.resumed` (metadata only, never token
material), matching `AUDIT_ACTION_FORMAT`.

**Tests** — `src/tests/social/lifecycle.route.test.ts` (routes through the real app + DB with
scripted probe/revoke fetches and a recording notifier), the two bug regressions, adapter
revocation dialects for X in `adapters.test.ts`, and the seed-matrix extension if a tier moves.
The parallel build's 30-test suite is the starting point, **adapted to `main`'s shapes** (its
permission model, `confirmUsername` body, `getAccountDetail`, `usage` tier) — not lifted wholesale.

## Scope (out)

- **Plan-limit enforcement** (FR-SOC-026/028/029/030) — P13 billing owns the numbers.
- **Bulk operations** (FR-SOC-018, module §8.6) — P2 priority; these per-account primitives are
  what a bulk route loops over.
- **Resume backfill** (FR-SOC-017's 24-hour catch-up job) — that is P3/P7 collection work; the
  resume *route* is the seam it hangs off.
- **Archive after 90 days** (FR-SOC-015) and the retention worker adopting `social_accounts`.
- **WebSocket push** (FR-SOC-041's delivery half), the attention *widget* and diagnostics *panel*
  UI (FR-SOC-042/044's presentation halves) — Phase 7.
- **In-app notification channel** — P6, when `alert_rule_source` grows a `social` value.
- Re-litigating `main`'s permission model or route shapes. Where the two implementations differ,
  **`main` wins** unless it is wrong (B1/B2) or silent (the gaps above).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep `main`'s four verbs (`read`/`usage`/`disconnect`/`connect`); add none | The new routes map cleanly: pause/resume/health-check are connection-lifecycle → `connect` (manager+, the tier Module 3 §6.2 gives connection management); the per-account quota read → `usage` (manager+). Minting `pause`/`probe` verbs would grow the union for no tier change — every candidate verb lands on the same manager+ tier anyway. |
| 2 | Health-check is manager+ (`connect`), not admin | It is diagnostic, not destructive — but it *does* spend platform quota and can close a breaker, so it is not a `read`-tier action for every seat. |
| 3 | Pause refuses from `needs_reauth`, `disconnected` and `paused`; resume only from `paused` (409 otherwise) | FR-SOC-016's "resume without re-authentication" is about pausing, not about healing a dead token — pretending otherwise would let an operator "resume" an account whose credentials are gone. Pausing a `needs_reauth` account would overwrite the state the operator needs to see. |
| 4 | Pause/resume write a `social_account_health_log` transition row + an audit row | The health log is the account's status timeline (FR-SOC-042 reads it); an operator-initiated status change that is absent from it makes the timeline lie. `chk_sahl_error_consistency` is satisfied (`paused`/`active` are not error statuses). |
| 5 | `?dryRun=true` needs no typed username | It writes nothing, so the ceremony it exists to precede does not apply; requiring it would make the preview modal ask for confirmation twice. |
| 6 | Impact counts stay `null` + `landsWith` | The downstream tables are aspirational `db/` modules excluded from tsconfig; a count is not computable, and `0` in a confirmation modal is a false all-clear. |
| 7 | Notifier is a port over `emailService`, awaited, never throwing | Awaited (not fire-and-forgotten) because `handleCallback` runs in a public route whose 302 must not race an unhandled rejection; the email service queues rather than blocks, so awaiting costs nothing. The `notify()` try/catch is what makes "cannot fail the caller" structural rather than a promise. |
| 8 | `ADMIN_ROLE_CODES = owner, admin` | DEC-039's two administrative tiers. `manager` is an operational tier and receives `needs_reauth` only as the account's Primary Manager (US-SOC-011) — that split is what FR-SOC-022 actually says. |
| 9 | Revocation covers both tokens, outcome reported per token | FR-SOC-013 says "revoke OAuth tokens" (plural); an access-token-only revoke leaves the refresh token minting replacements. Still best-effort: a provider 5xx never blocks the disconnect. |
| 10 | Tests land in a new file, not by editing `routes.test.ts` | P2-006's suite is merged and green; a separate `lifecycle.route.test.ts` keeps the diff reviewable and the two suites independently runnable. |

## Exit criteria / acceptance — all met 2026-09-26

- [x] **B1**: an account already in `needs_reauth` can be re-marked without a health-log row, an
      audit row or a notification — and without aborting the caller's transaction. A test drives
      the real path (an on-demand probe of a stuck account) and asserts it answers instead of 500ing.
- [x] **B2**: reconnect after a disconnect (with the breaker open) clears
      `circuit_breaker_open`/`circuit_breaker_opened_at`, and `assertDispatchAllowed` passes
      immediately — pinned by a test.
- [x] Pause/resume: happy paths, the 409 matrix (pause a `needs_reauth`/`disconnected`/`paused`
      account; resume an `active`/`needs_reauth`/`disconnected` one), sealed tokens survive a
      pause (unseal still round-trips), a paused account is skipped by `refreshDueTokens`, both
      transitions audited and present in the health timeline, creator/analyst/viewer → 403,
      cross-tenant → 404.
- [x] Health-check: probes through the adapter (scripted fetch), returns the outcome and the
      account's new state, a success closes an open breaker (`socialaccount.breaker_recovered`
      audit row), refuses a `disconnected` account, 403 below manager+.
- [x] Per-account usage matches `getQuotaSnapshot`; `usage` tier enforced; cross-tenant 404.
- [x] `?attention=true` filters to exactly the attention set and `meta.attentionCount` matches;
      combining it with `platform`/`status` behaves (AND, not override).
- [x] `?dryRun=true` returns the impact analysis, writes nothing (no audit row, no status change,
      tokens intact) and needs no confirmation; the real DELETE is unchanged in behaviour.
- [x] Notifications: connect/reconnect emails the org's `owner`+`admin` seats (recording
      notifier); `needs_reauth` emails those plus the Primary Manager; a non-transition does not
      re-notify; a throwing notifier is logged and swallowed — the request still succeeds; the
      production notifier resolves recipients without sending when nobody qualifies.
- [x] X revocation: the request shape is pinned (Basic auth, `token_type_hint`), and a disconnect
      with both tokens stored issues both revocations and reports each outcome; Instagram/Facebook
      still report `not_supported` with **zero** HTTP calls.
- [x] No response body anywhere on the social surface carries token material (FR-SOC-023 — assert
      by scanning the serialized bodies, the parallel build's technique).
- [x] Gates: typecheck ✅ · lint **0 errors** (870 pre-existing warnings repo-wide, none new) ·
      build ✅ · full `bun test` with `DATABASE_URL` → **966 pass / 0 fail** (946 baseline,
      +18 in `lifecycle.route.test.ts`, +2 adapter revocation tests) · `coverage:check` ✅
      services **93.8%** (min 85%), lib **96.8%** (min 90%) · `seed` re-run converges
      (**62 permissions / 7 roles / 265 mappings** — unchanged: no new permission was minted).
- [x] Docs: `AGENTS.md` route tree + Key facts, `issues/06-routes.md` gets a pointer to this
      ticket, phase spec records the follow-up and the two bugs, roadmap §13 row notes it.

## Comments

- 2026-09-26: claimed by the Arena agent (session `arena/01a0d8fe-nawebeus`). Environment rebuilt
  from scratch after the sandbox was re-cloned at `e9bc730` (pre-#23): bun 1.4.2 via npm,
  `embedded-postgres@14.23.0-beta.17` (PostgreSQL **14.23**, the CI floor), `db:push --force` →
  `seed` (**62 permissions / 7 roles / 265 mappings**) → baseline **946 pass / 0 fail** in 105 s.
  Branch re-pointed at `origin/main` (`5d9e003`); the parallel implementation is in the stash and
  in `agent-worktree-backup/`.

- 2026-09-26: **done.** Two bug fixes, four new routes, two refinements to existing ones, the
  notification port, X's revocation dialect, dual-token revocation, 20 new tests. No new CASL
  verb, no new permission, no migration.

## Findings beyond the two bugs in the table above

- **B2 was two bugs, not one.** Besides `circuit_breaker_open`, the revive also left
  `is_active = false` (disconnect sets it) and `data_retention_until` stamped. The first made the
  revived account invisible to *both* `*/5` sweeps on top of being undispatchable; the second kept
  a live connection on the retention reclaim list. All three are cleared now, and the test asserts
  the row is dispatchable immediately after the callback's 302.
- **`assertDispatchAllowed` did not know about pausing.** It checked `disconnected`, the breaker
  and `needs_reauth` — a paused account was dispatchable, so "pause stops collection" was true of
  the sweeps and false of the thing P3/P7 actually call. It now refuses `paused` /
  `is_active = false` with a **409** `SOCIAL_ACCOUNT_STATE_CONFLICT` rather than the breaker's
  503: a retry will not fix it, a human has to resume it. (P3/P7 have not shipped yet, so nothing
  depended on the old behaviour.)
- **The notifier requires a verified address.** Factory users are unverified, which is why the
  production-notifier test flips `email_verified` for the org first. This matches every other
  transactional email in the codebase (they all go to a session that passed the verification gate)
  and it is the safe default: an unverified address has never been proven to belong to its owner,
  and a "an account was connected" mail is org information.
- **The refresh sweep's own failure path re-surfaces `needs_reauth`** — which is where B1 would
  have bitten had the sweeps not filtered it out by status. The lifecycle test drives the reachable
  path instead (an on-demand probe of a stuck account) and pins both the "answers 200, not 500"
  half and the "no second audit row, no second email" half.
- **Revoking only the access token was not FR-SOC-013.** A live refresh token at the provider can
  mint a replacement access token after the local wipe, so `disconnectAccount` now calls the
  adapter's hook once per stored token and reports each outcome
  (`revocationDetail: { access, refresh }`) with the aggregate as the worst *attempted* outcome —
  `not_supported` means "nothing to attempt" (no endpoint, or no such token stored) and must not
  downgrade an honest `revoked`. P2-006's disconnect test was updated for the second call.
- **X needs `token_type_hint`.** RFC 7009 makes it optional and Google's endpoint ignores it
  (revoking either token retires the grant), but X revokes exactly what it is handed — so the hook
  grew an optional `tokenType` argument rather than the caller assembling the body afterwards.
  YouTube/Reddit ignore it; the Meta pair still have no hook at all.
