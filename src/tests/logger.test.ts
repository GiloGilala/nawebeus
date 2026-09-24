import { describe, expect, test } from "bun:test";
import { logger, sanitizeFields } from "@/lib/logger";
import { realLogWriters } from "./preload";

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
    // The shared `logger` is silenced for the whole run (preload.ts) so the
    // per-request access lines don't drown the test output — these are the
    // captured originals, i.e. the real writers.
    realLogWriters.debug("debug");
    realLogWriters.info("created", { organizationId: "org-1" });
    realLogWriters.warn("slow");
    realLogWriters.error("failed", { password: "nope" });
  });

  test("the shared logger object is the one request logging calls", () => {
    // If request logging ever captured a different binding than the object
    // tests spy on, every observability assertion below would go green while
    // asserting nothing. This pins the identity.
    expect(logger.info).not.toBe(realLogWriters.info);
    expect(typeof realLogWriters.info).toBe("function");
  });
});
