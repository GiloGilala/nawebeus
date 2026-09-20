/**
 * Coerce a request header into a value Postgres will accept for an `inet` column.
 *
 * Returns `null` when the value can't be trusted as an address, and callers must
 * treat `null` as "unknown" rather than substituting a placeholder. Two
 * placeholders have already caused real bugs here:
 *   - `"unknown"` — `inet` rejects it outright (`22P02`), which 500s sign-in.
 *   - `"0.0.0.0"` — accepted, but writes a fabricated address into the data.
 *
 * This matters beyond tidiness: `X-Forwarded-For` and friends are client-supplied,
 * so without strict validation a caller can choose a value that makes the write
 * fail. Anything unrecognised degrades to `null` instead of erroring.
 */
export function normaliseIp(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // `X-Forwarded-For` is a comma-separated chain; the first entry is the client.
  const candidate = raw.split(",")[0]?.trim() ?? "";
  if (!candidate) return null;

  // `[::1]:8080` — bracketed IPv6 with an optional port.
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate);
  if (bracketed?.[1]) return isIpv6(bracketed[1]) ? bracketed[1] : null;

  // `203.0.113.7:443` — IPv4 with a port.
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate);
  if (ipv4WithPort?.[1]) return ipv4WithPort[1];

  return isIpv4(candidate) || isIpv6(candidate) ? candidate : null;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * Deliberately permissive about compression (`::`) but strict about the alphabet —
 * `inet` also accepts CIDR suffixes, which we don't want to record as a client IP.
 */
function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.includes("/")) return false;
  if (!/^[0-9a-fA-F:]+$/.test(value)) return false;
  return value.split(":").length <= 9;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trusted-proxy aware client IP (NWB-P0-017 / F-10)
// ─────────────────────────────────────────────────────────────────────────────
//
// Deployment model: the app sits behind nginx on a self-hosted VPS (ADR-008,
// Infrastructure.md) — there is no CDN in the documented path, so
// `CF-Connecting-IP` is not read (it was a Cloudflare remnant).
//
// `getClientIp` is the ONLY sanctioned way to derive a client address from a
// request. It analyses `X-Forwarded-For` right-to-left (nearest hop first),
// skipping hops inside `TRUSTED_PROXY_CIDRS`, and returns the first hop no
// trusted proxy added — i.e. the client. `X-Real-IP` is a fallback for headers
// nginx sets without an `X-Forwarded-For` chain.
//
// Residual, documented rather than fixed: a client connecting directly (no
// proxy) can forge any header value, and without the socket peer address that
// forgery is undetectable — the rightmost hop is returned as-is. The deployment
// is always behind nginx, which appends the true peer rightmost, so forged
// values can only appear further left, where the walk ignores them. Plumbing
// the socket peer through (Bun's `server.requestIP`) would couple every route
// and test to the server object; NWB-P0-017 deliberately does not do that.

/** Default `TRUSTED_PROXY_CIDRS`: RFC1918 private ranges + v4/v6 loopback. */
export const DEFAULT_TRUSTED_PROXY_CIDRS =
  "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8,::1/128";

export interface ParsedCidr {
  family: 4 | 6;
  /** Network address with host bits masked off (uint32 number / 128-bit bigint). */
  network: number | bigint;
  /** Prefix length: 0–32 (v4) or 0–128 (v6). */
  bits: number;
}

type ParsedIp = { family: 4; value: number } | { family: 6; value: bigint };

/** Strict IPv4 parse → uint32, or null. Rejects ports, CIDR suffixes, junk. */
function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/**
 * Strict IPv6 parse → 128-bit bigint, or null. Handles `::` compression (at
 * most once); every other group must be 1–4 hex digits. IPv4-mapped forms
 * (`::ffff:1.2.3.4`) are NOT recognised — neither is `isIpv6` above, so the
 * two agree and such hops are skipped, never misclassified.
 */
function parseIpv6(ip: string): bigint | null {
  const firstDouble = ip.indexOf("::");
  if (firstDouble !== -1 && ip.indexOf("::", firstDouble + 2) !== -1) return null;

  const head: string[] = [];
  const tail: string[] = [];
  if (firstDouble === -1) {
    head.push(...ip.split(":"));
  } else {
    const before = ip.slice(0, firstDouble);
    const after = ip.slice(firstDouble + 2);
    if (before) head.push(...before.split(":"));
    if (after) tail.push(...after.split(":"));
  }

  const groups = [...head, ...tail];
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  if (firstDouble === -1) {
    if (groups.length !== 8) return null;
  } else {
    if (groups.length > 7) return null;
    groups.splice(head.length, 0, ...new Array<string>(8 - groups.length).fill("0"));
  }

  let value = 0n;
  for (const g of groups) {
    value = (value << 16n) + BigInt(Number.parseInt(g, 16));
  }
  return value;
}

/** Strict parse of a bare IP (no port, no CIDR suffix), either family. */
function parseIp(ip: string): ParsedIp | null {
  const v4 = parseIpv4(ip);
  if (v4 !== null) return { family: 4, value: v4 };
  const v6 = parseIpv6(ip);
  if (v6 !== null) return { family: 6, value: v6 };
  return null;
}

/**
 * Parses one `TRUSTED_PROXY_CIDRS` entry (`address/bits`, or a bare IP meaning
 * a host route). Throws a descriptive Error on anything invalid — `config.ts`
 * guards with `isCidrList` first so startup fails with the standard message.
 */
export function parseCidr(entry: string): ParsedCidr {
  const trimmed = entry.trim();
  const slash = trimmed.indexOf("/");
  const addrText = (slash === -1 ? trimmed : trimmed.slice(0, slash)).trim();
  const bitsText = slash === -1 ? null : trimmed.slice(slash + 1).trim();

  const addr = parseIp(addrText);
  if (!addr) {
    throw new Error(
      `Invalid TRUSTED_PROXY_CIDRS entry ${JSON.stringify(entry)}: not an IP address`,
    );
  }
  if (slash !== -1 && trimmed.indexOf("/", slash + 1) !== -1) {
    throw new Error(`Invalid TRUSTED_PROXY_CIDRS entry ${JSON.stringify(entry)}: too many "/"`);
  }

  const maxBits = addr.family === 4 ? 32 : 128;
  let bits = maxBits;
  if (bitsText !== null) {
    if (!/^\d{1,3}$/.test(bitsText)) {
      throw new Error(
        `Invalid TRUSTED_PROXY_CIDRS entry ${JSON.stringify(entry)}: bad prefix length`,
      );
    }
    bits = Number(bitsText);
    if (bits > maxBits) {
      throw new Error(
        `Invalid TRUSTED_PROXY_CIDRS entry ${JSON.stringify(entry)}: /${bits} exceeds /${maxBits} for IPv${addr.family}`,
      );
    }
  }

  if (addr.family === 4) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return { family: 4, network: (addr.value & mask) >>> 0, bits };
  }
  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
  return { family: 6, network: addr.value & mask, bits };
}

/**
 * Parses a comma-separated CIDR list. Empty/whitespace-only input means "trust
 * no proxies" (rightmost hop always wins) — the fail-closed direction, since
 * trusting fewer hops can only move the answer toward the proxy-added end.
 */
export function parseCidrList(raw: string): ParsedCidr[] {
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .map(parseCidr);
}

/** True when `raw` parses as a CIDR list (used as the zod refine in config). */
export function isCidrList(raw: string): boolean {
  try {
    parseCidrList(raw);
    return true;
  } catch {
    return false;
  }
}

function isTrustedProxyIp(parsed: ParsedIp, trusted: ParsedCidr[]): boolean {
  for (const cidr of trusted) {
    if (cidr.family !== parsed.family) continue;
    if (parsed.family === 4 && typeof cidr.network === "number") {
      const mask = cidr.bits === 0 ? 0 : (0xffffffff << (32 - cidr.bits)) >>> 0;
      if (((parsed.value as number) & mask) >>> 0 === cidr.network) return true;
    } else if (parsed.family === 6 && typeof cidr.network === "bigint") {
      const mask =
        cidr.bits === 0 ? 0n : ((1n << BigInt(cidr.bits)) - 1n) << BigInt(128 - cidr.bits);
      if (((parsed.value as bigint) & mask) === cidr.network) return true;
    }
  }
  return false;
}

/**
 * Derives the client IP from request headers under the nginx trust model.
 *
 * `X-Forwarded-For` is walked right-to-left (nearest hop first): trusted-proxy
 * hops are skipped and the first untrusted hop is the client. Hops that fail
 * validation (ports are stripped, then strict-parsed) are skipped — a hop
 * nginx never emits can only be client-supplied, so skipping it loses nothing.
 * When every hop is trusted (e.g. a private-only chain) the leftmost hop is
 * returned as the closest observable address. `X-Real-IP` is consulted only
 * when `X-Forwarded-For` yields nothing. Returns null when no header carries a
 * usable address; callers treat null as "unknown" (never a placeholder).
 */
export function getClientIp(
  c: { req: { header(name: string): string | undefined } },
  config: { TRUSTED_PROXY_CIDRS: ParsedCidr[] },
): string | null {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const hops: { text: string; parsed: ParsedIp }[] = [];
    for (const raw of forwarded.split(",")) {
      const text = normaliseIp(raw);
      if (!text) continue;
      const parsed = parseIp(text);
      if (!parsed) continue;
      hops.push({ text, parsed });
    }
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i]!;
      if (!isTrustedProxyIp(hop.parsed, config.TRUSTED_PROXY_CIDRS)) return hop.text;
    }
    if (hops.length > 0) return hops[0]!.text;
  }

  // No XFF chain (or nothing usable in it): nginx's single-value statement.
  // normaliseIp, not parseIp, deliberately — this preserves the existing
  // lenient single-value behaviour (ports tolerated) for a non-classified hop.
  return normaliseIp(c.req.header("x-real-ip"));
}
