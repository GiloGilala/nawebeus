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
 * NWB-P2-007 adds the lifecycle half P2-006 scoped out, on the same four verbs (no new CASL
 * verbs — every candidate lands on a tier that already exists): pause / resume / on-demand
 * health-check at `connect` (manager+, the tier Module 3 §6.2 gives connection management), the
 * per-account quota read at `usage`, `?attention=true` on the list for FR-SOC-044's widget, and
 * `?dryRun=true` on the DELETE for FR-SOC-011's impact analysis — which writes nothing, so it
 * asks for no typed confirmation.
 *
 * Failure discipline: every bad-state shape answers the same generic error (no oracle for
 * whether a state exists), and success redirects to the state's `return_url` — a relative path
 * by construction, since `initiate` rejected anything else.
 */
import { Hono } from "hono";
import { NotFoundError, ValidationError } from "@/lib/errors";
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

/**
 * The optional `reason` an operator can attach to a pause/resume (it lands in the audit row and
 * the health-log timeline, which is what makes "who stopped collection and why" answerable).
 * Absent body, empty body and a non-JSON body all mean "no reason" — the reason is a courtesy
 * field, and a 422 here would make the one-click pause button a form. A present-but-wrong type
 * is still a 422, because that is a client bug rather than an operator omitting an optional field.
 */
async function optionalReasonFromBody(c: {
  req: { json: () => Promise<unknown> };
}): Promise<string | undefined> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return undefined;
  }
  if (body === null || typeof body !== "object") return undefined;
  const reason = (body as { reason?: unknown }).reason;
  if (reason === undefined) return undefined;
  if (typeof reason !== "string") {
    throw new ValidationError("Reason must be a string", [
      { field: "reason", message: "Must be a string" },
    ]);
  }
  return reason.length > 0 ? reason : undefined;
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
    const attentionRaw = url.searchParams.get("attention");
    let attention: boolean | undefined;
    if (attentionRaw !== null) {
      if (attentionRaw === "true" || attentionRaw === "1") attention = true;
      else if (attentionRaw === "false" || attentionRaw === "0") attention = false;
      else {
        throw new ValidationError("Unknown attention filter", [
          { field: "attention", message: "Must be true or false" },
        ]);
      }
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

    const { items, pageInfo, attentionCount } = await getSocialService().listAccounts(
      c.var.db,
      orgId,
      page,
      {
        ...(platform !== undefined ? { platform } : {}),
        ...(statusRaw !== undefined ? { status: statusRaw } : {}),
        ...(attention !== undefined ? { attention } : {}),
      },
    );
    return c.json(
      success(
        {
          accounts: items.map((account) => ({
            ...account,
            tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
            connectedAt: account.connectedAt.toISOString(),
          })),
        },
        // `attentionCount` is the org-wide total, filter-independent: FR-SOC-044's widget says
        // "X accounts need attention" even while the operator is looking at one platform.
        { ...paginationMeta(pageInfo), attentionCount },
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

// GET /api/social/accounts/:accountId/usage — the per-account quota snapshot (`usage` tier).
// The detail route already embeds this; the separate read is the cheap poll a quota panel wants
// without re-fetching the profile, the breaker state and the health timeline (NWB-P2-007).
socialRouter.get(
  "/social/accounts/:accountId/usage",
  authMiddleware,
  requireAbility("usage", "socialaccounts"),
  async (c) => {
    const { orgId } = c.var.user;
    const accountId = accountIdParam(c);
    const service = getSocialService();
    const account = await service.getManageableAccount(c.var.db, {
      organizationId: orgId,
      accountId,
    });
    if (!account) throw new NotFoundError("Social account not found");
    const quota = await service.getQuotaSnapshot(c.var.db, {
      organizationId: orgId,
      accountId,
    });
    return c.json(
      success({
        accountId,
        platform: account.platform,
        platformUsername: account.platformUsername,
        usage: quota,
      }),
    );
  },
);

// POST /api/social/accounts/:accountId/health-check — probe now (`connect` tier: manager+).
// P2-003's sweep already re-probes breaker-open accounts every tick; this is the operator asking
// "is it fixed *now*" while looking at a red row, and a success closes the breaker through the
// very same `applyProbeSuccess` path (NWB-P2-007 — the recovery route P2-003 parked here).
socialRouter.post(
  "/social/accounts/:accountId/health-check",
  authMiddleware,
  requireAbility("connect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const accountId = accountIdParam(c);
    const result = await getSocialService().checkAccountHealth(c.var.db, {
      organizationId: orgId,
      accountId,
      actorId: userId,
    });
    return c.json(success({ ...result, lastErrorAt: result.lastErrorAt?.toISOString() ?? null }));
  },
);

// POST /api/social/accounts/:accountId/pause — stop collection, keep the connection (FR-SOC-016).
// `connect` tier, not `disconnect`: pausing is reversible, keeps the sealed tokens, and is exactly
// the "connection management" Module 3 §6.2 hands to Admin + Manager. A separate `update` verb
// would land in the contentCreation tier and hand a Creator the ability to stop an org's data
// collection (NWB-P2-007, decision 1).
socialRouter.post(
  "/social/accounts/:accountId/pause",
  authMiddleware,
  requireAbility("connect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const accountId = accountIdParam(c);
    const reason = await optionalReasonFromBody(c);
    const result = await getSocialService().setAccountCollection(c.var.db, {
      organizationId: orgId,
      accountId,
      actorId: userId,
      action: "pause",
      ...(reason !== undefined ? { reason } : {}),
    });
    return c.json(success(result));
  },
);

// POST /api/social/accounts/:accountId/resume — collection restarts with no new OAuth grant.
socialRouter.post(
  "/social/accounts/:accountId/resume",
  authMiddleware,
  requireAbility("connect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const accountId = accountIdParam(c);
    const reason = await optionalReasonFromBody(c);
    const result = await getSocialService().setAccountCollection(c.var.db, {
      organizationId: orgId,
      accountId,
      actorId: userId,
      action: "resume",
      ...(reason !== undefined ? { reason } : {}),
    });
    return c.json(success(result));
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
//
// `?dryRun=true` is FR-SOC-011's impact analysis: the confirmation modal has to show what a
// disconnection takes down *before* it asks anyone to type a username, so the dry run writes
// nothing and asks for nothing (NWB-P2-007).
socialRouter.delete(
  "/social/accounts/:accountId",
  authMiddleware,
  requireAbility("disconnect", "socialaccounts"),
  async (c) => {
    const { orgId, userId } = c.var.user;
    const accountId = accountIdParam(c);

    const dryRunRaw = c.req.query("dryRun");
    if (dryRunRaw !== undefined && dryRunRaw !== "false" && dryRunRaw !== "0") {
      if (dryRunRaw !== "true" && dryRunRaw !== "1") {
        throw new ValidationError("Unknown dryRun value", [
          { field: "dryRun", message: "Must be true or false" },
        ]);
      }
      const impact = await getSocialService().getDisconnectImpact(c.var.db, {
        organizationId: orgId,
        accountId,
      });
      return c.json(success({ dryRun: true, ...impact }));
    }

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
