/**
 * Hard purge of lapsed invitations (NWB-P1-016).
 *
 * An invitation lapses 7 days after sending and lingers one 30-day grace cycle so admins can
 * still see it in the member list; past that the member row is erased for real, because a lapsed
 * invite is consent that expired — keeping the address is retention without a purpose. The audit
 * row stays as the durable record of the invite having happened, with the invitee address
 * scrubbed from it.
 *
 * Like the account purge, this job is a *scheduler*, not a reimplementation: it calls the same
 * `expireInvitations` the admin surface would, so the erasure semantics have exactly one source
 * of truth.
 */

import { QUEUE_JOBS } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import { expireInvitations } from "../services/orgs/invitation.service";

export const purgeExpiredInvitationsJob: JobDefinition<null> = {
  name: QUEUE_JOBS.purgeExpiredInvitations,
  description:
    "Hard-delete invitations that lapsed past the 30-day grace window, scrubbing invitee addresses from their audit rows (NWB-P1-016).",
  audit: {
    action: "invitations.purged",
    // Erasure of personal data is a compliance event first and an operational one second; the
    // row's existence is what an NDPR enquiry asks for.
    category: "compliance",
    resourceType: "member",
  },
  async handle({ db }) {
    // Idempotent at the source, which is why at-least-once delivery is safe here: the service
    // selects only rows lapsed past grace, so the second run of a night finds nothing.
    //
    // Per-row since NWB-P1-013: nothing references `organization_members` restrictively today, so
    // no row can refuse — but the scrub needs per-row scope regardless, and a nonzero `failed`
    // makes this run's audit row `warning` (the wrapper's partial-run convention), so a night
    // that erased nothing-but-tried never reads as clean.
    const result = await expireInvitations(db);
    // `auditAnonymized` is the erasure's own evidence: invite audit rows scrubbed of invitee
    // addresses. Same key as the account purge, same reason. `held` counts legal-freeze
    // refusals (NWB-P1-010).
    return {
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors,
      auditAnonymized: result.auditAnonymized,
      held: result.held,
    };
  },
};
