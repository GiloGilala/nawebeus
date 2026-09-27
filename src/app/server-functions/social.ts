/**
 * TanStack Start Server Functions — Social accounts (P14.3, the "social connect" screen cluster).
 *
 * Thin adapters over `src/services/social`, exactly like every other domain here: validate with the
 * shared Zod schemas, derive `orgId`/`userId` from the session (never from the payload), assert the
 * CASL ability, delegate. No business logic — the state machines, the breaker, the quota ledger and
 * the notification hops all live in the service, and the Hono `/api/social` routes call the same
 * methods. Web goes direct (ADR-002 Principle 3); mobile and the OAuth callback use `/api/*`.
 *
 * The ability per function mirrors the route's `requireAbility` one for one, because a Server
 * Function bypasses Hono's middleware entirely — `assertServerAbility` *is* the guard here:
 *
 * | function | ability |
 * |---|---|
 * | list / detail / health timeline | `read socialaccounts` (Module 3 §6.2 — every seat may look) |
 * | usage roll-up + per-account usage | `usage socialaccounts` (manager+) |
 * | initiate connect, pause, resume, health-check | `connect socialaccounts` (manager+) |
 * | impact preview + disconnect | `disconnect socialaccounts` (admin only — it destroys credentials) |
 *
 * Two deliberate differences from the HTTP surface:
 *
 * - **Dates stay `Date`s.** The API routes call `.toISOString()` because JSON has no date type; the
 *   Server Function RPC does, so the web gets real `Date` objects and formats them in the component.
 * - **The impact preview and the disconnect are two functions, not one flag.** The modal calls
 *   `getSocialDisconnectImpactServerFn` first (FR-SOC-011) and only asks for the typed username
 *   after it has shown what will break; `disconnectSocialAccountServerFn` cannot be reached without
 *   `confirmUsername`, so a client that gets the order wrong gets a read, never a deletion. The
 *   HTTP surface keeps both halves on one `DELETE` route with `?dryRun=true`.
 */
import { NotFoundError, ValidationError } from "@/lib/errors";
import { decodeCursor } from "@/lib/pagination";
import {
  disconnectSocialAccountSchema,
  initiateSocialConnectSchema,
  listSocialAccountsQuerySchema,
  SOCIAL_ACCOUNT_ID_PATTERN,
  socialAccountHealthQuerySchema,
  socialAccountIdSchema,
  socialCollectionActionSchema,
} from "@/lib/validation";
import { getSocialService, type SocialPlatform } from "@/services/social";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

/**
 * Mint the single-use OAuth state and hand back the provider's authorize URL (FR-SOC-001/002).
 *
 * The browser navigates to `authorizeUrl`; the provider redirects to the **public** Hono callback
 * (`callbackPath`, mounted at `/api/social/oauth/:platform/callback`), which consumes the state and
 * 302s to `returnUrl` — `/settings/integrations?connected=<platform>` by default, so this screen is
 * where the operator lands back. An unconfigured platform is a validation error from the service:
 * the flow never half-starts.
 */
export const initiateSocialConnectServerFn = createServerFn({ method: "POST" })
  .validator(initiateSocialConnectSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof initiateSocialConnectSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "connect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, async () => {
      const result = await getSocialService().initiateConnect(db, {
        organizationId: auth.orgId,
        userId: auth.userId,
        platform: parsed.platform as SocialPlatform,
        // The callback's redirect target is this screen; naming it explicitly keeps the two
        // surfaces in step if the route ever moves.
        returnUrl: parsed.returnUrl ?? `/settings/integrations?connected=${parsed.platform}`,
      });
      return { authorizeUrl: result.authorizeUrl, expiresAt: result.expiresAt };
    });
  });

/**
 * The connection list (NWB-P2-006's keyset page + NWB-P2-007's attention filter).
 *
 * `attentionCount` is returned alongside the page and is **org-wide and filter-independent** —
 * FR-SOC-044's widget says "X accounts need attention" even while the operator is looking at one
 * platform, and computing it here keeps the header to the same round trip as the list.
 */
export const listSocialAccountsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listSocialAccountsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listSocialAccountsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "socialaccounts");
    const db = getServerDb();

    let cursor: { v: string; id: string } | null = null;
    if (parsed.cursor) {
      cursor = decodeCursor(parsed.cursor, { idPattern: SOCIAL_ACCOUNT_ID_PATTERN });
      if (cursor === null) {
        throw new ValidationError("Invalid pagination parameter", [
          { field: "cursor", message: "Malformed cursor" },
        ]);
      }
    }

    return withServerOrgContext(auth, async () => {
      const page = await getSocialService().listAccounts(
        db,
        auth.orgId,
        { limit: parsed.limit, cursor },
        {
          ...(parsed.platform !== undefined ? { platform: parsed.platform as SocialPlatform } : {}),
          ...(parsed.status !== undefined ? { status: parsed.status } : {}),
          ...(parsed.attention !== undefined ? { attention: parsed.attention } : {}),
        },
      );
      return { accounts: page.items, pageInfo: page.pageInfo, attentionCount: page.attentionCount };
    });
  });

/** One connection's management view: profile, breaker, last error, quota snapshot, latest health. */
export const getSocialAccountServerFn = createServerFn({ method: "GET" })
  .validator(socialAccountIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialAccountIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().getAccountDetail(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
      }),
    );
  });

/** The recent health-log timeline, newest first (FR-SOC-042's diagnostics data). */
export const getSocialAccountHealthServerFn = createServerFn({ method: "GET" })
  .validator(socialAccountHealthQuerySchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialAccountHealthQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, async () => {
      const health = await getSocialService().getAccountHealthLog(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
      });
      return { health };
    });
  });

/** The org's quota roll-up, every account's buckets (FR-SOC-031's dashboard read). */
export const getSocialUsageServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "usage", "socialaccounts");
  const db = getServerDb();

  return withServerOrgContext(auth, async () => {
    const usage = await getSocialService().getOrgQuotaUsage(db, auth.orgId);
    return { usage };
  });
});

/** One account's quota snapshot — the cheap poll a quota panel wants (NWB-P2-007). */
export const getSocialAccountUsageServerFn = createServerFn({ method: "GET" })
  .validator(socialAccountIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialAccountIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "usage", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, async () => {
      const service = getSocialService();
      const account = await service.getManageableAccount(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
      });
      if (!account) throw new NotFoundError("Social account not found");
      const usage = await service.getQuotaSnapshot(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
      });
      return {
        accountId: parsed.accountId,
        platform: account.platform,
        platformUsername: account.platformUsername,
        usage,
      };
    });
  });

/**
 * Probe now (NWB-P2-007). A success closes an open breaker through P2-003's own recovery path, so
 * this is the button behind "is it fixed yet?" — the sweep would get there within five minutes, but
 * an operator staring at a red row should not have to wait for it.
 */
export const checkSocialAccountHealthServerFn = createServerFn({ method: "POST" })
  .validator(socialAccountIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialAccountIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "connect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().checkAccountHealth(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
        actorId: auth.userId,
      }),
    );
  });

/** Pause collection (FR-SOC-016): tokens and history stay, so resume needs no new grant. */
export const pauseSocialAccountServerFn = createServerFn({ method: "POST" })
  .validator(socialCollectionActionSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialCollectionActionSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "connect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().setAccountCollection(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
        actorId: auth.userId,
        action: "pause",
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      }),
    );
  });

/** Resume collection — from `paused` only; a dead token goes back through OAuth instead. */
export const resumeSocialAccountServerFn = createServerFn({ method: "POST" })
  .validator(socialCollectionActionSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialCollectionActionSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "connect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().setAccountCollection(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
        actorId: auth.userId,
        action: "resume",
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      }),
    );
  });

/**
 * FR-SOC-011's impact analysis — the read half of the disconnect modal. There is no `dryRun` flag
 * here because there is nothing to turn off: this function only reads, and the disconnect is a
 * separate function that cannot be reached without `confirmUsername`. (The HTTP surface keeps the
 * flag because it has one `DELETE` route to serve both halves.)
 */
export const getSocialDisconnectImpactServerFn = createServerFn({ method: "GET" })
  .validator(socialAccountIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof socialAccountIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "disconnect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().getDisconnectImpact(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
      }),
    );
  });

/**
 * The disconnect (FR-SOC-012/013/014): admin only, typed-username confirmation, best-effort
 * provider revocation whose per-token outcome comes back for the receipt line, both ciphertexts
 * wiped, and the 90-day read-only retention window stamped.
 */
export const disconnectSocialAccountServerFn = createServerFn({ method: "POST" })
  .validator(disconnectSocialAccountSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof disconnectSocialAccountSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "disconnect", "socialaccounts");
    const db = getServerDb();

    return withServerOrgContext(auth, () =>
      getSocialService().disconnectAccount(db, {
        organizationId: auth.orgId,
        accountId: parsed.accountId,
        actorId: auth.userId,
        confirmationUsername: parsed.confirmUsername,
        ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
      }),
    );
  });
