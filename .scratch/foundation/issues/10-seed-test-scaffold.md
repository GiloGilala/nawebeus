# 10 — Seed script + test scaffold

**What to build:** The bootstrap data and test infrastructure that every subsequent ticket and feature depends on. A seed script creates a super-admin user, a default organization, and the standard role/permission set. Test helpers provide a disposable database client, factory functions for test entities, and a wrapped Hono app for in-process API testing. After this ticket, any developer can run `npm run seed` and have a working admin account, and any feature spec can write integration tests using the standard scaffold.

**Blocked by:** 01 — Project scaffold + config + DB + error framework

**Status:** done

- [x] `npm run seed` script: applies migrations, then inserts bootstrap data
- [x] Bootstrap organization created (name from config or default)
- [x] Super-admin user created with email/password from env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`)
- [x] Default roles created: `super_admin`, `org_admin`, `member`, `viewer`
- [x] Default permissions mapped to each role (pulled from `permissions` table)
- [x] Seed is idempotent: running it twice does not create duplicate data (upserts based on email/key)
- [x] Test database helper: creates test DB connection, wraps each test in a transaction that rolls back
- [x] Test factory: `createTestUser(overrides?)`, `createTestOrg(overrides?)`, `createTestMember(overrides?)`, etc.
- [x] Test client helper: `testClient()` returns a Hono app fetch wrapper — no HTTP server needed
- [x] Integration test: seed completes without error
- [x] Integration test: bootstrap user can sign in with configured credentials
- [x] Integration test: test factory produces valid entities that pass DB constraints
