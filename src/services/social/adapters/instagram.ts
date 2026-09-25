/**
 * Instagram adapter — Instagram Graph API (NWB-P2-005). The profile dialect is
 * `graph.instagram.com/v21.0/me` (identity keyed by `user_id`, falling back to `id`); the
 * probe is a Bearer GET on `me?fields=user_id`; refresh is **not** the RFC grant — Instagram
 * exchanges the long-lived token via `ig_refresh_token`, returning a new access token and no
 * refresh token (the stored one is kept: `rotated: false`).
 */
import type { ConnectedProfile, OAuthRefreshResult, PlatformCredentials } from "../types";
import {
  type AdapterProbeRequest,
  baseProbeRequest,
  OAuthExchangeError,
  type PlatformAdapter,
  parseTokenResponse,
} from "./shared";

const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

export const instagramAdapter: PlatformAdapter = {
  platform: "instagram",

  async fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile> {
    const url = new URL("https://graph.instagram.com/v21.0/me");
    url.searchParams.set("fields", "user_id,username");
    url.searchParams.set("access_token", accessToken);
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as { user_id?: string; id?: string; username?: string };
    const userId = json.user_id ?? json.id;
    if (!userId || !json.username) {
      throw new OAuthExchangeError("instagram", null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: userId,
      platformUsername: json.username,
      displayName: null,
      profileImageUrl: null,
      followerCount: null,
    };
  },

  probeRequest(accessToken: string): AdapterProbeRequest {
    return baseProbeRequest("https://graph.instagram.com/v21.0/me?fields=user_id", accessToken);
  },

  /**
   * Instagram's native refresh: `grant_type=ig_refresh_token` on the token resource (GET per
   * the Graph API's documented shape; the access token rides the query string as Meta's docs
   * specify). The response has no `refresh_token` — Instagram never rotates, so the stored
   * token stays.
   */
  async refreshTokens(args: {
    refreshToken: string;
    credentials: PlatformCredentials;
    fetchImpl: typeof fetch;
  }): Promise<OAuthRefreshResult> {
    const url = new URL(REFRESH_URL);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", args.refreshToken);
    let res: Response;
    try {
      res = await args.fetchImpl(url, { method: "GET" });
    } catch (error) {
      throw new OAuthExchangeError(
        "instagram",
        null,
        `token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const parsed = await parseTokenResponse("instagram", res, "token endpoint refused the refresh");
    return { ...parsed, refreshToken: null, rotated: false };
  },
};
