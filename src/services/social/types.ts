/**
 * The DEC-009 platform registry — OAuth endpoints, scopes, and capability flags (Module 3,
 * PRD 8.3.2 "integration abstraction layer"). This is the OAuth half of the adapter
 * abstraction (NWB-P2-001); the full per-platform API clients arrive with NWB-P2-005's five
 * tickets and implement the same interface over these profiles.
 *
 * Every platform here is optional at runtime: a platform is "configured" only when its
 * `OAUTH_<PLATFORM>_CLIENT_ID/_SECRET` pair is present in config (see `resolvePlatformCredentials`).
 * Scopes are the minimum the roadmap's P2 exit gate needs (profile + basic publish where the
 * platform gates it) — adapters may request more per capability, but the connection flow only
 * guarantees these.
 */

/** The five platforms Nawebeus integrates, per DEC-009. Values are the shared `platform` enum's. */
export const SOCIAL_PLATFORMS = [
  "youtube",
  "twitter_x",
  "instagram",
  "facebook",
  "reddit",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const SOCIAL_PLATFORM_SET: ReadonlySet<string> = new Set(SOCIAL_PLATFORMS);

export function isSocialPlatform(value: string | undefined | null): value is SocialPlatform {
  return typeof value === "string" && SOCIAL_PLATFORM_SET.has(value);
}

export interface PlatformOAuthProfile {
  /** Human label for logs and error copy. */
  readonly label: string;
  /** The provider's authorization endpoint (browser redirect target). */
  readonly authorizeUrl: string;
  /** The provider's token endpoint (server-side code-for-token exchange). */
  readonly tokenUrl: string;
  /** Scopes requested on connect. Space-separated per RFC 6749 (joined per provider style). */
  readonly scopes: readonly string[];
  /** How the provider joins scopes on the authorize URL (`+`/`%20` both appear in the wild). */
  readonly scopeSeparator: string;
  /** PKCE (S256) capability — FR-SOC-001 asks for OAuth 2.0 with PKCE where the platform supports it. */
  readonly pkce: boolean;
  /**
   * How the client authenticates on the token exchange: `post` (credentials in the form body —
   * Google, Meta) or `basic` (HTTP Basic — Reddit, X).
   */
  readonly tokenAuth: "post" | "basic";
  /** Extra query parameters the provider requires on the authorize URL. */
  readonly extraAuthorizeParams: Readonly<Record<string, string>>;
  /** Fallback lifetime (seconds) when the token response omits `expires_in`. */
  readonly defaultExpiresInSeconds: number;
  /** The cheap authenticated GET a health probe calls (~1 quota unit; FR-SOC-039). */
  readonly probeUrl: string;
}

export const PLATFORM_OAUTH_PROFILES: Record<SocialPlatform, PlatformOAuthProfile> = {
  youtube: {
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    scopeSeparator: " ",
    pkce: true,
    tokenAuth: "post",
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    // Google access tokens live one hour.
    defaultExpiresInSeconds: 3_600,
    // channels.list with part=id and mine=true: 1 quota unit of the 10,000/day budget.
    probeUrl: "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
  },
  twitter_x: {
    label: "X (Twitter)",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "users.read", "tweet.write", "offline.access"],
    scopeSeparator: " ",
    pkce: true,
    tokenAuth: "basic",
    extraAuthorizeParams: {},
    // X OAuth2 user tokens live two hours; offline.access provides the refresh token.
    defaultExpiresInSeconds: 7_200,
    probeUrl: "https://api.twitter.com/2/users/me",
  },
  instagram: {
    label: "Instagram",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    scopeSeparator: ",",
    pkce: false,
    tokenAuth: "post",
    extraAuthorizeParams: {},
    // Meta short-lived tokens: one hour server-side; the long-lived exchange is P2-002's job.
    defaultExpiresInSeconds: 3_600,
    probeUrl: "https://graph.instagram.com/v21.0/me?fields=user_id",
  },
  facebook: {
    label: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    scopeSeparator: ",",
    pkce: false,
    tokenAuth: "post",
    extraAuthorizeParams: {},
    defaultExpiresInSeconds: 3_600,
    probeUrl: "https://graph.facebook.com/v21.0/me?fields=id",
  },
  reddit: {
    label: "Reddit",
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "read", "submit"],
    scopeSeparator: " ",
    pkce: true,
    tokenAuth: "basic",
    extraAuthorizeParams: { duration: "permanent" },
    // Reddit access tokens live one hour; duration=permanent provides the refresh token.
    defaultExpiresInSeconds: 3_600,
    probeUrl: "https://oauth.reddit.com/api/v1/me",
  },
};

export interface PlatformCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/** The env names a platform's pair lives in — also the config schema's field names. */
export function credentialEnvNames(platform: SocialPlatform): {
  id: string;
  secret: string;
} {
  const key = platform.toUpperCase();
  return { id: `OAUTH_${key}_CLIENT_ID`, secret: `OAUTH_${key}_CLIENT_SECRET` };
}

/** Minimal shape of the config the social service reads — keeps the service testable without loadConfig. */
export type PlatformCredentialReader = (name: string) => string | undefined;

export function resolvePlatformCredentials(
  read: PlatformCredentialReader,
  platform: SocialPlatform,
): PlatformCredentials | undefined {
  const names = credentialEnvNames(platform);
  const clientId = read(names.id)?.trim();
  const clientSecret = read(names.secret)?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

/**
 * Error classification (FR-SOC-053) — the one place that maps an HTTP status from a platform
 * onto the handling class. The health probe consumes it today; the P2-005 adapters reuse it so
 * "what a 401 means" never forks. `network` is a failed fetch (no response at all).
 */
export type PlatformErrorClass =
  | "auth"
  | "rate_limited"
  | "transient"
  | "client"
  | "not_found"
  | "network";

export function classifyPlatformHttpError(httpStatusCode: number | null): PlatformErrorClass {
  if (httpStatusCode === null) return "network";
  if (httpStatusCode === 401) return "auth";
  if (httpStatusCode === 429) return "rate_limited";
  if (httpStatusCode === 404) return "not_found";
  if (httpStatusCode >= 500) return "transient";
  return "client";
}

/**
 * Exponential backoff for transient failures (FR-SOC-054): 1s, 2s, 4s — capped at 3 attempts —
 * with up to ±25% jitter so a batch of failures does not re-strike in lockstep. Pure: the
 * caller supplies the randomness, which keeps the sequence testable.
 */
export function platformBackoffDelayMs(attempt: number, jitter: number): number {
  const clamped = Math.min(Math.max(attempt, 1), 3);
  const base = 1_000 * 2 ** (clamped - 1);
  const amplitude = base / 4;
  return Math.round(base + (jitter * 2 - 1) * amplitude);
}

/** The raw OAuth2 token endpoint response fields the exchange relies on. */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scope: string | null;
}

/** A refresh-grant response: the access token plus a refresh token only when rotated. */
export interface OAuthRefreshResult extends OAuthTokenResponse {
  /** True when the provider issued a replacement refresh token (rotation — X does, Meta often). */
  rotated: boolean;
}

/** What an exchange yields: the tokens plus the profile the connection row needs (FR-SOC-006). */
export interface OAuthExchangeResult extends OAuthTokenResponse {
  platformUserId: string;
  platformUsername: string;
  displayName: string | null;
  profileImageUrl: string | null;
  followerCount: number | null;
}

/**
 * The transport-facing half of the adapter abstraction: exchange an authorization code for a
 * token set + profile. Implementations own the provider's API dialects; the service owns the
 * state machine around them. `fetch` is injectable (the Resend-transport pattern) so CI never
 * talks to a platform.
 */
export interface PlatformOAuthClient {
  exchangeCode(args: {
    platform: SocialPlatform;
    code: string;
    redirectUri: string;
    credentials: PlatformCredentials;
    codeVerifier: string | undefined;
    fetchImpl?: typeof fetch | undefined;
  }): Promise<OAuthExchangeResult>;
  /**
   * The refresh grant (RFC 6749 §6) — the token-lifecycle half of the adapter abstraction
   * (NWB-P2-002). `refreshToken` is the *stored, still-sealed-on-our-side* refresh token in
   * plaintext at this boundary only. Returns the new access token and, when the provider
   * rotates, the replacement refresh token.
   */
  refreshTokens(args: {
    platform: SocialPlatform;
    refreshToken: string;
    credentials: PlatformCredentials;
    fetchImpl?: typeof fetch | undefined;
  }): Promise<OAuthRefreshResult>;
}

/** Metadata about the connected account used by the service (never includes tokens). */
export interface ConnectedProfile {
  platformUserId: string;
  platformUsername: string;
  displayName: string | null;
  profileImageUrl: string | null;
  followerCount: number | null;
}
