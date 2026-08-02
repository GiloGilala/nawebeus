import type { AppError } from "./errors";

export interface SuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export function success<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
  return { data, ...(meta ? { meta } : {}) };
}

export function err(error: AppError): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...("details" in error && error.details
        ? { details: error.details as { field: string; message: string }[] }
        : {}),
    },
  };
}
