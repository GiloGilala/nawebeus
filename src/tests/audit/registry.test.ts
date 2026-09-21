/**
 * The audit vocabulary, kept honest (NWB-P1-002).
 *
 * Four of these tests are static scans, in the same family as `src/tests/route-invariants.test.ts`:
 * they read source files as text and fail on a shape that would compile, ship, and quietly cost
 * evidence later. They exist because the registry is only a guarantee if writing *around* it is
 * impossible — and nothing in TypeScript stops a caller from passing `action` through a `string`
 * variable, or from writing `module: "system"` and meeting `chk_ual_system_requires_checksum` in
 * production.
 *
 * Each scan asserts it found something. A scan that matches zero files passes forever, which is worse
 * than no scan at all because it looks like coverage.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MAINTENANCE_JOBS } from "../../jobs";
import {
  AUDIT_ACTION_FORMAT,
  AUDIT_ACTIONS,
  type AuditActionName,
  auditActionNamingProblem,
  auditActionSpec,
  LEGACY_AUDIT_ACTION_NAMES,
} from "../../services/audit";
import {
  AUDIT_CATEGORY_VALUES,
  AUDIT_MODULE_VALUES,
  AUDIT_SEVERITY_VALUES,
  CHECKSUM_ONLY_MODULES,
} from "../../services/audit/types";

const SRC_DIR = join(import.meta.dir, "..", "..");

/** Everything the application can write, minus the tests and this module's own definition site. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // The only exclusion is the audit module itself, where the names are *declared*. Tests are
        // scanned like everything else — a test fixture inventing `action: "test.thing"` is exactly how
        // an unregistered spelling survives review, because "it's only a test" is how vocabularies rot.
        if (relative(SRC_DIR, full) === join("services", "audit")) continue;
        walk(full);
      } else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
        out.push(full);
      }
    }
  };
  walk(SRC_DIR);
  return out;
}

/** The substring inside the parens/braces opened at `openIndex`, or null if unbalanced. */
function readBalanced(
  source: string,
  openIndex: number,
  open: string,
  close: string,
): string | null {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

interface AuditWriteSite {
  readonly file: string;
  readonly action: string;
}

/**
 * Every `action` literal handed to `writeAuditLog(...)` or declared in a job's `audit: { … }`.
 *
 * Matched structurally rather than by scanning for `action:` everywhere, because that word belongs to
 * CASL rules, the permission seed and the ability builder too — a naive scan would fail on code that
 * has nothing to do with audit and then be "fixed" by excluding the file that mattered.
 */
function auditWriteSites(): AuditWriteSite[] {
  const sites: AuditWriteSite[] = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    const rel = relative(SRC_DIR, file);
    const push = (region: string | null): void => {
      if (!region) return;
      const found = /(?:^|[,{]\s*)action:\s*"([^"]+)"/.exec(region);
      if (found?.[1]) sites.push({ file: rel, action: found[1] });
    };
    let at = source.indexOf("writeAuditLog(");
    while (at !== -1) {
      push(readBalanced(source, source.indexOf("(", at), "(", ")"));
      at = source.indexOf("writeAuditLog(", at + 14);
    }
    // Job definitions: `audit: { … action: "…" … }`, the shape `src/jobs/*.ts` declares.
    let atAudit = source.indexOf("audit: {");
    while (atAudit !== -1) {
      const brace = source.indexOf("{", atAudit);
      push(readBalanced(source, brace, "{", "}"));
      atAudit = source.indexOf("audit: {", atAudit + 8);
    }
  }
  return sites;
}

describe("audit action registry", () => {
  const sites = auditWriteSites();

  test("the scan sees real call sites, so it cannot pass by finding nothing", () => {
    // A named action from a named file: if this breaks, the scanner broke, not the code.
    expect(sites.some((s) => s.action === "auth.signin.completed")).toBe(true);
    expect(sites.length).toBeGreaterThan(25);
  });

  test("every action the application writes is registered", () => {
    const unregistered = sites.filter((s) => !(s.action in AUDIT_ACTIONS));
    // The message names the file, because "1 of 34 is wrong" is not actionable at 02:00 UTC.
    expect(
      unregistered.map((s) => `${s.file} → "${s.action}"`),
      "unregistered audit action; add it to AUDIT_ACTIONS in the same commit as the write",
    ).toEqual([]);
  });

  test("the only unregistered-looking spellings are the five grandfathered ones", () => {
    // Pinned as an exact set rather than "all legacy names are in the format's exception list": adding a
    // name here is the cheap way to silence the format rule, and it should cost an intentional edit.
    const expected: AuditActionName[] = [
      "apikeys.created",
      "apikeys.revoked",
      "apikeys.rotated",
      "auth.sessions.revoked_others",
      "security.password_changed",
    ];
    expect([...LEGACY_AUDIT_ACTION_NAMES].sort()).toEqual(expected.sort());
  });

  test("no non-legacy action violates the format rule", () => {
    const offenders = (Object.keys(AUDIT_ACTIONS) as AuditActionName[])
      .filter((name) => !auditActionSpec(name).legacyName)
      .filter((name) => !AUDIT_ACTION_FORMAT.test(name));
    expect(offenders).toEqual([]);
  });

  test("the format rule accepts the vocabulary and rejects the loose shapes", () => {
    expect(AUDIT_ACTION_FORMAT.test("organization.member.invited")).toBe(true);
    expect(AUDIT_ACTION_FORMAT.test("rate-limits.reclaimed")).toBe(true);
    expect(AUDIT_ACTION_FORMAT.test("accounts.purged")).toBe(true);
    // The three rejections that matter, each of which has appeared in a real codebase somewhere:
    expect(AUDIT_ACTION_FORMAT.test("user_delete")).toBe(false); // no separator at all
    expect(AUDIT_ACTION_FORMAT.test("User.Created")).toBe(false); // casing that breaks `grep action:`
    expect(AUDIT_ACTION_FORMAT.test("auth.")).toBe(false); // trailing dot from a template literal
    expect(AUDIT_ACTION_FORMAT.test("auth..failed")).toBe(false);
  });

  test("auditActionNamingProblem explains each rejection instead of just refusing it", () => {
    // Membership is checked first: "not in the registry" is the more actionable answer for a name a
    // caller invented, and the format branch is what a *registered* but malformed name would hit.
    expect(auditActionNamingProblem("user_delete")).toContain("is not registered");
    expect(auditActionNamingProblem("auth.signin.completed")).toBeNull();
  });

  test("every entry can be read by a human: description, category, resource type", () => {
    for (const name of Object.keys(AUDIT_ACTIONS) as AuditActionName[]) {
      const spec = auditActionSpec(name);
      expect(spec.description.length, `${name}: description`).toBeGreaterThan(20);
      expect(AUDIT_CATEGORY_VALUES).toContain(spec.category);
      if (spec.resourceType !== null) {
        expect(spec.resourceType.length, `${name}: resourceType`).toBeGreaterThan(1);
      }
      if (spec.severity) expect(AUDIT_SEVERITY_VALUES).toContain(spec.severity);
    }
  });

  test("the job set files its events exactly as the registry does", () => {
    // `src/lib/worker.ts` takes `category`/`resourceType` from the job definition, so this is the one
    // place where a duplicated value could disagree with the registry and nobody would notice.
    for (const job of MAINTENANCE_JOBS) {
      const spec = auditActionSpec(job.audit.action);
      expect(job.audit.category, `${job.name}: category`).toBe(spec.category);
      // `?? ""` because a job definition's `resourceType` is a required string while the registry's may
      // be null ("no single resource"): an action with no resource could never agree with a job that
      // names one, and that asymmetry is worth failing on rather than casting away.
      expect(job.audit.resourceType, `${job.name}: resourceType`).toBe(spec.resourceType ?? "");
    }
  });
});

describe("audit module taxonomy", () => {
  test("the derived union is the database's list, not a copy of it", () => {
    // 15 values, and `AuditModule` is `(typeof AUDIT_MODULE_VALUES)[number]` — so this assertion is the
    // drift detector: adding a value to the enum widens the type *and* fails nothing, while *renaming*
    // one surfaces here first rather than in a `22P02` at runtime.
    expect(AUDIT_MODULE_VALUES).toHaveLength(15);
    expect([...AUDIT_MODULE_VALUES]).toEqual([
      "core",
      "admin",
      "compliance",
      "security",
      "engagement",
      "publishing",
      "listening",
      "monitoring",
      "influencer",
      "pr",
      "commerce",
      "campaigns",
      "social_accounts",
      "analytics",
      "system",
    ]);
  });

  test("the checksum-only modules are exactly what the CHECK constraints name", () => {
    expect([...CHECKSUM_ONLY_MODULES].sort()).toEqual(["admin", "compliance", "system"]);
    for (const module of CHECKSUM_ONLY_MODULES) {
      expect(AUDIT_MODULE_VALUES).toContain(module);
    }
  });

  test("no writer uses a checksum-only module, because none computes a checksum yet", () => {
    // This is the failure mode NWB-P1-002 leaves behind on purpose: `AuditModule` now *contains*
    // `system` and `compliance`, so the type no longer stops a caller — only the database does, at
    // runtime, inside someone's request. `src/lib/worker.ts` and `src/services/users/dsar.service.ts`
    // carry comments pointing at NWB-P1-014 for exactly this reason; if this test ever fails, that is
    // the ticket to read.
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      source.split("\n").forEach((line, index) => {
        const text = line.trim();
        // Comments are skipped on purpose: this repo documents forbidden shapes *as* text — including
        // in this very test's header — and a scan that reports prose trains people to widen the
        // exclusion rather than to fix the code. Code lines only.
        if (text.startsWith("//") || text.startsWith("*") || text.startsWith("/*")) return;
        const match = /module:\s*"(admin|system|compliance)"/.exec(line);
        if (match?.[1]) offenders.push(`${relative(SRC_DIR, file)}:${index + 1} → ${match[1]}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
