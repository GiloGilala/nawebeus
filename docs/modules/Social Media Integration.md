# Module 3: Social Media Integration

**Document Version:** 1.0.0
**Last Updated:** 2026-07-22
**Status:** Active
**Owner:** Product Lead + Engineering Lead

---

## 1. Overview

### 1.1 Module Description

The Social Media Integration module serves as the **foundational data pipeline** for the Nawebeus platform. It enables secure connections to social media platforms and orchestrates data collection, synchronization, token lifecycle management, and error recovery across all connected accounts. It provides the critical integration layer that feeds real-time and historical social data to all other platform modules — Growth & Giveaways, Social Listening, Media Monitoring, Engagement Hub, and Analytics & Reporting — while enforcing multi-tenant data isolation, platform compliance, and subscription plan limits.

This module is the trust layer between Nawebeus and the social platforms it integrates with. Without it, no other module has data to operate on.

### 1.2 Module Objectives

| Objective | Description | Success Metric |
|-----------|-------------|----------------|
| **Secure OAuth Connections** | Enable secure, organization-scoped connections to social platforms | 99.9% successful connection rate; zero token leaks |
| **Reliable Data Collection** | Collect social data consistently within defined polling intervals | 95% of mentions appear within polling interval + 1 minute |
| **API Quota Management** | Operate within platform API limits without degrading the user experience | Operate within 80% of all platform API limits under normal load |
| **Account Health Monitoring** | Proactively detect and surface account issues | 100% of accounts monitored; issues detected within 5 minutes |
| **Multi-Tenant Isolation** | Ensure zero cross-organization data leakage | Zero data leakage incidents |
| **Platform Compliance** | Maintain full compliance with each platform's terms of service | Zero ToS violations |
| **Token Lifecycle Management** | Prevent disruption from token expiry | Tokens refreshed 1 hour before expiry; expiry detected within 5 minutes |

### 1.3 Module Scope

**In Scope:**
- OAuth 2.0 connection flow for 5 platforms: YouTube, X (Twitter), Instagram, Facebook, Reddit
- Account disconnection, pausing, resuming, and reconnection management
- Token refresh, re-authentication, and lifecycle management
- Social account limit enforcement per subscription plan
- Platform API rate limit and quota management with priority queuing
- Social account health and status monitoring with proactive alerting
- Platform-specific data collection strategies and scheduling
- API error classification, retry logic, and circuit breaker management
- Cross-module data flow integration

**Out of Scope (Future Phases):**
- LinkedIn, TikTok, Pinterest integrations — Phase 7 (Q3 2027)
- Threads and Bluesky integrations — Phase 7+ (Q3 2027+)
- Advanced per-platform analytics — Phase 4 (Q4 2026)
- Paid advertising management — Phase 14 (Year 3)
- Influencer discovery — Phase 10 (Q2 2028)

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Chidi** | Head of Marketing | Oversight of connected accounts, quota monitoring |
| **Bola** | Social Media Manager | Connecting accounts, monitoring sync status |
| **Ifeoma** | Agency Owner | Multi-client account management |
| **Sam** | System Admin | Platform health, re-authentication, bulk operations |

### 1.5 Dependencies

| Dependency | Module | Purpose |
|------------|--------|---------|
| **Authentication & User Management** | MOD-001 | Authenticated user context for OAuth flows |
| **Organization & Account Management** | MOD-008 | RBAC enforcement, subscription plan limits |
| **Growth & Giveaways** | MOD-004 | Social account validation for entry verification |
| **Social Listening** | MOD-005 | Mention and keyword data collection |
| **Media Monitoring** | MOD-006 | Cross-platform data aggregation |
| **Engagement Hub** | MOD-007 | Message and comment aggregation |
| **Analytics & Reporting** | MOD-004 | Social performance metrics |
| **Notifications & Alerts** | MOD-009 | Account health alerts and re-auth notifications |

---

## 2. User Stories

### 2.1 Primary User Stories (P0 — Must Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-SOC-001** | As an Admin or Manager, I want to connect my organization's YouTube account so I can collect video comments and analytics. | P0 | Connection completes within 30 seconds; account appears in list immediately |
| **US-SOC-002** | As an Admin or Manager, I want to connect my organization's X (Twitter) account so I can monitor mentions and engage with replies. | P0 | Connection completes within 30 seconds; account appears in list immediately |
| **US-SOC-003** | As an Admin or Manager, I want to connect my organization's Instagram Business account so I can manage comments and messages. | P0 | Business/Creator account requirement clearly communicated |
| **US-SOC-004** | As an Admin or Manager, I want to connect my organization's Facebook Page so I can collect page engagement data. | P0 | Page-level permissions confirmed; personal profile data never accessed |
| **US-SOC-005** | As an Admin or Manager, I want to connect my organization's Reddit account so I can monitor brand mentions in subreddits. | P0 | Connection completes; polling-only limitation communicated |
| **US-SOC-006** | As a user, I want to see all connected social accounts in one place so I can quickly assess the status of my integrations. | P0 | All accounts with status, last sync time, and follower count visible |
| **US-SOC-007** | As a user, I want to see account status (Active, Error, Needs Re-auth, Paused) so I can identify and resolve issues quickly. | P0 | Status updates within 5 minutes of any issue occurring |
| **US-SOC-008** | As a user, I want to be notified when an account needs re-authentication so I can restore data collection before it lapses. | P0 | Notification sent within 10 minutes of token expiry detection |

### 2.2 Secondary User Stories (P1 — Should Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-SOC-009** | As an Admin, I want to disconnect a social account with a clear impact analysis so I can make an informed decision before proceeding. | P1 | Impact analysis shows affected campaigns, keywords, and scheduled posts |
| **US-SOC-010** | As an Admin, I want to pause a social account temporarily so I can stop data collection without losing the connection. | P1 | Pause stops collection immediately; resume restores within 60 seconds |
| **US-SOC-011** | As an Admin, I want to assign a Primary Manager to each social account so responsibility is clearly defined. | P1 | Primary Manager receives all re-auth and error alerts for that account |
| **US-SOC-012** | As an Admin, I want to view real-time API usage per platform so I can manage quota before limits are hit. | P1 | Usage shown as percentage and absolute figures with reset timer |
| **US-SOC-013** | As a user, I want the system to automatically retry failed API requests so temporary errors don't interrupt my workflow. | P1 | Exponential backoff with 3 attempts; auto-recovery logged |
| **US-SOC-014** | As an Admin, I want new comments to appear in the Engagement Hub within 15 minutes so my team can respond promptly. | P1 | Comments appear within platform polling interval + 1 minute |

### 2.3 Tertiary User Stories (P2 — Nice to Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-SOC-015** | As an Admin, I want to re-authenticate all accounts at once so I don't have to manage each one individually. | P2 | Bulk re-auth initiates for all Needs Re-auth accounts; results reported |
| **US-SOC-016** | As an Admin, I want to see diagnostic information for account issues so I can understand the root cause and resolve it faster. | P2 | Diagnostic panel shows last error, error frequency, and recommended action |
| **US-SOC-017** | As a user, I want to see when quota resets for each platform so I can plan data collection activities accordingly. | P2 | Reset countdown timer accurate to the minute per platform |

---

## 3. Functional Requirements

### 3.1 OAuth Connection Flow

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-001** | System shall support OAuth 2.0 with PKCE for YouTube, X, Instagram, Facebook, and Reddit | P0 | Platform-specific scopes enforced |
| **FR-SOC-002** | System shall generate and validate a CSRF state parameter for every OAuth initiation | P0 | State expires in 10 minutes |
| **FR-SOC-003** | System shall store all access and refresh tokens encrypted at rest using AES-256 | P0 | Keys managed via AWS KMS or equivalent |
| **FR-SOC-004** | System shall prevent duplicate connections: same platform account cannot be connected to the same organization twice | P0 | Returns `ACCOUNT_ALREADY_CONNECTED` error |
| **FR-SOC-005** | System shall scope all social account connections to the organization, not the individual connecting user | P0 | Supports team collaboration |
| **FR-SOC-006** | System shall fetch and store account metadata on connection: username, display name, profile image, follower count | P0 | Displayed in account list |
| **FR-SOC-007** | System shall trigger an initial data sync immediately after successful connection | P0 | Sync runs in background |
| **FR-SOC-008** | System shall notify all organization Admins via email when a new account is connected | P1 | Sent within 5 minutes |
| **FR-SOC-009** | System shall display clear permission explanations during the OAuth consent step | P1 | "Why we need this" per scope |
| **FR-SOC-010** | System shall handle partial permission grants gracefully with clear communication of degraded functionality | P1 | Warns user of missing capabilities |

### 3.2 Account Disconnection & Management

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-011** | System shall perform an impact analysis before disconnection, showing affected campaigns, listening keywords, and scheduled posts | P0 | Displayed in confirmation modal |
| **FR-SOC-012** | System shall require Admin to confirm disconnection by typing the account username | P0 | Prevents accidental disconnection |
| **FR-SOC-013** | System shall immediately revoke OAuth tokens with the platform upon disconnection | P0 | Revocation API called synchronously |
| **FR-SOC-014** | System shall retain disconnected account data in read-only mode for 90 days | P0 | Historical badge shown in UI |
| **FR-SOC-015** | System shall archive disconnected data to compressed storage after 90 days | P1 | Available via support request for up to 1 year |
| **FR-SOC-016** | System shall support account pausing: stops data collection while preserving connection and historical data | P1 | Resume available without re-authentication |
| **FR-SOC-017** | System shall support resume with data backfill for up to 24 hours of missed activity | P1 | Backfill runs as background job |
| **FR-SOC-018** | System shall support bulk operations: pause, resume, re-authenticate for up to 50 accounts | P2 | Confirmation required per operation type |

### 3.3 Token Lifecycle Management

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-019** | System shall proactively refresh tokens 1 hour before expiration | P0 | Background job runs every 5 minutes |
| **FR-SOC-020** | System shall detect expired or invalid tokens within 5 minutes of expiry | P0 | Proactive monitoring independent of API calls |
| **FR-SOC-021** | System shall automatically attempt token refresh using the refresh token before marking an account as Needs Re-auth | P0 | Single retry attempt |
| **FR-SOC-022** | System shall mark accounts as "Needs Re-authentication" when refresh fails and notify the Primary Manager and all Admins | P0 | Notification within 10 minutes |
| **FR-SOC-023** | System shall never expose tokens in API responses, logs, or error messages | P0 | Security requirement |
| **FR-SOC-024** | System shall log all token refresh attempts (success and failure) with organization and account context | P1 | Retained for security audit |
| **FR-SOC-025** | System shall support token rotation on sensitive operations: posting, sending DMs | P2 | Additional security layer |

### 3.4 Social Account Limit Enforcement

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-026** | System shall enforce per-plan social account limits in real time | P0 | Checked before every new connection |
| **FR-SOC-027** | System shall display current account usage prominently: "3 of 10 accounts connected (Pro Plan)" | P0 | Shown in account list header |
| **FR-SOC-028** | System shall present an upgrade modal when a connection attempt is blocked by plan limits | P0 | One-click upgrade path |
| **FR-SOC-029** | System shall trigger an account selection workflow on plan downgrade, requiring Admin to choose which accounts remain active | P1 | Excess accounts paused, not deleted |
| **FR-SOC-030** | System shall count accounts across all platforms toward the plan limit (not per-platform) | P0 | Consistent with billing model |

### 3.5 API Rate Limit & Quota Management

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-031** | System shall track API quota consumption per platform in real time | P0 | Displayed in quota dashboard |
| **FR-SOC-032** | System shall apply a priority queue for API requests: Engage actions > real-time mentions > analytics > historical backfill | P0 | Engage actions never blocked by rate limits |
| **FR-SOC-033** | System shall slow non-essential polling when any platform reaches 80% quota utilization | P0 | In-app notification sent at 80% |
| **FR-SOC-034** | System shall pause all non-essential syncing when quota reaches 90% | P1 | Resume immediately after reset |
| **FR-SOC-035** | System shall queue remaining requests and process after quota resets when at 100% | P0 | No data loss |
| **FR-SOC-036** | System shall apply exponential backoff and honor platform Retry-After headers on 429 responses | P0 | Prevents API bans |
| **FR-SOC-037** | System shall allocate quota priority to Pro and Enterprise organizations over Free organizations | P1 | Pro: 2× weight; Enterprise: 5× weight |
| **FR-SOC-038** | System shall alert Admins at 80% and 95% quota utilization per platform | P0 | In-app and email notifications |

### 3.6 Account Health & Status Monitoring

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-039** | System shall run automated health checks every 6 hours using lightweight API calls that do not consume significant quota | P0 | Less than 1% of daily quota |
| **FR-SOC-040** | System shall mark an account as "Error" after 10 consecutive failed API calls | P0 | Also triggers circuit breaker |
| **FR-SOC-041** | System shall update account status within 5 minutes of any health event | P0 | WebSocket push to open sessions |
| **FR-SOC-042** | System shall provide a diagnostic panel per account: last successful call, last error, error frequency, affected features, recommended action | P1 | Actionable troubleshooting |
| **FR-SOC-043** | System shall integrate platform status page monitoring to pause collection during known outages | P1 | Auto-resume when platform restored |
| **FR-SOC-044** | System shall display a dashboard widget summarizing accounts requiring attention | P0 | "X accounts need attention" with one-click actions |

### 3.7 Platform-Specific Data Collection

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-045** | System shall collect YouTube channel statistics hourly and video comments every 15 minutes | P0 | Quota: 10,000 units/day shared |
| **FR-SOC-046** | System shall collect X mentions and keyword data every 5 minutes via polling (real-time streaming for Elevated/Enterprise tier) | P0 | Basic tier: 1,500 tweets/month |
| **FR-SOC-047** | System shall collect Instagram post comments and story mentions every 15 minutes (Business/Creator accounts only) | P0 | Stories expire after 24 hours |
| **FR-SOC-048** | System shall collect Facebook page posts, comments, and Messenger messages every 10 minutes | P0 | Pages with 30+ likes required for insights |
| **FR-SOC-049** | System shall collect Reddit keyword mentions across subreddits every 30 minutes | P0 | Polling only; no streaming |
| **FR-SOC-050** | System shall mark deleted content as "[Deleted]" with historical data preserved | P0 | Never hard-deletes collected content |
| **FR-SOC-051** | System shall deduplicate content arriving from multiple collection cycles using content hash | P1 | Prevents duplicate processing in downstream modules |
| **FR-SOC-052** | System shall handle protected, private, and NSFW content with appropriate user consent and messaging | P1 | NSFW requires additional consent |

### 3.8 API Error Management & Recovery

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-053** | System shall classify API errors: transient (5xx), auth (401), rate limit (429), client (400/403), not found (404) | P0 | Classification drives retry strategy |
| **FR-SOC-054** | System shall apply exponential backoff retry for transient errors: 1s, 2s, 4s (max 3 attempts) with jitter | P0 | Prevents thundering herd |
| **FR-SOC-055** | System shall trigger re-authentication flow immediately on 401 errors | P0 | No retry; escalate directly |
| **FR-SOC-056** | System shall open a circuit breaker after 10 consecutive failures per account, stopping all further requests until manually reset or health-checked | P0 | Prevents cascade failures |
| **FR-SOC-057** | System shall attempt to backfill up to 24 hours of missed data after error recovery | P1 | Background job with low priority |
| **FR-SOC-058** | System shall log all errors with full context: endpoint, HTTP code, response body, organization ID, timestamp, request ID | P0 | 90-day log retention |
| **FR-SOC-059** | System shall escalate to critical and notify support after 24 consecutive hours of failures on any account | P1 | Prevents silent extended outages |

### 3.9 Cross-Module Data Integration

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-SOC-060** | System shall deliver collected comments and DMs to the Engagement Hub within platform-specific polling intervals | P0 | Sub-module SLA |
| **FR-SOC-061** | System shall deliver mentions and keyword matches to the Social Listening module within 15 minutes of collection | P0 | Critical for real-time monitoring |
| **FR-SOC-062** | System shall validate social entry actions (follow, like, share) against live platform data for the Growth & Giveaways module | P0 | Entry verification SLA |
| **FR-SOC-063** | System shall deliver social performance metrics to the Analytics & Reporting module per defined collection intervals | P1 | Data freshness per metric type |
| **FR-SOC-064** | System shall enforce strict multi-tenant isolation: Organization A cannot access Organization B's collected data at any layer | P0 | Zero tolerance; security requirement |
| **FR-SOC-065** | System shall normalize collected data into a consistent internal schema before delivery to downstream modules | P0 | Insulates modules from platform API changes |

---

## 4. Business Rules

### 4.1 Connection Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-SOC-001** | Only Admin and Manager roles can connect social accounts | Prevents unauthorized connections that could consume plan limits |
| **BR-SOC-002** | Social accounts are owned by the organization, not by the individual user who connected them | Enables team collaboration and prevents data loss on user offboarding |
| **BR-SOC-003** | The same platform account cannot be connected to the same organization more than once | Prevents duplicate data collection and quota waste |
| **BR-SOC-004** | Connection attempts are blocked when the organization has reached its plan's account limit | Enforces subscription billing |
| **BR-SOC-005** | Every OAuth flow must include a validated state parameter | CSRF protection |
| **BR-SOC-006** | All OAuth tokens must be encrypted at rest from the moment of receipt | Security baseline |

### 4.2 Data Collection Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-SOC-007** | Data collection polling intervals are platform-specific and non-negotiable | Ensures platform TOS compliance |
| **BR-SOC-008** | Engagement Hub response actions (replies, reactions) are always prioritized over background sync | User-facing actions must never be delayed by background jobs |
| **BR-SOC-009** | Pro and Enterprise organizations receive quota priority over Free organizations during peak periods | Tiered service matching subscription value |
| **BR-SOC-010** | Deleted social content is preserved as "[Deleted]" with its metadata intact | Preserves conversation context and audit trail |
| **BR-SOC-011** | All data collection must comply with each platform's terms of service at all times | Legal compliance; platform access depends on it |
| **BR-SOC-012** | Protected, private, or NSFW content is never stored without explicit user consent | Privacy and compliance |

### 4.3 Token Management Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-SOC-013** | Tokens are refreshed proactively 1 hour before expiration | Prevents disruption to ongoing data collection |
| **BR-SOC-014** | Failed token refresh immediately triggers the re-authentication workflow | Prompt user action prevents extended data gaps |
| **BR-SOC-015** | Token operations are logged in full, excluding the token value itself | Security audit trail without exposing credentials |
| **BR-SOC-016** | Tokens are never included in API responses, error messages, or log entries | Zero token exposure |
| **BR-SOC-017** | Encryption keys are managed via a dedicated KMS; application code never handles raw keys | Security best practice |

### 4.4 Error Handling Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-SOC-018** | Transient errors (5xx) are retried up to 3 times with exponential backoff before surfacing to the user | Resilience against temporary platform instability |
| **BR-SOC-019** | Rate limit responses (429) always respect the platform's Retry-After header | Prevents API bans and maintains platform relationship |
| **BR-SOC-020** | A circuit breaker opens after 10 consecutive failures to prevent cascade failures | Operational resilience |
| **BR-SOC-021** | 24+ hours of consecutive failures escalates automatically to support | Prevents silent extended outages |
| **BR-SOC-022** | All errors are logged with full context: no silent failures | Debugging and operational visibility |

---

## 5. Validation Rules

### 5.1 OAuth State Validation

```typescript
const oauthStateSchema = z.string()
  .min(32, 'State parameter too short — minimum 32 characters')
  .max(128, 'State parameter too long — maximum 128 characters')
  .refine((state) => isValidCsrfState(state), {
    message: 'State parameter validation failed — possible CSRF attempt'
  });
```

**Notes:**
- State must be cryptographically random
- State expires in 10 minutes
- State is single-use: marked as `used_at` on first consumption

### 5.2 Account Metadata Validation

```typescript
const accountMetadataSchema = z.object({
  platform: z.enum(['youtube', 'twitter', 'instagram', 'facebook', 'reddit']),
  platformUserId: z.string().min(1).max(255),
  platformUsername: z.string().min(1).max(100),
  displayName: z.string().max(100),
  profileImageUrl: z.string().url().optional(),
  followerCount: z.number().int().min(0).optional(),
  accountType: z.enum(['personal', 'business', 'creator', 'page']).optional()
});
```

### 5.3 Disconnection Confirmation

```typescript
const disconnectionSchema = z.object({
  accountId: z.string().uuid(),
  confirmationUsername: z.string().min(1),
  reason: z.string().max(500).optional()
}).refine((data) => data.confirmationUsername === data.expectedUsername, {
  message: 'Confirmation does not match the account username',
  path: ['confirmationUsername']
});
```

### 5.4 Bulk Operation Limits

```typescript
const bulkOperationSchema = z.object({
  accountIds: z.array(z.string().uuid())
    .min(1, 'At least one account must be selected')
    .max(50, 'Maximum 50 accounts per bulk operation'),
  operation: z.enum(['pause', 'resume', 'reauth'])
});
```

### 5.5 Quota Tracking Validation

```typescript
const quotaUpdateSchema = z.object({
  platform: z.enum(['youtube', 'twitter', 'instagram', 'facebook', 'reddit']),
  unitsConsumed: z.number().int().min(1),
  requestType: z.string().min(1).max(100),
  organizationId: z.string().uuid()
});
```

---

## 6. Permissions (RBAC)

### 6.1 Permission Definitions

| Permission | Description |
|------------|-------------|
| `social:accounts:read` | View connected accounts, status, and last sync |
| `social:accounts:connect` | Initiate OAuth connection for any platform |
| `social:accounts:disconnect` | Disconnect an account (destructive) |
| `social:accounts:pause` | Pause or resume an account |
| `social:accounts:reauth` | Re-authenticate an account |
| `social:accounts:assign` | Assign Primary Manager to an account |
| `social:diagnostics:read` | View account diagnostic information |
| `social:usage:read` | View API quota and usage dashboard |
| `social:bulk:operate` | Execute bulk pause, resume, or re-auth |

### 6.2 Role Permission Matrix

| Permission | Admin | Manager | Analyst | Viewer |
|------------|:-----:|:-------:|:-------:|:------:|
| `social:accounts:read` | ✅ | ✅ | ✅ | ✅ |
| `social:accounts:connect` | ✅ | ✅ | ❌ | ❌ |
| `social:accounts:disconnect` | ✅ | ❌ | ❌ | ❌ |
| `social:accounts:pause` | ✅ | ✅ | ❌ | ❌ |
| `social:accounts:reauth` | ✅ | ✅ | ❌ | ❌ |
| `social:accounts:assign` | ✅ | ❌ | ❌ | ❌ |
| `social:diagnostics:read` | ✅ | ✅ | ❌ | ❌ |
| `social:usage:read` | ✅ | ✅ | ❌ | ❌ |
| `social:bulk:operate` | ✅ | ✅ | ❌ | ❌ |

### 6.3 API Endpoint Permissions

| Endpoint | Method | Required Permission |
|----------|--------|---------------------|
| `/api/v1/social/accounts` | GET | `social:accounts:read` |
| `/api/v1/social/accounts/{id}` | GET | `social:accounts:read` |
| `/api/v1/social/accounts/{id}` | DELETE | `social:accounts:disconnect` |
| `/api/v1/social/accounts/{id}/pause` | POST | `social:accounts:pause` |
| `/api/v1/social/accounts/{id}/resume` | POST | `social:accounts:pause` |
| `/api/v1/social/accounts/{id}/refresh` | POST | `social:accounts:reauth` |
| `/api/v1/social/accounts/{id}/reauth` | POST | `social:accounts:reauth` |
| `/api/v1/social/accounts/{id}/manager` | PATCH | `social:accounts:assign` |
| `/api/v1/social/accounts/{id}/diagnostics` | GET | `social:diagnostics:read` |
| `/api/v1/social/oauth/{platform}/initiate` | POST | `social:accounts:connect` |
| `/api/v1/social/oauth/{platform}/callback` | GET | Public (state-validated) |
| `/api/v1/social/accounts/bulk/pause` | POST | `social:bulk:operate` |
| `/api/v1/social/accounts/bulk/resume` | POST | `social:bulk:operate` |
| `/api/v1/social/accounts/bulk/reauth` | POST | `social:bulk:operate` |
| `/api/v1/social/usage` | GET | `social:usage:read` |
| `/api/v1/social/health` | GET | `social:usage:read` |

---

## 7. Data Model

### 7.1 Entity: Social Account

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `organization_id` | UUID | FK to organizations | No |
| `platform` | ENUM | `youtube`, `twitter`, `instagram`, `facebook`, `reddit` | No |
| `platform_user_id` | TEXT | Platform-assigned user/page/channel ID | No |
| `platform_username` | TEXT | Handle or username on the platform | No |
| `display_name` | TEXT | Display name shown in UI | Yes |
| `profile_image_url` | TEXT | Profile image URL | Yes |
| `follower_count` | INTEGER | Current follower/subscriber count | Yes |
| `account_type` | TEXT | `personal`, `business`, `creator`, `page` | Yes |
| `status` | ENUM | `active`, `error`, `paused`, `needs_reauth`, `disconnected` | No |
| `access_token_encrypted` | TEXT | AES-256 encrypted access token | No |
| `refresh_token_encrypted` | TEXT | AES-256 encrypted refresh token | Yes |
| `token_expires_at` | TIMESTAMPTZ | Access token expiry timestamp | Yes |
| `scopes` | TEXT[] | Granted OAuth scopes | No |
| `connected_by` | UUID | FK to users — who connected the account | No |
| `connected_at` | TIMESTAMPTZ | Connection timestamp | No |
| `primary_manager_id` | UUID | FK to users — Primary Manager | Yes |
| `last_sync_at` | TIMESTAMPTZ | Most recent successful data collection | Yes |
| `last_error_at` | TIMESTAMPTZ | Most recent error timestamp | Yes |
| `last_error_message` | TEXT | Most recent error message | Yes |
| `consecutive_error_count` | INTEGER | Consecutive failure count (resets on success) | No |
| `circuit_breaker_open` | BOOLEAN | Whether circuit breaker is active | No |
| `disconnected_at` | TIMESTAMPTZ | Disconnection timestamp | Yes |
| `disconnected_by` | UUID | FK to users — who disconnected | Yes |
| `disconnection_reason` | TEXT | Optional reason for disconnection | Yes |
| `data_retention_until` | TIMESTAMPTZ | Date after which data is archived | Yes |
| `created_at` | TIMESTAMPTZ | Record creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('youtube', 'twitter', 'instagram', 'facebook', 'reddit')),
  platform_user_id VARCHAR(255) NOT NULL,
  platform_username VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  profile_image_url TEXT,
  follower_count INTEGER DEFAULT 0,
  account_type VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'error', 'paused', 'needs_reauth', 'disconnected')),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_by UUID NOT NULL REFERENCES users(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  primary_manager_id UUID REFERENCES users(id),
  last_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  consecutive_error_count INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_open BOOLEAN NOT NULL DEFAULT FALSE,
  disconnected_at TIMESTAMPTZ,
  disconnected_by UUID REFERENCES users(id),
  disconnection_reason TEXT,
  data_retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_user_id)
);

CREATE INDEX idx_social_accounts_org ON social_accounts(organization_id);
CREATE INDEX idx_social_accounts_status ON social_accounts(organization_id, status);
CREATE INDEX idx_social_accounts_platform ON social_accounts(organization_id, platform);
CREATE INDEX idx_social_accounts_sync ON social_accounts(last_sync_at) WHERE status = 'active';
CREATE INDEX idx_social_accounts_token_expiry ON social_accounts(token_expires_at)
  WHERE status = 'active' AND token_expires_at IS NOT NULL;
```

### 7.2 Entity: OAuth State

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | TEXT | State value (cryptographically random, 32–128 chars) | No |
| `organization_id` | UUID | FK to organizations | No |
| `user_id` | UUID | FK to users — who initiated the flow | No |
| `platform` | TEXT | Target platform | No |
| `return_url` | TEXT | URL to redirect to after successful connection | Yes |
| `expires_at` | TIMESTAMPTZ | State expiry (10 minutes from creation) | No |
| `used_at` | TIMESTAMPTZ | Timestamp when state was consumed | Yes |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |

```sql
CREATE TABLE oauth_states (
  id VARCHAR(128) PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  platform VARCHAR(20) NOT NULL,
  return_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);
```

### 7.3 Entity: API Quota Tracking

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `organization_id` | UUID | FK to organizations | No |
| `platform` | TEXT | Platform name | No |
| `quota_type` | TEXT | `daily_quota`, `rate_limit_15min`, `hourly_limit` | No |
| `quota_limit` | INTEGER | Total quota for the period | No |
| `quota_used` | INTEGER | Units consumed so far | No |
| `period_start` | TIMESTAMPTZ | Period start time | No |
| `period_end` | TIMESTAMPTZ | Period end time | No |
| `resets_at` | TIMESTAMPTZ | When quota resets | No |
| `status` | ENUM | `healthy`, `warning`, `critical`, `exhausted` | No |
| `last_updated` | TIMESTAMPTZ | Last update timestamp | No |

```sql
CREATE TABLE api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  quota_type VARCHAR(50) NOT NULL,
  quota_limit INTEGER NOT NULL,
  quota_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  resets_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'healthy'
    CHECK (status IN ('healthy', 'warning', 'critical', 'exhausted')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, quota_type, period_start)
);

CREATE INDEX idx_api_quota_org ON api_quota_tracking(organization_id);
CREATE INDEX idx_api_quota_resets ON api_quota_tracking(resets_at);
CREATE INDEX idx_api_quota_status ON api_quota_tracking(status) WHERE status != 'healthy';
```

### 7.4 Entity: Social Account Health Log

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `social_account_id` | UUID | FK to social accounts | No |
| `status` | TEXT | New status after this check | No |
| `previous_status` | TEXT | Status before this check | Yes |
| `error_message` | TEXT | Error message if applicable | Yes |
| `diagnostic_data` | JSONB | Full diagnostic context | Yes |
| `checked_at` | TIMESTAMPTZ | Health check timestamp | No |

```sql
CREATE TABLE social_account_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  previous_status VARCHAR(20),
  error_message TEXT,
  diagnostic_data JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_log_account ON social_account_health_log(social_account_id, checked_at DESC);
```

### 7.5 Entity: Token Refresh Log

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `social_account_id` | UUID | FK to social accounts | No |
| `success` | BOOLEAN | Whether refresh succeeded | No |
| `failure_reason` | TEXT | Failure reason if unsuccessful | Yes |
| `triggered_by` | ENUM | `proactive`, `on_demand`, `error_recovery` | No |
| `refreshed_at` | TIMESTAMPTZ | Attempt timestamp | No |

```sql
CREATE TABLE token_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  triggered_by VARCHAR(20) NOT NULL
    CHECK (triggered_by IN ('proactive', 'on_demand', 'error_recovery')),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_refresh_account ON token_refresh_log(social_account_id, refreshed_at DESC);
```

---

## 8. API Surface

### 8.1 Endpoint: List Social Accounts

```
GET /api/v1/social/accounts
```

**Authorization:** `social:accounts:read`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | STRING | No | Filter: `active`, `error`, `paused`, `needs_reauth`, `disconnected` |
| `platform` | STRING | No | Filter by platform |
| `page` | INTEGER | No | Page number (default: 1) |
| `limit` | INTEGER | No | Items per page (max: 100, default: 20) |

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "soc_9f2a4b1c3d5e6f7a",
        "platform": "instagram",
        "platformUserId": "17841400008460056",
        "platformUsername": "@brandng",
        "displayName": "Brand Nigeria",
        "profileImageUrl": "https://cdn.instagram.com/brand-ng.jpg",
        "followerCount": 48500,
        "accountType": "business",
        "status": "active",
        "connectedBy": {
          "userId": "usr_7e3b5c2a1f4d",
          "name": "Bola Adeleke"
        },
        "connectedAt": "2026-07-01T09:00:00.000Z",
        "primaryManager": {
          "userId": "usr_7e3b5c2a1f4d",
          "name": "Bola Adeleke"
        },
        "lastSyncAt": "2026-07-22T10:15:00.000Z",
        "lastErrorAt": null,
        "consecutiveErrorCount": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    },
    "planUsage": {
      "connected": 5,
      "limit": 10,
      "plan": "pro"
    }
  }
}
```

---

### 8.2 Endpoint: Initiate OAuth Connection

```
POST /api/v1/social/oauth/{platform}/initiate
```

**Authorization:** `social:accounts:connect`

**Path Parameters:** `platform` — one of `youtube`, `twitter`, `instagram`, `facebook`, `reddit`

**Request:**

```json
{
  "returnUrl": "/settings/social-accounts"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=...&scope=...",
    "state": "xK9mP2qR7vN4wL8jT1cB5sA6",
    "expiresAt": "2026-07-22T10:40:00.000Z"
  }
}
```

**Error Responses:**

| HTTP Status | Error Code | Scenario |
|-------------|------------|----------|
| 403 | `ACCOUNT_LIMIT_REACHED` | Organization is at plan limit |
| 400 | `INVALID_PLATFORM` | Platform not supported |
| 400 | `PLATFORM_UNAVAILABLE` | Platform API currently unreachable |

---

### 8.3 Endpoint: Disconnect Account

```
DELETE /api/v1/social/accounts/{account_id}
```

**Authorization:** `social:accounts:disconnect`

**Request:**

```json
{
  "confirmationUsername": "@brandng",
  "reason": "Switching to official business account"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "soc_9f2a4b1c3d5e6f7a",
    "platform": "instagram",
    "status": "disconnected",
    "disconnectedAt": "2026-07-22T10:30:00.000Z",
    "dataRetentionUntil": "2026-10-20T10:30:00.000Z",
    "impact": {
      "activeGiveaways": 2,
      "listeningKeywords": 5,
      "scheduledPosts": 0
    }
  }
}
```

---

### 8.4 Endpoint: Get API Usage

```
GET /api/v1/social/usage
```

**Authorization:** `social:usage:read`

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "platforms": {
      "youtube": {
        "quotaType": "daily_quota",
        "quotaLimit": 10000,
        "quotaUsed": 6500,
        "quotaPercentage": 65,
        "status": "healthy",
        "resetsAt": "2026-07-23T00:00:00.000Z"
      },
      "twitter": {
        "quotaType": "rate_limit_15min",
        "quotaLimit": 300,
        "quotaUsed": 180,
        "quotaPercentage": 60,
        "status": "healthy",
        "resetsAt": "2026-07-22T10:45:00.000Z"
      },
      "instagram": {
        "quotaType": "hourly_limit",
        "quotaLimit": 200,
        "quotaUsed": 190,
        "quotaPercentage": 95,
        "status": "critical",
        "resetsAt": "2026-07-22T11:00:00.000Z"
      },
      "facebook": {
        "quotaType": "hourly_limit",
        "quotaLimit": 200,
        "quotaUsed": 85,
        "quotaPercentage": 42,
        "status": "healthy",
        "resetsAt": "2026-07-22T11:00:00.000Z"
      },
      "reddit": {
        "quotaType": "rate_limit_per_min",
        "quotaLimit": 60,
        "quotaUsed": 12,
        "quotaPercentage": 20,
        "status": "healthy",
        "resetsAt": "2026-07-22T10:31:00.000Z"
      }
    },
    "summary": {
      "accountsWithIssues": 1,
      "platformsNearLimit": 1,
      "platformsAtLimit": 0
    }
  }
}
```

---

### 8.5 Endpoint: Get Account Diagnostics

```
GET /api/v1/social/accounts/{account_id}/diagnostics
```

**Authorization:** `social:diagnostics:read`

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "accountId": "soc_9f2a4b1c3d5e6f7a",
    "platform": "instagram",
    "status": "error",
    "lastSuccessfulSync": "2026-07-22T08:00:00.000Z",
    "lastError": {
      "timestamp": "2026-07-22T10:15:00.000Z",
      "message": "Instagram API returned 503: Service Unavailable",
      "httpCode": 503,
      "consecutiveCount": 4
    },
    "errorFrequency": "4 errors in last 2 hours",
    "circuitBreakerOpen": false,
    "affectedFeatures": [
      "Comment collection paused",
      "Story mention monitoring paused"
    ],
    "recommendedActions": [
      "Check Instagram API status at status.instagram.com",
      "Wait for platform to recover — retrying automatically",
      "Contact support if errors persist for more than 24 hours"
    ],
    "platformStatus": "degraded"
  }
}
```

---

### 8.6 Endpoint: Bulk Operations

```
POST /api/v1/social/accounts/bulk/{operation}
```

**Authorization:** `social:bulk:operate`

**Path Parameters:** `operation` — one of `pause`, `resume`, `reauth`

**Request:**

```json
{
  "accountIds": [
    "soc_9f2a4b1c3d5e6f7a",
    "soc_3b4c5d6e7f8a9b0c"
  ]
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "operation": "pause",
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "results": [
      { "accountId": "soc_9f2a4b1c3d5e6f7a", "status": "paused", "success": true },
      { "accountId": "soc_3b4c5d6e7f8a9b0c", "status": "paused", "success": true }
    ]
  }
}
```

---

## 9. User Interface

### 9.1 Screen: Social Accounts Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ Settings → Social Accounts                    [+ Connect Account]│
├─────────────────────────────────────────────────────────────────────┤
│ Plan Usage: 5 of 10 accounts connected (Pro Plan)  [Upgrade →]     │
├─────────────────────────────────────────────────────────────────────┤
│ ⚠️  1 account needs attention                        [View All →]   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📸 Instagram — @brandng              Status: ✅ Active       │   │
│ │ Brand Nigeria  │  48,500 followers  │  Business Account      │   │
│ │ Last sync: 5 minutes ago  │  Connected by Bola Adeleke       │   │
│ │ [Pause]  [Re-auth]  [Diagnostics]  [Disconnect]              │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 🐦 X (Twitter) — @brandng_official  Status: ✅ Active       │   │
│ │ Brand NG  │  12,400 followers  │  Last sync: 3 minutes ago  │   │
│ │ [Pause]  [Re-auth]  [Diagnostics]  [Disconnect]              │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 📺 YouTube — Brand Nigeria           Status: ⚠️ Needs Re-auth │   │
│ │ 5,200 subscribers  │  Last sync: 6 hours ago                │   │
│ │ Token expired — please re-authenticate to restore collection │   │
│ │ [Re-authenticate Now]  [Diagnostics]  [Disconnect]           │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 📘 Facebook — Brand Nigeria Page    Status: ✅ Active        │   │
│ │ 23,100 followers  │  Last sync: 8 minutes ago               │   │
│ │ [Pause]  [Re-auth]  [Diagnostics]  [Disconnect]              │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 🤖 Reddit — u/brandng               Status: ⏸️ Paused        │   │
│ │ Last sync: 3 days ago  │  Paused by Chidi Okonkwo           │   │
│ │ [Resume]  [Diagnostics]  [Disconnect]                        │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Screen: Connect Account Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Connect Social Account                                        [✕]  │
├─────────────────────────────────────────────────────────────────────┤
│ Select a Platform                                                   │
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│ │ 📸          │ │ 🐦          │ │ 📺          │                   │
│ │ Instagram   │ │ X (Twitter) │ │ YouTube     │                   │
│ │ Business or │ │             │ │             │                   │
│ │ Creator     │ │             │ │             │                   │
│ └─────────────┘ └─────────────┘ └─────────────┘                   │
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐                                    │
│ │ 📘          │ │ 🤖          │                                    │
│ │ Facebook    │ │ Reddit      │                                    │
│ │ Page only   │ │             │                                    │
│ └─────────────┘ └─────────────┘                                    │
│                                                                     │
│ ℹ️  You will be redirected to the platform to grant permissions.   │
│    Connections are owned by your organization, not your account.   │
│                                                                     │
│ Plan Usage: 5 of 10 accounts (Pro Plan)                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 Screen: Disconnection Impact Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Disconnect Instagram @brandng?                             [✕]  │
├─────────────────────────────────────────────────────────────────────┤
│ This action will affect the following:                              │
│                                                                     │
│ 🏆 Active Giveaways:       2 campaigns will lose entry verification│
│ 🔍 Listening Keywords:     5 keywords will stop monitoring         │
│ 📅 Scheduled Posts:        0 posts affected                        │
│ 💬 Open Conversations:     12 open threads will become read-only   │
│                                                                     │
│ Historical data retained in read-only mode until: 2026-10-20      │
│ Reconnect within 90 days to restore full access.                   │
│                                                                     │
│ Reason (optional):                                                  │
│ [____________________________________________]                      │
│                                                                     │
│ To confirm, type the account username:  @brandng                   │
│ [____________________________________________]                      │
│                                                                     │
│                        [Cancel]  [Disconnect Account]              │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Screen: API Quota Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 API Usage Dashboard                          [Last 24h ▼]       │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Instagram                                    ⚠️ 95% Used      │   │
│ │ ████████████████████████████████████████░░  190/200 calls/hr │   │
│ │ Resets in: 45 minutes  │  Non-essential sync paused          │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ YouTube                                      ✅ 65% Used      │   │
│ │ ██████████████████████████░░░░░░░░░░░░░░░░  6,500/10,000/day│   │
│ │ Resets in: 13 hours 42 minutes                               │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ X (Twitter)                                  ✅ 60% Used      │   │
│ │ ████████████████████████░░░░░░░░░░░░░░░░░░░  180/300 /15min │   │
│ │ Resets in: 12 minutes                                        │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ Facebook                                     ✅ 42% Used      │   │
│ │ █████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  85/200 calls/hr│   │
│ │ Resets in: 52 minutes                                        │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ Reddit                                       ✅ 20% Used      │   │
│ │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12/60 /min     │   │
│ │ Resets in: 38 seconds                                        │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Platform-Specific OAuth Scopes & Limitations

### 10.1 Platform OAuth Scopes

**YouTube (Google OAuth 2.0 with PKCE):**
- `youtube.readonly` — Read channel data, videos, playlists
- `youtube.force-ssl` — Access comments and metadata securely
- `yt-analytics.readonly` — Read analytics data
- API: YouTube Data API v3 | Quota: 10,000 units/day (shared per organization)

**X (Twitter) (OAuth 2.0 with PKCE):**
- `tweet.read`, `users.read`, `offline.access` — Core data access
- `tweet.write` — Post tweets and replies
- `dm.read`, `dm.write` — Direct message access
- API: X API v2 | Basic tier: 1,500 tweets/month; real-time streaming requires Elevated tier

**Instagram (Facebook Login):**
- `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_read_engagement`
- **Business or Creator accounts only** — personal accounts not supported
- Facebook App Review required for production; stories expire after 24 hours

**Facebook (Facebook Login):**
- `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_messaging`
- **Page-level permissions only** — no personal user profile access
- Messenger requires additional review; insights require 30+ page likes

**Reddit (OAuth 2.0):**
- `identity`, `read`, `submit`, `privatemessages`
- **Polling only** — no real-time streaming available
- Rate limit: 60 requests/minute per OAuth client; NSFW requires additional consent

### 10.2 Platform Data Collection Intervals

| Platform | Data Type | Interval |
|----------|-----------|----------|
| **YouTube** | Channel statistics | Hourly |
| **YouTube** | Video comments | Every 15 minutes |
| **YouTube** | Video metadata | On upload detection |
| **YouTube** | Analytics | Hourly |
| **X (Twitter)** | Mentions and keyword data | Every 5 minutes (polling) or real-time |
| **X (Twitter)** | Engagement metrics | Hourly |
| **X (Twitter)** | User profiles | Daily |
| **Instagram** | Post comments | Every 15 minutes |
| **Instagram** | Story mentions | Every 15 minutes |
| **Instagram** | Engagement metrics | Hourly |
| **Facebook** | Page posts and comments | Every 10 minutes |
| **Facebook** | Messenger messages | Every 10 minutes |
| **Facebook** | Page insights | Hourly |
| **Reddit** | Subreddit keyword mentions | Every 30 minutes |
| **Reddit** | Post and comment data | Every 30 minutes |
| **Reddit** | Subreddit info | Daily |

### 10.3 API Priority Queue

When quota is constrained, API requests are processed in priority order:

| Priority | Request Type | Examples |
|----------|-------------|---------|
| **1 — Critical** | Engagement Hub actions | Sending replies, reactions |
| **2 — High** | Real-time mentions and DMs | New comments, messages |
| **3 — Medium** | Analytics and follower data | Engagement metrics, counts |
| **4 — Low** | Historical backfill | Catch-up after error recovery |

---

## 11. Notifications

### 11.1 Email Notifications

| Event | Recipients | Subject | Timing |
|-------|-----------|---------|--------|
| Account connected | All Admins | New [Platform] account connected by [User] | Within 5 minutes |
| Account disconnected | All Admins | [Platform] @[Username] disconnected — data retained until [Date] | Immediate |
| Account needs re-auth | Primary Manager + All Admins | Action Required: Re-authenticate your [Platform] account | Within 10 minutes of expiry |
| Account error (persistent) | All Admins | [Platform] account errors — 10+ consecutive failures detected | After 10th consecutive failure |
| Quota warning (80%) | All Admins | [Platform] API quota at 80% — collection slowing | At 80% threshold |
| Quota critical (95%) | All Admins | URGENT: [Platform] quota at 95% — action needed | At 95% threshold |
| Account paused | All Admins | [Platform] @[Username] paused by [User] | Immediate |
| Account resumed | All Admins | [Platform] @[Username] resumed — sync active | Immediate |
| Bulk re-auth completed | All Admins | Bulk re-authentication: [X] of [Y] accounts updated | After bulk operation |
| 24hr failure escalation | All Admins + Support | Critical: [Platform] account failing for 24+ hours | After 24 consecutive hours of failures |

### 11.2 In-App Notifications

| Event | Priority | Message |
|-------|----------|---------|
| Account connected | P2 | ✅ [Platform] @[Username] connected successfully |
| Account needs re-auth | P1 | ⚠️ Re-authenticate your [Platform] account to restore sync |
| Quota at 80% | P1 | 📊 [Platform] API quota at 80% — data collection slowing |
| Quota at 95% | P0 | 🚨 [Platform] API quota critical — essential-only collection active |
| Account error (10 failures) | P1 | ❌ [Platform] account has errors — tap to view diagnostics |
| Initial sync completed | P3 | ✅ Initial data sync complete for [Platform] @[Username] |
| Backfill completed | P3 | ✅ Backfilled 24 hours of missed data for [Platform] |
| Platform outage detected | P1 | ⚠️ [Platform] is experiencing an outage — sync paused automatically |

---

## 12. Error Handling

### 12.1 Error Classification & Recovery Strategy

| Error Type | HTTP Code(s) | Recovery Strategy | Max Retries |
|------------|-------------|------------------|-------------|
| **Transient Server Error** | 502, 503, 504 | Exponential backoff: 1s, 2s, 4s + jitter | 3 |
| **Authentication Error** | 401 | Immediate re-authentication flow | 0 (no retry) |
| **Rate Limit** | 429 | Queue and retry after Retry-After header | Unlimited (queued) |
| **Client Error** | 400, 403 | Log and alert; no retry | 0 |
| **Not Found** | 404 | Mark resource as deleted or unavailable | 0 |
| **Platform Error** | 500 | Exponential backoff; alert after 3 failures | 3 |

### 12.2 Error Reference Table

| Error Code | HTTP Status | Description | User Message | Resolution |
|------------|-------------|-------------|--------------|------------|
| `OAUTH_STATE_INVALID` | 400 | State parameter missing, expired, or already used | Connection expired or invalid. Please try again. | Restart the connection flow |
| `OAUTH_DENIED` | 400 | User denied permission on the platform | Connection cancelled. Grant all required permissions to connect. | Re-initiate and accept all permissions |
| `OAUTH_CALLBACK_FAILED` | 400 | OAuth callback processing failed | Connection failed due to a platform error. Please try again. | Retry connection |
| `TOKEN_EXCHANGE_FAILED` | 500 | Code-to-token exchange failed | Unable to complete connection. Please try again or contact support. | Retry; contact support if persistent |
| `ACCOUNT_ALREADY_CONNECTED` | 409 | Same platform account already connected to this org | This account is already connected to your organization. | No action needed |
| `ACCOUNT_LIMIT_REACHED` | 403 | Organization at plan limit | You've reached your plan's limit. Upgrade or disconnect an existing account. | Upgrade plan or disconnect unused account |
| `ACCOUNT_NOT_FOUND` | 404 | Account ID does not exist | Social account not found. | Check the account ID |
| `ACCOUNT_DISCONNECTED` | 400 | Account is in disconnected state | This account is disconnected. Reconnect to resume data collection. | Reconnect the account |
| `INVALID_CONFIRMATION` | 400 | Disconnection confirmation username does not match | Confirmation does not match the account username. | Re-enter the correct username |
| `INSUFFICIENT_PERMISSIONS` | 403 | User role insufficient for action | You do not have permission to perform this action. | Contact your Admin |
| `PLATFORM_API_ERROR` | 502 | Upstream platform API error | The [Platform] API is temporarily unavailable. We're retrying automatically. | Wait for automatic recovery |
| `PLATFORM_RATE_LIMIT` | 429 | Platform rate limit hit | [Platform] rate limit reached. Request queued — we'll retry automatically. | Wait; no action needed |
| `PLATFORM_UNAVAILABLE` | 503 | Platform experiencing an outage | [Platform] is currently experiencing an outage. Collection paused. | Monitor platform status page |
| `TOKEN_REFRESH_FAILED` | 500 | Refresh token invalid or expired | Session expired for [Platform]. Please re-authenticate. | Click Re-authenticate in account settings |
| `REAUTH_REQUIRED` | 401 | Account requires re-authentication | Your [Platform] account needs to be re-authenticated. | Complete re-authentication flow |
| `BULK_LIMIT_EXCEEDED` | 400 | Bulk operation exceeds 50-account limit | Maximum 50 accounts per bulk operation. | Split into smaller batches |
| `INVALID_PLATFORM` | 400 | Unsupported platform specified | This platform is not currently supported. | Use a supported platform |
| `CIRCUIT_BREAKER_OPEN` | 503 | Circuit breaker is active for this account | Too many errors detected. Data collection suspended temporarily. | Contact support or wait for auto-recovery |

### 12.3 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Single platform API down | Continue collection on other platforms; surface status indicator |
| 401 on API call | Attempt token refresh; if failed, mark Needs Re-auth; continue other accounts |
| Quota exhausted mid-sync | Pause non-essential sync; queue remaining work; resume on reset |
| Multiple orgs hit quota | Priority queue: Enterprise > Pro > Free |
| Circuit breaker open | Stop all requests for that account; health check every 30 minutes |
| Platform outage detected | Pause collection; notify users; auto-resume when platform restored |

---

## 13. Acceptance Criteria

### 13.1 OAuth Connection

| ID | Criteria | Target |
|----|----------|--------|
| **AC-SOC-001** | User connects account end-to-end including OAuth consent | Within 30 seconds |
| **AC-SOC-002** | Connected account appears in list with profile image and follower count | Immediately after connection |
| **AC-SOC-003** | Duplicate connection attempt returns clear error | `ACCOUNT_ALREADY_CONNECTED` |
| **AC-SOC-004** | Connection failure shows actionable error message | 100% of failure scenarios |
| **AC-SOC-005** | All tokens stored encrypted; confirmed by database inspection | AES-256 encryption |
| **AC-SOC-006** | OAuth state parameter validated; CSRF protection confirmed | 100% enforcement |
| **AC-SOC-007** | Organization ownership enforced; Org A cannot see Org B's accounts | Zero cross-org leakage |

### 13.2 Account Management

| ID | Criteria | Target |
|----|----------|--------|
| **AC-SOC-008** | Disconnection modal shows comprehensive impact analysis | All affected items listed |
| **AC-SOC-009** | Only Admins can disconnect; Managers receive permission error | 100% enforcement |
| **AC-SOC-010** | Disconnected data visible in read-only mode with Historical badge | For 90 days |
| **AC-SOC-011** | Reconnecting within 90 days restores full historical data access | 100% data restoration |
| **AC-SOC-012** | Paused accounts stop collection immediately; resume within 60 seconds | Zero data collection during pause |
| **AC-SOC-013** | Bulk operations process up to 50 accounts | <30 seconds for 50 accounts |

### 13.3 Token Management

| ID | Criteria | Target |
|----|----------|--------|
| **AC-SOC-014** | Tokens refreshed proactively before expiration | 1 hour before expiry |
| **AC-SOC-015** | Expired tokens detected without requiring an API call to fail | Within 5 minutes |
| **AC-SOC-016** | Re-authentication preserves all data and account configuration | 100% data preservation |
| **AC-SOC-017** | Tokens never appear in API responses or logs | Zero token exposure |

### 13.4 Data Collection & Quota

| ID | Criteria | Target |
|----|----------|--------|
| **AC-SOC-018** | Comments appear in Engagement Hub within polling intervals | Platform interval + 1 minute |
| **AC-SOC-019** | Engage actions (replies) never blocked by rate limits | 100% prioritization |
| **AC-SOC-020** | Admins can view real-time API usage per platform | Live dashboard |
| **AC-SOC-021** | System slows polling at 80% quota | Automatic; no manual intervention |
| **AC-SOC-022** | Quota warnings sent at 80% and 95% | Within 5 minutes of threshold |

### 13.5 Error Handling & Health

| ID | Criteria | Target |
|----|----------|--------|
| **AC-SOC-023** | 401 errors trigger re-auth flow without manual intervention | Automatic |
| **AC-SOC-024** | Rate limit (429) errors trigger queue and retry after cooldown | Respects Retry-After header |
| **AC-SOC-025** | System backfills up to 24 hours after error recovery | Background job completion |
| **AC-SOC-026** | Account status updates after any health event | Within 5 minutes |
| **AC-SOC-027** | Admin email sent for Error status | Within 10 minutes |
| **AC-SOC-028** | Circuit breaker opens after 10 consecutive failures | Automatic |

---

## 14. Edge Cases

### 14.1 Connection Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-SOC-001** | User denies OAuth permissions on platform | Return `OAUTH_DENIED` error; display "Grant all required permissions to connect" |
| **EC-SOC-002** | OAuth state expires (10 minutes) | Return `OAUTH_STATE_INVALID` error; prompt to restart connection |
| **EC-SOC-003** | User connects personal Instagram account | Return clear error: "Instagram Business or Creator account required" |
| **EC-SOC-004** | Platform returns invalid or malformed token | Attempt one retry; if fails, mark as `OAUTH_CALLBACK_FAILED` |
| **EC-SOC-005** | User at plan limit attempts connection | Block with upgrade modal; show current and next plan limits |
| **EC-SOC-006** | Same account connected by two users simultaneously | First connection succeeds; second returns `ACCOUNT_ALREADY_CONNECTED` |

### 14.2 Token Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-SOC-007** | Refresh token has itself expired | Mark as `Needs Re-authentication`; notify Primary Manager and all Admins |
| **EC-SOC-008** | Token refresh fails 3 consecutive times | Mark as `Needs Re-authentication`; escalate to Admin |
| **EC-SOC-009** | User revokes access directly on the platform | Next API call returns 401; immediately mark as `Needs Re-auth` |
| **EC-SOC-010** | Encryption key rotation in progress | Buffer new token writes; re-encrypt existing tokens in background batch |
| **EC-SOC-011** | Multiple processes attempt token refresh simultaneously | Implement distributed lock; only one refresh executes; others use the result |

### 14.3 Data Collection Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-SOC-012** | Platform returns 500 error during sync | Retry 3 times with backoff; log failure; notify Admin if all retries fail |
| **EC-SOC-013** | Rate limit hit mid-collection cycle | Queue remaining requests; process after reset; no data loss |
| **EC-SOC-014** | Account suspended on platform | Mark as Error; notify Admin; pause collection; do not retry until re-auth |
| **EC-SOC-015** | Content deleted between collection cycles | Mark as `[Deleted]`; preserve surrounding context |
| **EC-SOC-016** | Duplicate content arrives from overlapping polls | Deduplicate using content hash; process exactly once |
| **EC-SOC-017** | NSFW content encountered without consent | Skip collection; log; surface consent prompt to Admin |

### 14.4 Quota Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-SOC-018** | Quota exhausted mid-sync | Pause sync; queue remaining work; auto-resume at quota reset |
| **EC-SOC-019** | Multiple organizations hit quota simultaneously | Priority queue: Enterprise > Pro > Free |
| **EC-SOC-020** | Quota reset delayed by platform | Wait additional 5 minutes then retry; log delay |
| **EC-SOC-021** | User upgrades plan mid-quota-period | New quota limits apply immediately |
| **EC-SOC-022** | User downgrades plan mid-quota-period | Current period continues; new limits apply at next period |

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric | Target |
|--------|--------|
| OAuth connection completion | <30 seconds end-to-end |
| Data collection latency | 95% of comments and DMs within polling interval + 1 minute |
| API quota efficiency | Operate within 80% of available quota under normal load |
| Token refresh | <2 seconds |
| Account list load (50 accounts) | <2 seconds |
| Bulk operations (50 accounts) | <30 seconds |

### 15.2 Scalability

| Dimension | Target |
|-----------|--------|
| Organizations supported | 50,000+ |
| Connected social accounts | 250,000+ |
| Social interactions processed | 100,000+ per hour |
| Collected data points | Billions (horizontally scalable DB) |

### 15.3 Security

| Requirement | Detail |
|-------------|--------|
| Token encryption | AES-256 at rest; TLS 1.3 in transit |
| Data isolation | Zero cross-organization data leakage |
| Audit logging | Complete trail of all account operations |
| Penetration testing | Quarterly security assessments |
| Encryption key rotation | Annual via KMS |

### 15.4 Reliability

| Metric | Target |
|--------|--------|
| Data collection uptime | 99.5% |
| Automatic error recovery | 95% of transient failures self-resolve |
| Data consistency | <0.1% data loss during normal operation |
| Health monitoring alert time | Within 5 minutes of any status change |

### 15.5 Compliance

| Requirement | Detail |
|-------------|--------|
| GDPR | Right to erasure; data portability; 90-day disconnected data retention then archive |
| NDPR | 7-year audit trail retention |
| CCPA | Consumer data rights compliance |
| Platform TOS | YouTube, X, Instagram, Facebook, Reddit TOS compliance at all times |
| Data residency | Configurable per organization |

---

## 16. Future Enhancements

| ID | Enhancement | Description | Priority | Timeline |
|----|-------------|-------------|----------|----------|
| **FE-SOC-001** | LinkedIn Integration | Connect LinkedIn company pages for B2B social data | High | Phase 7 (Q3 2027) |
| **FE-SOC-002** | TikTok Integration | Connect TikTok Business accounts for video comment collection | High | Phase 7 (Q3 2027) |
| **FE-SOC-003** | Pinterest Integration | Connect Pinterest business accounts | Medium | Phase 7 (Q3 2027) |
| **FE-SOC-004** | Threads Integration | Connect Threads accounts for Meta ecosystem coverage | Medium | Phase 7+ (Q3 2027+) |
| **FE-SOC-005** | WhatsApp Business Integration | Connect WhatsApp Business API for message monitoring | High | Year 2 Q1 |
| **FE-SOC-006** | X Real-Time Streaming | Enable real-time streaming for eligible X API tiers | Medium | Year 2 Q2 |
| **FE-SOC-007** | Advanced Quota Forecasting | ML-based quota consumption prediction | Low | Year 2 Q3 |
| **FE-SOC-008** | Paid Advertising Integration | Connect ad accounts for cross-organic/paid analytics | Low | Phase 14 (Year 3) |

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **OAuth 2.0** | Industry-standard protocol for authorization; used for all platform connections |
| **PKCE** | Proof Key for Code Exchange — OAuth 2.0 security extension preventing authorization code interception |
| **Access Token** | Short-lived credential used to make authenticated API calls |
| **Refresh Token** | Long-lived credential used to obtain a new access token without re-authentication |
| **Circuit Breaker** | A fault-tolerance pattern that stops sending requests after consecutive failures to prevent cascade failures |
| **Quota** | The total number of API requests or units permitted by a platform within a defined period |
| **Rate Limit** | The maximum request frequency permitted in a short rolling window (e.g., 300 requests per 15 minutes) |
| **Exponential Backoff** | A retry strategy that progressively increases the delay between retries |
| **Multi-Tenant Isolation** | Architectural guarantee that one organization's data is never accessible to another |
| **Polling** | Periodically querying a platform API for new data (as opposed to real-time streaming) |
| **Jitter** | Random time variation added to backoff delays to prevent simultaneous retry storms |
| **Platform TOS** | The Terms of Service imposed by each social platform governing how its API may be used |
| **CSRF** | Cross-Site Request Forgery — an attack mitigated by the OAuth state parameter |
| **KMS** | Key Management Service — a managed service for cryptographic key storage and rotation |
| **AES-256** | Advanced Encryption Standard with 256-bit key — used for token encryption at rest |
| **NDPR** | Nigeria Data Protection Regulation — Nigerian data privacy law governing user data |
| **NGN** | Nigerian Naira — base currency for all financial values on the platform (symbol: ₦) |

---

## 18. Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-22 | Engineering Lead | Initial Social Media Integration module specification — OAuth flows, token lifecycle, quota management, data collection, error handling, cross-module integration |

---

 