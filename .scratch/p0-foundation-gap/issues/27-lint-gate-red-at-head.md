# NWB-P0-027 — `bun run lint` was red at HEAD, so the CI `quality` job could never pass (F-27)

**Status:** done — 2026-09-20 (verified locally: `bunx biome check .` → 0 errors / 416
warnings; typecheck + build + 325/325 `bun test` unchanged)
**Deps:** NWB-P0-004 (Biome adoption), NWB-P0-003 (CI). **Size:** S. **Fixes:** F-27.

## The defect

`bunx biome check .` at `d03dc49` reported **18 errors across 18 files** — 11
`assist/source/organizeImports` and 7 formatting — all in files the web/Server-Functions
work (`d03dc49`) added or rewrote:

```
src/app/start.ts, src/app/lib/createServerFn.ts, src/app/routes/**, src/app/server-functions/**,
src/server/index.ts, src/server/api/orgs/member.route.ts, src/tests/server-functions.test.ts
```

`bun run lint` exits non-zero on errors, so the workflow's `quality` job was red for every
push — the repo's own gate was decorative. The tracker claimed "lint PASS (errors)" from
NWB-P0-004/previous tickets, which was true of the tree those tickets left behind; the
regression came in with the next merge and nothing re-checked it.

## What was done

- `bunx biome check --write` over the 14 files with `organizeImports` errors, then
  `bunx biome format --write` over the 7 with formatting diffs (5 files needed both).
- Three of those were files this session touched anyway (NWB-P0-015's
  `src/server/middleware/auth.ts`, the new and extended test files); the other 15 were
  pre-existing offenders, fixed here because "green lint" is the precondition for every
  later ticket's verification.
- Nothing was reformatted beyond those files — no repo-wide `--write` (see AGENTS.md on
  the `biome.json` comment trap).

## Acceptance criteria

- [x] `bunx biome check .` → 0 errors (warnings are deliberately non-fatal; `noExplicitAny`
      remains a warning across 246 legacy sites)
- [x] The 416 warnings are unchanged in kind; no new warnings introduced by NWB-P0-015/024
- [x] typecheck, build, `bun test` green
- [ ] **CI must be observed green on GitHub** — the job has still never actually run
      (same standing item as NWB-P0-003/NWB-P0-022)
