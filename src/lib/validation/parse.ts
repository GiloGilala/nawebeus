/**
 * Shared Zod → ValidationError adapter.
 *
 * Every Server Function and every Hono route must surface the same 422 contract
 * (tanstack-start.md §4, §14). Raw `ZodError` is not an `AppError` and would
 * otherwise become an opaque 500.
 */

import { z } from "zod";
import { ValidationError } from "@/lib/errors";

export function zodIssues(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "_root",
    message: issue.message,
  }));
}

export function isZodError(error: unknown): error is z.ZodError {
  if (error instanceof z.ZodError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}

export function validationErrorFromZod(
  error: z.ZodError,
  message = "Validation failed",
): ValidationError {
  return new ValidationError(message, zodIssues(error));
}

/** Parse `data` with `schema`, throwing `ValidationError` on failure. */
export function parseWithValidation<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw validationErrorFromZod(result.error);
  }
  return result.data;
}
