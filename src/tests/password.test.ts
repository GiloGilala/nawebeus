import { describe, expect, test } from "bun:test";
import { PASSWORD_RULES, validatePassword } from "../lib/password";

describe("validatePassword", () => {
  const base = "Str0ng!Passw0rd";

  test("accepts a strong password", () => {
    expect(validatePassword(base).valid).toBe(true);
  });

  test("rejects passwords shorter than 12 characters", () => {
    const result = validatePassword("Str0ng!Pass");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 12 characters");
  });

  test("rejects passwords longer than 128 characters", () => {
    const result = validatePassword(base + "x".repeat(120));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at most 128 characters");
  });

  test("rejects passwords without uppercase", () => {
    const result = validatePassword("str0ng!password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one uppercase letter (A–Z)");
  });

  test("rejects passwords without lowercase", () => {
    const result = validatePassword("STR0NG!PASSWORD");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one lowercase letter (a–z)");
  });

  test("rejects passwords without a number", () => {
    const result = validatePassword("Strong!Password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one number (0–9)");
  });

  test("rejects passwords without a special character", () => {
    const result = validatePassword("StrongPassword123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
    );
  });

  test("rejects passwords containing the username", () => {
    const result = validatePassword("Str0ng!Passw0rdjohnjohn", {
      username: "john",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must not contain the username");
  });

  test("rejects passwords containing the email local part", () => {
    const result = validatePassword("Str0ng!Passw0rdjohn", {
      email: "john@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must not contain the email address");
  });

  test("rejects common passwords", () => {
    const result = validatePassword("Password123!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password is too common");
  });

  test("rejects passwords with whitespace", () => {
    const result = validatePassword("Str0ng! Passw0rd");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must not contain spaces");
  });

  test("returns all applicable errors at once", () => {
    const result = validatePassword("short");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  test("PASSWORD_RULES exposes the configured limits", () => {
    expect(PASSWORD_RULES.MIN_LENGTH).toBe(12);
    expect(PASSWORD_RULES.MAX_LENGTH).toBe(128);
    expect(PASSWORD_RULES.HISTORY_SIZE).toBe(5);
  });
});
