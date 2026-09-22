/**
 * Email transport, outbox routing and masking — NWB-P1-004 (DEC-028).
 *
 * No database and no network: the Resend transport is driven through an injected `fetch`, the
 * outbox through a recording fake of the one pg-boss method `send()` uses. What these pin:
 *
 * - the exact request the Resend transport makes (endpoint, bearer, idempotency key, body shape),
 *   because that request *is* the integration and nothing else in the tree can see it;
 * - the retryable/final split, because the worker's retry-or-record decision is downstream of it;
 * - `send()` never throwing for a provider failure, because six request paths depend on that;
 * - the queue-first, direct-fallback routing, including the boot race where the queue exists but
 *   the enqueue throws;
 * - masking, because the audit rows are only PII-free if this function is.
 */
import { describe, expect, test } from "bun:test";
import { EmailDeliveryError } from "../lib/errors";
import type { QueueClient } from "../lib/queue";
import {
  ConsoleEmailTransport,
  createEmailService,
  createEmailTransport,
  type EmailEnvelope,
  type EmailMessage,
  type EmailTransport,
  emailService,
  isRetryableStatus,
  maskEmailAddress,
  maskRecipients,
  newEmailMessageId,
  ResendEmailTransport,
  toEnvelope,
} from "../services/email";

const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  kind: "verification",
  to: "john@example.com",
  subject: "Verify your Nawebeus email",
  html: "<p>Click <a href='https://example.com/verify?token=abc'>here</a></p>",
  ...overrides,
});

const envelope = (overrides: Partial<EmailEnvelope> = {}): EmailEnvelope => ({
  messageId: "em_fixed",
  kind: "invitation",
  to: ["john@example.com"],
  subject: "You've been invited",
  html: "<p>Accept</p>",
  createdAt: "2026-09-22T10:00:00.000Z",
  ...overrides,
});

/** A `fetch` that answers every call the same way and records what it was asked. */
function fakeFetch(respond: (input: string, init: RequestInit) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  }) as unknown as typeof fetch;
  return { fetch: impl, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const transport = (
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof ResendEmailTransport>[0]> = {},
) =>
  new ResendEmailTransport({
    apiKey: "re_test_key",
    from: "Nawebeus <no-reply@nawebeus.com>",
    fetch: fetchImpl,
    ...overrides,
  });

describe("maskEmailAddress", () => {
  test("keeps the initial and the domain, nothing else", () => {
    expect(maskEmailAddress("john@example.com")).toBe("j***@example.com");
    expect(maskEmailAddress("j@example.com")).toBe("j***@example.com");
    expect(maskEmailAddress("first.last+tag@sub.example.co.uk")).toBe("f***@sub.example.co.uk");
  });

  test("something that is not an address masks entirely", () => {
    expect(maskEmailAddress("not-an-address")).toBe("***");
    expect(maskEmailAddress("@example.com")).toBe("***");
    expect(maskEmailAddress("")).toBe("***");
  });

  test("a recipient list masks each entry", () => {
    expect(maskRecipients(["a@x.io", "bob@y.io"])).toBe("a***@x.io, b***@y.io");
    expect(maskRecipients("solo@z.io")).toBe("s***@z.io");
  });
});

describe("toEnvelope", () => {
  test("mints an em_ id, normalises the recipient list and carries kind and context", () => {
    const env = toEnvelope(
      message({
        to: [" a@example.com ", "", "b@example.com"],
        context: { organizationId: "org_1", userId: "usr_1" },
      }),
      { now: () => new Date("2026-09-22T10:00:00Z") },
    );
    expect(env.messageId).toMatch(/^em_[0-9a-f-]{36}$/);
    expect(env.to).toEqual(["a@example.com", "b@example.com"]);
    expect(env.kind).toBe("verification");
    expect(env.organizationId).toBe("org_1");
    expect(env.userId).toBe("usr_1");
    expect(env.createdAt).toBe("2026-09-22T10:00:00.000Z");
  });

  test("two envelopes of the same message never share an id", () => {
    const m = message();
    expect(toEnvelope(m).messageId).not.toBe(toEnvelope(m).messageId);
    expect(newEmailMessageId()).not.toBe(newEmailMessageId());
  });

  test("refuses a message with nobody to send to", () => {
    expect(() => toEnvelope(message({ to: [] }))).toThrow(/at least one recipient/);
    expect(() => toEnvelope(message({ to: "   " }))).toThrow(/at least one recipient/);
  });
});

describe("ConsoleEmailTransport", () => {
  test("writes the envelope to its sink and echoes the envelope id as the provider id", async () => {
    const lines: string[] = [];
    const console_ = new ConsoleEmailTransport((line) => lines.push(line));
    const receipt = await console_.send(envelope({ to: ["a@example.com", "b@example.com"] }));
    expect(receipt).toEqual({ provider: "console", providerMessageId: "em_fixed" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("em_fixed");
    expect(lines[0]).toContain("(invitation)");
    expect(lines[0]).toContain("To: a@example.com, b@example.com");
    expect(lines[0]).toContain("<p>Accept</p>");
  });

  test("the default sink is silent under NODE_ENV=test", async () => {
    const original = console.log;
    const logged: unknown[] = [];
    console.log = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      await new ConsoleEmailTransport().send(envelope());
    } finally {
      console.log = original;
    }
    expect(logged).toHaveLength(0);
  });
});

describe("ResendEmailTransport", () => {
  test("posts the envelope to /emails with bearer auth, the idempotency key and the documented body", async () => {
    const f = fakeFetch(() => json(200, { id: "re_msg_1" }));
    const receipt = await transport(f.fetch).send(
      envelope({
        to: ["john@example.com", "jane@example.com"],
        text: "Accept the invitation",
      }),
    );

    expect(receipt).toEqual({ provider: "resend", providerMessageId: "re_msg_1" });
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("em_fixed");
    expect(JSON.parse(call.init.body as string)).toEqual({
      from: "Nawebeus <no-reply@nawebeus.com>",
      to: ["john@example.com", "jane@example.com"],
      subject: "You've been invited",
      html: "<p>Accept</p>",
      text: "Accept the invitation",
      tags: [{ name: "kind", value: "invitation" }],
    });
  });

  test("a configured reply-to and an envelope-level from override the defaults", () => {
    const t = transport(fakeFetch(() => json(200, { id: "x" })).fetch, {
      replyTo: "Support <help@nawebeus.com>",
    });
    expect(t.requestBodyFor(envelope())).toMatchObject({
      from: "Nawebeus <no-reply@nawebeus.com>",
      reply_to: "Support <help@nawebeus.com>",
    });
    expect(
      t.requestBodyFor(envelope({ from: "Alerts <alerts@nawebeus.com>", replyTo: "me@x.io" })),
    ).toMatchObject({ from: "Alerts <alerts@nawebeus.com>", reply_to: "me@x.io" });
    expect(t.requestBodyFor(envelope())).not.toHaveProperty("text");
  });

  test("a custom base URL is honoured with or without a trailing slash", async () => {
    const f = fakeFetch(() => json(200, { id: "x" }));
    await transport(f.fetch, { baseUrl: "http://localhost:9999/" }).send(envelope());
    expect(f.calls[0]!.url).toBe("http://localhost:9999/emails");
  });

  test("the same envelope carries the same idempotency key on every attempt", async () => {
    const f = fakeFetch(() => json(503, { name: "internal_server_error", message: "boom" }));
    const t = transport(f.fetch);
    const env = envelope({ messageId: "em_retry_me" });
    await expect(t.send(env)).rejects.toBeInstanceOf(EmailDeliveryError);
    await expect(t.send(env)).rejects.toBeInstanceOf(EmailDeliveryError);
    const keys = f.calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys).toEqual(["em_retry_me", "em_retry_me"]);
  });

  test("a 2xx without an id is still a delivery", async () => {
    const f = fakeFetch(() => new Response("", { status: 200 }));
    const receipt = await transport(f.fetch).send(envelope());
    expect(receipt).toEqual({ provider: "resend" });
  });

  test("a validation rejection is final: not retryable, status and provider code preserved", async () => {
    const f = fakeFetch(() =>
      json(422, { statusCode: 422, name: "validation_error", message: "Invalid `from` field" }),
    );
    const error = await transport(f.fetch)
      .send(envelope())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    const delivery = error as EmailDeliveryError;
    expect(delivery.retryable).toBe(false);
    expect(delivery.details).toEqual({
      provider: "resend",
      status: 422,
      providerCode: "validation_error",
    });
    expect(delivery.message).toBe("resend: 422 validation_error: Invalid `from` field");
  });

  test("a bad API key is final too — sending again cannot fix credentials", async () => {
    const f = fakeFetch(() => json(401, { name: "missing_api_key", message: "Missing API key" }));
    const error = (await transport(f.fetch)
      .send(envelope())
      .catch((e: unknown) => e)) as EmailDeliveryError;
    expect(error.retryable).toBe(false);
    expect(error.details.status).toBe(401);
  });

  test("a rate limit is retryable and names the retry-after the provider gave", async () => {
    const f = fakeFetch(() =>
      json(
        429,
        { name: "rate_limit_exceeded", message: "Too many requests" },
        { "retry-after": "2" },
      ),
    );
    const error = (await transport(f.fetch)
      .send(envelope())
      .catch((e: unknown) => e)) as EmailDeliveryError;
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({
      provider: "resend",
      status: 429,
      providerCode: "rate_limit_exceeded",
    });
    expect(error.message).toContain("(retry-after 2s)");
  });

  test("a 5xx is retryable, even when the body is not JSON", async () => {
    const f = fakeFetch(
      () => new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    const error = (await transport(f.fetch)
      .send(envelope())
      .catch((e: unknown) => e)) as EmailDeliveryError;
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ provider: "resend", status: 502 });
    expect(error.message).toBe("resend: 502: Bad Gateway");
  });

  test("a network failure is retryable and keeps the underlying cause in the message", async () => {
    const f = fakeFetch(() => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    });
    const error = (await transport(f.fetch)
      .send(envelope())
      .catch((e: unknown) => e)) as EmailDeliveryError;
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ provider: "resend" });
    expect(error.message).toContain("ECONNREFUSED");
  });

  test("a call that outlives the timeout is aborted and reported as a retryable timeout", async () => {
    const f = fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })),
          );
        }),
    );
    const error = (await transport(f.fetch, { timeoutMs: 20 })
      .send(envelope())
      .catch((e: unknown) => e)) as EmailDeliveryError;
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ provider: "resend", providerCode: "timeout" });
    expect(error.message).toBe("resend: no response within 20ms");
  });

  test("the retryable split, spelled out", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(409, "concurrent_idempotent_requests")).toBe(true);
    expect(isRetryableStatus(409, "invalid_idempotent_request")).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
  });

  test("refuses to be built without a key or a sender", () => {
    expect(() => transport(fakeFetch(() => json(200, {})).fetch, { apiKey: " " })).toThrow(
      /apiKey/,
    );
    expect(() => transport(fakeFetch(() => json(200, {})).fetch, { from: "" })).toThrow(/from/);
  });
});

/** A recording stand-in for the one pg-boss method the outbox uses. */
function fakeOutbox(behaviour: "accept" | "throw" = "accept") {
  const sent: { name: string; data: unknown }[] = [];
  const boss = {
    send: async (name: string, data: object | null) => {
      if (behaviour === "throw") throw new Error(`Queue ${name} does not exist`);
      sent.push({ name, data });
      return "job_1";
    },
  } as unknown as QueueClient;
  return { boss, sent };
}

function recordingTransport(
  behaviour: "accept" | "final" | "retryable" | "explode" = "accept",
): EmailTransport & { sent: EmailEnvelope[] } {
  const sent: EmailEnvelope[] = [];
  return {
    name: "fake",
    sent,
    async send(env) {
      sent.push(env);
      if (behaviour === "final") {
        throw new EmailDeliveryError("fake: 422 validation_error: nope", false, {
          provider: "fake",
          status: 422,
          providerCode: "validation_error",
        });
      }
      if (behaviour === "retryable") {
        throw new EmailDeliveryError("fake: 503: down", true, { provider: "fake", status: 503 });
      }
      if (behaviour === "explode") throw new TypeError("transport bug");
      return { provider: "fake", providerMessageId: `fake_${sent.length}` };
    },
  };
}

describe("createEmailService — routing", () => {
  test("with a started queue, send() files an email.deliver job and returns queued", async () => {
    const outbox = fakeOutbox();
    const t = recordingTransport();
    const svc = createEmailService({
      transport: t,
      outbox: () => outbox.boss,
      newMessageId: () => "em_queued_1",
      now: () => new Date("2026-09-22T10:00:00Z"),
    });

    const result = await svc.send(
      message({ context: { organizationId: "org_1", userId: "usr_1" } }),
    );

    expect(result).toEqual({
      status: "queued",
      sent: false,
      messageId: "em_queued_1",
      recipient: "john@example.com",
    });
    expect(t.sent).toHaveLength(0);
    expect(outbox.sent).toHaveLength(1);
    expect(outbox.sent[0]!.name).toBe("email.deliver");
    expect(outbox.sent[0]!.data).toEqual({
      messageId: "em_queued_1",
      kind: "verification",
      to: ["john@example.com"],
      subject: "Verify your Nawebeus email",
      html: "<p>Click <a href='https://example.com/verify?token=abc'>here</a></p>",
      text: undefined,
      from: undefined,
      replyTo: undefined,
      organizationId: "org_1",
      userId: "usr_1",
      createdAt: "2026-09-22T10:00:00.000Z",
    });
  });

  test("with no queue, send() delivers directly and returns sent with the provider id", async () => {
    const t = recordingTransport();
    const svc = createEmailService({ transport: t, outbox: () => undefined });
    const result = await svc.send(message());
    expect(result.status).toBe("sent");
    expect(result.sent).toBe(true);
    expect(result.providerMessageId).toBe("fake_1");
    expect(result.recipient).toBe("john@example.com");
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.messageId).toBe(result.messageId);
  });

  test("when the queue exists but the enqueue throws (boot race), send() falls back to a direct send", async () => {
    const outbox = fakeOutbox("throw");
    const t = recordingTransport();
    const log: string[] = [];
    const svc = createEmailService({
      transport: t,
      outbox: () => outbox.boss,
      log: (line) => log.push(line),
    });

    const result = await svc.send(message());

    expect(result.status).toBe("sent");
    expect(t.sent).toHaveLength(1);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain("outbox unavailable");
    expect(log[0]).toContain("Queue email.deliver does not exist");
    // The log line names the recipient masked, never in clear.
    expect(log[0]).toContain("j***@example.com");
    expect(log[0]).not.toContain("john@example.com");
  });

  test("a provider failure on the direct path is a failed result, never a thrown error", async () => {
    const log: string[] = [];
    for (const behaviour of ["final", "retryable", "explode"] as const) {
      const t = recordingTransport(behaviour);
      const svc = createEmailService({
        transport: t,
        outbox: () => undefined,
        log: (line) => log.push(line),
      });
      const result = await svc.send(message());
      expect(result.status).toBe("failed");
      expect(result.sent).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.messageId).toMatch(/^em_/);
    }
    expect(log).toHaveLength(3);
    expect(log[0]).toContain("not delivered");
    expect(log[0]).toContain("validation_error");
    expect(log[2]).toContain("transport bug");
    for (const line of log) expect(line).not.toContain("john@example.com");
  });

  test("deliver() is the transport call itself: it throws what the transport throws", async () => {
    const svc = createEmailService({
      transport: recordingTransport("retryable"),
      outbox: () => undefined,
    });
    await expect(svc.deliver(envelope())).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(svc.transportName).toBe("fake");
  });

  test("a message with no recipient is a caller bug and does throw", async () => {
    const svc = createEmailService({ transport: recordingTransport(), outbox: () => undefined });
    await expect(svc.send(message({ to: [] }))).rejects.toThrow(/at least one recipient/);
  });
});

describe("ResendEmailTransport — over a real socket", () => {
  test("the global fetch carries the same request to an HTTP server (what the smoke script exercises)", async () => {
    const received: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body: unknown;
    }[] = [];
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(request) {
        received.push({
          method: request.method,
          path: new URL(request.url).pathname,
          headers: Object.fromEntries(request.headers.entries()),
          body: await request.json(),
        });
        return Response.json({ id: "re_over_the_wire" });
      },
    });
    try {
      const t = new ResendEmailTransport({
        apiKey: "re_socket",
        from: "Nawebeus <no-reply@nawebeus.com>",
        baseUrl: `http://127.0.0.1:${server.port}`,
      });
      const receipt = await t.send(envelope({ messageId: "em_socket" }));
      expect(receipt).toEqual({ provider: "resend", providerMessageId: "re_over_the_wire" });
    } finally {
      server.stop(true);
    }
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      method: "POST",
      path: "/emails",
      headers: {
        authorization: "Bearer re_socket",
        "content-type": "application/json",
        "idempotency-key": "em_socket",
      },
      body: { from: "Nawebeus <no-reply@nawebeus.com>", to: ["john@example.com"] },
    });
  });
});

describe("email:smoke argument parsing", () => {
  test("requires --to, validates --kind, and defaults the rest", async () => {
    const { parseSmokeArgs } = await import("../scripts/email-smoke");
    expect(parseSmokeArgs(["--to", "me@example.com"])).toEqual({
      to: "me@example.com",
      kind: "verification",
      allowConsole: false,
    });
    expect(
      parseSmokeArgs(["--to", "me@example.com", "--kind", "invitation", "--allow-console"]),
    ).toEqual({ to: "me@example.com", kind: "invitation", allowConsole: true });
    expect(parseSmokeArgs([])).toEqual({ error: "--to <address> is required" });
    expect(parseSmokeArgs(["--to", "nope"])).toEqual({ error: "--to <address> is required" });
    expect(parseSmokeArgs(["--to", "a@b.co", "--kind", "newsletter"])).toMatchObject({
      error: expect.stringContaining("--kind must be one of"),
    });
    expect(parseSmokeArgs(["--wat"])).toEqual({ error: "unknown argument: --wat" });
    expect(parseSmokeArgs(["--help"])).toEqual({ error: "" });
  });
});

describe("createEmailTransport — config → transport", () => {
  test("no config, or a console provider, is the console transport", () => {
    expect(createEmailTransport(undefined).name).toBe("console");
    expect(createEmailTransport({ EMAIL_PROVIDER_RESOLVED: "console" } as never).name).toBe(
      "console",
    );
  });

  test("a resend provider with its key and sender is the Resend transport", () => {
    const t = createEmailTransport({
      EMAIL_PROVIDER_RESOLVED: "resend",
      RESEND_API_KEY: "re_1",
      EMAIL_FROM: "a@b.co",
      RESEND_API_BASE_URL: "https://api.resend.com",
      EMAIL_SEND_TIMEOUT_MS: 10_000,
    } as never);
    expect(t).toBeInstanceOf(ResendEmailTransport);
  });

  test("a resend provider without the keys config guarantees is refused loudly", () => {
    expect(() => createEmailTransport({ EMAIL_PROVIDER_RESOLVED: "resend" } as never)).toThrow(
      /RESEND_API_KEY and EMAIL_FROM/,
    );
  });

  test("the process-wide service is a plain object with a send method (the test seam)", () => {
    expect(typeof emailService.send).toBe("function");
    expect(typeof emailService.deliver).toBe("function");
    expect(Object.getPrototypeOf(emailService)).toBe(Object.prototype);
  });
});
