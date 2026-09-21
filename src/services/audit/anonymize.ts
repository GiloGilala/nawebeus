/**
 * Scrubbing actor PII from audit rows when a subject is hard-purged (NWB-P1-015,
 * BR-AUTH-043 / F-29).
 *
 * The 7-year retention rule is why the rows must survive, so erasure cannot delete them — and the
 * hash chain (NWB-P1-014) is why the scrub is shaped the way it is: `checksum` covers
 * `(id, action, actorId, resourceId, createdAt, previousChecksum)`, so `actor_id` and `resource_id`
 * are untouchable (replacing either breaks that link and every successor), while `actor_ip`,
 * `actor_user_agent` and the four jsonb columns are NOT hash inputs and can be scrubbed without
 * disturbing the chain. The subject's bare uuids stay behind as unresolvable references to a
 * deleted row — that is the ticket's recommended reading, and the test proves the chain still
 * verifies afterwards rather than arguing it.
 *
 * The scrub rule is evidence-driven, from a survey of all 17 `writeAuditLog` call sites (recorded
 * in the ticket): the only subject-PII keys any writer emits are the email family (`email` on
 * invite/accept, `newEmail` on email-change). No writer emits a `phone` or bare-`id` key; `name`
 * is ambiguous (org names are compliance history that must survive); free-text `reason` values
 * are unscrubbable without reading prose. So: recursive walk, string values under `/email/i` or
 * `/phone/i` keys, replaced with {@link AUDIT_REDACTED} **iff the value equals one of the
 * subject's known identity values**. The value gate is what makes substring key matching safe and
 * what preserves other people's emails in shared rows — purging an inviter keeps the invitee's
 * email, purging the invitee scrubs it.
 *
 * Two match classes. Rows where the subject is the ACTOR get the full scrub including ip/UA
 * nulling — that network context is unambiguously theirs. Rows where the subject is only the
 * target, and the one known cross-reference shape (the inviter's `organization.member.invited`
 * row, caught by a second pass over jsonb email values), get value-only scrubbing: their ip/UA
 * describes someone else's session, and nulling it would be destruction beyond the erasure scope.
 * (The ticket's Build section says to null ip/UA for target-matched rows too; that would erase the
 * acting admin's context whenever an admin acts on a subject, so the implementation refines it —
 * acceptance #1 only requires what resolves to the subject.) `organization_id` survives by rule
 * (an org's compliance history is not one member's data); `session_id`/`requestId` are
 * unresolvable-random and stay.
 *
 * The trigger allows this and only this: migration `0002` extends `impl_ual_append_only()` with a
 * second sanctioned exception — an UPDATE confined to the six PII columns, and only while the
 * transaction carries `SET LOCAL audit.anonymizing = 'on'`, which this module sets around its
 * scrub and resets in a `finally`. Anything else under the flag (including a combined flag flip)
 * still raises.
 *
 * Idempotent by construction: already-marker values are skipped, already-NULL ip/UA is not an
 * update, and the count returned is rows actually changed — a re-run returns 0 and writes nothing.
 * When NWB-P1-010 lands legal holds, the hold check goes here (service, not job) — this function
 * is the seam.
 *
 * NWB-P1-016 reuses the core below the identity layer for lapsed invites
 * (`anonymizeAuditInviteeEmail`): same flag dance, same value-gated jsonb walk, but resource-
 * scoped candidates and network-nulling unconditionally off — every matched row belongs to an
 * inviter who is not being erased.
 */

import { sql } from "drizzle-orm";
import type { DbOrTx } from "../../lib/transaction";

/** What a scrubbed identity value reads as — shape-preserving (a string stays a string). */
export const AUDIT_REDACTED = "[redacted]";

/** The jsonb columns the scrub walks. All four, uniformly — future keys included. */
const SCRUB_JSON_COLUMNS = ["before_state", "after_state", "changes", "metadata"] as const;

/**
 * Key families eligible for value replacement (substring, case-insensitive). The key match is only
 * eligibility — {@link scrubJsonValue} still requires the value to equal a known identity value,
 * which is what keeps `microphoneLevel: "high"` and other absurd matches from ever firing.
 */
const PII_KEY_PATTERN = /(email|phone)/i;

/**
 * The suffix `deleteAccount` appends to the address at soft-delete time
 * (`email || '+deleted' || left(gen_random_uuid()::text, 8)`): the literal `+deleted` plus exactly
 * 8 hex chars, always at the very end because it is appended after the full address. Trailing-strip
 * recovery is unambiguous for that reason — and repeated, because a delete → reactivate → delete
 * cycle mangles twice.
 */
const MANGLED_SUFFIX_PATTERN = /\+deleted[0-9a-f]{8}$/;

/** A known identity value, already normalized for comparison (emails lowercased). */
type KnownValue = string;

/**
 * Recover the pre-mangle address candidates from the `users.email` value seen at purge time: the
 * stored value itself (a row could hold the mangled form) plus every repeated trailing-strip. The
 * stored value is always mangled for a purge candidate (every candidate passed through
 * `deleteAccount`), but the loop degrades gracefully if it is not — zero strips, one candidate.
 */
export function mangleCandidates(storedEmail: string): string[] {
  const candidates = [storedEmail];
  let current = storedEmail;
  while (MANGLED_SUFFIX_PATTERN.test(current)) {
    current = current.replace(MANGLED_SUFFIX_PATTERN, "");
    candidates.push(current);
  }
  return candidates;
}

const digitsOnly = (value: string): string => value.replace(/\D/g, "");

/**
 * Recursively replace eligible identity values with {@link AUDIT_REDACTED}. Pure — no database —
 * so the matching rule is unit-testable without a purge. Returns the scrubbed value plus whether
 * anything changed; already-marker values are returned untouched so a re-scrub is a stable no-op.
 */
export function scrubJsonValue(
  node: unknown,
  isKnownValue: (value: string) => boolean,
): { value: unknown; changed: boolean } {
  if (Array.isArray(node)) {
    let changed = false;
    const value = node.map((entry) => {
      const scrubbed = scrubJsonValue(entry, isKnownValue);
      changed = changed || scrubbed.changed;
      return scrubbed.value;
    });
    return { value, changed };
  }
  if (typeof node === "object" && node !== null) {
    let changed = false;
    const value: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(node)) {
      if (
        typeof entry === "string" &&
        entry !== AUDIT_REDACTED &&
        PII_KEY_PATTERN.test(key) &&
        isKnownValue(entry)
      ) {
        value[key] = AUDIT_REDACTED;
        changed = true;
      } else {
        const scrubbed = scrubJsonValue(entry, isKnownValue);
        changed = changed || scrubbed.changed;
        value[key] = scrubbed.value;
      }
    }
    return { value, changed };
  }
  return { value: node, changed: false };
}

type AnonymizeCandidateRow = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  before_state: unknown;
  after_state: unknown;
  changes: unknown;
  metadata: unknown;
};

export interface AnonymizeAuditActorContextInput {
  userId: string;
}

/**
 * Scrub one erased subject's actor context from `unified_audit_log`. Returns the number of rows
 * actually changed (0 when there was nothing to scrub — including when the user row is already
 * gone, which is the concurrent-purge case).
 *
 * Must run BEFORE the subject's row is deleted and inside the same savepoint: identity values are
 * read from the still-present user and membership rows, and a later DELETE refusal rolls the scrub
 * back with it. `deleteRowsPerRow`'s `beforeDelete` hook is that placement.
 */
export async function anonymizeAuditActorContext(
  tx: DbOrTx,
  input: AnonymizeAuditActorContextInput,
): Promise<number> {
  const { userId } = input;

  const userRows = await tx.execute<{ email: string; phone: string | null }>(
    sql`SELECT email, phone FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const user = (userRows as unknown as { rows?: { email: string; phone: string | null }[] })
    .rows?.[0];
  const memberRows = await tx.execute<{ invited_email: string | null }>(
    sql`SELECT DISTINCT invited_email FROM organization_members
         WHERE user_id = ${userId} AND invited_email IS NOT NULL`,
  );
  const invitedEmails = (
    (memberRows as unknown as { rows?: { invited_email: string | null }[] }).rows ?? []
  )
    .map((row) => row.invited_email)
    .filter((email): email is string => email !== null);

  // Known emails: the mangled value as stored, every un-mangle of it, and every invite-time
  // address. Lowercased once — email comparison is case-insensitive. Known phones: digit-
  // normalized, same idea for formatting variants. Either set may be empty; matching then
  // matches nothing, which is the correct degraded behavior, not an error.
  const knownEmails = new Set<KnownValue>();
  if (user) {
    for (const candidate of mangleCandidates(user.email)) knownEmails.add(candidate.toLowerCase());
  }
  for (const invited of invitedEmails) knownEmails.add(invited.toLowerCase());
  const knownPhones = new Set<KnownValue>();
  if (user?.phone) {
    const digits = digitsOnly(user.phone);
    if (digits !== "") knownPhones.add(digits);
  }
  const isKnownValue = (value: string): boolean => {
    if (knownEmails.has(value.toLowerCase())) return true;
    const digits = digitsOnly(value);
    return digits !== "" && knownPhones.has(digits);
  };

  // The email pre-filter runs on every known address form at once: the stored value catches
  // rows holding it verbatim, and an original catches rows holding a mangled form (which contains
  // its original as a substring). Invite-time addresses catch the inviter's invite row. `strpos`,
  // not LIKE — no metacharacter escaping to get wrong.
  const preFilterEmails = [
    ...new Set([...invitedEmails, ...(user ? mangleCandidates(user.email) : [])]),
  ];
  const emailClauses = preFilterEmails.flatMap((email) =>
    SCRUB_JSON_COLUMNS.map((column) => sql`strpos(${sql.raw(column)}::text, ${email}) > 0`),
  );

  const candidates = await tx.execute<AnonymizeCandidateRow>(
    sql`SELECT id, actor_id, target_user_id, actor_ip, actor_user_agent,
               before_state, after_state, changes, metadata
        FROM unified_audit_log
        WHERE actor_id = ${userId} OR target_user_id = ${userId}${
          emailClauses.length > 0 ? sql` OR ${sql.join(emailClauses, sql` OR `)}` : sql``
        }`,
  );
  const rows = (candidates as unknown as { rows?: AnonymizeCandidateRow[] }).rows ?? [];

  // Only rows the subject acted lose their network context. A target-matched or second-pass
  // (email-matched) row's ip/UA describes someone else's session — nulling it would be
  // destruction beyond the erasure scope.
  return withAnonymizationFlag(tx, () =>
    scrubCandidateRows(tx, rows, isKnownValue, (row) => row.actor_id === userId),
  );
}

export interface AnonymizeAuditInviteeEmailInput {
  /** The lapsed invite's member row id — the resource identity the scrub is scoped to. */
  memberId: string;
  /**
   * The invite-time addresses to redact: `invited_email` plus whatever the invite's own audit
   * rows hold, collected pre-delete by the caller. Empty (an invite with no address anywhere)
   * means nothing to do, not an error.
   */
  emails: readonly string[];
}

/**
 * Scrub one lapsed invite's address from its audit rows (NWB-P1-016). Value-only, always: every
 * matched row belongs to an inviter who is not being erased, so ip/UA is never nulled here.
 *
 * Candidates are resource-scoped (`resource_type='member' AND resource_id=<memberId>`), which is
 * what keeps another org's still-pending invite for the same address untouched — a whole-table
 * email match would eat it. Must run before the member row's DELETE in the same savepoint, like
 * its subject-keyed sibling.
 */
export async function anonymizeAuditInviteeEmail(
  tx: DbOrTx,
  input: AnonymizeAuditInviteeEmailInput,
): Promise<number> {
  if (input.emails.length === 0) return 0;
  const known = new Set(input.emails.map((email) => email.toLowerCase()));
  const isKnownValue = (value: string): boolean => known.has(value.toLowerCase());

  const candidates = await tx.execute<AnonymizeCandidateRow>(
    sql`SELECT id, actor_id, target_user_id, actor_ip, actor_user_agent,
               before_state, after_state, changes, metadata
        FROM unified_audit_log
        WHERE resource_type = 'member' AND resource_id = ${input.memberId}`,
  );
  const rows = (candidates as unknown as { rows?: AnonymizeCandidateRow[] }).rows ?? [];
  return withAnonymizationFlag(tx, () => scrubCandidateRows(tx, rows, isKnownValue, () => false));
}

/**
 * Declare the scrub intent transaction-locally around `fn, and reset it after — even on
 * failure, so a failed scrub cannot leave the flag on for whatever runs next in the same
 * transaction (including a later test asserting the trigger still rejects).
 */
async function withAnonymizationFlag<T>(tx: DbOrTx, fn: () => Promise<T>): Promise<T> {
  await tx.execute(sql.raw("SET LOCAL audit.anonymizing = 'on'"));
  try {
    return await fn();
  } finally {
    await tx.execute(sql.raw("SET LOCAL audit.anonymizing = 'off'"));
  }
}

/**
 * The shared scrub-update loop: walk each candidate's jsonb with the value gate, null network
 * context where the caller says so, UPDATE the rows that actually changed, and count them.
 * Rows are updated PII-columns-only — the trigger's NWB-P1-015 exception confines the UPDATE to
 * exactly these, and rejects anything else even with the flag set.
 */
async function scrubCandidateRows(
  tx: DbOrTx,
  rows: readonly AnonymizeCandidateRow[],
  isKnownValue: (value: string) => boolean,
  nullNetworkForRow: (row: AnonymizeCandidateRow) => boolean,
): Promise<number> {
  let scrubbed = 0;
  for (const row of rows) {
    const nullNetwork = nullNetworkForRow(row);
    const nextIp = nullNetwork ? null : row.actor_ip;
    const nextUa = nullNetwork ? null : row.actor_user_agent;

    const states = {
      before_state: row.before_state,
      after_state: row.after_state,
      changes: row.changes,
      metadata: row.metadata,
    } as const;
    let changed = nullNetwork && (row.actor_ip !== null || row.actor_user_agent !== null);
    const nextStates: Record<(typeof SCRUB_JSON_COLUMNS)[number], unknown> = {
      before_state: row.before_state,
      after_state: row.after_state,
      changes: row.changes,
      metadata: row.metadata,
    };
    for (const column of SCRUB_JSON_COLUMNS) {
      if (states[column] === null || states[column] === undefined) continue;
      const scrubbedState = scrubJsonValue(states[column], isKnownValue);
      if (scrubbedState.changed) {
        changed = true;
        nextStates[column] = scrubbedState.value;
      }
    }
    if (!changed) continue;

    await tx.execute(
      sql`UPDATE unified_audit_log
          SET actor_ip = ${nextIp}, actor_user_agent = ${nextUa},
              before_state = ${JSON.stringify(nextStates.before_state)}::jsonb,
              after_state = ${JSON.stringify(nextStates.after_state)}::jsonb,
              changes = ${JSON.stringify(nextStates.changes)}::jsonb,
              metadata = ${JSON.stringify(nextStates.metadata)}::jsonb
          WHERE id = ${row.id}`,
    );
    scrubbed++;
  }
  return scrubbed;
}
