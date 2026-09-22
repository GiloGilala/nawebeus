import { describe, expect, test } from "bun:test";
import { logger, sanitizeFields } from "@/lib/logger";

describe("structured logger", () => {
  test("redacts secret and PII keys", () => {
    const sanitized = sanitizeFields({
      password: "hunter2",
      accessToken: "abc",
      email: "ada@example.com",
      organizationId: "org-1",
      nested: { jwt: "secret", count: 2 },
      tags: ["ok"],
    });
    expect(sanitized).toBeDefined();
    const fields = sanitized as NonNullable<typeof sanitized>;
    expect(fields.password).toBe("[redacted]");
    expect(fields.accessToken).toBe("[redacted]");
    expect(fields.email).toBe("[redacted]");
    expect(fields.organizationId).toBe("org-1");
    expect(fields.tags).toEqual(["ok"]);
    const nested = fields.nested as { jwt: string; count: number };
    expect(nested.jwt).toBe("[redacted]");
    expect(nested.count).toBe(2);
  });

  test("sanitizeFields returns undefined for missing fields", () => {
    expect(sanitizeFields(undefined)).toBeUndefined();
  });

  test("logger writes JSON lines to stderr without throwing", () => {
    logger.debug("debug");
    logger.info("created", { organizationId: "org-1" });
    logger.warn("slow");
    logger.error("failed", { password: "nope" });
  });
});
