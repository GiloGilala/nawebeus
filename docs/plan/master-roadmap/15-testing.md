# Master Roadmap — Testing Strategy (§25)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 25. Testing strategy

**Architecture (existing, retained):** unit (no-DB, no-op seam) / integration (`withTestDb` transaction wrap) / API (`createTestApp` + real DB) — plus the Phase 1 additions (route-invariant scan, coverage script, security suite seeds).

| Layer | Scope | Acceptance gate |
|---|---|---|
| Unit | services/lib/utilities: password, tokens, totp, rate-limit windows, IP policy, money math (P13), aggregators (P12) | coverage script: **services ≥85%, lib ≥90%** (QA §2.1; graduated: Phase 1 files from Phase 1, codebase-wide from Phase 2) |
| Integration | every service against real PG (CI PG14 floor — ADR-003); transactions; concurrency (atomic increment, budget commit, discount redemption, rate windows) | 100% pass in CI |
| API | all routes: auth matrix (unauthenticated 401 / wrong-permission 403 / happy 200) — **Negative Test Rule (QA §2.2) mandatory**: every positive permission test has a wrong-role negative | endpoint coverage ≥70% (QA §2.1), rising with each phase |
| Tenant isolation (security) | for **every multi-tenant table** (driven from `db/schema.ts`): user of org A cannot read/write org B rows via every route touching the table (QA §6.3) | 100% of tables covered; 0 leaks |
| Permission (security) | RBAC matrix: all roles × all actions, positive+negative (QA §2.1: "100% all roles × all actions") | matrix table maintained per phase; CI |
| Migration | fresh-DB → migrate → seed → suite (standing gate from Phase 1); re-migrate no-op; (post-prod) upgrade path DB(n)→DB(n+1) dry run | PASS per release |
| E2E | Playwright, P0 journeys from QA §5.2; begins Phase 7 (auth→org→invite→first workflow per module cluster); daily CI job on staging (QA §2.1/§11.1) | 100% of defined journeys pass at launch |
| Mobile | Phase 10 only (Maestro per QA §5.5); offline-termination + reconnect tests mandatory before offline mutations ship | plan P16 exit |
| Performance | k6 (QA §7.3) at Phase 8 against QA §7.2 targets applicable at pilot scale + Roadmap §18.3 Y1 (API <500ms p95, page <2s); monthly thereafter | measured values recorded; regressions fail the release |
| Accessibility | axe-core WCAG 2.1 AA, Phase 7+ (QA §8) | 0 violations |
| Security suite (Phase 8) | §24 matrix + OWASP ASVS L2 spot-check + secret scanning (QA §11.2 gate — note: current CI deliberately excludes `bun audit`/Snyk; re-introduce as the dependency surface grows, per `.scratch/…/03-ci-pipeline.md` rationale) | no High/Critical |

**Standing acceptance gate (every phase exit):** `typecheck: PASS · lint: PASS (errors) · build: PASS · unit+integration+API: PASS (live DB) · tenant isolation: PASS · migration verification: PASS · (from P7) E2E critical paths: PASS · (from P8) security + performance: PASS`.

---

