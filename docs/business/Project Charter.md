# Nawebeus — Social Media Management Platform

## Project Charter

| Field                | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| **Document Version** | 1.1.0 (Unified — Naira Edition)                         |
| **Date**             | 2026-07-20                                              |
| **Status**           | Draft — Pending Approval                                |
| **Owner**            | Product Management                                      |
| **Document Type**    | Business → Project Charter                              |
| **Framework**        | Universal Product Documentation Framework (UPDF)        |
| **Classification**   | Internal — Confidential                                 |
| **Currency**         | Nigerian Naira (₦) — all figures below are Naira-native |

---

## Document Control

### Version History

| Version | Date       | Author             | Summary of Changes                                                                                        |
| ------- | ---------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2025-11-25 | Product Management | Initial draft (USD)                                                                                       |
| 1.0.0   | 2026-07-20 | Product Management | Unified charter: expanded personas, unit economics, competitive landscape, RACI, glossary, roadmap detail |
| 1.1.0   | 2026-07-20 | Product Management | All monetary values converted and standardized to Naira (₦)                                               |

### Related Documents

| Document           | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| Business.md        | Vision, mission, GTM strategy, revenue model detail |
| Market Research.md | Competitor analysis, SWOT, TAM/SAM/SOM              |
| Personas.md        | Full persona profiles with journeys and JTBD        |
| FRD.md             | Detailed module specifications                      |
| Decision Log.md    | Record of significant business/product decisions    |
| Security.md        | Security architecture and controls                  |
| ADRs.md            | Architecture Decision Records                       |

---

## Quick Reference: Key Charter Decisions

| Decision                | Choice                                                               | Rationale                                                  |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Delivery model**      | Cloud-hosted multi-tenant SaaS, self-hosting option via Coolify      | Speed to market + data sovereignty for regulated customers |
| **Pricing model**       | Flat tiered subscription (Free / Pro / Enterprise) in Naira          | Predictability builds trust; no "platform tax"             |
| **Launch scope**        | 5 modules (Grow, Listen, Monitor, Engage, Analyze) across 6 channels | Genuinely unified alternative, not a thin wrapper          |
| **Geography at launch** | Global, English-only, Naira-first billing                            | Home-market alignment while remaining globally accessible  |
| **Tech stack**          | TanStack Start, Hono, Drizzle, PostgreSQL                            | Modern, type-safe, maintainable by a lean team             |
| **Compliance posture**  | GDPR, CCPA, NDPR at launch; SOC 2 / ISO 27001 Year 2                 | Required to reach enterprise segment                       |
| **Mobile strategy**     | Responsive web only for MVP; native apps Phase 6                     | Focus capacity on core differentiation first               |
| **Team size at launch** | 8–12 people                                                          | Balances velocity with ₦3.75 billion Year 1 budget         |

---

## 1. Executive Summary

Nawebeus is a unified social media management and intelligence platform that empowers businesses, brands, and agencies to accelerate audience growth, monitor brand presence in real time, engage effectively with their communities, and measure performance across multiple social and news channels — all from a single interface.

Today, marketing teams stitch together 6–10 disconnected point solutions to accomplish what should be one coherent workflow. This fragmentation costs mid-market teams upward of **₦3,000,000/month** in cumulative subscriptions, creates data silos that obscure true brand health, and slows response times when reputation moments matter most.

The MVP consolidates this fragmented landscape into five integrated value propositions: **Grow, Listen, Monitor, Engage, Analyze** — delivered as an enterprise-grade, multi-tenant SaaS platform with strict data isolation, RBAC, audit logging, and a compliance-first posture from day one.

**The ask of this charter:** Approval to proceed with a 9-month, **₦3,750,000,000** investment to build and launch the MVP in Q2 2026, targeting **200 paying organizations** and **5,000 monthly active users** within the first year.

---

## 2. Project Identification

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Product Name   | Nawebeus                                                  |
| Version        | MVP v1.0                                                  |
| Document Date  | 2026-07-20                                                |
| Product Type   | Multi-tenant SaaS (B2B)                                   |
| Industry       | Social Media Management / MarTech                         |
| Geography      | Global (English at launch); home market Nigeria           |
| Delivery Model | Cloud-hosted, web-based; self-hostable via Coolify        |
| Mobile         | Responsive web (native mobile out of scope for MVP)       |
| Business Model | Freemium, tiered subscription — Naira-denominated pricing |

---

## 3. Vision & Mission

### 3.1 Vision Statement

> To become the single command center where every brand, business, and agency orchestrates their entire social media presence — from growth campaigns to crisis response — eliminating the fragmentation that plagues modern digital marketing.

### 3.2 Mission Statement

> Nawebeus accelerates audience growth, deepens brand intelligence, and unifies community engagement for modern marketing teams by consolidating the fragmented social media tool landscape into one integrated, intelligent, and intuitive platform.

### 3.3 Guiding Principles

| Principle                               | What It Means in Practice                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| Unification over accumulation           | Every feature must reduce, not add to, tool sprawl           |
| Compliance is a feature, not a checkbox | Data governance designed in from schema layer up             |
| Predictable pricing builds trust        | Never take a percentage of ad spend; flat Naira pricing      |
| Real-time beats retrospective           | Insights delivered as streams, not batch reports             |
| Own your data                           | Self-hosting via Coolify is first-class, not an afterthought |

---

## 4. Problem Statement

### 4.1 The Problem

Modern brands, agencies, and businesses struggle with **social media tool fragmentation**, juggling 6–10 disconnected tools to run campaigns, monitor mentions, track press, engage audiences, and analyze ROI.

| Pain Point              | Business Impact                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Data silos              | No unified view of brand health                                        |
| Workflow friction       | Teams lose 30–40% of productive time context-switching                 |
| Inconsistent engagement | Slow response times; missed conversations                              |
| Limited intelligence    | Surface-level analytics; weak competitive benchmarking                 |
| Compliance gaps         | Disconnected audit trails; inconsistent RBAC                           |
| **High total cost**     | **Cumulative tool cost exceeds ₦3,000,000/month for mid-market teams** |

### 4.2 Who Experiences It

| Segment                              | Manifestation of the Problem                              |
| ------------------------------------ | --------------------------------------------------------- |
| Mid-market brands (50–500 employees) | Hours weekly reconciling metrics from separate dashboards |
| Digital agencies serving 10+ clients | Tool cost and reporting overhead multiply per client      |
| PR/comms teams                       | Reactive, not real-time, crisis detection                 |
| Social media managers                | Manual copy-paste across inbox tabs; missed DMs           |
| C-suite executives                   | No single source of truth for brand performance           |

### 4.3 Why Now

- Global social media spend exceeded **₦375 trillion in 2025** and continues to grow
- Platform proliferation demands more sophisticated, not more fragmented, tooling
- AI-driven insights are now table stakes; legacy tools are falling behind
- Privacy regulations (GDPR, CCPA, NDPR) require enterprise-grade governance
- Naira volatility against major currencies makes **predictable, transparent Naira pricing** a genuine competitive advantage over foreign incumbents billing unpredictably in USD

---

## 5. Solution Overview

### 5.1 Product Description

| Module      | Description                                             |
| ----------- | ------------------------------------------------------- |
| **Grow**    | Viral giveaway and growth campaign engine               |
| **Listen**  | Real-time sentiment analysis and keyword tracking       |
| **Monitor** | Press coverage and Share of Voice (SOV) tracking        |
| **Engage**  | Unified inbox across all connected channels             |
| **Analyze** | Consolidated dashboards, custom reports, CSV/PDF export |

All five capabilities share a unified data model, consistent RBAC, and strict multi-tenant data isolation.

### 5.2 Key Differentiators

| Differentiator                 | Description                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Unified platform               | Five capabilities in one product, not five stitched-together tools                         |
| Enterprise-grade multi-tenancy | Schema-level and row-level security                                                        |
| Real-time intelligence         | Streaming mentions and crisis detection                                                    |
| Compliance-first               | GDPR, CCPA, NDPR at launch; SOC 2/ISO 27001 by Year 2                                      |
| Open extensibility             | REST API and webhooks at launch                                                            |
| Modern architecture            | TanStack Start, Hono, Drizzle, PostgreSQL                                                  |
| Self-hostable                  | Coolify-managed containers for data sovereignty                                            |
| **Predictable Naira pricing**  | **Flat subscription tiers billed in Naira — no ad-spend percentage fees, no FX surprises** |

---

## 6. Target Market & Personas

### 6.1 Target Segments

| Segment           | Estimated Size             | Pain Level | Willingness to Pay (₦/month) |
| ----------------- | -------------------------- | ---------- | ---------------------------- |
| Mid-market brands | 50,000+ companies globally | High       | ₦300,000 – ₦750,000          |
| Digital agencies  | 30,000+ agencies           | Very High  | ₦750,000 – ₦3,000,000        |
| Enterprise brands | 5,000+ companies           | High       | ₦3,000,000+                  |
| PR & comms teams  | 20,000+ teams              | Medium     | ₦450,000 – ₦1,200,000        |
| SMBs and startups | 500,000+ businesses        | Medium     | ₦75,000 – ₦300,000           |

**TAM:** Estimated at **₦22.5–30 trillion** globally within the social media management and intelligence category.

### 6.2 Primary Personas

| Persona                            | Role                      | Core Need                          | Primary Modules      |
| ---------------------------------- | ------------------------- | ---------------------------------- | -------------------- |
| **Maya** — Marketing Director      | Mid-market brand leader   | Unified ROI view                   | Analyze, Monitor     |
| **Sam** — Social Media Manager     | Hands-on operator         | Efficient multi-channel management | Engage, Grow         |
| **Alex** — Agency Account Director | Multi-client oversight    | Client-ready reporting             | Analyze, all modules |
| **Priya** — PR Manager             | Reputation/crisis lead    | Early sentiment/press warning      | Listen, Monitor      |
| **Dana** — Data Analyst            | Insights and benchmarking | Cross-platform correlation         | Analyze, Listen      |
| **Casey** — Community Manager      | Day-to-day engagement     | One inbox, fast response           | Engage               |

### 6.3 Jobs-to-be-Done Summary

1. **"Help me prove marketing's impact"** (Maya, Dana) → Analyze
2. **"Help me never miss a conversation or a threat"** (Priya, Casey) → Listen, Monitor, Engage
3. **"Help me do more with the team and budget I have"** (Sam, Alex) → unification itself

---

## 7. Competitive Landscape

| Competitor Category              | Examples                                                  | Nawebeus Advantage                                           |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Legacy all-in-one suites         | Hootsuite, Sprout Social                                  | Modern architecture, transparent Naira pricing, self-hosting |
| Listening/monitoring specialists | Brandwatch, Meltwater                                     | Integrated engagement/growth eliminates a second platform    |
| Engagement-focused tools         | Sprinklr                                                  | Lower entry cost, faster time-to-value for mid-market        |
| Growth/giveaway tools            | Gleam, Vyper                                              | Native integration with listening/analytics                  |
| DIY tool stacks (status quo)     | 6–10 combined subscriptions, often billed in volatile USD | Single bill, single login, Naira-denominated cost certainty  |

**Positioning statement:** _For marketing teams and agencies drowning in disconnected social tools, Nawebeus is the unified command center that replaces 6–10 subscriptions with one platform — built on a modern, real-time, compliance-first architecture with transparent, predictable Naira pricing._

---

## 8. Business Model

### 8.1 Revenue Model

| Plan           | Monthly Price | Target Segment          | Key Limits                                               |
| -------------- | ------------- | ----------------------- | -------------------------------------------------------- |
| **Free**       | ₦0            | SMBs / trial users      | 1 user, 2 social accounts, 100 mentions/month            |
| **Pro**        | **₦150,000**  | Mid-market / agencies   | 5 users, 10 social accounts, 10K mentions/month          |
| **Enterprise** | **₦750,000**  | Large brands / agencies | Unlimited users, 50 social accounts, 100K mentions/month |

All paid plans unlock the full five-module feature set, differentiated by usage limits. Volume-based add-ons (mentions, storage, API calls) are billed in Naira.

### 8.2 Trial Strategy

- 14-day free trial of Pro plan (no card required)
- Automated downgrade to Free at expiration
- Email reminders at 7 days and 1 day before expiration

### 8.3 Pricing Principles

- Predictable monthly Naira pricing for budget certainty
- No percentage-based fees on ad spend or campaign performance
- Volume-based add-ons instead of punitive overage charges
- **Annual billing: ₦1,530,000/year for Pro (15% discount vs. ₦1,800,000 monthly-equivalent)**
- **Annual billing: ₦7,650,000/year for Enterprise (15% discount vs. ₦9,000,000 monthly-equivalent)**
- Naira list price reviewed quarterly against FX movement to protect margin without surprising customers

### 8.4 Expansion Revenue Levers

| Lever                  | Mechanism                                               |
| ---------------------- | ------------------------------------------------------- |
| Seat expansion         | Additional users beyond plan minimums                   |
| Usage add-ons          | Additional mentions, accounts, API calls                |
| Tier upgrades          | Free → Pro → Enterprise                                 |
| Agency multi-workspace | Multiple client workspaces under one contract (Phase 2) |

---

## 9. Unit Economics (Illustrative — Year 1 Targets)

| Metric                          | Target                               |
| ------------------------------- | ------------------------------------ |
| Customer Acquisition Cost (CAC) | < ₦900,000 blended                   |
| Average Contract Value (ACV)    | ₦1,800,000/year (Pro-weighted blend) |
| LTV:CAC ratio                   | > 3:1 by end of Year 1               |
| Free-to-Paid Conversion         | 3–5%                                 |
| Gross Margin                    | > 75%                                |
| Payback Period                  | < 12 months                          |
| Net Revenue Retention (NRR)     | 110%                                 |

---

## 10. Strategic Goals & Success Metrics

### 10.1 Year 1 Goals (MVP Launch)

| Goal                     | Target                     |
| ------------------------ | -------------------------- |
| Launch MVP               | Q2 2026                    |
| Acquire paying customers | 200 organizations          |
| Reach MAU                | 5,000 monthly active users |
| Achieve NRR              | 110%                       |
| Customer satisfaction    | CSAT > 4.5/5               |
| Platform uptime          | 99.9%                      |
| Gross margin             | > 75%                      |

### 10.2 Year 2–3 Goals

- Scale to 2,000+ paying organizations
- Expand to mobile (iOS + Android)
- Launch public API and marketplace
- Enter EU and African markets with localized compliance
- Achieve SOC 2 Type II and ISO 27001 certifications
- **Series A funding at ₦15,000,000,000+ ARR milestone**

### 10.3 Leading vs. Lagging Indicators

| Type    | Metric                                              | Why It Matters                     |
| ------- | --------------------------------------------------- | ---------------------------------- |
| Leading | Trial activation (connects ≥1 account within 24hrs) | Predicts trial-to-paid conversion  |
| Leading | Weekly use of ≥2 modules                            | Predicts stickiness                |
| Leading | Time-to-first-value                                 | Correlates with onboarding success |
| Lagging | Monthly churn rate                                  | Confirms retention health          |
| Lagging | NRR                                                 | Confirms expansion health          |
| Lagging | CSAT / NPS                                          | Confirms overall satisfaction      |

---

## 11. Scope

### 11.1 In Scope (MVP v1.0)

- Authentication and multi-tenant user/account management
- Organization/workspace structure with RBAC
- Integrations: YouTube, X/Twitter, Instagram, Facebook, Reddit, news sources
- Grow, Listen, Monitor, Engage, Analyze modules
- Notifications & alerts (email and in-app)
- Naira-native billing/subscription framework
- Audit logging
- System administration panel

### 11.2 Explicitly Out of Scope (Future Phases)

| Item                                       | Target Phase             |
| ------------------------------------------ | ------------------------ |
| Advanced AI/ML features                    | Phase 7 (Q4 2026)        |
| White-labeling / agency resale             | Phase 2 packaging review |
| Enterprise SSO (SAML, Okta, Azure AD)      | Post-MVP                 |
| Native mobile apps                         | Phase 6 (Q3 2026)        |
| Advanced workflow automation               | Post-MVP                 |
| Multi-language support                     | Post-MVP                 |
| Deep CRM/marketing automation integrations | Post-MVP                 |
| LinkedIn, TikTok, Pinterest integrations   | Phase 2                  |
| Public API and marketplace                 | Phase 8 (Q1 2027)        |

### 11.3 Scope Change Control

Any change to MVP scope requires:

1. Written impact assessment (timeline, budget, capacity)
2. Product Management approval
3. Executive Sponsor sign-off if impact exceeds **₦187,500,000** (5% of budget) or 2 weeks timeline

---

## 12. Key Stakeholders & RACI

| Role               | Responsibility                                   |
| ------------------ | ------------------------------------------------ |
| Executive Sponsor  | Strategic direction, funding, go/no-go decisions |
| Product Management | Vision, roadmap, requirements, prioritization    |
| Engineering Lead   | Technical architecture, delivery, quality        |
| Design Lead        | UX/UI, design system, user research              |
| QA Lead            | Test strategy, quality assurance, UAT            |
| DevOps Lead        | Infrastructure, CI/CD, deployment, monitoring    |
| Marketing Lead     | Positioning, launch, demand generation           |
| Sales Lead         | Customer acquisition, revenue growth             |
| Customer Success   | Onboarding, retention, expansion                 |
| Legal & Compliance | Regulatory adherence, contracts, privacy         |
| Security Lead      | Security architecture, threat modeling, IR       |

### 12.1 RACI Summary

| Decision Area       | Responsible        | Accountable       | Consulted                      | Informed         |
| ------------------- | ------------------ | ----------------- | ------------------------------ | ---------------- |
| Scope changes       | Product Management | Executive Sponsor | Engineering, Design            | All stakeholders |
| Budget adjustments  | Finance Lead       | Executive Sponsor | Product, Engineering           | All stakeholders |
| Compliance sign-off | Legal & Compliance | Executive Sponsor | Security Lead                  | Engineering      |
| Launch go/no-go     | Product Management | Executive Sponsor | QA, Engineering, DevOps, Legal | All stakeholders |
| Pricing changes     | Product Management | Executive Sponsor | Sales, Finance                 | Customer Success |

---

## 13. High-Level Milestones & Roadmap

| Phase   | Milestone                             | Target Date |
| ------- | ------------------------------------- | ----------- |
| Phase 0 | Project kickoff, team formation       | Q4 2025     |
| Phase 1 | Technical architecture, design system | Q1 2026     |
| Phase 2 | MVP development (modules 1–10)        | Q1–Q2 2026  |
| Phase 3 | Alpha testing (internal)              | Q2 2026     |
| Phase 4 | Beta testing (select customers)       | Q2 2026     |
| Phase 5 | MVP public launch                     | Q2 2026     |
| Phase 6 | Mobile app development                | Q3 2026     |
| Phase 7 | Advanced AI features                  | Q4 2026     |
| Phase 8 | Public API launch                     | Q1 2027     |

### 13.1 Phase Exit Criteria

| Phase            | Exit Criteria                                                                |
| ---------------- | ---------------------------------------------------------------------------- |
| Phase 3 → 4      | All P0/P1 bugs resolved; internal team daily-using all 5 modules for 2 weeks |
| Phase 4 → 5      | Beta CSAT > 4.0/5; no unresolved security findings; 99.9% uptime sustained   |
| Phase 5 (Launch) | Success Criteria (§17) fully met or waived by Executive Sponsor              |

---

## 14. Constraints

### 14.1 Technical Constraints

- Modern browser support (Chrome, Firefox, Safari, Edge — latest 2 versions)
- 99.9% uptime SLA
- Scale to 50,000+ organizations by Year 3
- Integrate with major social platform APIs within their rate limits and ToS
- Strict tenant data isolation at schema and row level

### 14.2 Regulatory Constraints

| Regulation        | Scope                                 | Timing    |
| ----------------- | ------------------------------------- | --------- |
| GDPR (EU)         | Data protection, erasure, portability | At launch |
| CCPA (California) | Consumer privacy rights               | At launch |
| NDPR (Nigeria)    | Data sovereignty and consent          | At launch |
| COPPA (US)        | Children's privacy                    | At launch |
| CAN-SPAM Act      | Email compliance                      | At launch |
| SOC 2 Type II     | Security certification                | Year 2    |
| ISO 27001         | Information security                  | Year 2    |

### 14.3 Business Constraints

- **Budget: ₦3,750,000,000 Year 1 operating budget**
- **Team: 8–12 people at launch**
- **Timeline: MVP launch within 9 months**
- Compliance: Must pass enterprise security review before targeting enterprise segment

---

## 15. Assumptions

| #   | Assumption                                                                                                                 | Validation Approach                         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | Marketing teams will consolidate tools if a unified product meets feature parity                                           | Beta interviews; conversion tracking        |
| 2   | Multi-tenant SaaS is the preferred delivery model                                                                          | Sales discovery; win/loss analysis          |
| 3   | Chosen tech stack scales to 50,000+ organizations                                                                          | Load testing; architecture review           |
| 4   | Self-hostable deployment supports data sovereignty needs                                                                   | Direct validation with regulated prospects  |
| 5   | Freemium model achieves 3–5% free-to-paid conversion                                                                       | Cohort tracking from Beta                   |
| 6   | Social platform API rate limits remain stable                                                                              | Ongoing monitoring; abstraction layer       |
| 7   | **Naira-denominated pricing (₦150,000 Pro / ₦750,000 Enterprise) will be seen as fair value versus incumbent USD pricing** | **Pricing sensitivity testing during Beta** |

---

## 16. Risks & Mitigations

| Risk                                                                                         | Likelihood | Impact    | Mitigation                                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Social platform API changes                                                                  | High       | High      | Abstraction layer; changelog monitoring; diversified integrations                                            |
| Slow customer adoption                                                                       | Medium     | High      | Strong GTM; free trial; agency partnerships; case studies                                                    |
| Compliance failure                                                                           | Low        | Very High | Compliance-first design; legal review; security audits                                                       |
| Scope creep                                                                                  | High       | Medium    | Strict change control; product owner authority                                                               |
| Key team member departure                                                                    | Medium     | High      | Documentation; knowledge sharing; cross-training                                                             |
| Competitive pressure                                                                         | High       | Medium    | Differentiation on unification and intelligence                                                              |
| Data breach                                                                                  | Low        | Very High | Defense in depth; encryption; incident response plan                                                         |
| Cost overrun                                                                                 | Medium     | High      | Monthly budget reviews; phased delivery                                                                      |
| **Naira/FX volatility affecting infrastructure costs (largely USD-denominated cloud spend)** | **Medium** | **High**  | **Maintain FX reserve buffer within budget; quarterly cost review; lock in annual contracts where possible** |

---

## 17. Success Criteria

The MVP launch will be considered successful if:

- ✅ All 10 functional modules delivered per the FRD
- ✅ 99.9% uptime in first 90 days post-launch
- ✅ At least 100 paying customers acquired within 6 months
- ✅ CSAT exceeds 4.0/5
- ✅ Zero P1 security incidents in first 90 days
- ✅ All compliance requirements (GDPR, CCPA, NDPR) met
- ✅ Engineering can deploy within 30 minutes via blue-green deployment
- ✅ Platform processes 100,000+ social mentions per day
- ✅ **At least ₦30,000,000 in Monthly Recurring Revenue (MRR) achieved by Month 6**

---

## 18. Governance & Change Control

- This charter is authoritative until superseded by a new version.
- Any material change to scope, budget, timeline, or goals requires an entry in Decision Log.md and, where thresholds in §11.3 are exceeded, formal re-approval per §20.
- Reviewed at every phase gate (§13.1); version history maintained in Document Control.
- Escalations resolved by the Executive Sponsor in consultation with Product Management.

---

## 19. Glossary

| Term     | Definition                                                           |
| -------- | -------------------------------------------------------------------- |
| MVP      | Minimum Viable Product                                               |
| RBAC     | Role-Based Access Control                                            |
| SOV      | Share of Voice                                                       |
| NRR      | Net Revenue Retention                                                |
| CSAT     | Customer Satisfaction score                                          |
| NPS      | Net Promoter Score                                                   |
| CAC      | Customer Acquisition Cost                                            |
| LTV      | Customer Lifetime Value                                              |
| ACV      | Average Contract Value                                               |
| MRR      | Monthly Recurring Revenue                                            |
| Tenant   | An individual customer organization within the multi-tenant platform |
| RAID log | Risks, Assumptions, Issues, Dependencies tracking log                |

---

## 20. Approval

| Role               | Name               | Signature  | Date       |
| ------------------ | ------------------ | ---------- | ---------- |
| Executive Sponsor  | ********\_******** | ****\_**** | **\_\_\_** |
| Product Lead       | ********\_******** | ****\_**** | **\_\_\_** |
| Engineering Lead   | ********\_******** | ****\_**** | **\_\_\_** |
| Legal & Compliance | ********\_******** | ****\_**** | **\_\_\_** |
| Finance Lead       | ********\_******** | ****\_**** | **\_\_\_** |
