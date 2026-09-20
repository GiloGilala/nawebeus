# Auth Module 1 parity

**Feature slug:** `p0-auth`
**Spec owner:** Engineering Lead
**Status:** [done](issues/01-auth-module-1-parity.md) — **10/10 Module 1 FRs implemented (2026-09-20)**.
The three items that kept this `in-progress` have all landed and were re-verified before this
flip: FR-AUTH-010 API keys (NWB-P0-001, `src/services/auth/api-key.ts`), the MFA login flow
(NWB-P0-012, `POST /api/auth/mfa/verify-login`), and DSAR export (NWB-P0-002,
`src/services/users/dsar.service.ts` + `src/tests/users/dsar-export.test.ts`).
FR-AUTH-006's accept half shipped in NWB-P0-016 with the DEC-039 invite ladder.
**Read `.scratch/p0-foundation-gap/` for the current state of this code** — several defects in
this surface (F-01…F-28) were found and fixed after the FRs were first called complete.

## Summary

Bring the runtime (`src/`) to parity with Module 1 of `docs/modules/Authentication & User Management.md` (10 FRs, ~30 user stories). The Drizzle schema (`db/`) already defines all required tables; this effort is runtime wiring + tests only.

Full spec, acceptance criteria, build backlog, and testing seam are published as a ready-for-agent issue: [issues/01-auth-module-1-parity.md](issues/01-auth-module-1-parity.md)
