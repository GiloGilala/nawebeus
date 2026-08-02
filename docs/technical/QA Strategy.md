# QA Strategy

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** QA Lead & Engineering Lead

---

## 1. Executive Summary

This document defines the complete Quality Assurance (QA) strategy for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It establishes testing standards, methodologies, tools, coverage targets, CI/CD integration, bug management processes, and quality metrics that ensure the platform meets functional, performance, security, accessibility, and reliability requirements before every release.

**Testing Philosophy:**

| Principle | Description |
|-----------|-------------|
| **Quality by Design** | Quality is built in from the first line of code, not inspected in at the end |
| **Shift Left** | Testing starts at requirements definition, not after implementation |
| **Automation First** | Automate everything that can be automated; manual testing for exploratory and usability work |
| **Continuous Testing** | Every commit triggers the full test suite — no exceptions |
| **User-Centric** | Tests are written from the user's perspective using real Nigerian user journeys |
| **The Negative Test Rule** | Every "user can do X" test requires a corresponding "user cannot do X" test |
| **Quality is Everyone's Responsibility** | Developers write unit and integration tests; QA owns the strategy and E2E suite |
| **Nigerian Market Awareness** | Tests validate ₦ currency handling, WAT timezone logic, Nigerian media source coverage, and NDPR compliance |

**Testing Pyramid:**

```
                         ┌─────────────────┐
                         │   E2E Tests      │  ~10%
                         │  (Critical Paths)│  Playwright + Maestro
                         └─────────────────┘
                      ┌──────────────────────────┐
                      │   Integration Tests       │  ~20%
                      │  (API + Service Layers)   │  Bun test + Hono client
                      └──────────────────────────┘
                   ┌─────────────────────────────────────┐
                   │           Unit Tests                  │  ~70%
                   │  (Functions, Services, Components)    │  Bun test (built-in)
                   └─────────────────────────────────────┘
```

---

## 2. Test Coverage Targets

### 2.1 Coverage by Component

| Component | Coverage Target | Metric | Enforcement |
|-----------|----------------|--------|-------------|
| **Services layer** | ≥ 85% line coverage | Bun test --coverage | CI blocks merge below threshold |
| **Lib utilities** | ≥ 90% line coverage | Bun test --coverage | CI blocks merge below threshold |
| **API endpoints (Hono)** | ≥ 70% of endpoints | Integration test coverage | CI check |
| **React components** | ≥ 75% line coverage | Bun test --coverage | CI check |
| **RBAC permission paths** | 100% (all roles × all actions) | Explicit positive + negative tests | Manual review checklist |
| **User journeys (E2E)** | 100% of defined journeys | Playwright suite | Daily CI job |
| **Multi-tenant isolation** | 100% (every multi-tenant table) | Security isolation tests | CI check |
| **₦ monetary calculations** | 100% (every billing calculation) | Unit tests | CI check |
| **Accessibility (WCAG 2.1 AA)** | 0 violations | axe-core automated | Every PR |

### 2.2 The Negative Test Rule

This rule is **mandatory**. CI will fail on a PR that adds a positive permission test without a corresponding negative test.

For every **"user can do X"** test, there must be at least one **"user cannot do X"** test covering:

| Dimension | Required Negative Test |
|-----------|----------------------|
| **Wrong role** | Lower-privilege role cannot perform the action |
| **Wrong organization** | User from Organization A cannot affect Organization B's data |
| **Missing authentication** | Unauthenticated request returns 401 |
| **Expired token** | Expired JWT returns 401 |
| **Rate limit** | Exceeding the limit returns 429 |
| **Invalid input** | Malformed input returns 422 with specific error code |

```typescript
// ✅ Required pattern — both positive and negative paths
describe('CrisisService.publishResponse', () => {
  // POSITIVE: manager can publish a crisis response
  it('allows Manager to publish an approved crisis response', async () => {
    const result = await crisisService.publishResponse({
      incidentId: incident.id,
      responseId: approvedResponse.id,
      organizationId: org.id,
      userRole: 'manager',
    });
    expect(result.status).toBe('published');
  });

  // NEGATIVE: viewer cannot publish
  it('denies Viewer from publishing a crisis response', async () => {
    await expect(
      crisisService.publishResponse({
        incidentId: incident.id,
        responseId: approvedResponse.id,
        organizationId: org.id,
        userRole: 'viewer',
      })
    ).rejects.toThrow(InsufficientPermissionError);
  });

  // NEGATIVE: cross-tenant isolation
  it('denies user from publishing a response belonging to another organization', async () => {
    await expect(
      crisisService.publishResponse({
        incidentId: incident.id,        // belongs to org
        responseId: approvedResponse.id,
        organizationId: otherOrg.id,    // different org
        userRole: 'admin',
      })
    ).rejects.toThrow(ResourceAccessError);
  });

  // NEGATIVE: unauthenticated
  it('returns 401 for unauthenticated API requests', async () => {
    const res = await app.request('/api/crisis/responses/publish', {
      method: 'POST',
      body: JSON.stringify({ responseId: approvedResponse.id }),
    });
    expect(res.status).toBe(401);
  });
});
```

---

## 3. Unit Testing

### 3.1 Standards

| Standard | Value |
|----------|-------|
| **Test runner** | Bun test (built-in — no Jest installation required) |
| **Coverage tool** | `bun test --coverage` |
| **File naming** | `{filename}.test.ts` co-located with source file |
| **Mocking** | Bun's built-in `mock()` function |
| **Assertion library** | Bun's built-in `expect` (Jest-compatible) |
| **Organization** | `describe` blocks per class/module, `it` blocks per behavior |

### 3.2 Unit Test Structure and Conventions

```typescript
// services/monitoring/monitoring.service.test.ts

import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import { MonitoringService } from './monitoring.service';
import { ResourceNotFoundError, InsufficientPermissionError } from '@lib/errors/errors';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCache = createMockCache();
    monitoringService = new MonitoringService({ db: mockDb, cache: mockCache });
  });

  afterEach(() => {
    mock.restore(); // Clean up all mocks
  });

  describe('getArticle', () => {
    // ─── Happy Path ──────────────────────────────────────────────────
    it('returns article when found in organization', async () => {
      const article = buildTestArticle({ organizationId: 'org_test' });
      mockDb.query.mockResolvedValue([article]);

      const result = await monitoringService.getArticle({
        articleId: article.id,
        organizationId: 'org_test',
        userRole: 'analyst',
      });

      expect(result).toMatchObject({
        id: article.id,
        organizationId: 'org_test',
      });
    });

    it('returns article from cache on cache hit', async () => {
      const article = buildTestArticle({ organizationId: 'org_test' });
      mockCache.get.mockResolvedValue(article);

      await monitoringService.getArticle({
        articleId: article.id,
        organizationId: 'org_test',
        userRole: 'analyst',
      });

      // Database should NOT be queried on cache hit
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    // ─── Error Cases ─────────────────────────────────────────────────
    it('throws ResourceNotFoundError when article does not exist', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(
        monitoringService.getArticle({
          articleId: 'art_nonexistent',
          organizationId: 'org_test',
          userRole: 'analyst',
        })
      ).rejects.toThrow(ResourceNotFoundError);
    });

    // ─── Negative / Security Tests ────────────────────────────────────
    it('throws ResourceAccessError when article belongs to a different organization', async () => {
      const article = buildTestArticle({ organizationId: 'org_other' });
      mockDb.query.mockResolvedValue([article]);

      await expect(
        monitoringService.getArticle({
          articleId: article.id,
          organizationId: 'org_test', // Different org
          userRole: 'admin',
        })
      ).rejects.toThrow(ResourceAccessError);
    });
  });

  describe('calculatePRValueNaira', () => {
    it('correctly calculates ₦ PR value from reach and authority score', () => {
      // PR value calculation: reach × authority_multiplier × sentiment_multiplier
      const result = monitoringService.calculatePRValueNaira({
        reachEstimate: 500000,
        authorityScore: 80,
        sentimentLabel: 'positive',
      });

      // Positive sentiment gets 1.2× multiplier
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      // Verify it returns a reasonable ₦ amount (not USD, not kobo)
      expect(result).toBeGreaterThan(10000); // At least ₦10,000 for 500K reach
    });

    it('returns lower ₦ value for negative sentiment', () => {
      const positive = monitoringService.calculatePRValueNaira({
        reachEstimate: 100000,
        authorityScore: 70,
        sentimentLabel: 'positive',
      });

      const negative = monitoringService.calculatePRValueNaira({
        reachEstimate: 100000,
        authorityScore: 70,
        sentimentLabel: 'negative',
      });

      expect(negative).toBeLessThan(positive);
    });

    it('handles zero reach without throwing', () => {
      const result = monitoringService.calculatePRValueNaira({
        reachEstimate: 0,
        authorityScore: 50,
        sentimentLabel: 'neutral',
      });

      expect(result).toBe(0);
    });
  });
});
```

### 3.3 Naira-Specific Unit Tests

All monetary calculations must have dedicated unit tests that validate the ₦ denomination:

```typescript
describe('BillingService - Nigerian Naira (₦) calculations', () => {
  describe('calculateSubscriptionPrice', () => {
    it('returns correct monthly price for Starter plan in ₦', () => {
      const price = billingService.calculateSubscriptionPrice({
        planTier: 'starter',
        billingCycle: 'monthly',
      });
      expect(price.amountNaira).toBe(50000); // ₦50,000/month
      expect(price.currency).toBe('NGN');
    });

    it('returns correct annual price for Growth plan in ₦ with discount', () => {
      const price = billingService.calculateSubscriptionPrice({
        planTier: 'growth',
        billingCycle: 'annual',
      });
      // ₦120,000/month × 12 = ₦1,440,000 (annual rate, not monthly rate × 12)
      expect(price.amountNaira).toBe(1440000);
      expect(price.discountPercentage).toBe(20); // 20% annual discount
      expect(price.currency).toBe('NGN');
    });

    it('never returns amounts in USD or other currencies', () => {
      const tiers = ['starter', 'growth', 'professional', 'enterprise', 'agency'] as const;
      for (const tier of tiers) {
        const price = billingService.calculateSubscriptionPrice({
          planTier: tier,
          billingCycle: 'monthly',
        });
        expect(price.currency).toBe('NGN'); // Always NGN, never USD
        expect(price.amountNaira).toBeGreaterThan(0);
      }
    });

    it('correctly formats ₦ amount for display', () => {
      const formatted = billingService.formatNaira(150000);
      expect(formatted).toBe('₦150,000.00');
    });
  });
});
```

### 3.4 WAT Timezone Unit Tests

```typescript
describe('NotificationService - WAT timezone handling', () => {
  it('schedules morning digest at 8:00 AM WAT, not UTC', () => {
    const schedule = notificationService.getMorningDigestSchedule({
      organizationTimezone: 'Africa/Lagos', // WAT = UTC+1
    });

    // 8:00 AM WAT = 7:00 AM UTC
    expect(schedule.cronExpression).toBe('0 7 * * 1'); // 7 AM UTC = 8 AM WAT on Mondays
  });

  it('respects quiet hours in WAT timezone', () => {
    const isQuietHour = notificationService.isQuietHour({
      currentTimeUTC: new Date('2026-07-21T23:00:00Z'), // Midnight WAT (UTC+1)
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timezone: 'Africa/Lagos',
    });

    expect(isQuietHour).toBe(true);
  });
});
```

---

## 4. Integration Testing

### 4.1 Standards

| Standard | Value |
|----------|-------|
| **Framework** | Bun test + Hono test client |
| **Database** | Dedicated PostgreSQL test database (reset per test run) |
| **Isolation** | Each test suite uses database transactions rolled back after each test |
| **Coverage target** | ≥ 70% of Hono API endpoints |
| **Mocking strategy** | External services mocked (Paystack, social APIs); database is real |
| **File location** | `tests/integration/{module}.test.ts` |

### 4.2 Integration Test Setup

```typescript
// tests/integration/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { db } from '@db/index';
import { sql } from 'drizzle-orm';

// Global test setup — runs once before all integration tests
beforeAll(async () => {
  // Apply all pending migrations to test database
  await runMigrations();
  // Set WAT timezone for consistent date handling
  process.env.TZ = 'Africa/Lagos';
});

afterAll(async () => {
  await db.$client.end();
});

// Per-test isolation using PostgreSQL savepoints
let savepoint: string;

beforeEach(async () => {
  savepoint = `sp_${Date.now()}`;
  await db.execute(sql.raw(`SAVEPOINT ${savepoint}`));
});

afterEach(async () => {
  // Roll back all changes after each test
  await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
});

export { app };
```

### 4.3 Complete Integration Test Example

```typescript
// tests/integration/monitoring.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { app } from './setup';
import { createTestOrganization, createTestUser, createTestArticle } from '@tests/fixtures';

describe('API: Media Monitoring', () => {
  let orgA: TestOrganization;
  let orgB: TestOrganization;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    orgA = await createTestOrganization({ planTier: 'professional' });
    orgB = await createTestOrganization({ planTier: 'starter' });
    const admin = await createTestUser({ organizationId: orgA.id, role: 'admin' });
    const viewer = await createTestUser({ organizationId: orgA.id, role: 'viewer' });
    adminToken = admin.accessToken;
    viewerToken = viewer.accessToken;

    // Seed test articles for orgA
    await createTestArticle({
      organizationId: orgA.id,
      sentimentLabel: 'positive',
      sourceType: 'newspaper',
      reachEstimate: 500000,
      aveNaira: 250000, // ₦250,000 advertising value
    });
  });

  // ─── Authentication Tests ──────────────────────────────────────────
  describe('Authentication', () => {
    it('returns 401 for requests without a token', async () => {
      const res = await app.request('/api/monitoring/articles');
      expect(res.status).toBe(401);
    });

    it('returns 401 for requests with an expired token', async () => {
      const res = await app.request('/api/monitoring/articles', {
        headers: { Authorization: 'Bearer expired.jwt.token' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Successful Read Tests ─────────────────────────────────────────
  describe('GET /api/monitoring/articles', () => {
    it('returns articles for the authenticated organization', async () => {
      const res = await app.request('/api/monitoring/articles', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeArray();
      expect(body.pagination).toHaveProperty('cursor');
      expect(body.pagination).toHaveProperty('hasMore');
    });

    it('returns AVE values in Nigerian Naira (₦)', async () => {
      const res = await app.request('/api/monitoring/articles', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      const article = body.data[0];
      // Verify ₦ field naming convention
      expect(article).toHaveProperty('aveNaira');
      expect(typeof article.aveNaira).toBe('number');
      expect(article.aveNaira).toBeGreaterThan(0);
      // Verify it does NOT have USD fields
      expect(article).not.toHaveProperty('aveUsd');
      expect(article).not.toHaveProperty('aveAmount');
    });

    it('paginates results with cursor-based pagination', async () => {
      const firstPage = await app.request('/api/monitoring/articles?limit=2', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const firstBody = await firstPage.json();
      expect(firstBody.data.length).toBeLessThanOrEqual(2);
      expect(firstBody.pagination.cursor).toBeDefined();

      // Fetch second page using cursor
      const secondPage = await app.request(
        `/api/monitoring/articles?limit=2&cursor=${firstBody.pagination.cursor}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const secondBody = await secondPage.json();
      expect(secondBody.success).toBe(true);
      // Second page should not repeat first page results
      const firstIds = firstBody.data.map((a: Article) => a.id);
      const secondIds = secondBody.data.map((a: Article) => a.id);
      expect(firstIds).not.toEqual(expect.arrayContaining(secondIds));
    });
  });

  // ─── Multi-Tenant Isolation Tests ─────────────────────────────────
  describe('Multi-tenant isolation', () => {
    it('never returns articles belonging to a different organization', async () => {
      // Create article for orgB
      const orgBArticle = await createTestArticle({ organizationId: orgB.id });

      // Query as orgA admin
      const res = await app.request('/api/monitoring/articles', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      const returnedIds = body.data.map((a: Article) => a.id);
      expect(returnedIds).not.toContain(orgBArticle.id);
    });

    it('returns 403 when accessing a specific article from another organization', async () => {
      const orgBArticle = await createTestArticle({ organizationId: orgB.id });

      const res = await app.request(`/api/monitoring/articles/${orgBArticle.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(403);
    });
  });

  // ─── Rate Limiting Tests ───────────────────────────────────────────
  describe('Rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      // Make 101 requests (limit is 100/minute for read endpoints)
      const requests = Array.from({ length: 101 }, () =>
        app.request('/api/monitoring/articles', {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter((r) => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);

      // Verify Retry-After header is present
      const rateLimitedResponse = tooManyRequests[0];
      expect(rateLimitedResponse.headers.get('Retry-After')).toBeTruthy();
    });
  });
});
```

### 4.4 Billing Integration Tests (₦)

```typescript
// tests/integration/billing.test.ts
describe('API: Billing (Nigerian Naira)', () => {
  describe('GET /api/billing/subscription', () => {
    it('returns subscription with ₦ pricing', async () => {
      const res = await app.request('/api/billing/subscription', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const sub = body.data.subscription;

      expect(sub.monthlyPriceNaira).toBeDefined();
      expect(sub.currency).toBe('NGN');
      expect(sub.planTier).toBe('growth');
      // ₦150,000/month for Growth
      expect(sub.monthlyPriceNaira).toBe(150000);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('returns invoices with all amounts in ₦', async () => {
      const res = await app.request('/api/billing/invoices', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      for (const invoice of body.data) {
        expect(invoice).toHaveProperty('amountNaira');
        expect(invoice).toHaveProperty('totalNaira');
        expect(invoice.currency).toBe('NGN');
        // Verify amounts are reasonable ₦ values (not USD cents or kobo)
        expect(invoice.totalNaira).toBeGreaterThan(1000); // At least ₦1,000
      }
    });
  });
});
```

---

## 5. End-to-End (E2E) Testing

### 5.1 Standards

| Standard | Value |
|----------|-------|
| **Web framework** | Playwright (latest) |
| **Mobile framework** | Maestro (latest) |
| **Test environment** | Staging environment |
| **Execution frequency** | Daily scheduled job + on every merge to `main` |
| **Authentication** | Pre-seeded test accounts per role |
| **Data isolation** | Each test suite uses isolated test organization |

### 5.2 E2E User Journeys to Test

All journeys defined in the User Journeys document must have a corresponding Playwright test:

| # | Journey | Personas | Priority | Playwright File |
|---|---------|---------|---------|----------------|
| 1 | **Discovery & Signup** | All | 🔴 High | `onboarding.spec.ts` |
| 2 | **Onboarding & Setup** | All | 🔴 High | `onboarding.spec.ts` |
| 3 | **Media Monitoring** | Ade, Chidi | 🔴 High | `media-monitoring.spec.ts` |
| 4 | **Crisis Detection & Response** | Ngozi, Ade | 🔴 High | `crisis-response.spec.ts` |
| 5 | **Social Publishing** | Bola, Chidi | 🔴 High | `social-publishing.spec.ts` |
| 6 | **Engagement & Response** | Bola, Chidi | 🔴 High | `engagement.spec.ts` |
| 7 | **Analytics & Reporting** | Tunde, Ade | 🔴 High | `analytics.spec.ts` |
| 8 | **PR & Media Relations** | Ade, Ifeoma | 🟡 Medium | `pr-relations.spec.ts` |
| 9 | **Competitive Intelligence** | Ade, Chidi | 🟡 Medium | `competitive.spec.ts` |
| 10 | **Agency Client Management** | Ifeoma | 🟡 Medium | `agency.spec.ts` |
| 11 | **Content Strategy** | Kemi, Chidi | 🟡 Medium | `content-strategy.spec.ts` |
| 12 | **Billing Management (₦)** | All | 🔴 High | `billing.spec.ts` |

### 5.3 Playwright Test Structure

```typescript
// tests/e2e/crisis-response.spec.ts
import { test, expect, Page } from '@playwright/test';
import { loginAs, createTestIncident } from './helpers';

test.describe('Crisis Detection and Response', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Login as Crisis Manager (Ngozi persona)
    await loginAs(page, 'crisis_manager@testbrand.ng');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Crisis Manager receives Severity 4 alert and publishes a response within 15 minutes', async () => {
    // Step 1: Navigate to crisis dashboard
    await page.goto('/monitor/crisis');
    await expect(page.getByTestId('crisis-dashboard')).toBeVisible();

    // Step 2: Simulate a Severity 4 crisis alert
    await createTestIncident({ severity: 4 });

    // Step 3: Verify alert appears in dashboard
    await expect(page.getByTestId('active-crisis-alert')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('severity-badge')).toContainText('S4');

    // Step 4: Open crisis brief
    await page.getByTestId('view-crisis-brief').click();
    await expect(page.getByTestId('crisis-command-panel')).toBeVisible();
    await expect(page.getByTestId('mention-count')).toBeVisible();
    await expect(page.getByTestId('sentiment-breakdown')).toBeVisible();

    // Step 5: Confirm severity classification
    await page.getByTestId('confirm-severity').click();
    await expect(page.getByTestId('stakeholders-notified')).toBeVisible();

    // Step 6: Select response template
    await page.getByTestId('select-template').click();
    await page.getByTestId('template-social-backlash').click();
    await page.getByTestId('use-template').click();

    // Step 7: Verify response draft loaded
    await expect(page.getByTestId('response-editor')).toContainText('We are aware');
    const brandVoiceCheck = page.getByTestId('brand-voice-indicator');
    await expect(brandVoiceCheck).toContainText('Good');

    // Step 8: Submit for emergency approval
    await page.getByTestId('submit-emergency-approval').click();
    await expect(page.getByTestId('approval-status')).toContainText('Pending');

    // Step 9: Simulate manager approval (in a separate session)
    // [In real tests this would be a second browser context]
    await page.getByTestId('approve-response-btn').click();
    await expect(page.getByTestId('approval-status')).toContainText('Approved');

    // Step 10: Publish to all channels
    await page.getByTestId('publish-all-channels').click();
    await expect(page.getByTestId('publish-confirmation')).toContainText('Published');

    // Step 11: Verify live sentiment monitor appears
    await expect(page.getByTestId('post-response-sentiment-chart')).toBeVisible();
  });

  test('Crisis dashboard shows ₦ equivalent impact estimate', async () => {
    await page.goto('/monitor/crisis');
    await createTestIncident({ severity: 3, reachEstimate: 2000000 });

    await expect(page.getByTestId('active-crisis-alert')).toBeVisible({ timeout: 10000 });

    // Verify impact is shown in ₦, not USD
    const impactDisplay = page.getByTestId('estimated-brand-impact');
    await expect(impactDisplay).toBeVisible();
    await expect(impactDisplay).toContainText('₦');
  });
});
```

### 5.4 Billing E2E Test (₦)

```typescript
// tests/e2e/billing.spec.ts
test.describe('Billing Management (Nigerian Naira)', () => {
  test('Organization admin can view subscription pricing in ₦', async ({ page }) => {
    await loginAs(page, 'admin@testbrand.ng');
    await page.goto('/settings/organization/billing');

    // Verify pricing is displayed in ₦
    await expect(page.getByTestId('plan-price')).toContainText('₦');
    await expect(page.getByTestId('next-invoice-amount')).toContainText('₦');
    await expect(page.getByTestId('currency-display')).toContainText('NGN');

    // Verify no USD amounts appear anywhere
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('$'); // No USD dollar signs
    expect(pageContent).not.toContain('USD');
  });

  test('Admin can view invoice history with ₦ amounts', async ({ page }) => {
    await loginAs(page, 'admin@testbrand.ng');
    await page.goto('/settings/organization/billing');

    await page.getByTestId('view-invoices').click();
    await expect(page.getByTestId('invoice-list')).toBeVisible();

    const firstInvoice = page.getByTestId('invoice-row').first();
    await expect(firstInvoice.getByTestId('invoice-amount')).toContainText('₦');
  });
});
```

### 5.5 Maestro Mobile Tests

```yaml
# tests/e2e/mobile/crisis-alert.yaml
appId: com.nawebeus.app
---
- launchApp
- tapOn: "Login with email"
- inputText:
    text: "crisis_manager@testbrand.ng"
    id: "email-input"
- tapOn: "Next"
- inputText:
    text: "TestP@ss123"
    id: "password-input"
- tapOn: "Login"
- assertVisible: "Dashboard"

# Navigate to monitoring
- tapOn: "Monitor"
- assertVisible: "Media Monitoring"

# Verify crisis alert card appears (simulated via test API)
- waitForAnimationToEnd
- assertVisible: "ACTIVE CRISIS"
- assertVisible: "S4"

# Open crisis brief
- tapOn: "View Crisis Brief"
- assertVisible: "Crisis Command"
- assertVisible: "Stakeholder Notifications"

# Verify ₦ impact shown on mobile
- assertVisible: "₦"

# Take screenshot for visual regression
- takeScreenshot: "crisis-alert-mobile"
```

---

## 6. Security Testing

### 6.1 Standards

| Standard | Value |
|----------|-------|
| **Automated scanning** | OWASP ZAP (weekly, on staging) |
| **Dependency scanning** | `bun audit` + Snyk (every PR + weekly) |
| **Container scanning** | Trivy (every Docker build) |
| **Manual review** | Quarterly external penetration test |
| **Gate** | No HIGH or CRITICAL CVEs may be merged |

### 6.2 Security Test Coverage Matrix

| Security Area | Test Type | Tool | Frequency |
|--------------|-----------|------|-----------|
| SQL injection | Automated | OWASP ZAP, parameterized query tests | Every PR |
| XSS | Automated | OWASP ZAP, CSP header tests | Every PR |
| CSRF | Automated | SameSite cookie tests | Every PR |
| JWT security | Unit tests | Custom tests | Every PR |
| RBAC enforcement | Integration tests | Custom tests | Every PR |
| Multi-tenant isolation (RLS) | Integration tests | Custom isolation tests | Every PR |
| Rate limiting | Integration tests | Custom load tests | Every PR |
| Dependency vulnerabilities | Automated scan | Snyk + bun audit | Every PR + weekly |
| Secrets in code | Pre-commit hook | detect-secrets | Every commit |
| NDPR data handling | Manual review | Checklist | Quarterly |
| Paystack webhook security | Integration tests | Signature verification tests | Every PR |

### 6.3 Multi-Tenant Isolation Security Tests

```typescript
// tests/security/tenant-isolation.test.ts
describe('Security: Multi-Tenant Data Isolation (RLS)', () => {
  let orgA: TestOrganization;
  let orgB: TestOrganization;
  let orgAAdminToken: string;

  beforeAll(async () => {
    orgA = await createTestOrganization();
    orgB = await createTestOrganization();
    const orgAAdmin = await createTestUser({ organizationId: orgA.id, role: 'admin' });
    orgAAdminToken = orgAAdmin.accessToken;

    // Create data for both organizations
    await createTestArticle({ organizationId: orgA.id });
    await createTestArticle({ organizationId: orgB.id });
    await createTestMention({ organizationId: orgB.id });
    await createTestConversation({ organizationId: orgB.id });
  });

  const sensitiveEndpoints = [
    { path: '/api/monitoring/articles', method: 'GET' },
    { path: '/api/monitoring/mentions', method: 'GET' },
    { path: '/api/engage/conversations', method: 'GET' },
    { path: '/api/publish/posts', method: 'GET' },
    { path: '/api/analyze/reports', method: 'GET' },
    { path: '/api/billing/invoices', method: 'GET' },
  ];

  // Test every sensitive endpoint for isolation
  for (const endpoint of sensitiveEndpoints) {
    it(`${endpoint.method} ${endpoint.path} never returns other organization's data`, async () => {
      const res = await app.request(endpoint.path, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${orgAAdminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // Every returned item must belong to orgA
      for (const item of body.data ?? []) {
        expect(item.organizationId).toBe(orgA.id);
        expect(item.organizationId).not.toBe(orgB.id);
      }
    });
  }

  it('prevents direct object reference (IDOR) attacks', async () => {
    // orgB's article ID accessed by orgA's admin
    const orgBArticle = await createTestArticle({ organizationId: orgB.id });

    const res = await app.request(`/api/monitoring/articles/${orgBArticle.id}`, {
      headers: { Authorization: `Bearer ${orgAAdminToken}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('RESOURCE_ACCESS_ERROR');
  });

  it('prevents bulk data extraction via filter manipulation', async () => {
    // Attempt to filter by another org's ID in query params
    const res = await app.request(
      `/api/monitoring/articles?organizationId=${orgB.id}`,
      { headers: { Authorization: `Bearer ${orgAAdminToken}` } }
    );

    // Should succeed but return only orgA's data (RLS enforced at DB)
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const item of body.data) {
      expect(item.organizationId).toBe(orgA.id);
    }
  });
});
```

### 6.4 Paystack Webhook Security Tests

```typescript
describe('Security: Paystack Webhook Signature Verification', () => {
  it('accepts webhook with valid HMAC-SHA512 signature', async () => {
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PS_REF_123', amount: 15000000 }, // ₦150,000 in kobo
    });

    const signature = createHMACSHA512(payload, process.env.PAYSTACK_WEBHOOK_SECRET!);

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature,
      },
      body: payload,
    });

    expect(res.status).toBe(200);
  });

  it('rejects webhook with invalid signature', async () => {
    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': 'invalid_signature',
      },
      body: JSON.stringify({ event: 'charge.success' }),
    });

    expect(res.status).toBe(401);
  });

  it('rejects webhook with missing signature header', async () => {
    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'charge.success' }),
    });

    expect(res.status).toBe(401);
  });
});
```

---

## 7. Performance Testing

### 7.1 Standards

| Standard | Value |
|----------|-------|
| **Framework** | k6 |
| **Environment** | Dedicated performance staging environment |
| **Frequency** | Monthly (or after major changes), before major Nigerian market campaigns |
| **Baseline** | Established from pilot phase traffic |

### 7.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Web app initial load (SSR) | <2 seconds P95 | Lighthouse CI |
| Dashboard interactive | <3 seconds P95 | Real user monitoring |
| API read (cache hit) | <50ms P95 | Prometheus |
| API read (cache miss) | <200ms P95 | Prometheus |
| API write (simple) | <100ms P95 | Prometheus |
| Crisis alert detection-to-delivery | <2 minutes | Alert timestamp tracking |
| Media mention indexing | <15 minutes from publication | Ingestion pipeline monitoring |
| Report generation (standard) | <30 seconds | Background job timing |
| Core Web Vitals (LCP) | <2.5 seconds | Lighthouse CI |
| Core Web Vitals (CLS) | <0.1 | Lighthouse CI |
| Concurrent users (pilot) | 5,000+ | k6 load test |

### 7.3 k6 Load Test Suite

```javascript
// tests/performance/monitoring-feed.k6.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const monitoringFeedLatency = new Trend('monitoring_feed_latency');
const crisisAlertLatency = new Trend('crisis_alert_latency');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users (pilot scale)
    { duration: '5m', target: 100 },  // Ramp to 100 concurrent users
    { duration: '10m', target: 100 }, // Sustain 100 users
    { duration: '2m', target: 500 },  // Spike test (5× normal)
    { duration: '5m', target: 100 },  // Recovery
    { duration: '3m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],         // 95% of requests <500ms
    http_req_failed: ['rate<0.01'],           // Error rate <1%
    error_rate: ['rate<0.01'],
    monitoring_feed_latency: ['p(95)<200'],   // Monitoring feed <200ms
    crisis_alert_latency: ['p(99)<2000'],     // Crisis alerts <2 seconds
  },
};

const BASE_URL = 'https://staging.nawebeus.com';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };

  group('Monitoring Feed', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/monitoring/articles?limit=20`, { headers });
    monitoringFeedLatency.add(Date.now() - start);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time OK': (r) => r.timings.duration < 500,
      'has articles': (r) => JSON.parse(r.body).data.length > 0,
      'amounts in Naira': (r) => {
        const body = JSON.parse(r.body);
        return body.data[0]?.aveNaira !== undefined; // Verify ₦ field present
      },
    });

    errorRate.add(!success);
  });

  group('Crisis Dashboard', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/crisis/incidents?status=active`, { headers });
    crisisAlertLatency.add(Date.now() - start);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'crisis endpoint fast': (r) => r.timings.duration < 2000,
    });
  });

  sleep(1); // Think time between requests
}
```

### 7.4 Performance Test Scenarios

| Scenario | Duration | Target Users | Purpose |
|----------|----------|-------------|---------|
| **Baseline** | 10 minutes | 50 users | Establish baseline metrics |
| **Normal load** | 30 minutes | 100 users | Typical business hours (WAT) |
| **Peak load** | 15 minutes | 300 users | Nigerian business peak (9–11 AM WAT) |
| **Stress test** | 20 minutes | 1,000 users | Find breaking point |
| **Spike test** | 10 minutes | 0→500→0 users | Sudden traffic spike (viral crisis) |
| **Soak test** | 8 hours | 50 users | Sustained load (memory leaks, degradation) |

---

## 8. Accessibility Testing

### 8.1 Standards

| Standard | Value |
|----------|-------|
| **Guideline** | WCAG 2.1 Level AA |
| **Automated tool** | axe-core (Playwright integration) |
| **Manual tools** | NVDA (Windows), VoiceOver (macOS/iOS) |
| **Frequency** | Automated: every PR; Manual: quarterly |
| **Gate** | 0 violations at AA level before any PR merges |

### 8.2 Automated Accessibility Tests

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const criticalPages = [
  { path: '/dashboard', name: 'Executive Dashboard' },
  { path: '/monitor', name: 'Media Monitoring Feed' },
  { path: '/monitor/crisis', name: 'Crisis Dashboard' },
  { path: '/publish', name: 'Content Calendar' },
  { path: '/engage', name: 'Unified Inbox' },
  { path: '/analyze', name: 'Analytics Dashboard' },
  { path: '/settings/organization/billing', name: 'Billing Settings (₦)' },
];

for (const { path, name } of criticalPages) {
  test(`${name} passes WCAG 2.1 AA with zero violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[data-testid="chart-canvas"]') // Charts have table alternatives
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('Crisis alert is announced to screen readers immediately', async ({ page }) => {
  await page.goto('/monitor/crisis');

  // Trigger a simulated crisis alert
  await page.evaluate(() => {
    // Simulate WebSocket crisis alert
    window.dispatchEvent(new CustomEvent('crisis:alert', {
      detail: { severity: 4, title: 'GTBank fee backlash' }
    }));
  });

  // Verify ARIA live region announces the alert
  const liveRegion = page.getByRole('alert');
  await expect(liveRegion).toBeVisible();
  await expect(liveRegion).toContainText('Severity 4');
});

test('₦ currency values are readable by screen readers', async ({ page }) => {
  await page.goto('/settings/organization/billing');

  // Screen readers should read "150,000 Nigerian Naira" not just "₦150,000"
  const priceElement = page.getByTestId('subscription-price');
  const ariaLabel = await priceElement.getAttribute('aria-label');
  expect(ariaLabel).toContain('Nigerian Naira');
  expect(ariaLabel).toContain('150,000');
});
```

---

## 9. Visual Regression Testing

### 9.1 Standards

| Standard | Value |
|----------|-------|
| **Tool** | Chromatic (Storybook integration) |
| **Scope** | All shadcn/ui components + module-specific components |
| **Frequency** | Every PR |
| **Approval** | Design Lead must approve visual changes |

### 9.2 Playwright Visual Snapshot Tests

```typescript
// tests/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test('Executive dashboard matches baseline screenshot', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  // Wait for charts to render
  await page.waitForSelector('[data-testid="sentiment-chart"] canvas');

  await expect(page).toHaveScreenshot('executive-dashboard.png', {
    maxDiffPixelRatio: 0.02, // Allow 2% pixel difference
    mask: [
      page.getByTestId('last-updated-timestamp'), // Mask dynamic timestamps
      page.getByTestId('realtime-mention-count'),  // Mask live counters
    ],
  });
});

test('Crisis alert card matches baseline', async ({ page }) => {
  await page.goto('/monitor/crisis');
  await page.waitForSelector('[data-testid="active-crisis-alert"]');

  await expect(page.getByTestId('active-crisis-alert')).toHaveScreenshot(
    'crisis-alert-card.png'
  );
});

test('₦ billing invoice page matches baseline', async ({ page }) => {
  await page.goto('/settings/organization/billing');
  await expect(page).toHaveScreenshot('billing-page-naira.png', {
    mask: [page.getByTestId('invoice-date')],
  });
});
```

---

## 10. Test Environments

### 10.1 Environment Configuration

| Environment | Purpose | Database | External APIs | Who Has Access |
|------------|---------|---------|--------------|----------------|
| **Development** | Developer local testing | Local PostgreSQL (Docker) | Mocked | Individual developers |
| **CI** | Automated test execution | Ephemeral PostgreSQL | Mocked | GitHub Actions |
| **Staging** | Integration, E2E, performance | Staging PostgreSQL | Sandbox/test mode | All team members |
| **Production** | Live system | Production PostgreSQL | Live | End users (QA: read-only monitoring) |

### 10.2 Test Data Seeding Per Environment

```typescript
// db/seed/index.ts

const SEED_PROFILES = {
  development: {
    organizations: 5,         // Multiple Nigerian brand types
    usersPerOrg: 4,           // One per role
    articlesPerOrg: 50,       // Enough to test pagination
    mentionsPerOrg: 200,
    subscriptionPlanTiers: ['starter', 'growth', 'professional'], // ₦ pricing
    timezone: 'Africa/Lagos', // WAT default
  },
  ci: {
    organizations: 2,
    usersPerOrg: 4,
    articlesPerOrg: 10,
    mentionsPerOrg: 30,
    subscriptionPlanTiers: ['growth'],
    timezone: 'Africa/Lagos',
  },
  staging: {
    organizations: 10,
    usersPerOrg: 5,
    articlesPerOrg: 500,
    mentionsPerOrg: 2000,
    subscriptionPlanTiers: ['starter', 'growth', 'professional', 'enterprise', 'agency'],
    timezone: 'Africa/Lagos',
  },
};
```

### 10.3 Test Data Privacy

- **Never use real user data** in development, CI, or staging environments
- **Generate synthetic Nigerian-context data**: Nigerian names, Nigerian phone numbers (+234), Nigerian addresses, NGN amounts
- **Anonymize production exports** before use in staging (remove PII via script)
- **NDPR compliance**: Even test environments follow NDPR data handling rules

```typescript
// tests/fixtures/organizations.ts
export function createTestOrganization(overrides = {}) {
  return {
    id: generateId('org'),
    name: faker.company.name() + ' Nigeria',
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    industry: faker.helpers.arrayElement(['banking', 'fintech', 'telecom', 'fmcg']),
    currency: 'NGN',                           // Always NGN
    timezone: 'Africa/Lagos',                  // Always WAT
    planTier: 'growth',
    subscriptionStatus: 'active',
    ...overrides,
  };
}

export function createTestUser(overrides = {}) {
  return {
    id: generateId('usr'),
    email: faker.internet.email({ provider: 'testbrand.ng' }), // Nigerian domain
    fullName: faker.person.fullName(),
    phone: `+234${faker.string.numeric(10)}`,  // Nigerian phone format
    role: 'analyst',
    timezone: 'Africa/Lagos',
    ...overrides,
  };
}

export function createTestSubscription(orgId: string, overrides = {}) {
  return {
    id: generateId('sub'),
    organizationId: orgId,
    planTier: 'growth',
    billingCycle: 'monthly',
    monthlyPriceNaira: 150000,  // ₦150,000 — never use USD
    currency: 'NGN',
    status: 'active',
    ...overrides,
  };
}
```

---

## 11. CI/CD Integration

### 11.1 Full CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI — Nawebeus Quality Gates

on:
  push:
    branches: [main, 'feature/**', 'bugfix/**', 'hotfix/**']
  pull_request:
    branches: [main]

env:
  TZ: Africa/Lagos                    # WAT timezone for all CI jobs
  DEFAULT_CURRENCY: NGN

jobs:
  # ─── Stage 1: Code Quality (fast — ~3 minutes) ─────────────────────
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with: { bun-version: '1.x' }
      - run: bun install --frozen-lockfile

      - name: TypeScript type check
        run: bun run typecheck

      - name: ESLint (including import boundary check)
        run: bun run lint

      - name: Prettier format check
        run: bun run format:check

      - name: Check for secrets in code
        uses: trufflesecurity/trufflehog@main
        with: { path: ./ }

  # ─── Stage 2: Unit Tests (fast — ~5 minutes) ───────────────────────
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: code-quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile

      - name: Run unit tests with coverage
        run: bun test --coverage
        env:
          TZ: Africa/Lagos

      - name: Enforce coverage thresholds
        run: |
          bun test --coverage \
            --coverage-threshold='{"services":85,"lib":90}'

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4

  # ─── Stage 3: Integration Tests (~10 minutes) ──────────────────────
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: code-quality
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: nawebeus_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile

      - name: Run database migrations
        run: bun run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/nawebeus_test

      - name: Run integration tests
        run: bun test tests/integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/nawebeus_test
          TZ: Africa/Lagos
          PAYSTACK_WEBHOOK_SECRET: test_webhook_secret_for_ci

  # ─── Stage 4: Security Scanning (~5 minutes) ───────────────────────
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: code-quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile

      - name: Dependency vulnerability scan
        run: bun audit
        # Fails on HIGH or CRITICAL CVEs

      - name: Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Docker image security scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'nawebeus:${{ github.sha }}'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'

  # ─── Stage 5: Accessibility Check (every PR) ───────────────────────
  accessibility:
    name: Accessibility (WCAG 2.1 AA)
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile

      - name: Install Playwright browsers
        run: bun x playwright install --with-deps chromium

      - name: Run accessibility tests
        run: bun x playwright test tests/e2e/accessibility.spec.ts

  # ─── Stage 6: Build (~5 minutes) ───────────────────────────────────
  build:
    name: Production Build
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, security-scan]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run build

      - name: Build Docker image
        run: docker build -t nawebeus:${{ github.sha }} .

  # ─── Stage 7: E2E Tests (on merge to main only) ────────────────────
  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - name: Install Playwright browsers
        run: bun x playwright install --with-deps
      - name: Run E2E tests against staging
        run: bun x playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_ADMIN_TOKEN: ${{ secrets.STAGING_TEST_ADMIN_TOKEN }}
          TZ: Africa/Lagos

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 11.2 CI Gates Summary

| Gate | Blocks Merge? | Minimum to Pass |
|------|--------------|----------------|
| TypeScript type check | ✅ Yes | 0 errors |
| ESLint (including import boundaries) | ✅ Yes | 0 errors |
| Prettier formatting | ✅ Yes | 0 violations |
| Secret detection | ✅ Yes | 0 secrets found |
| Unit test coverage — services | ✅ Yes | ≥85% line coverage |
| Unit test coverage — lib | ✅ Yes | ≥90% line coverage |
| Integration test suite | ✅ Yes | 100% pass rate |
| Security scan (Snyk + bun audit) | ✅ Yes | No HIGH/CRITICAL CVEs |
| WCAG 2.1 AA accessibility | ✅ Yes | 0 axe-core violations |
| Reviewer approvals | ✅ Yes | ≥1 approval (≥2 for security/billing changes) |
| E2E tests (staging) | ✅ Yes (post-merge) | 100% pass rate |

### 11.3 CD Pipeline (Post-Merge)

```
Merge to main
    │
    ▼
Build Docker image
    │
    ▼
Deploy to staging (Coolify blue-green)
    │
    ▼
Run smoke tests on staging
    │
    ▼
Run full Playwright E2E suite on staging
    │
    ▼
[Manual QA sign-off for major releases]
    │
    ▼
Deploy to production (blue-green)
    │
    ▼
Run production smoke tests
    │
    ▼
Monitor error rate for 30 minutes
    │
    ├── Error rate spike → Auto-rollback
    └── Stable → Release complete
```

---

## 12. Test Organization and File Structure

### 12.1 File Structure

```
tests/
├── integration/                        # API integration tests
│   ├── setup.ts                        # DB setup, teardown, fixtures
│   ├── monitoring.test.ts
│   ├── publishing.test.ts
│   ├── engagement.test.ts
│   ├── analytics.test.ts
│   ├── crisis.test.ts
│   ├── campaigns.test.ts
│   ├── billing.test.ts                 # ₦ billing integration tests
│   ├── rbac.test.ts                    # Cross-module RBAC boundary tests
│   └── webhooks/
│       └── paystack.test.ts            # Paystack webhook signature tests
│
├── e2e/                                # Playwright web E2E tests
│   ├── onboarding.spec.ts
│   ├── media-monitoring.spec.ts
│   ├── crisis-response.spec.ts
│   ├── social-publishing.spec.ts
│   ├── engagement.spec.ts
│   ├── analytics.spec.ts
│   ├── billing.spec.ts                 # ₦ billing E2E tests
│   ├── accessibility.spec.ts           # WCAG 2.1 AA automated tests
│   ├── visual-regression.spec.ts       # Screenshot comparison tests
│   └── helpers/
│       ├── auth.ts                     # Login helpers per role
│       ├── fixtures.ts                 # Test data creators
│       └── api.ts                      # Test API utilities
│
├── e2e/mobile/                         # Maestro mobile E2E tests
│   ├── login.yaml
│   ├── monitoring-feed.yaml
│   ├── crisis-alert.yaml
│   └── inbox.yaml
│
├── security/                           # Security-specific tests
│   ├── tenant-isolation.test.ts        # RLS multi-tenant tests
│   ├── rbac-boundaries.test.ts         # Permission boundary tests
│   ├── sql-injection.test.ts
│   ├── rate-limiting.test.ts
│   └── paystack-webhook-security.test.ts
│
├── performance/                        # k6 load test scripts
│   ├── monitoring-feed.k6.js
│   ├── publishing.k6.js
│   ├── concurrent-crisis.k6.js         # Spike: multiple simultaneous crises
│   └── billing-load.k6.js             # ₦ billing endpoint load
│
└── fixtures/                           # Shared test data factories
    ├── organizations.ts                # createTestOrganization() — WAT, NGN defaults
    ├── users.ts                        # createTestUser(role)
    ├── articles.ts                     # createTestArticle() — aveNaira field
    ├── mentions.ts                     # createTestMention()
    ├── conversations.ts                # createTestConversation()
    ├── billing.ts                      # createTestSubscription() — ₦ pricing
    └── crisis.ts                       # createTestIncident(severity)
```

Note: Unit tests are **co-located** with service files:
```
services/monitoring/
├── monitoring.service.ts
└── monitoring.service.test.ts   ← Co-located unit test
```

### 12.2 Naming Conventions

| Test Type | File Pattern | Example |
|-----------|-------------|---------|
| Unit tests (co-located) | `{filename}.test.ts` | `monitoring.service.test.ts` |
| Integration tests | `{module}.test.ts` | `billing.test.ts` |
| E2E tests | `{journey}.spec.ts` | `crisis-response.spec.ts` |
| Mobile E2E | `{flow}.yaml` | `crisis-alert.yaml` |
| Performance tests | `{scenario}.k6.js` | `concurrent-crisis.k6.js` |
| Security tests | `{area}.test.ts` | `tenant-isolation.test.ts` |

### 12.3 Test Description Conventions

```typescript
// ✅ Clear, behavior-focused, Nigerian context where relevant
it('allows Admin to suspend a team member in the same organization');
it('denies Manager from suspending another Manager (same-level protection)');
it('returns ₦ AVE values in Nigerian Naira for all articles');
it('delivers crisis alert within 2 minutes of S4 detection in WAT timezone');
it('processes Paystack ₦150,000 Growth plan payment and activates subscription');

// ❌ Vague, not behavior-focused
it('works correctly');
it('should pass');
it('test billing');
```

---

## 13. Bug Management

### 13.1 Bug Severity Levels

| Severity | Definition | Examples | Response SLA | Resolution SLA |
|----------|-----------|---------|-------------|----------------|
| **P0 — Critical** | System down, data loss, security breach, billing failure | API returning 500 for all requests; multi-tenant isolation breach; Paystack ₦ charge without subscription activation | Immediate — on-call engineer paged | <4 hours |
| **P1 — High** | Major feature broken with significant user impact, no workaround | Crisis alerts not delivered; monitoring feed empty for all organizations; login broken | <2 hours | <1 business day |
| **P2 — Medium** | Feature broken, workaround exists or limited impact | Report export fails for 1 format; incorrect ₦ formatting on invoice PDF | <1 business day | <1 week |
| **P3 — Low** | Cosmetic issue, minor inconvenience | Tooltip misaligned; minor translation issue | <1 week | <2 weeks |

### 13.2 Bug Report Template

```markdown
## Bug Report — [Short Description]

**Reported by:** [Name]
**Date (WAT):** [Date and time in WAT]
**Environment:** [Development / Staging / Production]
**Severity:** [P0 / P1 / P2 / P3]

---

### Affected Feature
[Which module / feature is broken]

### User Context
- **User Role:** [e.g., Admin, Manager, Viewer]
- **Organization Plan:** [e.g., Growth — ₦150,000/month]
- **Browser / Device:** [e.g., Chrome 126, MacBook Pro]
- **Platform:** [Web / Mobile iOS / Mobile Android]

### Steps to Reproduce
1. [Exact step]
2. [Exact step]
3. [Exact step]

### Expected Behavior
[What should happen, including expected ₦ amounts or WAT timestamps if relevant]

### Actual Behavior
[What actually happens, including any error messages or incorrect values]

### Evidence
- [ ] Screenshot attached
- [ ] Screen recording attached
- [ ] Console logs attached
- [ ] Network request/response attached

### Additional Context
[Anything else that helps reproduce or understand the issue]

### Proposed Fix (optional)
[If the reporter has a hypothesis about the cause or fix]
```

### 13.3 Bug Lifecycle

```
Bug Reported
    │
    ▼
Triage (QA Lead + Engineering Lead) — within 2 hours for P0/P1
    │
    ├── P0 → Hotfix branch immediately; skip normal PR process
    ├── P1 → Assigned to current sprint; urgent priority
    ├── P2 → Scheduled for next sprint
    └── P3 → Added to backlog
    │
    ▼
Bug Assigned to Developer
    │
    ▼
Developer writes regression test first (TDD for bugs)
    │
    ▼
Bug Fixed
    │
    ▼
CI green (regression test passes, existing tests still green)
    │
    ▼
QA Verification (in staging)
    │
    ▼
Bug Closed + Regression Test Added to Suite
```

---

## 14. Quality Metrics and Dashboards

### 14.1 Key Quality Metrics

| Metric | Target | Current (Pilot) | Measurement Source |
|--------|--------|-----------------|--------------------|
| Unit test coverage — services | ≥ 85% | — | Codecov |
| Unit test coverage — lib | ≥ 90% | — | Codecov |
| Integration test pass rate | 100% | — | CI pipeline |
| E2E test pass rate | 100% | — | Playwright CI job |
| Security CVEs (HIGH/CRITICAL) | 0 | — | Snyk + bun audit |
| WCAG 2.1 AA violations | 0 | — | axe-core |
| API P95 response time | <500ms | — | Prometheus |
| Crisis alert delivery latency | <2 minutes | — | Alert tracking |
| Platform uptime | ≥ 99.9% | — | Uptime monitoring |
| Bug escape rate (production bugs) | <5% of total bugs | — | Bug tracker |
| Mean time to detect (MTTD) | <1 hour | — | Incident log |
| Mean time to resolve P1 (MTTR) | <4 hours | — | Incident log |
| Flaky test rate | <2% | — | CI test analysis |

### 14.2 QA Sign-Off Checklist

The following checklist must be completed and approved by the QA Lead before any production release:

**Automated Quality Gates (CI):**
- [ ] All unit tests pass at ≥85% (services) and ≥90% (lib) coverage
- [ ] All integration tests pass (≥70% endpoint coverage)
- [ ] Security scan passes — 0 HIGH/CRITICAL CVEs
- [ ] WCAG 2.1 AA accessibility — 0 violations
- [ ] TypeScript type check — 0 errors
- [ ] ESLint — 0 errors (including import boundary violations)

**Manual QA Verification (Staging):**
- [ ] All E2E user journeys pass on staging
- [ ] All ₦ currency amounts display and calculate correctly
- [ ] WAT timezone displays correctly throughout the application
- [ ] Crisis alert workflow tested end-to-end
- [ ] Paystack payment flow tested in sandbox mode
- [ ] Multi-tenant isolation verified (cross-org access returns 403)
- [ ] Role-based access controls verified for all 6 roles
- [ ] Mobile app smoke tests pass (iOS + Android)
- [ ] Visual regression — no unexpected UI changes
- [ ] Performance targets met on staging under simulated load

**Release Readiness:**
- [ ] Release notes prepared and reviewed
- [ ] Database migrations tested and reversible
- [ ] Rollback plan documented and tested
- [ ] Monitoring dashboards updated for new features
- [ ] Customer-facing documentation updated

---

## 15. QA Roles and Responsibilities

### 15.1 Responsibility Matrix

| Activity | QA Lead | QA Engineers | Developers | Product Manager |
|----------|---------|-------------|-----------|----------------|
| Define test strategy | **Owner** | Contributor | Contributor | Reviewer |
| Write unit tests | Reviewer | — | **Owner** | — |
| Write integration tests | Reviewer | Contributor | **Owner** | — |
| Write E2E tests | **Owner** | **Owner** | Contributor | — |
| Performance testing | **Owner** | **Owner** | Contributor | Reviewer |
| Security testing | Contributor | **Owner** | Contributor | — |
| Accessibility testing | **Owner** | **Owner** | Contributor | — |
| Bug triage | **Owner** | Contributor | Contributor | Contributor |
| Release sign-off | **Owner** | Contributor | Contributor | **Owner** |
| Test environment management | Contributor | **Owner** | Contributor | — |

---

## 16. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Product Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |

---

## 17. Related Documents

| Document | Relationship |
|----------|-------------|
| **Engineering Standards** | Testing standards enforced by this QA strategy |
| **Architecture** | System architecture that determines integration test boundaries |
| **Database Schema** | Schema details for fixture factories (₦ columns, WAT timezone) |
| **User Journeys** | Source of truth for E2E test journey definitions |
| **Personas** | Context for user-centric test design |
| **Security Policy** | Security requirements that security tests validate |
| **UX & Design System** | Accessibility and visual regression standards |
| **Infrastructure Runbook** | Test environment provisioning procedures |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | QA Lead & Engineering Lead | Unified and expanded QA Strategy document. Merges and improves both source documents into a single comprehensive reference. Adds: Nigerian market QA principles (₦ currency validation, WAT timezone testing, NDPR compliance testing, Paystack webhook security tests), expanded negative test rule with complete TypeScript examples, multi-tenant RLS isolation security test suite, Nigerian Naira unit test suite, WAT timezone unit tests, Paystack signature verification tests, full k6 load test with ₦ field validation, complete GitHub Actions CI pipeline with WAT timezone enforcement, Nigerian-context test fixture factories, accessibility tests for ₦ screen reader support, visual regression tests for billing pages, complete bug severity SLA table, QA sign-off checklist with ₦ and WAT checks, and RACI responsibility matrix. |

---

*This document is owned by the QA Lead and reviewed quarterly. All changes to testing standards, coverage targets, or CI gates must be approved by the Engineering Lead and recorded in the version history.*