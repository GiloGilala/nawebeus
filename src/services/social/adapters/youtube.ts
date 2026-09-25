/**
 * YouTube adapter — Google Data API v3 (NWB-P2-005). The profile dialect is `channels.list`
 * with `mine=true` (the connect flow stores the bound channel, not the Google account);
 * refresh is the standard RFC 6749 grant (the generic client handles it); the probe is a
 * Bearer GET on `channels?part=id&mine=true` — one quota unit of the 10,000/day budget.
 */
import type { ConnectedProfile } from "../types";
import {
  type AdapterProbeRequest,
  baseProbeRequest,
  OAuthExchangeError,
  type PlatformAdapter,
} from "./shared";

const CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true";

export const youtubeAdapter: PlatformAdapter = {
  platform: "youtube",

  async fetchProfile(accessToken: string, fetchImpl: typeof fetch): Promise<ConnectedProfile> {
    const res = await fetchImpl(CHANNELS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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
    // A Google account without a channel is a valid provider answer but an unusable connection.
    if (!item?.id) {
      throw new OAuthExchangeError("youtube", null, "no channel is bound to this Google account");
    }
    return {
      platformUserId: item.id,
      platformUsername: item.snippet?.customUrl ?? item.id,
      displayName: item.snippet?.title ?? null,
      profileImageUrl: item.snippet?.thumbnails?.default?.url ?? null,
      followerCount: item.statistics?.subscriberCount
        ? Number(item.statistics.subscriberCount)
        : null,
    };
  },

  probeRequest(accessToken: string): AdapterProbeRequest {
    return baseProbeRequest(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      accessToken,
    );
  },

  // No refreshTokens override — Google speaks RFC 6749.

  revokeRequest({ token }: { token: string }) {
    // Google's revoke: form-encoded POST, no auth header (the token is the credential).
    return {
      url: "https://oauth2.googleapis.com/revoke",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `token=${encodeURIComponent(token)}`,
      },
    };
  },
};
