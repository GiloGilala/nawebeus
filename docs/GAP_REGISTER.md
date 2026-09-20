# GAP_REGISTER.md — Phase 0 Gap Register
Every item is evidenced by a file path or a verified absence (`glob`). No fabricated gaps.

| Gap ID | Category | Evidence / Source File | Severity | Status | Owner (proposed) |
|---|---|---|---|---|---|
| G-01 | `/doc` missing | `glob **/doc/**` → 0 results; user framework requires `/doc` | Blocker | Open | Technical PM |
| G-02 | `docs/Foundation Phase.md` stale | References `core/users.service.ts` (doesn't exist; reality: `src/services/auth/auth.service`); phases 0-15 don't match `AGENTS.md` architecture (`AGENTS.md:107-158`) | High | Open | Senior Architect |
| G-03 | Technical docs (`docs/technical/`) missing | `AGENTS.md:191` references `docs/technical/` (Engineering Standards, File Structure, Tech Stack); `glob` → 0 results | High | Open | Senior Architect |
| G-04 | PRD / Roadmap (`docs/product/`) missing | `CONTEXT.md:7` references `docs/product/PRD.md` and `docs/product/Roadmap.md`; `glob` → 0 results | High | Open | Technical PM |
| G-05 | Decision Log (`docs/business/`) missing | `AGENTS.md` and `CONTEXT.md` reference `docs/business/Decision Log.md`; `glob` → 0 results | Medium | Open | Technical PM |
| G-06 | Issue tracker (`.scratch/`) incomplete | `.scratch/` has `p0-auth/` and `p1-shared-infra/` folders; `.scratch/*.md` `glob` → 0 results; tracker files may be nested deeper or missing (`AGENTS.md:197`) | Medium | Open | Technical PM |
| G-07 | `docs/modules/*.md` stale / superseded | `CONTEXT.md:26` says superseded; exact files not confirmed by `glob` (may exist in excluded subfolders) | Low | Open | Senior Architect |
| G-08 | Aspirational schema excluded | `tsconfig.json:35-48` excludes `db/billing/`, `campaigns/`, `commerce/`, `compliance/`, `engagement/`, `influencer/`, `monitoring/`, `pr/`, `publishing/`, `social-accounts/`; `AGENTS.md:193` confirms aspirational | Low | Open | Senior Architect |
| G-09 | `db:push` broken (documented but not warned in doc) | `AGENTS.md:98-105` explains `db:push` fails with `42P16` and exits 0; `.github/workflows/ci.yml:122` uses `db:migrate`; `docs/Foundation Phase.md` references `drizzle-kit generate` without warning | Medium | Open | DevOps |
| G-10 | Coverage threshold config broken | `AGENTS.md:79` and `.github/workflows/ci.yml:9-15`: `bunfig.toml` `coverageThreshold` is broken; docs propose non-existent `--coverage-threshold` flag | Low | Open | DevOps |
| G-11 | Two `tokens.ts` ambiguous | `AGENTS.md:160-163`: `src/lib/tokens.ts` (primitives) vs `src/services/auth/tokens.ts` (DB-backed); bare import ambiguous | Low | Open | Service Engineer |
| G-12 | `docs/agents/issue-tracker.md` missing | `AGENTS.md:198` references it; `glob` → 0 results (before correction: file exists at `docs/agents/issue-tracker.md`) | Low | Closed (exists) | Technical PM |
| G-13 | Remote repo (`github.com/GiloGilala/nawebeus`) empty vs local workspace full | `WebFetch` shows "This repository is empty"; local workspace has full `src/`, `db/`, `docs/`, `.scratch/`, `AGENTS.md` (202 lines) | High | Open | Technical PM |
| G-14 | Database version discrepancy: user states PG 18; CI uses `postgres:14` (`AGENTS.md:90` floor); `AGENTS.md:98-105` mentions PG 18 as `db:push` failure case | `.github/workflows/ci.yml` (postgres:14); user statement (PG 18); `AGENTS.md:98-105` (PG 18 `db:push` failure) | High | Open | DevOps |

## Gap Dependency Chain (evidenced by `AGENTS.md` and code)

```
G-01 (`/doc` missing) → blocks G-02, G-03, G-04, G-05, G-12
G-02 (stale Foundation Phase) → blocks accurate architecture docs (Phase 2)
G-09 (`db:push` broken) → must be reconciled before any schema-change PR updates docs
G-11 (ambiguous tokens import) → must be reconciled before API contract recovery
```

## Resolution Rules (from framework plan — Phase 1)

Every discrepancy must be classified:
- `code-correct-doc-stale` (e.g., G-02)
- `doc-correct-code-bug` (if code deviates from `AGENTS.md`)
- `both-wrong` (if `docs/Foundation Phase.md` and `AGENTS.md` conflict)
- `undecided` (if `CONTEXT.md` says status unresolved, e.g., Influencer Management / Publishing phasing — `CONTEXT.md:42`)

Every resolution produces an ADR in `/doc/adr/` before code changes.
