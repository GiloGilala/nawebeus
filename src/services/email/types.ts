/**
 * The email contract every caller and every transport shares (NWB-P1-004, DEC-028).
 *
 * Three shapes, in the order a message moves through them:
 *
 * - **`EmailMessage`** — what a service composes: recipient, subject, body, plus the two things the
 *   audit trail needs and the body cannot tell it, `kind` (which template family this is) and
 *   `context` (whose tenant and whose account it concerns).
 * - **`EmailEnvelope`** — the message with its identity assigned (`messageId`, `em_…`) and its
 *   recipient list normalised. This is what the outbox stores and what a transport receives, so
 *   a retry re-sends *the same envelope* and the id doubles as the provider's idempotency key.
 * - **`EmailResult`** — what `emailService.send()` reports back to the caller: `queued` when the
 *   outbox took it, `sent` when a transport accepted it directly, `failed` when the direct path
 *   could not deliver. It is never a rejection: a provider outage is the email's problem to retry,
 *   not the signup's reason to 500.
 */

/**
 * The template family. Queryable in the audit row (`metadata.kind`) and sent to the provider as a
 * tag, so "how many invitations bounced this week" is one filter. New families are added here in
 * the same commit as the code that sends them; P1-008's notification engine will grow this list.
 */
export type EmailKind =
  | "verification"
  | "password_reset"
  | "email_change"
  | "mfa_enabled"
  | "invitation"
  | "alert"
  | "notification"
  | "impersonation";

/** Whose email this is, for the audit row. Both optional: a password reset has no tenant. */
export interface EmailContext {
  /** The tenant the email concerns — an invitation's organization. Filed as the audit row's `organization_id`. */
  readonly organizationId?: string | undefined;
  /** The account the email concerns — the recipient when they have one. Filed as `target_user_id`. */
  readonly userId?: string | undefined;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string | undefined;
  /** Overrides the configured `EMAIL_FROM`. Rarely right; the transport's default is the verified sender. */
  from?: string | undefined;
  replyTo?: string | undefined;
  kind: EmailKind;
  context?: EmailContext | undefined;
}

/** A message with its identity assigned — the unit the outbox stores and a transport delivers. */
export interface EmailEnvelope {
  /** `em_` + uuid. The outbox job's `resourceId`, the provider's `Idempotency-Key`, the log line's handle. */
  readonly messageId: string;
  readonly kind: EmailKind;
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text?: string | undefined;
  readonly from?: string | undefined;
  readonly replyTo?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly userId?: string | undefined;
  /** When `send()` minted the envelope (ISO 8601). Lets an operator see how long the outbox held it. */
  readonly createdAt: string;
}

/** What a transport reports once the provider has accepted the envelope. */
export interface EmailTransportReceipt {
  /** `console` or `resend`. */
  readonly provider: string;
  /** The provider's own id for the message, when it gives one; the console echoes the envelope id. */
  readonly providerMessageId?: string | undefined;
}

/**
 * One way to hand an envelope to a provider. Resolves when the provider accepted it; rejects with
 * `EmailDeliveryError` (`src/lib/errors.ts`) when it did not, carrying the transport's own verdict on
 * whether a retry could succeed. Anything else thrown is a bug in the transport, and the worker
 * treats it as retryable because that is the safer wrong answer.
 */
export interface EmailTransport {
  readonly name: string;
  send(envelope: EmailEnvelope): Promise<EmailTransportReceipt>;
}

export type EmailDeliveryStatus = "queued" | "sent" | "failed";

export interface EmailResult {
  /** `queued`: the outbox has it. `sent`: a transport accepted it now. `failed`: the direct path could not deliver. */
  status: EmailDeliveryStatus;
  /** `status === "sent"`. Kept as a boolean because the older call sites and their tests read it. */
  sent: boolean;
  /** Our id — the handle to look the delivery up by in the audit log (`resource_id`). */
  messageId: string;
  /** The recipient list, comma-joined, as the transport saw it. Not for logging; mask it first. */
  recipient: string;
  providerMessageId?: string | undefined;
  /** One line on why a direct send failed. Absent for `queued` and `sent`. */
  error?: string | undefined;
}

export interface EmailService {
  /** Queue the message when an outbox is available, otherwise send it now. Never throws for a provider failure. */
  send(message: EmailMessage): Promise<EmailResult>;
  /**
   * Hand an envelope to the configured transport right now — the outbox worker's path and the
   * smoke script's. Throws `EmailDeliveryError` like a transport does; never enqueues.
   */
  deliver(envelope: EmailEnvelope): Promise<EmailTransportReceipt>;
  /** Which transport `deliver` uses. Resolved lazily from config, so it is a getter. */
  readonly transportName: string;
}
