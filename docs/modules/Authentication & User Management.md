# Module 1: Authentication & User Management

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Product Lead & Engineering Lead

---

## 1. Module Overview

### 1.1 Purpose

This module provides the foundational security, identity, and user lifecycle management for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It encompasses user registration, authentication, session management, profile management, the core multi-tenant architecture ensuring strict data isolation between organizations, and all compliance requirements under Nigerian and international data protection law.

This module is the **foundation** for every other module in the platform. All features require authenticated users with verified organizational context.

### 1.2 Module Objectives

| Objective | Success Measure |
|-----------|-----------------|
| **Secure user authentication** | Zero security breaches; 99.9% authentication uptime |
| **Multi-tenant data isolation** | Zero cross-tenant data leakage; 100% isolation verified by automated tests |
| **User lifecycle management** | Complete registration-to-deletion workflow with full audit trail |
| **Role-based access control (RBAC)** | 6-tier RBAC enforced across all modules at API, service, and database layers |
| **NDPR / GDPR / CCPA compliance** | 100% compliant; DSAR fulfilled within 30 days |
| **Nigerian market fit** | Default currency NGN (₦); default timezone WAT (Africa/Lagos) |
| **User experience** | <30 seconds to complete registration; <2 seconds to login |

### 1.3 Module Scope

**In Scope:**
- User registration and email verification
- Login and JWT-based session management (access token + refresh token)
- Password management (reset, change, history enforcement)
- User profile management (name, email, phone, avatar, timezone)
- Multi-tenant organization management with RLS isolation
- User invitation system (individual and bulk CSV)
- Account deactivation and deletion (30-day grace period)
- Multi-factor authentication (TOTP — Google Authenticator, Authy, 1Password)
- Session and device management (view, revoke)
- Security and compliance features (audit logging, NDPR DSAR workflow)
- API key management for service-to-service integrations
- ₦ (NGN) and WAT timezone defaults for Nigerian organizations

**Out of Scope (Future Phases):**

| Feature | Phase | Timeline |
|---------|-------|---------|
| Enterprise SSO (SAML, Okta, Azure AD) | Phase 6 | Q2 2027 |
| SCIM automated user provisioning | Phase 7 | Q3 2027 |
| Passwordless authentication (magic links, WebAuthn) | Phase 11 | Year 3 |
| Social login (Google, Microsoft, Apple) | Phase 11 | Year 3 |
| SMS-based MFA | Phase 8 | Year 2 |
| Advanced fraud detection | Phase 12 | Year 3 |
| Department / team hierarchy | Phase 9 | Year 2 |

### 1.4 Target Users

| Persona | Role | Primary Use Cases |
|---------|------|-------------------|
| **Ade** (Head of PR) | Owner / Admin | Organization creation, billing management, full platform access |
| **Chidi** (Head of Marketing) | Admin / Manager | Team member management, role assignment, organization settings |
| **Ifeoma** (Agency Owner) | Owner (Agency tier) | Multi-client workspace management, white-label settings |
| **Bola** (Social Media Manager) | Creator | Account creation, profile management, standard platform access |
| **Tunde** (Digital Analyst) | Analyst | Read-only data access, report viewing, dashboard access |
| **Ngozi** (Crisis Manager) | Manager | Crisis response, team coordination, engagement management |

### 1.5 Dependencies

| Module | Dependency Direction | Purpose |
|--------|---------------------|---------|
| **All other modules** | Depend on this module | All features require authenticated users with organizational context |
| **Module 5: Billing** | Depends on this module | User identity and organization tier for subscription gating |
| **Module 9: Notifications** | Depends on this module | Email and push notification delivery for auth events |

---

## 2. User Stories

### 2.1 Registration & Onboarding

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-001 | As a new user, I want to register with my work email and a strong password so I can create a Nawebeus account | P0 | Registration completes within 2 seconds; email verified within 24 hours |
| US-AUTH-002 | As a new user, I want to receive a verification email so I can activate my account | P0 | Email delivered within 30 seconds; link works for 24 hours |
| US-AUTH-003 | As a new user, I want to set up my organization (name, industry, team size) so my team has a workspace | P0 | Organization created with NGN currency and WAT timezone as defaults |
| US-AUTH-004 | As a new user, I want to complete a guided onboarding wizard so I can get value from the platform quickly | P0 | Onboarding completes in <5 minutes; first monitoring keyword configured |
| US-AUTH-005 | As a new user, I want to connect my first social account so I can start monitoring my brand | P0 | OAuth connection completes within 60 seconds |
| US-AUTH-006 | As an invited user, I want to accept an invitation so I can join an existing organization | P0 | Invitation accepted within 30 seconds; role assigned correctly |

### 2.2 Authentication & Sessions

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-010 | As a registered user, I want to log in with my email and password so I can access my account | P0 | Login completes within 1 second; JWT issued |
| US-AUTH-011 | As a registered user, I want "Remember me" functionality so I can stay logged in across browser sessions | P0 | Session persists for 30 days; refresh token rotates correctly |
| US-AUTH-012 | As a user concerned about security, I want to enable TOTP MFA so my account has a second layer of protection | P1 | QR code displays correctly; all RFC 6238 apps supported |
| US-AUTH-013 | As a security-conscious user, I want to view all my active sessions so I can detect unauthorized access | P1 | Sessions display device, location (city/country), last active time |
| US-AUTH-014 | As a user, I want to log out from all other devices so I can secure my account if I suspect compromise | P1 | All other sessions invalidated within 5 seconds |
| US-AUTH-015 | As a Nigerian user, I want all timestamps displayed in West Africa Time (WAT) so I can track events accurately | P0 | WAT is the default timezone for Nigerian organizations |

### 2.3 Password Management

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-020 | As a user who forgot my password, I want to receive a reset link so I can regain access | P0 | Reset email delivered within 30 seconds; link expires in 1 hour |
| US-AUTH-021 | As a logged-in user, I want to change my password from my profile settings | P0 | Current password required; new password stored as bcrypt hash |
| US-AUTH-022 | As a user creating a password, I want to see real-time feedback on password strength | P0 | Requirements displayed inline; strength indicator updates as user types |
| US-AUTH-023 | As a user, I want confirmation that my password was changed | P0 | Confirmation email sent to current email; all other sessions terminated |

### 2.4 Profile Management

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-030 | As a user, I want to update my name, phone, bio, and job title | P0 | Changes reflected immediately; audit log entry created |
| US-AUTH-031 | As a user, I want to change my email address with re-verification | P0 | Old email active until new email verified; both emails notified |
| US-AUTH-032 | As a user, I want to upload a profile picture for personalization | P0 | JPG/PNG accepted; automatically resized to 256×256px |
| US-AUTH-033 | As a Nigerian user, I want to set my timezone to WAT by default | P0 | Africa/Lagos is the default; all timestamps display in WAT |

### 2.5 Organization Management

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-040 | As an Admin, I want to configure my organization's name, logo, timezone, and currency | P0 | NGN (₦) default currency; WAT default timezone for Nigerian orgs |
| US-AUTH-041 | As an Admin, I want to invite team members via email so they can collaborate | P0 | Invitation delivered within 30 seconds; link valid for 7 days |
| US-AUTH-042 | As an Admin, I want to assign roles (Owner, Admin, Manager, Creator, Analyst, Viewer) to team members | P0 | Permissions take effect within 5 seconds |
| US-AUTH-043 | As an agency user, I want to manage multiple client organizations from a single account | P1 | Organization switcher shows all orgs; context switches instantly |
| US-AUTH-044 | As an Admin, I want to view my organization's plan and usage against limits | P0 | Limits displayed in real time; upgrade prompt when approaching limits |

### 2.6 Account Deletion

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|---------------------|
| US-AUTH-050 | As a user, I want to delete my account with a 30-day grace period | P0 | Soft delete with reactivation link sent; data preserved for 30 days |
| US-AUTH-051 | As a user in the grace period, I want to reactivate my account and recover my data | P0 | Reactivation link valid for 30 days; account fully restored |
| US-AUTH-052 | As a user, I want to understand exactly what happens when I delete my account | P0 | Clear confirmation modal with consequences; NDPR-compliant data handling |

---

## 3. Functional Requirements

### 3.1 FR-AUTH-001: User Registration & Email Verification

**Description:** Enable new users to create an account, verify their email, and automatically establish their initial organization with Nigerian market defaults.

**Registration Form Fields:**

| Field | Required | Validation |
|-------|---------|-----------|
| Full Name | ✅ | 2–100 characters |
| Work Email | ✅ | Valid email format; unique across system |
| Password | ✅ | Meets complexity requirements (see BR-AUTH-020) |
| Confirm Password | ✅ | Must match password |
| Organization Name | ✅ | 2–100 characters; unique |
| Industry | Optional | Dropdown: Banking, Fintech, Telecom, FMCG, PR Agency, etc. |
| Team Size | Optional | Dropdown |
| reCAPTCHA v3 | ✅ | Invisible; score ≥ 0.5 |
| Terms of Service | ✅ | Checkbox |
| Privacy Policy | ✅ | Checkbox |
| Marketing opt-in | Optional | Checkbox |

**Organization Defaults for Nigerian Registrations:**

| Setting | Default Value |
|---------|--------------|
| Currency | NGN (₦) |
| Timezone | Africa/Lagos (WAT, UTC+1) |
| Language | en-NG |
| Date format | DD/MM/YYYY |

**Registration Process:**

```
1. User submits registration form
2. System validates all inputs (Zod schema)
3. System checks email uniqueness
4. System checks organization name uniqueness
5. System verifies reCAPTCHA token (score ≥ 0.5)
6. System creates user account in "pending_verification" state
7. System creates organization with NGN/WAT defaults
8. System assigns user as Owner of the organization
9. System generates verification token (32 bytes, cryptographically random)
10. System sends verification email within 30 seconds
11. System redirects to "Check your email" page
12. User clicks verification link
13. System validates token (not expired, not used, belongs to email)
14. System activates account (status: active; email_verified_at: NOW())
15. System creates JWT access token (15 min) + refresh token (7 days)
16. System logs user in automatically
17. System redirects to onboarding wizard
```

**Email Verification Token:**
- 32 bytes, cryptographically random
- Expires after 24 hours
- Single-use (invalidated immediately on use)
- Resend available (max 3 per hour)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Valid form submission creates account in "pending_verification" state within 2 seconds |
| AC2 | Verification email delivered within 30 seconds of registration |
| AC3 | Valid verification link activates account, creates JWT, and redirects to onboarding |
| AC4 | Duplicate email returns specific error with "log in or reset password" suggestion |
| AC5 | Weak password is rejected with specific inline feedback |
| AC6 | Failed reCAPTCHA shows retry prompt (not account lockout) |
| AC7 | Organization defaults to NGN currency and Africa/Lagos timezone |
| AC8 | Expired tokens show clear error with resend option |
| AC9 | Used tokens cannot be reused (idempotency) |
| AC10 | Registration form passes WCAG 2.1 AA accessibility audit |

---

### 3.2 FR-AUTH-002: User Login & Session Management

**Description:** Authenticate registered users using email and password, issue short-lived JWT access tokens with rotating refresh tokens, and manage concurrent sessions securely.

**Authentication Flow:**

```
1. User submits email + password
2. System validates format (Zod schema)
3. System checks reCAPTCHA (required after 3 failed attempts from same IP)
4. System retrieves user record by email
5. System verifies password against bcrypt hash (Bun.password)
6. If MFA enabled:
   a. System prompts for TOTP code
   b. System validates TOTP code (RFC 6238, ±30 second window)
7. If valid:
   a. System issues access token (JWT, 15 minutes, HS256)
   b. System issues refresh token (7 days, rotating)
   c. System sets httpOnly + Secure + SameSite=Strict cookies (web)
   d. System logs successful login (timestamp, IP, user agent, location)
   e. System resets failed_login_count to 0
   f. System redirects to originally intended URL or dashboard
8. If invalid:
   a. System increments failed_login_count
   b. System logs failed attempt with reason
   c. System returns generic "Invalid email or password" (no email enumeration)
   d. After 5 consecutive failures: lock account for 15 minutes
```

**JWT Configuration:**

| Property | Value | Rationale |
|----------|-------|-----------|
| Access token lifetime | 15 minutes | Short window limits exposure |
| Refresh token lifetime | 7 days | Balance security and UX |
| "Remember me" | 30 days (refresh token) | Extended session for explicit choice |
| Signing algorithm | HS256 | Fast, secure for single-server |
| Web storage | `httpOnly` + `Secure` + `SameSite=Strict` cookie | XSS and CSRF immune |
| Mobile storage | Expo SecureStore | OS-level hardware-backed encryption |
| Token rotation | Rotating refresh tokens | Detects token theft |

**Account Lockout:**

| Trigger | Response | Reset |
|---------|---------|-------|
| 5 consecutive failed login attempts | 15-minute lockout | Successful login or 15-minute timeout |
| 20 failed attempts from same IP in 5 minutes | IP temporarily blocked (30 min) | Automatic after 30 minutes |
| Suspicious login pattern detected | Email alert to user; optional 2FA challenge | User confirms on trusted device |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Valid credentials → dashboard or intended page within 1 second |
| AC2 | Invalid credentials → generic "Invalid email or password" (no disclosure of whether email exists) |
| AC3 | Unverified accounts → "Please verify your email" with resend option |
| AC4 | Locked account → "Too many attempts. Try again at HH:MM WAT" |
| AC5 | Session expires after 15 minutes of inactivity (access token); prompts for refresh or re-login |
| AC6 | Login event logged with timestamp (WAT), IP, user agent, geolocation |
| AC7 | "Remember me" extends refresh token to 30 days |
| AC8 | Access token is never stored in localStorage or sessionStorage |
| AC9 | Concurrent sessions from multiple devices all remain valid |
| AC10 | Login form is accessible (WCAG 2.1 AA) and mobile-responsive |

---

### 3.3 FR-AUTH-003: Password Management

**Description:** Provide secure password reset and change functionality with bcrypt hashing, history enforcement, and session invalidation on change.

**Forgot Password Flow:**

```
1. User clicks "Forgot password?" on login page
2. User enters email address
3. System validates email format
4. System generates reset token (32 bytes, cryptographically random)
5. If email exists in system: system sends password reset email
6. System always shows generic success message (no email enumeration)
7. User clicks reset link
8. System validates token (not expired, not used, matches email)
9. User enters new password + confirm password
10. System validates password (complexity + not in last 5 passwords)
11. System updates password hash (bcrypt, cost 10)
12. System marks token as used
13. System invalidates all other sessions
14. System appends old hash to password_history
15. System sends confirmation email to user
16. System redirects to login with success message
```

**Password Reset Token:**
- 32 bytes, cryptographically random
- Expires after 1 hour
- Single-use
- Invalidated on use; cannot be reused

**Change Password (from Profile):**

```
1. User navigates to Settings > Security > Change Password
2. User enters current password
3. User enters new password + confirm
4. System validates current password (bcrypt compare)
5. System validates new password (complexity + not in last 5 passwords)
6. System updates password hash
7. System invalidates all sessions except current device
8. System appends old hash to password_history
9. System sends confirmation email
10. System shows success notification; user remains logged in on current device
```

**Password Complexity Requirements:**

| Requirement | Rule |
|-------------|------|
| Minimum length | 12 characters |
| Uppercase | At least 1 letter (A–Z) |
| Lowercase | At least 1 letter (a–z) |
| Number | At least 1 digit (0–9) |
| Special character | At least 1 of: `!@#$%^&*()_+-=[]{}|;:,.<>?` |
| Common password | Not in list of 10,000 most common passwords |
| Personal info | Must not contain username or email local part |
| History | Must not match any of the last 5 passwords |
| Maximum length | 128 characters |

**Password Storage (bcrypt):**

| Parameter | Value |
|-----------|-------|
| Algorithm | bcrypt (Bun.password) |
| Cost factor | 10 |
| Salt | Unique per password |
| Output | $2a$ hash string |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Any email (existing or not) → same generic success message |
| AC2 | Valid reset link → new password form; invalid/expired → specific error with resend |
| AC3 | New password matching last 5 passwords → rejection with specific message |
| AC4 | Password reset invalidates all other active sessions |
| AC5 | Confirmation email sent to current email address after change |
| AC6 | Passwords stored as bcrypt hash (never plaintext, never MD5/SHA1) |
| AC7 | Change password from profile requires correct current password |
| AC8 | All password changes logged in audit log with WAT timestamp |

---

### 3.4 FR-AUTH-004: User Profile Management

**Description:** Allow authenticated users to view and update their personal information, including Nigerian-specific defaults (phone format, timezone).

**Profile Fields:**

| Field | Required | Validation | Notes |
|-------|---------|-----------|-------|
| Full Name | ✅ | 2–100 characters | Spaces, hyphens, apostrophes allowed |
| Email | ✅ | Valid email; unique | Change requires re-verification |
| Phone | Optional | E.164 format; Nigerian format `+234XXXXXXXXXX` common | Auto-format `0XX → +234XX` |
| Avatar | Optional | JPG/PNG; max 5 MB | Auto-resized to 256×256px |
| Timezone | ✅ | IANA timezone | Defaults to `Africa/Lagos` (WAT) |
| Bio | Optional | Max 500 characters | |
| Job Title | Optional | Max 100 characters | |
| Department | Optional | Max 100 characters | |

**Email Change Process:**

```
1. User enters new email
2. System validates format and uniqueness
3. System sends verification email to NEW address
4. System shows "Verification email sent to [new email]"
5. Old email remains active until new email is verified
6. User clicks link in new email
7. System activates new email address
8. System sends security notification to OLD email
9. System invalidates all sessions except current device
```

**Avatar Upload:**
- Accepted formats: JPG, PNG
- Maximum size: 5 MB
- Automatically resized to 256×256px (center-cropped)
- Stored in Cloudflare R2; served via Bunny CDN
- Old avatar deleted when new one uploaded

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Profile changes save and reflect immediately within the application |
| AC2 | Email change sends verification to new address; old address active until verified |
| AC3 | Timezone change immediately updates all timestamp displays (WAT default) |
| AC4 | Nigerian phone numbers auto-formatted to E.164 (+234...) |
| AC5 | Avatar uploads supported up to 5 MB; invalid types show specific error |
| AC6 | Avatar resized to 256×256px and available via CDN URL |
| AC7 | All profile changes logged in audit log |
| AC8 | Profile form accessible (WCAG 2.1 AA); mobile-responsive |

---

### 3.5 FR-AUTH-005: Multi-Tenant Architecture & Organization Management

**Description:** Support multiple, completely isolated organizations within a single application instance, with Nigerian market defaults and RLS-enforced data separation.

**Organization Creation (with Nigerian defaults):**

```sql
-- Organization created with Nigerian defaults
INSERT INTO organizations (
  id, name, slug, timezone, currency, language, tier
) VALUES (
  'org_xxxxxxxx',
  'First Bank of Nigeria',
  'first-bank-nigeria',
  'Africa/Lagos',    -- WAT default
  'NGN',             -- Nigerian Naira default
  'en-NG',           -- Nigerian English
  'starter'
);
```

**Data Isolation (Three Independent Layers):**

| Layer | Mechanism | What it Prevents |
|-------|-----------|-----------------|
| **Database (Layer 1)** | PostgreSQL Row-Level Security (RLS) | Data access even if application code has bugs |
| **Application (Layer 2)** | Middleware validates user ∈ organization | Missing or spoofed organization context |
| **Service (Layer 3)** | `organizationId` as required typed parameter | Queries without tenant scope |

**RLS Policy (applied to all multi-tenant tables):**

```sql
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_mentions FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON media_mentions
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
```

**Organization Settings:**

| Setting | Default (Nigerian Org) | Configurable |
|---------|----------------------|-------------|
| Currency | NGN (₦) | Yes |
| Timezone | Africa/Lagos (WAT) | Yes |
| Language | en-NG | Yes |
| Date format | DD/MM/YYYY | Yes |
| Plan tier | starter | Via billing only |
| White-label | false (Agency tier only) | Agency tier only |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Zero cross-organization data leakage under any circumstance |
| AC2 | Automated isolation tests verify every multi-tenant table |
| AC3 | Cross-organization API requests → 403 Forbidden (logged) |
| AC4 | Organization context included in every JWT claim |
| AC5 | RLS blocks database access even if application code has a bug |
| AC6 | Organization switcher works correctly for multi-org users |
| AC7 | New Nigerian organizations default to NGN and WAT |
| AC8 | All unauthorized access attempts logged with requestId |

---

### 3.6 FR-AUTH-006: User Invitation System

**Description:** Allow Admins and Managers to invite team members to their organization by email, including bulk CSV upload.

**Invitation Process:**

```
1. Admin/Manager navigates to Settings > Team > Invite Users
2. Enters email(s), selects role, optionally adds personal message
3. System validates: email format, not already a member, org not at user limit
4. System generates invitation token (32 bytes, cryptographically random)
5. System sends invitation email within 30 seconds
6. System tracks invitation (status: pending)
7. Invitee clicks acceptance link
8. System validates token (not expired, not revoked)
9a. Existing Nawebeus account: confirm login → add to organization
9b. New email: redirect to registration → add to organization after verification
10. System assigns role; logs event in audit log
```

**Bulk Invitation (CSV Upload):**
- Columns: `email`, `role`
- Maximum 50 rows per upload
- All rows validated before any invitation sent
- Summary of successes and failures displayed

**Invitation Limits and Enforcement:**

| Scenario | Response |
|----------|---------|
| Organization at user limit | Error: "Organization has reached user limit. Upgrade your plan to invite more users." |
| Email already a member | Error: "This user is already a member of your organization" |
| Manager invites Admin | Error: "You cannot invite users with the Admin role" |
| Expired token | Error: "This invitation has expired. Ask your admin to send a new invitation." |
| Revoked token | Error: "This invitation is no longer valid." |

**Role Assignment Permissions:**

| Inviter Role | Can Assign |
|-------------|-----------|
| Owner | Owner, Admin, Manager, Creator, Analyst, Viewer |
| Admin | Admin, Manager, Creator, Analyst, Viewer |
| Manager | Creator, Analyst, Viewer |
| Creator, Analyst, Viewer | Cannot invite |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Invitation email delivered within 30 seconds |
| AC2 | Valid invitation link adds user with correct role within 30 seconds |
| AC3 | Invitations expire after 7 days and show clear expiration message |
| AC4 | Revoked invitations show "no longer valid" immediately |
| AC5 | Pending invitations visible in Settings > Team > Invitations |
| AC6 | Invitations not sent when organization is at user limit |
| AC7 | Managers cannot invite users with Admin or Owner roles |
| AC8 | Bulk CSV validates all rows; shows per-row error summary |
| AC9 | All invitation events logged in audit log |

---

### 3.7 FR-AUTH-007: Account Deletion & Deactivation

**Description:** Users can request to delete their account with a 30-day grace period for recovery, compliant with NDPR, GDPR, and CCPA requirements.

**Deletion Process:**

```
1. User navigates to Settings > Account > Delete Account
2. System shows consequences:
   - All personal data permanently deleted after 30 days
   - Active subscriptions canceled (prorated ₦ refund processed)
   - Access to all organizations removed
   - 30-day window to reactivate
3. User re-enters password to confirm
4. User types organization name to confirm
5. System soft-deletes account (status: pending_deletion)
6. System records deletion_requested_at and deletion_scheduled_at (+30 days)
7. System sends confirmation email with reactivation link
8. System cancels active Paystack subscription (prorated ₦ refund)
9. System logs user out immediately

[30-day grace period]

10. If reactivated: see reactivation flow below
11. If not reactivated: permanent deletion job runs
    - All PII permanently deleted from users table
    - Audit log entries anonymized (user_id → null; action preserved)
    - Backup data purged in next rotation cycle
    - NDPR/GDPR deletion confirmed and logged
```

**Reactivation Flow:**

```
1. User clicks reactivation link from confirmation email
2. System validates link (not expired, account in pending_deletion state)
3. User re-authenticates (password required)
4. System restores account (status: active)
5. System cancels scheduled deletion
6. System logs reactivation event
7. System logs user in and redirects to dashboard
```

**Special Deletion Cases:**

| Scenario | Handling |
|----------|---------|
| Sole Owner of organization | Must transfer ownership first; system blocks deletion and shows transfer UI |
| Active Paystack subscription | Subscription canceled; prorated ₦ refund calculated and processed |
| User has unpaid ₦ invoices | Deletion blocked until invoices settled |
| Organization with other members | Members retain access; deleted user removed from all org rosters |

**Data Retention After Deletion:**

| Data Type | Retention | Action |
|-----------|-----------|--------|
| User PII (name, email, phone) | 0 days post-deletion | Hard delete |
| Audit log entries | 7 years (NDPR requirement) | Anonymized (user_id → null) |
| ₦ Invoice records | 7 years (Nigerian tax law) | Anonymized but retained |
| Backup files | Until next backup rotation | Excluded from next cycle |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Deletion confirmation requires password + organization name re-entry |
| AC2 | Confirmation email with reactivation link sent within 30 seconds |
| AC3 | Reactivation restores full account within 30-day window |
| AC4 | After 30 days, all PII permanently deleted; audit log anonymized |
| AC5 | Sole Owner blocked from deletion until ownership transferred |
| AC6 | Active Paystack subscription canceled with prorated ₦ refund |
| AC7 | All deletion events logged in audit log with WAT timestamp |
| AC8 | NDPR DSAR request triggers equivalent data package export |

---

### 3.8 FR-AUTH-008: Multi-Factor Authentication (MFA)

**Description:** Provide TOTP-based MFA as an optional (and enforceable for Admin/Owner roles) second factor.

**MFA Setup Flow:**

```
1. User navigates to Settings > Security > Two-Factor Authentication
2. System generates TOTP secret (20 bytes, Base32-encoded)
3. System displays QR code (otpauth:// URI) + manual entry code
4. User scans with authenticator app
5. User enters 6-digit verification code to confirm setup
6. System validates code (RFC 6238, ±30 second window)
7. System generates 10 single-use backup codes (8 characters each)
8. System displays backup codes (one-time view; user must copy/save)
9. System stores backup codes as bcrypt hashes
10. System enables MFA on user account
11. System logs MFA setup event in audit log
```

**Compatible Authenticator Apps:**
- Google Authenticator
- Authy
- 1Password
- Microsoft Authenticator
- Any RFC 6238-compliant TOTP app

**MFA Login Flow (after password validation):**

```
1. System detects MFA is enabled for user
2. System prompts for 6-digit TOTP code
3. User enters code from authenticator app OR backup code
4. System validates:
   a. TOTP: RFC 6238, current ±1 interval (±30 seconds)
   b. Backup code: bcrypt comparison; mark as used if valid
5. If valid: issue JWT, complete login
6. If invalid (3 consecutive failures): lock account for 15 minutes
7. Optional: "Trust this device for 30 days" → device-specific cookie
```

**Admin MFA Enforcement:**

| Role | MFA Enforcement |
|------|----------------|
| Owner | Enforced — account blocked at login if MFA not set up |
| Admin | Enforced — same as Owner |
| Manager | Optional (org Admin can enforce) |
| Creator, Analyst, Viewer | Optional |

**Grace period for enforcement:** 7 days from first login after enforcement enabled. After grace period, access blocked until MFA configured.

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | QR code displays correctly for all RFC 6238-compliant apps |
| AC2 | Setup requires entering a valid code to confirm app is working |
| AC3 | 10 single-use backup codes generated and displayed only once |
| AC4 | Backup codes are stored hashed; never in plaintext |
| AC5 | Login requires TOTP code after MFA enabled (on untrusted devices) |
| AC6 | "Trust this device" bypasses MFA for 30 days on that device |
| AC7 | Admin and Owner roles must complete MFA before access |
| AC8 | Failed MFA attempts are rate-limited (3 per 15 minutes) |
| AC9 | MFA events (enable, disable, code validation) all logged in audit log |

---

### 3.9 FR-AUTH-009: Session & Device Management

**Description:** Allow users to view all active sessions and revoke individual or all-other sessions.

**Active Sessions View:**

| Field | Description |
|-------|-------------|
| Device type | Desktop / Mobile / Tablet (parsed from user agent) |
| OS | Windows / macOS / iOS / Android / Linux |
| Browser | Chrome / Safari / Firefox / Edge |
| Location | City, Country (IP geolocation) |
| IP address | Client IP (partially masked for privacy) |
| Last active | Relative time (e.g., "2 hours ago") in WAT |
| Current session | Highlighted with "This device" indicator |

**Session Actions:**

| Action | Effect | Timing |
|--------|--------|--------|
| Logout from all other devices | Invalidates all refresh tokens except current | Immediate |
| Logout from specific device | Invalidates that session's refresh token | Immediate |
| View session details | Shows full device and location information | Instant |

**Security Notifications:**

| Event | Notification Method |
|-------|-------------------|
| New device login | Email alert to user's verified email |
| Login from new country | Email alert with "This was me / Not me" options |
| All-other-sessions logout | Email confirmation |
| Session from VPN detected | Informational notification (no block) |

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | Active sessions list shows all sessions with device, location (WAT last active), IP |
| AC2 | "Logout from all other devices" invalidates all non-current refresh tokens within 5 seconds |
| AC3 | Email alert sent for new device login within 60 seconds |
| AC4 | Current session clearly marked as "This device" |
| AC5 | Sessions sorted by last active (most recent first) |

---

### 3.10 FR-AUTH-010: API Key Management

**Description:** Allow Admins to create and manage API keys for service-to-service integrations.

**API Key Lifecycle:**

```
1. Admin navigates to Settings > Integrations > API Keys
2. Admin clicks "Create API Key"
3. Admin enters key name and optional expiry date
4. System generates API key (prefix: nwb_live_ or nwb_test_; 32 random bytes)
5. System displays full key ONCE — user must copy immediately
6. System stores SHA-256 hash of key (not the key itself)
7. Admin can view: key name, prefix (first 8 chars), created date, last used, expiry
8. Admin can revoke key at any time (immediate effect)
```

**API Key Format:**
- Production: `nwb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Test: `nwb_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- First 8 characters visible after creation (`nwb_live_`)

**Acceptance Criteria:**

| AC | Criterion |
|----|-----------|
| AC1 | API key displayed only once at creation; never retrievable again |
| AC2 | Key stored as SHA-256 hash; never in plaintext |
| AC3 | Revoked keys immediately rejected on next API request |
| AC4 | Key creation and revocation logged in audit log |
| AC5 | Expired keys automatically rejected (if expiry set) |

---

## 4. Business Rules

### 4.1 Registration Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-001 | Email must be unique across the entire system | Prevent duplicate accounts |
| BR-AUTH-002 | First user to register for an organization becomes Owner | Clear ownership from day one |
| BR-AUTH-003 | Organization name must be unique across the system | Prevent confusion |
| BR-AUTH-004 | Organization slug: lowercase, alphanumeric, hyphens only | URL compatibility |
| BR-AUTH-005 | Email must be verified before full platform access | Security and compliance |
| BR-AUTH-006 | reCAPTCHA v3 required on all public forms | Prevent automated abuse |
| BR-AUTH-007 | Nigerian organizations default to NGN (₦) and Africa/Lagos (WAT) | Nigerian market fit |

### 4.2 Authentication Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-010 | 5 consecutive failed login attempts → 15-minute account lockout | Prevent brute force |
| BR-AUTH-011 | Access token lifetime: 15 minutes | Short window limits token theft impact |
| BR-AUTH-012 | Refresh token lifetime: 7 days (30 days with "Remember me") | Balance security and UX |
| BR-AUTH-013 | All login attempts logged (success and failure) | Security audit trail |
| BR-AUTH-014 | Session cookies: httpOnly + Secure + SameSite=Strict | Prevent XSS and CSRF |
| BR-AUTH-015 | Refresh tokens rotate on each use | Detect token theft via reuse |
| BR-AUTH-016 | Login timestamps stored in WAT for Nigerian organizations | Nigerian market fit |

### 4.3 Password Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-020 | Minimum 12 characters | NIST SP 800-63B recommendation |
| BR-AUTH-021 | Must include uppercase, lowercase, number, and special character | Complexity |
| BR-AUTH-022 | Must not match last 5 passwords | Prevent cycling |
| BR-AUTH-023 | Hashed with bcrypt (cost factor 10) | Industry standard for password storage |
| BR-AUTH-024 | Password reset token expires after 1 hour | Security |
| BR-AUTH-025 | Password reset and change invalidate all other sessions | Security |
| BR-AUTH-026 | Must not appear in common password list (top 10,000) | Prevents dictionary attacks |

### 4.4 Organization Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-030 | Every organization must have at least one Owner or Admin at all times | Prevent orphaned organizations |
| BR-AUTH-031 | Sole Owner cannot be demoted or removed without ownership transfer | Prevent lockout |
| BR-AUTH-032 | All organization data isolated via RLS + application-layer filtering | Multi-tenancy |
| BR-AUTH-033 | Cross-organization API requests return 403 Forbidden | Security |
| BR-AUTH-034 | Organization context (`org_id`) required for all API requests | Multi-tenancy enforcement |
| BR-AUTH-035 | Default currency for new Nigerian organizations is NGN (₦) | Nigerian market fit |
| BR-AUTH-036 | Default timezone for new Nigerian organizations is Africa/Lagos (WAT) | Nigerian market fit |

### 4.5 Account Deletion Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-040 | Account deletion has 30-day grace period for reactivation | User protection |
| BR-AUTH-041 | Sole Owner must transfer ownership before account deletion | Prevent orphaned organizations |
| BR-AUTH-042 | Permanent deletion purges all PII | NDPR/GDPR compliance |
| BR-AUTH-043 | Audit log entries anonymized (not deleted) on account deletion | Legal compliance — 7-year retention |
| BR-AUTH-044 | ₦ Invoice records retained 7 years (Nigerian tax law) | Legal compliance |
| BR-AUTH-045 | Active Paystack subscriptions canceled with prorated ₦ refund | User protection |

### 4.6 MFA Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-AUTH-050 | Owner and Admin roles must enable MFA (enforced at login) | Enhanced security for privileged roles |
| BR-AUTH-051 | 7-day grace period from enforcement before access blocked | Smooth rollout |
| BR-AUTH-052 | Backup codes are single-use; stored as bcrypt hashes | Security |
| BR-AUTH-053 | "Trust this device" cookie expires after 30 days | Balance security and UX |
| BR-AUTH-054 | 3 failed TOTP attempts → 15-minute account lockout | Prevent brute force |

---

## 5. Validation Rules

### 5.1 Zod Schemas

```typescript
// lib/validation/auth.schemas.ts

// Email validation
export const EmailSchema = z.string()
  .email("Please enter a valid email address")
  .max(255, "Email cannot exceed 255 characters")
  .toLowerCase();

// Password validation (12 chars minimum for Nawebeus — stricter than the original spec)
export const PasswordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password cannot exceed 128 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
  .refine(
    (pwd) => !COMMON_PASSWORDS.has(pwd.toLowerCase()),
    "This password is too common. Please choose a stronger password."
  );

// Organization name validation
export const OrgNameSchema = z.string()
  .min(2, "Organization name must be at least 2 characters")
  .max(100, "Organization name cannot exceed 100 characters");

// Nigerian phone number (auto-formats +234...)
export const PhoneSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format (e.g., +2348012345678)")
  .optional()
  .or(z.literal(""));

// Avatar file validation
export const AvatarSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Avatar must be less than 5 MB"),
  type: z.enum(["image/jpeg", "image/png"], {
    errorMap: () => ({ message: "Avatar must be JPG or PNG" }),
  }),
});

// Registration schema
export const RegisterSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
  organizationName: OrgNameSchema,
  industry: z.string().optional(),
  recaptchaToken: z.string().min(1, "reCAPTCHA verification required"),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service" }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy" }),
  }),
  marketingOptIn: z.boolean().default(false),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] }
);

// Login schema
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
  recaptchaToken: z.string().optional(),
  totpCode: z.string().length(6).optional(), // 6-digit TOTP
});

// Naira amount validation (used throughout billing integration)
export const NairaAmountSchema = z.number()
  .positive("Amount must be positive")
  .multipleOf(0.01, "Amount must have at most 2 decimal places")
  .describe("Amount in Nigerian Naira (₦)");
```

---

## 6. Role-Based Access Control (RBAC)

### 6.1 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **Owner** | 1 (highest) | Full access; owns billing; cannot be demoted without transfer |
| **Admin** | 2 | Full platform access except billing ownership |
| **Manager** | 3 | Operational access; content approval authority; team management (below Manager) |
| **Creator** | 4 | Create and submit content; no approval authority |
| **Analyst** | 5 | Read-only analytics, monitoring, reporting; no content creation |
| **Viewer** | 6 (lowest) | Read-only dashboard and report access |

### 6.2 Permission Matrix

| Action | Owner | Admin | Manager | Creator | Analyst | Viewer |
|--------|-------|-------|---------|---------|---------|--------|
| **Register / Login** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Update own profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Enable MFA** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View own sessions** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Logout from all devices** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delete own account** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Invite users** | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Invite Admin/Owner** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Assign/change roles** | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Suspend/activate users** | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Remove users from org** | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **View audit log** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Configure organization** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage billing (₦)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Transfer ownership** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delete organization** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage API keys** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **White-label settings** | ✅ (Agency) | ✅ (Agency) | ❌ | ❌ | ❌ | ❌ |

*Managers can only manage users with roles below Manager (Creator, Analyst, Viewer)

### 6.3 Self-Protection Rules

| Rule | Description |
|------|-------------|
| Cannot demote self | Owner/Admin cannot change their own role |
| Cannot suspend self | Owner/Admin cannot suspend their own account |
| Last Admin protection | System prevents removal of the last Owner/Admin |
| Ownership transfer required | Owner cannot delete account without transferring ownership first |
| Audit logged | All RBAC changes generate audit log entries |

---

## 7. API Reference

### 7.1 Authentication Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/auth/register` | POST | Public | Create account + organization |
| `/api/v1/auth/verify-email` | POST | Public | Activate account via token |
| `/api/v1/auth/resend-verification` | POST | Public | Resend verification email |
| `/api/v1/auth/login` | POST | Public | Authenticate + issue tokens |
| `/api/v1/auth/logout` | POST | Authenticated | Revoke current session |
| `/api/v1/auth/refresh` | POST | Refresh token | Issue new access token |
| `/api/v1/auth/forgot-password` | POST | Public | Request reset email |
| `/api/v1/auth/reset-password` | POST | Public | Set new password via token |
| `/api/v1/auth/change-password` | POST | Authenticated | Change password (requires current) |
| `/api/v1/auth/me` | GET | Authenticated | Get current user profile |
| `/api/v1/auth/me` | PATCH | Authenticated | Update profile |
| `/api/v1/auth/me/avatar` | POST | Authenticated | Upload avatar |
| `/api/v1/auth/me/sessions` | GET | Authenticated | List active sessions |
| `/api/v1/auth/me/sessions` | DELETE | Authenticated | Logout from all other devices |
| `/api/v1/auth/me/sessions/:id` | DELETE | Authenticated | Logout from specific device |
| `/api/v1/auth/me/mfa/setup` | POST | Authenticated | Initialize MFA setup + get QR |
| `/api/v1/auth/me/mfa/verify` | POST | Authenticated | Complete MFA setup |
| `/api/v1/auth/me/mfa/disable` | DELETE | Authenticated | Disable MFA |
| `/api/v1/auth/me/mfa/backup-codes` | POST | Authenticated | Regenerate backup codes |
| `/api/v1/auth/me/delete-account` | POST | Authenticated | Request soft deletion |
| `/api/v1/auth/me/reactivate` | POST | Public | Reactivate account via token |

### 7.2 Organization Endpoints

| Endpoint | Method | Auth | Required Role |
|----------|--------|------|--------------|
| `/api/v1/organizations/:id` | GET | Authenticated | Member |
| `/api/v1/organizations/:id` | PATCH | Authenticated | Admin |
| `/api/v1/organizations/:id` | DELETE | Authenticated | Owner |
| `/api/v1/organizations/:id/members` | GET | Authenticated | Member |
| `/api/v1/organizations/:id/members/:userId` | PATCH | Authenticated | Admin/Manager* |
| `/api/v1/organizations/:id/members/:userId` | DELETE | Authenticated | Admin/Manager* |
| `/api/v1/organizations/:id/invitations` | POST | Authenticated | Admin/Manager |
| `/api/v1/organizations/:id/invitations` | GET | Authenticated | Admin/Manager |
| `/api/v1/organizations/:id/invitations/:id` | DELETE | Authenticated | Admin/Manager |
| `/api/v1/organizations/:id/usage` | GET | Authenticated | Member |
| `/api/v1/organizations/:id/api-keys` | GET | Authenticated | Admin |
| `/api/v1/organizations/:id/api-keys` | POST | Authenticated | Admin |
| `/api/v1/organizations/:id/api-keys/:id` | DELETE | Authenticated | Admin |
| `/api/v1/organizations/:id/audit-log` | GET | Authenticated | Admin |

### 7.3 Request/Response Examples

**Register:**

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "fullName": "Ade Ogunleye",
  "email": "ade@firstbank.com.ng",
  "password": "SecureP@ss123!",
  "confirmPassword": "SecureP@ss123!",
  "organizationName": "First Bank of Nigeria",
  "industry": "banking",
  "recaptchaToken": "03AGdBq25...",
  "acceptedTerms": true,
  "acceptedPrivacy": true,
  "marketingOptIn": false
}
```

```json
HTTP/1.1 201 Created

{
  "success": true,
  "data": {
    "userId": "usr_9f2a4b6c8d1e3f5g",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "email": "ade@firstbank.com.ng",
    "message": "Account created. Please check your email to verify your account.",
    "organization": {
      "name": "First Bank of Nigeria",
      "timezone": "Africa/Lagos",
      "currency": "NGN"
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

**Login:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "ade@firstbank.com.ng",
  "password": "SecureP@ss123!",
  "rememberMe": true
}
```

```json
HTTP/1.1 200 OK
Set-Cookie: access_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refresh_token=rt_...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000

{
  "success": true,
  "data": {
    "user": {
      "id": "usr_9f2a4b6c8d1e3f5g",
      "email": "ade@firstbank.com.ng",
      "fullName": "Ade Ogunleye",
      "role": "admin",
      "organizationId": "org_7e3b2c1d4f5a6b8c",
      "timezone": "Africa/Lagos",
      "mfaEnabled": false,
      "emailVerified": true
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_def789ghi012"
  }
}
```

**Get Current User:**

```json
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "id": "usr_9f2a4b6c8d1e3f5g",
    "email": "ade@firstbank.com.ng",
    "fullName": "Ade Ogunleye",
    "phone": "+2348012345678",
    "avatarUrl": "https://cdn.nawebeus.com/avatars/usr_9f2a4b6c.jpg",
    "timezone": "Africa/Lagos",
    "role": "admin",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "mfaEnabled": true,
    "emailVerified": true,
    "lastLoginAt": "2026-07-21T09:00:00.000Z",
    "createdAt": "2026-06-15T09:00:00.000Z"
  }
}
```

---

## 8. Database Schema

### 8.1 Users Table

```sql
CREATE TABLE users (
  id                        VARCHAR(32) PRIMARY KEY,
  email                     VARCHAR(255) UNIQUE NOT NULL,
  email_verified            BOOLEAN DEFAULT FALSE,
  email_verified_at         TIMESTAMPTZ,
  password_hash             VARCHAR(255) NOT NULL,          -- bcrypt (cost 10)
  full_name                 VARCHAR(100) NOT NULL,
  first_name                VARCHAR(50),
  last_name                 VARCHAR(50),
  phone                     VARCHAR(20),                    -- E.164 format
  avatar_url                TEXT,
  timezone                  VARCHAR(100) DEFAULT 'Africa/Lagos',  -- WAT default
  language                  VARCHAR(10) DEFAULT 'en-NG',
  bio                       TEXT,
  job_title                 VARCHAR(100),
  department                VARCHAR(100),
  mfa_enabled               BOOLEAN DEFAULT FALSE,
  mfa_secret_encrypted      TEXT,
  mfa_backup_codes_hashed   TEXT[],                         -- bcrypt hashes
  failed_login_count        INTEGER DEFAULT 0,
  locked_until              TIMESTAMPTZ,
  last_login_at             TIMESTAMPTZ,
  last_login_ip             INET,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'pending_verification', 'pending_deletion', 'deleted')),
  deletion_requested_at     TIMESTAMPTZ,
  deletion_scheduled_at     TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deletion ON users(deletion_scheduled_at) WHERE status = 'pending_deletion';
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

### 8.2 Organizations Table

```sql
CREATE TABLE organizations (
  id                        VARCHAR(32) PRIMARY KEY,
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(100) UNIQUE NOT NULL,   -- URL-friendly, unique
  logo_url                  TEXT,
  industry                  VARCHAR(50),
  website                   VARCHAR(255),
  size                      INTEGER,                        -- employee count
  address                   JSONB,
  timezone                  VARCHAR(100) DEFAULT 'Africa/Lagos',  -- WAT default for Nigerian orgs
  language                  VARCHAR(10) DEFAULT 'en-NG',
  currency                  VARCHAR(3) DEFAULT 'NGN',       -- Nigerian Naira default
  billing_email             VARCHAR(255),
  tax_id                    VARCHAR(50),                    -- Nigerian TIN or CAC number
  plan_tier                 VARCHAR(20) DEFAULT 'starter'
                            CHECK (plan_tier IN ('starter', 'growth', 'professional', 'enterprise', 'agency')),
  subscription_status       VARCHAR(20) DEFAULT 'trial'
                            CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at             TIMESTAMPTZ,
  paystack_customer_id      VARCHAR(255),                   -- Nigerian payment processor
  paystack_subscription_id  VARCHAR(255),
  white_label_settings      JSONB,                          -- Agency tier only
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

### 8.3 Organization Members Table

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
  deactivated_at    TIMESTAMPTZ,
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

### 8.4 Sessions Table

```sql
CREATE TABLE sessions (
  id                  VARCHAR(32) PRIMARY KEY,
  user_id             VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          VARCHAR(255) UNIQUE NOT NULL,         -- SHA-256 of refresh token
  access_token_hash   VARCHAR(255),                         -- SHA-256 of current access token
  ip_address          INET,
  user_agent          TEXT,
  device_type         VARCHAR(20),
  os                  VARCHAR(50),
  browser             VARCHAR(50),
  location_city       VARCHAR(100),
  location_country    VARCHAR(2),
  is_trusted_device   BOOLEAN DEFAULT FALSE,
  trusted_until       TIMESTAMPTZ,                          -- MFA trust expiry
  expires_at          TIMESTAMPTZ NOT NULL,
  last_active_at      TIMESTAMPTZ DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_active ON sessions(user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;
```

### 8.5 Invitations Table

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

### 8.6 Authentication Token Tables

```sql
-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id          VARCHAR(32) PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,
  email       VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evt_user ON email_verification_tokens(user_id);
CREATE INDEX idx_evt_token ON email_verification_tokens(token_hash);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id          VARCHAR(32) PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX idx_prt_token ON password_reset_tokens(token_hash);

-- Password history (last 5 hashes)
CREATE TABLE password_history (
  id              VARCHAR(32) PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ph_user ON password_history(user_id, created_at DESC);

-- Login attempts (for audit and lockout)
CREATE TABLE login_attempts (
  id              VARCHAR(32) PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  user_id         VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  ip_address      INET,
  user_agent      TEXT,
  success         BOOLEAN NOT NULL,
  failure_reason  VARCHAR(50),
  mfa_used        BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_la_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_la_ip ON login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_la_user ON login_attempts(user_id, created_at DESC);
```

### 8.7 API Keys Table

```sql
CREATE TABLE api_keys (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  key_hash        VARCHAR(255) UNIQUE NOT NULL,             -- SHA-256 of full key
  key_preview     VARCHAR(20) NOT NULL,                    -- e.g., "nwb_live_abcd"
  scopes          TEXT[],
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY api_keys_isolation ON api_keys
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(organization_id, is_active);
```

### 8.8 Audit Log Table

```sql
CREATE TABLE audit_log (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32),                             -- NULL after user deletion
  user_id         VARCHAR(32),                             -- NULL after user deletion
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(32),
  changes         JSONB,                                   -- before/after values
  reason          TEXT,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — audit log is immutable
);

-- Audit log is immutable — no RLS (global; admins can query their org's log)
CREATE INDEX idx_aud_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_aud_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_aud_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_aud_resource ON audit_log(resource_type, resource_id, created_at DESC);
```

---

## 9. Email Notifications

### 9.1 Transactional Emails

| Event | Recipient | Subject | SLA | Key Content |
|-------|-----------|---------|-----|-------------|
| Email verification | New user | Verify your Nawebeus account | < 30 seconds | Verification link (24h); org name; support contact |
| Welcome | Verified user | Welcome to Nawebeus — let's get started | After verification | Getting started guide; first steps |
| Login from new device | User | New sign-in to your Nawebeus account | < 60 seconds | Device, location, WAT time; "Not you?" link |
| Login from new country | User | New sign-in from [Country] | < 60 seconds | "This was me" / "Not me" action links |
| Password changed | User | Your Nawebeus password was changed | Immediate | WAT timestamp; "Wasn't you?" link |
| Password reset request | User (if exists) | Reset your Nawebeus password | < 30 seconds | Reset link (1h expiry); WAT timestamp |
| Account deletion (soft) | User | Your account deletion request | Immediate | Reactivation link (30 days); data handling summary |
| Account reactivated | User | Welcome back to Nawebeus | Immediate | WAT timestamp; next steps |
| Team invitation | Invitee | [Name] invited you to join [Org] on Nawebeus | < 30 seconds | Org name; role; inviter name; link (7 days) |
| Invitation accepted | Inviter | [Name] accepted your invitation | Immediate | New member details; role |
| MFA enabled | User | Two-factor authentication enabled | Immediate | WAT timestamp; "Wasn't you?" link |
| MFA disabled | User | Two-factor authentication disabled (security alert) | Immediate | WAT timestamp; immediate action required if not them |
| Account locked | User | Nawebeus account temporarily locked | Immediate | Unlock time in WAT; reset password option |
| Role changed | User | Your role in [Org] has been updated | Immediate | Old role → new role; effective immediately |
| Removed from org | User | You've been removed from [Org] | Immediate | Final notice; any other orgs listed |
| Paystack subscription canceled (₦) | Owner | Your Nawebeus subscription has been canceled | Immediate | Cancellation effective date; ₦ refund amount if applicable |

### 9.2 In-App Notifications

| Event | Message | Timing |
|-------|---------|--------|
| Email verification needed | "Please verify your email to access all features." | On login |
| Profile incomplete | "Complete your profile to help your team recognize you." | On dashboard |
| MFA recommended | "Enable two-factor authentication for enhanced security." | After 7 days without MFA |
| New device login | "New sign-in detected from [City, Country]" | Real-time |
| Session expired | "Your session has expired. Please log in again." | On next request |
| Account pending deletion | "Your account is scheduled for deletion in [N] days. [Reactivate]" | On login during grace period |

---

## 10. Error Handling

### 10.1 Error Code Reference

| Code | HTTP Status | Message | User Action |
|------|------------|---------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid input provided | See field-level errors |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password | Check credentials; try reset |
| `EMAIL_NOT_VERIFIED` | 403 | Please verify your email address | Check inbox; use resend |
| `ACCOUNT_LOCKED` | 429 | Account locked until [time WAT] | Wait or reset password |
| `EMAIL_ALREADY_EXISTS` | 409 | An account with this email already exists | Log in or reset password |
| `ORG_NAME_ALREADY_EXISTS` | 409 | Organization name is already taken | Choose a different name |
| `PASSWORD_TOO_WEAK` | 422 | Password does not meet requirements | See requirements below field |
| `PASSWORD_RECENTLY_USED` | 422 | Password was recently used | Choose a different password |
| `CURRENT_PASSWORD_INCORRECT` | 422 | Current password is incorrect | Check and try again |
| `INVALID_TOKEN` | 400 | Invalid or expired link | Request a new link |
| `TOKEN_EXPIRED` | 400 | Link has expired | Request a new link |
| `TOKEN_USED` | 400 | Link has already been used | Request a new link |
| `MFA_CODE_INVALID` | 401 | Incorrect code | Check app and try again |
| `MFA_REQUIRED` | 403 | Two-factor authentication required | Set up MFA in settings |
| `MFA_BACKUP_INVALID` | 401 | Invalid backup code | Try another; contact admin |
| `INSUFFICIENT_PERMISSIONS` | 403 | You don't have permission | Contact your admin |
| `RESOURCE_NOT_FOUND` | 404 | Resource not found | Check the URL |
| `INVITATION_EXPIRED` | 400 | Invitation has expired | Ask admin to resend |
| `INVITATION_REVOKED` | 400 | Invitation is no longer valid | Ask admin to send new invite |
| `ALREADY_MEMBER` | 409 | Already a member of this organization | — |
| `SOLE_ADMIN` | 422 | Transfer ownership before deleting account | Use ownership transfer |
| `PLAN_LIMIT_REACHED` | 422 | Organization has reached its user limit | Upgrade plan |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Retry after [N] seconds |
| `RECAPTCHA_FAILED` | 422 | Verification failed | Try again |
| `FILE_TOO_LARGE` | 422 | File exceeds 5 MB limit | Reduce file size |
| `INVALID_FILE_TYPE` | 422 | File must be JPG or PNG | Convert and re-upload |
| `PAYSTACK_ERROR` | 503 | Payment processing temporarily unavailable | Try again shortly |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred | Try again; contact support |

### 10.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_TOO_WEAK",
    "message": "Password does not meet the complexity requirements.",
    "details": {
      "requirements": [
        { "rule": "min_length", "required": 12, "met": false },
        { "rule": "uppercase", "met": true },
        { "rule": "lowercase", "met": true },
        { "rule": "number", "met": false },
        { "rule": "special_character", "met": false }
      ]
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Registration form submission | < 2 seconds end-to-end |
| Login (no MFA) | < 1 second end-to-end |
| Login (with MFA) | < 1.5 seconds end-to-end |
| Session validation (per request) | < 50ms (cached) |
| Password reset flow (end-to-end) | < 2 minutes total |
| Profile update | < 1 second |
| API response time P95 | < 500ms |
| Email verification delivery | < 30 seconds |
| Invitation email delivery | < 30 seconds |

### 11.2 Security

| Control | Implementation |
|---------|---------------|
| Password hashing | bcrypt (cost factor 10, via Bun.password) |
| Session tokens | 32 bytes, cryptographically random |
| All tokens stored | SHA-256 hashed in database |
| Transport security | HTTPS only (TLS 1.3); HSTS enforced |
| Cookie security | httpOnly + Secure + SameSite=Strict |
| CSRF protection | SameSite=Strict + CSRF tokens |
| Rate limiting | Per-endpoint + per-user sliding window |
| Audit logging | 100% of state-changing operations |
| Multi-tenant isolation | RLS + application-layer + service-layer |
| MFA | TOTP (RFC 6238); enforced for Owner/Admin |
| PII protection | Encrypted at rest (AES-256); never in logs |

### 11.3 Compliance

| Regulation | Implementation |
|-----------|---------------|
| **NDPR** (Nigeria Data Protection Regulation) | Data sovereignty (VPS in Nigeria); DSAR workflow; 30-day erasure; 7-year audit retention; DPO designated |
| **GDPR** | Right to access, rectification, erasure, portability; data processing agreements |
| **CCPA** | Right to know, delete, opt-out; no data sale |
| **COPPA** | Age restriction (18+); no data collection from minors |
| **CAN-SPAM** | Unsubscribe in all marketing emails; physical address; honest subject lines |

### 11.4 Availability

| Metric | Target |
|--------|--------|
| Module uptime | 99.9% (auth must always be available) |
| Authentication latency | P99 < 2 seconds |
| Disaster recovery RPO | < 5 minutes (WAL archiving) |
| Disaster recovery RTO | < 30 minutes |

---

## 12. Edge Cases

### 12.1 Registration Edge Cases

| Scenario | Behavior |
|----------|---------|
| Email with uppercase letters | Normalized to lowercase before storage |
| Organization name with special characters | Auto-generate slug; keep display name as entered |
| Simultaneous registration with same email | First succeeds; others get EMAIL_ALREADY_EXISTS |
| Nigerian phone number in format `0XX...` | Auto-convert to `+234XX...` |
| Registration during email service outage | Account created; verification email queued for retry; user shown "Email delivery may be delayed" |
| User never verifies email | Account stays pending_verification; verified link resend available indefinitely |

### 12.2 Authentication Edge Cases

| Scenario | Behavior |
|----------|---------|
| Concurrent login from multiple devices | All sessions valid; all visible in session manager |
| Session expires during active use | Next API request returns 401; client uses refresh token; transparent for user |
| Refresh token used twice (potential theft) | Both sessions invalidated; security email sent; user must re-authenticate |
| User logs in from VPN | Login succeeds; location shows VPN exit node; informational only |
| Email changed while logged in | Current session remains valid; next token refresh uses new email |
| User has MFA but loses authenticator | Backup code or Admin-initiated MFA reset |
| Admin MFA enforcement enabled mid-session | User sees MFA setup banner; 7-day grace before blocking |

### 12.3 Organization Edge Cases

| Scenario | Behavior |
|----------|---------|
| User belongs to 20+ organizations | Organization switcher shows recent + search for all |
| Admin tries to demote sole Admin | Error: "Cannot demote the only Admin. Promote another user first." |
| Organization deleted with active members | Members receive email notification; all access removed |
| Organization at user limit tries to invite | Error shown immediately with upgrade CTA |
| User removed from org while logged in | Next page load shows "You no longer have access" |
| Agency user switches between client orgs | Context switch is atomic; no data leaks between contexts |

### 12.4 Account Deletion Edge Cases

| Scenario | Behavior |
|----------|---------|
| Sole Owner requests deletion | Blocked with prompt to transfer ownership first |
| User with unpaid ₦ invoices requests deletion | Blocked until invoices settled |
| User reactivates after data partially cleaned | Reactivation succeeds; missing data shown as "data not available" |
| Admin tries to block legitimate deletion | Cannot block; can only transfer ownership concern |
| Deletion request while security investigation open | System flag prevents deletion; legal team notified |

---

## 13. Future Enhancements

| ID | Enhancement | Priority | Planned Phase |
|----|-------------|----------|--------------|
| FE-AUTH-001 | SAML/SSO integration (Okta, Azure AD, Google Workspace) | High | Phase 6 — Q2 2027 |
| FE-AUTH-002 | SCIM automated provisioning/deprovisioning | Medium | Phase 7 — Q3 2027 |
| FE-AUTH-003 | SMS-based MFA (alternative to TOTP) | Medium | Phase 8 — Year 2 |
| FE-AUTH-004 | Social login (Google, Microsoft) | Low | Phase 11 — Year 3 |
| FE-AUTH-005 | WebAuthn / FIDO2 hardware key support | Low | Phase 11 — Year 3 |
| FE-AUTH-006 | Passwordless authentication (magic links) | Low | Phase 11 — Year 3 |
| FE-AUTH-007 | IP allowlisting per organization | Medium | Phase 9 — Year 2 |
| FE-AUTH-008 | Geofencing / time-based access controls | Low | Phase 12 — Year 3 |
| FE-AUTH-009 | Department / team hierarchy within organizations | Medium | Phase 9 — Year 2 |
| FE-AUTH-010 | Advanced fraud detection and risk-based auth | Low | Phase 12 — Year 3 |

---

## 14. Testing Strategy

### 14.1 Unit Tests

**Coverage target: ≥ 90%**

| Component | What to Test |
|-----------|-------------|
| Password hashing | bcrypt cost factor; hash format; comparison |
| Token generation | Randomness; format; prefix; uniqueness |
| TOTP validation | RFC 6238 compliance; window tolerance; expiry |
| Zod schemas | All validation rules; edge cases; Nigerian phone format |
| Session management | Token rotation; expiry; revocation |
| RBAC permission checks | All role × action combinations; self-protection rules |

### 14.2 Integration Tests

**Coverage target: ≥ 80% of endpoints**

| Journey | Tests Required |
|---------|---------------|
| Registration | Happy path; duplicate email; weak password; reCAPTCHA failure |
| Login | Happy path; wrong password; account locked; MFA required |
| Password reset | Happy path; expired token; used token; no email enumeration |
| Email change | Happy path; new email in use; old email notification |
| MFA setup and login | Happy path; wrong code; backup code |
| Organization isolation | Cross-org access attempt returns 403; RLS verification |
| Invitation flow | Happy path; expired invitation; revoked; manager inviting admin |
| Account deletion | Happy path; sole owner block; reactivation; 30-day expiry |

### 14.3 Security Tests

| Test | Tool | Frequency |
|------|------|-----------|
| Multi-tenant isolation (IDOR) | Custom tests + OWASP ZAP | Every PR |
| SQL injection prevention | OWASP ZAP + Drizzle parameterized queries | Every PR |
| XSS prevention | OWASP ZAP | Every PR |
| CSRF protection | Custom tests (SameSite=Strict) | Every PR |
| Rate limit bypass attempts | Custom load tests | Weekly |
| Brute force protection | Custom tests (lockout verification) | Every PR |
| Token reuse detection | Custom tests (refresh token rotation) | Every PR |
| Password hash verification | Unit tests (never plaintext) | Every PR |

### 14.4 The Negative Test Rule (Mandatory)

For every "user **can** do X" test, there must be a corresponding "user **cannot** do X" test:

```typescript
// ✅ Example: Both directions tested for MFA enforcement
describe('MFA enforcement for Admin role', () => {
  it('Admin with MFA enabled can log in successfully', async () => { /* ... */ });
  it('Admin without MFA is blocked after 7-day grace period', async () => { /* ... */ });
  it('Viewer without MFA is NOT blocked (not enforced for Viewer)', async () => { /* ... */ });
});

describe('Cross-organization data isolation', () => {
  it('User from Org A can read their own mentions', async () => { /* ... */ });
  it('User from Org A CANNOT read Org B mentions (returns 403)', async () => { /* ... */ });
  it('Admin from Org A CANNOT access Org B even with admin role', async () => { /* ... */ });
});
```

---

## 15. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| Design Lead | _________________ | _________ | _______ |
| QA Lead | _________________ | _________ | _______ |
| Legal & Compliance | _________________ | _________ | _______ |

---

## 16. Related Documents

| Document | Relationship |
|----------|-------------|
| **Architecture** | Multi-tenant RLS implementation; JWT architecture; service layer patterns |
| **ADRs** | ADR-006 (CASL RBAC), ADR-010 (JWT auth), ADR-009 (multi-tenant RLS) |
| **Database Schema** | Users, organizations, sessions, audit log table definitions |
| **Security Architecture** | Password hashing parameters; MFA requirements; NDPR compliance |
| **Engineering Standards** | Import boundary rules; TypeScript strict mode; testing requirements |
| **QA Strategy** | Negative test rule; security test coverage; isolation test requirements |
| **API Reference** | Auth endpoint documentation; error code reference |
| **Personas** | Ade (Admin), Chidi (Manager), Bola (Creator), Tunde (Analyst), Ngozi (Manager) |
| **User Journeys** | Journey 1 (Discovery & Signup), Journey 2 (Onboarding & Setup) |
| **Infrastructure** | Session storage; backup; WAT timezone defaults |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Product Lead & Engineering Lead | Unified and expanded Authentication & User Management module. Merges and improves both source documents. Adds: 6-tier role hierarchy (Owner, Admin, Manager, Creator, Analyst, Viewer), Nigerian market defaults (NGN currency, Africa/Lagos WAT timezone, en-NG language, Nigerian phone E.164 auto-format), NDPR compliance details (7-year audit retention, ₦ invoice 7-year retention, DPO designation, 30-day erasure), Paystack integration for ₦ subscription cancellation on account deletion, complete Zod validation schemas including NairaAmountSchema, API key management (FR-AUTH-010), expanded edge cases (Nigerian-specific scenarios), mandatory negative test rule examples, WAT timestamps throughout email notification table, and agency-tier white-label settings in organizations table. |

---

*This document is owned by the Product Lead and reviewed quarterly, or immediately following any significant security change, compliance requirement update, or architectural modification to the authentication system.*