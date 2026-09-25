/**
 * The adapter registry (NWB-P2-005): one `PlatformAdapter` per DEC-009 platform. Route
 * handlers, tests, and the OAuth client import from `services/social` (the barrel) — never
 * from an inner file.
 */
import type { SocialPlatform } from "../types";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { redditAdapter } from "./reddit";
import type { PlatformAdapter } from "./shared";
import { twitterXAdapter } from "./twitter-x";
import { youtubeAdapter } from "./youtube";

export const PLATFORM_ADAPTERS: Record<SocialPlatform, PlatformAdapter> = {
  youtube: youtubeAdapter,
  twitter_x: twitterXAdapter,
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  reddit: redditAdapter,
};

export { REDDIT_USER_AGENT } from "./reddit";
export {
  type AdapterProbeRequest,
  OAuthExchangeError,
  type ParsedTokenResponse,
  type PlatformAdapter,
  parseTokenResponse,
} from "./shared";
