/**
 * Recipient masking for logs and audit rows (NWB-P1-004 decision 4).
 *
 * `unified_audit_log` already carries plaintext emails in places (an invitation's `after_state`
 * names the invitee), and NWB-P1-015 exists precisely because scrubbing them out again on erasure
 * is expensive. Delivery events are high-volume and would otherwise become the largest such
 * surface, so they never carry the address: `j***@example.com` keeps the domain (useful for "is
 * it all one provider bouncing?") and the initial (useful for matching against a support ticket)
 * and nothing that identifies a person on its own.
 */

/** `john@example.com` → `j***@example.com`. Anything without an `@` becomes `***`. */
export function maskEmailAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "***";
  const initial = address[0] ?? "";
  return `${initial}***${address.slice(at)}`;
}

/** The masked, comma-joined form of a recipient list — what a log line or audit row may say. */
export function maskRecipients(to: readonly string[] | string): string {
  const list = Array.isArray(to) ? to : [to as string];
  return list.map((entry) => maskEmailAddress(entry)).join(", ");
}
