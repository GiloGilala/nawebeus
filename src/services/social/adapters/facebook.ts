/**
 * Facebook adapter — Graph API (NWB-P2-005). The profile dialect is
 * `graph.facebook.com/v21.0/me` (pages context comes with the granted scopes); the probe is a
 * Bearer GET on `me?fields=id`; refresh is **not** the RFC grant — Facebook exchanges the
 * token via `fb_exchange_token` for a long-lived one, returning no refresh token (the stored
 * one is kept: `rotated: false`).
 */
import type { ConnectedProfile, OAuthRefreshResult, PlatformCredentials } from "../types";
import {
  type AdapterProbeRequest,
  baseProbeRequest,
  OAuthExchangeError,
  type PlatformAdapter,
  parseTokenResponse,
} from "./shared";

const REFRESH_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

export const facebookAdapter: PlatformAdapter = {
  platform: "facebook",

  async fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile> {
    const url = new URL("https://graph.facebook.com/v21.0/me");
    url.searchParams.set("fields", "id,name");
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as { id?: string; name?: string };
    if (!json.id) {
      throw new OAuthExchangeError("facebook", null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: json.id,
      platformUsername: json.name ?? json.id,
      displayName: json.name ?? null,
      profileImageUrl: null,
      followerCount: null,
    };
  },

  probeRequest(accessToken: string): AdapterProbeRequest {
    return baseProbeRequest("https://graph.facebook.com/v21.0/me?fields=id", accessToken);
  },

  /**
   * Facebook's native refresh: `grant_type=fb_exchange_token` with the app credentials and
   * the current token. Sent as a **POST form** — Meta documents GET, but POST is accepted and
   * keeps `client_secret` out of the URL (BR-SOC-016 hygiene: URLs land in logs). The
   * response has no `refresh_token` — Facebook never rotates, so the stored token stays.
   */
  async refreshTokens(args: {
    refreshToken: string;
    credentials: PlatformCredentials;
    fetchImpl: typeof fetch;
  }): Promise<OAuthRefreshResult> {
    let res: Response;
    try {
      res = await args.fetchImpl(REFRESH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: args.credentials.clientId,
          client_secret: args.credentials.clientSecret,
          fb_exchange_token: args.refreshToken,
        }),
      });
    } catch (error) {
      throw new OAuthExchangeError(
        "facebook",
        null,
        `token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const parsed = await parseTokenResponse("facebook", res, "token endpoint refused the refresh");
    return { ...parsed, refreshToken: null, rotated: false };
  },
};
