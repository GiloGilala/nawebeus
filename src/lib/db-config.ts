/**
 * Single source of truth for database connection settings.
 *
 * NWB-P0-009: `drizzle.config.ts` used to read `DB_HOST`/`DB_PORT`/`DB_NAME`/
 * `DB_USER`/`DB_PASSWORD` while the app, the seed script, and every test suite
 * read `DATABASE_URL`. Setting only `DATABASE_URL` made `db:push` silently
 * target the default `nawebeus` database — a plausible route to pushing schema
 * changes at the wrong database. This module makes `DATABASE_URL` the one
 * source of truth and turns any `DB_*` disagreement into a loud failure:
 *
 * - `DATABASE_URL` set → it wins. Each `DB_*` variable that is also set must
 *   describe the same database, or an error is thrown naming both values.
 * - `DATABASE_URL` unset → the URL is built from `DB_*` with the historical
 *   defaults (localhost:5432, database `nawebeus`, user `postgres`, no
 *   password), so ad-hoc `drizzle-kit` invocations keep working.
 *
 * Pure and dependency-free so both `drizzle.config.ts` (loaded by drizzle-kit's
 * esbuild loader) and the unit tests can import it without touching the app
 * config singleton.
 */

export interface DbUrlParts {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

const DEFAULT_PARTS: DbUrlParts = {
  host: "localhost",
  port: "5432",
  database: "nawebeus",
  user: "postgres",
  password: "",
};

/** Parse a postgres:// or postgresql:// URL into its credential parts. */
export function parseDatabaseUrl(url: string): DbUrlParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid URL — got a value that cannot be parsed. See NWB-P0-009.`,
    );
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      `DATABASE_URL must use the postgres:// or postgresql:// scheme (got "${parsed.protocol}").`,
    );
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error(
      `DATABASE_URL has no host — it must name the database server (e.g. postgresql://user:password@localhost:5432/nawebeus).`,
    );
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error(
      `DATABASE_URL has no database name — it must end with the database to connect to (e.g. .../nawebeus).`,
    );
  }
  return {
    host,
    port: parsed.port || DEFAULT_PARTS.port,
    database,
    user: parsed.username ? decodeURIComponent(parsed.username) : DEFAULT_PARTS.user,
    password: parsed.password ? decodeURIComponent(parsed.password) : "",
  };
}

/** Build a postgres:// URL from credential parts. */
export function buildDatabaseUrl(parts: DbUrlParts): string {
  const auth =
    parts.user || parts.password
      ? `${encodeURIComponent(parts.user)}${parts.password ? `:${encodeURIComponent(parts.password)}` : ""}@`
      : "";
  return `postgresql://${auth}${parts.host}:${parts.port}/${parts.database}`;
}

export interface ResolvedDbCredentials {
  /** Connection URL — pass this to the driver / drizzle-kit `dbCredentials.url`. */
  url: string;
  /** Which variable block won. For diagnostics and tests. */
  source: "DATABASE_URL" | "DB_*";
}

/**
 * Resolve the database connection from an environment record.
 * Throws when `DATABASE_URL` and any `DB_*` variable describe different
 * databases — the two must never disagree silently (NWB-P0-009).
 */
export function resolveDbCredentials(
  env: Record<string, string | undefined>,
): ResolvedDbCredentials {
  const databaseUrl = env.DATABASE_URL?.trim();
  const overrides = {
    host: emptyToUndefined(env.DB_HOST),
    port: emptyToUndefined(env.DB_PORT),
    database: emptyToUndefined(env.DB_NAME),
    user: emptyToUndefined(env.DB_USER),
    // Deliberately not trimmed: a password may legitimately contain spaces.
    password: emptyToUndefined(env.DB_PASSWORD),
  };

  if (!databaseUrl) {
    const parts: DbUrlParts = {
      ...DEFAULT_PARTS,
      host: overrides.host ?? DEFAULT_PARTS.host,
      port: overrides.port ?? DEFAULT_PARTS.port,
      database: overrides.database ?? DEFAULT_PARTS.database,
      user: overrides.user ?? DEFAULT_PARTS.user,
      password: overrides.password ?? DEFAULT_PARTS.password,
    };
    return { url: buildDatabaseUrl(parts), source: "DB_*" };
  }

  const parts = parseDatabaseUrl(databaseUrl);
  const conflicts: string[] = [];

  if (overrides.host && overrides.host !== parts.host) {
    conflicts.push(`DB_HOST="${overrides.host}" but DATABASE_URL points at host "${parts.host}"`);
  }
  if (overrides.port && toPort(overrides.port) !== toPort(parts.port)) {
    conflicts.push(`DB_PORT="${overrides.port}" but DATABASE_URL points at port "${parts.port}"`);
  }
  if (overrides.database && overrides.database !== parts.database) {
    conflicts.push(
      `DB_NAME="${overrides.database}" but DATABASE_URL points at database "${parts.database}"`,
    );
  }
  if (overrides.user && overrides.user !== parts.user) {
    conflicts.push(`DB_USER="${overrides.user}" but DATABASE_URL points at user "${parts.user}"`);
  }
  if (overrides.password !== undefined && overrides.password !== parts.password) {
    conflicts.push(`DB_PASSWORD is set but does not match the password in DATABASE_URL`);
  }

  if (conflicts.length > 0) {
    throw new Error(
      [
        "Refusing to connect: DATABASE_URL and the DB_* variables describe different databases.",
        ...conflicts.map((c) => `  - ${c}`),
        `Fix one of the two so they agree (see NWB-P0-009). DATABASE_URL wins: only it needs to be set.`,
      ].join("\n"),
    );
  }

  return { url: databaseUrl, source: "DATABASE_URL" };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toPort(value: string): string {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? String(n) : value;
}
