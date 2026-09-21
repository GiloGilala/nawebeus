# NWB-P0-031 — Password-change corruption locked users out of account recovery (F-28), and the Phase 1 coverage gate

**Status:** done — 2026-09-21 (verified locally: typecheck + `bun run lint` exit 0 +
build + **447/447** `bun test` with a live database). **One step blocked:** the CI
step that runs the coverage gate cannot be pushed (same `workflows` permission
limit as NWB-P0-005 / NWB-P0-022) — see "CI wiring" below.

- **Epic:** p0-foundation-gap
- **Fixes:** **F-28** (new — Critical)
- **Implements:** Phase 1 cross-cutting requirement — the graduated coverage gate
- **Size:** M
- **Depends on:** —

## How this was found

Not from the defect register. With F-14 closed, the remaining defects were all
later-phase or blocked on repo-admin credentials, so I went to the Phase 1
**cross-cutting** requirements instead — where the coverage gate ("85% services /
90% lib") was specified, never implemented, and tracked by no ticket.

Measuring coverage to size that work produced the real find. `src/services` sat at
83.8%, and the worst file in the tree was **`password-history.ts` at 10.3%** — the
module that implements password-reuse prevention. Untested security code is usually
either unreachable or wrong. This was wrong.

## F-28 — three defects in one function, one of them Critical

`changePassword` (`src/services/auth/auth.service.ts`):

```ts
const hashed = await hashPassword(newPassword);
const newHistory = await recordPasswordChange(db, userId, hashed);  // hashes it AGAIN
await db.execute(sql`UPDATE users SET password = ${hashed},
    password_history = ${JSON.stringify(newHistory)}::jsonb ...`);  // a STRING into a jsonb ARRAY
```

1. **Double hashing.** `recordPasswordChange` takes *plaintext* — it hashes
   internally and writes `password`, `password_history` and
   `last_password_change_at` itself. It was handed a bcrypt digest.
2. **Corrupted history column.** It returns the new hash as a **string**; that
   string was written into `password_history`, which is a jsonb **array**. After
   one password change the column held `"$2b$10$..."` instead of `["$2b$10$..."]`.
3. **The history rule was never applied here.** BR-AUTH-022 / AC3 (module spec
   §321: *"System validates new password (complexity + not in last 5 passwords)"*)
   was enforced on the reset path only. A user could cycle straight back to an old
   password through the change endpoint.

**Why (2) is Critical rather than cosmetic.** `Bun.password.verify` **throws**
`UnsupportedAlgorithm` on a hash it cannot parse — it does not return `false`. A
bare string is also iterable, so `for (const hash of history)` walked it one
*character* at a time and threw on the first. That exception propagated out of
`isPasswordInHistory`, which the **password-reset** flow calls before setting a new
password. Net effect:

> **Any user who ever changed their password could never reset it again.** Account
> recovery was permanently dead for exactly the security-conscious users who rotate
> their passwords.

Reproduced end to end before fixing:

```
change password → request reset → resetPassword()
  ⇒ Error: Password verification failed with error "UnsupportedAlgorithm"
control (user who never changed their password)
  ⇒ reset succeeds
```

## The fix

- `changePassword` now passes **plaintext** to `recordPasswordChange` and lets it
  own all three columns; the redundant second `UPDATE` is gone.
- `changePassword` checks `isPasswordInHistory` first and throws `ConflictError`
  (409) — the same rule and message as the reset path.
- **Hardened both sides of the data shape**, because rows written before this fix
  still carry the bad value in a real database:
  - `isPasswordInHistory` treats a non-array as "no history", and wraps each
    `verify` in try/catch so an unparseable entry is *skipped* rather than fatal.
    Bad data must not be able to disable account recovery again.
  - `recordPasswordChange` filters to strings before spreading. Spreading the
    corrupt bare string would otherwise splice the hash into ~60 single-character
    "passwords" and silently destroy the history.

Defence in depth is deliberate: the mutation run below shows the hardening alone
prevents the lockout even with the `changePassword` bug reintroduced.

## Root cause of the blind spot — the test factory

`createTestUser` inserted a user **without** `password_history`; the real signup
insert (`createUserRecord`, `src/services/auth/user-record.ts`) seeds it with the
initial digest. Every test user therefore started with an empty history, which
silently exempted the whole suite from BR-AUTH-022 — a rule cannot be observed
against a user who has no history. Combined with `changePassword` having **zero**
tests, nothing could see any of this.

The factory now seeds `password_history` exactly as signup does. All 432
pre-existing tests still pass with the more realistic fixture.

## Tests — `src/tests/auth/password-history.test.ts` (15)

- the stored hash verifies against the **plaintext the user typed** (the
  double-hash catch), and the old password stops working;
- `password_history` stays a jsonb array of strings;
- reuse is refused on the **change** path (service and HTTP 409), and still on the
  reset path — the fix must not weaken the rule into a no-op;
- **F-28 regression:** change password → reset still works;
- history caps at 5, and the aged-out password becomes usable again — asserted
  rather than left implicit, since that is what *bounded* history means;
- corrupt-data hardening: a bare-string history degrades to "no history"; a junk
  entry does not mask a real match after it; a corrupt history is *repaired* to a
  1-element array rather than spread character-by-character;
- wrong current password still rejected; endpoint still requires auth.

**Mutation-checked.** Reintroducing the original `changePassword` body fails 6 of
them. Reverting the `password-history.ts` hardening *as well* reproduces the
`UnsupportedAlgorithm` lockout in the regression test. Both reverts were undone and
verified.

Coverage effect: `src/services` **83.8% → 89.9%**, which is why the gate below could
be set at the documented 85% instead of a lowered floor.

## The coverage gate

`src/scripts/check-coverage.ts` + `bun run coverage` / `bun run coverage:check`.

A script, not `bunfig.toml` — NWB-P0-003 verified empirically that Bun's
`coverageThreshold` is per-file, is enforced only when the `text` reporter is on,
prints no failure message, has no missing-file guard, and **silently accepts
unknown keys**, so the config the standards doc proposes (`{ services = 85,
lib = 90 }`) exits 0 forever and checks nothing. The danger is a green build
everyone believes is gated.

This gate aggregates line coverage per directory from `coverage/lcov.info`:

```
✓ src/services/     89.9% (2800/3116 lines, min 85%)  [27 files]
✓ src/lib/          95.8% (711/742 lines, min 90%)  [12 files]
```

Graduated on purpose: only the two directories the standards doc names are gated.
Widening it to routes/server-functions belongs in Phase 2 with the queue services —
enabling it now would be permanently red, which just teaches everyone to ignore it.

It includes the **missing-file guard** `coverageThreshold` cannot express: if no
file under a gated prefix appears in the report, that is a failure, not a pass.
Otherwise deleting a test suite reads as a coverage *improvement*. On failure it
names the five worst files with their line ratios.

Verified all four failure modes exit 1 — threshold breach, absent gated directory,
missing `lcov.info`, empty report — and the healthy case exits 0.

## CI wiring — blocked, same cause as NWB-P0-005

The gate is **not** yet a CI step: `.github/workflows/ci.yml` cannot be pushed by
the Arena GitHub App (`refusing to allow a GitHub App to create or update workflow
... without workflows permission`), re-confirmed on 2026-09-20. The step to add,
once a human with repo access can commit it, is:

```yaml
- name: Coverage gate
  run: bun run coverage && bun run coverage:check
```

Until then the gate is runnable locally and by any maintainer, but it does not
block a merge. Recording this so the gate is not mistaken for enforced — the exact
failure mode the original investigation warned about.

## Docs updated

- `02-defects.md` — **F-28** registered (Critical) and marked closed.
- `AGENTS.md` — coverage commands and the gate's thresholds; test counts.
- `docs/agents/local-database.md` — test counts.
