# GILO BUSINESS: REVISED ECONOMIC MODEL & ARCHITECTURE

## Based on Production Review "Grill" - v2.0

---

# 1. EXECUTIVE SUMMARY

The production review identified **15 critical issues** with the original Vote-to-Earn + AdRank system. The core problem is that the original design created a **circular economy** where voting activity could manufacture advertising value and potentially generate unsustainable liabilities for the platform.

This document presents the **revised economic model and architecture** that fixes all identified issues while preserving the engagement mechanics that make the system compelling.

---

# 2. THE FUNDAMENTAL SHIFT

## 2.1 Before vs. After

| Aspect               | Original (Flawed)                  | Revised (Fixed)                                                 |
| -------------------- | ---------------------------------- | --------------------------------------------------------------- |
| **Voting → AdRank**  | Direct: 50% of AdRank              | Indirect: Limited influence via VoterScore                      |
| **AdRank → Revenue** | Direct: Higher AdRank = More views | Indirect: AdRank based on ad quality, not voter activity        |
| **Revenue → User**   | 70% of gross revenue               | Percentage of net revenue after costs                           |
| **Voting → Money**   | Direct path                        | Indirect: Voting increases eligibility, not guaranteed earnings |
| **Economic Model**   | "Vote to earn money"               | "Engage to earn eligibility, ads generate revenue"              |

## 2.2 The New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIVE INDEPENDENT ENGINES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        1. VOTING ENGINE                                ││
│  │                                                                         ││
│  │  • Vote counting          • Streaks          • Challenges              ││
│  │  • Rate limiting          • Daily caps       • Vote validation          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        2. TRUST ENGINE                                 ││
│  │                                                                         ││
│  │  • Fraud detection        • Device reputation  • Behavior analysis     ││
│  │  • IP reputation          • Account age        • Referral graph        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      3. REPUTATION ENGINE                               ││
│  │                                                                         ││
│  │  • VoterScore (0-1000)    • Badges            • Leaderboards           ││
│  │  • Eligibility            • Tiers             • Reward multipliers      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      4. AD RANKING ENGINE                               ││
│  │                                                                         ││
│  │  • Ad quality score       • CTR               • Conversion             ││
│  │  • Relevance              • Advertiser budget  • Audience fit          ││
│  │  • Limited VoterScore influence (max 10%)                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        5. REWARD ENGINE                                 ││
│  │                                                                         ││
│  │  • Qualified revenue      • Reward pool        • User allocation       ││
│  │  • Fraud reserves         • Pending rewards    • Withdrawals           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. THE REVISED ECONOMIC MODEL

## 3.1 Money Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONEY FLOW DIAGRAM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                       │
│  │   ADVERTISER    │                                                       │
│  │   SPENDS $100   │                                                       │
│  └────────┬────────┘                                                       │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     GROSS ADVERTISER SPEND                           │   │
│  │                              $100                                    │   │
│  └────────┬────────────────────────────────────────────────────────────┘   │
│           │                                                                │
│           ├─────────────────────────────────────────────────────────────┐  │
│           │                                                             │  │
│           ▼                                                             ▼  │
│  ┌──────────────────────┐                              ┌────────────────┐  │
│  │   DEDUCTIONS         │                              │  PLATFORM      │  │
│  │                      │                              │  REVENUE       │  │
│  │  • Taxes: $10        │                              │  $20           │  │
│  │  • Payment fees: $5  │                              │  (20%)         │  │
│  │  • Invalid traffic:  │                              │                │  │
│  │    $5                │                              │                │  │
│  │  • Platform costs:   │                              │                │  │
│  │    $10               │                              │                │  │
│  │                      │                              │                │  │
│  │  Total: $30          │                              │                │  │
│  └──────────────────────┘                              └────────────────┘  │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     NET ADVERTISING REVENUE                          │   │
│  │                              $50                                     │   │
│  └────────┬────────────────────────────────────────────────────────────┘   │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         REWARD POOL                                  │   │
│  │                              $50                                     │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │  • User Rewards: $40 (80%)                                     ││   │
│  │  │  • Fraud Reserve: $5 (10%)                                     ││   │
│  │  │  • Platform Reserve: $5 (10%)                                  ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  └────────┬────────────────────────────────────────────────────────────┘   │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       USER DISTRIBUTION                             │   │
│  │                                                                      │   │
│  │  Distributed to eligible users based on:                            │   │
│  │  • VoterScore (engagement quality)                                  │   │
│  │  • Trust Score (fraud resistance)                                   │   │
│  │  • Ad ID contribution (if applicable)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Revised Revenue Split

| Component              | Percentage | Notes                               |
| ---------------------- | ---------- | ----------------------------------- |
| **Taxes**              | ~10%       | Payable to government               |
| **Payment Processing** | ~5%        | Stripe, Paystack fees               |
| **Invalid Traffic**    | ~5%        | Ads shown to bots/fraud             |
| **Platform Costs**     | ~10%       | Infrastructure, moderation, support |
| **Platform Revenue**   | ~20%       | Gilo's net margin                   |
| **Fraud Reserve**      | ~5%        | Held for fraud chargebacks          |
| **Platform Reserve**   | ~5%        | Held for operational buffer         |
| **User Rewards**       | ~40%       | Distributed to eligible users       |

### Important Change

The user reward share is now **calculated from net revenue**, not gross revenue. And the percentage is **40%, not 70%**.

The original 70% share would have bankrupted the platform.

---

# 4. THE REVISED AD RANK SYSTEM

## 4.1 AdRank Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AD RANK COMPONENTS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │    AD_RANK = (AD_QUALITY × 0.40) +                                   │   │
│  │              (ADVERTISER_BUDGET × 0.25) +                           │   │
│  │              (RELEVANCE × 0.20) +                                   │   │
│  │              (AUDIENCE_FIT × 0.10) +                                │   │
│  │              (VOTER_INFLUENCE × 0.05)                               │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Component               │ Weight  │ Description                     │   │
│  │──────────────────────────┼─────────┼─────────────────────────────────│   │
│  │  AD_QUALITY              │ 40%     │ CTR, conversion, engagement     │   │
│  │  ADVERTISER_BUDGET       │ 25%     │ How much advertiser is spending │   │
│  │  RELEVANCE               │ 20%     │ Match with viewer interests     │   │
│  │  AUDIENCE_FIT            │ 10%     │ Target audience match           │   │
│  │  VOTER_INFLUENCE         │ 5%      │ Voter's engagement level        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Voter Influence on AdRank (Limited to 5%)

The voter's engagement level influences AdRank by **at most 5%**. This prevents voting activity from dominating ad visibility.

```
VOTER_INFLUENCE = VoterScore / 1000 × 0.05

Where:
- VoterScore ranges from 0-1000
- Max influence = 0.05 (5%)
- Min influence = 0

Example:
- VoterScore = 800 → VOTER_INFLUENCE = 0.04 (4%)
- VoterScore = 500 → VOTER_INFLUENCE = 0.025 (2.5%)
- VoterScore = 200 → VOTER_INFLUENCE = 0.01 (1%)
```

## 4.3 Ad Quality Score Calculation

```
AD_QUALITY = (CTR_RATE × 0.30) +
             (CONVERSION_RATE × 0.30) +
             (ENGAGEMENT_RATE × 0.20) +
             (ADVERTISER_REPUTATION × 0.20)

Where:
- CTR_RATE: Click-through rate (0-100%)
- CONVERSION_RATE: Conversion rate (0-100%)
- ENGAGEMENT_RATE: Time spent, interactions
- ADVERTISER_REPUTATION: Historical performance
```

---

# 5. THE REVISED VOTER SCORE SYSTEM

## 5.1 VoterScore Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VOTER SCORE COMPONENTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │    VOTER_SCORE = (VOTE_VOLUME × 0.20) +                             │   │
│  │                  (VOTE_DIVERSITY × 0.15) +                          │   │
│  │                  (VOTE_CONSISTENCY × 0.15) +                        │   │
│  │                  (STREAK_LENGTH × 0.15) +                           │   │
│  │                  (ENGAGEMENT_DEPTH × 0.15) +                        │   │
│  │                  (TRUST_SCORE × 0.20)                               │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Component               │ Weight  │ Max Score  │ Description       │   │
│  │──────────────────────────┼─────────┼────────────┼───────────────────│   │
│  │  VOTE_VOLUME             │ 20%     │ 200        │ Total votes       │   │
│  │  VOTE_DIVERSITY          │ 15%     │ 150        │ Categories voted  │   │
│  │  VOTE_CONSISTENCY        │ 15%     │ 150        │ Regular pattern   │   │
│  │  STREAK_LENGTH           │ 15%     │ 150        │ Consecutive days  │   │
│  │  ENGAGEMENT_DEPTH        │ 15%     │ 150        │ Dwell time, depth │   │
│  │  TRUST_SCORE             │ 20%     │ 200        │ Fraud resistance  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 VoterScore Tiers

| Tier         | Score Range | Badge | Reward Multiplier |
| ------------ | ----------- | ----- | ----------------- |
| **Bronze**   | 0-199       | 🥉    | 1.0×              |
| **Silver**   | 200-399     | 🥈    | 1.2×              |
| **Gold**     | 400-599     | 🏅    | 1.5×              |
| **Platinum** | 600-799     | ⭐    | 2.0×              |
| **Diamond**  | 800-1000    | 💎    | 3.0×              |

---

# 6. REVISED VOTING LIMITS

## 6.1 Progressive Limits Based on Trust

| Trust Level          | Votes/Minute | Votes/Hour | Votes/Day |
| -------------------- | ------------ | ---------- | --------- |
| **Unknown** (0-19)   | 1            | 5          | 10        |
| **Basic** (20-49)    | 2            | 10         | 25        |
| **Verified** (50-74) | 3            | 15         | 50        |
| **Trusted** (75-100) | 5            | 30         | 100       |

## 6.2 Why This Matters

Users with higher trust scores can vote more because they've proven they're not bots. This naturally limits farming while rewarding genuine users.

---

# 7. REVISED LEADERBOARD SYSTEM

## 7.1 Leaderboard Types

| Leaderboard  | Reset Period   | Reward                     | Purpose                |
| ------------ | -------------- | -------------------------- | ---------------------- |
| **Daily**    | Every 24h      | 10 tokens                  | Short-term engagement  |
| **Weekly**   | Every Monday   | 100 tokens + multiplier    | Medium-term engagement |
| **Monthly**  | First of month | 500 tokens + 2× multiplier | Long-term engagement   |
| **All-Time** | Never          | Badges only                | Historical recognition |

## 7.2 Weekly Leaderboard Rewards

| Rank        | Reward       | Bonus                      |
| ----------- | ------------ | -------------------------- |
| **🥇 1**    | 1,000 tokens | 2× VoterScore for 7 days   |
| **🥈 2-3**  | 500 tokens   | 1.5× VoterScore for 5 days |
| **🥉 4-10** | 250 tokens   | 1.2× VoterScore for 3 days |
| **11-50**   | 100 tokens   | -                          |
| **51-100**  | 50 tokens    | -                          |

## 7.3 Leaderboard Decay

To prevent the "rich-get-richer" problem:

- Weekly leaderboard resets every Monday
- Monthly leaderboard resets on the 1st
- All-time leaderboard requires consistent performance
- 50% of VoterScore decays after 7 days of inactivity

---

# 8. REVISED AD ID SYSTEM

## 8.1 How Ad ID Works (Fixed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AD ID SYSTEM (REVISED)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  AD ID: VOTER_123                                                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  QUALIFIED REFERRALS ONLY                                       │ │   │
│  │  │                                                                  │ │   │
│  │  │  • Referral must be a real user (verified email)                │ │   │
│  │  │  • Referral must be active (>10 votes/day for 7 days)           │ │   │
│  │  │  • Referral must be in a different device/IP cluster            │ │   │
│  │  │  • Referral must not be a duplicate account                     │ │   │
│  │  │  • Maximum 5 qualified referrals per user                       │ │   │
│  │  │  • Each qualified referral = +5 VoterScore points               │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  UNQUALIFIED REFERRALS                                          │ │   │
│  │  │                                                                  │ │   │
│  │  │  • Referrals that don't meet requirements                       │ │   │
│  │  │  • No VoterScore benefit                                        │ │   │
│  │  │  • No AdRank benefit                                            │ │   │
│  │  │  • May trigger fraud review                                     │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Ad ID Rules (Fixed)

| Rule                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| **Qualified Referral** | Real user, verified email, active, unique device |
| **Max Referrals**      | 5 qualified referrals per user                   |
| **VoterScore Impact**  | +5 per qualified referral (max +25)              |
| **AdRank Impact**      | 0% (removed entirely)                            |
| **Fraud Prevention**   | Graph analysis to detect referral rings          |

---

# 9. REVISED REWARD DISTRIBUTION

## 9.1 Reward Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REWARD DISTRIBUTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Calculate Qualified Revenue                                       │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  QUALIFIED_REVENUE = Gross_Ad_Spend - Deductions                           │
│                                                                             │
│  Deductions:                                                               │
│  • Taxes (10%)                                                             │
│  • Payment fees (5%)                                                       │
│  • Invalid traffic (5%)                                                    │
│  • Platform costs (10%)                                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  Step 2: Allocate to Reward Pool                                           │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  REWARD_POOL = QUALIFIED_REVENUE × 80%                                     │
│                                                                             │
│  • User Rewards: 60% of QUALIFIED_REVENUE                                  │
│  • Fraud Reserve: 10% of QUALIFIED_REVENUE                                 │
│  • Platform Reserve: 10% of QUALIFIED_REVENUE                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  Step 3: Distribute to Users                                               │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  USER_SHARE = (USER_VOTER_SCORE / TOTAL_VOTER_SCORE) × USER_REWARDS        │
│                                                                             │
│  Where:                                                                    │
│  • USER_VOTER_SCORE = VoterScore × Trust_Multiplier                        │
│  • Trust_Multiplier = 0.5-1.0 based on Trust Score                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Example Calculation

```
Advertiser Spend: $1,000
─────────────────────────────
Deductions:
• Taxes (10%): $100
• Payment fees (5%): $50
• Invalid traffic (5%): $50
• Platform costs (10%): $100
─────────────────────────────
Qualified Revenue: $700
─────────────────────────────
Reward Pool Allocation:
• User Rewards (60%): $420
• Fraud Reserve (10%): $70
• Platform Reserve (10%): $70
─────────────────────────────
Distribution (10,000 users):
Total VoterScore: 500,000
User with VoterScore 800:
  Share = (800 / 500,000) × $420
  Share = $0.672
─────────────────────────────
Monthly Earnings: ~$20
```

---

# 10. REVISED ANTI-FRAUD SYSTEM

## 10.1 Multi-Layer Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ANTI-FRAUD SYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: Request Validation                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Rate limiting (per IP, per user, per device)                     │   │
│  │  • Request signing (prevent replay attacks)                         │   │
│  │  • IP reputation (block known fraud IPs)                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Layer 2: Behavioral Analysis                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Vote velocity (too many votes too quickly)                       │   │
│  │  • Session quality (time between votes, patterns)                   │   │
│  │  • Category diversity (voting only one category)                    │   │
│  │  • Time patterns (identical intervals)                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Layer 3: Device Intelligence                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Device fingerprinting (one device per account)                   │   │
│  │  • Device reputation (known fraud devices blocked)                  │   │
│  │  • Device aging (new devices lower trust)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Layer 4: Graph Analysis                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Referral graph (detect referral rings)                           │   │
│  │  • Social graph (detect sybil attacks)                              │   │
│  │  • Account relationships (detect multi-account farming)             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Layer 5: Human Review                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Flagged accounts reviewed by moderators                          │   │
│  │  • Appeal process for false positives                               │   │
│  │  • Manual verification for high-value users                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Trust Score Calculation (Revised)

```
TRUST_SCORE = 0-1000

Components:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Component               │ Weight  │ Max Score │ Description               │
│──────────────────────────┼─────────┼───────────┼───────────────────────────│
│  Account Age             │ 15%     │ 150       │ 1 point per day (max 150) │
│  Email Verified          │ 10%     │ 100       │ +100 if verified          │
│  Phone Verified          │ 15%     │ 150       │ +150 if verified          │
│  B2B Verified            │ 10%     │ 100       │ +100 if verified          │
│  Payment History         │ 10%     │ 100       │ +25 per payment (max 100) │
│  Vote Consistency        │ 10%     │ 100       │ Regular voting pattern    │
│  Vote Diversity          │ 10%     │ 100       │ Categories voted          │
│  Device Reputation       │ 10%     │ 100       │ Clean device history      │
│  IP Reputation           │ 10%     │ 100       │ Clean IP history          │
│──────────────────────────┼─────────┼───────────┼───────────────────────────│
│  TOTAL                   │ 100%    │ 1,000     │                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 11. REVISED REVENUE REALISM

## 11.1 Realistic Revenue Estimates

| Scenario       | Votes/Day | Ad Views | CPM   | Daily Revenue | Monthly Revenue |
| -------------- | --------- | -------- | ----- | ------------- | --------------- |
| **Casual**     | 10        | 100      | $2.00 | $0.08         | $2.40           |
| **Active**     | 50        | 500      | $2.00 | $0.40         | $12.00          |
| **Power User** | 100       | 1,000    | $2.00 | $0.80         | $24.00          |

### Important Note

These estimates are based on **realistic CPM rates** ($2-5 per 1,000 impressions). The original document used $40+ CPM, which is unrealistic for most advertising markets.

## 11.2 Revenue Caps

| User Type      | Max Monthly Earnings | Rationale                             |
| -------------- | -------------------- | ------------------------------------- |
| **Casual**     | $5                   | Low engagement, no significant value  |
| **Active**     | $25                  | Moderate engagement, some ad value    |
| **Power User** | $100                 | High engagement, significant ad value |

---

# 12. UPDATED DATABASE SCHEMA

## 12.1 New Tables

### Table: `voter_scores`

```sql
CREATE TABLE voter_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_volume INTEGER DEFAULT 0,
    vote_diversity INTEGER DEFAULT 0,
    vote_consistency INTEGER DEFAULT 0,
    streak_length INTEGER DEFAULT 0,
    engagement_depth INTEGER DEFAULT 0,
    trust_component INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    daily_votes INTEGER DEFAULT 0,
    weekly_votes INTEGER DEFAULT 0,
    monthly_votes INTEGER DEFAULT 0,
    last_vote_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voter_scores_total_score ON voter_scores(total_score DESC);
CREATE INDEX idx_voter_scores_user_id ON voter_scores(user_id);
```

### Table: `ad_rankings_revised`

```sql
CREATE TABLE ad_rankings_revised (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_quality_score INTEGER DEFAULT 0,
    advertiser_budget_score INTEGER DEFAULT 0,
    relevance_score INTEGER DEFAULT 0,
    audience_fit_score INTEGER DEFAULT 0,
    voter_influence_score INTEGER DEFAULT 0,
    total_rank_score INTEGER DEFAULT 0,
    visibility_multiplier DECIMAL(4,2) DEFAULT 1.0,
    ctr DECIMAL(5,2) DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_rankings_revised_total_score ON ad_rankings_revised(total_rank_score DESC);
CREATE INDEX idx_ad_rankings_revised_user_id ON ad_rankings_revised(user_id);
```

### Table: `qualified_impressions`

```sql
CREATE TABLE qualified_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_id UUID NOT NULL REFERENCES campaigns(id),
    view_duration_seconds INTEGER NOT NULL CHECK (view_duration_seconds >= 0),
    viewport_visibility DECIMAL(5,2) NOT NULL CHECK (viewport_visibility >= 0 AND viewport_visibility <= 100),
    is_qualified BOOLEAN DEFAULT FALSE,
    revenue_share DECIMAL(10,4),
    fraud_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qualified_impressions_user_id ON qualified_impressions(user_id);
CREATE INDEX idx_qualified_impressions_ad_id ON qualified_impressions(ad_id);
CREATE INDEX idx_qualified_impressions_is_qualified ON qualified_impressions(is_qualified);
```

---

# 13. UPDATED API ENDPOINTS

| Method | Endpoint                       | Description              | Auth  |
| ------ | ------------------------------ | ------------------------ | ----- |
| GET    | `/api/v1/voter-score`          | Get user's VoterScore    | JWT   |
| GET    | `/api/v1/voter-score/history`  | Get VoterScore history   | JWT   |
| GET    | `/api/v1/ad-rank`              | Get user's AdRank        | JWT   |
| POST   | `/api/v1/ad-rank/recalculate`  | Recalculate AdRank       | Admin |
| GET    | `/api/v1/rewards/eligible`     | Check reward eligibility | JWT   |
| GET    | `/api/v1/rewards/history`      | Get reward history       | JWT   |
| GET    | `/api/v1/rewards/estimated`    | Get estimated rewards    | JWT   |
| GET    | `/api/v1/leaderboard/weekly`   | Get weekly leaderboard   | JWT   |
| GET    | `/api/v1/leaderboard/monthly`  | Get monthly leaderboard  | JWT   |
| GET    | `/api/v1/leaderboard/all-time` | Get all-time leaderboard | JWT   |
| POST   | `/api/v1/trust/verify`         | Submit verification      | JWT   |
| GET    | `/api/v1/trust/status`         | Get trust status         | JWT   |

---

# 14. SUMMARY OF CHANGES

| Original Issue                     | Fix                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| Voting → AdRank directly           | VoterScore → Limited influence (5%)                    |
| AdRank → Revenue directly          | AdRank based on ad quality, not votes                  |
| 70% revenue share                  | 40% of net revenue after deductions                    |
| $40 CPM unrealistic                | $2-5 CPM realistic estimates                           |
| Guaranteed earnings                | Estimated rewards based on actual revenue              |
| Vote farming easy                  | Progressive limits based on trust score                |
| Ad ID farming                      | Qualified referrals only, graph analysis               |
| Rich-get-richer                    | Weekly/monthly leaderboard resets                      |
| Weak anti-fraud                    | Multi-layer detection system                           |
| No qualified impression definition | Clear definition: 50% visible, 1 second, valid session |

---

# 15. NEXT STEPS

| Priority | Task                                    | Owner       | Timeline |
| -------- | --------------------------------------- | ----------- | -------- |
| 1        | Update PRD with revised economic model  | Product     | Day 1    |
| 2        | Update TRD with revised state machines  | Engineering | Day 2    |
| 3        | Update database schema                  | Engineering | Day 3    |
| 4        | Update API endpoints                    | Engineering | Day 4    |
| 5        | Implement revised AdRank algorithm      | Engineering | Week 1   |
| 6        | Implement revised VoterScore algorithm  | Engineering | Week 1   |
| 7        | Implement multi-layer anti-fraud        | Engineering | Week 2   |
| 8        | Implement qualified impression tracking | Engineering | Week 2   |
| 9        | Test economic model with simulations    | QA          | Week 3   |
| 10       | Deploy to staging                       | DevOps      | Week 3   |

---

_End of Revised Economic Model & Architecture_

**Ready for Implementation. Ready for Testing. Ready for Production.**

This version of the system is **economically sustainable, resistant to fraud, and aligned with real advertiser value**. The engagement mechanics remain compelling, but they are now **properly decoupled** from the advertising revenue system.

# GILO BUSINESS: GROUP ADVERTISING & COMPETITIVE PROMOTION SYSTEM

## "Battle of the Brands" - Group-Based Ad Promotion

---

# 1. EXECUTIVE SUMMARY

This feature transforms individual ad promotion into **team-based competitive advertising**. Users join groups representing different advertisers/products and compete against each other. The winning group's members earn rewards based on their contribution.

This creates a **powerful engagement loop** where:

- Advertisers get passionate, organized promotion teams
- Users get a sense of community and belonging
- Competition drives higher engagement
- Everyone earns based on performance

---

# 2. CORE CONCEPT

## 2.1 The "Brand Battle" Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BRAND BATTLE OVERVIEW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │                    TWO ADVERTISERS COMPETE                              ││
│  │                                                                         ││
│  │    ┌─────────────────────┐     ┌─────────────────────┐                 ││
│  │    │    TEAM COCA-COLA   │  VS │    TEAM PEPSI       │                 ││
│  │    │                     │     │                     │                 ││
│  │    │  🥇 Leaderboard    │     │  🥇 Leaderboard    │                 ││
│  │    │  📊 Team Stats     │     │  📊 Team Stats     │                 ││
│  │    │  👥 Members: 500   │     │  👥 Members: 420   │                 ││
│  │    │  📈 Total Votes:   │     │  📈 Total Votes:   │                 ││
│  │    │    12,847          │     │    10,234          │                 ││
│  │    │  🏆 Score: 78%     │     │  🏆 Score: 62%     │                 ││
│  │    └─────────────────────┘     └─────────────────────┘                 ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 How It Works

### For Advertisers

1. **Create a Campaign:** Advertiser creates a campaign and sets a budget
2. **Enable Group Mode:** Advertiser enables group/team competition
3. **Set Rewards:** Advertiser sets reward pool for winning team
4. **Launch:** Campaign goes live with group competition

### For Users

1. **Join a Team:** User picks which advertiser/product to support
2. **Vote/Promote:** User votes on polls while representing their team
3. **Earn Points:** User earns points for their team through activity
4. **Compete:** Team competes against other teams
5. **Win Rewards:** Winning team members earn rewards

---

# 3. GROUP ADVERTISING MODELS

## 3.1 Model Types

| Model               | Description                            | Best For                      |
| ------------------- | -------------------------------------- | ----------------------------- |
| **Head-to-Head**    | Two advertisers compete directly       | Brand comparison, A/B testing |
| **Battle Royale**   | Multiple advertisers compete           | Large campaigns, market share |
| **Coalition**       | Multiple teams collaborate against one | Underdog campaigns            |
| **Seasonal League** | Ongoing competition over weeks/months  | Sustained engagement          |

## 3.2 Head-to-Head Model (Default)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HEAD-TO-HEAD BATTLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐      ┌───────────────────────┐                  │
│  │    TEAM A              │      │    TEAM B              │                  │
│  │    "Brand X"           │      │    "Brand Y"           │                  │
│  │                        │      │                        │                  │
│  │  ████████████████░░░░  │      │  ████████░░░░░░░░░░░░  │                  │
│  │  68% (12,847 votes)   │      │  32% (6,234 votes)    │                  │
│  │                        │      │                        │                  │
│  │  🏆 Leading           │      │  📉 Trailing           │                  │
│  │  🔥 847 active        │      │  💪 534 active         │                  │
│  └───────────────────────┘      └───────────────────────┘                  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ⏱ Time Remaining: 23h:14m:32s                                      │   │
│  │  🏆 Prize Pool: $500                                                │   │
│  │  👥 Total Participants: 1,381                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.3 Battle Royale Model (Multiple Teams)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BATTLE ROYALE - 5 TEAMS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  Rank │ Team          │ Votes    │ Percentage │ Status                  ││
│  │  ─────┼───────────────┼──────────┼────────────┼────────────────────────││
│  │  🥇   │ Team Nike     │ 12,847   │ 34%        │ ████████████░░░░░░░░░ ││
│  │  🥈   │ Team Adidas   │ 10,234   │ 27%        │ ██████████░░░░░░░░░░░ ││
│  │  🥉   │ Team Puma     │ 7,845    │ 21%        │ ████████░░░░░░░░░░░░░ ││
│  │  4    │ Team Reebok   │ 4,234    │ 11%        │ ████░░░░░░░░░░░░░░░░░ ││
│  │  5    │ Team New Bal. │ 2,847    │ 7%         │ ██░░░░░░░░░░░░░░░░░░░ ││
│  │       │               │          │            │                        ││
│  │       │ TOTAL         │ 38,007   │ 100%       │                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 4. USER JOURNEY

## 4.1 Joining a Team

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    JOIN A TEAM                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  🔥 BATTLE OF THE BRANDS                                               ││
│  │                                                                         ││
│  │  Coca-Cola vs Pepsi                                                    ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                         ││
│  │  Choose your team:                                                     ││
│  │                                                                         ││
│  │  ┌───────────────┐  ┌───────────────┐                                  ││
│  │  │   🥤 COCA-COLA │  │   🥤 PEPSI    │                                  ││
│  │  │                │  │                │                                  ││
│  │  │  👥 847 members│  │  👥 534 members│                                 ││
│  │  │  📊 68%        │  │  📊 32%        │                                 ││
│  │  │  🔥 Trending   │  │  💪 Rising     │                                 ││
│  │  │                │  │                │                                  ││
│  │  │  [JOIN TEAM]   │  │  [JOIN TEAM]   │                                 ││
│  │  └───────────────┘  └───────────────┘                                  ││
│  │                                                                         ││
│  │  💡 Join the winning team? Team Coca-Cola is currently leading!        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Team Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEAM COCA-COLA DASHBOARD                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  🥤 COCA-COLA TEAM                                                     ││
│  │                                                                         ││
│  │  📊 Team Stats:                                                         ││
│  │  • Total Votes: 12,847                                                 ││
│  │  • Active Members: 847                                                 ││
│  │  • Team Score: 78%                                                     ││
│  │  • Lead Over Pepsi: +4,613 votes                                       ││
│  │                                                                         ││
│  │  🏆 Current Rank: #1 (Leading)                                         ││
│  │  ⏱ Time Remaining: 23h:14m:32s                                        ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  YOUR CONTRIBUTION                                                  │││
│  │  │  • Votes Cast: 47                                                  │││
│  │  │  • Team Rank: #12 of 847                                           │││
│  │  │  • Points Earned: 234                                              │││
│  │  │  • Potential Reward: $2.47                                         │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  [VOTE NOW]  [SHARE TEAM]  [VIEW LEADERBOARD]  [INVITE FRIENDS]        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.3 Voting While Representing a Team

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VOTING FOR YOUR TEAM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  🥤 Team Coca-Cola vs 🥤 Team Pepsi                                    ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Which ad is more effective?                                        │││
│  │  │                                                                     │││
│  │  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐   ││
│  │  │  │  🥤 COCA-COLA AD       │  │  🥤 PEPSI AD                   │   ││
│  │  │  │  "Open Happiness"      │  │  "Live for Now"                │   ││
│  │  │  │                        │  │                                │   ││
│  │  │  │  [Image]              │  │  [Image]                       │   ││
│  │  │  │                        │  │                                │   ││
│  │  │  │  🗳️ Vote for Team    │  │  🗳️ Vote for Team             │   ││
│  │  │  │     Coca-Cola          │  │     Pepsi                      │   ││
│  │  │  └─────────────────────────┘  └─────────────────────────────────┘   ││
│  │  │                                                                     ││
│  │  │  💡 Voting for your team earns 2× points!                         ││
│  │  │  📊 Current Score: Coca-Cola 68% vs Pepsi 32%                     ││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 5. REWARD SYSTEM

## 5.1 How Points Are Earned

| Action                  | Points    | Bonus Conditions               |
| ----------------------- | --------- | ------------------------------ |
| **Vote for your team**  | 10 points | 2× if team is trailing         |
| **Vote for any poll**   | 5 points  | 1.5× if weekly challenge       |
| **Share team link**     | 15 points | 3× per unique click            |
| **Invite new member**   | 25 points | 5× if they vote 10+ times      |
| **Daily login**         | 5 points  | 2× for 7-day streak            |
| **Comment on campaign** | 10 points | 2× if comment is voted helpful |
| **Create content**      | 20 points | 3× if featured                 |

## 5.2 Team Reward Pool

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEAM REWARD POOL                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Advertiser Contribution: $500                                              │
│  Platform Match: $100                                                       │
│  Total Prize Pool: $600                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Distribution:                                                          ││
│  │                                                                         ││
│  │  Winning Team: $400 (66.7%)                                            ││
│  │  Runner-up Team: $150 (25%)                                            ││
│  │  Platform Fee: $50 (8.3%)                                              ││
│  │                                                                         ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                         ││
│  │  Within Winning Team:                                                   ││
│  │                                                                         ││
│  │  Top 10%: 50% of team prize ($200)                                     ││
│  │  Top 25%: 30% of team prize ($120)                                     ││
│  │  All Members: 20% of team prize ($80) split equally                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.3 Individual Rewards

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INDIVIDUAL REWARDS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Team: Coca-Cola (Winning Team)                                            │
│  Prize Pool: $400                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Your Rank: #12 of 847                                                 ││
│  │  Your Score: 234 points                                                ││
│  │  Your Share: 2.47% of team prize                                       ││
│  │  Your Reward: $9.88                                                    ││
│  │                                                                         ││
│  │  Breakdown:                                                             ││
│  │  • Base reward: $2.47                                                  ││
│  │  • Top 25% bonus: $4.94                                                ││
│  │  • Streak bonus: $2.47                                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. GROUP FEATURES

## 6.1 Team Communication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEAM COCA-COLA CHAT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  💬 Team Chat (847 members)                                            ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  @team_lead: "Great job everyone! We're leading by 15%!"          │││
│  │  │  ❤ 47   🔁 12   📅 2h ago                                        │││
│  │  │                                                                     │││
│  │  │  @voter_123: "I've cast 50 votes today! Let's keep pushing!"      │││
│  │  │  ❤ 23   🔁 5   📅 1h ago                                          │││
│  │  │                                                                     │││
│  │  │  @new_member: "Just joined! What's the strategy?"                  │││
│  │  │  ❤ 18   🔁 8   📅 30m ago                                         │││
│  │  │                                                                     │││
│  │  │  📢 Announcement: "Vote target for today: 500 votes!"              │││
│  │  │  Progress: ████████████████░░░░░░ 78%                              │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  [Type a message...]  [📎 Attach]  [📤 Send]                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Team Challenges

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEAM CHALLENGES                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  🎯 DAILY CHALLENGES                                                   ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  ⚡ Vote 50 times today → Earn 50 bonus points per member          │││
│  │  │  Progress: ████████████████░░░░░░ 78% (397/500 votes)              │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  📢 Recruit 10 new members → Earn 100 bonus points per recruiter   │││
│  │  │  Progress: ████████████░░░░░░░░░░ 60% (6/10 recruits)              │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  🎨 Create team content → Earn 50 bonus points per submission      │││
│  │  │  Progress: ████████░░░░░░░░░░░░░░ 40% (8/20 submissions)           │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. ADVERTISER DASHBOARD

## 7.1 Campaign Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADVERTISER DASHBOARD                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  📊 Campaign: Coca-Cola vs Pepsi                                       ││
│  │                                                                         ││
│  │  Budget: $500                                                          ││
│  │  Spent: $347                                                           ││
│  │  Remaining: $153                                                       ││
│  │  Status: Active                                                        ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Team Performance                                                   │││
│  │  │                                                                     │││
│  │  │  Team Coca-Cola: 68% (12,847 votes)  ████████████████░░░░          │││
│  │  │  Team Pepsi: 32% (6,234 votes)      ████████░░░░░░░░░░░░          │││
│  │  │                                                                     │││
│  │  │  📊 ROI: 187%                                                      │││
│  │  │  📈 Engagement: 8.7%                                               │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  [PAUSE CAMPAIGN]  [INCREASE BUDGET]  [VIEW ANALYTICS]                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Advertiser Controls

| Control                 | Description              | Options                               |
| ----------------------- | ------------------------ | ------------------------------------- |
| **Team Size Limit**     | Max members per team     | 50, 100, 250, 500, Unlimited          |
| **Reward Distribution** | How rewards are split    | Top 10%, Top 25%, Equal, Custom       |
| **Duration**            | How long campaign runs   | 24h, 3 days, 7 days, 14 days, 30 days |
| **Vote Requirement**    | Minimum votes to qualify | 1, 5, 10, 25, 50                      |
| **Team Creation**       | Who can create teams     | Advertiser only, Open                 |

---

# 8. TECHNICAL IMPLEMENTATION

## 8.1 Database Schema Additions

### Table: `group_campaigns`

```sql
CREATE TABLE group_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('head_to_head', 'battle_royale', 'coalition', 'seasonal_league')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    budget DECIMAL(10,2) NOT NULL,
    platform_match DECIMAL(10,2) DEFAULT 0,
    total_prize_pool DECIMAL(10,2),
    duration_start TIMESTAMPTZ NOT NULL,
    duration_end TIMESTAMPTZ NOT NULL,
    max_team_size INTEGER,
    min_votes_to_qualify INTEGER DEFAULT 5,
    reward_distribution JSONB,
    current_winner_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_campaigns_advertiser_id ON group_campaigns(advertiser_id);
CREATE INDEX idx_group_campaigns_status ON group_campaigns(status);
CREATE INDEX idx_group_campaigns_duration_end ON group_campaigns(duration_end);
```

### Table: `group_teams`

```sql
CREATE TABLE group_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES group_campaigns(id) ON DELETE CASCADE,
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disqualified', 'withdrawn')),
    total_votes INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    rank_position INTEGER,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_teams_campaign_id ON group_teams(campaign_id);
CREATE INDEX idx_group_teams_advertiser_id ON group_teams(advertiser_id);
CREATE INDEX idx_group_teams_total_votes ON group_teams(total_votes DESC);
```

### Table: `group_members`

```sql
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'captain', 'co_captain')),
    points INTEGER DEFAULT 0,
    votes_cast INTEGER DEFAULT 0,
    shares_generated INTEGER DEFAULT 0,
    referrals_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_group_members_team_id ON group_members(team_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_points ON group_members(points DESC);
```

### Table: `group_votes`

```sql
CREATE TABLE group_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    points_earned INTEGER DEFAULT 10,
    bonus_multiplier DECIMAL(3,2) DEFAULT 1.0,
    is_bonus BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_votes_group_member_id ON group_votes(group_member_id);
CREATE INDEX idx_group_votes_poll_id ON group_votes(poll_id);
CREATE INDEX idx_group_votes_created_at ON group_votes(created_at);
```

### Table: `team_challenges`

```sql
CREATE TABLE team_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('vote_target', 'recruitment', 'content_creation', 'share_target')),
    target INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    reward_points INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_challenges_team_id ON team_challenges(team_id);
CREATE INDEX idx_team_challenges_status ON team_challenges(status);
```

### Table: `group_messages`

```sql
CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_announcement BOOLEAN DEFAULT FALSE,
    parent_id UUID REFERENCES group_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_messages_team_id ON group_messages(team_id);
CREATE INDEX idx_group_messages_created_at ON group_messages(created_at DESC);
```

---

## 8.2 API Endpoints Additions

| Method         | Endpoint                                           | Description           | Auth       |
| -------------- | -------------------------------------------------- | --------------------- | ---------- |
| **Campaigns**  |                                                    |                       |            |
| POST           | `/api/v1/campaigns/group`                          | Create group campaign | Advertiser |
| GET            | `/api/v1/campaigns/group`                          | List group campaigns  | JWT        |
| GET            | `/api/v1/campaigns/group/:id`                      | Get campaign details  | JWT        |
| PUT            | `/api/v1/campaigns/group/:id`                      | Update campaign       | Advertiser |
| POST           | `/api/v1/campaigns/group/:id/activate`             | Activate campaign     | Advertiser |
| POST           | `/api/v1/campaigns/group/:id/pause`                | Pause campaign        | Advertiser |
| **Teams**      |                                                    |                       |            |
| POST           | `/api/v1/campaigns/:id/teams`                      | Create team           | Advertiser |
| GET            | `/api/v1/campaigns/:id/teams`                      | List teams            | JWT        |
| POST           | `/api/v1/teams/:id/join`                           | Join team             | JWT        |
| POST           | `/api/v1/teams/:id/leave`                          | Leave team            | JWT        |
| GET            | `/api/v1/teams/:id/leaderboard`                    | Get team leaderboard  | JWT        |
| GET            | `/api/v1/teams/:id/members`                        | Get team members      | JWT        |
| **Challenges** |                                                    |                       |            |
| GET            | `/api/v1/teams/:id/challenges`                     | Get team challenges   | JWT        |
| POST           | `/api/v1/teams/:id/challenges/:challenge/complete` | Complete challenge    | JWT        |
| **Messages**   |                                                    |                       |            |
| POST           | `/api/v1/teams/:id/messages`                       | Send message          | JWT        |
| GET            | `/api/v1/teams/:id/messages`                       | Get messages          | JWT        |
| PUT            | `/api/v1/messages/:id/pin`                         | Pin message           | Captain    |
| **Voting**     |                                                    |                       |            |
| POST           | `/api/v1/teams/:id/vote`                           | Vote for team         | JWT        |
| GET            | `/api/v1/teams/:id/votes`                          | Get team votes        | JWT        |

---

# 9. USE CASES

## 9.1 Brand vs Brand Competition

**Scenario:** Coca-Cola vs Pepsi

| Team      | Ad Spend | Members | Votes  | Result       |
| --------- | -------- | ------- | ------ | ------------ |
| Coca-Cola | $500     | 847     | 12,847 | 🥇 Winner    |
| Pepsi     | $500     | 534     | 6,234  | 🥈 Runner-up |

**User Earnings:**

- Top 10% of Coca-Cola: $10-25 each
- Top 10% of Pepsi: $5-10 each
- Active members: $2-5 each

## 9.2 Product Launch Competition

**Scenario:** Apple vs Samsung (New Phone Launch)

| Team    | Ad Spend | Members | Votes  | Result       |
| ------- | -------- | ------- | ------ | ------------ |
| Apple   | $1,000   | 1,200   | 24,000 | 🥇 Winner    |
| Samsung | $1,000   | 950     | 18,000 | 🥈 Runner-up |

## 9.3 Charity Battle

**Scenario:** NGO A vs NGO B

| Team  | Ad Spend | Members | Votes | Result       |
| ----- | -------- | ------- | ----- | ------------ |
| NGO A | $200     | 300     | 5,000 | 🥇 Winner    |
| NGO B | $200     | 280     | 4,500 | 🥈 Runner-up |

**Special Rule:** All proceeds go to charity

---

# 10. ENGAGEMENT METRICS

## 10.1 Expected Impact

| Metric                  | Without Groups | With Groups | Improvement |
| ----------------------- | -------------- | ----------- | ----------- |
| **Daily Active Users**  | 10,000         | 18,000      | +80%        |
| **Votes Per User**      | 15             | 35          | +133%       |
| **Time on App**         | 12 min         | 28 min      | +133%       |
| **Retention (30 days)** | 40%            | 65%         | +63%        |
| **Referrals**           | 500/month      | 2,000/month | +300%       |

## 10.2 Key Performance Indicators

| KPI                          | Target | Measurement                        |
| ---------------------------- | ------ | ---------------------------------- |
| **Team Participation Rate**  | >70%   | Members who vote at least once     |
| **Team Retention**           | >60%   | Members who stay for full campaign |
| **Vote-to-Vote Ratio**       | >1:5   | Team votes per individual vote     |
| **Campaign Completion Rate** | >80%   | Campaigns that reach their goal    |

---

# 11. SUMMARY OF BENEFITS

## 11.1 For Advertisers

| Benefit                  | Description                       |
| ------------------------ | --------------------------------- |
| **Passionate Advocates** | Users actively promote your brand |
| **Organic Reach**        | Users share with their networks   |
| **Market Intelligence**  | See how your brand compares       |
| **Cost-Effective**       | Only pay for results              |
| **Community Building**   | Build brand loyalty               |

## 11.2 For Users

| Benefit               | Description                      |
| --------------------- | -------------------------------- |
| **Team Spirit**       | Belong to a community            |
| **Earn Money**        | Get paid for promoting brands    |
| **Gamification**      | Challenges, leaderboards, badges |
| **Social Connection** | Chat with team members           |
| **Skill Development** | Learn marketing/promotion        |

## 11.3 For Platform

| Benefit               | Description            |
| --------------------- | ---------------------- |
| **Higher Engagement** | Users stay longer      |
| **More Revenue**      | More ad spend          |
| **User Growth**       | Referrals drive growth |
| **Data Richness**     | More voting data       |
| **Competitive Moat**  | Unique feature set     |

---

# 12. NEXT STEPS

| Priority | Task                                | Owner       | Timeline |
| -------- | ----------------------------------- | ----------- | -------- |
| 1        | Finalize group campaign models      | Product     | Day 1    |
| 2        | Design UI/UX for team dashboards    | Design      | Day 2    |
| 3        | Update database schema              | Engineering | Day 3    |
| 4        | Implement team management APIs      | Engineering | Day 4    |
| 5        | Implement voting with team tracking | Engineering | Day 5    |
| 6        | Implement chat/messaging            | Engineering | Week 2   |
| 7        | Test with 100 beta users            | QA          | Week 2   |
| 8        | Launch to production                | DevOps      | Week 3   |

---

_End of Group Advertising & Competitive Promotion System_

**Ready for Implementation. Ready for Launch. Ready to Transform Ad Engagement.**
