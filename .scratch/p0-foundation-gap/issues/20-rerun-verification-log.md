# NWB-P0-020 — Re-run the verification log (plan Appendix C)

**Status:** done — 2026-09-20 (every number below was executed at HEAD `51c1a2d`
against a freshly created PostgreSQL 14.23; nothing carried forward)

- **Epic:** p0-foundation-gap
- **Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-020
- **Size:** S
- **Depends on:** —

## Objective

Refresh every "last verified" number against the current tree with a live
database. The plan's figures were dated 2026-09-13 at HEAD `049a837`, and the
sandbox that produced the roadmap could not run Bun at all, so several numbers
had never been executed anywhere.

## Method

Run from a genuinely empty database rather than the working one, because the
point of the exercise is to prove the *documented* path works for someone
starting from nothing:

```
DROP DATABASE nawebeus_test; CREATE DATABASE nawebeus_test;
bun run db:migrate     # from zero
bun run db:migrate     # again — must be a no-op
bun run seed           # twice — must be idempotent
bun test               # with DATABASE_URL
bun test               # without (mv .env aside — see gotcha)
bun run typecheck && bunx biome check . && bun run build
```

## Results

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `51c1a2dedb91ac3627d43d6fbc0a31d97761d3eb` |
| `bun --version` | 1.4.2 (was 1.4.0) |
| `node --version` | v22.22.3 |
| PostgreSQL | 14.23 — the pinned CI floor |
| `db:migrate` from empty | **PASS** — 1 migration, 30 public tables, ~1.5 s |
| `db:migrate` re-run | **PASS — no-op, no error** |
| `bun run seed` | **PASS**; second run idempotent |
| `bun test` with DB | **395 pass / 0 fail**, 1182 assertions, 42 files, ~28 s |
| `bun test` without DB | **222 pass / 184 skip / 0 fail**, 406 collected, ~0.2 s |
| `bun run typecheck` | **PASS** |
| `bunx biome check .` | **PASS — 0 errors**, 499 warnings, 2 infos, 178 files |
| `bun run build` | **PASS** — `dist/index.js`, 0.66 MB |
| Structure | 42 test files, 438 test blocks, 15 routes, 27 services, 124 `src/*.ts` |

No check failed, so the ticket's "any failure becomes a Phase 1 defect ticket"
clause did not trigger.

### Movement since the last recorded run

| | 2026-09-13 (`049a837`) | 2026-09-20 (`51c1a2d`) |
|---|---|---|
| Tests passing (with DB) | 96 | **395** |
| DB-gated skips | 33 | 184 |
| Test files | 28 | 42 |
| Active tables | 28 | **30** |
| Lint | red at HEAD (F-27) | **0 errors** |
| Schema evolution | `db:push` (non-idempotent, 42P16) | committed migrations, re-run no-op |

## Deviation from the written steps

The ticket says to run `db:push -- --force`. **I did not**, deliberately:
NWB-P0-005/009 replaced `db:push` with `db:migrate` as the evolution path, and
`db:push` now survives only as documented dev convenience. Verifying the
superseded path would have proved nothing about how a clean database actually
reaches the current schema. `db:migrate` from zero + a no-op re-run is the
stronger check and is exactly what CI runs.

## Corrections made while verifying

Re-running the numbers surfaced doc drift that had nothing to do with test counts:

- Plan §1 claimed **28 tables**; there are **30** (`data_export_requests` from
  NWB-P0-002, plus the org-deletion work). Corrected.
- Plan §1 cited `src/app/auth/*`, `src/app/users/*`, `src/app/orgs/*` as route
  paths. Those mirrors were **deleted in NWB-P0-026**; the canonical tree is
  `src/server/api/**`. Corrected.
- Plan §1's RBAC row still described the CASL `organizationId` condition as the
  scoping mechanism. It was inert and removed in NWB-P0-018. Corrected, with a
  pointer to Security Architecture §4.3.1.
- `01-discovery.md` still advertised "28 test files, ~195 blocks" and the
  2026-09-13 counts. Corrected to the measured 42 / 438.
- `AGENTS.md`'s marker named HEAD `d03dc49`, a commit not on this branch.
  Re-pointed at `51c1a2d`.

## Phase 1 exit criteria — evidenced status

| # | Criterion | Status |
|---|---|---|
| 1 | Full suite green with a live DB incl. the 11 named suites | **Met** — all 11 exist and run; 395/0 locally and on CI |
| 2 | Invite → accept → act → self-protection demo | **Met** — `invitation-accept.test.ts` (14 tests) covers both branches: "new user registers into the org" (L68) and "existing org-less account is linked and activated" (L220), plus the role ladder and self-protection guards (L319, L377) |
| 3 | Migrations take a clean DB to current; re-run no-op; CI uses `db:migrate` | **Partly** — the first two clauses are evidenced by this run; **CI still runs `db:push -- --force`** (`.github/workflows/ci.yml`), so the third is not met. Corrected after NWB-P0-022 checked the workflow; blocked on the `workflows` permission (NWB-P0-005) |
| 4 | DSAR export returns a valid payload | **Met** — `users/dsar-export.test.ts` |
| 5 | D11, D12, D13, D15 recorded in the Decision Log | **Not met** — only D13 is there (DEC-039). D11/D12/D15 outstanding → NWB-P0-019 |
| 6 | No Critical/High §5 defect open | **Met** — F-09 closed by NWB-P0-021; F-01…F-08, F-10, F-12, F-13 previously closed |
| 7 | AGENTS.md + plan §1 markers refreshed | **Met by this ticket** (the branch-protection half is NWB-P0-022) |

Criteria 5 and 3 are the real gaps. 5 belongs to NWB-P0-019; 3's CI clause and the
branch-protection half of 7 belong to NWB-P0-005/022.

> **Correction (2026-09-20, same day):** I first scored criterion 3 **Met**. That was
> right about the migration path and wrong about CI — the workflow still runs
> `db:push -- --force`, which NWB-P0-022 caught when it read the file rather than the
> roadmap's description of it. Fixed above. The lesson is the same one this ticket exists
> to enforce: verify the artefact, not the sentence describing it. I am recording that here rather than
quietly marking the phase green.

I first scored criterion 2 as only partly met, having grepped
`invitation-accept.test.ts` for the literal phrase "existing user" and found
nothing. Reading the test names instead showed the branch is covered at L220
under different wording. Recorded because the near-miss is the argument for
checking exit criteria by reading tests rather than grepping for the words the
criterion happens to use.

## Acceptance

- [x] typecheck PASS, lint PASS (0 errors), build PASS, tests 0 fail.
- [x] Numbers recorded in Appendix C with today's date + HEAD; the 2026-09-13
      log kept and marked superseded rather than overwritten.
- [x] Plan §1, `01-discovery.md`, `AGENTS.md`, roadmap and spec refreshed.
- [x] No failure surfaced ⇒ no new defect ticket required.
