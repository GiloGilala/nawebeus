# NWB-P2-006 — Routes (list, connect, callback, delete, health) + `socialaccounts.*` seed

Type: task
Status: done 2026-09-25
Phase: P2 (roadmap Phase 3 · §13)
Size: M
Blocked by: NWB-P2-001…005 (all landed — this is the phase's closing ticket).

## Why this exists

Roadmap §13 NWB-P2-006: *"Routes (list, connect, callback, delete, health) — envelope + RBAC
(`socialaccounts.*` permissions added to seed — extend the P1-014 role matrix)."* P2-001 shipped
the two OAuth routes (initiate + public callback); the *management* surface — the part every
settings screen and the P3/P7 consumers lean on — was still missing, as were the read/disconnect
permissions in the seeded matrix.

## Scope (in)

- **Seed** — `socialaccounts.read` (everyone), `socialaccounts.usage` (manager+ tier), and
  `socialaccounts.disconnect` (admin-only tier) joining `socialaccounts.connect`; the mapping
  from Module 3 §6.2's Admin/Manager/Analyst/Viewer matrix onto the codebase's role tiers is
  recorded in the seed comment.
- **`GET /api/social/accounts`** — the connected-account list (cursor-paginated keyset on
  `connected_at, id` with µs precision, the media library's pattern), `platform`/`status`
  filters, projections that structurally cannot carry token columns (FR-SOC-023).
- **`GET /api/social/accounts/:accountId`** — full detail: profile fields, status, breaker
  state, last error, quota snapshot (P2-004's `getQuotaSnapshot`), and the latest health-log
  entry.
- **`GET /api/social/accounts/:accountId/health`** — the recent health-log timeline (diagnostics
  half of FR-SOC-042; the panel UI is later-phase).
- **`GET /api/social/usage`** — org-wide quota summary per account (FR-SOC-031's dashboard
  read; manager+).
- **`DELETE /api/social/accounts/:accountId`** — the disconnect (FR-SOC-012/013/014): requires
  the account's exact `platformUsername` as a typed confirmation, best-effort platform token
  revocation through a new optional `revokeRequest` adapter hook (YouTube's `oauth2:revoke`,
  Reddit's `revoke_token`; the Meta pair has no user-token revoke endpoint — recorded, tokens
  are wiped locally regardless), then wipes both token columns, sets `disconnected` +
  `disconnected_at/by` + `data_retention_until = now() + 90 days`, and audits
  `socialaccount.disconnected`.
- **Service**: `listAccounts`, `getAccountDetail`, `getAccountHealthLog`, `getOrgQuotaUsage`,
  `disconnectAccount` (revocation outcome recorded, never thrown to the caller as a blocker).

## Scope (out)

- Pause/resume (FR-SOC-016/017), re-auth initiation route, primary-manager assignment
  (FR-SOC `socialaccounts.assign`), and bulk operations (FR-SOC-018, P2 priority) — the module
  spec marks pause P1, the rest P2; the roadmap's route list does not include them and each
  deserves its own ticket when a consumer needs it.
- Admin email notification on connect (FR-SOC-008) and the FR-SOC-038 alert *delivery* — P6
  channels, already recorded twice (P2-002/P2-003).
- Platform status-page monitoring (FR-SOC-043) and WebSocket push (FR-SOC-041's delivery half).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Disconnect confirmation is the exact platform username, in the body | FR-SOC-012 verbatim; a query-param confirmation would end up in access logs. |
| 2 | Revocation is best-effort and its outcome is audited, never thrown | The tokens are wiped locally either way; a platform-side failure must not strand the row as "connected" — the security property lives in the wipe, not the provider call. |
| 3 | `revokeRequest` is an optional adapter hook, not a profile table row | Revocation is a *request dialect* (method/body/auth placement), which is exactly what adapters own since P2-005; only two of the five platforms have one. |
| 4 | Detail/detail-health are one account per call; usage is the org roll-up | Matches the module's endpoint table (§6.3) and keeps the list query cheap — the heavy per-account data (quota buckets, health rows) is fetched only for one account at a time. |
| 5 | `data_retention_until = now() + 90 days` at disconnect | FR-SOC-014's read-only retention window; the retention worker's existing schedule consumes the column. |

## Exit criteria / acceptance — all met 2026-09-25

- [x] Seed: `socialaccounts.read` in `everyone`, `socialaccounts.usage` in the manager tier,
      `socialaccounts.disconnect` in the admin tier; matrix test still green.
- [x] List: 401 without session; viewer reads (FR-SOC matrix gives read to everyone);
      filters work; keyset walk with no repeats; no token material anywhere in the response.
- [x] Detail: quota buckets + latest health row included; unknown/disconnected id → 404
      (anti-enumeration, consistent with the OAuth callback).
- [x] Health timeline: newest-first, latency/error-code present.
- [x] Usage: manager+ (viewer 403); per-account buckets with percentages.
- [x] Disconnect: username-confirmation mismatch → 422; viewer **and** manager → 403; admin →
      200 with both token columns NULL, `disconnected` + retention stamped, audit row (reason +
      revocation outcome); revocation attempted for youtube (scripted fetch asserts the call);
      Meta pair records "not supported"; repeat DELETE → 404.
- [x] Gates: typecheck ✅ · lint 0 errors (867 pre-existing warnings repo-wide) · build ✅ ·
      `bun test` **946 pass / 0 fail** (929 at the merge baseline — this plan's earlier
      "909 before / +21 → 930" guess was wrong: the merge carried P2-004's `quota.test.ts`
      and P2-005's `adapters.test.ts`, +20 over the 909 measured at P2-003; this ticket adds
      14 route tests + 3 adapter revocation tests = +17) · `coverage:check` ✅ (services 93.6%,
      lib 96.8%; social.route 97.3%, social service 94.2%).

## Comments

- 2026-09-25: claimed by the Arena agent (session `arena/01a0d531-nawebeus`) — the phase's last
  ticket; opened against a fresh PR because #22 (P2-001…005) merged 2026-09-25 14:35 UTC.
- 2026-09-25: three traps the implementation hit, all recorded here for the next social ticket:
  1. **The whole test file shares one transaction** (`createTestDb` is one `BEGIN`), so
     `connected_at`'s `now()` is frozen — every row ties and any "newest first" helper keyed on
     `connected_at DESC LIMIT 1` silently returns the max-uuid row. Keyset tiebreak on `id` is
     what makes pagination deterministic; test helpers must select by a unique key instead.
  2. **Statuses are `active | error | paused | needs_reauth | disconnected |
     pending_verification`** (the P0-era `social_account_status` enum) — there is no
     `connected`. The list filter validates against the enum, and the list hides
     `disconnected` rows unless the filter names them explicitly.
  3. **Raw `db.execute` rows carry timestamps as strings** (drizzle's pg type parser passes
     them through), so the management reads normalize through `toDate()` before handing a
     `Date` to the routes — otherwise `toISOString()` in a serializer is a 500.
