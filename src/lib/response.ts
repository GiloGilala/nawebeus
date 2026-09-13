import type { AppError } from "./errors";

export interface SuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[] | Record<string, unknown>;
  };
}

export function success<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
  return { data, ...(meta ? { meta } : {}) };
}

export function err(error: AppError): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if ("details" in error && error.details) {
    envelope.error.details = error.details as {
      field: string;
      message: string;
    }[];
  } else if ("lockedUntil" in error && (error as { lockedUntil?: Date }).lockedUntil) {
    envelope.error.details = {
      lockedUntil: (error as { lockedUntil: Date }).lockedUntil.toISOString(),
    };
  }
  return envelope;
}
