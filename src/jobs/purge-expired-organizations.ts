/**
 * Hard purge of expired organizations (NWB-P1-001 wiring NWB-P0-023's service).
 *
 * `deleteOrganization` soft-deletes with a 30-day undo window and `reactivateOrganization` is the
 * reachable way back inside it; past the window the workspace is erased for real, which is what
 * makes the grace period honest — and what unblocks the account purge that runs after this one
 * (F-25: `organizations.owner_id` is restrictive, so a *former* owner cannot be erased while the
 * organization still exists).
 */
import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { purgeExpiredOrganizations } from "../services/orgs/org-deletion.service";

export const purgeExpiredOrganizationsJob: JobDefinition<null> = {
  name: QUEUE_JOBS.purgeExpiredOrganizations,
  description:
    "Hard-delete organizations whose 30-day deletion grace window has elapsed (NWB-P0-023).",
  audit: {
    action: "organizations.purged",
    category: "compliance",
    resourceType: "organization",
  },
  async handle({ db }) {
    // Every FK into `organizations.id` is CASCADE or SET NULL, so today no row can refuse — but
    // the delete still runs per row (NWB-P1-013), because the aspirational billing tables already
    // declare `restrict` FKs to this table and the day they migrate is the day a batch DELETE
    // would start wedging. A nonzero `failed` makes this run's audit row `warning` (the wrapper's
    // partial-run convention). Members are detached, never deleted with the workspace.
    const result = await purgeExpiredOrganizations(db);
    // `held` (NWB-P1-010) counts the rows a legal freeze withheld. No `auditAnonymized` key —
    // the org purge erases no subject.
    return {
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors,
      held: result.held,
    };
  },
};
