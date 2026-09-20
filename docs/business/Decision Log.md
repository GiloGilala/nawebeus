# Nawebeus — Social Media Management Platform
## Decision Log
**Document Version:** 1.0.0
**Date:** 2026-07-20
**Status:** Active
**Owner:** Executive Team & Product Management
**Document Type:** Business → Decision Log
**Framework:** Universal Product Documentation Framework (UPDF)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Decision Summary Index](#2-decision-summary-index)
3. [Strategic Decisions](#3-strategic-decisions)
4. [Product Decisions](#4-product-decisions)
5. [Pricing & Business Model Decisions](#5-pricing--business-model-decisions)
6. [Go-to-Market Decisions](#6-go-to-market-decisions)
7. [Partnership & Integration Decisions](#7-partnership--integration-decisions)
8. [Infrastructure & Technical Decisions](#8-infrastructure--technical-decisions)
9. [Compliance & Legal Decisions](#9-compliance--legal-decisions)
10. [Team & Organization Decisions](#10-team--organization-decisions)
11. [Funding & Financial Decisions](#11-funding--financial-decisions)
12. [Deferred Decisions](#12-deferred-decisions)
13. [Open Decisions (Pending)](#13-open-decisions-pending)
14. [Decision Principles & Process](#14-decision-principles--process)
15. [Decision Categories Summary](#15-decision-categories-summary)
16. [Document Governance](#16-document-governance)
17. [Approval](#17-approval)

---

## 1. Executive Summary

This Decision Log documents all significant business, product, technical, and operational decisions made for the Nawebeus platform. Each entry captures the context that made a decision necessary, the alternatives that were seriously considered, the rationale for the choice made, and the expected impact on the business.

This document is the institutional memory for Nawebeus decisions. It serves four purposes:

1. **Transparency** — every significant decision is visible to the full team and stakeholders
2. **Context preservation** — future team members can understand *why* things are the way they are, not just what they are
3. **Debate prevention** — settled decisions are documented; re-litigation requires new evidence, not just opinion
4. **Learning** — decisions are reviewed quarterly; outdated decisions are revised or reversed with documentation

This log complements the technical Architecture Decision Records (ADRs), which cover engineering and infrastructure decisions in deeper technical detail.

**Decision Categories covered in this log:**
- Strategic & Vision
- Product & Features
- Pricing & Business Model
- Go-to-Market & Sales
- Partnerships & Integrations
- Infrastructure & Technical
- Compliance & Legal
- Team & Organization
- Funding & Financial

---

## 2. Decision Summary Index

### 2.1 Status Key

| Status | Meaning |
|--------|---------|
| **Approved** | Decision made and authorized; implementation in progress or complete |
| **Implemented** | Decision fully executed; outcome being monitored |
| **Deferred** | Considered and postponed to a named future phase or date |
| **Open** | Under active consideration; decision not yet made |
| **Superseded** | Replaced by a later decision; original entry preserved for history |
| **Rejected** | Considered and formally rejected; documented to prevent re-litigation |

### 2.2 Approved Decisions

| ID | Date | Category | Decision | Status |
|----|------|----------|----------|--------|
| DEC-001 | 2025-09-15 | Strategic | Launch as multi-tenant SaaS | Approved |
| DEC-002 | 2025-09-20 | Strategic | Platform positioning: "The first unified social media and PR platform built for Africa" | Approved |
| DEC-003 | 2025-09-25 | Strategic | Geographic focus: Nigeria first, then West Africa, then global | Approved |
| DEC-004 | 2025-09-28 | Strategic | Data sovereignty: all Nigerian customer data stored within Nigeria | Approved |
| DEC-005 | 2025-10-01 | Product | Focus on five core modules: Grow, Listen, Monitor, Engage, Analyze | Approved |
| DEC-006 | 2025-10-05 | Product | Platform name: Nawebeus | Approved |
| DEC-007 | 2025-10-10 | Product | English-only at launch; multi-language in Year 2 | Approved |
| DEC-008 | 2025-10-15 | Product | Web-only at launch; native mobile in Year 2 (Phase 6) | Approved |
| DEC-009 | 2025-10-20 | Product | Support 5 social platforms at launch: YouTube, X, Instagram, Facebook, Reddit | Approved |
| DEC-010 | 2025-10-25 | Product | Defer LinkedIn, TikTok, Pinterest integrations to Phase 2 | Approved |
| DEC-011 | 2025-10-30 | Product | Defer advanced AI/ML features to Phase 7 (Year 2) | Approved |
| DEC-012 | 2025-11-05 | Product | Defer white-labeling and agency resale to Phase 9 | Approved |
| DEC-013 | 2025-11-10 | Product | Defer enterprise SSO (SAML, Okta, Azure AD) to Phase 9 | Approved |
| DEC-014 | 2025-11-15 | Pricing | Freemium model with three tiers: Free, Pro, Enterprise | Approved |
| DEC-015 | 2025-11-20 | Pricing | Pro plan priced at ₦158,400/month (~$99 USD equivalent) | Approved |
| DEC-016 | 2025-11-25 | Pricing | Enterprise plan priced at ₦798,400/month (~$499 USD equivalent) | Approved |
| DEC-017 | 2025-11-28 | Pricing | No percentage-based fees; flat subscription only | Approved |
| DEC-018 | 2025-12-01 | Pricing | 14-day free trial of Pro plan; no credit card required | Approved |
| DEC-019 | 2025-12-05 | Pricing | 15% discount on annual billing | Approved |
| DEC-020 | 2025-12-10 | Pricing | Naira as primary billing currency; USD for international customers | Approved |
| DEC-021 | 2025-12-15 | GTM | Target mid-market brands and digital agencies as primary segments | Approved |
| DEC-022 | 2025-12-20 | GTM | Product-led growth for SMB; inside sales for mid-market; field sales for enterprise | Approved |
| DEC-023 | 2025-12-25 | GTM | Content marketing and SEO as primary acquisition channel | Approved |
| DEC-024 | 2026-01-05 | GTM | Beta program: 10–15 customers; free for 3 months; monthly feedback sessions | Approved |
| DEC-025 | 2026-01-10 | Partnerships | Paystack for Naira billing (primary); Stripe for USD billing (international) | Approved |
| DEC-026 | 2026-01-15 | Partnerships | Integrate with YouTube Data API v3, X API v2, Instagram Graph API, Facebook Graph API, Reddit API | Approved |
| DEC-027 | 2026-01-20 | Partnerships | Use NewsAPI and Mediastack for media monitoring | Approved |
| DEC-028 | 2026-01-25 | Partnerships | Use Resend for transactional email | Approved |
| DEC-029 | 2026-01-30 | Infrastructure | Self-host on Coolify with containerized services | Approved |
| DEC-030 | 2026-02-05 | Infrastructure | Technology stack: TanStack Start, Hono, Drizzle ORM, PostgreSQL | Approved |
| DEC-031 | 2026-02-10 | Infrastructure | Single deployable service with two entry points (web + API) | Approved |
| DEC-032 | 2026-02-15 | Compliance | GDPR, CCPA, NDPR compliance at launch | Approved |
| DEC-033 | 2026-02-20 | Compliance | SOC 2 Type II and ISO 27001 certification in Year 2 | Approved |
| DEC-034 | 2026-02-25 | Team | Hire 8–12 people for MVP launch | Approved |
| DEC-035 | 2026-03-01 | Funding | Close pre-seed round at ₦800,000,000 (~$500K USD equivalent) | Approved |
| DEC-036 | 2026-03-05 | Funding | Target seed round of ₦4,800,000,000 (~$3M USD equivalent) in Q1 2026 | Approved |
| DEC-037 | 2026-03-10 | Funding | Target Series A of ₦16,000,000,000–₦24,000,000,000 (~$10–15M) in Q4 2026/Q1 2027 | Approved |
| DEC-039 | 2026-09-20 | Infrastructure & Technical | Role hierarchy: platform `super_admin` + per-org `owner/admin/manager/creator/analyst/viewer`; drop `org_admin`/`member` pre-prod | Approved |

### 2.3 Deferred Decisions

| ID | Date Raised | Category | Decision | Deferred Until | Owner |
|----|-------------|----------|----------|---------------|-------|
| DEC-D001 | 2026-04-01 | Product | Public API strategy and developer marketplace | Phase 8 (Q1 2027) | Product Lead |
| DEC-D002 | 2026-04-05 | Infrastructure | On-premise / customer-hosted deployment option | Year 2 | Engineering Lead |
| DEC-D003 | 2026-04-10 | Product | Influencer management module | Phase 4 | Product Lead |
| DEC-D004 | 2026-04-15 | Product | Social media publishing and scheduling | Phase 5 | Product Lead |

### 2.4 Open Decisions (Pending)

| ID | Date Raised | Category | Decision | Owner |
|----|-------------|----------|----------|-------|
| DEC-O001 | 2026-05-01 | Product | When to launch mobile app: Q3 2026 vs Q1 2027 | Product Lead |
| DEC-O002 | 2026-05-05 | Product | Which AI features to prioritize in Phase 7 | Product Lead |
| DEC-O003 | 2026-05-10 | GTM | When to expand to South Africa and Kenya: Q2 2027 vs Q4 2027 | Marketing Lead |
| DEC-O004 | 2026-05-15 | Pricing | Whether to add a Team plan between Pro and Enterprise | Product Lead |
| DEC-O005 | 2026-05-20 | Compliance | Whether to pursue HIPAA compliance for healthcare vertical | Legal Director |
| DEC-O006 | 2026-05-25 | Infrastructure | When to migrate from Coolify to Kubernetes | DevOps Lead |
| DEC-O007 | 2026-06-01 | Product | Whether to acquire a competitor or build organically | Executive Team |
| DEC-O008 | 2026-06-05 | Pricing | Exchange rate review trigger thresholds (beyond 10% CBN movement policy) | Finance Lead |

---

## 3. Strategic Decisions

### DEC-001: Launch as Multi-Tenant SaaS

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-001 |
| **Date** | 2025-09-15 |
| **Category** | Strategic |
| **Status** | Approved |
| **Deciders** | Executive Team, Product Lead, Engineering Lead |
| **Reversibility** | Low — architectural decision; reversing would require significant rework |

**Context:**
Nawebeus needed to choose its delivery model from the outset. The decision would constrain the technical architecture, pricing model, go-to-market motion, and unit economics for the life of the product.

**Decision:**
Launch Nawebeus as a **multi-tenant SaaS platform** with strict data isolation enforced at both the database (schema-level) and application (row-level security) layers. Support self-hosted deployment via Coolify for customers requiring data sovereignty.

**Rationale:**
- **Lower customer friction:** Customers sign up and receive value in minutes, not days. No installation, no configuration, no IT team required.
- **Operational efficiency:** Single codebase; simultaneous updates to all customers; shared infrastructure reduces cost
- **Better unit economics:** Gross margins >75% achievable on shared infrastructure; single-tenant economics rarely exceed 50%
- **Scalability:** Multi-tenant architecture designed to support 50,000+ organizations without re-architecture
- **Data sovereignty option:** Self-hosted deployment via Coolify addresses NDPR requirements and enterprise data residency concerns without sacrificing the SaaS model

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Single-tenant (per-customer installation)** | High operational overhead; slow customer onboarding; poor unit economics; impossible to maintain at scale |
| **Hybrid managed single-tenant** | Complexity without clear demand; combines costs of both models without the benefits of either |
| **Open-source self-hosted only** | Requires fundamentally different business model; eliminates predictable recurring revenue; unsupported by target customer profile |

**Impact:**
- **Positive:** Faster time-to-value; lower CAC; better margins; faster iteration velocity; ability to ship improvements daily
- **Negative:** Requires robust multi-tenant security from Day 1; some customers have initial concerns about data isolation in shared infrastructure
- **Mitigation:** Schema-level and row-level security designed in from Day 1; SOC 2 Type II and ISO 27001 certifications planned for Year 2; self-hosted option addresses regulated industries

---

### DEC-002: Platform Positioning

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-002 |
| **Date** | 2025-09-20 |
| **Category** | Strategic |
| **Status** | Approved |
| **Deciders** | Executive Team, Marketing Lead, Product Lead |
| **Reversibility** | Medium — positioning can evolve, but brand investment is partly sunk |

**Context:**
Nawebeus needed to define its market positioning clearly enough to guide all product, marketing, and sales decisions — and to be ownable and memorable in a crowded market.

**Decision:**
Position Nawebeus as **"The first unified social media and PR platform built for Africa"** — emphasizing unification (the #1 customer pain), the complete scope (social + PR), and African-first identity (the primary competitive differentiator against international incumbents).

**Rationale:**
- **"First"** establishes category leadership; no incumbent claims this space with this combination
- **"Unified"** directly addresses tool fragmentation, the #1 validated pain point (93% of interview respondents)
- **"Social media and PR"** captures the full scope — social listening, media monitoring, engagement, analytics, and growth campaigns
- **"Built for Africa"** is ownable, differentiating, and true — no global competitor offers Naira billing, NDPR compliance, and African local support simultaneously
- A/B testing confirmed "One platform. Five capabilities. Zero fragmentation." as the highest-converting message (12.5% conversion rate)

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **"The most affordable enterprise social media platform"** | Price is not sustainable as a sole differentiator; attracts price-sensitive customers with high churn |
| **"The African alternative to Meltwater"** | Positions us as a copycat; Meltwater is not well-known in target segments; limits ambition |
| **"AI-powered social intelligence platform"** | Doesn't capture the PR and engagement dimensions; AI is table stakes, not a differentiator |
| **"The only five-in-one social platform"** | Accurate globally but doesn't leverage the African-first advantage that no competitor can replicate |

**Impact:**
- Guides all marketing and sales messaging across channels
- Informs feature prioritization — every feature must serve the "unified" promise
- Differentiates Nawebeus from international competitors on a dimension they cannot match

---

### DEC-003: Geographic Focus

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-003 |
| **Date** | 2025-09-25 |
| **Category** | Strategic |
| **Status** | Approved |
| **Deciders** | Executive Team, Marketing Lead, Sales Lead |
| **Reversibility** | Medium — geographic priorities can be adjusted based on traction |

**Context:**
Nawebeus needed to define its geographic launch sequence. A pan-African or global launch would spread resources too thin; too narrow a focus would limit growth.

**Decision:**
**Year 1:** Launch in Nigeria as primary market; North America, UK, Australia as secondary English-speaking markets. **Year 2:** Expand to South Africa and Kenya. **Year 3:** Broader Africa (Ghana, Egypt, East Africa) and APAC.

**Rationale:**
- Nigeria is home market with strongest network, deepest market knowledge, and Naira infrastructure already in place
- Nigerian digital economy is the largest in Africa by GDP and SaaS adoption
- North America, UK, and Australia offer large English-speaking markets immediately accessible with English-only product
- South Africa (POPIA) and Kenya are the next highest-priority African markets once regulatory compliance is ready
- Phased expansion allows each market to be entered properly rather than spread thinly across all markets simultaneously

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Pan-African launch** | Requires simultaneous localization, compliance, and support across 5+ countries; spreads team too thin |
| **South Africa first** | Team network and NDPR compliance infrastructure are stronger in Nigeria |
| **Global launch from Day 1** | Cannot compete globally against Hootsuite and Sprout Social without African differentiation established first |
| **North America only** | Abandons the strongest competitive advantage (African-first) before it is established |

**Impact:**
- Guides hiring decisions (local market expertise in target countries)
- Informs product localization roadmap (French, Swahili for Year 3)
- Defines sales and marketing investment priorities by quarter

---

### DEC-004: Data Sovereignty and NDPR Compliance

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-004 |
| **Date** | 2025-09-28 |
| **Category** | Strategic |
| **Status** | Approved |
| **Deciders** | Legal Director, Engineering Lead, Executive Sponsor |
| **Reversibility** | Low — data architecture decisions are foundational |

**Context:**
Nigerian Data Protection Regulation (NDPR) requires that personal data of Nigerian citizens be stored within Nigeria. Beyond legal compliance, data sovereignty is a competitive advantage in a market where international tools store African data on US or EU servers.

**Decision:**
All Nigerian customer data stored within Nigeria via self-hosted VPS infrastructure (Coolify-managed). Regional expansion plans will replicate the local storage model in each target market (South Africa for POPIA, Kenya for Kenya Data Protection Act).

**Rationale:**
- NDPR compliance is a legal requirement, not optional
- Self-hosting provides full control over data location, security configuration, and compliance posture
- Nigerian data sovereignty builds customer trust — particularly in financial services and government segments where data residency concerns are acute
- Self-hosted model can be replicated market-by-market as Nawebeus expands geographically
- Differentiates from all international competitors who cannot credibly offer Nigerian data residency

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **AWS Global (US East)** | Data sovereignty risk for NDPR; higher recurring costs; data leaves Nigeria |
| **AWS Africa (Cape Town)** | South Africa, not Nigeria; still doesn't satisfy NDPR data localization for Nigerian citizens |
| **Hybrid cloud + on-premise** | Operational complexity for small team; unclear compliance boundary |
| **Partner with Nigerian data center** | Less control; dependency on third-party operational reliability; higher ongoing cost |

**Impact:**
- Defines infrastructure architecture (self-hosted VPS in Nigeria)
- Enables financial services and government sales that require local data residency
- Differentiates from all international competitors on a dimension they cannot easily match

---

## 4. Product Decisions

### DEC-005: Five Core Modules

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-005 |
| **Date** | 2025-10-01 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead, Executive Sponsor |
| **Reversibility** | Medium — modules can be added; removing would create customer regression |

**Context:**
The social media management market has dozens of possible features and capabilities. Nawebeus needed to define its core value proposition with enough focus to be excellent, and enough breadth to be genuinely unified.

**Decision:**
MVP delivers five core modules: **Grow** (viral giveaway campaigns), **Listen** (social listening and sentiment), **Monitor** (media and press monitoring with SOV), **Engage** (unified inbox), and **Analyze** (unified analytics and custom reports).

**Rationale:**
- Customer interviews validated strong demand for all five capabilities (85–93% of respondents cited each as important)
- No competitor offers all five natively — this is the structural market gap and Nawebeus's primary USP
- Together, the five modules replace 6–10 separate SaaS tools; individually, each module is only a point solution
- Cross-module data flow creates compounding value — a mention in Listen triggers engagement in Engage, appears in Monitor SOV, contributes to Analyze dashboards, and informs audience segmentation in Grow

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Publishing-only** | Commoditized by Buffer, Hootsuite; insufficient differentiation |
| **Listening-only** | Commoditized by Brandwatch, Mention; insufficient differentiation |
| **Engagement-only** | Commoditized by Sprout Social; insufficient differentiation |
| **All 10+ modules at MVP** | Would delay launch by 6+ months; quality across all modules would suffer |
| **Media monitoring + social only (no Grow)** | Eliminates the only growth campaign capability in the market; unique differentiator |

**Impact:**
- Clear value proposition and differentiation; cross-module synergies create switching costs
- High engineering effort — each module must be excellent, not just functional
- Mitigation: Core features per module delivered first; advanced features deferred to future phases

---

### DEC-006: Platform Name — Nawebeus

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-006 |
| **Date** | 2025-10-05 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Executive Team, Marketing Lead, Product Lead |
| **Reversibility** | Very Low — brand investment cannot be recovered after launch |

**Context:**
The platform needed a name that was distinctive, memorable, authentically African, and available for trademark and domain registration.

**Decision:**
Name the platform **"Nawebeus"** — a fusion of "Naija" (colloquial term for Nigeria, expressing pride and identity) and "Webeus" (derived from "web of us," capturing community, connection, and digital ecosystem).

**Rationale:**
- Distinctive and memorable — unlike generic alternatives (BrandNexus, SocialPulse)
- Authentically African — Naija root resonates with Nigerian and African identity without being limiting
- Captures the mission — a web connecting brands with their audiences and communities
- Domain and trademark available in key markets (Nigeria, USA, UK, EU)

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Brandify** | Generic; already in use in multiple markets; no trademark available |
| **SocialPulse** | Too generic; doesn't capture PR and media intelligence dimension |
| **AfriPR** | Too narrow (PR only); doesn't capture social management scope |
| **BrandNexus** | Generic; trademark concerns in multiple jurisdictions |
| **MediaWatch Africa** | Too descriptive; limited; monitoring-only connotation |

**Impact:**
- Defines brand identity, visual design direction, and tone of voice
- Informs marketing, sales, and product positioning
- Domain and trademark secured in key markets

---

### DEC-007: English-Only at Launch

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-007 |
| **Date** | 2025-10-10 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead, Executive Sponsor |
| **Reversibility** | Medium — localization can be added; removing language support would be regression |

**Context:**
Nawebeus needed to decide on language support at launch. Multi-language support accelerates geographic expansion but adds significant development and maintenance cost.

**Decision:**
Launch with **English-only** support. Add French and Swahili in Year 2 (supporting West African French-speaking markets and East Africa), and additional languages in Year 3.

**Rationale:**
- English-only reduces launch scope and accelerates time-to-market by 6–8 weeks
- Target launch markets (Nigeria primary; North America, UK, Australia secondary) are all English-first
- 100% of beta participants were English-speaking
- Localization costs are significant — translation, UI adaptation, ongoing content maintenance, and customer support in each language
- French is the priority Year 2 language given Francophone West Africa market opportunity (Côte d'Ivoire, Senegal, Cameroon)

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Multi-language at launch (English + French)** | Delays launch by 6–8 weeks; high ongoing maintenance cost |
| **English + Yoruba/Hausa** | Limited business application; target enterprise customers work in English |
| **English + Spanish** | Not relevant to African expansion; minimal additional market access in Year 1 |

**Impact:**
- Faster launch; lower initial development cost
- Excludes Francophone African markets initially; French-speaking African enterprises must wait for Year 2
- Mitigation: Localization architecture designed in from Day 1 to avoid rework when languages are added

---

### DEC-008: Web-Only at Launch; Native Mobile in Phase 6

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-008 |
| **Date** | 2025-10-15 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead, Executive Sponsor |
| **Reversibility** | Medium — mobile can be added; removing it after launch would create regression |

**Context:**
77% of pre-launch interviewees expressed desire for mobile access. However, native mobile development would significantly delay or complicate MVP delivery.

**Decision:**
Launch with **responsive web only** — full mobile-responsive design that works on all devices. Develop native iOS + Android apps in Phase 6 (Q3 2026).

**Rationale:**
- Native mobile development would delay launch by 3–6 months or require doubling the engineering team
- Enterprise users manage social media primarily from desktop; mobile is a secondary use case for the primary personas
- High-quality responsive web serves mobile needs adequately for MVP evaluation and onboarding
- 100% of beta participants accepted responsive web for MVP; mobile app was requested as an enhancement, not a blocking requirement

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Native iOS + Android at launch** | Delays launch by 3–6 months; doubles engineering effort |
| **Progressive Web App (PWA)** | Limited native capabilities (push notifications, camera, background sync); poor user experience on iOS |
| **React Native cross-platform** | Still delays launch; cross-platform quality compromises |

**Impact:**
- Faster launch; focused engineering effort on web platform quality
- Some community managers and field users prefer native apps for on-the-go engagement
- Mitigation: Responsive web built to the highest standard; native apps in Phase 6 with full platform feature parity

---

### DEC-009: Five Social Platforms at Launch

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-009 |
| **Date** | 2025-10-20 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead |
| **Reversibility** | High — platforms can be added without removing existing ones |

**Context:**
Social media management requires integrations with multiple platforms. Each integration requires 4–8 weeks of development, API approval, and ongoing maintenance. Nawebeus needed to decide which platforms to prioritize.

**Decision:**
Support **YouTube, X (Twitter), Instagram, Facebook, and Reddit** at launch. Defer LinkedIn, TikTok, and Pinterest to Phase 2 (Year 2).

**Rationale:**
- These 5 platforms cover 80%+ of social media activity for the target customer segments
- Customer interviews confirmed these 5 are the most important for mid-market brands, agencies, and African enterprises
- All 5 have well-documented, mature APIs with OAuth support and clear terms of service
- 5 integrations are achievable within the MVP timeline; 8 would add 12–24 weeks

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **All 8+ platforms at launch** | Adds 12–24 weeks; quality of each integration would suffer; API approval timelines unpredictable |
| **Top 3 only (YouTube, X, Instagram)** | Excludes Facebook (still dominant in African markets) and Reddit (critical for brand listening in tech segments) |
| **YouTube, X, Instagram, Facebook only** | Reddit is important for brand reputation tracking in technology and startup segments |

**Impact:**
- Focused, high-quality integrations at launch; covers dominant platforms for all primary personas
- LinkedIn exclusion is the most significant limitation — many B2B customers use LinkedIn; addressed in Phase 2
- TikTok exclusion affects consumer brands; addressed in Phase 2

---

### DEC-010: Defer LinkedIn, TikTok, Pinterest to Phase 2

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-010 |
| **Date** | 2025-10-25 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead |
| **Reversibility** | High — can accelerate if customer demand warrants |

**Context:**
LinkedIn, TikTok, and Pinterest are important platforms but have restrictive, complex, or still-maturing APIs that add risk and timeline uncertainty to MVP delivery.

**Decision:**
**Defer LinkedIn, TikTok, and Pinterest integrations to Phase 2** (Q3–Q4 2026). Communicate the roadmap clearly to prospects who depend on these platforms.

**Rationale:**
- **LinkedIn API:** Access to organic post analytics requires LinkedIn Marketing Developer Platform approval, which takes 4–8 weeks and is not guaranteed; limited data available vs. other platforms
- **TikTok API:** API is still maturing; usage policies changed significantly in 2023–2024; long-term viability of third-party access is uncertain
- **Pinterest:** Smaller active user base in target segments; lower ROI for integration investment compared to LinkedIn and TikTok
- All three can be delivered in Phase 2 once MVP is established and API access is secured in advance

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Include LinkedIn at launch** | API approval timeline adds 4–8 weeks of uncertainty; limited data access vs. other platforms |
| **Include TikTok at launch** | API policy instability creates maintenance risk; not yet worth the investment |
| **Include all three** | Unacceptable risk to launch timeline; quality of 5 existing integrations would suffer |

**Impact:**
- Some B2B prospects require LinkedIn; addressed with clear Phase 2 roadmap communication
- TikTok exclusion affects consumer brand prospects; addressed with Phase 2 commitment
- Mitigation: LinkedIn and TikTok API access applications submitted during Phase 1 to pre-approve access before Phase 2 development begins

---

### DEC-011: Defer Advanced AI/ML to Phase 7

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-011 |
| **Date** | 2025-10-30 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead, Executive Sponsor |
| **Reversibility** | Medium — AI capabilities can be added; removing them after launch creates regression |

**Context:**
AI-driven features are increasingly expected in social media management tools. However, advanced AI requires significant R&D investment and training data that only accumulates post-launch.

**Decision:**
Include **basic AI/ML at launch** — sentiment classification (positive / negative / neutral), mention spike detection, and basic crisis alerting. **Defer advanced AI/ML** — predictive analytics, auto-response suggestions, content generation, and influence scoring — to Phase 7 (Q4 2026).

**Rationale:**
- Basic sentiment analysis is achievable using third-party APIs (OpenAI, Hugging Face) without custom model training
- Advanced AI requires training on customer data that only accumulates post-launch; building these models pre-launch would be training on synthetic data
- Advanced AI adds 3–4 months to MVP timeline; the basic AI delivered at launch already exceeds most mid-market competitor offerings
- Customers validated basic AI as "must-have"; advanced AI as "important but not blocking"

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **All AI features at launch** | Adds 3–4 months to timeline; requires data that doesn't exist pre-launch |
| **No AI at launch** | Sentiment analysis is table stakes in 2026; would appear behind competitors |
| **AI via third-party only (no proprietary models)** | Acceptable for launch; Phase 7 adds proprietary model development |

**Impact:**
- Launch includes meaningful AI (sentiment, spike detection, crisis alerting) — competitive with mid-market alternatives
- Advanced AI (predictive analytics, auto-responses) positions Nawebeus above mid-market alternatives in Phase 7
- Mitigation: Third-party AI APIs (OpenAI, Hugging Face) deliver reliable basic AI at launch without custom model investment

---

### DEC-012: Defer White-Labeling and Agency Resale to Phase 9

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-012 |
| **Date** | 2025-11-05 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Executive Sponsor |
| **Reversibility** | High — can be prioritized earlier if agency demand warrants |

**Context:**
Digital and PR agencies frequently request white-labeling — the ability to present Nawebeus under their own brand to clients. This is a high-value feature for the agency segment but requires significant UI customization infrastructure.

**Decision:**
**Defer white-labeling and agency resale capabilities to Phase 9.** Agencies use Nawebeus under their own organization workspace for MVP.

**Rationale:**
- White-labeling requires a full custom branding system (custom domains, logo, color schemes, email templates) that adds 2–3 months to MVP delivery
- Agencies can use Nawebeus effectively without white-labeling; the multi-tenant workspace isolation already provides client data separation
- Beta agency participants confirmed they would adopt without white-labeling for MVP
- White-labeling becomes more valuable as the platform matures and agency deployments scale

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **White-labeling at launch** | 2–3 months added to timeline; not required for initial agency adoption |
| **Custom domain only** | Partial solution; creates customer expectation of full white-labeling |
| **Agency resale program only (no UI white-label)** | Possible; deferred alongside white-labeling for clean Phase 9 scope |

**Impact:**
- Some agencies may delay full adoption until white-labeling is available
- Mitigation: Clearly communicate Phase 9 white-labeling roadmap; agency partner program does not require white-labeling to participate

---

### DEC-013: Defer Enterprise SSO to Phase 9

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-013 |
| **Date** | 2025-11-10 |
| **Category** | Product |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead, Executive Sponsor |
| **Reversibility** | High — SSO can be added as an Enterprise-tier feature |

**Context:**
Enterprise customers frequently require SSO (SAML 2.0, Okta, Azure AD) as a security and IT management requirement. However, SSO integration with multiple identity providers is complex and time-consuming.

**Decision:**
**Defer enterprise SSO to Phase 9.** Launch with email/password authentication plus optional TOTP-based multi-factor authentication (MFA).

**Rationale:**
- SSO integration with SAML, Okta, and Azure AD is complex; implementing all three adds 6–8 weeks to MVP timeline
- Most mid-market customers do not require SSO initially; it is an enterprise segment gating requirement
- MFA provides adequate security for MVP launch and mid-market segment
- SSO is a Phase 9 investment that unlocks the enterprise segment when Nawebeus is ready for enterprise-level procurement requirements

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **SAML only at launch** | Only addresses some enterprise requirements; Okta and Azure AD would still be missing |
| **Okta only at launch** | Vendor-specific; incomplete; other identity providers still excluded |
| **All SSO providers at launch** | 8–12 weeks of additional development; dilutes MVP focus |

**Impact:**
- Some enterprise customers may delay procurement until SSO is available
- Mitigation: Offer custom SSO implementation for high-value enterprise deals on a case-by-case basis; plan Phase 9 SSO to unlock enterprise segment formally

---

## 5. Pricing & Business Model Decisions

### DEC-014: Freemium Model with Three Tiers

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-014 |
| **Date** | 2025-11-15 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Product Lead, Finance Lead |
| **Reversibility** | Medium — pricing model can evolve; existing customers on current tiers must be grandfathered |

**Context:**
Nawebeus needed to choose its fundamental pricing model. The choice would determine the customer acquisition motion, revenue predictability, and market positioning.

**Decision:**
Adopt a **freemium subscription model** with three tiers: **Free** (₦0), **Pro** (₦158,400/month), and **Enterprise** (₦798,400/month). Free tier serves as a conversion funnel and brand ambassador channel. Pro is the primary revenue driver. Enterprise captures high-volume, high-complexity customers.

**Rationale:**
- Free tier enables product-led growth; users who experience value without payment become advocates and referral sources
- Clear upgrade path between tiers with 10–100x capacity differences drives natural conversion
- Freemium is the dominant model in MarTech — customers expect to evaluate before purchasing
- Customer interviews showed 80% would pay ₦99,000–₦499,000/month equivalent for a unified platform; our Naira pricing at ₦158,400 and ₦798,400 reflects market rate with local currency advantage

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Per-seat pricing** | Punishes team growth; 73% of interviewees expressed frustration with per-seat models (Sprout Social); misaligned with customer success |
| **Usage-based only** | Unpredictable for customers (budget uncertainty); hard to forecast MRR; creates anxiety around usage |
| **Enterprise-only (no free tier)** | Excludes SMBs and trial users; slower growth; no product-led motion; higher CAC |
| **Flat-rate single tier** | Cannot serve the full spectrum from individual practitioner to large agency without leaving value on the table |

**Impact:**
- Low-friction entry enables fast top-of-funnel growth; free tier users become brand ambassadors
- Free tier requires conversion optimization to prevent it becoming a permanent home for non-paying users
- Mitigation: Free tier limits are strict and clearly communicated; in-app upgrade prompts triggered at 80% of limit usage

---

### DEC-015: Pro Plan at ₦158,400/month

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-015 |
| **Date** | 2025-11-20 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Product Lead, Finance Lead |
| **Reversibility** | Medium — price changes require 30-day customer notice |

**Context:**
Nawebeus needed to set the Pro plan price. The price needed to be competitive against incumbents, reflect the genuine value delivered, and be accessible to Nigerian mid-market customers paying in Naira.

**Decision:**
Price the Pro plan at **₦158,400/month** billed monthly (≈$99/month at ₦1,600/USD), or **₦1,617,408/year** when billed annually (15% discount).

**Rationale:**
- Competitive against Hootsuite ($99/month) while delivering significantly more: five modules vs. three, native listening and monitoring vs. add-ons
- Substantially cheaper than Sprout Social ($249/month per user), Brandwatch ($1,667+/month), and equivalent tool stacks (₦3,200,000–₦8,000,000+/month)
- Van Westendorp pricing analysis identified ₦158,400/month (~$99) as the optimal price point — perceived as fair value, not cheap, not expensive
- 80% of customer interviewees confirmed ₦99,000–₦499,000/month equivalent acceptable; Naira pricing at ₦158,400 is in range
- Allows for >75% gross margin at projected infrastructure costs

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **₦79,200/month (~$49)** | Too low; doesn't reflect value; lower margin; attracts non-serious customers |
| **₦239,000/month (~$149)** | Reduces competitive advantage vs. Hootsuite; reduces conversion from free tier |
| **₦319,000/month (~$199)** | Matches Agorapulse; loses price differentiation; Van Westendorp shows this in "expensive" zone |
| **₦398,400/month (~$249)** | Matches Sprout Social; loses significant price advantage; Van Westendorp "expensive" |

**Impact:**
- Strong value proposition at competitive price; primary driver of Pro segment acquisition
- Lower ARPU than Sprout Social; requires volume to hit ARR targets — offset by lower CAC via PLG
- Mitigation: Drive volume through product-led growth; expand usage with add-ons; annual contract incentives

---

### DEC-016: Enterprise Plan at ₦798,400/month

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-016 |
| **Date** | 2025-11-25 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Product Lead, Finance Lead |
| **Reversibility** | Medium — price changes require 30-day customer notice |

**Context:**
Nawebeus needed to price the Enterprise plan to capture high-volume customers — large brands, major agencies, and African enterprises — while remaining competitive against enterprise-focused alternatives.

**Decision:**
Price the Enterprise plan at **₦798,400/month** billed monthly (≈$499/month at ₦1,600/USD), or **₦8,143,680/year** when billed annually (15% discount).

**Rationale:**
- Substantially cheaper than Sprinklr (~₦160,000,000+/year), Brandwatch (~₦32,000,000+/year), Meltwater (~₦38,400,000+/year), and Cision (~₦48,000,000+/year)
- Offers unlimited users, 50 social accounts, 100,000 mentions/month, priority support, and audit log access — genuine enterprise capability
- Enterprise customer interviews confirmed willingness to pay ₦499,000–₦999,000/month equivalent for a unified platform with local support and NDPR compliance
- Allows for >78% gross margin at scale

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **₦479,000/month (~$299)** | Too close to Pro; insufficient differentiation for enterprise buyer |
| **₦1,599,000/month (~$999)** | Pushes into Brandwatch territory without the brand recognition to justify it at launch |
| **Custom pricing only** | Slows sales cycle; creates unpredictable revenue; appropriate for custom enterprise deals above the Enterprise tier |

**Impact:**
- Enterprise tier captures highest-value customers with longest contracts and highest NRR
- Requires enterprise sales motion (field sales, consultative selling, longer cycles)
- Mitigation: Build enterprise sales team; pursue SOC 2 and ISO 27001 certifications in Year 2 to support enterprise procurement

---

### DEC-017: No Percentage-Based Fees

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-017 |
| **Date** | 2025-11-28 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Product Lead, Finance Lead |
| **Reversibility** | Low — this is a trust commitment to customers; reversing would damage brand |

**Context:**
Some MarTech platforms charge a percentage of ad spend or GMV. Nawebeus needed to decide whether this model aligned with its mission and customer relationships.

**Decision:**
Nawebeus will **never charge a percentage** of ad spend, campaign revenue, giveaway prize value, or any customer revenue metric. All pricing is based on platform usage dimensions: users, social accounts, mentions, storage, and API calls.

**Rationale:**
- Percentage-based fees create misaligned incentives — the platform has a financial interest in customers spending more, not in customers achieving better outcomes
- 73% of customer interviewees expressed frustration with percentage-based pricing models encountered in other tools
- Flat subscription aligns Nawebeus's revenue with customer usage, not customer expenditure — we grow when customers grow their usage, not when they spend more on campaigns
- Transparency and predictability are core values; percentage-based fees introduce revenue uncertainty for both parties

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Percentage of giveaway prize value** | Creates perverse incentive to recommend larger prizes; misaligned with customer success |
| **Percentage of advertising spend tracked** | Misaligned incentive; penalizes high-spend customers; creates resentment |
| **Hybrid (flat + percentage above threshold)** | Complexity; introduces unpredictability; damages trust at the threshold point |

**Impact:**
- Positive: Customer-friendly; transparent; trust-building; no perverse incentives
- Negative: Limits upside if customers scale spend significantly; offset by volume and add-on growth
- Mitigation: Drive revenue growth through more customers, more accounts, more mentions, and add-on purchases

---

### DEC-018: 14-Day Free Trial; No Credit Card Required

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-018 |
| **Date** | 2025-12-01 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Product Lead, Marketing Lead, Finance Lead |
| **Reversibility** | High — trial terms can be adjusted based on conversion data |

**Context:**
Nawebeus needed to define its trial strategy to balance conversion optimization against friction reduction.

**Decision:**
Offer a **14-day free trial of the Pro plan with no credit card required**. At trial expiration, automatically downgrade to the Free plan. Data retained for 30 days post-downgrade before any deletion.

**Rationale:**
- No credit card requirement reduces top-of-funnel friction; increases trial volume; industry data shows 30–50% more signups without CC requirement
- 14 days is sufficient for a marketing team to evaluate core workflows; 7 days is too short; 30 days delays revenue
- Full Pro plan access (not a limited demo) allows genuine evaluation
- Auto-downgrade to Free (not cancellation) keeps users in the product; Free users can upgrade at any time
- Target trial-to-paid conversion rate: 15–20% within 30 days of trial expiration

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Credit card required** | Reduces signups by 30–50%; justified only if trial abuse is a documented problem |
| **30-day trial** | Delays revenue recognition; longer trials don't consistently improve conversion rates |
| **7-day trial** | Too short; enterprise evaluators cannot complete procurement in 7 days |
| **Money-back guarantee instead of trial** | Requires credit card; creates refund administrative overhead |

**Impact:**
- Higher signup volume; better product evaluation; stronger conversion pipeline
- Some trial users inflate infrastructure cost without converting; managed through Free tier limits on downgrade
- Mitigation: Strong onboarding flow targeting activation (connecting ≥1 social account) within 48 hours; email nurture sequence driving toward conversion

---

### DEC-019: 15% Discount on Annual Billing

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-019 |
| **Date** | 2025-12-05 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Finance Lead |
| **Reversibility** | High — discount level can be adjusted |

**Context:**
Annual billing incentivizes customer commitment, reduces churn, and improves cash flow. Nawebeus needed to decide on the discount level.

**Decision:**
Offer a **15% discount** on annual billing across all paid plans. Annual price is calculated as monthly × 12 × 0.85.

**Rationale:**
- 15% is the industry standard for SaaS annual discounts; customers recognize it as a fair offer
- 10% is insufficient to overcome the inertia of monthly billing for most customers
- 20% erodes gross margin meaningfully at scale
- Annual contracts improve cash flow predictability and reduce monthly churn risk

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **10% discount** | Not compelling enough to shift behavior; most customers stay on monthly |
| **20% discount** | Reduces margins; does not meaningfully outperform 15% in conversion |
| **No annual discount** | Misses cash flow and churn reduction opportunity |
| **Tiered discounts (15% annual, 20% 2-year)** | Multi-year contracts too complex for launch; deferred to Year 2 |

**Impact:**
- Improved cash flow predictability; reduced monthly churn; customer commitment
- Slightly lower effective ARPA for annual customers; offset by lower churn and lower CAC (annual customers require less re-selling)

---

### DEC-020: Naira as Primary Billing Currency

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-020 |
| **Date** | 2025-12-10 |
| **Category** | Pricing |
| **Status** | Approved |
| **Deciders** | Executive Team, Finance Lead, Legal Director |
| **Reversibility** | Low — currency denomination is a trust commitment; changing creates customer confusion |

**Context:**
Nawebeus serves both Nigerian/African customers and international customers. A currency decision affects customer trust, billing simplicity, and FX risk management.

**Decision:**
**Nigerian Naira (₦) is the primary billing currency** for all Nigerian and African customers, processed via Paystack. **USD is the billing currency for international customers** (North America, UK, Australia, Europe), processed via Stripe. Exchange rate reference is CBN official rate, reviewed quarterly; Naira prices adjusted if CBN rate moves more than 10% in a quarter with 30 days notice.

**Rationale:**
- Naira billing eliminates FX risk for Nigerian and African customers — they know exactly what they pay without currency conversion uncertainty
- Paystack provides Nigerian-compliant card processing, bank transfers, and USSD payment options that international processors cannot offer
- USD billing for international customers is standard; Stripe handles tax compliance and multi-currency efficiently
- Exchange rate policy (quarterly review, 10% trigger, 30 days notice) balances business FX risk management with customer predictability

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **USD for all customers** | African customers face FX risk; USD billing signals "foreign product"; Paystack integration cannot process USD |
| **Naira for all customers** | International customers cannot easily pay in Naira; limits global growth |
| **No formal exchange rate policy** | Creates ad hoc pricing decisions; damages customer trust when adjustments happen |

**Impact:**
- Naira-first billing is a genuine competitive differentiator; no international competitor offers this
- Requires maintaining two billing integrations (Paystack + Stripe) and monitoring CBN rate quarterly
- Mitigation: Finance Lead owns the quarterly rate review process; automated alerts trigger review when CBN rate moves >8% (early warning before the 10% policy threshold)

---

## 6. Go-to-Market Decisions

### DEC-021: Target Mid-Market and Agencies as Primary Segments

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-021 |
| **Date** | 2025-12-15 |
| **Category** | GTM |
| **Status** | Approved |
| **Deciders** | Executive Team, Marketing Lead, Sales Lead |
| **Reversibility** | Medium — GTM focus can shift as revenue data accumulates |

**Context:**
Nawebeus needed to define its primary go-to-market segments to focus sales, marketing, and product investment efficiently.

**Decision:**
Target **mid-market brands (50–999 employees) and digital/PR agencies** as primary segments. Enterprise (1,000+ employees) as secondary. SMBs (<50 employees) as long-tail product-led growth.

**Rationale:**
- Mid-market is the largest segment (40% of global market) and the fastest-growing (25% YoY)
- Mid-market is the most underserved — Sprinklr is too expensive; Buffer is too limited; Hootsuite's UX has aged
- Agencies are high-value and high-volume — a single agency brings 10–50 clients; LTV is 5–10x higher than a single mid-market brand
- 80% of beta participants and pre-launch interviewees were mid-market or agency
- Nigerian enterprise segment (financial services, telecom, FMCG) maps to mid-market and enterprise globally

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **SMB only** | Too price-sensitive; high churn; low LTV; product-led growth is more efficient here |
| **Enterprise only** | Long sales cycles; high CAC; SOC 2 not available at launch; would delay first revenue |
| **All segments equally** | Dilutes sales and marketing investment; inefficient resource allocation |

**Impact:**
- Clear segment focus enables targeted content, messaging, and sales playbooks
- SMB handled through self-service PLG without dedicated sales resources
- Enterprise targeted opportunistically via outbound; dedicated enterprise motion in Year 2

---

### DEC-022: Product-Led Growth with Sales Assist

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-022 |
| **Date** | 2025-12-20 |
| **Category** | GTM |
| **Status** | Approved |
| **Deciders** | Marketing Lead, Sales Lead, Executive Team |
| **Reversibility** | Medium — sales motion can evolve as segment mix shifts |

**Context:**
Nawebeus needed to choose its primary sales motion. The choice determines team structure, CAC, and scalability.

**Decision:**
Adopt a **product-led growth (PLG) motion with sales assist**:
- **Free / SMB:** Fully self-service; product drives conversion
- **Pro / Mid-market:** Inside sales; trial-to-paid conversion; low-touch
- **Enterprise:** Field sales; consultative; multi-stakeholder; CSM-supported

**Rationale:**
- 87% of pre-launch interviewees prefer self-service or low-touch sales for initial evaluation
- PLG scales customer acquisition without linear headcount growth; CAC via PLG (₦320,000) is 3–4x lower than direct sales (₦960,000–₦2,400,000)
- Enterprise requires human-led sales regardless of product quality; complex procurement, security reviews, and multi-stakeholder decisions need relationship management
- PLG + sales assist is the proven model for successful B2B SaaS (Slack, Dropbox, Zoom, Notion)

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Self-service only** | Leaves enterprise revenue on the table; no support for complex deals |
| **Sales-led only** | Does not scale; CAC is 5–10x higher; slow growth |
| **PLG only (no sales team)** | Misses enterprise opportunities; longer conversion cycles for mid-market without sales assist |

**Impact:**
- Scalable and efficient; primary CAC efficiency driver
- Requires excellent product quality and onboarding to support self-service motion
- Mitigation: Invest in guided onboarding, in-app help, and activation flows from Day 1

---

### DEC-023: Content Marketing and SEO as Primary Channel

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-023 |
| **Date** | 2025-12-25 |
| **Category** | GTM |
| **Status** | Approved |
| **Deciders** | Marketing Lead, Executive Team |
| **Reversibility** | High — channel mix can be adjusted based on performance data |

**Context:**
Nawebeus needed to prioritize its customer acquisition channels based on CAC efficiency, scalability, and brand-building value.

**Decision:**
Prioritize **content marketing and SEO** as the primary acquisition channel. Supplement with paid advertising (Google, LinkedIn), direct outbound for enterprise, and agency partner channel.

**Rationale:**
- Pre-launch content marketing generated 8,200 waitlist sign-ups at an estimated CAC of ₦320,000 — 3x more efficient than paid advertising (₦960,000) and 7x more efficient than sales outreach (₦2,400,000)
- Content marketing compounds over time — published articles continue generating leads years after publication; paid advertising stops the moment spend stops
- Educational content (social media management guides, African marketing reports) builds brand authority in both Nigerian and global markets
- SEO captures intent-driven traffic from buyers actively searching for solutions

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Paid advertising primary** | High CAC; does not compound; requires ongoing spend to maintain volume |
| **Sales outreach primary** | Very high CAC; does not scale linearly; insufficient for PLG motion |
| **Partnership primary** | Slower to build; dependent on partner quality and commitment; limited reach initially |
| **Events primary** | High cost per lead; geographic constraints; limited digital amplification |

**Impact:**
- Lower blended CAC; compounding returns; builds brand authority over time
- Requires consistent content production capability — content team hired or contracted from launch
- Mitigation: Build editorial calendar 3 months in advance; mix evergreen (SEO) with timely (news, trend commentary)

---

### DEC-024: Beta Program Structure

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-024 |
| **Date** | 2026-01-05 |
| **Category** | GTM |
| **Status** | Approved |
| **Deciders** | Product Lead, Marketing Lead |
| **Reversibility** | High — program parameters can be adjusted |

**Context:**
Nawebeus needed a structured beta program to validate product-market fit, generate early case studies, and build the first cohort of paying customers.

**Decision:**
Run a **closed beta program** with 10–15 participants (Nigerian enterprises, digital agencies, mid-market brands). Free usage for 3 months in exchange for structured feedback. Monthly feedback sessions. Dedicated support. Convert to paying customers at end of beta.

**Rationale:**
- 10–15 participants provides enough diversity for meaningful feedback without spreading support too thin
- Free usage (in exchange for feedback) removes barrier to participation; customers who pay for incomplete software become frustrated
- Closed (not open) beta allows for more engaged, higher-quality feedback relationships
- Monthly structured sessions surface patterns across customers; one-off ad hoc feedback misses systemic issues

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Open beta (unlimited participants)** | Too many support requests; feedback is unfocused; relationships are shallow |
| **Paid beta** | Customers won't pay for incomplete software; damages relationship from the start |
| **5 customers only** | Insufficient diversity; one bad experience skews all learnings |
| **No structured beta** | Launch without validation; higher risk of missing critical product issues |

**Impact:**
- Beta program results (87% activation; 4.3/5 satisfaction; 72% WTP) provided strong product-market fit validation before public launch

---

## 7. Partnership & Integration Decisions

### DEC-025: Paystack (Primary) and Stripe (International) for Payment Processing

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-025 |
| **Date** | 2026-01-10 |
| **Category** | Partnerships |
| **Status** | Approved |
| **Deciders** | Engineering Lead, Finance Lead, Executive Team |
| **Reversibility** | Low — payment processor changes require customer re-authorization of payment methods |

**Context:**
Nawebeus needed payment processors for Naira billing (Nigerian and African customers) and USD billing (international customers). A single global processor cannot satisfy both requirements.

**Decision:**
Use **Paystack** as the primary payment processor for Naira-denominated subscriptions (Nigerian and African customers). Use **Stripe** for USD-denominated subscriptions (international customers).

**Rationale:**
- Paystack is the leading payment processor in Nigeria; supports Naira card payments, bank transfers, USSD, and mobile money — all payment methods Nigerian and African customers actually use
- Paystack is CBN-licensed and compliant with Nigerian payment regulations; using an unlicensed processor creates regulatory risk
- Stripe is the global standard for SaaS subscription billing; excellent developer API, subscription management, and tax compliance for international markets
- Dual processor approach adds minor technical complexity but is the only way to serve both market segments effectively

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Stripe for all customers** | Stripe cannot process Naira card payments for Nigerian customers; limited African payment method support |
| **Paystack for all customers** | Paystack's international coverage and USD subscription billing are limited; insufficient for global expansion |
| **PayPal** | Poor developer API; weak subscription billing; limited African market penetration |
| **Flutterwave** | Strong secondary option; deferred as backup processor if Paystack merchant approval is delayed |

**Impact:**
- Best-in-class payment experience for both Nigerian/African and international customers
- Requires maintaining two billing integrations; complexity is justified by market access
- Mitigation: Paystack merchant application submitted in Phase 0; Flutterwave identified as backup if approval is delayed

---

### DEC-026: Social Platform API Integrations

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-026 |
| **Date** | 2026-01-15 |
| **Category** | Partnerships |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead |
| **Reversibility** | High — integrations can be added or removed based on API availability |

**Context:**
Nawebeus needed to define which social platform APIs to integrate at launch and how to manage the relationship and risk with each platform.

**Decision:**
Integrate with **YouTube Data API v3, X (Twitter) API v2, Instagram Graph API, Facebook Graph API, and Reddit API**. Build an abstraction layer that isolates integration-specific code from core platform logic to reduce the blast radius of any API change.

**Rationale:**
- All five platforms have mature, well-documented APIs with OAuth 2.0 support
- Customer interviews confirmed these five cover 80%+ of active social media use for target segments
- Abstraction layer is a critical risk mitigation — when a platform changes its API (high likelihood), the change is contained and does not require refactoring core application logic

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **All 8 platforms at launch** | Adds 12–24 weeks; quality suffers across all integrations |
| **Top 3 only** | Excludes Facebook (dominant in Africa) and Reddit (critical for brand listening) |
| **No abstraction layer** | Direct integration with platforms creates fragile coupling; any API change requires deep refactoring |
| **Third-party aggregator APIs** | Adds cost, reduces control, creates dependency on aggregator's data quality and uptime |

**Impact:**
- Comprehensive coverage for primary target segments; abstraction layer reduces maintenance burden
- Each platform has different rate limits; per-tenant quota management required to prevent one customer exhausting shared quota

---

### DEC-027: NewsAPI and Mediastack for Media Monitoring

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-027 |
| **Date** | 2026-01-20 |
| **Category** | Partnerships |
| **Status** | Approved |
| **Deciders** | Product Lead, Engineering Lead |
| **Reversibility** | High — news source integrations can be swapped or supplemented |

**Context:**
Nawebeus needed news and article sources for the Monitor module's press coverage tracking. Options ranged from direct publisher integrations to aggregator APIs to RSS feeds.

**Decision:**
Use **NewsAPI and Mediastack** as primary news sources for the Monitor module. Supplement with direct RSS feeds for major African publications. Evaluate African news aggregators for regional coverage depth in Phase 2.

**Rationale:**
- NewsAPI and Mediastack together provide access to 100,000+ news sources globally; sufficient for MVP
- More cost-effective than direct enterprise press databases (Cision, Muck Rack) at launch stage
- Direct RSS feeds for Nigerian and African publications (Punch, Vanguard, TechCabal, BusinessDay) fill African coverage gaps that global aggregators miss
- Multi-source approach reduces dependency on any single provider

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Muck Rack / Cision integration** | Enterprise-priced; not cost-effective for MVP; adds ₦1,600,000+/month to COGS |
| **Direct publisher integrations** | Unscalable at launch; 100,000 publishers cannot all be integrated individually |
| **RSS feeds only** | Limited coverage; inconsistent article extraction quality; manual setup per publication |
| **Single aggregator** | Creates single point of failure; any outage affects entire Monitor module |

**Impact:**
- Comprehensive press coverage for global and African markets
- African coverage requires supplementation with local RSS feeds — these must be curated and maintained
- Mitigation: Multi-source strategy; RSS fallback; African news aggregator evaluation in Phase 2

---

### DEC-028: Resend for Transactional Email

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-028 |
| **Date** | 2026-01-25 |
| **Category** | Partnerships |
| **Status** | Approved |
| **Deciders** | Engineering Lead, Product Lead |
| **Reversibility** | Medium — email provider migration requires DNS and template migration |

**Context:**
Nawebeus needed an email service provider for transactional emails (account verification, password reset, subscription notifications, mention alerts).

**Decision:**
Use **Resend** for transactional email delivery.

**Rationale:**
- Modern API with React Email template support — aligns with TanStack Start / React frontend stack
- Excellent deliverability rates; good sender reputation management
- Competitive pricing; pay-as-you-go model fits startup stage
- Strong developer documentation and SDK

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **SendGrid** | More expensive; more complex configuration; legacy feel |
| **Amazon SES** | Requires AWS dependency; complex setup; deliverability management is manual |
| **Postmark** | More expensive; better for transactional only; limited marketing email capabilities for future use |
| **Self-hosted SMTP** | Deliverability challenges without established sender reputation; high operational overhead |

**Impact:**
- Fast integration; reliable deliverability; good developer experience
- Single email provider creates dependency risk; monitor deliverability actively
- Mitigation: Monitor bounce rates and deliverability weekly; backup provider (SendGrid) evaluated if deliverability issues arise

---

## 8. Infrastructure & Technical Decisions

### DEC-029: Self-Host on Coolify

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-029 |
| **Date** | 2026-01-30 |
| **Category** | Infrastructure |
| **Status** | Approved |
| **Deciders** | Engineering Lead, DevOps Lead, Executive Team |
| **Reversibility** | Low — infrastructure migration is expensive and disruptive |

**Context:**
Nawebeus needed to choose its hosting and deployment model. The choice affects cost, control, data sovereignty compliance, and operational complexity.

**Decision:**
**Self-host on Coolify** with containerized services. Use Hetzner (primary) and DigitalOcean (failover) as underlying VPS infrastructure. Host Nigerian customer data on VPS located in Nigeria to satisfy NDPR requirements.

**Rationale:**
- Self-hosting is 50–70% cheaper than equivalent managed cloud services (AWS ECS, Google Cloud Run) at our scale and stage
- Full control over infrastructure configuration, security posture, and data location — essential for NDPR compliance (data must stay in Nigeria)
- Coolify is an open-source self-hosting platform that handles container orchestration, SSL, reverse proxy, and deployment without requiring Kubernetes expertise at the team's current size
- Not locked into a single cloud vendor; can migrate underlying VPS provider without application changes
- Hetzner provides excellent price-performance for European and Nigerian VPS; DigitalOcean as geographic failover

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Vercel + managed services** | Expensive at scale; vendor lock-in; cannot control data location for NDPR compliance |
| **AWS ECS / EKS** | Complex; expensive; requires significant DevOps expertise; data location controllable but costly |
| **Google Cloud Run** | Vendor lock-in; data location controllable but managed service loses control advantage |
| **Fly.io** | Good developer experience; limited Nigerian data residency options; smaller community |

**Impact:**
- 50–70% infrastructure cost reduction vs. managed cloud; full NDPR data residency control
- Requires DevOps expertise to operate; operational overhead on the Engineering team
- Mitigation: Coolify reduces operational complexity significantly; DevOps Lead role covers ongoing maintenance; runbooks documented for all common operations

---

### DEC-030: Technology Stack

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-030 |
| **Date** | 2026-02-05 |
| **Category** | Infrastructure |
| **Status** | Approved |
| **Deciders** | Engineering Lead |
| **Reversibility** | Very Low — stack is foundational; migration is expensive and slow |

**Context:**
The technology stack choice determines developer experience, performance characteristics, hiring pool, ecosystem richness, and long-term maintainability.

**Decision:**
Build on: **TanStack Start** (full-stack React framework, frontend), **Hono** (lightweight API framework), **Drizzle ORM** (type-safe database queries), **PostgreSQL** (primary relational database). All layers in **TypeScript**. **Bun** runtime for performance.

**Rationale:**
- Single language (TypeScript) across all layers reduces context-switching and enables full-stack engineers to contribute anywhere
- TanStack Start provides server-side rendering, file-based routing, and React 19 compatibility — modern and well-maintained
- Hono is lightweight and performant for API routes; better suited to Bun than Express or Fastify
- Drizzle ORM provides type-safe database queries without the overhead of Prisma or TypeORM
- PostgreSQL is the standard for relational data at scale; multi-tenant row-level security is mature and well-documented
- Bun runtime provides significantly faster cold starts and execution than Node.js

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Node.js + Next.js** | Two separate deployment targets; slower than Bun; Next.js server actions less flexible than Hono |
| **Python/Django** | Less modern; weaker TypeScript ecosystem; team expertise is TypeScript-first |
| **Go + React** | Two languages; Go ecosystem for web apps is less mature; harder to hire full-stack in this combination |
| **Remix** | Good alternative; TanStack Start chosen for tighter integration with TanStack Query and ecosystem |

**Impact:**
- Modern, performant stack; single language reduces cognitive load; good hiring pool for TypeScript-first engineers
- TanStack Start is newer than Next.js; smaller community; documentation still maturing
- Mitigation: Engineering Lead has deep familiarity with TanStack ecosystem; contribute to open-source where gaps exist

---

### DEC-031: Single Deployable Service Architecture

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-031 |
| **Date** | 2026-02-10 |
| **Category** | Infrastructure |
| **Status** | Approved |
| **Deciders** | Engineering Lead |
| **Reversibility** | Low — service extraction is expensive; best done early or late, not mid-product |

**Context:**
Nawebeus needed to decide between microservices, a traditional monolith, or a modular single service for its initial architecture.

**Decision:**
Build a **single deployable service** with two entry points (web frontend + API). Internal modules are well-separated with clear boundaries but share the same deployment unit. Extract to separate services only when a specific service has a compelling, data-driven reason (performance, team independence, scale).

**Rationale:**
- A team of 8–12 engineers cannot effectively operate and maintain microservices; the operational overhead would consume 30–40% of engineering capacity
- Single deployable service is dramatically simpler to develop, test, debug, and deploy
- Well-separated internal modules provide most of the architectural benefits of microservices without the operational costs
- Extraction to independent services is much easier from a well-structured monolith than from a tightly-coupled one; we design for future extraction without committing to it prematurely

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Microservices from Day 1** | Operational complexity unsuitable for small team; premature optimization; inter-service communication overhead |
| **Serverless functions** | Cold start latency problems for user-facing APIs; vendor lock-in; complex local development |
| **Traditional monolith (no module separation)** | Harder to maintain; coupling makes future extraction very difficult |

**Impact:**
- Faster development velocity; simpler operations; lower DevOps burden
- Extraction decisions deferred until clear performance or team-scaling trigger exists
- Mitigation: Module boundaries enforced in code review; ADRs document module boundaries clearly

---

### DEC-039: Role Hierarchy — Platform `super_admin` + Six-Tier Org Role Model

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-039 |
| **Date** | 2026-09-20 |
| **Category** | Infrastructure & Technical |
| **Status** | Approved |
| **Deciders** | Engineering Lead, Product Lead |
| **Reversibility** | Reversible pre-production (schema + seed + guards change together; no production data exists yet) |

**Context:**
Three sources define the role hierarchy differently, and the in-code role self-protection guards
reference role codes that do not exist in the seed (`owner`/`admin`), so they can never fire:

| Source | Role model |
|--------|-----------|
| `docs/modules/` role specification §6 | six org tiers: Owner, Admin, Manager, Creator, Analyst, Viewer |
| PRD §8.2.2 | five tiers |
| `src/seed.ts` | four roles: `super_admin`, `org_admin`, `member`, `viewer` |

This inconsistency was surfaced by the master implementation roadmap audit (2026-09-20,
decision D13) together with defects F-01 (signup creates the owner membership **without a role**,
leaving every new org owner with zero permissions) and F-07 (self-protection guards reference
phantom role codes).

**Decision:**
Adopt the module-specification six-tier org model on top of the existing platform role:

- Platform-level: `super_admin` (unchanged — the codebase, AGENTS.md, and execution plan already operate on this name).
- Per-organization: `owner`, `admin`, `manager`, `creator`, `analyst`, `viewer`.
- `owner` is assigned atomically with the membership when an organization is created (signup) — this is the role that closes F-01.
- `org_admin` and `member` are **dropped** in the same change (pre-production ⇒ no compatibility burden; no alias period).
- All role guards and the role-permission matrix reference only the seven real codes above (closes F-07).

**Rationale:**
- The six-tier spec model is the most complete source and is what the module permission tables are written against; the PRD's five tiers are a strict subset of it.
- The seed's four-role set is provably insufficient — F-01 shows a user who can be nothing but an owner has no permissions at all under it.
- Pre-production means the cost of a clean replacement is one seed + guard change with a full matrix test, instead of carrying alias/deprecation machinery into production.

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Keep seed set; rewrite guards to the four seed codes** | Role model stays inconsistent with PRD/spec; product roles (creator, analyst) cannot be represented; the gap would have to be re-opened after launch, when it becomes a data migration |
| **Adopt the spec's tier names wholesale, including its platform-level naming** | Diverges from the `super_admin` convention already used in seed, AGENTS.md, and the execution plan; strictly more churn for no product benefit |

**Impact:**
- Changes `src/seed.ts` (4 → 7 roles), the role self-protection guards, the signup service (owner role assignment), and the role-management UI contract (P14.13) in one coordinated task set (NWB-P0-010, NWB-P0-014) — risk R-04 in the master roadmap.
- Unblocks NWB-P0-010 (owner role at signup) and NWB-P0-014 (role model + guards) in Phase 1.
- Mitigation: the full role × permission matrix is test-verified in the same tasks; no production data exists, so no migration is required.

---

## 9. Compliance & Legal Decisions

### DEC-032: GDPR, CCPA, NDPR Compliance at Launch

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-032 |
| **Date** | 2026-02-15 |
| **Category** | Compliance |
| **Status** | Approved |
| **Deciders** | Legal Director, Engineering Lead, Executive Sponsor |
| **Reversibility** | None — legal compliance is not optional |

**Context:**
Nawebeus serves customers in Nigeria (NDPR), California/US (CCPA), and the EU (GDPR). All three regulations have significant penalties for non-compliance. Compliance needed to be designed in from the start, not retrofitted.

**Decision:**
Achieve **full GDPR, CCPA, and NDPR compliance at launch**. Implement privacy-by-design: data minimization, purpose limitation, consent management, data subject rights (access, deletion, portability), audit logging, DPAs with all sub-processors, and cookie compliance.

**Rationale:**
- Legal requirement — non-compliance is not an option in any of the three jurisdictions
- Privacy-by-design is significantly cheaper than privacy-by-retrofit; adding compliance controls after launch requires rearchitecting data flows and re-auditing all processing activities
- NDPR compliance is a competitive advantage — no international competitor serving Nigerian customers can credibly claim NDPR compliance
- Enterprise customers require documented compliance before procurement approval

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **GDPR only** | Insufficient for Nigerian (NDPR) and California (CCPA) markets; legal exposure |
| **GDPR + CCPA only** | Excludes NDPR; limits African enterprise sales; regulatory risk in Nigerian operations |
| **No formal compliance program at launch** | Unacceptable legal and reputational risk; enterprise procurement would be impossible |

**Impact:**
- Increased MVP development effort (~6–8 weeks for compliance implementation); investment recovers through enterprise sales enablement
- Ongoing compliance monitoring required; Legal Director responsible for regulatory change tracking
- Mitigation: Compliance-by-design reduces ongoing maintenance cost vs. retrofit; legal counsel retained for all new regulations

---

### DEC-033: SOC 2 Type II and ISO 27001 in Year 2

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-033 |
| **Date** | 2026-02-20 |
| **Category** | Compliance |
| **Status** | Approved |
| **Deciders** | Legal Director, Security Lead, Executive Sponsor |
| **Reversibility** | High — certification timeline can be accelerated if enterprise demand warrants |

**Context:**
Enterprise customers in financial services, healthcare, and large agency segments frequently require SOC 2 Type II certification as a procurement prerequisite. Nawebeus needed to decide on the certification timeline.

**Decision:**
Pursue **SOC 2 Type II certification in Q3 2027** (Year 2) and **ISO 27001 certification in Q2 2028** (Year 3). Design security controls from Day 1 to be SOC 2-ready even before formal audit.

**Rationale:**
- SOC 2 Type II requires a 6–12 month observation period after controls are implemented; certification cannot be rushed even with unlimited budget
- Certification costs ₦50,000,000–₦240,000,000 (₦$31,250–₦$150,000 equivalent); better to fundraise Seed round first
- Most mid-market customers do not require certification; enterprise segment can be served opportunistically with custom security questionnaire responses and control documentation
- Building SOC 2-ready controls from Day 1 reduces the certification effort when the formal audit begins

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **SOC 2 at launch** | Impossible — 6–12 month observation period required; cannot accelerate the audit timeline |
| **ISO 27001 first** | SOC 2 is more widely required in US and African enterprise segments; ISO 27001 follows |
| **No certifications** | Permanently excludes enterprise segment; limits NRR growth from largest customers |

**Impact:**
- Enterprise segment formally unlocked in Year 2 post-SOC 2 certification
- Pre-certification, enterprise deals supported by security questionnaire responses, penetration test reports, and policy documentation
- Mitigation: Security Lead manages SOC 2 readiness program from launch; formal audit engagement begins Q1 2027

---

## 10. Team & Organization Decisions

### DEC-034: Hire 8–12 People for MVP Launch

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-034 |
| **Date** | 2026-02-25 |
| **Category** | Team |
| **Status** | Approved |
| **Deciders** | Executive Sponsor, Finance Lead |
| **Reversibility** | Medium — can hire more quickly if Seed closes; cannot easily downsize |

**Context:**
Nawebeus needed to determine the optimal team size for MVP launch — large enough to deliver, small enough to operate within the pre-seed budget.

**Decision:**
Hire **8–12 people** for MVP launch across the following roles:
- 1 Executive Sponsor / CEO
- 1 Product Lead
- 1 Engineering Lead
- 4–6 Engineers (frontend, backend, full-stack, DevOps)
- 1 Design Lead
- 1 QA Lead
- 1 Marketing Lead
- 1 Sales Lead (founder-led initially; dedicated hire in Month 3)

**Rationale:**
- 8–12 covers all critical product, engineering, design, quality, and go-to-market functions
- Lean enough to operate within the ₦800,000,000 pre-seed + ₦4,800,000,000 seed runway
- Small team enables fast decision-making and high individual ownership
- Scalable — Year 2 team grows to 20–30 as revenue justifies

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **5–7 people** | Insufficient to cover all functions; high burnout risk; quality would suffer |
| **15+ people at launch** | Premature scaling; burn rate exceeds pre-seed runway; management overhead in early stage |
| **Outsourced development** | Quality and intellectual property control concerns; slower iteration; communication overhead |

**Impact:**
- Lean team enables speed and low burn rate; every person must be high-impact
- Customer success initially handled by product and engineering team; dedicated CS hire in Month 6
- Mitigation: Automate repetitive tasks; use SaaS tools rather than building internally; hire generalists who can cover multiple functions

---

## 11. Funding & Financial Decisions

### DEC-035: Pre-Seed Round at ₦800,000,000

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-035 |
| **Date** | 2026-03-01 |
| **Category** | Funding |
| **Status** | Approved |
| **Deciders** | Executive Sponsor, Board of Directors |
| **Reversibility** | None — investment terms are binding once closed |

**Context:**
Nawebeus needed initial capital to fund MVP development and the founding team before revenue.

**Decision:**
Close **pre-seed round of ₦800,000,000** (~$500K USD equivalent at ₦1,600/USD) in Q3 2025. Use proceeds to fund MVP development and founding team for 9 months.

**Rationale:**
- ₦800,000,000 is sufficient to fund the founding team and MVP development to launch
- Pre-seed valuations are favorable for founders; fundraising at this stage maximizes founder equity retention
- Pre-seed investors in the Nigerian tech ecosystem provide market credibility, introductions, and advisory value
- Securing funding before launch validates the concept to the market and early customers

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Bootstrapping** | Insufficient capital to build the required product; team would need to work part-time |
| **Larger pre-seed (₦1,600,000,000)** | Excessive dilution at pre-revenue stage; funds more than needed |
| **Seed round immediately** | No traction or product to show; lower valuation; harder to attract quality investors |

**Impact:**
- Funds MVP development; founder dilution ~15–20%; 9-month runway to Seed
- Mitigation: Choose investors with Nigerian tech ecosystem expertise and relevant network

---

### DEC-036: Seed Round at ₦4,800,000,000

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-036 |
| **Date** | 2026-03-05 |
| **Category** | Funding |
| **Status** | Approved |
| **Deciders** | Executive Sponsor, Board of Directors |
| **Reversibility** | None — investment terms are binding once closed |

**Context:**
After MVP launch and initial customer traction, Nawebeus needed growth capital for Year 1 operations, sales, and marketing.

**Decision:**
Target **Seed round of ₦4,800,000,000** (~$3M USD equivalent) in Q1 2026, contingent on MVP launch readiness and initial waitlist and beta traction.

**Rationale:**
- ₦4,800,000,000 covers Year 1 full operating budget (₦4,000,000,000) with 20% safety buffer (₦800,000,000)
- Seed valuation reflects product completion and initial traction — better terms than pre-seed
- 18+ months of runway from Seed close to Series A milestone
- Milestone-based: raise after demonstrating product is real and customers are real

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **No Seed; extend pre-seed** | Insufficient capital for full go-to-market; would require slower hiring and delayed launch |
| **Larger Seed (₦8,000,000,000)** | Dilution is higher; harder to raise at Seed stage without Series A-level traction |
| **Series A immediately** | Too early; no revenue traction; lower valuation and worse terms |

**Impact:**
- Full Year 1 operating budget funded; 18+ months of runway
- Additional dilution (~20–25%); total founder dilution ~35–45% post-Seed
- Mitigation: Hit product and revenue milestones clearly communicated to Seed investors before close

---

### DEC-037: Series A Target at ₦16,000,000,000–₦24,000,000,000

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-037 |
| **Date** | 2026-03-10 |
| **Category** | Funding |
| **Status** | Approved |
| **Deciders** | Executive Sponsor, Board of Directors |
| **Reversibility** | None — investment terms are binding once closed |

**Context:**
Nawebeus needed to plan its long-term funding strategy to support international expansion, mobile app development, enterprise sales, and AI feature development.

**Decision:**
Target **Series A of ₦16,000,000,000–₦24,000,000,000** (~$10–15M USD equivalent) in Q4 2026 or Q1 2027, contingent on hitting ₦1,676,777,600 ARR (~$1M ARR) and NRR ≥110%.

**Rationale:**
- ₦16,000,000,000–₦24,000,000,000 funds international expansion (South Africa, Kenya), mobile app development, enterprise sales team, and AI features
- Milestone-based raise: achieve product-market fit and early ARR before Series A; secures better valuation
- Series A investors bring strategic value: enterprise sales networks, global market introductions, board expertise
- ₦1,676,777,600 ARR with strong NRR and gross margin is the standard Series A entry point for SaaS

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **No Series A; grow with Seed** | Insufficient capital for geographic expansion and mobile app at the pace the market requires |
| **Earlier Series A (before ₦1,676,777,600 ARR)** | Lower valuation; worse terms; investors want to see revenue traction |
| **Larger Series A (₦32,000,000,000+)** | Raises at a valuation that requires very aggressive growth; better to right-size |

**Impact:**
- Enables Year 2 scale: geographic expansion, mobile, enterprise sales, AI features
- Additional dilution (~15–20%); total founder dilution ~50–60% post-Series A
- Mitigation: Build investor relationships early; quarterly updates to Series A prospects from Month 6

---

## 12. Deferred Decisions

### DEC-D001: Public API Strategy and Developer Marketplace

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-D001 |
| **Date Raised** | 2026-04-01 |
| **Category** | Product |
| **Status** | Deferred |
| **Deferred Until** | Phase 8 (Q1 2027) |
| **Owner** | Product Lead |

**Context:** Customers and agency partners have requested a public API for custom integrations and automation. A developer marketplace would enable third-party integrations.

**Reason Deferred:** MVP focus is on core platform quality; public API requires stable internal API versioning (breaking changes in public API are very costly once developers depend on them); marketplace requires critical mass of customers first.

**Notes:** Internal API and webhooks are available at launch. Public API documentation, versioning strategy, and developer portal design will begin in Phase 7 for Phase 8 delivery.

---

### DEC-D002: On-Premise Deployment Option

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-D002 |
| **Date Raised** | 2026-04-05 |
| **Category** | Infrastructure |
| **Status** | Deferred |
| **Deferred Until** | Year 2 (based on enterprise sales demand) |
| **Owner** | Engineering Lead |

**Context:** Some regulated enterprise customers (banking, government) require deployment on their own infrastructure.

**Reason Deferred:** Cloud-first model with Nigerian data residency satisfies most customers. Full on-premise deployment adds significant support and licensing complexity. Will be evaluated based on actual enterprise procurement feedback.

---

### DEC-D003: Influencer Management Module

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-D003 |
| **Date Raised** | 2026-04-10 |
| **Category** | Product |
| **Status** | Deferred |
| **Deferred Until** | Phase 4 |
| **Owner** | Product Lead |

**Context:** Influencer marketing is a $24B+ market growing at 30%+ annually. Customers managing influencer programs need discovery, outreach, tracking, and reporting.

**Reason Deferred:** MVP five modules are higher priority; influencer management would add scope and delay launch. Will be evaluated in Phase 4 after core modules are stable.

---

### DEC-D004: Social Media Publishing and Scheduling

| Field | Detail |
|-------|--------|
| **Decision ID** | DEC-D004 |
| **Date Raised** | 2026-04-15 |
| **Category** | Product |
| **Status** | Deferred |
| **Deferred Until** | Phase 5 |
| **Owner** | Product Lead |

**Context:** Publishing and scheduling is a common customer request; most competitors offer it.

**Reason Deferred:** Publishing is a deliberate MVP exclusion. The market for scheduling is highly commoditized (Buffer, Hootsuite, Later). Nawebeus differentiates on intelligence and engagement. Publishing will be added in Phase 5 once the intelligence foundation is established and Nawebeus is not positioned as "yet another scheduling tool."

---

## 13. Open Decisions (Pending)

| ID | Date Raised | Category | Decision Required | Deadline | Owner |
|----|-------------|----------|------------------|----------|-------|
| DEC-O001 | 2026-05-01 | Product | Mobile app launch timing: Q3 2026 vs Q1 2027 | Q2 2026 | Product Lead |
| DEC-O002 | 2026-05-05 | Product | Phase 7 AI feature prioritization: sentiment depth vs. predictive analytics vs. auto-responses | Q3 2026 | Product Lead |
| DEC-O003 | 2026-05-10 | GTM | Geographic expansion timing to South Africa and Kenya | Q4 2026 | Marketing Lead |
| DEC-O004 | 2026-05-15 | Pricing | Team plan between Pro and Enterprise: ₦398,400/month (~$249) | Q3 2026 | Product Lead |
| DEC-O005 | 2026-05-20 | Compliance | HIPAA compliance for healthcare vertical in Nigeria and US | Q4 2026 | Legal Director |
| DEC-O006 | 2026-05-25 | Infrastructure | Kubernetes migration trigger: specific load metric or team size milestone | Q4 2026 | DevOps Lead |
| DEC-O007 | 2026-06-01 | Product | Build vs. buy vs. partner for influencer management capability | Q1 2027 | Executive Team |
| DEC-O008 | 2026-06-05 | Pricing | CBN rate adjustment trigger: 10% current policy vs. lower threshold for more frequent review | Q3 2026 | Finance Lead |

---

## 14. Decision Principles & Process

### 14.1 Decision Principles

All decisions recorded in this log adhere to the following principles:

| Principle | Description |
|-----------|-------------|
| **Customer-first** | Decisions prioritize customer value and outcomes; internal convenience is not a valid reason to compromise customer experience |
| **Data-driven** | Significant decisions require supporting evidence — customer research, market data, financial models, or technical analysis |
| **Reversibility-aware** | Prefer reversible decisions where possible; apply proportionally more deliberation to irreversible decisions |
| **Documented** | Every significant decision is recorded with context, rationale, alternatives, and expected impact |
| **Transparent** | Decision-making is visible to the full team; no significant decisions made in private that affect the team's work |
| **Reviewed** | Decisions are reviewed quarterly; outdated decisions are revised or reversed with documentation |
| **Aligned** | All decisions align with Nawebeus's vision, mission, and core values as defined in the Project Charter and Business documents |

### 14.2 Decision-Making Process

1. **Identify** the decision that needs to be made and its reversibility
2. **Gather context** — customer research, market data, competitive analysis, technical feasibility
3. **Identify alternatives** — at least two meaningful alternatives must be considered for any significant decision
4. **Assess impact** — positive outcomes, negative outcomes, and mitigations for each alternative
5. **Decide** with the appropriate decision authority (see Project Charter §10.3)
6. **Document** — create or update the Decision Log entry before implementation begins
7. **Communicate** the decision and rationale to all affected stakeholders
8. **Implement** — execution begins after documentation, not before
9. **Monitor** the outcome against expected impact
10. **Review** quarterly; update if context changes

### 14.3 Decision Authority

| Decision Type | Authority | Consultation Required |
|---------------|-----------|----------------------|
| Pricing change (any tier, any currency) | Executive Sponsor | Product Lead, Finance Lead |
| Exchange rate adjustment | Executive Sponsor | Finance Lead |
| MVP scope addition | Executive Sponsor | Product Lead, Engineering Lead |
| MVP scope removal | Product Lead | Engineering Lead |
| Architecture decisions | Engineering Lead | Product Lead, DevOps Lead |
| Partnership agreements | Executive Sponsor | Legal Director |
| Hiring decisions | Executive Sponsor | Relevant function lead |
| Funding terms | Board of Directors | All leads |
| Compliance decisions | Legal Director | Security Lead, Engineering Lead |

---

## 15. Decision Categories Summary

| Category | Total | Approved | Deferred | Open | Superseded |
|----------|-------|----------|---------|------|------------|
| **Strategic** | 4 | 4 | 0 | 0 | 0 |
| **Product** | 13 | 9 | 4 | 2 | 0 |
| **Pricing & Business Model** | 7 | 7 | 0 | 2 | 0 |
| **Go-to-Market** | 4 | 4 | 0 | 1 | 0 |
| **Partnerships & Integrations** | 4 | 4 | 0 | 0 | 0 |
| **Infrastructure & Technical** | 3 | 3 | 1 | 1 | 0 |
| **Compliance & Legal** | 2 | 2 | 0 | 1 | 0 |
| **Team & Organization** | 1 | 1 | 0 | 0 | 0 |
| **Funding & Financial** | 3 | 3 | 0 | 1 | 0 |
| **Total** | **41** | **37** | **5** | **8** | **0** |

---

## 16. Document Governance

### 16.1 Relationship to Other Documents

This Decision Log is the business-level institutional memory for Nawebeus. It complements but does not replace the technical Architecture Decision Records (ADRs).

```
Project Charter (root authorization)
└── Business.md (business model, pricing, GTM)
    ├── Market Research.md (competitive analysis, validation)
    ├── Personas.md (user personas)
    └── Decision Log.md (this document — all significant decisions)
        └── [complements]
            └── Technical ADRs (engineering and infrastructure decisions)
```

### 16.2 Quarterly Review Process

At each quarterly review, the Executive Team and all leads review all Approved decisions and categorize each as:
- **Confirmed** — decision is still valid; no changes needed
- **Revised** — decision requires updates based on new information; revision is documented in this log
- **Reversed** — decision is no longer valid; reversal is documented with rationale; original entry is preserved for history

### 16.3 Decision Triggers

New decisions are raised when any of the following occur:
- New market opportunity or competitive threat identified
- Customer research changes a validated assumption
- Technical constraint or opportunity changes feasibility
- Regulatory change affects compliance requirements
- Financial reality differs from plan (>15% variance)
- A Deferred decision's trigger condition is met
- A key team member or investor raises a well-evidenced alternative

### 16.4 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-11-25 | Product Management | Initial draft — first 20 decisions; USD pricing |
| 0.2 | 2026-07-20 | Product Management | Converted all pricing to Naira; added Paystack decisions; added NDPR compliance; added DEC-020 (Naira primary currency) |
| 0.3 | 2026-07-21 | Business Lead | Added strategic decisions DEC-001–004; added technical decisions DEC-029–031; added deferred and open decisions |
| 1.0.0 | 2026-07-21 | Product Management + Business Lead | Merged and unified; expanded all entries to full format; added decision principles, authority matrix, quarterly review process; converted all financial figures to Naira primary; total 41 decisions documented |

---

## 17. Approval

By signing below, each approver confirms they have read this Decision Log in full, agree that the decisions documented herein represent the authorized direction for Nawebeus, and commit to following the decision-making process defined in §14 for all future significant decisions.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Executive Sponsor** | _________________________ | _________________________ | _____________ |
| **Product Lead** | _________________________ | _________________________ | _____________ |
| **Engineering Lead** | _________________________ | _________________________ | _____________ |
| **Finance Lead** | _________________________ | _________________________ | _____________ |
| **Legal Director** | _________________________ | _________________________ | _____________ |
| **Marketing Lead** | _________________________ | _________________________ | _____________ |
| **Sales Lead** | _________________________ | _________________________ | _____________ |

---

*This document is governed by the Universal Product Documentation Framework (UPDF). Questions should be directed to the Product Lead. All financial figures are expressed in Nigerian Naira (₦) as the primary currency unless explicitly stated otherwise. USD equivalents are provided at ₦1,600/USD and are reviewed quarterly per the exchange rate policy in Business.md §5.7.*