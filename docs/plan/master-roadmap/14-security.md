# Master Roadmap — Security Review (§24)

> Part of the **Nawebeus Master Implementation Roadmap** — index: [`../MASTER_IMPLEMENTATION_ROADMAP.md`](../MASTER_IMPLEMENTATION_ROADMAP.md).
> Section numbers (§N) are **global across parts**; cross-references resolve via the index part-map. Related parts are listed there.

## 24. Security review (findings → remediation → verification)

Severity per operating rule 14: Critical / High / Medium / Low / Informational. Status: O = open, R = remediated (Phase 1 task).

| # | Sev | Finding | Evidence | Remediation (task) | Verification test |
|---|---|---|---|---|---|
| S-01 | **Critical** | New org owner has zero permissions — onboarding dead-end (F-01) | signup.ts:182 | NWB-P0-010 | signup→ability test; invite 200 |
| S-02 | **Critical** | Invitations cannot be accepted — team onboarding impossible (F-08) | no accept path | NWB-P0-016 | accept-flow tests (5 paths) |
| S-03 | **High** | MFA 2-step login dead end (F-03) | confirmMFAChallenge unwired | NWB-P0-012 | challenge-flow tests |
| S-04 | **High** | MFA backup codes displayed ≠ stored (F-04); plaintext storage (F-04b) | mfa.ts:30/63 | NWB-P0-012 | displayed-code works; hash check |
| S-05 | **High** | Suspended users can authenticate (F-05) | auth.service.ts:73 unused | NWB-P0-015 | suspension → 403 test |
| S-06 | **High** | Org-scoping CASL condition inert; docs overstate defense-in-depth (F-06) | CASL v7 semantics verified | NWB-P0-018 + D11 | pin test; route-invariant scan; doc correction |
| S-07 | **High** | Role self-protection guards reference non-existent role codes (F-07) | role-assignment.service.ts vs seed | NWB-P0-014 (D13) | red-green tests per guard |
| S-08 | **High** | Org update permanently 403 (subject mismatch) (F-02) | org.route.ts:40 vs seed | NWB-P0-011 | positive+negative org update tests |
| S-09 | **High** | Rate limiter permanently dead after first window per bucket (F-12) | rate-limit.ts upsert | NWB-P0-013 | window-boundary tests (red-green) |
| S-10 | **Medium** | Open CORS (F-13); client IP inconsistent/spoofable (F-10) | server/index.ts:13; signin.route.ts:38 | NWB-P0-017 | preflight tests; IP policy unit tests |
| S-11 | **Medium** | Verification links: broken base (signup), client-Origin in email (resend) (F-09/09b) | signup.ts:211; verification.route.ts:34 | NWB-P0-021 | emitted-HTML link tests |
| S-14b | **Low** | Unvalidated path params reached `uuid` columns, so malformed ids returned **500** with a driver parse error rather than 422 — found via F-11 and fixed with it (`uuidParam`, NWB-P0-029). Four route families were affected; api-keys already validated. | measured 2026-09-20 | **Closed** | `src/tests/route-params.test.ts` (11 tests) |
| S-12 | **Medium** | No RLS (ADR-009) — **verified absent 2026-09-20** (0 policies in `pg_policies`, 0 tables with `relrowsecurity`, no RLS statement in `drizzle/`, `db/` or `src/`); decision now recorded as **DEC-O009 (Open)** with an engineering recommendation (defense-in-depth in Phase 8; application layer stays primary). Interim mitigation in place: Security Architecture §4.3.1 states the gap plainly and `src/tests/route-invariants.test.ts` fails any `:orgId` route missing `requireOrgMatch` (NWB-P0-018) | ADR-009 vs code | **DEC-O009 owner decision** (Engineering + Security Lead) + Phase 8 execution | RLS suite (if implemented) or documented deferral + app-layer suite |
| S-13 | **Medium** | No DSAR (NDPR) | grep | NWB-P0-002 | export tests + cross-tenant negative |
| S-14 | **Low** | ~~Route shadowing `/users/me` vs `/users/:userId` (F-11)~~ **closed NWB-P0-029** (explicit `/users/admin` mount, as prescribed); dead `createApp` (F-17); no pagination (F-14) | — | ~~F-11 fix in Phase 1~~ **done**; F-17 removal with reference check; F-14 at Phase 7 | `src/tests/route-params.test.ts` + `users/admin.test.ts`; both verified red against the pre-fix mount |
| S-15 | Informational | 246–248 `any` sites (lint warning by design); bcrypt cost default; session device metadata null (F-15) | AGENTS.md | track, don't block; device parsing recommended with Phase 7 session UI | — |

**Standings after Phase 1:** zero Critical/High open. **Standings required at launch (Phase 8):** zero Critical/High open, S-12 resolved one way, full isolation suite green over every multi-tenant table, k6 at pilot scale, backup restore rehearsed.

---

