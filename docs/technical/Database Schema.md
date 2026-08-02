# Database Schema

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document defines the complete database schema for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It documents all tables, relationships, indexes, constraints, enums, materialized views, cache stores, and governance policies.

The schema is designed to support:

- **Multi-tenancy** with strict Row-Level Security (RLS) and application-level data isolation
- **High performance** through strategic indexing, connection pooling, and materialized views
- **NDPR / GDPR compliance** through data retention policies, audit logging, and DSAR support
- **Nigerian market specifics** — NGN (₦) as the default currency, WAT as the default timezone, Nigerian media source tracking
- **Horizontal scalability** — schema prepared for read replicas, sharding, and Elasticsearch migration

**Primary Database:** PostgreSQL 14+
**ORM:** Drizzle ORM
**Cache / Rate Limit Store:** SQLite via `bun:sql`
**Multi-tenancy:** Row-Level Security (RLS) + application-level filtering
**ID Format:** Prefixed text IDs (e.g., `usr_`, `org_`, `ment_`)
**Default Currency:** Nigerian Naira (₦ / NGN)
**Default Timezone:** WAT (West Africa Time, UTC+1)

---

## 2. Schema Conventions

### 2.1 Naming Conventions

| Element              | Convention                        | Example                                    |
| -------------------- | --------------------------------- | ------------------------------------------ |
| **Tables**           | `snake_case`, plural              | `users`, `organizations`, `media_mentions` |
| **Columns**          | `snake_case`                      | `user_id`, `created_at`, `is_active`       |
| **Primary keys**     | Prefixed text IDs                 | `usr_9f2a8b3c`, `org_1h2i3j4k`             |
| **Foreign keys**     | `{table_singular}_id`             | `organization_id`, `user_id`               |
| **Timestamps**       | `created_at`, `updated_at`        | All tables                                 |
| **Soft delete**      | `deleted_at` (nullable timestamp) | Optional per table                         |
| **Status columns**   | PostgreSQL ENUM                   | `campaign_status`, `user_status`           |
| **Boolean columns**  | `is_*` or `*_enabled` prefix      | `is_active`, `mfa_enabled`                 |
| **JSON columns**     | `JSONB` type                      | `metadata`, `settings`, `custom_fields`    |
| **Currency columns** | `NUMERIC(15,2)` in kobo/naira     | `amount_naira NUMERIC(15,2)`               |

### 2.2 ID Generation

All primary keys use prefixed text IDs generated from cryptographically secure random bytes:

```typescript
// lib/id.ts
import { base32 } from "./base32";

export function generateId(prefix: string): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  const id = base32.encode(randomBytes).toLowerCase();
  return `${prefix}_${id}`;
}

// Usage
const userId = generateId("usr"); // usr_9f2a8b3c4d5e6f7g
const orgId = generateId("org"); // org_1h2i3j4k5l6m7n8o
const mentId = generateId("ment"); // ment_7e3b4f2a9c1d5e8f
```

### 2.3 Complete ID Prefix Registry

| Prefix   | Table                     | Description                        |
| -------- | ------------------------- | ---------------------------------- |
| `usr_`   | users                     | User accounts                      |
| `org_`   | organizations             | Organization tenants               |
| `mem_`   | organization_members      | Org membership records             |
| `inv_`   | invitations               | Team invitations                   |
| `sess_`  | sessions                  | User sessions / refresh tokens     |
| `soc_`   | social_accounts           | Connected social platform accounts |
| `camp_`  | campaigns                 | Giveaway / engagement campaigns    |
| `entry_` | campaign_entries          | Campaign participant entries       |
| `win_`   | winners                   | Campaign winners                   |
| `qry_`   | listening_queries         | Social listening queries           |
| `ment_`  | mentions                  | Social mentions                    |
| `mtag_`  | mention_tags              | Tags applied to mentions           |
| `lalt_`  | listening_alerts          | Social listening alert rules       |
| `mcmp_`  | monitoring_campaigns      | Media monitoring campaigns         |
| `art_`   | articles                  | Media articles and coverage        |
| `ctc_`   | media_contacts            | Journalist / media contact CRM     |
| `pr_`    | press_releases            | Press release documents            |
| `out_`   | media_outreach            | Individual outreach records        |
| `cnv_`   | conversations             | Unified inbox conversations        |
| `msg_`   | messages                  | Individual messages                |
| `rtpl_`  | response_templates        | Engagement response templates      |
| `rrule_` | routing_rules             | Inbox routing rules                |
| `csat_`  | conversation_satisfaction | CSAT survey responses              |
| `dsh_`   | dashboards                | Custom dashboards                  |
| `rpt_`   | reports                   | Scheduled and custom reports       |
| `cm_`    | custom_metrics            | Custom KPI definitions             |
| `rrun_`  | report_runs               | Report generation run records      |
| `exp_`   | exports                   | Data export records                |
| `not_`   | notifications             | User notifications                 |
| `npref_` | notification_preferences  | Notification channel preferences   |
| `aud_`   | audit_log                 | Immutable audit log entries        |
| `aaud_`  | admin_audit_log           | Admin action audit log             |
| `dsar_`  | dsar_requests             | Data Subject Access Requests       |
| `lh_`    | legal_holds               | Legal hold records                 |
| `ret_`   | data_retention_policies   | Data retention policy definitions  |
| `ac_`    | app_config                | Merged: system config + feature flags |
| `bkp_`   | backup_records            | Backup run records                 |
| `imp_`   | impersonation_sessions    | Admin impersonation sessions       |
| `pm_`    | payment_methods           | Paystack payment method records    |
| `bill_`  | invoices                  | ₦ billing invoices                 |
| `sub_`   | subscriptions             | Active subscription records        |
| `use_`   | usage_tracking            | Usage metering records             |
| `quot_`  | api_quota_tracking        | API quota tracking                 |
| `tok_`   | email_verification_tokens | Email verification tokens          |
| `prt_`   | password_reset_tokens     | Password reset tokens              |
| `phis_`  | password_history          | Password history records           |
| `lat_`   | login_attempts            | Login attempt audit records        |
| `jrn_`   | journalists               | Journalist CRM records             |
| `int_`   | journalist_interactions   | Journalist interaction history     |
| `inf_`   | influencers               | Influencer profiles                |
| `icmp_`  | influencer_programs      | Influencer program records          |
| `prod_`  | products                  | Social commerce products           |
| `ord_`   | orders                    | Social commerce orders             |
| `ptag_`  | product_tags              | In-content product tags            |

### 2.4 Universal Column Conventions

Every table includes:

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

`updated_at` is maintained by a PostgreSQL trigger:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to every table:
CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON {table_name}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.5 Currency Convention

A short intro note you can drop into your schema docs / README:

---

## Money Handling Convention

All monetary values in the Gilo Business ecosystem — across both the mobile app (SQLite) and the backend (PostgreSQL) — are stored as **integers in the currency's smallest unit** (kobo for NGN), never as floats or decimals.

**Why:** Floating-point types (`real` in SQLite, `float`/`real` in Postgres) introduce rounding errors during storage and arithmetic — `19.99` can silently become `19.990000000000001`. This is unacceptable for financial data, where small errors compound across aggregate reports and can cause reconciliation mismatches.

**Convention:**

- Store all amounts as `integer` (or `bigint` if values may exceed ~2.1 billion kobo, i.e. ~₦21M) — never `real`, `float`, or `numeric` unless a specific case calls for arbitrary decimal precision.
- Never perform floating-point math directly against these columns. Treat the stored integer as an opaque unit — all arithmetic should happen in whole kobo.
- Display formatting (kobo → naira, decimal points, currency symbol) happens only at the presentation layer, via `formatNGN` on mobile (and its equivalent on web).
- If a table can hold multiple currencies, store the currency code alongside the amount column rather than assuming NGN implicitly.

**Do:**

```typescript
amountKobo: bigint("amount_kobo", { mode: "number" }).notNull(),
```

**Don't:**

```typescript
amount: real("amount"), // ❌ precision errors
```

This keeps the mobile (SQLite) and backend (Postgres) schemas symmetric — no unit conversion needed at the API boundary, and no drift between how money is represented on either side.

All monetary values are stored in **Nigerian Naira (₦)** using `BIGINT`:

```sql
-- Correct: store in naira with 2 decimal places
amount_naira       BIGINT NOT NULL,  -- ₦50,000.00
prize_value_naira  BIGINT NOT NULL,  -- ₦250,000.00
subscription_price BIGINT NOT NULL,  -- ₦150,000.00 per month
```

**Rationale:** Nawebeus prices exclusively in Nigerian Naira. Storing in kobo (smallest unit) is avoided because Nigerian amounts rarely require sub-naira precision, and BIGINT provides sufficient precision for all expected values.

---

## 3. Multi-Tenant Architecture

### 3.1 Multi-Tenancy Model

Nawebeus uses a **shared database, shared schema** multi-tenancy model with defense in depth at three independent layers:

| Layer                     | Mechanism                                    | What it catches                                        |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| **Database (Layer 1)**    | PostgreSQL Row-Level Security (RLS)          | Application bugs that pass the wrong `organization_id` |
| **Application (Layer 2)** | Middleware validates user ∈ organization     | Missing or spoofed organization context                |
| **Service (Layer 3)**     | `organizationId` as required typed parameter | Code that forgets to scope queries                     |

### 3.2 Row-Level Security Implementation

```sql
-- Enable RLS on every multi-tenant table
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY campaigns_tenant_isolation_select ON campaigns
  FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id', true));

-- INSERT policy
CREATE POLICY campaigns_tenant_isolation_insert ON campaigns
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true));

-- UPDATE policy
CREATE POLICY campaigns_tenant_isolation_update ON campaigns
  FOR UPDATE
  USING (organization_id = current_setting('app.current_organization_id', true));

-- DELETE policy
CREATE POLICY campaigns_tenant_isolation_delete ON campaigns
  FOR DELETE
  USING (organization_id = current_setting('app.current_organization_id', true));
```

The middleware sets the organization context at the start of every request:

```typescript
// server/middleware/tenant.ts
await db.execute(
  sql`SELECT set_config('app.current_organization_id', ${organizationId}, true)`,
);
```

### 3.3 Tables with Multi-Tenant RLS

The following tables have `organization_id NOT NULL` with RLS enabled:

```
organizations_members    campaigns              listening_queries
mentions                 mention_tags           listening_alerts
monitoring_campaigns     articles               media_contacts
press_releases           media_outreach         conversations
messages                 response_templates     routing_rules
conversation_satisfaction dashboards            reports
custom_metrics           report_runs            exports
notifications            notification_preferences
payment_methods          invoices               subscriptions
usage_tracking           api_quota_tracking     social_accounts
dsar_requests            data_retention_policies
app_config
journalists              journalist_interactions
influencers              influencer_programs
products                 orders                 product_tags
```

---

## 4. Core Tables

### 4.1 users

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
  phone                     VARCHAR(20),
  avatar_url                TEXT,
  timezone                  VARCHAR(100) DEFAULT 'Africa/Lagos',  -- WAT default
  language                  VARCHAR(10) DEFAULT 'en',
  bio                       TEXT,
  job_title                 VARCHAR(100),
  department                VARCHAR(100),
  mfa_enabled               BOOLEAN DEFAULT FALSE,
  mfa_secret_encrypted      TEXT,
  mfa_backup_codes_hashed   TEXT[],
  failed_login_count        INTEGER DEFAULT 0,
  locked_until              TIMESTAMPTZ,
  last_login_at             TIMESTAMPTZ,
  last_login_ip             INET,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'pending_deletion', 'deleted')),
  deletion_requested_at     TIMESTAMPTZ,
  deletion_scheduled_at     TIMESTAMPTZ,
  settings                  JSONB,                          -- UI preferences, notification settings
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deletion_scheduled ON users(deletion_scheduled_at)
  WHERE status = 'pending_deletion';
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);
```

### 4.2 organizations

```sql
CREATE TABLE organizations (
  id                        VARCHAR(32) PRIMARY KEY,
  name                      VARCHAR(100) NOT NULL,
  slug                      VARCHAR(50) UNIQUE NOT NULL,
  logo_url                  TEXT,
  industry                  VARCHAR(50),
  website                   VARCHAR(255),
  size                      INTEGER,                        -- employee count
  address                   JSONB,
  timezone                  VARCHAR(100) DEFAULT 'Africa/Lagos',
  language                  VARCHAR(10) DEFAULT 'en',
  currency                  VARCHAR(3) DEFAULT 'NGN',       -- Nigerian Naira
  billing_email             VARCHAR(255),
  tax_id                    VARCHAR(50),                    -- Nigerian TIN / CAC number
  business_phone            VARCHAR(20),
  -- Subscription
  plan_tier                 VARCHAR(20) DEFAULT 'starter'
                            CHECK (plan_tier IN ('starter', 'growth', 'professional', 'enterprise', 'agency')),
  subscription_status       VARCHAR(20) DEFAULT 'trial'
                            CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  trial_ends_at             TIMESTAMPTZ,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT FALSE,
  canceled_at               TIMESTAMPTZ,
  -- Paystack (Nigerian payment processor)
  paystack_customer_id      VARCHAR(255),
  paystack_subscription_id  VARCHAR(255),
  -- Agency white-label settings
  white_label_settings      JSONB,
  -- Feature access
  feature_overrides         JSONB,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_orgs_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_plan_tier ON organizations(plan_tier);
CREATE INDEX idx_orgs_subscription_status ON organizations(subscription_status);
CREATE INDEX idx_orgs_paystack_customer ON organizations(paystack_customer_id);
CREATE INDEX idx_orgs_trial_ends ON organizations(trial_ends_at)
  WHERE subscription_status = 'trial';
CREATE INDEX idx_orgs_created_at ON organizations(created_at DESC);
```

### 4.3 organization_members

```sql
CREATE TABLE organization_members (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL
                    CHECK (role IN ('owner', 'admin', 'manager', 'creator', 'analyst', 'viewer')),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by        VARCHAR(32) REFERENCES users(id),
  invited_at        TIMESTAMPTZ,
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at    TIMESTAMPTZ,
  last_active_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY org_members_isolation ON organization_members
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
CREATE INDEX idx_org_members_status ON organization_members(organization_id, status);
```

### 4.4 sessions

```sql
CREATE TABLE sessions (
  id                  VARCHAR(32) PRIMARY KEY,
  user_id             VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          VARCHAR(255) UNIQUE NOT NULL,         -- bcrypt hash of refresh token
  ip_address          INET,
  user_agent          TEXT,
  device_type         VARCHAR(20),
  os                  VARCHAR(50),
  browser             VARCHAR(50),
  location_city       VARCHAR(100),
  location_country    VARCHAR(2),
  is_trusted_device   BOOLEAN DEFAULT FALSE,
  expires_at          TIMESTAMPTZ NOT NULL,
  last_active_at      TIMESTAMPTZ DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ,
  revoke_reason       VARCHAR(50),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_active ON sessions(user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;
```

### 4.5 invitations

```sql
CREATE TABLE invitations (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  role                VARCHAR(20) NOT NULL
                      CHECK (role IN ('admin', 'manager', 'creator', 'analyst', 'viewer')),
  token_hash          VARCHAR(255) UNIQUE NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by          VARCHAR(32) NOT NULL REFERENCES users(id),
  personal_message    TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  accepted_at         TIMESTAMPTZ,
  accepted_by         VARCHAR(32) REFERENCES users(id),
  revoked_at          TIMESTAMPTZ,
  revoked_by          VARCHAR(32) REFERENCES users(id),
  resend_count        INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_isolation ON invitations
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token_hash);
CREATE INDEX idx_invitations_status ON invitations(status, expires_at);
```

---

## 5. Authentication Tables

### 5.1 email_verification_tokens

```sql
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
CREATE INDEX idx_evt_expires ON email_verification_tokens(expires_at)
  WHERE used_at IS NULL;
```

### 5.2 password_reset_tokens

```sql
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
```

### 5.3 password_history

```sql
CREATE TABLE password_history (
  id              VARCHAR(32) PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ph_user ON password_history(user_id, created_at DESC);
```

### 5.4 login_attempts

```sql
CREATE TABLE login_attempts (
  id              VARCHAR(32) PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  user_id         VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  ip_address      INET,
  user_agent      TEXT,
  success         BOOLEAN NOT NULL,
  failure_reason  VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_la_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_la_ip ON login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_la_user ON login_attempts(user_id, created_at DESC);
```

---

## 6. Social Accounts Tables

### 6.1 social_accounts

```sql
CREATE TABLE social_accounts (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform                  VARCHAR(20) NOT NULL
                            CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'reddit')),
  platform_user_id          VARCHAR(255) NOT NULL,
  platform_username         VARCHAR(100) NOT NULL,
  display_name              VARCHAR(100),
  profile_image_url         TEXT,
  follower_count            INTEGER DEFAULT 0,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'error', 'paused', 'needs_reauth', 'disconnected')),
  access_token_encrypted    TEXT NOT NULL,
  refresh_token_encrypted   TEXT,
  token_expires_at          TIMESTAMPTZ,
  scopes                    TEXT[],
  connected_by              VARCHAR(32) NOT NULL REFERENCES users(id),
  connected_at              TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at           TIMESTAMPTZ,
  disconnected_by           VARCHAR(32) REFERENCES users(id),
  last_sync_at              TIMESTAMPTZ,
  last_error_at             TIMESTAMPTZ,
  last_error_message        TEXT,
  error_count               INTEGER DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_user_id)
);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY social_accounts_isolation ON social_accounts
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_sa_org ON social_accounts(organization_id);
CREATE INDEX idx_sa_status ON social_accounts(organization_id, status);
CREATE INDEX idx_sa_platform ON social_accounts(organization_id, platform);
CREATE INDEX idx_sa_sync ON social_accounts(last_sync_at) WHERE status = 'active';
```

### 6.2 api_quota_tracking

```sql
CREATE TABLE api_quota_tracking (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform        VARCHAR(20) NOT NULL,
  quota_type      VARCHAR(50) NOT NULL,
  quota_limit     INTEGER NOT NULL,
  quota_used      INTEGER DEFAULT 0,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  resets_at       TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) DEFAULT 'healthy'
                  CHECK (status IN ('healthy', 'warning', 'critical', 'exceeded')),
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, platform, quota_type, period_start)
);

ALTER TABLE api_quota_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_quota_tracking FORCE ROW LEVEL SECURITY;
CREATE POLICY api_quota_isolation ON api_quota_tracking
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_aqt_org ON api_quota_tracking(organization_id);
CREATE INDEX idx_aqt_resets ON api_quota_tracking(resets_at);
CREATE INDEX idx_aqt_status ON api_quota_tracking(status)
  WHERE status IN ('warning', 'critical', 'exceeded');
```

---

## 7. Campaigns & Giveaways Tables

### 7.1 campaigns

```sql
CREATE TABLE campaigns (
  id                      VARCHAR(32) PRIMARY KEY,
  organization_id         VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                    VARCHAR(100) NOT NULL,
  slug                    VARCHAR(100) NOT NULL,
  title                   VARCHAR(200) NOT NULL,
  description             TEXT NOT NULL,
  campaign_type           VARCHAR(50) NOT NULL,
  cover_image_url         TEXT,
  -- Prize details
  prize_name              VARCHAR(200) NOT NULL,
  prize_description       TEXT,
  prize_value_naira       NUMERIC(15,2) NOT NULL,           -- ₦ value of prize
  prize_quantity          INTEGER NOT NULL DEFAULT 1,
  prize_images            TEXT[],
  shipping_required       BOOLEAN DEFAULT TRUE,
  -- Duration
  start_date              TIMESTAMPTZ NOT NULL,
  end_date                TIMESTAMPTZ NOT NULL,
  timezone                VARCHAR(100) DEFAULT 'Africa/Lagos',
  -- Legal
  minimum_age             INTEGER NOT NULL DEFAULT 18,
  restricted_countries    TEXT[],
  terms_and_conditions    TEXT NOT NULL,
  privacy_policy          TEXT,
  -- Status
  status                  VARCHAR(20) DEFAULT 'draft'
                          CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended', 'cancelled')),
  auto_draw_winners       BOOLEAN DEFAULT TRUE,
  response_deadline_days  INTEGER DEFAULT 7,
  created_by              VARCHAR(32) NOT NULL REFERENCES users(id),
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY campaigns_isolation ON campaigns
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(organization_id, status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
```

### 7.2 campaign_entry_methods

```sql
CREATE TABLE campaign_entry_methods (
  id              VARCHAR(32) PRIMARY KEY,
  campaign_id     VARCHAR(32) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  method_type     VARCHAR(50) NOT NULL,
  method_config   JSONB NOT NULL,
  points          INTEGER NOT NULL CHECK (points >= 1 AND points <= 50),
  display_order   INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cem_campaign ON campaign_entry_methods(campaign_id, display_order);
```

### 7.3 campaign_entries

```sql
CREATE TABLE campaign_entries (
  id                    VARCHAR(32) PRIMARY KEY,
  campaign_id           VARCHAR(32) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                 VARCHAR(255) NOT NULL,
  full_name             VARCHAR(100) NOT NULL,
  date_of_birth         DATE,
  phone                 VARCHAR(20),
  country               VARCHAR(2),
  custom_fields         JSONB,
  status                VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verified', 'partial', 'failed', 'disqualified', 'winner', 'duplicate')),
  points_earned         INTEGER DEFAULT 0,
  referrer_entry_id     VARCHAR(32) REFERENCES campaign_entries(id),
  ip_address            INET,
  user_agent            TEXT,
  device_fingerprint    VARCHAR(255),
  recaptcha_score       DECIMAL(3,2),
  fraud_score           DECIMAL(3,2),
  is_winner             BOOLEAN DEFAULT FALSE,
  winner_selected_at    TIMESTAMPTZ,
  prize_claimed         BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaign_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY campaign_entries_isolation ON campaign_entries
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_ce_campaign ON campaign_entries(campaign_id, created_at DESC);
CREATE INDEX idx_ce_status ON campaign_entries(campaign_id, status);
CREATE INDEX idx_ce_email ON campaign_entries(email);
CREATE INDEX idx_ce_winner ON campaign_entries(campaign_id)
  WHERE is_winner = TRUE;
CREATE INDEX idx_ce_org ON campaign_entries(organization_id);
```

### 7.4 winners

```sql
CREATE TABLE winners (
  id                    VARCHAR(32) PRIMARY KEY,
  campaign_id           VARCHAR(32) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_id              VARCHAR(32) NOT NULL REFERENCES campaign_entries(id),
  tier                  VARCHAR(50) DEFAULT 'grand_prize',
  selected_at           TIMESTAMPTZ NOT NULL,
  selection_proof       VARCHAR(255) NOT NULL,             -- verifiable random seed
  notified_at           TIMESTAMPTZ,
  response_deadline     TIMESTAMPTZ NOT NULL,
  responded_at          TIMESTAMPTZ,
  accepted              BOOLEAN,
  shipping_address      JSONB,
  tracking_number       VARCHAR(100),
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  prize_value_naira     NUMERIC(15,2) NOT NULL,            -- ₦ value at time of winning
  status                VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'notified', 'accepted', 'shipped', 'delivered', 'forfeited', 'expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners FORCE ROW LEVEL SECURITY;
CREATE POLICY winners_isolation ON winners
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_winners_campaign ON winners(campaign_id);
CREATE INDEX idx_winners_status ON winners(status, response_deadline);
CREATE INDEX idx_winners_org ON winners(organization_id);
```

---

## 8. Social Listening Tables

### 8.1 listening_queries

```sql
CREATE TABLE listening_queries (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                      VARCHAR(100) NOT NULL,
  description               TEXT,
  keywords                  TEXT[] NOT NULL,
  boolean_operators         TEXT[],
  platforms                 TEXT[] NOT NULL,
  languages                 TEXT[],
  countries                 TEXT[],
  min_engagement            INTEGER DEFAULT 0,
  min_influence_score       INTEGER DEFAULT 0,
  status                    VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'archived')),
  estimated_monthly_mentions INTEGER,
  actual_monthly_mentions   INTEGER,
  created_by                VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listening_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_queries FORCE ROW LEVEL SECURITY;
CREATE POLICY listening_queries_isolation ON listening_queries
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_lq_org ON listening_queries(organization_id);
CREATE INDEX idx_lq_status ON listening_queries(organization_id, status);
```

### 8.2 mentions

```sql
CREATE TABLE mentions (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query_id              VARCHAR(32) NOT NULL REFERENCES listening_queries(id) ON DELETE CASCADE,
  platform              VARCHAR(20) NOT NULL,
  platform_mention_id   VARCHAR(255) NOT NULL,
  -- Author
  author_id             VARCHAR(255),
  author_username       VARCHAR(100),
  author_display_name   VARCHAR(100),
  author_followers      INTEGER DEFAULT 0,
  author_verified       BOOLEAN DEFAULT FALSE,
  author_influence_score INTEGER DEFAULT 0,
  -- Content
  content               TEXT NOT NULL,
  content_hash          VARCHAR(64) UNIQUE,
  url                   TEXT,
  language              VARCHAR(2),
  country               VARCHAR(2),
  -- Sentiment
  sentiment_score       DECIMAL(3,2),                      -- -1.0 to +1.0
  sentiment_label       VARCHAR(20)
                        CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_confidence  DECIMAL(3,2),
  emotions              JSONB,
  aspects               JSONB,
  is_sarcastic          BOOLEAN DEFAULT FALSE,
  -- Moderation
  is_spam               BOOLEAN DEFAULT FALSE,
  is_hidden             BOOLEAN DEFAULT FALSE,
  -- Reach
  reach_estimate        INTEGER DEFAULT 0,
  engagement_likes      INTEGER DEFAULT 0,
  engagement_shares     INTEGER DEFAULT 0,
  engagement_comments   INTEGER DEFAULT 0,
  media_urls            TEXT[],
  parent_mention_id     VARCHAR(32) REFERENCES mentions(id),
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_mention_id)
);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions FORCE ROW LEVEL SECURITY;
CREATE POLICY mentions_isolation ON mentions
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_mentions_org ON mentions(organization_id, created_at DESC);
CREATE INDEX idx_mentions_query ON mentions(query_id, created_at DESC);
CREATE INDEX idx_mentions_sentiment ON mentions(organization_id, sentiment_label, created_at DESC);
CREATE INDEX idx_mentions_platform ON mentions(organization_id, platform, created_at DESC);
CREATE INDEX idx_mentions_influence ON mentions(organization_id, author_influence_score DESC);
CREATE INDEX idx_mentions_published ON mentions(organization_id, published_at DESC);
-- Full-text search
CREATE INDEX idx_mentions_fts ON mentions
  USING GIN(to_tsvector('english', content));
```

### 8.3 mention_tags

```sql
CREATE TABLE mention_tags (
  id              VARCHAR(32) PRIMARY KEY,
  mention_id      VARCHAR(32) NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag             VARCHAR(50) NOT NULL,
  tagged_by       VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mention_id, tag)
);

ALTER TABLE mention_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY mention_tags_isolation ON mention_tags
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_mtag_mention ON mention_tags(mention_id);
CREATE INDEX idx_mtag_tag ON mention_tags(organization_id, tag);
```

### 8.4 listening_alerts

```sql
CREATE TABLE listening_alerts (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  alert_type          VARCHAR(50) NOT NULL,
  enabled             BOOLEAN DEFAULT TRUE,
  threshold           DECIMAL(5,2),
  query_ids           TEXT[],
  channels            TEXT[] NOT NULL,
  recipients          TEXT[] NOT NULL,
  quiet_hours_start   TIME,
  quiet_hours_end     TIME,
  last_triggered_at   TIMESTAMPTZ,
  trigger_count       INTEGER DEFAULT 0,
  created_by          VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listening_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY listening_alerts_isolation ON listening_alerts
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_lalt_org ON listening_alerts(organization_id);
CREATE INDEX idx_lalt_enabled ON listening_alerts(organization_id, enabled);
```

---

## 9. Media Monitoring Tables

### 9.1 monitoring_campaigns

```sql
CREATE TABLE monitoring_campaigns (
  id                      VARCHAR(32) PRIMARY KEY,
  organization_id         VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                    VARCHAR(100) NOT NULL,
  description             TEXT,
  keywords                TEXT[] NOT NULL,
  boolean_operators       TEXT[],
  source_types            TEXT[] NOT NULL,
  languages               TEXT[],
  countries               TEXT[],
  min_authority_score     INTEGER DEFAULT 0,
  exclude_obituaries      BOOLEAN DEFAULT TRUE,
  exclude_classifieds     BOOLEAN DEFAULT TRUE,
  status                  VARCHAR(20) DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'archived')),
  estimated_monthly_articles INTEGER,
  actual_monthly_articles INTEGER,
  created_by              VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monitoring_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY monitoring_campaigns_isolation ON monitoring_campaigns
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_mcmp_org ON monitoring_campaigns(organization_id);
CREATE INDEX idx_mcmp_status ON monitoring_campaigns(organization_id, status);
```

### 9.2 articles

```sql
CREATE TABLE articles (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monitoring_campaign_id    VARCHAR(32) REFERENCES monitoring_campaigns(id),
  title                     TEXT NOT NULL,
  url                       TEXT UNIQUE NOT NULL,
  source                    VARCHAR(255) NOT NULL,
  source_type               VARCHAR(50)
                            CHECK (source_type IN ('newspaper', 'blog', 'broadcast', 'wire', 'social', 'podcast')),
  author                    VARCHAR(255),
  excerpt                   TEXT,
  content                   TEXT,
  published_at              TIMESTAMPTZ NOT NULL,
  language                  VARCHAR(2),
  country                   VARCHAR(2),
  -- Sentiment
  sentiment_score           DECIMAL(3,2),
  sentiment_label           VARCHAR(20)
                            CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  -- Impact
  reach_estimate            BIGINT DEFAULT 0,
  authority_score           INTEGER DEFAULT 0,               -- 0–100 domain authority
  ave_naira                 NUMERIC(15,2) DEFAULT 0,         -- ₦ advertising value equivalence
  social_shares             INTEGER DEFAULT 0,
  -- Content analysis
  key_quotes                TEXT[],
  topics                    TEXT[],
  entities                  JSONB,                           -- named entity recognition output
  -- Classification
  brand_mention_context     VARCHAR(20)
                            CHECK (brand_mention_context IN ('primary', 'passing', 'none')),
  is_competitive            BOOLEAN DEFAULT FALSE,
  competitor_id             VARCHAR(32),
  is_archived               BOOLEAN DEFAULT FALSE,
  content_hash              VARCHAR(64) UNIQUE,
  is_duplicate              BOOLEAN DEFAULT FALSE,
  original_article_id       VARCHAR(32) REFERENCES articles(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles FORCE ROW LEVEL SECURITY;
CREATE POLICY articles_isolation ON articles
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_art_org ON articles(organization_id, published_at DESC);
CREATE INDEX idx_art_source ON articles(organization_id, source);
CREATE INDEX idx_art_sentiment ON articles(organization_id, sentiment_label);
CREATE INDEX idx_art_campaign ON articles(monitoring_campaign_id, published_at DESC);
CREATE INDEX idx_art_reach ON articles(organization_id, reach_estimate DESC);
CREATE INDEX idx_art_competitive ON articles(organization_id)
  WHERE is_competitive = TRUE;
CREATE INDEX idx_art_mention_context ON articles(organization_id, brand_mention_context);
-- Full-text search
CREATE INDEX idx_art_fts ON articles
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')));
```

### 9.3 media_contacts (Journalist CRM)

```sql
CREATE TABLE media_contacts (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name           VARCHAR(200) NOT NULL,
  outlet              VARCHAR(255) NOT NULL,
  beat                VARCHAR(100),                         -- coverage beat (finance, tech, politics)
  title               VARCHAR(100),
  email               VARCHAR(255),
  phone               VARCHAR(20),
  twitter_handle      VARCHAR(100),
  linkedin_url        TEXT,
  bio                 TEXT,
  -- Scoring
  influence_score     INTEGER DEFAULT 0,                    -- 0–100
  relationship_score  INTEGER DEFAULT 0,                    -- 0–100
  response_rate       DECIMAL(3,2),                        -- 0.0–1.0
  -- NDPR consent tracking
  consent_given       BOOLEAN DEFAULT FALSE,
  consent_date        TIMESTAMPTZ,
  consent_method      VARCHAR(50),
  -- Relationship tracking
  last_contact_at     TIMESTAMPTZ,
  interaction_count   INTEGER DEFAULT 0,
  coverage_count      INTEGER DEFAULT 0,
  tags                TEXT[],
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY media_contacts_isolation ON media_contacts
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_ctc_org ON media_contacts(organization_id);
CREATE INDEX idx_ctc_outlet ON media_contacts(organization_id, outlet);
CREATE INDEX idx_ctc_beat ON media_contacts(organization_id, beat);
CREATE INDEX idx_ctc_influence ON media_contacts(organization_id, influence_score DESC);
CREATE INDEX idx_ctc_fts ON media_contacts
  USING GIN(to_tsvector('english', full_name || ' ' || outlet));
```

### 9.4 press_releases

```sql
CREATE TABLE press_releases (
  id                          VARCHAR(32) PRIMARY KEY,
  organization_id             VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                       VARCHAR(500) NOT NULL,
  subtitle                    VARCHAR(500),
  content                     TEXT NOT NULL,
  summary                     TEXT,
  contact_name                VARCHAR(200),
  contact_email               VARCHAR(255),
  contact_phone               VARCHAR(20),
  media_kit_url               TEXT,
  embargo_date                TIMESTAMPTZ,
  status                      VARCHAR(20) DEFAULT 'draft'
                              CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'distributed', 'archived', 'cancelled')),
  distribution_channels       TEXT[],
  scheduled_distribution_at   TIMESTAMPTZ,
  distributed_at              TIMESTAMPTZ,
  -- Performance
  total_recipients            INTEGER DEFAULT 0,
  total_opens                 INTEGER DEFAULT 0,
  total_clicks                INTEGER DEFAULT 0,
  total_pickups               INTEGER DEFAULT 0,
  total_reach                 BIGINT DEFAULT 0,
  total_ave_naira             NUMERIC(15,2) DEFAULT 0,      -- ₦ advertising value
  created_by                  VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY press_releases_isolation ON press_releases
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_pr_org ON press_releases(organization_id, distributed_at DESC);
CREATE INDEX idx_pr_status ON press_releases(organization_id, status);
```

### 9.5 journalist_interactions

```sql
CREATE TABLE journalist_interactions (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id        VARCHAR(32) NOT NULL REFERENCES media_contacts(id) ON DELETE CASCADE,
  press_release_id  VARCHAR(32) REFERENCES press_releases(id),
  interaction_type  VARCHAR(50) NOT NULL
                    CHECK (interaction_type IN ('email_sent', 'press_release_sent', 'coverage_received', 'call', 'meeting', 'social', 'other')),
  direction         VARCHAR(20)
                    CHECK (direction IN ('inbound', 'outbound')),
  subject           TEXT,
  notes             TEXT,
  outcome           VARCHAR(20)
                    CHECK (outcome IN ('positive', 'neutral', 'negative', 'no_response')),
  interacted_at     TIMESTAMPTZ NOT NULL,
  created_by        VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journalist_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalist_interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY journalist_interactions_isolation ON journalist_interactions
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_int_org ON journalist_interactions(organization_id, interacted_at DESC);
CREATE INDEX idx_int_contact ON journalist_interactions(contact_id, interacted_at DESC);
```

### 9.6 media_outreach

```sql
CREATE TABLE media_outreach (
  id                    VARCHAR(32) PRIMARY KEY,
  organization_id       VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  press_release_id      VARCHAR(32) REFERENCES press_releases(id),
  contact_id            VARCHAR(32) NOT NULL REFERENCES media_contacts(id),
  channel               VARCHAR(50) NOT NULL
                        CHECK (channel IN ('email', 'wire', 'social', 'phone')),
  subject_line          VARCHAR(500),
  content               TEXT,
  sent_at               TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  clicked_at            TIMESTAMPTZ,
  replied_at            TIMESTAMPTZ,
  response_sentiment    VARCHAR(20),
  led_to_coverage       BOOLEAN DEFAULT FALSE,
  coverage_article_id   VARCHAR(32) REFERENCES articles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_outreach FORCE ROW LEVEL SECURITY;
CREATE POLICY media_outreach_isolation ON media_outreach
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_out_org ON media_outreach(organization_id, sent_at DESC);
CREATE INDEX idx_out_contact ON media_outreach(contact_id);
CREATE INDEX idx_out_coverage ON media_outreach(organization_id)
  WHERE led_to_coverage = TRUE;
```

---

## 10. Engagement Hub Tables

### 10.1 conversations

```sql
CREATE TABLE conversations (
  id                          VARCHAR(32) PRIMARY KEY,
  organization_id             VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform                    VARCHAR(20) NOT NULL,
  platform_conversation_id    VARCHAR(255) NOT NULL,
  social_account_id           VARCHAR(32) NOT NULL REFERENCES social_accounts(id),
  -- Contact info
  author_id                   VARCHAR(255),
  author_username             VARCHAR(100),
  author_display_name         VARCHAR(100),
  author_followers            INTEGER DEFAULT 0,
  author_verified             BOOLEAN DEFAULT FALSE,
  author_influence_score      INTEGER DEFAULT 0,
  -- Conversation
  subject                     VARCHAR(500),
  preview                     TEXT,
  status                      VARCHAR(20) DEFAULT 'open'
                              CHECK (status IN ('open', 'assigned', 'pending', 'resolved', 'closed')),
  priority                    VARCHAR(20) DEFAULT 'normal'
                              CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  -- Sentiment and intent
  sentiment_label             VARCHAR(20),
  sentiment_score             DECIMAL(3,2),
  intent                      VARCHAR(50),
  language                    VARCHAR(2),
  -- Assignment
  assigned_to                 VARCHAR(32) REFERENCES users(id),
  assigned_at                 TIMESTAMPTZ,
  assigned_by                 VARCHAR(32) REFERENCES users(id),
  -- Resolution tracking
  first_response_at           TIMESTAMPTZ,
  first_response_by           VARCHAR(32) REFERENCES users(id),
  resolved_at                 TIMESTAMPTZ,
  resolved_by                 VARCHAR(32) REFERENCES users(id),
  closed_at                   TIMESTAMPTZ,
  last_message_at             TIMESTAMPTZ NOT NULL,
  message_count               INTEGER DEFAULT 0,
  unread                      BOOLEAN DEFAULT TRUE,
  -- SLA tracking
  sla_first_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline     TIMESTAMPTZ,
  sla_breached                BOOLEAN DEFAULT FALSE,
  tags                        TEXT[],
  custom_fields               JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_conversation_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversations_isolation ON conversations
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_cnv_org ON conversations(organization_id, last_message_at DESC);
CREATE INDEX idx_cnv_status ON conversations(organization_id, status);
CREATE INDEX idx_cnv_assigned ON conversations(organization_id, assigned_to);
CREATE INDEX idx_cnv_unread ON conversations(organization_id)
  WHERE unread = TRUE;
CREATE INDEX idx_cnv_sla ON conversations(sla_first_response_deadline)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_cnv_priority ON conversations(organization_id, priority, last_message_at DESC);
```

### 10.2 messages

```sql
CREATE TABLE messages (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id     VARCHAR(32) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  platform_message_id VARCHAR(255),
  direction           VARCHAR(20) NOT NULL
                      CHECK (direction IN ('inbound', 'outbound')),
  sender_id           VARCHAR(32) REFERENCES users(id),
  sender_type         VARCHAR(20) NOT NULL
                      CHECK (sender_type IN ('user', 'contact', 'system', 'bot')),
  content             TEXT NOT NULL,
  content_type        VARCHAR(20) DEFAULT 'text',
  media_urls          TEXT[],
  sentiment_label     VARCHAR(20),
  sentiment_score     DECIMAL(3,2),
  intent              VARCHAR(50),
  is_internal_note    BOOLEAN DEFAULT FALSE,
  -- Approval workflow
  is_approved         BOOLEAN DEFAULT FALSE,
  approved_by         VARCHAR(32) REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  template_id         VARCHAR(32),
  template_variables  JSONB,
  -- Delivery
  platform_status     VARCHAR(50),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  retry_count         INTEGER DEFAULT 0,
  parent_message_id   VARCHAR(32) REFERENCES messages(id),
  mentioned_users     VARCHAR(32)[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_isolation ON messages
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_msg_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_org ON messages(organization_id, created_at DESC);
CREATE INDEX idx_msg_sender ON messages(sender_id, created_at DESC);
CREATE INDEX idx_msg_platform_id ON messages(platform_message_id)
  WHERE platform_message_id IS NOT NULL;
CREATE INDEX idx_msg_internal ON messages(conversation_id)
  WHERE is_internal_note = TRUE;
```

### 10.3 response_templates

```sql
CREATE TABLE response_templates (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  category          VARCHAR(50) NOT NULL,
  platform          VARCHAR(20) NOT NULL
                    CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'all')),
  language          VARCHAR(10) DEFAULT 'en',
  subject           VARCHAR(500),
  content           TEXT NOT NULL,
  variables         JSONB,
  tags              TEXT[],
  crisis_type       VARCHAR(50),                            -- links to crisis severity framework
  is_approved       BOOLEAN DEFAULT FALSE,
  approved_by       VARCHAR(32) REFERENCES users(id),
  usage_count       INTEGER DEFAULT 0,
  avg_response_time INTEGER,                                -- seconds
  csat_score        DECIMAL(3,2),
  created_by        VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY response_templates_isolation ON response_templates
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_rtpl_org ON response_templates(organization_id);
CREATE INDEX idx_rtpl_category ON response_templates(organization_id, category);
CREATE INDEX idx_rtpl_crisis ON response_templates(organization_id, crisis_type)
  WHERE crisis_type IS NOT NULL;
CREATE INDEX idx_rtpl_platform ON response_templates(organization_id, platform);
```

### 10.4 routing_rules

```sql
CREATE TABLE routing_rules (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  priority        INTEGER DEFAULT 0,
  conditions      JSONB NOT NULL,
  actions         JSONB NOT NULL,
  enabled         BOOLEAN DEFAULT TRUE,
  created_by      VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY routing_rules_isolation ON routing_rules
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_rrule_org ON routing_rules(organization_id, priority);
CREATE INDEX idx_rrule_enabled ON routing_rules(organization_id, enabled);
```

### 10.5 conversation_satisfaction

```sql
CREATE TABLE conversation_satisfaction (
  id              VARCHAR(32) PRIMARY KEY,
  conversation_id VARCHAR(32) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  csat_score      INTEGER NOT NULL CHECK (csat_score >= 1 AND csat_score <= 5),
  feedback_text   TEXT,
  tags            TEXT[],
  submitted_by    VARCHAR(255),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversation_satisfaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_satisfaction FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_satisfaction_isolation ON conversation_satisfaction
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_csat_conversation ON conversation_satisfaction(conversation_id);
CREATE INDEX idx_csat_score ON conversation_satisfaction(organization_id, csat_score);
CREATE INDEX idx_csat_org ON conversation_satisfaction(organization_id, submitted_at DESC);
```

---

## 11. Analytics & Reporting Tables

### 11.1 dashboards

```sql
CREATE TABLE dashboards (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) DEFAULT 'custom'
                  CHECK (type IN ('executive', 'custom', 'module', 'role_based')),
  layout          JSONB NOT NULL,
  widgets         JSONB NOT NULL,
  filters         JSONB,
  is_default      BOOLEAN DEFAULT FALSE,
  is_public       BOOLEAN DEFAULT FALSE,
  created_by      VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards FORCE ROW LEVEL SECURITY;
CREATE POLICY dashboards_isolation ON dashboards
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_dsh_org ON dashboards(organization_id);
CREATE INDEX idx_dsh_default ON dashboards(organization_id, is_default)
  WHERE is_default = TRUE;
```

### 11.2 reports

```sql
CREATE TABLE reports (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  report_type       VARCHAR(50)
                    CHECK (report_type IN ('brand_health', 'social_performance', 'executive', 'crisis', 'campaign', 'competitive', 'agency_client')),
  data_sources      TEXT[] NOT NULL,
  metrics           TEXT[] NOT NULL,
  filters           JSONB,
  visualization_config JSONB NOT NULL,
  -- Scheduling
  schedule          JSONB,                                  -- cron expression + timezone
  recipients        TEXT[],
  format            VARCHAR(20) DEFAULT 'pdf'
                    CHECK (format IN ('pdf', 'csv', 'excel', 'json', 'pptx')),
  -- White-label (agency tier)
  is_white_label    BOOLEAN DEFAULT FALSE,
  white_label_org_id VARCHAR(32) REFERENCES organizations(id),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'archived', 'draft')),
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  run_count         INTEGER DEFAULT 0,
  failure_count     INTEGER DEFAULT 0,
  created_by        VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;
CREATE POLICY reports_isolation ON reports
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_rpt_org ON reports(organization_id);
CREATE INDEX idx_rpt_next_run ON reports(next_run_at) WHERE status = 'active';
```

### 11.3 custom_metrics

```sql
CREATE TABLE custom_metrics (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  formula         TEXT NOT NULL,
  data_type       VARCHAR(20) NOT NULL
                  CHECK (data_type IN ('number', 'percentage', 'currency', 'duration')),
  currency        VARCHAR(3) DEFAULT 'NGN',
  format_string   VARCHAR(50),
  aggregation     VARCHAR(20),
  data_sources    TEXT[] NOT NULL,
  is_valid        BOOLEAN DEFAULT TRUE,
  validation_error TEXT,
  created_by      VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_metrics_isolation ON custom_metrics
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_cm_org ON custom_metrics(organization_id);
```

### 11.4 report_runs

```sql
CREATE TABLE report_runs (
  id              VARCHAR(32) PRIMARY KEY,
  report_id       VARCHAR(32) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL
                  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  error_message   TEXT,
  output_url      TEXT,
  output_format   VARCHAR(20),
  output_size     BIGINT,
  row_count       INTEGER,
  recipients_sent TEXT[],
  retry_count     INTEGER DEFAULT 0
);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY report_runs_isolation ON report_runs
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_rrun_report ON report_runs(report_id, started_at DESC);
CREATE INDEX idx_rrun_status ON report_runs(status)
  WHERE status IN ('pending', 'running');
```

### 11.5 exports

```sql
CREATE TABLE exports (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    VARCHAR(32) NOT NULL REFERENCES users(id),
  data_source     VARCHAR(50) NOT NULL,
  format          VARCHAR(20) NOT NULL,
  filters         JSONB,
  fields          TEXT[],
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  progress        INTEGER DEFAULT 0,
  row_count       INTEGER,
  file_size       BIGINT,
  download_url    TEXT,
  expires_at      TIMESTAMPTZ,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports FORCE ROW LEVEL SECURITY;
CREATE POLICY exports_isolation ON exports
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_exp_org ON exports(organization_id, created_at DESC);
CREATE INDEX idx_exp_status ON exports(status)
  WHERE status IN ('pending', 'processing');
```

---

## 12. Notifications Tables

### 12.1 notifications

```sql
CREATE TABLE notifications (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  body            TEXT,
  data            JSONB,
  channels        TEXT[] NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  action_url      TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_isolation ON notifications
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_not_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_not_org ON notifications(organization_id, created_at DESC);
CREATE INDEX idx_not_unread ON notifications(user_id)
  WHERE is_read = FALSE;
```

### 12.2 notification_preferences

```sql
CREATE TABLE notification_preferences (
  id                VARCHAR(32) PRIMARY KEY,
  user_id           VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id   VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  channel           VARCHAR(20) NOT NULL,
  enabled           BOOLEAN DEFAULT TRUE,
  frequency         VARCHAR(20) DEFAULT 'real_time',
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type, channel)
);

CREATE INDEX idx_npref_user ON notification_preferences(user_id);
CREATE INDEX idx_npref_org ON notification_preferences(organization_id);
```

---

## 13. Billing & Subscription Tables

### 13.1 subscriptions

```sql
CREATE TABLE subscriptions (
  id                      VARCHAR(32) PRIMARY KEY,
  organization_id         VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_tier               VARCHAR(20) NOT NULL
                          CHECK (plan_tier IN ('starter', 'growth', 'professional', 'enterprise', 'agency')),
  billing_cycle           VARCHAR(20) NOT NULL
                          CHECK (billing_cycle IN ('monthly', 'annual')),
  -- Pricing in Nigerian Naira (₦)
  monthly_price_naira     NUMERIC(15,2) NOT NULL,           -- ₦50,000 / ₦150,000 / ₦350,000 etc.
  annual_price_naira      NUMERIC(15,2),                    -- annual total
  discount_percentage     NUMERIC(5,2) DEFAULT 0,
  -- Paystack
  paystack_subscription_id VARCHAR(255) UNIQUE,
  paystack_customer_id    VARCHAR(255),
  paystack_plan_code      VARCHAR(100),
  -- Lifecycle
  status                  VARCHAR(20) NOT NULL
                          CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  trial_start_at          TIMESTAMPTZ,
  trial_end_at            TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  canceled_at             TIMESTAMPTZ,
  cancellation_reason     TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_isolation ON subscriptions
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_sub_org ON subscriptions(organization_id);
CREATE INDEX idx_sub_status ON subscriptions(status);
CREATE INDEX idx_sub_paystack ON subscriptions(paystack_subscription_id);
CREATE INDEX idx_sub_period_end ON subscriptions(current_period_end)
  WHERE status IN ('active', 'past_due');
```

### 13.2 invoices

```sql
CREATE TABLE invoices (
  id                      VARCHAR(32) PRIMARY KEY,
  organization_id         VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id         VARCHAR(32) REFERENCES subscriptions(id),
  paystack_reference      VARCHAR(255) UNIQUE NOT NULL,
  invoice_number          VARCHAR(50) UNIQUE NOT NULL,
  -- All amounts in Nigerian Naira (₦)
  amount_naira            NUMERIC(15,2) NOT NULL,
  tax_naira               NUMERIC(15,2) DEFAULT 0,
  total_naira             NUMERIC(15,2) NOT NULL,
  currency                VARCHAR(3) DEFAULT 'NGN',
  status                  VARCHAR(20) NOT NULL
                          CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  description             TEXT,
  period_start            TIMESTAMPTZ,
  period_end              TIMESTAMPTZ,
  due_date                TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  invoice_pdf_url         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_isolation ON invoices
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_bill_org ON invoices(organization_id);
CREATE INDEX idx_bill_status ON invoices(status);
CREATE INDEX idx_bill_paystack ON invoices(paystack_reference);
```

### 13.3 payment_methods

```sql
CREATE TABLE payment_methods (
  id                        VARCHAR(32) PRIMARY KEY,
  organization_id           VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paystack_authorization_code VARCHAR(255) UNIQUE NOT NULL,
  type                      VARCHAR(20) NOT NULL,
  card_brand                VARCHAR(20),
  card_last4                VARCHAR(4),
  card_exp_month            INTEGER,
  card_exp_year             INTEGER,
  bank_name                 VARCHAR(100),
  account_name              VARCHAR(200),
  is_default                BOOLEAN DEFAULT FALSE,
  is_reusable               BOOLEAN DEFAULT FALSE,
  billing_details           JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_isolation ON payment_methods
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_pm_org ON payment_methods(organization_id);
CREATE INDEX idx_pm_default ON payment_methods(organization_id)
  WHERE is_default = TRUE;
```

### 13.4 usage_tracking

```sql
CREATE TABLE usage_tracking (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type     VARCHAR(50) NOT NULL,
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
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_use_org ON usage_tracking(organization_id);
CREATE INDEX idx_use_metric ON usage_tracking(organization_id, metric_type, period_start DESC);
```

---

## 14. Audit & Compliance Tables

### 14.1 audit_log

```sql
CREATE TABLE audit_log (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32),
  user_id         VARCHAR(32),
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(32),
  changes         JSONB,                                    -- before/after values
  reason          TEXT,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — immutable
);

-- Immutable: no updates or deletes allowed (enforced by application + pg trigger)
CREATE INDEX idx_aud_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_aud_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_aud_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_aud_resource ON audit_log(resource_type, resource_id, created_at DESC);
```

### 14.2 admin_audit_log

```sql
CREATE TABLE admin_audit_log (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32),
  admin_user_id   VARCHAR(32) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(32),
  target_user_id  VARCHAR(32),
  ip_address      INET NOT NULL,
  user_agent      TEXT,
  justification   TEXT,
  metadata        JSONB,
  severity        VARCHAR(20) DEFAULT 'info'
                  CHECK (severity IN ('info', 'warning', 'critical')),
  checksum        VARCHAR(64) NOT NULL,                     -- HMAC of row contents
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable
);

CREATE INDEX idx_aaud_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_aaud_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_aaud_target ON admin_audit_log(target_user_id, created_at DESC);
CREATE INDEX idx_aaud_severity ON admin_audit_log(severity, created_at DESC);
```

### 14.3 dsar_requests (Data Subject Access Requests)

```sql
CREATE TABLE dsar_requests (
  id                    VARCHAR(32) PRIMARY KEY,
  user_id               VARCHAR(32) NOT NULL,
  organization_id       VARCHAR(32),
  type                  VARCHAR(20) NOT NULL
                        CHECK (type IN ('access', 'erasure', 'portability', 'rectification')),
  status                VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verifying', 'processing', 'completed', 'rejected', 'failed')),
  verification_method   VARCHAR(50),
  verified_at           TIMESTAMPTZ,
  verified_by           VARCHAR(32),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date              TIMESTAMPTZ NOT NULL,               -- 30 days from request (NDPR / GDPR)
  completed_at          TIMESTAMPTZ,
  completed_by          VARCHAR(32),
  data_package_url      TEXT,
  data_package_expires_at TIMESTAMPTZ,
  notes                 TEXT,
  rejection_reason      TEXT
);

CREATE INDEX idx_dsar_user ON dsar_requests(user_id);
CREATE INDEX idx_dsar_status ON dsar_requests(status, due_date);
CREATE INDEX idx_dsar_due ON dsar_requests(due_date)
  WHERE status NOT IN ('completed', 'rejected');
```

### 14.4 legal_holds

```sql
CREATE TABLE legal_holds (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32),
  user_id         VARCHAR(32),
  data_type       VARCHAR(50) NOT NULL,
  reason          TEXT NOT NULL,
  legal_case_id   VARCHAR(100),
  placed_by       VARCHAR(32) NOT NULL,
  placed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  released_at     TIMESTAMPTZ,
  released_by     VARCHAR(32),
  status          VARCHAR(20) DEFAULT 'active'
                  CHECK (status IN ('active', 'released', 'expired'))
);

CREATE INDEX idx_lh_org ON legal_holds(organization_id);
CREATE INDEX idx_lh_user ON legal_holds(user_id);
CREATE INDEX idx_lh_active ON legal_holds(status)
  WHERE status = 'active';
```

### 14.5 data_retention_policies

```sql
CREATE TABLE data_retention_policies (
  id                VARCHAR(32) PRIMARY KEY,
  organization_id   VARCHAR(32),
  data_type         VARCHAR(50) NOT NULL,
  retention_days    INTEGER NOT NULL,
  retention_action  VARCHAR(20) NOT NULL
                    CHECK (retention_action IN ('delete', 'anonymize', 'archive')),
  legal_basis       TEXT,
  enabled           BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ret_org ON data_retention_policies(organization_id);
CREATE INDEX idx_ret_type ON data_retention_policies(data_type, enabled);
```

---

## 15. System Administration Tables

### 15.1 impersonation_sessions

```sql
CREATE TABLE impersonation_sessions (
  id                  VARCHAR(32) PRIMARY KEY,
  admin_user_id       VARCHAR(32) NOT NULL,
  target_user_id      VARCHAR(32) NOT NULL,
  reason              TEXT NOT NULL,
  ticket_id           VARCHAR(50),
  session_token_hash  VARCHAR(255) NOT NULL,
  ip_address          INET NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ,
  end_reason          VARCHAR(50),
  actions_performed   INTEGER DEFAULT 0,
  mfa_verified        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_imp_admin ON impersonation_sessions(admin_user_id, started_at DESC);
CREATE INDEX idx_imp_target ON impersonation_sessions(target_user_id, started_at DESC);
CREATE INDEX idx_imp_active ON impersonation_sessions(expires_at)
  WHERE ended_at IS NULL;
```

### 15.2 app_config (merged system_config + feature_flags)

```sql
CREATE TABLE app_config (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32),          -- NULL = system-wide default
  kind                VARCHAR(50) NOT NULL  -- 'system_config' | 'feature_flag'
                      CHECK (kind IN ('system_config', 'feature_flag')),
  key                 VARCHAR(100) NOT NULL,
  name                VARCHAR(200),         -- human-readable (flags)
  description         TEXT,
  value               JSONB NOT NULL,
  config_type         VARCHAR(50) NOT NULL
                      CHECK (config_type IN ('security','rate_limit','feature_flag','integration','notification','billing','compliance')),
  environment         VARCHAR(20) DEFAULT 'production'
                      CHECK (environment IN ('development','staging','production','sandbox')),
  enabled             BOOLEAN DEFAULT FALSE NOT NULL,
  kill_switch         BOOLEAN DEFAULT FALSE NOT NULL,
  rollout_percentage  INTEGER DEFAULT 0 NOT NULL
                      CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  targeting_rules     JSONB,
  environments        JSONB,
  release_date        TIMESTAMPTZ,
  default_value       JSONB NOT NULL,
  previous_value      JSONB,
  validation_schema   JSONB,
  validation_rules    JSONB,
  example_value       JSONB,
  change_reason       TEXT NOT NULL,
  version             INTEGER DEFAULT 1 NOT NULL,
  is_encrypted        BOOLEAN DEFAULT FALSE NOT NULL,
  is_locked           BOOLEAN DEFAULT FALSE NOT NULL,
  is_deprecated       BOOLEAN DEFAULT FALSE NOT NULL,
  deprecated_at       TIMESTAMPTZ,
  created_by          VARCHAR(32) NOT NULL,
  updated_by          VARCHAR(32),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- system_config: unique per kind + org + key + environment
  UNIQUE(kind, organization_id, key, environment)
);

-- Partial unique for feature flags (org + key, regardless of environment)
CREATE UNIQUE INDEX uq_ac_org_key
  ON app_config(organization_id, key)
  WHERE kind = 'feature_flag';

CREATE INDEX idx_ac_kind ON app_config(kind);
CREATE INDEX idx_ac_key_lookup ON app_config(key, organization_id);
CREATE INDEX idx_ac_org ON app_config(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_ac_env ON app_config(environment, kind);
CREATE INDEX idx_ac_type ON app_config(config_type);
CREATE INDEX idx_ac_enabled ON app_config(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_ac_kill_switch ON app_config(organization_id, key) WHERE kill_switch = TRUE;
CREATE INDEX idx_ac_deprecated ON app_config(is_deprecated) WHERE is_deprecated = TRUE;
```

### 15.4 backup_records

```sql
CREATE TABLE backup_records (
  id              VARCHAR(32) PRIMARY KEY,
  backup_type     VARCHAR(50) NOT NULL
                  CHECK (backup_type IN ('full', 'incremental_wal', 'config', 'audit_archive')),
  status          VARCHAR(20) NOT NULL
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'expired')),
  size_bytes      BIGINT,
  location        TEXT NOT NULL,
  encrypted       BOOLEAN DEFAULT TRUE,
  checksum        VARCHAR(64),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB
);

CREATE INDEX idx_bkp_type ON backup_records(backup_type, started_at DESC);
CREATE INDEX idx_bkp_status ON backup_records(status, started_at DESC);
```

---

## 16. Influencer Tables

### 16.1 influencers

```sql
CREATE TABLE influencers (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name           VARCHAR(200) NOT NULL,
  username            VARCHAR(100) NOT NULL,
  primary_platform    VARCHAR(20) NOT NULL,
  email               VARCHAR(255),
  phone               VARCHAR(20),
  social_handles      JSONB,
  bio                 TEXT,
  categories          TEXT[],
  location            TEXT,
  follower_count      INTEGER DEFAULT 0,
  engagement_rate     DECIMAL(5,2) DEFAULT 0,
  influence_score     DECIMAL(5,2) DEFAULT 0,               -- 0–100
  authenticity_score  DECIMAL(5,2) DEFAULT 0,
  fraud_score         DECIMAL(5,2) DEFAULT 0,
  brand_safety_score  DECIMAL(5,2) DEFAULT 0,
  relationship_score  DECIMAL(5,2) DEFAULT 0,
  campaign_count      INTEGER DEFAULT 0,
  status              VARCHAR(20) DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'blacklisted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers FORCE ROW LEVEL SECURITY;
CREATE POLICY influencers_isolation ON influencers
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_inf_org ON influencers(organization_id);
CREATE INDEX idx_inf_platform ON influencers(organization_id, primary_platform);
CREATE INDEX idx_inf_score ON influencers(organization_id, influence_score DESC);
CREATE INDEX idx_inf_status ON influencers(organization_id, status);
```

### 16.2 influencer_programs

```sql
CREATE TABLE influencer_programs (
  id              VARCHAR(32) PRIMARY KEY,
  organization_id VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  influencer_id   VARCHAR(32) NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  program_type    VARCHAR(50)
                  CHECK (program_type IN ('product', 'brand', 'awareness', 'event', 'gifting')),
  start_date      TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  status          VARCHAR(20) DEFAULT 'planning'
                  CHECK (status IN ('planning', 'invited', 'accepted', 'active', 'completed', 'cancelled', 'rejected')),
  budget_naira    NUMERIC(15,2),                            -- ₦ program budget
  spent_naira     NUMERIC(15,2) DEFAULT 0,                 -- ₦ amount spent
  contract        JSONB,
  deliverables    JSONB,
  payment_status  VARCHAR(20) DEFAULT 'pending'
                  CHECK (payment_status IN ('pending', 'paid', 'overdue', 'disputed')),
  performance     JSONB,
  roi             DECIMAL(10,2),
  created_by      VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE influencer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_programs FORCE ROW LEVEL SECURITY;
CREATE POLICY influencer_programs_isolation ON influencer_programs
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_icmp_org ON influencer_programs(organization_id);
CREATE INDEX idx_icmp_influencer ON influencer_programs(influencer_id);
CREATE INDEX idx_icmp_status ON influencer_programs(organization_id, status);
```

---

## 17. Social Commerce Tables

### 17.1 products

```sql
CREATE TABLE products (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  sku                 VARCHAR(100),
  price_naira         NUMERIC(15,2) NOT NULL,               -- ₦ price
  currency            VARCHAR(3) DEFAULT 'NGN',
  category            TEXT,
  subcategory         TEXT,
  brand               TEXT,
  images              TEXT[],
  variants            JSONB,
  inventory           INTEGER DEFAULT 0,
  inventory_status    VARCHAR(20) DEFAULT 'in_stock'
                      CHECK (inventory_status IN ('in_stock', 'low_stock', 'out_of_stock')),
  platform_ids        JSONB,
  tags                TEXT[],
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_isolation ON products
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_prod_org ON products(organization_id);
CREATE INDEX idx_prod_active ON products(organization_id, is_active);
CREATE INDEX idx_prod_category ON products(organization_id, category);
```

### 17.2 orders

```sql
CREATE TABLE orders (
  id                  VARCHAR(32) PRIMARY KEY,
  organization_id     VARCHAR(32) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number        TEXT NOT NULL,
  platform            TEXT NOT NULL,
  platform_order_id   TEXT,
  products            JSONB NOT NULL,
  total_naira         NUMERIC(15,2) NOT NULL,               -- ₦ total
  currency            VARCHAR(3) DEFAULT 'NGN',
  shipping_address    JSONB,
  billing_address     JSONB,
  status              VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status      VARCHAR(20) DEFAULT 'pending'
                      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  content_id          VARCHAR(32),
  influencer_id       VARCHAR(32) REFERENCES influencers(id),
  source_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY orders_isolation ON orders
  USING (organization_id = current_setting('app.current_organization_id', true));

CREATE INDEX idx_ord_org ON orders(organization_id);
CREATE INDEX idx_ord_status ON orders(organization_id, status);
CREATE INDEX idx_ord_influencer ON orders(influencer_id);
CREATE INDEX idx_ord_created ON orders(organization_id, created_at DESC);
```

---

## 18. Cache & Rate Limit Stores (SQLite)

### 18.1 Cache Store Schema

```sql
-- SQLite via bun:sql
-- File: /data/cache.db

CREATE TABLE cache_entries (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,              -- JSON-serialized value
  tags       TEXT,                       -- comma-separated tags for bulk invalidation
  expires_at INTEGER NOT NULL            -- Unix timestamp
);

CREATE INDEX idx_cache_expires ON cache_entries(expires_at);
CREATE INDEX idx_cache_tags    ON cache_entries(tags);
```

**Cache Key Conventions:**

| Pattern                             | TTL            | Example                         |
| ----------------------------------- | -------------- | ------------------------------- |
| `permissions:{user_id}`             | 300s (5 min)   | `permissions:usr_9f2a4b`        |
| `org:settings:{org_id}`             | 900s (15 min)  | `org:settings:org_7e3b2c`       |
| `mention:feed:{org_id}:{cursor}`    | 120s (2 min)   | `mention:feed:org_7e3b2c:page1` |
| `sentiment:trend:{org_id}:{period}` | 600s (10 min)  | `sentiment:trend:org_7e3b2c:7d` |
| `sov:{org_id}:{period}`             | 1800s (30 min) | `sov:org_7e3b2c:30d`            |
| `crisis:active:{org_id}`            | 30s            | `crisis:active:org_7e3b2c`      |
| `user:profile:{user_id}`            | 600s (10 min)  | `user:profile:usr_9f2a4b`       |
| `subscription:{org_id}`             | 1800s (30 min) | `subscription:org_7e3b2c`       |

### 18.2 Rate Limit Store Schema

```sql
-- SQLite via bun:sql
-- File: /data/ratelimit.db

CREATE TABLE rate_limit_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,              -- {endpoint}:{user_id_or_ip}
  created_at INTEGER DEFAULT (UNIXEPOCH())
);

CREATE INDEX idx_rl_key_time ON rate_limit_entries(key, created_at);
```

**Sliding Window Query:**

```sql
-- Count requests in the last N seconds
SELECT COUNT(*) as request_count
FROM rate_limit_entries
WHERE key = ? AND created_at > UNIXEPOCH() - ?;

-- Cleanup background job (every 5 minutes)
DELETE FROM rate_limit_entries WHERE created_at < UNIXEPOCH() - 3600;
```

---

## 19. Materialized Views

### 19.1 daily_mention_metrics

```sql
CREATE MATERIALIZED VIEW daily_mention_metrics AS
SELECT
  organization_id,
  DATE(created_at AT TIME ZONE 'Africa/Lagos') AS date_wat,  -- WAT date
  platform,
  COUNT(*)                                              AS total_mentions,
  COUNT(*) FILTER (WHERE sentiment_label = 'positive')  AS positive_mentions,
  COUNT(*) FILTER (WHERE sentiment_label = 'negative')  AS negative_mentions,
  COUNT(*) FILTER (WHERE sentiment_label = 'neutral')   AS neutral_mentions,
  AVG(sentiment_score)                                  AS avg_sentiment_score,
  SUM(reach_estimate)                                   AS total_reach,
  SUM(engagement_likes + engagement_shares + engagement_comments) AS total_engagement
FROM mentions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY organization_id, DATE(created_at AT TIME ZONE 'Africa/Lagos'), platform;

CREATE UNIQUE INDEX idx_dmm ON daily_mention_metrics(organization_id, date_wat, platform);

-- Refresh schedule: Every 30 minutes via background job
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_mention_metrics;
```

### 19.2 daily_article_metrics

```sql
CREATE MATERIALIZED VIEW daily_article_metrics AS
SELECT
  organization_id,
  DATE(published_at AT TIME ZONE 'Africa/Lagos') AS date_wat,
  source_type,
  COUNT(*)                                                    AS total_articles,
  COUNT(*) FILTER (WHERE sentiment_label = 'positive')        AS positive_articles,
  COUNT(*) FILTER (WHERE sentiment_label = 'negative')        AS negative_articles,
  AVG(authority_score)                                        AS avg_authority_score,
  SUM(reach_estimate)                                         AS total_reach,
  SUM(ave_naira)                                             AS total_ave_naira  -- ₦ total
FROM articles
WHERE published_at >= NOW() - INTERVAL '90 days'
GROUP BY organization_id, DATE(published_at AT TIME ZONE 'Africa/Lagos'), source_type;

CREATE UNIQUE INDEX idx_dam ON daily_article_metrics(organization_id, date_wat, source_type);
```

### 19.3 daily_engagement_metrics

```sql
CREATE MATERIALIZED VIEW daily_engagement_metrics AS
SELECT
  organization_id,
  DATE(created_at AT TIME ZONE 'Africa/Lagos') AS date_wat,
  COUNT(*)                                                        AS total_conversations,
  COUNT(*) FILTER (WHERE status = 'resolved')                     AS resolved_conversations,
  COUNT(*) FILTER (WHERE sla_breached = TRUE)                     AS sla_breached_count,
  AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)  AS avg_first_response_minutes,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)      AS avg_resolution_hours,
  COUNT(*) FILTER (WHERE priority = 'critical')                   AS critical_conversations
FROM conversations
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY organization_id, DATE(created_at AT TIME ZONE 'Africa/Lagos');

CREATE UNIQUE INDEX idx_dem ON daily_engagement_metrics(organization_id, date_wat);
```

### 19.4 daily_campaign_metrics

```sql
CREATE MATERIALIZED VIEW daily_campaign_metrics AS
SELECT
  c.organization_id,
  DATE(ce.created_at AT TIME ZONE 'Africa/Lagos') AS date_wat,
  COUNT(*)                                          AS total_entries,
  COUNT(*) FILTER (WHERE ce.status = 'verified')   AS verified_entries,
  COUNT(*) FILTER (WHERE ce.is_winner = TRUE)       AS winner_count,
  SUM(c.prize_value_naira) FILTER (WHERE ce.is_winner = TRUE) AS total_prize_naira  -- ₦
FROM campaign_entries ce
JOIN campaigns c ON c.id = ce.campaign_id
WHERE ce.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.organization_id, DATE(ce.created_at AT TIME ZONE 'Africa/Lagos');

CREATE UNIQUE INDEX idx_dcm ON daily_campaign_metrics(organization_id, date_wat);
```

---

## 20. Enum Reference

### 20.1 Complete Enum Definitions

```sql
-- Organization
CREATE TYPE plan_tier AS ENUM ('starter', 'growth', 'professional', 'enterprise', 'agency');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'paused');

-- User
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_deletion', 'deleted');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'creator', 'analyst', 'viewer');

-- Social platforms
CREATE TYPE social_platform AS ENUM ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'reddit');

-- Sentiment
CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative');

-- Crisis severity
CREATE TYPE crisis_severity AS ENUM ('s1_noise', 's2_watch', 's3_respond', 's4_escalate', 's5_allhands');

-- Campaign
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'ended', 'cancelled');
CREATE TYPE campaign_entry_status AS ENUM ('pending', 'verified', 'partial', 'failed', 'disqualified', 'winner', 'duplicate');
CREATE TYPE winner_status AS ENUM ('pending', 'notified', 'accepted', 'shipped', 'delivered', 'forfeited', 'expired');

-- Media monitoring
CREATE TYPE article_source_type AS ENUM ('newspaper', 'blog', 'broadcast', 'wire', 'social', 'podcast');
CREATE TYPE brand_mention_context AS ENUM ('primary', 'passing', 'none');

-- Press release
CREATE TYPE press_release_status AS ENUM ('draft', 'review', 'approved', 'scheduled', 'distributed', 'archived', 'cancelled');
CREATE TYPE outreach_channel AS ENUM ('email', 'wire', 'social', 'phone');

-- Engagement
CREATE TYPE conversation_status AS ENUM ('open', 'assigned', 'pending', 'resolved', 'closed');
CREATE TYPE conversation_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_sender_type AS ENUM ('user', 'contact', 'system', 'bot');

-- Reporting
CREATE TYPE report_format AS ENUM ('pdf', 'csv', 'excel', 'json', 'pptx');
CREATE TYPE report_status AS ENUM ('active', 'paused', 'archived', 'draft');

-- Influencer
CREATE TYPE influencer_status AS ENUM ('active', 'inactive', 'blacklisted');
CREATE TYPE influencer_program_status AS ENUM ('planning', 'invited', 'accepted', 'active', 'completed', 'cancelled', 'rejected');

-- Commerce
CREATE TYPE inventory_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE order_payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Admin
CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE dsar_type AS ENUM ('access', 'erasure', 'portability', 'rectification');
CREATE TYPE backup_type AS ENUM ('full', 'incremental_wal', 'config', 'audit_archive');
```

---

## 21. Indexing Strategy

### 21.1 Index Type Selection

| Index Type           | When to Use                                             | Example                                                           |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| **B-tree**           | Equality, range queries, sorting                        | `organization_id`, `created_at`, `status`                         |
| **Composite B-tree** | Multi-column filters (most common pattern)              | `(organization_id, status)`, `(organization_id, created_at DESC)` |
| **GIN**              | Full-text search (`tsvector`), arrays (`TEXT[]`), JSONB | `idx_art_fts`, `idx_mentions_fts`                                 |
| **Partial**          | Filtered queries on a subset of rows                    | `WHERE deleted_at IS NULL`, `WHERE status = 'active'`             |
| **BRIN**             | Append-only time-series tables                          | `created_at` on `audit_log`                                       |

### 21.2 Performance Targets

| Query Type                          | Target P95 | Strategy                                       |
| ----------------------------------- | ---------- | ---------------------------------------------- |
| Primary key lookup                  | <1ms       | Automatic B-tree on PK                         |
| Organization-scoped list (with RLS) | <10ms      | Composite index `(org_id, ...)`                |
| Full-text search                    | <50ms      | GIN on `tsvector`                              |
| Sentiment trend aggregation         | <100ms     | Materialized view                              |
| PR value (₦) total query            | <50ms      | Composite index + partial index                |
| Mention feed (paginated)            | <20ms      | Composite index on `(org_id, created_at DESC)` |

### 21.3 Maintenance Schedule

```sql
-- Run weekly via background job
ANALYZE organizations, users, mentions, articles, conversations, messages;

-- Run monthly (or after bulk inserts)
REINDEX INDEX CONCURRENTLY idx_mentions_org;
REINDEX INDEX CONCURRENTLY idx_articles_fts;

-- Refresh materialized views every 30 minutes
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_mention_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_article_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_engagement_metrics;
```

---

## 22. Migration Strategy

### 22.1 Migration Workflow

1. Modify schema in `db/schema/*.ts` (Drizzle schema files)
2. Generate migration: `bun drizzle-kit generate`
3. Review generated SQL — every migration reviewed by a second engineer
4. Test migration on staging database (with production-scale anonymized data)
5. Apply to production: `bun drizzle-kit migrate`
6. Verify schema and data integrity
7. Commit schema, migration file, and any new tests

### 22.2 Migration File Naming

```
NNNN_description_of_change.sql
```

Example: `0042_add_naira_fields_to_campaigns.sql`

### 22.3 Backward-Compatible Migration Rules

| Change Type               | Rule                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| Add a new column          | Must be `NULLABLE` or have a `DEFAULT` value                           |
| Rename a column           | Create new column, backfill, deprecate old, remove in a future release |
| Change a column type      | Create new column, backfill, remove old in a future release            |
| Add a new ENUM value      | Safe — only add, never remove from a deployed enum                     |
| Remove an ENUM value      | Requires: remove all uses first, then remove the enum value            |
| Drop a column             | Must be unused for at least 2 deployments                              |
| Add a NOT NULL constraint | Only after backfilling all NULL values                                 |
| Add a unique constraint   | Only after verifying no duplicates exist                               |

### 22.4 High-Risk Migration Protocol

Any migration that is not purely additive requires:

- Engineering Lead code review
- Staging dry-run with timing measurement
- Documented rollback plan
- Team communication in Slack #engineering 1 hour before applying
- Migration applied during low-traffic window (2–4 AM WAT)

---

## 23. Backup & Recovery

### 23.1 Backup Strategy

| Backup Type                 | Frequency          | Retention  | Storage                 | Encryption |
| --------------------------- | ------------------ | ---------- | ----------------------- | ---------- |
| Full PostgreSQL backup      | Daily at 02:00 WAT | 30 days    | Backblaze B2 (off-site) | AES-256    |
| WAL archiving (incremental) | Every 5 minutes    | 7 days     | Backblaze B2 (off-site) | AES-256    |
| SQLite cache backup         | Daily at 03:00 WAT | 7 days     | Backblaze B2            | AES-256    |
| Configuration backup        | On change          | Indefinite | Git (git-crypt)         | AES-256    |
| Audit log archive           | Daily at 05:00 WAT | 7 years    | Backblaze B2 Glacier    | AES-256    |

### 23.2 Recovery Objectives

| Component          | RPO (maximum data loss)               | RTO (maximum downtime) |
| ------------------ | ------------------------------------- | ---------------------- |
| PostgreSQL         | 5 minutes (WAL archiving every 5 min) | 30 minutes             |
| SQLite cache       | 24 hours (cache can be rebuilt)       | 5 minutes              |
| Audit logs         | 0 (append-only; archive daily)        | 1 hour                 |
| Application config | 0 (versioned in Git)                  | 5 minutes              |

---

## 24. Data Governance

### 24.1 Default Retention Policies

| Data Type                      | Default Retention                     | Action on Expiry             | Configurable |
| ------------------------------ | ------------------------------------- | ---------------------------- | ------------ |
| User accounts                  | Account lifetime + 30 days            | Hard delete                  | No           |
| Social mentions                | 2 years                               | Soft delete → archive        | Yes          |
| Media articles                 | 3 years                               | Archive                      | Yes          |
| Conversation messages          | 2 years                               | Archive                      | Yes          |
| Analytics / materialized views | 90 days of raw; 7 years of aggregates | Purge raw; keep aggregates   | Yes          |
| Audit logs                     | 7 years                               | No action (legally required) | No           |
| Backup files                   | 30 days                               | Auto-expire                  | Yes          |
| Data exports                   | 24 hours                              | Auto-expire + delete         | No           |
| DSAR packages                  | 7 days post-completion                | Delete                       | No           |
| Press releases                 | 7 years (legal)                       | Archive                      | No           |
| Invoice records (₦)            | 7 years (tax law)                     | Archive                      | No           |

### 24.2 NDPR / GDPR Compliance Features

| Right                  | Implementation                                           | SLA       |
| ---------------------- | -------------------------------------------------------- | --------- |
| Right to Access        | Automated `dsar_requests` workflow → data package export | 30 days   |
| Right to Erasure       | Automated deletion with legal hold check                 | 30 days   |
| Right to Portability   | JSON export via data package                             | 30 days   |
| Right to Rectification | In-app profile editing + admin tools                     | Immediate |
| Consent Management     | `media_contacts.consent_given` + audit log               | Real-time |
| Legal Holds            | `legal_holds` table prevents deletion during hold        | Immediate |
| Breach Notification    | Audit log triggers + incident response plan              | 72 hours  |

### 24.3 PII Fields Registry

| Table              | PII Columns                                                  | Protection                                |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------- |
| `users`            | `email`, `full_name`, `phone`, `avatar_url`, `last_login_ip` | Encrypted at rest (AES-256), never logged |
| `sessions`         | `ip_address`, `user_agent`                                   | Encrypted at rest                         |
| `login_attempts`   | `email`, `ip_address`, `user_agent`                          | Encrypted at rest                         |
| `campaign_entries` | `email`, `full_name`, `date_of_birth`, `phone`, `ip_address` | Encrypted at rest                         |
| `winners`          | `shipping_address` (JSONB with name/address)                 | Encrypted at rest                         |
| `media_contacts`   | `email`, `phone`, `twitter_handle`                           | Consent-gated                             |
| `conversations`    | `author_username`, `author_display_name`                     | Platform-sourced; retained per policy     |
| `messages`         | `content`                                                    | Encrypted at rest; retention-gated        |

---

## 25. Document Approvals

| Role                   | Name                       | Signature      | Date       |
| ---------------------- | -------------------------- | -------------- | ---------- |
| Engineering Lead       | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Database Administrator | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Security Lead          | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Compliance Officer     | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |

---

## 26. Related Documents

| Document                  | Relationship                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| **Architecture**          | System design that governs multi-tenancy and performance requirements    |
| **ADRs**                  | ADR-003 (PostgreSQL), ADR-004 (SQLite cache), ADR-009 (multi-tenant RLS) |
| **Tech Stack**            | Drizzle ORM, PostgreSQL, SQLite tooling choices                          |
| **Security Policy**       | NDPR compliance, encryption standards, audit requirements                |
| **Engineering Standards** | Migration review process, naming conventions                             |
| **API Reference**         | API endpoints that read from and write to these tables                   |
| **Module Specifications** | Per-module data model details and business logic                         |

---

## Document Version History

| Version | Date       | Author           | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 2026-07-21 | Engineering Lead | Unified and expanded Database Schema document. Merges and improves both source documents. Adds: Nigerian Naira (₦) as universal currency convention with `BIGINT()` across all monetary fields, WAT (Africa/Lagos) as default timezone, Paystack payment tables replacing Stripe, complete ID prefix registry (50+ prefixes), comprehensive RLS policies for all multi-tenant tables, journalist CRM tables, influencer program tables with ₦ budget fields, WAT-aware materialized views, complete enum definitions, PII fields registry, NDPR-specific compliance features, 5-minute WAL archiving interval, cache key convention table, rate limit sliding window SQL, and high-risk migration protocol. |

---

_This document is owned by the Engineering Lead and reviewed quarterly, or immediately following any schema change. All migrations must be reviewed against this document before being applied to production._
