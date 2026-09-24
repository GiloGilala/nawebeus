# NWB-P1-009 — Feature flags + system config (`evaluateFlag`, `getConfigValue`, audited writes)

Type: task
Status: done (2026-09-22 — implemented, validated, and tested with 32 dedicated tests and 0 regressions)
Blocked by: none
Phase: P1 (roadmap Phase 2)
Size: M

## Why this exists

Dynamic runtime behavior across all modules depends on system configuration and feature flags:
- Runtime feature flags gate dark launches and beta features (P5–P12) without redeployments.
- Org-level overrides allow tiered feature access, custom limits, and phased rollouts.
- System config controls global rate limits, timeout thresholds, integration URLs, and billing limits.
- Audited config writes with mandatory change reason and previous value tracking ensure compliance (SOC 2, ISO 27001).
- Feature flag kill-switches provide instant emergency disabling of problematic services or integrations.

Before this ticket:
- `db/compliance/index.ts` contained a dormant `app_config` table definition that was not re-exported in `db/schema.ts` and thus never migrated.
- Columns `id`, `organization_id`, `created_by`, and `updated_by` were `varchar(32)`, conflicting with 36-character UUIDs and standard ID patterns.
- No service layer, caching, validation schemas, HTTP routes, server functions, or audit events existed.

## Measured (2026-09-22)

1. **`varchar(32)` ID column widening & Adoption:**
   - Widened `id`, `organization_id`, `created_by`, `updated_by` to `varchar(64)`.
   - Re-exported `appConfig` and `appConfigRelations` in `db/schema.ts`.
   - Generated migration `0008_app_config.sql` and applied to PostgreSQL.
   - Added partial unique indexes for global flags (`organization_id IS NULL`) and global configs (`organization_id IS NULL`).
2. **Strict DB CHECK Constraints:**
   - `chk_ac_version_positive`: `version >= 1`.
   - `chk_ac_deprecation_consistency`: `isDeprecated = TRUE → deprecatedAt IS NOT NULL`.
   - `chk_ac_previous_differs`: `previousValue IS NULL OR previousValue::text <> value::text`.
   - `chk_ac_rollout_range`: `rolloutPercentage >= 0 AND rolloutPercentage <= 100`.
3. **Optimistic Concurrency & Rollback:**
   - Version tracking with `ConfigVersionConflictError`.
   - Previous value preservation enables instant rollback.
   - Lock enforcement (`isLocked` → `ConfigLockedError`).
4. **Feature Flag Evaluation (`evaluateFlag`):**
   - Org-level overrides take precedence over global flags.
   - Kill-switch emergency override (`killSwitch = true` → immediate false).
   - Environment scoping and release date validation.
   - Deterministic rollout percentage hashing using SHA-256.
   - Targeting rules evaluation (`equals`, `not_equals`, `in`, `contains`, `greater_than`, `less_than`).
5. **System Config Retrieval (`getConfigValue`):**
   - Org-level overrides with fallback to global default and caller-supplied fallback.
   - In-memory caching with TTL and write-invalidation.
6. **Audit & Compliance:**
   - Mandatory `changeReason` (minimum 10 chars).
   - Audit events: `config.created`, `config.updated`, `config.deleted`, `config.rolled_back`, `flag.created`, `flag.updated`, `flag.deleted`, `flag.toggled`.
7. **RBAC & Seed Permissions:**
   - `config.read`, `config.create`, `config.update`, `config.delete` (Admin/Owner).
   - `flags.read` (All roles), `flags.create`, `flags.update`, `flags.delete` (Admin/Owner).
8. **Exit Gate Requirement:**
   - "Feature flag gates a live code path" verified in integration tests.
