# Reference only — a superseded parallel implementation of NWB-P2-006

**Nothing here is compiled, tested, imported or shipped.** These files are kept as provenance, not
as source. `src/` and the test suite are the truth.

On 2026-09-26 the Arena session `arena/01a0d8fe-nawebeus` was resumed in a sandbox that had been
re-cloned at `e9bc730` — the commit *before* PR #23 merged NWB-P2-006 on 2026-09-25 — so its
context said the ticket was still open. It built a second, independent implementation of the same
ticket. That work was **not** merged: `main`'s version (PR #23, `issues/06-routes.md`) stands,
including its permission model (`socialaccounts.read` everyone / `.usage` manager+ /
`.disconnect` admin-only, with `usage` and `disconnect` added to the CASL verb union).

Reading the two side by side is what produced **`../issues/07-lifecycle-gaps-and-bug-fixes.md`**,
which is where the useful parts of this tree actually landed — adapted to `main`'s shapes rather
than lifted:

| From this tree | Where it landed |
|---|---|
| Pause / resume, on-demand health-check probe, per-account usage, `?attention=true`, `?dryRun=true` impact preview | `src/services/social/service.ts` + `src/server/api/social/social.route.ts` (NWB-P2-007) |
| `SocialNotifier` port over the P1-004 email channel (FR-SOC-008 / FR-SOC-022) | `src/services/social/notifier.ts` |
| X (Twitter) RFC 7009 revocation dialect; revoking the refresh token as well as the access token | `src/services/social/adapters/twitter-x.ts`, `disconnectAccount` |
| The `markNeedsReauth` transition guard and the reconnect-clears-the-breaker fix | `src/services/social/service.ts` (bugs B1/B2 in the ticket) |
| Test techniques: scanning every serialized body for token material, the recording notifier, the throwing notifier, keyset/tenant/RBAC matrices | `src/tests/social/lifecycle.route.test.ts` |

Deliberately **not** taken from this tree: its permission mapping (`socialaccounts.delete` on the
`contentApproval` tier — `main`'s `disconnect`-on-admin-only is closer to Module 3 §6.2), its
`src/lib/validation/social.schemas.ts` (main validates inline at the route, with `patternParam`),
its `SOCIAL_DISCONNECT_RETENTION_DAYS` env knob (main has the constant `DISCONNECT_RETENTION_DAYS`),
and its `PlatformOAuthClient.revokeToken` (main calls the adapter hook from the service).

## Contents

- `p2-006-parallel-work.patch` — `git diff` of the whole parallel worktree against `e9bc730`
  (2 473 lines, 28 files).
- `new-files/accounts.route.test.ts` — its 30-test route suite (written against its own shapes).
- `new-files/notifier.ts` — the first draft of the notifier port.
- `new-files/social.schemas.ts` — its Zod schemas (not adopted).
- `new-files/06-routes-and-rbac.md` / `06-routes-and-rbac.md` — its ticket file, including the
  five findings it recorded; the two that were real bugs on `main` are B1/B2 in `issues/07`.

Also in the session's git history: `git stash list` entry *"parallel P2-006 implementation"* holds
the same tree if a file-level diff against `main` is ever needed.
