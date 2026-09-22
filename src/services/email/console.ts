/**
 * The console transport: every message goes to the log, nothing goes anywhere else.
 *
 * What `bun run dev` uses until a Resend key is configured, and how a developer reads a
 * verification link for a local account now that the server refuses unverified sessions
 * (NWB-P1-004 decision 3). Silent under `NODE_ENV=test` so the suite's output stays readable;
 * the tests that care about the transport inject their own sink.
 */
import type { EmailEnvelope, EmailTransport, EmailTransportReceipt } from "./types";

export type ConsoleEmailSink = (line: string) => void;

const defaultSink: ConsoleEmailSink = (line) => {
  if (process.env.NODE_ENV !== "test") console.log(line);
};

export class ConsoleEmailTransport implements EmailTransport {
  readonly name = "console";

  constructor(private readonly sink: ConsoleEmailSink = defaultSink) {}

  async send(envelope: EmailEnvelope): Promise<EmailTransportReceipt> {
    const recipient = envelope.to.join(", ");
    this.sink(
      `\n[EMAIL] ${envelope.messageId} (${envelope.kind})\nTo: ${recipient}\nSubject: ${envelope.subject}\n${envelope.html}\n`,
    );
    return { provider: this.name, providerMessageId: envelope.messageId };
  }
}
