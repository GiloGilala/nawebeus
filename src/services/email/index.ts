/**
 * Email transport and outbox (NWB-P1-004, DEC-028).
 *
 * `import { emailService } from "../email"` keeps resolving here; the module grew from one
 * console-only file into a directory when the Resend transport, the outbox and the masking
 * arrived. Domain services call `emailService.send()` and nothing else; the job in
 * `src/jobs/email-deliver.ts` calls `emailService.deliver()`; the smoke script builds a
 * transport of its own through `createEmailTransport()`.
 */
export { type ConsoleEmailSink, ConsoleEmailTransport } from "./console";
export { maskEmailAddress, maskRecipients } from "./mask";
export {
  isRetryableStatus,
  RESEND_DEFAULT_BASE_URL,
  RESEND_PROVIDER_NAME,
  ResendEmailTransport,
  type ResendSendRequest,
  type ResendTransportOptions,
} from "./resend";
export {
  createEmailService,
  createEmailTransport,
  type EmailServiceOptions,
  emailService,
  newEmailMessageId,
  toEnvelope,
} from "./service";
export type {
  EmailContext,
  EmailDeliveryStatus,
  EmailEnvelope,
  EmailKind,
  EmailMessage,
  EmailResult,
  EmailService,
  EmailTransport,
  EmailTransportReceipt,
} from "./types";
