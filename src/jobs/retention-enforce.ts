/**
 * Nightly enforcement of the §9.4 retention schedule (NWB-P1-010).
 *
 * The three purge jobs erase what a lifecycle ended; this one erases what a clock ended —
 * expired DSAR packages, dead-and-stale sessions, expired/consumed tokens — plus backup
 * file-status expiry and the audit census. A scheduler, not a reimplementation: it calls the
 * same `enforceRetention` an operator would, so the schedule has one source of truth.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { enforceRetention } from "../services/retention/retention.service";

export const retentionEnforceJob: JobDefinition<null> = {
  name: QUEUE_JOBS.retentionEnforce,
  description:
    "Enforce the §9.4 retention schedule: expired DSAR packages, sessions, tokens, backup file-status, and the audit census (NWB-P1-010).",
  audit: {
    action: "retention.enforced",
    // Retention enforcement is a compliance event first: the row's existence — including its
    // census counts, which are the next run's baseline — is what an NDPR enquiry asks for.
    category: "compliance",
    resourceType: "retention",
  },
  async handle({ db }) {
    // Idempotent at the source: every enforcer selects only rows past their window, so the
    // second run of a night finds nothing — which is what makes at-least-once delivery safe.
    // Top-level `deleted`/`failed`/`held` sum the delete tables alone (a backup status flip is
    // not an erasure); `tables` carries the per-table evidence and `census` tonight's counts.
    // A nonzero `failed` makes this run's audit row `warning` (the wrapper's partial-run
    // convention) — held rows included, deliberately: erasure deferred is erasure outstanding.
    const result = await enforceRetention(db);
    return {
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors,
      held: result.held,
      tables: result.tables,
      census: result.census,
    };
  },
};
