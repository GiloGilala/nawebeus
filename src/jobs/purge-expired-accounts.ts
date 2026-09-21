/**
 * Hard purge of expired accounts (NWB-P1-001 closing F-18).
 *
 * Phase 1 built the whole lifecycle — `deleteAccount` stamps a 30-day window, `reactivateAccount`
 * can undo it, `purgeExpiredAccounts` performs it — and left the last step with no caller, so the
 * clock ran out and nothing happened. This is that caller.
 *
 * The job is deliberately a *scheduler*, not a reimplementation: it calls the same service
 * function the admin surface would, so the erasure semantics have exactly one source of truth.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { purgeExpiredAccounts } from "../services/users/account-deletion.service";

export const purgeExpiredAccountsJob: JobDefinition<null> = {
  name: QUEUE_JOBS.purgeExpiredAccounts,
  description:
    "Hard-delete accounts whose 30-day deletion grace window has elapsed (F-18, NDPR erasure).",
  audit: {
    action: "accounts.purged",
    // Erasure of personal data is a compliance event first and an operational one second; the
    // row's existence is what an NDPR enquiry asks for.
    category: "compliance",
    resourceType: "user",
  },
  async handle({ db }) {
    // Idempotent at the source, which is why at-least-once delivery is safe here: the service
    // selects only rows whose window has elapsed, so the second run of a night finds nothing.
    //
    // Per-row since NWB-P1-013: a user who still owns an organization hits the restrictive
    // `organizations.owner_id` FK (F-25 / D16) and lands in `failed` with the 23503, instead of
    // aborting the whole statement and holding every other expired account hostage for the night.
    // Running the organization purge first in the same hour (`src/lib/scheduler.ts`) is still
    // what clears that reference in practice; the isolation itself belongs in the service, not in
    // a job wrapper here. A nonzero `failed` makes this run's audit row `warning` (the wrapper's
    // partial-run convention), so a night that erased nothing-but-tried never reads as clean.
    const result = await purgeExpiredAccounts(db);
    return { deleted: result.deleted, failed: result.failed, errors: result.errors };
  },
};
