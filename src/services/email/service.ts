/**
 * The email service: outbox first, direct send second, never a thrown provider error
 * (NWB-P1-004 decision 2).
 *
 * `send()` is what every domain service calls, inside a request, right after the write that
 * makes the email necessary. Two things follow from that position:
 *
 * - **It must not fail the request.** A signup whose verification email hit a Resend 503 is still
 *   a signup; the user can ask for another link. So a provider failure on the direct path becomes
 *   a `failed` result and a log line, and on the queued path becomes a pg-boss retry.
 * - **It must not block the request on the provider.** When this process has a started queue
 *   (`getQueue()`), `send()` files an `email.deliver` job and returns `queued`; the worker — this
 *   process or another — talks to the provider. Which is also what makes the delivery
 *   *durable*: the API can restart between the write and the send and the email still goes.
 *
 * The direct path exists for the process that has no queue: `QUEUE_ENABLED=false`, a test, a CLI
 * script, or the boot race in `src/index.ts` where the server is listening before the queue rows
 * exist — the enqueue throws `Queue email.deliver does not exist`, and the fallback sends.
 *
 * The transport is resolved lazily from config, and re-resolved when the config object changes, so
 * a module-level singleton (`emailService`, which `src/tests/email-links.test.ts` spies on) is
 * still correct in a process that loads config after import.
 */
import { type Config, tryGetConfig } from "../../lib/config";
import { describeError } from "../../lib/errors";
import { enqueueJob, getQueue, QUEUE_JOBS, type QueueClient } from "../../lib/queue";
import { ConsoleEmailTransport } from "./console";
import { maskRecipients } from "./mask";
import { ResendEmailTransport } from "./resend";
import type {
  EmailEnvelope,
  EmailMessage,
  EmailResult,
  EmailService,
  EmailTransport,
  EmailTransportReceipt,
} from "./types";

export interface EmailServiceOptions {
  /** A fixed transport. Unset means "whatever config says", resolved at first use. */
  readonly transport?: EmailTransport | undefined;
  /** Where the outbox lives. Unset means the process-wide started client, if any. */
  readonly outbox?: (() => QueueClient | undefined) | undefined;
  /** Where the direct path's failures and fallbacks are reported. */
  readonly log?: ((line: string) => void) | undefined;
  readonly now?: (() => Date) | undefined;
  readonly newMessageId?: (() => string) | undefined;
}

/** `em_` + a v4 uuid: 39 chars, sortable by nothing, unique enough for an idempotency key. */
export function newEmailMessageId(): string {
  return `em_${crypto.randomUUID()}`;
}

/**
 * The transport a config selects. Exported for the smoke script, which needs the real one
 * without the outbox in front of it.
 */
export function createEmailTransport(config: Config | undefined): EmailTransport {
  if (config?.EMAIL_PROVIDER_RESOLVED === "resend") {
    // Both guaranteed by `loadConfig`'s email rules; the checks keep the types honest.
    if (config.RESEND_API_KEY === undefined || config.EMAIL_FROM === undefined) {
      throw new Error("Resend transport selected without RESEND_API_KEY and EMAIL_FROM");
    }
    return new ResendEmailTransport({
      apiKey: config.RESEND_API_KEY,
      from: config.EMAIL_FROM,
      replyTo: config.EMAIL_REPLY_TO,
      baseUrl: config.RESEND_API_BASE_URL,
      timeoutMs: config.EMAIL_SEND_TIMEOUT_MS,
    });
  }
  return new ConsoleEmailTransport();
}

/** Assign an identity and normalise the recipient list. Pure; the same message yields a new envelope each call. */
export function toEnvelope(
  message: EmailMessage,
  options: { now?: () => Date; newMessageId?: () => string } = {},
): EmailEnvelope {
  const to = (Array.isArray(message.to) ? message.to : [message.to])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (to.length === 0) {
    throw new Error("EmailMessage.to must name at least one recipient");
  }
  return {
    messageId: (options.newMessageId ?? newEmailMessageId)(),
    kind: message.kind,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    from: message.from,
    replyTo: message.replyTo,
    organizationId: message.context?.organizationId,
    userId: message.context?.userId,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

const defaultLog = (line: string): void => {
  if (process.env.NODE_ENV !== "test") console.warn(line);
};

export function createEmailService(options: EmailServiceOptions = {}): EmailService {
  const outbox = options.outbox ?? getQueue;
  const log = options.log ?? defaultLog;

  // Resolved on first use and pinned to the config object it was built from, so a test that
  // reloads config gets a matching transport and a server that loaded config once builds it once.
  let resolved: { config: Config | undefined; transport: EmailTransport } | undefined;
  const transport = (): EmailTransport => {
    if (options.transport) return options.transport;
    const config = tryGetConfig();
    if (!resolved || resolved.config !== config) {
      resolved = { config, transport: createEmailTransport(config) };
    }
    return resolved.transport;
  };

  const deliver = (envelope: EmailEnvelope): Promise<EmailTransportReceipt> =>
    transport().send(envelope);

  return {
    get transportName() {
      return transport().name;
    },

    deliver,

    async send(message: EmailMessage): Promise<EmailResult> {
      const envelope = toEnvelope(message, {
        ...(options.now ? { now: options.now } : {}),
        ...(options.newMessageId ? { newMessageId: options.newMessageId } : {}),
      });
      const recipient = envelope.to.join(", ");
      const masked = maskRecipients(envelope.to);

      const boss = outbox();
      if (boss) {
        try {
          await enqueueJob(boss, QUEUE_JOBS.emailDeliver, envelope);
          return { status: "queued", sent: false, messageId: envelope.messageId, recipient };
        } catch (error) {
          // The queue is configured but cannot take the job right now — most often the boot
          // window before `ensureQueues` has run. Durability is lost for this one message;
          // delivery is not.
          log(
            `[email] outbox unavailable for ${envelope.messageId} (${envelope.kind} → ${masked}): ${describeError(error)}; sending directly`,
          );
        }
      }

      try {
        const receipt = await deliver(envelope);
        return {
          status: "sent",
          sent: true,
          messageId: envelope.messageId,
          recipient,
          providerMessageId: receipt.providerMessageId,
        };
      } catch (error) {
        const reason = describeError(error);
        log(
          `[email] ${envelope.messageId} (${envelope.kind} → ${masked}) not delivered: ${reason}`,
        );
        return {
          status: "failed",
          sent: false,
          messageId: envelope.messageId,
          recipient,
          error: reason,
        };
      }
    },
  };
}

/** The process-wide service every domain module sends through. A plain object, so tests may `spyOn(emailService, "send")`. */
export const emailService: EmailService = createEmailService();
