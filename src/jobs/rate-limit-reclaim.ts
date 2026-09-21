/**
 * Rate-limit bucket reclamation as a scheduled job (NWB-P1-001 wiring NWB-P0-013's export).
 *
 * Thin by design: the policy — which buckets are dead, and the one-hour grace that keeps a
 * reclamation from racing a live window — lives in `reclaimRateLimits` and is tested there. This
 * file only decides *when* it runs and *what the audit row says*.
 */
import { QUEUE_JOBS } from "../lib/queue";
import { RATE_LIMIT_RECLAIM_GRACE_MS, reclaimRateLimits } from "../lib/rate-limit";
import type { JobDefinition } from "../lib/worker";

export interface RateLimitReclaimData {
  /**
   * Override the grace window for a manual run (`bun run queue:run maintenance.rate-limit-reclaim
   * '{"graceMs":0}'`) — the schedule never sets it.
   */
  readonly graceMs?: number;
}

export const rateLimitReclaimJob: JobDefinition<RateLimitReclaimData | null> = {
  name: QUEUE_JOBS.rateLimitReclaim,
  description:
    "Delete rate-limit buckets whose window closed more than the reclaim grace ago (NWB-P0-013).",
  policy: {
    // A `DELETE` over one table with an index on `expires_at` is seconds of work. Five minutes is
    // plenty, and it is the bound that lets pg-boss retry a job whose process died mid-run instead
    // of holding the row `active` for the 15-minute default.
    expireInSeconds: 300,
  },
  audit: {
    action: "rate-limits.reclaimed",
    // `data_ops`, not `compliance`: this is housekeeping on a counter table. No personal data
    // leaves the database here, and calling it compliance would dilute the category the two
    // purges below legitimately use.
    category: "data_ops",
    resourceType: "rate_limit",
  },
  async handle({ db }, data) {
    const graceMs = data?.graceMs ?? RATE_LIMIT_RECLAIM_GRACE_MS;
    const deleted = await reclaimRateLimits(db, graceMs);
    return { deleted, graceMs };
  },
};
