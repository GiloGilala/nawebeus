/**
 * Five-minute proactive OAuth token refresh (NWB-P2-002).
 *
 * Provider clocks, not ours: Google access tokens die after one hour, X's after two — a
 * nightly-only sweep would wake up to a connected-account list that all died overnight. Every
 * active account whose token expires within the next hour (BR-SOC-013's "1 hour before") is
 * refreshed, with the service owning the retry-then-`needs_reauth` escalation (FR-SOC-021/022);
 * this file is the schedule, not a second implementation.
 *
 * Per-account evidence lives in `token_refresh_log`; the run row here is the tick's summary.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { getSocialService } from "../services/social";

export const socialTokenRefreshJob: JobDefinition<null> = {
  name: QUEUE_JOBS.socialTokenRefresh,
  description:
    "Refresh social OAuth tokens expiring within the hour; failures retry once, then the account surfaces as needs_reauth (NWB-P2-002).",
  audit: {
    action: "socialaccounts.refreshed",
    category: "data_ops",
    resourceType: "social_account",
  },
  async handle({ db }) {
    const result = await getSocialService().refreshDueTokens(db);
    return {
      due: result.due,
      refreshed: result.refreshed,
      rotated: result.rotated,
      needsReauth: result.needsReauth,
      failed: result.failures.length,
      errors: result.failures.map((f) => `${f.accountId}: ${f.reason}`),
    };
  },
};
