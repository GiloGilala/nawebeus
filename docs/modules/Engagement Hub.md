# Module 6: Engagement Hub

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

The Engagement Hub is the **central command center for all social media and digital engagement activities** on the Nawebeus platform. It provides a unified interface for Nigerian and African brand teams to manage conversations across multiple platforms — transforming fragmented, reactive social engagement into a strategic, coordinated capability that builds brand loyalty and drives measurable business outcomes.

The module combines real-time message aggregation, intelligent routing, collaborative workflows, AI-assisted response composition, and comprehensive analytics to enable teams to handle high message volumes efficiently while maintaining brand voice, meeting SLAs, and demonstrating ROI — all calibrated for the Nigerian market context, WAT timezone, and NGN (₦) currency.

### 1.2 Problem Statement

Social media and digital engagement teams in Nigeria face critical challenges:

| Challenge | Nigerian Context |
|-----------|----------------|
| **Platform fragmentation** | Messages arrive across Twitter/X, Instagram, Facebook, LinkedIn, TikTok — each with its own UI and API quirks |
| **Response delays** | Nigerian customers expect responses within minutes; missed responses erode brand trust rapidly on Nigerian Twitter |
| **Brand inconsistency** | Multiple team members produce inconsistent voice, tone, and policy adherence |
| **Collaboration friction** | Handoffs between team members lose context; approval chains slow critical responses |
| **Compliance risk** | Nigerian regulated industries (banking, telecoms, healthcare) require audit trails |
| **Visibility gap** | Leadership cannot see real-time engagement health, team workload, or NGN ROI |

### 1.3 Module Objectives

| Objective | Success Measure | Nigerian Context |
|-----------|-----------------|-----------------|
| **Real-time aggregation** | Messages appear within 30 seconds of posting | Includes Nigerian Twitter/X, Instagram, Facebook |
| **Intelligent routing** | ≥95% routing accuracy | Routes based on language (English, Pidgin), platform, topic |
| **Rapid response** | <1 hour average first response time | Benchmark for Nigerian consumer brands |
| **Brand consistency** | ≥90% brand voice compliance | Calibrated for Nigerian English register |
| **Team efficiency** | ≥50% reduction in management time | Key metric for Nigerian agency operations |
| **NGN ROI demonstration** | Measurable ₦ business impact | Retention, conversion, CLV in Nigerian Naira |

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Bola** (Social Media Manager, Telecom) | Creator / Analyst | Respond to messages, manage conversations, use templates |
| **Chidi** (Head of Marketing, Fintech) | Admin / Manager | Team oversight, quality assurance, performance dashboards |
| **Ngozi** (Crisis Manager, Multinational) | Manager | Crisis identification, escalation, urgent response coordination |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client engagement management with isolated workspaces |
| **Kemi** (Content Strategist, E-commerce) | Analyst | Engagement analytics, template management, insight reporting |

### 1.5 Module Position in the Platform

| Aspect | Detail |
|--------|--------|
| **Pillar** | Interaction — real-time audience engagement |
| **Depends on** | Module 1 (Authentication), Module 2 (Organization), Module 3 (Social Media Integration), Module 9 (Notifications) |
| **Integrates with** | Module 3 & 5 (Listening/Monitoring → engagement handoff), Module 4 (Publishing), Module 6 (Analytics & Reporting) |
| **External systems** | CRM (Salesforce, HubSpot), help desk (Zendesk, Freshdesk) — Year 2 |

### 1.6 Out of Scope

| Feature | Rationale |
|---------|-----------|
| Content scheduling and publishing | Handled by Module 4: Social Publishing |
| Paid advertising management | Out of scope; use advertising platforms directly |
| Influencer relationship management | Handled by Social Listening module |
| Voice / video calls | Text/async only in v1 |
| Long-form customer support tickets | Handed off to help desk integrations (Year 2) |
| Outgoing message translation | Incoming auto-translated; outgoing in agent's language |

---

## 2. User Stories

### 2.1 Engagement Manager / Team Lead

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-EH-01 | Engagement Manager | See all incoming messages across platforms in one inbox | I can triage efficiently without switching tools | P0 |
| US-EH-02 | Engagement Manager | Assign messages to team members based on skills, workload, and urgency | I can balance team capacity and meet SLAs | P0 |
| US-EH-03 | Engagement Manager | View real-time team workload and capacity | I can rebalance assignments proactively | P0 |
| US-EH-04 | Engagement Manager | Approve sensitive responses before they send | I can ensure brand and regulatory compliance | P0 |
| US-EH-05 | Engagement Manager | Set up routing rules and SLA policies | The system handles routine triage automatically | P1 |
| US-EH-06 | Engagement Manager | View engagement analytics and team performance | I can identify coaching opportunities and report to leadership | P1 |
| US-EH-07 | Engagement Manager | Detect crisis signals early | I can escalate before issues escalate | P0 |
| US-EH-08 | Engagement Manager | Manage shift handovers with full context | I can maintain SLA compliance across transitions | P1 |

### 2.2 Engagement Specialist (Frontline Agent)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-EH-11 | Engagement Specialist | See messages prioritized by urgency and routing rules | I respond to the most important items first | P0 |
| US-EH-12 | Engagement Specialist | Get AI-suggested responses based on message context | I can respond faster while maintaining quality | P0 |
| US-EH-13 | Engagement Specialist | Use response templates with smart variable insertion | I handle common questions consistently and quickly | P0 |
| US-EH-14 | Engagement Specialist | See full conversation history and customer context | I provide personalized, informed responses | P0 |
| US-EH-15 | Engagement Specialist | Add internal notes and @mention teammates | I collaborate without confusing the customer | P1 |
| US-EH-16 | Engagement Specialist | Snooze messages to follow up later | I don't lose track of pending items | P1 |
| US-EH-17 | Engagement Specialist | Transfer messages to a specialist with full context | The next person picks up seamlessly | P0 |

### 2.3 Crisis Manager

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-EH-20 | Crisis Manager | Receive immediate alerts for messages flagged as crisis signals | I can respond to crises in Nigerian Twitter before they trend | P0 |
| US-EH-21 | Crisis Manager | See all crisis-flagged messages in a dedicated queue | I can coordinate response without missing any thread | P0 |
| US-EH-22 | Crisis Manager | Escalate messages to senior stakeholders with one click | I don't waste time during a crisis on manual communication | P0 |
| US-EH-23 | Crisis Manager | Access pre-approved crisis response templates in WAT timezone | I can respond immediately without drafting from scratch | P0 |

### 2.4 Executive / Compliance Officer

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-EH-30 | Executive | See engagement KPIs with ₦ ROI metrics | I can justify engagement investment in business terms | P0 |
| US-EH-31 | Executive | Receive alerts for crisis signals or SLA breaches | I can intervene when needed | P0 |
| US-EH-32 | Compliance Officer | See complete audit trails for all interactions | I can demonstrate compliance in audits (CBN, NDPR) | P0 |
| US-EH-33 | Compliance Officer | Configure automated detection of sensitive information | PII and regulated data never appears in public responses | P0 |
| US-EH-34 | Compliance Officer | Generate compliance reports on demand | I can respond to regulatory inquiries | P1 |

### 2.5 Agency User (Multi-Client)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-EH-40 | Agency Owner | Manage engagement for multiple clients from one dashboard | I can scale without proportional headcount growth | P1 |
| US-EH-41 | Agency Owner | See each client's messages in an isolated workspace | Client A's conversations never mix with Client B's | P0 |
| US-EH-42 | Agency Owner | Generate per-client engagement reports | I can demonstrate value at monthly review meetings | P1 |

---

## 3. Functional Requirements

### 3.1 FR-EH-001: Multi-Platform Message Aggregation

**Description:** Aggregate, deduplicate, and enrich messages from all connected social platforms in real-time.

**Supported Platforms at Launch:**

| Platform | Message Types | Ingestion Method |
|----------|--------------|-----------------|
| Twitter/X | Tweets, replies, quote tweets, DMs | Webhook + polling fallback |
| Instagram | Comments, DMs, story replies | Webhook |
| Facebook | Page comments, Messenger, post replies | Webhook |
| LinkedIn | Comments, page DMs | Polling (60s interval) |
| TikTok | Comments | Polling (60s interval) |
| YouTube | Video comments | Polling (5min interval) |
| Reddit | Post comments, mentions | Polling (5min interval) |

**Message Enrichment Pipeline:**

| Data Point | Source | Update Frequency |
|-----------|--------|-----------------|
| Author influence score | Platform API + internal algorithm | Within 5 minutes of receipt |
| Sentiment (positive/neutral/negative + score 0–1) | NLP model | On ingestion |
| Intent classification (question/complaint/praise/sales/support/spam) | NLP model | On ingestion |
| Language detection | Language model | On ingestion |
| Nigerian Pidgin detection | Custom model | On ingestion |
| Spam/bot probability | ML model | On ingestion |
| VIP flag | Organization's VIP list | On ingestion |
| Crisis signal flag | Crisis keyword matching + ML | On ingestion |

**Nigerian Market Enrichments:**

| Enrichment | Description |
|-----------|-------------|
| Nigerian Pidgin detection | Flag messages in Nigerian Pidgin for appropriate routing |
| Nigerian brand keyword matching | Pre-loaded Nigerian brand dictionary for entity recognition |
| Nigerian crisis keyword pre-sets | Terms common in Nigerian social media crises |
| Verified influencer tier | Nigerian influencer tier classification (Mega/Macro/Mid/Micro) |

**Conversation Threading:**

- Reconstruct parent/child relationships for all platforms that support it
- Group related messages into conversations (Twitter/X threads, Instagram comment chains, Facebook post discussions)
- Maintain conversation context across platform reply mechanisms
- Handle deleted messages by preserving `[Message deleted by user]` placeholder with audit trail

**Deduplication:**

- Content hash matching for exact duplicates
- Cross-platform link detection (same story shared across platforms)
- Retweet/share detection (original + shares grouped)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Messages appear in inbox within 30 seconds of platform posting (webhook) or within polling interval + 1 minute |
| AC2 | Author influence scores update within 5 minutes of message receipt |
| AC3 | Intent classification achieves ≥90% accuracy on labeled datasets |
| AC4 | Nigerian Pidgin messages correctly detected and flagged |
| AC5 | Conversation threading accurately reconstructs ≥98% of message chains |
| AC6 | Spam detection false positive rate below 2% |
| AC7 | Deduplication eliminates ≥99% of true duplicates |

---

### 3.2 FR-EH-002: Intelligent Routing & Prioritization

**Description:** Automatically route messages to the right team member based on configurable rules, skills, workload, and urgency.

**Routing Rule Components:**

| Component | Options |
|-----------|---------|
| Conditions | Platform, sentiment, intent, language, author influence, VIP flag, crisis flag, keywords, custom fields |
| Actions | Assign to user, assign to team, set priority, set SLA, apply tag, send notification, trigger escalation |
| Priority | 0–100 (higher = evaluated first); rules evaluated in order until first match |
| Applies to | All platforms, or specific platform subset |

**Nigerian-Context Routing Examples:**

```
Rule 1: Nigerian Banking Crisis Watch (Priority: 100)
  IF: keywords contain ["CBN", "EFCC", "account blocked", "transfer failed", "money missing"]
     AND sentiment < -0.6
  THEN: assign to "Crisis Team", set priority = critical, notify on-call manager

Rule 2: Nigerian Pidgin Messages (Priority: 80)
  IF: language = "pcm" (Nigerian Pidgin) OR is_pidgin = true
  THEN: assign to "English-Pidgin-Bilingual" team, set SLA = 2h

Rule 3: VIP Nigerian Influencer Fast Track (Priority: 70)
  IF: author.tier IN ["mega", "macro"] AND author.country = "NG"
  THEN: assign to "VIP Team", set SLA = 15min, tag "high-influence"

Rule 4: WAT Business Hours (Priority: 50)
  IF: current_time IN [08:00-18:00 WAT] AND platform IN ["twitter", "instagram"]
  THEN: assign round-robin to "WAT-Active" team

Rule 5: After-Hours Escalation (Priority: 40)
  IF: priority = "critical" AND current_time NOT IN [08:00-18:00 WAT]
  THEN: notify on-call, assign to on-call user, send SMS
```

**Workload Balancing:**

| Setting | Default | Range |
|---------|---------|-------|
| Max active messages per agent | 50 | 1–200 |
| Capacity threshold (warn) | 80% | 50–95% |
| Capacity threshold (stop routing) | 100% | 80–100% |
| Workload check interval | 60 seconds | — |

**Priority Levels:**

| Level | Color | SLA Default | Trigger |
|-------|-------|------------|---------|
| Critical | 🔴 Red | 15 minutes | Crisis signal, compliance violation |
| High | 🟠 Orange | 1 hour | VIP customer, sentiment < -0.7 |
| Medium | 🟡 Yellow | 4 hours | Standard messages, neutral sentiment |
| Low | ⬜ White | 24 hours | Praise, spam-adjacent |

**SLA Tracking:**

- SLA clock starts at message receipt
- Visual indicator: Green (<50% elapsed), Yellow (50–80%), Orange (80–100%), Red (breached)
- Automated escalation triggers at configurable breach threshold (default: 90% time elapsed)
- SLA breach events logged in audit trail

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Routing rules correctly assign ≥95% of messages to appropriate team members |
| AC2 | Nigerian-specific routing rules (Pidgin, WAT hours, Nigerian crisis keywords) function correctly |
| AC3 | Workload balancing respects per-agent capacity limits |
| AC4 | SLA breaches trigger escalation within 1 minute of violation |
| AC5 | Holiday and after-hours routing rules activate at correct WAT times |
| AC6 | Manual routing override logged in audit trail |

---

### 3.3 FR-EH-003: Response Composition & Delivery

**Description:** Smart response composer with platform-aware formatting, AI suggestions, brand voice checking, and multi-platform delivery.

**Platform-Specific Character Limits:**

| Platform | Public Reply | DM |
|----------|-------------|-----|
| Twitter/X | 280 characters | 10,000 characters |
| Instagram comment | 2,200 characters | 1,000 characters |
| Facebook comment | 8,000 characters | 20,000 characters |
| LinkedIn comment | 1,250 characters | 8,000 characters |
| TikTok comment | 150 characters | — |
| YouTube comment | 10,000 characters | — |

**Composer Features:**

| Feature | Description |
|---------|-------------|
| Real-time character count | Color-coded: Green (<80%), Yellow (80–95%), Red (>95%), Blocked (>100%) |
| Platform preview | Live preview of how response will appear on each platform |
| Emoji picker | Full emoji library including Nigerian flag 🇳🇬 and Afrocentric emojis |
| GIF library | Curated GIF library for brand-appropriate use |
| Media attachment | Image, video, document support up to platform limits |
| Template insertion | One-click template with variable auto-population |
| Draft auto-save | Every 10 seconds; stored server-side; version history (last 20) |
| Internal note toggle | Switch between public reply and internal note |

**AI Response Suggestions:**

| Trigger | Suggestion Type |
|---------|----------------|
| Message received | 2–3 contextually relevant response suggestions |
| Template selected | Variable pre-population from customer profile |
| Tone mismatch detected | Tone adjustment suggestion ("Consider a warmer tone") |
| Nigerian context detected | Culturally appropriate phrase suggestions |

**Brand Voice Checking:**

| Check | Description |
|-------|-------------|
| Tone compliance | Formal vs. casual; empathetic vs. transactional |
| Brand vocabulary | Required terms; forbidden terms; competitor mention detection |
| Nigerian English | Accepts Nigerian English phrases without flagging |
| Pidgin appropriateness | Flags Pidgin in responses where brand guideline prohibits it |
| Override with reason | Any check can be overridden with mandatory reason logged |

**Response Delivery Options:**

| Option | Description |
|--------|-------------|
| Send now | Immediate delivery via platform API |
| Schedule | Deliver at specific WAT date/time |
| Best time | AI-recommended optimal time based on audience activity in WAT |
| Pending approval | Submit for manager review before delivery |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Character limits enforced in real-time with 100% accuracy per platform |
| AC2 | AI suggestions contextually relevant in ≥85% of cases |
| AC3 | Scheduled messages deliver within 1 minute of designated WAT time |
| AC4 | Brand voice checking flags non-compliant language with ≥90% accuracy |
| AC5 | Nigerian English accepted without incorrect grammar flags |
| AC6 | Draft auto-save triggers every 10 seconds; recoverable on session restore |
| AC7 | Delivery errors provide actionable, platform-specific resolution steps |

---

### 3.4 FR-EH-004: Response Templates & Knowledge Management

**Description:** Dynamic response template system with AI-powered suggestions, version control, and performance analytics.

**Template Structure:**

```
Template: "Complaint Acknowledgement — Nigerian Banking"
Category: Customer Service / Complaints / Banking
Platform: All
Language: English (Nigerian)
Intent: Complaint
Requires approval: Yes (Compliance)

Content:
"Hello {{customer_name}}, thank you for bringing this to our attention. 
We sincerely apologise for the inconvenience with your {{issue_type}}. 
Our team is reviewing your case as a priority and will provide an update 
within {{response_time}}. You can also reach us at {{support_contact}}."

Variables:
- {{customer_name}}: Customer's first name or @handle
- {{issue_type}}: Detected issue type (e.g., "transfer", "account access")
- {{response_time}}: SLA target from routing rules
- {{support_contact}}: Organization's support channel
```

**Nigerian Market Template Library (Pre-built):**

| Template Name | Use Case |
|--------------|---------|
| "Transfer delay apology" | Nigerian banking — delayed transfer complaints |
| "Network issue acknowledgement" | Nigerian telecom — network complaints |
| "App downtime response" | Nigerian fintech — app unavailability |
| "Product praise response" | FMCG — positive feedback in Nigerian English |
| "Public holiday hours" | Business hours during Nigerian public holidays |
| "CSAT survey follow-up" | Post-resolution satisfaction survey |
| "Escalation to DM" | Moving sensitive public complaint to private channel |
| "Pidgin-friendly welcome" | Pidgin-language audience engagement |

**Template Management:**

| Feature | Description |
|---------|-------------|
| Category hierarchy | Unlimited nesting depth (e.g., Customer Service → Complaints → Banking → Transfer) |
| Platform variants | Same template, platform-specific character-limit variants |
| Performance analytics | Usage count, average CSAT correlation, response time impact |
| Approval workflow | New templates require Compliance or Manager approval in regulated contexts |
| Version control | Full change history (who changed what, when, why) |
| Bulk operations | CSV import/export; mass category assignment |
| Access control | Team or department-level template access per RBAC |

**AI Template Suggestions:**

When composing a response:
1. System analyzes incoming message (intent, sentiment, keywords, platform)
2. Returns top 3 most relevant templates ranked by:
   - Intent match
   - Historical CSAT correlation
   - Recent usage frequency
   - Platform suitability
3. Agent selects template; variables auto-populated from customer context

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Template suggestions match message context with ≥90% relevance |
| AC2 | Variable auto-population correct in ≥95% of uses |
| AC3 | Approval workflows prevent unauthorized template usage |
| AC4 | Nigerian market templates load and apply correctly |
| AC5 | Template performance analytics update within 24 hours |
| AC6 | Enterprise-scale template library (10,000+ templates) supported |

---

### 3.5 FR-EH-005: Collaboration & Escalation

**Description:** Real-time team collaboration with context preservation, intelligent escalation, and shift management.

**Internal Collaboration:**

| Feature | Description |
|---------|-------------|
| Internal notes | Private notes on conversations (never visible to customers) |
| @mentions | Tag teammates; generates in-app + email notification |
| Typing indicators | Shows when teammate is composing on the same message |
| Message transfer | Full context transfer with history, notes, and customer profile |
| Collaborative drafting | Multiple agents co-edit a response before sending |
| Resolution notes | Mandatory context note when closing conversations |

**Escalation Framework:**

```
Escalation Paths:
  Tier 1 (Agent) → Tier 2 (Senior Agent) → Manager → Director → Executive
  
  Triggers for automatic escalation:
  - SLA breach (configurable threshold)
  - Sentiment drops below configurable threshold
  - Crisis signal detected (multi-signal)
  - Compliance flag raised
  - Customer requests escalation explicitly

  Targets per trigger (configurable):
  - Notify: In-app + push
  - Assign: Transfer to escalation assignee
  - SLA reset: New SLA starts at escalation tier
  - Audit: All escalations logged with trigger reason
```

**Presence & Capacity:**

| Status | Indicator | Routing Behavior |
|--------|-----------|-----------------|
| Online | 🟢 Green | Receives new assignments |
| Away | 🟡 Yellow | Receives urgent only |
| Busy | 🔴 Red | Not assigned new messages |
| OOO | ⚫ Gray | Excluded from routing |
| Offline | ⚫ Gray | Excluded from routing |

**Shift Handover:**

1. Outgoing agent marks "Handover initiated"
2. System generates pending message list with context
3. Incoming agent reviews and acknowledges each pending item
4. Transfer completes with full audit trail
5. SLA continuity maintained through handover period

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Internal notes never visible in public response thread |
| AC2 | Escalation workflows trigger within 1 minute of condition met |
| AC3 | Message transfers preserve full context, history, and notes |
| AC4 | Real-time presence indicators update within 2 seconds |
| AC5 | Shift handovers maintain SLA compliance through transitions |
| AC6 | @mention notifications delivered within 30 seconds |

---

### 3.6 FR-EH-006: Workflow Management & SLA Enforcement

**Description:** Configurable message lifecycle management with status pipelines, SLA tracking, and automated workflows.

**Default Status Pipeline:**

```
New → Assigned → In Progress → Awaiting Info → Awaiting Customer → Resolved → Closed
  ↑                                                    ↓
  └──────────────────── Reopen ─────────────────────────
```

**Custom Pipelines:** Organizations can define their own status names and transition rules.

**SLA Policies:**

| Policy Type | Configurable By | Default |
|-------------|----------------|---------|
| First response time | Priority + platform | Critical: 15min; High: 1h; Medium: 4h; Low: 24h |
| Resolution time | Priority + topic | 2× first response time |
| Escalation threshold | % of SLA elapsed | 90% |
| Business hours only | Toggle per policy | Off (WAT calendar enforced) |

**SLA Visual Indicators:**

| State | Color | When |
|-------|-------|------|
| On track | 🟢 Green | 0–50% of SLA elapsed |
| Caution | 🟡 Yellow | 50–80% of SLA elapsed |
| At risk | 🟠 Orange | 80–100% of SLA elapsed |
| Breached | 🔴 Red | SLA time elapsed |

**Automated Workflows:**

| Trigger | Configurable Actions |
|---------|---------------------|
| New message arrives | Auto-tag, auto-assign, apply SLA, send notification |
| SLA approaching (80%) | Notify assignee, notify team lead |
| SLA breached | Auto-escalate, notify manager, log breach |
| Message resolved | Send CSAT survey, auto-close after 48h if no reply |
| Customer replies after close | Auto-reopen, notify assignee |
| Sentiment drops below threshold | Escalate, apply crisis tag |

**Snooze Feature:**

- Snooze a conversation for follow-up at a specified WAT time
- Snoozed conversations hidden from inbox until timer expires
- Return to inbox automatically at specified time with context preserved
- Snooze reason logged in audit trail

**Bulk Operations:**

| Operation | Max Batch | Progress Tracking |
|-----------|-----------|------------------|
| Assign to user | 100 messages | Yes |
| Apply tag | 100 messages | Yes |
| Change status | 100 messages | Yes |
| Archive | 100 messages | Yes |
| Export | 10,000 messages | Yes |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Custom status pipelines enforce workflow rules with 100% reliability |
| AC2 | SLA breach escalations trigger within 1 minute of violation |
| AC3 | WAT business hours calendar correctly applies to SLA calculations |
| AC4 | Bulk operations process 100 messages in under 30 seconds |
| AC5 | Snoozed messages return to inbox at correct WAT time |
| AC6 | Auto-close policies execute correctly after configured period |

---

### 3.7 FR-EH-007: Engagement Analytics & Reporting

**Description:** Comprehensive analytics covering team performance, CSAT, response efficiency, and ₦ ROI.

**Core Performance Metrics:**

| Metric | Description | Nigerian Context |
|--------|-------------|-----------------|
| First Response Time (FRT) | Time from message receipt to first public response | Shown in WAT; benchmarked vs. Nigerian industry |
| Average Handle Time (AHT) | Average time to fully resolve a conversation | — |
| Resolution Rate | % of conversations fully resolved | — |
| First Contact Resolution (FCR) | % resolved in single interaction | — |
| CSAT Score | Customer satisfaction (1–5 scale) | Post-resolution survey |
| SLA Compliance Rate | % of messages meeting SLA targets | By priority tier |
| Volume Trends | Message volume over time with peak identification | Nigerian peak times in WAT |
| Team Utilization | % of team capacity in use | Per agent and per team |

**₦ ROI Analytics:**

| Metric | Calculation | Display |
|--------|-------------|---------|
| Engagement cost per message | Total team cost ÷ messages handled | ₦ per message |
| Customer retention attribution | Conversations with negative → resolved journey correlated with retention | ₦ retained revenue |
| Escalation cost | Cost of escalated vs. resolved at tier 1 | ₦ difference |
| Response time ROI | Correlation of FRT with satisfaction and churn | ₦ impact |
| Team efficiency gain | Volume handled vs. prior period with same headcount | ₦ productivity value |

**Dashboard Views:**

| Dashboard | Primary Audience | Key Widgets |
|-----------|----------------|-------------|
| Real-time Inbox Overview | Engagement Specialists | Live queue, my messages, SLA countdown |
| Team Performance | Managers | FRT, AHT, CSAT per agent, workload heatmap |
| Executive Engagement | C-Suite | Volume trend, CSAT trend, ₦ ROI, NPS |
| Compliance View | Compliance Officers | Flagged messages, audit log, approval queue |
| Agency Client View | Agency Owners | Per-client breakdown with white-label export |

**Analytics Update Frequency:**

| Metric | Refresh |
|--------|---------|
| Live inbox counts | Real-time (WebSocket) |
| FRT, AHT | Every 5 minutes |
| CSAT | As surveys complete |
| Volume charts | Every 15 minutes |
| ₦ ROI | Daily at midnight WAT |
| Predictive forecasts | Daily at midnight WAT |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | All timestamps in analytics display in WAT |
| AC2 | ₦ ROI metrics calculated using Nigerian market cost assumptions |
| AC3 | Custom reports generate within 30 seconds for datasets up to 1M messages |
| AC4 | Automated insights flag meaningful trends with ≥90% relevance |
| AC5 | Executive dashboards load within 3 seconds |
| AC6 | Agency per-client reports correctly isolate client data |

---

### 3.8 FR-EH-008: Compliance & Quality Assurance

**Description:** Enterprise-grade compliance monitoring, automated PII detection, audit trails, and quality scoring.

**Compliance Features:**

| Feature | Description | Regulatory Context |
|---------|-------------|-------------------|
| Automated PII detection | Detect and redact BVN, NIN, account numbers, phone numbers before send | NDPR requirement |
| Crisis flag + approval gate | Crisis-flagged responses require Manager approval before delivery | Brand risk management |
| Audit trail | Immutable log of all engagement actions (who, what, when, why) | NDPR 7-year retention |
| Legal hold | Preserve specific conversations for regulatory or legal purposes | CBN/SEC compliance |
| Retention policy enforcement | Auto-archive or delete per configurable retention rules | NDPR compliance |
| Compliance report generation | On-demand reports for regulatory inquiries | CBN, NCC, NAFDAC audits |

**Nigerian Regulatory Pre-Sets:**

| Sector | Pre-configured Compliance Rules |
|--------|--------------------------------|
| Banking | BVN/NIN detection; CBN-sensitive language flags; NDIC mention alerts |
| Fintech | Financial advice detection; unlicensed activities detection |
| Telecom | NCC complaint language; number portability mention handling |
| Healthcare | Patient data detection; NAFDAC-sensitive language |

**Quality Assurance:**

| Feature | Description |
|---------|-------------|
| Automated quality scoring | Rubric-based scoring (empathy, accuracy, resolution, tone, compliance) |
| QA sampling | Random or targeted selection for manual review |
| Coaching recommendations | Per-agent improvement suggestions from quality scores |
| Performance trend | Agent improvement over time visualization |
| Quality score → CSAT correlation | Validates rubric effectiveness |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | PII detection fires before message delivery (real-time, not post-send) |
| AC2 | Nigerian BVN/NIN pattern recognition achieves ≥95% detection rate |
| AC3 | Audit trail maintains complete engagement history with no gaps |
| AC4 | Quality scoring correlates with CSAT (r > 0.6) |
| AC5 | Retention policies automatically enforce data lifecycle rules |
| AC6 | Compliance reports generate within 30 seconds |

---

## 4. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-EH-01 | All public responses must pass brand voice check before send (or be explicitly overridden with reason) | Brand consistency |
| BR-EH-02 | Messages flagged as crisis severity must be acknowledged within 5 minutes | Risk management |
| BR-EH-03 | SLA breach triggers automatic escalation; cannot be suppressed without Manager approval | SLA enforcement |
| BR-EH-04 | Approval workflows cannot be bypassed except by Admin with audit log entry | Compliance |
| BR-EH-05 | PII detected in responses triggers automatic redaction and warning before send | NDPR compliance |
| BR-EH-06 | Conversation closure requires resolution note (or selection from standard closure reasons) | Analytics accuracy |
| BR-EH-07 | Templates in regulated contexts (banking, telecom) require Compliance team approval | Regulatory |
| BR-EH-08 | Internal notes are never visible to customers, even if conversation is shared externally | Privacy |
| BR-EH-09 | Shift handover requires pending message list review and acknowledgment | Continuity |
| BR-EH-10 | Bulk operations require confirmation step and are logged with operator identity | Audit trail |
| BR-EH-11 | Routing rules respect user OOO status (no assignment to OOO users unless manual override) | Realistic routing |
| BR-EH-12 | Customer data is never stored longer than the platform's retention permits | Data minimization |
| BR-EH-13 | All timestamps stored in UTC; displayed in WAT for Nigerian organizations | Consistency |
| BR-EH-14 | ₦ ROI calculations use Nigerian market cost assumptions | Market accuracy |

---

## 5. Permissions

### 5.1 RBAC Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Inbox & Messages** |
| View own assigned messages | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View all organization messages | ✅ | ✅ | ✅ | ❌ | ✅ (read-only) | ✅ (read-only) |
| Send public response | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add internal note | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Assign message to user | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Transfer message | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Snooze message | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Resolve/close message | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reopen message | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approval & Escalation** |
| Approve responses | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reject responses | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Escalate message | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Templates** |
| View templates | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Use templates | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create templates | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit any template | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete templates | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve templates | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Configuration** |
| Configure routing rules | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure SLA policies | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View team workload | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage team assignments | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Analytics & Compliance** |
| View own analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View team analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| View ₦ ROI dashboard | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Export data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| View audit trail | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Place legal hold | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate compliance reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure bulk operations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### 5.2 The Nigerian Context PII Rule

Frontline agents cannot see customer PII beyond what is necessary for the response:

- Agent sees: customer handle, recent message history, public profile data, influence tier
- Agent does **not** see: BVN, NIN, government ID numbers, full bank account numbers, financial transaction details

Access to extended PII requires "elevated access" with Manager approval and full audit trail.

---

## 6. UI Flow

### 6.1 Unified Inbox

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo] Engagement Hub        [🔍 Search]      [🔔 3] [👤 Bola ▾]        │
├──────────┬───────────────────────────────────────────────────────────────┤
│ FILTERS  │ ┌─ Inbox: All Open ───────────────────────── [47] ─────────┐  │
│          │ │ Priority: All ▾  │  Sort: SLA ▾  │  Platform: All ▾     │  │
│ 📥 Inbox │ ├──────────────────────────────────────────────────────────┤  │
│  All (47)│ │ ☐ 🔴 CRITICAL  @angry_customer · Twitter/X · 3m ago      │  │
│  Mine (12│ │ "My account has been blocked again! CBN should know..."   │  │
│  Unassign│ │ [Complaint -0.89] [Crisis Signal 🚨] [SLA: 12m left]    │  │
│          │ ├──────────────────────────────────────────────────────────┤  │
│ QUEUES   │ │ ☐ 🟠 HIGH      @influencer_ng · Instagram · 8m ago        │  │
│ 🚨 Crisis│ │ "Love the new feature! Quick question about pricing..."   │  │
│ 👑 VIP NG│ │ [Positive +0.8] [Question] [VIP 🇳🇬] [SLA: 52m left]    │  │
│ 🌙 OOO   │ ├──────────────────────────────────────────────────────────┤  │
│ ✅ Done  │ │ ☐ 🟡 MEDIUM    @random_user · Facebook · 15m ago          │  │
│          │ │ "Oga how do una dey do am? App don fall again o"         │  │
│ PLATFORMS│ │ [Neutral] [Complaint] [🇳🇬 Pidgin detected]              │  │
│ 🐦 X (23)│ ├──────────────────────────────────────────────────────────┤  │
│ 📸 IG (14│ │ ☐ ⬜ LOW       @auto_bot · Twitter/X · 1h ago              │  │
│ 📘 FB (10│ │ "Cheap data deals available! Click link..."               │  │
│ 💼 LI (3)│ │ [Spam 92%] [Bot detected] [Auto-hidden]                 │  │
│          │ └──────────────────────────────────────────────────────────┘  │
│ ⚙ Config │ Showing 1–20 of 47 messages     [< 1 2 3 >]                   │
└──────────┴───────────────────────────────────────────────────────────────┘
```

### 6.2 Conversation Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Inbox  │  @angry_customer  ·  Twitter/X  ·  🔴 CRITICAL               │
│ Status: [In Progress ▾]   Assignee: [Bola ▾]   Priority: [Critical ▾]  │
├──────────────────────────────────────────────────────────────────────────┤
│ THREAD                               │ CUSTOMER PROFILE                 │
│                                      │ @angry_customer                  │
│ @angry_customer · 3m ago             │ Tier: Premium (VIP)              │
│ "My account has been blocked again!  │ Influence: 45K followers         │
│  CBN should know about this kind of  │ Verified: ✅                      │
│  service!"                           │ Country: 🇳🇬 Lagos               │
│ [Complaint -0.89] [🚨 Crisis]        │ LTV: ₦450,000                    │
│                                      │ Open tickets: 2                  │
│ ┌─ Internal Note ──────────────────┐ │ Avg CSAT: 3.1/5 ⚠               │
│ │ @chidi please review — banking   │ │ Tags: [frustrated] [churn-risk]  │
│ │ crisis keywords detected -Bola   │ │                                  │
│ └──────────────────────────────────┘ │ LINKED CONVERSATIONS             │
│                                      │ • Instagram DM (2 days ago)      │
│ Bola · 2m ago (Internal)            │ • Facebook comment (1 week ago)  │
│ "Escalating to Chidi for review"     │                                  │
│                                      │ SLA STATUS                       │
│ ┌─ COMPOSE RESPONSE ───────────────────────────────────────────────────┐ │
│ │ Hi [customer], I sincerely apologise for this experience. Your      │ │
│ │ account security is our top priority...                             │ │
│ │ [B] [I] [😊] [📎] [📋 Templates ▾]                      198/280    │ │
│ │                                                                      │ │
│ │ ✨ AI: "Acknowledge frustration, offer immediate investigation..."   │ │
│ │ ✓ Brand voice: OK  │  ⚠️ Tone: Add more empathy                   │ │
│ │ 🚨 PII check: CLEAR │  ⚠ Regulatory: CBN mention — needs approval │ │
│ │                                                                      │ │
│ │        [Save Draft]  [Schedule]  [Submit for Approval]  [Send]      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Routing Configuration

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Routing Rules                                              [+ New Rule] │
├──────────────────────────────────────────────────────────────────────────┤
│ Active Rules (8)                                                       │
│                                                                          │
│ 1. 🚨 Nigerian Banking Crisis Watch           Priority: 100           │
│    IF: keywords ∋ ["CBN","EFCC","account blocked"] AND sentiment < -0.6│
│    THEN: → "Crisis Team", priority=critical, notify on-call (SMS+push)│
│    [Edit] [Pause] [Test with sample]                                   │
│                                                                          │
│ 2. 🇳🇬 Pidgin Language Route                  Priority: 80            │
│    IF: detected_language = "pcm" (Pidgin) OR is_pidgin = true         │
│    THEN: → "EN-Pidgin-Bilingual" team, SLA = 2h                       │
│    [Edit] [Pause] [Test with sample]                                   │
│                                                                          │
│ 3. 👑 VIP Nigerian Influencer Fast Track       Priority: 70            │
│    IF: author.tier ∈ [mega, macro] AND author.country = "NG"          │
│    THEN: → "VIP Team", SLA = 15min, tag "high-influence"              │
│    [Edit] [Pause] [Test with sample]                                   │
│                                                                          │
│ 4. 🌙 WAT After-Hours Escalation              Priority: 40             │
│    IF: priority = "critical" AND time NOT IN [08:00-18:00 WAT]        │
│    THEN: notify on-call, assign to on-call user, send SMS             │
│    [Edit] [Pause] [Test with sample]                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. API Reference

### 7.1 Engagement Endpoints

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| `GET` | `/api/v1/engagement/messages` | ✅ | Creator+ | List messages (filter, sort, paginate) |
| `GET` | `/api/v1/engagement/messages/:id` | ✅ | Creator+ | Get message detail with thread |
| `POST` | `/api/v1/engagement/messages/:id/respond` | ✅ | Creator+ | Send public response |
| `POST` | `/api/v1/engagement/messages/:id/note` | ✅ | Creator+ | Add internal note |
| `PATCH` | `/api/v1/engagement/messages/:id` | ✅ | Creator+ | Update status, assignee, tags, priority |
| `POST` | `/api/v1/engagement/messages/:id/assign` | ✅ | Manager+ | Assign to user or team |
| `POST` | `/api/v1/engagement/messages/:id/transfer` | ✅ | Creator+ | Transfer with full context |
| `POST` | `/api/v1/engagement/messages/:id/snooze` | ✅ | Creator+ | Snooze for follow-up (WAT time) |
| `POST` | `/api/v1/engagement/messages/:id/resolve` | ✅ | Creator+ | Close with resolution note |
| `POST` | `/api/v1/engagement/messages/:id/escalate` | ✅ | Creator+ | Manual escalation |
| `POST` | `/api/v1/engagement/messages/bulk` | ✅ | Manager+ | Bulk operations (max 100) |

### 7.2 Configuration Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/v1/engagement/routing-rules` | Manager+ | List routing rules |
| `POST` | `/api/v1/engagement/routing-rules` | Manager+ | Create routing rule |
| `PATCH` | `/api/v1/engagement/routing-rules/:id` | Manager+ | Update rule |
| `DELETE` | `/api/v1/engagement/routing-rules/:id` | Admin+ | Delete rule |
| `POST` | `/api/v1/engagement/routing-rules/:id/test` | Manager+ | Test rule against historical data |
| `GET` | `/api/v1/engagement/sla-policies` | Manager+ | List SLA policies |
| `POST` | `/api/v1/engagement/sla-policies` | Manager+ | Create SLA policy |

### 7.3 Template Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/v1/engagement/templates` | Creator+ | List templates |
| `POST` | `/api/v1/engagement/templates` | Manager+ | Create template |
| `PATCH` | `/api/v1/engagement/templates/:id` | Manager+ | Update template |
| `DELETE` | `/api/v1/engagement/templates/:id` | Manager+ | Delete template |
| `POST` | `/api/v1/engagement/templates/:id/approve` | Manager+ | Approve template |
| `POST` | `/api/v1/engagement/templates/suggest` | Creator+ | AI-suggest template for message |

### 7.4 Analytics Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/v1/engagement/analytics/overview` | Analyst+ | KPIs with ₦ ROI |
| `GET` | `/api/v1/engagement/analytics/team` | Manager+ | Team/individual performance |
| `GET` | `/api/v1/engagement/analytics/volume` | Analyst+ | Volume trends (WAT timezone) |
| `GET` | `/api/v1/engagement/analytics/quality` | Manager+ | Quality scores and CSAT |
| `GET` | `/api/v1/engagement/analytics/roi` | Manager+ | ₦ ROI calculation |
| `GET` | `/api/v1/engagement/analytics/forecast` | Manager+ | Volume forecast (WAT) |
| `GET` | `/api/v1/engagement/team/workload` | Manager+ | Real-time team workload |

### 7.5 Compliance Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/v1/engagement/audit-log` | Admin+ | Query audit log |
| `POST` | `/api/v1/engagement/legal-hold` | Admin+ | Place legal hold |
| `DELETE` | `/api/v1/engagement/legal-hold/:id` | Admin+ | Release legal hold |
| `GET` | `/api/v1/engagement/approvals` | Manager+ | List pending approvals |
| `POST` | `/api/v1/engagement/approvals/:id/approve` | Manager+ | Approve response |
| `POST` | `/api/v1/engagement/approvals/:id/reject` | Manager+ | Reject with reason |
| `GET` | `/api/v1/engagement/compliance/reports` | Admin+ | Generate compliance report |

### 7.6 Response Examples

**Get Inbox:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "eng_9f2a4b6c8d1e3f5g",
        "platform": "twitter",
        "sender": {
          "username": "@angry_customer",
          "displayName": "Angry Customer",
          "influenceScore": 72,
          "tier": "mid",
          "isVerified": false,
          "isVip": true,
          "country": "NG"
        },
        "contentPreview": "My account has been blocked again! CBN should...",
        "sentiment": { "label": "negative", "score": -0.89 },
        "intent": { "label": "complaint", "confidence": 0.94 },
        "isCrisis": true,
        "isPidgin": false,
        "priority": "critical",
        "status": "in_progress",
        "assignedTo": { "id": "usr_7e3b2c1d", "name": "Bola Adeyemi" },
        "slaTarget": "2026-07-21T11:30:00+01:00",
        "slaBreached": false,
        "receivedAt": "2026-07-21T11:15:00+01:00"
      }
    ],
    "pagination": { "cursor": "eyJpZCI6Im...", "hasMore": true, "totalCount": 47 },
    "summary": {
      "totalUnassigned": 5,
      "totalInProgress": 30,
      "totalSlaBreached": 2,
      "avgFirstResponseMinutes": 18,
      "timezone": "Africa/Lagos"
    }
  }
}
```

**Send Response:**

```http
POST /api/v1/engagement/messages/eng_9f2a4b6c/respond
Content-Type: application/json

{
  "content": "Hello, I sincerely apologise for this experience. Your account security is our top priority. Our team is investigating urgently and will provide an update within 30 minutes. Please DM us your details (avoid sharing account numbers publicly).",
  "templateId": "tpl_banking_complaint_01",
  "approvalRequired": true
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "id": "resp_3b4c5d6e7f8a9b0c",
    "status": "pending_approval",
    "approvalRequired": true,
    "approvalRequestId": "apr_1a2b3c4d",
    "content": "Hello, I sincerely apologise...",
    "createdAt": "2026-07-21T11:18:00+01:00"
  }
}
```

**Get Team Workload:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "teamMembers": [
      {
        "id": "usr_7e3b2c1d",
        "name": "Bola Adeyemi",
        "status": "online",
        "assignedCount": 12,
        "inProgressCount": 8,
        "resolvedToday": 15,
        "avgFirstResponseMinutes": 12,
        "slaBreachCount": 1,
        "capacityPercent": 85
      },
      {
        "id": "usr_3b4c5d6e",
        "name": "Kemi Lawal",
        "status": "online",
        "assignedCount": 8,
        "inProgressCount": 5,
        "resolvedToday": 10,
        "avgFirstResponseMinutes": 9,
        "slaBreachCount": 0,
        "capacityPercent": 60
      }
    ],
    "summary": {
      "totalAssigned": 20,
      "totalInProgress": 13,
      "totalResolvedToday": 25,
      "avgFirstResponseMinutes": 11,
      "slaBreachCount": 1,
      "teamUtilizationPercent": 72,
      "timezone": "Africa/Lagos"
    }
  }
}
```

---

## 8. Database Schema

### 8.1 Core Tables

```sql
-- Engagement messages (unified inbox)
CREATE TABLE engagement_messages (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform                  VARCHAR(20) NOT NULL
                            CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'reddit')),
  platform_message_id       VARCHAR(255) NOT NULL,
  platform_thread_id        VARCHAR(255),
  platform_conversation_id  VARCHAR(255),
  -- Author information
  author_platform_id        VARCHAR(255) NOT NULL,
  author_handle             VARCHAR(100),
  author_display_name       VARCHAR(100),
  author_avatar_url         TEXT,
  author_follower_count     INTEGER DEFAULT 0,
  author_verified           BOOLEAN DEFAULT FALSE,
  author_influence_score    INTEGER DEFAULT 0,
  author_tier               VARCHAR(20)
                            CHECK (author_tier IN ('mega', 'macro', 'mid', 'micro', 'nano')),
  author_country            VARCHAR(2),
  -- Content
  content                   TEXT NOT NULL,
  content_language          VARCHAR(5),
  is_pidgin                 BOOLEAN DEFAULT FALSE,
  content_translated        TEXT,
  -- Enrichment
  sentiment_label           VARCHAR(20)
                            CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_score           DECIMAL(3,2),
  sentiment_confidence      DECIMAL(3,2),
  intent_label              VARCHAR(30)
                            CHECK (intent_label IN ('question', 'complaint', 'praise', 'sales', 'support', 'spam', 'other')),
  intent_confidence         DECIMAL(3,2),
  -- Flags
  priority                  VARCHAR(20) DEFAULT 'medium'
                            CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  is_vip                    BOOLEAN DEFAULT FALSE,
  is_crisis                 BOOLEAN DEFAULT FALSE,
  is_spam                   BOOLEAN DEFAULT FALSE,
  is_bot                    BOOLEAN DEFAULT FALSE,
  -- Workflow
  status                    VARCHAR(30) DEFAULT 'new'
                            CHECK (status IN ('new', 'assigned', 'in_progress', 'awaiting_info', 'awaiting_customer', 'resolved', 'closed', 'snoozed')),
  assignee_id               VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  team_id                   VARCHAR(32),
  sla_policy_id             VARCHAR(32),
  sla_due_at                TIMESTAMPTZ,
  sla_breached              BOOLEAN DEFAULT FALSE,
  snooze_until              TIMESTAMPTZ,
  -- Relationships
  parent_message_id         VARCHAR(32) REFERENCES engagement_messages(id),
  root_message_id           VARCHAR(32) REFERENCES engagement_messages(id),
  -- Timestamps (WAT for Nigerian orgs via application layer)
  received_at               TIMESTAMPTZ NOT NULL,
  first_response_at         TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  closed_at                 TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_message_id)
);

ALTER TABLE engagement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY em_isolation ON engagement_messages
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_em_org_status ON engagement_messages(organization_id, status, received_at DESC);
CREATE INDEX idx_em_assignee ON engagement_messages(assignee_id, status)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_em_sla ON engagement_messages(sla_due_at)
  WHERE sla_breached = FALSE AND status NOT IN ('resolved', 'closed');
CREATE INDEX idx_em_crisis ON engagement_messages(organization_id, received_at DESC)
  WHERE is_crisis = TRUE;
CREATE INDEX idx_em_platform_thread ON engagement_messages(platform, platform_thread_id);
CREATE INDEX idx_em_search ON engagement_messages
  USING GIN(to_tsvector('english', content));
```

```sql
-- Engagement responses (public replies and internal notes)
CREATE TABLE engagement_responses (
  id                    VARCHAR(32) PRIMARY KEY,
  message_id            VARCHAR(32) NOT NULL REFERENCES engagement_messages(id) ON DELETE CASCADE,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id             VARCHAR(32) NOT NULL REFERENCES users(id),
  content               TEXT NOT NULL,
  media_urls            TEXT[],
  status                VARCHAR(30) DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'failed', 'scheduled', 'cancelled')),
  is_internal_note      BOOLEAN DEFAULT FALSE,
  approval_request_id   VARCHAR(32),
  approved_by_id        VARCHAR(32) REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  template_id           VARCHAR(32),
  scheduled_for         TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  platform_response_id  VARCHAR(255),
  error_code            VARCHAR(50),
  error_message         TEXT,
  retry_count           INTEGER DEFAULT 0,
  version               INTEGER DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE engagement_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY er_isolation ON engagement_responses
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_er_message ON engagement_responses(message_id, created_at);
CREATE INDEX idx_er_scheduled ON engagement_responses(scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX idx_er_approval ON engagement_responses(approval_request_id)
  WHERE status = 'pending_approval';
```

```sql
-- Response templates
CREATE TABLE engagement_templates (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  category_path         TEXT,                           -- e.g., "Customer Service/Complaints/Banking"
  platform              VARCHAR(20),                    -- NULL = all platforms
  content               TEXT NOT NULL,
  variables             JSONB,
  intent_match          VARCHAR(30),                    -- Hint for AI matching
  language              VARCHAR(5) DEFAULT 'en-NG',     -- Nigerian English default
  is_pidgin_appropriate BOOLEAN DEFAULT FALSE,
  requires_approval     BOOLEAN DEFAULT FALSE,
  approved_by_id        VARCHAR(32) REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  usage_count           INTEGER DEFAULT 0,
  avg_csat              DECIMAL(3,2),
  is_active             BOOLEAN DEFAULT TRUE,
  created_by_id         VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE engagement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY et_isolation ON engagement_templates
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_et_org ON engagement_templates(organization_id, is_active);
CREATE INDEX idx_et_intent ON engagement_templates(organization_id, intent_match) WHERE is_active = TRUE;
CREATE INDEX idx_et_search ON engagement_templates
  USING GIN(to_tsvector('english', name || ' ' || content));
```

```sql
-- Routing rules
CREATE TABLE engagement_routing_rules (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  priority          INTEGER DEFAULT 50,
  conditions        JSONB NOT NULL,
  actions           JSONB NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by_id     VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_evaluated_at TIMESTAMPTZ,
  evaluation_count  INTEGER DEFAULT 0,
  match_count       INTEGER DEFAULT 0
);

ALTER TABLE engagement_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_routing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY err_isolation ON engagement_routing_rules
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_err_org_priority ON engagement_routing_rules(organization_id, is_active, priority DESC);
```

```sql
-- SLA policies
CREATE TABLE engagement_sla_policies (
  id                          VARCHAR(32) PRIMARY KEY,
  organization_id             VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                        VARCHAR(100) NOT NULL,
  conditions                  JSONB,
  first_response_minutes      INTEGER NOT NULL,
  resolution_minutes          INTEGER,
  escalation_threshold_percent INTEGER DEFAULT 90,
  business_hours_only         BOOLEAN DEFAULT FALSE,
  timezone                    VARCHAR(100) DEFAULT 'Africa/Lagos',
  is_active                   BOOLEAN DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE engagement_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_sla_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY esla_isolation ON engagement_sla_policies
  USING (organization_id = current_setting('app.current_org_id', true));
```

```sql
-- Approval requests
CREATE TABLE engagement_approval_requests (
  id              VARCHAR(32) PRIMARY KEY,
  response_id     VARCHAR(32) NOT NULL REFERENCES engagement_responses(id) ON DELETE CASCADE,
  message_id      VARCHAR(32) NOT NULL REFERENCES engagement_messages(id),
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id    VARCHAR(32) NOT NULL REFERENCES users(id),
  approver_ids    TEXT[],
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  approved_by_id  VARCHAR(32) REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejected_by_id  VARCHAR(32) REFERENCES users(id),
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE engagement_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_approval_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY ear_isolation ON engagement_approval_requests
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_ear_status ON engagement_approval_requests(status, expires_at)
  WHERE status = 'pending';
```

```sql
-- Immutable audit log (no updates or deletes)
CREATE TABLE engagement_audit_log (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL,
  actor_id        VARCHAR(32) NOT NULL,
  actor_ip        INET,
  action          VARCHAR(100) NOT NULL,
  target_type     VARCHAR(50) NOT NULL,
  target_id       VARCHAR(32) NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  reason          TEXT,
  request_id      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — immutable
);

-- No RLS on audit log — admins can query their organization's log
CREATE INDEX idx_eal_org ON engagement_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_eal_target ON engagement_audit_log(target_type, target_id, created_at DESC);
CREATE INDEX idx_eal_actor ON engagement_audit_log(actor_id, created_at DESC);
```

---

## 9. Notifications

### 9.1 Engagement Notification Templates

| Event | Recipient | Subject | Channel | SLA | Nigerian Context |
|-------|-----------|---------|---------|-----|-----------------|
| New message assigned | Assignee | "📩 New message: @[handle] — [platform]" | In-app + push | <30s | — |
| SLA at risk (80% elapsed) | Assignee + Team Lead | "⏰ SLA warning: [X] minutes remaining" | In-app + push | 5min | Time shown in WAT |
| SLA breached | Assignee + Manager | "🚨 SLA breached: @[handle]" | In-app + push + email | 1min | Time shown in WAT |
| Crisis detected | On-call + Manager | "🔴 Crisis: @[handle] — [preview]" | In-app + push + email + SMS | <2min | Nigerian crisis keywords |
| @mention in note | Mentioned user | "💬 @[sender] mentioned you in a note" | In-app + push | <30s | — |
| Approval requested | Approvers | "📝 Review needed: @[handle]" | In-app + push + email | <30s | — |
| Response approved | Creator | "✅ Response approved: @[handle]" | In-app + email | <30s | — |
| Response rejected | Creator | "❌ Response rejected: @[handle]" | In-app + email | <30s | Includes rejection reason |
| Message escalated to you | New assignee | "⬆️ Escalated: @[handle] — please review" | In-app + push | <30s | — |
| Message resolved | Creator | "✅ Resolved: @[handle]" | In-app | 5min | — |
| Daily digest | Subscribed users | "📊 Your daily engagement digest" | Email | 8:00 AM WAT | ₦ metrics included |
| Weekly performance report | Managers | "📈 Weekly engagement report" | Email | Monday 8:00 AM WAT | ₦ ROI included |

### 9.2 In-App Notification Center

| Event | Icon | Message | Dismissible |
|-------|------|---------|------------|
| New assigned message | 📩 | "@[handle] on [Platform] assigned to you" | Yes |
| SLA warning | ⏰ | "@[handle] SLA expires in [N] minutes" | No (sticky) |
| SLA breach | 🚨 | "@[handle] SLA breached — immediate action needed" | No (sticky) |
| Crisis detection | 🔴 | "Crisis signal: @[handle] on [Platform]" | No (sticky) |
| Approval needed | 📝 | "[Creator] needs your approval on @[handle]" | No (sticky) |
| Auto-save | 💾 | "Draft auto-saved" | Auto-dismiss 3s |

---

## 10. Error Handling

### 10.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `EH_MESSAGE_NOT_FOUND` | 404 | Message not found or no access | Refresh inbox |
| `EH_RESPONSE_EMPTY` | 422 | Cannot send empty response | Add content |
| `EH_RESPONSE_TOO_LONG` | 422 | Exceeds [Platform] character limit of [N] | Shorten response |
| `EH_RESPONSE_BRAND_VIOLATION` | 422 | Response flagged for brand voice review | Revise or override with reason |
| `EH_RESPONSE_PII_DETECTED` | 422 | Sensitive information detected — remove before sending | Remove BVN/NIN/account number |
| `EH_APPROVAL_REQUIRED` | 422 | This response requires Manager approval first | Submit for approval |
| `EH_APPROVAL_EXPIRED` | 400 | Approval request expired (24h) | Resubmit for approval |
| `EH_TEMPLATE_NOT_APPROVED` | 403 | Template requires Compliance approval | Use approved template or request approval |
| `EH_ASSIGN_FORBIDDEN` | 403 | Cannot assign outside your team | Request Admin to assign |
| `EH_ROUTING_LOOP` | 422 | Routing rule would create an infinite loop | Fix rule conditions |
| `EH_BULK_LIMIT_EXCEEDED` | 422 | Maximum 100 messages per bulk operation | Split into smaller batches |
| `EH_SLA_ALREADY_BREACHED` | 200 | SLA already breached; message flagged for urgent action | Take action immediately |
| `EH_PLATFORM_RATE_LIMITED` | 429 | [Platform] rate limit reached; will retry automatically | Wait for automatic retry |
| `EH_PLATFORM_AUTH_FAILED` | 401 | [Platform] authentication failed; reconnect account | Go to Settings → Integrations |
| `EH_LEGAL_HOLD` | 403 | This conversation is on legal hold and cannot be modified | Contact Admin or Compliance |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — retry after [N] seconds | Retry after cooldown |

### 10.2 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| AI suggestion service down | Hide suggestion panel; allow manual composition |
| Translation service down | Show original language; note "Translation unavailable" |
| Real-time presence down | Show last-known status with stale timestamp |
| Brand voice checker down | Allow response with "Brand check unavailable" warning |
| Spam detection down | Allow all messages through; flag for manual review |
| Analytics service down | Show cached metrics with "Data may be delayed" notice |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Message aggregation latency (webhook) | <30 seconds |
| Inbox load time (100 messages) | <2 seconds |
| Filter application | <1 second for 10,000+ messages |
| AI suggestion generation | <3 seconds |
| Response delivery (Twitter/X, Instagram) | <5 seconds |
| Analytics dashboard load | <3 seconds |
| Bulk operation (100 messages) | <30 seconds |
| API response time P95 | <500ms |

### 11.2 Scale

| Metric | Capacity |
|--------|---------|
| Daily messages processed | 100,000+ per organization |
| Concurrent users | 500+ per organization |
| Active routing rules | 200+ per organization |
| Templates | 10,000+ per organization |
| Platforms connected | 7+ at launch |

### 11.3 Compliance

| Requirement | Implementation |
|-------------|---------------|
| NDPR | Nigerian user data in Nigeria; DSAR workflow; 7-year audit retention |
| GDPR | Right to erasure; data portability |
| Data minimization | No customer PII beyond what's in the platform message |
| Audit trail | Immutable; no update/delete on audit log |

---

## 12. Edge Cases

| ID | Scenario | Behavior |
|----|----------|---------|
| EC-01 | Customer sends 10 rapid-fire messages | Grouped into single thread; single routing decision |
| EC-02 | Customer messages from Twitter AND Instagram (same person) | Linked in UI; responses go to originating platform only |
| EC-03 | Agent sends response just as platform API goes down | Optimistic send + retry 3 times; if all fail, mark as failed with manual retry option |
| EC-04 | Crisis detected while agent has response in draft | Overlay alert shows; approval required before send |
| EC-05 | Template variable references missing customer data | Variable highlighted in red; agent must fill or remove before send |
| EC-06 | Two agents attempt to respond to same message simultaneously | First send wins; second gets conflict warning with "send as follow-up" option |
| EC-07 | Customer deletes their original message (platform feature) | Show `[Message deleted by user]` placeholder; metrics and audit preserved |
| EC-08 | Routing rule references a deleted team | Rule validation catches; admin notified; rule disabled until fixed |
| EC-09 | Legal hold placed on active conversation | Prevents closure and deletion; flag shown; audit preserved |
| EC-10 | Nigerian Pidgin message from VIP influencer | Pidgin routing rule AND VIP routing rule both match; highest priority rule wins |
| EC-11 | Bot/spam wave from same pattern (100+ messages) | Author rate-limited; batch queued for review; manager alerted |
| EC-12 | Platform API rate limit hit during bulk publish | Pause bulk; resume after backoff; show progress and estimated resume time in WAT |

---

## 13. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-EH-01 | WhatsApp Business integration (Nigeria's dominant messaging app) | 🔴 High | Phase 5 — Q1 2027 |
| FE-EH-02 | TikTok DMs integration | 🟡 Medium | Phase 6 — Q2 2027 |
| FE-EH-03 | AI-powered full conversation drafting | 🔴 High | Phase 6 — Q2 2027 |
| FE-EH-04 | Customer satisfaction (CSAT) survey delivery | 🔴 High | Phase 5 — Q1 2027 |
| FE-EH-05 | CRM integration (Salesforce, HubSpot) | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-EH-06 | Help desk integration (Zendesk, Freshdesk) | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-EH-07 | Predictive churn detection from engagement patterns | 🟡 Medium | Phase 7 — Q3 2027 |
| FE-EH-08 | Voice message transcription | 🟢 Low | Phase 8 — Q4 2027 |
| FE-EH-09 | Nigerian language support (Yoruba, Hausa, Igbo) | 🔴 High | Phase 8 — Q4 2027 |
| FE-EH-10 | Advanced ₦ ROI attribution modeling | 🟡 Medium | Phase 6 — Q2 2027 |

---

## 14. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| Design Lead | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |

---

## 15. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 1: Authentication** | JWT context for all engagement endpoints |
| **Module 2: Organization & Account Management** | RBAC enforcement; plan limits (message volume, team size) |
| **Module 3 & 5: Listening & Monitoring** | Monitoring mention → engagement handoff; crisis signal feed |
| **Module 4: Social Publishing** | Engagement feedback loop on published content |
| **Module 6: Analytics & Reporting** | Engagement metrics in unified dashboards |
| **Architecture** | RLS isolation patterns; real-time WebSocket patterns |
| **ADRs** | ADR-009 (RLS), ADR-013 (WebSockets) |
| **Database Schema** | engagement_messages, engagement_responses, engagement_templates tables |
| **Security Architecture** | NDPR compliance; PII detection; audit requirements |
| **Engineering Standards** | WAT timezone conventions; ₦ ROI calculations |
| **QA Strategy** | Routing accuracy tests; approval workflow tests; isolation tests |
| **API Reference** | Complete engagement endpoint documentation |
| **Personas** | Bola (specialist), Chidi (manager), Ngozi (crisis), Ifeoma (agency) |
| **User Journeys** | Journey 6 (Engagement & Response), Journey 4 (Crisis Response) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified Engagement Hub module. Merges and improves both source documents. Adds: Nigerian market calibration throughout (Nigerian Pidgin detection and routing, WAT timezone in all SLA calculations and notifications, Nigerian crisis keyword pre-sets for banking/fintech/telecom, Nigerian influencer tier classification, NDPR-specific PII detection for BVN/NIN, ₦ ROI analytics), 6-tier RBAC matrix replacing 4-tier, complete RLS-protected database schema, crisis response workflow for Nigerian social media context, escalation framework with WAT business hours, Nigerian market template library, compliance rules for CBN/NCC/NAFDAC regulated sectors, and WhatsApp Business as first-priority future enhancement. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to routing logic, approval workflows, compliance rules, or platform integrations must be reflected in this document before implementation begins.*