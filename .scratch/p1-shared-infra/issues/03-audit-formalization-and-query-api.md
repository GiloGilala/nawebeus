# NWB-P1-002 — Audit service formalization + query API (closes F-19)

Type: task
Status: claimed — building (all four questions answered 2026-09-21)
Blocked by: NWB-P1-001 ✅ (queue base — the chain's verification job needs it)
Phase: P1 (roadmap Phase 2) · execution plan §5 P1 · PRD §8.10.2
Size: M (Scope settled at Q1(a) — the chain moved out to NWB-P1-014)

> **Note on the filename:** this is `03-…` although the ID is NWB-P1-002, because `issues/02-…`
> holds NWB-P1-013 (the purge-batch follow-up found while delivering P1-001). IDs and filenames
> diverged deliberately rather than renumbering a ticket that is already referenced from the
> defect register and roadmap.

## Ask (verbatim from the plan)

> **NWB-P1-002** | Audit service formalization (`src/services/audit.ts` → full typing) | — | M |
> **Every mutating service writes a typed audit event; queryable by actor/subject/org**

Roadmap §12 adds: *"Extend `AuditModule` taxonomy to cover PRD modules 3–10 + non-PRD domains;
add query service (by actor/subject/org/category/date-range, paginated — fixes F-19 first half);
retention + legal-hold hook in P1-010."*

## What is actually true today (measured, not assumed)

| Thing | State |
| --- | --- |
| `AuditModule` (TS) | **5 values**: `core \| admin \| system \| compliance \| security` |
| `audit_source_module` (DB enum) | **15 values**: those 5 + `engagement, publishing, listening, monitoring, influencer, pr, commerce, campaigns, social_accounts, analytics` |
| `AuditCategory` (TS) vs `audit_category` (DB) | 13 each — already aligned |
| `writeAuditLog` call sites | 33, in `src/services/**` |
| Audit writes living in **routes** | **5** — `src/server/api/api-keys/api-keys.route.ts` ×3 (`apikeys.created/rotated/revoked`), `src/server/api/auth/sessions.route.ts` ×2 (`auth.session.revoked`, `auth.sessions.revoked_others`) |
| Mutating services with no audit write | `auth/session.ts` (3 mutators), `auth/api-key.ts` (3), `auth/user-record.ts` (2), `users/user.service.ts` (1), `orgs/org.service.ts` (1) — the api-key/session ones are covered *at the route*, so only via HTTP |
| `action` naming | schema comment says *"`<resource>.<verb>` — enforced at application layer"*. **Nothing enforces it.** Real shapes: `organization.member.invited`, `auth.mfa.verified`, `security.password_changed`, `apikeys.rotated`, `rate-limits.reclaimed` |
| Read path | **none.** `writeAuditLog` is the only export. F-19. |
| `checksum` / `previousChecksum` / `hashChainValid` | columns, length checks, pairing check, three `…_requires_checksum` constraints, and `idx_ual_chain_scan` all exist. **No code computes a checksum anywhere** (`grep -rn "hashChain" src/` → only comments) |
| Consequences of the missing chain | two services must lie about `module` to insert at all: `src/services/users/dsar.service.ts:75` and `src/lib/worker.ts:286` both write `core` where `compliance`/`system` is correct. Those are the only comments explaining why, so the workaround is easy to mistake for the design |
| Pagination | `src/lib/pagination.ts` — `parsePagination(URL)`, `buildPage`, `DEFAULT_PAGE_SIZE=20`, keyset cursor `(created_at, id)`; already used by `admin.service`, `api-key`, `session`, `member.service` |
| Permission | `audit.read` exists in the seed catalog and is granted via `orgAdministration` (so admin + owner + super_admin); `requireAbility("read", "audit")` is the matching guard |
| RLS | `docs/modules/Authentication & User Management.md:1415` — *"Audit log is immutable — no RLS (global; admins can query their org's log)"* → org scoping is app-level, and that is decided, not open |
| PRD §8.10.2 | 100% write coverage · integrity verified via cryptographic checksums · retention Free 30d / Pro 1y / Enterprise 7y, purged per schedule · search by user/action/resource/date <5s at 1M rows · **CSV export ≤60s at 100k entries** |

## Scope (proposed; Question 1 decides it)

**In:**
1. `AuditModule` → the 15-value union, and a test that pins TS against the DB enum so they cannot
   drift again (the same drift class `src/tests/route-invariants.test.ts` was built for).
2. Typed action registry (`AUDIT_ACTIONS`) — `action` + `category` + `resourceType` + default
   `severity` per event, `writeAuditLog` accepting a registry key; the loose `action: string` is what
   lets a future module invent `user_delete` beside `users.deleted`.
3. Query service `src/services/audit/query.service.ts`: filter by org, actor, target user, resource
   type/id, category, module, severity, action, date range (+ `requestId` for tracing, which is why
   `idx_ual_request_id` exists), keyset-paginated newest-first via `src/lib/pagination.ts`.
4. HTTP read surface `GET /api/audit` (+ `GET /api/audit/:id`) mounted in `src/server/index.ts`,
   `authMiddleware` + `requireAbility("read","audit")`, `organizationId` **from the JWT, never the
   query string** (ground rule 6).
5. Move the 5 route-level audit writes into their services, so an `api-key` or `session` mutation
   audited from a CLI/worker job is not silently un-audited.

**Out (each with a home):**
- Retention worker + legal holds → NWB-P1-010 (its row already names P1-002 as the dependency).
- Anything the Web app needs to render this (filters UI, saved views) → Phase 7.
- Impersonation session plumbing → NWB-P1-011 (`AuditActorType` already carries the value;
  `chk_ual_impersonation_consistency` demands a session id the moment `actorType='impersonation'`).
- The `checksum` / `previousChecksum` / `hashChainValid` chain and its verification job →
  **NWB-P1-014**. Note the constraint that makes this visible: widening `AuditModule` to the DB enum's
  15 values does **not** license writing `admin`, `system` or `compliance` today — `chk_ual_*_requires_checksum`
  rejects those rows without a checksum, which is why the widened type carries a comment rather than a
  free-for-all.

## Questions — all four answered 2026-09-21

**Q1: How much does this ticket carry?** → **(a)** items 1–5 only. The hash chain, its verification
job, and the two `module: "core"` workarounds move to **NWB-P1-014**. Chosen because the chain is
architectural (per-module chaining needs a serialization point on every `admin|system|compliance`
insert, since `checksum` covers `createdAt`) and because a service refactor, a new read API and an
integrity design in one PR reviews badly. The workarounds therefore **stay** in this PR —
`dsar.service.ts:75` and `src/lib/worker.ts:286` keep writing `core`, and both comments now name
NWB-P1-014 as the ticket that flips them, so nobody reads them as permanent.

**Q2: How strict is the registry about the 31 existing actions?** → **(a)** new writes validated,
existing strings grandfathered at their current spelling inside the registry. A rename would break any
saved filter and any future retention rule keyed on `action`, and back-fitting history to a naming
rule is exactly what an append-only table must not do.

**Q3: Who can query which org's log?** → **(a)** org scope always comes from the JWT;
`super_admin` may pass `?organizationId=` to look at one named org (never "all orgs" — there is no
route that reads the whole table, so the escape hatch is bounded and greppable instead of a missing
filter). Cross-platform investigation stays a later concern, with P15's support tooling.

**Q4: BR-AUTH-043 anonymization?** → **(a)** recorded as **F-29** in the defect register and filed as
**NWB-P1-015**; untouched here. It is a policy decision (how do you anonymize an append-only row)
disguised as a query, and bundling it would have made the read API wait on it.

## Notes for the implementer

- `chk_ual_actor_consistency`: `actorId` non-NULL requires `actorType` — the trap NWB-P1-001 hit.
- `chk_ual_checksum_pairing`: `checksum` and `previousChecksum` are both-NULL or both-present; the
  genesis row of a module therefore has no legal representation *unless* the design says the chain
  starts by pointing at a fixed sentinel. Decide that in Q1's answer, before any migration is written.
- The removed mutation-state check (see the long comment in `db/shared/audit.ts`) was deleted because
  it referenced an operation taxonomy the enum doesn't have. If the registry in item 2 becomes the
  operation source, that constraint becomes re-expressible — worth a sentence in the answer, not a
  silent re-add.
- `bun test` must stay green with `DATABASE_URL` unset (the queue suite set the precedent: DB-gated
  files skip cleanly, nothing reaches for a connection).
