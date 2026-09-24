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
  SOCIAL_ACCOUNT_ID_PATTERN,
  type SocialAccountRecord,
  type SocialService,
  setSocialServiceForTest,
} from "./service";
export {
  type ConnectedProfile,
  credentialEnvNames,
  isSocialPlatform,
  type OAuthExchangeResult,
  PLATFORM_OAUTH_PROFILES,
  type PlatformCredentials,
  type PlatformOAuthClient,
  type PlatformOAuthProfile,
  resolvePlatformCredentials,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "./types";
