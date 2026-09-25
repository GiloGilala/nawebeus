/**
 * Social account services (NWB-P2-001) — the module's only import path (the email barrel rule):
 * route handlers and tests import from `services/social`, never from an inner file.
 */
export {
  HttpPlatformOAuthClient,
  OAuthExchangeError,
} from "./oauth-client";
export {
  callbackPathFor,
  configuredPlatforms,
  createSocialService,
  getSocialService,
  OAUTH_STATE_RETENTION_SECONDS,
  OAUTH_STATE_TTL_SECONDS,
  QUOTA_CRITICAL_PERCENT,
  QUOTA_WARNING_PERCENT,
  type QuotaBucketKind,
  type QuotaStatus,
  SOCIAL_ACCOUNT_ID_PATTERN,
  type SocialAccountRecord,
  type SocialService,
  setSocialServiceForTest,
} from "./service";
export {
  type ConnectedProfile,
  classifyPlatformHttpError,
  credentialEnvNames,
  isSocialPlatform,
  type OAuthExchangeResult,
  type OAuthRefreshResult,
  PLATFORM_OAUTH_PROFILES,
  type PlatformCredentials,
  type PlatformErrorClass,
  type PlatformOAuthClient,
  type PlatformOAuthProfile,
  platformBackoffDelayMs,
  resolvePlatformCredentials,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "./types";
