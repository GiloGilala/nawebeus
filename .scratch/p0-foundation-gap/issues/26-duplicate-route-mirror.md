# NWB-P0-026 — `src/app/**` carried a byte-identical second copy of the Hono API (F-26)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + build + 325/325
`bun test` with a live database; CI re-run pending)
**Deps:** none. **Size:** S. **Fixes:** F-26.

## The defect

The web/Server-Functions merge (`d03dc49`) moved the Hono API to `src/server/api/**`, and
`src/server/index.ts` says so in its header: "`src/app/*` previously held these Hono
routes; they remain as deprecated re-exports for backward compatibility and will be
removed once all imports are updated."

They were not re-exports — they were **full copies**: 21 files
(`src/app/auth/**`, `src/app/users/**`, `src/app/orgs/**`, `src/app/api-keys/**`), byte-for-byte
identical to the canonical tree except that one side imports through `@/…` and the other
through relative paths (verified with a normalised diff). Nothing imported them; only
their own `index.ts` files referenced each other.

Why it mattered: operating principle 8 — "Do not build a second implementation of
anything that exists". A developer editing `src/app/auth/signin.route.ts` (the path every
planning doc still names) would change nothing at runtime, and the two trees had already
started to be maintained in parallel by hand. NWB-P0-015 had to touch sign-in; doing that
in two places would have made the drift permanent.

## What was done

- Deleted the 21 duplicated files (`git rm -r src/app/auth src/app/users src/app/orgs
  src/app/api-keys`).
- Kept the genuine web layer: `src/app/server-functions/**`, `src/app/lib/createServerFn.ts`,
  `src/app/routes/**`, `src/app/router.tsx`, `src/app/routeTree.gen.ts`, `src/app/start.ts`.
- `AGENTS.md`'s architecture tree updated to name `src/server/api/**` as the Hono tree.

## Acceptance criteria

- [x] No file outside the deleted set imported it (`grep` over `src/`, `tsconfig`,
      `biome.json`, CI, `app.config.ts`)
- [x] `bun run typecheck`, `bun run lint`, `bun run build`, `bun test` (325/325) green
- [x] Historical `.scratch/` tickets and plan documents that name `src/app/…` route paths
      are left as dated records; `AGENTS.md` (current guidance) is corrected instead
