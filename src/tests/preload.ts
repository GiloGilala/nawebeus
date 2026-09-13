/**
 * Runs once before any test file (wired up in bunfig.toml → [test].preload).
 *
 * Every test file shares one `process.env`. A number of suites used to set
 * placeholder secrets in `beforeAll` and then unconditionally `delete` them in
 * `afterAll` — which stripped the values from every suite that ran afterwards,
 * so `describe.skipIf(!hasDb())` quietly turned database tests off and
 * config-dependent routes started throwing. Supplying the two secrets that are
 * always required, in one place, removes the need for each file to guess.
 *
 * These values are intentionally DIFFERENT from the placeholders the suites use
 * inline, so a suite's `afterAll` can tell "I set this" from "the environment
 * provided this" and only remove its own.
 *
 * `DATABASE_URL` is deliberately NOT defaulted here: the database suites are
 * gated on it, and inventing a value would convert every clean skip into a
 * connection failure.
 */
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-0123456789abcdef";
