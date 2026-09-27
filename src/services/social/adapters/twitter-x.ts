/**
 * X (Twitter) adapter — API v2 (NWB-P2-005). The profile dialect is `/2/users/me` (v2 wraps
 * the identity in `data`); refresh is the standard RFC 6749 grant with rotation (the generic
 * client handles it); the probe is a Bearer GET on `/2/users/me`; revocation is RFC 7009 on
 * `/2/oauth2/revoke` (NWB-P2-007).
 */
import type { ConnectedProfile } from "../types";
import {
  type AdapterProbeRequest,
  baseProbeRequest,
  OAuthExchangeError,
  type PlatformAdapter,
} from "./shared";

const ME_URL = "https://api.twitter.com/2/users/me";

export const twitterXAdapter: PlatformAdapter = {
  platform: "twitter_x",

  async fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile> {
    const res = await fetchImpl(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as {
      data?: { id?: string; username?: string; name?: string; profile_image_url?: string };
    };
    const user = json.data;
    if (!user?.id || !user.username) {
      throw new OAuthExchangeError("twitter_x", null, "profile endpoint did not return a user");
    }
    return {
      platformUserId: user.id,
      platformUsername: user.username,
      displayName: user.name ?? null,
      profileImageUrl: user.profile_image_url ?? null,
      followerCount: null,
    };
  },

  probeRequest(accessToken: string): AdapterProbeRequest {
    return baseProbeRequest(ME_URL, accessToken);
  },

  // No refreshTokens override — X's user-context refresh is the RFC grant (with rotation).

  revokeRequest({
    token,
    credentials,
    tokenType,
  }: {
    token: string;
    credentials: { clientId: string; clientSecret: string };
    tokenType?: "access_token" | "refresh_token";
  }) {
    // RFC 7009: Basic auth over the client pair, the token in a form body, and — unlike Google's
    // single-endpoint revoke — a `token_type_hint`, because X's endpoint revokes exactly the token
    // it is handed. The disconnect therefore calls it once per stored token (NWB-P2-007).
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      "base64",
    );
    const body = new URLSearchParams({ token });
    if (tokenType) body.set("token_type_hint", tokenType);
    return {
      url: "https://api.twitter.com/2/oauth2/revoke",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: body.toString(),
      },
    };
  },
};
