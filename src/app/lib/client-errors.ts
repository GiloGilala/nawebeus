/**
 * Client-side handling of the shared error contract (tanstack-start.md §6.3, §14).
 *
 * One mapper, reused by Server Function `useMutation` callers and (when the
 * web talks to Hono) `api.*` clients. Never leak internal ids in the message.
 */

import { AppError } from "@/lib/errors";

export function messageForAppError(error: unknown): string {
  if (error instanceof AppError) {
    if (error.statusCode === 402) return "Upgrade your plan to continue.";
    if (error.statusCode === 403) return "You do not have permission to do that.";
    if (error.statusCode === 401) return "Please sign in again.";
    if (error.statusCode === 404) return error.message || "Not found.";
    if (error.statusCode === 409) return error.message;
    if (error.statusCode === 422 || error.statusCode === 400) return error.message;
    if (error.statusCode === 429) return "Too many requests. Try again shortly.";
    return "An unexpected error occurred.";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
