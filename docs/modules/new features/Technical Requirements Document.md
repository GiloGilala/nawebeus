# GILO BUSINESS: TECHNICAL REQUIREMENTS DOCUMENT (TRD)

## Complete Production-Ready Specification for Engineering Implementation

---

# 1. SYSTEM OVERVIEW

## 1.1 Architecture Principles

| Principle                  | Description                                               | Implementation                       |
| -------------------------- | --------------------------------------------------------- | ------------------------------------ |
| **Eventual Consistency**   | System tolerates short-term inconsistency for scalability | Event sourcing, async processing     |
| **Immutable Ledger**       | Financial records cannot be modified after creation       | Append-only transactions, audit logs |
| **Idempotency**            | All operations are safely repeatable                      | Idempotency keys, unique constraints |
| **Separation of Concerns** | Distinct bounded contexts                                 | Domain-driven design                 |
| **Fail Fast**              | Validate inputs early                                     | Request validation at API gateway    |
| **Graceful Degradation**   | Core voting works even if analytics fail                  | Feature flags, circuit breakers      |

## 1.2 Technology Stack

### Backend Core

| Component           | Technology          | Version  | Purpose                                 |
| ------------------- | ------------------- | -------- | --------------------------------------- |
| **Runtime**         | Node.js             | 20.x LTS | Application runtime                     |
| **Framework**       | Hono                | Latest   | API framework (TypeScript)              |
| **Database**        | PostgreSQL          | 16.x     | Primary data store                      |
| **Vector Database** | Pinecone / Weaviate | Latest   | AI embeddings, similarity search        |
| **Cache**           | Redis               | 7.x      | Session storage, rate limiting, caching |
| **Message Queue**   | RabbitMQ / AWS SQS  | Latest   | Async job processing                    |
| **Real-time**       | Socket.io           | Latest   | WebSocket connections for live updates  |
| **File Storage**    | AWS S3 / Cloudinary | Latest   | Media storage, CDN                      |

### Database Tools

| Tool                | Purpose                           |
| ------------------- | --------------------------------- |
| **Drizzle ORM**     | Type-safe database queries        |
| **Kysely**          | SQL query builder (fallback)      |
| **Migrations**      | Version-controlled schema changes |
| **Connection Pool** | PgBouncer for high throughput     |

### Infrastructure

| Tool               | Purpose                       |
| ------------------ | ----------------------------- |
| **Docker**         | Containerization              |
| **Kubernetes**     | Orchestration (AWS EKS / GKE) |
| **GitHub Actions** | CI/CD pipeline                |
| **AWS CloudFront** | CDN for static assets         |
| **Cloudflare**     | DDoS protection, DNS          |

### Monitoring & Observability

| Tool           | Purpose                                |
| -------------- | -------------------------------------- |
| **Datadog**    | APM, infrastructure monitoring         |
| **Sentry**     | Error tracking, performance monitoring |
| **ELK Stack**  | Centralized logging                    |
| **Prometheus** | Metrics collection                     |
| **Grafana**    | Dashboard visualization                |

### Security

| Tool       | Purpose                       |
| ---------- | ----------------------------- |
| **Auth0**  | Authentication, SSO           |
| **JWT**    | Stateless authentication      |
| **Helmet** | Security headers              |
| **CORS**   | Cross-origin resource sharing |

## 1.3 Performance Targets

| Metric                        | Target           | Measurement Method        |
| ----------------------------- | ---------------- | ------------------------- |
| **API P95 Latency**           | < 200ms          | Datadog APM               |
| **Real-time Update Latency**  | < 100ms          | Socket.io metrics         |
| **Vote Processing Rate**      | 10,000/sec       | Load testing              |
| **Concurrent Active Users**   | 100,000          | Horizontal scaling        |
| **Database Read Replicas**    | 3 (read scaling) | Replication configuration |
| **Cache Hit Rate**            | > 95%            | Redis metrics             |
| **Time to Interactive (Web)** | < 2s             | Lighthouse                |
| **First Contentful Paint**    | < 1s             | Lighthouse                |

---

# 2. BUSINESS RULES (Authoritative)

## 2.1 Core Principles

### 2.1.1 Platform Values

| Principle          | Description                           | Application                                      |
| ------------------ | ------------------------------------- | ------------------------------------------------ |
| **Fairness**       | Voting integrity is paramount         | 1 user = 1 vote (except explicit Gavel features) |
| **Transparency**   | Users understand how the system works | Clear display of paid vs. organic placement      |
| **Auditability**   | Every economic event is traceable     | Immutable ledger for all token/payment events    |
| **Security**       | Financial systems resist fraud        | Trust scores, rate limiting, behavioral analysis |
| **Sustainability** | Platform economics must balance       | Token rewards ≤ confirmed revenue                |

### 2.1.2 System-Wide Rules

| Rule ID | Rule                                                            | Rationale                                   |
| ------- | --------------------------------------------------------------- | ------------------------------------------- |
| SYS-001 | All timestamps are UTC                                          | Consistent time handling across geographies |
| SYS-002 | All economic operations must be idempotent                      | Prevent double-processing                   |
| SYS-003 | Every financial/moderator action must be audited                | Compliance and debugging                    |
| SYS-004 | Users must be email-verified to earn/spend tokens               | Basic identity verification                 |
| SYS-005 | Soft deletion for all core entities                             | Data integrity and auditability             |
| SYS-006 | All API endpoints require authentication (except public embeds) | Security                                    |
| SYS-007 | Rate limiting per user per endpoint                             | Prevent abuse                               |
| SYS-008 | All requests must be HTTPS                                      | Security                                    |
| SYS-009 | Database transactions for multi-table operations                | Data consistency                            |

---

## 2.2 Identity & Trust Rules

### 2.2.1 Trust Score Calculation

| Factor             | Weight | Description                                |
| ------------------ | ------ | ------------------------------------------ |
| Account Age        | 0-20   | 1 point per day (max 20)                   |
| Email Verified     | 0-10   | +10 if verified                            |
| Phone Verified     | 0-15   | +15 if verified                            |
| Payment History    | 0-20   | One successful payment = +5                |
| Voting Consistency | 0-15   | Pattern of genuine voting                  |
| Vote Diversity     | 0-10   | Votes across different categories/creators |
| Referral Quality   | 0-10   | Quality of referred users                  |
| Device Reputation  | -20-0  | Penalty for known fraud devices            |
| IP Reputation      | -20-0  | Penalty for known fraud IPs                |

### 2.2.2 Trust Score Tiers

| Tier         | Score  | Features                                     |
| ------------ | ------ | -------------------------------------------- |
| **Unknown**  | 0-19   | Can vote; rewards held in PENDING            |
| **Basic**    | 20-49  | Can earn/spend tokens; daily cap: 50 tokens  |
| **Verified** | 50-74  | Full earning/spending; daily cap: 100 tokens |
| **Trusted**  | 75-100 | Full features; priority support              |

### 2.2.3 Verification Requirements

| Verification Type | Method                              | Trust Impact | Required For                     |
| ----------------- | ----------------------------------- | ------------ | -------------------------------- |
| **Email**         | Verification link sent to email     | +10 trust    | Token earning, token spending    |
| **Phone**         | SMS verification code               | +15 trust    | Token purchase, payment          |
| **B2B**           | LinkedIn/company email verification | +20 trust    | B2B features, The Gavel          |
| **Government ID** | Document verification               | +25 trust    | High-value transactions (future) |

---

## 2.3 Monetization Rules

### 2.3.1 Tier Configuration

| Tier         | Price (USD) | Token Cost | Duration (seconds)  | Starting Position | Featured Badge | Pinned Duration (seconds) | Watermark |
| ------------ | ----------- | ---------- | ------------------- | ----------------- | -------------- | ------------------------- | --------- |
| **Bronze**   | $5.00       | 100        | 259,200 (3 days)    | Bottom            | No             | 0                         | Required  |
| **Silver**   | $15.00      | 300        | 432,000 (5 days)    | Middle            | No             | 0                         | Required  |
| **Gold**     | $35.00      | 700        | 604,800 (7 days)    | Top 25%           | Yes            | 43,200 (12h)              | Optional  |
| **Platinum** | $75.00      | 1,500      | 1,209,600 (14 days) | Top 5%            | Yes            | 172,800 (48h)             | Removable |

### 2.3.2 Token-to-Cash Exchange

| Rule ID | Rule                                                        |
| ------- | ----------------------------------------------------------- |
| MON-001 | Nominal exchange rate: **20 tokens = $1.00** (fixed)        |
| MON-002 | Promotional bonuses do not change the nominal exchange rate |
| MON-003 | Token packages have a nominal value and bonus tokens        |

### 2.3.3 Refund Eligibility Matrix

| Scenario                                | Refund         | Moderation Action                 | Notes                 |
| --------------------------------------- | -------------- | --------------------------------- | --------------------- |
| User violation (malicious/illegal)      | ❌ No refund   | Account suspension, permanent ban | Policy violation      |
| User violation (minor, first offense)   | ❌ No refund   | Content removal; warning          | Education             |
| Platform/system error                   | ✅ Full refund | Content restored                  | System failure        |
| Duplicate submission                    | ✅ Full refund | Duplicate removed                 | System prevented      |
| Technical error preventing submission   | ✅ Full refund | None                              | Payment not processed |
| User buys wrong tier (48h, no votes)    | ✅ Full refund | Purchase reversed                 | Consumer protection   |
| User buys wrong tier (after votes cast) | ❌ No refund   | None                              | Votes cast            |
| Submission flagged (false positive)     | ✅ Full refund | Appeal process                    | Moderation error      |
| Fraudulent payment                      | ❌ No refund   | Account suspension                | Fraud prevention      |

---

## 2.4 Voting Rules

### 2.4.1 Vote Weight Rules

| Rule ID | Rule                                                                                 |
| ------- | ------------------------------------------------------------------------------------ |
| VOT-001 | Core voting principle: **1 user = 1 vote** (standard polls)                          |
| VOT-002 | Paid tiers influence exposure, NOT vote weight                                       |
| VOT-003 | "The Gavel" feature enables explicit weighted voting (B2B = 1.5×, Executive = 2×)    |
| VOT-004 | Weighted voting must be explicitly enabled by poll creator                           |
| VOT-005 | Weighted voting results display both raw and weighted counts                         |
| VOT-006 | Weighted vote calculation: `weighted_vote = raw_vote × user_weight`                  |
| VOT-007 | Weighted vote display: "This submission has received 120 votes (150 weighted votes)" |

### 2.4.2 Vote Validation Checks

| Check               | Description                      | Action                      |
| ------------------- | -------------------------------- | --------------------------- |
| Unique voter        | One vote per user per poll       | Block duplicate; idempotent |
| View duration       | 30 seconds minimum before voting | Block if too fast           |
| Device verification | One device per account           | Flag for review             |
| IP reputation       | Known fraud IPs blocked          | Block                       |
| Vote velocity       | Too many votes too quickly       | Rate limit                  |
| Account age         | Minimum 1 hour to vote           | Block                       |
| Poll status         | Must be ACTIVE                   | Block if closed             |

### 2.4.3 View Duration Check

| Rule ID | Rule                                                               |
| ------- | ------------------------------------------------------------------ |
| VOT-008 | User must spend at least 30 seconds on the poll page before voting |
| VOT-009 | Session timer starts when poll is fully loaded                     |
| VOT-010 | Timer resets on page refresh                                       |
| VOT-011 | Timer is tracked on the client and verified on the server          |

### 2.4.4 Vote State Machine

```
NOT_VOTED
    ↓ (user votes)
VOTED_A
    ↓ (user changes vote before closing)
VOTED_B
    ↓ (poll closes)
VOTE_LOCKED
    ↓ (results visible)
VOTE_HISTORICAL
    ↓ (after 90 days)
ARCHIVED
```

---

## 2.5 Token Rules

### 2.5.1 Token Earning Rules

| Action                           | Tokens    | Daily Cap | Requirements     |
| -------------------------------- | --------- | --------- | ---------------- |
| Vote on poll                     | 1         | 50        | Trust Score ≥ 20 |
| Vote (first 10 daily)            | 2 (bonus) | 20        | Trust Score ≥ 20 |
| Vote on bountied poll            | 3         | 15        | Trust Score ≥ 20 |
| Comment on poll                  | 2         | 10        | Trust Score ≥ 20 |
| Share poll                       | 5         | 15        | Trust Score ≥ 20 |
| Create poll                      | 10        | 20/week   | Trust Score ≥ 20 |
| Poll reaches 100 votes           | 20        | Unlimited | Creator          |
| Receive "Insightful" badge       | 30        | Unlimited | Comment quality  |
| Invite new user (email verified) | 25        | Unlimited | Trust Score ≥ 50 |
| Invited user votes 10 times      | 50        | Unlimited | Trust Score ≥ 50 |
| Daily challenge (5 votes)        | 10        | 10/day    | Trust Score ≥ 20 |
| Weekly challenge (50 votes)      | 50        | 50/week   | Trust Score ≥ 20 |
| Rewarded video ad                | 3         | Unlimited | Trust Score ≥ 20 |

### 2.5.2 Token Streak Bonuses

| Streak Length | Bonus Tokens | Badge Unlocked   |
| ------------- | ------------ | ---------------- |
| 7 days        | 10           | Consistent Voter |
| 14 days       | 25           | Dedicated Voice  |
| 30 days       | 50           | Gold Gavel       |
| 60 days       | 100          | Platinum Gavel   |
| 100 days      | 250          | Diamond Gavel    |

### 2.5.3 Token Spending Rules

| Action                     | Token Cost  | Requirements       |
| -------------------------- | ----------- | ------------------ |
| Bronze submission          | 100         | Trust Score ≥ 20   |
| Silver submission          | 300         | Trust Score ≥ 20   |
| Gold submission            | 700         | Trust Score ≥ 50   |
| Platinum submission        | 1,500       | Trust Score ≥ 50   |
| Extend submission (3 days) | 50          | Entitlement active |
| Boost visibility (24h pin) | 100         | Trust Score ≥ 50   |
| Remove watermark           | 150         | Entitlement active |
| Gift tokens                | 500 minimum | Trust Score ≥ 50   |

### 2.5.4 Token Expiration Rules

| Token Type       | Expiration Rule               | Consumption Order                |
| ---------------- | ----------------------------- | -------------------------------- |
| Earned tokens    | 90 days of account inactivity | FEFO (First Expiring, First Out) |
| Purchased tokens | 12 months from purchase date  | FEFO (First Expiring, First Out) |
| Bonus tokens     | Same as source purchase       | FEFO (First Expiring, First Out) |
| Gifted tokens    | 6 months from receipt         | FEFO (First Expiring, First Out) |

### 2.5.5 Account Inactivity Definition

| Activity Type              | Qualifies? |
| -------------------------- | ---------- |
| Login                      | ❌ No      |
| Opening app                | ❌ No      |
| Viewing a poll             | ❌ No      |
| **Voting**                 | ✅ Yes     |
| **Creating a poll**        | ✅ Yes     |
| **Commenting**             | ✅ Yes     |
| **Spending tokens**        | ✅ Yes     |
| **Purchasing tokens**      | ✅ Yes     |
| **Inviting a user**        | ✅ Yes     |
| **Completing a challenge** | ✅ Yes     |

---

## 2.6 Ad Rules

### 2.6.1 Ad Types & Placement

| Ad Type        | Format       | Placement               | Frequency (Free Users) | Revenue Model |
| -------------- | ------------ | ----------------------- | ---------------------- | ------------- |
| Banner         | 300×50 image | Bottom of voting screen | Every vote             | CPM           |
| Interstitial   | Full screen  | Every 10th vote         | Every 10th vote        | CPM           |
| Native         | In-feed      | Within voting flow      | Every 5th vote         | CPC           |
| Video (15s)    | MP4          | Before results          | Every 3rd vote         | CPV           |
| Rewarded Video | MP4 (30s)    | User-initiated          | Unlimited              | CPV           |

### 2.6.2 Ad Frequency Rules

| Rule ID | Rule                                                  |
| ------- | ----------------------------------------------------- |
| ADV-001 | Free users see ads during voting                      |
| ADV-002 | Paid users see NO ads (except opt-in rewarded videos) |
| ADV-003 | Maximum 10 ads per user per day                       |
| ADV-004 | Rewarded videos are opt-in and unlimited              |
| ADV-005 | Ad placement is randomized to prevent predictability  |

### 2.6.3 Revenue Sharing Formula

| Rule ID | Rule                                                                                               |
| ------- | -------------------------------------------------------------------------------------------------- |
| ADV-006 | User Revenue Share = (Distributable Ad Revenue) × (User's Eligible Events / Total Eligible Events) |
| ADV-007 | Distributable Ad Revenue = Total Confirmed Revenue × 70%                                           |
| ADV-008 | Platform Fee = Total Confirmed Revenue × 30%                                                       |
| ADV-009 | Revenue is distributed weekly                                                                      |
| ADV-010 | Rewards are PROVISIONAL until revenue is confirmed                                                 |

### 2.6.4 Reward State Machine

```
AD_EVENT (user watches ad)
    ↓
PENDING_REWARD (estimated value stored)
    ↓
FRAUD_VALIDATION (automated check)
    ↓
VALIDATED (eligible for reward)
    ↓
REVENUE_CONFIRMATION (ad provider confirms)
    ↓
TOKEN_CREDITED (tokens added to wallet)
    ↓
CONFIRMED (final state)

REVERSAL PATHS:
PENDING_REWARD → REVERSED (fraud detected)
VALIDATED → REVERSED (revenue invalidated)
CONFIRMED → REVERSED (clawback)
```

---

## 2.7 Moderation & Safety Rules

### 2.7.1 Content Policies

| Category           | Allowed             | Rejected                     |
| ------------------ | ------------------- | ---------------------------- |
| **Products**       | Legitimate products | Illegal products             |
| **Claims**         | Substantiated       | Misleading/false             |
| **Content**        | Professional        | NSFW/adult                   |
| **Politics**       | Pre-approved only   | Unapproved political content |
| **Hate Speech**    | Never               | Always rejected              |
| **Visual Quality** | High quality        | Poor quality/fake            |
| **Copyright**      | Owned or licensed   | Copyright infringement       |

### 2.7.2 Moderation SLA

| Priority   | Description                  | SLA      |
| ---------- | ---------------------------- | -------- |
| **URGENT** | Illegal content, hate speech | 1 hour   |
| **HIGH**   | NSFW, spam, fraud            | 4 hours  |
| **MEDIUM** | Policy violations, disputes  | 24 hours |
| **LOW**    | Routine appeals, questions   | 72 hours |

### 2.7.3 Violation Tracking

| Rule ID | Rule                                                              |
| ------- | ----------------------------------------------------------------- |
| MOD-001 | First violation: Warning + content removal                        |
| MOD-002 | Second violation: 7-day suspension                                |
| MOD-003 | Third violation: Permanent ban                                    |
| MOD-004 | Severe violations (illegal, hate speech): Immediate permanent ban |
| MOD-005 | Users can appeal moderation decisions within 30 days              |

---

# 3. DOMAIN MODEL

## 3.1 Identity Context

### User

```typescript
interface User {
  id: string; // UUID v4
  email: string; // Unique, indexed
  phone?: string; // Optional, indexed
  username: string; // Unique, display name
  displayName: string; // User-friendly name
  bio?: string; // User bio
  avatarUrl?: string; // Profile picture URL
  trustScore: number; // 0-100
  isVerified: boolean; // Email verified
  isPhoneVerified: boolean; // Phone verified
  isB2BVerified: boolean; // B2B status verified
  status: "active" | "suspended" | "deleted";
  role: "user" | "team_lead" | "admin" | "enterprise_admin";
  preferences: JSON; // Notification, privacy settings
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
}
```

### Verification

```typescript
interface Verification {
  id: string;
  userId: string; // FK to User
  type: "email" | "phone" | "b2b" | "government_id";
  status: "pending" | "verified" | "rejected" | "expired";
  code?: string; // Verification code
  codeExpiresAt?: Date; // Code expiration
  verifiedAt?: Date; // When verified
  metadata: JSON; // Provider-specific data
  createdAt: Date;
  updatedAt: Date;
}
```

### Trust Event

```typescript
interface TrustEvent {
  id: string;
  userId: string; // FK to User
  eventType:
    | "vote"
    | "poll_created"
    | "comment"
    | "payment"
    | "referral"
    | "fraud_flag";
  scoreChange: number; // Positive or negative
  reason: string; // Human-readable
  referenceId: string; // Reference to source record
  createdAt: Date;
}
```

---

## 3.2 Polling Context

### Poll

```typescript
interface Poll {
  id: string; // UUID v4
  creatorId: string; // FK to User
  type: "classic" | "quiz" | "duel" | "matrix" | "blind" | "gavel";
  title: string; // Max 280 characters
  description?: string; // Max 500 characters
  status:
    | "draft"
    | "pending"
    | "active"
    | "featured"
    | "closed"
    | "archived"
    | "rejected";
  visibility: "public" | "team" | "private";
  audience: "all" | "team" | "b2b" | "custom";
  audienceCustomConfig?: JSON; // Custom audience rules
  duration: {
    start: Date;
    end: Date;
  };
  categories: string[]; // AI-generated tags
  isBountied: boolean;
  gavelConfig?: JSON; // Weighted voting configuration
  stats: {
    totalVotes: number;
    uniqueVoters: number;
    totalComments: number;
    totalShares: number;
  };
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
  deletedAt?: Date; // Soft delete
}
```

### Option

```typescript
interface Option {
  id: string;
  pollId: string; // FK to Poll
  label: string; // Max 50 characters
  description?: string; // Max 100 characters
  imageUrl: string; // S3/Cloudinary URL
  imageThumbnailUrl: string; // Thumbnail
  order: number; // Display order
  votes: number; // Aggregate vote count
  isCorrect?: boolean; // For quiz polls
  createdAt: Date;
  updatedAt: Date;
}
```

### Vote

```typescript
interface Vote {
  id: string;
  pollId: string; // FK to Poll
  userId: string; // FK to User
  optionId: string; // FK to Option
  weight: number; // Default 1.0 (Gavel = 1.5, 2.0)
  isAnonymous: boolean;
  ipAddress: string; // For fraud detection
  userAgent: string; // Device info
  viewDuration: number; // Seconds spent viewing
  status: "confirmed" | "rejected" | "reversed";
  idempotencyKey: string; // Unique constraint
  createdAt: Date;
  updatedAt: Date;

  // Unique constraint: UNIQUE (pollId, userId)
}
```

### Vote Change

```typescript
interface VoteChange {
  id: string;
  voteId: string; // FK to Vote
  previousOptionId: string; // FK to Option
  newOptionId: string; // FK to Option
  reason?: string; // Optional reason
  createdAt: Date;
}
```

---

## 3.3 Submission Context

### Submission

```typescript
interface Submission {
  id: string; // UUID v4
  creatorId: string; // FK to User
  title: string; // Max 100 characters
  description?: string; // Max 500 characters
  media: {
    primary: string; // Main image/video URL
    gallery?: string[]; // Additional media
    thumbnails: string[]; // Thumbnails
  };
  status:
    | "draft"
    | "pending_moderation"
    | "active"
    | "featured"
    | "expired"
    | "archived"
    | "rejected";
  tier: "bronze" | "silver" | "gold" | "platinum";
  categories: string[];
  tags: string[];
  metrics: {
    views: number;
    votes: number;
    comments: number;
    shares: number;
    ranking: number; // Current rank in feed
  };
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  expiredAt?: Date;
  deletedAt?: Date; // Soft delete
}
```

### Submission Version

```typescript
interface SubmissionVersion {
  id: string;
  submissionId: string; // FK to Submission
  versionNumber: number;
  media: JSON; // Snapshot of media
  title: string;
  description: string;
  voteCountReset: boolean; // Whether votes were reset
  changeReason: string; // User-provided reason
  createdAt: Date;
}
```

---

## 3.4 Monetization Context

### Tier Configuration

```typescript
interface TierConfig {
  id: string;
  name: "bronze" | "silver" | "gold" | "platinum";
  priceUsd: number; // In USD
  tokenPrice: number; // Token cost
  durationSeconds: number; // Entitlement duration
  startingPosition: number; // 1-100 percentile
  featuredBadge: boolean;
  pinDurationSeconds: number; // 0 if none
  watermarkRemovable: boolean;
  voteWeight: number; // 1.0 for all
  isActive: boolean;
  effectiveFrom: Date;
  effectiveUntil?: Date; // Null if current
  createdAt: Date;
  updatedAt: Date;
}
```

### Purchase

```typescript
interface Purchase {
  id: string;
  userId: string; // FK to User
  productType: "tier" | "boost" | "subscription";
  productId: string; // FK to TierConfig (for tier purchases)
  fundingSource: "cash" | "tokens" | "promo" | "gift";
  amount: number; // Amount paid (in USD or tokens)
  currency: "USD" | "tokens";
  status: "pending" | "completed" | "failed" | "refunded" | "chargeback";
  idempotencyKey: string; // Unique
  metadata: JSON; // Additional data
  completedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entitlement

```typescript
interface Entitlement {
  id: string;
  userId: string; // FK to User
  purchaseId: string; // FK to Purchase
  submissionId?: string; // FK to Submission (if tier submission)
  type: "submission_tier" | "visibility_boost" | "feature_access";
  tierSnapshot: JSON; // Frozen tier configuration at purchase time
  startsAt: Date;
  expiresAt: Date;
  status: "active" | "expired" | "cancelled" | "revoked";
  used: boolean; // Whether benefit was consumed
  metadata: JSON;
  createdAt: Date;
  updatedAt: Date;
}
```

### Payment

```typescript
interface Payment {
  id: string;
  userId: string; // FK to User
  purchaseId: string; // FK to Purchase
  provider: "stripe" | "paystack" | "flutterwave" | "paypal";
  providerPaymentId: string; // Provider's transaction ID
  amount: number; // In USD
  currency: string; // USD by default
  status:
    | "created"
    | "processing"
    | "succeeded"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "chargeback"
    | "disputed";
  idempotencyKey: string; // Unique
  receiptUrl?: string; // Receipt PDF URL
  metadata: JSON;
  createdAt: Date;
  updatedAt: Date;
  succeededAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
}
```

---

## 3.5 Token Context

### Token Account

```typescript
interface TokenAccount {
  id: string;
  userId: string; // FK to User (UNIQUE)
  totalBalance: number; // Cached sum of all lots
  availableBalance: number; // For spending
  pendingBalance: number; // Unconfirmed rewards
  lockedBalance: number; // In-transaction tokens
  createdAt: Date;
  updatedAt: Date;
}
```

### Token Transaction

```typescript
interface TokenTransaction {
  id: string;
  userId: string; // FK to User
  type:
    | "earn_vote"
    | "earn_streak"
    | "earn_referral"
    | "earn_poll_create"
    | "earn_badge"
    | "earn_ad_reward"
    | "purchase"
    | "purchase_bonus"
    | "spend_submission"
    | "spend_boost"
    | "gift_sent"
    | "gift_received"
    | "expired"
    | "reversal"
    | "admin_adjustment";
  direction: "credit" | "debit";
  amount: number;
  status: "pending" | "completed" | "reversed" | "failed";
  source: string; // Human-readable source description
  referenceId?: string; // UUID of related record (voteId, pollId, etc.)
  referenceType?: string; // Table name of related record
  idempotencyKey: string; // Unique constraint
  metadata: JSON;
  createdAt: Date;
  completedAt?: Date;
  reversedAt?: Date;
}
```

### Token Lot

```typescript
interface TokenLot {
  id: string;
  userId: string; // FK to User
  transactionId: string; // FK to TokenTransaction
  amount: number; // Original amount
  remainingAmount: number; // Available to spend
  expiresAt?: Date; // Null if no expiration
  status: "active" | "partially_consumed" | "expired" | "consumed";
  createdAt: Date;
  updatedAt: Date;
}
```

### Token Transaction Item

```typescript
interface TokenTransactionItem {
  id: string;
  transactionId: string; // FK to TokenTransaction
  lotId?: string; // FK to TokenLot (if consumption)
  amount: number; // Amount affected
  balanceAfter: number; // User's balance after this item
  createdAt: Date;
}
```

---

## 3.6 Advertising Context

### Campaign

```typescript
interface Campaign {
  id: string;
  advertiserId: string; // FK to User (advertiser role)
  name: string;
  type:
    | "banner"
    | "interstitial"
    | "video"
    | "native"
    | "carousel"
    | "rewarded";
  status:
    | "draft"
    | "pending_review"
    | "approved"
    | "rejected"
    | "active"
    | "paused"
    | "completed";
  budget: {
    daily: number; // Daily budget in USD
    campaign: number; // Total campaign budget in USD
    spent: number; // Amount spent so far
  };
  bid: {
    type: "cpm" | "cpc" | "cpv";
    amount: number; // Bid amount
  };
  targeting: {
    demographics: {
      ageRange?: { min: number; max: number };
      gender?: ("male" | "female" | "all")[];
      locations?: string[]; // Country codes
    };
    interests?: string[]; // Category tags
    behavioral?: string[]; // User behavior segments
    contextual?: string[]; // Poll categories
  };
  schedule: {
    startDate: Date;
    endDate: Date;
    timeOfDay?: { start: number; end: number }; // Hour of day
  };
  metrics: {
    impressions: number;
    clicks: number;
    completions: number;
    revenue: number;
  };
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
}
```

### Creative

```typescript
interface Creative {
  id: string;
  campaignId: string; // FK to Campaign
  type: "image" | "video" | "html5";
  url: string; // S3/Cloudinary URL
  thumbnailUrl?: string; // Thumbnail
  dimensions: { width: number; height: number };
  durationSeconds?: number; // For video ads
  ctaText: string; // Call-to-action text
  destinationUrl: string; // Link when clicked
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  metadata: JSON;
  createdAt: Date;
  updatedAt: Date;
}
```

### Impression

```typescript
interface Impression {
  id: string;
  userId: string; // FK to User
  campaignId: string; // FK to Campaign
  creativeId: string; // FK to Creative
  type: "banner" | "interstitial" | "video" | "native" | "rewarded";
  status: "impressed" | "clicked" | "completed" | "skipped" | "viewed";
  revenueEstimated: number; // Estimated revenue
  revenueConfirmed?: number; // Confirmed revenue
  revenueCurrency: string; // USD
  viewedAt: Date;
  completedAt?: Date;
  ipAddress: string; // For analytics
  userAgent: string; // Device info
  createdAt: Date;
  updatedAt: Date;
}
```

### Ad Reward

```typescript
interface AdReward {
  id: string;
  userId: string; // FK to User
  impressionId: string; // FK to Impression
  type: "view" | "click" | "complete";
  status: "pending" | "validated" | "confirmed" | "reversed";
  tokensAwarded: number; // Tokens credited
  estimatedAt: Date;
  validatedAt?: Date;
  confirmedAt?: Date;
  reversedAt?: Date;
  reversalReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3.7 Moderation Context

### Moderation Queue

```typescript
interface ModerationQueue {
  id: string;
  resourceType: "submission" | "ad" | "comment" | "user" | "poll";
  resourceId: string; // FK to the resource
  reporterId?: string; // FK to User (who reported)
  reason: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_review" | "approved" | "rejected" | "flagged";
  assignedTo?: string; // FK to User (moderator)
  reviewNotes?: string;
  createdAt: Date;
  reviewedAt?: Date;
  updatedAt: Date;
}
```

### Moderation Decision

```typescript
interface ModerationDecision {
  id: string;
  queueId: string; // FK to ModerationQueue
  decision: "approve" | "reject" | "request_changes" | "escalate";
  decisionMakerId: string; // FK to User (moderator)
  reason: string;
  appealableUntil: Date;
  createdAt: Date;
}
```

### Appeal

```typescript
interface Appeal {
  id: string;
  decisionId: string; // FK to ModerationDecision
  appellantId: string; // FK to User
  reason: string;
  evidence: JSON; // Supporting documents
  status: "pending" | "under_review" | "approved" | "rejected";
  resolvedBy?: string; // FK to User (moderator)
  resolutionReason?: string;
  createdAt: Date;
  resolvedAt?: Date;
}
```

---

## 3.8 Audit Context

### Audit Log

```typescript
interface AuditLog {
  id: string;
  actor: string; // User ID or system
  actorType: "user" | "system" | "admin" | "moderator";
  action: string; // Human-readable action
  resourceType: string; // Table name
  resourceId: string; // Record ID
  before?: JSON; // Previous state
  after?: JSON; // New state
  reason?: string; // Optional reason
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

---

## 3.9 Domain Event Schema

### Base Domain Event

```typescript
interface DomainEvent {
  id: string; // UUID v4
  eventType: string; // namespace.type (e.g., "payment.succeeded")
  aggregateType: string; // "payment" | "submission" | "vote" | etc.
  aggregateId: string; // UUID of the aggregate
  version: number; // Version of the aggregate
  data: JSON; // Event-specific data
  metadata: {
    correlationId?: string; // Request-scoped ID
    causationId?: string; // Parent event ID
    source: string; // Service name
    userId?: string; // User who initiated
  };
  idempotencyKey: string; // Unique
  occurredAt: Date;
  processedAt?: Date; // When processed by consumer
}
```

### Event Types

#### User Events

```typescript
"user.registered";
"user.verified";
"user.suspended";
"user.deleted";
```

#### Payment Events

```typescript
"payment.created";
"payment.succeeded";
"payment.failed";
"payment.refunded";
"payment.chargeback";
```

#### Purchase Events

```typescript
"purchase.created";
"purchase.completed";
"purchase.refunded";
```

#### Entitlement Events

```typescript
"entitlement.activated";
"entitlement.expired";
"entitlement.revoked";
```

#### Submission Events

```typescript
"submission.created";
"submission.published";
"submission.featured";
"submission.expired";
"submission.rejected";
"submission.deleted";
```

#### Vote Events

```typescript
"vote.cast";
"vote.changed";
"vote.rejected";
```

#### Token Events

```typescript
"token.earned";
"token.spent";
"token.gifted";
"token.expired";
"token.reversed";
```

#### Ad Events

```typescript
"ad.impression";
"ad.click";
"ad.completed";
"ad.reward_pending";
"ad.reward_confirmed";
"ad.reward_reversed";
```

#### Campaign Events

```typescript
"campaign.created";
"campaign.approved";
"campaign.rejected";
"campaign.active";
"campaign.paused";
"campaign.completed";
```

#### Moderation Events

```typescript
"moderation.flagged";
"moderation.approved";
"moderation.rejected";
"moderation.appealed";
"moderation.appeal_approved";
```

---

# 4. STATE MACHINES

## 4.1 Payment State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAYMENT STATE MACHINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                                                  │
│   │ CREATED │                                                  │
│   └────┬────┘                                                  │
│        │ (user initiates payment)                              │
│        ▼                                                       │
│   ┌─────────────┐                                             │
│   │ PROCESSING  │                                             │
│   └──────┬──────┘                                             │
│          │                                                     │
│          ├────────────────────────────┐                       │
│          │ (payment provider success) │ (payment provider fail)│
│          ▼                            ▼                       │
│   ┌─────────────┐              ┌──────────┐                   │
│   │  SUCCEEDED  │              │  FAILED  │                   │
│   └──────┬──────┘              └──────────┘                   │
│          │                                                    │
│          ├────────────────────────────┐                       │
│          │ (refund)                   │ (chargeback)          │
│          ▼                            ▼                       │
│   ┌─────────────┐              ┌─────────────┐               │
│   │  REFUNDED   │              │ CHARGEBACK  │               │
│   └─────────────┘              └─────────────┘               │
│          │                                                    │
│          └────────────────────────────┐                       │
│                                       ▼                       │
│                               ┌───────────────────┐          │
│                               │ PARTIALLY_REFUNDED│          │
│                               └───────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Payment State Transitions

| From       | To                 | Trigger                | Validation           |
| ---------- | ------------------ | ---------------------- | -------------------- |
| CREATED    | PROCESSING         | User initiates payment | Valid payment method |
| PROCESSING | SUCCEEDED          | Provider confirms      | Webhook received     |
| PROCESSING | FAILED             | Provider declines      | Reason captured      |
| SUCCEEDED  | REFUNDED           | Admin/user refund      | Within policy        |
| SUCCEEDED  | CHARGEBACK         | Customer disputes      | Bank notification    |
| SUCCEEDED  | PARTIALLY_REFUNDED | Admin partial refund   | Within policy        |

---

## 4.2 Entitlement State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENTITLEMENT STATE MACHINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                                                  │
│   │  DRAFT  │                                                  │
│   └────┬────┘                                                  │
│        │ (purchase completed)                                  │
│        ▼                                                       │
│   ┌─────────────────┐                                         │
│   │   PENDING_ACTIVATION                                      │
│   └──────┬──────────┘                                         │
│          │ (activation conditions met)                        │
│          ▼                                                    │
│   ┌───────────┐                                               │
│   │  ACTIVE   │                                               │
│   └─────┬─────┘                                               │
│         │                                                     │
│         ├────────────────────────────┐                       │
│         │ (time passes)             │ (admin revokes)        │
│         ▼                           ▼                       │
│   ┌───────────┐              ┌──────────┐                   │
│   │  EXPIRED  │              │ REVOKED  │                   │
│   └───────────┘              └──────────┘                   │
│         │                                                    │
│         └────────────────────────────┐                       │
│                                      ▼                       │
│                              ┌─────────────┐                 │
│                              │ CANCELLED   │                 │
│                              │ (by user)   │                 │
│                              └─────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Entitlement State Transitions

| From               | To                 | Trigger            | Validation           |
| ------------------ | ------------------ | ------------------ | -------------------- |
| DRAFT              | PENDING_ACTIVATION | Purchase completed | Payment confirmed    |
| PENDING_ACTIVATION | ACTIVE             | Conditions met     | Submission published |
| ACTIVE             | EXPIRED            | Time passes        | `expiresAt` reached  |
| ACTIVE             | REVOKED            | Admin action       | Content violation    |
| ACTIVE             | CANCELLED          | User action        | Within 48h, no votes |

---

## 4.3 Submission State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUBMISSION STATE MACHINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                                                  │
│   │  DRAFT  │                                                  │
│   └────┬────┘                                                  │
│        │ (user submits)                                        │
│        ▼                                                       │
│   ┌───────────────────┐                                       │
│   │ PENDING_MODERATION│                                       │
│   └────────┬──────────┘                                       │
│            │                                                  │
│            ├────────────────────────────┐                     │
│            │ (approved)                │ (rejected)          │
│            ▼                           ▼                     │
│   ┌────────────┐              ┌────────────┐                  │
│   │   ACTIVE   │              │  REJECTED  │                  │
│   └──────┬─────┘              └────────────┘                  │
│          │                                                    │
│          ├────────────────────────────┐                       │
│          │ (featured by system)      │ (entitlement expires) │
│          ▼                           ▼                       │
│   ┌────────────┐              ┌────────────┐                  │
│   │  FEATURED  │              │  EXPIRED   │                  │
│   └──────┬─────┘              └──────┬─────┘                  │
│          │ (featured ends)          │                         │
│          └────────────┬─────────────┘                         │
│                       ▼                                       │
│                 ┌────────────┐                                │
│                 │  EXPIRED   │                                │
│                 └──────┬─────┘                                │
│                        │ (90 days later)                      │
│                        ▼                                      │
│                 ┌────────────┐                                │
│                 │  ARCHIVED  │                                │
│                 └────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

### Submission State Transitions

| From               | To                 | Trigger              | Validation                    |
| ------------------ | ------------------ | -------------------- | ----------------------------- |
| DRAFT              | PENDING_MODERATION | User submits         | Requires active entitlement   |
| PENDING_MODERATION | ACTIVE             | Moderator approves   | Policy check passed           |
| PENDING_MODERATION | REJECTED           | Moderator rejects    | Policy violation              |
| ACTIVE             | FEATURED           | System action        | Entitlement includes featured |
| ACTIVE             | EXPIRED            | Time passes          | Entitlement expires           |
| FEATURED           | ACTIVE             | Featured period ends | 24h or 48h pin ends           |
| EXPIRED            | ARCHIVED           | 90 days pass         | Data retention                |
| REJECTED           | (appeal)           | User appeals         | Appeals process               |

---

## 4.4 Vote State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                        VOTE STATE MACHINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌────────────────┐                                           │
│   │  NOT_VOTED    │                                            │
│   └───────┬────────┘                                           │
│           │ (user votes)                                       │
│           ▼                                                    │
│   ┌─────────────────┐                                         │
│   │   VOTED_A       │                                         │
│   └────────┬────────┘                                         │
│            │                                                  │
│            ├────────────────────────────┐                     │
│            │ (user changes vote)       │ (poll closes)       │
│            ▼                           ▼                     │
│   ┌─────────────────┐              ┌─────────────┐           │
│   │   VOTED_B       │              │ VOTE_LOCKED │           │
│   └────────┬────────┘              └──────┬──────┘           │
│            │                              │                   │
│            └─────────────┐                │                   │
│                          │                ▼                   │
│                          │       ┌──────────────────┐        │
│                          │       │ VOTE_HISTORICAL │        │
│                          │       └────────┬─────────┘        │
│                          │                │                   │
│                          │                ▼                   │
│                          │       ┌──────────────────┐        │
│                          │       │    ARCHIVED     │        │
│                          │       └──────────────────┘        │
│                          │                                    │
│                          ▼                                    │
│                   ┌────────────┐                              │
│                   │ VOTE_LOCKED│                              │
│                   └────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Vote State Transitions

| From            | To              | Trigger             | Validation             |
| --------------- | --------------- | ------------------- | ---------------------- |
| NOT_VOTED       | VOTED_A         | User votes for A    | Poll is ACTIVE         |
| NOT_VOTED       | VOTED_B         | User votes for B    | Poll is ACTIVE         |
| VOTED_A         | VOTED_B         | User changes vote   | Poll is ACTIVE         |
| VOTED_B         | VOTED_A         | User changes vote   | Poll is ACTIVE         |
| VOTED_A         | VOTE_LOCKED     | Poll closes         | `poll.status = closed` |
| VOTED_B         | VOTE_LOCKED     | Poll closes         | `poll.status = closed` |
| VOTE_LOCKED     | VOTE_HISTORICAL | 30 days after close | Data retention         |
| VOTE_HISTORICAL | ARCHIVED        | 90 days after close | Data retention         |

---

## 4.5 Token Transaction State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                   TOKEN TRANSACTION STATE MACHINE               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                         │
│   │    PENDING      │                                         │
│   └────────┬────────┘                                         │
│            │                                                  │
│            ├────────────────────────────┐                     │
│            │ (validated)              │ (invalid)            │
│            ▼                           ▼                     │
│   ┌─────────────────┐              ┌─────────────────┐        │
│   │   COMPLETED     │              │    REVERSED     │        │
│   └─────────────────┘              └─────────────────┘        │
│            │                                                  │
│            └────────────────────────────┐                     │
│                                         ▼                     │
│                                 ┌─────────────────┐          │
│                                 │    FAILED       │          │
│                                 └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Token Transaction State Transitions

| From    | To        | Trigger           | Validation        |
| ------- | --------- | ----------------- | ----------------- |
| PENDING | COMPLETED | Validation passes | All checks passed |
| PENDING | REVERSED  | Validation fails  | Fraud detected    |
| PENDING | FAILED    | System error      | Retry failed      |

---

## 4.6 Ad Reward State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     AD REWARD STATE MACHINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                         │
│   │    PENDING      │                                         │
│   └────────┬────────┘                                         │
│            │ (fraud check passes)                             │
│            ▼                                                  │
│   ┌─────────────────┐                                         │
│   │   VALIDATED     │                                         │
│   └────────┬────────┘                                         │
│            │ (revenue confirmed)                              │
│            ▼                                                  │
│   ┌─────────────────┐                                         │
│   │   CONFIRMED     │                                         │
│   └─────────────────┘                                         │
│                                                                 │
│   REVERSAL PATHS:                                               │
│                                                                 │
│   ┌─────────────────┐                                         │
│   │    PENDING      │                                         │
│   └────────┬────────┘                                         │
│            │ (fraud detected)                                 │
│            ▼                                                  │
│   ┌─────────────────┐                                         │
│   │   REVERSED      │                                         │
│   └─────────────────┘                                         │
│                                                                 │
│   ┌─────────────────┐                                         │
│   │   VALIDATED     │                                         │
│   └────────┬────────┘                                         │
│            │ (revenue invalidated)                            │
│            ▼                                                  │
│   ┌─────────────────┐                                         │
│   │   REVERSED      │                                         │
│   └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Ad Reward State Transitions

| From      | To        | Trigger             | Validation            |
| --------- | --------- | ------------------- | --------------------- |
| PENDING   | VALIDATED | Fraud check passes  | User trust check      |
| VALIDATED | CONFIRMED | Revenue confirmed   | Provider confirmation |
| PENDING   | REVERSED  | Fraud detected      | Fraud alert           |
| VALIDATED | REVERSED  | Revenue invalidated | Provider clawback     |

---

## 4.7 Campaign State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAMPAIGN STATE MACHINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                                                  │
│   │  DRAFT  │                                                  │
│   └────┬────┘                                                  │
│        │ (submitted)                                           │
│        ▼                                                       │
│   ┌─────────────────┐                                         │
│   │ PENDING_REVIEW  │                                         │
│   └────────┬────────┘                                         │
│            │                                                  │
│            ├────────────────────────────┐                     │
│            │ (approved)                │ (rejected)           │
│            ▼                           ▼                     │
│   ┌────────────┐              ┌────────────┐                  │
│   │  APPROVED  │              │  REJECTED  │                  │
│   └──────┬─────┘              └────────────┘                  │
│          │ (start date reached)                               │
│          ▼                                                    │
│   ┌────────────┐                                               │
│   │   ACTIVE   │                                               │
│   └──────┬─────┘                                               │
│          │                                                    │
│          ├────────────────────────────┐                       │
│          │ (budget exhausted)       │ (advertiser pauses)    │
│          ▼                           ▼                       │
│   ┌─────────────────┐              ┌──────────┐               │
│   │   COMPLETED     │              │  PAUSED  │               │
│   └─────────────────┘              └────┬─────┘               │
│                                          │ (advertiser resumes)│
│                                          ▼                     │
│                                   ┌────────────┐              │
│                                   │   ACTIVE   │              │
│                                   └────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Campaign State Transitions

| From           | To             | Trigger            | Validation                        |
| -------------- | -------------- | ------------------ | --------------------------------- |
| DRAFT          | PENDING_REVIEW | Advertiser submits | All fields complete               |
| PENDING_REVIEW | APPROVED       | Moderator approves | Policy check passed               |
| PENDING_REVIEW | REJECTED       | Moderator rejects  | Policy violation                  |
| APPROVED       | ACTIVE         | Start date reached | Payment confirmed                 |
| ACTIVE         | COMPLETED      | Budget exhausted   | `budget.spent >= budget.campaign` |
| ACTIVE         | PAUSED         | Advertiser pauses  | Manual action                     |
| PAUSED         | ACTIVE         | Advertiser resumes | Budget available                  |
| PAUSED         | COMPLETED      | Budget exhausted   | `budget.spent >= budget.campaign` |

---

## 4.8 Moderation State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    MODERATION STATE MACHINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                         │
│   │    PENDING      │                                         │
│   └────────┬────────┘                                         │
│            │ (moderator reviews)                              │
│            ▼                                                  │
│   ┌─────────────────┐                                         │
│   │   IN_REVIEW     │                                         │
│   └────────┬────────┘                                         │
│            │                                                  │
│            ├────────────────────────────┐                     │
│            │ (approve)                 │ (reject)            │
│            ▼                           ▼                     │
│   ┌─────────────────┐              ┌─────────────────┐        │
│   │   APPROVED      │              │   REJECTED      │        │
│   └─────────────────┘              └────────┬────────┘        │
│                                             │ (appeal)        │
│                                             ▼                  │
│                                      ┌─────────────────┐      │
│                                      │   FLAGGED       │      │
│                                      └─────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Moderation State Transitions

| From      | To        | Trigger            | Validation          |
| --------- | --------- | ------------------ | ------------------- |
| PENDING   | IN_REVIEW | Moderator claims   | Moderator role      |
| IN_REVIEW | APPROVED  | Moderator approves | Policy check passed |
| IN_REVIEW | REJECTED  | Moderator rejects  | Policy violation    |
| REJECTED  | FLAGGED   | User appeals       | Appeal submitted    |
| FLAGGED   | APPROVED  | Appeal approved    | Appeal review       |

---

# 5. RANKING ALGORITHM

## 5.1 Formula Specification

```
FINAL_SCORE = (ORGANIC_POPULARITY × 0.6) +
              (PAID_EXPOSURE × 0.3) +
              (FRESHNESS × 0.1)

WHERE:
  ORGANIC_POPULARITY = raw_votes / max_votes_in_category
  PAID_EXPOSURE = (starting_position_boost × 0.4) +
                  (pin_boost × 0.3) +
                  (featured_boost × 0.3)
  FRESHNESS = 1.0 - (hours_since_publish / total_duration_hours)
```

## 5.2 Starting Positions by Tier

| Tier         | Position | Algorithm                      |
| ------------ | -------- | ------------------------------ |
| **Bronze**   | Bottom   | Position = 100 - (random 0-5%) |
| **Silver**   | Middle   | Position = 50 - (random 0-10%) |
| **Gold**     | Top 25%  | Position = 25 - (random 0-10%) |
| **Platinum** | Top 5%   | Position = 5 - (random 0-2%)   |

## 5.3 Position Management Rules

| Rule ID  | Rule                                                         |
| -------- | ------------------------------------------------------------ |
| RANK-001 | Position is calculated at submission time                    |
| RANK-002 | Position is re-calculated every hour                         |
| RANK-003 | Pin duration: submission stays at top position               |
| RANK-004 | After pin expires, submission reverts to calculated position |
| RANK-005 | Multiple pinned submissions: newer pin takes priority        |
| RANK-006 | Organic votes affect ranking for all submissions equally     |

## 5.4 Display Labels

| Context   | Label          | User Sees                                  |
| --------- | -------------- | ------------------------------------------ |
| Pinned    | "📌 Pinned"    | "This submission is pinned by the creator" |
| Featured  | "⭐ Featured"  | "This submission has been featured"        |
| Platinum  | "🏆 Platinum"  | "This submission is a Platinum entry"      |
| Sponsored | "📢 Sponsored" | "This submission is sponsored"             |

---

# 6. TOKEN LEDGER

## 6.1 Immutable Transaction Model

### Core Principle

> **Never directly mutate the token balance without creating a ledger transaction.**

### Implementation Pattern

```typescript
// ❌ WRONG: Direct mutation
await db
  .update(TokenAccount)
  .set({ totalBalance: sql`${tokenAccount.totalBalance} + ${amount}` })
  .where(eq(TokenAccount.userId, userId));

// ✅ CORRECT: Create transaction first
const transaction = await db.insert(TokenTransaction).values({
  userId,
  type: "earn_vote",
  direction: "credit",
  amount: 10,
  status: "completed",
  idempotencyKey: idempotencyKey,
  // ... other fields
});

// Then update balance (cached projection)
await db
  .update(TokenAccount)
  .set({ totalBalance: sql`${tokenAccount.totalBalance} + ${amount}` })
  .where(eq(TokenAccount.userId, userId));
```

## 6.2 Double-Entry Design

### Transaction Types

| Direction  | Description                 | Example                          |
| ---------- | --------------------------- | -------------------------------- |
| **Credit** | Tokens added to account     | Earning, Purchase, Gift received |
| **Debit**  | Tokens removed from account | Spending, Gift sent, Expiration  |

### Transaction Flow

```sql
BEGIN TRANSACTION;

-- 1. Create transaction
INSERT INTO token_transactions (...)
VALUES ('earn_vote', 'credit', 10, 'completed', ...);

-- 2. Create lot (for credit transactions)
INSERT INTO token_lots (...)
VALUES (10, 10, '2025-03-15', ...);

-- 3. Update account balance (cached)
UPDATE token_accounts
SET total_balance = total_balance + 10
WHERE user_id = 'user_123';

COMMIT;
```

## 6.3 FEFO Consumption

### First Expiring, First Out

When spending tokens, consume lots in order of expiration date (earliest first).

```sql
-- Get available lots ordered by expiration
SELECT * FROM token_lots
WHERE user_id = 'user_123'
  AND remaining_amount > 0
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY expires_at ASC NULLS LAST;

-- Consume from each lot until total amount is satisfied
```

### Example

| Lot | Amount | Remaining | Expires At |
| --- | ------ | --------- | ---------- |
| A   | 100    | 100       | 2025-01-01 |
| B   | 500    | 500       | 2025-12-01 |

User spends 150 tokens:

1. Consume 100 from Lot A (expires earlier)
2. Consume 50 from Lot B

Remaining: Lot A = 0, Lot B = 450

## 6.4 Idempotency Requirements

| Rule ID | Rule                                              |
| ------- | ------------------------------------------------- |
| TKN-006 | All token transactions require an idempotency key |
| TKN-007 | Idempotency keys must be unique                   |
| TKN-008 | Idempotency keys must be included in all requests |
| TKN-009 | Idempotency keys expire after 24 hours            |

### Implementation

```typescript
const idempotencyKey = request.headers["idempotency-key"];

// Check if already processed
const existing = await db
  .select()
  .from(TokenTransaction)
  .where(eq(TokenTransaction.idempotencyKey, idempotencyKey))
  .limit(1);

if (existing) {
  return existing; // Idempotent response
}

// Process new transaction...
```

## 6.5 Audit Trail

### Required Fields for All Token Operations

| Field             | Description            | Required |
| ----------------- | ---------------------- | -------- |
| `id`              | Unique UUID            | ✅       |
| `user_id`         | User who initiated     | ✅       |
| `type`            | Transaction type       | ✅       |
| `direction`       | Credit or Debit        | ✅       |
| `amount`          | Token amount           | ✅       |
| `status`          | Current status         | ✅       |
| `source`          | Human-readable source  | ✅       |
| `reference_id`    | Related record ID      | ✅       |
| `reference_type`  | Related table name     | ✅       |
| `idempotency_key` | Unique idempotency key | ✅       |
| `metadata`        | Additional data        | ✅       |
| `created_at`      | Timestamp              | ✅       |

---

# 7. EVENT-DRIVEN ARCHITECTURE

## 7.1 Event Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EVENT FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐      ┌──────────────┐      ┌──────────────────┐    │
│  │  SOURCE   │ ───▶ │   EVENT      │ ───▶ │    MESSAGE       │    │
│  │  SERVICE  │      │   PUBLISHER  │      │    QUEUE         │    │
│  └───────────┘      └──────────────┘      └────────┬─────────┘    │
│                                                     │              │
│  ┌─────────────────────────────────────────────────┐│              │
│  │              EVENT CONSUMERS                    ││              │
│  ├─────────────────────────────────────────────────┤│              │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ ││              │
│  │  │  ANALYTICS  │  │ NOTIFICATIONS│  │  CACHE  │ │◀┘             │
│  │  └─────────────┘  └─────────────┘  └─────────┘ │               │
│  ├─────────────────────────────────────────────────┤               │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │               │
│  │  │   LEADERBOARD│  │   EMAIL     │  │  SEARCH │ │               │
│  │  └─────────────┘  └─────────────┘  └─────────┘ │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 7.2 Domain Events

### User Events

```typescript
"user.registered";
"user.verified";
"user.suspended";
"user.deleted";
```

### Payment Events

```typescript
"payment.created";
"payment.succeeded";
"payment.failed";
"payment.refunded";
"payment.chargeback";
```

### Purchase Events

```typescript
"purchase.created";
"purchase.completed";
"purchase.refunded";
```

### Entitlement Events

```typescript
"entitlement.activated";
"entitlement.expired";
"entitlement.revoked";
```

### Submission Events

```typescript
"submission.created";
"submission.published";
"submission.featured";
"submission.expired";
"submission.rejected";
"submission.deleted";
```

### Vote Events

```typescript
"vote.cast";
"vote.changed";
"vote.rejected";
```

### Token Events

```typescript
"token.earned";
"token.spent";
"token.gifted";
"token.expired";
"token.reversed";
```

### Ad Events

```typescript
"ad.impression";
"ad.click";
"ad.completed";
"ad.reward_pending";
"ad.reward_confirmed";
"ad.reward_reversed";
```

### Campaign Events

```typescript
"campaign.created";
"campaign.approved";
"campaign.rejected";
"campaign.active";
"campaign.paused";
"campaign.completed";
```

### Moderation Events

```typescript
"moderation.flagged";
"moderation.approved";
"moderation.rejected";
"moderation.appealed";
"moderation.appeal_approved";
```

---

# 8. DATABASE SCHEMA

## 8.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GILO BUSINESS ERD                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │    users    │─────────│  verifications│         │  polls     │           │
│  └─────────────┘         └─────────────┘         └──────┬──────┘           │
│         │                  │                           │                   │
│         │                  │                           │                   │
│         ▼                  ▼                           ▼                   │
│  ┌─────────────┐    ┌─────────────┐            ┌─────────────┐            │
│  │    votes    │    │    polls    │────────────│   options   │            │
│  └─────────────┘    └─────────────┘            └─────────────┘            │
│         │                  │                   │                           │
│         │                  ▼                   │                           │
│         │           ┌─────────────┐            │                           │
│         │           │ submissions │            │                           │
│         │           └─────────────┘            │                           │
│         │                  │                   │                           │
│         ▼                  ▼                   ▼                           │
│  ┌─────────────┐    ┌─────────────┐            ┌─────────────┐            │
│  │ token       │    │ purchases   │            │ payments    │            │
│  │ accounts    │    └─────────────┘            └─────────────┘            │
│  └─────────────┘         │                   │                           │
│         │                ▼                   │                           │
│         ▼          ┌─────────────┐            │                           │
│  ┌─────────────┐    │ entitlements│            │                           │
│  │ token       │    └─────────────┘            │                           │
│  │ transactions│                               │                           │
│  └─────────────┘                               │                           │
│         │                                      │                           │
│         ▼                                      ▼                           │
│  ┌─────────────┐                         ┌─────────────┐                   │
│  │ token_lots  │                         │ campaigns   │                   │
│  └─────────────┘                         └─────────────┘                   │
│                                                  │                         │
│         ┌─────────────┐                         ▼                         │
│         │ token       │                  ┌─────────────┐                   │
│         │ transaction │                  │  creatives  │                   │
│         │ items       │                  └─────────────┘                   │
│         └─────────────┘                         │                         │
│                                                  ▼                         │
│                                           ┌─────────────┐                 │
│                                           │ impressions │                 │
│                                           └─────────────┘                 │
│                                                  │                         │
│         ┌─────────────┐                         ▼                         │
│         │ audit_logs  │                  ┌─────────────┐                   │
│         └─────────────┘                  │ ad_rewards  │                   │
│                                          └─────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.2 Table Definitions (PostgreSQL)

### 8.2.1 Users & Identity

#### Table: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    trust_score INTEGER DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
    is_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_b2b_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    role VARCHAR(30) DEFAULT 'user' CHECK (role IN ('user', 'team_lead', 'admin', 'enterprise_admin')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_trust_score ON users(trust_score);
```

#### Table: `verifications`

```sql
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'phone', 'b2b', 'government_id')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    code VARCHAR(10),
    code_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verifications_user_id ON verifications(user_id);
CREATE INDEX idx_verifications_status ON verifications(status);
CREATE UNIQUE INDEX idx_verifications_user_type ON verifications(user_id, type) WHERE status = 'verified';
```

#### Table: `trust_events`

```sql
CREATE TABLE trust_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    score_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_events_user_id ON trust_events(user_id);
CREATE INDEX idx_trust_events_created_at ON trust_events(created_at);
```

---

### 8.2.2 Polls & Voting

#### Table: `polls`

```sql
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('classic', 'quiz', 'duel', 'matrix', 'blind', 'gavel')),
    title VARCHAR(280) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'featured', 'closed', 'archived', 'rejected')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'team', 'private')),
    audience VARCHAR(20) DEFAULT 'all' CHECK (audience IN ('all', 'team', 'b2b', 'custom')),
    audience_custom_config JSONB,
    duration_start TIMESTAMPTZ NOT NULL,
    duration_end TIMESTAMPTZ NOT NULL,
    categories TEXT[] DEFAULT '{}',
    is_bountied BOOLEAN DEFAULT FALSE,
    gavel_config JSONB,
    total_votes INTEGER DEFAULT 0,
    unique_voters INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_polls_creator_id ON polls(creator_id);
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_visibility ON polls(visibility);
CREATE INDEX idx_polls_duration_end ON polls(duration_end) WHERE status = 'active';
CREATE INDEX idx_polls_categories ON polls USING GIN(categories);
```

#### Table: `options`

```sql
CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    image_thumbnail_url TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    votes INTEGER DEFAULT 0,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_options_poll_id ON options(poll_id);
CREATE INDEX idx_options_order ON options(poll_id, "order");
```

#### Table: `votes`

```sql
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0.5 AND weight <= 2.0),
    is_anonymous BOOLEAN DEFAULT FALSE,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    view_duration INTEGER NOT NULL CHECK (view_duration >= 0),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rejected', 'reversed')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);
CREATE INDEX idx_votes_created_at ON votes(created_at);
```

#### Table: `vote_changes`

```sql
CREATE TABLE vote_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    previous_option_id UUID NOT NULL REFERENCES options(id),
    new_option_id UUID NOT NULL REFERENCES options(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vote_changes_vote_id ON vote_changes(vote_id);
```

---

### 8.2.3 Submissions

#### Table: `submissions`

```sql
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    media JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_moderation', 'active', 'featured', 'expired', 'archived', 'rejected')),
    tier VARCHAR(20) CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    views INTEGER DEFAULT 0,
    votes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    ranking INTEGER,
    current_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_submissions_creator_id ON submissions(creator_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_tier ON submissions(tier);
CREATE INDEX idx_submissions_ranking ON submissions(ranking) WHERE status = 'active';
CREATE INDEX idx_submissions_expired_at ON submissions(expired_at);
```

#### Table: `submission_versions`

```sql
CREATE TABLE submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    media JSONB NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    vote_count_reset BOOLEAN DEFAULT FALSE,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_versions_submission_id ON submission_versions(submission_id);
CREATE UNIQUE INDEX idx_submission_versions_number ON submission_versions(submission_id, version_number);
```

---

### 8.2.4 Monetization

#### Table: `tier_configs`

```sql
CREATE TABLE tier_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(20) NOT NULL CHECK (name IN ('bronze', 'silver', 'gold', 'platinum')),
    price_usd DECIMAL(10,2) NOT NULL CHECK (price_usd > 0),
    token_price INTEGER NOT NULL CHECK (token_price > 0),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    starting_position INTEGER NOT NULL CHECK (starting_position BETWEEN 1 AND 100),
    featured_badge BOOLEAN DEFAULT FALSE,
    pin_duration_seconds INTEGER DEFAULT 0,
    watermark_removable BOOLEAN DEFAULT FALSE,
    vote_weight DECIMAL(3,2) DEFAULT 1.0 CHECK (vote_weight >= 1.0),
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tier_configs_is_active ON tier_configs(is_active);
CREATE INDEX idx_tier_configs_effective_from ON tier_configs(effective_from);
```

#### Table: `purchases`

```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_type VARCHAR(30) NOT NULL CHECK (product_type IN ('tier', 'boost', 'subscription')),
    product_id UUID,
    funding_source VARCHAR(20) NOT NULL CHECK (funding_source IN ('cash', 'tokens', 'promo', 'gift')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USD', 'tokens')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'chargeback')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB,
    completed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_product_type ON purchases(product_type);
```

#### Table: `entitlements`

```sql
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('submission_tier', 'visibility_boost', 'feature_access')),
    tier_snapshot JSONB NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'revoked')),
    used BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX idx_entitlements_purchase_id ON entitlements(purchase_id);
CREATE INDEX idx_entitlements_submission_id ON entitlements(submission_id);
CREATE INDEX idx_entitlements_status ON entitlements(status);
CREATE INDEX idx_entitlements_expires_at ON entitlements(expires_at) WHERE status = 'active';
```

#### Table: `payments`

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('stripe', 'paystack', 'flutterwave', 'paypal')),
    provider_payment_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(30) DEFAULT 'created' CHECK (status IN ('created', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'chargeback', 'disputed')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    receipt_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_purchase_id ON payments(purchase_id);
CREATE INDEX idx_payments_provider_payment_id ON payments(provider_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
```

---

### 8.2.5 Token Ledger

#### Table: `token_accounts`

```sql
CREATE TABLE token_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_balance INTEGER DEFAULT 0 CHECK (total_balance >= 0),
    available_balance INTEGER DEFAULT 0 CHECK (available_balance >= 0),
    pending_balance INTEGER DEFAULT 0 CHECK (pending_balance >= 0),
    locked_balance INTEGER DEFAULT 0 CHECK (locked_balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_accounts_user_id ON token_accounts(user_id);
```

#### Table: `token_transactions`

```sql
CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'earn_vote', 'earn_streak', 'earn_referral', 'earn_poll_create',
        'earn_badge', 'earn_ad_reward', 'purchase', 'purchase_bonus',
        'spend_submission', 'spend_boost', 'gift_sent', 'gift_received',
        'expired', 'reversal', 'admin_adjustment'
    )),
    direction VARCHAR(6) NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reversed', 'failed')),
    source TEXT NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ
);

CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_status ON token_transactions(status);
CREATE INDEX idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX idx_token_transactions_reference ON token_transactions(reference_id) WHERE reference_id IS NOT NULL;
```

#### Table: `token_lots`

```sql
CREATE TABLE token_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES token_transactions(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0),
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'partially_consumed', 'expired', 'consumed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_lots_user_id ON token_lots(user_id);
CREATE INDEX idx_token_lots_transaction_id ON token_lots(transaction_id);
CREATE INDEX idx_token_lots_expires_at ON token_lots(expires_at) WHERE status IN ('active', 'partially_consumed');
CREATE INDEX idx_token_lots_status ON token_lots(status);
```

#### Table: `token_transaction_items`

```sql
CREATE TABLE token_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES token_transactions(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES token_lots(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_transaction_items_transaction_id ON token_transaction_items(transaction_id);
CREATE INDEX idx_token_transaction_items_lot_id ON token_transaction_items(lot_id);
```

---

### 8.2.6 Advertising

#### Table: `campaigns`

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('banner', 'interstitial', 'video', 'native', 'carousel', 'rewarded')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'active', 'paused', 'completed')),
    budget_daily DECIMAL(10,2) NOT NULL CHECK (budget_daily > 0),
    budget_campaign DECIMAL(10,2) NOT NULL CHECK (budget_campaign > 0),
    budget_spent DECIMAL(10,2) DEFAULT 0,
    bid_type VARCHAR(3) NOT NULL CHECK (bid_type IN ('cpm', 'cpc', 'cpv')),
    bid_amount DECIMAL(10,4) NOT NULL CHECK (bid_amount > 0),
    targeting JSONB,
    schedule_start TIMESTAMPTZ NOT NULL,
    schedule_end TIMESTAMPTZ NOT NULL,
    time_of_day JSONB,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_advertiser_id ON campaigns(advertiser_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_schedule_start ON campaigns(schedule_start);
CREATE INDEX idx_campaigns_schedule_end ON campaigns(schedule_end);
```

#### Table: `creatives`

```sql
CREATE TABLE creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'html5')),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    cta_text VARCHAR(50) NOT NULL,
    destination_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX idx_creatives_status ON creatives(status);
```

#### Table: `impressions`

```sql
CREATE TABLE impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('banner', 'interstitial', 'video', 'native', 'rewarded')),
    status VARCHAR(20) DEFAULT 'impressed' CHECK (status IN ('impressed', 'clicked', 'completed', 'skipped', 'viewed')),
    revenue_estimated DECIMAL(10,4),
    revenue_confirmed DECIMAL(10,4),
    revenue_currency VARCHAR(3) DEFAULT 'USD',
    viewed_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_impressions_user_id ON impressions(user_id);
CREATE INDEX idx_impressions_campaign_id ON impressions(campaign_id);
CREATE INDEX idx_impressions_creative_id ON impressions(creative_id);
CREATE INDEX idx_impressions_status ON impressions(status);
CREATE INDEX idx_impressions_viewed_at ON impressions(viewed_at);
```

#### Table: `ad_rewards`

```sql
CREATE TABLE ad_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    impression_id UUID NOT NULL REFERENCES impressions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('view', 'click', 'complete')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'confirmed', 'reversed')),
    tokens_awarded INTEGER,
    estimated_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_rewards_user_id ON ad_rewards(user_id);
CREATE INDEX idx_ad_rewards_impression_id ON ad_rewards(impression_id);
CREATE INDEX idx_ad_rewards_status ON ad_rewards(status);
```

---

### 8.2.7 Moderation

#### Table: `moderation_queue`

```sql
CREATE TABLE moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('submission', 'ad', 'comment', 'user', 'poll')),
    resource_id UUID NOT NULL,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'flagged')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority);
CREATE INDEX idx_moderation_queue_resource ON moderation_queue(resource_type, resource_id);
CREATE INDEX idx_moderation_queue_assigned_to ON moderation_queue(assigned_to);
```

#### Table: `moderation_decisions`

```sql
CREATE TABLE moderation_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES moderation_queue(id) ON DELETE CASCADE,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes', 'escalate')),
    decision_maker_id UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    appealable_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moderation_decisions_queue_id ON moderation_decisions(queue_id);
```

#### Table: `appeals`

```sql
CREATE TABLE appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES moderation_decisions(id) ON DELETE CASCADE,
    appellant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    evidence JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_appeals_decision_id ON appeals(decision_id);
CREATE INDEX idx_appeals_appellant_id ON appeals(appellant_id);
CREATE INDEX idx_appeals_status ON appeals(status);
```

---

### 8.2.8 Audit

#### Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'system', 'admin', 'moderator')),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    before JSONB,
    after JSONB,
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## 8.3 Indexes & Performance

### Key Indexes Summary

| Table                | Index                      | Type   | Purpose                  |
| -------------------- | -------------------------- | ------ | ------------------------ |
| `users`              | `(email)`                  | UNIQUE | Authentication lookups   |
| `users`              | `(username)`               | UNIQUE | User search              |
| `polls`              | `(status, duration_end)`   | BTREE  | Active poll queries      |
| `votes`              | `(poll_id, user_id)`       | UNIQUE | Duplicate prevention     |
| `token_transactions` | `(user_id, created_at)`    | BTREE  | Wallet history           |
| `token_lots`         | `(user_id, expires_at)`    | BTREE  | FEFO consumption         |
| `submissions`        | `(status, ranking)`        | BTREE  | Feed ordering            |
| `campaigns`          | `(status, schedule_start)` | BTREE  | Active campaign delivery |
| `impressions`        | `(campaign_id, viewed_at)` | BTREE  | Performance analytics    |
| `audit_logs`         | `(created_at)`             | BTREE  | Compliance queries       |

### Partitioning Strategy

| Table                | Partition Key | Strategy                  |
| -------------------- | ------------- | ------------------------- |
| `votes`              | `created_at`  | Monthly (range partition) |
| `token_transactions` | `created_at`  | Monthly (range partition) |
| `impressions`        | `created_at`  | Monthly (range partition) |
| `audit_logs`         | `created_at`  | Monthly (range partition) |

---

# 9. API ENDPOINTS

## 9.1 Authentication

| Method | Endpoint                           | Description            | Auth |
| ------ | ---------------------------------- | ---------------------- | ---- |
| POST   | `/api/v1/auth/register`            | Register new user      | None |
| POST   | `/api/v1/auth/login`               | Login user             | None |
| POST   | `/api/v1/auth/refresh`             | Refresh JWT token      | None |
| POST   | `/api/v1/auth/logout`              | Logout user            | JWT  |
| POST   | `/api/v1/auth/verify-email`        | Verify email           | None |
| POST   | `/api/v1/auth/resend-verification` | Resend verification    | JWT  |
| POST   | `/api/v1/auth/forgot-password`     | Request password reset | None |
| POST   | `/api/v1/auth/reset-password`      | Reset password         | None |

## 9.2 Poll Management

| Method | Endpoint                    | Description               | Auth |
| ------ | --------------------------- | ------------------------- | ---- |
| GET    | `/api/v1/polls`             | List all accessible polls | JWT  |
| POST   | `/api/v1/polls`             | Create new poll           | JWT  |
| GET    | `/api/v1/polls/:id`         | Get specific poll         | JWT  |
| PUT    | `/api/v1/polls/:id`         | Update poll               | JWT  |
| DELETE | `/api/v1/polls/:id`         | Delete poll               | JWT  |
| POST   | `/api/v1/polls/:id/publish` | Publish poll              | JWT  |
| POST   | `/api/v1/polls/:id/close`   | Close poll early          | JWT  |
| GET    | `/api/v1/polls/feed`        | Get feed polls            | JWT  |
| GET    | `/api/v1/polls/trending`    | Get trending polls        | JWT  |

## 9.3 Voting

| Method | Endpoint                     | Description        | Auth |
| ------ | ---------------------------- | ------------------ | ---- |
| POST   | `/api/v1/polls/:id/vote`     | Cast vote          | JWT  |
| PUT    | `/api/v1/polls/:id/vote`     | Change vote        | JWT  |
| DELETE | `/api/v1/polls/:id/vote`     | Withdraw vote      | JWT  |
| GET    | `/api/v1/polls/:id/results`  | Get poll results   | JWT  |
| GET    | `/api/v1/polls/:id/timeline` | Time-based results | JWT  |
| GET    | `/api/v1/polls/:id/segments` | Segment breakdown  | JWT  |

## 9.4 Submissions

| Method | Endpoint                          | Description            | Auth |
| ------ | --------------------------------- | ---------------------- | ---- |
| GET    | `/api/v1/submissions`             | List submissions       | JWT  |
| POST   | `/api/v1/submissions`             | Create submission      | JWT  |
| GET    | `/api/v1/submissions/:id`         | Get submission         | JWT  |
| PUT    | `/api/v1/submissions/:id`         | Update submission      | JWT  |
| DELETE | `/api/v1/submissions/:id`         | Delete submission      | JWT  |
| POST   | `/api/v1/submissions/:id/publish` | Publish submission     | JWT  |
| GET    | `/api/v1/submissions/feed`        | Get submission feed    | JWT  |
| GET    | `/api/v1/submissions/my`          | Get user's submissions | JWT  |

## 9.5 Token Operations

| Method | Endpoint                  | Description             | Auth |
| ------ | ------------------------- | ----------------------- | ---- |
| GET    | `/api/v1/tokens/balance`  | Get token balance       | JWT  |
| GET    | `/api/v1/tokens/history`  | Get transaction history | JWT  |
| GET    | `/api/v1/tokens/packages` | Get available packages  | JWT  |
| POST   | `/api/v1/tokens/purchase` | Purchase tokens         | JWT  |
| GET    | `/api/v1/tokens/earnings` | Get earning summary     | JWT  |
| POST   | `/api/v1/tokens/gift`     | Gift tokens to user     | JWT  |

## 9.6 Payment Operations

| Method | Endpoint                       | Description             | Auth |
| ------ | ------------------------------ | ----------------------- | ---- |
| POST   | `/api/v1/payments/checkout`    | Create checkout session | JWT  |
| POST   | `/api/v1/payments/webhook`     | Payment webhook         | None |
| GET    | `/api/v1/payments/:id`         | Get payment status      | JWT  |
| GET    | `/api/v1/payments/receipt/:id` | Download receipt        | JWT  |
| POST   | `/api/v1/payments/refund/:id`  | Request refund          | JWT  |

## 9.7 Insights

| Method | Endpoint                                 | Description               | Auth |
| ------ | ---------------------------------------- | ------------------------- | ---- |
| GET    | `/api/v1/insights/me`                    | Get user insights         | JWT  |
| GET    | `/api/v1/insights/compatibility/:userId` | Compatibility with user   | JWT  |
| GET    | `/api/v1/insights/team/:teamId`          | Team analysis             | JWT  |
| GET    | `/api/v1/insights/team/:teamId/members`  | Team member insights      | JWT  |
| POST   | `/api/v1/insights/resolution`            | Generate resolution poll  | JWT  |
| GET    | `/api/v1/insights/archetypes`            | Get archetype definitions | JWT  |

## 9.8 Analytics

| Method | Endpoint                                  | Description              | Auth |
| ------ | ----------------------------------------- | ------------------------ | ---- |
| GET    | `/api/v1/analytics/heatmap/:submissionId` | Visual attention heatmap | JWT  |
| GET    | `/api/v1/analytics/benchmark/:category`   | Market pulse benchmark   | JWT  |
| GET    | `/api/v1/analytics/poll/:pollId`          | Detailed poll analytics  | JWT  |
| GET    | `/api/v1/analytics/export`                | Export analytics         | JWT  |

## 9.9 Admin Operations

| Method | Endpoint                            | Description       | Auth            |
| ------ | ----------------------------------- | ----------------- | --------------- |
| GET    | `/api/v1/admin/users`               | List all users    | Admin           |
| PUT    | `/api/v1/admin/users/:id/suspend`   | Suspend user      | Admin           |
| PUT    | `/api/v1/admin/users/:id/unsuspend` | Unsuspend user    | Admin           |
| PUT    | `/api/v1/admin/users/:id/role`      | Update user role  | Admin           |
| GET    | `/api/v1/admin/metrics`             | Platform metrics  | Admin           |
| GET    | `/api/v1/admin/moderation`          | Moderation queue  | Admin/Moderator |
| PUT    | `/api/v1/admin/moderation/:id`      | Review moderation | Admin/Moderator |
| POST   | `/api/v1/admin/tiers`               | Create tier       | Admin           |
| PUT    | `/api/v1/admin/tiers/:id`           | Update tier       | Admin           |
| DELETE | `/api/v1/admin/tiers/:id`           | Delete tier       | Admin           |

## 9.10 Export Operations

| Method | Endpoint                       | Description            | Auth |
| ------ | ------------------------------ | ---------------------- | ---- |
| GET    | `/api/v1/export/pdf/:pollId`   | Download PDF report    | JWT  |
| GET    | `/api/v1/export/gif/:pollId`   | Download GIF animation | JWT  |
| GET    | `/api/v1/export/csv/:pollId`   | Download CSV data      | JWT  |
| GET    | `/api/v1/export/embed/:pollId` | Get embed code         | JWT  |

---

# 10. SECURITY & COMPLIANCE

## 10.1 GDPR/CCPA Compliance

| Requirement        | Implementation                                                 |
| ------------------ | -------------------------------------------------------------- |
| Right to Access    | GET `/api/v1/privacy/data` returns all user data               |
| Right to Erasure   | DELETE `/api/v1/privacy/erase` deletes all user data (30 days) |
| Data Portability   | GET `/api/v1/privacy/export` downloads `.zip` of all data      |
| Consent Management | PUT `/api/v1/privacy/consent` updates data sharing preferences |
| Data Retention     | 12-month default, configurable                                 |
| Data Minimization  | Only collect essential data; aggregated for benchmarks         |

### Data Retention Policy

| Data Type          | Retention Period | Notes                                |
| ------------------ | ---------------- | ------------------------------------ |
| User profile       | Until deletion   | Deleted on request                   |
| Poll results       | 36 months        | Aggregated after 36 months           |
| Votes              | 36 months        | Anonymized after 36 months           |
| Token transactions | 7 years          | Financial audit requirement          |
| Audit logs         | 7 years          | Compliance requirement               |
| Deleted accounts   | 30 days          | Soft delete; permanent after 30 days |

## 10.2 RBAC Matrix

| Role                 | Permissions                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **Standard User**    | Create polls, vote, view own insights, view public analytics, manage submissions         |
| **Team Lead**        | Create teams, manage team members, view team insights, create team polls                 |
| **Admin**            | All user permissions + platform health, moderation, raw anonymized data, user suspension |
| **Enterprise Admin** | All admin + white-label settings, custom branding, custom reports                        |
| **Moderator**        | Content moderation, review queue, approve/reject content                                 |
| **Advertiser**       | Create campaigns, view campaign analytics, manage creatives                              |

### Role Check Implementation

```typescript
interface Roles {
  USER: "user";
  TEAM_LEAD: "team_lead";
  ADMIN: "admin";
  ENTERPRISE_ADMIN: "enterprise_admin";
  MODERATOR: "moderator";
  ADVERTISER: "advertiser";
}

function checkPermission(user: User, requiredRole: string): boolean {
  const roleHierarchy = {
    user: 0,
    team_lead: 1,
    moderator: 2,
    advertiser: 2,
    admin: 3,
    enterprise_admin: 4,
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}
```

## 10.3 Data Visibility Rules

| Data                       | Who Can See      |
| -------------------------- | ---------------- |
| User's own votes           | User only        |
| Team votes (aggregated)    | Team members     |
| Team votes (individual)    | Team Lead        |
| Company votes (aggregated) | Enterprise Admin |
| Anonymized benchmark data  | All users        |
| Raw vote data              | Admin only       |

## 10.4 Audit Logging

### Required Logging Events

| Category           | Events                                                            |
| ------------------ | ----------------------------------------------------------------- |
| **Authentication** | Login, logout, password reset, registration, verification         |
| **Financial**      | Payments, refunds, token transactions, token purchases            |
| **Content**        | Poll creation, voting, commenting, submission creation            |
| **Moderation**     | Content flagged, approved, rejected, appeals                      |
| **Admin**          | User suspension, role changes, platform configuration             |
| **Security**       | Failed login attempts, suspicious activity, rate limit violations |

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor UUID NOT NULL,              -- User ID or "system"
    actor_type VARCHAR(20) NOT NULL,  -- 'user' | 'system' | 'admin' | 'moderator'
    action VARCHAR(255) NOT NULL,     -- 'user.login' | 'payment.refunded'
    resource_type VARCHAR(50) NOT NULL, -- 'user' | 'poll' | 'payment'
    resource_id UUID NOT NULL,
    before JSONB,                      -- Previous state (if applicable)
    after JSONB,                       -- New state (if applicable)
    reason TEXT,                       -- Optional reason/notes
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 11. FRAUD PREVENTION

## 11.1 Trust Score System

### Implementation

```typescript
async function calculateTrustScore(userId: string): Promise<number> {
  const user = await getUser(userId);
  const activities = await getUserActivities(userId);
  const devices = await getUserDevices(userId);

  let score = 0;

  // Account age: 1 point per day, max 20
  const days = Math.floor((Date.now() - user.createdAt) / 86400000);
  score += Math.min(days, 20);

  // Verification checks
  if (user.isVerified) score += 10;
  if (user.isPhoneVerified) score += 15;
  if (user.isB2BVerified) score += 20;

  // Payment history: +5 per successful payment, max 20
  const payments = await getSuccessfulPayments(userId);
  score += Math.min(payments.length * 5, 20);

  // Voting consistency: check for patterns
  const votes = await getVotes(userId);
  if (votes.length > 50) {
    const categories = await getVotedCategories(userId);
    if (categories.length > 3) score += 10; // Diversity
    if (isConsistentVoter(votes)) score += 5;
  }

  // Referral quality: check referred users
  const referrals = await getReferrals(userId);
  const verifiedReferrals = referrals.filter(
    (r) => r.isVerified && r.trustScore > 30,
  );
  score += Math.min(verifiedReferrals.length * 2, 10);

  // Penalties
  if (hasFraudFlag(userId)) score -= 20;
  if (isSuspiciousIP(user.ip)) score -= 20;
  if (hasKnownFraudDevice(devices)) score -= 20;

  // Clamp
  return Math.max(0, Math.min(100, score));
}
```

## 11.2 Vote Validation Checks

### Implementation

```typescript
async function validateVote(
  request: VoteRequest,
): Promise<VoteValidationResult> {
  const checks = [];

  // 1. Unique voter check
  const existingVote = await getVoteByUserAndPoll(
    request.userId,
    request.pollId,
  );
  if (existingVote) {
    return { valid: false, reason: "DUPLICATE_VOTE" };
  }

  // 2. View duration check (minimum 30 seconds)
  const viewDuration = await getPollViewDuration(
    request.userId,
    request.pollId,
  );
  if (viewDuration < 30) {
    return { valid: false, reason: "VIEW_DURATION_TOO_SHORT" };
  }

  // 3. Device verification
  const deviceCheck = await validateDevice(request.userId, request.deviceId);
  if (!deviceCheck.valid) {
    return { valid: false, reason: "INVALID_DEVICE" };
  }

  // 4. IP reputation
  const ipCheck = await checkIPReputation(request.ip);
  if (ipCheck.blocked) {
    return { valid: false, reason: "IP_BLOCKED" };
  }

  // 5. Vote velocity
  const recentVotes = await getRecentVotes(request.userId, 60); // Last 60 seconds
  if (recentVotes.length > 5) {
    return { valid: false, reason: "VOTE_VELOCITY_EXCEEDED" };
  }

  // 6. Account age
  const user = await getUser(request.userId);
  if (Date.now() - user.createdAt < 3600000) {
    // 1 hour
    return { valid: false, reason: "ACCOUNT_TOO_NEW" };
  }

  // 7. Poll status
  const poll = await getPoll(request.pollId);
  if (poll.status !== "active") {
    return { valid: false, reason: "POLL_NOT_ACTIVE" };
  }

  return { valid: true };
}
```

## 11.3 Rate Limiting

### Configuration

| Endpoint                  | Rate Limit | Window    |
| ------------------------- | ---------- | --------- |
| `/api/v1/auth/register`   | 5          | 1 hour    |
| `/api/v1/auth/login`      | 10         | 5 minutes |
| `/api/v1/polls/:id/vote`  | 10         | 1 minute  |
| `/api/v1/polls` (POST)    | 10         | 1 hour    |
| `/api/v1/comments`        | 10         | 5 minutes |
| `/api/v1/tokens/purchase` | 3          | 1 hour    |
| `/api/v1/tokens/gift`     | 5          | 1 hour    |

### Implementation

```typescript
const rateLimits = {
  "auth.register": { points: 5, duration: 3600 },
  "auth.login": { points: 10, duration: 300 },
  "vote.cast": { points: 10, duration: 60 },
  "poll.create": { points: 10, duration: 3600 },
  "comment.create": { points: 10, duration: 300 },
  "token.purchase": { points: 3, duration: 3600 },
  "token.gift": { points: 5, duration: 3600 },
};
```

## 11.4 Referral Fraud Detection

### Implementation

```typescript
async function validateReferral(
  refereeId: string,
  referrerId: string,
): Promise<ValidationResult> {
  // Check if referee is already referred
  const existingReferral = await getReferral(refereeId);
  if (existingReferral) {
    return { valid: false, reason: "ALREADY_REFERRED" };
  }

  // Check if referee has same IP/device as referrer
  const ref = await getUser(refereeId);
  const refDevice = await getDevice(refereeId);
  const referrerDevice = await getDevice(referrerId);

  if (ref.ip === referrer.ip || refDevice.id === referrerDevice.id) {
    return { valid: false, reason: "SELF_REFERRAL" };
  }

  // Check referrer's trust score
  const referrer = await getUser(referrerId);
  if (referrer.trustScore < 30) {
    return { valid: false, reason: "REFERRER_NOT_TRUSTED" };
  }

  // Check if referee is a real user
  if (ref.status === "suspended" || ref.status === "deleted") {
    return { valid: false, reason: "INVALID_REFEREE" };
  }

  return { valid: true };
}
```

---

# 12. APPENDIX: GLOSSARY

| Term                        | Definition                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| **Vibe Insight**            | AI-generated psychographic analysis of user preferences            |
| **The Gavel**               | Weighted voting system where certain users have more voting power  |
| **Bountied Poll**           | Poll with a prize for the user whose vote matches the final result |
| **Market Pulse**            | Aggregate benchmarking against industry averages                   |
| **Luminous Theme**          | Light, premium UI design system                                    |
| **The Verdict**             | Results and share cards after a poll ends                          |
| **The Decision Studio**     | Poll creation interface                                            |
| **Audience Overlay**        | Filter to see results by specific demographics                     |
| **Vibe Alignment Report**   | Detailed compatibility analysis between users                      |
| **Collective Polarity Map** | Team alignment heatmap                                             |
| **Trust Score**             | 0-100 score indicating user legitimacy                             |
| **Entitlement**             | Time-bound right granted by a purchase                             |
| **FEFO**                    | First Expiring, First Out token consumption                        |
| **Idempotency Key**         | Unique key to prevent duplicate operations                         |

---

# 13. APPENDIX: COMPLETE PRIORITY MATRIX

| Feature                    | MVP | Beta | Full | Priority |
| -------------------------- | --- | ---- | ---- | -------- |
| **Identity**               |     |      |      |          |
| User Registration          | ✅  | ✅   | ✅   | P0       |
| Email Verification         | ✅  | ✅   | ✅   | P0       |
| Trust Score (Basic)        | ✅  | ✅   | ✅   | P0       |
| Phone Verification         | ⬜  | ✅   | ✅   | P1       |
| B2B Verification           | ⬜  | ✅   | ✅   | P1       |
| **Polls**                  |     |      |      |          |
| Poll Creation              | ✅  | ✅   | ✅   | P0       |
| Poll Voting (Classic)      | ✅  | ✅   | ✅   | P0       |
| Poll Results               | ✅  | ✅   | ✅   | P0       |
| Poll Types (Quiz, Duel)    | ⬜  | ✅   | ✅   | P1       |
| Poll Types (Matrix, Blind) | ⬜  | ⬜   | ✅   | P2       |
| The Gavel                  | ⬜  | ✅   | ✅   | P1       |
| **Submissions**            |     |      |      |          |
| Submission Creation        | ✅  | ✅   | ✅   | P0       |
| Submission Tiers           | ✅  | ✅   | ✅   | P0       |
| Submission Ranking         | ✅  | ✅   | ✅   | P0       |
| Submission Analytics       | ⬜  | ✅   | ✅   | P1       |
| **Token Economy**          |     |      |      |          |
| Token Earning              | ✅  | ✅   | ✅   | P0       |
| Token Spending             | ✅  | ✅   | ✅   | P0       |
| Token Wallet               | ✅  | ✅   | ✅   | P0       |
| Token Purchase             | ✅  | ✅   | ✅   | P0       |
| Token Ledger               | ✅  | ✅   | ✅   | P0       |
| Gift Tokens                | ⬜  | ✅   | ✅   | P1       |
| **Payments**               |     |      |      |          |
| Stripe Integration         | ✅  | ✅   | ✅   | P0       |
| Paystack Integration       | ✅  | ✅   | ✅   | P0       |
| Payment Webhooks           | ✅  | ✅   | ✅   | P0       |
| Receipt Generation         | ⬜  | ✅   | ✅   | P1       |
| Refund Processing          | ⬜  | ✅   | ✅   | P1       |
| **Advertising**            |     |      |      |          |
| Ad Serving                 | ⬜  | ✅   | ✅   | P1       |
| Revenue Sharing            | ⬜  | ✅   | ✅   | P1       |
| Advertiser Dashboard       | ⬜  | ✅   | ✅   | P1       |
| Ad Moderation              | ⬜  | ✅   | ✅   | P1       |
| Programmatic Ads           | ⬜  | ⬜   | ✅   | P2       |
| **Vibe Insights**          |     |      |      |          |
| Individual Insights        | ⬜  | ✅   | ✅   | P1       |
| Team Analysis              | ⬜  | ✅   | ✅   | P1       |
| Resolution Polls           | ⬜  | ✅   | ✅   | P1       |
| Market Pulse               | ⬜  | ✅   | ✅   | P1       |
| **Moderation**             |     |      |      |          |
| Content Flagging           | ✅  | ✅   | ✅   | P0       |
| Moderation Queue           | ✅  | ✅   | ✅   | P0       |
| Moderation Decisions       | ✅  | ✅   | ✅   | P0       |
| Appeals System             | ⬜  | ✅   | ✅   | P1       |
| **Security**               |     |      |      |          |
| Rate Limiting              | ✅  | ✅   | ✅   | P0       |
| Audit Logging              | ✅  | ✅   | ✅   | P0       |
| Fraud Detection            | ⬜  | ✅   | ✅   | P1       |
| GDPR/CCPA Compliance       | ⬜  | ✅   | ✅   | P1       |

---

_End of Gilo Business Technical Requirements Document (TRD)_

**Ready for Engineering Implementation. Ready for Database Design. Ready for API Development.**
