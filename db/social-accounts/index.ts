// db/schema/social-accounts/index.ts
//
// Social account connection & health module.
//
// Tables:
//   social_accounts           — OAuth-connected social platform accounts
//   oauth_states              — CSRF protection for OAuth flows
//   social_account_health_log — status change & error history
//   token_refresh_log         — OAuth token refresh audit trail
//
// Design decisions:
//
//   social_account_metrics (time-series follower/engagement data):
//     Moved to shared/analytics.ts → analytics_aggregates.
//     Dimension mapping:
//       dimension_1 = social_account_id
//       dimension_2 = 'social_account'
//       platform    = account's platform
//       metric_name = 'follower_count', 'engagement_rate', 'follower_growth', etc.
//     This avoids maintaining a separate time-series table when
//     analytics_aggregates already handles multi-granularity aggregation.
//
//   Name collision with core module:
//     The original core module had a socialAccounts table for org-level
//     connected accounts. That has been removed from core — this module
//     is the single source of truth for social account connections.
//     If you need to reference a social account from other modules,
//     use social_accounts.id as a plain varchar (not FK).
//
//   No FK to users or organizations:
//     connectedBy, primaryManagerId, disconnectedBy reference user IDs
//     but are not FK constraints. Social account records may outlive
//     the user who connected them (e.g. employee leaves, account stays).
//     organizationId is a plain varchar for the same reason —
//     social account data may need to be retained after org deletion
//     for compliance/audit purposes (see dataRetentionUntil).
//
//   Token encryption:
//     accessTokenEncrypted and refreshTokenEncrypted contain AES-256-GCM
//     encrypted OAuth tokens. The encryption key is managed by the
//     application's secret manager (e.g. AWS KMS, Vault), not in the DB.
//     The application layer encrypts before INSERT and decrypts after SELECT.
//
//   Circuit breaker pattern:
//     When consecutive API errors exceed a threshold (default: 5),
//     circuitBreakerOpen is set to true and circuitBreakerOpenedAt
//     records when it opened. While open, no API calls are attempted.
//     A background worker periodically tries a health check; if it
//     succeeds, the circuit breaker is closed (reset).
//
//   Quota tracking (JSONB):
//     Rather than a separate quota table, quotas are tracked inline:
//     {
//       read:  { limit: 1000, used: 250, resetsAt: '2026-01-01T00:00:00Z' },
//       write: { limit: 100,  used: 42,  resetsAt: '2026-01-01T00:00:00Z' }
//     }
//     This is sufficient because quota data is small, read/written together,
//     and doesn't need relational querying. The application layer
//     increments `used` on each API call and checks against `limit`.
//
//   Health log & token refresh log:
//     Both are append-only event logs with short retention (30–90 days).
//     They are NOT audit logs — they track operational health, not
//     user actions. Audit events for social account operations
//     (connect, disconnect, settings change) go to shared/audit.ts.
//
//   oauth_states:
//     Ephemeral CSRF protection for OAuth authorization flows.
//     Each row lives for ~10 minutes (expiresAt). After the OAuth
//     callback consumes it (usedAt is set), it's eligible for cleanup.
//     Retained for 24 hours after use for debugging, then deleted.
//
//   Concurrency:
//     social_accounts is mutated by many background processes
//     (sync worker, token refresh, health check, circuit breaker reset).
//     All writers MUST use optimistic locking via the `version` column
//     to prevent silent overwrites.

import { desc, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import {
  apiQuotaStatusEnum,
  platformEnum,
  socialAccountStatusEnum,
  socialAccountTypeEnum,
  tokenRefreshTriggerEnum,
} from "../shared/enums";

// =============================================================================
// SOCIAL ACCOUNTS
// =============================================================================

/**
 * OAuth-connected social platform accounts.
 *
 * One row per (organization, platform, platformUserId) — a single
 * real-world social account connected to one organization. If two
 * orgs connect the same Instagram account, there are two rows.
 *
 * Connection flow:
 *   1. User clicks "Connect Instagram" → oauth_states row created
 *   2. User is redirected to platform OAuth consent screen
 *   3. Platform redirects back with auth code → callback handler
 *   4. Application exchanges code for tokens, creates this row
 *   5. Background worker starts syncing profile data & metrics
 *
 * Disconnection:
 *   Setting status = 'disconnected' and disconnectedAt = NOW().
 *   Tokens are wiped (set to NULL) immediately on disconnect.
 *   The account data is retained until dataRetentionUntil, then
 *   deleted by the retention worker.
 *
 * Token refresh:
 *   Most platforms issue tokens that expire (1 hour for Google/YouTube,
 *   60 days for Instagram/Facebook). A background worker proactively
 *   refreshes tokens before they expire. Each refresh attempt is
 *   recorded in token_refresh_log for debugging.
 *
 * syncFrequency:
 *   How often (in seconds) the sync worker should pull fresh data
 *   from the platform API for this account. Default: 300 (5 minutes).
 *   Can be adjusted per account based on plan tier or activity level.
 *
 * Concurrency:
 *   Multiple background processes mutate this row concurrently:
 *     - Sync worker (metrics, profile data)
 *     - Token refresh worker
 *     - Health check worker
 *     - Circuit breaker worker
 *     - Quota reset worker
 *   All writers MUST use optimistic locking via the `version` column:
 *     UPDATE social_accounts SET ..., version = version + 1
 *     WHERE id = $id AND version = $currentVersion
 *   Prevents silent overwrites when two workers touch the same row.
 */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // Not FK — social account may outlive the org (retention period)
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // ─── Platform Identity ────────────────────────────────────────────────────
    platform: platformEnum("platform").notNull(),
    platformUserId: varchar("platform_user_id", { length: 255 }).notNull(),
    platformUsername: varchar("platform_username", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 100 }),
    profileImageUrl: text("profile_image_url"),
    accountType: socialAccountTypeEnum("account_type"),
    platformUrl: text("platform_url"),
    bio: text("bio"),
    verified: boolean("verified").default(false).notNull(),

    // ─── Metrics (latest snapshot) ────────────────────────────────────────────
    // Historical time-series in analytics_aggregates:
    //   dimension_1 = this account's id
    //   dimension_2 = 'social_account'
    //   platform    = this account's platform
    followerCount: integer("follower_count").default(0).notNull(),
    followingCount: integer("following_count").default(0),
    postCount: integer("post_count").default(0),
    // e.g. 0.0342 = 3.42%
    engagementRate: decimal("engagement_rate", { precision: 6, scale: 4 }),

    // ─── OAuth Tokens (AES-256-GCM encrypted at rest) ─────────────────────────
    // NULL = disconnected or not yet connected
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    tokenLastRefreshedAt: timestamp("token_last_refreshed_at", {
      withTimezone: true,
    }),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: socialAccountStatusEnum("status").default("active").notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // ─── Connection ───────────────────────────────────────────────────────────
    // Not FK — user who connected may leave the org
    connectedBy: varchar("connected_by", { length: 32 }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    primaryManagerId: varchar("primary_manager_id", { length: 32 }),
    teamIds: text("team_ids").array(),

    // ─── Sync & Health ────────────────────────────────────────────────────────
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: varchar("last_sync_status", { length: 20 }),
    syncFrequency: integer("sync_frequency").default(300).notNull(),

    // ─── Error Tracking ───────────────────────────────────────────────────────
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),
    lastErrorCode: varchar("last_error_code", { length: 50 }),
    consecutiveErrorCount: integer("consecutive_error_count").default(0).notNull(),

    // ─── Circuit Breaker ──────────────────────────────────────────────────────
    circuitBreakerOpen: boolean("circuit_breaker_open").default(false).notNull(),
    circuitBreakerOpenedAt: timestamp("circuit_breaker_opened_at", {
      withTimezone: true,
    }),

    // ─── API Quota Tracking ───────────────────────────────────────────────────
    // {
    //   read:  { limit: 1000, used: 250, resetsAt: '...' },
    //   write: { limit: 100,  used: 42,  resetsAt: '...' }
    // }
    quotaTracking: jsonb("quota_tracking").default({}).notNull(),
    quotaStatus: varchar("quota_status", { length: 20 }).default("healthy").notNull(),

    // ─── Disconnection ────────────────────────────────────────────────────────
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    disconnectedBy: varchar("disconnected_by", { length: 32 }),
    disconnectionReason: text("disconnection_reason"),
    // Data retention deadline — after this date, the retention worker
    // deletes all data associated with this social account
    dataRetentionUntil: timestamp("data_retention_until", {
      withTimezone: true,
    }),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    tags: text("tags").array(),
    notes: text("notes"),
    customFields: jsonb("custom_fields"),

    // ─── Concurrency ─────────────────────────────────────────────────────────
    // Optimistic locking counter — see JSDoc above.
    version: integer("version").default(1).notNull(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // One account per (org, platform, platformUserId)
    unique("uq_sa_org_platform_user").on(
      table.organizationId,
      table.platform,
      table.platformUserId,
    ),

    // version must be positive
    check("chk_sa_version", sql`${table.version} >= 1`),

    // followerCount must be non-negative
    check("chk_sa_follower_count", sql`${table.followerCount} >= 0`),

    // followingCount / postCount must be non-negative when set
    check(
      "chk_sa_following_count",
      sql`${table.followingCount} IS NULL
        OR ${table.followingCount} >= 0`,
    ),
    check(
      "chk_sa_post_count",
      sql`${table.postCount} IS NULL
        OR ${table.postCount} >= 0`,
    ),

    // consecutiveErrorCount must be non-negative
    check("chk_sa_consecutive_error_count", sql`${table.consecutiveErrorCount} >= 0`),

    // syncFrequency must be at least 60 seconds
    check("chk_sa_sync_frequency_min", sql`${table.syncFrequency} >= 60`),

    // engagementRate must be 0-1 when set
    check(
      "chk_sa_engagement_rate",
      sql`${table.engagementRate} IS NULL
        OR ${table.engagementRate} BETWEEN 0 AND 1`,
    ),

    // circuitBreakerOpenedAt required when circuitBreakerOpen is true
    check(
      "chk_sa_circuit_breaker_consistency",
      sql`NOT (
        ${table.circuitBreakerOpen} = TRUE
        AND ${table.circuitBreakerOpenedAt} IS NULL
      )`,
    ),

    // disconnectedAt ↔ disconnectedBy must be set together
    check(
      "chk_sa_disconnection_consistency",
      sql`(${table.disconnectedAt} IS NULL)
        = (${table.disconnectedBy} IS NULL)`,
    ),

    // Disconnection ordering: disconnectedAt >= connectedAt
    check(
      "chk_sa_disconnected_after_connected",
      sql`${table.disconnectedAt} IS NULL
        OR ${table.disconnectedAt} >= ${table.connectedAt}`,
    ),

    // dataRetentionUntil must be after disconnectedAt when set
    check(
      "chk_sa_retention_after_disconnect",
      sql`${table.dataRetentionUntil} IS NULL
        OR ${table.disconnectedAt} IS NULL
        OR ${table.dataRetentionUntil} > ${table.disconnectedAt}`,
    ),

    // Status consistency: disconnected → disconnectedAt must be set
    check(
      "chk_sa_status_disconnected",
      sql`${table.status} <> 'disconnected'
        OR ${table.disconnectedAt} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Org's accounts — "show me all connected accounts for org X"
    index("idx_sa_org").on(table.organizationId),

    // Status filter
    index("idx_sa_status").on(table.organizationId, table.status),

    // Platform filter
    index("idx_sa_platform").on(table.organizationId, table.platform),

    // Sync worker — accounts due for sync
    index("idx_sa_sync")
      .on(table.lastSyncAt, table.syncFrequency)
      .where(sql`${table.status} = 'active' AND ${table.isActive} = TRUE`),

    // Token refresh worker
    index("idx_sa_token_expiry")
      .on(table.tokenExpiresAt)
      .where(
        sql`${table.status} = 'active'
          AND ${table.tokenExpiresAt} IS NOT NULL`,
      ),

    // Circuit breaker check
    index("idx_sa_circuit_breaker")
      .on(table.circuitBreakerOpenedAt)
      .where(sql`${table.circuit_breaker_open} = TRUE`),

    // Connection attribution
    index("idx_sa_connected_by").on(table.connectedBy),

    // Manager lookup
    index("idx_sa_manager")
      .on(table.primaryManagerId)
      .where(sql`${table.primaryManagerId} IS NOT NULL`),

    // Data retention cleanup
    index("idx_sa_retention")
      .on(table.dataRetentionUntil)
      .where(
        sql`${table.status} = 'disconnected'
          AND ${table.dataRetentionUntil} IS NOT NULL`,
      ),

    // Recently connected — onboarding dashboard
    index("idx_sa_recent_connected").on(table.organizationId, desc(table.connectedAt)),

    // Quota health monitoring
    index("idx_sa_quota_status")
      .on(table.organizationId)
      .where(sql`${table.quotaStatus} <> 'healthy'`),
  ],
);

// =============================================================================
// OAUTH STATES
// =============================================================================

/**
 * CSRF protection for OAuth authorization flows.
 *
 * Lifecycle (very short — ~10 minutes):
 *   1. User clicks "Connect Instagram"
 *   2. Application generates a random state string, creates this row,
 *      and redirects the user to the platform's OAuth consent screen
 *      with state= in the URL
 *   3. Platform redirects back to our callback URL with state=
 *   4. Callback handler looks up this row by ID (= the state string),
 *      verifies it hasn't expired or been used, and processes the auth code
 *   5. Row is marked as used (usedAt = NOW())
 *   6. Cleanup worker deletes rows older than 24 hours
 *
 * The ID IS the state parameter — it's a random 128-char string,
 * not a 32-char nanoid like other tables. This is intentional:
 * the state must be unpredictable and long enough to prevent brute-force.
 *
 * stateData:
 *   Application-specific data to carry through the OAuth round-trip:
 *   { reconnecting: true, existingAccountId: '...' }
 *   { invitedTeamId: '...' }
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    // The state parameter itself — 128-char random string
    id: varchar("id", { length: 128 }).primaryKey(),

    // Not FK — state may outlive very briefly during a race condition
    organizationId: varchar("organization_id", { length: 32 }).notNull(),

    // Not FK — the user who initiated the OAuth flow
    userId: varchar("user_id", { length: 32 }).notNull(),

    // Which platform the OAuth flow is for
    platform: platformEnum("platform").notNull(),

    // Where to redirect after successful connection
    returnUrl: text("return_url"),

    // Application-specific data for the round-trip
    stateData: jsonb("state_data"),

    // When this state expires (default: NOW() + 10 minutes)
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // When the callback handler consumed this state — NULL = unused
    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // expiresAt must be after createdAt
    check("chk_os_expires_after_created", sql`${table.expiresAt} > ${table.createdAt}`),

    // usedAt must be at or before expiresAt
    check(
      "chk_os_used_before_expires",
      sql`${table.usedAt} IS NULL
        OR ${table.usedAt} <= ${table.expiresAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Expiry cleanup — delete states older than 24 hours
    index("idx_os_expires").on(table.expiresAt),

    // Platform filter — debugging pending OAuth flows
    index("idx_os_platform").on(table.platform, desc(table.createdAt)),

    // User's pending flows — cancel user Y's pending OAuth flow
    index("idx_os_user")
      .on(table.userId, desc(table.createdAt))
      .where(sql`${table.usedAt} IS NULL`),
  ],
);

// =============================================================================
// SOCIAL ACCOUNT HEALTH LOG
// =============================================================================

/**
 * Append-only log of status changes and health check results.
 *
 * Purpose:
 *   Operational health monitoring, NOT audit logging.
 *   "When did this account go into error state?"
 *   "How long was this account down?"
 *   "What was the API latency trend over the last hour?"
 *
 * Audit events (connect, disconnect, settings change) go to
 * shared/audit.ts audit_log with sourceModule = 'social_accounts'.
 *
 * Retention:
 *   30 days (configurable via data_retention_policies).
 *   High-volume table — one row per health check per account.
 *   At 5-minute intervals per account, ~8,600 rows/month/account.
 *
 * Status change detection:
 *   previousStatus + status shows transitions:
 *   active → error: API call failed
 *   error → active: recovery
 *   active → needs_reauth: token refresh failed
 *   needs_reauth → active: user re-authenticated
 *
 * Append-only:
 *   No updatedAt. The only mutable aspect is the FK to the parent
 *   row (CASCADE on delete), so the row is logically immutable.
 */
export const socialAccountHealthLog = pgTable(
  "social_account_health_log",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // FK to social_accounts — CASCADE on delete
    socialAccountId: varchar("social_account_id", { length: 32 })
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),

    // Current status after this check
    status: varchar("status", { length: 20 }).notNull(),

    // Status before this check — NULL for the first check
    previousStatus: varchar("previous_status", { length: 20 }),

    // Error details (if status is error/needs_reauth)
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 50 }),

    // Diagnostic data — platform-specific error response body, headers
    diagnosticData: jsonb("diagnostic_data"),

    // API response time in milliseconds (NULL if the call was not attempted)
    apiLatency: integer("api_latency"),

    // Whether the health check API call succeeded
    apiSuccess: boolean("api_success"),

    // HTTP status code from the platform API (200, 401, 429, etc.)
    httpStatusCode: integer("http_status_code"),

    // Which API endpoint was checked e.g. '/me', '/media'
    endpoint: varchar("endpoint", { length: 255 }),

    // Append-only — no updatedAt
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // apiLatency must be non-negative (if set)
    check("chk_sahl_api_latency", sql`${table.apiLatency} IS NULL OR ${table.apiLatency} >= 0`),

    // httpStatusCode must be a valid HTTP status (100-599)
    check(
      "chk_sahl_http_status",
      sql`${table.httpStatusCode} IS NULL
        OR ${table.httpStatusCode} BETWEEN 100 AND 599`,
    ),

    // status transition: previousStatus must differ from status when both set
    // (a row that records "status didn't change" is not a transition event)
    check(
      "chk_sahl_transition_differs",
      sql`${table.previousStatus} IS NULL
        OR ${table.previousStatus} <> ${table.status}`,
    ),

    // errorMessage required when status indicates error
    check(
      "chk_sahl_error_consistency",
      sql`${table.status} NOT IN ('error', 'needs_reauth')
        OR ${table.errorMessage} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Account health timeline — "show me status history for account X"
    index("idx_sahl_account").on(table.socialAccountId, desc(table.checkedAt)),

    // Status filter — "show me all error events across all accounts"
    index("idx_sahl_status").on(table.status, desc(table.checkedAt)),

    // Status transitions — "show me when accounts transitioned to error"
    index("idx_sahl_transition")
      .on(table.socialAccountId, desc(table.checkedAt))
      .where(
        sql`${table.previousStatus} IS NOT NULL
          AND ${table.previousStatus} <> ${table.status}`,
      ),

    // Retention cleanup — delete rows older than 30 days
    index("idx_sahl_cleanup").on(table.checkedAt),

    // Latency monitoring — find slow API responses
    index("idx_sahl_latency")
      .on(table.apiLatency, desc(table.checkedAt))
      .where(sql`${table.apiLatency} IS NOT NULL`),
  ],
);

// =============================================================================
// TOKEN REFRESH LOG
// =============================================================================

/**
 * Append-only log of every OAuth token refresh attempt.
 *
 * Purpose:
 *   Debugging token refresh failures and monitoring refresh patterns.
 *   "Why did this account's token stop working?"
 *   "How often are we hitting rate limits during token refresh?"
 *
 * Retention:
 *   90 days (configurable via data_retention_policies).
 *   Lower volume than health_log — only one row per refresh attempt,
 *   and most accounts refresh tokens once per hour or less.
 *
 * triggeredBy:
 *   proactive       — scheduled refresh before token expiry
 *   on_demand       — refresh triggered by a 401 response during normal API use
 *   error_recovery  — refresh after the circuit breaker closes
 *   scheduled       — refresh triggered by the periodic refresh worker
 *
 * Token rotation:
 *   Some platforms (Instagram, Facebook) issue new refresh tokens on
 *   each refresh. The application layer replaces the encrypted refresh
 *   token in social_accounts after a successful refresh. This log
 *   records the old and new token expiry timestamps for debugging.
 *
 * Append-only:
 *   No updatedAt. Same rationale as health_log.
 */
export const tokenRefreshLog = pgTable(
  "token_refresh_log",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // FK to social_accounts — CASCADE on delete
    socialAccountId: varchar("social_account_id", { length: 32 })
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),

    // Whether the refresh succeeded
    success: boolean("success").notNull(),

    // Error details (if success = false)
    failureReason: text("failure_reason"),
    failureCode: varchar("failure_code", { length: 50 }),

    // HTTP status code from the token refresh endpoint
    httpStatusCode: integer("http_status_code"),

    // What triggered this refresh attempt
    triggeredBy: tokenRefreshTriggerEnum("triggered_by").notNull(),

    // When the old token was due to expire
    oldTokenExpiry: timestamp("old_token_expiry", { withTimezone: true }),

    // When the new token expires (NULL if refresh failed)
    newTokenExpiry: timestamp("new_token_expiry", { withTimezone: true }),

    // How long the refresh request took (seconds)
    refreshDuration: integer("refresh_duration"),

    // Whether a new refresh token was also issued (token rotation)
    newRefreshTokenIssued: boolean("new_refresh_token_issued").default(false).notNull(),

    // How many times this refresh was retried before this attempt
    retryCount: integer("retry_count").default(0).notNull(),

    // Append-only — no updatedAt
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    // refreshDuration must be non-negative (if set)
    check(
      "chk_trl_refresh_duration",
      sql`${table.refreshDuration} IS NULL
        OR ${table.refreshDuration} >= 0`,
    ),

    // retryCount must be non-negative
    check("chk_trl_retry_count", sql`${table.retryCount} >= 0`),

    // failureReason required when success is false
    check(
      "chk_trl_failure_reason_required",
      sql`NOT (
        ${table.success} = FALSE
        AND ${table.failureReason} IS NULL
      )`,
    ),

    // httpStatusCode valid range
    check(
      "chk_trl_http_status",
      sql`${table.httpStatusCode} IS NULL
        OR ${table.httpStatusCode} BETWEEN 100 AND 599`,
    ),

    // newRefreshTokenIssued implies success (failed refreshes never issue new tokens)
    check(
      "chk_trl_rotation_implies_success",
      sql`${table.newRefreshTokenIssued} = FALSE
        OR ${table.success} = TRUE`,
    ),

    // newTokenExpiry implies success (failed refreshes don't produce new tokens)
    check(
      "chk_trl_new_expiry_implies_success",
      sql`${table.newTokenExpiry} IS NULL
        OR ${table.success} = TRUE`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────

    // Account refresh history
    index("idx_trl_account").on(table.socialAccountId, desc(table.refreshedAt)),

    // Failure investigation — recent failed refreshes
    index("idx_trl_failures").on(desc(table.refreshedAt)).where(sql`${table.success} = FALSE`),

    // Trigger analysis — on_demand vs proactive refreshes
    index("idx_trl_trigger").on(table.triggeredBy, desc(table.refreshedAt)),

    // Retention cleanup
    index("idx_trl_cleanup").on(table.refreshedAt),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const socialAccountsRelations = relations(socialAccounts, ({ many }) => ({
  // Operational health history (append-only, short retention)
  healthLogs: many(socialAccountHealthLog, {
    relationName: "socialAccount_healthLogs",
  }),

  // Token refresh history (append-only, medium retention)
  tokenRefreshLogs: many(tokenRefreshLog, {
    relationName: "socialAccount_tokenRefreshLogs",
  }),

  // Time-series metrics are in analytics_aggregates:
  //   dimension_1 = social_account.id
  //   dimension_2 = 'social_account'
  //   Joined at application layer, not via Drizzle relations.
}));

export const oauthStatesRelations = relations(oauthStates, (_) => ({
  // organizationId and userId reference core module — no FK
  // platform matches social_accounts.platform but is not a FK
}));

export const socialAccountHealthLogRelations = relations(socialAccountHealthLog, ({ one }) => ({
  socialAccount: one(socialAccounts, {
    fields: [socialAccountHealthLog.socialAccountId],
    references: [socialAccounts.id],
    relationName: "socialAccount_healthLogs",
  }),
}));

export const tokenRefreshLogRelations = relations(tokenRefreshLog, ({ one }) => ({
  socialAccount: one(socialAccounts, {
    fields: [tokenRefreshLog.socialAccountId],
    references: [socialAccounts.id],
    relationName: "socialAccount_tokenRefreshLogs",
  }),
}));
