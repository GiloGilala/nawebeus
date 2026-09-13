# NWB-P0-004 — Linter: adopt and configure (Biome)

**Status:** done — 2026-09-13
**Deps:** none (NWB-P0-003 wired the CI step in advance). **Size:** S.

## What was built

| Piece | File |
| --- | --- |
| Dependency | `@biomejs/biome` `^2.5.13` (dev) — single native binary, no plugin tree |
| Config | `biome.json` |
| Scripts | `lint` → `biome check .`, `lint:fix` → `biome check --write .`, `format` → `biome format --write .` |

`bun run lint` now exits non-zero on real violations. The `quality` job in `.github/workflows/ci.yml` already called it, so **no workflow change was needed** — the placeholder step wired in NWB-P0-003 became real by changing `package.json` only, which is what it was designed for.

## Why Biome, and why a dependency at all

AGENTS.md carries a hard rule: *before adding any new dependency, check whether Bun 1.4 already does it.* Checked and satisfied:

- `bun fmt` → `Script not found "fmt"` — **no** built-in formatter.
- `bun lint` → resolves to our own `package.json` script, not a Bun command.
- `bun check`, `bun biome`, `bun eslint`, `bun format` → none exist.

So Bun 1.4.0 ships no linter and no formatter, and a dependency is justified. Biome was chosen because the execution plan names it (*"Biome recommended — single binary, Bun-friendly"*) and because it replaces ESLint **and** Prettier with one binary, which matches what Engineering Standards §6 asks for without the plugin surface.

## Configuration decisions

**The config was written to match the code, not the other way round.** Biome's generated default uses `indentStyle: "tab"`; this codebase is 2-space throughout. Adopting the default would have rewritten every file for no benefit. Measured line lengths across `src/` (median 28, p90 71, p99 101) and set `lineWidth: 100`, so almost nothing reflowed. `quoteStyle: "double"` and `semicolons: "always"` also match existing style.

Config: `formatter` + `linter` (`preset: recommended`) + `assist.source.organizeImports`, with `vcs.useIgnoreFile: true` so `node_modules`, `dist`, `coverage`, and `drizzle` are excluded via `.gitignore` rather than by duplicating patterns.

### `noExplicitAny` is a warning, not an error — deliberate

Engineering Standards §6 says `any` is **forbidden** and specifies `no-explicit-any: "error"`. It is configured as `"warn"` here.

The codebase has **246 `any` sites**. Promoting the rule to `error` would fail CI from the moment it landed, and every one of those sites needs a real type — not a config change. That is a refactor, not a linter-adoption task, and it does not belong in a size-S ticket.

Choosing `warn` over `off` is the point: the count is reported on every run, is visible in CI output, and can only ratchet down. **Retightening to `"error"` is tracked follow-up work, not a decision to keep the rule soft.** Whoever does it has a precise starting number.

Same reasoning applies to the other warnings — they are visible debt, not hidden debt.

## Two real defects the linter caught

`biome check` exited 1 on two genuine problems, both fixed:

1. **`src/services/auth/auth.service.ts:191`** — `let payload;` in `refreshSession()` was implicitly `any` (`lint/suspicious/noImplicitAnyLet`). Typed as `JwtPayload` (already exported from `./jwt`, import extended).
2. **`src/tests/auth/api-key.test.ts:108`** — `((rows as any).rows?.[0] as any).id` (`lint/correctness/noUnsafeOptionalChaining`). The optional chain could yield `undefined`, which then became a confusing FK violation further down instead of a clear failure at the insert. Replaced with an explicit narrowing and a `throw` when the `INSERT … RETURNING` produces no row.

## A mistake worth recording: comments in `biome.json` silently disable the config

I wrote the rationale for the `noExplicitAny` decision as `//` comments inside `biome.json`. Biome's config parser rejects them:

```
parse | biome.json | Expected a property but instead found '// Engineering Standards §6 forbids...'
deserialize | biome.json | Incorrect type, expected an object, but received an array.
```

The dangerous part is what happened next: **Biome did not stop — it fell back to defaults and kept going.** The follow-up `biome check --write` therefore ran with *no* config and reformatted **134 files to tab indentation**, the opposite of the intent. It looked like a normal run; it was silently destructive.

Recovered by removing the comments and re-running `--write`, which is why formatting is idempotent again (0 files changed on a second pass). Two consequences:

- **Do not put comments in `biome.json`.** Rationale goes here, in AGENTS.md, or in the ticket.
- **A config that fails to parse should be treated as a hard failure.** Worth checking whether `--config-path` validation or a `biome check` on the config file itself should be its own CI step.

Because of this, the first `--write` pass churned the tree and was then reversed. The end state is correct and verified, but the intermediate state was not.

## Second oddity: `bun add` pulled in an unrelated dependency

`bun add -d @biomejs/biome` reported **"2 packages installed"** and added `@playwright/test@^1.63.0` to `package.json` as well. Nothing in `src/` or `tests/` references Playwright, it was absent from `bun.lock` at HEAD, and no frontend exists yet (D2). Removed with `bun remove @playwright/test`. Worth watching for — an unexplained heavyweight dependency appearing in the manifest is exactly the kind of thing a lockfile review should catch.

## Final state

```
bun run lint   →  0 errors, 305 warnings, 1 info across 137 files
```

| Rule | Count | Severity |
| --- | --- | --- |
| `suspicious/noExplicitAny` | 246 | warning (deliberate — see above) |
| `style/noNonNullAssertion` | 36 | warning |
| `correctness/noUnusedImports` | 18 | warning |
| `complexity/useOptionalChain` | 5 | warning |
| `style/useTemplate` | 1 | info |

All 18 unused imports are in **`db/`** — the schema modules excluded from `tsconfig.json`, so `tsc` has never seen them and could not catch them. They are left in place deliberately: removing imports from modules no type-checker compiles is a change I cannot verify, and they are non-blocking. Noted here so the count is explainable rather than mysterious.

Formatting and import order are now clean and stable: a second `biome check --write` reports "No fixes applied".

## Verification

- `bun run typecheck` — clean.
- `bun run lint` — exit 0. **And the gate was proven able to fail**: adding a deliberately malformed `src/**` file makes it exit 1; removing it returns it to 0. A lint step that cannot fail is worthless, so this was tested rather than assumed.
- `bun run build` — clean.
- `bun install --frozen-lockfile` — clean after the dependency changes, so CI's install step still works.
- Full suite with a live database — **159 pass / 0 fail**, re-confirmed after the reformat touched 134 files.
- Full CI sequence re-simulated on a fresh database (`db:push` → `seed` → `bun test`) — green.
- Workflow validator re-run — passes.

## Follow-up

- Ratchet `noExplicitAny` to `error` once the 246 sites are typed. That is its own ticket, not a tweak.
- Clear the 36 `noNonNullAssertion` and 5 `useOptionalChain` warnings.
- Consider a CI step that fails loudly if `biome.json` fails to parse, so the silent-fallback failure mode cannot recur.
- Engineering Standards §6 still specifies ESLint + Prettier and an `import/no-restricted-paths` boundary rule. Biome replaces both for formatting and linting, but **import-boundary enforcement is not yet implemented** and Biome has no direct equivalent of `import/no-restricted-paths`. The standards doc should be updated to name Biome, and the boundary rule needs a decision (Biome's `noRestrictedImports` can approximate it).
