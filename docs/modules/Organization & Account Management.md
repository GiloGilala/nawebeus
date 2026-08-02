# Module 2: Organization & Account Management

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

This module manages the core organizational structure of a Nawebeus account. It provides administrators with the tools to configure their workspace, manage team members and their permissions, handle billing and subscriptions in Nigerian Naira (₦), and control access across all platform modules. The module is built on a multi-tenant architecture that guarantees strict data isolation between organizations, with defaults optimized for the Nigerian and African market.

This module is the **operational foundation** for the entire platform. Module 1 (Authentication) creates user identities; this module establishes the organizational context within which all platform activity occurs.

### 1.2 Module Objectives

| Objective | Success Measure |
|-----------|-----------------|
| **Multi-tenant organization management** | 100% data isolation; zero cross-tenant leakage verified by automated tests |
| **Team collaboration** | Support 5+ users per organization (Growth); unlimited (Enterprise/Agency) |
| **Role-based access control** | 6-tier RBAC enforced across all modules at UI, API, and database layers |
| **₦ Billing and subscription management** | 99.9% Paystack payment success rate; <5% involuntary churn |
| **Onboarding and adoption** | 80% of new users complete onboarding within 7 days; first value within 10 minutes |
| **Nigerian market fit** | Default currency NGN (₦); default timezone WAT (Africa/Lagos); Nigerian media sources pre-loaded |
| **Compliance** | NDPR, GDPR, CCPA compliant; SOC 2 ready (Year 2) |

### 1.3 Module Scope

**In Scope:**
- Organization creation, configuration, and lifecycle management
- Nigerian market defaults (NGN currency, WAT timezone, Nigerian media source pre-population)
- Team member invitation, role assignment (6-tier), and access control
- RBAC enforcement across all platform modules
- Paystack-based subscription plan management (₦ pricing) with usage tracking and enforcement
- ₦ billing administration (invoices, payment methods, billing history)
- Multi-tenant data isolation (RLS + application layer + service layer)
- Post-registration onboarding wizard and "Getting Started" checklist
- Social account connection management (organization-owned)
- Notification configuration (per-user and organization-level)
- Audit logging for all administrative actions
- Agency white-label settings (Agency tier)

**Out of Scope (Future Phases):**

| Feature | Phase | Timeline |
|---------|-------|---------|
| Hierarchical organizations (parent/child) | Phase 8 | Q4 2027 |
| Department/team hierarchy within organizations | Phase 6 | Q2 2027 |
| Custom roles and permissions | Phase 6 | Q2 2027 |
| Enterprise SSO integration | Phase 6 | Q2 2027 |
| SCIM automated provisioning | Phase 7 | Q3 2027 |

### 1.4 Target Users

| Persona | Role | Primary Use Cases in This Module |
|---------|------|----------------------------------|
| **Ade** (Head of PR, Enterprise Bank) | Owner / Admin | Organization setup, team management, ₦ billing oversight |
| **Chidi** (Head of Marketing, Fintech) | Admin / Manager | Team invitations, role management, social account connections |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client workspace management, white-label settings |
| **Bola** (Social Media Manager) | Creator | Notification preferences, profile settings, onboarding completion |
| **Tunde** (Digital Analyst) | Analyst | Usage visibility, notification preferences |
| **Ngozi** (Crisis Manager) | Manager | Team coordination, conversation assignment |

### 1.5 Dependencies

| Module | Relationship |
|--------|-------------|
| **Module 1: Authentication & User Management** | Prerequisite — users must exist before organization membership is possible |
| **Module 3: Social Media Integration** | Depends on this module — social accounts are managed here and used there |
| **Module 4: Media Monitoring** | Depends on this module — monitoring data is scoped to organization |
| **Module 5: Billing** | Tightly integrated — subscription tiers defined here; Paystack integration here |
| **All other modules** | Depend on this module for RBAC enforcement and organization context |

---

## 2. User Stories

### 2.1 Organization Setup & Configuration

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-001 | As a new Admin, I want to set up my organization so my team can start using Nawebeus | P0 | Organization created with NGN and WAT defaults within 2 seconds |
| US-ORG-002 | As an Admin, I want to configure organization settings (name, logo, timezone, currency) | P0 | Settings saved and reflected platform-wide within 30 seconds |
| US-ORG-003 | As an Admin, I want to upload my organization logo | P0 | Logo displayed in header, reports, and email footers |
| US-ORG-004 | As a Nigerian Admin, I want my organization to default to ₦ (NGN) and WAT timezone | P0 | Defaults applied automatically; no manual configuration needed |
| US-ORG-005 | As an Agency Admin, I want to configure white-label settings for client reports | P1 | White-label report delivered with agency branding, not Nawebeus branding |

### 2.2 Team Management

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-010 | As an Admin, I want to invite team members to my organization | P0 | Invitation email delivered within 30 seconds |
| US-ORG-011 | As an Admin, I want to assign roles (Owner, Admin, Manager, Creator, Analyst, Viewer) to team members | P0 | Role takes effect immediately; no re-login required |
| US-ORG-012 | As an Admin, I want to view all team members and their roles and last-active time | P0 | Table loads within 2 seconds; last-active shows WAT timestamp |
| US-ORG-013 | As a Manager, I want to invite team members but only with roles below Manager | P0 | Manager cannot assign Admin or Owner role |
| US-ORG-014 | As an Admin, I want to deactivate team members who leave the organization | P0 | Deactivated users cannot log in; data preserved |
| US-ORG-015 | As an Admin, I want to view an audit log of all administrative actions | P1 | Audit log shows who did what, when (WAT), from where |
| US-ORG-016 | As an Admin, I want to export my team list to CSV | P1 | CSV exported within 5 seconds with all relevant fields |

### 2.3 Billing & Subscription (₦)

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-020 | As an Admin, I want to view my current subscription plan and usage metrics | P0 | Usage shown with progress bars; all ₦ amounts clearly labeled |
| US-ORG-021 | As an Admin, I want to upgrade my subscription plan via Paystack | P0 | Plan upgraded immediately; ₦ charge processed via Paystack |
| US-ORG-022 | As an Admin, I want to downgrade my subscription plan | P0 | Downgrade scheduled for next billing cycle; impact shown |
| US-ORG-023 | As an Admin, I want to add a Paystack payment method (card or bank account) | P0 | Payment method added via Paystack Popup; stored securely |
| US-ORG-024 | As an Admin, I want to view billing history and download ₦ invoices | P0 | PDF invoices show ₦ amounts; downloadable from billing dashboard |
| US-ORG-025 | As an Admin, I want to see usage warnings before hitting plan limits | P0 | Warning at 80%; blocking message at 100% with upgrade CTA |
| US-ORG-026 | As an Admin, I want to cancel my subscription | P0 | Cancellation processed; access continues until period end |

### 2.4 Onboarding

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-030 | As a new user, I want to complete an onboarding wizard to get value quickly | P0 | First monitoring result visible within 10 minutes |
| US-ORG-031 | As a new user, I want to connect my first social account | P0 | OAuth connection completes within 60 seconds |
| US-ORG-032 | As a new user, I want to see a "Getting Started" checklist I can track progress on | P0 | Checklist persists across sessions; auto-marks complete |
| US-ORG-033 | As a new user, I want to skip onboarding and explore on my own | P0 | "Skip" works; "Continue Setup" banner persists |
| US-ORG-034 | As a Nigerian user, I want Nigerian news sources pre-loaded as monitoring defaults | P0 | Punch, Vanguard, BusinessDay, TechCabal, Channels TV pre-configured |

### 2.5 Multi-Tenant Isolation

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-040 | As a user, I want my organization's data to be completely private | P0 | Zero leakage verified by automated isolation tests |
| US-ORG-041 | As an agency user, I want to switch between client organizations | P1 | Context switch is instant; no data leaks between contexts |
| US-ORG-042 | As a security-conscious Admin, I want all cross-organization attempts logged | P0 | All attempts logged with requestId, IP, and user details |

### 2.6 Social Account Management

| ID | User Story | Priority | Key Acceptance Criterion |
|----|-----------|----------|--------------------------|
| US-ORG-050 | As an Admin/Manager, I want to connect social media accounts for my organization | P0 | OAuth completes within 60 seconds; account visible to all org members |
| US-ORG-051 | As an Admin, I want to disconnect social accounts with impact analysis | P0 | Impact shown before disconnect; confirmation requires typing account name |
| US-ORG-052 | As a user, I want to see which social accounts are connected and their status | P0 | Connection status (Active, Error, Needs Re-auth) clearly displayed |
| US-ORG-053 | As an Admin, I want to know who connected each account and when | P0 | Connected-by user and timestamp displayed; persists after user departure |

---

## 3. Functional Requirements

### 3.1 FR-ORG-001: Organization Creation & Setup

**Description:** Automatically create and initialize a new organization upon user registration, with Nigerian market defaults applied automatically.

**Organization Creation Process:**

```
1. User completes registration (Module 1)
2. System creates organization within the same database transaction:
   - Unique organization ID (prefixed: org_xxxxxxxx)
   - Unique slug (auto-generated from name; URL-safe)
   - Default settings (see table below)
3. User assigned as Owner of the organization
4. Paystack customer record created for billing
5. 14-day Pro trial activated (no credit card required)
6. Nigerian media source defaults pre-populated (if Nigerian IP detected)
7. Onboarding wizard triggered on first dashboard visit
```

**Organization Default Settings:**

| Setting | Default (Nigerian Organization) | Default (Other) | Configurable |
|---------|--------------------------------|-----------------|-------------|
| Currency | NGN (₦) | USD | Admin only |
| Timezone | Africa/Lagos (WAT, UTC+1) | UTC | Admin only |
| Language | en-NG | en | Admin only |
| Date format | DD/MM/YYYY | MM/DD/YYYY | Admin only |
| Subscription Plan | Starter (trial) | Starter (trial) | Via billing only |
| Trial Duration | 14 days | 14 days | No |
| Logo | None | None | Admin only |
| Industry | None | None | Admin only |
| White-label | false | false | Agency tier only |

**Nigerian Media Source Pre-Population (on Detection):**

When the registering user's IP resolves to Nigeria, the following media sources are pre-populated in the monitoring module:

| Source | Type | Authority |
|--------|------|-----------|
| Punch Nigeria | National newspaper | High |
| Vanguard | National newspaper | High |
| BusinessDay | Business publication | High |
| The Guardian Nigeria | National newspaper | High |
| TechCabal | Tech publication | High |
| Techpoint Africa | Tech publication | Medium |
| Nairametrics | Financial news | High |
| Channels TV (online) | Broadcast | High |
| NTA (online) | Broadcast | High |

**Slug Generation Rules:**
- Auto-generated from organization name
- Lowercase only; spaces → hyphens; special characters removed
- Unique across system (append `-2`, `-3`, etc. if needed)
- Maximum 50 characters
- Example: "First Bank of Nigeria" → `first-bank-nigeria`

**Trial Activation:**
- 14-day trial of the Professional plan
- No credit card required to start trial
- Full Professional features during trial
- 7-day and 1-day expiration reminders via email (WAT times in emails)
- Automatic downgrade to Starter plan at expiration (if no Paystack payment method)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Successful registration creates organization within 2 seconds |
| AC2 | User assigned Owner role automatically |
| AC3 | Organization gets unique ID and unique slug |
| AC4 | 14-day Professional trial activated immediately |
| AC5 | Nigerian organizations default to NGN (₦) and Africa/Lagos (WAT) |
| AC6 | Nigerian media sources pre-populated for Nigerian IPs |
| AC7 | If organization creation fails, user registration is rolled back (atomic transaction) |
| AC8 | Trial expiration date displayed clearly in billing dashboard |

---

### 3.2 FR-ORG-002: Organization Settings Management

**Description:** Allow Admins to configure all organization-level settings, with Nigerian-specific field support.

**Editable Settings:**

| Setting | Validation | Nigerian Context |
|---------|-----------|-----------------|
| Organization Name | 2–100 characters; unique | — |
| Organization Logo | JPG/PNG/SVG; max 5 MB; auto-resized 400×400px | — |
| Industry | Dropdown: Banking, Fintech, Telecom, FMCG, PR Agency, Government, Media, Technology, Other | Nigerian industries prominent |
| Company Website | Valid URL | — |
| Physical Address | Street, City, State/Province, Postal Code, Country | Nigerian states list included |
| Timezone | IANA timezone | Defaults to Africa/Lagos |
| Language | Dropdown | en-NG default for Nigerian orgs |
| Currency | Dropdown: NGN, USD, GBP, EUR | NGN (₦) default for Nigerian orgs |
| Billing Email | Valid email; required | — |
| Tax ID / TIN | Optional | Nigerian TIN or CAC Registration Number format |
| Business Phone | E.164 format | Nigerian +234 auto-format |
| Organization Slug | 2–50 chars; lowercase; alphanumeric + hyphens; unique | — |
| White-label Settings | Agency tier only | Agency name, logo, colors for reports |

**Settings Change Behavior:**
- Changes saved via `PATCH /api/v1/organizations/:id`
- All changes take effect platform-wide within 30 seconds
- All changes logged in audit log with before/after values
- Email notification to all Admins for critical changes (name, slug, billing email)
- ₦ currency change updates all monetary displays immediately

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Admin saves settings; confirmation shown; changes reflect within 30 seconds |
| AC2 | Timezone change updates all timestamps for all members (WAT for Nigerian orgs) |
| AC3 | Currency change to NGN (₦) updates all monetary displays immediately |
| AC4 | Invalid logo (>5 MB, wrong format) → specific validation error |
| AC5 | Slug change validates uniqueness before saving |
| AC6 | Non-Admin access to settings returns 403 Forbidden |
| AC7 | All settings changes create audit log entries |
| AC8 | Nigerian phone numbers auto-formatted to +234... |

---

### 3.3 FR-ORG-003: Team Member Invitation System

**Description:** Allow Admins and Managers to invite new users with the 6-tier role system, including individual and bulk CSV invitations.

**Single Invitation Process:**

```
1. Admin/Manager navigates to Settings > Team > Invite Members
2. Enters email, selects role from 6-tier dropdown, adds optional message
3. System validates: email format, not already a member, org not at user limit
4. System generates invitation token (32 bytes, cryptographically random; stored hashed)
5. System sends invitation email within 30 seconds
6. System shows "Invitation sent to [email]" confirmation
7. System creates invitation record (status: pending)

On acceptance:
8. Invitee clicks link; system validates token (not expired, not revoked)
9a. Existing account: login confirmation → added to org with assigned role
9b. New email: redirected to registration → added to org after verification
10. Role assigned; audit log entry created; inviter notified
```

**Role Selection Options (6-Tier):**

| Role | Can Be Invited By | Who Can Assign |
|------|------------------|----------------|
| Owner | (transferred only — not invited) | Current Owner only (ownership transfer) |
| Admin | Owner | Owner |
| Manager | Owner, Admin | Owner, Admin |
| Creator | Owner, Admin, Manager | Owner, Admin, Manager |
| Analyst | Owner, Admin, Manager | Owner, Admin, Manager |
| Viewer | Owner, Admin, Manager | Owner, Admin, Manager |

**Bulk Invitation (CSV Upload):**
- Columns: `email` (required), `role` (required), `personal_message` (optional)
- Maximum: 50 invitations per upload
- All rows validated before any invitation is sent
- Per-row error summary displayed with line numbers
- Valid rows processed even if some rows fail

**Invitation Plan Limits:**

| Plan | Max Users | Behavior at Limit |
|------|-----------|-------------------|
| Starter | 3 | Invitation blocked; upgrade CTA displayed |
| Growth | 10 | Invitation blocked; upgrade CTA displayed |
| Professional | 25 | Invitation blocked; upgrade CTA displayed |
| Enterprise | Unlimited | No limit |
| Agency | 50 (per workspace) | Invitation blocked; upgrade CTA displayed |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Invitation email delivered within 30 seconds |
| AC2 | Valid link → user added with correct role within 30 seconds of acceptance |
| AC3 | Invitations expire after 7 days with clear expiration message |
| AC4 | Revoked invitations → "This invitation is no longer valid" |
| AC5 | Cannot invite existing member → specific error |
| AC6 | Cannot invite when at user limit → error with upgrade CTA |
| AC7 | Manager cannot invite Admin or Owner → specific error |
| AC8 | Bulk CSV validates all rows; shows per-row error with line numbers |
| AC9 | All invitation events logged in audit log |
| AC10 | Inviter receives notification when invitation is accepted |

---

### 3.4 FR-ORG-004: Team Member Management

**Description:** Allow Admins and Managers (with appropriate scope) to view, manage, and audit all team members within the organization.

**Team Member Table:**

| Column | Description | Sortable | Filterable |
|--------|-------------|---------|-----------|
| Name | Full name + avatar | Yes | No |
| Email | Email address | Yes | No |
| Role | 6-tier role badge | Yes | Yes |
| Status | Active / Suspended / Pending | Yes | Yes |
| Last Active | Relative time in WAT ("2 hours ago") | Yes | No |
| Joined | WAT date of joining | Yes | No |
| Actions | Context menu (role, suspend, reactivate, remove) | No | No |

**Table Features:**
- Search by name or email (real-time, <1 second)
- Filter by role (multi-select) and status
- Pagination: 25 per page (configurable: 10, 25, 50, 100)
- Bulk select checkboxes for bulk suspend/reactivate
- Export to CSV (all fields including WAT timestamps)

**Individual User Actions:**

| Action | Who Can Perform | Restrictions | Effect |
|--------|----------------|-------------|--------|
| Edit Role | Admin | Cannot demote sole Owner/Admin; cannot assign Owner | Role changes immediately |
| Suspend | Admin, Manager* | Cannot suspend Owner/Admin | Login prevented; data preserved; reversible |
| Reactivate | Admin | — | Login restored immediately |
| Remove | Admin | Cannot remove sole Owner/Admin | Immediate access removal; irreversible |

*Manager can suspend/manage users with roles below Manager only

**System Safeguards:**
- Sole Owner/Admin protection: system blocks demotion, suspension, or removal
- Destructive actions (Remove): confirmation modal requires typing user's email address
- Role changes: confirmation modal with "Changing [Name]'s role from [X] to [Y]. This takes effect immediately."
- All actions: email notification sent to affected user

**Bulk Operations:**
- Bulk suspend: max 50 users per operation; progress indicator
- Bulk reactivate: max 50 users per operation; progress indicator
- Bulk operations not available for Remove (security — individual confirmation required)

**Last Active Tracking:**
- Updated every 5 minutes from API activity logs
- Displayed in WAT timezone for Nigerian organizations
- Used for inactive user identification (>30 days → flagged in UI)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Table displays all members with WAT-formatted timestamps |
| AC2 | Role change reflected across all modules immediately |
| AC3 | Suspended user → "Your account has been suspended. Contact your administrator." on login |
| AC4 | Removed user → immediate access removal; receives notification email |
| AC5 | System blocks any action that would leave organization without Owner or Admin |
| AC6 | Manager cannot view or modify Admin or Owner accounts |
| AC7 | Search returns results within 1 second |
| AC8 | CSV export includes all fields with WAT timestamps |
| AC9 | All team management actions create audit log entries |

---

### 3.5 FR-ORG-005: Multi-Tenant Data Isolation

**Description:** Enforce strict, independently-verified data separation between organizations at three levels.

**Three-Layer Isolation Architecture:**

| Layer | Mechanism | What it Catches |
|-------|-----------|----------------|
| **Database (Layer 1)** | PostgreSQL Row-Level Security (RLS) policies | Any query that bypasses application-level filtering |
| **Application (Layer 2)** | Hono middleware validates user ∈ organization; sets RLS context | Forged or missing organization context in requests |
| **Service (Layer 3)** | `organizationId` as required typed parameter on every service method | Accidentally unscoped database queries |

**RLS Policy (applied to ALL multi-tenant tables):**

```sql
-- Example: media_mentions table (same pattern for all multi-tenant tables)
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_mentions FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON media_mentions
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
```

**Application Layer (Hono Middleware):**

```typescript
// server/middleware/tenant.ts
app.use('/api/*', async (c, next) => {
  const userId = c.get('user').id;
  const organizationId = c.get('user').organizationId;

  // Validate user is actually a member of the requested organization
  const isMember = await organizationService.validateMembership(userId, organizationId);
  if (!isMember) {
    return c.json({ error: 'RESOURCE_ACCESS_DENIED' }, 403);
  }

  // Set RLS context for this database session
  await db.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`);
  await next();
});
```

**Module-Specific Isolation Coverage:**

| Module | Data Isolated |
|--------|--------------|
| Media Monitoring | Articles, media contacts, press releases, monitoring campaigns |
| Social Listening | Queries, mentions, mention tags, listening alerts |
| Social Publishing | Posts, schedules, templates, asset library |
| Engagement Inbox | Conversations, messages, response templates, routing rules |
| Analytics | Dashboards, reports, custom metrics, exports |
| Campaigns | Campaign entries, winners, campaign data |
| Billing | Subscriptions (₦), invoices (₦), payment methods |

**Security Logging for Access Violations:**

```json
{
  "level": "warn",
  "event": "cross_org_access_attempt",
  "userId": "usr_9f2a4b6c",
  "requestedOrg": "org_7e3b2c1d",
  "userOrg": "org_1a2b3c4d",
  "endpoint": "/api/v1/monitoring/articles",
  "ipAddress": "197.210.55.23",
  "requestId": "req_abc123",
  "timestamp": "2026-07-21T10:30:00.000Z"
}
```

**Automated Isolation Tests (run on every PR):**

```typescript
// tests/security/tenant-isolation.test.ts
describe('Multi-tenant isolation — every multi-tenant table', () => {
  it('User from Org A cannot read Org B mentions via API', async () => { /* ... */ });
  it('User from Org A cannot read Org B articles via API', async () => { /* ... */ });
  it('Admin from Org A cannot access Org B billing (₦) data', async () => { /* ... */ });
  it('Manipulating organization_id in JWT returns 403', async () => { /* ... */ });
  it('RLS blocks access even if application filtering fails', async () => { /* ... */ });
});
```

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Zero data leakage between organizations under any circumstance |
| AC2 | Automated isolation tests cover all multi-tenant tables and run in CI |
| AC3 | Cross-organization API requests return 403 Forbidden (logged) |
| AC4 | RLS blocks database access even when application-level filtering fails |
| AC5 | All access violation attempts logged with requestId, userId, target org, IP |
| AC6 | Organization context required for all authenticated API requests |
| AC7 | Agency users switching organizations see only that organization's data |

---

### 3.6 FR-ORG-006: RBAC Enforcement Across All Modules

**Description:** Define and enforce permissions for all 6 roles across every platform module and feature.

**Complete RBAC Matrix:**

| Permission Area | Owner | Admin | Manager | Creator | Analyst | Viewer |
|----------------|-------|-------|---------|---------|---------|--------|
| **Organization Settings** |
| View settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage billing (₦) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| White-label settings (Agency) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Team Management** |
| View team list | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite users | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| Assign roles | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| Suspend/activate users | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| Remove users | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export team CSV | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Social Account Management** |
| View connected accounts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connect new accounts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Disconnect accounts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Refresh/re-authenticate | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Media Monitoring** |
| View monitoring feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/manage monitoring campaigns | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage media contacts (journalist CRM) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/distribute press releases | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export monitoring data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Social Listening** |
| View mentions and sentiment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/manage listening queries | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create listening alerts | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Export mention data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Social Publishing** |
| View content calendar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create and draft posts | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit posts for approval | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve and publish posts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage asset library | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Engagement Inbox** |
| View all conversations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View assigned conversations | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Respond to messages (assigned) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign conversations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View engagement analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Analytics & Reporting** |
| View all dashboards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create custom reports | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Schedule and export reports | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Share reports externally | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Crisis Management** |
| View crisis incidents | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Manage crisis response | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish crisis responses | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

*Manager scope: roles below Manager only (Creator, Analyst, Viewer)

**RBAC Enforcement Layers (Defense in Depth):**

| Layer | Mechanism |
|-------|-----------|
| **UI layer** | Navigation items and action buttons hidden/disabled for unauthorized roles |
| **API layer** | Hono `requirePermission()` middleware on every route |
| **Service layer** | CASL `ability.can()` check before every state-changing operation |
| **Database layer** | RLS ensures data scoped to organization (additional safety net) |

**Permission Denial Behavior:**
- UI: element hidden or shows tooltip "Contact your Admin to enable this"
- API: `403 Forbidden` with error code `AUTHZ_INSUFFICIENT_PERMISSION`
- All denial events logged in audit log

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | UI elements hidden/disabled correctly for each of the 6 roles |
| AC2 | API endpoints return 403 with correct error code for unauthorized access |
| AC3 | Role changes take effect immediately across all modules (no re-login) |
| AC4 | All RBAC denials logged in audit log |
| AC5 | Manager cannot view or modify Admin or Owner accounts |
| AC6 | Creator can create and draft content but cannot approve or publish without review |

---

### 3.7 FR-ORG-007: Social Account Connection Management

**Description:** Control which users can connect, manage, and disconnect social media accounts, which are owned by the organization rather than individual users.

**Connection Permissions:**

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| Connect new account | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Disconnect account | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Re-authenticate (refresh) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pause/resume | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign primary manager | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Account Metadata Displayed:**

| Field | Description |
|-------|-------------|
| Platform icon | Twitter/X, Instagram, Facebook, LinkedIn, TikTok, YouTube |
| Username / Handle | Platform account identifier |
| Profile image | Platform profile picture |
| Follower/subscriber count | As of last sync |
| Status | Active / Error / Needs Re-auth / Paused / Disconnected |
| Connected by | User who initiated OAuth (persists after their departure) |
| Connected at | WAT timestamp |
| Last sync | WAT relative time ("2 hours ago") |
| Primary Manager | Assigned user responsible for account health |

**Disconnect Impact Analysis (Mandatory Before Disconnect):**

Before disconnecting, system shows:

```
Disconnecting @firstbanknigeria (Twitter/X)

This will affect:
• 3 active monitoring campaigns
• 12 scheduled posts (will be cancelled)
• 847 unresolved engagement conversations
• 2 active listening queries

Historical data will remain viewable for 90 days.

Type "firstbanknigeria" to confirm disconnection.
[________________] [Cancel] [Disconnect Account]
```

**User Departure Handling:**
- Account remains fully functional after connected-by user departs
- UI shows "Connected by [Former User Name] on [Date]"
- Admin can reassign "Primary Manager" without reconnection
- No operational disruption

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Manager cannot see or access disconnect button |
| AC2 | Disconnecting requires impact analysis review + username confirmation |
| AC3 | Disconnected account data remains read-only for 90 days |
| AC4 | Departed user's accounts remain functional; "Connected by [Name]" shown |
| AC5 | All social account actions logged in audit log |
| AC6 | Account status (Error, Needs Re-auth) displayed with action required |
| AC7 | Primary Manager can be reassigned by Admin without disconnecting |

---

### 3.8 FR-ORG-008: Post-Registration Onboarding

**Description:** Guide new Nigerian and African organizations through initial platform setup to improve adoption and time-to-value, with context-appropriate defaults.

**Onboarding Wizard (3 Steps + Checklist):**

**Step 1: Organization Setup (2 minutes)**

```
Welcome to Nawebeus, [Name]!
Let's set up [Organization Name]

[✎ Edit organization name field — pre-filled]
[Industry dropdown — focused on Nigerian sectors]
[Timezone — pre-selected: Africa/Lagos (WAT)]
[Currency — pre-selected: NGN (₦)]
[Upload Logo — optional]

[Skip for now]  [Continue →]
```

**Step 2: Connect Your First Social Account (2 minutes)**

```
Connect a social account to start monitoring your brand

[🐦 Twitter/X]  [📸 Instagram]  [📘 Facebook]
[💼 LinkedIn]   [🎵 TikTok]     [▶️ YouTube]

Connect at least 1 account to continue monitoring your brand.

[← Back]  [Skip — I'll do this later]  [Continue →]
```

Step 2 is enforced: user must connect at least 1 account OR explicitly skip (with "You can connect accounts anytime in Settings").

**Step 3: Set Up Monitoring Keywords (2 minutes)**

```
What should we monitor?

Your brand name:    [First Bank of Nigeria]  ← pre-filled
Additional keywords: [e.g., #FirstBank, @firstbanknigeria]
Competitors (optional): [e.g., GTBank, Zenith Bank]

Nigerian news sources are pre-selected for you.
[View pre-selected sources]

[← Back]  [Skip for now]  [Start Monitoring →]
```

**Getting Started Checklist (Dashboard Sidebar Widget):**

| # | Task | Auto-Marks Complete When |
|---|------|--------------------------|
| 1 | ✅ Connect a social account | OAuth connection successful |
| 2 | ✅ Set up your first monitoring keyword | Keyword saved |
| 3 | ✅ Invite a team member | Invitation sent |
| 4 | ✅ Set up your profile | Profile fields completed |
| 5 | ✅ Customize organization settings | Settings updated |

**Checklist Widget Features:**
- Collapsible sidebar widget with progress bar (X/5 completed)
- Items auto-marked complete when action taken (real-time)
- "Dismiss" option (restores via Help menu)
- Celebratory animation (confetti) on 5/5 completion
- Persists across sessions and devices

**Contextual Tooltips (First Visit per Module):**

| Module | Tooltip Target | Message |
|--------|---------------|---------|
| Media Monitoring | "Coverage Feed" button | "Your brand mentions from Nigerian and international media appear here." |
| Crisis Management | Severity indicator | "Severity 1–5 rates how serious this brand mention is." |
| Publishing | "Create Post" button | "Schedule posts to multiple platforms from one place." |
| Engagement | Inbox priority filter | "We sort by influence score and urgency so you respond to what matters first." |
| Analytics | "PR Value" metric | "Estimated equivalent advertising value in ₦ for earned media coverage." |

**Nigerian-Specific Onboarding Optimizations:**
- WAT timezone pre-selected with explanation: "West Africa Time (WAT) — Lagos, Abuja, Kano"
- NGN (₦) pre-selected with label: "Nigerian Naira"
- Nigerian industry dropdown order: Banking, Fintech, Telecom, FMCG, PR Agency, Government, Media, Technology, Other
- Nigerian news sources pre-checked in Step 3

**Onboarding Success Metrics:**
- 80% of new users connect ≥ 1 social account in first session
- 70% of new users complete all 5 checklist items within 7 days
- Average time to first monitoring result: < 15 minutes
- 7-day activation rate: > 70%

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | New user sees wizard immediately after first login |
| AC2 | WAT timezone and NGN (₦) pre-selected for Nigerian organizations |
| AC3 | Nigerian news sources pre-populated in Step 3 |
| AC4 | Checklist auto-updates in real-time as actions are completed |
| AC5 | Users can skip wizard; "Continue Setup" banner persists on dashboard |
| AC6 | Contextual tooltips appear only on first visit per module; dismissible permanently |
| AC7 | Onboarding wizard is mobile-responsive |
| AC8 | Celebration animation on checklist completion |

---

### 3.9 FR-ORG-009: Notification Configuration

**Description:** Allow granular per-module, per-channel notification preferences at both organization and individual user levels.

**Organization-Level Defaults (Admin-Configured):**

| Notification Type | Default | Can Admin Disable? |
|------------------|---------|-------------------|
| Billing alerts (₦ payment failures) | Enabled for all Admins | No — always delivered |
| Paystack subscription changes | Enabled for all Admins | No — always delivered |
| Security alerts | Enabled for Admins/Owners | No — always delivered |
| System maintenance | Enabled for all users | Yes |
| Crisis alerts (S3+) | Enabled for Admins/Managers | Partially (threshold configurable) |

**User-Level Preferences (Per User, Per Module):**

| Module | Events | Channels | Frequency Options |
|--------|--------|---------|------------------|
| Media Monitoring | New negative coverage, SOV change, crisis signal | Email, In-App, Push | Real-time, Daily digest |
| Social Listening | Mention spike, sentiment drop, influencer mention | Email, In-App, Push | Real-time, Hourly, Daily digest |
| Social Publishing | Post published, post failed, approval needed | Email, In-App | Real-time |
| Engagement Inbox | New assigned conversation, SLA breach approaching | Email, In-App, Push | Real-time |
| Analytics | Report generated, export complete, daily digest | Email, In-App | Scheduled |
| Crisis Management | S3+ crisis alert | Email, In-App, Push, SMS* | Immediate only (no delay) |
| Billing (₦) | Invoice generated, payment failed, plan change | Email | Real-time |

*SMS crisis alerts: premium feature, Year 2

**Notification Channels:**
- **Email:** Transactional via Nodemailer/SES; includes ₦ amounts where relevant
- **In-App:** Bell icon notification center; unread count badge
- **Push:** Expo Notifications for mobile app (FCM/APNs)
- **SMS:** Crisis alerts only (Year 2 feature)

**Quiet Hours:**
- User-configurable "Do Not Disturb" hours (default: none)
- Hours applied in user's configured timezone (WAT for Nigerian users)
- Critical alerts (crisis S4/S5, billing failures) bypass quiet hours
- Batched notifications delivered at quiet hours end

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Notification preferences saved within 1 second |
| AC2 | ₦ billing alerts always sent to Admins regardless of preferences |
| AC3 | Crisis S4/S5 alerts bypass quiet hours |
| AC4 | In-app notification center shows unread count badge |
| AC5 | Email notifications include ₦ amounts where relevant |
| AC6 | Quiet hours applied in user's WAT timezone |

---

### 3.10 FR-ORG-010: Subscription Plans & ₦ Billing

**Description:** Define and enforce tiered subscription plans with ₦ (NGN) pricing via Paystack, with usage tracking and enforcement.

**Subscription Plans (₦ Pricing):**

| Feature | Starter | Growth | Professional | Enterprise | Agency |
|---------|---------|--------|-------------|------------|--------|
| **Price (₦/month)** | ₦50,000 | ₦150,000 | ₦350,000 | Custom | ₦500,000 |
| **Annual Price (₦/month)** | ₦40,000 | ₦120,000 | ₦280,000 | Custom | ₦400,000 |
| **Annual Savings** | 20% | 20% | 20% | Negotiated | 20% |
| **Users** | 3 | 10 | 25 | Unlimited | 50/workspace |
| **Social Accounts** | 5 | 10 | 15 | 50 | 50 |
| **Monthly Media Mentions** | 10,000 | 50,000 | 150,000 | Unlimited | 500,000 |
| **Monitoring Keywords** | 10 | 50 | 100 | Unlimited | 200 |
| **Monthly Conversations** | 500 | 5,000 | 20,000 | Unlimited | 50,000 |
| **Custom Reports** | 5 | 25 | 50 | Unlimited | Unlimited |
| **Scheduled Reports** | 2 | 10 | 25 | Unlimited | Unlimited |
| **Data Retention** | 7 days | 90 days | 1 year | 3 years | 2 years |
| **File Storage** | 1 GB | 10 GB | 50 GB | 200 GB | 100 GB |
| **API Calls/Day** | 1,000 | 10,000 | 50,000 | Unlimited | 100,000 |
| **White-Label Reports** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Support Level** | Email (48h) | Email (24h) + Chat | Priority Email + Chat | Phone + Priority | Dedicated CSM |
| **Nigerian News Sources** | 10 | 50 | All | All | All |

**Trial Period:**
- 14-day Professional plan trial for all new organizations
- No credit card required (Paystack payment method added later)
- 7-day and 1-day reminders sent in WAT timezone
- At expiration without payment: automatic downgrade to Starter

**Limit Enforcement:**

| Usage Level | Behavior |
|-------------|---------|
| 0–79% | Normal operation; usage progress bars shown |
| 80–99% | Warning banner in relevant modules; email alert to all Admins |
| 100% | New resource creation blocked; upgrade modal shown with ₦ pricing |

**Upgrade Behavior:**
- Immediate effect — new limits apply within 60 seconds
- Paystack pro-rated ₦ charge for remaining billing period
- No service interruption

**Downgrade Behavior:**
- Takes effect at next billing cycle
- Impact analysis shown: "Downgrading will make X features read-only"
- Excess resources become read-only (not deleted)
- Cannot proceed without acknowledging impact

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | All ₦ prices displayed with ₦ symbol (₦50,000 — not $50,000) |
| AC2 | Trial expires → Starter plan within 1 hour (not immediately during business hours) |
| AC3 | 80% limit → warning banner within 5 minutes |
| AC4 | 100% limit → creation blocked with ₦ pricing upgrade modal |
| AC5 | Upgrade via Paystack → new limits within 60 seconds |
| AC6 | All ₦ invoices downloadable as PDF with correct Nigerian organization details |

---

### 3.11 FR-ORG-011: Paystack Payment Processing

**Description:** Manage ₦-denominated subscription payments via Paystack, Nigeria's leading payment processor.

**Why Paystack (Not Stripe):**
- Nigerian-first payment processor with local bank integration
- ₦-native transactions with no currency conversion
- Nigerian Naira (₦) subscription billing
- Verve card support (Nigerian-specific card network)
- USSD payment support for Nigerian users
- Stronger trust among Nigerian business buyers

**Paystack Integration Points:**

| Integration | Purpose |
|-------------|---------|
| Paystack Popup JS | Subscription checkout on billing page |
| Paystack Subscriptions API | Create, pause, resume, cancel subscriptions |
| Paystack Webhooks | `charge.success`, `subscription.create`, `subscription.disable`, `invoice.payment_failed` |
| Paystack Plans API | Define subscription plan tiers |
| Paystack Customer API | Manage customer records per organization |

**Accepted Payment Methods:**
- Visa, Mastercard (international cards)
- Verve (Nigerian-specific card network)
- Nigerian bank direct debit
- USSD (for users on low-data connections)

**₦ Billing Cycle:**
- Monthly: recurring on the anniversary of the upgrade date
- Annual: billed upfront; significant discount (see plan table)
- ₦ amounts displayed with ₦ symbol (₦150,000 not N150,000)
- All invoices PDF-downloadable with WAT issue date

**Payment Failure Handling:**

| Attempt | Timing | Action |
|---------|--------|--------|
| First attempt | Billing date | Fails → email alert to all Admins |
| Retry 1 | +3 days | Second attempt |
| Retry 2 | +5 days | Third attempt; escalation email |
| Retry 3 | +7 days | Fourth attempt; grace period end |
| Downgrade | Day 7 | Account downgraded to Starter if still unpaid |

**Grace Period:**
- All plan features remain active for 7 days after first payment failure
- "Payment Failed" banner shown to all users
- Urgent email alerts to all Admins at day 1, 3, 5, 7

**₦ Invoice Contents:**
- Sequential invoice number (NWB-2026-XXXX)
- Organization legal name and address
- Nigerian TIN (if provided)
- Subscription period (WAT dates)
- Amount in ₦ (e.g., ₦150,000.00)
- Tax/VAT breakdown (if applicable)
- Paystack payment reference
- Nawebeus company details

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Paystack Popup handles card entry (Nawebeus never touches raw card data) |
| AC2 | Successful ₦ payment → plan upgraded within 60 seconds |
| AC3 | Failed payment → retry schedule; Admins notified at each retry |
| AC4 | After 3 failed retries → Starter downgrade; clear communication |
| AC5 | ₦ PDF invoices include WAT dates, Nigerian org details, Paystack reference |
| AC6 | USSD payment option available for Nigerian users |
| AC7 | Verve card (Nigerian card network) accepted |

---

### 3.12 FR-ORG-012: Plan Downgrade Management

**Description:** Handle graceful transitions from higher to lower subscription plans with impact analysis and data preservation.

**Downgrade Process:**

```
1. Admin initiates downgrade from billing dashboard
2. System generates impact analysis:
   "Downgrading from Professional to Growth will:
   • Put 5 social accounts over limit (Growth allows 10; you have 15) — 5 will be paused
   • Archive 5 monitoring campaigns (Growth allows 50; you have 55)
   • Make historical data older than 90 days read-only (you currently have 8 months)
   • Disable white-label reports (not available on Growth)"
3. Admin must click "I understand these changes"
4. Admin must complete required cleanup actions (e.g., disconnect excess social accounts)
5. Downgrade scheduled for end of current billing cycle
6. Confirmation email sent with WAT effective date
7. Reminder email 24 hours before downgrade takes effect
```

**Data Preservation Policy:**

| Resource Type | On Downgrade Behavior |
|--------------|----------------------|
| Social accounts (over limit) | Excess accounts automatically paused (not deleted) |
| Monitoring campaigns (over limit) | Excess archived (read-only; data preserved) |
| Team members (over limit) | Cannot downgrade until excess users removed |
| Historical data (beyond new retention) | Data becomes read-only; not deleted immediately |
| Custom reports (over limit) | Excess reports archived (read-only) |
| Storage files (over limit) | Access preserved; no new uploads until under limit |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Impact analysis accurately identifies all exceeding resources |
| AC2 | Cannot proceed until impact acknowledged and required cleanup done |
| AC3 | Downgrade executes at billing cycle end (not immediately) |
| AC4 | Read-only resources remain accessible (not deleted) |
| AC5 | Clear "Upgrade Required" badge on read-only features |
| AC6 | 24-hour reminder sent before downgrade takes effect |

---

## 4. Business Rules

### 4.1 Organization Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-ORG-001 | First user to register becomes Owner of new organization | Clear ownership from day one |
| BR-ORG-002 | Organization name must be unique across the system | Prevent confusion |
| BR-ORG-003 | Organization slug: lowercase, alphanumeric, hyphens only; unique | URL compatibility |
| BR-ORG-004 | Every organization must have at least one Owner or Admin at all times | Prevent orphaned organizations |
| BR-ORG-005 | Sole Owner/Admin cannot be demoted, suspended, or removed | Prevent lockout |
| BR-ORG-006 | Timezone affects all timestamps for all members in WAT for Nigerian orgs | Consistency |
| BR-ORG-007 | New Nigerian organizations default to NGN (₦) and Africa/Lagos (WAT) | Nigerian market fit |
| BR-ORG-008 | 14-day Professional trial; no credit card required; Paystack on upgrade | Reduce friction |

### 4.2 Team Management Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-ORG-010 | Owner, Admin, and Manager can invite users; each with defined role scope | Security |
| BR-ORG-011 | Manager can only assign roles below Manager (Creator, Analyst, Viewer) | Prevent privilege escalation |
| BR-ORG-012 | Owner must transfer ownership before deleting their account | Prevent orphaned organizations |
| BR-ORG-013 | Invitations expire after 7 days | Security |
| BR-ORG-014 | Removed users immediately lose all organization access | Security |
| BR-ORG-015 | All user management actions logged in audit log | Compliance and accountability |
| BR-ORG-016 | Departed user's social account connections remain functional | Business continuity |

### 4.3 Billing Rules (₦)

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-ORG-020 | All pricing in Nigerian Naira (₦) via Paystack | Nigerian market fit |
| BR-ORG-021 | Plan limits enforced at 100% (hard block on new resource creation) | Prevent overuse |
| BR-ORG-022 | Warnings sent at 80% of any limit | Proactive communication |
| BR-ORG-023 | Upgrades take effect immediately; ₦ charge pro-rated | Customer satisfaction |
| BR-ORG-024 | Downgrades take effect at next billing cycle | Fair billing |
| BR-ORG-025 | ₦ payment failures retry 3 times over 7 days before Starter downgrade | Grace period |
| BR-ORG-026 | All ₦ invoices downloadable as PDF with Nigerian organization details | Compliance |
| BR-ORG-027 | Trial expires → Starter downgrade (not suspension); user retains access | User protection |

### 4.4 Social Account Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-ORG-030 | Owner, Admin, Manager can connect; only Owner/Admin can disconnect | Security |
| BR-ORG-031 | Social accounts are organization-owned; not individual-user-owned | Collaboration |
| BR-ORG-032 | Disconnected account data retained in read-only for 90 days | Recovery option |
| BR-ORG-033 | Disconnecting requires impact analysis + username confirmation | Prevent accidental data loss |
| BR-ORG-034 | User departure does not affect organization's social account functionality | Business continuity |

---

## 5. Validation Rules

### 5.1 Key Zod Schemas

```typescript
// lib/validation/organization.schemas.ts

// Organization name
export const OrgNameSchema = z.string()
  .min(2, "Organization name must be at least 2 characters")
  .max(100, "Organization name cannot exceed 100 characters")
  .regex(/^[a-zA-Z0-9\s\-'&.]+$/, "Organization name contains invalid characters");

// Slug (auto-generated or manual)
export const SlugSchema = z.string()
  .min(2, "Slug must be at least 2 characters")
  .max(50, "Slug cannot exceed 50 characters")
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only");

// Organization logo
export const LogoSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Logo must be less than 5 MB"),
  type: z.enum(["image/jpeg", "image/png", "image/svg+xml"], {
    errorMap: () => ({ message: "Logo must be JPG, PNG, or SVG" }),
  }),
});

// Nigerian business phone
export const NigerianPhoneSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format (e.g., +2348012345678)")
  .optional()
  .or(z.literal(""));

// Nigerian Tax ID (TIN or CAC)
export const NigerianTaxIdSchema = z.string()
  .regex(/^(NG\d{8}|\d{10}|\w{7}\d{6})$/, "Enter a valid Nigerian TIN or CAC registration number")
  .optional();

// Invitation
export const InvitationSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["admin", "manager", "creator", "analyst", "viewer"], {
    errorMap: () => ({ message: "Select a valid role" }),
  }),
  personalMessage: z.string().max(500, "Message cannot exceed 500 characters").optional(),
});

// ₦ Amount (used throughout billing)
export const NairaAmountSchema = z.number()
  .positive("Amount must be positive")
  .multipleOf(0.01, "Amount must have at most 2 decimal places")
  .describe("Amount in Nigerian Naira (₦)");

// Organization settings update
export const UpdateOrgSchema = z.object({
  name: OrgNameSchema.optional(),
  slug: SlugSchema.optional(),
  industry: z.enum(["banking", "fintech", "telecom", "fmcg", "pr_agency", "government", "media", "technology", "other"]).optional(),
  website: z.string().url("Enter a valid website URL starting with https://").optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.enum(["NGN", "USD", "GBP", "EUR"]).default("NGN"),
  billingEmail: z.string().email("Enter a valid billing email address"),
  businessPhone: NigerianPhoneSchema,
  taxId: NigerianTaxIdSchema,
});
```

---

## 6. API Reference

### 6.1 Organization Endpoints

| Endpoint | Method | Auth | Role | Purpose |
|----------|--------|------|------|---------|
| `/api/v1/organizations/:id` | GET | ✅ | Member | Get organization details |
| `/api/v1/organizations/:id` | PATCH | ✅ | Admin | Update organization settings |
| `/api/v1/organizations/:id` | DELETE | ✅ | Owner | Delete organization |
| `/api/v1/organizations/:id/logo` | POST | ✅ | Admin | Upload organization logo |
| `/api/v1/organizations/:id/members` | GET | ✅ | Admin/Manager | List all members |
| `/api/v1/organizations/:id/members/:userId` | PATCH | ✅ | Admin/Manager | Update member role/status |
| `/api/v1/organizations/:id/members/:userId` | DELETE | ✅ | Admin | Remove member |
| `/api/v1/organizations/:id/invitations` | POST | ✅ | Admin/Manager | Send invitation |
| `/api/v1/organizations/:id/invitations` | GET | ✅ | Admin/Manager | List invitations |
| `/api/v1/organizations/:id/invitations/:id` | DELETE | ✅ | Admin/Manager | Revoke invitation |
| `/api/v1/organizations/:id/usage` | GET | ✅ | Member | Get usage metrics |
| `/api/v1/organizations/:id/audit-log` | GET | ✅ | Admin | View audit log |
| `/api/v1/organizations/:id/billing/subscription` | GET | ✅ | Admin | Get subscription details |
| `/api/v1/organizations/:id/billing/subscription` | PATCH | ✅ | Owner | Change subscription plan |
| `/api/v1/organizations/:id/billing/payment-methods` | GET | ✅ | Owner | List payment methods |
| `/api/v1/organizations/:id/billing/payment-methods` | POST | ✅ | Owner | Add payment method (Paystack) |
| `/api/v1/organizations/:id/billing/invoices` | GET | ✅ | Owner | List ₦ invoices |
| `/api/v1/organizations/:id/billing/invoices/:id/pdf` | GET | ✅ | Owner | Download ₦ invoice PDF |

### 6.2 Request/Response Examples

**Get Organization:**

```http
GET /api/v1/organizations/org_7e3b2c1d
Authorization: Bearer <token>
```

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "id": "org_7e3b2c1d4f5a6b8c",
    "name": "First Bank of Nigeria",
    "slug": "first-bank-nigeria",
    "logoUrl": "https://cdn.nawebeus.com/logos/org_7e3b2c1d.png",
    "industry": "banking",
    "website": "https://firstbanknigeria.com",
    "address": {
      "city": "Lagos",
      "state": "Lagos State",
      "country": "NG"
    },
    "timezone": "Africa/Lagos",
    "currency": "NGN",
    "billingEmail": "ade@firstbank.com.ng",
    "taxId": "NG12345678",
    "subscription": {
      "planTier": "professional",
      "status": "active",
      "monthlyPriceNaira": 350000,
      "annualPriceNaira": 3360000,
      "currency": "NGN",
      "trialEndsAt": null,
      "currentPeriodStart": "2026-07-01T00:00:00.000Z",
      "currentPeriodEnd": "2026-07-31T23:59:59.000Z",
      "cancelAtPeriodEnd": false,
      "paystackSubscriptionId": "SUB_xxxxxxxxxxxxxxxx"
    },
    "createdAt": "2026-06-15T09:00:00.000Z",
    "updatedAt": "2026-07-21T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

**Update Organization:**

```http
PATCH /api/v1/organizations/org_7e3b2c1d
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "First Bank of Nigeria PLC",
  "timezone": "Africa/Lagos",
  "currency": "NGN",
  "billingEmail": "ade@firstbank.com.ng",
  "taxId": "NG12345678"
}
```

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "id": "org_7e3b2c1d4f5a6b8c",
    "name": "First Bank of Nigeria PLC",
    "updatedAt": "2026-07-21T10:35:00.000Z"
  }
}
```

**Invite Team Member:**

```http
POST /api/v1/organizations/org_7e3b2c1d/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "chidi@firstbank.com.ng",
  "role": "manager",
  "personalMessage": "Welcome to the team, Chidi! You'll be managing our marketing operations."
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "invitationId": "inv_4b3c2d1e5f6a7b8c",
    "email": "chidi@firstbank.com.ng",
    "role": "manager",
    "status": "pending",
    "expiresAt": "2026-07-28T10:30:00.000Z"
  }
}
```

**Get Usage:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "planTier": "professional",
    "currency": "NGN",
    "limits": {
      "users": { "current": 8, "limit": 25, "percentageUsed": 32, "status": "healthy" },
      "socialAccounts": { "current": 6, "limit": 15, "percentageUsed": 40, "status": "healthy" },
      "mentionsThisMonth": { "current": 87000, "limit": 150000, "percentageUsed": 58, "status": "healthy" },
      "monitoringKeywords": { "current": 72, "limit": 100, "percentageUsed": 72, "status": "healthy" },
      "conversationsThisMonth": { "current": 16800, "limit": 20000, "percentageUsed": 84, "status": "warning" },
      "storage": { "current": 12884901888, "limit": 53687091200, "percentageUsed": 24, "status": "healthy" }
    },
    "billingPeriod": {
      "start": "2026-07-01T00:00:00.000Z",
      "end": "2026-07-31T23:59:59.000Z",
      "daysRemaining": 10
    },
    "nextInvoiceAmountNaira": 350000
  }
}
```

**Get Billing Invoices (₦):**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": [
    {
      "id": "bill_9a1b2c3d4e5f6g7h",
      "invoiceNumber": "NWB-2026-0047",
      "amountNaira": 350000,
      "currency": "NGN",
      "status": "paid",
      "description": "Nawebeus Professional Plan — July 2026",
      "periodStart": "2026-07-01T00:00:00.000Z",
      "periodEnd": "2026-07-31T23:59:59.000Z",
      "paidAt": "2026-07-01T00:05:00.000Z",
      "paystackReference": "PS_20260701_001234",
      "pdfUrl": "https://cdn.nawebeus.com/invoices/NWB-2026-0047.pdf"
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "totalCount": 1
  }
}
```

---

## 7. Database Schema

### 7.1 Organizations Table

```sql
CREATE TABLE organizations (
  id                        VARCHAR(32) PRIMARY KEY,
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(50) UNIQUE NOT NULL,
  logo_url                  TEXT,
  industry                  VARCHAR(50),
  website                   VARCHAR(255),
  address                   JSONB,
  timezone                  VARCHAR(100) DEFAULT 'Africa/Lagos',  -- WAT for Nigerian orgs
  language                  VARCHAR(10) DEFAULT 'en-NG',
  currency                  VARCHAR(3) DEFAULT 'NGN',             -- Nigerian Naira default
  billing_email             VARCHAR(255),
  tax_id                    VARCHAR(50),                          -- Nigerian TIN or CAC number
  business_phone            VARCHAR(20),                          -- E.164; Nigerian +234 common
  plan_tier                 VARCHAR(20) DEFAULT 'starter'
                            CHECK (plan_tier IN ('starter', 'growth', 'professional', 'enterprise', 'agency')),
  subscription_status       VARCHAR(20) DEFAULT 'trial'
                            CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  trial_ends_at             TIMESTAMPTZ,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT FALSE,
  canceled_at               TIMESTAMPTZ,
  paystack_customer_id      VARCHAR(255),                         -- Nigerian payment processor
  paystack_subscription_id  VARCHAR(255),
  white_label_settings      JSONB,                                -- Agency tier only
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_orgs_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_plan ON organizations(plan_tier);
CREATE INDEX idx_orgs_subscription ON organizations(subscription_status);
CREATE INDEX idx_orgs_paystack ON organizations(paystack_customer_id);
CREATE INDEX idx_orgs_trial ON organizations(trial_ends_at) WHERE subscription_status = 'trial';
```

### 7.2 Organization Members Table

```sql
CREATE TABLE organization_members (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL
                    CHECK (role IN ('owner', 'admin', 'manager', 'creator', 'analyst', 'viewer')),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'pending')),
  invited_by        VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  invited_at        TIMESTAMPTZ,
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  suspended_at      TIMESTAMPTZ,
  last_active_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- RLS for organization isolation
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY org_members_isolation ON organization_members
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
CREATE INDEX idx_org_members_status ON organization_members(organization_id, status);
```

### 7.3 Invitations Table

```sql
CREATE TABLE invitations (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             VARCHAR(255) NOT NULL,
  role              VARCHAR(20) NOT NULL
                    CHECK (role IN ('admin', 'manager', 'creator', 'analyst', 'viewer')),
  token_hash        VARCHAR(255) UNIQUE NOT NULL,
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by        VARCHAR(32) NOT NULL REFERENCES users(id),
  personal_message  TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  accepted_at       TIMESTAMPTZ,
  accepted_by       VARCHAR(32) REFERENCES users(id),
  revoked_at        TIMESTAMPTZ,
  revoked_by        VARCHAR(32) REFERENCES users(id),
  resend_count      INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_isolation ON invitations
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_inv_org ON invitations(organization_id);
CREATE INDEX idx_inv_email ON invitations(email);
CREATE INDEX idx_inv_token ON invitations(token_hash);
CREATE INDEX idx_inv_status ON invitations(status, expires_at);
```

### 7.4 Billing Tables (₦)

```sql
-- Payment methods (Paystack authorization codes, not raw card data)
CREATE TABLE payment_methods (
  id                            VARCHAR(32) PRIMARY KEY,
  organization_id               VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paystack_authorization_code   VARCHAR(255) UNIQUE NOT NULL,  -- Paystack stores card; we store auth code
  type                          VARCHAR(20) NOT NULL,           -- card, bank_account
  card_brand                    VARCHAR(20),                    -- visa, mastercard, verve
  card_last4                    VARCHAR(4),
  card_exp_month                INTEGER,
  card_exp_year                 INTEGER,
  bank_name                     VARCHAR(100),                   -- For Nigerian bank accounts
  is_default                    BOOLEAN DEFAULT FALSE,
  is_reusable                   BOOLEAN DEFAULT FALSE,
  billing_details               JSONB,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_isolation ON payment_methods
  USING (organization_id = current_setting('app.current_org_id', true));

-- ₦ Invoices
CREATE TABLE invoices (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paystack_reference    VARCHAR(255) UNIQUE NOT NULL,
  invoice_number        VARCHAR(50) UNIQUE NOT NULL,            -- NWB-2026-XXXX
  amount_naira          NUMERIC(15,2) NOT NULL,                 -- ₦ amount with 2 decimal places
  tax_naira             NUMERIC(15,2) DEFAULT 0,
  total_naira           NUMERIC(15,2) NOT NULL,
  currency              VARCHAR(3) DEFAULT 'NGN',               -- Always NGN for now
  status                VARCHAR(20) NOT NULL
                        CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  description           TEXT,
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,
  due_date              TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  invoice_pdf_url       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_isolation ON invoices
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);

-- Usage tracking
CREATE TABLE usage_tracking (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type     VARCHAR(50) NOT NULL,    -- mentions, conversations, api_calls, storage_bytes, etc.
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  current_value   BIGINT DEFAULT 0,
  limit_value     BIGINT,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, metric_type, period_start)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_tracking_isolation ON usage_tracking
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_usage_org ON usage_tracking(organization_id);
```

### 7.5 Notification Preferences Table

```sql
CREATE TABLE notification_preferences (
  id                VARCHAR(32) PRIMARY KEY,
  user_id           VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  channel           VARCHAR(20) NOT NULL
                    CHECK (channel IN ('email', 'in_app', 'push', 'sms')),
  enabled           BOOLEAN DEFAULT TRUE,
  frequency         VARCHAR(20) DEFAULT 'real_time'
                    CHECK (frequency IN ('real_time', 'hourly', 'daily', 'weekly')),
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type, channel)
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notif_prefs_org ON notification_preferences(organization_id);
```

---

## 8. Email Notifications

### 8.1 Transactional Emails

| Event | Recipient | Subject | SLA | ₦ Specifics |
|-------|-----------|---------|-----|------------|
| Invitation sent | Invitee | "[Name] invited you to [Org] on Nawebeus" | < 30 seconds | — |
| Invitation accepted | Inviter | "[Name] accepted your invitation" | Immediate | — |
| Role changed | Affected user | "Your role in [Org] has been updated" | Immediate | — |
| User suspended | Affected user | "Your access to [Org] has been suspended" | Immediate | — |
| User removed | Affected user | "You have been removed from [Org]" | Immediate | — |
| Plan upgraded (₦) | All Admins | "Your Nawebeus plan has been upgraded to [Plan]" | Immediate | ₦ amount in email |
| Plan downgraded (₦) | All Admins | "Your plan change to [Plan] is scheduled" | Immediate | ₦ new price; effective date in WAT |
| Payment success (₦) | Billing email | "Payment receipt: ₦[Amount] — Nawebeus [Plan]" | < 1 hour | ₦ amount; Paystack reference |
| Payment failed (₦) | All Admins | "Action required: ₦ payment failed" | Immediate | ₦ amount; Paystack retry date |
| Trial expiring (7 days) | All Admins | "Your Nawebeus trial ends in 7 days" | 7 days before | ₦ pricing for upgrade |
| Trial expiring (1 day) | All Admins | "Last day of your Nawebeus trial" | 1 day before | ₦ pricing; upgrade CTA |
| Trial expired | All Admins | "Your trial has ended — downgraded to Starter" | At expiration | ₦ pricing for upgrade |
| Usage warning (80%) | All Admins | "You've used 80% of your [metric] quota" | At threshold | Current plan ₦ price; upgrade ₦ price |
| Limit reached (100%) | All Admins | "Action required: [metric] limit reached" | At threshold | Upgrade ₦ pricing |

### 8.2 In-App Notifications

| Event | Message | Dismissible |
|-------|---------|------------|
| Invitation accepted | "[Name] joined [Org] as [Role]" | Yes |
| Plan upgraded | "Upgraded to [Plan]. New features unlocked!" | Yes |
| Usage warning (80%) | "You've used 80% of your [metric] quota" | Yes |
| Limit reached (100%) | "Limit reached: upgrade to continue" | No (sticky) |
| Payment failed (₦) | "₦ payment failed. Update payment method" | No (sticky) |
| Trial expiring | "Trial ends in [N] days. Upgrade from ₦[X]/month" | Yes |

---

## 9. Error Handling

### 9.1 Error Code Reference

| Code | HTTP | Message | User Action |
|------|------|---------|-------------|
| `ORG_NOT_FOUND` | 404 | Organization not found | Check URL |
| `ORG_NAME_TAKEN` | 409 | Organization name already exists | Choose different name |
| `ORG_SLUG_TAKEN` | 409 | Organization slug is already taken | Choose different slug |
| `ORG_SLUG_INVALID` | 422 | Slug must be lowercase letters, numbers, and hyphens | Fix slug format |
| `ORG_LOGO_TOO_LARGE` | 422 | Logo must be less than 5 MB | Reduce file size |
| `ORG_LOGO_INVALID_TYPE` | 422 | Logo must be JPG, PNG, or SVG | Convert file |
| `AUTHZ_INSUFFICIENT_PERMISSION` | 403 | You don't have permission for this action | Contact Admin |
| `SOLE_OWNER_ADMIN_PROTECTION` | 422 | Cannot remove or demote the only Owner/Admin | Promote another user first |
| `USER_ALREADY_MEMBER` | 409 | This user is already a member | Check team list |
| `INVITATION_EXPIRED` | 400 | This invitation has expired | Request new invitation |
| `INVITATION_REVOKED` | 400 | This invitation is no longer valid | Request new invitation |
| `INVITATION_ALREADY_ACCEPTED` | 409 | This invitation has already been used | Log in to existing account |
| `PLAN_USER_LIMIT_REACHED` | 422 | User limit reached for current plan | Upgrade plan |
| `MANAGER_CANNOT_INVITE_ADMIN` | 403 | Managers cannot invite Admins | Ask an Admin to invite |
| `BULK_INVITE_LIMIT_EXCEEDED` | 422 | Maximum 50 invitations per upload | Split into smaller files |
| `PAYSTACK_PAYMENT_FAILED` | 402 | ₦ payment processing failed | Check payment method |
| `PAYSTACK_CARD_DECLINED` | 402 | Card was declined | Try different card or payment method |
| `PLAN_DOWNGRADE_IMPACT` | 422 | Resolve excess resources before downgrading | Clean up resources |
| `DISCONNECT_IMPACT_NOT_REVIEWED` | 422 | Review impact analysis before disconnecting | Review and confirm |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Retry after cooldown |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred | Try again; contact support |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Operation | Target |
|-----------|--------|
| Organization creation (automatic on registration) | < 2 seconds |
| Organization settings update | < 1 second |
| Team member table load (100 members) | < 2 seconds |
| Invitation email delivery | < 30 seconds |
| Plan upgrade (Paystack → new limits active) | < 60 seconds |
| Usage dashboard load | < 2 seconds |
| Usage counter update after action | < 5 minutes |
| API response time P95 | < 500ms |

### 10.2 Security

| Control | Implementation |
|---------|---------------|
| Multi-tenant isolation | RLS (database) + middleware (application) + typed parameters (service) |
| Payment data | Paystack handles all card data; Nawebeus stores only Paystack authorization code |
| Webhook verification | Paystack HMAC-SHA512 signature verification |
| All admin actions | Logged in append-only audit log |
| RBAC enforcement | CASL at API + service layer; RLS at database |
| ₦ amounts | Stored as NUMERIC(15,2); never approximated to float |

### 10.3 Compliance

| Regulation | Implementation |
|-----------|---------------|
| **NDPR** | Data sovereignty (VPS in Nigeria); DSAR workflow; consent management; 7-year audit retention |
| **GDPR** | Right to access, erasure, portability; DPA with processors |
| **CCPA** | Right to know, delete, opt-out |
| **PCI DSS** | Delegated entirely to Paystack; Nawebeus is PCI SAQ A |

---

## 11. Edge Cases

### 11.1 Organization Edge Cases

| Scenario | Behavior |
|----------|---------|
| Registration with already-taken org name | Error: "Organization name already exists. Choose a different name." |
| Admin changes slug to a taken slug | Error: "Slug is already taken. Choose a different one." |
| Sole Owner tries to delete their account | Error: "Transfer ownership before deleting your account." with transfer link |
| Organization reaches 0 members (all removed/departed) | Org scheduled for deletion after 30 days; owner email notified |
| Agency tier user switches between client org and own org | Context switch atomic; RLS enforces isolation; no data leaks |

### 11.2 Team Management Edge Cases

| Scenario | Behavior |
|----------|---------|
| Manager tries to invite Admin | Error: "Managers can only invite Creators, Analysts, and Viewers" |
| Admin tries to remove sole Admin | Error: "Promote another member to Admin first" |
| User accepts invitation to org they're already in | Error: "You are already a member of this organization" |
| Bulk CSV with 60 rows | Error: "Maximum 50 invitations per upload. Split into smaller files." |
| Invitation accepted by different email than invited | System creates new account for the email used; added with correct role |
| User suspended mid-session | Next API request returns 403; redirected to suspension message |

### 11.3 Billing Edge Cases (₦)

| Scenario | Behavior |
|----------|---------|
| Paystack payment fails during upgrade | Error shown; plan not changed; retry after fixing payment method |
| User tries to downgrade with more users than target limit | Error: "Remove [N] users to fit within [Plan] user limit" |
| Trial expires exactly at midnight | Downgrade to Starter queued; executed within 1 hour (not interrupting active sessions) |
| Annual plan → monthly downgrade | Takes effect at annual period end; ₦ savings calculation shown |
| Paystack fails 3 times; then user upgrades | New subscription starts fresh; old failed payments not retried |
| ₦ amount includes kobo (subunit) | Rounded to 2 decimal places in display (₦150,000.00) |

### 11.4 Social Account Edge Cases

| Scenario | Behavior |
|----------|---------|
| Manager tries to disconnect account | Disconnect button not visible; error if attempted via API |
| Admin disconnects account with 10 active scheduled posts | Impact analysis shows posts; confirmation required to cancel them |
| Connected-by user account deleted | "Connected by [Deleted User]" shown; Admin reassigns Primary Manager |
| Account token expires mid-campaign | Status → "Needs Re-auth"; banner shown to Admin/Manager; data collection paused |
| Same social account connected to two orgs | Blocked: "This account is already connected to another organization" |

---

## 12. Future Enhancements

| ID | Enhancement | Priority | Timeline |
|----|-------------|----------|---------|
| FE-ORG-001 | Department/team hierarchy within organizations | High | Phase 6 — Q2 2027 |
| FE-ORG-002 | Custom roles and granular permission editor | Medium | Phase 6 — Q2 2027 |
| FE-ORG-003 | Hierarchical organizations (parent/child) for enterprise | Medium | Phase 8 — Q4 2027 |
| FE-ORG-004 | Advanced delegation (temporary access grants) | Low | Phase 9 — Q1 2028 |
| FE-ORG-005 | IP allowlisting per organization | Medium | Phase 9 — Q1 2028 |
| FE-ORG-006 | Multi-currency support (beyond NGN) for international expansion | Low | Phase 10 — Year 3 |
| FE-ORG-007 | Consolidated billing for agency managing multiple client orgs | High | Phase 7 — Q3 2027 |
| FE-ORG-008 | SCIM automated user provisioning for enterprise | Medium | Phase 7 — Q3 2027 |
| FE-ORG-009 | Geofencing / time-based access controls | Low | Phase 12 — Year 3 |
| FE-ORG-010 | WhatsApp Business as notification channel | High | Phase 6 — Q1 2027 |

---

## 13. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| Design Lead | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |
| Finance Lead | _________________ | _________ | _______ |
| Legal & Compliance | _________________ | _________ | _______ |

---

## 14. Related Documents

| Document | Relationship |
|----------|-------------|
| **Module 1: Authentication & User Management** | Prerequisite — user accounts and JWT infrastructure |
| **Architecture** | Multi-tenant RLS implementation; service layer patterns |
| **ADRs** | ADR-006 (CASL RBAC), ADR-009 (RLS), ADR-011 (Paystack), ADR-007 (data sovereignty) |
| **Database Schema** | organizations, organization_members, invitations, invoices tables |
| **Security Architecture** | NDPR compliance; audit logging; multi-tenant isolation |
| **Engineering Standards** | Import boundaries; TypeScript strict mode; ₦ currency conventions |
| **QA Strategy** | RBAC negative test requirements; isolation test coverage |
| **API Reference** | Organization endpoint documentation |
| **Personas** | Ade (Admin), Ifeoma (Agency Owner), Chidi (Manager) |
| **User Journeys** | Journey 2 (Onboarding & Setup), Journey 10 (Agency Client Management) |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified and expanded Organization & Account Management module. Merges and improves both source documents. Adds: 6-tier role hierarchy (Owner, Admin, Manager, Creator, Analyst, Viewer) replacing 4-tier, Nigerian market defaults throughout (NGN ₦ currency, Africa/Lagos WAT timezone, Nigerian industry dropdown, Nigerian TIN/CAC field, +234 phone format), Paystack replacing Stripe for all ₦ billing (with Nigerian payment method support: Verve cards, bank direct debit, USSD), Nigerian news source pre-population on signup, complete ₦ pricing table for all 5 plan tiers, ₦ invoice schema with NUMERIC(15,2) storage, Paystack webhook event table, agency white-label settings in organizations table, WhatsApp Business future enhancement, WAT-formatted timestamps throughout email notification table, expanded onboarding with Nigerian-specific Step 3 (media sources), Manager cannot disconnect social accounts (Admin-only), and complete Zod validation schemas including Nigerian-specific validators. |

---

*This document is owned by the Product Lead and reviewed quarterly. All changes to organization management, billing tier definitions, RBAC permissions, or onboarding flows must be reflected in this document before implementation begins.*