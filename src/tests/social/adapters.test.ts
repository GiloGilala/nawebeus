/**
 * Platform adapters (NWB-P2-005) — the per-provider dialects, directly tested.
 *
 * PRD 8.3.2's abstraction rule ("platform-specific code isolated behind a common interface")
 * is only real if each adapter's dialect is pinned: the profile-fetch mapping per platform,
 * the probe request's shape (Reddit's required User-Agent), the Meta pair's non-RFC refresh
 * grants, and the generic grant passthrough for the other three. Scripted fetches only — no
 * DB, no network (CI never talks to a platform).
 */
import { describe, expect, test } from "bun:test";
import {
  type AdapterProbeRequest,
  HttpPlatformOAuthClient,
  OAuthExchangeError,
  PLATFORM_ADAPTERS,
  REDDIT_USER_AGENT,
  type SocialPlatform,
} from "../../services/social";

const youtubeAdapter = PLATFORM_ADAPTERS.youtube;
const twitterXAdapter = PLATFORM_ADAPTERS.twitter_x;
const instagramAdapter = PLATFORM_ADAPTERS.instagram;
const facebookAdapter = PLATFORM_ADAPTERS.facebook;
const redditAdapter = PLATFORM_ADAPTERS.reddit;

/** A fetch fake scripting sequential responses: {json} or {status, json} or {throws}. */
function scriptedFetch(script: { status?: number; json?: unknown; throws?: string }[]) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const step = script[calls.length];
    if (!step) throw new Error(`unexpected call #${calls.length + 1}`);
    calls.push({ url: String(input), init });
    if (step.throws) throw new Error(step.throws);
    return new Response(JSON.stringify(step.json ?? {}), {
      status: step.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

const ALL_PLATFORMS: SocialPlatform[] = ["youtube", "twitter_x", "instagram", "facebook", "reddit"];

const credentials = { clientId: "cid", clientSecret: "sec" };

describe("platform adapters — the registry", () => {
  test("covers all five DEC-009 platforms and agrees with the profile registry", () => {
    expect(Object.keys(PLATFORM_ADAPTERS).sort()).toEqual([...ALL_PLATFORMS].sort());
    for (const platform of ALL_PLATFORMS) {
      expect(PLATFORM_ADAPTERS[platform].platform).toBe(platform);
      // Every adapter answers the probe-shaping contract (FR-SOC-039).
      const req = PLATFORM_ADAPTERS[platform].probeRequest("tok");
      expect(req.url.length).toBeGreaterThan(0);
      expect(req.headers.Authorization).toBe("Bearer tok");
    }
  });

  test("only the Meta pair overrides the refresh grant; the other three take the RFC grant", () => {
    expect(PLATFORM_ADAPTERS.instagram.refreshTokens).toBeFunction();
    expect(PLATFORM_ADAPTERS.facebook.refreshTokens).toBeFunction();
    expect(PLATFORM_ADAPTERS.youtube.refreshTokens).toBeUndefined();
    expect(PLATFORM_ADAPTERS.twitter_x.refreshTokens).toBeUndefined();
    expect(PLATFORM_ADAPTERS.reddit.refreshTokens).toBeUndefined();
  });
});

describe("platform adapters — probe request dialects", () => {
  test("four platforms are Bearer-on-probeUrl; reddit adds its required User-Agent", () => {
    const expectations: Record<SocialPlatform, string> = {
      youtube: "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      twitter_x: "https://api.twitter.com/2/users/me",
      instagram: "https://graph.instagram.com/v21.0/me?fields=user_id",
      facebook: "https://graph.facebook.com/v21.0/me?fields=id",
      reddit: "https://oauth.reddit.com/api/v1/me",
    };
    for (const platform of ALL_PLATFORMS) {
      const req: AdapterProbeRequest = PLATFORM_ADAPTERS[platform].probeRequest("tok-1");
      expect(req.url).toBe(expectations[platform]);
      expect(req.headers.Authorization).toBe("Bearer tok-1");
    }
    // Reddit's API policy blocks generic agents — the UA is the dialect's whole point.
    expect(redditAdapter.probeRequest("t").headers["User-Agent"]).toBe(REDDIT_USER_AGENT);
    expect(youtubeAdapter.probeRequest("t").headers["User-Agent"]).toBeUndefined();
  });
});

describe("platform adapters — revocation dialects (NWB-P2-006)", () => {
  test("youtube revokes at Google's endpoint: form-encoded POST, no auth header", () => {
    const req = youtubeAdapter.revokeRequest!({ token: "tok to revoke", credentials });
    expect(req.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(req.init.method).toBe("POST");
    expect((req.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect((req.init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    expect(req.init.body).toBe(`token=${encodeURIComponent("tok to revoke")}`);
  });

  test("reddit revokes with Basic auth over its app credentials and its User-Agent", () => {
    const req = redditAdapter.revokeRequest!({ token: "rtok", credentials });
    expect(req.url).toBe("https://www.reddit.com/api/v1/revoke_token");
    expect(req.init.method).toBe("POST");
    const headers = req.init.headers as Record<string, string>;
    const basic = Buffer.from("cid:sec").toString("base64");
    expect(headers.Authorization).toBe(`Basic ${basic}`);
    expect(headers["User-Agent"]).toBe(REDDIT_USER_AGENT);
    expect(req.init.body).toBe("token=rtok");
  });

  test("X revokes per RFC 7009: Basic auth, form body, and the hint that says which token it is", () => {
    const basic = Buffer.from("cid:sec").toString("base64");
    const access = twitterXAdapter.revokeRequest!({
      token: "x-access",
      credentials,
      tokenType: "access_token",
    });
    expect(access.url).toBe("https://api.twitter.com/2/oauth2/revoke");
    expect(access.init.method).toBe("POST");
    const headers = access.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${basic}`);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(access.init.body).toBe("token=x-access&token_type_hint=access_token");
    // The disconnect calls the hook once per stored token, so the hint has to follow the token —
    // X's endpoint revokes exactly what it is handed (NWB-P2-007).
    const refresh = twitterXAdapter.revokeRequest!({
      token: "x-refresh",
      credentials,
      tokenType: "refresh_token",
    });
    expect(refresh.init.body).toBe("token=x-refresh&token_type_hint=refresh_token");
  });

  test("the Meta pair has no revoke hook — revocation is not_supported there, and the caller decides", () => {
    expect(instagramAdapter.revokeRequest).toBeUndefined();
    expect(facebookAdapter.revokeRequest).toBeUndefined();
  });

  test("three of five platforms publish a revocation dialect; the Meta pair do not", () => {
    const withRevoke = ALL_PLATFORMS.filter(
      (platform) => PLATFORM_ADAPTERS[platform].revokeRequest,
    );
    expect([...withRevoke].sort()).toEqual(["reddit", "twitter_x", "youtube"]);
  });
});

describe("platform adapters — profile fetch dialects (FR-SOC-006)", () => {
  test("youtube maps channels.list: customUrl, title, avatar, subscriber count as number", async () => {
    const { impl, calls } = scriptedFetch([
      {
        json: {
          items: [
            {
              id: "UC_xyz",
              snippet: {
                title: "My Channel",
                customUrl: "@mychannel",
                thumbnails: { default: { url: "https://img/avatar.png" } },
              },
              statistics: { subscriberCount: "1234" },
            },
          ],
        },
      },
    ]);
    const profile = await youtubeAdapter.fetchProfile("tok", impl);
    expect(calls[0]!.url).toBe(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    );
    expect(calls[0]!.init?.headers).toEqual({ Authorization: "Bearer tok" });
    expect(profile).toEqual({
      platformUserId: "UC_xyz",
      platformUsername: "@mychannel",
      displayName: "My Channel",
      profileImageUrl: "https://img/avatar.png",
      followerCount: 1234,
    });
  });

  test("youtube refuses a Google account with no bound channel", async () => {
    const { impl } = scriptedFetch([{ json: { items: [] } }]);
    expect(youtubeAdapter.fetchProfile("tok", impl)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  test("twitter_x maps /2/users/me's wrapped identity; missing user refuses", async () => {
    const { impl, calls } = scriptedFetch([
      {
        json: {
          data: { id: "9", username: "ada", name: "Ada", profile_image_url: "https://x/a.png" },
        },
      },
    ]);
    const profile = await twitterXAdapter.fetchProfile("tok", impl);
    expect(calls[0]!.url).toBe("https://api.twitter.com/2/users/me");
    expect(profile.platformUserId).toBe("9");
    expect(profile.platformUsername).toBe("ada");
    expect(profile.displayName).toBe("Ada");
    expect(profile.followerCount).toBeNull();

    const missing = scriptedFetch([{ json: {} }]);
    expect(twitterXAdapter.fetchProfile("tok", missing.impl)).rejects.toBeInstanceOf(
      OAuthExchangeError,
    );
  });

  test("instagram keys identity by user_id (id fallback) and username", async () => {
    const { impl, calls } = scriptedFetch([{ json: { user_id: "17841400000", username: "biz" } }]);
    const profile = await instagramAdapter.fetchProfile("tok", impl);
    expect(calls[0]!.url).toBe(
      "https://graph.instagram.com/v21.0/me?fields=user_id%2Cusername&access_token=tok",
    );
    expect(profile.platformUserId).toBe("17841400000");
    expect(profile.platformUsername).toBe("biz");
  });

  test("facebook maps id/name; reddit maps id/name/icon (no follower concept)", async () => {
    const fb = scriptedFetch([{ json: { id: "1024", name: "Page Co" } }]);
    const fbProfile = await facebookAdapter.fetchProfile("tok", fb.impl);
    expect(fb.calls[0]!.url).toBe("https://graph.facebook.com/v21.0/me?fields=id%2Cname");
    expect(fbProfile).toEqual({
      platformUserId: "1024",
      platformUsername: "Page Co",
      displayName: "Page Co",
      profileImageUrl: null,
      followerCount: null,
    });

    const rd = scriptedFetch([
      { json: { id: "abc", name: "spez", icon_img: "https://r/i.png", total_karma: 50 } },
    ]);
    const rdProfile = await redditAdapter.fetchProfile("tok", rd.impl);
    expect(rd.calls[0]!.init?.headers).toEqual({
      Authorization: "Bearer tok",
      "User-Agent": REDDIT_USER_AGENT,
    });
    expect(rdProfile.platformUsername).toBe("spez");
    expect(rdProfile.profileImageUrl).toBe("https://r/i.png");
    expect(rdProfile.followerCount).toBeNull();
  });
});

describe("platform adapters — refresh dialects", () => {
  test("instagram refreshes via ig_refresh_token; no rotation — the stored token is kept", async () => {
    const { impl, calls } = scriptedFetch([
      { json: { access_token: "new-ig-token", token_type: "bearer", expires_in: 5_184_000 } },
    ]);
    const result = await instagramAdapter.refreshTokens!({
      refreshToken: "stored-token",
      credentials,
      fetchImpl: impl,
    });
    expect(calls[0]!.url).toBe(
      "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=stored-token",
    );
    expect(result).toEqual({
      accessToken: "new-ig-token",
      refreshToken: null,
      rotated: false,
      expiresInSeconds: 5_184_000,
      scope: null,
    });
  });

  test("facebook refreshes via fb_exchange_token as a POST form; the secret never hits the URL", async () => {
    const { impl, calls } = scriptedFetch([
      { json: { access_token: "long-lived-fb", token_type: "bearer", expires_in: 5_184_000 } },
    ]);
    const result = await facebookAdapter.refreshTokens!({
      refreshToken: "stored-token",
      credentials,
      fetchImpl: impl,
    });
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
    expect(calls[0]!.init?.method).toBe("POST");
    const body = String(calls[0]!.init?.body);
    expect(body).toContain("grant_type=fb_exchange_token");
    expect(body).toContain("client_id=cid");
    expect(body).toContain("client_secret=sec");
    expect(body).toContain("fb_exchange_token=stored-token");
    expect(result.accessToken).toBe("long-lived-fb");
    expect(result.refreshToken).toBeNull();
    expect(result.rotated).toBe(false);
  });

  test("a refused Meta refresh carries the provider's error code, not the body", async () => {
    const { impl } = scriptedFetch([
      { status: 400, json: { error: { message: "secret", code: 101 } } },
    ]);
    try {
      await instagramAdapter.refreshTokens!({
        refreshToken: "t",
        credentials,
        fetchImpl: impl,
      });
      expect.unreachable();
    } catch (error) {
      const e = error as OAuthExchangeError;
      expect(e).toBeInstanceOf(OAuthExchangeError);
      expect(e.providerError).toBe("HTTP 400");
      expect(String(e.message)).not.toContain("secret");
    }
  });

  test("the generic grant covers youtube (post auth) and reddit/x style (basic auth)", async () => {
    const client = new HttpPlatformOAuthClient();

    const yt = scriptedFetch([{ json: { access_token: "yt-new", expires_in: 3600 } }]);
    const ytResult = await client.refreshTokens({
      platform: "youtube",
      refreshToken: "yt-refresh",
      credentials,
      fetchImpl: yt.impl,
    });
    expect(yt.calls[0]!.url).toBe("https://oauth2.googleapis.com/token");
    const ytBody = String(yt.calls[0]!.init?.body);
    expect(ytBody).toContain("grant_type=refresh_token");
    expect(ytBody).toContain("refresh_token=yt-refresh");
    expect(ytBody).toContain("client_id=cid"); // post auth: creds ride the form
    const ytHeaders = (yt.calls[0]!.init?.headers ?? {}) as Record<string, string>;
    expect(ytHeaders.Authorization).toBeUndefined();
    expect(ytResult.accessToken).toBe("yt-new");
    expect(ytResult.rotated).toBe(false); // Google keeps the refresh token silent

    const rd = scriptedFetch([
      { json: { access_token: "rd-new", refresh_token: "rd-rotated", expires_in: 3600 } },
    ]);
    const rdResult = await client.refreshTokens({
      platform: "reddit",
      refreshToken: "rd-refresh",
      credentials,
      fetchImpl: rd.impl,
    });
    const rdHeaders = (rd.calls[0]!.init?.headers ?? {}) as Record<string, string>;
    const basic = rdHeaders.Authorization;
    expect(basic).toBe(`Basic ${Buffer.from("cid:sec").toString("base64")}`);
    expect(rdResult.rotated).toBe(true);
    expect(rdResult.refreshToken).toBe("rd-rotated");
  });

  test("an unreachable token endpoint is an OAuthExchangeError with network detail", async () => {
    const { impl } = scriptedFetch([{ throws: "socket hang up" }]);
    try {
      await instagramAdapter.refreshTokens!({ refreshToken: "t", credentials, fetchImpl: impl });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(OAuthExchangeError);
      expect((error as OAuthExchangeError).message).toContain("unreachable");
    }
  });
});

describe("platform adapters — exchangeCode integrates the adapter profile fetch", () => {
  test("token endpoint then channels endpoint; the connection row's profile is the merge", async () => {
    const client = new HttpPlatformOAuthClient();
    const { impl, calls } = scriptedFetch([
      { json: { access_token: "tok", refresh_token: "ref", expires_in: 3600 } },
      {
        json: {
          items: [{ id: "UC_1", snippet: { title: "Ch", customUrl: "@ch" } }],
        },
      },
    ]);
    const result = await client.exchangeCode({
      platform: "youtube",
      code: "auth-code",
      redirectUri: "https://app.example.com/api/social/callback",
      credentials,
      codeVerifier: undefined,
      fetchImpl: impl,
    });
    expect(calls.length).toBe(2);
    expect(calls[0]!.url).toBe("https://oauth2.googleapis.com/token");
    expect(result.platformUserId).toBe("UC_1");
    expect(result.platformUsername).toBe("@ch");
    expect(result.refreshToken).toBe("ref");
  });
});
