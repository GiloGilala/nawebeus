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
