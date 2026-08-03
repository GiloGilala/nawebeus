export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  sent: boolean;
  messageId: string;
  recipient: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailResult>;
}

export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<EmailResult> {
    const recipient = Array.isArray(message.to)
      ? message.to.join(", ")
      : message.to;
    const messageId = `em_${crypto.randomUUID()}`;

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `\n[EMAIL] To: ${recipient}\nSubject: ${message.subject}\n${message.html}\n`,
      );
    }

    return { sent: true, messageId, recipient };
  }
}

export interface EmailService {
  send(message: EmailMessage): Promise<EmailResult>;
}

export function createEmailService(transport?: EmailTransport): EmailService {
  const impl = transport ?? new ConsoleEmailTransport();
  return {
    send(message: EmailMessage) {
      return impl.send(message);
    },
  };
}

export const emailService = createEmailService();
