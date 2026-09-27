/**
 * Validation schemas — social accounts (P14.3, the web cluster over NWB-P2-006/007).
 *
 * Domain literals live here rather than being imported from `src/services/social`: the validation
 * layer is allowed to depend on `zod` and on itself only, which is what keeps it usable from both
 * the Server Functions and (later) a generated client. The service stays the authority at runtime —
 * it re-checks the platform against `PLATFORM_OAUTH_PROFILES` and refuses an unconfigured one — so
 * a drift between this list and the registry fails closed rather than silently.
 *
 * Pagination bounds mirror `src/lib/pagination.ts` (`DEFAULT_PAGE_SIZE` 20, `MAX_PAGE_SIZE` 100) so
 * the web surface answers the same 422 the `/api/social` routes do.
 */
import { z } from "zod";

/** The DEC-009 five. Mirrors `SOCIAL_PLATFORMS` in `src/services/social/types.ts`. */
export const SOCIAL_PLATFORMS = [
  "youtube",
  "twitter_x",
  "instagram",
  "facebook",
  "reddit",
] as const;
export type SocialPlatformInput = (typeof SOCIAL_PLATFORMS)[number];

/** The `social_account_status` enum. Mirrors `LIST_STATUSES` in the social route. */
export const SOCIAL_ACCOUNT_STATUSES = [
  "active",
  "error",
  "paused",
  "needs_reauth",
  "disconnected",
  "pending_verification",
] as const;
export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

/** `soc_<uuid>` — the id the service mints (`soc_` + `crypto.randomUUID()`). */
export const SOCIAL_ACCOUNT_ID_PATTERN = /^soc_[0-9a-fA-F-]{36}$/;

/**
 * The `returnUrl` shape `initiateConnect` accepts: a relative path on this origin. The service
 * enforces the same rule (`RETURN_URL_PATTERN`) because the public callback redirects to it — an
 * absolute or protocol-relative URL there is an open redirect.
 */
export const SOCIAL_RETURN_URL_PATTERN = /^\/(?!\/)[^\s]*$/;

export const socialAccountIdSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(SOCIAL_ACCOUNT_ID_PATTERN, "Invalid social account ID; must match soc_<uuid>"),
});

export const initiateSocialConnectSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS, { message: "Unsupported platform" }),
  returnUrl: z
    .string()
    .trim()
    .max(512)
    .regex(SOCIAL_RETURN_URL_PATTERN, "returnUrl must be a relative path on this origin")
    .optional(),
});

/** A `true`/`false` that also accepts the string forms a query string or a form would carry. */
const booleanish = z.preprocess(
  (value) => {
    if (value === "true" || value === true || value === "1" || value === 1) return true;
    if (value === "false" || value === false || value === "0" || value === 0) return false;
    return value;
  },
  z.boolean({ message: "Must be true or false" }),
);

export const listSocialAccountsQuerySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS, { message: "Unsupported platform" }).optional(),
  status: z.enum(SOCIAL_ACCOUNT_STATUSES, { message: "Unknown status filter" }).optional(),
  /** FR-SOC-044's widget: only the accounts that need an operator. */
  attention: booleanish.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
});

export const socialAccountHealthQuerySchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(SOCIAL_ACCOUNT_ID_PATTERN, "Invalid social account ID; must match soc_<uuid>"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * The disconnect confirmation (FR-SOC-012): the operator types the account's platform username.
 * A mismatch is a 422 at the service, and the account is untouched either way — the ceremony
 * exists to make an accident expensive, not to be forgiving.
 */
export const disconnectSocialAccountSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(SOCIAL_ACCOUNT_ID_PATTERN, "Invalid social account ID; must match soc_<uuid>"),
  confirmUsername: z
    .string()
    .trim()
    .min(1, "Type the account's platform username to confirm")
    .max(200),
  reason: z.string().trim().max(500).optional(),
});

/**
 * FR-SOC-011's impact preview. `dryRun` defaults to **true**: the modal calls this first, and a
 * client that forgets to say what it means gets the read, not the destructive write.
 */
export const disconnectImpactSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(SOCIAL_ACCOUNT_ID_PATTERN, "Invalid social account ID; must match soc_<uuid>"),
  dryRun: booleanish.default(true),
});

/** Pause/resume: the reason is optional courtesy metadata for the audit row and the timeline. */
export const socialCollectionActionSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(SOCIAL_ACCOUNT_ID_PATTERN, "Invalid social account ID; must match soc_<uuid>"),
  reason: z.string().trim().max(500).optional(),
});
