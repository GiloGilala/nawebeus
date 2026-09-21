# API Reference

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document is the complete API reference for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It documents all API endpoints, request/response formats, authentication, authorization, error codes, rate limits, webhook events, and real-time WebSocket channels.

**Base URL:** `https://api.nawebeus.com/api/v1`

**API Framework:** Hono (mounted at `/api/*` inside TanStack Start server)

**API Style:** RESTful with JSON request/response

**Authentication:** JWT Bearer token (HTTP-only cookie for web; SecureStore for mobile)

**Currency:** All monetary values are in **Nigerian Naira (₦ / NGN)**

**Timezone:** All timestamps use ISO 8601 UTC format. Default display timezone: WAT (Africa/Lagos, UTC+1)

**OpenAPI Spec:** `https://api.nawebeus.com/api/v1/openapi.json`

**Interactive Docs:** `https://docs.nawebeus.com/api`

---

## 2. Design Standards

### 2.1 HTTP Method Conventions

| Method | Purpose | Idempotent | When to Use |
|--------|---------|-----------|-------------|
| `GET` | Read resources | ✅ Yes | Fetching data — never mutates state |
| `POST` | Create resources or trigger actions | ❌ No | Creating records, triggering workflows |
| `PUT` | Replace entire resource | ✅ Yes | Full resource replacement |
| `PATCH` | Partial update | ✅ Yes | Updating specific fields |
| `DELETE` | Remove resource | ✅ Yes | Deleting records |

### 2.2 URL Conventions

| Convention | Standard | Example |
|-----------|---------|---------|
| Resource names | Plural nouns | `/api/v1/mentions`, `/api/v1/conversations` |
| URL casing | kebab-case | `/api/v1/press-releases`, `/api/v1/crisis-incidents` |
| Nesting depth | Maximum 2 levels | `/api/v1/organizations/{id}/members` |
| Action verbs | Appended to resource | `/api/v1/posts/{id}/publish`, `/api/v1/incidents/{id}/escalate` |
| Query parameters | camelCase | `?sortBy=createdAt&filterBy=negative` |

### 2.3 HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|----------|
| `200 OK` | Success | GET, PUT, PATCH — data returned |
| `201 Created` | Resource created | POST — new resource created; includes `Location` header |
| `202 Accepted` | Accepted for async processing | Long-running operations (report generation) |
| `204 No Content` | Success, no body | DELETE, POST actions with no return data |
| `400 Bad Request` | Invalid input | Malformed JSON, missing required fields |
| `401 Unauthorized` | Authentication required | Missing, invalid, or expired JWT |
| `403 Forbidden` | Authorization denied | Valid JWT but insufficient RBAC permissions |
| `404 Not Found` | Resource missing | ID does not exist or belongs to another org |
| `409 Conflict` | Resource conflict | Duplicate entry, invalid state transition |
| `422 Unprocessable Entity` | Semantic validation failure | Business rule violation |
| `429 Too Many Requests` | Rate limited | Includes `Retry-After` header |
| `500 Internal Server Error` | Unexpected server failure | Infrastructure error |
| `503 Service Unavailable` | Service temporarily down | Maintenance window |

### 2.4 Standard Response Envelope

**All API responses use the same envelope structure:**

**Success (single resource):**
```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

**Success (paginated list):**
```json
{
  "success": true,
  "data": [ ],
  "pagination": {
    "cursor": "eyJpZCI6Im1lbnRfN2UzYjJjIn0=",
    "hasMore": true,
    "totalCount": 247
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "CRISIS_INCIDENT_NOT_FOUND",
    "message": "The requested crisis incident does not exist or you do not have access.",
    "details": {
      "incidentId": "inc_invalid123"
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

### 2.5 Monetary Field Conventions

All monetary values are denominated in **Nigerian Naira (₦)**:

| Convention | Standard | Example |
|-----------|---------|---------|
| JSON field names | `{name}Naira` suffix | `amountNaira`, `prValueNaira`, `prizValueNaira` |
| Database column names | `{name}_naira` suffix | `amount_naira`, `prize_value_naira` |
| Currency field | Always `"NGN"` | `"currency": "NGN"` |
| Precision | 2 decimal places | `150000.00` |
| Format | Numeric (not string) | `150000.00` not `"₦150,000.00"` |

```json
{
  "subscription": {
    "planTier": "growth",
    "monthlyPriceNaira": 150000.00,
    "annualPriceNaira": 1440000.00,
    "currency": "NGN"
  }
}
```

### 2.6 Pagination

All list endpoints use **cursor-based pagination** — never offset-based.

**Query Parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 20 | 100 | Number of items per page |
| `cursor` | string | — | — | Opaque cursor from previous response |

**Cursor Format:** Base64-encoded JSON (base64url, unpadded) — clients must treat as opaque and never parse or construct cursors. A malformed `cursor`, or a `limit` that is not an integer in `1..100`, is rejected with **422** rather than being silently clamped or reset to the first page.

**Response Shape:** page info is returned in the envelope's `meta` slot:

```json
{
  "data": { "members": [] },
  "meta": { "pagination": { "cursor": "eyJ2IjoiMjAyNi0wOS0yMVQxMDowMDowMFoiLCJpZCI6Ii4uLiJ9", "hasMore": true } }
}
```

`cursor` is `null` and `hasMore` is `false` on the last page — clients stop when `hasMore` is false rather than looping on the final cursor. **`totalCount` is not returned** (it would cost a `COUNT(*)` per page); see discrepancy **D-17**.

**Example:**
```http
GET /api/v1/monitoring/mentions?limit=20&cursor=eyJpZCI6Im1lbnRfN2UzYjJjIn0=
Authorization: Bearer <token>
```

### 2.7 Filtering and Sorting

```http
GET /api/v1/monitoring/mentions?sentimentLabel=negative&platform=twitter&sortBy=publishedAt&sortOrder=desc
```

**Common Filter Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Filter from date (UTC) |
| `endDate` | ISO 8601 | Filter to date (UTC) |
| `status` | string | Filter by resource status |
| `platform` | string | Filter by social platform |
| `sentimentLabel` | string | `positive` \| `neutral` \| `negative` |
| `sortBy` | string | Column to sort by |
| `sortOrder` | string | `asc` \| `desc` (default: `desc`) |

### 2.8 Date and Timezone Conventions

| Convention | Standard |
|-----------|---------|
| Storage format | ISO 8601 UTC: `2026-07-21T10:30:00.000Z` |
| Display timezone | WAT (Africa/Lagos, UTC+1) — UI layer converts |
| Date-only fields | `YYYY-MM-DD` format |
| All timestamps | `TIMESTAMPTZ` — always timezone-aware |

---

## 3. Authentication

### 3.1 JWT Authentication

**Flow:**
```
1. POST /api/v1/auth/login with credentials
   → Receive access token (15 min) + refresh token (7 days)
2. Include access token in Authorization header for all requests
3. When access token expires → POST /api/v1/auth/refresh with refresh token
4. Refresh token rotates on each use (single-use)
```

**Authorization Header:**
```
Authorization: Bearer <access_token>
```

**JWT Payload:**
```json
{
  "sub": "usr_9f2a4b6c8d1e3f5g",
  "org": "org_7e3b2c1d4f5a6b8c",
  "role": "manager",
  "email": "ade.ogunleye@firstbank.com.ng",
  "mfaVerified": true,
  "iat": 1721560200,
  "exp": 1721561100,
  "jti": "tok_abc123def456"
}
```

**Web App:** Tokens stored in `httpOnly` + `Secure` + `SameSite=Strict` cookies — automatically included in requests.

**Mobile App:** Tokens stored in Expo SecureStore — must be manually included in `Authorization` header.

### 3.2 API Key Authentication (Service-to-Service)

For automated integrations and third-party service access:

```
X-API-Key: nwb_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are scoped to an organization and a permission set. Generated in Settings → Integrations → API Keys.

### 3.3 Webhook Signature Verification

All inbound webhooks are verified via HMAC-SHA256 signature:

```
X-Nawebeus-Signature: sha256=abc123...
X-Nawebeus-Timestamp: 1721560200
```

**Verification process:**
```typescript
const payload = `${timestamp}.${rawBody}`;
const expectedSignature = `sha256=${hmacSHA256(payload, webhookSecret)}`;
const isValid = timingSafeEqual(signature, expectedSignature);
// Also verify timestamp is within 300 seconds of now (replay attack prevention)
```

**Paystack Webhook Verification:**
```
X-Paystack-Signature: sha512=xyz789...
```

---

## 4. Rate Limiting

### 4.1 Rate Limit Strategy

All rate limits use a **sliding window algorithm**. Rate limit state is stored in SQLite (MVP) / Redis (Year 2+).

### 4.2 Rate Limits by Endpoint Category

| Category | Per Minute | Per Hour | Notes |
|----------|-----------|---------|-------|
| Authentication (login, signup) | 5 per IP | 20 per IP | Strict — prevents brute force |
| API reads (general) | 100 per user | 2,000 per user | Standard read operations |
| API writes (general) | 50 per user | 500 per user | Create, update, delete |
| Content publishing | 30 per user | 200 per user | Post scheduling |
| Report generation | 10 per user | 50 per user | Expensive operations |
| Data exports | 5 per user | 20 per user | File generation |
| Crisis operations | 200 per user | 2,000 per user | Higher limit — time-critical |
| Webhook endpoints | 1,000 per source | 10,000 per source | External callbacks |
| Public (unauthenticated) | 10 per IP | 100 per IP | Landing page, public APIs |

### 4.3 Rate Limit Response Headers

Every response includes rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1721560860
X-RateLimit-Policy: 100;w=60
```

### 4.4 Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1721560907

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after the specified time.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetAt": "2026-07-21T10:31:00.000Z",
      "retryAfterSeconds": 47
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:13.000Z",
    "requestId": "req_abc123def456"
  }
}
```

---

## 5. Error Reference

### 5.1 Error Code Categories

#### Authentication Errors

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_MISSING_TOKEN` | 401 | No Authorization header provided |
| `AUTH_INVALID_TOKEN` | 401 | JWT is malformed or signature invalid |
| `AUTH_EXPIRED_TOKEN` | 401 | JWT access token has expired — refresh required |
| `AUTH_REVOKED_TOKEN` | 401 | Token has been explicitly revoked (logout or security event) |
| `AUTH_INVALID_CREDENTIALS` | 401 | Email or password is incorrect |
| `AUTH_MFA_REQUIRED` | 401 | MFA is enabled and TOTP code required |
| `AUTH_MFA_INVALID` | 401 | TOTP code is incorrect or expired |
| `AUTH_ACCOUNT_LOCKED` | 429 | Account temporarily locked after too many failed attempts |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Email address has not been verified |

#### Authorization Errors

| Code | HTTP | Description |
|------|------|-------------|
| `AUTHZ_INSUFFICIENT_PERMISSION` | 403 | User's role does not have the required permission |
| `AUTHZ_RESOURCE_ACCESS_DENIED` | 403 | Resource belongs to a different organization (cross-tenant) |
| `AUTHZ_ROLE_REQUIRED` | 403 | Operation requires a specific minimum role |
| `AUTHZ_SELF_ACTION_DENIED` | 403 | User cannot perform this action on their own account |

#### Validation Errors

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_INVALID_INPUT` | 422 | Input fails schema validation (details contains field-level errors) |
| `VALIDATION_MISSING_FIELD` | 422 | A required field is absent |
| `VALIDATION_INVALID_FORMAT` | 422 | Field value has incorrect format (e.g., invalid email) |
| `VALIDATION_INVALID_ENUM` | 422 | Field value is not in the allowed enum set |
| `VALIDATION_INVALID_NAIRA_AMOUNT` | 422 | Monetary amount is negative, zero, or not a valid ₦ value |
| `VALIDATION_INVALID_DATE_RANGE` | 422 | Start date is after end date |

#### Resource Errors

| Code | HTTP | Description |
|------|------|-------------|
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist or is inaccessible to this organization |
| `RESOURCE_DUPLICATE` | 409 | A resource with these properties already exists |
| `RESOURCE_INVALID_STATE` | 409 | Operation is invalid for the resource's current status |
| `RESOURCE_CONSTRAINT_VIOLATION` | 422 | Operation would violate a business constraint |

#### Business Logic Errors

| Code | HTTP | Description |
|------|------|-------------|
| `BUSINESS_PLAN_LIMIT_REACHED` | 422 | Organization has reached a plan limit (users, social accounts, etc.) |
| `BUSINESS_TRIAL_EXPIRED` | 402 | Trial period has ended — subscription required |
| `BUSINESS_SUBSCRIPTION_REQUIRED` | 402 | Feature requires an active paid subscription |
| `BUSINESS_CRISIS_ALREADY_RESOLVED` | 409 | Crisis incident is already closed |
| `BUSINESS_PRESS_RELEASE_ALREADY_DISTRIBUTED` | 409 | Press release has already been distributed and cannot be edited |
| `BUSINESS_POST_PAST_SCHEDULE` | 422 | Scheduled time is in the past |
| `BUSINESS_APPROVAL_ALREADY_REVIEWED` | 409 | Content has already been approved or rejected |

#### Billing Errors (₦)

| Code | HTTP | Description |
|------|------|-------------|
| `BILLING_PAYMENT_FAILED` | 402 | Paystack ₦ charge failed |
| `BILLING_SUBSCRIPTION_INACTIVE` | 402 | Subscription is not active |
| `BILLING_INVALID_PLAN` | 422 | Requested plan tier does not exist |
| `BILLING_DOWNGRADE_NOT_ALLOWED` | 422 | Current usage exceeds limits of target plan |

#### Rate Limit Errors

| Code | HTTP | Description |
|------|------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit for this endpoint/user exceeded |
| `RATE_LIMIT_BLOCKED` | 429 | IP or user temporarily blocked due to abuse |

#### System Errors

| Code | HTTP | Description |
|------|------|-------------|
| `SYSTEM_DATABASE_ERROR` | 500 | Internal database error |
| `SYSTEM_CACHE_ERROR` | 500 | Internal cache error |
| `SYSTEM_STORAGE_ERROR` | 500 | File storage error (R2) |
| `SYSTEM_EXTERNAL_SERVICE_ERROR` | 503 | External service failure (social API, Paystack, etc.) |
| `SYSTEM_PAYSTACK_ERROR` | 503 | Paystack API unavailable |

---

## 6. Authentication Endpoints

### POST /api/v1/auth/register

Register a new user and create an organization.

**Request Body:**
```json
{
  "fullName": "Ade Ogunleye",
  "email": "ade@firstbank.com.ng",
  "password": "SecureP@ss123",
  "organizationName": "First Bank of Nigeria",
  "industry": "banking",
  "teamSize": "large",
  "primaryUseCase": "pr",
  "recaptchaToken": "03AGdBq25...",
  "acceptedTerms": true,
  "acceptedPrivacy": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "usr_9f2a4b6c8d1e3f5g",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "email": "ade@firstbank.com.ng",
    "message": "Account created. Please check your email to verify your account."
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

---

### POST /api/v1/auth/login

Authenticate a user and create a session.

**Request Body:**
```json
{
  "email": "ade@firstbank.com.ng",
  "password": "SecureP@ss123",
  "rememberMe": true,
  "totpCode": "123456",
  "recaptchaToken": "03AGdBq25..."
}
```

**Response (200):**
```json
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
      "mfaEnabled": true,
      "emailVerified": true
    },
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "rt_xyz789abc123...",
      "accessTokenExpiresAt": "2026-07-21T10:45:00.000Z",
      "refreshTokenExpiresAt": "2026-07-28T10:30:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

**Error Responses:**
- `401 AUTH_INVALID_CREDENTIALS` — Wrong email or password
- `401 AUTH_MFA_REQUIRED` — MFA enabled, `totpCode` required
- `401 AUTH_MFA_INVALID` — TOTP code incorrect
- `403 AUTH_EMAIL_NOT_VERIFIED` — Email not verified
- `429 AUTH_ACCOUNT_LOCKED` — Too many failed attempts

---

### POST /api/v1/auth/refresh

Refresh an expired access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "rt_xyz789abc123..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_new_token_456...",
    "accessTokenExpiresAt": "2026-07-21T11:00:00.000Z",
    "refreshTokenExpiresAt": "2026-07-28T10:45:00.000Z"
  }
}
```

---

### POST /api/v1/auth/logout

Invalidate the current session and revoke tokens.

**Response (204):** No content

---

### POST /api/v1/auth/forgot-password

Request a password reset email.

**Request Body:**
```json
{
  "email": "ade@firstbank.com.ng",
  "recaptchaToken": "03AGdBq25..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a password reset link has been sent."
  }
}
```

---

### POST /api/v1/auth/reset-password

Reset password using a reset token from email.

**Request Body:**
```json
{
  "token": "prt_reset_token_xyz789",
  "newPassword": "NewSecureP@ss456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully. Please log in with your new password."
  }
}
```

---

### GET /api/v1/auth/me

Get the currently authenticated user's profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "usr_9f2a4b6c8d1e3f5g",
    "email": "ade@firstbank.com.ng",
    "fullName": "Ade Ogunleye",
    "phone": "+2348012345678",
    "avatarUrl": "https://cdn.nawebeus.com/avatars/usr_9f2a4b6c8d1e3f5g.jpg",
    "timezone": "Africa/Lagos",
    "role": "admin",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "mfaEnabled": true,
    "emailVerified": true,
    "lastLoginAt": "2026-07-21T07:30:00.000Z",
    "createdAt": "2026-06-15T09:00:00.000Z"
  }
}
```

---

## 7. Organization & Team Endpoints

### GET /api/v1/organizations/{id}

Get organization details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "org_7e3b2c1d4f5a6b8c",
    "name": "First Bank of Nigeria",
    "slug": "first-bank-nigeria",
    "logoUrl": "https://cdn.nawebeus.com/logos/org_7e3b2c1d4f5a6b8c.png",
    "industry": "banking",
    "website": "https://firstbanknigeria.com",
    "timezone": "Africa/Lagos",
    "currency": "NGN",
    "subscription": {
      "planTier": "enterprise",
      "status": "active",
      "monthlyPriceNaira": 350000.00,
      "currency": "NGN",
      "currentPeriodEnd": "2026-08-01T00:00:00.000Z"
    },
    "createdAt": "2026-06-15T09:00:00.000Z"
  }
}
```

---

### PATCH /api/v1/organizations/{id}

Update organization settings. **Requires: Admin role**

**Request Body:**
```json
{
  "name": "First Bank of Nigeria PLC",
  "industry": "banking",
  "website": "https://firstbanknigeria.com",
  "timezone": "Africa/Lagos"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "org_7e3b2c1d4f5a6b8c",
    "name": "First Bank of Nigeria PLC",
    "updatedAt": "2026-07-21T10:35:00.000Z"
  }
}
```

---

### GET /api/v1/organizations/{id}/members

List all team members. Supports pagination and role filtering.

**Query Parameters:**
- `role` — Filter by role: `owner` | `admin` | `manager` | `creator` | `analyst` | `viewer`
- `status` — Filter by status: `active` | `inactive` | `pending`
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "usr_9f2a4b6c8d1e3f5g",
      "fullName": "Ade Ogunleye",
      "email": "ade@firstbank.com.ng",
      "role": "admin",
      "status": "active",
      "lastActiveAt": "2026-07-21T09:15:00.000Z",
      "joinedAt": "2026-06-15T09:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6InVzcl8xMjMifQ==",
    "hasMore": false,
    "totalCount": 8
  }
}
```

---

### POST /api/v1/organizations/{id}/invitations

Invite a new team member. **Requires: Admin or Manager role**

**Request Body:**
```json
{
  "email": "chidi@firstbank.com.ng",
  "role": "manager",
  "personalMessage": "Welcome to the PR team, Chidi!"
}
```

**Response (201):**
```json
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

---

### GET /api/v1/organizations/{id}/usage

Get current usage against plan limits.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "planTier": "enterprise",
    "limits": {
      "users": { "current": 7, "limit": 25, "percentageUsed": 28 },
      "socialAccounts": { "current": 5, "limit": 15, "percentageUsed": 33 },
      "mentionsPerMonth": { "current": 45230, "limit": 100000, "percentageUsed": 45 },
      "monitoringKeywords": { "current": 18, "limit": 100, "percentageUsed": 18 },
      "reportGenerations": { "current": 12, "limit": 50, "percentageUsed": 24 }
    },
    "billingPeriod": {
      "start": "2026-07-01T00:00:00.000Z",
      "end": "2026-07-31T23:59:59.000Z",
      "daysRemaining": 10
    }
  }
}
```

---

## 8. Media Monitoring Endpoints

### GET /api/v1/monitoring/articles

List media articles matching the organization's monitoring campaigns.

**Query Parameters:**
- `sentimentLabel` — `positive` | `neutral` | `negative`
- `sourceType` — `newspaper` | `blog` | `broadcast` | `wire`
- `startDate`, `endDate` — Date range filter
- `campaignId` — Filter by monitoring campaign
- `isCompetitive` — `true` | `false`
- `minReach` — Minimum reach estimate
- `sortBy` — `publishedAt` | `reachEstimate` | `aveNaira` | `authorityScore`
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "art_9f2a4b6c8d1e3f5g",
      "title": "First Bank of Nigeria Launches New Digital Banking Platform",
      "source": "BusinessDay Nigeria",
      "sourceType": "newspaper",
      "authorityScore": 88,
      "author": "Emeka Nwosu",
      "url": "https://businessday.ng/banking/...",
      "excerpt": "First Bank of Nigeria has launched a new digital banking platform...",
      "publishedAt": "2026-07-21T08:00:00.000Z",
      "sentiment": {
        "label": "positive",
        "score": 0.78,
        "confidence": 0.91
      },
      "reachEstimate": 850000,
      "aveNaira": 425000.00,
      "currency": "NGN",
      "isCompetitive": false,
      "brandMentionContext": "primary",
      "topics": ["digital banking", "fintech", "mobile payments"]
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6ImFydF8xMjMifQ==",
    "hasMore": true,
    "totalCount": 142
  }
}
```

---

### GET /api/v1/monitoring/articles/{id}

Get a single article with full detail.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "art_9f2a4b6c8d1e3f5g",
    "title": "First Bank of Nigeria Launches New Digital Banking Platform",
    "content": "First Bank of Nigeria has launched a new digital banking platform...",
    "source": "BusinessDay Nigeria",
    "sourceType": "newspaper",
    "authorityScore": 88,
    "author": "Emeka Nwosu",
    "url": "https://businessday.ng/banking/...",
    "publishedAt": "2026-07-21T08:00:00.000Z",
    "sentiment": {
      "headlineScore": 0.82,
      "bodyScore": 0.74,
      "overallScore": 0.78,
      "label": "positive",
      "confidence": 0.91
    },
    "reachEstimate": 850000,
    "aveNaira": 425000.00,
    "currency": "NGN",
    "keyQuotes": [
      "First Bank's new platform represents a significant leap forward in Nigerian digital banking"
    ],
    "entities": {
      "organizations": ["First Bank of Nigeria", "Central Bank of Nigeria"],
      "people": ["Dr. Adesola Adeduntan"]
    },
    "socialShares": 1240,
    "isCompetitive": false,
    "isArchived": false
  }
}
```

---

### GET /api/v1/monitoring/share-of-voice

Get brand share of voice compared to competitors.

**Query Parameters:**
- `startDate`, `endDate` — Date range (required)
- `competitors` — Comma-separated competitor IDs

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-07-01T00:00:00.000Z",
      "end": "2026-07-21T23:59:59.000Z"
    },
    "shareOfVoice": [
      {
        "brand": "First Bank of Nigeria",
        "articles": 45,
        "mentions": 12450,
        "sovPercentage": 34.2,
        "change": 2.1,
        "totalReach": 28500000,
        "totalAveNaira": 14250000.00,
        "avgSentiment": 0.68,
        "currency": "NGN"
      },
      {
        "brand": "GTBank",
        "articles": 38,
        "mentions": 10200,
        "sovPercentage": 28.7,
        "change": -1.3,
        "totalReach": 22100000,
        "totalAveNaira": 11050000.00,
        "avgSentiment": 0.55,
        "currency": "NGN"
      }
    ]
  }
}
```

---

### GET /api/v1/monitoring/contacts

List journalist CRM contacts.

**Query Parameters:**
- `beat` — Filter by coverage beat (e.g., `banking`, `technology`, `politics`)
- `outlet` — Filter by publication
- `minInfluenceScore` — Minimum influence score (0–100)
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ctc_3b4c5d6e7f8a9b0c",
      "fullName": "Emeka Nwosu",
      "outlet": "BusinessDay Nigeria",
      "beat": "banking",
      "title": "Banking Editor",
      "email": "emeka.nwosu@businessday.ng",
      "twitterHandle": "@emekanwosu",
      "influenceScore": 82,
      "relationshipScore": 71,
      "responseRate": 0.68,
      "lastContactAt": "2026-07-15T14:00:00.000Z",
      "interactionCount": 12,
      "coverageCount": 8
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6ImN0Y18xMjMifQ==",
    "hasMore": false,
    "totalCount": 47
  }
}
```

---

### POST /api/v1/monitoring/contacts

Add a journalist to the CRM. **Requires: Manager role or above**

**Request Body:**
```json
{
  "fullName": "Amaka Obi",
  "outlet": "Punch Nigeria",
  "beat": "banking",
  "title": "Finance Correspondent",
  "email": "amaka.obi@punchng.com",
  "twitterHandle": "@amakaobi",
  "consentGiven": true,
  "consentDate": "2026-07-21T00:00:00.000Z",
  "consentMethod": "verbal_at_event"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "ctc_8d7c6b5a4e3f2g1h",
    "fullName": "Amaka Obi",
    "outlet": "Punch Nigeria",
    "beat": "banking",
    "influenceScore": 0,
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

## 9. Crisis Management Endpoints

### GET /api/v1/crisis/incidents

List crisis incidents. **Requires: Manager role or above**

**Query Parameters:**
- `status` — `detected` | `assessing` | `responding` | `monitoring` | `resolved`
- `severity` — `s1_noise` | `s2_watch` | `s3_respond` | `s4_escalate` | `s5_allhands`
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "inc_4d5e6f7a8b9c0d1e",
      "title": "GTBank Transfer Fee Backlash",
      "severity": "s4_escalate",
      "status": "responding",
      "originPlatform": "twitter",
      "mentionCount": 1247,
      "reachEstimate": 2100000,
      "sentimentNegativePercentage": 78,
      "detectedAt": "2026-07-21T10:47:00.000Z",
      "respondedAt": "2026-07-21T11:02:00.000Z",
      "resolvedAt": null
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

### GET /api/v1/crisis/incidents/{id}

Get crisis incident brief with full context. **Requires: Manager role or above**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "inc_4d5e6f7a8b9c0d1e",
    "title": "GTBank Transfer Fee Backlash",
    "description": "Customer backlash against newly announced transfer fees",
    "severity": "s4_escalate",
    "status": "responding",
    "originPlatform": "twitter",
    "mentionCount": 1247,
    "mentionVelocity": "fast",
    "reachEstimate": 2100000,
    "projectedReachIn2Hours": 5000000,
    "sentimentBreakdown": {
      "positivePercentage": 8,
      "neutralPercentage": 14,
      "negativePercentage": 78
    },
    "spreadChannels": ["twitter", "instagram", "whatsapp", "facebook", "news"],
    "keyInfluencers": [
      {
        "handle": "@financialNGR",
        "followerCount": 82400,
        "isVerified": true
      }
    ],
    "detectedAt": "2026-07-21T10:47:00.000Z",
    "respondedAt": "2026-07-21T11:02:00.000Z",
    "resolvedAt": null,
    "stakeholdersNotified": [
      { "userId": "usr_9f2a4b6c", "role": "Head of PR", "notifiedAt": "2026-07-21T10:49:00.000Z" },
      { "userId": "usr_3b2c1d4e", "role": "Legal", "notifiedAt": "2026-07-21T10:50:00.000Z" }
    ]
  }
}
```

---

### PATCH /api/v1/crisis/incidents/{id}

Update crisis incident severity or status. **Requires: Manager role or above**

**Request Body:**
```json
{
  "severity": "s4_escalate",
  "status": "responding",
  "notes": "Volume exceeding 1,000 mentions/hour. Escalating to S4."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "inc_4d5e6f7a8b9c0d1e",
    "severity": "s4_escalate",
    "status": "responding",
    "updatedAt": "2026-07-21T11:05:00.000Z"
  }
}
```

---

### POST /api/v1/crisis/incidents/{id}/responses

Draft and submit a crisis response. **Requires: Manager role or above**

**Request Body:**
```json
{
  "responseText": "We are aware of concerns raised by our customers regarding our new transfer fee structure. We are reviewing your feedback and will communicate any changes within 24 hours.",
  "templateId": "rtpl_social_backlash_01",
  "platforms": ["twitter", "instagram", "facebook"],
  "requiresApproval": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "responseId": "rsp_5e6f7a8b9c0d1e2f",
    "incidentId": "inc_4d5e6f7a8b9c0d1e",
    "status": "pending_approval",
    "platforms": ["twitter", "instagram", "facebook"],
    "approvalSlaMinutes": 5,
    "createdAt": "2026-07-21T11:08:00.000Z"
  }
}
```

---

### POST /api/v1/crisis/incidents/{id}/responses/{responseId}/publish

Publish an approved crisis response to all platforms. **Requires: Manager or Admin role**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "responseId": "rsp_5e6f7a8b9c0d1e2f",
    "publishedAt": "2026-07-21T11:12:00.000Z",
    "platforms": {
      "twitter": { "status": "published", "platformPostId": "1234567890" },
      "instagram": { "status": "published", "platformPostId": "9876543210" },
      "facebook": { "status": "published", "platformPostId": "1122334455" }
    }
  }
}
```

---

### POST /api/v1/crisis/incidents/{id}/post-mortem

Generate post-crisis analysis report. **Requires: Manager role or above**

**Response (202):**
```json
{
  "success": true,
  "data": {
    "reportId": "rpt_6f7a8b9c0d1e2f3a",
    "status": "generating",
    "estimatedCompletionAt": "2026-07-21T11:45:00.000Z"
  }
}
```

---

## 10. Social Listening Endpoints

### GET /api/v1/listening/mentions

List social mentions matching listening queries.

**Query Parameters:**
- `queryId` — Filter by listening query ID
- `sentimentLabel` — `positive` | `neutral` | `negative`
- `platform` — `twitter` | `instagram` | `facebook` | `linkedin` | `tiktok` | `reddit`
- `minInfluenceScore` — Minimum author influence (0–100)
- `isSpam` — `false` (default, excludes spam)
- `startDate`, `endDate` — Date range
- `sortBy` — `publishedAt` | `influenceScore` | `engagementTotal`
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ment_7a8b9c0d1e2f3a4b",
      "platform": "twitter",
      "author": {
        "username": "@chiomaafor",
        "displayName": "Chioma Afor",
        "followers": 45200,
        "isVerified": false,
        "influenceScore": 72
      },
      "content": "Finally a Nigerian bank that actually listens to customer feedback. First Bank's response to the digital banking concerns was impressive.",
      "url": "https://twitter.com/chiomaafor/status/1234567890",
      "sentiment": {
        "label": "positive",
        "score": 0.84,
        "confidence": 0.93
      },
      "engagement": {
        "likes": 234,
        "shares": 67,
        "comments": 28,
        "total": 329
      },
      "reachEstimate": 45200,
      "publishedAt": "2026-07-21T09:45:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Im1lbnRfMTIzIn0=",
    "hasMore": true,
    "totalCount": 5420
  }
}
```

---

### POST /api/v1/listening/queries

Create a new social listening query. **Requires: Manager role or above**

**Request Body:**
```json
{
  "name": "First Bank - Brand Mentions",
  "description": "Monitor all mentions of First Bank of Nigeria across social platforms",
  "keywords": ["First Bank Nigeria", "\"First Bank\"", "@firstbanknigeria", "#FirstBank"],
  "platforms": ["twitter", "instagram", "facebook", "linkedin"],
  "languages": ["en"],
  "countries": ["NG"],
  "minEngagement": 0,
  "minInfluenceScore": 0
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "qry_8b9c0d1e2f3a4b5c",
    "name": "First Bank - Brand Mentions",
    "status": "active",
    "estimatedMonthlyMentions": 8500,
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/listening/alerts

Create a social listening alert rule. **Requires: Manager role or above**

**Request Body:**
```json
{
  "name": "Negative Sentiment Spike Alert",
  "alertType": "sentiment_crash",
  "enabled": true,
  "threshold": -0.3,
  "queryIds": ["qry_8b9c0d1e2f3a4b5c"],
  "channels": ["email", "in_app", "push"],
  "recipients": ["ade@firstbank.com.ng", "chidi@firstbank.com.ng"],
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "lalt_9c0d1e2f3a4b5c6d",
    "name": "Negative Sentiment Spike Alert",
    "enabled": true,
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

## 11. Social Publishing Endpoints

### GET /api/v1/publishing/posts

List posts across all platforms.

**Query Parameters:**
- `status` — `draft` | `pending_approval` | `scheduled` | `publishing` | `published` | `failed`
- `platform` — Filter by platform
- `startDate`, `endDate` — Scheduled date range
- `createdBy` — Filter by creator user ID
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "post_0d1e2f3a4b5c6d7e",
      "title": "Digital Banking Launch Campaign",
      "status": "scheduled",
      "platforms": ["twitter", "instagram", "linkedin"],
      "scheduledAt": "2026-07-22T10:00:00.000Z",
      "approvalStatus": "approved",
      "approvedBy": "usr_9f2a4b6c8d1e3f5g",
      "createdBy": "usr_3b4c5d6e7f8a9b0c",
      "createdAt": "2026-07-21T14:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6InBvc3RfMTIzIn0=",
    "hasMore": true,
    "totalCount": 34
  }
}
```

---

### POST /api/v1/publishing/posts

Create a new post. **Requires: Creator role or above**

**Request Body:**
```json
{
  "title": "Digital Banking Launch Campaign",
  "platforms": [
    {
      "platform": "twitter",
      "content": "Big news! First Bank's new digital banking platform is live. Banking made simpler for Nigerians everywhere. #DigitalBanking #FirstBank"
    },
    {
      "platform": "instagram",
      "content": "Exciting news! 🎉 Our new digital banking platform is now live. Experience seamless banking from your phone.\n\n#DigitalBanking #FirstBank #NigerianBanking",
      "mediaIds": ["med_1e2f3a4b5c6d7e8f"]
    },
    {
      "platform": "linkedin",
      "content": "We are proud to announce the launch of our new digital banking platform. This represents a significant milestone in our commitment to serving Nigerians wherever they are."
    }
  ],
  "scheduledAt": "2026-07-22T10:00:00.000Z",
  "requiresApproval": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "post_0d1e2f3a4b5c6d7e",
    "status": "pending_approval",
    "approvalStatus": "pending",
    "scheduledAt": "2026-07-22T10:00:00.000Z",
    "createdAt": "2026-07-21T14:00:00.000Z"
  }
}
```

---

### POST /api/v1/publishing/posts/{id}/approve

Approve a pending post for publishing. **Requires: Manager role or above**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "post_0d1e2f3a4b5c6d7e",
    "approvalStatus": "approved",
    "approvedBy": "usr_9f2a4b6c8d1e3f5g",
    "approvedAt": "2026-07-21T15:00:00.000Z",
    "status": "scheduled"
  }
}
```

---

### POST /api/v1/publishing/posts/{id}/reject

Reject a pending post with feedback. **Requires: Manager role or above**

**Request Body:**
```json
{
  "reason": "Copy needs to be revised — tone is too formal for Twitter. Please adjust to be more conversational."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "post_0d1e2f3a4b5c6d7e",
    "approvalStatus": "rejected",
    "rejectedAt": "2026-07-21T15:05:00.000Z",
    "rejectionReason": "Copy needs to be revised — tone is too formal for Twitter."
  }
}
```

---

### GET /api/v1/publishing/calendar

Get content calendar for a date range.

**Query Parameters:**
- `startDate`, `endDate` — Date range (required)
- `platform` — Filter by platform
- `status` — Filter by post status

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-07-21T00:00:00.000Z",
      "end": "2026-07-27T23:59:59.000Z"
    },
    "posts": [
      {
        "id": "post_0d1e2f3a4b5c6d7e",
        "title": "Digital Banking Launch Campaign",
        "scheduledAt": "2026-07-22T10:00:00.000Z",
        "platforms": ["twitter", "instagram", "linkedin"],
        "status": "scheduled",
        "approvalStatus": "approved"
      }
    ]
  }
}
```

---

## 12. Engagement (Unified Inbox) Endpoints

### GET /api/v1/engage/conversations

List conversations from the unified inbox.

**Query Parameters:**
- `status` — `open` | `assigned` | `pending` | `resolved` | `closed`
- `priority` — `low` | `normal` | `high` | `critical`
- `platform` — Filter by platform
- `assignedTo` — Filter by assigned user ID
- `unread` — `true` to show only unread
- `slaBreached` — `true` to show SLA-breached conversations
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cnv_1e2f3a4b5c6d7e8f",
      "platform": "twitter",
      "author": {
        "username": "@oluwaseun_adeleke",
        "displayName": "Oluwaseun Adeleke",
        "followers": 12400,
        "isVerified": false,
        "influenceScore": 58
      },
      "preview": "Why is my transfer still pending after 6 hours?",
      "status": "open",
      "priority": "high",
      "assignedTo": null,
      "unread": true,
      "slaFirstResponseDeadline": "2026-07-21T12:30:00.000Z",
      "slaBreached": false,
      "lastMessageAt": "2026-07-21T10:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6ImNudl8xMjMifQ==",
    "hasMore": true,
    "totalCount": 143
  }
}
```

---

### GET /api/v1/engage/conversations/{id}

Get full conversation thread with all messages.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cnv_1e2f3a4b5c6d7e8f",
    "platform": "twitter",
    "author": {
      "username": "@oluwaseun_adeleke",
      "displayName": "Oluwaseun Adeleke",
      "followers": 12400,
      "isVerified": false,
      "influenceScore": 58,
      "previousInteractions": 0
    },
    "messages": [
      {
        "id": "msg_2f3a4b5c6d7e8f9a",
        "direction": "inbound",
        "content": "Why is my transfer still pending after 6 hours? This is unacceptable @firstbanknigeria",
        "sentiment": { "label": "negative", "score": -0.72 },
        "intent": "complaint",
        "sentAt": "2026-07-21T10:30:00.000Z"
      }
    ],
    "status": "open",
    "priority": "high",
    "assignedTo": null,
    "slaFirstResponseDeadline": "2026-07-21T12:30:00.000Z",
    "slaBreached": false,
    "tags": ["transaction-issue", "pending-transfer"]
  }
}
```

---

### POST /api/v1/engage/conversations/{id}/messages

Send a reply to a conversation.

**Request Body:**
```json
{
  "content": "Hi Oluwaseun, we apologise for the inconvenience. Our team is investigating your pending transfer. Please send your account number via DM and we will resolve this within 2 hours.",
  "templateId": "rtpl_transaction_complaint_01",
  "isInternalNote": false,
  "requiresApproval": false
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "msg_3a4b5c6d7e8f9a0b",
    "direction": "outbound",
    "content": "Hi Oluwaseun, we apologise for the inconvenience...",
    "status": "sent",
    "platform": "twitter",
    "sentAt": "2026-07-21T10:45:00.000Z"
  }
}
```

---

### PUT /api/v1/engage/conversations/{id}/assign

Assign a conversation to a team member. **Requires: Manager role or above**

**Request Body:**
```json
{
  "assignedTo": "usr_3b4c5d6e7f8a9b0c"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cnv_1e2f3a4b5c6d7e8f",
    "assignedTo": "usr_3b4c5d6e7f8a9b0c",
    "assignedAt": "2026-07-21T10:42:00.000Z"
  }
}
```

---

### PUT /api/v1/engage/conversations/{id}/resolve

Mark a conversation as resolved.

**Request Body:**
```json
{
  "resolution": "Transfer issue resolved — customer refunded",
  "tags": ["resolved", "transaction-issue", "refund"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cnv_1e2f3a4b5c6d7e8f",
    "status": "resolved",
    "resolvedAt": "2026-07-21T11:30:00.000Z"
  }
}
```

---

## 13. Analytics & Reporting Endpoints

### GET /api/v1/analytics/dashboard

Get executive dashboard data for a date range.

**Query Parameters:**
- `startDate`, `endDate` — Date range (required)
- `granularity` — `day` | `week` | `month`
- `compareWithPrevious` — `true` | `false`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-07-01T00:00:00.000Z",
      "end": "2026-07-21T23:59:59.000Z"
    },
    "kpis": {
      "totalMentions": { "value": 12847, "change": 12.3, "trend": "up" },
      "sentimentScore": { "value": 0.64, "change": 0.08, "trend": "up" },
      "shareOfVoice": { "value": 34.2, "change": 2.1, "trend": "up" },
      "avgResponseTime": { "value": 47, "unit": "minutes", "change": -12, "trend": "down" },
      "prValueNaira": { "value": 42000000.00, "change": 8.2, "trend": "up", "currency": "NGN" }
    },
    "sentimentTrend": [
      {
        "date": "2026-07-21",
        "positive": 68,
        "neutral": 20,
        "negative": 12,
        "avgScore": 0.64
      }
    ],
    "topSources": [
      { "source": "BusinessDay Nigeria", "articles": 18, "reach": 9500000 },
      { "source": "Punch Nigeria", "articles": 12, "reach": 7200000 }
    ],
    "aiInsights": [
      {
        "type": "opportunity",
        "title": "Competitor negative sentiment — engagement opportunity",
        "description": "GTBank's negative sentiment increased 15% this week driven by fee complaints. An opportunity exists to highlight First Bank's value positioning.",
        "confidence": 0.87
      }
    ]
  }
}
```

---

### POST /api/v1/analytics/reports

Create a scheduled or on-demand report. **Requires: Analyst role or above**

**Request Body:**
```json
{
  "name": "Monthly Brand Health Report — July 2026",
  "reportType": "brand_health",
  "dataSources": ["monitoring", "listening", "engagement"],
  "metrics": ["totalMentions", "sentimentScore", "shareOfVoice", "avgResponseTime", "prValueNaira"],
  "filters": {
    "startDate": "2026-07-01T00:00:00.000Z",
    "endDate": "2026-07-31T23:59:59.000Z"
  },
  "format": "pdf",
  "schedule": {
    "frequency": "monthly",
    "cronExpression": "0 8 1 * *",
    "timezone": "Africa/Lagos"
  },
  "recipients": ["ade@firstbank.com.ng", "chidi@firstbank.com.ng"],
  "isWhiteLabel": false
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "rpt_4b5c6d7e8f9a0b1c",
    "name": "Monthly Brand Health Report — July 2026",
    "status": "active",
    "nextRunAt": "2026-08-01T08:00:00.000Z",
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/analytics/exports

Export data in CSV, Excel, JSON, or PDF format. **Requires: Analyst role or above**

**Request Body:**
```json
{
  "dataSource": "monitoring",
  "format": "csv",
  "filters": {
    "startDate": "2026-07-01T00:00:00.000Z",
    "endDate": "2026-07-21T23:59:59.000Z",
    "sentimentLabel": "negative"
  },
  "fields": ["id", "title", "source", "sentimentLabel", "reachEstimate", "aveNaira", "publishedAt"]
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "exportId": "exp_5c6d7e8f9a0b1c2d",
    "status": "processing",
    "format": "csv",
    "estimatedCompletionAt": "2026-07-21T10:35:00.000Z"
  }
}
```

---

### GET /api/v1/analytics/exports/{id}

Check export status and get download URL.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "exp_5c6d7e8f9a0b1c2d",
    "status": "completed",
    "format": "csv",
    "rowCount": 247,
    "fileSizeBytes": 48250,
    "downloadUrl": "https://cdn.nawebeus.com/exports/exp_5c6d7e8f9a0b1c2d.csv?sig=...",
    "expiresAt": "2026-07-22T10:35:00.000Z",
    "completedAt": "2026-07-21T10:33:00.000Z"
  }
}
```

---

## 14. PR & Media Relations Endpoints

### POST /api/v1/pr/press-releases

Create a new press release. **Requires: Manager role or above**

**Request Body:**
```json
{
  "title": "First Bank of Nigeria Launches Digital Banking Platform for 10 Million Customers",
  "subtitle": "New platform available for iOS, Android, and web",
  "content": "First Bank of Nigeria today announced the launch of...",
  "summary": "First Bank launches digital banking platform targeting 10 million customers",
  "contactName": "Ade Ogunleye",
  "contactEmail": "ade@firstbank.com.ng",
  "contactPhone": "+2348012345678",
  "embargoDate": "2026-07-22T07:00:00.000Z",
  "distributionChannels": ["email", "wire"],
  "scheduledDistributionAt": "2026-07-22T08:00:00.000Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "pr_6d7e8f9a0b1c2d3e",
    "title": "First Bank of Nigeria Launches Digital Banking Platform for 10 Million Customers",
    "status": "draft",
    "scheduledDistributionAt": "2026-07-22T08:00:00.000Z",
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/pr/press-releases/{id}/distribute

Distribute a press release to journalists. **Requires: Manager role or above**

**Request Body:**
```json
{
  "contactIds": ["ctc_3b4c5d6e7f8a9b0c", "ctc_8d7c6b5a4e3f2g1h"],
  "channel": "email",
  "customSubjectLine": "EXCLUSIVE: First Bank Launches Digital Banking Platform"
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "distributionId": "out_7e8f9a0b1c2d3e4f",
    "pressReleaseId": "pr_6d7e8f9a0b1c2d3e",
    "status": "sending",
    "recipientCount": 2,
    "scheduledAt": "2026-07-21T10:35:00.000Z"
  }
}
```

---

## 15. Billing Endpoints (₦)

### GET /api/v1/billing/subscription

Get current subscription details. **Requires: Admin role**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "sub_8f9a0b1c2d3e4f5a",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "planTier": "enterprise",
    "billingCycle": "annual",
    "monthlyPriceNaira": 280000.00,
    "annualTotalNaira": 3360000.00,
    "discountPercentage": 20,
    "currency": "NGN",
    "status": "active",
    "currentPeriodStart": "2026-07-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-07-31T23:59:59.000Z",
    "cancelAtPeriodEnd": false,
    "paystackSubscriptionId": "SUB_xxxxxxxxxxxxxxxx"
  }
}
```

---

### GET /api/v1/billing/invoices

List billing invoices in Nigerian Naira. **Requires: Admin role**

**Query Parameters:**
- `status` — `draft` | `open` | `paid` | `void`
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bill_9a0b1c2d3e4f5a6b",
      "invoiceNumber": "NWB-2026-0047",
      "paystackReference": "PS_20260701_001234",
      "amountNaira": 280000.00,
      "taxNaira": 0.00,
      "totalNaira": 280000.00,
      "currency": "NGN",
      "status": "paid",
      "description": "Nawebeus Enterprise Plan — July 2026",
      "periodStart": "2026-07-01T00:00:00.000Z",
      "periodEnd": "2026-07-31T23:59:59.000Z",
      "paidAt": "2026-07-01T00:05:00.000Z",
      "invoicePdfUrl": "https://cdn.nawebeus.com/invoices/NWB-2026-0047.pdf"
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "totalCount": 3
  }
}
```

---

### GET /api/v1/billing/plans

Get all available subscription plans with ₦ pricing. Public endpoint.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "tier": "starter",
        "name": "Starter",
        "monthlyPriceNaira": 50000.00,
        "annualMonthlyPriceNaira": 40000.00,
        "annualTotalNaira": 480000.00,
        "annualDiscountPercentage": 20,
        "currency": "NGN",
        "features": {
          "users": 3,
          "socialAccounts": 5,
          "mentionsPerMonth": 10000,
          "monitoringKeywords": 10,
          "reportGenerations": 10
        }
      },
      {
        "tier": "growth",
        "name": "Growth",
        "monthlyPriceNaira": 150000.00,
        "annualMonthlyPriceNaira": 120000.00,
        "annualTotalNaira": 1440000.00,
        "annualDiscountPercentage": 20,
        "currency": "NGN",
        "features": {
          "users": 10,
          "socialAccounts": 10,
          "mentionsPerMonth": 50000,
          "monitoringKeywords": 50,
          "reportGenerations": 25
        }
      },
      {
        "tier": "professional",
        "name": "Professional",
        "monthlyPriceNaira": 350000.00,
        "annualMonthlyPriceNaira": 280000.00,
        "annualTotalNaira": 3360000.00,
        "annualDiscountPercentage": 20,
        "currency": "NGN",
        "features": {
          "users": 25,
          "socialAccounts": 15,
          "mentionsPerMonth": 150000,
          "monitoringKeywords": 100,
          "reportGenerations": 50
        }
      },
      {
        "tier": "agency",
        "name": "Agency",
        "monthlyPriceNaira": 500000.00,
        "annualMonthlyPriceNaira": 400000.00,
        "annualTotalNaira": 4800000.00,
        "annualDiscountPercentage": 20,
        "currency": "NGN",
        "features": {
          "users": 50,
          "socialAccounts": 50,
          "mentionsPerMonth": 500000,
          "clientWorkspaces": "unlimited",
          "whiteLabel": true,
          "reportGenerations": "unlimited"
        }
      }
    ]
  }
}
```

---

## 16. Notifications Endpoints

### GET /api/v1/notifications

List user notifications with read/unread status.

**Query Parameters:**
- `read` — `true` | `false` — Filter by read status
- `type` — Filter by notification type
- `limit`, `cursor` — Pagination

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "not_0b1c2d3e4f5a6b7c",
      "type": "crisis_alert",
      "title": "Severity 4 Crisis Alert",
      "body": "Unusual negative sentiment spike detected — 847 mentions in 90 minutes.",
      "actionUrl": "/monitor/crisis/inc_4d5e6f7a8b9c0d1e",
      "isRead": false,
      "createdAt": "2026-07-21T10:47:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Im5vdF8xMjMifQ==",
    "hasMore": true,
    "totalCount": 14
  }
}
```

---

### PATCH /api/v1/notifications/{id}

Mark a notification as read or unread.

**Request Body:**
```json
{
  "isRead": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "not_0b1c2d3e4f5a6b7c",
    "isRead": true,
    "readAt": "2026-07-21T10:50:00.000Z"
  }
}
```

---

### POST /api/v1/notifications/mark-all-read

Mark all notifications as read.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "updatedCount": 14
  }
}
```

---

## 17. Webhook Endpoints

### POST /api/v1/webhooks/paystack

Paystack payment event handler. Called by Paystack when subscription events occur.

**Required Headers:**
```
X-Paystack-Signature: sha512=xyz789...
Content-Type: application/json
```

**Handled Events:**

| Event | Description | Nawebeus Action |
|-------|-------------|----------------|
| `charge.success` | ₦ payment successful | Activate/renew subscription, generate invoice |
| `subscription.create` | New subscription created | Update org plan tier, send welcome email |
| `subscription.disable` | Subscription cancelled | Deactivate org subscription, notify admin |
| `subscription.expiring_cards` | Card expiring soon | Notify admin to update payment method |
| `invoice.payment_failed` | ₦ payment failed | Enter grace period, notify admin |

**Response (200):**
```json
{
  "success": true,
  "data": { "received": true }
}
```

---

### POST /api/v1/webhooks/social/{platform}

Inbound webhook from social platforms. Platform-specific signature verification applied.

**Path Parameters:**
- `platform` — `twitter` | `instagram` | `facebook` | `linkedin` | `tiktok`

**Required Headers:**
```
X-Hub-Signature-256: sha256=abc123...  (Facebook/Instagram)
X-Twitter-Webhooks-Signature: sha256=abc123...  (Twitter/X)
```

**Response (200):**
```json
{
  "success": true,
  "data": { "received": true }
}
```

---

## 18. WebSocket API

### 18.1 Connection

```
wss://api.nawebeus.com/ws/v1
```

**Authentication:**
```
wss://api.nawebeus.com/ws/v1?token=<access_token>
```

**Connection Message (server → client after successful auth):**
```json
{
  "type": "connected",
  "data": {
    "userId": "usr_9f2a4b6c8d1e3f5g",
    "organizationId": "org_7e3b2c1d4f5a6b8c",
    "connectedAt": "2026-07-21T10:30:00.000Z"
  }
}
```

### 18.2 WebSocket Event Types

All events follow this structure:

```json
{
  "type": "event_type",
  "data": { },
  "timestamp": "2026-07-21T10:30:00.000Z",
  "organizationId": "org_7e3b2c1d4f5a6b8c"
}
```

**Crisis Events:**
```json
{
  "type": "crisis:alert",
  "data": {
    "incidentId": "inc_4d5e6f7a8b9c0d1e",
    "severity": "s4_escalate",
    "title": "GTBank Transfer Fee Backlash",
    "mentionCount": 847,
    "reachEstimate": 1200000,
    "detectedAt": "2026-07-21T10:47:00.000Z"
  }
}
```

**Monitoring Events:**
```json
{
  "type": "mention:new",
  "data": {
    "mentionId": "ment_7a8b9c0d1e2f3a4b",
    "platform": "twitter",
    "sentimentLabel": "negative",
    "authorInfluenceScore": 72,
    "publishedAt": "2026-07-21T10:45:00.000Z"
  }
}
```

**Engagement Events:**
```json
{
  "type": "inbox:message",
  "data": {
    "conversationId": "cnv_1e2f3a4b5c6d7e8f",
    "messageId": "msg_2f3a4b5c6d7e8f9a",
    "platform": "twitter",
    "priority": "high",
    "slaDeadline": "2026-07-21T12:30:00.000Z"
  }
}
```

**Publishing Events:**
```json
{
  "type": "publish:status",
  "data": {
    "postId": "post_0d1e2f3a4b5c6d7e",
    "platform": "twitter",
    "status": "published",
    "platformPostId": "1234567890123456789",
    "publishedAt": "2026-07-22T10:00:00.000Z"
  }
}
```

```json
{
  "type": "publish:failed",
  "data": {
    "postId": "post_0d1e2f3a4b5c6d7e",
    "platform": "instagram",
    "error": "RATE_LIMIT_EXCEEDED",
    "retryAt": "2026-07-22T10:15:00.000Z"
  }
}
```

**Metrics Events:**
```json
{
  "type": "metrics:update",
  "data": {
    "kpi": "totalMentions",
    "value": 12847,
    "previousValue": 12800,
    "updatedAt": "2026-07-21T10:30:00.000Z"
  }
}
```

---

## 19. Audit Log Endpoints

Read access to `unified_audit_log`. Landed **2026-09-21** with NWB-P1-002, as the first half of F-19
("the audit log has no read API"). Unlike the draft paths elsewhere in this reference, the routes below
are the ones that exist in the codebase today.

**Path note.** The System Administration module spec plans `GET /api/v1/admin/audit-log` for the admin
console, with `admin:audit:read` as its permission. What ships now is `GET /api/audit` guarded by the
ability `read audit`, mounted without the `/v1` segment because that is how every live route in
`src/server/index.ts` is mounted; the version prefix arrives with §20.1's versioning work, not before it.
The console view and `POST …/audit-log/export` (§3.3's FR-ADMIN-020) remain unbuilt — that screen is a
consumer of these two endpoints, not a second API.

| Method | Path | Ability | Purpose |
|---|---|---|---|
| `GET` | `/api/audit` | `read audit` | One page of the calling organization's audit trail, newest first |
| `GET` | `/api/audit/:id` | `read audit` | One event, with the state snapshots the list omits |

### 19.1 Scope Rules

Enforced in the route (`src/server/api/audit/audit.route.ts`) before the query service is called, so no
caller can reach a query that forgets them:

| Rule | Behaviour |
|---|---|
| The organization comes from the access token | `organizationId` is read from the JWT. No parameter can widen it. |
| `?organizationId=` is a platform capability, not a filter | Only a platform role (`super_admin`) may name **one** other organization. Anyone else gets **403** — a silently ignored parameter would let a caller read their own log believing they were reading someone else's. |
| There is no "all organizations" | Naming another org is bounded to exactly one tenant; a whole-table read does not exist. Cross-platform investigation is deferred to Phase 15's support tooling (`P15-006`), where it belongs. |
| Org-less platform rows are a capability too | Nightly purge and rate-limit reclamation events carry `organization_id IS NULL` because one run sweeps every tenant. They are reachable by platform roles only, derived from the role and never from a query parameter. |
| A foreign event answers **404**, not 403 | `GET /api/audit/:id` returns "not found" for a row that exists in another tenant as well as for a row that does not exist: distinguishing the two would confirm the id. |
| These endpoints never write | The log is append-only (BR-ADMIN-012); mutation of it through HTTP is prohibited, including for `super_admin`. |

### 19.2 `GET /api/audit` — Parameters

All optional, all combined with `AND`. Unknown parameters are ignored; invalid ones are 422 (§19.4).

| Parameter | Type | Notes |
|---|---|---|
| `actorId` | uuid | Who performed the action |
| `targetUserId` | uuid | Whose data was affected — the column that answers "what did this admin do to this user" |
| `action` | string ≤ 100 | Exact registry name, e.g. `apikeys.revoked`. Filter values are validated as strings, not as registry members: saved filters outlive vocabulary changes |
| `actorType` | enum | `user`, `admin`, `system`, `api_key`, `impersonation` — who, categorically, acted |
| `module` | enum | `core`, `admin`, `compliance`, `security`, `engagement`, `publishing`, `listening`, `monitoring`, `influencer`, `pr`, `commerce`, `campaigns`, `social_accounts`, `analytics`, `system` |
| `category` | enum | `authentication`, `authorization`, `user_management`, `content`, `billing`, `security`, `compliance`, `system_config`, `feature_flag`, `engagement`, `publishing`, `listening`, `data_ops` |
| `severity` | enum | `info`, `warning`, `critical`, `emergency` |
| `resourceType` | string ≤ 50 | e.g. `api_key`, `organization` |
| `resourceId` | string ≤ 64 | Paired with `resourceType` for a precise lookup |
| `requestId` | string ≤ 100 | Correlates a request across logs and rows; indexed (`idx_ual_request_id`) |
| `from`, `to` | ISO 8601 | Both bounds **inclusive** (`created_at >= from AND created_at <= to`). An empty range returns no rows rather than 422, because "what happened between X and X" is a legitimate query. |
| `organizationId` | uuid | Platform roles only — see §19.1 |
| `limit` | integer | Default 20, max 100 |
| `cursor` | string | The opaque `meta.pagination.cursor` from a previous page |

### 19.3 Response

```json
{
  "data": {
    "events": [
      {
        "id": "al_8f3c1d2e-4b5a-6f70-8192",
        "createdAt": "2026-09-21T02:15:00.123456Z",
        "organizationId": "0b4e4d2a-6f3c-4a1e-9d5b-7c2f8e1a3b45",
        "module": "core",
        "category": "security",
        "severity": "info",
        "action": "apikeys.revoked",
        "actorId": "3c9a1e2f-4b5c-6d7e-8f90-1a2b3c4d5e6f",
        "actorType": "user",
        "targetUserId": null,
        "resourceType": "api_key",
        "resourceId": "6d2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
        "requestId": "9f2c7c0e-1b3a-4a6e-8d5f-2c1b0a9e7d64",
        "sessionId": null,
        "reason": null,
        "hashChainValid": true
      }
    ]
  },
  "meta": { "pagination": { "cursor": null, "hasMore": false } }
}
```

Ordering is `(createdAt, id) DESC`. `createdAt` carries microseconds because `timestamptz` does and
because the cursor needs the same precision the column has — a cursor built from `toISOString()` would
skip rows whose sub-millisecond component was truncated, the failure class recorded as F-14. `id` is the
tiebreaker for rows that share a timestamp, which bulk writes produce routinely.

The list omits `beforeState`, `afterState`, `changes`, `actorIp`, `actorUserAgent`, `checksum` and
`previousChecksum`; `GET /api/audit/:id` returns `beforeState`, `afterState`, `changes`, `actorIp` and
`actorUserAgent`, and still no checksums. `id` is `al_` + 21 characters — the column is `varchar(64)`,
not a uuid, which is why `:id` and the cursor tiebreaker are validated as text and no `::uuid` cast
appears anywhere in the query. `hashChainValid` is `true` on every row today: that is the column's
default, and it stays honest only because nothing computes it yet — NWB-P1-014 adds the chain and the
verification job that flips it to `false`, and the field ships now so the response shape does not change
underneath consumers when it lands.

`meta.pagination.cursor` is the opaque token to pass back as `?cursor=`; it is `null` when there is no
further page, and `hasMore` is computed the way §2.6 specifies (one row fetched beyond the page).

**`GET /api/audit/:id`** returns `{ "data": { "event": { …as above, plus the snapshots } } }` with no
`meta` block.

### 19.4 Errors

| Status | `code` | When |
|---|---|---|
| 401 | `AUTH_ERROR` | No session. Checked before parsing, so an unauthenticated caller never learns whether a filter value is valid. |
| 403 | `FORBIDDEN` | Role lacks `audit.read` (`Missing permission: read audit`), or a non-platform role passed another organization's id |
| 404 | `NOT_FOUND` | Unknown id, or a row belonging to another tenant |
| 422 | `VALIDATION_ERROR` | `message` names the failure and `error.details[]` carries one `{field, message}` per rejected parameter — for an enum, `message` lists every legal value (taken from the schema's own enum, not a hand-copied list), so a wrong `module` is self-correcting. A malformed `:id` is 422 for the same reason; an unknown but well-formed one is 404. |

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid audit query",
    "details": [
      { "field": "module", "message": "Invalid option: expected one of \"core\"|\"admin\"|…" }
    ]
  }
}
```

### 19.5 Deliberately Absent

| Gap | Where it is tracked |
|---|---|
| Hash chain on write, verification job, `hashChainValid` becoming real | NWB-P1-014 (split out of this ticket by Q1's answer; the two `module: "core"` workarounds flip there) |
| Retention (7 years, FR-ADMIN-021) and legal holds | NWB-P1-010 |
| Anonymizing rows of erased subjects | NWB-P1-015 (defect F-29) |
| Export in JSON/CSV/PDF, watermarking | FR-ADMIN-020 / BR-ADMIN-022, Phase 7 console work |
| Full-text search over `changes` | Second half of FR-ADMIN-019; needs an index decision (GIN over jsonb), not a `LIKE` |
| Rows with `actorType = "impersonation"` | Nothing writes them yet — NWB-P1-011 creates the sessions; the filter is ready for them |
| Anything beyond `GET` — export, watermarking, a saved-filter builder | Phase 7 (System Administration §7.2), on top of these two endpoints |

---


## 20. API Versioning

### 19.1 Version Strategy

| Version | Status | Support Until |
|---------|--------|--------------|
| `v1` | ✅ Current | Minimum 12 months after `v2` release |
| `v2` | 🗓 Planned | Q2 2027 (tentative) |

### 19.2 Breaking vs. Non-Breaking Changes

**Breaking changes** (require new major version):
- Removing an endpoint
- Removing a required field from a request
- Removing a field from a response
- Changing a field's type (e.g., string → number)
- Changing authentication mechanism
- Changing an error code's HTTP status

**Non-breaking changes** (allowed in existing version):
- Adding a new endpoint
- Adding an optional request field
- Adding a new field to a response
- Adding a new error code
- Adding a new query parameter
- Increasing a rate limit

### 19.3 Deprecation Headers

```http
Deprecation: true
Sunset: Mon, 01 Jun 2027 00:00:00 GMT
Link: <https://docs.nawebeus.com/api/v2/migration>; rel="successor-version"
```

---

## 21. Client SDKs

| Language | Package | Status |
|----------|---------|--------|
| **JavaScript / TypeScript** | `@nawebeus/sdk-js` | ✅ Available |
| **React Native** | `@nawebeus/sdk-react-native` | 🗓 Planned Q3 2026 |
| **Python** | `nawebeus-sdk-python` | 🗓 Planned Q1 2027 |

**JavaScript SDK Installation:**
```bash
bun add @nawebeus/sdk-js
# or
npm install @nawebeus/sdk-js
```

**Usage:**
```typescript
import { Nawebeus } from '@nawebeus/sdk-js';

const client = new Nawebeus({
  apiKey: 'nwb_live_xxxxxxxxxxxxxxxxxxxxxxxx',
  organizationId: 'org_7e3b2c1d4f5a6b8c',
  baseUrl: 'https://api.nawebeus.com/api/v1',
});

// Get monitoring articles
const articles = await client.monitoring.articles.list({
  sentimentLabel: 'negative',
  limit: 20,
});

// Create a post (all monetary values in ₦)
const post = await client.publishing.posts.create({
  platforms: [{ platform: 'twitter', content: 'Hello Nigeria! 🇳🇬' }],
  scheduledAt: new Date('2026-07-22T10:00:00Z'),
  requiresApproval: true,
});

// Get subscription pricing in ₦
const plans = await client.billing.plans.list();
// plans[0].monthlyPriceNaira === 50000 // ₦50,000/month
```

---

## 22. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | _________________ | _________ | _______ |
| Product Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |

---

## 23. Related Documents

| Document | Relationship |
|----------|-------------|
| **Architecture** | System design that determines API structure and middleware chain |
| **Engineering Standards** | API design conventions enforced in this reference |
| **ADRs** | ADR-014 (RESTful API standards), ADR-007 (Paystack), ADR-010 (JWT auth) |
| **Database Schema** | Schema that backs the data returned by these endpoints |
| **QA Strategy** | Integration tests that validate every endpoint in this document |
| **Security Policy** | Authentication and authorization controls enforced by this API |
| **User Journeys** | End-to-end flows that these endpoints support |
| **Personas** | Users whose workflows these endpoints serve |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Engineering Lead | Unified and expanded API Reference document. Merges and improves both source documents into a single comprehensive reference. Adds: Nigerian market API conventions (₦ field naming with `Naira` suffix, `NGN` currency fields, WAT timezone defaults, Nigerian email domain examples, +234 phone format), complete ₦ billing plans endpoint with all 5 tiers priced in Naira, Paystack webhook event table with ₦ amounts, NDPR-compliant journalist consent fields, crisis incident endpoints with full S1–S5 severity framework, complete error code reference including `VALIDATION_INVALID_NAIRA_AMOUNT` and `SYSTEM_PAYSTACK_ERROR`, expanded WebSocket events with `crisis:alert` event including Nigerian brand context, and JavaScript SDK usage example with ₦ pricing. |
| 1.1.0 | 2026-09-21 | Engineering Lead | Added §19 (Audit Log Endpoints), documenting the `GET /api/audit` + `GET /api/audit/:id` surface shipped by NWB-P1-002, including the scope rules (organization from the token, one-named-organization escape hatch for platform roles) and the deliberate gaps tracked as NWB-P1-010/011/014/015. Former §19–§22 renumbered to §20–§23. |

---

*This document is owned by the Engineering Lead and reviewed with every API version release. The OpenAPI specification at `https://api.nawebeus.com/api/v1/openapi.json` is the machine-readable source of truth — this document is the human-readable complement. Any discrepancy between the two should be resolved by updating the OpenAPI spec.*