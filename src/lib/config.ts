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

  // Seed credentials
  SEED_ADMIN_EMAIL: z.string().email().default("admin@nawebeus.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin@123456"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | undefined;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config validation failed: ${errors}`);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}
