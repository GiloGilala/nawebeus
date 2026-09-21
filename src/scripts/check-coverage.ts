#!/usr/bin/env bun
/**
 * Coverage gate — the Phase 1 cross-cutting requirement
 * ("85% services / 90% lib", Engineering Standards §9.5).
 *
 * This is a script rather than `bunfig.toml` configuration on purpose. The
 * investigation in `.scratch/p0-foundation-gap/issues/03-ci-pipeline.md`
 * verified empirically that Bun's `coverageThreshold`:
 *
 *   - is **per-file**, not aggregate, so one throwaway file sinks the run;
 *   - is enforced **only** when the `text` reporter is enabled, so an
 *     lcov-only CI job silently never fails;
 *   - prints **no message** naming the file, metric or threshold on failure;
 *   - **silently accepts unknown keys** — the exact config the standards doc
 *     proposes, `{ services = 85, lib = 90 }`, exits 0 forever and checks
 *     nothing;
 *   - cannot tolerate a 0%-coverage file at *any* threshold, including 0.0.
 *
 * The failure mode to fear there is not a red build but a **green build
 * everyone believes is gated**. So: parse `coverage/lcov.info`, aggregate per
 * directory, and say exactly what failed.
 *
 * Usage:
 *   bun test --coverage --coverage-reporter=lcov
 *   bun run coverage:check
 */

const LCOV_PATH = "coverage/lcov.info";

/**
 * Per-directory line-coverage floors.
 *
 * `src/services` and `src/lib` are the two the standards doc names. Everything
 * else (routes, server functions, db, tests) is deliberately ungated for now —
 * the "graduated gate" pattern the Phase 1 plan calls for. Widening the gate to
 * the rest of the tree is a Phase 2 task, once the queue services land;
 * enabling it now would make the gate permanently red, which teaches everyone
 * to ignore it.
 */
const THRESHOLDS: { prefix: string; minLines: number }[] = [
  { prefix: "src/services/", minLines: 85 },
  { prefix: "src/lib/", minLines: 90 },
];

/**
 * Files that must appear in the report. `coverageThreshold` has no
 * missing-file guard: a source file that no test ever imports simply does not
 * appear in lcov.info, so it cannot be counted against any threshold and its
 * 0% coverage is invisible. Listing the gated directories here means deleting
 * a test suite shows up as a gate failure instead of a coverage *improvement*.
 */
const REQUIRE_PRESENT = ["src/services/", "src/lib/"];

interface FileCoverage {
  path: string;
  linesFound: number;
  linesHit: number;
}

function parseLcov(text: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let path = "";
  let linesFound = 0;
  let linesHit = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      path = line.slice(3);
      linesFound = 0;
      linesHit = 0;
    } else if (line.startsWith("LF:")) {
      linesFound = Number.parseInt(line.slice(3), 10) || 0;
    } else if (line.startsWith("LH:")) {
      linesHit = Number.parseInt(line.slice(3), 10) || 0;
    } else if (line === "end_of_record" && path) {
      files.push({ path, linesFound, linesHit });
      path = "";
    }
  }
  return files;
}

function pct(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

async function main() {
  const file = Bun.file(LCOV_PATH);
  if (!(await file.exists())) {
    console.error(`✖ coverage gate: ${LCOV_PATH} not found.`);
    console.error("  Run: bun test --coverage --coverage-reporter=lcov");
    process.exit(1);
  }

  const files = parseLcov(await file.text());
  if (files.length === 0) {
    // An empty-but-present report would otherwise pass every threshold
    // vacuously — the same "green means nothing" trap as the config option.
    console.error(`✖ coverage gate: ${LCOV_PATH} contained no records.`);
    process.exit(1);
  }

  let failed = false;
  const lines: string[] = [];

  for (const { prefix, minLines } of THRESHOLDS) {
    const group = files.filter((f) => f.path.startsWith(prefix));

    if (group.length === 0 && REQUIRE_PRESENT.includes(prefix)) {
      console.error(`✖ coverage gate: no files under ${prefix} appear in ${LCOV_PATH}.`);
      console.error("  Either the tests for it were deleted, or the report is incomplete.");
      failed = true;
      continue;
    }

    const found = group.reduce((n, f) => n + f.linesFound, 0);
    const hit = group.reduce((n, f) => n + f.linesHit, 0);
    const actual = pct(hit, found);
    const ok = actual >= minLines;
    if (!ok) failed = true;

    lines.push(
      `${ok ? "✓" : "✖"} ${prefix.padEnd(16)} ${actual.toFixed(1).padStart(5)}% ` +
        `(${hit}/${found} lines, min ${minLines}%)  [${group.length} files]`,
    );

    if (!ok) {
      // Name the worst offenders — a gate that fails without telling you where
      // to look gets suppressed rather than fixed.
      const worst = [...group]
        .filter((f) => f.linesFound > 0)
        .sort((a, b) => pct(a.linesHit, a.linesFound) - pct(b.linesHit, b.linesFound))
        .slice(0, 5);
      for (const f of worst) {
        lines.push(
          `    ${pct(f.linesHit, f.linesFound).toFixed(1).padStart(5)}%  ` +
            `${f.linesHit}/${f.linesFound}  ${f.path}`,
        );
      }
    }
  }

  console.log("\nCoverage gate (aggregate line coverage per directory)\n");
  for (const l of lines) console.log(l);
  console.log("");

  if (failed) {
    console.error("✖ Coverage gate failed.\n");
    process.exit(1);
  }
  console.log("✓ Coverage gate passed.\n");
}

main();
