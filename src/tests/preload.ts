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
import { logger } from "../lib/logger";

process.env.JWT_ACCESS_SECRET ??= "test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-0123456789abcdef";

/**
 * The real JSON-to-stderr writers, captured before the run-wide silence below.
 * The shared `logger` object is silenced for the whole run (NWB-P1-012): since
 * the request-context middleware, every `app.request()` writes an access-log
 * line, and hundreds of JSON lines would bury the test output. Tests that care
 * about log content `spyOn(logger, …)`; the logger's own suite calls these
 * captured originals so the real writer stays exercised and covered.
 */
export const realLogWriters = { ...logger };

logger.debug = () => {};
logger.info = () => {};
logger.warn = () => {};
logger.error = () => {};
