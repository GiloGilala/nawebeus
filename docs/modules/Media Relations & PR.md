# Module 8: Media Relations & PR

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

The Media Relations & PR module provides comprehensive tools for press release management, journalist relationship tracking, PR initiative measurement, and crisis communications. It enables Nigerian and African PR teams to create, distribute, and track press releases, manage journalist relationships across Nigerian and international media, and measure the ₦ impact of PR activities on brand perception and business outcomes.

This module transforms PR from a manual, reactive function into a strategic, data-driven capability that builds lasting media relationships and demonstrates clear business value — all calibrated for the Nigerian media landscape, with ₦ (NGN) ROI calculations and WAT-timezone management.

### 1.2 Module Objectives

| Objective | Success Measure | Nigerian Context |
|-----------|-----------------|-----------------|
| **Press Release Management** | <15 minute distribution to targeted journalists | Including TechCabal, BusinessDay, Punch, Vanguard |
| **Journalist Relationship Management** | ≥80% auto-discovery of relevant Nigerian contacts | Nigerian byline analysis and beat mapping |
| **₦ PR Impact Measurement** | Clear ₦ AVE attribution to press releases | Nigerian advertising rate card basis |
| **Distribution Optimization** | ≥95% delivery to targeted Nigerian journalists | Email + wire + social distribution |
| **Embargo Management** | 100% embargo reliability | WAT-timezone embargo enforcement |
| **₦ ROI Demonstration** | Accurate ₦ ROI calculations | Total ₦ value generated vs. PR investment cost |

### 1.3 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Ade** (Head of PR, Enterprise Bank) | Admin / Manager | Press release management, journalist relationships, ₦ PR impact measurement, board-level reporting |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client PR management, white-label reporting, per-client ₦ ROI |
| **Ngozi** (Crisis Manager) | Manager | Crisis communications, holding statement generation, rapid distribution |
| **Chidi** (Head of Marketing, Fintech) | Manager | PR-marketing integration, announcement coordination, initiative planning |
| **Kemi** (Content Strategist) | Analyst | Press release drafting, message pull-through analysis, content optimization |

### 1.4 Module Scope

**In Scope:**
- Press release creation with AI assistance (AP style, regulatory compliance)
- Nigerian journalist database (CRM) with relationship scoring
- Multi-channel distribution (email, wire services, social media)
- Embargo management with WAT-timezone enforcement
- Interaction tracking (email, phone, meeting, event, social)
- Media list building and segmentation
- PR initiative management and ₦ ROI measurement
- ₦ AVE (Advertising Value Equivalence) calculation using Nigerian rate cards
- Crisis communications and holding statement generation
- Key message pull-through tracking in Nigerian media
- Coverage attribution (linking press releases to resulting articles)
- A/B testing for press release variations

**Out of Scope:**
- General social media monitoring (Module 3 & 5 handles this)
- Social publishing (Module 4 handles this)
- General engagement inbox (Module 6 handles this)
- Web analytics (dedicated web analytics tools)
- Full wire service subscriptions (integrates with, doesn't replace)

### 1.5 Dependencies

| Module | Relationship |
|--------|-------------|
| **Module 1: Authentication** | JWT authentication for all PR endpoints |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits; organization context |
| **Module 3 & 5: Listening & Monitoring** | Coverage tracking and article attribution |
| **Module 7: Analytics & Reporting** | ₦ PR performance reporting and unified dashboards |
| **Module 6: Engagement Hub** | Journalist engagement tracking handoff |
| **Module 9: Notifications** | Distribution notifications, embargo reminders, coverage alerts |

---

## 2. User Stories

### 2.1 Head of PR / Communications Director

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-PR-01 | Head of PR | Create press releases with AI assistance that maintains AP style and Nigerian English register | I write faster without sacrificing quality for Nigerian media audiences | P0 |
| US-PR-02 | Head of PR | Manage a database of Nigerian journalists with relationship scores, beat mapping, and interaction history | I build and maintain strategic media relationships in the Nigerian market | P0 |
| US-PR-03 | Head of PR | Distribute press releases to precisely targeted Nigerian and international journalists | I maximize coverage in the publications that matter to my stakeholders | P0 |
| US-PR-04 | Head of PR | Track coverage resulting from press releases and see ₦ AVE calculations | I can present ₦ PR ROI to the CFO and board | P0 |
| US-PR-05 | Head of PR | Manage embargoes with WAT timezone enforcement | I control the timing of announcements with Nigerian journalists | P0 |
| US-PR-06 | Head of PR | See which key messages appear in resulting coverage (pull-through analysis) | I know if our narrative is landing with Nigerian media | P1 |
| US-PR-07 | Head of PR | Generate competitor press release intelligence | I benchmark my PR strategy against Nigerian competitors | P2 |

### 2.2 Crisis Manager

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-PR-10 | Crisis Manager | Generate holding statements quickly with pre-approved templates | I respond to media inquiries within minutes during a Nigerian crisis | P0 |
| US-PR-11 | Crisis Manager | Distribute crisis communications to a pre-built media list with one click | I don't waste time building lists when seconds matter | P0 |
| US-PR-12 | Crisis Manager | Track journalist responses to crisis communications in real-time | I know which journalists have received and opened our statement | P0 |
| US-PR-13 | Crisis Manager | See coverage tone during crisis and track sentiment recovery | I know when the narrative has shifted and can advise the MD | P1 |

### 2.3 Agency Owner (Multi-Client)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-PR-20 | Agency Owner | Manage PR for multiple Nigerian brand clients from one platform with isolated workspaces | I scale my agency without proportional headcount growth | P0 |
| US-PR-21 | Agency Owner | Generate white-label ₦ PR performance reports for each client | I present professional reports on my agency's letterhead | P0 |
| US-PR-22 | Agency Owner | Share journalist contact databases across client initiatives where permitted | I leverage relationship capital across my client portfolio | P1 |

### 2.4 PR Analyst / Content Strategist

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-PR-30 | PR Analyst | Analyze press release performance (open rate, coverage rate, ₦ AVE) | I identify what works and brief the PR team on optimization | P1 |
| US-PR-31 | PR Analyst | Export journalist contact lists and interaction history | I can use them in email clients or other tools | P2 |
| US-PR-32 | Content Strategist | Use AI to optimize press release key messages based on historical performance | I improve message effectiveness without starting from scratch | P1 |

---

## 3. Functional Requirements

### 3.1 FR-PR-001: Press Release Creation & Management

**Description:** End-to-end press release lifecycle management with AI assistance, compliance checking, and collaborative review.

**Press Release Builder Features:**

| Feature | Description | Nigerian Context |
|---------|-------------|-----------------|
| AI-assisted writing | Generate or improve press release sections based on brief | Tuned for Nigerian English register |
| AP style checking | Real-time suggestions for style compliance | Flagging common Nigerian media style deviations |
| Key message extraction | Auto-extract and track key messages | Enables pull-through analysis |
| SEO optimization | Keyword suggestions for online distribution | Nigerian search behavior |
| Regulatory compliance | Industry-specific rule checking | CBN guidelines (banking), NCC (telecom), NAFDAC (healthcare) |
| Multimedia attachment | Images, videos, infographics, fact sheets | Stored in R2, linked in distribution |
| Embargo configuration | Set embargo date/time with WAT timezone | Enforced at database and application layer |
| Version control | Full draft history; restore any version | Last 20 versions retained |
| Collaborative editing | Multi-user review with comments and approval workflow | Manager approval before distribution |

**Press Release Lifecycle States:**

```
Draft → Review → Approved → Scheduled → Distributed → Published → Archived
  ↑        ↓
  └── Changes Requested
```

**Nigerian Regulatory Pre-Sets:**

| Industry | Compliance Rules Pre-Loaded |
|----------|---------------------------|
| Banking / Finance | CBN disclosure requirements; no guarantees of returns; NDIC language |
| Telecommunications | NCC consumer protection language; tariff disclosure requirements |
| Healthcare / Pharma | NAFDAC product claims restrictions; clinical trial language |
| Securities / Capital Markets | SEC disclosure requirements; material information rules |
| Oil & Gas | DPR safety disclosures; environmental statement requirements |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Press release builder provides real-time AP style suggestions |
| AC2 | Nigerian English accepted without incorrect grammar flags |
| AC3 | Regulatory compliance checks applied based on organization's industry |
| AC4 | Version control retains last 20 versions with full diff view |
| AC5 | Embargo prevents distribution or access before configured WAT time |
| AC6 | AI assistant generates contextually appropriate Nigerian market content |

---

### 3.2 FR-PR-002: Nigerian Journalist Database (CRM)

**Description:** Comprehensive journalist relationship management database with automated discovery, scoring, and NDPR-compliant contact management.

**Journalist Profile Fields:**

| Field | Description | Nigerian Context |
|-------|-------------|-----------------|
| Full name | Display name | — |
| Email(s) | Contact email(s) | Multiple emails (personal, work, WhatsApp) |
| Phone | Contact phone | Nigerian +234 format auto-formatted |
| WhatsApp | WhatsApp number | Dominant Nigerian journalist communication channel |
| Twitter/X handle | Social profile | Nigerian journalist Twitter presence |
| LinkedIn profile | Professional profile | — |
| Outlet (primary) | Primary publication | TechCabal, BusinessDay, Punch, Vanguard, etc. |
| Outlets (all) | All publications written for | Freelance across multiple Nigerian outlets |
| Beat(s) | Coverage topics | Tech, Finance, Banking, Telecom, Politics, Business |
| Geographic coverage | Locations covered | Lagos, Abuja, Port Harcourt, FCT, Kano |
| Language(s) | Reporting languages | English, Yoruba, Hausa, Igbo |
| Expertise score (0–100) | Topic authority | Based on coverage volume and authority |
| Relationship score (0–100) | Relationship strength | Based on interaction history |
| Response rate | % of pitches that get a response | Calculated from interaction history |
| Avg response time | Average hours to respond | Benchmark for follow-up timing |
| Coverage count | Articles about this organization | Attribution links |
| Preferred contact method | Email, WhatsApp, phone call | Per-journalist preference |
| NDPR consent status | Granted / Pending / Withdrawn | Required before contact |
| Consent date | Date consent was given | NDPR compliance record |
| Tags | Custom tags | e.g., "VIP", "friendly", "challenging" |
| Notes | Free-text notes | Relationship context |

**Automated Journalist Discovery:**

| Source | Method | Accuracy Target |
|--------|--------|----------------|
| Coverage byline analysis | Extract journalist names and email from monitored articles | ≥85% |
| Social media mention analysis | Identify journalists who discuss our brand | ≥80% |
| Outlet staff pages | Parse publication masthead pages | ≥90% |
| Press release open tracking | Identify journalists who engage with our releases | 100% |

**Nigerian Media Outlet Database (Pre-Loaded):**

| Category | Outlets |
|---------|---------|
| **National Newspapers** | Punch, Vanguard, The Guardian, The Nation, Sun |
| **Business Publications** | BusinessDay, Financial Times Nigeria, Nairametrics |
| **Technology Media** | TechCabal, Techpoint Africa, Disrupt Africa, IT Edge News |
| **Broadcast (Online)** | Channels TV, NTA Online, Arise News, TVC |
| **News Aggregators** | Premium Times, Daily Post, Sahara Reporters |
| **International (Africa-focused)** | Reuters Africa, BBC Africa, CNN Africa, Bloomberg Africa |

**Relationship Scoring Algorithm:**

```
Relationship Score (0–100) =
  (Interaction Frequency Score × 0.30)
  + (Response Rate Score × 0.25)
  + (Coverage Frequency Score × 0.25)
  + (Recency Score × 0.20)

Where:
- Interaction Frequency: More frequent interactions = higher score
- Response Rate: Higher % of pitches responded to = higher score
- Coverage Frequency: More articles written about the org = higher score
- Recency: More recent interactions = higher score; score decays with time
```

**NDPR Compliance:**

| Requirement | Implementation |
|-------------|---------------|
| Consent required | Cannot be added to distribution list without NDPR consent |
| Consent record | Date, method, and proof of consent stored |
| Opt-out respected | Immediate removal from all active lists |
| Data accuracy | Validation and deduplication on import |
| Retention limits | Contact data reviewed annually; purged if inactive + withdrawn |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Auto-discovery identifies ≥80% of relevant contacts from monitored coverage |
| AC2 | Nigerian phone numbers auto-formatted to +234... format |
| AC3 | WhatsApp contact field available for Nigerian journalists |
| AC4 | Relationship score updates in real-time after each interaction logged |
| AC5 | Cannot distribute to journalists without NDPR consent (hard block) |
| AC6 | Nigerian outlet database pre-loaded with 100+ publications |
| AC7 | Journalist search returns results within 1 second for 10,000+ contacts |

---

### 3.3 FR-PR-003: Smart Distribution Engine

**Description:** Intelligent multi-channel press release distribution with personalization, embargo management, and WAT-timezone-aware scheduling.

**Distribution Channels:**

| Channel | Description | Nigerian Context |
|---------|-------------|-----------------|
| Email | Direct to journalist inbox | Primary channel for Nigerian media |
| WhatsApp Business | Direct WhatsApp message + PDF | Major channel for Nigerian journalists |
| Wire services | PR Newswire Africa, BusinessWire | For broad international pickup |
| Social media | Twitter/X, LinkedIn | For broader amplification |
| Press portal | Organization's own press room page | Branded resource hub |

**Smart Media List Building:**

```
Input:
- Press release topic (e.g., "mobile banking app launch")
- Target geography (e.g., "Nigeria — Lagos, Abuja")
- Target outlets (e.g., "Tier 1 and Tier 2 business and tech media")
- Relationship filter (e.g., "relationship score ≥50")
- NDPR filter (auto-applied: consent = granted only)

Output:
- Recommended journalist list with relevance scores
- Estimated open rate based on historical performance with each journalist
- Recommended send time per journalist (based on their response patterns in WAT)
- Personalization suggestions (known preferences, last contact date)
```

**Distribution Personalization:**

| Personalization Type | Description |
|---------------------|-------------|
| Name insertion | "Dear Ade," not "Dear Journalist," |
| Recent article reference | "I saw your recent piece on fintech in Nigeria..." |
| Beat alignment note | "Given your coverage of Nigerian banking..." |
| Exclusivity flag | "Offering you an exclusive 30-minute briefing..." |
| Last contact context | "Following our meeting at Lagos Tech Week..." |
| Custom intro | Per-journalist custom opening paragraph |

**Timing Optimization:**

| Factor | Data Used |
|--------|-----------|
| Day of week | Historical open rates by journalist by day |
| Time of day (WAT) | Historical open rates by journalist by hour |
| Publication cycle | Known publication day of weekly/monthly outlets |
| Nigerian calendar | Avoid public holidays; post-Ramadan timing (for northern outlets) |
| Competitive timing | Avoid same day as major competitor announcements |

**Embargo Management:**

```
Embargo Enforcement Layers:
1. Database layer: Content inaccessible to unauthorized queries before embargo_at
2. Application layer: API returns 403 EMBARGO_ACTIVE before embargo_at
3. Distribution layer: Scheduling blocked before embargo_at minus buffer
4. Notification: 24h, 1h, and 15m WAT reminders to embargo list
5. Audit log: All pre-embargo access attempts logged

Embargo break detection:
- If monitoring detects coverage before embargo_at, trigger immediate alert
- Crisis team notified; distribution to remaining list accelerated
```

**A/B Testing:**

| Element | Test Options |
|---------|-------------|
| Subject line | 2 variants with statistical significance reporting |
| Headline | 2 variants |
| Intro paragraph | 2 variants |
| Call to action | 2 variants |
| Send time (WAT) | 2 time slots |
| Minimum sample | 30 recipients per variant for significance |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Distribution reaches targeted journalists within 15 minutes of sending |
| AC2 | WhatsApp distribution channel available for Nigerian journalist contacts |
| AC3 | Embargo prevents distribution before configured WAT date/time with 100% reliability |
| AC4 | Personalized distributions include journalist name and relevant context |
| AC5 | Timing recommendations shown in WAT |
| AC6 | A/B test results show statistical significance level |
| AC7 | NDPR consent check applied automatically before any distribution |

---

### 3.4 FR-PR-004: Interaction Tracking & Relationship Management

**Description:** Complete outreach history with automated capture, response tracking, and follow-up management.

**Interaction Types:**

| Type | Description | Tracking |
|------|-------------|---------|
| Email | Email correspondence | Open/click tracking; reply capture |
| WhatsApp | WhatsApp messages | Sent/delivered/read status |
| Phone call | Phone conversation | Manual log; call notes |
| Meeting | In-person or video meeting | Calendar integration; notes |
| Event | Press conference, media briefing, industry event | Attendance tracking |
| Social | Twitter DM, LinkedIn message | Platform-specific |
| Press release open | Journalist opened distributed release | Automatic from distribution tracking |
| Coverage published | Journalist published article mentioning org | Automatic from monitoring |

**Interaction Log Entry:**

```json
{
  "id": "int_8e4c5d6e",
  "journalistId": "jrn_9f2a4b6c",
  "pressReleaseId": "pr_3b4c5d6e",  // optional
  "type": "email",
  "direction": "outbound",
  "subject": "Exclusive briefing: First Bank digital banking launch",
  "content": "Hi Ade, hope you're well. I wanted to share an exclusive...",
  "outcome": "positive",
  "responseTimeMinutes": 47,
  "followUpDate": "2026-07-24T10:00:00+01:00",  // WAT
  "createdBy": "usr_7e3b2c1d",
  "createdAt": "2026-07-21T11:30:00+01:00"  // WAT
}
```

**Follow-Up Management:**

| Feature | Description |
|---------|-------------|
| Automated reminders | Alert when follow-up date approaches |
| Snooze | Defer follow-up; resurface at later WAT time |
| Bulk follow-up | Send follow-up to all non-responding journalists |
| Status tracking | Outstanding, followed up, responded, closed |
| Follow-up templates | Pre-written follow-up messages by scenario |

**Response Rate Analytics:**

| Metric | Description |
|--------|-------------|
| Overall response rate | % of outreach that gets a response |
| By journalist | Per-journalist response rate (for targeting) |
| By release topic | Which topics generate most responses |
| By day/time (WAT) | Best time to pitch Nigerian journalists |
| By outlet tier | Tier 1 vs. Tier 2 vs. Tier 3 response rates |
| By channel | Email vs. WhatsApp vs. phone response rates |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | All interaction types logged with WAT timestamps |
| AC2 | Email interactions captured automatically from distribution tracking |
| AC3 | Coverage published auto-logged as interaction from monitoring module |
| AC4 | Relationship score updates within 5 minutes of new interaction |
| AC5 | Follow-up reminders delivered at correct WAT time |
| AC6 | WhatsApp interactions loggable for Nigerian journalist management |

---

### 3.5 FR-PR-005: Initiative Management

**Description:** End-to-end PR initiative management with ₦ target-setting, coverage tracking, and ROI calculation.

**Initiative Structure:**

```
Initiative
├── Initiative Goal (₦ AVE target, coverage count target, sentiment target)
├── Press Releases (one or more linked releases)
├── Distribution Lists (journalists targeted)
├── Interaction Log (all outreach within initiative)
├── Coverage Results (articles generated)
├── ₦ Performance (AVE, cost, ROI)
└── Post-Initiative Report (auto-generated)
```

**Initiative Metrics:**

| Metric | Description | Nigerian Context |
|--------|-------------|-----------------|
| Coverage count | Number of articles generated | By Nigerian outlet tier |
| ₦ AVE | Advertising value equivalence of coverage | Based on Nigerian rate cards |
| Media impressions | Total estimated readership of coverage | Nigerian circulation figures |
| Tier 1 coverage | Articles in top-tier Nigerian publications | BusinessDay, Punch, TechCabal |
| Message pull-through | % of coverage mentioning key messages | Brand narrative effectiveness |
| Sentiment | Average sentiment of coverage generated | Positive, neutral, negative |
| Response rate | % of journalists who responded | By outlet tier |
| Open rate | % of press releases opened | Benchmark for subject lines |
| ₦ PR ROI | (₦ AVE ÷ ₦ PR investment cost) | CFO-level justification |

**₦ ROI Calculation:**

```
₦ PR ROI = (₦ Total AVE Generated + ₦ Attributable Business Value) ÷ ₦ Total PR Cost

Where:
  ₦ Total AVE Generated = SUM(article_reach × naira_rate_per_1000_readers × quality_multiplier × sentiment_multiplier)
  
  ₦ Attributable Business Value = (New leads from PR × avg lead value in ₦) 
                                   + (Retained customers from positive coverage × avg customer LTV in ₦)
  
  ₦ Total PR Cost = Agency fees or in-house PR team cost (₦) 
                    + Distribution platform cost (₦) 
                    + Wire service fees (₦)
                    + Event/press conference costs (₦)

Example:
  ₦ AVE = ₦42,000,000
  ₦ Attributable Value = ₦8,000,000
  ₦ PR Cost = ₦15,000,000
  ₦ PR ROI = (42,000,000 + 8,000,000) ÷ 15,000,000 = 3.33×
```

**Post-initiative Report (Auto-Generated):**

- Executive summary (narrative AI-generated)
- ₦ KPI dashboard vs. targets
- Coverage gallery (links and excerpts from all articles)
- Key message pull-through chart
- Journalist response analysis
- Sentiment breakdown
- Geographic distribution of coverage
- Competitor comparison (if configured)
- Recommendations for next initiative

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | initiative ₦ targets configurable (AVE, coverage count, sentiment) |
| AC2 | ₦ AVE calculated using current Nigerian advertising rate cards |
| AC3 | ₦ PR ROI calculation includes all configured cost inputs |
| AC4 | Post-initiative report auto-generated within 30 minutes of initiative end |
| AC5 | Message pull-through tracks configured key messages in article text |
| AC6 | initiative dashboard loads within 3 seconds |

---

### 3.6 FR-PR-006: Crisis Communications

**Description:** Rapid-response crisis communication tools with pre-approved templates, one-click distribution, and real-time tracking.

**Crisis PR Toolkit:**

| Tool | Description |
|------|-------------|
| Holding statement library | Pre-approved holding statements by crisis type |
| Dark site activation | Pre-built crisis landing page (instant activation) |
| Rapid distribution list | Pre-built "all tier 1 media" list for instant deployment |
| Crisis timeline | Chronological log of all crisis communications |
| Statement versioning | Track which journalists received which version |
| Sentiment monitoring | Real-time sentiment tracking during crisis (from Module 3 & 5) |
| Recovery tracking | Monitor sentiment recovery after crisis response |

**Crisis Statement Templates (Nigerian Context):**

| Crisis Type | Pre-Built Template |
|------------|-------------------|
| Service outage (banking/fintech) | App downtime holding statement (CBN-compliant language) |
| Data breach | Data incident notification (NDPR-compliant) |
| Regulatory action | Regulatory engagement statement |
| Product recall | Consumer safety statement (NAFDAC-compliant) |
| Leadership change | Executive transition statement |
| Security incident | Security response statement |
| Accident or fatality | Sympathy and safety statement |
| Environmental incident | Environmental responsibility statement |
| Financial irregularity | Financial governance statement |
| Social media controversy | Social media response statement |

**Crisis Distribution Speed:**

```
Crisis Mode Workflow:
1. Crisis detected (manual or automatic via Module 3 & 5)
2. Crisis team notified (<2 minutes via push + SMS)
3. Holding statement selected from library (<1 minute)
4. Approved by authorized manager (emergency approval; 5-minute SLA)
5. Distributed to pre-built tier 1 media list (<5 minutes from approval)
6. Tracking dashboard activated in real-time

Total time from crisis detection to journalist notification: Target <15 minutes
```

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Holding statements accessible and distributable within 5 minutes |
| AC2 | Pre-built crisis distribution lists activated with single click |
| AC3 | Crisis distribution reaches tier 1 Nigerian journalists within 15 minutes |
| AC4 | Nigerian industry-specific crisis templates (banking, telecom, healthcare) pre-loaded |
| AC5 | Crisis timeline captures all communications with WAT timestamps |
| AC6 | Real-time sentiment monitoring visible during crisis (from monitoring module) |

---

### 3.7 FR-PR-007: PR Performance Analytics

**Description:** Comprehensive PR analytics with ₦ AVE, coverage attribution, message pull-through, and competitive benchmarking.

**Coverage Attribution:**

| Attribution Method | Description | Confidence |
|-------------------|-------------|-----------|
| Automatic (keyword match) | Article mentions press release keywords within 48 hours | High (85%+) |
| Automatic (journalist link) | Journalist opened release AND published article | Very high (95%+) |
| Automatic (content match) | Article text matches press release content (NLP similarity) | High (80%+) |
| Manual | User manually links article to press release | 100% |

**Message Pull-Through Analysis:**

```
For press release key messages: ["AI-powered security", "Real-time transactions", "User-friendly"]

For each resulting article:
- Parse article text for key message presence
- Calculate pull-through rate: messages mentioned / total key messages × 100

Example:
  Article 1 (TechCabal): "AI-powered security" ✅ "Real-time" ✅ "User-friendly" ❌ → 67% pull-through
  Article 2 (BusinessDay): "AI-powered security" ✅ "Real-time" ❌ "User-friendly" ❌ → 33% pull-through
  
  initiative average: 50% message pull-through
```

**Nigerian ₦ AVE Calculation:**

```
₦ AVE per Article = 
  Source Circulation × (Nigerian Full-Page Rate in ₦ / 1,000)
  × Space Factor × Quality Multiplier × Sentiment Multiplier

Where:
  Space Factor = 1.0 (full page), 0.5 (half page), 0.25 (quarter), 0.1 (passing mention)
  Quality Multiplier = 1.0–2.0 (editorial quality, headline prominence, online longevity)
  Sentiment Multiplier = 1.5 (positive), 1.0 (neutral), 0.3 (negative)

Nigerian Rate Card Examples (sample; updated quarterly):
  BusinessDay full page: ₦2,500,000
  Punch full page: ₦2,200,000
  TechCabal full page: ₦1,500,000
  Channels TV (online): ₦3,000,000
  Vanguard full page: ₦1,800,000
```

**Competitive PR Benchmarking:**

| Metric | Description |
|--------|-------------|
| Competitor release frequency | How often competitors distribute press releases |
| Competitor outlet coverage | Which publications cover competitors |
| Share of voice | Organization's press release coverage vs. competitors |
| Competitive message mapping | What messages competitors are pushing in Nigerian media |
| Response rate comparison | How journalists respond to our releases vs. competitors' |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Coverage attribution achieves ≥90% accuracy for automatic matching |
| AC2 | ₦ AVE calculated using current Nigerian rate cards (updated quarterly) |
| AC3 | Message pull-through analysis covers all configured key messages |
| AC4 | ₦ PR ROI calculation available within 5 minutes of data update |
| AC5 | All analytics timestamps shown in WAT |
| AC6 | Competitive PR data clearly labeled as estimates |

---

## 4. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-PR-01 | Press releases must pass AP style check before distribution can be initiated | Maintains professional standards for Nigerian and international media |
| BR-PR-02 | Embargoed content inaccessible (403 error) before embargo_at (WAT) | Protects exclusivity; maintains media trust |
| BR-PR-03 | Distribution requires NDPR consent for every journalist on the list | NDPR compliance; prevents legal exposure |
| BR-PR-04 | Press releases versioned on every edit; full change history retained | Audit trail; liability protection |
| BR-PR-05 | Key messages extracted on creation and tracked in all resulting coverage | Enables message pull-through measurement |
| BR-PR-06 | Relationship score recalculated within 5 minutes of any new interaction | Current score needed for targeting decisions |
| BR-PR-07 | Journalist preferences (WhatsApp, email, phone) respected in distribution channel | Maintains professional relationships; improves response rates |
| BR-PR-08 | Duplicate contact detection on import; merge workflow for duplicates | Data quality for distribution accuracy |
| BR-PR-09 | Distribution timing recommendations shown in WAT timezone | Nigerian journalist scheduling context |
| BR-PR-10 | A/B test results require minimum 30 recipients per variant for significance | Statistical validity of test results |
| BR-PR-11 | ₦ PR ROI calculation requires PR cost input; displays "cost not configured" if absent | Transparency in calculations |
| BR-PR-12 | All ₦ monetary values in press release analytics use NGN (₦) | Nigerian market consistency |
| BR-PR-13 | Crisis mode distribution bypasses standard scheduling; goes immediately | Speed critical in crisis response |
| BR-PR-14 | Post-initiative report auto-generated within 30 minutes of initiative end date | Prompt learning and reporting |

---

## 5. Permissions

### 5.1 RBAC Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Press Releases** |
| View press releases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create press release | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit press release | ✅ | ✅ | ✅ | Own only | Own only | ❌ |
| Submit for review | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve press release | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Distribute press release | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete press release | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Journalist Database** |
| View journalists | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add journalist | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit journalist | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete journalist | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export journalist list | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage NDPR consent | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Interactions** |
| Log interaction | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View interactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **initiatives** |
| View initiatives | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create initiative | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit initiative | ✅ | ✅ | ✅ | Own only | ❌ | ❌ |
| Delete initiative | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure ₦ targets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Analytics** |
| View PR analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View ₦ ROI data | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Export analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Crisis** |
| Activate crisis mode | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Distribute holding statement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage crisis templates | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 6. API Reference

### 6.1 PR Endpoints

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| `GET` | `/api/v1/pr/press-releases` | ✅ | Creator+ | List press releases |
| `POST` | `/api/v1/pr/press-releases` | ✅ | Creator+ | Create press release |
| `GET` | `/api/v1/pr/press-releases/:id` | ✅ | Creator+ | Get press release |
| `PATCH` | `/api/v1/pr/press-releases/:id` | ✅ | Creator+ | Update press release |
| `DELETE` | `/api/v1/pr/press-releases/:id` | ✅ | Manager+ | Delete press release |
| `POST` | `/api/v1/pr/press-releases/:id/submit` | ✅ | Creator+ | Submit for review |
| `POST` | `/api/v1/pr/press-releases/:id/approve` | ✅ | Manager+ | Approve press release |
| `POST` | `/api/v1/pr/press-releases/:id/distribute` | ✅ | Manager+ | Distribute press release |
| `GET` | `/api/v1/pr/press-releases/:id/analytics` | ✅ | Analyst+ | Get distribution analytics |
| `GET` | `/api/v1/pr/journalists` | ✅ | Creator+ | List journalists |
| `POST` | `/api/v1/pr/journalists` | ✅ | Creator+ | Add journalist |
| `GET` | `/api/v1/pr/journalists/:id` | ✅ | Creator+ | Get journalist profile |
| `PATCH` | `/api/v1/pr/journalists/:id` | ✅ | Creator+ | Update journalist |
| `DELETE` | `/api/v1/pr/journalists/:id` | ✅ | Manager+ | Delete journalist |
| `POST` | `/api/v1/pr/journalists/import` | ✅ | Manager+ | Bulk import journalists |
| `GET` | `/api/v1/pr/journalists/export` | ✅ | Analyst+ | Export journalist list |
| `POST` | `/api/v1/pr/interactions` | ✅ | Creator+ | Log interaction |
| `GET` | `/api/v1/pr/interactions` | ✅ | Creator+ | List interactions |
| `GET` | `/api/v1/pr/initiatives` | ✅ | Creator+ | List initiatives |
| `POST` | `/api/v1/pr/initiatives` | ✅ | Creator+ | Create initiative |
| `GET` | `/api/v1/pr/initiatives/:id` | ✅ | Creator+ | Get initiative |
| `PATCH` | `/api/v1/pr/initiatives/:id` | ✅ | Manager+ | Update initiative |
| `POST` | `/api/v1/pr/initiatives/:id/report` | ✅ | Manager+ | Generate initiative report |
| `POST` | `/api/v1/pr/crisis/activate` | ✅ | Manager+ | Activate crisis mode |
| `POST` | `/api/v1/pr/crisis/distribute` | ✅ | Manager+ | Distribute crisis statement |

### 6.2 Request/Response Examples

**Create Press Release:**

```http
POST /api/v1/pr/press-releases
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "First Bank of Nigeria Launches New Digital Banking Platform",
  "headline": "First Bank Unveils AI-Powered Digital Banking Platform for 10 Million Customers",
  "subheadline": "New platform features biometric authentication, instant transfers, and 24/7 AI support",
  "body": "Lagos, Nigeria — First Bank of Nigeria, the country's oldest financial institution, today announced the launch of its new digital banking platform...",
  "keyMessages": [
    "Biometric security for all customers",
    "Instant transfers to all Nigerian banks",
    "24/7 AI-powered customer support in English and Pidgin"
  ],
  "embargoAt": "2026-07-25T09:00:00+01:00",
  "timezone": "Africa/Lagos",
  "targetAudience": ["banking", "fintech", "technology"],
  "mediaIds": ["med_7a8b9c0d", "med_8b9c0d1e"],
  "tags": ["digital-banking", "fintech", "launch"]
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "pr_3b4c5d6e7f8a9b0c",
    "title": "First Bank of Nigeria Launches New Digital Banking Platform",
    "status": "draft",
    "apStyleChecked": true,
    "regulatoryChecked": false,
    "embargoAt": "2026-07-25T09:00:00+01:00",
    "timezone": "Africa/Lagos",
    "createdAt": "2026-07-21T10:00:00+01:00"
  }
}
```

**Get Journalist List:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": [
    {
      "id": "jrn_9f2a4b6c8d1e3f5g",
      "fullName": "Ade Ogun",
      "email": "ade.ogun@techcabal.com",
      "whatsapp": "+2348012345678",
      "twitterHandle": "@adeogun",
      "outlet": "TechCabal",
      "beats": ["technology", "fintech", "startups"],
      "location": "Lagos",
      "expertiseScore": 85,
      "relationshipScore": 72,
      "responseRate": 68,
      "avgResponseTimeHours": 4.2,
      "ndprConsentStatus": "granted",
      "ndprConsentDate": "2026-03-15T00:00:00+01:00",
      "coverageCount": 12,
      "lastInteractionAt": "2026-07-18T14:30:00+01:00",
      "preferredContactMethod": "whatsapp",
      "tags": ["tech-beat", "fintech-expert", "responsive"]
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Impybl8xMjMifQ==",
    "hasMore": true,
    "totalCount": 247
  }
}
```

**Distribute Press Release:**

```http
POST /api/v1/pr/press-releases/pr_3b4c5d6e/distribute
Content-Type: application/json

{
  "targetList": ["jrn_9f2a4b6c", "jrn_7e3b2c1d", "jrn_8d4c3b2a"],
  "channel": "email",
  "subject": "Exclusive: First Bank Launches AI-Powered Digital Banking Platform",
  "personalized": true,
  "scheduledAt": "2026-07-25T09:05:00+01:00",
  "timezone": "Africa/Lagos"
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "dist_4c5d6e7f8a9b0c1d",
    "pressReleaseId": "pr_3b4c5d6e7f8a9b0c",
    "targetCount": 47,
    "channel": "email",
    "status": "scheduled",
    "scheduledAt": "2026-07-25T09:05:00+01:00",
    "timezone": "Africa/Lagos"
  }
}
```

**Get Distribution Analytics:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "distributionId": "dist_4c5d6e7f8a9b0c1d",
    "pressRelease": {
      "id": "pr_3b4c5d6e7f8a9b0c",
      "title": "First Bank of Nigeria Launches New Digital Banking Platform"
    },
    "metrics": {
      "targetCount": 47,
      "deliveredCount": 45,
      "openCount": 31,
      "clickCount": 14,
      "responseCount": 8,
      "coverageCount": 5
    },
    "rates": {
      "openRate": 68.9,
      "clickRate": 31.1,
      "responseRate": 17.8,
      "coverageRate": 11.1
    },
    "aveNaira": 42000000,
    "currency": "NGN",
    "geographicBreakdown": {
      "Lagos": 18,
      "Abuja": 8,
      "Port Harcourt": 3,
      "International": 2
    },
    "topOpeningOutlets": ["TechCabal", "BusinessDay", "Punch", "Premium Times"],
    "messagePullThrough": {
      "Biometric security for all customers": 80,
      "Instant transfers to all Nigerian banks": 60,
      "24/7 AI-powered customer support in English and Pidgin": 40
    }
  }
}
```

**Create initiative:**

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "cmp_5d6e7f8a9b0c1d2e",
    "name": "First Bank Digital Banking Launch initiative",
    "status": "active",
    "targets": {
      "coverageCount": 10,
      "aveNaira": 50000000,
      "impressions": 5000000,
      "sentimentTarget": 0.50,
      "currency": "NGN"
    },
    "createdAt": "2026-07-21T10:00:00+01:00"
  }
}
```

---

## 7. Database Schema

### 7.1 Core Tables

```sql
-- Press releases
CREATE TABLE press_releases (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                 VARCHAR(500) NOT NULL,
  headline              VARCHAR(500) NOT NULL,
  subheadline           VARCHAR(500),
  body                  TEXT NOT NULL,
  key_messages          TEXT[],                         -- Tracked for pull-through analysis
  status                VARCHAR(30) DEFAULT 'draft'
                        CHECK (status IN ('draft', 'review', 'changes_requested', 'approved', 'scheduled', 'distributed', 'published', 'archived')),
  embargo_at            TIMESTAMPTZ,                    -- WAT timezone enforced
  timezone              VARCHAR(100) DEFAULT 'Africa/Lagos',
  distribution_at       TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  target_audience       TEXT[],
  media_ids             TEXT[],
  tags                  TEXT[],
  ap_style_checked      BOOLEAN DEFAULT FALSE,
  regulatory_checked    BOOLEAN DEFAULT FALSE,
  regulatory_industry   VARCHAR(50),                    -- banking, telecom, healthcare, etc.
  version               INTEGER DEFAULT 1,
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY pr_isolation ON press_releases
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_pr_org ON press_releases(organization_id);
CREATE INDEX idx_pr_status ON press_releases(organization_id, status);
CREATE INDEX idx_pr_embargo ON press_releases(embargo_at)
  WHERE embargo_at IS NOT NULL AND status = 'approved';

-- Press release versions (audit trail)
CREATE TABLE press_release_versions (
  id                VARCHAR(32) PRIMARY KEY,
  press_release_id  VARCHAR(32) NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  body              TEXT NOT NULL,
  key_messages      TEXT[],
  changed_by_id     VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journalists (CRM)
CREATE TABLE journalists (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name                 VARCHAR(200) NOT NULL,
  first_name                VARCHAR(100),
  last_name                 VARCHAR(100),
  email                     VARCHAR(255),
  email_secondary           VARCHAR(255),
  phone                     VARCHAR(20),                -- E.164, +234 for Nigerian
  whatsapp                  VARCHAR(20),                -- Nigerian WhatsApp
  twitter_handle            VARCHAR(100),
  linkedin_url              TEXT,
  outlet_primary            VARCHAR(255) NOT NULL,
  outlets_all               TEXT[],
  beats                     TEXT[],
  specialty_topics          TEXT[],
  location                  TEXT,
  geographic_coverage       TEXT[],
  languages                 TEXT[],
  -- Scoring
  expertise_score           INTEGER DEFAULT 0,          -- 0–100
  relationship_score        INTEGER DEFAULT 0,          -- 0–100
  response_rate             DECIMAL(5,2),               -- % (0–100)
  avg_response_time_hours   DECIMAL(6,2),
  preferred_contact_method  VARCHAR(20) DEFAULT 'email'
                            CHECK (preferred_contact_method IN ('email', 'whatsapp', 'phone', 'social')),
  -- NDPR compliance
  ndpr_consent_status       VARCHAR(20) DEFAULT 'pending'
                            CHECK (ndpr_consent_status IN ('pending', 'granted', 'withdrawn')),
  ndpr_consent_date         TIMESTAMPTZ,
  ndpr_consent_method       VARCHAR(50),
  -- Stats
  interaction_count         INTEGER DEFAULT 0,
  coverage_count            INTEGER DEFAULT 0,          -- Articles about this org
  last_interaction_at       TIMESTAMPTZ,
  -- Metadata
  tags                      TEXT[],
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journalists ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalists FORCE ROW LEVEL SECURITY;
CREATE POLICY j_isolation ON journalists
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_j_org ON journalists(organization_id);
CREATE INDEX idx_j_email ON journalists(organization_id, email);
CREATE INDEX idx_j_relationship ON journalists(organization_id, relationship_score DESC);
CREATE INDEX idx_j_search ON journalists
  USING GIN(to_tsvector('english', full_name || ' ' || outlet_primary));
CREATE INDEX idx_j_ndpr ON journalists(organization_id, ndpr_consent_status);
CREATE INDEX idx_j_beats ON journalists USING GIN(beats);

-- Distributions
CREATE TABLE pr_distributions (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  press_release_id  VARCHAR(32) NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  target_journalist_ids TEXT[] NOT NULL,
  channel           VARCHAR(20) NOT NULL
                    CHECK (channel IN ('email', 'whatsapp', 'wire', 'social')),
  subject           TEXT,
  personalized      BOOLEAN DEFAULT FALSE,
  status            VARCHAR(20) DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sending', 'sent', 'completed', 'failed')),
  scheduled_at      TIMESTAMPTZ,
  timezone          VARCHAR(100) DEFAULT 'Africa/Lagos',
  sent_at           TIMESTAMPTZ,
  -- Metrics
  target_count      INTEGER DEFAULT 0,
  delivered_count   INTEGER DEFAULT 0,
  open_count        INTEGER DEFAULT 0,
  click_count       INTEGER DEFAULT 0,
  response_count    INTEGER DEFAULT 0,
  coverage_count    INTEGER DEFAULT 0,
  -- ₦ metrics
  ave_naira         NUMERIC(15,2) DEFAULT 0,
  currency          VARCHAR(3) DEFAULT 'NGN',
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pr_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_distributions FORCE ROW LEVEL SECURITY;
CREATE POLICY dist_isolation ON pr_distributions
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_dist_org ON pr_distributions(organization_id);
CREATE INDEX idx_dist_pr ON pr_distributions(press_release_id);

-- Journalist interactions
CREATE TABLE pr_interactions (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  journalist_id         VARCHAR(32) NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
  press_release_id      VARCHAR(32) REFERENCES press_releases(id),
  distribution_id       VARCHAR(32) REFERENCES pr_distributions(id),
  interaction_type      VARCHAR(20) NOT NULL
                        CHECK (interaction_type IN ('email', 'whatsapp', 'phone', 'meeting', 'event', 'social', 'press_release_open', 'coverage_published')),
  direction             VARCHAR(20)
                        CHECK (direction IN ('inbound', 'outbound', 'automatic')),
  subject               TEXT,
  content               TEXT,
  outcome               VARCHAR(20)
                        CHECK (outcome IN ('positive', 'neutral', 'negative', 'no_response', 'coverage')),
  response_time_minutes INTEGER,
  follow_up_at          TIMESTAMPTZ,                   -- WAT timezone
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable — no updates
);

ALTER TABLE pr_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY int_isolation ON pr_interactions
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_int_org ON pr_interactions(organization_id, created_at DESC);
CREATE INDEX idx_int_journalist ON pr_interactions(journalist_id, created_at DESC);
CREATE INDEX idx_int_followup ON pr_interactions(follow_up_at)
  WHERE follow_up_at IS NOT NULL;

-- PR initiatives
CREATE TABLE pr_initiatives (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  start_date            TIMESTAMPTZ NOT NULL,
  end_date              TIMESTAMPTZ,
  status                VARCHAR(20) DEFAULT 'planning'
                        CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  -- ₦ Targets (all in NGN)
  target_coverage_count INTEGER,
  target_ave_naira      NUMERIC(15,2),
  target_impressions    BIGINT,
  target_sentiment      DECIMAL(3,2),
  currency              VARCHAR(3) DEFAULT 'NGN',
  -- ₦ Cost inputs
  agency_cost_naira     NUMERIC(15,2) DEFAULT 0,
  distribution_cost_naira NUMERIC(15,2) DEFAULT 0,
  wire_cost_naira       NUMERIC(15,2) DEFAULT 0,
  event_cost_naira      NUMERIC(15,2) DEFAULT 0,
  -- Actual metrics (computed)
  actual_coverage_count INTEGER DEFAULT 0,
  actual_ave_naira      NUMERIC(15,2) DEFAULT 0,
  actual_impressions    BIGINT DEFAULT 0,
  actual_sentiment      DECIMAL(3,2),
  roi_naira             DECIMAL(10,4),                 -- (AVE + value) / cost
  -- Metadata
  press_release_ids     TEXT[],
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pr_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_initiatives FORCE ROW LEVEL SECURITY;
CREATE POLICY camp_isolation ON pr_initiatives
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_camp_org ON pr_initiatives(organization_id);
CREATE INDEX idx_camp_status ON pr_initiatives(organization_id, status);

-- Coverage attribution
CREATE TABLE pr_coverage_attribution (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  press_release_id  VARCHAR(32) NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  article_id        VARCHAR(32),                       -- From monitoring module
  journalist_id     VARCHAR(32) REFERENCES journalists(id),
  outlet            VARCHAR(255) NOT NULL,
  article_url       TEXT,
  article_title     TEXT,
  published_at      TIMESTAMPTZ,
  attribution_method VARCHAR(30)
                    CHECK (attribution_method IN ('keyword_match', 'journalist_link', 'content_match', 'manual')),
  attribution_confidence DECIMAL(3,2),
  -- ₦ values
  ave_naira         NUMERIC(15,2) DEFAULT 0,
  impressions       BIGINT DEFAULT 0,
  currency          VARCHAR(3) DEFAULT 'NGN',
  -- Message pull-through
  key_messages_found TEXT[],
  pull_through_rate DECIMAL(5,2),
  -- Sentiment
  sentiment_label   VARCHAR(20),
  sentiment_score   DECIMAL(3,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pr_coverage_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_coverage_attribution FORCE ROW LEVEL SECURITY;
CREATE POLICY cov_isolation ON pr_coverage_attribution
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_cov_pr ON pr_coverage_attribution(press_release_id);
CREATE INDEX idx_cov_org ON pr_coverage_attribution(organization_id, published_at DESC);

-- Crisis communications
CREATE TABLE pr_crisis_templates (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  crisis_type       VARCHAR(50) NOT NULL,              -- service_outage, data_breach, recall, etc.
  industry          VARCHAR(50),                       -- banking, telecom, healthcare, etc.
  holding_statement TEXT NOT NULL,
  is_approved       BOOLEAN DEFAULT FALSE,
  approved_by_id    VARCHAR(32) REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by_id     VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pr_crisis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_crisis_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY crisis_isolation ON pr_crisis_templates
  USING (organization_id = current_setting('app.current_org_id', true));
```

---

## 8. Email Notifications

### 8.1 PR Module Notification Templates

| Event | Recipient | Subject | SLA | Nigerian Context |
|-------|-----------|---------|-----|-----------------|
| Press release submitted for review | Approvers | "📰 Review needed: [Title]" | <30 seconds | WAT timestamp |
| Press release approved | Creator | "✅ Approved for distribution: [Title]" | <30 seconds | — |
| Press release distributed | Creator + Manager | "📨 Distributed to [N] journalists: [Title]" | <2 minutes | WAT send time |
| Distribution completed | Creator + Manager | "✅ Distribution complete: [Open Rate]% opened" | <30 minutes | Metrics in ₦ where applicable |
| Coverage detected | Creator + Manager | "📰 Coverage: [Outlet] published about [Title]" | <15 minutes | ₦ AVE shown |
| Embargo reminder (24h before) | All stakeholders | "⏰ Embargo expires in 24 hours: [Title]" | 24h before embargo_at WAT | WAT time |
| Embargo reminder (1h before) | All stakeholders | "⏰ Embargo expires in 1 hour: [Title]" | 1h before embargo_at WAT | WAT time |
| Embargo lifted | All stakeholders | "🟢 Embargo lifted — distribute now: [Title]" | At embargo_at WAT | — |
| Journalist response received | Creator | "💬 [Journalist Name] responded to [Title]" | <5 minutes | — |
| Follow-up reminder | Assigned user | "⏰ Follow up with [Journalist Name] today" | At follow_up_at WAT | WAT timing |
| ₦ initiative ₦ target achieved | Manager + Creator | "🎉 ₦ PR target achieved: ₦[Amount] AVE" | Within 5 minutes | ₦ figures |
| initiative report ready | initiative creator | "📊 [initiative Name] post-initiative report ready" | Within 30 minutes of end | ₦ ROI shown |
| Crisis mode activated | All Managers + Admins | "🚨 Crisis mode activated — action required" | <2 minutes | Immediate |

### 8.2 In-App Notifications

| Event | Icon | Message | Dismissible |
|-------|------|---------|------------|
| New coverage detected | 📰 | "[Outlet] published coverage of [Release]" | Yes |
| ₦ AVE milestone | 💰 | "₦ AVE reached ₦[Amount] for [initiative]" | Yes |
| Embargo approaching | ⏰ | "Embargo expires in [N] hours: [Release]" | No (sticky) |
| Journalist response | 💬 | "[Name] replied to your pitch" | Yes |
| Distribution complete | ✅ | "Distribution to [N] journalists complete" | Yes |
| Follow-up due | 🔔 | "Follow up with [Name] by today" | No (sticky) |

---

## 9. Error Handling

### 9.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `PR_RELEASE_NOT_FOUND` | 404 | Press release not found | Check press release ID |
| `PR_EMBARGO_ACTIVE` | 403 | This press release is under embargo until [WAT time] | Wait until embargo_at |
| `PR_NDPR_CONSENT_REQUIRED` | 403 | [Journalist Name] has not provided NDPR consent for contact | Request consent or remove from list |
| `PR_DISTRIBUTION_LIST_EMPTY` | 422 | Distribution list has no valid recipients | Add journalists with NDPR consent |
| `PR_JOURNALIST_NOT_FOUND` | 404 | Journalist not found | Check journalist ID |
| `PR_DUPLICATE_JOURNALIST` | 409 | A contact with this email already exists | View existing contact; merge if needed |
| `PR_initiative_NOT_FOUND` | 404 | initiative not found | Check initiative ID |
| `PR_DISTRIBUTION_FAILED` | 503 | Distribution failed — [reason] | Retry or contact support |
| `PR_initiative_COST_MISSING` | 422 | ₦ PR cost not configured — ROI cannot be calculated | Configure cost inputs in initiative settings |
| `PR_NOT_APPROVED` | 422 | Press release must be approved before distribution | Submit for approval |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Retry after cooldown |
| `AUTHZ_INSUFFICIENT_PERMISSION` | 403 | You don't have permission for this action | Contact Admin |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target |
|--------|--------|
| Press release distribution | <15 minutes from send to all journalist inboxes |
| Journalist database search | <1 second for 10,000+ contacts |
| Distribution analytics load | <3 seconds |
| Coverage attribution | <15 minutes from article publication to attribution |
| initiative dashboard | <3 seconds load time |
| ₦ ROI calculation | <10 seconds after new coverage added |
| API response time P95 | <500ms |

### 10.2 Reliability

| Metric | Target |
|--------|--------|
| Distribution delivery rate | ≥99% successful delivery |
| Embargo enforcement | 100% — never early |
| Coverage attribution accuracy | ≥90% automatic attribution accuracy |
| NDPR consent check | 100% — never bypass |

### 10.3 Nigerian Market Compliance

| Requirement | Implementation |
|-------------|---------------|
| NDPR compliance | Consent required; right to erasure; 7-year audit log |
| ₦ monetary values | All financial metrics stored as NUMERIC(15,2) NGN |
| WAT timezone | Africa/Lagos default for all scheduling and display |
| Nigerian industry regulations | Pre-loaded CBN, NCC, NAFDAC, SEC compliance rules |

---

## 11. Edge Cases

| ID | Scenario | Behavior |
|----|----------|---------|
| EC-01 | Journalist's NDPR consent withdrawn mid-initiative | Immediately removed from all active distribution lists; in-progress distributions complete but no further sends |
| EC-02 | Press release scheduled exactly at embargo time | Validation requires distribution to be scheduled ≥5 minutes after embargo_at WAT |
| EC-03 | Distribution list is empty after NDPR filter applied | Error: "Distribution list has no journalists with NDPR consent. Add consented journalists." |
| EC-04 | Email provider rate limit hit during large distribution | Queue with throttling; all journalists receive release within 15 minutes; progress shown |
| EC-05 | Journalist moved to new Nigerian outlet since last interaction | "Outlet may be outdated" flag shown; update prompt; old outlet preserved in history |
| EC-06 | Coverage attribution ambiguous (article mentions both our brand and competitor) | Confidence score shown; manual verification option; linked to correct release |
| EC-07 | Press release exceeds 5,000 words | Warning shown; SEO and readability suggestions; no hard block |
| EC-08 | initiative end date passes without manual ₦ cost entry | Auto-reminder sent; report generated without ROI; placeholder shown |
| EC-09 | Nigerian journalist uses multiple email addresses | Duplicate detection flags on import; merge workflow |
| EC-10 | WhatsApp delivery fails (journalist not on WhatsApp) | Fall back to email; log fallback; WhatsApp field flagged for update |
| EC-11 | A/B test has insufficient recipients for statistical significance | Warning shown: "Add ≥30 recipients per variant for reliable results"; test proceeds with caveat |
| EC-12 | Crisis mode activated on press release with active embargo | Override available for Admins with mandatory audit log entry; embargo overridden |

---

## 12. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-PR-01 | Wire service direct integration (PR Newswire Africa, Reuters Connect) | 🔴 High | Phase 5 — Q1 2027 |
| FE-PR-02 | AI-powered journalist recommendation ("Based on this topic, reach out to...") | 🔴 High | Phase 6 — Q2 2027 |
| FE-PR-03 | Press release translation (English ↔ French for West/Central Africa expansion) | 🟡 Medium | Phase 8 — Q4 2027 |
| FE-PR-04 | WhatsApp Business API direct integration for journalist messaging | 🔴 High | Phase 5 — Q1 2027 |
| FE-PR-05 | Press release performance prediction before distribution | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-PR-06 | Competitive PR intelligence (competitor release frequency and outlets) | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-PR-07 | Automated Nigerian media monitoring for journalist movement tracking | 🟡 Medium | Phase 6 — Q2 2027 |
| FE-PR-08 | Journalist briefing room (secure document sharing portal) | 🟢 Low | Phase 9 — Q1 2028 |
| FE-PR-09 | Nigerian PR industry benchmarking (anonymized peer data) | 🟢 Low | Phase 9 — Q1 2028 |
| FE-PR-10 | ₦ budget-to-coverage optimizer ("Allocate ₦2M PR budget for maximum coverage") | 🟡 Medium | Phase 7 — Q3 2027 |

---

## 13. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| Legal & Compliance | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |

---

## 14. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 1: Authentication** | JWT authentication for all PR endpoints |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits; journalist contact quotas |
| **Module 3 & 5: Listening & Monitoring** | Coverage tracking and attribution; crisis signal detection |
| **Module 6: Engagement Hub** | Journalist engagement tracking handoff |
| **Module 7: Analytics & Reporting** | ₦ PR performance in unified dashboards |
| **Architecture** | RLS isolation patterns; service layer |
| **ADRs** | ADR-009 (multi-tenant RLS), ADR-011 (Paystack — for distribution cost billing) |
| **Database Schema** | press_releases, journalists, pr_distributions, pr_interactions, pr_initiatives tables |
| **Security Architecture** | NDPR compliance; PII protection for journalist contacts |
| **Engineering Standards** | ₦ currency conventions; WAT timezone defaults |
| **QA Strategy** | Embargo reliability testing; NDPR consent testing; attribution accuracy testing |
| **API Reference** | Complete PR endpoint documentation |
| **Personas** | Ade (Head of PR), Ngozi (Crisis Manager), Ifeoma (Agency) |
| **User Journeys** | Journey 8 (PR & Media Relations) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified and expanded Media Relations & PR module. Merges and improves both source documents. Adds: Nigerian market calibration throughout (Nigerian journalist database with WhatsApp contact field, Nigerian outlet pre-loading with authority scores, NDPR-specific consent management replacing generic GDPR references, WAT-timezone embargo enforcement, Nigerian regulatory pre-sets for CBN/NCC/NAFDAC/SEC compliance checking, ₦ AVE calculation using Nigerian rate cards, ₦ PR ROI calculation with Nigerian cost inputs, Nigerian crisis template library by sector, WhatsApp Business distribution channel), 6-tier RBAC matrix, complete RLS-protected database schema with NUMERIC(15,2) NGN monetary fields, WAT timezone defaults, coverage attribution with ₦ AVE, message pull-through analysis, and Nigerian journalist relationship scoring algorithm. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to press release workflows, journalist management, Nigerian regulatory compliance rules, or ₦ calculation methodologies must be reflected in this document before implementation begins.*