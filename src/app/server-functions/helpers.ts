/**
 * Shared helpers for TanStack Start Server Functions.
 *
 * These utilities give Server Functions the same capabilities Hono middleware
 * provides for the `/api/*` mobile/webhook routes: cookie/Bearer auth,
 * org-membership verification, CASL ability loading, and org-context scoping.
 *
 * ADR-002 / Architecture §5.1: the web app calls `services/` directly in-process
 * via Server Functions — no HTTP hop to `/api/*`. Every Server Function validates
 * its inputs with Zod and throws typed `AppError`s, exactly as the Hono routes do.
 *
 * The Hono API (`src/server/api/*`) remains the entry point for mobile, webhooks
 * and third-party integrations. The web app's entry point is these Server Functions.
 * Both share the single `services/` layer and run in one Bun process (ADR-007).
 */

import { sql } from "drizzle-orm";

import { getConfig } from "@/lib/config";
import { type Db, getDb } from "@/lib/db";
import { AuthError, ForbiddenError } from "@/lib/errors";
import { runWithOrgContext } from "@/lib/org-context";
import type { AppAbility } from "@/server/middleware/auth";
import { loadAbility } from "@/services/auth/ability";
import { apiKeyAbility, recordApiKeyUsage, resolveApiKey } from "@/services/auth/api-key";
import { type AccessPayload, verifyToken } from "@/services/auth/jwt";

// ──────────────────────────────────────────────────────────────────────────────
// Test injection: server functions use the global pool in production, but tests
// run inside a transaction via `createTestDb()` and inject that handle here.
// Call `setServerDbForTest(db)` in `beforeAll` and `clearServerDbForTest()` after.
// Same for request headers — `getServerAuth()` reads cookies/Authorization from
// TanStack Start's `getRequest()` in production, but tests inject a header bag.
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// Request extraction — works inside Vinxi/TanStack Start (getRequest) and falls
// back to an explicit header bag for unit/integration tests.
// ──────────────────────────────────────────────────────────────────────────────
export interface ServerRequestHeaders {
  cookie?: string | undefined;
  authorization?: string | undefined;
  origin?: string | undefined;
  userAgent?: string | undefined;
  xForwardedFor?: string | undefined;
}

function tryGetTanstackRequest(): Request | null {
  try {
    // Dynamic import boundary: succeeds inside a TanStack Start handler, throws
    // (or returns undefined) in plain Hono / `bun test` contexts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const cookie = req.headers.get("cookie") ?? undefined;
  const authorization = req.headers.get("authorization") ?? undefined;
  const origin = req.headers.get("origin") ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const xForwardedFor = req.headers.get("x-forwarded-for") ?? undefined;
  return { cookie, authorization, origin, userAgent, xForwardedFor };
}

export function getServerHeaders(explicit?: ServerRequestHeaders): ServerRequestHeaders {
  if (explicit) return explicit;
  if (testHeaders) return testHeaders;
  const req = tryGetTanstackRequest();
  return headerBagFromRequest(req);
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth: mirrors `src/server/middleware/auth.ts` without Hono's `c.var`.
// ──────────────────────────────────────────────────────────────────────────────
export interface ServerAuth {
  userId: string;
  orgId: string;
  ability: AppAbility;
  authMethod: "session" | "api_key";
  apiKeyId?: string | undefined;
}

async function assertActiveMembership(db: Db, userId: string, orgId: string): Promise<void> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organization_members
        WHERE user_id = ${userId}
          AND organization_id = ${orgId}
          AND status = 'active'
          AND deleted_at IS NULL
        LIMIT 1`,
  );
  if (((rows as unknown as { rows?: unknown[] }).rows?.length ?? 0) === 0) {
    throw new ForbiddenError("You are not a member of this organization");
  }
}

/**
 * Resolve the caller from either a Bearer API key or the `nawebeus_access`
 * session cookie — the same two paths Hono's `authMiddleware` supports.
 *
 * Throws `AuthError` / `ForbiddenError` on failure, matching the Hono behaviour
 * so error-handler mapping stays consistent.
 */
export async function getServerAuth(headers?: ServerRequestHeaders): Promise<ServerAuth> {
  const db = getServerDb();
  const config = getConfig();
  const h = getServerHeaders(headers);

  // Bearer API key path (ADR-002: mobile & third-party go via Hono, but the web's
  // Server Functions also accept a key so a programmatic caller can use them).
  const authHeader = h.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const presented = authHeader.slice("Bearer ".length).trim();
    if (!presented) throw new AuthError("Malformed Authorization header");
    const resolved = await resolveApiKey(db, presented);
    if (!resolved) throw new AuthError("Invalid or revoked API key");
    await assertActiveMembership(db, resolved.userId, resolved.organizationId);
    const base = await loadAbility(db, resolved.userId, resolved.organizationId);
    const ability = apiKeyAbility(base, resolved.permissionLevel, resolved.scopes);
    // Fire-and-forget usage record; failure must not block the request
    void recordApiKeyUsage(db, resolved.id, {
      ip: null,
      userAgent: h.userAgent ?? null,
    }).catch(() => {});
    return {
      userId: resolved.userId,
      orgId: resolved.organizationId,
      ability,
      authMethod: "api_key",
      apiKeyId: resolved.id,
    };
  }

  // Session cookie path — the web's normal path.
  const cookies = parseCookies(h.cookie);
  const accessToken = cookies["nawebeus_access"];
  if (!accessToken) throw new AuthError("No access token provided");

  let payload: AccessPayload;
  try {
    const result = await verifyToken(accessToken, config.JWT_ACCESS_SECRET);
    if (result.type !== "access") throw new AuthError("Invalid token type");
    payload = result;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("Invalid or expired access token");
  }

  await assertActiveMembership(db, payload.userId, payload.orgId);
  const ability = await loadAbility(db, payload.userId, payload.orgId);
  return {
    userId: payload.userId,
    orgId: payload.orgId,
    ability,
    authMethod: "session",
    apiKeyId: undefined,
  };
}

/**
 * Like `getServerAuth` but returns `null` instead of throwing, for routes that
 * are optionally authenticated (currently unused, but useful for SSR loaders).
 */
export async function tryGetServerAuth(headers?: ServerRequestHeaders): Promise<ServerAuth | null> {
  try {
    return await getServerAuth(headers);
  } catch {
    return null;
  }
}

/**
 * Run a callback with AsyncLocalStorage org context set — the same scoping Hono's
 * authMiddleware uses via `runWithOrgContext`, so any downstream `getOrgContext()`
 * call inside `services/` works identically for both entry points.
 */
export async function withServerOrgContext<T>(auth: ServerAuth, fn: () => Promise<T>): Promise<T> {
  return runWithOrgContext({ orgId: auth.orgId, userId: auth.userId }, fn);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ability helper — mirrors `requireAbility` middleware
// ──────────────────────────────────────────────────────────────────────────────
export function assertServerAbility(auth: ServerAuth, action: string, subject: string): void {
  if (!auth.ability.can(action as never, subject as never)) {
    throw new ForbiddenError(`Missing permission: ${action} ${subject}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Cookie helpers for Server Functions that need to set/clear auth cookies.
// TanStack Start server functions run in the server and can set `Set-Cookie`
// headers via the response. When Vinxi is present we use its `setHeader`; else
// we no-op (tests inspect the returned tokens directly).
// ──────────────────────────────────────────────────────────────────────────────
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
      // Fallback — second call may overwrite first on some runtimes
      mod.setResponseHeader("Set-Cookie", `${accessCookie}, ${refreshCookie}`);
    }
  } catch {
    // Outside TanStack Start (tests / Hono) — caller should set cookies via Hono's `setCookie`
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
