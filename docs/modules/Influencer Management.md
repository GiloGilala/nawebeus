\# Module 10: Influencer Management



\*\*Document Version:\*\* 1.0.0

\*\*Last Updated:\*\* 2026-07-21

\*\*Status:\*\* Active

\*\*Owner:\*\* Product Lead \& Engineering Lead



\---



\## 1. Module Overview



\### 1.1 Purpose



The Influencer Management module provides comprehensive tools for discovering, managing, and measuring influencer relationships and programs — calibrated for the Nigerian and African creator economy. It enables marketing teams to identify relevant Nigerian and African influencers, track relationships, manage programs with ₦ (NGN) budgets, and measure ROI against real business outcomes.



This module transforms influencer marketing from a manual, relationship-driven process into a scalable, data-driven capability that delivers measurable ₦ business results for Nigerian brands and agencies.



\### 1.2 Module Objectives



| Objective | Success Measure | Nigerian Context |

|-----------|-----------------|-----------------|

| \*\*Influencer Discovery\*\* | ≥85% relevance accuracy | Includes Nigerian micro and macro creators across Instagram, TikTok, YouTube, Twitter/X |

| \*\*Relationship Management\*\* | Complete relationship history | WhatsApp as primary Nigerian influencer communication channel |

| \*\*program Management\*\* | 100% ₦ program tracking | Budget, payments, and deliverables in NGN |

| \*\*₦ ROI Measurement\*\* | Accurate ₦ ROI calculations | Nigerian market cost benchmarks |

| \*\*Brand Safety\*\* | Real-time compliance monitoring | Nigerian regulatory context (APCON, CAC guidelines) |

| \*\*Fraud Detection\*\* | ≥90% fraud detection accuracy | Nigerian influencer fraud patterns detection |



\### 1.3 Target Users



| Persona | Role | Primary Use Cases |

|---------|------|-------------------|

| \*\*Chidi\*\* (Head of Marketing, Fintech) | Admin / Manager | Influencer strategy, program oversight, ₦ ROI measurement |

| \*\*Ifeoma\*\* (Agency Owner) | Owner (Agency tier) | Multi-client influencer management, per-client ₦ reporting |

| \*\*Bola\*\* (Social Media Manager, Telecom) | Creator | Influencer outreach, program execution, content coordination |

| \*\*Kemi\*\* (Content Strategist, E-commerce) | Analyst | Influencer content planning, performance analysis, optimization |



\### 1.4 Module Scope



\*\*In Scope:\*\*

\- Multi-platform influencer discovery (Instagram, TikTok, YouTube, Twitter/X, Facebook)

\- Nigerian creator database with tier classification

\- Audience demographics and authenticity analysis

\- Influence scoring with fraud detection

\- Relationship CRM (profiles, interactions, WhatsApp communication tracking)

\- program management (brief, invite, contract, content approval, ₦ payment tracking)

\- ₦ ROI measurement (reach, engagement, conversion, revenue attribution)

\- Brand safety monitoring (APCON compliance, Nigerian regulatory context)

\- Multi-client management (Agency tier isolation)

\- Content approval workflows



\*\*Out of Scope (Future Phases):\*\*



| Feature | Phase | Timeline |

|---------|-------|---------|

| Influencer marketplace (self-service creator registration) | Phase 7 | Q3 2027 |

| Automated influencer outreach AI | Phase 6 | Q2 2027 |

| Predictive influencer performance modeling | Phase 7 | Q3 2027 |

| Cross-platform influencer attribution | Phase 6 | Q2 2027 |

| Influencer payment automation (Paystack integration) | Phase 5 | Q1 2027 |



\### 1.5 Dependencies



| Module | Relationship |

|--------|-------------|

| \*\*Module 1: Authentication\*\* | JWT authentication for all influencer endpoints |

| \*\*Module 2: Organization \& Account Management\*\* | RBAC enforcement; plan limits; ₦ budget configuration |

| \*\*Module 3 \& 5: Listening \& Monitoring\*\* | Influencer mention tracking; content performance from monitoring |

| \*\*Module 7: Analytics \& Reporting\*\* | program ₦ performance in unified dashboards |

| \*\*Module 6: Engagement Hub\*\* | Influencer engagement tracking and response |

| \*\*Module 9: Notifications\*\* | program alerts, content approval notifications |



\---



\## 2. User Stories



\### 2.1 Head of Marketing / program Owner



| ID | As a... | I want to... | So that... | Priority |

|----|---------|--------------|------------|----------|

| US-INF-01 | Head of Marketing | Discover relevant Nigerian influencers across platforms filtered by category, location, and audience size | I build an influencer program with creators who genuinely reach my target market | P0 |

| US-INF-02 | Head of Marketing | See Nigerian influencer audience demographics (age, gender, state, income) | I ensure the creator's audience matches my brand's Nigerian customer profile | P0 |

| US-INF-03 | Head of Marketing | Track all Nigerian influencer relationships in one database | I maintain and grow strategic creator relationships | P0 |

| US-INF-04 | Head of Marketing | Manage influencer programs end-to-end with ₦ budget tracking | I run structured programs and control ₦ spend | P0 |

| US-INF-05 | Head of Marketing | Measure ₦ influencer ROI (cost per engagement, cost per conversion, revenue attributed) | I justify influencer budget to the CFO and MD | P0 |

| US-INF-06 | Head of Marketing | Detect fraudulent Nigerian influencers (fake followers, bought engagement) | I don't waste ₦ budget on creators with inauthentic audiences | P0 |

| US-INF-07 | Head of Marketing | Monitor brand safety in influencer content against Nigerian APCON guidelines | I protect the brand from compliance violations | P1 |

| US-INF-08 | Head of Marketing | Compare ₦ cost-per-result across influencers | I optimize budget allocation to highest-performing creators | P1 |



\### 2.2 Social Media Manager / program Executor



| ID | As a... | I want to... | So that... | Priority |

|----|---------|--------------|------------|----------|

| US-INF-10 | Social Media Manager | Contact Nigerian influencers via email and WhatsApp from within the platform | I manage all outreach in one place without switching apps | P0 |

| US-INF-11 | Social Media Manager | Create program briefs and share with influencers | Creators understand exactly what's required | P0 |

| US-INF-12 | Social Media Manager | Review and approve influencer content before it goes live | I maintain brand quality and APCON compliance | P0 |

| US-INF-13 | Social Media Manager | Track deliverables against program contracts in ₦ | I know which creators have fulfilled their obligations | P1 |

| US-INF-14 | Social Media Manager | Log interactions (email, WhatsApp, phone, meeting) with Nigerian creators | I maintain a complete relationship history | P1 |



\### 2.3 Agency Owner (Multi-Client)



| ID | As a... | I want to... | So that... | Priority |

|----|---------|--------------|------------|----------|

| US-INF-20 | Agency Owner | Manage influencer programs for multiple Nigerian brand clients from one platform | I scale my agency without proportional headcount growth | P0 |

| US-INF-21 | Agency Owner | Generate white-label ₦ ROI reports per client | I present professional program reports on my agency's letterhead | P0 |

| US-INF-22 | Agency Owner | Share influencer relationships across client programs (where permitted) | I leverage creator relationships across my client portfolio | P1 |



\### 2.4 Content Strategist / Analyst



| ID | As a... | I want to... | So that... | Priority |

|----|---------|--------------|------------|----------|

| US-INF-30 | Content Strategist | Analyze influencer content performance (reach, engagement, conversion) | I identify which content formats work with Nigerian audiences | P1 |

| US-INF-31 | Analyst | Export influencer data and ₦ program metrics | I can build presentations and do deeper analysis in Power BI | P2 |

| US-INF-32 | Content Strategist | See which Nigerian content topics drive the highest engagement for each creator | I brief influencers on the content approach most likely to succeed | P1 |



\---



\## 3. Functional Requirements



\### 3.1 FR-INF-001: Influencer Discovery \& Database



\*\*Description:\*\* Multi-platform influencer discovery with Nigerian creator database, audience intelligence, and fraud detection.



\*\*Supported Platforms:\*\*



| Platform | Discovery Method | Nigerian Creator Coverage |

|----------|-----------------|--------------------------|

| Instagram | API + crawling | Strong — major Nigerian lifestyle, fashion, tech creators |

| TikTok | API + crawling | Growing — Nigerian Gen Z audience; entertainment |

| YouTube | YouTube Data API | Strong — Nigerian tech, finance, lifestyle channels |

| Twitter/X | Twitter API v2 | Strong — Nigerian Twitter is uniquely influential for business |

| Facebook | Facebook Graph API | Moderate — older Nigerian demographics, business pages |



\*\*Nigerian Influencer Tiers:\*\*



| Tier | Follower Range | Nigerian Typical Rate (₦/post) | Best For |

|------|--------------|-------------------------------|---------|

| \*\*Nano\*\* | 1K–10K | ₦10,000–₦50,000 | Local community; hyperlocal programs |

| \*\*Micro\*\* | 10K–100K | ₦50,000–₦500,000 | Niche Nigerian audiences; high engagement |

| \*\*Mid\*\* | 100K–500K | ₦500,000–₦2,000,000 | Broad Nigerian reach; brand awareness |

| \*\*Macro\*\* | 500K–1M | ₦2,000,000–₦5,000,000 | Mass Nigerian market; major programs |

| \*\*Mega\*\* | 1M+ | ₦5,000,000+ | National-level programs; FMCG, banking |



\*\*Discovery Filters:\*\*



| Filter | Options | Nigerian Context |

|--------|---------|-----------------|

| Platform | Instagram, TikTok, YouTube, Twitter/X, Facebook | All major Nigerian platforms |

| Category | Tech, Finance, Lifestyle, Fashion, Food, Fitness, Entertainment, Business, Parenting, Beauty | Nigerian content categories |

| Location | Lagos, Abuja, Port Harcourt, Kano, Ibadan, Enugu, or other Nigerian state | State-level geotargeting |

| Tier | Nano, Micro, Mid, Macro, Mega | Per Nigerian market context |

| Follower count | Min–Max custom range | Numeric |

| Engagement rate | Minimum % | Platform-normalized |

| Audience authenticity | Minimum score | Fraud-adjusted |

| Language | English, Pidgin, Yoruba, Hausa, Igbo | Nigerian language content |

| Brand safety score | Minimum score | APCON-aligned |



\*\*Influencer Profile Fields:\*\*



| Field | Description | Nigerian Context |

|-------|-------------|-----------------|

| Full name | Display name | — |

| Username(s) | Per-platform handles | — |

| Email | Contact email | Often managed by talent manager |

| Phone | Contact phone | Nigerian +234 format |

| WhatsApp | WhatsApp number | \*\*Primary Nigerian creator communication channel\*\* |

| Instagram, TikTok, YouTube, Twitter/X handles | Platform profiles | All major Nigerian platforms |

| Category / niche | Content categories | Nigerian-specific categories |

| Geographic base | Nigerian state or city | — |

| Audience location | % Nigerian vs. diaspora | Important for local programs |

| Follower count | Per platform | — |

| Engagement rate | Per platform | Platform-normalized |

| Influence score | 0–100 composite | See scoring algorithm |

| Authenticity score | 0–100 | Follower quality |

| Fraud score | 0–100 (higher = riskier) | Bot and fake engagement |

| Brand safety score | 0–100 | APCON content compliance |

| Relationship score | 0–100 | Interaction history |

| Typical ₦ rate | Per content type | NGN per post/story/reel |

| program count | programs worked on | Historical |

| Status | Active, inactive, blacklisted | — |

| Tags | Custom tags | e.g., "VIP", "reliable", "needs follow-up" |

| Notes | Free-text notes | Relationship context |



\*\*Influence Scoring Algorithm:\*\*



```

Influence Score (0–100) =

&#x20; (Follower Count Score × 0.25)

&#x20; + (Engagement Rate Score × 0.30)

&#x20; + (Audience Quality Score × 0.20)

&#x20; + (Content Relevance Score × 0.15)

&#x20; + (Nigerian Market Authority × 0.10)



Where:

&#x20; Follower Count Score: Log-normalized within Nigerian market context

&#x20; Engagement Rate Score: Platform-normalized (Instagram avg 2.5%, TikTok avg 5.7%)

&#x20; Audience Quality Score: % of followers from target demographic (e.g., Nigerian)

&#x20; Content Relevance Score: Topic match score to brand category

&#x20; Nigerian Market Authority: Verified mentions in Nigerian media, business profile

```



\*\*Fraud Detection Signals:\*\*



| Signal | Weight | Nigerian Pattern |

|--------|--------|-----------------|

| Sudden follower growth spikes | 25% | Accounts with >50% follower growth in 7 days |

| Engagement rate vs. follower count anomaly | 25% | Very high follower count but <0.5% engagement |

| Follower-to-following ratio | 15% | Unusual ratios indicating follow-for-follow schemes |

| Comment quality analysis | 20% | Generic comments ("Nice post!", "❤️") indicating bot activity |

| Audience geography mismatch | 15% | Creator claims Lagos focus; 90% followers from India/Brazil |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Discovery identifies relevant Nigerian creators with ≥85% accuracy |

| AC2 | Fraud detection identifies suspicious Nigerian accounts with ≥90% accuracy |

| AC3 | Nigerian state-level geographic filtering works correctly |

| AC4 | WhatsApp contact field available and trackable for Nigerian creators |

| AC5 | Typical ₦ rate field displayed for benchmarking |

| AC6 | Influencer profiles updated with fresh metrics within 24 hours |



\---



\### 3.2 FR-INF-002: Relationship CRM



\*\*Description:\*\* Complete Nigerian influencer relationship management with interaction tracking, WhatsApp communication logging, and relationship scoring.



\*\*Interaction Types:\*\*



| Type | Description | Nigerian Context |

|------|-------------|-----------------|

| Email | Email correspondence | Formal outreach |

| WhatsApp | WhatsApp messages | \*\*Primary Nigerian channel — must be loggable\*\* |

| Phone call | Voice call | Common for negotiation in Nigeria |

| In-person meeting | Physical meeting | Lagos or Abuja meetings with creators |

| Video call | Virtual meeting | Increasingly common post-COVID |

| DM (social) | Platform DM | Instagram DM, Twitter DM |

| Event | Conference, content day, activation | Nigerian industry events |

| program content | Influencer published content | Auto-logged from program module |



\*\*Interaction Log Entry:\*\*



```json

{

&#x20; "id": "int\_8e4c5d6e",

&#x20; "influencerId": "inf\_9f2a4b6c",

&#x20; "programId": "cmp\_7e3b2c1d",

&#x20; "type": "whatsapp",

&#x20; "direction": "outbound",

&#x20; "subject": "Bank X program brief — please review",

&#x20; "content": "Hi Chidi, please find the program brief attached. Payment is ₦250,000 for 2 posts and 4 stories...",

&#x20; "outcome": "positive",

&#x20; "followUpAt": "2026-07-25T10:00:00+01:00",

&#x20; "createdBy": "usr\_7e3b2c1d",

&#x20; "createdAt": "2026-07-21T11:30:00+01:00"

}

```



\*\*Relationship Score Update Logic:\*\*



```

Relationship Score (0–100) =

&#x20; (Interaction Frequency Score × 0.30)

&#x20; + (program Completion Rate × 0.30)

&#x20; + (Response Rate Score × 0.20)

&#x20; + (Content Quality Score × 0.10)

&#x20; + (Recency Score × 0.10)



Where:

&#x20; program Completion Rate: % of contracted deliverables fulfilled on time

&#x20; Response Rate Score: % of outreach that receives a response

&#x20; Content Quality Score: Average brand safety + approval rate

&#x20; Recency Score: Decays if no interaction in 90+ days

```



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | WhatsApp interactions loggable and searchable |

| AC2 | Relationship score updates within 5 minutes of new interaction |

| AC3 | program completion rate factored into relationship score |

| AC4 | Follow-up reminders delivered at correct WAT time |

| AC5 | Full interaction history accessible from influencer profile |



\---



\### 3.3 FR-INF-003: program Management



\*\*Description:\*\* End-to-end influencer program management with ₦ budget tracking, deliverable management, and content approval workflows.



\*\*program Lifecycle:\*\*



```

program Brief Created

&#x20;   │

&#x20;   ▼

Influencers Invited (email / WhatsApp)

&#x20;   │

&#x20;   ▼ (Creator accepts)

Contract Agreed (₦ payment terms, deliverables)

&#x20;   │

&#x20;   ▼

Content Created by Influencer

&#x20;   │

&#x20;   ▼

Content Submitted for Approval

&#x20;   │

&#x20;   ├─ Approved → Content Published

&#x20;   ├─ Changes Requested → Creator Revises

&#x20;   └─ Rejected → Replacement Influencer Sought

&#x20;   │

&#x20;   ▼

Performance Tracked (reach, engagement, conversion)

&#x20;   │

&#x20;   ▼

₦ Payment Released (on deliverable completion)

&#x20;   │

&#x20;   ▼

program Report Generated

```



\*\*program Configuration:\*\*



| Field | Description | Nigerian Context |

|-------|-------------|-----------------|

| program name | Internal name | — |

| program type | Product, brand, awareness, event, CSR | — |

| program brief | Objectives, key messages, content guidelines | APCON disclosure requirements included |

| Start/end dates | program period | WAT timezone |

| ₦ Budget | Total program budget in NGN | NUMERIC(15,2) |

| ₦ Per-influencer allocation | Budget per creator | Tracked against deliverables |

| Target platforms | Instagram, TikTok, YouTube, Twitter/X, Facebook | — |

| Target audience | Nigerian demographic profile | Lagos, Abuja, etc. |

| KPIs | Reach, engagement, conversions, ₦ revenue | — |

| Hashtags | Required program hashtags | Nigerian trending awareness |

| Disclosure requirement | Mandatory "Ad" / "Sponsored" label | APCON and FTC compliance |



\*\*Deliverable Tracking:\*\*



| Deliverable Type | Platform | ₦ Rate Benchmark (Micro-tier) |

|----------------|----------|-------------------------------|

| Feed post (image) | Instagram | ₦100,000–₦300,000 |

| Reel (video) | Instagram | ₦150,000–₦400,000 |

| Story (24h) | Instagram | ₦50,000–₦150,000 |

| TikTok video | TikTok | ₦100,000–₦300,000 |

| YouTube video (≥60s) | YouTube | ₦300,000–₦1,000,000 |

| Twitter/X post + thread | Twitter/X | ₦50,000–₦200,000 |

| Facebook post | Facebook | ₦50,000–₦150,000 |

| Blog post | Website | ₦100,000–₦500,000 |



\*\*Content Approval Workflow:\*\*



```

Influencer submits content (URL, file, or draft text)

&#x20;   │

&#x20;   ▼

Automated checks:

&#x20; ├── Brand safety scan (prohibited keywords, competitor mentions)

&#x20; ├── APCON disclosure check ("Ad" / "Sponsored" label)

&#x20; ├── Sentiment analysis (positive / neutral / negative)

&#x20; └── Platform compliance check (correct hashtags, character counts)

&#x20;   │

&#x20;   ▼ (All automated checks pass)

Manual review (Marketing Manager or Approver)

&#x20;   │

&#x20;   ├── Approve → Content can go live

&#x20;   ├── Request changes → Feedback sent to influencer

&#x20;   └── Reject → Contract clause triggered; escalated

&#x20;   │

&#x20;   ▼ (Approved)

Published notification + performance tracking begins

```



\*\*₦ Payment Tracking:\*\*



| Payment Stage | Trigger | Amount |

|--------------|---------|--------|

| Advance (if agreed) | Contract signed | 20–50% of agreed ₦ fee |

| Upon approval | Content approved (before publish) | — |

| Upon publication | Influencer publishes and provides proof | 50–80% of agreed ₦ fee |

| Performance bonus (if agreed) | Metrics exceed targets | Agreed ₦ bonus |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | program ₦ budget tracked with real-time spend vs. budget |

| AC2 | Content approval workflow routes correctly 100% of the time |

| AC3 | APCON disclosure check applied to all Nigerian program content |

| AC4 | ₦ payment milestones tracked per deliverable |

| AC5 | All program dates and deadlines shown in WAT |

| AC6 | program brief shareable with influencers via secure link |



\---



\### 3.4 FR-INF-004: ₦ ROI Measurement \& Analytics



\*\*Description:\*\* Comprehensive program analytics with ₦ ROI calculation calibrated for the Nigerian market.



\*\*program Performance Metrics:\*\*



| Metric | Description | Nigerian Context |

|--------|-------------|-----------------|

| Total reach | Unique users who saw content | Nigerian audience estimate |

| Impressions | Total content views | Platform-reported |

| Engagement | Likes + comments + shares + saves | Platform-specific weightings |

| Engagement rate | Engagement / Reach × 100 | Nigerian benchmark: Instagram 2.5%, TikTok 5.7% |

| Click-through rate | Link clicks / Reach × 100 | To brand website or landing page |

| Conversions | Defined action completions (signup, purchase, download) | UTM-tracked |

| ₦ Revenue attributed | Sales linked to influencer program | UTM + promo code tracking |

| ₦ Cost per reach | Total ₦ spend / Total reach | — |

| ₦ Cost per engagement | Total ₦ spend / Total engagements | — |

| ₦ Cost per conversion | Total ₦ spend / Total conversions | — |

| ₦ ROI | (₦ Revenue − ₦ Cost) / ₦ Cost × 100 | Nigerian market ROI |



\*\*₦ ROI Calculation:\*\*



```

₦ ROI = ((₦ Revenue Attributed + ₦ Brand Value Created) − ₦ Total program Cost) 

&#x20;        / ₦ Total program Cost × 100



Where:

&#x20; ₦ Revenue Attributed: Sales with influencer UTM codes or promo codes (tracked in Naira)

&#x20; ₦ Brand Value Created: Estimated ₦ value of reach and brand awareness

&#x20;   = Total Reach × Nigerian CPM rate (e.g., ₦500 per 1,000 impressions) / 1,000

&#x20; ₦ Total program Cost: Creator fees (₦) + Platform costs + Agency management fees



Example:

&#x20; ₦ Revenue Attributed: ₦3,200,000

&#x20; ₦ Brand Value Created: 500,000 reach × ₦500/1,000 = ₦250,000

&#x20; ₦ Total program Cost: ₦2,000,000

&#x20; 

&#x20; ₦ ROI = ((₦3,200,000 + ₦250,000) − ₦2,000,000) / ₦2,000,000 × 100 = 72.5%

```



\*\*Individual Influencer Performance:\*\*



| Metric | Description |

|--------|-------------|

| ₦ spent on this creator | Fee paid to individual influencer |

| Content-level reach | Per-post reach |

| Content-level engagement | Per-post engagement |

| Content-level conversions | Per-post conversions (via UTM/promo code) |

| ₦ cost per engagement (this influencer) | Creator-specific efficiency |

| ₦ ROI (this influencer) | Creator-specific ROI |

| Deliverable completion rate | % of contractual obligations fulfilled |

| On-time delivery rate | % delivered by agreed deadline |



\*\*program Benchmarking:\*\*



| Benchmark | Description |

|-----------|-------------|

| program vs. program | Compare ₦ ROI across different programs |

| Influencer vs. influencer | Compare efficiency across creators in same program |

| vs. Nigerian industry average | Compare ₦ CPE against Nigerian market benchmarks |

| vs. own historical programs | Track improvement over time |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | All ₦ ROI calculations use NGN throughout |

| AC2 | Per-influencer ₦ performance visible within program dashboard |

| AC3 | UTM tracking links generated automatically for each influencer |

| AC4 | program performance updates within 4 hours of content publish |

| AC5 | ₦ ROI dashboard loads within 3 seconds |

| AC6 | Export includes all ₦ metrics in NGN denomination |



\---



\### 3.5 FR-INF-005: Brand Safety \& Compliance



\*\*Description:\*\* Automated content compliance monitoring for Nigerian regulatory requirements and brand guidelines.



\*\*Nigerian Regulatory Context:\*\*



| Body | Requirement | Implementation |

|------|-------------|----------------|

| \*\*APCON\*\* (Advertising Practitioners Council of Nigeria) | All advertising content must be clearly labeled; no misleading claims | Auto-check for "Ad", "Sponsored", "Promo" disclosure |

| \*\*NCC\*\* (Nigerian Communications Commission) | Telecom influencer content regulated | Category-specific rules for telecom programs |

| \*\*CBN\*\* (Central Bank of Nigeria) | Financial service advertising restrictions; no guaranteed return language | Banking/fintech influencer compliance pre-set |

| \*\*NAFDAC\*\* | Health and food product claims | Healthcare and FMCG influencer compliance |

| \*\*SEC\*\* (Securities and Exchange Commission) | Investment content regulations | Financial influencer compliance |



\*\*Automated Brand Safety Checks:\*\*



| Check | Description | Action |

|-------|-------------|--------|

| APCON disclosure | Verify "Ad" or "Sponsored" label in caption | Flag if missing |

| Prohibited keywords | Brand-configured prohibited terms | Auto-block for review |

| Competitor mentions | Competitor brand names in content | Flag for review |

| Sentiment analysis | Negative sentiment toward brand | Flag for review |

| Off-brand content | Content deviating from brief | Flag for review |

| Nigerian regulatory keywords | Industry-specific prohibited claims | Category-specific auto-flag |



\*\*Brand Safety Score Components:\*\*



```

Brand Safety Score (0–100) =

&#x20; (APCON Compliance: 30%)     — Disclosure and labeling compliance

&#x20; + (Content Consistency: 25%) — Alignment with brand guidelines and brief

&#x20; + (Historical Content: 25%)  — Creator's past content on sensitive topics

&#x20; + (Audience Safety: 20%)    — Audience age appropriateness and values alignment

```



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | APCON disclosure check applied to all Nigerian program content |

| AC2 | Brand safety scan completes within 5 minutes of content submission |

| AC3 | Industry-specific Nigerian regulatory rules pre-loaded (banking, telecom, healthcare, FMCG) |

| AC4 | Non-compliant content flagged before approval decision |

| AC5 | Brand safety score updated with each new piece of content |



\---



\## 4. Business Rules



| ID | Rule | Rationale |

|----|------|-----------|

| BR-INF-01 | Influence score = weighted composite of reach, engagement, audience quality, content relevance, Nigerian market authority | Provides consistent, market-calibrated ranking |

| BR-INF-02 | All ₦ monetary values (fees, budgets, ROI) stored as NUMERIC(15,2) NGN | Currency consistency |

| BR-INF-03 | Accounts with follower growth >100% in 7 days automatically flagged | Nigerian bot-buying detection |

| BR-INF-04 | Accounts with engagement rate <0.5% for follower counts >100K flagged | Low-quality account detection |

| BR-INF-05 | Content cannot be published without approval (hard block) | Brand consistency enforcement |

| BR-INF-06 | APCON disclosure check required for all Nigerian program content | Regulatory compliance |

| BR-INF-07 | Influencer with fraud score >60 requires Admin override to add to program | Risk management |

| BR-INF-08 | ₦ payment not released until deliverable marked as approved + published | Accountability |

| BR-INF-09 | program ₦ budget cannot be exceeded without Manager+ approval | Financial control |

| BR-INF-10 | WhatsApp interactions must be manually logged; not auto-captured | Privacy compliance |

| BR-INF-11 | Blacklisted influencers cannot be added to programs | Brand protection |

| BR-INF-12 | All program dates and deadlines stored UTC; displayed in WAT | Nigerian timezone consistency |



\---



\## 5. Permissions



\### 5.1 RBAC Matrix



| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |

|--------|-------|-------|---------|---------|---------|--------|

| \*\*Influencer Database\*\* |

| View influencer profiles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Add influencer to database | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

| Edit influencer profile | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

| Delete influencer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Blacklist influencer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Run fraud check | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

| Export influencer list | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

| \*\*Interactions\*\* |

| Log interaction | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

| View interactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| \*\*programs\*\* |

| View programs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Create program | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

| Edit program (config, brief, ₦ budget) | ✅ | ✅ | ✅ | Own only | ❌ | ❌ |

| Delete program | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Add influencer to program | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Approve influencer content | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Configure ₦ budget | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Approve ₦ budget overrun | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| \*\*Analytics\*\* |

| View ₦ ROI analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Export program data (with ₦) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

| Generate white-label reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |



\---



\## 6. API Reference



\### 6.1 Influencer Endpoints



| Method | Endpoint | Auth | Role | Purpose |

|--------|----------|------|------|---------|

| `POST` | `/api/v1/influencers/discover` | ✅ | Analyst+ | Search/discover influencers |

| `GET` | `/api/v1/influencers` | ✅ | Analyst+ | List organization's influencer database |

| `POST` | `/api/v1/influencers` | ✅ | Analyst+ | Add influencer to database |

| `GET` | `/api/v1/influencers/:id` | ✅ | Analyst+ | Get influencer profile |

| `PATCH` | `/api/v1/influencers/:id` | ✅ | Analyst+ | Update influencer profile |

| `DELETE` | `/api/v1/influencers/:id` | ✅ | Manager+ | Delete influencer |

| `POST` | `/api/v1/influencers/:id/fraud-check` | ✅ | Analyst+ | Run fraud check |

| `POST` | `/api/v1/influencers/:id/blacklist` | ✅ | Manager+ | Blacklist influencer |

| `GET` | `/api/v1/influencers/export` | ✅ | Analyst+ | Export influencer list (with ₦ rates) |

| `POST` | `/api/v1/influencers/interactions` | ✅ | Analyst+ | Log interaction |

| `GET` | `/api/v1/influencers/:id/interactions` | ✅ | Analyst+ | Get influencer interaction history |

| `GET` | `/api/v1/influencers/programs` | ✅ | Analyst+ | List programs |

| `POST` | `/api/v1/influencers/programs` | ✅ | Creator+ | Create program |

| `GET` | `/api/v1/influencers/programs/:id` | ✅ | Analyst+ | Get program detail |

| `PATCH` | `/api/v1/influencers/programs/:id` | ✅ | Manager+ | Update program |

| `POST` | `/api/v1/influencers/programs/:id/influencers` | ✅ | Manager+ | Add influencer to program |

| `POST` | `/api/v1/influencers/programs/:id/influencers/:icId/content` | ✅ | Creator+ | Submit content for approval |

| `POST` | `/api/v1/influencers/programs/:id/influencers/:icId/approve` | ✅ | Manager+ | Approve content |

| `GET` | `/api/v1/influencers/programs/:id/performance` | ✅ | Analyst+ | Get program ₦ performance |



\### 6.2 Response Examples



\*\*Discover Influencers:\*\*



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "influencers": \[

&#x20;     {

&#x20;       "id": "inf\_7e3b2c1d4f5a6b8c",

&#x20;       "name": "Chidi Okafor",

&#x20;       "username": "@chiditech\_ng",

&#x20;       "primaryPlatform": "instagram",

&#x20;       "handles": {

&#x20;         "instagram": "@chiditech\_ng",

&#x20;         "tiktok": "@chiditech",

&#x20;         "twitter": "@chidiokafor"

&#x20;       },

&#x20;       "location": "Lagos, Nigeria",

&#x20;       "tier": "micro",

&#x20;       "followerCount": 45600,

&#x20;       "engagementRate": 3.2,

&#x20;       "influenceScore": 78,

&#x20;       "authenticityScore": 92,

&#x20;       "fraudScore": 12,

&#x20;       "brandSafetyScore": 88,

&#x20;       "categories": \["technology", "fintech", "startups"],

&#x20;       "audienceNigerianPercent": 87,

&#x20;       "typicalRateNaira": {

&#x20;         "instagramPost": 200000,

&#x20;         "instagramReel": 300000,

&#x20;         "instagramStory": 75000,

&#x20;         "currency": "NGN"

&#x20;       },

&#x20;       "programCount": 8,

&#x20;       "status": "active"

&#x20;     }

&#x20;   ],

&#x20;   "totalResults": 47,

&#x20;   "pagination": {

&#x20;     "cursor": "eyJpZCI6ImluZl8xMjMifQ==",

&#x20;     "hasMore": true

&#x20;   }

&#x20; }

}

```



\*\*Create program:\*\*



```json

HTTP/1.1 201 Created



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "cmp\_9f2a4b6c8d1e3f5g",

&#x20;   "name": "First Bank Digital Banking Launch — Influencer Program",

&#x20;   "type": "product",

&#x20;   "status": "planning",

&#x20;   "budgetNaira": 5000000,

&#x20;   "spentNaira": 0,

&#x20;   "currency": "NGN",

&#x20;   "startDate": "2026-08-01T00:00:00+01:00",

&#x20;   "endDate": "2026-08-31T23:59:59+01:00",

&#x20;   "timezone": "Africa/Lagos",

&#x20;   "targetMetrics": {

&#x20;     "reach": 1000000,

&#x20;     "engagements": 50000,

&#x20;     "conversions": 500

&#x20;   },

&#x20;   "createdAt": "2026-07-21T10:00:00+01:00"

&#x20; }

}

```



\*\*Get Program Performance:\*\*



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "programId": "cmp\_9f2a4b6c8d1e3f5g",

&#x20;   "programName": "First Bank Digital Banking Launch — Influencer Program",

&#x20;   "status": "active",

&#x20;   "financials": {

&#x20;     "budgetNaira": 5000000,

&#x20;     "spentNaira": 2500000,

&#x20;     "remainingNaira": 2500000,

&#x20;     "currency": "NGN"

&#x20;   },

&#x20;   "metrics": {

&#x20;     "reach": 425000,

&#x20;     "reachTarget": 1000000,

&#x20;     "engagements": 18750,

&#x20;     "engagementsTarget": 50000,

&#x20;     "conversions": 125,

&#x20;     "conversionsTarget": 500

&#x20;   },

&#x20;   "roiMetrics": {

&#x20;     "revenueAttributedNaira": 3200000,

&#x20;     "brandValueCreatedNaira": 212500,

&#x20;     "totalCostNaira": 2500000,

&#x20;     "roiPercent": 36.5,

&#x20;     "costPerEngagementNaira": 133,

&#x20;     "costPerConversionNaira": 20000,

&#x20;     "currency": "NGN"

&#x20;   },

&#x20;   "influencerPerformance": \[

&#x20;     {

&#x20;       "influencerId": "inf\_7e3b2c1d",

&#x20;       "name": "Chidi Okafor",

&#x20;       "reach": 125000,

&#x20;       "engagements": 5000,

&#x20;       "conversions": 35,

&#x20;       "feeNaira": 500000,

&#x20;       "costPerEngagementNaira": 100,

&#x20;       "costPerConversionNaira": 14286,

&#x20;       "roiPercent": 44.0,

&#x20;       "deliverablesFulfilled": 3,

&#x20;       "deliverablesTotal": 3,

&#x20;       "currency": "NGN"

&#x20;     }

&#x20;   ]

&#x20; }

}

```



\*\*Run Fraud Check:\*\*



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "influencerId": "inf\_7e3b2c1d4f5a6b8c",

&#x20;   "name": "Chidi Okafor",

&#x20;   "authenticityScore": 92,

&#x20;   "fraudScore": 12,

&#x20;   "riskLevel": "low",

&#x20;   "signals": {

&#x20;     "followerGrowthPattern": "organic",

&#x20;     "engagementRatioHealth": "healthy",

&#x20;     "botActivityLevel": "low",

&#x20;     "audienceAuthenticityPercent": 91,

&#x20;     "audienceGeographyMatch": "consistent",

&#x20;     "commentQualityScore": 88

&#x20;   },

&#x20;   "nigerianAudiencePercent": 87,

&#x20;   "recommendation": "Low risk. Authentic Nigerian audience. Recommended for collaboration.",

&#x20;   "checkedAt": "2026-07-21T11:30:00+01:00"

&#x20; }

}

```



\---



\## 7. Database Schema



\### 7.1 Core Tables



```sql

\-- Influencer profiles (all monetary values in NGN)

CREATE TABLE influencers (

&#x20; id                        VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; name                      VARCHAR(200) NOT NULL,

&#x20; username\_primary          VARCHAR(100) NOT NULL,

&#x20; primary\_platform          VARCHAR(20) NOT NULL,

&#x20; handles                   JSONB,                      -- {instagram: "@x", tiktok: "@x", twitter: "@x"}

&#x20; email                     VARCHAR(255),

&#x20; phone                     VARCHAR(20),                -- E.164, +234 for Nigerian

&#x20; whatsapp                  VARCHAR(20),                -- Nigerian WhatsApp — primary channel

&#x20; bio                       TEXT,

&#x20; categories                TEXT\[],

&#x20; location                  TEXT,                       -- e.g., "Lagos, Nigeria"

&#x20; nigerian\_state            VARCHAR(50),                -- For Nigerian geographic filtering

&#x20; audience\_nigerian\_percent DECIMAL(5,2),               -- % of Nigerian audience

&#x20; -- Platform metrics

&#x20; follower\_count            INTEGER DEFAULT 0,

&#x20; engagement\_rate           DECIMAL(6,4),               -- Platform-normalized

&#x20; -- Scoring (0–100)

&#x20; influence\_score           DECIMAL(5,2) DEFAULT 0,

&#x20; authenticity\_score        DECIMAL(5,2) DEFAULT 0,

&#x20; fraud\_score               DECIMAL(5,2) DEFAULT 0,

&#x20; brand\_safety\_score        DECIMAL(5,2) DEFAULT 0,

&#x20; relationship\_score        DECIMAL(5,2) DEFAULT 0,

&#x20; -- ₦ Typical rates (NGN)

&#x20; typical\_rate\_post\_naira   NUMERIC(15,2),

&#x20; typical\_rate\_reel\_naira   NUMERIC(15,2),

&#x20; typical\_rate\_story\_naira  NUMERIC(15,2),

&#x20; typical\_rate\_video\_naira  NUMERIC(15,2),              -- YouTube

&#x20; currency                  VARCHAR(3) DEFAULT 'NGN',

&#x20; -- Status and metadata

&#x20; tier                      VARCHAR(20)

&#x20;                           CHECK (tier IN ('nano', 'micro', 'mid', 'macro', 'mega')),

&#x20; status                    VARCHAR(20) DEFAULT 'active'

&#x20;                           CHECK (status IN ('active', 'inactive', 'blacklisted')),

&#x20; program\_count            INTEGER DEFAULT 0,

&#x20; tags                      TEXT\[],

&#x20; notes                     TEXT,

&#x20; created\_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

ALTER TABLE influencers FORCE ROW LEVEL SECURITY;

CREATE POLICY inf\_isolation ON influencers

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_inf\_org ON influencers(organization\_id);

CREATE INDEX idx\_inf\_score ON influencers(organization\_id, influence\_score DESC);

CREATE INDEX idx\_inf\_tier ON influencers(organization\_id, tier);

CREATE INDEX idx\_inf\_state ON influencers(organization\_id, nigerian\_state);

CREATE INDEX idx\_inf\_status ON influencers(organization\_id, status);

CREATE INDEX idx\_inf\_categories ON influencers USING GIN(categories);



\-- Influencer interactions (all WAT timestamps)

CREATE TABLE influencer\_interactions (

&#x20; id                VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; influencer\_id     VARCHAR(32) NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

&#x20; program\_id       VARCHAR(32) REFERENCES influencer\_programs\_meta(id),

&#x20; interaction\_type  VARCHAR(20) NOT NULL

&#x20;                   CHECK (interaction\_type IN ('email', 'whatsapp', 'phone', 'meeting', 'video\_call', 'dm', 'event', 'program\_content')),

&#x20; direction         VARCHAR(20)

&#x20;                   CHECK (direction IN ('inbound', 'outbound', 'automatic')),

&#x20; subject           TEXT,

&#x20; content           TEXT,

&#x20; outcome           VARCHAR(20)

&#x20;                   CHECK (outcome IN ('positive', 'neutral', 'negative', 'no\_response', 'content\_published')),

&#x20; follow\_up\_at      TIMESTAMPTZ,                        -- WAT timezone

&#x20; created\_by\_id     VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; created\_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()

&#x20; -- Immutable — no updates

);



ALTER TABLE influencer\_interactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE influencer\_interactions FORCE ROW LEVEL SECURITY;

CREATE POLICY ii\_isolation ON influencer\_interactions

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_ii\_influencer ON influencer\_interactions(influencer\_id, created\_at DESC);

CREATE INDEX idx\_ii\_followup ON influencer\_interactions(follow\_up\_at)

&#x20; WHERE follow\_up\_at IS NOT NULL;



\-- Influencer programs (all ₦ in NGN)

CREATE TABLE influencer\_programs\_meta (

&#x20; id                    VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; name                  VARCHAR(200) NOT NULL,

&#x20; description           TEXT,

&#x20; program\_type         VARCHAR(30) DEFAULT 'brand'

&#x20;                       CHECK (program\_type IN ('product', 'brand', 'awareness', 'event', 'csr', 'performance')),

&#x20; start\_date            TIMESTAMPTZ NOT NULL,

&#x20; end\_date              TIMESTAMPTZ,

&#x20; timezone              VARCHAR(100) DEFAULT 'Africa/Lagos',

&#x20; status                VARCHAR(20) DEFAULT 'planning'

&#x20;                       CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),

&#x20; -- ₦ Budget (NGN)

&#x20; budget\_naira          NUMERIC(15,2) NOT NULL DEFAULT 0,

&#x20; spent\_naira           NUMERIC(15,2) DEFAULT 0,

&#x20; currency              VARCHAR(3) DEFAULT 'NGN',

&#x20; -- program config

&#x20; brief\_text            TEXT,

&#x20; target\_platforms      TEXT\[],

&#x20; required\_hashtags     TEXT\[],

&#x20; prohibited\_keywords   TEXT\[],

&#x20; requires\_apcon\_disclosure BOOLEAN DEFAULT TRUE,       -- Nigerian regulatory

&#x20; -- Targets

&#x20; reach\_target          BIGINT,

&#x20; engagement\_target     BIGINT,

&#x20; conversion\_target     INTEGER,

&#x20; revenue\_target\_naira  NUMERIC(15,2),

&#x20; -- Actuals (computed)

&#x20; actual\_reach          BIGINT DEFAULT 0,

&#x20; actual\_engagements    BIGINT DEFAULT 0,

&#x20; actual\_conversions    INTEGER DEFAULT 0,

&#x20; revenue\_attributed\_naira NUMERIC(15,2) DEFAULT 0,

&#x20; roi\_percent           DECIMAL(10,4),

&#x20; created\_by\_id         VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; created\_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE influencer\_programs\_meta ENABLE ROW LEVEL SECURITY;

ALTER TABLE influencer\_programs\_meta FORCE ROW LEVEL SECURITY;

CREATE POLICY icm\_isolation ON influencer\_programs\_meta

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_icm\_org ON influencer\_programs\_meta(organization\_id);

CREATE INDEX idx\_icm\_status ON influencer\_programs\_meta(organization\_id, status);



\-- Influencer–program relationship (all ₦ in NGN)

CREATE TABLE influencer\_program\_assignments (

&#x20; id                    VARCHAR(32) PRIMARY KEY,

&#x20; program\_id           VARCHAR(32) NOT NULL REFERENCES influencer\_programs\_meta(id) ON DELETE CASCADE,

&#x20; influencer\_id         VARCHAR(32) NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

&#x20; organization\_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; status                VARCHAR(30) DEFAULT 'invited'

&#x20;                       CHECK (status IN ('invited', 'accepted', 'declined', 'contracted', 'content\_submitted', 'content\_approved', 'published', 'completed', 'cancelled')),

&#x20; -- Contract

&#x20; deliverables          JSONB NOT NULL,                 -- \[{type: "instagram\_post", count: 2, deadline: "2026-08-15T..."}]

&#x20; contract\_terms        TEXT,

&#x20; -- ₦ Payment (NGN)

&#x20; fee\_naira             NUMERIC(15,2) DEFAULT 0,

&#x20; advance\_naira         NUMERIC(15,2) DEFAULT 0,

&#x20; payment\_status        VARCHAR(20) DEFAULT 'pending'

&#x20;                       CHECK (payment\_status IN ('pending', 'advance\_paid', 'paid', 'overdue', 'disputed')),

&#x20; currency              VARCHAR(3) DEFAULT 'NGN',

&#x20; -- Performance (computed)

&#x20; reach                 BIGINT DEFAULT 0,

&#x20; engagements           BIGINT DEFAULT 0,

&#x20; conversions           INTEGER DEFAULT 0,

&#x20; revenue\_attributed\_naira NUMERIC(15,2) DEFAULT 0,

&#x20; cost\_per\_engagement\_naira NUMERIC(15,2),

&#x20; roi\_percent           DECIMAL(10,4),

&#x20; deliverables\_fulfilled INTEGER DEFAULT 0,

&#x20; deliverables\_total    INTEGER DEFAULT 0,

&#x20; on\_time\_delivery\_rate DECIMAL(5,2),

&#x20; created\_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; UNIQUE(program\_id, influencer\_id)

);



ALTER TABLE influencer\_program\_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE influencer\_program\_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY ica\_isolation ON influencer\_program\_assignments

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_ica\_program ON influencer\_program\_assignments(program\_id);

CREATE INDEX idx\_ica\_influencer ON influencer\_program\_assignments(influencer\_id);



\-- Influencer content submissions

CREATE TABLE influencer\_content\_submissions (

&#x20; id                    VARCHAR(32) PRIMARY KEY,

&#x20; assignment\_id         VARCHAR(32) NOT NULL REFERENCES influencer\_program\_assignments(id) ON DELETE CASCADE,

&#x20; organization\_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; content\_type          VARCHAR(30) NOT NULL

&#x20;                       CHECK (content\_type IN ('instagram\_post', 'instagram\_reel', 'instagram\_story', 'tiktok\_video', 'youtube\_video', 'twitter\_post', 'facebook\_post', 'blog\_post')),

&#x20; platform\_url          TEXT,

&#x20; draft\_url             TEXT,

&#x20; caption               TEXT,

&#x20; hashtags              TEXT\[],

&#x20; media\_urls            TEXT\[],

&#x20; -- Automated checks

&#x20; apcon\_disclosure\_present BOOLEAN,                    -- Nigerian compliance

&#x20; brand\_safety\_score    DECIMAL(5,2),

&#x20; sentiment\_score       DECIMAL(3,2),

&#x20; prohibited\_keywords\_found TEXT\[],

&#x20; competitor\_mentions\_found TEXT\[],

&#x20; -- Review

&#x20; status                VARCHAR(20) DEFAULT 'submitted'

&#x20;                       CHECK (status IN ('submitted', 'approved', 'changes\_requested', 'rejected', 'published')),

&#x20; reviewed\_by\_id        VARCHAR(32) REFERENCES users(id),

&#x20; reviewed\_at           TIMESTAMPTZ,

&#x20; review\_notes          TEXT,

&#x20; -- Performance (populated after publish)

&#x20; reach                 BIGINT DEFAULT 0,

&#x20; engagements           BIGINT DEFAULT 0,

&#x20; conversions           INTEGER DEFAULT 0,

&#x20; published\_at          TIMESTAMPTZ,

&#x20; submitted\_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; created\_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE influencer\_content\_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE influencer\_content\_submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY ics\_isolation ON influencer\_content\_submissions

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));

```



\---



\## 8. Email Notifications



\### 8.1 Influencer Module Notification Templates



| Event | Recipient | Subject | SLA | Nigerian Context |

|-------|-----------|---------|-----|-----------------|

| Content submitted for approval | Approvers | "📸 Content review needed: \[Influencer] — \[program]" | <30 minutes | APCON compliance check result shown |

| Content approved | Creator's manager | "✅ Content approved: \[Influencer] — \[program]" | <30 minutes | WAT timestamp |

| Content rejected | Creator's manager | "❌ Content rejected: \[Influencer] — \[program]" | <30 minutes | Rejection reason + next steps |

| Changes requested | Creator's manager | "✏️ Changes needed: \[Influencer] — \[program]" | <30 minutes | Specific feedback included |

| Influencer fraud risk flagged | Manager | "⚠️ High fraud risk: \[Influencer Name]" | <2 hours | Fraud signals listed |

| ₦ Budget 80% consumed | Admin | "💰 program budget alert: 80% of ₦\[Amount] spent" | <1 hour | Remaining ₦ amount |

| program ₦ ROI milestone | Manager | "🎉 program ROI reached \[X]×: \[program Name]" | <1 hour | ₦ figures |

| Deliverable deadline approaching | Manager | "⏰ Deliverable due tomorrow: \[Influencer] — \[program]" | Day before | WAT deadline time |

| Deliverable overdue | Manager + Admin | "🚨 Overdue deliverable: \[Influencer] — \[program]" | At overdue time | WAT timestamp |

| program completed | program owner | "✅ program complete: \[program Name] — ₦ Report ready" | <30 minutes | ₦ ROI summary |

| Daily influencer digest | Subscribed users | "📋 Daily influencer digest — \[Date] WAT" | 8:00 AM WAT | Active programs + ₦ metrics |



\### 8.2 In-App Notifications



| Event | Icon | Message | Dismissible |

|-------|------|---------|------------|

| Content submitted | 📸 | "\[Influencer] submitted content for review" | No (sticky until reviewed) |

| APCON compliance issue | ⚠️ | "APCON disclosure missing in \[Influencer] content" | No (sticky) |

| High fraud score | 🚨 | "\[Influencer] has high fraud score — review before program" | No (sticky) |

| ₦ Budget alert | 💰 | "program budget 80% spent — ₦\[Amount] remaining" | Yes |

| Deliverable overdue | 🔔 | "\[Influencer] deliverable overdue by \[N] days" | No (sticky) |

| Follow-up reminder | ⏰ | "Follow up with \[Influencer] today" | No (sticky) |



\---



\## 9. Error Handling



\### 9.1 Error Code Reference



| Code | HTTP | Message | User Action |

|------|------|---------|-------------|

| `INF\_NOT\_FOUND` | 404 | Influencer not found | Check influencer ID |

| `INF\_program\_NOT\_FOUND` | 404 | program not found | Check program ID |

| `INF\_BLACKLISTED` | 403 | This influencer is blacklisted for this organization | Choose a different influencer |

| `INF\_FRAUD\_SCORE\_HIGH` | 422 | Influencer fraud score ≥60 — Admin override required | Review fraud signals; request Admin approval |

| `INF\_CONTENT\_NOT\_APPROVED` | 422 | Content must be approved before this action | Submit for approval first |

| `INF\_BUDGET\_EXCEEDED` | 422 | program ₦ budget would be exceeded | Increase budget (requires Manager+) or reduce allocation |

| `INF\_APCON\_VIOLATION` | 422 | Content missing required APCON disclosure | Add "Ad" or "Sponsored" label to content |

| `INF\_DUPLICATE\_program` | 409 | Influencer already assigned to this program | View existing assignment |

| `INF\_DELIVERABLE\_OVERDUE` | 422 | Deliverable deadline has passed | Contact influencer; update timeline |

| `AUTHZ\_INSUFFICIENT\_PERMISSION` | 403 | You don't have permission for this action | Contact Admin |

| `RATE\_LIMIT\_EXCEEDED` | 429 | Too many requests | Retry after cooldown |



\---



\## 10. Non-Functional Requirements



\### 10.1 Performance



| Metric | Target |

|--------|--------|

| Influencer discovery search | <5 seconds |

| Fraud check per influencer | <30 seconds |

| program dashboard load | <3 seconds |

| Content brand safety scan | <5 minutes per submission |

| ₦ ROI metrics update | Within 4 hours of content publish |

| API response time P95 | <500ms |

| Influencer database search (10,000+ profiles) | <2 seconds |



\### 10.2 Nigerian Market Compliance



| Requirement | Implementation |

|-------------|---------------|

| APCON disclosure enforcement | Auto-check on all content submissions |

| ₦ monetary values | All financial fields NUMERIC(15,2) NGN |

| WAT timezone | Africa/Lagos default for all deadlines and timestamps |

| Nigerian state geotargeting | State-level filtering for Nigerian audience |

| NDPR compliance | Creator contact data consent managed |



\---



\## 11. Edge Cases



| ID | Scenario | Behavior |

|----|----------|---------|

| EC-01 | Influencer platform API unavailable during check | Cache last-known metrics; flag as "data as of \[WAT date]"; retry scheduled |

| EC-02 | Nigerian influencer changed username mid-program | Platform verification check; update profile; notify program manager |

| EC-03 | program ₦ budget exceeded due to FX adjustment | Alert Manager; block new commitments until budget increased or approved |

| EC-04 | Content APCON disclosure missing | Auto-block for approval; specific message: "Add 'Ad' or 'Sponsored' label per APCON requirements" |

| EC-05 | Fraud check flags legitimate Nigerian micro-influencer | Manual review option; "Appeal" process with evidence submission |

| EC-06 | Influencer engagement drops 50%+ during active program | Alert triggered; program manager notified; contract review option surfaced |

| EC-07 | Blacklisted influencer re-added by different user | Hard block: "This influencer is blacklisted. Contact Admin to unblacklist." |

| EC-08 | program end date passes with unpaid ₦ deliverables | Alert Finance; payment dispute resolution workflow triggered |

| EC-09 | Multiple Nigerian influencers submit same content (template) | Brand safety flag: "Similar content detected from \[N] influencers — review for originality" |

| EC-10 | Agency client workspace influencer shared to another client | Hard block per RLS isolation; "Cannot share influencer across client workspaces" |



\---



\## 12. Future Enhancements



| ID | Enhancement | Priority | Timeline |

|----|-------------|----------|---------|

| FE-INF-01 | Paystack integration for automated influencer ₦ payments | 🔴 High | Phase 5 — Q1 2027 |

| FE-INF-02 | Nigerian influencer marketplace (creator self-registration) | 🔴 High | Phase 7 — Q3 2027 |

| FE-INF-03 | AI-powered influencer recommendations ("Based on this program, consider...") | 🔴 High | Phase 6 — Q2 2027 |

| FE-INF-04 | Predictive influencer performance modeling (pre-program estimates) | 🟡 Medium | Phase 7 — Q3 2027 |

| FE-INF-05 | Cross-platform influencer ₦ attribution modeling | 🟡 Medium | Phase 6 — Q2 2027 |

| FE-INF-06 | Nigerian influencer WhatsApp Business API direct messaging | 🔴 High | Phase 5 — Q1 2027 |

| FE-INF-07 | ₦ benchmark database (Nigerian influencer rate cards by tier and category) | 🟡 Medium | Phase 6 — Q2 2027 |

| FE-INF-08 | Automated content performance reporting (post-publish metric collection) | 🟡 Medium | Phase 6 — Q2 2027 |

| FE-INF-09 | Nigerian influencer network graph (creator collaboration mapping) | 🟢 Low | Phase 8 — Q4 2027 |

| FE-INF-10 | TikTok Creator Marketplace integration | 🟡 Medium | Phase 6 — Q2 2027 |



\---



\## 13. Document Approvals



| Role | Name | Signature | Date |

|------|------|-----------|------|

| Product Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| Engineering Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| Marketing Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| Legal \& Compliance | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| QA Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |



\---



\## 14. Related Documents



| Document | Relationship |

|----------|-------------|

| \*\*Module 3 \& 5: Listening \& Monitoring\*\* | Influencer mention tracking; content performance from monitoring |

| \*\*Module 7: Analytics \& Reporting\*\* | program ₦ performance in unified dashboards |

| \*\*Module 8: Media Relations \& PR\*\* | Influencer → journalist relationship overlap |

| \*\*Module 6: Engagement Hub\*\* | Influencer engagement and response tracking |

| \*\*Architecture\*\* | RLS isolation patterns for multi-client agency use |

| \*\*ADRs\*\* | ADR-009 (multi-tenant RLS), ADR-011 (Paystack — for ₦ payment integration) |

| \*\*Database Schema\*\* | influencers, influencer\_program\_assignments, influencer\_content\_submissions tables |

| \*\*Security Architecture\*\* | NDPR compliance for influencer contact data; APCON Nigerian regulatory context |

| \*\*Engineering Standards\*\* | ₦ currency conventions; WAT timezone defaults |

| \*\*QA Strategy\*\* | Fraud detection testing; APCON compliance testing; ₦ ROI calculation testing |

| \*\*API Reference\*\* | Complete influencer endpoint documentation |

| \*\*Personas\*\* | Chidi (Head of Marketing), Ifeoma (Agency Owner), Bola (Social Media Manager), Kemi (Content Strategist) |

| \*\*User Journeys\*\* | Journey 10 (Agency Client Management), Journey 11 (Content Strategy) |



\---



\## Document Version History



| Version | Date | Author | Changes |

|---------|------|--------|---------|

| 1.0.0 | 2026-07-21 | Product Lead \& Engineering Lead | Unified and expanded Influencer Management module. Merges and improves both source documents. Adds: Nigerian market calibration throughout (Nigerian influencer tier classification with ₦ rate benchmarks per tier, WhatsApp as primary Nigerian creator communication channel with dedicated database field, APCON Nigerian regulatory compliance built into content approval workflow, Nigerian state-level geographic filtering, Nigerian audience percentage tracking, Nigerian-specific fraud patterns, ₦ ROI calculation with NGN throughout, Nigerian platform importance context), 6-tier RBAC matrix, complete RLS-protected database schema with NUMERIC(15,2) NGN monetary fields, WAT timezone defaults, Paystack payment integration as high-priority future enhancement, WhatsApp Business API as future enhancement, and Nigerian influencer marketplace roadmap. |



\---



\*This document is owned by the Product Lead and reviewed quarterly. All changes to Nigerian influencer tiers, ₦ rate benchmarks, APCON compliance rules, or fraud detection methodologies must be reflected in this document before implementation begins.\*

