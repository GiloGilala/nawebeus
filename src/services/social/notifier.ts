/**
 * Social account notifications (NWB-P2-007) — the delivery half of FR-SOC-008 and FR-SOC-022.
 *
 * Two requirements, both about *telling a human* something changed on a connection:
 *
 * - **FR-SOC-008** (P1): "notify all organization Admins via email when a new account is
 *   connected" — within five minutes.
 * - **FR-SOC-022** (P0): mark the account `needs_reauth` when a refresh fails **and notify the
 *   Primary Manager and all Admins** — within ten minutes. The marking half shipped in P2-002;
 *   this is the half that was parked.
 *
 * ## Why a port over `emailService` and not `fireAlert`
 *
 * The alerts engine (`src/services/alerts/`) is the right home for this eventually, but every
 * `fireAlert` call must name an `alert_rule_source`, and that enum has no `social` value — adding
 * one is a migration for a notification. P1-004's email service already supplies everything these
 * two requirements ask for: a durable outbox when the queue is up, a direct send when it is not,
 * its own audit rows (`email.delivered` / `email.delivery_failed`), and a contract that never
 * throws into the caller. So `SocialNotifier` is a **function type**, `defaultSocialNotifier` is
 * the email implementation, and P6 swaps it when in-app channels and the enum value land — the
 * call sites in `service.ts` do not change.
 *
 * ## Who "all Admins" is
 *
 * DEC-039's two administrative tiers: `owner` and `admin`. `manager` is an *operational* tier and
 * is deliberately not in `ADMIN_ROLE_CODES` — it receives `needs_reauth` only when it is the
 * account's Primary Manager (`social_accounts.primary_manager_id`, US-SOC-011), which is exactly
 * what FR-SOC-022 says. A five-seat org with one owner, one admin and one manager therefore gets
 * two emails on a connect and three on a dead token, not the same three both times.
 *
 * ## Failure discipline
 *
 * This module resolves recipients and hands the message to `emailService`; it does **not** guard
 * the caller. That guard is `notify()` in `service.ts`, which try/catches around whatever
 * notifier is installed, because a test-injected notifier (or a future swap) must never be able
 * to fail a connect, a probe or the five-minute refresh sweep. Recipient resolution failure here
 * is still caught and reported in the result, so the common case needs no luck.
 *
 * Never token material, never the provider's raw error body (BR-SOC-016 / FR-SOC-023): the
 * `needs_reauth` message carries the failure *reason* string the service already stores, which is
 * composed from status classes, not from response payloads.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { describeError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { emailService } from "../email";
import type { SocialPlatform } from "./types";
import { PLATFORM_OAUTH_PROFILES } from "./types";

/** What happened, and to which account — everything the message and its audit trail need. */
export interface SocialNotificationEvent {
  readonly event: "connected" | "reconnected" | "needs_reauth";
  readonly organizationId: string;
  readonly accountId: string;
  readonly platform: SocialPlatform;
  readonly platformUsername: string;
  /** US-SOC-011's owner of this account's alerts; notified for `needs_reauth` only. */
  readonly primaryManagerId?: string | null | undefined;
  /** The provider's failure reason, for `needs_reauth` (never token material — BR-SOC-016). */
  readonly reason?: string | null | undefined;
}

export interface SocialNotificationResult {
  /** Recipients the message was handed to (0 when nobody qualified or delivery failed). */
  readonly notified: number;
  /** Present only when the notifier caught something; the caller's operation still succeeded. */
  readonly error?: string | undefined;
}

/**
 * The delivery port. One function, not an interface with a method per event: the events differ in
 * recipients and wording, not in mechanism, and a function type keeps a test double to two lines.
 */
export type SocialNotifier = (
  db: Db,
  event: SocialNotificationEvent,
) => Promise<SocialNotificationResult>;

/** The roles FR-SOC-008/022 mean by "all Admins" — DEC-039's two administrative tiers. */
const ADMIN_ROLE_CODES = ["owner", "admin"];

const SUBJECTS: Record<SocialNotificationEvent["event"], string> = {
  connected: "A social account was connected",
  reconnected: "A social account was reconnected",
  needs_reauth: "Action required: a social account needs re-authentication",
};

/**
 * Recipient resolution.
 *
 * One query rather than one per role: active memberships of the org whose role code is in the
 * admin set, joined to accounts that can still receive mail (`users.status = 'active'`, not
 * soft-deleted, address verified — an unverified address has never been proven to belong to its
 * owner). The `UNION` arm adds the Primary Manager for `needs_reauth` only, and `DISTINCT` keeps
 * an owner who is also the Primary Manager from receiving the same message twice.
 *
 * The enum values are inlined as SQL literals rather than bound: the driver cannot infer a type
 * for a Postgres enum parameter, and these strings are ours, not input.
 */
async function resolveRecipients(
  db: Db,
  event: SocialNotificationEvent,
): Promise<{ email: string; userId: string }[]> {
  const adminRoles = sql.join(
    ADMIN_ROLE_CODES.map((code) => sql`r.code = ${code}`),
    sql` OR `,
  );
  const primaryManagerArm =
    event.event === "needs_reauth" && event.primaryManagerId
      ? sql`
        UNION
        SELECT u.email, u.id
        FROM users u
        JOIN organization_members om ON om.user_id = u.id
        WHERE u.id = ${event.primaryManagerId}
          AND om.organization_id = ${event.organizationId}
          AND om.status = 'active'
          AND om.deleted_at IS NULL
          AND u.status = 'active'
          AND u.deleted_at IS NULL
          AND u.email_verified = TRUE
      `
      : sql``;
  const rows = await db.execute<{ email: string; id: string }>(sql`
    SELECT DISTINCT u.email, u.id
    FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${event.organizationId}
      AND om.status = 'active'
      AND om.deleted_at IS NULL
      AND u.status = 'active'
      AND u.deleted_at IS NULL
      AND u.email_verified = TRUE
      AND (${adminRoles})
    ${primaryManagerArm}
  `);
  return ((rows as unknown as { rows?: { email: string; id: string }[] }).rows ?? []).map(
    (row) => ({
      email: row.email,
      userId: row.id,
    }),
  );
}

function bodyFor(
  event: SocialNotificationEvent,
  orgName: string | null,
): { html: string; text: string } {
  const label = PLATFORM_OAUTH_PROFILES[event.platform]?.label ?? event.platform;
  const heading =
    event.event === "needs_reauth"
      ? `${label} account @${event.platformUsername} needs re-authentication`
      : `${label} account @${event.platformUsername} ${event.event === "reconnected" ? "was reconnected" : "was connected"}`;
  const detail =
    event.event === "needs_reauth"
      ? `Automatic token refresh failed, so data collection for this account has stopped. Reason: ${event.reason ?? "not reported"}. Reconnect it from Settings → Integrations to resume.`
      : `It is now part of ${orgName ?? "the organization"}'s connected accounts. Data collection starts on the next sync.`;
  const text = `${heading}\n\n${detail}\n\nSettings → Integrations\n`;
  const html = `<p><strong>${heading}</strong></p><p>${detail}</p><p><a href="/settings/integrations">Settings → Integrations</a></p>`;
  return { html, text };
}

/** The email implementation of the port (FR-SOC-008 + FR-SOC-022's delivery half). */
export const defaultSocialNotifier: SocialNotifier = async (db, event) => {
  try {
    const recipients = await resolveRecipients(db, event);
    if (recipients.length === 0) {
      // Nobody qualifies (a solo org whose owner is unverified, a viewer-only tenant). Not an
      // error — the requirement is "notify the admins", and there are none to notify.
      return { notified: 0 };
    }
    const orgRows = await db.execute<{ name: string | null }>(
      sql`SELECT name FROM organizations WHERE id = ${event.organizationId} LIMIT 1`,
    );
    const orgName =
      ((orgRows as unknown as { rows?: { name: string | null }[] }).rows?.[0]?.name as
        | string
        | null
        | undefined) ?? null;
    const { html, text } = bodyFor(event, orgName);
    await emailService.send({
      to: recipients.map((recipient) => recipient.email),
      subject: SUBJECTS[event.event],
      html,
      text,
      kind: "notification",
      context: { organizationId: event.organizationId, userId: recipients[0]?.userId },
    });
    return { notified: recipients.length };
  } catch (error) {
    // Reported, never rethrown: the connection event already happened and is already durable,
    // and a notification is not worth failing it for. `notify()` in the service logs this.
    const message = describeError(error);
    logger.error("social.notification_failed", {
      event: event.event,
      accountId: event.accountId,
      platform: event.platform,
      error: message,
    });
    return { notified: 0, error: message };
  }
};

/** The installed notifier; swapped by `setSocialNotifierForTest` and by P6's channel work. */
let socialNotifier: SocialNotifier = defaultSocialNotifier;

export function getSocialNotifier(): SocialNotifier {
  return socialNotifier;
}

/**
 * Test seam. Pass `undefined` to restore the production notifier. A test double may throw — the
 * service's `notify()` guard is what makes that safe, and one test asserts exactly that.
 */
export function setSocialNotifierForTest(notifier: SocialNotifier | undefined): void {
  socialNotifier = notifier ?? defaultSocialNotifier;
}
