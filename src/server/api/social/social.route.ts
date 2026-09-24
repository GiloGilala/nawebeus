/**
 * Social account routes (NWB-P2-001) — `/api/social`.
 *
 * Two routes only, because the OAuth flow is two hops: the authed `initiate` (manager+,
 * `socialaccounts.connect`) and the **public** `callback` (Module 3 §6.3 — the platform's
 * browser redirect carries no Nawebeus session; the single-use state row is the authority, and
 * it is consumed exactly once). Everything else about the surface — list / disconnect / health —
 * is NWB-P2-006 and joins the platform adapters, not the state machine.
 *
 * Failure discipline: every bad-state shape answers the same generic error (no oracle for
 * whether a state exists), and success redirects to the state's `return_url` — a relative path
 * by construction, since `initiate` rejected anything else.
 */
import { Hono } from "hono";
import { ValidationError } from "@/lib/errors";
import { success } from "@/lib/response";
import { patternParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  getSocialService,
  isSocialPlatform,
  PLATFORM_OAUTH_PROFILES,
  type SocialPlatform,
} from "@/services/social";

export const socialRouter = new Hono();

const PLATFORM_PATTERN = new RegExp(`^(${Object.keys(PLATFORM_OAUTH_PROFILES).join("|")})$`);

function platformParam(c: Parameters<typeof patternParam>[0]): SocialPlatform {
  const raw = patternParam(c, "platform", PLATFORM_PATTERN, "platform");
  if (!isSocialPlatform(raw)) {
    // patternParam already threw for a non-match; this guard keeps the type honest.
    throw new ValidationError("Unknown platform", [
      { field: "platform", message: "Unsupported platform" },
    ]);
  }
  return raw;
}

// POST /api/social/oauth/:platform/initiate — authed; mint the state + authorize URL.
socialRouter.post(
  "/social/oauth/:platform/initiate",
  authMiddleware,
  requireAbility("connect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const platform = platformParam(c);

    let body: { returnUrl?: unknown } = {};
    try {
      const parsed = await c.req.json();
      if (parsed && typeof parsed === "object") body = parsed as { returnUrl?: unknown };
    } catch {
      // No body at all is fine — returnUrl is optional.
    }
    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.length > 0 ? body.returnUrl : undefined;

    const { authorizeUrl, expiresAt } = await getSocialService().initiateConnect(c.var.db, {
      organizationId: orgId,
      userId,
      platform,
      ...(returnUrl !== undefined ? { returnUrl } : {}),
    });
    return c.json(success({ authorizeUrl, expiresAt: expiresAt.toISOString() }, { platform }), 201);
  },
);

// GET /api/social/oauth/:platform/callback — public; the state row is the authorization.
socialRouter.get("/social/oauth/:platform/callback", async (c) => {
  const platform = platformParam(c);
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (
    typeof code !== "string" ||
    code.length === 0 ||
    typeof state !== "string" ||
    state.length === 0
  ) {
    throw new ValidationError("OAuth callback is missing its code or state", [
      { field: "state", message: "Start the connection again" },
    ]);
  }

  const { account, returnUrl } = await getSocialService().handleCallback(c.var.db, {
    platform,
    code,
    state,
  });

  // Never render token material or the provider code into the redirect target.
  const target =
    returnUrl ?? `/settings/integrations?connected=${encodeURIComponent(account.platform)}`;
  return c.redirect(target, 302);
});
