/**
 * Hourly expiry of stale approval requests (NWB-P1-003).
 *
 * A request nobody acted on inside its window is closed as `expired` rather than left pending
 * forever: the requester's inbox stops lying about a decision that is not coming, and the
 * per-entity pending slot is freed so a resubmit can happen. The window is set at request time
 * (7 days by default; see `APPROVAL_DEFAULT_EXPIRY_DAYS`); this job only enforces it.
 *
 * Like the purge jobs it is a *scheduler*, not a second implementation: `expireStaleApprovals`
 * is the same function an operator would call by hand, so the closing semantics (history row,
 * `completed_at`, cleared approver) have one source of truth. Hourly rather than nightly because
 * a request's window is measured in hours at the short end — an expiry that landed a day late
 * would be no expiry at all.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { expireStaleApprovals } from "../services/approvals";

export const approvalsExpireStaleJob: JobDefinition<null> = {
  name: QUEUE_JOBS.approvalsExpireStale,
  description:
    "Close approval requests still pending past their expiry window as `expired`, one history row each, freeing the entity for a resubmit (NWB-P1-003).",
  audit: {
    action: "approvals.expired",
    // An expiry is a state transition of content-in-review, so it files where the other
    // approval events do; the job run's row summarises the hour, the per-request evidence is
    // the `approval_history` row each closure writes.
    category: "content",
    resourceType: "approval_request",
  },
  async handle({ db }) {
    // Idempotent at the source: the service selects `pending AND expires_at <= now()`, so a
    // re-delivered hour finds nothing left to close. Per-row savepoints inside, so one refused
    // row surfaces as `failed` (and turns this run's audit row `warning`) without holding the
    // rest of the batch hostage.
    const result = await expireStaleApprovals(db);
    return {
      expired: result.expired,
      failed: result.failed,
      errors: result.errors,
      ids: result.ids,
    };
  },
};
