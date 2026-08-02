# Module 4: Growth & Giveaways

**Document Version:** 1.0.0
**Last Updated:** 2026-07-22
**Status:** Active
**Owner:** Product Lead + Marketing Lead

---

## 1. Overview

### 1.1 Module Description

The Growth & Giveaways module provides a comprehensive platform for creating, managing, and optimizing social media giveaways and viral marketing campaigns to drive audience growth, engagement, and lead generation. It enables marketing teams to design legally compliant campaigns, collect and validate entries, automate winner selection, track prize fulfillment, and measure ROI across multiple social platforms — all from a single unified interface.

This module transforms social media giveaways from one-off contests into strategic, repeatable growth engines that deliver measurable business outcomes. By combining multi-channel entry collection, intelligent fraud prevention, cryptographically fair winner selection, and real-time analytics, it closes the gap between campaign execution and commercial results.

### 1.2 Module Objectives

| Objective | Description | Success Metric |
|-----------|-------------|----------------|
| **Audience Growth** | Drive new followers and email subscribers per campaign | Average 1,000+ new followers per campaign |
| **Engagement Boost** | Increase social media engagement rates | 30–35% engagement increase per campaign |
| **Lead Generation** | Capture qualified email and contact data | 10,000+ new leads per campaign |
| **Brand Awareness** | Expand reach and total impressions | Millions of impressions per active campaign |
| **Viral Growth** | Enable referral-based exponential growth | ≥60% of new sign-ups via referrals |
| **Cost-Effective Marketing** | Lower cost per acquisition versus paid ads | ≥70% lower CPA versus paid advertising |
| **Legal Compliance** | Ensure 100% of campaigns meet jurisdictional requirements | Zero compliance violations |
| **Fraud Prevention** | Maintain entry integrity across all campaigns | <5% fraudulent entries |
| **Fair Winner Selection** | Cryptographically verifiable random selection | 100% auditable and reproducible |

### 1.3 Module Scope

**In Scope:**
- Campaign builder and configuration with legal compliance tools
- Campaign publishing, embedding, and distribution across platforms
- Multi-channel entry collection and real-time validation
- Fraud detection and prevention (reCAPTCHA, device fingerprinting, velocity checks)
- Entry management, bulk operations, and participant administration
- Winner selection (random, weighted, manual) with cryptographic audit trail
- Prize fulfillment tracking (physical and digital)
- Campaign analytics, ROI calculation, and optimization recommendations
- Template library and campaign duplication
- Tax documentation for high-value prizes

**Out of Scope (Future Phases):**
- Advanced AI-powered campaign optimization — Phase 4 (Q4 2026)
- Influencer collaboration campaigns — Phase 10 (Q2 2028)
- Multi-language campaign templates — Phase 8 (Q4 2027)
- Advanced prize fulfillment integrations — Phase 12 (Year 3)
- Cryptocurrency or NFT prizes — Deferred indefinitely
- Template marketplace for third-party creators — Phase 13 (Year 3)

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Chidi** | Head of Marketing | Campaign strategy, ROI tracking, budget decisions, legal compliance |
| **Bola** | Social Media Manager | Campaign creation, entry monitoring, winner selection, execution |
| **Ifeoma** | Agency Owner | Multi-client campaign management, performance comparison |
| **Kemi** | Content Strategist | Campaign content, messaging optimization, template creation |

### 1.5 Dependencies

| Dependency | Module | Purpose |
|------------|--------|---------|
| **User Management & Organization** | MOD-008 | Authentication, authorization, tenant context, RBAC enforcement |
| **Social Publishing & Scheduling** | MOD-002 | Campaign promotion, auto-posting, social action verification |
| **Engagement Hub** | MOD-007 | Winner communication and participant engagement |
| **Analytics & Reporting** | MOD-004 | Campaign performance measurement and reporting |
| **Notifications & Alerts** | MOD-009 | Winner announcements, milestone alerts, participant updates |

---

## 2. User Stories

### 2.1 Primary User Stories (P0 — Must Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-GRW-001** | As a Social Media Manager, I want to create a giveaway campaign so I can grow my audience and engagement with minimal setup time. | P0 | Campaign created and published in <30 minutes; all required fields validated |
| **US-GRW-002** | As a Social Media Manager, I want to configure entry requirements (follow, like, share, comment, tag, email signup) so I can drive specific growth actions. | P0 | Entry requirements enforce correctly with 100% accuracy |
| **US-GRW-003** | As a Head of Marketing, I want to track campaign performance in real time so I can measure ROI and make optimization decisions. | P0 | Analytics dashboard loads within 3 seconds; data refreshes within 30 seconds |
| **US-GRW-004** | As a Social Media Manager, I want to randomly select winners from verified entries so the giveaway is fair, transparent, and legally defensible. | P0 | Winner selection uses cryptographically secure randomness with immutable audit trail |
| **US-GRW-005** | As a Social Media Manager, I want to prevent duplicate and fraudulent entries so the competition maintains integrity. | P0 | Duplicate entries filtered with ≥99% accuracy; fraud blocked at ≥99% rate |

### 2.2 Secondary User Stories (P1 — Should Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-GRW-006** | As a Social Media Manager, I want to verify that entrants completed required actions so only eligible participants qualify. | P1 | Social actions verified within 30 seconds for 95%+ of cases |
| **US-GRW-007** | As a Head of Marketing, I want to configure referral bonuses so I can drive viral growth through participant networks. | P1 | Referral tracking attributes correctly with ≥95% accuracy across all hops |
| **US-GRW-008** | As an Agency Owner, I want to manage campaigns across multiple clients from a single dashboard so I can scale efficiently. | P1 | Workspace switcher supports multi-client campaign views with isolated data |
| **US-GRW-009** | As a Social Media Manager, I want to schedule campaigns in advance so I can plan campaigns around key dates and campaigns. | P1 | Campaign scheduling accurate to minute; auto-publishes and auto-ends on schedule |
| **US-GRW-010** | As a Social Media Manager, I want automated winner notification so I save time and ensure consistent communication. | P1 | Winner notifications delivered within 1 minute of selection |

### 2.3 Tertiary User Stories (P2 — Nice to Have)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| **US-GRW-011** | As a Head of Marketing, I want to see participant demographics and analytics so I can understand the audience my campaigns attract. | P2 | Demographic breakdown available for all verified entrants |
| **US-GRW-012** | As a Social Media Manager, I want to create and reuse campaign templates so I can replicate successful formats without rebuilding from scratch. | P2 | Template pre-fills campaign with 100% accuracy; editable before publishing |
| **US-GRW-013** | As a Head of Marketing, I want to A/B test campaign formats so I can optimize performance over time. | P2 | A/B test manages multiple variations with statistical significance reporting |
| **US-GRW-014** | As a Social Media Manager, I want to export participant data to CSV so I can do custom analysis or import into a CRM. | P2 | Export completes within 30 seconds for up to 10,000 entries |

---

## 3. Functional Requirements

### 3.1 Campaign Builder & Configuration

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-001** | System shall support campaign creation with custom branding, cover images, and rich-text descriptions | P0 | Auto-save every 30 seconds; 10-version history |
| **FR-GRW-002** | System shall support multiple campaign types: standard, referral, and multi-action | P0 | Type determines entry method options |
| **FR-GRW-003** | System shall support multi-platform campaigns: Instagram, Facebook, X (Twitter), TikTok, LinkedIn | P0 | Platform-specific entry method validation per platform |
| **FR-GRW-004** | System shall support prize configuration with name, description, value in NGN, quantity, and images | P0 | Minimum 1 image required for publishing |
| **FR-GRW-005** | System shall support campaign scheduling with configurable start and end dates and timezone | P0 | IANA timezone support; max 90-day duration |
| **FR-GRW-006** | System shall enforce legal compliance: terms and conditions, minimum age, geographic restrictions, official rules | P0 | Cannot publish without complete legal documentation |
| **FR-GRW-007** | System shall support legal templates by country with compliance flags for potential issues | P1 | Jurisdiction-specific auto-generation |
| **FR-GRW-008** | System shall support campaign preview in both desktop and mobile layouts before publishing | P1 | Preview updates in real time |
| **FR-GRW-009** | System shall support campaign duplication with smart date adjustment and new identifier generation | P1 | Preserves full configuration |
| **FR-GRW-010** | System shall support prize value declaration with automatic tax threshold alerting (≥₦1,200,000) | P0 | Triggers tax form collection workflow |

### 3.2 Entry Requirements & Point System

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-011** | System shall support "Follow social account" entry requirement with platform OAuth verification | P0 | Real-time verification |
| **FR-GRW-012** | System shall support "Like post" entry requirement with platform API validation | P0 | Post URL required at setup |
| **FR-GRW-013** | System shall support "Comment on post" entry requirement with comment scanning | P0 | Keyword verification optional |
| **FR-GRW-014** | System shall support "Share/repost" entry requirement with share tracking | P0 | Platform share verification |
| **FR-GRW-015** | System shall support "Tag friends" entry requirement with configurable tag count (max 3) | P0 | Prevents spam |
| **FR-GRW-016** | System shall support "Visit website" entry requirement with tracking pixel | P1 | URL required at setup |
| **FR-GRW-017** | System shall support "Email subscription" entry requirement with double opt-in | P1 | GDPR compliant |
| **FR-GRW-018** | System shall support "Refer a friend" entry requirement with unique referral links and configurable bonus points | P1 | Unlimited or capped referrals |
| **FR-GRW-019** | System shall support a configurable point system (1–50 points per entry method) for weighted winner selection | P1 | Total possible points shown during configuration |
| **FR-GRW-020** | System shall support maximum 10 entry methods per campaign (Pro plan); unlimited (Enterprise) | P1 | Enforced at campaign configuration |

### 3.3 Campaign Publishing & Distribution

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-021** | System shall generate a unique, SEO-friendly campaign URL on publish | P0 | Format: nawebeus.com/g/{org-slug}/{campaign-slug} |
| **FR-GRW-022** | System shall generate embeddable iframe widget code with real-time customization preview | P0 | Widget loads in <2 seconds on external sites |
| **FR-GRW-023** | System shall auto-post campaign announcement to selected connected social accounts | P0 | Platform-native post format |
| **FR-GRW-024** | System shall generate QR codes in PNG and SVG formats for print distribution | P1 | Available immediately on publish |
| **FR-GRW-025** | System shall support widget branding customization: colors, logo, custom CSS (Pro+) | P1 | Changes apply instantly in preview |
| **FR-GRW-026** | System shall generate SEO meta tags, Open Graph tags, and Twitter Card markup for campaign pages | P1 | Auto-populated from campaign content |
| **FR-GRW-027** | System shall support publish-now, scheduled publish, draft, and admin-only test mode | P0 | Test mode visible only to Admins |

### 3.4 Entry Collection & Fraud Prevention

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-028** | System shall collect and track entries in real time with a live entry counter | P0 | Counter updates within 5 seconds globally |
| **FR-GRW-029** | System shall enforce duplicate entry prevention by email, IP address, and device fingerprint | P0 | ≥99% duplicate detection accuracy |
| **FR-GRW-030** | System shall implement reCAPTCHA v3 score-based blocking (score <0.5 blocked) | P0 | Blocks ≥99% of bot entries |
| **FR-GRW-031** | System shall implement VPN/proxy detection and IP geolocation for geographic restriction enforcement | P0 | ≥99% enforcement accuracy |
| **FR-GRW-032** | System shall implement device fingerprinting using browser, OS, screen resolution, and user agent | P1 | Part of multi-layer fraud detection |
| **FR-GRW-033** | System shall enforce social account age verification (minimum 30 days old) to prevent fake accounts | P1 | Applied at entry submission |
| **FR-GRW-034** | System shall perform velocity checks: entries per minute from the same source | P1 | Configurable threshold |
| **FR-GRW-035** | System shall detect and block disposable email addresses | P1 | Applied at form submission |
| **FR-GRW-036** | System shall verify social actions asynchronously within 30 seconds for 95%+ of cases | P0 | Background worker queue |
| **FR-GRW-037** | System shall send entry confirmation emails to participants within 60 seconds of verified submission | P0 | Triggered on verification completion |

### 3.5 Entry Management & Administration

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-038** | System shall provide an entry management table with virtual scrolling supporting 100,000+ entries | P0 | Loads in <3 seconds |
| **FR-GRW-039** | System shall support advanced filtering by status, date range, entry method, points, and geography | P1 | Results in <500ms |
| **FR-GRW-040** | System shall support bulk operations: approve, disqualify, export, tag, and message (up to 1,000 at a time) | P1 | Completes in <30 seconds |
| **FR-GRW-041** | System shall support CSV export of up to 10,000 entries per export with all required fields | P1 | Export completes within 30 seconds |
| **FR-GRW-042** | System shall support manual entry creation by Admins with required justification reason | P2 | Bypasses normal verification; audit logged |
| **FR-GRW-043** | System shall support manual entry status changes (verify, disqualify) with audit log | P1 | All changes immutably recorded |
| **FR-GRW-044** | System shall provide participant profiles with cross-campaign entry history and engagement metrics | P2 | Available in participant detail view |
| **FR-GRW-045** | System shall support GDPR data export and deletion requests per participant | P1 | Full data coverage within 72 hours |

### 3.6 Winner Selection & Prize Fulfillment

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-046** | System shall support cryptographically secure random winner selection (CSPRNG) | P0 | crypto.randomBytes; audit trail generated |
| **FR-GRW-047** | System shall support weighted random selection based on entry points | P1 | Points determine probability weight |
| **FR-GRW-048** | System shall support manual (judge's choice) winner selection from a filtered shortlist | P1 | With required justification |
| **FR-GRW-049** | System shall support tiered winner selection: grand prize, runners-up, consolation prizes | P1 | Configurable tier structure |
| **FR-GRW-050** | System shall enforce winner eligibility verification: age, geography, account status, social verifications | P0 | Automated pre-selection check |
| **FR-GRW-051** | System shall generate a cryptographic selection proof (SHA-256 hash) for each winner draw | P0 | Stored immutably for legal audit |
| **FR-GRW-052** | System shall notify winners via email within 5 minutes of selection | P0 | Includes prize details and claim instructions |
| **FR-GRW-053** | System shall enforce winner response deadline (default 7 days; configurable) with automated reminders at 3 days and 1 day | P0 | Auto-promotes runner-up on deadline expiry |
| **FR-GRW-054** | System shall collect winner shipping addresses with validation (for physical prizes) | P1 | Address verified before fulfillment |
| **FR-GRW-055** | System shall collect tax documentation for prizes valued at or above ₦1,200,000 | P0 | W-9 (US) or local equivalent via e-signature |
| **FR-GRW-056** | System shall track prize fulfillment status in real time: notified, accepted, shipped, delivered, forfeited | P1 | Carrier API integration for shipping tracking |
| **FR-GRW-057** | System shall deliver digital prizes (codes, downloads, account access) via email within 24 hours of acceptance | P1 | Secure link with expiry |

### 3.7 Campaign Analytics & Optimization

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-058** | System shall provide a real-time campaign performance dashboard with key metrics | P0 | Loads within 3 seconds |
| **FR-GRW-059** | System shall track: total entries, verified entries, conversion rate, social shares, referrals, new followers, email subscribers, and estimated reach | P0 | Updated within 30 seconds |
| **FR-GRW-060** | System shall calculate cost per entry, cost per lead, cost per acquisition, and campaign ROI | P1 | Requires cost input from user |
| **FR-GRW-061** | System shall provide funnel analysis from campaign views to verified completed entries | P1 | Per-stage conversion rates |
| **FR-GRW-062** | System shall provide demographic analytics: top countries, age group distribution, platform breakdown | P2 | Aggregated and anonymized |
| **FR-GRW-063** | System shall support campaign comparison across active and historical campaigns | P2 | Side-by-side metrics view |
| **FR-GRW-064** | System shall provide optimization recommendations based on campaign performance patterns | P2 | Actionable with estimated impact |
| **FR-GRW-065** | System shall support data export in CSV, PDF, and Excel formats | P1 | Includes raw data and formatted reports |

### 3.8 Template Library

| Requirement ID | Description | Priority | Notes |
|----------------|-------------|----------|-------|
| **FR-GRW-066** | System shall provide a template library with categories: Audience Growth, Lead Generation, Brand Awareness, Product Launch, Customer Loyalty, Seasonal | P1 | Gallery loads in <2 seconds |
| **FR-GRW-067** | System shall support template application that pre-fills campaign configuration with 100% field accuracy | P1 | User can edit all fields after application |
| **FR-GRW-068** | System shall display template performance metrics: average conversion rate, times used, success stories | P2 | Informed template selection |
| **FR-GRW-069** | System shall support organization-level template sharing and management | P2 | Shared within organization; creator retains ownership |

---

## 4. Business Rules

### 4.1 Campaign Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-GRW-001** | Minimum campaign duration is 1 day; maximum is 90 days | Ensures reasonable participation time and prevents indefinite campaigns |
| **BR-GRW-002** | Campaigns must have at least 1 entry method configured and validated | Logical requirement for a functioning campaign |
| **BR-GRW-003** | Legal terms and conditions, official rules, and privacy policy must be complete before publishing | Legal and regulatory compliance requirement |
| **BR-GRW-004** | Prize value must be declared in NGN before campaign can be published | Tax and legal requirement |
| **BR-GRW-005** | Campaigns can be paused after publishing but cannot be deleted while active | Preserves data integrity and participant expectations |
| **BR-GRW-006** | Campaigns can only be edited after publishing for non-material fields (description, images) | Prevents retroactive changes that would affect participant eligibility |
| **BR-GRW-007** | Prize value ≥ ₦100,000,000 requires manual Admin approval before publishing | Risk management for exceptionally high-value campaigns |
| **BR-GRW-008** | Geographic restrictions are optional but, where configured, are enforced via IP geolocation | Legal compliance for jurisdiction-specific campaigns |

### 4.2 Entry Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-GRW-009** | One entry per email address per campaign | Prevents spam and duplicate entries |
| **BR-GRW-010** | Duplicate entries are detected by email, IP address, and device fingerprint | Multi-layer fraud prevention |
| **BR-GRW-011** | Social actions must be verified before the corresponding entry points are awarded | Ensures data accuracy and entry integrity |
| **BR-GRW-012** | Fraudulent entries are auto-disqualified and flagged in the audit log | Maintains entry pool quality |
| **BR-GRW-013** | "Tag friends" entry method is capped at 3 tags per entry to prevent spam | Platform compliance and audience quality |
| **BR-GRW-014** | Email subscription entries must use double opt-in | GDPR compliance |
| **BR-GRW-015** | Maximum entries per participant per campaign is configurable with a default cap | Prevents one participant from dominating the entry pool |
| **BR-GRW-016** | Referral bonuses must be capped per campaign to prevent referral ring abuse | Fraud prevention |

### 4.3 Winner Selection Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-GRW-017** | Winner selection must use cryptographically secure randomness (CSPRNG) for random and weighted methods | Legal fairness requirement |
| **BR-GRW-018** | Winners must pass automated eligibility verification before being confirmed | Ensures legal compliance |
| **BR-GRW-019** | Every winner selection event generates an immutable cryptographic proof stored in the audit log | Creates legally defensible record of fair selection |
| **BR-GRW-020** | Winner response deadline defaults to 7 days and is configurable up to 30 days | Provides reasonable claim window |
| **BR-GRW-021** | Unclaimed prizes automatically promote the next runner-up when the deadline expires | Ensures prizes are always awarded |
| **BR-GRW-022** | A winner cannot be selected more than once in the same campaign | Prevents duplicate prize awards |

### 4.4 Prize Fulfillment Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-GRW-023** | Tax documentation must be collected for prizes valued at or above ₦1,200,000 | Tax compliance |
| **BR-GRW-024** | Shipping addresses must be validated before physical prizes are dispatched | Ensures successful delivery |
| **BR-GRW-025** | Digital prizes must be delivered within 24 hours of winner acceptance | Sets a clear service expectation |
| **BR-GRW-026** | Tracking information must be shared with winners upon shipment | Transparency and winner satisfaction |

### 4.5 Legal & Compliance Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| **BR-GRW-027** | Campaigns must include official rules with all material terms and an alternate means of entry (AMOE) | Legal requirement in many jurisdictions |
| **BR-GRW-028** | Campaigns must disclose eligibility requirements: minimum age and geographic residency restrictions | Legal compliance |
| **BR-GRW-029** | Campaigns must include prize approximate retail value (ARV) in NGN | Legal and tax transparency |
| **BR-GRW-030** | Social media platforms must be disclosed as not sponsoring the giveaway | Platform terms of service compliance (Instagram, Facebook, TikTok) |
| **BR-GRW-031** | Participant data is retained per jurisdiction-specific legal requirements and deleted on GDPR/NDPR request | Privacy regulation compliance |

---

## 5. Validation Rules

### 5.1 Campaign Configuration Validation

```typescript
const campaignConfigSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  type: z.enum(['standard', 'referral', 'multi_action']),
  prizeValue: z.number().int().min(0).max(999999999), // NGN
  prizeQuantity: z.number().int().min(1).max(10000),
  winnerCount: z.number().int().min(1).max(1000),
  startDate: z.date().min(new Date()),
  endDate: z.date(),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/), // IANA timezone
  minimumAge: z.number().int().min(13).max(99),
  entryMethods: z.array(z.object({
    type: z.enum([
      'follow', 'like', 'comment', 'share', 'tag_friends',
      'visit_website', 'email_subscribe', 'refer_friend', 'custom'
    ]),
    points: z.number().int().min(1).max(50),
    config: z.record(z.any()).optional()
  })).min(1).max(10)
})
.refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date'
})
.refine(data => {
  const days = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 1 && days <= 90;
}, {
  message: 'Campaign duration must be between 1 and 90 days'
});
```

### 5.2 Entry Submission Validation

```typescript
const entrySchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.date().optional(), // required when minimumAge is set
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2
  recaptchaToken: z.string().min(1),
  referralCode: z.string().optional(),
  customFields: z.record(z.any()).optional()
});
```

### 5.3 Winner Selection Validation

```typescript
const winnerSelectionSchema = z.object({
  campaignId: z.string().uuid(),
  selectionMethod: z.enum([
    'simple_random', 'weighted_random', 'judge_choice', 'skill_based', 'tiered'
  ]),
  numberOfWinners: z.number().int().min(1).max(1000),
  numberOfRunnerUps: z.number().int().min(0).max(1000).default(5),
  responseDeadlineDays: z.number().int().min(1).max(30).default(7),
  justification: z.string().min(10).optional() // required for judge_choice
});
```

### 5.4 Prize Fulfillment Validation

```typescript
const shippingAddressSchema = z.object({
  fullName: z.string().min(2).max(100),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  stateProvince: z.string().optional(),
  postalCode: z.string().min(3).max(20),
  country: z.string().length(2) // ISO 3166-1 alpha-2
});
```

---

## 6. Permissions (RBAC)

### 6.1 Permission Definitions

| Permission | Description |
|------------|-------------|
| `growth:campaigns:read` | View campaigns and campaign details |
| `growth:campaigns:create` | Create new campaigns |
| `growth:campaigns:edit` | Edit existing campaigns |
| `growth:campaigns:delete` | Delete or archive campaigns |
| `growth:campaigns:publish` | Publish, pause, and end campaigns |
| `growth:entries:read` | View entries and participant data |
| `growth:entries:verify` | Manually verify or disqualify entries |
| `growth:entries:export` | Export entry data to CSV |
| `growth:participants:read` | View participant profiles and history |
| `growth:winners:select` | Initiate winner selection |
| `growth:winners:manage` | Manage winner fulfillment and status |
| `growth:analytics:read` | View campaign analytics and reports |
| `growth:templates:manage` | Create, edit, and manage campaign templates |

### 6.2 Role Permission Matrix

| Permission | Admin | Manager | Analyst | Viewer |
|------------|:-----:|:-------:|:-------:|:------:|
| `growth:campaigns:read` | ✅ | ✅ | ✅ | ✅ |
| `growth:campaigns:create` | ✅ | ✅ | ❌ | ❌ |
| `growth:campaigns:edit` | ✅ | ✅ (own) | ❌ | ❌ |
| `growth:campaigns:delete` | ✅ | ❌ | ❌ | ❌ |
| `growth:campaigns:publish` | ✅ | ✅ | ❌ | ❌ |
| `growth:entries:read` | ✅ | ✅ | ✅ | ✅ |
| `growth:entries:verify` | ✅ | ✅ | ❌ | ❌ |
| `growth:entries:export` | ✅ | ✅ | ✅ | ❌ |
| `growth:participants:read` | ✅ | ✅ | ✅ | ✅ |
| `growth:winners:select` | ✅ | ✅ | ❌ | ❌ |
| `growth:winners:manage` | ✅ | ✅ | ❌ | ❌ |
| `growth:analytics:read` | ✅ | ✅ | ✅ | ✅ |
| `growth:templates:manage` | ✅ | ✅ | ❌ | ❌ |

### 6.3 API Endpoint Permissions

| Endpoint | Method | Required Permission |
|----------|--------|---------------------|
| `/api/v1/growth/campaigns` | GET | `growth:campaigns:read` |
| `/api/v1/growth/campaigns` | POST | `growth:campaigns:create` |
| `/api/v1/growth/campaigns/{id}` | GET | `growth:campaigns:read` |
| `/api/v1/growth/campaigns/{id}` | PATCH | `growth:campaigns:edit` |
| `/api/v1/growth/campaigns/{id}` | DELETE | `growth:campaigns:delete` |
| `/api/v1/growth/campaigns/{id}/publish` | POST | `growth:campaigns:publish` |
| `/api/v1/growth/campaigns/{id}/pause` | POST | `growth:campaigns:publish` |
| `/api/v1/growth/campaigns/{id}/end` | POST | `growth:campaigns:publish` |
| `/api/v1/growth/campaigns/{id}/entries` | GET | `growth:entries:read` |
| `/api/v1/growth/campaigns/{id}/entries/bulk` | POST | `growth:entries:verify` |
| `/api/v1/growth/campaigns/{id}/entries/export` | POST | `growth:entries:export` |
| `/api/v1/growth/campaigns/{id}/winners/select` | POST | `growth:winners:select` |
| `/api/v1/growth/campaigns/{id}/winners` | GET | `growth:winners:select` |
| `/api/v1/growth/campaigns/{id}/analytics` | GET | `growth:analytics:read` |
| `/api/v1/growth/campaigns/{id}/duplicate` | POST | `growth:campaigns:create` |
| `/api/v1/growth/templates` | GET | `growth:campaigns:read` |
| `/api/v1/growth/templates` | POST | `growth:templates:manage` |
| `/api/v1/growth/entries` | POST | Public (participant-facing) |
| `/api/v1/growth/participants/{id}` | GET | `growth:participants:read` |

---

## 7. Data Model

### 7.1 Entity: Campaign

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `organization_id` | UUID | FK to organizations | No |
| `name` | TEXT | Internal campaign name (max 100) | No |
| `slug` | TEXT | URL-friendly identifier (unique per org) | No |
| `title` | TEXT | Public campaign title (max 200) | No |
| `description` | TEXT | Rich-text description (max 5,000) | No |
| `campaign_type` | ENUM | `standard`, `referral`, `multi_action` | No |
| `cover_image_url` | TEXT | Campaign cover image URL | Yes |
| `prize_name` | TEXT | Prize name (max 200) | No |
| `prize_description` | TEXT | Prize description (max 2,000) | No |
| `prize_value` | BIGINT | Prize value in NGN (kobo) | No |
| `prize_quantity` | INTEGER | Prize quantity available | No |
| `prize_images` | TEXT[] | Array of prize image URLs (min 1) | No |
| `winner_count` | INTEGER | Number of winners | No |
| `shipping_required` | BOOLEAN | Whether physical shipping required | No |
| `start_date` | TIMESTAMPTZ | Campaign start time | No |
| `end_date` | TIMESTAMPTZ | Campaign end time | No |
| `timezone` | TEXT | IANA timezone identifier | No |
| `minimum_age` | INTEGER | Minimum participant age | No |
| `restricted_countries` | TEXT[] | ISO 3166-1 alpha-2 country codes | Yes |
| `terms_and_conditions` | TEXT | Campaign legal terms | No |
| `official_rules` | TEXT | Auto-generated official rules | No |
| `privacy_policy_url` | TEXT | Privacy policy URL | No |
| `auto_draw_winners` | BOOLEAN | Auto-select winners on end date | No |
| `response_deadline_days` | INTEGER | Days for winner to claim (default 7) | No |
| `status` | ENUM | `draft`, `scheduled`, `active`, `paused`, `ended`, `cancelled` | No |
| `branding` | JSONB | Custom branding configuration | Yes |
| `target_metrics` | JSONB | Target metrics configuration | Yes |
| `published_at` | TIMESTAMPTZ | Publication timestamp | Yes |
| `created_by` | UUID | FK to users | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

```sql
CREATE INDEX idx_campaigns_organization_id ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(organization_id, status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE UNIQUE INDEX idx_campaigns_org_slug ON campaigns(organization_id, slug);
```

### 7.2 Entity: Campaign Entry Methods

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `campaign_id` | UUID | FK to campaigns | No |
| `method_type` | ENUM | `follow`, `like`, `comment`, `share`, `tag_friends`, `visit_website`, `email_subscribe`, `refer_friend`, `custom` | No |
| `method_config` | JSONB | Method-specific configuration (URL, platform, keyword, etc.) | No |
| `points` | INTEGER | Points awarded (1–50) | No |
| `is_required` | BOOLEAN | Whether this action is mandatory for entry | No |
| `display_order` | INTEGER | Display order in entry form | No |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |

```sql
CREATE INDEX idx_entry_methods_campaign ON campaign_entry_methods(campaign_id, display_order);
```

### 7.3 Entity: Campaign Entry

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `campaign_id` | UUID | FK to campaigns | No |
| `email` | TEXT | Participant email (max 255) | No |
| `full_name` | TEXT | Participant full name (max 100) | No |
| `date_of_birth` | DATE | Participant date of birth | Yes |
| `phone` | TEXT | E.164 phone number | Yes |
| `country` | TEXT | ISO 3166-1 alpha-2 country code | Yes |
| `custom_fields` | JSONB | Custom form field responses | Yes |
| `status` | ENUM | `pending`, `verified`, `partial`, `failed`, `disqualified`, `winner`, `duplicate` | No |
| `points_earned` | INTEGER | Total points from all verified actions | No |
| `referrer_entry_id` | UUID | FK to referring entry (self-referencing) | Yes |
| `referral_code` | TEXT | This entry's unique referral code | Yes |
| `ip_address` | INET | Submitting IP address | Yes |
| `user_agent` | TEXT | Browser user agent string | Yes |
| `device_fingerprint` | TEXT | Device fingerprint hash | Yes |
| `recaptcha_score` | DECIMAL(3,2) | reCAPTCHA v3 score (0.0–1.0) | Yes |
| `fraud_score` | DECIMAL(3,2) | Internal fraud risk score (0.0–1.0) | Yes |
| `is_winner` | BOOLEAN | Whether selected as winner | No |
| `winner_selected_at` | TIMESTAMPTZ | Winner selection timestamp | Yes |
| `prize_claimed` | BOOLEAN | Whether prize was claimed | No |
| `prize_claimed_at` | TIMESTAMPTZ | Prize claim timestamp | Yes |
| `created_at` | TIMESTAMPTZ | Entry submission timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

```sql
CREATE INDEX idx_entries_campaign ON campaign_entries(campaign_id, created_at DESC);
CREATE INDEX idx_entries_status ON campaign_entries(campaign_id, status);
CREATE INDEX idx_entries_email ON campaign_entries(email);
CREATE INDEX idx_entries_winner ON campaign_entries(campaign_id) WHERE is_winner = TRUE;
CREATE INDEX idx_entries_referrer ON campaign_entries(referrer_entry_id);
CREATE UNIQUE INDEX idx_entries_email_campaign ON campaign_entries(campaign_id, email);
```

### 7.4 Entity: Entry Action

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `entry_id` | UUID | FK to campaign entries | No |
| `method_type` | TEXT | Entry method type | No |
| `verification_status` | ENUM | `pending`, `verified`, `failed` | No |
| `platform_user_id` | TEXT | Platform-specific user identifier | Yes |
| `verification_data` | JSONB | Verification response data from platform API | Yes |
| `points_awarded` | INTEGER | Points awarded for this action | No |
| `verified_at` | TIMESTAMPTZ | Verification completion timestamp | Yes |
| `failure_reason` | TEXT | Reason if verification failed | Yes |
| `created_at` | TIMESTAMPTZ | Action submission timestamp | No |

```sql
CREATE INDEX idx_entry_actions_entry ON campaign_entry_actions(entry_id);
CREATE INDEX idx_entry_actions_status ON campaign_entry_actions(verification_status);
```

### 7.5 Entity: Winner

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `campaign_id` | UUID | FK to campaigns | No |
| `entry_id` | UUID | FK to campaign entries | No |
| `tier` | TEXT | Winner tier: `grand_prize`, `runner_up_1`, `consolation` | No |
| `selected_at` | TIMESTAMPTZ | Selection timestamp | No |
| `selection_proof` | TEXT | SHA-256 cryptographic proof of selection | No |
| `selection_method` | TEXT | Method used for selection | No |
| `notified_at` | TIMESTAMPTZ | Notification timestamp | Yes |
| `response_deadline` | TIMESTAMPTZ | Claim deadline timestamp | No |
| `responded_at` | TIMESTAMPTZ | Winner response timestamp | Yes |
| `accepted` | BOOLEAN | Whether winner accepted the prize | Yes |
| `decline_reason` | TEXT | Reason if winner declined | Yes |
| `shipping_address` | JSONB | Validated shipping address | Yes |
| `tax_form_url` | TEXT | Signed tax form document URL | Yes |
| `affidavit_url` | TEXT | Signed affidavit URL | Yes |
| `tracking_number` | TEXT | Shipping carrier tracking number | Yes |
| `carrier` | TEXT | Shipping carrier name | Yes |
| `shipped_at` | TIMESTAMPTZ | Shipment timestamp | Yes |
| `delivered_at` | TIMESTAMPTZ | Delivery confirmation timestamp | Yes |
| `prize_value` | BIGINT | Prize value in NGN at time of selection | No |
| `status` | ENUM | `pending`, `notified`, `accepted`, `shipped`, `delivered`, `forfeited`, `expired` | No |

```sql
CREATE INDEX idx_winners_campaign ON winners(campaign_id);
CREATE INDEX idx_winners_status ON winners(status, response_deadline);
CREATE INDEX idx_winners_entry ON winners(entry_id);
```

### 7.6 Entity: Campaign Template

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | UUID | Primary key | No |
| `organization_id` | UUID | FK to organizations (null = system template) | Yes |
| `name` | TEXT | Template name (max 100) | No |
| `category` | TEXT | Template category | No |
| `industry` | TEXT | Target industry | Yes |
| `description` | TEXT | Template description | Yes |
| `template_config` | JSONB | Full campaign configuration preset | No |
| `success_metrics` | JSONB | Historical performance benchmarks | Yes |
| `usage_count` | INTEGER | Number of times applied | No |
| `average_conversion_rate` | DECIMAL(5,4) | Average conversion rate from usage | Yes |
| `is_public` | BOOLEAN | Accessible to all organizations | No |
| `is_premium` | BOOLEAN | Premium plan required | No |
| `created_by` | UUID | FK to users | Yes |
| `created_at` | TIMESTAMPTZ | Creation timestamp | No |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | No |

```sql
CREATE INDEX idx_templates_category ON campaign_templates(category, industry);
CREATE INDEX idx_templates_org ON campaign_templates(organization_id);
CREATE INDEX idx_templates_public ON campaign_templates(is_public) WHERE is_public = TRUE;
```

---

## 8. API Surface

### 8.1 Endpoint: Create Campaign

```
POST /api/v1/growth/campaigns
```

**Authorization:** `growth:campaigns:create`

**Request:**

```json
{
  "name": "Black Friday Giveaway 2026",
  "title": "Win a Brand New iPhone 16 Pro!",
  "description": "Enter for a chance to win the latest iPhone...",
  "type": "multi_action",
  "prize": {
    "name": "iPhone 16 Pro 256GB",
    "description": "The latest iPhone with Pro camera system and titanium design.",
    "value": 1800000,
    "currency": "NGN",
    "quantity": 1,
    "images": ["https://storage.nawebeus.com/prizes/iphone16pro.jpg"],
    "shippingRequired": true
  },
  "duration": {
    "startDate": "2026-11-25T00:00:00.000Z",
    "endDate": "2026-12-02T23:59:59.000Z",
    "timezone": "Africa/Lagos"
  },
  "entryMethods": [
    { "type": "follow", "points": 5, "config": { "platform": "instagram", "handle": "@brand" } },
    { "type": "like", "points": 3, "config": { "postUrl": "https://instagram.com/p/abc123" } },
    { "type": "comment", "points": 5, "config": { "postUrl": "https://instagram.com/p/abc123" } },
    { "type": "tag_friends", "points": 5, "config": { "count": 2 } },
    { "type": "email_subscribe", "points": 10, "config": { "doubleOptIn": true } }
  ],
  "legal": {
    "minimumAge": 18,
    "restrictedCountries": [],
    "termsAndConditions": "...",
    "privacyPolicyUrl": "https://brand.com/privacy"
  },
  "settings": {
    "winnerCount": 1,
    "runnerUpCount": 3,
    "autoDrawWinners": true,
    "responseDeadlineDays": 7
  }
}
```

**Response — 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "camp_9f2a4b1c3d5e6f7a",
    "slug": "black-friday-giveaway-2026",
    "url": "https://nawebeus.com/g/brand-corp/black-friday-giveaway-2026",
    "status": "draft",
    "createdAt": "2026-07-22T10:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-07-22T10:00:00.000Z",
    "requestId": "req_7e3b5c2a"
  }
}
```

**Error Responses:**

| HTTP Status | Error Code | Scenario |
|-------------|------------|----------|
| 400 | `CAMPAIGN_VALIDATION_ERROR` | Missing required fields or invalid configuration |
| 400 | `CAMPAIGN_DURATION_INVALID` | Duration outside 1–90 day range |
| 403 | `PERMISSION_DENIED` | User lacks `growth:campaigns:create` |
| 422 | `LEGAL_DOCS_INCOMPLETE` | Terms or privacy policy missing |

---

### 8.2 Endpoint: Submit Entry (Public)

```
POST /api/v1/growth/entries
```

**Authorization:** Public (participant-facing)

**Request:**

```json
{
  "campaignId": "camp_9f2a4b1c3d5e6f7a",
  "email": "participant@example.com",
  "fullName": "Adaeze Okonkwo",
  "dateOfBirth": "1995-03-15",
  "country": "NG",
  "recaptchaToken": "03AGdBq25...",
  "referralCode": "ref_abc123",
  "customFields": {}
}
```

**Response — 201 Created:**

```json
{
  "success": true,
  "data": {
    "entryId": "entry_4b5c6d7e8f9a",
    "status": "pending",
    "pointsEarned": 0,
    "referralCode": "ref_xyz789",
    "actionsToComplete": [
      { "type": "follow", "points": 5, "status": "pending", "verifyUrl": "..." },
      { "type": "like", "points": 3, "status": "pending", "verifyUrl": "..." },
      { "type": "email_subscribe", "points": 10, "status": "pending", "verifyUrl": "..." }
    ],
    "confirmationEmailSent": true
  },
  "meta": {
    "timestamp": "2026-07-22T10:05:00.000Z",
    "requestId": "req_5e6f7a8b"
  }
}
```

**Error Responses:**

| HTTP Status | Error Code | Scenario |
|-------------|------------|----------|
| 400 | `CAMPAIGN_NOT_ACTIVE` | Campaign is not currently accepting entries |
| 400 | `RECAPTCHA_FAILED` | reCAPTCHA score below threshold |
| 403 | `GEO_RESTRICTION` | Entry not available from participant's country |
| 403 | `AGE_RESTRICTION` | Participant does not meet minimum age |
| 403 | `FRAUD_DETECTED` | Entry blocked by fraud detection |
| 409 | `ENTRY_DUPLICATE` | Email already submitted for this campaign |

---

### 8.3 Endpoint: Select Winners

```
POST /api/v1/growth/campaigns/{campaign_id}/winners/select
```

**Authorization:** `growth:winners:select`

**Request:**

```json
{
  "selectionMethod": "simple_random",
  "numberOfWinners": 1,
  "numberOfRunnerUps": 3,
  "responseDeadlineDays": 7
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "winners": [
      {
        "id": "win_1a2b3c4d5e6f",
        "entryId": "entry_4b5c6d7e8f9a",
        "name": "Adaeze Okonkwo",
        "email": "adaeze@example.com",
        "tier": "grand_prize",
        "pointsEarned": 28,
        "selectedAt": "2026-12-02T23:59:59.000Z",
        "responseDeadline": "2026-12-09T23:59:59.000Z",
        "status": "notified"
      }
    ],
    "runnerUps": [
      {
        "id": "win_2b3c4d5e6f7a",
        "tier": "runner_up_1",
        "status": "notified"
      }
    ],
    "selectionProof": "sha256:a1b2c3d4e5f6789abcdef...",
    "selectionMethod": "simple_random",
    "eligibleEntryCount": 2180,
    "notificationsSent": 4
  },
  "meta": {
    "timestamp": "2026-12-02T23:59:59.000Z",
    "requestId": "req_9c0d1e2f"
  }
}
```

---

### 8.4 Endpoint: Get Campaign Analytics

```
GET /api/v1/growth/campaigns/{campaign_id}/analytics
```

**Authorization:** `growth:analytics:read`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | DATE | No | Analytics start date |
| `end_date` | DATE | No | Analytics end date |
| `group_by` | STRING | No | `day`, `week` (default: `day`) |

**Response — 200 OK:**

```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "camp_9f2a4b1c3d5e6f7a",
      "title": "Win a Brand New iPhone 16 Pro!",
      "status": "active",
      "daysRemaining": 7
    },
    "overview": {
      "totalEntries": 5420,
      "verifiedEntries": 5180,
      "pendingEntries": 240,
      "conversionRate": 0.342,
      "socialShares": 1250,
      "referrals": 380,
      "newFollowers": 4200,
      "emailSubscribers": 3800,
      "estimatedReach": 125000
    },
    "entryBreakdown": [
      { "type": "follow", "count": 5180, "percentage": 100.0 },
      { "type": "like", "count": 5020, "percentage": 96.9 },
      { "type": "comment", "count": 3980, "percentage": 76.8 },
      { "type": "tag_friends", "count": 3050, "percentage": 58.9 },
      { "type": "email_subscribe", "count": 3800, "percentage": 73.4 }
    ],
    "funnel": {
      "campaignViews": 15840,
      "entryStarted": 7100,
      "entrySubmitted": 5620,
      "socialVerified": 5180,
      "completedEntry": 5180,
      "conversionRate": 0.327
    },
    "demographics": {
      "topCountries": [
        { "country": "NG", "count": 3800, "percentage": 73.4 },
        { "country": "GH", "count": 780, "percentage": 15.1 },
        { "country": "KE", "count": 400, "percentage": 7.7 }
      ],
      "ageGroups": [
        { "range": "18-24", "count": 2100, "percentage": 40.5 },
        { "range": "25-34", "count": 1980, "percentage": 38.2 },
        { "range": "35-44", "count": 720, "percentage": 13.9 }
      ]
    },
    "roi": {
      "currency": "NGN",
      "totalCost": 1800000,
      "costPerEntry": 347.51,
      "costPerLead": 473.68,
      "estimatedAudienceValue": 12600000,
      "roi": 7.0
    },
    "trend": [
      { "date": "2026-11-25", "entries": 890, "reach": 18000 },
      { "date": "2026-11-26", "entries": 1120, "reach": 22400 }
    ],
    "meta": {
      "lastUpdated": "2026-07-22T10:25:00.000Z",
      "currency": "NGN"
    }
  }
}
```

---

## 9. User Interface

### 9.1 Screen: Campaign Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🏆 Growth & Giveaways                           [+ New Campaign]   │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Active       │ Total        │ Conversion   │ Total Reach            │
│ Campaigns    │ Entries/Mo   │ Rate         │ This Month             │
│ 5            │ 12,450      │ 3.2% ▲      │ 245,000 ▲             │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│ Campaigns                              [Filter: All ▼] [Sort: ▼]   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🏆 Summer Giveaway 2026               Status: ✅ Active      │   │
│ │ Type: Multi-Action  │  Platform: Instagram                   │   │
│ │ Entries: 2,450  │  Target: 3,000  │  📊 82% to target       │   │
│ │ ⏰ 15 days remaining                                          │   │
│ │ [View]  [Manage Entries]  [Analytics]  [Pause]              │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 📱 Product Launch Giveaway            Status: ✅ Active      │   │
│ │ Type: Referral  │  Platform: Instagram, Facebook             │   │
│ │ Entries: 1,280  │  Target: 2,000  │  📊 64% to target       │   │
│ │ ⏰ 8 days remaining                                           │   │
│ │ [View]  [Manage Entries]  [Analytics]  [Pause]              │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 📝 Brand Awareness Q3                 Status: ⏳ Draft       │   │
│ │ Type: Standard  │  Platform: X (Twitter)                    │   │
│ │ Entries: 0  │  Starts: 2026-08-01                           │   │
│ │ [Edit]  [Preview]  [Publish]                                │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Screen: Create Campaign

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← New Campaign                              [Save Draft]  [Preview] │
├─────────────────────────────────────────────────────────────────────┤
│ [Campaign Details] [Prize] [Entry Methods] [Legal] [Distribution]  │
├─────────────────────────────────────────────────────────────────────┤
│ Campaign Details                                                    │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Campaign Name (internal):  [Black Friday Giveaway 2026      ] │   │
│ │ Public Title:              [Win a Brand New iPhone 16 Pro!  ] │   │
│ │ Campaign Type:             [Multi-Action ▼]                  │   │
│ │ Platforms:  [✅ Instagram] [✅ Facebook] [❌ X] [❌ TikTok] │   │
│ │                                                               │   │
│ │ Start Date: [2026-11-25]   End Date: [2026-12-02]            │   │
│ │ Timezone:   [Africa/Lagos ▼]   Duration: 7 days              │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ Prize Details                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Prize Name:        [iPhone 16 Pro 256GB                     ] │   │
│ │ Prize Value (NGN): [₦1,800,000                              ] │   │
│ │ ⚠️  Prizes ≥ ₦1,200,000 require tax documentation from winners│   │
│ │ # of Winners:      [1      ]   Runner-ups: [3      ]        │   │
│ │ Shipping Required: [✅ Yes]                                  │   │
│ │ Prize Image: [📷 Upload Image]                              │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ Entry Requirements                                                  │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [✅] Follow @brand on Instagram           → 5 points        │   │
│ │ [✅] Like the announcement post           → 3 points        │   │
│ │ [✅] Comment on the post                  → 5 points        │   │
│ │ [✅] Tag 2 friends in comments            → 5 points        │   │
│ │ [✅] Subscribe to email list              → 10 points       │   │
│ │ [❌] Share post (bonus entries)           → — points        │   │
│ │                                                               │   │
│ │ Max entries per person: [25]  Total possible: 28 points     │   │
│ │ [+ Add Entry Method]                                         │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                              [Save Draft]  [Preview]  [Publish →]   │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 Screen: Campaign Analytics

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Analytics: Black Friday Giveaway 2026    [Last 7 Days ▼][Export]│
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Total Entries│ Verified     │ Conversion   │ Estimated Reach        │
│ 5,420        │ 5,180 (95%) │ Rate: 34.2%  │ 125,000               │
│ ▲ +12%       │             │ ▲ +4.1%      │ ▲ +18%                │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│ Entry Trend — Last 7 Days                                           │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │  [Line Chart — Daily entries with reach overlay]             │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ Entry Method Breakdown           │ Conversion Funnel               │
│ ┌────────────────────────────┐   │ ┌──────────────────────────────┐ │
│ │ Follow       5,180 (100%) │   │ │ Campaign Views:   15,840     │ │
│ │ Like         5,020  (97%) │   │ │ Entry Started:     7,100 45% │ │
│ │ Email        3,800  (73%) │   │ │ Submitted:         5,620 79% │ │
│ │ Comment      3,980  (77%) │   │ │ Verified:          5,180 92% │ │
│ │ Tag Friends  3,050  (59%) │   │ │ Conversion:            32.7% │ │
│ └────────────────────────────┘   │ └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ Cost Analysis                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Prize Cost:          ₦1,800,000                              │   │
│ │ Cost Per Entry:      ₦347.51                                 │   │
│ │ Cost Per Lead:       ₦473.68                                 │   │
│ │ Estimated Audience Value: ₦12,600,000                        │   │
│ │ Campaign ROI:        7.0×  ▲                                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Screen: Winner Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🏆 Select Winners: Black Friday Giveaway 2026                      │
├─────────────────────────────────────────────────────────────────────┤
│ Campaign Summary                                                    │
│ Verified Entries: 5,180  │  Winners to Select: 1  │  Runner-ups: 3 │
├─────────────────────────────────────────────────────────────────────┤
│ Selection Configuration                                             │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Method:          [Random (Equal Probability) ▼]              │   │
│ │ # of Winners:    [1         ]                                │   │
│ │ # of Runner-ups: [3         ]                                │   │
│ │ Response Deadline: [7 days ▼]                               │   │
│ │                                                               │   │
│ │ ℹ️  Selection uses cryptographically secure randomness.      │   │
│ │    A SHA-256 audit proof will be generated.                  │   │
│ │                                                               │   │
│ │                   [Select Winners Now]                       │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ Selected Winners                                                    │
│ ┌────┬────────────────┬───────────┬────────────┬──────────────────┐ │
│ │  # │ Participant    │ Points    │ Status     │ Actions          │ │
│ ├────┼────────────────┼───────────┼────────────┼──────────────────┤ │
│ │  1 │ @adaeze_ok     │ 28 pts   │ ✅ Notified│ [View] [Contact] │ │
│ │ R1 │ @tunde_fashola │ 25 pts   │ ⏳ Notified│ [View] [Contact] │ │
│ │ R2 │ @ngozi_ada     │ 23 pts   │ ⏳ Notified│ [View] [Contact] │ │
│ └────┴────────────────┴───────────┴────────────┴──────────────────┘ │
│ Audit Proof: sha256:a1b2c3d4e5f6789abcdef...    [Download Proof]   │
│                                                                     │
│ [Notify All Winners]  [Publish Announcement]                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.5 Screen: Entry Management

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📋 Entries: Black Friday Giveaway 2026          [Export CSV]        │
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 [Search by name, email, ID...]                                   │
│ [Status: All ▼] [Country: All ▼] [Date: All ▼] [Method: All ▼]    │
├─────────────────────────────────────────────────────────────────────┤
│ 5,180 verified entries  │  [Select All]  [Bulk Actions ▼]          │
├────────────────┬──────────────────┬──────────────┬────────────┬─────┤
│ Participant    │ Email            │ Points       │ Status     │ Act │
├────────────────┼──────────────────┼──────────────┼────────────┼─────┤
│ Adaeze Okonkwo │ adaeze@email.ng  │ 28 pts      │ ✅ Verified│ [▾] │
│ Tunde Fashola  │ tunde@corp.ng    │ 25 pts      │ ✅ Verified│ [▾] │
│ Ngozi Adeyemi  │ ngozi@brand.ng   │ 23 pts      │ ✅ Verified│ [▾] │
│ Chukwu Emeka   │ emeka@mail.ng    │ 10 pts      │ ⏳ Pending │ [▾] │
│ Fake User 001  │ fake@tempmail.io │ 0 pts       │ ❌ Fraud   │ [▾] │
└────────────────┴──────────────────┴──────────────┴────────────┴─────┘
│ Page 1 of 104  ← [1] [2] [3] ... [104] →                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Notifications

### 10.1 Notification: Entry Confirmed

| Field | Details |
|-------|---------|
| **Type** | Email |
| **Trigger** | Entry verified successfully |
| **Subject** | ✅ You're in! Your entry for [Campaign Name] is confirmed |
| **Body** | Hi [Name], your entry for [Campaign Name] is confirmed. Your referral link: [URL]. [Action count] completed. |
| **Action** | View Campaign |
| **Timing** | Within 60 seconds of verification |

### 10.2 Notification: Winner Selected

| Field | Details |
|-------|---------|
| **Type** | Email, In-app, Push |
| **Trigger** | Winner confirmed after selection |
| **Subject** | 🏆 Congratulations! You've won [Campaign Name]! |
| **Body** | Hi [Name], you've been selected as the winner of [Campaign Name]. Your prize: [Prize Description] (₦[Value]). Claim by [Deadline]. |
| **Action** | Claim Prize |
| **Timing** | Within 5 minutes of winner selection |

### 10.3 Notification: Winner Reminder

| Field | Details |
|-------|---------|
| **Type** | Email |
| **Trigger** | 3 days and 1 day before claim deadline |
| **Subject** | ⏰ Last chance to claim your prize — [Days] days remaining |
| **Body** | Hi [Name], you have [X] days left to claim your prize for [Campaign Name]. Don't let it expire. |
| **Action** | Claim Now |

### 10.4 Notification: Campaign Milestone

| Field | Details |
|-------|---------|
| **Type** | In-app, Email |
| **Trigger** | Campaign reaches 1,000 / 5,000 / 10,000 entries |
| **Title** | 🎉 [Campaign Name] reached [X] entries! |
| **Body** | Your campaign is performing great! [X] people have entered so far. Track performance in your analytics dashboard. |
| **Action** | View Analytics |

### 10.5 Notification: Campaign Ending Soon

| Field | Details |
|-------|---------|
| **Type** | In-app, Email |
| **Trigger** | 24 hours before campaign end date |
| **Title** | ⏰ [Campaign Name] ends in 24 hours |
| **Body** | [Campaign Name] closes tomorrow. Winners will be selected automatically when the campaign ends. |
| **Action** | View Campaign |

### 10.6 Notification: Prize Shipped

| Field | Details |
|-------|---------|
| **Type** | Email |
| **Trigger** | Tracking number added by Admin |
| **Subject** | 📦 Your prize is on its way! [Campaign Name] |
| **Body** | Hi [Name], your prize has been shipped! Tracking: [Carrier] [Number]. Estimated delivery: [Date]. |
| **Action** | Track Package |

---

## 11. Error Handling

### 11.1 Error Reference Table

| Error Code | HTTP Status | Description | User Message | Resolution |
|------------|-------------|-------------|--------------|------------|
| `CAMPAIGN_NOT_FOUND` | 404 | Campaign does not exist | Campaign not found. | Check the campaign ID |
| `CAMPAIGN_NOT_ACTIVE` | 400 | Campaign is not accepting entries | This campaign is not currently active. | Wait for campaign to start or check campaign status |
| `CAMPAIGN_ENDED` | 400 | Campaign has passed its end date | This campaign has ended. | No action available |
| `CAMPAIGN_DURATION_INVALID` | 400 | Duration outside 1–90 day limit | Campaign duration must be between 1 and 90 days. | Adjust start or end date |
| `CAMPAIGN_VALIDATION_ERROR` | 400 | Missing or invalid configuration | [Field]: [error detail]. | Correct the specified field |
| `LEGAL_DOCS_INCOMPLETE` | 422 | Terms or privacy policy missing | Campaign cannot be published — legal documentation is incomplete. | Complete all legal fields |
| `ENTRY_DUPLICATE` | 409 | Email already entered this campaign | You have already entered this campaign. | Only one entry per email allowed |
| `ENTRY_LIMIT_EXCEEDED` | 429 | Participant hit per-campaign entry cap | You have reached the maximum number of entries for this campaign. | No additional entries permitted |
| `ENTRY_VERIFICATION_FAILED` | 400 | Social action could not be verified | We couldn't verify your [action] on [platform]. Please try again. | Retry after completing the action |
| `GEO_RESTRICTION` | 403 | Participant's country is restricted | This campaign is not available in your country. | No action available |
| `AGE_RESTRICTION` | 403 | Participant is below minimum age | You must be [X]+ years old to enter this campaign. | No action available |
| `RECAPTCHA_FAILED` | 400 | reCAPTCHA score below threshold | Security verification failed. Please try again. | Retry submission |
| `FRAUD_DETECTED` | 403 | Entry blocked by fraud detection | Your entry has been flagged. Please contact support. | Contact support |
| `INSUFFICIENT_ENTRIES` | 400 | Not enough verified entries to select winners | There are not enough verified entries to select [X] winners. | Wait for more entries |
| `INVALID_SELECTION_METHOD` | 400 | Invalid winner selection method provided | Invalid selection method. | Use a supported method |
| `WINNER_NOT_FOUND` | 404 | Winner ID does not exist | Winner not found. | Check the winner ID |
| `RESPONSE_DEADLINE_PASSED` | 400 | Winner claim deadline has expired | The claim deadline for this prize has passed. | Runner-up has been promoted |
| `TAX_FORM_REQUIRED` | 400 | Prize value requires tax documentation | Tax documentation is required for prizes valued at ₦1,200,000 or above. | Complete tax form to proceed |
| `FILE_TYPE_INVALID` | 400 | Uploaded file is not JPG or PNG | Only JPG and PNG images are accepted. | Upload a supported format |
| `FILE_TOO_LARGE` | 400 | File exceeds 5MB limit | File size cannot exceed 5MB. | Compress and re-upload |

---

## 12. Acceptance Criteria

### 12.1 Campaign Creation

| ID | Criteria | Target |
|----|----------|--------|
| **AC-GRW-001** | Campaign created and published end-to-end | <30 minutes total setup time |
| **AC-GRW-002** | Campaign draft auto-saves without user action | Every 30 seconds |
| **AC-GRW-003** | Legal compliance warnings surface before publish | 100% of known compliance issues flagged |
| **AC-GRW-004** | Campaign cannot publish with incomplete legal docs | 100% enforcement |
| **AC-GRW-005** | Cover image auto-resized for platform optimization | 1200×630px; <5MB |

### 12.2 Entry Collection & Fraud Prevention

| ID | Criteria | Target |
|----|----------|--------|
| **AC-GRW-006** | Entry form submits and receives response | <3 seconds |
| **AC-GRW-007** | Social actions verified automatically | Within 30 seconds for ≥95% of cases |
| **AC-GRW-008** | Bot entries blocked by reCAPTCHA | ≥99% bot block rate |
| **AC-GRW-009** | Duplicate entries prevented | ≥99% accuracy |
| **AC-GRW-010** | Geographic restrictions enforced via IP | ≥99% enforcement accuracy |
| **AC-GRW-011** | Confirmation email delivered | Within 60 seconds of verification |
| **AC-GRW-012** | Real-time entry counter visible to entrant | Updates within 5 seconds |

### 12.3 Entry Management

| ID | Criteria | Target |
|----|----------|--------|
| **AC-GRW-013** | Entry table loads with 50,000+ entries | <3 seconds |
| **AC-GRW-014** | Advanced filter returns results | <500ms |
| **AC-GRW-015** | Bulk operations on 1,000 entries | <30 seconds |
| **AC-GRW-016** | CSV export of 10,000 entries | <30 seconds |

### 12.4 Winner Selection

| ID | Criteria | Target |
|----|----------|--------|
| **AC-GRW-017** | Winner selection from 100,000+ entries | <10 seconds |
| **AC-GRW-018** | Cryptographic audit proof generated | On every selection |
| **AC-GRW-019** | Winner notification delivered | Within 5 minutes of selection |
| **AC-GRW-020** | Runner-up auto-promoted on deadline expiry | Within 15 minutes of deadline |
| **AC-GRW-021** | Tax form triggered for prizes ≥ ₦1,200,000 | 100% enforcement |

### 12.5 Analytics & Reporting

| ID | Criteria | Target |
|----|----------|--------|
| **AC-GRW-022** | Analytics dashboard loads | <3 seconds |
| **AC-GRW-023** | Dashboard metrics refresh | Within 30 seconds |
| **AC-GRW-024** | ROI calculation includes all cost inputs | Accurate to ±1% |
| **AC-GRW-025** | Funnel shows conversion at each stage | All stages visible |
| **AC-GRW-026** | Data export completes | Within 30 seconds |

---

## 13. Edge Cases

### 13.1 Campaign Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-GRW-001** | User tries to publish campaign without legal terms | Blocked with `LEGAL_DOCS_INCOMPLETE` error; specific missing fields listed |
| **EC-GRW-002** | Campaign end date set in the past | Blocked with validation error at save time |
| **EC-GRW-003** | Prize value ≥ ₦100,000,000 | Blocked until Admin manually approves; notification sent to Admin |
| **EC-GRW-004** | User tries to delete an active campaign | Blocked; must pause campaign first before deletion is available |
| **EC-GRW-005** | Campaign goes viral and exceeds platform API rate limits | Social verification queue managed with exponential backoff; entries remain in pending state until verified |
| **EC-GRW-006** | User edits campaign after publishing | Only permitted for non-material fields (description, cover image); entry requirements and legal terms locked |

### 13.2 Entry Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-GRW-007** | Same email submits entry twice | Second entry returns `ENTRY_DUPLICATE` error; first entry unchanged |
| **EC-GRW-008** | Participant from restricted country uses VPN | IP geolocation detects VPN/proxy; entry blocked with `GEO_RESTRICTION`; flagged for review |
| **EC-GRW-009** | Social action verification returns timeout | Entry marked `partial`; queued for retry; admin notified after 3 failed retries |
| **EC-GRW-010** | Disposable email address detected | Entry blocked at form submission with email validation error |
| **EC-GRW-011** | Referral ring detected (circular referrals) | All entries in the ring flagged as fraudulent; Admin notified for review |
| **EC-GRW-012** | reCAPTCHA score is borderline (0.4–0.5) | Entry flagged for manual review rather than auto-block |

### 13.3 Winner Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-GRW-013** | Campaign ends with zero verified entries | Admin notified; winner selection blocked; suggested actions provided |
| **EC-GRW-014** | Winner doesn't respond within deadline | Automated reminders sent at 3 days and 1 day; runner-up promoted at deadline; Admin notified |
| **EC-GRW-015** | Winner declines prize | Decline reason recorded; next runner-up promoted immediately; Admin notified |
| **EC-GRW-016** | Winner shipping address is invalid | Admin notified; 48-hour window to provide corrected address before runner-up is promoted |
| **EC-GRW-017** | All runner-ups also decline or are unreachable | Admin notified to decide: re-draw from entry pool or close campaign without awarding |
| **EC-GRW-018** | Winner is under investigation for fraud | Prize held; Admin notified; eligibility re-verified before fulfillment |

### 13.4 Fulfillment Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| **EC-GRW-019** | Shipping carrier API is down | Retry with exponential backoff; manual tracking entry fallback available |
| **EC-GRW-020** | International shipping restricted to winner's country | Admin notified; winner offered digital alternative or prize value equivalent |
| **EC-GRW-021** | Digital prize delivery link expires before redemption | New link generated on winner request; Admin can regenerate up to 3 times |
| **EC-GRW-022** | Prize value declared incorrectly (below actual ARV) | Admin can correct; updated value triggers re-evaluation of tax thresholds |

---

## 14. Non-Functional Requirements

### 14.1 Performance

| Metric | Target |
|--------|--------|
| Campaign page load | <2 seconds |
| Entry form submission | <3 seconds |
| Analytics dashboard load | <3 seconds |
| Bulk operations (1,000 entries) | <30 seconds |
| Winner selection (100,000+ entries) | <10 seconds |
| Database support | 1,000,000+ entries per campaign |

### 14.2 Scalability

| Dimension | Target |
|-----------|--------|
| Concurrent active campaigns | 1,000+ per organization |
| Simultaneous entry submissions | 10,000+ per minute |
| Geographic distribution | Global CDN support |
| Entry table virtual scrolling | 100,000+ entries without performance degradation |

### 14.3 Security & Compliance

| Requirement | Detail |
|-------------|--------|
| Data encryption | AES-256 at rest; TLS 1.3 in transit |
| Fraud prevention | Multi-layer: reCAPTCHA, IP analysis, device fingerprinting, velocity checks |
| Privacy | GDPR, CCPA, NDPR, COPPA (under-13 blocked) compliant |
| Audit logging | Complete immutable trail of all campaign, entry, and winner actions |
| PII protection | Encrypted storage with role-based access controls |
| Tax compliance | Automated documentation trigger for prizes ≥ ₦1,200,000 |

### 14.4 Reliability

| Metric | Target |
|--------|--------|
| Campaign entry system uptime | 99.9% |
| Winner selection ACID compliance | Full ACID transactions |
| Backup RPO | 15-minute real-time replication |
| Disaster recovery RTO | 4 hours for critical systems |

---

## 15. Future Enhancements

| ID | Enhancement | Description | Priority | Timeline |
|----|-------------|-------------|----------|----------|
| **FE-GRW-001** | AI-powered campaign optimization | ML-based prize, timing, and entry method recommendations | Medium | Year 2 Q1 |
| **FE-GRW-002** | Automated A/B testing | Compare widget variations with statistical significance | Medium | Year 2 Q2 |
| **FE-GRW-003** | UGC gallery and showcase | User-generated content display with voting | Medium | Year 2 Q2 |
| **FE-GRW-004** | Influencer collaboration campaigns | Co-branded campaigns with influencer marketplace integration | High | Month 9 |
| **FE-GRW-005** | Advanced audience targeting | Demographic and behavioral targeting for entry requirements | Medium | Year 2 Q3 |
| **FE-GRW-006** | Multi-language campaign templates | Localized templates for key markets | Medium | Year 2 Q4 |
| **FE-GRW-007** | WhatsApp entry method | Entry via WhatsApp message for Nigerian market | High | Year 2 Q1 |
| **FE-GRW-008** | Template marketplace | Third-party and expert-created template library | Low | Year 3 |
| **FE-GRW-009** | Cryptocurrency prize support | Digital asset prize delivery | Low | Deferred |

---

## 16. Integration Requirements

### 16.1 Social Platform Integration

| Platform | Integration Purpose |
|----------|---------------------|
| Instagram | Follow, like, comment, tag verification via Instagram Graph API |
| Facebook | Like, share, comment verification via Facebook Graph API |
| X (Twitter) | Follow, retweet, like verification via Twitter API v2 |
| TikTok | Follow, like, comment verification via TikTok API |
| LinkedIn | Follow, like verification via LinkedIn API |

### 16.2 Email & Communication

| Service | Purpose |
|---------|---------|
| Resend | Entry confirmations, winner notifications, fulfillment updates |
| Mailchimp / Klaviyo | Email subscriber sync for email_subscribe entry method |

### 16.3 Fraud Prevention

| Service | Purpose |
|---------|---------|
| Google reCAPTCHA v3 | Bot detection and scoring |
| MaxMind GeoIP2 | IP geolocation and VPN/proxy detection |

### 16.4 Prize Fulfillment

| Service | Purpose |
|---------|---------|
| USPS, FedEx, UPS, DHL APIs | Real-time shipping and tracking |
| HelloSign / DocuSign | Tax form and affidavit e-signature collection |

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **Giveaway** | A promotional contest where participants complete actions to win a prize |
| **Entry Requirement** | A specific action a participant must complete to earn entries |
| **Multi-Action Campaign** | A campaign type that awards entries for each of multiple independent actions |
| **Referral Bonus** | Additional entry points awarded for successfully referring another participant |
| **ARV** | Approximate Retail Value — the stated market value of the prize |
| **AMOE** | Alternate Means of Entry — a no-purchase method of entry required in many jurisdictions |
| **CSPRNG** | Cryptographically Secure Pseudo-Random Number Generator — used for fair winner selection |
| **Selection Proof** | SHA-256 hash generated for each winner draw providing a verifiable audit record |
| **NGN** | Nigerian Naira — the base currency for all prize values and financial calculations (symbol: ₦) |
| **Runner-Up** | A secondary winner who receives the prize if the primary winner forfeits or is disqualified |
| **Device Fingerprint** | A hash derived from browser, OS, screen, and user agent data used for duplicate detection |
| **UGC** | User-Generated Content — content created by participants as part of campaign entry |
| **GDPR** | General Data Protection Regulation — EU data privacy regulation governing participant data |
| **NDPR** | Nigeria Data Protection Regulation — Nigerian data privacy law governing participant data |

---

## 18. Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-22 | Engineering Lead | Initial Growth & Giveaways module specification — full campaign lifecycle, entry management, fraud prevention, winner selection, fulfillment, analytics, and compliance |

---

 