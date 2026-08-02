# Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document defines the complete technical architecture for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS solution built for the Nigerian and African market. The architecture is designed to support 50,000+ organizations, 500,000+ users, and 1M+ daily social interactions while maintaining strict multi-tenant data isolation, 99.9% uptime, enterprise-grade security, and data sovereignty within Nigeria.

**Key Architectural Principles:**

| Principle                    | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Single Source of Truth**   | All business logic resides exclusively in the services layer                    |
| **Thin Entry Points**        | Web and API layers handle only validation, authentication, and response shaping |
| **Direct Calls**             | Web app calls services directly in-process — no HTTP hop for in-app operations  |
| **No Reverse Dependencies**  | Services never import from web, API, or mobile layers                           |
| **Cache First**              | Check cache before any database query                                           |
| **Rate Limit First**         | Enforce rate limits before any processing begins                                |
| **Observability by Default** | All operations are logged, traced, and monitored                                |
| **Least Privilege**          | Users have the minimum permissions needed for their role                        |
| **Security by Design**       | Defense in depth at every architectural layer                                   |
| **Data Sovereignty**         | Nigerian user data processed and stored within Nigeria                          |

**Core Technology Stack:**

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| **Runtime**  | Bun 1.0+                                                          |
| **Frontend** | TanStack Start, React 18+, TypeScript 5+, Tailwind CSS, shadcn/ui |
| **Backend**  | TanStack Start Server Functions, Hono.js, Node.js/Bun             |
| **Database** | PostgreSQL 14+ with Drizzle ORM                                   |
| **Cache**    | SQLite (bun:sql) for MVP; Redis 7+ for horizontal scaling         |
| **Storage**  | Cloudflare R2 / Bunny CDN                                         |
| **Payments** | Paystack (Nigerian payment processor, ₦-native)                   |
| **Hosting**  | Self-managed VPS in Nigeria via Coolify + WireGuard VPN           |

---

## 2. Design Philosophy

### 2.1 Core Architectural Philosophy

Nawebeus is built on the philosophy of **unification through intelligent integration**. Rather than offering disconnected point solutions, the platform provides a single unified system where media monitoring, social publishing, engagement management, analytics, PR relations, and crisis management share data models, user contexts, and AI-powered insights — delivering value greater than the sum of their parts.

The architecture is designed for a small, high-velocity engineering team that must move fast and maintain quality. Operational simplicity (single deployable service, self-hosted infrastructure, minimal external dependencies) is a first-class architectural concern.

### 2.2 Nigerian and African Market Considerations

| Consideration                         | Architectural Response                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Data sovereignty**                  | VPS hosted in Nigeria; user data does not leave Nigeria by default                            |
| **Naira-native payments**             | Paystack integration for ₦-denominated subscriptions                                          |
| **Network variability**               | Aggressive caching, offline-capable mobile app, optimistic UI                                 |
| **Nigerian media indexing**           | Custom media source connectors for Punch, Vanguard, BusinessDay, TechCabal, Channels TV, etc. |
| **WhatsApp as primary communication** | Webhook integrations for WhatsApp Business API alerting                                       |
| **Local time zone**                   | WAT (UTC+1) as default; all timestamps stored as `timestamptz`                                |

---

## 3. High-Level System Architecture

### 3.1 System Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST FLOW                                      │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │    Web App        │  │   Mobile App      │  │  Webhooks / 3rd Party    │   │
│  │    (Browser)      │  │   (Expo / RN)     │  │  (Paystack, Social APIs) │   │
│  └────────┬──────────┘  └────────┬──────────┘  └───────────┬──────────────┘  │
│           │                      │                          │                  │
│           │ SSR / Server Fns     │ HTTP/JSON               │ HTTP/JSON        │
│           ▼                      ▼                          ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        TANSTACK START SERVER                             │  │
│  │                                                                         │  │
│  │  ┌──────────────────────────────┐   ┌─────────────────────────────────┐ │  │
│  │  │   Server Functions            │   │   HONO API LAYER                │ │  │
│  │  │   (In-Process, no HTTP hop)   │◄─►│   (Mounted at /api/*)           │ │  │
│  │  │                               │   │                                 │ │  │
│  │  │   • Mutations                 │   │   • Mobile API endpoints         │ │  │
│  │  │   • Loaders                   │   │   • Webhook endpoints            │ │  │
│  │  │   • SSR Rendering             │   │   • Third-party integrations     │ │  │
│  │  │   • Type-safe end-to-end      │   │   • JWT authentication           │ │  │
│  │  └───────────────┬───────────────┘   └──────────────┬──────────────────┘ │  │
│  │                  │                                    │                    │  │
│  │                  └───────────────┬────────────────────┘                   │  │
│  │                                  ▼                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     SHARED SERVICES LAYER                          │  │  │
│  │  │                   (Single Source of Truth)                         │  │  │
│  │  │                                                                    │  │  │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │  │  │
│  │  │  │ monitoring      │ │ publishing      │ │ engagement          │  │  │  │
│  │  │  │ .service.ts     │ │ .service.ts     │ │ .service.ts         │  │  │  │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │  │  │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │  │  │
│  │  │  │ analytics       │ │ pr              │ │ crisis              │  │  │  │
│  │  │  │ .service.ts     │ │ .service.ts     │ │ .service.ts         │  │  │  │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │  │  │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │  │  │
│  │  │  │ user            │ │ notification    │ │ audit               │  │  │  │
│  │  │  │ .service.ts     │ │ .service.ts     │ │ .service.ts         │  │  │  │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                        │
│                                       ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                            DATA LAYER                                    │  │
│  │                                                                         │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │  │
│  │  │   PostgreSQL 14+  │  │  SQLite (bun:sql) │  │   Cloudflare R2      │  │  │
│  │  │   (Primary DB)    │  │  (Cache + Rate    │  │   (Object Storage)   │  │  │
│  │  │   Drizzle ORM     │  │   Limit)          │  │   Bunny CDN          │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                            │  │
│  │  │   Redis 7+        │  │ Elasticsearch    │                            │  │
│  │  │   (Year 2 — HA    │  │ (Year 2 —        │                            │  │
│  │  │   Cache Cluster)  │  │ Advanced Search) │                            │  │
│  │  └──────────────────┘  └──────────────────┘                            │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                       EXTERNAL INTEGRATIONS                              │  │
│  │                                                                         │  │
│  │  Social APIs        │  News APIs (Nigerian)  │  Paystack (₦ payments)  │  │
│  │  X (Twitter)        │  Punch, Vanguard        │  WhatsApp Business       │  │
│  │  Instagram          │  BusinessDay, TechCabal │  Google Analytics        │  │
│  │  Facebook           │  Channels TV, NTA       │  HubSpot CRM            │  │
│  │  LinkedIn, TikTok   │  Reuters, BBC Africa    │  Resend (Email)          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

Every user request — whether from the web app, mobile app, or an external webhook — passes through the following sequence:

| Step | Layer                | Action                                                                                               |
| ---- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | **Entry Point**      | Request arrives at Server Function (web), Hono route (mobile/webhook), or webhook handler            |
| 2    | **Input Validation** | Zod schema validates request payload, query parameters, and path parameters at the boundary          |
| 3    | **Authentication**   | JWT token validated; session context established; `userId` and `organizationId` extracted            |
| 4    | **Rate Limiting**    | Sliding-window rate limit checked per endpoint and per user/IP; 429 returned immediately if exceeded |
| 5    | **Authorization**    | CASL checks user's permissions for the requested resource and action                                 |
| 6    | **Cache Check**      | Service checks SQLite/Redis cache before querying the database                                       |
| 7    | **Service Call**     | Entry point calls the corresponding service method with typed inputs                                 |
| 8    | **Business Logic**   | Service executes business logic; queries database if cache misses; writes to cache on response       |
| 9    | **Audit Logging**    | Every state-changing operation writes an append-only audit log entry                                 |
| 10   | **Response Shaping** | Entry point formats the response (JSON for API; typed objects for Server Functions)                  |
| 11   | **Observability**    | Request duration, status, and context logged as structured JSON; metrics updated                     |

**Web App Request (Server Function):**

```
User action → Server Function → [Zod validate] → [Auth check] → [Rate limit]
→ [CASL check] → Service method → [Cache check] → [DB query] → [Cache write]
→ [Audit log] → Typed response → Client
```

**Mobile App Request (Hono API):**

```
HTTP request → Hono middleware → [Signature/JWT verify] → [Rate limit]
→ [Zod validate] → [CASL check] → Service method → [Cache check] → [DB query]
→ [Cache write] → [Audit log] → JSON response → Mobile client
```

**Webhook Request (Hono API):**

```
Webhook POST → Hono route → [Signature verify] → [Idempotency check]
→ [Rate limit] → [Zod validate] → Service method → [Async queue if needed]
→ 200 OK response (fast acknowledgement)
```

---

## 4. The Three Pillars and Foundation

The platform's capabilities are organized into three functional pillars plus a cross-cutting foundation:

| Layer             | Pillar       | Modules                                                                        | Purpose                                                        |
| ----------------- | ------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Foundation**    | Identity     | Authentication, User Management, RBAC, Multi-tenancy                           | Secure identity, access control, organizational isolation      |
| **Pillar 1**      | Intelligence | Media Monitoring, Social Listening, Competitive Intelligence, Crisis Detection | Real-time awareness of brand, media, and competitive landscape |
| **Pillar 2**      | Interaction  | Social Publishing, Unified Engagement Inbox, Content Calendar                  | Content creation, publishing, and audience engagement          |
| **Pillar 3**      | Insight      | Analytics & Reporting, PR Relations, Agency Management                         | Measurement, attribution, and stakeholder reporting            |
| **Cross-cutting** | Platform     | Notifications, Audit Logging, Billing (₦), System Administration               | Platform-wide capabilities shared across all modules           |

---

## 5. Entry Points

The platform exposes three distinct entry points, all sharing the same services layer. This is the architecture's most important invariant: **business logic lives in exactly one place**.

### 5.1 Web App — TanStack Start

**Purpose:** Primary user-facing interface. Uses TanStack Start for server-side rendering, routing, and Server Functions.

**What lives here:**

- React components and file-based routes
- Server Functions (mutations, loaders, SSR data fetching)
- Form state management (TanStack Form)
- Server state management (TanStack Query)
- Client state management (Zustand)
- Client-side navigation and routing

**What does NOT live here:**

- Business logic (services layer)
- Database access (services layer)
- HTTP API endpoints for the mobile app (Hono layer)
- RBAC enforcement (services layer + middleware)

**Why this matters:** Server Functions call services directly in-process with no HTTP hop. The web app is fast, type safety is end-to-end from the database schema to the React component, and business logic is in exactly one place.

### 5.2 API Layer — Hono

**Purpose:** HTTP API serving the mobile app, webhook endpoints, and third-party integrations. Mounted at `/api/*` inside the TanStack Start server — a single deployable process.

**What lives here:**

- HTTP request and response handling
- Zod validation at the network boundary
- JWT authentication middleware
- RBAC enforcement via `requirePermission` middleware
- Rate limiting middleware
- Webhook signature verification
- Idempotency key handling for webhooks
- Calling the services layer

**What does NOT live here:**

- Business logic (services layer)
- Database access (services layer)
- Web app rendering concerns (TanStack Start layer)
- Any logic duplicated from Server Functions

**Why this matters:** The mobile app and the web app execute the exact same business logic through the same services. A change to a service method immediately and correctly benefits both clients. There is no risk of diverging implementations.

### 5.3 Mobile App — React Native + Expo

**Purpose:** Cross-platform mobile client for iOS and Android. A thin client that calls the Hono API.

**What lives here:**

- React Native UI components and screens
- HTTP API client (typed, generated from OpenAPI spec)
- Local state management (Zustand, TanStack Query)
- Secure token storage (Expo SecureStore for JWTs)
- Non-sensitive local storage (AsyncStorage for preferences)
- Offline support: limited evidence upload queue and content draft cache
- Push notification receipt handling (FCM/APNs)

**What does NOT live here:**

- Business logic (services layer on the server)
- Direct database access (the mobile app communicates only with the API)
- RBAC enforcement (enforced by the Hono API; the mobile app renders based on the result)

**Why this matters:** The mobile app is intentionally thin. When business logic changes, the mobile app benefits automatically. New features are built in the services layer and exposed via the API — the mobile app only needs to add the UI.

### 5.4 Webhooks

**Purpose:** Inbound callbacks from external systems — Paystack payment events, social platform event notifications, and future third-party integrations.

**Pattern:**

1. Hono route receives the POST request
2. Middleware verifies the signature (HMAC-SHA256 for Paystack; platform-specific for social APIs)
3. Idempotency key checked to prevent duplicate processing
4. Zod validates the payload shape
5. Service method is called
6. If processing is slow, the event is queued for async processing
7. 200 OK returned immediately to acknowledge receipt

---

## 6. The Services Layer

The services layer is the **architectural core** of Nawebeus. Every business operation — regardless of whether it originates from the web app, the mobile app, a webhook, or a background job — passes through a service method.

### 6.1 Service Method Contract

Every service method adheres to the following contract:

| Obligation                | Description                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Typed inputs**          | Accepts TypeScript-typed parameters; Zod validation performed at the calling entry point      |
| **Typed outputs**         | Returns TypeScript-typed results; never returns untyped `any`                                 |
| **Errors as values**      | Returns `Result<T, E>` for expected business errors; throws only for unexpected system errors |
| **Cache awareness**       | Checks cache before database; writes to cache after successful database operations            |
| **Audit logging**         | Every state-changing operation writes an audit log entry before returning                     |
| **Notification emission** | Emits notifications or events as a side effect of relevant state changes                      |
| **Stateless**             | Services hold no mutable state; all state lives in the database and cache                     |
| **Documented**            | Every public method has JSDoc with parameter descriptions, return type, and example           |

**A service method does NOT:**

- Handle HTTP request or response objects
- Parse or validate raw request bodies (the entry point validates before calling)
- Authenticate the caller (middleware does this before the entry point reaches the service)
- Render or format UI output

### 6.2 Service Modules

| Service Module           | File                      | Purpose                                                                                    |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------ |
| Authentication           | `auth.service.ts`         | Login, logout, token refresh, MFA, OAuth                                                   |
| Organization             | `organization.service.ts` | Organization CRUD, billing, subscription management, white-label settings                  |
| User                     | `user.service.ts`         | User profile, team management, invitations, role assignment                                |
| Media Monitoring         | `monitoring.service.ts`   | Media mention ingestion, coverage feed, alert triggers, Nigerian media indexing            |
| Social Listening         | `listening.service.ts`    | Social mention monitoring, query management, sentiment processing                          |
| Crisis Management        | `crisis.service.ts`       | Crisis detection, severity classification, stakeholder notification, post-crisis reporting |
| Publishing               | `publishing.service.ts`   | Content creation, scheduling, multi-platform distribution, approval workflows              |
| Engagement               | `engagement.service.ts`   | Unified inbox, message routing, response management, SLA tracking                          |
| Analytics                | `analytics.service.ts`    | KPI calculation, report generation, predictive analytics, data export                      |
| PR Relations             | `pr.service.ts`           | Journalist CRM, press release creation and distribution, coverage tracking                 |
| Competitive Intelligence | `competitive.service.ts`  | Competitor tracking, share of voice calculation, gap analysis                              |
| Agency Management        | `agency.service.ts`       | Multi-client workspace management, white-label reporting                                   |
| Notification             | `notification.service.ts` | Push, email, SMS, WhatsApp, in-app notification delivery                                   |
| Audit                    | `audit.service.ts`        | Append-only audit log writes and queries                                                   |
| RBAC                     | `rbac.service.ts`         | CASL ability definitions, permission resolution                                            |
| Billing                  | `billing.service.ts`      | Paystack subscription management, ₦ invoice generation, usage metering                     |

### 6.3 The Import Boundary Rule

The import boundary is enforced by ESLint (`import/no-restricted-paths`) and is the single most important structural rule in the codebase:

```
app/                → can import from: services, lib, shared-types
server/             → can import from: services, lib, shared-types
mobile/             → can import from: shared-types ONLY
                       (NOT from app/, server/, or services/)
services/           → can import from: lib, shared-types, db, cache, rate-limit
lib/                → can import from: shared-types, db (query helpers only)
db/                 → can import from: shared-types
cache/              → can import from: shared-types
rate-limit/         → can import from: shared-types
shared-types/       → no imports from any other internal module
```

**The reverse dependency is absolutely forbidden.** `services/` cannot import from `app/`, `server/`, or `mobile/`. Violations break the build in CI.

**Why this matters:** If services could import from the web or API layers, business logic would inevitably drift into those layers. The import boundary makes it structurally impossible to violate the single source of truth principle.

---

## 7. Data Layer

### 7.1 Storage Systems Overview

| Store                | Technology (MVP)             | Technology (Year 2+)              | Purpose                                                          |
| -------------------- | ---------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Primary Database** | PostgreSQL 14+ (Drizzle ORM) | PostgreSQL 14+ with read replicas | All persistent, relational business data                         |
| **Cache**            | SQLite (bun:sql)             | Redis 7+ Cluster                  | Query result caching, session data, rate limiting                |
| **Rate Limiting**    | SQLite (bun:sql)             | Redis 7+                          | Per-endpoint, per-user sliding window rate limits                |
| **Object Storage**   | Cloudflare R2                | Cloudflare R2 + Bunny CDN         | Media assets, report exports, press release attachments, backups |
| **Search**           | PostgreSQL `tsvector`        | Elasticsearch 8+                  | Full-text search across media coverage and social content        |

### 7.2 PostgreSQL Schema Conventions

**Identifier Format:** All primary keys use prefixed text IDs:

| Entity          | Prefix  | Example       |
| --------------- | ------- | ------------- |
| Users           | `usr_`  | `usr_9f2a4b`  |
| Organizations   | `org_`  | `org_7e3b2c`  |
| Media mentions  | `ment_` | `ment_4a1d9e` |
| Published posts | `post_` | `post_2b8f1a` |
| Conversations   | `conv_` | `conv_5c3e7b` |
| Reports         | `rep_`  | `rep_1f6d4c`  |
| Journalists     | `jrn_`  | `jrn_8d2a5f`  |
| Press releases  | `pr_`   | `pr_3b7c1e`   |
| Alerts          | `alrt_` | `alrt_6e4f2d` |
| Audit entries   | `aud_`  | `aud_9a1b3c`  |

**Universal Schema Rules:**

| Rule                              | Implementation                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Timestamps on every table         | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| Soft deletes for recoverable data | `deleted_at TIMESTAMPTZ` nullable; hard deletes only for DSAR compliance                            |
| Organization isolation            | Every multi-tenant table has `organization_id TEXT NOT NULL REFERENCES organizations(id)`           |
| Status columns                    | PostgreSQL `ENUM` type rather than free-text strings                                                |
| Foreign keys                      | Always indexed; cascade behavior explicitly documented per relationship                             |
| Full-text search                  | `tsvector` columns on searchable content; `GIN` index for performance                               |

### 7.3 Core Table Groups

**Identity and Organization:**

```
organizations          — Organization accounts (brands, agencies)
├── organization_id (PK, org_*)
├── name, slug, industry, size
├── plan_tier (ENUM: starter, growth, professional, enterprise, agency)
├── subscription_id, paystack_customer_id
├── white_label_settings (JSONB)  ← for agency tier
└── is_active, created_at, updated_at

users
├── user_id (PK, usr_*)
├── email, display_name, avatar_url
├── password_hash (bcrypt, cost 10 via Bun.password)
├── mfa_enabled, mfa_secret (encrypted)
├── last_login_at, failed_login_count
└── created_at, updated_at

organization_members
├── member_id (PK)
├── organization_id (FK → organizations)
├── user_id (FK → users)
├── role (ENUM: owner, admin, manager, creator, analyst, viewer)
└── invited_by, joined_at
```

**Media Monitoring:**

```
media_sources
├── source_id (PK)
├── name, url, source_type (ENUM: newspaper, blog, broadcast, wire, social)
├── country, region, language
├── credibility_score, estimated_reach
└── is_active, last_indexed_at

media_mentions
├── mention_id (PK, ment_*)
├── organization_id (FK)
├── source_id (FK → media_sources)
├── headline, excerpt, full_url
├── author, publication_date
├── sentiment_score (-100 to +100)
├── estimated_reach, sov_impact
├── severity_level (ENUM: noise, watch, respond, escalate, allhands)
├── search_vector (tsvector)  ← full-text search
└── created_at

monitoring_campaigns
├── campaign_id (PK)
├── organization_id (FK)
├── name, keywords (JSONB), competitor_ids (JSONB)
├── alert_threshold, notification_channels (JSONB)
└── is_active, created_at, updated_at
```

**Social Publishing:**

```
posts
├── post_id (PK, post_*)
├── organization_id (FK)
├── content_text, content_variants (JSONB)  ← per-platform variants
├── platforms (TEXT[])
├── status (ENUM: draft, pending_approval, scheduled, publishing, published, failed)
├── scheduled_at, published_at
├── approval_required, approved_by, approved_at
├── created_by (FK → users)
└── created_at, updated_at

post_assets
├── asset_id (PK)
├── post_id (FK → posts)
├── asset_url, asset_type (ENUM: image, video, gif, document)
├── platform_specific (JSONB)  ← platform-specific formatting
└── created_at

publishing_results
├── result_id (PK)
├── post_id (FK → posts)
├── platform, platform_post_id
├── status (ENUM: success, failed, retrying)
├── error_message, retry_count
└── published_at
```

**Engagement Inbox:**

```
conversations
├── conversation_id (PK, conv_*)
├── organization_id (FK)
├── platform, platform_conversation_id
├── customer_handle, customer_display_name
├── customer_follower_count, is_verified, influence_tier
├── status (ENUM: open, assigned, pending, resolved, closed)
├── priority (ENUM: critical, high, medium, low)
├── assigned_to (FK → users), assigned_at
├── first_message_at, last_message_at, resolved_at
└── sla_due_at, sla_breached

messages
├── message_id (PK)
├── conversation_id (FK → conversations)
├── direction (ENUM: inbound, outbound)
├── content_text, content_raw (JSONB)
├── sentiment_score, is_complaint, is_crisis_signal
├── sent_by (FK → users), sent_at
└── platform_message_id
```

**Crisis Management:**

```
crisis_incidents
├── incident_id (PK)
├── organization_id (FK)
├── title, description
├── severity (ENUM: s1_noise, s2_watch, s3_respond, s4_escalate, s5_allhands)
├── status (ENUM: detected, assessing, responding, monitoring, resolved)
├── origin_platform, origin_mention_id (FK → media_mentions)
├── detected_at, responded_at, resolved_at
└── created_at

crisis_stakeholder_notifications
├── notification_id (PK)
├── incident_id (FK → crisis_incidents)
├── user_id (FK → users), notification_channel
├── sent_at, acknowledged_at
└── message_text

crisis_responses
├── response_id (PK)
├── incident_id (FK → crisis_incidents)
├── response_text, response_type
├── platforms (TEXT[])
├── drafted_by (FK → users), approved_by (FK → users)
├── status (ENUM: draft, pending_approval, approved, published)
└── published_at
```

**Analytics and Reporting:**

```
reports
├── report_id (PK, rep_*)
├── organization_id (FK)
├── report_type (ENUM: brand_health, social_performance, executive, crisis, campaign, competitive, agency_client)
├── config (JSONB)  ← metric selections, date range, chart config
├── is_scheduled, schedule_cron, next_run_at
├── recipients (JSONB)  ← email addresses or user IDs
├── white_label_org_id (FK → organizations, nullable)  ← agency white-label
└── created_by (FK → users), created_at, updated_at

pr_value_calculations
├── calc_id (PK)
├── organization_id (FK)
├── mention_id (FK → media_mentions)
├── estimated_reach, source_authority_score
├── sentiment_multiplier, pr_value_naira NUMERIC(15,2)  ← in ₦
└── calculated_at
```

**Journalist CRM:**

```
journalists
├── journalist_id (PK, jrn_*)
├── full_name, email, phone
├── publication_id (FK → media_sources)
├── beat_topics (TEXT[])
├── twitter_handle, twitter_follower_count
├── influence_score, preferred_contact_method
└── created_at, updated_at

journalist_interactions
├── interaction_id (PK)
├── journalist_id (FK → journalists)
├── organization_id (FK)
├── interaction_type (ENUM: email_sent, press_release_sent, coverage_received, call, meeting)
├── notes, press_release_id (FK → press_releases, nullable)
└── interacted_at, created_by (FK → users)
```

**Billing (Naira-native):**

```
subscriptions
├── subscription_id (PK)
├── organization_id (FK)
├── plan_tier (ENUM: starter, growth, professional, enterprise, agency)
├── billing_cycle (ENUM: monthly, annual)
├── amount_naira NUMERIC(12,2)
├── paystack_subscription_id, paystack_customer_id
├── status (ENUM: active, past_due, cancelled, trialing)
├── trial_ends_at, current_period_start, current_period_end
└── created_at, cancelled_at

invoices
├── invoice_id (PK)
├── organization_id (FK)
├── subscription_id (FK)
├── amount_naira NUMERIC(12,2), tax_naira NUMERIC(12,2)
├── status (ENUM: draft, open, paid, void)
├── paystack_reference
├── issued_at, due_at, paid_at
└── invoice_pdf_url (R2)
```

### 7.4 Multi-Tenant Data Isolation

Multi-tenant isolation is enforced at three independent layers, providing defense in depth:

**Database Level (PostgreSQL Row-Level Security):**

```sql
-- Every multi-tenant table has RLS enabled
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;

-- Read policy: users can only see their organization's data
CREATE POLICY "org_isolation_select" ON media_mentions
  FOR SELECT USING (organization_id = current_setting('app.current_org_id'));

-- Write policy: users can only write to their organization's data
CREATE POLICY "org_isolation_insert" ON media_mentions
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id'));
```

**Application Level (Middleware):**

- JWT token includes `organization_id` claim (set at login)
- Hono middleware validates that the authenticated user is a member of the requested organization
- `organization_id` is automatically injected into every database session via `SET app.current_org_id`
- Cross-organization requests return `403 Forbidden` immediately

**Service Level (Code):**

- Every service method that operates on multi-tenant data accepts `organizationId` as a required typed parameter
- Services never execute a query without an `organization_id` filter
- Service method signatures make it impossible to accidentally query without tenant context

---

## 8. Cross-Cutting Patterns

### 8.1 Cache Layer

**MVP Technology:** SQLite via `bun:sql` (no separate service to deploy or operate)
**Year 2 Technology:** Redis 7+ Cluster (required for horizontal scaling across multiple application instances)

**Cache Key Convention:**

```
{resource_type}:{primary_identifier}[:{sub_identifier}]
```

| Cache Key                       | TTL        | Purpose                       |
| ------------------------------- | ---------- | ----------------------------- |
| `permissions:usr_{id}`          | 5 minutes  | CASL ability cache per user   |
| `org:settings:{id}`             | 15 minutes | Organization configuration    |
| `mention:feed:{id}:{page}`      | 2 minutes  | Paginated mention feed        |
| `sentiment:trend:{id}:{period}` | 10 minutes | Sentiment trend calculation   |
| `sov:{id}:{period}`             | 30 minutes | Share of voice calculation    |
| `report:data:{id}`              | 5 minutes  | Report data before generation |
| `user:profile:{id}`             | 10 minutes | User profile data             |
| `crisis:active:{id}`            | 30 seconds | Active crisis incident data   |

**Cache Operations Protocol:**

```
READ:
  1. Generate cache key
  2. Check cache → hit: return value
  3. Miss → query database
  4. Write result to cache with TTL
  5. Return value

WRITE:
  1. Write to database (transactional)
  2. Invalidate affected cache keys (by key or by tag)
  3. Optionally write new value to cache (write-through)
```

**Cache Invalidation Strategies:**

| Strategy                    | When Used                                                                     |
| --------------------------- | ----------------------------------------------------------------------------- |
| **TTL expiry**              | All cached values; TTL set per resource type                                  |
| **Direct key invalidation** | After a write to a specific resource                                          |
| **Tag-based invalidation**  | Bulk invalidation (e.g., all cache for an organization after settings change) |
| **Write-through**           | High-read, infrequent-write data (user permissions)                           |

### 8.2 Rate Limiting

**Algorithm:** Sliding window (more accurate than fixed window for burst detection)
**Storage:** SQLite (MVP); Redis (Year 2)

**Rate Limit Key:**

```
ratelimit:{endpoint_name}:{user_id_or_ip}
```

**Default Rate Limits:**

| Endpoint Category                  | Requests / Minute | Requests / Hour   | Burst Tolerance               |
| ---------------------------------- | ----------------- | ----------------- | ----------------------------- |
| Authentication (login, signup)     | 5 per IP          | 20 per IP         | None                          |
| API reads (general)                | 100 per user      | 2,000 per user    | 20%                           |
| API writes (general)               | 50 per user       | 500 per user      | 10%                           |
| Content publishing                 | 30 per user       | 200 per user      | None                          |
| Report generation                  | 10 per user       | 50 per user       | None                          |
| Crisis alerts                      | 200 per user      | 2,000 per user    | 50% (crisis is time-critical) |
| Webhook endpoints                  | 1,000 per source  | 10,000 per source | 100%                          |
| Public endpoints (unauthenticated) | 10 per IP         | 100 per IP        | None                          |

**Rate Limit Response:**

```json
HTTP 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before retrying.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2026-07-21T10:31:00.000Z",
      "retry_after_seconds": 47
    }
  }
}
```

### 8.3 Authentication

| Component                       | Implementation                                                    |
| ------------------------------- | ----------------------------------------------------------------- |
| **Token format**                | JWT, signed with HS256                                            |
| **Access token lifetime**       | 15 minutes                                                        |
| **Refresh token lifetime**      | 7 days (sliding window, rotating)                                 |
| **Token storage (web)**         | `httpOnly` cookie, `Secure`, `SameSite=Strict`                    |
| **Token storage (mobile)**      | Expo SecureStore (encrypted at rest)                              |
| **Password hashing**            | bcrypt via `Bun.password` (cost factor 10)                    |
| **Multi-factor authentication** | TOTP (optional for all users; enforced for Admin and Owner roles) |
| **Session invalidation**        | Refresh token revocation list in SQLite/Redis                     |

**JWT Payload Structure:**

```json
{
  "sub": "usr_9f2a4b",
  "org": "org_7e3b2c",
  "role": "manager",
  "email": "ade.ogunleye@firstbank.com",
  "iat": 1721560200,
  "exp": 1721561100,
  "jti": "tok_abc123def456"
}
```

### 8.4 Authorization (RBAC)

**Library:** CASL

**Permission Model:**

| Component                   | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Role-based defaults**     | Each role has a standard set of abilities defined in `rbac.service.ts`                             |
| **Per-user overrides**      | Admins can grant or revoke individual permissions for specific users                               |
| **Conditional permissions** | Abilities include conditions (e.g., `{ createdBy: user.id }` — user can only edit their own posts) |
| **Resource ownership**      | Certain operations require ownership of the resource (e.g., archiving own content)                 |

**Role Hierarchy:**

| Role        | Capabilities                                                              |
| ----------- | ------------------------------------------------------------------------- |
| **Owner**   | Full access; cannot be demoted by others; owns billing                    |
| **Admin**   | Full access except billing; can manage all users and settings             |
| **Manager** | Can manage team members below their level; content approval authority     |
| **Creator** | Can create and submit content for approval; cannot approve                |
| **Analyst** | Read-only access to analytics and reporting; cannot publish               |
| **Viewer**  | Read-only access to dashboards and reports; no content or settings access |

**RBAC Enforcement Layers:**

1. **Hono middleware:** `requirePermission('publish:posts')` before reaching the route handler
2. **Service layer:** checks permission before executing business logic
3. **Database query layer:** Row-Level Security policies on sensitive tables

**Self-Protection Rules:**

- Owners and Admins cannot suspend their own accounts
- Admins cannot change their own role
- The last Owner/Admin cannot be removed (prevents lockout)
- All RBAC mutations are audit-logged

### 8.5 Error Handling

**Typed Error Hierarchy:**

```
Error
├── ValidationError
│   ├── InvalidInputError          — Bad field value; includes field name and expectation
│   ├── MissingRequiredFieldError  — Required field absent
│   └── SchemaFormatError          — Data format mismatch (date, UUID, etc.)
│
├── AuthenticationError
│   ├── InvalidTokenError          — JWT malformed or signature invalid
│   ├── ExpiredTokenError          — JWT past expiry; refresh token needed
│   └── InvalidCredentialsError    — Wrong email/password combination
│
├── AuthorizationError
│   ├── InsufficientPermissionError — User lacks required permission
│   ├── ResourceAccessError         — Resource belongs to different organization
│   └── RoleRequiredError           — Operation requires a specific minimum role
│
├── BusinessError
│   ├── DuplicateEntryError         — Unique constraint violation (duplicate keyword, etc.)
│   ├── ResourceNotFoundError       — Requested resource does not exist
│   ├── ResourceStateError          — Operation invalid given current resource state
│   └── ConstraintViolationError    — Business rule violation
│
├── RateLimitError
│   ├── LimitExceededError          — Rate limit hit; includes retry-after
│   └── BlockedError                — IP or user temporarily blocked
│
└── SystemError
    ├── DatabaseError               — PostgreSQL query failed
    ├── CacheError                  — SQLite/Redis operation failed
    ├── StorageError                — R2 operation failed
    └── ExternalServiceError        — Social API, Paystack, or other external service failed
```

**Standardized API Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSION",
    "message": "You do not have permission to publish posts for this organization.",
    "details": {
      "required_permission": "publish:posts",
      "user_role": "analyst",
      "resource_type": "post",
      "resource_id": "post_2b8f1a"
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "request_id": "req_abc123def456"
  }
}
```

**HTTP Status Code Mapping:**

| Error Type              | HTTP Status               |
| ----------------------- | ------------------------- |
| `ValidationError`       | 422 Unprocessable Entity  |
| `AuthenticationError`   | 401 Unauthorized          |
| `AuthorizationError`    | 403 Forbidden             |
| `ResourceNotFoundError` | 404 Not Found             |
| `DuplicateEntryError`   | 409 Conflict              |
| `RateLimitError`        | 429 Too Many Requests     |
| `SystemError`           | 500 Internal Server Error |
| Unhandled errors        | 500 Internal Server Error |

### 8.6 Observability

**Three Pillars:**

| Pillar      | Technology                                      | Purpose                                                   |
| ----------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Logs**    | Structured JSON → stdout → Loki / ELK           | Request tracing, error investigation, audit               |
| **Metrics** | Prometheus counters/gauges/histograms → Grafana | Performance dashboards, SLA monitoring, capacity planning |
| **Traces**  | OpenTelemetry (Year 2) → Jaeger/Tempo           | Distributed request tracing, slow query identification    |

**Structured Log Format:**

```json
{
  "level": "info",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "message": "Post published successfully",
  "method": "POST",
  "path": "/api/posts/publish",
  "status": 201,
  "duration_ms": 143,
  "user_id": "usr_9f2a4b",
  "organization_id": "org_7e3b2c",
  "request_id": "req_abc123def456",
  "post_id": "post_2b8f1a",
  "platforms": ["twitter", "instagram", "linkedin"]
}
```

**What is NEVER logged (PII and secrets protection):**

- Passwords, password hashes, or partial passwords
- JWT tokens or refresh tokens
- Paystack API keys or webhook secrets
- Social platform OAuth tokens
- Full credit card details or bank account numbers
- User PII (full name, email, phone) at INFO level or above in production
- Any personal data in error stack traces

**Key Metrics to Monitor:**

| Metric                               | Alert Threshold          |
| ------------------------------------ | ------------------------ |
| API error rate                       | >1% of requests          |
| P95 API response time                | >500ms                   |
| Database query P95                   | >200ms                   |
| Cache hit rate                       | <70%                     |
| Crisis alert delivery latency        | >2 minutes               |
| Failed publishing rate               | >0.5% of scheduled posts |
| Paystack webhook processing failures | >0 (all must succeed)    |

### 8.7 Audit Logging

Every state-changing operation writes an append-only audit log entry:

**Audit Log Entry:**

```json
{
  "id": "aud_9a1b3c4d",
  "action": "crisis.incident.severity.updated",
  "actor_user_id": "usr_9f2a4b",
  "actor_organization_id": "org_7e3b2c",
  "resource_type": "crisis_incident",
  "resource_id": "inc_4d5e6f",
  "changes": {
    "before": { "severity": "s3_respond" },
    "after": { "severity": "s4_escalate" }
  },
  "reason": "Volume exceeding 1000 mentions/hour",
  "ip_address": "197.210.55.23",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
  "timestamp": "2026-07-21T10:30:00.000Z"
}
```

**Audit Log Invariants:**

- **Append-only:** No updates or deletes; DSAR-driven data removal is itself logged as a separate entry
- **Comprehensive:** Covers all CREATE, UPDATE, DELETE, and sensitive READ operations
- **Retained for 7 years:** Compliance with NDPR (Nigeria Data Protection Regulation)
- **Queryable:** Engineering team and designated compliance officers can query; results paginated
- **Encrypted at rest:** Audit log storage encrypted with AES-256; backups encrypted

---

## 9. Security Architecture

### 9.1 Security Principles

| Principle                       | Implementation                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Defense in depth**            | RBAC at three independent layers; encryption at multiple levels; audit logging of all state changes |
| **Least privilege**             | CASL conditions; per-user overrides; no implicit grants; role hierarchy respected                   |
| **Zero trust**                  | Every request authenticated and authorized, even requests arriving from "internal" services         |
| **Encryption everywhere**       | TLS 1.3 in transit; AES-256 at rest for all persistent data                                         |
| **Audit by default**            | Every state change logged; append-only; 7-year retention                                            |
| **Fail safe**                   | Default deny — when authorization is ambiguous, deny and log                                        |
| **No secrets in code**          | All secrets in environment variables; rotated at least annually; never committed to Git             |
| **No PII in logs**              | Structured logger enforces PII exclusion at INFO level and above in production                      |
| **Input validation everywhere** | Zod schema validation at every entry point boundary                                                 |

### 9.2 Encryption Strategy

**In Transit:**

- TLS 1.3 for all HTTP traffic (Nginx termination; Cloudflare edge)
- HSTS (HTTP Strict Transport Security) with `max-age=31536000; includeSubDomains; preload`
- Certificate pinning for mobile apps (Year 2)

**At Rest:**

- AES-256 encryption for PostgreSQL (Transparent Data Encryption)
- AES-256 server-side encryption for Cloudflare R2
- Encrypted PostgreSQL backups (AES-256, KMS-managed keys)
- SecureStore encryption for mobile JWT storage (OS-managed key)

**Application Level:**

- bcrypt for password hashing (never stored in plain text)
- Encrypted JWT payloads (HS256 signed; sensitive claims excluded)
- Encrypted Paystack and social platform API keys (KMS-managed)
- Encrypted WhatsApp Business API tokens

### 9.3 Network Security

```
Internet
   │
   ▼
Cloudflare (DDoS protection, WAF, TLS termination)
   │
   ▼
WireGuard VPN (public-key-only access to server)
   │
   ▼
UFW Firewall (only ports 80, 443, WireGuard UDP open)
   │
   ▼
Nginx (reverse proxy, rate limiting, request logging)
   │
   ▼
Bun application process
```

### 9.4 Threat Model

| Threat                  | Mitigation                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| Unauthorized access     | JWT authentication, MFA for privileged roles, rate limiting on auth endpoints |
| Privilege escalation    | CASL RBAC, least privilege defaults, self-protection rules, audit logging     |
| Data breach (external)  | AES-256 encryption at rest and in transit, Cloudflare WAF, firewall           |
| Data breach (internal)  | Row-level security, audit logging, need-to-know data access                   |
| DDoS attack             | Cloudflare DDoS protection, rate limiting, connection limits                  |
| SQL injection           | Parameterized queries via Drizzle ORM (never raw string interpolation)        |
| XSS                     | React's automatic escaping, Content Security Policy headers                   |
| CSRF                    | SameSite=Strict cookies, CSRF tokens for state-changing forms                 |
| Session hijacking       | httpOnly cookies, Secure flag, short-lived access tokens                      |
| Supply chain attack     | Dependency pinning, `npm audit` in CI, Dependabot alerts                      |
| Nigerian-specific risks | Data sovereignty (VPS in Nigeria), Paystack fraud detection, NDPR compliance  |

### 9.5 Compliance Posture

| Regulation                                    | Requirement                                                        | Implementation                                                     |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **NDPR** (Nigeria Data Protection Regulation) | Data sovereignty, DSAR rights, breach notification within 72 hours | Nigerian-hosted VPS, DSAR workflow, incident response plan         |
| **GDPR**                                      | For users accessing from EU                                        | Data processing agreements, right to erasure, data portability     |
| **CCPA**                                      | For users from California                                          | Opt-out mechanisms, data inventory                                 |
| **Platform ToS**                              | Twitter/X, Instagram, Facebook, LinkedIn API terms                 | Rate limit compliance, prohibited use prevention, API key rotation |

---

## 10. Performance Architecture

### 10.1 Performance Targets

| Metric                                           | Target                       | Measurement                      |
| ------------------------------------------------ | ---------------------------- | -------------------------------- |
| Web app initial load (SSR + hydration)           | <2 seconds (P95)             | Lighthouse, real-user monitoring |
| Dashboard interactive                            | <3 seconds from navigation   | TanStack Query prefetch + SSR    |
| API read (cache hit)                             | <50ms (P95)                  | Prometheus histogram             |
| API read (cache miss)                            | <200ms (P95)                 | Prometheus histogram             |
| API write (simple)                               | <100ms (P95)                 | Prometheus histogram             |
| API write (complex — notifications, multi-table) | <500ms (P95)                 | Prometheus histogram             |
| Crisis alert delivery                            | <2 minutes from detection    | Alert timestamp tracking         |
| Media mention indexing                           | <15 minutes from publication | Ingestion pipeline monitoring    |
| Mobile app cold start                            | <3 seconds to interactive    | Expo performance profiling       |
| Mobile API call                                  | <1 second (P95)              | Network + server combined        |
| Report generation (standard)                     | <30 seconds                  | Background job timing            |
| Report generation (complex — 12-month agency)    | <5 minutes                   | Background job timing            |

### 10.2 Performance Optimization Patterns

| Pattern                      | Implementation                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Cache first**              | SQLite cache checked before every database read                                                         |
| **Optimistic UI**            | Publishing, engagement responses show immediate feedback; sync in background                            |
| **SSR with prefetch**        | TanStack Start SSR renders initial data; TanStack Query prefetches next pages                           |
| **Lazy loading**             | Non-critical frontend routes and components loaded on demand                                            |
| **Image optimization**       | WebP format, responsive `srcset`, ImageKit processing via CDN                                           |
| **Database indexing**        | All foreign keys, `organization_id` columns, `created_at` columns, and `tsvector` columns indexed       |
| **Connection pooling**       | PgBouncer transaction-mode pooling for PostgreSQL (max 100 application connections → 10 DB connections) |
| **Code splitting**           | Tree-shaking enabled; dynamic imports for large charting libraries                                      |
| **API response compression** | Brotli compression on all API responses >1KB                                                            |
| **Background processing**    | Long-running operations (report generation, bulk publishing) moved to background jobs                   |

---

## 11. Scalability Strategy

### 11.1 Scaling Phases

| Phase       | Timeline   | Organizations | Users          | MAU     | Infrastructure                                                  |
| ----------- | ---------- | ------------- | -------------- | ------- | --------------------------------------------------------------- |
| **Pilot**   | 2026 Q3-Q4 | 50–300        | 500–3,000      | 5,000   | Single VPS: 4 vCPU, 8 GB RAM, 200 GB SSD                        |
| **Phase 2** | 2027       | 300–2,000     | 3,000–15,000   | 30,000  | Single VPS: 8 vCPU, 16 GB RAM, 500 GB SSD                       |
| **Year 2**  | 2027-2028  | 2,000–7,000   | 15,000–50,000  | 100,000 | 2× VPS + Redis + PostgreSQL read replica                        |
| **Year 3**  | 2028-2029  | 7,000–25,000  | 50,000–175,000 | 500,000 | Multiple VPS + Redis Cluster + Elasticsearch + CDN optimization |

### 11.2 Scaling Decision Triggers

| Metric               | Trigger                       | Action                                                          |
| -------------------- | ----------------------------- | --------------------------------------------------------------- |
| CPU utilization      | >70% sustained for 15 minutes | Vertical scale (upgrade VPS)                                    |
| Memory utilization   | >80% sustained for 15 minutes | Vertical scale                                                  |
| P95 API response     | >500ms consistently           | Add read replica; optimize queries; add cache                   |
| Cache hit rate       | <70%                          | Increase cache TTLs; review cache key design                    |
| Database connections | >80% of pool limit            | Add PgBouncer pool; consider connection limits per organization |
| Storage I/O          | >80% utilization              | Migrate to managed PostgreSQL with storage scaling              |
| Concurrent users     | >5,000                        | Evaluate horizontal scaling; add Redis for distributed sessions |

### 11.3 Horizontal Scaling Architecture (Year 2+)

```
                         Cloudflare (DDoS + CDN)
                                  │
                          Nginx Load Balancer
                         /         │          \
                        /          │           \
              App Instance 1   App Instance 2   App Instance 3
                        \          │           /
                         \         │          /
                          Redis Cluster (shared sessions + cache)
                                  │
                    ┌─────────────┴────────────┐
                    │                          │
             PostgreSQL Primary         PostgreSQL Read
             (writes)                   Replica (reads)
```

---

## 12. Deployment Architecture

### 12.1 Infrastructure Diagram

```
                          Internet
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Cloudflare           │
                  │  - DDoS Protection    │
                  │  - WAF                │
                  │  - TLS Termination    │
                  │  - Static Asset CDN   │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  WireGuard VPN        │
                  │  (Public-key only     │
                  │   admin access)       │
                  └───────────┬───────────┘
                              │ Encrypted tunnel
                              ▼
  ┌───────────────────────────────────────────────────────┐
  │               Self-Hosted VPS (Nigeria)               │
  │                                                       │
  │  ┌─────────────────────────────────────────────────┐  │
  │  │  Nginx (Reverse Proxy)                           │  │
  │  │  - SSL termination (Let's Encrypt)              │  │
  │  │  - Request rate limiting (nginx limit_req)      │  │
  │  │  - Static file serving                          │  │
  │  │  - Health check endpoint                        │  │
  │  └──────────────────┬──────────────────────────────┘  │
  │                     │                                  │
  │                     ▼                                  │
  │  ┌─────────────────────────────────────────────────┐  │
  │  │  Bun Application Process (systemd managed)      │  │
  │  │                                                  │  │
  │  │  ┌──────────────────┐  ┌───────────────────────┐│  │
  │  │  │ TanStack Start   │  │ Hono API              ││  │
  │  │  │ (Web App + SSR)  │  │ (Mobile + Webhooks)   ││  │
  │  │  └────────┬─────────┘  └──────────┬────────────┘│  │
  │  │           └──────────┬─────────────┘             │  │
  │  │                      ▼                           │  │
  │  │  ┌─────────────────────────────────────────────┐│  │
  │  │  │  Services Layer (Business Logic)             ││  │
  │  │  └──────────┬──────────────────────────────────┘│  │
  │  │             ├──────────────────┐                 │  │
  │  │             ▼                  ▼                 │  │
  │  │  ┌─────────────────┐  ┌─────────────────────┐  │  │
  │  │  │   PostgreSQL     │  │  SQLite (bun:sql)    │  │  │
  │  │  │   (Drizzle ORM)  │  │  Cache + Rate Limit  │  │  │
  │  │  └─────────────────┘  └─────────────────────┘  │  │
  │  └─────────────────────────────────────────────────┘  │
  │                                                       │
  │  External: Cloudflare R2 (file storage, accessed      │
  │  via signed URLs — data leaves VPS only for uploads)  │
  └───────────────────────────────────────────────────────┘
```

### 12.2 Deployment Strategy

**Standard Deployments — Blue-Green:**

```
1. Build new Docker image → tag as "green"
2. Deploy green to staging environment
3. Run automated smoke tests against staging
4. Run database migrations (backward-compatible)
5. Health check green until passing
6. Nginx: switch traffic from blue → green (zero downtime)
7. Monitor error rates and P95 for 30 minutes
8. If clean: decommission blue
9. If issues: nginx switch back to blue (rollback in <60 seconds)
```

**High-Risk Deployments — Canary:**

```
1. Deploy to green (same as above)
2. Route 5% of traffic to green; 95% stays on blue
3. Monitor for 30 minutes
4. If clean: increase to 25%, then 50%, then 100%
5. If issues at any stage: route 100% back to blue
```

### 12.3 Environment Strategy

| Environment                | Purpose                                 | Data Policy                             | Access                                                      |
| -------------------------- | --------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| **Development**            | Local developer testing                 | Synthetic seed data only                | Developer's local machine                                   |
| **Staging**                | Pre-production integration testing      | Anonymized copy of production schema    | Engineering team via VPN                                    |
| **Production**             | Live system                             | Real user data; full NDPR compliance    | Automated CI/CD only; manual via VPN with 2-person approval |
| **DR (Disaster Recovery)** | Failover in case of primary VPS failure | Continuously replicated from production | Activated by Engineering Lead only                          |

### 12.4 CI/CD Pipeline

```
Git Push → GitHub Actions

  ┌─────────────────────────────────────────────────────────┐
  │ Pipeline Steps                                          │
  │                                                         │
  │ 1. Install dependencies (Bun)                          │
  │ 2. TypeScript type check (tsc --noEmit)                │
  │ 3. ESLint (including import boundary enforcement)       │
  │ 4. Unit tests (Bun test)                               │
  │ 5. Integration tests (against test PostgreSQL)         │
  │ 6. Build (Bun build)                                   │
  │ 7. Docker image build                                  │
  │ 8. Security scan (Trivy)                              │
  │ 9. Deploy to staging                                   │
  │ 10. Smoke tests                                        │
  │ 11. Deploy to production (main branch only)            │
  └─────────────────────────────────────────────────────────┘
```

---

## 13. Disaster Recovery

### 13.1 Recovery Objectives

| Component             | RPO (Maximum Data Loss)                  | RTO (Maximum Downtime)       |
| --------------------- | ---------------------------------------- | ---------------------------- |
| PostgreSQL (primary)  | 1 hour (WAL archiving every 5 minutes)   | 30 minutes                   |
| SQLite cache          | 24 hours (cache can be rebuilt)          | 5 minutes (restart rebuilds) |
| Cloudflare R2 (files) | 0 (cross-region replication)             | 15 minutes                   |
| Application code      | 0 (versioned in Git)                     | 5 minutes                    |
| Configuration secrets | 0 (stored in encrypted password manager) | 10 minutes                   |
| Audit logs            | 0 (off-site backup + cold storage)       | 1 hour                       |

### 13.2 Backup Strategy

| Backup Subject            | Frequency                           | Retention            | Storage                                       | Encryption |
| ------------------------- | ----------------------------------- | -------------------- | --------------------------------------------- | ---------- |
| Full PostgreSQL backup    | Daily at 02:00 WAT                  | 30 days              | Encrypted off-site (Backblaze B2)             | AES-256    |
| PostgreSQL WAL archiving  | Every 5 minutes                     | 7 days               | Encrypted off-site                            | AES-256    |
| SQLite cache backup       | Daily at 03:00 WAT                  | 7 days               | Encrypted off-site                            | AES-256    |
| Application configuration | On every change                     | Indefinite           | Git (encrypted secrets via git-crypt)         | AES-256    |
| Audit logs                | Daily at 05:00 WAT                  | 7 years              | Encrypted cold storage (Backblaze B2 Glacier) | AES-256    |
| Cloudflare R2 objects     | Continuous cross-region replication | 30 days (versioning) | Cloudflare's distributed network              | AES-256    |

### 13.3 Disaster Recovery Runbook (Summary)

```
DR Trigger: Primary VPS unreachable for >10 minutes

1. Engineering Lead declares DR event
2. DNS TTL reduced to 60 seconds (done proactively; normally 300s)
3. DR environment activated (pre-warmed, runs in cold standby)
4. Latest PostgreSQL backup restored to DR database
5. WAL logs applied to minimize data loss
6. Application deployed to DR environment
7. DNS updated to point to DR IP
8. Health checks validated
9. Stakeholders notified (internal Slack + customer status page)
10. Root cause investigation begins on primary
11. Primary restored and tested
12. Traffic migrated back to primary
13. DR event post-mortem within 48 hours
```

---

## 14. API Design Standards

### 14.1 REST Conventions

| Convention       | Rule                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| HTTP methods     | `GET` reads; `POST` creates; `PUT` replaces; `PATCH` partial update; `DELETE` removes |
| URL structure    | Plural nouns for resources: `/api/posts`, `/api/journalists`, `/api/reports`          |
| URL casing       | kebab-case: `/api/press-releases`, `/api/media-mentions`                              |
| Nesting depth    | Maximum 2 levels: `/api/organizations/{id}/members` (never 3+ levels)                 |
| Query parameters | camelCase: `?sortBy=createdAt&filterBy=negative`                                      |

**HTTP Status Codes:**

| Scenario                                         | Status Code                          |
| ------------------------------------------------ | ------------------------------------ |
| Successful read                                  | 200 OK                               |
| Resource created                                 | 201 Created (with `Location` header) |
| Successful delete / async accepted               | 204 No Content                       |
| Validation error                                 | 422 Unprocessable Entity             |
| Unauthorized (no/invalid token)                  | 401 Unauthorized                     |
| Forbidden (valid token, insufficient permission) | 403 Forbidden                        |
| Resource not found                               | 404 Not Found                        |
| Conflict (duplicate)                             | 409 Conflict                         |
| Rate limited                                     | 429 Too Many Requests                |
| Server error                                     | 500 Internal Server Error            |
| Service temporarily unavailable                  | 503 Service Unavailable              |

### 14.2 Standard API Response Envelope

**Success:**

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "request_id": "req_abc123def456"
  }
}
```

**Success with Pagination:**

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "cursor": "eyJpZCI6InBvc3RfMmI4ZjFhIn0=",
    "has_more": true,
    "total_count": 247
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "request_id": "req_abc123def456"
  }
}
```

### 14.3 Pagination

- **Algorithm:** Cursor-based (opaque base64-encoded JSON cursor); never offset-based
- **Default page size:** 20 items
- **Maximum page size:** 100 items
- **Rationale:** Cursor-based pagination is stable under concurrent inserts and performant at scale; offset pagination degrades at high page numbers and is inconsistent under concurrent writes

### 14.4 API Versioning

- Breaking changes require a new version prefix: `/api/v2/`
- Previous versions supported for minimum 6 months after deprecation announcement
- Deprecated endpoints return response headers: `Deprecation: true` and `Sunset: Sat, 21 Jan 2028 00:00:00 GMT`
- OpenAPI specification versioned alongside the API

---

## 15. Full Technology Stack

### 15.1 Frontend

| Component    | Technology     | Version | Rationale                                      |
| ------------ | -------------- | ------- | ---------------------------------------------- |
| Framework    | TanStack Start | Latest  | Full-stack React with SSR and Server Functions |
| UI Library   | React          | 18+     | Industry standard; concurrent features         |
| Language     | TypeScript     | 5+      | End-to-end type safety                         |
| Styling      | Tailwind CSS   | Latest  | Utility-first; consistent with design system   |
| Components   | shadcn/ui      | Latest  | Accessible, unstyled, composable               |
| Forms        | TanStack Form  | Latest  | Type-safe form handling                        |
| Validation   | Zod            | Latest  | Runtime type validation; shared with backend   |
| Server State | TanStack Query | Latest  | Caching, synchronization, background refetch   |
| Client State | Zustand        | Latest  | Lightweight, minimal boilerplate               |
| Charts       | Recharts       | Latest  | React-native chart library                     |
| Data Tables  | TanStack Table | Latest  | Headless, flexible, high-performance           |
| Maps         | Mapbox GL JS   | Latest  | Geographic data visualization                  |
| Icons        | Lucide Icons   | Latest  | Consistent, open-source icon set               |

### 15.2 Backend

| Component      | Technology       | Version  | Rationale                                                 |
| -------------- | ---------------- | -------- | --------------------------------------------------------- |
| Runtime        | Bun              | 1.0+     | Faster cold start, native TypeScript, built-in SQLite     |
| Web Framework  | TanStack Start   | Latest   | SSR + Server Functions; unified with frontend             |
| API Framework  | Hono             | Latest   | Lightweight, fast, TypeScript-first                       |
| Language       | TypeScript       | 5+       | Type safety throughout                                    |
| ORM            | Drizzle ORM      | Latest   | TypeScript-first, lightweight, works natively with Bun    |
| Primary DB     | PostgreSQL       | 14+      | Relational integrity, full-text search, JSON support, RLS |
| Cache          | SQLite (bun:sql) | Built-in | Sub-millisecond, no separate service to operate           |
| RBAC           | CASL             | Latest   | Role-based, resource-based, conditional permissions       |
| Validation     | Zod              | Latest   | Shared schemas between frontend and backend               |
| Email          | Resend           | Latest   | Transactional email; Nigerian domain delivery             |
| Payments       | Paystack         | Latest   | Nigerian payment processor; ₦-native                      |
| File Storage   | Cloudflare R2    | -        | Cost-effective object storage; Bunny CDN for delivery     |
| Error Tracking | Sentry           | Latest   | Real-time error monitoring with source maps               |

### 15.3 Mobile

| Component          | Technology                    | Version | Rationale                             |
| ------------------ | ----------------------------- | ------- | ------------------------------------- |
| Framework          | React Native + Expo           | Latest  | Cross-platform; shares types with web |
| Language           | TypeScript                    | 5+      | Consistent with web codebase          |
| Navigation         | Expo Router                   | Latest  | File-based routing                    |
| State Management   | Zustand + TanStack Query      | Latest  | Same as web                           |
| Secure Storage     | Expo SecureStore              | Latest  | Encrypted token storage               |
| Push Notifications | Expo Notifications (FCM/APNs) | Latest  | Crisis alerts, inbox notifications    |
| Offline            | AsyncStorage + queue          | Latest  | Offline draft caching                 |

### 15.4 Infrastructure

| Component             | Technology                 | Rationale                                        |
| --------------------- | -------------------------- | ------------------------------------------------ |
| Hosting               | Self-managed VPS (Nigeria) | Data sovereignty; full control; cost-effective   |
| Deployment Management | Coolify                    | Self-hosted PaaS; blue-green deployments         |
| Containerization      | Docker + Docker Compose    | Reproducible builds; easy deployment             |
| Reverse Proxy         | Nginx                      | SSL termination; load balancing; request logging |
| VPN                   | WireGuard                  | Secure admin access; public-key only             |
| CDN                   | Cloudflare                 | DDoS protection; static assets; WAF              |
| File CDN              | Bunny CDN                  | Cost-effective media delivery across Africa      |
| Monitoring            | Prometheus + Grafana       | Metrics collection and dashboards                |
| Logging               | Loki + Grafana             | Log aggregation and search                       |
| Error Tracking        | Sentry                     | Application error monitoring                     |
| CI/CD                 | GitHub Actions             | Automated test, build, and deploy pipeline       |
| Certificates          | Let's Encrypt (Certbot)    | Automated TLS certificate management             |

---

## 16. Architecture Decision Records (ADRs)

Key architectural decisions are documented and versioned:

| ADR         | Decision                                             | Rationale                                                                                                                             |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-001** | Bun as the primary runtime                           | Faster cold start than Node.js, native TypeScript execution, built-in SQLite, better ESM support                                      |
| **ADR-002** | TanStack Start + Hono as a single deployable service | Operational simplicity for a small team; avoids microservices complexity at this scale                                                |
| **ADR-003** | PostgreSQL as the primary database                   | Relational integrity for complex data models, built-in full-text search, JSON support, Row-Level Security for multi-tenancy           |
| **ADR-004** | SQLite (bun:sql) for MVP cache and rate limiting     | No separate service to deploy or operate; sufficient for single-instance; migrates cleanly to Redis when horizontal scaling is needed |
| **ADR-005** | Drizzle ORM                                          | TypeScript-first, lightweight, works natively with Bun, generates clean SQL                                                           |
| **ADR-006** | CASL for RBAC                                        | Role-based and resource-based permissions with conditions; integrates well with TypeScript; supports per-user overrides               |
| **ADR-007** | Paystack for payments                                | Nigerian payment processor; ₦-native pricing and invoicing; strong local bank integration; proven reliability in the Nigerian market  |
| **ADR-008** | Self-hosted VPS in Nigeria behind WireGuard          | Data sovereignty for NDPR compliance; full operational control; cost efficiency; Cloudflare for edge security                         |
| **ADR-009** | Single services layer shared by web and mobile       | Prevents business logic divergence between clients; changes benefit all entry points simultaneously                                   |
| **ADR-010** | Cursor-based pagination over offset                  | Stable under concurrent writes; performant at large page numbers; consistent result sets                                              |

---

## 17. Open Architectural Questions

| #   | Question                                                                                              | Owner                           | Status | Target Resolution  |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------- | ------ | ------------------ |
| 1   | At what user/org scale does SQLite cache become insufficient and Redis migration mandatory?           | Engineering Lead                | Open   | Q2 2027            |
| 2   | Should we adopt OpenTelemetry for distributed tracing in Year 1 or Year 2?                            | Engineering Lead                | Open   | Q1 2027            |
| 3   | When should we migrate from self-managed PostgreSQL to a managed service (e.g., Supabase, Neon)?      | Engineering Lead                | Open   | Q3 2027            |
| 4   | Should we build a public developer API for third-party integrations in Year 2?                        | Engineering Lead + Product Lead | Open   | Q4 2026 (decision) |
| 5   | At what scale do we need Elasticsearch to replace PostgreSQL full-text search?                        | Engineering Lead                | Open   | Q3 2027            |
| 6   | Should we build WhatsApp notification delivery as a first-class integration (not just webhook relay)? | Engineering Lead + Product Lead | Open   | Q1 2027            |
| 7   | When do we move from Docker Compose to Kubernetes?                                                    | Engineering Lead                | Open   | Year 3 (tentative) |

---

## 18. Document Approvals

| Role             | Name               | Signature  | Date       |
| ---------------- | ------------------ | ---------- | ---------- |
| Engineering Lead | ********\_******** | ****\_**** | **\_\_\_** |
| Product Lead     | ********\_******** | ****\_**** | **\_\_\_** |
| Security Lead    | ********\_******** | ****\_**** | **\_\_\_** |
| DevOps Lead      | ********\_******** | ****\_**** | **\_\_\_** |

---

## 19. Related Documents

| Document                   | Relationship                                                                      |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Tech Stack**             | Detailed technology evaluation and choice rationale                               |
| **ADRs**                   | Full architectural decision records with alternatives considered                  |
| **Database Schema**        | Complete PostgreSQL schema with migration history                                 |
| **Security Policy**        | Detailed security controls, incident response, and compliance procedures          |
| **Infrastructure Runbook** | Deployment procedures, monitoring playbooks, and disaster recovery runbook        |
| **API Reference**          | OpenAPI specification for the Hono API layer                                      |
| **Engineering Standards**  | Coding standards, testing requirements, and code review process                   |
| **Personas**               | User personas that inform architectural priorities (e.g., Nigerian media context) |
| **User Journeys**          | End-to-end journeys that inform performance and reliability requirements          |

---

## Document Version History

| Version | Date       | Author           | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-07-21 | Engineering Lead | Unified and expanded Architecture document. Merges and improves both source documents into a single authoritative reference. Adds: Nigerian market architectural considerations (data sovereignty, Paystack integration, WAT timezone, Nigerian media indexing), complete PostgreSQL schema conventions with billing tables in ₦, expanded multi-tenant isolation with RLS examples, detailed cache key design, complete rate limit table, JWT payload structure, full threat model, NDPR compliance, disaster recovery runbook summary, complete CI/CD pipeline, ADR table, scaling decision triggers, horizontal scaling architecture diagram, and open architectural questions with target resolution dates. |

---

_This document is owned by the Engineering Lead and reviewed quarterly, or immediately following any significant architectural change. All engineering decisions affecting system architecture must reference this document and be recorded as ADRs._
