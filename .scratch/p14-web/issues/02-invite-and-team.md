# NWB-P14.2 — Invitation landing, the team screen, and the roles catalog

Type: task
Status: done 2026-09-27
Phase: P14 (web application) — sub-phase 2 of 15
Size: M
Blocked by: P1 (organizations, users, invitations) — merged long ago. NWB-P14.3 was taken first and
is independent of this ticket.

## Why this exists

`src/services/orgs/invitation.service.ts:245` has, since P1, built the line every invitation email
carries:

```
${APP_BASE_URL_RESOLVED}/invite?token=${rawToken}
```

**`/invite` did not exist.** Neither did `/settings/team`. So the single most important link the
platform sends — the one that turns an invited address into a member — pointed at a 404 for every
invitation ever sent, and the screen where an owner would notice (the member list, the pending
invites, resend, revoke, role changes) did not exist either. This is the same defect shape as
NWB-P14.3 (`302 → /settings/integrations` into a route that was not there), on a flow with more
consequence: an operator can work around a missing connection screen, an invitee cannot work around
a missing accept page.

Building it surfaced a second class of problem, which is why this ticket also ships a test that has
nothing to do with invitations: **there was no mechanism that would have caught the dangling link.**
The `.tsx` routes carry `@ts-nocheck` by convention and nothing renders them in CI, so a service can
build a URL, or a screen can `<Link to="…">`, to a path no route answers, and every gate stays
green. `src/tests/route-links.test.ts` closes that: it scans the services for absolute links and the
routes for navigation targets, and asserts a route file exists for each. It found three, not one —
`/reset-password` and `/change-email/confirm` are dangling too (P14.1 residue, allowlisted in the
test with an assertion that they stay allowlisted only while they stay unbuilt).

## Scope (in)

- **`/invite` — public landing.** Resolves `?token=` on mount (no loader, so no 302-to-sign-in loop
  for an unauthenticated invitee), renders the invitation panel (organization, seat, note, expiry
  with a human relative date), and accepts: existing account → one button; no account → the
  registration block (full name, password, terms, privacy). On success it does **not** pretend to be
  logged in — it shows a confirmation with an explicit sign-in link.
- **`/settings/team`.** Members table (name, address, role, joined, active), the pending-invitations
  panel (address, role, note, expiry, expired flag, resend, revoke), the invite form with a role
  picker fed by the roles catalog, and bulk invite by pasting a CSV list. Seats are displayed, not
  managed here.
- **Two service reads that did not exist.**
  - `listAssignableRoles(db, orgId, actorUserId)` — `roles-catalog.ts` returned the six *platform*
    roles only; nothing answered "what may this actor grant in this org". Org-scoped by
    `organization_id = orgId OR IS NULL`, active only, excludes `owner` (transferred, never granted —
    BR-AUTH-031), excludes anything at or above the actor's level, ordered by `level` so a **custom**
    org role slots in without this code knowing its name.
  - `listPendingInvitations(db, orgId)` — `listMembers` does not project `expires_at` and mixes
    statuses, so the panel needed its own read: `status='invited'`, `accepted_at IS NULL`,
    `deleted_at IS NULL`, `invited_email IS NOT NULL`, joined to the role name and to `users` for
    the has-account flag. No token column of either kind is selected.
- **Six Server Functions** (2 public in `auth.ts`, 4 in `orgs.ts`) + barrel exports.
- **Tests:** `src/tests/orgs/server-functions.test.ts` (17), `src/tests/orgs/team-reads.test.ts` (4),
  `src/tests/route-links.test.ts` (5). Suite 990 → 1016, 0 failures.

## Scope (out)

- **Org-profile screen** (`/settings/organization`) and the **onboarding checklist** — the rest of
  what the execution plan lists under P14.2. Deferred by explicit choice: the invitation flow is the
  half with a shipped email pointing at a 404, and splitting kept this ticket reviewable. Both need
  no new service reads (`getOrganization`, `updateOrganization` already exist), so they are a small
  follow-up, not a blocked one.
- **Email delivery.** The service hands the link to the notifier; whether an SMTP transport exists
  is a P1/infra question this ticket does not touch.
- **Fixing the three findings below.** Each is recorded with its blast radius; none is a web-layer
  change, and two need a migration or a security-model decision.

## Design decisions (this ticket's own calls)

1. **Resend is re-invite, not a new verb.** Re-inviting a pending address already rotates the token,
   re-hashes it, refreshes `expires_at` and re-sends — so the panel's Resend button calls
   `inviteMemberServerFn` with the same address and role. No new service method, no second code path
   that can drift from the first, and the old token dies the moment the new one is minted.
2. **Revoke is a soft delete.** `removeMember` sets `deleted_at` and `listPendingInvitations`
   filters on it, so a revoked invitation disappears from the panel and its token stops resolving
   (a deleted row and a bogus token answer identically — see the test). No new state on the row.
3. **Accept does not establish a session.** `acceptInvitation` has no session side effect, and
   inventing one in the web layer would put authentication in a route file. The landing page ends at
   "you're in — sign in", which is one extra click and zero new auth surface.
4. **Public Server Functions omit `getServerAuth()` deliberately** and use `checkRateLimit` with the
   *same keys* the Hono handlers use (`invite:validate:{ip}` 20/30min, `invite:accept:{ip}:{token
   prefix}` 10/30min). One budget across both doors, so a Server Function is not a way around a
   limit. `server-functions.test.ts` proves it by burning the budget through the Server Function and
   asserting the HTTP route answers 429.
5. **The role catalog is level-based, never name-based.** Nothing in `listAssignableRoles` or the
   picker enumerates `creator`/`analyst`/`viewer`; the predicate is `level < actor.level`. A future
   org-defined role therefore works in the UI the day it is inserted, and `team-reads.test.ts` pins
   that with a custom `editor` at level 50 landing between manager and creator.
6. **Bulk invite is sequential with per-row results.** One row failing (bad address, seat exhaustion,
   duplicate) must not silently drop the rest or roll back the ones that succeeded — invitations are
   already emailed by the time the next row runs. So the client walks the list and renders
   sent/failed per row. Paste-not-upload for the CSV: there is no file pipeline in the web layer, and
   a textarea is honest about what happens.
7. **No token is ever rendered.** `inviteMemberServerFn` returns the raw token (needed by the
   service's own email path); the web route drops it and shows only the outcome. Finding F-P14.2-2
   records that the Server Function *could* leak it to any caller who asks.
8. **The panel is its own read** rather than a wider `listMembers`. Widening the members projection
   would put `expires_at` and `invitation_note` in every consumer's payload for one screen's benefit;
   a second narrow read costs a function and keeps the members contract unchanged.

## Findings and follow-up state

- **F-P14.2 — RESOLVED by `issues/03-invitation-token-hash-only.md` (2026-09-30).**
  `organization_members.invitation_token` was a write-only `varchar(255)` containing the raw
  emailed credential. Migration `0014_invitation_token_hash_only` drops it; invite and re-invite
  now persist only `invitation_token_hash`. The raw value still exists in memory long enough to
  build/send the one-time link, while acceptance and expiry behavior remain hash-based. A regression
  test checks the stored digest and confirms the plaintext column no longer exists. The separate
  RPC exposure noted as F-P14.2-2 remains open; this ticket does not change the invite response.
- **F-P14.2-1 — `listMembersServerFn` asserts no ability.** It mirrors a Hono route that also asserts
  none, so it is not a web-layer regression, but the new `listPendingInvitationsServerFn` *does* gate
  on `read members` and the asymmetry is visible in one file. Documented at the call site
  (`src/app/server-functions/orgs.ts:196`). Tightening the members list is a security-model decision
  (who may see a member list is not obviously the same set as who may invite), not a cleanup.
- **F-P14.2-2 — the invite Server Function returns the raw token.** Nothing in the web renders it,
  but a Server Function is a public RPC: any client can call it and read the token from the response,
  which combined with F-P14.2 means an authenticated member with `members.invite` can mint an accept
  link for an address they chose and hand it to someone else. The route dropping the field is a
  convention, not a control.
- **F-P14.2-3 — every caller whose IP cannot be resolved shares one rate-limit bucket.**
  `getClientIp` (`src/lib/ip.ts:241`) returns `null` when neither `x-forwarded-for` nor `x-real-ip`
  yields a usable hop, and both surfaces interpolate that into the key:
  `invite:validate:${ip}` → `invite:validate:null`. Twenty anonymous lookups from *anywhere* without
  proxy headers therefore exhaust the budget for every other such caller — a self-inflicted denial of
  service on the accept flow, which is the one flow an invitee cannot retry around. **Inherited, not
  introduced**: `src/server/api/auth/invitation.route.ts:28` has shipped this since P1 and the Server
  Function copies it deliberately, because copying the key is what makes the budget shared rather
  than doubled. Fixing it means choosing a policy for "IP unknown" — refuse (fail closed, breaks
  deployments without a proxy that sets the header), or key on something else (session, token prefix,
  a shorter `unknown` budget) — which is a security-model decision for its own ticket, and should be
  made once for every IP-keyed limit in the product rather than per route.

## Exit criteria / acceptance — all met 2026-09-27

| Requirement | Where | Evidence |
|---|---|---|
| Invitee can open the emailed link and accept | `src/app/routes/invite.tsx` | SF tests: accept single-use, field-by-field validation, existing-account path |
| Bogus/expired/revoked tokens cannot be distinguished | `getInvitationPreviewServerFn` | `server-functions.test.ts` "bogus and revoked answer identically" |
| Public endpoints refuse a session and share the HTTP rate-limit budget | `auth.ts` SFs | two tests, one of them asserting Hono 429 after the SF burns the budget |
| Owner sees members, pending invites with expiry, resend, revoke, role change | `src/app/routes/settings/team.tsx` | route structural review + SF/service coverage of every mutation it calls |
| Role picker offers only what the actor may grant | `listAssignableRoles` | `team-reads.test.ts`: ladder per seat, custom role, cross-tenant exclusion, non-member refusal |
| Bulk invite reports per-row outcomes | team route | route structural review; per-row semantics follow from decision 6 |
| No dangling link can ship again | `src/tests/route-links.test.ts` | 5 tests; negative control verified (deleting `invite.tsx` fails the scan naming the service file) |
| Timestamps cross the SF boundary as `Date` | `listPendingInvitations` | `team-reads.test.ts` asserts `expiresAt instanceof Date` — this is the bug the test found (`toDate()`) |
| Gates | — | `bun test` 1016/1016, `tsc --noEmit` clean, `biome check` no errors |

The per-screen UI states (loading · empty · error · permission-denied · mutation-pending · success ·
responsive · keyboard) are implemented in both routes and reviewed by hand; **they are not
automated**, because nothing renders `.tsx` in CI (see `spec.md`, "no live-preview deliverable"). That
is the standing gap for the whole P14 cluster, not a shortcut taken here.

## Comments

- Split as five commits: services + Server Functions (`e03148e`), routes + the dangling-link scan
  (`6c4df69`), tests (`b443c0e`), docs (this file), then the isolation fix below.
- **A leak this ticket introduced and then removed, recorded because it is easy to reintroduce.** The
  payload-rejection tests started life in a `describe("… (no DB)")` block that called the Server
  Functions with no wrapper at all. They passed — and committed a `rate_limits` row per call
  (`invite:validate:null`, because `getServerClientIp()` returns `null` with no headers set, see
  F-P14.2-3), because the shim does not run `.validator()` so the handler body executed against a
  real pool. That broke `src/tests/queue/jobs.test.ts`'s "a manual run can widen the window" test,
  which asserts the reclaim job deleted exactly one bucket and could suddenly see two — a failure in
  a file this ticket never touched, appearing only once the stale row existed. Both tests now run
  inside `withServerFns`, the block is `skipIf(!hasDb())`, and the header comment says why a
  validation test needs a database. After the fix the shared database holds zero `rate_limits` rows
  once the suite finishes. **The general rule is in the phase spec**: `setServerDbForTest` is
  load-bearing for *isolation*, not only for row visibility.
- Follow-up ticket wanted: **org-profile screen + onboarding checklist** (closes out the execution
  plan's P14.2 line), and **F-P14.2** (drop the plaintext invitation token) — the second is
  independent and should not wait for the first.
- `/reset-password` and `/change-email/confirm` remain dangling. They are P14.1's, they are in the
  scan's allowlist with an assertion that keeps the allowlist honest, and the next auth ticket should
  burn that allowlist to zero.
