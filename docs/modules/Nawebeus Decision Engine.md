# Module: Nawebeus Decision Engine — Decision Intelligence & Social Sentiment

**Document Version:** 1.0.0
**Last Updated:** 2026-08-18
**Status:** Draft (consolidated specification)
**Owner:** Product Lead & Engineering Lead

---

## Revision Note

This document is the **single consolidated specification** for the Nawebeus Decision Engine. It supersedes the three source documents in `docs/modules/new features/`:

| Source document | Role in this spec |
| --------------- | ----------------- |
| `Product Requirements Document.md` | Product behaviour, UI, gamification, flows |
| `Technical Requirements Document.md` | Domain model, state machines, ledger, schema |
| `ENGAGEMENT & ADVERTISING.md` | **Authoritative economic model** — the "revised economic model & architecture" (v2.0) that explicitly fixes the original flawed design |

Two reconciliation rules apply:

1. **Revision wins.** Where the revised economic model conflicts with the original PRD/TRD, the revision is authoritative. Superseded values are recorded in §15 (Superseded Values).
2. **Rebased onto Nawebeus tenancy.** The original documents describe a standalone consumer product. This spec runs the module inside the Nawebeus multi-tenant platform, using the domain glossary in `CONTEXT.md` (Organization, Membership, Session, Content, Conversation, Campaign, Entry, ...). The mapping is in §1.7.

---

# 1. Module Overview

## 1.1 Purpose

The Nawebeus Decision Engine is a **decision intelligence and social sentiment engine** for Nawebeus organizations. It turns "this-or-that" choices into quantifiable psychographic data, predictive trend analytics, team alignment metrics, and actionable business intelligence. It combines:

- **Polling & voting** — rapid, gamified binary (and multi-option) decision instruments.
- **AI psychographic insights** — per-member personas, team alignment maps, and clash detection.
- **Market benchmarking** — organization results compared against anonymized industry aggregates.
- **Monetization** — submission tiers, a token economy, and advertising with user revenue share.

_Vision:_ "Turn every binary choice into a business insight. Understand your audience, your team, and your market in minutes, not weeks."

## 1.2 Problem Statement

| Challenge | Context |
| --------- | ------- |
| **Slow decision cycles** | Teams spend weeks on A/B tests and surveys before shipping a creative, a policy, or a product choice |
| **Opinion fragmentation** | No single instrument captures what customers, teams, and markets actually prefer |
| **Hidden disagreement** | Alignment problems surface too late; teams lack a tool to quantify friction |
| **Wasted research spend** | Enterprise research is expensive and slow; free polls are shallow and unreliable |
| **Unmonetized audience** | Engaged audiences (voters, participants) generate value that is today neither measured nor shared |

## 1.3 Module Objectives

| Objective | Success measure |
| --------- | --------------- |
| **Fast decision validation** | Polls go from creation to first insight in < 5 minutes |
| **Team alignment** | Detect and resolve clashes; ≥ 80% of flagged clashes are followed by a resolution poll |
| **Market awareness** | Every poll can be benchmarked against an anonymized industry baseline |
| **Engagement** | Gamification (streaks, badges, bounties) sustains voting habit formation |
| **Sustainable monetization** | User rewards never exceed confirmed net revenue (revised model) |
| **Fraud resistance** | Multi-layer detection keeps vote farming and referral abuse near zero |

## 1.4 Target Users

Rebased onto Nawebeus roles. Personas follow the platform's Nigerian-market convention.

| Persona | Platform role | Primary use cases |
| ------- | ------------- | ----------------- |
| **Bola** — Social Media Manager, Telecom | Member | Create polls, run audience research, read Vibe Insights |
| **Chidi** — Head of Marketing, Fintech | Admin | Team alignment, resolution polls, white-label exports |
| **Ngozi** — HR Manager, Multinational | Admin | Culture-fit assessment, team polarity maps |
| **Kunle** — Product Designer, Startup | Member | Design validation, visual attention heatmaps |
| **Ifeoma** — Agency Owner | Owner | Multi-client polling, white-label reports, client presentations |
| **Ada** — Brand Manager, Consumer Goods | Advertiser | Ad campaigns, Battle of the Brands group campaigns |
| **External Guest** | Unauthenticated / visitor participant | Vote on public polls; no membership, no org data access |

## 1.5 Module Scope

**In scope**

- Poll creation (Decision Studio), six poll types, feed, voting, results.
- Vibe Insights (per-member, per-team), Market Pulse, visual attention heatmaps.
- Gamification: Reputation Points (RP), streaks, badges, bounties.
- Team collaboration, debate comments, audience overlay filters.
- Share & export: GIF verdicts, embeddable widgets, auto-email reports, white-label export.
- Submission tiers + ranking, token economy, advertising + revenue share, group advertising.
- Trust/fraud engine, moderation, audit.

**Out of scope (owned elsewhere)**

| Feature | Owner module |
| ------- | ------------ |
| Identity, sessions, membership, CASL abilities | Module 1 (Authentication), Module 2 (Organization) |
| Social platform connections & publishing | Module 3 (Social Media Integration), Module 4 (Publishing) |
| Social listening / monitors / mentions | Module 5 (Social Listening / Media Monitoring) |
| Inbound conversation handling | Module 6 (Engagement Hub) |
| Reporting & cross-module analytics | Module 7 (Analytics & Reporting) |
| Notifications plumbing | Module 9 (Notifications & Alerts) |

## 1.6 Module Position in the Platform

| Aspect | Detail |
| ------ | ------ |
| **Pillar** | Decision intelligence, engagement, monetization |
| **Depends on** | Authentication, Organization (Membership + CASL), Media storage, Real-time (WebSocket), Notifications, Payments (Paystack/Stripe) |
| **Integrates with** | Analytics & Reporting, Growth & Giveaways (Campaigns), Influencer (Programs), PR (Initiatives) |
| **External systems** | OpenAI API / vector DB (embeddings), OpenCV (heatmaps), ad providers, Cloudinary/S3 (media) |

## 1.7 Tenancy & Glossary Mapping

All Decision Engine data is **organization-scoped** (except platform-level anonymous aggregates). The module introduces new domain vocabulary where the platform has none; where the platform has a term, this spec uses it.

| Original (consumer) concept | Nawebeus term | Notes |
| -------------------------------- | ------------- | ----- |
| User (anyone on the internet) | **Member** (via Membership) or **External Guest** | Members act under an Organization's Membership with CASL abilities; External Guests vote on public polls with a lightweight visitor identity |
| User's "account" | Session / Access token (existing auth) | No new identity model |
| Team (Department/Project/Company/External) | **Organization** + role-based **Memberships**; a "Team" is a named group of Memberships within an Organization | Reuses `organization_members` |
| Poll, Vote, Option | New terms: **Poll**, **Vote**, **Option** | Module glossary §16 |
| Submission (tiered contest entry) | **Submission** (aligns with **Entry**) | A media entry that others vote on; keeps its own lifecycle |
| Bountied Poll | Poll with a prize; may attach to a **Campaign** | Campaign glossary term is the timebound promotional container |
| Battle of the Brands | **Campaign** of type `brand_battle` | Uses polls as the engagement mechanic |
| Ad campaign / advertiser | **Organization** in the Advertiser role; **Campaign** (advertising) | Ad delivery is platform-level infrastructure, org-owned campaigns |
| Leaderboard, badges, tokens | New terms (module-level gamification) | Tokens are a platform-wide currency per user |

**Isolation rule:** every read/write in this module is validated against the authenticated Member's Membership (org context via AsyncLocalStorage, exactly as the rest of the platform). External Guests are anonymous participants: their votes are aggregated into org polls but never expose member data, and they never receive org data.

---

# 2. User Stories

Story IDs use the `US-DE-` prefix. Priority: P0 (MVP), P1 (Beta), P2 (Full/Scale).

## 2.1 Poll Creator (Member / Bola, Kunle)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-01 | Poll Creator | Create a poll with images, question, duration and audience in one screen | I can validate a decision in minutes | P0 |
| US-DE-02 | Poll Creator | Choose from six poll types (Classic, Quiz, Duel, Matrix, Blind, Gavel) | I match the instrument to the question | P1 |
| US-DE-03 | Poll Creator | Preview the live poll in an iPhone frame before publishing | I publish confidently | P0 |
| US-DE-04 | Poll Creator | Get AI-suggested category tags | my poll is auto-classified for insights | P1 |
| US-DE-05 | Poll Creator | Save drafts and reuse corporate templates | I stay fast and consistent | P0 |
| US-DE-06 | Poll Creator | Watch real-time results and get an auto-email report at close | I act on results immediately | P0 |

## 2.2 Voter / Participant (Member + External Guest)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-11 | Voter | Swipe or tap to vote with animated feedback | voting is fast and delightful | P0 |
| US-DE-12 | Voter | See results update in real time after voting | I understand the crowd instantly | P0 |
| US-DE-13 | Voter | Change my vote before the poll closes | my final preference counts | P1 |
| US-DE-14 | Voter | Earn tokens and streaks for genuine activity | I am rewarded for participation | P0 |
| US-DE-15 | External Guest | Vote on a public poll without creating an account | low-friction participation | P1 |

## 2.3 Team Lead / Admin (Chidi, Ngozi)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-21 | Team Lead | See a team polarity map and alignment heatmap | I spot friction early | P1 |
| US-DE-22 | Team Lead | Generate a resolution poll from a detected clash | teams realign quickly | P1 |
| US-DE-23 | Admin | Filter results by audience segment (B2B, team, guest) | consumer noise doesn't sway business decisions | P1 |
| US-DE-24 | Admin | Export white-labeled PDF/GIF reports with our branding | client presentations look proprietary | P1 |
| US-DE-25 | Admin | Manage members and roles for teams | access is correct | P0 |

## 2.4 Agency Owner (Ifeoma)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-31 | Agency Owner | Run polls per client organization in fully isolated workspaces | client data never crosses | P0 |
| US-DE-32 | Agency Owner | Embed live poll widgets on client sites | engagement happens on client properties | P2 |
| US-DE-33 | Agency Owner | Benchmark client results against industry averages | I can show market context in reports | P2 |

## 2.5 Advertiser / Brand Manager (Ada)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-41 | Advertiser | Create and run ad campaigns with budget, targeting, and bidding | I reach relevant voters | P1 |
| US-DE-42 | Advertiser | Launch a Battle of the Brands group campaign | my brand gets an organized advocacy team | P2 |
| US-DE-43 | Advertiser | See campaign ROI and engagement analytics | I justify spend | P1 |

## 2.6 Moderator / Compliance

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-DE-51 | Moderator | Review flagged polls, submissions, ads and comments against SLAs | the feed stays clean and compliant | P0 |
| US-DE-52 | Moderator | Record violations and apply escalating penalties | repeat offenders are handled consistently | P1 |
| US-DE-53 | Compliance Officer | Audit every economic event | regulators and clients can be answered | P0 |

---

# 3. Functional Requirements

Requirement IDs use the `FR-DE-` prefix.

## 3.1 FR-DE-001: Decision Studio (Poll Creation)

| Item | Specification |
| ---- | ------------- |
| **Layout** | 50/50 split: image upload zone (left), live preview (right) |
| **Image upload** | Drag & drop or browse; auto-crop to 4:5; multi-image (2/4+); reorder by drag |
| **File rules** | JPG, PNG, WEBP, GIF; ≤ 10 MB per image; automatic optimization |
| **Question text** | Max 280 chars; AI suggests improvements |
| **Option labels** | Max 50 chars per option |
| **Duration** | 1 hour, 6 hours, 1 day, 3 days, 7 days |
| **Audience** | All, Team Only, Verified B2B, Custom (rules JSON) |
| **Tags** | AI-suggested from text + image analysis |
| **Templates** | Marketing, HR, Product, R&D, Sales, Customer Success libraries |
| **Actions** | Save Draft, Preview, Publish |

**Poll types** (`type`): `classic` (two options), `quiz` (reveals correct answer), `duel` (two perspectives, live scoring), `matrix` (4 images in 2×2, rank 1–4), `blind` (results hidden until the user votes), `gavel` (weighted voting: B2B 1.5×, Executive 2×, creator-enabled).

**AI tagging** auto-detects categories: `#ProductDesign`, `#MarketingCopy`, `#FinancePolicy`, `#UXDesign`, `#BrandStrategy`, `#TeamCulture`, `#TechnologyChoice`, `#CreativeDirection`, `#StrategicPlanning`, `#CustomerExperience`. Categories feed Vibe Insights alignment scoring.

## 3.2 FR-DE-002: Feed & Voting

| Element | Specification |
| ------- | ------------- |
| **Poll card** | 50/50 image split separated by 2px white divider; glassmorphism question pill (`rgba(255,255,255,0.7)`, blur 15px); Level-1 shadow |
| **Sort** | Trending, New, Following, Popular, Ending Soon |
| **Filter** | All, Active, Closed, By Category, By Poll Type, By Audience |
| **Gesture** | Swipe right = Option A, swipe left = Option B; 30% card-width threshold; tap as alternative; haptic on threshold and confirm |
| **Real-time** | Progress bars fill (0.8s ease-out), vote count counters, winner highlight; WebSocket push < 100 ms |
| **Post-vote** | "View Insights" appears; share button exposed |

## 3.3 FR-DE-003: The Verdict (Results & Share Cards)

| Card | Content |
| ---- | ------- |
| **Alignment Report (Vibe Check)** | Sunburst chart (inner = person A, outer = person B), category alignment bars, AI narrative title, biggest-clash alert, "Create Resolution Poll", Download PDF / Share |
| **Battle Report (Duel)** | Rival meters (blue left / red right), glowing clash-point diamond, vote stats (total votes, peak hour, avg view) |
| **Market Pulse (Poll)** | Benchmark arc (industry avg vs org audience), option bars, AI insight sentence, Share to LinkedIn |

## 3.4 FR-DE-004: Vibe Insights (AI Psychographics)

- **Per-member persona**: archetype detection (The Disruptor, The Stabilizer, The Aesthetic Purist, The Bridge Builder, The Visionary, The Analyst) + category scores (Design Taste, Strategic Thinking, Cultural Fit, Innovation Quotient) + top traits / growth areas + recent activity.
- **Team module**: collective polarity map, alignment heatmap by department, critical-friction detection, team archetype distribution, full report + resolution poll generator.
- **Cross-pollination**: user-to-user compatibility, user-to-team fit, team-to-team alignment, organization-to-industry benchmark.
- **Resolution Poll Generator**: clash → AI-generated poll question + options → one-click creation.
- **Audience Overlay**: filter percentages, charts, comments, and insights by segment (All / Verified B2B / Team / External Guests).

## 3.5 FR-DE-005: Market Pulse & Heatmaps

| Feature | Specification |
| ------- | ------------- |
| **Global benchmarking** | Org results vs anonymized industry averages; filter by industry (Fashion, Tech, Lifestyle...) |
| **Category performance tracker** | Per-category alignment vs industry (above/below, %), best poll, needs-attention, follow-up poll |
| **Visual attention heatmap** | OpenCV eye-tracking simulation over uploaded images; tracks first look, duration, last look, click maps; outputs heatmap overlay + recommendations |

## 3.6 FR-DE-006: Gamification

**Reputation Points (RP)**

| Action | RP | Notes |
| ------ | -- | ----- |
| Vote on any poll | +5 | Base |
| Vote before 50 votes (Early Adopter) | +10 | Bonus |
| Create a poll | +15 | |
| Poll reaches 100 / 1,000 votes | +25 / +50 | Milestones |
| "Insightful" badge on comment | +20 | |
| Daily login streak | ×2 multiplier | Consecutive days |
| Share poll | +10 | |
| Invite a new user | +25 | |

**RP levels**: Voter 0–100, Contributor 101–500, Influencer 501–2,000, Thought Leader 2,001–10,000, Visionary 10,000+.

**Streaks**: 7d Consistent Voter (1×), 14d Dedicated Voice (1×), 21d Reliable Responder (1.5×), 30d Gold Gavel (2×, gold polls), 60d Platinum Gavel (3×), 100d Diamond Gavel (5×, VIP support).

**Badges**: voting (Bronze 100 / Silver 500 / Gold 1,000 votes), streak (Gold/Platinum/Diamond Gavel), creation (Insight 50 / Master 200 / Legendary 500 polls), impact (Viral Maker 10k votes, Influencer 5 features, Trend Spotter 5 early-adopter bonuses), community (B2B Validator, Helpful Voice 50 comments, Community Builder 10 invites).

## 3.7 FR-DE-007: Bountied Polls

- **Bounty types**: Vote Match (predict final split), Best Comment, Creative Submission, Persuasion.
- **Lifecycle**: DRAFT → PUBLISHED → ACCEPTING RESPONSES → CLOSED → WINNER SELECTED → REWARDED.
- **Vote Match payout**: closest match wins; 2nd and 3rd closest receive smaller prizes; live leaderboard of distance-from-center.
- Bounties are attached to a Poll and may be wrapped in a platform **Campaign** for tracking against KPIs.

## 3.8 FR-DE-008: Team Collaboration

- Team = named group of Memberships within an Organization; roles **Member**, **Lead**, **Admin**.
- Types: Department, Project (temporary), Company-wide, External (invited guests via link/email).
- Features: shared dashboard, team-only polls, aggregate insights, department alignment tracking, team leaderboards, generate team reports.
- Member: view/vote/comment. Lead: create team polls, view aggregate insights. Admin: add/remove members, set permissions.

## 3.9 FR-DE-009: Debate Comments

| Feature | Specification |
| ------- | ------------- |
| **Side tags** | Green border (Team A), red border (Team B), neutral (gray) |
| **Sort** | Most Recent, Top Voted, Pro Team A, Pro Team B (tactical insight) |
| **Interactions** | Upvote/downvote, threaded replies, attachments (images/GIFs/links), @mentions, flag, creator pin |

## 3.10 FR-DE-010: Share & Export Ecosystem

| Feature | Specification |
| ------- | ------------- |
| **Verdict in Motion** | 5-second animated GIF loop of result evolution; customization (speed, theme, text overlay, brand logo); share to Instagram/LinkedIn/Twitter, save to gallery |
| **Embeddable widgets** | Responsive iframe (`<iframe src=".../embed/poll/:id">`); live sync, brand colors, analytics, brand controls; public embeds are the only unauthenticated surface |
| **Auto-email reports** | Summary, results breakdown, demographic breakdown, market pulse benchmark, AI insights, comments summary; delivered at poll close + dashboard copy + PDF download |
| **White-label export** | Watermark removal, custom logo/colors/domain; PDF, GIF, embed, social cards, email reports; Enterprise/Business plan only |

## 3.11 FR-DE-011: Submission Tiers & Ranking

**Tiers** (authoritative configuration; §4 DE-MON-001):

| Tier | Price | Tokens | Duration | Position | Pin | Watermark | Featured |
| ---- | ----- | ------ | -------- | -------- | --- | --------- | -------- |
| Bronze | $5 | 100 | 3 days | Bottom | – | Required | No |
| Silver | $15 | 300 | 5 days | Middle | – | Required | No |
| Gold | $35 | 700 | 7 days | Top 25% | 12h | Optional | Yes |
| Platinum | $75 | 1,500 | 14 days | Top 5% | 48h | Removable | Yes |

**Ranking formula**:

```
FINAL_SCORE = (ORGANIC_POPULARITY × 0.6) + (PAID_EXPOSURE × 0.3) + (FRESHNESS × 0.1)
ORGANIC_POPULARITY = raw_votes / max_votes_in_category
PAID_EXPOSURE = (starting_position_boost × 0.4) + (pin_boost × 0.3) + (featured_boost × 0.3)
FRESHNESS = 1.0 - (hours_since_publish / total_duration_hours)
```

Rules: position computed at submission time; recomputed hourly; pin holds top position; newer pin wins ties; organic votes rank all submissions equally. Display labels: 📌 Pinned, ⭐ Featured, 🏆 Platinum, 📢 Sponsored.

## 3.12 FR-DE-012: Token Economy

- **Earning** (revised limits apply; trust ≥ threshold): vote 1 (cap 50/day), first-10 daily votes 2 bonus (cap 20), bountied vote 3 (cap 15), comment 2 (cap 10), share 5 (cap 15), create poll 10 (cap 20/week), poll reaches 100 votes 20 (creator, unlimited), "Insightful" badge 30, verified invite 25, invited user votes 10× 50, daily challenge 10 (cap 10/day), weekly challenge 50 (cap 50/week), rewarded video ad 3 (unlimited).
- **Streak bonuses**: 7d/14d/30d/60d/100d → 10/25/50/100/250 tokens.
- **Spending**: Bronze 100, Silver 300, Gold 700, Platinum 1,500; extend 3 days 50; 24h visibility boost 100; remove watermark 150; gift tokens min 500 (trust ≥ 50).
- **Packages**: Starter 100/$5, Popular 300/$15, Pro 700/$30, Elite 1,500/$60, Mega 4,000/$150.
- **Ledger**: every mutation is a `token_transactions` row (credit/debit) with an idempotency key; balances are cached projections. Lots consumed **FEFO** (First Expiring, First Out). Expiry: earned 90d inactivity; purchased 12mo; bonus = source purchase; gifted 6mo. Inactivity = voting, creating, commenting, spending, purchasing, inviting, or completing challenges (not login/viewing).
- **Exchange rate**: nominal 20 tokens = $1.00; promotional bonuses do not change the nominal rate (MON-001/002).

## 3.13 FR-DE-013: Advertising & Revenue Share

| Ad type | Format | Placement (free users) | Frequency |
| ------- | ------ | ---------------------- | --------- |
| Banner | 300×50 image | Bottom of voting screen | Every vote |
| Interstitial | Full screen | Between polls | Every 10th vote |
| Native | In-feed | Within voting flow | Every 5th vote |
| Video (15s) | MP4 | Before results | Every 3rd vote |
| Rewarded video | MP4 (30s) | User-initiated | Unlimited (opt-in) |

Rules: free users see ads during voting; paid users see none (except opt-in rewarded); max 10 ads/user/day; placement randomized. Advertiser = Organization in Advertiser role; campaigns have budget (daily/campaign/spent), bid (CPM/CPC/CPV), targeting (demographics, interests, behavioral, contextual), schedule, and metrics. Ad rewards follow the reward state machine (§4 DE-ADV). User revenue share follows the revised split (§4 DE-MON-003).

## 3.14 FR-DE-014: Group Advertising (Battle of the Brands)

- **Models**: Head-to-Head (2 teams, default), Battle Royale (many teams), Coalition (many vs one), Seasonal League (weeks/months).
- **Flow**: Advertiser creates campaign, enables group mode, sets reward pool → users join a team → vote/promote → earn team points → winning team's members earn rewards.
- **Point earning**: vote for your team 10 (2× if trailing), vote any poll 5, share team link 15, comment 10, create content 20, invite 25, daily login 5.
- **Reward pool split**: winning team 66.7%, runner-up 25%, platform 8.3%; within winning team — top 10% take 50% of team prize, top 25% take 30%, all members split 20% equally.
- **Advertiser controls**: team size limit, reward distribution, duration, min votes to qualify, team creation (advertiser-only/open).
- **Team features**: team chat (pinned/announcement messages), team challenges (vote target, recruitment, content, share), leaderboards.
- **KPIs**: participation > 70%, team retention > 60%, vote-to-vote ratio > 1:5, campaign completion > 80%.

## 3.15 FR-DE-015: Moderation & Safety

| Priority | Description | SLA |
| -------- | ----------- | --- |
| URGENT | Illegal content, hate speech | 1 hour |
| HIGH | NSFW, spam, fraud | 4 hours |
| MEDIUM | Policy violations, disputes | 24 hours |
| LOW | Routine appeals, questions | 72 hours |

**Content policies** (abridged): products must be legitimate; claims substantiated; no NSFW; politics pre-approved only; hate speech never; visual quality high; copyright owned/licensed.

**Violation ladder**: MOD-001 first offense = warning + removal; MOD-002 second = 7-day suspension; MOD-003 third = permanent ban; MOD-004 severe = immediate permanent ban; MOD-005 appeal within 30 days.

## 3.16 FR-DE-016: Trust, Fraud & Anti-Abuse

Multi-layer detection: request validation (rate limits, request signing, IP reputation) → behavioral analysis (vote velocity, session quality, category diversity, time patterns) → device intelligence (fingerprint, reputation, aging) → graph analysis (referral rings, sybil attacks, multi-account farming) → human review (flagged accounts, appeals, manual verification).

**Vote validation**: unique voter (`UNIQUE (poll_id, user_id)`), ≥ 30s view duration (client-tracked, server-verified), device verification, IP reputation, vote velocity, account age ≥ 1 hour, poll must be ACTIVE.

## 3.17 FR-DE-017: VoterScore & AdRank Engines

**VoterScore (0–1000)** — see §4 DE-REP-001 for weights. **AdRank** — see §4 DE-ADV-004 for the formula. These are background-computed (hourly recompute, event-driven invalidations) and power leaderboards, eligibility, and ad placement.

---

# 4. Business Rules (Authoritative)

Rule IDs: `SYS`, `DE-` prefix. Where the revised economic model supersedes an original rule, the original value is recorded in §15.

## 4.1 System-Wide

| ID | Rule |
| -- | ---- |
| SYS-001 | All timestamps are UTC |
| SYS-002 | All economic operations are idempotent (idempotency keys, unique constraints) |
| SYS-003 | Every financial/moderator action is audited (audit_logs) |
| SYS-004 | Users must be email-verified to earn/spend tokens |
| SYS-005 | Soft deletion for all core entities (`deleted_at`) |
| SYS-006 | All API endpoints require authentication except public poll embeds |
| SYS-007 | Rate limiting per user per endpoint |
| SYS-008 | All requests are HTTPS |
| SYS-009 | Multi-table operations run in DB transactions |
| SYS-010 | All module data is scoped to an Organization via the Membership org context |

## 4.2 Trust & Identity (Revised)

**Trust Score (0–1000)** — revised scale (supersedes the 0–100 original):

| Component | Weight | Max | Rule |
| --------- | ------ | --- | ---- |
| Account Age | 15% | 150 | 1 point per day, max 150 |
| Email Verified | 10% | 100 | +100 if verified |
| Phone Verified | 15% | 150 | +150 if verified |
| B2B Verified | 10% | 100 | +100 if verified |
| Payment History | 10% | 100 | +25 per payment, max 100 |
| Vote Consistency | 10% | 100 | Regular voting pattern |
| Vote Diversity | 10% | 100 | Categories voted |
| Device Reputation | 10% | 100 | Clean device history |
| IP Reputation | 10% | 100 | Clean IP history |

**Trust tiers** (scale-normalized from the revision's four named levels):

| Tier | Score | Features |
| ---- | ----- | -------- |
| Unknown | 0–199 | Can vote; rewards held PENDING |
| Basic | 200–499 | Earn/spend tokens; daily cap 50 |
| Verified | 500–749 | Full earning/spending; daily cap 100 |
| Trusted | 750–1000 | Full features; priority support |

**Progressive voting limits** (DE-REP-002):

| Trust tier | Votes/min | Votes/hour | Votes/day |
| ---------- | --------- | ---------- | --------- |
| Unknown | 1 | 5 | 10 |
| Basic | 2 | 10 | 25 |
| Verified | 3 | 15 | 50 |
| Trusted | 5 | 30 | 100 |

Verification impact: email +10 trust (token earn/spend), phone +15 (purchase/payment), B2B +20 (B2B features, The Gavel), government ID +25 (future high-value).

## 4.3 Voting (DE-VOT)

| ID | Rule |
| -- | ---- |
| VOT-001 | 1 member/guest = 1 vote per poll (`UNIQUE (poll_id, user_id)`) |
| VOT-002 | Paid tiers influence exposure, **not** vote weight (supersedes the original tier-weight table) |
| VOT-003 | Weighted voting exists only through **The Gavel** (B2B 1.5×, Executive 2×) |
| VOT-004 | Weighted voting is explicitly enabled by the poll creator |
| VOT-005 | Weighted results display both raw and weighted counts |
| VOT-006 | `weighted_vote = raw_vote × user_weight` |
| VOT-007 | Display: "120 votes (150 weighted votes)" |
| VOT-008/009 | ≥ 30s view duration; session timer starts when the poll is fully loaded |
| VOT-010/011 | Timer resets on refresh; tracked client-side, verified server-side |

Vote state machine: `NOT_VOTED → VOTED_A|VOTED_B → VOTE_LOCKED → VOTE_HISTORICAL (30d) → ARCHIVED (90d)`; changeable while ACTIVE.

## 4.4 Monetization (DE-MON)

| ID | Rule |
| -- | ---- |
| MON-001 | Nominal exchange: 20 tokens = $1.00 (fixed) |
| MON-002 | Promotional bonuses do not change the nominal rate |
| MON-003 | **User rewards = ~40% of gross advertiser spend** (revised; supersedes the 70% original) |

**Revised revenue split** (of gross advertiser spend; authoritative from the money-flow model):

| Component | Share |
| --------- | ----- |
| Taxes | ~10% |
| Payment processing | ~5% |
| Invalid traffic | ~5% |
| Platform costs | ~10% |
| Platform revenue | ~20% |
| Fraud reserve | ~5% |
| Platform reserve | ~5% |
| **User rewards** | **~40%** |

**Reward mechanics**: rewards are computed on **confirmed** revenue only (provisional until provider confirmation), distributed **weekly**, proportional to weighted VoterScore (`VoterScore × trust multiplier`, multiplier 0.5–1.0). User revenue caps: Casual $5/mo, Active $25/mo, Power User $100/mo. Realistic CPM $2–5 (supersedes the unrealistic $40+).

**Refund eligibility**: full refunds for platform/system errors, duplicate submissions, technical pre-processing failures, wrong-tier within 48h (no votes), false-positive flags; no refund for violations, votes already cast, or fraudulent payments.

## 4.5 Token Ledger (DE-TKN)

| ID | Rule |
| -- | ---- |
| TKN-006 | All token transactions require an idempotency key |
| TKN-007 | Idempotency keys are unique |
| TKN-008 | Keys are included in all requests |
| TKN-009 | Keys expire after 24 hours |

Pattern: never mutate balance directly — insert a `token_transactions` row first, then update the cached balance, in a DB transaction. Lots consumed FEFO. Full double-entry design per §3.12.

## 4.6 Advertising & AdRank (DE-ADV)

| ID | Rule |
| -- | ---- |
| ADV-001 | Free users see ads during voting |
| ADV-002 | Paid users see no ads (except opt-in rewarded videos) |
| ADV-003 | Max 10 ads per user per day |
| ADV-004 | Rewarded videos are opt-in and unlimited |
| ADV-005 | Ad placement is randomized |
| ADV-006 | User share = (distributable revenue) × (user eligible events / total eligible events) |
| ADV-007 | Distributable revenue = confirmed revenue net of deductions per §4.4 |
| ADV-008 | Platform fee = the platform revenue share per §4.4 |
| ADV-009 | Revenue distributed weekly |
| ADV-010 | Rewards are PROVISIONAL until revenue is confirmed |

**AdRank** (revised — voter activity limited to 5%):

```
AD_RANK = (AD_QUALITY × 0.40) + (ADVERTISER_BUDGET × 0.25)
        + (RELEVANCE × 0.20) + (AUDIENCE_FIT × 0.10) + (VOTER_INFLUENCE × 0.05)
VOTER_INFLUENCE = (VoterScore / 1000) × 0.05        // max 5%
AD_QUALITY = (CTR × 0.30) + (CONVERSION × 0.30) + (ENGAGEMENT × 0.20) + (ADVERTISER_REPUTATION × 0.20)
```

**Qualified impression** definition: ≥ 50% viewport visibility, ≥ 1 second view duration, valid session.

**Reward state machine**: `AD_EVENT → PENDING_REWARD → FRAUD_VALIDATION → VALIDATED → REVENUE_CONFIRMATION → TOKEN_CREDITED → CONFIRMED`; reversal paths from PENDING, VALIDATED, and CONFIRMED (clawback).

**Ad ID / referrals (revised)**: qualified referral = real user (verified email), active (> 10 votes/day for 7 days), different device/IP cluster, not a duplicate account; max 5 per user; each = +5 VoterScore (max +25); **zero AdRank impact**; graph analysis detects referral rings.

## 4.7 Reputation (DE-REP)

**VoterScore (0–1000)**:

| Component | Weight | Max |
| --------- | ------ | --- |
| VOTE_VOLUME | 20% | 200 |
| VOTE_DIVERSITY | 15% | 150 |
| VOTE_CONSISTENCY | 15% | 150 |
| STREAK_LENGTH | 15% | 150 |
| ENGAGEMENT_DEPTH | 15% | 150 |
| TRUST_SCORE | 20% | 200 |

Tiers: Bronze 0–199 (1.0×), Silver 200–399 (1.2×), Gold 400–599 (1.5×), Platinum 600–799 (2.0×), Diamond 800–1000 (3.0×).

**Leaderboards**: Daily (10 tokens), Weekly (resets Monday; 🥇 1,000 tokens + 2× VoterScore 7d; 🥈 2–3: 500 + 1.5× 5d; 🥉 4–10: 250 + 1.2× 3d; 11–50: 100; 51–100: 50), Monthly (500 + 2× multiplier), All-Time (badges only). 50% of VoterScore decays after 7 days of inactivity (anti rich-get-richer).

## 4.8 Moderation (DE-MOD)

MOD-001 first violation: warning + removal. MOD-002 second: 7-day suspension. MOD-003 third: permanent ban. MOD-004 severe (illegal/hate): immediate permanent ban. MOD-005 appeals within 30 days. SLAs per §3.15.

## 4.9 State Machines (Reference)

Poll: `draft → pending → active → featured → closed → archived`; rejected on moderation. Payment: `created → processing → succeeded|failed → refunded|chargeback|partially_refunded`. Entitlement: `draft → pending_activation → active → expired|revoked|cancelled`. Submission: `draft → pending_moderation → active|rejected → featured|expired → archived` (rejected → appeal). Campaign (ads): `draft → pending_review → approved|rejected → active → paused|completed`. Moderation: `pending → in_review → approved|rejected → flagged` (appeal). Token transaction: `pending → completed|reversed|failed`.

---

# 5. Permissions (CASL Abilities)

Permissions are `subject.action` strings loaded into CASL abilities and scoped with the org condition, exactly like the rest of the platform. Route guards use `requireAbility(action, subject)`.

## 5.1 Permission Strings

| Subject | Actions |
| ------- | ------- |
| `poll` | create, publish, update, delete, vote, close, moderate |
| `poll_result` | read, export |
| `submission` | create, publish, update, delete, moderate |
| `insight` | view, export, generate_resolution |
| `market_pulse` | view, export |
| `token` | spend, gift, purchase |
| `campaign` (ads) | create, update, activate, pause, complete, moderate |
| `brand_battle` | create, update, activate, join, leave, manage |
| `team` | create, update, manage_members, manage_permissions |
| `moderation` | review, decide, appeal |
| `tier_config` | create, update, delete (admin only) |
| `benchmark` | view (aggregated) |

## 5.2 Role Matrix

| Ability | Member | Lead | Admin | Owner | Moderator | Advertiser | Guest |
| ------- | ------ | ---- | ----- | ----- | --------- | ---------- | ----- |
| `poll.create` / `poll.vote` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | vote only |
| `poll.publish` / `poll.update` / `poll.delete` | own | team | ✅ | ✅ | ✅ | own | – |
| `submission.manage` | own | team | ✅ | ✅ | – | own | – |
| `insight.view` | own | team | ✅ | ✅ | – | – | – |
| `insight.export` / `market_pulse.export` | – | team | ✅ | ✅ | – | – | – |
| `token.spend` / `token.gift` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| `campaign.manage` (ads) | – | – | – | ✅ | ✅ | ✅ | – |
| `brand_battle.manage` | – | – | – | ✅ | – | ✅ | join only |
| `team.manage` | – | ✅ | ✅ | ✅ | – | – | – |
| `moderation.review` | – | – | – | ✅ | ✅ | – | – |
| `tier_config.*` | – | – | – | ✅ | – | – | – |
| `benchmark.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (public) |

Notes: "own" = resources the member created; "team" = resources owned by the member's team. External Guests vote on public polls without an ability (embed/vote endpoints allow anonymous participation) and never see member or organization data.

**Data visibility rules**:

| Data | Visible to |
| ---- | ---------- |
| Member's own votes | Member only |
| Team votes (aggregated) | Team members |
| Team votes (individual) | Team Lead |
| Organization votes (aggregated) | Admin/Owner |
| Anonymized benchmark data | All users |
| Raw vote data | Admin only |

---

# 6. UI Flow

The "Luminous" light theme is the default (superseding the original dark-only MVP). Design tokens: base colors `#F8F9FA` / `#FFFFFF` / `#1E1E1E` / `#6B7280` / `#E5E7EB`; shadows L1 `0 8px 24px rgba(0,0,0,0.04)`; gradients per poll type; winner emerald `#10B981`, losing crimson `#EF4444`, active selection deep emerald `#00E676`, clash amber `#F59E0B`. Dark theme inverts the palette (`#1A1A1A` / `#242424` / `#E5E5E5` / `#9CA3AF`). Typography: Plus Jakarta Sans (headers), Inter (body), Playfair Display (editorial narratives), SF Pro Text (badges). Grid: 4/8/12 columns; gutters 16/16/24px; cards 24px radius.

## 6.1 Decision Studio (Create)

```
[Classic] [Quiz] [Duel] [Matrix] [Blind] [The Gavel]
┌──────────────────────────────┬──────────────────────────────┐
│  IMAGE UPLOAD ZONE           │  LIVE PREVIEW                │
│  [Drag & Drop] [Browse]      │  (iPhone frame mock)         │
│  Auto-crops to 4:5           │  Question / Options render   │
└──────────────────────────────┴──────────────────────────────┘
Duration [1h|6h|1d|3d|7d]   Audience [All|Team|B2B|Custom]
Tags [AI-suggested]
[Save Draft] [Preview] [Publish]
```

## 6.2 Feed Card

```
⊚ Avatar  Creator  · 2h ago        ⋮
┌──────────────┬──────────────────┐
│  OPTION A    │   OPTION B       │
│  [Image]     │   [Image]        │
│  [Vote]      │   [Vote]         │
└──────────────┴──────────────────┘
         ❓ Question (glass pill)
54% ██████████│██░░░░░░░░ 46%
❤ 124          💬 37 Comments
```

**Swift-Decide gesture**: swipe right → Option A (110% scale, checkmark), Option B fades to 40%; release confirms with haptic; results animate in real time. Tap-to-vote alternative.

## 6.3 The Verdict

- **Alignment Report**: sunburst chart (inner/outer rings per person), category bars, AI narrative ("Golden Hour Co-Creators"), clash alert + [Create Resolution Poll], [Download PDF] [Share].
- **Battle Report**: blue/red rival meters, glowing clash-point diamond, stats row.
- **Market Pulse**: benchmark arc (industry avg vs org audience), insight sentence, [Share to LinkedIn].

## 6.4 Vibe Insights

Persona profile (archetype, category scores, traits, growth areas, recent activity) → Team collective polarity map (alignment heatmap by department, friction alerts) → Cross-pollination (user-to-user, user-to-team, team-to-team, org-to-industry) → Resolution Poll generator.

## 6.5 Wallet & Advertiser

- **Wallet**: balance (available/pending/locked), package purchase flow, transaction history, FEFO-aware spend, receipts.
- **Advertiser dashboard**: budget/spent/remaining, team performance, ROI, engagement, [Pause] [Increase Budget] [Analytics].
- **Brand battle**: team selection screen, team dashboard (stats, contribution, potential reward), voting-for-team screen, team chat, challenges, leaderboard.

---

# 7. API Reference

Consolidated from the PRD (§10.3), TRD (§9), the revised economic model (§13), and the group advertising spec (§8.2). All authenticated endpoints require the access-token cookie; responses use the platform `{ data }` / `{ error }` envelope. **All org-scoped resources require the org context (orgId from the access token) — no cross-tenant access.**

## 7.1 Polls & Voting

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/polls` | List accessible polls | JWT |
| POST | `/api/v1/polls` | Create poll | JWT |
| GET | `/api/v1/polls/:id` | Get poll | JWT |
| PUT | `/api/v1/polls/:id` | Update poll (draft/owner) | JWT |
| DELETE | `/api/v1/polls/:id` | Soft-delete poll | JWT |
| POST | `/api/v1/polls/:id/publish` | Publish | JWT |
| POST | `/api/v1/polls/:id/close` | Close early | JWT |
| GET | `/api/v1/polls/feed` | Feed polls | JWT |
| GET | `/api/v1/polls/trending` | Trending polls | JWT |
| POST | `/api/v1/polls/:id/vote` | Cast vote | JWT/Public* |
| PUT | `/api/v1/polls/:id/vote` | Change vote | JWT/Public* |
| DELETE | `/api/v1/polls/:id/vote` | Withdraw vote | JWT/Public* |
| GET | `/api/v1/polls/:id/results` | Results | JWT |
| GET | `/api/v1/polls/:id/timeline` | Time-based results | JWT |
| GET | `/api/v1/polls/:id/segments` | Segment breakdown | JWT |

\* Public poll embeds permit External Guest votes via a visitor token; the vote is bound to a guest identity and aggregated anonymously.

## 7.2 Submissions

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/submissions` | List submissions | JWT |
| POST | `/api/v1/submissions` | Create submission | JWT |
| GET | `/api/v1/submissions/:id` | Get submission | JWT |
| PUT | `/api/v1/submissions/:id` | Update | JWT |
| DELETE | `/api/v1/submissions/:id` | Delete | JWT |
| POST | `/api/v1/submissions/:id/publish` | Publish (requires entitlement) | JWT |
| GET | `/api/v1/submissions/feed` | Submission feed | JWT |
| GET | `/api/v1/submissions/my` | My submissions | JWT |

## 7.3 Insights, Analytics & Export

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/insights/me` | My persona profile | JWT |
| GET | `/api/v1/insights/compatibility/:userId` | Compatibility with a member | JWT |
| GET | `/api/v1/insights/team/:teamId` | Team analysis | JWT |
| GET | `/api/v1/insights/team/:teamId/members` | Team member insights | JWT |
| POST | `/api/v1/insights/resolution` | Generate resolution poll | JWT |
| GET | `/api/v1/insights/archetypes` | Archetype definitions | JWT |
| GET | `/api/v1/analytics/heatmap/:submissionId` | CV heatmap | JWT |
| GET | `/api/v1/analytics/benchmark/:category` | Market pulse benchmark | JWT |
| GET | `/api/v1/analytics/poll/:pollId` | Detailed poll analytics | JWT |
| GET | `/api/v1/analytics/export` | Export analytics | JWT |
| GET | `/api/v1/export/pdf/:pollId` | PDF report | JWT |
| GET | `/api/v1/export/gif/:pollId` | GIF animation | JWT |
| GET | `/api/v1/export/csv/:pollId` | CSV data | JWT |
| GET | `/api/v1/export/embed/:pollId` | Embed code | Public |

## 7.4 Tokens & Payments

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/tokens/balance` | Balance | JWT |
| GET | `/api/v1/tokens/history` | Ledger history | JWT |
| GET | `/api/v1/tokens/packages` | Packages | JWT |
| POST | `/api/v1/tokens/purchase` | Purchase tokens | JWT |
| GET | `/api/v1/tokens/earnings` | Earning summary | JWT |
| POST | `/api/v1/tokens/gift` | Gift tokens | JWT |
| POST | `/api/v1/payments/checkout` | Checkout session | JWT |
| POST | `/api/v1/payments/webhook` | Payment webhook | Provider |
| GET | `/api/v1/payments/:id` | Payment status | JWT |
| GET | `/api/v1/payments/receipt/:id` | Receipt | JWT |
| POST | `/api/v1/payments/refund/:id` | Request refund | JWT |

## 7.5 Reputation, Rewards & Leaderboards (Revised)

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/voter-score` | My VoterScore | JWT |
| GET | `/api/v1/voter-score/history` | VoterScore history | JWT |
| GET | `/api/v1/ad-rank` | My AdRank | JWT |
| POST | `/api/v1/ad-rank/recalculate` | Recalculate AdRank | Admin |
| GET | `/api/v1/rewards/eligible` | Reward eligibility | JWT |
| GET | `/api/v1/rewards/history` | Reward history | JWT |
| GET | `/api/v1/rewards/estimated` | Estimated rewards | JWT |
| GET | `/api/v1/leaderboard/weekly` | Weekly leaderboard | JWT |
| GET | `/api/v1/leaderboard/monthly` | Monthly leaderboard | JWT |
| GET | `/api/v1/leaderboard/all-time` | All-time leaderboard | JWT |
| POST | `/api/v1/trust/verify` | Submit verification | JWT |
| GET | `/api/v1/trust/status` | Trust status | JWT |

## 7.6 Advertising & Group Campaigns

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| POST | `/api/v1/campaigns/group` | Create group campaign | Advertiser |
| GET | `/api/v1/campaigns/group` | List group campaigns | JWT |
| GET | `/api/v1/campaigns/group/:id` | Campaign details | JWT |
| PUT | `/api/v1/campaigns/group/:id` | Update | Advertiser |
| POST | `/api/v1/campaigns/group/:id/activate` | Activate | Advertiser |
| POST | `/api/v1/campaigns/group/:id/pause` | Pause | Advertiser |
| POST | `/api/v1/campaigns/:id/teams` | Create team | Advertiser |
| GET | `/api/v1/campaigns/:id/teams` | List teams | JWT |
| POST | `/api/v1/teams/:id/join` | Join team | JWT |
| POST | `/api/v1/teams/:id/leave` | Leave team | JWT |
| GET | `/api/v1/teams/:id/leaderboard` | Leaderboard | JWT |
| GET | `/api/v1/teams/:id/members` | Members | JWT |
| GET | `/api/v1/teams/:id/challenges` | Challenges | JWT |
| POST | `/api/v1/teams/:id/challenges/:challenge/complete` | Complete challenge | JWT |
| POST | `/api/v1/teams/:id/messages` | Send message | JWT |
| GET | `/api/v1/teams/:id/messages` | Get messages | JWT |
| PUT | `/api/v1/messages/:id/pin` | Pin message | Captain |
| POST | `/api/v1/teams/:id/vote` | Vote for team | JWT |
| GET | `/api/v1/teams/:id/votes` | Team votes | JWT |

## 7.7 Admin

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/api/v1/admin/users` | List users | Admin |
| PUT | `/api/v1/admin/users/:id/suspend` | Suspend user | Admin |
| PUT | `/api/v1/admin/users/:id/unsuspend` | Unsuspend | Admin |
| PUT | `/api/v1/admin/users/:id/role` | Update role | Admin |
| GET | `/api/v1/admin/metrics` | Platform metrics | Admin |
| GET | `/api/v1/admin/moderation` | Moderation queue | Admin/Moderator |
| PUT | `/api/v1/admin/moderation/:id` | Review | Admin/Moderator |
| POST/PUT/DELETE | `/api/v1/admin/tiers(/):id` | Tier config CRUD | Admin |

---

# 8. Database Schema

All module tables are **organization-scoped** (`organization_id`) and soft-deletable. Tables marked * unchanged-from-TRD exist in the source TRD §8.2 and are only summarized here.

## 8.1 Polls & Voting

```sql
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('classic','quiz','duel','matrix','blind','gavel')),
    title VARCHAR(280) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','pending','active','featured','closed','archived','rejected')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public','team','private')),
    audience VARCHAR(20) DEFAULT 'all' CHECK (audience IN ('all','team','b2b','custom')),
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
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_polls_org_status ON polls(organization_id, status);
CREATE INDEX idx_polls_status_duration_end ON polls(status, duration_end) WHERE status = 'active';
CREATE INDEX idx_polls_categories ON polls USING GIN(categories);
```

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
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_options_poll_id ON options(poll_id, "order");
```

```sql
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- member or guest
    option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0.5 AND weight <= 2.0),  -- Gavel only
    is_anonymous BOOLEAN DEFAULT FALSE,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    view_duration INTEGER NOT NULL CHECK (view_duration >= 0),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed','rejected','reversed')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (poll_id, user_id)
);
CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_created_at ON votes(created_at);   -- monthly range partition
```

```sql
CREATE TABLE vote_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    previous_option_id UUID NOT NULL REFERENCES options(id),
    new_option_id UUID NOT NULL REFERENCES options(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 8.2 Submissions

```sql
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    media JSONB NOT NULL,   -- { primary, gallery[], thumbnails[] }
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','pending_moderation','active','featured','expired','archived','rejected')),
    tier VARCHAR(20) CHECK (tier IN ('bronze','silver','gold','platinum')),
    categories TEXT[] DEFAULT '{}', tags TEXT[] DEFAULT '{}',
    views INTEGER DEFAULT 0, votes INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, shares INTEGER DEFAULT 0,
    ranking INTEGER,
    current_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ, expired_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_submissions_org_status_ranking ON submissions(organization_id, status, ranking) WHERE status = 'active';
CREATE INDEX idx_submissions_tier ON submissions(tier);
```

```sql
CREATE TABLE submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    media JSONB NOT NULL, title VARCHAR(100) NOT NULL, description TEXT,
    vote_count_reset BOOLEAN DEFAULT FALSE, change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (submission_id, version_number)
);
```

## 8.3 Reputation & Ad Ranking (Revised Engines)

```sql
CREATE TABLE voter_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_volume INTEGER DEFAULT 0,       -- 20% / 200
    vote_diversity INTEGER DEFAULT 0,    -- 15% / 150
    vote_consistency INTEGER DEFAULT 0,  -- 15% / 150
    streak_length INTEGER DEFAULT 0,     -- 15% / 150
    engagement_depth INTEGER DEFAULT 0,  -- 15% / 150
    trust_component INTEGER DEFAULT 0,   -- 20% / 200
    total_score INTEGER DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 1000),
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum','diamond')),
    daily_votes INTEGER DEFAULT 0, weekly_votes INTEGER DEFAULT 0, monthly_votes INTEGER DEFAULT 0,
    last_vote_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_voter_scores_total ON voter_scores(total_score DESC);
```

```sql
CREATE TABLE ad_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_quality_score INTEGER DEFAULT 0, advertiser_budget_score INTEGER DEFAULT 0,
    relevance_score INTEGER DEFAULT 0, audience_fit_score INTEGER DEFAULT 0,
    voter_influence_score INTEGER DEFAULT 0 CHECK (voter_influence_score <= 50),  -- max 5%
    total_rank_score INTEGER DEFAULT 0,
    visibility_multiplier DECIMAL(4,2) DEFAULT 1.0,
    ctr DECIMAL(5,2) DEFAULT 0, conversion_rate DECIMAL(5,2) DEFAULT 0, engagement_rate DECIMAL(5,2) DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ad_rankings_total ON ad_rankings(total_rank_score DESC);
```

```sql
CREATE TABLE qualified_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_id UUID NOT NULL REFERENCES campaigns(id),
    view_duration_seconds INTEGER NOT NULL CHECK (view_duration_seconds >= 0),
    viewport_visibility DECIMAL(5,2) NOT NULL CHECK (viewport_visibility >= 0 AND viewport_visibility <= 100),
    is_qualified BOOLEAN DEFAULT FALSE,          -- ≥50% visibility, ≥1s, valid session
    revenue_share DECIMAL(10,4),
    fraud_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_qualified_impressions_user ON qualified_impressions(user_id);
CREATE INDEX idx_qualified_impressions_qualified ON qualified_impressions(is_qualified);
```

## 8.4 Group Advertising (Battle of the Brands)

```sql
CREATE TABLE group_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, description TEXT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('head_to_head','battle_royale','coalition','seasonal_league')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
    budget DECIMAL(10,2) NOT NULL,
    platform_match DECIMAL(10,2) DEFAULT 0,
    total_prize_pool DECIMAL(10,2),
    duration_start TIMESTAMPTZ NOT NULL, duration_end TIMESTAMPTZ NOT NULL,
    max_team_size INTEGER, min_votes_to_qualify INTEGER DEFAULT 5,
    reward_distribution JSONB, current_winner_id UUID, metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_group_campaigns_org_status ON group_campaigns(organization_id, status);
```

```sql
CREATE TABLE group_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES group_campaigns(id) ON DELETE CASCADE,
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, logo_url TEXT, description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','disqualified','withdrawn')),
    total_votes INTEGER DEFAULT 0, total_points INTEGER DEFAULT 0, member_count INTEGER DEFAULT 0,
    rank_position INTEGER, is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_group_teams_campaign_votes ON group_teams(campaign_id, total_votes DESC);
```

```sql
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member','captain','co_captain')),
    points INTEGER DEFAULT 0, votes_cast INTEGER DEFAULT 0,
    shares_generated INTEGER DEFAULT 0, referrals_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(), last_active_at TIMESTAMPTZ,
    UNIQUE (team_id, user_id)
);
CREATE INDEX idx_group_members_points ON group_members(points DESC);
```

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
CREATE INDEX idx_group_votes_member ON group_votes(group_member_id);
```

```sql
CREATE TABLE team_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('vote_target','recruitment','content_creation','share_target')),
    target INTEGER NOT NULL, current_progress INTEGER DEFAULT 0,
    reward_points INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','failed')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES group_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, attachments JSONB,
    is_pinned BOOLEAN DEFAULT FALSE, is_announcement BOOLEAN DEFAULT FALSE,
    parent_id UUID REFERENCES group_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_group_messages_team ON group_messages(team_id, created_at DESC);
```

## 8.5 Monetization, Ledger, Advertising, Moderation & Audit

These tables are fully specified in the source TRD §8.2 and are unchanged by the revision. Key notes:

| Table | Purpose | Key columns |
| ----- | ------- | ----------- |
| `tier_configs` | Submission tier pricing/entitlements | name, price_usd, token_price, duration_seconds, starting_position, featured_badge, pin_duration_seconds, watermark_removable, **vote_weight = 1.0 (exposure only)** |
| `purchases` | Tier/boost/subscription purchases | product_type, funding_source, amount, currency, status, idempotency_key |
| `entitlements` | Time-bound rights from purchases | type, tier_snapshot (frozen JSON), starts_at, expires_at, status, used |
| `payments` | Provider payments | provider, provider_payment_id, status, idempotency_key, receipt_url |
| `token_accounts` | Per-user balance (cached) | total/available/pending/locked balance |
| `token_transactions` | Immutable ledger | type, direction, amount, status, source, reference_id, idempotency_key |
| `token_lots` | FEFO lots | amount, remaining_amount, expires_at, status |
| `token_transaction_items` | Ledger line items | amount, balance_after |
| `campaigns` * | Ad campaigns | budget, bid, targeting, schedule, metrics, status |
| `creatives` * | Ad creatives | type, url, dimensions, cta, status |
| `impressions` * | Ad impressions | type, status, revenue_estimated/confirmed, viewed_at |
| `ad_rewards` * | Ad reward lifecycle | type, status (pending/validated/confirmed/reversed), tokens_awarded |
| `moderation_queue` * | Review queue | resource_type, priority, status, assigned_to |
| `moderation_decisions` * | Decisions | decision, decision_maker_id, appealable_until |
| `appeals` * | Appeals | status, resolved_by |
| `audit_logs` * | Compliance trail | actor, action, resource, before/after JSON |

**Partitioning**: `votes`, `token_transactions`, `impressions`, `audit_logs` partitioned monthly by `created_at`. **Data retention** (GDPR/CCPA): profile until deletion; poll results & votes 36 months (anonymized after); token transactions & audit 7 years; deleted accounts 30 days.

---

# 9. Notifications

## 9.1 In-App

| Type | Visual | Duration | Action |
| ---- | ------ | -------- | ------ |
| Success | Green toast, checkmark | 3s | Auto-dismiss |
| Error | Red toast | 5s | Dismiss or Retry |
| Info | Blue toast | 4s | Auto-dismiss |
| Earning | Gold toast, token icon | 3s | Auto-dismiss |
| Milestone | Full-screen confetti | 5s | View achievement |

## 9.2 Push

| Type | Priority | Example |
| ---- | -------- | ------- |
| New Vote | Medium | "Your poll 'Logo Design' received 10 new votes!" |
| Poll Ending | High | "Your poll ends in 1 hour. View results now!" |
| Milestone Reached | High | "Your poll reached 100 votes!" |
| Badge Unlocked | Medium | "You unlocked the 'Gold Gavel' badge!" |
| Comment Received | Low | "@sarah commented on your poll." |
| Token Earned | Low | "You earned 5 tokens from today's votes." |
| Clash Detected | Medium | "Your team has a 34% clash on work hours. Create a resolution poll?" |

Notifications ride the platform's Module 9 plumbing; delivery channels (email/SMS/in-app) follow platform preferences.

---

# 10. Error Handling

Errors use the platform envelope: `{ error: { code, message, details? } }`.

| Code | Meaning |
| ---- | ------- |
| `DUPLICATE_VOTE` | User already voted on this poll (idempotent) |
| `VIEW_DURATION_TOO_SHORT` | Vote before the 30s minimum |
| `INVALID_DEVICE` | Device verification failed |
| `IP_BLOCKED` | Known fraud IP |
| `VOTE_VELOCITY_EXCEEDED` | Exceeded per-trust-tier limits |
| `ACCOUNT_TOO_NEW` | Account under 1 hour old |
| `POLL_NOT_ACTIVE` | Poll closed/rejected/archived |
| `TRUST_TOO_LOW` | Trust below threshold for the action |
| `TOKEN_INSUFFICIENT` | Insufficient available balance |
| `ENTITLEMENT_REQUIRED` | Missing/expired tier entitlement |
| `ALREADY_REFERRED` / `SELF_REFERRAL` / `REFERRER_NOT_TRUSTED` | Referral fraud guards |
| `IDEMPOTENCY_CONFLICT` | Reused idempotency key mismatch |
| `TENANT_MISMATCH` | org context does not match the resource |
| `MODERATION_REJECTED` | Content rejected by moderation |

**Graceful degradation**: core voting remains available if analytics/insights fail (feature flags + circuit breakers); reward crediting is deferred to the next batch rather than failing the vote; public embeds fall back to static results if the real-time socket is down.

---

# 11. Non-Functional Requirements

## 11.1 Performance

| Metric | Target |
| ------ | ------ |
| API P95 latency | < 200 ms |
| Real-time update latency | < 100 ms |
| Vote processing rate | 10,000/sec |
| Concurrent active users | 100,000 |
| Cache hit rate | > 95% |
| FCP / TTI (web) | < 1s / < 2s |
| Heatmap processing | < 5s per image |
| PDF generation | < 3s |

## 11.2 Security

- All endpoints authenticated except public embeds; HTTPS enforced; Helmet + CORS.
- Rate limiting (register 5/h, login 10/5min, vote 10/min, poll create 10/h, comment 10/5min, token purchase 3/h, gift 5/h).
- Audit logging of auth, financial, content, moderation, admin, and security events.
- GDPR/CCPA: access (`/privacy/data`), erasure (`/privacy/erase`), portability (`/privacy/export`), consent (`/privacy/consent`).

## 11.3 Reliability & Economics

- Eventual consistency via event-driven architecture (domain events: `poll.*`, `vote.*`, `token.*`, `payment.*`, `ad.*`, `campaign.*`, `moderation.*`).
- Immutable token ledger; idempotent economic operations; database transactions for multi-table writes.
- Economic sustainability: rewards ≤ confirmed net revenue (revised model); user reward share ~40% of gross advertiser spend.

---

# 12. Edge Cases

| Scenario | Behaviour |
| -------- | --------- |
| Vote before 30s view duration | Rejected with `VIEW_DURATION_TOO_SHORT`; timer resets on refresh |
| User changes vote after poll closes | Blocked; vote is LOCKED |
| Poll reaches deadline mid-vote | Vote rejected, `POLL_NOT_ACTIVE` |
| Duplicate vote submission (retry) | Idempotent; returns existing vote |
| Token spend racing with balance change | Ledger row created first; insufficient balance aborts the transaction |
| Gift tokens to inactive account | Held pending until recipient is active/verified |
| Ad reward reversed after crediting | Clawback via reversal transaction; audit logged |
| Referral ring detected | Graph analysis flags; rewards reversed; account review |
| Guest votes on org poll | Aggregated anonymously; guest identity never exposes org data |
| White-label export for non-Enterprise | Blocked at ability layer (`insight.export` absent) |
| Embed widget on non-HTTPS site | Refused by CSP/HTTPS policy |

---

# 13. Future Enhancements

- Programmatic ad buying and token subscriptions (recurring token purchases).
- Full GDPR/CCPA automation and enterprise security audit badges.
- Advanced RBAC permission UI.
- Advanced embeddable widgets (fully customizable) and cross-team analytics.
- Computer-vision heatmaps for video content; real-time heatmap streaming.
- Slack/Teams integrations for in-channel polling.
- Government-ID verification tier for high-value transactions.

---

# 14. Document Approvals

| Role | Name | Date | Signature |
| ---- | ---- | ---- | --------- |
| Product Lead | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Compliance | | | |

---

# 15. Superseded Values (Original PRD/TRD → Revised)

| Original | Revised | Rationale |
| -------- | ------- | --------- |
| User revenue share 70% of gross | **~40% of gross advertiser spend** (per money-flow split) | 70% would bankrupt the platform |
| Trust Score 0–100 | **0–1000** (9 weighted components) | Finer-grained fraud resistance |
| Paid tiers give vote weight 1.2×/1.5×/2× | **Tiers affect exposure only; vote weight stays 1.0** | Paid placement must not distort votes; only The Gavel weights |
| Voting → AdRank direct (50%) | **VoterScore → AdRank influence ≤ 5%** | Prevent manufactured ad value |
| AdRank → guaranteed revenue | **AdRank based on ad quality; rewards = share of confirmed revenue** | Decouple voting from money |
| $40+ CPM assumptions | **$2–5 realistic CPM**; earnings estimated, capped | Revenue realism |
| Ad ID → AdRank benefit | **Ad ID = qualified referrals only, +5 VoterScore each (max 5), zero AdRank impact** | Kill referral farming |
| Static leaderboards | **Weekly/monthly resets + 50% VoterScore decay after 7d inactivity** | Prevent rich-get-richer |
| Dark theme only (MVP) | **"Luminous" light theme default, dark fallback** | Premium professional clarity |
| Trust Score factor table (0–100, 8 factors) | **0–1000, 9 components** (device + IP reputation separated) | Revision §10.2 |

---

# 16. Appendix

## 16.1 Module Glossary

| Term | Definition |
| ---- | ---------- |
| **Poll** | A decision instrument with options and a voting window; the module's core unit |
| **Vote** | One participant's selection on a poll (1 per user per poll; weighted only under The Gavel) |
| **Option** | A selectable choice on a poll, with optional image and label |
| **Decision Studio** | Poll creation interface with live preview |
| **The Verdict** | Results and share cards after a poll ends |
| **Vibe Insight** | AI-generated psychographic analysis of preferences |
| **Market Pulse** | Aggregate benchmarking against anonymized industry averages |
| **Submission** | A tiered media entry that others vote on (aligned with the platform's Entry concept) |
| **VoterScore** | 0–1000 engagement-quality score driving eligibility and multipliers |
| **Trust Score** | 0–1000 fraud-resistance score (revised scale) |
| **AdRank** | Ad-placement score; voter influence capped at 5% |
| **Bountied Poll** | Poll with a prize for the user whose vote matches the result |
| **Battle of the Brands** | A Campaign of type `brand_battle` where teams compete to promote an advertiser |
| **External Guest** | An unauthenticated participant who votes on public polls |

## 16.2 Priority Matrix (Abridged)

| Feature | MVP | Beta | Full |
| ------- | --- | ---- | ---- |
| Poll creation, voting, results | ✅ | ✅ | ✅ |
| Decision Studio + templates | ✅ | ✅ | ✅ |
| Poll types (Quiz, Duel) | – | ✅ | ✅ |
| Poll types (Matrix, Blind, Gavel) | – | – | ✅ |
| Feed sorting/filtering | ✅ | ✅ | ✅ |
| Vibe Insights (basic → full) | – | ✅ | ✅ |
| Market Pulse + heatmaps | – | – | ✅ |
| Gamification (RP, streaks, badges) | ✅ | ✅ | ✅ |
| Bountied polls | – | ✅ | ✅ |
| Team collaboration | – | ✅ | ✅ |
| Share/export (GIF, PDF, embed) | ✅ | ✅ | ✅ |
| White-label export | – | – | ✅ |
| Submission tiers + ranking | ✅ | ✅ | ✅ |
| Token economy + ledger | ✅ | ✅ | ✅ |
| Payments (Stripe/Paystack) | ✅ | ✅ | ✅ |
| Advertising + revenue share | – | ✅ | ✅ |
| Battle of the Brands | – | – | ✅ |
| Trust/fraud engine | ✅ | ✅ | ✅ |
| Moderation + appeals | ✅ | ✅ | ✅ |
| GDPR/CCPA | – | ✅ | ✅ |

## 16.3 Key Formulas

```
VOTER_SCORE = (VOTE_VOLUME × .20) + (VOTE_DIVERSITY × .15) + (VOTE_CONSISTENCY × .15)
            + (STREAK_LENGTH × .15) + (ENGAGEMENT_DEPTH × .15) + (TRUST_SCORE × .20)     // 0–1000
AD_RANK     = (AD_QUALITY × .40) + (ADVERTISER_BUDGET × .25) + (RELEVANCE × .20)
            + (AUDIENCE_FIT × .10) + (VOTER_INFLUENCE × .05)                              // ≤5% voter influence
USER_SHARE  = (USER_VOTER_SCORE / TOTAL_VOTER_SCORE) × USER_REWARDS                       // weekly, confirmed revenue
FINAL_SCORE = (ORGANIC_POPULARITY × .6) + (PAID_EXPOSURE × .3) + (FRESHNESS × .1)         // submission ranking
```

---

# 17. Related Documents

| Document | Location |
| -------- | -------- |
| Source PRD (superseded in part) | `docs/modules/new features/Product Requirements Document.md` |
| Source TRD (superseded in part) | `docs/modules/new features/Technical Requirements Document.md` |
| Source economic revision (authoritative) | `docs/modules/new features/ENGAGEMENT & ADVERTISING.md` |
| Domain glossary | `CONTEXT.md` |
| Platform docs | `docs/technical/*`, `docs/product/*`, `docs/modules/*` |

---

## Document Version History

| Version | Date | Author | Changes |
| ------- | ---- | ------ | ------- |
| 1.0.0 | 2026-08-18 | Spec consolidation | Consolidated PRD + TRD + economic revision into one module spec; rebased onto Nawebeus tenancy; revision wins for the economic model |

---

_End of Nawebeus Decision Engine Module Specification_