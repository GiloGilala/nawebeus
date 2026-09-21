import { z } from "zod";
import { DEFAULT_TRUSTED_PROXY_CIDRS, isCidrList, parseCidrList } from "./ip";

/** Dev default for CORS_ORIGIN — the local frontend. Kept in one place so the
 * server factory and the env schema cannot drift apart. */
export const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

/**
 * Validates a comma-separated CORS origin list: at least one entry, every
 * entry an http(s) URL, `*` rejected. CORS bypass must never be one env typo
 * away — an operator who truly needs an open API can say so in code, not in
 * config. Runs as the zod refine so failures surface with the standard
 * "Config validation failed" message.
 */
function isOriginList(raw: string): boolean {
  const entries = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (entries.length === 0) return false;
  return entries.every((o) => {
    if (o === "*") return false;
    try {
      const url = new URL(o);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

/**
 * Canonicalises a validated origin list: `URL.origin` lowercases the host,
 * drops default ports, and strips any path/query/fragment the operator may
 * have pasted (origins never carry them, and an un-normalised entry would
 * silently never match the browser-sent Origin).
 */
function parseOriginList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
        .map((o) => new URL(o).origin),
    ),
  ];
}

/** Values accepted for a boolean env var, after trimming and lowercasing. */
const BOOL_TRUE_VALUES = new Set(["true", "1", "yes"]);
const BOOL_FALSE_VALUES = new Set(["false", "0", "no"]);

/**
 * A boolean env var: `true|1|yes` / `false|0|no`, case-insensitive, empty treated as unset.
 *
 * `z.coerce.boolean()` is deliberately not used — it follows JS truthiness, so
 * `QUEUE_ENABLED=false` coerces to `true` and silently turns on a data-deleting worker. That is
 * the exact footgun this file exists to prevent (see the `CORS_ORIGIN` refine above for the last
 * time an "obvious" default was wrong in the dangerous direction).
 */
function boolEnv(defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim().toLowerCase()))
    .refine(
      (v) => v === undefined || v === "" || BOOL_TRUE_VALUES.has(v) || BOOL_FALSE_VALUES.has(v),
      { message: "must be one of: true, false, 1, 0, yes, no" },
    )
    .transform((v) => {
      if (v === undefined || v === "") return defaultValue;
      return BOOL_TRUE_VALUES.has(v);
    });
}

/** Five- or six-field cron expression; pg-boss's parser judges it properly, this only catches typos. */
function isCronExpression(raw: string): boolean {
  const fields = raw.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) return false;
  return fields.every((field) => /^[0-9A-Za-z*?,/#+-]+$/.test(field));
}

/** A per-job cron override: unset (or blank) means "use the schedule shipped in code". */
function cronEnv() {
  return z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim()))
    .refine((v) => v === undefined || v === "" || isCronExpression(v), {
      message: "must be a five-field cron expression, e.g. '45 2 * * *'",
    })
    .transform((v) => (v === undefined || v === "" ? undefined : v));
}

/** A bare PostgreSQL identifier — what `CREATE SCHEMA` will accept unquoted. */
function isPostgresIdentifier(raw: string): boolean {
  return /^[a-z_][a-z0-9_$]{0,62}$/.test(raw);
}

/** An IANA zone name, judged by the runtime that will have to use it. */
function isTimeZone(raw: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z
    .string()
    .default(DEFAULT_CORS_ORIGIN)
    .refine(isOriginList, {
      message: "CORS_ORIGIN must be a comma-separated list of http(s) URLs ('*' is not accepted)",
    })
    .transform(parseOriginList),
  TRUSTED_PROXY_CIDRS: z
    .string()
    .default(DEFAULT_TRUSTED_PROXY_CIDRS)
    .refine(isCidrList, {
      message:
        "TRUSTED_PROXY_CIDRS must be a comma-separated list of CIDRs (e.g. '10.0.0.0/8,::1/128')",
    })
    .transform(parseCidrList),

  /**
   * The base URL every emailed link is built from (NWB-P0-021, F-09/F-09b).
   *
   * Emailed links must be decided by the server, never by the request. Two
   * routes previously passed `c.req.header("origin")` into the email body, so
   * `Origin: https://evil.example.com` on an unauthenticated forgot-password
   * call put a *valid* reset token for someone else's account on an
   * attacker-controlled domain (reproduced before the fix). This value is the
   * single source of truth for link bases.
   *
   * Optional: when unset it falls back to the first `CORS_ORIGIN` entry, which
   * is what the three services already used and keeps dev a zero-config
   * experience. Trailing slashes are stripped so `${base}/path` never doubles up.
   */
  APP_BASE_URL: z
    .string()
    .optional()
    .refine((v) => v === undefined || isHttpUrl(v), {
      message: "APP_BASE_URL must be a single http(s) URL",
    }),

  // ─── Queue, scheduler, and workers (ADR-028 · NWB-P1-001) ─────────────────
  //
  // One switch turns the runtime on (`QUEUE_ENABLED`), and two decide what this
  // process does with it (`QUEUE_WORKER_ENABLED`, `QUEUE_SCHEDULER_ENABLED`).
  // That split is ADR-007's requirement: the same code runs as "API + workers",
  // "workers only", or "API only", and moving between them is an env change.

  /** Master switch. When false the queue client is never constructed — no schema install, no poll. */
  QUEUE_ENABLED: boolEnv(true),
  /** Attach `work()` handlers (execute jobs) in this process. Implies nothing without the master switch. */
  QUEUE_WORKER_ENABLED: boolEnv(true),
  /** Register cron schedules in this process. Only the *registration* is here; execution needs a worker somewhere. */
  QUEUE_SCHEDULER_ENABLED: boolEnv(true),

  /**
   * Schema pg-boss owns. Validated as an identifier because it is interpolated into DDL: a typo
   * here would create a second, empty installation and every existing job would look like it had
   * vanished — which is also why the library refuses a name differing only by case.
   */
  QUEUE_SCHEMA: z.string().default("pgboss").refine(isPostgresIdentifier, {
    message: "QUEUE_SCHEMA must be a lowercase PostgreSQL identifier (a-z, 0-9, _, $; ≤ 63 chars)",
  }),

  /** How often a worker asks the table for work, in seconds. Floor of 0.5s is pg-boss's own. */
  QUEUE_POLLING_INTERVAL_SECONDS: z.coerce.number().min(0.5).max(300).default(2),

  /**
   * The zone every cron field is read in. Default UTC, deliberately, rather than the host's:
   * a schedule that means "02:00 in whichever timezone the VPS happens to run in" changes when the
   * box moves, and these jobs delete data. `Intl` validates it, so a typo fails at boot.
   */
  QUEUE_TIMEZONE: z.string().default("UTC").refine(isTimeZone, {
    message: "QUEUE_TIMEZONE must be an IANA time zone (e.g. 'Africa/Lagos')",
  }),

  /** Per-job cron overrides, five fields, read in `QUEUE_TIMEZONE`. Unset means the shipped default. */
  QUEUE_CRON_RATE_LIMIT_RECLAIM: cronEnv(),
  QUEUE_CRON_PURGE_EXPIRED_ACCOUNTS: cronEnv(),
  QUEUE_CRON_PURGE_EXPIRED_ORGANIZATIONS: cronEnv(),

  // Seed credentials
  SEED_ADMIN_EMAIL: z.string().email().default("admin@nawebeus.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin@123456"),
});

export type Config = z.infer<typeof envSchema> & {
  /**
   * Resolved, trailing-slash-free base for every emailed link. Always present
   * and always absolute, so callers never have to decide a fallback (and so no
   * call site can be tempted back to a request header). Derived, not parsed —
   * it is not settable directly; set `APP_BASE_URL` instead.
   */
  APP_BASE_URL_RESOLVED: string;
};

/** A single http(s) URL — no lists, no `*`. */
function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Strip trailing slashes so `${base}/path` cannot produce `//path`. */
function stripTrailingSlashes(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

let _config: Config | undefined;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config validation failed: ${errors}`);
  }
  // `CORS_ORIGIN` is guaranteed non-empty by `isOriginList`, so the fallback is
  // always a real absolute origin.
  const appBaseUrl = stripTrailingSlashes(result.data.APP_BASE_URL ?? result.data.CORS_ORIGIN[0]!);
  _config = { ...result.data, APP_BASE_URL_RESOLVED: appBaseUrl };
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}
