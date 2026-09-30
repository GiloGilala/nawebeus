# P4 — Media monitoring (PRD Module 6)

**Feature slug:** `p4-monitoring`
**Roadmap:** `docs/plan/master-roadmap/08-phase-3-4-modules.md` §14.1 · execution plan §5 P4
**Status:** in progress — NWB-P4-001 done 2026-09-29; P4-002…006 not started
**Scope note:** D12 is still open. Monitor is present under every D12 option, so the P4 work below is common scope; this spec does not decide whether Publishing, PR, Commerce, or Influencer are in MVP.

## Goal

Deliver tenant-isolated media monitoring: organizations configure monitoring campaigns, ingest and deduplicate media articles, enrich them, calculate competitor share of voice, and track crisis incidents through an auditable lifecycle.

Use the canonical glossary in `CONTEXT.md`: a **Monitor** is a persistent search configuration and **Mention** is the inbound item it finds. Monitor owns media articles; social mentions and their future collection pipeline are shared with Listen and must not be forked.

## Entry gates and decisions

- P1 shared infrastructure is implemented. Its spec records two operator-only residuals (a Resend sandbox send and an R2 live smoke); these are not engineering blockers for the P4 campaign service. Reconfirm the P1 exit-gate evidence before production release.
- P2 social accounts and platform adapters are implemented. News ingestion uses the already-approved DEC-027 sources (NewsAPI and Mediastack), with direct RSS as a supplement where specified.
- **D12 remains open.** P4 is shared scope under Options A/B/C; do not start the disputed P3/P8/P9/P10 domains before D12 is recorded.
- **D8 is required before NLP ticket P4-003.** Evaluate candidate providers for Nigerian English/context, accuracy, cost, and data residency/transfer; record the NDPR data-flow review. Keep the selected provider behind an interface. Do not choose a vendor by implementation convenience.
- **D9 default:** PostgreSQL `tsvector` for MVP; defer Elasticsearch unless a recorded decision changes that default.
- Adopt the existing `db/monitoring/` design rather than re-authoring it. Review the schema against the migration/adoption rules, especially 64-character IDs, shared enums, indexes, retention, and cross-module references. The six tables are shared with Listen where documented; extend this module instead of duplicating ingestion/enrichment.

## Planned tickets

| ID | Ticket | Dependency | Size | State |
|---|---|---|---|---|
| NWB-P4-001 | Monitoring campaigns service | — | M | `done` (2026-09-29) |
| NWB-P4-002 | Article ingestion worker | P1-001; approved source credentials/config | L | not yet filed |
| NWB-P4-003 | NLP enrichment worker (sentiment, entities) | P4-002, D8 | L | not yet filed |
| NWB-P4-004 | Competitor tracking + weekly metrics worker | P4-002 | M | not yet filed |
| NWB-P4-005 | Crisis incident lifecycle | P4-002 | M | not yet filed |
| NWB-P4-006 | Routes for campaigns, articles, competitors, crises | P4-001…005 | M | not yet filed |

Per the local issue-tracker convention, later tickets are filed when they are picked up; this table preserves the execution-plan order without prematurely claiming them.

## Exit gate

- Articles ingest and enrich unattended, with duplicate source records converging to one article.
- Competitor share of voice is computed on schedule from tenant-scoped articles.
- A crisis can be raised, acknowledged, and resolved with a complete audit trail.
- Tenant isolation, retries/idempotency, retention behavior, and scheduled-job safety are verified by database-backed tests.
- `bun run typecheck`, `bun run lint`, `bun run build`, and the relevant DB-backed tests pass.
