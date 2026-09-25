# NWB-P1-011 — Impersonation sessions (start/end, full audit, clean end)

Type: task
Status: done (2026-09-24 — typecheck + lint + build exit 0; **837/837** `bun test` against a live
PostgreSQL 14 (809 before, +28 new tests); `coverage:check` green at 94.1% services / 96.8% lib;
acceptance checked below)
Phase: P1 (roadmap Phase 2 · §12)
Size: M
Blocked by: NWB-P1-002 (audit registry — done 2026-09-21)

## Why this exists

Roadmap §12 NWB-P1-011: *"Start/end, full audit, clean end; support tooling (P15-006).
`AuditActorType` already includes `"impersonation"`."* Measured state before this ticket
(2026-09-24):

- `unified_audit_log` has been *waiting* for this ticket since day one: `actor_type` carries
  `'impersonation'`, and two database checks pin its meaning — an `impersonation` row **must**
  carry `impersonation_session_id`, and no other actor type may. `GET /api/audit` already
  filters on `impersonationSessionId`. Nothing writes the column; `grep -rn "actorType:
  \"impersonation\"" src/` is empty.
- `db/compliance/index.ts` ships a dormant `impersonation_sessions` table (not re-exported by
  `db/schema.ts`, not migrated) specced against the aspirational schema: `varchar(32)` ids for
  what are UUIDs here, a NOT NULL `ip_address` the request layer cannot always supply
  (`normaliseIp` → NULL is the established lesson), and a `session_token_hash` for a refresh
  token impersonation does not have.
- `db/core/sessions.ts` carries unused `impersonatedUserId` / `impersonatedByUserId` columns
  from the same aspirational pass.
- `docs/modules/System Administration.md` sets the rules this ticket adopts: MFA + written
  justification (BR-ADMIN-008), 4-hour maximum (US-ADMIN-011/FR-ADMIN-015), self-impersonation
  denied, impersonation barred from billing / organization deletion / role self-escalation
  (BR-ADMIN-009), every action tagged (BR-ADMIN-021's "AS USER" requirement — here:
  `actor_type='impersonation'` + `impersonation_session_id` + `target_user_id`).

## Scope (in)

1. **Adopt `impersonation_sessions`** (the NWB-P1-010 pattern: re-export in `db/schema.ts`,
   migration brings the table live) with this ticket's adjustments, recorded in the schema file:
   ids widened `varchar(32)` → `varchar(64)` (0005/0006 precedent), `organization_id varchar(64)
   NOT NULL` added (sessions are org-scoped here — see decisions), `ip_address` made nullable,
   `session_token_hash` **dropped** (impersonation mints a short stateless access JWT validated
   against the row on every request — there is no refresh token to hash).
2. **Service** `src/services/impersonation/`:
   - `startImpersonation` — self-impersonation 403 (`SELF_IMPERSONATION_DENIED`); target must be
     an active member of the caller's org (cross-tenant/unknown → 404); **MFA step-up**: an admin
     without enrolled MFA is refused (`MFA_REQUIRED` 403 — BR-ADMIN-008 is "requires MFA", so
     support impersonation *needs* enrollment), an admin with MFA must present a valid TOTP or
     backup code (reuses `verifyMFAForLogin`, which audits `auth.mfa.verified`/`failed`);
     duration default 60 min, clamped 5–240 (the 4-hour maximum); one active impersonation per
     target (second admin → 409 `IMPERSONATION_ACTIVE`); an admin re-starting their own still-
     active session **re-enters** it (new short token, audited) rather than stacking rows.
   - Short-lived impersonation access JWT (≤15 min, the normal access-token TTL) whose payload
     carries `impersonationSessionId` + `impersonatorId`; the **row is the source of truth** —
     the auth middleware re-validates it on every request, so an ended/expired/terminated
     session dies on the next request no matter what the token's `exp` says.
   - `endImpersonation` — the session's own admin ends it (`manual_end`); a different
     `users.impersonate` holder ends someone else's (`security_terminated`); already-ended → 409.
   - `expireLapsedImpersonations` — the clean end for sessions nobody closed (endReason
     `expired`), per-row savepoints (the P1-003 pattern), scheduled every 5 minutes.
   - `listImpersonations` — org-scoped oversight view (active + recent), keyset-paginated.
3. **Every action during impersonation is tagged, automatically**: a request-scope ALS
   (`src/lib/impersonation-context.ts`) is entered by the auth middleware when the access token
   is an impersonation token; `writeAuditLog` reads it the way NWB-P1-012 taught it to read the
   request id — actor becomes `actor_type='impersonation'`, `actor_id` the **admin's** id,
   `impersonation_session_id` set, `target_user_id` defaulting to the token user (the
   impersonated account) unless the caller named one. Explicit call-site values win, so the
   start/end events themselves (written outside the scope) file as plain `admin` actions.
4. **Least privilege while impersonating (BR-ADMIN-009)**: the ability loaded during an
   impersonated request is the **target's** own ability, minus a denied set — `billing.*`,
   `org.delete`, `roles.create/update/delete`, `members.create/update/delete`, and
   `users.impersonate` (no nested impersonation). You see the product as they do; you cannot
   delete their org, touch billing, or rewrite the team.
5. **Routes** (module-10 surface, on the existing `/api/users/admin` prefix):
   - `POST /api/users/admin/:userId/impersonate` — `users.impersonate`
   - `POST /api/users/admin/impersonations/:sessionId/token` — re-mint inside the window
     (the session's own admin only), audited as a re-entry
   - `POST /api/users/admin/impersonations/:sessionId/end` — `manual_end` for the owner of the
     session, `security_terminated` for another impersonate-holder; callable **from inside the
     impersonation itself** (the support UI's "Stop" button must not deadlock behind an ability
     the target does not have)
   - `GET /api/users/admin/impersonations` — `audit.read` (compliance visibility)
   Registered **before** the `/:userId` routes in `admin.route.ts` (F-11's lesson, pinned by a
   regression test — `GET /impersonations` must not be eaten by `GET /:userId`).
6. **Audit actions** (registry, module `admin` → hash-chained like every admin event):
   `admin.impersonation.started`, `.reentered`, `.ended`, `.terminated`, `.expired`.
7. **Target notification**: start sends the target a security email (new `EmailKind`
   `impersonation`), best-effort — success flips `security_notified`; failure is left false and
   logged, never thrown (the email contract: a provider outage cannot 500 the support flow).
8. **Seed**: `users.impersonate` permission (verb `impersonate` joins the `Actions` union, the
   `decide` precedent). Granted to `owner` + `super_admin` only — the module spec gives it to the
   platform admin, and an organization's owner is its top support authority; `admin` and below
   do not get it.

## Scope (out)

- **Support UI** (impersonation banner, session dashboard) — P15-006 per the roadmap line. This
  ticket is the engine and the API.
- **Server Functions** for the web app — with the UI (P15-006); Hono-only like approvals
  (NWB-P1-003).
- **Second-admin pre-approval** for enterprise tiers (`approved_by`/`approved_at` columns stay
  NULL and reserved) — no tier/billing concept exists yet to hang the condition on.
- **Idle-timeout sweep** on `last_action_at` (the column is tracked but nothing enforces 15
  minutes): the 15-minute token TTL already stops unattended sessions from acting, and the
  expiry sweep closes the rows. Tightening belongs to P15-006.
- **Cross-org / platform-level impersonation** (super_admin reaching into any org): start is
  org-scoped by design; recorded as a decision below, revisitable with the tier model.
- The `sessions` table's dormant `impersonated*` columns stay unused — an impersonation has no
  refresh session, so `impersonation_sessions` is the sole record.

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Row-per-request re-validation instead of trusting the JWT `exp` | "Clean end" must be immediate: `security_terminated` has to kill a live support session on its next request, not at token expiry. One indexed PK read per impersonated request. |
| 2 | Actor during impersonation = the **admin** (`actor_type='impersonation'`), target in `target_user_id` | Non-repudiation: the human who acted is on every row; the "AS USER" requirement (BR-ADMIN-021) is answered by `target_user_id` + `impersonation_session_id`, which `GET /api/audit` already exposes. |
| 3 | ALS defaulting in `writeAuditLog` (the NWB-P1-012 pattern) | Dozens of call sites must not each remember to pass impersonation context — that is exactly how the tagging property would be lost in a refactor. The DB's bidirectional CHECK is the safety net: an untagged write under impersonation scope is impossible, and a tagged write outside it is a type/test error. |
| 4 | MFA enrollment is a hard precondition; step-up code verified per start | BR-ADMIN-008 reads "require MFA verification" — a support admin who never enrolled would otherwise bypass the control by omission. Reusing `verifyMFAForLogin` gives the step-up its own audit rows for free. |
| 5 | Token TTL = min(remaining window, 900 s) | Matches the normal access-token doctrine ("a 15-minute access token must not outlive an administrator's decision"); the `/token` re-mint keeps a long support session workable without re-MFA inside the window. |
| 6 | End-from-inside is legal | After the cookie swap the admin's *abilities* are the target's; a "Stop" button that 403s is a support session that cannot be ended by its own UI. The route authorizes on `impersonation.adminUserId === sessionId's admin` OR the ability. |
| 7 | `organization_id NOT NULL` on the adopted table | Impersonation is org-scoped in this design (decision 5 of scope-out); the column makes the oversight list, retention, and the chain module's org filter straight lookups instead of membership joins. |

## Exit criteria / acceptance (checked 2026-09-24)

- [x] Start: row + short token; `admin.impersonation.started` (module `admin`, warning severity,
      chain-sealed) with target, reason, duration, MFA; target email sent and
      `security_notified` flipped — `impersonation.service.test.ts` ("start creates the row…").
- [x] Self → 403 `SELF_IMPERSONATION_DENIED`; unknown/cross-org/deleted → 404; suspended target
      → `AccountSuspendedError`; no-MFA admin → `MFA_REQUIRED`; wrong code → 401 with
      `auth.mfa.failed` written; >240 clamped to 240 and <5 up to 5 (re-entry semantics
      respected — the clamp test ends the first session first); second admin → 409
      `IMPERSONATION_ACTIVE` naming the blocking session; same admin restart → re-entry, same
      row, `admin.impersonation.reentered` audited.
- [x] Audited writes under the scope carry `actor_type='impersonation'`, `actor_id`=admin,
      `impersonation_session_id`, `target_user_id`=impersonated account (explicit
      `targetUserId` wins); outside the scope nothing changes — retagging describe in
      `impersonation.service.test.ts` + the end-to-end route test through
      `DELETE /api/auth/sessions/:id`.
- [x] Abilities while impersonating = target's minus the denied set; `org.delete` refuses even
      against an owner target (route test), `users.impersonate` never survives, and a `manage`
      wildcard on a denied subject is stripped wholesale (`ability.test.ts`).
- [x] End: own → `manual_end` (callable from inside the session, cookie cleared), another
      impersonate-holder → `security_terminated`, twice → 409; a token used after end/expiry is
      401 on the next request (row check, not `exp`); a hand-crafted token with an invented
      session id is refused; suspending the admin kills their live sessions.
- [x] `impersonation.expire` closes lapsed rows as `expired` with per-row `system` audit rows
      and is idempotent — `jobs.test.ts` "impersonation.expire job"; schedule registered
      (`*/5 * * * *`, `QUEUE_CRON_IMPERSONATION_EXPIRE` override in `.env.example`).
- [x] `users.impersonate` seeded (`owner` + `super_admin` take the full catalog; `admin` and
      below do not); list endpoint 403s without `audit.read` (manager test);
      `GET /users/admin/impersonations` resolves to the literal route, not `GET /:userId`
      (shadowing regression test — registration order pinned).
- [x] Gates: `bun run typecheck` ✓, `bun run lint` 0 errors ✓, `bun run build` ✓, full
      `bun test` with `DATABASE_URL` **837/837** ✓, `bun run coverage` + `coverage:check`
      services **94.1%** (≥85) / lib **96.8%** (≥90) ✓.

## Comments

- 2026-09-24: claimed by the Arena agent (session `arena/01a0d531-nawebeus`) — NWB-P1-012
  landed yesterday; this is the last unblocked P1 ticket (P1-005 waits on D6).
- 2026-09-24: **done.** What landed, for the reviewer:
  - **Schema**: `impersonation_sessions` adopted out of `db/compliance` (re-exported in
    `db/schema.ts`), migration `0009_impersonation_sessions` (hand-renamed from drizzle's
    `0009_left_bug`; journal updated). Adoption adjustments recorded in the schema file: ids
    `varchar(32)`→`64`, `organization_id varchar(64) NOT NULL`, `ip_address` nullable,
    `session_token_hash` dropped (no refresh token exists to hash). The `impersonation_end_reason`
    enum was already in the 0000 baseline (all enums ship from `shared/enums.ts`), so the
    migration creates only the table + its 6 CHECKs + 5 indexes.
  - **Service**: `src/services/impersonation/` (`impersonation.service.ts`, `ability.ts`,
    `index.ts` barrel). Start/MFA/end/mint/sweep/list + `resolveLiveImpersonation` for the
    middleware. The critical section (open-session check + insert + start audit) runs inside
    `withAtomicWrites`; lapsed rows are closed inline by start/mint so a ghost never jams a
    support flow; the notification email sits outside the atomic block (queued sends must not
    commit with a rollback-able business write) and its outcome folds into the returned
    snapshot.
  - **Automatic tagging**: `src/lib/impersonation-context.ts` (third request-scope ALS, next to
    org-context and request-context — the file header explains why the scopes don't merge);
    `writeAuditLog` retags out of the scope exactly like the NWB-P1-012 request-id default.
    `unified_audit_log` INSERT extended with `impersonation_session_id` (the column existed;
    nothing wrote it).
  - **Middleware**: impersonation tokens are re-validated against the row per request
    (ended/expired/terminated/suspended-admin → 401 immediately), the ability loaded is the
    target's minus the BR-ADMIN-009 deny-list, the scope is entered around `next`, and the
    access log gains `impersonationSessionId`.
  - **Routes** (`admin.route.ts`, registered **before** the `/:userId` block — Hono resolves in
    registration order, verified empirically, pinned by test): `POST /:userId/impersonate`,
    `POST /impersonations/:sessionId/token`, `POST /impersonations/:sessionId/end`,
    `GET /impersonations`. End-from-inside is bound to the caller's own session id in the
    impersonation context; a `patternParam` helper joined `route-params.ts` for the
    `imp_<uuid>` ids.
  - **Job**: `impersonation.expire` (`*/5 * * * *`), third in the schedule order, outside the
    nightly chain; run-level action `impersonation.expire` (the queue's audit descriptors are
    pinned to two-segment `<resource>.<verb>` by `definitions.test.ts`), per-row evidence is
    `admin.impersonation.expired` with `actorType: "system"`.
  - **Seed**: `users.impersonate` (the `Actions` union gained `impersonate` — the `decide`
    precedent); `bun run seed` converges existing databases (re-run before testing this).
  - **Residuals (deliberate, see Scope-out)**: second-admin pre-approval (`approved_by` stays
    NULL and reserved), idle-timeout enforcement on `last_action_at`, cross-org impersonation,
    and the P15-006 support UI/SF surface. The `sessions` table's dormant `impersonated*`
    columns remain unused — an impersonation has no refresh session here.
