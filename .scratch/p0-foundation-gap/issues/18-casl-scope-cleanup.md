# NWB-P0-018 — Make the CASL scoping decision explicit (F-06)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build +
360/360 `bun test` with a live database, 215 pass / 152 skip / 0 fail without
one; CI run on this branch's PR)
**Deps:** D11 (wording only — the §4.3 text is written to be true whether or not
RLS ever lands; see "D11" below). **Size:** S/M.
**Fixes:** F-06 (decorative `{ organizationId }` condition; docs claimed an
enforcement layer that could not enforce).
**Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-018.

## The finding, restated precisely

`loadAbility` attached `{ organizationId: orgId }` to **every** rule it built.
CASL evaluates rule conditions only when `can()` is given a *subject instance*.
Every authorization check in this codebase — `requireAbility(action, subject)`
in `src/server/middleware/rbac.ts`, and the Server-Function equivalents — passes
a **string** subject, and for a string subject CASL v7 skips condition matching
entirely and answers on the `(action, subject)` pair alone.

So the condition could never deny anything. It was not a weak guard; it was not
a guard. Its only effect was on readers: `Security Architecture.md` §4.3 listed
three enforcement layers, and this was the one nobody could have tested.

The condition being inert also means **removing it changes no behaviour** — the
one fact that made this a safe, self-contained ticket rather than a security
change.

## Decision

**Remove the condition** (the plan's recommended option) rather than convert
every call site to object-level checks.

Rejected alternative, recorded: pass `{ organizationId }` objects from routes
into `ability.can`. It is a far larger surface (every route and every Server
Function), and it would put object-level authorization at the edge, duplicating
the org predicate that already lives in the service layer where the row is
actually read. CASL would then be a second, weaker copy of a check the query
already makes.

## What the enforcement chain actually is

Documented in full in `Security Architecture.md` §4.3.1. In short, an
authenticated request is pinned to one organization by four mechanisms, none of
them a CASL condition:

1. **JWT-derived org** — `(userId, orgId)` comes from the verified access token
   (or the API key's own row). No request input can change it.
2. **Active-principal check** — `assertActivePrincipal` requires an active
   membership in that org and an active `users.status`.
3. **Per-(user, org) ability load** — `loadAbility` reads only that org's
   membership → role → permission rows. The scoping is the `WHERE` clause. A
   user in org A is never handed org B's rules to begin with.
4. **`requireOrgMatch()` + service org predicates** — a URL `:orgId` that
   differs from the JWT's org is a 403, and org-scoped services filter on
   `organization_id`.

## Changes

| Layer | File |
| --- | --- |
| Drop the inert condition; document why, at the site | `src/services/auth/ability.ts` |
| §4.3 rewritten: as-built column + new §4.3.1 enforcement chain | `docs/technical/Security Architecture.md` |
| CASL-trap pin + three `loadAbility` DB tests | `src/tests/auth/ability-scoping.test.ts` |
| Route-invariant static scan (new, 4 tests) | `src/tests/route-invariants.test.ts` |

`apiKeyAbility` (`src/services/auth/api-key.ts`) copies `rule.conditions`
through when narrowing a key's ability. That line is unchanged and now copies
`undefined` — correct either way, and left in place so the function stays
honest if conditions ever return.

## Tests

**`ability-scoping.test.ts`** — replaced the old "condition is stored" test,
which asserted the trap without naming it, with a pin that does:

- *CASL v7 trap, pinned* — a rule scoped to `org_A`, checked as a bare string,
  returns **true**; the same ability checked against an `org_B` *instance*
  returns **false**. This proves the condition is well-formed and that the gap
  is the call shape, not the rule — so a future CASL release that changes the
  string-subject behaviour turns this red and forces a deliberate re-decision.
- *(DB) rules carry no conditions* — every rule from `loadAbility` has
  `conditions === undefined`. Re-adding the decorative condition fails here.
- *(DB) a member of org A loads an empty ability for org B* — `rules` is `[]`
  and every check denies. This is the positive statement of what actually
  scopes an ability.
- *(DB) an inactive membership grants nothing* — a `suspended` membership in the
  user's own org yields zero rules.

**`route-invariants.test.ts`** (new) — a static scan over `src/server/api/**`:
every route registration whose path contains `:orgId` must be covered by
`requireOrgMatch`, either inline in its own middleware chain or by a
`router.use(...)` whose path pattern covers it (both forms occur — `role.route.ts`
uses the `use` form). Three guards keep the scan from passing vacuously: it
asserts it found the files, asserts it found at least one `:orgId` route, and
runs a negative control over a fabricated unguarded route to prove the detector
fires. Cost: ~4 ms, no database. This closes the IDOR class by construction — a
future `:orgId` route that forgets the guard fails CI instead of shipping.

## D11

The ticket lists D11 (row-level security) as a dependency for the §4.3 wording.
D11 is still open, so §4.3 was written to be true *now*: the layer table gained
an **as-built** column that marks RLS `❌ not implemented — pending decision
D11`, and §4.3.1 describes only what runs. If D11 lands "yes", RLS is added to
§4.3.1 as a fifth mechanism and the table cell flips; no rewrite needed. This
avoids the ticket's suggested "per D11" placeholder, which would have left the
document vague in the meantime.

## Verification

- `bun run typecheck` — pass.
- `bunx biome check .` — 0 errors (warnings only, all pre-existing `noExplicitAny`).
- `bun run build` — pass.
- `bun test` with a live PostgreSQL 14.23: **360 pass / 0 fail** (was 353; +7).
- `bun test` with no `DATABASE_URL`: 215 pass / 152 skip / 0 fail.

## Acceptance criteria

- [x] No code path relies on an inert condition — `loadAbility` builds
      `can(action, subject)` and a test asserts no rule carries conditions.
- [x] The CASL v7 behaviour is pinned by a regression test that documents the trap.
- [x] `Security Architecture.md` §4.3 states the true enforcement chain and marks
      RLS as unimplemented.
- [x] The scan test fails when a future `:orgId` route omits `requireOrgMatch`
      (proven by the negative control).
