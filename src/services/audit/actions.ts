/**
 * The audit action registry (NWB-P1-002).
 *
 * `unified_audit_log.action` is a free-text `varchar(100)` whose only rule, until now, was a comment
 * in `db/shared/enums.ts`'s neighbourhood: "Convention: `<resource>.<verb>` — enforced at application
 * layer". Nothing enforced it, and the 31 actions actually in the tree break that rule three different
 * ways (`security.password_changed` has no resource segment, `apikeys.created` pluralises the domain,
 * `organization.member.accepted` is `<domain>.<resource>.<verb>`). So the registry below does two
 * things, and deliberately not a third:
 *
 * 1. **Membership is a type.** `writeAuditLog` takes `AuditActionName`, so inventing `user_delete`
 *    beside `organization.member.deleted` is a compile error, not a new spelling that a compliance
 *    query never finds. This is the "full typing" the execution plan asked for.
 * 2. **`category`, `resourceType` and `severity` are defaults attached to the action.** They were
 *    loose parameters, which is how the same event can be filed under two categories depending on who
 *    wrote it — and a category you cannot trust is a category nobody filters on.
 * 3. **Not** a rename of the 31 existing strings. `legacyName: true` marks the ones that do not match
 *    the format rule, and they stay exactly as written: audit rows are evidence, so `action` is a
 *    *vocabulary* and vocabularies do not get silently respelled — any saved filter, alert rule, or
 *    NWB-P1-010 retention rule keyed on `action` would stop matching with no error anywhere. Renaming
 *    is a separate decision with a migration and a mapping table, not a side effect of a typing PR.
 *
 * ## Adding an action
 *
 * Add it here in the same commit as the code that writes it, with the format rule satisfied
 * (`<resource>.<verb>`, or `<domain>.<resource>.<verb>` when a resource name alone would be
 * ambiguous — `member.role_changed` says nothing without `organization.`). `registry.test.ts` fails a
 * new action that matches neither, and fails any legacy spelling that gets *removed* from the list
 * while still being written.
 */
import type { AuditCategory, AuditSeverity } from "./types";

/** What one audit action means, and how it is filed. */
export interface AuditActionSpec {
  /** One line for a human, because `bun run queue:run --list` and the audit UI both print this. */
  readonly description: string;
  readonly category: AuditCategory;
  /**
   * The `resource_type` the row carries. `null` means "this event has no single resource" — an
   * aggregate like a nightly purge — and is *not* the same as leaving it out.
   */
  readonly resourceType: string | null;
  /**
   * Default severity. A writer overrides it only when severity is genuinely contextual (a retry versus
   * a terminal failure), which is what `src/lib/worker.ts` does; a static override at the call site is
   * a registry bug.
   */
  readonly severity?: AuditSeverity;
  /**
   * Spelling that predates the registry and is kept verbatim.
   *
   * This is **vocabulary** debt, not a format violation: all five satisfy `AUDIT_ACTION_FORMAT`. What
   * they break is the shape the format cannot express — a pluralised domain where a resource belongs
   * (`apikeys.*` next to `resource_type: "api_key"`), a missing resource segment
   * (`security.password_changed`), and a verb with a suffix that reads as a second resource
   * (`auth.sessions.revoked_others`). `registry.test.ts` pins the set exactly, so a new entry cannot
   * join it quietly.
   */
  readonly legacyName?: true;
}

/**
 * Lowercase dot-separated segments, each `[a-z0-9]` with internal `-`/`_` allowed, at least two
 * segments, total ≤ 100 (the column's limit). Rejects `user_delete` (no dot), `UserCreated`,
 * `auth..failed`, and a trailing dot.
 */
export const AUDIT_ACTION_FORMAT =
  /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*)+$/;

export const AUDIT_ACTIONS = {
  "account.deleted": {
    description: "Account soft-deleted; the 30-day grace window starts now.",
    category: "security",
    resourceType: "user",
  },
  "account.reactivated": {
    description: "Soft-deleted account restored inside the grace window.",
    category: "security",
    resourceType: "user",
  },
  "accounts.purged": {
    description: "Nightly hard-delete of accounts whose grace window elapsed (F-18, NDPR erasure).",
    category: "compliance",
    resourceType: "user",
  },
  "apikeys.created": {
    description: "API key issued. Never the key value — prefix and metadata only.",
    category: "security",
    resourceType: "api_key",
    legacyName: true,
  },
  "apikeys.revoked": {
    description: "API key revoked. The row survives so the key stays in history and cannot return.",
    category: "security",
    resourceType: "api_key",
    legacyName: true,
  },
  "apikeys.rotated": {
    description: "API key replaced; `metadata.rotatedFromId` names the key it supersedes.",
    category: "security",
    resourceType: "api_key",
    legacyName: true,
  },
  "audit-chain.verified": {
    description:
      "Nightly hash-chain verification walked the admin/system/compliance chains; `after_state.failed` counts broken rows.",
    category: "security",
    resourceType: "audit_log",
  },
  "auth.email_change.confirmed": {
    description: "Pending email change applied after the new address was verified.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.email_change.requested": {
    description: "Email change requested; verification sent to the new address.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.email_verification.completed": {
    description: "Address verification token redeemed.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.email_verification.sent": {
    description: "Verification email dispatched.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.mfa.disabled": {
    description: "MFA turned off for an account — a security downgrade, so it is always recorded.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.mfa.enabled": {
    description: "MFA enrolment confirmed.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.mfa.failed": {
    description: "MFA challenge failed (bad code or exhausted backup code).",
    category: "authentication",
    resourceType: "user",
    severity: "warning",
  },
  "auth.mfa.verified": {
    description: "MFA challenge passed.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.password_reset.completed": {
    description: "Reset token consumed; sessions revoked as part of the same operation.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.password_reset.requested": {
    description:
      "Reset link sent. Recorded whether or not the email delivered, so a silent transport failure is visible.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.session.revoked": {
    description: "One session ended by its owner.",
    category: "authentication",
    resourceType: "session",
  },
  "auth.sessions.revoked_others": {
    description: "Every session except the caller's current one — the 'sign out everywhere' path.",
    category: "authentication",
    resourceType: "user",
    legacyName: true,
  },
  "auth.signin.completed": {
    description: "Credentials accepted and a session issued.",
    category: "authentication",
    resourceType: "user",
  },
  "auth.signup.completed": {
    description: "Account created through self-service signup.",
    category: "authentication",
    resourceType: "user",
  },
  "compliance.dsar.requested": {
    description: "Data-export (DSAR) request opened against an account.",
    category: "compliance",
    resourceType: "data_export_request",
  },
  "invitations.purged": {
    description:
      "Nightly hard-delete of invitations lapsed past the grace window; invitee addresses scrubbed from their audit rows.",
    category: "compliance",
    resourceType: "member",
  },
  "organization.deleted": {
    description:
      "Organization soft-deleted; grace window starts, and the purge job finishes the job.",
    category: "security",
    resourceType: "organization",
    severity: "warning",
  },
  "organization.member.accepted": {
    description: "Invitation accepted; membership becomes active.",
    category: "authorization",
    resourceType: "member",
  },
  "organization.member.deleted": {
    description: "Membership removed through the admin user surface.",
    category: "user_management",
    resourceType: "user",
  },
  "organization.member.invited": {
    description: "Invitation issued to an email address.",
    category: "authorization",
    resourceType: "member",
  },
  "organization.member.removed": {
    description: "Membership removed through the organization surface.",
    category: "authorization",
    resourceType: "member",
  },
  "organization.member.role_changed": {
    description: "Role reassigned — the single most important authorization event in the log.",
    category: "authorization",
    resourceType: "member",
  },
  "organization.member.status_changed": {
    description: "Membership activated, suspended, or restored.",
    category: "user_management",
    resourceType: "user",
  },
  "organization.members.bulk_invited": {
    description: "CSV bulk invitation. The resource is the organization, not the N new members.",
    category: "authorization",
    resourceType: "organization",
  },
  "organization.owner.created": {
    description: "Owner membership created in the same transaction as the organization (F-01).",
    category: "authorization",
    resourceType: "organization",
  },
  "organization.reactivated": {
    description: "Soft-deleted organization restored inside the grace window.",
    category: "security",
    resourceType: "organization",
  },
  "organizations.purged": {
    description: "Nightly hard-delete of organizations whose grace window elapsed.",
    category: "compliance",
    resourceType: "organization",
  },
  "rate-limits.reclaimed": {
    description:
      "Expired rate-limit buckets deleted, so the sliding window cannot fill with corpses.",
    category: "data_ops",
    resourceType: "rate_limit",
  },
  "security.password_changed": {
    description: "Password changed by an authenticated user; all sessions revoked.",
    category: "security",
    resourceType: "user",
    legacyName: true,
  },
} as const satisfies Record<string, AuditActionSpec>;

/** Every action the application is allowed to write. */
export type AuditActionName = keyof typeof AUDIT_ACTIONS;

/** The actions whose spelling predates the registry and is kept for continuity. @see file header. */
export const LEGACY_AUDIT_ACTION_NAMES = Object.keys(AUDIT_ACTIONS).filter(
  (name) => (AUDIT_ACTIONS[name as AuditActionName] as AuditActionSpec).legacyName === true,
) as AuditActionName[];

/** Registry lookup that cannot miss, because the key type is the registry's own keys. */
export function auditActionSpec(name: AuditActionName): AuditActionSpec {
  return AUDIT_ACTIONS[name];
}

/**
 * Does this name satisfy the format rule *and* the no-new-debt policy?
 *
 * Returns the reason a name is unacceptable rather than a bare boolean: the caller is a test, and a
 * failing test that says *why* is the difference between a five-minute fix and an archaeology dig.
 */
export function auditActionNamingProblem(name: string): string | null {
  if (!(name in AUDIT_ACTIONS)) return `"${name}" is not registered in AUDIT_ACTIONS`;
  if (!AUDIT_ACTION_FORMAT.test(name)) return `"${name}" does not match ${AUDIT_ACTION_FORMAT}`;
  if (name.split(".").length < 2) return `"${name}" needs at least <resource>.<verb>`;
  return null;
}
