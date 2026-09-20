import { describe, expect, test } from "bun:test";
import { buildDatabaseUrl, parseDatabaseUrl, resolveDbCredentials } from "../lib/db-config";

describe("parseDatabaseUrl", () => {
  test("parses a full URL into its parts", () => {
    const parts = parseDatabaseUrl("postgresql://postgres:postgres@localhost:5432/nawebeus_test");
    expect(parts).toEqual({
      host: "localhost",
      port: "5432",
      database: "nawebeus_test",
      user: "postgres",
      password: "postgres",
    });
  });

  test("accepts the postgres:// scheme", () => {
    expect(parseDatabaseUrl("postgres://u:p@db.example.com:6543/d").database).toBe("d");
  });

  test("defaults an omitted port to 5432", () => {
    expect(parseDatabaseUrl("postgresql://postgres@localhost/nawebeus").port).toBe("5432");
  });

  test("reads an omitted user as the postgres default", () => {
    expect(parseDatabaseUrl("postgresql://localhost/nawebeus").user).toBe("postgres");
  });

  test("decodes URL-encoded credentials", () => {
    const parts = parseDatabaseUrl("postgresql://us%40er:p%2Fss@localhost:5432/nawebeus");
    expect(parts.user).toBe("us@er");
    expect(parts.password).toBe("p/ss");
  });

  test("throws on a non-postgres scheme", () => {
    expect(() => parseDatabaseUrl("mysql://root@localhost/nawebeus")).toThrow(/postgres/);
  });

  test("throws on a URL without a database name", () => {
    expect(() => parseDatabaseUrl("postgresql://postgres@localhost:5432")!).toThrow(
      /no database name/,
    );
  });

  test("throws on garbage that is not a URL", () => {
    expect(() => parseDatabaseUrl("not a url")).toThrow(/not a valid URL/);
  });
});

describe("buildDatabaseUrl", () => {
  test("round-trips through parseDatabaseUrl", () => {
    const parts = {
      host: "localhost",
      port: "5432",
      database: "nawebeus",
      user: "postgres",
      password: "",
    };
    expect(parseDatabaseUrl(buildDatabaseUrl(parts))).toEqual(parts);
  });

  test("encodes special characters in credentials", () => {
    const url = buildDatabaseUrl({
      host: "localhost",
      port: "5432",
      database: "nawebeus",
      user: "us@er",
      password: "p/ss w ord",
    });
    const parsed = parseDatabaseUrl(url);
    expect(parsed.user).toBe("us@er");
    expect(parsed.password).toBe("p/ss w ord");
  });

  test("omits the auth section when user and password are empty", () => {
    const url = buildDatabaseUrl({
      host: "localhost",
      port: "5432",
      database: "nawebeus",
      user: "",
      password: "",
    });
    expect(url).toBe("postgresql://localhost:5432/nawebeus");
  });
});

describe("resolveDbCredentials", () => {
  test("prefers DATABASE_URL verbatim", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/nawebeus_test";
    const resolved = resolveDbCredentials({ DATABASE_URL: url });
    expect(resolved.url).toBe(url);
    expect(resolved.source).toBe("DATABASE_URL");
  });

  test("preserves URL query parameters (sslmode etc.)", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/nawebeus?sslmode=require";
    expect(resolveDbCredentials({ DATABASE_URL: url }).url).toBe(url);
  });

  test("builds the historical default when no variables are set", () => {
    const resolved = resolveDbCredentials({});
    expect(resolved.url).toBe("postgresql://postgres@localhost:5432/nawebeus");
    expect(resolved.source).toBe("DB_*");
  });

  test("builds a URL from DB_* when DATABASE_URL is unset", () => {
    const resolved = resolveDbCredentials({
      DB_HOST: "db.internal",
      DB_PORT: "6543",
      DB_NAME: "nawebeus_staging",
      DB_USER: "app",
      DB_PASSWORD: "secret",
    });
    expect(resolved.url).toBe("postgresql://app:secret@db.internal:6543/nawebeus_staging");
  });

  test("accepts DB_* variables that agree with DATABASE_URL", () => {
    const resolved = resolveDbCredentials({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus_test",
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "nawebeus_test",
      DB_USER: "postgres",
      DB_PASSWORD: "postgres",
    });
    expect(resolved.source).toBe("DATABASE_URL");
  });

  test("ignores empty DB_* variables next to DATABASE_URL", () => {
    const resolved = resolveDbCredentials({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus_test",
      DB_HOST: "",
      DB_PASSWORD: "",
    });
    expect(resolved.source).toBe("DATABASE_URL");
  });

  test("throws when DB_NAME points somewhere else", () => {
    expect(() =>
      resolveDbCredentials({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus_test",
        DB_NAME: "nawebeus",
      }),
    ).toThrow(/different databases[\s\S]*DB_NAME="nawebeus"/);
  });

  test("throws when DB_PORT disagrees", () => {
    expect(() =>
      resolveDbCredentials({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus",
        DB_PORT: "5433",
      }),
    ).toThrow(/DB_PORT="5433"/);
  });

  test("throws when DB_PASSWORD disagrees", () => {
    expect(() =>
      resolveDbCredentials({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus",
        DB_PASSWORD: "wrong",
      }),
    ).toThrow(/DB_PASSWORD/);
  });

  test("reports every conflict at once, not just the first", () => {
    try {
      resolveDbCredentials({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus_test",
        DB_HOST: "10.0.0.5",
        DB_NAME: "nawebeus",
      });
      throw new Error("expected resolveDbCredentials to throw");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      expect(message).toContain("DB_HOST");
      expect(message).toContain("DB_NAME");
    }
  });

  test("the old footgun — DATABASE_URL for *_test with default DB_* — now fails loudly", () => {
    // DB_NAME unset falls back to nothing when DATABASE_URL is set, so this
    // is fine; but an explicitly wrong DB_NAME must never pass silently.
    expect(() =>
      resolveDbCredentials({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nawebeus_test",
        DB_NAME: "nawebeus",
        DB_HOST: "localhost",
        DB_PORT: "5432",
        DB_USER: "postgres",
        DB_PASSWORD: "postgres",
      }),
    ).toThrow();
  });
});
