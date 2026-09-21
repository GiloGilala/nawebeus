/**
 * Nightly verification of the audit hash chains (NWB-P1-014).
 *
 * The writer seals every `admin`/`system`/`compliance` row into its per-module chain; this job
 * walks those chains, recomputes every link, and sets `hash_chain_valid = false` from the first
 * mismatch onward — the one UPDATE the append-only trigger permits. It runs last in the night
 * (`0 3 * * *`, after the purge window) so it walks the complete set, and it is idempotent: a
 * re-run finds the same breakage and re-sets the same flags, never accumulating.
 *
 * A run that finds breakage is a *successful verification with findings*, not a failure: throwing
 * would retry a condition no retry can clear. It reports through the partial-run convention
 * instead — `failed` counts every currently-broken row, so the audit row warns until the tampering
 * is investigated, not just on the night it is found.
 */
import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { verifyAuditChains } from "../services/audit";

/** Cap on the per-row breakage list in `after_state`; the count in `failed` is never capped. */
const MAX_REPORTED_BREAKS = 100;

export const auditChainVerifyJob: JobDefinition<null> = {
  name: QUEUE_JOBS.auditChainVerify,
  description:
    "Verify the admin/system/compliance audit hash chains and flag broken rows (NWB-P1-014).",
  audit: {
    action: "audit-chain.verified",
    // Tamper detection is a security control first; the row doubles as compliance evidence.
    category: "security",
    resourceType: "audit_log",
    module: "system",
  },
  async handle({ db }) {
    const result = await verifyAuditChains(db);
    return {
      rowsChecked: result.rowsChecked,
      failed: result.broken.length,
      errors: result.broken.slice(0, MAX_REPORTED_BREAKS),
      truncated: result.broken.length > MAX_REPORTED_BREAKS,
    };
  },
};
