# D6 — Object Storage Decision Memo

**Decision required:** Which object store holds media asset bytes, and what serves them publicly?
**Raised:** 2026-09-13, recorded in `18-risks-and-decisions.md` §D6; memo written 2026-09-24 while
executing NWB-P1-005 (media/storage service)
**Blocks:** The *production* R2 smoke of NWB-P1-005's exit gate ("media upload → signed URL works
against the local adapter (R2 smoke when credentials available)") — nothing else. The engineering
(storage interface, local adapter, signed URLs, soft delete) is D6-independent and **is done**.
**Owner of the call:** Operations Lead + Backend Lead (a credentials/infrastructure decision).
**Status:** 🟡 Prepared — recommendation below; only the R2 account + bucket remain to action.

---

## 1. Why this exists

The docs already agree on the shape; what was missing was (a) the interface in code that makes the
choice swappable, and (b) someone actually creating the Cloudflare resources. The audit row:

> `Tech Stack.md` + `Infrastructure.md` agree: R2 (S3-compatible) origin + Bunny CDN for public
> media; Bun ships `Bun.s3` (no SDK dependency). Local-disk adapter for dev.

## 2. What the code now guarantees (NWB-P1-005, shipped)

The decision is now **reversible by construction** — every consumer touches `StorageTransport`
(`put / get / delete / signedUrl`), never a vendor SDK:

| Layer | File | Contract |
| --- | --- | --- |
| Interface | `src/services/storage/types.ts` | `StorageTransport`, `S3ClientLike` (structural — fakes in tests), `storage_url` = `<driver>://<key>` internal URI |
| Local (dev + tests + CI) | `src/services/storage/local.ts` | Files under a root; resolved-path traversal guard; signs **app URLs** (`/api/media/signed/:assetId`, HMAC-SHA256, no cookies) |
| R2 (prod) | `src/services/storage/r2.ts` | `Bun.s3` via `BunS3ClientAdapter` — **zero new dependencies**; presigned GET URLs; `NoSuchKey` → `undefined` |
| Driver derivation | `src/lib/config.ts` | Mirrors email: explicit `STORAGE_DRIVER` wins; full R2 quartet → `r2`; nothing → `local`; production refuses local-by-omission; partial quartet refused everywhere |

Because the transport is structural (`S3ClientLike`), the R2 path is exercised in CI against a
recording fake — swapping the real credentials in later changes **zero code**, only env.

## 3. Recommendation (Option A — as the docs already say)

1. **Origin: Cloudflare R2** via `Bun.s3` behind `StorageTransport`. S3-compatible API, no egress
   fees, one provider for CDN + origin, NDPR-friendly (bucket region selectable).
2. **Delivery: Bunny CDN later** (P2+ media hardening) — `cdn_url` column already exists and stays
   NULL until then; signed *origin* URLs are the only public path for now.
3. **Dev/CI: local-disk adapter** (shipped) — no credentials in dev, `Bun.s3` faked in tests.

**Action items to close D6** (owner: Ops, ~30 minutes once billing is settled):
- [ ] Create the Cloudflare account + R2 bucket (name it `nawebeus-media-<env>`).
- [ ] Create an S3-compatible API token; put the quartet into the prod secret store
      (`R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET` — see `.env.example`).
- [ ] Run the production smoke: upload via `POST /api/media`, fetch the returned `signedUrl`
      **without cookies**, expect 200 + exact bytes; tick the exit-gate clause in `spec.md`.

## 4. Options considered

| Option | Verdict |
| --- | --- |
| **A. R2 + Bunny (docs' choice)** | **Recommended.** Zero deps (`Bun.s3`), no egress fees, already written down twice. |
| B. S3/Backblaze B2 | Works behind the same interface; no advantage over R2 for this stack; new vendor. |
| C. Local disk in prod | Rejected: ephemeral filesystems break asset persistence; the config layer already refuses it by omission. |
| D. DB bytea | Rejected at any scale: row bloat, no range requests, backup cost; the transport interface makes it pointless to argue. |

## 5. Supersessions

None. This memo confirms the existing docs; it does not amend any ADR or decision record.
