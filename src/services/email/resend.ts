/**
 * The Resend transport (DEC-028, NWB-P1-004) — `POST {base}/emails` over Bun's `fetch`.
 *
 * **No SDK, on purpose.** Resend's API surface this codebase uses is one endpoint with one JSON
 * body; the `resend` package wraps the same call and would be a dependency whose only job is to
 * hide the request this file wants to be able to read, fake and pin. `fetch` is a constructor
 * option so the suite drives the real request/response mapping against a stub, and
 * `bun run email:smoke` drives it against the real thing.
 *
 * **Idempotency.** Every request carries `Idempotency-Key: <envelope.messageId>`. Resend caches the
 * outcome for 24 hours per key, so a retry after "we sent it and the connection dropped before the
 * 200 arrived" returns the original id instead of a second email — which is the failure mode an
 * at-least-once outbox has to plan for.
 *
 * **Retryable or not is decided here**, once, where the status and the error name are known
 * (`EmailDeliveryError.retryable`): 429 (rate limit or daily quota), 5xx, timeouts and network
 * failures are worth another try; 4xx otherwise (a validation error, an unverified sender, a bad
 * key) will fail the same way again, and the worker records those instead of retrying them.
 */
import { describeError, EmailDeliveryError } from "../../lib/errors";
import type { EmailEnvelope, EmailTransport, EmailTransportReceipt } from "./types";

export const RESEND_DEFAULT_BASE_URL = "https://api.resend.com";
export const RESEND_PROVIDER_NAME = "resend";

export interface ResendTransportOptions {
  readonly apiKey: string;
  /** The verified sender every message defaults to, `Nawebeus <no-reply@…>`. */
  readonly from: string;
  readonly replyTo?: string | undefined;
  readonly baseUrl?: string | undefined;
  /** Default 10 s; a provider call that takes longer is a retryable timeout, not a hung request. */
  readonly timeoutMs?: number | undefined;
  /** Injected for tests; production uses the global. */
  readonly fetch?: typeof fetch | undefined;
}

/** The JSON Resend answers a failed request with. Shape from its docs; every field optional in practice. */
interface ResendProblem {
  readonly statusCode?: number;
  readonly name?: string;
  readonly message?: string;
}

/** The request body `POST /emails` takes — the subset this codebase sends. */
export interface ResendSendRequest {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly reply_to?: string;
  readonly tags?: readonly { readonly name: string; readonly value: string }[];
}

export class ResendEmailTransport implements EmailTransport {
  readonly name = RESEND_PROVIDER_NAME;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ResendTransportOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new Error("ResendEmailTransport: apiKey is required");
    }
    if (options.from.trim().length === 0) {
      throw new Error("ResendEmailTransport: from is required");
    }
    this.baseUrl = (options.baseUrl ?? RESEND_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /** The exact body a given envelope produces — exported through a method so the tests can pin it. */
  requestBodyFor(envelope: EmailEnvelope): ResendSendRequest {
    const replyTo = envelope.replyTo ?? this.options.replyTo;
    return {
      from: envelope.from ?? this.options.from,
      to: [...envelope.to],
      subject: envelope.subject,
      html: envelope.html,
      ...(envelope.text !== undefined ? { text: envelope.text } : {}),
      ...(replyTo !== undefined ? { reply_to: replyTo } : {}),
      // Resend tags take ASCII letters, digits, `_` and `-` — every `EmailKind` qualifies.
      tags: [{ name: "kind", value: envelope.kind }],
    };
  }

  async send(envelope: EmailEnvelope): Promise<EmailTransportReceipt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": envelope.messageId,
        },
        body: JSON.stringify(this.requestBodyFor(envelope)),
        signal: controller.signal,
      });
    } catch (error) {
      // Nothing was answered, so nothing can be known — both branches are retryable.
      const timedOut = controller.signal.aborted;
      throw new EmailDeliveryError(
        timedOut
          ? `resend: no response within ${this.timeoutMs}ms`
          : `resend: request failed: ${describeError(error)}`,
        true,
        { provider: this.name, ...(timedOut ? { providerCode: "timeout" } : {}) },
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      const body = await readJson(response);
      const id = body && typeof body.id === "string" ? body.id : undefined;
      return { provider: this.name, ...(id !== undefined ? { providerMessageId: id } : {}) };
    }

    const problem = ((await readJson(response)) ?? {}) as ResendProblem;
    const providerCode = typeof problem.name === "string" ? problem.name : undefined;
    const detail = typeof problem.message === "string" ? problem.message : response.statusText;
    const retryAfter = response.headers.get("retry-after");
    throw new EmailDeliveryError(
      `resend: ${response.status}${providerCode ? ` ${providerCode}` : ""}: ${detail || "request rejected"}${retryAfter ? ` (retry-after ${retryAfter}s)` : ""}`,
      isRetryableStatus(response.status, providerCode),
      { provider: this.name, status: response.status, ...(providerCode ? { providerCode } : {}) },
    );
  }
}

/**
 * Which rejections are worth another attempt. 429 covers both `rate_limit_exceeded` and
 * `daily_quota_exceeded`; 5xx is the provider's problem; 408 is a proxy timeout. The one 409 that
 * clears on its own is a concurrent request with the same idempotency key — the earlier one wins
 * and the retry reads its cached result. Everything else is a fact about the request.
 */
export function isRetryableStatus(status: number, providerCode?: string): boolean {
  if (status === 429 || status === 408 || status >= 500) return true;
  if (status === 409 && providerCode === "concurrent_idempotent_requests") return true;
  return false;
}

async function readJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = await response.json();
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
