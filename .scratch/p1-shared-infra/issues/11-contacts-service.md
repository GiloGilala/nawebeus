# NWB-P1-007 — Contacts service (create / get / list / update / delete / merge / interactions)

Type: task
Status: done (2026-09-22 — implemented, tested, full test suite passing)
Blocked by: none
Phase: P1 (roadmap Phase 2)
Size: M

## Why this exists

Nawebeus uses a shared contacts foundation across PR and Influencer modules (`db/shared/contacts.ts`,
migration 0000). The execution plan §5 and master roadmap §12 schedule NWB-P1-007 as the cross-cutting
contacts service supporting downstream domains:

- P8 PR module: Journalist CRM, outlet assignments, media pitch interaction tracking, coverage attribution.
- P9 Influencer module: Influencer CRM, rate cards, partnership interactions, content submission tracking.
- Interaction timeline & follow-up scheduler: cross-channel engagement tracking (email, WhatsApp, phone, meetings).

Before this ticket:
- `db/shared/contacts.ts` defined the schema with shared-PK inheritance (`contacts` base, `journalists`/`influencers` detail tables) and `contact_interactions`.
- `id`, `organization_id`, and `created_by_id` columns were defined as `varchar(32)` while tenant
  and user IDs are 36-character hyphenated UUIDs (ground-rule-7 drift).
- No service layer, validation schemas, HTTP endpoints, server functions, or audit actions existed.

## Measured (2026-09-22)

1. **`varchar(32)` ID columns:** `contacts.id`, `organization_id`, `created_by_id`, `deleted_by_id`, `merged_into_id`, and all interaction references cannot fit 36-character UUIDs. Migration 0006 widens these to `varchar(64)`.
2. **Shared-PK inheritance:**
   - Contacts base table contains shared identity (fullName, email, phone, location, tags, notes).
   - Detail tables (`journalists`, `influencers`) reference `contacts.id` with `ON DELETE CASCADE`.
3. **Strict DB CHECK constraints:**
   - `chk_contacts_merged_consistency`: `(mergedIntoId IS NULL) = (mergedAt IS NULL)`.
   - `chk_contacts_deleted_consistency`: `(deletedAt IS NULL) = (deletedById IS NULL)`.
   - `chk_contacts_relationship_score`: 0..100.
   - `chk_contacts_interaction_count`: non-negative.
   - `chk_contacts_version`: >= 1.
   - `chk_ci_followup_consistency`: `followUpStatus = 'completed' → followUpCompletedAt IS NOT NULL`.
   - `chk_ci_response_time_positive` & `chk_ci_duration_positive`.
4. **Unique constraints per tenant:**
   - Email is unique per organization (nulls allowed).
   - Phone is unique per organization (nulls allowed).
   - `externalReference` on interactions is unique per organization (idempotent sync).
5. **Optimistic concurrency:** `version` column incremented on every contact update.
6. **Merge deduplication:** Source contact marked `mergedIntoId = target.id`, `mergedAt = now()`, `isActive = false`, and interactions re-linked to target.

## Verification

- `bun test src/tests/contacts/` — 19/19 passing (service tests, HTTP route tests, server functions tests).
- `bun test` — 724/724 passing across 71 files.
- `bun run typecheck` — 0 errors.
- `bun x @biomejs/biome check src/services/contacts/ src/server/api/contacts/ src/app/server-functions/contacts.ts src/lib/validation/contacts.schemas.ts` — 0 errors, 0 warnings.

