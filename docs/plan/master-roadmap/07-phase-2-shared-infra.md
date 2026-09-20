# Master Roadmap — Phase 2: Shared Infrastructure Services (§12)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 12. Phase 2 — Shared infrastructure services (execution plan P1)

**Objective:** land the cross-cutting services every domain module needs. Per the execution plan this is "the single largest multiplier" — nothing downstream may start before its exit gate.
**Slug:** `.scratch/p1-shared-infra/` (create per plan §9).
**Entry criteria:** Phase 1 exit gate met; D6 (storage) resolved.
**Dependencies:** Phase 1 (migrations baseline for any schema touch; email/queue are new dependencies).

**Tickets (adopted verbatim from plan §5 P1 — ticket detail lives there; this section records verification-relevant additions):**

| ID | Ticket | Verified current state | Notes added by this audit |
|---|---|---|---|
| NWB-P1-001 | Queue + scheduler + worker base (pg-boss) | nothing in `src/lib/`; ADR-028 accepted; `package.json` has no pg-boss | Add pg-boss dep with the ADR-028 rationale in the PR (AGENTS.md dependency rule). Workers must write audit events (success+failure) and be idempotent (ground rule 4). **Wire here:** rate-limit reclamation (NWB-P0-013's manual script), `purgeExpiredAccounts` (F-18), `purgeExpiredOrganizations` (NWB-P0-023). pg-boss schema bootstrap recorded per NWB-P0-005(5). |
| NWB-P1-002 | Audit service formalization | `writeAuditLog` exists; no reads; 5-module enum too small for 14 domains | Extend `AuditModule` taxonomy to cover PRD modules 3–10 + non-PRD domains; add query service (by actor/subject/org/category/date-range, paginated — fixes F-19 first half); retention + legal-hold hook in P1-010. |
| NWB-P1-003 | Approval service | `db/shared/approval.ts` active (2 tables), unused | Gates responses (P7), releases (PR phase), content (Publishing if D12=B/C). |
| NWB-P1-004 | Email transport: Resend adapter | console-only; DEC-028 approved | Also flips the Phase 1 "verification hard-block" checkbox (NWB-P0-015 note) — add the gate for `pending_verification` once real delivery exists. |
| NWB-P1-005 | Media/storage service | none; `media_assets` table active-ready; D6 open | Interface mirrors `EmailTransport`; R2 adapter prod / local-disk dev per docs; signed URLs; soft delete. Avatars (PRD `/me/avatar`) and report exports (P12) consume this. |
| NWB-P1-006 | Templates service | `templates` table active-ready | |
| NWB-P1-007 | Contacts service | `contacts` + `contact_interactions` active-ready | Reused by PR/Influencer (Option B/C) — build regardless (cheap, spec'd). |
| NWB-P1-008 | Notification engine core | `alerts` tables (2) active-ready | create/recipients/delivery-log; channels in P6. |
| NWB-P1-009 | Feature flags + system config | none | `evaluateFlag`, `getConfigValue`, audited config writes; used by billing limits + Phase 7 dark launches. |
| NWB-P1-010 | Retention + legal holds + backup records | none | 7-year audit retention (Module 1 spec) enforced by worker; holds block purge workers from P1/NWB-P0-023. |
| NWB-P1-011 | Impersonation sessions | `AuditActorType` already includes `"impersonation"` | Start/end, full audit, clean end; support tooling (P15-006). |
| NWB-P1-012 | Observability baseline | console + `NWB_DEBUG_ERRORS` only | Structured JSON logs (request id, org id, user id, duration), correlation IDs (reuse `requestId` field already in audit schema), error tracking, `/api/health` upgraded to a real readiness probe (DB ping + queue depth). Infra §6.2 stack (Prometheus/Alertmanager) is wired in Phase 8; Phase 2 makes the data exist. |

**Schema adoptions in this phase:** none new (approval/contacts/alerts/media/templates/analytics are already active). Any drift found while wiring is fixed in the schema + migration (ground rule 7), recorded in the ticket.

**Exit gate (plan §5 + this audit):** scheduled worker executes in dev **and** under the CI test job (a no-op scheduled job proves the loop); email actually sends via Resend in a dev sandbox (evidence in spec.md); approval queue works end-to-end; media upload→signed-URL works against local adapter (R2 smoke when credentials available); feature flag gates a live code path; observability: a request can be traced by correlation id from log to audit row; all purge/reclamation workers running on schedule. **Nothing downstream starts until this gate passes.**

---

