# NWB-P2-003 — Account health checks + circuit breaker

Type: task
Status: done 2026-09-24
Phase: P2 (roadmap Phase 3 · §13)
Size: M
Blocked by: NWB-P2-002 (the refresh primitive the 401 path reuses; the health-log/status fields).

## Why this exists

Roadmap §13 NWB-P2-003: *"Account health checks + circuit breaker — breaker must block dispatch
(P3/P7 consumers)."* Module 3 §3.6/§3.8 supply the rules: lightweight probes (FR-SOC-039), "Error"
after 10 consecutive failures + breaker (FR-SOC-040/BR-SOC-020), status within 5 minutes of an
event (FR-SOC-041), error classification (FR-SOC-053), 401 → re-auth immediately (FR-SOC-055),
breaker opens after 10 consecutive failures and stays open "until manually reset or
health-checked" (FR-SOC-056), critical escalation after 24 consecutive hours (FR-SOC-059).

## Scope (in)

- **Probe** (`probeAccount`): one cheap authenticated GET per platform (the registry's probe
  endpoints — quota cost ≈ 1 unit) with the unsealed access token; injectable `fetch`; latency +
  outcome into `social_account_health_log` with transition semantics.
- **Classification** (FR-SOC-053): pure `classifyPlatformHttpError` — `transient` (5xx), `auth`
  (401), `rate_limited` (429), `client` (400/403), `not_found` (404), `network` (no response) —
  driving different handling per class; plus the FR-SOC-054 backoff helper
  (`platformBackoffDelayMs`: 1s/2s/4s + jitter) for the P2-005 adapters.
- **Consecutive-error ledger** (FR-SOC-040): failures increment `consecutive_error_count` and
  stamp `last_error_*`; at **10** the breaker opens (`circuit_breaker_open`, `opened_at`, status
  `error`, audit `socialaccount.breaker_opened`). The schema header's "default: 5" loses to the
  module spec's 10 (recorded decision).
- **Recovery** (FR-SOC-056): a successful probe closes the breaker, zeroes the count, restores
  `active`, and audits `socialaccount.breaker_recovered` — recovery is *demonstrable*, the gate's
  word.
- **401 path** (FR-SOC-055): no retry — one `on_demand` refresh (P2-002's primitive), re-probe
  once; refresh failure surfaces as `needs_reauth` (existing trio).
- **429** (BR-SOC-019): recorded as `rate_limited`, advances nothing — rate limits are not
  account failures.
- **Dispatch gate**: `assertDispatchAllowed` — `active` + breaker closed or it throws
  `CircuitBreakerOpenError` (503). This is the seam P3 publishing and P7 engagement call before
  every send.
- **Chronic escalation** (FR-SOC-059): breaker open > 24 h with no recovery → audit
  `socialaccount.chronic_failure` at `critical` + an `escalated` health row for idempotency.
- **Job** — `socialaccounts.health-check`, `*/5` (FR-SOC-041's propagation bound), tenth queue,
  batch 50/run: breaker-open accounts every run (half-open recovery probing); the rest on the
  FR-SOC-039 six-hour cadence (`social_account_health_log` latest row is the "last checked"
  source — no new column).

## Scope (out)

- Platform status-page monitoring (FR-SOC-043) — external feed integration, later phase.
- WebSocket push of status changes (FR-SOC-041's delivery half) and the attention dashboard
  (FR-SOC-044) / diagnostics panel (FR-SOC-042) — UI + delivery, P6/P7-phase work.
- Manual breaker reset endpoint — lands with P2-006's management routes (`reauth`/`pause`).
- Notification hops for escalation ("notify support") — P6 delivery channels, same deferral as
  FR-SOC-022's admin email; the audit event is the record until then.
- The backoff-retry *loop* around adapter calls (FR-SOC-054's consumer) — lands with the P2-005
  adapters; this ticket ships the helper.

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Threshold 10 per the module spec, not the schema header's 5 | FR-SOC-056/BR-SOC-020 are the requirement; the aspirational schema comment was a sketch default. One number, in code, with the discrepancy noted here. |
| 2 | Breaker-open accounts probe every 5-min run; everyone else every 6 h | Half-open is how a breaker recovers without human intervention, and a probed account costs ~1 quota unit — the cheap way to make recovery automatic and demonstrable. |
| 3 | Recovery = the probe's own success, no separate "reset" worker | FR-SOC-056 names health-checking as the release condition; a second reset path would be a second way to be wrong. |
| 4 | Escalation idempotent via an `escalated` health row newer than `opened_at` | The condition "breaker open > 24 h" stays true for days; the marker row makes the critical audit a once-per-outage event, not a per-tick spam machine. |
| 5 | 401 → reuse the P2-002 refresh primitive with `on_demand` trigger | One implementation of "try the refresh token"; the health probe merely decides to call it. |

## Exit criteria / acceptance — all met 2026-09-24

- [x] Probe success (200): health row `healthy` with latency, error state zeroed, breaker closed
      (including a pre-opened breaker — recovery demonstrated), audit trail.
- [x] Probe 500: `consecutive_error_count` increments, `last_error_*` stamped, health row
      `error`; the 10th consecutive failure opens the breaker (row fields + audit) and
      `assertDispatchAllowed` starts throwing `CircuitBreakerOpenError`.
- [x] Probe 401: exactly one `on_demand` refresh attempt → re-probe success restores; refresh
      failure → `needs_reauth` (no further probing of that account).
- [x] Probe 429: `rate_limited` health row, counter untouched, breaker untouched.
- [x] Chronic: breaker opened > 24 h → one critical audit + `escalated` marker; the next run is
      silent (idempotent).
- [x] Job wired (10th queue, `*/5`, `QUEUE_CRON_SOCIAL_HEALTH_CHECK`), definitions pinned,
      handler reports `{checked, healthy, failed, breakerOpened, breakerRecovered, escalated}`.
- [x] Gates: typecheck ✅ · lint 0 errors · build ✅ · `bun test` **909 pass / 0 fail** (897
      before, +12) · `coverage:check` ✅ (services 90.9%, lib 96.8%; social service 90.8%, job 100%).

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`); third sandbox
  rebuild of the phase (bun + embedded PG re-provisioned, branch refs re-fetched from the remote
  — routine now, noted once).
