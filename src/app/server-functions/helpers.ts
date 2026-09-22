/**
 * Shared helpers for TanStack Start Server Functions.
 *
 * These utilities give Server Functions the same capabilities Hono middleware
 * provides for the `/api/*` mobile/webhook routes: session-cookie auth
 * (tanstack-start.md §9.2 — no API keys), org-membership verification, CASL
 * ability loading, and org-context scoping.
 *
 * ADR-002 / Architecture §5.1: the web app calls `services/` directly in-process
 * via Server Functions — no HTTP hop to `/api/*`. Every Server Function validates
 * its inputs with Zod and throws typed `AppError`s, exactly as the Hono routes do.
 */

import { getConfig } from "@/lib/config";
import { type Db, getDb } from "@/lib/db";
import { AuthError, ForbiddenError, RateLimitError, UnauthorizedError } from "@/lib/errors";
import { getClientIp, normaliseIp } from "@/lib/ip";
import { runWithOrgContext } from "@/lib/org-context";
import { assertRateLimit, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { AppAbility } from "@/server/middleware/auth";
import { assertActivePrincipal } from "@/server/middleware/auth";
import { loadAbility } from "@/services/auth/ability";
import { type AccessPayload, verifyToken } from "@/services/auth/jwt";

let testDb: Db | null = null;
let testHeaders: ServerRequestHeaders | null = null;

export function setServerDbForTest(db: Db): void {
  testDb = db;
}

export function clearServerDbForTest(): void {
  testDb = null;
}

export function setServerHeadersForTest(headers: ServerRequestHeaders | null): void {
  testHeaders = headers;
}

export function clearServerHeadersForTest(): void {
  testHeaders = null;
}

export function getServerDb(): Db {
  return testDb ?? getDb();
}

export interface ServerRequestHeaders {
  cookie?: string | undefined;
  authorization?: string | undefined;
  origin?: string | undefined;
  userAgent?: string | undefined;
  xForwardedFor?: string | undefined;
  xRealIp?: string | undefined;
}

function tryGetTanstackRequest(): Request | null {
  try {
    const mod = require("@tanstack/start-server-core") as {
      getRequest?: () => Request;
    };
    if (mod.getRequest) return mod.getRequest();
  } catch {
    // not in a TanStack Start request — caller will supply headers explicitly
  }
  return null;
}

function parseCookies(cookieHeader: string | undefined | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function headerBagFromRequest(req: Request | null): ServerRequestHeaders {
  if (!req) return {};
  return {
    cookie: req.headers.get("cookie") ?? undefined,
    authorization: req.headers.get("authorization") ?? undefined,
    origin: req.headers.get("origin") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    xForwardedFor: req.headers.get("x-forwarded-for") ?? undefined,
    xRealIp: req.headers.get("x-real-ip") ?? undefined,
  };
}

export function getServerHeaders(explicit?: ServerRequestHeaders): ServerRequestHeaders {
  if (explicit) return explicit;
  if (testHeaders) return testHeaders;
  return headerBagFromRequest(tryGetTanstackRequest());
}

export interface ServerAuth {
  userId: string;
  orgId: string;
  ability: AppAbility;
  authMethod: "session";
}

/**
 * Resolve the caller from the `nawebeus_access` session cookie.
 *
 * Server functions are web-only and authenticate with session cookies
 * (tanstack-start.md §1.2, §9.2). API keys belong on Hono `/api/*`.
 */
export async function getServerAuth(
  headers?: ServerRequestHeaders,
  opts?: { requireActiveMembership?: boolean },
): Promise<ServerAuth> {
  const db = getServerDb();
  const config = getConfig();
  const h = getServerHeaders(headers);

  if (h.authorization?.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Server functions authenticate via session cookies. Use the Hono /api/* routes for API keys.",
    );
  }

  const cookies = parseCookies(h.cookie);
  const accessToken = cookies["nawebeus_access"];
  if (!accessToken) throw new UnauthorizedError("No access token provided");

  let payload: AccessPayload;
  try {
    const result = await verifyToken(accessToken, config.JWT_ACCESS_SECRET);
    if (result.type !== "access") throw new UnauthorizedError("Invalid token type");
    payload = result;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new UnauthorizedError("Invalid or expired access token");
  }

  await assertActivePrincipal(db, payload.userId, payload.orgId, opts);
  const ability = await loadAbility(db, payload.userId, payload.orgId);
  return {
    userId: payload.userId,
    orgId: payload.orgId,
    ability,
    authMethod: "session",
  };
}

/**
 * Like `getServerAuth` but returns `null` instead of throwing, for routes that
 * are optionally authenticated (SSR loaders).
 */
export async function tryGetServerAuth(headers?: ServerRequestHeaders): Promise<ServerAuth | null> {
  try {
    return await getServerAuth(headers);
  } catch {
    return null;
  }
}

export async function withServerOrgContext<T>(auth: ServerAuth, fn: () => Promise<T>): Promise<T> {
  return runWithOrgContext({ orgId: auth.orgId, userId: auth.userId }, fn);
}

export function assertServerAbility(auth: ServerAuth, action: string, subject: string): void {
  if (!auth.ability.can(action as never, subject as never)) {
    throw new ForbiddenError(`Missing permission: ${action} ${subject}`);
  }
}

/** Client IP from the request, never from the payload (tanstack-start.md §10.3). */
export function getServerClientIp(headers?: ServerRequestHeaders): string | null {
  const h = getServerHeaders(headers);
  try {
    const config = getConfig();
    return getClientIp(
      {
        req: {
          header: (name: string) => {
            const key = name.toLowerCase();
            if (key === "x-forwarded-for") return h.xForwardedFor;
            if (key === "x-real-ip") return h.xRealIp;
            return undefined;
          },
        },
      },
      config,
    );
  } catch {
    return normaliseIp(h.xForwardedFor ?? h.xRealIp);
  }
}

export function cookieValue(name: string, headers?: ServerRequestHeaders): string | undefined {
  return parseCookies(getServerHeaders(headers).cookie)[name];
}

/**
 * Rate-limit a Server Function identically to Hono (tanstack-start.md §18).
 * Keyed by user when authenticated, otherwise by IP. Missing identity fails
 * open the same way `checkRateLimit` does on a storage error — tests without
 * an IP must not share one global bucket.
 */
export async function assertServerRateLimit(opts: {
  category: "auth" | "read" | "write" | "dsar";
  userId?: string;
  ip?: string | null;
}): Promise<void> {
  const db = getServerDb();
  if (opts.category === "dsar") {
    if (!opts.userId) return;
    await assertRateLimit(
      db,
      `dsar:req:${opts.userId}`,
      RATE_LIMITS.dsarPerDay.max,
      RATE_LIMITS.dsarPerDay.windowMs,
      "Data export is limited to 5 requests per day.",
    );
    return;
  }
  if (opts.category === "auth") {
    const ip = opts.ip;
    if (!ip) return;
    if (await checkRateLimit(db, `ip:${ip}`, 20, 30 * 60 * 1000)) {
      throw new RateLimitError("Too many authentication attempts.", 30 * 60);
    }
    return;
  }
  if (!opts.userId) return;
  const budget =
    opts.category === "read" ? RATE_LIMITS.apiReadPerMinute : RATE_LIMITS.apiWritePerMinute;
  await assertRateLimit(db, `sf:${opts.category}:${opts.userId}`, budget.max, budget.windowMs);
}

export function setServerAuthCookies(opts: {
  accessToken: string;
  refreshToken: string;
  rememberMe?: boolean;
}): void {
  const isProduction = process.env.NODE_ENV === "production";
  const refreshMaxAge = opts.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;

  const accessCookie = [
    `nawebeus_access=${encodeURIComponent(opts.accessToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=900`,
    ...(isProduction ? ["Secure", "Partitioned"] : []),
  ].join("; ");

  const refreshCookie = [
    `nawebeus_refresh=${encodeURIComponent(opts.refreshToken)}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${refreshMaxAge}`,
    ...(isProduction ? ["Secure", "Partitioned"] : []),
  ].join("; ");

  try {
    const mod = require("@tanstack/start-server-core") as {
      setResponseHeader?: (name: string, value: string) => void;
      appendResponseHeader?: (name: string, value: string) => void;
    };
    if (mod.appendResponseHeader) {
      mod.appendResponseHeader("Set-Cookie", accessCookie);
      mod.appendResponseHeader("Set-Cookie", refreshCookie);
      return;
    }
    if (mod.setResponseHeader) {
      mod.setResponseHeader("Set-Cookie", `${accessCookie}, ${refreshCookie}`);
    }
  } catch {
    // Outside TanStack Start (tests / Hono)
  }
}

export function clearServerAuthCookies(): void {
  const expire = (name: string, path: string) =>
    `${name}=; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  try {
    const mod = require("@tanstack/start-server-core") as {
      appendResponseHeader?: (name: string, value: string) => void;
    };
    if (mod.appendResponseHeader) {
      mod.appendResponseHeader("Set-Cookie", expire("nawebeus_access", "/"));
      mod.appendResponseHeader("Set-Cookie", expire("nawebeus_refresh", "/api/auth"));
    }
  } catch {
    // no-op outside TanStack Start
  }
}
