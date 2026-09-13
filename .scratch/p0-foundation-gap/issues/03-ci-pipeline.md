# NWB-P0-003 — CI pipeline

**Status:** done — 2026-09-13 (workflow written and simulated locally; **first real GitHub
Actions run still pending**)
**Deps:** none. **Size:** M.

## What was built

`.github/workflows/ci.yml` — two jobs:

| Job | Runs | Why |
| --- | --- | --- |
| `quality` | `bun install --frozen-lockfile`, `typecheck`, `lint`, `build` | Fast, no database, fails the run before the slow job starts |
| `test` | `bun install --frozen-lockfile`, `db:push`, `seed`, `bun test` | The real gate — full suite against a live PostgreSQL service container |

Triggers: `push` to `main` / `feature/**` / `bugfix/**` / `hotfix/**`, and `pull_request`
targeting `main`. `concurrency` cancels superseded runs on the same ref. `TZ: Africa/Lagos`
(WAT) is set globally so timestamp-sensitive tests don't depend on the runner's locale.

This satisfies the execution plan's requirement for NWB-P0-003: *"Every push runs
`bun run typecheck`, `bun test` with `DATABASE_URL` set, and lint; failures block merge."*

## Key decisions

- **PostgreSQL 14, not the locally-installed 18.** ADR-003 sets *"PostgreSQL 14+"* as the
  floor. CI tests the floor deliberately: if the schema ever starts relying on a newer-only
  construct, that should fail in CI rather than on the production VPS. Verified that the
  generated DDL needs nothing newer — no `CREATE EXTENSION` (so no pgcrypto), and no
  `NULLS NOT DISTINCT`, identity columns, or other PG15+ syntax. The one PG17+ artefact
  found (`SET transaction_timeout`) comes from the *local* `pg_dump` binary, not from
  drizzle, so it does not reach CI.
- **Bun pinned to `1.4.0`.** The version `bun.lock` was generated with. Floating it would let
  a Bun upgrade rewrite the lockfile inside CI, which should be a reviewed commit instead.
- **`bun install --frozen-lockfile`.** CI must not silently resolve different dependency
  versions than the lockfile records.
- **Schema via `db:push`, not migrations.** `drizzle/migrations/` holds one migration for a
  29-table schema — there is no baseline, and `db:migrate` does not exist as a script
  (`migrate` is an alias of `db:push`). Push works here because the service container starts
  empty; it is explicitly **not** idempotent (NWB-P0-009). **NWB-P0-005 must replace this step
  with `db:migrate`.**
- **`seed` runs before `test`, and this is load-bearing.** The suite is not independent of
  seed data. Verified by running it against an unseeded database: **7 tests fail** — the
  `seed data` group (4) and `RBAC integration` (2) and `signin with valid credentials` (1),
  all of which need the seeded permissions/roles/ability graph. Without this step CI would be
  red for a reason that looks like a code failure.
- **The connection is supplied twice.** `drizzle.config.ts` reads `DB_*` while the app and
  tests read `DATABASE_URL` (NWB-P0-009), so the `db:push` step sets both families. The
  validator below asserts they agree — a mismatch would silently push to `nawebeus` instead of
  the test database.

## Deliberately not in the pipeline

The planning docs (Engineering Standards §9.5, QA Strategy §11.1, Infrastructure §4.1)
describe a much larger pipeline. None of it is wired up, because none of the tooling exists —
adding any of it would produce a permanently red gate:

| Stage in the docs | Why it is absent |
| --- | --- |
| ESLint + Prettier | No config, no dependency. → NWB-P0-004 (Biome) |
| Coverage thresholds (85/90) | Two independent reasons — see the section below. Not merely "not configured": `bunfig.toml` **cannot** express this gate on Bun 1.4, and the config the docs propose is a silent no-op. |
| `bun audit`, Snyk, Trivy | Not dependencies of this project; no accounts. |
| Playwright / accessibility | No frontend exists yet. → D2 |
| Codecov upload | No account. |
| `db:migrate` | Script does not exist. → NWB-P0-005 |
| Deploy job | Out of scope for P0. → P14 |

`bun run lint` **is** wired in even though it is currently a placeholder that prints
`no linter configured yet` and exits 0. The step exists so NWB-P0-004 only has to change
`package.json`, not this workflow. It is labelled as a placeholder in a comment, because a
green step that proves nothing is worse than an absent one if nobody knows which it is.

## Coverage enforcement is a custom-script job, not a config job

If coverage gating is ever brought into scope, **do not plan on `bunfig.toml`.** The
`coverageThreshold` option cannot express the gate the Engineering Standards doc asks for
(85% services / 90% lib), and the exact configuration that doc proposes is silently inert.

Everything below was verified empirically on **Bun 1.4.0** (`bun test v1.4.0 (34cbb9a40)`,
Windows) against throwaway probe projects in a temp directory — not read from documentation.
The repo's own `bunfig.toml` was never modified.

### What the option actually does

| Behaviour | Verdict | Evidence |
| --- | --- | --- |
| Value is a **fraction** (0–1), not a percentage | ✅ confirmed | On a 100%-covered project: `lines = 1.0` and `0.99` exit 0, while `99`, `100`, `101`, `1.5`, `2.0` all exit 1. |
| **Per-file**, not aggregate | ✅ confirmed | Aggregate line coverage 46.67% with `lines = 0.45` (45%) **fails** — an aggregate gate would pass. One bad file sinks the run. |
| Enforced **only when the `text` reporter is on** | ✅ confirmed | `--coverage-reporter=lcov` alone with a failing threshold → **exit 0**. Adding `--coverage-reporter=text` → exit 1. A CI job configured for lcov-only would silently never fail. |
| **No error message on failure** | ✅ confirmed | The failing run prints the ordinary table, `2 pass / 0 fail`, then exits 1. Nothing names the file, the metric, or the threshold. It reads as a green suite with a red exit code. |
| **No missing-file guard** | ✅ confirmed | A file that is never imported does not appear in the report at all, so it cannot be counted against the threshold. "Coverage of untested files" is unmeasurable. |
| Unknown keys are **silently accepted** | ✅ confirmed | `coverageThreshold = { services = 85, lib = 90 }` → exit 0. `{ nonsense = 999 }` → exit 0. |
| The CLI flag in Engineering Standards §9.5 exists | ❌ **it does not** | `bun test --help` has no `--coverage-threshold`. Passing it anyway is silently ignored (exit 0), so the documented command cannot fail, and cannot gate. |
| lcov reporter itself is sound | ✅ confirmed | Emits a valid `coverage/lcov.info` (`SF:`/`DA:`/`LF:`/`LH:` records). Exit 0. |
| Threshold not enforced under `--parallel` | ⚠️ **did not reproduce** | With two test files, `lines = 0.9` exited 1 both serially and under `--parallel`. Reported by other projects; not observed here. Treat as unresolved rather than settled — it may be version- or config-specific. |

**The sharpest single result:** a file at **0% coverage fails every threshold, including
`0.0`.** A project whose minimum per-file coverage is 50% passes `lines = 0.0`; add one file
at 0% and the same config exits 1. There is no value low enough to tolerate an untested file —
which is precisely the CLI-entry-point and top-level-script case. Configuring around it is not
possible.

Combined with the silent-unknown-keys result, the failure mode to fear is not a red build. It
is a **green build that everyone believes is gated**. `{ services = 85, lib = 90 }` looks
exactly like enforcement, exits 0 forever, and checks nothing.

### The pattern that works

Drop `coverageThreshold` from `bunfig.toml` entirely, and enforce in a script:

1. `bun test --coverage --coverage-reporter=lcov` to produce `coverage/lcov.info`.
2. A script (e.g. `scripts/check-coverage.ts`) parses `lcov.info` and sums `LF:`/`LH:`
   records — or `FNF:`/`FNH:` for functions — into an **overall** figure.
3. Compare against a threshold defined in one place, and on failure print which metric
   failed, the actual value, and the required value, then `process.exit(1)`.
4. Wire CI to run that script as its own step, rather than relying on Bun's exit code.

Why a script rather than config: it can enforce an **aggregate** threshold (which is what the
standards doc actually wants — 85% services / 90% lib, expressed per-directory), it can print
a usable message, and it can maintain a **missing-file guard** by comparing the set of files
in `lcov.info` against the files the project expects to be covered. None of those three are
achievable through `coverageThreshold`.

Note the two doc-sourced commands are both wrong as written: `--coverage-threshold` is not a
flag, and `{"services": 85, "lib": 90}` are not keys Bun recognises. Whatever implements this
should start from `lcov.info`, not from those snippets.

### Scope

Coverage gating is **not in P0's scope** and this ticket does not add it. The reason for
recording it here in this detail is that the next person to try will reach for `bunfig.toml`
first, watch CI stay green, and conclude coverage is being enforced. The verified table above
is the evidence that it is not.

## Incidental fix: `bun run build` was broken

`package.json` had `"build": "tsc --noEmit && bun build src/index.ts --outdir dist"`. This
**exits 1** — `bun build` defaults to a browser target, and `pg` requires the Node builtins
`dns` and `tls`:

```
error: Browser build cannot require() Node.js builtin: "dns".
```

Fixed by adding `--target bun`. The bundle then succeeds (315 modules → `dist/index.js`,
~1.0 MB). `dist/` was already gitignored. AGENTS.md documents `bun run build` as
"typecheck + bundle to dist/", so this restores the documented behaviour rather than changing
it.

## Verification

Simulated the workflow's steps in order, with the same environment it sets, against a
**freshly created** database:

```
### STAGE 1 ###
install          OK   (bun install --frozen-lockfile — "no changes")
typecheck        OK
lint             OK   (placeholder, exits 0)
build            OK   (315 modules bundled)

### STAGE 2 ###
push             OK   (Changes applied)
seed             OK   (31 permissions, 4 roles, 74 mappings, admin, org)
test             OK   159 pass / 0 fail, 307 expect() calls
```

Also verified:
- Workflow YAML parses; structure, job graph, and env wiring validated by script. The
  validator asserts the service container's credentials match `DATABASE_URL`, that `db:push`
  targets the same database `DATABASE_URL` names, that `--force` is present, that every
  referenced npm script exists, and that step order is `push < seed < test`.
- `bun run lint` exits 0 (so the step cannot fail the build before P0-004 lands).

**Not verified: PostgreSQL 14 specifically.** The local simulation ran on PostgreSQL 18, the
only version installed here. The version-sensitive-construct audit above is static evidence,
not a runtime proof. The first real CI run is the actual test of this — treat a red `test` job
on `postgres:14` as a version-compatibility finding, not as a mistake in the workflow.

## Definition of done — status

- [x] Every push and PR runs typecheck, lint, and the full suite against a real database.
- [x] Failures block merge (branch protection is a repository setting, not a file — see below).
- [x] `bun test` green with `DATABASE_URL` set — the P0 exit gate's suite condition.
- [ ] **First green run on GitHub Actions.** Requires the workflow to be pushed, and branch
      protection on `main` to require the two checks. Both are outside this repository's
      files: the check names to require are **`Typecheck, lint, build`** and **`Test (PostgreSQL)`**.

## Follow-up

- Enable branch protection on `main` requiring both jobs. Without it CI reports but does not
  *block*, which is the half of the requirement that actually matters.
- NWB-P0-005 replaces the `db:push` step with `db:migrate` once a baseline migration exists.
- NWB-P0-004 turns the `lint` step from a placeholder into a real check.
