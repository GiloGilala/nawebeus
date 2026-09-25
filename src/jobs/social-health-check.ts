/**
 * Five-minute social account health checks (NWB-P2-003).
 *
 * FR-SOC-041's five-minute bound is what this cadence buys: a status change is at most one tick
 * old. The sweep itself is cheap by design — breaker-open accounts probe every run (half-open
 * recovery, FR-SOC-056's "until health-checked"), everything else on the FR-SOC-039 six-hour
 * routine — and the escalation (FR-SOC-059) rides the same tick. Per-probe evidence is in
 * `social_account_health_log`; the run row here is the tick's summary.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { getSocialService } from "../services/social";

export const socialHealthCheckJob: JobDefinition<null> = {
  name: QUEUE_JOBS.socialHealthCheck,
  description:
    "Probe social accounts (open breakers every tick, the rest six-hourly); open breakers at 10 consecutive failures, recover on success, escalate >24h outages (NWB-P2-003).",
  audit: {
    action: "socialaccounts.health-checked",
    category: "data_ops",
    resourceType: "social_account",
  },
  async handle({ db }) {
    const result = await getSocialService().runHealthChecks(db);
    return {
      checked: result.checked,
      healthy: result.healthy,
      failed: result.failed,
      rateLimited: result.rateLimited,
      needsReauth: result.needsReauth,
      breakerOpened: result.breakerOpened,
      breakerRecovered: result.breakerRecovered,
      escalated: result.escalated,
    };
  },
};
