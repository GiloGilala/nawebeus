# NWB-P0-029 — Route shadowing (F-11) and the malformed-uuid class it exposed

**Status:** done — 2026-09-20 (verified locally: typecheck + `bun run lint` exit 0 +
build + **412/412** `bun test` with a live database, 227 pass / 196 skip / 0 fail
without one)

- **Epic:** p0-foundation-gap
- **Fixes:** **F-11** (route shadowing) and a wider defect it uncovered
- **Size:** S/M
- **Depends on:** —

## Why this ticket, and why now

The p0-foundation-gap epic's own tickets are finished; the two that remain (05, 22) are
blocked on repo-owner credentials. So I triaged the defect register for the next real
piece of work. F-11 was the pick: it is the only remaining defect the roadmap assigns to
**Phase 1** (`14-security.md` S-14: *"F-11 fix in Phase 1 (explicit admin mount)"*), and
`05-target-architecture.md` already specifies the target shape. F-14/F-15/F-16/F-18/F-19
are all scheduled for later phases and depend on work that does not exist yet.

## The defect was mis-rated

The register says (Low): *"Harmless today only because registration order shadows it; any
reorder makes `GET /users/me` an admin call with `userId="me"`."*

The hypothetical was real, but the **present-tense** consequence was missed. Both routers
mounted on `/users`, and `adminRouter`'s list route was `/`, so the admin list lived at
`GET /api/users` — while `GET /api/users/admin`, the path every doc advertises
(`13-api-service.md`, `05-target-architecture.md`, roadmap §NWB-P0-002), matched
`GET /:userId` with `userId = "admin"`. Reproduced against the pre-fix code:

```
GET /api/users/admin   ->  500 {"error":{"code":"INTERNAL_ERROR", ...}}
   [NWB_DEBUG_ERRORS] error: invalid input syntax for type uuid: "admin"
GET /api/users/me      ->  200   (me-routes were fine — order did save those)
```

So a documented admin endpoint was returning 500, not 404, in the current tree.

## The bigger finding underneath it

The 500 was not really about shadowing. `userId` went from the path straight into
`WHERE id = $1` against a `uuid` column, so **any** non-uuid segment reached the driver.
I probed each route family that passes a raw param to a service rather than assuming the
scope:

| Route | Before | After |
|---|---|---|
| `GET /api/users/admin/:userId` | **500** | 422 |
| `GET /api/orgs/:orgId/members/:memberId` | **500** | 422 |
| `DELETE /api/auth/sessions/:sessionId` | **500** | 422 |
| `GET /api/users/me/data-export/:requestId` | **500** | 422 |
| `GET /api/api-keys/:id` | 404 | 404 |

Four of five. api-keys was already correct because it validated inline with a
`uuidSchema.safeParse` — the same check had been copy-pasted into three files.

Why it matters beyond tidiness: 500 is the wrong status for a malformed client request,
it fires error alerting on junk traffic, and a driver error is one `errorHandler` change
away from being echoed to the caller as an oracle.

## Change

1. **`src/server/api/users/index.ts`** — `userRouter.route("/users/admin", adminRouter)`.
   The admin surface gets a literal prefix, so mount order can no longer decide
   correctness, and this is the surface the docs already describe.
2. **`src/server/api/route-params.ts`** (new) — `uuidParam(c, name, label)` and `isUuid`,
   lifted from the api-keys inline check rather than invented, throwing
   `ValidationError` (422) before the id can reach Postgres.
3. Applied at all ten affected call sites across `users/admin.route.ts`,
   `orgs/member.route.ts`, `auth/sessions.route.ts`, `users/me.route.ts`.

No new dependencies. No schema change.

## Tests — +29 (383 → 412)

`src/tests/route-params.test.ts` (11): one 422 case per affected route family, each
asserting the body carries `VALIDATION_ERROR` and leaks neither `invalid input syntax`
nor `22P02`; a **well-formed but unknown** uuid still 404s (proving the guard rejects only
*malformed* ids and did not collapse "not found" into "bad request"); uppercase uuids are
accepted (guarding against an over-strict regex, since Postgres accepts them); and pure
`isUuid` cases including `"admin"`, `"me"`, off-by-one lengths, wrong separators and
`' OR 1=1 --`.

`src/tests/users/admin.test.ts` (+5): the me-route resolves to the *caller's own* record;
`GET /api/users/admin` returns 200 and a list; a non-uuid id is not a 500; `/api/users` is
now a 404; and every `/users/me*` path still resolves after the remount.

**Both halves verified red before green**, separately:

- Reverting the guard in `admin.route.ts` → the 3 admin 422 cases fail, 8 still pass.
- Reverting the mount to `/users` → 5 fail, including the pinned
  `GET /api/users/admin lists users — it no longer 500s`.

## Consumers updated

Six existing test paths built the old admin URLs with template literals
(`/api/users/${id}`), which is why the first grep for `"/api/users/` missed them — the
full suite caught them instead (5 failures on the first run). Updated in
`orgs/role-assignment.test.ts` and `users/dsar-export.test.ts`, along with three test
*names* that described the old surface. No production caller exists: the web app uses
Server Functions, and no frontend consumes `/api/*` yet.

## A gate I broke and caught

After the edits `bun test` was green but **`bun run lint` exited 1** — a formatting error
in `users/admin.test.ts`. I only noticed because I ran the lint script rather than reading
`biome check`'s warning count, then bisected with `git stash` to confirm the failure was
mine and not pre-existing. Fixed with `biome check --write`. Worth recording: this repo
has been red at HEAD on exactly this gate before (F-27), and `biome check` prints
"Found N warnings" cheerfully while exiting non-zero for a single error.

## Register accuracy audit

Checking F-11's neighbours against the code found **six rows describing defects that are
already fixed but were never marked closed**: F-04, F-04b (backup codes are staged as
SHA-256 hashes and promoted unchanged — displayed ≡ stored), F-10 and F-13 (both closed by
NWB-P0-017), and F-20 (the invitation columns exist). Recorded in `02-defects.md` as an
accuracy note; the rows stay as history.

**F-17 I deliberately did not mark closed.** `createApp` is no longer unreferenced —
`src/app/start.ts` calls it — but `start.ts` is not wired to any `package.json` script, so
the factory is only reachable from the not-yet-live TanStack Start entry point. It is
"overtaken, pending Phase 7", not fixed, and deleting `createApp` now would remove the
thing Phase 7 is meant to use.

Genuinely still open after this pass: **F-14** (pagination, Phase 7), **F-15** (session
device metadata), **F-16** (single-org model, tied to D14), **F-18** (no purge scheduler,
Phase 2 queue), **F-19** (no audit read API, Module 10).

## Acceptance

- [x] `/users/me*` and the admin routes can no longer shadow each other, whatever the
      mount order.
- [x] `GET /api/users/admin` returns 200, not 500.
- [x] No malformed path param reaches Postgres on any route family; 422 with no driver
      detail in the body.
- [x] Positive and negative tests; both fixes verified red against the unfixed code.
- [x] `bun test` 412/0 with a live DB, `typecheck`, `bun run lint` **exit 0**, `build`.
- [x] Docs: `02-defects.md` (F-11 closed + accuracy note), `14-security.md` (S-14 closed,
      S-14b added), `05-target-architecture.md`, `13-api-service.md`, `AGENTS.md`.

## Not done here

- **No audit event:** nothing in this change mutates state; the routes' own handlers
  already audit their mutations.
- **Tenant isolation unchanged:** the admin routes keep `requireAbility` and their
  `orgId`-scoped service calls; the remount moves the prefix, not the guards.
- **F-14 (pagination)** touches the same list routes and is scheduled for Phase 7. I left
  it alone rather than widen this ticket.
