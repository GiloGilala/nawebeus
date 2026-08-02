# Module 7: Analytics & Reporting

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

The Analytics & Reporting module **transforms raw social media and PR intelligence data into actionable business intelligence** through comprehensive dashboards, advanced analytics, competitive benchmarking, and customizable reporting. It integrates data from all platform modules to deliver unified insights calibrated for the Nigerian and African market — with NGN (₦) ROI calculations, WAT timezone displays, Nigerian media source intelligence, and competitive benchmarking in the Nigerian context.

This module is the **strategic intelligence center** that enables PR, marketing, and communications teams to measure performance, demonstrate ROI in Naira, and optimize brand management strategies.

### 1.2 Problem Statement

Nigerian and African brand teams struggle to extract value from their media investments because:

| Challenge | Nigerian Context |
|-----------|----------------|
| **Data fragmentation** | Metrics scattered across Meltwater, Excel, Google Analytics, and platform dashboards |
| **Vanity metrics** | Impressions and likes don't connect to ₦ business outcomes |
| **Reactive reporting** | Monthly reports produced after the fact, not when CMO needs them |
| **Manual analysis** | Teams spend hours building PowerPoint decks instead of acting on insights |
| **Competitive blindness** | No systematic view of share of voice vs. GTBank, Airtel, or Dangote |
| **Prediction gaps** | Historical reporting without forecasting for Nigerian market dynamics |
| **Stakeholder misalignment** | MD/CEO wants ₦ ROI; social team reports engagement rate |

### 1.3 Module Objectives

| Objective | Success Measure | Nigerian Context |
|-----------|-----------------|-----------------|
| **Executive visibility** | <3 second dashboard load time | MD/CEO dashboard shows ₦ ROI |
| **Actionable insights** | ≥90% insight relevance rating | Insights calibrated to Nigerian market |
| **₦ ROI demonstration** | ≥3× ROI demonstrable per quarter | All monetary values in NGN (₦) |
| **Competitive intelligence** | ≥95% competitive data completeness | Nigerian competitor benchmarking |
| **Time-to-insight** | <5 minutes from question to answer | vs. days with manual reporting |
| **Statistical rigor** | All comparative claims p<0.05 | Valid comparisons across Nigerian brands |
| **Automated distribution** | 99.9%+ report delivery success | Email delivery with ₦ figures |

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Ade** (Head of PR, Enterprise Bank) | Admin / Manager | Executive dashboard, ₦ PR impact measurement, competitive intelligence vs. Nigerian banks |
| **Chidi** (Head of Marketing, Fintech) | Admin / Manager | Campaign performance, team analytics, ₦ ROI demonstration to CFO |
| **Tunde** (Digital Analyst, FMCG) | Analyst | Deep data analysis, custom reporting, data export for Power BI |
| **Kemi** (Content Strategist, E-commerce) | Analyst | Content performance, audience insights, posting time optimization (WAT) |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client reporting, white-label reports, per-client ₦ ROI |
| **Bola** (Social Media Manager, Telecom) | Creator | Content performance, engagement analytics, platform comparison |

### 1.5 Module Scope

**In Scope:**
- Executive intelligence dashboard with real-time KPIs and ₦ ROI
- Multi-dimensional platform analytics (Twitter/X, Instagram, Facebook, LinkedIn, TikTok, YouTube)
- Nigerian media source performance analytics (Punch, BusinessDay, TechCabal, etc.)
- Advanced content intelligence and performance prediction
- Audience intelligence and behavioral segmentation
- Competitive intelligence with Nigerian brand benchmarking
- Share of Voice (SOV) calculation with ₦ AVE
- Enterprise report builder (drag-and-drop)
- Automated reporting with WAT-timezone scheduling
- Data export and BI tool integration

**Out of Scope:**
- Real-time social monitoring (Module 3 & 5 handles this; this module analyzes it)
- Engagement workflow execution (Module 6 handles this; this module reports on it)
- Content publishing (Module 4 handles this; this module analyzes performance)
- CRM record management (integrates with CRM but doesn't replace it)
- Custom ML model training by users

### 1.6 Module Position in the Platform

| Aspect | Detail |
|--------|--------|
| **Pillar** | Cross-cutting — consumes data from all modules; surfaces insights back to all |
| **Depends on** | All modules (1–6) emit events; Module 9 for alert delivery |
| **Integrates with** | All modules (consumes events, surfaces insights) |
| **External systems** | BI tools (Tableau, Power BI, Looker), data warehouses, CRM |
| **Architecture role** | Read-heavy; operates on event streams and pre-aggregated data |

---

## 2. User Stories

### 2.1 Executive / Head of PR

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-AR-01 | Head of PR | See real-time KPIs on a single dashboard with ₦ ROI | I know business health at a glance without manual compilation | P0 |
| US-AR-02 | Head of PR | View share of voice vs. key Nigerian competitors | I know exactly where First Bank stands vs. GTBank, Zenith, Access | P0 |
| US-AR-03 | Head of PR | See ₦ advertising value equivalence (AVE) for earned media | I can present tangible ₦ value to the CFO | P0 |
| US-AR-04 | Head of PR | Receive alerts for significant metric changes | I can intervene when brand health shifts | P0 |
| US-AR-05 | Head of PR | Drill from high-level metrics to the specific articles driving them | I can verify and understand the story before presenting | P1 |
| US-AR-06 | Head of PR | Get automated insights in Nigerian English-friendly language | I don't need to interpret statistical outputs | P1 |
| US-AR-07 | Head of PR | Share dashboards securely with the Group CEO | I support governance reporting without manual deck-building | P1 |

### 2.2 Marketing Manager

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-AR-09 | Head of Marketing | Track campaign performance in real-time with ₦ cost-per-engagement | I can optimize mid-flight and justify spend to finance | P0 |
| US-AR-10 | Head of Marketing | Identify top-performing content by platform | I can brief the creative team with data, not opinions | P0 |
| US-AR-11 | Head of Marketing | Compare performance across platforms (Twitter/X vs Instagram vs LinkedIn) | I allocate budget where it works in the Nigerian market | P0 |
| US-AR-12 | Head of Marketing | Track conversion attribution from social to ₦ revenue | I prove marketing value to the MD | P0 |
| US-AR-13 | Head of Marketing | Schedule automated weekly reports for stakeholders | I keep the exec team informed without manual work every Monday | P1 |

### 2.3 Data Analyst

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-AR-19 | Digital Analyst | Build custom reports with drag-and-drop interface | I serve stakeholder requests in minutes, not days | P0 |
| US-AR-20 | Digital Analyst | Create custom metrics with formula builder (e.g., ₦ ROI per platform) | I measure what matters to my organization | P0 |
| US-AR-21 | Digital Analyst | Access raw data via API for analysis in Power BI / Excel | I do deep analysis in tools I already know | P0 |
| US-AR-22 | Digital Analyst | Run statistical analyses with significance testing | My insights are rigorous enough to withstand board scrutiny | P0 |
| US-AR-23 | Digital Analyst | Build forecasts using pre-built predictive templates | I forecast next quarter's performance without coding | P1 |
| US-AR-24 | Digital Analyst | Query historical data across the full retention period | I do long-term trend analysis spanning multiple quarters | P0 |

### 2.4 Agency Client (White-Label)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-AR-35 | Agency Client | View a branded dashboard showing only my brand's data | I see my performance without accessing other clients' data | P0 |
| US-AR-36 | Agency Client | Receive monthly ₦ ROI reports on my agency's letterhead | I can present the value to my Board | P0 |
| US-AR-37 | Agency Client | Compare my performance to Nigerian industry benchmarks | I know if the agency is delivering market-rate results | P1 |

---

## 3. Functional Requirements

### 3.1 FR-AR-001: Executive Intelligence Dashboard

**Description:** Real-time executive dashboard with ₦ ROI, predictive analytics, and automated Nigerian market insights.

**Core KPI Tiles:**

| KPI | Description | Nigerian Context |
|-----|-------------|-----------------|
| Media Impressions | Estimated total readership/viewership of coverage | Reach across Nigerian publications |
| ₦ AVE (Advertising Value Equivalence) | Monetary value of earned media in NGN | Based on Nigerian rate cards |
| Share of Voice | Brand mentions as % of total category mentions | vs. named Nigerian competitors |
| Net Sentiment Score | (Positive − Negative) / Total × 100 | Calibrated for Nigerian English |
| Message Pull-Through | % of coverage mentioning key messages | Priority message tracking |
| ₦ ROI | Business value generated vs. PR investment cost | All figures in NGN |
| Engagement Rate | Total engagements / Impressions | Platform-normalized |
| Crisis Risk Score | Composite crisis signal indicator (1–5) | Nigerian crisis keyword calibration |

**Advanced Visualizations:**

| Visualization | Description | Nigerian Feature |
|--------------|-------------|-----------------|
| Sentiment trend (time-series) | 30/60/90-day trend with confidence intervals | WAT-timezone x-axis labels |
| SOV competitive chart | Stacked bar: own brand vs. competitors | Nigerian brands pre-configured |
| Media momentum tracker | Coverage velocity and acceleration | Nigerian publication authority weighting |
| Geographic heat map | Mention concentration by Nigerian state + global | State-level drill-down for Nigeria |
| ₦ ROI timeline | Monthly ₦ value of earned media vs. PR cost | NGN currency, WAT dates |
| Platform performance radar | Cross-platform engagement comparison | Nigerian platform mix |

**Dashboard Intelligence:**

- **Automated insights:** Natural language explanations of significant patterns
- **Anomaly detection:** Statistically significant deviations (z-score > 2.0) flagged automatically
- **"What changed?" explanations:** When a metric moves, the dashboard explains why
- **Goal tracking:** Progress bars toward configured ₦ targets with forecast to end of period
- **Real-time refresh:** Every 5 minutes (configurable; critical metrics push via WebSocket)
- **Role-based views:** Executive view (₦ ROI, SOV, sentiment); Manager view (campaign, team); Analyst view (raw data)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Dashboard loads all KPI tiles in <3 seconds (P95) |
| AC2 | All monetary values displayed in ₦ (NGN) |
| AC3 | All timestamps displayed in WAT (Africa/Lagos) |
| AC4 | Predictive analytics achieve ≥85% accuracy for 30-day forecasts |
| AC5 | Automated insights flag meaningful patterns with ≥90% relevance |
| AC6 | Role-based views enforce data access permissions |
| AC7 | Real-time updates visible within 5 minutes of source activity |

---

### 3.2 FR-AR-002: Nigerian Media Performance Analytics

**Description:** Deep analytics on Nigerian media coverage with ₦ AVE, source authority scoring, and journalist influence analysis.

**Nigerian Media Source Intelligence:**

| Metric | Description |
|--------|-------------|
| Source authority score (0–100) | Weighted by circulation, domain authority, journalistic credibility |
| ₦ AVE per publication | Based on current Nigerian advertising rate cards |
| Tier classification | Tier 1 (BusinessDay, Punch, Vanguard), Tier 2, Tier 3 |
| Coverage velocity | Rate of new articles per hour/day |
| Key journalist tracking | Individual journalist influence and relationship scoring |
| Brand mention context | Primary subject, passing reference, or competitive mention |

**Nigerian Publication Authority Benchmarks (Sample):**

| Publication | Type | Authority Score | ₦ Full-Page Rate |
|-------------|------|----------------|-----------------|
| BusinessDay | Business newspaper | 88 | ₦2,500,000 |
| Punch Nigeria | National newspaper | 85 | ₦2,200,000 |
| Vanguard | National newspaper | 82 | ₦1,800,000 |
| TechCabal | Tech publication | 84 | ₦1,500,000 |
| Channels TV (online) | Broadcast | 86 | ₦3,000,000 |
| Reuters Africa | International wire | 92 | ₦5,000,000+ |

**₦ AVE Calculation:**

```
₦ AVE = Source Circulation × (Nigerian Advertising Rate per Page / 1000) 
         × Space Occupied Factor × Quality Multiplier × Sentiment Multiplier

Where:
- Source Circulation: Verified Nigerian reader/viewer numbers
- Nigerian Advertising Rate: Current rate card (₦ per full-page equivalent)
- Space Occupied Factor: 1.0 (full page), 0.5 (half page), 0.25 (quarter)
- Quality Multiplier: 1.0–2.0 based on editorial quality and placement
- Sentiment Multiplier: 1.5 (positive), 1.0 (neutral), 0.5 (negative)
```

**Cross-Platform Analytics:**

- Content performance comparison: same story across Punch, TechCabal, BusinessDay
- Audience overlap analysis: which publications reach the same readers
- Platform-to-platform correlation: does Nigerian Twitter engagement predict BusinessDay pickup?
- Optimal mix recommendations: which media types work best for this brand in this sector

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | ₦ AVE calculated using current Nigerian rate cards |
| AC2 | Source authority scores updated weekly |
| AC3 | Nigerian media tier classification applied correctly |
| AC4 | Platform-specific metrics update within 15 minutes of data availability |
| AC5 | Cross-platform correlations identify meaningful patterns (p<0.05) |

---

### 3.3 FR-AR-003: Social Platform Analytics

**Description:** Deep-dive platform-specific analytics with cross-channel correlation and content optimization for Nigerian audiences.

**Platform-Specific Metrics:**

| Platform | Key Metrics | Nigerian Context |
|----------|-------------|-----------------|
| Twitter/X | Conversation network, trending hashtag participation, tweet velocity | Nigerian Twitter dynamics (#NaijaTwitter) |
| Instagram | Reels engagement decay, Story completion rate, shopping conversion | Nigerian lifestyle content performance |
| Facebook | Algorithm impact, group engagement, page reach vs. followers | Nigerian Facebook demographics |
| LinkedIn | Professional network reach, article virality, employee advocacy | Nigerian B2B and professional audience |
| TikTok | FYP penetration, sound trend participation, Nigerian creator collaboration | Nigerian Gen Z audience |
| YouTube | Audience retention curves, subscriber journey, content clustering | Nigerian video consumption patterns |

**Content Intelligence:**

| Feature | Description |
|---------|-------------|
| Performance prediction | AI score for a post before it's published |
| Element analysis | Which content elements drive Nigerian audience engagement |
| Best-time optimization | Optimal posting time in WAT based on audience activity |
| Hashtag strategy | Nigerian trending + brand + industry hashtag performance |
| Content format benchmarking | Video vs. image vs. text vs. carousel performance |
| Audience response by segment | How different Nigerian audience segments react |

**Nigerian Audience Intelligence:**

| Analysis | Description |
|----------|-------------|
| Demographic evolution | Nigerian audience age, gender, location breakdown |
| Geographic distribution | Lagos, Abuja, Port Harcourt, Kano breakdown + diaspora |
| Peak engagement times | Nigerian audience activity heatmap in WAT |
| Platform preference | Which platforms Nigerian audiences use for brand interaction |
| Language mix | English vs. Pidgin vs. regional language engagement patterns |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Nigerian audience peak times displayed in WAT |
| AC2 | Content performance predictions ≥80% accuracy for similar content types |
| AC3 | Platform-specific metrics update within 15 minutes |
| AC4 | Hashtag recommendations include Nigerian trending hashtags |
| AC5 | A/B testing framework detects ≥10% differences with 95% confidence |

---

### 3.4 FR-AR-004: Competitive Intelligence Suite

**Description:** Comprehensive competitive benchmarking against Nigerian competitors with SOV, sentiment comparison, and strategic gap analysis.

**Share of Voice (SOV) Calculation:**

```
SOV (%) = (Brand Mentions / Total Category Mentions) × 100

Where Total Category Mentions = Brand + All Configured Competitor Mentions

SOV Dimensions:
- Volume SOV: Raw mention count share
- Engagement SOV: Total engagement share  
- Reach SOV: Total audience reach share
- Sentiment-Weighted SOV: Volume × Avg Sentiment factor
- ₦ AVE SOV: Total advertising value equivalent share
```

**Nigerian Competitive Intelligence Features:**

| Feature | Description | Nigerian Example |
|---------|-------------|-----------------|
| Competitor portfolio | Direct, indirect, aspirational | First Bank vs. GTBank, Zenith, Access Bank |
| Nigerian industry benchmarks | Sector-specific performance baselines | Nigerian banking, fintech, telecom sectors |
| SOV trend analysis | Historical SOV with statistical significance | 6-month SOV movement |
| Competitor campaign detection | Identify competitor campaign launches | Detect when MTN launches new campaign |
| Sentiment gap analysis | Compare brand vs. competitor sentiment | First Bank at +0.65 vs GTBank at +0.42 |
| Strategy white space | Tactics competitors aren't using | Content format or platform gaps |

**Competitive Alerting:**

| Alert Type | Trigger | Nigerian Context |
|-----------|---------|-----------------|
| SOV shift | SOV changes >5 percentage points | "GTBank SOV up 4pp this week" |
| Competitor campaign launch | Unusual content/mention volume spike | "Airtel launched influencer program" |
| Sentiment crossover | Competitor sentiment exceeds own brand | Risk warning |
| Share of coverage spike | Competitor gains >3 Tier 1 mentions/day | "MTN in BusinessDay 3x this week" |

**Statistical Analysis Methods:**

| Test | Use Case |
|------|----------|
| Z-test | Compare two brand sentiment averages |
| Mann-Whitney U | Non-parametric comparison for small samples |
| Confidence intervals | SOV estimates with uncertainty bounds |
| Chi-square | Categorical metric comparison |
| p-value threshold | p<0.05 required for all "significant" claims |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | SOV calculations include all 5 dimensions (volume, engagement, reach, sentiment, ₦ AVE) |
| AC2 | Nigerian competitor data completeness ≥95% |
| AC3 | Statistical significance required for all "significant" claims |
| AC4 | Competitive alerts trigger within 2 hours of meaningful change |
| AC5 | ₦ AVE SOV uses Nigerian advertising rate cards |

---

### 3.5 FR-AR-005: Custom KPI Configuration & Metric Builder

**Description:** No-code custom metric builder for organization-specific KPIs, with formula validation, ₦ output support, and performance tracking.

**Custom Metric Formula Builder:**

```typescript
// Example custom metric definitions for Nigerian organizations:

// Brand Health Index (Banking sector)
BHI = (share_of_voice_percent × 0.30) 
    + (net_sentiment_score × 0.25) 
    + (tier1_coverage_count × 0.20) 
    + (positive_mention_rate × 0.15) 
    + (crisis_absence_score × 0.10)
// Output: 0–100 composite score

// PR ROI (Nigerian market)
PR_ROI = ((ave_naira + attributable_revenue_naira) / total_pr_cost_naira)
// Output: ₦ ratio (e.g., 3.2x)

// Nigerian Market Share of Voice  
NG_SOV = (brand_ng_mentions / total_category_ng_mentions) × 100
// Output: % (filtered to Nigerian sources only)

// Crisis-Adjusted Sentiment Score
CASS = net_sentiment × (1 - (crisis_signal_count / 10))
// Output: -100 to +100 adjusted score
```

**Formula Builder Features:**

| Feature | Description |
|---------|-------------|
| Function autocomplete | Suggests available metrics and functions as user types |
| Real-time validation | Checks syntax, references, and circular dependencies |
| Zero-division protection | Warns when formula could produce undefined values |
| Preview calculation | Shows current value before saving |
| ₦ currency output | Mark metric as currency; auto-formats in ₦ |
| Historical backfill | Calculate metric for past 36 months automatically |

**Pre-Built KPI Templates (Nigerian Market):**

| Template | Formula | Use Case |
|---------|---------|---------|
| ₦ PR ROI | `(ave_naira + conversions_naira) / pr_cost_naira` | Demonstrate PR value to CFO |
| Nigerian SOV | `brand_ng_mentions / total_ng_category_mentions × 100` | Nigerian-only competitive position |
| Engagement Rate (NG) | `total_engagements / nigerian_followers × 100` | Nigerian audience engagement |
| Brand Health Index | `composite(sov, sentiment, tier1, crisis_absence)` | Executive board reporting |
| Crisis Risk Score | `(negative_velocity × sov_exposure × influencer_reach) / 100` | Crisis early warning |
| ₦ Cost per Positive Mention | `pr_budget_naira / positive_mention_count` | PR efficiency |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Formula builder validates syntax in real-time with helpful error messages |
| AC2 | Custom metrics support ₦ (NGN) currency output |
| AC3 | Circular dependency detection prevents broken KPI chains |
| AC4 | Historical backfill calculates metric for past 36 months within 5 minutes |
| AC5 | Custom KPIs appear alongside system metrics in all dashboards and reports |

---

### 3.6 FR-AR-006: Enterprise Report Builder

**Description:** Drag-and-drop report builder with advanced visualizations, white-label support for Nigerian agencies, and AI-assisted narrative.

**Visualization Library:**

| Type | Use Cases |
|------|-----------|
| Line / Area chart | Sentiment trend, SOV over time, mention volume |
| Bar / Horizontal bar | Platform comparison, competitor SOV, content format performance |
| Donut / Pie chart | Media type distribution, sentiment split, geographic breakdown |
| Geographic map (Nigeria) | State-level coverage concentration, audience location |
| Network graph | Journalist influence network, mention amplification chain |
| Funnel chart | Conversion funnel from mention to ₦ revenue |
| KPI tile with sparkline | Executive summary metrics with trend |
| Data table with sorting | Top articles, top journalists, content performance ranking |
| Word cloud (sentiment-colored) | Topic prominence with positive/negative coloring |
| Heat map | Posting time performance matrix in WAT |

**Report Builder Features:**

| Feature | Description |
|---------|-------------|
| Drag-and-drop canvas | Place, resize, and reorder widgets freely |
| Multi-page reports | Unlimited pages per report |
| Cross-widget filters | Apply filters across all visualizations simultaneously |
| Template library | Pre-built templates for Nigerian PR, marketing, agency contexts |
| White-label settings | Agency logo, colors, footer, cover page branding |
| Narrative AI | Auto-generate executive summary in plain English |
| Version control | Full change history; restore any previous version |
| Sharing permissions | View-only, comment, edit per recipient |

**Nigerian-Context Report Templates:**

| Template | Audience | Key Sections |
|---------|---------|-------------|
| Monthly PR Board Report | Board / MD | ₦ AVE, SOV vs competitors, crisis summary, tier 1 coverage |
| Weekly Brand Health Brief | CMO / Head of PR | KPI tiles, sentiment trend, insight highlights |
| Agency Client Monthly Report | Ifeoma's clients | Per-client metrics, competitive positioning, WAT-dated activities |
| Campaign Post-Mortem | Campaign team | ₦ cost vs. ₦ earned, reach, message pull-through |
| Crisis Incident Report | Crisis team | Timeline, sentiment recovery, response effectiveness |
| Competitor Intelligence Brief | Strategy team | SOV trend, competitor campaign analysis, gap opportunities |

**Statistical Functions in Report Builder:**

| Function | Description |
|---------|-------------|
| Moving average | Smooth noise in time-series data |
| Period-over-period | vs. last week, vs. last month, vs. last year |
| Year-over-year | Long-term growth comparison |
| Correlation analysis | Relationship strength between two metrics (Pearson's r) |
| Significance testing | t-test or Mann-Whitney U for group comparisons |
| Regression | Trend line with R² |
| Forecasting | ARIMA-based 30/60/90-day projection |
| Confidence intervals | Uncertainty bounds on estimates |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Report builder loads with all components in <5 seconds |
| AC2 | Custom metric builder supports complex ₦ formulas with validation |
| AC3 | White-label branding fully removes Nawebeus brand from client-facing reports |
| AC4 | AI narrative generates contextually accurate Nigerian-market-relevant summaries |
| AC5 | Interactive visualizations remain performant with 100,000+ data points |
| AC6 | Statistical functions produce mathematically valid results (verified by audit) |

---

### 3.7 FR-AR-007: Automated Reporting & Distribution

**Description:** Enterprise-grade reporting automation with WAT-timezone scheduling, multi-channel delivery, and Nigerian agency white-label support.

**Scheduling Options:**

| Schedule Type | Options | Example |
|--------------|---------|---------|
| Time-based | Daily, weekly, monthly, quarterly | Every Monday 8:00 AM WAT |
| Event-triggered | On SOV change, on crisis, on campaign end | When SOV drops >5pp |
| Business calendar | Nigerian public holidays aware | Skip December 25–26, January 1 |
| Custom cron | Full cron expression support | `0 8 1 * *` (1st of month, 8 AM WAT) |
| Fiscal calendar | Nigerian fiscal year support | Quarterly to March 31 |
| Conditional | Only if significant change detected | Only if metric changes >10% |

**Multi-Channel Delivery:**

| Channel | Format | Notes |
|---------|--------|-------|
| Email | PDF attachment, link, or inline HTML | All ₦ figures correctly formatted |
| Slack | Summary card + PDF link | Nigerian teams using Slack |
| Microsoft Teams | Adaptive card + attachment | Enterprise Nigerian organizations |
| SFTP | CSV, Parquet, PDF | Data warehouse ingestion |
| WhatsApp Business | Summary message + PDF link | Year 2 — dominant Nigerian channel |
| Custom webhook | JSON payload | External system integration |

**White-Label Report Delivery (Agency Tier):**

- Agency logo on all pages
- Agency brand colors applied
- Agency contact information in footer
- "Powered by Nawebeus" removed entirely
- Client-specific custom domain for report download links
- Per-client email templates with agency signature

**Delivery Management:**

| Feature | Description |
|---------|-------------|
| Delivery confirmation | Track successful delivery per recipient |
| Read tracking | Know when CEO opened the report (email only) |
| Failed delivery retry | Exponential backoff; 3 attempts before failure alert |
| Failure escalation | Alert report owner when delivery fails |
| Bounce handling | Auto-remove invalid email addresses |
| Unsubscribe management | Respect opt-outs for non-critical reports |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Scheduled reports generate within 5 minutes of scheduled WAT time |
| AC2 | All scheduled times configurable in WAT timezone |
| AC3 | Nigerian public holidays automatically excluded when configured |
| AC4 | Multi-channel delivery achieves ≥99.9% success rate |
| AC5 | Conditional reporting correctly evaluates triggers with ≥99% accuracy |
| AC6 | White-label branding fully applied with zero Nawebeus brand leakage |

---

### 3.8 FR-AR-008: Data Export & Integration Platform

**Description:** Enterprise-grade data access with REST API, pre-built BI connectors, and data warehouse integration for Nigerian enterprise analytics.

**Export Formats:**

| Format | Use Case | Max Size |
|--------|---------|---------|
| CSV | Excel, Google Sheets | Unlimited (streaming) |
| Excel (.xlsx) | Nigerian finance teams | 1M rows |
| PDF | Presentation, archive | N/A |
| PowerPoint (.pptx) | Board presentation | N/A |
| JSON | API consumers, developers | Unlimited (streaming) |
| Parquet | Data warehouse (Snowflake, BigQuery) | Unlimited |
| XML | Legacy system integration | 100MB |

**Export Content Options:**

| Content Type | Description | Includes ₦ Fields |
|-------------|-------------|------------------|
| Raw mentions | All social mentions with metadata | — |
| Media articles | All coverage with ₦ AVE | Yes |
| Aggregated metrics | Pre-computed KPIs | Yes (₦ AVE, ROI) |
| Competitive data | SOV, sentiment, volume | Yes (₦ AVE SOV) |
| Audience data | Demographic aggregates | No PII |
| Campaign performance | Campaign-level metrics | Yes (₦ cost, ₦ ROI) |

**API Access:**

| API Feature | Description |
|------------|-------------|
| REST API | Full data access for all entities and metrics |
| Webhook out | Real-time events (insight, alert, export ready) |
| GraphQL | Flexible querying for power users |
| API keys | Organization-scoped; role-based permissions |
| Rate limiting | Per-organization limits; not per-user |
| Rate limit headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |

**Pre-Built BI Connectors:**

| Tool | Connector Type | Refreshing |
|------|---------------|-----------|
| Microsoft Power BI | REST API connector | Manual or scheduled |
| Tableau | Web data connector | Scheduled |
| Google Looker Studio | Partner connector | Automatic |
| Excel (Power Query) | REST API | Manual or scheduled |
| Snowflake | Direct SQL + nightly ETL | Nightly |
| Google BigQuery | nightly ETL via Airflow | Nightly |

**Data Governance:**

| Feature | Description |
|---------|-------------|
| PII protection | PII masked by default; requires elevated access + approval |
| Export approval workflow | Sensitive exports require Admin approval |
| Audit logging | All data access and exports logged |
| Data lineage | Track which source produced each metric |
| Retention enforcement | Auto-expire exports after 30 days |
| Usage monitoring | Per-API-key usage dashboard |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Data exports handle 10M+ records with streaming (no size error) |
| AC2 | All monetary export fields use ₦ (NGN) by default for Nigerian organizations |
| AC3 | API serves ≤100ms P95 latency at 10,000+ requests/minute |
| AC4 | PII masking applied correctly for all non-authorized users |
| AC5 | Pre-built BI connectors tested quarterly for compatibility |
| AC6 | Audit log captures 100% of data access events |

---

## 4. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-AR-01 | All monetary values displayed in ₦ (NGN) for Nigerian organizations | Nigerian market fit |
| BR-AR-02 | All timestamps displayed in WAT (Africa/Lagos) | Nigerian user context |
| BR-AR-03 | ₦ AVE calculations use current Nigerian advertising rate cards (updated quarterly) | Accuracy and credibility |
| BR-AR-04 | Statistical comparisons require n≥30 for percentage metrics | Prevent misleading small-sample insights |
| BR-AR-05 | Comparative claims (brand beats competitor) require p<0.05 significance | Prevent false competitive claims |
| BR-AR-06 | Anomaly alerts cannot be suppressed without Manager acknowledgment | Prevent alert masking |
| BR-AR-07 | Predictive forecasts must show confidence intervals, not point estimates | Honest uncertainty representation |
| BR-AR-08 | PII masked by default; elevated access requires Admin approval + audit | NDPR compliance |
| BR-AR-09 | Custom metrics scoped to organization; not shared globally without promotion | Prevent metric conflicts |
| BR-AR-10 | Analytics data retention: 36 months hot storage + 7 years cold | NDPR compliance + trend analysis |
| BR-AR-11 | Report sharing respects source data permissions (can't share unseen data) | Security by default |
| BR-AR-12 | Competitive data clearly labeled as estimates (not exact measurements) | Honesty in intelligence |
| BR-AR-13 | Anomaly detection requires ≥30 days of historical baseline data | Statistical validity |
| BR-AR-14 | Forecasts older than 30 days auto-marked as "stale" and refreshed | Prevent acting on outdated predictions |
| BR-AR-15 | Report subscriptions can be paused but not auto-deleted | Data preservation |
| BR-AR-16 | API rate limits enforced per organization (not per user) | Fair usage enforcement |

---

## 5. Permissions

### 5.1 RBAC Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Dashboards** |
| View any dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create dashboard | ✅ | ✅ | ✅ | Personal only | ✅ | ❌ |
| Edit own dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Share dashboard org-wide | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete dashboard | ✅ | ✅ | ✅ | Own only | Own only | ❌ |
| **Custom Metrics** |
| View metric catalog | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create custom metric | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit custom metric | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| Delete custom metric | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| **Reports** |
| View reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Build custom report | ✅ | ✅ | ✅ | Personal only | ✅ | ❌ |
| Schedule report | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete report | ✅ | ✅ | ✅ | Own only | Own only | ❌ |
| Configure white-label | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Alerts & Insights** |
| View insights | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configure alert rules | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| Acknowledge alerts | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Silence alert (with reason) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Competitive Intelligence** |
| View SOV and competitive data | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Add/remove tracked competitors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Data Export & API** |
| Export data (non-PII) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Export data with PII | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| API access | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create / revoke API keys | ✅ | ✅ | ✅ | ❌ | Own only | ❌ |
| Approve PII export | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 5.2 Tiered Data Access

| Tier | Data | Default Access |
|------|------|----------------|
| **Public Metrics** | Engagement counts, impressions, reach, public sentiment | All authenticated users |
| **Identifiable Data** | Author handles, public profiles, demographic aggregates | Manager and above |
| **PII / Confidential** | Email addresses, phone numbers, full names, private profile data | Admin + Compliance only |

### 5.3 Competitive Data Isolation

Competitive intelligence data is strictly segregated:
- Tagged `data_classification: competitive`
- Cannot be exported alongside customer PII in the same job
- Cannot be combined with internal customer data in reports
- Every access to competitive data logged in audit trail

---

## 6. UI Flow

### 6.1 Executive Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo] Analytics & Reporting    📅 Jul 1–21, 2026 WAT    [Export ▾]     │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ KPI Tiles ─────────────────────────────────────────────────────────┐ │
│ │  ₦ AVE Earned     │  Share of Voice  │  Net Sentiment  │  ₦ ROI    │ │
│ │  ₦42M ↑18%        │  34.2% ↑2.1pp   │  +64 ↑8pts     │  3.2× ↑   │ │
│ │  vs. prior period │  vs. GTBank 28%  │  7-day rolling  │  PR cost  │ │
│ │                                                                      │ │
│ │  Total Mentions   │  Tier 1 Coverage │  Avg Resp. Time │  Crisis   │ │
│ │  12,847 ↑12%      │  45 articles     │  47 min ↓12min  │  Risk: 1  │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌─ Automated Insights ───────────────────────────────────────────────┐  │
│ │ 💡 BusinessDay coverage up 34% this week. Top driver: digital     │  │
│ │    banking launch. Consider amplifying with LinkedIn thought       │  │
│ │    leadership.                                                     │  │
│ │ ⚠️ Negative sentiment spike on Nigerian Twitter (+15%).           │  │
│ │    Topic: transfer fees. 2 competitors responding. Recommend      │  │
│ │    proactive comms.                                               │  │
│ │ 📈 ₦ ROI up to 3.2× this month — highest since Q3 2025.          │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ ┌─ Sentiment Trend (30 days, WAT) ─┐ ┌─ Share of Voice ────────────┐  │
│ │ [Time-series chart]              │ │ [Stacked bar: 5 brands]    │  │
│ │                                  │ │ Us:     ████████ 34.2%     │  │
│ │  ────────────────── (forecast)   │ │ GTBank: ██████ 28.0%       │  │
│ │                                  │ │ Zenith: ████ 18.5%         │  │
│ │ [Drill down →]                   │ │ Access: ███ 12.1%          │  │
│ └──────────────────────────────────┘ │ Others: ██ 7.2%            │  │
│                                       └────────────────────────────┘  │
│ ┌─ Top Nigerian Coverage ──────────────────────────────────────────────┐ │
│ │ Publication       │ Articles │ Sentiment │ ₦ AVE      │ Tier      │ │
│ │ BusinessDay       │ 18       │ +0.72     │ ₦9,000,000 │ Tier 1    │ │
│ │ TechCabal         │ 12       │ +0.81     │ ₦6,000,000 │ Tier 1    │ │
│ │ Punch Nigeria     │ 10       │ +0.65     │ ₦7,500,000 │ Tier 1    │ │
│ │ Techpoint Africa  │ 8        │ +0.78     │ ₦4,000,000 │ Tier 2    │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Custom Report Builder

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Report Builder: "Monthly PR Board Report — July 2026"                   │
│ 💾 Save Draft  │  ▶ Preview  │  ⏰ Schedule  │  📤 Share               │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ Components ──┐ ┌─ Canvas ────────────────────────────────────────────┐│
│ │ 📊 KPI Tile   │ │ ┌─ ₦ AVE Earned ──────┐  ┌─ SOV Trend Chart ────┐ ││
│ │ 📈 Line Chart │ │ │ ₦42M ↑18%           │  │ [Line: 5 competitors │ ││
│ │ 📊 Bar Chart  │ │ │ vs. last month      │  │  over 6 months]      │ ││
│ │ 🗺 Map (NG)   │ │ └─────────────────────┘  └──────────────────────┘ ││
│ │ 📋 Table      │ │ ┌─ Top Coverage Table ─────────────────────────────┐ ││
│ │ ☁ Word Cloud │ │ │ Publication │ Articles │ ₦ AVE │ Sentiment        │ ││
│ │ 📝 Text Block │ │ │ BusinessDay │ 18      │ ₦9M   │ +0.72 🟢         │ ││
│ │ 🎨 AI Narrative│ │ │ TechCabal   │ 12      │ ₦6M   │ +0.81 🟢        │ ││
│ │               │ │ └──────────────────────────────────────────────────┘ ││
│ │ ⚙ Filters    │ │ ┌─ Nigerian Geographic Distribution ──────────────┐  ││
│ │ 📑 Templates  │ │ │ [Heat map: Nigerian states + diaspora]         │  ││
│ │               │ │ │ Lagos 45% │ Abuja 25% │ Port Harcourt 15%     │  ││
│ └───────────────┘ │ └────────────────────────────────────────────────┘  ││
│                   │ ✨ AI Narrative: "In July 2026, First Bank of        ││
│                   │    Nigeria achieved ₦42M in earned media value,     ││
│                   │    a 18% increase driven by the digital banking..."  ││
│                   └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Competitive Intelligence View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Competitive Intelligence   📅 Last 90 days WAT   [+ Add Competitor]     │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ SOV Trend ─────────────────────────────────────────────────────────┐ │
│ │ [Multi-line chart: 5 Nigerian banks over 90 days in WAT]            │ │
│ │ First Bank: ──── │ GTBank: ─ ─ ─ │ Zenith: ─·─·─ │ Access: ─··─   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌─ Metric Comparison Matrix ────────────────────────────────────────────┐ │
│ │ Metric          │ First Bank  │ GTBank  │ Zenith  │ Access  │ Sig   │ │
│ │ SOV             │ 34.2% 🔵   │ 28.0%   │ 18.5%   │ 12.1%  │ ***   │ │
│ │ ₦ AVE           │ ₦42M 🔵    │ ₦35M    │ ₦22M    │ ₦14M   │ ***   │ │
│ │ Engagement Rate │ 4.8% 🔵    │ 3.2%    │ 5.1% 🟡│ 2.8%   │ **    │ │
│ │ Net Sentiment   │ +64 🔵     │ +45     │ +52     │ +38    │ *     │ │
│ │ Tier 1 Coverage │ 45 🔵      │ 38      │ 29      │ 22     │ **    │ │
│ │ 🔵 Leader  🟡 Notable  * p<0.05  ** p<0.01  *** p<0.001            │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌─ AI-Identified Opportunities ────────────────────────────────────────┐ │
│ │ 💡 GTBank has higher posting frequency but lower engagement.        │ │
│ │    Opportunity: Quality-over-quantity positioning on LinkedIn.      │ │
│ │ 💡 Zenith leads on engagement rate (5.1%) but trails on SOV.        │ │
│ │    Investigation: Are they engaging a narrow but loyal audience?    │ │
│ │ 💡 Access Bank underutilizing TechCabal — strong opportunity        │ │
│ │    to capture Nigerian fintech media share.                        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Recent Movements:                                                        │
│ ⚠️ GTBank launched influencer program (detected 2h ago, WAT)                 │
│ ⚠️ Zenith SOV up 2.3pp this week (statistically significant, p<0.05)  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Custom Metric Builder

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Custom KPI: "₦ PR ROI (Nigerian Market)"                    [Save KPI] │
├──────────────────────────────────────────────────────────────────────────┤
│ Name: [pr_roi_naira]                                                     │
│ Description: [Total ₦ value generated per ₦ invested in PR activities]  │
│ Category: [Financial] ▾    Output type: [₦ Currency] ▾                  │
│                                                                          │
│ Formula:                                                                 │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ (ave_naira + attributable_revenue_naira) / total_pr_cost_naira       │ │
│ │                                                                      │ │
│ │ [Valid ✓]  Auto-complete: ave_naira, attributable_revenue_naira...  │ │
│ │ ⚠ Division safety: IF(total_pr_cost_naira = 0, 0, formula)          │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Validations:                                                             │
│ ✅ Formula parses correctly                                               │
│ ✅ All referenced metrics exist                                           │
│ ✅ No circular dependencies                                               │
│ ⚠️ Zero-division risk — auto-protected with IF() wrapper                │
│                                                                          │
│ Preview (Last 30 days):                                                  │
│ ₦ PR ROI = 3.2× [₦42,000,000 + ₦0 / ₦13,125,000]                      │
│ [Show calculation breakdown]                                             │
│                                                                          │
│ Historical backfill: [Calculate for last 36 months ▾]                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. API Reference

### 7.1 Analytics Endpoints

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| `GET` | `/api/v1/analytics/dashboards` | ✅ | Analyst+ | List dashboards |
| `GET` | `/api/v1/analytics/dashboards/:id` | ✅ | Analyst+ | Get dashboard with data |
| `POST` | `/api/v1/analytics/dashboards` | ✅ | Analyst+ | Create dashboard |
| `PATCH` | `/api/v1/analytics/dashboards/:id` | ✅ | Analyst+ | Update dashboard |
| `DELETE` | `/api/v1/analytics/dashboards/:id` | ✅ | Manager+ | Delete dashboard |
| `POST` | `/api/v1/analytics/dashboards/:id/share` | ✅ | Manager+ | Share dashboard |
| `GET` | `/api/v1/analytics/metrics` | ✅ | Analyst+ | List metric catalog |
| `POST` | `/api/v1/analytics/metrics/custom` | ✅ | Analyst+ | Create custom metric |
| `PATCH` | `/api/v1/analytics/metrics/custom/:id` | ✅ | Analyst+ | Update custom metric |
| `POST` | `/api/v1/analytics/metrics/:id/calculate` | ✅ | Analyst+ | Calculate metric value |
| `GET` | `/api/v1/analytics/reports` | ✅ | Analyst+ | List reports |
| `POST` | `/api/v1/analytics/reports` | ✅ | Analyst+ | Create report |
| `POST` | `/api/v1/analytics/reports/:id/run` | ✅ | Analyst+ | Run report |
| `POST` | `/api/v1/analytics/reports/:id/schedule` | ✅ | Analyst+ | Schedule report |
| `GET` | `/api/v1/analytics/insights` | ✅ | Analyst+ | Get automated insights |
| `POST` | `/api/v1/analytics/insights/:id/acknowledge` | ✅ | Analyst+ | Acknowledge insight |
| `GET` | `/api/v1/analytics/alerts` | ✅ | Analyst+ | List alert rules |
| `POST` | `/api/v1/analytics/alerts` | ✅ | Analyst+ | Create alert rule |
| `POST` | `/api/v1/analytics/alerts/:id/acknowledge` | ✅ | Analyst+ | Acknowledge alert |
| `GET` | `/api/v1/analytics/competitive/sov` | ✅ | Analyst+ | Get SOV data |
| `GET` | `/api/v1/analytics/competitive/comparison` | ✅ | Analyst+ | Competitive metrics |
| `GET` | `/api/v1/analytics/competitive/gaps` | ✅ | Analyst+ | Gap opportunities |
| `POST` | `/api/v1/analytics/exports` | ✅ | Analyst+ | Create export job |
| `GET` | `/api/v1/analytics/exports/:id` | ✅ | Analyst+ | Get export status |
| `GET` | `/api/v1/analytics/exports/:id/download` | ✅ | Analyst+ | Download export |

### 7.2 Response Examples

**Executive Dashboard:**

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
    "kpis": [
      {
        "id": "kpi_ave_naira",
        "name": "₦ AVE Earned",
        "value": 42000000,
        "currency": "NGN",
        "formattedValue": "₦42,000,000",
        "change": 18.3,
        "changeDirection": "up",
        "vsTarget": 105,
        "sparkline": [38000000, 39500000, 41000000, 42000000]
      },
      {
        "id": "kpi_sov",
        "name": "Share of Voice",
        "value": 34.2,
        "unit": "percent",
        "change": 2.1,
        "changeDirection": "up",
        "leadingCompetitor": { "name": "GTBank", "value": 28.0 }
      },
      {
        "id": "kpi_roi_naira",
        "name": "₦ PR ROI",
        "value": 3.2,
        "currency": "NGN",
        "formattedValue": "3.2× ROI",
        "change": 0.4,
        "changeDirection": "up"
      }
    ],
    "insights": [
      {
        "id": "insi_8b9c0d1e",
        "type": "trend",
        "title": "BusinessDay coverage up 34% this week",
        "description": "Top driver: digital banking launch announcement. Consider amplifying with LinkedIn thought leadership.",
        "severity": "positive",
        "confidence": 0.91,
        "createdAt": "2026-07-21T08:00:00+01:00"
      }
    ]
  }
}
```

**Competitive SOV Report:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "period": { "start": "2026-04-21", "end": "2026-07-21", "timezone": "Africa/Lagos" },
    "shareOfVoice": [
      {
        "brand": "First Bank of Nigeria",
        "volumeSovPercent": 34.2,
        "engagementSovPercent": 38.5,
        "reachSovPercent": 31.8,
        "aveSovPercent": 35.4,
        "aveNaira": 42000000,
        "currency": "NGN",
        "avgSentiment": 0.64,
        "sovChange": 2.1,
        "isOwnBrand": true
      },
      {
        "brand": "GTBank",
        "volumeSovPercent": 28.0,
        "engagementSovPercent": 25.3,
        "reachSovPercent": 29.1,
        "aveSovPercent": 29.0,
        "aveNaira": 35000000,
        "currency": "NGN",
        "avgSentiment": 0.45,
        "sovChange": -0.8,
        "isOwnBrand": false
      }
    ],
    "statisticalSignificance": {
      "firstBankVsGTBank": { "pValue": 0.003, "significant": true }
    }
  }
}
```

**Create Custom Metric:**

```http
POST /api/v1/analytics/metrics/custom
Content-Type: application/json

{
  "name": "pr_roi_naira",
  "displayName": "₦ PR ROI (Nigerian Market)",
  "description": "Total ₦ value generated per ₦ invested in PR activities",
  "category": "financial",
  "formula": "IF(total_pr_cost_naira = 0, 0, (ave_naira + attributable_revenue_naira) / total_pr_cost_naira)",
  "dataType": "currency",
  "currency": "NGN",
  "decimals": 1,
  "aggregationMethod": "last",
  "backfillMonths": 36
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "metric_pr_roi_naira",
    "name": "pr_roi_naira",
    "displayName": "₦ PR ROI (Nigerian Market)",
    "currentValue": 3.2,
    "currency": "NGN",
    "formattedValue": "3.2×",
    "formulaValid": true,
    "backfillStatus": "queued",
    "createdAt": "2026-07-21T10:30:00+01:00"
  }
}
```

---

## 8. Database Schema

### 8.1 Core Tables

```sql
-- Analytics dashboards
CREATE TABLE analytics_dashboards (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  layout          JSONB NOT NULL,           -- widget positions and configurations
  filters         JSONB,                    -- default filter state
  refresh_interval_seconds INTEGER DEFAULT 300,
  is_shared       BOOLEAN DEFAULT FALSE,
  shared_with     JSONB,                    -- user/team IDs with permissions
  created_by_id   VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards FORCE ROW LEVEL SECURITY;
CREATE POLICY ad_isolation ON analytics_dashboards
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ad_org ON analytics_dashboards(organization_id) WHERE deleted_at IS NULL;

-- Custom and system metrics catalog
CREATE TABLE analytics_metrics (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL for system metrics
  name                VARCHAR(100) NOT NULL,
  display_name        VARCHAR(200) NOT NULL,
  description         TEXT,
  category            VARCHAR(50),
  formula             TEXT,                 -- for custom metrics
  data_type           VARCHAR(20) NOT NULL
                      CHECK (data_type IN ('number', 'percentage', 'currency', 'duration', 'count', 'ratio')),
  currency            VARCHAR(3) DEFAULT 'NGN',   -- Nigerian Naira default
  decimals            INTEGER DEFAULT 2,
  aggregation_method  VARCHAR(20) DEFAULT 'last'
                      CHECK (aggregation_method IN ('sum', 'avg', 'count', 'min', 'max', 'last')),
  is_system           BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_by_id       VARCHAR(32) REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY am_isolation ON analytics_metrics
  USING (organization_id = current_setting('app.current_org_id', true) OR is_system = TRUE);

CREATE INDEX idx_am_org ON analytics_metrics(organization_id) WHERE is_active = TRUE;

-- Reports
CREATE TABLE analytics_reports (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  config                JSONB NOT NULL,             -- report definition (pages, widgets, data sources)
  template_id           VARCHAR(32),
  is_scheduled          BOOLEAN DEFAULT FALSE,
  schedule_config       JSONB,                      -- cron, timezone (Africa/Lagos), recipients
  recipients            JSONB,
  last_run_at           TIMESTAMPTZ,
  last_run_status       VARCHAR(20),
  -- White-label (Agency tier)
  is_white_label        BOOLEAN DEFAULT FALSE,
  white_label_config    JSONB,                      -- logo, colors, footer, cover
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY ar_isolation ON analytics_reports
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ar_org ON analytics_reports(organization_id);
CREATE INDEX idx_ar_scheduled ON analytics_reports(is_scheduled) WHERE is_scheduled = TRUE;

-- Alert rules
CREATE TABLE analytics_alerts (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(100) NOT NULL,
  metric_id             VARCHAR(32) REFERENCES analytics_metrics(id),
  condition             JSONB NOT NULL,             -- threshold, comparison, anomaly detection
  comparison_period     VARCHAR(50),
  notification_channels JSONB NOT NULL,
  recipients            JSONB NOT NULL,
  is_active             BOOLEAN DEFAULT TRUE,
  cooldown_minutes      INTEGER DEFAULT 60,
  last_triggered_at     TIMESTAMPTZ,
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY aal_isolation ON analytics_alerts
  USING (organization_id = current_setting('app.current_org_id', true));

-- Automated insights
CREATE TABLE analytics_insights (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insight_type      VARCHAR(30) NOT NULL
                    CHECK (insight_type IN ('trend', 'anomaly', 'opportunity', 'competitive', 'forecast', 'risk')),
  title             VARCHAR(255) NOT NULL,
  description       TEXT NOT NULL,
  related_metrics   TEXT[],
  supporting_data   JSONB,
  confidence        DECIMAL(3,2),
  relevance_score   DECIMAL(3,2),
  severity          VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  -- ₦ impact (where applicable)
  estimated_naira_impact NUMERIC(15,2),
  currency          VARCHAR(3) DEFAULT 'NGN',
  valid_from        TIMESTAMPTZ NOT NULL,
  valid_until       TIMESTAMPTZ,
  is_acknowledged   BOOLEAN DEFAULT FALSE,
  acknowledged_by_id VARCHAR(32) REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_isolation ON analytics_insights
  USING (organization_id = current_setting('app.current_org_id', true));

-- Data exports
CREATE TABLE analytics_exports (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(200),
  data_scope            JSONB NOT NULL,             -- entities, filters, time range
  format                VARCHAR(20) NOT NULL
                        CHECK (format IN ('csv', 'json', 'parquet', 'excel', 'pdf', 'pptx', 'xml')),
  status                VARCHAR(20) DEFAULT 'queued'
                        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'expired')),
  progress_percent      INTEGER DEFAULT 0,
  row_count             BIGINT,
  file_size_bytes       BIGINT,
  download_url          TEXT,
  download_expires_at   TIMESTAMPTZ,
  contains_pii          BOOLEAN DEFAULT FALSE,
  pii_acknowledgment    JSONB,                      -- approver, reason, timestamp
  -- All monetary fields in NGN
  currency              VARCHAR(3) DEFAULT 'NGN',
  requested_by_id       VARCHAR(32) NOT NULL REFERENCES users(id),
  approved_by_id        VARCHAR(32) REFERENCES users(id),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ
);

ALTER TABLE analytics_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_exports FORCE ROW LEVEL SECURITY;
CREATE POLICY ae_isolation ON analytics_exports
  USING (organization_id = current_setting('app.current_org_id', true));
```

### 8.2 Time-Series Analytics Store

```sql
-- High-performance time-series events (partitioned by month)
CREATE TABLE analytics_events (
  id                BIGSERIAL,
  organization_id   UUID NOT NULL,
  event_type        VARCHAR(100) NOT NULL,
  event_timestamp   TIMESTAMPTZ NOT NULL,
  source_module     VARCHAR(50) NOT NULL,
  entity_type       VARCHAR(50),
  entity_id         VARCHAR(100),
  properties        JSONB NOT NULL DEFAULT '{}',
  -- ₦ monetary fields
  naira_amount      NUMERIC(15,2),                  -- For ₦-valued events
  currency          VARCHAR(3) DEFAULT 'NGN',
  created_at        TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (event_timestamp);

-- Monthly partitions (auto-created by background job)
CREATE TABLE analytics_events_2026_07 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Pre-aggregated daily metrics (powers fast dashboard load)
CREATE TABLE analytics_daily_metrics (
  organization_id   UUID NOT NULL,
  date              DATE NOT NULL,
  platform          VARCHAR(50),
  metric_name       VARCHAR(100) NOT NULL,
  dimension_1       VARCHAR(100),                   -- e.g., campaign_id, content_type
  dimension_2       VARCHAR(100),
  dimension_3       VARCHAR(100),
  value             DECIMAL(20,4) NOT NULL,
  -- ₦ monetary values stored as NUMERIC(15,2)
  naira_value       NUMERIC(15,2),
  currency          VARCHAR(3) DEFAULT 'NGN',
  sample_size       INTEGER,
  last_computed_at  TIMESTAMPTZ,
  PRIMARY KEY (organization_id, date, platform, metric_name, dimension_1, dimension_2, dimension_3)
);

-- Critical performance indexes
CREATE INDEX idx_events_org_time ON analytics_events(organization_id, event_timestamp DESC);
CREATE INDEX idx_events_type_time ON analytics_events(event_type, event_timestamp DESC);
CREATE INDEX idx_daily_org_date ON analytics_daily_metrics(organization_id, date DESC, metric_name);
CREATE INDEX idx_daily_platform ON analytics_daily_metrics(organization_id, platform, date DESC)
  WHERE platform IS NOT NULL;

-- Competitor snapshots with ₦ AVE
CREATE TABLE competitive_metrics_snapshot (
  id              VARCHAR(32) PRIMARY KEY,
  competitor_id   VARCHAR(32) NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  platform        VARCHAR(20),
  followers       BIGINT,
  posting_freq    DECIMAL(5,2),
  engagement_rate DECIMAL(6,4),
  sentiment_score DECIMAL(3,2),
  sov_percent     DECIMAL(5,2),
  ave_naira       NUMERIC(15,2),                    -- ₦ AVE for competitor
  currency        VARCHAR(3) DEFAULT 'NGN',
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competitor_id, date, platform)
);

CREATE INDEX idx_comp_snap_date ON competitive_metrics_snapshot(competitor_id, date DESC);
```

### 8.3 Data Retention

| Data Type | Hot Storage | Cold Storage | Notes |
|-----------|------------|-------------|-------|
| Dashboard configurations | Indefinite | — | User-created content |
| Custom metrics | Indefinite | — | Reused across reports |
| Report configurations | Indefinite | — | User-created content |
| Time-series events | 36 months | 7 years | NDPR compliance |
| Daily pre-aggregated metrics | 36 months | Indefinite | Dashboard performance |
| Automated insights | 12 months | 3 years | ML training + reference |
| Alert history | 2 years | 7 years | Audit |
| Competitive snapshots | 36 months | 7 years | Trend analysis |
| Export files | 30 days (auto-expire) | — | Storage management |
| Export metadata | 1 year | 7 years | Audit |
| Audit log | 7 years | — | NDPR compliance |

---

## 9. Email Notifications

### 9.1 Analytics Alert Notifications

| Event | Recipient | Subject | SLA | Nigerian Context |
|-------|-----------|---------|-----|-----------------|
| Metric threshold breach | Alert recipients | "⚠️ KPI Alert: [Metric] — [Value] ₦" | <1 minute | ₦ values in subject line |
| Anomaly detected (high) | Alert recipients + Manager | "🚨 Anomaly: [Metric] — unusual pattern detected" | <5 minutes | WAT timestamp |
| Competitive SOV shift | Configured recipients | "📊 Competitive movement: [Competitor] SOV up [N]pp" | <2 hours | Nigerian competitor name |
| Crisis risk escalation | On-call + Manager | "🔴 Crisis risk elevated: First Bank" | <2 minutes | Nigerian context |
| Forecast confidence drop | Dashboard owner | "📉 Forecast accuracy declining for [Metric]" | Daily digest | — |
| Export completed | Requester | "✅ Your export is ready: [Export Name]" | <30 minutes | ₦ figures in preview |
| Export failed | Requester + Admin | "❌ Export failed: [Export Name]" | <5 minutes | — |
| Scheduled report delivered | Report recipients | "📊 Report delivered: [Report Name]" | Per schedule | WAT delivery time |
| Report delivery failure | Report owner | "⚠️ Report delivery failed: [Report Name]" | <5 minutes | — |
| Weekly ₦ ROI digest | Subscribed users | "📈 Weekly ₦ ROI summary — w/e [date WAT]" | Monday 8:00 AM WAT | All ₦ figures |
| Monthly competitive brief | Configured users | "📊 Monthly competitive intelligence — [Month]" | 1st of month, 8:00 AM WAT | Nigerian brands |

### 9.2 In-App Notifications

| Event | Message | Dismissible |
|-------|---------|------------|
| New automated insight (high) | "💡 New insight: [Title]" | Yes |
| Competitive movement alert | "⚠️ [Competitor] SOV change detected" | Yes |
| Export ready | "✅ Your export is ready to download" | Yes |
| Scheduled report sent | "📊 [Report Name] delivered to [N] recipients" | Yes |
| Anomaly detected | "🚨 Anomaly detected in [Metric]" | No (sticky) |
| KPI goal achieved | "🎉 ₦ PR ROI target achieved: 3.2×!" | Yes |

---

## 10. Error Handling

### 10.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `AR_DASHBOARD_NOT_FOUND` | 404 | Dashboard not found or no access | Check ID or permissions |
| `AR_DASHBOARD_TOO_LARGE` | 422 | Dashboard exceeds 50-widget limit | Split into multiple dashboards |
| `AR_FORMULA_INVALID` | 422 | Custom metric formula has syntax errors | Review formula; use autocomplete |
| `AR_FORMULA_CIRCULAR` | 422 | Formula creates circular dependency | Break the dependency chain |
| `AR_INSUFFICIENT_DATA` | 422 | Not enough data (n<30) for statistical analysis | Extend date range or wait for more data |
| `AR_FORECAST_UNAVAILABLE` | 422 | Forecasting requires 30+ days of historical data | Collect more baseline data first |
| `AR_QUERY_TIMEOUT` | 504 | Query exceeded 60-second timeout | Add filters or narrow date range |
| `AR_PII_NOT_AUTHORIZED` | 403 | PII export requires Admin approval | Request access from Admin |
| `AR_EXPORT_QUOTA_EXCEEDED` | 422 | Monthly export quota reached | Upgrade plan or wait for reset |
| `AR_COMPETITIVE_FORBIDDEN` | 403 | Cannot combine competitive + customer PII data | Use separate reports |
| `AR_API_KEY_INVALID` | 401 | API key revoked or expired | Generate new API key |
| `AR_RATE_LIMIT_EXCEEDED` | 429 | API rate limit exceeded | Implement exponential backoff |
| `AR_DATA_STALE` | 200 | Data older than expected refresh window | Check pipeline status |
| `AR_REPORT_GENERATION_FAILED` | 500 | Report generation encountered an error | Retry; contact support with report ID |

### 10.2 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Data pipeline down | Show last cached data with "Data as of [WAT timestamp]" indicator |
| ML prediction service down | Hide predictive insights; show "Predictions temporarily unavailable" |
| Statistical service down | Disable significance testing; show raw comparisons without p-values |
| Specific widget fails | Show error in that widget only; rest of dashboard functions |
| Slow query (>30s) | Show progress spinner; auto-cancel at 60s; suggest filter narrowing |
| Competitive data unavailable | Show "Data collecting" for new competitors; existing data still shows |
| Export service degraded | Queue exports; deliver when service recovers; notify user |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Executive dashboard load (P95) | <3 seconds |
| Report builder load | <5 seconds |
| Custom metric calculation | <10 seconds |
| Alert triggering | Within 1 minute of condition |
| Insight generation | Within 5 minutes of source event |
| API response time (P95) | <100ms |
| Data export (10M rows) | <30 minutes (streaming) |
| Competitive SOV update | Within 1 hour of new mentions |
| Scheduled report generation | Within 5 minutes of scheduled WAT time |

### 11.2 Statistical Standards

| Standard | Requirement |
|----------|------------|
| Significance threshold | p < 0.05 for all "significant" claims |
| Minimum sample size | n ≥ 30 for percentage metrics |
| Forecast accuracy | ≥85% for 30-day projections |
| Confidence intervals | Required on all forecasts |
| Anomaly detection baseline | ≥30 days of historical data |
| Competitive comparison validity | Same time period; same source methodology |

### 11.3 Nigerian Market Compliance

| Requirement | Implementation |
|-------------|---------------|
| All monetary values in ₦ (NGN) | `NUMERIC(15,2)` storage; ₦ symbol in display |
| All timestamps in WAT | `Africa/Lagos` default; all time displays in WAT |
| NDPR data retention | 7-year cold storage; 36-month hot storage |
| ₦ AVE rate cards | Quarterly update process; Nigerian publication rates |
| Nigerian competition law | Competitive data clearly labeled as estimates |

---

## 12. Edge Cases

| ID | Scenario | Behavior |
|----|----------|---------|
| EC-01 | User creates custom metric referencing a deleted field | Save blocked; if retroactively deleted, show "broken" badge with instructions |
| EC-02 | Dashboard with 50 widgets on mobile | Prioritized rendering; non-critical widgets load progressively |
| EC-03 | Two users edit same dashboard simultaneously | Optimistic locking; second user gets conflict diff with merge options |
| EC-04 | Scheduled report recipients' emails all invalid | Alert report owner; delivery fails gracefully; not retried |
| EC-05 | Forecast covers known anomaly period (e.g., election disruption) | Anomaly-adjusted forecast; flag in UI with explanation |
| EC-06 | ₦ rate card not available for obscure publication | Fallback to circulation × industry average rate; clearly labeled |
| EC-07 | Competitive data not yet available for newly added competitor | "Data collecting" state; minimum 7 days before full metrics available |
| EC-08 | Export runs out of allocated storage mid-process | Cancel cleanly; partial output not delivered; notify user with size guidance |
| EC-09 | Custom metric formula produces negative ₦ value | Show with warning; tooltip explains possible data issue |
| EC-10 | All competitors have 0 mentions in a period | SOV shows 100% for own brand; footnote explaining no competitor data |
| EC-11 | User views dashboard for date range before Nawebeus was set up | Empty state with earliest available data suggestion |
| EC-12 | Nigerian public holiday falls on scheduled report day | Skip if configured; deliver next business day; or deliver regardless |
| EC-13 | SOV calculation includes mentions from deleted competitor | Recalculate retroactively; log adjustment |
| EC-14 | Anomaly detected during planned downtime (known maintenance) | Tag as "expected"; suppress alert if admin pre-configured maintenance window |
| EC-15 | Report contains widget for deprecated metric | Show "metric unavailable" placeholder; preserve report structure |

---

## 13. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-AR-01 | Natural language query ("Show me last month's ₦ AVE by Nigerian publication") | 🔴 High | Phase 6 — Q2 2027 |
| FE-AR-02 | Integration with Power BI and Tableau (pre-built connectors) | 🔴 High | Phase 5 — Q1 2027 |
| FE-AR-03 | AI-powered full report narrative generation | 🔴 High | Phase 6 — Q2 2027 |
| FE-AR-04 | WhatsApp Business report delivery (Nigerian dominant channel) | 🔴 High | Phase 5 — Q1 2027 |
| FE-AR-05 | Embedded analytics SDK for Nigerian agency client portals | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-AR-06 | Scenario planning ("What if we increase PR budget by ₦5M?") | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-AR-07 | Nigerian industry benchmark marketplace (anonymized peer data) | 🟡 Medium | Phase 8 — Q4 2027 |
| FE-AR-08 | Advanced multi-touch ₦ attribution modeling | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-AR-09 | Real-time collaborative dashboards (Google Docs-style editing) | 🟢 Low | Phase 8 — Q4 2027 |
| FE-AR-10 | Predictive ₦ budget optimization recommendations | 🟡 Medium | Phase 6 — Q2 2027 |

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

## 15. Appendix: Statistical Formulas Reference

| Metric | Formula | Use Case |
|--------|---------|---------|
| **₦ AVE** | `Circulation × Rate/1000 × Space × Quality × Sentiment multiplier` | Nigerian media value |
| **Share of Voice** | `(Brand Mentions / Total Category Mentions) × 100` | Competitive position |
| **Net Sentiment** | `(Positive − Negative) / Total × 100` | Brand perception index |
| **Engagement Rate** | `(Total Engagements / Impressions) × 100` | Content performance |
| **₦ PR ROI** | `(₦ AVE + ₦ Revenue Attributed) / ₦ PR Cost` | Investment justification |
| **Z-Score (Anomaly)** | `(Value − Mean) / StdDev` | Anomaly detection (alert if >2σ) |
| **Confidence Interval (95%)** | `Mean ± 1.96 × (StdDev / √n)` | Forecast uncertainty |
| **Pearson Correlation** | `cov(X,Y) / (σX × σY)` | Metric relationship strength |
| **T-Test (two-sample)** | `(M1 − M2) / √(s1²/n1 + s2²/n2)` | Comparing brand vs. competitor |
| **Moving Average** | `AVG(values in window)` | Trend smoothing |
| **YoY Growth** | `((Current − Prior Year) / Prior Year) × 100` | Year-over-year |

---

## 16. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 3 & 5: Listening & Monitoring** | Primary data source for mentions, sentiment, media coverage, ₦ AVE |
| **Module 4: Social Publishing** | Content performance data source |
| **Module 6: Engagement Hub** | Engagement metrics, team performance, ₦ ROI data source |
| **Architecture** | Event-driven data pipeline; RLS isolation; data warehouse design |
| **ADRs** | ADR-003 (PostgreSQL time-series), ADR-009 (RLS) |
| **Database Schema** | analytics_dashboards, analytics_daily_metrics, competitive_metrics_snapshot tables |
| **Engineering Standards** | ₦ currency conventions; WAT timezone defaults; statistical validity requirements |
| **QA Strategy** | Statistical audit requirements; ₦ calculation testing; performance benchmarks |
| **API Reference** | Complete analytics endpoint documentation |
| **Security Architecture** | NDPR compliance; PII protection; competitive data isolation |
| **Personas** | Ade (PR Head), Chidi (Marketing Head), Tunde (Analyst), Ifeoma (Agency) |
| **User Journeys** | Journey 7 (Analytics & Reporting), Journey 9 (Competitive Intelligence) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified and expanded Analytics & Reporting module. Merges and improves both source documents. Adds: Nigerian market analytics throughout (₦ AVE with Nigerian rate cards, ₦ ROI calculations in NGN, WAT timezone in all dashboard and scheduling displays, Nigerian publication authority scores, Nigerian competitive benchmarking for banking/fintech/telecom sectors, Nigerian media tier classification, Nigerian public holiday schedule awareness), complete ₦ metric formula templates (₦ PR ROI, Nigerian SOV, ₦ cost-per-mention, Brand Health Index), 6-tier RBAC matrix, complete RLS-protected database schema with NGN monetary fields as NUMERIC(15,2), WAT-aware scheduled reporting, WhatsApp Business as future delivery channel, Nigerian industry benchmark marketplace as future enhancement, and statistical formula reference with Nigerian market examples. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to metric definitions, ₦ calculation methodologies, or Nigerian market calibrations must be reflected in this document before implementation begins.*