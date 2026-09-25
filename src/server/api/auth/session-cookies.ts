import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

export interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
}

/**
 * Sets the session cookie pair exactly as sign-in does. Shared by the sign-in
 * route and the MFA challenge-completion route so every login path mints
 * cookies identically: short-lived access cookie on `/`, long-lived refresh
 * cookie scoped to `/api/auth`.
 */
export function setSessionCookies(c: Context, session: SessionCookies): void {
  const isProduction = process.env.NODE_ENV === "production";

  setCookie(c, "nawebeus_access", session.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Strict",
    path: "/",
    maxAge: 900,
  });

  // Refresh TTL: 7 days normal, 30 days with remember-me
  const refreshMaxAge = session.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  setCookie(c, "nawebeus_refresh", session.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Strict",
    path: "/api/auth",
    maxAge: refreshMaxAge,
    // CHIPS `Partitioned` is only legal alongside `Secure`; setting it
    // unconditionally threw at runtime outside production, so sign-in worked in
    // prod and 500'd in dev and test.
    ...(isProduction ? { partitioned: true } : {}),
  });
}

/**
 * Swaps the access cookie for an impersonation token (NWB-P1-011): the support
 * admin's browser now acts as the target until the session ends or expires.
 * The admin's own refresh cookie (scoped to `/api/auth`) is deliberately left
 * alone — it is the way back: ending the impersonation clears this cookie and
 * the client re-authenticates its own session through `/api/auth/refresh`.
 */
export function setImpersonationCookie(c: Context, token: string, maxAgeSeconds: number): void {
  const isProduction = process.env.NODE_ENV === "production";
  setCookie(c, "nawebeus_access", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Strict",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

/** Clears the impersonated access cookie — the "Stop supporting" half of the swap. */
export function clearImpersonationCookie(c: Context): void {
  deleteCookie(c, "nawebeus_access", { path: "/" });
}
