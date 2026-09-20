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

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
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

/**
 * The DSAR export package existed but its re-download window has passed
 * (HTTP 410 Gone — the resource was deliberately removed, not merely missing).
 */
export class ExportExpiredError extends AppError {
  readonly statusCode = 410;
  readonly code = "EXPORT_EXPIRED";
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";
}
