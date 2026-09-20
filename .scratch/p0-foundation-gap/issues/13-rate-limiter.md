# NWB-P0-013 — Fix the sliding-window rate limiter (F-12)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
306/306 `bun test` with a live database, 205 pass / 107 skip / 0 fail without
one, manual reclaim script run; committed locally — session's GitHub access
ended when PR #9 merged, so push + PR need a fresh session)
**Deps:** none. **Size:** S.
**Fixes:** F-12 (rate limiter never engages).

## Scope split (as decided in the roadmap)

- **Done in NWB-P0-012 (commit `d0b4498`):** the window-aware upsert, adopted
  verbatim as the MFA AC8 prerequisite.
- **This ticket:** the reclamation path, dedicated limiter tests, doc updates.

## What was built

| Piece | File |
| --- | --- |
| `reclaimRateLimits(db, graceMs?)` + `RATE_LIMIT_RECLAIM_GRACE_MS` (1 h); header comment updated | `src/lib/rate-limit.ts` |
| Manual reclaim script | `src/scripts/reclaim-rate-limits.ts` + `db:reclaim-rate-limits` package script |
| 5 dedicated tests (DB-backed, skip cleanly without one) | `src/tests/rate-limit.test.ts` (new) |
| F-12 status → fixed | `docs/plan/master-roadmap/02-defects.md` (finding row + status line) |
| P0-013 status → done | `docs/plan/master-roadmap/06-phase-1-foundation.md` |
| "sliding-window" → fixed-window wording | `db/core/rate-limits.ts` header |

`reclaimRateLimits` deletes buckets with `expires_at` older than the grace and
returns the Postgres `rowCount`. Unlike `checkRateLimit` it throws on failure:
it runs operator-invoked, where loud beats silent. Phase 2 (NWB-P1-001)
schedules the same export nightly.

## P0-017 follow-up — already satisfied, no change needed

The P0-012 roadmap note ("use the same normalized-IP helper after NWB-P0-017"
for the rate-limit key) is fulfilled by NWB-P0-017's route conversions:
`signin.route.ts:48-51` passes `getClientIp(c, config)` into
`signIn(..., { ip })` → key `ip:<normalized>`; `mfa.route.ts:59-65` passes it
into the verify path → key `mfa-verify:<user>:<normalized>`. The only two
`checkRateLimit` call sites are both normalized. `mfa.ts`'s remaining
`normaliseIp` import is for the audit `actorIp`, unrelated to rate keys.

## Red-green record (2026-09-20)

The pre-P0-012 statement was recovered from git history (`acd1c16`) and run
against the new tests with only the new reclaim export appended (reclaim is
new code in both runs, so it stays green throughout):

- **Red:** all 4 `checkRateLimit` tests fail (never blocks — count sticks
  at 1); reclaim passes. 1 pass / 4 fail across the file.
- **Green:** 5 pass / 0 fail after restore (restore verified byte-identical).

Manual script run: seeded one bucket expired 2 h ago → `deleted 1 expired
bucket(s)`; second run → `deleted 0`. End-to-end proven.

## Test notes (for future DB-test authors)

- Time control is by backdating `window_start`/`expires_at` directly — no
  fake timers, no real waits, per the roadmap.
- Drizzle's `sql` template expands a JS array param into a `($1,$2,…)` row
  list, so `= ANY (${arr}::text[])` fails ("cannot cast record to text[]").
  The working shape is `IN ${arr}` (drizzle expands it into `IN ($1,$2,…)`).

## Acceptance criteria

- [x] Limiter correct across ≥3 window boundaries per bucket (test)
- [x] Expired rows reclaimable via export + script (test + manual run)
- [x] New tests verified red against the old statement, green against the new
- [x] `bun test` green with DB; typecheck, lint, build green
