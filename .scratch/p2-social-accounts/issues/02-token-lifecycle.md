# NWB-P2-002 — Token lifecycle (refresh worker, rotation, failure surfacing)

Type: task
Status: done 2026-09-24
Phase: P2 (roadmap Phase 3 · §13)
Size: M
Blocked by: NWB-P2-001 (the adapter interface, the registry, and the sealed token columns).

## Why this exists

Roadmap §13 NWB-P2-002: *"Token lifecycle (encrypted at rest, refresh worker, rotation, failure
surfacing)"*. The encryption half landed with P2-001 (`src/lib/crypto.ts` — AES-256-GCM, tokens
sealed before they ever touch a row); this ticket is the *lifecycle*: tokens die on provider
clocks (Google's access token in one hour, X's in two), so something has to renew them on the
same clock — and when renewal is impossible, the fact has to surface instead of rotting.

## Scope (in)

- **Refresh grant** on `PlatformOAuthClient` (`refreshTokens`) — RFC 6749 §6 against the same
  token endpoint/auth style the registry already encodes; `OAuthExchangeError` now carries the
  provider's HTTP status for the log.
- **The sweep** (`refreshDueTokens`): every active account whose token expires within the next
  hour (BR-SOC-013), oldest-expiry first, batched at 50 so one tick cannot walk the table.
- **The job** — `socialaccounts.token-refresh`, `*/5 * * * *` (FR-SOC-019), ninth queue, outside
  the nightly chain (provider clocks, not ours), `QUEUE_CRON_SOCIAL_TOKEN_REFRESH` overridable.
- **Rotation**: a provider-issued refresh token replaces the stored one; absence keeps it
  (provider-dependent — X rotates, Meta often does not). `COALESCE` in the UPDATE, and the log
  row's `new_refresh_token_issued` records which happened.
- **Failure surfacing** (FR-SOC-021/022): exactly one retry, then `needs_reauth` + `is_active
  = false` under an optimistic version bump, a `social_account_health_log` transition row (the
  schema's CHECK demands the error message), and a `socialaccount.needs_reauth` audit event.
- **Full `token_refresh_log`** (FR-SOC-024): a row per attempt, success or failure, with
  trigger, old/new expiry, duration, rotation flag, retry count, failure code + HTTP status —
  never token material.

## Scope (out)

- **Message dispatch to Primary Manager + Admins** (FR-SOC-022's second half) — the surfacing
  (status + health log + audit) is delivered; the *notification hop* joins P2-006's routes, or
  P6's delivery channels when they land (P6 must precede alert-firing tickets anyway).
- Token rotation on *sensitive operations* (FR-SOC-025, P2 priority) — refresh-time rotation is
  in; posting/DM-triggered rotation is a P3-consumer concern.
- `error_recovery` / `on_demand` refresh triggers — the enum values exist and the primitive
  takes them, but their callers are the health checks (P2-003) and API adapters (P2-005).
- Real platform credentials (ops action, per-platform with P2-005).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Sweep selects `status='active' AND token_expires_at <= now()+1h` | The window *is* BR-SOC-013; `needs_reauth`/`disconnected` rows are structurally excluded — a dead token must not be retried forever. |
| 2 | `refreshAccountToken` is a single-purpose primitive; retry + escalation live in `refreshDueTokens` | P2-003/P2-005 will call the primitive with their own triggers (`on_demand`, `error_recovery`); the retry policy belongs to the sweep that owns the clock. |
| 3 | Rotation via `COALESCE`, not a conditional UPDATE | One statement, still optimistic-versioned; the old ciphertext survives unless the provider replaced it — and non-deterministic sealing means "same plaintext, different bytes" must never be mistaken for a rotation. |
| 4 | `needs_reauth` writes a health-log transition row, not just a status flip | The schema's `chk_sahl_error_consistency` requires the message; the transition is the operational timeline the health checks (P2-003) will append to. |
| 5 | Job audit action `socialaccounts.refreshed` (not `socialaccount.…`) | The job-descriptor naming rule is underscore-free `<resource>.<verb>`; the registry format allows `_` but the worker's own table does not — one convention per table. |

## Exit criteria / acceptance — all met 2026-09-24

- [x] Refresh grant implemented on the generic client (post/basic auth styles both) and faked in
      every test; no test ever touches a provider.
- [x] Sweep: due-within-the-hour selected (121-min-out not due); `disconnected`/`needs_reauth`
      never due; batch capped.
- [x] Success path: new access sealed (ciphertext at rest, unseal round-trips), rotation
      replaces / absence keeps the refresh token, version 1→2, `token_last_refreshed_at` set,
      success log row with old/new expiry + rotation flag + trigger.
- [x] Failure path: attempt → log row (retry 0) → single retry → log row (retry 1) →
      `needs_reauth` + health transition with message + audit event (`attempts: 2`, provider
      code, no token material). Verified `invalid_grant`/400 end-to-end.
- [x] No-stored-refresh-token case surfaces immediately without calling the provider.
- [x] Job wired: `QUEUE_JOBS.socialTokenRefresh` + schedule default `*/5` + `resolveSchedules` +
      `QUEUE_CRON_SOCIAL_TOKEN_REFRESH`; definitions pinned (cadence, position after
      impersonation, audit descriptor); handler reports `{due, refreshed, rotated, needsReauth,
      failed, errors}`.
- [x] Gates: typecheck ✅ · lint 0 errors · build ✅ · `bun test` **897 pass / 0 fail** (889
      before, +8) · `coverage:check` ✅ (services 91.0%, lib 96.8%; social service 92.4%, job
      100%).

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`).
- 2026-09-24: done. The sandbox reset again between cycles (`.git` reverted to the session base;
  restored from the remote with `git fetch` + `git reset`, PG re-initialized). One real bug the
  tests caught before it shipped: the no-rotation UPDATE wrote NULL over the stored refresh
  token — `COALESCE` now keeps the incumbent. FR-SOC-022's admin notification is recorded as
  P2-006 scope with the reason (P6 ordering constraint), so it cannot be silently forgotten.
