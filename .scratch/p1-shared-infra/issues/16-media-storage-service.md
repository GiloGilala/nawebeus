# NWB-P1-005 — Media/storage service (transport interface, local adapter, signed URLs, soft delete)

Type: task
Status: done 2026-09-24
Phase: P1 (roadmap Phase 2 · §12)
Size: L
Blocked by: D6 (object storage) — **partially**: this ticket builds the D6-*independent* core. The
exit gate's own wording is "media upload → signed URL works against the **local adapter** (R2 smoke
when credentials available)", so the provider choice gates only the *production smoke*, not the
engineering. `D6-storage-decision-memo.md` (this directory) prepares the decision.

## Why this exists

Roadmap §12 NWB-P1-005: *"Interface mirrors `EmailTransport`; R2 adapter prod / local-disk dev per
docs; signed URLs; soft delete. Avatars (PRD `/me/avatar`) and report exports (P12) consume this."*
Measured state before this ticket (2026-09-24):

- `media_assets` is the one media table (already live in the baseline migration, re-exported in
  `db/schema.ts`) — but **nothing writes it** (`grep -rn "media" src/services/` → nothing), and its
  id columns are `varchar(32)`: a Nawebeus uuid (36 chars) does not fit — the exact defect the
  2026-09-13 audit-log note and migrations 0005/0006 fixed elsewhere. Widened here first.
- The docs name the shape twice: `docs/technical/Tech Stack.md` / `Infrastructure.md` (R2 origin +
  Bunny CDN delivery) and the schema's own header comment (`storageUrl` = origin, never exposed;
  `cdnUrl` = delivery). The audit's D6 line already recommends "R2 behind the Phase 2 storage
  interface … local-disk adapter for dev".
- The P1 exit gate has been carrying an open clause for this since NWB-P1-001: *"media upload →
  signed URL works against the local adapter."*

## Scope (in)

1. **`media_assets` id columns widened** `varchar(32)` → `varchar(64)` (id, organization_id,
   attached_to_id, uploaded_by) — migration `0010`, the 0005/0006 precedent. Asset ids become
   `med_<uuid>`.
2. **`StorageTransport` interface** (`src/services/storage/types.ts`) mirroring `EmailTransport`:
   `put` / `get` / `delete` / `signedUrl` over opaque object keys. `storageUrl` stores
   `<driver>://<key>` URIs (`local://…`, `r2://…`) — internal identifiers, never exposed to
   clients (the schema comment's rule).
3. **Local-disk adapter** (dev/tests + single-box prod): writes under a configurable root
   (`STORAGE_LOCAL_ROOT`, default `.data/media` — gitignored), signed URLs are **app URLs**
   (`GET /api/media/signed/:assetId?exp=…&sig=…`) HMAC'd with `STORAGE_SIGNING_SECRET`
   (fallback: `JWT_ACCESS_SECRET`), verified by the route with a timing-safe compare. No cookies
   needed — that is what makes the URL usable in an `<img src>`.
4. **R2 adapter** over `Bun.s3`'s `S3Client` — **zero new dependencies** (the D6 memo's headline
   argument). Real S3 presigned URLs (`client.presign`), so downloads bypass the app entirely in
   production. The client is injected through a minimal `S3ClientLike` structural interface, so
   tests run against a recording fake the way the Resend transport ran against a fake `fetch`.
   Driver selection mirrors the email derivation exactly: `STORAGE_DRIVER=local|r2` explicit;
   otherwise R2 when the three credentials are present, else local; **production refuses
   local-by-omission** (set credentials, or say `STORAGE_DRIVER=local` on purpose).
5. **Service** (`storageService`, the only import path): `uploadMedia` (size cap
   `MEDIA_MAX_UPLOAD_MB` default 25, mime → `media_asset_type` derivation, key
   `{orgId}/{assetId}/{sanitized-name}`, row + `media.uploaded` audit, returns the asset and a
   signed URL), `signedDownloadUrl` (org-scoped, soft-deleted → gone), `readContent` (transport
   read-through for the signed route), `softDeleteMedia` (library assets only — the DB CHECK
   enforces what the service asserts; optimistic version bump; `media.deleted` audit),
   `listLibraryAssets` (keyset-paginated, folder filter).
6. **Routes** (`/api/media`, registered with the literal `signed` path **before** `:assetId` —
   the F-11 registration-order lesson, pinned by test): `POST /media` (multipart),
   `GET /media` (library list), `GET /media/:assetId` (metadata), `GET /media/:assetId/content`
   (authed bytes), `GET /media/signed/:assetId` (signature-verified bytes, no auth),
   `DELETE /media/:assetId`. RBAC on a new `media` subject: `media.read` everyone,
   `media.create` content-creators, `media.delete` the approval tier — the templates/contacts
   pattern.
7. **Audit**: `media.uploaded`, `media.deleted` (registry, module `core`, resource
   `media_asset`).

## Scope (out)

- **R2 live smoke** — needs credentials (D6's call + an account); the adapter is tested against a
  fake client and the real one is a config act. Recorded as the gate's residual, like the Resend
  sandbox send.
- **Virus scanning, thumbnails, image processing, CDN upload** — the `processing_state` pipeline
  is a monitoring-era concern (Phase 4/5 ingestion), not the storage service. Rows upload with
  `processing_state = NULL`, which the schema already defines as "treated as complete".
- **Bunny CDN** (`cdnUrl` stays NULL) — D6 covers origin storage; delivery CDN is a later config.
- **Consumers**: avatar upload (`/users/me/avatar`) and P12 report exports consume the service in
  their own tickets.
- **Multipart >memory uploads / multipart for very large video** — the 25 MB cap keeps uploads
  single-shot; resumable upload is a media-pipeline ticket.

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Transport interface + two adapters, email precedent verbatim | The codebase already proved the shape (NWB-P1-004): interface, dev adapter, provider adapter, config derivation, production refusal. A second one-off would fork the pattern. |
| 2 | R2 via `Bun.s3` | The D12-era audit noted Bun ships an S3 client. R2 *is* S3-compatible, so the production adapter costs zero dependencies and the D6 decision reduces to "flip `STORAGE_DRIVER` + credentials". |
| 3 | `<driver>://<key>` in `storage_url` | The column must never hold a client-facing URL (schema header rule); an opaque URI survives a driver switch (the key is the durable part) and cannot leak an origin. |
| 4 | Local signed URLs are app URLs with HMAC, not `file://` | A `file://` URL is unusable from a browser and a local path is an absolute-path disclosure. The HMAC URL keeps the no-cookie property (the only reason signed URLs exist) while the bytes still pass through the app — fine for dev/single-box, and R2 replaces it with a true presigned URL when configured. |
| 5 | Library-asset soft delete only (DB CHECK) | Attached assets die with their parent entity by design; making the service enforce it too means the constraint is documentation, not the only guard. |
| 6 | Ids `med_<uuid>` behind a 64-wide column | The audit table's 2026-09-13 note, applied before a 36-char uuid hits a 32-char column in production rather than after. |

## Exit criteria / acceptance — all met 2026-09-24

- [x] `POST /api/media` (multipart) stores bytes through the local adapter, writes the
      `media_assets` row, audits `media.uploaded`, and the response carries a signed URL.
      *(service.test "uploads an asset…": row shape incl. `storage_url` scheme, `processing_state`
      NULL, audit afterState `{name, assetType, sizeBytes, mimeType, storageDriver, folderPath?}`
      — never bytes; media.route.test "upload → 201…".)*
- [x] `GET`-ing the signed URL **without credentials** returns the exact bytes; a tampered `sig`
      or expired `exp` is 403; the authed `/content` route works for the owning org and 404s
      cross-org. *(media.route.test "signed URL serves exact bytes with NO cookie…" + "metadata +
      content are authed and org-scoped…"; `Cache-Control: private`.)*
- [x] Local adapter: put/get/delete round-trip against a temp dir; missing key → `undefined`;
      delete is idempotent; keys cannot escape the root (absolute path and `..` rejected on the
      **resolved** path — adapters.test, incl. the `org/../..` = root non-case).
- [x] R2 adapter against a recording fake: presign called with key + expiry; put/get/delete
      forwarded; `NoSuchKey` → `undefined`. Driver derivation (config.test storage describe):
      quartet → `r2` + `R2_ENDPOINT_RESOLVED`, explicit `STORAGE_DRIVER` wins, production +
      nothing → config error, partial quartet refused in every env.
- [x] Soft delete: library asset → `is_deleted` + `deleted_at`, version 1→2, `media.deleted`
      audited with beforeState `{version, name}`; idempotent second call; signed URL → GoneError,
      route → 404 (anti-enumeration); attached asset → ValidationError (mirrors
      `chk_ma_soft_delete_library_only`); wrong `version` → 409; cross-org → 404.
- [x] Oversized upload → 413 (`PayloadTooLargeError`) before any row exists; unmappable mime →
      `other`; sanitize strips traversal/control chars; `media.uploaded` carries size + mime,
      never the bytes.
- [x] `GET /api/media/signed/:id` is not shadowed by `GET /:id` — registered first (file-header
      rule), pinned by the no-DB route test (malformed med id on the signed path → 422 param
      error, not swallowed by `/:assetId`).
- [x] Gates: typecheck ✅ · lint **0 errors** (718 warnings, pre-existing baseline class) ·
      `bun test` **871 pass / 0 fail** with a live PostgreSQL (837 before, +34) ·
      `coverage:check` ✅ (services 93.5%, lib 96.6% — storage: route 94.6%, r2 100%, service
      87.9%, local 86.7%; `bun-s3.ts` 7% = the `Bun.s3` vendor shim, exercised for real only
      with credentials, same policy as the Resend fetch shim).

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`) — after NWB-P1-011
  left this as the only open P1 ticket; the D6 memo ships with it so the decision has something
  concrete to say yes to.
- 2026-09-24: **done.** Everything above landed in one pass; the gate clause *"media upload →
  signed URL works against the local adapter"* is closed by the route tests. Two residuals, both
  operator-side and recorded in `spec.md`: the R2 live smoke (D6 memo §3 action items) and the
  Resend sandbox send. One bug the tests caught mid-build, kept as a lesson: the library listing
  originally injected its keyset cursor clause **after** `ORDER BY` (syntax error), and the cursor
  value needed the api-key suite's `to_char(…'USOF')` microsecond treatment — millisecond
  `toISOString()` excluded same-transaction ties the id tiebreak exists for.
