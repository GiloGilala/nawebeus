import { afterAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../lib/config";

/**
 * Env-schema parsing for the NWB-P0-017 variables (CORS_ORIGIN list,
 * TRUSTED_PROXY_CIDRS). Each case passes an explicit env object so the tests
 * never depend on ambient process.env; the singleton is restored
 * best-effort afterwards for whatever suite runs next.
 */
describe("config: CORS_ORIGIN / TRUSTED_PROXY_CIDRS", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://localhost:5432/test",
    JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  };

  afterAll(() => {
    try {
      loadConfig();
    } catch {
      // No-DB runners have no ambient DATABASE_URL; the leftover singleton is
      // harmless (every consumer re-loads or tolerates placeholders).
    }
  });

  test("defaults: single localhost origin + RFC1918/loopback proxies", () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.CORS_ORIGIN).toEqual(["http://localhost:3000"]);
    expect(config.TRUSTED_PROXY_CIDRS).toHaveLength(5);
  });

  test("origin list: split, trimmed, canonicalised, deduped", () => {
    const config = loadConfig({
      ...baseEnv,
      CORS_ORIGIN: " https://app.example.com/,HTTP://LOCALHOST:3000,https://app.example.com ",
    });
    expect(config.CORS_ORIGIN).toEqual(["https://app.example.com", "http://localhost:3000"]);
  });

  test("origin list rejects '*', garbage, empties, and non-http(s) schemes", () => {
    for (const bad of [
      "*",
      "https://ok.example.com, *",
      "not-a-url",
      "",
      "   ",
      "ftp://x.example",
    ]) {
      expect(() => loadConfig({ ...baseEnv, CORS_ORIGIN: bad })).toThrow(
        /Config validation failed/,
      );
    }
  });

  test("proxy CIDRs: custom list parses; invalid entries fail fast", () => {
    const config = loadConfig({
      ...baseEnv,
      TRUSTED_PROXY_CIDRS: "203.0.113.0/24, 2001:db8::/32",
    });
    expect(config.TRUSTED_PROXY_CIDRS).toHaveLength(2);
    expect(() => loadConfig({ ...baseEnv, TRUSTED_PROXY_CIDRS: "10.0.0.0/33" })).toThrow(
      /Config validation failed/,
    );
    expect(() => loadConfig({ ...baseEnv, TRUSTED_PROXY_CIDRS: "honeypot" })).toThrow(
      /Config validation failed/,
    );
  });
});
