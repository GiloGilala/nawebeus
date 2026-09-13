import { describe, expect, test } from "bun:test";
import {
  ConsoleEmailTransport,
  createEmailService,
  type EmailMessage,
  type EmailTransport,
} from "../services/email";

describe("ConsoleEmailTransport", () => {
  test("sendEmail returns sent=true and echoes recipient", async () => {
    const transport = new ConsoleEmailTransport();
    const msg: EmailMessage = {
      to: "user@example.com",
      subject: "Verify your email",
      html: "<p>Click <a href='https://example.com/verify?token=abc'>here</a></p>",
    };
    const result = await transport.send(msg);
    expect(result.sent).toBe(true);
    expect(result.recipient).toBe("user@example.com");
    expect(result.messageId).toMatch(/^em_/);
  });

  test("sendEmail handles multiple recipients", async () => {
    const transport = new ConsoleEmailTransport();
    const msg: EmailMessage = {
      to: ["a@example.com", "b@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
    };
    const result = await transport.send(msg);
    expect(result.sent).toBe(true);
    expect(result.recipient).toBe("a@example.com, b@example.com");
  });
});

describe("createEmailService", () => {
  test("defaults to console transport when no provider configured", async () => {
    const svc = createEmailService();
    const msg: EmailMessage = {
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
    };
    const result = await svc.send(msg);
    expect(result.sent).toBe(true);
  });

  test("send wraps the transport and returns its result", async () => {
    const fakeTransport: EmailTransport = {
      send: async (msg) => ({
        sent: true,
        messageId: "test-123",
        recipient: Array.isArray(msg.to) ? msg.to[0]! : msg.to,
      }),
    };
    const svc = createEmailService(fakeTransport);
    const result = await svc.send({
      to: "x@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(result.messageId).toBe("test-123");
    expect(result.recipient).toBe("x@example.com");
  });
});
