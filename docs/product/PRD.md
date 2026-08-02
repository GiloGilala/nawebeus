# Nawebeus — Social Media Management Platform
## Product Requirements Document (PRD)
**Document Version:** 1.0.0
**Date:** 2026-07-20
**Status:** Draft
**Owner:** Product Management
**Document Type:** Product → PRD
**Framework:** Universal Product Documentation Framework (UPDF)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Product Overview](#3-product-overview)
4. [Product Scope](#4-product-scope)
5. [User Needs & Problems](#5-user-needs--problems)
6. [User Personas](#6-user-personas)
7. [Product Principles](#7-product-principles)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [User Experience Requirements](#11-user-experience-requirements)
12. [Technical Architecture Overview](#12-technical-architecture-overview)
13. [Constraints](#13-constraints)
14. [Assumptions](#14-assumptions)
15. [Dependencies](#15-dependencies)
16. [Risks & Mitigation](#16-risks--mitigation)
17. [Release Criteria](#17-release-criteria)
18. [Post-Launch Roadmap](#18-post-launch-roadmap)
19. [Glossary](#19-glossary)
20. [Document Governance](#20-document-governance)
21. [Approval](#21-approval)

---

## 1. Executive Summary

Nawebeus is a unified social media management and intelligence platform that empowers businesses, brands, and agencies to accelerate audience growth, monitor brand presence in real time, engage effectively with their communities, and measure performance across multiple social and news channels — all from a single, coherent interface.

The platform is designed first for African organizations — PR teams, marketing teams, and agencies that need enterprise-grade social media and brand intelligence at locally viable pricing in Nigerian Naira (₦), with NDPR compliance and Nigerian business-hours support — while being globally competitive against international incumbents.

This Product Requirements Document (PRD) defines **what** Nawebeus will be in its Minimum Viable Product (MVP v1.0) release: the product vision, scope, user needs, functional requirements for all ten modules, non-functional requirements, success metrics, constraints, and release criteria. Detailed functional specifications are documented in the **Functional Requirements Document (FRD)** and per-module specification documents.

**MVP v1.0 delivers ten integrated modules:**

| Module | Capability | Primary Value |
|--------|-----------|---------------|
| **Authentication & User Management** | Registration, login, MFA, session management | Secure access and identity |
| **Organization & Account Management** | Multi-tenant structure, RBAC, billing | Platform governance |
| **Social Media Integration** | OAuth connections to 5 social platforms | Data ingestion foundation |
| **Grow** | Viral giveaway and growth campaigns | Audience acquisition and engagement |
| **Listen** | Real-time social listening with AI sentiment | Brand conversation monitoring |
| **Monitor** | Media and press monitoring with SOV tracking | Earned media intelligence |
| **Engage** | Unified inbox with intelligent routing | Community management at scale |
| **Analyze** | Consolidated analytics and custom reporting | ROI measurement and intelligence |
| **Notifications & Alerts** | Multi-channel alert delivery | Crisis and performance awareness |
| **System Administration** | Platform governance and compliance | Operational oversight |

All figures in this document are expressed in **Nigerian Naira (₦) as the primary currency**. USD equivalents are provided at ₦1,600/USD, reviewed quarterly per the exchange rate policy in Business.md §5.7.

---

## 2. Product Vision

### 2.1 Vision Statement

> **"To become the single command center — and the single source of truth — where every brand, business, and agency orchestrates their entire social media and PR presence: from growth campaigns to crisis response, eliminating the fragmentation that plagues modern digital marketing, built for Africa and competitive globally."**

### 2.2 Product Mission

Nawebeus accelerates audience growth, deepens brand intelligence, and unifies community engagement for modern marketing teams by consolidating the fragmented social media tool landscape into one integrated, intelligent, and intuitive platform — with Naira pricing, NDPR compliance, and local support for African organizations.

### 2.3 Strategic Positioning

| Element | Description |
|---------|-------------|
| **Primary Market** | African enterprises, PR teams, marketing agencies (Nigeria-first) |
| **Secondary Market** | Mid-market brands globally (50–999 employees) and digital agencies |
| **Core Value Proposition** | "The first unified social media and PR platform built for Africa" |
| **Differentiation** | All five core capabilities natively; Naira billing; NDPR compliance; mid-market pricing |
| **Competitive Advantage** | 50–87% cost savings vs. assembling equivalent tools; African-first commercial model no competitor can replicate |

### 2.4 Core Value Propositions by Persona

#### For Marketing Directors (Maya) and CMOs (Chidi)
- **Unified ROI visibility** — one dashboard spanning social, earned media, and campaign performance
- **Executive-ready reporting** — C-suite dashboards with KPIs and business impact
- **Cost consolidation** — replace 6–10 tools billed in USD with one Naira subscription
- **Compliance assurance** — NDPR-compliant platform passes enterprise procurement security reviews

#### For Social Media Managers (Sam) and Content Strategists (Kemi)
- **Multi-channel efficiency** — manage all platforms from one interface; eliminate context-switching
- **Real-time intelligence** — never miss important brand conversations
- **Unified inbox** — respond to all messages and mentions in one place

#### For Agency Account Directors (Alex) and Agency Owners (Ifeoma)
- **Multi-client management** — isolated workspaces for every client; one login
- **Automated client reporting** — branded reports without manual assembly
- **Scalable workflows** — onboard new clients without proportional overhead

#### For PR Managers (Priya) and Crisis Managers (Ngozi)
- **Real-time crisis detection** — mentions, sentiment spikes, and crisis alerts before they escalate
- **Media and press monitoring** — track press coverage, journalist relationships, and Share of Voice
- **Integrated PR workflows** — from press release creation to coverage tracking in one tool

#### For Data Analysts (Dana) and Digital Analysts (Tunde)
- **Cross-module analytics** — correlate data across Grow, Listen, Monitor, and Engage
- **Custom reports** — build reports aligned to specific business questions
- **Data export** — CSV, PDF, Excel for deeper analysis or BI tool ingestion

#### For Community Managers (Casey)
- **Unified inbox** — all messages, comments, and DMs in one organized workspace
- **Response templates** — respond faster with canned responses and smart suggestions
- **Conversation routing** — right team member handles the right message

---

## 3. Product Overview

### 3.1 Platform Architecture Summary

Nawebeus is a **multi-tenant SaaS platform** that delivers ten integrated modules through a single unified interface, sharing one data model, one authentication layer, and one billing system.

```
┌─────────────────────────────────────────────────────────────────┐
│                          NAWEBEUS                               │
│                     Unified Platform Layer                      │
├──────────┬──────────┬──────────┬──────────┬────────────────────┤
│   GROW   │  LISTEN  │ MONITOR  │  ENGAGE  │      ANALYZE       │
│          │          │          │          │                    │
│ Giveaway │ Social   │ Press &  │ Unified  │ Cross-platform     │
│ campaigns│ listening│ media    │ inbox    │ KPIs, reports,     │
│ & viral  │ sentiment│ tracking │ routing  │ competitive intel  │
│ mechanics│ analysis │ SOV      │ workflow │ CSV/PDF export     │
├──────────┴──────────┴──────────┴──────────┴────────────────────┤
│                 Shared Services & Data Model                    │
│   Auth · RBAC · Notifications · Audit Log · Multi-tenancy      │
│   Billing (Paystack/Stripe) · System Admin · Social Integration │
├─────────────────────────────────────────────────────────────────┤
│                      Integration Layer                          │
│   YouTube · X · Instagram · Facebook · Reddit · News APIs      │
│            Paystack (₦) · Stripe (USD) · Resend                │
└─────────────────────────────────────────────────────────────────┘
```

The five core intelligence modules are not five separate applications sharing a login. They are five expressions of a unified data model. A mention captured by **Listen** can trigger an engagement workflow in **Engage**, appear in a **Monitor** SOV report, contribute to an **Analyze** dashboard, and inform audience targeting in **Grow** — automatically, without manual data transfer.

### 3.2 Key Differentiators

| Differentiator | Description | Why It Matters |
|----------------|-------------|----------------|
| **Unified five-in-one platform** | All five capabilities sharing one data model | Data flows between modules automatically; no reconciliation |
| **African-first commercial model** | Naira pricing; Paystack billing; NDPR compliance; local support | No international competitor offers this combination |
| **Enterprise multi-tenancy by design** | Schema-level and row-level isolation from Day 1 | Agency and enterprise customers trust data never bleeds |
| **Real-time intelligence** | Streaming mention ingestion; sub-minute sentiment; crisis alerts | Respond to brand events in minutes, not hours |
| **Self-hostable** | Full platform on customer infrastructure via Coolify | Data sovereignty for regulated industries and government |
| **Transparent Naira pricing** | No hidden fees; no percentage of ad spend; no punitive overages | Budget certainty for Nigerian finance teams |

---

## 4. Product Scope

### 4.1 In Scope — MVP v1.0

#### 4.1.1 Core Platform Capabilities

| Capability | Description | Priority |
|------------|-------------|----------|
| **Authentication & User Management** | Registration, login, email verification, password management, TOTP MFA, session management, device tracking | P0 |
| **Organization & Workspace Management** | Multi-tenant org structure, team invitations, role management, subscription management | P0 |
| **RBAC** | Owner, Admin, Manager, Analyst, Viewer roles enforced across all modules | P0 |
| **Social Media Integration** | OAuth connections to YouTube, X, Instagram, Facebook, Reddit | P0 |
| **Notifications & Alerts** | Email and in-app notifications; configurable per user and per alert type | P0 |
| **Billing & Subscription** | Paystack (Naira primary); Stripe (USD international); plan management; usage tracking | P0 |
| **Audit Logging** | Immutable audit log of all write operations for compliance | P0 |
| **System Administration** | Admin panel; tenant management; usage monitoring; feature flags | P0 |

#### 4.1.2 The Five Core Intelligence Modules

| Module | Key Features | Priority |
|--------|-------------|----------|
| **Grow** | Campaign builder; multi-step entry mechanics; participant management; fraud detection; winner selection with audit trail; campaign analytics | P0 |
| **Listen** | Boolean keyword query builder; real-time mention ingestion; AI sentiment classification; mention spike detection; crisis alerting; saved searches; influence scoring | P0 |
| **Monitor** | Media and news source monitoring; article collection and deduplication; SOV calculation; competitor tracking; coverage alerts; media contact management | P0 |
| **Engage** | Unified inbox aggregating comments, mentions, DMs, and replies; conversation threading; team assignment; internal notes; canned responses; SLA tracking; engagement analytics | P0 |
| **Analyze** | Unified dashboard; custom report builder; competitive benchmarking; flexible date ranges; scheduled report delivery; CSV and PDF export | P0 |

#### 4.1.3 Platform Integrations

| Integration | Purpose | Priority |
|-------------|---------|----------|
| **YouTube Data API v3** | Video platform data; mentions; analytics | P0 |
| **X (Twitter) API v2** | Microblogging mentions; engagement; analytics | P0 |
| **Instagram Graph API** | Photo/video platform mentions; engagement | P0 |
| **Facebook Graph API** | Social network pages; mentions; engagement | P0 |
| **Reddit API** | Community platform mentions; brand monitoring | P0 |
| **NewsAPI + Mediastack** | Global news source monitoring for Monitor module | P0 |
| **African news RSS feeds** | Regional press coverage for Nigerian and African publications | P0 |
| **Paystack** | Naira subscription billing; Nigerian payment methods | P0 |
| **Stripe** | USD subscription billing for international customers | P0 |
| **Resend** | Transactional and notification email delivery | P0 |

### 4.2 Explicitly Out of Scope — MVP v1.0

The following features are documented as out of scope for MVP v1.0. Any request to include them requires a formal scope change request per Decision Log §14.2.

| Feature | Planned Phase | Rationale for Deferral |
|---------|---------------|------------------------|
| **Social media publishing and scheduling** | Phase 5 | Deliberate exclusion — publishing is commoditized; intelligence is the differentiator |
| **Native mobile applications** (iOS & Android) | Phase 6 (Q3 2026) | Responsive web serves MVP; mobile adds 3–6 months delivery risk |
| **Advanced AI/ML** (predictive analytics, auto-responses, content generation) | Phase 7 (Q4 2026) | Requires training data that only accumulates post-launch |
| **Public API and developer marketplace** | Phase 8 (Q1 2027) | Requires stable internal API versioning first |
| **White-labeling and agency resale** | Phase 9 (2027) | Requires multi-tenant branding infrastructure investment |
| **Enterprise SSO** (SAML, Okta, Azure AD) | Phase 9 (2027) | Complexity; MFA sufficient for mid-market at launch |
| **LinkedIn integration** | Phase 10 (Q3 2027) | Restrictive API; compliance review required |
| **TikTok integration** | Phase 10 (Q3 2027) | API policy instability; long-term access uncertain |
| **Pinterest integration** | Phase 10 | Lower priority; smaller addressable audience in target segments |
| **Multi-language support** (French, Swahili, Arabic) | Phase 11 (Q4 2027) | English-first; localization architecture designed in from Day 1 |
| **CRM integrations** (Salesforce, HubSpot) | Phase 12 | Requires stable API and partnership agreements |
| **Influencer management module** | Phase 4 | Adjacent market; builds on core modules |
| **Social commerce** | Phase 5 | Lower priority for PR and agency primary segments |
| **Workflow automation** (Zapier-style) | Phase 4 | Builds on engagement data collected post-launch |

> **Publishing Note:** Social media post scheduling and publishing is a deliberate MVP exclusion. The market for scheduling tools is commoditized (Buffer, Hootsuite, Later). Nawebeus differentiates on intelligence and engagement, not scheduling. Publishing is added in Phase 5 once the intelligence foundation is established and Nawebeus is not positioned as "yet another scheduling tool."

---

## 5. User Needs & Problems

### 5.1 Problem Statements

#### Problem 1: Tool Fragmentation — The Core Problem

**Statement:** Marketing and PR teams use 6–10 disconnected tools to manage social media and brand presence, creating data silos, workflow friction, compliance gaps, and high costs.

**Evidence:**
- 93% of global customer interviewees cited tool fragmentation as the #1 pain point
- 87% currently use 4+ tools; average is 5.8 tools per team
- 78% of African enterprises report "fragmentation" as their biggest brand management challenge (Africa Digital Report 2025)
- 80% spend more than ₦2,400,000 (~$1,500)/month on social media tools

**Nawebeus Solution:** Five core capabilities in one platform, one login, one UI, one Naira bill.

#### Problem 2: No Unified Brand View

**Statement:** Marketing directors and CMOs cannot see a unified view of brand health across social, earned media, and campaign channels — making ROI reporting to the C-suite impossible.

**Evidence:**
- 90% of global interviewees want better cross-platform analytics
- 85% struggle to correlate data across disconnected tools
- 75% cannot measure true ROI of social media investment

**Nawebeus Solution:** Unified Analyze module with cross-module KPIs, custom report builder, competitive benchmarking, and scheduled PDF/CSV exports.

#### Problem 3: Slow Crisis Response

**Statement:** Brands — especially African enterprises with active social media audiences — discover PR crises hours or days after they start, causing preventable reputational damage.

**Evidence:**
- 83% of interviewees want real-time alerts
- Average crisis detection time: 6+ hours (industry research)
- Pain Point Severity Score: 8.1/10 for delayed crisis detection (African enterprise survey)
- 35% of organizations have experienced a damaging social media crisis

**Nawebeus Solution:** Real-time streaming mention ingestion; AI sentiment spike detection; crisis alerting; Engage module for rapid coordinated response.

#### Problem 4: High Total Cost — Especially for African Organizations

**Statement:** Cumulative cost of 6–10 SaaS tools priced in USD creates unacceptable FX burden for Nigerian and African organizations, with costs compounding as the Naira weakens.

**Evidence:**
- Average total spend: ₦2,880,000 (~$1,800)/month for equivalent mid-market tool stack
- 40% of survey respondents spend more than ₦3,200,000 (~$2,000)/month
- Pain Point Severity Score: 8.5/10 for expensive international tools (African enterprise survey)
- International tools do not offer Naira billing, NDPR compliance, or local support

**Nawebeus Solution:** Single Naira subscription at ₦158,400–₦798,400/month — 50–87% savings vs. assembling equivalent tools. No USD exposure for Nigerian customers.

#### Problem 5: Compliance and Data Governance Gaps

**Statement:** Disconnected tool stacks create compliance failures — weak audit trails, inconsistent RBAC, data leakage between client accounts, and inability to demonstrate NDPR or GDPR compliance in enterprise procurement.

**Evidence:**
- 88% of survey respondents rate data security and compliance as "very important"
- 67% are concerned about data security in their current tool stack
- Enterprise procurement blocked by inability to demonstrate unified RBAC and audit logging
- NDPR enforcement by NITDA is increasing; fines of up to 2% of annual gross revenue

**Nawebeus Solution:** Multi-tenant schema-level isolation; RBAC enforced across all modules; immutable audit log; NDPR, GDPR, and CCPA compliance by design.

---

## 6. User Personas

### 6.1 Primary Personas (Global)

Full persona specifications are documented in [Personas.md](./Personas.md). The following summarizes primary personas with their module priorities.

| Persona | Role | Company Type | Primary Pain | Key Modules |
|---------|------|-------------|-------------|-------------|
| **Maya** | Marketing Director | Mid-market brand | No unified ROI view; C-suite demands one number from six tools | Analyze, Monitor, Listen |
| **Sam** | Social Media Manager | Mid-market brand | Context-switching between 5–8 tools; missed messages | Engage, Listen, Grow |
| **Alex** | Agency Account Director | Digital agency (10–50 clients) | No multi-client management; manual client reporting | All modules; multi-workspace |
| **Priya** | PR Manager | Mid-market / Enterprise | Delayed crisis detection; manual press monitoring | Monitor, Listen |
| **Dana** | Data Analyst | Mid-market / Enterprise | Incompatible exports; no cross-platform correlation | Analyze, Listen |
| **Casey** | Community Manager | SMB / Mid-market | Inbox overload across five platform notification systems | Engage |

### 6.2 Primary Personas (African Enterprise)

| Persona | Role | Company Type | Primary Pain | Key Modules |
|---------|------|-------------|-------------|-------------|
| **Ade** | Head of PR / Communications Director | Enterprise (500+ employees; ₦1B–₦10B revenue) | Manual PR reporting takes 15+ hours/week; crisis detection is reactive | Monitor, Listen, Analyze |
| **Chidi** | CMO / Head of Marketing | Mid-market to Enterprise (₦500M–₦5B revenue) | Fragmented tools across social and PR; no unified brand management workspace | All five modules |
| **Ifeoma** | Agency Owner / Managing Director | PR agency (10–50 employees; 10–50 clients) | No multi-client platform with proper data isolation; manual white-label reporting | All modules; multi-workspace |

### 6.3 Secondary Personas

| Persona | Role | Goals |
|---------|------|-------|
| **Bola** | Social Media Manager (agency) | Efficient engagement and content calendar management |
| **Kemi** | Content Strategist | Content performance insights; optimization recommendations |
| **Tunde** | Digital Analyst | Actionable data; competitive reports; BI tool integration |
| **Ngozi** | Crisis Manager | Real-time crisis detection; escalation workflows; rapid response |
| **Admin** | System Administrator | User management; billing; audit log review; security |
| **CFO** | Finance Leader | Cost control; ROI visibility; Naira billing accuracy |

---

## 7. Product Principles

### 7.1 Design Principles

| Principle | Operational Meaning |
|-----------|-------------------|
| **Unification over fragmentation** | One platform, one login, one bill. Every new capability must deepen the unified data model, not sit alongside it. |
| **Intelligence everywhere** | Data without insight is noise. Dashboards exist to drive decisions, not to display metrics. |
| **Customer-first** | Every product decision starts with a customer need. Internal convenience is not a valid product requirement. |
| **Compliance by design** | Privacy, security, and regulatory compliance are architectural decisions, not features added after launch. |
| **Real-time when possible** | Instant mentions, alerts, and updates are the standard expectation. Batch processing is a fallback, not a design choice. |
| **Accessible** | WCAG 2.1 AA compliance from Day 1. Accessibility is not optional or deferred. |
| **Mobile-responsive** | Full feature access on any device through responsive web; native mobile in Phase 6. |
| **Transparent** | No hidden limits. Every plan page shows exact usage. No surprise charges. |

### 7.2 Engineering Principles

| Principle | Operational Meaning |
|-----------|-------------------|
| **Single source of truth** | Business logic lives in the services layer. Routes and API handlers validate, authorize, and shape responses — they do not contain business logic. |
| **Thin entry points** | Routes/actions only handle validation, authentication, and response shaping. |
| **Shared validation** | Zod schemas are shared across all entry points. No duplicated validation logic. |
| **No reverse dependencies** | Services never import from web actions or API routes. Dependency direction is always from entry point to service, never the reverse. |
| **Cache first** | Check cache before any database query. |
| **Rate limit first** | Enforce rate limits before any processing begins. |
| **Observability by default** | All operations are logged, traced, and monitored. No production operation is opaque. |
| **Least privilege** | Users and services have the minimum permissions required. No over-permissioning. |

---

## 8. Functional Requirements

### 8.1 Module 1: Authentication & User Management

**Purpose:** Provide secure authentication, user lifecycle management, and session management as the foundation for all platform access.

**Business Context:** Every interaction with Nawebeus begins with authentication. The security and usability of this module directly affects conversion rate, trust, and compliance posture.

#### 8.1.1 User Registration & Onboarding

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Email registration | P0 | User registers with email and password | Email verification sent within 30 seconds; verification link valid for 24 hours |
| Email verification | P0 | Verify email ownership before account activation | Unverified users cannot access platform features |
| Post-registration onboarding | P0 | Guided flow: organization setup → social account connection | >70% of new users complete onboarding within 48 hours |
| Magic link login | P1 | Passwordless login via email link | Link expires after 15 minutes; single use only |
| MFA enrollment | P0 | TOTP-based multi-factor authentication (Google Authenticator, Authy) | MFA can be enforced at organization level by Owner |

#### 8.1.2 Login & Session Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Email/password login | P0 | Standard credentials-based login | Credentials verified in <500ms |
| Session management | P0 | Persistent and session tokens | Sessions expire after configurable idle period (default 30 days) |
| Device tracking | P0 | Track active sessions by device and location | Users can view and revoke individual sessions |
| Account lockout | P0 | Lockout after 5 consecutive failed attempts | Lockout duration: 15 minutes; admin can reset manually |
| Rate limiting | P0 | Limit login attempts per IP and account | 10 attempts per hour per IP; 5 per account |

#### 8.1.3 Password & Security Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Password reset | P0 | Self-service reset via email link | Reset link expires in 1 hour; single use; invalidates existing sessions |
| Password change | P0 | Change password from account settings | Requires current password confirmation; invalidates all other sessions |
| Password strength enforcement | P0 | Minimum: 8 characters, 1 uppercase, 1 number, 1 special character | Visual strength indicator; cannot submit below minimum |
| Breach detection | P1 | Check passwords against HaveIBeenPwned database | Warning displayed for breached passwords; user can choose to proceed |

#### 8.1.4 Account Lifecycle

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Profile management | P0 | Edit name, email, avatar, timezone, notification preferences | Changes reflected immediately |
| Account deletion | P0 | Self-service account deletion with 30-day grace period | All personal data deleted after grace period; NDPR/GDPR compliant |
| Data export | P0 | Export all personal data (GDPR/NDPR portability right) | Export completed within 24 hours; ZIP format; machine-readable |

---

### 8.2 Module 2: Organization & Account Management

**Purpose:** Manage the core organizational structure — the tenant unit in Nawebeus — including team management, social account connections, RBAC, subscription management, and billing.

**Business Context:** The organization is the billable unit and the data isolation boundary. Everything in Nawebeus belongs to an organization. Multi-tenant security begins here.

#### 8.2.1 Organization Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Organization creation | P0 | Create org with name, logo, timezone, industry | Organization created in <1 second; slug auto-generated |
| Organization settings | P0 | Manage org name, logo, timezone, default language | Changes reflected immediately; audit logged |
| Member invitation | P0 | Invite users by email with role assignment | Invitation email delivered within 60 seconds; expires after 7 days |
| Member management | P0 | View, role-change, and remove team members | Role changes take effect immediately; audit logged |
| Organization deletion | P0 | Delete organization and all associated data | 30-day grace period; data purged per NDPR/GDPR schedule |

#### 8.2.2 Role-Based Access Control (RBAC)

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Owner** | Full platform access; billing management | All permissions; delete organization; manage billing; impersonate members (support) |
| **Admin** | Platform administration; user management | All module access; invite/remove members; manage integrations; view audit log |
| **Manager** | Operational management of modules | All module access except billing and org deletion; manage campaigns and conversations |
| **Analyst** | Read and export access | View all modules; export reports; no write access to campaigns or conversations |
| **Viewer** | Read-only access | View dashboards and reports; no write access anywhere |

RBAC must be enforced at both the API route level and the service layer. Bypassing the UI must not bypass access controls.

#### 8.2.3 Social Account Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| OAuth connection | P0 | Connect YouTube, X, Instagram, Facebook, Reddit accounts | OAuth flow completes in <5 seconds; tokens stored encrypted |
| Account limit enforcement | P0 | Enforce per-plan social account limits | Clear error message when limit reached; upgrade prompt shown |
| Token refresh | P0 | Automatic refresh of expiring OAuth tokens | Token refreshed before expiration; no user intervention required |
| Account health monitoring | P0 | Display connection status for each social account | Stale or errored accounts shown with clear status and resolution action |
| Account disconnection | P0 | Disconnect social account with data retention option | Historical data retained for 30 days post-disconnection; UI reflects status immediately |

#### 8.2.4 Subscription & Billing Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Plan selection | P0 | Choose Free, Pro, or Enterprise plan | Plan change takes effect immediately; billing prorated |
| Naira billing (Paystack) | P0 | Process Naira card payments, bank transfers via Paystack | Payment processed within 5 seconds; receipt emailed immediately |
| USD billing (Stripe) | P0 | Process USD payments for international customers via Stripe | Payment processed within 5 seconds; receipt emailed immediately |
| Usage tracking | P0 | Track and display current usage vs. plan limits | Usage dashboard updates in real time; warning at 80% of limit |
| Plan downgrade management | P0 | Handle downgrade with data archiving for features above new plan limits | 30-day warning before limit enforcement; data archived, not deleted |
| Free trial management | P0 | 14-day Pro trial; auto-downgrade to Free at expiration | Trial status and days remaining shown in UI; email reminders at Day 7, 13, 14 |
| Annual billing discount | P0 | 15% discount for annual billing | Annual price calculated as monthly × 12 × 0.85; shown on pricing page |
| Invoice management | P0 | Generate and deliver Naira or USD invoices | Invoice generated immediately after payment; downloadable PDF |

---

### 8.3 Module 3: Social Media Integration

**Purpose:** Establish and maintain secure connections to social media platforms, collecting data for the Listen, Monitor, Engage, Grow, and Analyze modules.

**Business Context:** Social platform integrations are the data foundation for every core module. Integration quality, reliability, and rate limit management directly affect the value of every other module.

#### 8.3.1 OAuth Connection Flow

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Platform-specific OAuth | P0 | Implement OAuth 2.0 flow for each platform | OAuth completes in <5 seconds; user redirected to dashboard on success |
| Scope request | P0 | Request only minimum required permissions per platform | Permission scope documented; no over-permissioning |
| Token storage | P0 | Store access and refresh tokens encrypted (AES-256) | Tokens never logged; never included in API responses |
| Multi-account support | P0 | Connect multiple accounts per platform (within plan limits) | Each account shown independently in account list |

#### 8.3.2 Data Collection & Synchronization

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Real-time mention collection | P0 | Collect mentions as they occur (polling or webhook) | Mentions appear in Listen/Engage within 5 minutes of platform posting |
| Historical data backfill | P1 | Collect historical mentions on initial connection | Up to 30 days historical data on first connection (platform permitting) |
| Rate limit management | P0 | Respect per-platform API rate limits; implement backoff | Zero rate limit violations; graceful degradation when limits approached |
| Error handling and recovery | P0 | Detect and recover from API errors automatically | Transient errors retried with exponential backoff; persistent errors surfaced in UI |
| Integration abstraction layer | P0 | Platform-specific code isolated behind a common interface | Changing one platform's integration does not affect other platforms |

#### 8.3.3 Platform-Specific Requirements

| Platform | Key Integration Points | Special Considerations |
|----------|----------------------|----------------------|
| **YouTube** | Comments, mentions, analytics, channel data | Data API v3; quota is daily (not per-minute); manage carefully |
| **X (Twitter)** | Tweets, replies, mentions, DMs, analytics | API v2; tiered access; Free tier limitations significant |
| **Instagram** | Comments, mentions, story replies, analytics | Graph API; requires Facebook Business account; business account only |
| **Facebook** | Page comments, mentions, messages, analytics | Graph API; page-level permissions only; no personal profiles |
| **Reddit** | Posts, comments, mentions by keyword | REST API; polling only; no real-time streaming; rate limit: 60 requests/minute |

---

### 8.4 Module 4: Grow — Viral Campaign Engine

**Purpose:** Create, publish, and manage viral giveaway and growth campaigns that drive audience acquisition, engagement, and lead generation across connected social channels.

**Business Context:** The Grow module is a unique differentiator — no competitor in the mid-market offers native giveaway campaign management integrated with listening and analytics. It is a primary acquisition tool for customers building audience on social platforms.

#### 8.4.1 Campaign Creation

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Campaign builder | P0 | Step-by-step campaign creation UI: name, description, prize, dates | Campaign created in <10 steps; each step validated before proceeding |
| Entry mechanics | P0 | Multi-step entry: follow, share, comment, refer, engage | At least 5 entry action types supported at launch |
| Referral tracking | P0 | Track referred entries with unique referral links per participant | Referral chain tracked; duplicate referrals detected |
| Campaign scheduling | P0 | Set start and end dates with automatic activation/deactivation | Campaign activates and deactivates within 1 minute of scheduled time |
| Prize configuration | P0 | Define prize, number of winners, prize delivery method | Prize details displayed on entry form |
| Campaign duplication | P1 | Duplicate existing campaign as template for new campaign | Duplicate creates independent copy; all settings editable |
| Template library | P1 | Pre-built campaign templates for common use cases | At least 5 templates at launch |

#### 8.4.2 Entry Collection & Validation

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Entry form | P0 | Public-facing entry form; mobile-optimized | Form loads in <2 seconds; submits in <1 second |
| Entry validation | P0 | Verify required actions are completed (follow verified, share verified) | Verification run at entry time; entries with incomplete actions rejected |
| Fraud detection | P0 | Detect and flag suspicious entries (duplicate IPs, bot patterns, purchased followers) | Flagged entries shown separately; not included in winner pool without admin review |
| Entry deduplication | P0 | Prevent duplicate entries per user per campaign | Second entry attempt by same user returns confirmation of existing entry |
| Entry data collection | P0 | Collect email, name, and custom fields as configured | All collected data stored encrypted; NDPR/GDPR consent captured |

#### 8.4.3 Winner Selection & Prize Fulfillment

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Automated winner selection | P0 | Random selection from validated, non-flagged entries | Selection algorithm auditable; seed documented for reproducibility |
| Weighted selection | P1 | Weight entries by number of actions completed | Weight calculation documented; per-entry weight shown in admin view |
| Manual winner approval | P0 | Admin reviews and approves selected winners before notification | Winners not notified until admin approval |
| Audit trail | P0 | Full audit log of selection process including seed and timestamp | Audit log exportable as CSV |
| Winner notification | P0 | Automated email notification to winners | Email delivered within 5 minutes of approval |

#### 8.4.4 Campaign Analytics

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Real-time entry tracking | P0 | Live count of entries; entry rate over time | Dashboard updates in real time (no manual refresh required) |
| Entry source analysis | P0 | Which entry actions drive the most entries | Breakdown by action type with percentage |
| Conversion funnel | P0 | Visitors → started → completed entry funnel | Funnel shown in campaign analytics |
| Referral performance | P1 | Which participants drive the most referrals | Leaderboard view; exportable |
| Campaign ROI | P1 | Cost per lead; cost per follower gained; follower growth rate | Calculated from campaign settings and outcome data |

---

### 8.5 Module 5: Listen — Social Intelligence Layer

**Purpose:** Monitor, analyze, and alert on brand conversations, competitor mentions, and trending topics across connected social platforms in real time.

**Business Context:** The Listen module is the intelligence engine of the platform. Its data feeds into Engage (to surface conversations for response), Analyze (for sentiment and trend dashboards), and Monitor (for crisis correlation). Its quality determines how valuable the unified platform feels.

#### 8.5.1 Query Configuration

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Boolean keyword query builder | P0 | Support AND, OR, NOT, exact match, hashtag, mention operators | Query builder with visual operator selection; syntax validation |
| Query validation | P0 | Validate query syntax before saving; estimate result volume | Estimated mention volume shown before query saved |
| Saved searches | P0 | Save and name queries; reuse across sessions | Saved queries load in <500ms |
| Platform filtering | P0 | Filter results to specific connected platforms | Platform filter applied server-side; results update in real time |
| Language filtering | P1 | Filter mentions by detected language | Language auto-detected per mention; filter by language code |
| Sentiment filtering | P0 | Filter mentions by sentiment (positive, negative, neutral) | Sentiment filter applied to existing results without page reload |

#### 8.5.2 Mention Ingestion & Processing

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Real-time mention collection | P0 | Collect matching mentions within 5 minutes of posting | 95th percentile latency <5 minutes from platform posting |
| Mention deduplication | P0 | Detect and deduplicate cross-platform syndicated content | Deduplication accuracy >99% |
| Mention enrichment | P0 | Add author metadata, platform metrics, and engagement data | All available metadata attached at collection time |
| Historical mention import | P1 | Import up to 30 days of historical mentions on query creation | Historical import completes within 30 minutes for 10,000 mentions |
| Mention volume limits | P0 | Enforce plan-level mention limits with real-time tracking | Usage shown in dashboard; warning at 80%; upgrade prompt at 100% |

#### 8.5.3 Sentiment Analysis

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Sentiment classification | P0 | Classify each mention as positive, negative, or neutral | Accuracy ≥85% on English-language content (validated against human labels) |
| Confidence score | P1 | Provide confidence score per sentiment classification | Confidence score shown for each mention; low-confidence flagged |
| Sentiment trend | P0 | Track sentiment over time for a saved query | Trend chart updates daily; hourly view for Pro and Enterprise |
| Sentiment spike detection | P0 | Detect unusual sentiment shifts vs. rolling average | Spike detected and alert triggered within 10 minutes of threshold crossing |
| Bulk sentiment recalculation | P1 | Recalculate sentiment for existing mentions when model improves | Admin-triggered; runs as background job; does not affect UI performance |

#### 8.5.4 Crisis Detection & Alerting

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Crisis threshold configuration | P0 | Configure mention volume and sentiment thresholds per query | Thresholds configurable per saved query; saved per user |
| Real-time crisis alerting | P0 | Trigger alert when thresholds breached | Alert delivered via in-app and email within 2 minutes of threshold crossing |
| Crisis escalation | P0 | Escalate alert to Owner and Admin if not acknowledged within configured time | Escalation time configurable (default: 15 minutes); escalation audit logged |
| Alert history | P0 | View all past alerts with context | Alert history retained for plan-specific retention period |
| Alert suppression | P1 | Suppress alerts during planned events (e.g., product launches) | Suppression time-bound; must be explicitly ended or expires automatically |

#### 8.5.5 Competitive Intelligence (Listen)

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Competitor mention tracking | P0 | Track mentions of configured competitor brand names | Competitor queries configured and managed separately from brand queries |
| Share of Voice (social) | P0 | Calculate brand SOV vs. configured competitors across social platforms | SOV calculated daily; displayed as percentage; historical trend chart |
| Influence scoring | P1 | Score mention authors by reach, engagement rate, and verification status | Score shown per mention in mention list view |

---

### 8.6 Module 6: Monitor — Media & Press Intelligence

**Purpose:** Track brand mentions across global news sources, blogs, and online publications; calculate Share of Voice; manage media contacts; deliver press coverage intelligence.

**Business Context:** The Monitor module provides the earned media view that social listening alone cannot deliver. For PR teams and communications directors (Ade persona), it is the primary daily workspace. For CMOs (Chidi), it completes the brand health picture alongside social data.

#### 8.6.1 Media Source Configuration

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Keyword-based monitoring | P0 | Monitor news sources for configured keywords, brand names, and competitor names | First results available within 30 minutes of monitor setup |
| News source coverage | P0 | Cover global English-language news; priority Nigerian and African publications | Nigerian publications (Punch, Vanguard, Guardian NG, TechCabal, BusinessDay) included from Day 1 |
| RSS feed integration | P0 | Support custom RSS feeds for publications not covered by news APIs | Up to 100 custom RSS feeds (Pro); 500 (Enterprise) |
| Source quality scoring | P1 | Score sources by domain authority, readership, and relevance | Score shown per article; filterable |

#### 8.6.2 Article Collection & Processing

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Real-time article collection | P0 | New articles appear in dashboard within 15 minutes of publication | 95th percentile latency <15 minutes |
| Full-text extraction | P0 | Extract full article text for sentiment analysis and keyword search | Full-text extraction success rate ≥98% for accessible content |
| Article deduplication | P0 | Deduplicate syndicated articles across sources | Deduplication accuracy >99% |
| Article enrichment | P0 | Add author, publication, estimated readership, social share counts | All available metadata attached at collection time |
| Sentiment classification | P0 | Classify article sentiment (positive, negative, neutral) toward monitored brand | Accuracy ≥85% on English-language content |
| Impact scoring | P0 | Score each article by source authority × sentiment × brand prominence | Score calculated and displayed per article |

#### 8.6.3 Share of Voice (SOV) Tracking

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| SOV calculation | P0 | Calculate brand's share of total monitored mentions vs. configured competitors | SOV calculated daily; displayed as percentage; available as chart and data table |
| SOV by media tier | P1 | Calculate SOV across tier groupings (national press, trade press, blogs) | Tier groupings configurable; at least 3 tiers at launch |
| SOV trend | P0 | Show SOV trend over configurable date range | Trend chart shows daily SOV for up to 90 days (Pro); 2 years (Enterprise) |
| SOV by geography | P1 | Calculate SOV by country or region | Geography detection based on publication's primary country |
| Competitor SOV breakdown | P0 | Show each competitor's individual share alongside brand share | Breakdown shown as stacked bar chart and percentage table |

#### 8.6.4 Media Contacts Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Contact creation | P0 | Create and manage journalist and media contact records | Fields: name, email, publication, beat, notes, relationship status |
| Auto-discovery | P1 | Auto-populate contact from article author metadata | Author details pre-populated when article byline is available |
| Relationship history | P0 | Log outreach, responses, and coverage linked to each contact | All interactions logged with timestamp; exportable |
| Contact tagging | P1 | Tag contacts by beat, region, publication tier | Tags filterable in contact list |
| Coverage linking | P0 | Link collected articles to journalist contact records | Article-to-contact link created manually or via auto-discovery |

#### 8.6.5 Coverage Alerts

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Coverage alert configuration | P0 | Configure alerts for new articles matching monitored keywords | Alerts configurable per keyword set with delivery method and frequency |
| Real-time alert delivery | P0 | Deliver alerts within 20 minutes of article publication | 95th percentile delivery time <20 minutes |
| Alert digest | P1 | Daily or weekly digest option for non-critical coverage | Digest format: email with top 10 articles by impact score |
| Crisis coverage alert | P0 | Special alert when negative coverage spikes above threshold | Crisis alert delivered via in-app and email immediately; no digest delay |

---

### 8.7 Module 7: Engage — Unified Engagement Hub

**Purpose:** Aggregate all social media comments, mentions, direct messages, and replies from connected accounts into a single, organized inbox with workflow tools for team management and rapid response.

**Business Context:** The Engage module is the most actively used daily workspace for community managers (Casey), social media managers (Sam), and agency account directors (Alex). Response time and inbox organization directly affect customer satisfaction and brand reputation.

#### 8.7.1 Message Aggregation

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Multi-platform inbox | P0 | Aggregate from YouTube, X, Instagram, Facebook, Reddit | All connected accounts appear in single inbox |
| Real-time message delivery | P0 | Messages appear in inbox within 5 minutes of platform posting | 95th percentile latency <5 minutes |
| Conversation threading | P0 | Display messages as threaded conversations | Threading accuracy ≥98% |
| Message deduplication | P0 | Deduplicate cross-posted messages | Deduplication accuracy >99% |
| Message priority scoring | P1 | Score by author influence, sentiment urgency, and SLA proximity | Score shown per message; filterable by priority level |
| Platform filter | P0 | Filter inbox by platform | Platform filter applied without page reload |
| Status filter | P0 | Filter by status: new, assigned, in progress, resolved | Status filter combination supported |

#### 8.7.2 Message Routing & Assignment

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Manual assignment | P0 | Assign any message to any team member | Assignment reflected immediately; assignee notified |
| Auto-routing rules | P1 | Configure routing rules: by platform, keyword, sentiment, author type | Rules engine evaluates each incoming message; 95%+ routing accuracy |
| Workload balancing | P1 | Show team member queue depth when assigning | Queue depth shown in assignment dropdown |
| SLA tracking | P0 | Track time-to-first-response and time-to-resolution per message | SLA breach shown in red; configurable SLA thresholds |
| SLA escalation | P0 | Escalate unaddressed messages as SLA approaches or breaches | Escalation notification sent to Manager or Admin |

#### 8.7.3 Response Composition & Delivery

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| In-platform response | P0 | Compose and send response from Nawebeus UI | Response posted to platform within 10 seconds of send |
| Platform character limits | P0 | Enforce and display character limits per platform in composer | Real-time character counter; submit disabled when over limit |
| Canned responses | P0 | Library of pre-written responses with variable substitution | Canned responses searchable; inserted into composer in <1 click |
| Response suggestions | P1 | AI-suggested responses based on message intent and history | Suggestions shown as options below composer; not auto-inserted |
| Rich media support | P1 | Attach images and GIFs where platform supports | Media attached per platform capability |
| Scheduled responses | P1 | Schedule response delivery for optimal engagement time | Scheduled responses shown in separate queue; cancellable |

#### 8.7.4 Team Collaboration

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Internal notes | P0 | Add internal notes to conversations (not visible externally) | Notes shown in conversation with author and timestamp |
| @mentions in notes | P0 | @mention team members in notes to notify them | @mentioned user receives in-app notification within 30 seconds |
| Conversation share | P1 | Share conversation link with team member | Shared link opens conversation in context for any team member with access |
| Approval workflow | P1 | Route response for approval before sending | Approver notified; response queued until approved or rejected |

#### 8.7.5 Engagement Analytics

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Inbox volume metrics | P0 | Total messages; messages by platform; messages by status | Dashboard updates daily |
| Response time metrics | P0 | Average first response time; median response time; SLA compliance rate | Metrics shown per team member and for whole organization |
| Resolution rate | P0 | Percentage of conversations resolved within SLA | Shown for configurable date range |
| Team performance | P1 | Per-team-member message volume, response time, resolution rate | Available to Manager, Admin, Owner roles only |
| CSAT integration | P1 | Trigger automated CSAT survey after conversation resolved | Survey sent via email if user email captured; response linked to conversation |

---

### 8.8 Module 8: Analyze — Consolidated Intelligence & Reporting

**Purpose:** Transform raw social media and press data from all modules into actionable business intelligence through a unified dashboard, custom report builder, competitive benchmarking, and multi-format export.

**Business Context:** The Analyze module is where senior stakeholders (Marketing Directors, CMOs) spend most of their time. Its quality directly affects executive confidence in the platform and renewal decisions. It is also the module most likely to generate referrals — a compelling report is a sales tool.

#### 8.8.1 Unified Dashboard

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Cross-module KPI summary | P0 | Display key metrics from Grow, Listen, Monitor, and Engage in one view | Dashboard loads in <3 seconds |
| Date range selection | P0 | Configurable date range with presets (7 days, 30 days, 90 days, custom) | Date range change updates all widgets simultaneously |
| Platform filter | P0 | Filter dashboard by connected social platform | Platform filter updates all widgets without page reload |
| Real-time data | P0 | Dashboard data refreshes without manual intervention | Refresh cycle: hourly (Pro); real-time streaming (Enterprise) |
| Widget customization | P1 | Add, remove, and reorder dashboard widgets | Widget layout saved per user and per organization |

#### 8.8.2 Performance Metrics

| Metric | Module Source | Description | Priority |
|--------|--------------|-------------|----------|
| **Total mentions** | Listen | Total brand mentions across all platforms and queries | P0 |
| **Net sentiment** | Listen | % positive − % negative mentions over period | P0 |
| **Sentiment trend** | Listen | Net sentiment trajectory over time | P0 |
| **Share of Voice (social)** | Listen | Brand SOV vs. configured competitors on social | P0 |
| **Share of Voice (media)** | Monitor | Brand SOV vs. competitors in press coverage | P0 |
| **Media impressions** | Monitor | Estimated total readership of articles mentioning brand | P0 |
| **Press articles** | Monitor | Total articles collected in period | P0 |
| **Messages received** | Engage | Total inbox messages across all platforms | P0 |
| **Average response time** | Engage | Mean time-to-first-response | P0 |
| **Response rate** | Engage | % of messages that received a response | P0 |
| **Giveaway entries** | Grow | Total entries across active campaigns | P0 |
| **Cost per lead** | Grow | Total campaign cost ÷ total valid entries | P1 |
| **Follower growth** | Social Integration | Net follower change per connected account | P0 |

#### 8.8.3 Custom Report Builder

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Drag-and-drop builder | P0 | Add, remove, and arrange report sections and charts | Report preview updates in real time as sections added |
| Metric selection | P0 | Choose from all available metrics across all modules | Full metric library available in builder |
| Visualization types | P0 | Line charts, bar charts, pie/donut charts, data tables, KPI cards | At least 6 visualization types at launch |
| Date range and comparison | P0 | Configure date range and period-over-period comparison | Comparison shows % change with directional indicator |
| Branding | P1 | Add organization logo and color scheme to reports | Logo and colors applied to all export formats |
| Report saving | P0 | Save named reports for repeated use | Saved reports load in <1 second |
| Report sharing | P1 | Generate shareable link for report (read-only access) | Shared link does not require Nawebeus login |

#### 8.8.4 Competitive Benchmarking

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Competitor configuration | P0 | Add up to 5 competitors (Pro); 20 competitors (Enterprise) | Competitors tracked via Listen and Monitor queries |
| SOV comparison | P0 | Side-by-side SOV chart: brand vs. each competitor | SOV chart available for both social and media channels |
| Sentiment comparison | P0 | Net sentiment comparison vs. competitors | Comparison shown as grouped bar chart and data table |
| Coverage volume comparison | P0 | Total articles comparison over configurable period | Chart shows daily articles per brand |
| Competitive trend | P1 | Show competitive position trajectory over 90 days | 90-day trend line per brand |

#### 8.8.5 Export & Delivery

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| CSV export | P0 | Export raw data as CSV | Export completes within 30 seconds for up to 100,000 rows |
| PDF export | P0 | Export reports as formatted PDF | PDF generated within 30 seconds; all charts rendered |
| Excel export | P1 | Export data as XLSX with formatted sheets | Export includes metadata sheet and data sheet |
| Scheduled delivery | P0 | Schedule reports to be delivered via email on configured schedule | Delivery within 15 minutes of scheduled time |
| Instant delivery | P0 | Send report to email recipients immediately | Delivery within 5 minutes of trigger |

---

### 8.9 Module 9: Notifications & Alerts

**Purpose:** Deliver critical information — crisis alerts, mention spikes, SLA breaches, billing warnings, team activity — to the right user, through the right channel, at the right time.

**Business Context:** Notifications are the connective tissue between the platform's intelligence capabilities and the user. A crisis alert that arrives too late, or an SLA breach notification that goes to the wrong person, defeats the purpose of real-time intelligence.

#### 8.9.1 Notification Types

| Type | Trigger | Default Channel | Priority |
|------|---------|----------------|----------|
| **Crisis alert** | Mention volume or negative sentiment spike above threshold | Email + In-app | P0 |
| **Mention alert** | New mention matching saved query | In-app (configurable) | P0 |
| **Coverage alert** | New press article matching monitor configuration | In-app + Email (configurable) | P0 |
| **SLA breach alert** | Engage message approaching or past SLA threshold | In-app + Email | P0 |
| **Message assignment** | Engage message assigned to user | In-app | P0 |
| **@mention in note** | User @mentioned in internal conversation note | In-app | P0 |
| **Usage warning** | Plan limit at 80% or 100% | In-app | P0 |
| **Trial expiry warning** | Trial ends in 7 days, 1 day, or has expired | Email + In-app | P0 |
| **Billing event** | Payment succeeded, failed, or invoice available | Email | P0 |
| **Team invitation** | User invited to organization | Email | P0 |
| **Report delivery** | Scheduled report ready | Email | P0 |

#### 8.9.2 User Preference Management

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Per-type notification toggle | P0 | Enable/disable each notification type per channel | Changes take effect immediately |
| Frequency control | P1 | Choose real-time, digest, or off for non-critical types | Digest options: hourly, daily, weekly |
| Quiet hours | P1 | Configure time ranges when non-critical notifications are suppressed | Quiet hours respected in configured timezone |
| Channel preference | P0 | Choose email, in-app, or both for each notification type | Channel preference saved per user per type |

#### 8.9.3 In-App Notification Center

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Notification bell | P0 | Persistent bell icon in navigation with unread count badge | Unread count accurate in real time |
| Notification list | P0 | Scrollable list of all notifications with timestamp and read status | List loads in <500ms |
| Mark as read | P0 | Mark individual or all notifications as read | Read status updated immediately |
| Direct navigation | P0 | Click notification to navigate to relevant context | Navigation occurs within 1 second |
| Notification retention | P0 | Retain notifications for plan-specific retention period | Free: 30 days; Pro: 90 days; Enterprise: 1 year |

---

### 8.10 Module 10: System Administration

**Purpose:** Provide enterprise-grade administrative capabilities for platform governance, user management, security enforcement, compliance monitoring, and operational oversight.

**Business Context:** The System Administration module is used primarily by Nawebeus staff (not customers) to manage the platform. Secondarily, organization Owners use a subset of these capabilities for tenant-level management. This module is foundational for multi-tenant security and compliance.

#### 8.10.1 Platform Administration (Staff-Only)

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Tenant management | P0 | View, create, suspend, and delete tenant organizations | Suspension takes effect within 1 minute; all active sessions invalidated |
| Usage monitoring | P0 | View per-tenant usage across all modules and plan limits | Usage dashboard updates hourly |
| Feature flags | P0 | Enable/disable features per tenant or globally | Feature flag changes take effect without deployment |
| Support impersonation | P0 | Staff can impersonate any user for support purposes | Impersonation creates audit log entry; impersonated user not notified (for security review) |
| System health dashboard | P0 | View real-time platform health: API latency, error rates, queue depths | Dashboard updates every 60 seconds |

#### 8.10.2 Audit Logging

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Comprehensive audit coverage | P0 | Log all write operations: create, update, delete, login, permission changes | 100% write operation coverage |
| Immutable log | P0 | Audit log entries cannot be modified or deleted | Log integrity verified via cryptographic checksums |
| Log retention | P0 | Retain audit logs per plan: Free 30 days; Pro 1 year; Enterprise 7 years | Retention enforced automatically; expired entries purged per schedule |
| Log search | P0 | Search audit log by user, action type, resource, and date range | Search returns results in <5 seconds for up to 1 million log entries |
| Log export | P0 | Export audit log as CSV for external compliance tools | Export completes within 60 seconds for up to 100,000 entries |
| Organization-level audit access | P0 | Organization Owners and Admins can view their own organization's audit log | Cross-tenant audit log access is impossible |

#### 8.10.3 Data Governance

| Requirement | Priority | Description | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Data subject access request (DSAR) | P0 | Process NDPR/GDPR data access requests | Export all personal data for a subject within 24 hours |
| Right to erasure | P0 | Delete all personal data for a subject (NDPR/GDPR) | All personal data deleted within 24 hours; audit log retained per legal hold requirements |
| Data retention enforcement | P0 | Automatically enforce plan-specific data retention periods | Data outside retention window purged in daily scheduled job |
| Data export for portability | P0 | Allow users to export all their personal data | Export completed within 24 hours; machine-readable format (JSON + CSV) |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Metric | Free Plan | Pro Plan | Enterprise Plan | Measurement Method |
|--------|-----------|----------|-----------------|--------------------|
| **Page load time (P95)** | <3 seconds | <2 seconds | <2 seconds | Synthetic monitoring |
| **API response time (P95)** | <500ms | <200ms | <200ms | APM monitoring |
| **Database query time (P95)** | <300ms | <200ms | <100ms | Query monitoring |
| **Dashboard load** | <3 seconds | <2 seconds | <2 seconds | Real user monitoring |
| **Report generation** | <60 seconds | <30 seconds | <15 seconds | Measured end-to-end |
| **Mention ingestion latency** | <10 minutes | <5 minutes | <2 minutes | End-to-end latency |
| **Crisis alert delivery** | <5 minutes | <2 minutes | <1 minute | Alert delivery tracking |

### 9.2 Scalability

| Dimension | Year 1 Target | Year 3 Target |
|-----------|--------------|---------------|
| **Tenant organizations** | 5,000 | 50,000+ |
| **Concurrent active users** | 500 | 5,000+ |
| **Mentions processed per day** | 1,000,000 | 100,000,000 |
| **Articles processed per day** | 100,000 | 10,000,000 |
| **Engage messages processed per day** | 500,000 | 50,000,000 |
| **Database size** | 10TB | 100TB+ |
| **Storage** | 10TB | 100TB+ |

### 9.3 Security

| Requirement | Implementation | Standard |
|-------------|----------------|----------|
| **Encryption in transit** | TLS 1.3 for all connections | OWASP |
| **Encryption at rest** | AES-256 for database and storage | NIST |
| **Authentication** | Bcrypt password hashing (cost factor 12); TOTP MFA | OWASP |
| **API security** | OAuth 2.0; rate limiting; input validation via Zod | OWASP Top 10 |
| **Multi-tenant isolation** | Schema-level and row-level security; no cross-tenant queries possible | Custom |
| **Session security** | Secure, HttpOnly cookies; CSRF protection | OWASP |
| **Dependency scanning** | Automated scanning in CI; no high/critical vulnerabilities in production | OWASP |
| **Secret management** | Environment variables; no secrets in code or logs | OWASP |
| **Pre-launch penetration test** | Third-party penetration test before public launch | SOC 2 control |

### 9.4 Reliability

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Platform uptime** | ≥99.9% (≤8.7 hours downtime/year) | Uptime monitoring |
| **Error rate** | <0.1% of requests result in 5xx errors | APM monitoring |
| **Data durability** | 99.999999% (8 nines) | Backup verification |
| **RTO (Recovery Time Objective)** | <4 hours for full platform | DR testing |
| **RPO (Recovery Point Objective)** | <1 hour data loss maximum | Backup testing |
| **Deployment** | Blue-green deployment; <30 minutes to production | Deployment log |

### 9.5 Compliance

| Regulation | Jurisdiction | Requirement | Status at Launch |
|------------|-------------|-------------|-----------------|
| **NDPR** | Nigeria | Data sovereignty; consent; DSAR; breach notification | Required |
| **GDPR** | EU | Data protection by design; right to erasure; portability; DPA | Required |
| **CCPA / CPRA** | California | Consumer privacy rights; opt-out mechanisms | Required |
| **COPPA** | USA | No data collection from users under 13 | Required |
| **CAN-SPAM Act** | USA | Email opt-out; sender identification | Required |
| **CBN Digital Banking Guidelines** | Nigeria | Payment data protection (via Paystack) | Required |
| **Platform ToS** | All integrated platforms | API terms compliance; no scraping | Required |
| **SOC 2 Type II** | Global | Security and availability controls | Year 2 |
| **ISO 27001** | International | Information security management | Year 2 |

### 9.6 Accessibility

| Standard | Requirement |
|----------|-------------|
| **WCAG 2.1 Level AA** | All UI components meet AA conformance |
| **Keyboard navigation** | All features operable without mouse |
| **Screen reader support** | Semantic HTML; ARIA labels; tested with NVDA and VoiceOver |
| **Color contrast** | Minimum 4.5:1 ratio for normal text; 3:1 for large text |
| **Focus indicators** | Visible focus states on all interactive elements |
| **Alt text** | All images have descriptive alt text |
| **Skip navigation** | Skip links provided for keyboard users |
| **Responsive design** | Full feature access at 320px minimum viewport width |

### 9.7 Maintainability

| Requirement | Target |
|-------------|--------|
| **Test coverage** | >85% for service layer; >90% for utility library |
| **TypeScript strict mode** | Enabled; no `any` types without explicit justification |
| **API documentation** | OpenAPI/Swagger specification maintained for all routes |
| **Architecture documentation** | ADRs current; architecture diagrams updated with each major change |
| **Operational runbooks** | Runbook for every on-call scenario |
| **Structured logging** | JSON-formatted logs with correlation IDs; 365-day retention |

---

## 10. Success Metrics & KPIs

### 10.1 North Star Metric

**Weekly Active Organizations (WAO):** Number of organizations with at least 3 active users in a 7-day period. This reflects both acquisition (new organizations) and engagement (users returning), making it the single best proxy for product health.

### 10.2 Product Health Metrics

| Metric | Year 1 Target | Year 3 Target |
|--------|---------------|---------------|
| **Weekly Active Organizations (WAO)** | 150 | 5,000 |
| **Daily Active / Monthly Active (DAU/MAU)** | 30% | 40% |
| **Modules used per organization per week** | 4 of 5 | 5 of 5 |
| **Mentions processed per org per month** | 5,000 | 50,000 |
| **Engage response rate** | 85% of messages receive a response | 95% |
| **Platform uptime** | 99.9% | 99.95% |
| **CSAT** | >4.5/5 | >4.7/5 |
| **NPS** | >40 | >60 |

### 10.3 Business Metrics

| Metric | Year 1 Target (₦) | Year 1 Target (USD ~equiv.) | Year 3 Target (₦) |
|--------|------------------|----------------------------|--------------------|
| **Paying organizations** | 300 | — | 7,000 |
| **MRR** | ₦139,731,467 | ~$87,332 | ₦3,047,120,000 |
| **ARR** | ₦1,676,777,600 | ~$1,048,000 | ₦36,565,440,000 |
| **Free-to-paid conversion** | 3–5% | — | 7–10% |
| **Trial-to-paid conversion** | 15–20% | — | 25–30% |
| **NRR** | 110% | — | 125% |
| **Logo churn (annual)** | <10% | — | <5% |
| **CAC** | <₦800,000 | <~$500 | <₦480,000 |
| **LTV/CAC ratio** | >6:1 | — | >16.7:1 |
| **Gross margin** | >75% | — | >80% |

### 10.4 Module-Specific Success Metrics

| Module | Key Metric | Year 1 Target |
|--------|-----------|---------------|
| **Grow** | Active campaigns per paying org | ≥2 per quarter |
| **Grow** | Average entries per campaign | ≥500 |
| **Listen** | Mentions tracked per org per month | ≥3,000 |
| **Listen** | Crisis alert lead time | ≥30 minutes before customer reports the issue |
| **Monitor** | Articles tracked per org per month | ≥500 |
| **Monitor** | SOV accuracy vs. manual check | ≥95% |
| **Engage** | Average first response time | <2 hours |
| **Engage** | SLA compliance rate | ≥90% |
| **Analyze** | Reports generated per org per month | ≥5 |
| **Analyze** | Dashboard load time (P95) | <2 seconds |

---

## 11. User Experience Requirements

### 11.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Clarity** | Clear, jargon-free language. Every label, tooltip, and empty state explains what to do next. |
| **Consistency** | Consistent patterns, colors, and interactions across all five modules. Users learn once; apply everywhere. |
| **Efficiency** | Minimize clicks for primary workflows. The most common action is the easiest action. |
| **Feedback** | Clear feedback for every action: loading states, success confirmations, error messages with resolution steps. |
| **Forgiveness** | Easy to undo. Prevent irreversible errors with confirmation dialogs. Default to soft-delete, not hard-delete. |
| **Progressive disclosure** | Show the most important information first. Advanced options are available but not forced on new users. |
| **African context** | Currency displays in Naira (₦) for Nigerian users. Date formats respect local conventions. Example content reflects African brands. |

### 11.2 Key User Flows

Detailed user journey specifications are documented in [User Journeys.md](./User%20Journeys.md). Key flows include:

| Flow | Entry Point | Exit Point | Success Criterion |
|------|------------|-----------|-------------------|
| **New user onboarding** | Sign-up form | First social account connected | <48 hours to connect first account; >70% completion |
| **Giveaway creation** | Grow → New Campaign | Campaign published | Campaign creation in <15 minutes |
| **Listen setup** | Listen → New Query | First mentions appearing | First mentions visible within 30 minutes |
| **Media monitoring setup** | Monitor → New Monitor | First articles appearing | First articles visible within 30 minutes |
| **Engagement workflow** | New message in inbox | Message marked resolved | Response sent without leaving Nawebeus |
| **Analytics review and export** | Analyze → Dashboard | Report downloaded | Custom report built and exported in <10 minutes |
| **Team member invitation** | Settings → Team | Invitee accepts | Invitee active in org within 24 hours |
| **Plan upgrade** | Usage warning prompt | Upgrade complete | Upgrade completes in <5 minutes; no downtime |
| **Crisis response** | Crisis alert received | Coordinated response sent | Team alerted and response coordinated in <30 minutes |

### 11.3 Responsive Design Requirements

| Viewport | Layout Approach | Feature Priority |
|----------|----------------|-----------------|
| **Desktop** (1280px+) | Full multi-column layouts; sidebar navigation | All features fully accessible |
| **Tablet** (768–1279px) | Optimized layouts; collapsible navigation; touch-friendly controls | All features accessible; some secondary panels collapsed |
| **Mobile** (320–767px) | Single-column; bottom navigation; simplified views | Core reading and alert features; content creation simplified |

### 11.4 Accessibility Requirements

- WCAG 2.1 Level AA compliance for all UI components
- All interactive elements reachable and operable via keyboard
- Screen reader tested with NVDA (Windows) and VoiceOver (macOS/iOS)
- Color is never the only conveyor of meaning (always accompanied by text or icon)
- All form inputs have associated labels; error messages linked to inputs via `aria-describedby`
- All data visualizations (charts, graphs) include accessible text alternatives

---

## 12. Technical Architecture Overview

Detailed technical architecture is documented in [Architecture.md](../technical/Architecture.md) and [ADRs.md](../technical/ADRs.md). Summary for product planning purposes:

### 12.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | TanStack Start, React 19, TypeScript, Tailwind CSS, shadcn/ui | Modern, performant, type-safe |
| **API** | Hono.js on Bun runtime | Lightweight, fast, TypeScript-native |
| **Database** | PostgreSQL with Drizzle ORM | Relational; multi-tenant RLS; type-safe queries |
| **Cache** | Redis | Session management; rate limiting; real-time data |
| **Storage** | Cloudflare R2 / S3-compatible | Media assets; report exports |
| **Hosting** | Coolify (self-managed) on Hetzner VPS (Nigeria-located) | NDPR compliance; cost efficiency; control |
| **Email** | Resend | Modern API; React Email templates; deliverability |
| **Payments** | Paystack (₦ primary) + Stripe (USD international) | Naira billing; global coverage |

### 12.2 Architecture Principles

- **Multi-tenant SaaS** with schema-level and row-level security for zero cross-tenant data leakage
- **Single deployable service** with two entry points (web frontend + API) — modularity without microservice complexity
- **Event-driven** for real-time features; queue-based for background processing
- **API-first** — all UI features available via the same internal API; extensibility by design
- **NDPR-compliant** — Nigerian customer data stored on Nigeria-located infrastructure; no cross-border transfer

### 12.3 Integration Architecture

- **OAuth 2.0** for all social platform connections (no credential sharing)
- **Platform abstraction layer** isolating all platform-specific code behind a common interface
- **Webhooks** for real-time platform events where supported; polling with exponential backoff where not
- **Paystack + Stripe** dual billing integration with unified billing management UI

---

## 13. Constraints

### 13.1 Business Constraints

| Constraint | Value | Owner |
|-----------|-------|-------|
| **Year 1 operating budget** | ₦4,000,000,000 (~$2.5M) | Finance Lead |
| **MVP launch team size** | 8–12 people | Executive Sponsor |
| **MVP launch deadline** | Q2 2026 (non-negotiable) | Executive Sponsor |
| **Compliance at launch** | NDPR, GDPR, CCPA required before any customer onboarding | Legal Director |
| **Primary billing currency** | Nigerian Naira (₦) via Paystack | Finance Lead |

### 13.2 Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Browser support** | Chrome, Firefox, Safari, Edge — latest 2 major versions |
| **Uptime SLA** | 99.9% (≤8.7 hours downtime/year) |
| **Scale target** | 50,000+ organizations by Year 3 without re-architecture |
| **API compliance** | Must operate within all social platform API rate limits and terms of service |
| **Data location** | Nigerian customer data must be stored on Nigeria-located infrastructure (NDPR) |

### 13.3 Regulatory Constraints

| Regulation | Requirement | Enforcement Mechanism |
|------------|-------------|----------------------|
| **NDPR** | Nigerian data on Nigerian infrastructure; consent management; DSAR process | Legal Director + Engineering |
| **GDPR** | Data protection by design; right to erasure; DPA with sub-processors | Legal Director + Engineering |
| **CCPA** | Consumer privacy rights; opt-out | Legal Director + Engineering |
| **COPPA** | No data from users under 13; age gate | Engineering |
| **Platform ToS** | API terms compliance for all 5 integrated platforms | Legal Director + Engineering |

---

## 14. Assumptions

| # | Assumption | Risk If Wrong | Owner |
|---|-----------|--------------|-------|
| A1 | Marketing and PR teams will consolidate tools if a unified product meets feature parity on their top 3 current tools | Slow adoption; repositioning required | Product |
| A2 | Multi-tenant SaaS is preferred; self-hosting is secondary | Architecture investment in self-hosting earlier than planned | Engineering |
| A3 | TanStack Start, Hono, Drizzle, PostgreSQL can scale to 50,000+ organizations | Mid-scale architecture migration | Engineering |
| A4 | Coolify on Nigerian VPS satisfies NDPR data residency requirements | Infrastructure redesign; regulatory risk | Legal + Engineering |
| A5 | Free-to-paid conversion of 3–5% achievable within 90 days of sign-up | Revenue model revision | Product + Marketing |
| A6 | Social platform API access approved within 60 days of application | MVP scope reduced; timeline extended | Engineering |
| A7 | Social platform API rate limits are stable and predictable | Integration reliability degraded | Engineering |
| A8 | English-only at launch is acceptable for 80%+ of Year 1 target market | Localization required earlier | Product |
| A9 | Responsive web is acceptable for mobile users in Year 1 | Mobile app prioritization moves to Year 1 | Product |
| A10 | Paystack merchant account approved within 4 weeks of application | Billing delayed; manual invoicing fallback | Finance |
| A11 | CBN exchange rate will not move more than 15% during MVP development | Emergency pricing review; customer communication | Finance |

---

## 15. Dependencies

### 15.1 External Dependencies

| Dependency | Purpose | Risk Level | Mitigation |
|------------|---------|-----------|------------|
| **YouTube Data API v3** | Video platform data | Medium | Abstraction layer; daily quota management |
| **X (Twitter) API v2** | Microblogging data | High | Monitor policy changes; diversify; abstraction layer |
| **Instagram Graph API** | Photo/video platform | Medium | Facebook Business account required; App Review |
| **Facebook Graph API** | Social network pages | Medium | Page-level permissions only; App Review |
| **Reddit API** | Community platform | Low | Polling only; 60 req/min limit; no scraping |
| **NewsAPI + Mediastack** | Media monitoring | Low | Multi-provider; RSS fallback |
| **African news RSS feeds** | Regional press coverage | Low | Self-maintained; easily replaceable |
| **Paystack** | Naira payment processing | Medium | Apply early (Phase 0); Flutterwave as backup |
| **Stripe** | USD payment processing | Low | Industry standard; reliable |
| **Resend** | Email delivery | Low | SendGrid as backup |
| **Hetzner VPS (Nigeria)** | NDPR-compliant hosting | Low | DigitalOcean as failover |
| **Coolify** | Container orchestration | Low | Open-source; self-hosted; no vendor lock-in |

### 15.2 Internal Dependencies

| Dependency | Provides | Blocks |
|------------|---------|--------|
| **Engineering team** | Platform development | All modules |
| **Design team** | UI/UX, design system | Frontend implementation |
| **QA team** | Test coverage, release gates | Production deployment |
| **DevOps** | Infrastructure, CI/CD | All deployments |
| **Legal** | Compliance review, DPAs, ToS | Launch readiness |
| **Marketing** | GTM materials, waitlist | Customer acquisition |
| **Sales** | Beta customer recruitment | Product validation |
| **Finance** | Paystack/Stripe merchant setup | Billing capability |

---

## 16. Risks & Mitigation

| Risk | Likelihood | Impact | Risk Score | Mitigation | Contingency |
|------|-----------|--------|-----------|------------|-------------|
| **Social platform API changes** | High | High | 🔴 Critical | Abstraction layer; changelog monitoring; 6-week response buffer | De-scope affected integration; accelerate alternatives |
| **Slow customer adoption** | Medium | High | 🟠 High | Strong GTM; 14-day free trial; agency partner program; beta case studies | Accelerate content marketing; revisit pricing |
| **Compliance failure (NDPR/GDPR)** | Low | Very High | 🟠 High | Compliance-first design; legal review at phase gates; pre-launch audit | Emergency legal response; cease affected processing |
| **Scope creep** | High | Medium | 🟠 High | Documented in/out scope; formal change control; Product Lead authority | Formal de-scope of lowest-priority features; timeline extension as last resort |
| **Naira devaluation >15%** | Medium | High | 🟠 High | Exchange rate review policy; annual subscribers locked at purchase-time rate | Emergency pricing review; accelerate international (USD) segment |
| **Paystack merchant approval delayed** | Low | High | 🟡 Medium | Early application in Phase 0; Flutterwave identified as backup | Interim manual invoicing; Flutterwave activation |
| **Key team member departure** | Medium | High | 🟠 High | ADRs; cross-training; competitive retention | Interim contractor; scope reduction |
| **Competitive response (Hootsuite, Meltwater)** | High | Medium | 🟡 Medium | African-first moat; speed; customer lock-in via unified data model | Niche focus; deepen African market before incumbents respond |
| **Data breach** | Low | Very High | 🟠 High | Defense-in-depth; encryption; penetration testing; incident response plan | Incident response playbook; regulatory disclosure |
| **Platform TOS violation** | Low | Very High | 🟠 High | Legal review of API terms; compliance audits | De-scope violating feature; renegotiate access |
| **Performance at scale** | Medium | High | 🟠 High | Load testing at 10x projected load; auto-scaling; performance budgets in CI | Emergency scale-out; temporary feature degradation |

---

## 17. Release Criteria

### 17.1 MVP v1.0 Release Criteria

The MVP will be considered ready for public launch when **all** of the following criteria are met and signed off by the relevant authority.

#### 17.1.1 Functional Criteria (Engineering Lead + QA Lead sign-off)

| # | Criterion | Measurement | Target |
|---|-----------|-------------|--------|
| F1 | All 10 functional modules delivered per FRD | Feature acceptance criteria checklist | 100% complete |
| F2 | All 5 social platforms integrated and tested | Integration test suite | All passing |
| F3 | News source integration operational | Monitor module with ≥50 sources active | ≥50 sources |
| F4 | Paystack Naira billing operational | End-to-end payment test | ₦0 billing errors in staging |
| F5 | Stripe USD billing operational | End-to-end payment test | $0 billing errors in staging |
| F6 | Multi-tenant data isolation verified | Penetration test; isolation test suite | Zero cross-tenant leakage |
| F7 | RBAC enforced across all modules | Role-based test suite | 100% of test cases passing |
| F8 | Audit log capturing all write operations | Completeness test | 100% coverage |
| F9 | Email delivery operational (Resend) | End-to-end email test | Delivery rate ≥98% |

#### 17.1.2 Quality Criteria (QA Lead sign-off)

| # | Criterion | Measurement | Target |
|---|-----------|-------------|--------|
| Q1 | Test coverage | Coverage report | Services >85%; lib >90% |
| Q2 | Zero P0 bugs in production | Bug tracker | 0 P0 open |
| Q3 | Page load time | Synthetic monitoring | <2 seconds P95 |
| Q4 | API response time | APM monitoring | <200ms P95 |
| Q5 | Cross-browser compatibility | Automated test suite | Chrome, Firefox, Safari, Edge passing |
| Q6 | Accessibility audit | Automated + manual audit | WCAG 2.1 AA; zero critical failures |
| Q7 | Security scan | SAST + DAST scan | Zero high or critical vulnerabilities |
| Q8 | Pre-launch penetration test | Third-party pentest report | No unresolved high/critical findings |

#### 17.1.3 Operational Criteria (DevOps Lead sign-off)

| # | Criterion | Target |
|---|-----------|--------|
| O1 | Production infrastructure provisioned (Nigeria-located VPS) | Operational |
| O2 | CI/CD pipeline operational with blue-green deployment | Deploy to production in <30 minutes |
| O3 | Monitoring and alerting configured (uptime, error rate, latency) | Alerts firing in staging environment |
| O4 | Backup verified and restoration tested | RTO <4 hours; RPO <1 hour |
| O5 | Incident response procedures documented and tested | Runbook for all P1/P2 scenarios |
| O6 | Status page operational | status.nawebeus.com live |

#### 17.1.4 Compliance Criteria (Legal Director sign-off)

| # | Criterion | Target |
|---|-----------|--------|
| C1 | NDPR compliance verified (Nigerian customer data on Nigerian infrastructure) | Verified |
| C2 | GDPR compliance verified | Verified |
| C3 | CCPA compliance verified | Verified |
| C4 | Privacy Policy, Terms of Service, Cookie Policy, Acceptable Use Policy published | Live on website |
| C5 | Data Processing Agreements ready for enterprise customers | Reviewed and signed off |
| C6 | Data subject rights (access, erasure, portability) functional | QA tested; 100% passing |
| C7 | Cookie consent mechanism implemented (GDPR-compliant) | Live on marketing site and app |
| C8 | NITDA registration for NDPR compliance submitted | Application submitted or confirmed |

#### 17.1.5 Business Criteria (Executive Sponsor sign-off)

| # | Criterion | Target (₦) | Target (USD ~equiv.) |
|---|-----------|-----------|---------------------|
| B1 | Beta program completed | 50+ participants; NPS >30 | — |
| B2 | Beta CSAT | >4.0/5 | — |
| B3 | Beta customer references available | ≥10 published case studies or testimonials | — |
| B4 | Launch week MRR target | ₦15,840,000 | ~$9,900 |
| B5 | Marketing site, pricing page, and support portal live | Operational | — |
| B6 | Sales team trained on platform and competitive positioning | 100% of sales team certified | — |
| B7 | Customer success onboarding playbooks ready | Playbooks for Free, Pro, and Enterprise | — |

### 17.2 Launch Readiness Checklist

- [ ] All F1–F9 functional criteria met and signed off
- [ ] All Q1–Q8 quality criteria met and signed off
- [ ] All O1–O6 operational criteria met and signed off
- [ ] All C1–C8 compliance criteria met and signed off
- [ ] All B1–B7 business criteria met and signed off
- [ ] Executive Sponsor launch go/no-go approval
- [ ] Launch announcement prepared and scheduled
- [ ] PR and media strategy ready (TechCabal, BusinessDay, TechCrunch Africa)
- [ ] Customer support team live and trained
- [ ] Rollback plan documented and tested

---

## 18. Post-Launch Roadmap

### Phase 6: Mobile App (Q3 2026)
Native iOS and Android applications with push notifications, offline indicators, and Engage-focused mobile workflows. App Store and Play Store submission.

### Phase 7: Advanced AI/ML (Q4 2026)
Predictive analytics for sentiment trend forecasting; AI-powered auto-response suggestions; content generation suggestions; image and video sentiment analysis.

### Phase 8: Public API and Integrations (Q1 2027)
Documented public RESTful API v1; developer portal; API key management; webhooks for external integrations; Zapier integration; HubSpot and Salesforce connectors.

### Phase 9: Enterprise Features (Q2 2027)
Enterprise SSO (SAML, Okta, Azure AD); advanced workflow automation; custom roles and permissions; white-labeling for agencies; agency resale program.

### Phase 10: Additional Platform Integrations (Q3 2027)
LinkedIn integration; TikTok integration; Threads integration; Pinterest integration; Bluesky integration.

### Phase 11: Social Media Publishing and Scheduling (Q4 2027)
Multi-platform post scheduler; content calendar; approval workflows; best-time-to-post AI recommendations; bulk scheduling.

### Phase 12: Internationalization and African Expansion (Q4 2027 – Q1 2028)
French language support (Francophone West Africa); Swahili support (East Africa); POPIA compliance (South Africa); Kenya Data Protection Act compliance; regional news source expansion.

### Phase 13: Influencer Management Module (Q2 2028)
Influencer discovery across Instagram, YouTube, TikTok; audience authenticity and fraud detection; campaign management; ROI tracking; brand safety monitoring.

### Phase 14: Advanced Analytics and BI Integration (Q3 2028)
Custom metric builder; advanced segmentation; predictive lead scoring; BI tool connectors (Looker, Tableau, Power BI); data warehouse export.

---

## 19. Glossary

| Term | Definition |
|------|------------|
| **ARR** | Annual Recurring Revenue — total contracted subscription revenue on an annualized basis |
| **CAC** | Customer Acquisition Cost — total sales and marketing spend divided by new customers acquired |
| **CSAT** | Customer Satisfaction Score — average rating from post-interaction surveys |
| **Crisis Alert** | Automated notification triggered when mention volume or negative sentiment exceeds configured thresholds |
| **DAU/MAU** | Daily Active Users divided by Monthly Active Users — measures engagement depth |
| **DSAR** | Data Subject Access Request — formal request by an individual to receive their personal data |
| **Embargo** | Agreement between a brand and media contact not to publish information before a specified date |
| **Impact Score** | Composite score: source domain authority × sentiment × brand prominence in article |
| **KPI** | Key Performance Indicator |
| **LTV** | Lifetime Value — average revenue generated by a customer over their relationship with Nawebeus |
| **MFA** | Multi-Factor Authentication — second factor (TOTP) required after password |
| **MRR** | Monthly Recurring Revenue — total active subscription value in a month |
| **Multi-tenancy** | Architecture where multiple customer organizations share infrastructure with strict data isolation |
| **NDPR** | Nigerian Data Protection Regulation — Nigeria's primary data protection law |
| **NPS** | Net Promoter Score — measures likelihood to recommend on a −100 to +100 scale |
| **NRR** | Net Revenue Retention — MRR retained from existing customers including expansion, net of churn |
| **OAuth 2.0** | Authorization protocol used to connect social platform accounts |
| **RBAC** | Role-Based Access Control — permission system based on user roles |
| **ROI** | Return on Investment |
| **RPO** | Recovery Point Objective — maximum acceptable data loss in a disaster |
| **RTO** | Recovery Time Objective — maximum acceptable time to restore service after a disaster |
| **Share of Voice (SOV)** | Brand's percentage of total mentions or coverage vs. a defined competitor set |
| **SLA** | Service Level Agreement — committed response and resolution times |
| **SOC 2 Type II** | Security certification evaluating controls over a 6–12 month observation period |
| **TOTP** | Time-Based One-Time Password — standard for MFA authenticator apps |
| **WAO** | Weekly Active Organizations — North Star metric: organizations with ≥3 active users in 7 days |

---

## 20. Document Governance

### 20.1 Relationship to Other Documents

This PRD is the root product document. All detailed product specifications derive their scope authority from this document.

```
Project Charter (root authorization)
└── Business.md (business model, pricing, GTM)
    └── Market Research.md (validation, competitive analysis)
        └── Decision Log.md (all significant decisions)

PRD (this document — product scope, requirements, criteria)
├── Personas.md — detailed persona specifications
├── User Journeys.md — end-to-end user flow specifications
├── FRD — Functional Requirements Document (detailed per-module specs)
├── UX & Design System
└── [Technical Layer]
    ├── Architecture.md
    ├── ADRs.md
    ├── Engineering.md
    ├── API.md
    ├── Database.md
    └── Security.md
```

### 20.2 Change Control

| Change Type | Process | Authority |
|-------------|---------|-----------|
| **In-scope feature addition (MVP)** | Formal request → impact assessment → Executive Sponsor approval | Executive Sponsor |
| **In-scope feature removal (MVP)** | Product Lead decision with Engineering Lead concurrence | Product Lead |
| **Out-of-scope to in-scope** | Formal change request → Engineering + Design impact → Executive Sponsor | Executive Sponsor |
| **Phase reassignment** | Product Lead proposal → all leads review → approval | Product Lead |
| **Success metric change** | Product Lead + Finance Lead proposal → Executive Sponsor | Executive Sponsor |

### 20.3 Review Schedule

| Review | Frequency | Participants |
|--------|-----------|-------------|
| Module specification review | At each phase gate | Product Lead, Engineering Lead, QA Lead |
| Full PRD review | Quarterly | All leads + Executive Sponsor |
| Success metrics review | Monthly | Product Lead, Finance Lead |
| Scope review | At each phase gate | Executive Sponsor, all leads |

### 20.4 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-11-25 | Product Management | Initial draft — global market focus; USD pricing |
| 0.2 | 2026-07-20 | Product Management | Added African market focus; converted to Naira primary; added NDPR; added Paystack |
| 0.3 | 2026-07-21 | Product Management | Added African personas (Ade, Chidi, Ifeoma); expanded module requirements with acceptance criteria |
| 1.0.0 | 2026-07-21 | Product Management | Merged and unified; expanded all modules to full requirement format with ACs; added Naira financial targets; full compliance, risk, and release criteria sections; document governance |

---

## 21. Approval

By signing below, each approver confirms they have read this Product Requirements Document in full, agree with the product scope and requirements documented herein, and authorize the product to proceed to detailed specification and development.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Executive Sponsor** | _________________________ | _________________________ | _____________ |
| **Product Lead** | _________________________ | _________________________ | _____________ |
| **Engineering Lead** | _________________________ | _________________________ | _____________ |
| **Design Lead** | _________________________ | _________________________ | _____________ |
| **QA Lead** | _________________________ | _________________________ | _____________ |
| **Marketing Lead** | _________________________ | _________________________ | _____________ |
| **Sales Lead** | _________________________ | _________________________ | _____________ |
| **Legal & Compliance** | _________________________ | _________________________ | _____________ |
| **Finance Lead** | _________________________ | _________________________ | _____________ |

---

*This document is governed by the Universal Product Documentation Framework (UPDF). Questions should be directed to the Product Lead. Amendment requests must follow the change control process defined in §20.2. All financial figures are expressed in Nigerian Naira (₦) as the primary currency unless explicitly stated otherwise. USD equivalents are provided at ₦1,600/USD, reviewed quarterly per the exchange rate policy in Business.md §5.7.*