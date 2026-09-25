/**
 * Social account routes (NWB-P2-001) — `/api/social`.
 *
 * The OAuth flow is two hops: the authed `initiate` (manager+, `socialaccounts.connect`) and
 * the **public** `callback` (Module 3 §6.3 — the platform's browser redirect carries no Nawebeus
 * session; the single-use state row is the authority, and it is consumed exactly once).
 *
 * The management surface (NWB-P2-006) reads and retires accounts: list / detail / health log at
 * the `read` tier (Module 3 §6.2 — every seat may look), the org quota roll-up at `usage`
 * (manager+), and the disconnect at `disconnect` (admin only — it destroys credentials) with the
 * typed-username confirmation in the **body** (query params leak into proxy logs).
 *
 * Failure discipline: every bad-state shape answers the same generic error (no oracle for
 * whether a state exists), and success redirects to the state's `return_url` — a relative path
 * by construction, since `initiate` rejected anything else.
 */
import { Hono } from "hono";
import { ValidationError } from "@/lib/errors";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { patternParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  getSocialService,
  isSocialPlatform,
  PLATFORM_OAUTH_PROFILES,
  SOCIAL_ACCOUNT_ID_PATTERN,
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

function accountIdParam(c: Parameters<typeof patternParam>[0]): string {
  return patternParam(c, "accountId", SOCIAL_ACCOUNT_ID_PATTERN, "accountId");
}

/** The lifecycle statuses a list filter may name (the social_account_status enum). */
const LIST_STATUSES = new Set([
  "active",
  "error",
  "paused",
  "needs_reauth",
  "disconnected",
  "pending_verification",
]);

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

// GET /api/social/accounts — the connected-account list (read: every seat).
socialRouter.get(
  "/social/accounts",
  authMiddleware,
  requireAbility("read", "socialaccounts"),
  async (c) => {
    const { orgId } = c.var.user;
    const url = new URL(c.req.url);
    const page = parsePagination(url, { idPattern: SOCIAL_ACCOUNT_ID_PATTERN });

    const platformRaw = url.searchParams.get("platform");
    let platform: SocialPlatform | undefined;
    if (platformRaw) {
      if (!isSocialPlatform(platformRaw)) {
        throw new ValidationError("Unknown platform", [
          { field: "platform", message: "Unsupported platform" },
        ]);
      }
      platform = platformRaw;
    }
    const statusRaw = url.searchParams.get("status") ?? undefined;
    if (statusRaw && !LIST_STATUSES.has(statusRaw)) {
      throw new ValidationError("Unknown status filter", [
        {
          field: "status",
          message:
            "Must be one of active, error, paused, needs_reauth, disconnected, pending_verification",
        },
      ]);
    }

    const { items, pageInfo } = await getSocialService().listAccounts(c.var.db, orgId, page, {
      ...(platform !== undefined ? { platform } : {}),
      ...(statusRaw !== undefined ? { status: statusRaw } : {}),
    });
    return c.json(
      success(
        {
          accounts: items.map((account) => ({
            ...account,
            tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
            connectedAt: account.connectedAt.toISOString(),
          })),
        },
        paginationMeta(pageInfo),
      ),
    );
  },
);

// GET /api/social/accounts/:accountId — one account's management view.
socialRouter.get(
  "/social/accounts/:accountId",
  authMiddleware,
  requireAbility("read", "socialaccounts"),
  async (c) => {
    const { orgId } = c.var.user;
    const accountId = accountIdParam(c);
    const { account, quota, latestHealth } = await getSocialService().getAccountDetail(c.var.db, {
      organizationId: orgId,
      accountId,
    });
    return c.json(
      success({
        account: {
          ...account,
          tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
          connectedAt: account.connectedAt.toISOString(),
          circuitBreakerOpenedAt: account.circuitBreakerOpenedAt?.toISOString() ?? null,
          lastErrorAt: account.lastErrorAt?.toISOString() ?? null,
          dataRetentionUntil: account.dataRetentionUntil?.toISOString() ?? null,
        },
        quota,
        latestHealth: latestHealth
          ? { ...latestHealth, checkedAt: latestHealth.checkedAt.toISOString() }
          : undefined,
      }),
    );
  },
);

// GET /api/social/accounts/:accountId/health — the recent probe history, newest first.
socialRouter.get(
  "/social/accounts/:accountId/health",
  authMiddleware,
  requireAbility("read", "socialaccounts"),
  async (c) => {
    const { orgId } = c.var.user;
    const accountId = accountIdParam(c);
    const limitRaw = c.req.query("limit");
    let limit: number | undefined;
    if (limitRaw !== undefined) {
      if (!/^\d+$/.test(limitRaw) || Number.parseInt(limitRaw, 10) < 1) {
        throw new ValidationError("Invalid limit", [
          { field: "limit", message: "Must be a positive integer" },
        ]);
      }
      limit = Number.parseInt(limitRaw, 10);
    }
    const entries = await getSocialService().getAccountHealthLog(c.var.db, {
      organizationId: orgId,
      accountId,
      ...(limit !== undefined ? { limit } : {}),
    });
    return c.json(
      success({
        health: entries.map((entry) => ({
          ...entry,
          checkedAt: entry.checkedAt.toISOString(),
        })),
      }),
    );
  },
);

// GET /api/social/usage — the org's quota roll-up (manager+: `usage` tier).
socialRouter.get(
  "/social/usage",
  authMiddleware,
  requireAbility("usage", "socialaccounts"),
  async (c) => {
    const { orgId } = c.var.user;
    const usage = await getSocialService().getOrgQuotaUsage(c.var.db, orgId);
    return c.json(success({ usage }));
  },
);

// DELETE /api/social/accounts/:accountId — the disconnect (admin only). The typed username
// rides in the body on purpose: URLs and query strings outlive requests in proxy logs, and
// this string is the operator's deliberate "yes, this account".
socialRouter.delete(
  "/social/accounts/:accountId",
  authMiddleware,
  requireAbility("disconnect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const accountId = accountIdParam(c);

    let body: { confirmUsername?: unknown; reason?: unknown } = {};
    try {
      const parsed = await c.req.json();
      if (parsed && typeof parsed === "object") body = parsed as typeof body;
    } catch {
      // Handled below — the confirmation is not optional.
    }
    if (typeof body.confirmUsername !== "string" || body.confirmUsername.length === 0) {
      throw new ValidationError("Disconnect requires a typed-username confirmation", [
        { field: "confirmUsername", message: "Type the account's platform username to confirm" },
      ]);
    }
    if (body.reason !== undefined && typeof body.reason !== "string") {
      throw new ValidationError("Disconnect reason must be a string", [
        { field: "reason", message: "Must be a string" },
      ]);
    }

    const result = await getSocialService().disconnectAccount(c.var.db, {
      organizationId: orgId,
      accountId,
      actorId: userId,
      confirmationUsername: body.confirmUsername,
      ...(typeof body.reason === "string" && body.reason.length > 0 ? { reason: body.reason } : {}),
    });
    return c.json(
      success({ ...result, dataRetentionUntil: result.dataRetentionUntil.toISOString() }),
    );
  },
);
