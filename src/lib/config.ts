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

/** An optional string env var where blank means unset — `.env.example` ships these as `KEY=`. */
function optionalEnv() {
  return z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed === undefined || trimmed === "" ? undefined : trimmed;
    });
}

/**
 * A sender or reply-to address as an email provider accepts it: `addr@domain` or
 * `Display Name <addr@domain>`. Shape only — whether the domain is verified with the provider is
 * the provider's answer (a 403/422 at send time), not something config can know.
 */
function isMailbox(raw: string): boolean {
  const named = /^[^<>@]+<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>$/.exec(raw);
  const address = named ? named[1] : raw;
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address ?? "");
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
  QUEUE_CRON_APPROVALS_EXPIRE_STALE: cronEnv(),
  QUEUE_CRON_IMPERSONATION_EXPIRE: cronEnv(),
  QUEUE_CRON_SOCIAL_TOKEN_REFRESH: cronEnv(),
  QUEUE_CRON_SOCIAL_HEALTH_CHECK: cronEnv(),
  QUEUE_CRON_PURGE_EXPIRED_ACCOUNTS: cronEnv(),
  QUEUE_CRON_PURGE_EXPIRED_ORGANIZATIONS: cronEnv(),
  QUEUE_CRON_PURGE_EXPIRED_INVITATIONS: cronEnv(),
  QUEUE_CRON_RETENTION_ENFORCE: cronEnv(),
  QUEUE_CRON_AUDIT_CHAIN_VERIFY: cronEnv(),

  // ─── Email transport (DEC-028 · NWB-P1-004) ───────────────────────────────
  //
  // One provider per process. Which one is *derived* when not stated: a Resend key present means
  // Resend, otherwise the console transport that prints every message to the log (what `bun run
  // dev` uses, and how a developer reads a verification link locally). The derivation is
  // deliberately refused in production — see the refinement below the schema.

  /** `console` prints messages to the log; `resend` sends them. Unset: derived from `RESEND_API_KEY`. */
  EMAIL_PROVIDER: z.enum(["console", "resend"]).optional(),
  /** Resend API key (`re_…`). Its presence alone selects the Resend transport. */
  RESEND_API_KEY: optionalEnv(),
  /** Where the Resend transport posts. Overridable so a smoke test or a sandbox can point it at a stub. */
  RESEND_API_BASE_URL: z
    .string()
    .default("https://api.resend.com")
    .refine(isHttpUrl, { message: "RESEND_API_BASE_URL must be a single http(s) URL" })
    .transform(stripTrailingSlashes),
  /** The `From:` every message carries, e.g. `Nawebeus <no-reply@nawebeus.com>`. Required for Resend. */
  EMAIL_FROM: optionalEnv().refine((v) => v === undefined || isMailbox(v), {
    message: "EMAIL_FROM must be an email address, optionally as 'Display Name <addr@domain>'",
  }),
  /** Optional `Reply-To`; unset means replies go to `EMAIL_FROM`'s mailbox. */
  EMAIL_REPLY_TO: optionalEnv().refine((v) => v === undefined || isMailbox(v), {
    message: "EMAIL_REPLY_TO must be an email address, optionally as 'Display Name <addr@domain>'",
  }),
  /** How long one provider call may take before the transport calls it a retryable timeout. */
  EMAIL_SEND_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),

  // ─── Media storage (DEC-028's twin · NWB-P1-005, D6) ──────────────────────
  //
  // The same derivation shape as email: `STORAGE_DRIVER` stated wins; otherwise an R2
  // credential triple present means R2, otherwise the local-disk transport (dev, tests, and a
  // single-box deployment that says so on purpose). Production refuses local-by-omission —
  // see the refinement beside the email one.

  /** `local` writes under `STORAGE_LOCAL_ROOT`; `r2` presigns against Cloudflare R2. Unset: derived from the R2 credentials. */
  STORAGE_DRIVER: z.enum(["local", "r2"]).optional(),
  /** Root directory for the local transport. Created on demand; override per deployment. */
  STORAGE_LOCAL_ROOT: z.string().default(".data/media"),
  /** Cloudflare R2 — the three credentials together select R2 when `STORAGE_DRIVER` is unset. */
  R2_ACCOUNT_ID: optionalEnv(),
  R2_ACCESS_KEY_ID: optionalEnv(),
  R2_SECRET_ACCESS_KEY: optionalEnv(),
  /** The bucket every key lives in. Required for R2. */
  R2_BUCKET: optionalEnv(),
  /** Upload cap in megabytes. The schema wants size > 0; the cap is the abuse half. */
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(512).default(25),
  /**
   * HMAC key for local-transport signed URLs. Unset means derived from `JWT_ACCESS_SECRET`
   * (a deployed secret that already exists), which keeps one more secret from being mandatory
   * for a dev/single-box feature. Set it to decouple the two — rotating the JWT secret then
   * does not break every media link ever emitted.
   */
  STORAGE_SIGNING_SECRET: optionalEnv(),

  // ─── Social platform OAuth (Module 3 · NWB-P2-001) ─────────────────────────
  //
  // Per-platform OAuth client pairs (the DEC-009 five). A platform is "configured" when both
  // of its pair are set; the flow refuses to half-start otherwise. Token sealing uses
  // SOCIAL_TOKEN_ENCRYPTION_KEY (AES-256-GCM, FR-SOC-003); production refuses the derived
  // fallback — see the refinement beside the storage one.

  OAUTH_YOUTUBE_CLIENT_ID: optionalEnv(),
  OAUTH_YOUTUBE_CLIENT_SECRET: optionalEnv(),
  OAUTH_TWITTER_X_CLIENT_ID: optionalEnv(),
  OAUTH_TWITTER_X_CLIENT_SECRET: optionalEnv(),
  OAUTH_INSTAGRAM_CLIENT_ID: optionalEnv(),
  OAUTH_INSTAGRAM_CLIENT_SECRET: optionalEnv(),
  OAUTH_FACEBOOK_CLIENT_ID: optionalEnv(),
  OAUTH_FACEBOOK_CLIENT_SECRET: optionalEnv(),
  OAUTH_REDDIT_CLIENT_ID: optionalEnv(),
  OAUTH_REDDIT_CLIENT_SECRET: optionalEnv(),
  /** Base64url of 32 random bytes. Unset (non-production): AES key derived from JWT_ACCESS_SECRET. */
  SOCIAL_TOKEN_ENCRYPTION_KEY: optionalEnv(),

  // Seed credentials
  SEED_ADMIN_EMAIL: z.string().email().default("admin@nawebeus.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin@123456"),
});

/** The transport `emailService` will use once the optional keys have been resolved against each other. */
export type EmailProvider = "console" | "resend";

export type StorageProvider = "local" | "r2";

/**
 * `STORAGE_DRIVER` when stated; otherwise R2 when the full credential quartet is present, else
 * the local disk. The refinement in the schema guarantees production never reaches `local` by
 * omission, and that a partial quartet is an error before this function is ever consulted.
 */
function resolveStorageProvider(env: {
  STORAGE_DRIVER?: StorageProvider | undefined;
  R2_ACCOUNT_ID?: string | undefined;
  R2_ACCESS_KEY_ID?: string | undefined;
  R2_SECRET_ACCESS_KEY?: string | undefined;
  R2_BUCKET?: string | undefined;
}): StorageProvider {
  if (env.STORAGE_DRIVER) return env.STORAGE_DRIVER;
  const complete =
    env.R2_ACCOUNT_ID !== undefined &&
    env.R2_ACCESS_KEY_ID !== undefined &&
    env.R2_SECRET_ACCESS_KEY !== undefined &&
    env.R2_BUCKET !== undefined;
  return complete ? "r2" : "local";
}

/** `EMAIL_PROVIDER` when stated; otherwise Resend if there is a key for it, else the console. */
function resolveEmailProvider(env: {
  EMAIL_PROVIDER?: EmailProvider | undefined;
  RESEND_API_KEY?: string | undefined;
}): EmailProvider {
  return env.EMAIL_PROVIDER ?? (env.RESEND_API_KEY !== undefined ? "resend" : "console");
}

/**
 * Cross-field email rules, expressed as config issues so they fail at boot with the standard
 * "Config validation failed" line rather than at the first signup:
 *
 * - Resend needs a key and a sender. `EMAIL_PROVIDER=resend` with no key is a typo, not a choice.
 * - **A production process does not get console email by omission.** An unset key would otherwise
 *   turn every verification link, password reset and invitation into a log line, and nothing
 *   would report it — signups would simply never verify. An operator who really wants that
 *   (a staging box with no domain yet) says so with `EMAIL_PROVIDER=console`.
 */
const envSchemaWithEmailRules = envSchema.superRefine((env, ctx) => {
  const provider = resolveEmailProvider(env);
  if (provider === "resend") {
    if (env.RESEND_API_KEY === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "required when EMAIL_PROVIDER=resend",
      });
    }
    if (env.EMAIL_FROM === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "required for the Resend transport (e.g. 'Nawebeus <no-reply@your-domain>')",
      });
    }
  } else if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["EMAIL_PROVIDER"],
      message:
        "production needs a real email provider: set RESEND_API_KEY and EMAIL_FROM, or opt into log-only email explicitly with EMAIL_PROVIDER=console",
    });
  }

  // Storage (NWB-P1-005) mirrors the email rule: `.data/media` on a production box is a
  // deployment decision, not a default — say `STORAGE_DRIVER=local` on purpose, or bring
  // the R2 triple. A partial triple is a typo, not a choice, in any environment.
  const r2Parts = [
    env.R2_ACCOUNT_ID,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_BUCKET,
  ];
  const r2Complete = r2Parts.every((v) => v !== undefined && v !== "");
  const r2Partial = r2Parts.some((v) => v !== undefined && v !== "");
  if (env.STORAGE_DRIVER === "r2" && !r2Complete) {
    ctx.addIssue({
      code: "custom",
      path: ["STORAGE_DRIVER"],
      message:
        "required when STORAGE_DRIVER=r2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET",
    });
  }
  if (env.STORAGE_DRIVER === undefined && r2Partial && !r2Complete) {
    ctx.addIssue({
      code: "custom",
      path: ["STORAGE_DRIVER"],
      message:
        "the R2 credentials are partially set — set all four (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) or none",
    });
  }
  if (env.NODE_ENV === "production" && env.STORAGE_DRIVER === undefined && !r2Complete) {
    ctx.addIssue({
      code: "custom",
      path: ["STORAGE_DRIVER"],
      message:
        "production needs a real object store: set the R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET quartet, or opt into local disk explicitly with STORAGE_DRIVER=local",
    });
  }

  // Social tokens are third-party credentials sealed at rest (FR-SOC-003); deriving the AES
  // key from the JWT secret in production would tie two security domains to one rotation —
  // bring a dedicated key, like the storage rule brings a real store.
  if (
    env.NODE_ENV === "production" &&
    (env.SOCIAL_TOKEN_ENCRYPTION_KEY === undefined || env.SOCIAL_TOKEN_ENCRYPTION_KEY === "")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["SOCIAL_TOKEN_ENCRYPTION_KEY"],
      message:
        "production seals social OAuth tokens with a dedicated AES-256 key: set SOCIAL_TOKEN_ENCRYPTION_KEY (base64url of 32 random bytes)",
    });
  }
});

export type Config = z.infer<typeof envSchema> & {
  /**
   * Resolved, trailing-slash-free base for every emailed link. Always present
   * and always absolute, so callers never have to decide a fallback (and so no
   * call site can be tempted back to a request header). Derived, not parsed —
   * it is not settable directly; set `APP_BASE_URL` instead.
   */
  APP_BASE_URL_RESOLVED: string;
  /**
   * The email transport this process uses, after `EMAIL_PROVIDER` and `RESEND_API_KEY` have been
   * resolved against each other. Derived, like the base URL: read this, never re-derive it.
   */
  EMAIL_PROVIDER_RESOLVED: EmailProvider;
  /**
   * The media storage transport this process uses, after `STORAGE_DRIVER` and the R2 credential
   * quartet have been resolved against each other (NWB-P1-005). Derived: read, never re-derive.
   */
  STORAGE_DRIVER_RESOLVED: StorageProvider;
  /** Where the R2 S3 endpoint lives, once the account id is known. Empty for the local driver. */
  R2_ENDPOINT_RESOLVED: string;
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
  const result = envSchemaWithEmailRules.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config validation failed: ${errors}`);
  }
  // `CORS_ORIGIN` is guaranteed non-empty by `isOriginList`, so the fallback is
  // always a real absolute origin.
  const appBaseUrl = stripTrailingSlashes(result.data.APP_BASE_URL ?? result.data.CORS_ORIGIN[0]!);
  _config = {
    ...result.data,
    APP_BASE_URL_RESOLVED: appBaseUrl,
    EMAIL_PROVIDER_RESOLVED: resolveEmailProvider(result.data),
    STORAGE_DRIVER_RESOLVED: resolveStorageProvider(result.data),
    R2_ENDPOINT_RESOLVED: result.data.R2_ACCOUNT_ID
      ? `https://${result.data.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : "",
  };
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}

/**
 * `getConfig()` for code that can do something sensible without one.
 *
 * `getConfig()` auto-loads and throws on an invalid environment, which is right for a server boot
 * and wrong for a module that is merely *preferring* a configured value: the email service in a
 * test process with no `DATABASE_URL` should fall back to the console transport, not turn a
 * spy-wrapped `send()` into a config exception. The invalid environment still fails the boot —
 * `src/index.ts` calls `loadConfig()` first — this only stops it failing twice.
 */
export function tryGetConfig(): Config | undefined {
  if (_config) return _config;
  try {
    return loadConfig();
  } catch {
    return undefined;
  }
}
