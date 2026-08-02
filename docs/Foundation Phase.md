Based on the schema you've built, here is the exact order to follow:



\---



\## Phase 0 — Foundation (Do This First, Before Any Code)



```

1\. Run drizzle-kit generate → review the SQL → run drizzle-kit migrate

2\. Seed the database:

&#x20;  - Built-in data\_retention\_policies (isLocked = true)

&#x20;  - System analytics\_metrics (isSystem = true)

&#x20;  - Default feature\_flags

&#x20;  - Default alert\_rules (SLA defaults per org plan tier)

3\. Verify every table exists, every index is created,

&#x20;  every CHECK constraint fires correctly with a test insert

```



\---



\## Phase 1 — Core Infrastructure (Nothing Works Without This)



```

1\.  db/               drizzle client setup (pool, db export)

2\.  lib/id.ts         ID generation (nanoid or cuid2, length 32)

3\.  lib/crypto.ts     hashContent, hashPassword, verifyPassword,

&#x20;                     encrypt/decrypt for tokens and OAuth secrets

4\.  lib/audit.ts      writeAuditEvent() — used by every service

5\.  lib/errors.ts     typed error classes (NotFoundError,

&#x20;                     ValidationError, ConflictError, etc.)

```



\---



\## Phase 2 — Core Module (Users, Orgs, Auth)



Build in this exact order because every other module depends on it:



```

1\.  core/users.service.ts

&#x20;     registerUser, verifyEmail, authenticateUser

&#x20;     changePassword, requestPasswordReset, resetPassword



2\.  core/sessions.service.ts

&#x20;     createSession, validateSession, revokeSession

&#x20;     revokeAllUserSessions, touchSession



3\.  core/organizations.service.ts

&#x20;     createOrganization, getOrgBySlug

&#x20;     getUserOrganizations



4\.  core/members.service.ts

&#x20;     addMember, getOrgMembers, suspendMember



5\.  core/invitations.service.ts

&#x20;     createInvitation, acceptInvitation

&#x20;     expirePendingInvitations (worker)



6\.  core/api-keys.service.ts

&#x20;     createApiKey, validateApiKey



7\.  API routes (auth):

&#x20;     POST /auth/register

&#x20;     POST /auth/login

&#x20;     POST /auth/logout

&#x20;     POST /auth/verify-email

&#x20;     POST /auth/forgot-password

&#x20;     POST /auth/reset-password

&#x20;     GET  /auth/me



8\.  Middleware:

&#x20;     authenticateRequest   (validates session or API key)

&#x20;     requireOrgMembership  (checks org access)

&#x20;     requireRole           (checks member role)

&#x20;     injectOrgContext      (sets app.current\_org\_id for RLS)

```



\*\*Gate:\*\* Do not start Phase 3 until login → session → org access works end to end.



\---



\## Phase 3 — Shared Infrastructure Services



These are used by every domain module. Build them as services, not routes:



```

1\.  shared/audit.service.ts

&#x20;     writeAuditEvent()        (already built in Phase 1 lib/audit.ts,

&#x20;                                formalize here with full typing)



2\.  shared/approval.service.ts

&#x20;     createApprovalRequest

&#x20;     submitForApproval

&#x20;     approveRequest

&#x20;     rejectRequest

&#x20;     getApproverQueue

&#x20;     expireStaleRequests (worker)



3\.  shared/templates.service.ts

&#x20;     createTemplate

&#x20;     getTemplate

&#x20;     getTemplatesForPicker

&#x20;     recordTemplateUsage



4\.  shared/media.service.ts

&#x20;     initiateUpload

&#x20;     confirmUpload

&#x20;     processAsset (pipeline worker)

&#x20;     getAssetUrl

&#x20;     softDeleteAsset



5\.  shared/alerts.service.ts

&#x20;     createAlertRule

&#x20;     fireAlertEvent

&#x20;     acknowledgeAlert

&#x20;     getUnacknowledgedAlerts



6\.  shared/contacts.service.ts

&#x20;     createContact          (base row only)

&#x20;     getContact

&#x20;     updateContact

&#x20;     createContactInteraction

&#x20;     getContactInteractions

```



\*\*Gate:\*\* Approval queue must work before publishing, PR, or engagement go live.



\---



\## Phase 4 — Compliance Module



Build early because NDPR requirements apply from day one:



```

1\.  compliance/impersonation.service.ts

2\.  compliance/dsar.service.ts

3\.  compliance/legal-holds.service.ts

4\.  compliance/system-config.service.ts

&#x20;     getConfigValue        (used by feature flags and rate limits)

5\.  compliance/feature-flags.service.ts

&#x20;     evaluateFlag          (used by every module for feature gating)

6\.  compliance/retention.service.ts (worker)

7\.  compliance/backup.service.ts



&#x20;   API routes:

&#x20;     GET  /admin/audit-log

&#x20;     GET  /admin/impersonation-sessions

&#x20;     POST /admin/impersonate

&#x20;     POST /admin/impersonate/:id/end

&#x20;     GET  /admin/dsar

&#x20;     POST /admin/dsar/:id/process

&#x20;     GET  /admin/feature-flags

&#x20;     PATCH /admin/feature-flags/:key

&#x20;     GET  /admin/system-config

&#x20;     PATCH /admin/system-config

```



\---



\## Phase 5 — Social Accounts



Required by publishing, monitoring, and engagement:



```

1\.  social-accounts/oauth.service.ts

&#x20;     initiateOAuthFlow

&#x20;     consumeOAuthState

&#x20;     connectSocialAccount



2\.  social-accounts/token.service.ts

&#x20;     getAccountsNeedingTokenRefresh

&#x20;     recordTokenRefresh (worker)



3\.  social-accounts/health.service.ts

&#x20;     recordHealthCheck (worker)

&#x20;     getOpenCircuitBreakers



4\.  social-accounts/quota.service.ts

&#x20;     updateQuotaUsage

&#x20;     hasQuotaRemaining



&#x20;   API routes:

&#x20;     GET  /social-accounts

&#x20;     POST /social-accounts/connect/:platform

&#x20;     GET  /social-accounts/oauth/callback/:platform

&#x20;     DELETE /social-accounts/:id

&#x20;     GET  /social-accounts/:id/health

```



\---



\## Phase 6 — Publishing Module



```

1\.  publishing/posts.service.ts

&#x20;     createPost, savePostVersion

&#x20;     getPostVersionHistory

&#x20;     schedulePost, cancelPost



2\.  publishing/results.service.ts

&#x20;     createPublishingResults

&#x20;     getPostsReadyToPublish (worker)

&#x20;     markResultPublishing

&#x20;     markResultPublished

&#x20;     markResultFailed

&#x20;     requeueForRetry



3\.  publishing/calendar.service.ts

&#x20;     getContentCalendar



&#x20;   API routes:

&#x20;     GET    /posts

&#x20;     POST   /posts

&#x20;     GET    /posts/:id

&#x20;     PATCH  /posts/:id

&#x20;     DELETE /posts/:id

&#x20;     POST   /posts/:id/schedule

&#x20;     POST   /posts/:id/cancel

&#x20;     POST   /posts/:id/submit-for-approval

&#x20;     GET    /posts/:id/versions

&#x20;     GET    /posts/calendar



&#x20;   Workers:

&#x20;     publishingDispatcher    polls publishing\_results WHERE status='queued'

&#x20;     publishingRetry         polls publishing\_results WHERE status='failed'

&#x20;     publishingReconciler    syncs platform status back to our records

```



\---



\## Phase 7 — Monitoring Module



```

1\.  monitoring/campaigns.service.ts

&#x20;     createCampaign, getActiveCampaigns

&#x20;     recordCampaignRun (worker)



2\.  monitoring/ingestion.service.ts

&#x20;     ingestArticle

&#x20;     enrichArticle (NLP worker)

&#x20;     markArticleCompetitive (worker)



3\.  monitoring/competitors.service.ts

&#x20;     updateCompetitorMetrics (worker)



4\.  monitoring/crisis.service.ts

&#x20;     createCrisis, acknowledgeCrisis

&#x20;     resolveCrisis, recordResponseAction



&#x20;   API routes:

&#x20;     GET  /monitoring/campaigns

&#x20;     POST /monitoring/campaigns

&#x20;     GET  /monitoring/articles

&#x20;     GET  /monitoring/articles/:id

&#x20;     GET  /monitoring/competitors

&#x20;     POST /monitoring/competitors

&#x20;     GET  /monitoring/crises

&#x20;     POST /monitoring/crises

&#x20;     POST /monitoring/crises/:id/acknowledge

&#x20;     POST /monitoring/crises/:id/resolve



&#x20;   Workers:

&#x20;     articleIngestionWorker

&#x20;     nlpEnrichmentWorker

&#x20;     competitorMetricsWorker (weekly)

```



\---



\## Phase 8 — Engagement Module



```

1\.  engagement/inbox.service.ts

&#x20;     ingestMessage (from platform webhooks)

&#x20;     getInboxMessages, getAtRiskMessages



2\.  engagement/routing.service.ts

&#x20;     getActiveRoutingRules

&#x20;     applyRoutingRules (called on message ingestion)



3\.  engagement/workflow.service.ts

&#x20;     assignMessage, updateMessageStatus

&#x20;     snoozeMessage, overridePriority

&#x20;     recordFirstResponse



4\.  engagement/responses.service.ts

&#x20;     createResponseDraft

&#x20;     submitForApproval, approveResponse

&#x20;     markResponseSent, markResponseFailed



5\.  engagement/sla.service.ts

&#x20;     recordSlaBreach (worker)

&#x20;     getUnescalatedBreaches (worker)

&#x20;     markBreachAlertSent



6\.  engagement/ai.service.ts

&#x20;     storeAiSuggestion

&#x20;     markSuggestionUsed

&#x20;     recordSuggestionFeedback



&#x20;   API routes:

&#x20;     GET    /engagement/inbox

&#x20;     GET    /engagement/messages/:id

&#x20;     POST   /engagement/messages/:id/assign

&#x20;     POST   /engagement/messages/:id/resolve

&#x20;     POST   /engagement/messages/:id/snooze

&#x20;     POST   /engagement/messages/:id/responses

&#x20;     GET    /engagement/messages/:id/responses

&#x20;     POST   /engagement/messages/:id/responses/:rid/send

&#x20;     GET    /engagement/sla/at-risk

&#x20;     GET    /engagement/routing-rules

&#x20;     POST   /engagement/routing-rules



&#x20;   Workers:

&#x20;     platformWebhookProcessor   (ingest → enrich → route)

&#x20;     slaMonitor                 (every 5 min)

&#x20;     csatSender                 (post-resolution)

```



\---



\## Phase 9 — PR Module



```

1\.  pr/journalists.service.ts

&#x20;     createJournalist (contacts + detail transaction)

&#x20;     getJournalists, getConsentedJournalists

&#x20;     updateNdprConsent



2\.  pr/press-releases.service.ts

&#x20;     createPressRelease

&#x20;     updateContent (version history)

&#x20;     submitForApproval, approvePressRelease

&#x20;     getCrisisTemplates



3\.  pr/distributions.service.ts

&#x20;     createDistribution (NDPR gate)

&#x20;     markDistributionSent (worker)

&#x20;     updateDistributionMetrics (webhook)

&#x20;     getQueuedDistributions (worker)



4\.  pr/coverage.service.ts

&#x20;     createCoverageAttribution

&#x20;     verifyCoverageAttribution

&#x20;     getUnverifiedCoverage



&#x20;   API routes:

&#x20;     GET    /pr/journalists

&#x20;     POST   /pr/journalists

&#x20;     PATCH  /pr/journalists/:id/ndpr-consent

&#x20;     GET    /pr/press-releases

&#x20;     POST   /pr/press-releases

&#x20;     PATCH  /pr/press-releases/:id

&#x20;     POST   /pr/press-releases/:id/submit

&#x20;     POST   /pr/press-releases/:id/approve

&#x20;     POST   /pr/distributions

&#x20;     GET    /pr/coverage

&#x20;     POST   /pr/coverage/:id/verify



&#x20;   Workers:

&#x20;     distributionDispatchWorker

&#x20;     coverageAttributionWorker (links monitoring articles to PRs)

```



\---



\## Phase 10 — Influencer Module



```

1\.  influencer/discovery.service.ts

&#x20;     createInfluencer (contacts + detail transaction)

&#x20;     discoverInfluencers

&#x20;     blacklistInfluencer



2\.  influencer/programs.service.ts

&#x20;     createInfluencerProgram

&#x20;     getInfluencerPrograms



3\.  influencer/assignments.service.ts

&#x20;     createAssignment

&#x20;     updateAssignmentStatus (spentNaira atomic update)

&#x20;     updatePaymentStatus, rateInfluencer



4\.  influencer/content.service.ts

&#x20;     submitContent

&#x20;     applyComplianceChecks (pipeline worker)

&#x20;     approveContent, requestContentChanges

&#x20;     markContentPublished



5\.  influencer/performance.service.ts

&#x20;     updateAssignmentPerformance (worker)

&#x20;     updateCampaignActuals (worker)



&#x20;   API routes:

&#x20;     GET    /influencers

&#x20;     POST   /influencers

&#x20;     GET    /influencers/:id

&#x20;     GET    /influencer-programs

&#x20;     POST   /influencer-programs

&#x20;     POST   /influencer-programs/:id/assignments

&#x20;     PATCH  /influencer-programs/:id/assignments/:aid/status

&#x20;     POST   /influencer-programs/:id/assignments/:aid/content

&#x20;     POST   /influencer-programs/:id/assignments/:aid/content/:cid/approve

```



\---



\## Phase 11 — Commerce Module



```

1\.  commerce/products.service.ts

&#x20;     createProduct, updateInventory

&#x20;     publishProduct, softDeleteProduct



2\.  commerce/discounts.service.ts

&#x20;     createDiscount, activateDiscount

&#x20;     redeemDiscount, expireDiscounts (worker)

&#x20;     getActiveDiscounts



3\.  commerce/orders.service.ts

&#x20;     createOrder

&#x20;     updateOrderStatus, updateFulfillment



4\.  commerce/carts.service.ts

&#x20;     upsertCart

&#x20;     markAbandonedCarts (worker)

&#x20;     getCartsNeedingRecoveryEmail (worker)

&#x20;     markCartRecovered



5\.  commerce/sync.service.ts

&#x20;     startSync, completeSync

&#x20;     getRecentSyncLogs



&#x20;   API routes:

&#x20;     GET    /products

&#x20;     POST   /products

&#x20;     PATCH  /products/:id

&#x20;     DELETE /products/:id

&#x20;     GET    /orders

&#x20;     GET    /orders/:id

&#x20;     PATCH  /orders/:id/status

&#x20;     PATCH  /orders/:id/fulfillment

&#x20;     GET    /discounts

&#x20;     POST   /discounts



&#x20;   Workers:

&#x20;     cartAbandonmentWorker    (every 10 min)

&#x20;     cartRecoveryEmailWorker

&#x20;     cartRecoverySmsWorker

&#x20;     discountExpiryWorker     (daily)

&#x20;     productSyncWorker        (per platform)

```



\---



\## Phase 12 — Campaigns Module



```

1\.  campaigns/campaigns.service.ts

&#x20;     createCampaign (campaign + methods transaction)

&#x20;     publishCampaign, endCampaign

&#x20;     getCampaignBySlug



2\.  campaigns/entries.service.ts

&#x20;     createEntry (idempotent, referral counter)

&#x20;     applyFraudScoring (worker)

&#x20;     recordCompletedAction, verifyEntry



3\.  campaigns/winners.service.ts

&#x20;     selectWinners (random + points-based)

&#x20;     notifyWinners (worker)

&#x20;     recordWinnerResponse

&#x20;     updateWinnerFulfillment

&#x20;     forfeitOverdueWinners (worker)



&#x20;   API routes:

&#x20;     GET    /campaigns

&#x20;     POST   /campaigns

&#x20;     GET    /campaigns/:slug        (public)

&#x20;     POST   /campaigns/:id/publish

&#x20;     POST   /campaigns/:id/end

&#x20;     POST   /campaigns/:id/enter    (public — rate limited)

&#x20;     GET    /campaigns/:id/entries

&#x20;     GET    /campaigns/:id/winners

&#x20;     POST   /campaigns/:id/draw

&#x20;     POST   /campaigns/:id/winners/:eid/notify

&#x20;     PATCH  /campaigns/:id/winners/:eid/fulfillment



&#x20;   Workers:

&#x20;     fraudScoringWorker

&#x20;     actionVerificationWorker

&#x20;     winnerDrawWorker             (checks idx\_camp\_auto\_draw)

&#x20;     winnerDeadlineWorker         (checks idx\_entry\_response\_deadline)

```



\---



\## Phase 13 — Analytics Module



Build last because it reads from everything else:



```

1\.  analytics/aggregation.service.ts

&#x20;     upsertAggregate

&#x20;     getAggregates

&#x20;     getTimeSeriesData



2\.  analytics/dashboards.service.ts

&#x20;     createDashboard, getDashboard

&#x20;     updateDashboardWidgets



3\.  analytics/reports.service.ts

&#x20;     createReport, scheduleReport

&#x20;     runReport (worker)

&#x20;     exportReport



4\.  analytics/alerts.service.ts

&#x20;     createAlertRule

&#x20;     evaluateAlerts (worker — runs every minute)

&#x20;     getAlertHistory



&#x20;   API routes:

&#x20;     GET  /analytics/overview

&#x20;     GET  /analytics/time-series

&#x20;     GET  /analytics/dashboards

&#x20;     POST /analytics/dashboards

&#x20;     GET  /analytics/reports

&#x20;     POST /analytics/reports

&#x20;     POST /analytics/reports/:id/run

&#x20;     GET  /analytics/alert-rules

&#x20;     POST /analytics/alert-rules



&#x20;   Workers:

&#x20;     hourlyAggregationWorker

&#x20;     dailyAggregationWorker

&#x20;     reportSchedulerWorker

&#x20;     alertEvaluationWorker    (every 60 seconds)

```



\---



\## Phase 14 — Background Worker Infrastructure



Set up before workers in earlier phases need them:



```

Set up after Phase 2, before Phase 6:



&#x20; lib/queue.ts              job queue (BullMQ or similar)

&#x20; lib/scheduler.ts          cron scheduler

&#x20; lib/worker.ts             base worker class with:

&#x20;                             - error handling

&#x20;                             - retry logic

&#x20;                             - audit event on failure

&#x20;                             - writeAuditEvent on success



Worker registration order (start all workers at app boot):

&#x20; Phase 2:   revokeExpiredSessions (every 5 min)

&#x20;            cleanupExpiredVerificationTokens (daily)

&#x20;            getUsersPendingDeletion (daily)

&#x20; Phase 4:   retentionPolicyWorker (nightly)

&#x20;            backupVerificationWorker (daily)

&#x20; Phase 5:   tokenRefreshWorker (every 30 min)

&#x20;            healthCheckWorker (every 5 min)

&#x20; Phase 6:   publishingDispatcher (every 30 sec)

&#x20;            publishingRetry (every 5 min)

&#x20; Phase 7:   articleIngestionWorker (every 15 min)

&#x20;            nlpEnrichmentWorker (continuous)

&#x20;            competitorMetricsWorker (weekly)

&#x20; Phase 8:   slaMonitor (every 5 min)

&#x20;            csatSender (every hour)

&#x20; Phase 9:   distributionDispatchWorker (every 5 min)

&#x20;            coverageAttributionWorker (every hour)

&#x20; Phase 11:  cartAbandonmentWorker (every 10 min)

&#x20;            cartRecoveryEmailWorker (every 30 min)

&#x20;            discountExpiryWorker (daily)

&#x20; Phase 12:  fraudScoringWorker (continuous)

&#x20;            winnerDrawWorker (every 5 min)

&#x20;            winnerDeadlineWorker (every hour)

&#x20; Phase 13:  hourlyAggregationWorker

&#x20;            dailyAggregationWorker

&#x20;            alertEvaluationWorker (every 60 sec)

```



\---



\## Phase 15 — Frontend (Start After Phase 6 API is Stable)



```

Build in this order (each unlocks the next screen):



&#x20; 1. Auth screens          login, register, verify email, reset password

&#x20; 2. Org setup             create org, invite members, onboarding checklist

&#x20; 3. Social account OAuth  connect Instagram/Twitter/etc.

&#x20; 4. Publishing            post composer, content calendar, approval queue

&#x20; 5. Monitoring            article list, sentiment dashboard, crisis panel

&#x20; 6. Engagement            unified inbox, response composer, SLA panel

&#x20; 7. PR                    journalist CRM, press release editor, distribution

&#x20; 8. Influencer            discovery, campaign briefing, content review

&#x20; 9. Commerce              product catalog, order management, cart recovery

&#x20; 10. Campaigns            campaign builder, entry form (public), winner draw

&#x20; 11. Analytics            dashboards, reports, alert rules

&#x20; 12. Compliance/Admin     audit log viewer, DSAR queue, system config

```



\---



\## Key Rules to Follow Throughout



```

1\. Never skip a gate check — if login doesn't work, nothing else will.



2\. Build the service layer first, then the API routes.

&#x20;  Test services directly before adding HTTP handlers.



3\. Every service function that mutates data must call writeAuditEvent().

&#x20;  No exceptions for security-sensitive operations.



4\. Use database transactions for:

&#x20;  - createJournalist (contacts + journalists)

&#x20;  - createInfluencer (contacts + influencers)

&#x20;  - createCampaign (campaigns + entry methods)

&#x20;  - registerUser (user + org + member + onboarding)

&#x20;  - acceptInvitation (member + invitation status)

&#x20;  - recordSlaBreach (breach insert + message flag update)

&#x20;  - createCoverageAttribution (attribution + press release AVE update)

&#x20;  - updateAssignmentStatus when status = 'contracted' (fee commit)



5\. All background workers must be idempotent.

&#x20;  If a worker runs twice, it should produce the same result.



6\. Feature flags (evaluateFlag) gate every non-core feature.

&#x20;  This lets you deploy code before the feature is ready.



7\. NDPR gates:

&#x20;  - getConsentedJournalists() before every distribution

&#x20;  - contactKind = 'journalist' records need ndprConsentStatus check

&#x20;  - campaign entries collect consent via termsAndConditions acceptance



8\. Nigerian defaults — set these everywhere:

&#x20;  timezone = 'Africa/Lagos'

&#x20;  currency = 'NGN'

&#x20;  language = 'en-NG'

```

