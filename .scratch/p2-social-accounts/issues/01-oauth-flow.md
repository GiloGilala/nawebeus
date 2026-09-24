# NWB-P2-001 — OAuth flow (initiate, single-use state with TTL, callback, connect)

Type: task
Status: done 2026-09-24
Phase: P2 (roadmap Phase 3 · §13)
Size: L
Blocked by: nothing (first ticket of the phase; carries the schema adoption).

## Why this exists

Roadmap §13 NWB-P2-001: *"OAuth flow (initiate, single-use state with TTL, callback, connect) —
state must be consumed once (replay test required)."* Measured state before this ticket
(2026-09-24):

- `db/social-accounts/` holds four aspirational tables (`social_accounts`, `oauth_states`,
  `social_account_health_log`, `token_refresh_log`) — excluded from `tsconfig.json`, absent from
  `db/schema.ts` and the baseline migration, never compiled.
- The schema file predates the id-width lesson: id/organization_id/user_id/connected_by/… are
  `varchar(32)` while Nawebeus ids are 36-char prefixed uuids — the exact defect migrations
  0005/0006/0007/0010 fixed elsewhere. Widened **in the adoption migration**, before first use.
- One latent compile-breaking bug: `idx_sa_circuit_breaker` indexes `table.circuit_breaker_open`,
  which is not the TS property name (`circuitBreakerOpen`) — Drizzle would receive `undefined`.
- No OAuth code exists anywhere under `src/` (the core `oauth_accounts` table is dormant sign-in
  machinery, unrelated).

## Scope (in)

- **Schema adoption (ground rule 7 / migration-doc M2):** review vs Module 3 spec → widths 64 →
  fix the index bug → exports in `db/schema.ts` → tsconfig exclude removed → migration `0011` →
  tenant/unique/enum constraint tests.
- **`src/lib/crypto.ts`** — AES-256-GCM (`crypto.subtle`) `encryptSecret`/`decryptSecret`
  (FR-SOC-003); key = `SOCIAL_TOKEN_ENCRYPTION_KEY` or derived from `JWT_ACCESS_SECRET`
  (production refuses the derivation, same superRefine shape as the storage rule).
- **Platform OAuth registry** — the five DEC-009 platforms with authorize/token endpoints, scopes,
  PKCE capability, and credential config names; generic code-for-token exchange client with
  **injectable `fetch`** (no platform call ever happens in CI).
- **OAuth service** — `initiateConnect` (128-char single-use state, 10-min TTL, PKCE S256 pair in
  `state_data`, relative-only `returnUrl`, authorize URL with state+challenge) and
  `handleCallback` (atomic single-use consumption, code→token exchange, AES-256-GCM encryption at
  rest, upsert with `ACCOUNT_ALREADY_CONNECTED` on a live duplicate (FR-SOC-004), reconnect
  revives a disconnected row, `socialaccount.connected` audit without token material) and
  `purgeExpiredOAuthStates` (the schema's 24-h-post-use cleanup).
- **Routes** — `POST /api/social/oauth/:platform/initiate` (auth + `socialaccounts.connect`,
  manager+) and `GET /api/social/oauth/:platform/callback` (public, state-validated; 302 to the
  state's `return_url` on success; generic error envelope otherwise).
- **Seed** — `socialaccounts.connect` in the manager+ tier (module §6.2 maps to Admin+Manager;
  codebase tier = `contentApproval`).

## Scope (out)

- Token **refresh** worker, rotation, `needs_reauth` surfacing (P2-002 — connect stores tokens;
  lifecycle moves them).
- Health checks / circuit breaker logic (P2-003), quota functions (P2-004).
- The five full **API adapters** (P2-005): this ticket ships the OAuth half of the adapter
  interface plus the exchange client; platform API clients arrive per-platform.
- Management routes: list / delete / pause / health (P2-006) and the rest of the
  `socialaccounts.*` matrix.
- Admin email notification on connect (FR-SOC-008, P1 priority) — with P2-006's routes.
- Real platform credentials (ops action per platform when adapters land).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | State = row id, consumed by `UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING` | Single-use + TTL in one atomic statement — a replay and an expired state are the same empty result, so the callback cannot distinguish (and cannot enumerate). |
| 2 | PKCE verifier in `state_data` jsonb | Server-side state makes PKCE nearly free; the row is the trust boundary, not the URL. S256 challenge goes out on the authorize URL. |
| 3 | Tokens stored only as `*_encrypted`; profile fields in plaintext | FR-SOC-003/FR-SOC-023. The audit action carries platform + username + scopes — never token material. |
| 4 | Duplicate active connection → 409 `ACCOUNT_ALREADY_CONNECTED`; disconnected row → revived | FR-SOC-004 forbids duplicates; the unique constraint makes revival the only re-connect path, and revival is the documented reconnect flow (`state_data.reconnecting`). |
| 5 | `returnUrl` must be a relative path (`/…`, not `//…`) validated at initiate | The callback redirects to it; an absolute URL would make the state row an open-redirect carrier. |

## Exit criteria / acceptance — all met 2026-09-24

- [x] Migration `0011_social_accounts.sql` creates the four tables with 64-wide id columns;
      `db/schema.ts` exports them; tsconfig exclude removed; fresh `db:migrate` verified via
      `information_schema`.
- [x] `src/lib/crypto.ts`: AES-256-GCM round-trip; unique IV per call; tampered ciphertext
      refused; wrong key refused. *(crypto.test.ts)*
- [x] `initiateConnect`: state row (128 chars, 10-min TTL), authorize URL carries client_id,
      redirect_uri, scope, state, and the S256 challenge when the platform does PKCE;
      unconfigured platform → validation error; absolute `returnUrl` rejected. *(oauth.test.ts)*
- [x] `handleCallback`: single-use **replay test** (second consumption of the same state fails),
      expired state fails, unknown state fails — all the same error; exchange happens with the
      stored verifier; tokens land encrypted (no plaintext in any column); row `soc_<uuid>`
      created with profile fields; `socialaccount.connected` audited (no token material);
      duplicate live connection → 409 `ACCOUNT_ALREADY_CONNECTED`; disconnected row revives.
- [x] Routes through the real app: initiate 401 without session; viewer 403 (manager+ connects);
      callback public → 302 to `return_url`; replayed callback → generic error; platform param
      pattern-checked. *(oauth.route.test.ts, fake exchange client injected)*
- [x] `purgeExpiredOAuthStates` deletes rows 24 h past expiry/use, keeps everything fresher.
- [x] Gates: typecheck ✅ · lint 0 errors · build ✅ · full `bun test` with `DATABASE_URL` ·
      `coverage:check` ✅ (services ≥85%, lib ≥90%).

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`) — first ticket of
  P2; the phase spec (`.scratch/p2-social-accounts/spec.md`) records the phase-level decisions
  (naming, key derivation, per-platform credential pairs, PKCE capability, public-callback rules).
