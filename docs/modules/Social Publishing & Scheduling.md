\# Module 4: Social Publishing \& Scheduling



\*\*Document Version:\*\* 1.0.0

\*\*Last Updated:\*\* 2026-07-21

\*\*Status:\*\* Active

\*\*Owner:\*\* Product Lead \& Engineering Lead



\---



\## 1. Module Overview



\### 1.1 Purpose



The Social Publishing \& Scheduling module provides a comprehensive content creation, scheduling, distribution, and performance tracking platform for social media teams operating in the Nigerian and African market. It enables users to create, review, approve, schedule, and publish content across multiple social platforms from a single workspace — with AI-powered optimization, collaborative approval workflows, and content analytics calibrated for Nigerian audience behavior.



This module transforms social media management from a fragmented, manual process into a streamlined, intelligent workflow that saves time, improves content quality, and maximizes engagement for Nigerian brands and agencies.



\### 1.2 Module Objectives



| Objective | Success Measure | Nigerian Context |

|-----------|-----------------|-----------------|

| \*\*Multi-Platform Publishing\*\* | Support 6+ platforms at launch | Twitter/X, Instagram, Facebook, LinkedIn, TikTok, YouTube |

| \*\*Time Savings\*\* | ≥50% reduction in publishing time | Reduce manual copy-paste across platform apps |

| \*\*Content Optimization\*\* | ≥10% increase in engagement rates | Recommendations calibrated to Nigerian audience peak times (WAT) |

| \*\*Team Collaboration\*\* | 100% approval routing accuracy | Multi-level approval workflows for Nigerian enterprise brands |

| \*\*Scheduling Efficiency\*\* | 100+ posts scheduled per week per organization | Bulk scheduling for agency clients |

| \*\*Content Organization\*\* | 10,000+ assets with <2 second retrieval | Centralized brand asset library with CDN delivery |



\### 1.3 Target Users



| Persona | Role | Primary Use Cases |

|---------|------|-------------------|

| \*\*Bola\*\* (Social Media Manager, Telecom) | Creator | Create, schedule, and publish content; manage content calendar; batch-schedule weekly content |

| \*\*Chidi\*\* (Head of Marketing, Fintech) | Admin / Manager | Campaign planning, approval oversight, content strategy, team performance |

| \*\*Kemi\*\* (Content Strategist, E-commerce) | Analyst | Content planning, performance analysis, template management |

| \*\*Ifeoma\*\* (Agency Owner) | Owner (Agency tier) | Multi-client publishing, white-label scheduling, client-level content isolation |

| \*\*Ngozi\*\* (Crisis Manager) | Manager | Emergency content publishing, crisis statement scheduling, approval bypass for urgent content |



\### 1.4 Module Scope



\*\*In Scope:\*\*

\- Multi-platform content composer (Twitter/X, Instagram, Facebook, LinkedIn, TikTok, YouTube)

\- Per-platform content variants with character limit enforcement

\- AI-assisted writing and hashtag suggestions

\- Visual content calendar (month/week/day views)

\- Scheduling with WAT timezone defaults and best-time recommendations

\- Bulk scheduling (CSV import, batch creation)

\- Recurring post configuration

\- Content asset library (images, videos, GIFs, documents)

\- Multi-step approval workflows with role-based routing

\- Draft auto-save and version history

\- Publishing status tracking with error handling and retry

\- Content performance analytics (reach, engagement, clicks)

\- Content templates for brand consistency

\- UTM parameter automation for campaign tracking

\- Link shortening with click tracking



\*\*Out of Scope (Future Phases):\*\*



| Feature | Phase | Timeline |

|---------|-------|---------|

| AI-powered content generation (full drafts) | Phase 6 | Q2 2027 |

| Video editing and optimization | Phase 7 | Q3 2027 |

| Content performance predictions (ML) | Phase 7 | Q3 2027 |

| Automated content curation | Phase 9 | Year 3 |

| A/B testing for content variations | Phase 8 | Q4 2027 |

| Advanced team collaboration (comments, threads) | Phase 6 | Q2 2027 |

| WhatsApp Business content publishing | Phase 5 | Q1 2027 |



\### 1.5 Dependencies



| Module | Relationship |

|--------|-------------|

| \*\*Module 1: Authentication\*\* | Prerequisite — JWT context for all operations |

| \*\*Module 2: Organization \& Account Management\*\* | RBAC enforcement; plan limits for posts and scheduled content; social account connections |

| \*\*Module 3 \& 5: Listening \& Monitoring\*\* | Content inspiration from trending topics; brand mention context |

| \*\*Module 4: Engagement Hub\*\* | Publishing → engagement feedback loop (comments on published posts route to inbox) |

| \*\*Module 6: Analytics \& Reporting\*\* | Content performance data aggregated into unified dashboards |



\---



\## 2. User Stories



\### 2.1 Content Creation



| ID | User Story | Priority | Key Acceptance Criterion |

|----|-----------|----------|--------------------------|

| US-PUB-001 | As a Social Media Manager, I want to create content for multiple platforms simultaneously from one interface | P0 | Content published to all selected platforms within 1 minute of scheduled time |

| US-PUB-002 | As a Social Media Manager, I want platform-specific content variants so each platform gets optimized content | P0 | Twitter/X copy ≠ LinkedIn copy; each respects platform character limits |

| US-PUB-003 | As a Social Media Manager, I want real-time character count with platform-specific limits | P0 | Character counter turns red at 10% remaining; blocks submission if over limit |

| US-PUB-004 | As a Nigerian Social Media Manager, I want hashtag suggestions relevant to Nigerian trends and audiences | P1 | Suggestions include Nigerian trending hashtags (#NaijaTwitter, etc.) |

| US-PUB-005 | As a user, I want AI-assisted writing suggestions to improve engagement | P1 | Suggestions contextually relevant in 80%+ of cases |

| US-PUB-006 | As a user, I want draft auto-save so I never lose work | P0 | Auto-save every 30 seconds; recovered on session restore |



\### 2.2 Scheduling \& Calendar



| ID | User Story | Priority | Key Acceptance Criterion |

|----|-----------|----------|--------------------------|

| US-PUB-010 | As a Social Media Manager, I want a visual content calendar to plan my week | P0 | Calendar loads 100+ posts in <3 seconds; drag-and-drop reschedule works |

| US-PUB-011 | As a Social Media Manager, I want to schedule posts at specific future dates and times in WAT | P0 | Scheduling defaults to WAT (Africa/Lagos); time shows in WAT |

| US-PUB-012 | As a Social Media Manager, I want best-time-to-post recommendations based on my audience | P0 | Recommendations based on historical engagement data; WAT peak times shown |

| US-PUB-013 | As a Social Media Manager, I want to bulk-schedule an entire week's content in one session | P1 | 50+ posts schedulable in under 30 seconds |

| US-PUB-014 | As a user, I want to set up recurring posts for regular content | P2 | Recurring posts up to 52 occurrences; CRON-style configuration |

| US-PUB-015 | As an agency user, I want to manage content calendars for multiple clients without mixing their content | P1 | Client content isolated per organization workspace |



\### 2.3 Approval Workflows



| ID | User Story | Priority | Key Acceptance Criterion |

|----|-----------|----------|--------------------------|

| US-PUB-020 | As a Head of Marketing, I want to review and approve all content before it publishes | P0 | Approval required config blocks publishing until all approvals collected |

| US-PUB-021 | As an approver, I want to receive notifications when content needs my review | P0 | In-app + email notification within 30 seconds of submission |

| US-PUB-022 | As a Head of Marketing, I want to approve, reject, or request changes with comments | P0 | All actions tracked; comments visible to creator |

| US-PUB-023 | As a Social Media Manager, I want urgent content to have an expedited approval path | P1 | "Urgent" flag bypasses standard approval chain to senior approver |

| US-PUB-024 | As an Admin, I want a full audit trail of all approval actions | P1 | Every approval, rejection, and revision logged with WAT timestamp |



\### 2.4 Content Library



| ID | User Story | Priority | Key Acceptance Criterion |

|----|-----------|----------|--------------------------|

| US-PUB-030 | As a Social Media Manager, I want a centralized asset library for all brand media | P0 | Library holds 10,000+ assets; search returns results in <2 seconds |

| US-PUB-031 | As a Content Strategist, I want to tag and organize assets by campaign or content type | P1 | Multi-tag support; filter by tag returns correct results |

| US-PUB-032 | As a user, I want to create and reuse content templates for brand consistency | P1 | Templates apply to new posts with one click |

| US-PUB-033 | As an agency user, I want each client's assets isolated from other clients | P0 | RLS enforces isolation; no cross-client asset visibility |



\### 2.5 Performance \& Analytics



| ID | User Story | Priority | Key Acceptance Criterion |

|----|-----------|----------|--------------------------|

| US-PUB-040 | As a Content Strategist, I want to see post performance (reach, engagement, clicks) | P0 | Performance data shown for all published posts |

| US-PUB-041 | As a Social Media Manager, I want to understand which content types perform best | P1 | Content type breakdown: image, video, text, carousel |

| US-PUB-042 | As a user, I want to export performance data for reporting | P1 | CSV export with all metrics |



\---



\## 3. Functional Requirements



\### 3.1 FR-PUB-001: Multi-Platform Content Composer



\*\*Description:\*\* Single interface for creating content targeting multiple social platforms simultaneously with platform-specific variants.



\*\*Supported Platforms at Launch:\*\*



| Platform | Content Types | Character Limit | Media Limits |

|----------|--------------|----------------|--------------|

| Twitter/X | Text, images, video, GIF, link | 280 characters | 4 images or 1 video (up to 512 MB) |

| Instagram (Feed) | Image, carousel, video, Reel | 2,200 characters (caption) | 1–10 images or 1 video |

| Instagram (Stories) | Image, video | — | 1 image or 1 video (15 seconds) |

| Facebook (Page) | Text, image, video, link | 63,206 characters | Multiple images or 1 video |

| LinkedIn | Text, image, video, document | 3,000 characters | 1 image, 1 video, or document |

| TikTok | Video | 2,200 characters (description) | 1 video (up to 10 minutes) |

| YouTube | Video with thumbnail | 5,000 characters (description) | 1 video per post |



\*\*Composer Features:\*\*



| Feature | Description |

|---------|-------------|

| Shared content mode | Write once, apply to all selected platforms |

| Per-platform variant mode | Customize content for each platform independently |

| Real-time character count | Color-coded: Green (<80%), Yellow (80–95%), Red (>95%), Blocked (>100%) |

| Platform preview | Live preview of how content will appear on each platform |

| Emoji picker | Full emoji library with search |

| Hashtag insertion | Inline hashtag support with auto-completion |

| Mention tagging | @mention support with auto-complete from connected accounts |

| Link insertion | URL validation + automatic link shortening |

| Media attachment | Drag-and-drop or asset library picker |

| Draft auto-save | Every 30 seconds; stored server-side |

| Version history | Last 10 versions accessible |



\*\*AI Writing Assistance:\*\*



| Feature | Description |

|---------|-------------|

| Content improvement | Grammar, tone, clarity suggestions |

| Hashtag recommendations | Based on content, trending Nigerian topics, and historical performance |

| Emoji suggestions | Contextually relevant emojis for Nigerian market |

| Character optimization | Suggestions to trim content to platform limits |

| Engagement prediction | Estimated engagement score with optimization tips |

| Nigerian English awareness | Accepts Nigerian English phrases without flagging as errors |



\*\*Nigerian Market Defaults:\*\*



| Setting | Default |

|---------|---------|

| Scheduling timezone | Africa/Lagos (WAT, UTC+1) |

| Best-time display | All times shown in WAT |

| Hashtag suggestions | Include Nigerian trending hashtags |

| Language | Nigerian English (en-NG) |



\*\*Platform-Specific Specifications Auto-Applied:\*\*



```

Twitter/X:

&#x20; - Character limit: 280 (enforced)

&#x20; - Image aspect ratio: 16:9 or 1:1 recommended

&#x20; - Video: MP4, H.264, ≤512 MB



Instagram Feed:

&#x20; - Caption limit: 2,200 characters

&#x20; - Image aspect ratio: 1:1, 4:5, or 1.91:1

&#x20; - Carousel: 2–10 items, consistent aspect ratio



LinkedIn:

&#x20; - Post limit: 3,000 characters

&#x20; - Article: separate flow

&#x20; - Image: 1200×627px recommended



Facebook:

&#x20; - No hard character limit (63,206 practical)

&#x20; - Image: 1200×630px recommended



TikTok:

&#x20; - Video only (15 seconds to 10 minutes)

&#x20; - Vertical format (9:16) required

&#x20; - Description: 2,200 characters



YouTube:

&#x20; - Video title: 100 characters

&#x20; - Description: 5,000 characters

&#x20; - Tags: 500 characters total

```



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Content created in shared mode appears correctly on all selected platforms |

| AC2 | Character limit enforced in real-time; blocks submission when exceeded |

| AC3 | Platform preview matches actual published appearance |

| AC4 | Draft auto-saved every 30 seconds; recoverable on session restore |

| AC5 | AI suggestions are contextually relevant in ≥80% of cases |

| AC6 | Nigerian English accepted without incorrect grammar flags |

| AC7 | All timestamps in composer show WAT timezone |



\---



\### 3.2 FR-PUB-002: Content Calendar \& Scheduling



\*\*Description:\*\* Visual content calendar with WAT-aware scheduling, best-time recommendations, and drag-and-drop management.



\*\*Calendar Views:\*\*



| View | Description | Use Case |

|------|-------------|---------|

| Month view | All posts for the month; color-coded by platform and status | Campaign planning, content gap identification |

| Week view | Hourly breakdown with platform icons | Daily content management |

| Day view | Detailed timeline for a single day | High-volume publishing days |

| List view | Tabular view of all posts with filters | Bulk management, export |



\*\*Calendar Color Coding:\*\*



| Status | Color | Description |

|--------|-------|-------------|

| Draft | Gray | Not yet submitted or scheduled |

| Pending Approval | Yellow/Amber | Submitted; awaiting approval |

| Approved / Scheduled | Blue | Approved and queued for publishing |

| Publishing | Purple | Currently being published |

| Published | Green | Successfully published |

| Failed | Red | Publishing failed; retry needed |

| Recurring | Dashed border | Auto-generated recurring instance |



\*\*Scheduling Options:\*\*



| Option | Description |

|--------|-------------|

| Publish immediately | Publish as soon as approved (or if no approval required) |

| Schedule for specific time | Date + time picker with WAT timezone |

| Best time recommendation | System suggests optimal WAT time based on audience activity |

| Recurring schedule | Daily, weekly, monthly, or custom CRON-style |



\*\*Best-Time Recommendations (Nigerian Market):\*\*



Based on Nigerian audience activity data, typical best times in WAT:



| Platform | Typical Best Times (WAT) | Notes |

|----------|--------------------------|-------|

| Twitter/X | 7–9 AM, 12–1 PM, 6–8 PM (Mon–Fri) | Nigerian commute and lunch hours |

| Instagram | 11 AM–1 PM, 7–9 PM (Tue–Fri) | Lunchtime and evening browsing |

| Facebook | 8–10 AM, 1–3 PM (Weekdays) | Office hours and lunch breaks |

| LinkedIn | 7–8 AM, 12–1 PM (Tue–Thu) | Professional network peak |

| TikTok | 6–10 PM (Any day) | Evening entertainment |



\*Recommendations personalized after 30 days of historical engagement data. Shown in WAT.\*



\*\*Drag-and-Drop Scheduling:\*\*

\- Drag posts on calendar to reschedule

\- Conflict detection when two posts scheduled at same time for same platform

\- Multi-select for bulk reschedule

\- Undo/redo for recent calendar changes



\*\*Recurring Posts:\*\*



| Frequency | Options | Maximum Occurrences |

|-----------|---------|---------------------|

| Daily | Every N days | 365 |

| Weekly | Selected days of the week | 52 |

| Monthly | Day of month or relative (first Monday, etc.) | 24 |

| Custom | CRON expression | Configurable |



\*\*Scheduling Limits per Plan:\*\*



| Plan | Max Scheduled Posts | Max Recurring Series |

|------|---------------------|----------------------|

| Starter | 30 | 5 |

| Growth | 200 | 20 |

| Professional | 1,000 | 100 |

| Enterprise | Unlimited | Unlimited |

| Agency | 5,000 (across all clients) | 500 |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Calendar loads 100+ posts in <3 seconds |

| AC2 | All scheduling times display and save in WAT |

| AC3 | Best-time recommendations show WAT times with explanation |

| AC4 | Drag-and-drop reschedule updates schedule immediately; persists on refresh |

| AC5 | Recurring post series generates correctly up to configured occurrence limit |

| AC6 | Scheduling limits enforced per plan with upgrade CTA |

| AC7 | Conflict detection alerts when two posts are scheduled at same time for same platform |



\---



\### 3.3 FR-PUB-003: Content Approval Workflows



\*\*Description:\*\* Configurable multi-step approval workflows with role-based routing, audit trail, and expedited crisis path.



\*\*Approval Workflow Configuration:\*\*



| Setting | Options |

|---------|---------|

| Approval required | Yes / No (per organization; per account; per user role) |

| Approvers | Specific users; or any user with role ≥ Manager |

| Approval chain | Sequential (all must approve in order) or parallel (any one approval sufficient) |

| Expiry | Pending approvals expire after 7 days (configurable) |

| Urgent bypass | Urgent flag routes directly to senior approver |



\*\*Approval Status States:\*\*



| State | Description | Who Can See |

|-------|-------------|------------|

| Not Required | Approval config off; can publish directly | All |

| Draft | Created but not yet submitted | Creator |

| Pending Review | Submitted; awaiting approver action | Creator + Approvers |

| Changes Requested | Approver returned with feedback | Creator + Approvers |

| Approved | All required approvals collected | All |

| Rejected | Permanently rejected | Creator + Approvers |

| Escalated | Flagged as urgent; sent to senior approver | Creator + All Approvers |



\*\*Approval Actions:\*\*



| Action | Who Can Perform | Description |

|--------|----------------|-------------|

| Submit for approval | Creator (Creator role) | Sends to configured approvers |

| Approve | Designated approvers | Moves to next step or "Approved" |

| Reject | Designated approvers | Permanently blocks publishing; requires rejection reason |

| Request changes | Designated approvers | Returns to creator with feedback |

| Escalate (urgent) | Creator, Manager+ | Bypasses standard queue; alerts senior approver |

| Recall | Original creator | Withdraws submission (only if still pending) |



\*\*Audit Trail (per post):\*\*



```

Timeline of events (WAT timestamps):

• 2026-07-21 09:45 WAT — Post created by Bola Adeyemi

• 2026-07-21 09:52 WAT — Draft auto-saved (v2)

• 2026-07-21 10:00 WAT — Submitted for approval by Bola Adeyemi

• 2026-07-21 10:15 WAT — Reviewed by Chidi Okonkwo (Head of Marketing)

• 2026-07-21 10:15 WAT — Changes requested: "Shorten the CTA and add a Naira price mention"

• 2026-07-21 10:30 WAT — Revised by Bola Adeyemi (v3)

• 2026-07-21 10:32 WAT — Re-submitted for approval

• 2026-07-21 10:45 WAT — Approved by Chidi Okonkwo

• 2026-07-22 10:00 WAT — Published successfully to Twitter/X, Instagram, Facebook

```



\*\*Approval Notifications:\*\*



| Event | Recipient | Channel | SLA |

|-------|-----------|---------|-----|

| Submitted for approval | All approvers | In-app + email | <30 seconds |

| Approval reminder (48 hours before scheduled time) | All pending approvers | In-app + email | Automated |

| Changes requested | Creator | In-app + email | <30 seconds |

| Approved | Creator | In-app + email | <30 seconds |

| Rejected | Creator | In-app + email | <30 seconds |

| Escalated (urgent) | Senior approver | In-app + email + push | <2 minutes |

| Approval expired (7 days) | Creator + all approvers | Email | Automated |



\*\*Crisis / Urgent Content Path:\*\*



When "Urgent" flag is set (for crisis responses, time-sensitive announcements):

1\. Post bypasses standard approval queue

2\. Immediate notification to designated senior approver (Manager or Admin)

3\. 15-minute response SLA displayed

4\. If unacknowledged after 15 minutes, auto-escalated to all Admins

5\. Full audit trail preserved with "urgent" flag noted



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Approval routing reaches correct approvers in 100% of cases |

| AC2 | Approval notification delivered within 30 seconds of submission |

| AC3 | All approval actions logged with WAT timestamp and actor |

| AC4 | Urgent escalation reaches senior approver within 2 minutes |

| AC5 | Approval expiry occurs after configured period (default: 7 days) |

| AC6 | Rejected posts cannot be published; rejection reason always required |

| AC7 | Creator can recall pending post before first approval action |



\---



\### 3.4 FR-PUB-004: Content Asset Library



\*\*Description:\*\* Centralized asset management with tagging, search, CDN delivery, and organization-level isolation.



\*\*Supported Asset Types:\*\*



| Type | Formats | Max Size | Auto-Processing |

|------|---------|---------|----------------|

| Image | JPG, PNG, WebP, GIF | 10 MB | Thumbnail generation; platform-specific resize variants |

| Video | MP4, MOV, AVI | 500 MB | Thumbnail extraction; platform format check |

| GIF | GIF | 5 MB | Preview generation |

| Document | PDF | 25 MB | Preview page generation |



\*\*Storage and CDN:\*\*



\- Stored in Cloudflare R2

\- Delivered via Bunny CDN for fast access

\- Signed URLs for secure access (1-hour expiry for shared links)

\- Automatic WebP conversion for images (with fallback)



\*\*Asset Metadata:\*\*



| Field | Description |

|-------|-------------|

| Name | File name (editable) |

| Type | Image, video, GIF, document |

| Size | File size in bytes |

| Dimensions | Width × height (images and video) |

| Duration | Video/GIF duration in seconds |

| Upload date | WAT timestamp |

| Uploaded by | User who uploaded |

| Tags | Multi-value; searchable |

| Used in | List of posts using this asset |

| Alt text | Accessibility description |



\*\*Organization and Search:\*\*



| Feature | Description |

|---------|-------------|

| Tags | Multi-value tags for categorization (campaign, product, season, format) |

| Folders | Optional folder hierarchy |

| Search | Full-text search on name, tags, alt text |

| Filters | Type, date range, uploaded by, used/unused |

| Sort | By name, date, size, usage count |

| Bulk actions | Delete, tag, move to folder |



\*\*Plan Limits:\*\*



| Plan | Storage Limit | Max File Size (Image) | Max File Size (Video) |

|------|--------------|----------------------|----------------------|

| Starter | 1 GB | 5 MB | 50 MB |

| Growth | 10 GB | 10 MB | 200 MB |

| Professional | 50 GB | 10 MB | 500 MB |

| Enterprise | 200 GB | 10 MB | 500 MB |

| Agency | 100 GB | 10 MB | 500 MB |



\*\*Content Templates:\*\*



| Feature | Description |

|---------|-------------|

| Create from post | Save any post as a template |

| Variable placeholders | `{{brand\_name}}`, `{{product\_name}}`, `{{price\_naira}}`, `{{date}}` |

| Platform variants | Templates include per-platform content |

| Template library | Search and browse organization templates |

| Sharing | Templates can be marked as organization-wide |

| Apply to new post | One-click apply with variable substitution |



\*\*Nigerian Market Template Examples:\*\*



| Template Name | Use Case |

|--------------|---------|

| "Weekly MTN/Airtel/Glo promotion post" | Telecom promotional content |

| "Product price announcement (₦)" | Price reveal with `{{price\_naira}}` placeholder |

| "TGIF Nigerian edition" | Weekly engagement post template |

| "Public holiday (Nigerian)" | Templates for Nigerian public holidays |

| "Month-end promo countdown" | Nigerian month-end shopping behavior |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Library supports 10,000+ assets with search returning results in <2 seconds |

| AC2 | Asset isolation enforced — no cross-organization asset visibility |

| AC3 | Uploaded images generate thumbnail and platform-specific variants within 30 seconds |

| AC4 | Video upload completes within 60 seconds for 50 MB file on standard connection |

| AC5 | Template variables substitute correctly when applied to new post |

| AC6 | Storage usage displayed with progress bar; warning at 80%; blocked at 100% |



\---



\### 3.5 FR-PUB-005: Publishing Engine \& Status Tracking



\*\*Description:\*\* Reliable multi-platform publishing with real-time status tracking, error handling, and automatic retry.



\*\*Publishing Flow:\*\*



```

Post Approved → Scheduling Queue → Publishing Engine

&#x20;   │

&#x20;   ▼

At scheduled WAT time:

&#x20;   │

&#x20;   ├─ Per-platform publishing (parallel):

&#x20;   │   ├─ Twitter/X → via Twitter API v2

&#x20;   │   ├─ Instagram → via Instagram Graph API

&#x20;   │   ├─ Facebook → via Facebook Graph API

&#x20;   │   ├─ LinkedIn → via LinkedIn Marketing API

&#x20;   │   ├─ TikTok → via TikTok for Business API

&#x20;   │   └─ YouTube → via YouTube Data API v3

&#x20;   │

&#x20;   ├─ Success: Status → Published; platform post ID stored; URL captured

&#x20;   └─ Failure: Retry logic → 3 attempts with exponential backoff

&#x20;                           → If all fail: Status → Failed; alert to creator + admins

```



\*\*Publishing Status States:\*\*



| Status | Description | User Notification |

|--------|-------------|------------------|

| Queued | Scheduled; waiting for publish time | None |

| Publishing | Currently being sent to platform APIs | Real-time indicator |

| Published | Successfully published | In-app + email |

| Partially Published | Some platforms succeeded; some failed | In-app + email (with failed platforms) |

| Failed | All platforms failed | In-app + email + push |

| Cancelled | User cancelled before publish | In-app |



\*\*Retry Logic:\*\*



| Attempt | Timing | Action |

|---------|--------|--------|

| First retry | 2 minutes after failure | Retry all failed platforms |

| Second retry | 8 minutes after first retry | Retry remaining failed platforms |

| Third retry | 30 minutes after second retry | Final retry attempt |

| After 3 failures | — | Status → Failed; creator and admins notified; manual retry option |



\*\*Publishing Error Handling:\*\*



| Error Type | Cause | Recovery |

|-----------|-------|---------|

| Platform authentication failed | OAuth token expired | Auto-refresh token; if fails, notify Admin to reconnect |

| Character limit exceeded | Platform limit changed | Notify creator with specific character count |

| Media format invalid | Platform rejected format | Suggest valid format; show conversion option |

| Rate limit exceeded | Too many API calls | Queue delay; estimated retry time shown |

| Platform maintenance | Platform API down | Queue until platform recovers; estimate shown |

| Network timeout | Connectivity issue | Automatic retry with backoff |



\*\*Post-Publishing Data Captured:\*\*



| Data | Description |

|------|-------------|

| Platform post ID | Native ID for performance tracking |

| Published URL | Direct URL to the published post |

| Published at (WAT) | Actual publication timestamp |

| Platform-specific metrics | Available 2–4 hours after publishing |



\*\*Link Shortening \& UTM:\*\*



| Feature | Description |

|---------|-------------|

| Link shortening | Automatic; uses Nawebeus short domain (`nwb.link/xxxxx`) |

| UTM automation | `utm\_source`, `utm\_medium`, `utm\_campaign`, `utm\_content` auto-appended |

| Click tracking | Clicks tracked via short link; shown in performance data |

| Custom UTM | Override default UTM values per post |



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Posts publish within 1 minute of scheduled WAT time in 99%+ of cases |

| AC2 | Publishing errors provide platform-specific, actionable error messages |

| AC3 | Automatic retry occurs up to 3 times with exponential backoff |

| AC4 | Creator and admins notified within 2 minutes of publishing failure |

| AC5 | Partially published posts show per-platform status clearly |

| AC6 | Platform post URLs captured and accessible immediately after publishing |



\---



\### 3.6 FR-PUB-006: Content Performance Analytics



\*\*Description:\*\* Track post performance across platforms with unified metrics and content optimization insights.



\*\*Performance Metrics by Platform:\*\*



| Metric | Twitter/X | Instagram | Facebook | LinkedIn | TikTok | YouTube |

|--------|-----------|-----------|---------|---------|--------|---------|

| Reach | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Impressions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Likes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Comments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Shares/Retweets | ✅ | ✅ | ✅ | ✅ | ✅ | — |

| Saves | — | ✅ | — | ✅ | ✅ | — |

| Clicks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Video views | — | ✅ | ✅ | ✅ | ✅ | ✅ |

| Watch time | — | — | — | — | ✅ | ✅ |

| Engagement rate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Link clicks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |



\*\*Aggregate Performance Dashboard:\*\*



| Widget | Description |

|--------|-------------|

| Total reach (all platforms) | Sum across all platforms for selected date range |

| Total engagement | Likes + comments + shares + saves |

| Engagement rate | Engagement / Reach × 100 |

| Top performing posts | Ranked by engagement rate |

| Platform performance comparison | Bar chart: each platform's engagement |

| Content type performance | Image vs. video vs. text post comparison |

| Best performing time slots (WAT) | Heatmap showing engagement by hour in WAT |

| Hashtag performance | Which hashtags drive the most reach |



\*\*Content-Level Analytics:\*\*



Each published post shows:

\- Total reach

\- Engagement by type (likes, comments, shares)

\- Engagement rate

\- Link clicks (from UTM tracking)

\- Platform-specific breakdown

\- Performance vs. organization average

\- Performance trend (improving/declining vs. previous similar posts)



\*\*Data Refresh:\*\*



| Platform | Initial data available | Full data available |

|----------|----------------------|---------------------|

| Twitter/X | 1 hour after publish | 24 hours |

| Instagram | 2 hours after publish | 48 hours |

| Facebook | 2 hours after publish | 48 hours |

| LinkedIn | 4 hours after publish | 72 hours |

| TikTok | 2 hours after publish | 48 hours |

| YouTube | 24 hours after publish | 72 hours |



\*\*Nigerian Market Performance Context:\*\*



| Metric | Nigerian Benchmark Note |

|--------|------------------------|

| Engagement rate (Instagram) | Nigerian brand average: 2.5–5%; top performers: 8%+ |

| Best posting time | WAT-calibrated recommendations |

| Video performance | TikTok growing fastest in Nigeria (prioritized in recommendations) |

| WhatsApp shares | Not tracked (private platform) but mentioned as limitation |



\*\*Export:\*\*



\- CSV export with all metrics

\- Date range selection

\- Platform filter

\- Post filter (all posts, specific campaign tag)



\*\*Acceptance Criteria:\*\*



| AC | Criterion |

|----|-----------|

| AC1 | Performance data appears within 2 hours of publishing for major platforms |

| AC2 | Aggregate metrics correctly sum across all platforms |

| AC3 | Engagement rate calculated correctly (Engagement / Reach × 100) |

| AC4 | WAT-timezone heatmap shows Nigerian audience peak times accurately |

| AC5 | CSV export includes all displayed metrics |

| AC6 | Performance comparison shows trend vs. organization historical average |



\---



\## 4. Business Rules



\### 4.1 Content Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| BR-PUB-001 | Posts must not exceed platform-specific character limits | Prevents truncation or API rejection |

| BR-PUB-002 | Image uploads must not exceed 10 MB (Starter/Growth); 10 MB (Pro+) | Performance and platform limits |

| BR-PUB-003 | Video uploads must not exceed plan storage limit | Storage management |

| BR-PUB-004 | Posts must have content (text or media) | Empty posts not allowed |

| BR-PUB-005 | Posts must target at least one platform | Ensures posts have a destination |

| BR-PUB-006 | Drafts auto-saved every 30 seconds | Prevents content loss |

| BR-PUB-007 | Posts cannot be scheduled more than 365 days in advance | Prevents excessive advance scheduling |

| BR-PUB-008 | Maximum 30 hashtags per post (Instagram limit; applies globally for consistency) | Platform compliance |

| BR-PUB-009 | Scheduling time must be in the future (minimum 2 minutes from now) | Allows publishing engine processing time |

| BR-PUB-010 | Monetary values referenced in content recommended to use ₦ (NGN) | Nigerian market consistency |



\### 4.2 Approval Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| BR-PUB-011 | Posts from Creator role require approval if org has approval configured | Quality control |

| BR-PUB-012 | Posts with high-risk keywords (configurable list) require mandatory approval | Brand safety |

| BR-PUB-013 | Approval chains enforce sequential order when configured as sequential | Organizational hierarchy |

| BR-PUB-014 | Pending approvals expire after 7 days (configurable) | Prevents stale approvals |

| BR-PUB-015 | Rejection always requires a reason (minimum 10 characters) | Constructive feedback |

| BR-PUB-016 | Approved posts cannot be edited without re-entering approval workflow | Ensures reviewed content is published |

| BR-PUB-017 | Urgent flag available to Manager+ roles only | Prevents misuse of escalation |



\### 4.3 Publishing Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| BR-PUB-018 | Published within 1 minute of scheduled WAT time (target: 99%+) | Reliable scheduling |

| BR-PUB-019 | Automatic retry up to 3 times with exponential backoff | Handles transient API failures |

| BR-PUB-020 | Creator and admins notified within 2 minutes of publishing failure | Fast incident response |

| BR-PUB-021 | Recurring posts generate maximum 365 occurrences | Prevents infinite loops |

| BR-PUB-022 | UTM parameters automatically appended to all post links | Campaign tracking |



\### 4.4 Content Library Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| BR-PUB-023 | Assets isolated per organization (RLS enforced) | Multi-tenant data integrity |

| BR-PUB-024 | Storage usage checked before each upload; blocked at 100% | Prevents limit overruns |

| BR-PUB-025 | Deleted assets removed from all posts they were attached to | Prevents broken media in posts |

| BR-PUB-026 | Asset used by a scheduled post cannot be deleted | Prevents publishing failures |



\---



\## 5. Validation Rules



\### 5.1 Zod Schemas



```typescript

// lib/validation/publishing.schemas.ts



// Platform-specific character limits

const PLATFORM\_LIMITS = {

&#x20; twitter: 280,

&#x20; instagram: 2200,

&#x20; facebook: 63206,

&#x20; linkedin: 3000,

&#x20; tiktok: 2200,

&#x20; youtube\_description: 5000,

&#x20; youtube\_title: 100,

} as const;



// Post creation schema

export const CreatePostSchema = z.object({

&#x20; title: z.string().max(200, "Internal title too long").optional(),

&#x20; content: z.string().min(1, "Content cannot be empty").optional(),

&#x20; platforms: z.array(z.object({

&#x20;   platform: z.enum(\["twitter", "instagram", "facebook", "linkedin", "tiktok", "youtube"]),

&#x20;   content: z.string().optional(),

&#x20;   mediaIds: z.array(z.string()).max(10, "Maximum 10 media items per platform").optional(),

&#x20; })).min(1, "Select at least one platform"),

&#x20; scheduleType: z.enum(\["immediate", "scheduled", "recurring"]),

&#x20; scheduledAt: z.coerce.date()

&#x20;   .min(new Date(Date.now() + 2 \* 60 \* 1000), "Schedule time must be at least 2 minutes in the future")

&#x20;   .optional(),

&#x20; timezone: z.string().default("Africa/Lagos"),  // WAT default

&#x20; recurringPattern: z.object({

&#x20;   frequency: z.enum(\["daily", "weekly", "monthly", "custom"]),

&#x20;   interval: z.number().int().min(1).max(365),

&#x20;   daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),

&#x20;   maxOccurrences: z.number().int().min(1).max(365),

&#x20;   endDate: z.coerce.date().optional(),

&#x20; }).optional(),

&#x20; tags: z.array(z.string().max(50)).max(10, "Maximum 10 tags per post").optional(),

&#x20; requiresApproval: z.boolean().default(false),

&#x20; isUrgent: z.boolean().default(false),

&#x20; utmCampaign: z.string().max(100).optional(),

&#x20; utmSource: z.string().max(100).optional(),

&#x20; utmMedium: z.string().max(100).optional(),

}).refine(

&#x20; (data) => {

&#x20;   // At least one platform must have content or shared content must exist

&#x20;   return data.content || data.platforms.some(p => p.content);

&#x20; },

&#x20; { message: "Content is required for at least one platform" }

).refine(

&#x20; (data) => {

&#x20;   // Validate platform-specific character limits

&#x20;   for (const platform of data.platforms) {

&#x20;     const content = platform.content || data.content || "";

&#x20;     const limit = PLATFORM\_LIMITS\[platform.platform as keyof typeof PLATFORM\_LIMITS];

&#x20;     if (limit \&\& content.length > limit) {

&#x20;       return false;

&#x20;     }

&#x20;   }

&#x20;   return true;

&#x20; },

&#x20; { message: "Content exceeds platform character limit" }

);



// Media upload schema

export const MediaUploadSchema = z.object({

&#x20; name: z.string().min(1).max(255),

&#x20; mimeType: z.enum(\[

&#x20;   "image/jpeg", "image/png", "image/webp", "image/gif",

&#x20;   "video/mp4", "video/quicktime", "video/avi",

&#x20;   "application/pdf"

&#x20; ]),

&#x20; size: z.number()

&#x20;   .positive()

&#x20;   .max(500 \* 1024 \* 1024, "File exceeds 500 MB maximum"),

&#x20; tags: z.array(z.string()).max(20).optional(),

&#x20; altText: z.string().max(500).optional(),

});



// Approval action schema

export const ApprovalActionSchema = z.object({

&#x20; action: z.enum(\["approve", "reject", "request\_changes"]),

&#x20; comment: z.string()

&#x20;   .max(1000, "Comment too long")

&#x20;   .optional()

&#x20;   .refine(

&#x20;     (comment, ctx) => {

&#x20;       // Rejection requires a reason

&#x20;       if (ctx.parent?.action === "reject" \&\& (!comment || comment.length < 10)) {

&#x20;         return false;

&#x20;       }

&#x20;       return true;

&#x20;     },

&#x20;     { message: "Rejection requires a reason (minimum 10 characters)" }

&#x20;   ),

});



// Schedule update schema

export const ScheduleUpdateSchema = z.object({

&#x20; scheduledAt: z.coerce.date()

&#x20;   .min(new Date(Date.now() + 2 \* 60 \* 1000), "Schedule time must be at least 2 minutes in the future"),

&#x20; timezone: z.string().default("Africa/Lagos"),

});

```



\---



\## 6. Permissions



\### 6.1 RBAC Matrix



| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |

|--------|-------|-------|---------|---------|---------|--------|

| \*\*Content Creation\*\* |

| Create and draft posts | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Edit own draft posts | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Edit any post (before approval) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Delete own drafts | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Delete any post | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| View all posts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| \*\*Scheduling\*\* |

| Schedule posts | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| View content calendar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Create recurring posts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Cancel scheduled post | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |

| \*\*Approval\*\* |

| Submit post for approval | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Approve / Reject posts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Request changes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Mark post as urgent | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Bypass approval (immediate publish) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| \*\*Publishing\*\* |

| Publish immediately | ✅ | ✅ | ✅ | ✅\* | ❌ | ❌ |

| Retry failed publish | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |

| \*\*Content Library\*\* |

| Upload media | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Delete own media | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Delete any media | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Create templates | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

| Edit any template | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| Delete templates | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

| \*\*Analytics\*\* |

| View content performance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Export performance data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |



\*Creator can publish immediately only if approval is not configured for their role.



\---



\## 7. API Reference



\### 7.1 Publishing Endpoints



| Endpoint | Method | Auth | Role | Purpose |

|----------|--------|------|------|---------|

| `/api/v1/publishing/posts` | GET | ✅ | Creator+ | List posts with filters |

| `/api/v1/publishing/posts` | POST | ✅ | Creator+ | Create post |

| `/api/v1/publishing/posts/:id` | GET | ✅ | Creator+ | Get post detail |

| `/api/v1/publishing/posts/:id` | PATCH | ✅ | Creator+ (own) | Update draft post |

| `/api/v1/publishing/posts/:id` | DELETE | ✅ | Manager+ | Delete post |

| `/api/v1/publishing/posts/:id/submit` | POST | ✅ | Creator+ | Submit for approval |

| `/api/v1/publishing/posts/:id/approve` | POST | ✅ | Manager+ | Approve post |

| `/api/v1/publishing/posts/:id/reject` | POST | ✅ | Manager+ | Reject post |

| `/api/v1/publishing/posts/:id/request-changes` | POST | ✅ | Manager+ | Request changes |

| `/api/v1/publishing/posts/:id/schedule` | POST | ✅ | Creator+ | Schedule post |

| `/api/v1/publishing/posts/:id/publish` | POST | ✅ | Manager+ | Publish immediately |

| `/api/v1/publishing/posts/:id/cancel` | POST | ✅ | Creator+ (own) | Cancel scheduled post |

| `/api/v1/publishing/posts/:id/retry` | POST | ✅ | Creator+ (own) | Retry failed publish |

| `/api/v1/publishing/calendar` | GET | ✅ | Creator+ | Get calendar view |

| `/api/v1/publishing/media` | GET | ✅ | Creator+ | List media assets |

| `/api/v1/publishing/media` | POST | ✅ | Creator+ | Upload media |

| `/api/v1/publishing/media/:id` | DELETE | ✅ | Manager+ | Delete media |

| `/api/v1/publishing/templates` | GET | ✅ | Creator+ | List templates |

| `/api/v1/publishing/templates` | POST | ✅ | Creator+ | Create template |

| `/api/v1/publishing/templates/:id` | PATCH | ✅ | Manager+ | Update template |

| `/api/v1/publishing/templates/:id` | DELETE | ✅ | Manager+ | Delete template |

| `/api/v1/publishing/analytics/posts` | GET | ✅ | Analyst+ | Get post performance |

| `/api/v1/publishing/analytics/export` | POST | ✅ | Analyst+ | Export performance CSV |



\### 7.2 Request/Response Examples



\*\*Create Post:\*\*



```http

POST /api/v1/publishing/posts

Authorization: Bearer <token>

Content-Type: application/json



{

&#x20; "title": "First Bank Digital Banking Launch — July 2026",

&#x20; "platforms": \[

&#x20;   {

&#x20;     "platform": "twitter",

&#x20;     "content": "Big news 🎉 First Bank's new digital banking app is live! Experience banking the way it should be — fast, secure, and built for Nigeria. Download now 👇 #FirstBank #DigitalBanking",

&#x20;     "mediaIds": \["med\_7a8b9c0d1e2f3a4b"]

&#x20;   },

&#x20;   {

&#x20;     "platform": "instagram",

&#x20;     "content": "Exciting news! 🚀\\n\\nFirst Bank's new digital banking app is officially live!\\n\\nExperience:\\n✅ Instant transfers\\n✅ Zero hidden fees\\n✅ 24/7 customer support\\n\\nAvailable on iOS and Android. Download the link in bio! 🔗\\n\\n#FirstBank #DigitalBanking #NigerianBanking #Fintech",

&#x20;     "mediaIds": \["med\_7a8b9c0d1e2f3a4b", "med\_8b9c0d1e2f3a4b5c"]

&#x20;   },

&#x20;   {

&#x20;     "platform": "linkedin",

&#x20;     "content": "We're proud to announce the launch of First Bank's new digital banking platform. After months of development and testing, we've built a platform that truly serves Nigerians — whether they're in Lagos or Maiduguri.",

&#x20;     "mediaIds": \["med\_9c0d1e2f3a4b5c6d"]

&#x20;   }

&#x20; ],

&#x20; "scheduleType": "scheduled",

&#x20; "scheduledAt": "2026-07-22T10:00:00+01:00",

&#x20; "timezone": "Africa/Lagos",

&#x20; "tags": \["launch", "digital-banking", "product"],

&#x20; "requiresApproval": true,

&#x20; "utmCampaign": "digital-banking-launch-july-2026",

&#x20; "utmSource": "social",

&#x20; "utmMedium": "organic"

}

```



```json

HTTP/1.1 201 Created



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "post\_9f2a4b6c8d1e3f5g",

&#x20;   "title": "First Bank Digital Banking Launch — July 2026",

&#x20;   "status": "pending\_approval",

&#x20;   "approvalStatus": "pending",

&#x20;   "currentApprover": "usr\_7e3b2c1d",

&#x20;   "platforms": \["twitter", "instagram", "linkedin"],

&#x20;   "scheduledAt": "2026-07-22T10:00:00.000+01:00",

&#x20;   "timezone": "Africa/Lagos",

&#x20;   "createdAt": "2026-07-21T09:45:00.000+01:00"

&#x20; },

&#x20; "meta": {

&#x20;   "timestamp": "2026-07-21T09:45:00.000+01:00",

&#x20;   "requestId": "req\_abc123def456"

&#x20; }

}

```



\*\*Approve Post:\*\*



```http

POST /api/v1/publishing/posts/post\_9f2a4b6c/approve

Authorization: Bearer <token>

Content-Type: application/json



{

&#x20; "action": "approve",

&#x20; "comment": "Great content! The Nigeria-specific angle is perfect. Approved for scheduling."

}

```



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "post\_9f2a4b6c8d1e3f5g",

&#x20;   "approvalStatus": "approved",

&#x20;   "status": "scheduled",

&#x20;   "approvedBy": "usr\_7e3b2c1d",

&#x20;   "approvedAt": "2026-07-21T10:45:00.000+01:00",

&#x20;   "scheduledAt": "2026-07-22T10:00:00.000+01:00"

&#x20; }

}

```



\*\*Get Content Calendar:\*\*



```http

GET /api/v1/publishing/calendar?startDate=2026-07-21\&endDate=2026-07-27\&timezone=Africa/Lagos

Authorization: Bearer <token>

```



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "timezone": "Africa/Lagos",

&#x20;   "calendar": {

&#x20;     "2026-07-21": \[

&#x20;       {

&#x20;         "id": "post\_8e4c5d6e7f8a9b0c",

&#x20;         "title": "Customer Success Story",

&#x20;         "platforms": \["linkedin", "facebook"],

&#x20;         "status": "scheduled",

&#x20;         "scheduledTime": "14:00",

&#x20;         "approvalStatus": "approved"

&#x20;       }

&#x20;     ],

&#x20;     "2026-07-22": \[

&#x20;       {

&#x20;         "id": "post\_9f2a4b6c8d1e3f5g",

&#x20;         "title": "First Bank Digital Banking Launch",

&#x20;         "platforms": \["twitter", "instagram", "linkedin"],

&#x20;         "status": "scheduled",

&#x20;         "scheduledTime": "10:00",

&#x20;         "approvalStatus": "approved"

&#x20;       }

&#x20;     ]

&#x20;   },

&#x20;   "summary": {

&#x20;     "totalScheduled": 12,

&#x20;     "pendingApproval": 3,

&#x20;     "drafts": 5,

&#x20;     "published": 8

&#x20;   }

&#x20; }

}

```



\*\*Upload Media:\*\*



```http

POST /api/v1/publishing/media

Authorization: Bearer <token>

Content-Type: multipart/form-data



file: \[binary data]

name: "first-bank-app-screenshot.jpg"

tags: \["app", "digital-banking", "launch"]

altText: "Screenshot of First Bank's new digital banking app showing the dashboard"

```



```json

HTTP/1.1 201 Created



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "med\_7a8b9c0d1e2f3a4b",

&#x20;   "name": "first-bank-app-screenshot.jpg",

&#x20;   "type": "image",

&#x20;   "url": "https://cdn.nawebeus.com/media/org\_7e3b/med\_7a8b9c0d.jpg",

&#x20;   "previewUrl": "https://cdn.nawebeus.com/media/org\_7e3b/med\_7a8b9c0d\_thumb.jpg",

&#x20;   "size": 2450000,

&#x20;   "mimeType": "image/jpeg",

&#x20;   "dimensions": { "width": 1200, "height": 800 },

&#x20;   "altText": "Screenshot of First Bank's new digital banking app showing the dashboard",

&#x20;   "tags": \["app", "digital-banking", "launch"],

&#x20;   "uploadedAt": "2026-07-21T09:30:00.000+01:00"

&#x20; }

}

```



\*\*Get Post Performance:\*\*



```json

HTTP/1.1 200 OK



{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "post": {

&#x20;     "id": "post\_9f2a4b6c8d1e3f5g",

&#x20;     "title": "First Bank Digital Banking Launch",

&#x20;     "publishedAt": "2026-07-22T10:00:15.000+01:00"

&#x20;   },

&#x20;   "aggregate": {

&#x20;     "totalReach": 185420,

&#x20;     "totalImpressions": 312000,

&#x20;     "totalEngagement": 8745,

&#x20;     "engagementRate": 4.72,

&#x20;     "totalLinkClicks": 2341,

&#x20;     "totalShares": 1205

&#x20;   },

&#x20;   "byPlatform": {

&#x20;     "twitter": {

&#x20;       "reach": 42500,

&#x20;       "likes": 1850,

&#x20;       "retweets": 425,

&#x20;       "comments": 218,

&#x20;       "linkClicks": 892,

&#x20;       "engagementRate": 5.87

&#x20;     },

&#x20;     "instagram": {

&#x20;       "reach": 98500,

&#x20;       "likes": 4200,

&#x20;       "comments": 312,

&#x20;       "saves": 890,

&#x20;       "linkClicks": 1105,

&#x20;       "engagementRate": 5.48

&#x20;     },

&#x20;     "linkedin": {

&#x20;       "reach": 44420,

&#x20;       "likes": 850,

&#x20;       "comments": 125,

&#x20;       "shares": 780,

&#x20;       "linkClicks": 344,

&#x20;       "engagementRate": 3.94

&#x20;     }

&#x20;   },

&#x20;   "vsOrganizationAverage": {

&#x20;     "reachDiff": "+23%",

&#x20;     "engagementRateDiff": "+18%"

&#x20;   }

&#x20; }

}

```



\---



\## 8. Database Schema



\### 8.1 Posts Table



```sql

CREATE TABLE posts (

&#x20; id                  VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; created\_by          VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; title               VARCHAR(200),                           -- Internal title

&#x20; shared\_content      TEXT,                                   -- Shared across platforms

&#x20; platform\_variants   JSONB NOT NULL,                         -- Per-platform content

&#x20; platforms           TEXT\[] NOT NULL,                        -- List of target platforms

&#x20; status              VARCHAR(30) DEFAULT 'draft'

&#x20;                     CHECK (status IN (

&#x20;                       'draft', 'pending\_approval', 'changes\_requested',

&#x20;                       'approved', 'scheduled', 'publishing',

&#x20;                       'published', 'partially\_published', 'failed', 'cancelled'

&#x20;                     )),

&#x20; approval\_status     VARCHAR(20)

&#x20;                     CHECK (approval\_status IN ('not\_required', 'pending', 'approved', 'rejected', 'changes\_requested')),

&#x20; approval\_chain      JSONB,                                  -- Ordered list of approvers

&#x20; current\_approver\_id VARCHAR(32) REFERENCES users(id),

&#x20; approved\_by         VARCHAR(32) REFERENCES users(id),

&#x20; approved\_at         TIMESTAMPTZ,

&#x20; rejected\_by         VARCHAR(32) REFERENCES users(id),

&#x20; rejected\_at         TIMESTAMPTZ,

&#x20; rejection\_reason    TEXT,

&#x20; is\_urgent           BOOLEAN DEFAULT FALSE,

&#x20; schedule\_type       VARCHAR(20) DEFAULT 'immediate'

&#x20;                     CHECK (schedule\_type IN ('immediate', 'scheduled', 'recurring')),

&#x20; scheduled\_at        TIMESTAMPTZ,

&#x20; timezone            VARCHAR(100) DEFAULT 'Africa/Lagos',    -- WAT default

&#x20; recurring\_pattern   JSONB,

&#x20; published\_at        TIMESTAMPTZ,

&#x20; tags                TEXT\[],

&#x20; media\_ids           TEXT\[],

&#x20; template\_id         VARCHAR(32) REFERENCES content\_templates(id),

&#x20; utm\_campaign        VARCHAR(100),

&#x20; utm\_source          VARCHAR(100),

&#x20; utm\_medium          VARCHAR(100),

&#x20; requires\_approval   BOOLEAN DEFAULT FALSE,

&#x20; version             INTEGER DEFAULT 1,

&#x20; created\_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE posts FORCE ROW LEVEL SECURITY;

CREATE POLICY posts\_isolation ON posts

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_posts\_org ON posts(organization\_id);

CREATE INDEX idx\_posts\_status ON posts(organization\_id, status);

CREATE INDEX idx\_posts\_scheduled ON posts(scheduled\_at) WHERE status = 'scheduled';

CREATE INDEX idx\_posts\_creator ON posts(created\_by);

CREATE INDEX idx\_posts\_approver ON posts(current\_approver\_id) WHERE approval\_status = 'pending';

CREATE INDEX idx\_posts\_created\_at ON posts(organization\_id, created\_at DESC);

```



\### 8.2 Publishing Results Table



```sql

CREATE TABLE publishing\_results (

&#x20; id                  VARCHAR(32) PRIMARY KEY,

&#x20; post\_id             VARCHAR(32) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

&#x20; organization\_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; platform            VARCHAR(20) NOT NULL,

&#x20; platform\_post\_id    VARCHAR(255),                           -- Native platform post ID

&#x20; platform\_url        TEXT,                                   -- URL to published post

&#x20; status              VARCHAR(20) DEFAULT 'queued'

&#x20;                     CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'cancelled')),

&#x20; error\_message       TEXT,

&#x20; error\_code          VARCHAR(50),

&#x20; retry\_count         INTEGER DEFAULT 0,

&#x20; scheduled\_at        TIMESTAMPTZ NOT NULL,

&#x20; published\_at        TIMESTAMPTZ,

&#x20; created\_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE publishing\_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE publishing\_results FORCE ROW LEVEL SECURITY;

CREATE POLICY pr\_isolation ON publishing\_results

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_pr\_post ON publishing\_results(post\_id);

CREATE INDEX idx\_pr\_org ON publishing\_results(organization\_id);

CREATE INDEX idx\_pr\_status ON publishing\_results(status) WHERE status IN ('queued', 'publishing');

CREATE INDEX idx\_pr\_scheduled ON publishing\_results(scheduled\_at) WHERE status = 'queued';

```



\### 8.3 Approval History Table



```sql

CREATE TABLE approval\_history (

&#x20; id              VARCHAR(32) PRIMARY KEY,

&#x20; post\_id         VARCHAR(32) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

&#x20; organization\_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; action          VARCHAR(30) NOT NULL

&#x20;                 CHECK (action IN ('submitted', 'approved', 'rejected', 'changes\_requested', 'recalled', 'escalated')),

&#x20; actor\_id        VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; comment         TEXT,

&#x20; version\_snapshot INTEGER,                                   -- Post version at time of action

&#x20; created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

&#x20; -- Immutable — no updates

);



ALTER TABLE approval\_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE approval\_history FORCE ROW LEVEL SECURITY;

CREATE POLICY ah\_isolation ON approval\_history

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_ah\_post ON approval\_history(post\_id, created\_at DESC);

```



\### 8.4 Post Drafts (Version History) Table



```sql

CREATE TABLE post\_drafts (

&#x20; id              VARCHAR(32) PRIMARY KEY,

&#x20; post\_id         VARCHAR(32) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

&#x20; organization\_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; version         INTEGER NOT NULL,

&#x20; shared\_content  TEXT,

&#x20; platform\_variants JSONB NOT NULL,

&#x20; media\_ids       TEXT\[],

&#x20; saved\_by        VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; is\_auto\_save    BOOLEAN DEFAULT FALSE,

&#x20; created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE post\_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE post\_drafts FORCE ROW LEVEL SECURITY;

CREATE POLICY pd\_isolation ON post\_drafts

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_pd\_post ON post\_drafts(post\_id, version DESC);

```



\### 8.5 Media Assets Table



```sql

CREATE TABLE media\_assets (

&#x20; id              VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; name            VARCHAR(255) NOT NULL,

&#x20; asset\_type      VARCHAR(20) NOT NULL

&#x20;                 CHECK (asset\_type IN ('image', 'video', 'gif', 'document')),

&#x20; storage\_url     TEXT NOT NULL,                              -- R2 storage URL

&#x20; cdn\_url         TEXT NOT NULL,                             -- Bunny CDN delivery URL

&#x20; thumbnail\_url   TEXT,

&#x20; size\_bytes      BIGINT NOT NULL,

&#x20; mime\_type       VARCHAR(100) NOT NULL,

&#x20; width           INTEGER,

&#x20; height          INTEGER,

&#x20; duration\_seconds DECIMAL(10,2),                            -- Video/GIF duration

&#x20; tags            TEXT\[],

&#x20; alt\_text        TEXT,

&#x20; folder\_path     TEXT,

&#x20; used\_in\_posts   TEXT\[],                                    -- Array of post IDs using this asset

&#x20; uploaded\_by     VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; is\_deleted      BOOLEAN DEFAULT FALSE,

&#x20; deleted\_at      TIMESTAMPTZ,

&#x20; created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE media\_assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE media\_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY ma\_isolation ON media\_assets

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_ma\_org ON media\_assets(organization\_id) WHERE is\_deleted = FALSE;

CREATE INDEX idx\_ma\_type ON media\_assets(organization\_id, asset\_type) WHERE is\_deleted = FALSE;

CREATE INDEX idx\_ma\_tags ON media\_assets USING GIN(tags) WHERE is\_deleted = FALSE;

CREATE INDEX idx\_ma\_uploader ON media\_assets(uploaded\_by);

```



\### 8.6 Content Templates Table



```sql

CREATE TABLE content\_templates (

&#x20; id              VARCHAR(32) PRIMARY KEY,

&#x20; organization\_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; name            VARCHAR(200) NOT NULL,

&#x20; description     TEXT,

&#x20; shared\_content  TEXT,

&#x20; platform\_variants JSONB,

&#x20; media\_ids       TEXT\[],

&#x20; tags            TEXT\[],

&#x20; variables       JSONB,                                      -- Template variable definitions

&#x20; is\_organization\_wide BOOLEAN DEFAULT FALSE,

&#x20; created\_by      VARCHAR(32) NOT NULL REFERENCES users(id),

&#x20; created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



ALTER TABLE content\_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE content\_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY ct\_isolation ON content\_templates

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_ct\_org ON content\_templates(organization\_id);

CREATE INDEX idx\_ct\_tags ON content\_templates USING GIN(tags);

```



\### 8.7 Post Performance Table



```sql

CREATE TABLE post\_performance (

&#x20; id                      VARCHAR(32) PRIMARY KEY,

&#x20; post\_id                 VARCHAR(32) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

&#x20; organization\_id         VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&#x20; platform                VARCHAR(20) NOT NULL,

&#x20; -- Aggregated metrics

&#x20; reach                   BIGINT DEFAULT 0,

&#x20; impressions             BIGINT DEFAULT 0,

&#x20; likes                   INTEGER DEFAULT 0,

&#x20; comments                INTEGER DEFAULT 0,

&#x20; shares                  INTEGER DEFAULT 0,

&#x20; saves                   INTEGER DEFAULT 0,

&#x20; link\_clicks             INTEGER DEFAULT 0,

&#x20; video\_views             INTEGER DEFAULT 0,

&#x20; engagement\_rate         DECIMAL(6,4) DEFAULT 0,

&#x20; -- Data freshness

&#x20; last\_fetched\_at         TIMESTAMPTZ,

&#x20; data\_complete           BOOLEAN DEFAULT FALSE,              -- True when full data is available

&#x20; -- Timestamps

&#x20; created\_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; updated\_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; UNIQUE(post\_id, platform)

);



ALTER TABLE post\_performance ENABLE ROW LEVEL SECURITY;

ALTER TABLE post\_performance FORCE ROW LEVEL SECURITY;

CREATE POLICY perf\_isolation ON post\_performance

&#x20; USING (organization\_id = current\_setting('app.current\_org\_id', true));



CREATE INDEX idx\_perf\_post ON post\_performance(post\_id);

CREATE INDEX idx\_perf\_org ON post\_performance(organization\_id);

```



\---



\## 9. Email Notifications



\### 9.1 Publishing Notification Templates



| Event | Recipient | Subject | SLA | WAT Context |

|-------|-----------|---------|-----|-------------|

| Post submitted for approval | All approvers | "📝 Review needed: \[Post Title]" | <30 seconds | Approval request with WAT scheduled time |

| Approval reminder (48h before) | Pending approvers | "⏰ Reminder: \[Post Title] needs your review" | Automated | Includes WAT scheduled publish time |

| Approval reminder (24h before) | Pending approvers | "🚨 Urgent reminder: \[Post Title] scheduled in 24 hours" | Automated | WAT countdown |

| Changes requested | Creator | "✏️ Changes needed: \[Post Title]" | <30 seconds | Approver's comments included |

| Post approved | Creator | "✅ Approved and scheduled: \[Post Title]" | <30 seconds | WAT publish time confirmed |

| Post rejected | Creator | "❌ Post rejected: \[Post Title]" | <30 seconds | Rejection reason included |

| Post published successfully | Creator + Manager | "🎉 Published: \[Post Title] — \[Platform list]" | <2 minutes | WAT actual publish time; platform links |

| Partial publish (some failed) | Creator + Admin | "⚠️ Partially published: \[Post Title]" | <2 minutes | Which platforms succeeded/failed |

| Publishing failed | Creator + Admin | "🚨 Publishing failed: \[Post Title]" | <2 minutes | Error details; retry instructions |

| Urgent post escalated | Senior Approver | "🚨 URGENT: Review needed immediately — \[Post Title]" | <2 minutes | 15-minute response SLA |

| Approval expired | Creator + Approvers | "⏰ Approval expired: \[Post Title]" | At expiry | Instructions to resubmit |



\### 9.2 In-App Notifications



| Event | Icon | Message | Dismissible |

|-------|------|---------|------------|

| Submitted for approval | 📝 | "\[Post Title] sent for approval" | Yes |

| Approval required (approver) | ⏰ | "\[Creator] needs your approval on \[Post Title]" | No (sticky) |

| Changes requested | ✏️ | "Changes requested on \[Post Title] by \[Approver]" | No |

| Approved | ✅ | "\[Post Title] approved and scheduled for \[WAT time]" | Yes |

| Published | 🎉 | "\[Post Title] published to \[Platforms]" | Yes |

| Publishing failed | 🚨 | "\[Post Title] failed to publish to \[Platform]" | No (sticky) |

| Auto-save | 💾 | "Draft auto-saved" (subtle, temporary) | Auto-dismiss 3s |



\---



\## 10. Error Handling



\### 10.1 Error Code Reference



| Code | HTTP | Message | User Action |

|------|------|---------|-------------|

| `POST\_NOT\_FOUND` | 404 | Post not found | Check post ID |

| `POST\_CONTENT\_EMPTY` | 422 | Post must have content (text or media) | Add content |

| `POST\_NO\_PLATFORM` | 422 | Select at least one platform | Select a platform |

| `POST\_CHARACTER\_LIMIT` | 422 | Content exceeds \[Platform] character limit of \[N] characters | Shorten content |

| `POST\_PAST\_SCHEDULE` | 422 | Schedule time must be at least 2 minutes in the future | Choose future time |

| `POST\_TOO\_FAR\_FUTURE` | 422 | Cannot schedule more than 365 days in advance | Choose sooner date |

| `MEDIA\_NOT\_FOUND` | 404 | Media asset not found | Check media ID |

| `MEDIA\_UPLOAD\_FAILED` | 422 | Failed to upload — check format and size | Check file requirements |

| `MEDIA\_IN\_USE` | 409 | Cannot delete media used by a scheduled post | Unlink from posts first |

| `APPROVAL\_ALREADY\_COMPLETE` | 409 | This post has already been \[approved/rejected] | View post status |

| `APPROVAL\_NOT\_AUTHORIZED` | 403 | You are not an approver for this post | Contact Admin |

| `REJECTION\_REASON\_REQUIRED` | 422 | Rejection requires a reason (minimum 10 characters) | Add rejection reason |

| `PLATFORM\_AUTH\_FAILED` | 401 | Authentication failed with \[Platform]. Reconnect your account. | Go to Settings → Integrations |

| `PLATFORM\_RATE\_LIMIT` | 429 | \[Platform] rate limit reached. Post will retry automatically. | Wait for retry |

| `PUBLISHING\_FAILED` | 503 | Failed to publish to \[Platform]. Retry or contact support. | Retry or contact support |

| `TEMPLATE\_NOT\_FOUND` | 404 | Template not found | Check template ID |

| `STORAGE\_LIMIT\_REACHED` | 422 | Organization storage limit reached | Delete old assets or upgrade plan |

| `SCHEDULE\_LIMIT\_REACHED` | 422 | Scheduled post limit reached for your plan | Upgrade plan or reduce scheduled posts |

| `RATE\_LIMIT\_EXCEEDED` | 429 | Too many requests | Retry after cooldown |



\---



\## 11. Non-Functional Requirements



\### 11.1 Performance



| Operation | Target |

|-----------|--------|

| Post creation API response | <500ms |

| Calendar view load (100+ posts) | <3 seconds |

| Media upload completion (10 MB image) | <15 seconds |

| Media upload completion (50 MB video) | <60 seconds |

| Content calendar render | <3 seconds |

| Publishing within scheduled WAT time | ≤1 minute (99%+ of posts) |

| Draft auto-save | <1 second (background) |

| Performance data refresh | Every 2–4 hours per platform |

| API response time P95 | <500ms |



\### 11.2 Reliability



| Metric | Target |

|--------|--------|

| Publishing on-time rate | ≥99% within 1 minute of scheduled WAT time |

| Publishing failure auto-retry | Up to 3 attempts with exponential backoff |

| Draft auto-save reliability | 100% (every 30 seconds; server-side) |

| Publishing status notification | Within 2 minutes of event |



\### 11.3 Security



| Control | Implementation |

|---------|---------------|

| Multi-tenant isolation | RLS on all publishing tables |

| Asset access control | Signed CDN URLs (1-hour expiry) |

| Approval audit trail | Immutable `approval\_history` table |

| Platform token storage | Encrypted (AES-256); managed by Module 2 |

| Content moderation | High-risk keyword list triggers mandatory approval |



\---



\## 12. Edge Cases



\### 12.1 Content Edge Cases



| Scenario | Behavior |

|----------|---------|

| User submits post with no content | Validation error: "Post must have content (text or media)" |

| User types Nigerian Pidgin phrases | Accepted without grammar flag errors |

| Character count differs by platform | Per-platform variant mode auto-activated; warning shown |

| Emoji causes character count difference | Platform-aware emoji counting applied |

| User pastes content with invisible characters | Content sanitized before character count |



\### 12.2 Scheduling Edge Cases



| Scenario | Behavior |

|----------|---------|

| Post scheduled 1 minute in the future | Validation error: "Schedule at least 2 minutes ahead" |

| WAT daylight saving time change (none applicable) | Nigeria does not observe DST; no issue |

| Two posts scheduled at same time for same platform | Conflict warning shown; user chooses to proceed or reschedule |

| Internet connection lost during scheduling | Draft auto-saved; schedule re-submitted on reconnection |

| Platform API down at scheduled publish time | Auto-retry 3 times; failure notification if all retries fail |



\### 12.3 Approval Edge Cases



| Scenario | Behavior |

|----------|---------|

| Approver's account deleted before they approve | Escalated to next approver in chain; Admin notified |

| Post scheduled time passes while still pending approval | Warning shown to approver: "This post was due at \[WAT time]"; can approve for immediate publish |

| Creator recalls post after changes are requested | Recall allowed; draft returns to editing state |

| Urgent post with no senior approver available | Escalated to all Admins; visible on dashboard |

| Approved post requires edit (brand safety issue) | Edit triggers "return to draft" status; re-approval required |



\### 12.4 Media Edge Cases



| Scenario | Behavior |

|----------|---------|

| Video too large for platform (e.g., Instagram 1 GB) | Warning shown with platform-specific size limit |

| Asset used by scheduled post is attempted deletion | Deletion blocked: "This asset is used by a scheduled post" |

| Corrupted file uploaded | Validation error with file format suggestion |

| Duplicate upload (same file) | Warning: "This file appears to already exist" with option to use existing |

| Storage limit reached mid-upload | Upload blocked; error shown with upgrade CTA |



\---



\## 13. Future Enhancements



| ID | Enhancement | Priority | Timeline |

|----|-------------|----------|---------|

| FE-PUB-001 | AI-powered content generation (full draft from brief) | High | Phase 6 — Q2 2027 |

| FE-PUB-002 | Video editing and optimization (crop, caption, trim) | Medium | Phase 7 — Q3 2027 |

| FE-PUB-003 | A/B testing for content variations | Medium | Phase 8 — Q4 2027 |

| FE-PUB-004 | Content performance predictions (ML) | Medium | Phase 7 — Q3 2027 |

| FE-PUB-005 | WhatsApp Business content publishing | High | Phase 5 — Q1 2027 |

| FE-PUB-006 | Advanced team collaboration (inline comments, threads on drafts) | Medium | Phase 6 — Q2 2027 |

| FE-PUB-007 | Content performance benchmarks vs. Nigerian industry averages | High | Phase 5 — Q1 2027 |

| FE-PUB-008 | Automated content curation from trending Nigerian topics | Low | Phase 9 — Year 3 |

| FE-PUB-009 | Cross-platform content adaptation (reformat for each platform automatically) | High | Phase 6 — Q2 2027 |

| FE-PUB-010 | Nigerian holiday calendar auto-suggestions (public holidays, cultural events) | Medium | Phase 5 — Q1 2027 |



\---



\## 14. Document Approvals



| Role | Name | Signature | Date |

|------|------|-----------|------|

| Product Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| Engineering Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| Design Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |

| QA Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_ |



\---



\## 15. Related Documents



| Document | Relationship |

|----------|-------------|

| \*\*Module 1: Authentication\*\* | JWT authentication for all publishing endpoints |

| \*\*Module 2: Organization \& Account Management\*\* | RBAC enforcement; plan limits (scheduled posts, storage); social account connections |

| \*\*Module 3 \& 5: Listening \& Monitoring\*\* | Content inspiration from trending topics; mention context |

| \*\*Module 5: Engagement Hub\*\* | Comments on published posts route to engagement inbox |

| \*\*Module 6: Analytics \& Reporting\*\* | Unified dashboards consuming publishing performance data |

| \*\*Architecture\*\* | RLS isolation patterns; publishing engine design |

| \*\*ADRs\*\* | ADR-011 (Paystack — not relevant to publishing); ADR-009 (RLS isolation) |

| \*\*Database Schema\*\* | posts, publishing\_results, media\_assets, content\_templates tables |

| \*\*Engineering Standards\*\* | WAT timezone conventions; ₦ content guidelines; Zod validation patterns |

| \*\*QA Strategy\*\* | Publishing reliability testing; approval workflow testing; Nigerian timezone tests |

| \*\*API Reference\*\* | Complete endpoint documentation |

| \*\*Personas\*\* | Bola (Social Media Manager), Chidi (Head of Marketing), Kemi (Content Strategist), Ifeoma (Agency) |

| \*\*User Journeys\*\* | Journey 5 (Social Publishing), Journey 3 (Engagement) |



\---



\## Document Version History



| Version | Date | Author | Changes |

|---------|------|--------|---------|

| 1.0.0 | 2026-07-21 | Product Lead \& Engineering Lead | Unified and expanded Social Publishing \& Scheduling module. Merges and improves both source documents. Adds: Nigerian market specifics throughout (WAT timezone defaults in all scheduling, Nigerian English and Pidgin acceptance in AI writing assistance, Nigerian audience best-time recommendations with WAT peak hours, Nigerian holiday template suggestions, WhatsApp Business as future publishing target), 6-tier RBAC matrix (replacing 4-tier), WAT-labeled timestamps throughout all notification templates and calendar views, complete RLS-protected database schema for all publishing tables, Bunny CDN integration for asset delivery, urgent content escalation path for crisis communications, complete Zod validation schemas with WAT timezone defaults, Nigerian market template library examples, and Nigerian industry benchmarks for content performance. |



\---



\*This document is owned by the Product Lead and reviewed quarterly. All changes to content creation, scheduling logic, approval workflows, or platform integrations must be reflected in this document before implementation begins.\*

