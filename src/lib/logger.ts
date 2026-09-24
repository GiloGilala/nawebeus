/**
 * Structured JSON logger (tanstack-start.md §19, Engineering Standards §12.1).
 *
 * Server functions and Hono routes must never `console.log` on a production
 * path. This writer emits one JSON object per line to stderr and redacts
 * secrets / PII keys so a log line cannot leak a password, JWT, or card number.
 *
 * Since NWB-P1-012 its consumers are the request-context access log (one line
 * per request, keyed by the request's correlation id) and `errorHandler` (one
 * line per 5xx, same id); metrics and remote sinks (Loki/Sentry/Prometheus)
 * are Phase 8 — this writer is the contract those sinks will consume. Errors
 * still propagate — the logger does not swallow, and a logging failure must
 * never take a request down with it.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_KEY = /password|secret|token|authorization|cookie|jwt|card|cvv|pin/i;
const PII_KEY = /email|phone|ipaddress|ip_address|useragent|user_agent/i;

export interface LogFields {
  [key: string]: unknown;
}

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (PII_KEY.test(key)) return "[redacted]";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return sanitizeFields(value as LogFields);
  }
  return value;
}

export function sanitizeFields(fields: LogFields | undefined): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  const entry: LogFields = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...sanitizeFields(fields),
  };
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
