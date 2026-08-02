# Module 9: Media Monitoring

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

The Media Monitoring module provides comprehensive tracking and analysis of brand mentions across Nigerian and global news outlets, blogs, online publications, broadcast media, and digital channels. It transforms traditional media monitoring into an intelligent, actionable system that identifies press coverage, measures ₦ PR impact, manages media relationships, and quantifies return on investment — all calibrated for the Nigerian media landscape with WAT timezone awareness and NGN (₦) monetary calculations.

This module integrates advanced NLP, source authority scoring, and competitive benchmarking to deliver enterprise-grade media intelligence that enables Nigerian PR and communications teams to detect crises early, track competitive share of voice, and demonstrate clear ₦ business value.

### 1.2 Module Objectives

| Objective | Success Measure | Nigerian Context |
|-----------|-----------------|-----------------|
| **Comprehensive Nigerian coverage** | Track 100+ news sources per organization | Includes Punch, Vanguard, BusinessDay, TechCabal, Channels TV, Premium Times |
| **Real-time detection** | 95%+ of articles appear within 15 minutes of publication | Nigerian publication feeds monitored continuously |
| **Accurate sentiment** | ≥85% accuracy on news content | Tuned for Nigerian English and market context |
| **₦ SOV calculation** | Update within 1 hour of new coverage | Nigerian competitor benchmarking |
| **Crisis detection** | Identify emerging crises 2+ hours early | Critical for Nigerian banking, telecom, FMCG sectors |
| **₦ AVE accuracy** | Within 20% of actual Nigerian advertising rates | Nigerian rate card basis |
| **Contact management** | Maintain 90%+ Nigerian journalist contact accuracy | NDPR-compliant database |

### 1.3 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Ade** (Head of PR, Enterprise Bank) | Admin / Manager | Brand monitoring, crisis detection, competitive intelligence vs. Nigerian banks |
| **Chidi** (Head of Marketing, Fintech) | Manager | Campaign monitoring, competitor tracking, ₦ ROI measurement |
| **Ngozi** (Crisis Manager, Multinational) | Manager | Crisis detection, severity assessment, stakeholder notifications in WAT |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client monitoring, white-label reporting, per-client ₦ metrics |
| **Kemi** (Content Strategist, E-commerce) | Analyst | Trend analysis, topic monitoring, content insights |
| **Tunde** (Digital Analyst, FMCG) | Analyst | Data export, custom analysis, BI tool integration |

### 1.4 Module Scope

**In Scope:**
- Advanced media search configuration with Nigerian market pre-sets
- Intelligent article collection and enrichment (Nigerian + international sources)
- Comprehensive media intelligence dashboard with ₦ metrics
- Nigerian journalist database (CRM) with relationship scoring
- Press release management and distribution (covered in depth in Module 8 — Media Relations & PR)
- Crisis monitoring and management with WAT-timezone severity tracking
- Competitive media intelligence with Nigerian brand benchmarking
- Share of Voice (SOV) with ₦ AVE (Advertising Value Equivalence)
- Alerts with WAT-timezone-aware delivery

**Out of Scope (Future Phases):**

| Feature | Phase | Timeline |
|---------|-------|---------|
| Broadcast TV/radio monitoring (full transcription) | Phase 10 | Year 3 |
| Advanced AI-powered PR prediction | Phase 4 | Q4 2026 |
| Multilingual support beyond English/Pidgin | Phase 8 | Q4 2027 |
| Print media OCR scanning | Phase 12 | Year 3 |
| Podcast monitoring | Phase 10 | Year 3 |

### 1.5 Dependencies

| Module | Relationship |
|--------|-------------|
| **Module 1: Authentication** | JWT authentication for all monitoring endpoints |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits for source count and campaigns |
| **Module 7: Analytics & Reporting** | Media metrics consumed by unified analytics dashboards |
| **Module 8: Media Relations & PR** | Press release distribution; journalist relationship data shared |
| **Module 9: Notifications** | Alert delivery for crisis detection and coverage spikes |
| **Module 6: Engagement Hub** | Coverage context for journalist engagement responses |

---

## 2. User Stories

### 2.1 Media Search & Monitoring

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-MON-01 | Head of PR | Set up media monitoring for my brand with Nigerian source pre-sets | I capture all relevant Nigerian media coverage from day one | P0 |
| US-MON-02 | Head of PR | Monitor competitor media coverage in Nigerian publications | I benchmark First Bank vs. GTBank, Zenith, and Access Bank | P0 |
| US-MON-03 | Head of Marketing | Track industry keywords and Nigerian market trends | I stay ahead of emerging narratives | P0 |
| US-MON-04 | Digital Analyst | Filter by source type (Nigerian newspaper, broadcast, blog) | I focus on the coverage tiers that matter most | P0 |
| US-MON-05 | Head of PR | Filter by geographic region (Lagos, Abuja, national, international) | I understand where my brand story is being told | P0 |
| US-MON-06 | Digital Analyst | Save search queries as reusable templates | I maintain consistent monitoring across campaigns | P0 |
| US-MON-07 | Digital Analyst | Preview estimated coverage volume before activating a search | I know what to expect without wasting quota | P1 |

### 2.2 Article Collection & Analysis

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-MON-10 | Head of PR | See new articles appear in my dashboard in real-time | I don't miss important coverage | P0 |
| US-MON-11 | Head of PR | Articles enriched with ₦ AVE, reach, sentiment, and key quotes | I have complete intelligence without manual research | P0 |
| US-MON-12 | Digital Analyst | See sentiment analysis for each article with confidence scoring | I understand the tone of coverage objectively | P0 |
| US-MON-13 | Head of PR | See ₦ AVE calculated using Nigerian advertising rate cards | I can report accurate business value to the CFO | P0 |
| US-MON-14 | Head of PR | See key quotes extracted from articles | I quickly assess narrative without reading full article | P0 |
| US-MON-15 | Digital Analyst | See named entities (people, organizations, locations) detected | I understand the context of coverage | P0 |
| US-MON-16 | Digital Analyst | Archive and export articles in multiple formats | I maintain records and use data in other tools | P0 |

### 2.3 Competitive Intelligence

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-MON-30 | Head of PR | Track SOV vs. named Nigerian competitors | I know exactly where we stand in the Nigerian media landscape | P0 |
| US-MON-31 | Head of Marketing | Identify competitor campaign launches in Nigerian media | I can respond strategically | P1 |
| US-MON-32 | Head of PR | Benchmark sentiment vs. Nigerian competitors | I understand how Nigerian media perceives us vs. peers | P0 |
| US-MON-33 | Head of PR | Receive alerts when competitors make significant movements | I'm never caught off guard | P0 |
| US-MON-34 | Head of PR | See ₦ AVE SOV vs. competitors | I can compare earned media value in Naira | P1 |

### 2.4 Crisis Detection & Alerts

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-MON-40 | Crisis Manager | Be alerted to negative coverage spikes with WAT timestamps | I can respond within the same Nigerian business day | P0 |
| US-MON-41 | Crisis Manager | See crisis severity scoring (1–5) with context | I know immediately how serious the situation is | P0 |
| US-MON-42 | Crisis Manager | Trigger stakeholder notification workflows from the crisis dashboard | I don't waste time on manual notifications during a crisis | P0 |
| US-MON-43 | Crisis Manager | Access pre-approved Nigerian market response templates | I respond professionally within minutes | P0 |
| US-MON-44 | Crisis Manager | Generate post-crisis analysis reports with ₦ impact estimates | I learn and improve for next time | P0 |

### 2.5 Analytics & Reporting

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-MON-50 | Head of PR | Export monitoring data to CSV with ₦ AVE columns | I can build presentations and reports | P0 |
| US-MON-51 | Digital Analyst | Generate monitoring reports with ₦ metrics | I can demonstrate PR value to stakeholders | P0 |
| US-MON-52 | Head of PR | Track key metrics over time with WAT-timezone dates | I understand trends in the Nigerian media cycle | P0 |
| US-MON-53 | Agency Owner | Generate white-label monitoring reports with per-client ₦ ROI | I present professional reports to Nigerian brand clients | P1 |

---

## 3. Functional Requirements

### 3.1 FR-MON-001: Advanced Media Search Configuration

**Description:** Configure sophisticated media monitoring queries with Nigerian source intelligence, boolean logic, and content filtering.

**Boolean Query Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `AND` | Both terms required | `"First Bank" AND "mobile banking"` |
| `OR` | Either term | `"First Bank" OR "FBN"` |
| `NOT` | Exclude terms | `"First Bank" NOT "First National Bank"` |
| `NEAR/N` | Terms within N words | `CEO NEAR/3 resignation` |
| `" "` | Exact phrase match | `"quarterly earnings"` |
| `( )` | Grouping | `("First Bank" OR "FBN") AND (launch OR release)` |

**Nigerian Market Pre-Sets:**

| Pre-Set Category | Pre-loaded Keywords |
|-----------------|---------------------|
| Nigerian Banking | CBN, NDIC, microfinance, BVN, NIN, digital banking, mobile banking, interbank |
| Nigerian Fintech | Paystack, Flutterwave, NIBSS, mobile money, fintech regulation |
| Nigerian Telecom | MTN, Airtel, Glo, 9mobile, NCC, 5G, data plans, USSD |
| Nigerian FMCG | NAFDAC, consumer goods, distribution, market share |
| Nigerian Regulatory | SEC, CAC, PENCOM, NAICOM, FIRS, CBN policy |

**Source Management — Nigerian Media Sources:**

| Source Type | Nigerian Examples | Authority Score Range |
|-------------|------------------|----------------------|
| **Premium National News** | Punch, Vanguard, The Guardian, The Nation | 75–90 |
| **Business Publications** | BusinessDay, Nairametrics, Financial Nigeria | 78–92 |
| **Technology Media** | TechCabal, Techpoint Africa, IT Edge News | 72–87 |
| **Broadcast (Online)** | Channels TV, NTA, Arise News, TVC | 80–92 |
| **News Aggregators** | Premium Times, Daily Post, Sahara Reporters | 65–80 |
| **International (Africa)** | Reuters Africa, BBC Africa, CNN Africa, Bloomberg Africa | 88–98 |
| **Regional/Local** | State newspapers, community news | 30–55 |
| **Blogs/Opinion** | Nigerian political blogs, tech blogs | 20–45 |

**Source Authority Scoring (Nigerian Market):**

Authority scores for Nigerian sources updated weekly using:
- Domain authority (Nigerian Alexa equivalent)
- Social following of publication's accounts
- Editorial standards and journalistic credibility
- Circulation figures (verified where available)
- Historical accuracy and fact-checking record
- Frequency of update and content freshness

**Geographic Targeting:**

| Level | Nigerian Examples |
|-------|-----------------|
| National | All of Nigeria |
| Geopolitical Zone | South West, North Central, South East, etc. |
| State | Lagos, Abuja (FCT), Rivers, Kano, Ogun |
| City | Lagos Island, Ikeja, Victoria Island, Abuja Central |
| International | West Africa, Sub-Saharan Africa, Global |

**Content Filtering:**

| Filter | Options |
|--------|---------|
| Article type | News, opinion, press release, sponsored content, review |
| Content quality | Word count ≥ threshold, source authority ≥ threshold |
| Language | English, Nigerian Pidgin English (detection-based) |
| Publication date | Custom date ranges; historical backfill up to plan limit |
| Minimum social shares | Twitter/X shares, Facebook shares, WhatsApp forwards (where detectable) |
| Exclusions | Obituaries, classifieds, sports scores, auto-generated content |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Complex boolean queries execute with ≥95% precision/recall |
| AC2 | Nigerian source authority scoring updates weekly |
| AC3 | Nigerian market pre-sets load correctly and return relevant Nigerian coverage |
| AC4 | Entity recognition achieves ≥90% accuracy for Nigerian names, organizations, locations |
| AC5 | Duplicate detection eliminates ≥99% of syndicated content |
| AC6 | Search limits enforced per plan with upgrade prompts |
| AC7 | Estimated result volume shown before activating query |

---

### 3.2 FR-MON-002: Intelligent Article Collection & Enrichment

**Description:** Collect, deduplicate, and enrich media articles with automated sentiment, impact, and ₦ value analysis.

**Content Extraction:**

| Feature | Description | Nigerian Context |
|---------|-------------|-----------------|
| Full-text extraction | Complete article content using readability algorithms | Works with Nigerian newspaper site structures |
| Key quote identification | Most important quotes highlighted | Identifies Nigerian executive quotes, regulatory comments |
| Image extraction | All article images | Photo evidence for visual coverage |
| Link analysis | Source credibility and context assessment | Nigerian hyperlink graph |
| Author identification | Byline extraction for journalist CRM | Links to journalist profile |

**Automated Analysis Pipeline:**

| Stage | Description | Latency |
|-------|-------------|---------|
| Content extraction | Pull full text from source | On ingestion |
| Deduplication | Hash-based and NLP similarity check | On ingestion |
| Sentiment analysis | Headline + body, separate scores | <2 seconds per article |
| Entity recognition | People, organizations, locations, products | On ingestion |
| Topic categorization | Custom taxonomy classification | On ingestion |
| Brand mention context | Primary vs. passing vs. competitive | On ingestion |
| Source authority lookup | From cached authority scores | On ingestion |
| ₦ AVE calculation | Using Nigerian rate cards | On ingestion |
| Impact score calculation | Authority × sentiment × prominence | On ingestion |
| Social share tracking | Platform API lookup | Within 30 minutes |

**Sentiment Analysis (Nigerian Context):**

| Sentiment Dimension | Description |
|---------------------|-------------|
| Headline sentiment | Often more sensational in Nigerian tabloid press |
| Body sentiment | More accurate representation; normalized |
| Overall sentiment | Weighted combination (headline 30%, body 70%) |
| Nigerian English tuning | Accepts Nigerian English phrases without misclassifying |
| Tone detection | Objective, opinionated, promotional, critical, satirical |

**₦ AVE Calculation (Nigerian Rate Cards):**

```
₦ AVE = Publication Circulation 
        × (Nigerian Full-Page Rate in ₦ / 1,000) 
        × Space Occupied Factor 
        × Quality Multiplier 
        × Sentiment Multiplier

Where:
  Space Occupied Factor:
    Full page = 1.0 | Half page = 0.5 | Quarter = 0.25 | Passing mention = 0.1
  
  Quality Multiplier (editorial quality + placement prominence):
    Front page / headline = 2.0 | Standard inside = 1.0 | Brief mention = 0.5
  
  Sentiment Multiplier:
    Positive = 1.5 | Neutral = 1.0 | Negative = 0.3

Sample Nigerian Rate Cards (updated quarterly):
  BusinessDay full page:      ₦2,500,000
  Punch full page:            ₦2,200,000
  Vanguard full page:         ₦1,800,000
  TechCabal full page:        ₦1,500,000
  Channels TV (online):       ₦3,000,000
  Premium Times full page:    ₦1,200,000
  The Guardian Nigeria:       ₦1,600,000
```

**Impact Score Calculation:**

```
Impact Score (0–1,000) = 
  (Source Authority Score / 100) × 1,000
  × (Sentiment Quality Factor: 0.3–1.5)
  × (Prominence Factor: 0.1–1.0)
  × (Reach Multiplier: 0.5–3.0)

Where Reach Multiplier is based on estimated Nigerian readership:
  >1M readers = 3.0 | 100K–1M = 2.0 | 10K–100K = 1.0 | <10K = 0.5
```

**Topic Categorization (Nigerian Context):**

| Category | Examples |
|----------|----------|
| Product / Service | App launches, product reviews, service changes |
| Corporate | Earnings, leadership changes, strategy |
| Regulatory | CBN, NCC, NAFDAC, SEC actions or statements |
| Crisis | Negative events, customer complaints, safety issues |
| Partnership | Deals, mergers, collaborations |
| Industry Trend | Nigerian market trends, fintech growth |
| Executive | CEO/MD interviews, thought leadership pieces |
| CSR / Community | Corporate social responsibility in Nigerian communities |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | New articles appear within 15 minutes of publication for major Nigerian outlets |
| AC2 | Full-text extraction achieves ≥98% success for accessible Nigerian publication content |
| AC3 | Sentiment accuracy ≥85% on Nigerian media content |
| AC4 | ₦ AVE calculated using current Nigerian advertising rate cards |
| AC5 | Impact score correlates with actual PR outcomes |
| AC6 | Competitive mentions auto-categorized with ≥90% accuracy |

---

### 3.3 FR-MON-003: Media Intelligence Dashboard

**Description:** Real-time dashboard with Nigerian-market-calibrated metrics, automated insights, and actionable intelligence.

**Core KPI Tiles:**

| Metric | Description | Nigerian Context |
|--------|-------------|-----------------|
| Total Mentions | Count across all monitored sources | Nigerian + international breakdown |
| ₦ AVE Generated | Total advertising value equivalence | NGN (₦) using Nigerian rate cards |
| Share of Voice | % of category mentions vs. competitors | Nigerian competitor benchmarking |
| Net Sentiment Score | (Positive − Negative) / Total × 100 | Nigerian English calibrated |
| Media Impressions | Estimated total readership/viewership | Nigerian circulation figures |
| Tier 1 Coverage | Premium Nigerian publication mentions | BusinessDay, Punch, TechCabal, Channels TV |
| Crisis Risk Score | Composite crisis signal indicator (1–5) | Nigerian crisis keyword calibration |
| Geographic Reach | Coverage distribution by Nigerian state | State-level Nigeria drill-down |

**Dashboard Visualizations:**

| Visualization | Description | Nigerian Feature |
|--------------|-------------|-----------------|
| Mention volume timeline | Coverage velocity over time | WAT timezone x-axis |
| Sentiment trend chart | Net sentiment with statistical bounds | Nigerian publication tier breakdown |
| ₦ AVE timeline | Cumulative advertising value in NGN | Monthly ₦ totals |
| SOV donut chart | Share of voice vs. Nigerian competitors | Configurable competitor set |
| Topic cloud | Word cloud with sentiment coloring | Nigerian market topics highlighted |
| Geographic heat map | Coverage by Nigerian state + global | State-level drill-down |
| Media type distribution | Online, broadcast, blog breakdown | Nigerian source tier classification |
| Source authority matrix | Coverage quality by publication tier | Nigerian tier 1/2/3 classification |
| Influential author map | Network of top Nigerian journalists | Relationship to journalist CRM |
| Crisis severity timeline | Historical severity scores over time | WAT timestamps |

**Automated Insights Engine:**

The dashboard automatically flags:
- Significant coverage spikes (z-score > 2.0 from baseline)
- Sentiment shifts (>15% change over 24 hours)
- Competitive SOV movements (>5 percentage points)
- Emerging Nigerian market topics (velocity-based detection)
- ₦ AVE milestones (configurable ₦ targets)
- Crisis signal accumulation (multi-signal composite)

Each insight includes: what happened, why it matters, and recommended action.

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Dashboard loads comprehensive metrics in <3 seconds |
| AC2 | All monetary values displayed in ₦ (NGN) |
| AC3 | All timestamps shown in WAT (Africa/Lagos) |
| AC4 | Real-time updates within 5-minute intervals |
| AC5 | Automated insights achieve ≥90% relevance rating |
| AC6 | Role-based views enforce data access permissions |
| AC7 | Geographic drill-down shows Nigerian state-level coverage |

---

### 3.4 FR-MON-004: Crisis Detection & Management

**Description:** Real-time crisis detection calibrated for Nigerian media dynamics with WAT-timezone severity tracking and response workflows.

**Crisis Detection Algorithm:**

| Signal | Weight | Detection Threshold |
|--------|--------|---------------------|
| Negative coverage spike | 30% | 5× normal hourly volume |
| Tier-1 Nigerian outlet coverage | 25% | ≥3 Tier-1 outlets in 2 hours |
| High-influence author sharing | 20% | Author influence score ≥75 |
| Cross-platform spread | 15% | Coverage on ≥3 different platforms |
| Nigerian crisis keywords | 10% | Pre-configured keyword set triggered |

**Crisis Severity Framework (1–5 Scale):**

| Level | Description | Nigerian Example | Response Time |
|-------|-------------|-----------------|---------------|
| **S1 — Minor** | Isolated negative mention; no spread | Single blog post complaint | <4 hours |
| **S2 — Moderate** | Multiple negative articles; limited tier | 3–5 regional outlet mentions | <2 hours |
| **S3 — Significant** | Tier-1 outlet coverage; notable reach | BusinessDay or Punch coverage | <1 hour |
| **S4 — Severe** | Multiple tier-1 outlets; spreading fast | BusinessDay + Channels TV + Nigerian Twitter | <30 minutes |
| **S5 — Critical** | National media saturation; viral spread | Front pages + CBN/regulatory inquiry + viral WhatsApp | Immediate |

**Nigerian Crisis Keyword Pre-Sets:**

| Industry | Pre-Loaded Crisis Keywords |
|----------|---------------------------|
| Banking | "CBN revoked", "bank collapse", "account blocked", "funds missing", "EFCC investigation", "NDIC" |
| Fintech | "app down", "money missing", "hack", "data breach", "fraud", "EFCC" |
| Telecom | "NCC penalty", "network outage", "overcharging", "subscription fraud" |
| Healthcare | "NAFDAC recall", "fake drugs", "medical negligence", "patients death" |
| FMCG | "product contamination", "NAFDAC ban", "recall", "food poisoning" |

**Crisis Response Workflow:**

```
Crisis Detected (S2+)
    │
    ▼
Severity calculated (S1–S5)
    │
    ▼
Stakeholder notifications (per severity, within 5 min WAT)
    │
    ├── S2: PR Manager
    ├── S3: PR Manager + VP Communications
    ├── S4: Above + CEO/MD
    └── S5: Above + Legal + Board (if public company)
    │
    ▼
Crisis dashboard activated (real-time monitoring)
    │
    ▼
Response template library surfaced (Nigerian industry-specific)
    │
    ▼
Distribution to media contacts via Module 8
    │
    ▼
Real-time sentiment recovery tracking
    │
    ▼
Crisis resolved → Post-crisis analysis report (₦ impact estimated)
```

**Post-Crisis Analysis Report:**

- Timeline reconstruction with WAT timestamps
- Coverage volume and sentiment evolution charts
- ₦ estimated brand impact (AVE-based)
- Response effectiveness analysis (sentiment recovery rate)
- Nigerian media response distribution (by outlet tier)
- Lessons learned documentation
- Process improvement recommendations

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Crisis detection provides ≥2 hour lead time in 80%+ of cases |
| AC2 | Severity classification matches human assessment in ≥90% of cases |
| AC3 | Stakeholder notifications delivered within 5 minutes of detection |
| AC4 | Nigerian industry-specific crisis templates pre-loaded |
| AC5 | Post-crisis analysis report auto-generated within 1 hour of resolution |
| AC6 | Crisis workflows maintain audit trails for Nigerian regulatory compliance |
| AC7 | S4/S5 alerts bypass WAT quiet hours; delivered immediately |

---

### 3.5 FR-MON-005: Competitive Media Intelligence

**Description:** Comprehensive competitive benchmarking against Nigerian competitors with SOV, sentiment comparison, and strategic gap analysis.

**Share of Voice Calculation:**

```
SOV (%) = (Brand Mentions / Total Category Mentions) × 100

Where Total Category Mentions = Brand + All Configured Competitor Mentions

SOV Variants:
  Volume SOV: raw mention count share
  Reach SOV: total readership share
  ₦ AVE SOV: total advertising value equivalent share
  Sentiment-Weighted SOV: volume × avg sentiment factor
```

**Competitive Benchmarking Metrics:**

| Metric | Description | Nigerian Context |
|--------|-------------|-----------------|
| Share of Voice | Mention volume share | Nigerian media category benchmarking |
| ₦ AVE SOV | Advertising value share | NGN-denominated comparison |
| Sentiment comparison | Average sentiment vs. competitors | With statistical significance test |
| Message penetration | Key message in coverage | What narrative each brand "owns" |
| Journalist overlap | Shared media relationships | Which journalists cover multiple brands |
| Geographic SOV | Coverage by Nigerian state | Regional media dominance |
| Topic ownership | Who "owns" which topics | Fintech, digital banking, sustainability |
| Crisis response | How competitors handle negative coverage | Lessons from competitor PR |

**Competitive Intelligence Gathering:**

| Area | Description |
|------|-------------|
| Competitor press release analysis | Timing, messaging, and outcomes |
| Media strategy patterns | Reverse engineer coverage patterns |
| Spokesperson effectiveness | Executive thought leadership comparison |
| Campaign detection | Identify major competitor PR campaigns |
| Nigerian market positioning | How competitors position vs. each other |

**Competitive Alerting:**

| Alert Type | Trigger | Nigerian Context |
|-----------|---------|-----------------|
| Significant SOV movement | Competitor SOV changes >5pp | "GTBank SOV up 4pp this week" |
| Campaign launch detection | Unusual volume spike | "Airtel launched new campaign" |
| Sentiment crossover | Competitor sentiment exceeds own brand | Risk warning with context |
| Tier-1 coverage spike | Competitor gains ≥3 Tier-1 mentions/day | "MTN in BusinessDay 3x this week" |
| Crisis opportunity | Competitor in crisis; potential positioning gap | Strategic intelligence |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Competitive SOV updates within 1 hour of new coverage |
| AC2 | All SOV variants (volume, reach, ₦ AVE, sentiment-weighted) calculated |
| AC3 | Statistical significance testing applied to comparative claims |
| AC4 | Competitive movement alerts trigger within 2 hours of significant change |
| AC5 | ₦ AVE SOV uses Nigerian advertising rate cards |
| AC6 | Competitive data clearly labeled as estimates |

---

### 3.6 FR-MON-006: Search & Discovery

**Description:** Powerful search interface supporting complex boolean queries, saved searches, and historical analysis.

**Search Capabilities:**

| Capability | Description |
|-----------|-------------|
| Boolean queries | Full AND/OR/NOT/NEAR support |
| Semantic expansion | Nigerian synonym recognition |
| Entity search | Search by Nigerian person, organization, location |
| Historical search | Up to plan retention limit |
| Saved searches | Save and schedule with alerting |
| Result preview | Estimated volume before activation |

**Advanced Filters:**

| Filter | Options |
|--------|---------|
| Date range | Custom (up to plan retention limit) |
| Platform / source type | Nigerian newspaper, broadcast, blog, newswire |
| Source tier | Tier 1, Tier 2, Tier 3 |
| Sentiment | Positive, neutral, negative |
| Impact score | Minimum threshold |
| Authority score | Minimum threshold |
| Geographic | Nigerian state, region, international |
| Brand context | Primary mention, passing reference |
| Competitive flag | Own brand vs. competitor |
| Topic category | Product, corporate, regulatory, crisis, etc. |

**Plan Limits:**

| Plan | Active Campaigns | Historical Search | Sources |
|------|-----------------|------------------|---------|
| Starter | 3 | 7 days | 20 |
| Growth | 10 | 90 days | 100 |
| Professional | 50 | 1 year | 300 |
| Enterprise | Unlimited | 3 years | 500+ |
| Agency | 100 per client | 1 year | 300 per client |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Boolean queries execute within 30 seconds for complex queries |
| AC2 | 95%+ precision/recall on complex boolean queries |
| AC3 | Plan limits enforced with upgrade prompts |
| AC4 | Saved searches run automatically and trigger alerts |
| AC5 | Historical search accessible up to plan retention limit |
| AC6 | Estimated result volume shown accurately before activation |

---

## 4. Business Rules

### 4.1 Monitoring Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-MON-001 | Minimum 1 monitoring campaign per organization | Logical requirement |
| BR-MON-002 | Source limits enforced per plan (20/100/300/500+) | Plan-based billing |
| BR-MON-003 | Historical data retention: 7/90/365/1095 days by plan | Storage cost management |
| BR-MON-004 | Duplicate articles deduplicated; shown as single entry with source list | Data quality |
| BR-MON-005 | Deleted articles preserved with `[Deleted]` marker | Audit trail |
| BR-MON-006 | Paywalled articles: extract available content; mark as paywalled | Coverage completeness |
| BR-MON-007 | Nigerian rate cards updated quarterly for ₦ AVE accuracy | Monetary accuracy |
| BR-MON-008 | All ₦ monetary values stored as NUMERIC(15,2) NGN | Currency consistency |
| BR-MON-009 | All timestamps stored UTC; displayed in WAT for Nigerian organizations | Timezone consistency |

### 4.2 Alert Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-MON-010 | Crisis detection requires ≥2 signals for S2+ classification | Reduces false positives |
| BR-MON-011 | S4/S5 alerts bypass WAT quiet hours; delivered immediately | Urgency |
| BR-MON-012 | Alert deduplication: same event not alerted twice within 1 hour | Prevent alert fatigue |
| BR-MON-013 | Crisis acknowledgment required; unacknowledged alerts auto-escalate after 15 min | SLA enforcement |

### 4.3 Competitive Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-MON-014 | SOV calculations require ≥30 days of baseline data | Statistical validity |
| BR-MON-015 | Competitive comparisons labeled as "estimates" | Honesty in intelligence |
| BR-MON-016 | Statistical significance required for all "significant" claims | Avoid misleading insights |
| BR-MON-017 | Competitive data strictly isolated per organization (RLS enforced) | Multi-tenant security |

---

## 5. Permissions

### 5.1 RBAC Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Monitoring** |
| View coverage feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View ₦ AVE and metrics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create monitoring campaigns | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit monitoring campaigns | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| Delete monitoring campaigns | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| View SOV reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export coverage data (CSV with ₦) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Search** |
| Basic search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Complex boolean search | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Save searches | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Alerts** |
| View alerts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acknowledge alerts | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create alert rules | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Configure crisis alerts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Competitive** |
| View competitive intelligence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/manage competitors | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete competitors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 6. API Reference

### 6.1 Media Monitoring Endpoints

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| `GET` | `/api/v1/monitoring/campaigns` | ✅ | Analyst+ | List monitoring campaigns |
| `POST` | `/api/v1/monitoring/campaigns` | ✅ | Analyst+ | Create monitoring campaign |
| `GET` | `/api/v1/monitoring/campaigns/:id` | ✅ | Analyst+ | Get campaign details |
| `PATCH` | `/api/v1/monitoring/campaigns/:id` | ✅ | Analyst+ | Update campaign |
| `DELETE` | `/api/v1/monitoring/campaigns/:id` | ✅ | Manager+ | Delete campaign |
| `GET` | `/api/v1/monitoring/articles` | ✅ | Analyst+ | List articles with filters |
| `GET` | `/api/v1/monitoring/articles/:id` | ✅ | Analyst+ | Get article detail |
| `POST` | `/api/v1/monitoring/search` | ✅ | Analyst+ | Execute search query |
| `GET` | `/api/v1/monitoring/sov` | ✅ | Analyst+ | Get SOV report |
| `GET` | `/api/v1/monitoring/competitors` | ✅ | Analyst+ | List competitors |
| `POST` | `/api/v1/monitoring/competitors` | ✅ | Analyst+ | Add competitor |
| `PATCH` | `/api/v1/monitoring/competitors/:id` | ✅ | Manager+ | Update competitor |
| `DELETE` | `/api/v1/monitoring/competitors/:id` | ✅ | Manager+ | Delete competitor |
| `GET` | `/api/v1/monitoring/alerts` | ✅ | Analyst+ | List alerts |
| `POST` | `/api/v1/monitoring/alerts` | ✅ | Analyst+ | Create alert rule |
| `POST` | `/api/v1/monitoring/alerts/:id/acknowledge` | ✅ | Analyst+ | Acknowledge alert |
| `GET` | `/api/v1/monitoring/saved-searches` | ✅ | Analyst+ | List saved searches |
| `POST` | `/api/v1/monitoring/saved-searches` | ✅ | Analyst+ | Save search |
| `POST` | `/api/v1/monitoring/export` | ✅ | Analyst+ | Export data (with ₦ columns) |

### 6.2 Request/Response Examples

**List Articles:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": [
    {
      "id": "art_9f2a4b6c8d1e3f5g",
      "title": "First Bank of Nigeria Launches AI-Powered Digital Banking Platform",
      "url": "https://techcabal.com/2026/07/21/first-bank-digital-platform/",
      "source": {
        "name": "TechCabal",
        "type": "online",
        "authorityScore": 84,
        "tier": 1
      },
      "author": "Adekunle Adeyemi",
      "publishedAt": "2026-07-21T10:00:00+01:00",
      "sentiment": {
        "headlineScore": 0.82,
        "bodyScore": 0.71,
        "overallScore": 0.74,
        "label": "positive",
        "confidence": 0.91
      },
      "impactScore": 476,
      "reachEstimate": 850000,
      "aveNaira": 425000.00,
      "currency": "NGN",
      "keyQuotes": [
        "First Bank's new platform is a significant leap forward in Nigerian digital banking",
        "The AI-powered fraud detection is unprecedented in Nigerian retail banking"
      ],
      "entityMentions": {
        "organizations": ["First Bank of Nigeria", "Central Bank of Nigeria"],
        "people": ["Dr. Adesola Adeduntan"],
        "locations": ["Lagos", "Nigeria"],
        "products": ["FirstBank Mobile App"]
      },
      "brandMentionContext": "primary",
      "topics": ["digital_banking", "product_launch", "fintech", "ai"],
      "isCompetitive": false,
      "socialShares": {
        "twitter": 245,
        "linkedin": 89,
        "facebook": 134
      }
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6ImFydF8xMjMifQ==",
    "hasMore": true,
    "totalCount": 247
  },
  "summary": {
    "totalArticles": 247,
    "positive": 158,
    "neutral": 67,
    "negative": 22,
    "avgSentiment": 0.52,
    "totalAveNaira": 42000000.00,
    "currency": "NGN",
    "avgImpactScore": 385
  }
}
```

**Get SOV Report:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "period": {
      "start": "2026-07-01T00:00:00+01:00",
      "end": "2026-07-21T23:59:59+01:00",
      "timezone": "Africa/Lagos"
    },
    "shareOfVoice": [
      {
        "brand": "First Bank of Nigeria",
        "mentions": 247,
        "volumeSovPercent": 34.2,
        "reachSovPercent": 31.8,
        "aveSovPercent": 35.1,
        "sentimentWeightedSovPercent": 38.5,
        "totalAveNaira": 42000000.00,
        "avgSentiment": 0.64,
        "sovChange": 5.2,
        "currency": "NGN",
        "isOwnBrand": true
      },
      {
        "brand": "GTBank",
        "mentions": 198,
        "volumeSovPercent": 27.4,
        "reachSovPercent": 29.1,
        "aveSovPercent": 28.3,
        "sentimentWeightedSovPercent": 24.8,
        "totalAveNaira": 33800000.00,
        "avgSentiment": 0.48,
        "sovChange": -2.1,
        "currency": "NGN",
        "isOwnBrand": false
      }
    ],
    "byTier": {
      "tier1": { "firstBank": 45, "gtbank": 38 },
      "tier2": { "firstBank": 120, "gtbank": 95 },
      "tier3": { "firstBank": 82, "gtbank": 65 }
    },
    "statisticalSignificance": {
      "firstBankVsGTBank": { "pValue": 0.032, "significant": true }
    }
  }
}
```

**Execute Search:**

```http
POST /api/v1/monitoring/search
Content-Type: application/json

{
  "query": "(\"First Bank\" OR \"FBN\") AND (\"mobile banking\" OR \"digital banking\") AND NOT competitor",
  "filters": {
    "startDate": "2026-07-01",
    "endDate": "2026-07-21",
    "sourceTypes": ["online", "broadcast"],
    "sentimentLabels": ["positive", "neutral"],
    "minAuthorityScore": 50,
    "geographicFilter": ["NG"],
    "minImpactScore": 200
  },
  "sortBy": "impactScore",
  "sortOrder": "desc",
  "limit": 20,
  "cursor": null
}
```

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "estimatedResults": 89,
    "results": [/* article objects as above */],
    "pagination": {
      "cursor": "eyJpZCI6ImFydF8xMjMifQ==",
      "hasMore": true,
      "totalCount": 89
    },
    "aggregations": {
      "bySentiment": { "positive": 56, "neutral": 33, "negative": 0 },
      "bySourceTier": { "tier1": 18, "tier2": 42, "tier3": 29 },
      "totalAveNaira": 15200000.00,
      "currency": "NGN"
    }
  }
}
```

**Acknowledge Alert:**

```http
POST /api/v1/monitoring/alerts/alt_6d3a2b1c/acknowledge
Content-Type: application/json

{
  "acknowledgedBy": "usr_9f2a4b6c",
  "notes": "Escalated to Ngozi (Crisis Manager). Investigating root cause."
}
```

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "id": "alt_6d3a2b1c",
    "isAcknowledged": true,
    "acknowledgedBy": "usr_9f2a4b6c",
    "acknowledgedAt": "2026-07-21T11:35:00+01:00",
    "notes": "Escalated to Ngozi (Crisis Manager). Investigating root cause."
  }
}
```

---

## 7. Database Schema

### 7.1 Core Tables

```sql
-- Monitoring campaigns
CREATE TABLE monitoring_campaigns (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                      VARCHAR(100) NOT NULL,
  description               TEXT,
  keywords                  TEXT[] NOT NULL,
  boolean_expression        TEXT,                   -- Full boolean expression
  source_types              TEXT[] NOT NULL,
  languages                 TEXT[],
  countries                 TEXT[],
  min_authority_score       INTEGER DEFAULT 0,
  exclude_obituaries        BOOLEAN DEFAULT TRUE,
  exclude_classifieds       BOOLEAN DEFAULT TRUE,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'archived')),
  estimated_monthly_articles INTEGER,
  actual_monthly_articles   INTEGER,
  created_by_id             VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monitoring_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY mc_isolation ON monitoring_campaigns
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_mc_org ON monitoring_campaigns(organization_id);
CREATE INDEX idx_mc_status ON monitoring_campaigns(organization_id, status);

-- Media articles (all monetary values in NGN)
CREATE TABLE media_articles (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monitoring_campaign_id    VARCHAR(32) REFERENCES monitoring_campaigns(id),
  title                     TEXT NOT NULL,
  url                       TEXT UNIQUE NOT NULL,
  source_name               VARCHAR(255) NOT NULL,
  source_type               VARCHAR(50)
                            CHECK (source_type IN ('newspaper', 'blog', 'broadcast', 'wire', 'magazine', 'online')),
  source_tier               INTEGER CHECK (source_tier IN (1, 2, 3)),
  source_authority_score    INTEGER DEFAULT 0,
  author                    VARCHAR(255),
  excerpt                   TEXT,
  content                   TEXT,
  published_at              TIMESTAMPTZ NOT NULL,
  ingested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language                  VARCHAR(5),
  country                   VARCHAR(2),
  -- Sentiment (Nigerian English calibrated)
  headline_sentiment        DECIMAL(3,2),           -- -1.0 to +1.0
  body_sentiment            DECIMAL(3,2),           -- -1.0 to +1.0
  overall_sentiment         DECIMAL(3,2),           -- -1.0 to +1.0
  sentiment_label           VARCHAR(20)
                            CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_confidence      DECIMAL(3,2),           -- 0.0 to 1.0
  -- ₦ Impact metrics (all NGN)
  impact_score              INTEGER DEFAULT 0,       -- 0–1,000
  reach_estimate            BIGINT DEFAULT 0,        -- Nigerian readership estimate
  ave_naira                 NUMERIC(15,2) DEFAULT 0, -- ₦ Advertising Value Equivalence
  currency                  VARCHAR(3) DEFAULT 'NGN',
  -- Content analysis
  key_quotes                TEXT[],
  topic_category            TEXT,
  entity_mentions           JSONB,                  -- {people, organizations, locations, products}
  brand_mention_context     VARCHAR(20)
                            CHECK (brand_mention_context IN ('primary', 'passing', 'none')),
  -- Classification
  is_competitive            BOOLEAN DEFAULT FALSE,
  competitor_id             VARCHAR(32),
  is_duplicate              BOOLEAN DEFAULT FALSE,
  original_article_id       VARCHAR(32) REFERENCES media_articles(id),
  is_archived               BOOLEAN DEFAULT FALSE,
  content_hash              VARCHAR(64) UNIQUE,
  -- Social amplification
  social_shares             JSONB,                  -- {twitter: N, linkedin: N, facebook: N}
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_articles FORCE ROW LEVEL SECURITY;
CREATE POLICY ma_isolation ON media_articles
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ma_org ON media_articles(organization_id, published_at DESC);
CREATE INDEX idx_ma_sentiment ON media_articles(organization_id, sentiment_label, published_at DESC);
CREATE INDEX idx_ma_campaign ON media_articles(monitoring_campaign_id, published_at DESC);
CREATE INDEX idx_ma_competitive ON media_articles(organization_id, is_competitive, published_at DESC);
CREATE INDEX idx_ma_impact ON media_articles(organization_id, impact_score DESC);
-- Full-text search
CREATE INDEX idx_ma_fts ON media_articles
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')));
CREATE INDEX idx_ma_hash ON media_articles(content_hash);

-- Competitors
CREATE TABLE monitoring_competitors (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  keywords        TEXT[] NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  logo_url        TEXT,
  website         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monitoring_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_competitors FORCE ROW LEVEL SECURITY;
CREATE POLICY comp_isolation ON monitoring_competitors
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_comp_org ON monitoring_competitors(organization_id, is_active);

-- Saved searches
CREATE TABLE saved_searches (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           VARCHAR(32) NOT NULL REFERENCES users(id),
  name              VARCHAR(100) NOT NULL,
  query             TEXT NOT NULL,
  filters           JSONB,
  alert_enabled     BOOLEAN DEFAULT FALSE,
  alert_frequency   VARCHAR(20) DEFAULT 'daily'
                    CHECK (alert_frequency IN ('realtime', 'hourly', 'daily', 'weekly')),
  last_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches FORCE ROW LEVEL SECURITY;
CREATE POLICY ss_isolation ON saved_searches
  USING (organization_id = current_setting('app.current_org_id', true));

-- Monitoring alerts (all ₦ values in NGN)
CREATE TABLE monitoring_alerts (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  article_id            VARCHAR(32) REFERENCES media_articles(id),
  alert_type            VARCHAR(30) NOT NULL
                        CHECK (alert_type IN ('crisis', 'coverage_spike', 'sentiment_drop', 'competitive_movement', 'keyword_match', 'tier1_coverage')),
  severity              INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  context               JSONB,
  -- ₦ estimated impact
  estimated_naira_impact NUMERIC(15,2),
  currency              VARCHAR(3) DEFAULT 'NGN',
  is_read               BOOLEAN DEFAULT FALSE,
  is_acknowledged       BOOLEAN DEFAULT FALSE,
  acknowledged_by_id    VARCHAR(32) REFERENCES users(id),
  acknowledged_at       TIMESTAMPTZ,
  acknowledgment_notes  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable — append-only audit
);

ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY alert_isolation ON monitoring_alerts
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_alert_org ON monitoring_alerts(organization_id, created_at DESC);
CREATE INDEX idx_alert_unread ON monitoring_alerts(organization_id, is_read, created_at DESC)
  WHERE is_read = FALSE;
CREATE INDEX idx_alert_crisis ON monitoring_alerts(organization_id, severity DESC, created_at DESC)
  WHERE alert_type = 'crisis';
```

---

## 8. Email Notifications

### 8.1 Alert Notification Templates

| Event | Recipient | Subject | SLA | Nigerian Context |
|-------|-----------|---------|-----|-----------------|
| Crisis S3+ detected | Crisis team + PR Manager | "🚨 Crisis Alert (S[N]/5): [Brand] — [Description]" | <5 minutes | WAT timestamp; ₦ impact estimate |
| Crisis S5 detected | All Admins + Crisis team | "🔴 CRITICAL: [Brand] S5 Crisis — Immediate action required" | <2 minutes | Bypass WAT quiet hours |
| Coverage spike | PR Manager | "📈 Coverage spike: [N]× normal volume detected" | <15 minutes | WAT time; source tiers listed |
| Tier-1 coverage | PR Manager | "⭐ Tier-1 coverage: [Article Title] in [Outlet]" | <5 minutes | ₦ AVE shown; impact score |
| Negative sentiment drop | PR Manager | "📉 Sentiment drop: [Brand] sentiment at [Score]" | <10 minutes | WAT timestamp |
| Competitive SOV movement | PR Manager | "📊 Competitor movement: [Name] SOV up [N]pp" | <2 hours | ₦ AVE comparison |
| Coverage alert (saved search) | Search creator | "🔍 New results: [Search Name] — [N] new mentions" | Per frequency | WAT delivery time |
| Daily monitoring digest | Subscribed users | "📋 Daily monitoring digest — [Date] WAT" | 8:00 AM WAT | ₦ AVE total; sentiment summary |
| Weekly SOV report | Managers | "📊 Weekly SOV report — w/e [Date] WAT" | Monday 8:00 AM WAT | ₦ competitive comparison |

### 8.2 In-App Notifications

| Event | Icon | Message | Dismissible |
|-------|------|---------|------------|
| Crisis S2+ detected | 🚨 | "Crisis alert (S[N]/5): [Description]" | No (sticky) |
| Tier-1 coverage | ⭐ | "[Outlet] published: [Headline]" | Yes |
| Coverage spike | 📈 | "Coverage spike: [N]× normal volume" | Yes |
| Competitive SOV shift | 📊 | "[Competitor] SOV changed by [N]pp" | Yes |
| Saved search results | 🔍 | "[N] new results for '[Search Name]'" | Yes |
| ₦ AVE milestone | 💰 | "₦ AVE reached ₦[Amount] this month" | Yes |

---

## 9. Error Handling

### 9.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `MON_CAMPAIGN_NOT_FOUND` | 404 | Monitoring campaign not found | Check campaign ID |
| `MON_ARTICLE_NOT_FOUND` | 404 | Article not found | Check article ID |
| `MON_ALERT_NOT_FOUND` | 404 | Alert not found | Check alert ID |
| `MON_CAMPAIGN_LIMIT_REACHED` | 422 | Campaign limit reached for current plan | Upgrade plan or archive inactive campaigns |
| `MON_SOURCE_LIMIT_REACHED` | 422 | Source limit reached for current plan | Upgrade plan or reduce sources |
| `MON_QUERY_TOO_COMPLEX` | 422 | Search query too complex (>1000 characters) | Simplify the query |
| `MON_SEARCH_TIMEOUT` | 504 | Search query exceeded 30-second timeout | Add filters to narrow scope |
| `MON_DATE_RANGE_EXCEEDED` | 422 | Date range exceeds plan retention limit | Narrow date range or upgrade plan |
| `MON_SOURCE_UNAVAILABLE` | 503 | One or more sources temporarily unavailable | Check back shortly; monitoring continues |
| `MON_EMBARGO_ACTIVE` | 403 | Content under embargo — cannot be distributed | Wait until embargo date |
| `AUTHZ_INSUFFICIENT_PERMISSION` | 403 | You don't have permission for this action | Contact Admin |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — retry after [N] seconds | Retry after cooldown |

### 9.2 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Source API down | Queue collection; retry with exponential backoff; user notified of delay |
| Sentiment analysis unavailable | Store article without sentiment; retroactively analyze when service recovers |
| ₦ AVE rate card update failure | Use most recent rate cards; flag as "rates as of [date]" |
| Full-text extraction fails | Store title and excerpt; mark as "partial content"; retry |
| Alert delivery failure | Retry 3 times with backoff; log failure; escalate to Admin |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target |
|--------|--------|
| Article processing (publication to dashboard) | <15 minutes for major Nigerian outlets |
| Search execution (complex boolean) | <30 seconds |
| Dashboard load | <3 seconds |
| Alert delivery (S4/S5 crisis) | <2 minutes |
| SOV calculation full refresh | <1 hour |
| ₦ AVE calculation | <5 minutes per batch |
| API response time P95 | <500ms |
| Export generation (10,000 articles) | <5 minutes |

### 10.2 Scale

| Metric | Capacity |
|--------|---------|
| Concurrent monitoring campaigns | 5,000+ across all organizations |
| Daily article processing | 100,000+ articles |
| Simultaneous dashboard users | 200+ |
| Sources indexed | 500+ Nigerian and international |

### 10.3 Accuracy

| Metric | Target |
|--------|--------|
| Sentiment analysis (Nigerian English) | ≥85% |
| Entity recognition | ≥90% |
| Deduplication | ≥99% |
| ₦ AVE estimation vs. actual rates | Within 20% |
| SOV calculation | ≥99% accuracy |
| Crisis detection lead time | ≥2 hours for 80%+ of cases |

### 10.4 Nigerian Market Compliance

| Requirement | Implementation |
|-------------|---------------|
| NDPR compliance | Journalist contact consent; right to erasure; 7-year audit log |
| ₦ monetary values | All financial metrics stored as NUMERIC(15,2) NGN |
| WAT timezone | Africa/Lagos default; all display timestamps in WAT |
| Nigerian copyright | Article excerpts under fair use; full text only for accessible content |

---

## 11. Edge Cases

| ID | Scenario | Behavior |
|----|----------|---------|
| EC-01 | Paywalled Nigerian newspaper article | Extract available excerpt; mark as paywalled; score from available content |
| EC-02 | Duplicate article syndicated to 20+ Nigerian outlets | Deduplicate to primary source; show "syndicated to N outlets" count |
| EC-03 | Nigerian politician or public figure sharing article | Amplification logged; influence score applied; not re-ingested as new article |
| EC-04 | Very high volume (1,000+ articles in 1 hour) | Batch processing; rate limiting; volume spike alert triggered |
| EC-05 | Nigerian Pidgin content in article | Language detected; sentiment analysis applied with Pidgin tuning |
| EC-06 | Article removed by publisher after ingestion | Mark as `[Deleted]`; preserve metrics for campaign; note in article detail |
| EC-07 | Crisis detected at 2 AM WAT | S4/S5 bypasses quiet hours; S1/S2 queued for morning digest |
| EC-08 | Competitor added mid-period | SOV recalculated from competitor addition date; historical data noted |
| EC-09 | Search returns 0 results | Empty state with suggestions; offer to broaden query |
| EC-10 | Source API rate limit during high-volume period | Queue with priority; major Nigerian outlets prioritized |

---

## 12. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-MON-01 | Broadcast TV/radio monitoring (Channels TV, NTA full transcription) | 🔴 High | Phase 10 — Year 3 |
| FE-MON-02 | Nigerian Pidgin and Yoruba/Hausa/Igbo sentiment analysis | 🔴 High | Phase 8 — Q4 2027 |
| FE-MON-03 | Predictive crisis modeling (ML-based early warning) | 🟡 Medium | Phase 4 — Q4 2026 |
| FE-MON-04 | Print media OCR scanning (physical newspapers) | 🟢 Low | Phase 12 — Year 3 |
| FE-MON-05 | Podcast monitoring and transcription | 🟢 Low | Phase 10 — Year 3 |
| FE-MON-06 | WhatsApp message monitoring (public channels) | 🔴 High | Phase 5 — Q1 2027 |
| FE-MON-07 | ₦ PR budget optimization recommendations | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-MON-08 | Nigerian media industry benchmarks (anonymized peer data) | 🟡 Medium | Phase 8 — Q4 2027 |
| FE-MON-09 | Custom AI sentiment model per organization | 🟢 Low | Year 3 |

---

## 13. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| PR Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |

---

## 14. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 3 & 5: Social Listening** | Shared sentiment analysis pipeline; cross-platform mention deduplication |
| **Module 8: Media Relations & PR** | Press release distribution; journalist CRM data shared |
| **Module 7: Analytics & Reporting** | ₦ media metrics consumed by unified dashboards |
| **Module 6: Engagement Hub** | Media context for journalist engagement responses |
| **Architecture** | RLS isolation patterns; data pipeline design |
| **ADRs** | ADR-003 (PostgreSQL full-text search), ADR-009 (multi-tenant RLS) |
| **Database Schema** | media_articles, monitoring_campaigns, monitoring_competitors, monitoring_alerts tables |
| **Security Architecture** | NDPR compliance; Nigerian journalist data handling |
| **Engineering Standards** | ₦ currency conventions; WAT timezone defaults |
| **QA Strategy** | Sentiment accuracy testing; crisis detection testing; ₦ AVE validation |
| **API Reference** | Complete monitoring endpoint documentation |
| **Personas** | Ade (Head of PR), Ngozi (Crisis Manager), Ifeoma (Agency), Tunde (Analyst) |
| **User Journeys** | Journey 3 (Media Monitoring), Journey 4 (Crisis Detection & Response) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified and expanded Media Monitoring module. Merges and improves both source documents. Adds: Nigerian market calibration throughout (Nigerian publication authority scores, Nigerian rate cards for ₦ AVE calculation, Nigerian crisis keyword pre-sets by industry, WAT timezone in all alert and dashboard displays, Nigerian geographic drill-down to state level, Nigerian Pidgin sentiment tuning, Nigerian regulatory entity recognition for CBN/NCC/NAFDAC/SEC), 6-tier RBAC matrix, complete RLS-protected database schema with NUMERIC(15,2) NGN monetary fields, ₦ AVE formula with Nigerian rate card examples, crisis severity framework with Nigerian industry examples, competitive SOV with ₦ AVE dimensions, WhatsApp monitoring as high-priority future enhancement, and Nigerian market-specific future roadmap. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to Nigerian source coverage, ₦ AVE rate cards, crisis severity thresholds, or competitive benchmarking methodologies must be reflected in this document before implementation begins.*