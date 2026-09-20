# NWB-P0-002 — DSAR data export (AC8 of FR-AUTH-007)

**Status:** done — 2026-09-20
**Source task:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-002.
**Module spec:** FR-AUTH-007 AC8 — "NDPR DSAR request triggers equivalent data package export".
**Deps:** none (Phase 1 slice is synchronous; the queue swap is a Phase 2 follow-up). **Size:** M.

## Objective (from the plan task)

Any authenticated user (and an admin on their behalf) can request a machine-readable
export of their personal data; delivered within the NDPR window (PRD: 24h). Phase 1
slice: **synchronous** export behind the route — bounded (own data only, capped page
size, 10k rows/section with a truncation marker) — and the job-queue swap lands in
Phase 2 (do not build a bespoke worker).

## Design

**Schema** — new active table `data_export_requests` (core): `id`, `user_id`
(FK cascade — the data subject), `requested_by` (nullable, set-null — admin on their
behalf vs. self), `status` (Phase 1 always `completed`; the enum's pending/processing/
failed values are the Phase 2 queue's), `payload` jsonb (the whole export), `expires_at`
(download window), timestamps. The aspirational `db/compliance/dsar_requests` is a
case-management shape for a later module and is not wired into the active schema — this
table is the Phase 1 record. Download window: 7 days; expiry answers **410 Gone**.

**Service** — `src/services/users/dsar.service.ts`:
- `requestDataExport(db, { userId, requestedById })` — builds the export synchronously,
  writes the audit event **first** (`compliance.dsar.requested`, so the request itself
  appears in the export's audit section), inserts the request row with the payload,
  returns `{ requestId, expiresAt, sectionMeta }`.
- `getDataExport(db, { userId, requestId })` — the subject's own download only
  (`WHERE id AND user_id`); expired → 410.
- Sections (cap 10,000 rows each, `truncated: true` marker beyond):
  1. `profile` — the users row minus credential material (`password`,
     `password_history`, TOTP secrets/backup codes, `security_questions`). Everything
     else (consents, referral, settings, ip/user-agent history) is the subject's data.
  2. `sessions` — their session inventory: device/browser/location/lifecycle fields;
     never token hashes, salts, JTIs, or fingerprints.
  3. `memberships` — org + role names, status, invited/accepted instants.
  4. `apiKeys` — masked: name/type/environment/level/scopes/status/lifecycle +
     `key_prefix`; never `secret_hash`/`encrypted_secret`.
  5. `auditLog` — rows where `actor_id = userId` (their own actions), newest first
     (10k cap), action/category/module/resource/created_at only — no checksums.
  6. `meta` — generatedAt, expiresAt, sectionRowCap, per-section counts + truncation,
     `formatVersion: 1`.
- Module-owned data (mentions, campaigns, …) joins the export when those modules are
  active — recorded as a forward note in `meta.notes`.

**Routes**
- `POST /api/users/me/data-export` — auth; **rate-limited 5/day per user**; 201 with
  `{ request: { id, expiresAt, sections } }`.
- `GET /api/users/me/data-export/:requestId` — auth; 200 payload, 404 unknown, 410 expired.
- Admin on behalf: `POST /api/users/:userId/data-export` on the existing admin router
  (which the tree mounts at `/users` — the plan task's `/users/admin/…` path predates
  NWB-P0-026's canonical tree) with `requireAbility("read", "users")`. Org scoping comes
  from `getUserById` (404 cross-tenant — no request row created). The response returns
  request id + expiry only — **not** the payload: delivery stays in the subject's own
  authenticated channel. Audited with `targetUserId`.

**Errors** — new `GoneError` (410) in `src/lib/errors.ts`; error-handler status union
gains 410.

## Deviations from the plan task (recorded, not silent)

- Payload is plain JSON in the envelope, not a literal zip — phase-appropriate for a
  synchronous slice; `meta.formatVersion` lets the Phase 2 job evolve the wire format.
- No admin GET of the payload (subject-channel delivery); no email delivery (NWB-P0-021
  territory).
- Request expiry is a 7-day download window (the plan's "download until expiry" left the
  duration open; NDPR's 24h governs *delivery*, which a synchronous build always meets).

## Tests (`src/tests/users/dsar-export.test.ts`)

request → sections complete + secrets absent (profile has no password/TOTP material,
apiKeys no `secret_hash`); `compliance.dsar.requested` appears in the export; GET
round-trips the payload; expired → 410; unknown id → 404; another user's id → 404;
admin-on-behalf same-org 201 + target user downloads via `/me`; cross-tenant admin →
404 and **no request row**; truncation marker with a lowered section cap; POST
rate-limit 429 after 5/day.

## Deviations discovered during implementation (recorded)

- **Audit module for the request event is `core`, not `compliance`** (category stays
  `compliance`, action keeps the `compliance.dsar.*` namespace). `unified_audit_log`
  check constraints (`chk_ual_{admin,compliance,system}_requires_checksum`) demand a
  hash-chain `checksum` for those modules and `writeAuditLog` does not compute the
  chain — no active writer uses those modules for exactly this reason. The row
  graduates to module `compliance` when the tamper-evidence work that owns the
  checksum lands.
- **The auditLog section predicate is `actor_id = subject OR target_user_id = subject`,**
  not actor-only: an admin-filed request has actor=admin/target=subject, and under
  actor-only filtering the subject could never see who asked for their data — the
  exact transparency inversion the right exists to prevent.
- Seeded role codes: use `viewer` (there is no `member` role). `public_key` IS
  exported in the apiKeys section — it identifies rather than authorizes and is
  disclosed in key listings already; the boundary is the secret token segment
  (asserted absent via `parseApiKey` in tests).

## Verification (2026-09-20, PG 14.23 embedded — CI floor rebuilt after sandbox re-provision)

- `bun test src/tests/users/dsar-export.test.ts` → **11 pass / 0 fail** (3 no-DB 401s +
  8 DB tests: round-trip sections+secrets+self-citation, unknown/foreign 404s,
  expired 410 service+route, 429 on 6th POST, truncation with cap, cross-tenant
  admin 404 + no row, admin receipt-only + subject-channel fetch + citation,
  service-level foreign 404).
- Full suite `bun test` → **353 pass / 0 fail** (39 files; 342 baseline + 11 new).
- `bunx tsc --noEmit` clean, `bunx biome check .` 0 errors (2 import-sort fixes
  applied, baseline 466 warnings unchanged), `bun run build` clean.
- Schema verified in-place: `data_export_requests` columns + FKs
  (`user_id` cascade, `requested_by` set-null) via information_schema.

### Infra notes (sandbox re-provisioned mid-ticket)

- `~/nawebeus-db` did not persist; rebuilt: `npm init -y && npm i embedded-postgres@14.23.0-beta.17`
  plus `npm i -g bun` (1.4.2) and `bun install` (node_modules is snapshot-excluded).
  `start.mjs` recreated in place; cluster wipes per start → `db:push --force` + `seed`.
- `.env` JWT secrets must NOT equal the test-fixture defaults (`aaaa…`/`bbbb…`):
  fixtures `delete` values they recognise, breaking later files when identical.
  Current values: `test-access-secret-distinct-32-chars`, `test-refresh-secret-distinct-32-chars`.

## Acceptance

- [x] Export sections complete (profile minus credentials, sessions, memberships,
      apiKeys masked, auditLog incl. rows about the subject, meta formatVersion 1);
      secrets asserted absent (password/TOTP/security-questions/`secret_hash`/
      `encrypted_secret`/secret token segment).
- [x] Audit event present and self-citing (`resource_id` = the request that made it).
- [x] Cross-tenant admin → 404 and no request row.
- [x] Expired → 410 (service + route).
- [x] Unknown and foreign id → 404 (route + service).
- [x] Rate limit: 429 on the 6th POST in a day.
- [x] `bun test` green with DB; biome/typecheck/build gates clean; ticket at `done`.
