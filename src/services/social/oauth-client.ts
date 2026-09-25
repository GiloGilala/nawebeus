/**
 * The generic OAuth2 code-for-token client behind `PlatformOAuthClient` (NWB-P2-001, now
 * delegating its dialects per NWB-P2-005).
 *
 * One implementation covers all five profiles because RFC 6749 is one protocol and the
 * per-platform variance is tabular (auth style `post` vs `basic`, scope separator). What
 * genuinely differs — profile shapes and non-RFC refresh grants — lives in the platform
 * adapters (`./adapters`, PRD 8.3.2: platform-specific code behind a common interface), and
 * this client carries zero per-platform branches. `fetch` is injectable (the
 * Resend-transport pattern): production uses `globalThis.fetch`, tests record and fake, and
 * CI never talks to a platform.
 *
 * Error discipline: a failed exchange or profile fetch becomes `OAuthExchangeError` carrying
 * the provider's error code — never the response body (the error payloads of token endpoints
 * can echo submitted values; BR-SOC-016 forbids echoing credential material into logs).
 */
import { OAuthExchangeError, PLATFORM_ADAPTERS, parseTokenResponse } from "./adapters";
import type {
  OAuthExchangeResult,
  OAuthRefreshResult,
  PlatformCredentials,
  PlatformOAuthClient,
  PlatformOAuthProfile,
  SocialPlatform,
} from "./types";
import { PLATFORM_OAUTH_PROFILES } from "./types";

// The canonical error lives with the adapters; re-exported so the import surface is unchanged.
export { OAuthExchangeError } from "./adapters";

function formAuthHeaders(
  profile: PlatformOAuthProfile,
  credentials: PlatformCredentials,
): HeadersInit {
  if (profile.tokenAuth === "basic") {
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      "base64",
    );
    return { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` };
  }
  return { "Content-Type": "application/x-www-form-urlencoded" };
}

function tokenBody(
  profile: PlatformOAuthProfile,
  args: {
    code: string;
    redirectUri: string;
    credentials: PlatformCredentials;
    codeVerifier: string | undefined;
  },
): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
  });
  if (profile.tokenAuth === "post") {
    body.set("client_id", args.credentials.clientId);
    body.set("client_secret", args.credentials.clientSecret);
  }
  if (args.codeVerifier) body.set("code_verifier", args.codeVerifier);
  return body;
}

export class HttpPlatformOAuthClient implements PlatformOAuthClient {
  /** The refresh grant: same endpoint and auth style as the exchange, `grant_type=refresh_token`. */
  async refreshTokens(args: {
    platform: SocialPlatform;
    refreshToken: string;
    credentials: PlatformCredentials;
    fetchImpl?: typeof fetch | undefined;
  }): Promise<OAuthRefreshResult> {
    const profile = PLATFORM_OAUTH_PROFILES[args.platform];
    const fetchImpl = args.fetchImpl ?? globalThis.fetch;
    // Meta's pair refreshes through their native grants (fb_exchange_token / ig_refresh_token)
    // and never rotates; only platforms without an override take the RFC grant below.
    const override = PLATFORM_ADAPTERS[args.platform].refreshTokens;
    if (override) {
      return override({
        refreshToken: args.refreshToken,
        credentials: args.credentials,
        fetchImpl,
      });
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: args.refreshToken,
    });
    if (profile.tokenAuth === "post") {
      body.set("client_id", args.credentials.clientId);
      body.set("client_secret", args.credentials.clientSecret);
    }
    let res: Response;
    try {
      res = await fetchImpl(profile.tokenUrl, {
        method: "POST",
        headers: formAuthHeaders(profile, args.credentials),
        body,
      });
    } catch (error) {
      throw new OAuthExchangeError(
        args.platform,
        null,
        `token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const parsed = await parseTokenResponse(
      args.platform,
      res,
      "token endpoint refused the refresh",
    );
    const nextRefresh = parsed.refreshToken;
    return {
      accessToken: parsed.accessToken,
      refreshToken: nextRefresh,
      rotated: nextRefresh !== null,
      expiresInSeconds: parsed.expiresInSeconds,
      scope: parsed.scope,
    };
  }

  async exchangeCode(args: {
    platform: SocialPlatform;
    code: string;
    redirectUri: string;
    credentials: PlatformCredentials;
    codeVerifier: string | undefined;
    fetchImpl?: typeof fetch | undefined;
  }): Promise<OAuthExchangeResult> {
    const profile = PLATFORM_OAUTH_PROFILES[args.platform];
    const fetchImpl = args.fetchImpl ?? globalThis.fetch;

    let tokenRes: Response;
    try {
      tokenRes = await fetchImpl(profile.tokenUrl, {
        method: "POST",
        headers: formAuthHeaders(profile, args.credentials),
        body: tokenBody(profile, {
          code: args.code,
          redirectUri: args.redirectUri,
          credentials: args.credentials,
          codeVerifier: args.codeVerifier,
        }),
      });
    } catch (error) {
      throw new OAuthExchangeError(
        args.platform,
        null,
        `token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const tokens = await parseTokenResponse(
      args.platform,
      tokenRes,
      "token endpoint refused the exchange",
    );
    const connected = await PLATFORM_ADAPTERS[args.platform].fetchProfile(
      tokens.accessToken,
      fetchImpl,
    );
    return { ...tokens, ...connected };
  }
}
