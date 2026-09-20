# NWB-P0-016 — Invitation accept flow (F-08)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 341/341 `bun test`
with a live database, 208 pass / 140 skip / 0 fail without one; CI run on this branch's PR)
**Source task:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-016.
**Module spec:** FR-AUTH-006 (`docs/modules/Authentication & User Management.md` §3.6).
**Deps:** D14 — Phase 1 proceeds with the single-org branch (interim answer, option (a));
the multi-org branch is deliberately **not** implemented. **Size:** M.
**Fixes:** F-08 (no invitation-accept path). Also lands the residual F-20 work folded into
the task (member list `LEFT JOIN users`; pending-invite dedup on (org, email)) and closes
the invite-time F-07 class (role granted at invite with no hierarchy check).

## Current state (verified 2026-09-20 at `6039d67`)

- `inviteMember` / `bulkInviteMembers` create `status='invited'` rows and email a link
  (`${CORS_ORIGIN}/invite?token=…`). **No accept service or route exists** — every
  invitation rots; team onboarding is impossible (S-02, Critical).
- The invite row **does not store the invitee's email** when the invitee has no account
  (`user_id` NULL, no email column) — dedup on (org, email) is impossible and the accept
  flow could not know who the invitation was for. `inviteMember`'s dup-check `JOIN users`
  therefore only sees invites of *existing* users; repeat invites to a new email create
  duplicate pending rows.
- `listMembers`/`getMember` `JOIN users` — pending invites are **invisible** in the member
  list (FR-AUTH-006 AC5).
- **F-07 class at invite time:** `inviteMember` writes `organization_members.role_id`
  straight from `roleId` — no `resolveAssignableRole`, no hierarchy check. Anyone with
  `members.create` could invite with *any* role UUID, including `owner` or `super_admin`
  (the grant would take effect the moment an accept path existed). A bogus UUID 500s on
  the FK. Invite without `roleId` stores NULL — F-01's zero-permission member at accept.
- Spec drift to record: FR-AUTH-006's "Role Assignment Permissions" table lets an Owner
  invite with the **Owner** role. **DEC-039 (D13, approved, implemented in role-policy.ts)
  supersedes it**: Owner is transferred, never granted. Invites follow DEC-039. The
  module-spec error strings ("This user is already a member…", "This invitation has
  expired…") are kept where they don't weaken enumeration-safety.

## Design

**Schema (`organization_members`)** — add `invited_email varchar(255)` + index. The
invitation's addressee lives on the row, not only in the email that was sent.

**Invite (`inviteMember`)**
- Always write `invited_email`; dedup pending invites on `(organization_id, invited_email,
  status='invited', deleted_at IS NULL)` (refresh rotates token + TTL in place).
- Refuse inviting an email that is already an **active** member of this org:
  409 "This user is already a member of your organization" (spec string).
- Role: `roleId` omitted → default to the system `viewer` role (lowest tier, fail-closed;
  InternalError if the catalog is unseeded — same posture as signup's owner guard).
  Provided → `resolveAssignableRole` (404 for cross-tenant/missing) + new pure
  `assertRoleGrantAllowed({actor, newRole})` in role-policy.ts (`owner` never grantable;
  actor must strictly outrank the granted role). `requireActorRole` proves the inviter is
  an active member. `assertRoleChangeAllowed` is refactored to call the new helper, so
  invite and assign-role enforce one ladder.

**Accept — `GET /api/auth/invitations/:token`** (public, rate-limited 20/30 min/IP)
Validates the token and returns only what the landing page needs:
`{ organizationName, invitedEmail, expiresAt, requiresAccountSetup }`. Errors are 404s
with FR-AUTH-006's strings — unknown/revoked: "This invitation is no longer valid.";
expired: "This invitation has expired. Ask your admin to send a new invitation."

**Accept — `POST /api/auth/invitations/:token/accept`** (public, zod, rate-limited
10/30 min per token+IP; body: `password?`, `fullName?`, `termsAccepted?`,
`privacyAccepted?`, `marketingOptIn?`)

All writes in `withAtomicWrites`:
1. Lookup by `invitation_token_hash`; unknown → 404 "no longer valid".
2. `accepted_at` set → 409 "This invitation has already been accepted."
3. `expires_at <= now()` → 404 "expired…". Claim single-use atomically
   (`UPDATE … WHERE accepted_at IS NULL`) → concurrent second accept → 409.
   Raw `invitation_token` is nulled on claim; the hash stays for the double-accept 409
   and auditability.
4. **No user for `invited_email`** → registration-into-org: require `password`,
   `fullName`, `termsAccepted`, `privacyAccepted`; complexity via `validatePassword`;
   user created (status `pending_verification`, `users.organization_id` = inviting org —
   single-org model) via `createUserRecord`, **extracted from signup into
   `src/services/auth/user-record.ts`** (username/name/email-verification-token helpers
   shared, not duplicated); verification email sent post-commit (same CORS_ORIGIN[0] link
   base as signup until NWB-P0-021).
5. **Existing user** → D14 single-org (option a): any **active** membership in *another*
   org → 409 conflict naming the limitation (no silent re-home of the primary org).
   Already active *here* → 409 "already a member". Otherwise (org-less account): link
   `user_id`, set `users.organization_id`, activate. Multi-org branch explicitly not built.
6. Membership `status='active'`, `is_active=true`, role = the (now always present) invited
   `role_id` (legacy NULL falls back to `viewer`, never a zero-permission member).
7. Audit `organization.member.accepted`.

**Member list (residual F-20)** — `listMembers` + `getMember` `LEFT JOIN users`, email =
`COALESCE(u.email, om.invited_email)`, `userId`/`username` become nullable in
`MemberProfile`. Pending invites visible (AC5).

**Deliberately out of scope** (recorded, not silently dropped): org user-limit refusal
(FR-AUTH-006 AC6 — needs plan/billing infra); a Server Function for accept (the web layer
is a shim and accept is a public, unauthenticated flow — the public API is the contract);
multi-org accept (D14 final call); org-limit + CSV>50 guards (bulk cap is already 50 in
zod… verify); ownership transfer (NWB-P0-023) and its gate-relaxation note from D16.

## Tests (`src/tests/orgs/invitation-accept.test.ts`)

validate-endpoint good/bad token; new-user accept end-to-end (user created in org, role
applied, membership active, verification token row, **can sign in** while
`pending_verification`); missing password for new user → 422; expired → 404; revoked →
404; double-accept → 409; existing org-less user → linked+activated; existing user with
another org (personal-org signup) → 409; invite negative matrix (owner role → 403,
outranking role → 403, bogus uuid → 404, no roleId → viewer default); already-a-member
invite → 409; dedup repeat invite (one row, rotated token, old token dead); listMembers
shows pending invite via LEFT JOIN; accept rate limit 429s after budget.

## Acceptance criteria

- [x] FR-AUTH-006: 7-day TTL default (`DEFAULT_INVITE_TTL_HOURS`), role assignment per
      DEC-039 ladder, single-use token, 404-with-clear-message for expired/revoked,
      pending invites visible in list (AC5)
- [x] `bun test` green with DB; typecheck + biome + build clean — 341 pass / 0 fail
      (327 + 14 new), both DB and no-DB modes

## What was built (2026-09-20)

| Layer | File | Change |
| --- | --- | --- |
| Schema | `db/organization/organization-members.ts` | `invited_email varchar(255)` + index — the invitation's addressee of record |
| Shared helper | `src/services/auth/user-record.ts` (new) | `createUserRecord` + `createEmailVerificationToken` + username/name helpers, extracted from `signup` (task step 1) — signup now calls them, behavior unchanged (87 signup/org tests unchanged) |
| Invite | `src/services/orgs/invitation.service.ts` | `invited_email` written always; pending-invite dedup on (org, email); already-an-active-member → 409 (spec string); role ladder enforced at grant time (`resolveAssignableRole` + new pure `assertRoleGrantAllowed`, owner never grantable); omitted `roleId` → system `viewer` default; invite email now sent to *existing* users too and names the org |
| Accept | same file | `getInvitationByToken` (landing-page preview) + `acceptInvitation` (atomic single-use claim → register-into-org or link existing account; D14 single-org 409; viewer fallback for legacy NULL roles; audit `organization.member.accepted`) |
| Policy | `src/services/orgs/role-policy.ts` | new `assertRoleGrantAllowed` (rules 1+4 without a target member); `assertRoleChangeAllowed` refactored to call it — one ladder for invite and assign-role |
| Routes | `src/server/api/auth/invitation.route.ts` (new) | `GET /api/auth/invitations/:token` (public, 20/30 min/IP) and `POST /api/auth/invitations/:token/accept` (public, 10/30 min per token+IP); mounted in `src/server/api/auth/index.ts` |
| Member list | `src/services/orgs/member.service.ts` | `listMembers` + `getMember` `LEFT JOIN users`, `COALESCE(u.email, invited_email)`, `userId`/`username` nullable in `MemberProfile`; pending-invite role change via PATCH refused with a clear 422 (re-invite with the new role instead) |
| Tests | `src/tests/orgs/invitation-accept.test.ts` (new) | 14 DB-gated tests — see the list in the ticket body |

Recorded deviations / scope notes:

- **FR-AUTH-006's invite-permissions table says Owner can invite with the Owner role.
  DEC-039 (D13) supersedes** — Owner is transferred, never granted — so invites follow
  the DEC-039 ladder. The module spec's error *strings* are kept where they don't weaken
  enumeration-safety (expired vs. revoked are distinct messages, both 404).
- Invitations to **existing accounts** are now emailed too (previously only account-less
  emails got a link — that stranded every existing-account invitee once an accept path
  existed).
- Accept for an existing account requires no password — token possession is the proof
  (the link went to their inbox), matching the module spec's step 9a. The single-org 409
  covers the dangerous case.
- Out of scope (recorded): org user-limit refusal (FR-AUTH-006 AC6 — needs billing/plan
  infra); a Server Function for accept (public unauthenticated flow; the web shim has no
  anonymous-auth path); the multi-org accept branch (D14 final call); `members.bulk_invited`
  audit stayed summary-level.

## Comments

- 2026-09-20 — Claimed and implemented as specced above. Verification: fresh embedded
  PostgreSQL 14.23 (CI floor); **341 pass / 0 fail** across 38 files with a live
  database; without `DATABASE_URL` 208 pass / 140 skip / 0 fail. The 87 pre-existing
  signup/org/deletion tests pass unchanged after the `createUserRecord` extraction.
  One test of mine caught my own over-strict assertion (invite rows pre-link `user_id`
  for existing accounts) — the meaningful post-409 invariant asserted instead:
  `accepted_at` stays NULL (rollback restores the single-use claim). The rate-limit
  test proves the 11th accept attempt in a window 429s.
