import { afterAll, describe, expect, test } from "bun:test";
import { loadConfig, tryGetConfig } from "../lib/config";

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

/**
 * The email keys (NWB-P1-004, DEC-028). The interesting behaviour is the *derivation*: a Resend
 * key alone selects Resend, nothing selects the console — except in production, where "nothing"
 * is refused so that an unset key cannot quietly turn every verification link into a log line.
 */
describe("config: email transport (EMAIL_PROVIDER / RESEND_* / EMAIL_FROM)", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://localhost:5432/test",
    JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  };

  afterAll(() => {
    try {
      loadConfig();
    } catch {
      // See above: a no-DB runner has nothing to restore to.
    }
  });

  test("a development env with no email keys resolves to the console transport", () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.EMAIL_PROVIDER).toBeUndefined();
    expect(config.EMAIL_PROVIDER_RESOLVED).toBe("console");
    expect(config.RESEND_API_BASE_URL).toBe("https://api.resend.com");
    expect(config.EMAIL_SEND_TIMEOUT_MS).toBe(10_000);
    expect(config.EMAIL_FROM).toBeUndefined();
  });

  test("a Resend key alone selects Resend — and then demands a sender", () => {
    expect(() => loadConfig({ ...baseEnv, RESEND_API_KEY: "re_123" })).toThrow(
      /EMAIL_FROM: required for the Resend transport/,
    );
    const config = loadConfig({
      ...baseEnv,
      RESEND_API_KEY: "re_123",
      EMAIL_FROM: "Nawebeus <no-reply@nawebeus.com>",
      EMAIL_REPLY_TO: "help@nawebeus.com",
      RESEND_API_BASE_URL: "http://localhost:9999/",
      EMAIL_SEND_TIMEOUT_MS: "5000",
    });
    expect(config.EMAIL_PROVIDER_RESOLVED).toBe("resend");
    expect(config.EMAIL_FROM).toBe("Nawebeus <no-reply@nawebeus.com>");
    expect(config.EMAIL_REPLY_TO).toBe("help@nawebeus.com");
    expect(config.RESEND_API_BASE_URL).toBe("http://localhost:9999");
    expect(config.EMAIL_SEND_TIMEOUT_MS).toBe(5000);
  });

  test("EMAIL_PROVIDER=resend without a key is a typo, not a choice", () => {
    expect(() =>
      loadConfig({ ...baseEnv, EMAIL_PROVIDER: "resend", EMAIL_FROM: "a@b.co" }),
    ).toThrow(/RESEND_API_KEY: required when EMAIL_PROVIDER=resend/);
  });

  test("EMAIL_PROVIDER=console wins over a present key", () => {
    const config = loadConfig({ ...baseEnv, EMAIL_PROVIDER: "console", RESEND_API_KEY: "re_1" });
    expect(config.EMAIL_PROVIDER_RESOLVED).toBe("console");
  });

  test("blank values are unset, so a copied .env.example does not select Resend", () => {
    const config = loadConfig({ ...baseEnv, RESEND_API_KEY: "  ", EMAIL_FROM: "" });
    expect(config.EMAIL_PROVIDER_RESOLVED).toBe("console");
    expect(config.RESEND_API_KEY).toBeUndefined();
  });

  test("sender and reply-to must look like mailboxes; the base URL must be http(s)", () => {
    const resend = { RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.co" };
    expect(() => loadConfig({ ...baseEnv, ...resend, EMAIL_FROM: "not an address" })).toThrow(
      /EMAIL_FROM must be an email address/,
    );
    expect(() => loadConfig({ ...baseEnv, ...resend, EMAIL_REPLY_TO: "<>" })).toThrow(
      /EMAIL_REPLY_TO must be an email address/,
    );
    expect(() => loadConfig({ ...baseEnv, ...resend, RESEND_API_BASE_URL: "ftp://x" })).toThrow(
      /RESEND_API_BASE_URL must be a single http\(s\) URL/,
    );
    expect(() => loadConfig({ ...baseEnv, ...resend, EMAIL_SEND_TIMEOUT_MS: "100" })).toThrow(
      /EMAIL_SEND_TIMEOUT_MS/,
    );
    expect(
      loadConfig({ ...baseEnv, ...resend, EMAIL_FROM: "Ops Team <ops@b.co>" }).EMAIL_FROM,
    ).toBe("Ops Team <ops@b.co>");
  });

  test("production refuses console-by-omission but accepts it when stated", () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: "production" })).toThrow(
      /EMAIL_PROVIDER: production needs a real email provider/,
    );
    expect(
      loadConfig({ ...baseEnv, NODE_ENV: "production", EMAIL_PROVIDER: "console" })
        .EMAIL_PROVIDER_RESOLVED,
    ).toBe("console");
    expect(
      loadConfig({
        ...baseEnv,
        NODE_ENV: "production",
        RESEND_API_KEY: "re_1",
        EMAIL_FROM: "a@b.co",
      }).EMAIL_PROVIDER_RESOLVED,
    ).toBe("resend");
  });

  test("tryGetConfig returns the loaded singleton and never throws", () => {
    const loaded = loadConfig({ ...baseEnv });
    expect(tryGetConfig()).toBe(loaded);
  });
});
