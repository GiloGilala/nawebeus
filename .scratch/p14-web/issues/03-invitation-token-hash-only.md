# NWB-P14-003 — Persist invitation credentials as hashes only

Type: task
Status: in-progress — implementation is complete; DB tests/typecheck/lint await Bun availability in this sandbox.
Phase: P14.2 follow-up
Blocked by: none

## Finding

F-P14.2 in `issues/02-invite-and-team.md`: `organization_members.invitation_token` stored the
live invitation credential in plaintext, even though lookup already used
`invitation_token_hash`. The raw column was never read; it increased the impact of database dumps,
replicas, and accidental broad reads without providing functionality.

## Scope and implementation

- Remove the raw-token column from the Drizzle model and drop it with migration
  `0014_invitation_token_hash_only.sql`.
- Stop writing the raw credential on invite/re-invite and stop clearing it during acceptance.
  Keep the raw value only in process memory to create and send the invitation link; store the
  existing SHA-256 digest for lookup and single-use behavior.
- Preserve existing invitation links and acceptance behavior: active links remain valid because
  their hashes are retained; expired and accepted invitations still follow the existing lifecycle.
- Add regression coverage proving the persisted value equals the hash of the sent token and that
  `organization_members` has no `invitation_token` column. Update re-invite and acceptance tests.
- Do not change the invite Server Function response in this ticket. Its separate raw-token RPC
  exposure is F-P14.2-2 and remains open.

## Verification

Static checks passed: `git diff --check`; migration journal/snapshot chain and the snapshot's
single-column delta were validated. The following remain unrun because Bun (and PostgreSQL tooling)
is unavailable in this execution environment: `bun test
src/tests/orgs/invitation-accept.test.ts src/tests/orgs/invitation-expiry.test.ts`, `bun run
typecheck`, `bun run lint`, and applying the migration against PostgreSQL.
