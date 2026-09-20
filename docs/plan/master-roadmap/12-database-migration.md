# Master Roadmap — Database & Data Migration Plan (§21)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 21. Database & data migration plan

**Current state:** 28 active tables (3 modules); 54 aspirational tables (10 modules); no migration history; `db:push` non-idempotent (NWB-P0-009); one dormant manual SQL (ADR-017); pg-boss will add its own library-managed schema (Phase 2).

**Rules (standing):**
1. **Forward-only, expansion-then-contraction.** A column/table is added in one migration and used from the next release; removal happens in a later migration after the consuming code is gone. No in-place breaking changes. (Pre-prod today makes this cheap, but the discipline must start now because Phase 8 must prove a clean-DB path.)
2. Every schema change = Drizzle schema edit → `db:generate` → migration in `drizzle/migrations/` → CI runs `db:migrate` from zero → integration tests. (After NWB-P0-005.)
3. **Aspirational module adoption** (ground rule 7): review tables vs module spec → add exports to `db/schema.ts` → remove from `tsconfig` excludes → `db:generate` → constraint tests for the new tables (tenant predicate, unique constraints, enum domains) → tests.
4. Tenant isolation: every new multi-tenant table carries `organization_id` + index; the NWB-P0-018 invariant test and QA §6.3 isolation suite extend automatically (table list driven from `db/schema.ts`).
5. Backfills: none required pre-production (no production data exists). For any future backfill: read-only phase → write phase → verify counts → keep old path one release.

**Migration ordering (Phase 1 → Phase 6):**

| # | Migration | Why | Depends | Backward-compat | Data migration | Verification | Rollback |
|---|---|---|---|---|---|---|---|
| M0 (NWB-P0-005) | Baseline 0000: 28 active tables (with 81 `notNull` PK corrections) | reproducible schema | — | n/a (first) | none | fresh-DB migrate + suite; re-migrate no-op | none (pre-prod: drop/recreate) |
| M1 (P1) | pg-boss schema bootstrap recorded (library-managed; `pgBoss.start()` idempotent at boot) | ADR-028 | M0 | yes | none | boot twice; job enqueued+run | stop worker; tables inert |
| M2 (P2) | social-accounts adoption (4 tbls) + token-encryption column if review demands | Module 3 | M0 | yes | none | module tests | deactivate module (rows inert) |
| M3 (P4) | monitoring adoption (6 tbls) | Modules 5/6 | M2 (webhooks? no — independent) | yes | none | module tests | as above |
| M4 (P7) | engagement adoption (6 tbls) | Module 7 | M2 | yes | none | module tests | as above |
| M5 (P11) | campaigns adoption (3 tbls) | Module 4 | M1 (queue) | yes | none | module tests | as above |
| M6 (P12) | analytics aggregate tables (new, alongside active `analytics*`) | Module 8 | M3–M5 | yes | none | aggregation idempotency tests | drop-only if pre-data |
| M7 (P13) | billing adoption (6 tbls) | monetization | M1 | yes | none | webhook idempotency + money tests | as above |
| M8 (B/C only) | publishing (2), pr (10, incl. ADR-017 renames folded), influencer (5, incl. renames), commerce (5) | D12 domains | M1–M5 | yes | none (renames are within the same adoption — tables are new) | module tests | as above |

**Constraints/indexes/FKs:** inherited from Drizzle definitions; adoption review must verify: `organization_id` indexed on every tenant table; FK `onDelete` policies match lifecycle (e.g., member removal cascades); unique constraints (email, slugs, tokens) are partial where soft-delete exists (`WHERE deleted_at IS NULL` pattern already used in `db/core`).
**Seed data:** idempotent `src/seed.ts` (Phase 1 changes: D13 role set; DSAR/bootstrap org unchanged). Seeds run after migrations in CI and are idempotent in dev.
**Obsolete structures:** `db/manual-migrations/campaign-domain-disambiguation.sql` — delete after M8 folds the renames (evidence + strategy per §29). No other obsolete structures in the active schema.

---

