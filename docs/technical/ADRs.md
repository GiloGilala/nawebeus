# Architectural Decision Records (ADRs)

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead

---

## 1. Executive Summary

This document contains the Architectural Decision Records (ADRs) for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS solution built for the Nigerian and African market. ADRs document the context, rationale, alternatives considered, and consequences of every significant architectural decision. They serve as the institutional memory for _why_ the architecture is the way it is, and prevent the same decisions from being relitigated as the team grows.

# code-style

- Use arrow functions exclusively (never function declarations).

**Why ADRs Matter:**

| Benefit                    | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| **Institutional memory**   | New engineers understand why decisions were made, not just what was decided |
| **Prevents re-litigation** | Documented context stops repeated debate on settled questions               |
| **Accountability**         | Decisions are attributed and dated; consequences can be evaluated over time |
| **Evolution path**         | Deprecated and superseded ADRs show how thinking has evolved                |
| **Onboarding accelerator** | New team members read ADRs before touching code                             |

**Current ADRs:** 18 documented decisions covering runtime, framework, database, caching, RBAC, deployment, security, payments, real-time architecture, API design, error handling, domain modelling, background job runtime, and Nigerian market-specific decisions.

---

## 2. ADR Index

| ADR                                                                   | Title                                              | Status      | Date       | Deciders                                          |
| --------------------------------------------------------------------- | -------------------------------------------------- | ----------- | ---------- | ------------------------------------------------- |
| [ADR-001](#adr-001-bun-as-the-runtime)                                | Bun as the Runtime                                 | ✅ Accepted | 2026-06-15 | Engineering Lead, CTO                             |
| [ADR-002](#adr-002-tanstack-start--hono-as-the-web-and-api-framework) | TanStack Start + Hono as the Web and API Framework | ✅ Accepted | 2026-06-16 | Engineering Lead, CTO, Product Lead               |
| [ADR-003](#adr-003-postgresql-as-the-primary-database)                | PostgreSQL as the Primary Database                 | ✅ Accepted | 2026-06-17 | Engineering Lead, CTO, DevOps Lead                |
| [ADR-004](#adr-004-sqlite-for-cache-and-rate-limiting-mvp)            | SQLite for Cache and Rate Limiting (MVP)           | ✅ Accepted | 2026-06-18 | Engineering Lead, DevOps Lead                     |
| [ADR-005](#adr-005-drizzle-orm-as-the-database-orm)                   | Drizzle ORM as the Database ORM                    | ✅ Accepted | 2026-06-19 | Engineering Lead, Senior Engineers                |
| [ADR-006](#adr-006-casl-as-the-rbac-library)                          | CASL as the RBAC Library                           | ✅ Accepted | 2026-06-20 | Engineering Lead, Product Lead                    |
| [ADR-007](#adr-007-single-deployable-service-with-two-entry-points)   | Single Deployable Service with Two Entry Points    | ✅ Accepted | 2026-06-21 | Engineering Lead, CTO                             |
| [ADR-008](#adr-008-self-hosted-vps-in-nigeria-behind-wireguard-vpn)   | Self-Hosted VPS in Nigeria Behind WireGuard VPN    | ✅ Accepted | 2026-06-22 | Engineering Lead, CTO, Security Lead, DevOps Lead |
| [ADR-009](#adr-009-multi-tenant-architecture-with-row-level-security) | Multi-Tenant Architecture with Row-Level Security  | ✅ Accepted | 2026-06-23 | Engineering Lead, CTO, Security Lead              |
| [ADR-010](#adr-010-jwt-based-authentication-with-http-only-cookies)   | JWT-Based Authentication with HTTP-Only Cookies    | ✅ Accepted | 2026-06-24 | Engineering Lead, Security Lead                   |
| [ADR-011](#adr-011-paystack-as-the-payment-processor)                 | Paystack as the Payment Processor                  | ✅ Accepted | 2026-06-25 | Engineering Lead, Finance Lead, Product Lead      |
| [ADR-012](#adr-012-blue-green-deployment-strategy)                    | Blue-Green Deployment Strategy                     | ✅ Accepted | 2026-06-26 | Engineering Lead, DevOps Lead                     |
| [ADR-013](#adr-013-websockets-for-real-time-features)                 | WebSockets for Real-Time Features                  | ✅ Accepted | 2026-06-27 | Engineering Lead, Senior Engineers                |
| [ADR-014](#adr-014-restful-api-design-standards)                      | RESTful API Design Standards                       | ✅ Accepted | 2026-06-28 | Engineering Lead, Product Lead                    |
| [ADR-015](#adr-015-cache-and-rate-limit-patterns)                     | Cache and Rate Limit Patterns                      | ✅ Accepted | 2026-06-29 | Engineering Lead                                  |
| [ADR-016](#adr-016-typed-error-hierarchy-and-handling-patterns)       | Typed Error Hierarchy and Handling Patterns        | ✅ Accepted | 2026-06-30 | Engineering Lead, Senior Engineers                |
| [ADR-017](#adr-017-domain-disambiguation-of-campaign)                  | Domain Disambiguation of "Campaign"                | ✅ Accepted | 2026-08-02 | Engineering Lead, Product Lead                     |
| [ADR-028](#22-adr-028-queue-scheduler-and-worker-runtime)             | Queue, Scheduler, and Worker Runtime               | ✅ Accepted | 2026-09-13 | Engineering Lead                                  |

> **Numbering note:** ADR-018 … ADR-027 are reserved by the planned-ADR table in §23.
> New accepted ADRs therefore continue from ADR-028 until those slots are filled.

---

## 3. ADR Template

Every ADR in this document follows this standard format:

```
## ADR-XXX: Decision Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Deciders:** [Roles of people who made or ratified this decision]
**Last Reviewed:** YYYY-MM-DD

### Context
What is the situation that required a decision? What constraints applied?
What were the key requirements?

### Decision
What was decided, stated precisely and unambiguously?

### Rationale
Why was this decision made? What evidence or reasoning supports it?

### Alternatives Considered
What other options were evaluated? Why was each rejected?

### Consequences
What are the positive and negative consequences of this decision?
What risks does it introduce and how are they mitigated?

### Review Triggers
Under what circumstances should this ADR be reconsidered?

### Related ADRs
Links to ADRs that are related to or influenced by this decision.
```

---

## 4. Architecture Principles (ADR-000)

Before the specific decisions, this foundational ADR documents the principles that govern all other decisions.

**Status:** ✅ Accepted
**Date:** 2026-06-10
**Deciders:** Engineering Lead, CTO

### Principles

| #   | Principle                    | Description                                                                                         | Enforcement                                                               |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **Single Source of Truth**   | All business logic resides exclusively in the services layer                                        | ESLint import boundary rules; code review                                 |
| 2   | **Thin Entry Points**        | Web and API layers handle only validation, authentication, and response shaping — no business logic | Code review; architecture tests                                           |
| 3   | **Direct Calls**             | The web app calls services directly in-process (no HTTP hop for in-app operations)                  | TanStack Start Server Functions                                           |
| 4   | **No Reverse Dependencies**  | Services never import from web, API, or mobile layers                                               | ESLint `import/no-restricted-paths` — CI enforced                         |
| 5   | **Cache First**              | Check the cache before any database query                                                           | Code review; cache service abstraction                                    |
| 6   | **Rate Limit First**         | Enforce rate limits before any processing                                                           | Hono middleware; integration tests                                        |
| 7   | **Observability by Default** | All operations logged, traced, and monitored                                                        | Structured logger; audit log service                                      |
| 8   | **Least Privilege**          | Users have the minimum permissions needed for their role                                            | CASL ability definitions; permission tests                                |
| 9   | **Data Sovereignty**         | Nigerian user data is processed and stored within Nigeria                                           | VPS hosted in Nigeria; no third-party data processors without NDPR review |
| 10  | **Security by Design**       | Security controls are built in, not bolted on                                                       | Defense in depth: RLS + application RBAC + audit logging                  |

---

## 5. ADR-001: Bun as the Runtime

**Status:** ✅ Accepted
**Date:** 2026-06-15
**Deciders:** Engineering Lead, CTO
**Last Reviewed:** 2026-07-21

### Context

The platform requires a server-side JavaScript runtime. The runtime is the foundation for all server-side code: the web framework, API layer, services, database access, and background jobs. The choice impacts development velocity, cold start performance, operational complexity, and ecosystem compatibility.

**Key requirements:**

- Native TypeScript execution (no compilation step for development)
- Fast process startup (important for deployment restarts)
- Strong Node.js package ecosystem compatibility
- Production-ready stability
- Built-in utilities to reduce dependency count

### Decision

Use **Bun 1.0+** as the runtime for all server-side code (web app, API, services, background jobs).

### Rationale

| Reason                          | Detail                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Faster cold start**           | Bun starts 3–4× faster than Node.js; critical for deployment restarts and for scaling events when new instances must come online quickly               |
| **Native TypeScript execution** | Bun runs `.ts` files directly with no compilation step; eliminates `ts-node`, `tsx`, or `esbuild` as development dependencies                          |
| **Built-in SQLite**             | `bun:sql` provides native, high-performance SQLite access — the entire MVP caching and rate-limiting strategy depends on this                          |
| **Built-in password hashing**   | `Bun.password` provides bcrypt and Argon2id natively — eliminates the `argon2` and `bcrypt` native modules which have historically had compilation issues on different platforms |
| **Built-in test runner**        | Fast, Jest-compatible test syntax — eliminates Jest or Vitest as dependencies                                                                          |
| **Built-in package manager**    | Faster dependency installation than npm/yarn; lock file is npm-compatible                                                                              |
| **Node.js compatibility**       | Bun supports 95%+ of the Node.js API surface; the ecosystem is available without rewriting existing packages                                           |
| **Active development**          | The Bun team ships releases regularly; production stability has improved significantly since 1.0                                                       |

### Alternatives Considered

| Alternative           | Why Rejected                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js 20+ (LTS)** | Slower cold start (important for deployment restarts); requires `ts-node` or compilation for TypeScript; no built-in SQLite or password hashing; requires more runtime dependencies for equivalent functionality |
| **Deno**              | Smaller package ecosystem; non-standard URL-based module resolution; fewer large-scale production case studies; team would need to learn Deno-specific APIs and permissions model                                |

### Consequences

**Positive:**

- Faster iteration loop in development (no compile step)
- Reduced dependency count (built-in utilities replace several packages)
- Faster deployment restarts
- Simplified caching and rate limiting (native SQLite)

**Negative:**

- Bun is younger than Node.js (less production history at massive scale)
- Some npm packages with native C++ bindings may not work correctly
- Team must learn Bun-specific APIs (`bun:sql`, `Bun.password`, `Bun.cron`)
- Debugging tooling is less mature than Node.js

**Risk Mitigation:**

- Maintain a list of Bun compatibility exceptions; use Node.js-compatible fallbacks where needed
- Test all critical dependencies on Bun in CI before adding them to the codebase
- If a critical dependency fails on Bun, we can add a lightweight compatibility shim or replace it

### Review Triggers

- A critical dependency is discovered that is incompatible with Bun and has no viable replacement
- Bun development slows significantly or the project is abandoned
- Node.js adds native TypeScript execution and built-in SQLite, eliminating Bun's key advantages

### Related ADRs

- ADR-004: SQLite for Cache and Rate Limiting (directly enabled by Bun's `bun:sql`)

---

## 6. ADR-002: TanStack Start + Hono as the Web and API Framework

**Status:** ✅ Accepted
**Date:** 2026-06-16
**Deciders:** Engineering Lead, CTO, Product Lead
**Last Reviewed:** 2026-07-21

### Context

The platform needs:

1. A web framework for server-side rendering and serving the browser-based web app
2. A mechanism for the web app to perform mutations and load data (Server Functions or equivalent)
3. An HTTP API framework for the mobile app, webhook handlers, and future third-party integrations

**Key requirements:**

- TypeScript-first with end-to-end type safety
- Server-side rendering for fast initial page loads
- Server Functions that call business logic in-process (no HTTP hop)
- Clean HTTP API for mobile and webhooks
- A single deployable service (not two separate processes)
- Compatible with Bun runtime

### Decision

Use **TanStack Start** as the web framework and **Hono** as the API framework, with Hono mounted inside the TanStack Start server at `/api/*`. Both run in the same Bun process as a single deployable service.

### Rationale

**Why TanStack Start:**

| Reason                          | Detail                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **In-process Server Functions** | Server Functions call the services layer directly — no HTTP hop, no serialization overhead, no type boundary to cross                         |
| **End-to-end type safety**      | TypeScript types from the Drizzle schema flow through the service method, through the Server Function, and into the React component — no gaps |
| **SSR for performance**         | Server-side rendering is critical for dashboard performance on variable Nigerian mobile networks                                              |
| **File-based routing**          | Convention-based routing reduces architectural decisions and onboarding time                                                                  |
| **Single codebase**             | Web app and API in one repository, one deployment, one `bun dev` command                                                                      |

**Why Hono:**

| Reason                | Detail                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| **Lightweight**       | Hono adds minimal overhead; it is purpose-built for performance in TypeScript    |
| **TypeScript-first**  | Request and response types propagate correctly through middleware chains         |
| **WebSocket support** | Built-in WebSocket handler for real-time crisis alerts and monitoring updates    |
| **Edge-compatible**   | Future-proof if we ever need Cloudflare Workers deployment                       |
| **Small API surface** | The full framework is understandable in a few hours — important for a small team |

### Alternatives Considered

| Alternative               | Why Rejected                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js + Express**     | Two separate stacks create two places where business logic can live; duplicated validation and RBAC; two deployments to manage; App Router + Route Handlers are less ergonomic than TanStack Start Server Functions for our pattern |
| **Next.js + tRPC**        | tRPC improves type safety for Next.js but requires a tRPC-aware client — webhook senders and mobile HTTP clients cannot use tRPC without an adapter layer                                                                           |
| **Remix + Hono**          | Remix has excellent data loading primitives, but its Server Functions model is less developed for our in-process service call pattern                                                                                               |
| **SvelteKit**             | Svelte is a different language — no code sharing with React Native mobile; the team would need to maintain two mental models                                                                                                        |
| **NestJS + React (Vite)** | NestJS is excellent for large API teams, but it is heavyweight and opinionated; two separate processes; no SSR without additional setup                                                                                             |

### Consequences

**Positive:**

- Business logic is in exactly one place (services layer)
- Type safety from database to browser component
- Single process, single deployment, simple operations
- No latency between "web" and "API" calls (in-process)
- Mobile app and web app use identical business logic

**Negative:**

- TanStack Start is newer and evolving rapidly — breaking changes require active tracking
- Less community knowledge compared to Next.js — fewer Stack Overflow answers
- Web app and API cannot be scaled independently
- If TanStack Start is abandoned, migration is significant

**Risk Mitigation:**

- Maintain close tracking of TanStack Start release notes
- Contribute to TanStack Start community and report issues early
- The services layer is framework-agnostic — if TanStack Start must be replaced, services survive unchanged; only the Server Functions layer requires rewriting

### Review Triggers

- TanStack Start development velocity drops significantly
- A critical limitation is discovered that prevents a required feature
- The team reaches a scale where independent scaling of web and API becomes necessary

### Related ADRs

- ADR-007: Single Deployable Service with Two Entry Points
- ADR-001: Bun as the Runtime

---

## 7. ADR-003: PostgreSQL as the Primary Database

**Status:** ✅ Accepted
**Date:** 2026-06-17
**Deciders:** Engineering Lead, CTO, DevOps Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires a primary relational database for all persistent business data: user accounts, organizations, media mentions, social posts, conversations, analytics, press releases, journalist CRM records, billing records, and audit logs.

**Key requirements:**

- ACID compliance (especially for billing data denominated in ₦)
- Strong relational integrity (multi-tenant isolation depends on foreign key constraints)
- Full-text search (for media mention and content search)
- JSON support (for flexible configuration data)
- Row-Level Security (for multi-tenant data isolation at the database layer)
- Self-hostable in Nigeria for NDPR compliance
- Mature tooling (backup, restore, monitoring)

### Decision

Use **PostgreSQL 14+**, self-hosted on the Nigerian VPS, as the primary database for all persistent relational data.

### Rationale

| Reason                      | Detail                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Row-Level Security**      | PostgreSQL's RLS policies enforce organization-level data isolation at the database level — even if application code has a bug, RLS prevents cross-tenant data leakage |
| **ACID compliance**         | Essential for billing records (₦ invoices, subscription state changes); a partial transaction cannot leave a customer charged without an active subscription           |
| **Full-text search**        | `tsvector` with `GIN` indexing provides fast, accurate full-text search across media articles and social content without requiring Elasticsearch at MVP scale          |
| **JSONB**                   | Flexible column type for configuration objects (report templates, campaign settings, white-label settings) without sacrificing query performance                       |
| **Foreign key constraints** | Every multi-tenant table's `organization_id` foreign key enforces referential integrity at the database level                                                          |
| **Data sovereignty**        | Self-hosted in Nigeria; no managed cloud provider has a Nigerian data center; NDPR compliance requires data to remain in Nigeria                                       |
| **30+ years of maturity**   | PostgreSQL's query planner, stability record, and tooling ecosystem are unmatched among open-source relational databases                                               |
| **No licensing cost**       | PostgreSQL is free and open source; the only cost is infrastructure                                                                                                    |

### Alternatives Considered

| Alternative                                                   | Why Rejected                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MySQL / MariaDB**                                           | No Row-Level Security (a critical feature for multi-tenant isolation); weaker full-text search; `JSONB` equivalent is less performant; fewer advanced features                                                |
| **MongoDB**                                                   | No foreign key constraints; application-level joins are slower and harder to maintain; no RLS; ACID transactions across collections require careful configuration; relational data model is harder to enforce |
| **CockroachDB**                                               | Distributed PostgreSQL-compatible database, but adds significant operational complexity we cannot justify at MVP scale; some PostgreSQL features (like certain `tsvector` operations) are not fully supported |
| **SQLite**                                                    | Excellent for cache (we use it there), but write serialization makes it unsuitable for concurrent multi-tenant SaaS workloads with many simultaneous writers                                                  |
| **Managed cloud PostgreSQL (RDS, Cloud SQL, Supabase, Neon)** | These are excellent services, but no provider has a data center in Nigeria; data sovereignty for NDPR compliance requires on-premises or local VPS hosting                                                    |

### Consequences

**Positive:**

- Multi-tenant isolation enforced at three independent layers (RLS, application, service)
- ACID compliance for financial data (₦ billing records are never in an inconsistent state)
- Full-text search without a separate Elasticsearch service
- No licensing cost; only infrastructure cost
- Full operational control; data never leaves Nigeria

**Negative:**

- Self-hosting requires PostgreSQL operational expertise (tuning, backup, monitoring)
- Vertical scaling has limits; horizontal scaling (read replicas, sharding) adds complexity
- Team must manage backups, WAL archiving, and point-in-time recovery
- Database migrations must be planned carefully for zero-downtime deployments

**Risk Mitigation:**

- Designate one engineer as the PostgreSQL operational owner
- Implement automated daily backups with WAL archiving (RPO: 1 hour)
- Use `drizzle-kit` for migration management; require backward-compatible migrations
- Evaluate migrating to managed PostgreSQL (Supabase or Neon) if operational burden becomes unsustainable (see Planned ADR-021)

### Review Triggers

- A Nigerian-region managed PostgreSQL provider becomes available
- The self-hosting operational burden exceeds one engineer-day per week
- Read replica requirements exceed what our VPS setup can support

### Related ADRs

- ADR-004: SQLite for Cache and Rate Limiting
- ADR-005: Drizzle ORM as the Database ORM
- ADR-008: Self-Hosted VPS in Nigeria Behind WireGuard VPN
- ADR-009: Multi-Tenant Architecture with Row-Level Security

---

## 8. ADR-004: SQLite for Cache and Rate Limiting (MVP)

**Status:** ✅ Accepted
**Date:** 2026-06-18
**Deciders:** Engineering Lead, DevOps Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires:

1. A cache for frequently-read data (user permissions, organization settings, computed analytics, monitoring feed results)
2. A rate limiting store for per-user, per-endpoint sliding-window rate limits

**Key requirements:**

- Sub-millisecond read/write operations
- ACID compliance (rate limiting counters must be atomically incremented)
- TTL-based expiration for cached data
- Minimal operational overhead at MVP scale
- No separate service to deploy and monitor
- Compatible with Bun

### Decision

Use **SQLite 3+** via Bun's native `bun:sql` module for both the cache store and the rate limit store. Plan to migrate to **Redis 7+** when horizontal scaling requires a distributed cache (Year 2+).

### Rationale

| Reason                    | Detail                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **No separate service**   | SQLite runs in-process — zero operational overhead; no Redis server to deploy, monitor, restart, or back up                                |
| **Sub-millisecond reads** | File-based storage with OS page cache produces extremely fast reads for hot cache keys                                                     |
| **Native Bun support**    | `bun:sql` provides a clean, high-performance SQLite API without a native module compilation step                                           |
| **ACID compliance**       | WAL mode provides ACID guarantees for rate limit counter increments — no double-counting under concurrent requests                         |
| **Easy backup**           | SQLite is a single file; included in the daily server backup without special tools                                                         |
| **Sufficient for MVP**    | A single-instance application with <5,000 MAU and <100 requests/second does not need a distributed cache                                   |
| **Clean migration path**  | The cache layer is abstracted behind `cache.service.ts`; the migration to Redis requires changing the implementation, not the calling code |

### Cache Schema

```sql
-- cache_entries table (SQLite)
CREATE TABLE cache_entries (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,           -- JSON-serialized
  tags      TEXT,                    -- comma-separated tags for bulk invalidation
  expires_at INTEGER NOT NULL,       -- Unix timestamp
  created_at INTEGER DEFAULT (UNIXEPOCH())
);

CREATE INDEX idx_cache_expires ON cache_entries(expires_at);

-- rate_limit_entries table (SQLite)
CREATE TABLE rate_limit_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,          -- {endpoint}:{user_id_or_ip}
  created_at INTEGER DEFAULT (UNIXEPOCH())
);

CREATE INDEX idx_rate_limit_key_time ON rate_limit_entries(key, created_at);
```

### Alternatives Considered

| Alternative                        | Why Rejected                                                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis (at MVP)**                 | Adds an external service to deploy, configure, monitor, and maintain; not justified for a single-instance application at MVP scale; operational burden outweighs the benefits |
| **In-memory (JavaScript Map/LRU)** | Lost entirely on process restart; cannot be shared if we ever run two processes; no persistence; no TTL management                                                            |
| **PostgreSQL**                     | Same database server as primary data; cache misses would still hit the database; cache operations add connection pool pressure; slower than SQLite for simple key-value reads |
| **Memcached**                      | External service with the same operational overhead as Redis, but fewer features (no data structure richness, no persistence)                                                 |

### Migration Plan to Redis (Year 2)

**Trigger:** Application is deployed on more than one VPS instance, making the SQLite cache non-shared and therefore invalid.

**Migration steps:**

1. Implement `RedisCache` class conforming to the same `CacheService` interface as `SqliteCache`
2. Add `CACHE_PROVIDER=redis` environment variable
3. `cache.service.ts` instantiates `RedisCache` when `CACHE_PROVIDER=redis`
4. Deploy Redis alongside the application
5. Switch `CACHE_PROVIDER` in production
6. Monitor cache hit rate; SQLite is removed after validation

### Consequences

**Positive:**

- Zero operational overhead at MVP
- Sub-millisecond performance
- ACID-safe rate limiting counters
- Simple backup (single file)
- Clean migration path to Redis when needed

**Negative:**

- Not distributed — if two application instances run, their caches diverge
- Cache is co-located with the application process — large caches consume application server disk
- SQLite WAL mode writes can occasionally cause brief lock contention under high write load

**Risk Mitigation:**

- Monitor cache file size; alert at 5 GB
- Schedule background job to clean expired cache entries every 5 minutes
- Document the Redis migration trigger and plan clearly (see above)

### Review Triggers

- Application is scaled to run on two or more instances
- SQLite cache file exceeds 10 GB
- Cache write contention causes measurable API latency increase

### Related ADRs

- ADR-001: Bun as the Runtime (enables `bun:sql`)
- ADR-015: Cache and Rate Limit Patterns

---

## 9. ADR-005: Drizzle ORM as the Database ORM

**Status:** ✅ Accepted
**Date:** 2026-06-19
**Deciders:** Engineering Lead, Senior Engineers
**Last Reviewed:** 2026-07-21

### Context

The platform requires an ORM or query builder for PostgreSQL access. The ORM shapes how the team interacts with the database: how schemas are defined, how queries are built, how migrations are managed, and how type safety is enforced.

**Key requirements:**

- TypeScript-first with strong type inference from schema to query results
- Schema-as-code in TypeScript (not a separate `.prisma` DSL or XML)
- Lightweight (no heavy runtime binary)
- Good migration tooling
- Native Bun compatibility
- SQL-like query API familiar to engineers with SQL experience

### Decision

Use **Drizzle ORM** as the ORM for all PostgreSQL database access.

### Rationale

| Reason                           | Detail                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript schema definition** | The database schema is TypeScript code — `users` table definition produces a TypeScript type automatically; no separate type generation step        |
| **SQL-like query API**           | `db.select().from(users).where(eq(users.orgId, orgId))` reads like SQL; engineers with SQL knowledge can read and write Drizzle queries immediately |
| **Zero code generation**         | Unlike Prisma, Drizzle does not require `prisma generate`; the schema file is the source of types; CI is simpler                                    |
| **Native Bun compatibility**     | Drizzle works out of the box with Bun's PostgreSQL driver; no native module compilation issues                                                      |
| **Lightweight runtime**          | Drizzle adds minimal overhead to queries; it generates clean SQL and executes it; no proxy layer                                                    |
| **Relational query API**         | `db.query.posts.findMany({ with: { assets: true } })` performs efficient eager loading without N+1 query patterns                                   |
| **Migration tooling**            | `drizzle-kit generate` diffs the schema and produces plain SQL migrations; migrations are readable and reviewable                                   |

### Alternatives Considered

| Alternative                | Why Rejected                                                                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prisma**                 | Market leader with excellent DX, but: requires a `prisma generate` compilation step (adds CI complexity); Prisma binary has had compatibility issues with Bun; connection pooling approach differs from our PgBouncer strategy; the Prisma client adds more runtime weight than Drizzle |
| **TypeORM**                | Mature but uses decorator-based schema definition (decorators are experimental in TypeScript); type inference is weaker than Drizzle; the API design is older and more verbose                                                                                                          |
| **Sequelize**              | JavaScript-first; TypeScript support is a secondary concern; callback-based API in parts; heavier than needed                                                                                                                                                                           |
| **Knex**                   | Query builder only — no schema definition, no type inference from schema, no migration management as part of the schema definition workflow; would require a separate migration tool                                                                                                    |
| **Raw SQL with pg driver** | Full control and maximum performance, but no type safety from schema; every query result is `any` unless manually typed; significant boilerplate for type-safe queries                                                                                                                  |

### Consequences

**Positive:**

- Type-safe database operations from schema definition to query result
- Engineers familiar with SQL can contribute to database layer immediately
- No code generation step in CI
- Clean, readable SQL migrations
- Lightweight runtime overhead

**Negative:**

- Smaller community than Prisma — fewer Stack Overflow answers and blog posts
- Migration tooling is less mature than Prisma's (occasional edge cases require manual migration editing)
- Some complex query patterns require raw SQL fallback (`db.execute(sql`...`)`)
- Drizzle is evolving rapidly — some API surfaces change between minor versions

**Risk Mitigation:**

- Use raw SQL via `db.execute(sql`...`)` for complex analytical queries rather than fighting the ORM
- Pin Drizzle to a minor version; update deliberately with thorough testing
- Document internal Drizzle patterns in the Engineering Standards document

### Review Triggers

- Drizzle introduces a breaking change that requires significant migration effort
- A critical feature is needed that Drizzle cannot support
- Prisma releases a version with full Bun compatibility that makes the trade-offs more favorable

### Related ADRs

- ADR-003: PostgreSQL as the Primary Database

---

## 10. ADR-006: CASL as the RBAC Library

**Status:** ✅ Accepted
**Date:** 2026-06-20
**Deciders:** Engineering Lead, Product Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires a Role-Based Access Control (RBAC) system that supports:

- Role-based permission defaults (Owner, Admin, Manager, Creator, Analyst, Viewer)
- Resource-based permissions (e.g., a user can only edit their own posts)
- Conditional permissions (e.g., a Manager can approve content only within their organization)
- Defense in depth — RBAC enforced at the API route, the service layer, and the database query layer
- Per-user permission overrides (an Admin can grant or revoke individual permissions)
- Self-protection rules (an Admin cannot demote themselves or remove the last Admin)

### Decision

Use **CASL** as the RBAC library for all authorization logic across the API layer, service layer, and React components.

### Rationale

| Reason                      | Detail                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conditional permissions** | CASL's `subject` and `conditions` API supports `{ organizationId: user.organizationId }` conditions — a post can only be edited by someone from the same organization |
| **TypeScript-first**        | CASL provides excellent type inference for ability definitions — `ability.can('publish', 'Post')` is fully typed                                                      |
| **Framework-agnostic**      | The same ability definition runs in Hono middleware (API layer), service methods (business logic), and React components (UI layer) — one source of truth              |
| **Testable**                | Ability definitions are pure functions; they can be unit-tested without mocking database calls                                                                        |
| **Composable**              | Abilities for different roles are defined independently and can be merged                                                                                             |
| **Mature**                  | CASL has been in production use for many years; the API surface is stable                                                                                             |

### Role Permission Matrix

| Permission                   | Owner | Admin | Manager | Creator | Analyst | Viewer |
| ---------------------------- | ----- | ----- | ------- | ------- | ------- | ------ |
| Manage organization settings | ✅    | ✅    | ❌      | ❌      | ❌      | ❌     |
| Manage billing (₦)           | ✅    | ❌    | ❌      | ❌      | ❌      | ❌     |
| Manage team members          | ✅    | ✅    | ✅\*    | ❌      | ❌      | ❌     |
| Approve content              | ✅    | ✅    | ✅      | ❌      | ❌      | ❌     |
| Publish content              | ✅    | ✅    | ✅      | ✅      | ❌      | ❌     |
| Create content               | ✅    | ✅    | ✅      | ✅      | ❌      | ❌     |
| View analytics               | ✅    | ✅    | ✅      | ✅      | ✅      | ✅     |
| View monitoring              | ✅    | ✅    | ✅      | ✅      | ✅      | ✅     |
| Export reports               | ✅    | ✅    | ✅      | ❌      | ✅      | ❌     |
| Manage crisis response       | ✅    | ✅    | ✅      | ❌      | ❌      | ❌     |
| View dashboard               | ✅    | ✅    | ✅      | ✅      | ✅      | ✅     |

_Managers can only manage users with roles below Manager (Creator, Analyst, Viewer)_

### Alternatives Considered

| Alternative                    | Why Rejected                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom RBAC implementation** | Solving a solved problem; a custom implementation would need to handle all the edge cases CASL already handles; harder to test and maintain  |
| **Permit.io**                  | External service — permissions data leaves our infrastructure (sovereignty concern); adds an external API dependency; cost scales with usage |
| **AccessControl (npm)**        | JavaScript-first; weaker TypeScript type inference; less active development than CASL                                                        |
| **Role-based middleware only** | Too simple for our requirements — we need resource-level and conditional permissions, not just role checks                                   |

### Consequences

**Positive:**

- Single consistent authorization model across all layers
- Conditional and resource-based permissions supported natively
- Pure function ability definitions are unit-testable
- Frontend can use the same ability objects to hide/show UI elements

**Negative:**

- CASL has a learning curve — the `subject()` helper and `MongoQuery` conditions are unfamiliar to most engineers
- Complex conditional permissions can be hard to debug
- Permission checks add slight overhead to every authorized operation
- Ability definitions must be kept synchronized with the role matrix

**Risk Mitigation:**

- Document all ability definitions with inline comments explaining the condition
- Build a `canI(user, 'action', 'resource')` helper that wraps CASL with clear error messages
- Add unit tests for every ability definition covering positive, negative, and edge cases

### Review Triggers

- CASL is abandoned or development stalls
- A permission model requirement cannot be expressed in CASL's API
- Performance profiling shows CASL permission checks as a bottleneck

### Related ADRs

- ADR-009: Multi-Tenant Architecture with Row-Level Security (complementary authorization layer)
- ADR-010: JWT-Based Authentication (CASL abilities are built from the JWT claims)

---

## 11. ADR-007: Single Deployable Service with Two Entry Points

**Status:** ✅ Accepted
**Date:** 2026-06-21
**Deciders:** Engineering Lead, CTO
**Last Reviewed:** 2026-07-21

### Context

The platform needs to serve the web app (browser), the mobile app (React Native), and external webhook senders. The architectural question is: should these be served by one unified process or multiple separate services?

**Key requirements:**

- Business logic in one place
- Simple operations for a small team
- Fast development iteration
- Sufficient for the pilot scale (50–300 organizations, 5,000 MAU)

### Decision

Deploy **one Bun process** that contains both TanStack Start (serving the web app) and Hono (serving the API at `/api/*`). Both entry points share the same services layer in-process.

### Rationale

| Reason                               | Detail                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Operational simplicity**           | One process to build, test, deploy, monitor, and restart — a 5-person engineering team cannot afford the overhead of operating multiple services |
| **No network hop for service calls** | Server Functions call the services layer directly in memory — no HTTP overhead, no serialization, no network latency                             |
| **Single codebase**                  | No risk of business logic diverging between a "web service" and an "API service"                                                                 |
| **Shared type definitions**          | TypeScript types from the services layer are available to both entry points without an API contract intermediary                                 |
| **Vertical scaling is sufficient**   | At pilot scale, vertical scaling (upgrading the VPS) is cheaper and simpler than horizontal scaling with distributed services                    |
| **Monolith-first is pragmatic**      | The engineering industry has broadly validated the "monolith first, split later" approach for startups                                           |

### Alternatives Considered

| Alternative                                           | Why Rejected                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Microservices**                                     | Multiple deployments, multiple monitoring stacks, inter-service HTTP calls for every business operation, distributed transaction complexity, larger team required to operate — unjustifiable overhead for a 5-person team at pilot scale |
| **Serverless (Vercel Functions, AWS Lambda)**         | Cold start issues for dashboard interactions; vendor lock-in; data sovereignty is difficult (functions execute in US/EU data centers); pricing unpredictability                                                                          |
| **Traditional two-process (Express API + React SPA)** | No SSR; business logic risk in the React SPA; two deployments to manage; no Server Functions                                                                                                                                             |

### Service Split Trigger

When **any two** of the following are true:

- Monthly active users exceed 100,000
- Engineering team exceeds 15 engineers
- A specific module (e.g., media monitoring ingestion) requires independent scaling
- The single-process deployment shows CPU or memory saturation at peak load

### Consequences

**Positive:**

- One `bun dev` starts everything
- One deployment pipeline
- Business logic cannot diverge between services
- Zero latency between web app data calls and business logic

**Negative:**

- Web app and API cannot be scaled independently
- A failure in one entry point can affect the other (mitigated by Nginx health checks and process restart)
- Future microservices extraction requires identifying and respecting service boundaries

**Risk Mitigation:**

- Enforce the import boundary rules (ADR-000, Principle 4) — this ensures the services layer is already cleanly separated; if we ever split into microservices, the services are extractable
- Never let business logic drift into the entry point layers

### Review Triggers

- Scale triggers listed above are met
- A critical feature requires independent scaling of one module
- Engineering team exceeds 15 engineers and team ownership becomes unclear

### Related ADRs

- ADR-002: TanStack Start + Hono as the Web and API Framework

---

## 12. ADR-008: Self-Hosted VPS in Nigeria Behind WireGuard VPN

**Status:** ✅ Accepted
**Date:** 2026-06-22
**Deciders:** Engineering Lead, CTO, Security Lead, DevOps Lead
**Last Reviewed:** 2026-07-21

### Context

The platform must decide where and how to host the application infrastructure. This decision has significant implications for data sovereignty (NDPR compliance), cost, operational complexity, and security.

**Key requirements:**

- Nigerian Data Protection Regulation (NDPR) compliance — data must be processed within Nigeria
- Predictable monthly cost (a startup cannot absorb unpredictable cloud bills)
- Full operational control
- Secure administrative access
- Ability to scale from pilot to 2,000 organizations on the same infrastructure

### Decision

Host the application on a **self-managed VPS located in Nigeria** (Lagos or Abuja data center), with all administrative access routed through a **WireGuard VPN** tunnel. Deploy and manage the application using **Coolify**.

### Rationale

**Why self-hosted VPS:**

| Reason                  | Detail                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NDPR compliance**     | No major cloud provider (AWS, GCP, Azure, DigitalOcean) has a data center in Nigeria; NDPR requires that Nigerian personal data be processed within Nigeria; self-hosted VPS with a Nigerian provider is the only compliant option at this stage |
| **Cost predictability** | A ₦75,000–₦120,000/month VPS is a fixed cost; equivalent cloud infrastructure with egress and API costs would be 3–5× higher and variable                                                                                                        |
| **Full control**        | No abstraction between our configuration decisions and the infrastructure; we can apply any kernel-level optimization, firewall rule, or custom build                                                                                            |
| **No vendor lock-in**   | We can migrate to a different VPS provider in a day; moving from AWS to GCP would take weeks                                                                                                                                                     |

**Why WireGuard VPN:**

| Reason                        | Detail                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Minimal attack surface**    | Only UDP port 51820 is exposed to the internet; SSH, PostgreSQL, Grafana, and the Coolify dashboard are all accessible only through the encrypted VPN tunnel |
| **Public-key authentication** | No passwords — only pre-authorized WireGuard public keys can connect; stolen credentials cannot be used without the private key                              |
| **Performance**               | WireGuard is the fastest VPN protocol; negligible overhead for administrative operations                                                                     |
| **Auditability**              | WireGuard configuration is 10–15 lines; any engineer can read and understand it                                                                              |

**Why Coolify:**

| Reason                     | Detail                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| **Self-hosted PaaS**       | Provides Heroku/Vercel-like deployment UX on our own VPS — push to Git, get a deployment |
| **Blue-green deployments** | Built-in support for zero-downtime deployments                                           |
| **Rollback**               | One-click rollback to the previous deployment                                            |
| **Environment management** | Secure environment variable management per service                                       |
| **Open source**            | MIT licensed; no vendor lock-in; inspectable                                             |

### Alternatives Considered

| Alternative                                     | Why Rejected                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**                                      | No Nigerian data center; data sovereignty violation; expensive at scale; cannot deploy arbitrary Docker containers                    |
| **AWS (any region)**                            | No Nigerian data center (nearest is South Africa); data sovereignty violation; complex IAM and networking; unpredictable egress costs |
| **Google Cloud (Africa region — Johannesburg)** | Data stored in South Africa, not Nigeria; NDPR requires Nigerian jurisdiction; GCP is complex to operate for a small team             |
| **DigitalOcean**                                | No Nigerian data center; data sovereignty violation; limited customization compared to raw VPS                                        |
| **On-premises**                                 | Capital expense for hardware; physical security requirements; power and cooling costs; operational burden exceeds VPS at our scale    |

### Infrastructure Specifications by Phase

| Phase              | Hardware                           | Est. Monthly Cost (₦) | Scale                   |
| ------------------ | ---------------------------------- | --------------------- | ----------------------- |
| Pilot (2026)       | 4 vCPU, 8 GB RAM, 200 GB SSD NVMe  | ₦75,000 – ₦120,000    | 300 orgs, 5,000 MAU     |
| Phase 2 (2027)     | 8 vCPU, 16 GB RAM, 500 GB SSD NVMe | ₦150,000 – ₦250,000   | 2,000 orgs, 30,000 MAU  |
| Year 2 (2027–2028) | 16 vCPU, 32 GB RAM, 1 TB SSD NVMe  | ₦300,000 – ₦500,000   | 7,000 orgs, 100,000 MAU |

### Consequences

**Positive:**

- NDPR compliance by design
- Predictable ₦-denominated infrastructure cost
- Full operational control
- No vendor lock-in
- Reduced attack surface (WireGuard VPN)

**Negative:**

- We are responsible for hardware failures (VPS provider SLA is typically 99.9%)
- We must manage OS updates, security patches, and kernel upgrades
- Disaster recovery requires us to restore from backup to a new VPS
- Scaling requires manual VPS upgrades (vertical) or operational work (horizontal)

**Risk Mitigation:**

- Use a VPS provider with a 99.9%+ SLA and automated failover
- Configure automated daily backups to Backblaze B2 (off-site)
- Maintain a tested disaster recovery runbook (RTO: 30 minutes)
- Use Coolify's automated deployment pipeline to reduce human error during deployments
- Monitor VPS health metrics (CPU, memory, disk, network) with alerts via Grafana

### Review Triggers

- A major cloud provider opens a Nigerian data center
- NDPR regulations are clarified to allow specific foreign cloud hosting
- Operational burden of self-hosting exceeds 1 engineer-day per week

### Related ADRs

- ADR-003: PostgreSQL as the Primary Database
- ADR-012: Blue-Green Deployment Strategy

---

## 13. ADR-009: Multi-Tenant Architecture with Row-Level Security

**Status:** ✅ Accepted
**Date:** 2026-06-23
**Deciders:** Engineering Lead, CTO, Security Lead
**Last Reviewed:** 2026-07-21

### Context

Nawebeus is a multi-tenant SaaS platform. Every organization (brand, agency, company) that subscribes must have its data completely isolated from every other organization. Data leakage between tenants is a catastrophic security failure — a Nigerian bank's monitoring data leaking to a competitor would end the company.

**Key requirements:**

- Zero tolerance for cross-tenant data access
- Defense in depth (multiple independent layers)
- Scalable to 50,000+ organizations
- Auditable (access violations logged)
- Testable (automated tests verify isolation in CI)

### Decision

Enforce multi-tenant data isolation at **three independent layers**:

1. **Database layer:** PostgreSQL Row-Level Security (RLS) policies on every multi-tenant table
2. **Application layer:** Every API request validates that the authenticated user is a member of the requested organization
3. **Service layer:** Every service method that queries multi-tenant data accepts `organizationId` as a required typed parameter; no query executes without an organization filter

### Rationale

| Reason                                                | Detail                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Defense in depth**                                  | Three independent layers mean that a bug in one layer does not produce a data leak; all three layers must fail simultaneously for a cross-tenant access to occur    |
| **RLS as the last line of defense**                   | Even if application code has a bug that passes the wrong `organizationId`, RLS at the database level prevents the query from returning another tenant's data        |
| **JWT contains `organization_id`**                    | Every authenticated session has the organization context embedded; middleware automatically verifies that the requested resource belongs to the user's organization |
| **`organization_id` as a required service parameter** | Making `organizationId` a required typed parameter makes it structurally impossible to accidentally query without tenant context                                    |
| **Automated isolation tests**                         | Every module has tests that verify a user from Organization A cannot access data from Organization B                                                                |

### Implementation Status (2026-08-01)

| Layer | Status | Notes |
| ----- | ------ | ----- |
| **2. Application layer** | ✅ Implemented | `authMiddleware` verifies membership against `organization_members` on every authenticated request; `requireOrgMatch` validates URL `:orgId` against the JWT orgId |
| **3. Service layer** | ✅ Implemented | `organizationId` is a required typed parameter on multi-tenant service methods; CASL abilities are built with org-scoped conditions |
| **1. Database layer (RLS)** | ⏸ Deferred | No RLS policies are enabled yet. The application- and service-layer guards are in place as the near-term backstop; RLS is a dedicated follow-up. |

### Row-Level Security Implementation

```sql
-- Enable RLS on every multi-tenant table
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_incidents ENABLE ROW LEVEL SECURITY;
-- ... (all multi-tenant tables)

-- Policy: users can only SELECT rows for their organization
CREATE POLICY "org_isolation_select" ON media_mentions
  FOR SELECT
  USING (organization_id = current_setting('app.current_org_id', true));

-- Policy: users can only INSERT rows for their organization
CREATE POLICY "org_isolation_insert" ON media_mentions
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Policy: users can only UPDATE rows for their organization
CREATE POLICY "org_isolation_update" ON media_mentions
  FOR UPDATE
  USING (organization_id = current_setting('app.current_org_id', true));

-- Middleware sets the org context at the start of every request
-- await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
```

### Alternatives Considered

| Alternative                          | Why Rejected                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema-per-tenant**                | Each organization gets its own PostgreSQL schema; provides strong isolation, but: managing 50,000 schemas is operationally nightmarish; cross-tenant migrations require running the migration for every schema; backups are complex; joins across tenant schemas are impossible |
| **Database-per-tenant**              | Maximum isolation, but: 50,000 databases is completely unmanageable; costs are prohibitive; no shared analytics possible                                                                                                                                                        |
| **Application-level isolation only** | Simpler, but: a single bug in the application code can expose data; no defense in depth; no audit at the database level                                                                                                                                                         |
| **RLS only (no application layer)**  | Strong database-level enforcement, but: no application-level error messages that are meaningful to the user; no defense if RLS is misconfigured                                                                                                                                 |

### Consequences

**Positive:**

- Zero cross-tenant data leakage with correct implementation
- Three independent failure points must all fail simultaneously for a breach
- RLS protects even against application-level bugs
- Automated tests in CI continuously verify isolation
- Auditable — every unauthorized access attempt is logged

**Negative:**

- Every database query requires the `app.current_org_id` session variable to be set
- RLS adds a small performance overhead to every query (typically <1ms)
- Every multi-tenant table requires `organization_id` column with NOT NULL constraint and `GIN` index
- RLS policies must be maintained when new tables are added

**Risk Mitigation:**

- Add a CI lint check that verifies every new Drizzle table definition has `organizationId` and `NOT NULL`
- Run automated isolation tests against every module in CI/CD
- Quarterly security audit of RLS policies
- Penetration test conducted annually by an external firm

### Review Triggers

- A security audit reveals a RLS misconfiguration
- A new PostgreSQL version changes RLS behavior
- Scale requires a different multi-tenancy model (e.g., schema-per-tenant for the largest customers)

### Related ADRs

- ADR-003: PostgreSQL as the Primary Database
- ADR-006: CASL as the RBAC Library (complementary authorization layer)

---

## 14. ADR-010: JWT-Based Authentication with HTTP-Only Cookies

**Status:** ✅ Accepted
**Date:** 2026-06-24
**Deciders:** Engineering Lead, Security Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires user authentication that works across:

- The web app (browser)
- The mobile app (React Native / Expo)
- API calls from third-party clients (future)
- Webhook endpoints (signature-based, no user auth)

**Key security requirements:**

- Protection against XSS (Cross-Site Scripting) attacks
- Protection against CSRF (Cross-Site Request Forgery) attacks
- Protection against session hijacking
- Support for MFA (Multi-Factor Authentication)
- Scalable (no server-side session storage required)
- Fast token validation (no database lookup per request)

### Decision

Use **JWT-based authentication** with:

- **Web app:** Access tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies
- **Mobile app:** Access tokens stored in Expo `SecureStore` (OS-level encrypted storage)
- **Access token lifetime:** 15 minutes (short-lived for security)
- **Refresh token lifetime:** 7 days, sliding window, rotating on each use
- **Token signing:** HS256, secret rotated annually
- **MFA:** TOTP (Time-based One-Time Password) — optional for all users, enforced for Owner and Admin roles

### JWT Payload Structure

```json
{
  "sub": "usr_9f2a4b",
  "org": "org_7e3b2c",
  "role": "manager",
  "email": "ade.ogunleye@firstbank.com.ng",
  "mfa_verified": true,
  "iat": 1721560200,
  "exp": 1721561100,
  "jti": "tok_abc123def456"
}
```

### Rationale

| Reason                                   | Detail                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **httpOnly cookie (XSS prevention)**     | JavaScript running in the browser cannot read `httpOnly` cookies; XSS attacks cannot steal the token even if they execute arbitrary scripts          |
| **SameSite=Strict (CSRF prevention)**    | The browser will not send the cookie with requests originating from other domains; CSRF attacks from malicious third-party sites are ineffective     |
| **Stateless (scalability)**              | No server-side session storage required; the token contains all claims needed for authorization; horizontal scaling requires no shared session store |
| **Short-lived access tokens (15 min)**   | If an access token is somehow compromised, it is useless within 15 minutes without a valid refresh token                                             |
| **Rotating refresh tokens (revocation)** | Each refresh generates a new refresh token and invalidates the old one; a stolen refresh token is detected on the next use                           |
| **`organization_id` in JWT**             | Every API request has the tenant context without a database lookup; request routing and CASL ability construction are synchronous                    |
| **Expo SecureStore (mobile)**            | iOS Keychain and Android Keystore provide hardware-backed encryption for tokens on mobile devices                                                    |

### Alternatives Considered

| Alternative                                 | Why Rejected                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT in localStorage**                     | Readable by any JavaScript on the page — XSS vulnerability is critical; rejected for web                                                                    |
| **Server-side sessions (PostgreSQL/Redis)** | Every authenticated request requires a database or cache lookup; adds latency; requires shared session storage for horizontal scaling; more state to manage |
| **OAuth 2.0 (third-party provider only)**   | Excellent for social login, but adds external dependency for core authentication; we still need our own auth for users who don't use Google/Microsoft       |
| **Session cookies only (no JWT)**           | Stateful — requires server-side session storage; doesn't work cleanly for the mobile API (mobile apps prefer Bearer tokens)                                 |
| **Longer access token lifetime (7 days)**   | Longer tokens are a security risk — a leaked access token is valid for much longer; 15 minutes balances usability and security                              |

### Consequences

**Positive:**

- XSS attacks cannot steal tokens (httpOnly cookies)
- CSRF attacks are ineffective (SameSite=Strict)
- Stateless — no server-side session storage at MVP
- Mobile app uses secure OS-level token storage
- Short-lived tokens limit the impact of token compromise

**Negative:**

- Access tokens cannot be individually revoked before expiry (mitigated by short 15-minute lifetime)
- Refresh token rotation requires careful implementation to handle concurrent refresh requests
- JWT size grows with additional claims; sent with every request (mitigated by keeping claims minimal)
- Clock skew between client and server can cause premature token expiry (mitigated by 30-second clock skew tolerance)

**Risk Mitigation:**

- Maintain a refresh token revocation list in SQLite for emergency token invalidation
- Use NTP to synchronize server clocks
- Implement concurrent refresh request deduplication (idempotent refresh endpoint)
- Log all token issuance and refresh events for audit purposes

### Review Triggers

- A significant XSS vulnerability is discovered that circumvents httpOnly cookies
- Regulatory requirement mandates a different authentication mechanism
- Scale requires a different token distribution mechanism

### Related ADRs

- ADR-006: CASL as the RBAC Library (CASL abilities are built from JWT claims)
- ADR-009: Multi-Tenant Architecture with Row-Level Security (organization_id from JWT sets RLS context)

---

## 15. ADR-011: Paystack as the Payment Processor

**Status:** ✅ Accepted
**Date:** 2026-06-25
**Deciders:** Engineering Lead, Finance Lead, Product Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires a payment processor for subscription billing. All subscriptions are priced in Nigerian Naira (₦). The payment processor must handle:

- ₦-denominated subscription creation (Starter: ₦50,000/month, Growth: ₦150,000/month, Professional: ₦350,000/month, Enterprise: custom, Agency: ₦500,000/month)
- Recurring billing (monthly and annual cycles)
- Nigerian bank card payments (Visa, Mastercard, Verve)
- Nigerian bank account direct debit
- USSD payment (important for users on low-data connections)
- Webhook-based subscription lifecycle management
- PCI DSS compliance (we must never handle raw card data)

### Decision

Use **Paystack** as the exclusive payment processor for all Nawebeus subscriptions.

### Rationale

| Reason                        | Detail                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nigerian-first**            | Paystack was founded in Nigeria and is the dominant payment processor in the Nigerian market; trusted by Nigerian businesses and consumers                    |
| **₦-native**                  | All transactions are natively in Nigerian Naira; no currency conversion complexity or FX risk                                                                 |
| **Nigerian bank integration** | Paystack supports direct debit from Nigerian bank accounts, Verve cards (Nigeria-specific), and USSD payments — capabilities Stripe does not offer in Nigeria |
| **Subscription lifecycle**    | Paystack's Subscriptions API handles create, pause, resume, cancel, plan change, and upcoming payment events                                                  |
| **Webhook reliability**       | Comprehensive webhook events with signature verification for all subscription lifecycle events                                                                |
| **PCI DSS compliance**        | Paystack's Popup JS handles card data on their servers; Nawebeus never touches raw card numbers                                                               |
| **Developer experience**      | Well-documented API, Nigerian developer community support, SDK-friendly                                                                                       |
| **Proven at scale**           | Paystack processes billions of naira in daily transactions for major Nigerian businesses                                                                      |

### Paystack Integration Architecture

```
User initiates subscription
    ↓
Nawebeus creates Paystack customer record (via Paystack API)
    ↓
Paystack Popup JS shown to user (card data entered on Paystack's servers)
    ↓
Paystack tokenizes card → returns authorization code
    ↓
Nawebeus creates Paystack Plan subscription with authorization code
    ↓
Paystack sends webhook: charge.success → Nawebeus activates subscription
    ↓
Paystack sends recurring webhook on each billing cycle
    ↓
Nawebeus updates subscription status based on webhook events
```

**Handled Webhook Events:**

| Event                         | Nawebeus Action                                    |
| ----------------------------- | -------------------------------------------------- |
| `charge.success`              | Activate or renew subscription; generate ₦ invoice |
| `subscription.create`         | Record subscription; send welcome email            |
| `subscription.disable`        | Deactivate subscription; notify user               |
| `subscription.expiring_cards` | Notify user to update payment method               |
| `invoice.payment_failed`      | Enter grace period; notify user; schedule retry    |

### Alternatives Considered

| Alternative           | Why Rejected                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe**            | Stripe does not support Verve cards (Nigeria-specific card network), USSD payments, or Nigerian bank direct debit; USD-primary with manual NGN currency conversion; limited Nigerian bank payment experience; lower trust among Nigerian business buyers than Paystack |
| **Flutterwave**       | Nigerian alternative with good reach, but subscription management is less mature than Paystack's; webhook reliability has been reported as inconsistent; developer experience is weaker                                                                                |
| **Squad (by GTBank)** | Growing Nigerian processor but smaller developer community; fewer integrations; less proven for subscription use cases                                                                                                                                                 |
| **Manual invoicing**  | Unscalable; no automated subscription lifecycle; requires manual intervention for every renewal; creates operational overhead and revenue leakage                                                                                                                      |
| **PayPal**            | Not widely trusted for business payments in Nigeria; subscription API is less developer-friendly; USD-primary                                                                                                                                                          |

### Consequences

**Positive:**

- ₦-native billing with no FX conversion complexity
- Nigerian bank, card, and USSD payment methods supported
- Paystack trusted by Nigerian businesses and consumers
- PCI DSS compliance without handling card data
- Automated subscription lifecycle via webhooks
- Competitive transaction fees (Paystack: 1.5% + ₦100 capped at ₦2,000 for NGN transactions)

**Negative:**

- Paystack is primarily Nigerian and West African — limits future global expansion
- Migrating to a different payment processor requires re-mapping subscription state
- Paystack's international capabilities are weaker than Stripe's
- Subscription feature set is still evolving compared to Stripe

**Risk Mitigation:**

- Design the billing service with an abstraction layer (`billing.service.ts`) so the payment processor can be swapped
- Monitor Paystack webhook delivery reliability; implement retry logic for missed webhooks
- For future international markets, evaluate Stripe or Flutterwave as a second processor rather than replacing Paystack for Nigerian customers

### Review Triggers

- Paystack is acquired and pricing/reliability changes significantly
- A significant portion of customers are outside Nigeria and request other payment methods
- Paystack's subscription feature set lags behind business requirements

### Related ADRs

- ADR-008: Self-Hosted VPS in Nigeria (data sovereignty context for payment processor choice)

---

## 16. ADR-012: Blue-Green Deployment Strategy

**Status:** ✅ Accepted
**Date:** 2026-06-26
**Deciders:** Engineering Lead, DevOps Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires a deployment strategy that enables:

- Zero-downtime deployments (deployments during business hours cannot interrupt Nigerian brand teams monitoring for crises)
- Fast rollback (a bad deployment must be reversible in under 60 seconds)
- Production-like environment for smoke testing before cutover
- Support for high-risk changes (canary routing to a percentage of traffic)

### Decision

Use **blue-green deployment** as the standard deployment strategy, with **canary deployment** available for high-risk changes.

### Blue-Green Deployment Process

```
1. New Docker image built and tagged as "green"
2. Green deployed to staging environment via Coolify
3. Automated smoke tests run against staging (Playwright)
4. Database migrations applied (backward-compatible migrations run first)
5. Green deployed to production VPS (alongside existing "blue")
6. Health check passes on green (GET /api/health → 200 OK, <500ms)
7. Nginx upstream switched from blue → green (atomic operation, zero downtime)
8. Monitor error rate and P95 response time for 30 minutes
9. If clean: blue containers decommissioned
10. If issues within 30 min: nginx switched back to blue (rollback in <60 seconds)
```

### Canary Deployment Process (for high-risk changes)

```
1. Green deployed (steps 1–6 above)
2. Nginx: route 5% of traffic to green, 95% to blue
3. Monitor for 30 minutes
4. If clean: increase to 25%, then 50%, then 100%
5. If issues: route 100% back to blue immediately
```

### Alternatives Considered

| Alternative                        | Why Rejected                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Rolling deployment**             | Mixed versions serve traffic simultaneously; some requests see old behavior, some see new; harder to reason about; slower rollback      |
| **Recreate (stop old, start new)** | Downtime during deployment; unacceptable for a monitoring platform where crisis alerts must be continuously delivered                   |
| **Canary only**                    | Slower than blue-green for standard releases; adds complexity to every deployment; blue-green is simpler for routine changes            |
| **Feature flags only**             | Feature flags complement deployment strategies but cannot replace them; a badly deployed binary breaks all features regardless of flags |

### Consequences

**Positive:**

- Zero downtime for standard deployments
- Rollback in under 60 seconds (Nginx upstream switch is atomic)
- Smoke tests against green before any production traffic
- Crisis alerts are never interrupted by deployments
- Canary available for high-risk changes

**Negative:**

- Requires double the container resources during the deployment window (typically 30–60 minutes)
- Database migrations must be backward-compatible (old blue code must run against the new schema until cutover)
- Slight configuration complexity in Nginx upstream definitions

**Risk Mitigation:**

- Enforce backward-compatible migration rule: new columns must be `NULLABLE` with defaults; old columns removed only after 2 deployments; enum values only added, never removed in the same deployment
- Document migration guidelines in Engineering Standards
- Practice rollback procedure monthly (chaos engineering)

### Review Triggers

- Deployment frequency exceeds 5 times per day (at which point more automation is warranted)
- A multi-VPS setup requires a different load balancing strategy

### Related ADRs

- ADR-008: Self-Hosted VPS in Nigeria Behind WireGuard VPN

---

## 17. ADR-013: WebSockets for Real-Time Features

**Status:** ✅ Accepted
**Date:** 2026-06-27
**Deciders:** Engineering Lead, Senior Engineers
**Last Reviewed:** 2026-07-21

### Context

The platform requires real-time data delivery for several critical features:

- **Crisis alerts:** When a Severity 3+ crisis is detected, connected users must receive notification within seconds — not on their next page refresh
- **Live monitoring feed:** New media mentions appear in the monitoring dashboard in real time
- **Inbox notifications:** New messages appear in the engagement inbox immediately
- **Publishing status:** Users see whether their scheduled post succeeded or failed in real time
- **Dashboard metric refresh:** Executive dashboards update without requiring manual refresh

### Decision

Use **native WebSockets** via Hono's WebSocket handler for all real-time server-to-client event delivery.

### WebSocket Architecture

```
Client connects to WSS endpoint (authenticated via JWT in handshake query param)
    ↓
Hono WebSocket handler validates JWT, extracts organization_id
    ↓
Client subscribed to organization-scoped channel
    ↓
Services layer emits events via EventEmitter when state changes
    ↓
WebSocket handler listens for events matching client's organization_id
    ↓
Event serialized as JSON and pushed to client's WebSocket connection
    ↓
Client receives event and updates UI (React state update via TanStack Query invalidation)
```

**Event Schema:**

```typescript
type WebSocketEvent =
  | {
      type: "crisis:alert";
      data: {
        incidentId: string;
        severity: 1 | 2 | 3 | 4 | 5;
        title: string;
        reach: number;
      };
    }
  | {
      type: "mention:new";
      data: {
        mentionId: string;
        sentiment: "positive" | "neutral" | "negative";
        source: string;
      };
    }
  | {
      type: "inbox:message";
      data: {
        conversationId: string;
        priority: "critical" | "high" | "medium" | "low";
      };
    }
  | {
      type: "publish:status";
      data: {
        postId: string;
        platform: string;
        status: "success" | "failed";
        error?: string;
      };
    }
  | {
      type: "metrics:update";
      data: { orgId: string; kpis: Record<string, number> };
    };
```

### Alternatives Considered

| Alternative                    | Why Rejected                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-Sent Events (SSE)**   | One-way only (server → client); cannot send client events to the server; adequate for push-only use cases but restricts future bidirectional features |
| **Long polling**               | Legacy pattern; high server resource usage (a connection held open waiting for data); significant latency compared to WebSockets                      |
| **Pusher / Ably**              | Third-party services; real-time event data passes through external servers (data sovereignty concern); additional monthly cost; external dependency   |
| **GraphQL Subscriptions**      | Adds an entire GraphQL layer for one feature; overkill; requires GraphQL client on mobile                                                             |
| **Polling (client-initiated)** | High latency; high server load; not "real-time"; crisis alerts delivered up to 30 seconds late                                                        |

### Consequences

**Positive:**

- True real-time delivery (sub-second) for crisis alerts
- Low server resource overhead per persistent connection
- Bidirectional (future features can send client data to server)
- No third-party service (data sovereignty preserved)
- Native Hono support — no additional library

**Negative:**

- Persistent connections consume server file descriptors (Linux default: 1024 per process; requires `ulimit` tuning for >10,000 connections)
- WebSocket connections must handle reconnection on network interruption (client-side exponential backoff)
- Debugging WebSocket issues is harder than HTTP request/response
- Cannot be cached or served by CDN

**Risk Mitigation:**

- Tune Linux `ulimit` on the VPS (`nofile` = 65536)
- Implement exponential backoff reconnection with jitter on the client
- Add WebSocket connection count to monitoring metrics
- Graceful reconnection on server restart (Coolify blue-green handles this)

### Review Triggers

- Concurrent WebSocket connections exceed 50,000 (at which point a dedicated WebSocket service or Pub/Sub infrastructure is needed)
- A real-time feature requires guaranteed delivery (WebSockets are not guaranteed; would need Kafka or Redis Streams)

### Related ADRs

- ADR-002: TanStack Start + Hono (Hono provides the WebSocket handler)

---

## 18. ADR-014: RESTful API Design Standards

**Status:** ✅ Accepted
**Date:** 2026-06-28
**Deciders:** Engineering Lead, Product Lead
**Last Reviewed:** 2026-07-21

### Context

The Hono API must be usable by three distinct consumers: the Nawebeus mobile app, external webhook senders (Paystack, social platforms), and future third-party integrations. Consistent API design reduces the cognitive load for all consumers and makes the API maintainable as it grows.

### Decision

Adopt RESTful API design standards as defined below. These standards apply to all Hono API routes.

### Standards

**URL Design:**

| Standard         | Rule             | Example                                          |
| ---------------- | ---------------- | ------------------------------------------------ |
| Resource names   | Plural nouns     | `/api/posts`, `/api/journalists`, `/api/reports` |
| URL casing       | kebab-case       | `/api/press-releases`, `/api/media-mentions`     |
| Nesting depth    | Maximum 2 levels | `/api/organizations/{id}/members`                |
| Query parameters | camelCase        | `?sortBy=createdAt&filterBy=negative`            |

**HTTP Methods:**

| Method   | Semantics                | Idempotent |
| -------- | ------------------------ | ---------- |
| `GET`    | Read (never mutate)      | ✅ Yes     |
| `POST`   | Create or trigger action | ❌ No      |
| `PUT`    | Replace entire resource  | ✅ Yes     |
| `PATCH`  | Partial update           | ✅ Yes     |
| `DELETE` | Remove resource          | ✅ Yes     |

**HTTP Status Codes:**

| Scenario                   | Code                              |
| -------------------------- | --------------------------------- |
| Successful read            | 200 OK                            |
| Resource created           | 201 Created (+ `Location` header) |
| Accepted async             | 202 Accepted                      |
| Successful delete, no body | 204 No Content                    |
| Validation failure         | 422 Unprocessable Entity          |
| No token / invalid token   | 401 Unauthorized                  |
| Valid token, no permission | 403 Forbidden                     |
| Not found                  | 404 Not Found                     |
| Duplicate / conflict       | 409 Conflict                      |
| Rate limited               | 429 Too Many Requests             |
| Server error               | 500 Internal Server Error         |
| Maintenance                | 503 Service Unavailable           |

**Response Envelopes:**

```json
// Success
{
  "success": true,
  "data": { },
  "meta": { "timestamp": "2026-07-21T10:30:00.000Z", "request_id": "req_abc123" }
}

// Success with pagination
{
  "success": true,
  "data": [ ],
  "pagination": { "cursor": "eyJpZCI6...", "has_more": true, "total_count": 247 },
  "meta": { "timestamp": "2026-07-21T10:30:00.000Z", "request_id": "req_abc123" }
}

// Error
{
  "success": false,
  "error": { "code": "RESOURCE_NOT_FOUND", "message": "Journalist not found.", "details": { "journalist_id": "jrn_8d2a5f" } },
  "meta": { "timestamp": "2026-07-21T10:30:00.000Z", "request_id": "req_abc123" }
}
```

**Pagination:** Cursor-based only (never offset-based). Cursor is an opaque base64-encoded JSON object. Default page size: 20. Maximum: 100.

**Versioning:** Breaking changes require a new URL prefix (`/api/v2/`). Previous version supported for 6 months after deprecation announcement. Deprecated endpoints return `Deprecation: true` and `Sunset: {date}` headers.

### Alternatives Considered

| Alternative           | Why Rejected                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GraphQL**           | Excellent for complex data fetching, but: adds a full GraphQL schema and resolver layer; caching is harder; mobile clients must use a GraphQL client; webhook senders cannot use GraphQL; operational complexity for limited benefit at MVP scale |
| **gRPC**              | Excellent performance and type safety, but: not browser-friendly without gRPC-Web proxy; complex tooling; requires Protobuf schema maintenance; not suitable for the mobile HTTP client pattern                                                   |
| **tRPC**              | Type-safe and ergonomic for TypeScript-to-TypeScript communication, but: requires a tRPC-aware client; webhook senders and non-TypeScript clients cannot use it; limits the future public API                                                     |
| **Offset pagination** | Simpler to implement, but: results are inconsistent when data is inserted/deleted between pages; performance degrades at large page numbers; cursor-based is industry standard for feeds                                                          |

### Consequences

**Positive:**

- Consistent API behavior across all endpoints
- Standard HTTP makes any HTTP client compatible
- Cursor pagination is correct and performant at scale
- OpenAPI spec generation is straightforward
- Postman/Insomnia collections map 1:1 to API design

**Negative:**

- REST can produce "chatty" APIs for complex data requirements
- Versioning adds URL complexity when breaking changes are needed
- Enforcing standards requires code review discipline

**Risk Mitigation:**

- Generate OpenAPI spec from Hono routes using `@hono/zod-openapi`
- Lint API route patterns in CI (custom ESLint rule or Hono middleware test)
- Provide composite endpoints for the most common "chatty" patterns

### Related ADRs

- ADR-002: TanStack Start + Hono (Hono implements these standards)

---

## 19. ADR-015: Cache and Rate Limit Patterns

**Status:** ✅ Accepted
**Date:** 2026-06-29
**Deciders:** Engineering Lead
**Last Reviewed:** 2026-07-21

### Context

The platform requires standardized patterns for caching and rate limiting. Without documented patterns, engineers make inconsistent decisions: different TTLs for similar data, different key formats, inconsistent rate limit limits per endpoint. This creates unpredictable behavior and makes performance optimization difficult.

### Decision

Adopt the cache and rate limit patterns documented below as mandatory conventions for all new code.

### Cache Patterns

**Key Format:**

```
{resource_type}:{primary_id}[:{sub_resource}[:{variant}]]

Examples:
permissions:usr_9f2a        → CASL abilities for user (5min TTL)
org:settings:org_7e3b       → Organization config (15min TTL)
mention:feed:org_7e3b:page1 → Mention feed page (2min TTL)
crisis:active:org_7e3b      → Active crisis data (30sec TTL)
sov:org_7e3b:7d             → Share of voice, 7-day period (30min TTL)
```

**Read Protocol:**

```typescript
async function getCachedOrQuery<T>(
  key: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>,
  tags?: string[],
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached; // cache hit

  const result = await queryFn(); // cache miss → query database
  await cache.set(key, result, ttlSeconds, tags);
  return result;
}
```

**Invalidation Protocol:**

```typescript
// On write: invalidate specific key
await cache.delete(`org:settings:${orgId}`);

// On bulk change: invalidate by tag
await cache.invalidateByTag(`org:${orgId}`);

// Write-through (high-read, low-write data):
await db.update(organizations).set(data).where(eq(organizations.id, orgId));
await cache.set(`org:settings:${orgId}`, updatedOrg, 900);
```

### Rate Limit Patterns

**Key Format:**

```
ratelimit:{endpoint_slug}:{user_id_or_ip}
```

**Default Limits by Endpoint Category:**

| Category                 | Per Minute       | Per Hour          | Burst (temporary over-limit) |
| ------------------------ | ---------------- | ----------------- | ---------------------------- |
| Auth (login, signup)     | 5 per IP         | 20 per IP         | None                         |
| API reads                | 100 per user     | 2,000 per user    | 20 requests                  |
| API writes               | 50 per user      | 500 per user      | 10 requests                  |
| Content publishing       | 30 per user      | 200 per user      | None                         |
| Report generation        | 10 per user      | 50 per user       | None                         |
| Crisis operations        | 200 per user     | 2,000 per user    | 50 requests (time-critical)  |
| Webhook endpoints        | 1,000 per source | 10,000 per source | 200 requests                 |
| Public (unauthenticated) | 10 per IP        | 100 per IP        | None                         |

**Response on limit exceeded (HTTP 429):**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after the specified time.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2026-07-21T10:31:00Z",
      "retry_after_seconds": 47
    }
  }
}
```

### Consequences

**Positive:**

- Consistent cache key naming makes debugging and invalidation predictable
- Standardized rate limits prevent abuse without over-restricting legitimate users
- Pattern documentation speeds onboarding for new engineers
- Sliding-window algorithm is more accurate than fixed-window for burst detection

**Negative:**

- Requires discipline to follow the key format convention
- TTL values are hard-coded in the service layer; changing them requires code changes

**Risk Mitigation:**

- Add a cache key linting utility that validates key format at startup in development
- Define TTL constants in a shared `cache-ttls.ts` file; never hard-code TTL numbers

### Related ADRs

- ADR-004: SQLite for Cache and Rate Limiting

---

## 20. ADR-016: Typed Error Hierarchy and Handling Patterns

**Status:** ✅ Accepted
**Date:** 2026-06-30
**Deciders:** Engineering Lead, Senior Engineers
**Last Reviewed:** 2026-07-21

### Context

Without a standard error hierarchy, engineers make inconsistent decisions: throwing strings, throwing generic `Error` objects, returning `null` for not-found cases, or letting database errors propagate to the HTTP response. This makes the API behavior unpredictable, leaks internal details to clients, and makes debugging difficult.

### Decision

Adopt a typed error hierarchy for all service layer errors. Every service method either returns a typed success value or throws a typed error from the hierarchy below.

### Error Hierarchy

```typescript
// Base class (never thrown directly)
class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Validation errors (user input problems)
class ValidationError extends AppError {}
class InvalidInputError extends ValidationError {}
class MissingRequiredFieldError extends ValidationError {}
class SchemaFormatError extends ValidationError {}

// Authentication errors (identity problems)
class AuthenticationError extends AppError {}
class InvalidTokenError extends AuthenticationError {}
class ExpiredTokenError extends AuthenticationError {}
class InvalidCredentialsError extends AuthenticationError {}

// Authorization errors (permission problems)
class AuthorizationError extends AppError {}
class InsufficientPermissionError extends AuthorizationError {}
class ResourceAccessError extends AuthorizationError {} // cross-tenant access attempt
class RoleRequiredError extends AuthorizationError {}

// Business errors (domain rule violations)
class BusinessError extends AppError {}
class DuplicateEntryError extends BusinessError {}
class ResourceNotFoundError extends BusinessError {}
class ResourceStateError extends BusinessError {} // invalid state transition
class ConstraintViolationError extends BusinessError {}

// Rate limit errors
class RateLimitError extends AppError {}
class LimitExceededError extends RateLimitError {}
class BlockedError extends RateLimitError {}

// System errors (infrastructure problems)
class SystemError extends AppError {}
class DatabaseError extends SystemError {}
class CacheError extends SystemError {}
class StorageError extends SystemError {}
class ExternalServiceError extends SystemError {} // Paystack, social APIs, etc.
```

### Layer Responsibilities

| Layer                    | Responsibility                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service layer**        | Throws typed errors with context; logs with correlation IDs; never throws raw database errors                                                   |
| **Hono API layer**       | Catches typed errors; maps to HTTP status codes; formats standard error response; logs at `warn` or `error` level; NEVER leaks internal details |
| **TanStack Start layer** | Catches Server Function errors; displays user-friendly messages; logs with stack traces in development                                          |

### HTTP Status Code Mapping

| Error Class             | HTTP Status               |
| ----------------------- | ------------------------- |
| `ValidationError`       | 422 Unprocessable Entity  |
| `AuthenticationError`   | 401 Unauthorized          |
| `AuthorizationError`    | 403 Forbidden             |
| `ResourceNotFoundError` | 404 Not Found             |
| `DuplicateEntryError`   | 409 Conflict              |
| `ResourceStateError`    | 409 Conflict              |
| `RateLimitError`        | 429 Too Many Requests     |
| `SystemError` (all)     | 500 Internal Server Error |
| Unhandled / unknown     | 500 Internal Server Error |

### What Is Never Leaked to Clients

- Database error messages (PostgreSQL error text)
- Stack traces
- Internal file paths
- Environment variable names
- Other tenants' data or IDs
- Paystack API keys or webhook secrets
- JWT signing secrets

### Consequences

**Positive:**

- Predictable error behavior across all API endpoints
- No internal details leaked to clients
- Debuggable with correlation IDs and structured logs
- Unit-testable error conditions (catch typed error, assert code)
- New engineers can follow the hierarchy without guessing

**Negative:**

- More boilerplate than throwing generic errors
- Requires consistent discipline across all service methods
- `try/catch` blocks must be structured carefully to catch the right error types

**Risk Mitigation:**

- Add a global Hono error handler that catches all untyped errors, logs them as `SystemError`, and returns a safe 500 response
- ESLint rule to warn when `throw new Error()` (untyped) appears in `services/`

### Related ADRs

- ADR-009: Architecture Principles (error handling is a cross-cutting concern)

---

## 21. ADR-017: Domain Disambiguation of "Campaign"

**Status:** ✅ Accepted
**Date:** 2026-08-02
**Deciders:** Engineering Lead, Product Lead
**Last Reviewed:** 2026-08-02

### Context

The codebase overloaded the single term **Campaign** across three genuinely distinct business concepts. This produced a ubiquitous-language collision: a reader could not tell which sense of "campaign" a table, enum, column, or variable referred to, and the risk of cross-contaminating data or logic between them was high. The three concepts are:

1. **Campaign** — a timebound consumer-participation promotional activity (giveaway, contest, referral, UGC, sweepstakes) tracked against engagement KPIs. Lives in the "Growth & Giveaways" module.
2. **Initiative** — a timebound PR strategic effort with objectives, risks, stakeholders, and ROI measurement (press release → distribution → coverage attribution → AVE). Lives in the "Media Relations & PR" module.
3. **Program** — a structured influencer effort coordinating paid partnerships across one or more creators (creative briefs, content submissions, performance tracking, installment payments). Lives in the "Influencer Management" module.

A polymorphic approach (one generic concept with feature-discriminating subtypes) was considered and rejected — the three have different lifecycles, data shapes, permissions, and KPIs, and conflating them would force every discriminating branch downstream.

### Decision

Split the overloaded term into three named concepts and rename the schema and interfaces to match:

- **Campaign** keeps its name and the `campaigns` / `campaign_entries` schema in the giveaway module.
- **Initiative** replaces "PR campaign": `pr_campaigns` → `pr_initiatives`.
- **Program** replaces "influencer campaign": `influencer_campaigns` → `influencer_programs` (child `influencer_program_assignments`).

Scope of rename: DB table names and enum type names ARE renamed; individual **column name strings are intentionally kept** (e.g. `campaign_objectives`, `campaign_risks`, `campaign_type`, `campaign_id`, `campaign_count`, `utm_campaign`) while their **TypeScript identifiers are renamed** (`initiativeObjectives`, `initiativeRisks`, `programType`, `programId`, `programCount`). `utm_campaign` is retained in both forms as it is an industry-standard URL parameter, not a domain object. The polymorphic `campaign_id` shared pointer is also retained.

The five database migration operations are:
1. `ALTER TABLE pr_campaigns RENAME TO pr_initiatives`
2. `ALTER TYPE pr_campaign_status RENAME TO pr_initiative_status`
3. `ALTER TABLE influencer_campaigns RENAME TO influencer_programs`
4. `ALTER TYPE influencer_campaign_status RENAME TO influencer_program_status`
5. `ALTER TYPE influencer_campaign_type RENAME TO influencer_program_type`

(Implementation in the schema layer is applied and typechecked; the SQL migration itself is generated separately.)

### Rationale

- **Ubiquitous language**: the three concepts have distinct definitions in CONTEXT.md, distinct modules, distinct permissions, and distinct KPIs.
- **Readability and safety**: unambiguous names prevent accidental cross-usage and make the domains navigable by both humans and AI.
- **Bounded blast radius**: renaming table and type names (exposed in SQL) while leaving column strings and the polymorphic pointer intact limits migration and integration churn without sacrificing clarity at the level that matters.

### Alternatives Considered

| Alternative | Why Rejected |
| ----------- | ------------ |
| **Keep one `campaigns` table with a `kind`/`type` discriminator** | The three have different lifecycles, KPIs, permissions, and field sets; forces polymorphic conditionals ("Repeated Switches") throughout the app |
| **Rename only the UI, not the schema** | Readability gains were lost where it matters most — schema, code, migrations, and SQL; inconsistency between docs/UI and DB |
| **Rename everything including column strings** | Larger, riskier migration with no added clarity benefit; `utm_campaign` and the polymorphic `campaign_id` are shared/standard and should stay |
| **"PR activation" / "influencer activation"** | "Activation" is too tactical and fails to describe the strategic scope of either initiative or program |

### Consequences

**Positive:**

- Unambiguous domain vocabulary fixed in `CONTEXT.md` and mirrored by the codebase
- Schema, relations, and identifiers now communicate intent
- Future modules (an influencer Program and PR Initiative) can evolve independently

**Negative:**

- A focused schema + enum migration is required (5 operations), and deploy requires careful sequencing with the column-string/`utm_campaign` exemptions to remain consistent
- Some internal constraint/index names and the shared `campaign_id` pointer retain the old `campaign` prefix as a deliberate trade-off

**Risk Mitigation:**

- Migration sequenced and reviewed; column strings and the `utm_campaign`/`campaign_id` exemptions documented so future engineers do not "fix" them
- `code-review`'s two axes (Standards + Spec) both checked against the "Product decisions" of CONTEXT.md

### Review Triggers

- A genuine fourth quasi-promotional concept is introduced (e.g. an "activation") and its name risks re-overloading an existing one
- A decision to rename the retained column strings or the `utm_campaign` exemption

### Related ADRs

- ADR-009: Multi-Tenant Architecture with Row-Level Security (schema is the isolation boundary)
- ADR-005: Drizzle ORM as the Database ORM (schema-as-code; renaming is done in TS + migration)

---

## 22. ADR-028: Queue, Scheduler, and Worker Runtime

**Status:** ✅ Accepted
**Date:** 2026-09-13
**Deciders:** Engineering Lead
**Last Reviewed:** 2026-09-13

### Context

Every module from P2 onward depends on scheduled or background work: publishing dispatch,
publish retry and reconciliation, article ingestion, NLP enrichment, share-of-voice
computation, SLA monitoring and escalation, notification digests, retention enforcement,
dunning, and analytics aggregation.

No such runtime exists. `src/lib/` contains nothing of the kind, and — verified on
2026-09-13 — **no prior decision covers it**: `docs/technical/ADRs.md` and
`docs/business/Decision Log.md` contain no queue, scheduler, worker, or cron decision.
`docs/Foundation Phase.md` Phase 14 requires one. This is decision **D5** of the
Implementation Execution Plan, and it is a hard blocker on all of P1.

Constraints imposed by decisions already accepted:

| Constraint | Source |
| --- | --- |
| PostgreSQL is the primary database | ADR-003 |
| Single deployable service with two entry points | ADR-007 |
| Self-hosted VPS in Nigeria behind WireGuard VPN | ADR-008 |
| Nigerian data processed and stored within Nigeria | ADR-000 principle 9, ADR-008 |
| Bun is the runtime | ADR-001 |
| Every worker must be idempotent | Execution plan ground rule 4 |

### Decision

Adopt **`pg-boss`** as the queue, scheduler, and worker runtime, backed by the existing
PostgreSQL instance.

The scheduler and workers start from `src/index.ts` alongside the API server, per ADR-007.
They must be structured so that running them as a separate process requires configuration
only — no code change — so that ADR-007 can be revisited without a rewrite.

### Rationale

- **No new infrastructure.** pg-boss stores jobs in PostgreSQL, which ADR-003 already
  provides and ADR-008 already operates. Redis/BullMQ would add a service to run, secure,
  monitor, and back up on a single self-hosted VPS.
- **Consistent with ADR-007.** No third process to deploy or orchestrate.
- **Transactional enqueue.** A job can be enqueued in the same database transaction as the
  business write, so a rolled-back write cannot leave an orphaned job behind. This is what
  makes "every worker is idempotent" achievable rather than aspirational.
- **Cron scheduling is built in**, satisfying NWB-P1-001's cron/interval requirement without
  a second mechanism.
- **Queue depth is queryable**, so the P15-004 alerting requirement ("queue failures
  alerted") becomes a query rather than an integration.

### Alternatives Considered

| Alternative | Reason Rejected |
| --- | --- |
| **BullMQ + Redis** | Adds a service to operate and back up on a self-hosted VPS (ADR-008) for no capability pg-boss lacks at MVP scale. Becomes the better option only if D3 moves the cache to Redis. |
| **`Bun.cron` alone** | A trigger, not a queue — no persistence, retry, backoff, or job state. Cannot satisfy NWB-P1-001's retry-with-backoff and idempotency requirements. |
| **In-process `setTimeout` / `setInterval`** | Jobs are lost on restart or deploy, and there is no visibility into failures or depth. |
| **Cloud queue (SQS, Cloudflare Queues)** | Adds a cross-border data processor, which ADR-000 principle 9 and ADR-008 prohibit without an NDPR review. |
| **Hand-rolled job table** | Reinvents persistence, retry, backoff, locking, and archiving — precisely what ground rule 8 ("do not build a second implementation of anything that exists") forbids. |

### Consequences

**Positive**

- No new infrastructure; one datastore for both jobs and business data.
- Job enqueue participates in the caller's transaction.
- Queue depth and failure history are plain SQL, available to analytics and alerting.
- Cron scheduling and retry/backoff come from the library rather than from us.

**Negative / mitigations**

- Job tables share a database with tenant data and must be excluded from tenant-scoped
  queries and from RLS policies once D11 is settled. Mitigation: pg-boss uses its own
  schema; keep it out of `db/schema.ts` and out of tenant-scoped query builders.
- pg-boss manages its own schema, so its migrations must be versioned alongside ours.
  Mitigation: NWB-P0-005 must cover the pg-boss schema, not just `db/`.
- Postgres-backed queues have a throughput ceiling. Accepted at MVP scale.

### Review Triggers

- Sustained queue depth that PostgreSQL cannot drain within the SLA window.
- D3 resolves in favour of Redis, making BullMQ cheap.
- ADR-007 is superseded and the API can scale independently of workers.
- `pg-boss` is abandoned or drops PostgreSQL support.

### Related ADRs

ADR-001 (Bun runtime) · ADR-003 (PostgreSQL) · ADR-007 (single deployable service) ·
ADR-008 (self-hosted VPS) · ADR-009 (multi-tenancy / RLS) · ADR-015 (cache and rate limits)

---

## 23. Future ADRs (Planned)

| ADR     | Title                                        | Planned Date       | Trigger                                                 |
| ------- | -------------------------------------------- | ------------------ | ------------------------------------------------------- |
| ADR-018 | Redis migration from SQLite cache            | Q2 2027            | Second application instance added                       |
| ADR-019 | Elasticsearch for advanced search            | Q3 2027            | Media mention volume exceeds 50M rows                   |
| ADR-020 | Kubernetes for container orchestration       | Year 3             | Docker Compose insufficient for scale                   |
| ADR-021 | OpenTelemetry for distributed tracing        | Q1 2027            | Debug complexity increases with team size               |
| ADR-022 | Managed PostgreSQL evaluation                | Q4 2027            | Self-hosting operational burden exceeds 1 engineer-day/week |
| ADR-023 | Public developer API release                 | Q4 2026 (decision) | Third-party integration demand from customers           |
| ADR-024 | Multi-region deployment strategy             | Year 3             | Expansion to East or South Africa                       |
| ADR-025 | AI/ML model hosting strategy                  | Q4 2026            | Sentiment analysis and crisis detection model deployment |
| ADR-026 | WhatsApp Business API as first-class channel | Q1 2027            | Customer demand for WhatsApp monitoring and alerting    |
| ADR-027 | Read replica strategy                        | Q3 2027            | Read-heavy analytics queries impact write performance   |

---

## 24. ADR Governance

### When to Write an ADR

Write an ADR when:

- The decision significantly affects system architecture, security posture, or scalability
- The decision is difficult or expensive to reverse
- The decision involves meaningful trade-offs between alternatives
- Future engineers will want to understand why the decision was made
- The decision has long-term cost implications in ₦ (infrastructure, tooling, licensing)

Do **not** write an ADR for:

- Minor implementation details or library utility selection
- Decisions that are trivially reversible
- Standard coding practices already documented in Engineering Standards
- Decisions with no meaningful alternatives

### ADR Lifecycle

| Status                    | Meaning                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Proposed**              | Draft under discussion; not yet in effect                                     |
| **Accepted**              | Decision ratified and in effect                                               |
| **Deprecated**            | Still in effect but no longer recommended for new code; migration path exists |
| **Superseded by ADR-XXX** | Replaced by a newer decision; the superseding ADR explains the change         |

### ADR Review Cadence

| Review Type                                                                      | Frequency |
| -------------------------------------------------------------------------------- | --------- |
| **Index review** (are all current decisions documented?)                         | Quarterly |
| **Consequence review** (did predicted consequences materialize?)                 | Quarterly |
| **Trigger review** (have any review triggers been met?)                          | Monthly   |
| **New context review** (does a major market or technology change affect an ADR?) | As needed |

---

## 25. Document Approvals

| Role             | Name                       | Signature      | Date       |
| ---------------- | -------------------------- | -------------- | ---------- |
| Engineering Lead | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| CTO              | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Product Lead     | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| Security Lead    | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |
| DevOps Lead      | **\*\*\*\***\_**\*\*\*\*** | \***\*\_\*\*** | **\_\_\_** |

---

## 26. Related Documents

| Document                   | Relationship                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Architecture**           | Implements the decisions made in these ADRs                                        |
| **Tech Stack**             | Quick-reference summary of technology choices documented in these ADRs             |
| **Engineering Standards**  | Coding conventions that enforce the patterns decided in these ADRs                 |
| **Database Schema**        | Implements the multi-tenancy and RLS decisions from ADR-003 and ADR-009            |
| **Security Policy**        | Implements the authentication and authorization decisions from ADR-010 and ADR-006 |
| **Infrastructure Runbook** | Implements the hosting and deployment decisions from ADR-008 and ADR-012           |

---

## Document Version History

| Version | Date       | Author           | Changes                                                                                 |
| ------- | ---------- | ---------------- | --------------------------------------------------------------------------------------- |
| 1.1     | 2026-09-13 | Engineering Lead | Added ADR-028 (queue, scheduler, and worker runtime — resolves D5). Renumbered sections 22–24 → 24–26 to make room and added a numbering note for the reserved ADR-018…027 slots. Removed an off-domain "Money Handling Convention" section that described a different product, and restored this table's header, which that section had corrupted. |

