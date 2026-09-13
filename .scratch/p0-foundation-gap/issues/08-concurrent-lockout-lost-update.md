# NWB-P0-008 — Concurrent sign-in lockout is a lost update

**Status:** done — fixed 2026-09-13
**Verification:** the new concurrency test was made to fail against the old code first
(counter stuck at 1, no lock, 3/3 fail) and pass against the new (3/3), so it is real coverage
rather than a test that agrees with whatever is there. Full suite 162 pass / 0 fail with a live
database (was 159).
**Deps:** none. **Size:** S. **Blocks:** nothing mechanically, but it weakens a security control.

## The bug

`signIn` (`src/services/auth/auth.service.ts`) implements the BR-AUTH-018 lockout as
read-modify-write:

1. `SELECT failed_login_attempts, locked_until FROM users WHERE …`
2. `await verifyPassword(…)` — a deliberate, slow bcrypt comparison
3. `UPDATE users SET failed_login_attempts = <value read in step 1> + 1 …`

There is no row lock, no `SELECT … FOR UPDATE`, and no atomic
`SET failed_login_attempts = failed_login_attempts + 1`. Between steps 1 and 3 the code awaits
bcrypt, which is exactly the window an attacker wants.

## Impact

**N concurrent wrong-password requests against the same account count as one failure.** All N
requests read the same starting value in step 1, all compute the same increment, and the last
write wins. The account never reaches the threshold, so the lockout never engages.

This is not theoretical. It is directly reproducible, and it was discovered because a test
proved it: `src/tests/auth/signin-enhanced.test.ts` fired five attempts with `Promise.all` and
the account stayed unlocked. The test was rewritten to fire the five attempts **sequentially**
so the threshold is reached.

> That rewrite makes the test pass. It does **not** fix the bug — it removes the coverage that
> caught it. Treat this ticket as the real fix and the sequential test as a placeholder.

Against a parallelised credential-stuffing run — the exact threat a lockout exists to stop —
the control is inert. A serial attacker is still locked out, so this degrades the control
rather than removing it, but the degradation is in the direction that matters.

## Proposed fix

Make the increment atomic in the database and let the database decide whether the threshold was
crossed, rather than deciding in application code:

```sql
UPDATE users
   SET failed_login_attempts = failed_login_attempts + 1,
       locked_until = CASE
         WHEN failed_login_attempts + 1 >= $threshold
           THEN now() + ($lockout_interval)::interval
         ELSE locked_until
       END
 WHERE id = $userId
RETURNING failed_login_attempts, locked_until;
```

The threshold comparison then reads from `RETURNING`, which is the post-increment truth for
*this* statement under any interleaving.

Alternative: `SELECT … FOR UPDATE` at step 1 to serialise attempts on the account. Correct, but
it holds a row lock across an intentional bcrypt delay — a self-inflicted contention point, and
an easy way to turn a lockout into a denial of service against a legitimate user. Prefer the
atomic `UPDATE … RETURNING`.

## What was done

`src/services/auth/auth.service.ts` now increments atomically and reads the decision back from
`RETURNING` (the shape proposed above), with two deliberate additions:

- **`failed_login_attempts` was dropped from the opening `SELECT`.** It is no longer needed, and
  leaving it in the result invites someone to use it — which is how the bug was written in the
  first place. The column is now only ever read from a `RETURNING` clause.
- **`account_locked_until` is computed in SQL as
  `now() + (${LOCKOUT_DURATION_MS}::int * interval '1 millisecond')`**, so the lockout duration
  still has one source of truth and the database's clock is authoritative. The `::int` casts are
  load-bearing: without them Postgres cannot infer the parameter types and the statement fails.

Coverage landed in a new file, `src/tests/auth/signin-lockout-concurrency.test.ts`, rather than by
rewriting `signin-enhanced.test.ts` to `Promise.all`. The sequential test stays as-is (it is a
valid test of the sequential path), and the concurrency case is separate and self-describing —
which is what makes it obvious why it exists if it ever fails again:

1. five concurrent wrong passwords leave `failed_login_attempts = 5` and set `locked_until`
2. a locked account refuses the *correct* password
3. a successful sign-in resets the counter and clears the lock without racing

`withTestDb` uses a single pooled connection, so the five `Promise.all` attempts interleave at the
bcrypt await exactly as an attacker's would — pg queues the statements but the application awaits
between them, which is the whole window.

## Definition of done

- [x] Five **concurrent** wrong-password requests leave `failed_login_attempts = 5` and set
  `locked_until`.
- [x] The `signin-enhanced` lockout test is restored to `Promise.all` (or gains a second concurrent
  case alongside the sequential one) so the regression cannot come back silently.
- [x] A concurrent test proves a *successful* sign-in still resets the counter without racing.
- [x] `bun run typecheck` clean; full suite green with a live database.

## Notes

- The same read-modify-write shape appears wherever counters are maintained in application code
  — worth a sweep, not just a local fix. `src/lib/rate-limit.ts` is **not** affected: it uses an
  `INSERT … ON CONFLICT DO UPDATE` with an atomic `count = count + 1`.
- `rate_limits` had its own, different problem (the table did not exist at all) — fixed
  2026-09-13, see `../spec.md`.
