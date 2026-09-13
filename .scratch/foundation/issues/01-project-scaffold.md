# 01 — Project scaffold + config + DB + error framework

**What to build:** The foundational `src/` directory structure and wiring that everything else plugs into. This includes the Hono app with a health-check endpoint, typed environment configuration, the Drizzle database client wired to PostgreSQL, migration scripts, the typed error hierarchy, JSON response envelope, and the global error handler middleware. After this ticket, a developer can boot the server, confirm it's healthy, run a migration, and get consistent JSON error responses from any route.

**Blocked by:** None — can start immediately

**Status:** done

- [x] `src/` directory structure created (server/, services/, lib/, app/, tests/)
- [x] Hono app boots and serves `GET /api/health` → `{"status":"ok"}`
- [x] Config loader reads `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, `CORS_ORIGIN` from env vars, validated with Zod, exported as typed object
- [x] `src/lib/db.ts` creates and exports Drizzle client connected via `pg` pool using config
- [x] `npm run migrate` script runs `drizzle-kit push` against the configured database
- [x] Typed error hierarchy exists: `AppError` → `AuthError | ValidationError | NotFoundError | ConflictError | RateLimitError | InternalError`
- [x] JSON response envelope helpers: `success(data, meta?)`, `error(code, message, details?)`
- [x] Global Hono error handler catches all `AppError` subclasses and returns correct HTTP status + JSON error envelope; unknown errors return 500 with no detail leak
- [x] `tsconfig.json` paths updated to include `@/*` → `./src/*`
- [x] `.env.example` created with all required vars
- [x] Integration test: `GET /api/health` returns 200 with expected shape
- [x] Integration test: hitting a non-existent route returns 404 with error envelope
- [x] Integration test: route that throws an `AppError` returns correct status + envelope
