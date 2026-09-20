import { describe, expect, test } from "bun:test";
import {
  DEFAULT_TRUSTED_PROXY_CIDRS,
  getClientIp,
  isCidrList,
  normaliseIp,
  type ParsedCidr,
  parseCidr,
  parseCidrList,
} from "../lib/ip";

describe("normaliseIp (hop pipeline shapes)", () => {
  test("plain IPv4 passes through", () => {
    expect(normaliseIp("203.0.113.7")).toBe("203.0.113.7");
  });

  test("IPv4 with port is stripped to the address", () => {
    expect(normaliseIp("203.0.113.7:443")).toBe("203.0.113.7");
  });

  test("first entry of a chain wins (single-value use)", () => {
    expect(normaliseIp("203.0.113.7, 70.41.3.18")).toBe("203.0.113.7");
  });

  test("bracketed IPv6 with port unwraps", () => {
    expect(normaliseIp("[::1]:8080")).toBe("::1");
  });

  test("garbage degrades to null, never throws", () => {
    expect(normaliseIp("unknown")).toBeNull();
    expect(normaliseIp("not an ip")).toBeNull();
    expect(normaliseIp("")).toBeNull();
    expect(normaliseIp(null)).toBeNull();
    expect(normaliseIp(undefined)).toBeNull();
  });

  test("CIDR suffixes are rejected (never a client address)", () => {
    expect(normaliseIp("10.0.0.0/8")).toBeNull();
    expect(normaliseIp("::1/128")).toBeNull();
  });
});

describe("parseCidr / parseCidrList", () => {
  test("parses IPv4 CIDRs with host bits masked off", () => {
    expect(parseCidr("10.1.2.3/8")).toEqual({ family: 4, network: 0x0a000000, bits: 8 });
    expect(parseCidr("192.168.1.0/24")).toEqual({ family: 4, network: 0xc0a80100, bits: 24 });
  });

  test("parses IPv6 CIDRs", () => {
    expect(parseCidr("::1/128")).toEqual({ family: 6, network: 1n, bits: 128 });
    const doc = parseCidr("2001:db8::/32");
    expect(doc.family).toBe(6);
    expect(doc.bits).toBe(32);
    expect(doc.network).toBe(0x20010db8000000000000000000000000n);
  });

  test("bare IPs become host routes", () => {
    expect(parseCidr("203.0.113.7")).toEqual({ family: 4, network: 0xcb007107, bits: 32 });
    expect(parseCidr("::1")).toEqual({ family: 6, network: 1n, bits: 128 });
  });

  test("invalid entries throw with the entry quoted", () => {
    for (const bad of ["not-an-ip", "10.0.0.0/33", "1.2.3.4/abc", "10.0.0.0/8/8", ":::"]) {
      expect(() => parseCidr(bad)).toThrow(/Invalid TRUSTED_PROXY_CIDRS entry/);
    }
  });

  test("parseCidrList splits, trims, and drops empties", () => {
    const list = parseCidrList(" 10.0.0.0/8 ,, 192.168.0.0/16 ");
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ family: 4, network: 0x0a000000, bits: 8 });
  });

  test("empty list means trust-no-proxies, and isCidrList mirrors validity", () => {
    expect(parseCidrList("")).toEqual([]);
    expect(parseCidrList("   ")).toEqual([]);
    expect(isCidrList(DEFAULT_TRUSTED_PROXY_CIDRS)).toBe(true);
    expect(isCidrList("10.0.0.0/8, garbage")).toBe(false);
    expect(isCidrList("")).toBe(true);
  });

  test("default list covers RFC1918 + loopback", () => {
    const list = parseCidrList(DEFAULT_TRUSTED_PROXY_CIDRS);
    expect(list).toHaveLength(5);
    expect(list.map((c) => c.bits)).toEqual([8, 12, 16, 8, 128]);
  });
});

describe("getClientIp", () => {
  const defaults = { TRUSTED_PROXY_CIDRS: parseCidrList(DEFAULT_TRUSTED_PROXY_CIDRS) };
  const custom = (...cidrs: string[]): { TRUSTED_PROXY_CIDRS: ParsedCidr[] } => ({
    TRUSTED_PROXY_CIDRS: parseCidrList(cidrs.join(",")),
  });

  const ctxWith = (headers: Record<string, string>) => ({
    req: {
      header: (name: string): string | undefined => headers[name.toLowerCase()] ?? undefined,
    },
  });

  test("no proxy headers → null (unknown, never a placeholder)", () => {
    expect(getClientIp(ctxWith({}), defaults)).toBeNull();
  });

  test("CF-Connecting-IP is ignored (Cloudflare remnant removed)", () => {
    expect(getClientIp(ctxWith({ "cf-connecting-ip": "203.0.113.7" }), defaults)).toBeNull();
  });

  test("single public hop is the client", () => {
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7" }), defaults)).toBe(
      "203.0.113.7",
    );
  });

  test("spoofed left-side public IP is ignored; rightmost untrusted wins", () => {
    // nginx appends the true peer rightmost; anything left of it is client-supplied.
    expect(getClientIp(ctxWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }), defaults)).toBe(
      "203.0.113.7",
    );
  });

  test("trusted proxy hops are skipped to reach the client", () => {
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" }), defaults)).toBe(
      "203.0.113.7",
    );
    expect(
      getClientIp(ctxWith({ "x-forwarded-for": "198.51.100.9, 10.0.0.5, 172.16.0.1" }), defaults),
    ).toBe("198.51.100.9");
  });

  test("all-trusted chain returns the leftmost (closest observable) hop", () => {
    expect(getClientIp(ctxWith({ "x-forwarded-for": "10.9.9.9, 10.0.0.5" }), defaults)).toBe(
      "10.9.9.9",
    );
    expect(getClientIp(ctxWith({ "x-forwarded-for": "127.0.0.1" }), defaults)).toBe("127.0.0.1");
  });

  test("unparseable hops are skipped", () => {
    expect(
      getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7, unknown, bogus-hop" }), defaults),
    ).toBe("203.0.113.7");
    expect(getClientIp(ctxWith({ "x-forwarded-for": "unknown, also-bogus" }), defaults)).toBeNull();
  });

  test("IPv4 ports on hops are stripped", () => {
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7:443" }), defaults)).toBe(
      "203.0.113.7",
    );
  });

  test("X-Real-IP is the fallback when X-Forwarded-For yields nothing", () => {
    expect(getClientIp(ctxWith({ "x-real-ip": "203.0.113.7" }), defaults)).toBe("203.0.113.7");
    // …including when XFF is present but entirely unusable.
    expect(
      getClientIp(ctxWith({ "x-forwarded-for": "garbage", "x-real-ip": "203.0.113.7" }), defaults),
    ).toBe("203.0.113.7");
    // XFF wins when it yields an answer.
    expect(
      getClientIp(
        ctxWith({ "x-forwarded-for": "198.51.100.9", "x-real-ip": "203.0.113.7" }),
        defaults,
      ),
    ).toBe("198.51.100.9");
    expect(getClientIp(ctxWith({ "x-real-ip": "not-an-ip" }), defaults)).toBeNull();
  });

  test("custom trusted CIDRs are honoured (incl. public proxy ranges)", () => {
    const cfg = custom("198.51.100.0/24");
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" }), cfg)).toBe(
      "203.0.113.7",
    );
    // …and unlisted public hops stay untrusted.
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7, 192.0.2.9" }), cfg)).toBe(
      "192.0.2.9",
    );
  });

  test("empty trust list: rightmost hop always wins", () => {
    const cfg = custom();
    expect(getClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" }), cfg)).toBe(
      "10.0.0.5",
    );
  });

  test("IPv6: loopback trusted by default, globals untrusted", () => {
    expect(getClientIp(ctxWith({ "x-forwarded-for": "2001:db8::1, ::1" }), defaults)).toBe(
      "2001:db8::1",
    );
    expect(getClientIp(ctxWith({ "x-forwarded-for": "::1" }), defaults)).toBe("::1");
    const cfg = custom("2001:db8::/32");
    expect(getClientIp(ctxWith({ "x-forwarded-for": "2001:db8::99" }), cfg)).toBe("2001:db8::99");
  });
});
