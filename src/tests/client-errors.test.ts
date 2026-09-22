import { describe, expect, test } from "bun:test";
import { messageForAppError } from "@/app/lib/client-errors";
import {
  AuthError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

describe("messageForAppError", () => {
  test("maps the shared error contract to client copy", () => {
    const unauthorized = new UnauthorizedError("Unauthorized");
    expect(unauthorized).toBeInstanceOf(AuthError);
    expect(messageForAppError(unauthorized)).toBe("Please sign in again.");
    expect(messageForAppError(new ForbiddenError("Forbidden"))).toBe(
      "You do not have permission to do that.",
    );
    expect(messageForAppError(new NotFoundError("Session not found"))).toBe("Session not found");
    expect(messageForAppError(new ValidationError("Name is required"))).toBe("Name is required");
    expect(messageForAppError(new RateLimitError("slow down", 30))).toBe(
      "Too many requests. Try again shortly.",
    );
    expect(messageForAppError(new InternalError("boom"))).toBe("An unexpected error occurred.");
  });

  test("falls back for unknown values", () => {
    expect(messageForAppError(new Error("boom"))).toBe("boom");
    expect(messageForAppError("nope")).toBe("An unexpected error occurred.");
  });
});
