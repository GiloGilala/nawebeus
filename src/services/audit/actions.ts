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
  "admin.impersonation.ended": {
    description: "An impersonation session ended by its own admin (NWB-P1-011).",
    category: "security",
    resourceType: "impersonation_session",
  },
  "admin.impersonation.expired": {
    description:
      "Lapsed impersonation sessions closed as `expired` by the scheduled sweep (NWB-P1-011).",
    category: "compliance",
    resourceType: "impersonation_session",
  },
  "admin.impersonation.reentered": {
    description: "A fresh token issued inside a still-active impersonation window (NWB-P1-011).",
    category: "security",
    resourceType: "impersonation_session",
  },
  "impersonation.expire": {
    description:
      "Run-level tick of the five-minute impersonation expiry sweep (NWB-P1-011); per-session evidence is the `admin.impersonation.expired` row each closure writes.",
    category: "compliance",
    resourceType: "impersonation_session",
  },
  "admin.impersonation.started": {
    description: "Support impersonation of a user started after an MFA step-up (NWB-P1-011).",
    category: "security",
    resourceType: "impersonation_session",
  },
  "admin.impersonation.terminated": {
    description: "An impersonation session terminated by a different admin (NWB-P1-011).",
    category: "security",
    resourceType: "impersonation_session",
  },
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
  "alert.acknowledged": {
    description: "An alert event was acknowledged by a user.",
    category: "engagement",
    resourceType: "alert_event",
  },
  "alert.escalated": {
    description: "An unacknowledged alert event was escalated.",
    category: "engagement",
    resourceType: "alert_event",
  },
  "alert.fired": {
    description: "An alert condition triggered and an alert event was created.",
    category: "engagement",
    resourceType: "alert_event",
  },
  "alert.rule_created": {
    description: "An alert rule configuration was created.",
    category: "engagement",
    resourceType: "alert_rule",
  },
  "alert.rule_deleted": {
    description: "An alert rule configuration was deleted or deactivated.",
    category: "engagement",
    resourceType: "alert_rule",
  },
  "alert.rule_updated": {
    description: "An alert rule configuration was updated.",
    category: "engagement",
    resourceType: "alert_rule",
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
  "approvals.approved": {
    description:
      "An approver approved the current step; the chain advanced or the request closed approved.",
    category: "content",
    resourceType: "approval_request",
  },
  "approvals.changes_requested": {
    description:
      "An approver returned the request for edits (comment required); a resubmission is a new request.",
    category: "content",
    resourceType: "approval_request",
  },
  "approvals.expired": {
    description: "Hourly close of pending approval requests past their expiry window (NWB-P1-003).",
    category: "content",
    resourceType: "approval_request",
  },
  "approvals.recalled": {
    description: "The requester withdrew a pending request before the first approval action (AC7).",
    category: "content",
    resourceType: "approval_request",
  },
  "approvals.rejected": {
    description: "An approver rejected the request (comment required); the request is closed.",
    category: "content",
    resourceType: "approval_request",
  },
  "approvals.requested": {
    description:
      "An approval request was opened for an entity with a resolved approver chain and a content snapshot.",
    category: "content",
    resourceType: "approval_request",
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
  "backups.recorded": {
    description:
      "A backup run was recorded for lifecycle tracking; the app tracks, never performs.",
    category: "compliance",
    resourceType: "backup",
  },
  "compliance.dsar.requested": {
    description: "Data-export (DSAR) request opened against an account.",
    category: "compliance",
    resourceType: "data_export_request",
  },
  "contact.created": {
    description: "A new CRM contact was created.",
    category: "engagement",
    resourceType: "contact",
  },
  "contact.deleted": {
    description: "A contact was soft-deleted.",
    category: "engagement",
    resourceType: "contact",
  },
  "contact.followup_completed": {
    description: "A pending interaction follow-up was marked completed.",
    category: "engagement",
    resourceType: "contact_interaction",
  },
  "contact.interaction_logged": {
    description: "An outreach or response interaction was logged for a contact.",
    category: "engagement",
    resourceType: "contact_interaction",
  },
  "contact.merged": {
    description: "A contact was merged into a surviving target contact.",
    category: "engagement",
    resourceType: "contact",
  },
  "contact.updated": {
    description: "A contact's identity, details, or metadata was updated.",
    category: "engagement",
    resourceType: "contact",
  },
  "config.created": {
    description: "A system configuration setting was created.",
    category: "system_config",
    resourceType: "system_config",
  },
  "config.deleted": {
    description: "A system configuration setting was deleted.",
    category: "system_config",
    resourceType: "system_config",
  },
  "config.rolled_back": {
    description: "A system configuration setting was rolled back to its previous value.",
    category: "system_config",
    resourceType: "system_config",
  },
  "config.updated": {
    description: "A system configuration setting was updated.",
    category: "system_config",
    resourceType: "system_config",
  },
  "media.deleted": {
    description:
      "A library media asset was soft-deleted; recovery runs inside the 30-day window (NWB-P1-005).",
    category: "data_ops",
    resourceType: "media_asset",
  },
  "media.uploaded": {
    description:
      "A media asset was stored; metadata only — the bytes never enter the audit trail (NWB-P1-005).",
    category: "data_ops",
    resourceType: "media_asset",
  },
  "socialaccount.needs_reauth": {
    description:
      "A connected account failed every token-refresh attempt (one retry, FR-SOC-021) and now needs re-authentication; reason and provider code recorded, never token material (NWB-P2-002).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "warning",
  },
  "socialaccounts.refreshed": {
    description:
      "The scheduled token-refresh sweep ran; per-account evidence is in token_refresh_log, counts here (NWB-P2-002).",
    category: "data_ops",
    resourceType: "social_account",
  },
  "socialaccount.quota_warning": {
    description:
      "A social account's quota bucket crossed 80% utilization — non-essential polling should slow (FR-SOC-033); one event per crossing (NWB-P2-004).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "warning",
  },
  "socialaccount.quota_critical": {
    description:
      "A social account's quota bucket crossed 95% utilization — admin alert threshold (FR-SOC-038); one event per crossing (NWB-P2-004).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "warning",
  },
  "socialaccount.quota_exhausted": {
    description:
      "A social account's quota bucket hit 100% — non-essential syncing pauses until reset (FR-SOC-034/035); one event per crossing (NWB-P2-004).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "critical",
  },
  "socialaccount.breaker_opened": {
    description:
      "A social account hit the consecutive-failure threshold and its circuit breaker opened — all dispatch stops until a health check recovers it (NWB-P2-003).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "warning",
  },
  "socialaccount.breaker_recovered": {
    description:
      "A health-check probe succeeded against a breaker-open account; the breaker closed and dispatch resumes (NWB-P2-003).",
    category: "data_ops",
    resourceType: "social_account",
  },
  "socialaccount.chronic_failure": {
    description:
      "An account's breaker has been open for over 24 hours — escalated to critical for support attention (FR-SOC-059); notification dispatch is a P6 channel (NWB-P2-003).",
    category: "data_ops",
    resourceType: "social_account",
    severity: "critical",
  },
  "socialaccounts.health-checked": {
    description:
      "The scheduled health-check sweep ran; per-probe evidence is in social_account_health_log, counts here (NWB-P2-003).",
    category: "data_ops",
    resourceType: "social_account",
  },
  "socialaccount.connected": {
    description:
      "A social platform account was connected (or reconnected) to the organization; profile metadata only — token material never enters the audit trail (NWB-P2-001).",
    category: "data_ops",
    resourceType: "social_account",
  },
  "email.delivered": {
    description:
      "An outbound email was accepted by the transport (Resend or console); recipient masked, template kind and provider id recorded.",
    category: "user_management",
    resourceType: "email",
  },
  "email.delivery_failed": {
    description:
      "An outbound email could not be handed to the transport — a retry is owed (warning) or the budget is spent or the rejection is final (critical/warning).",
    category: "user_management",
    resourceType: "email",
    severity: "warning",
  },
  "flag.created": {
    description: "A feature flag was created.",
    category: "feature_flag",
    resourceType: "feature_flag",
  },
  "flag.deleted": {
    description: "A feature flag was deleted.",
    category: "feature_flag",
    resourceType: "feature_flag",
  },
  "flag.toggled": {
    description: "A feature flag was enabled, disabled, or kill-switched.",
    category: "feature_flag",
    resourceType: "feature_flag",
  },
  "flag.updated": {
    description: "A feature flag definition or rollout rules were updated.",
    category: "feature_flag",
    resourceType: "feature_flag",
  },
  "invitations.purged": {
    description:
      "Nightly hard-delete of invitations lapsed past the grace window; invitee addresses scrubbed from their audit rows.",
    category: "compliance",
    resourceType: "member",
  },
  "legal-holds.placed": {
    description: "A legal hold froze a user's or organization's erasure; purges skip them.",
    category: "compliance",
    resourceType: "legal_hold",
    severity: "warning",
  },
  "legal-holds.released": {
    description: "A legal hold was lifted; withheld erasures become eligible again.",
    category: "compliance",
    resourceType: "legal_hold",
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
  "retention.census.decrease_detected": {
    description:
      "The nightly audit census found fewer rows than the night before — append-only was violated somewhere below the trigger.",
    category: "compliance",
    resourceType: "audit_log",
    severity: "critical",
  },
  "retention.enforced": {
    description:
      "Nightly enforcement of the §9.4 schedule: expired DSAR packages, sessions, tokens, and backup file-status.",
    category: "compliance",
    resourceType: "retention",
  },
  "security.password_changed": {
    description: "Password changed by an authenticated user; all sessions revoked.",
    category: "security",
    resourceType: "user",
    legacyName: true,
  },
  "template.approved": {
    description: "Template content was approved for organization-wide use.",
    category: "content",
    resourceType: "template",
  },
  "template.created": {
    description: "A new template was created.",
    category: "content",
    resourceType: "template",
  },
  "template.deleted": {
    description: "A template was deleted or deactivated.",
    category: "content",
    resourceType: "template",
  },
  "template.rejected": {
    description: "A template approval request was rejected.",
    category: "content",
    resourceType: "template",
  },
  "template.updated": {
    description: "A template's content, metadata, or targeting was updated.",
    category: "content",
    resourceType: "template",
  },
  "template.used": {
    description: "A template was applied to compose content; usage count and metrics updated.",
    category: "content",
    resourceType: "template",
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
