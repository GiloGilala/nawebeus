# Master Roadmap — Phase 0 & Phase 1: Foundation Completion & Defect Remediation (§10–§11)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 10. Phase 0 — Discovery / Baseline

**Status: DONE (this document).**

- **Objective:** establish verified current state, defect register, discrepancy register, gap matrix.
- **Deliverable:** this roadmap (index: `docs/plan/MASTER_IMPLEMENTATION_ROADMAP.md`, parts in `docs/plan/master-roadmap/`).
- **Verification method:** static verification against HEAD `249707c` (2026-09-20) + isolated CASL v7 semantic test + documentation cross-read. No code modified (operating rule 20).
- **Exit criteria (met):** every subsystem classified with evidence; every planned task traceable to a verified gap; all doc/code conflicts adjudicated or explicitly parked as decisions (D12, D13, D6, D8, D9, D11, D14, D15).

---

## 11. Phase 1 — Foundation completion & defect remediation

**Objective:** make Module 1/2 genuinely complete and make the foundation enforceable — so that no later phase builds on a broken or unverifiable base.
**Slug (issue tracker):** extend `.scratch/p0-foundation-gap/` (tickets NWB-P0-002, NWB-P0-005 already exist there; new tickets below follow the same convention).

**Entry criteria:** Phase 0 accepted. No code-level blockers.
**Dependencies:** none (this is the gate).
**Blocking decisions to resolve in this phase:** **D12** (product), **D13** (role model), **D11** (RLS posture), **D15** (API versioning).

### Phase 1 tasks

> Format per operating rule 10: Task ID / Title / Objective / Why / Current state / Required change / Affected areas / Dependencies / Implementation steps / Tests / Verification / Acceptance criteria / Risk / Rollback.

---

#### NWB-P0-010 — Assign the Owner role atomically at signup (F-01)
- **Objective:** a signed-up user's organization membership carries the owner role at creation time, in the same transaction as the user+org writes.
- **Why:** without it, every new org owner has zero permissions (F-01) — the product is unusable after signup.
- **Current state:** `src/services/auth/signup.ts:182` inserts the membership without `role_id`; no test asserts the resulting ability.
- **Required change:** after org+user inserts, insert `organization_members` with `role_id` = the owner role's id (per D13's chosen code — likely `org_admin` if D13 keeps the seed set, or a new `owner` role if D13 adopts the spec set). Keep the `organizations.owner_id` back-pointer consistent. Do **not** create a new role taxonomy in this task — D13 owns that.
- **Affected areas:** `src/services/auth/signup.ts`, `src/seed.ts` (owner role lookup by code), `src/tests/auth/signup.test.ts`.
- **Dependencies:** D13 (role code to use).
- **Steps:** (1) select the owner role id from `roles` by the D13 code (system role, `organization_id IS NULL`); (2) add `role_id` to the membership INSERT; (3) wrap user+org+membership in one transaction (`db.transaction`) — signup currently performs 6+ independent writes that are not atomic today (also fix: a crash mid-signup leaves an orphan user/org); (4) add an audit event `organization.owner.created`.
- **Tests:** DB integration test: signup → assert membership row has role_id; assert `loadAbility(db, userId, orgId)` contains `members.create` (invite works); negative: transaction rollback on forced failure leaves no partial rows.
- **Verification:** `bun test src/tests/auth/signup.test.ts` green with DB; manual: sign up, then `POST /api/orgs/:orgId/members/invite` returns 200 (was 403).
- **Acceptance criteria:** new owner can invite a member within 60s of signup; signup is atomic.
- **Risk:** low. Changing role assignment is backward-compatible for a pre-production system (no real orgs exist yet).
- **Rollback:** revert the single INSERT change; no data migration needed (pre-prod).

#### NWB-P0-011 — Fix the `organization` vs `org` permission subject (F-02)
- **Objective:** `PATCH /api/orgs/:orgId` authorizes correctly for holders of the update permission.
- **Why:** org settings are currently unchangeable by anyone (F-02).
- **Current state:** route subject `"organization"` (`src/app/orgs/org.route.ts:40`) vs seed strings `org.*` (parse to subject `"org"`); conventions elsewhere are resource-prefixed (`roles.*`, `members.*`, `apikeys.*`, `posts.*`).
- **Required change:** pick ONE spelling and make seed, routes, and docs agree. **Recommended: keep `org.*` strings, change the route** to `requireAbility("update","org")` (2-line change, no data migration, matches the compact convention). If D13 renames roles/permissions, update both sides in that task instead.
- **Affected areas:** `src/app/orgs/org.route.ts` (or `src/seed.ts`), `src/tests/orgs/org.test.ts`, module 1 spec §6.2 (doc correction).
- **Dependencies:** D13 (if it changes permission strings).
- **Steps:** change route subject; add integration test.
- **Tests:** positive (org_admin PATCH → 200) **and** negative (viewer PATCH → 403) per the Negative Test Rule (QA §2.2) — currently the org test file only covers 401s.
- **Verification:** both tests green with DB; envelope `{data:{org}}` unchanged.
- **Acceptance criteria:** org update works for permitted roles and is denied for others.
- **Risk:** negligible. **Rollback:** one-line revert.

#### NWB-P0-012 — Complete the MFA login flow (F-03, F-04, F-04b)
- **Objective:** MFA-enabled users can complete login via the challenge flow; backup codes work and are stored hashed; setup is confirm-or-discard.
- **Why:** F-03 makes the documented 2-step flow a dead end; F-04 makes every displayed backup code unusable; F-04b violates spec AC4.
- **Current state:** `signIn` returns `requiresMfa` (auth.service.ts:158-166) with no follow-up route; `confirmMFAChallenge`/`checkMFAForLogin` unwired (mfa.ts:175-202); `confirmMFASetup` regenerates backup codes (mfa.ts:63); codes stored as plaintext jsonb.
- **Required change:**
  1. Add `POST /api/auth/mfa/verify-login` (public, rate-limited per IP+user, 3 attempts / 15 min per spec AC8) that: consumes the 15-min single-use challenge token created by `checkMFAForLogin` (wire it into `signIn`'s MFA branch — replace the misleading `sessionId: userId` with a real challenge token id returned as `mfaSessionId`), verifies TOTP or backup code, then issues the session cookies exactly like `signIn`'s success path (extract the cookie-setting code into a shared helper used by both `signin.route` and the new route).
  2. `initiateMFASetup` must **not** overwrite an existing active secret before confirmation: stage the new secret+codes in a pending column or the `tokens` table (pattern already exists for one-time secrets), and only promote on `confirmMFASetup`. Abandoned setup leaves prior MFA intact.
  3. Store backup codes hashed (SHA-256 per code is acceptable — they are high-entropy UUID slices; spec says bcrypt, but SHA-256 of 32-bit random is stronger; record the deviation in the ticket) and compare against hashes on use; display set ≡ stored set.
- **Affected areas:** `src/app/auth/mfa.route.ts` (new route), `src/services/auth/mfa.ts`, `src/services/auth/auth.service.ts` (MFA branch), `src/app/auth/signin.route.ts` (cookie helper), `db/core/users.ts` (optional staging columns — prefer `tokens` table to avoid schema change), `src/tests/` (new `mfa-login.test.ts`).
- **Dependencies:** F-10 (IP policy) for the rate-limit key — use the same normalized-IP helper after NWB-P0-017.
- **Steps:** (1) extract `setSessionCookies(c, result)`; (2) wire challenge token in `signIn`; (3) new route + service; (4) staging for setup; (5) hashed backup codes.
- **Tests:** full flow: enable MFA → sign in (no code) → challenge → wrong code (3× → locked per AC8) → right code → cookies set; backup code path works with the *displayed* code; abandoned re-setup keeps old MFA functional; MFA-disabled user unaffected.
- **Verification:** integration tests green; manual browser flow.
- **Acceptance criteria:** AC1–AC5, AC8, AC9 of Module 1 FR-AUTH-008 met (AC6 trust-device and AC7 enforcement stay deferred — see scope note below).
- **Risk:** medium (auth-critical). **Rollback:** the new route is additive; the `signIn` MFA-branch change is revertable without data loss (challenge tokens expire in 15 min).
- **Scope note:** AC6 ("trust this device") and AC7 (Owner/Admin MFA enforcement + 7-day grace) are **post-MVP recommended** (P14.13 can gate on org policy via Phase 2 feature flags). Do not expand this task.

#### NWB-P0-013 — Fix the sliding-window rate limiter (F-12)
> **Status: done — 2026-09-20.** Ticket: `.scratch/p0-foundation-gap/issues/13-rate-limiter.md`. The upsert half landed in NWB-P0-012 (adopted verbatim as the MFA AC8 prerequisite); this ticket added `reclaimRateLimits` + the manual `bun run db:reclaim-rate-limits` script (Phase 2 / NWB-P1-001 wires it to the scheduler), 5 dedicated tests in `src/tests/rate-limit.test.ts` (verified red against the pre-P0-012 statement recovered from git history, green against the new), and doc updates. The P0-012 note about using the normalized-IP helper for the rate-limit key needed no change — NWB-P0-017's route conversions already feed `getClientIp` into both `checkRateLimit` call sites.
- **Objective:** `checkRateLimit` counts correctly across window boundaries forever, and expired buckets are reclaimed.
- **Why:** the IP brute-force block currently dies permanently per IP after the first window (F-12) — a security control that silently stops working.
- **Current state:** `src/lib/rate-limit.ts` upsert skips reset when `window_start` is stale; no reclamation; no tests exist for this module at all.
- **Required change:** make the upsert window-aware in one statement:
  ```sql
  INSERT INTO rate_limits (id,key,count,window_start,expires_at)
  VALUES (… ,1, $windowStart, $windowEnd)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN rate_limits.window_start >= $windowStart
                 THEN rate_limits.count + 1 ELSE 1 END,
    window_start = CASE WHEN rate_limits.window_start >= $windowStart
                        THEN rate_limits.window_start ELSE $windowStart END,
    expires_at = $windowEnd
  ```
  plus a reclamation worker (Phase 2 queue; a `pg_cron`-free nightly `DELETE WHERE expires_at < now() - interval '1 hour'` started from the same place the Phase 2 scheduler lives — in Phase 1, add it to `src/seed.ts`? No — keep Phase 1 schema/code minimal: add the DELETE as a scheduled function invoked by CI nightly? **Decision: Phase 1 ships the correct upsert + a manual `bun run db:reclaim-rate-limits` script; Phase 2 wires it to the scheduler.** Document in the ticket.)
- **Affected areas:** `src/lib/rate-limit.ts`, new `src/scripts/reclaim-rate-limits.ts` (or `src/lib/rate-limit.ts` export), `src/tests/rate-limit.test.ts` (new).
- **Dependencies:** none.
- **Steps:** fix SQL; add reclamation export; write tests.
- **Tests (time-controlled, no real waits):** manipulate `window_start` directly to simulate expiry: window rolls ⇒ counter resets to 1; active window increments; N+1th call exceeds; reclamation deletes only expired rows. Pin the old behavior as a failing test first (same red-green discipline as NWB-P0-008).
- **Verification:** tests green; `bun test` full suite unaffected.
- **Acceptance criteria:** limiter is correct across ≥3 window boundaries per bucket; expired rows reclaimable.
- **Risk:** low. **Rollback:** revert SQL; limiter reverts to today's (broken-after-first-window) state — acceptable for pre-prod.

#### NWB-P0-014 — Align the role model with the spec (D13) + make self-protection real (F-07)
> **Status: done — 2026-09-20.** Ticket: `.scratch/p0-foundation-gap/issues/14-role-model-and-self-protection.md`. Delivered as specified, with two deviations recorded there: the BR-AUTH-030 409 is pinned at the service boundary (unreachable through HTTP once the Owner is immutable and only Owner/super_admin outrank an Admin), and Manager *can* remove members below Manager per FR-ORG-006. Also fixed F-21 (removal 500) and the assign-role 404.
- **Objective:** one role hierarchy, used identically by seed, guards, routes, and docs; self-protection rules fire for the roles that exist.
- **Why:** F-07: guards check codes `owner`/`admin` that don't exist in the seed (`super_admin`/`org_admin`/`member`/`viewer`), so "cannot remove last admin" and "cannot demote owner" can never fire.
- **Current state:** spec §6 = 6 tiers (Owner, Admin, Manager, Creator, Analyst, Viewer); PRD §8.2.2 = 5 (Owner, Admin, Manager, Analyst, Viewer); seed = 4 (super_admin, org_admin, member, viewer); guards reference `owner`/`admin`; plan/AGENTS reference `super_admin`/`org_admin`.
- **Required change (recommended direction — record as DEC in Decision Log):** **keep the seeded set as the system roles, rename for spec alignment, and add the missing tiers as org-scoped roles:**
  - `super_admin` stays (platform level, `organization_id IS NULL`) — it is the only platform role and is referenced by AGENTS.md/plan.
  - Add org roles: `owner` (maps the spec Owner; created per-org on signup alongside the membership — this is the role NWB-P0-010 assigns), `admin`, `manager`, `analyst`, `viewer`. Keep `org_admin` as a **deprecated alias** pointing at the same permission set for one release, or drop it in the same migration (pre-prod ⇒ drop, no compatibility burden). `member`/`creator` fold into `manager`/`creator` per spec §6.1.
  - Rewrite the three guards in `role-assignment.service.ts` against the real codes (`owner`, `admin`), including "last owner must remain" (org.deletion is the only path that removes it).
  - Seed: idempotent insert of the new role set + permission mappings per spec §6.2 matrix; bootstrap admin gets `super_admin`.
- **Affected areas:** `src/seed.ts`, `db/core/roles.ts` (check constraints if any on code — none known), `src/services/orgs/role-assignment.service.ts`, `src/app/orgs/role.route.ts` (validation of roleId existence per org), `src/tests/orgs/role-assignment.test.ts`, module 1 spec (already the source).
- **Dependencies:** none (this task IS the D13 implementation; the decision itself is recorded first).
- **Steps:** (1) record decision; (2) seed migration (new roles, mappings; drop deprecated rows); (3) guard rewrite; (4) tests.
- **Tests:** each self-protection rule positive+negative (demote owner → 403; remove last admin → 409; demote self from admin when owner → 403; last owner cannot be removed; manager can invite but not delete members, per matrix).
- **Verification:** full role matrix tests green; `bun run seed` idempotent (run twice).
- **Acceptance criteria:** spec §6.2 matrix enforced; all three self-protection guards demonstrably fire (each has a red test against old code first).
- **Risk:** medium (RBAC data). **Rollback:** pre-prod — re-seed; no customer data.

#### NWB-P0-015 — Enforce user status at sign-in (F-05)
> **Status: done — 2026-09-20.** Ticket: `.scratch/p0-foundation-gap/issues/15-user-status-enforcement.md`.
> Delivered as specified, with two deviations recorded there: the new error class is
> `AccountSuspendedError` (symmetry with `AccountLockedError`, so a client can tell a human
> decision from a self-clearing lockout), and `emailVerified` was added to the verify-login
> and Server-Function responses too, not only signin. The re-check is stronger than asked —
> `authMiddleware` re-reads the account on every request for both the cookie and API-key
> paths (one statement, no extra round trip), so a suspension lands at the next request
> rather than within 15 minutes. `pending_verification` stays allowed until Phase 2 ships
> real email delivery, as the ticket's two-step plan requires.
>
> **Phase 2 checkbox flipped — 2026-09-22 (NWB-P1-004).** With Resend behind the transport,
> `authMiddleware` now answers 403 `EMAIL_NOT_VERIFIED` for `pending_verification` accounts on
> every protected route except `/api/auth/*` and `/api/users/me*` (both the cookie and the API-key
> branch; the status is re-read per request, so verifying opens the gate for the session already
> held). Invitation acceptance counts as verification. Two latent bugs in the verification path
> surfaced when the gate made it load-bearing and were fixed in the same ticket: the signup
> token row stored a truncated selector `consumeToken` could never match, and `verifyEmail`
> updated a column `users` does not have. Ticket: `.scratch/p1-shared-infra/issues/09-email-transport-resend.md`.
- **Objective:** `suspended` users cannot authenticate; `pending_verification` users can authenticate but only into a verification-limited session (see decision note); `deleted` remains excluded.
- **Why:** a suspended account (admin action) currently retains full access (F-05); PRD requires verified-for-access.
- **Current state:** `status` selected but unused (`auth.service.ts:73`).
- **Required change (recommended):** (1) hard-block `status='suspended'` at sign-in (403 `ACCOUNT_SUSPENDED`, no user enumeration — same message shape as lockout); (2) for `pending_verification`: allow sign-in, set the access cookie, but include `emailVerified: false` in the signin response and have the web app (Phase 7) force the verify screen; **do not** hard-block now, because the verification email is console-only in dev and a hard block would strand users before Phase 2 ships real email — but record the hard block as a Phase 2 checkbox the moment Resend lands (the PRD's "unverified users cannot access platform features" is satisfied server-side by Phase 2 adding the gate; document this two-step in the ticket). Re-check status on `authMiddleware` too (a suspension during a live session should stop working at next request, ≤15 min via access-token expiry — acceptable; note in ticket).
- **Affected areas:** `src/services/auth/auth.service.ts`, `src/lib/errors.ts` (new `SuspendedError` → 403), `src/tests/auth/signin-enhanced.test.ts`.
- **Dependencies:** none.
- **Tests:** suspended → 403 (message ≠ lockout message to avoid leakage? both must be identical-class to avoid enumeration — use the same generic 401/403 shape as existing); reactivation clears suspension; pending_verification signs in and response flags verification state.
- **Verification:** tests green.
- **Acceptance criteria:** suspension is effective; verification state is machine-readable to the client.
- **Risk:** low. **Rollback:** revert.

#### NWB-P0-016 — Invitation accept flow (F-08)
- **Objective:** an invited email can become an active member: new users can register-into-the-org via the invite token; existing users can accept via token; the membership gets its role and `status='active'`.
- **Why:** F-08 — team onboarding is impossible; invites rot in `status='invited'`.
- **Current state:** `inviteMember`/`bulkInviteMembers` create invited rows + email link `${CORS_ORIGIN}/invite?token=…`; no accept endpoint, no token verification path for the invitee. **Update 2026-09-20 (F-20, fixed as a prerequisite):** the invite *send* itself was 500ing for everyone — the service wrote four columns that didn't exist on `organization_members` and inserted `user_id = NULL`, which the schema forbade. The token columns now exist and `user_id` is nullable (schema aligned to the service; see F-20 register entry). Residual F-20 work folded into this task: member list must `LEFT JOIN users` (pending invites are currently invisible) and pending invites need dedup on (org, email).
- **Required change:** add service `acceptInvitation(db, { token, password?, fullName? })`:
  - verify token (hash comparison against `organization_members.invitation_token_hash`, expiry, single-use: set `accepted_at`, null the token);
  - if the email already has a user: link `om.user_id`, activate; if the invitee is already a member elsewhere and D14 says single-org is retained, **refuse with a clear conflict** (do not silently re-home a user's primary org — that is the D14 decision); if D14 says multi-org, link and activate without touching `users.organization_id`;
  - if no user exists: create the user (reuse signup's user-creation block — **extract it into a shared helper** rather than duplicating) with `users.organization_id` = the inviting org (single-org model), activate membership, create the verification email (same link fix as F-09);
  - apply the invited `role_id`; audit `organization.member.accepted`.
  - Routes: `GET /api/auth/invitations/:token` (public — validate + reveal org name for the landing page, no user enumeration) and `POST /api/auth/invitations/:token/accept` (public, zod-validated, rate-limited per token+IP).
- **Affected areas:** `src/services/orgs/invitation.service.ts` (accept), `src/app/auth/` (new invitation routes), extracted signup helper, tests.
- **Dependencies:** D14 (multi-org or single-org on accept) — the task is designed so both answers are one branch each; **do not implement the multi-org branch until D14 says so.**
- **Steps:** (1) extract `createUserRecord` from signup; (2) accept service; (3) routes; (4) fix the invite email link base (`/invite?token=` is a *web-app* route — fine for Phase 7; keep, but the API validation endpoint lets the web app show org context before navigation).
- **Tests:** new-user accept (user created, org set, role applied, invited row activated, token single-use); existing-user accept (linked, activated); expired token 404; revoked (membership deleted) 404; double-accept 409; cross-org membership refused under single-org D14 answer; negative role checks per matrix.
- **Verification:** integration tests green; manual end-to-end with console email.
- **Acceptance criteria:** FR-AUTH-006 acceptance criteria met (7-day TTL, role assignment, single-use token).
- **Risk:** medium (auth-adjacent). **Rollback:** additive routes; revertable.

#### NWB-P0-017 — CORS origin config + single client-IP policy (F-13, F-10)
- **Objective:** CORS restricted to the configured origin(s); one trusted source of client IP used by auth middleware, sign-in rate limiting, and session recording.
- **Why:** F-13 open CORS; F-10 inconsistent/spoofable IP.
- **Current state:** `cors()` with no options (`src/server/index.ts:13,41`); `CORS_ORIGIN` in config but unused; three different header-reading sites.
- **Required change:** (1) `app.use("*", cors({ origin: config.CORS_ORIGIN }))` — allow a comma-separated list parsed in `config.ts` (keep single default for dev); (2) add `getClientIp(c, config)` in `src/lib/ip.ts` (extend existing `normaliseIp` module) implementing the documented deployment's trust model: behind nginx, take the **rightmost** untrusted→trusted hop of `X-Forwarded-For` per a `TRUSTED_PROXY_CIDRS` env (default: private ranges only — record in ticket; the CF-Connecting-IP branch is removed as a remnant since ADR-008/Infra is nginx+VPS, not Cloudflare); (3) use it in `authMiddleware.clientIp`, `signin.route`, and any Phase 4 public endpoints (document as the canonical helper).
- **Affected areas:** `src/server/index.ts`, `src/lib/config.ts`, `src/lib/ip.ts`, `src/server/middleware/auth.ts`, `src/app/auth/signin.route.ts`, `src/tests/` (client.test.ts, org-context.test.ts unaffected; add ip tests).
- **Dependencies:** none.
- **Tests:** pure unit tests for the IP policy (no proxy ⇒ direct address; private proxy chain ⇒ last client IP; public IP in chain ⇒ spoofed ⇒ reject/fallback policy documented); CORS: preflight from allowed origin 204, disallowed origin no ACAO header.
- **Verification:** tests green; manual curl preflight checks.
- **Acceptance criteria:** no cross-origin credentialed preflight succeeds from an unlisted origin; one IP helper, three call sites.
- **Risk:** low-medium (could break a dev setup that relied on `*`; dev default keeps localhost). **Rollback:** revert to `cors()`.

#### NWB-P0-018 — Make the CASL scoping decision explicit (F-06) — **DONE 2026-09-20**
- **Shipped:** the recommended minimal option. Condition removed from `loadAbility` (behaviour-identical: it was inert); `Security Architecture.md` §4.3 gained an as-built column and a new §4.3.1 stating the real chain, with RLS marked unimplemented pending D11 (so no "per D11" placeholder was needed and the doc is true today); CASL v7 trap pinned plus three DB-gated `loadAbility` assertions in `src/tests/auth/ability-scoping.test.ts`; `src/tests/route-invariants.test.ts` added — a static scan over `src/server/api/**` that fails any `:orgId` route not covered by `requireOrgMatch` (inline or via `router.use`), with a negative control so it cannot pass vacuously. Ticket: `.scratch/p0-foundation-gap/issues/18-casl-scope-cleanup.md`.
- **Objective:** the authorization story is true, documented, and pinned by a test — either the condition works or it is removed.
- **Why:** F-06: every rule carries `{organizationId}` that can never be evaluated in the current `requireAbility` pattern; security docs claim it works; future developers will be misled.
- **Current state:** `loadAbility` adds the condition; `requireAbility` checks string subjects; CASL v7 ignores conditions for string subjects (verified, §5 note).
- **Required change (recommended, minimal):** **remove the decorative condition from `loadAbility`** (rules become `can(action, subject)`), keep abilities loaded per (user, org) from that org's memberships (the real scoping mechanism), and (a) add a **regression test pinning CASL v7 behavior** (rule-with-condition + string subject ⇒ `can` true — i.e., documents the trap), (b) update `docs/technical/Security Architecture.md` §4.3 to state the true enforcement chain: JWT-derived org + org-match + service org predicates (+ RLS if D11 says yes), (c) add a **route-level invariant test**: for every route whose path contains `:orgId`, assert the middleware chain includes `requireOrgMatch` (static scan test over `src/app/**` — cheap, catches future IDOR by construction).
- **Alternative (rejected now, recorded):** pass `{organizationId}` objects from routes into `ability.can` for object-level checks — larger change surface, and object-level checks belong in the service layer where the org predicate already lives.
- **Affected areas:** `src/services/auth/ability.ts`, `src/server/middleware/rbac.ts` (doc comment), `src/tests/auth/ability-scoping.test.ts` (extend), `src/tests/route-invariants.test.ts` (new), Security Architecture.md.
- **Dependencies:** D11 (final wording of §4.3 waits for the RLS decision — write "per D11" placeholder until then, or sequence after D11 is recorded; D11 itself is a Phase 1 decision, cheap).
- **Tests:** the pin test; the route-invariant scan; existing rbac tests unchanged-green.
- **Verification:** `bun test` green; doc diff reviewed.
- **Acceptance criteria:** no code path relies on an inert condition; the scan test fails when a future `:orgId` route omits `requireOrgMatch`.
- **Risk:** low (behavior-preserving — the condition was inert). **Rollback:** revert.

#### NWB-P0-020 — Re-run the verification log (plan Appendix C) — **DONE**
- **Objective:** refresh every "last verified" number against the current tree with a live database.
- **Why:** the plan's test numbers (96/33 skip; 162 with DB) are dated 2026-09-13 and this sandbox could not execute them; the roadmap's baseline must be current.
- **Steps:** `bun install`; fresh PG (≥14); `db:push -- --force` (with `DB_*`); `bun run seed`; `bun test` (with and without `DATABASE_URL`); `bun run typecheck && bun run lint && bun run build`; record in Appendix C of the plan with today's date + HEAD.
- **Acceptance:** typecheck PASS, lint PASS (errors), build PASS, test 0 fail. Any failure becomes a Phase 1 defect ticket before anything else.
- **Risk:** none. **Rollback:** n/a.
- **Outcome (2026-09-20):** done — `.scratch/p0-foundation-gap/issues/20-rerun-verification-log.md`.
  Executed at HEAD `51c1a2d` against a **freshly created empty** PostgreSQL 14.23:
  `db:migrate` from zero PASS (1 migration, 30 tables), **re-run a no-op** (exit criterion 3
  evidenced), `seed` PASS and idempotent, `bun test` **395 pass / 0 fail** with a database and
  **222 pass / 184 skip / 0 fail** without one, typecheck PASS, `biome check .` **0 errors**,
  build PASS. No failure surfaced, so no new defect ticket. Appendix C now carries the measured
  table and the 2026-09-13 log is marked superseded; plan §1 and `01-discovery.md` refreshed
  (including 28 → **30** tables and three stale `src/app/*` route paths deleted in NWB-P0-026).
  **Deviation:** the ticket's `db:push -- --force` step was deliberately not used — NWB-P0-005/009
  replaced it with `db:migrate` as the evolution path; `db:push` is dev-convenience only.
  Exit criteria re-scored against evidence: 1, 2, 4, 6 met; **3 partly** (migration path proven,
  but CI still runs `db:push` — corrected after NWB-P0-022 read the workflow); **5 addressed by
  NWB-P0-019** (all four decisions now carry a status; D11/D12 recorded-but-undecided); **7 open**
  (branch protection, NWB-P0-022).

#### NWB-P0-002 — DSAR data export (plan ticket, open)
- **Objective:** any authenticated user (and admin on behalf) can request a machine-readable export of all personal data in their org; delivered within the NDPR window (PRD: 24h; Module 1 spec AC8).
- **Why:** NDPR/GDPR portability right; P0 exit gate item; launch compliance gate.
- **Current state:** no code (grep-verified); `unified_audit_log` + user/org tables exist.
- **Required change:** `src/services/users/dsar.service.ts`: on request, enqueue a job **when the Phase 2 queue exists**; for Phase 1 (no queue yet) implement a synchronous export behind the route (bounded: users' own data only, capped page size) and swap to the job in Phase 2 (record in ticket — do not build a bespoke worker). Export = JSON zip: profile, sessions, org memberships, user's audit rows (actor=self), API keys (masked), and — when modules exist — module data owned by the user. Route: `POST /api/users/me/data-export` (auth; audit `compliance.dsar.requested`), `GET /api/users/me/data-export/:requestId` (returns download until expiry). Admin variant under `/users/admin/:userId/data-export` (P14.13 surface).
- **Affected areas:** new service + routes + tests; `src/services/audit.ts` (read query — first read side; extends P1-002 scope).
- **Dependencies:** none (Phase 1 slice is sync; queue swap in Phase 2 is a follow-up ticket).
- **Tests:** export contains all expected sections; cross-tenant: admin in org A cannot export org B's user (403); request is audited; expired request 410.
- **Verification:** manual: sign up → request export → valid JSON; negative tests green.
- **Acceptance:** AC8 of FR-AUTH-007; audit events present.
- **Risk:** low-medium (bulk reads — cap at 10k rows per section with truncation marker). **Rollback:** additive.

#### NWB-P0-005 — Migration baseline (plan ticket, open; subsumes NWB-P0-009)
- **Objective:** a clean database reaches the current schema via committed, ordered migrations alone; `db:push` is no longer the evolution path; pg-boss schema is versioned alongside.
- **Why:** NWB-P0-009 (`db:push` 42P16, root cause: 81 `primaryKey()` without `.notNull()`) makes schema evolution unsafe and CI dependent on a fresh DB; every later phase adopts new schema (ground rule 7) — this is a **hard dependency for Phases 3–6**.
- **Current state:** no `drizzle/migrations/`; `drizzle.config.ts` points there; one dormant manual SQL file.
- **Required change:** (1) fix all 81 `uuid("id").primaryKey().defaultRandom()` declarations to include `.notNull()` across `db/` (mechanical, behavior-identical on PG — PK implies NOT NULL; eliminates the 42P16 diff); (2) `bun run db:generate` against the 28-table active schema to produce migration 0000; (3) add a `db:migrate` script (`drizzle-kit migrate`) and switch CI's `Push schema` step to `db:migrate` (idempotent, works on any DB state); (4) record the manual ADR-017 rename SQL in the ticket as "applies when pr/influencer are adopted — fold into that module's first migration"; (5) document the pg-boss schema bootstrap: pg-boss creates its own tables on `Bun` process start via its own `Schema` — the Phase 2 queue task must run `pgBoss.start()` idempotently and the migration baseline must note its schema is library-managed (record in `drizzle/README`); (6) delete nothing; `db:push` script stays for dev convenience, documented as non-idempotent.
- **Affected areas:** `db/**` (81 files touched mechanically), `package.json` (`db:migrate`), `.github/workflows/ci.yml`, `drizzle/` (new), AGENTS.md (Database section), plan Appendix C.
- **Dependencies:** none.
- **Steps:** as above, in order; each step CI-green before the next.
- **Tests:** (a) fresh DB: `db:migrate` + seed + `bun test` green (this *replaces* the fresh-DB requirement — also test `db:migrate` on an **already-migrated** DB: no-op, no error); (b) `db:push` on migrated DB now converges (42P16 gone) — verify and record; (c) migration test script: from-zero → current → test suite (this becomes the standing "migration verification" gate).
- **Verification:** CI green on both jobs with the new migrate step; Appendix C re-run (NWB-P0-020).
- **Acceptance:** clean DB + `db:migrate` + `seed` + `bun test` = green; re-run `db:migrate` = no-op; plan NWB-P0-009 closed.
- **Risk:** medium (touching 81 schema files). **Rollback:** one revert; schema files are compile-checked and CI-tested.
- **Note:** this is the single highest-leverage Phase 1 infrastructure task after the defect fixes — every later schema adoption depends on it.

#### NWB-P0-019 — Close out P0 bookkeeping (documentation) — **DONE**
- **Objective:** the issue tracker tells the truth.
- **Steps:** flip `p0-auth/spec.md` status (FR-AUTH-010 done; remaining: DSAR → P0-002, MFA login flow → P0-012, so keep `in-progress` with the accurate note until those land, then `done`); flip `foundation` spec to `done` (all 10 issues done — verify); record D13/D15 decisions + the D11 recommendation into `docs/business/Decision Log.md` as new DEC entries when made; update plan §1 (as-built baseline) with a "Last verified 2026-09-20" marker after Phase 1 lands.
- **Acceptance:** no `in-progress` ticket without an accurate one-line outstanding note (tracker convention).
- **Risk:** none.
- **Outcome (2026-09-20):** done — `.scratch/p0-foundation-gap/issues/19-p0-bookkeeping.md`.
  `p0-auth` flipped to **done** (10/10 FRs) after verifying API keys, MFA login and DSAR export
  are all in the tree; `foundation` was already done (NWB-P0-006). **D15 → DEC-040 (Approved):
  the MVP API ships unversioned**, closing discrepancy D-11 (doc rewrite stays in Phase 7).
  **D11 → DEC-O009 (Open, with a written recommendation)** — premise re-verified live (0 RLS
  policies, 0 tables with `relrowsecurity`, no RLS statement in the repo) and a defense-in-depth
  Phase 8 recommendation recorded, but **not approved**: implement-vs-supersede-ADR-009 is an
  architecture and procurement call. D12 remains a product call (memo written). Plan §1 marker
  was refreshed by NWB-P0-020.
  **Exit criterion 5 therefore reads "recorded" ✅ / "decided" ❌** — D11 and D12 still need a
  human.

#### NWB-P0-021 — Email link consistency (F-09, F-09b) — **DONE**
- **Objective:** every emailed link uses one server-decided base URL; no client header in security emails.
- **Steps:** add `APP_BASE_URL` to `config.ts` (default = `CORS_ORIGIN` for dev); replace `signup.ts:211` base with `APP_BASE_URL + "/api/auth/verify-email"`; replace `verification.route.ts`'s `c.req.header("origin")` with `APP_BASE_URL`; invite emails (Phase 1 P0-016) use `APP_BASE_URL + "/invite?token="` (web-app route); audit other `emailService.send` call sites for link bases (password-reset, email-change, MFA-notice).
- **Tests:** unit: emitted HTML contains `APP_BASE_URL`-based links; negative: with no client Origin header, links still absolute.
- **Acceptance:** zero client-controlled values in any emailed URL.
- **Risk:** none. **Rollback:** revert.
- **Outcome (2026-09-20):** done — `.scratch/p0-foundation-gap/issues/21-email-link-consistency.md`.
  `APP_BASE_URL` added (optional; derived `APP_BASE_URL_RESOLVED` defaults to `CORS_ORIGIN[0]`,
  strips trailing slashes, rejects a non-URL value at startup). The `origin` parameter was removed
  from `forgotPassword`/`sendVerificationEmail` entirely, so the two routes and the two Server
  Functions can no longer pass one; the three `CORS_ORIGIN[0]` services moved to the resolved base;
  signup now links to `/api/auth/verify-email`. Beyond the stated scope, the audit found the
  *unauthenticated* forgot-password route was the worst instance — a forged `Origin` delivered a
  **valid reset token** to an attacker-chosen domain (reproduced, now a regression test) — and that
  the Server Functions emitted relative links. `src/tests/email-links.test.ts`: 12 tests, verified
  red against the pre-fix service.

#### NWB-P0-022 — Branch protection + CI as a real gate — **BLOCKED (ops, needs repo admin)**
- **Objective:** merge to `main` requires green CI.
- **Current state:** workflow exists; "Branch protection on main is not yet configured, so CI currently reports without blocking" (AGENTS.md).
- **Steps:** configure GitHub branch protection (settings — not code): require status checks `quality` + `test` before merge on `main`; require PR (no direct push); record in AGENTS.md. (If the repo owner lacks settings access, file as an ops task with exact settings.)
- **Acceptance:** a red PR cannot merge.
- **Risk:** none.
- **Outcome (2026-09-20):** filed as an ops task with exact settings —
  `.scratch/p0-foundation-gap/issues/22-branch-protection.md`. Verified, not assumed: the agent
  token (`arena-ai-coding-agent[bot]`) reports `admin:false` and **403s on both reading and
  writing** branch protection; `rulesets` is empty, so `main` has **no protection of any kind**.
  The ticket records the click-through settings and the equivalent `gh api` call. **Use the check
  *names* `Typecheck, lint, build` and `Test (PostgreSQL)`, not the job ids `quality`/`test`** —
  GitHub matches required checks by reported name, so the ids would create a rule that can never
  be satisfied and would block every merge instead of gating on CI.

#### NWB-P0-023 — Organization deletion (PRD 8.2.1 P0; discrepancy D-14) — **DONE 2026-09-20**
- **Shipped:** `src/services/orgs/org-deletion.service.ts` (delete / reactivate / purge / status), `DELETE /api/orgs/:orgId` + `POST /api/orgs/:orgId/reactivate`, 20 tests. Cascades: memberships deactivated (not soft-deleted, so reactivation can tell them from an admin's own suspension), API keys revoked, all members' sessions revoked (and deliberately **not** restored on reactivation). Ownership checked against `organizations.owner_id`, not a role row (DEC-039). Billing block stubbed as `findBillingBlocker()` + `TODO(P13)`.
- **Found in its own design:** deletion suspends the owner's membership too, so `assertActivePrincipal` locked the owner out of the only route that undoes it — the 30-day grace would have been unreachable. Fixed with `authMiddlewareAllowingInactiveMembership`, a single-route relaxation of *only* the active-membership check, fenced in by four containment tests.
- **D16 follow-up measured and declined:** relaxing the account-deletion gate for sole-member orgs reintroduces F-25's 23503 (a soft-deleted org still holds the restrictive `owner_id` FK) — negative control test. The hard purge is the unblock; that sequence now works end to end.
- **Not scheduled:** `purgeExpiredOrganizations` has no runner, same as `purgeExpiredAccounts` (F-18); wire both with the Phase 2 queue. Ticket: `.scratch/p0-foundation-gap/issues/23-organization-deletion.md`.
- **Objective:** org owner/admin can delete their organization: soft-delete (30-day grace), sessions of all members revoked, memberships deactivated, audit, and a purge path when Phase 2's scheduler lands.
- **Why:** PRD P0 requirement absent from both code and the execution plan.
- **Required change:** mirror the account-deletion pattern (`src/services/users/account-deletion.service.ts` — soft delete + `scheduled_deletion_at` + reactivate + `purgeExpired*` function) for organizations: `deleteOrganization`, `reactivateOrganization`, `purgeExpiredOrganizations` (unscheduled until Phase 2, same as F-18). **Read F-24/F-25 first:** the pattern this ticket tells you to copy referenced a `users.scheduled_deletion_at` column that did not exist until NWB-P0-024, and its purge still cannot delete an organization owner (NWB-P0-025) — decide the ownership semantics here rather than inheriting them. Guards: only `owner` role (per D13); blocked while the org has active subscriptions (Phase 6 concern — stub the check as a no-op hook with a TODO referenced to P13, do not invent billing state); cascades: members deactivated, API keys revoked, sessions revoked.
- **Tests:** owner deletes → members 403 everywhere, org hidden from `listUserOrgs`; reactivate within grace works; purge function removes only expired; non-owner 403.
- **Acceptance:** PRD 8.2.1 AC (30-day grace, NDPR purge schedule honored by the purge function).
- **Risk:** medium (destructive surface) — soft-delete-only in Phase 1. **Rollback:** reactivate path.

### Phase 1 — cross-cutting requirements
- Every task: DoD per plan §2.1 (implementation, tests positive+negative, `bun test` green with DB, typecheck, lint, build, tenant isolation verified where org-scoped, authorization verified, audit event for mutations, docs updated).
- Coverage: begin enforcing the script-based coverage gate (85% services / 90% lib) on **Phase 1-touched files only** (the rest of the codebase gets the gate in Phase 2 once the queue services land — otherwise the gate is permanently red; this is the "graduated gate" pattern, recorded here).
- No new dependency may be added in Phase 1 (everything here uses existing ones; the pg-boss dependency arrives in Phase 2 with its ADR-028 justification).

**Phase 1 database changes:** 81 `primaryKey().notNull()` corrections (behavior-identical); migration 0000 baseline; `APP_BASE_URL` env; new error type (no schema).
**Phase 1 API changes:** +`POST /api/auth/mfa/verify-login`, +`GET/POST /api/auth/invitations/*`, +`POST /api/users/me/data-export`, +`GET /api/users/me/data-export/:requestId`, +org-deletion routes under `/api/orgs/:orgId` (delete/reactivate); no breaking changes to existing contracts.
**Phase 1 frontend/mobile changes:** none (no frontend exists).
**Phase 1 infrastructure changes:** branch protection; CI step swap `db:push → db:migrate`.

**Phase 1 exit criteria (all must be evidenced):**
> **Live numbers, re-measured 2026-09-20 at HEAD `51c1a2d` (NWB-P0-020 — executed, not carried
> forward): 395 pass / 0 fail with a live PostgreSQL 14.23; 222 pass / 184 skip / 0 fail without
> a database; `biome check .` 0 errors; typecheck and build clean.** Earlier counts in this
> document (96, 162, 325 …) are historical. CI is green on both jobs for PR #14 on the pinned
> `postgres:14` floor, so exit criterion 1 is met in CI and not merely locally. Criterion 3 is
> now evidenced **in part**: `db:migrate` was run against a freshly created empty database and then
> re-run as a no-op — but **CI still runs `db:push -- --force`**, so criterion 3's third clause is
> not met (NWB-P0-005's remaining step, blocked on the GitHub App's `workflows` permission —
> re-verified 2026-09-20 by a push that was remote-rejected). **Criterion 7 remains open** — branch protection (NWB-P0-022) is a GitHub
> *settings* change requiring repo-owner access, so CI still reports without blocking merges.
1. `bun test` green with a live DB, **including** the new suites: signup-owner-role, org-update positive+negative, MFA full flow, rate-limit windows, role-matrix self-protection, status enforcement, invitation accept, CORS/IP, route-invariant scan, DSAR, org deletion. (NWB-P0-020 re-run recorded.)
2. A fresh org owner can: invite a member → invitee accepts (new + existing user) → member acts with the invited role → role changes respect self-protection. **This end-to-end sequence is the Phase 1 demo.**
3. `drizzle/` migrations take a clean DB to current schema; re-run is a no-op; CI uses `db:migrate`. — **Partly met:** the first two clauses are evidenced (NWB-P0-020, against a freshly created database); **CI still runs `db:push -- --force`** — NWB-P0-005's last step, blocked on the GitHub App's `workflows` permission.
4. DSAR export returns a valid machine-readable payload.
5. D12, D13, D11, D15 recorded in the Decision Log with status. — **Met as written (all four carry a status as of NWB-P0-019: D13 DEC-039 Approved, D15 DEC-040 Approved, D11 DEC-O009 Open+recommendation, D12 open+options memo). Note: two of the four are recorded-but-undecided; if the intent was "all four decided", D11 and D12 remain outstanding and need a human decision.**
6. No Critical/High defect from §5 remains open (F-01…F-05, F-07, F-08, F-12 closed; F-06 closed by documentation+test; F-09/F-10/F-13 closed).
7. AGENTS.md "Last verified" marker refreshed; plan §1 refreshed.

---

