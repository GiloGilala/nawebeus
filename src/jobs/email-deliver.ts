/**
 * The email outbox worker (NWB-P1-004, DEC-028).
 *
 * `emailService.send()` files one job per message; this handler takes it out and hands it to the
 * configured transport. It is deliberately the *only* place a queued email meets a provider, so
 * the retry policy, the idempotency key and the audit trail have one owner.
 *
 * **Policy.** Six retries with pg-boss's exponential backoff off a 60 s base (1, 2, 4, 8, 16, 32
 * minutes — about an hour of trying) covers a provider blip and a rate-limit burst without keeping
 * a stale verification link alive for days. `expireInSeconds: 60` because a single HTTP call that
 * takes longer than that is dead, not slow (the transport's own timeout is 10 s). And
 * **`deleteAfterSeconds: 3600`**, the one value that is not about retries: the payload carries the
 * raw token link — `tokens` stores only hashes, and the outbox must not become the place where the
 * plaintext outlives its purpose. pg-boss removes the completed row an hour after it completes.
 *
 * **What is retried and what is recorded.** The transport classifies each failure
 * (`EmailDeliveryError.retryable`). A retryable one — 429, 5xx, timeout, network — is rethrown so
 * pg-boss schedules the next attempt, and the worker base files `email.delivery_failed` at
 * `warning` (`critical` on the last attempt). A final one — an unverified sender, an address the
 * provider refuses — is returned as `{ failed: 1 }`: the base files `email.delivery_failed`
 * (`failureAction`, partial-run convention) and the job completes, because sending the same
 * payload a seventh time would be refused a seventh time.
 *
 * **What the audit row says.** Never the address, never the body: `scope` puts the tenant and
 * the subject user on the row where the tenant's own `GET /api/audit` can see it, and the
 * metadata carries the masked recipient (`j***@example.com`), the template kind and the provider;
 * the success `after_state` adds the provider's message id.
 *
 * Idempotency is the transport's (`Idempotency-Key: <messageId>` on every Resend request), which
 * is what makes an at-least-once redelivery of this job safe.
 */

import { EmailDeliveryError } from "../lib/errors";
import { QUEUE_JOBS, type QueuePolicy } from "../lib/queue";
import type { JobDefinition } from "../lib/worker";
import {
  type EmailEnvelope,
  type EmailTransportReceipt,
  emailService,
  maskRecipients,
} from "../services/email";

/** The queued payload: the envelope `emailService.send()` minted, verbatim. */
export type EmailDeliverJobData = EmailEnvelope;

export const EMAIL_DELIVER_POLICY: QueuePolicy = {
  retryLimit: 6,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60,
  deleteAfterSeconds: 3_600,
};

export interface EmailDeliverJobDeps {
  /** The direct transport call. Defaults to the configured transport via `emailService.deliver`. */
  readonly deliver: (envelope: EmailEnvelope) => Promise<EmailTransportReceipt>;
  /** Which transport `deliver` talks to — stamped on every audit row of the run. */
  readonly providerName?: (() => string) | undefined;
}

const defaultDeps: EmailDeliverJobDeps = {
  deliver: (envelope) => emailService.deliver(envelope),
  providerName: () => emailService.transportName,
};

/** Everything a payload must carry for the handler to be able to act on it. */
function describeInvalidPayload(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") return "payload is not an object";
  const envelope = data as Partial<EmailEnvelope>;
  if (typeof envelope.messageId !== "string" || envelope.messageId.length === 0) {
    return "payload has no messageId";
  }
  if (!Array.isArray(envelope.to) || envelope.to.length === 0) return "payload has no recipient";
  if (typeof envelope.subject !== "string" || typeof envelope.html !== "string") {
    return "payload has no subject/html";
  }
  if (typeof envelope.kind !== "string") return "payload has no kind";
  return undefined;
}

export function createEmailDeliverJob(
  deps: EmailDeliverJobDeps = defaultDeps,
): JobDefinition<EmailDeliverJobData> {
  const providerName = deps.providerName ?? (() => "unknown");
  return {
    name: QUEUE_JOBS.emailDeliver,
    description:
      "Deliver one queued email through the configured transport (Resend, or the console in dev); provider failures retried for about an hour, final rejections recorded (NWB-P1-004).",
    policy: EMAIL_DELIVER_POLICY,
    audit: {
      action: "email.delivered",
      failureAction: "email.delivery_failed",
      category: "user_management",
      resourceType: "email",
      scope: (data) => ({
        organizationId: data?.organizationId,
        targetUserId: data?.userId,
        resourceId: data?.messageId,
        metadata: {
          kind: data?.kind,
          recipient: Array.isArray(data?.to) ? maskRecipients(data.to) : undefined,
          provider: providerName(),
        },
      }),
    },
    async handle(_context, data) {
      const invalid = describeInvalidPayload(data);
      if (invalid !== undefined) {
        // Not ours to retry: a payload that cannot be delivered now cannot be delivered later.
        return { delivered: 0, failed: 1, error: invalid };
      }

      try {
        const receipt = await deps.deliver(data);
        return {
          delivered: 1,
          provider: receipt.provider,
          ...(receipt.providerMessageId !== undefined
            ? { providerMessageId: receipt.providerMessageId }
            : {}),
        };
      } catch (error) {
        if (error instanceof EmailDeliveryError && !error.retryable) {
          return {
            delivered: 0,
            failed: 1,
            provider: error.details.provider,
            ...(error.details.status !== undefined ? { status: error.details.status } : {}),
            ...(error.details.providerCode !== undefined
              ? { providerCode: error.details.providerCode }
              : {}),
            error: error.message,
          };
        }
        // Retryable — or unclassified, which is treated as retryable because a lost email costs
        // more than a duplicate the idempotency key will suppress anyway.
        throw error;
      }
    },
  };
}

export const emailDeliverJob = createEmailDeliverJob();
