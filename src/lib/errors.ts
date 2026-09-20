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
