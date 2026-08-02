# Module 3 & 5: Social Listening & Media Monitoring

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

The Social Listening & Media Monitoring module provides Nawebeus users with comprehensive, real-time intelligence about brand conversations across social media platforms, news publications, broadcast media, and online communities. It delivers AI-powered sentiment analysis, competitive intelligence, crisis detection, and actionable insights — all calibrated for the Nigerian and African market context.

This unified module combines two complementary capabilities:

| Capability | Focus | Data Sources |
|-----------|-------|-------------|
| **Social Listening** | Real-time conversations on social platforms | Twitter/X, Instagram, Facebook, LinkedIn, TikTok, Reddit |
| **Media Monitoring** | Published coverage in news and broadcast | Nigerian newspapers, business publications, tech media, broadcast, international outlets |

Together, they form the **Intelligence** pillar of the platform — the foundation for proactive brand management, crisis prevention, and competitive strategy.

### 1.2 Module Objectives

| Objective | Success Measure | Nigerian Market Context |
|-----------|-----------------|------------------------|
| **Real-time monitoring** | 95%+ of mentions appear within 15 minutes | Includes Nigerian-specific sources (Punch, Vanguard, TechCabal, Channels TV) |
| **Accurate sentiment analysis** | ≥85% accuracy on labeled datasets | Tuned for Nigerian English, Pidgin, and African market terminology |
| **Crisis detection lead time** | 2+ hours before mass escalation | Critical for Nigerian banking, telecom, and FMCG sectors |
| **Competitive intelligence** | SOV tracked for all configured competitors | NGN (₦) AVE calculations |
| **Alert precision** | <5% false positive rate | Reduced noise for Nigerian market volumes |
| **Influencer identification** | 95%+ accuracy on known datasets | Includes Nigerian influencer networks |

### 1.3 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Ade** (Head of PR, Enterprise Bank) | Admin / Manager | Brand monitoring, crisis detection, executive reporting, competitive intelligence |
| **Chidi** (Head of Marketing, Fintech) | Admin / Manager | Campaign monitoring, SOV tracking, competitor analysis |
| **Ngozi** (Crisis Manager, Multinational) | Manager | Crisis detection and response, severity assessment, stakeholder alerts |
| **Kemi** (Content Strategist, E-commerce) | Analyst | Trend identification, content performance insights, audience analysis |
| **Tunde** (Digital Analyst, FMCG) | Analyst | Data export, custom reporting, metric benchmarking |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client monitoring, white-label reporting |

### 1.4 Module Scope

**In Scope:**
- Advanced boolean query builder with Nigerian context pre-sets
- Social platform mention collection (Twitter/X, Instagram, Facebook, LinkedIn, TikTok, Reddit)
- Media monitoring (Nigerian news, international outlets, broadcast, RSS feeds)
- AI-powered sentiment analysis (tuned for Nigerian English and Pidgin)
- Multi-dimensional influencer scoring with Nigerian influencer network awareness
- Share of Voice (SOV) and competitive intelligence with ₦ AVE calculations
- Crisis detection with 5-level severity framework
- Comprehensive alerting with WAT-timezone-aware quiet hours
- Interactive listening dashboard with real-time updates
- Mention tagging, hiding, and saved searches
- Data export (CSV, PDF) with ₦ monetary values
- Post-crisis analysis and reporting

**Out of Scope (Future Phases):**

| Feature | Phase | Timeline |
|---------|-------|---------|
| Image and video sentiment analysis (OCR, video ML) | Phase 4 | Q4 2026 |
| Predictive crisis modeling (ML-based) | Phase 4 | Q4 2026 |
| Advanced topic clustering (unsupervised ML) | Phase 4 | Q4 2026 |
| Multilingual sentiment beyond English/Pidgin | Phase 8 | Q4 2027 |
| Custom ML model training per organization | Phase 12 | Year 3 |
| Podcast monitoring and transcription | Phase 10 | Year 3 |

### 1.5 Dependencies

| Module | Relationship |
|--------|-------------|
| **Module 1: Authentication** | Prerequisite — authenticated users and JWT context |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits for queries and mentions |
| **Module 4: Engagement Hub** | Seamless handoff from mention to conversation |
| **Module 6: Analytics & Reporting** | Unified dashboards consuming listening and monitoring metrics |
| **Module 9: Notifications** | Alert delivery — email, in-app, push |

---

## 2. User Stories

### 2.1 Query Building & Configuration

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-001 | As a user, I want to create listening queries for my brand name using boolean operators | P0 | Complex queries parse and execute correctly within 30 seconds |
| US-LISTEN-002 | As a Nigerian user, I want pre-built query templates for Nigerian banking, fintech, and FMCG brands | P0 | Templates include Nigerian-specific keywords and source filters |
| US-LISTEN-003 | As a user, I want to track hashtags, @mentions, and keyword variations | P0 | All mention formats captured within platform polling intervals |
| US-LISTEN-004 | As a user, I want to monitor competitors and see their SOV vs. mine | P0 | SOV calculations update within 1 hour of mention processing |
| US-LISTEN-005 | As a user, I want to filter by platform, language, and geography | P0 | Geographic filters achieve 90%+ accuracy |
| US-LISTEN-006 | As a user, I want to see estimated query volume before activating a query | P1 | Volume estimate shown before activation; no activation surprises |
| US-LISTEN-007 | As a user, I want to save queries as templates for reuse | P1 | Templates save and apply all configurations correctly |

### 2.2 Mention Monitoring

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-010 | As a user, I want to see new social mentions in real-time | P0 | Mentions appear within 15 minutes of posting |
| US-LISTEN-011 | As a user, I want to see new media coverage within 15 minutes of publication | P0 | 95%+ of articles captured within 15 minutes |
| US-LISTEN-012 | As a user, I want mentions enriched with author information and influence scores | P0 | Influence scores updated hourly |
| US-LISTEN-013 | As a user, I want sentiment analysis for each mention with confidence score | P0 | 85%+ accuracy; confidence score always displayed |
| US-LISTEN-014 | As a user, I want to filter mentions by sentiment, platform, source, and influence | P0 | Filters apply across all visualizations in <1 second |
| US-LISTEN-015 | As a user, I want to tag and annotate mentions | P0 | Tags saved and searchable |
| US-LISTEN-016 | As a user, I want to search historical mentions with boolean logic | P0 | Historical search up to plan retention limit |
| US-LISTEN-017 | As a user, I want to see the ₦ advertising value equivalent (AVE) for media coverage | P1 | AVE calculated in NGN (₦); source authority factored in |

### 2.3 Sentiment Analysis

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-020 | As a user, I want to see sentiment trends over time with confidence intervals | P0 | Time-series chart with trend lines and anomaly markers |
| US-LISTEN-021 | As a user, I want emotion type detection (joy, anger, fear, sadness, disgust) | P1 | Emotion accuracy ≥80% on labeled datasets |
| US-LISTEN-022 | As a user, I want aspect-based sentiment for product features, pricing, service | P2 | 75%+ accuracy on relevant mentions |
| US-LISTEN-023 | As a user, I want to manually correct misclassified sentiment to improve the model | P1 | Manual corrections persisted and fed back to model |
| US-LISTEN-024 | As a user, I want sentiment benchmarked against competitors | P0 | Side-by-side sentiment comparison with statistical significance |

### 2.4 Crisis Detection & Alerts

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-030 | As a Crisis Manager, I want to be alerted to volume spikes before they become crises | P0 | Alert delivered within 5 minutes of threshold breach |
| US-LISTEN-031 | As a Crisis Manager, I want to be alerted to sudden sentiment drops | P0 | Alert within 5 minutes; severity score calculated |
| US-LISTEN-032 | As a Crisis Manager, I want crisis severity scored on a 1–5 scale with recommended actions | P0 | Severity matches human assessment in 90%+ of cases |
| US-LISTEN-033 | As a Crisis Manager, I want alerts when influential accounts mention my brand | P0 | Alert within 5 minutes; influence tier shown |
| US-LISTEN-034 | As a user, I want to configure alert thresholds and quiet hours in WAT | P0 | WAT quiet hours respected; critical alerts bypass quiet hours |
| US-LISTEN-035 | As a user, I want crisis alerts via email, in-app, and push notifications | P0 | Delivery within 2 minutes for Severity 4–5 crises |
| US-LISTEN-036 | As a user, I want a post-crisis analysis report auto-generated after resolution | P1 | Report includes timeline, sentiment recovery curve, response effectiveness |

### 2.5 Competitive Intelligence

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-040 | As a user, I want to track Share of Voice vs. named competitors | P0 | SOV includes volume, engagement, reach, and sentiment dimensions |
| US-LISTEN-041 | As a user, I want competitive sentiment benchmarking | P0 | Side-by-side comparison with statistical significance testing |
| US-LISTEN-042 | As a user, I want to detect competitor campaign launches | P1 | Campaign detection within 4 hours of launch signals |
| US-LISTEN-043 | As a user, I want competitive alerts when SOV changes significantly | P0 | Alert within 2 hours of significant SOV shift |
| US-LISTEN-044 | As a user, I want to see competitive intelligence in ₦ AVE terms | P1 | All AVE figures shown in NGN (₦) |

### 2.6 Analytics & Reporting

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-LISTEN-050 | As a user, I want to export mention and monitoring data to CSV | P0 | CSV includes all fields; ₦ AVE column included |
| US-LISTEN-051 | As a user, I want to generate listening and monitoring reports | P0 | Reports show all key metrics with WAT timestamps |
| US-LISTEN-052 | As a user, I want to track key listening metrics over time | P0 | 30-day, 90-day, and custom date range views |
| US-LISTEN-053 | As an Agency user, I want to generate white-label reports for clients | P1 | Agency branding applied; Nawebeus branding removed |

---

## 3. Functional Requirements

### 3.1 FR-LISTEN-001: Advanced Query Builder

**Description:** Create sophisticated listening queries with boolean logic, platform targeting, geographic filtering, and Nigerian market pre-sets.

**Boolean Operators:**

| Operator | Syntax | Example |
|----------|--------|---------|
| Exact match | Quoted phrases | `"customer service"` |
| Broad match | Unquoted term | `customer service` |
| AND | Both required | `brand AND product` |
| OR | Either term | `brand OR product` |
| NOT | Exclude term | `brand NOT competitor` |
| NEAR/N | Within N words | `brand NEAR/5 product` |
| Parentheses | Grouping | `(brand OR company) AND (review OR feedback)` |
| Hashtag | Track hashtag | `#FirstBank` |
| Mention | Track @mention | `@FirstBankNG` |

**Platform Targeting:**

| Platform | Social Listening | Media Monitoring |
|----------|-----------------|-----------------|
| Twitter/X | ✅ Tweets, replies, quote tweets | — |
| Instagram | ✅ Captions, comments, Reels | — |
| Facebook | ✅ Posts, comments, public groups | — |
| LinkedIn | ✅ Posts, articles, comments | — |
| TikTok | ✅ Video captions, comments | — |
| Reddit | ✅ Posts, comments, subreddits | — |
| Nigerian Newspapers | — | ✅ Punch, Vanguard, The Guardian, The Nation |
| Business Publications | — | ✅ BusinessDay, Nairametrics, Financial Nigeria |
| Tech Media | — | ✅ TechCabal, Techpoint Africa, Disrupt Africa |
| Broadcast (online) | — | ✅ Channels TV, NTA, Arise News, TVC |
| International Media | — | ✅ Reuters Africa, BBC Africa, CNN Africa |
| RSS/Blogs | — | ✅ Custom RSS feeds |

**Nigerian Market Pre-Sets (Query Templates):**

| Template | Industry | Keywords Pre-Loaded |
|---------|---------|-------------------|
| Nigerian Bank Brand Monitor | Banking | Brand name, @handle, #hashtag, common Nigerian banking terms |
| Fintech Crisis Watch | Fintech | "app down", "transfer failed", "blocked account", Pidgin variants |
| Telecom Complaint Monitor | Telecom | Network terms, service complaints, regulatory mentions |
| FMCG Product Launch | FMCG | Product name, launch keywords, Nigerian market terms |
| PR Agency Client Monitor | Agency | Client brand, competitors, industry keywords |

**Advanced Filtering Options:**

| Filter | Options |
|--------|---------|
| Language | English, Pidgin English, Yoruba, Hausa, Igbo (detection-based) |
| Geography | Country, region, city (IP/geo-tag based) |
| Author tier | Micro (1K–10K), Mid (10K–100K), Macro (100K–1M), Mega (1M+) |
| Verified only | Boolean — verified accounts only |
| Minimum engagement | Configurable threshold |
| Date range | Custom range (up to plan retention limit) |
| Sentiment | Positive, neutral, negative |
| Source authority | 0–100 score range (media monitoring) |

**Query Performance Analytics:**

| Metric | Description | Update |
|--------|-------------|--------|
| Precision score | % of results matching intent | After 24 hours |
| Recall score | % of relevant results captured | After 24 hours |
| Noise ratio | % of irrelevant results | After 24 hours |
| Monthly mention estimate | Projected volume | At creation |
| Actual monthly mentions | Real volume | Rolling 30 days |

**Plan Limits:**

| Plan | Active Queries | Keywords per Query |
|------|---------------|-------------------|
| Starter | 5 | 20 |
| Growth | 25 | 50 |
| Professional | 100 | 200 |
| Enterprise | Unlimited | Unlimited |
| Agency | 500 (across all clients) | 200 |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Complex boolean queries parse correctly with real-time syntax validation |
| AC2 | Platform-specific queries return results within platform polling intervals |
| AC3 | Geographic filters achieve 90%+ accuracy via IP geolocation |
| AC4 | Nigerian market pre-set templates apply correctly and return relevant results |
| AC5 | Query performance metrics available within 24 hours of activation |
| AC6 | Query limits enforced per plan with upgrade prompt shown |
| AC7 | Estimated monthly volume shown before activation |
| AC8 | Inactive queries do not count toward plan limits |

---

### 3.2 FR-LISTEN-002: Mention Collection & Content Ingestion

**Description:** Collect, deduplicate, and enrich mentions from social platforms and media sources with real-time processing.

**Data Collection Pipeline:**

| Stage | Social Listening | Media Monitoring | Latency Target |
|-------|-----------------|-----------------|----------------|
| Real-time streaming | Twitter/X Filtered Stream | — | <30 seconds |
| Polling | Instagram, Facebook, LinkedIn, TikTok, Reddit | All media sources | 1–15 minutes |
| Historical backfill | Up to 30 days for new queries | Up to 30 days | Initial setup |
| Deduplication | Cross-platform duplicate detection | Syndication detection | On ingestion |
| Enrichment | Influence scoring, sentiment, entities | AVE, authority, entities | On ingestion |

**Mention Enrichment Data Points:**

| Data Point | Social Mentions | Media Articles | Update Frequency |
|-----------|----------------|----------------|-----------------|
| Author/Source name | ✅ | ✅ | On collection |
| Follower count / circulation | ✅ | ✅ | Daily |
| Influence score / authority score | ✅ (0–100) | ✅ (0–100) | Hourly / Weekly |
| Verification status | ✅ | — | On collection |
| Sentiment score + confidence | ✅ | ✅ (headline + body) | On collection |
| Emotion detection | ✅ | ✅ | On collection |
| Named entities | ✅ | ✅ | On collection |
| Language detected | ✅ | ✅ | On collection |
| Geography (country/city) | ✅ | ✅ | On collection |
| Reach estimate | ✅ | ✅ | Daily |
| Engagement metrics | ✅ (likes, shares, comments) | ✅ (social shares) | Daily |
| ₦ AVE value | — | ✅ (NGN) | On collection |
| Impact score | ✅ | ✅ | On collection |
| Spam probability | ✅ | — | On collection |
| Brand mention context | ✅ | ✅ (primary/passing/none) | On collection |
| Competitive flag | ✅ | ✅ | On collection |

**Nigerian Media Source Authority Scoring (examples):**

| Source | Type | Default Authority Score |
|--------|------|------------------------|
| BusinessDay | Business newspaper | 88 |
| Punch Nigeria | National newspaper | 85 |
| Vanguard | National newspaper | 82 |
| TechCabal | Tech publication | 84 |
| The Guardian Nigeria | National newspaper | 80 |
| Nairametrics | Financial news | 82 |
| Techpoint Africa | Tech publication | 78 |
| Channels TV (online) | Broadcast | 86 |
| Premium Times | Online news | 79 |
| Reuters Africa | International wire | 92 |

Authority scores updated weekly from: domain authority metrics, Alexa/Semrush rankings, social sharing velocity, journalistic credibility signals.

**₦ AVE Calculation:**

```
AVE (₦) = Source Circulation × Advertising Rate per Page × Space Occupied × Quality Multiplier

Where:
- Source Circulation: Verified reader/viewer numbers
- Advertising Rate: Current rate card in NGN (₦)
- Space Occupied: Article prominence (full page = 1.0, quarter page = 0.25, etc.)
- Quality Multiplier: Sentiment × Source Authority (0.5 to 2.0)
```

**Deduplication Logic:**

| Method | Trigger |
|--------|---------|
| Exact content hash match | Identical text across sources |
| Near-duplicate detection (95%+ similarity) | Syndicated articles |
| Retweet/quote tweet linking | Twitter/X shares |
| Cross-platform URL matching | Same story shared on multiple platforms |
| Source cross-referencing | Wire service → multiple outlets |

**Content Processing Standards:**

| Check | Standard |
|-------|---------|
| Full-text extraction | 98%+ success rate for publicly accessible content |
| Duplicate elimination | 99%+ deduplication rate |
| Spam/bot detection | 95%+ accuracy; manual override available |
| Named entity recognition | 90%+ accuracy |
| Language detection | 95%+ accuracy |

**Privacy & Compliance:**

- NDPR, GDPR, CCPA compliance for all collected data
- Right to erasure: deleted post content replaced with `[Deleted]` marker; metrics preserved
- Personal data not collected from private social accounts
- Data retention per plan: 7 days (Starter), 90 days (Growth), 1 year (Professional), 3 years (Enterprise)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Social mentions appear in dashboard within 15 minutes; media articles within 15 minutes of publication |
| AC2 | 99%+ deduplication across platforms and syndicated sources |
| AC3 | Influence scores updated within 1 hour of mention collection |
| AC4 | Media articles include ₦ AVE calculated using Nigerian advertising rates |
| AC5 | Conversation threading reconstructs reply chains correctly |
| AC6 | Spam detection achieves 95%+ accuracy with manual override |
| AC7 | Full-text extraction achieves 98%+ for accessible content |

---

### 3.3 FR-LISTEN-003: AI-Powered Sentiment Analysis

**Description:** Multi-dimensional sentiment analysis tuned for Nigerian English, Pidgin, and African market context.

**Sentiment Dimensions:**

| Dimension | Scale | Description |
|-----------|-------|-------------|
| Overall sentiment | -1.0 to +1.0 | Aggregate sentiment across headline and body |
| Headline sentiment | -1.0 to +1.0 | Media articles: headline-specific sentiment |
| Body sentiment | -1.0 to +1.0 | Media articles: body-specific sentiment |
| Confidence score | 0.0 to 1.0 | Model certainty; displayed with every classification |
| Emotion: Joy | 0.0 to 1.0 | Positive engagement, excitement, celebration |
| Emotion: Anger | 0.0 to 1.0 | Complaints, frustration, outrage |
| Emotion: Fear | 0.0 to 1.0 | Worry, concern, anxiety |
| Emotion: Surprise | 0.0 to 1.0 | Unexpected news, shock |
| Emotion: Sadness | 0.0 to 1.0 | Disappointment, regret |
| Emotion: Disgust | 0.0 to 1.0 | Strong rejection, revulsion |
| Sarcasm flag | Binary + confidence | Ironic statements flagged for review |

**Nigerian English and Pidgin Adaptations:**

| Context | Standard English Equivalent | Sentiment |
|---------|---------------------------|-----------|
| "This app no dey work" | "This app doesn't work" | Negative |
| "E shock me" | "I was amazed/shocked" | Context-dependent |
| "Naija no dey carry last" | "Nigerians are not left behind" | Positive |
| "You don try" | "You've done well" | Positive |
| "This bank wahala too much" | "This bank's problems are too much" | Negative |
| "E don port" | "It has ported/moved to another network" | Contextual |

**Industry-Specific Sentiment Models:**

| Industry | Nigerian Context |
|----------|----------------|
| Banking | Tuned for Nigerian banking complaints, CBN policy discussions, digital banking terms |
| Fintech | Payment failure language, app performance terms, regulatory terminology |
| Telecom | MTN, Airtel, Glo, 9mobile ecosystem terms; network quality complaints |
| FMCG | Consumer goods market specific; affordability discussions; distribution mentions |
| Media/PR | Industry-specific professional terminology |

**Aspect-Based Sentiment Examples:**

| Aspect | Example Mention | Aspect Sentiment |
|--------|----------------|-----------------|
| App performance | "GTBank app is down again" | Negative: performance |
| Customer service | "UBA customer service resolved my issue fast" | Positive: service |
| Pricing | "MTN data prices too expensive for Nigerians" | Negative: pricing |
| Product features | "Opay has the best transfer feature" | Positive: features |
| Brand reputation | "First Bank still Nigeria's most trusted bank" | Positive: brand |

**Sentiment Visualizations:**

| Visualization | Description |
|---------------|-------------|
| Real-time sentiment stream | Color-coded mentions (green/gray/red) in live feed |
| Sentiment trend chart | Time-series with confidence intervals and anomaly markers |
| Sentiment distribution | Donut chart: positive / neutral / negative breakdown |
| Emotion radar | Multi-axis radar chart per emotion category |
| Aspect heatmap | Sentiment by product/service/experience dimension |
| Competitor sentiment comparison | Side-by-side with statistical significance |

**Model Performance Targets:**

| Metric | Target |
|--------|--------|
| Overall accuracy | ≥85% on standardized datasets |
| Nigerian English accuracy | ≥82% (lower due to dialectal variation) |
| Pidgin English accuracy | ≥75% (specialized corpus required) |
| Emotion detection accuracy | ≥80% |
| Aspect sentiment accuracy | ≥75% on relevant mentions |
| Sarcasm detection: flag uncertain cases | Confidence threshold ≥50% |
| Manual correction impact | Measurable accuracy improvement over time |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Sentiment analysis completes within 2 seconds per mention |
| AC2 | Overall accuracy ≥85% on standardized datasets |
| AC3 | Nigerian English and Pidgin expressions classified correctly |
| AC4 | Confidence scores displayed with every classification |
| AC5 | Sarcasm detection flags uncertain classifications for manual review |
| AC6 | Manual corrections improve model accuracy over time |
| AC7 | Industry-specific models applied based on organization's sector |

---

### 3.4 FR-LISTEN-004: Listening & Monitoring Dashboard

**Description:** Real-time interactive dashboard with Nigerian-market-calibrated metrics and automated insights.

**Dashboard KPI Cards:**

| KPI | Description | Nigerian Context |
|-----|-------------|----------------|
| Total Mentions | Volume across all sources | Includes social + media |
| Net Sentiment Score | Weighted average sentiment | -100 to +100 scale |
| Share of Voice | % of category mentions | vs. configured competitors |
| ₦ PR Value | NGN advertising value equivalent | Based on Nigerian rate cards |
| Crisis Risk Score | 1–5 severity composite | Multi-signal crisis indicator |
| Top Influencer Tier | Highest-tier mention this period | Mega/Macro/Mid/Micro classification |
| Reach Estimate | Total potential audience | Platform-specific reach models |
| Avg Response Time | Engagement response time | For teams using Engagement Hub |

**Interactive Visualizations:**

| Visualization | Update Frequency | Interactive Features |
|---------------|-----------------|---------------------|
| Real-time mention stream | WebSocket (near-real-time) | Sentiment filter, platform filter, infinite scroll |
| Sentiment trend (time-series) | Every 5 minutes | Zoom, anomaly markers, forecast overlay |
| Mention volume chart | Every 5 minutes | Platform breakdown, volume spike annotations |
| Geographic heat map | Every 15 minutes | Nigeria state-level drill-down, city-level for Lagos/Abuja |
| SOV donut chart | Every hour | Click through to competitor detail |
| Emotion radar | Every 30 minutes | Per-query or aggregate view |
| Top sources / top authors | Every 15 minutes | Sortable by reach, engagement, sentiment |
| Topic word cloud | Every 30 minutes | Sentiment-colored, click to filter |

**Nigeria-Specific Geographic Drill-Down:**

- National level: Nigeria vs. other countries
- State level: All 36 states + FCT
- City level: Lagos, Abuja, Kano, Port Harcourt, Ibadan
- Platform-specific: Twitter/X has best Nigerian geo-tag coverage

**Real-Time Updates:**

| Component | Update Mechanism | Frequency |
|-----------|-----------------|-----------|
| Mention stream | WebSocket push | Near-real-time |
| Volume counters | WebSocket push | Every 60 seconds |
| Sentiment average | Polling | Every 5 minutes |
| Top authors | Polling | Every 15 minutes |
| Topic trends | Polling | Every 30 minutes |
| Geographic data | Polling | Every 15 minutes |
| SOV calculations | Polling | Every hour |

**Dashboard Customization:**

- 20+ pre-built widget library
- Drag-and-drop layout customization
- Per-widget configuration (time range, filters, metrics)
- Save multiple named dashboard views
- Share dashboards with team members
- Scheduled email delivery (daily/weekly) in WAT timezone

**Automated Insights Engine:**

The system automatically surfaces:
- Statistically significant sentiment shifts (z-score > 2.0)
- Unusual volume spikes (>3 standard deviations)
- Emerging topics (velocity-based detection)
- Influencer mentions above tier threshold
- Competitive SOV changes >5 percentage points
- Geographic concentration shifts

Each insight includes: what happened, why it matters, recommended action.

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Dashboard loads initial view in <3 seconds with all KPI cards |
| AC2 | Real-time mention stream updates via WebSocket within 30 seconds |
| AC3 | Interactive filters apply across all visualizations in <1 second |
| AC4 | Nigerian geographic drill-down works to state and major city level |
| AC5 | ₦ PR Value displayed with NGN symbol and Nigerian rate card basis |
| AC6 | Automated insights flag patterns with 90%+ relevance rating |
| AC7 | Dashboard customization persists across sessions and devices |

---

### 3.5 FR-LISTEN-005: Share of Voice & Competitive Intelligence

**Description:** Track brand visibility relative to competitors with SOV calculations in Nigerian market context.

**Competitor Configuration:**

| Setting | Description |
|---------|-------------|
| Competitor name | Display name |
| Category | Direct / indirect / aspirational |
| Tracking keywords | Keywords to monitor for this competitor |
| Active status | On/Off toggle |

**Plan Limits for Competitors:**

| Plan | Competitors Trackable |
|------|----------------------|
| Starter | 2 |
| Growth | 5 |
| Professional | 20 |
| Enterprise | Unlimited |
| Agency | 50 (across all client workspaces) |

**SOV Calculation Formula:**

```
SOV (%) = (Brand Mentions / Total Category Mentions) × 100

Where Total Category Mentions = Brand Mentions + All Competitor Mentions

SOV can be calculated across dimensions:
- Volume SOV: raw mention count
- Engagement SOV: total engagement weighted
- Reach SOV: total estimated reach
- Sentiment-Weighted SOV: volume × average sentiment
- ₦ AVE SOV: total advertising value equivalent in NGN
```

**SOV Analytics:**

| Metric | Description |
|--------|-------------|
| Volume SOV | % share of raw mentions |
| Engagement SOV | % share of total engagement |
| Reach SOV | % share of estimated audience reach |
| Sentiment-weighted SOV | SOV adjusted for sentiment quality |
| ₦ AVE SOV | % share of total advertising value equivalent (NGN) |
| Platform SOV | SOV broken down per platform |
| SOV trend | Historical SOV with statistical significance testing |
| SOV forecast | Predicted SOV based on 30-day patterns |

**Competitive Insights:**

| Insight | Description |
|---------|-------------|
| Campaign detection | Identify competitor campaign launches from mention volume + hashtag patterns |
| Share of engagement | Engagement SOV vs. volume SOV gap (quality indicator) |
| Sentiment gap | Statistical comparison of brand vs. competitor sentiment |
| Influencer overlap | Shared influencer audiences between brand and competitors |
| SOV change alerts | Alert when SOV shifts >5 percentage points |

**Statistical Analysis Applied:**

| Test | Use Case |
|------|----------|
| Z-test | Sentiment significance between two brands |
| Mann-Whitney U | Non-parametric comparison for small samples |
| Confidence intervals | SOV estimates with uncertainty bounds |
| p-value | Flag when changes are statistically significant (p<0.05) |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | SOV calculations update within 1 hour of mention processing |
| AC2 | All SOV dimensions available: volume, engagement, reach, sentiment, ₦ AVE |
| AC3 | Statistical significance testing flags meaningful changes |
| AC4 | SOV forecasts achieve 80%+ directional accuracy |
| AC5 | Competitive alerts trigger within 2 hours of significant SOV changes |
| AC6 | ₦ AVE SOV uses Nigerian advertising rate cards |
| AC7 | Competitive reports exportable with executive summary |

---

### 3.6 FR-LISTEN-006: Crisis Detection & Alerting

**Description:** Intelligent crisis detection with 5-level severity framework, automated stakeholder notification, and post-crisis analysis.

**Crisis Detection Algorithm:**

| Signal | Weight | Detection Threshold |
|--------|--------|---------------------|
| Mention volume | 30% | 5× normal hourly volume |
| Sentiment velocity | 25% | >20% negative sentiment increase in 2 hours |
| Influencer engagement | 20% | Macro+ tier account posting negatively |
| Platform amplification | 15% | Cross-platform spread detected |
| Crisis keywords | 10% | Pre-configured + NLP-detected crisis terms |

**Minimum 2 signals required to trigger crisis classification.**

**Crisis Severity Framework (5-Level):**

| Level | Name | Description | Example (Nigerian Context) | Response Time |
|-------|------|-------------|---------------------------|--------------|
| **S1** | Noise | Isolated complaints; no amplification | 1–2 upset tweets; no engagement | Monitor only |
| **S2** | Watch | Moderate negative; limited spread | Customer complaint going slightly viral | Review within 4 hours |
| **S3** | Respond | Active negative narrative forming | 50+ negative mentions; journalist asking for comment | Respond within 1 hour |
| **S4** | Escalate | Crisis trending; significant brand damage | Story trending on Nigerian Twitter; newspaper coverage | Respond within 15 minutes |
| **S5** | Critical | Full-blown crisis; widespread coverage | Front-page story; CBN/regulatory involvement; mass social reaction | Immediate — all hands |

**Nigerian Crisis Keywords Pre-Set:**

| Category | Pre-Set Keywords |
|----------|-----------------|
| Banking | "CBN", "bank collapse", "funds missing", "transfer failed", "account blocked", "NDIC" |
| Fintech | "app down", "money missing", "fraud", "hack", "EFCC", "data breach" |
| Telecom | "NCC", "network down", "service outage", "billing error", "overcharge" |
| FMCG | "product recall", "poisoning", "NAFDAC", "contamination", "fake product" |
| General | "lawsuit", "court order", "investigation", "protest", "apology needed" |

**Alert Configuration:**

| Alert Type | Trigger | Default Threshold | Configurable |
|-----------|---------|-----------------|-------------|
| Volume spike | Mention volume | 5× hourly average | Yes |
| Sentiment crash | Negative sentiment rate | +30% in 2 hours | Yes |
| Crisis detection | Multi-signal composite | S2+ severity | Yes |
| Influencer mention | Author influence score | Macro tier (100K+) | Yes |
| Competitive movement | Competitor SOV change | >5 percentage points | Yes |
| Viral content | Engagement velocity | 10× normal engagement | Yes |
| Bot activity | Suspicious patterns | ML-detected threshold | No |

**Alert Intelligence Features:**

| Feature | Description |
|---------|-------------|
| Severity scoring | Impact × urgency composite (S1–S5) |
| Alert deduplication | Prevents alert storms; groups related alerts within 1-hour windows |
| Alert correlation | Related alerts grouped into single incident |
| Escalation rules | Auto-escalate if unacknowledged after SLA |
| False positive learning | ML reduces false positives over time |
| Alert fatigue prevention | Smart batching; max 10 distinct alerts/hour/user |

**Alert Channels:**

| Channel | Use Case | Delivery SLA |
|---------|----------|-------------|
| In-app | All alert types | <2 seconds |
| Email | All alert types | <30 seconds |
| Push notification | Mobile app | <5 seconds |
| SMS | S4/S5 crises only (premium) | <10 seconds |
| Slack/Teams webhook | Team collaboration | <30 seconds |
| Custom webhook | External integrations | <30 seconds |

**WAT Timezone Awareness for Alerts:**

- Quiet hours configured in WAT (Africa/Lagos)
- S4/S5 crises bypass quiet hours regardless of configuration
- Daily digest delivered at 8:00 AM WAT
- Weekly digest delivered Monday 8:00 AM WAT
- "Last night's alerts" summary shown on first morning login

**Crisis Response Workflow:**

```
Multi-signal detection
    │
    ▼
Crisis severity calculated (S1–S5)
    │
    ▼
Stakeholder notifications sent (per severity)
    │
    ▼
Crisis incident record created
    │
    ▼
Response template library suggested
    │
    ▼
Team acknowledges and activates response plan
    │
    ▼
Monitoring intensified during crisis
    │
    ▼
Crisis resolved → Auto-generate post-crisis report
```

**Post-Crisis Analysis Report (auto-generated):**

- Timeline of crisis from first signal to resolution
- Peak severity and mention volume
- Sentiment recovery curve
- Response effectiveness score
- Key amplifiers (accounts and outlets that spread the story)
- Comparison to historical crises (if available)
- Recommendations for future prevention
- ₦ estimated brand impact (AVE-based)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Alerts trigger within 5 minutes of threshold breach |
| AC2 | Crisis detection provides 2+ hour lead time in 80%+ of cases |
| AC3 | Severity scoring matches human assessment in 90%+ of cases |
| AC4 | False positive rate <5% after 30-day learning period |
| AC5 | S4/S5 crisis alerts delivered within 2 minutes, bypassing quiet hours |
| AC6 | Post-crisis report auto-generated within 1 hour of resolution |
| AC7 | Nigerian crisis keyword pre-sets cover major sectors |

---

### 3.7 FR-LISTEN-007: Influence & Impact Analysis

**Description:** Identify key influencers, measure content impact, and calculate reach with Nigerian influencer network awareness.

**Influence Scoring Model:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Follower/subscriber count | 25% | Platform-specific; Nigerian audience context |
| Engagement rate | 30% | Likes, shares, comments per post over 90 days |
| Engagement quality | 20% | Authenticity of engagement; bot ratio deducted |
| Topic authority | 15% | Relevance and credibility on subject matter |
| Network influence | 10% | Connections to other high-influence accounts |

**Nigerian Influencer Tier Classification:**

| Tier | Followers | ₦ Estimated Reach | Examples |
|------|-----------|------------------|---------|
| Mega | 1M+ | 500K+ per post | Major Nigerian celebrities, politicians, ministers |
| Macro | 100K–1M | 50K–500K per post | Industry leaders, journalists, popular bloggers |
| Mid | 10K–100K | 5K–50K per post | Niche experts, community leaders, rising voices |
| Micro | 1K–10K | 500–5K per post | Engaged niche communities, local influencers |
| Nano | <1K | <500 per post | Ordinary users (still tracked if content goes viral) |

**Audience Authenticity Analysis:**

| Check | Method | Accuracy Target |
|-------|--------|----------------|
| Bot detection | Behavioral pattern analysis; account age; activity patterns | 95%+ |
| Fake follower detection | ML model; engagement ratio anomaly | 90%+ |
| Engagement pod detection | Coordinated activity patterns | 85%+ |
| Follower quality score | 0–100 composite authenticity score | Calculated |

**Impact Score Calculation:**

```
Impact Score (0–1000) = Source Authority × Sentiment Quality × Prominence × Reach Multiplier

Where:
- Source Authority: 0–100 (authority score of source)
- Sentiment Quality: 0.5–2.0 (neutral = 0.5; very positive or very negative = 2.0)
- Prominence: 0.1–1.0 (headline mention = 1.0; passing reference = 0.1)
- Reach Multiplier: 0.5–5.0 (based on estimated reach of source/author)
```

**Influencer Database:**

| Field | Description |
|-------|-------------|
| Platform handle | Twitter/X, Instagram, etc. |
| Display name | Real name if available |
| Influence score | 0–100 composite |
| Tier | Mega/Macro/Mid/Micro/Nano |
| Topic authority | Subject expertise categories |
| Follower quality score | Authenticity rating |
| Mention history | Dates and sentiment of all mentions |
| Sentiment trend | Has sentiment been improving or declining? |
| Contact information | Email, website (where publicly available) |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Influence scores updated within 1 hour of new mention data |
| AC2 | Nigerian influencer tier classification correctly applied |
| AC3 | Bot detection achieves 95%+ accuracy on known test accounts |
| AC4 | Impact scores calculated within 5 minutes of mention ingestion |
| AC5 | ₦ reach estimates use Nigerian platform-specific audience models |

---

## 4. Business Rules

### 4.1 Query Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-LISTEN-001 | Query must have at least 1 keyword | Logical minimum |
| BR-LISTEN-002 | Maximum keywords per query enforced per plan | Performance and billing |
| BR-LISTEN-003 | Query limits enforced per plan; inactive queries don't count | Flexibility |
| BR-LISTEN-004 | Query performance measured after 24 hours (precision/recall/noise) | Quality assurance |
| BR-LISTEN-005 | Queries can be paused without deletion | Flexibility |
| BR-LISTEN-006 | Historical backfill limited to 30 days for new queries | Cost management |
| BR-LISTEN-007 | Nigerian market pre-set templates available to all plans | Market fit |

### 4.2 Mention Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-LISTEN-010 | Duplicates counted as one mention; cross-platform linked | Data accuracy |
| BR-LISTEN-011 | Spam mentions auto-hidden (not deleted); manual override available | Data quality |
| BR-LISTEN-012 | Mention data retained per plan (7/90/365/1095 days) | Storage and compliance |
| BR-LISTEN-013 | Deleted social content replaced with `[Deleted]` marker; metrics preserved | Audit trail |
| BR-LISTEN-014 | Hidden mentions excluded from analytics but preserved | Data quality |
| BR-LISTEN-015 | ₦ AVE calculated using current Nigerian advertising rate cards | Market relevance |

### 4.3 Alert Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-LISTEN-020 | Volume spike: default threshold 5× hourly average (configurable) | Avoid noise |
| BR-LISTEN-021 | Sentiment crash: default -30% in 2 hours (configurable) | Avoid noise |
| BR-LISTEN-022 | Crisis detection requires ≥2 concurrent signals | Reduce false positives |
| BR-LISTEN-023 | Alert deduplication within 1-hour window | Prevent alert storms |
| BR-LISTEN-024 | S4/S5 crisis alerts bypass WAT quiet hours | Urgency |
| BR-LISTEN-025 | Max 10 distinct alert notifications per hour per user | Prevent alert fatigue |
| BR-LISTEN-026 | Post-crisis report auto-generated within 1 hour of crisis resolution | Operational continuity |

### 4.4 SOV Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-LISTEN-030 | SOV = Brand Mentions / (Brand + All Competitor Mentions) × 100 | Standard formula |
| BR-LISTEN-031 | SOV dimensions: volume, engagement, reach, sentiment-weighted, ₦ AVE | Comprehensive view |
| BR-LISTEN-032 | SOV calculations update within 1 hour of mention processing | Data freshness |
| BR-LISTEN-033 | SOV alerts trigger when change >5 percentage points | Meaningful threshold |
| BR-LISTEN-034 | ₦ AVE SOV uses Nigerian advertising rates | Market relevance |

---

## 5. Validation Rules

### 5.1 Zod Schemas

```typescript
// lib/validation/listening.schemas.ts

// Query creation schema
export const CreateQuerySchema = z.object({
  name: z.string().min(1, "Query name is required").max(100, "Name too long"),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().min(1).max(200))
    .min(1, "At least one keyword required")
    .max(200, "Maximum 200 keywords per query (Professional plan)"),
  booleanExpression: z.string().max(5000).optional(),
  platforms: z.array(
    z.enum(["twitter", "instagram", "facebook", "linkedin", "tiktok", "reddit",
            "news_ng", "news_international", "broadcast", "rss"])
  ).min(1, "Select at least one platform"),
  languages: z.array(z.string().length(2)).optional(),
  countries: z.array(z.string().length(2)).optional(),
  minEngagement: z.number().int().min(0).optional(),
  minInfluenceScore: z.number().int().min(0).max(100).optional(),
  minAuthorityScore: z.number().int().min(0).max(100).optional(),
});

// Alert configuration schema (WAT-aware quiet hours)
export const AlertConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    "volume_spike", "sentiment_crash", "crisis_detection",
    "influencer_mention", "competitive_movement", "viral_content"
  ]),
  enabled: z.boolean(),
  threshold: z.number().optional(),
  severityMinimum: z.number().int().min(1).max(5).default(2),
  queryIds: z.array(z.string()).optional(),
  channels: z.array(
    z.enum(["email", "in_app", "push", "sms", "slack", "webhook"])
  ).min(1, "At least one channel required"),
  recipients: z.array(z.string().email()).min(1),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM format")
    .optional(),
  quietHoursEnd: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM format")
    .optional(),
  timezone: z.string().default("Africa/Lagos"), // WAT default
});

// Mention filter schema
export const MentionFilterSchema = z.object({
  queryId: z.string().optional(),
  dateRange: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }).refine(data => data.end >= data.start, {
    message: "End date must be after start date",
  }),
  platforms: z.array(z.string()).optional(),
  sentimentLabel: z.enum(["positive", "neutral", "negative"]).optional(),
  minInfluenceScore: z.number().int().min(0).max(100).optional(),
  minAuthorityScore: z.number().int().min(0).max(100).optional(),
  minImpactScore: z.number().int().min(0).max(1000).optional(),
  tags: z.array(z.string()).optional(),
  isSpam: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  isCompetitive: z.boolean().optional(),
});

// Competitor configuration
export const CompetitorSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().min(1)).min(1, "At least one keyword required"),
  category: z.enum(["direct", "indirect", "aspirational"]).default("direct"),
  isActive: z.boolean().default(true),
});
```

---

## 6. Permissions

### 6.1 RBAC Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Query Management** |
| View queries and mentions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create queries | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit own queries | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit all queries | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete queries | ✅ | ✅ | ✅ | ❌ | ✅ (own) | ❌ |
| **Mention Actions** |
| Tag and annotate mentions | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hide/unhide mentions | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Export mention data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Correct sentiment classification | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Alerts** |
| Create and configure alerts | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Acknowledge alerts | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Configure crisis detection | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Competitive Intelligence** |
| View SOV reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/manage competitors | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete competitors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Influencer Analysis** |
| View influencer database | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export influencer data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Reporting** |
| Generate reports | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Share reports externally | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| White-label reports (Agency) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 7. API Reference

### 7.1 Listening & Monitoring Endpoints

| Endpoint | Method | Auth | Role | Purpose |
|----------|--------|------|------|---------|
| `/api/v1/listening/queries` | GET | ✅ | Analyst+ | List all queries |
| `/api/v1/listening/queries` | POST | ✅ | Analyst+ | Create query |
| `/api/v1/listening/queries/:id` | GET | ✅ | Analyst+ | Get query details |
| `/api/v1/listening/queries/:id` | PATCH | ✅ | Analyst+ (own) | Update query |
| `/api/v1/listening/queries/:id` | DELETE | ✅ | Analyst+ (own) | Delete query |
| `/api/v1/listening/mentions` | GET | ✅ | Analyst+ | List mentions |
| `/api/v1/listening/mentions/:id` | GET | ✅ | Analyst+ | Get mention detail |
| `/api/v1/listening/mentions/:id/tags` | POST | ✅ | Analyst+ | Tag a mention |
| `/api/v1/listening/mentions/:id/hide` | POST | ✅ | Analyst+ | Hide a mention |
| `/api/v1/listening/mentions/:id/sentiment` | PATCH | ✅ | Analyst+ | Correct sentiment |
| `/api/v1/listening/alerts` | GET | ✅ | Analyst+ | List alerts |
| `/api/v1/listening/alerts` | POST | ✅ | Analyst+ | Create alert |
| `/api/v1/listening/alerts/:id` | PATCH | ✅ | Analyst+ | Update alert |
| `/api/v1/listening/alerts/:id/acknowledge` | POST | ✅ | Analyst+ | Acknowledge alert |
| `/api/v1/listening/sov` | GET | ✅ | Analyst+ | Get SOV report |
| `/api/v1/listening/competitors` | GET | ✅ | Analyst+ | List competitors |
| `/api/v1/listening/competitors` | POST | ✅ | Manager+ | Create competitor |
| `/api/v1/listening/competitors/:id` | PATCH | ✅ | Manager+ | Update competitor |
| `/api/v1/listening/competitors/:id` | DELETE | ✅ | Admin+ | Delete competitor |
| `/api/v1/listening/influencers` | GET | ✅ | Analyst+ | List influencers |
| `/api/v1/listening/export` | POST | ✅ | Analyst+ | Export data |
| `/api/v1/monitoring/articles` | GET | ✅ | Analyst+ | List media articles |
| `/api/v1/monitoring/articles/:id` | GET | ✅ | Analyst+ | Get article detail |
| `/api/v1/monitoring/search` | POST | ✅ | Analyst+ | Search mentions/articles |
| `/api/v1/monitoring/alerts` | GET | ✅ | Analyst+ | List monitoring alerts |
| `/api/v1/monitoring/alerts/:id/acknowledge` | PUT | ✅ | Analyst+ | Acknowledge alert |

### 7.2 Request/Response Examples

**Create Query:**

```http
POST /api/v1/listening/queries
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "First Bank of Nigeria — Brand Monitor",
  "description": "All brand mentions across social and media",
  "keywords": [
    "First Bank",
    "\"First Bank of Nigeria\"",
    "@firstbanknigeria",
    "#FirstBank",
    "FBN"
  ],
  "booleanExpression": "(\"First Bank\" OR \"First Bank of Nigeria\" OR @firstbanknigeria OR #FirstBank OR FBN) AND NOT (\"First National Bank\" OR \"First Bank USA\")",
  "platforms": ["twitter", "instagram", "facebook", "linkedin", "news_ng", "news_international"],
  "languages": ["en"],
  "countries": ["NG"],
  "minInfluenceScore": 0,
  "minAuthorityScore": 0
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "qry_9f2a4b6c8d1e3f5g",
    "name": "First Bank of Nigeria — Brand Monitor",
    "status": "active",
    "estimatedMonthlyMentions": 8500,
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

**List Mentions (Social Listening):**

```http
GET /api/v1/listening/mentions?queryId=qry_9f2a4b6c&sentimentLabel=negative&minInfluenceScore=50&limit=20
Authorization: Bearer <token>
```

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": [
    {
      "id": "ment_7a8b9c0d1e2f3a4b",
      "queryId": "qry_9f2a4b6c8d1e3f5g",
      "platform": "twitter",
      "author": {
        "username": "@financialNGR",
        "displayName": "Financial Nigeria",
        "followers": 82400,
        "verified": true,
        "influenceScore": 88,
        "tier": "macro"
      },
      "content": "First Bank app has been down for 3 hours now. This is unacceptable for Nigeria's premier bank. #FirstBank",
      "url": "https://twitter.com/financialNGR/status/1234567890",
      "sentiment": {
        "score": -0.78,
        "label": "negative",
        "confidence": 0.94,
        "emotions": {
          "anger": 0.72,
          "disgust": 0.18,
          "fear": 0.10
        }
      },
      "engagement": {
        "likes": 847,
        "shares": 312,
        "comments": 156
      },
      "reachEstimate": 82400,
      "language": "en",
      "country": "NG",
      "isSpam": false,
      "isHidden": false,
      "isCrisisSignal": true,
      "publishedAt": "2026-07-21T09:45:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Im1lbnRfN2E4YiJ9",
    "hasMore": true,
    "totalCount": 247
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

**Get Media Article (Monitoring):**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "id": "art_3b4c5d6e7f8a9b0c",
    "title": "First Bank of Nigeria Reports Record Profits Despite Digital Challenges",
    "source": {
      "name": "BusinessDay Nigeria",
      "type": "newspaper",
      "authorityScore": 88,
      "url": "https://businessday.ng"
    },
    "author": "Emeka Nwosu",
    "url": "https://businessday.ng/banking/article/...",
    "publishedAt": "2026-07-21T08:00:00.000Z",
    "sentiment": {
      "headlineScore": 0.72,
      "bodyScore": 0.45,
      "overallScore": 0.58,
      "label": "positive",
      "confidence": 0.89
    },
    "impactScore": 476,
    "reachEstimate": 850000,
    "aveNaira": 425000.00,
    "currency": "NGN",
    "brandMentionContext": "primary",
    "entityMentions": ["First Bank of Nigeria", "CBN", "Lagos Stock Exchange"],
    "socialShares": {
      "twitter": 312,
      "linkedin": 145,
      "facebook": 89
    },
    "isCompetitive": false,
    "isArchived": false
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
      "start": "2026-07-01T00:00:00.000Z",
      "end": "2026-07-21T23:59:59.000Z"
    },
    "shareOfVoice": [
      {
        "brand": "First Bank of Nigeria",
        "mentions": 12450,
        "volumeSovPercent": 34.2,
        "engagementSovPercent": 38.5,
        "reachSovPercent": 31.8,
        "sentimentWeightedSovPercent": 36.1,
        "aveNaira": 6225000.00,
        "aveSovPercent": 35.4,
        "avgSentiment": 0.62,
        "sovChange": 2.1,
        "currency": "NGN"
      },
      {
        "brand": "GTBank",
        "mentions": 10200,
        "volumeSovPercent": 28.0,
        "engagementSovPercent": 26.3,
        "reachSovPercent": 29.1,
        "sentimentWeightedSovPercent": 24.8,
        "aveNaira": 5100000.00,
        "aveSovPercent": 29.0,
        "avgSentiment": 0.48,
        "sovChange": -1.3,
        "currency": "NGN"
      }
    ],
    "byPlatform": {
      "twitter": {
        "firstBank": 36.5,
        "gtbank": 27.2,
        "zenith": 22.1,
        "others": 14.2
      },
      "news_ng": {
        "firstBank": 32.8,
        "gtbank": 28.9,
        "zenith": 24.3,
        "others": 14.0
      }
    }
  }
}
```

**Create Alert:**

```http
POST /api/v1/listening/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "First Bank Crisis Alert",
  "type": "crisis_detection",
  "enabled": true,
  "severityMinimum": 3,
  "channels": ["email", "in_app", "push"],
  "recipients": ["ade@firstbank.com.ng", "ngozi@firstbank.com.ng"],
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "timezone": "Africa/Lagos"
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "lalt_8b9c0d1e2f3a4b5c",
    "name": "First Bank Crisis Alert",
    "type": "crisis_detection",
    "enabled": true,
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

## 8. Database Schema

### 8.1 Listening Queries Table

```sql
CREATE TABLE listening_queries (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                      VARCHAR(100) NOT NULL,
  description               TEXT,
  keywords                  TEXT[] NOT NULL,
  boolean_expression        TEXT,                          -- Full boolean expression
  platforms                 TEXT[] NOT NULL,
  languages                 TEXT[],
  countries                 TEXT[],
  min_engagement            INTEGER DEFAULT 0,
  min_influence_score       INTEGER DEFAULT 0,
  min_authority_score       INTEGER DEFAULT 0,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'archived')),
  estimated_monthly_mentions INTEGER,
  actual_monthly_mentions   INTEGER,
  precision_score           DECIMAL(3,2),
  recall_score              DECIMAL(3,2),
  noise_ratio               DECIMAL(3,2),
  created_by                VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listening_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_queries FORCE ROW LEVEL SECURITY;
CREATE POLICY lq_isolation ON listening_queries
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_lq_org ON listening_queries(organization_id);
CREATE INDEX idx_lq_status ON listening_queries(organization_id, status);
```

### 8.2 Social Mentions Table

```sql
CREATE TABLE social_mentions (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query_id                  VARCHAR(32) NOT NULL REFERENCES listening_queries(id) ON DELETE CASCADE,
  platform                  VARCHAR(20) NOT NULL
                            CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'reddit')),
  platform_mention_id       VARCHAR(255) NOT NULL,
  -- Author information
  author_id                 VARCHAR(255),
  author_username           VARCHAR(100),
  author_display_name       VARCHAR(100),
  author_followers          INTEGER DEFAULT 0,
  author_verified           BOOLEAN DEFAULT FALSE,
  author_influence_score    INTEGER DEFAULT 0,
  author_tier               VARCHAR(20)
                            CHECK (author_tier IN ('mega', 'macro', 'mid', 'micro', 'nano')),
  author_bot_probability    DECIMAL(3,2) DEFAULT 0,
  -- Content
  content                   TEXT NOT NULL,
  content_hash              VARCHAR(64),
  url                       TEXT,
  language                  VARCHAR(5),
  country                   VARCHAR(2),
  -- Sentiment
  sentiment_score           DECIMAL(3,2),
  sentiment_label           VARCHAR(20)
                            CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_confidence      DECIMAL(3,2),
  emotions                  JSONB,
  is_sarcastic              BOOLEAN DEFAULT FALSE,
  sentiment_corrected_by    VARCHAR(32) REFERENCES users(id),
  sentiment_corrected_at    TIMESTAMPTZ,
  -- Enrichment
  is_spam                   BOOLEAN DEFAULT FALSE,
  is_hidden                 BOOLEAN DEFAULT FALSE,
  is_competitive            BOOLEAN DEFAULT FALSE,
  is_crisis_signal          BOOLEAN DEFAULT FALSE,
  reach_estimate            INTEGER DEFAULT 0,
  impact_score              INTEGER DEFAULT 0,
  engagement_likes          INTEGER DEFAULT 0,
  engagement_shares         INTEGER DEFAULT 0,
  engagement_comments       INTEGER DEFAULT 0,
  media_urls                TEXT[],
  parent_mention_id         VARCHAR(32) REFERENCES social_mentions(id),
  -- Timestamps
  published_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_mention_id)
);

ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_mentions FORCE ROW LEVEL SECURITY;
CREATE POLICY sm_isolation ON social_mentions
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_sm_org ON social_mentions(organization_id, created_at DESC);
CREATE INDEX idx_sm_query ON social_mentions(query_id, created_at DESC);
CREATE INDEX idx_sm_sentiment ON social_mentions(organization_id, sentiment_label, created_at DESC);
CREATE INDEX idx_sm_platform ON social_mentions(organization_id, platform, created_at DESC);
CREATE INDEX idx_sm_influence ON social_mentions(organization_id, author_influence_score DESC);
CREATE INDEX idx_sm_crisis ON social_mentions(organization_id, is_crisis_signal, created_at DESC)
  WHERE is_crisis_signal = TRUE;
CREATE INDEX idx_sm_content_hash ON social_mentions(content_hash);
```

### 8.3 Media Articles Table

```sql
CREATE TABLE media_articles (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query_id                  VARCHAR(32) REFERENCES listening_queries(id),
  title                     TEXT NOT NULL,
  content                   TEXT,
  url                       TEXT UNIQUE NOT NULL,
  source_name               VARCHAR(255) NOT NULL,
  source_type               VARCHAR(50)
                            CHECK (source_type IN ('newspaper', 'blog', 'broadcast', 'wire', 'magazine')),
  source_authority_score    INTEGER DEFAULT 0,               -- 0–100
  author                    VARCHAR(255),
  published_at              TIMESTAMPTZ NOT NULL,
  -- Sentiment
  headline_sentiment        DECIMAL(3,2),
  body_sentiment            DECIMAL(3,2),
  overall_sentiment         DECIMAL(3,2),
  sentiment_label           VARCHAR(20)
                            CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_confidence      DECIMAL(3,2),
  -- Impact and reach
  impact_score              INTEGER DEFAULT 0,               -- 0–1000
  reach_estimate            BIGINT DEFAULT 0,
  ave_naira                 NUMERIC(15,2) DEFAULT 0,         -- ₦ AVE in NGN
  currency                  VARCHAR(3) DEFAULT 'NGN',
  social_shares             JSONB,                           -- {twitter: N, linkedin: N, facebook: N}
  -- Classification
  brand_mention_context     VARCHAR(20)
                            CHECK (brand_mention_context IN ('primary', 'passing', 'none')),
  entity_mentions           TEXT[],
  topic_category            TEXT,
  is_competitive            BOOLEAN DEFAULT FALSE,
  competitor_id             VARCHAR(32),
  is_duplicate              BOOLEAN DEFAULT FALSE,
  original_article_id       VARCHAR(32) REFERENCES media_articles(id),
  is_archived               BOOLEAN DEFAULT FALSE,
  content_hash              VARCHAR(64),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_articles FORCE ROW LEVEL SECURITY;
CREATE POLICY ma_isolation ON media_articles
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ma_org ON media_articles(organization_id, published_at DESC);
CREATE INDEX idx_ma_sentiment ON media_articles(organization_id, sentiment_label, published_at DESC);
CREATE INDEX idx_ma_source ON media_articles(organization_id, source_name);
CREATE INDEX idx_ma_impact ON media_articles(organization_id, impact_score DESC);
CREATE INDEX idx_ma_competitive ON media_articles(organization_id, is_competitive, published_at DESC);
-- Full-text search
CREATE INDEX idx_ma_fts ON media_articles
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));
```

### 8.4 Mention Tags Table

```sql
CREATE TABLE mention_tags (
  id              VARCHAR(32) PRIMARY KEY,
  mention_id      VARCHAR(32) NOT NULL REFERENCES social_mentions(id) ON DELETE CASCADE,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag             VARCHAR(50) NOT NULL,
  tagged_by       VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mention_id, tag)
);

ALTER TABLE mention_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY mt_isolation ON mention_tags
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_mt_mention ON mention_tags(mention_id);
CREATE INDEX idx_mt_tag ON mention_tags(organization_id, tag);
```

### 8.5 Listening Alerts Table

```sql
CREATE TABLE listening_alerts (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  alert_type          VARCHAR(50) NOT NULL
                      CHECK (alert_type IN (
                        'volume_spike', 'sentiment_crash', 'crisis_detection',
                        'influencer_mention', 'competitive_movement', 'viral_content', 'bot_activity'
                      )),
  enabled             BOOLEAN DEFAULT TRUE,
  threshold           DECIMAL(5,2),
  severity_minimum    INTEGER DEFAULT 2 CHECK (severity_minimum BETWEEN 1 AND 5),
  query_ids           TEXT[],
  channels            TEXT[] NOT NULL,
  recipients          TEXT[] NOT NULL,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start   TIME,
  quiet_hours_end     TIME,
  timezone            VARCHAR(100) DEFAULT 'Africa/Lagos',  -- WAT default
  last_triggered_at   TIMESTAMPTZ,
  trigger_count       INTEGER DEFAULT 0,
  created_by          VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listening_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY la_isolation ON listening_alerts
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_la_org ON listening_alerts(organization_id);
CREATE INDEX idx_la_enabled ON listening_alerts(organization_id, enabled);
```

### 8.6 Crisis Incidents Table

```sql
CREATE TABLE crisis_incidents (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  severity            INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  status              VARCHAR(20) DEFAULT 'active'
                      CHECK (status IN ('active', 'monitoring', 'resolved', 'false_positive')),
  origin_platform     VARCHAR(50),
  origin_mention_id   VARCHAR(32),
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     VARCHAR(32) REFERENCES users(id),
  resolved_at         TIMESTAMPTZ,
  resolved_by         VARCHAR(32) REFERENCES users(id),
  post_mortem_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crisis_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_incidents FORCE ROW LEVEL SECURITY;
CREATE POLICY ci_isolation ON crisis_incidents
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ci_org ON crisis_incidents(organization_id, detected_at DESC);
CREATE INDEX idx_ci_status ON crisis_incidents(organization_id, status);
```

### 8.7 Competitors Table

```sql
CREATE TABLE competitors (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  keywords        TEXT[] NOT NULL,
  category        VARCHAR(20) DEFAULT 'direct'
                  CHECK (category IN ('direct', 'indirect', 'aspirational')),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors FORCE ROW LEVEL SECURITY;
CREATE POLICY comp_isolation ON competitors
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_comp_org ON competitors(organization_id);
CREATE INDEX idx_comp_active ON competitors(organization_id, is_active);
```

### 8.8 Influencers Table

```sql
CREATE TABLE influencers (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform            VARCHAR(20) NOT NULL,
  platform_user_id    VARCHAR(255) NOT NULL,
  username            VARCHAR(100) NOT NULL,
  display_name        VARCHAR(100),
  bio                 TEXT,
  profile_image_url   TEXT,
  followers           INTEGER DEFAULT 0,
  influence_score     INTEGER DEFAULT 0,              -- 0–100
  tier                VARCHAR(20)
                      CHECK (tier IN ('mega', 'macro', 'mid', 'micro', 'nano')),
  engagement_rate     DECIMAL(5,4),
  topic_authority     JSONB,
  bot_probability     DECIMAL(3,2) DEFAULT 0,
  follower_quality_score INTEGER DEFAULT 0,           -- 0–100 authenticity
  contact_email       VARCHAR(255),
  contact_website     VARCHAR(255),
  mention_count       INTEGER DEFAULT 0,
  first_seen_at       TIMESTAMPTZ,
  last_mentioned_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_user_id)
);

ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers FORCE ROW LEVEL SECURITY;
CREATE POLICY inf_isolation ON influencers
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_inf_org ON influencers(organization_id);
CREATE INDEX idx_inf_score ON influencers(organization_id, influence_score DESC);
CREATE INDEX idx_inf_tier ON influencers(organization_id, tier);
```

---

## 9. Email Notifications

### 9.1 Alert Notification Templates

| Event | Recipient | Subject | SLA | Nigerian Context |
|-------|-----------|---------|-----|----------------|
| Volume spike detected | Configured recipients | "📈 Volume spike: [Query Name]" | < 5 minutes | Includes mention count and WAT timestamp |
| Sentiment crash | Configured recipients | "📉 Sentiment drop: [Query Name]" | < 5 minutes | Shows % change and WAT time |
| Crisis S3 detected | Configured recipients | "⚠️ Crisis Watch (S3): [Query Name]" | < 5 minutes | Severity score + recommended actions |
| Crisis S4 detected | Configured recipients | "🚨 Crisis Alert (S4): [Query Name]" | < 2 minutes | Emergency contact instructions |
| Crisis S5 detected | All Admins + configured | "🆘 CRITICAL Crisis (S5): [Query Name]" | < 2 minutes | Bypasses all quiet hours |
| Influencer mention (Macro+) | Configured recipients | "⭐ Influencer mention: @[handle]" | < 5 minutes | Tier shown (Mega/Macro); ₦ reach estimate |
| Competitive SOV change | Configured recipients | "📊 SOV change: [Your Brand] vs [Competitor]" | < 2 hours | SOV % shown in ₦ AVE terms |
| Crisis resolved | All stakeholders | "✅ Crisis resolved: [Query Name]" | < 30 minutes | WAT resolution time; post-mortem link |
| Daily digest | Subscribed users | "📋 Your daily listening digest" | 8:00 AM WAT | Summarizes 24h; all ₦ figures |
| Weekly report | Subscribed users | "📊 Weekly listening report" | Monday 8:00 AM WAT | SOV comparison; trend charts |

### 9.2 In-App Notification Events

| Event | Icon | Message | Dismissible |
|-------|------|---------|------------|
| New volume spike | 📈 | "Volume spike for [Query]: [N] mentions in last hour" | Yes |
| Sentiment drop | 📉 | "Sentiment drop for [Query]: [N]% negative increase" | Yes |
| Crisis S3+ detected | ⚠️ | "Crisis detected (S[N]/5) — [Query Name]" | No (sticky until acknowledged) |
| Influencer mention | ⭐ | "@[handle] ([Tier] influencer) mentioned your brand" | Yes |
| Competitive SOV shift | 📊 | "[Competitor] SOV changed by [N]pp" | Yes |
| Alert acknowledged | ✅ | "Crisis acknowledged by [Name]" | Yes |

---

## 10. Error Handling

### 10.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `QUERY_NOT_FOUND` | 404 | Listening query not found | Check query ID |
| `QUERY_LIMIT_REACHED` | 422 | Organization has reached the query limit for this plan | Upgrade plan or archive inactive queries |
| `INVALID_BOOLEAN_SYNTAX` | 422 | Query boolean syntax is invalid | Check operator placement |
| `NO_PLATFORMS_SELECTED` | 422 | At least one platform must be selected | Select a platform |
| `MENTION_NOT_FOUND` | 404 | Mention not found | Check mention ID |
| `COMPETITOR_LIMIT_REACHED` | 422 | Organization has reached the competitor tracking limit | Upgrade plan or remove a competitor |
| `ALERT_NOT_FOUND` | 404 | Alert configuration not found | Check alert ID |
| `EXPORT_LIMIT_EXCEEDED` | 422 | Export exceeds maximum records for this plan | Narrow date range or upgrade |
| `AUTHZ_INSUFFICIENT_PERMISSION` | 403 | You don't have permission for this action | Contact Admin |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — retry after specified time | Retry after cooldown |
| `SENTIMENT_API_TIMEOUT` | 503 | Sentiment analysis temporarily unavailable | Retry shortly; mentions queued |
| `PLATFORM_API_UNAVAILABLE` | 503 | [Platform] API temporarily unavailable | Data collection resumes automatically |
| `SEARCH_DATE_RANGE_TOO_LARGE` | 422 | Date range exceeds plan limit of [N] days | Narrow date range |
| `CRISIS_ALREADY_RESOLVED` | 409 | This crisis incident is already resolved | View post-mortem report |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Operation | Target |
|-----------|--------|
| New mention → dashboard appearance | <15 minutes (social); <15 minutes (media) |
| Sentiment analysis per mention | <2 seconds |
| Dashboard initial load | <3 seconds |
| Interactive filter application | <1 second |
| Boolean search execution | <30 seconds |
| SOV calculation update | <1 hour |
| Alert delivery (S4/S5) | <2 minutes |
| API response time P95 | <500ms |
| Data export generation | <60 seconds for 10,000 rows |

### 11.2 Accuracy

| Metric | Target |
|--------|--------|
| Mention capture rate | ≥95% of publicly available mentions |
| Sentiment accuracy (English) | ≥85% on labeled datasets |
| Sentiment accuracy (Nigerian English/Pidgin) | ≥78% |
| Deduplication rate | ≥99% |
| Named entity recognition | ≥90% |
| Bot detection | ≥95% |
| Influencer tier classification | ≥92% |
| Crisis detection lead time | ≥2 hours in 80%+ of cases |
| Alert false positive rate | <5% after 30-day learning |

### 11.3 Scale

| Metric | Capacity |
|--------|---------|
| Concurrent active queries | 10,000+ across all organizations |
| Mention processing throughput | 1M+ mentions/day |
| Simultaneous dashboard users | 500+ |
| API throughput | 10,000+ requests/minute |
| Historical data storage | Per plan limits; Petabyte-scale architecture |

### 11.4 Compliance

| Requirement | Implementation |
|-------------|---------------|
| NDPR | Nigerian user data processed in Nigeria; DSAR workflow for mention data |
| GDPR | Right to erasure for EU subjects; data portability |
| CCPA | Opt-out mechanisms; data portability |
| Platform ToS | All data collection within API terms of service |
| Privacy | No collection from private social accounts; public data only |

---

## 12. Edge Cases

### 12.1 Query Edge Cases

| Scenario | Behavior |
|----------|---------|
| Invalid boolean syntax | Real-time validation; specific error with cursor position |
| Query returns 0 mentions | Empty state with query optimization suggestions |
| Query returns unexpectedly high volume | Warning before activation; estimated cost shown |
| User exceeds query limit | Clear error with upgrade CTA and current usage |
| Same keyword in two active queries | Mentions deduplicated in analytics; counted in each query's feed |

### 12.2 Mention Edge Cases

| Scenario | Behavior |
|----------|---------|
| Mention from deleted account | Content marked `[Deleted]`; metrics preserved; engagement frozen |
| Mention in unsupported language | Processed as neutral (no sentiment); language flag shown |
| Mention is only an image (no text) | Queued for OCR processing; appears when complete |
| Platform API rate limit hit | Polling paused; retry with exponential backoff; user notified |
| Same story in 100 outlets (wire syndication) | Deduplicated to originating story; outlet count shown as metric |
| Pidgin Nigerian English mention | Best-effort sentiment; confidence score reflects uncertainty |

### 12.3 Alert Edge Cases

| Scenario | Behavior |
|----------|---------|
| S4/S5 crisis during quiet hours | Alert bypasses quiet hours; delivered immediately |
| 50 alerts fire in 1 hour | Alert deduplication; batched into 1 digest notification |
| Alert recipient is no longer an org member | Escalated to next Admin; recipient removed from alert |
| False positive crisis detected | User marks as false positive; model learns; reason logged |
| Crisis from competitor action (not own brand) | Tagged as competitive crisis; different response playbook suggested |

### 12.4 SOV Edge Cases

| Scenario | Behavior |
|----------|---------|
| All competitors have zero mentions | SOV shows 100% for own brand; footnote noting no competitor data |
| Competitor added mid-period | SOV recalculated from competitor addition date |
| Tie in SOV between brands | Both shown at same percentage; statistical significance noted |
| ₦ AVE calculation for broadcast | Uses estimated viewership × Nigerian TV advertising rates |

---

## 13. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-LISTEN-001 | Image and video content sentiment analysis (OCR + ML) | High | Phase 4 — Q4 2026 |
| FE-LISTEN-002 | Predictive crisis modeling (ML-based) | High | Phase 4 — Q4 2026 |
| FE-LISTEN-003 | Advanced topic clustering (unsupervised ML) | Medium | Phase 4 — Q4 2026 |
| FE-LISTEN-004 | Multilingual sentiment for Yoruba, Hausa, Igbo | High | Phase 8 — Q4 2027 |
| FE-LISTEN-005 | Podcast monitoring and transcription | Low | Phase 10 — Year 3 |
| FE-LISTEN-006 | Custom ML sentiment model training per organization | Low | Phase 12 — Year 3 |
| FE-LISTEN-007 | WhatsApp public channel monitoring | High | Phase 5 — Q1 2027 |
| FE-LISTEN-008 | Nairaland forum monitoring | Medium | Phase 5 — Q1 2027 |
| FE-LISTEN-009 | Nigerian TV broadcast monitoring (full transcription) | Medium | Phase 6 — Q2 2027 |
| FE-LISTEN-010 | CRM integration for influencer outreach (Salesforce, HubSpot) | Medium | Phase 7 — Q3 2027 |
| FE-LISTEN-011 | ₦ PR ROI calculator (AVE vs. campaign cost) | High | Phase 5 — Q1 2027 |

---

## 14. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Data Science Lead | _________________ | _________ | _______ |
| Design Lead | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |

---

## 15. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 1: Authentication** | Authentication required for all endpoints |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits |
| **Module 4: Engagement Hub** | Mention → conversation handoff |
| **Module 6: Analytics & Reporting** | Unified dashboards consuming listening/monitoring data |
| **Architecture** | Data pipeline architecture; RLS isolation patterns |
| **ADRs** | ADR-003 (PostgreSQL full-text search), ADR-009 (multi-tenant RLS) |
| **Database Schema** | social_mentions, media_articles, listening_queries, crisis_incidents tables |
| **Security Architecture** | NDPR compliance for mention data collection |
| **QA Strategy** | Sentiment accuracy testing; isolation tests |
| **API Reference** | Complete endpoint documentation |
| **Personas** | Ade, Chidi, Ngozi, Kemi, Tunde (all use this module) |
| **User Journeys** | Journey 3 (Media Monitoring), Journey 4 (Crisis Detection) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified Social Listening (Module 5) and Media Monitoring (Module 3) into a single Intelligence module. Merges and improves both source documents. Adds: Nigerian market calibration throughout (Pidgin English sentiment, Nigerian media source authority scores, Nigerian crisis keyword pre-sets, ₦ AVE calculations using Nigerian advertising rate cards, WAT-aware quiet hours), complete 5-level crisis severity framework with Nigerian industry examples, unified query builder covering both social and media sources, Nigerian geographic drill-down to state/city level, influencer tier classification with ₦ reach estimates, Nigerian market pre-set query templates, WhatsApp and Nairaland as future monitoring sources, post-crisis auto-report generation, complete RLS-protected database schema for all tables, and comprehensive RBAC matrix for 6-tier role system. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to query structures, sentiment models, alert logic, or Nigerian market calibrations must be reflected in this document and recorded as ADRs where they represent architectural decisions.*