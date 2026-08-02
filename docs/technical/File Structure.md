\# Nawebeus — Application File Structure



\*\*Document Version:\*\* 1.0.0

\*\*Last Updated:\*\* 2026-07-21

\*\*Status:\*\* Active

\*\*Owner:\*\* Engineering Lead



\---



\## Overview



This document defines the complete, canonical file and folder structure for the Nawebeus platform. Every file and folder has a clear purpose, owner, and placement rationale. The structure enforces the architectural principles defined in the Engineering Standards and Architecture documents — particularly the import boundary rules and the single source of truth for business logic.



\*\*Design Principles Behind the Structure:\*\*



| Principle | How the Structure Enforces It |

|-----------|------------------------------|

| Single source of truth | All business logic in `services/` — never in `app/` or `server/` |

| No reverse dependencies | `services/` never imports from `app/` or `server/` — ESLint enforces this |

| Separation of concerns | Web, API, mobile, services, DB are completely separate trees |

| Co-located tests | Unit tests live next to the files they test |

| Nigerian market context | `db/schema/billing.ts` uses ₦, `lib/i18n/` defaults to WAT and en-NG |



\---



\## Complete File Structure



```

nawebeus/

│

│  ── Root Configuration ────────────────────────────────────────────────────

│

├── package.json                        # Dependencies, scripts, workspaces

├── bun.lockb                           # Bun lock file (commit this)

├── tsconfig.json                       # TypeScript strict config (all flags on)

├── tsconfig.paths.json                 # Path aliases (@app, @services, @lib, @db, @shared)

├── tailwind.config.ts                  # Tailwind CSS + shadcn/ui theme tokens

├── drizzle.config.ts                   # Drizzle Kit config (schema location, migrations output)

├── .eslintrc.ts                        # ESLint rules including import boundary enforcement

├── .prettierrc                         # Prettier formatting config

├── .gitignore                          # .env, node\_modules, .next, dist, \*.db

├── .env.example                        # All required env vars with comments (no real values)

├── .env                                # Local secrets (NEVER committed)

├── docker-compose.yml                  # Local PostgreSQL for development

├── Dockerfile                          # Production container definition

│

│  ── App (TanStack Start Web Application) ──────────────────────────────────

│

├── app/

│   │

│   │  ── Routing (TanStack Start file-based routing) ──────────────────────

│   │

│   ├── routes/

│   │   ├── \_\_root.tsx                  # Root layout (HTML shell, providers, top nav)

│   │   ├── index.tsx                   # Landing page (public)

│   │   ├── pricing.tsx                 # Pricing page in ₦ (public)

│   │   ├── features.tsx                # Features overview page (public)

│   │   ├── about.tsx                   # About page (public)

│   │   │

│   │   ├── auth/

│   │   │   ├── login.tsx               # Login page

│   │   │   ├── signup.tsx              # Signup page

│   │   │   ├── forgot-password.tsx     # Forgot password

│   │   │   ├── reset-password.tsx      # Reset password (token-based)

│   │   │   └── verify-email.tsx        # Email verification

│   │   │

│   │   ├── dashboard/

│   │   │   └── index.tsx               # Executive overview dashboard

│   │   │

│   │   ├── monitor/                    # Media Monitoring module

│   │   │   ├── index.tsx               # Coverage feed

│   │   │   ├── campaigns/

│   │   │   │   ├── index.tsx           # All monitoring campaigns

│   │   │   │   ├── create.tsx          # Create monitoring campaign

│   │   │   │   └── $campaignId/

│   │   │   │       └── index.tsx       # Campaign detail

│   │   │   ├── contacts/

│   │   │   │   ├── index.tsx           # Journalist CRM list

│   │   │   │   ├── create.tsx          # Add journalist

│   │   │   │   └── $contactId/

│   │   │   │       └── index.tsx       # Journalist profile + interaction history

│   │   │   ├── press-releases/

│   │   │   │   ├── index.tsx           # All press releases

│   │   │   │   ├── create.tsx          # Create press release

│   │   │   │   └── $prId/

│   │   │   │       └── index.tsx       # Press release detail + distribution stats

│   │   │   └── crisis/

│   │   │       ├── index.tsx           # Crisis dashboard (active incidents)

│   │   │       └── $incidentId/

│   │   │           └── index.tsx       # Crisis command view

│   │   │

│   │   ├── listen/                     # Social Listening module

│   │   │   ├── index.tsx               # Mention feed

│   │   │   ├── queries/

│   │   │   │   ├── index.tsx           # All listening queries

│   │   │   │   ├── create.tsx          # Create query (boolean builder)

│   │   │   │   └── $queryId/

│   │   │   │       └── index.tsx       # Query detail + mention results

│   │   │   ├── alerts.tsx              # Alert rule management

│   │   │   ├── sentiment.tsx           # Sentiment analysis view

│   │   │   └── competitive.tsx         # Competitive intelligence view

│   │   │

│   │   ├── publish/                    # Social Publishing module

│   │   │   ├── index.tsx               # Content calendar (week/month view)

│   │   │   ├── compose.tsx             # Multi-platform post composer

│   │   │   ├── queue/

│   │   │   │   ├── index.tsx           # Publishing queue (scheduled, drafts)

│   │   │   │   └── $postId/

│   │   │   │       └── index.tsx       # Post detail + platform results

│   │   │   ├── assets/

│   │   │   │   └── index.tsx           # Brand asset library

│   │   │   ├── templates/

│   │   │   │   ├── index.tsx           # Content templates

│   │   │   │   └── create.tsx          # Create template

│   │   │   └── approvals.tsx           # Pending approvals queue

│   │   │

│   │   ├── engage/                     # Unified Engagement Inbox module

│   │   │   ├── index.tsx               # Unified inbox (all messages)

│   │   │   ├── $conversationId/

│   │   │   │   └── index.tsx           # Conversation thread view

│   │   │   ├── templates/

│   │   │   │   ├── index.tsx           # Response template library

│   │   │   │   └── create.tsx          # Create response template

│   │   │   └── sla.tsx                 # SLA compliance dashboard

│   │   │

│   │   ├── analyze/                    # Analytics \& Reporting module

│   │   │   ├── index.tsx               # Executive analytics dashboard

│   │   │   ├── reports/

│   │   │   │   ├── index.tsx           # Report library

│   │   │   │   ├── create.tsx          # Report builder (drag-and-drop)

│   │   │   │   └── $reportId/

│   │   │   │       ├── index.tsx       # Report viewer

│   │   │   │       └── edit.tsx        # Report editor

│   │   │   ├── dashboards/

│   │   │   │   ├── index.tsx           # Custom dashboard list

│   │   │   │   ├── create.tsx          # Dashboard builder

│   │   │   │   └── $dashboardId/

│   │   │   │       └── index.tsx       # Dashboard view

│   │   │   ├── exports.tsx             # Data export management

│   │   │   └── competitive.tsx         # Competitive intelligence view

│   │   │

│   │   ├── grow/                       # Campaigns \& Giveaways module

│   │   │   ├── index.tsx               # Campaign list

│   │   │   ├── create/

│   │   │   │   ├── index.tsx           # Campaign creation wizard (step 1: template)

│   │   │   │   ├── configure.tsx       # Step 2: Configuration

│   │   │   │   ├── legal.tsx           # Step 3: Legal \& compliance

│   │   │   │   ├── preview.tsx         # Step 4: Preview

│   │   │   │   └── publish.tsx         # Step 5: Publish

│   │   │   └── $campaignId/

│   │   │       ├── index.tsx           # Campaign detail + analytics

│   │   │       ├── entries.tsx         # Entry management + moderation

│   │   │       └── winners.tsx         # Winner selection + prize management

│   │   │

│   │   └── settings/                   # Settings module

│   │       ├── organization/

│   │       │   ├── general.tsx         # Organization name, logo, industry

│   │       │   ├── branding.tsx        # White-label settings (agency tier)

│   │       │   └── billing.tsx         # Subscription + invoice management (₦)

│   │       ├── team/

│   │       │   ├── users.tsx           # Team member list + roles

│   │       │   ├── invitations.tsx     # Pending invitations

│   │       │   ├── roles.tsx           # Role permissions overview

│   │       │   └── audit-log.tsx       # Audit log viewer

│   │       ├── integrations/

│   │       │   ├── social.tsx          # Social account connections

│   │       │   ├── news-sources.tsx    # Nigerian + global news source config

│   │       │   ├── crm.tsx             # HubSpot / CRM integration

│   │       │   └── api-keys.tsx        # API key management

│   │       ├── notifications/

│   │       │   ├── email.tsx           # Email notification preferences

│   │       │   ├── push.tsx            # Push notification preferences

│   │       │   └── quiet-hours.tsx     # Quiet hours (WAT timezone)

│   │       ├── security/

│   │       │   ├── password.tsx        # Password change

│   │       │   ├── mfa.tsx             # MFA setup (TOTP)

│   │       │   └── sessions.tsx        # Active session management

│   │       └── preferences/

│   │           ├── language.tsx        # Language selection

│   │           ├── timezone.tsx        # Timezone (default: Africa/Lagos WAT)

│   │           └── theme.tsx           # Light / Dark mode

│   │

│   │  ── React Components ────────────────────────────────────────────────

│   │

│   ├── components/

│   │   ├── ui/                         # shadcn/ui primitives (copy-paste, not a package)

│   │   │   ├── button.tsx

│   │   │   ├── card.tsx

│   │   │   ├── dialog.tsx

│   │   │   ├── dropdown-menu.tsx

│   │   │   ├── form.tsx

│   │   │   ├── input.tsx

│   │   │   ├── label.tsx

│   │   │   ├── select.tsx

│   │   │   ├── sidebar.tsx

│   │   │   ├── skeleton.tsx

│   │   │   ├── table.tsx

│   │   │   ├── tabs.tsx

│   │   │   ├── toast.tsx               # Sonner toast wrapper

│   │   │   ├── tooltip.tsx

│   │   │   └── badge.tsx

│   │   │

│   │   ├── shared/                     # Cross-module shared components

│   │   │   ├── layout/

│   │   │   │   ├── AppShell.tsx        # Top nav + sidebar + main content layout

│   │   │   │   ├── PageHeader.tsx      # Page title + action buttons

│   │   │   │   ├── Sidebar.tsx         # Module sidebar navigation

│   │   │   │   └── BottomNav.tsx       # Mobile bottom tab bar

│   │   │   ├── data/

│   │   │   │   ├── DataTable.tsx       # TanStack Table wrapper

│   │   │   │   ├── EmptyState.tsx      # Consistent empty state component

│   │   │   │   ├── LoadingSkeleton.tsx # Skeleton loader patterns

│   │   │   │   ├── ErrorBoundary.tsx   # React error boundary

│   │   │   │   └── Pagination.tsx      # Cursor-based pagination controls

│   │   │   ├── charts/

│   │   │   │   ├── LineChart.tsx       # Recharts line chart wrapper

│   │   │   │   ├── BarChart.tsx        # Recharts bar chart wrapper

│   │   │   │   ├── DonutChart.tsx      # Recharts donut/pie chart wrapper

│   │   │   │   ├── AreaChart.tsx       # Recharts area chart wrapper

│   │   │   │   └── ChartContainer.tsx  # Shared chart wrapper (title, legend, loading)

│   │   │   ├── feedback/

│   │   │   │   ├── SentimentBadge.tsx  # Positive / Neutral / Negative badge

│   │   │   │   ├── StatusBadge.tsx     # Generic status badge

│   │   │   │   ├── SeverityIndicator.tsx # Crisis severity S1–S5

│   │   │   │   └── PriorityBadge.tsx   # Low / Normal / High / Critical

│   │   │   ├── forms/

│   │   │   │   ├── NairaInput.tsx      # Currency input field formatted in ₦

│   │   │   │   ├── DateTimePicker.tsx  # WAT-aware date/time picker

│   │   │   │   ├── PlatformSelector.tsx # Multi-platform checkbox selector

│   │   │   │   └── SearchInput.tsx     # Debounced search input

│   │   │   └── modals/

│   │   │       ├── ConfirmDialog.tsx   # Destructive action confirmation

│   │   │       └── CommandPalette.tsx  # Global command palette (Cmd+K)

│   │   │

│   │   ├── monitor/                    # Monitor module components

│   │   │   ├── ArticleCard.tsx         # Media article display card

│   │   │   ├── MentionCard.tsx         # Social mention display card

│   │   │   ├── CrisisAlertBanner.tsx   # Top-of-page crisis alert

│   │   │   ├── CrisisCommandPanel.tsx  # Crisis response actions panel

│   │   │   ├── JournalistCard.tsx      # Journalist CRM card

│   │   │   ├── PressReleaseEditor.tsx  # Rich text press release editor

│   │   │   ├── SentimentTrendChart.tsx # Sentiment over time visualization

│   │   │   ├── ShareOfVoiceChart.tsx   # Share of voice donut chart

│   │   │   └── CoverageFilters.tsx     # Media feed filter panel

│   │   │

│   │   ├── listen/                     # Listen module components

│   │   │   ├── MentionFeed.tsx         # Infinite scroll mention feed

│   │   │   ├── QueryBuilder.tsx        # Boolean query visual builder

│   │   │   ├── AlertRuleForm.tsx       # Alert rule creation form

│   │   │   └── CompetitiveMatrix.tsx   # Competitive brand comparison table

│   │   │

│   │   ├── publish/                    # Publish module components

│   │   │   ├── ContentCalendar.tsx     # Week/month visual calendar

│   │   │   ├── PostComposer.tsx        # Multi-platform post composer

│   │   │   ├── PlatformPreview.tsx     # Per-platform post preview

│   │   │   ├── AssetLibrary.tsx        # Drag-and-drop asset picker

│   │   │   ├── ApprovalWorkflow.tsx    # Content approval status + actions

│   │   │   └── PublishingQueue.tsx     # Scheduled post queue view

│   │   │

│   │   ├── engage/                     # Engage module components

│   │   │   ├── InboxList.tsx           # Conversation list (left pane)

│   │   │   ├── ConversationThread.tsx  # Message thread (right pane)

│   │   │   ├── ResponseComposer.tsx    # Response editor with templates

│   │   │   ├── SenderProfile.tsx       # Contact info sidebar

│   │   │   ├── TemplateLibrary.tsx     # Response template browser

│   │   │   └── SLATimer.tsx            # SLA countdown timer

│   │   │

│   │   ├── analyze/                    # Analyze module components

│   │   │   ├── KPICard.tsx             # Metric tile with sparkline

│   │   │   ├── ReportBuilder.tsx       # Drag-and-drop report canvas

│   │   │   ├── DashboardGrid.tsx       # Resizable widget grid

│   │   │   ├── ExportModal.tsx         # Data export configuration

│   │   │   └── AIInsightCard.tsx       # AI-generated insight display

│   │   │

│   │   └── grow/                       # Grow module components

│   │       ├── CampaignCard.tsx        # Campaign list card

│   │       ├── CampaignWizard.tsx      # Multi-step campaign creator

│   │       ├── EntryTable.tsx          # Campaign entry management table

│   │       ├── WinnerSelector.tsx      # Verifiable random winner selection

│   │       └── PrizeNairaDisplay.tsx   # Prize value formatted in ₦

│   │

│   │  ── Client State \& Hooks ─────────────────────────────────────────────

│   │

│   ├── stores/                         # Zustand client state stores

│   │   ├── inboxStore.ts               # Inbox filter and selection state

│   │   ├── publishingStore.ts          # Calendar view and compose state

│   │   ├── crisisStore.ts              # Active crisis context (real-time)

│   │   └── uiStore.ts                  # Sidebar collapse, theme, modals

│   │

│   ├── hooks/                          # Custom React hooks

│   │   ├── useMonitoringFeed.ts        # Infinite query for mention feed

│   │   ├── useCrisisAlert.ts           # WebSocket crisis alert listener

│   │   ├── usePublishingCalendar.ts    # Calendar data + mutations

│   │   ├── useInbox.ts                 # Inbox query + real-time updates

│   │   ├── useRealtimeMetrics.ts       # WebSocket dashboard metric updates

│   │   ├── useNairaFormatter.ts        # ₦ formatting (₦50,000.00)

│   │   ├── useWATTime.ts               # WAT timezone display helper

│   │   └── usePermission.ts            # CASL permission check hook

│   │

│   └── utils/                          # Web app utilities (presentation only)

│       ├── formatNaira.ts              # ₦ currency formatting utility

│       ├── formatWAT.ts                # WAT datetime formatting utility

│       ├── sentimentColor.ts           # Sentiment label → color mapping

│       └── platformIcon.ts             # Platform name → Lucide icon mapping

│

│  ── Server (Hono API) ────────────────────────────────────────────────────

│

├── server/

│   │

│   ├── api/                            # Hono route handlers (thin — no business logic)

│   │   ├── index.ts                    # Hono app + middleware registration

│   │   ├── monitoring.ts               # GET /api/mentions, /api/articles, /api/crisis

│   │   ├── publishing.ts               # GET/POST /api/posts, /api/schedules

│   │   ├── engagement.ts               # GET/POST /api/conversations, /api/messages

│   │   ├── analytics.ts                # GET /api/reports, /api/dashboards, /api/exports

│   │   ├── campaigns.ts                # GET/POST /api/campaigns, /api/entries

│   │   ├── pr.ts                       # GET/POST /api/press-releases, /api/journalists

│   │   ├── billing.ts                  # GET /api/subscriptions, /api/invoices (₦)

│   │   ├── users.ts                    # GET/POST /api/users, /api/invitations

│   │   └── health.ts                   # GET /health (deep health check)

│   │

│   ├── middleware/                     # Hono middleware (applied in order)

│   │   ├── cors.ts                     # CORS policy

│   │   ├── auth.ts                     # JWT validation → attach user context

│   │   ├── tenant.ts                   # Org validation → set RLS context

│   │   ├── rate-limit.ts               # Per-endpoint sliding window rate limits

│   │   ├── audit.ts                    # Request audit logging (writes to audit\_log)

│   │   └── error-handler.ts            # Global error → standard error response

│   │

│   └── webhooks/                       # Inbound webhook handlers

│       ├── paystack.ts                 # Paystack ₦ payment event handlers

│       ├── twitter.ts                  # Twitter/X account activity webhooks

│       ├── instagram.ts                # Instagram webhook handlers

│       ├── facebook.ts                 # Facebook webhook handlers

│       └── linkedin.ts                 # LinkedIn webhook handlers

│

│  ── Services (Business Logic — Single Source of Truth) ───────────────────

│

├── services/

│   │

│   ├── monitoring/

│   │   ├── monitoring.service.ts       # Media article ingestion, search, alerts

│   │   ├── monitoring.types.ts         # MonitoringInput, ArticleResult, etc.

│   │   ├── monitoring.errors.ts        # MonitoringNotFoundError, etc.

│   │   └── monitoring.service.test.ts  # Unit tests (co-located)

│   │

│   ├── crisis/

│   │   ├── crisis.service.ts           # Severity classification, stakeholder notify

│   │   ├── crisis.types.ts

│   │   ├── crisis.errors.ts

│   │   └── crisis.service.test.ts

│   │

│   ├── listening/

│   │   ├── listening.service.ts        # Social listening query management, sentiment

│   │   ├── listening.types.ts

│   │   ├── listening.errors.ts

│   │   └── listening.service.test.ts

│   │

│   ├── publishing/

│   │   ├── publishing.service.ts       # Post creation, scheduling, approval workflow

│   │   ├── publishing.types.ts

│   │   ├── publishing.errors.ts

│   │   └── publishing.service.test.ts

│   │

│   ├── engagement/

│   │   ├── engagement.service.ts       # Conversation routing, SLA tracking, responses

│   │   ├── engagement.types.ts

│   │   ├── engagement.errors.ts

│   │   └── engagement.service.test.ts

│   │

│   ├── analytics/

│   │   ├── analytics.service.ts        # Report generation, KPI calculation, exports

│   │   ├── analytics.types.ts

│   │   ├── analytics.errors.ts

│   │   └── analytics.service.test.ts

│   │

│   ├── competitive/

│   │   ├── competitive.service.ts      # Share of voice, gap analysis, benchmarking

│   │   ├── competitive.types.ts

│   │   ├── competitive.errors.ts

│   │   └── competitive.service.test.ts

│   │

│   ├── campaigns/

│   │   ├── campaigns.service.ts        # Giveaway campaign lifecycle, entry management

│   │   ├── campaigns.types.ts

│   │   ├── campaigns.errors.ts

│   │   └── campaigns.service.test.ts

│   │

│   ├── pr/

│   │   ├── pr.service.ts               # Press release, journalist CRM, outreach

│   │   ├── pr.types.ts

│   │   ├── pr.errors.ts

│   │   └── pr.service.test.ts

│   │

│   ├── influencer/

│   │   ├── influencer.service.ts       # Influencer discovery, campaign management

│   │   ├── influencer.types.ts

│   │   ├── influencer.errors.ts

│   │   └── influencer.service.test.ts

│   │

│   ├── agency/

│   │   ├── agency.service.ts           # Multi-client workspace, white-label reports

│   │   ├── agency.types.ts

│   │   ├── agency.errors.ts

│   │   └── agency.service.test.ts

│   │

│   ├── user/

│   │   ├── user.service.ts             # User CRUD, organization membership, invitations

│   │   ├── user.types.ts

│   │   ├── user.errors.ts

│   │   └── user.service.test.ts

│   │

│   ├── auth/

│   │   ├── auth.service.ts             # Login, logout, MFA, token refresh

│   │   ├── auth.types.ts

│   │   ├── auth.errors.ts

│   │   └── auth.service.test.ts

│   │

│   ├── billing/

│   │   ├── billing.service.ts          # Paystack subscriptions, ₦ invoicing, webhooks

│   │   ├── billing.types.ts            # All monetary fields in Nigerian Naira

│   │   ├── billing.errors.ts

│   │   └── billing.service.test.ts

│   │

│   ├── notification/

│   │   ├── notification.service.ts     # Push, email, in-app, SMS, WhatsApp delivery

│   │   ├── notification.types.ts

│   │   ├── notification.errors.ts

│   │   └── notification.service.test.ts

│   │

│   └── audit/

│       ├── audit.service.ts            # Append-only audit log writer

│       ├── audit.types.ts

│       └── audit.service.test.ts

│

│  ── Database (PostgreSQL via Drizzle) ────────────────────────────────────

│

├── db/

│   ├── index.ts                        # Drizzle client + connection pool initialization

│   ├── schema/

│   │   ├── core.ts                     # users, organizations, organization\_members, sessions

│   │   ├── auth.ts                     # email\_verification\_tokens, password\_reset\_tokens

│   │   ├── social.ts                   # social\_accounts, api\_quota\_tracking

│   │   ├── monitoring.ts               # monitoring\_campaigns, articles, media\_contacts

│   │   ├── press.ts                    # press\_releases, journalist\_interactions, media\_outreach

│   │   ├── listening.ts                # listening\_queries, mentions, mention\_tags, alerts

│   │   ├── publishing.ts               # posts, post\_assets, publishing\_results, templates

│   │   ├── engagement.ts               # conversations, messages, response\_templates, routing\_rules

│   │   ├── analytics.ts                # dashboards, reports, custom\_metrics, report\_runs, exports

│   │   ├── campaigns.ts                # campaigns, campaign\_entry\_methods, campaign\_entries, winners

│   │   ├── influencer.ts               # influencers, influencer\_campaigns

│   │   ├── billing.ts                  # subscriptions (₦), invoices (₦), payment\_methods, usage\_tracking

│   │   ├── notifications.ts            # notifications, notification\_preferences

│   │   └── audit.ts                    # audit\_log, admin\_audit\_log, dsar\_requests, legal\_holds

│   │

│   ├── migrations/                     # Generated by drizzle-kit generate (never hand-edit)

│   │   ├── 0001\_initial\_schema.sql

│   │   ├── 0002\_add\_rls\_policies.sql

│   │   ├── 0003\_add\_naira\_columns.sql

│   │   └── meta/

│   │       └── \_journal.json           # Drizzle migration journal

│   │

│   └── seed/

│       ├── index.ts                    # Seed runner (bun run db:seed)

│       ├── organizations.ts            # Sample Nigerian brands (bank, fintech, telecom)

│       ├── users.ts                    # Sample users per role

│       ├── articles.ts                 # Sample Nigerian media articles

│       ├── mentions.ts                 # Sample social mentions

│       └── billing.ts                  # Sample subscriptions with ₦ pricing

│

│  ── Lib (Shared Infrastructure Utilities) ──────────────────────────────

│

├── lib/

│   ├── auth/

│   │   ├── jwt.ts                      # JWT issue, verify, refresh (HS256, 15min access)

│   │   └── passwords.ts                # bcrypt via Bun.password

│   │

│   ├── rbac/

│   │   ├── abilities.ts                # CASL ability definitions per role

│   │   ├── permissions.ts              # requirePermission() helper for Hono middleware

│   │   └── abilities.test.ts           # RBAC positive + negative path tests

│   │

│   ├── validation/                     # Zod schemas (shared: web, API, services)

│   │   ├── core.schemas.ts             # Organization, user, invitation schemas

│   │   ├── monitoring.schemas.ts       # Article search, alert rule schemas

│   │   ├── publishing.schemas.ts       # Post creation, scheduling schemas

│   │   ├── engagement.schemas.ts       # Message, conversation, template schemas

│   │   ├── analytics.schemas.ts        # Report, dashboard, export schemas

│   │   ├── campaigns.schemas.ts        # Campaign creation, entry schemas

│   │   ├── billing.schemas.ts          # Subscription, ₦ invoice schemas

│   │   └── crisis.schemas.ts           # Crisis severity, response schemas

│   │

│   ├── cache/

│   │   ├── cache.service.ts            # Cache interface (get, set, delete, invalidateByTag)

│   │   ├── sqlite.cache.ts             # SQLite implementation (bun:sql) — MVP

│   │   ├── redis.cache.ts              # Redis implementation — Year 2 (horizontal scale)

│   │   └── cache.service.test.ts

│   │

│   ├── rate-limit/

│   │   ├── rate-limit.service.ts       # Rate limit interface (check, increment)

│   │   ├── sqlite.rate-limit.ts        # SQLite sliding window implementation

│   │   └── rate-limit.service.test.ts

│   │

│   ├── logger/

│   │   ├── logger.ts                   # Structured JSON logger (never console.log)

│   │   └── logger.types.ts             # Log level types, log entry shape

│   │

│   ├── errors/

│   │   ├── errors.ts                   # Complete typed error hierarchy

│   │   └── http-error-mapper.ts        # Error type → HTTP status code mapping

│   │

│   ├── id/

│   │   └── id.ts                       # Prefixed ID generation (usr\_, org\_, ment\_, etc.)

│   │

│   ├── email/

│   │   ├── email.service.ts            # Nodemailer SMTP wrapper

│   │   ├── templates/

│   │   │   ├── welcome.tsx             # Welcome email (React Email)

│   │   │   ├── verify-email.tsx        # Email verification

│   │   │   ├── reset-password.tsx      # Password reset

│   │   │   ├── team-invite.tsx         # Team invitation

│   │   │   ├── crisis-alert.tsx        # Crisis alert notification

│   │   │   ├── report-delivery.tsx     # Scheduled report delivery

│   │   │   ├── invoice.tsx             # ₦ invoice receipt

│   │   │   ├── renewal-reminder.tsx    # Subscription renewal (₦ amount)

│   │   │   └── weekly-digest.tsx       # Weekly brand health digest

│   │   └── email.service.test.ts

│   │

│   ├── storage/

│   │   ├── storage.service.ts          # R2 / S3-compatible storage interface

│   │   └── storage.service.test.ts

│   │

│   ├── websocket/

│   │   ├── ws.server.ts                # Hono WebSocket handler + org-scoped channels

│   │   └── ws.events.ts                # WebSocket event type definitions

│   │

│   └── i18n/

│       ├── index.ts                    # react-i18next setup

│       ├── defaults.ts                 # Default locale (en-NG), timezone (Africa/Lagos), currency (NGN)

│       └── locales/

│           └── en-NG/

│               └── translation.json    # English (Nigerian English) strings

│

│  ── Shared Types ────────────────────────────────────────────────────────

│

├── shared-types/

│   ├── entities.ts                     # Core entity types (Organization, User, MediaMention, etc.)

│   ├── api.ts                          # API request/response envelope types

│   ├── events.ts                       # WebSocket event payload types

│   ├── billing.ts                      # Billing types (all amounts in ₦)

│   └── permissions.ts                  # Permission string literals for CASL

│

│  ── Mobile (React Native + Expo — Thin Client) ──────────────────────────

│

├── mobile/

│   ├── app/                            # Expo Router file-based navigation

│   │   ├── \_layout.tsx                 # Root layout (auth guard)

│   │   ├── index.tsx                   # Dashboard / home

│   │   ├── monitor/

│   │   │   ├── index.tsx               # Monitoring feed (mobile)

│   │   │   └── crisis.tsx              # Crisis alert view (mobile)

│   │   ├── engage/

│   │   │   └── index.tsx               # Inbox (mobile)

│   │   ├── publish/

│   │   │   └── index.tsx               # Publishing calendar (mobile)

│   │   └── settings/

│   │       └── index.tsx               # Settings (mobile)

│   │

│   ├── components/                     # React Native UI components

│   │   ├── CrisisAlertCard.tsx         # Mobile crisis alert push card

│   │   ├── MentionListItem.tsx         # Mention list row

│   │   └── InboxListItem.tsx           # Conversation list row

│   │

│   └── api-client/

│       ├── client.ts                   # HTTP client (fetch wrapper) for Hono API

│       ├── monitoring.client.ts        # Monitoring API methods

│       ├── engagement.client.ts        # Engagement API methods

│       └── auth.client.ts              # Auth API methods

│

│  ── Tests ──────────────────────────────────────────────────────────────

│

├── tests/

│   ├── integration/                    # API integration tests (Hono test client)

│   │   ├── monitoring.test.ts

│   │   ├── publishing.test.ts

│   │   ├── engagement.test.ts

│   │   ├── crisis.test.ts

│   │   ├── billing.test.ts             # ₦ billing integration tests

│   │   └── rbac.test.ts                # Cross-module RBAC boundary tests

│   │

│   ├── e2e/                            # Playwright web E2E tests

│   │   ├── onboarding.spec.ts          # Full onboarding journey

│   │   ├── crisis-response.spec.ts     # Crisis detection and response

│   │   ├── social-publishing.spec.ts   # Content calendar + approval

│   │   ├── engagement.spec.ts          # Inbox response flow

│   │   └── billing.spec.ts             # Subscription + ₦ invoice flow

│   │

│   ├── e2e/mobile/                     # Maestro mobile E2E tests

│   │   ├── login.yaml

│   │   ├── monitoring-feed.yaml

│   │   └── crisis-alert.yaml

│   │

│   └── fixtures/                       # Shared test data factories

│       ├── organizations.ts            # createTestOrganization()

│       ├── users.ts                    # createTestUser(role)

│       ├── articles.ts                 # createTestArticle()

│       ├── mentions.ts                 # createTestMention()

│       ├── conversations.ts            # createTestConversation()

│       └── billing.ts                  # createTestSubscription() — ₦ pricing

│

│  ── Scripts ─────────────────────────────────────────────────────────────

│

└── scripts/

&#x20;   ├── migrate.ts                      # Production migration runner

&#x20;   ├── seed-production.ts              # Safe production seeding (plan tiers, defaults)

&#x20;   ├── export-openapi.ts               # Generate OpenAPI spec from Hono routes

&#x20;   ├── check-import-boundaries.ts      # Standalone import boundary checker

&#x20;   └── rotate-secrets.ts              # Secret rotation helper (JWT, Paystack)

```



\---



\## Key Structural Decisions Explained



\### 1. Why `services/` is the most important folder



Every business rule, data transformation, and permission check lives here. The web routes (`app/routes/`) and API routes (`server/api/`) only call into services — they never implement logic themselves. This means:



\- A feature works identically whether accessed from the browser, the mobile app, or a webhook

\- Tests for business logic only need to test `services/` — no mocking of HTTP contexts

\- When the framework changes, only the entry point layers change — services survive unchanged



\### 2. Why tests are co-located in `services/`



Unit tests live next to the file they test (`monitoring.service.ts` → `monitoring.service.test.ts`). This makes it immediately obvious when a service has no test coverage, and keeps related code together when refactoring.



Integration tests in `tests/integration/` test the full API stack — middleware, validation, service, database — which is different from unit testing the service in isolation.



\### 3. Why there are separate `monitor/`, `listen/`, and `engage/` folders



Each is a distinct product capability with its own data model, service, and UI. Keeping them separate prevents the accidental coupling that happens when everything lives in a single folder. When the team grows, different engineers can own different modules without conflicts.



\### 4. Why billing lives in both `services/billing/` and `db/schema/billing.ts`



The schema defines the data structure; the service defines the business rules. They are separate because the schema is a technical concern (PostgreSQL columns) and the service is a domain concern (what happens when a subscription lapses). Both use `₦` / `NGN` / `\_naira` naming consistently.



\### 5. Why `lib/` exists separately from `services/`



`lib/` contains infrastructure utilities — things that have no business logic but are used by services (the logger, the cache client, the rate limiter, JWT helpers). Services use `lib/`; `lib/` does not use services. This boundary prevents circular dependencies.



\### 6. Why `shared-types/` is its own folder



Types shared between the web app, the API server, and the mobile app live here. The mobile app can import from `shared-types/` but from nowhere else in the server-side codebase. This is the only bridge between the mobile world and the server world — enforced by the import boundary ESLint rule.



\---



\## Import Boundary Enforcement



The ESLint configuration enforces the import boundaries automatically:



```typescript

// .eslintrc.ts (excerpt)

{

&#x20; rules: {

&#x20;   'import/no-restricted-paths': \['error', {

&#x20;     zones: \[

&#x20;       // Services cannot import from web, API, or mobile

&#x20;       { target: './services', from: './app' },

&#x20;       { target: './services', from: './server' },

&#x20;       { target: './services', from: './mobile' },

&#x20;       // Mobile cannot import from web, API, or services

&#x20;       { target: './mobile', from: './app' },

&#x20;       { target: './mobile', from: './server' },

&#x20;       { target: './mobile', from: './services' },

&#x20;       // lib cannot import from services, web, API, or mobile

&#x20;       { target: './lib', from: './services' },

&#x20;       { target: './lib', from: './app' },

&#x20;       { target: './lib', from: './server' },

&#x20;       { target: './lib', from: './mobile' },

&#x20;       // db cannot import from anything except shared-types

&#x20;       { target: './db', from: './services' },

&#x20;       { target: './db', from: './app' },

&#x20;       { target: './db', from: './server' },

&#x20;       { target: './db', from: './lib' },

&#x20;     ],

&#x20;   }],

&#x20; },

}

```



Any violation causes CI to fail and blocks the PR from being merged.



\---



\*This document is owned by the Engineering Lead. Update it whenever a new module, folder, or significant file is added to the codebase. The structure in this document is the authoritative reference — the actual codebase must match it.\*

