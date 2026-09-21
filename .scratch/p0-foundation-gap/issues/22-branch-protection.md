# NWB-P0-022 — Branch protection + CI as a real gate

**Status:** blocked — **ops task, requires repo-owner access.** Implementation is not
possible from this agent's credentials; everything below is verified, and the exact
settings are specified so the change is a five-minute click-through for someone who has
admin on the repository.

- **Epic:** p0-foundation-gap
- **Source:** `docs/plan/master-roadmap/06-phase-1-foundation.md` §NWB-P0-022
- **Size:** S (for someone with access)
- **Blocks:** Phase 1 exit criterion 7

## Objective

Merging to `main` requires green CI. Today the workflow runs and reports, but nothing
stops a red pull request from being merged.

## Why this is filed rather than done

The ticket itself anticipates this: *"If the repo owner lacks settings access, file as an
ops task with exact settings."* The same applies to the agent. Verified 2026-09-20, not
assumed:

```
$ gh api repos/GiloGilala/nawebeus --jq .permissions
{"admin":false,"maintain":false,"pull":false,"push":false,"triage":false}

$ gh api repos/GiloGilala/nawebeus/branches/main/protection
403 Resource not accessible by integration     # cannot even READ the current settings

$ gh api -X PUT repos/GiloGilala/nawebeus/branches/main/protection --input ...
403 Resource not accessible by integration     # write likewise refused

$ gh api repos/GiloGilala/nawebeus/rulesets
[]                                             # no rulesets configured either
```

The token is the `arena-ai-coding-agent[bot]` GitHub App installation. It can push
branches and manage pull requests; it holds no `administration` permission, which is what
both the branch-protection and rulesets APIs require. **`main` has no protection of any
kind today** — neither classic protection nor a ruleset.

## Exact settings to apply

Settings → Branches → Add branch protection rule (or Rules → Rulesets, if you prefer the
newer UI — both are fine; the classic rule is described here because it matches the
ticket's wording).

- **Branch name pattern:** `main`
- ☑ **Require a pull request before merging** — no direct pushes to `main`.
  - Required approvals: **0 is acceptable** while this is a single-maintainer repo.
    Requiring 1 with no second maintainer would block every merge. Raise it when a
    second person joins.
- ☑ **Require status checks to pass before merging**
  - ☑ Require branches to be up to date before merging (`strict`)
  - Required checks — **use these exact strings**, which are the job `name:` values from
    `.github/workflows/ci.yml`, not the job ids (`quality` / `test`) that the roadmap
    text names:

    | Required check |
    |---|
    | `Typecheck, lint, build` |
    | `Test (PostgreSQL)` |

    GitHub matches required checks by their reported *name*. Entering `quality` or
    `test` would create a rule that can never be satisfied, which silently blocks every
    merge instead of gating on CI. Confirmed against the live check runs on commit
    `494c3a1`.
- ☐ **Do not** tick "Include administrators" for now. With a single maintainer it removes
  the only break-glass path; revisit once there is a second admin.
- Leave force-push and deletion protection at their defaults (both disallowed).

### Equivalent API call, for whoever has admin

```bash
gh api -X PUT repos/GiloGilala/nawebeus/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Typecheck, lint, build", "Test (PostgreSQL)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

## Acceptance

- [ ] A pull request with a failing check cannot be merged (verify with a deliberately
      red throwaway PR, then close it).
- [ ] A direct `git push origin main` is rejected.
- [ ] `gh api repos/GiloGilala/nawebeus/branches/main/protection` returns the two
      contexts above.
- [ ] AGENTS.md's note that "branch protection on `main` is not yet configured, so CI
      currently reports without blocking" is updated once it is.

## Related finding: CI does not yet use `db:migrate`

While verifying this I checked what CI actually runs, and found a claim of mine that was
too strong. `.github/workflows/ci.yml` still has:

```yaml
- name: Push schema
  run: bun run db:push -- --force
```

Phase 1 exit criterion 3 has three clauses — *migrations take a clean DB to current
schema*, *re-run is a no-op*, and *CI uses `db:migrate`*. NWB-P0-020 evidenced the first
two directly. **The third is not met.** My NWB-P0-020 write-up said criterion 3 was met;
that was accurate for the migration path and wrong about CI. Corrected in the roadmap and
in that ticket.

This is **NWB-P0-005's** outstanding step, and it is blocked by a *different* missing
permission on the same token — `workflows`. Re-verified 2026-09-20 by attempting a
one-line edit to the workflow and pushing:

```
! [remote rejected] refusing to allow a GitHub App to create or update workflow
  `.github/workflows/ci.yml` without `workflows` permission
```

The probe commit was reverted; the workflow file is untouched.

The step is harmless today only because the service container starts empty, so `db:push`
never hits the 42P16 non-idempotency that NWB-P0-009 documented. It should still be
swapped — the committed migrations are now the source of truth, and CI is not exercising
them.

## Ask for the repo owner

Two GitHub-side changes, both outside this agent's credentials:

1. **Apply the branch protection above** (needs repo admin). Closes this ticket and Phase
   1 exit criterion 7.
2. **Grant the Arena GitHub App the `workflows` permission**, or apply this one-line edit
   by hand — swap the `Push schema` step to `bun run db:migrate` with `DATABASE_URL`
   instead of the five `DB_*` variables. Closes NWB-P0-005 and the last clause of exit
   criterion 3.
