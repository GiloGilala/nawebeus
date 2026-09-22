# Tech Stack

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document defines the complete technology stack for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS solution built for the Nigerian and African market. It serves as the authoritative quick-reference for all technology choices, with rationale, version policy, and alternatives considered for every decision.

This document complements the **Architecture** document (which explains the "why" and "how" of the system design) and the **ADRs** (which record specific architectural decisions with full context). When these documents appear to conflict, the ADRs take precedence.

**Stack Philosophy:**

| Principle | Description |
|-----------|-------------|
| **TypeScript end-to-end** | All code — web, API, services, mobile — is TypeScript. One language, one mental model. |
| **Bun-native first** | Technologies chosen for first-class Bun compatibility; Node.js compatibility is a secondary requirement |
| **Modern and proven** | Latest versions of technologies with demonstrated production maturity |
| **Performance-first** | Built to handle real-time monitoring, high-frequency publishing, and large-scale analytics from day one |
| **Operational simplicity** | Prefer fewer moving parts; a small team cannot operate a complex distributed system |
| **Nigerian market fit** | Technology choices reflect the realities of operating in Nigeria: data sovereignty, Naira-native payments, Nigerian media coverage, variable network conditions |
| **License compatible** | MIT, Apache 2.0, or BSD preferred; GPL requires legal review before use |
| **Developer experience** | Good tooling, excellent documentation, active maintainer communities |

---

## 2. Stack at a Glance

| Layer | Technology | Version | Status | ADR |
|-------|-----------|---------|--------|-----|
| **Runtime** | Bun | 1.0+ | ✅ Selected | ADR-001 |
| **Language** | TypeScript | 5.3+ | ✅ Selected | — |
| **Web Framework** | TanStack Start | Latest | ✅ Selected | ADR-002 |
| **API Framework** | Hono | Latest | ✅ Selected | ADR-002 |
| **Mobile Framework** | React Native + Expo | RN 0.73+ / Expo SDK 50+ | ✅ Selected | — |
| **UI Library** | React | 18+ | ✅ Selected | — |
| **Styling** | Tailwind CSS | Latest | ✅ Selected | — |
| **Component Library** | shadcn/ui | Latest | ✅ Selected | — |
| **Icons** | Lucide Icons | Latest | ✅ Selected | — |
| **State (Server)** | TanStack Query | Latest | ✅ Selected | — |
| **State (Client)** | Zustand | Latest | ✅ Selected | — |
| **Forms** | TanStack Form | Latest | ✅ Selected | — |
| **Validation** | Zod | Latest | ✅ Selected | — |
| **RBAC** | CASL | Latest | ✅ Selected | ADR-006 |
| **ORM** | Drizzle ORM | Latest | ✅ Selected | ADR-005 |
| **Primary Database** | PostgreSQL | 14+ | ✅ Selected | ADR-003 |
| **Cache (MVP)** | SQLite via bun:sql | 3+ | ✅ Selected | ADR-004 |
| **Cache (Year 2+)** | Redis | 7+ | 🗓 Planned | ADR-004 |
| **Rate Limiting** | SQLite via bun:sql | 3+ | ✅ Selected | ADR-004 |
| **Search (MVP)** | PostgreSQL tsvector | Built-in | ✅ Selected | — |
| **Search (Year 2+)** | Elasticsearch | 8+ | 🗓 Planned | — |
| **File Storage** | Cloudflare R2 + Bunny CDN | — | ✅ Selected | — |
| **Payments** | Paystack | Latest | ✅ Selected | ADR-007 |
| **Email** | Resend (HTTP API, no SDK) | API v1 | ✅ Selected | DEC-028 |
| **Realtime** | WebSockets (Hono native) | — | ✅ Selected | — |
| **Push Notifications** | Expo Notifications (FCM/APNs) | Latest | ✅ Selected | — |
| **Hosting** | Self-hosted VPS (Nigeria) + WireGuard | — | ✅ Selected | ADR-008 |
| **Deployment** | Coolify + Docker | Latest | ✅ Selected | — |
| **Reverse Proxy** | Nginx | Latest | ✅ Selected | — |
| **CDN / Security** | Cloudflare | — | ✅ Selected | — |
| **Testing (Unit)** | Bun test | Built-in | ✅ Selected | — |
| **Testing (E2E Web)** | Playwright | Latest | ✅ Selected | — |
| **Testing (E2E Mobile)** | Maestro | Latest | ✅ Selected | — |
| **Error Tracking** | Sentry | Latest | ✅ Selected | — |
| **Metrics** | Prometheus + Grafana | Latest | ✅ Selected | — |
| **Logging** | Structured JSON → Loki | Latest | ✅ Selected | — |
| **Product Analytics** | PostHog | Latest | 🔄 Evaluating | — |
| **CI/CD** | GitHub Actions | — | ✅ Selected | — |

---

## 3. Runtime and Language

### 3.1 Runtime: Bun

| Field | Details |
|-------|---------|
| **Decision** | Bun 1.0+ |
| **Status** | ✅ Selected |
| **ADR** | ADR-001 |
| **Version Policy** | Pin to major version; minor and patch updates applied weekly |

**Why Bun:**

| Reason | Detail |
|--------|--------|
| **Faster cold start** | 3–4× faster startup than Node.js; critical for deployment restarts and scaling events |
| **Native TypeScript execution** | No compilation step in development; faster iteration loop |
| **Built-in SQLite** | `bun:sql` provides native SQLite for cache and rate limiting — no separate service to deploy |
| **Built-in password hashing** | `Bun.password` (bcrypt) eliminates the `argon2` and `bcrypt` native module dependencies |
| **Built-in test runner** | Fast, Jest-compatible test runner built into the runtime — no Jest/Vitest dependency |
| **Built-in package manager** | Faster than npm/yarn/pnpm; lock file compatible with npm |
| **Node.js compatibility** | Runs 95%+ of Node.js packages; the ecosystem is available without rewriting |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Node.js 20+** | Slower cold start; no native TypeScript; no built-in SQLite or password hashing; more dependencies required for same functionality |
| **Deno** | Smaller package ecosystem; non-standard module resolution (URL imports); fewer production case studies at scale |

**Nigerian Market Relevance:** Bun's faster cold start reduces server restart downtime during VPS maintenance — important when operating with a single application instance in the Nigerian market during the pilot phase.

---

### 3.2 Language: TypeScript

| Field | Details |
|-------|---------|
| **Decision** | TypeScript 5.3+ |
| **Status** | ✅ Selected |
| **Version Policy** | Pin to major version (5+); update when TanStack Start and Bun certify compatibility |

**Why TypeScript:**

| Reason | Detail |
|--------|--------|
| **End-to-end type safety** | Types flow from the PostgreSQL schema (Drizzle) through the services layer to the React component — no runtime type surprises |
| **Catch errors at compile time** | Especially valuable for the multi-tenant data isolation logic where bugs have security implications |
| **Shared schemas** | Zod schemas defined once, shared across web, API, services, and mobile — one source of validation truth |
| **Superior developer experience** | IDE autocomplete, jump-to-definition, and refactoring across the full stack |
| **Ecosystem breadth** | Virtually every library in the Node.js ecosystem has TypeScript types |

**TypeScript Compiler Configuration:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**Strict mode is non-negotiable.** Disabling any strict flag requires an Engineering Lead approval and an ADR explaining why.

---

## 4. Frontend

### 4.1 Web Framework: TanStack Start

| Field | Details |
|-------|---------|
| **Decision** | TanStack Start (Latest) |
| **Status** | ✅ Selected |
| **ADR** | ADR-002 |
| **Version Policy** | Track latest; breaking changes managed via ADR and migration branch |

**Why TanStack Start:**

| Reason | Detail |
|--------|--------|
| **Full-stack React with SSR** | Server-side rendering for fast initial page loads; critical for dashboard performance on variable Nigerian mobile networks |
| **Server Functions (in-process)** | Web app calls services directly without an HTTP hop — faster, type-safe, no serialization overhead |
| **End-to-end type safety** | Types from the service method signature flow directly to the React component props without an API contract layer |
| **Single codebase, single deploy** | Web app and API (Hono) are one deployable service — operational simplicity for a small team |
| **File-based routing** | Predictable, convention-based routing reduces architectural decisions |
| **Streaming SSR** | Supports progressive rendering for data-heavy dashboards |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Next.js** | Mature and production-proven, but requires separate API routes for business logic — creates two places where logic can live. The Server Actions model is less fully-realized than TanStack Start's Server Functions for our services-layer pattern. |
| **Remix** | Good developer experience, but Server Functions are less developed; Remix's philosophy differs from our in-process service call pattern |
| **SvelteKit** | Different language (Svelte) — requires a split talent pool and cannot share code with mobile (React Native) |
| **Astro** | Excellent for content sites; not suited for complex SaaS dashboard interactions |

---

### 4.2 API Framework: Hono

| Field | Details |
|-------|---------|
| **Decision** | Hono (Latest) |
| **Status** | ✅ Selected |
| **ADR** | ADR-002 |
| **Version Policy** | Track latest |

**Why Hono:**

| Reason | Detail |
|--------|--------|
| **Lightweight and fast** | Minimal runtime overhead; benchmarks consistently at the top of Node.js HTTP framework performance comparisons |
| **TypeScript-first** | Excellent type inference for request/response; middleware types propagate correctly |
| **Mounted inside TanStack Start** | Hono serves at `/api/*` — both entry points live in one deployable Bun process |
| **Excellent middleware system** | JWT authentication, CORS, rate limiting, request logging all available as first-class middleware |
| **WebSocket support** | Built-in WebSocket handler for real-time features |
| **Edge-runtime compatible** | Future-proof if we ever need edge deployment |
| **Small API surface** | Easy to onboard new engineers; the full framework is understandable in an afternoon |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Express** | Mature but lacks TypeScript-first design; middleware types are weak; slower than Hono |
| **Fastify** | Faster than Express, but heavier than Hono and more opinionated about plugin architecture |
| **tRPC** | Excellent type safety but requires a tRPC-aware client; mobile clients and webhook senders cannot use tRPC |
| **Koa** | Minimal, but middleware ecosystem smaller than Hono's and less TypeScript-friendly |

---

### 4.3 Mobile: React Native + Expo

| Field | Details |
|-------|---------|
| **Decision** | React Native 0.73+ with Expo SDK 50+ |
| **Status** | ✅ Selected |
| **Version Policy** | Pin to Expo SDK major; upgrade with each SDK release |

**Why React Native + Expo:**

| Reason | Detail |
|--------|--------|
| **Cross-platform** | iOS and Android from a single TypeScript codebase |
| **Same language as web** | TypeScript engineers can contribute to mobile without context switching |
| **Shared type definitions** | `shared-types/` module shared between web, API, and mobile |
| **Expo Managed Workflow** | Eliminates the need for engineers to configure native Xcode/Android Studio environments for most features |
| **Expo Notifications** | First-class push notification support (FCM for Android, APNs for iOS) — critical for crisis alerts |
| **Expo SecureStore** | OS-level encrypted storage for JWT tokens |
| **Same state patterns** | TanStack Query and Zustand work identically on mobile and web |

**Key Mobile-Specific Libraries:**

| Library | Purpose |
|---------|---------|
| `expo-router` | File-based navigation for React Native |
| `expo-secure-store` | Encrypted JWT token storage |
| `expo-notifications` | Push notifications (crisis alerts, inbox notifications) |
| `expo-camera` | Camera access for asset uploads |
| `@tanstack/react-query` | Same server state management as web |
| `zustand` | Same client state management as web |
| `zod` | Same validation schemas as web and API |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Native iOS + Android** | Two separate codebases in two languages (Swift and Kotlin); requires double the mobile engineering resources |
| **Flutter** | Dart language — no code sharing with TypeScript web codebase; separate talent pool |
| **Ionic / Capacitor** | WebView-based rendering; poor performance for real-time dashboard views |
| **PWA only** | Insufficient for push notifications and OS-level secure token storage |

---

### 4.4 UI Components: Tailwind CSS + shadcn/ui + Lucide Icons

| Field | Details |
|-------|---------|
| **Decision** | Tailwind CSS (Latest) + shadcn/ui (Latest) + Lucide Icons (Latest) |
| **Status** | ✅ Selected |
| **Version Policy** | Track latest for all three |

**Why Tailwind CSS:**

| Reason | Detail |
|--------|--------|
| **Utility-first** | Design directly in markup; faster iteration without context-switching to CSS files |
| **Design system friendly** | Tailwind's token system maps directly to the Nawebeus design system (colors, spacing, typography) |
| **No dead CSS** | PurgeCSS in production removes unused styles — minimal CSS payload |
| **Excellent TypeScript support** | Via `tailwind-merge` and `clsx` for conditional class application |

**Why shadcn/ui:**

| Reason | Detail |
|--------|--------|
| **Copy-paste, not a dependency** | Components are copied into the codebase, not imported from a package — no vendor lock-in, full customization |
| **Radix UI primitives** | Built on Radix UI, which provides unstyled, accessible, keyboard-navigable component behavior |
| **WCAG 2.1 AA out of the box** | Accessibility requirements met without additional engineering work on standard components |
| **Consistent with design system** | Customizable to match Nawebeus brand colors and typography exactly |

**Why Lucide Icons:**

| Reason | Detail |
|--------|--------|
| **Consistent visual language** | All icons share the same 2px stroke weight and design language |
| **Open source** | MIT license; actively maintained |
| **React-native components** | `lucide-react` provides React components; no SVG string manipulation |
| **Comprehensive coverage** | 1,400+ icons cover all standard UI needs |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Material UI** | Opinionated design that fights customization; heavier bundle; Google's design language conflicts with Nawebeus's Nigerian-professional brand identity |
| **Chakra UI** | Good accessibility, but slower than Tailwind for iteration; smaller community than shadcn/ui now |
| **Ant Design** | Strong for enterprise dashboards but nearly impossible to customize; Chinese-market-first design language |
| **Mantine** | Good, but smaller community; less alignment with the design system's direction |
| **Heroicons** | Good quality but smaller library than Lucide; less active development |

---

### 4.5 State Management: TanStack Query + Zustand

| Field | Details |
|-------|---------|
| **Decision** | TanStack Query (Latest) for server state; Zustand (Latest) for client state |
| **Status** | ✅ Selected |
| **Version Policy** | Track latest for both |

**Why TanStack Query (Server State):**

| Reason | Detail |
|--------|--------|
| **Cache management** | Automatic stale-while-revalidate, background refetch, and cache invalidation |
| **Optimistic updates** | Essential for publishing and engagement workflows where UI must feel instant |
| **Prefetching** | SSR-level prefetching with TanStack Start integration for fast initial page loads |
| **Pagination and infinite scroll** | Built-in cursor-based pagination support for mention feeds and content calendars |
| **DevTools** | Excellent browser DevTools extension for cache inspection |

**Why Zustand (Client State):**

| Reason | Detail |
|--------|--------|
| **Minimal boilerplate** | No actions, reducers, or providers needed — store definition is a single function |
| **No Provider wrapping** | Avoids the React Context provider tree overhead |
| **TypeScript-first** | Type inference works correctly for complex store shapes |
| **Same API on mobile** | Identical usage on React Native and web |
| **Slices pattern** | Large stores can be split into slices for maintainability |

**State Ownership Model:**

| State Type | Tool | Examples |
|-----------|------|---------|
| Server data (fetched, cached) | TanStack Query | Mention feeds, content calendar, reports |
| UI state (ephemeral) | Zustand | Modal open/close, filter selections, sidebar collapsed |
| Form state | TanStack Form | All form inputs, validation, submission |
| URL state | TanStack Router | Pagination cursors, active filters, selected view |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Redux Toolkit** | Significant boilerplate for the same outcome; overkill for our client state complexity |
| **Recoil** | Atom-based model works well but community has shrunk; Meta's investment appears reduced |
| **Jotai** | Similar to Recoil; good technology but smaller community |
| **React Context** | Appropriate for low-frequency global state (theme, locale), not for complex interactive state |

---

### 4.6 Forms: TanStack Form

| Field | Details |
|-------|---------|
| **Decision** | TanStack Form (Latest) |
| **Status** | ✅ Selected |
| **Version Policy** | Track latest |

**Why TanStack Form:**

| Reason | Detail |
|--------|--------|
| **Zod integration** | Native Zod adapter for runtime validation — same schemas as the API boundary |
| **TypeScript-first** | Field type inference from the Zod schema; no `any` escape hatches |
| **Headless** | No imposed UI; form logic is decoupled from rendering |
| **Framework-agnostic core** | Same form logic runs on web (React) and mobile (React Native) |
| **TanStack ecosystem** | Consistent developer experience alongside TanStack Query and TanStack Start |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **React Hook Form** | More mature and battle-tested, but TypeScript inference is weaker (relies on `register()` with implicit string paths rather than explicit typed fields) |
| **Formik** | Older API design; less TypeScript-native; slower than TanStack Form |
| **Final Form** | Framework-agnostic but less TypeScript-aligned; smaller community |

---

### 4.7 Validation: Zod

| Field | Details |
|-------|---------|
| **Decision** | Zod (Latest) |
| **Status** | ✅ Selected |
| **Version Policy** | Track latest |

**Why Zod:**

| Reason | Detail |
|--------|--------|
| **Runtime validation** | Validates at every entry point boundary (API, Server Function, webhook) |
| **TypeScript type inference** | `z.infer<typeof schema>` generates TypeScript types from schemas — one source of truth for shape |
| **Shared schemas** | Same Zod schemas used in TanStack Form (web), Hono validators (API), and service method inputs |
| **Composable** | Complex schemas built from smaller reusable schemas |
| **Error messages** | Human-readable validation errors that map directly to form field errors |
| **Transform support** | Parse and transform (e.g., string → number, string → Date) in a single schema |

**Example Shared Schema Pattern:**
```typescript
// shared-types/schemas/post.schema.ts
export const CreatePostSchema = z.object({
  content: z.string().min(1).max(2200),
  platforms: z.array(z.enum(['twitter', 'instagram', 'facebook', 'linkedin'])).min(1),
  scheduledAt: z.coerce.date().optional(),
  organizationId: z.string().startsWith('org_'),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
// Used identically in TanStack Form (web), Hono route (API), publishing.service.ts (service)
```

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Yup** | Weaker TypeScript type inference; more verbose schema definition |
| **Joi** | Heavier; JavaScript-first design; weaker TypeScript integration |
| **Valibot** | Newer and smaller bundle size, but smaller community; fewer production case studies |
| **io-ts** | Functional programming approach; steeper learning curve; less ergonomic for the team |

---

## 5. Backend

### 5.1 ORM: Drizzle ORM

| Field | Details |
|-------|---------|
| **Decision** | Drizzle ORM (Latest) |
| **Status** | ✅ Selected |
| **ADR** | ADR-005 |
| **Version Policy** | Track latest |

**Why Drizzle ORM:**

| Reason | Detail |
|--------|--------|
| **TypeScript-first schema definition** | Schema is TypeScript code, not decorators or a DSL — schema types flow into query results automatically |
| **SQL-like query builder** | Drizzle queries read like SQL; easy for engineers who know SQL to understand and optimize |
| **Zero runtime overhead** | No hidden magic; Drizzle generates SQL, executes it, and returns typed results |
| **Native Bun compatibility** | Works out of the box with Bun's PostgreSQL driver |
| **Migration tooling** | `drizzle-kit` generates migrations from schema diffing; migrations are plain SQL — reviewable and understandable |
| **Relational query builder** | `db.query.posts.findMany({ with: { assets: true } })` — safe eager loading without N+1 queries |
| **No code generation** | Unlike Prisma, Drizzle does not require a code generation step; schemas are live TypeScript |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Prisma** | Market leader, but requires a `prisma generate` step (adds CI complexity); the Prisma binary is incompatible with some Bun deployment scenarios; Prisma's connection pooling approach differs from our PgBouncer strategy |
| **TypeORM** | Decorator-based schema definition; decorators are experimental in TypeScript; type inference is weaker than Drizzle |
| **Sequelize** | JavaScript-first; TypeScript support is a secondary concern; older API design |
| **Knex** | Query builder only — no schema definition, no type inference from schema; would require a separate migration tool |
| **Raw SQL** | Full control but no type safety from schema; too error-prone for multi-tenant data isolation queries |

---

### 5.2 Primary Database: PostgreSQL

| Field | Details |
|-------|---------|
| **Decision** | PostgreSQL 14+ |
| **Status** | ✅ Selected |
| **ADR** | ADR-003 |
| **Version Policy** | Pin to major version (14+); minor and patch updates applied with standard maintenance cycle |

**Why PostgreSQL:**

| Reason | Detail |
|--------|--------|
| **Relational integrity** | Foreign key constraints, check constraints, and NOT NULL enforcement prevent the data corruption that would undermine multi-tenant isolation |
| **Row-Level Security (RLS)** | Built-in RLS policies enforce organization-level data isolation at the database level — defense in depth beyond application-level filtering |
| **Full-text search** | `tsvector` and `GIN` indexing provide fast, accurate full-text search across media articles and social content — no Elasticsearch needed at MVP scale |
| **JSONB support** | `JSONB` columns for flexible configuration fields (campaign settings, report config, white-label settings) without sacrificing query performance |
| **ACID compliance** | Strong transactional guarantees for billing operations (₦ invoice generation, subscription state changes) where data loss is unacceptable |
| **Excellent query planner** | PostgreSQL's cost-based query planner produces efficient plans for the complex joins required in analytics queries |
| **Data sovereignty** | Self-hosted in Nigeria; data does not leave the country |
| **Tooling** | `psql`, `pgAdmin`, `pg_dump`, `pg_restore` — mature, well-understood operational tooling |

**PostgreSQL Extensions Used:**

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | UUID generation (for legacy compatibility; primary keys use prefixed text IDs) |
| `pg_trgm` | Trigram similarity for fuzzy search on journalist names and publication names |
| `unaccent` | Accent-insensitive search (important for Nigerian names with diacritical marks) |
| `btree_gin` | GIN index support for composite full-text and filter queries |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **MySQL / MariaDB** | Weaker full-text search; no Row-Level Security; less feature-rich for our analytical query patterns |
| **MongoDB** | Document model requires application-level join logic; weaker consistency guarantees; harder to enforce relational integrity for billing data |
| **SQLite** | Excellent for cache (we use it there), but write serialization makes it unsuitable for concurrent multi-tenant SaaS workloads |
| **CockroachDB** | Distributed by default, but we don't need horizontal write scaling yet; adds operational complexity we cannot justify at this stage |
| **Managed cloud (RDS, Cloud SQL, Supabase)** | Excellent services, but Nigerian data sovereignty requires on-premises or local VPS hosting; managed cloud providers do not have data centers in Nigeria |

---

### 5.3 Cache: SQLite (bun:sql) → Redis 7+ at Scale

| Field | Details |
|-------|---------|
| **Decision MVP** | SQLite 3+ via `bun:sql` |
| **Decision Year 2+** | Redis 7+ (when horizontal scaling requires distributed cache) |
| **Status** | ✅ Selected (SQLite for MVP); 🗓 Planned (Redis for Year 2+) |
| **ADR** | ADR-004 |

**Why SQLite for MVP Cache:**

| Reason | Detail |
|--------|--------|
| **No separate service** | SQLite runs in-process with the Bun application — zero operational overhead, no service to deploy, no connection management |
| **Sub-millisecond reads** | File-based storage with OS-level caching produces extremely fast reads for hot cache keys |
| **ACID-compliant** | Write-ahead logging (WAL mode) provides ACID guarantees even for cache operations |
| **Native Bun support** | `bun:sql` provides native, high-performance SQLite access without a native module compilation step |
| **Easy backup and restore** | SQLite is a single file — included in the daily server backup without special tooling |

**Redis Migration Trigger:** When the application runs on more than one VPS instance, the SQLite cache is no longer shared across instances. At that point, Redis 7+ is introduced as a distributed cache. The cache layer is abstracted behind a `cache.service.ts` interface — the migration requires changing the implementation, not the calling code.

**Cache Strategy:**

| Cache Key | TTL | Invalidation Trigger |
|-----------|-----|---------------------|
| `permissions:usr_{id}` | 5 minutes | User role change, permission override |
| `org:settings:{id}` | 15 minutes | Organization settings update |
| `mention:feed:{id}:{cursor}` | 2 minutes | New mention ingested |
| `sentiment:trend:{id}:{period}` | 10 minutes | New sentiment data processed |
| `sov:{id}:{period}` | 30 minutes | New competitive data processed |
| `report:data:{report_id}` | 5 minutes | Report configuration change |
| `crisis:active:{id}` | 30 seconds | Crisis status update |
| `user:profile:{id}` | 10 minutes | User profile update |
| `subscription:{org_id}` | 30 minutes | Paystack webhook received |

**Alternatives Considered for Cache:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Redis (at MVP)** | Adds an external service to operate and monitor; not justified when running a single application instance |
| **In-memory (Node.js Map)** | Lost on process restart; not shareable even with clustering; no TTL management |
| **PostgreSQL (pg_cache)** | Same database as primary data; cache misses would still hit PostgreSQL |
| **Memcached** | Simpler than Redis but no data structure richness; would still be an external service |

---

### 5.4 Rate Limiting: SQLite (bun:sql)

| Field | Details |
|-------|---------|
| **Decision** | SQLite 3+ via `bun:sql` (same instance as cache) |
| **Status** | ✅ Selected |
| **ADR** | ADR-004 |

**Implementation:** Sliding-window rate limiting via SQL atomic operations:

```sql
-- Sliding window: count requests in the last {window_seconds} seconds
SELECT COUNT(*) as request_count
FROM rate_limit_entries
WHERE key = ? AND created_at > UNIXEPOCH() - ?;

-- Atomic insert (rate limit not exceeded)
INSERT INTO rate_limit_entries (key, created_at) VALUES (?, UNIXEPOCH());

-- Cleanup expired entries (background job, every 5 minutes)
DELETE FROM rate_limit_entries WHERE created_at < UNIXEPOCH() - 3600;
```

**Default Rate Limits:**

| Endpoint Category | Per Minute | Per Hour | Algorithm |
|------------------|-----------|---------|-----------|
| Authentication (login, signup) | 5 per IP | 20 per IP | Sliding window |
| API reads | 100 per user | 2,000 per user | Sliding window |
| API writes | 50 per user | 500 per user | Sliding window |
| Content publishing | 30 per user | 200 per user | Sliding window |
| Report generation | 10 per user | 50 per user | Sliding window |
| Crisis operations | 200 per user | 2,000 per user | Sliding window (higher limit — time-critical) |
| Webhook endpoints | 1,000 per source | 10,000 per source | Sliding window |
| Public (unauthenticated) | 10 per IP | 100 per IP | Sliding window |

---

### 5.5 Search: PostgreSQL tsvector → Elasticsearch at Scale

| Field | Details |
|-------|---------|
| **Decision MVP** | PostgreSQL `tsvector` with `GIN` indexing |
| **Decision Year 2+** | Elasticsearch 8+ for advanced search and faceting |
| **Status** | ✅ Selected (PostgreSQL for MVP); 🗓 Planned (Elasticsearch for Year 2+) |

**Why PostgreSQL Full-Text Search for MVP:**

| Reason | Detail |
|--------|--------|
| **No separate service** | No Elasticsearch cluster to operate at MVP scale |
| **Sufficient for MVP** | `tsvector` with `GIN` index handles millions of rows with sub-second search |
| **Nigerian language support** | PostgreSQL's `unaccent` extension handles Nigerian names with diacritical marks |
| **Integrated filtering** | Full-text search and relational filtering in a single query |

**Elasticsearch Migration Trigger:** When media mention volume exceeds 50 million rows, or when users require complex boolean queries with faceted search, aggregations, and relevance tuning beyond what PostgreSQL can efficiently support.

---

### 5.6 File Storage: Cloudflare R2 + Bunny CDN

| Field | Details |
|-------|---------|
| **Decision** | Cloudflare R2 for object storage; Bunny CDN for delivery |
| **Status** | ✅ Selected |
| **Version Policy** | Managed services; no version pinning |

**Why Cloudflare R2:**

| Reason | Detail |
|--------|--------|
| **No egress fees** | R2 charges no egress fees for data served through Cloudflare's network — major cost advantage vs. S3 |
| **S3-compatible API** | Drop-in replacement for AWS S3; same SDK (`@aws-sdk/client-s3`) |
| **Signed URLs** | Pre-signed URLs for secure, time-limited direct access to assets |
| **Global redundancy** | Cloudflare's network ensures file availability globally |

**Why Bunny CDN:**

| Reason | Detail |
|--------|--------|
| **African PoPs** | Bunny CDN has Points of Presence in Johannesburg (SA) and is well-peered in Nigeria — better latency than US-only CDNs |
| **Cost-effective** | Significantly cheaper than Cloudflare's own CDN for high-volume media delivery |
| **Image optimization** | Built-in image resizing and WebP conversion via Bunny Optimizer |

**File Type and Storage Policy:**

| File Type | Storage Location | CDN Delivery | Retention |
|-----------|-----------------|--------------|-----------|
| Post images and videos | Cloudflare R2 | Bunny CDN | Until post deleted |
| Press release attachments | Cloudflare R2 | Signed URL only | 7 years (legal) |
| Report PDF exports | Cloudflare R2 | Signed URL only | 90 days |
| Brand asset library | Cloudflare R2 | Bunny CDN | Until asset deleted |
| Profile avatars | Cloudflare R2 | Bunny CDN | Until user deleted |
| Database backups | Cloudflare R2 (separate bucket) | Not served via CDN | 30 days |
| Audit log archives | Backblaze B2 (cold storage) | Not served | 7 years |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **AWS S3** | Egress fees are significant at scale; no African CDN edge; requires AWS account and IAM complexity |
| **Cloudinary** | Excellent media processing but significantly more expensive per transformation; overkill for our asset needs |
| **Self-hosted MinIO** | Adds operational overhead; no built-in CDN; durability depends entirely on our VPS infrastructure |
| **Backblaze B2** | Cost-effective but no CDN PoPs in Africa; higher latency for Nigerian users |

---

### 5.7 Payments: Paystack

| Field | Details |
|-------|---------|
| **Decision** | Paystack |
| **Status** | ✅ Selected |
| **ADR** | ADR-007 |
| **Version Policy** | Managed service; track API version |

**Why Paystack:**

| Reason | Detail |
|--------|--------|
| **Nigerian-first** | Founded in Nigeria; dominant payment processor in the Nigerian market |
| **₦-native** | All transactions in Nigerian Naira; no currency conversion complexity |
| **Subscription support** | Full subscription lifecycle: create, pause, resume, cancel, change plan |
| **Nigerian bank integration** | Direct debit from Nigerian bank accounts; card payments (Visa, Mastercard, Verve) |
| **USSD payments** | Supports USSD payment flow — critical for users on low-data connections |
| **Webhook reliability** | Comprehensive webhook events for subscription lifecycle management |
| **PCI DSS compliant** | We never handle raw card data — Paystack's SDK tokenizes on the client |
| **Proven at scale** | Processes billions of naira in transactions daily for Nigerian businesses |

**Paystack Integration Points:**

| Integration | Purpose |
|-------------|---------|
| Paystack Popup (inline) | Subscription checkout on the Nawebeus billing page |
| Paystack Subscriptions API | Create, pause, resume, cancel subscriptions |
| Paystack Webhooks | `charge.success`, `subscription.create`, `subscription.disable` events |
| Paystack Customer API | Create and manage customer records per organization |
| Paystack Plans API | Manage subscription plan tiers (Starter, Growth, Professional, Enterprise, Agency) |

**Subscription Tiers (₦ pricing):**

| Tier | Monthly (₦) | Annual (₦/month) | Target Persona |
|------|------------|------------------|----------------|
| Starter | ₦50,000 | ₦40,000 | Small brands, solo managers |
| Growth | ₦150,000 | ₦120,000 | Mid-market brands |
| Professional | ₦350,000 | ₦280,000 | Enterprise brands |
| Enterprise | Custom | Custom | Large enterprises |
| Agency | ₦500,000 | ₦400,000 | PR agencies (multi-client) |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Stripe** | Excellent DX but weak Nigerian bank integration; USD-primary with manual currency conversion; limited USSD support; not as trusted by Nigerian business buyers |
| **Flutterwave** | Strong Nigerian alternative but subscription management is less mature than Paystack's; developer experience is weaker |
| **Squad** | Growing Nigerian processor but smaller community and fewer integrations |
| **Manual invoicing** | Unscalable; no automated subscription lifecycle management |

---

### 5.8 Email: Resend

| Field | Details |
|-------|---------|
| **Decision** | Resend, called over its HTTP API from Bun's `fetch` — no SDK, behind the `EmailTransport` interface in `src/services/email/` |
| **Status** | ✅ Selected (DEC-028, approved 2026-01-25; implemented NWB-P1-004, 2026-09-22) |
| **Version Policy** | The REST API is unversioned in the path; the request shape this codebase sends is pinned by `src/tests/email.test.ts` |

> **Correction (2026-09-22).** Earlier revisions of this section specified Nodemailer over SMTP/SES.
> `Decision Log.md` DEC-028 and `Roadmap.md` §4.3 had already chosen Resend; the execution plan's
> D4 recorded this section as the defect. It now matches the decision and the code.

**Why Resend:**

| Reason | Detail |
|--------|--------|
| **One HTTP call** | `POST /emails` with a JSON body is the whole integration; there is no SMTP session, connection pool or TLS negotiation to operate on a single VPS |
| **Idempotent sends** | The `Idempotency-Key` header dedupes for 24 h, which is what makes an at-least-once outbox (pg-boss retries) safe — a retry after a dropped response cannot double-send |
| **No dependency** | Bun's `fetch` is enough; the `resend` package would wrap the same call and hide the request the tests want to pin |
| **Domain-verified sender** | Sending requires a verified domain with SPF/DKIM, which is the deliverability posture the NDPR notices and password resets need anyway |
| **Webhooks later** | Delivery, bounce and complaint events are available for the notification engine (P1-008) and a suppression list (P6) without changing the transport |

**How it is wired (NWB-P1-004):**

| Piece | Where | What it does |
|-------|-------|--------------|
| Transport | `src/services/email/resend.ts` | Builds the request, classifies failures (`EmailDeliveryError.retryable`: 429/5xx/timeout/network retry; other 4xx are final), 10 s timeout |
| Console transport | `src/services/email/console.ts` | Development and tests: prints the message; how a local verification link is read |
| Outbox | `src/services/email/service.ts` + `src/jobs/email-deliver.ts` | `emailService.send()` files an `email.deliver` job when the queue is up (6 backed-off retries ≈ 1 h, completed jobs deleted after 1 h because payloads carry token links); sends directly when there is no queue |
| Audit | `email.delivered` / `email.delivery_failed` | Every outcome, scoped to the tenant/user, recipient masked (`j***@example.com`) |
| Config | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `RESEND_API_BASE_URL`, `EMAIL_SEND_TIMEOUT_MS` | A key selects Resend; production refuses console-by-omission |
| Smoke test | `bun run email:smoke -- --to <addr>` | One real send, prints the provider id — the Phase 2 exit-gate evidence |

**Email Types:**

| Email Type | Template | Trigger |
|-----------|----------|---------|
| Email verification | inline HTML (`kind: verification`) | Signup, resend |
| Password reset | inline HTML (`kind: password_reset`) | Password reset request |
| Email-change confirmation | inline HTML (`kind: email_change`) | Change-email request |
| MFA enabled notice | inline HTML (`kind: mfa_enabled`) | TOTP enrolment confirmed |
| Team invitation | inline HTML (`kind: invitation`) | Invite team member action |
| Welcome email | `welcome.tsx` | Account activation (planned, P1-008) |
| Crisis alert | `crisis-alert.tsx` | S3+ crisis detected (planned) |
| Scheduled report | `report-delivery.tsx` | Scheduled report job (planned) |
| Subscription receipt | `invoice.tsx` | Paystack `charge.success` webhook (planned) |
| Subscription renewal reminder | `renewal-reminder.tsx` | 7 days before renewal (planned) |
| Weekly digest | `weekly-digest.tsx` | Scheduled job (Mondays 8 AM WAT) (planned) |

Templates (React Email or otherwise) are the notification engine's concern (P1-008); the transport
takes `html` + optional `text` and does not care how they were produced.

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Nodemailer + SMTP/SES** | An SMTP client and an AWS account to operate for one call a request path makes; no idempotency key, so outbox retries could double-send; DEC-028 had already chosen otherwise |
| **SendGrid** | Mature service but heavier API and per-email cost from day one |
| **Postmark** | Excellent deliverability but paid-only with no free tier; cost is material at low volume |
| **AWS SES directly** | Cheapest at volume, but the SDK, IAM and sandbox exit process are heavy for an MVP; revisit if volume makes Resend's pricing material |

---

## 6. Infrastructure

### 6.1 Hosting: Self-Hosted VPS in Nigeria + WireGuard VPN

| Field | Details |
|-------|---------|
| **Decision** | Self-hosted VPS in Nigeria, administered via WireGuard VPN |
| **Status** | ✅ Selected |
| **ADR** | ADR-008 |

**Why Self-Hosted VPS:**

| Reason | Detail |
|--------|--------|
| **NDPR compliance** | Nigerian Data Protection Regulation requires that Nigerian user data is processed within Nigeria; no major cloud provider (AWS, GCP, Azure) has a data center in Nigeria |
| **Full operational control** | Firewall rules, OS configuration, application deployment — nothing is abstracted away from us |
| **Cost predictability** | Fixed monthly VPS cost with no egress fees or per-request pricing surprises |
| **Security posture** | WireGuard VPN means the server's management ports are not exposed to the public internet |

**VPS Specifications by Phase:**

| Phase | vCPU | RAM | Storage | Bandwidth | Estimated Monthly Cost |
|-------|------|-----|---------|-----------|----------------------|
| Pilot (2026) | 4 | 8 GB | 200 GB SSD NVMe | 10 TB | ₦75,000 – ₦120,000 |
| Phase 2 (2027) | 8 | 16 GB | 500 GB SSD NVMe | 20 TB | ₦150,000 – ₦250,000 |
| Year 2 (2027-2028) | 16 | 32 GB | 1 TB SSD NVMe | 40 TB | ₦300,000 – ₦500,000 |

**Operating System:** Ubuntu 22.04 LTS (Jammy) — 5-year LTS support to 2027; extensive PostgreSQL and Nginx packaging

**Why WireGuard VPN:**

| Reason | Detail |
|--------|--------|
| **Minimal attack surface** | Only UDP port 51820 is exposed; SSH, PostgreSQL, and Grafana are accessible only through the VPN tunnel |
| **Public-key cryptography** | No passwords — only pre-authorized public keys can connect |
| **Performance** | WireGuard is the fastest VPN protocol available; negligible latency overhead for administrative operations |
| **Simplicity** | Configuration is 10 lines; auditable by anyone on the team |

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Vercel** | Excellent developer experience but data sovereignty is impossible (servers in US/EU); expensive at scale |
| **AWS ECS / EKS** | No Nigerian data center; complex; expensive; data sovereignty violation |
| **Google Cloud Run** | No Nigerian data center; vendor lock-in |
| **Heroku** | Expensive; limited to US/EU regions; data sovereignty violation |
| **DigitalOcean App Platform** | No Nigerian region; less flexible than raw VPS |
| **OpenVPN** | More complex configuration than WireGuard; larger attack surface |

---

### 6.2 Deployment: Coolify + Docker + Docker Compose

| Field | Details |
|-------|---------|
| **Decision** | Coolify (self-hosted PaaS) + Docker + Docker Compose |
| **Status** | ✅ Selected |
| **Version Policy** | Track Coolify releases; Docker Engine pinned to LTS |

**Why Coolify:**

| Reason | Detail |
|--------|--------|
| **Self-hosted PaaS** | Provides a Heroku/Vercel-like deployment experience on our own VPS |
| **Zero-downtime deployments** | Built-in blue-green deployment with health checks |
| **Rollback support** | One-click rollback to the previous deployment |
| **Environment management** | Secure environment variable management per service |
| **Open source** | MIT licensed; no vendor lock-in; can modify if needed |
| **Docker-native** | Works with any Dockerfile or Docker Compose configuration |

**Deployment Configuration:**

```
Application Container (Bun + TanStack Start + Hono)
  ├── Environment: PORT, DATABASE_URL, REDIS_URL, PAYSTACK_SECRET_KEY...
  ├── Health check: GET /api/health → 200 OK
  ├── Restart policy: always
  └── Network: internal (Nginx forwards to this)

PostgreSQL Container
  ├── Image: postgres:14-alpine
  ├── Volume: /data/postgres (persistent)
  └── Network: internal only (not exposed externally)

Nginx Container
  ├── Image: nginx:alpine
  ├── Config: reverse proxy to application; SSL termination
  ├── Ports: 80 (redirect to 443), 443
  └── Certs: Let's Encrypt via Certbot
```

**Why Docker Compose (MVP) vs. Kubernetes (Year 3):**

| Factor | Docker Compose (now) | Kubernetes (Year 3) |
|--------|---------------------|---------------------|
| Operational complexity | Low — 1 YAML file | High — multiple resources |
| Team overhead | Minimal | Requires DevOps specialization |
| Suitable for | 1–3 VPS instances | 4+ instances, microservices |
| Migration trigger | When horizontal scaling is needed | When Docker Compose cannot scale further |

---

### 6.3 Reverse Proxy: Nginx

| Field | Details |
|-------|---------|
| **Decision** | Nginx (Latest stable) |
| **Status** | ✅ Selected |

**Nginx Responsibilities:**

| Responsibility | Configuration |
|----------------|--------------|
| TLS termination | Let's Encrypt certificates via Certbot; auto-renewal |
| HTTPS redirect | HTTP 80 → HTTPS 443 (301) |
| Proxy to application | `proxy_pass http://app:3000` |
| Static file serving | Assets served directly from Nginx (bypasses application) |
| Gzip compression | All text responses compressed before transmission |
| Request logging | Access log in JSON format for Loki ingestion |
| Connection limiting | `limit_conn` to prevent connection flooding |
| Client max body size | `client_max_body_size 50m` for media upload endpoints |

---

### 6.4 CDN and Edge Security: Cloudflare

| Field | Details |
|-------|---------|
| **Decision** | Cloudflare (Free/Pro plan) |
| **Status** | ✅ Selected |

**Cloudflare Responsibilities:**

| Responsibility | Detail |
|----------------|--------|
| DDoS protection | Automatic Layer 3/4/7 DDoS mitigation |
| Web Application Firewall (WAF) | OWASP top 10 rule set; custom rules for Nigerian traffic patterns |
| DNS | Authoritative DNS with 1-click proxy toggle |
| Static asset caching | Cloudflare caches CSS, JS, images at edge |
| Bot management | Challenge suspicious bot traffic |
| SSL/TLS | Cloudflare's edge certificate in addition to our Let's Encrypt certificate |

---

### 6.5 Realtime: WebSockets

| Field | Details |
|-------|---------|
| **Decision** | Native WebSockets via Hono's WebSocket support |
| **Status** | ✅ Selected |

**Use Cases:**

| Feature | WebSocket Event |
|---------|----------------|
| Live crisis alert | `crisis:alert:{org_id}` — pushes crisis card to all connected users in the organization |
| Real-time mention feed | `mention:new:{org_id}` — pushes new mention to monitoring dashboard |
| Inbox new message | `inbox:message:{org_id}` — pushes new message to engagement inbox |
| Publishing status | `publish:status:{post_id}` — updates publishing success/failure in real time |
| Dashboard metric refresh | `metrics:update:{org_id}` — triggers dashboard KPI refresh |

**Connection Management:**

```
Client connects → JWT validated in WebSocket handshake
→ Client subscribed to org-scoped channel
→ Server sends events only for client's organization (multi-tenant isolation)
→ Client disconnects → subscription removed
```

**Alternatives Considered:**

| Alternative | Reason Rejected |
|-------------|----------------|
| **Server-Sent Events (SSE)** | One-way only; cannot send client events to server; WebSocket is bidirectional |
| **Long polling** | Legacy pattern; high server resource usage; significant latency vs. WebSockets |
| **Pusher / Ably** | Third-party services; additional cost; data passes through external servers (sovereignty concern) |
| **GraphQL Subscriptions** | Overkill for our event model; adds GraphQL dependency for one feature |

---

### 6.6 Push Notifications: Expo Notifications (FCM/APNs)

| Field | Details |
|-------|---------|
| **Decision** | Expo Notifications SDK with FCM (Android) and APNs (iOS) |
| **Status** | ✅ Selected |

**Push Notification Use Cases:**

| Trigger | Priority | Recipient |
|---------|----------|-----------|
| S3+ crisis alert detected | Critical | All Admin/Manager users in organization |
| S4/S5 crisis alert | Critical | All users in organization + emergency contacts |
| New high-priority inbox message | High | Assigned user |
| Scheduled post published | Normal | Creator of the post |
| Report delivered | Normal | Report creator and recipients |
| Team invitation accepted | Normal | Inviting user |

---

## 7. Testing

### 7.1 Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit (services, lib)** | Bun test | Fast, built-in, Jest-compatible syntax |
| **Integration (API endpoints)** | Bun test + Supertest | End-to-end API contract testing |
| **E2E (web)** | Playwright | Full browser user journey testing |
| **E2E (mobile)** | Maestro | Mobile app automation testing |
| **Coverage** | `bun test --coverage` | Line and branch coverage reporting |
| **Visual regression** | Chromatic | Storybook-based visual diff on every PR |
| **Accessibility** | axe-core (Playwright plugin) | WCAG 2.1 AA automated audit |
| **Load testing** | k6 | API performance under simulated load |
| **Security scanning** | Trivy (Docker image) | Container vulnerability scanning in CI |

### 7.2 Coverage Targets

| Test Category | Coverage Target | Execution Frequency |
|--------------|----------------|---------------------|
| Services layer (unit) | ≥ 85% line coverage | Every PR |
| Lib utilities (unit) | ≥ 90% line coverage | Every PR |
| API endpoints (integration) | ≥ 70% of endpoints covered | Every PR |
| User journeys (E2E web) | All critical journeys (onboarding, publishing, crisis) | Daily |
| E2E mobile | Core journeys (login, monitoring, inbox) | Daily |
| Accessibility (automated) | 0 axe-core violations at AA level | Every PR |

### 7.3 Test Environment

| Component | Test Configuration |
|-----------|-------------------|
| PostgreSQL | Separate test database; reset between test runs via `drizzle-kit push --force` |
| SQLite cache | In-memory mode; no persistence between tests |
| Paystack | Paystack test mode API keys; no real payments |
| Email | Console transport (or `spyOn(emailService, "send")`); the Resend transport is tested against an injected `fetch` and a local `Bun.serve` stub — no real sends |
| Cloudflare R2 | Mock S3 client (via `jest-mock-extended`); no real storage calls |

---

## 8. Observability

### 8.1 Observability Stack

| Pillar | Tool | Purpose |
|--------|------|---------|
| **Error tracking** | Sentry | Real-time error monitoring with source maps; performance monitoring |
| **Metrics** | Prometheus | Metrics collection from the application and infrastructure |
| **Dashboards** | Grafana | Prometheus metrics visualization and alerting |
| **Logging** | Structured JSON → Loki | Log aggregation; Grafana-integrated log search |
| **Product analytics** | PostHog (evaluating) | Feature adoption, funnel analysis, session recording |
| **Uptime monitoring** | Better Uptime / UptimeRobot | External uptime check from Nigeria and internationally |

### 8.2 Key Metrics to Monitor

| Category | Metric | Alert Threshold |
|----------|--------|----------------|
| **API Performance** | P95 response time | >500ms |
| **API Performance** | Error rate | >1% of requests |
| **Database** | Query P95 | >200ms |
| **Database** | Connection pool utilization | >80% |
| **Cache** | Hit rate | <70% |
| **Business** | Crisis alert delivery latency | >2 minutes |
| **Business** | Publishing failure rate | >0.5% |
| **Business** | Paystack webhook failures | Any failure (0 tolerance) |
| **Infrastructure** | CPU utilization | >80% for 10+ minutes |
| **Infrastructure** | Memory utilization | >85% |
| **Infrastructure** | Disk utilization | >80% |
| **Infrastructure** | VPS uptime | Any downtime >2 minutes |

### 8.3 Alerting

| Channel | Used For |
|---------|---------|
| **PagerDuty / On-call** | S3+ crisis alert failures, Paystack webhook failures, VPS downtime |
| **Slack #engineering-alerts** | Error rate spikes, P95 degradation, disk utilization warnings |
| **Email** | Daily digest of key metrics; weekly capacity report |
| **Grafana alerts** | Infrastructure threshold breaches |

---

## 9. Development Tools

### 9.1 Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | TypeScript linting + import boundary enforcement | `eslint.config.ts` with `import/no-restricted-paths` |
| **Prettier** | Consistent code formatting | `.prettierrc` enforced via pre-commit hook |
| **Husky** | Git hook management | Pre-commit: lint-staged; Pre-push: type check |
| **lint-staged** | Run linters only on staged files | ESLint + Prettier on changed files |
| **TypeScript** | Compile-time type checking | `tsc --noEmit` in CI on every PR |

### 9.2 CI/CD Pipeline: GitHub Actions

| Stage | Steps | Trigger |
|-------|-------|---------|
| **Validate** | TypeScript type check, ESLint, Prettier | Every push |
| **Test** | Unit tests, integration tests, coverage report | Every PR |
| **Build** | `bun build`, Docker image build | Every PR merge to main |
| **Security** | Trivy container scan, `bun audit` | Every PR merge to main |
| **Deploy: Staging** | Deploy to staging via Coolify API | Every merge to `main` |
| **Smoke Test** | E2E Playwright tests against staging | Post-staging deploy |
| **Deploy: Production** | Blue-green deploy to production | Manual approval after staging success |

### 9.3 Local Development Environment

| Tool | Purpose |
|------|---------|
| **Docker Compose** | Local PostgreSQL 14 and optional Redis |
| **VS Code** | Primary IDE; recommended extensions defined in `.vscode/extensions.json` |
| **Bun** | Local dev server: `bun dev`; test runner: `bun test` |
| **Drizzle Kit** | Schema push: `bun run db:push`; migration generation: `bun run db:generate` |
| **Insomnia / Postman** | API endpoint testing and exploration |
| **Storybook** | Component development and visual testing |
| **Chromatic** | Visual regression baseline on PRs |

### 9.4 VS Code Recommended Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "drizzle-team.drizzle-vscode",
    "ms-azuretools.vscode-docker",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

---

## 10. What We Explicitly Did Not Choose

This section documents rejected alternatives — as important as the choices made, especially for new engineers who wonder "why didn't we use X?"

| Layer | Rejected | Reason Rejected |
|-------|----------|----------------|
| Runtime | Node.js | Slower cold start; no native TypeScript execution; no built-in SQLite or password hashing |
| Runtime | Deno | Smaller ecosystem; non-standard module resolution; fewer production case studies |
| Web Framework | Next.js | Two stacks (web + API routes) creates two places for business logic to live; App Router complexity |
| Web Framework | Remix | Good, but Server Functions model less developed than TanStack Start for our in-process pattern |
| Web Framework | SvelteKit | Svelte language — cannot share code with React Native mobile |
| API Framework | Express | Less modern; weaker TypeScript types; slower than Hono |
| API Framework | Fastify | Heavier than Hono; more opinionated plugin architecture |
| API Framework | tRPC | Requires tRPC-aware client; webhooks and mobile cannot use tRPC without an adapter |
| Mobile | Flutter | Dart language — no TypeScript code sharing |
| Mobile | Ionic / Capacitor | WebView rendering; poor performance for real-time dashboards |
| ORM | Prisma | Requires code generation step; binary incompatibility with some Bun scenarios |
| ORM | TypeORM | Decorator-based schema; weaker type inference |
| ORM | Sequelize | JavaScript-first; older API design |
| ORM | Raw SQL | No type safety from schema |
| Primary DB | MySQL / MariaDB | No Row-Level Security; weaker full-text search |
| Primary DB | MongoDB | No relational integrity; application-level joins; weaker consistency |
| Primary DB | Managed cloud DB | No Nigerian data center; data sovereignty violation |
| Cache (MVP) | Redis | Adds external service to operate at MVP scale; not justified for single-instance deployment |
| Cache (MVP) | In-memory | No persistence; lost on restart; not shareable |
| UI Components | Material UI | Opinionated Google design language; heavy; hard to align with Nawebeus brand |
| UI Components | Ant Design | Near-impossible to customize; Chinese-market-first design |
| UI Components | Chakra UI | Good, but smaller community than shadcn/ui now |
| State | Redux Toolkit | Significant boilerplate for the same outcome |
| State | Recoil | Community has shrunk; Meta's investment appears reduced |
| Forms | React Hook Form | Weaker TypeScript type inference for our use case |
| Forms | Formik | Older API; more boilerplate |
| Validation | Yup | Weaker TypeScript inference |
| Validation | Valibot | Smaller community; fewer production case studies |
| RBAC | Custom implementation | Reinventing a solved problem; CASL is well-tested |
| RBAC | Permit.io | External service; data leaves our infrastructure |
| File Storage | AWS S3 | Egress fees; no African CDN edge natively |
| File Storage | Cloudinary | Significantly more expensive per transformation |
| File Storage | MinIO (self-hosted) | Operational overhead; no CDN benefits |
| Payments | Stripe | Not primary in Nigeria; USD-first with conversion complexity; limited USSD |
| Payments | Flutterwave | Subscription management less mature than Paystack |
| Email | Nodemailer (SMTP/SES) | An SMTP client to operate for one HTTP call's worth of integration; no idempotency key for outbox retries; superseded by DEC-028 (Resend) |
| Email | SendGrid | External dependency; per-email cost from day one |
| Email | Postmark | Paid-only; no free tier for development |
| Hosting | Vercel | Data sovereignty violation; expensive at scale |
| Hosting | AWS / GCP / Azure | No Nigerian data center; data sovereignty violation |
| Hosting | Heroku | Expensive; no Nigerian region |
| VPN | OpenVPN | More complex than WireGuard; larger attack surface |

---

## 11. Versioning Policy

| Technology | Version Policy | Notes |
|-----------|---------------|-------|
| **Bun** | Pin to major (1+) | Minor and patch updates applied weekly via Dependabot |
| **TypeScript** | Pin to major (5+) | Update when TanStack Start certifies compatibility |
| **PostgreSQL** | Pin to major (14+) | Minor updates applied with monthly maintenance window |
| **TanStack Start** | Track latest | Rapidly evolving; follow release notes closely |
| **Hono** | Track latest | Rapidly evolving |
| **Drizzle ORM** | Track latest | Rapidly evolving |
| **React / React Native** | Pin to Expo SDK version | Expo SDK determines compatible React Native version |
| **Expo SDK** | Pin to major | Upgrade with each SDK release (typically 3× per year) |
| **CASL** | Track latest | Stable API; safe to track |
| **Zod** | Track latest | Stable API |
| **shadcn/ui** | Track latest | Copy-paste components; updates applied manually per component |
| **Tailwind CSS** | Track latest | CSS only; no runtime |
| **Lucide Icons** | Track latest | Icon additions are non-breaking |
| **Sentry** | Track latest | Managed service |
| **Paystack SDK** | Pin to major | API stability important for payment flows |

**Version Update Process:**
- **Patch updates:** Applied automatically via Dependabot (weekly PRs)
- **Minor updates:** Applied after CI passes; Engineering Lead review for infrastructure packages
- **Major updates:** Require ADR documenting migration plan and rollback strategy

---

## 12. Adding a New Dependency

Before adding any new dependency, the contributing engineer must answer all of the following questions in the PR description:

| Question | What to Address |
|----------|----------------|
| **Is it necessary?** | Can we achieve the same result with an existing dependency? |
| **Is it maintained?** | Last commit within 90 days; issues responded to; maintainer active |
| **Is the license compatible?** | MIT, Apache 2.0, or BSD — always acceptable. GPL — requires legal review. AGPL — not permitted. |
| **Does it work with Bun?** | Test locally with `bun install` and `bun run`; check Bun compatibility tracker |
| **What is the bundle impact?** | For frontend dependencies: check bundle size via `bundlephobia.com`; add if <50KB gzipped |
| **What is the security posture?** | Run `bun audit`; check for known CVEs via `npm audit` and GitHub Advisory Database |
| **What is the community size?** | GitHub stars, weekly npm downloads, Stack Overflow questions |
| **What is the alternative?** | Why is this library better than existing tools in the stack? |

The Engineering Lead reviews and approves all new dependencies. Security-related dependencies (auth, encryption, payment) additionally require a security review from the Security Lead.

---

## 13. Migrating Off a Dependency

When a dependency becomes unmaintained, insecure, or otherwise problematic:

1. **Open an ADR** documenting: the problem, severity, proposed replacement, migration effort estimate
2. **Assess usage** — run `grep -r "import.*{dependency}" src/` to scope the migration
3. **Plan migration** — typically behind a feature flag or in a parallel implementation
4. **Execute in phases** — migrate module by module; maintain old and new simultaneously during transition
5. **Test exhaustively** — the migrated code must pass all existing tests; new tests added for edge cases
6. **Remove old dependency** — delete old code only when all call sites are migrated
7. **Update this document** — record the migration in the version history and the "Not Chosen" table

Migrations are tracked in the **Decision Log** and recorded as ADRs.

---

## 14. Onboarding Checklist for New Engineers

| Step | Resource | Notes |
|------|----------|-------|
| ✅ Read Architecture document | `docs/architecture.md` | Understand the system before touching code |
| ✅ Read all ADRs | `docs/adrs.md` | Understand why decisions were made |
| ✅ Read Engineering Standards | `docs/engineering-standards.md` | Coding conventions, review process |
| ✅ Read Database Schema | `docs/database.md` | Understand the data model |
| ✅ Read at least 3 module specs | `docs/modules/` | Choose monitoring, publishing, and engagement |
| ✅ Set up local dev environment | `README.md#local-setup` | Bun, Docker, VS Code extensions |
| ✅ Run test suite successfully | `bun test` | All tests should pass on a fresh clone |
| ✅ Deploy a sample change to staging | Via Coolify dashboard | Ask Engineering Lead for staging access |
| ✅ Shadow a senior engineer for Sprint 1 | — | Pair on a real feature PR |
| ✅ Lead a small PR with full code review | — | Any small feature, fix, or test improvement |

---

## 15. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| DevOps Lead | _________________ | _________ | _______ |
| Product Lead | _________________ | _________ | _______ |

---

## 16. Related Documents

| Document | Relationship |
|----------|-------------|
| **Architecture** | System design, service layer patterns, data layer design |
| **ADRs** | Full architectural decision records for each major technology choice |
| **Engineering Standards** | Coding conventions, testing requirements, code review process |
| **Database Schema** | Complete PostgreSQL schema with table definitions and migration history |
| **Security Policy** | Security controls, incident response, NDPR compliance procedures |
| **Infrastructure Runbook** | VPS setup, Nginx config, Coolify deployment, backup procedures |
| **API Reference** | OpenAPI specification for the Hono API layer |
| **UX & Design System** | Design tokens and component guidelines that frontend technology serves |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.1 | 2026-09-22 | Engineering Lead | §5.8 corrected from Nodemailer to Resend per DEC-028 / execution plan D4, with the NWB-P1-004 wiring (transport, outbox, audit, config, smoke test); summary table, test-environment table and "not chosen" table updated to match. |
| 1.0.0 | 2026-07-21 | Engineering Lead | Unified and expanded Tech Stack document. Merges and improves both source documents into a single authoritative reference. Adds: Nigerian market fit rationale for every major technology choice, Paystack subscription tier pricing in ₦, Bun-native rationale table, complete SQLite cache key design with TTLs, Nodemailer SMTP backend strategy with ₦ cost estimates, file storage policy table by file type, WebSocket event naming conventions, comprehensive observability stack with alert thresholds, VS Code extension recommendations, complete "what we did not choose" table with detailed rejection reasons, dependency addition checklist, and dependency migration process. |

---

*This document is owned by the Engineering Lead and reviewed quarterly, or immediately following any significant technology change. All decisions to add, remove, or replace a dependency in the tech stack must be recorded in an ADR and reflected in an update to this document.*