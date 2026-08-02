# Nawebeus

A multi-tenant social media management and PR intelligence SaaS. Each organization (tenant) is a brand, agency, or company whose data must be isolated from every other organization.

## Language

### Tenancy

**Organization**:
A tenant: a brand, agency, or company that subscribes and owns its data.
_Avoid_: Account, tenant, workspace

**Membership**:
The row that binds a user to an organization with a role. All multi-tenant data access is validated against the user's membership.
_Avoid_: Affiliation, association

**Org context**:
The identity of the authenticated user within a single request scope (orgId + userId), carried by AsyncLocalStorage.
_Avoid_: Request context, tenant context

### Authentication

**Session**:
A server-side record that binds a user to a rotating refresh token.
_Avoid_: Login, auth record

**Refresh token**:
A long-lived rotating credential that proves ownership of a session; signed as a JWT containing the sessionId.
_Avoid_: Long-lived token, refresh credential

**Session rotation**:
Revoking the old session and creating a new one on every refresh, so a reused refresh token is detectable.
_Avoid_: Token refresh, re-issue

**Token binding**:
The SHA-256 hash of the refresh token stored in the session row (`session_token_hash`). Verified on refresh and sign-out so a token that does not match its session row is rejected.
_Avoid_: Token hash, session hash

**Access token**:
A short-lived JWT carrying userId + orgId, used to authenticate each API request.
_Avoid_: Auth token, bearer

### Authorization

**Ability**:
A user's permitted actions for one organization, built from role permissions via CASL and scoped with the organizationId condition.
_Avoid_: Permissions, role rights

**Permission string**:
The canonical `subject.action` string (e.g. `organization.update`) stored in the `permissions` table and loaded into abilities.
_Avoid_: Permission code, scope string

### Intelligence

**Monitor**:
A persistent search configuration (keywords, boolean expressions, filters) that watches for mentions of a brand or topic. A monitor is set up once and keeps watching.
_Avoid_: Monitoring campaign, query, watch, topic

**Mention**:
A single social media post, news article, or broadcast segment that references the monitored brand or topic. Mentions are what a monitor finds.
_Avoid_: Post (when referring to inbound content), item, hit

**Source**:
A publication, platform, or account that mentions can come from (e.g. Punch, X, Channels TV).
_Avoid_: Publisher, outlet

### Publishing

**Content**:
The generic outbound unit — anything an Organization creates and publishes. Encompasses social media posts, blog posts, press releases, etc.
_Avoid_: Post (when referring to outbound social media), message, entry

**Post**:
A specific type of Content: a blog post or long-form web article published to the Organization's own site. Not a social media share.
_Avoid_: Social post, update, blog entry

### Engagement

**Conversation**:
A thread of inbound messages on a platform (a DM thread, a comment thread). The team works on the conversation — the unit of engagement work.
_Avoid_: Thread, message thread

**Message**:
A single turn inside a conversation. Messages are the parts; the conversation is the whole.
_Avoid_: Reply (when referring to inbound), comment

**Response**:
The outbound reply a team member sends back into a conversation. Distinct from inbound messages.
_Avoid_: Reply, answer

### Promotions

**Campaign**:
A timebound promotional activity with consumer participation: entries, prizes, referrals, UGC, or contests tracked against engagement KPIs. Distinct from an Initiative (media coverage) and a Program (paid creator partnerships).
_Avoid_: Giveaway (one type), contest (one type), referral (one type), UGC (one type), promo, sweepstakes

**Entry**:
A participant's completed action within a campaign (e.g. a follow, a share, a referral). Entries accumulate toward points or prizes.
_Avoid_: Submission, participation record

### Public Relations

**Initiative**:
A timebound PR strategic effort with defined objectives, risks, stakeholders, and ROI measurement. Tracks the full arc of a media push: press releases → distribution → coverage attribution → AVE. Distinct from a Campaign (consumer participation) and a Program (paid creator partnerships).
_Avoid_: PR campaign, push (too informal), activation (too tactical)

### Influencer

**Program**:
A structured influencer effort that coordinates paid partnerships across one or more creators, with creative briefs, content submissions, performance tracking, and installment-based payments. Distinct from a Campaign (consumer participation) and an Initiative (media coverage).
_Avoid_: Influencer campaign, partnership (that's an assignment, not a program), activation (too tactical)
