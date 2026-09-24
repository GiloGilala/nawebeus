/**
 * Five-minute expiry of impersonation sessions (NWB-P1-011).
 *
 * A support window's deadline is when access stops — the middleware enforces that on every
 * request, so an expired session cannot *act* one second past its `expires_at`. What this job
 * adds is the clean end for the *record*: a session whose admin walked away ends as
 * `expired` (with its own audit row) instead of lingering open in the oversight list until
 * someone starts a new one against the same target. Five minutes, not nightly, because a
 * four-hour maximum makes a daily lag meaningless; cheap when there is nothing to close.
 *
 * Like every job here it is a scheduler, not a second implementation:
 * `expireLapsedImpersonations` is the same function the start/mint paths apply inline when
 * they trip over a lapsed row, so "what an expiry means" has exactly one source of truth.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { expireLapsedImpersonations } from "../services/impersonation";

export const impersonationExpireJob: JobDefinition<null> = {
  name: QUEUE_JOBS.impersonationExpire,
  description:
    "Close impersonation sessions past their `expires_at` as `expired`, one audit row each (NWB-P1-011).",
  audit: {
    action: "impersonation.expire",
    // The per-session evidence is the expiry audit row the service writes per closed row
    // (`admin.impersonation.expired`, module `admin`, so each seals into the hash chain);
    // the run row summarises the tick. Filed under its own two-segment name — the queue's
    // own audit descriptors are `<resource>.<verb>` by the definitions test's rule — with
    // the registry supplying the same category/resource the per-row events carry.
    category: "compliance",
    resourceType: "impersonation_session",
  },
  async handle({ db }) {
    // Idempotent at the source: only rows with `ended_at IS NULL AND expires_at <= now()` are
    // selected, so a re-delivered tick finds nothing left to close. A row that fails is
    // reported, not fatal — a nonzero `failed` turns this run's audit row `warning` (the
    // wrapper's partial-run convention) without holding the rest of the batch hostage.
    const result = await expireLapsedImpersonations(db);
    return {
      expired: result.expired,
      failed: result.failed,
      errors: result.errors,
      ids: result.ids,
    };
  },
};
