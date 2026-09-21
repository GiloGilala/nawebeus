# NWB-P1-002 — Audit service formalization + query API (closes F-19)

Type: task
Status: done (2026-09-21) — all four scope questions answered, and delivered; see Comments
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

---

## Comments

**2026-09-21 — delivered.** `src/services/audit.ts` is now a package, `src/services/audit/`
(`types.ts` / `actions.ts` / `write.ts` / `query.service.ts`, with `index.ts` as the only import path),
and the log is readable: `GET /api/audit` + `GET /api/audit/:id` in `src/server/api/audit/`. The five
route-level writes are gone — api-keys ×3 moved into `services/auth/api-key.ts`, sessions ×2 into
`services/auth/session.ts` — and `revokeSession` now takes its actor as a required `AuditActor | null`,
which is what made "audited or not" a decision at every call site instead of an assumption. The
read mount also collapsed `createApp`/`createAppWithDb`'s duplicated router lists into one
`mountApiRouters()` in `src/server/index.ts`, because a route that is mounted in one builder and not the
other is how an endpoint ships untested.

**Two items in the Ask were restated against what the code actually does, not satisfied as written.**
(1) *"Extend `AuditModule` taxonomy to cover PRD modules 3–10 + non-PRD domains"* (§12) reads like a
migration. Measured: `auditSourceModuleEnum` already had all 15 values; the **TS** union had 5. So the
fix derives every union from the schema (`(typeof auditSourceModuleEnum.enumValues)[number]`) and no
migration was written — a hand-added entry would have created drift against the very column it was meant
to match. (Measured, for the record: `AuditModule` was `"core" | "admin" | "system" | "compliance" |
"security"` — 5 against 15 — while `AuditCategory` and `AuditSeverity` were hand-copied unions that
happened to match, which is the fragile kind of correct: it survives until the day the enum grows.) The
same reasoning removed the old `category = "user_management"` parameter default: filing an event under a
category *because the caller omitted one* is how a single action ends up under two categories depending on
who wrote it, which is what the stale test in `src/tests/audit.test.ts` used to assert. `category` now
comes from `resolveAuditDefaults()`, i.e. from the registry. (2) The plan's
acceptance line *"queryable by actor/subject/org"* is satisfied exactly (three indexed equality
predicates) and deliberately not widened into a search engine — `action` matches as a string, not as a
registry member, because finding a retired spelling is a legitimate compliance query.

**Q1(a) executed as written:** no chain code here, both `module: "core"` workarounds stay
(`dsar.service.ts`, `src/lib/worker.ts`) with comments naming NWB-P1-014 as the ticket that flips them,
and `hashChainValid` is exposed in the read shape as the constant `true` it is today so the response
contract does not change when the chain lands. **Q2(a):** `AUDIT_ACTIONS` holds 34 entries, five legacy
names grandfathered verbatim, and the registry — not the caller — owns `category`/`resourceType`/
`severity`; `mfa.ts`, `org-deletion.service.ts` and `dsar.service.ts` lost their static `severity` for
that reason. **Q3(a):** scope comes from the token; `super_admin` may name one other organization, and
everyone else gets 403 rather than a silently ignored parameter. **Q4(a):** untouched here, filed as
F-29 / NWB-P1-015.

**A cross-cutting defect was found while wiring the route, and fixed in `src/lib/pagination.ts`.**
`decodeCursor` hard-required a **uuid** tiebreaker id — right for the four uuid-keyed lists it came from,
wrong for `unified_audit_log`, whose `id` is `varchar(64)` prefixed `al_`. Every audit list would have
returned page 1 correctly and 422'd forever after: the failure mode a one-page test cannot see. Fixed with
an optional `{ idPattern }` shape on `decodeCursor`/`parsePagination`, which the audit route fills with
the same pattern its `:id` validator uses — not by weakening the default (garbage must never reach the
driver) and not by dropping the tiebreaker (tied `created_at` values are what bulk writes produce). Two
more cursor rules are pinned by tests because they are silent row-skipping bugs rather than errors: the
cursor carries `to_char(created_at, 'USOF')` text, never `toISOString()`, and paging is asserted *across*
requests, since `withTestDb`'s transaction gives every row the same `now()` — a hazard reproduced, not
simulated.

**Found, not fixed (candidate F-30).** Four paginated list services — `users/admin.service.ts`,
`orgs/member.service.ts`, `services/auth/api-key.ts`, `services/auth/session.ts` — attach `_cursorV` to
their mapped rows and return it to callers: an internal cursor value in API output. Audit sidesteps the
pattern by reusing `created_at`. Folding four response-shape changes into an audit PR would hide both, so
it is reported instead of quietly included.

**One harness defect this ticket walked into and fixed in its own two files.** The no-DB suites stub
`JWT_*_SECRET` with `process.env[k] ??= v` and restore with `if (process.env[k] === v) delete …`, which
silently deletes a value that came from `.env` whenever it coincides with the placeholder — after which
every later file in the same `bun test` process fails inside `loadConfig()`. This sandbox hit it (six
suites, 44 tests, symptom: "database problem" with a valid `DATABASE_URL`), and the trail led to
`src/tests/audit/api.test.ts`'s own `afterAll`, so that file and the pattern's origin,
`src/tests/users/admin.test.ts`, now save what they changed and restore that. The other twelve files keep
the old idiom, deliberately: same one-line change, thirteen unrelated suites, and `F-31` is the honest
home for a sweep of a pattern this widespread.

**Verification log.**
- `bun test src/tests/audit/` → **29 pass / 0 fail**: `registry` 11 (no DB — every `writeAuditLog` call and
  every job `audit:` block in the tree names a registered action; module list pinned verbatim; format rule,
  exact legacy set, and job-definition agreement pinned), `query` 10 (DB-gated), `api` 8.
- `bun test` → **531 pass / 0 fail** (502 before). With `.env` moved aside, so no `DATABASE_URL` exists:
  **287 pass / 258 skip / 0 fail in 0.37s**, no connection attempted — the requirement this ticket inherited.
- `bun run typecheck` clean; `bunx biome check --diagnostic-level=error` clean on every touched tree;
  `bun run build` clean and `dist/index.js` contains the mounted router; `coverage:check` green
  (`src/services` 90.7%, `src/lib` 96.6%).
- `db/shared/audit.ts`'s comment claiming `action` is `<resource>.<verb>` "enforced at application layer"
  was corrected: nothing enforced it, the real shape is `[<domain>.]<resource>.<verb>`, and the registry is
  now what enforces it — typed at the write path, statically scanned in `registry.test.ts`, with the column
  left a `varchar(100)` on purpose.

**Left open by design:** NWB-P1-014 (chain + verification, unblocks the three checksum-only modules),
NWB-P1-010 (retention, legal holds), NWB-P1-015 (anonymization / F-29), and the admin console's planned
`GET /api/v1/admin/audit-log` view, which is a consumer of this API rather than a second one.
