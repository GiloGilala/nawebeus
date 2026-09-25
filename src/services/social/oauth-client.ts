/**
 * The generic OAuth2 code-for-token client behind `PlatformOAuthClient` (NWB-P2-001).
 *
 * One implementation covers all five profiles because RFC 6749 is one protocol and the
 * per-platform variance is small and tabular (auth style `post` vs `basic`, scope separator,
 * profile endpoint). What genuinely differs — profile shapes — lives in `fetchProfile`'s
 * per-platform branches. `fetch` is injectable (the Resend-transport pattern): production uses
 * `globalThis.fetch`, tests record and fake, and CI never talks to a platform.
 *
 * Error discipline: a failed exchange or profile fetch becomes `OAuthExchangeError` carrying the
 * provider's error code — never the response body (the error payloads of token endpoints can
 * echo submitted values; BR-SOC-016 forbids echoing credential material into logs).
 */
import type {
  ConnectedProfile,
  OAuthExchangeResult,
  OAuthRefreshResult,
  PlatformCredentials,
  PlatformOAuthClient,
  PlatformOAuthProfile,
  SocialPlatform,
} from "./types";
import { PLATFORM_OAUTH_PROFILES } from "./types";

/** A token/profile exchange that the platform refused or that came back malformed. */
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

async function parseTokenResponse(
  platform: SocialPlatform,
  res: Response,
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scope: string | null;
}> {
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
    throw new OAuthExchangeError(
      platform,
      providerError,
      "token endpoint refused the exchange",
      res.status,
    );
  }
  const expiresInSeconds = typeof json.expires_in === "number" ? json.expires_in : null;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresInSeconds,
    scope: typeof json.scope === "string" ? json.scope : null,
  };
}

/** The per-platform profile dialects (FR-SOC-006: username, display name, avatar, followers). */
async function fetchProfile(
  platform: SocialPlatform,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<ConnectedProfile> {
  const auth = { Authorization: `Bearer ${accessToken}` };

  if (platform === "youtube") {
    const res = await fetchImpl(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: auth },
    );
    const json = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: {
          title?: string;
          customUrl?: string;
          thumbnails?: { default?: { url?: string } };
        };
        statistics?: { subscriberCount?: string };
      }[];
    };
    const item = json.items?.[0];
    if (!item?.id)
      throw new OAuthExchangeError(platform, null, "no channel is bound to this Google account");
    return {
      platformUserId: item.id,
      platformUsername: item.snippet?.customUrl ?? item.id,
      displayName: item.snippet?.title ?? null,
      profileImageUrl: item.snippet?.thumbnails?.default?.url ?? null,
      followerCount: item.statistics?.subscriberCount
        ? Number(item.statistics.subscriberCount)
        : null,
    };
  }

  if (platform === "twitter_x") {
    const res = await fetchImpl("https://api.twitter.com/2/users/me", { headers: auth });
    const json = (await res.json()) as {
      data?: { id?: string; username?: string; name?: string; profile_image_url?: string };
    };
    const user = json.data;
    if (!user?.id || !user.username) {
      throw new OAuthExchangeError(platform, null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: user.id,
      platformUsername: user.username,
      displayName: user.name ?? null,
      profileImageUrl: user.profile_image_url ?? null,
      followerCount: null,
    };
  }

  if (platform === "instagram") {
    const url = new URL("https://graph.instagram.com/v21.0/me");
    url.searchParams.set("fields", "user_id,username");
    url.searchParams.set("access_token", accessToken);
    const res = await fetchImpl(url, { headers: auth });
    const json = (await res.json()) as { user_id?: string; id?: string; username?: string };
    const userId = json.user_id ?? json.id;
    if (!userId || !json.username) {
      throw new OAuthExchangeError(platform, null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: userId,
      platformUsername: json.username,
      displayName: null,
      profileImageUrl: null,
      followerCount: null,
    };
  }

  if (platform === "facebook") {
    const url = new URL("https://graph.facebook.com/v21.0/me");
    url.searchParams.set("fields", "id,name");
    const res = await fetchImpl(url, { headers: auth });
    const json = (await res.json()) as { id?: string; name?: string };
    if (!json.id)
      throw new OAuthExchangeError(platform, null, "profile endpoint did not return a user");
    return {
      platformUserId: json.id,
      platformUsername: json.name ?? json.id,
      displayName: json.name ?? null,
      profileImageUrl: null,
      followerCount: null,
    };
  }

  // reddit
  const res = await fetchImpl("https://oauth.reddit.com/api/v1/me", {
    headers: { ...auth, "User-Agent": "nawebeus/oauth" },
  });
  const json = (await res.json()) as {
    id?: string;
    name?: string;
    icon_img?: string;
    total_karma?: number;
  };
  if (!json.id || !json.name) {
    throw new OAuthExchangeError(platform, null, "profile endpoint did not return a user");
  }
  return {
    platformUserId: json.id,
    platformUsername: json.name,
    displayName: json.name,
    profileImageUrl: json.icon_img ?? null,
    followerCount: null,
  };
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
    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new OAuthExchangeError(
        args.platform,
        null,
        `token endpoint returned non-JSON (HTTP ${res.status})`,
        res.status,
      );
    }
    if (!res.ok || typeof json.access_token !== "string" || json.access_token.length === 0) {
      const providerError = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
      throw new OAuthExchangeError(
        args.platform,
        providerError,
        "token endpoint refused the refresh",
        res.status,
      );
    }
    const nextRefresh = typeof json.refresh_token === "string" ? json.refresh_token : null;
    return {
      accessToken: json.access_token,
      refreshToken: nextRefresh,
      rotated: nextRefresh !== null,
      expiresInSeconds: typeof json.expires_in === "number" ? json.expires_in : null,
      scope: typeof json.scope === "string" ? json.scope : null,
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
    const tokens = await parseTokenResponse(args.platform, tokenRes);
    const connected = await fetchProfile(args.platform, tokens.accessToken, fetchImpl);
    return { ...tokens, ...connected };
  }
}
