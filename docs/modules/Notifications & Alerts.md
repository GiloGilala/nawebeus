# Module 9: Notifications & Alerts

**Document Version:** 1.0.0
**Last Updated:** 2026-07-22
**Status:** Active
**Owner:** Product Lead + Engineering Lead

---

## 1. Overview

### 1.1 Module Description

The Notifications & Alerts module is the **central nervous system for platform awareness**. It provides a comprehensive, intelligent, multi-channel notification system that ensures timely delivery of critical information across the entire Nawebeus platform — while minimizing alert fatigue, respecting user preferences, and maintaining enterprise-grade delivery reliability.

This module serves **all other modules** by providing reliable, intelligent, personalized notification delivery across in-app, email, push, SMS, and external channels (Slack, Teams, webhooks). It transforms raw platform events into actionable, contextual, prioritized signals that reach the right person, through the right channel, at exactly the right time.

### 1.2 Module Objectives

| Objective | Description | Success Metric |
|-----------|-------------|----------------|
| **Timely Delivery** | Deliver notifications within seconds of triggering events | <30 seconds for P0 events (P95) |
| **Intelligent Routing** | Route to the right channel and recipient automatically | ≥95% routing accuracy |
| **Alert Fatigue Prevention** | Prevent notification overload through smart batching and grouping | 40%+ volume reduction without information loss |
| **User Control** | Give every user granular control over their notification experience | 100% of preferences respected within 30 seconds |
| **Multi-Channel Reliability** | Deliver across all channels with fallback and retry | 99.9%+ delivery success for P0 events |
| **Compliance Delivery** | Guarantee delivery of regulatory and security notifications | 100% delivery of compliance-mandated alerts |
| **Operational Visibility** | Provide analytics to optimize notification programs | Dashboards updated within 5 minutes |

### 1.3 Module Position in the Platform

| Aspect | Detail |
|--------|--------|
| **Role** | Cross-cutting infrastructure — powers all other modules |
| **Depends on** | Module 1 (Auth), Module 8 (Org & Users), Module 10 (Admin) |
| **Provides to** | ALL other modules (1–8, 10) — notifications consumed by everything |
| **External systems** | SendGrid/Amazon SES (email), APNS/FCM (push), Twilio (SMS), Slack/Teams APIs |
| **Architecture** | Event-driven; operates on event stream published by all modules |

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Eve** | Engagement Manager | Crisis alerts, SLA warnings, quiet hours, channel preferences |
| **Elena** | Executive | SMS-only critical alerts, daily executive digest, minimal noise |
| **Marcus** | Marketing Manager | Campaign milestone alerts, metric anomaly notifications |
| **Sam** | System Admin | On-call alerts, system health, policy configuration |
| **Olivia** | Compliance Officer | Guaranteed regulatory delivery, audit exports, mandatory notification policies |
| **All Users** | Platform Users | Personal preferences, notification history, digest subscriptions |

### 1.5 Dependencies

| Dependency | Module | Purpose |
|------------|--------|---------|
| **Authentication & User Management** | MOD-001 | User identity, sessions, device tokens |
| **Organization & Account Management** | MOD-008 | Org context, team membership, roles, policy inheritance |
| **System Administration** | MOD-010 | System config, audit access, on-call rotations |
| **Media Monitoring** | MOD-003 | Crisis alerts, coverage spikes, sentiment events |
| **Publishing & Scheduling** | MOD-002 | Post approval, publishing status, scheduling alerts |
| **Engagement Hub** | MOD-007 | Message assignments, SLA breach, escalation |
| **Analytics & Reporting** | MOD-004 | Report ready, metric anomaly, insight notifications |
| **Growth & Giveaways** | MOD-005 | Campaign milestones, winner announcements |
| **Influencer Management** | MOD-006 | Content approval, campaign updates |

---

## 2. Objectives

### 2.1 Business Objectives

| ID | Objective | Success Measure |
|----|-----------|-----------------|
| **BO-01** | Ensure zero critical events are missed | 100% delivery of P0 events with acknowledgment |
| **BO-02** | Reduce alert fatigue and opt-out rates | <5% notification opt-out rate |
| **BO-03** | Increase user engagement with notifications | ≥40% CTR on transactional; ≥15% on informational |
| **BO-04** | Maintain email deliverability | >98% inbox placement rate |
| **BO-05** | Enable global operations | Multi-timezone, multi-language support |
| **BO-06** | Demonstrate notification program ROI | Measurable conversion impact from triggered notifications |

### 2.2 Non-Goals

The Notifications & Alerts module explicitly does **not** address:

- **Marketing automation workflows** — basic triggered emails only; complex journeys handled by external tools
- **Two-way conversations** — notifications are one-way; replies route to the relevant module
- **Rich content authoring** — templates yes; content creation lives in source modules
- **Long-form newsletters** — transactional and digests only; not a Mailchimp replacement
- **Voice calls except emergencies** — SMS for critical; voice only for P0 on enterprise tier

---

## 3. User Stories

### 3.1 Primary User Stories (P0 — Must Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-NOT-001** | As a user, I want to receive real-time alerts for critical events so I can respond immediately before the situation escalates. | P0 | P0 alerts delivered within 30 seconds; in-app within 2 seconds |
| **US-NOT-002** | As a user, I want to customize my notification preferences per module and event type so I only receive alerts that are relevant to my role. | P0 | Preference changes apply within 30 seconds system-wide |
| **US-NOT-003** | As a user, I want notifications delivered across my preferred channels so I never miss important updates regardless of where I am. | P0 | All configured channels attempted; fallback activates within 5 minutes on failure |
| **US-NOT-004** | As a manager, I want to receive escalation notifications when critical issues go unacknowledged so I can intervene before SLAs are breached. | P0 | Escalation triggers within 15 minutes of unacknowledged P0 alert |
| **US-NOT-005** | As a compliance officer, I want guaranteed delivery of regulatory and security notifications that users cannot disable so we always meet our legal obligations. | P0 | 100% delivery of compliance-mandated alerts; zero user override |

### 3.2 Secondary User Stories (P1 — Should Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-NOT-006** | As a user, I want similar notifications grouped together so I am not overwhelmed by individual alerts for the same event cluster. | P1 | Related notifications batched; volume reduced by ≥40% |
| **US-NOT-007** | As a user, I want to configure quiet hours so I am not disturbed by non-critical notifications outside my working hours. | P1 | 100% of non-critical notifications suppressed during quiet hours |
| **US-NOT-008** | As an admin, I want to set organization-wide notification policies so all team members operate under consistent, compliant rules. | P1 | Org policies override user preferences for compliance items within 30 seconds |
| **US-NOT-009** | As a user, I want to receive digest summaries at a scheduled time so I can catch up on non-urgent updates efficiently. | P1 | Digest delivered at configured time; volume reduced by ≥70% for digest-eligible events |
| **US-NOT-010** | As a system admin, I want to configure on-call rotations for critical alerts so coverage is maintained 24/7. | P1 | Rotation active with auto-escalation; no gaps in coverage |

### 3.3 Tertiary User Stories (P2 — Nice to Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-NOT-011** | As a user, I want to view my full notification history so I can find something I may have missed or dismissed. | P2 | 365-day history searchable with full-text query in <2 seconds |
| **US-NOT-012** | As a user, I want to pause notifications during meetings or focus time so I am not interrupted. | P2 | Pause activates immediately; resumes automatically at configured time |
| **US-NOT-013** | As an admin, I want to view notification delivery analytics so I can optimize the notification program and reduce fatigue. | P2 | Analytics dashboard updated within 5 minutes of activity |
| **US-NOT-014** | As a user, I want to receive critical alerts via SMS so I'm always reachable even without internet access. | P2 | SMS delivered within 30 seconds for P0 events on eligible plans |
| **US-NOT-015** | As a user, I want to take action directly from a notification (approve, assign, dismiss) so I don't need to navigate to the platform for simple decisions. | P2 | Inline actions execute and confirm within 3 seconds |

---

## 4. Functional Requirements

### 4.1 Intelligent Notification Engine

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-001** | System shall support real-time, event-driven notification generation triggered by all platform modules | P0 | WebSocket + event bus |
| **FR-NOT-002** | System shall classify all events by priority: P0 (Critical), P1 (High), P2 (Medium), P3 (Low) | P0 | Rule-based with ML override |
| **FR-NOT-003** | System shall support role-based delivery routing (Admin, Manager, Analyst, Viewer) | P0 | Applied per event type |
| **FR-NOT-004** | System shall support skills-based routing for specialized notifications | P1 | Route to users with relevant expertise |
| **FR-NOT-005** | System shall enforce escalation paths for unacknowledged P0 and P1 alerts | P0 | Escalation at 15-minute intervals |
| **FR-NOT-006** | System shall support timezone-aware delivery scheduling for non-critical notifications | P1 | Never deliver P2/P3 between midnight and 7am local time |
| **FR-NOT-007** | System shall implement rate limiting: maximum 10 non-critical notifications per user per hour | P0 | P0/P1 are never rate-limited |
| **FR-NOT-008** | System shall implement smart batching and contextual grouping of related events | P1 | Collapse 10 related mentions into one grouped notification |
| **FR-NOT-009** | System shall deduplicate notifications from multiple sources for the same underlying event | P1 | Same event → one notification across channels |
| **FR-NOT-010** | System shall activate fallback channels within 5 minutes of delivery failure for P0/P1 | P0 | In-app → email → SMS → phone (configured sequence) |
| **FR-NOT-011** | System shall support backup recipient configuration when primary recipient is unavailable | P1 | OOO/vacation mode triggers backup routing |
| **FR-NOT-012** | System shall support manual priority override for admins to reclassify events | P2 | With audit log entry |

### 4.2 Multi-Channel Delivery

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-013** | System shall deliver in-app notifications via WebSocket with read receipts and sync across devices | P0 | Delivery within 2 seconds; sync within 5 seconds |
| **FR-NOT-014** | System shall support interactive in-app notifications with inline actions (approve, dismiss, snooze, view, assign) | P0 | Actions execute without navigating away |
| **FR-NOT-015** | System shall maintain persistent notification history with full-text search for 365 days | P0 | Query returns in <2 seconds |
| **FR-NOT-016** | System shall support bulk notification management (mark all read, archive, delete) | P1 | Applies to entire filtered view |
| **FR-NOT-017** | System shall deliver responsive HTML email notifications with dark/light mode support | P0 | Tested across 95%+ of email clients |
| **FR-NOT-018** | System shall support actionable email buttons with deep links back to the platform | P0 | Deep link resolves in <3 seconds |
| **FR-NOT-019** | System shall implement full email deliverability stack: SPF, DKIM, DMARC, bounce handling, suppression lists | P0 | >98% inbox placement |
| **FR-NOT-020** | System shall process one-click email unsubscribes within 1 hour | P0 | CAN-SPAM/GDPR compliant |
| **FR-NOT-021** | System shall deliver platform-specific mobile push notifications (iOS APNS, Android FCM) | P1 | Rich push with images and actions |
| **FR-NOT-022** | System shall optimize push delivery time based on user activity patterns | P2 | ML-based send time |
| **FR-NOT-023** | System shall deliver SMS notifications for P0 events (P1 on premium tier) | P2 | 160-character with link shortening |
| **FR-NOT-024** | System shall support Slack webhook integration per workspace and channel | P1 | With formatted messages and action buttons |
| **FR-NOT-025** | System shall support Microsoft Teams webhook integration | P1 | Adaptive card format |
| **FR-NOT-026** | System shall support custom webhook endpoints for enterprise integrations | P2 | Retry with exponential backoff |
| **FR-NOT-027** | System shall support voice calls for P0 emergencies on enterprise tier | P2 | Twilio-powered; last resort fallback |

### 4.3 User Preference Management

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-028** | System shall support granular per-user preferences: per-module, per-event-type, per-channel | P0 | Full matrix of options |
| **FR-NOT-029** | System shall support quiet hours configuration with timezone, start/end time, and weekend override | P0 | 100% enforcement of quiet hours for P2/P3 |
| **FR-NOT-030** | System shall support vacation/out-of-office mode with auto-responder and backup routing | P1 | Requires start and end date |
| **FR-NOT-031** | System shall support digest mode: consolidate non-urgent events into daily or weekly summaries | P1 | Configured send time per user |
| **FR-NOT-032** | System shall enforce P0 notifications as non-disableable at the user level | P0 | User cannot opt out of P0 events |
| **FR-NOT-033** | System shall apply organization-level mandatory notification policies that override user preferences | P0 | Compliance items only |
| **FR-NOT-034** | System shall support role-based preference templates for efficient onboarding | P1 | Auto-applied on role assignment |
| **FR-NOT-035** | System shall audit-log all preference changes with actor, timestamp, and before/after state | P1 | Retained for 3 years |
| **FR-NOT-036** | System shall support bulk preference management for admin-driven onboarding and offboarding | P2 | 1,000 users in <5 minutes |

### 4.4 Intelligent Alert System

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-037** | System shall detect anomalies in platform data (mention spikes, sentiment drops, metric deviations) | P1 | Alert within 5 minutes of detection |
| **FR-NOT-038** | System shall correlate events across modules to identify compound issues | P1 | Crisis mention + sentiment drop + engagement spike = one correlated alert |
| **FR-NOT-039** | System shall suppress duplicate alerts from multiple sources for the same event | P1 | Reduces duplicates by ≥60% |
| **FR-NOT-040** | System shall group and summarize related alerts into single notifications | P1 | "5 related mentions" → one alert |
| **FR-NOT-041** | System shall enforce alert cooldown periods to prevent alert storms | P0 | Minimum 1 minute per rule; configurable |
| **FR-NOT-042** | System shall support alert rule creation with conditions, thresholds, operators, and channels | P1 | Validation at save time |
| **FR-NOT-043** | System shall support alert testing against historical data | P2 | Test before activating |
| **FR-NOT-044** | System shall track alert resolution and maintain post-alert audit records | P1 | Resolution notes retained |
| **FR-NOT-045** | System shall support on-call rotation scheduling with automated handoff | P1 | Gap detection with admin alert |

### 4.5 Enterprise Email System

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-046** | System shall deliver transactional emails within 60 seconds with 99.9%+ reliability | P0 | Priority queue; retry with exponential backoff |
| **FR-NOT-047** | System shall implement smart retry logic: up to 5 attempts with exponential backoff | P0 | Failure after 5 attempts triggers fallback |
| **FR-NOT-048** | System shall manage bounce handling: hard bounces removed immediately; soft bounces suppressed after 3 failures | P0 | Suppression list maintained |
| **FR-NOT-049** | System shall support digest email with personalized content selection based on user role and activity | P1 | Optimal send time per user |
| **FR-NOT-050** | System shall support A/B testing for email subject lines, content, and send times | P2 | Statistical significance at p<0.05 |
| **FR-NOT-051** | System shall maintain suppression lists: hard bounces, complaints, unsubscribes | P0 | Applied globally across sends |

### 4.6 Notification Analytics & Optimization

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-NOT-052** | System shall track delivery rates by channel, priority, and notification type | P1 | Updated within 5 minutes |
| **FR-NOT-053** | System shall track open, click, and acknowledgment rates per channel | P1 | Per user and aggregate views |
| **FR-NOT-054** | System shall detect notification fatigue patterns (declining engagement + rising opt-outs) | P2 | Alert admin before user opts out |
| **FR-NOT-055** | System shall calculate and report notification-driven action conversion rates | P2 | Business impact measurement |
| **FR-NOT-056** | System shall provide audit log of all notification events for compliance export | P1 | 7-year retention |

---

## 5. Business Rules

### 5.1 Delivery Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-NOT-001** | P0 (Critical) notifications are never rate-limited, never suppressed by quiet hours, and cannot be disabled by users | Life-safety, security, and compliance require guaranteed delivery |
| **BR-NOT-002** | Compliance-mandated notifications (breach, regulatory, legal hold) cannot be opted out of by any user | Legal requirement |
| **BR-NOT-003** | Non-critical (P2/P3) notifications respect quiet hours and are never delivered between midnight and 7am local time unless explicitly overridden | Respects work-life balance |
| **BR-NOT-004** | Rate limiting caps non-critical notifications at 10 per user per hour; P0/P1 are exempt | Prevents alert fatigue without compromising critical coverage |
| **BR-NOT-005** | Fallback channels activate within 5 minutes of delivery failure for P0/P1 events | Ensures critical events always reach the recipient |
| **BR-NOT-006** | Escalation paths trigger within 15 minutes for unacknowledged P0 alerts | Operational reliability and SLA protection |

### 5.2 Preference Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-NOT-007** | Preference changes propagate system-wide within 30 seconds | Immediate effect prevents missed or unwanted notifications |
| **BR-NOT-008** | Organization-level mandatory policies override user preferences for compliance items only | Compliance hierarchy; user autonomy preserved for non-compliance items |
| **BR-NOT-009** | User preferences are personal and cannot be modified by other users (except Admin with audit log) | Privacy protection |
| **BR-NOT-010** | Vacation mode requires a defined end date; open-ended vacation mode is not permitted | Prevents permanent suppression of work notifications |
| **BR-NOT-011** | Role-based preference templates auto-apply on role assignment but can be overridden by the user | Reduces onboarding friction while preserving personal control |

### 5.3 Data & Compliance Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-NOT-012** | All notification actions (send, deliver, open, click, acknowledge) are audit-logged | Compliance and debugging |
| **BR-NOT-013** | Email unsubscribe is one-click and honored within 1 hour | CAN-SPAM/GDPR legal requirement |
| **BR-NOT-014** | Notification content must not include sensitive PII unless the notification type explicitly requires it | Privacy by default |
| **BR-NOT-015** | Notification history is retained for 365 days for user reference; audit logs for 7 years | Operational need and regulatory compliance |
| **BR-NOT-016** | Cross-channel deduplication: the same event delivered across multiple channels counts as one notification for analytics | Accurate measurement |
| **BR-NOT-017** | SMS and voice channels are premium features; in-app and email are available on all plans | Cost control |

---

## 6. Validation Rules

### 6.1 Notification Creation Validation

| Field | Rule | Error Code |
|-------|------|------------|
| `title` | Cannot be empty; maximum 200 characters | `NOT_TITLE_INVALID` |
| `body` | Cannot be empty; maximum 5,000 characters | `NOT_BODY_INVALID` |
| `recipients` | At least one recipient required; maximum 1,000 per request (use bulk API beyond) | `NOT_RECIPIENTS_INVALID` |
| `priority` | Must be valid enum: `P0`, `P1`, `P2`, `P3` | `NOT_PRIORITY_INVALID` |
| `channel` | Must be a valid, configured channel for the recipient | `NOT_CHANNEL_INVALID` |
| `action_url` | Must be a valid absolute URL or null | `NOT_URL_INVALID` |
| `scheduled_at` | Must be a future timestamp if provided | `NOT_SCHEDULE_INVALID` |
| `event_type` | Must reference a valid, registered event type | `NOT_EVENT_TYPE_INVALID` |

### 6.2 Preference Validation

| Rule | Error Code |
|------|------------|
| Quiet hours start and end time must form a valid range (wrap-midnight is supported, e.g., 22:00–07:00) | `NOT_QUIET_HOURS_INVALID` |
| P0 notifications cannot be disabled — any attempt returns a validation error | `NOT_P0_LOCKED` |
| Vacation mode requires both a start date and a future end date | `NOT_VACATION_DATES_INVALID` |
| Digest frequency must be one of: `daily`, `weekly`, `never` | `NOT_DIGEST_FREQUENCY_INVALID` |
| Channel preferences must reference a channel that is configured and active for the organization | `NOT_CHANNEL_NOT_CONFIGURED` |

### 6.3 Alert Rule Validation

| Rule | Error Code |
|------|------------|
| Alert rule must define at least one condition | `NOT_ALERT_NO_CONDITION` |
| Threshold value must be numeric and within a reasonable range for the metric | `NOT_ALERT_THRESHOLD_INVALID` |
| Comparison operator must be one of: `>`, `<`, `=`, `>=`, `<=`, `!=` | `NOT_ALERT_OPERATOR_INVALID` |
| Alert rule must define at least one notification channel | `NOT_ALERT_NO_CHANNEL` |
| Cooldown must be at least 1 minute to prevent alert storms | `NOT_ALERT_COOLDOWN_TOO_SHORT` |
| Circular alert conditions (A triggers B triggers A) are rejected at save time | `NOT_ALERT_CIRCULAR_CONDITION` |

### 6.4 Email Validation

| Rule | Error Code |
|------|------------|
| Email address must be valid RFC 5322 format | `NOT_EMAIL_ADDRESS_INVALID` |
| Subject line must not exceed 998 characters (RFC 5322) | `NOT_EMAIL_SUBJECT_TOO_LONG` |
| From address must be on a verified sending domain | `NOT_EMAIL_FROM_UNVERIFIED` |
| Cannot send to an address on the global suppression list | `NOT_EMAIL_SUPPRESSED` |
| Attachments cannot exceed 10MB (25MB on enterprise tier) | `NOT_EMAIL_ATTACHMENT_TOO_LARGE` |

---

## 7. Permissions (RBAC)

### 7.1 Role Definitions

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Notification Admin** | Full module control | All capabilities including org-wide policies and compliance settings |
| **System Administrator** | Operational control | Configure channels, manage on-call, view all logs and analytics |
| **Compliance Officer** | Compliance oversight | View audit logs, set org-wide mandatory policies, export history |
| **Manager** | Team-level configuration | Configure team notification policies, view team history |
| **User** | Personal preferences | Set own preferences, view own history, acknowledge own alerts |
| **Auditor** | Read-only audit access | View notification logs and compliance reports only |

### 7.2 Permission Matrix

| Permission | Admin | System Admin | Compliance Officer | Manager | User | Auditor |
|------------|:-----:|:------------:|:-----------------:|:-------:|:----:|:-------:|
| Send notification to self | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Send notification to team | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send notification org-wide | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure global channels | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set own preferences | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Set team preferences | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Set org-wide mandatory policy | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View own notification history | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team notification history | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View all notification history | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Acknowledge alert | ✅ | ✅ | ✅ | ✅ | If assigned | ❌ |
| Create personal alert rule | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create org-wide alert rule | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage templates | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View notification audit log | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Export notification data | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Configure on-call rotation | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View analytics dashboard | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### 7.3 Non-Disableable Notification Types

Per security and compliance policy, the following notification types **cannot be disabled by any user**:

| Notification Type | Reason |
|-------------------|--------|
| Security breach alerts | Regulatory (GDPR Art. 33, NDPR) |
| Payment failure | Financial integrity |
| System outage | Operational continuity |
| Legal holds | Legal compliance |
| Data breach notifications | Regulatory mandatory |
| Crisis escalation (unacknowledged) | Operational safety |
| Compliance deadline reminders | Regulatory |

All P0 alerts not listed above are non-disableable by default but may be configurable via organization policy.

---

## 8. Data Model

### 8.1 Entity: Notification

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `not_`) | No |
| `organization_id` | UUID | Organization context | No |
| `event_type` | TEXT | Event type (e.g., `crisis.detected`, `campaign.milestone`) | No |
| `event_source` | TEXT | Module that generated the event | No |
| `event_id` | TEXT | Reference to source event in originating module | Yes |
| `priority` | ENUM | `P0`, `P1`, `P2`, `P3` | No |
| `title` | TEXT | Notification title (max 200 chars) | No |
| `body` | TEXT | Notification body (max 5,000 chars) | No |
| `data` | JSONB | Structured notification payload | Yes |
| `action_url` | TEXT | Deep link URL for primary action | Yes |
| `actions` | JSONB | Array of inline action definitions | Yes |
| `icon` | TEXT | Icon identifier | Yes |
| `image_url` | TEXT | Rich media image URL | Yes |
| `requires_acknowledgment` | BOOLEAN | Whether explicit acknowledgment is required | No |
| `expires_at` | TIMESTAMPTZ | Expiry time after which notification is stale | Yes |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |

### 8.2 Entity: Notification Recipient

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `nrec_`) | No |
| `notification_id` | UUID | FK to notifications | No |
| `user_id` | UUID | FK to users | No |
| `delivery_channels` | JSONB | Channels to use: `in_app`, `email`, `push`, `sms`, `slack`, `teams` | No |
| `delivered_at` | TIMESTAMPTZ | Timestamp of first successful delivery | Yes |
| `read_at` | TIMESTAMPTZ | Timestamp when notification was opened | Yes |
| `acknowledged_at` | TIMESTAMPTZ | Timestamp when acknowledged (for P0/P1) | Yes |
| `snoozed_until` | TIMESTAMPTZ | Snooze expiry timestamp | Yes |
| `archived_at` | TIMESTAMPTZ | Archive timestamp | Yes |
| `dismissed_at` | TIMESTAMPTZ | Dismiss timestamp | Yes |
| `engagement_score` | DECIMAL | 0–1 learned engagement score | Yes |

### 8.3 Entity: Notification Delivery Log

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `ndl_`) | No |
| `notification_id` | UUID | FK to notifications | No |
| `recipient_id` | UUID | FK to notification recipients | No |
| `channel` | ENUM | `in_app`, `email`, `push`, `sms`, `slack`, `teams`, `webhook`, `voice` | No |
| `status` | ENUM | `queued`, `sent`, `delivered`, `failed`, `bounced`, `opened`, `clicked` | No |
| `attempted_at` | TIMESTAMPTZ | Attempt timestamp | No |
| `delivered_at` | TIMESTAMPTZ | Delivery confirmation timestamp | Yes |
| `failure_reason` | TEXT | Failure reason if status is `failed` or `bounced` | Yes |
| `retry_count` | INTEGER | Number of retry attempts | No |
| `external_id` | TEXT | Provider-assigned message ID | Yes |
| `metadata` | JSONB | Provider-specific delivery metadata | Yes |

### 8.4 Entity: Notification Preferences

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `np_`) | No |
| `user_id` | UUID | FK to users (unique) | No |
| `organization_id` | UUID | Organization context | No |
| `global_enabled` | BOOLEAN | Master on/off switch (P2/P3 only) | No |
| `quiet_hours_enabled` | BOOLEAN | Whether quiet hours are active | No |
| `quiet_hours_start` | TIME | Quiet hours start time | Yes |
| `quiet_hours_end` | TIME | Quiet hours end time | Yes |
| `quiet_hours_timezone` | TEXT | Timezone for quiet hours (IANA) | Yes |
| `quiet_hours_weekends` | BOOLEAN | Apply quiet hours on weekends | No |
| `vacation_mode_enabled` | BOOLEAN | Whether vacation mode is active | No |
| `vacation_start` | DATE | Vacation start date | Yes |
| `vacation_end` | DATE | Vacation end date (required if mode enabled) | Yes |
| `vacation_message` | TEXT | Auto-response message during vacation | Yes |
| `digest_enabled` | BOOLEAN | Whether digest summaries are enabled | No |
| `digest_frequency` | ENUM | `daily`, `weekly`, `never` | Yes |
| `digest_time` | TIME | Preferred digest delivery time | Yes |
| `digest_day_of_week` | INTEGER | Day of week for weekly digest (0=Sunday) | Yes |
| `default_channels` | JSONB | Default channel array | No |
| `preferences` | JSONB | Granular per-event-type preferences | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

### 8.5 Entity: Alert Rule

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `alr_`) | No |
| `organization_id` | UUID | Organization context | No |
| `name` | TEXT | Alert rule name | No |
| `description` | TEXT | Alert rule description | Yes |
| `module` | TEXT | Which module's data to monitor | No |
| `conditions` | JSONB | Structured condition definitions | No |
| `priority` | ENUM | `P0`, `P1`, `P2`, `P3` | No |
| `notification_channels` | JSONB | Channels to use when triggered | No |
| `recipients` | JSONB | User IDs, roles, or team references | No |
| `cooldown_minutes` | INTEGER | Minimum minutes between triggers | No |
| `is_active` | BOOLEAN | Whether rule is active | No |
| `last_evaluated_at` | TIMESTAMPTZ | Last rule evaluation timestamp | Yes |
| `last_triggered_at` | TIMESTAMPTZ | Last trigger timestamp | Yes |
| `trigger_count` | INTEGER | Total trigger count | No |
| `created_by_id` | UUID | User who created the rule | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

### 8.6 Entity: Alert Event

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `aev_`) | No |
| `alert_rule_id` | UUID | FK to alert rules | No |
| `triggered_at` | TIMESTAMPTZ | When the alert fired | No |
| `context` | JSONB | Data that triggered the alert | No |
| `severity_score` | DECIMAL | Computed severity (0–1) | No |
| `recipients_notified` | JSONB | Array of user IDs notified | No |
| `acknowledged_at` | TIMESTAMPTZ | Acknowledgment timestamp | Yes |
| `acknowledged_by_id` | UUID | User who acknowledged | Yes |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp | Yes |
| `resolved_by_id` | UUID | User who resolved | Yes |
| `resolution_notes` | TEXT | Resolution notes | Yes |
| `escalation_level` | INTEGER | Current escalation level (0 = not escalated) | No |
| `escalated_at` | TIMESTAMPTZ | Escalation timestamp | Yes |

### 8.7 Entity: Notification Template

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `organization_id` | UUID | Organization context | No |
| `name` | TEXT | Template name | No |
| `event_type` | TEXT | Event type this template serves | No |
| `channels` | JSONB | Channel-specific template bodies | No |
| `variables` | JSONB | Required template variable definitions | Yes |
| `is_default` | BOOLEAN | Whether this is the default template for the event type | No |
| `created_by_id` | UUID | User who created | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

### 8.8 Entity: On-Call Rotation

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `oncr_`) | No |
| `organization_id` | UUID | Organization context | No |
| `name` | TEXT | Rotation name | No |
| `rotation_type` | ENUM | `daily`, `weekly`, `custom` | No |
| `members` | JSONB | Ordered array of user IDs | No |
| `start_date` | DATE | Rotation start date | No |
| `current_index` | INTEGER | Index of current on-call member | No |
| `timezone` | TEXT | Rotation timezone (IANA) | No |
| `is_active` | BOOLEAN | Whether rotation is active | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

### 8.9 Entity: Escalation Policy

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `epol_`) | No |
| `organization_id` | UUID | Organization context | No |
| `name` | TEXT | Policy name | No |
| `description` | TEXT | Policy description | Yes |
| `steps` | JSONB | Ordered escalation steps with delay, recipients, and channels | No |
| `is_active` | BOOLEAN | Whether policy is active | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

### 8.10 Entity: Device Token

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `dtok_`) | No |
| `user_id` | UUID | FK to users | No |
| `device_type` | ENUM | `ios`, `android`, `web` | No |
| `token` | TEXT | Push notification token (unique) | No |
| `device_name` | TEXT | Human-readable device name | Yes |
| `app_version` | TEXT | App version at registration | Yes |
| `is_active` | BOOLEAN | Whether token is valid and active | No |
| `last_used_at` | TIMESTAMPTZ | Last successful push delivery | Yes |
| `created_at` | TIMESTAMPTZ | Registration timestamp | No |
| `revoked_at` | TIMESTAMPTZ | Revocation timestamp | Yes |

### 8.11 Entity: Email Suppression List

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `esl_`) | No |
| `email` | TEXT | Suppressed email address (unique) | No |
| `reason` | ENUM | `hard_bounce`, `soft_bounce`, `complaint`, `unsubscribe`, `manual` | No |
| `source` | TEXT | What triggered the suppression | No |
| `added_at` | TIMESTAMPTZ | Suppression timestamp | No |
| `expires_at` | TIMESTAMPTZ | Expiry for soft suppressions | Yes |

### 8.12 Entity: Notification Audit Log

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key (prefix: `naud_`) | No |
| `organization_id` | UUID | Organization context | No |
| `actor_id` | UUID | User who performed action (null = system) | Yes |
| `action` | TEXT | Action type (e.g., `notification.sent`, `preference.changed`, `alert.acknowledged`) | No |
| `target_type` | TEXT | Target entity type | No |
| `target_id` | TEXT | Target entity ID | No |
| `details` | JSONB | Before/after state or action context | No |
| `ip_address` | TEXT | Actor IP address | Yes |
| `request_id` | TEXT | Request correlation ID | Yes |
| `created_at` | TIMESTAMPTZ | Event timestamp | No |

### 8.13 Database Indexes

```sql
-- Inbox queries (most frequent read path)
CREATE INDEX idx_recipient_user_unread
  ON notification_recipients(user_id, delivered_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_recipient_user_recent
  ON notification_recipients(user_id, delivered_at DESC);

-- Delivery tracking
CREATE INDEX idx_delivery_notification
  ON notification_delivery_log(notification_id, channel);

CREATE INDEX idx_delivery_failures
  ON notification_delivery_log(status, attempted_at DESC)
  WHERE status IN ('failed', 'bounced');

-- Alert evaluation (hot path)
CREATE INDEX idx_alert_rules_active
  ON alert_rules(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_alert_events_unacknowledged
  ON alert_events(acknowledged_at)
  WHERE acknowledged_at IS NULL AND resolved_at IS NULL;

-- Preferences (hot path)
CREATE UNIQUE INDEX idx_preferences_user
  ON notification_preferences(user_id);

-- Device tokens
CREATE INDEX idx_device_tokens_user_active
  ON device_tokens(user_id, is_active)
  WHERE is_active = true;

-- Audit log
CREATE INDEX idx_audit_org_time
  ON notification_audit_log(organization_id, created_at DESC);

-- Full-text search on notification content
CREATE INDEX idx_notifications_search
  ON notifications
  USING GIN(to_tsvector('english', title || ' ' || body));

-- Suppression list lookup
CREATE UNIQUE INDEX idx_suppression_email
  ON email_suppression_list(email);
```

### 8.14 Data Retention

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| Active notifications | 365 days | User reference and inbox |
| Archived notifications | 2 years | Compliance and occasional reference |
| Delivery logs | 90 days (hot) + 2 years (cold) | Debugging and analytics |
| Alert history | 2 years | Audit and rule tuning |
| Notification audit log | 7 years | Regulatory compliance |
| Preference change history | 3 years | Audit |
| Device tokens | Until revoked + 90 days | Cleanup |
| Suppression list | Indefinite until manual review | Compliance |
| On-call history | 2 years | Audit |
| Bounce data | 2 years | List hygiene |

---

## 9. API Surface

### 9.1 Notification Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications` | List user's notifications with filtering and pagination | Authenticated |
| `GET` | `/api/v1/notifications/{id}` | Get notification detail | Authenticated |
| `PATCH` | `/api/v1/notifications/{id}` | Update status: read, archived, dismissed | Authenticated |
| `POST` | `/api/v1/notifications/{id}/acknowledge` | Acknowledge P0/P1 alert | Authenticated |
| `POST` | `/api/v1/notifications/{id}/snooze` | Snooze notification | Authenticated |
| `POST` | `/api/v1/notifications/{id}/action` | Take inline action (approve, assign, etc.) | Authenticated |
| `POST` | `/api/v1/notifications/bulk` | Bulk operations: mark read, archive, delete | Authenticated |
| `POST` | `/api/v1/notifications` | Create and send notification (internal / admin) | Admin |

**GET /api/v1/notifications — Query Parameters:**

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `category` | STRING | No | `P0`, `P1`, `P2`, `P3` | — |
| `is_read` | BOOLEAN | No | Filter by read status | — |
| `event_type` | STRING | No | Filter by event type | — |
| `start_date` | DATE | No | Start of date range | — |
| `end_date` | DATE | No | End of date range | — |
| `search` | STRING | No | Full-text search on title and body | — |
| `page` | INTEGER | No | Page number | 1 |
| `limit` | INTEGER | No | Items per page (max: 100) | 20 |

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "not_9f2a4b1c3d5e",
        "eventType": "crisis.detected",
        "priority": "P0",
        "title": "Crisis Mention Detected",
        "body": "@tech_influencer (250K followers) posted a negative review about your product.",
        "actionUrl": "https://app.nawebeus.com/mentions/mnt_7e3b5c2a",
        "actions": [
          { "label": "View Mention", "type": "link", "url": "/mentions/mnt_7e3b5c2a" },
          { "label": "Assign", "type": "action", "action": "assign" },
          { "label": "Acknowledge", "type": "action", "action": "acknowledge" }
        ],
        "requiresAcknowledgment": true,
        "isRead": false,
        "deliveredAt": "2026-07-22T10:30:00.000Z",
        "createdAt": "2026-07-22T10:29:45.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "pages": 1,
      "unreadCount": 5
    }
  }
}
```

---

### 9.2 Preference Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/preferences` | Get user's full preferences | Authenticated |
| `PATCH` | `/api/v1/notifications/preferences` | Update preferences | Authenticated |
| `POST` | `/api/v1/notifications/preferences/vacation` | Activate vacation mode | Authenticated |
| `DELETE` | `/api/v1/notifications/preferences/vacation` | End vacation mode | Authenticated |
| `POST` | `/api/v1/notifications/preferences/reset` | Reset preferences to defaults | Authenticated |
| `GET` | `/api/v1/notifications/preferences/templates` | List org preference templates | Authenticated |
| `POST` | `/api/v1/notifications/preferences/templates/{id}/apply` | Apply template to user | Manager, Admin |

**PATCH /api/v1/notifications/preferences — Request:**

```json
{
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "quietHoursTimezone": "Africa/Lagos",
  "quietHoursWeekends": true,
  "digestEnabled": true,
  "digestFrequency": "daily",
  "digestTime": "08:00",
  "defaultChannels": ["in_app", "email"],
  "preferences": {
    "crisis.detected": {
      "enabled": true,
      "channels": ["in_app", "email", "push", "sms"]
    },
    "campaign.milestone": {
      "enabled": true,
      "channels": ["in_app", "email"]
    },
    "report.ready": {
      "enabled": true,
      "channels": ["in_app"]
    }
  }
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "updated": true,
    "effectiveAt": "2026-07-22T10:30:30.000Z"
  }
}
```

---

### 9.3 Alert Rule Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/alert-rules` | List alert rules | Authenticated |
| `POST` | `/api/v1/notifications/alert-rules` | Create alert rule | Manager, Admin |
| `GET` | `/api/v1/notifications/alert-rules/{id}` | Get rule details | Authenticated |
| `PATCH` | `/api/v1/notifications/alert-rules/{id}` | Update rule | Manager, Admin |
| `DELETE` | `/api/v1/notifications/alert-rules/{id}` | Delete rule | Manager, Admin |
| `POST` | `/api/v1/notifications/alert-rules/{id}/test` | Test rule against historical data | Manager, Admin |
| `GET` | `/api/v1/notifications/alert-rules/{id}/history` | Alert trigger history | Authenticated |

**POST /api/v1/notifications/alert-rules — Request:**

```json
{
  "name": "Crisis Mention Detection",
  "description": "Alert when a high-influence account posts negative content about our brand",
  "module": "media_monitoring",
  "conditions": [
    { "field": "sentiment_score", "operator": "<", "value": -0.7 },
    { "field": "author_reach", "operator": ">", "value": 10000 }
  ],
  "priority": "P0",
  "notificationChannels": ["in_app", "email", "push", "sms"],
  "recipients": {
    "roles": ["admin", "manager"],
    "userIds": []
  },
  "cooldownMinutes": 5
}
```

---

### 9.4 Channel Management Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/channels` | List available channels | Authenticated |
| `POST` | `/api/v1/notifications/channels/email/configure` | Configure email settings | Admin |
| `POST` | `/api/v1/notifications/channels/push/configure` | Register push token | Authenticated |
| `POST` | `/api/v1/notifications/channels/slack/configure` | Connect Slack workspace | Admin |
| `POST` | `/api/v1/notifications/channels/teams/configure` | Connect Teams workspace | Admin |
| `POST` | `/api/v1/notifications/channels/webhook/configure` | Configure custom webhook | Admin |
| `POST` | `/api/v1/notifications/channels/{type}/test` | Send test notification | Admin |

---

### 9.5 On-Call & Escalation Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/oncall` | Get current on-call schedule and active member | System Admin |
| `POST` | `/api/v1/notifications/oncall/rotations` | Create on-call rotation | System Admin |
| `PATCH` | `/api/v1/notifications/oncall/rotations/{id}` | Update rotation | System Admin |
| `GET` | `/api/v1/notifications/escalation-policies` | List escalation policies | System Admin |
| `POST` | `/api/v1/notifications/escalation-policies` | Create escalation policy | System Admin |
| `POST` | `/api/v1/notifications/escalation-policies/{id}/test` | Test escalation chain | System Admin |

---

### 9.6 Analytics Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/analytics/delivery` | Delivery metrics by channel and type | Admin, Manager |
| `GET` | `/api/v1/notifications/analytics/engagement` | Open, click, and acknowledgment rates | Admin, Manager |
| `GET` | `/api/v1/notifications/analytics/fatigue` | Fatigue indicators: opt-outs, declining engagement | Admin |
| `GET` | `/api/v1/notifications/analytics/roi` | Notification-driven conversion metrics | Admin |
| `GET` | `/api/v1/notifications/analytics/ab-tests` | A/B test results and statistical significance | Admin |

---

### 9.7 Audit & Compliance Endpoints

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| `GET` | `/api/v1/notifications/audit-log` | Query notification audit log | Admin, Compliance, Auditor |
| `GET` | `/api/v1/notifications/compliance/reports` | Generate compliance report | Admin, Compliance |
| `POST` | `/api/v1/notifications/legal-hold` | Place legal hold on notification data | Admin, Compliance |
| `DELETE` | `/api/v1/notifications/legal-hold/{id}` | Release legal hold | Admin, Compliance |

---

### 9.8 Webhooks (Outbound Events)

The Notifications module emits webhooks for external system integration:

| Event | Description |
|-------|-------------|
| `notification.sent` | Notification dispatched to delivery queue |
| `notification.delivered` | Notification confirmed delivered to channel |
| `notification.opened` | User opened notification |
| `notification.clicked` | User clicked a notification action |
| `notification.acknowledged` | User explicitly acknowledged a P0/P1 alert |
| `notification.failed` | Notification delivery failed across all channels |
| `alert.triggered` | Alert rule condition met |
| `alert.escalated` | Alert escalated to next escalation level |
| `alert.resolved` | Alert marked as resolved |
| `preference.changed` | User updated notification preferences |

---

## 10. User Interface

### 10.1 Screen: Notification Center

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo]  Dashboard        [Search]         🔔 7   💬 3   👤 Eve ▾   │
├─────────────────────────────────────────────────────────────────────┤
│ Notifications                                  [Mark All Read] [⚙️] │
├─────────────────────────────────────────────────────────────────────┤
│ [All (12)] [Unread (5)] [Critical (2)] [High (3)] [Archived]       │
│ Filter: [All Events ▼]  Date: [Last 7 Days ▼]  Search: [_______]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 🔴 CRITICAL                                                         │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🔥 Crisis Mention Detected                        2 min ago  │   │
│ │ @tech_influencer (250K followers) posted: "Brand X's latest  │   │
│ │ product has a serious security flaw..."                       │   │
│ │ Sentiment: -0.92 │ Reach: 250K │ Respond within 1 hour      │   │
│ │ [View Mention]  [Assign]  [Acknowledge]  [Snooze 1h ▼]      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ 🟠 HIGH PRIORITY                                                    │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ⏰ SLA Breach Risk — 3 Messages                    5 min ago │   │
│ │ 3 messages in "Engagement Queue" approaching SLA in <5 min.  │   │
│ │ [View Queue]  [Reassign]  [Dismiss]                          │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 💰 Campaign Milestone: 1M Impressions Reached     12 min ago │   │
│ │ "Summer Launch 2026" hit 1,000,000 impressions 3 days early. │   │
│ │ [View Campaign]  [Share Win]  [Dismiss]                      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ 🟡 MEDIUM                                                           │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📊 Weekly Performance Report Ready                  1 h ago  │   │
│ │ Your weekly social media performance report is ready.         │   │
│ │ [View Report]  [Email PDF]  [Dismiss]                        │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ [Show older notifications ▼]                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 Screen: Notification Preferences

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ Notification Preferences                          [Save Changes]  │
├─────────────────────────────────────────────────────────────────────┤
│ Global Settings                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Quiet Hours:  [✅ Enabled]  From [10:00 PM] To [7:00 AM]     │   │
│ │ Timezone:     [Africa/Lagos ▼]   Apply on weekends: [✅]     │   │
│ │ Vacation Mode: [❌ Off]   Start: [____]   End: [____]        │   │
│ │ Digest:       [✅ Daily at 8:00 AM]                          │   │
│ │ Default Channels: [✅ In-App] [✅ Email] [❌ Push] [❌ SMS]  │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ 🔴 Critical (P0) — Cannot be disabled                              │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ • Crisis mentions       ✓ In-App  ✓ Email  ✓ Push  ✓ SMS   │   │
│ │ • Security alerts       ✓ In-App  ✓ Email  ✓ Push  ✓ SMS   │   │
│ │ • System outages        ✓ In-App  ✓ Email  ✓ Push  ✓ SMS   │   │
│ │ • Payment failures      ✓ In-App  ✓ Email  ✓ Push  ✓ SMS   │   │
│ │ ℹ️  These notifications are mandatory and cannot be disabled  │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ 🟠 High Priority (P1)                                              │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ • Campaign milestones   ☑ In-App  ☑ Email  ☐ Push  ☐ SMS  │   │
│ │ • VIP mentions          ☑ In-App  ☑ Email  ☑ Push  ☐ SMS  │   │
│ │ • Approval requests     ☑ In-App  ☑ Email  ☑ Push  ☐ SMS  │   │
│ │ • SLA breach warnings   ☑ In-App  ☑ Email  ☑ Push  ☑ SMS  │   │
│ │ • Metric anomalies      ☑ In-App  ☑ Email  ☐ Push  ☐ SMS  │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ 🟡 Medium Priority (P2)                                            │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ • New message assigned  ☑ In-App  ☐ Email  ☐ Push  ☐ SMS  │   │
│ │ • @mentions in notes    ☑ In-App  ☑ Email  ☐ Push  ☐ SMS  │   │
│ │ • Report completions    ☑ In-App  ☑ Email  ☐ Push  ☐ SMS  │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ ⚪ Low Priority (P3)                                               │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ • Tips and best practices  ☐ In-App  ☑ Email  ☐  ☐         │   │
│ │ • System updates           ☐ In-App  ☑ Email  ☐  ☐         │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ [Save Preferences]  [Reset to Defaults]  [Use Team Template ▼]     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.3 Screen: Alert Rule Configuration

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔔 Alert Rules: Engagement Hub                     [+ New Rule]    │
├─────────────────────────────────────────────────────────────────────┤
│ Active Rules (3)                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🔥 Crisis Mention                         Status: ✅ Active  │   │
│ │ IF: sentiment < -0.7 AND reach > 10,000                       │   │
│ │ THEN: P0 → In-App + Email + Push + SMS                       │   │
│ │ Cooldown: 5 min  │  Last triggered: 2 hours ago              │   │
│ │ [Edit]  [Disable]  [Test]  [View History]                    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ⏰ SLA Breach Risk (5 min warning)        Status: ✅ Active  │   │
│ │ IF: time_to_sla_breach < 300s AND status != resolved          │   │
│ │ THEN: P1 → Email + Push (assigned user)                      │   │
│ │ Cooldown: 1 min  │  Last triggered: 15 minutes ago           │   │
│ │ [Edit]  [Disable]  [Test]  [View History]                    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📈 Engagement Spike                       Status: ✅ Active  │   │
│ │ IF: mentions_last_hour > (avg_7d × 3)                         │   │
│ │ THEN: P2 → Email + In-App                                    │   │
│ │ Cooldown: 30 min  │  Last triggered: 3 days ago              │   │
│ │ [Edit]  [Disable]  [Test]  [View History]                    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ [Show inactive rules ▼]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.4 Screen: Notification Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Notification Analytics               [Last 30 Days ▼] [Export]  │
├────────────────┬────────────────┬────────────────┬──────────────────┤
│ Total Sent     │ Delivery Rate  │ Open Rate      │ Avg Response     │
│ 12,450         │ 99.2% ▲       │ 42.8% ▲       │ 4.2 min ▼       │
├────────────────┴────────────────┴────────────────┴──────────────────┤
│ Delivery Rate by Channel                                            │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │  In-App  ████████████████████████████ 99.8%                  │   │
│ │  Email   ████████████████████████░░░░ 98.1%                  │   │
│ │  Push    ████████████████████████░░░░ 97.4%                  │   │
│ │  SMS     ███████████████████████████░ 99.1%                  │   │
│ │  Slack   ████████████████████████████ 99.9%                  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ Top Performing Alert Types (by CTR)                                 │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 1. Crisis Mention        │ 78.2% CTR  │ 2.1 min avg response  │   │
│ │ 2. SLA Breach Warning    │ 91.4% CTR  │ 0.8 min avg response  │   │
│ │ 3. Campaign Milestone    │ 54.6% CTR  │ 8.4 min avg response  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ ⚠️  Fatigue Indicators                                             │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Medium-priority open rate declining: -8% this week            │   │
│ │ Recommendation: Reduce P2 frequency or increase digest use    │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Notification Templates

### 11.1 Template: Crisis Mention Detected

```json
{
  "eventType": "crisis.detected",
  "channels": {
    "email": {
      "subject": "🔥 CRISIS ALERT: {severity}/5 — {title}",
      "body": "Hi {user_name},\n\nNawebeus has detected a potential crisis affecting {brand_name}.\n\nSeverity: {severity}/5\nAlert Type: {alert_type}\nMentions: {mention_count} in the last {time_period}\n\n{description}\n\nRecommended Actions:\n• Respond within 1 hour\n• Assign to Crisis Team\n• Monitor for amplification\n\n[View Full Mention] → {action_url}\n[Respond Now] → {respond_url}\n\nThis is a P0 alert. Crisis notifications cannot be disabled.\n\nNawebeus | [Manage Preferences]"
    },
    "push": {
      "title": "🔥 CRISIS ALERT: {severity}/5",
      "body": "{title} — {mention_count} mentions from {author_handle} ({reach} reach)"
    },
    "in_app": {
      "title": "🔴 Crisis Mention Detected",
      "body": "{author_handle} ({reach} followers): \"{excerpt}\"\nSentiment: {sentiment_score} | Reach: {reach}"
    },
    "sms": {
      "body": "CRISIS ALERT: {title}. {mention_count} mentions detected. View: {short_url}"
    },
    "slack": {
      "title": "🚨 CRISIS ALERT: {severity}/5",
      "body": "*{title}*\n{description}\n*Author:* {author_handle} ({reach} followers)\n*Sentiment:* {sentiment_score}\n<{action_url}|View Full Mention>"
    }
  },
  "variables": [
    "user_name", "severity", "title", "brand_name", "alert_type",
    "mention_count", "time_period", "description", "author_handle",
    "reach", "sentiment_score", "excerpt", "action_url", "respond_url", "short_url"
  ]
}
```

### 11.2 Template: SLA Breach Warning

```json
{
  "eventType": "sla.breach_warning",
  "channels": {
    "email": {
      "subject": "⏰ SLA WARNING: {customer_name} — {time_remaining} remaining",
      "body": "Hi {user_name},\n\nA message from {customer_name} is approaching its SLA deadline.\n\nSLA Target: {sla_target}\nTime Remaining: {time_remaining}\nMessage Preview: \"{message_excerpt}\"\n\nPlease respond immediately to avoid SLA breach.\n\n[View Message] → {action_url}\n\nNawebeus | [Manage Preferences]"
    },
    "push": {
      "title": "⏰ SLA Warning",
      "body": "{customer_name} — {time_remaining} remaining to meet SLA"
    },
    "in_app": {
      "title": "⏰ SLA Breach Risk: {customer_name}",
      "body": "{time_remaining} remaining. Message: \"{message_excerpt}\""
    },
    "sms": {
      "body": "SLA WARNING: {customer_name} - {time_remaining} remaining. {short_url}"
    }
  },
  "variables": ["user_name", "customer_name", "sla_target", "time_remaining", "message_excerpt", "action_url", "short_url"]
}
```

### 11.3 Template: Post Published

```json
{
  "eventType": "post.published",
  "channels": {
    "email": {
      "subject": "✅ Post Published: {post_title}",
      "body": "Hi {user_name},\n\nYour post has been published successfully.\n\nPost: {post_title}\nPlatforms: {platforms}\nPublished: {published_at}\n\n[View Post] → {action_url}\n\nNawebeus | [Manage Preferences]"
    },
    "push": {
      "title": "✅ Post Published",
      "body": "\"{post_title}\" is now live on {platforms}"
    },
    "in_app": {
      "title": "✅ Post Published: {post_title}",
      "body": "Live on {platforms} at {published_at}"
    }
  },
  "variables": ["user_name", "post_title", "platforms", "published_at", "action_url"]
}
```

### 11.4 Template: Daily Digest

```json
{
  "eventType": "digest.daily",
  "channels": {
    "email": {
      "subject": "📊 Your Nawebeus Daily Digest — {date}",
      "body": "Good morning, {user_name}!\n\nHere's your daily summary:\n\n📰 Monitoring:\n• {new_mentions} new mentions\n• Sentiment: {sentiment_change}\n• {competitor_activity}\n\n📝 Publishing:\n• {posts_published} posts published\n• {posts_pending} posts pending approval\n\n💬 Engagement:\n• {new_messages} new messages\n• {sla_status}\n\n📊 Analytics:\n• {reports_ready} reports ready\n• {insights_count} new insights\n\n[View Full Dashboard] → {action_url}\n\nNawebeus | [Manage Digest Preferences] [Unsubscribe from Digest]"
    }
  },
  "variables": [
    "user_name", "date", "new_mentions", "sentiment_change", "competitor_activity",
    "posts_published", "posts_pending", "new_messages", "sla_status",
    "reports_ready", "insights_count", "action_url"
  ]
}
```

---

## 12. Notifications (System Self-Monitoring)

This module monitors its own health and sends notifications to administrators:

### 12.1 System Administrator Alerts

| Trigger | Priority | Channel | Recipients |
|---------|----------|---------|------------|
| Email bounce rate exceeds 5% | P1 | Email, In-app | System Admin |
| Push delivery rate drops below 95% | P1 | Email, In-app | System Admin |
| SMS provider failure | P1 | Email, In-app | System Admin |
| Notification queue lag exceeds 5 minutes | P1 | Email, In-app | System Admin |
| Channel provider outage detected | P0 | Email, SMS | System Admin, On-call |
| Suppression list grows >10% in one week | P2 | Email | System Admin |
| On-call rotation gap detected | P0 | Email, SMS | Admin |

### 12.2 User Self-Notifications

| Trigger | Priority | Channel | Recipients |
|---------|----------|---------|------------|
| Preferences updated successfully | P3 | In-app (confirmation) | User |
| New device registered for push | P1 | Email (security alert) | User |
| Vacation mode activated | P3 | Email (confirmation) | User |
| Vacation mode ended | P3 | In-app (confirmation) | User |
| Email unsubscribe processed | P3 | Email (confirmation) | User |

---

## 13. Priority Reference Matrix

For quick reference across all modules:

| Priority | Examples | Default Channels | Ack Required | Quiet Hours Bypass | User Disable |
|----------|----------|-----------------|:------------:|:------------------:|:------------:|
| **P0 Critical** | Crisis mention, security breach, payment failure, system outage, SLA breach | In-App + Email + Push + SMS | ✅ Within 5 min | ✅ Yes | ❌ No |
| **P1 High** | VIP mention, campaign milestone, approval request, metric anomaly | In-App + Email + Push | ✅ Within 1 hour | ✅ Yes | ✅ Yes |
| **P2 Medium** | New assignment, @mention, report ready, daily digest | In-App + Email | Optional | ❌ No | ✅ Yes |
| **P3 Low** | Tips, system updates, product news | In-App only | Optional | ❌ No | ✅ Yes |

---

## 14. Channel Delivery SLAs

| Channel | P0 Target | P1 Target | P2 Target | P3 Target | Fallback |
|---------|-----------|-----------|-----------|-----------|----------|
| **In-app (WebSocket)** | <2 seconds | <5 seconds | <30 seconds | <5 minutes | Polling every 60s |
| **Email** | <60 seconds | <5 minutes | <30 minutes | <4 hours | Backup provider |
| **Push (iOS/Android)** | <10 seconds | <30 seconds | <5 minutes | <30 minutes | Email |
| **SMS** | <30 seconds | <2 minutes | Not used | Not used | Email, then phone |
| **Slack** | <5 seconds | <30 seconds | <5 minutes | <30 minutes | Email |
| **Teams** | <5 seconds | <30 seconds | <5 minutes | <30 minutes | Email |
| **Voice** | <60 seconds | Not used | Not used | Not used | — |
| **Webhook** | <5 seconds | <30 seconds | <5 minutes | <30 minutes | Retry 5× |

---

## 15. Error Handling

### 15.1 Error Reference Table

| Error Code | HTTP Status | Description | User Message | Resolution |
|------------|-------------|-------------|--------------|------------|
| `NOT_NOT_FOUND` | 404 | Notification does not exist or user lacks access | Notification not found. | Check the ID or refresh your inbox |
| `NOT_P0_LOCKED` | 403 | Attempt to disable a P0 notification type | This notification type is mandatory and cannot be disabled. | Contact your administrator if this is a policy concern |
| `NOT_QUIET_HOURS_ACTIVE` | 202 | Notification queued due to active quiet hours | Notification queued — will deliver after quiet hours. | Notification will arrive at quiet hours end time |
| `NOT_VACATION_MODE` | 202 | Notification suppressed by vacation mode | User is in vacation mode — notification suppressed. | Will resume after vacation end date |
| `NOT_INVALID_CHANNEL` | 400 | Channel not configured or unavailable for this user | The selected channel is not available. | Configure the channel in settings |
| `NOT_DELIVERY_FAILED` | 500 | All channels exhausted without delivery | Notification delivery failed. We'll retry automatically. | System retries; admin alerted for P0 |
| `NOT_PREFERENCE_INVALID` | 400 | Preference value does not pass validation | Invalid preference configuration: [field] — [reason]. | Correct the preference value |
| `NOT_VACATION_DATES_INVALID` | 400 | Vacation mode missing or invalid end date | Vacation mode requires both a start date and a future end date. | Provide a valid end date |
| `NOT_ALERT_COOLDOWN` | 429 | Alert rule is within its cooldown period | Alert suppressed — rule is in cooldown for [X] minutes. | Wait for cooldown to expire |
| `NOT_ALERT_NO_RECIPIENTS` | 400 | Alert rule has no matching recipients | No recipients match this alert rule's configuration. | Update recipient roles or user list |
| `NOT_EMAIL_BOUNCED` | 422 | Recipient email address has bounced | Email address is invalid or unreachable. | Update the user's email address |
| `NOT_PUSH_TOKEN_INVALID` | 422 | Push token has expired or been revoked | Push token is no longer valid. | User must re-register their device |
| `NOT_RATE_LIMIT_EXCEEDED` | 429 | Non-critical notification rate limit reached | Rate limit reached — notification queued for next window. | Non-critical notifications resume after rate window resets |
| `NOT_PROVIDER_DOWN` | 503 | Delivery provider experiencing an outage | Delivery provider is temporarily unavailable. Fallback activated. | System handles automatically; admin alerted |
| `NOT_TEMPLATE_INVALID` | 400 | Template has missing variables or invalid syntax | Notification template is invalid: [reason]. | Fix template before sending |
| `NOT_CIRCULAR_ALERT` | 400 | Alert rule condition creates circular dependency | Alert rule condition would create a circular trigger loop. | Redesign the alert conditions |

### 15.2 Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "NOT_P0_LOCKED",
    "message": "This notification type is mandatory and cannot be disabled.",
    "details": {
      "notificationType": "crisis.detected",
      "priority": "P0",
      "policyReason": "Security and compliance policy"
    }
  },
  "meta": {
    "timestamp": "2026-07-22T10:30:00.000Z",
    "requestId": "req_9f2a4b1c3d5e"
  }
}
```

### 15.3 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Email provider down | Switch to backup provider; queue if both down; admin alerted |
| Push provider down | Fall back to email; in-app continues unaffected |
| SMS provider down | Skip SMS; escalate to next configured channel |
| WebSocket disconnected | Fall back to 60-second polling; deliver on reconnect |
| ML classification service down | Use rule-based classification only; no delivery impact |
| Analytics service down | Use cached metrics; display "data may be delayed" |
| Template rendering failure | Send plain-text fallback; alert admin |
| Rate limit service down | Use last known good config; alert admin immediately |

---

## 16. Acceptance Criteria

### 16.1 Delivery Performance

| ID | Criterion | Target | Test Method |
|----|-----------|--------|-------------|
| **AC-NOT-001** | P0 notifications deliver from trigger to recipient | <30 seconds (P95) | End-to-end timing test |
| **AC-NOT-002** | In-app notifications deliver via WebSocket | <2 seconds (P95) | Latency measurement |
| **AC-NOT-003** | Transactional email delivery | <60 seconds for 99.9%+ | Provider metrics |
| **AC-NOT-004** | Mobile push delivery rate for valid tokens | ≥99% | Provider reporting |
| **AC-NOT-005** | External integrations (Slack, Teams, webhooks) | <100ms latency at 1,000+ req/min | Load test |
| **AC-NOT-006** | Fallback channels activate on failure | Within 5 minutes | Failure simulation |
| **AC-NOT-007** | Escalation triggers for unacknowledged P0 | Within 15 minutes | Timing test |

### 16.2 Routing & Intelligence

| ID | Criterion | Target | Test Method |
|----|-----------|--------|-------------|
| **AC-NOT-008** | Smart routing accuracy | ≥95% correct channel and recipient | Routing audit |
| **AC-NOT-009** | Alert correlation reduces duplicate notifications | ≥60% reduction | Duplicate analysis |
| **AC-NOT-010** | Rate limiting enforcement | Max 10 non-critical/user/hour | Stress test |
| **AC-NOT-011** | Contextual grouping reduces volume | ≥40% without information loss | Volume comparison |

### 16.3 Preference & Policy

| ID | Criterion | Target | Test Method |
|----|-----------|--------|-------------|
| **AC-NOT-012** | Preference changes propagate | Within 30 seconds | Change propagation test |
| **AC-NOT-013** | Quiet hours enforcement | 100% suppression of P2/P3 during restricted hours | Time-based test |
| **AC-NOT-014** | Organization policy enforcement | Zero user override of compliance-mandated items | Permission test |
| **AC-NOT-015** | Bulk preference operations | 1,000 users processed in <5 minutes | Performance test |

### 16.4 Scale & Reliability

| ID | Criterion | Target | Test Method |
|----|-----------|--------|-------------|
| **AC-NOT-016** | Notification throughput | ≥10,000 per minute | Load test |
| **AC-NOT-017** | Concurrent WebSocket connections | ≥50,000 | Connection test |
| **AC-NOT-018** | Delivery reliability for P0 events | ≥99.9% success | 30-day measurement |
| **AC-NOT-019** | Email inbox placement | >98% | Sender score monitoring |
| **AC-NOT-020** | Notification history retrieval | 365 days; <2 seconds query | Retention + performance test |

### 16.5 Compliance & Analytics

| ID | Criterion | Target | Test Method |
|----|-----------|--------|-------------|
| **AC-NOT-021** | Audit log captures all notification events | 100% coverage | Completeness audit |
| **AC-NOT-022** | Email unsubscribe honored | Within 1 hour | CAN-SPAM/GDPR test |
| **AC-NOT-023** | Analytics dashboard freshness | Updated within 5 minutes | Timestamp validation |
| **AC-NOT-024** | A/B test statistical validity | p < 0.05 significance | Statistical audit |

---

## 17. Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-NOT-001** | User has no valid delivery channels (all tokens expired, email bounced) | Mark notification undeliverable; alert admin; attempt SMS as last resort for P0 |
| **EC-NOT-002** | Non-critical notification generated during quiet hours | Queue for delivery at quiet hours end time; no immediate dispatch |
| **EC-NOT-003** | P0 notification generated during quiet hours | Deliver immediately; quiet hours do not apply to P0 |
| **EC-NOT-004** | User is in vacation mode | Apply vacation auto-responder; suppress P2/P3; route P0/P1 to backup recipient |
| **EC-NOT-005** | Same event triggers 10 alerts in 1 minute | Rate limit; send 1 aggregated notification with count |
| **EC-NOT-006** | User changes preferences while notification is in-flight | Apply new preference to all subsequent notifications; current dispatch completes |
| **EC-NOT-007** | Push token expires during delivery | Mark token inactive; fall back to email; prompt user to re-register device |
| **EC-NOT-008** | Email provider returns temporary 4xx failure | Retry with exponential backoff up to 5 attempts over 15 minutes |
| **EC-NOT-009** | Escalation policy references a deleted user | Skip deleted user; escalate to next in chain; alert admin |
| **EC-NOT-010** | Alert rule circular condition detected at save | Reject with `NOT_CIRCULAR_ALERT` error at save time; do not create rule |
| **EC-NOT-011** | User has 50+ unread notifications | Group older notifications by event type; show count badge + digest view |
| **EC-NOT-012** | Webhook endpoint returns 5xx consistently | Retry with exponential backoff (5 attempts); mark failed; alert admin |
| **EC-NOT-013** | Slack workspace disconnected | Mark channel unavailable; fall back to email; notify admin |
| **EC-NOT-014** | SMS body exceeds 160 characters | Truncate with link shortener to full content; never truncate P0 alerts silently |
| **EC-NOT-015** | On-call rotation has no active member | Alert admin immediately; use org admin as fallback; log gap for audit |
| **EC-NOT-016** | All P0 recipients are simultaneously OOO | Escalate immediately; use org admin as unconditional fallback |
| **EC-NOT-017** | User reads notification on mobile; desktop shows as unread | Sync read state across all devices within 5 seconds |
| **EC-NOT-018** | A/B test variant causes significant engagement drop | Auto-pause test; revert all remaining sends to control variant; notify admin |
| **EC-NOT-019** | Notification content contains PII detected by content filter | Redact PII; notify sending system admin; prevent send if critical PII exposure |
| **EC-NOT-020** | Notification scheduled for past time due to clock skew | Send immediately with a logged warning; never silently drop |

---

## 18. Future Enhancements

| ID | Enhancement | Description | Priority | Timeline |
|----|-------------|-------------|----------|----------|
| **FE-NOT-001** | AI-Powered Notification Prioritization | ML model learns per-user relevance and re-ranks notifications dynamically | Medium | Year 2 Q1 |
| **FE-NOT-002** | Predictive Send Time Optimization | ML predicts optimal per-user send time per notification type | Medium | Year 2 Q1 |
| **FE-NOT-003** | Conversational Inline Replies | Two-way notifications with chat-like response interface inline | Medium | Year 2 Q2 |
| **FE-NOT-004** | WhatsApp Integration | Extend delivery to WhatsApp for the Nigerian market | High | Year 2 Q1 |
| **FE-NOT-005** | Voice Call Notifications | Twilio-powered voice alerts for P0 emergencies on enterprise tier | Low | Year 2 Q3 |
| **FE-NOT-006** | Advanced Notification Analytics | Cohort analysis, funnel tracking, and notification ROI dashboards | Medium | Year 2 Q2 |
| **FE-NOT-007** | Context-Aware Suppression | Auto-suppress if user is already viewing the relevant module | Medium | Year 2 Q2 |
| **FE-NOT-008** | Smartwatch Support | Apple Watch and Wear OS quick-action notifications | Low | Year 2 Q4 |
| **FE-NOT-009** | Cross-Device Continuity | Seamlessly hand off a notification from mobile to desktop | Medium | Year 2 Q3 |
| **FE-NOT-010** | Notification Volume Forecasting | Predict notification volume for capacity planning and quota management | Low | Year 2 Q4 |

---

## 19. Cross-Module Event Reference

### 19.1 Events Subscribed From Each Module

| Source Module | Event Types |
|---------------|-------------|
| **Auth** | `user.registered`, `user.password_reset`, `user.mfa_enabled`, `user.suspicious_login` |
| **Org & Users** | `org.created`, `member.invited`, `member.removed`, `role.changed` |
| **Media Monitoring** | `mention.detected`, `sentiment.spike`, `crisis.detected`, `trend.emerging` |
| **Publishing** | `post.scheduled`, `post.published`, `post.failed`, `post.approval_requested` |
| **Engagement Hub** | `message.received`, `message.assigned`, `sla.breach_warning`, `sla.breached` |
| **Analytics** | `report.ready`, `metric.anomaly`, `insight.generated`, `goal.achieved` |
| **Growth** | `campaign.milestone`, `campaign.completed`, `winner.selected` |
| **Influencer** | `content.submitted`, `content.approved`, `content.rejected` |
| **System Admin** | `system.alert`, `security.event`, `billing.issue`, `user.suspended` |

### 19.2 Integration Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Event Bus (Redis Pub/Sub / Kafka)                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ All modules publish events
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Notification Engine (Event Consumer)                                   │
│ ├── 1. Subscribe to all event types                                     │
│ ├── 2. Classify priority (P0–P3) via rules + ML                        │
│ ├── 3. Resolve recipients via role-based and skills-based routing      │
│ ├── 4. Check user preferences, quiet hours, vacation, rate limits      │
│ ├── 5. Apply batching, grouping, and deduplication                     │
│ ├── 6. Queue for multi-channel delivery                                 │
│ └── 7. Deliver + log + retry on failure                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 20. Glossary

| Term | Definition |
|------|------------|
| **APNS** | Apple Push Notification Service — iOS push delivery infrastructure |
| **Bounce** | Email delivery failure: hard bounce = permanent address failure; soft bounce = temporary failure |
| **CAN-SPAM** | US law regulating commercial email including mandatory unsubscribe |
| **Cooldown** | Minimum time between repeated triggers of the same alert rule |
| **Channel** | A delivery method: in-app, email, push, SMS, Slack, Teams, webhook, or voice |
| **Digest** | A scheduled summary of multiple non-urgent notifications consolidated into one |
| **DKIM** | DomainKeys Identified Mail — email authentication standard |
| **DMARC** | Domain-based Message Authentication, Reporting and Conformance — email security policy |
| **Escalation** | Routing an unacknowledged alert to the next level of the escalation chain |
| **FCM** | Firebase Cloud Messaging — Android and web push delivery infrastructure |
| **GDPR** | General Data Protection Regulation — EU data privacy regulation |
| **Notification Fatigue** | User desensitization caused by receiving too many low-value notifications |
| **NDPR** | Nigeria Data Protection Regulation — Nigerian data privacy law |
| **NGN** | Nigerian Naira — base currency for any financial values (symbol: ₦) |
| **On-Call Rotation** | Scheduled responsibility assignment ensuring 24/7 coverage for critical alerts |
| **Opt-Out** | User action to disable a specific notification type or channel |
| **P0 / P1 / P2 / P3** | Priority levels: P0 = Critical, P1 = High, P2 = Medium, P3 = Low |
| **Quiet Hours** | A configured time window during which non-critical notifications are suppressed |
| **Rate Limiting** | Capping notification volume per user per time window to prevent overload |
| **SPF** | Sender Policy Framework — email authentication standard |
| **Snooze** | Temporarily hiding a notification to revisit after a specified delay |
| **Suppression List** | A registry of email addresses blocked from receiving messages |
| **TCPA** | Telephone Consumer Protection Act — US regulation governing SMS and voice communications |
| **Webhook** | An HTTP callback that delivers event data to an external system endpoint |
| **WebSocket** | A bidirectional, full-duplex real-time communication protocol used for in-app delivery |

---

## 21. Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-22 | Engineering Lead | Initial Notifications & Alerts module specification — full feature set, multi-channel delivery, alert system, preference management, data model, API surface, UI wireframes, templates, and analytics |

---

*Module 9: Notifications & Alerts — Document v1.0.0 — All financial values denominated in Nigerian Naira (₦ NGN)*