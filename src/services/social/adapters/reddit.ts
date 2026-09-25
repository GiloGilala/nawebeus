/**
 * Reddit adapter — REST API (NWB-P2-005). The profile dialect is `oauth.reddit.com/api/v1/me`
 * (karma is the closest follower analogue, stored as the follower count); refresh is the
 * standard RFC 6749 grant with Basic auth (the generic client handles it); the probe **must**
 * carry a descriptive `User-Agent` — Reddit's API policy blocks generic agents, so a missing
 * UA would be a production-only 403/429 the tests would never see.
 */
import type { ConnectedProfile } from "../types";
import {
  type AdapterProbeRequest,
  baseProbeRequest,
  OAuthExchangeError,
  type PlatformAdapter,
} from "./shared";

const ME_URL = "https://oauth.reddit.com/api/v1/me";

/** Reddit's API policy: a descriptive UA (`<platform>:<app>:<version> (by /u/<user>)`). */
export const REDDIT_USER_AGENT = "nawebeus:social-integration:1.0 (social health checks)";

export const redditAdapter: PlatformAdapter = {
  platform: "reddit",

  async fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile> {
    const res = await fetchImpl(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": REDDIT_USER_AGENT },
    });
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      icon_img?: string;
      total_karma?: number;
    };
    if (!json.id || !json.name) {
      throw new OAuthExchangeError("reddit", null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: json.id,
      platformUsername: json.name,
      displayName: json.name,
      profileImageUrl: json.icon_img ?? null,
      // Reddit has no follower concept; total karma parses but is not stored (verbatim move).
      followerCount: null,
    };
  },

  probeRequest(accessToken: string): AdapterProbeRequest {
    const base = baseProbeRequest(ME_URL, accessToken);
    return {
      url: base.url,
      headers: { ...base.headers, "User-Agent": REDDIT_USER_AGENT },
    };
  },

  // No refreshTokens override — Reddit speaks the RFC grant (Basic auth, duration=permanent).

  revokeRequest({
    token,
    credentials,
  }: {
    token: string;
    credentials: { clientId: string; clientSecret: string };
  }) {
    // Reddit's revoke: Basic-auth POST with the token in the form body.
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      "base64",
    );
    return {
      url: "https://www.reddit.com/api/v1/revoke_token",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
          "User-Agent": REDDIT_USER_AGENT,
        },
        body: `token=${encodeURIComponent(token)}`,
      },
    };
  },
};
