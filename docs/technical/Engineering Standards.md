# Engineering Standards

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document defines the complete engineering standards for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It establishes coding standards, import boundaries, TypeScript configuration, testing requirements, CI/CD enforcement, code review requirements, git workflow, observability practices, security practices, performance patterns, incident response, and the local development setup.

This document complements the **Architecture**, **Tech Stack**, **ADRs**, and **Database Schema** documents. When these documents appear to conflict, the ADRs take precedence.

**Engineering Philosophy:**

| Principle                     | Description                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quality by Default**        | Every commit meets quality standards; CI catches regressions before code review                                                               |
| **Automated Enforcement**     | Linting, formatting, import boundaries, and tests are automated — not left to developer discipline                                            |
| **Consistency Wins**          | All developers follow the same patterns regardless of seniority or module ownership                                                           |
| **Continuous Improvement**    | Standards evolve with the team through documented ADRs and retrospective action items                                                         |
| **Documentation First**       | Code is documented; decisions are recorded; module specs precede implementation                                                               |
| **Nigerian Market Awareness** | Engineering decisions reflect the realities of operating in Nigeria — data sovereignty, ₦ currency, WAT timezone, variable network conditions |

**Core Standards at a Glance:**

| Standard               | Tool                                | Enforcement                       |
| ---------------------- | ----------------------------------- | --------------------------------- |
| TypeScript strict mode | `tsc`                               | CI — blocks merge on type errors  |
| Import boundaries      | ESLint `import/no-restricted-paths` | CI — blocks merge on violations   |
| Code formatting        | Prettier                            | Pre-commit hook + CI              |
| Code linting           | ESLint                              | Pre-commit hook + CI              |
| Unit test coverage     | Bun test                            | CI — blocks merge below threshold |
| Security scanning      | `bun audit` + Trivy                 | CI weekly + every deploy          |
| Commit message format  | Conventional Commits                | Husky `commit-msg` hook           |
| Database migrations    | Drizzle Kit                         | Engineering Lead review required  |
| Secrets management     | Environment variables only          | Pre-commit hook scans for secrets |

---

## 2. Core Engineering Principles

These principles are not aspirational guidelines — they are enforced by CI and code review. Any deviation requires a documented ADR.

| #   | Principle                   | Application                                                                                                                                             | Enforcement Mechanism                                                 |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Single Source of Truth**  | All business logic resides exclusively in the services layer. Routes, actions, and components handle only validation, auth check, and response shaping. | Code review; architecture linting                                     |
| 2   | **No Reverse Dependencies** | Services never import from web actions, API routes, or mobile layers.                                                                                   | ESLint `import/no-restricted-paths` — CI fails on violations          |
| 3   | **Cache First**             | Every read operation checks the cache before querying the database.                                                                                     | Code review; cache service abstraction makes this natural             |
| 4   | **Rate Limit First**        | Every endpoint enforces rate limits before any business logic processing.                                                                               | Hono middleware; integration tests verify rate limiting is applied    |
| 5   | **Type Safety End-to-End**  | TypeScript strict mode everywhere; Zod validation at every external boundary; no `any` without explicit justification.                                  | `tsc --noEmit` in CI; ESLint `no-explicit-any: error`                 |
| 6   | **Test Before Merge**       | Every PR must include unit tests for new service methods and integration tests for new API endpoints.                                                   | CI coverage gates                                                     |
| 7   | **Audit by Default**        | Every state-changing operation writes an append-only audit log entry before returning.                                                                  | Code review; schema check (audit table rows > 0 in integration tests) |
| 8   | **Least Privilege**         | Users have the minimum permissions needed for their role. CASL conditions enforce resource-level access.                                                | CASL ability definitions; mandatory negative-path RBAC tests          |
| 9   | **Data Sovereignty**        | Nigerian user data is processed and stored within Nigeria. No third-party service receives PII without explicit NDPR legal basis.                       | Architecture review; dependency security review                       |
| 10  | **₦ Currency Throughout**   | All monetary values stored as `NUMERIC(15,2)` in Nigerian Naira. No USD or other currencies without explicit requirement.                               | Database schema review; code review                                   |

---

## 3. Project Structure

### 3.1 Canonical Folder Structure

```
nawebeus/
├── app/                          # TanStack Start web application
│   ├── routes/                   # File-based routing (TanStack Start)
│   │   ├── _app.tsx              # Root layout
│   │   ├── index.tsx             # Landing page
│   │   ├── dashboard/            # Dashboard routes
│   │   ├── monitor/              # Media monitoring routes
│   │   ├── publish/              # Social publishing routes
│   │   ├── engage/               # Unified inbox routes
│   │   ├── analyze/              # Analytics routes
│   │   ├── grow/                 # Campaigns routes
│   │   └── settings/             # Settings routes
│   ├── components/               # React UI components
│   │   ├── ui/                   # shadcn/ui primitives (copy-paste, not a package)
│   │   ├── shared/               # Shared cross-module components
│   │   ├── monitor/              # Monitor module components
│   │   ├── publish/              # Publish module components
│   │   ├── engage/               # Engage module components
│   │   ├── analyze/              # Analyze module components
│   │   └── grow/                 # Grow module components
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand client state stores
│   └── utils/                    # Web app utilities (presentation logic only)
│
├── server/                       # Hono API server
│   ├── api/                      # Hono route handlers (no business logic)
│   │   ├── monitoring.ts
│   │   ├── publishing.ts
│   │   ├── engagement.ts
│   │   ├── analytics.ts
│   │   ├── campaigns.ts
│   │   ├── crisis.ts
│   │   └── billing.ts            # ₦ billing via Paystack
│   ├── middleware/               # Hono middleware
│   │   ├── auth.ts               # JWT validation
│   │   ├── tenant.ts             # Organization context + RLS setup
│   │   ├── rate-limit.ts         # Rate limiting (SQLite-backed)
│   │   └── audit.ts              # Request audit logging
│   └── webhooks/                 # Inbound webhook handlers
│       ├── paystack.ts           # Paystack ₦ payment webhooks
│       ├── twitter.ts
│       └── instagram.ts
│
├── services/                     # Business logic layer (single source of truth)
│   ├── monitoring/
│   │   ├── monitoring.service.ts
│   │   ├── monitoring.types.ts
│   │   └── monitoring.service.test.ts
│   ├── publishing/
│   │   ├── publishing.service.ts
│   │   ├── publishing.types.ts
│   │   └── publishing.service.test.ts
│   ├── engagement/
│   ├── analytics/
│   ├── crisis/
│   ├── pr/
│   ├── competitive/
│   ├── agency/
│   ├── influencer/
│   ├── billing/                  # ₦ billing via Paystack
│   ├── notification/
│   ├── user/
│   └── audit/
│
├── db/                           # Database layer (PostgreSQL via Drizzle)
│   ├── schema/                   # Drizzle schema definitions
│   │   ├── core.ts               # users, organizations, members
│   │   ├── monitoring.ts         # articles, media_contacts, press_releases
│   │   ├── social.ts             # social_accounts, mentions, listening_queries
│   │   ├── publishing.ts         # posts, schedules, templates
│   │   ├── engagement.ts         # conversations, messages, response_templates
│   │   ├── analytics.ts          # dashboards, reports, custom_metrics
│   │   ├── campaigns.ts          # campaigns, entries, winners
│   │   ├── billing.ts            # subscriptions, invoices (₦), payment_methods
│   │   └── audit.ts              # audit_log, admin_audit_log, dsar_requests
│   ├── migrations/               # Generated SQL migrations (never hand-edit)
│   │   └── 0001_initial.sql
│   └── index.ts                  # Drizzle client initialization
│
├── lib/                          # Shared infrastructure utilities
│   ├── auth/
│   │   ├── jwt.ts                # JWT issue, verify, refresh
│   │   └── passwords.ts          # bcrypt via Bun.password
│   ├── rbac/
│   │   ├── abilities.ts          # CASL ability definitions
│   │   └── permissions.ts        # Permission check helpers
│   ├── validation/               # Zod schemas (shared between web and API)
│   │   ├── monitoring.schemas.ts
│   │   ├── publishing.schemas.ts
│   │   ├── engagement.schemas.ts
│   │   └── billing.schemas.ts    # ₦ amount validation schemas
│   ├── cache/
│   │   └── cache.service.ts      # SQLite cache (MVP) → Redis interface (Year 2)
│   ├── rate-limit/
│   │   └── rate-limit.service.ts # SQLite sliding-window rate limiter
│   ├── logger/
│   │   └── logger.ts             # Structured JSON logger
│   ├── id/
│   │   └── id.ts                 # Prefixed ID generation (usr_, org_, etc.)
│   └── errors/
│       └── errors.ts             # Typed error hierarchy
│
├── mobile/                       # React Native + Expo (thin client)
│   ├── app/                      # Expo Router file-based navigation
│   ├── components/               # React Native components
│   └── api-client/               # HTTP client for Hono API
│
├── shared-types/                 # TypeScript types shared across web, API, mobile
│   ├── entities.ts               # Core entity types
│   ├── api.ts                    # API request/response types
│   └── events.ts                 # WebSocket event types
│
├── tests/                        # Test files (co-located unit tests preferred)
│   ├── integration/              # API integration tests (Supertest + Hono test)
│   ├── e2e/                      # Playwright (web) + Maestro (mobile) E2E tests
│   └── fixtures/                 # Shared test data and factories
│
├── scripts/                      # Build, migration, and deployment scripts
│
├── .env.example                  # Required environment variables (placeholder values)
├── .gitignore                    # .env always gitignored
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS + shadcn/ui theme
├── drizzle.config.ts             # Drizzle Kit configuration
├── .eslintrc.ts                  # ESLint configuration with import boundaries
├── .prettierrc                   # Prettier configuration
└── package.json                  # Dependencies and scripts
```

### 3.2 Import Boundary Rules

The import boundary is the single most important structural rule in the codebase. It is enforced by ESLint (`import/no-restricted-paths`) and CI fails on any violation.

```
app/           → can import from: services/, lib/, shared-types/
server/        → can import from: services/, lib/, shared-types/
mobile/        → can import from: shared-types/ ONLY
               → CANNOT import from: app/, server/, services/
services/      → can import from: lib/, shared-types/, db/, cache/, rate-limit/
               → CANNOT import from: app/, server/, mobile/
lib/           → can import from: shared-types/, db/ (query helpers only)
               → CANNOT import from: app/, server/, services/
db/            → can import from: shared-types/
cache/         → can import from: shared-types/
rate-limit/    → can import from: shared-types/
shared-types/  → no imports from any other internal module
```

**The reverse is absolutely forbidden.** If `services/` imports from `app/` or `server/`, business logic has leaked into the wrong layer. This is caught by CI and blocks the PR.

**Why this matters:** If a service could import from the web layer, business logic would inevitably drift into components and routes. The import boundary makes it structurally impossible to violate the single source of truth principle — the services layer is always the authority.

### 3.3 File Naming Conventions

| File Type                   | Convention            | Examples                                      |
| --------------------------- | --------------------- | --------------------------------------------- |
| Folders                     | `kebab-case`          | `monitoring-service/`, `user-management/`     |
| TypeScript utilities        | `camelCase`           | `monitoringService.ts`, `hashToken.ts`        |
| TypeScript React components | `PascalCase`          | `MentionCard.tsx`, `CrisisAlert.tsx`          |
| TypeScript React pages      | `kebab-case`          | `crisis-management.tsx`, `press-releases.tsx` |
| SQL migrations              | `NNNN_snake_case.sql` | `0042_add_naira_fields.sql`                   |
| Markdown documents          | `kebab-case`          | `engineering-standards.md`                    |
| Test files (co-located)     | `{filename}.test.ts`  | `monitoring.service.test.ts`                  |

### 3.4 Module Organization

Each service module is self-contained:

```
services/monitoring/
├── monitoring.service.ts         # Business logic (the service)
├── monitoring.types.ts           # Types specific to this module
├── monitoring.errors.ts          # Typed errors for this module
└── monitoring.service.test.ts    # Unit tests (co-located)
```

Cross-module dependencies are explicit and documented. A module may import another module's service only by importing the service file directly — never reaching into another module's internals.

---

## 4. TypeScript Standards

### 4.1 Compiler Configuration

The following `tsconfig.json` settings are **non-negotiable**. Any relaxation of a strict flag requires a documented ADR explaining why.

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM"],
    "paths": {
      "@db/*": ["./db/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

### 4.2 The `any` Rule

`any` is **forbidden**. The ESLint rule `@typescript-eslint/no-explicit-any: "error"` causes CI to fail on any `any` usage.

Acceptable alternatives:

| Situation                           | Correct Alternative                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Type is genuinely unknown           | `unknown`                                                                                                                         |
| Type is a specific shape            | Define an explicit `interface` or `type`                                                                                          |
| Type is parametric                  | Use a generic `<T>`                                                                                                               |
| Third-party library has wrong types | Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why and link to the upstream issue |
| JSON data from external API         | `Record<string, unknown>` validated through Zod before use                                                                        |

**If you find yourself reaching for `any`, the solution is almost always to add a Zod schema and infer the type.**

### 4.3 Type and Interface Conventions

| Rule                  | Description                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type vs Interface** | Prefer `type` for unions, intersections, mapped types, and function signatures. Prefer `interface` for object shapes that will be `extend`ed. Be consistent within a module. |
| **Naming**            | `PascalCase` for all types and interfaces. Never use an `I` prefix (e.g., `IUser` → `User`).                                                                                 |
| **No God Types**      | Avoid types that describe everything. Narrow types are better than wide types.                                                                                               |
| **Shared types**      | Types used across modules go in `shared-types/`. Module-internal types go in `{module}.types.ts`.                                                                            |
| **JSDoc**             | Every exported type has a JSDoc comment explaining its purpose.                                                                                                              |

### 4.4 Zod Validation Standards

Zod is the standard for runtime validation at every external boundary. The type system provides compile-time safety; Zod provides runtime safety.

**Rules:**

| Rule                      | Description                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Location**              | Zod schemas live in `lib/validation/{module}.schemas.ts`                                             |
| **Single Source of Type** | Never write a TypeScript type separately when you can `z.infer<typeof schema>`                       |
| **Every API Boundary**    | Every Hono route has a request schema and a response schema                                          |
| **Every Server Function** | Every TanStack Start Server Function validates its inputs                                            |
| **Shared Schemas**        | The same schema used in TanStack Form (web), Hono route (API), and service method input validation   |
| **Meaningful Errors**     | Use `.describe()` and custom error messages on schemas                                               |
| **Nigerian Context**      | Monetary schemas use `z.number().positive().multipleOf(0.01)` with description noting ₦ denomination |

**Example pattern:**

```typescript
// lib/validation/billing.schemas.ts
import { z } from "zod";

export const CreateSubscriptionSchema = z.object({
  organizationId: z.string().startsWith("org_"),
  planTier: z.enum([
    "starter",
    "growth",
    "professional",
    "enterprise",
    "agency",
  ]),
  billingCycle: z.enum(["monthly", "annual"]),
  // All prices in Nigerian Naira (₦)
  expectedAmountNaira: z
    .number()
    .positive()
    .multipleOf(0.01)
    .describe("Expected subscription amount in Nigerian Naira (₦)"),
});

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
```

---

## 5. Naming Conventions

### 5.1 Code Naming

| Construct        | Convention                                     | Example                                           |
| ---------------- | ---------------------------------------------- | ------------------------------------------------- |
| Variables        | `camelCase`                                    | `organizationId`, `isVerified`, `prValueNaira`    |
| Functions        | `camelCase`                                    | `getOrganizationById`, `calculateSentimentScore`  |
| Classes          | `PascalCase`                                   | `MonitoringService`, `CrisisAlertHandler`         |
| Interfaces       | `PascalCase`                                   | `Organization`, `MediaMention`, `CrisisIncident`  |
| Types            | `PascalCase`                                   | `UserRole`, `SubscriptionTier`, `SentimentLabel`  |
| Enums            | `PascalCase` (members: `SCREAMING_SNAKE_CASE`) | `SubscriptionTier.AGENCY`, `Severity.S4_ESCALATE` |
| Constants        | `SCREAMING_SNAKE_CASE`                         | `MAX_UPLOAD_SIZE_BYTES`, `DEFAULT_TIMEZONE_WAT`   |
| React components | `PascalCase`                                   | `MentionFeedCard`, `CrisisDashboard`              |
| React hooks      | `camelCase` with `use` prefix                  | `useMonitoringFeed`, `useCrisisAlert`             |
| Zustand stores   | `camelCase` with `use` prefix                  | `useInboxStore`, `usePublishingStore`             |

### 5.2 Database Naming

| Element          | Convention                        | Example                                        |
| ---------------- | --------------------------------- | ---------------------------------------------- |
| Tables           | `snake_case`, plural              | `media_mentions`, `press_releases`             |
| Columns          | `snake_case`                      | `organization_id`, `sentiment_score`           |
| Monetary columns | `{name}_naira` suffix             | `amount_naira`, `prize_value_naira`            |
| Indexes          | `idx_{table}_{columns}`           | `idx_mentions_org`, `idx_articles_sentiment`   |
| Constraints      | `{type}_{table}_{columns}`        | `fk_mentions_organizations`, `uq_articles_url` |
| Enums            | `{table}_{column}` or descriptive | `campaign_status`, `subscription_tier`         |

### 5.3 API Naming

| Element              | Convention                 | Example                                      |
| -------------------- | -------------------------- | -------------------------------------------- |
| URL paths            | `kebab-case`, plural nouns | `/api/media-mentions`, `/api/press-releases` |
| JSON fields          | `camelCase`                | `organizationId`, `sentimentScore`           |
| Monetary JSON fields | `{name}Naira` suffix       | `amountNaira`, `prValueNaira`                |
| Error codes          | `SCREAMING_SNAKE_CASE`     | `CRISIS_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`    |
| Query parameters     | `camelCase`                | `?sortBy=createdAt&filterBy=negative`        |

---

## 6. Code Style

- Use arrow functions exclusively (never function declarations). Confidence: 0.90

### 6.1 Toolchain

| Tool            | Purpose                                                               | When Runs                          |
| --------------- | --------------------------------------------------------------------- | ---------------------------------- |
| **Prettier**    | Code formatting — enforces consistent style                           | Pre-commit hook (lint-staged) + CI |
| **ESLint**      | Code linting — catches errors, enforces import boundaries, bans `any` | Pre-commit hook + CI               |
| **Husky**       | Git hook management — runs pre-commit and commit-msg hooks            | On every `git commit`              |
| **lint-staged** | Runs Prettier and ESLint on staged files only — fast                  | On every `git commit`              |
| **TypeScript**  | Type checking — `tsc --noEmit`                                        | CI on every PR                     |

### 6.2 Import Ordering

Imports are organized in three groups, separated by blank lines, sorted alphabetically within each group:

```typescript
// 1. External packages
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

// 2. Internal modules (using path aliases)
import { db } from "@db/index";
import { monitoringContacts } from "@db/monitoring";
import { cache } from "@lib/cache/cache.service";
import { MonitoringError } from "@services/monitoring/monitoring.errors";

// 3. Type-only imports
import type { CreateMediaContactInput } from "@lib/validation/monitoring.schemas";
import type { Organization } from "@shared/types";
```

### 6.3 Function Guidelines

| Rule                      | Description                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Single responsibility** | A function does one thing and does it well                                                                 |
| **Pure where possible**   | Functions with no side effects are easier to test and reason about                                         |
| **Early returns**         | Reduce nesting with guard clauses (`if (!condition) return` at the top)                                    |
| **Named parameters**      | For functions with 2+ parameters, use object destructuring                                                 |
| **Short functions**       | Target <50 lines; break longer functions into named sub-functions                                          |
| **Async/await always**    | Never use `.then()` chains; always `async`/`await`                                                         |
| **Parallel async**        | Use `Promise.all()` for independent async operations; never `await` sequentially when parallel is possible |
| **JSDoc on public APIs**  | Every exported service method has a JSDoc with `@param`, `@returns`, and `@throws`                         |

```typescript
// ✅ Good — named parameters, early return, JSDoc
/**
 * Retrieves the media monitoring feed for an organization.
 * @param organizationId - The organization to fetch mentions for
 * @param cursor - Opaque cursor for pagination
 * @param limit - Maximum mentions to return (max 100)
 * @returns Paginated mention feed with next cursor
 * @throws {ResourceNotFoundError} If the organization does not exist
 * @throws {InsufficientPermissionError} If the user lacks monitor:read permission
 */
export async function getMonitoringFeed({
  organizationId,
  cursor,
  limit = 20,
}: GetMonitoringFeedInput): Promise<PaginatedMentions> {
  if (limit > 100) {
    throw new ValidationError("Limit cannot exceed 100");
  }
  // ...
}

// ❌ Bad — positional parameters, no JSDoc, ignores error
export async function getMentions(orgId: string, c: string, l: number) {
  try {
    return await db.query.mentions.findMany(/* ... */);
  } catch (_e) {
    // swallowed
    return [];
  }
}
```

### 6.4 Error Handling

```typescript
// ✅ Good — typed errors, full context, never swallowed
import { ResourceNotFoundError, DatabaseError } from "@lib/errors/errors";

try {
  const mention = await db.query.mentions.findFirst({
    where: eq(mentions.id, mentionId),
  });

  if (!mention) {
    throw new ResourceNotFoundError("Media mention not found", {
      mentionId,
      organizationId,
    });
  }
  return mention;
} catch (error) {
  if (error instanceof ResourceNotFoundError) throw error;
  // Wrap unexpected errors with context
  throw new DatabaseError("Failed to retrieve media mention", {
    mentionId,
    cause: error,
  });
}

// ❌ Bad — swallowed, untyped, no context
try {
  return await db.query.mentions.findFirst(/* ... */);
} catch (e: any) {
  console.log(e);
  return null;
}
```

### 6.5 Comments

| Rule                      | Description                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Why, not what**         | Comments explain the reasoning, not the mechanics — the code already says _what_                             |
| **No stale comments**     | A comment that describes the wrong behavior is worse than no comment                                         |
| **TODO format**           | `// TODO(ade, 2026-08-01): Replace with Elasticsearch when volume exceeds 50M rows`                          |
| **No commented-out code** | Delete it; Git has the history                                                                               |
| **Nigerian context**      | Add comments when business logic reflects specific Nigerian regulations, media landscape, or market behavior |

---

## 7. Git Workflow

### 7.1 Branching Strategy

| Branch  | Naming                        | From   | Merged To       | Purpose                                                        |
| ------- | ----------------------------- | ------ | --------------- | -------------------------------------------------------------- |
| `main`  | —                             | —      | —               | Always deployable; every commit is production-ready            |
| Feature | `feature/<short-description>` | `main` | `main` via PR   | New features                                                   |
| Bugfix  | `bugfix/<short-description>`  | `main` | `main` via PR   | Bug fixes                                                      |
| Hotfix  | `hotfix/<short-description>`  | `main` | `main` directly | Critical production fixes; no waiting for regular review cycle |

**Branch name examples:**

- `feature/crisis-severity-classifier`
- `feature/paystack-annual-billing`
- `bugfix/mention-feed-pagination-cursor`
- `hotfix/rls-policy-missing-update`

### 7.2 Commit Message Format

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` Husky hook rejects non-conforming messages.

```
<type>(<scope>): <description>

[optional body — wrap at 72 characters]

[optional footer — BREAKING CHANGE, Closes #issue]
```

**Commit types:**

| Type       | When to Use                                                    |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new feature (user-visible or API-visible)                    |
| `fix`      | A bug fix                                                      |
| `docs`     | Documentation only changes                                     |
| `style`    | Formatting, whitespace — no logic change                       |
| `refactor` | Code restructuring that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                        |
| `test`     | Adding or correcting tests                                     |
| `chore`    | Build scripts, CI configuration, dependency updates, tooling   |
| `security` | Security fix or hardening                                      |

**Scope examples:** `monitoring`, `publishing`, `engagement`, `crisis`, `billing`, `rbac`, `db`, `ci`

**Good commit examples:**

```
feat(crisis): add severity 1-5 classification to monitoring alerts

Implements AI-assisted crisis severity classification using
mention volume, sentiment shift rate, and source authority.
S4+ triggers automatic stakeholder notification workflow.

Closes #247

---

fix(billing): correct ₦ invoice total calculation for annual plans

Annual price was being multiplied by 12 after the discount was applied
instead of before, resulting in incorrect totals for annual subscribers.
Affects organizations on Growth (₦120,000/mo annual) and Professional
(₦280,000/mo annual) plans.

Closes #312

---

chore(deps): update drizzle-orm to 0.32.1

Includes fix for PostgreSQL RLS policy not being applied
on nested relational queries.
```

### 7.3 Pull Request Standards

| Standard        | Requirement                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Size**        | Target <500 lines of changed code. Larger PRs require Engineering Lead pre-approval and must be justified in the PR description. |
| **Description** | Must explain: **what** changed, **why** it was necessary, **how** it was tested.                                                 |
| **References**  | Must link to the relevant module spec, ADR, or GitHub issue.                                                                     |
| **Self-review** | Author self-reviews against the checklist before requesting review.                                                              |
| **CI green**    | All CI checks must pass before review can be approved.                                                                           |
| **Merge style** | Squash and merge to `main`. The squash commit message follows Conventional Commits format.                                       |

---

## 8. Code Review

### 8.1 Review Process

```
Author opens PR
        │
        ▼
CI pipeline runs automatically
  ├── TypeScript: tsc --noEmit
  ├── ESLint: import boundaries, no-any, all rules
  ├── Prettier: formatting check
  ├── Bun test: unit + integration tests
  ├── Coverage gates: ≥85% services, ≥90% lib, ≥70% API endpoints
  └── Security: bun audit (blocks on HIGH+ CVEs)
        │
        ▼ (CI green)
Author requests review from appropriate reviewer(s)
        │
        ▼
Reviewer reviews code, tests, and documentation
(typically within 1 business day)
        │
        ▼
Reviewer approves OR requests changes with specific feedback
        │
        ▼ (if changes requested)
Author addresses feedback, pushes new commits
        │
        ▼
Reviewer re-reviews (focus on requested changes)
        │
        ▼
Reviewer approves
        │
        ▼
Engineering Lead merges (squash and merge)
```

### 8.2 Reviewer Assignment Matrix

| Change Type                      | Required Reviewers                          |
| -------------------------------- | ------------------------------------------- |
| General feature code             | Any 1 senior engineer                       |
| Service layer business logic     | Engineering Lead                            |
| Database schema change           | Engineering Lead                            |
| Authentication or authorization  | Engineering Lead + Security Lead            |
| Multi-tenant isolation (RLS)     | Engineering Lead + Security Lead            |
| NDPR / data compliance           | Engineering Lead + Compliance Officer       |
| External-facing API changes      | Engineering Lead + Product Lead             |
| Paystack / ₦ billing integration | Engineering Lead + Finance Lead             |
| UI components                    | Design Lead + Engineering Lead              |
| Public-facing copy or legal text | Content Lead                                |
| Architecture documents           | Engineering Lead + relevant technical leads |

### 8.3 Reviewer Checklist

Before approving, the reviewer confirms:

**Code Quality**

- [ ] Code follows the naming conventions in Section 5
- [ ] TypeScript is strict — no `any`, no type assertions without justification
- [ ] Functions are single-purpose, appropriately short, and well-named
- [ ] No commented-out code

**Architecture**

- [ ] Import boundaries are respected (no reverse dependencies)
- [ ] Business logic is in the services layer, not in routes or components
- [ ] The change does not introduce circular imports

**Testing**

- [ ] Unit tests cover the new or modified service methods (≥85% target)
- [ ] Integration tests cover new API endpoints
- [ ] Negative-path tests exist for every RBAC permission check
- [ ] Edge cases (empty list, max limits, concurrent requests) are tested

**Security and Compliance**

- [ ] RBAC is enforced at both the API route layer and the service layer
- [ ] Every state-changing operation has audit logging
- [ ] No PII in log messages
- [ ] No secrets or credentials in code or comments
- [ ] Input validation via Zod at all external boundaries
- [ ] Multi-tenant isolation — all queries are scoped to `organization_id`

**Nigerian Market Specifics**

- [ ] Monetary values are stored and returned in Nigerian Naira (₦) — column names end in `_naira`, JSON fields end in `Naira`
- [ ] Timestamps use `TIMESTAMPTZ` and the UI defaults to WAT (Africa/Lagos)
- [ ] Paystack is used for payment processing — no Stripe

**Documentation**

- [ ] Public service methods have JSDoc
- [ ] The relevant module spec is updated if the behavior changed
- [ ] Database migrations are reviewed and tested on staging
- [ ] ADR created if this is a significant architectural decision

### 8.4 The "Two Pairs of Eyes" Rule

The following changes require two separate reviewer approvals before merging:

| Change Category                           | Required Two Reviewers              | Rationale                   |
| ----------------------------------------- | ----------------------------------- | --------------------------- |
| Schema changes on PII-containing tables   | Engineering Lead + Compliance       | NDPR compliance             |
| Authentication or authorization changes   | Engineering Lead + Security Lead    | Privilege escalation risk   |
| RLS (Row-Level Security) policy changes   | Engineering Lead + Security Lead    | Multi-tenant isolation risk |
| Paystack billing integration changes      | Engineering Lead + Finance Lead     | Revenue integrity           |
| External-facing API breaking changes      | Engineering Lead + Product Lead     | Customer impact             |
| Data migration affecting existing records | Engineering Lead + Engineering peer | Data loss risk              |

---

## 9. Testing Standards

### 9.1 Coverage Targets

| Test Category                     | Coverage Target                                                    | Execution Frequency |
| --------------------------------- | ------------------------------------------------------------------ | ------------------- |
| Unit tests — services layer       | ≥ 85% line coverage                                                | Every PR            |
| Unit tests — lib utilities        | ≥ 90% line coverage                                                | Every PR            |
| Integration tests — API endpoints | ≥ 70% of endpoints covered                                         | Every PR            |
| E2E tests — web user journeys     | All critical journeys (onboarding, crisis, publishing, engagement) | Daily               |
| E2E tests — mobile                | Core journeys (login, monitoring, inbox)                           | Daily               |
| Accessibility tests (axe-core)    | 0 violations at WCAG 2.1 AA                                        | Every PR            |
| Security tests                    | All RBAC permission boundaries                                     | Weekly              |

### 9.2 The Negative Test Rule

**This rule is mandatory.** For every positive test ("user with role X can do Y"), there must be a corresponding negative test ("user with role Z cannot do Y").

This is especially critical for:

- RBAC permission boundaries (every role, every action)
- Multi-tenant isolation (user from Organization A cannot access Organization B's data)
- Rate limiting (exceeding limits returns 429)
- Input validation (invalid input returns 422 with specific error code)

```typescript
// ✅ Both directions tested
describe("MonitoringService.getArticle", () => {
  it("allows Manager role to read articles in their organization", async () => {
    const article = await monitoringService.getArticle({
      organizationId: org.id,
      articleId: article.id,
      userRole: "manager",
    });
    expect(article).toBeDefined();
  });

  it("denies Viewer role from reading crisis-only articles", async () => {
    await expect(
      monitoringService.getCrisisArticle({
        organizationId: org.id,
        articleId: crisisArticle.id,
        userRole: "viewer",
      }),
    ).rejects.toThrow(InsufficientPermissionError);
  });

  it("denies users from accessing articles of another organization", async () => {
    await expect(
      monitoringService.getArticle({
        organizationId: otherOrg.id, // Different org
        articleId: article.id, // Article belongs to org
        userRole: "admin",
      }),
    ).rejects.toThrow(ResourceAccessError);
  });
});
```

### 9.3 Test Organization

| Test Type               | Location                                                     | Technology                  |
| ----------------------- | ------------------------------------------------------------ | --------------------------- |
| Unit tests (services)   | Co-located: `services/monitoring/monitoring.service.test.ts` | Bun test                    |
| Unit tests (lib)        | Co-located: `lib/cache/cache.service.test.ts`                | Bun test                    |
| Integration tests (API) | `tests/integration/monitoring.test.ts`                       | Bun test + Hono test client |
| E2E tests (web)         | `tests/e2e/crisis-response.spec.ts`                          | Playwright                  |
| E2E tests (mobile)      | `tests/e2e/mobile/monitoring.yaml`                           | Maestro                     |
| Accessibility           | Run within Playwright tests                                  | axe-core Playwright plugin  |
| Visual regression       | Triggered by Chromatic on PRs                                | Storybook + Chromatic       |

### 9.4 Test Data and Fixtures

```typescript
// tests/fixtures/organizations.ts
export function createTestOrganization(
  overrides?: Partial<Organization>,
): Organization {
  return {
    id: generateId("org"),
    name: "Test Brand Nigeria",
    slug: "test-brand-nigeria",
    planTier: "professional",
    subscriptionStatus: "active",
    currency: "NGN",
    timezone: "Africa/Lagos",
    ...overrides,
  };
}

// tests/fixtures/billing.ts
export function createTestSubscription(orgId: string): Subscription {
  return {
    id: generateId("sub"),
    organizationId: orgId,
    planTier: "growth",
    billingCycle: "monthly",
    monthlyPriceNaira: 150000, // ₦150,000/month
    status: "active",
    // ...
  };
}
```

### 9.5 CI Test Configuration

```yaml
# .github/workflows/ci.yml (excerpt)
- name: Run tests
  run: bun test --coverage

- name: Check coverage thresholds
  run: |
    bun test --coverage --coverage-threshold='{"services": 85, "lib": 90}'

- name: Run integration tests
  run: bun test tests/integration --timeout 30000
  env:
    DATABASE_URL: postgresql://test:test@localhost:5432/nawebeus_test

- name: Run Playwright E2E
  run: bun x playwright test
  if: github.ref == 'refs/heads/main'
```

---

## 10. Database Migration Standards

### 10.1 Migration Rules

| Rule                         | Description                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **One migration per change** | Each logical schema change is a single migration file                                  |
| **Append-only**              | Migration files are never edited after being committed to the repository               |
| **Sequential numbering**     | `NNNN_description_of_change.sql` — sequential integer, never reuse or skip numbers     |
| **Drizzle generated**        | Always run `bun drizzle-kit generate`; never write migration SQL by hand               |
| **Nigerian context**         | Monetary column names must end in `_naira`; timezone defaults to `Africa/Lagos`        |
| **Backward-compatible**      | New code deployed before the migration runs; old code must work against the new schema |

### 10.2 Migration Workflow

```bash
# 1. Modify the Drizzle schema
vim db/schema/monitoring.ts

# 2. Generate the migration SQL
bun drizzle-kit generate

# 3. Review the generated SQL carefully
cat db/migrations/0043_add_ave_naira_to_articles.sql

# 4. Test on staging database
DATABASE_URL=$STAGING_DB_URL bun drizzle-kit migrate

# 5. Verify staging data and application behavior

# 6. Apply to production (low-traffic window: 2–4 AM WAT)
DATABASE_URL=$PRODUCTION_DB_URL bun drizzle-kit migrate

# 7. Verify production
# 8. Commit schema + migration + tests
git add db/schema/ db/migrations/
git commit -m "feat(db): add ave_naira column to articles table"
```

### 10.3 Dangerous Migration Classifications

| Migration Type                        | Risk Level   | Required Protocol                                               |
| ------------------------------------- | ------------ | --------------------------------------------------------------- |
| Add nullable column                   | 🟢 Safe      | Standard review                                                 |
| Add column with DEFAULT               | 🟢 Safe      | Standard review                                                 |
| Add index `CONCURRENTLY`              | 🟢 Safe      | Standard review                                                 |
| Add new table                         | 🟢 Safe      | Standard review                                                 |
| Add NOT NULL column (existing table)  | 🔴 Dangerous | Engineering Lead review + staging dry-run                       |
| Drop column                           | 🔴 Dangerous | Engineering Lead review + verify zero usage + staging dry-run   |
| Rename column                         | 🔴 Dangerous | Two-step: add new column + migrate data + remove old column     |
| Change column type                    | 🔴 Dangerous | Engineering Lead review + data migration plan + staging dry-run |
| Add unique constraint (existing data) | 🔴 Dangerous | Verify no duplicates on staging + Engineering Lead review       |
| Remove ENUM value                     | 🔴 Dangerous | Remove all usages first in separate deployment                  |
| Change RLS policy                     | 🔴 Dangerous | Engineering Lead + Security Lead review + isolation tests       |

**Protocol for 🔴 Dangerous migrations:**

1. Engineering Lead and one additional reviewer must approve
2. Migration tested on staging with production-scale anonymized data
3. Timing recorded on staging (must complete within 30 seconds to avoid production lock contention)
4. Documented rollback plan committed alongside the migration
5. Team notified in Slack #engineering minimum 1 hour before production
6. Migration applied during low-traffic window: 2:00–4:00 AM WAT
7. Application behavior verified in production before migrating backup label to "complete"

### 10.4 Backward-Compatible Migration Rules

| Change                  | Rule                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Add a new column        | Must be `NULLABLE` or have a `DEFAULT` — never NOT NULL without a default                      |
| Rename a column         | Create new column → backfill → deprecate old → remove in next release (never in one migration) |
| Remove a column         | Only after two deployments confirm zero code references                                        |
| Change column type      | Add new column → backfill → remove old (never in-place type change on active table)            |
| Add ENUM value          | Safe to add in same deployment as code that uses it                                            |
| Remove ENUM value       | Remove all code using it → deploy → then remove the ENUM value in next migration               |
| Add NOT NULL constraint | Only after verifying all existing rows have non-null values                                    |
| Add unique constraint   | Only after verifying no duplicates exist in production                                         |

---

## 11. API Design Standards

### 11.1 REST Conventions

| Rule          | Standard                                                                              | Example                                         |
| ------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| HTTP methods  | `GET` reads, `POST` creates, `PUT` replaces, `PATCH` partial update, `DELETE` removes | `GET /api/mentions`, `POST /api/press-releases` |
| URL structure | Plural nouns, kebab-case                                                              | `/api/media-mentions`, `/api/press-releases`    |
| Nesting       | Maximum 2 levels                                                                      | `/api/organizations/{id}/members`               |
| Query params  | camelCase                                                                             | `?sortBy=createdAt&filterBy=negative`           |

**HTTP Status Codes:**

| Scenario                   | Code                      |
| -------------------------- | ------------------------- |
| Successful read            | 200 OK                    |
| Resource created           | 201 Created               |
| Async accepted             | 202 Accepted              |
| No response body           | 204 No Content            |
| Validation failure         | 422 Unprocessable Entity  |
| No valid token             | 401 Unauthorized          |
| Valid token, no permission | 403 Forbidden             |
| Not found                  | 404 Not Found             |
| Duplicate / conflict       | 409 Conflict              |
| Rate limited               | 429 Too Many Requests     |
| Server error               | 500 Internal Server Error |
| Maintenance                | 503 Service Unavailable   |

### 11.2 Response Envelope Format

Every API response uses the same envelope:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-07-21T10:30:00.000Z",
    "requestId": "req_abc123def456"
  }
}

// Success with pagination
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJpZCI6Im1lbnRfN2UzYjJjIn0=",
    "hasMore": true,
    "totalCount": 247
  },
  "meta": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "CRISIS_INCIDENT_NOT_FOUND",
    "message": "The requested crisis incident does not exist or you do not have access.",
    "details": { "incidentId": "inc_4d5e6f" }
  },
  "meta": { ... }
}
```

### 11.3 Monetary Fields in API Responses

All monetary amounts are returned in Nigerian Naira (₦) with the `Naira` suffix on JSON field names:

```json
{
  "subscription": {
    "planTier": "growth",
    "billingCycle": "monthly",
    "monthlyPriceNaira": 150000,
    "annualPriceNaira": 1440000,
    "nextInvoiceAmountNaira": 150000,
    "currency": "NGN"
  },
  "latestInvoice": {
    "amountNaira": 150000,
    "taxNaira": 0,
    "totalNaira": 150000,
    "paidAt": "2026-07-01T00:00:00.000Z"
  }
}
```

### 11.4 Pagination

- **Algorithm:** Cursor-based (never offset-based)
- **Default page size:** 20 items
- **Maximum page size:** 100 items
- **Cursor format:** Opaque base64-encoded JSON string — clients must not parse or construct cursors

### 11.5 API Versioning

- Breaking changes require a new URL prefix: `/api/v2/`
- Previous version supported for minimum 6 months post-deprecation announcement
- Deprecated endpoints return: `Deprecation: true` and `Sunset: {RFC 7231 date}` response headers
- OpenAPI spec versioned alongside the API

---

## 12. Observability Standards

### 12.1 Structured Logging

All logs are structured JSON. **Never use `console.log`** — always use the structured logger from `lib/logger/logger.ts`.

**Required fields on every log entry:**

```json
{
  "level": "info",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "message": "Crisis alert generated",
  "requestId": "req_abc123def456",
  "userId": "usr_9f2a4b",
  "organizationId": "org_7e3b2c",
  "method": "POST",
  "path": "/api/crisis/alerts",
  "status": 201,
  "durationMs": 143
}
```

**Log Levels:**

| Level   | When to Use                                      | Examples                                                                |
| ------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `ERROR` | System failures that require immediate attention | Database connection failed, Paystack webhook signature invalid          |
| `WARN`  | Unexpected states that may need attention        | Rate limit exceeded, RLS policy violation attempt, slow query (>500ms)  |
| `INFO`  | Normal significant events                        | User login, post published, crisis alert triggered, ₦ invoice generated |
| `DEBUG` | Verbose detail for development debugging only    | Cache hit/miss, SQL query details                                       |

**What is NEVER logged (PII and secrets protection):**

```typescript
// ❌ Never log these
logger.info({ passwordHash }); // passwords
logger.info({ jwtToken }); // tokens
logger.info({ paystackSecretKey }); // API keys
logger.info({ userEmail }); // PII at INFO level in production
logger.info({ cardLast4 }); // payment details
logger.info({ ipAddress }); // PII at INFO level in production
```

### 12.2 Key Metrics to Monitor

| Category        | Metric                              | Alert Threshold               |
| --------------- | ----------------------------------- | ----------------------------- |
| API Performance | P95 response time                   | >500ms                        |
| API Performance | Error rate                          | >1% of requests               |
| Crisis          | Alert detection-to-delivery latency | >2 minutes                    |
| Database        | Query P95                           | >200ms                        |
| Database        | Connection pool utilization         | >80%                          |
| Cache           | Hit rate                            | <70%                          |
| Publishing      | Post failure rate                   | >0.5% of scheduled posts      |
| Billing         | Paystack webhook failures           | Any (0 tolerance)             |
| Infrastructure  | CPU utilization                     | >80% sustained for 10 minutes |
| Infrastructure  | Disk utilization                    | >80%                          |

### 12.3 Health Check Endpoint

```typescript
// server/api/health.ts
app.get("/health", async (c) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabaseHealth(),
      cache: await checkCacheHealth(),
      rateLimit: await checkRateLimitHealth(),
    },
  };

  const isHealthy = Object.values(health.checks).every(
    (check) => check.status === "healthy",
  );

  return c.json(health, isHealthy ? 200 : 503);
});
```

The health check endpoint:

- Returns 200 when all systems are healthy
- Returns 503 when any critical system is unhealthy
- Is used by Nginx health checks and uptime monitoring
- Is lightweight — never adds significant load to the checked systems

---

## 13. Security Practices

### 13.1 Secrets Management

| Rule                  | Implementation                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Never in code**     | All secrets are environment variables — never hardcoded                                                  |
| **Never in Git**      | `.env` is in `.gitignore`; the pre-commit hook scans staged files for secrets (using `detect-secrets`)   |
| **`.env.example`**    | Documents all required variables with placeholder values and comments explaining each                    |
| **Rotation schedule** | JWT signing secret: annually; Paystack API keys: annually or on compromise; database passwords: annually |
| **Never logged**      | Secrets are never logged, even at DEBUG level in development                                             |

### 13.2 Authentication and Authorization

| Rule                       | Implementation                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------- |
| **JWT storage (web)**      | `httpOnly` + `Secure` + `SameSite=Strict` cookies                                     |
| **JWT storage (mobile)**   | Expo SecureStore (OS-level hardware-backed encryption)                                |
| **Access token lifetime**  | 15 minutes                                                                            |
| **Refresh token lifetime** | 7 days (sliding window, rotating)                                                     |
| **Password hashing**       | bcrypt via `Bun.password` (cost factor 10)                                              |
| **RBAC enforcement**       | At API route (Hono middleware) AND service layer — never only one                     |
| **Multi-tenant isolation** | RLS at database + `organization_id` filter at application + required param at service |
| **MFA**                    | TOTP optional for all users; enforced for Owner and Admin roles                       |

### 13.3 Input Validation Rules

| Rule                 | Implementation                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| **All API inputs**   | Validated with Zod before reaching any service method                             |
| **SQL injection**    | Impossible — Drizzle uses parameterized queries exclusively                       |
| **File uploads**     | Validated for MIME type, file size, and (for images) content                      |
| **URL validation**   | `z.string().url()` on all URL fields                                              |
| **Organization ID**  | Validated that it starts with `org_` prefix and belongs to the authenticated user |
| **Monetary amounts** | `z.number().positive().multipleOf(0.01)` — no negative amounts, always ₦          |

### 13.4 Dependency Security

| Rule                                         | Schedule                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| `bun audit` — scan for known vulnerabilities | Weekly automated job + every PR                                |
| Trivy — container image scanning             | Every Docker build in CI                                       |
| Dependabot alerts                            | Monitor and respond within 48 hours for HIGH/CRITICAL          |
| Dependency updates                           | Monthly for minor/patch; deliberate for major versions         |
| New dependency review                        | Engineering Lead must approve before adding any new dependency |

---

## 14. Performance Practices

### 14.1 Caching Strategy

```typescript
// ✅ Correct — cache first, database fallback
export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const cacheKey = `org:settings:${organizationId}`;
  const cached = await cache.get<OrganizationSettings>(cacheKey);
  if (cached) return cached;

  const settings = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      /* ... */
    },
  });

  if (!settings) throw new ResourceNotFoundError("Organization not found");

  await cache.set(cacheKey, settings, 900, [`org:${organizationId}`]); // 15 min TTL
  return settings;
}

// ✅ Correct — invalidate on write
export async function updateOrganizationSettings(
  organizationId: string,
  data: UpdateOrganizationSettingsInput,
): Promise<void> {
  await db
    .update(organizations)
    .set(data)
    .where(eq(organizations.id, organizationId));

  // Invalidate the cached settings
  await cache.delete(`org:settings:${organizationId}`);
  // Or bulk invalidate by tag when multiple related keys need clearing:
  await cache.invalidateByTag(`org:${organizationId}`);
}
```

**Cache TTL Reference:**

| Data Type                | TTL            | Rationale                                             |
| ------------------------ | -------------- | ----------------------------------------------------- |
| User permissions (CASL)  | 300s (5 min)   | Balances security (quick revocation) with performance |
| Organization settings    | 900s (15 min)  | Infrequently changed                                  |
| Mention feed (paginated) | 120s (2 min)   | High-traffic, eventually consistent is acceptable     |
| Sentiment trends         | 600s (10 min)  | Expensive to compute, acceptable staleness            |
| Share of voice           | 1800s (30 min) | Very expensive to compute                             |
| Active crisis data       | 30s            | Time-critical — must be fresh                         |
| Subscription status      | 1800s (30 min) | Infrequently changed; Paystack webhooks invalidate    |
| API quota tracking       | 60s (1 min)    | Must be reasonably fresh for enforcement              |

### 14.2 Database Performance

| Rule                     | Implementation                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **No N+1 queries**       | Use Drizzle's relational query API with `with:` for eager loading                      |
| **Pagination always**    | Never `findMany()` without a `limit`; use cursor-based pagination                      |
| **Index monitoring**     | Review `pg_stat_user_indexes` monthly; remove unused indexes                           |
| **Slow query log**       | Log all queries taking >200ms at WARN level                                            |
| **Connection pooling**   | PgBouncer in transaction mode; max 10 database connections for the application process |
| **Read-heavy analytics** | Use materialized views for dashboard aggregations; refresh every 30 minutes            |

### 14.3 Frontend Performance

| Rule                   | Implementation                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Lazy loading**       | Dynamic imports for non-critical routes and heavy components (e.g., chart libraries)    |
| **Image optimization** | WebP format, responsive `srcset`, `loading="lazy"`, ImageKit via Bunny CDN              |
| **Bundle analysis**    | `bun build --analyze` run monthly; alert if any chunk exceeds 200KB gzipped             |
| **TanStack Query**     | Use `staleTime` and `gcTime` appropriately; prefetch on hover for navigation            |
| **Optimistic UI**      | Publishing and engagement responses show immediate feedback                             |
| **First-paint**        | SSR via TanStack Start ensures fast initial paint even on slow Nigerian mobile networks |

### 14.4 Mobile Performance

| Rule                           | Implementation                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| **Offline support**            | Crisis alerts cached locally; content drafts queued for upload                          |
| **Image compression**          | Compress images to max 2MB before upload via Expo ImagePicker                           |
| **SecureStore minimalism**     | Only JWT tokens in SecureStore; preferences in AsyncStorage                             |
| **Network awareness**          | Detect low-bandwidth and switch to text-only mode for mention feeds                     |
| **Push notification priority** | Crisis S3+ alerts use high-priority FCM/APNs; routine notifications use normal priority |

---

## 15. Incident Response

### 15.1 Incident Severity Levels

| Severity | Definition                                    | Response Time                      | Example                                                                               |
| -------- | --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| **P1**   | Complete service outage or critical data loss | Immediate — on-call engineer paged | API returning 500 for all requests; database unreachable                              |
| **P2**   | Critical feature broken or severely degraded  | < 1 hour                           | Crisis alerts not being delivered; Paystack webhooks failing; RLS policy not enforced |
| **P3**   | Non-critical feature broken or degraded       | < 4 business hours                 | Report generation slow; mention feed pagination incorrect                             |
| **P4**   | Minor issue or cosmetic problem               | < 1 business day                   | UI alignment issue; non-critical translation missing                                  |

### 15.2 Incident Response Workflow

```
1. Detection
   Alert fires (Grafana, Sentry, Uptime monitor) OR user reports issue
         │
         ▼
2. Triage
   On-call engineer assesses severity within 15 minutes of notification
         │
         ▼
3. Communication
   P1/P2: Post in Slack #incidents immediately
   Status page updated (even if just "Investigating")
         │
         ▼
4. Investigation
   Correlate logs by request_id, check Grafana dashboards,
   check Sentry for error volume
         │
         ▼
5. Mitigation
   Apply fastest fix to restore service (rollback, feature flag, hotfix)
   Nigerian business hours awareness: prioritize WAT morning peak (8–11 AM)
         │
         ▼
6. Resolution
   Service confirmed restored, status page updated
         │
         ▼
7. Post-Mortem (P1 and P2 only)
   Written within 48 hours of resolution
   Shared in #engineering and linked in incident ticket
```

### 15.3 Post-Mortem Format

Post-mortems are **blameless** — the goal is systemic improvement, not individual accountability.

```markdown
## Incident Post-Mortem: {Title}

**Date:** {Date (WAT)}
**Severity:** P{1/2}
**Duration:** {Start time WAT} — {End time WAT} ({duration})
**Impact:** {Number of organizations affected, which features, what data}

### Timeline (all times WAT)

- {HH:MM} — {Event}
- {HH:MM} — {Event}

### Root Cause

{Single paragraph describing the technical root cause}

### What Went Well

- {Item}

### What Went Poorly

- {Item}

### Action Items

| Action                 | Owner  | Due Date |
| ---------------------- | ------ | -------- |
| {Specific improvement} | {Name} | {Date}   |
```

---

## 16. Development Environment Setup

### 16.1 Prerequisites

| Tool                | Minimum Version | Installation                                                                     |
| ------------------- | --------------- | -------------------------------------------------------------------------------- |
| Bun                 | 1.0+            | `curl -fsSL https://bun.sh/install \| bash`                                      |
| Docker Desktop      | Latest          | [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop) |
| Git                 | 2.40+           | System package manager                                                           |
| VS Code             | Latest          | [code.visualstudio.com](https://code.visualstudio.com)                           |
| Insomnia or Postman | Latest          | API testing                                                                      |

### 16.2 Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/nawebeus/nawebeus.git
cd nawebeus

# 2. Install dependencies (Bun is fast — typically <30 seconds)
bun install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — see comments in .env.example for each variable

# 4. Start local services (PostgreSQL)
docker-compose up -d

# 5. Run database migrations
bun run db:migrate

# 6. Seed development data (Nigerian brands, WAT timezones, ₦ pricing)
bun run db:seed

# 7. Start development server
bun run dev

# 8. Verify setup
open http://localhost:3000
# API available at http://localhost:3000/api
# Health check: http://localhost:3000/health
```

### 16.3 Environment Variables Reference

```bash
# .env.example — copy to .env and fill in values

# ─── Application ───────────────────────────────
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# ─── Database (PostgreSQL) ──────────────────────
DATABASE_URL=postgresql://nawebeus:password@localhost:5432/nawebeus_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ─── JWT Authentication ─────────────────────────
JWT_SECRET=your-secret-here-minimum-32-characters
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ─── Cache (SQLite — MVP) ───────────────────────
CACHE_STORE=sqlite
CACHE_FILE_PATH=./data/cache.db

# ─── Rate Limiting (SQLite — MVP) ───────────────
RATE_LIMIT_STORE=sqlite
RATE_LIMIT_FILE_PATH=./data/ratelimit.db

# ─── Paystack (Nigerian ₦ payments) ─────────────
PAYSTACK_SECRET_KEY=[REDACTED]
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=your-webhook-secret

# ─── File Storage (Cloudflare R2) ───────────────
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=nawebeus-dev
R2_PUBLIC_URL=https://cdn.nawebeus.com

# ─── Email (Nodemailer / AWS SES) ───────────────
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@nawebeus.com

# ─── Nigerian Context ───────────────────────────
DEFAULT_TIMEZONE=Africa/Lagos
DEFAULT_CURRENCY=NGN
DEFAULT_LOCALE=en-NG

# ─── Observability ──────────────────────────────
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=debug  # debug in development, info in production
```

### 16.4 Recommended VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "drizzle-team.drizzle-vscode",
    "ms-azuretools.vscode-docker",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",
    "christian-kohler.path-intellisense",
    "aaron-bond.better-comments"
  ]
}
```

### 16.5 Available Development Scripts

```bash
# Development
bun run dev           # Start development server (TanStack Start + Hono)
bun run dev:api       # Start API only (Hono)
bun run build         # Production build
bun run start         # Start production server

# Database
bun run db:generate   # Generate migrations from schema changes
bun run db:migrate    # Apply pending migrations
bun run db:seed       # Seed development data (Nigerian brands, ₦ prices)
bun run db:studio     # Open Drizzle Studio (visual DB browser)
bun run db:reset      # Drop and recreate development database

# Testing
bun run test          # Unit tests
bun run test:watch    # Unit tests in watch mode
bun run test:coverage # Unit tests with coverage report
bun run test:int      # Integration tests
bun run test:e2e      # Playwright E2E tests
bun run test:all      # All tests

# Code Quality
bun run lint          # ESLint check
bun run lint:fix      # ESLint auto-fix
bun run format        # Prettier format
bun run format:check  # Prettier check (CI)
bun run typecheck     # TypeScript type check

# Security
bun run audit         # Dependency vulnerability scan
bun run audit:fix     # Auto-fix audit issues
```

---

## 17. Tools and Versions Reference

| Tool                     | Version | Purpose                                |
| ------------------------ | ------- | -------------------------------------- |
| **Bun**                  | 1.0+    | Runtime, package manager, test runner  |
| **TypeScript**           | 5+      | Language — strict mode throughout      |
| **TanStack Start**       | Latest  | Web framework (SSR + Server Functions) |
| **Hono**                 | Latest  | API framework (mobile + webhooks)      |
| **Drizzle ORM**          | Latest  | Database ORM                           |
| **Drizzle Kit**          | Latest  | Migration tool                         |
| **Zod**                  | Latest  | Runtime validation                     |
| **CASL**                 | Latest  | RBAC library                           |
| **TanStack Query**       | Latest  | Server state management                |
| **TanStack Form**        | Latest  | Form state management                  |
| **TanStack Table**       | Latest  | Data tables                            |
| **Zustand**              | Latest  | Client state management                |
| **Tailwind CSS**         | Latest  | Utility-first CSS                      |
| **shadcn/ui**            | Latest  | Accessible component primitives        |
| **Lucide Icons**         | Latest  | Icon library                           |
| **Recharts**             | Latest  | Chart components                       |
| **Prettier**             | Latest  | Code formatter                         |
| **ESLint**               | Latest  | Code linter                            |
| **Husky**                | Latest  | Git hooks                              |
| **lint-staged**          | Latest  | Pre-commit linting on staged files     |
| **React Native**         | 0.73+   | Mobile framework                       |
| **Expo SDK**             | 50+     | Mobile toolchain                       |
| **Playwright**           | Latest  | Web E2E testing                        |
| **Maestro**              | Latest  | Mobile E2E testing                     |
| **Chromatic**            | Latest  | Visual regression testing              |
| **Sentry**               | Latest  | Error tracking                         |
| **Prometheus + Grafana** | Latest  | Metrics and monitoring                 |
| **PostgreSQL**           | 14+     | Primary database                       |
| **Docker**               | Latest  | Local development services             |
| **GitHub Actions**       | —       | CI/CD pipeline                         |

---

## 18. Document Approvals

| Role             | Name                       | Signature      | Date       |
| ---------------- | -------------------------- | -------------- | ---------- |
| Engineering Lead | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Senior Engineers | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Security Lead    | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Product Lead     | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |

---

## 19. Related Documents

| Document                   | Relationship                                                     |
| -------------------------- | ---------------------------------------------------------------- |
| **Architecture**           | System design, service layer patterns, multi-tenant architecture |
| **Tech Stack**             | Technology choices that these standards assume                   |
| **ADRs**                   | Architectural decisions these standards implement                |
| **Database Schema**        | Schema conventions these standards enforce (₦, WAT, RLS)         |
| **Security Policy**        | Security controls these practices implement                      |
| **UX & Design System**     | Design standards enforced via accessibility testing              |
| **Module Specifications**  | Per-module contracts that these standards apply to               |
| **Infrastructure Runbook** | Deployment and operations procedures                             |

---

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
