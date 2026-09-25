/**
 * The platform-adapter abstraction (NWB-P2-005, PRD 8.3.2 "integration abstraction layer") and
 * the exchange machinery every adapter shares.
 *
 * One interface, five adapters: the profiles (`PLATFORM_OAUTH_PROFILES`) carry the tabular
 * OAuth facts, the adapters own what genuinely differs per provider — the profile-fetch
 * dialect (FR-SOC-006), the probe request's shape (FR-SOC-039), and, where the provider is
 * not RFC 6749, the refresh grant. `fetch` is injectable at every call (the Resend-transport
 * pattern): production uses `globalThis.fetch`, tests record and fake, and CI never talks to
 * a platform.
 */
import type {
  ConnectedProfile,
  OAuthRefreshResult,
  PlatformCredentials,
  SocialPlatform,
} from "../types";

/**
 * A token/profile exchange that the platform refused or that came back malformed. Carries the
 * provider's error code — never the response body (the error payloads of token endpoints can
 * echo submitted values; BR-SOC-016 forbids echoing credential material into logs).
 */
export class OAuthExchangeError extends Error {
  readonly platform: SocialPlatform;
  readonly providerError: string | null;
  /** The provider's HTTP status, when there was one — goes into the refresh log, not the logs. */
  readonly httpStatusCode: number | null;

  constructor(
    platform: SocialPlatform,
    providerError: string | null,
    detail: string,
    httpStatusCode: number | null = null,
  ) {
    super(`oauth exchange failed for ${platform}: ${detail}`);
    this.name = "OAuthExchangeError";
    this.platform = platform;
    this.providerError = providerError;
    this.httpStatusCode = httpStatusCode;
  }
}

/**
 * The token-endpoint response every provider returns in some shape: `access_token` plus
 * optional `refresh_token`/`expires_in`/`scope`. Shared by the generic client's exchange and
 * refresh, and by the adapters whose native grants return the same core fields.
 */
export interface ParsedTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scope: string | null;
}

export async function parseTokenResponse(
  platform: SocialPlatform,
  res: Response,
  detail: string,
): Promise<ParsedTokenResponse> {
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new OAuthExchangeError(
      platform,
      null,
      `token endpoint returned non-JSON (HTTP ${res.status})`,
    );
  }
  if (!res.ok || typeof json.access_token !== "string" || json.access_token.length === 0) {
    const providerError = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new OAuthExchangeError(platform, providerError, detail, res.status);
  }
  const expiresInSeconds = typeof json.expires_in === "number" ? json.expires_in : null;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresInSeconds,
    scope: typeof json.scope === "string" ? json.scope : null,
  };
}

/** The shaped probe request the health check sends (FR-SOC-039): the adapter owns the dialect. */
export interface AdapterProbeRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
}

/**
 * The per-platform adapter: profile fetch, probe shaping, and — only where the provider
 * deviates — the refresh grant. Everything else about a platform is tabular and lives in the
 * profile registry.
 */
export interface PlatformAdapter {
  readonly platform: SocialPlatform;
  /**
   * FR-SOC-006: the authenticated profile fetch on connect — the metadata the connection row
   * stores (username, display name, avatar, followers). Raises `OAuthExchangeError` when the
   * provider answers without a usable identity.
   */
  fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile>;
  /**
   * FR-SOC-039: the cheap authenticated GET a health probe sends. Defaults to the profile's
   * `probeUrl` with a Bearer header; adapters override to add provider-required headers
   * (Reddit's User-Agent policy) or restructure the request.
   */
  probeRequest(accessToken: string): AdapterProbeRequest;
  /**
   * The provider's refresh grant when it is *not* RFC 6749's `refresh_token` grant (the Meta
   * pair). Returning `rotated: false` with a `null` refresh token keeps the stored one — the
   * P2-002 sweep's contract. `undefined` → the generic grant applies.
   */
  refreshTokens?(args: {
    refreshToken: string;
    credentials: PlatformCredentials;
    fetchImpl: typeof fetch;
  }): Promise<OAuthRefreshResult>;
}

/** The default probe dialect: Bearer on the profile's `probeUrl`. */
export function baseProbeRequest(
  profileProbeUrl: string,
  accessToken: string,
): AdapterProbeRequest {
  return { url: profileProbeUrl, headers: { Authorization: `Bearer ${accessToken}` } };
}

/** Guard every adapter's profile mapping shares: a missing identity is an exchange failure. */
export function requireProfileField(
  platform: SocialPlatform,
  value: string | undefined,
  detail: string,
): string {
  if (!value) throw new OAuthExchangeError(platform, null, detail);
  return value;
}
