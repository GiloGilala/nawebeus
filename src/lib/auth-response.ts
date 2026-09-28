/**
 * The canonical service → transport contract (domain module pattern).
 *
 * Services (the `service` slot of a domain module) never throw for
 * *expected* domain failures and never build transport payloads. They return
 * an {@link AuthResponse}:
 *
 * - `AuthResponse.ok(data, { status?, meta?, warnings? })` — the operation
 *   succeeded. `warnings` carries non-fatal side-effect notes (the client
 *   surfaces them; they are not errors). `status` is 201 for creations,
 *   200 otherwise.
 * - `AuthResponse.failure(appError)` — the operation was refused by a
 *   *domain* rule. The failure is built from an `AppError` subclass, so the
 *   code and status come from the canonical error hierarchy (`NotFoundError`,
 *   `ValidationError`, `ConflictError`, …) — a domain never invents its own
 *   error protocol; it names the error class and the rest follows.
 *
 * **Unexpected failures propagate.** A service that hits something it did not
 * model (driver failure, constraint it did not expect, bug) must *not* catch
 * it — it throws, and the central `errorHandler` owns the 5xx mapping
 * (including the 500 log line). Catching-and-wrapping unexpected errors
 * here would lose the stack and the central accounting.
 *
 * `processAuthResult` is the single translation point back to the HTTP
 * envelopes (`success(data, meta?)` / `err()`) for Hono routes; server
 * functions return the {@link AuthResponse} object itself, which the web app
 * branches on (`.ok` / `.ok === false`).
 */
import type { AppError } from "./errors";
import type { ErrorEnvelope, SuccessEnvelope } from "./response";
import { success } from "./response";

export interface AuthResponseSuccess<T> {
  readonly ok: true;
  readonly data: T;
  /** HTTP status for this success — 201 for creations, 200 otherwise. */
  readonly status?: number | undefined;
  /** Free-form metadata (e.g. `pagination`) — merged into the envelope's `meta`. */
  readonly meta?: Record<string, unknown> | undefined;
  /** Non-fatal side-effect notes, surfaced to the client in `meta.warnings`. */
  readonly warnings?: string[] | undefined;
}

export interface AuthResponseFailure {
  readonly ok: false;
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  /** Field-level details (validation) or a structured context object. */
  readonly details?: { field: string; message: string }[] | Record<string, unknown>;
}

export type AuthResponse<T> = AuthResponseSuccess<T> | AuthResponseFailure;

interface OkOptions {
  status?: number | undefined;
  meta?: Record<string, unknown> | undefined;
  warnings?: string[] | undefined;
}

export const AuthResponse = {
  ok<T>(data: T, opts: OkOptions = {}): AuthResponse<T> {
    return {
      ok: true,
      data,
      ...(opts.status !== undefined ? { status: opts.status } : {}),
      ...(opts.meta !== undefined ? { meta: opts.meta } : {}),
      ...(opts.warnings && opts.warnings.length > 0 ? { warnings: opts.warnings } : {}),
    };
  },

  /**
   * Build a failure from a canonical `AppError`. This is the only way a
   * service reports an expected failure — the code, status and details all
   * derive from the error hierarchy, so two services can never disagree
   * about what `NOT_FOUND` means.
   */
  failure<T = never>(error: AppError): AuthResponse<T> {
    let details: { field: string; message: string }[] | Record<string, unknown> | undefined;
    if ("details" in error && error.details) {
      details = error.details as { field: string; message: string }[] | Record<string, unknown>;
    } else if ("lockedUntil" in error && (error as { lockedUntil?: Date }).lockedUntil) {
      details = {
        lockedUntil: (error as { lockedUntil: Date }).lockedUntil.toISOString(),
      };
    } else if (
      "retryAfter" in error &&
      typeof (error as { retryAfter?: unknown }).retryAfter === "number"
    ) {
      details = { retryAfter: (error as { retryAfter: number }).retryAfter };
    }
    return {
      ok: false,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(details !== undefined ? { details } : {}),
    };
  },

  isOk<T>(result: AuthResponse<T>): result is AuthResponseSuccess<T> {
    return result.ok === true;
  },
} as const;

export interface ProcessedAuthResult<T> {
  readonly status: number;
  readonly body: SuccessEnvelope<T> | ErrorEnvelope;
}

/**
 * Translate a service result into the HTTP response the route sends:
 * `c.json(processAuthResult(result).body, processAuthResult(result).status)`.
 *
 * Success → `success(data, meta)` with `meta` = the service's `meta` plus
 * `warnings` when present. Failure → the `err()` envelope shape exactly
 * (`{ error: { code, message, details? } }`), so the API contract is
 * identical to the legacy throw-and-errorHandler path.
 */
export function processAuthResult<T>(result: AuthResponse<T>): ProcessedAuthResult<T> {
  if (result.ok) {
    const meta: Record<string, unknown> = { ...result.meta };
    if (result.warnings && result.warnings.length > 0) {
      meta.warnings = result.warnings;
    }
    return {
      status: result.status ?? 200,
      body: success(result.data, Object.keys(meta).length > 0 ? meta : undefined),
    };
  }
  return {
    status: result.statusCode,
    body: {
      error: {
        code: result.code,
        message: result.message,
        ...(result.details !== undefined ? { details: result.details } : {}),
      },
    },
  };
}
