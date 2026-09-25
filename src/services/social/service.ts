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
import { AccountAlreadyConnectedError, ValidationError } from "../../lib/errors";
import { writeAuditLog } from "../audit";
import { HttpPlatformOAuthClient, OAuthExchangeError } from "./oauth-client";
import {
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
    tokenExpiresAt: raw.token_expires_at,
    connectedBy: raw.connected_by,
    connectedAt: raw.connected_at,
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
  readonly newId?: (() => string) | undefined;
  readonly now?: (() => Date) | undefined;
}

export function createSocialService(options: SocialServiceOptions) {
  const { readEnv, keyMaterial, appBaseUrl } = options;
  const oauthClient = options.oauthClient ?? new HttpPlatformOAuthClient();
  const now = options.now ?? (() => new Date());

  function redirectUriFor(platform: SocialPlatform): string {
    return `${appBaseUrl.replace(/\/$/, "")}${callbackPathFor(platform)}`;
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
            connected_by = ${stateRow.user_id},
            connected_at = now(),
            disconnected_at = NULL,
            disconnected_by = NULL,
            disconnection_reason = NULL,
            consecutive_error_count = 0,
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
     * FR-SOC-022's surfacing; the message dispatch to manager/admins lands with P2-006.
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
      input: { reason: string; code: string | null; trigger: string; retryCount: number },
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
      return true;
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
