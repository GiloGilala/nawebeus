# Security Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Security Lead & Engineering Lead

---

## 1. Executive Summary

This document defines the complete security architecture for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It establishes security principles, threat model, security controls, data protection strategies, compliance requirements, incident response procedures, and the security roadmap.

The platform is designed to be **secure by design** — security is built into every architectural layer from the database through the API to the browser, not added as an afterthought.

**Security Philosophy:**

| Principle | Description |
|-----------|-------------|
| **Security by Design** | Security is a first-class requirement, considered from architecture through deployment |
| **Defense in Depth** | Multiple independent layers of security controls; no single point of failure |
| **Least Privilege** | Every user, service, and process has the minimum access required |
| **Zero Trust** | Every request is authenticated and authorized — even from "internal" sources |
| **Encryption Everywhere** | Data encrypted in transit (TLS 1.3) and at rest (AES-256) |
| **Audit by Default** | Every state change is logged; append-only audit trail; 7-year retention |
| **Fail Safe** | When in doubt, deny access; errors never compromise security |
| **No Secrets in Code** | All secrets are environment variables; never committed to Git |
| **Nigerian Data Sovereignty** | Nigerian user data processed and stored within Nigeria (NDPR compliance) |
| **Assume Breach** | Design as if the perimeter is already compromised |

**Applicable Compliance Frameworks:**

| Framework | Applicability | Status |
|-----------|--------------|--------|
| **NDPR** (Nigeria Data Protection Regulation) | Primary — all Nigerian user data | ✅ Year 1 |
| **GDPR** (General Data Protection Regulation) | For users accessing from EU | ✅ Year 1 |
| **CCPA** (California Consumer Privacy Act) | For users from California | ✅ Year 1 |
| **COPPA** (Children's Online Privacy Protection Act) | Age restrictions | ✅ Year 1 |
| **CAN-SPAM Act** | Email communications | ✅ Year 1 |
| **PCI DSS** (via Paystack) | Payment processing | ✅ Delegated to Paystack |
| **SOC 2 Type II** | Enterprise customer requirement | 🗓 Year 2 (2027) |
| **ISO 27001** | Enterprise customer requirement | 🗓 Year 2 (2027) |

---

## 2. Threat Model

### 2.1 Assets to Protect

| Asset | Sensitivity | Business Impact if Compromised |
|-------|------------|-------------------------------|
| **User credentials** (passwords, MFA secrets) | 🔴 Critical | Account takeover, unauthorized access to entire platform |
| **User PII** (names, emails, phone numbers, IP addresses) | 🔴 Critical | Privacy violation, NDPR/GDPR regulatory fines, reputational damage |
| **Social media OAuth tokens** | 🔴 Critical | Unauthorized posting, account hijacking, platform bans |
| **Paystack API keys and webhook secrets** | 🔴 Critical | Unauthorized ₦ charges, subscription fraud |
| **Encryption keys** (JWT signing, AES keys) | 🔴 Critical | Complete compromise of all encrypted data |
| **Organization PR strategies and media contact lists** | 🟠 High | Competitive intelligence theft, journalist relationship damage |
| **Brand monitoring data** (competitive intelligence, crisis signals) | 🟠 High | Competitive disadvantage, informed competitor attacks |
| **Embargoed press releases** | 🟠 High | Regulatory violation, media relationship damage |
| **Audit logs** | 🟠 High | Inability to detect, investigate, or respond to security incidents |
| **Platform configuration and infrastructure secrets** | 🟠 High | Infrastructure compromise, data exfiltration |
| **Database backups** | 🟠 High | Data breach if backup encryption fails |

### 2.2 Threat Actors

| Actor | Motivation | Technical Capability | Likelihood |
|-------|-----------|---------------------|------------|
| **External attackers** | Financial gain, data theft, disruption | High — automated tooling, known CVEs | 🔴 High |
| **Malicious insiders** | Financial gain, revenge, corporate espionage | High — has authenticated access | 🟡 Medium |
| **Careless insiders** | None (accidental) | Medium — legitimate access misused | 🔴 High |
| **Nigerian fintech competitors** | Competitive intelligence, customer lists | Medium | 🟡 Medium |
| **International competitors** | Market intelligence, disruption | Medium–High | 🟡 Medium |
| **Nation-state actors** | Surveillance, political disruption | Very High | 🟢 Low |
| **Hacktivists** | Political/social ideology, publicity | Low–Medium | 🟢 Low |
| **Automated bots** | Credential stuffing, scraping, spam | Medium — scale-based | 🔴 High |
| **Platform API abusers** | Free service, data exfiltration | Low | 🔴 High |

### 2.3 Attack Vectors and Mitigations

| Attack Vector | Likelihood | Impact | Primary Mitigation |
|--------------|------------|--------|-------------------|
| **Credential stuffing** | 🔴 High | 🟠 High | MFA, rate limiting, account lockout, password breach detection |
| **Phishing** | 🔴 High | 🟠 High | User education, MFA, email DMARC/DKIM/SPF |
| **SQL injection** | 🟡 Medium | 🔴 Critical | Parameterized queries via Drizzle ORM, RLS |
| **XSS (reflected/stored)** | 🟡 Medium | 🟠 High | React auto-escaping, CSP headers, input validation |
| **CSRF** | 🟡 Medium | 🟡 Medium | SameSite=Strict cookies, CSRF tokens |
| **JWT token theft** | 🟡 Medium | 🔴 Critical | httpOnly cookies (web), SecureStore (mobile), short expiry |
| **OAuth token hijacking** | 🟡 Medium | 🔴 Critical | Encrypted storage, rotation, monitoring |
| **API abuse and scraping** | 🔴 High | 🟡 Medium | Rate limiting, authentication, bot detection |
| **Insider data exfiltration** | 🟡 Medium | 🔴 Critical | Audit logging, least privilege, data export monitoring |
| **Multi-tenant data leak** | 🟡 Medium | 🔴 Critical | Row-Level Security (RLS), application-layer filtering |
| **DDoS attack** | 🟡 Medium | 🟡 Medium | Cloudflare DDoS protection, rate limiting |
| **Supply chain attack** | 🟢 Low | 🔴 Critical | Dependency scanning, SBOM, vendor assessment |
| **Paystack webhook replay** | 🟡 Medium | 🟠 High | Signature verification, timestamp validation, idempotency |
| **Brute-force login** | 🔴 High | 🟠 High | Account lockout, CAPTCHA, rate limiting |
| **Social engineering** | 🟡 Medium | 🟠 High | Employee training, verification procedures |
| **Backup exfiltration** | 🟢 Low | 🔴 Critical | AES-256 backup encryption, off-site storage |

### 2.4 STRIDE Threat Analysis

| Threat Category | Nawebeus Risk Examples | Mitigations |
|----------------|----------------------|-------------|
| **Spoofing** | Impersonating another org's admin; forging Paystack webhook events | JWT authentication, MFA, Paystack signature verification |
| **Tampering** | Modifying monitoring data; altering ₦ invoice amounts | Database constraints, audit logging, RLS, HMAC signatures |
| **Repudiation** | Denying unauthorized API calls; disputing ₦ charges | Comprehensive append-only audit log with request IDs |
| **Information Disclosure** | Leaking another org's media contacts; exposing draft press releases | RLS multi-tenant isolation, encryption, RBAC |
| **Denial of Service** | Flooding the crisis alert API; overwhelming the mention ingestion pipeline | Rate limiting, Cloudflare DDoS protection, circuit breakers |
| **Elevation of Privilege** | Viewer accessing Admin settings; accessing another org's billing in ₦ | CASL RBAC at API + service + DB layer; RLS |

---

## 3. Authentication

### 3.1 JWT-Based Authentication

**Authentication flow:**
```
1. User submits email + password (+ TOTP if MFA enabled)
2. Server validates credentials via bcrypt comparison (Bun.password)
3. Server checks TOTP code against encrypted MFA secret
4. Server issues: access token (15 min) + refresh token (7 days)
5. Web: tokens set as httpOnly + Secure + SameSite=Strict cookies
   Mobile: tokens stored in Expo SecureStore (OS-encrypted)
6. Client includes access token in Authorization header (mobile)
   or cookie (web, sent automatically)
7. Server validates JWT signature and expiry on every request
8. Server extracts organizationId → sets RLS context
9. Server enforces CASL RBAC before any business logic
```

**JWT Token Configuration:**

| Property | Value | Rationale |
|----------|-------|-----------|
| **Signing algorithm** | HS256 | Fast, secure for single-server; upgrade to RS256 for multi-server |
| **Access token lifetime** | 15 minutes | Short window limits damage from token theft |
| **Refresh token lifetime** | 7 days (sliding window) | Balance between security and UX |
| **Refresh token strategy** | Rotating — each refresh issues a new refresh token | Detects token theft (old refresh token reuse triggers revocation) |
| **Web storage** | `httpOnly` + `Secure` + `SameSite=Strict` cookie | Immune to XSS; CSRF protected by SameSite |
| **Mobile storage** | Expo SecureStore (iOS Keychain / Android Keystore) | OS-level hardware-backed encryption |
| **Token revocation** | Revocation list in SQLite/Redis | Emergency token invalidation (logout, security events) |

**JWT Payload:**
```json
{
  "sub": "usr_9f2a4b6c8d1e3f5g",
  "org": "org_7e3b2c1d4f5a6b8c",
  "role": "manager",
  "email": "ade@firstbank.com.ng",
  "mfaVerified": true,
  "iat": 1721560200,
  "exp": 1721561100,
  "jti": "tok_abc123def456"
}
```

**What is NEVER in the JWT payload:**
- Password or password hash
- MFA secret
- Paystack API keys or authorization codes
- Social platform OAuth tokens
- Any sensitive PII beyond email

### 3.2 Password Security

| Control | Standard | Implementation |
|---------|---------|---------------|
| **Hashing algorithm** | bcrypt | `Bun.password.hash()` with bcrypt (cost factor 10) |
| **Work factor** | Cost factor 10 | Balance between security and server load |
| **Salt** | Unique per password | Prevents rainbow table attacks |
| **Minimum length** | 12 characters | NIST SP 800-63B recommendation |
| **Complexity requirements** | Uppercase + lowercase + number + symbol | Reduces predictability |
| **Breach detection** | Check against Have I Been Pwned on registration | Prevents use of known compromised passwords |
| **Password history** | Last 5 passwords cannot be reused | Prevents cycling |
| **Forced rotation** | Not enforced | Per NIST guidelines — forced rotation reduces security |

### 3.3 Multi-Factor Authentication (MFA)

| Property | Standard |
|----------|---------|
| **Algorithm** | TOTP (Time-based One-Time Password) per RFC 6238 |
| **Compatible apps** | Google Authenticator, Authy, 1Password, Microsoft Authenticator |
| **Code validity window** | 30-second TOTP codes with ±1 window tolerance (90 seconds total) |
| **Backup codes** | 10 single-use 8-character codes generated at MFA setup |
| **MFA secret storage** | Encrypted with AES-256 using KMS-managed key |
| **"Trust this device"** | 30-day bypass using device-specific cookie |
| **Admin enforcement** | Owners and Admins must have MFA enabled (enforced at login) |
| **Recovery** | Account recovery via verified backup codes or admin override |

### 3.4 Account Lockout Policy

| Event | Threshold | Action | Reset |
|-------|-----------|--------|-------|
| Failed password attempts | 5 consecutive | 15-minute account lockout | Successful login or 15 minutes |
| Failed TOTP attempts | 5 consecutive | 15-minute account lockout | Successful login or 15 minutes |
| Failed attempts from one IP | 20 in 5 minutes | IP temporarily blocked (30 min) | Automatic after 30 minutes |
| Suspicious login pattern | AI-detected anomaly | Email alert + optional 2FA challenge | User confirms device |

All lockout events are logged in `login_attempts` table and generate security alerts.

### 3.5 Session Management

| Property | Value |
|----------|-------|
| **Concurrent sessions** | Unlimited (all devices tracked) |
| **Inactivity timeout** | 24 hours (access token refresh stops) |
| **Session listing** | Users can view all active sessions |
| **Session termination** | Users can terminate individual or all sessions |
| **Password change effect** | Immediately revokes all refresh tokens |
| **Suspicious session detection** | New country/device triggers email alert |

---

## 4. Authorization (RBAC)

### 4.1 Role Hierarchy

| Role | Scope | Key Permissions |
|------|-------|----------------|
| **Owner** | Full platform | All permissions + billing ownership; cannot be demoted by others |
| **Admin** | Full platform | All permissions except billing ownership; can manage all users |
| **Manager** | Operational | All modules; content approval authority; team management |
| **Creator** | Content creation | Create and submit content for approval; no approval authority |
| **Analyst** | Read-only data | View all analytics, monitoring, reporting; no content creation |
| **Viewer** | Dashboard only | Read-only access to dashboards and reports; no settings access |

### 4.2 Permission Matrix

| Permission | Owner | Admin | Manager | Creator | Analyst | Viewer |
|-----------|-------|-------|---------|---------|---------|--------|
| Manage billing (₦ subscriptions) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage organization settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage team members | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| Invite team members | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage social account connections | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve/reject content | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish content | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create content | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage crisis response | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export data | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| View analytics and reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View monitoring feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage API keys | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage integrations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

*Managers can only manage users with roles below Manager (Creator, Analyst, Viewer)

### 4.3 RBAC Enforcement Layers (Defense in Depth)

> **As-built, verified 2026-09-20 (NWB-P0-018, finding F-06).** The table below
> describes the target design. What the code enforces today is the chain in
> §4.3.1 — Layer 3 (RLS) is **not implemented** (decision D11 is open, tracked as
> **DEC-O009** in the Decision Log with an engineering recommendation; re-verified
> 2026-09-20 against the live database: 0 policies, 0 tables with `relrowsecurity`),
> and CASL conditions are **not** part of the enforcement chain. Read §4.3.1 first.

Authorization is enforced at **three independent layers**:

| Layer | Mechanism | What it Catches | As-built |
|-------|-----------|----------------|----------|
| **API route layer (Layer 1)** | Hono `requirePermission()` middleware | Unauthenticated or wrong-role requests before reaching business logic | ✅ shipped as `requireAbility(action, subject)` (`src/server/middleware/rbac.ts`) |
| **Service layer (Layer 2)** | CASL `ability.can()` checks before every state-changing operation | Bypassed API middleware; incorrect CASL configuration | ⚠️ partial — services enforce org predicates and the role-policy guards; `ability.can()` is checked at the route |
| **Database layer (Layer 3)** | PostgreSQL Row-Level Security (RLS) policies | Application bugs that produce incorrect `organization_id`; raw database access | ❌ not implemented — pending decision D11 / **DEC-O009** (recommendation: defense-in-depth in Phase 8, application layer stays primary) |

#### 4.3.1 The enforcement chain that actually runs

An authenticated request is scoped to exactly one organization by **four**
mechanisms, none of which is a CASL condition:

1. **JWT-derived org.** The access token carries `(userId, orgId)`. There is no
   request input that can change the org a caller acts in; `authMiddleware`
   takes it from the verified token (or, for a Bearer key, from the key's own
   row) and puts it in `AsyncLocalStorage` as the Org context.
2. **Active-principal check.** `assertActivePrincipal` rejects the request
   unless the user has an **active** membership in that org and an active
   `users.status`. A revoked membership stops working on the next request.
3. **Per-(user, org) ability load.** `loadAbility(db, userId, orgId)` builds the
   Ability from *that org's* membership → role → permission rows only. A user in
   org A is never handed org B's rules, so the org scoping is structural: it is
   the `WHERE om.organization_id = …` in the query, not a rule condition.
4. **Org-match on path parameters + service predicates.** `requireOrgMatch()`
   rejects any route whose `:orgId` differs from the JWT's org, and every
   org-scoped service method takes `organizationId` and filters on it.

**CASL conditions are deliberately absent.** `loadAbility` previously attached
`{ organizationId }` to every rule. CASL only evaluates conditions against a
*subject instance*, and every check in this codebase is
`ability.can(action, "string-subject")` — for a string subject CASL v7 skips
condition matching entirely. The condition could therefore never deny anything;
it made this document read stronger than the code was. It was removed rather
than left decorative (NWB-P0-018). The alternative — passing
`{ organizationId }` objects from routes into `ability.can` — was rejected:
object-level checks belong in the service layer, where the org predicate already
lives.

Two tests pin this so it cannot silently regress:

- `src/tests/auth/ability-scoping.test.ts` — pins the CASL v7 behaviour (a
  condition does not deny a string-subject check), asserts that no rule returned
  by `loadAbility` carries conditions, and asserts that a member of org A loads
  an **empty** ability for org B.
- `src/tests/route-invariants.test.ts` — a static scan over `src/server/api/**`
  that fails when any route whose path contains `:orgId` is not covered by
  `requireOrgMatch`. This closes the IDOR class by construction rather than by
  review.

**Self-protection rules (enforced in CASL and service layer):**
- Owners and Admins cannot suspend their own accounts
- Admins cannot change their own role
- The last Owner/Admin cannot be removed from an organization
- All RBAC mutations generate audit log entries

### 4.4 Multi-Tenant Data Isolation

Multi-tenant isolation uses **three independent enforcement mechanisms**:

```sql
-- Database layer (PostgreSQL RLS)
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_mentions FORCE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON media_mentions
  FOR SELECT
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE POLICY "org_isolation_write" ON media_mentions
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
```

```typescript
// Application layer (Hono middleware)
app.use('/api/*', async (c, next) => {
  const organizationId = c.get('user').organizationId;
  // Validate user is a member of the organization being requested
  await validateOrganizationMembership(userId, organizationId);
  // Set RLS context for this database session
  await db.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`);
  await next();
});

// Service layer (required typed parameter)
// organizationId is a required parameter on every service method
// that operates on multi-tenant data — structural enforcement
export async function getMediaMentions({
  organizationId,  // ← Required — cannot be omitted
  filters,
}: GetMediaMentionsInput) { /* ... */ }
```

**Testing:** Every integration test suite includes isolation tests verifying that a user from Organization A cannot access data from Organization B.

---

## 5. Data Protection

### 5.1 Encryption Strategy

#### In Transit

| Channel | Standard | Notes |
|---------|---------|-------|
| All HTTP traffic | TLS 1.3 | Nginx terminates; Cloudflare edge certificate |
| HSTS | `max-age=31536000; includeSubDomains; preload` | Prevents HTTPS downgrade attacks |
| WebSocket connections | WSS (TLS 1.3) | Same certificate as HTTP |
| Mobile API calls | TLS 1.3 | Certificate pinning planned for Year 2 |
| Database connections | SSL/TLS required | PostgreSQL `sslmode=require` |
| Backup transfers | TLS 1.3 | Encrypted in transit to Backblaze B2 |

#### At Rest

| Data | Encryption | Key Management |
|------|-----------|---------------|
| PostgreSQL database | AES-256 Transparent Data Encryption | KMS-managed key |
| Cloudflare R2 (file storage) | AES-256 server-side encryption | Cloudflare-managed + customer keys |
| Database backups | AES-256 (GPG) | Engineering Lead holds recovery key |
| Audit log archives | AES-256 | Compliance-grade cold storage |
| Social platform OAuth tokens | AES-256 application-level encryption | KMS-managed key |
| MFA secrets (TOTP) | AES-256 application-level encryption | KMS-managed key |
| JWT signing secret | In-memory only; never written to disk | Environment variable |

#### Application-Level Encryption

| Data | Algorithm | Notes |
|------|-----------|-------|
| Passwords | bcrypt | See Section 3.2 |
| Social OAuth access tokens | AES-256-GCM | Encrypted before database write |
| Social OAuth refresh tokens | AES-256-GCM | Encrypted before database write |
| MFA secrets | AES-256-GCM | Encrypted before database write |
| Paystack webhook secrets | AES-256-GCM | Encrypted in environment store |

### 5.2 Data Classification

| Classification | Examples | Controls Required |
|----------------|----------|------------------|
| **🔴 Restricted** | Passwords, OAuth tokens, MFA secrets, encryption keys, Paystack API keys | AES-256 encryption + strict access control + audit + no logging |
| **🟠 Confidential** | User PII, ₦ billing records, press release drafts, journalist contact details, NDPR-regulated data | Encryption at rest + access control + audit logging |
| **🟡 Internal** | Analytics metrics, monitoring data, PR strategies, media mentions | Access control + audit logging |
| **🟢 Public** | Published press releases, public organization name, platform status page | Standard security controls |

### 5.3 PII Inventory and Protection

| PII Category | Fields | Collection Basis | Retention |
|-------------|--------|-----------------|-----------|
| **Account identity** | Full name, email address | Contract (service delivery) | Account lifetime + 30 days |
| **Contact information** | Phone number, address | Consent | Account lifetime + 30 days |
| **Location data** | IP address, login location | Legitimate interest (security) | 90 days |
| **Device data** | User agent, device fingerprint | Legitimate interest (security) | 90 days |
| **Communications** | Conversation content in engagement inbox | Contract | 2 years or as configured |
| **Financial** | Subscription tier, invoice history (₦ amounts) | Contract | 7 years (Nigerian tax law) |
| **Behavioral** | Login history, feature usage, session data | Legitimate interest | 1 year |

**PII Protection Measures:**
- Encrypted at rest (AES-256) and in transit (TLS 1.3)
- Access logged and audited at INFO level
- Not included in error log messages
- Not included in analytics/telemetry exports
- Subject to NDPR data subject rights (access, erasure, portability)
- Minimized — only PII fields needed for service delivery are collected

### 5.4 Secret Management

| Secret Type | Storage | Rotation Schedule | Access |
|------------|---------|------------------|--------|
| JWT signing secret | Environment variable | Annually or on compromise | Application process only |
| Database password | Environment variable | Annually | Application process only |
| Paystack secret key | Environment variable | Per Paystack security guidelines | Application process only |
| Paystack webhook secret | Environment variable | Annually | Application process only |
| Social platform API credentials | Environment variable | Per platform guidelines | Application process only |
| R2 access credentials | Environment variable | Annually | Application process only |
| Sentry DSN | Environment variable | Annually | Application process only |

**Rules:**
- All secrets are environment variables — never hardcoded in source code
- `.env` file is in `.gitignore` — never committed to Git
- `.env.example` documents all required variables with placeholder values and comments
- Secrets never appear in log messages at any level
- Pre-commit hook (`detect-secrets`) scans staged files for accidentally committed secrets
- Secret rotation does not require code changes — only environment variable updates

---

## 6. Application Security

### 6.1 Input Validation

Every external input is validated via **Zod schemas at every entry point boundary**:

```typescript
// lib/validation/billing.schemas.ts
export const CreateSubscriptionSchema = z.object({
  organizationId: z.string().startsWith('org_'),
  planTier: z.enum(['starter', 'growth', 'professional', 'enterprise', 'agency']),
  billingCycle: z.enum(['monthly', 'annual']),
  // Monetary validation — always Nigerian Naira (₦)
  expectedAmountNaira: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
    .max(10000000, 'Amount exceeds maximum subscription value')
    .describe('Expected subscription amount in Nigerian Naira (₦)'),
});

// Validation applied at every boundary:
// 1. TanStack Form (web) — same schema
// 2. Hono route handler (API) — validated before service call
// 3. Service method — accepts only typed, validated input
```

**Validation principles:**
- **Whitelist validation** — allow known good values, reject everything else
- **Length limits** — all text fields have explicit maximum lengths
- **Range validation** — numeric fields have min/max bounds
- **Format validation** — email, URL, phone, date validated against patterns
- **Monetary validation** — all ₦ amounts must be positive, reasonable, and have ≤2 decimal places

### 6.2 SQL Injection Prevention

Drizzle ORM uses **parameterized queries exclusively**:

```typescript
// ✅ Safe — Drizzle generates parameterized SQL
const articles = await db.select()
  .from(articlesTable)
  .where(
    and(
      eq(articlesTable.organizationId, organizationId), // ← parameterized
      eq(articlesTable.sentimentLabel, sentimentFilter) // ← parameterized
    )
  );

// ❌ Never done — string concatenation in SQL
const query = `SELECT * FROM articles WHERE organization_id = '${orgId}'`; // BANNED
```

**Additional protections:**
- ESLint rule bans raw `db.execute(sql`...${variable}...`)` without parameterization
- Database users have least-privilege access (no DROP TABLE, no schema modifications)
- Separate read-only database user for analytics queries
- PostgreSQL RLS adds an additional layer even if the application query is compromised

### 6.3 XSS Prevention

| Control | Implementation |
|---------|---------------|
| **React auto-escaping** | React escapes all JSX content by default; `dangerouslySetInnerHTML` is banned |
| **Content Security Policy** | `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'` |
| **HTTP-only cookies** | JWT tokens inaccessible to JavaScript even if XSS occurs |
| **Output encoding** | Context-aware encoding for HTML, URL, and JavaScript contexts |
| **Trusted Types** | Planned for Year 2 to further restrict DOM manipulation |

### 6.4 CSRF Prevention

| Control | Implementation |
|---------|---------------|
| **SameSite=Strict cookies** | Browser will not send cookies with cross-site requests |
| **Origin verification** | Server validates `Origin` and `Referer` headers on state-changing requests |
| **CSRF tokens** | Double-submit cookie pattern for forms that require it |
| **JSON content-type** | API requires `Content-Type: application/json` — HTML forms cannot set this |

### 6.5 Security Headers

All responses include:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store (for authenticated API responses)
```

### 6.6 File Upload Security

| Control | Standard |
|---------|---------|
| **MIME type whitelist** | Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`; Videos: `video/mp4`; Docs: `application/pdf` |
| **File size limit** | Images: 10 MB; Videos: 500 MB; Documents: 25 MB |
| **Content inspection** | Actual file header verified against declared MIME type |
| **Storage isolation** | All uploads stored in Cloudflare R2, not on application server |
| **Signed URL access** | Files accessed only via time-limited signed URLs (1 hour default) |
| **Filename sanitization** | Original filename stripped; UUID-based storage key used |
| **Virus scanning** | Planned for Year 2 via R2 Malware Scanning |

### 6.7 Error Handling Security

Errors must **never leak sensitive information to API responses**:

```typescript
// ✅ What the API response contains
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested article could not be found.",
    "details": { "articleId": "art_invalid" }
  }
}

// ✅ What the structured log contains (never in API response)
{
  "level": "error",
  "message": "Article lookup failed",
  "articleId": "art_invalid",
  "organizationId": "org_7e3b2c",
  "sqlError": "relation \"articles\" does not exist", // ← only in logs
  "stack": "Error: relation...\n  at ...",           // ← only in logs
  "requestId": "req_abc123"
}
```

**Rules:**
- No database error messages in API responses
- No stack traces in production API responses
- No internal file paths in API responses
- No other organization's data in error details
- All unexpected errors return a generic 500 with only a `requestId` for correlation

### 6.8 Dependency Security

| Control | Tool | Frequency |
|---------|------|-----------|
| Vulnerability scanning | Snyk + `bun audit` | Every PR + weekly automated |
| Container image scanning | Trivy | Every Docker build |
| Dependency review | Manual Engineering Lead review | Before any new dependency added |
| SBOM (Software Bill of Materials) | Generated by CI | Every release |
| Security advisories | GitHub Dependabot alerts | Continuous monitoring |
| Update policy | Patch: automated; Minor: deliberate; Major: ADR required | Ongoing |

**CVE Response SLA:**

| Severity | Response Time |
|----------|--------------|
| CRITICAL (CVSS 9.0–10.0) | <24 hours |
| HIGH (CVSS 7.0–8.9) | <3 days |
| MEDIUM (CVSS 4.0–6.9) | <1 week |
| LOW (CVSS 0.1–3.9) | <1 month |

---

## 7. Infrastructure Security

### 7.1 Network Architecture

```
Internet
    │
    ▼
Cloudflare (DDoS protection, WAF, TLS termination, CDN)
    │
    ▼
WireGuard VPN (admin access only — public-key authentication)
    │
    ▼
UFW Firewall (deny all except ports 80, 443, WireGuard UDP 51820)
    │
    ▼
Nginx (reverse proxy, SSL termination, request logging, rate limiting)
    │
    ▼
Bun application process (TanStack Start + Hono)
    │
    ├── PostgreSQL (internal only — no public port)
    ├── SQLite cache (in-process)
    └── Cloudflare R2 (signed URL access via HTTPS)
```

**Network security principles:**
- **No direct database access** from the internet — PostgreSQL listens only on localhost
- **WireGuard VPN for all admin access** — SSH, database management, Coolify UI, Grafana
- **Public key only** — no password authentication for SSH or WireGuard
- **Deny by default** — UFW drops all traffic except explicitly allowed ports
- **Cloudflare WAF** — OWASP Core Rule Set + custom rules for Nigerian traffic patterns

### 7.2 Server Security

| Control | Implementation |
|---------|---------------|
| **OS** | Ubuntu 22.04 LTS (5-year security support to 2027) |
| **Automatic security updates** | `unattended-upgrades` for critical patches; controlled updates for major versions |
| **SSH hardening** | Port changed from 22; `PasswordAuthentication no`; `PermitRootLogin no`; only VPN access |
| **Fail2ban** | Blocks IPs after repeated SSH failures |
| **Non-root application** | Application process runs as dedicated `nawebeus` user |
| **Read-only file system** | Application code directory is read-only; writable directories are explicitly scoped |
| **Audit daemon** | Linux auditd logs all system-level access |
| **Time synchronization** | NTP synchronized (required for JWT validation and TOTP) |

### 7.3 Container Security

| Control | Implementation |
|---------|---------------|
| **Minimal base image** | `oven/bun:1-alpine` — minimal Alpine Linux |
| **Non-root user** | Container runs as `nawebeus` user (UID 1001) |
| **No shell** | Production images built without bash/sh where possible |
| **Image scanning** | Trivy scans every built image in CI |
| **Immutable containers** | No runtime modifications; new deployments use new images |
| **Read-only root filesystem** | `/tmp` and application data directories explicitly mounted as writable |
| **No privileged mode** | `--privileged` is never used |
| **Resource limits** | CPU and memory limits set in Docker Compose / deployment config |

### 7.4 Database Security

| Control | Implementation |
|---------|---------------|
| **Network isolation** | PostgreSQL binds to `127.0.0.1` only; not accessible from internet |
| **SSL connections** | `sslmode=require` for all application connections |
| **Least-privilege users** | Application user: `SELECT, INSERT, UPDATE, DELETE` only; no DDL |
| **Read-only analytics user** | Separate user with `SELECT` only for report generation |
| **Row-Level Security** | RLS policies on all multi-tenant tables (see Section 4.4) |
| **Connection pooling** | PgBouncer in transaction mode; limits max connections to DB |
| **Query logging** | Slow queries (>200ms) logged at WARN level |
| **Regular backups** | Full daily + WAL continuous archiving (see Backup Strategy) |

---

## 8. Security Logging and Monitoring

### 8.1 Security Events Logged

All security events are logged as structured JSON with consistent fields:

```json
{
  "level": "warn",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "event": "auth.login.failed",
  "userId": "usr_9f2a4b6c",
  "organizationId": "org_7e3b2c1d",
  "ipAddress": "197.210.55.23",
  "userAgent": "Mozilla/5.0...",
  "reason": "invalid_password",
  "failedAttemptCount": 3,
  "requestId": "req_abc123def456"
}
```

**Security event categories:**

| Category | Events Logged |
|----------|--------------|
| **Authentication** | Login success/failure, logout, password reset, token refresh, token revocation |
| **Authorization** | Permission denials, role-based access checks (denials), cross-org access attempts |
| **Account management** | Account lockout, MFA enable/disable, role change, invitation, suspension, deletion |
| **Data operations** | Bulk data export, DSAR request submission, data deletion |
| **Billing (₦)** | Subscription change, ₦ payment processed, payment failed, plan upgrade/downgrade |
| **Crisis operations** | Crisis incident created, severity changed, response published |
| **Admin actions** | System configuration change, impersonation session, audit log access |
| **Security events** | Rate limit exceeded, RLS policy violation attempt, webhook signature failure |

**What is NEVER logged:**
- Passwords or password hashes
- JWT access tokens or refresh tokens
- Social platform OAuth tokens
- Paystack API keys or webhook secrets
- TOTP codes or MFA secrets
- User PII (email, phone) at INFO level or above in production
- Any other secrets or credentials

### 8.2 Security Monitoring and Alerting

| Event | Threshold | Alert Action |
|-------|-----------|-------------|
| Failed logins — single account | 5 in 15 minutes | Lock account; send email alert to user |
| Failed logins — single IP | 20 in 5 minutes | Block IP for 30 minutes; alert security team |
| Cross-organization access attempt | Any | Immediate alert to security team; audit log entry |
| Rate limit breaches | 100 in 1 hour from same user | Investigate; potential API abuse alert |
| Unusual bulk data export | >10,000 records in single export | Alert security team |
| New admin or owner added | Any | Email alert to all existing admins |
| MFA disabled by admin on a user | Any | Email alert to the affected user |
| Paystack webhook signature failure | Any | Alert engineering; potential replay attack |
| Database connection errors | >10 in 5 minutes | Alert operations team |
| RLS policy violation | Any (should be impossible) | Immediate critical alert |

### 8.3 Audit Log

The audit log is the authoritative record of all state changes on the platform.

**Properties:**
- **Append-only** — rows are never updated or deleted (enforced by database trigger)
- **Tamper-evident** — each entry includes an HMAC of its contents
- **Comprehensive** — covers CREATE, UPDATE, DELETE, and sensitive READ operations
- **Retained for 7 years** — NDPR compliance requirement
- **Encrypted at rest** — stored with AES-256 encryption
- **Queryable** — Engineering Lead and Compliance Officer can query; paginated results

**Audit log entry fields:**

```json
{
  "id": "aud_9a1b3c4d5e6f7g8h",
  "action": "crisis.response.published",
  "actorUserId": "usr_9f2a4b6c",
  "actorOrganizationId": "org_7e3b2c1d",
  "resourceType": "crisis_response",
  "resourceId": "rsp_5e6f7a8b",
  "changes": {
    "before": { "status": "approved" },
    "after": { "status": "published", "platforms": ["twitter", "instagram"] }
  },
  "reason": "Severity 4 crisis — emergency approval completed",
  "ipAddress": "197.210.55.23",
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
  "checksum": "sha256:abc123...",
  "timestamp": "2026-07-21T10:30:00.000Z"
}
```

---

## 9. Compliance

### 9.1 NDPR (Nigeria Data Protection Regulation) — Primary

NDPR compliance is the **most critical regulatory requirement** for Nawebeus because we serve Nigerian organizations and process Nigerian users' data.

| Requirement | Implementation |
|-------------|---------------|
| **Data sovereignty** | VPS hosted in Nigeria (Lagos or Abuja); data does not leave Nigeria by default |
| **Lawful basis for processing** | Contract (service delivery), Consent (marketing), Legitimate interest (security) |
| **Data subject access requests** | Automated DSAR workflow — fulfilled within 30 days |
| **Right to erasure** | Account deletion workflow with 30-day grace period |
| **Data portability** | JSON export of all user data via Settings |
| **Breach notification** | Notify NITDA within 72 hours; notify affected users without undue delay |
| **Data Protection Officer** | DPO designated; contact information in privacy policy |
| **Records of processing** | Data inventory maintained and updated quarterly |
| **Third-party processors** | Data Processing Agreements with all vendors (Cloudflare, Paystack, Sentry, etc.) |
| **Consent management** | Explicit opt-in for marketing; consent records stored in database |
| **NDPR audit** | Annual compliance review; records available to NITDA on request |

### 9.2 GDPR (General Data Protection Regulation)

| Data Subject Right | Implementation |
|-------------------|---------------|
| **Right to access** | Self-service data export in JSON format (within 30 days) |
| **Right to rectification** | In-app profile editing; contact support for data not self-editable |
| **Right to erasure ("right to be forgotten")** | Account deletion workflow — data purged within 30 days |
| **Right to restrict processing** | Account suspension option; contact DPO for partial restrictions |
| **Right to data portability** | Machine-readable JSON export of all personal data |
| **Right to object** | Opt-out of marketing; object to legitimate interest processing via DPO |
| **Rights related to automated decisions** | No fully automated decisions affecting users; human review available |

### 9.3 CCPA (California Consumer Privacy Act)

| Requirement | Implementation |
|-------------|---------------|
| **Right to know** | Privacy policy discloses all data collection; in-app data view |
| **Right to delete** | Account deletion workflow; data purged within 45 days |
| **Right to opt-out of sale** | We do not sell personal data; "Do Not Sell" link in footer |
| **Right to non-discrimination** | No service degradation for rights exercise |

### 9.4 Data Retention Policies

| Data Type | Default Retention | Action on Expiry | Configurable |
|-----------|-----------------|-----------------|-------------|
| User account data | Account lifetime + 30 days | Permanent deletion | No |
| Social media mentions | 2 years | Soft delete + archive | Yes |
| Media articles | 3 years | Archive | Yes |
| Conversation messages | 2 years | Archive | Yes |
| Analytics and aggregates | 3 years raw; 7 years aggregate | Purge raw; keep aggregate | Yes |
| Audit logs | 7 years | No action (legally required) | No |
| ₦ Invoice records | 7 years (Nigerian tax law) | Archive | No |
| Press releases (distributed) | 7 years (legal record) | Archive | No |
| Backup files | 30 days | Automatic overwrite | Yes (30–90 days) |
| Export files (generated) | 24 hours | Auto-delete | No |
| DSAR packages | 7 days after delivery | Auto-delete | No |
| Login attempt records | 90 days | Purge | No |

### 9.5 DSAR (Data Subject Access Request) Workflow

```
1. User submits DSAR via Settings > Privacy > Request My Data
2. System creates dsar_requests record with 30-day due_date
3. User identity verified (re-authentication required)
4. System automatically collects all user data across all tables
5. Engineering review: check for third-party data that cannot be included
6. System packages data as encrypted ZIP (JSON format)
7. User receives download link (7-day expiry)
8. DSAR marked complete; link expires and file deleted
9. Audit log entry created for compliance record
```

---

## 10. Third-Party Security

### 10.1 Vendor Security Assessment Criteria

Before any third-party service receives access to Nawebeus data:

| Criterion | Requirement |
|-----------|------------|
| **Security certifications** | SOC 2 Type II, ISO 27001, or equivalent |
| **Data protection** | GDPR, NDPR, CCPA compliance |
| **Encryption** | Encryption at rest and in transit |
| **Data residency** | Ability to restrict data to Nigeria or adequate jurisdictions |
| **Incident response** | Documented IR process; breach notification within 72 hours |
| **Subprocessors** | Disclosed and assessed |
| **Data Processing Agreement** | Signed DPA before any data transfer |
| **Security questionnaire** | Completed for Tier 1 vendors |
| **Right to audit** | Contractual right to audit (Tier 1 vendors) |

### 10.2 Current Vendor Security Status

| Vendor | Service | Security Certifications | DPA | Data Residency |
|--------|---------|------------------------|-----|----------------|
| **Cloudflare** | DDoS, WAF, DNS, CDN | SOC 2 Type II, ISO 27001, PCI DSS | ✅ Signed | Configurable (Nigerian IP routing) |
| **Paystack** | ₦ Payments | SOC 2 Type II, PCI DSS Level 1 | ✅ Signed | Nigeria + encrypted global |
| **Cloudflare R2** | File storage | SOC 2 Type II, ISO 27001 | ✅ Cloudflare DPA | Configurable region |
| **Backblaze B2** | Backup storage | SOC 2 Type II | ✅ Signed | EU region (adequacy) |
| **Sentry** | Error tracking | SOC 2 Type II, ISO 27001 | ✅ Signed | EU region |
| **GitHub** | Version control, CI/CD | SOC 2 Type II, ISO 27001 | ✅ GitHub DPA | US (adequacy) |
| **AWS SES (via Nodemailer)** | Transactional email | SOC 2 Type II, ISO 27001 | ✅ AWS DPA | EU region |
| **Twitter/X API** | Social data | Per X ToS; SOC 2 | ✅ X DPA | X's infrastructure |
| **Meta (Instagram/Facebook) API** | Social data | Per Meta ToS; SOC 2 | ✅ Meta DPA | Meta's infrastructure |
| **LinkedIn API** | Social data | Per LinkedIn ToS; SOC 2 | ✅ LinkedIn DPA | LinkedIn's infrastructure |
| **TikTok API** | Social data | Per TikTok ToS | 🔄 In progress | TikTok's infrastructure |

### 10.3 Paystack-Specific Security

Since Paystack processes all ₦ billing transactions, additional security controls apply:

| Control | Implementation |
|---------|---------------|
| **No card data handled** | Paystack Popup JS handles card entry on Paystack's PCI-DSS-certified servers |
| **Webhook signature verification** | HMAC-SHA512 with `X-Paystack-Signature` header |
| **Idempotency** | Each webhook event processed at most once (idempotency key in database) |
| **Timestamp validation** | Webhooks older than 300 seconds are rejected (replay attack prevention) |
| **Webhook secret rotation** | Annual rotation; immediate rotation on suspected compromise |
| **Authorization code encryption** | Paystack authorization codes stored encrypted (AES-256) |
| **Amount validation** | Server-side verification that ₦ amount matches expected subscription price |

---

## 11. Incident Response

### 11.1 Incident Severity Classification

| Severity | Definition | Examples | Response Time | Escalation |
|----------|-----------|---------|--------------|------------|
| **P0 — Critical** | Active security breach; data loss; service completely down; financial fraud | Multi-tenant RLS bypass; database exfiltration; Paystack key compromise; ransom attack | Immediate — on-call engineer paged within 5 minutes | Engineering Lead + Security Lead + CEO within 15 minutes |
| **P1 — High** | Confirmed security incident with limited confirmed impact; major feature down | Unauthorized access to one org's data; social token theft; service degraded >50% | <1 hour | Engineering Lead + Security Lead within 30 minutes |
| **P2 — Medium** | Potential security concern; no confirmed data impact; feature significantly degraded | Suspicious access pattern; unpatched HIGH CVE found; service degraded <50% | <4 hours | Engineering Lead within 2 hours |
| **P3 — Low** | Minor security concern; no impact; cosmetic issue | Policy violation; LOW CVE; minor misconfiguration | <1 business day | Engineering Lead review |

### 11.2 Incident Response Process

```
1. DETECTION (Alert / User report / Monitoring)
   → Security event triggers Sentry alert or Grafana alert
   → On-call engineer receives PagerDuty notification
         │
         ▼
2. TRIAGE (Assess severity P0–P3)
   → Confirm the incident is real (not false alarm)
   → Classify severity using criteria above
   → For P0/P1: immediately notify Security Lead and Engineering Lead
         │
         ▼
3. CONTAINMENT (Stop ongoing damage)
   → P0: Consider taking affected service offline
   → Revoke compromised credentials (JWT signing key, API keys)
   → Block attacking IPs at Cloudflare WAF
   → Isolate affected organization accounts if needed
   → Preserve all logs and evidence before any remediation
         │
         ▼
4. INVESTIGATION (Identify root cause)
   → Analyze audit logs, security logs, access logs
   → Determine: what data was accessed, by whom, how
   → Timeline reconstruction using requestIds
   → Collect evidence for potential legal proceedings
         │
         ▼
5. ERADICATION (Remove the threat)
   → Patch the vulnerability (hotfix branch, expedited review)
   → Rotate all compromised credentials
   → Remove any attacker persistence (backdoors, rogue users)
   → Verify the threat is fully removed
         │
         ▼
6. RECOVERY (Restore normal operations)
   → Restore from clean backup if data was corrupted
   → Re-enable services once security is confirmed
   → Monitor closely for 24 hours post-recovery
   → Validate all data integrity
         │
         ▼
7. NOTIFICATION (Required communications)
   → Internal: all employees within 4 hours of P0/P1
   → Affected organizations: within 24 hours
   → NITDA (NDPR): within 72 hours if personal data involved
   → GDPR DPA: within 72 hours if EU subjects affected
   → Law enforcement: as legally required
         │
         ▼
8. POST-MORTEM (Learn and improve)
   → Blameless post-mortem within 48 hours of resolution
   → Document timeline, root cause, lessons learned
   → Create action items with owners and deadlines
   → Share learnings with engineering team
```

### 11.3 Incident Response Team

| Role | Responsibility |
|------|---------------|
| **Incident Commander** (Security Lead) | Overall incident coordination; decision authority; stakeholder communication |
| **Technical Lead** (Engineering Lead) | Technical investigation; system remediation; code fixes |
| **Communications Lead** (CEO / COO) | Customer communications; media response; regulatory notifications |
| **Legal / Compliance** (Legal Director) | Regulatory requirements; breach notification obligations; evidence preservation |
| **On-Call Engineer** | First responder; initial triage; escalation |

### 11.4 Breach Notification Timeline

| Audience | Timing | Content Required |
|----------|--------|-----------------|
| **Security Lead** (internal) | Within 15 minutes of P0/P1 confirmation | Nature of breach; estimated scope |
| **Engineering Lead** (internal) | Within 30 minutes | Technical details; containment options |
| **CEO/COO** (internal) | Within 1 hour of P0/P1 | Business impact; communication plan |
| **All employees** (internal) | Within 4 hours | What happened (appropriate detail level) |
| **Affected organizations** | Within 24 hours | Nature of breach; categories of data; actions taken |
| **NITDA** (NDPR regulator) | Within 72 hours | Formal breach notification with all NDPR-required fields |
| **GDPR DPA** | Within 72 hours (if EU subjects) | GDPR Article 33 notification |
| **Affected individual users** | Without undue delay (after regulator notification) | Clear explanation; actions recommended |
| **Public disclosure** | Only as legally required or if legally authorized | Via designated spokesperson only |

### 11.5 Post-Mortem Template

Post-mortems are **blameless** — the goal is systemic improvement, not individual accountability.

```markdown
## Security Incident Post-Mortem: {Title}

**Date (WAT):** {Date}
**Severity:** P{0/1/2/3}
**Duration:** {Start WAT} — {End WAT} ({duration})
**Incident Commander:** {Name}
**Affected Organizations:** {Count and type}

### Impact Summary
{What data, services, or users were affected; quantify where possible}

### Timeline (all times WAT)
| Time | Event |
|------|-------|
| {HH:MM} | {Event description} |

### Root Cause
{Single paragraph — the specific technical or process failure}

### What Went Well
- {Item}

### What Went Poorly
- {Item}

### Action Items
| Action | Owner | Priority | Due Date |
|--------|-------|---------|---------|
| {Specific technical improvement} | {Name} | P{0-3} | {Date} |
```

---

## 12. Vulnerability Management

### 12.1 Vulnerability Scanning Schedule

| Scan Type | Frequency | Tool | Who Reviews |
|-----------|-----------|------|-------------|
| Dependency vulnerability scan | Every PR + weekly | Snyk + `bun audit` | Engineering Lead |
| Static Application Security Testing (SAST) | Every PR | ESLint security plugins + Semgrep | Engineering Lead |
| Container image scanning | Every Docker build | Trivy | Engineering Lead |
| Infrastructure scanning | Monthly | Lynis (Linux hardening) | Security Lead |
| Dynamic Application Security Testing (DAST) | Monthly (staging) | OWASP ZAP | Security Lead |
| External penetration test | Annually (Year 1); Quarterly (Year 2+) | External security firm | Security Lead + Engineering Lead |
| Red team exercise | Annually (Year 2+) | External red team | Security Lead |

### 12.2 Penetration Testing Scope

Annual penetration test covers:
- API authentication and authorization bypass
- Multi-tenant isolation (IDOR attacks)
- SQL injection and other injection attacks
- XSS and content injection
- CSRF protection
- Rate limiting bypass
- JWT manipulation
- Paystack webhook replay attacks
- File upload bypass
- Infrastructure access (network, server)

### 12.3 Bug Bounty Program

**Status:** Planned for Year 2 (2027) after SOC 2 Type II certification.

**Scope (when launched):** Web application, mobile app, API — all within Nawebeus.com domain.

**Exclusions:** Social engineering, physical attacks, DoS/DDoS, third-party services.

---

## 13. Security Training

### 13.1 Training Requirements by Role

| Training | Audience | Frequency | Completion Requirement |
|---------|---------|-----------|----------------------|
| Security awareness fundamentals | All staff | Annual + onboarding | 100% completion |
| Phishing simulation | All staff | Quarterly | Participate + remediation if failed |
| Data privacy and NDPR/GDPR | All staff | Annual | 100% completion |
| OWASP Top 10 | Engineering team | Annual | 100% completion |
| Secure coding practices | Engineering team | Annual | 100% completion |
| Incident response procedures | Engineering + Security team | Semi-annual drill | 100% participation |
| Advanced threat modeling | Engineering Lead + Security Lead | Annual | Completion |

### 13.2 Security Champion Program (Year 2)

Each engineering squad designates a **Security Champion** who:
- Reviews security aspects of PRs for their squad
- Represents security in sprint planning
- Escalates security concerns to the Security Lead
- Shares security knowledge within their squad
- Completes additional security training (quarterly)

---

## 14. Security Metrics and KPIs

### 14.1 Security Performance Metrics

| Metric | Target | Measurement Source |
|--------|--------|--------------------|
| Security incidents (P0) | 0 per year | Incident log |
| Security incidents (P1) | <2 per year | Incident log |
| Mean time to detect (MTTD) | <1 hour for P0/P1 | Monitoring timestamps |
| Mean time to respond (MTTR) | <4 hours for P1; immediate for P0 | Incident log |
| CRITICAL CVE remediation time | <24 hours | Snyk + deployment log |
| HIGH CVE remediation time | <3 business days | Snyk + deployment log |
| Security training completion | 100% | Training platform |
| Phishing simulation failure rate | <5% of employees | Simulation tool |
| MFA adoption — Owners/Admins | 100% (enforced) | Auth logs |
| MFA adoption — All users | >60% | Auth logs |
| Failed login rate (per day) | <1% of total login attempts | Auth logs |
| Unauthorized access attempts blocked | >99% | WAF + rate limit logs |
| Patch compliance (critical patches) | 100% within 24 hours | Patch management |

### 14.2 Compliance Metrics

| Metric | Target | Measurement Source |
|--------|--------|--------------------|
| NDPR compliance score | 100% | Annual compliance audit |
| GDPR compliance score | 100% | Annual compliance audit |
| DSAR fulfillment rate | 100% within 30 days | DSAR log |
| Breach notification time (NITDA) | <72 hours | Incident log |
| Audit log completeness | 100% of state-changing operations | Audit log coverage tests |
| Data retention policy adherence | 100% | Automated retention job logs |
| Vendor DPA coverage | 100% of data processors | Vendor registry |

---

## 15. Security Roadmap

### 15.1 Year 1 (2026) — Foundation

| Quarter | Deliverable | Status |
|---------|------------|--------|
| Q3 2026 | Multi-tenant RLS isolation + automated isolation tests | ✅ Planned |
| Q3 2026 | JWT authentication + MFA (TOTP) | ✅ Planned |
| Q3 2026 | CASL RBAC at API + service + DB layers | ✅ Planned |
| Q3 2026 | AES-256 encryption for social tokens and MFA secrets | ✅ Planned |
| Q3 2026 | Comprehensive audit logging (7-year retention) | ✅ Planned |
| Q3 2026 | Rate limiting (SQLite sliding window) | ✅ Planned |
| Q3 2026 | NDPR / GDPR / CCPA compliance controls | ✅ Planned |
| Q3 2026 | Paystack webhook signature verification | ✅ Planned |
| Q4 2026 | Security monitoring dashboards (Grafana) | 🗓 Planned |
| Q4 2026 | Annual penetration test (external firm) | 🗓 Planned |
| Q4 2026 | Security awareness training program | 🗓 Planned |

### 15.2 Year 2 (2027) — Compliance and Enterprise

| Quarter | Deliverable |
|---------|------------|
| Q1 2027 | SOC 2 Type II gap analysis and remediation |
| Q1 2027 | Redis migration for distributed session/rate-limit store |
| Q2 2027 | SOC 2 Type II observation period begins |
| Q2 2027 | ISO 27001 ISMS implementation |
| Q2 2027 | Bug bounty program launch |
| Q2 2027 | Quarterly penetration testing cadence |
| Q3 2027 | SOC 2 Type II report issued |
| Q3 2027 | Certificate pinning for mobile apps |
| Q3 2027 | Advanced threat detection (anomaly-based) |
| Q4 2027 | ISO 27001 certification audit |
| Q4 2027 | Security Champion program launched |

### 15.3 Year 3 (2028) — Advanced Security

| Deliverable | Description |
|------------|-------------|
| AI-powered threat detection | Behavioral analytics for insider threat and account compromise detection |
| Zero-trust network architecture | Service mesh with mutual TLS between all internal services |
| Hardware Security Modules (HSM) | Hardware-backed key management for most sensitive keys |
| Advanced fraud detection | ML-based fraud detection for campaign entries and billing |
| Confidential computing | Trusted execution environments for most sensitive data processing |

---

## 16. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Security Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Legal Director | _________________ | _________ | _______ |
| CEO / CTO | _________________ | _________ | _______ |

---

## 17. Related Documents

| Document | Relationship |
|----------|-------------|
| **Architecture** | System architecture that security controls are built upon |
| **ADRs** | ADR-010 (JWT auth), ADR-006 (CASL RBAC), ADR-009 (multi-tenant RLS), ADR-008 (VPS + WireGuard) |
| **Engineering Standards** | Secure coding standards, dependency management, secret management practices |
| **Database Schema** | RLS policies, audit log schema, PII field inventory |
| **QA Strategy** | Security testing procedures, penetration test coverage, multi-tenant isolation tests |
| **Infrastructure Runbook** | VPS hardening, backup encryption, WireGuard VPN setup, incident response procedures |
| **API Reference** | Authentication endpoints, webhook signature verification, rate limit documentation |
| **Personas** | User types whose data this security architecture protects |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Security Lead & Engineering Lead | Unified and expanded Security Architecture document. Merges and improves both source documents into a single comprehensive reference. Adds: Nigerian data sovereignty as a first-class security principle, NDPR as the primary compliance framework with detailed implementation, Paystack-specific security controls (₦ webhook signature verification, authorization code encryption, ₦ amount server-side validation), WAT timezone in incident response timelines, complete DSAR workflow, expanded vendor security table with Paystack PCI DSS Level 1 certification, detailed multi-tenant isolation with SQL RLS examples, complete STRIDE analysis, attack vector likelihood/impact matrix, JWT payload with organizationId, detailed credential stuffing and phishing mitigations, complete breach notification timeline including NITDA (NDPR regulator), ₦ monetary validation in input validation section, and Year 1–3 security roadmap with quarterly milestones. |

---

*This document is owned by the Security Lead and reviewed quarterly, or immediately following any significant security incident or architectural change. All engineers must read this document before working on authentication, authorization, or data protection features.*