export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly code!: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends AppError {
  readonly statusCode = 401;
  readonly code = "AUTH_ERROR" as string;
}

export class InvalidCredentialsError extends AppError {
  readonly statusCode = 401;
  readonly code = "INVALID_CREDENTIALS";
}

export class SessionExpiredError extends AppError {
  readonly statusCode = 401;
  readonly code = "SESSION_EXPIRED";
}

export class MfaRequiredError extends AppError {
  readonly statusCode = 401;
  readonly code = "MFA_REQUIRED";
}

export class MfaVerificationFailedError extends AppError {
  readonly statusCode = 401;
  readonly code = "MFA_VERIFICATION_FAILED";
}

export class AccountLockedError extends AppError {
  readonly statusCode = 423;
  readonly code = "ACCOUNT_LOCKED";

  constructor(
    message: string,
    readonly lockedUntil: Date,
  ) {
    super(message);
  }
}

/**
 * The credentials were right but the account is not allowed to hold a session
 * (`users.status = 'suspended'`). Distinct from `AccountLockedError`: a lockout
 * is temporary and self-clearing, a suspension is an administrator's decision.
 * Raised only after the password has been verified, so it cannot be used to
 * enumerate accounts.
 */
export class AccountSuspendedError extends AppError {
  readonly statusCode = 403;
  readonly code = "ACCOUNT_SUSPENDED";
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
}

/**
 * The resource existed but is no longer available and will not be again —
 * used by the DSAR export download once its 7-day window closes (NWB-P0-002):
 * distinct from 404 ("never existed or not yours") because the subject is
 * owed a clear "request a fresh export" message.
 */
export class GoneError extends AppError {
  readonly statusCode = 410;
  readonly code = "GONE";
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

/**
 * The caller asked to delete their account while still owning one or more
 * organizations. D16 (F-25, option 2 — refuse and report): `organizations.owner_id`
 * is a restrictive NOT NULL FK to `users(id)`, so the scheduled purge could never
 * remove an owner — it could only die on 23503 thirty days after promising erasure.
 * `deleteAccount` therefore refuses up front, before anything is written, naming
 * the blocking organizations so the caller can transfer ownership first. That gate
 * is what keeps `purgeExpiredAccounts` unreachable for an organization owner.
 */
export class OwnershipTransferRequiredError extends AppError {
  readonly statusCode = 409;
  readonly code = "OWNERSHIP_TRANSFER_REQUIRED";

  constructor(
    message: string,
    readonly details?: { organizations: { id: string; name: string }[] },
  ) {
    super(message);
  }
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMIT_EXCEEDED";

  constructor(
    message: string,
    readonly retryAfter: number,
  ) {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";
}

/**
 * A row's erasure was refused because its subject sits under an active legal hold (NWB-P1-010).
 *
 * Thrown by the hold checks in purge/retention `beforeDelete` hooks and caught per row by
 * `deleteRowsPerRow`, which counts it into `held` as well as `failed` — a held night still
 * reads `warning`, because erasure deferred is erasure outstanding. Lives here (not in the
 * retention service) so `src/lib/transaction.ts` can recognise it without a runtime edge into
 * `src/services/`. 423 like `AccountLockedError`: the resource exists but is locked.
 */
export class LegalHoldError extends AppError {
  readonly statusCode = 423;
  readonly code = "LEGAL_HOLD";

  constructor(
    message: string,
    readonly holdId: string,
  ) {
    super(message);
  }
}

/**
 * A one-line description of an unknown error, safe to log and to store.
 *
 * Exists because of a specific hole: a failed TCP connect surfaces as a Node
 * `AggregateError` whose own `message` is **empty** — its detail lives in
 * `.code` (`ECONNREFUSED`) and in `.errors[]`. So `error.message` alone printed
 * nothing at all while the queue runtime failed to start, which is the worst
 * possible thing for the one log line that explains why a background job is not
 * running. The same shape appears in every driver-level failure this codebase
 * can hit (pool timeouts, DNS, TLS), which is why it belongs next to the error
 * hierarchy rather than inside the queue.
 *
 * Full structured logging is NWB-P1-012's job; this stays a string formatter.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    // A thrown non-Error is precisely where an empty line is worst — `throw ""` from a driver
    // would print a prefix and nothing else. Say what arrived, not just that something did.
    const text = String(error);
    if (text.length > 0) return text;
    return `${typeof error} value: ${JSON.stringify(error) ?? text}`;
  }

  const code = (error as { code?: unknown }).code;
  const parts = [
    error.name === "Error" ? undefined : error.name,
    error.message.length > 0 ? error.message : undefined,
    typeof code === "string" ? `(${code})` : undefined,
  ].filter((part): part is string => part !== undefined);

  const nested = (error as { errors?: unknown }).errors;
  if (Array.isArray(nested) && nested.length > 0) {
    parts.push(nested.map((inner) => describeError(inner)).join("; "));
  }

  // An Error with no message, no code, and nothing inside it: say so, rather
  // than emit an empty string that reads as a formatting bug in the log.
  return parts.join(" ") || `${error.name || "Error"} (no message)`;
}
