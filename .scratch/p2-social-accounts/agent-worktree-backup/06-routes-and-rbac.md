# NWB-P2-006 — Routes (list, connect, callback, delete, health) + `socialaccounts.*` seed

Type: task
Status: done 2026-09-25
Phase: P2 (roadmap Phase 3 · §13) — **last ticket of the phase**
Size: M
Blocked by: NWB-P2-001…005 (the state machine, lifecycle, health/breaker, quota ledger and
adapter registry these routes expose). All done.

## Why this exists

Roadmap §13 NWB-P2-006: *"Routes (list, connect, callback, delete, health) — envelope + RBAC
(`socialaccounts.*` permissions added to seed — extend the P1-014 role matrix)."* Execution plan
§5 P2 adds the bar: *"Endpoints follow the response envelope and RBAC guards."*

P2-001 shipped the two OAuth hops (`initiate` + the public `callback`) and one permission
(`socialaccounts.connect`). Everything the phase built after that is **service-only** today:
an operator can refresh, probe, trip a breaker, spend quota and read a snapshot — but only from
a test or a REPL. There is no way to *see* the organization's connections, no way to disconnect
one, no way to pause collection, and no way to ask why an account is red. Four earlier tickets
each parked their UI-facing half here:

| Parked by | What it parked |
|---|---|
| P2-001 (issues/01) | "Management routes: list / delete / pause / health and the rest of the `socialaccounts.*` matrix"; admin email on connect (FR-SOC-008) |
| P2-002 (issues/02) | FR-SOC-022's second half — *notify the Primary Manager and all Admins* when an account goes `needs_reauth` ("joins P2-006's routes, or P6's channels") |
| P2-003 (issues/03) | "Manual breaker reset endpoint — lands with P2-006's management routes (`reauth`/`pause`)" |
| P2-004 (issues/04) | "`getQuotaSnapshot` — the read the **P2-006 `usage` route** and P13 plan limits consume" |

This ticket lands all four, closes the phase's exit gate on the engineering side, and is the
seam the settings UI (Phase 7) and the P3/P7 dispatch paths read through.

## Scope (in)

- **Management routes** on `/api/social` (envelope + RBAC + cursor pagination per API
  Reference §2.6), registered so no static segment can be shadowed by `:accountId`:
  | Route | Ability | Purpose |
  |---|---|---|
  | `GET /social/accounts` | `socialaccounts.read` | keyset list (`?platform=&status=&attention=`), `planUsage` in `meta` (FR-SOC-027's count half) |
  | `GET /social/accounts/:accountId` | `socialaccounts.read` | one connection, no token material |
  | `DELETE /social/accounts/:accountId` | `socialaccounts.delete` | **disconnect** (FR-SOC-011…014): username confirmation, impact preview, provider revocation, 90-day retention stamp, audit |
  | `POST /social/accounts/:accountId/pause` · `/resume` | `socialaccounts.connect` | FR-SOC-016 pause/resume — collection stops, tokens and history stay |
  | `GET /social/accounts/:accountId/health` | `socialaccounts.read` | diagnostics read (FR-SOC-042's data half): status, breaker, last error, recent health-log timeline |
  | `POST /social/accounts/:accountId/health-check` | `socialaccounts.connect` | on-demand probe through P2-003's `probeAccount` — also the manual breaker recovery path (a success closes it) |
  | `GET /social/accounts/:accountId/usage` | `socialaccounts.read` | P2-004's `getQuotaSnapshot` |
  | `GET /social/usage` | `socialaccounts.read` | org-wide roll-up per platform + `summary` (accounts with issues, platforms near/at limit) |
- **Service surface** behind them: `listAccounts`, `getAccount`, `disconnectAccount`,
  `pauseAccount`, `resumeAccount`, `getAccountHealth`, `checkAccountHealth`, `getUsageSummary`,
  `getDisconnectImpact`; `SocialAccountRecord` grows the management fields (health, breaker,
  quota status, sync stamps, disconnection block) — still no ciphertext column (FR-SOC-023).
- **Token revocation on disconnect** (FR-SOC-013): a `revokeRequest` dialect per adapter
  (Google's and X's revocation endpoints; the Meta pair and Reddit publish none) and
  `PlatformOAuthClient.revokeToken`, best-effort — the local token destruction never depends on
  the provider answering, and the outcome is recorded in the response and the audit row.
- **Notification hops** through the delivered P1 channels (no new `alert_rule_source` enum
  value, so no migration): FR-SOC-008 (admins emailed when an account connects) and FR-SOC-022's
  second half (Primary Manager + admins when an account goes `needs_reauth`) — a narrow
  `SocialNotifier` port over `emailService` (P1-004), injectable for tests, never able to fail
  the request that triggered it.
- **Seed / RBAC**: `socialaccounts.read` (everyone tier — same shape as `contacts.read`,
  `media.read`) and `socialaccounts.delete` (the `contentApproval` tier = Admin + Manager, per
  Module 3 §6.2's "Admin" for destructive connection work), extending the P1-014 matrix;
  `seed.test.ts` pins both. Pause/resume/check ride the existing `socialaccounts.connect`
  (same tier) rather than minting an `update` verb that would leak to Creator.
- **Audit registry**: `socialaccount.disconnected`, `socialaccount.paused`,
  `socialaccount.resumed` — all metadata-only, never token material.
- **Validation schemas** in `src/lib/validation/social.schemas.ts` (barrel-exported), and
  `SOCIAL_DISCONNECT_RETENTION_DAYS` (default 90, FR-SOC-014) in config.
- **Reconnect clears the breaker.** P2-001's revive path resets `consecutive_error_count` but
  not `circuit_breaker_open` / `circuit_breaker_opened_at` — a revived account would be born
  undispatchable and `assertDispatchAllowed` (P2-003) would refuse it until a health probe
  happened to close it. Fixed here because disconnect is the other half of the same lifecycle.
- **Tests**: `src/tests/social/accounts.route.test.ts` (routes through the real app + DB, with
  scripted probe/revoke fetches and a recording notifier), adapter revocation dialects in
  `adapters.test.ts`, seed-matrix extension, validation-schema pins.

## Scope (out)

- **Plan-limit enforcement** (FR-SOC-026/028/029/030) — P13 billing owns the numbers; the list
  route reports `connected` and `limit: null` until then, exactly as P2-004 deferred the
  per-platform quota numbers.
- **Bulk operations** (`POST /social/accounts/bulk/{pause|resume|reauth}`, FR-SOC-018, module
  §8.6) — P2 priority; the per-account primitives this ticket ships are what a bulk route would
  loop over.
- **Archive after 90 days** (FR-SOC-015, P1) and the retention worker adopting
  `social_accounts` as a delete table — `data_retention_until` is written now; the reclaim is
  NWB-P1-010's service when the module's tables join its roll-up.
- **WebSocket push** of status changes (FR-SOC-041's delivery half), the attention *widget*
  (FR-SOC-044) and the diagnostics *panel* (FR-SOC-042's UI half) — Phase 7 web.
- **In-app notification channel** for connect/needs-reauth — the `alert_rule_source` enum has no
  `social_accounts` value and adding one is a migration; the email channel (P1-004) satisfies
  both requirements as written. P6 grows the enum when its channels land.
- **Server Functions** for the web app — Phase 7 wires the Vite plugin; `/api/*` is the surface
  this ticket owes.
- Data collection/sync endpoints (P3/P7/P10 consume the adapter interface).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | `socialaccounts.delete` for disconnect, not a new `disconnect` verb | `Actions` (CASL) is a closed union of ten verbs; adding one per domain route is how a matrix becomes unreadable. The roadmap names the route "delete", the module doc names the permission `disconnect` — the codebase's `resource.action` convention (phase decision 1) wins, and the *action* stays `delete`. |
| 2 | Pause/resume guarded by `socialaccounts.connect` | Module 3 §6.2 gives connection management to Admin + Manager, which is exactly the tier `connect` already encodes. A separate `socialaccounts.update` would land in `contentCreation` and hand Creator the ability to stop an org's data collection. |
| 3 | `?dryRun=true` on DELETE returns the impact analysis without disconnecting | FR-SOC-011 wants the impact *before* the confirmation modal; one route with a dry-run flag beats a second endpoint whose only job is to repeat the first one's read. |
| 4 | Revocation is best-effort and recorded, never a precondition | FR-SOC-013 says "immediately revoke … synchronously" — the call is synchronous; the *disconnect* cannot be held hostage by a provider 5xx, or an outage would make it impossible to cut a connection. Outcome (`revoked` / `failed` / `not_supported`) lands in the response and the audit row. |
| 5 | Two platforms publish no revocation endpoint (Instagram, Facebook, Reddit) | Google (`oauth2.googleapis.com/revoke`) and X (RFC 7009 on `api.twitter.com/2/oauth2/revoke`) do; Meta's Graph has no token-revocation resource and Reddit's is undocumented. For those the tokens are destroyed locally (ciphertext wiped) and the response says `not_supported` rather than pretending. |
| 6 | Notifier = a port over `emailService`, not `fireAlert` | `fireAlert` needs an `alert_rule_source` enum value and `social_accounts` is not in the enum — that is a migration for a notification. P1-004's transport already gives outbox durability, audit (`email.delivered`) and "never throws into the caller", which is all FR-SOC-008/022 ask for. |
| 7 | Notify only on a real transition into `needs_reauth` | `markNeedsReauth` receives the prior status; suppressing the no-op case keeps a stuck account from emailing admins on every 5-minute sweep. |
| 8 | Impact counts are `null` + a reason, not `0` | The campaign / monitor / scheduled-post tables are not adopted yet (aspirational `db/` modules). Reporting `0` would be a false all-clear in a confirmation modal; `null` with "module not yet adopted" is honest and self-updating when P4/P11 land. |
| 9 | List cursor = `(connected_at DESC, id)` | `idx_sa_recent_connected` already exists on exactly that pair, and `id` is the unique tiebreaker `src/lib/pagination.ts` requires. |
| 10 | On-demand health-check returns the probe outcome, not a raw 200 | The route exists so an operator can answer "is it still broken?" — a body that says `healthy` / `error` / `rate_limited` / `needs_reauth` with the account's new state is the answer; the audit + health-log rows are P2-003's, unchanged. |

## Exit criteria / acceptance — all met 2026-09-25

- [x] Every route answers in the `{ data, meta }` envelope, is auth-walled (401 without a
      session), and 403s below its tier (viewer cannot disconnect; creator can read but not
      pause). Cross-tenant reads are 404, never another org's row.
- [x] List: cursor pagination (limit/cursor validated 422), `platform`/`status`/`attention`
      filters, `meta.planUsage.connected` counted across platforms (FR-SOC-030), no ciphertext
      field in any response (FR-SOC-023 — asserted by scanning the serialized body).
- [x] Disconnect: wrong `confirmationUsername` → 422 `DISCONNECT_CONFIRMATION_REQUIRED` and the
      account is untouched; `?dryRun=true` → impact analysis, nothing written; the real call
      revokes at the provider (scripted fetch proves the request shape per platform), wipes both
      ciphertexts, sets `disconnected_at`/`disconnected_by`/`disconnection_reason`,
      `data_retention_until = now + 90d`, `is_active = false`, writes
      `socialaccount.disconnected`; a second disconnect is a 409; the schema's four
      disconnection CHECKs hold.
- [x] Pause/resume: pause keeps the sealed tokens (unseal still round-trips) and flips
      `paused`/`is_active=false`; resume restores `active` only from `paused` (a `needs_reauth`
      account 409s — FR-SOC-016's "without re-authentication" is about pausing, not healing a
      dead token); both audited.
- [x] Health read shows the breaker, the consecutive-error count, the last error and the recent
      `social_account_health_log` timeline; the on-demand check probes through the adapter and a
      success closes an open breaker (the P2-003 recovery path, now operator-reachable).
- [x] Usage: per-account snapshot matches `getQuotaSnapshot`; the org roll-up sums buckets per
      platform with worst-status-wins and the `summary` counts.
- [x] Notifications: connect emails the org's admins (recording notifier), `needs_reauth` emails
      admins + the Primary Manager, a non-transition does not re-notify, and a throwing notifier
      never fails the request or the refresh sweep.
- [x] Reconnect after a disconnect clears `circuit_breaker_open` + `circuit_breaker_opened_at`
      and `assertDispatchAllowed` passes immediately.
- [x] Seed: `socialaccounts.read` on all six org tiers, `socialaccounts.delete` on
      manager/admin/owner/super_admin only; `seed.test.ts` pins it; re-running `seed` converges.
- [x] Gates: typecheck ✅ · lint **0 errors** (870 pre-existing warnings, none new) · build ✅
      (510 modules) · full `bun test` with `DATABASE_URL` → **963 pass / 0 fail** (929 before,
      +34: 30 route tests + 4 revocation-dialect tests) · `coverage:check` ✅ services **93.7%**
      (min 85%), lib **96.9%** (min 90%).
- [x] Docs: `AGENTS.md` route tree + services/validation entries + a Key-facts bullet (and the
      coverage line refreshed to 93.7% / 96.9%), phase spec status → **DONE** with a clause-by-
      clause exit-gate evidence table, roadmap §13 row + the §13 exit-gate line marked done,
      `MASTER_IMPLEMENTATION_ROADMAP.md` §33 Phase-3 row → ✅, `.env.example` gains
      `SOCIAL_DISCONNECT_RETENTION_DAYS` (+ the P2-004 default-limit note).

## Comments

- 2026-09-25: claimed by the Arena agent (session `arena/01a0d8fe-nawebeus`). Environment
  rebuilt from scratch this cycle: bun 1.4.2 via npm, embedded PostgreSQL **14.23** via
  `embedded-postgres@14.23.0-beta.17` (the CI floor — the previous cycle's sandbox was on 18.4,
  so this run is back on the version CI pins). Baseline before any edit: `db:migrate` (0000–0011)
  → `seed` (59 permissions / 7 roles / 251 mappings) → **929 pass / 0 fail** in 105 s.
- 2026-09-25: **done.** Nine routes + the service half behind them, notifier port, revocation
  dialects, seed/RBAC extension, validation schemas, 34 new tests. Final gates: typecheck ✅ ·
  lint 0 errors ✅ · build ✅ · **963 pass / 0 fail** ✅ · coverage services 93.7% / lib 96.9% ✅ ·
  `seed` re-run converges (61 permissions / 7 roles / 262 mappings) ✅. Phase 2 is complete; the
  exit gate is recorded clause-by-clause in `../spec.md`.

## Findings (bugs this ticket exposed in already-shipped code)

1. **`markNeedsReauth` could abort its caller's transaction** — it wrote a
   `social_account_health_log` row unconditionally, and `chk_sahl_transition_differs` rejects a
   row whose `previous_status = status`. Re-surfacing an account that was *already*
   `needs_reauth` (exactly what the */5 refresh sweep does to a stuck account) therefore raised
   23514 inside the sweep's transaction. Fixed with a `transitioned` guard that now scopes the
   health-log insert, the audit event **and** the notification. Pinned twice in
   `accounts.route.test.ts` (row counts = 1 after a second transition, notifier not re-called).
2. **Reconnect revived a born-undispatchable account** — P2-001's revive path reset
   `consecutive_error_count` but left `circuit_breaker_open` / `circuit_breaker_opened_at` set,
   so `assertDispatchAllowed` (P2-003) refused the revived row until a probe happened to close
   it. Both columns are cleared on revive now; a test asserts dispatch is allowed immediately.
3. **Raw `db.execute(sql…)` hands back timestamptz as ISO *strings***, unlike drizzle's
   table-mapped selects — `mapRow` called `.toISOString()` on them and every management read was
   a 500 (disconnect found it via `dataRetentionUntil`). Fixed with a `toDate()` normalizer at
   the `mapRow` boundary (all eight timestamp fields) plus the three other raw reads
   (`refreshDueTokens`, `dispatchCollection`). Worth knowing for every future raw-SQL read.
4. **The driver cannot infer a bind type for a Postgres enum parameter** — `listAccounts`'
   `status` filter had to inline the *validated* enum literal via `sql.raw` (the value is already
   constrained by the Zod schema; nothing user-shaped reaches the string). Same for
   `r.code = ANY(${array})` in the notifier, which aborted the transaction (25P02): it is now an
   OR-join of individually bound comparisons.
5. **`.strict()` on a paginated query schema fights `parsePagination`** — the list schema uses
   `.catchall(z.string().optional())` so `limit`/`cursor` bounds and their 422s stay owned by the
   shared helper while genuinely unknown keys are still rejected.

## Notes for whoever builds next on this seam

- **`SocialNotifier` is a port, not a channel decision.** It is one function type,
  `(db, SocialNotificationEvent) => Promise<SocialNotificationResult>`, over three events
  (`connected` / `reconnected` / `needs_reauth`); `defaultSocialNotifier`
  (`src/services/social/notifier.ts`) resolves recipients from `organization_members` + `roles`
  (`ADMIN_ROLE_CODES = owner, admin` — DEC-039's two administrative tiers; the Primary Manager is
  added for `needs_reauth` only, FR-SOC-022) and sends through P1-004's `emailService`, which
  queues rather than blocks. When P6 grows `alert_rule_source` with a `social` value, swap the
  implementation — the two call sites (`handleCallback` at the connect/reconnect hop,
  `markNeedsReauth` inside its transition guard) and the service-level `notify()` try/catch stay.
  `setSocialNotifierForTest` is the injection seam; **never** let a notifier failure reach a
  caller (a test asserts a throwing notifier is reported in the structured log and swallowed).
- **Impact analysis returns `null` counts, not `0`** — `IMPACT_DOMAINS` in `service.ts` names the
  four downstream domains (campaigns, monitors, scheduled posts, listening) with the ticket that
  adopts each. `db/campaigns|monitoring|publishing` are aspirational and tsconfig-excluded, so a
  real count is not computable yet; a `0` would be a false all-clear in a confirmation modal.
  When those modules land, replace `landsWith` with a query and keep the `null`-means-unknown
  contract in the response type.
- **`planUsage.limit` is `null` until P13** — the list route reports `connected` (FR-SOC-030's
  count half) and P13 billing owns the number. Quota buckets materialize with
  `SOCIAL_QUOTA_DEFAULT_LIMIT` (10 000), *not* a platform limit, so a fresh account's usage
  percentage is computed against that until an adapter states otherwise.
- **Pause ≠ heal.** `resume` restores `active` only from `paused`; a `needs_reauth` account 409s
  (FR-SOC-016's "without re-authentication" is about pausing, not reviving a dead token) — the
  re-auth path is `initiate`→`callback` again, which revives the disconnected/paused row.
- **Bulk operations (FR-SOC-018, module §8.6)** loop over exactly these primitives:
  `setAccountCollection` (pause/resume) and `markNeedsReauth`/`initiateConnect` (reauth). No
  bulk route exists yet — P2 priority, deferred on purpose.
