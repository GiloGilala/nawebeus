# NWB-P0-001 — API key management (FR-AUTH-010)

**Status:** done — 2026-09-13
**Deps:** none. **Size:** L.

## What was built

| Layer | File |
| --- | --- |
| Types (mirrors the six PG enums) | `src/server/auth/types/api-key-types.ts` |
| Service | `src/services/auth/api-key.ts` |
| Routes | `src/app/api-keys/api-keys.route.ts`, `src/app/api-keys/index.ts` |
| Middleware | `src/server/middleware/auth.ts` (Bearer branch added ahead of the cookie path) |
| Tests | `src/tests/auth/api-key.test.ts` — 33 tests, all green |

No schema work: `db/core/api-keys.ts` already defined the table and `db/schema.ts` already
exported it. Permission strings `apikeys.create` / `.read` / `.update` / `.delete` were added
to `src/seed.ts`; `super_admin` inherits all permissions and `org_admin` all but `billing.*`,
so both receive them without further mapping.

## Endpoints

| Method | Path | Ability |
| --- | --- | --- |
| POST | `/api/api-keys` | `apikeys.create` — returns the key value exactly once (201) |
| GET | `/api/api-keys` | `apikeys.read` — masked; optional `?status=` filter |
| POST | `/api/api-keys/:id/rotate` | `apikeys.update` — replacement issued, old key dead |
| DELETE | `/api/api-keys/:id` | `apikeys.delete` — revoke (409 if already revoked) |

## Design decisions

- **Key format** `nwb_<env>_<publicKey>_<secret>`; env ∈ `live` / `test` / `dev`. Public key is
  128 bits (32 hex), secret 256 bits (64 hex).
- **Only the secret's SHA-256 is stored.** The `public_key` column exists solely so verification
  is a single indexed lookup rather than a scan-and-compare over every stored hash. Both miss
  paths still do the hash work, so timing doesn't leak key existence.
- **Rotation soft-deletes the old row** as well as revoking it — the `(organization_id, name)`
  unique index would otherwise block reusing the name. Deliberately not wrapped in a
  transaction; rationale documented in the service.
- **Ability narrowing.** `apiKeyAbility(base, permissionLevel, scopes)` rebuilds the owner's
  ability and can only ever remove rules: `read_only`/`read` → `read`; `write` →
  `read`/`create`/`update` (deliberately not `delete`); `admin` → no action narrowing.
  `scopes` is a subject allow-list; empty means all subjects.
- **Bearer wins over the cookie** when both are present, and a key's owner must still be an
  active member of the key's organization — otherwise removing someone from an org would leave
  their keys working.
- Audit events record the key's id and never its value.

## Verification

- `bun run typecheck` — clean.
- `bun test src/tests/auth/api-key.test.ts` — **33 pass / 0 fail**.
- Full suite with a live database — **159 pass / 0 fail** (`postgresql://localhost:5432/nawebeus_test`,
  re-verified 2026-09-13); 102 pass / 61 skip / 0 fail with no database configured. The 12
  pre-existing failures this ticket shipped alongside have since been fixed — see
  `../spec.md` for the four sign-in breakers they turned out to be hiding.

## Incidental fixes required to get here

Recorded in full in `../decisions.md` and the daily memory log. In brief: six schema defects
that made `db:push` impossible; `unified_audit_log` id columns too narrow (`varchar(32)`) for
real uuids, which had silently broken the whole audit trail; `authMiddleware` calling
`runWithOrgContext()` without awaiting it, which 500'd every protected route; the `admin`
permission level mapping to the literal action `"manage"` instead of acting as a wildcard; test
env poisoning across 12 files; and four defects in `src/seed.ts`, which had never run.
