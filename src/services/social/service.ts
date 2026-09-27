/**
 * Social account connection service (NWB-P2-001) — the OAuth state machine around the platform
 * registry (Module 3 §3.1, FR-SOC-001…007).
 *
 * The security shape, in one place:
 * - **State is the row.** `initiateConnect` writes a 128-char random state with a 10-minute TTL
 *   (FR-SOC-002) plus the PKCE verifier; `handleCallback` consumes it with one atomic
 *   `UPDATE … WHERE used_at IS NULL AND expires_at > now()` — a replay, an expired state, and a
 *   forged state are all the same empty result, so the endpoint cannot distinguish and cannot
 *   enumerate (the roadmap's required replay test pins this).
 * - **Tokens are sealed, never stored or logged raw** (FR-SOC-003 / FR-SOC-023). The service's
 *   row type structurally omits the ciphertext columns; the audit action carries platform +
 *   username + scopes only.
 * - **One connection per (org, platform, platform user)** (FR-SOC-004, the DB's unique
 *   constraint): a live duplicate is 409 `ACCOUNT_ALREADY_CONNECTED`; a *disconnected* row is
 *   revived — the documented reconnect path.
 * - **`returnUrl` is relative-or-nothing** at initiate time, so the public callback can never
 *   become an open redirect.
 */
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { decryptSecret, derivedKeyMaterial, encryptSecret } from "../../lib/crypto";
import type { Db } from "../../lib/db";
import {
  AccountAlreadyConnectedError,
  CircuitBreakerOpenError,
  ConflictError,
  describeError,
  NotFoundError,
  SocialAccountStateError,
  ValidationError,
} from "../../lib/errors";
import { logger } from "../../lib/logger";
import { buildPage, type Page, type PaginationParams } from "../../lib/pagination";
import { type AuditActionName, writeAuditLog } from "../audit";
import { PLATFORM_ADAPTERS } from "./adapters";
import {
  getSocialNotifier,
  type SocialNotificationEvent,
  type SocialNotificationResult,
} from "./notifier";
import { HttpPlatformOAuthClient, OAuthExchangeError } from "./oauth-client";
import {
  classifyPlatformHttpError,
  type OAuthExchangeResult,
  PLATFORM_OAUTH_PROFILES,
  type PlatformOAuthClient,
  resolvePlatformCredentials,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "./types";

/** The state parameter's lifetime (FR-SOC-002: ten minutes). */
export const OAUTH_STATE_TTL_SECONDS = 600;
/** Rows stay 24 h after expiry/consumption for debugging, then the purge reclaims them. */
export const OAUTH_STATE_RETENTION_SECONDS = 24 * 3_600;

export const SOCIAL_ACCOUNT_ID_PATTERN = /^soc_[0-9a-f-]{36}$/i;

/**
 * Token lifecycle constants (NWB-P2-002): refresh one hour before expiry (BR-SOC-013) on a
 * five-minute schedule (FR-SOC-019), with exactly one retry before `needs_reauth` (FR-SOC-021),
 * in batches so one tick can never walk the whole table.
 */
export const TOKEN_REFRESH_WINDOW_SECONDS = 3_600;
export const TOKEN_REFRESH_RETRY_MAX = 1;
export const TOKEN_REFRESH_BATCH_LIMIT = 50;

/**
 * Health-check constants (NWB-P2-003): the breaker opens at the module spec's 10 consecutive
 * failures (FR-SOC-056 — the schema header's sketched "5" loses to the requirement), routine
 * probes follow the 6-hour cadence (FR-SOC-039) while breaker-open accounts probe every run
 * (half-open recovery), and 24 h open escalates to critical (FR-SOC-059).
 */
export const CIRCUIT_BREAKER_THRESHOLD = 10;
/** FR-SOC-014: disconnected accounts stay readable for 90 days, then the retention worker reclaims them. */
export const DISCONNECT_RETENTION_DAYS = 90;
export const HEALTH_CHECK_BATCH_LIMIT = 50;
export const HEALTH_CHECK_INTERVAL_SECONDS = 6 * 3_600;
export const CHRONIC_FAILURE_AFTER_SECONDS = 24 * 3_600;

/**
 * Quota thresholds (NWB-P2-004, Module 3 §3.5): polling slows at 80% (FR-SOC-033), syncing
 * pauses at 100% (FR-SOC-034/035), and the admin-alert crossings land at 80% and 95%
 * (FR-SOC-038). `quota_status` is the worst bucket's band.
 */
export const QUOTA_WARNING_PERCENT = 80;
export const QUOTA_CRITICAL_PERCENT = 95;
export type QuotaBucketKind = "read" | "write";
export type QuotaStatus = "healthy" | "warning" | "critical" | "exhausted";

/** 128 hex chars from 64 random bytes — `oauth_states.id` is the state parameter itself. */
function generateState(): string {
  return randomBytes(64).toString("hex");
}

/**
 * A Postgres array literal for text[] params. Built as a string rather than passed as a JS
 * array: the driver's inferred bind type does not survive the `::text[]` cast (42846/22P02),
 * while an explicit, quoted literal always parses (the media service's `tagsLiteral` lesson).
 */
function pgTextArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\")}"`)}}`;
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { verifier, challenge };
}

export function callbackPathFor(platform: SocialPlatform): string {
  return `/api/social/oauth/${platform}/callback`;
}

const RETURN_URL_PATTERN = /^\/(?!\/)[^\s]*$/;

/** The service's view of a connected account — ciphertext columns cannot appear here (FR-SOC-023). */
export interface SocialAccountRecord {
  id: string;
  organizationId: string;
  platform: SocialPlatform;
  platformUserId: string;
  platformUsername: string;
  displayName: string | null;
  profileImageUrl: string | null;
  followerCount: number;
  status: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
  connectedBy: string;
  connectedAt: Date;
  version: number;
}

type SocialAccountRowRaw = {
  id: string;
  organization_id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string;
  display_name: string | null;
  profile_image_url: string | null;
  follower_count: number;
  status: string;
  scopes: string[] | null;
  token_expires_at: Date | null;
  connected_by: string;
  connected_at: Date;
  version: number;
};

/**
 * Raw `db.execute` rows carry timestamps as strings (drizzle's pg type parser passes them
 * through), so every management read normalizes before handing a Date to the routes.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return null;
}

function mapRow(raw: SocialAccountRowRaw): SocialAccountRecord {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    platform: raw.platform as SocialPlatform,
    platformUserId: raw.platform_user_id,
    platformUsername: raw.platform_username,
    displayName: raw.display_name,
    profileImageUrl: raw.profile_image_url,
    followerCount: raw.follower_count,
    status: raw.status,
    scopes: raw.scopes ?? [],
    tokenExpiresAt: toDate(raw.token_expires_at),
    connectedBy: raw.connected_by,
    connectedAt: toDate(raw.connected_at)!,
    version: raw.version,
  };
}

const ACCOUNT_COLUMNS = sql`
  id, organization_id, platform, platform_user_id, platform_username, display_name,
  profile_image_url, follower_count, status, scopes, token_expires_at, connected_by,
  connected_at, version
`;

export interface SocialServiceOptions {
  /**
   * Read a config/env value by name — resolved against `loadConfig()`'s output in production
   * wiring; tests pass a map. Kept as a function so the service never depends on the whole
   * `Config` shape (the platform pairs are the only fields it needs).
   */
  readonly readEnv: (name: string) => string | undefined;
  /** Sealing material for token ciphertext (`SOCIAL_TOKEN_ENCRYPTION_KEY` or the derived fallback). */
  readonly keyMaterial: string;
  /** The absolute base the callback redirect URIs hang off (config's `APP_BASE_URL_RESOLVED`). */
  readonly appBaseUrl: string;
  readonly oauthClient?: PlatformOAuthClient | undefined;
  /** Injectable fetch for the health probes (the Resend-transport pattern; CI never calls out). */
  readonly probeFetch?: typeof fetch | undefined;
  /** The budget a brand-new quota bucket materializes with (config `SOCIAL_QUOTA_DEFAULT_LIMIT`). */
  readonly defaultQuotaLimit?: number | undefined;
  readonly newId?: (() => string) | undefined;
  readonly now?: (() => Date) | undefined;
}

interface QuotaBucketJson {
  limit: number;
  used: number;
  resetsAt?: string | undefined;
}

/**
 * What a provider revocation attempt amounted to (FR-SOC-013). `not_supported` means no HTTP
 * call was made at all — either the platform publishes no revocation endpoint (Instagram,
 * Facebook) or there was no such token stored.
 */
export type RevocationOutcome = "revoked" | "provider_refused" | "not_supported" | "unreachable";

/** One downstream domain a disconnection could affect (FR-SOC-011's impact analysis). */
export interface DisconnectImpactDomain {
  readonly domain: "campaigns" | "monitoring" | "publishing" | "engagement";
  readonly label: string;
  /** `null` = not computable yet. Never `0` for an unadopted table — see `getDisconnectImpact`. */
  readonly count: number | null;
  /** The ticket that turns `null` into a number. */
  readonly landsWith: string;
}

const IMPACT_DOMAINS: readonly Omit<DisconnectImpactDomain, "count">[] = [
  {
    domain: "campaigns",
    label: "Campaigns using this account",
    landsWith: "NWB-P11 (Grow — db/campaigns adoption)",
  },
  {
    domain: "monitoring",
    label: "Listening queries and monitors fed by this account",
    landsWith: "NWB-P4/P5 (Monitor + Listen — db/monitoring adoption)",
  },
  {
    domain: "publishing",
    label: "Scheduled posts queued to this account",
    landsWith: "NWB-P3 (Publishing — db/publishing adoption)",
  },
  {
    domain: "engagement",
    label: "Engagement queues and saved replies on this account",
    landsWith: "NWB-P7 (Engage — db/engagement adoption)",
  },
];

/**
 * The aggregate of the two per-token outcomes (NWB-P2-007), so a partial revocation is never
 * reported as a clean one. `not_supported` is *absence of an attempt* rather than a failure —
 * a platform with no revocation endpoint, or a token that was never stored — so it only decides
 * the aggregate when nothing was attempted at all. Otherwise a provider that has no refresh
 * token to revoke would downgrade an honest `revoked` (Google's endpoint retires the whole grant
 * from the access token; Meta's long-lived tokens come with no refresh token).
 */
const REVOCATION_SEVERITY: readonly RevocationOutcome[] = [
  "revoked",
  "provider_refused",
  "unreachable",
];

function worstRevocation(...outcomes: RevocationOutcome[]): RevocationOutcome {
  let worst: RevocationOutcome = "not_supported";
  for (const outcome of outcomes) {
    if (outcome === "not_supported") continue;
    if (REVOCATION_SEVERITY.indexOf(outcome) > REVOCATION_SEVERITY.indexOf(worst)) worst = outcome;
  }
  return worst;
}

/** Worst-bucket-wins: `warning` < `critical` < `exhausted` (an account is as usable as its tightest bucket). */
const CROSSING_ORDER: QuotaStatus[] = ["healthy", "warning", "critical", "exhausted"];

function bucketStatus(bucket: QuotaBucketJson): QuotaStatus {
  const percent = bucket.limit > 0 ? (bucket.used / bucket.limit) * 100 : 100;
  if (percent >= 100) return "exhausted";
  if (percent >= QUOTA_CRITICAL_PERCENT) return "critical";
  if (percent >= QUOTA_WARNING_PERCENT) return "warning";
  return "healthy";
}

function quotaStatusFor(tracking: Record<string, QuotaBucketJson>): QuotaStatus {
  let worst: QuotaStatus = "healthy";
  for (const bucket of Object.values(tracking)) {
    const status = bucketStatus(bucket);
    if (CROSSING_ORDER.indexOf(status) > CROSSING_ORDER.indexOf(worst)) worst = status;
  }
  return worst;
}

export function createSocialService(options: SocialServiceOptions) {
  const { readEnv, keyMaterial, appBaseUrl } = options;
  const oauthClient = options.oauthClient ?? new HttpPlatformOAuthClient();
  const probeFetch = options.probeFetch ?? globalThis.fetch;
  const defaultQuotaLimit = options.defaultQuotaLimit ?? 10_000;
  const now = options.now ?? (() => new Date());

  function redirectUriFor(platform: SocialPlatform): string {
    return `${appBaseUrl.replace(/\/$/, "")}${callbackPathFor(platform)}`;
  }

  /**
   * The notification guard (FR-SOC-008 / FR-SOC-022's delivery half, NWB-P2-007).
   *
   * Awaited rather than fire-and-forget: `handleCallback` runs inside a **public** route whose
   * 302 must not race an unhandled rejection, and `markNeedsReauth` runs inside the refresh
   * sweep's transaction, where a floating promise would resolve after the transaction ended.
   * Awaiting is safe because the notifier cannot block — `emailService.send` files an outbox job
   * when the queue is up and sends directly when it is not.
   *
   * The try/catch is the contract: whatever notifier is installed (the production one, a test
   * double, P6's replacement) **cannot** fail the operation that triggered it. A dead SMTP
   * provider must not make it impossible to connect an account, and a stuck account must not
   * take its refresh batch down with it.
   */
  async function notify(
    db: NodePgDatabase<Record<string, any>>,
    event: SocialNotificationEvent,
  ): Promise<SocialNotificationResult> {
    try {
      const result = await getSocialNotifier()(db as Db, event);
      if (result.error) {
        logger.warn("social.notification_reported_error", {
          event: event.event,
          accountId: event.accountId,
          notified: result.notified,
          error: result.error,
        });
      }
      return result;
    } catch (error) {
      logger.error("social.notification_failed", {
        event: event.event,
        accountId: event.accountId,
        platform: event.platform,
        error: describeError(error),
      });
      return { notified: 0, error: describeError(error) };
    }
  }

  function requireCredentials(platform: SocialPlatform) {
    const credentials = resolvePlatformCredentials(readEnv, platform);
    if (!credentials) {
      const { label } = PLATFORM_OAUTH_PROFILES[platform];
      throw new ValidationError(`${label} OAuth is not configured on this deployment`, [
        { field: "platform", message: `${label} is not connected to an OAuth client yet` },
      ]);
    }
    return credentials;
  }

  return {
    get defaultOauthClient(): PlatformOAuthClient {
      return oauthClient;
    },

    /**
     * Create the single-use state and render the platform's authorize URL. Nothing about the
     * platform is contacted here — the browser does that — so initiation is pure local work.
     */
    async initiateConnect(
      db: NodePgDatabase<Record<string, any>>,
      input: {
        organizationId: string;
        userId: string;
        platform: SocialPlatform;
        returnUrl?: string | undefined;
      },
    ): Promise<{ authorizeUrl: string; expiresAt: Date }> {
      const profile = PLATFORM_OAUTH_PROFILES[input.platform];
      const credentials = requireCredentials(input.platform);

      let returnUrl: string | null = null;
      if (input.returnUrl !== undefined) {
        if (!RETURN_URL_PATTERN.test(input.returnUrl) || input.returnUrl.length > 512) {
          throw new ValidationError("returnUrl must be a relative path on this origin", [
            { field: "returnUrl", message: "Use an absolute path like /settings/integrations" },
          ]);
        }
        returnUrl = input.returnUrl;
      }

      const state = generateState();
      const pkce = profile.pkce ? generatePkcePair() : undefined;
      const nowDate = now();
      const expiresAt = new Date(nowDate.getTime() + OAUTH_STATE_TTL_SECONDS * 1_000);

      await db.execute(sql`
        INSERT INTO oauth_states (id, organization_id, user_id, platform, return_url, state_data, expires_at)
        VALUES (
          ${state}, ${input.organizationId}, ${input.userId}, ${input.platform},
          ${returnUrl},
          ${pkce ? JSON.stringify({ codeVerifier: pkce.verifier }) : null}::jsonb,
          ${expiresAt}
        )
      `);

      const authorize = new URL(profile.authorizeUrl);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("client_id", credentials.clientId);
      authorize.searchParams.set("redirect_uri", redirectUriFor(input.platform));
      authorize.searchParams.set("scope", profile.scopes.join(profile.scopeSeparator));
      authorize.searchParams.set("state", state);
      if (pkce) {
        authorize.searchParams.set("code_challenge", pkce.challenge);
        authorize.searchParams.set("code_challenge_method", "S256");
      }
      for (const [key, value] of Object.entries(profile.extraAuthorizeParams)) {
        authorize.searchParams.set(key, value);
      }
      return { authorizeUrl: authorize.toString(), expiresAt };
    },

    /**
     * Consume the state exactly once, exchange the code, seal the tokens, and connect (or
     * revive) the account. The consumption is the security gate — every failure of state is the
     * same error, and a state can never be spent twice.
     */
    async handleCallback(
      db: NodePgDatabase<Record<string, any>>,
      input: { platform: SocialPlatform; code: string; state: string },
    ): Promise<{ account: SocialAccountRecord; reconnected: boolean; returnUrl: string | null }> {
      const profile = PLATFORM_OAUTH_PROFILES[input.platform];
      const credentials = requireCredentials(input.platform);

      const consumed = (await db.execute<{
        id: string;
        organization_id: string;
        user_id: string;
        return_url: string | null;
        state_data: { codeVerifier?: string } | null;
      }>(sql`
        UPDATE oauth_states
        SET used_at = now()
        WHERE id = ${input.state}
          AND platform = ${input.platform}
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING organization_id, user_id, return_url, state_data
      `)) as any;
      const stateRow = consumed.rows?.[0] as
        | {
            organization_id: string;
            user_id: string;
            return_url: string | null;
            state_data: { codeVerifier?: string } | null;
          }
        | undefined;
      if (!stateRow) {
        // One message for unknown / expired / already-used — the route cannot become an oracle.
        throw new ValidationError("OAuth state is invalid, expired, or already used", [
          { field: "state", message: "Start the connection again" },
        ]);
      }

      let exchange: OAuthExchangeResult;
      try {
        exchange = await oauthClient.exchangeCode({
          platform: input.platform,
          code: input.code,
          redirectUri: redirectUriFor(input.platform),
          credentials,
          codeVerifier: stateRow.state_data?.codeVerifier,
        });
      } catch (error) {
        throw new ValidationError(
          `${PLATFORM_OAUTH_PROFILES[input.platform].label} could not complete the connection`,
          [
            {
              field: "code",
              message: error instanceof Error ? error.message : "The platform refused the exchange",
            },
          ],
        );
      }

      const nowDate = now();
      const tokenExpiresAt = new Date(
        nowDate.getTime() + (exchange.expiresInSeconds ?? profile.defaultExpiresInSeconds) * 1_000,
      );
      const accessTokenEncrypted = await encryptSecret(exchange.accessToken, keyMaterial);
      const refreshTokenEncrypted = exchange.refreshToken
        ? await encryptSecret(exchange.refreshToken, keyMaterial)
        : null;
      const scopes = exchange.scope
        ? exchange.scope.split(/[ ,]+/).filter((s) => s.length > 0)
        : [...profile.scopes];

      const existing = (await db.execute<SocialAccountRowRaw>(sql`
        SELECT ${ACCOUNT_COLUMNS} FROM social_accounts
        WHERE organization_id = ${stateRow.organization_id}
          AND platform = ${input.platform}
          AND platform_user_id = ${exchange.platformUserId}
        LIMIT 1
      `)) as any;
      const prior = existing.rows?.[0] as SocialAccountRowRaw | undefined;

      let account: SocialAccountRecord;
      let reconnected: boolean;
      if (prior && prior.status !== "disconnected") {
        throw new AccountAlreadyConnectedError(
          `${PLATFORM_OAUTH_PROFILES[input.platform].label} account @${prior.platform_username} is already connected`,
        );
      } else if (prior) {
        // Reconnect: revive the disconnected row (the unique constraint allows no second row).
        // The revive must clear **every** remnant of the outage that led here, not just the
        // disconnection columns: a breaker left open makes the freshly re-authenticated account
        // undispatchable (`assertDispatchAllowed` → 503) until a probe happens to close it, an
        // `is_active = false` left behind does the same *and* hides the row from both `*/5`
        // sweeps, and a retention stamp left set keeps it on the reclaim list. Re-authenticating
        // is exactly what an operator does to fix a broken connection, so it has to actually fix
        // it (NWB-P2-007 B2).
        const updated = (await db.execute<SocialAccountRowRaw>(sql`
          UPDATE social_accounts SET
            platform_username = ${exchange.platformUsername},
            display_name = ${exchange.displayName},
            profile_image_url = ${exchange.profileImageUrl},
            follower_count = ${exchange.followerCount ?? prior.follower_count},
            access_token_encrypted = ${accessTokenEncrypted},
            refresh_token_encrypted = ${refreshTokenEncrypted},
            token_expires_at = ${tokenExpiresAt},
            scopes = ${scopes.length > 0 ? pgTextArray(scopes) : null}::text[],
            status = 'active',
            is_active = true,
            connected_by = ${stateRow.user_id},
            connected_at = now(),
            disconnected_at = NULL,
            disconnected_by = NULL,
            disconnection_reason = NULL,
            data_retention_until = NULL,
            consecutive_error_count = 0,
            circuit_breaker_open = false,
            circuit_breaker_opened_at = NULL,
            last_error_at = NULL,
            last_error_message = NULL,
            last_error_code = NULL,
            version = version + 1,
            updated_at = now()
          WHERE id = ${prior.id}
          RETURNING ${ACCOUNT_COLUMNS}
        `)) as any;
        account = mapRow(updated.rows[0] as SocialAccountRowRaw);
        reconnected = true;
      } else {
        const assetId = options.newId?.() ?? `soc_${crypto.randomUUID()}`;
        const inserted = (await db.execute<SocialAccountRowRaw>(sql`
          INSERT INTO social_accounts (
            id, organization_id, platform, platform_user_id, platform_username, display_name,
            profile_image_url, follower_count, access_token_encrypted, refresh_token_encrypted,
            token_expires_at, scopes, status, connected_by
          ) VALUES (
            ${assetId}, ${stateRow.organization_id}, ${input.platform}, ${exchange.platformUserId},
            ${exchange.platformUsername}, ${exchange.displayName}, ${exchange.profileImageUrl},
            ${exchange.followerCount ?? 0},
            ${accessTokenEncrypted}, ${refreshTokenEncrypted}, ${tokenExpiresAt},
            ${scopes.length > 0 ? pgTextArray(scopes) : null}::text[], 'active', ${stateRow.user_id}
          )
          RETURNING ${ACCOUNT_COLUMNS}
        `)) as any;
        account = mapRow(inserted.rows[0] as SocialAccountRowRaw);
        reconnected = false;
      }

      await writeAuditLog({
        db,
        module: "social_accounts",
        organizationId: stateRow.organization_id,
        actorId: stateRow.user_id,
        actorType: "user",
        action: "socialaccount.connected",
        resourceId: account.id,
        afterState: {
          platform: account.platform,
          username: account.platformUsername,
          reconnected,
          scopes,
        },
      });

      // FR-SOC-008 (NWB-P2-007): the org's admins are told a connection appeared. The notifier
      // cannot throw (see `notify`), so this never changes the 302 the callback owes the browser.
      await notify(db, {
        event: reconnected ? "reconnected" : "connected",
        organizationId: stateRow.organization_id,
        accountId: account.id,
        platform: account.platform,
        platformUsername: account.platformUsername,
      });

      return { account, reconnected, returnUrl: stateRow.return_url };
    },

    /**
     * One refresh attempt against one account (the refresh grant over the stored refresh
     * token). Success: new tokens sealed (rotation replaces the refresh token, absence keeps
     * it — provider-dependent), row advanced under its optimistic `version`, a success row in
     * `token_refresh_log`. Failure: the error propagates to the caller — `refreshDueTokens`
     * owns the retry and the `needs_reauth` escalation, so this primitive stays single-purpose.
     */
    async refreshAccountToken(
      db: NodePgDatabase<Record<string, any>>,
      account: {
        id: string;
        organizationId: string;
        platform: SocialPlatform;
        status: string;
        tokenExpiresAt: Date | null;
        version: number;
      },
      options: {
        trigger: "proactive" | "on_demand" | "error_recovery" | "scheduled";
        retryCount?: number;
      },
    ): Promise<{ ok: true; tokenExpiresAt: Date; rotated: boolean }> {
      const profile = PLATFORM_OAUTH_PROFILES[account.platform];
      const credentials = requireCredentials(account.platform);

      const rows = (await db.execute<{ refresh_token_encrypted: string | null }>(sql`
        SELECT refresh_token_encrypted FROM social_accounts WHERE id = ${account.id}
      `)) as any;
      const sealedRefresh = (
        rows.rows?.[0] as { refresh_token_encrypted: string | null } | undefined
      )?.refresh_token_encrypted;
      if (!sealedRefresh) {
        // No refresh token to try (a platform that issues none, or a legacy row): there is
        // nothing a retry could change — go straight to surfacing.
        throw new OAuthExchangeError(
          account.platform,
          "no_refresh_token",
          "no refresh token is stored",
        );
      }

      const startedAt = Date.now();
      const refreshToken = await decryptSecret(sealedRefresh, keyMaterial);
      // The decrypt→call pair is the only plaintext moment; the sealed value never leaves.
      const result = await oauthClient.refreshTokens({
        platform: account.platform,
        refreshToken,
        credentials,
      });
      const nowDate = now();
      const newExpiry = new Date(
        nowDate.getTime() + (result.expiresInSeconds ?? profile.defaultExpiresInSeconds) * 1_000,
      );
      const newAccessSealed = await encryptSecret(result.accessToken, keyMaterial);
      const newRefreshSealed = result.refreshToken
        ? await encryptSecret(result.refreshToken, keyMaterial)
        : null;

      // Optimistic update — the schema header's rule: many writers (sync, health, breaker), so
      // a stale refresh must not silently overwrite a concurrent status change.
      const updated = (await db.execute(sql`
        UPDATE social_accounts SET
          access_token_encrypted = ${newAccessSealed},
          refresh_token_encrypted = COALESCE(${newRefreshSealed}, refresh_token_encrypted),
          token_expires_at = ${newExpiry},
          token_last_refreshed_at = now(),
          status = 'active',
          consecutive_error_count = 0,
          last_error_at = NULL,
          last_error_message = NULL,
          last_error_code = NULL,
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id} AND version = ${account.version}
      `)) as any;
      if ((updated.rowCount ?? 0) === 0) {
        throw new OAuthExchangeError(
          account.platform,
          "concurrent_modification",
          "the account row changed during the refresh; the next tick retries",
        );
      }

      const duration = Math.max(0, Date.now() - startedAt);
      await db.execute(sql`
        INSERT INTO token_refresh_log (
          id, social_account_id, success, triggered_by, old_token_expiry, new_token_expiry,
          refresh_duration, new_refresh_token_issued, retry_count
        ) VALUES (
          ${"trl_" + crypto.randomUUID()}, ${account.id}, true, ${options.trigger},
          ${account.tokenExpiresAt}, ${newExpiry}, ${duration}, ${result.rotated},
          ${options.retryCount ?? 0}
        )
      `);
      return { ok: true, tokenExpiresAt: newExpiry, rotated: result.rotated };
    },

    /**
     * Surface a dead refresh: `needs_reauth` (optimistic), a health-log transition row (the
     * schema requires an error message on that status), and the audit event — that trio *is*
     * FR-SOC-022's surfacing; the message dispatch to manager/admins is `notifyNeedsReauth`
     * (NWB-P2-007).
     *
     * The row update is unconditional (an account already in `needs_reauth` still deserves the
     * newest failure reason stamped on it — that is what the diagnostics panel shows), but the
     * **transition** artefacts are not: `chk_sahl_transition_differs` rejects a health-log row
     * whose `previous_status` equals its `status`, so re-surfacing an account that is already
     * `needs_reauth` raised 23514 and aborted the surrounding transaction. That is reachable the
     * moment an operator probes such an account (`checkAccountHealth` → `probeAccount` →
     * refresh-once → here), and it would equally poison any batch that re-tried a stuck row. The
     * audit event and the notification ride the same gate: a transition is reported once, not
     * once per probe (NWB-P2-007 B1).
     */
    async markNeedsReauth(
      db: NodePgDatabase<Record<string, any>>,
      account: {
        id: string;
        organizationId: string;
        platform: SocialPlatform;
        status: string;
        version: number;
      },
      input: {
        reason: string;
        code: string | null;
        trigger: string;
        retryCount: number;
        /** The account's platform username, for the FR-SOC-022 message (never token material). */
        username?: string | undefined;
      },
    ): Promise<boolean> {
      const updated = (await db.execute(sql`
        UPDATE social_accounts SET
          status = 'needs_reauth',
          is_active = false,
          last_error_at = now(),
          last_error_message = ${input.reason},
          last_error_code = ${input.code},
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id}
          AND version = ${account.version}
          AND status NOT IN ('disconnected')
      `)) as any;
      if ((updated.rowCount ?? 0) === 0) return false;

      // Already `needs_reauth`? The row was refreshed, but nothing *transitioned* — so no
      // health-log row (the schema's own CHECK forbids it), no second audit event, no re-notify.
      const transitioned = account.status !== "needs_reauth";
      if (!transitioned) return true;

      await db.execute(sql`
        INSERT INTO social_account_health_log (
          id, social_account_id, status, previous_status, error_message, error_code
        ) VALUES (
          ${"sahl_" + crypto.randomUUID()}, ${account.id}, 'needs_reauth', ${account.status},
          ${input.reason}, ${input.code}
        )
      `);

      await writeAuditLog({
        db,
        module: "social_accounts",
        organizationId: account.organizationId,
        actorId: undefined,
        actorType: "system",
        action: "socialaccount.needs_reauth",
        resourceId: account.id,
        afterState: {
          platform: account.platform,
          reason: input.reason,
          providerCode: input.code,
          trigger: input.trigger,
          attempts: input.retryCount + 1,
        },
      });

      // FR-SOC-022's delivery half (NWB-P2-007): Primary Manager + the org's admins, once per
      // transition — the gate above is what keeps a stuck account from emailing them every five
      // minutes. The Primary Manager is read here rather than threaded through the callers
      // because they hold probe/refresh shapes, and this path is the only one that needs it.
      const notifyRows = (await db.execute(
        sql`SELECT primary_manager_id, platform_username FROM social_accounts WHERE id = ${account.id}`,
      )) as any;
      const notifyRow = notifyRows.rows?.[0] as
        | { primary_manager_id: string | null; platform_username: string }
        | undefined;
      await notify(db, {
        event: "needs_reauth",
        organizationId: account.organizationId,
        accountId: account.id,
        platform: account.platform,
        platformUsername: input.username ?? notifyRow?.platform_username ?? account.id,
        primaryManagerId: notifyRow?.primary_manager_id ?? null,
        reason: input.reason,
      });
      return true;
    },

    /**
     * One `social_account_health_log` row per probe outcome. Transition semantics follow the
     * schema's own CHECK: `previous_status` is set only when the account's status actually
     * changed (a row recording "nothing changed" is not a transition event).
     */
    async writeHealthLog(
      db: NodePgDatabase<Record<string, any>>,
      account: { id: string; status: string },
      input: {
        status: string;
        errorMessage?: string | undefined;
        errorCode?: string | null | undefined;
        httpStatusCode?: number | null | undefined;
        apiSuccess?: boolean | null | undefined;
        apiLatency?: number | null | undefined;
        endpoint?: string | null | undefined;
        diagnosticData?: Record<string, unknown> | undefined;
      },
    ): Promise<void> {
      const previous = account.status === input.status ? null : account.status;
      await db.execute(sql`
        INSERT INTO social_account_health_log (
          id, social_account_id, status, previous_status, error_message, error_code,
          diagnostic_data, api_latency, api_success, http_status_code, endpoint
        ) VALUES (
          ${"sahl_" + crypto.randomUUID()}, ${account.id}, ${input.status}, ${previous},
          ${input.errorMessage ?? null}, ${input.errorCode ?? null},
          ${input.diagnosticData ? JSON.stringify(input.diagnosticData) : null}::jsonb,
          ${input.apiLatency ?? null}, ${input.apiSuccess ?? null},
          ${input.httpStatusCode ?? null}, ${input.endpoint ?? null}
        )
      `);
    },

    /**
     * One `token_refresh_log` failure row per failed attempt (FR-SOC-024: every attempt,
     * success or failure, logged with context; the provider's error code and HTTP status are
     * the debugging context, the token material never is).
     */
    async logRefreshFailure(
      db: NodePgDatabase<Record<string, any>>,
      account: { id: string; tokenExpiresAt: Date | null },
      input: {
        reason: string;
        code: string | null;
        httpStatusCode: number | null;
        retryCount: number;
      },
    ): Promise<void> {
      await db.execute(sql`
        INSERT INTO token_refresh_log (
          id, social_account_id, success, failure_reason, failure_code, http_status_code,
          triggered_by, old_token_expiry, retry_count
        ) VALUES (
          ${"trl_" + crypto.randomUUID()}, ${account.id}, false, ${input.reason}, ${input.code},
          ${input.httpStatusCode}, 'proactive', ${account.tokenExpiresAt}, ${input.retryCount}
        )
      `);
    },

    /**
     * The refresh sweep (NWB-P2-002): every active account whose token dies within the next
     * hour gets a proactive refresh, and a failed attempt retries exactly once (FR-SOC-021)
     * before the account surfaces as `needs_reauth`. Returns counts; never throws for one bad
     * account — a batch is reported, not held hostage (the worker convention).
     */
    async refreshDueTokens(
      db: NodePgDatabase<Record<string, any>>,
      options: { limit?: number; now?: Date } = {},
    ): Promise<{
      due: number;
      refreshed: number;
      rotated: number;
      needsReauth: number;
      failures: { accountId: string; reason: string }[];
    }> {
      const limit = Math.min(options.limit ?? TOKEN_REFRESH_BATCH_LIMIT, TOKEN_REFRESH_BATCH_LIMIT);
      const horizon = new Date(
        (options.now ?? now()).getTime() + TOKEN_REFRESH_WINDOW_SECONDS * 1_000,
      );
      const dueRows = (await db.execute<
        SocialAccountRowRaw & { refresh_token_encrypted: string | null }
      >(sql`
        SELECT ${ACCOUNT_COLUMNS}, refresh_token_encrypted FROM social_accounts
        WHERE status = 'active'
          AND is_active = true
          AND token_expires_at IS NOT NULL
          AND token_expires_at <= ${horizon}
        ORDER BY token_expires_at ASC
        LIMIT ${limit}
      `)) as any;

      const due = (dueRows.rows ?? []) as (SocialAccountRowRaw & {
        refresh_token_encrypted: string | null;
      })[];
      let refreshed = 0;
      let rotated = 0;
      let needsReauth = 0;
      const failures: { accountId: string; reason: string }[] = [];

      for (const raw of due) {
        const account = mapRow(raw);
        try {
          const outcome = await this.refreshAccountToken(db, account, { trigger: "proactive" });
          refreshed += 1;
          if (outcome.rotated) rotated += 1;
        } catch (firstError) {
          // FR-SOC-021: one retry before surfacing — a blip is not a dead token. Every failed
          // attempt gets its own token_refresh_log row (FR-SOC-024) before escalation.
          const detail = (code: unknown): string =>
            code instanceof OAuthExchangeError
              ? `${code.providerError ?? "error"}: ${code.message}`
              : code instanceof Error
                ? code.message
                : String(code);
          const partsOf = (
            code: unknown,
          ): { reason: string; providerCode: string | null; http: number | null } => ({
            reason: detail(code),
            providerCode:
              code instanceof OAuthExchangeError
                ? (code.providerError ?? code.httpStatusCode?.toString() ?? null)
                : null,
            http: code instanceof OAuthExchangeError ? code.httpStatusCode : null,
          });
          const first = partsOf(firstError);
          await this.logRefreshFailure(db, account, {
            reason: first.reason,
            code: first.providerCode,
            httpStatusCode: first.http,
            retryCount: 0,
          });
          try {
            await this.refreshAccountToken(db, account, { trigger: "proactive", retryCount: 1 });
            refreshed += 1;
          } catch (secondError) {
            const second = partsOf(secondError);
            await this.logRefreshFailure(db, account, {
              reason: second.reason,
              code: second.providerCode,
              httpStatusCode: second.http,
              retryCount: 1,
            });
            failures.push({ accountId: account.id, reason: second.reason });
            const surfaced = await this.markNeedsReauth(db, account, {
              reason: second.reason,
              code: second.providerCode,
              trigger: "proactive",
              retryCount: TOKEN_REFRESH_RETRY_MAX,
            });
            if (surfaced) needsReauth += 1;
          }
        }
      }
      return { due: due.length, refreshed, rotated, needsReauth, failures };
    },

    /**
     * One health probe (NWB-P2-003): a cheap authenticated GET against the platform (FR-SOC-039),
     * classified per FR-SOC-053. A 401 is never retried as itself (FR-SOC-055) — it triggers one
     * `on_demand` token refresh (P2-002's primitive) and a single re-probe; a refresh failure
     * surfaces as `needs_reauth`. Returns the outcome class so the sweep can count.
     */
    async probeAccount(
      db: NodePgDatabase<Record<string, any>>,
      account: {
        id: string;
        organizationId: string;
        platform: SocialPlatform;
        status: string;
        version: number;
        consecutiveErrorCount: number;
        circuitBreakerOpen: boolean;
        tokenExpiresAt: Date | null;
      },
    ): Promise<"healthy" | "error" | "rate_limited" | "needs_reauth"> {
      const profile = PLATFORM_OAUTH_PROFILES[account.platform];
      const accessToken = await this.unsealAccessToken(db, account.organizationId, account.id);
      if (!accessToken) {
        // An active account with no usable token is the auth failure case, full stop.
        await this.markNeedsReauth(db, account, {
          reason: "health probe found no usable access token",
          code: "no_access_token",
          trigger: "proactive",
          retryCount: 0,
        });
        await this.writeHealthLog(db, account, {
          status: "error",
          errorMessage: "health probe found no usable access token",
          errorCode: "no_access_token",
          endpoint: profile.probeUrl,
        });
        return "needs_reauth";
      }

      const startedAt = Date.now();
      let res: Response | undefined;
      let networkError: string | undefined;
      try {
        // The adapter owns the request's dialect (FR-SOC-039) — e.g. Reddit's required
        // User-Agent — while the service keeps timing, logging, and classification.
        const probeRequest = PLATFORM_ADAPTERS[account.platform].probeRequest(accessToken);
        res = await probeFetch(probeRequest.url, { headers: probeRequest.headers });
      } catch (error) {
        networkError = error instanceof Error ? error.message : String(error);
      }
      const latency = Math.max(0, Date.now() - startedAt);

      if (!res) {
        await this.applyProbeFailure(db, account, {
          outcome: "error",
          reason: `probe unreachable: ${networkError}`,
          code: "network_error",
          httpStatusCode: null,
          latency,
          endpoint: profile.probeUrl,
        });
        return "error";
      }

      const errorClass = classifyPlatformHttpError(res.status);
      if (res.ok) {
        await this.applyProbeSuccess(db, account, {
          latency,
          endpoint: profile.probeUrl,
          httpStatusCode: res.status,
        });
        return "healthy";
      }
      if (errorClass === "auth") {
        // FR-SOC-055: no retry of the 401 — one on_demand refresh, one re-probe, then surface.
        try {
          await this.refreshAccountToken(db, account, { trigger: "on_demand" });
        } catch {
          await this.markNeedsReauth(db, account, {
            reason: `probe got 401 and the token refresh failed`,
            code: "auth_refresh_failed",
            trigger: "on_demand",
            retryCount: 0,
          });
          await this.writeHealthLog(db, account, {
            status: "error",
            errorMessage: "probe got 401 and the token refresh failed",
            errorCode: "auth_refresh_failed",
            httpStatusCode: res.status,
            apiSuccess: false,
            apiLatency: latency,
            endpoint: profile.probeUrl,
          });
          return "needs_reauth";
        }
        // The refresh advanced the row's version — the success bookkeeping must not try to
        // update against the stale one (optimistic locking with a re-read, per the schema rule).
        const afterRefresh = await this.getProbeAccount(db, account.id);
        const retryStarted = Date.now();
        let retryRes: Response | undefined;
        try {
          // The probe reached the 401 branch, so a sealed token existed moments ago; the
          // re-seal's undefined (row vanished mid-probe) degrades to a failed retry, which
          // the code below already treats as "refresh did not recover the account".
          const retryToken = await this.unsealAccessToken(db, account.organizationId, account.id);
          if (retryToken) {
            const retryRequest = PLATFORM_ADAPTERS[account.platform].probeRequest(retryToken);
            retryRes = await probeFetch(retryRequest.url, { headers: retryRequest.headers });
          }
        } catch {
          // treated as a failed retry below
        }
        if (retryRes?.ok) {
          await this.applyProbeSuccess(db, afterRefresh ?? account, {
            latency: Math.max(0, Date.now() - retryStarted),
            endpoint: profile.probeUrl,
            httpStatusCode: retryRes.status,
          });
          return "healthy";
        }
        await this.markNeedsReauth(db, account, {
          reason: `probe got 401 and the refreshed token also failed`,
          code: "auth_refresh_insufficient",
          trigger: "on_demand",
          retryCount: 1,
        });
        await this.writeHealthLog(db, account, {
          status: "error",
          errorMessage: "probe got 401 and the refreshed token also failed",
          errorCode: "auth_refresh_insufficient",
          httpStatusCode: retryRes?.status ?? res.status,
          apiSuccess: false,
          endpoint: profile.probeUrl,
        });
        return "needs_reauth";
      }
      if (errorClass === "rate_limited") {
        // BR-SOC-019: respect the limit — record it, advance nothing. Rate limits are not
        // account failures.
        await this.writeHealthLog(db, account, {
          status: "rate_limited",
          errorMessage: "probe hit the platform's rate limit",
          errorCode: "rate_limited",
          httpStatusCode: res.status,
          apiSuccess: false,
          apiLatency: latency,
          endpoint: profile.probeUrl,
        });
        return "rate_limited";
      }
      await this.applyProbeFailure(db, account, {
        outcome: "error",
        reason: `probe failed with HTTP ${res.status}`,
        code: `http_${res.status}`,
        httpStatusCode: res.status,
        latency,
        endpoint: profile.probeUrl,
      });
      return "error";
    },

    /** Re-read an account into the probe shape (after a refresh moved its version). */
    async getProbeAccount(
      db: NodePgDatabase<Record<string, any>>,
      accountId: string,
    ): Promise<
      | {
          id: string;
          organizationId: string;
          platform: SocialPlatform;
          status: string;
          version: number;
          consecutiveErrorCount: number;
          circuitBreakerOpen: boolean;
          tokenExpiresAt: Date | null;
        }
      | undefined
    > {
      const rows = (await db.execute(sql`
        SELECT id, organization_id, platform, status, version,
               consecutive_error_count, circuit_breaker_open, token_expires_at
        FROM social_accounts WHERE id = ${accountId}
      `)) as any;
      const raw = rows.rows?.[0] as
        | {
            id: string;
            organization_id: string;
            platform: string;
            status: string;
            version: number;
            consecutive_error_count: number;
            circuit_breaker_open: boolean;
            token_expires_at: Date | null;
          }
        | undefined;
      if (!raw) return undefined;
      return {
        id: raw.id,
        organizationId: raw.organization_id,
        platform: raw.platform as SocialPlatform,
        status: raw.status,
        version: raw.version,
        consecutiveErrorCount: raw.consecutive_error_count,
        circuitBreakerOpen: raw.circuit_breaker_open,
        tokenExpiresAt: raw.token_expires_at,
      };
    },

    /** Failure bookkeeping: increment, stamp, health row, and open the breaker at 10 (FR-SOC-056). */
    async applyProbeFailure(
      db: NodePgDatabase<Record<string, any>>,
      account: {
        id: string;
        organizationId: string;
        platform: SocialPlatform;
        status: string;
        version: number;
        consecutiveErrorCount: number;
        circuitBreakerOpen: boolean;
      },
      input: {
        outcome: "error";
        reason: string;
        code: string | null;
        httpStatusCode: number | null;
        latency: number;
        endpoint: string;
      },
    ): Promise<void> {
      const nextCount = account.consecutiveErrorCount + 1;
      const opensNow = !account.circuitBreakerOpen && nextCount >= CIRCUIT_BREAKER_THRESHOLD;
      await db.execute(sql`
        UPDATE social_accounts SET
          consecutive_error_count = ${nextCount},
          last_error_at = now(),
          last_error_message = ${input.reason},
          last_error_code = ${input.code},
          ${
            opensNow
              ? sql`circuit_breaker_open = true, circuit_breaker_opened_at = now(), status = 'error',`
              : sql``
          }
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id} AND version = ${account.version}
      `);

      await this.writeHealthLog(db, account, {
        status: "error",
        errorMessage: input.reason,
        errorCode: input.code,
        httpStatusCode: input.httpStatusCode,
        apiSuccess: false,
        apiLatency: input.latency,
        endpoint: input.endpoint,
      });

      if (opensNow) {
        await writeAuditLog({
          db,
          module: "social_accounts",
          organizationId: account.organizationId,
          actorId: undefined,
          actorType: "system",
          action: "socialaccount.breaker_opened",
          resourceId: account.id,
          afterState: {
            platform: account.platform,
            consecutiveFailures: nextCount,
            lastError: input.reason,
            httpStatusCode: input.httpStatusCode,
          },
        });
      }
    },

    /** Success bookkeeping: zero the ledger, close an open breaker (the recovery path), health row. */
    async applyProbeSuccess(
      db: NodePgDatabase<Record<string, any>>,
      account: {
        id: string;
        organizationId: string;
        platform: SocialPlatform;
        status: string;
        version: number;
        consecutiveErrorCount: number;
        circuitBreakerOpen: boolean;
      },
      input: { latency: number; endpoint: string; httpStatusCode: number },
    ): Promise<void> {
      const recovers = account.circuitBreakerOpen;
      await db.execute(sql`
        UPDATE social_accounts SET
          consecutive_error_count = 0,
          last_error_at = NULL,
          last_error_message = NULL,
          last_error_code = NULL,
          ${
            recovers
              ? sql`circuit_breaker_open = false, circuit_breaker_opened_at = NULL, status = 'active',`
              : sql``
          }
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id} AND version = ${account.version}
      `);

      await this.writeHealthLog(db, account, {
        status: "healthy",
        apiSuccess: true,
        apiLatency: input.latency,
        httpStatusCode: input.httpStatusCode,
        endpoint: input.endpoint,
      });

      if (recovers) {
        await writeAuditLog({
          db,
          module: "social_accounts",
          organizationId: account.organizationId,
          actorId: undefined,
          actorType: "system",
          action: "socialaccount.breaker_recovered",
          resourceId: account.id,
          afterState: { platform: account.platform, latencyMs: input.latency },
        });
      }
    },

    /**
     * The health sweep (NWB-P2-003): breaker-open accounts probe **every run** (half-open
     * recovery — FR-SOC-056's "until health-checked"), everything else on the FR-SOC-039
     * six-hour cadence with the latest health-log row as the "last checked" source. Chronic
     * escalation (FR-SOC-059) runs in the same tick: an account whose breaker has been open
     * for over a day earns one critical audit + an `escalated` marker row (the marker makes it
     * once-per-outage, not per-tick).
     */
    async runHealthChecks(
      db: NodePgDatabase<Record<string, any>>,
      options: { limit?: number; now?: Date } = {},
    ): Promise<{
      checked: number;
      healthy: number;
      failed: number;
      rateLimited: number;
      needsReauth: number;
      breakerOpened: number;
      breakerRecovered: number;
      escalated: number;
    }> {
      const limit = Math.min(options.limit ?? HEALTH_CHECK_BATCH_LIMIT, HEALTH_CHECK_BATCH_LIMIT);
      const routineBefore = new Date(
        (options.now ?? now()).getTime() - HEALTH_CHECK_INTERVAL_SECONDS * 1_000,
      );

      const dueRows = (await db.execute(sql`
        SELECT sa.id, sa.organization_id, sa.platform, sa.status, sa.version,
               sa.consecutive_error_count, sa.circuit_breaker_open, sa.token_expires_at
        FROM social_accounts sa
        LEFT JOIN LATERAL (
          SELECT checked_at, status FROM social_account_health_log h
          WHERE h.social_account_id = sa.id
          ORDER BY h.checked_at DESC LIMIT 1
        ) latest ON true
        WHERE sa.status IN ('active', 'error')
          AND (
            sa.circuit_breaker_open = true
            OR COALESCE(latest.status, '') <> 'healthy'
            OR COALESCE(latest.checked_at, to_timestamp(0)) <= ${routineBefore}
          )
        ORDER BY sa.circuit_breaker_open DESC, COALESCE(latest.checked_at, to_timestamp(0)) ASC
        LIMIT ${limit}
      `)) as any;

      let checked = 0;
      let healthy = 0;
      let failed = 0;
      let rateLimited = 0;
      let needsReauth = 0;
      let breakerOpened = 0;
      let breakerRecovered = 0;

      for (const raw of (dueRows.rows ?? []) as {
        id: string;
        organization_id: string;
        platform: string;
        status: string;
        version: number;
        consecutive_error_count: number;
        circuit_breaker_open: boolean;
        token_expires_at: Date | null;
      }[]) {
        const account = {
          id: raw.id,
          organizationId: raw.organization_id,
          platform: raw.platform as SocialPlatform,
          status: raw.status,
          version: raw.version,
          consecutiveErrorCount: raw.consecutive_error_count,
          circuitBreakerOpen: raw.circuit_breaker_open,
          tokenExpiresAt: raw.token_expires_at,
        };
        const outcome = await this.probeAccount(db, account);
        checked += 1;
        if (outcome === "healthy") {
          healthy += 1;
          if (account.circuitBreakerOpen) breakerRecovered += 1;
        } else if (outcome === "rate_limited") {
          rateLimited += 1;
        } else if (outcome === "needs_reauth") {
          needsReauth += 1;
        } else {
          failed += 1;
          if (
            !account.circuitBreakerOpen &&
            account.consecutiveErrorCount + 1 >= CIRCUIT_BREAKER_THRESHOLD
          ) {
            breakerOpened += 1;
          }
        }
      }

      const escalated = await this.escalateChronicFailures(db);
      return {
        checked,
        healthy,
        failed,
        rateLimited,
        needsReauth,
        breakerOpened,
        breakerRecovered,
        escalated,
      };
    },

    /**
     * FR-SOC-059: a breaker open for over 24 hours is a silent extended outage — one critical
     * audit per outage (the `escalated` health row newer than `opened_at` is the guard) and a
     * marker row for the timeline. Notification dispatch is P6's channel; the record exists now.
     */
    async escalateChronicFailures(
      db: NodePgDatabase<Record<string, any>>,
      options: { now?: Date } = {},
    ): Promise<number> {
      const cutoff = new Date(
        (options.now ?? now()).getTime() - CHRONIC_FAILURE_AFTER_SECONDS * 1_000,
      );
      const rows = (await db.execute(sql`
        SELECT sa.id, sa.organization_id, sa.platform, sa.status, sa.circuit_breaker_opened_at
        FROM social_accounts sa
        WHERE sa.circuit_breaker_open = true
          AND sa.circuit_breaker_opened_at <= ${cutoff}
          AND NOT EXISTS (
            SELECT 1 FROM social_account_health_log h
            WHERE h.social_account_id = sa.id
              AND h.status = 'escalated'
              AND h.checked_at > sa.circuit_breaker_opened_at
          )
        LIMIT ${HEALTH_CHECK_BATCH_LIMIT}
      `)) as any;

      let escalated = 0;
      for (const raw of (rows.rows ?? []) as {
        id: string;
        organization_id: string;
        platform: string;
        status: string;
        circuit_breaker_opened_at: Date;
      }[]) {
        await writeAuditLog({
          db,
          module: "social_accounts",
          organizationId: raw.organization_id,
          actorId: undefined,
          actorType: "system",
          action: "socialaccount.chronic_failure",
          resourceId: raw.id,
          afterState: {
            platform: raw.platform,
            openSince: raw.circuit_breaker_opened_at,
            escalatedAt: (options.now ?? now()).toISOString(),
          },
        });
        await this.writeHealthLog(
          db,
          { id: raw.id, status: raw.status },
          {
            status: "escalated",
            errorMessage: "circuit breaker open for over 24 hours — escalated (FR-SOC-059)",
            errorCode: "chronic_failure",
          },
        );
        escalated += 1;
      }
      return escalated;
    },

    /**
     * The quota gate (NWB-P2-004, FR-SOC-031) — every adapter call passes through this before
     * spending platform units. A bucket that has never been seen materializes bounded (config
     * default) rather than silently unlimited; a bucket whose `resetsAt` has passed reads as
     * empty (the nightly roll resets it). `false` is the caller's signal to queue, not to fail
     * (FR-SOC-035: no data loss — process after the reset).
     */
    async hasQuotaRemaining(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string; kind: QuotaBucketKind; units?: number },
    ): Promise<boolean> {
      const rows = (await db.execute<{
        quota_tracking: Record<string, QuotaBucketJson> | null;
      }>(sql`
        SELECT quota_tracking FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
        LIMIT 1
      `)) as any;
      const tracking = (
        rows.rows?.[0] as { quota_tracking: Record<string, QuotaBucketJson> | null } | undefined
      )?.quota_tracking;
      if (!tracking) return true;
      const bucket = tracking[input.kind];
      if (!bucket) return true; // nothing spent yet — fresh bucket has full headroom
      const units = Math.max(1, input.units ?? 1);
      if (bucket.resetsAt && new Date(bucket.resetsAt) <= now()) return true; // window rolled
      return bucket.used + units <= bucket.limit;
    },

    /**
     * Spend units atomically: one `jsonb_set` UPDATE (concurrent spenders cannot lose an
     * increment; the optimistic version refuses a stale writer), `resetsAt` stamped when
     * supplied, and `quota_status` re-derived as the worst bucket's band — with one audit event
     * per *crossing* into warning/critical/exhausted (FR-SOC-038's alert record; delivery is
     * P6).
     */
    async updateQuotaUsage(
      db: NodePgDatabase<Record<string, any>>,
      input: {
        organizationId: string;
        accountId: string;
        kind: QuotaBucketKind;
        units: number;
        resetsAt?: Date | undefined;
        /** Set by the reset roll: zero instead of increment. */
        reset?: boolean;
      },
    ): Promise<{ used: number; limit: number; status: QuotaStatus; crossedTo?: QuotaStatus }> {
      if (input.units < 0) {
        throw new ValidationError("Quota usage cannot be negative", [
          { field: "units", message: "Spend a positive number of units" },
        ]);
      }

      // Atomic spend: the increment arithmetic happens *inside* the UPDATE, on the live jsonb —
      // two concurrent spenders serialize on the row lock and no increment is lost (the read
      // CTE takes FOR UPDATE; the harness's single client makes that safe, and production runs
      // each request on its own transaction). `quota_status` is re-derived from the post-spend
      // document as the worst bucket's band, and both statuses return so the crossing — the
      // audit event — is computed here against the truth, not a stale read.
      // NOTE: `reset` is optional — an interpolated `undefined` renders as an empty string in
      // Drizzle's SQL (param vanishes, `WHEN ::boolean` = syntax error), so normalize it to a
      // concrete boolean before it touches the template.
      const resetFlag = input.reset === true;
      const updated = (await db.execute<{
        doc: Record<string, QuotaBucketJson>;
        status: QuotaStatus;
        prior_status: QuotaStatus;
        used: number;
        limit: number;
      }>(sql`
        WITH prev AS (
          SELECT quota_tracking, quota_status FROM social_accounts
          WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
          FOR UPDATE
        ), spent AS (
          -- PG 18: jsonb_set no longer creates missing *intermediate* objects (a 2-level path
          -- on '{}' is a silent no-op), so compose the full bucket and merge it at the top
          -- level — a 1-element path works on '{}'.
          SELECT jsonb_set(
            COALESCE(prev.quota_tracking, '{}'::jsonb),
            ARRAY[${input.kind}::text],
            COALESCE(prev.quota_tracking -> ${input.kind}::text, '{}'::jsonb) || jsonb_build_object(
              'limit',
                COALESCE((prev.quota_tracking -> ${input.kind}::text ->> 'limit')::bigint, ${defaultQuotaLimit}::bigint),
              'used',
                CASE WHEN ${resetFlag}::boolean THEN 0::bigint
                  ELSE COALESCE((prev.quota_tracking -> ${input.kind}::text ->> 'used')::bigint, 0) + ${input.units}::bigint END,
              'resetsAt',
                COALESCE(
                  ${input.resetsAt !== undefined ? sql`to_jsonb(${(input.resetsAt as Date).toISOString()}::text)` : sql`NULL::jsonb`},
                  prev.quota_tracking -> ${input.kind}::text -> 'resetsAt')
            )
          ) AS doc, prev.quota_status AS prior_status
          FROM prev
        ), worst AS (
          SELECT spent.doc, spent.prior_status,
            (SELECT COALESCE(max(
               CASE WHEN (value ->> 'limit')::bigint > 0
                 THEN LEAST(100, ((value ->> 'used')::bigint * 100) / (value ->> 'limit')::bigint)
                 ELSE 100 END), 0)
             FROM jsonb_each(spent.doc)) AS worst_percent,
            (spent.doc -> ${input.kind}::text ->> 'used')::bigint AS used,
            (spent.doc -> ${input.kind}::text ->> 'limit')::bigint AS limit
          FROM spent
        ), derived AS (
          SELECT worst.*, (CASE
            WHEN worst_percent >= 100 THEN 'exhausted'
            WHEN worst_percent >= ${QUOTA_CRITICAL_PERCENT} THEN 'critical'
            WHEN worst_percent >= ${QUOTA_WARNING_PERCENT} THEN 'warning'
            ELSE 'healthy' END)::varchar AS status
          FROM worst
        )
        UPDATE social_accounts sa SET
          quota_tracking = derived.doc,
          quota_status = derived.status,
          version = sa.version + 1,
          updated_at = now()
        FROM derived
        WHERE sa.id = ${input.accountId}
          AND sa.organization_id = ${input.organizationId}
          AND sa.version = (SELECT version FROM social_accounts WHERE id = ${input.accountId})
        RETURNING derived.status, derived.prior_status, derived.used, derived.limit, derived.doc
      `)) as any;
      const updatedRow = (
        updated.rows as
          | {
              status: QuotaStatus;
              prior_status: QuotaStatus;
              used: number;
              limit: number;
            }[]
          | undefined
      )?.[0];
      if (!updatedRow) {
        // No RETURNING row: either the account never existed (→ NotFoundError, the caller's
        // 404) or a concurrent writer moved the version between the locking read and the
        // UPDATE (→ retry the call; nothing was spent). A fresh existence read tells them
        // apart without guessing.
        const exists = (await db.execute(sql`
          SELECT 1 FROM social_accounts
          WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
          LIMIT 1
        `)) as any;
        if (!exists.rows?.length) {
          throw new NotFoundError("Social account not found");
        }
        throw new Error("social account row changed during quota update; retry the call");
      }
      const status = updatedRow.status;
      const used = Number(updatedRow.used);
      const limit = Number(updatedRow.limit);
      const crossedTo =
        status !== updatedRow.prior_status &&
        CROSSING_ORDER.indexOf(status) > CROSSING_ORDER.indexOf(updatedRow.prior_status)
          ? status
          : undefined;
      void updated;

      if (crossedTo && crossedTo !== "healthy") {
        const action =
          crossedTo === "warning"
            ? "socialaccount.quota_warning"
            : crossedTo === "critical"
              ? "socialaccount.quota_critical"
              : "socialaccount.quota_exhausted";
        await writeAuditLog({
          db,
          module: "social_accounts",
          organizationId: input.organizationId,
          actorId: undefined,
          actorType: "system",
          action,
          resourceId: input.accountId,
          afterState: {
            bucket: input.kind,
            used,
            limit,
            percent: Math.round((used / limit) * 100),
          },
        });
      }

      return { used, limit, status, ...(crossedTo !== undefined ? { crossedTo } : {}) };
    },

    /** The read behind the P2-006 usage route and P13 plan limits: buckets + utilization. */
    async getQuotaSnapshot(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string },
    ): Promise<{
      status: QuotaStatus;
      buckets: Record<
        string,
        { used: number; limit: number; percent: number; resetsAt: string | null }
      >;
    }> {
      const rows = (await db.execute<{
        quota_tracking: Record<string, QuotaBucketJson> | null;
        quota_status: string;
      }>(sql`
        SELECT quota_tracking, quota_status FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
        LIMIT 1
      `)) as any;
      const row = rows.rows?.[0] as
        | { quota_tracking: Record<string, QuotaBucketJson> | null; quota_status: string }
        | undefined;
      if (!row) throw new NotFoundError("Social account not found");
      const tracking = row.quota_tracking ?? {};
      const buckets: Record<
        string,
        { used: number; limit: number; percent: number; resetsAt: string | null }
      > = {};
      for (const [kind, bucket] of Object.entries(tracking)) {
        buckets[kind] = {
          used: bucket.used,
          limit: bucket.limit,
          percent:
            bucket.limit > 0 ? Math.min(100, Math.round((bucket.used / bucket.limit) * 100)) : 100,
          resetsAt: bucket.resetsAt ?? null,
        };
      }
      return { status: row.quota_status as QuotaStatus, buckets };
    },

    /**
     * Roll every bucket whose `resetsAt` has passed back to zero + `healthy` (FR-SOC-034's
     * "resume immediately after reset"). Idempotent; the nightly reclamation job calls this in
     * the same pass as the rate-limit sweep.
     */
    async resetDueQuotas(db: NodePgDatabase<Record<string, any>>): Promise<{ reset: number }> {
      const rows = (await db.execute<{
        id: string;
        organization_id: string;
        quota_tracking: Record<string, QuotaBucketJson>;
      }>(sql`
        SELECT id, organization_id, quota_tracking FROM social_accounts
        WHERE quota_status <> 'healthy'
          AND EXISTS (
            SELECT 1 FROM jsonb_each_text(quota_tracking) AS t(kind, value)
            WHERE (value::jsonb ->> 'resetsAt') IS NOT NULL
              AND (value::jsonb ->> 'resetsAt')::timestamptz <= now()
          )
        LIMIT ${HEALTH_CHECK_BATCH_LIMIT * 4}
      `)) as any;

      let reset = 0;
      for (const raw of (rows.rows ?? []) as {
        id: string;
        organization_id: string;
        quota_tracking: Record<string, QuotaBucketJson>;
      }[]) {
        const tracking: Record<string, QuotaBucketJson> = {};
        let changed = false;
        for (const [kind, bucket] of Object.entries(raw.quota_tracking)) {
          const due = bucket.resetsAt !== undefined && new Date(bucket.resetsAt) <= now();
          tracking[kind] = due ? { ...bucket, used: 0 } : bucket;
          if (due) changed = true;
        }
        if (!changed) continue;
        const status = quotaStatusFor(tracking);
        const updated = (await db.execute(sql`
          UPDATE social_accounts SET
            quota_tracking = ${JSON.stringify(tracking)}::jsonb,
            quota_status = ${status},
            version = version + 1,
            updated_at = now()
          WHERE id = ${raw.id} AND quota_status <> 'healthy'
          RETURNING id
        `)) as any;
        if (((updated.rows as unknown[]) ?? []).length > 0) reset += 1;
      }
      return { reset };
    },

    /**
     * The connected-account list (NWB-P2-006): newest-connected first, keyset-paginated with
     * the media library's microsecond cursor (same-transaction connects share `connected_at`),
     * filtered by platform/status, projected without any token column (FR-SOC-023 by type).
     *
     * `attention` (NWB-P2-007) is the FR-SOC-044 widget's data half: an account needs attention
     * when its status is `error` or `needs_reauth`, its breaker is open, or its quota ladder has
     * reached `critical`/`exhausted`. `attentionCount` is the org-wide total **ignoring every
     * filter** — the widget says "X accounts need attention" whether or not the operator is
     * currently looking at one platform, and computing it here keeps that to one round trip.
     */
    async listAccounts(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      page: PaginationParams,
      filters: {
        platform?: SocialPlatform | undefined;
        status?: string | undefined;
        attention?: boolean | undefined;
      } = {},
    ): Promise<
      Page<{
        id: string;
        platform: SocialPlatform;
        platformUsername: string;
        displayName: string | null;
        profileImageUrl: string | null;
        followerCount: number;
        status: string;
        quotaStatus: string;
        circuitBreakerOpen: boolean;
        tokenExpiresAt: Date | null;
        connectedAt: Date;
      }> & { attentionCount: number }
    > {
      const platformClause = filters.platform ? sql`AND platform = ${filters.platform}` : sql``;
      // Disconnected rows are hidden unless the filter names them explicitly — the list is a
      // management surface, and a disconnected account is no longer manageable (FR-SOC-014).
      const statusClause = filters.status
        ? sql`AND status = ${filters.status}`
        : sql`AND status <> 'disconnected'`;
      // The status and quota literals are inlined, not bound: the driver cannot infer a type for
      // a Postgres enum parameter, and these strings are ours (FR-SOC-044's definition), not input.
      const attentionPredicate = sql`(status IN ('error', 'needs_reauth')
          OR circuit_breaker_open = TRUE
          OR quota_status IN ('critical', 'exhausted'))`;
      const attentionClause = filters.attention ? sql`AND ${attentionPredicate}` : sql``;
      const cursorClause = page.cursor
        ? sql`AND (connected_at, id) < (${page.cursor.v}::timestamptz, ${page.cursor.id}::text)`
        : sql``;
      const rows = (await db.execute(sql`
        SELECT id, platform, platform_username, display_name, profile_image_url, follower_count,
               status, quota_status, circuit_breaker_open, token_expires_at, connected_at,
               to_char(connected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS cursor_v
        FROM social_accounts
        WHERE organization_id = ${organizationId}
          ${platformClause}
          ${statusClause}
          ${attentionClause}
          ${cursorClause}
        ORDER BY connected_at DESC, id DESC
        LIMIT ${page.limit + 1}
      `)) as any;
      const attentionCountRows = (await db.execute(sql`
        SELECT count(*)::int AS attention_count
        FROM social_accounts
        WHERE organization_id = ${organizationId}
          AND status <> 'disconnected'
          AND ${attentionPredicate}
      `)) as any;
      const attentionCount =
        (attentionCountRows.rows?.[0] as { attention_count: number } | undefined)
          ?.attention_count ?? 0;
      const entries = (
        (rows.rows ?? []) as {
          id: string;
          platform: string;
          platform_username: string;
          display_name: string | null;
          profile_image_url: string | null;
          follower_count: number;
          status: string;
          quota_status: string;
          circuit_breaker_open: boolean;
          token_expires_at: Date | null;
          connected_at: Date;
          cursor_v: string;
        }[]
      ).map((raw) => ({
        id: raw.id,
        platform: raw.platform as SocialPlatform,
        platformUsername: raw.platform_username,
        displayName: raw.display_name,
        profileImageUrl: raw.profile_image_url,
        followerCount: raw.follower_count,
        status: raw.status,
        quotaStatus: raw.quota_status,
        circuitBreakerOpen: raw.circuit_breaker_open,
        tokenExpiresAt: toDate(raw.token_expires_at),
        connectedAt: toDate(raw.connected_at)!,
        _cursorV: raw.cursor_v,
      }));
      const result = buildPage(entries, page.limit, (entry) => entry._cursorV);
      return {
        ...result,
        items: result.items.map(({ _cursorV: _, ...rest }) => rest),
        attentionCount,
      };
    },

    /**
     * One account's full management view (NWB-P2-006): profile, status + breaker + last error,
     * quota snapshot, and the latest health-log entry. Disconnected rows 404 — the list and
     * this view agree that a disconnected account is not a management target (FR-SOC-014's
     * read-only archive is a retention-worker concern, not a route).
     */
    async getAccountDetail(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string },
    ): Promise<{
      account: SocialAccountRecord & {
        circuitBreakerOpen: boolean;
        circuitBreakerOpenedAt: Date | null;
        lastErrorAt: Date | null;
        lastErrorMessage: string | null;
        lastErrorCode: string | null;
        quotaStatus: string;
        dataRetentionUntil: Date | null;
      };
      quota: {
        status: QuotaStatus;
        buckets: Record<
          string,
          { used: number; limit: number; percent: number; resetsAt: string | null }
        >;
      };
      latestHealth:
        | {
            status: string;
            errorMessage: string | null;
            errorCode: string | null;
            apiLatency: number | null;
            httpStatusCode: number | null;
            checkedAt: Date;
          }
        | undefined;
    }> {
      const rows = (await db.execute(sql`
        SELECT ${ACCOUNT_COLUMNS},
               circuit_breaker_open, circuit_breaker_opened_at,
               last_error_at, last_error_message, last_error_code,
               quota_status, data_retention_until
        FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
          AND status <> 'disconnected'
        LIMIT 1
      `)) as any;
      const raw = rows.rows?.[0] as
        | (Record<string, unknown> & { platform: string; id: string })
        | undefined;
      if (!raw) throw new NotFoundError("Social account not found");
      const account = {
        ...(mapRow(raw as unknown as SocialAccountRowRaw) as SocialAccountRecord & {
          circuitBreakerOpen: boolean;
          circuitBreakerOpenedAt: Date | null;
          lastErrorAt: Date | null;
          lastErrorMessage: string | null;
          lastErrorCode: string | null;
          quotaStatus: string;
          dataRetentionUntil: Date | null;
        }),
        circuitBreakerOpen: raw.circuit_breaker_open as boolean,
        circuitBreakerOpenedAt: toDate(raw.circuit_breaker_opened_at),
        lastErrorAt: toDate(raw.last_error_at),
        lastErrorMessage: (raw.last_error_message as string | null) ?? null,
        lastErrorCode: (raw.last_error_code as string | null) ?? null,
        quotaStatus: raw.quota_status as string,
        dataRetentionUntil: toDate(raw.data_retention_until),
      };
      const quota = await this.getQuotaSnapshot(db, {
        organizationId: input.organizationId,
        accountId: input.accountId,
      });
      const healthRows = (await db.execute(sql`
        SELECT status, error_message, error_code, api_latency, http_status_code, checked_at
        FROM social_account_health_log WHERE social_account_id = ${input.accountId}
        ORDER BY checked_at DESC LIMIT 1
      `)) as any;
      const latestHealthRaw = healthRows.rows?.[0] as
        | {
            status: string;
            error_message: string | null;
            error_code: string | null;
            api_latency: number | null;
            http_status_code: number | null;
            checked_at: Date;
          }
        | undefined;
      return {
        account,
        quota,
        latestHealth: latestHealthRaw
          ? {
              status: latestHealthRaw.status,
              errorMessage: latestHealthRaw.error_message,
              errorCode: latestHealthRaw.error_code,
              apiLatency: latestHealthRaw.api_latency,
              httpStatusCode: latestHealthRaw.http_status_code,
              checkedAt: toDate(latestHealthRaw.checked_at)!,
            }
          : undefined,
      };
    },

    /** The recent health-log timeline for one account (the diagnostics read, FR-SOC-042's data). */
    async getAccountHealthLog(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string; limit?: number },
    ): Promise<
      {
        id: string;
        status: string;
        previousStatus: string | null;
        errorMessage: string | null;
        errorCode: string | null;
        apiLatency: number | null;
        httpStatusCode: number | null;
        checkedAt: Date;
      }[]
    > {
      const owner = (await db.execute(sql`
        SELECT 1 FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
        LIMIT 1
      `)) as any;
      if (!owner.rows?.[0]) throw new NotFoundError("Social account not found");
      const rows = (await db.execute(sql`
        SELECT id, status, previous_status, error_message, error_code, api_latency,
               http_status_code, checked_at
        FROM social_account_health_log WHERE social_account_id = ${input.accountId}
        ORDER BY checked_at DESC LIMIT ${Math.min(input.limit ?? 20, 100)}
      `)) as any;
      return (
        (rows.rows ?? []) as {
          id: string;
          status: string;
          previous_status: string | null;
          error_message: string | null;
          error_code: string | null;
          api_latency: number | null;
          http_status_code: number | null;
          checked_at: Date;
        }[]
      ).map((raw) => ({
        id: raw.id,
        status: raw.status,
        previousStatus: raw.previous_status,
        errorMessage: raw.error_message,
        errorCode: raw.error_code,
        apiLatency: raw.api_latency,
        httpStatusCode: raw.http_status_code,
        checkedAt: toDate(raw.checked_at)!,
      }));
    },

    /** The org's quota roll-up (FR-SOC-031's dashboard read): every account's buckets + status. */
    async getOrgQuotaUsage(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
    ): Promise<
      {
        accountId: string;
        platform: SocialPlatform;
        platformUsername: string;
        quotaStatus: QuotaStatus;
        buckets: Record<
          string,
          { used: number; limit: number; percent: number; resetsAt: string | null }
        >;
      }[]
    > {
      const rows = (await db.execute(sql`
        SELECT id, platform, platform_username, quota_tracking, quota_status
        FROM social_accounts
        WHERE organization_id = ${organizationId} AND status <> 'disconnected'
        ORDER BY connected_at DESC
      `)) as any;
      return (
        (rows.rows ?? []) as {
          id: string;
          platform: string;
          platform_username: string;
          quota_tracking: Record<string, QuotaBucketJson> | null;
          quota_status: string;
        }[]
      ).map((raw) => {
        const tracking = raw.quota_tracking ?? {};
        const buckets: Record<
          string,
          { used: number; limit: number; percent: number; resetsAt: string | null }
        > = {};
        for (const [kind, bucket] of Object.entries(tracking)) {
          buckets[kind] = {
            used: bucket.used,
            limit: bucket.limit,
            percent:
              bucket.limit > 0
                ? Math.min(100, Math.round((bucket.used / bucket.limit) * 100))
                : 100,
            resetsAt: bucket.resetsAt ?? null,
          };
        }
        return {
          accountId: raw.id,
          platform: raw.platform as SocialPlatform,
          platformUsername: raw.platform_username,
          quotaStatus: raw.quota_status as QuotaStatus,
          buckets,
        };
      });
    },

    /**
     * The disconnect (NWB-P2-006, FR-SOC-012/013/014): typed-username confirmation, best-effort
     * platform revocation through the adapter's `revokeRequest` (outcome audited, never a
     * blocker — the local wipe is the security property), both token columns wiped, status +
     * timestamps + the 90-day read-only retention window set, one audit row.
     */
    async disconnectAccount(
      db: NodePgDatabase<Record<string, any>>,
      input: {
        organizationId: string;
        accountId: string;
        actorId: string;
        confirmationUsername: string;
        reason?: string | undefined;
      },
    ): Promise<{
      platform: SocialPlatform;
      platformUsername: string;
      revocation: RevocationOutcome;
      /** Per-token outcomes — the aggregate hides which of the two the provider refused. */
      revocationDetail: { access: RevocationOutcome; refresh: RevocationOutcome };
      dataRetentionUntil: Date;
    }> {
      const rows = (await db.execute(sql`
        SELECT ${ACCOUNT_COLUMNS}, refresh_token_encrypted
        FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
          AND status <> 'disconnected'
        LIMIT 1
      `)) as any;
      const raw = rows.rows?.[0] as
        | (SocialAccountRowRaw & { refresh_token_encrypted: string | null })
        | undefined;
      if (!raw) throw new NotFoundError("Social account not found");
      const account = mapRow(raw);

      // FR-SOC-012: the operator types the username; a mismatch is a refused disconnect, not a
      // fuzzy match — the confirmation exists to make accident expensive.
      if (input.confirmationUsername !== account.platformUsername) {
        throw new ValidationError("Confirmation does not match the account username", [
          {
            field: "confirmUsername",
            message: `Type the account's platform username (${account.platformUsername}) to confirm`,
          },
        ]);
      }

      // FR-SOC-013: revoke at the provider when the platform has an endpoint. Best-effort by
      // design: a refusal or a network error is recorded, but the local wipe happens either way.
      //
      // **Both** tokens are revoked when both are stored (NWB-P2-007): an access-token-only
      // revoke leaves the provider holding a refresh token that can mint a replacement, which is
      // not "immediately revoke OAuth tokens" in any reading. The aggregate `revocation` is the
      // worst of the two outcomes, so one refusal is never reported as a clean revoke.
      const adapter = PLATFORM_ADAPTERS[account.platform];
      const credentials = resolvePlatformCredentials(readEnv, account.platform);
      const sealed = (
        (await db.execute(
          sql`SELECT access_token_encrypted, refresh_token_encrypted
            FROM social_accounts WHERE id = ${account.id}`,
        )) as any
      ).rows?.[0] as
        | { access_token_encrypted: string | null; refresh_token_encrypted: string | null }
        | undefined;
      const revocationOf = async (
        sealedToken: string | null,
        tokenType: "access_token" | "refresh_token",
      ): Promise<RevocationOutcome> => {
        if (!adapter.revokeRequest || !credentials || !sealedToken) return "not_supported";
        try {
          const request = adapter.revokeRequest({
            token: await decryptSecret(sealedToken, keyMaterial),
            credentials,
            tokenType,
          });
          const res = await probeFetch(request.url, request.init);
          return res.ok ? "revoked" : "provider_refused";
        } catch {
          return "unreachable";
        }
      };
      const accessRevocation = await revocationOf(
        sealed?.access_token_encrypted ?? null,
        "access_token",
      );
      const refreshRevocation = await revocationOf(
        sealed?.refresh_token_encrypted ?? null,
        "refresh_token",
      );
      const revocation = worstRevocation(accessRevocation, refreshRevocation);

      const retentionUntil = new Date(
        now().getTime() + DISCONNECT_RETENTION_DAYS * 24 * 3_600 * 1_000,
      );
      await db.execute(sql`
        UPDATE social_accounts SET
          access_token_encrypted = NULL,
          refresh_token_encrypted = NULL,
          token_expires_at = NULL,
          status = 'disconnected',
          is_active = false,
          disconnected_at = now(),
          disconnected_by = ${input.actorId},
          disconnection_reason = ${input.reason ?? null},
          data_retention_until = ${retentionUntil},
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id} AND version = ${account.version}
      `);

      await writeAuditLog({
        db,
        module: "social_accounts",
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: "user",
        action: "socialaccount.disconnected",
        resourceId: account.id,
        afterState: {
          platform: account.platform,
          username: account.platformUsername,
          reason: input.reason ?? null,
          revocation,
          revocationDetail: { access: accessRevocation, refresh: refreshRevocation },
          dataRetentionUntil: retentionUntil.toISOString(),
        },
      });

      return {
        platform: account.platform,
        platformUsername: account.platformUsername,
        revocation,
        revocationDetail: { access: accessRevocation, refresh: refreshRevocation },
        dataRetentionUntil: retentionUntil,
      };
    },

    /**
     * One account's management handle, or `undefined` when there is nothing to manage: not this
     * org's row (a cross-tenant id must not be distinguishable from a missing one), or a
     * disconnected one — FR-SOC-014's read-only archive is a retention-worker concern, and both
     * `getAccountDetail` and `disconnectAccount` already 404 on it.
     */
    async getManageableAccount(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string },
    ): Promise<
      | {
          id: string;
          platform: SocialPlatform;
          platformUsername: string;
          displayName: string | null;
          status: string;
          isActive: boolean;
          primaryManagerId: string | null;
          version: number;
        }
      | undefined
    > {
      const rows = (await db.execute(sql`
        SELECT id, platform, platform_username, display_name, status, is_active,
               primary_manager_id, version
        FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
          AND status <> 'disconnected'
        LIMIT 1
      `)) as any;
      const raw = rows.rows?.[0] as
        | {
            id: string;
            platform: string;
            platform_username: string;
            display_name: string | null;
            status: string;
            is_active: boolean;
            primary_manager_id: string | null;
            version: number;
          }
        | undefined;
      if (!raw) return undefined;
      return {
        id: raw.id,
        platform: raw.platform as SocialPlatform,
        platformUsername: raw.platform_username,
        displayName: raw.display_name,
        status: raw.status,
        isActive: raw.is_active,
        primaryManagerId: raw.primary_manager_id,
        version: raw.version,
      };
    },

    /**
     * Pause / resume data collection (FR-SOC-016, NWB-P2-007).
     *
     * Pausing flips `status` to `paused` and `is_active` to false — which is what actually stops
     * the machinery, since the refresh sweep selects `status = 'active' AND is_active = true` and
     * `assertDispatchAllowed` refuses an inactive row. The sealed tokens and the whole history
     * stay put: FR-SOC-016's promise is that resume needs **no re-authentication**, and a pause
     * that destroyed credentials would not be a pause.
     *
     * The state machine is deliberately narrow. Pause is refused on `paused` (already done), on
     * `needs_reauth` (it would overwrite the one state an operator must see — the tokens are
     * dead, and hiding that behind "paused" strands the account) and on `pending_verification`
     * (the grant is not complete). Resume is refused on anything but `paused`: FR-SOC-016's
     * "without re-authentication" is about pausing, not about healing a dead token, so a
     * `needs_reauth` account must go back through OAuth rather than be "resumed" into a lie.
     *
     * Both transitions write a `social_account_health_log` row (the account's status timeline is
     * what FR-SOC-042's diagnostics panel reads — an operator-initiated change absent from it
     * would make the timeline lie) and one audit row naming the actor.
     */
    async setAccountCollection(
      db: NodePgDatabase<Record<string, any>>,
      input: {
        organizationId: string;
        accountId: string;
        actorId: string;
        action: "pause" | "resume";
        reason?: string | undefined;
      },
    ): Promise<{
      id: string;
      platform: SocialPlatform;
      platformUsername: string;
      status: string;
      isActive: boolean;
      previousStatus: string;
      version: number;
    }> {
      const account = await this.getManageableAccount(db, input);
      if (!account) throw new NotFoundError("Social account not found");

      const previousStatus = account.status;
      if (input.action === "pause") {
        if (account.status === "paused") {
          throw new SocialAccountStateError("This account's collection is already paused");
        }
        if (account.status !== "active" && account.status !== "error") {
          throw new SocialAccountStateError(
            `Cannot pause an account whose status is '${account.status}' — it must be 'active' or 'error'`,
          );
        }
      } else if (account.status !== "paused") {
        throw new SocialAccountStateError(
          `Cannot resume an account whose status is '${account.status}' — only a paused account resumes without re-authentication`,
        );
      }

      const nextStatus = input.action === "pause" ? "paused" : "active";
      const nextActive = input.action === "resume";
      const updated = (await db.execute(sql`
        UPDATE social_accounts SET
          status = ${nextStatus},
          is_active = ${nextActive},
          version = version + 1,
          updated_at = now()
        WHERE id = ${account.id} AND version = ${account.version}
        RETURNING version
      `)) as any;
      if ((updated.rowCount ?? 0) === 0) {
        // Optimistic lock: a sweep or a probe moved the row under us. The operator's next click
        // re-reads and succeeds; inventing a retry here would hide a concurrent state change.
        throw new ConflictError("The account changed while this request was in flight — retry");
      }
      const version =
        (updated.rows?.[0] as { version: number } | undefined)?.version ?? account.version + 1;

      await this.writeHealthLog(
        db,
        { id: account.id, status: previousStatus },
        {
          status: nextStatus,
          diagnosticData: {
            trigger: "operator",
            actorId: input.actorId,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        },
      );

      const action: AuditActionName =
        input.action === "pause" ? "socialaccount.paused" : "socialaccount.resumed";
      await writeAuditLog({
        db,
        module: "social_accounts",
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: "user",
        action,
        resourceId: account.id,
        afterState: {
          platform: account.platform,
          username: account.platformUsername,
          previousStatus,
          status: nextStatus,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      });

      return {
        id: account.id,
        platform: account.platform,
        platformUsername: account.platformUsername,
        status: nextStatus,
        isActive: nextActive,
        previousStatus,
        version,
      };
    },

    /**
     * The on-demand health probe (NWB-P2-007) — the operator-facing half of P2-003's recovery
     * path. The sweep already re-probes breaker-open accounts every tick, but "is it fixed
     * *now*?" is a question a human asks while looking at a red row, and until this route existed
     * the only answer was to wait up to five minutes and reload.
     *
     * All the bookkeeping is `probeAccount`'s, unchanged: failure increments and opens the
     * breaker at the threshold, success clears the counters and closes an open breaker (with the
     * `socialaccount.breaker_recovered` audit row), a 429 advances nothing, a 401 gets one
     * on-demand refresh and one re-probe before `needs_reauth`. This method adds the guard (a
     * paused or disconnected account is not probeable — there is either no live token or no
     * collection to protect), the actor's id in the audit trail, and the fresh state in the
     * response so the UI does not need a second round trip.
     */
    async checkAccountHealth(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string; actorId: string },
    ): Promise<{
      id: string;
      platform: SocialPlatform;
      probe: "healthy" | "error" | "rate_limited" | "needs_reauth";
      status: string;
      isActive: boolean;
      circuitBreakerOpen: boolean;
      consecutiveErrorCount: number;
      lastErrorMessage: string | null;
      lastErrorCode: string | null;
      lastErrorAt: Date | null;
    }> {
      const account = await this.getManageableAccount(db, input);
      if (!account) throw new NotFoundError("Social account not found");
      if (account.status === "paused") {
        throw new SocialAccountStateError(
          "A paused account is not health-checked — resume it first",
        );
      }
      const probeAccount = await this.getProbeAccount(db, account.id);
      if (!probeAccount) throw new NotFoundError("Social account not found");

      const probe = await this.probeAccount(db, probeAccount);

      const rows = (await db.execute(sql`
        SELECT status, is_active, circuit_breaker_open, consecutive_error_count,
               last_error_message, last_error_code, last_error_at
        FROM social_accounts WHERE id = ${account.id}
      `)) as any;
      const raw = rows.rows?.[0] as
        | {
            status: string;
            is_active: boolean;
            circuit_breaker_open: boolean;
            consecutive_error_count: number;
            last_error_message: string | null;
            last_error_code: string | null;
            last_error_at: Date | string | null;
          }
        | undefined;
      return {
        id: account.id,
        platform: account.platform,
        probe,
        status: raw?.status ?? account.status,
        isActive: raw?.is_active ?? account.isActive,
        circuitBreakerOpen: raw?.circuit_breaker_open ?? false,
        consecutiveErrorCount: raw?.consecutive_error_count ?? 0,
        lastErrorMessage: raw?.last_error_message ?? null,
        lastErrorCode: raw?.last_error_code ?? null,
        lastErrorAt: toDate(raw?.last_error_at ?? null),
      };
    },

    /**
     * FR-SOC-011's impact analysis — what a disconnection would take down with it, returned by
     * `DELETE …?dryRun=true` **before** the confirmation modal asks anyone to type a username.
     *
     * The counts are `null`, not `0`, and each domain says which ticket makes it real. The
     * campaign, monitoring, publishing and engagement tables are aspirational `db/` modules that
     * `db/schema.ts` does not include and tsconfig excludes, so nothing can count their rows yet
     * — and a `0` in a modal that says "nothing is affected" is a false all-clear an Admin will
     * act on. `null` reads as "unknown, and here is why". When P3/P4/P7/P11 adopt their tables,
     * the query replaces `landsWith` and the contract in the response type stays.
     */
    async getDisconnectImpact(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string },
    ): Promise<{
      account: {
        id: string;
        platform: SocialPlatform;
        platformUsername: string;
        displayName: string | null;
        status: string;
      };
      domains: DisconnectImpactDomain[];
      /** FR-SOC-014's window, so the modal can say what "disconnect" preserves and for how long. */
      retentionDays: number;
      /** The confirmation string the real DELETE requires (FR-SOC-012) — echoed, never inferred. */
      confirmationUsername: string;
    }> {
      const account = await this.getManageableAccount(db, input);
      if (!account) throw new NotFoundError("Social account not found");
      return {
        account: {
          id: account.id,
          platform: account.platform,
          platformUsername: account.platformUsername,
          displayName: account.displayName,
          status: account.status,
        },
        domains: IMPACT_DOMAINS.map((domain) => ({ ...domain, count: null })),
        retentionDays: DISCONNECT_RETENTION_DAYS,
        confirmationUsername: account.platformUsername,
      };
    },

    /**
     * The dispatch gate — the reason the breaker exists (roadmap §13: "breaker must block
     * dispatch"). P3 publishing and P7 engagement call this before every send; a missing or
     * disconnected account is a NotFoundError (nothing to dispatch to), an open breaker or a
     * `needs_reauth` account is a 503 the caller treats as "skip, retry later".
     */
    async assertDispatchAllowed(
      db: NodePgDatabase<Record<string, any>>,
      input: { organizationId: string; accountId: string },
    ): Promise<void> {
      const rows = (await db.execute(sql`
        SELECT status, circuit_breaker_open, is_active FROM social_accounts
        WHERE id = ${input.accountId} AND organization_id = ${input.organizationId}
        LIMIT 1
      `)) as any;
      const row = rows.rows?.[0] as
        | { status: string; circuit_breaker_open: boolean; is_active: boolean }
        | undefined;
      if (!row || row.status === "disconnected") {
        throw new NotFoundError("Social account not found");
      }
      if (row.status === "paused" || !row.is_active) {
        // A paused account is an operator's deliberate "stop using this connection" (FR-SOC-016),
        // so it blocks dispatch too — and it is a 409, not the breaker's 503: nothing will fix
        // itself on a retry, a human has to resume it (NWB-P2-007).
        throw new SocialAccountStateError(
          `social account ${input.accountId} is paused — resume collection before dispatching to it`,
        );
      }
      if (row.circuit_breaker_open || row.status === "needs_reauth") {
        throw new CircuitBreakerOpenError(
          `social account ${input.accountId} is not dispatchable (${
            row.circuit_breaker_open ? "circuit breaker open" : "needs re-authentication"
          })`,
        );
      }
    },

    /**
     * The schema's cleanup contract: states are retained 24 h after expiry (or use) for
     * debugging, then reclaimed. Idempotent; scheduled in the maintenance worker (P2-002's
     * refresh job will join this cadence).
     */
    async purgeExpiredOAuthStates(
      db: NodePgDatabase<Record<string, any>>,
    ): Promise<{ deleted: number }> {
      const result = (await db.execute(sql`
        DELETE FROM oauth_states
        WHERE expires_at < now() - ${`${OAUTH_STATE_RETENTION_SECONDS} seconds`}::interval
          OR (used_at IS NOT NULL AND used_at < now() - ${`${OAUTH_STATE_RETENTION_SECONDS} seconds`}::interval)
      `)) as any;
      return { deleted: result.rowCount ?? 0 };
    },

    /**
     * Unseal a stored access token — the one door to the plaintext, for the API adapters
     * (P2-005). Never returns material into a response; callers pass it straight to a provider.
     */
    async unsealAccessToken(
      db: NodePgDatabase<Record<string, any>>,
      organizationId: string,
      accountId: string,
    ): Promise<string | undefined> {
      const rows = (await db.execute<{ access_token_encrypted: string | null; status: string }>(sql`
        SELECT access_token_encrypted, status FROM social_accounts
        WHERE id = ${accountId} AND organization_id = ${organizationId}
        LIMIT 1
      `)) as any;
      const row = rows.rows?.[0] as
        | { access_token_encrypted: string | null; status: string }
        | undefined;
      if (!row?.access_token_encrypted || row.status === "disconnected") return undefined;
      return decryptSecret(row.access_token_encrypted, keyMaterial);
    },
  };
}

export type SocialService = ReturnType<typeof createSocialService>;

let _service: SocialService | undefined;

/**
 * The request-time singleton, built from config on first use (the storage service's pattern —
 * no route-level seam; tests inject via `setSocialServiceForTest`).
 */
export function getSocialService(): SocialService {
  if (_service) return _service;
  // Late import chain avoids a cycle with config's own module graph at load time.
  const { getConfig } = require("../../lib/config") as typeof import("../../lib/config");
  const config = getConfig();
  _service = createSocialService({
    readEnv: (name) =>
      (config as unknown as Record<string, string | undefined>)[name] ?? process.env[name],
    keyMaterial: config.SOCIAL_TOKEN_ENCRYPTION_KEY ?? derivedKeyMaterial(config.JWT_ACCESS_SECRET),
    appBaseUrl: config.APP_BASE_URL_RESOLVED,
  });
  return _service;
}

export function setSocialServiceForTest(service: SocialService | undefined): void {
  _service = service;
}

/** The platforms this deployment can actually connect right now (for the settings UI). */
export function configuredPlatforms(
  readEnv: (name: string) => string | undefined,
): SocialPlatform[] {
  return SOCIAL_PLATFORMS.filter(
    (platform) => resolvePlatformCredentials(readEnv, platform) !== undefined,
  );
}
