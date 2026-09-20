# NWB-P0-002 — DSAR data export (AC8 of FR-AUTH-007)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 263/263 `bun test` with a live database; CI re-run pending)
**Deps:** none (Phase 1 slice is synchronous; the queue swap is a Phase 2 follow-up). **Size:** M.

## Requirement

AC8 of FR-AUTH-007 (`docs/modules/Authentication & User Management.md` §3.7): *"NDPR DSAR
request triggers equivalent data package export."* The execution plan classifies the absence
of any `dsar`/export code as NDPR non-compliance; the PRD sets a 24-hour delivery window.

Plan ticket (`docs/plan/master-roadmap/06-phase-1-foundation.md`): any authenticated user
(and admin on behalf) can request a machine-readable export of their personal data.
Phase 1 implements a **synchronous** export behind the route — bounded, user's own data
only, capped per-section — and swaps to the Phase 2 job queue when it exists. No bespoke
worker is built here.

## Plan

| Layer | File |
| --- | --- |
| Table | `db/core/dsar-requests.ts` (new, wired) — reuses the already-live `dsar_type` / `dsar_status` enums from `db/shared/enums.ts` |
| Service | `src/services/users/dsar.service.ts` (new) — section builder + request/bookkeeping + cross-tenant guard |
| Errors | `src/lib/errors.ts` — `ExportExpiredError` (410) |
| Routes | `src/app/users/me.route.ts` — `POST /users/me/data-export`, `GET /users/me/data-export/:requestId`; `src/app/users/admin.route.ts` — `POST /users/:userId/data-export` (admin on behalf) |
| Tests | `src/tests/users/dsar.test.ts` (new) |

### Export sections (Phase 1, against the wired schema)

`profile` (secret-free), `sessions` (token-hash-free), `memberships` (orgs + role codes),
`api_keys` (metadata; digests excluded), `oauth_accounts` (no tokens), `audit_events`
(actor = subject or target = subject; bulk state columns excluded), `previous_exports`
(metadata only). Every section is capped (default 10 000 rows) with an explicit
`truncated` marker.

### Design decisions

1. **JSON, not ZIP, for Phase 1.** The plan says "JSON zip". Every section is JSON; there
   is no binary media yet, so a zip would wrap exactly one JSON document in an opaque
   container and cost the repo its first archive dependency (Bun 1.4 has no zip builder —
   checked: `Bun.Gzip`/`Bun.zlib` are single-stream codecs, not archives; `Bun.s3`/`Bun.file`
   don't archive). NDPR/GDPR portability requires a "structured, commonly used,
   machine-readable format" — bare JSON satisfies it. Revisit zip when binary artifacts
   (media assets) join the export.
2. **Payload stored in the request row (`jsonb`).** The plan's `GET …/:requestId`
   re-download-until-expiry needs the artifact to persist. Phase 1 stores it inline (the
   cap keeps it bounded); Phase 2's queue worker replaces this with object storage +
   `dataPackageUrl`, matching the aspirational `db/compliance` design.
3. **Ids are `uuid`, no FK on `user_id`.** The aspirational `db/compliance` table
   deliberately keeps DSAR rows without a user FK so compliance records survive deletion —
   the shape is kept, but with `uuid` (that module's `varchar(32)` ids are the narrow-id
   defect flagged in NWB-P0-009's notes).
4. **`users.create` gates the admin route.** Export-on-behalf generates data about someone
   else; the DEC-039 matrix gives `users.create` to Owner/Admin only (manager holds only
   read/update on `users.*`). Cross-tenant safety lives in the **service**: when the
   requester is not the subject, both requester and subject must hold an active membership
   in the same organization, else `ForbiddenError` (the CASL condition is inert — F-06 —
   so the membership predicate is the real guard).
5. **Re-download window: 7 days** from completion (`expires_at`), mirroring the aspirational
   `dataPackageExpiresAt` default. Delivery itself is immediate (synchronous), satisfying
   the PRD's 24-hour window.
6. **Audit:** `compliance.dsar.requested` on creation, `compliance.dsar.downloaded` on
   re-download (module `compliance`, `target_user_id` = subject).

## Definition of done

- Self-service export returns a complete, secret-free package; re-download by `requestId`
  works until expiry, then `410`.
- Admin can export a member of their own org; an admin of another org gets `403`.
- Both audit events present in `unified_audit_log`.
- Section cap enforced with a truncation marker.
- typecheck + lint clean; full suite green with a live database.

---

## Answer (2026-09-20)

Implemented as planned, with the deviations below. Verified: typecheck + lint + build clean;
`bun test` **263 pass / 0 fail** (was 249) against a pushed + seeded PostgreSQL 14.23 —
+11 DSAR tests, +3 atomic-writes regression tests.

### What shipped

| Layer | File |
| --- | --- |
| Table | `db/core/dsar-requests.ts` — wired through `db/core/index.ts` + `db/schema.ts`; reuses the live `dsar_type`/`dsar_status` enums; uuid ids, no user FK (compliance rows survive deletion); plain btree indexes only (add zero push churn — verified against the NWB-P0-009 convergence baseline) |
| Service | `src/services/users/dsar.service.ts` — `buildExportPackage` (7 secret-free sections, per-section cap + `truncated` marker), `requestDataExport` (sync completion + audit), `getExportRequest` (capability check: subject or requester; 404 not 403 for foreign ids; 410 after expiry) |
| Errors | `src/lib/errors.ts` — `ExportExpiredError` (410, `EXPORT_EXPIRED`) |
| Routes | `POST /api/users/me/data-export` (201), `GET /api/users/me/data-export/:requestId`, `POST /api/users/admin/:userId/data-export` (`users.create` = Owner/Admin only) |
| Tests | `src/tests/users/dsar.test.ts` — 11 tests: package completeness, secret-marker leakage scan (session token hash, API-key hash, password/mfa columns), membership + audit-section content, audited request + download, foreign-id 404 indistinguishable from missing, 410 expiry, admin own-org 201 / cross-tenant 403 / viewer 403, on-behalf-without-org refused, truncation marker |
| **Bonus** | `src/lib/transaction.ts` probe fix + `src/lib/db.ts` harness marker + `src/tests/atomic-writes.test.ts` — see Finding 1 |

### Finding 1 (critical, test infrastructure) — `withAtomicWrites` committed the harness transaction

`buildFixture`-style DB tests were silently leaking data across runs: every `signup()` inside
`withTestDb` ended the harness's rollback transaction. Root cause: the
`txid_current_if_assigned() IS NOT NULL` probe from NWB-P0-010 misreads **every
read-only-so-far transaction** — PostgreSQL assigns xids lazily (on first write), so a fresh
harness transaction reports "not in a transaction", `withAtomicWrites` takes the production
`db.transaction()` branch, and drizzle's COMMIT ends the harness BEGIN. Everything written
afterwards autocommits. The suite stayed green only because fixtures use random emails and no
test asserted cross-run isolation. (A second probe candidate, `current_setting('in_transaction')`,
fails with 42704 on the PG14 floor — the setting is newer than 14.)

Fix: `createTestDb` marks the session with a custom GUC
(`set_config('nawebeus.test_harness', 'on', false)`) right after BEGIN; the probe reads that
marker. Version-proof, survives rollback, dies with the session. Regression tests pin:
(a) a signup inside the harness is invisible to an external connection (before and after the
harness rollback); (b) a failure inside the atomic block rolls back only that block and leaves
the outer transaction usable; (c) an atomic block leaves the harness transaction alive.

**Consequence for earlier runs:** databases used for testing before this fix carry committed
fixture users/sessions/audit rows (each run's emails are unique, so nothing collides). Any
dev/test database should be dropped and re-created; CI was always fresh and unaffected.

### Finding 2 — `module: 'compliance'` audit rows are unwritable today

`chk_ual_compliance_requires_checksum` (same for `admin`/`system`) demands a checksum, but
`writeAuditLog` never computes one — so no caller can write those modules (all existing
callers use `core`). The DSAR audit events therefore use `module: "core"` with the
`compliance.dsar.*` action namespace. Building the checksum chain (SHA-256 over
id+action+actorId+resourceId+createdAt+previousChecksum, per-module chaining) is its own
follow-up; filed here so it is not lost.

### Deviations from the plan (reasoned, recorded)

1. **JSON, not ZIP** — see the Design decisions above; no archive dependency until binary
   artifacts enter the export (Bun 1.4 has no zip builder; checked `Bun.Gzip`/`Bun.zlib`).
2. **Admin GET not added** — the plan's `GET /users/me/data-export/:requestId` already
   serves the original requester (`requested_by` capability), so the admin re-downloads via
   the same route; a separate admin GET would be a duplicate surface.
3. **Profile excludes `bio`/`job_title`** — the PATCH /me schema accepts them but the users
   table has no such columns (pre-existing inconsistency, not touched here).
