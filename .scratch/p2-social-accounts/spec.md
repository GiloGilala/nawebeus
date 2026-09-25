# P2 — Social accounts & platform integration

**Feature slug:** `p2-social-accounts`
**Spec owner:** Engineering Lead
**Roadmap:** `docs/plan/master-roadmap/08-phase-3-4-modules.md` (§13) · execution plan §5 P2 · PRD Module 3
**Status:** in-progress — **5 of 6 tickets done** (P2-005 splits into five per-platform tickets
per the roadmap note, so the *ticket* count is 6 and the *platform-adapter* work inside P2-005 is
five). **NWB-P2-001** (OAuth flow) **done 2026-09-24** (evidence in issues/01): schema adoption
(0011), AES-256-GCM sealing, platform registry + exchange client, single-use state machine with
the required replay test, `/api/social` initiate + public callback, `socialaccounts.connect`
seeded manager+. **NWB-P2-002** (token lifecycle) **done 2026-09-24** (evidence in issues/02):
the refresh sweep (`socialaccounts.token-refresh`, */5, ninth job) refreshing tokens one hour
before expiry, rotation recorded, exactly one retry before `needs_reauth` surfaces with a health
transition + audit event, every attempt in `token_refresh_log`. **NWB-P2-003** (health + breaker)
**done 2026-09-24** (evidence in issues/03): the */5 health-check job (tenth queue) probing open
breakers every tick (half-open recovery) and the rest six-hourly, the 10-failure breaker
(FR-SOC-056) with `assertDispatchAllowed` as the P3/P7 dispatch gate, 401→refresh-once→re-probe,
429 advancing nothing, chronic >24h escalation to a critical audit. **NWB-P2-004** (quota
tracking) **done 2026-09-25** (evidence in issues/04): the jsonb ledger (`quota_tracking` +
derived `quota_status`) with an atomic single-statement spend, the worst-bucket-wins ladder
healthy→warning(≥80%)→critical(≥95%)→exhausted(≥100%) with one audit event per crossing
(FR-SOC-033/034/038), the `hasQuotaRemaining` gate (FR-SOC-035), and the `resetDueQuotas` roll
riding `rate-limit-reclaim` for automatic resume. **NWB-P2-005** (platform adapters ×5)
**done 2026-09-25** (evidence in issues/05): the `PlatformAdapter` interface (PRD 8.3.2) with a
registry over all five platforms, the profile-fetch dialects moved out of the OAuth client (zero
per-platform branches left), probe request shaping per platform (Reddit's required User-Agent),
and the Meta pair's native refresh grants (`fb_exchange_token` POST-form / `ig_refresh_token`,
both `rotated: false` keeping the stored token). 929/929 tests; coverage gate 93.5% / 96.8%.

**Goal:** org-scoped OAuth connections to the DEC-009 five (YouTube, X, Instagram, Facebook,
Reddit), with tokens encrypted at rest, a health/breaker layer that protects downstream
dispatch (P3 publishing, P7 engage), and quota tracking for P13 plan limits.

**Entry gate:** Phase 2 exit. Met on the engineering side 2026-09-24 (all seven clauses; see
`.scratch/p1-shared-infra/spec.md`) — two operator actions were recorded there as residuals
(Resend sandbox send, R2 live smoke) and are not engineering work; this phase starts on the
strength of that record.

**Exit gate (plan §13):** all five platforms connect, refresh unattended, report health; breaker
trips and recovers demonstrably. P2-004 adds the quota half: per-platform quota *numbers*
(default 10 000/day via `SOCIAL_QUOTA_DEFAULT_LIMIT` until real platform limits are configured)
are P13 plan-limit config, not schema work — P13 reads the same ledger this phase writes.
**Security note (plan §13):** the OAuth callback is a public endpoint — CSRF via single-use state
(replay-tested); token secrets never in responses or logs (FR-SOC-023 / BR-SOC-016).

## Audit table (verified 2026-09-24, from `04-gap-matrix.md` §13 + recon)

| ID | Ticket | Verified current state | Notes added by this spec |
|---|---|---|---|
| NWB-P2-001 | OAuth flow (initiate, single-use state with TTL, callback, connect) | `db/social-accounts/` aspirational (4 tables, excluded from tsconfig); no OAuth code anywhere (`src/services/auth` has none — `oauth_accounts` core table is dormant sign-in machinery) | Schema adoption (migration-doc M2) happens **here first**: id columns 32→64 *before* first use (the 0005/0006/0007/0010 lesson), the `idx_sa_circuit_breaker` index references a non-existent TS property (`table.circuit_breaker_open`) and must be fixed to compile. PKCE (FR-SOC-001) rides the state row; token *encryption* lands here because connect stores tokens (FR-SOC-003). |
| NWB-P2-002 | Token lifecycle (encrypted at rest, refresh worker, rotation, failure surfacing) | Tables exist after P2-001's adoption (`token_refresh_log`); `src/lib/crypto.ts` AES-256-GCM helper lands in P2-001 (connect needs it), lifecycle workers land here | Refresh 1 h before expiry (FR-SOC-019, 5-min job), `needs_reauth` surfacing (FR-SOC-022), full `token_refresh_log`. |
| NWB-P2-003 | Account health checks + circuit breaker | `social_account_health_log` table ready after adoption | Breaker must block dispatch for P3/P7 consumers. |
| NWB-P2-004 | Quota tracking (`hasQuotaRemaining`, `updateQuotaUsage`) | `quota_tracking` jsonb inline | Feeds P13 plan limits. |
| NWB-P2-005 | Platform adapters ×5 (XL → five tickets, adapter interface first) | Interface (`PlatformOAuthClient` + profile registry) lands in P2-001; the five full API adapters split out | PRD 8.3.2 "integration abstraction layer". |
| NWB-P2-006 | Routes (list, connect, callback, delete, health) + `socialaccounts.*` seed | Initiate/callback routes exist after P2-001; management surface + full RBAC matrix lands here | P1-014 role-matrix extension. |

## Design decisions (phase-level, recorded up front)

1. **Codebase naming over module-doc naming.** The module spec's `social:accounts:connect` colon
   style becomes `socialaccounts.connect` (`resource.action`), per every existing permission in
   `src/seed.ts`. The module spec's platform literal `twitter` is the enum's `twitter_x`.
2. **Encryption key derivation follows the storage-signing precedent.** `SOCIAL_TOKEN_ENCRYPTION_KEY`
   optional; unset → AES key derived from `JWT_ACCESS_SECRET` (a deployed secret that already
   exists); production refuses local-by-omission (superRefine, same shape as the storage rule).
3. **OAuth client credentials are per-platform optional pairs** (`OAUTH_<PLATFORM>_CLIENT_ID/_SECRET`);
   an unconfigured platform fails `initiate` with a validation error — the flow never half-starts.
   Real network token exchange uses injectable `fetch` (the Resend-transport pattern); CI never
   talks to a platform.
4. **PKCE per platform capability** (FR-SOC-001): S256 verifier/challenge stored in the state row's
   `state_data`; enabled for youtube/twitter_x/reddit, not for the Meta pair (server-side exchange).
5. **The callback is public and state-authorized** (module §6.3); `return_url` is restricted to
   relative paths at initiate time (no open redirect), and every failure mode is the same generic
   error so the endpoint cannot enumerate states.

## Tickets

Files under `issues/` as they are claimed; the table above is the roadmap's §13 list.

## Exit-gate evidence

Collected here as tickets land. Current: the connect half of "all five platforms connect" is
proven against fakes (the roadmap's own test bar — real provider calls are the P2-005
per-platform tickets' concern, credentials are ops actions). Refresh-unattended, health, and
breaker clauses await P2-002/P2-003.

### Exit-gate progress

"Refresh unattended" ✅ (P2-002's sweep on its shipped cron). "Report health" ✅ (P2-003: probes,
health log, breaker with demonstrated trip + recovery). Remaining: the five platforms connecting
for real = P2-005's adapters + credentials (ops), and the breaker "trips and recovers
demonstrably" is pinned by `src/tests/social/health.test.ts` against the real app + DB.

### Environment note (2026-09-24)

The agent sandbox was rebuilt this cycle: bun 1.4.2 (npm distribution — bun.sh blocked), embedded
PostgreSQL **18.4** (via `@embedded-postgres/linux-x64`; deb repos unreachable). PG 18's stricter
tokenizer exposed a latent SQL-format bug the P1-011 suite carried harmlessly on PG 14 —
`WHERE s.organization_id = ${organizationId}${scopeClause}` interpolated to `$1AND` (no
whitespace); fixed in `impersonation.service.ts` and the config production tests updated for the
new social-token gate. No behavior change on PG 14. CI pins `postgres:14`
(`.github/workflows` — the Arena App cannot push workflow files, so it stays 14 for now): the
dev sandbox at PG 18 is the *stricter* gate of the two, and the fix is correct under both
tokenizers. Watch the `${param}${clause}` adjacency pattern in all new dynamic SQL.
