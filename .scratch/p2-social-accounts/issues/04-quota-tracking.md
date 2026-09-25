# NWB-P2-004 — Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`)

Type: task
Status: done 2026-09-25
Phase: P2 (roadmap Phase 3 · §13)
Size: S–M
Blocked by: NWB-P2-001 (the adopted `social_accounts` row the quota jsonb lives on).

## Why this exists

Roadmap §13 NWB-P2-004: *"Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`) — feeds P13
plan limits."* Module 3 §3.5 gives the behavioral rules around the tracked numbers: real-time
per-platform consumption (FR-SOC-031), non-essential polling slowed at 80% (FR-SOC-033),
non-essential syncing paused at 90% (FR-SOC-034), queue-and-resume at 100% (FR-SOC-035), admin
alerts at 80%/95% (FR-SOC-038). The schema already decided *where*: an inline `quota_tracking`
jsonb (`{ read: {limit, used, resetsAt}, write: {…} }`) — quotas are small, read/written together,
and never queried relationally. This ticket is the service that makes that jsonb true.

## Scope (in)

- **`hasQuotaRemaining(orgId, accountId, kind, units)`** — the gate every adapter call passes
  through (P2-005): `units` available under the bucket's limit before the reset instant; unknown
  bucket kinds default to a fresh bucket rather than silently passing.
- **`updateQuotaUsage(orgId, accountId, kind, units, resetsAt?)`** — atomically increments the
  jsonb bucket (jsonb path update, optimistic-versioned per the schema header's rule), sets
  `resetsAt` when supplied, and drives `quota_status`: `healthy` → `warning` at ≥80%
  (FR-SOC-033) → `critical` at ≥95% (FR-SOC-038) → `exhausted` at ≥100% (FR-SOC-034/035).
- **Status transitions audited once per crossing** (not per tick): entering `warning`,
  `critical`, or `exhausted` writes one audit event each — the FR-SOC-038 alerts' record until
  P6 delivers the notification hop.
- **`resetDueQuotas()`** — rolls `used` to 0 (and `quota_status` back to `healthy`) for buckets
  whose `resetsAt` has passed, so "resume immediately after reset" (FR-SOC-034) is automatic.
  Called by the existing daily reclamation job (`maintenance.rate-limit-reclaim` gains a second
  duty — same 02:00 slot, same "cheap when empty" economics), not a new queue.
- **`getQuotaSnapshot(orgId, accountId)`** — the read the P2-006 `usage` route and P13 plan
  limits consume: buckets + derived status + utilization percentages.

## Scope (out)

- The **priority queue** (FR-SOC-032: Engage > mentions > analytics > backfill) — that is a
  dispatch-policy concern of the P2-005 adapters / P7 engagement, sitting *on top of* these
  gates; recorded as their scope.
- Platform-tier weights (FR-SOC-037: Pro 2×, Enterprise 5×) — billing-tier data comes from P13;
  the gate takes its budget from the row today.
- **In-app/email alert delivery** at 80%/95% (FR-SOC-038's second half) and the quota dashboard
  (FR-SOC-031's display half) — P6 channels / P2-006+UI, same deferral pattern as FR-SOC-022.
- `Retry-After` handling on 429 (FR-SOC-036) — landed as the health layer's non-advancing class;
  the retry loop is P2-005's.

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Percentages from `used/limit` per bucket; `quota_status` = worst bucket | An account is only as usable as its tightest bucket — a `read`-exhausted account cannot sync even with `write` headroom. |
| 2 | Increment via `jsonb_set` in one UPDATE, not read-modify-write | Two workers spending quota concurrently must not lose an increment (the schema header's optimistic-locking rule; last-writer-wins on a stale version throws instead). |
| 3 | Unknown bucket kind materializes a fresh bucket (limit from config default) rather than refusing | The adapters will name kinds per platform; a missing bucket is "no data yet", not an error — but it is *bounded* by `SOCIAL_QUOTA_DEFAULT_LIMIT` so "unknown" never means "unlimited". |
| 4 | Audit on crossings, keyed by "status actually changed" | The 80%-alert firing every call past the line would be spam; the crossing is the event. |
| 5 | Reset rides the existing nightly reclamation job | A daily-quota world (YouTube's 10k/day) makes `*/5` overkill and a tenth queue unjustified; the reclamation slot is 02:00 in the org's timezone and idempotent. |

## Exit criteria / acceptance — all met 2026-09-25

- [x] `updateQuotaUsage` increments atomically (20 concurrent increments of 1 land exactly 20;
      row version 22 = seed 1 + materialize + 20), and stamps `resetsAt` when supplied.
- [x] Status ladder: 0→+800/1000→`warning` audit, no audit without a crossing, +149→`critical`
      audit, +50→`exhausted` audit (crossing audits total exactly
      `[quota_critical, quota_exhausted, quota_warning]`); worst-bucket-wins across read/write.
- [x] `hasQuotaRemaining`: true with headroom, false past the limit, false at exactly 100%,
      true when the bucket's `resetsAt` is in the past (window rolled, untracked/bucket-less
      accounts pass).
- [x] `resetDueQuotas`: due buckets zero + `healthy`, non-due buckets untouched; second run is
      a no-op (idempotent).
- [x] `getQuotaSnapshot`: buckets + per-bucket utilization (capped at 100) + derived status.
- [x] Reclamation job extended (`quotaReset` count in its outcome); queue suite re-pinned.
- [x] Refusals: negative units → ValidationError; unknown account → NotFoundError.
- [x] Gates: typecheck ✅ · lint 0 errors · build ✅ · `bun test` **915 pass / 0 fail** (909
      before, +6) · `coverage:check` ✅ (services 91.1%, lib 96.8%).

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`); fourth sandbox
  rebuild, environment restore is routine (bun via npm, embedded PG, branch re-fetch).
- 2026-09-25: two environment-driven corrections during the test pass, both recorded for the
  next ticket: (1) **PG 18 `jsonb_set` no longer creates missing intermediate objects** — a
  2-level path on `'{}'` is a silent no-op — so the spend composes the full bucket object and
  merges it at the top level (`jsonb_set(target, ARRAY[kind], bucket || jsonb_build_object(...))`).
  (2) **Drizzle renders an interpolated `undefined` as an empty string**, not a NULL param —
  the optional `reset` flag is normalized to a concrete boolean before it touches the SQL
  template (`WHEN ::boolean` was a syntax error). Also: unknown-account spends now raise
  NotFoundError (a post-update existence read distinguishes 404 from the version-race retry).
