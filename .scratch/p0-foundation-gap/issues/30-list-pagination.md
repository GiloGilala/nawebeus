# NWB-P0-030 — Cursor pagination on every list endpoint (F-14)

**Status:** done — 2026-09-21 (verified locally: typecheck + `bun run lint` exit 0 +
build + `bun test` green with a live database)

- **Epic:** p0-foundation-gap
- **Fixes:** **F-14** (no pagination on list endpoints)
- **Registers:** **D-17** (pagination style: roadmap vs API Reference)
- **Size:** M
- **Depends on:** —

## Why this ticket, and why now

With F-11 closed by NWB-P0-029, F-14 is the next defect that is genuinely actionable:
F-15/F-16/F-18/F-19 all depend on later-phase work, and the two remaining epic tickets
(05, 22) are blocked on repo-owner credentials. F-14 is also the one with a live
consequence — every list endpoint returned its **entire** table. On `sessions` and
`organization_members` that grows without bound, so the failure mode is a response that
degrades quietly as a tenant gets bigger, which is exactly the kind of thing that is
cheap now and expensive after Phase 7's list screens are built against it.

## The spec conflicted with itself — D-17

Two documents disagreed on the mechanism:

- `13-api-service.md:22` — *"introduce `?page&limit` with `meta.pagination`"* (offset)
- `docs/technical/API Reference.md` §2.6 — *"All list endpoints use **cursor-based
  pagination** — never offset-based."*

Adjudicated in favour of the **API Reference**, and registered as **D-17**:

1. §2.6 is the published client contract; the roadmap line is an internal planning note.
2. §2.6 is the stricter of the two, so satisfying it satisfies neither party's objection.
3. Offset paging drifts under concurrent inserts — page 2 repeats or skips rows when a
   row lands above the offset. The lists most affected here (sessions, audit-ish
   member lists) are precisely the ones being written to while they are read.

The roadmap line has been corrected in place and now points at D-17.

## Two sub-decisions the code cites as D-17

- **Placement: `meta.pagination = {cursor, hasMore}`.** `src/lib/response.ts` has no
  top-level `pagination` or `success` field, and the roadmap explicitly pointed at "the
  envelope's existing `meta` slot". No envelope change was needed.
- **`totalCount` is omitted.** §2.6's parameter table never promises it, and returning it
  means a second `COUNT(*)` on every page of every list endpoint. Recorded rather than
  left silent, so a UI that later needs a total knows it is a deliberate omission and not
  an oversight. Revisit per-endpoint in Phase 7.

## Implementation

New `src/lib/pagination.ts`: `parsePagination(url)`, `buildPage(rows, limit, sortValue)`,
`encodeCursor`/`decodeCursor`, `paginationMeta(pageInfo)`, `DEFAULT_PAGE_SIZE = 20`,
`MAX_PAGE_SIZE = 100`.

Keyset, not offset. The cursor is base64url of `{v, id}` — the sort value plus the row id.
**The `id` is not decoration.** A keyset cursor is only stable on a *unique* sort key, and
every sort key on these four lists is a bare timestamp that ties in practice (bulk invite
accepts, seeded data, anything inside one transaction). With a plain `created_at > v`,
tied rows are dropped at the page boundary; with `>=` they repeat. So every query sorts
and seeks on `(sortValue, id)` as a tuple.

`last_activity_at` on sessions is additionally **nullable**, which a cursor cannot carry —
a NULL sort value stalls paging permanently. Sessions therefore sort on
`COALESCE(last_activity_at, created_at)` and the old `NULLS LAST` is gone.

Services fetch `limit + 1` rows; the extra row is what sets `hasMore`, then gets trimmed.
That avoids a count query and is correct on an exactly-full final page.

Bad input is a **422**, not a clamp: `limit=1000` or a corrupt cursor tells the client its
understanding of the contract is wrong. Silently returning 100, or silently restarting at
page one, hides a client bug and (for the cursor) can look like data loss.

Paginated: `listMembers`, `listUsers` (admin), `listUserSessions`, `listApiKeys`, each
with its route and its server-function callers. Server functions take `.items` for now —
no cursor UI until Phase 7.

## Security finding: pagination nearly broke "revoke all other sessions"

Both revoke-others paths (`sessions.route.ts` and `server-functions/auth.ts`) iterate the
session list and revoke what they find. Paginating `listUserSessions` underneath them
would have silently capped that **security action** at the first 20 sessions — a user
responding to a compromise would be told "sessions revoked" while sessions 21+ stayed
live. This is the failure mode of changing a shared list function: the type still checks
and the tests still pass.

Fixed by adding `listAllLiveSessionIds(db, userId)` — deliberately unpaginated, with a
comment at both call sites saying why — and a regression test that creates 25 sessions and
asserts `revokedCount > DEFAULT_PAGE_SIZE` and zero live sessions afterwards. Verified the
test fails (`Expected: > 20, Received: 20`) when the revoke path is pointed back at the
paginated list.

## Tests — `src/tests/pagination.test.ts` (20)

Properties, not row counts:

- a full walk visits every row **exactly once** — no gaps, no repeats;
- the paged sequence equals the unpaginated sequence;
- **tied timestamps** across a page boundary (six members forced to one `created_at`,
  paged 2 at a time) return all six — this is the test that fails without the `id`
  tiebreaker;
- a row inserted mid-walk does not shift pages already read (the keyset-over-offset claim,
  asserted rather than assumed);
- last page → `hasMore: false` **and** a `null` cursor; exactly-full page → same;
- **tenant isolation across pages** — two orgs with interleaved `created_at`, walked to
  exhaustion, no cross-org rows; and another org's list is still 403/404 with `limit=100`;
- `limit` ∈ {0, -1, 1000, abc, 1.5, ""} → 422; five forged/corrupt cursors → 422, with an
  assertion that no `22P02`/`invalid input syntax` leaks, i.e. the forged value never
  reached Postgres;
- all four endpoints answer in the same `meta.pagination` shape;
- helper-level: cursor round-trip, opacity (no `=`, `+`, `/`; URL-safe), 10 malformed
  cursors → `null` not a throw, `buildPage` trimming.

**Mutation-checked.** Replacing the tuple seek with a bare `created_at >` fails 3 tests;
re-pointing revoke-others at the paginated list fails the security test. Both mutations
were reverted and the reverts verified.

## Docs updated

- `03-discrepancies.md` — **D-17** added (closed), including the `totalCount` omission.
- `13-api-service.md:22` — offset line corrected, F-14 marked done, points at D-17.
- `API Reference.md` §2.6 — response shape, 422-not-clamp behaviour, `totalCount` note.
